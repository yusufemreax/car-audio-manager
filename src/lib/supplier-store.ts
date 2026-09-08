import {
  ObjectId,
  type Collection,
  type Db,
  type WithId,
} from "mongodb";

import {
  getDatabase,
} from "@/lib/mongodb";

import {
  PRODUCT_SUPPLIERS,
  isProductSupplier,
  type ProductSupplier,
  type SupplierBalanceMovement,
  type SupplierBalanceMovementType,
  type SupplierOrder,
  type SupplierOrderSource,
  type SupplierPurchasePaymentMethod,
  type SupplierSummary,
} from "@/types/supplier";

const SUPPLIERS_COLLECTION =
  "suppliers";
const SUPPLIER_BALANCE_MOVEMENTS_COLLECTION =
  "supplierBalanceMovements";
const SUPPLIER_ORDERS_COLLECTION =
  "supplierOrders";

interface SupplierDocument {
  supplier: ProductSupplier;
  balanceUsd: number;
  createdAt: Date;
  updatedAt: Date;
}

interface SupplierBalanceMovementDocument {
  supplier: ProductSupplier;
  type: SupplierBalanceMovementType;
  amountUsd: number;
  amountTry?: number;
  exchangeRate?: number;
  exchangeRateDate?: string;
  balanceBeforeUsd: number;
  balanceAfterUsd: number;
  note?: string;
  customerOfferId?: string;
  stockMovementId?: string;
  createdAt: Date;
}

interface SupplierOrderDocument {
  supplier: ProductSupplier;
  source: SupplierOrderSource;
  productId: string;
  productCode?: string;
  brand?: string;
  model?: string;
  quantity: number;
  unitPriceUsd: number;
  totalUsd: number;
  paymentMethod?: SupplierPurchasePaymentMethod;
  balanceUsedUsd?: number;
  cardAmountUsd?: number;
  customerCardAmountTry?: number;
  customerCardChargedUsd?: number;
  customerCardAppliedUsd?: number;
  customerCardSurplusUsd?: number;
  exchangeRate?: number;
  exchangeRateDate?: string;
  customerOfferId?: string;
  stockMovementId?: string;
  batchOrderId?: string;
  note?: string;
  createdAt: Date;
}

interface SupplierCollections {
  db: Db;
  suppliers:
    Collection<SupplierDocument>;
  balanceMovements:
    Collection<SupplierBalanceMovementDocument>;
  orders:
    Collection<SupplierOrderDocument>;
}

export interface SupplierBalanceMutation {
  supplier: ProductSupplier;
  deltaUsd: number;
  balanceBeforeUsd: number;
  balanceAfterUsd: number;
  movementId: ObjectId;
}

export interface SupplierOrderInput {
  supplier: ProductSupplier;
  source: SupplierOrderSource;
  productId: string;
  productCode?: string;
  brand?: string;
  model?: string;
  quantity: number;
  unitPriceUsd: number;
  paymentMethod?: SupplierPurchasePaymentMethod;
  balanceUsedUsd?: number;
  cardAmountUsd?: number;
  customerCardAmountTry?: number;
  customerCardChargedUsd?: number;
  customerCardAppliedUsd?: number;
  customerCardSurplusUsd?: number;
  exchangeRate?: number;
  exchangeRateDate?: string;
  customerOfferId?: string;
  stockMovementId?: string;
  batchOrderId?: string;
  note?: string;
  createdAt?: Date;
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

async function getCollections(): Promise<
  SupplierCollections
> {
  const db =
    await getDatabase();

  return {
    db,
    suppliers:
      db.collection<SupplierDocument>(
        SUPPLIERS_COLLECTION
      ),
    balanceMovements:
      db.collection<SupplierBalanceMovementDocument>(
        SUPPLIER_BALANCE_MOVEMENTS_COLLECTION
      ),
    orders:
      db.collection<SupplierOrderDocument>(
        SUPPLIER_ORDERS_COLLECTION
      ),
  };
}

export async function ensureSuppliers() {
  const {
    suppliers,
  } = await getCollections();

  const now =
    new Date();

  await Promise.all(
    PRODUCT_SUPPLIERS.map(
      (supplier) =>
        suppliers.updateOne(
          {
            supplier,
          },
          {
            $setOnInsert: {
              supplier,
              balanceUsd: 0,
              createdAt:
                now,
              updatedAt:
                now,
            },
          },
          {
            upsert: true,
          }
        )
    )
  );
}

export async function getSupplierBalance(
  supplier: ProductSupplier
) {
  await ensureSuppliers();

  const {
    suppliers,
  } = await getCollections();

  const document =
    await suppliers.findOne({
      supplier,
    });

  return roundMoney(
    Number(
      document?.balanceUsd ??
        0
    ) || 0
  );
}

async function changeSupplierBalance(
  supplier: ProductSupplier,
  amountUsd: number,
  movementType:
    SupplierBalanceMovementType,
  options?: {
    note?: string;
    customerOfferId?: string;
    stockMovementId?: string;
    amountTry?: number;
    exchangeRate?: number;
    exchangeRateDate?: string;
  }
): Promise<SupplierBalanceMutation> {
  if (
    !isProductSupplier(
      supplier
    )
  ) {
    throw new Error(
      "Geçersiz tedarikçi."
    );
  }

  const roundedAmount =
    roundMoney(
      amountUsd
    );

  if (
    !Number.isFinite(
      roundedAmount
    ) ||
    roundedAmount === 0
  ) {
    throw new Error(
      "Bakiye hareket tutarı 0 olamaz."
    );
  }

  await ensureSuppliers();

  const {
    suppliers,
    balanceMovements,
  } = await getCollections();

  const now =
    new Date();

  const filter =
    roundedAmount < 0
      ? {
          supplier,
          balanceUsd: {
            $gte:
              Math.abs(
                roundedAmount
              ),
          },
        }
      : {
          supplier,
        };

  const before =
    await suppliers.findOneAndUpdate(
      filter,
      {
        $inc: {
          balanceUsd:
            roundedAmount,
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
    if (
      roundedAmount < 0
    ) {
      throw new Error(
        `${supplier} bakiyesi yetersiz.`
      );
    }

    throw new Error(
      "Tedarikçi bakiyesi güncellenemedi."
    );
  }

  const balanceBeforeUsd =
    roundMoney(
      Number(
        before.balanceUsd
      ) || 0
    );

  const balanceAfterUsd =
    roundMoney(
      balanceBeforeUsd +
        roundedAmount
    );

  try {
    const movementResult =
      await balanceMovements.insertOne(
        {
          supplier,
          type:
            movementType,
          amountUsd:
            roundedAmount,
          ...(options?.amountTry !== undefined
            ? { amountTry: roundMoney(Number(options.amountTry) || 0) }
            : {}),
          ...(options?.exchangeRate !== undefined
            ? { exchangeRate: Number(options.exchangeRate) || 0 }
            : {}),
          ...(cleanString(options?.exchangeRateDate)
            ? { exchangeRateDate: cleanString(options?.exchangeRateDate) }
            : {}),
          balanceBeforeUsd,
          balanceAfterUsd,
          ...(cleanString(
            options?.note
          )
            ? {
                note:
                  cleanString(
                    options?.note
                  ),
              }
            : {}),
          ...(cleanString(
            options
              ?.customerOfferId
          )
            ? {
                customerOfferId:
                  cleanString(
                    options
                      ?.customerOfferId
                  ),
              }
            : {}),
          ...(cleanString(
            options
              ?.stockMovementId
          )
            ? {
                stockMovementId:
                  cleanString(
                    options
                      ?.stockMovementId
                  ),
              }
            : {}),
          createdAt:
            now,
        }
      );

    return {
      supplier,
      deltaUsd:
        roundedAmount,
      balanceBeforeUsd,
      balanceAfterUsd,
      movementId:
        movementResult.insertedId,
    };
  } catch (error) {
    await suppliers.updateOne(
      {
        supplier,
      },
      {
        $inc: {
          balanceUsd:
            -roundedAmount,
        },
        $set: {
          updatedAt:
            new Date(),
        },
      }
    );

    throw error;
  }
}

export async function addSupplierBalance(
  supplier: ProductSupplier,
  amountUsd: number,
  options?: {
    note?: string;
  }
) {
  if (
    amountUsd <= 0
  ) {
    throw new Error(
      "Eklenecek bakiye 0'dan büyük olmalıdır."
    );
  }

  return changeSupplierBalance(
    supplier,
    Math.abs(
      amountUsd
    ),
    "manual_topup",
    options
  );
}

export async function addCustomerCardCredit(
  supplier: ProductSupplier,
  amountUsd: number,
  options: {
    customerOfferId: string;
    note?: string;
  }
) {
  if (
    amountUsd <= 0
  ) {
    throw new Error(
      "Kart bakiyesi 0'dan büyük olmalıdır."
    );
  }

  return changeSupplierBalance(
    supplier,
    Math.abs(
      amountUsd
    ),
    "customer_card_credit",
    options
  );
}

export async function addCustomerCardSurplus(
  supplier: ProductSupplier,
  amountUsd: number,
  options?: {
    amountTry?: number;
    exchangeRate?: number;
    exchangeRateDate?: string;
    customerOfferId?: string;
    stockMovementId?: string;
    note?: string;
  }
) {
  if (amountUsd <= 0) {
    throw new Error(
      "Müşteri kartından kalan bakiye 0'dan büyük olmalıdır."
    );
  }

  return changeSupplierBalance(
    supplier,
    Math.abs(amountUsd),
    "customer_card_surplus",
    options
  );
}

export async function useSupplierBalanceForStock(
  supplier: ProductSupplier,
  amountUsd: number,
  options?: {
    stockMovementId?: string;
    customerOfferId?: string;
    note?: string;
  }
) {
  if (
    amountUsd <= 0
  ) {
    throw new Error(
      "Kullanılacak bakiye 0'dan büyük olmalıdır."
    );
  }

  return changeSupplierBalance(
    supplier,
    -Math.abs(
      amountUsd
    ),
    "stock_purchase_balance_usage",
    options
  );
}

export async function rollbackSupplierBalanceMutation(
  mutation:
    SupplierBalanceMutation
) {
  const {
    suppliers,
    balanceMovements,
  } = await getCollections();

  await balanceMovements.deleteOne(
    {
      _id:
        mutation.movementId,
    }
  );

  await suppliers.updateOne(
    {
      supplier:
        mutation.supplier,
    },
    {
      $inc: {
        balanceUsd:
          -mutation.deltaUsd,
      },
      $set: {
        updatedAt:
          new Date(),
      },
    }
  );
}

export async function createSupplierOrder(
  input:
    SupplierOrderInput
) {
  if (
    !isProductSupplier(
      input.supplier
    )
  ) {
    throw new Error(
      "Geçersiz tedarikçi."
    );
  }

  const quantity =
    Math.trunc(
      Number(
        input.quantity
      )
    );

  const unitPriceUsd =
    roundMoney(
      Number(
        input.unitPriceUsd
      ) || 0
    );

  if (
    quantity <= 0
  ) {
    throw new Error(
      "Sipariş adedi 0'dan büyük olmalıdır."
    );
  }

  if (
    unitPriceUsd < 0
  ) {
    throw new Error(
      "Ürün USD fiyatı negatif olamaz."
    );
  }

  const {
    orders,
  } = await getCollections();

  const createdAt =
    input.createdAt ??
    new Date();

  const result =
    await orders.insertOne({
      supplier:
        input.supplier,
      source:
        input.source,
      productId:
        input.productId,
      ...(cleanString(
        input.productCode
      )
        ? {
            productCode:
              cleanString(
                input.productCode
              ),
          }
        : {}),
      ...(cleanString(
        input.brand
      )
        ? {
            brand:
              cleanString(
                input.brand
              ),
          }
        : {}),
      ...(cleanString(
        input.model
      )
        ? {
            model:
              cleanString(
                input.model
              ),
          }
        : {}),
      quantity,
      unitPriceUsd,
      totalUsd:
        roundMoney(
          unitPriceUsd *
            quantity
        ),
      ...(input.paymentMethod
        ? {
            paymentMethod:
              input.paymentMethod,
          }
        : {}),
      ...(input.balanceUsedUsd !==
      undefined
        ? {
            balanceUsedUsd:
              roundMoney(
                input.balanceUsedUsd
              ),
          }
        : {}),
      ...(input.cardAmountUsd !==
      undefined
        ? {
            cardAmountUsd:
              roundMoney(
                input.cardAmountUsd
              ),
          }
        : {}),
      ...(input.customerCardAmountTry !== undefined
        ? { customerCardAmountTry: roundMoney(input.customerCardAmountTry) }
        : {}),
      ...(input.customerCardChargedUsd !== undefined
        ? { customerCardChargedUsd: roundMoney(input.customerCardChargedUsd) }
        : {}),
      ...(input.customerCardAppliedUsd !== undefined
        ? { customerCardAppliedUsd: roundMoney(input.customerCardAppliedUsd) }
        : {}),
      ...(input.customerCardSurplusUsd !== undefined
        ? { customerCardSurplusUsd: roundMoney(input.customerCardSurplusUsd) }
        : {}),
      ...(input.exchangeRate !== undefined
        ? { exchangeRate: Number(input.exchangeRate) || 0 }
        : {}),
      ...(cleanString(input.exchangeRateDate)
        ? { exchangeRateDate: cleanString(input.exchangeRateDate) }
        : {}),
      ...(cleanString(
        input.customerOfferId
      )
        ? {
            customerOfferId:
              cleanString(
                input.customerOfferId
              ),
          }
        : {}),
      ...(cleanString(
        input.stockMovementId
      )
        ? {
            stockMovementId:
              cleanString(
                input.stockMovementId
              ),
          }
        : {}),
      ...(cleanString(
        input.batchOrderId
      )
        ? {
            batchOrderId:
              cleanString(
                input.batchOrderId
              ),
          }
        : {}),
      ...(cleanString(
        input.note
      )
        ? {
            note:
              cleanString(
                input.note
              ),
          }
        : {}),
      createdAt,
    });

  return result.insertedId;
}

export async function deleteSupplierOrder(
  id: ObjectId
) {
  const {
    orders,
  } = await getCollections();

  await orders.deleteOne({
    _id: id,
  });
}

function serializeOrder(
  document:
    WithId<SupplierOrderDocument>
): SupplierOrder {
  return {
    id:
      document._id.toString(),
    supplier:
      document.supplier,
    source:
      document.source,
    productId:
      document.productId,
    ...(document.productCode
      ? {
          productCode:
            document.productCode,
        }
      : {}),
    ...(document.brand
      ? {
          brand:
            document.brand,
        }
      : {}),
    ...(document.model
      ? {
          model:
            document.model,
        }
      : {}),
    quantity:
      document.quantity,
    unitPriceUsd:
      document.unitPriceUsd,
    totalUsd:
      document.totalUsd,
    ...(document.paymentMethod
      ? {
          paymentMethod:
            document.paymentMethod,
        }
      : {}),
    ...(document.balanceUsedUsd !==
    undefined
      ? {
          balanceUsedUsd:
            document.balanceUsedUsd,
        }
      : {}),
    ...(document.cardAmountUsd !==
    undefined
      ? {
          cardAmountUsd:
            document.cardAmountUsd,
        }
      : {}),
    ...(document.customerCardAmountTry !== undefined
      ? { customerCardAmountTry: document.customerCardAmountTry }
      : {}),
    ...(document.customerCardChargedUsd !== undefined
      ? { customerCardChargedUsd: document.customerCardChargedUsd }
      : {}),
    ...(document.customerCardAppliedUsd !== undefined
      ? { customerCardAppliedUsd: document.customerCardAppliedUsd }
      : {}),
    ...(document.customerCardSurplusUsd !== undefined
      ? { customerCardSurplusUsd: document.customerCardSurplusUsd }
      : {}),
    ...(document.exchangeRate !== undefined
      ? { exchangeRate: document.exchangeRate }
      : {}),
    ...(document.exchangeRateDate
      ? { exchangeRateDate: document.exchangeRateDate }
      : {}),
    ...(document.customerOfferId
      ? {
          customerOfferId:
            document.customerOfferId,
        }
      : {}),
    ...(document.stockMovementId
      ? {
          stockMovementId:
            document.stockMovementId,
        }
      : {}),
    ...(document.batchOrderId
      ? {
          batchOrderId:
            document.batchOrderId,
        }
      : {}),
    ...(document.note
      ? {
          note:
            document.note,
        }
      : {}),
    createdAt:
      document.createdAt.toISOString(),
  };
}

function serializeBalanceMovement(
  document:
    WithId<SupplierBalanceMovementDocument>
): SupplierBalanceMovement {
  return {
    id:
      document._id.toString(),
    supplier:
      document.supplier,
    type:
      document.type,
    amountUsd:
      document.amountUsd,
    ...(document.amountTry !== undefined
      ? { amountTry: document.amountTry }
      : {}),
    ...(document.exchangeRate !== undefined
      ? { exchangeRate: document.exchangeRate }
      : {}),
    ...(document.exchangeRateDate
      ? { exchangeRateDate: document.exchangeRateDate }
      : {}),
    balanceBeforeUsd:
      document.balanceBeforeUsd,
    balanceAfterUsd:
      document.balanceAfterUsd,
    ...(document.note
      ? {
          note:
            document.note,
        }
      : {}),
    ...(document.customerOfferId
      ? {
          customerOfferId:
            document.customerOfferId,
        }
      : {}),
    ...(document.stockMovementId
      ? {
          stockMovementId:
            document.stockMovementId,
        }
      : {}),
    createdAt:
      document.createdAt.toISOString(),
  };
}

export async function getSupplierSummaries(): Promise<
  SupplierSummary[]
> {
  await ensureSuppliers();

  const {
    suppliers,
    balanceMovements,
    orders,
  } = await getCollections();

  const [
    supplierDocuments,
    orderDocuments,
    movementDocuments,
  ] = await Promise.all([
    suppliers
      .find({})
      .toArray(),
    orders
      .find({})
      .sort({
        createdAt: -1,
      })
      .toArray(),
    balanceMovements
      .find({})
      .sort({
        createdAt: -1,
      })
      .toArray(),
  ]);

  return PRODUCT_SUPPLIERS.map(
    (supplier) => {
      const document =
        supplierDocuments.find(
          (item) =>
            item.supplier ===
            supplier
        );

      const createdAt =
        document?.createdAt ??
        new Date(0);

      const updatedAt =
        document?.updatedAt ??
        createdAt;

      return {
        supplier,
        balanceUsd:
          roundMoney(
            Number(
              document?.balanceUsd ??
                0
            ) || 0
          ),
        orders:
          orderDocuments
            .filter(
              (item) =>
                item.supplier ===
                supplier
            )
            .map(
              serializeOrder
            ),
        balanceMovements:
          movementDocuments
            .filter(
              (item) =>
                item.supplier ===
                supplier
            )
            .map(
              serializeBalanceMovement
            ),
        createdAt:
          createdAt.toISOString(),
        updatedAt:
          updatedAt.toISOString(),
      };
    }
  );
}
