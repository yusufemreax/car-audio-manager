import {
  Product,
} from "@/types/product";

export type StockMovementType =
  | "in"
  | "out";

export interface Inventory {
  id: string;

  productId: string;

  quantity: number;

  createdAt: string;

  updatedAt: string;
}

export interface InventoryProduct
  extends Product {
  stockQuantity: number;
}

export interface StockMovement {
  id: string;

  productId: string;

  type: StockMovementType;

  quantity: number;

  previousQuantity: number;

  newQuantity: number;

  note?: string;

  createdAt: string;
}