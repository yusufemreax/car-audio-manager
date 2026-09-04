import {
  Collection,
  ObjectId,
} from "mongodb";

import {
  getDatabase,
} from "@/lib/mongodb";

import {
  StockMovementType,
} from "@/types/inventory";

export interface StockMovementDocument {
  productId: ObjectId;

  type: StockMovementType;

  quantity: number;

  previousQuantity: number;

  newQuantity: number;

  note?: string;

  sourceType?:
    | "manual"
    | "system-preparation";

  sourceId?: ObjectId;

  createdAt: Date;
}

export async function getStockMovementsCollection(): Promise<
  Collection<StockMovementDocument>
> {
  const database =
    await getDatabase();

  return database.collection<StockMovementDocument>(
    "stockMovements"
  );
}