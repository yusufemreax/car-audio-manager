import {
  ObjectId,
} from "mongodb";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { z } from "zod";

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

const stockMovementSchema =
  z.object({
    type: z.enum([
      "in",
      "out",
    ]),

    quantity: z
      .number()
      .int()
      .positive(
        "Miktar sıfırdan büyük olmalıdır."
      ),

    note: z
      .string()
      .trim()
      .max(500)
      .optional(),

    /*
     * Stok girişinde zorunlu.
     * Stok çıkışında gönderilmez.
     */
    supplier: z
      .string()
      .optional(),

    paymentMethod: z
      .enum([
        "card",
        "customer_card",
        "balance",
      ])
      .optional(),

    balanceUsedUsd: z
      .number()
      .min(0)
      .optional(),

    customerCardAmountTry: z
      .number()
      .min(0)
      .optional(),

    exchangeRate: z
      .number()
      .positive()
      .optional(),

    exchangeRateDate: z
      .string()
      .trim()
      .optional(),
  });

interface RouteContext {
  params: Promise<{
    productId: string;
  }>;
}

function roundMoney(
  value: number
) {
  return Math.round(
    (value + Number.EPSILON) *
      100
  ) / 100;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  let balanceMutation:
    SupplierBalanceMutation |
    null = null;

  let supplierOrderId:
    ObjectId |
    null = null;

  let stockMovementId:
    ObjectId |
    null = null;

  let inventoryAdjusted =
    false;

  let inventoryObjectId:
    ObjectId |
    null = null;

  let inventoryRollbackDelta =
    0;

  try {
    const { productId } =
      await context.params;

    if (
      !ObjectId.isValid(
        productId
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Geçersiz ürün ID.",
        },
        {
          status: 400,
        }
      );
    }

    const body =
      await request
        .json()
        .catch(() => null);

    const validation =
      stockMovementSchema.safeParse(
        body
      );

    if (
      !validation.success
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            validation.error
              .issues[0]
              ?.message ??
            "Stok bilgisi geçersiz.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      type,
      quantity,
      note,
    } = validation.data;

    const objectId =
      new ObjectId(
        productId
      );

    const database =
      await getDatabase();

    const product =
      await database
        .collection(
          "products"
        )
        .findOne({
          _id: objectId,
        });

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Ürün bulunamadı.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * =====================================================
     * TEDARİKÇİ / ALIŞ ÖDEMESİ
     * Sadece stok girişinde çalışır.
     * =====================================================
     */
    let supplier:
      ProductSupplier |
      undefined;

    let paymentMethod:
      SupplierPurchasePaymentMethod |
      undefined;

    let purchaseTotalUsd =
      0;

    let balanceUsedUsd =
      0;

    let cardAmountUsd =
      0;

    let customerCardAmountTry =
      0;
    let customerCardChargedUsd =
      0;
    let customerCardAppliedUsd =
      0;
    let customerCardSurplusUsd =
      0;
    let exchangeRate =
      0;
    let exchangeRateDate =
      "";

    if (type === "in") {
      const requestedSupplier =
        validation.data.supplier;

      if (
        !isProductSupplier(
          requestedSupplier
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Geçerli bir tedarikçi seçiniz.",
          },
          {
            status: 400,
          }
        );
      }

      supplier =
        requestedSupplier;

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
            success: false,
            message:
              `${supplier}, bu ürün için tanımlı tedarikçiler arasında değil.`,
          },
          {
            status: 400,
          }
        );
      }

      paymentMethod =
        validation.data.paymentMethod;
      exchangeRate = Number(validation.data.exchangeRate ?? 0) || 0;
      exchangeRateDate = String(validation.data.exchangeRateDate ?? "").trim();

      if (
        paymentMethod !==
          "card" &&
        paymentMethod !==
          "customer_card" &&
        paymentMethod !==
          "balance"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Geçerli bir ödeme yöntemi seçiniz.",
          },
          {
            status: 400,
          }
        );
      }

      const unitPriceUsd =
        roundMoney(
          Number(
            product.priceUsd
          ) || 0
        );

      purchaseTotalUsd =
        roundMoney(
          unitPriceUsd *
            quantity
        );

      balanceUsedUsd =
        paymentMethod ===
          "balance"
          ? roundMoney(
              Number(
                validation.data
                  .balanceUsedUsd ??
                  0
              ) || 0
            )
          : 0;

      if (
        paymentMethod ===
          "balance" &&
        balanceUsedUsd <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Bakiyeden kullanılacak USD tutarını giriniz.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        balanceUsedUsd >
        purchaseTotalUsd
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Bakiyeden kullanılacak tutar alış toplamından büyük olamaz.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        paymentMethod ===
        "balance"
      ) {
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
              success: false,
              message:
                `${supplier} bakiyesi yetersiz. Mevcut bakiye: $${currentBalance.toFixed(2)}`,
            },
            {
              status: 400,
            }
          );
        }

        balanceMutation =
          await useSupplierBalanceForStock(
            supplier,
            balanceUsedUsd,
            {
              note:
                note ||
                `${product.productCode ?? ""} ${product.brand ?? ""} ${product.model ?? ""} stok alımı`.trim(),
            }
          );
      }

      if (paymentMethod === "customer_card") {
        customerCardAmountTry = roundMoney(
          Number(validation.data.customerCardAmountTry ?? 0) || 0
        );
        if (customerCardAmountTry <= 0 || exchangeRate <= 0) {
          return NextResponse.json(
            {
              success: false,
              message: "Müşteri kartı tutarı ve geçerli kur bilgisi zorunludur.",
            },
            { status: 400 }
          );
        }

        customerCardChargedUsd = roundMoney(
          customerCardAmountTry / exchangeRate
        );

        if (customerCardChargedUsd < purchaseTotalUsd) {
          return NextResponse.json(
            {
              success: false,
              message: `Müşteri kartından çekilen tutar alış toplamını karşılamıyor. En az ${roundMoney(purchaseTotalUsd * exchangeRate).toFixed(2)} TL çekilmelidir.`,
            },
            { status: 400 }
          );
        }

        customerCardAppliedUsd = purchaseTotalUsd;
        customerCardSurplusUsd = roundMoney(
          customerCardChargedUsd - purchaseTotalUsd
        );
        cardAmountUsd = 0;

        if (customerCardSurplusUsd > 0) {
          balanceMutation = await addCustomerCardSurplus(
            supplier,
            customerCardSurplusUsd,
            {
              amountTry: roundMoney(customerCardSurplusUsd * exchangeRate),
              exchangeRate,
              exchangeRateDate: exchangeRateDate || undefined,
              note:
                note ||
                `${product.productCode ?? ""} ${product.brand ?? ""} ${product.model ?? ""} müşteri kartından kalan site bakiyesi`.trim(),
            }
          );
        }
      } else {
        cardAmountUsd = roundMoney(
          purchaseTotalUsd - balanceUsedUsd
        );
      }
    }

    const inventoryCollection =
      await getInventoryCollection();

    const now =
      new Date();

    /*
     * Eski ürünse inventory kaydı olmayabilir.
     * Yoksa 0 stok ile oluştur.
     */
    await inventoryCollection.updateOne(
      {
        productId:
          objectId,
      },
      {
        $setOnInsert: {
          productId:
            objectId,
          quantity: 0,
          createdAt:
            now,
          updatedAt:
            now,
        },
      },
      {
        upsert: true,
      }
    );

    let previousInventory;

    if (type === "in") {
      previousInventory =
        await inventoryCollection.findOneAndUpdate(
          {
            productId:
              objectId,
          },
          {
            $inc: {
              quantity,
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

      inventoryRollbackDelta =
        -quantity;
    } else {
      previousInventory =
        await inventoryCollection.findOneAndUpdate(
          {
            productId:
              objectId,
            quantity: {
              $gte:
                quantity,
            },
          },
          {
            $inc: {
              quantity:
                -quantity,
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

      if (
        !previousInventory
      ) {
        if (
          balanceMutation
        ) {
          await rollbackSupplierBalanceMutation(
            balanceMutation
          );
          balanceMutation =
            null;
        }

        const current =
          await inventoryCollection.findOne(
            {
              productId:
                objectId,
            }
          );

        return NextResponse.json(
          {
            success: false,
            message:
              `Yetersiz stok. Mevcut stok: ${current?.quantity ?? 0}`,
          },
          {
            status: 400,
          }
        );
      }

      inventoryRollbackDelta =
        quantity;
    }

    if (
      !previousInventory
    ) {
      throw new Error(
        "Stok kaydı güncellenemedi."
      );
    }

    inventoryAdjusted =
      true;

    inventoryObjectId =
      previousInventory._id;

    const previousQuantity =
      previousInventory.quantity;

    const newQuantity =
      type === "in"
        ? previousQuantity +
          quantity
        : previousQuantity -
          quantity;

    /*
     * HAREKET GEÇMİŞİ
     * Raw collection kullanıyoruz; tedarikçi alanları da fiziksel
     * olarak stockMovements dokümanında saklanır.
     */
    const movements =
      database.collection(
        "stockMovements"
      );

    const movementResult =
      await movements.insertOne({
        productId:
          objectId,
        type,
        quantity,
        previousQuantity,
        newQuantity,
        ...(note
          ? {
              note,
            }
          : {}),
        ...(type === "in" &&
        supplier &&
        paymentMethod
          ? {
              supplier,
              paymentMethod,
              purchaseTotalUsd,
              balanceUsedUsd,
              cardAmountUsd,
              ...(paymentMethod === "customer_card"
                ? {
                    customerCardAmountTry,
                    customerCardChargedUsd,
                    customerCardAppliedUsd,
                    customerCardSurplusUsd,
                  }
                : {}),
              ...(exchangeRate > 0 ? { exchangeRate } : {}),
              ...(exchangeRateDate ? { exchangeRateDate } : {}),
            }
          : {}),
        createdAt:
          now,
      });

    stockMovementId =
      movementResult.insertedId;

    /*
     * Her manuel stok girişi ilgili tedarikçinin sipariş/alım
     * geçmişine de yazılır.
     */
    if (
      type === "in" &&
      supplier &&
      paymentMethod
    ) {
      supplierOrderId =
        await createSupplierOrder({
          supplier,
          source:
            "manual_stock",
          productId,
          productCode:
            String(
              product.productCode ??
                ""
            ) || undefined,
          brand:
            String(
              product.brand ??
                ""
            ) || undefined,
          model:
            String(
              product.model ??
                ""
            ) || undefined,
          quantity,
          unitPriceUsd:
            roundMoney(
              Number(
                product.priceUsd
              ) || 0
            ),
          paymentMethod,
          balanceUsedUsd,
          cardAmountUsd,
          ...(paymentMethod === "customer_card"
            ? {
                customerCardAmountTry,
                customerCardChargedUsd,
                customerCardAppliedUsd,
                customerCardSurplusUsd,
              }
            : {}),
          ...(exchangeRate > 0 ? { exchangeRate } : {}),
          ...(exchangeRateDate ? { exchangeRateDate } : {}),
          stockMovementId:
            stockMovementId.toString(),
          note:
            note || undefined,
          createdAt:
            now,
        });
    }

    return NextResponse.json({
      success: true,
      message:
        type === "in"
          ? "Stok başarıyla eklendi."
          : "Stok başarıyla çıkarıldı.",
      data: {
        quantity:
          newQuantity,
        ...(type === "in" &&
        supplier &&
        paymentMethod
          ? {
              supplier,
              paymentMethod,
              purchaseTotalUsd,
              balanceUsedUsd,
              cardAmountUsd,
              ...(paymentMethod === "customer_card"
                ? {
                    customerCardAmountTry,
                    customerCardChargedUsd,
                    customerCardAppliedUsd,
                    customerCardSurplusUsd,
                  }
                : {}),
              ...(exchangeRate > 0 ? { exchangeRate } : {}),
              ...(exchangeRateDate ? { exchangeRateDate } : {}),
              supplierBalanceUsd:
                balanceMutation
                  ?.balanceAfterUsd,
            }
          : {}),
      },
    });
  } catch (error) {
    /*
     * =====================================================
     * ROLLBACK
     * Stok, hareket, tedarikçi siparişi ve bakiye tek akışta
     * tutarlı kalmaya çalışır.
     * =====================================================
     */
    try {
      if (
        supplierOrderId
      ) {
        await deleteSupplierOrder(
          supplierOrderId
        );
      }

      const database =
        await getDatabase();

      if (
        stockMovementId
      ) {
        await database
          .collection(
            "stockMovements"
          )
          .deleteOne({
            _id:
              stockMovementId,
          });
      }

      if (
        inventoryAdjusted &&
        inventoryObjectId &&
        inventoryRollbackDelta !==
          0
      ) {
        await database
          .collection(
            "inventory"
          )
          .updateOne(
            {
              _id:
                inventoryObjectId,
            },
            {
              $inc: {
                quantity:
                  inventoryRollbackDelta,
              },
              $set: {
                updatedAt:
                  new Date(),
              },
            }
          );
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
        "Stock movement rollback error:",
        rollbackError
      );
    }

    console.error(
      "POST stock movement error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Stok işlemi sırasında bir hata oluştu.",
      },
      {
        status: 500,
      }
    );
  }
}
