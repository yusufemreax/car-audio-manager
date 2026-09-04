import {
  randomUUID,
} from "node:crypto";

import {
  ObjectId,
  type Collection,
  type Db,
  type WithId,
} from "mongodb";

import {
  getDatabase,
} from "@/lib/mongodb";

import type {
  ProductDocument,
} from "@/lib/products-collection";

import {
  getProductsByIdsWithFreshPrices,
} from "@/lib/products-service";

import {
  addCustomerCardCredit,
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

import type {
  CustomerOfferCompletionPayment,
  CustomerOfferOrderSupplierPayment,
  CustomerOfferOrderSupplierSelection,
  CustomerOfferStockRequirement,
  CustomerOfferWorkflowAction,
} from "@/types/customer-offer-workflow";

const CUSTOMER_SYSTEM_OFFERS_COLLECTION =
  "customerSystemOffers";

const INVENTORY_COLLECTION =
  "inventory";

const STOCK_MOVEMENTS_COLLECTION =
  "stockMovements";

interface OfferSnapshotItemDocument {
  productId?: string | ObjectId;
  productCode?: string;
  brand?: string;
  model?: string;
  label?: string;
  quantity?: number;
}

interface OfferSnapshotDocument {
  name?: string;
  items?: OfferSnapshotItemDocument[];
}

interface CustomerOfferPaymentDocument {
  method: "cash" | "card";
  supplier?: ProductSupplier;
  cardAmountTry: number;
  cardAmountUsd: number;
  cashAmountTry: number;
  exchangeRate?: number;
  exchangeRateDate?: string;
  completedAt: Date;
}

interface CustomerOfferOrderSupplierPaymentDocument {
  supplier: ProductSupplier;
  paymentMethod: SupplierPurchasePaymentMethod;
  orderTotalUsd: number;
  balanceUsedUsd: number;
  cardAmountUsd: number;
}

interface CustomerSystemOfferDocument {
  customerId: string;
  vehicleId: string;
  status: string;
  systemSnapshot: OfferSnapshotDocument;
  finalCustomerTotalTry?: number;

  stockRequirements?: CustomerOfferStockRequirement[];
  stockDeductedAt?: Date;
  orderPendingAt?: Date;
  installationPendingAt?: Date;
  completedAt?: Date;
  soldAt?: Date;
  updatedAt?: Date;

  customerPayment?: CustomerOfferPaymentDocument;
  orderSupplierPayments?: CustomerOfferOrderSupplierPaymentDocument[];

  stockProcessingToken?: string;
  stockProcessingAt?: Date;

  paymentProcessingToken?: string;
  paymentProcessingAt?: Date;

  [key: string]: unknown;
}

interface InventoryDocument {
  productId: string | ObjectId;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

interface StockMovementDocument {
  productId: string;
  type: "in" | "out";
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  note: string;
  offerId: string;
  supplier?: ProductSupplier;
  createdAt: Date;
}

interface RequiredProduct {
  productId: string;
  productCode?: string;
  brand?: string;
  model?: string;
  requiredQuantity: number;
}

interface RequirementResolution {
  requirements: CustomerOfferStockRequirement[];
  inventoryByProductId: Map<
    string,
    WithId<InventoryDocument>
  >;
  productByProductId: Map<
    string,
    WithId<ProductDocument>
  >;
}

export interface CustomerOfferWorkflowOptions {
  supplierSelections?: CustomerOfferOrderSupplierSelection[];
  supplierPayments?: CustomerOfferOrderSupplierPayment[];
  payment?: CustomerOfferCompletionPayment;
}

export interface CustomerOfferWorkflowResult {
  offer: Record<string, unknown>;
  stockRequirements: CustomerOfferStockRequirement[];
  message: string;
}

export class CustomerOfferWorkflowError extends Error {
  statusCode: number;
  stockRequirements?: CustomerOfferStockRequirement[];
  offer?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode = 400,
    options?: {
      stockRequirements?: CustomerOfferStockRequirement[];
      offer?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name =
      "CustomerOfferWorkflowError";
    this.statusCode =
      statusCode;
    this.stockRequirements =
      options?.stockRequirements;
    this.offer =
      options?.offer;
  }
}

function cleanString(
  value: unknown
): string {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function roundMoney(
  value: number
) {
  return Math.round(
    (value + Number.EPSILON) *
      100
  ) / 100;
}

function safeMoney(
  value: unknown
) {
  const numeric =
    Number(value);

  return Number.isFinite(
    numeric
  )
    ? roundMoney(
        numeric
      )
    : 0;
}

function safeQuantity(
  value: unknown
) {
  const numberValue =
    Number(value);

  if (
    !Number.isFinite(
      numberValue
    ) ||
    numberValue <= 0
  ) {
    return 1;
  }

  return Math.max(
    1,
    Math.trunc(
      numberValue
    )
  );
}

function normalizeProductId(
  value: unknown
): string {
  if (
    value instanceof
    ObjectId
  ) {
    return value.toHexString();
  }

  return cleanString(
    value
  );
}

function getOfferObjectId(
  id: string
) {
  if (
    !ObjectId.isValid(
      id
    )
  ) {
    throw new CustomerOfferWorkflowError(
      "Geçersiz teklif ID.",
      400
    );
  }

  return new ObjectId(
    id
  );
}

function getRequiredProducts(
  offer:
    WithId<CustomerSystemOfferDocument>
): RequiredProduct[] {
  const items =
    Array.isArray(
      offer.systemSnapshot
        ?.items
    )
      ? offer.systemSnapshot.items
      : [];

  if (
    items.length === 0
  ) {
    throw new CustomerOfferWorkflowError(
      "Teklif içerisinde stok kontrolü yapılacak ürün bulunamadı.",
      400
    );
  }

  const requiredMap =
    new Map<
      string,
      RequiredProduct
    >();

  for (
    const item of items
  ) {
    const productId =
      normalizeProductId(
        item.productId
      );

    if (!productId) {
      throw new CustomerOfferWorkflowError(
        `Teklif içindeki \"${cleanString(
          item.brand
        )} ${cleanString(
          item.model
        )}\" ürünü için ürün ID bulunamadı.`,
        400
      );
    }

    const quantity =
      safeQuantity(
        item.quantity
      );

    const existing =
      requiredMap.get(
        productId
      );

    if (existing) {
      existing.requiredQuantity +=
        quantity;
      continue;
    }

    requiredMap.set(
      productId,
      {
        productId,
        ...(cleanString(
          item.productCode
        )
          ? {
              productCode:
                cleanString(
                  item.productCode
                ),
            }
          : {}),
        ...(cleanString(
          item.brand
        )
          ? {
              brand:
                cleanString(
                  item.brand
                ),
            }
          : {}),
        ...(cleanString(
          item.model
        )
          ? {
              model:
                cleanString(
                  item.model
                ),
            }
          : {}),
        requiredQuantity:
          quantity,
      }
    );
  }

  return Array.from(
    requiredMap.values()
  );
}

function getProductIdCandidates(
  productIds: string[]
): Array<string | ObjectId> {
  const candidates:
    Array<
      string | ObjectId
    > = [];

  for (
    const productId of
      productIds
  ) {
    candidates.push(
      productId
    );

    if (
      ObjectId.isValid(
        productId
      )
    ) {
      candidates.push(
        new ObjectId(
          productId
        )
      );
    }
  }

  return candidates;
}

async function resolveRequirements(
  inventoryCollection:
    Collection<InventoryDocument>,
  offer:
    WithId<CustomerSystemOfferDocument>
): Promise<RequirementResolution> {
  const requiredProducts =
    getRequiredProducts(
      offer
    );

  const productIds =
    requiredProducts.map(
      (item) =>
        item.productId
    );

  const inventoryCandidates =
    getProductIdCandidates(
      productIds
    );

  const productObjectIds =
    productIds.map(
      (productId) => {
        if (
          !ObjectId.isValid(
            productId
          )
        ) {
          throw new CustomerOfferWorkflowError(
            `Geçersiz ürün ID: ${productId}`,
            400
          );
        }

        return new ObjectId(
          productId
        );
      }
    );

  const [
    inventoryDocuments,
    productDocuments,
  ] = await Promise.all([
    inventoryCandidates.length >
    0
      ? inventoryCollection
          .find({
            productId: {
              $in:
                inventoryCandidates,
            },
          })
          .toArray()
      : [],
    productObjectIds.length > 0
      ? getProductsByIdsWithFreshPrices(
          productObjectIds
        )
      : [],
  ]);

  const inventoryByProductId =
    new Map<
      string,
      WithId<InventoryDocument>
    >();

  for (
    const inventory of
      inventoryDocuments
  ) {
    const normalizedId =
      normalizeProductId(
        inventory.productId
      );

    if (!normalizedId) {
      continue;
    }

    if (
      inventoryByProductId.has(
        normalizedId
      )
    ) {
      throw new CustomerOfferWorkflowError(
        `Ürün için birden fazla stok kaydı bulundu: ${normalizedId}`,
        409
      );
    }

    inventoryByProductId.set(
      normalizedId,
      inventory
    );
  }

  const productByProductId =
    new Map<
      string,
      WithId<ProductDocument>
    >(
      productDocuments.map(
        (product) => [
          product._id.toString(),
          product,
        ]
      )
    );

  for (
    const required of
      requiredProducts
  ) {
    if (
      !productByProductId.has(
        required.productId
      )
    ) {
      throw new CustomerOfferWorkflowError(
        `Teklif ürün kaydı artık bulunamıyor: ${required.productCode ?? required.productId}`,
        409
      );
    }
  }

  const requirements =
    requiredProducts.map(
      (required): CustomerOfferStockRequirement => {
        const inventory =
          inventoryByProductId.get(
            required.productId
          );

        const product =
          productByProductId.get(
            required.productId
          );

        const availableQuantity =
          Math.max(
            0,
            Number(
              inventory?.quantity ??
                0
            ) || 0
          );

        const missingQuantity =
          Math.max(
            required.requiredQuantity -
              availableQuantity,
            0
          );

        return {
          productId:
            required.productId,
          ...(required.productCode
            ? {
                productCode:
                  required.productCode,
              }
            : {}),
          ...(required.brand
            ? {
                brand:
                  required.brand,
              }
            : {}),
          ...(required.model
            ? {
                model:
                  required.model,
              }
            : {}),
          requiredQuantity:
            required.requiredQuantity,
          availableQuantity,
          missingQuantity,
          unitPriceUsd:
            safeMoney(
              product?.priceUsd
            ),
          missingTotalUsd:
            safeMoney(
              safeMoney(
                product?.priceUsd
              ) *
                missingQuantity
            ),
          suppliers:
            normalizeProductSuppliers(
              product?.suppliers
            ),
        };
      }
    );

  return {
    requirements,
    inventoryByProductId,
    productByProductId,
  };
}

function hasShortage(
  requirements:
    CustomerOfferStockRequirement[]
) {
  return requirements.some(
    (item) =>
      item.missingQuantity >
      0
  );
}

function serializeDate(
  value: unknown
) {
  if (
    value instanceof Date
  ) {
    return value.toISOString();
  }

  return value;
}

function isFinalSoldOffer(
  offer:
    CustomerSystemOfferDocument
) {
  return (
    offer.status ===
      "completed" ||
    (
      offer.status ===
        "sold" &&
      Boolean(
        offer.stockDeductedAt
      )
    )
  );
}

function serializePayment(
  payment:
    CustomerOfferPaymentDocument |
    undefined
) {
  if (!payment) {
    return undefined;
  }

  return {
    ...payment,
    completedAt:
      payment.completedAt.toISOString(),
  };
}

function serializeOffer(
  offer:
    WithId<CustomerSystemOfferDocument>
): Record<string, unknown> {
  const {
    _id,
    stockProcessingToken:
      _stockProcessingToken,
    stockProcessingAt:
      _stockProcessingAt,
    paymentProcessingToken:
      _paymentProcessingToken,
    paymentProcessingAt:
      _paymentProcessingAt,
    ...rest
  } = offer;

  return {
    ...rest,
    id:
      _id.toString(),
    workflowFinalized:
      isFinalSoldOffer(
        offer
      ),
    createdAt:
      serializeDate(
        rest.createdAt
      ),
    updatedAt:
      serializeDate(
        rest.updatedAt
      ),
    soldAt:
      serializeDate(
        rest.soldAt
      ),
    orderPendingAt:
      serializeDate(
        rest.orderPendingAt
      ),
    installationPendingAt:
      serializeDate(
        rest.installationPendingAt
      ),
    stockDeductedAt:
      serializeDate(
        rest.stockDeductedAt
      ),
    completedAt:
      serializeDate(
        rest.completedAt
      ),
    ...(rest.customerPayment
      ? {
          customerPayment:
            serializePayment(
              rest.customerPayment
            ),
        }
      : {}),
  };
}

async function ensureInventoryDocument(
  inventoryCollection:
    Collection<InventoryDocument>,
  productId: string,
  now: Date
) {
  const candidates =
    getProductIdCandidates([
      productId,
    ]);

  const existing =
    await inventoryCollection.findOne(
      {
        productId: {
          $in:
            candidates,
        },
      }
    );

  if (existing) {
    return existing;
  }

  const preferredProductId:
    string | ObjectId =
      ObjectId.isValid(
        productId
      )
        ? new ObjectId(
            productId
          )
        : productId;

  const insertResult =
    await inventoryCollection.insertOne(
      {
        productId:
          preferredProductId,
        quantity: 0,
        createdAt:
          now,
        updatedAt:
          now,
      }
    );

  const created =
    await inventoryCollection.findOne(
      {
        _id:
          insertResult.insertedId,
      }
    );

  if (!created) {
    throw new CustomerOfferWorkflowError(
      `Stok kaydı oluşturulamadı: ${productId}`,
      500
    );
  }

  return created;
}

async function writeStockMovements(
  db: Db,
  movements:
    StockMovementDocument[]
) {
  if (
    movements.length === 0
  ) {
    return;
  }

  try {
    await db
      .collection<StockMovementDocument>(
        STOCK_MOVEMENTS_COLLECTION
      )
      .insertMany(
        movements
      );
  } catch (error) {
    /*
     * Hareket logu stok/teklif ana işlemini bozmaz.
     */
    console.error(
      "Stock movement log could not be written:",
      error
    );
  }
}

async function releaseStockProcessingToken(
  offersCollection:
    Collection<CustomerSystemOfferDocument>,
  offerId: ObjectId,
  token: string
) {
  await offersCollection.updateOne(
    {
      _id:
        offerId,
      stockProcessingToken:
        token,
    },
    {
      $unset: {
        stockProcessingToken:
          "",
        stockProcessingAt:
          "",
      },
    }
  );
}

async function releasePaymentProcessingToken(
  offersCollection:
    Collection<CustomerSystemOfferDocument>,
  offerId: ObjectId,
  token: string
) {
  await offersCollection.updateOne(
    {
      _id:
        offerId,
      paymentProcessingToken:
        token,
    },
    {
      $unset: {
        paymentProcessingToken:
          "",
        paymentProcessingAt:
          "",
      },
    }
  );
}

async function claimStockOffer(
  offersCollection:
    Collection<CustomerSystemOfferDocument>,
  offerId: ObjectId,
  allowedStatuses: string[],
  token: string,
  now: Date
) {
  const claimed =
    await offersCollection.findOneAndUpdate(
      {
        _id:
          offerId,
        status: {
          $in:
            allowedStatuses,
        },
        stockProcessingToken: {
          $exists:
            false,
        },
        stockDeductedAt: {
          $exists:
            false,
        },
      },
      {
        $set: {
          stockProcessingToken:
            token,
          stockProcessingAt:
            now,
          updatedAt:
            now,
        },
      },
      {
        returnDocument:
          "after",
      }
    );

  if (claimed) {
    return claimed;
  }

  const current =
    await offersCollection.findOne(
      {
        _id:
          offerId,
      }
    );

  if (!current) {
    throw new CustomerOfferWorkflowError(
      "Teklif bulunamadı.",
      404
    );
  }

  if (
    current.stockDeductedAt
  ) {
    return current;
  }

  if (
    current.stockProcessingToken
  ) {
    throw new CustomerOfferWorkflowError(
      "Bu teklif için stok işlemi halen devam ediyor. Lütfen tekrar deneyin.",
      409
    );
  }

  throw new CustomerOfferWorkflowError(
    "Teklif mevcut durumundan bu işleme geçirilemez.",
    409
  );
}

async function claimPaymentOffer(
  offersCollection:
    Collection<CustomerSystemOfferDocument>,
  offerId: ObjectId,
  token: string,
  now: Date
) {
  const claimed =
    await offersCollection.findOneAndUpdate(
      {
        _id:
          offerId,
        status:
          "installation_pending",
        stockDeductedAt: {
          $exists:
            true,
        },
        paymentProcessingToken: {
          $exists:
            false,
        },
      },
      {
        $set: {
          paymentProcessingToken:
            token,
          paymentProcessingAt:
            now,
          updatedAt:
            now,
        },
      },
      {
        returnDocument:
          "after",
      }
    );

  if (claimed) {
    return claimed;
  }

  const current =
    await offersCollection.findOne({
      _id:
        offerId,
    });

  if (!current) {
    throw new CustomerOfferWorkflowError(
      "Teklif bulunamadı.",
      404
    );
  }

  if (
    isFinalSoldOffer(
      current
    )
  ) {
    return current;
  }

  if (
    current.paymentProcessingToken
  ) {
    throw new CustomerOfferWorkflowError(
      "Bu teklif için ödeme işlemi halen devam ediyor. Lütfen tekrar deneyin.",
      409
    );
  }

  throw new CustomerOfferWorkflowError(
    "Yalnızca Montaj Bekliyor durumundaki teklif satış olarak tamamlanabilir.",
    409
  );
}

async function moveToOrderPending(
  offersCollection:
    Collection<CustomerSystemOfferDocument>,
  offer:
    WithId<CustomerSystemOfferDocument>,
  token: string,
  requirements:
    CustomerOfferStockRequirement[],
  now: Date
) {
  const result =
    await offersCollection.updateOne(
      {
        _id:
          offer._id,
        stockProcessingToken:
          token,
      },
      {
        $set: {
          status:
            "order_pending",
          stockRequirements:
            requirements,
          orderPendingAt:
            offer.orderPendingAt ??
            now,
          updatedAt:
            now,
        },
        $unset: {
          stockProcessingToken:
            "",
          stockProcessingAt:
            "",
        },
      }
    );

  if (
    result.modifiedCount !==
    1
  ) {
    throw new CustomerOfferWorkflowError(
      "Teklif sipariş durumuna geçirilemedi.",
      500
    );
  }

  const updated =
    await offersCollection.findOne(
      {
        _id:
          offer._id,
      }
    );

  if (!updated) {
    throw new CustomerOfferWorkflowError(
      "Sipariş durumuna geçirilen teklif tekrar okunamadı.",
      500
    );
  }

  return updated;
}

async function deductAvailableStock(
  db: Db,
  inventoryCollection:
    Collection<InventoryDocument>,
  offersCollection:
    Collection<CustomerSystemOfferDocument>,
  offer:
    WithId<CustomerSystemOfferDocument>,
  token: string,
  resolution:
    RequirementResolution,
  now: Date
) {
  const deducted:
    Array<{
      inventoryId: ObjectId;
      quantity: number;
      previousQuantity: number;
      productId: string;
    }> = [];

  try {
    for (
      const requirement of
        resolution.requirements
    ) {
      const inventory =
        resolution.inventoryByProductId.get(
          requirement.productId
        );

      if (!inventory) {
        throw new CustomerOfferWorkflowError(
          "Stok bilgisi işlem sırasında değişti. Teklif sipariş adımına alınmalıdır.",
          409
        );
      }

      const previousQuantity =
        Math.max(
          0,
          Number(
            inventory.quantity
          ) || 0
        );

      const updateResult =
        await inventoryCollection.updateOne(
          {
            _id:
              inventory._id,
            quantity: {
              $gte:
                requirement.requiredQuantity,
            },
          },
          {
            $inc: {
              quantity:
                -requirement.requiredQuantity,
            },
            $set: {
              updatedAt:
                now,
            },
          }
        );

      if (
        updateResult.modifiedCount !==
        1
      ) {
        throw new CustomerOfferWorkflowError(
          "Stok bilgisi işlem sırasında değişti. Teklif sipariş adımına alınmalıdır.",
          409
        );
      }

      deducted.push({
        inventoryId:
          inventory._id,
        quantity:
          requirement.requiredQuantity,
        previousQuantity,
        productId:
          requirement.productId,
      });
    }

    const updateOfferResult =
      await offersCollection.updateOne(
        {
          _id:
            offer._id,
          stockProcessingToken:
            token,
        },
        {
          $set: {
            status:
              "installation_pending",
            stockRequirements:
              resolution.requirements,
            stockDeductedAt:
              now,
            installationPendingAt:
              now,
            updatedAt:
              now,
          },
          $unset: {
            stockProcessingToken:
              "",
            stockProcessingAt:
              "",
          },
        }
      );

    if (
      updateOfferResult.modifiedCount !==
      1
    ) {
      throw new CustomerOfferWorkflowError(
        "Teklif montaj durumuna geçirilemedi.",
        500
      );
    }

    const offerId =
      offer._id.toString();

    await writeStockMovements(
      db,
      deducted.map(
        (item) => ({
          productId:
            item.productId,
          type:
            "out",
          quantity:
            item.quantity,
          previousQuantity:
            item.previousQuantity,
          newQuantity:
            item.previousQuantity -
            item.quantity,
          note:
            `Müşteri teklifi stok çıkışı: ${offerId}`,
          offerId,
          createdAt:
            now,
        })
      )
    );
  } catch (error) {
    for (
      const item of
        deducted.reverse()
    ) {
      await inventoryCollection.updateOne(
        {
          _id:
            item.inventoryId,
        },
        {
          $inc: {
            quantity:
              item.quantity,
          },
          $set: {
            updatedAt:
              new Date(),
          },
        }
      );
    }

    throw error;
  }
}

function getSupplierSelectionMap(
  selections:
    CustomerOfferOrderSupplierSelection[] |
    undefined
) {
  const result =
    new Map<
      string,
      ProductSupplier
    >();

  for (
    const selection of
      selections ?? []
  ) {
    const productId =
      cleanString(
        selection.productId
      );

    if (
      !productId ||
      !isProductSupplier(
        selection.supplier
      )
    ) {
      continue;
    }

    result.set(
      productId,
      selection.supplier
    );
  }

  return result;
}

function getSupplierPaymentMap(
  payments:
    CustomerOfferOrderSupplierPayment[] |
    undefined
) {
  const result =
    new Map<
      ProductSupplier,
      CustomerOfferOrderSupplierPayment
    >();

  for (
    const payment of
      payments ?? []
  ) {
    if (
      !isProductSupplier(
        payment.supplier
      ) ||
      (
        payment.paymentMethod !==
          "card" &&
        payment.paymentMethod !==
          "balance"
      )
    ) {
      continue;
    }

    result.set(
      payment.supplier,
      payment
    );
  }

  return result;
}

async function completeOrderAndConsumeStock(
  db: Db,
  inventoryCollection:
    Collection<InventoryDocument>,
  offersCollection:
    Collection<CustomerSystemOfferDocument>,
  offer:
    WithId<CustomerSystemOfferDocument>,
  token: string,
  resolution:
    RequirementResolution,
  supplierSelections:
    CustomerOfferOrderSupplierSelection[] |
    undefined,
  supplierPayments:
    CustomerOfferOrderSupplierPayment[] |
    undefined,
  now: Date
) {
  const movements:
    StockMovementDocument[] = [];

  const changedInventories:
    Array<{
      inventoryId: ObjectId;
      rollbackQuantity: number;
    }> = [];

  const createdSupplierOrderIds:
    ObjectId[] = [];

  const balanceMutations:
    SupplierBalanceMutation[] = [];

  const selectionMap =
    getSupplierSelectionMap(
      supplierSelections
    );

  const paymentMap =
    getSupplierPaymentMap(
      supplierPayments
    );

  const receivedItems:
    Array<{
      requirement: CustomerOfferStockRequirement;
      supplier: ProductSupplier;
      quantity: number;
      unitPriceUsd: number;
      totalUsd: number;
    }> = [];

  try {
    for (
      const requirement of
        resolution.requirements
    ) {
      const existing =
        resolution.inventoryByProductId.get(
          requirement.productId
        );

      const inventory =
        existing ??
        await ensureInventoryDocument(
          inventoryCollection,
          requirement.productId,
          now
        );

      const currentDocument =
        await inventoryCollection.findOneAndUpdate(
          {
            _id:
              inventory._id,
          },
          [
            {
              $set: {
                quantity: {
                  $cond: [
                    {
                      $gte: [
                        "$quantity",
                        requirement.requiredQuantity,
                      ],
                    },
                    {
                      $subtract: [
                        "$quantity",
                        requirement.requiredQuantity,
                      ],
                    },
                    0,
                  ],
                },
                updatedAt:
                  now,
              },
            },
          ],
          {
            returnDocument:
              "before",
          }
        );

      if (!currentDocument) {
        throw new CustomerOfferWorkflowError(
          `Stok kaydı bulunamadı: ${requirement.productId}`,
          500
        );
      }

      const previousQuantity =
        Math.max(
          0,
          Number(
            currentDocument.quantity
          ) || 0
        );

      const missingQuantity =
        Math.max(
          requirement.requiredQuantity -
            previousQuantity,
          0
        );

      const quantityAfterReceipt =
        previousQuantity +
        missingQuantity;

      const finalQuantity =
        Math.max(
          previousQuantity -
            requirement.requiredQuantity,
          0
        );

      changedInventories.push({
        inventoryId:
          currentDocument._id,
        rollbackQuantity:
          Math.min(
            previousQuantity,
            requirement.requiredQuantity
          ),
      });

      const offerId =
        offer._id.toString();

      if (
        missingQuantity > 0
      ) {
        const supplier =
          selectionMap.get(
            requirement.productId
          );

        if (!supplier) {
          throw new CustomerOfferWorkflowError(
            `${requirement.brand ?? ""} ${requirement.model ?? ""} ürünü için tedarikçi seçiniz.`.trim(),
            409,
            {
              stockRequirements:
                resolution.requirements,
            }
          );
        }

        if (
          !requirement.suppliers.includes(
            supplier
          )
        ) {
          throw new CustomerOfferWorkflowError(
            `${supplier}, ${requirement.brand ?? ""} ${requirement.model ?? ""} ürünü için tanımlı tedarikçiler arasında değil.`.trim(),
            400
          );
        }

        const product =
          resolution.productByProductId.get(
            requirement.productId
          );

        if (!product) {
          throw new CustomerOfferWorkflowError(
            "Sipariş ürünü bulunamadı.",
            409
          );
        }

        const unitPriceUsd =
          safeMoney(
            product.priceUsd
          );

        receivedItems.push({
          requirement,
          supplier,
          quantity:
            missingQuantity,
          unitPriceUsd,
          totalUsd:
            safeMoney(
              unitPriceUsd *
                missingQuantity
            ),
        });

        movements.push({
          productId:
            requirement.productId,
          type:
            "in",
          quantity:
            missingQuantity,
          previousQuantity,
          newQuantity:
            quantityAfterReceipt,
          note:
            `Müşteri teklifi sipariş girişi: ${offerId}`,
          offerId,
          supplier,
          createdAt:
            now,
        });
      }

      movements.push({
        productId:
          requirement.productId,
        type:
          "out",
        quantity:
          requirement.requiredQuantity,
        previousQuantity:
          quantityAfterReceipt,
        newQuantity:
          finalQuantity,
        note:
          `Müşteri teklifi montaj stok çıkışı: ${offerId}`,
        offerId,
        createdAt:
          now,
      });
    }

    /*
     * Aynı tedarikçiden alınacak bütün eksik ürünler tek ödeme
     * toplamı altında değerlendirilir. Örneğin EGB'den üç ürün
     * alınacaksa ödeme dağılımı bu üç ürünün toplam USD tutarıdır.
     */
    const supplierGroups =
      new Map<
        ProductSupplier,
        {
          supplier: ProductSupplier;
          totalUsd: number;
          items: typeof receivedItems;
        }
      >();

    for (
      const item of
        receivedItems
    ) {
      const current =
        supplierGroups.get(
          item.supplier
        );

      if (current) {
        current.totalUsd =
          safeMoney(
            current.totalUsd +
              item.totalUsd
          );
        current.items.push(
          item
        );
        continue;
      }

      supplierGroups.set(
        item.supplier,
        {
          supplier:
            item.supplier,
          totalUsd:
            item.totalUsd,
          items: [item],
        }
      );
    }

    const orderSupplierPayments:
      CustomerOfferOrderSupplierPaymentDocument[] = [];

    for (
      const group of
        supplierGroups.values()
    ) {
      const payment =
        paymentMap.get(
          group.supplier
        );

      if (!payment) {
        throw new CustomerOfferWorkflowError(
          `${group.supplier} siparişi için ödeme bilgisi giriniz.`,
          400
        );
      }

      const paymentMethod =
        payment.paymentMethod;

      const balanceUsedUsd =
        paymentMethod ===
          "balance"
          ? safeMoney(
              payment.balanceUsedUsd
            )
          : 0;

      if (
        paymentMethod ===
          "balance" &&
        balanceUsedUsd <= 0
      ) {
        throw new CustomerOfferWorkflowError(
          `${group.supplier} için bakiyeden kullanılacak USD tutarını giriniz.`,
          400
        );
      }

      if (
        balanceUsedUsd >
        group.totalUsd
      ) {
        throw new CustomerOfferWorkflowError(
          `${group.supplier} için bakiyeden kullanılacak tutar sipariş toplamından büyük olamaz.`,
          400
        );
      }

      const cardAmountUsd =
        safeMoney(
          group.totalUsd -
            balanceUsedUsd
        );

      if (
        balanceUsedUsd > 0
      ) {
        const currentBalanceUsd =
          await getSupplierBalance(
            group.supplier
          );

        if (
          balanceUsedUsd >
          currentBalanceUsd
        ) {
          throw new CustomerOfferWorkflowError(
            `${group.supplier} bakiyesi yetersiz. Mevcut bakiye: $${currentBalanceUsd.toFixed(2)}`,
            400
          );
        }

        const balanceMutation =
          await useSupplierBalanceForStock(
            group.supplier,
            balanceUsedUsd,
            {
              customerOfferId:
                offer._id.toString(),
              note:
                `Müşteri teklifi sipariş bakiye kullanımı: ${offer._id.toString()}`,
            }
          );

        balanceMutations.push(
          balanceMutation
        );
      }

      orderSupplierPayments.push({
        supplier:
          group.supplier,
        paymentMethod,
        orderTotalUsd:
          group.totalUsd,
        balanceUsedUsd,
        cardAmountUsd,
      });

      let remainingBalance =
        balanceUsedUsd;

      for (
        let index = 0;
        index <
        group.items.length;
        index += 1
      ) {
        const item =
          group.items[index];

        const isLast =
          index ===
          group.items.length - 1;

        const allocatedBalance =
          isLast
            ? safeMoney(
                remainingBalance
              )
            : group.totalUsd > 0
              ? Math.min(
                  safeMoney(
                    balanceUsedUsd *
                      (
                        item.totalUsd /
                        group.totalUsd
                      )
                  ),
                  remainingBalance,
                  item.totalUsd
                )
              : 0;

        const allocatedCard =
          safeMoney(
            item.totalUsd -
              allocatedBalance
          );

        remainingBalance =
          safeMoney(
            remainingBalance -
              allocatedBalance
          );

        const supplierOrderId =
          await createSupplierOrder({
            supplier:
              group.supplier,
            source:
              "customer_offer_order",
            productId:
              item.requirement.productId,
            productCode:
              item.requirement.productCode,
            brand:
              item.requirement.brand,
            model:
              item.requirement.model,
            quantity:
              item.quantity,
            unitPriceUsd:
              item.unitPriceUsd,
            paymentMethod,
            balanceUsedUsd:
              allocatedBalance,
            cardAmountUsd:
              allocatedCard,
            customerOfferId:
              offer._id.toString(),
            note:
              `Müşteri teklifi sipariş tamamlama: ${offer._id.toString()}`,
            createdAt:
              now,
          });

        createdSupplierOrderIds.push(
          supplierOrderId
        );
      }
    }

    const refreshedRequirements =
      resolution.requirements.map(
        (item) => ({
          ...item,
          availableQuantity:
            Math.max(
              item.availableQuantity,
              item.requiredQuantity
            ),
          missingQuantity:
            0,
          missingTotalUsd:
            0,
        })
      );

    const offerUpdate =
      await offersCollection.updateOne(
        {
          _id:
            offer._id,
          stockProcessingToken:
            token,
        },
        {
          $set: {
            status:
              "installation_pending",
            stockRequirements:
              refreshedRequirements,
            orderSupplierPayments,
            stockDeductedAt:
              now,
            installationPendingAt:
              now,
            updatedAt:
              now,
          },
          $unset: {
            stockProcessingToken:
              "",
            stockProcessingAt:
              "",
          },
        }
      );

    if (
      offerUpdate.modifiedCount !==
      1
    ) {
      throw new CustomerOfferWorkflowError(
        "Teklif montaj durumuna geçirilemedi.",
        500
      );
    }

    await writeStockMovements(
      db,
      movements
    );
  } catch (error) {
    for (
      const supplierOrderId of
        createdSupplierOrderIds.reverse()
    ) {
      try {
        await deleteSupplierOrder(
          supplierOrderId
        );
      } catch (
        supplierOrderRollbackError
      ) {
        console.error(
          "Supplier order rollback error:",
          supplierOrderRollbackError
        );
      }
    }

    for (
      const balanceMutation of
        balanceMutations.reverse()
    ) {
      try {
        await rollbackSupplierBalanceMutation(
          balanceMutation
        );
      } catch (
        balanceRollbackError
      ) {
        console.error(
          "Supplier balance rollback error:",
          balanceRollbackError
        );
      }
    }

    for (
      const changed of
        changedInventories.reverse()
    ) {
      if (
        changed.rollbackQuantity >
        0
      ) {
        await inventoryCollection.updateOne(
          {
            _id:
              changed.inventoryId,
          },
          {
            $inc: {
              quantity:
                changed.rollbackQuantity,
            },
            $set: {
              updatedAt:
                new Date(),
            },
          }
        );
      }
    }

    throw error;
  }
}

function buildCustomerPayment(
  offer:
    WithId<CustomerSystemOfferDocument>,
  payment:
    CustomerOfferCompletionPayment |
    undefined,
  now: Date
): CustomerOfferPaymentDocument {
  if (!payment) {
    throw new CustomerOfferWorkflowError(
      "Ödeme bilgisi zorunludur.",
      400
    );
  }

  const totalTry =
    Math.max(
      0,
      safeMoney(
        offer.finalCustomerTotalTry
      )
    );

  if (
    payment.method ===
    "cash"
  ) {
    return {
      method:
        "cash",
      cardAmountTry:
        0,
      cardAmountUsd:
        0,
      cashAmountTry:
        totalTry,
      completedAt:
        now,
    };
  }

  if (
    payment.method !==
    "card"
  ) {
    throw new CustomerOfferWorkflowError(
      "Geçerli ödeme yöntemi seçiniz.",
      400
    );
  }

  if (
    !isProductSupplier(
      payment.supplier
    )
  ) {
    throw new CustomerOfferWorkflowError(
      "Kart ödemesi için tedarikçi seçiniz.",
      400
    );
  }

  const cardAmountTry =
    safeMoney(
      payment.cardAmountTry
    );

  const cardAmountUsd =
    safeMoney(
      payment.cardAmountUsd
    );

  if (
    cardAmountTry <= 0
  ) {
    throw new CustomerOfferWorkflowError(
      "Karttan çekilecek TL tutarı 0'dan büyük olmalıdır.",
      400
    );
  }

  if (
    cardAmountTry >
    totalTry
  ) {
    throw new CustomerOfferWorkflowError(
      "Kart tutarı teklif müşteri tutarından büyük olamaz.",
      400
    );
  }

  if (
    cardAmountUsd <= 0
  ) {
    throw new CustomerOfferWorkflowError(
      "Tedarikçi bakiyesine girecek USD tutarı 0'dan büyük olmalıdır.",
      400
    );
  }

  const exchangeRate =
    safeMoney(
      payment.exchangeRate
    );

  const exchangeRateDate =
    cleanString(
      payment.exchangeRateDate
    );

  return {
    method:
      "card",
    supplier:
      payment.supplier,
    cardAmountTry,
    cardAmountUsd,
    cashAmountTry:
      roundMoney(
        Math.max(
          totalTry -
            cardAmountTry,
          0
        )
      ),
    ...(exchangeRate > 0
      ? {
          exchangeRate,
        }
      : {}),
    ...(exchangeRateDate
      ? {
          exchangeRateDate,
        }
      : {}),
    completedAt:
      now,
  };
}

async function completeSale(
  offersCollection:
    Collection<CustomerSystemOfferDocument>,
  offer:
    WithId<CustomerSystemOfferDocument>,
  token: string,
  paymentInput:
    CustomerOfferCompletionPayment |
    undefined,
  now: Date
) {
  const payment =
    buildCustomerPayment(
      offer,
      paymentInput,
      now
    );

  let balanceMutation:
    SupplierBalanceMutation |
    null = null;

  try {
    if (
      payment.method ===
        "card" &&
      payment.supplier
    ) {
      balanceMutation =
        await addCustomerCardCredit(
          payment.supplier,
          payment.cardAmountUsd,
          {
            customerOfferId:
              offer._id.toString(),
            note:
              `Müşteri kart tahsilatı - ${offer.systemSnapshot?.name ?? offer._id.toString()}`,
          }
        );
    }

    const updateResult =
      await offersCollection.updateOne(
        {
          _id:
            offer._id,
          status:
            "installation_pending",
          paymentProcessingToken:
            token,
        },
        {
          $set: {
            status:
              "sold",
            customerPayment:
              payment,
            soldAt:
              now,
            completedAt:
              now,
            updatedAt:
              now,
          },
          $unset: {
            paymentProcessingToken:
              "",
            paymentProcessingAt:
              "",
          },
        }
      );

    if (
      updateResult.modifiedCount !==
      1
    ) {
      throw new CustomerOfferWorkflowError(
        "Teklif Satıldı durumuna geçirilemedi.",
        500
      );
    }
  } catch (error) {
    if (
      balanceMutation
    ) {
      try {
        await rollbackSupplierBalanceMutation(
          balanceMutation
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "Customer card balance rollback error:",
          rollbackError
        );
      }
    }

    throw error;
  }
}

async function getCollections() {
  const db =
    await getDatabase();

  return {
    db,
    offersCollection:
      db.collection<CustomerSystemOfferDocument>(
        CUSTOMER_SYSTEM_OFFERS_COLLECTION
      ),
    inventoryCollection:
      db.collection<InventoryDocument>(
        INVENTORY_COLLECTION
      ),
  };
}

export async function listCustomerOfferWorkflowOffers(): Promise<
  Record<string, unknown>[]
> {
  const {
    offersCollection,
  } = await getCollections();

  const offers =
    await offersCollection
      .find({})
      .sort({
        createdAt:
          -1,
      })
      .toArray();

  return offers.map(
    serializeOffer
  );
}

export async function getCustomerOfferWorkflowDetail(
  id: string
): Promise<CustomerOfferWorkflowResult> {
  const offerId =
    getOfferObjectId(
      id
    );

  const {
    offersCollection,
    inventoryCollection,
  } = await getCollections();

  const offer =
    await offersCollection.findOne(
      {
        _id:
          offerId,
      }
    );

  if (!offer) {
    throw new CustomerOfferWorkflowError(
      "Teklif bulunamadı.",
      404
    );
  }

  let requirements =
    offer.stockRequirements ??
    [];

  try {
    const resolution =
      await resolveRequirements(
        inventoryCollection,
        offer
      );

    requirements =
      resolution.requirements;

    if (
      offer.status ===
      "order_pending"
    ) {
      await offersCollection.updateOne(
        {
          _id:
            offer._id,
        },
        {
          $set: {
            stockRequirements:
              requirements,
            updatedAt:
              new Date(),
          },
        }
      );

      offer.stockRequirements =
        requirements;
    }
  } catch (error) {
    if (
      requirements.length ===
      0
    ) {
      throw error;
    }
  }

  return {
    offer:
      serializeOffer(
        offer
      ),
    stockRequirements:
      requirements,
    message:
      "Teklif detayı alındı.",
  };
}

export async function runCustomerOfferWorkflow(
  id: string,
  action:
    CustomerOfferWorkflowAction,
  options: CustomerOfferWorkflowOptions = {}
): Promise<CustomerOfferWorkflowResult> {
  const offerId =
    getOfferObjectId(
      id
    );

  const {
    db,
    offersCollection,
    inventoryCollection,
  } = await getCollections();

  const now =
    new Date();

  if (
    action ===
    "complete-sale"
  ) {
    const token =
      randomUUID();

    const claimed =
      await claimPaymentOffer(
        offersCollection,
        offerId,
        token,
        now
      );

    if (
      isFinalSoldOffer(
        claimed
      )
    ) {
      return {
        offer:
          serializeOffer(
            claimed
          ),
        stockRequirements:
          claimed.stockRequirements ??
          [],
        message:
          "Teklif zaten Satıldı durumunda.",
      };
    }

    try {
      await completeSale(
        offersCollection,
        claimed,
        token,
        options.payment,
        now
      );

      const soldOffer =
        await offersCollection.findOne({
          _id:
            claimed._id,
        });

      if (!soldOffer) {
        throw new CustomerOfferWorkflowError(
          "Satılan teklif tekrar okunamadı.",
          500
        );
      }

      return {
        offer:
          serializeOffer(
            soldOffer
          ),
        stockRequirements:
          soldOffer.stockRequirements ??
          [],
        message:
          options.payment?.method ===
            "card"
            ? "Montaj ve ödeme tamamlandı. Kartın USD karşılığı tedarikçi bakiyesine eklendi ve teklif Satıldı durumuna geçirildi."
            : "Montaj ve ödeme tamamlandı. Teklif Satıldı durumuna geçirildi.",
      };
    } catch (error) {
      await releasePaymentProcessingToken(
        offersCollection,
        offerId,
        token
      );

      if (
        error instanceof
        CustomerOfferWorkflowError
      ) {
        throw error;
      }

      throw new CustomerOfferWorkflowError(
        error instanceof Error
          ? error.message
          : "Teklif ödeme işlemi tamamlanamadı.",
        500
      );
    }
  }

  const allowedStatuses =
    action ===
    "start-sale"
      ? [
          "offered",
          "sold",
        ]
      : [
          "order_pending",
        ];

  const token =
    randomUUID();

  const claimed =
    await claimStockOffer(
      offersCollection,
      offerId,
      allowedStatuses,
      token,
      now
    );

  if (
    claimed.stockDeductedAt
  ) {
    return {
      offer:
        serializeOffer(
          claimed
        ),
      stockRequirements:
        claimed.stockRequirements ??
        [],
      message:
        "Stok işlemi daha önce tamamlanmış.",
    };
  }

  try {
    const resolution =
      await resolveRequirements(
        inventoryCollection,
        claimed
      );

    if (
      action ===
      "start-sale"
    ) {
      if (
        hasShortage(
          resolution.requirements
        )
      ) {
        const orderOffer =
          await moveToOrderPending(
            offersCollection,
            claimed,
            token,
            resolution.requirements,
            now
          );

        return {
          offer:
            serializeOffer(
              orderOffer
            ),
          stockRequirements:
            resolution.requirements,
          message:
            "Eksik stok bulundu. Teklif Sipariş adımına geçirildi.",
        };
      }

      try {
        await deductAvailableStock(
          db,
          inventoryCollection,
          offersCollection,
          claimed,
          token,
          resolution,
          now
        );
      } catch (error) {
        if (
          error instanceof
            CustomerOfferWorkflowError &&
          error.statusCode ===
            409
        ) {
          const refreshedResolution =
            await resolveRequirements(
              inventoryCollection,
              claimed
            );

          const orderOffer =
            await moveToOrderPending(
              offersCollection,
              claimed,
              token,
              refreshedResolution.requirements,
              now
            );

          return {
            offer:
              serializeOffer(
                orderOffer
              ),
            stockRequirements:
              refreshedResolution.requirements,
            message:
              "Stok işlem sırasında değişti. Teklif Sipariş adımına geçirildi.",
          };
        }

        throw error;
      }

      const installationOffer =
        await offersCollection.findOne(
          {
            _id:
              claimed._id,
          }
        );

      if (!installationOffer) {
        throw new CustomerOfferWorkflowError(
          "Montaj bekleyen teklif tekrar okunamadı.",
          500
        );
      }

      return {
        offer:
          serializeOffer(
            installationOffer
          ),
        stockRequirements:
          resolution.requirements,
        message:
          "Stok yeterli. Ürünler stoktan düşüldü ve teklif Montaj Bekliyor adımına geçirildi.",
      };
    }

    await completeOrderAndConsumeStock(
      db,
      inventoryCollection,
      offersCollection,
      claimed,
      token,
      resolution,
      options.supplierSelections,
      options.supplierPayments,
      now
    );

    const installationOffer =
      await offersCollection.findOne(
        {
          _id:
            claimed._id,
        }
      );

    if (!installationOffer) {
      throw new CustomerOfferWorkflowError(
        "Montaj bekleyen teklif tekrar okunamadı.",
        500
      );
    }

    return {
      offer:
        serializeOffer(
          installationOffer
        ),
      stockRequirements:
        installationOffer.stockRequirements ??
        resolution.requirements,
      message:
        "Sipariş tamamlandı. Eksik ürünler seçilen tedarikçilere işlendi, ürünler stoktan düşüldü ve teklif Montaj Bekliyor adımına geçirildi.",
    };
  } catch (error) {
    await releaseStockProcessingToken(
      offersCollection,
      offerId,
      token
    );

    if (
      error instanceof
      CustomerOfferWorkflowError
    ) {
      throw error;
    }

    throw new CustomerOfferWorkflowError(
      error instanceof Error
        ? error.message
        : "Teklif stok işlemi tamamlanamadı.",
      500
    );
  }
}
