import type {
  Collection,
  WithId,
} from "mongodb";

import {
  getDatabase,
} from "@/lib/mongodb";

import type {
  Product,
  ProductCategory,
  ProductSpecificationValue,
} from "@/types/product";

import type {
  ProductSupplier,
} from "@/types/supplier";

import {
  normalizeProductSuppliers,
} from "@/types/supplier";

export interface ProductDocument {
  productCode: string;
  brand: string;
  model: string;
  priceUsd: number;
  category: ProductCategory;
  subCategory?: string;
  suppliers?: ProductSupplier[];
  sourceUrl?: string;
  priceCheckedAt?: Date;
  priceRefreshAttemptedAt?: Date;
  specifications: Record<
    string,
    ProductSpecificationValue
  >;
  description?: string;
  imageUrl?: string;
  imagePublicId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function getProductsCollection(): Promise<
  Collection<ProductDocument>
> {
  const db =
    await getDatabase();

  return db.collection<ProductDocument>(
    "products"
  );
}

export function serializeProduct(
  product:
    WithId<ProductDocument>
): Product {
  return {
    id:
      product._id.toString(),
    productCode:
      product.productCode,
    brand:
      product.brand,
    model:
      product.model,
    priceUsd:
      Number(
        product.priceUsd
      ) || 0,
    category:
      product.category,
    ...(product.subCategory
      ? {
          subCategory:
            product.subCategory,
        }
      : {}),
    /*
     * Eski ürün kayıtlarında suppliers alanı yoktur.
     * Geriye uyumluluk için bu kayıtlar EGB olarak okunur.
     * Kayıt yeniden kaydedildiğinde alan MongoDB'ye fiziksel yazılır.
     */
    suppliers:
      normalizeProductSuppliers(
        product.suppliers
      ),
    ...(product.sourceUrl
      ? {
          sourceUrl:
            product.sourceUrl,
        }
      : {}),
    ...(product.priceCheckedAt instanceof Date
      ? {
          priceCheckedAt:
            product.priceCheckedAt.toISOString(),
        }
      : {}),
    specifications:
      product.specifications ??
      {},
    ...(product.description
      ? {
          description:
            product.description,
        }
      : {}),
    ...(product.imageUrl
      ? {
          imageUrl:
            product.imageUrl,
        }
      : {}),
    ...(product.imagePublicId
      ? {
          imagePublicId:
            product.imagePublicId,
        }
      : {}),
    createdAt:
      product.createdAt.toISOString(),
    updatedAt:
      product.updatedAt.toISOString(),
  };
}
