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

async function refreshReadySystemsWithCurrentRate(
  request:
    NextRequest
) {
  const exchangeRateUrl =
    new URL(
      "/api/exchange-rate",
      request.url
    );

  /*
   * Bu route /api/exchange-rate endpoint'ine server-side
   * istek atiyor. Browser'dan gelen HttpOnly session cookie
   * server-side fetch'e otomatik tasinmaz.
   *
   * Proxy /api/exchange-rate'i de korudugu icin cookie
   * forward edilmezse nested istek 401 doner.
   */
  const cookieHeader =
    request.headers.get(
      "cookie"
    );

  const exchangeRateResponse =
    await fetch(
      exchangeRateUrl,
      {
        cache:
          "no-store",
        ...(cookieHeader
          ? {
              headers: {
                cookie:
                  cookieHeader,
              },
            }
          : {}),
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

export async function POST(
  request:
    NextRequest
) {
  try {
    const body =
      (await request.json()) as
        SystemPreparationPayload;

    const preparationData =
      await buildSystemPreparationData(
        body
      );

    /*
     * Builder sonucunda her item mutlaka gerçek boolean taşımalı.
     * Böylece false değeri Mongo yazımından önce kaybolamaz.
     */
    const invalidCommissionItem =
      preparationData.items.find(
        (item) =>
          typeof item.isCommissionIncluded !==
          "boolean"
      );

    if (invalidCommissionItem) {
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

    if (!createdPreparation) {
      throw new Error(
        "Oluşturulan sistem tekrar okunamadı."
      );
    }

    const missingStoredCommissionFlag =
      createdPreparation.items.find(
        (item) =>
          typeof item.isCommissionIncluded !==
          "boolean"
      );

    if (missingStoredCommissionFlag) {
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
