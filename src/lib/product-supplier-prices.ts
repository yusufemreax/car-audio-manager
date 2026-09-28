import type {
  ProductSupplier,
  ProductSupplierPrice,
} from "@/types/supplier";

import {
  fetchProductSourcePrice,
  getProductPriceSource,
  roundCurrency,
} from "@/lib/scraping/product-source-price";

export interface ResolvedProductSupplierPrice {
  supplier: ProductSupplier;
  priceUsd: number;
  sourceUrl?: string;
  priceCheckedAt?: Date;
  sourceUnavailable?: boolean;
}

function cleanString(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export async function resolveProductSupplierPrices(
  value: unknown,
  suppliers: ProductSupplier[],
  legacyPriceUsd: unknown,
  legacySourceUrl: unknown
): Promise<ResolvedProductSupplierPrice[]> {
  const rows =
    Array.isArray(value)
      ? (value as ProductSupplierPrice[])
      : [];

  const now = new Date();
  const resolved: ResolvedProductSupplierPrice[] = [];

  for (let index = 0; index < suppliers.length; index++) {
    const supplier = suppliers[index];
    const row = rows.find(
      (item) => item?.supplier === supplier
    );
    const sourceUrl = cleanString(
      row?.sourceUrl ??
        (index === 0 ? legacySourceUrl : "")
    );
    let priceUsd = Number(
      row?.priceUsd ?? legacyPriceUsd
    );

    if (sourceUrl) {
      const source =
        getProductPriceSource(sourceUrl);

      if (
        supplier !== "Diğer" &&
        source !== supplier
      ) {
        throw new Error(
          `${supplier} tedarikçisi için kendi ürün linkini girmelisiniz.`
        );
      }

      if (source) {
        const remote =
          await fetchProductSourcePrice(
            sourceUrl
          );

        priceUsd =
          roundCurrency(
            remote.priceUsd
          );
      } else if (supplier !== "Diğer") {
        throw new Error(
          `${supplier} ürün linki desteklenmiyor.`
        );
      }
    }

    if (
      !Number.isFinite(priceUsd) ||
      priceUsd < 0
    ) {
      throw new Error(
        `${supplier} için USD fiyatı 0 veya daha büyük olmalıdır.`
      );
    }

    resolved.push({
      supplier,
      priceUsd:
        roundCurrency(priceUsd),
      ...(sourceUrl
        ? {
            sourceUrl,
            priceCheckedAt: now,
            sourceUnavailable: false,
          }
        : {}),
    });
  }

  return resolved;
}
