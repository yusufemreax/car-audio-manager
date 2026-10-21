import { ProductVehicleCompatibilityError } from "./product-vehicle-compatibility";
import { ObjectId } from "mongodb";
import type {
  MultimediaAlternatives,
  ProductSpecificationValue,
} from "@/types/product";
import { getProductsCollection } from "./products-collection";
import { normalizeProductSuppliers } from "@/types/supplier";

export function equivalentMultimedia(
  a: {
    specifications: Record<string, ProductSpecificationValue>;
    isVehicleSpecific?: boolean;
  },
  b: {
    specifications: Record<string, ProductSpecificationValue>;
    isVehicleSpecific?: boolean;
  },
) {
  return (
    Boolean(a.isVehicleSpecific) === Boolean(b.isVehicleSpecific) &&
    ["screenSize", "ram", "storage"].every((key) => {
      const left = String(a.specifications[key] ?? "")
        .replace(/\s*(GB|["″])\s*$/i, "")
        .trim();
      const right = String(b.specifications[key] ?? "")
        .replace(/\s*(GB|["″])\s*$/i, "")
        .trim();
      return Boolean(left) && left === right;
    })
  );
}
export async function validateMultimediaAlternatives(
  value: unknown,
  category: string,
  source: {
    specifications: Record<string, ProductSpecificationValue>;
    isVehicleSpecific?: boolean;
    suppliers?: import("@/types/supplier").ProductSupplier[];
  },
  ownId?: string,
): Promise<MultimediaAlternatives> {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value))
    throw new ProductVehicleCompatibilityError(
      "Alternatif cihaz seçimi geçersiz.",
    );
  const alternatives: MultimediaAlternatives = {};
  const collection = await getProductsCollection();
  for (const [supplier, raw] of Object.entries(value)) {
    if (
      !["EGB", "OZDEMIR"].includes(supplier) ||
      (raw && (typeof raw !== "string" || !/^[a-f0-9]{24}$/i.test(raw)))
    )
      throw new ProductVehicleCompatibilityError(
        "Alternatif cihaz seçimi geçersiz.",
      );
    if (!raw) continue;
    if (category !== "multimedia")
      throw new ProductVehicleCompatibilityError(
        "Yalnızca multimedya cihazına alternatif seçebilirsiniz.",
      );
    if (raw === ownId) {
      if (!source.suppliers?.includes(supplier as "EGB" | "OZDEMIR")) throw new ProductVehicleCompatibilityError(`${supplier} bu cihazın tedarikçileri arasında olmalıdır.`);
      alternatives[supplier as "EGB" | "OZDEMIR"] = raw;
      continue;
    }
    const target = await collection.findOne({
      _id: new ObjectId(raw as string),
      category: "multimedia",
    });
    if (
      !target ||
      !equivalentMultimedia(source, target) ||
      !normalizeProductSuppliers(target.suppliers).includes(
        supplier as "EGB" | "OZDEMIR",
      )
    )
      throw new ProductVehicleCompatibilityError(
        `${supplier} alternatifi aynı ekran boyutu, RAM ve hafızada, bu tedarikçiye tanımlı bir multimedya olmalıdır.`,
      );
    alternatives[supplier as "EGB" | "OZDEMIR"] = raw as string;
  }
  return alternatives;
}
