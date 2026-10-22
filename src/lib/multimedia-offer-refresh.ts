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
/** The day is persisted in MongoDB so restarts and other server instances reuse it. */
export function multimediaRefreshDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function storedResult(preparation: WithId<MultimediaPreparationDocument>) {
  if (preparation.dailyRefreshError) throw new Error(preparation.dailyRefreshError);
  return preparation;
}
async function buildUpdate(preparation: WithId<MultimediaPreparationDocument>, rate: { rate: number; rateDate?: string }, day: string) {
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
    }, { storedProductPrices: true });
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
    return {
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
      dailyRefreshDate: day,
      updatedAt: new Date(),
    };
}
/** Only ready-package snapshots change. Existing customer offers keep their agreement. */
async function refreshOne(original: WithId<MultimediaPreparationDocument>, day: string, getRate: typeof getUsdTryExchangeRate) {
  const collection = await getMultimediaPreparationsCollection();
  // Another request may already have completed the daily work since the caller read its list.
  const stored = await collection.findOne({ _id: original._id, status: "ready" });
  if (!stored) throw new Error("Hazır multimedya değiştirildi veya kaldırıldı.");
  let preparation: WithId<MultimediaPreparationDocument> = stored;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (preparation.dailyRefreshDate === day) return storedResult(preparation);
    let update: Partial<MultimediaPreparationDocument>;
    let failure: string | undefined;
    try {
      update = await buildUpdate(preparation, await getRate(), day);
    } catch (error) {
      failure = error instanceof Error ? error.message : "Ürünler yenilenemedi; son kayıt gösteriliyor.";
      // Unavailable packages also get a daily stamp: reads must not repeat failed work.
      update = { dailyRefreshDate: day, dailyRefreshError: failure, updatedAt: new Date() };
    }
    const result = await collection.updateOne(
      { _id: preparation._id, status: "ready", updatedAt: preparation.updatedAt },
      { $set: update, ...(!failure ? { $unset: { dailyRefreshError: "" as const } } : {}) },
    );
    if (result.matchedCount) {
      if (failure) throw new Error(failure);
      const fresh = { ...preparation, ...update };
      delete fresh.dailyRefreshError;
      return fresh;
    }
    const latest = await collection.findOne({ _id: preparation._id, status: "ready" });
    if (!latest) throw new Error("Hazır multimedya değiştirildi veya kaldırıldı.");
    preparation = latest;
  }
  throw new Error("Hazır multimedya eşzamanlı güncelleniyor. Lütfen yeniden deneyin.");
}
export async function refreshMultimediaForOffers(preparations: WithId<MultimediaPreparationDocument>[]) {
  const day = multimediaRefreshDay();
  let rate: ReturnType<typeof getUsdTryExchangeRate> | undefined;
  const getRate = () => rate ??= getUsdTryExchangeRate();
  const results: WithId<MultimediaPreparationDocument>[] = [];
  for (const preparation of preparations) {
    // The hot path performs no product read, exchange-rate read, calculation or write.
    if (preparation.dailyRefreshDate === day) { results.push(storedResult(preparation)); continue; }
    const id = preparation._id.toHexString();
    const existing = inFlight.get(id);
    if (existing) { results.push(await existing); continue; }
    const pending = refreshOne(preparation, day, getRate);
    inFlight.set(id, pending);
    try { results.push(await pending); }
    finally { if (inFlight.get(id) === pending) inFlight.delete(id); }
  }
  return results;
}
