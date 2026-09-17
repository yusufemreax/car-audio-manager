import {
  SystemPreparation,
} from "@/types/system-preparation";

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
}

export interface CustomerSystemOfferPayload {
  offerType?: CustomerSystemOfferType;

  customerId: string;

  vehicleId: string;

  readySystemId: string;

  extraDiscountTry: number;
}
