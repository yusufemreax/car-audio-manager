import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ObjectId,
} from "mongodb";

import {
  getDatabase,
} from "@/lib/mongodb";

import {
  getProductByIdWithFreshPrice,
} from "@/lib/products-service";

import {
  createSupplierOrder,
  deleteSupplierOrder,
  rollbackSupplierBalanceMutation,
  useSupplierBalanceForStock,
  type SupplierBalanceMutation,
} from "@/lib/supplier-store";

import {
  isProductSupplier,
  normalizeProductSuppliers,
  type SupplierPurchasePaymentMethod,
} from "@/types/supplier";

interface InventoryDocument {
  productId:
    string |
    ObjectId;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

interface StockMovementDocument {
  productId: string;
  type: "in";
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  note?: string;
  supplier?: string;
  paymentMethod?: SupplierPurchasePaymentMethod;
  purchaseTotalUsd?: number;
  balanceUsedUsd?: number;
  cardAmountUsd?: number;
  createdAt: Date;
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

function productIdCandidates(
  productId: string
): Array<string | ObjectId> {
  const values:
    Array<string | ObjectId> = [
      productId,
    ];

  if (
    ObjectId.isValid(
      productId
    )
  ) {
    values.push(
      new ObjectId(
        productId
      )
    );
  }

  return values;
}

export async function POST(
  request: NextRequest
) {
  let balanceMutation:
    SupplierBalanceMutation |
    null = null;

  let inventoryId:
    ObjectId |
    null = null;

  let inventoryAdded =
    false;

  let stockMovementId:
    ObjectId |
    null = null;

  let supplierOrderId:
    ObjectId |
    null = null;

  let rollbackQuantity = 0;

  try {
    const body =
      await request.json();

    const productId =
      cleanString(
        body?.productId
      );

    const quantity =
      Math.trunc(
        Number(
          body?.quantity
        )
      );

    const supplier =
      body?.supplier;

    const paymentMethod:
      SupplierPurchasePaymentMethod =
        body?.paymentMethod ===
          "balance"
          ? "balance"
          : "card";

    const requestedBalanceUsedUsd =
      roundMoney(
        Number(
          body?.balanceUsedUsd ??
            0
        ) || 0
      );

    const note =
      cleanString(
        body?.note
      );

    if (
      !productId ||
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

    rollbackQuantity =
      quantity;

    if (
      !Number.isInteger(
        quantity
      ) ||
      quantity <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stok adedi 0'dan büyük bir tam sayı olmalıdır.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !isProductSupplier(
        supplier
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

    const product =
      await getProductByIdWithFreshPrice(
        new ObjectId(
          productId
        )
      );

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

    const unitPriceUsd =
      roundMoney(
        Number(
          product.priceUsd
        ) || 0
      );

    const purchaseTotalUsd =
      roundMoney(
        unitPriceUsd *
          quantity
      );

    let balanceUsedUsd =
      0;

    if (
      paymentMethod ===
      "balance"
    ) {
      balanceUsedUsd =
        requestedBalanceUsedUsd;

      if (
        balanceUsedUsd <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Bakiye ile ödemede kullanılacak USD tutarını giriniz.",
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
              "Kullanılacak bakiye ürün toplamından büyük olamaz.",
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
              `${product.productCode} ${product.brand} ${product.model} stok alımı`,
          }
        );
    }

    const cardAmountUsd =
      roundMoney(
        purchaseTotalUsd -
          balanceUsedUsd
      );

    const db =
      await getDatabase();

    const inventoryCollection =
      db.collection<InventoryDocument>(
        "inventory"
      );

    const stockMovementsCollection =
      db.collection<StockMovementDocument>(
        "stockMovements"
      );

    const candidates =
      productIdCandidates(
        productId
      );

    let inventory =
      await inventoryCollection.findOne(
        {
          productId: {
            $in:
              candidates,
          },
        }
      );

    const now =
      new Date();

    if (!inventory) {
      const inserted =
        await inventoryCollection.insertOne(
          {
            productId:
              new ObjectId(
                productId
              ),
            quantity: 0,
            createdAt:
              now,
            updatedAt:
              now,
          }
        );

      inventory =
        await inventoryCollection.findOne(
          {
            _id:
              inserted.insertedId,
          }
        );
    }

    if (!inventory) {
      throw new Error(
        "Stok kaydı oluşturulamadı."
      );
    }

    inventoryId =
      inventory._id;

    const previousQuantity =
      Math.max(
        0,
        Number(
          inventory.quantity
        ) || 0
      );

    const inventoryUpdate =
      await inventoryCollection.updateOne(
        {
          _id:
            inventory._id,
        },
        {
          $inc: {
            quantity,
          },
          $set: {
            updatedAt:
              now,
          },
        }
      );

    if (
      inventoryUpdate.modifiedCount !==
      1
    ) {
      throw new Error(
        "Stok miktarı güncellenemedi."
      );
    }

    inventoryAdded =
      true;

    const movementResult =
      await stockMovementsCollection.insertOne(
        {
          productId,
          type: "in",
          quantity,
          previousQuantity,
          newQuantity:
            previousQuantity +
            quantity,
          ...(note
            ? {
                note,
              }
            : {
                note:
                  `Manuel stok girişi - ${supplier}`,
              }),
          supplier,
          paymentMethod,
          purchaseTotalUsd,
          balanceUsedUsd,
          cardAmountUsd,
          createdAt:
            now,
        }
      );

    stockMovementId =
      movementResult.insertedId;

    supplierOrderId =
      await createSupplierOrder({
        supplier,
        source:
          "manual_stock",
        productId,
        productCode:
          product.productCode,
        brand:
          product.brand,
        model:
          product.model,
        quantity,
        unitPriceUsd,
        paymentMethod,
        balanceUsedUsd,
        cardAmountUsd,
        stockMovementId:
          stockMovementId.toString(),
        note:
          note ||
          undefined,
        createdAt:
          now,
      });

    return NextResponse.json({
      success: true,
      data: {
        productId,
        previousQuantity,
        newQuantity:
          previousQuantity +
          quantity,
        supplier,
        paymentMethod,
        unitPriceUsd,
        purchaseTotalUsd,
        balanceUsedUsd,
        cardAmountUsd,
        supplierBalanceUsd:
          balanceMutation
            ?.balanceAfterUsd,
      },
      message:
        "Stok girişi başarıyla tamamlandı.",
    });
  } catch (error) {
    try {
      if (
        supplierOrderId
      ) {
        await deleteSupplierOrder(
          supplierOrderId
        );
      }

      const db =
        await getDatabase();

      if (
        stockMovementId
      ) {
        await db
          .collection(
            "stockMovements"
          )
          .deleteOne({
            _id:
              stockMovementId,
          });
      }

      if (
        inventoryAdded &&
        inventoryId &&
        rollbackQuantity > 0
      ) {
        await db
          .collection(
            "inventory"
          )
          .updateOne(
            {
              _id:
                inventoryId,
            },
            {
              $inc: {
                quantity:
                  -rollbackQuantity,
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
        "Manual stock rollback error:",
        rollbackError
      );
    }

    console.error(
      "POST /api/inventory/manual-stock-entry error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Stok girişi tamamlanamadı.",
      },
      {
        status: 500,
      }
    );
  }
}
