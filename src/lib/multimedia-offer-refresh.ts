import type { WithId } from "mongodb";
import { getUsdTryExchangeRate } from "@/lib/exchange-rate-service";
import { buildSystemPreparationData } from "@/lib/system-preparation-builder";
import { calculateMultimediaAutoDiscount } from "@/lib/multimedia-auto-discount";
import {
  getMultimediaPreparationsCollection,
  type MultimediaPreparationDocument,
} from "@/lib/multimedia-preparations-collection";
import { serializeSystemPreparation } from "@/lib/system-preparations-collection";

/** Refresh only new offers. Existing customer offer snapshots keep their agreed price. */
export async function refreshMultimediaForOffers(
  preparations: WithId<MultimediaPreparationDocument>[]
): Promise<WithId<MultimediaPreparationDocument>[]> {
  if (preparations.length === 0) return [];
  const rate = await getUsdTryExchangeRate();
  const refreshed: WithId<MultimediaPreparationDocument>[] = [];
  const operations = [];
  for (const preparation of preparations) {
    const snapshot = serializeSystemPreparation(preparation);
    // Rebuild the saved selection with current supplier prices; templates may have changed.
    const base = await buildSystemPreparationData({
      name: preparation.name,
      exchangeRate: rate.rate,
      exchangeRateDate: rate.rateDate,
      commissionRate: preparation.commissionRate,
      discountTry: preparation.automaticDiscount !== false ? 0 : preparation.discountTry,
      laborItems: snapshot.laborItems,
      selections: [],
      customItems: snapshot.items.map((item) => ({
        id: item.id,
        label: item.label,
        category: item.category,
        subCategory: item.subCategory,
        quantity: item.quantity,
        productId: item.productId,
        supplier: item.supplier,
        isCommissionIncluded: item.isCommissionIncluded,
      })),
    });
    const automaticDiscount = preparation.automaticDiscount !== false;
    const discountTry = automaticDiscount
      ? calculateMultimediaAutoDiscount(base.productTotalTry + base.commissionAmountTry + base.laborCostTry)
      : base.discountTry;
    const profitTry = base.commissionAmountTry + base.laborCostTry - discountTry;
    const { name: ignoredName, ...pricing } = base;
    void ignoredName;
    const update = {
      ...pricing,
      items: base.items.map((item, index) => ({
        ...item,
        source: preparation.items[index].source,
        ...(preparation.items[index].templateItemId
          ? { templateItemId: preparation.items[index].templateItemId }
          : {}),
      })),
      automaticDiscount,
      discountTry,
      profitTry,
      customerTotalTry: base.productTotalTry + profitTry,
      updatedAt: new Date(),
    };
    refreshed.push({ ...preparation, ...update });
    operations.push({ updateOne: {
      filter: { _id: preparation._id, status: "ready" as const },
      update: { $set: update },
    } });
  }
  const collection = await getMultimediaPreparationsCollection();
  await collection.bulkWrite(operations);
  return refreshed;
}
