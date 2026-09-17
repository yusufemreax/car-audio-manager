import {
  ObjectId,
} from "mongodb";

import {
  buildSystemPreparationData,
  SystemPreparationBuildError,
} from "@/lib/system-preparation-builder";

import {
  getProductsCollection,
} from "@/lib/products-collection";

import {
  getVehicleCatalogCollections,
} from "@/lib/vehicle-catalog-store";

import type {
  MultimediaPreparationPayload,
} from "@/types/multimedia-preparation";

export {
  SystemPreparationBuildError,
};

function cleanString(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function toObjectId(
  value: string,
  label: string
) {
  if (!ObjectId.isValid(value)) {
    throw new SystemPreparationBuildError(
      `Geçersiz ${label}.`
    );
  }

  return new ObjectId(value);
}

function specificationText(
  specifications: Record<string, unknown>,
  key: string
) {
  const value = specifications[key];

  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value).trim();
}

export async function buildMultimediaPreparationData(
  body: MultimediaPreparationPayload
) {
  const brandId = toObjectId(
    cleanString(body.vehicleBrandId),
    "araç marka ID"
  );
  const modelId = toObjectId(
    cleanString(body.vehicleModelId),
    "araç model ID"
  );
  const generationId = toObjectId(
    cleanString(body.vehicleGenerationId),
    "araç kasa ID"
  );
  const additionalDescription =
    cleanString(
      body.additionalDescription
    ).slice(0, 500);

  const vehicleCollections =
    await getVehicleCatalogCollections();

  const [brand, model, generation] =
    await Promise.all([
      vehicleCollections.brands.findOne({
        _id: brandId,
      }),
      vehicleCollections.models.findOne({
        _id: modelId,
        brandId,
      }),
      vehicleCollections.generations.findOne({
        _id: generationId,
        brandId,
        modelId,
      }),
    ]);

  if (!brand) {
    throw new SystemPreparationBuildError(
      "Seçilen araç markası bulunamadı.",
      404
    );
  }

  if (!model) {
    throw new SystemPreparationBuildError(
      "Seçilen araç modeli bu markaya ait değil veya bulunamadı.",
      404
    );
  }

  if (!generation) {
    throw new SystemPreparationBuildError(
      "Seçilen araç kasası bu modele ait değil veya bulunamadı.",
      404
    );
  }

  const autoName = [
    brand.name,
    model.name,
    generation.name,
    `${generation.startYear}-${generation.endYear}`,
  ]
    .filter(Boolean)
    .join(" ");

  /*
   * Ürün, işçilik, komisyon, kur, indirim ve fiyat snapshot
   * mantığının tamamı mevcut Sistem Hazırlama builder'ından gelir.
   * Böylece iki ekranın hesaplama davranışı birbirinden kopmaz.
   */
  const base =
    await buildSystemPreparationData({
      ...body,
      name: autoName,
    });

  const products =
    await getProductsCollection();

  const frameItems =
    base.items.filter(
      (item) =>
        item.category ===
          "multimedia-frame" &&
        Boolean(item.productId)
    );

  if (frameItems.length > 0) {
    const exactFrameCount =
      await products.countDocuments({
        category:
          "multimedia-frame",
        vehicleGenerationId:
          generationId,
        isUniversal: {
          $ne: true,
        },
      });

    const selectedFrames =
      await products
        .find({
          _id: {
            $in: frameItems.map(
              (item) =>
                item.productId!
            ),
          },
        })
        .toArray();

    for (const frame of selectedFrames) {
      const isCompatible =
        exactFrameCount > 0
          ? frame.isUniversal !==
              true &&
            frame.vehicleGenerationId?.equals(
              generationId
            ) === true
          : frame.isUniversal ===
            true;

      if (!isCompatible) {
        throw new SystemPreparationBuildError(
          exactFrameCount > 0
            ? "Seçilen multimedya çerçevesi bu araca uyumlu değil. Araca tanımlı çerçeveyi seçin."
            : "Bu araç için özel çerçeve bulunamadı. Universal çerçeve seçin."
        );
      }
    }
  }

  const multimediaItem =
    base.items.find(
      (item) =>
        item.category === "multimedia" &&
        Boolean(item.productId)
    );

  let multimediaProductId:
    ObjectId | undefined;
  let multimediaScreenSize = "";
  let multimediaRam = "";
  let multimediaStorage = "";

  if (multimediaItem?.productId) {
    multimediaProductId =
      multimediaItem.productId;

    const multimediaProduct =
      await products.findOne({
        _id: multimediaItem.productId,
      });

    const specifications =
      multimediaProduct &&
      multimediaProduct.specifications &&
      typeof multimediaProduct.specifications === "object"
        ? multimediaProduct.specifications as Record<string, unknown>
        : {};

    multimediaScreenSize =
      specificationText(
        specifications,
        "screenSize"
      );
    multimediaRam =
      specificationText(
        specifications,
        "ram"
      );
    multimediaStorage =
      specificationText(
        specifications,
        "storage"
      );
  }

  return {
    ...base,
    name: autoName,
    vehicleBrandId: brandId,
    vehicleBrandName: brand.name,
    vehicleModelId: modelId,
    vehicleModelName: model.name,
    vehicleGenerationId: generationId,
    vehicleGenerationName: generation.name,
    vehicleStartYear: generation.startYear,
    vehicleEndYear: generation.endYear,
    ...(multimediaProductId
      ? { multimediaProductId }
      : {}),
    ...(multimediaScreenSize
      ? { multimediaScreenSize }
      : {}),
    ...(multimediaRam
      ? { multimediaRam }
      : {}),
    ...(multimediaStorage
      ? { multimediaStorage }
      : {}),
    ...(additionalDescription
      ? { additionalDescription }
      : {}),
  };
}
