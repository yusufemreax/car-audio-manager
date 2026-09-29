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

  const rawCompatibilities =
    Array.isArray(
      body.vehicleCompatibilities
    ) &&
    body.vehicleCompatibilities.length > 0
      ? body.vehicleCompatibilities
      : [
          {
            vehicleBrandId:
              body.vehicleBrandId ?? "",
            vehicleModelId:
              body.vehicleModelId ?? "",
            vehicleGenerationId:
              body.vehicleGenerationId ?? "",
          },
        ];

  const vehicleCompatibilities =
    rawCompatibilities.map(
      (compatibility, index) => ({
        vehicleBrandId:
          objectId(
            compatibility.vehicleBrandId,
            `${index + 1}. araç markası`
          ),
        vehicleModelId:
          objectId(
            compatibility.vehicleModelId,
            `${index + 1}. araç modeli`
          ),
        vehicleGenerationId:
          objectId(
            compatibility.vehicleGenerationId,
            `${index + 1}. araç kasa/yıl bilgisi`
          ),
      })
    );

  const generationIds =
    vehicleCompatibilities.map(
      (compatibility) =>
        compatibility.vehicleGenerationId.toString()
    );

  if (
    new Set(generationIds).size !==
    generationIds.length
  ) {
    throw new ProductVehicleCompatibilityError(
      "Aynı araç kasa/yıl uyumluluğu birden fazla kez eklenemez."
    );
  }

  const catalog =
    await getVehicleCatalogCollections();

  const resolvedCompatibilities =
    await Promise.all(
      vehicleCompatibilities.map(
        async (
          compatibility,
          index
        ) => {
          const [brand, model, generation] =
            await Promise.all([
              catalog.brands.findOne({
                _id:
                  compatibility.vehicleBrandId,
              }),
              catalog.models.findOne({
                _id:
                  compatibility.vehicleModelId,
                brandId:
                  compatibility.vehicleBrandId,
              }),
              catalog.generations.findOne({
                _id:
                  compatibility.vehicleGenerationId,
                brandId:
                  compatibility.vehicleBrandId,
                modelId:
                  compatibility.vehicleModelId,
              }),
            ]);

          if (!brand) {
            throw new ProductVehicleCompatibilityError(
              `${index + 1}. araç markası bulunamadı.`,
              404
            );
          }

          if (!model) {
            throw new ProductVehicleCompatibilityError(
              `${index + 1}. araç modeli bu markaya ait değil veya bulunamadı.`,
              404
            );
          }

          if (!generation) {
            throw new ProductVehicleCompatibilityError(
              `${index + 1}. kasa/yıl bu modele ait değil veya bulunamadı.`,
              404
            );
          }

          return {
            ...compatibility,
            brandName:
              brand.name,
            modelName:
              model.name,
            generationName:
              generation.name,
            startYear:
              generation.startYear,
            endYear:
              generation.endYear,
          };
        }
      )
    );

  specifications.vehicleBrand =
    Array.from(
      new Set(
        resolvedCompatibilities.map(
          (item) => item.brandName
        )
      )
    ).join(", ");
  specifications.vehicleModel =
    resolvedCompatibilities
      .map(
        (item) =>
          `${item.modelName} ${item.generationName}`.trim()
      )
      .join(", ");
  specifications.compatibleYears =
    resolvedCompatibilities
      .map(
        (item) =>
          `${item.startYear}-${item.endYear}`
      )
      .join(", ");

  const primaryCompatibility =
    vehicleCompatibilities[0];

  return {
    specifications,
    isMultimediaFrame: true as const,
    isUniversal: false,
    vehicleBrandId:
      primaryCompatibility.vehicleBrandId,
    vehicleModelId:
      primaryCompatibility.vehicleModelId,
    vehicleGenerationId:
      primaryCompatibility.vehicleGenerationId,
    vehicleCompatibilities,
  };
}
