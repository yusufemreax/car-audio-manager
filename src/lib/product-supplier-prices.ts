import type { ProductDocument } from "./products-collection";
import type { ProductSupplier, ProductSupplierPrice } from "@/types/supplier";

import {
  fetchProductSourcePrice,
  getProductPriceSource,
  roundCurrency,
  isProductSourceNotFoundError,
} from "@/lib/scraping/product-source-price";

export interface ResolvedProductSupplierPrice {
  supplier: ProductSupplier;
  productCode?: string;
  priceRefreshAttemptedAt?: Date;
  sourceAvailabilityCheckedAt?: Date;
  priceUsd: number;
  sourceUrl?: string;
  priceCheckedAt?: Date;
  sourceUnavailable?: boolean;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function resolveProductSupplierPrices(
  value: unknown,
  suppliers: ProductSupplier[],
  legacyPriceUsd: unknown,
  legacySourceUrl: unknown,
  existing?: ProductDocument,
): Promise<ResolvedProductSupplierPrice[]> {
  const rows = Array.isArray(value) ? (value as ProductSupplierPrice[]) : [];

  const now = new Date();
  const resolved: ResolvedProductSupplierPrice[] = [];

  for (let index = 0; index < suppliers.length; index++) {
    const supplier = suppliers[index];
    const row = rows.find((item) => item?.supplier === supplier);
    const sourceUrl = cleanString(
      row?.sourceUrl ?? (index === 0 ? legacySourceUrl : ""),
    );
    let priceUsd = Number(row?.priceUsd ?? legacyPriceUsd);

    let checkedAt: Date | undefined;
    let attemptedAt: Date | undefined;
    let availabilityCheckedAt: Date | undefined;
    let unavailable: boolean | undefined;
    if (sourceUrl) {
      const source = getProductPriceSource(sourceUrl);

      if (supplier !== "Diğer" && source !== supplier) {
        throw new Error(
          `${supplier} tedarikçisi için kendi ürün linkini girmelisiniz.`,
        );
      }

      if (source) {
        attemptedAt = now;
        try {
          const remote = await fetchProductSourcePrice(sourceUrl);
          priceUsd = roundCurrency(remote.priceUsd);
          checkedAt = now;
          availabilityCheckedAt = now;
          unavailable = false;
        } catch (error) {
          const old = existing?.supplierPrices?.find(
            (item) => item.supplier === supplier,
          );
          const previousUrl =
            old?.sourceUrl ?? (index === 0 ? existing?.sourceUrl : undefined);
          if (!existing || previousUrl !== sourceUrl) throw error;
          priceUsd = old?.priceUsd ?? existing.priceUsd;
          checkedAt =
            old?.priceCheckedAt ??
            (index === 0 ? existing.priceCheckedAt : undefined);
          unavailable = isProductSourceNotFoundError(error)
            ? true
            : old?.sourceUnavailable ?? (index === 0 ? existing.sourceUnavailable : undefined);
          availabilityCheckedAt = isProductSourceNotFoundError(error)
            ? now
            : old?.sourceAvailabilityCheckedAt;
        }
      } else if (supplier !== "Diğer") {
        throw new Error(`${supplier} ürün linki desteklenmiyor.`);
      }
    }

    if (!Number.isFinite(priceUsd) || priceUsd < 0) {
      throw new Error(
        `${supplier} için USD fiyatı 0 veya daha büyük olmalıdır.`,
      );
    }

    resolved.push({
      supplier,
      ...(cleanString(row?.productCode)
        ? {
            productCode: cleanString(row?.productCode)
              .toUpperCase()
              .slice(0, 100),
          }
        : {}),
      priceUsd: roundCurrency(priceUsd),
      ...(sourceUrl
        ? {
            sourceUrl,
            ...(checkedAt ? { priceCheckedAt: checkedAt } : {}),
            ...(attemptedAt ? { priceRefreshAttemptedAt: attemptedAt } : {}),
            ...(availabilityCheckedAt
              ? { sourceAvailabilityCheckedAt: availabilityCheckedAt }
              : {}),
            ...(typeof unavailable === "boolean"
              ? { sourceUnavailable: unavailable }
              : {}),
          }
        : {}),
    });
  }

  return resolved;
}
