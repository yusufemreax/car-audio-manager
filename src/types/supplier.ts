export type ProductSupplier =
  | "EGB"
  | "OZDEMIR"
  | "Diğer";

export const PRODUCT_SUPPLIERS: ProductSupplier[] = [
  "EGB",
  "OZDEMIR",
  "Diğer",
];

export const DEFAULT_PRODUCT_SUPPLIERS: ProductSupplier[] = [
  "EGB",
];

export function isProductSupplier(
  value: unknown
): value is ProductSupplier {
  return (
    value === "EGB" ||
    value === "OZDEMIR" ||
    value === "Diğer"
  );
}

export function normalizeProductSuppliers(
  value: unknown,
  fallbackToEgb = true
): ProductSupplier[] {
  if (!Array.isArray(value)) {
    return fallbackToEgb
      ? [...DEFAULT_PRODUCT_SUPPLIERS]
      : [];
  }

  const normalized = Array.from(
    new Set(value.filter(isProductSupplier))
  );

  if (normalized.length === 0 && fallbackToEgb) {
    return [...DEFAULT_PRODUCT_SUPPLIERS];
  }

  return normalized;
}

export type SupplierBalanceMovementType =
  | "manual_topup"
  | "customer_card_credit"
  | "customer_card_surplus"
  | "stock_purchase_balance_usage";

export type SupplierOrderSource =
  | "manual_stock"
  | "customer_offer_order";

/**
 * card: İşletme sahibinin kendi kartı (legacy kayıtlarla uyumlu)
 * customer_card: Müşterinin kartı ile doğrudan tedarikçi/site alışverişi
 * balance: Tedarikçi bakiyesi + kalan tutar işletme sahibinin kartı
 */
export type SupplierPurchasePaymentMethod =
  | "card"
  | "customer_card"
  | "balance";

export interface SupplierBalanceMovement {
  id: string;
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
  createdAt: string;
}

export interface SupplierOrder {
  id: string;
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
  /** Kendi kartından ödenen USD. Legacy cardAmountUsd alanı aynı anlamda korunur. */
  cardAmountUsd?: number;
  /** Müşteri kartından çekilen toplam TL. */
  customerCardAmountTry?: number;
  /** Müşteri kartı çekiminin işlem kuruyla USD karşılığı. */
  customerCardChargedUsd?: number;
  /** Müşteri kartından ürün alışına uygulanan USD. */
  customerCardAppliedUsd?: number;
  /** Alıştan sonra tedarikçi/site bakiyesinde kalan USD. */
  customerCardSurplusUsd?: number;
  exchangeRate?: number;
  exchangeRateDate?: string;
  customerOfferId?: string;
  stockMovementId?: string;
  batchOrderId?: string;
  note?: string;
  createdAt: string;
}

export interface SupplierSummary {
  supplier: ProductSupplier;
  balanceUsd: number;
  orders: SupplierOrder[];
  balanceMovements: SupplierBalanceMovement[];
  createdAt: string;
  updatedAt: string;
}
