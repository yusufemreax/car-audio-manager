import {
  SystemPreparation,
} from "@/types/system-preparation";

import type {
  ProductSupplier,
  SupplierPurchasePaymentMethod,
} from "@/types/supplier";

export type CustomerSystemOfferStatus =
  | "offered"
  | "order_pending"
  | "installation_pending"
  | "sold"
  | "completed";

export type CustomerSystemOfferType =
  | "system"
  | "multimedia";

export type CustomerOfferSystemSnapshot =
  SystemPreparation & {
    additionalDescription?: string;
  };

export interface CustomerOfferOrderSupplierPaymentRecord {
  customerOfferId?: string;
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

export interface CustomerSystemOffer {
  id: string;

  offerType: CustomerSystemOfferType;

  customerId: string;

  vehicleId: string;

  readySystemId: string;

  systemSnapshot:
    CustomerOfferSystemSnapshot;

  extraDiscountTry: number;

  finalCustomerTotalTry: number;

  finalProfitTry: number;

  status:
    CustomerSystemOfferStatus;

  createdAt: string;

  updatedAt: string;

  soldAt?: string;

  orderSupplierPayments?:
    CustomerOfferOrderSupplierPaymentRecord[];
}

export interface CustomerSystemOfferPayload {
  offerType?: CustomerSystemOfferType;

  customerId: string;

  vehicleId: string;

  readySystemId: string;

  extraDiscountTry: number;
}
