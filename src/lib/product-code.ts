import {
  ProductCategory,
} from "@/types/product";

import {
  getProductsCollection,
} from "@/lib/products-collection";

export const productCodePrefixes: Record<
  ProductCategory,
  string
> = {
  speaker: "spk",

  amplifier: "amp",

  cable: "cbl",

  "deck-converter": "dck",

  "distribution-block": "dbl",

  enclosure: "enc",

  "dsp-processor": "dsp",

  "installation-equipment": "ins",

  multimedia: "mlt",

  "multimedia-frame": "mfr",
  "vehicle-camera": "CAM",
};

export async function getNextProductCode(
  category: ProductCategory
): Promise<string> {
  const prefix =
    productCodePrefixes[category];

  const collection =
    await getProductsCollection();

  const products =
    await collection
      .find(
        {
          productCode: {
            $regex: `^${prefix}-\\d+$`,
            $options: "i",
          },
        },
        {
          projection: {
            productCode: 1,
          },
        }
      )
      .toArray();

  let maxNumber = 0;

  const regex =
    new RegExp(
      `^${prefix}-(\\d+)$`,
      "i"
    );

  for (
    const product of products
  ) {
    const match =
      product.productCode.match(
        regex
      );

    if (!match) {
      continue;
    }

    const number =
      Number(match[1]);

    if (
      Number.isFinite(number) &&
      number > maxNumber
    ) {
      maxNumber = number;
    }
  }

  const nextNumber =
    maxNumber + 1;

  return `${prefix}-${String(
    nextNumber
  ).padStart(3, "0")}`;
}