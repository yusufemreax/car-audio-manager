import { ObjectId, type WithId } from "mongodb";
import { getVehicleCatalogCollections } from "@/lib/vehicle-catalog-store";
import {
  getMultimediaPreparationsCollection,
  serializeMultimediaPreparation,
  type MultimediaPreparationDocument,
} from "@/lib/multimedia-preparations-collection";
import { refreshMultimediaForOffers } from "@/lib/multimedia-offer-refresh";
import { getProductsCollection } from "@/lib/products-collection";
import { productCategoryDefinitions } from "@/lib/product-config";
import type { PortalMultimedia, PortalVehicle } from "@/types/portal";
import { PortalError } from "./http";

export async function publicVehicles(): Promise<PortalVehicle[]> {
  const collections = await getVehicleCatalogCollections();
  const [brands, models, generations] = await Promise.all([
    collections.brands.find({}).sort({ name: 1 }).toArray(),
    collections.models.find({}).sort({ name: 1 }).toArray(),
    collections.generations.find({}).sort({ startYear: -1 }).toArray(),
  ]);
  return brands.map((brand) => ({
    id: brand._id.toString(),
    name: brand.name,
    models: models
      .filter((model) => model.brandId.equals(brand._id))
      .map((model) => ({
        id: model._id.toString(),
        name: model.name,
        generations: generations
          .filter((generation) => generation.modelId.equals(model._id))
          .map((generation) => ({
            id: generation._id.toString(),
            name: generation.name,
            startYear: generation.startYear,
            endYear: generation.endYear,
          })),
      })),
  }));
}
async function publicView(
  preparation: WithId<MultimediaPreparationDocument>,
): Promise<PortalMultimedia> {
  const products = await getProductsCollection();
  const ids = preparation.items.flatMap((item) =>
    item.productId ? [item.productId] : [],
  );
  const documents = await products.find({ _id: { $in: ids } }).toArray();
  const screenId = preparation.items.find(
    (item) => item.category === "multimedia",
  )?.productId;
  const frameId = preparation.items.find(
    (item) => item.category === "multimedia-frame",
  )?.productId;
  const screen = documents.find((product) => product._id.equals(screenId));
  const frame = documents.find((product) => product._id.equals(frameId));
  const specifications = screen?.specifications ?? {};
  const features = productCategoryDefinitions.multimedia.fields.flatMap(
    (field) => {
      if (field.source !== "specifications") return [];
      const value = specifications[field.key];
      if (value === undefined || value === null || value === "") return [];
      const text =
        typeof value === "boolean"
          ? value
            ? "Var"
            : "Yok"
          : (field.options?.find((option) => option.value === String(value))
              ?.label ?? `${value}${field.unit ? ` ${field.unit}` : ""}`);
      return [{ label: field.label, value: text }];
    },
  );
  const ram = String(specifications.ram ?? preparation.multimediaRam ?? "");
  const storage = String(
    specifications.storage ?? preparation.multimediaStorage ?? "",
  );
  const capacity = (value: string) => {
    const cleaned = value
      .trim()
      .replace(/\s*GB\s*$/i, "")
      .trim();
    return cleaned ? `${cleaned}GB` : "";
  };
  const brand = (
    screen?.brand ??
    preparation.items.find((item) => item.category === "multimedia")?.brand ??
    ""
  ).trim();
  const title = [
    brand || "Multimedya",
    capacity(ram),
    capacity(storage),
    preparation.additionalDescription?.trim(),
  ]
    .filter(Boolean)
    .join(" - ");
  const images = [
    { url: preparation.installationImageUrl, label: "Örnek montaj" },
    { url: screen?.imageUrl, label: "Multimedya ekranı" },
    { url: frame?.imageUrl, label: "Araç çerçevesi" },
  ].filter((image): image is { url: string; label: string } =>
    Boolean(image.url),
  );
  return {
    id: preparation._id.toString(),
    title,
    vehicle: `${preparation.vehicleBrandName} - ${preparation.vehicleModelName} - ${preparation.vehicleGenerationName}`,
    generationId: preparation.vehicleGenerationId.toString(),
    description:
      preparation.additionalDescription ??
      `${screen?.brand ?? ""} ${screen?.model ?? ""}`.trim(),
    screenSize: String(
      specifications.screenSize ?? preparation.multimediaScreenSize ?? "",
    ),
    ram,
    storage,
    priceTry: Math.round(preparation.customerTotalTry * 100) / 100,
    hasFrontRecordingCamera: specifications.hasFrontRecordingCamera === true,
    images,
    features,
  };
}
export async function publicMultimedias(generationId: string) {
  if (!ObjectId.isValid(generationId))
    throw new PortalError("Araç kasasını seçin.");
  const collection = await getMultimediaPreparationsCollection();
  const preparations = await collection
    .find({ status: "ready", vehicleGenerationId: new ObjectId(generationId) })
    .sort({ createdAt: -1 })
    .toArray();
  const results = await Promise.allSettled(
    preparations.map(async (preparation) => {
      const [fresh] = await refreshMultimediaForOffers([preparation]);
      return publicView(fresh);
    }),
  );
  return results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
}
export async function publicMultimedia(id: string): Promise<PortalMultimedia> {
  return (await multimediaForBooking(id)).product;
}
// Server-only snapshot and public DTO are calculated from the same price refresh.
export async function multimediaForBooking(id: string) {
  if (!ObjectId.isValid(id))
    throw new PortalError("Multimedya bulunamadı.", 404);
  const collection = await getMultimediaPreparationsCollection();
  const preparation = await collection.findOne({
    _id: new ObjectId(id),
    status: "ready",
  });
  if (!preparation) throw new PortalError("Multimedya bulunamadı.", 404);
  try {
    const [fresh] = await refreshMultimediaForOffers([preparation]);
    return {
      product: await publicView(fresh),
      snapshot: serializeMultimediaPreparation(fresh),
    };
  } catch {
    throw new PortalError(
      "Bu multimedya şu anda siparişe uygun değil. Lütfen farklı bir seçenek seçin.",
      409,
    );
  }
}
