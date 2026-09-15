import {
  ObjectId,
} from "mongodb";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getProductsCollection,
} from "@/lib/products-collection";

import {
  isProductPriceRefreshAttemptedToday,
  refreshProductPriceIfNeeded,
} from "@/lib/product-price-refresh";

import {
  getProductPriceSource,
  getProductPriceSourceLabel,
  roundCurrency,
} from "@/lib/scraping/product-source-price";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const MAX_PRODUCT_COUNT =
  50;

interface RefreshPricesRequest {
  productIds?: string[];
}

type RefreshItemStatus =
  | "updated"
  | "unchanged"
  | "unavailable"
  | "skipped-no-url"
  | "skipped-unsupported-url"
  | "not-found"
  | "failed";

interface RefreshItemResult {
  productId: string;
  productCode?: string;
  brand?: string;
  model?: string;
  source?: string;
  sourceUrl?: string;
  status: RefreshItemStatus;
  previousPriceUsd?: number;
  currentPriceUsd?: number;
  differenceUsd?: number;
  message?: string;
}

function cleanProductIds(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter(
          (
            item
          ): item is string =>
            typeof item ===
              "string"
        )
        .map((item) =>
          item.trim()
        )
        .filter(Boolean)
    )
  );
}

function identity(
  product: {
    productCode?: string;
    brand?: string;
    model?: string;
  }
) {
  return {
    productCode:
      product.productCode ??
      "",
    brand:
      product.brand ??
      "",
    model:
      product.model ??
      "",
  };
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      (await request
        .json()
        .catch(
          () => null
        )) as
        | RefreshPricesRequest
        | null;

    const productIds =
      cleanProductIds(
        body?.productIds
      );

    if (
      productIds.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "En az bir ürün ID göndermelisiniz.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      productIds.length >
      MAX_PRODUCT_COUNT
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Tek istekte en fazla ${MAX_PRODUCT_COUNT} ürün güncellenebilir.`,
        },
        {
          status: 400,
        }
      );
    }

    const validIds =
      productIds.filter(
        (productId) =>
          ObjectId.isValid(
            productId
          )
      );
    const invalidIds =
      productIds.filter(
        (productId) =>
          !ObjectId.isValid(
            productId
          )
      );

    const results:
      RefreshItemResult[] =
      invalidIds.map(
        (productId) => ({
          productId,
          status:
            "not-found",
          message:
            "Geçersiz ürün ID.",
        })
      );

    const products =
      await getProductsCollection();
    const documents =
      validIds.length > 0
        ? await products
            .find({
              _id: {
                $in:
                  validIds.map(
                    (id) =>
                      new ObjectId(
                        id
                      )
                  ),
              },
            })
            .toArray()
        : [];

    const map =
      new Map(
        documents.map(
          (product) => [
            product._id.toString(),
            product,
          ]
        )
      );

    for (
      const productId of
      validIds
    ) {
      const product =
        map.get(
          productId
        );

      if (!product) {
        results.push({
          productId,
          status:
            "not-found",
          message:
            "Ürün bulunamadı.",
        });
        continue;
      }

      const base =
        identity(
          product
        );
      const sourceUrl =
        typeof product.sourceUrl ===
          "string"
          ? product.sourceUrl.trim()
          : "";

      if (!sourceUrl) {
        results.push({
          productId,
          ...base,
          status:
            "skipped-no-url",
          message:
            "Ürün linki tanımlı değil.",
        });
        continue;
      }

      const source =
        getProductPriceSource(
          sourceUrl
        );

      if (!source) {
        results.push({
          productId,
          ...base,
          sourceUrl,
          status:
            "skipped-unsupported-url",
          message:
            "Bu ürün linki için desteklenen fiyat sağlayıcısı yok.",
        });
        continue;
      }

      const previousPriceUsd =
        roundCurrency(
          Number(
            product.priceUsd
          ) || 0
        );
      const alreadyCheckedToday =
        isProductPriceRefreshAttemptedToday(
          product
        );

      try {
        const refreshed =
          await refreshProductPriceIfNeeded(
            product,
            {
              force: true,
            }
          );
        const currentPriceUsd =
          roundCurrency(
            Number(
              refreshed.priceUsd
            ) || 0
          );
        const differenceUsd =
          roundCurrency(
            currentPriceUsd -
              previousPriceUsd
          );

        if (
          refreshed.sourceUnavailable ===
          true
        ) {
          results.push({
            productId,
            ...base,
            source,
            sourceUrl,
            status:
              "unavailable",
            previousPriceUsd,
            currentPriceUsd,
            differenceUsd: 0,
            message:
              alreadyCheckedToday
                ? "Ürün bugün zaten kontrol edildi; kaynak ürün satışta değil durumunda."
                : `${getProductPriceSourceLabel(source)} ürün kaynağı erişilemiyor veya ürün stokta yok. Fiyat korunarak ürün satışta değil olarak işaretlendi.`,
          });
          continue;
        }

        if (
          currentPriceUsd ===
          previousPriceUsd
        ) {
          results.push({
            productId,
            ...base,
            source,
            sourceUrl,
            status:
              "unchanged",
            previousPriceUsd,
            currentPriceUsd,
            differenceUsd: 0,
            message:
              alreadyCheckedToday
                ? "Ürün bugün zaten kontrol edildi; tekrar dış istek yapılmadı."
                : "Ürün fiyatı kontrol edildi; değişiklik yok.",
          });
          continue;
        }

        results.push({
          productId,
          ...base,
          source,
          sourceUrl,
          status:
            "updated",
          previousPriceUsd,
          currentPriceUsd,
          differenceUsd,
          message:
            "Ürün fiyatı güncellendi.",
        });
      } catch (error) {
        results.push({
          productId,
          ...base,
          source,
          sourceUrl,
          status:
            "failed",
          previousPriceUsd,
          message:
            error instanceof Error
              ? error.message
              : "Fiyat güncellenirken bilinmeyen bir hata oluştu.",
        });
      }
    }

    const count =
      (status: RefreshItemStatus) =>
        results.filter(
          (item) =>
            item.status ===
            status
        ).length;

    return NextResponse.json({
      success: true,
      message:
        "Toplu fiyat kontrolü tamamlandı.",
      data: {
        requestedCount:
          productIds.length,
        processedCount:
          results.length,
        updatedCount:
          count("updated"),
        unchangedCount:
          count("unchanged"),
        unavailableCount:
          count("unavailable"),
        skippedNoUrlCount:
          count(
            "skipped-no-url"
          ),
        skippedUnsupportedUrlCount:
          count(
            "skipped-unsupported-url"
          ),
        notFoundCount:
          count("not-found"),
        failedCount:
          count("failed"),
        items:
          results,
      },
    });
  } catch (error) {
    console.error(
      "POST /api/scraping/products/refresh-prices error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Toplu fiyat güncellemesi sırasında hata oluştu.",
      },
      {
        status: 500,
      }
    );
  }
}
