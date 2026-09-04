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
  | "card";

export interface CustomerOfferCompletionPayment {
  method: CustomerOfferPaymentMethod;
  supplier?: ProductSupplier;
  cardAmountTry: number;
  cardAmountUsd: number;
  cashAmountTry: number;
  exchangeRate?: number;
  exchangeRateDate?: string;
}

export interface CustomerOfferWorkflowRequest {
  action: CustomerOfferWorkflowAction;
  supplierSelections?: CustomerOfferOrderSupplierSelection[];
  supplierPayments?: CustomerOfferOrderSupplierPayment[];
  payment?: CustomerOfferCompletionPayment;
}
