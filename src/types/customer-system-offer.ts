import {
  SystemPreparation,
} from "@/types/system-preparation";

export type CustomerSystemOfferStatus =
  | "offered"
  | "sold";

export type CustomerSystemOfferType =
  | "system"
  | "multimedia";

export interface CustomerSystemOffer {
  id: string;

  offerType: CustomerSystemOfferType;

  customerId: string;

  vehicleId: string;

  readySystemId: string;

  systemSnapshot:
    SystemPreparation;

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
