import {
  ObjectId,
} from "mongodb";

import {
  getVehicleCatalogCollections,
} from "@/lib/vehicle-catalog-store";

import type {
  ProductCategory,
  ProductPayload,
  ProductSpecificationValue,
} from "@/types/product";

export class ProductVehicleCompatibilityError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = "ProductVehicleCompatibilityError";
  }
}

function cleanString(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function objectId(
  value: unknown,
  label: string
) {
  const cleanValue =
    cleanString(value);

  if (!ObjectId.isValid(cleanValue)) {
    throw new ProductVehicleCompatibilityError(
      `Geçerli bir ${label} seçmelisiniz.`
    );
  }

  return new ObjectId(cleanValue);
}

export async function buildProductVehicleCompatibility(
  category: ProductCategory,
  body: ProductPayload
) {
  const specifications: Record<
    string,
    ProductSpecificationValue
  > =
    body.specifications &&
    typeof body.specifications === "object"
      ? { ...body.specifications }
      : {};

  if (category !== "multimedia-frame") {
    return {
      specifications,
      isMultimediaFrame: false as const,
      isUniversal: false,
    };
  }

  if (body.isUniversal === true) {
    specifications.vehicleBrand =
      "Universal";
    specifications.vehicleModel =
      "Universal";
    specifications.compatibleYears =
      "Tüm Araçlar";

    return {
      specifications,
      isMultimediaFrame: true as const,
      isUniversal: true,
    };
  }

  const vehicleBrandId = objectId(
    body.vehicleBrandId,
    "araç markası"
  );
  const vehicleModelId = objectId(
    body.vehicleModelId,
    "araç modeli"
  );
  const vehicleGenerationId = objectId(
    body.vehicleGenerationId,
    "araç kasa/yıl bilgisi"
  );

  const catalog =
    await getVehicleCatalogCollections();
  const [brand, model, generation] =
    await Promise.all([
      catalog.brands.findOne({
        _id: vehicleBrandId,
      }),
      catalog.models.findOne({
        _id: vehicleModelId,
        brandId: vehicleBrandId,
      }),
      catalog.generations.findOne({
        _id: vehicleGenerationId,
        brandId: vehicleBrandId,
        modelId: vehicleModelId,
      }),
    ]);

  if (!brand) {
    throw new ProductVehicleCompatibilityError(
      "Seçilen araç markası bulunamadı.",
      404
    );
  }

  if (!model) {
    throw new ProductVehicleCompatibilityError(
      "Seçilen araç modeli bu markaya ait değil veya bulunamadı.",
      404
    );
  }

  if (!generation) {
    throw new ProductVehicleCompatibilityError(
      "Seçilen kasa/yıl bu modele ait değil veya bulunamadı.",
      404
    );
  }

  specifications.vehicleBrand =
    brand.name;
  specifications.vehicleModel =
    `${model.name} ${generation.name}`.trim();
  specifications.compatibleYears =
    `${generation.startYear}-${generation.endYear}`;

  return {
    specifications,
    isMultimediaFrame: true as const,
    isUniversal: false,
    vehicleBrandId,
    vehicleModelId,
    vehicleGenerationId,
  };
}
