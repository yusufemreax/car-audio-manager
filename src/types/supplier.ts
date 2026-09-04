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
    new Set(
      value.filter(
        isProductSupplier
      )
    )
  );

  if (
    normalized.length === 0 &&
    fallbackToEgb
  ) {
    return [...DEFAULT_PRODUCT_SUPPLIERS];
  }

  return normalized;
}

export type SupplierBalanceMovementType =
  | "manual_topup"
  | "customer_card_credit"
  | "stock_purchase_balance_usage";

export type SupplierOrderSource =
  | "manual_stock"
  | "customer_offer_order";

export type SupplierPurchasePaymentMethod =
  | "card"
  | "balance";

export interface SupplierBalanceMovement {
  id: string;
  supplier: ProductSupplier;
  type: SupplierBalanceMovementType;
  amountUsd: number;
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
  cardAmountUsd?: number;
  customerOfferId?: string;
  stockMovementId?: string;
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
