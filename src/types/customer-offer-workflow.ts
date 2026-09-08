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
  customerCardAmountTry?: number;
  exchangeRate?: number;
  exchangeRateDate?: string;
}

export type CustomerOfferPaymentMethod =
  | "cash"
  | "card"
  | "prepaid_card";

export interface CustomerOfferCompletionPayment {
  method: CustomerOfferPaymentMethod;
  supplier?: ProductSupplier;
  /** Kart veya önceden çekilen kart için müşteri kartından çekilen TL. */
  cardAmountTry: number;
  /** Sadece montaj anında yeni kart çekiminde siteye yüklenecek USD. */
  cardAmountUsd: number;
  /** Backend tekrar hesaplar; client yalnızca önizleme amaçlı gönderir. */
  cashAmountTry: number;
  shippingFeeTry: number;
  exchangeRate?: number;
  exchangeRateDate?: string;
}

export interface CustomerOfferWorkflowRequest {
  action: CustomerOfferWorkflowAction;
  supplierSelections?: CustomerOfferOrderSupplierSelection[];
  supplierPayments?: CustomerOfferOrderSupplierPayment[];
  payment?: CustomerOfferCompletionPayment;
}
