import type {
  Collection,
  ObjectId,
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
  ProductSupplierPrice,
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
  isUniversal?: boolean;
  vehicleBrandId?: ObjectId;
  vehicleModelId?: ObjectId;
  vehicleGenerationId?: ObjectId;
  vehicleCompatibilities?: Array<{
    vehicleBrandId: ObjectId;
    vehicleModelId: ObjectId;
    vehicleGenerationId: ObjectId;
  }>;
  subCategory?: string;
  suppliers?: ProductSupplier[];
  supplierPrices?: Array<{
    supplier: ProductSupplier;
    priceUsd: number;
    sourceUrl?: string;
    priceCheckedAt?: Date;
    sourceUnavailable?: boolean;
  }>;
  sourceUrl?: string;
  priceCheckedAt?: Date;
  priceRefreshAttemptedAt?: Date;
  sourceUnavailable?: boolean;
  sourceAvailabilityCheckedAt?: Date;
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
  const suppliers =
    normalizeProductSuppliers(
      product.suppliers
    );

  const supplierPrices: ProductSupplierPrice[] =
    suppliers.map((supplier, index) => {
      const stored =
        product.supplierPrices?.find(
          (item) =>
            item.supplier === supplier
        );

      return {
        supplier,
        priceUsd:
          Number(
            stored?.priceUsd ??
              product.priceUsd
          ) || 0,
        ...((stored?.sourceUrl ||
          (index === 0 && product.sourceUrl))
          ? {
              sourceUrl:
                stored?.sourceUrl ??
                product.sourceUrl,
            }
          : {}),
        ...((stored?.priceCheckedAt instanceof Date ||
          (index === 0 && product.priceCheckedAt instanceof Date))
          ? {
              priceCheckedAt:
                (stored?.priceCheckedAt ??
                  product.priceCheckedAt)!.toISOString(),
            }
          : {}),
        ...(typeof stored?.sourceUnavailable === "boolean"
          ? {
              sourceUnavailable:
                stored.sourceUnavailable,
            }
          : index === 0 &&
              typeof product.sourceUnavailable === "boolean"
            ? {
                sourceUnavailable:
                  product.sourceUnavailable,
              }
            : {}),
      };
    });

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
    ...(typeof product.isUniversal === "boolean"
      ? {
          isUniversal:
            product.isUniversal,
        }
      : {}),
    ...(product.vehicleBrandId
      ? {
          vehicleBrandId:
            product.vehicleBrandId.toString(),
        }
      : {}),
    ...(product.vehicleModelId
      ? {
          vehicleModelId:
            product.vehicleModelId.toString(),
        }
      : {}),
    ...(product.vehicleGenerationId
      ? {
          vehicleGenerationId:
            product.vehicleGenerationId.toString(),
        }
      : {}),
    ...(product.vehicleCompatibilities?.length
      ? {
          vehicleCompatibilities:
            product.vehicleCompatibilities.map(
              (compatibility) => ({
                vehicleBrandId:
                  compatibility.vehicleBrandId.toString(),
                vehicleModelId:
                  compatibility.vehicleModelId.toString(),
                vehicleGenerationId:
                  compatibility.vehicleGenerationId.toString(),
              })
            ),
        }
      : product.vehicleBrandId &&
          product.vehicleModelId &&
          product.vehicleGenerationId
        ? {
            vehicleCompatibilities: [
              {
                vehicleBrandId:
                  product.vehicleBrandId.toString(),
                vehicleModelId:
                  product.vehicleModelId.toString(),
                vehicleGenerationId:
                  product.vehicleGenerationId.toString(),
              },
            ],
          }
        : {}),
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
    suppliers,
    supplierPrices,
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
    ...(product.priceRefreshAttemptedAt instanceof Date
      ? {
          priceRefreshAttemptedAt:
            product.priceRefreshAttemptedAt.toISOString(),
        }
      : {}),
    ...(typeof product.sourceUnavailable === "boolean"
      ? {
          sourceUnavailable:
            product.sourceUnavailable,
        }
      : {}),
    ...(product.sourceAvailabilityCheckedAt instanceof Date
      ? {
          sourceAvailabilityCheckedAt:
            product.sourceAvailabilityCheckedAt.toISOString(),
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
