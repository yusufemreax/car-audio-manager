import type { WithId } from "mongodb";
import { getUsdTryExchangeRate } from "@/lib/exchange-rate-service";
import { buildSystemPreparationData } from "@/lib/system-preparation-builder";
import { calculateMultimediaAutoDiscount } from "@/lib/multimedia-auto-discount";
import {
  getMultimediaPreparationsCollection,
  type MultimediaPreparationDocument,
} from "@/lib/multimedia-preparations-collection";
import { serializeSystemPreparation } from "@/lib/system-preparations-collection";
import { resolveMultimediaSuppliers } from "./multimedia-supplier-resolution";

const inFlight = new Map<
  string,
  Promise<WithId<MultimediaPreparationDocument>>
>();
/** Only ready-package snapshots change. Existing customer offers keep their agreement. */
async function refreshOne(
  original: WithId<MultimediaPreparationDocument>,
  rate: { rate: number; rateDate?: string },
) {
  const collection = await getMultimediaPreparationsCollection();
  let preparation = original;
  for (let attempt = 0; attempt < 3; attempt++) {
    const snapshot = serializeSystemPreparation(preparation);
    const resolved =
      preparation.multimediaMode !== "vehicle_specific"
        ? await resolveMultimediaSuppliers(
            preparation.items,
            preparation.supplierPreference,
          )
        : {
            items: preparation.items,
            preference: undefined,
            screen: undefined,
          };
    const base = await buildSystemPreparationData({
      name: preparation.name,
      exchangeRate: rate.rate,
      exchangeRateDate: rate.rateDate,
      commissionRate: preparation.commissionRate,
      discountTry:
        preparation.automaticDiscount !== false ? 0 : preparation.discountTry,
      laborItems: snapshot.laborItems,
      selections: [],
      customItems: resolved.items.map((item) => ({
        id: item.id,
        label: item.label,
        category: item.category,
        subCategory: item.subCategory,
        quantity: item.quantity,
        productId: item.productId?.toHexString(),
        supplier: item.supplier,
        isCommissionIncluded: item.isCommissionIncluded !== false,
      })),
    });
    const automaticDiscount = preparation.automaticDiscount !== false;
    const discountTry = automaticDiscount
      ? calculateMultimediaAutoDiscount(
          base.productTotalTry + base.commissionAmountTry + base.laborCostTry,
        )
      : base.discountTry;
    const profitTry =
      base.commissionAmountTry + base.laborCostTry - discountTry;
    const { name: ignored, ...pricing } = base;
    void ignored;
    const screen = resolved.screen;
    const update = {
      ...pricing,
      items: base.items.map((item) => {
        const source = preparation.items.find(
          (original) => original.id === item.id,
        );
        return {
          ...item,
          source: source?.source ?? item.source,
          ...(source?.templateItemId
            ? { templateItemId: source.templateItemId }
            : {}),
        };
      }),
      ...(resolved.preference
        ? { supplierPreference: resolved.preference }
        : {}),
      ...(screen
        ? {
            multimediaProductId: screen._id,
            multimediaScreenSize: String(
              screen.specifications.screenSize ?? "",
            ),
            multimediaRam: String(screen.specifications.ram ?? ""),
            multimediaStorage: String(screen.specifications.storage ?? ""),
          }
        : {}),
      automaticDiscount,
      discountTry,
      profitTry,
      customerTotalTry: base.productTotalTry + profitTry,
      updatedAt: new Date(),
    };
    const result = await collection.updateOne(
      {
        _id: preparation._id,
        status: "ready",
        updatedAt: preparation.updatedAt,
      },
      { $set: update },
    );
    if (result.matchedCount) return { ...preparation, ...update };
    const latest = await collection.findOne({
      _id: preparation._id,
      status: "ready",
    });
    if (!latest)
      throw new Error("Hazır multimedya değiştirildi veya kaldırıldı.");
    preparation = latest;
  }
  throw new Error(
    "Hazır multimedya eşzamanlı güncelleniyor. Lütfen yeniden deneyin.",
  );
}
export async function refreshMultimediaForOffers(
  preparations: WithId<MultimediaPreparationDocument>[],
) {
  if (!preparations.length) return [];
  const rate = await getUsdTryExchangeRate();
  const results: WithId<MultimediaPreparationDocument>[] = [];
  for (const preparation of preparations) {
    const id = preparation._id.toHexString();
    const existing = inFlight.get(id);
    if (existing) {
      results.push(await existing);
      continue;
    }
    const pending = refreshOne(preparation, rate);
    inFlight.set(id, pending);
    try {
      results.push(await pending);
    } finally {
      if (inFlight.get(id) === pending) inFlight.delete(id);
    }
  }
  return results;
}
