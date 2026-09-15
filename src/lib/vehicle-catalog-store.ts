import type {
  Collection,
  ObjectId,
} from "mongodb";

import {
  getDatabase,
} from "@/lib/mongodb";

export interface VehicleBrandDocument {
  name: string;
  normalizedName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VehicleModelDocument {
  brandId: ObjectId;
  name: string;
  normalizedName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VehicleGenerationDocument {
  brandId: ObjectId;
  modelId: ObjectId;
  name: string;
  normalizedName: string;
  startYear: number;
  endYear: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface VehicleCatalogCollections {
  brands: Collection<VehicleBrandDocument>;
  models: Collection<VehicleModelDocument>;
  generations: Collection<VehicleGenerationDocument>;
}

let indexPromise:
  Promise<void> | null = null;

export function normalizeVehicleName(
  value: string
) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("tr-TR");
}

async function ensureIndexes(
  collections: VehicleCatalogCollections
) {
  if (!indexPromise) {
    indexPromise = (async () => {
      await Promise.all([
        collections.brands.createIndex(
          {
            normalizedName: 1,
          },
          {
            unique: true,
            name: "ux_vehicle_brand_name",
          }
        ),
        collections.models.createIndex(
          {
            brandId: 1,
            normalizedName: 1,
          },
          {
            unique: true,
            name: "ux_vehicle_model_brand_name",
          }
        ),
        collections.generations.createIndex(
          {
            modelId: 1,
            normalizedName: 1,
            startYear: 1,
            endYear: 1,
          },
          {
            unique: true,
            name: "ux_vehicle_generation_model_name_years",
          }
        ),
        collections.models.createIndex(
          {
            brandId: 1,
            name: 1,
          },
          {
            name: "ix_vehicle_model_brand",
          }
        ),
        collections.generations.createIndex(
          {
            modelId: 1,
            startYear: 1,
          },
          {
            name: "ix_vehicle_generation_model",
          }
        ),
      ]);
    })().catch((error) => {
      indexPromise = null;
      throw error;
    });
  }

  await indexPromise;
}

export async function getVehicleCatalogCollections(): Promise<VehicleCatalogCollections> {
  const database =
    await getDatabase();

  const collections: VehicleCatalogCollections = {
    brands:
      database.collection<VehicleBrandDocument>(
        "vehicleBrands"
      ),
    models:
      database.collection<VehicleModelDocument>(
        "vehicleModels"
      ),
    generations:
      database.collection<VehicleGenerationDocument>(
        "vehicleGenerations"
      ),
  };

  await ensureIndexes(
    collections
  );

  return collections;
}
