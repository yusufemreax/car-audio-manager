import {
  ObjectId,
  type WithId,
} from "mongodb";

import type {
  ProductCategory,
} from "@/types/product";

import {
  getProductsCollection,
  type ProductDocument,
} from "@/lib/products-collection";

import {
  refreshProductPriceIfNeeded,
  refreshProductPricesIfNeeded,
} from "@/lib/product-price-refresh";

export async function getStoredProducts(
  category?: ProductCategory
): Promise<
  WithId<ProductDocument>[]
> {
  const products =
    await getProductsCollection();

  const filter =
    category
      ? {
          category,
        }
      : {};

  const documents =
    await products
      .find(filter)
      .sort({
        createdAt: -1,
      })
      .toArray();

  return documents;
}

export async function getStoredProductById(
  productId:
    string | ObjectId
): Promise<
  WithId<ProductDocument> | null
> {
  const objectId =
    typeof productId ===
    "string"
      ? ObjectId.isValid(
          productId
        )
        ? new ObjectId(
            productId
          )
        : null
      : productId;

  if (!objectId) {
    return null;
  }

  const products =
    await getProductsCollection();

  const product =
    await products.findOne({
      _id: objectId,
    });

  if (!product) {
    return null;
  }

  return product;
}

export async function getStoredProductsByIds(
  productIds:
    Array<
      string | ObjectId
    >
): Promise<
  WithId<ProductDocument>[]
> {
  const objectIds =
    Array.from(
      new Set(
        productIds
          .map((productId) =>
            typeof productId ===
            "string"
              ? productId
              : productId.toString()
          )
          .filter(
            (productId) =>
              ObjectId.isValid(
                productId
              )
          )
      )
    ).map(
      (productId) =>
        new ObjectId(
          productId
        )
    );

  if (
    objectIds.length ===
    0
  ) {
    return [];
  }

  const products =
    await getProductsCollection();

  const documents =
    await products
      .find({
        _id: {
          $in:
            objectIds,
        },
      })
      .toArray();

  return documents;
}

// External supplier requests belong to explicit price-refresh workflows.
// Multimedia reads use the stored readers above, even if yesterday's check expired.
export async function getProductsWithFreshPrices(category?: ProductCategory) {
  return refreshProductPricesIfNeeded(await getStoredProducts(category));
}
export async function getProductByIdWithFreshPrice(productId: string | ObjectId) {
  const product = await getStoredProductById(productId);
  return product ? refreshProductPriceIfNeeded(product) : null;
}
export async function getProductsByIdsWithFreshPrices(productIds: Array<string | ObjectId>) {
  return refreshProductPricesIfNeeded(await getStoredProductsByIds(productIds));
}
