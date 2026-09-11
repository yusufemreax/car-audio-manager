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
  isEgbUrl,
  roundCurrency,
} from "@/lib/scraping/egb-price-scraper";

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
  | "skipped-no-url"
  | "skipped-unsupported-url"
  | "not-found"
  | "failed";

interface RefreshItemResult {
  productId: string;
  productCode?: string;
  brand?: string;
  model?: string;
  sourceUrl?: string;
  status: RefreshItemStatus;
  previousPriceUsd?: number;
  remotePriceUsd?: number;
  currentPriceUsd?: number;
  differenceUsd?: number;
  updatedAt?: string;
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

function productIdentity(
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
      productIds.length ===
      0
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

    const productDocuments =
      validIds.length > 0
        ? await products
            .find({
              _id: {
                $in:
                  validIds.map(
                    (productId) =>
                      new ObjectId(
                        productId
                      )
                  ),
              },
            })
            .toArray()
        : [];

    const productMap =
      new Map(
        productDocuments.map(
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
        productMap.get(
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

      const identity =
        productIdentity(
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
          ...identity,
          status:
            "skipped-no-url",
          message:
            "Ürün linki tanımlı değil.",
        });
        continue;
      }

      if (!isEgbUrl(sourceUrl)) {
        results.push({
          productId,
          ...identity,
          sourceUrl,
          status:
            "skipped-unsupported-url",
          message:
            "Bu ürün linki için henüz desteklenen bir fiyat sağlayıcısı yok.",
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
            ...identity,
            sourceUrl,
            status: "failed",
            previousPriceUsd,
            currentPriceUsd,
            differenceUsd: 0,
            message:
              alreadyCheckedToday
                ? "Ürün bugün zaten kontrol edildi; EGB sayfası 404 durumunda."
                : "EGB ürün sayfası 404 döndü. Fiyat korunarak ürün satışta değil olarak işaretlendi.",
          });
          continue;
        }

        if (
          currentPriceUsd ===
          previousPriceUsd
        ) {
          results.push({
            productId,
            ...identity,
            sourceUrl,
            status:
              "unchanged",
            previousPriceUsd,
            remotePriceUsd:
              currentPriceUsd,
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
          ...identity,
          sourceUrl,
          status: "updated",
          previousPriceUsd,
          remotePriceUsd:
            currentPriceUsd,
          currentPriceUsd,
          differenceUsd,
          ...(refreshed.updatedAt instanceof Date
            ? {
                updatedAt:
                  refreshed.updatedAt.toISOString(),
              }
            : {}),
          message:
            "Ürün fiyatı güncellendi.",
        });
      } catch (error) {
        results.push({
          productId,
          ...identity,
          sourceUrl,
          status: "failed",
          previousPriceUsd,
          message:
            error instanceof Error
              ? error.message
              : "Fiyat güncellenirken bilinmeyen bir hata oluştu.",
        });
      }
    }

    const countByStatus =
      (
        status:
          RefreshItemStatus
      ) =>
        results.filter(
          (item) =>
            item.status ===
            status
        ).length;

    const updatedCount =
      countByStatus(
        "updated"
      );
    const unchangedCount =
      countByStatus(
        "unchanged"
      );
    const skippedNoUrlCount =
      countByStatus(
        "skipped-no-url"
      );
    const skippedUnsupportedUrlCount =
      countByStatus(
        "skipped-unsupported-url"
      );
    const notFoundCount =
      countByStatus(
        "not-found"
      );
    const failedCount =
      countByStatus(
        "failed"
      );

    return NextResponse.json({
      success: true,
      message:
        failedCount > 0
          ? "Toplu fiyat kontrolü tamamlandı. Bazı ürünler 404 veya başka bir hata nedeniyle güncellenemedi."
          : updatedCount > 0
            ? "Toplu fiyat kontrolü tamamlandı ve değişen fiyatlar güncellendi."
            : "Toplu fiyat kontrolü tamamlandı. Bugün tekrar kontrol gerektiren fiyat bulunamadı.",
      data: {
        requestedCount:
          productIds.length,
        processedCount:
          results.length,
        updatedCount,
        unchangedCount,
        skippedNoUrlCount,
        skippedUnsupportedUrlCount,
        notFoundCount,
        failedCount,
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
