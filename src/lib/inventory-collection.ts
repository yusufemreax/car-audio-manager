import {
  Collection,
  ObjectId,
  WithId,
} from "mongodb";

import {
  getDatabase,
} from "@/lib/mongodb";

import {
  Inventory,
} from "@/types/inventory";

export interface InventoryDocument {
  productId: ObjectId;

  quantity: number;

  createdAt: Date;

  updatedAt: Date;
}

let indexesReady:
  | Promise<unknown>
  | null = null;

export async function getInventoryCollection(): Promise<
  Collection<InventoryDocument>
> {
  const database =
    await getDatabase();

  const collection =
    database.collection<InventoryDocument>(
      "inventory"
    );

  if (!indexesReady) {
    indexesReady =
      collection.createIndex(
        {
          productId: 1,
        },
        {
          unique: true,
          name: "ux_inventory_productId",
        }
      );
  }

  await indexesReady;

  return collection;
}

export function serializeInventory(
  inventory: WithId<InventoryDocument>
): Inventory {
  return {
    id:
      inventory._id.toHexString(),

    productId:
      inventory.productId.toHexString(),

    quantity:
      inventory.quantity,

    createdAt:
      inventory.createdAt.toISOString(),

    updatedAt:
      inventory.updatedAt.toISOString(),
  };
}