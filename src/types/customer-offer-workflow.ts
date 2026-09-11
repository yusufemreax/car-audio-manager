import type {
  ProductSupplier,
  SupplierPurchasePaymentMethod,
} from "@/types/supplier";

export type CustomerOfferWorkflowStage =
  | "order_pending"
  | "installation_pending"
  | "sold"
  | "completed";

export type CustomerOfferWorkflowAction =
  | "start-sale"
  | "order-completed"
  | "complete-sale";

export interface CustomerOfferStockRequirement {
  productId: string;
  productCode?: string;
  brand?: string;
  model?: string;
  requiredQuantity: number;
  availableQuantity: number;
  missingQuantity: number;
  unitPriceUsd: number;
  missingTotalUsd: number;
  suppliers: ProductSupplier[];
  /** Montaj bekleyen diğer tekliflerin ayırdığı toplam miktar. */
  reservedQuantity?: number;
  /** Fiziksel stoktan rezervasyonlar çıkarıldıktan sonra serbest kalan miktar. */
  freeQuantity?: number;
  /** Bu teklif için sipariş/stok kullanımı kararı gereken miktar. */
  reservationConflictQuantity?: number;
}

export type CustomerOfferReservedStockDecisionValue =
  | "order"
  | "use_stock";

export interface CustomerOfferReservedStockDecision {
  productId: string;
  decision: CustomerOfferReservedStockDecisionValue;
}

export interface CustomerOfferStockReservationConflict {
  productId: string;
  productCode?: string;
  brand?: string;
  model?: string;
  requiredQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  freeQuantity: number;
  conflictQuantity: number;
}

export interface CustomerOfferOrderSupplierSelection {
  productId: string;
  supplier: ProductSupplier;
}

export interface CustomerOfferOrderSupplierPayment {
  supplier: ProductSupplier;
  paymentMethod: SupplierPurchasePaymentMethod;
  balanceUsedUsd: number;
}

export type CustomerOfferPaymentMethod =
  | "cash"
  | "card"
  | "prepaid_card";

export interface CustomerOfferCompletionPayment {
  method: CustomerOfferPaymentMethod;
  supplier?: ProductSupplier;
  cardAmountTry: number;
  cardAmountUsd: number;
  cashAmountTry: number;

  shippingFeeTry?: number;

  exchangeRate?: number;
  exchangeRateDate?: string;
}

export interface CustomerOfferWorkflowRequest {
  action: CustomerOfferWorkflowAction;
  supplierSelections?: CustomerOfferOrderSupplierSelection[];
  supplierPayments?: CustomerOfferOrderSupplierPayment[];
  payment?: CustomerOfferCompletionPayment;
  reservedStockDecisions?: CustomerOfferReservedStockDecision[];
  /** 404 ile satışta değil işaretlenen eksik ürünlerle Sipariş adımına devam onayı. */
  confirmUnavailableOrderProducts?: boolean;
}
