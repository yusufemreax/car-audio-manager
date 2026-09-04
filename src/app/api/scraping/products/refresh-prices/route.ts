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
  EgbPriceScraperError,
  fetchEgbProductPrice,
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
  rawRemotePrice?: string;
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

    /*
     * =====================================================
     * VALID / INVALID IDS
     * =====================================================
     */

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

    /*
     * =====================================================
     * LOAD PRODUCTS IN ONE DB QUERY
     * =====================================================
     */

    const products =
      await getProductsCollection();

    const objectIds =
      validIds.map(
        (productId) =>
          new ObjectId(
            productId
          )
      );

    const productDocuments =
      objectIds.length >
      0
        ? await products
            .find({
              _id: {
                $in:
                  objectIds,
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

    /*
     * =====================================================
     * PROCESS SEQUENTIALLY
     *
     * EGB'ye aynı anda onlarca request göndermek yerine
     * kontrollü şekilde tek tek ilerliyoruz.
     * =====================================================
     */

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

      /*
       * Link yoksa normal durum.
       * Hata olarak saymıyoruz.
       */
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

      /*
       * Şimdilik sadece EGB provider'ı mevcut.
       * İleride OZDEMIR scraper geldiğinde
       * domain/provider çözümleme buraya eklenecek.
       */
      if (
        !isEgbUrl(
          sourceUrl
        )
      ) {
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

      try {
        const remote =
          await fetchEgbProductPrice(
            sourceUrl
          );

        const remotePriceUsd =
          roundCurrency(
            remote.priceUsd
          );

        const differenceUsd =
          roundCurrency(
            remotePriceUsd -
              previousPriceUsd
          );

        /*
         * ===============================================
         * SAME PRICE
         * ===============================================
         */

        if (
          remotePriceUsd ===
          previousPriceUsd
        ) {
          results.push({
            productId,
            ...identity,
            sourceUrl,
            status:
              "unchanged",
            previousPriceUsd,
            remotePriceUsd,
            currentPriceUsd:
              previousPriceUsd,
            differenceUsd: 0,
            rawRemotePrice:
              remote.rawPrice,
            message:
              "Ürün fiyatı zaten güncel.",
          });

          continue;
        }

        /*
         * ===============================================
         * UPDATE PRICE
         * ===============================================
         */

        const now =
          new Date();

        const updateResult =
          await products.updateOne(
            {
              _id:
                product._id,

              /*
               * Aynı anda başka bir işlem fiyatı
               * değiştirdiyse üzerine körlemesine
               * yazmamak için mevcut fiyatı da
               * filtreye ekliyoruz.
               */
              priceUsd:
                product.priceUsd,
            },
            {
              $set: {
                priceUsd:
                  remotePriceUsd,
                updatedAt:
                  now,
              },
            }
          );

        /*
         * matchedCount 0 ise ürün başka bir işlem
         * tarafından değişmiş olabilir.
         * Tekrar okuyup son durumu raporluyoruz.
         */
        if (
          updateResult.matchedCount ===
          0
        ) {
          const latestProduct =
            await products.findOne(
              {
                _id:
                  product._id,
              }
            );

          const latestPriceUsd =
            roundCurrency(
              Number(
                latestProduct
                  ?.priceUsd
              ) || 0
            );

          if (
            latestPriceUsd ===
            remotePriceUsd
          ) {
            results.push({
              productId,
              ...identity,
              sourceUrl,
              status:
                "unchanged",
              previousPriceUsd,
              remotePriceUsd,
              currentPriceUsd:
                latestPriceUsd,
              differenceUsd,
              rawRemotePrice:
                remote.rawPrice,
              message:
                "Fiyat başka bir işlem tarafından zaten güncellenmiş.",
            });

            continue;
          }

          results.push({
            productId,
            ...identity,
            sourceUrl,
            status:
              "failed",
            previousPriceUsd,
            remotePriceUsd,
            currentPriceUsd:
              latestPriceUsd,
            differenceUsd,
            rawRemotePrice:
              remote.rawPrice,
            message:
              "Ürün fiyatı eşzamanlı başka bir değişiklik nedeniyle güncellenemedi.",
          });

          continue;
        }

        results.push({
          productId,
          ...identity,
          sourceUrl,
          status:
            "updated",
          previousPriceUsd,
          remotePriceUsd,
          currentPriceUsd:
            remotePriceUsd,
          differenceUsd,
          rawRemotePrice:
            remote.rawPrice,
          updatedAt:
            now.toISOString(),
          message:
            "Ürün fiyatı güncellendi.",
        });
      } catch (error) {
        if (
          error instanceof
          EgbPriceScraperError
        ) {
          results.push({
            productId,
            ...identity,
            sourceUrl,
            status:
              "failed",
            previousPriceUsd,
            message:
              error.message,
          });

          continue;
        }

        results.push({
          productId,
          ...identity,
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

    /*
     * =====================================================
     * SUMMARY
     * =====================================================
     */

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
          ? "Toplu fiyat kontrolü tamamlandı. Bazı ürünlerde hata oluştu."
          : updatedCount > 0
            ? "Toplu fiyat kontrolü tamamlandı ve değişen fiyatlar güncellendi."
            : "Toplu fiyat kontrolü tamamlandı. Güncellenecek fiyat bulunamadı.",

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
