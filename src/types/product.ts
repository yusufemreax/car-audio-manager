import type {
  ProductSupplier,
  ProductSupplierPrice,
} from "@/types/supplier";

// src/types/product.ts

export type ProductCategory =
  | "speaker"
  | "amplifier"
  | "cable"
  | "deck-converter"
  | "distribution-block"
  | "enclosure"
  | "dsp-processor"
  | "installation-equipment"
  | "multimedia"
  | "multimedia-frame"
  | "vehicle-camera";

export type SpeakerType =
  | "midrange"
  | "midbass"
  | "component"
  | "coaxial"
  | "tweeter"
  | "subwoofer";

export type ProductSpecificationValue =
  | string
  | number
  | boolean;

export interface ProductVehicleCompatibility {
  vehicleBrandId: string;
  vehicleModelId: string;
  vehicleGenerationId: string;
}

export interface Product {
  id: string;
  productCode: string;
  brand: string;
  model: string;
  priceUsd: number;
  category: ProductCategory;
  isUniversal?: boolean;
  vehicleBrandId?: string;
  vehicleModelId?: string;
  vehicleGenerationId?: string;
  vehicleCompatibilities?:
    ProductVehicleCompatibility[];
  subCategory?: string;
  suppliers: ProductSupplier[];
  supplierPrices?: ProductSupplierPrice[];
  sourceUrl?: string;
  priceCheckedAt?: string;
  priceRefreshAttemptedAt?: string;
  /** Son günlük kontrolde ürün kaynağı HTTP 404 döndürdüyse true. */
  sourceUnavailable?: boolean;
  /** Ürün kaynağının erişilebilirlik durumunun son kontrol zamanı. */
  sourceAvailabilityCheckedAt?: string;
  specifications: Record<
    string,
    ProductSpecificationValue
  >;
  description?: string;
  imageUrl?: string;
  imagePublicId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ProductPayload = {
  productCode: string;
  brand: string;
  model: string;
  priceUsd: number;
  category: ProductCategory;
  isUniversal?: boolean;
  vehicleBrandId?: string;
  vehicleModelId?: string;
  vehicleGenerationId?: string;
  vehicleCompatibilities?:
    ProductVehicleCompatibility[];
  subCategory?: string;
  suppliers: ProductSupplier[];
  supplierPrices: ProductSupplierPrice[];
  sourceUrl?: string;
  specifications: Record<
    string,
    ProductSpecificationValue
  >;
  description?: string;
  imageUrl?: string;
  imagePublicId?: string;
  removeImage?: boolean;
};
