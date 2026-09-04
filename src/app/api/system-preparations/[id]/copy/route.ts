import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ObjectId,
} from "mongodb";

import {
  getSystemPreparationsCollection,
  serializeSystemPreparation,
  SystemPreparationDocument,
} from "@/lib/system-preparations-collection";

interface RouteContext {
  params:
    Promise<{
      id: string;
    }>;
}

function toObjectId(
  value: string
) {
  if (
    !ObjectId.isValid(
      value
    )
  ) {
    return null;
  }

  return new ObjectId(
    value
  );
}

/*
 * =========================================================
 * POST
 *
 * /api/system-preparations/[id]/copy
 *
 * Mevcut hazır sistemin birebir kopyasını oluşturur.
 *
 * Stok / inventory / stock movement tarafına dokunmaz.
 * =========================================================
 */
export async function POST(
  _request:
    NextRequest,
  context:
    RouteContext
) {
  try {
    const {
      id,
    } =
      await context.params;

    const objectId =
      toObjectId(
        id
      );

    if (!objectId) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            "Geçersiz sistem ID.",
        },
        {
          status:
            400,
        }
      );
    }

    const collection =
      await getSystemPreparationsCollection();

    const existing =
      await collection.findOne(
        {
          _id:
            objectId,
        }
      );

    if (!existing) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            "Kopyalanacak sistem bulunamadı.",
        },
        {
          status:
            404,
        }
      );
    }

    /*
     * Bu aksiyon Hazır Sistemler ekranından kullanıldığı için
     * yalnızca hazır sistemlerin kopyalanmasına izin veriyoruz.
     */
    if (
      existing.status !==
      "ready"
    ) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            "Yalnızca hazır sistemler kopyalanabilir.",
        },
        {
          status:
            400,
        }
      );
    }

    const now =
      new Date();

    /*
     * _id asla kopyalanmaz.
     *
     * Item snapshot&apos;ları:
     * - productId
     * - ürün fiyatı
     * - imageUrl
     * - isCommissionIncluded
     *
     * dahil olmak üzere korunur.
     *
     * Legacy bir sistemde isCommissionIncluded yoksa
     * yeni kopyada fiziksel olarak true yazılır.
     */
    const copiedDocument:
      SystemPreparationDocument = {
        name:
          `${existing.name}-KOPYA`,

        ...(existing.templateId
          ? {
              templateId:
                existing.templateId,
            }
          : {}),

        ...(existing.templateName
          ? {
              templateName:
                existing.templateName,
            }
          : {}),

        status:
          "ready",

        exchangeRate:
          existing.exchangeRate,

        ...(existing.exchangeRateDate
          ? {
              exchangeRateDate:
                existing.exchangeRateDate,
            }
          : {}),

        items:
          existing.items.map(
            (item) => ({
              ...item,

              /*
               * ObjectId korunur fakat yeni item object&apos;i oluşturulur.
               */
              ...(item.productId
                ? {
                    productId:
                      new ObjectId(
                        item.productId.toString()
                      ),
                  }
                : {}),

              isCommissionIncluded:
                typeof item.isCommissionIncluded ===
                "boolean"
                  ? item.isCommissionIncluded
                  : true,
            })
          ),

        productTotalUsd:
          existing.productTotalUsd,

        productTotalTry:
          existing.productTotalTry,

        commissionRate:
          existing.commissionRate,

        commissionAmountUsd:
          existing.commissionAmountUsd,

        commissionAmountTry:
          existing.commissionAmountTry,

        ...(Array.isArray(
          existing.laborItems
        )
          ? {
              laborItems:
                existing.laborItems.map(
                  (
                    item,
                    index
                  ) => ({
                    ...item,
                    sortOrder:
                      index,
                  })
                ),
            }
          : {}),

        laborCostTry:
          existing.laborCostTry,

        ...(typeof existing.laborCostUsd ===
          "number"
          ? {
              laborCostUsd:
                existing.laborCostUsd,
            }
          : {}),

        discountTry:
          existing.discountTry,

        profitTry:
          existing.profitTry,

        customerTotalTry:
          existing.customerTotalTry,

        createdAt:
          now,

        updatedAt:
          now,

        readyAt:
          now,
      };

    const insertResult =
      await collection.insertOne(
        copiedDocument
      );

    const copied =
      await collection.findOne(
        {
          _id:
            insertResult.insertedId,
        }
      );

    if (!copied) {
      throw new Error(
        "Kopyalanan sistem tekrar okunamadı."
      );
    }

    return NextResponse.json(
      {
        success:
          true,
        data:
          serializeSystemPreparation(
            copied
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
      "POST /api/system-preparations/[id]/copy error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,
        message:
          error instanceof Error
            ? error.message
            : "Hazır sistem kopyalanamadı.",
      },
      {
        status:
          500,
      }
    );
  }
}
