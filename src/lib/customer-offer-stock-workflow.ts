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

import {
  ensureAllCustomerOfferNumbers,
} from "@/lib/customer-offer-number";

import type {
  ProductDocument,
} from "@/lib/products-collection";

import {
  getProductsByIdsWithFreshPrices,
} from "@/lib/products-service";

import {
  addCustomerCardCredit,
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

import type {
  CustomerOfferCompletionPayment,
  CustomerOfferOrderSupplierPayment,
  CustomerOfferOrderSupplierSelection,
  CustomerOfferReservedStockDecision,
  CustomerOfferStockReservationConflict,
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
  productTotalTry?: number;
  profitTry?: number;
  exchangeRate?: number;
  exchangeRateDate?: string;
}

interface CustomerOfferPaymentDocument {
  method: "cash" | "card" | "prepaid_card";
  supplier?: ProductSupplier;
  cardAmountTry: number;
  cardAmountUsd: number;
  cashAmountTry: number;
  shippingFeeTry: number;
  offerNetProfitTry: number;
  netProfitAfterShippingTry: number;
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
  customerCardAmountTry?: number;
  customerCardChargedUsd?: number;
  customerCardAppliedUsd?: number;
  customerCardSurplusUsd?: number;
  exchangeRate?: number;
  exchangeRateDate?: string;
}

interface CustomerSystemOfferDocument {
  customerId: string;
  vehicleId: string;
  status: string;
  systemSnapshot: OfferSnapshotDocument;
  offerNumber?: string;
  finalCustomerTotalTry?: number;
  finalProfitTry?: number;

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
  reservedStockDecisions?: CustomerOfferReservedStockDecision[];
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
          "customer_card" &&
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
        paymentMethod === "balance"
          ? safeMoney(payment.balanceUsedUsd)
          : 0;

      if (paymentMethod === "balance" && balanceUsedUsd <= 0) {
        throw new CustomerOfferWorkflowError(
          `${group.supplier} için bakiyeden kullanılacak USD tutarını giriniz.`,
          400
        );
      }

      if (balanceUsedUsd > group.totalUsd) {
        throw new CustomerOfferWorkflowError(
          `${group.supplier} için bakiyeden kullanılacak tutar sipariş toplamından büyük olamaz.`,
          400
        );
      }

      let cardAmountUsd = 0;
      let customerCardAmountTry = 0;
      let customerCardChargedUsd = 0;
      let customerCardAppliedUsd = 0;
      let customerCardSurplusUsd = 0;
      let paymentExchangeRate = 0;
      let paymentExchangeRateDate = "";

      if (paymentMethod === "customer_card") {
        customerCardAmountTry = safeMoney(payment.customerCardAmountTry);
        paymentExchangeRate = safeMoney(
          payment.exchangeRate ?? offer.systemSnapshot?.exchangeRate
        );
        paymentExchangeRateDate = cleanString(
          payment.exchangeRateDate ?? offer.systemSnapshot?.exchangeRateDate
        );

        if (customerCardAmountTry <= 0 || paymentExchangeRate <= 0) {
          throw new CustomerOfferWorkflowError(
            `${group.supplier} için müşteri kartından çekilen TL tutarı ve kur bilgisi zorunludur.`,
            400
          );
        }

        customerCardChargedUsd = safeMoney(
          customerCardAmountTry / paymentExchangeRate
        );

        if (customerCardChargedUsd < group.totalUsd) {
          throw new CustomerOfferWorkflowError(
            `${group.supplier} müşteri kartı çekimi sipariş toplamını karşılamıyor.`,
            400
          );
        }

        customerCardAppliedUsd = group.totalUsd;
        customerCardSurplusUsd = safeMoney(
          customerCardChargedUsd - group.totalUsd
        );

        if (customerCardSurplusUsd > 0) {
          const surplusMutation = await addCustomerCardSurplus(
            group.supplier,
            customerCardSurplusUsd,
            {
              amountTry: safeMoney(customerCardSurplusUsd * paymentExchangeRate),
              exchangeRate: paymentExchangeRate,
              exchangeRateDate: paymentExchangeRateDate || undefined,
              customerOfferId: offer._id.toString(),
              note: `Müşteri kartından sipariş sonrası kalan site bakiyesi: ${offer._id.toString()}`,
            }
          );
          balanceMutations.push(surplusMutation);
        }
      } else {
        cardAmountUsd = safeMoney(group.totalUsd - balanceUsedUsd);
      }

      if (balanceUsedUsd > 0) {
        const currentBalanceUsd = await getSupplierBalance(group.supplier);

        if (balanceUsedUsd > currentBalanceUsd) {
          throw new CustomerOfferWorkflowError(
            `${group.supplier} bakiyesi yetersiz. Mevcut bakiye: $${currentBalanceUsd.toFixed(2)}`,
            400
          );
        }

        const balanceMutation = await useSupplierBalanceForStock(
          group.supplier,
          balanceUsedUsd,
          {
            customerOfferId: offer._id.toString(),
            note: `Müşteri teklifi sipariş bakiye kullanımı: ${offer._id.toString()}`,
          }
        );
        balanceMutations.push(balanceMutation);
      }

      orderSupplierPayments.push({
        supplier: group.supplier,
        paymentMethod,
        orderTotalUsd: group.totalUsd,
        balanceUsedUsd,
        cardAmountUsd,
        ...(paymentMethod === "customer_card"
          ? {
              customerCardAmountTry,
              customerCardChargedUsd,
              customerCardAppliedUsd,
              customerCardSurplusUsd,
              exchangeRate: paymentExchangeRate,
              ...(paymentExchangeRateDate
                ? { exchangeRateDate: paymentExchangeRateDate }
                : {}),
            }
          : {}),
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
          paymentMethod === "customer_card"
            ? 0
            : safeMoney(
                item.totalUsd - allocatedBalance
              );

        const allocatedCustomerCard =
          paymentMethod === "customer_card"
            ? item.totalUsd
            : 0;

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
            ...(safeMoney(offer.systemSnapshot?.exchangeRate) > 0
              ? { exchangeRate: safeMoney(offer.systemSnapshot?.exchangeRate) }
              : {}),
            ...(cleanString(offer.systemSnapshot?.exchangeRateDate)
              ? { exchangeRateDate: cleanString(offer.systemSnapshot?.exchangeRateDate) }
              : {}),
            ...(paymentMethod === "customer_card"
              ? {
                  customerCardAmountTry,
                  customerCardChargedUsd,
                  customerCardAppliedUsd: allocatedCustomerCard,
                  customerCardSurplusUsd: index === 0 ? customerCardSurplusUsd : 0,
                }
              : {}),
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
  offer: WithId<CustomerSystemOfferDocument>,
  payment: CustomerOfferCompletionPayment | undefined,
  now: Date
): CustomerOfferPaymentDocument {
  if (!payment) {
    throw new CustomerOfferWorkflowError(
      "Ödeme bilgisi zorunludur.",
      400
    );
  }

  const totalTry = Math.max(0, safeMoney(offer.finalCustomerTotalTry));
  const productTotalTry = Math.max(
    0,
    safeMoney(offer.systemSnapshot?.productTotalTry)
  );
  const shippingFeeTry = safeMoney(payment.shippingFeeTry);

  if (shippingFeeTry < 0) {
    throw new CustomerOfferWorkflowError(
      "Kargo ücreti negatif olamaz.",
      400
    );
  }

  /*
   * Müşteri teklifindeki GERÇEK net kazanç.
   * Nihai müşteri toplamı müşteri indirimini de içerir. Bu nedenle
   * ürün maliyetini nihai toplamdan çıkarmak teklif ekranındaki net
   * kazancı doğrudan verir. Ciroya kargo düşülmüş snapshot yazılır.
   */
  const storedFinalProfitTry = Number(offer.finalProfitTry);
  const offerNetProfitTry = Number.isFinite(storedFinalProfitTry)
    ? roundMoney(storedFinalProfitTry)
    : roundMoney(totalTry - productTotalTry);
  const netProfitAfterShippingTry = roundMoney(
    offerNetProfitTry - shippingFeeTry
  );

  const base = {
    shippingFeeTry,
    offerNetProfitTry,
    netProfitAfterShippingTry,
    completedAt: now,
  };

  if (payment.method === "cash") {
    return {
      method: "cash",
      cardAmountTry: 0,
      cardAmountUsd: 0,
      cashAmountTry: totalTry,
      ...base,
    };
  }

  if (payment.method === "prepaid_card") {
    const prepaidCardTry = safeMoney(payment.cardAmountTry);

    if (prepaidCardTry <= 0) {
      throw new CustomerOfferWorkflowError(
        "Önceden çekilen kart tutarı 0'dan büyük olmalıdır.",
        400
      );
    }
    if (prepaidCardTry > totalTry) {
      throw new CustomerOfferWorkflowError(
        "Önceden çekilen kart tutarı teklif toplamından büyük olamaz.",
        400
      );
    }

    return {
      method: "prepaid_card",
      cardAmountTry: prepaidCardTry,
      cardAmountUsd: 0,
      cashAmountTry: roundMoney(Math.max(totalTry - prepaidCardTry, 0)),
      ...base,
    };
  }

  if (payment.method !== "card") {
    throw new CustomerOfferWorkflowError(
      "Geçerli ödeme yöntemi seçiniz.",
      400
    );
  }

  if (!isProductSupplier(payment.supplier)) {
    throw new CustomerOfferWorkflowError(
      "Kart ödemesi için tedarikçi seçiniz.",
      400
    );
  }

  const cardAmountTry = safeMoney(payment.cardAmountTry);
  const cardAmountUsd = safeMoney(payment.cardAmountUsd);

  if (cardAmountTry <= 0 || cardAmountTry > totalTry) {
    throw new CustomerOfferWorkflowError(
      "Karttan çekilen TL tutarı 0'dan büyük ve teklif toplamını aşmayacak şekilde olmalıdır.",
      400
    );
  }
  if (cardAmountUsd <= 0) {
    throw new CustomerOfferWorkflowError(
      "Tedarikçi bakiyesine girecek USD tutarı 0'dan büyük olmalıdır.",
      400
    );
  }

  const exchangeRate = safeMoney(payment.exchangeRate);
  const exchangeRateDate = cleanString(payment.exchangeRateDate);

  return {
    method: "card",
    supplier: payment.supplier,
    cardAmountTry,
    cardAmountUsd,
    cashAmountTry: roundMoney(Math.max(totalTry - cardAmountTry, 0)),
    ...base,
    ...(exchangeRate > 0 ? { exchangeRate } : {}),
    ...(exchangeRateDate ? { exchangeRateDate } : {}),
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
  /*
   * Yeni ve eski tüm tekliflerin sistem genelinde kalıcı
   * bir teklif numarası bulunmasını garanti eder. Yeni teklif
   * oluşturulduktan sonra liste yenilendiğinde numara otomatik
   * atanır; eski kayıtlar da ilk listelenmelerinde tamamlanır.
   */
  await ensureAllCustomerOfferNumbers();

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

/*
 * =======================================================
 * INSTALLATION RESERVATION / DELAYED STOCK CONSUMPTION
 * =======================================================
 *
 * Yeni akışta installation_pending fiziksel stok çıkışı değildir; bir
 * rezervasyondur. Gerçek stok çıkışı complete-sale (montaj tamamlandı) anında
 * yapılır. Eski kayıtlarda stockDeductedAt bulunan installation_pending
 * teklifler zaten stoktan düşüldüğü için rezervasyon hesabına dahil edilmez.
 */
function getReservedStockDecisionMap(
  decisions: CustomerOfferReservedStockDecision[] | undefined
) {
  const result = new Map<string, CustomerOfferReservedStockDecision["decision"]>();

  for (const decision of decisions ?? []) {
    const productId = cleanString(decision?.productId);
    if (!productId) {
      continue;
    }

    if (decision.decision !== "order" && decision.decision !== "use_stock") {
      continue;
    }

    result.set(productId, decision.decision);
  }

  return result;
}

async function getInstallationReservationQuantities(
  offersCollection: Collection<CustomerSystemOfferDocument>,
  currentOfferId: ObjectId
) {
  const reservedByProductId = new Map<string, number>();

  const pendingOffers = await offersCollection
    .find(
      {
        _id: { $ne: currentOfferId },
        status: "installation_pending",
        // MongoDB Driver tipinde stockDeductedAt Date | undefined.
        // $not + $type ile hem alani olmayan/null kayitlari yeni rezervasyon
        // akimina dahil ediyor, hem de Date bulunan eski (stoktan dusulmus)
        // kayitlari disarida birakiyoruz.
        stockDeductedAt: { $not: { $type: "date" } },
      },
      {
        projection: {
          systemSnapshot: 1,
        },
      }
    )
    .toArray();

  for (const pendingOffer of pendingOffers) {
    try {
      const reservedProducts = getRequiredProducts(pendingOffer);

      for (const reservedProduct of reservedProducts) {
        reservedByProductId.set(
          reservedProduct.productId,
          (reservedByProductId.get(reservedProduct.productId) ?? 0) +
            reservedProduct.requiredQuantity
        );
      }
    } catch (error) {
      // Eski/bozuk bir snapshot yeni satış akışını tamamen durdurmasın.
      console.error(
        `Montaj rezervasyonu okunamadı. OfferId=${pendingOffer._id.toString()}`,
        error
      );
    }
  }

  return reservedByProductId;
}

async function resolveStartSaleRequirements(
  inventoryCollection: Collection<InventoryDocument>,
  offersCollection: Collection<CustomerSystemOfferDocument>,
  offer: WithId<CustomerSystemOfferDocument>
): Promise<RequirementResolution> {
  const resolution = await resolveRequirements(inventoryCollection, offer);
  const reservedByProductId = await getInstallationReservationQuantities(
    offersCollection,
    offer._id
  );

  const requirements = resolution.requirements.map((requirement) => {
    const reservedQuantity = Math.max(
      0,
      Math.trunc(reservedByProductId.get(requirement.productId) ?? 0)
    );
    const freeQuantity = Math.max(
      requirement.availableQuantity - reservedQuantity,
      0
    );

    // Fiziksel stokta mevcut olup diğer montajlar nedeniyle serbest olmayan
    // miktar. Fiziksel eksik (missingQuantity) ile çakışmaz; ayrı hesaplanır.
    const reservationConflictQuantity = Math.max(
      Math.min(requirement.requiredQuantity, requirement.availableQuantity) -
        freeQuantity,
      0
    );

    return {
      ...requirement,
      reservedQuantity,
      freeQuantity,
      reservationConflictQuantity,
    };
  });

  return {
    ...resolution,
    requirements,
  };
}

function getReservationConflicts(
  requirements: CustomerOfferStockRequirement[]
): CustomerOfferStockReservationConflict[] {
  return requirements
    .filter((requirement) => (requirement.reservationConflictQuantity ?? 0) > 0)
    .map((requirement) => ({
      productId: requirement.productId,
      ...(requirement.productCode
        ? { productCode: requirement.productCode }
        : {}),
      ...(requirement.brand ? { brand: requirement.brand } : {}),
      ...(requirement.model ? { model: requirement.model } : {}),
      requiredQuantity: requirement.requiredQuantity,
      availableQuantity: requirement.availableQuantity,
      reservedQuantity: requirement.reservedQuantity ?? 0,
      freeQuantity: requirement.freeQuantity ?? requirement.availableQuantity,
      conflictQuantity: requirement.reservationConflictQuantity ?? 0,
    }));
}

function applyReservedStockDecisions(
  requirements: CustomerOfferStockRequirement[],
  decisions: CustomerOfferReservedStockDecision[] | undefined
) {
  const decisionMap = getReservedStockDecisionMap(decisions);

  return requirements.map((requirement) => {
    const conflictQuantity = Math.max(
      0,
      requirement.reservationConflictQuantity ?? 0
    );
    const decision = decisionMap.get(requirement.productId);
    const additionalOrderQuantity =
      conflictQuantity > 0 && decision === "order" ? conflictQuantity : 0;
    const missingQuantity =
      requirement.missingQuantity + additionalOrderQuantity;

    return {
      ...requirement,
      missingQuantity,
      missingTotalUsd: safeMoney(requirement.unitPriceUsd * missingQuantity),
    };
  });
}

async function moveToInstallationPendingWithoutStockDeduction(
  offersCollection: Collection<CustomerSystemOfferDocument>,
  offer: WithId<CustomerSystemOfferDocument>,
  token: string,
  requirements: CustomerOfferStockRequirement[],
  now: Date
) {
  const updateResult = await offersCollection.updateOne(
    {
      _id: offer._id,
      stockProcessingToken: token,
    },
    {
      $set: {
        status: "installation_pending",
        stockRequirements: requirements,
        installationPendingAt: offer.installationPendingAt ?? now,
        updatedAt: now,
      },
      $unset: {
        stockProcessingToken: "",
        stockProcessingAt: "",
        stockDeductedAt: "",
      },
    }
  );

  if (updateResult.modifiedCount !== 1) {
    throw new CustomerOfferWorkflowError(
      "Teklif Montaj Bekliyor durumuna geçirilemedi.",
      500
    );
  }

  const updatedOffer = await offersCollection.findOne({ _id: offer._id });
  if (!updatedOffer) {
    throw new CustomerOfferWorkflowError(
      "Montaj bekleyen teklif tekrar okunamadı.",
      500
    );
  }

  return updatedOffer;
}

function mergeStoredOrderRequirements(
  currentRequirements: CustomerOfferStockRequirement[],
  storedRequirements: CustomerOfferStockRequirement[] | undefined
) {
  if (!Array.isArray(storedRequirements) || storedRequirements.length === 0) {
    return currentRequirements;
  }

  const storedByProductId = new Map(
    storedRequirements.map((requirement) => [requirement.productId, requirement])
  );

  return currentRequirements.map((current) => {
    const stored = storedByProductId.get(current.productId);
    if (!stored) {
      return current;
    }

    const missingQuantity = Math.max(
      0,
      Math.trunc(Number(stored.missingQuantity) || 0)
    );

    return {
      ...current,
      missingQuantity,
      missingTotalUsd: safeMoney(current.unitPriceUsd * missingQuantity),
      ...(typeof stored.reservedQuantity === "number"
        ? { reservedQuantity: stored.reservedQuantity }
        : {}),
      ...(typeof stored.freeQuantity === "number"
        ? { freeQuantity: stored.freeQuantity }
        : {}),
      ...(typeof stored.reservationConflictQuantity === "number"
        ? {
            reservationConflictQuantity:
              stored.reservationConflictQuantity,
          }
        : {}),
    };
  });
}

function buildStoredOrderResolution(
  resolution: RequirementResolution,
  offer: WithId<CustomerSystemOfferDocument>
): RequirementResolution {
  return {
    ...resolution,
    requirements: mergeStoredOrderRequirements(
      resolution.requirements,
      offer.stockRequirements
    ),
  };
}

/**
 * Mevcut sipariş/tedarikçi/ödeme altyapısını aynen kullanır; mevcut fonksiyonun
 * yaptığı stok tüketimini request sonunda geri alır. Böylece sadece sipariş
 * edilen ürünlerin stok girişi kalır, gerçek stok çıkışı montaj tamamlanana
 * ertelenir.
 */
async function completeOrderAndKeepProductsInInventory(
  db: Db,
  inventoryCollection: Collection<InventoryDocument>,
  offersCollection: Collection<CustomerSystemOfferDocument>,
  offer: WithId<CustomerSystemOfferDocument>,
  token: string,
  resolution: RequirementResolution,
  supplierSelections: CustomerOfferOrderSupplierSelection[] | undefined,
  supplierPayments: CustomerOfferOrderSupplierPayment[] | undefined,
  now: Date
) {
  const quantityBeforeByProductId = new Map<string, number>();

  for (const requirement of resolution.requirements) {
    const inventory = resolution.inventoryByProductId.get(requirement.productId);
    quantityBeforeByProductId.set(
      requirement.productId,
      Math.max(0, Number(inventory?.quantity ?? 0) || 0)
    );
  }

  await completeOrderAndConsumeStock(
    db,
    inventoryCollection,
    offersCollection,
    offer,
    token,
    resolution,
    supplierSelections,
    supplierPayments,
    now
  );

  /*
   * Mevcut fonksiyon tedarikçi siparişi, ödeme kayıtları ve stok girişini doğru
   * şekilde oluşturuyor; ancak aynı request içinde teklif ürünlerini de stoktan
   * çıkarıyor. Aşağıdaki düzeltme yalnızca o erken tüketimi geri alır.
   *
   * hedef stok = işlem öncesi fiziksel stok + gerçekten sipariş edilen miktar
   */
  const corrections: Array<{ inventoryId: ObjectId; quantity: number }> = [];

  try {
    for (const requirement of resolution.requirements) {
      const previousQuantity =
        quantityBeforeByProductId.get(requirement.productId) ?? 0;
      const legacyFinalQuantity = Math.max(
        previousQuantity - requirement.requiredQuantity,
        0
      );
      const targetQuantity = previousQuantity + requirement.missingQuantity;
      const correctionQuantity = targetQuantity - legacyFinalQuantity;

      if (correctionQuantity === 0) {
        continue;
      }

      const currentInventory = await ensureInventoryDocument(
        inventoryCollection,
        requirement.productId,
        now
      );

      const correctionResult = await inventoryCollection.updateOne(
        { _id: currentInventory._id },
        {
          $inc: { quantity: correctionQuantity },
          $set: { updatedAt: now },
        }
      );

      if (correctionResult.modifiedCount !== 1) {
        throw new CustomerOfferWorkflowError(
          `${requirement.brand ?? ""} ${requirement.model ?? ""} sipariş stok girişi korunamadı.`.trim(),
          500
        );
      }

      corrections.push({
        inventoryId: currentInventory._id,
        quantity: correctionQuantity,
      });
    }

    const keptRequirements = resolution.requirements.map((requirement) => {
      const previousQuantity =
        quantityBeforeByProductId.get(requirement.productId) ?? 0;
      const availableQuantity = previousQuantity + requirement.missingQuantity;

      return {
        ...requirement,
        availableQuantity,
        missingQuantity: 0,
        missingTotalUsd: 0,
      };
    });

    const offerUpdate = await offersCollection.updateOne(
      { _id: offer._id },
      {
        $set: {
          status: "installation_pending",
          stockRequirements: keptRequirements,
          installationPendingAt: now,
          updatedAt: now,
        },
        $unset: {
          stockDeductedAt: "",
          stockProcessingToken: "",
          stockProcessingAt: "",
        },
      }
    );

    if (offerUpdate.modifiedCount !== 1) {
      throw new CustomerOfferWorkflowError(
        "Sipariş tamamlandı ancak teklif Montaj Bekliyor durumuna güvenli şekilde alınamadı.",
        500
      );
    }

    // Eski fonksiyonun yazdığı erken stok çıkış hareketini temizlemek yalnızca
    // log düzeltmesidir. Ana stok işlemini bunun yüzünden geri çevirmiyoruz.
    try {
      await db
        .collection<StockMovementDocument>(STOCK_MOVEMENTS_COLLECTION)
        .deleteMany({
          offerId: offer._id.toString(),
          type: "out",
          createdAt: now,
        });
    } catch (movementError) {
      console.error(
        `Erken stok çıkış hareketi temizlenemedi. OfferId=${offer._id.toString()}`,
        movementError
      );
    }
  } catch (error) {
    // Düzeltme aşaması tamamlanamadıysa mevcut completeOrderAndConsumeStock
    // fonksiyonunun oluşturduğu tutarlı eski duruma geri dön.
    for (const correction of corrections.reverse()) {
      await inventoryCollection.updateOne(
        { _id: correction.inventoryId },
        {
          $inc: { quantity: -correction.quantity },
          $set: { updatedAt: new Date() },
        }
      );
    }

    throw error;
  }
}

/** Gerçek stok çıkışı yalnızca montaj tamamlanırken çağrılır. */
async function deductInstallationStock(
  db: Db,
  inventoryCollection: Collection<InventoryDocument>,
  offersCollection: Collection<CustomerSystemOfferDocument>,
  offer: WithId<CustomerSystemOfferDocument>,
  token: string,
  resolution: RequirementResolution,
  now: Date
) {
  const deducted: Array<{
    inventoryId: ObjectId;
    quantity: number;
    previousQuantity: number;
    productId: string;
  }> = [];

  try {
    for (const requirement of resolution.requirements) {
      const inventory = resolution.inventoryByProductId.get(requirement.productId);

      if (!inventory) {
        throw new CustomerOfferWorkflowError(
          `${requirement.brand ?? ""} ${requirement.model ?? ""} ürünü stokta bulunamadı. Montaj tamamlanamaz.`.trim(),
          409,
          { stockRequirements: resolution.requirements }
        );
      }

      const previousQuantity = Math.max(
        0,
        Number(inventory.quantity) || 0
      );

      const updateResult = await inventoryCollection.updateOne(
        {
          _id: inventory._id,
          quantity: { $gte: requirement.requiredQuantity },
        },
        {
          $inc: { quantity: -requirement.requiredQuantity },
          $set: { updatedAt: now },
        }
      );

      if (updateResult.modifiedCount !== 1) {
        throw new CustomerOfferWorkflowError(
          `${requirement.brand ?? ""} ${requirement.model ?? ""} ürünü için montaj anında yeterli stok kalmadı.`.trim(),
          409,
          { stockRequirements: resolution.requirements }
        );
      }

      deducted.push({
        inventoryId: inventory._id,
        quantity: requirement.requiredQuantity,
        previousQuantity,
        productId: requirement.productId,
      });
    }

    const offerUpdate = await offersCollection.updateOne(
      {
        _id: offer._id,
        stockProcessingToken: token,
      },
      {
        $set: {
          stockRequirements: resolution.requirements,
          stockDeductedAt: now,
          updatedAt: now,
        },
        $unset: {
          stockProcessingToken: "",
          stockProcessingAt: "",
        },
      }
    );

    if (offerUpdate.modifiedCount !== 1) {
      throw new CustomerOfferWorkflowError(
        "Montaj stok çıkışı teklif üzerine işlenemedi.",
        500
      );
    }

    const offerId = offer._id.toString();
    await writeStockMovements(
      db,
      deducted.map((item) => ({
        productId: item.productId,
        type: "out",
        quantity: item.quantity,
        previousQuantity: item.previousQuantity,
        newQuantity: item.previousQuantity - item.quantity,
        note: `Montaj tamamlandı - müşteri teklifi stok çıkışı: ${offerId}`,
        offerId,
        createdAt: now,
      }))
    );
  } catch (error) {
    for (const item of deducted.reverse()) {
      await inventoryCollection.updateOne(
        { _id: item.inventoryId },
        {
          $inc: { quantity: item.quantity },
          $set: { updatedAt: new Date() },
        }
      );
    }

    throw error;
  }
}

export async function getCustomerOfferWorkflowDetail(
  id: string
): Promise<CustomerOfferWorkflowResult> {
  const offerId = getOfferObjectId(id);
  const { offersCollection, inventoryCollection } = await getCollections();

  const offer = await offersCollection.findOne({ _id: offerId });
  if (!offer) {
    throw new CustomerOfferWorkflowError("Teklif bulunamadı.", 404);
  }

  const resolution = await resolveRequirements(inventoryCollection, offer);
  const requirements =
    offer.status === "order_pending"
      ? mergeStoredOrderRequirements(
          resolution.requirements,
          offer.stockRequirements
        )
      : resolution.requirements;

  return {
    offer: serializeOffer(offer),
    stockRequirements: requirements,
    message: "Teklif detayı alındı.",
  };
}

export async function runCustomerOfferWorkflow(
  id: string,
  action: CustomerOfferWorkflowAction,
  options: CustomerOfferWorkflowOptions = {}
): Promise<CustomerOfferWorkflowResult> {
  const offerId = getOfferObjectId(id);
  const { db, offersCollection, inventoryCollection } = await getCollections();
  const now = new Date();

  /*
   * complete-sale artık iki aşamalıdır:
   * 1) Montaj tamamlandığı anda gerçek stok çıkışı.
   * 2) Mevcut ödeme/satış tamamlama işlemi.
   *
   * Stok çıkışı başarılı, ödeme tarafı başarısız olursa stockDeductedAt kalır;
   * tekrar denemede stok ikinci kez düşülmez ve yalnızca ödeme devam eder.
   */
  if (action === "complete-sale") {
    const currentOffer = await offersCollection.findOne({ _id: offerId });
    if (!currentOffer) {
      throw new CustomerOfferWorkflowError("Teklif bulunamadı.", 404);
    }

    if (isFinalSoldOffer(currentOffer)) {
      return {
        offer: serializeOffer(currentOffer),
        stockRequirements: currentOffer.stockRequirements ?? [],
        message: "Teklif zaten Satıldı durumunda.",
      };
    }

    if (currentOffer.status !== "installation_pending") {
      throw new CustomerOfferWorkflowError(
        "Yalnızca Montaj Bekliyor durumundaki teklif satış olarak tamamlanabilir.",
        409
      );
    }

    if (!currentOffer.stockDeductedAt) {
      const stockToken = randomUUID();
      const stockClaimed = await claimStockOffer(
        offersCollection,
        offerId,
        ["installation_pending"],
        stockToken,
        now
      );

      if (!stockClaimed.stockDeductedAt) {
        try {
          const stockResolution = await resolveRequirements(
            inventoryCollection,
            stockClaimed
          );

          if (hasShortage(stockResolution.requirements)) {
            throw new CustomerOfferWorkflowError(
              "Montaj tamamlanamadı. Teklif ürünlerinden en az biri için fiziksel stok yetersiz.",
              409,
              {
                stockRequirements: stockResolution.requirements,
                offer: serializeOffer(stockClaimed),
              }
            );
          }

          await deductInstallationStock(
            db,
            inventoryCollection,
            offersCollection,
            stockClaimed,
            stockToken,
            stockResolution,
            now
          );
        } catch (error) {
          await releaseStockProcessingToken(
            offersCollection,
            offerId,
            stockToken
          );

          if (error instanceof CustomerOfferWorkflowError) {
            throw error;
          }

          throw new CustomerOfferWorkflowError(
            error instanceof Error
              ? error.message
              : "Montaj stok çıkışı tamamlanamadı.",
            500
          );
        }
      }
    }

    const paymentToken = randomUUID();
    const claimed = await claimPaymentOffer(
      offersCollection,
      offerId,
      paymentToken,
      now
    );

    if (isFinalSoldOffer(claimed)) {
      return {
        offer: serializeOffer(claimed),
        stockRequirements: claimed.stockRequirements ?? [],
        message: "Teklif zaten Satıldı durumunda.",
      };
    }

    try {
      await completeSale(
        offersCollection,
        claimed,
        paymentToken,
        options.payment,
        now
      );

      const soldOffer = await offersCollection.findOne({ _id: claimed._id });
      if (!soldOffer) {
        throw new CustomerOfferWorkflowError(
          "Satılan teklif tekrar okunamadı.",
          500
        );
      }

      return {
        offer: serializeOffer(soldOffer),
        stockRequirements: soldOffer.stockRequirements ?? [],
        message: "Montaj tamamlandı, ürünler stoktan düşüldü ve satış tamamlandı.",
      };
    } catch (error) {
      await releasePaymentProcessingToken(
        offersCollection,
        offerId,
        paymentToken
      );

      if (error instanceof CustomerOfferWorkflowError) {
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

  if (action !== "start-sale" && action !== "order-completed") {
    throw new CustomerOfferWorkflowError("Geçersiz teklif workflow işlemi.", 400);
  }

  const allowedStatuses =
    action === "start-sale" ? ["offered", "sold"] : ["order_pending"];

  const token = randomUUID();
  const claimed = await claimStockOffer(
    offersCollection,
    offerId,
    allowedStatuses,
    token,
    now
  );

  if (claimed.stockDeductedAt) {
    return {
      offer: serializeOffer(claimed),
      stockRequirements: claimed.stockRequirements ?? [],
      message: "Stok işlemi daha önce tamamlanmış.",
    };
  }

  try {
    if (action === "start-sale") {
      const reservationResolution = await resolveStartSaleRequirements(
        inventoryCollection,
        offersCollection,
        claimed
      );
      const reservationConflicts = getReservationConflicts(
        reservationResolution.requirements
      );
      const decisionMap = getReservedStockDecisionMap(
        options.reservedStockDecisions
      );
      const unresolvedConflicts = reservationConflicts.filter(
        (conflict) => !decisionMap.has(conflict.productId)
      );

      if (unresolvedConflicts.length > 0) {
        await releaseStockProcessingToken(
          offersCollection,
          offerId,
          token
        );

        return {
          offer: {
            ...serializeOffer(claimed),
            stockDecisionRequired: true,
            reservationConflicts,
          },
          stockRequirements: reservationResolution.requirements,
          message:
            "Bazı ürünler stokta görünüyor ancak montaj bekleyen teklifler için ayrılmış. Sipariş veya mevcut stok kullanım tercihi gerekiyor.",
        };
      }

      const decidedRequirements = applyReservedStockDecisions(
        reservationResolution.requirements,
        options.reservedStockDecisions
      );

      if (hasShortage(decidedRequirements)) {
        const orderOffer = await moveToOrderPending(
          offersCollection,
          claimed,
          token,
          decidedRequirements,
          now
        );

        return {
          offer: serializeOffer(orderOffer),
          stockRequirements: decidedRequirements,
          message:
            "Sipariş gerektiren ürün bulundu. Teklif Sipariş adımına geçirildi.",
        };
      }

      const installationOffer =
        await moveToInstallationPendingWithoutStockDeduction(
          offersCollection,
          claimed,
          token,
          decidedRequirements,
          now
        );

      return {
        offer: serializeOffer(installationOffer),
        stockRequirements: decidedRequirements,
        message:
          "Ürünler montaj için ayrıldı. Fiziksel stok, montaj tamamlanana kadar düşülmeyecek.",
      };
    }

    const currentResolution = await resolveRequirements(
      inventoryCollection,
      claimed
    );
    const orderResolution = buildStoredOrderResolution(
      currentResolution,
      claimed
    );

    await completeOrderAndKeepProductsInInventory(
      db,
      inventoryCollection,
      offersCollection,
      claimed,
      token,
      orderResolution,
      options.supplierSelections,
      options.supplierPayments,
      now
    );

    const installationOffer = await offersCollection.findOne({
      _id: claimed._id,
    });
    if (!installationOffer) {
      throw new CustomerOfferWorkflowError(
        "Montaj bekleyen teklif tekrar okunamadı.",
        500
      );
    }

    return {
      offer: serializeOffer(installationOffer),
      stockRequirements:
        installationOffer.stockRequirements ?? orderResolution.requirements,
      message:
        "Sipariş tamamlandı. Sipariş edilen ürünler stoğa eklendi; stoktan çıkış yapılmadan teklif Montaj Bekliyor adımına geçirildi.",
    };
  } catch (error) {
    await releaseStockProcessingToken(offersCollection, offerId, token);

    if (error instanceof CustomerOfferWorkflowError) {
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
