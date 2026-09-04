import {
  Collection,
  WithId,
} from "mongodb";

import {
  getDatabase,
} from "@/lib/mongodb";

import {
  Customer,
  CustomerVehicle,
} from "@/types/customer";

export interface CustomerDocument {
  name: string;

  phone?: string;

  email?: string;

  notes?: string;

  vehicles:
    CustomerVehicle[];

  createdAt: Date;

  updatedAt: Date;
}

let indexesReady:
  | Promise<unknown>
  | null = null;

export async function getCustomersCollection(): Promise<
  Collection<CustomerDocument>
> {
  const database =
    await getDatabase();

  const collection =
    database.collection<CustomerDocument>(
      "customers"
    );

  if (!indexesReady) {
    indexesReady =
      Promise.all([
        collection.createIndex(
          {
            name: 1,
          },
          {
            name:
              "ix_customers_name",
          }
        ),

        collection.createIndex(
          {
            phone: 1,
          },
          {
            name:
              "ix_customers_phone",
          }
        ),
      ]);
  }

  await indexesReady;

  return collection;
}

export function serializeCustomer(
  document:
    WithId<CustomerDocument>
): Customer {
  return {
    id:
      document._id.toHexString(),

    name:
      document.name,

    phone:
      document.phone,

    email:
      document.email,

    notes:
      document.notes,

    vehicles:
      document.vehicles,

    createdAt:
      document.createdAt.toISOString(),

    updatedAt:
      document.updatedAt.toISOString(),
  };
}