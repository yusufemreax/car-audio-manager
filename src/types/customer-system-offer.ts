import {
  SystemPreparation,
} from "@/types/system-preparation";

export type CustomerSystemOfferStatus =
  | "offered"
  | "sold";

export interface CustomerSystemOffer {
  id: string;

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
  customerId: string;

  vehicleId: string;

  readySystemId: string;

  extraDiscountTry: number;
}