import type { WithId } from "mongodb";
import { getProductsByIdsWithFreshPrices } from "./products-service";
import type { ProductDocument } from "./products-collection";
import type { SystemPreparationItemDocument } from "./system-preparations-collection";
import type { MultimediaSupplierPreference } from "./multimedia-preparations-collection";
import {
  isProductSupplier,
  normalizeProductSuppliers,
  type ProductSupplier,
} from "@/types/supplier";
import { equivalentMultimedia } from "./multimedia-product-alternatives";

type Item = SystemPreparationItemDocument;
export function captureSupplierPreference(
  items: Item[],
): MultimediaSupplierPreference | undefined {
  if (
    items.filter(
      (item) => item.category === "multimedia-frame" && item.productId,
    ).length !== 1 ||
    items.filter((item) => item.category === "multimedia" && item.productId)
      .length !== 1
  )
    return undefined;
  const frame = items.find(
    (item) => item.category === "multimedia-frame" && item.productId,
  );
  const screen = items.find(
    (item) => item.category === "multimedia" && item.productId,
  );
  if (!frame?.productId || !screen?.productId) return undefined;
  return {
    frameProductId: frame.productId.toHexString(),
    frameSupplier: frame.supplier ?? "EGB",
    multimediaProductId: screen.productId.toHexString(),
    multimediaSupplier: screen.supplier ?? "EGB",
  };
}
export function sameSupplierSelection(a: Item[], b: Item[]) {
  return ["multimedia-frame", "multimedia"].every((category) => {
    const first = a.find((item) => item.category === category),
      second = b.find((item) => item.category === category);
    return (
      String(first?.productId ?? "") === String(second?.productId ?? "") &&
      first?.supplier === second?.supplier
    );
  });
}
export function chooseSupplierPreference(items: Item[], previous?: { items: Item[]; supplierPreference?: MultimediaSupplierPreference }) {
  const fresh = captureSupplierPreference(items);
  const saved = previous?.supplierPreference;
  if (!fresh || !saved || !previous) return fresh;
  const unchanged = (category: string) => {
    const a = items.find((item) => item.category === category), b = previous.items.find((item) => item.category === category);
    return String(a?.productId ?? "") === String(b?.productId ?? "") && a?.supplier === b?.supplier;
  };
  return { ...fresh,
    ...(unchanged("multimedia-frame") ? { frameProductId: saved.frameProductId, frameSupplier: saved.frameSupplier } : {}),
    ...(unchanged("multimedia") ? { multimediaProductId: saved.multimediaProductId, multimediaSupplier: saved.multimediaSupplier } : {}),
  };
}
function available(
  product: WithId<ProductDocument>,
  supplier: ProductSupplier,
) {
  const suppliers = normalizeProductSuppliers(product.suppliers);
  if (!suppliers.includes(supplier)) return false;
  const row = product.supplierPrices?.find(
    (entry) => entry.supplier === supplier,
  );
  return row
    ? row.sourceUnavailable !== true
    : !(supplier === suppliers[0] && product.sourceUnavailable === true);
}
export async function resolveMultimediaSuppliers(
  items: Item[],
  saved?: MultimediaSupplierPreference,
) {
  const preference = saved ?? captureSupplierPreference(items);
  if (!preference) return { items, preference, screen: undefined };
  const ids = [
    preference.frameProductId,
    preference.multimediaProductId,
    ...items.flatMap((item) =>
      item.productId ? [item.productId.toHexString()] : [],
    ),
  ];
  const products = await getProductsByIdsWithFreshPrices(ids);
  const root = products.find(
    (product) => product._id.toHexString() === preference.multimediaProductId,
  );
  const frame = products.find(
    (product) => product._id.toHexString() === preference.frameProductId,
  );
  if (
    !root ||
    root.category !== "multimedia" ||
    !frame ||
    frame.category !== "multimedia-frame"
  )
    throw new Error(
      "Paketin asıl ekranı veya çerçevesi bulunamadı. Hazır multimedya seçimini kontrol edin.",
    );
  const alternatives = await getProductsByIdsWithFreshPrices(
    Object.values(root.multimediaAlternatives ?? {}),
  );
  const byId = new Map(
    [...products, ...alternatives].map((product) => [
      product._id.toHexString(),
      product,
    ]),
  );
  const frameSupplier = [
    preference.frameSupplier,
    ...normalizeProductSuppliers(frame.suppliers),
  ].find((supplier) => available(frame, supplier));
  if (!frameSupplier)
    throw new Error("Çerçeve tanımlı tedarikçilerin hiçbirinde satışta değil.");
  const frameSize = String(frame.specifications?.size ?? "").trim();
  const compatible = (product: WithId<ProductDocument>) =>
    product.category === "multimedia" &&
    product.isVehicleSpecific !== true &&
    equivalentMultimedia(root, product) &&
    String(product.specifications?.screenSize ?? "").trim() === frameSize;
  const current = items.find((item) => item.category === "multimedia");
  const candidates: Array<{
    product: WithId<ProductDocument> | undefined;
    supplier: ProductSupplier;
  }> = [];
  const addSupplier = (supplier: ProductSupplier) => {
    candidates.push({ product: root, supplier });
    if (supplier === "EGB" || supplier === "OZDEMIR") {
      const id = root.multimediaAlternatives?.[supplier];
      if (id) candidates.push({ product: byId.get(id), supplier });
    }
  };
  addSupplier(frameSupplier);
  addSupplier(preference.multimediaSupplier);
  if (current?.productId && isProductSupplier(current.supplier))
    candidates.push({
      product: byId.get(current.productId.toHexString()),
      supplier: current.supplier,
    });
  for (const supplier of ["EGB", "OZDEMIR", "Diğer"] as ProductSupplier[])
    addSupplier(supplier);
  const choice = candidates.find(
    ({ product, supplier }) =>
      product && compatible(product) && available(product, supplier),
  );
  if (!choice?.product)
    throw new Error(
      "Aynı boyut, RAM ve hafızada satışta olan ekran veya tanımlı alternatif bulunamadı.",
    );
  const screen = choice.product;
  return {
    preference,
    screen,
    items: items.map((item) =>
      item.category === "multimedia-frame"
        ? { ...item, productId: frame._id, supplier: frameSupplier }
        : item.category === "multimedia"
          ? { ...item, productId: screen._id, supplier: choice.supplier }
          : item,
    ),
  };
}
