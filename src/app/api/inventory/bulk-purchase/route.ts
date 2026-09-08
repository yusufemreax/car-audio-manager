import {
  randomUUID,
} from "node:crypto";

import {
  ObjectId,
} from "mongodb";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  z,
} from "zod";

import {
  getDatabase,
} from "@/lib/mongodb";

import {
  getInventoryCollection,
} from "@/lib/inventory-collection";

import {
  addCustomerCardSurplus,
  createSupplierOrder,
  deleteSupplierOrder,
  getSupplierBalance,
  rollbackSupplierBalanceMutation,
  useSupplierBalanceForStock,
  type SupplierBalanceMutation,
} from "@/lib/supplier-store";

import {
  isProductSupplier,
  normalizeProductSuppliers,
  type ProductSupplier,
  type SupplierPurchasePaymentMethod,
} from "@/types/supplier";

const bulkPurchaseSchema =
  z.object({
    supplier:
      z.string(),

    paymentMethod:
      z.enum([
        "card",
        "customer_card",
        "balance",
      ]),

    items:
      z.array(
        z.object({
          productId:
            z.string().min(
              1
            ),
          quantity:
            z.number()
              .int()
              .positive(),
        })
      )
        .min(
          1,
          "En az bir ürün seçiniz."
        )
        .max(
          100,
          "Tek seferde en fazla 100 ürün satırı eklenebilir."
        ),

    balanceUsedUsd:
      z.number()
        .min(0)
        .optional(),

    customerCardAmountTry:
      z.number()
        .min(0)
        .optional(),

    exchangeRate:
      z.number()
        .positive()
        .optional(),

    exchangeRateDate:
      z.string()
        .trim()
        .optional(),

    note:
      z.string()
        .trim()
        .max(500)
        .optional(),
  });

interface ResolvedItem {
  productId: string;
  productObjectId: ObjectId;
  productCode?: string;
  brand?: string;
  model?: string;
  quantity: number;
  unitPriceUsd: number;
  totalUsd: number;
}

function roundMoney(
  value: number
) {
  return Math.round(
    (value + Number.EPSILON) *
      100
  ) / 100;
}

function cleanString(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

export async function POST(
  request:
    NextRequest
) {
  const createdOrderIds:
    ObjectId[] = [];

  const createdMovementIds:
    ObjectId[] = [];

  const inventoryRollbacks:
    Array<{
      inventoryId: ObjectId;
      quantity: number;
    }> = [];

  let balanceMutation:
    SupplierBalanceMutation |
    null = null;

  try {
    const body =
      await request
        .json()
        .catch(
          () => null
        );

    const validation =
      bulkPurchaseSchema.safeParse(
        body
      );

    if (
      !validation.success
    ) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            validation.error
              .issues[0]
              ?.message ??
            "Toplu sipariş bilgisi geçersiz.",
        },
        {
          status:
            400,
        }
      );
    }

    const data =
      validation.data;

    if (
      !isProductSupplier(
        data.supplier
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            "Geçerli bir tedarikçi seçiniz.",
        },
        {
          status:
            400,
        }
      );
    }

    const supplier:
      ProductSupplier =
        data.supplier;

    const paymentMethod:
      SupplierPurchasePaymentMethod =
        data.paymentMethod;

    /*
     * Aynı ürün iki kez geldiyse tek satırda birleştir.
     */
    const quantityByProductId =
      new Map<
        string,
        number
      >();

    for (
      const item of
        data.items
    ) {
      if (
        !ObjectId.isValid(
          item.productId
        )
      ) {
        return NextResponse.json(
          {
            success:
              false,
            message:
              "Siparişte geçersiz ürün ID bulundu.",
          },
          {
            status:
              400,
          }
        );
      }

      quantityByProductId.set(
        item.productId,
        (
          quantityByProductId.get(
            item.productId
          ) ??
          0
        ) +
          item.quantity
      );
    }

    const productIds =
      Array.from(
        quantityByProductId.keys()
      );

    const database =
      await getDatabase();

    const products =
      await database
        .collection(
          "products"
        )
        .find({
          _id: {
            $in:
              productIds.map(
                (
                  id
                ) =>
                  new ObjectId(
                    id
                  )
              ),
          },
        })
        .toArray();

    if (
      products.length !==
      productIds.length
    ) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            "Siparişteki ürünlerden biri bulunamadı.",
        },
        {
          status:
            404,
        }
      );
    }

    const resolvedItems:
      ResolvedItem[] = [];

    for (
      const product of
        products
    ) {
      const productId =
        product._id.toString();

      const quantity =
        quantityByProductId.get(
          productId
        ) ??
        0;

      const allowedSuppliers =
        normalizeProductSuppliers(
          product.suppliers
        );

      if (
        !allowedSuppliers.includes(
          supplier
        )
      ) {
        return NextResponse.json(
          {
            success:
              false,
            message:
              `${product.brand ?? ""} ${product.model ?? ""} ürünü ${supplier} tedarikçisinden alınamaz.`.trim(),
          },
          {
            status:
              400,
          }
        );
      }

      const unitPriceUsd =
        roundMoney(
          Number(
            product.priceUsd
          ) ||
          0
        );

      resolvedItems.push({
        productId,
        productObjectId:
          product._id,
        productCode:
          cleanString(
            product.productCode
          ) ||
          undefined,
        brand:
          cleanString(
            product.brand
          ) ||
          undefined,
        model:
          cleanString(
            product.model
          ) ||
          undefined,
        quantity,
        unitPriceUsd,
        totalUsd:
          roundMoney(
            unitPriceUsd *
              quantity
          ),
      });
    }

    /*
     * İstemciden gelen sıra korunabilsin diye tekrar sırala.
     */
    resolvedItems.sort(
      (
        a,
        b
      ) =>
        productIds.indexOf(
          a.productId
        ) -
        productIds.indexOf(
          b.productId
        )
    );

    const purchaseTotalUsd =
      roundMoney(
        resolvedItems.reduce(
          (
            total,
            item
          ) =>
            total +
            item.totalUsd,
          0
        )
      );

    const totalQuantity =
      resolvedItems.reduce(
        (
          total,
          item
        ) =>
          total +
          item.quantity,
        0
      );

    const exchangeRate =
      roundMoney(
        Number(
          data.exchangeRate ??
            0
        ) ||
        0
      );

    const exchangeRateDate =
      cleanString(
        data.exchangeRateDate
      );

    const purchaseTotalTry =
      exchangeRate >
      0
        ? roundMoney(
            purchaseTotalUsd *
              exchangeRate
          )
        : 0;

    let balanceUsedUsd =
      0;

    let cardAmountUsd =
      0;

    let customerCardAmountTry =
      0;

    let customerCardChargedUsd =
      0;

    let customerCardSurplusUsd =
      0;

    let customerCardSurplusTry =
      0;

    if (
      paymentMethod ===
      "balance"
    ) {
      balanceUsedUsd =
        roundMoney(
          Number(
            data.balanceUsedUsd ??
              0
          ) ||
          0
        );

      if (
        balanceUsedUsd <=
        0
      ) {
        return NextResponse.json(
          {
            success:
              false,
            message:
              "Bakiyeden kullanılacak USD tutarını giriniz.",
          },
          {
            status:
              400,
          }
        );
      }

      if (
        balanceUsedUsd >
        purchaseTotalUsd
      ) {
        return NextResponse.json(
          {
            success:
              false,
            message:
              "Bakiyeden kullanılacak tutar toplu sipariş toplamından büyük olamaz.",
          },
          {
            status:
              400,
          }
        );
      }

      const currentBalance =
        await getSupplierBalance(
          supplier
        );

      if (
        balanceUsedUsd >
        currentBalance
      ) {
        return NextResponse.json(
          {
            success:
              false,
            message:
              `${supplier} bakiyesi yetersiz. Mevcut bakiye: $${currentBalance.toFixed(
                2
              )}`,
          },
          {
            status:
              400,
          }
        );
      }

      balanceMutation =
        await useSupplierBalanceForStock(
          supplier,
          balanceUsedUsd,
          {
            note:
              data.note ||
              "Toplu stok siparişi bakiye kullanımı",
          }
        );

      cardAmountUsd =
        roundMoney(
          purchaseTotalUsd -
            balanceUsedUsd
        );
    } else if (
      paymentMethod ===
      "customer_card"
    ) {
      customerCardAmountTry =
        roundMoney(
          Number(
            data.customerCardAmountTry ??
              0
          ) ||
          0
        );

      if (
        exchangeRate <=
          0 ||
        customerCardAmountTry <=
          0
      ) {
        return NextResponse.json(
          {
            success:
              false,
            message:
              "Müşteri kartı için çekilen TL tutarı ve geçerli kur zorunludur.",
          },
          {
            status:
              400,
          }
        );
      }

      customerCardChargedUsd =
        roundMoney(
          customerCardAmountTry /
            exchangeRate
        );

      if (
        customerCardChargedUsd <
        purchaseTotalUsd
      ) {
        return NextResponse.json(
          {
            success:
              false,
            message:
              `Müşteri kartından çekilen tutar siparişi karşılamıyor. En az ${purchaseTotalTry.toFixed(
                2
              )} TL çekilmelidir.`,
          },
          {
            status:
              400,
          }
        );
      }

      customerCardSurplusUsd =
        roundMoney(
          customerCardChargedUsd -
            purchaseTotalUsd
        );

      customerCardSurplusTry =
        roundMoney(
          customerCardSurplusUsd *
            exchangeRate
        );

      cardAmountUsd =
        0;
    } else {
      cardAmountUsd =
        purchaseTotalUsd;
    }

    const inventoryCollection =
      await getInventoryCollection();

    const stockMovements =
      database.collection(
        "stockMovements"
      );

    const now =
      new Date();

    const batchOrderId =
      randomUUID();

    let remainingBalance =
      balanceUsedUsd;

    for (
      let index = 0;
      index <
      resolvedItems.length;
      index +=
        1
    ) {
      const item =
        resolvedItems[
          index
        ];

      await inventoryCollection.updateOne(
        {
          productId:
            item.productObjectId,
        },
        {
          $setOnInsert: {
            productId:
              item.productObjectId,
            quantity:
              0,
            createdAt:
              now,
            updatedAt:
              now,
          },
        },
        {
          upsert:
            true,
        }
      );

      const before =
        await inventoryCollection.findOneAndUpdate(
          {
            productId:
              item.productObjectId,
          },
          {
            $inc: {
              quantity:
                item.quantity,
            },
            $set: {
              updatedAt:
                now,
            },
          },
          {
            returnDocument:
              "before",
          }
        );

      if (!before) {
        throw new Error(
          "Stok kaydı güncellenemedi."
        );
      }

      inventoryRollbacks.push({
        inventoryId:
          before._id,
        quantity:
          item.quantity,
      });

      const previousQuantity =
        Number(
          before.quantity
        ) ||
        0;

      const newQuantity =
        previousQuantity +
        item.quantity;

      const isLast =
        index ===
        resolvedItems.length -
          1;

      const allocatedBalance =
        paymentMethod ===
        "balance"
          ? isLast
            ? Math.min(
                remainingBalance,
                item.totalUsd
              )
            : purchaseTotalUsd >
                0
              ? Math.min(
                  roundMoney(
                    balanceUsedUsd *
                      (
                        item.totalUsd /
                        purchaseTotalUsd
                      )
                  ),
                  remainingBalance,
                  item.totalUsd
                )
              : 0
          : 0;

      remainingBalance =
        roundMoney(
          remainingBalance -
            allocatedBalance
        );

      const allocatedOwnCard =
        paymentMethod ===
        "customer_card"
          ? 0
          : roundMoney(
              item.totalUsd -
                allocatedBalance
            );

      const appliedCustomerCardTry =
        paymentMethod ===
        "customer_card"
          ? roundMoney(
              item.totalUsd *
                exchangeRate
            )
          : 0;

      const movementResult =
        await stockMovements.insertOne({
          productId:
            item.productObjectId,
          type:
            "in",
          quantity:
            item.quantity,
          previousQuantity,
          newQuantity,
          supplier,
          paymentMethod,
          purchaseTotalUsd:
            item.totalUsd,
          balanceUsedUsd:
            allocatedBalance,
          cardAmountUsd:
            allocatedOwnCard,
          ...(paymentMethod ===
          "customer_card"
            ? {
                customerCardAmountTry:
                  appliedCustomerCardTry,
                customerCardChargedUsd:
                  item.totalUsd,
                customerCardAppliedUsd:
                  item.totalUsd,
                customerCardSurplusUsd:
                  0,
              }
            : {}),
          ...(exchangeRate >
          0
            ? {
                exchangeRate,
              }
            : {}),
          ...(exchangeRateDate
            ? {
                exchangeRateDate,
              }
            : {}),
          batchOrderId,
          ...(data.note
            ? {
                note:
                  data.note,
              }
            : {
                note:
                  `Toplu stok siparişi: ${batchOrderId}`,
              }),
          createdAt:
            now,
        });

      createdMovementIds.push(
        movementResult.insertedId
      );

      const orderId =
        await createSupplierOrder({
          supplier,
          source:
            "manual_stock",
          productId:
            item.productId,
          productCode:
            item.productCode,
          brand:
            item.brand,
          model:
            item.model,
          quantity:
            item.quantity,
          unitPriceUsd:
            item.unitPriceUsd,
          paymentMethod,
          balanceUsedUsd:
            allocatedBalance,
          cardAmountUsd:
            allocatedOwnCard,
          ...(paymentMethod ===
          "customer_card"
            ? {
                customerCardAmountTry:
                  appliedCustomerCardTry,
                customerCardChargedUsd:
                  item.totalUsd,
                customerCardAppliedUsd:
                  item.totalUsd,
                customerCardSurplusUsd:
                  0,
              }
            : {}),
          ...(exchangeRate >
          0
            ? {
                exchangeRate,
              }
            : {}),
          ...(exchangeRateDate
            ? {
                exchangeRateDate,
              }
            : {}),
          stockMovementId:
            movementResult.insertedId.toString(),
          batchOrderId,
          note:
            data.note ||
            `Toplu stok siparişi: ${batchOrderId}`,
          createdAt:
            now,
        });

      createdOrderIds.push(
        orderId
      );
    }

    if (
      paymentMethod ===
        "customer_card" &&
      customerCardSurplusUsd >
        0
    ) {
      balanceMutation =
        await addCustomerCardSurplus(
          supplier,
          customerCardSurplusUsd,
          {
            amountTry:
              customerCardSurplusTry,
            exchangeRate,
            exchangeRateDate:
              exchangeRateDate ||
              undefined,
            note:
              data.note ||
              `Toplu sipariş müşteri kartından kalan site bakiyesi: ${batchOrderId}`,
          }
        );
    }

    return NextResponse.json({
      success:
        true,
      message:
        "Toplu sipariş başarıyla stoklara eklendi.",
      data: {
        batchOrderId,
        supplier,
        paymentMethod,
        itemCount:
          resolvedItems.length,
        totalQuantity,
        purchaseTotalUsd,
        purchaseTotalTry,
        balanceUsedUsd,
        cardAmountUsd,
        customerCardAmountTry,
        customerCardSurplusUsd,
        customerCardSurplusTry,
      },
    });
  } catch (error) {
    try {
      const database =
        await getDatabase();

      if (
        createdOrderIds.length >
        0
      ) {
        for (
          const orderId of
            createdOrderIds.reverse()
        ) {
          await deleteSupplierOrder(
            orderId
          );
        }
      }

      if (
        createdMovementIds.length >
        0
      ) {
        await database
          .collection(
            "stockMovements"
          )
          .deleteMany({
            _id: {
              $in:
                createdMovementIds,
            },
          });
      }

      if (
        inventoryRollbacks.length >
        0
      ) {
        for (
          const rollback of
            inventoryRollbacks.reverse()
        ) {
          await database
            .collection(
              "inventory"
            )
            .updateOne(
              {
                _id:
                  rollback.inventoryId,
              },
              {
                $inc: {
                  quantity:
                    -rollback.quantity,
                },
                $set: {
                  updatedAt:
                    new Date(),
                },
              }
            );
        }
      }

      if (
        balanceMutation
      ) {
        await rollbackSupplierBalanceMutation(
          balanceMutation
        );
      }
    } catch (
      rollbackError
    ) {
      console.error(
        "Bulk purchase rollback error:",
        rollbackError
      );
    }

    console.error(
      "POST /api/inventory/bulk-purchase error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,
        message:
          error instanceof Error
            ? error.message
            : "Toplu sipariş kaydedilirken hata oluştu.",
      },
      {
        status:
          500,
      }
    );
  }
}
