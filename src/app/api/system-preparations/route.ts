import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  SystemPreparationPayload,
  SystemPreparationStatus,
} from "@/types/system-preparation";

import {
  buildSystemPreparationData,
  SystemPreparationBuildError,
} from "@/lib/system-preparation-builder";

import {
  getSystemPreparationsCollection,
  serializeSystemPreparation,
} from "@/lib/system-preparations-collection";

import {
  getProductsByIdsWithFreshPrices,
} from "@/lib/products-service";

interface ExchangeRateApiResponse {
  success: boolean;
  message?: string;
  data?: {
    rate: number;
    date?: string;
  };
}

function cleanString(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function safeNumber(
  value: unknown,
  fallback = 0
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : fallback;
}

function getLaborTotal(
  preparation: {
    laborItems?: Array<{
      amountTry: number;
    }>;
    laborCostTry: number;
  }
) {
  if (
    Array.isArray(
      preparation.laborItems
    )
  ) {
    return preparation.laborItems.reduce(
      (
        total,
        item
      ) =>
        total +
        safeNumber(
          item.amountTry
        ),
      0
    );
  }

  return safeNumber(
    preparation.laborCostTry
  );
}

/*
 * =========================================================
 * REFRESH PAYLOAD PRODUCT PRICES
 *
 * Sistem kaydedilmeden önce payload içerisindeki tüm
 * seçili ürünleri merkezi fiyat servisine gönderir.
 *
 * Servis:
 *
 * - sourceUrl yoksa MongoDB fiyatını kullanır.
 * - sourceUrl varsa 5 dakikalık TTL kontrol eder.
 * - son kontrol 5 dakikadan eskiyse EGB fiyatını yeniler.
 * - EGB hata verirse eski MongoDB fiyatıyla devam eder.
 *
 * Builder bundan sonra MongoDB'den ürünü okuduğunda
 * mümkün olan en güncel priceUsd değerini görür.
 * =========================================================
 */
async function refreshPayloadProductPrices(
  body: SystemPreparationPayload
) {
  const productIds =
    new Set<string>();

  /*
   * Template üzerinden gelen seçimler.
   */
  for (
    const selection of
    body.selections ?? []
  ) {
    const productId =
      cleanString(
        selection.productId
      );

    if (productId) {
      productIds.add(
        productId
      );
    }
  }

  /*
   * Kullanıcının sonradan eklediği custom ürün alanları.
   */
  for (
    const customItem of
    body.customItems ?? []
  ) {
    const productId =
      cleanString(
        customItem.productId
      );

    if (productId) {
      productIds.add(
        productId
      );
    }
  }

  if (
    productIds.size ===
    0
  ) {
    return;
  }

  /*
   * Buradaki dönüş değerini kullanmamıza gerek yok.
   *
   * getProductsByIdsWithFreshPrices gerekli ürünlerin
   * fiyatlarını MongoDB üzerinde güncelliyor.
   *
   * Sonrasında buildSystemPreparationData()
   * kendi normal akışında MongoDB'den tekrar okuyacak.
   */
  await getProductsByIdsWithFreshPrices(
    Array.from(
      productIds
    )
  );
}

async function refreshReadySystemsWithCurrentRate(
  request:
    NextRequest
) {
  const exchangeRateUrl =
    new URL(
      "/api/exchange-rate",
      request.url
    );

  const exchangeRateResponse =
    await fetch(
      exchangeRateUrl,
      {
        cache:
          "no-store",
      }
    );

  const exchangeRateResult:
    ExchangeRateApiResponse =
      await exchangeRateResponse.json();

  if (
    !exchangeRateResponse.ok ||
    !exchangeRateResult.success ||
    !exchangeRateResult.data
  ) {
    throw new Error(
      exchangeRateResult.message ??
        "Güncel kur bilgisi alınamadı."
    );
  }

  const exchangeRate =
    safeNumber(
      exchangeRateResult.data.rate
    );

  if (
    exchangeRate <= 0
  ) {
    throw new Error(
      "Geçerli güncel dolar kuru alınamadı."
    );
  }

  const exchangeRateDate =
    cleanString(
      exchangeRateResult.data.date
    );

  const collection =
    await getSystemPreparationsCollection();

  const readyPreparations =
    await collection
      .find({
        status:
          "ready",
      })
      .toArray();

  if (
    readyPreparations.length ===
    0
  ) {
    return;
  }

  const now =
    new Date();

  const operations =
    readyPreparations.map(
      (preparation) => {
        const productTotalUsd =
          safeNumber(
            preparation.productTotalUsd
          );

        const commissionRate =
          safeNumber(
            preparation.commissionRate
          );

        const laborCostTry =
          getLaborTotal(
            preparation
          );

        const discountTry =
          safeNumber(
            preparation.discountTry
          );

        const productTotalTry =
          productTotalUsd *
          exchangeRate;

        /*
         * Hazır sistem güncel kurla refresh edilirken de
         * yalnızca komisyona dahil ürünler baz alınır.
         *
         * DİKKAT:
         * Burada ürün USD fiyatlarına dokunmuyoruz.
         *
         * Hazır sistem oluşturulurken alınan unitPriceUsd
         * snapshot olarak korunur.
         *
         * Sadece güncel USD/TRY kuru üzerinden TL karşılıkları
         * tekrar hesaplanır.
         */
        const commissionBaseUsd =
          preparation.items.reduce(
            (
              total,
              item
            ) => {
              const isCommissionIncluded =
                typeof item.isCommissionIncluded ===
                "boolean"
                  ? item.isCommissionIncluded
                  : true;

              if (
                !isCommissionIncluded
              ) {
                return total;
              }

              return (
                total +
                safeNumber(
                  item.totalPriceUsd
                )
              );
            },
            0
          );

        const commissionAmountUsd =
          commissionBaseUsd *
          (
            commissionRate /
            100
          );

        const commissionAmountTry =
          commissionAmountUsd *
          exchangeRate;

        const profitTry =
          commissionAmountTry +
          laborCostTry -
          discountTry;

        const customerTotalTry =
          productTotalTry +
          profitTry;

        return {
          updateOne: {
            filter: {
              _id:
                preparation._id,
            },

            update: {
              $set: {
                exchangeRate,

                ...(exchangeRateDate
                  ? {
                      exchangeRateDate,
                    }
                  : {}),

                productTotalTry,

                commissionAmountUsd,

                commissionAmountTry,

                laborCostTry,

                discountTry,

                profitTry,

                customerTotalTry,

                updatedAt:
                  now,
              },
            },
          },
        };
      }
    );

  await collection.bulkWrite(
    operations
  );
}

/*
 * =========================================================
 * GET
 *
 * /api/system-preparations
 *
 * /api/system-preparations?status=draft
 * /api/system-preparations?status=ready
 * =========================================================
 */
export async function GET(
  request:
    NextRequest
) {
  try {
    const statusParam =
      request.nextUrl.searchParams.get(
        "status"
      );

    let status:
      SystemPreparationStatus |
      undefined;

    if (statusParam) {
      if (
        statusParam !==
          "draft" &&
        statusParam !==
          "ready"
      ) {
        return NextResponse.json(
          {
            success:
              false,

            message:
              "Geçersiz sistem durumu.",
          },
          {
            status:
              400,
          }
        );
      }

      status =
        statusParam;
    }

    /*
     * Hazır sistem listesi okunurken
     * yalnızca güncel USD/TRY kuru hesaplanır.
     *
     * Ürün USD snapshot fiyatları kesinlikle
     * burada değiştirilmez.
     */
    if (
      status ===
      "ready"
    ) {
      await refreshReadySystemsWithCurrentRate(
        request
      );
    }

    const collection =
      await getSystemPreparationsCollection();

    const filter =
      status
        ? {
            status,
          }
        : {};

    const preparations =
      await collection
        .find(
          filter
        )
        .sort({
          createdAt:
            -1,
        })
        .toArray();

    return NextResponse.json({
      success:
        true,

      data:
        preparations.map(
          (
            preparation
          ) =>
            serializeSystemPreparation(
              preparation
            )
        ),
    });
  } catch (
    error
  ) {
    console.error(
      "GET /api/system-preparations error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        message:
          error instanceof Error
            ? error.message
            : "Sistemler getirilemedi.",
      },
      {
        status:
          500,
      }
    );
  }
}

/*
 * =========================================================
 * POST
 *
 * CREATE SYSTEM PREPARATION
 * =========================================================
 */
export async function POST(
  request:
    NextRequest
) {
  try {
    const body =
      (await request.json()) as
        SystemPreparationPayload;

    /*
     * =====================================================
     * PRODUCT PRICE REFRESH
     *
     * Builder çalışmadan ÖNCE ürün fiyatlarını
     * merkezi 5 dakikalık TTL mekanizmasından geçiriyoruz.
     *
     * Örnek:
     *
     * 10:00 → fiyat kontrol edildi
     * 10:02 → EGB'ye gidilmez
     * 10:04 → EGB'ye gidilmez
     * 10:05+ → EGB tekrar kontrol edilir
     *
     * sourceUrl olmayan ürünlerde hiçbir dış istek yapılmaz.
     * =====================================================
     */
    await refreshPayloadProductPrices(
      body
    );

    /*
     * Fiyat refresh tamamlandıktan sonra builder
     * ürünleri MongoDB'den okuyarak snapshot oluşturur.
     *
     * Böylece:
     *
     * product.priceUsd
     *          ↓
     * SystemPreparationItem.unitPriceUsd
     *
     * güncel fiyat üzerinden oluşur.
     */
    const preparationData =
      await buildSystemPreparationData(
        body
      );

    /*
     * Builder sonucunda her item mutlaka
     * gerçek boolean taşımalı.
     *
     * Böylece false değeri Mongo yazımından
     * önce kaybolamaz.
     */
    const invalidCommissionItem =
      preparationData.items.find(
        (item) =>
          typeof item.isCommissionIncluded !==
          "boolean"
      );

    if (
      invalidCommissionItem
    ) {
      throw new Error(
        `Komisyon seçimi oluşturulamadı: ${invalidCommissionItem.id}`
      );
    }

    const collection =
      await getSystemPreparationsCollection();

    const now =
      new Date();

    const insertResult =
      await collection.insertOne(
        {
          ...preparationData,

          status:
            "draft",

          createdAt:
            now,

          updatedAt:
            now,
        }
      );

    const createdPreparation =
      await collection.findOne(
        {
          _id:
            insertResult.insertedId,
        }
      );

    if (
      !createdPreparation
    ) {
      throw new Error(
        "Oluşturulan sistem tekrar okunamadı."
      );
    }

    /*
     * MongoDB'ye yazıldıktan sonra da
     * komisyon flag değerlerini doğruluyoruz.
     */
    const missingStoredCommissionFlag =
      createdPreparation.items.find(
        (item) =>
          typeof item.isCommissionIncluded !==
          "boolean"
      );

    if (
      missingStoredCommissionFlag
    ) {
      throw new Error(
        `MongoDB komisyon seçimini kaydetmedi: ${missingStoredCommissionFlag.id}`
      );
    }

    return NextResponse.json(
      {
        success:
          true,

        data:
          serializeSystemPreparation(
            createdPreparation
          ),
      },
      {
        status:
          201,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "POST /api/system-preparations error:",
      error
    );

    const status =
      error instanceof
      SystemPreparationBuildError
        ? error.status
        : 500;

    return NextResponse.json(
      {
        success:
          false,

        message:
          error instanceof Error
            ? error.message
            : "Sistem kaydedilemedi.",
      },
      {
        status,
      }
    );
  }
}