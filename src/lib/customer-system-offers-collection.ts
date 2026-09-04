import {
  Collection,
  ObjectId,
  WithId,
} from "mongodb";

import {
  getDatabase,
} from "@/lib/mongodb";

import {
  SystemPreparation,
} from "@/types/system-preparation";

import {
  CustomerSystemOffer,
  CustomerSystemOfferStatus,
} from "@/types/customer-system-offer";

export interface CustomerSystemOfferDocument {
  customerId: ObjectId;

  vehicleId: string;

  readySystemId: ObjectId;

  systemSnapshot:
    SystemPreparation;

  extraDiscountTry: number;

  finalCustomerTotalTry: number;

  finalProfitTry: number;

  status:
    CustomerSystemOfferStatus;

  createdAt: Date;

  updatedAt: Date;

  soldAt?: Date;
}

let indexesReady:
  | Promise<unknown>
  | null = null;

export async function getCustomerSystemOffersCollection(): Promise<
  Collection<CustomerSystemOfferDocument>
> {
  const database =
    await getDatabase();

  const collection =
    database.collection<CustomerSystemOfferDocument>(
      "customerSystemOffers"
    );

  if (!indexesReady) {
    indexesReady =
      Promise.all([
        collection.createIndex(
          {
            customerId: 1,
            vehicleId: 1,
            status: 1,
          },
          {
            name:
              "ix_customerSystemOffers_customer_vehicle_status",
          }
        ),

        collection.createIndex(
          {
            readySystemId: 1,
          },
          {
            name:
              "ix_customerSystemOffers_readySystem",
          }
        ),
      ]);
  }

  await indexesReady;

  return collection;
}

export function serializeCustomerSystemOffer(
  document:
    WithId<CustomerSystemOfferDocument>
): CustomerSystemOffer {
  return {
    id:
      document._id.toHexString(),

    customerId:
      document.customerId.toHexString(),

    vehicleId:
      document.vehicleId,

    readySystemId:
      document.readySystemId.toHexString(),

    systemSnapshot:
      document.systemSnapshot,

    extraDiscountTry:
      document.extraDiscountTry,

    finalCustomerTotalTry:
      document.finalCustomerTotalTry,

    finalProfitTry:
      document.finalProfitTry,

    status:
      document.status,

    createdAt:
      document.createdAt.toISOString(),

    updatedAt:
      document.updatedAt.toISOString(),

    soldAt:
      document.soldAt?.toISOString(),
  };
}