export interface VehicleGeneration {
  id: string;
  modelId: string;
  name: string;
  startYear: number;
  endYear: number;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleModel {
  id: string;
  brandId: string;
  name: string;
  generations: VehicleGeneration[];
  createdAt: string;
  updatedAt: string;
}

export interface VehicleBrand {
  id: string;
  name: string;
  models: VehicleModel[];
  createdAt: string;
  updatedAt: string;
}

export interface VehicleCatalogResponse {
  brands: VehicleBrand[];
  summary: {
    brandCount: number;
    modelCount: number;
    generationCount: number;
  };
}

export type VehicleCatalogEntity =
  | "brand"
  | "model"
  | "generation";
