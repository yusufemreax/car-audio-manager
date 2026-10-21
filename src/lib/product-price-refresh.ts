import type { WithId } from "mongodb";
import {
  getProductsCollection,
  type ProductDocument,
} from "@/lib/products-collection";
import { normalizeProductSuppliers } from "@/types/supplier";
import {
  fetchProductSourcePrice,
  getProductPriceSource,
  isProductSourceNotFoundError,
  roundCurrency,
} from "@/lib/scraping/product-source-price";

type SupplierRow = NonNullable<ProductDocument["supplierPrices"]>[number];
const inFlight = new Map<string, Promise<WithId<ProductDocument>>>();
export function getIstanbulDayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
function rowsFor(product: WithId<ProductDocument>): SupplierRow[] {
  return normalizeProductSuppliers(product.suppliers).map((supplier, index) => {
    const row = product.supplierPrices?.find(
      (entry) => entry.supplier === supplier,
    );
    return {
      ...row,
      supplier,
      priceUsd: Number(row?.priceUsd ?? product.priceUsd) || 0,
      ...(index === 0
        ? {
            sourceUrl: row?.sourceUrl || product.sourceUrl,
            priceCheckedAt: row?.priceCheckedAt ?? product.priceCheckedAt,
            priceRefreshAttemptedAt:
              row?.priceRefreshAttemptedAt ?? product.priceRefreshAttemptedAt,
            sourceAvailabilityCheckedAt:
              row?.sourceAvailabilityCheckedAt ??
              product.sourceAvailabilityCheckedAt,
            sourceUnavailable:
              row?.sourceUnavailable ?? product.sourceUnavailable,
          }
        : {}),
    };
  });
}
function rowFresh(row: SupplierRow, now: Date) {
  if (!row.sourceUrl?.trim()) return true;
  const checked =
    row.priceRefreshAttemptedAt ??
    row.sourceAvailabilityCheckedAt ??
    row.priceCheckedAt;
  return (
    checked instanceof Date &&
    Number.isFinite(checked.getTime()) &&
    getIstanbulDayKey(checked) === getIstanbulDayKey(now)
  );
}
export function isProductPriceFresh(
  product: WithId<ProductDocument>,
  now = new Date(),
) {
  return rowsFor(product).every((row) => rowFresh(row, now));
}
export const isProductPriceRefreshAttemptedToday = isProductPriceFresh;
async function refresh(
  product: WithId<ProductDocument>,
): Promise<WithId<ProductDocument>> {
  const collection = await getProductsCollection();
  // A caller can hold yesterday's document after a concurrent request refreshed it.
  const latest = await collection.findOne({ _id: product._id });
  if (latest) product = latest;
  const now = new Date();
  if (isProductPriceFresh(product, now)) return product;
  const rows = rowsFor(product);
  let success = false,
    availabilityChecked = false;
  for (const row of rows) {
    if (rowFresh(row, now)) continue;
    row.priceRefreshAttemptedAt = now;
    const source = getProductPriceSource(row.sourceUrl!);
    if (!source || (row.supplier !== "Diğer" && source !== row.supplier))
      continue;
    try {
      const remote = await fetchProductSourcePrice(row.sourceUrl!);
      row.priceUsd = roundCurrency(remote.priceUsd);
      row.priceCheckedAt = now;
      row.sourceAvailabilityCheckedAt = now;
      row.sourceUnavailable = false;
      success = true;
      availabilityChecked = true;
    } catch (error) {
      if (isProductSourceNotFoundError(error)) {
        row.sourceUnavailable = true;
        row.sourceAvailabilityCheckedAt = now;
        availabilityChecked = true;
      } else {
        // Timeouts/5xx never prove that an item is no longer sold. Preserve its state and price.
        console.warn(
          "Supplier price check failed; stored data preserved",
          product._id.toHexString(),
          row.supplier,
        );
      }
    }
  }
  const available = rows.find((row) => row.sourceUnavailable !== true);
  const update = {
    supplierPrices: rows,
    priceUsd: available?.priceUsd ?? product.priceUsd,
    sourceUnavailable: rows.every((row) => row.sourceUnavailable === true),
    priceRefreshAttemptedAt: now,
    ...(success ? { priceCheckedAt: now } : {}),
    ...(availabilityChecked ? { sourceAvailabilityCheckedAt: now } : {}),
    updatedAt: now,
  };
  // Do not overwrite a product edited while its supplier sites were being read.
  const result = await collection.updateOne(
    { _id: product._id, updatedAt: product.updatedAt },
    { $set: update },
  );
  if (result.matchedCount === 0)
    return (await collection.findOne({ _id: product._id })) ?? product;
  return { ...product, ...update };
}
export async function refreshProductPriceIfNeeded(
  product: WithId<ProductDocument>,
  _options?: { force?: boolean },
) {
  void _options; // The once-per-Istanbul-day limit also applies to manual refresh.
  if (isProductPriceFresh(product)) return product;
  const id = product._id.toHexString(),
    existing = inFlight.get(id);
  if (existing) return existing;
  const promise = refresh(product);
  inFlight.set(id, promise);
  try {
    return await promise;
  } finally {
    if (inFlight.get(id) === promise) inFlight.delete(id);
  }
}
export async function refreshProductPricesIfNeeded(
  products: WithId<ProductDocument>[],
  options?: { force?: boolean },
) {
  const results: WithId<ProductDocument>[] = new Array(products.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, products.length) }, async () => {
      while (next < products.length) {
        const index = next++;
        results[index] = await refreshProductPriceIfNeeded(
          products[index],
          options,
        );
      }
    }),
  );
  return results;
}
