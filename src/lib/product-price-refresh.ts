import type {
  WithId,
} from "mongodb";

import {
  getProductsCollection,
  type ProductDocument,
} from "@/lib/products-collection";

import {
  fetchProductSourcePrice,
  getProductPriceSource,
  getProductPriceSourceLabel,
  isProductSourceNotFoundError,
  roundCurrency,
} from "@/lib/scraping/product-source-price";

const PRODUCT_PRICE_REFRESH_CONCURRENCY =
  3;

const PRICE_REFRESH_TIME_ZONE =
  "Europe/Istanbul";

const refreshInFlight =
  new Map<
    string,
    Promise<WithId<ProductDocument>>
  >();

function cleanString(
  value: unknown
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isUsableDate(
  value: unknown
): value is Date {
  return (
    value instanceof Date &&
    Number.isFinite(
      value.getTime()
    )
  );
}

export function getIstanbulDayKey(
  date: Date
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          PRICE_REFRESH_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(date);

  const values =
    new Map(
      parts.map((part) => [
        part.type,
        part.value,
      ])
    );

  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function getLastRefreshAttemptAt(
  product: WithId<ProductDocument>
) {
  if (
    isUsableDate(
      product.priceRefreshAttemptedAt
    )
  ) {
    return product.priceRefreshAttemptedAt;
  }

  if (
    isUsableDate(
      product.sourceAvailabilityCheckedAt
    )
  ) {
    return product.sourceAvailabilityCheckedAt;
  }

  if (
    isUsableDate(
      product.priceCheckedAt
    )
  ) {
    return product.priceCheckedAt;
  }

  return null;
}

/**
 * Bir ürün kaynak linkine sahipse Istanbul takvim gününde en fazla bir kez
 * dış kaynağa gidilir. Başarılı, 404 veya geçici hata fark etmeksizin o gün
 * yeniden istek yapılmaz.
 */
export function isProductPriceFresh(
  product: WithId<ProductDocument>,
  now = new Date()
) {
  const sourceUrl =
    cleanString(
      product.sourceUrl
    );

  if (!sourceUrl) {
    return true;
  }

  const lastAttemptAt =
    getLastRefreshAttemptAt(
      product
    );

  if (!lastAttemptAt) {
    return false;
  }

  return (
    getIstanbulDayKey(
      lastAttemptAt
    ) ===
    getIstanbulDayKey(
      now
    )
  );
}

export const isProductPriceRefreshAttemptedToday =
  isProductPriceFresh;

function withAttemptDate(
  product: WithId<ProductDocument>,
  attemptedAt: Date
): WithId<ProductDocument> {
  return {
    ...product,
    priceRefreshAttemptedAt:
      attemptedAt,
  };
}

function withSuccessfulCheck(
  product: WithId<ProductDocument>,
  checkedAt: Date,
  priceUsd: number,
  priceChanged: boolean
): WithId<ProductDocument> {
  return {
    ...product,
    priceUsd,
    priceCheckedAt:
      checkedAt,
    priceRefreshAttemptedAt:
      checkedAt,
    sourceUnavailable:
      false,
    sourceAvailabilityCheckedAt:
      checkedAt,
    ...(priceChanged
      ? {
          updatedAt:
            checkedAt,
        }
      : {}),
  };
}

function withUnavailableState(
  product: WithId<ProductDocument>,
  attemptedAt: Date
): WithId<ProductDocument> {
  return {
    ...product,
    sourceUnavailable:
      true,
    sourceAvailabilityCheckedAt:
      attemptedAt,
    priceRefreshAttemptedAt:
      attemptedAt,
  };
}

async function readLatestProduct(
  product: WithId<ProductDocument>,
  fallback:
    WithId<ProductDocument>
) {
  const products =
    await getProductsCollection();

  return (
    (await products.findOne({
      _id: product._id,
    })) ?? fallback
  );
}

async function markRefreshAttempt(
  product: WithId<ProductDocument>,
  attemptedAt: Date
) {
  const products =
    await getProductsCollection();

  await products.updateOne(
    {
      _id: product._id,
      ...(product.sourceUrl
        ? {
            sourceUrl:
              product.sourceUrl,
          }
        : {}),
    },
    {
      $set: {
        priceRefreshAttemptedAt:
          attemptedAt,
      },
    }
  );
}

async function markSourceUnavailable(
  product: WithId<ProductDocument>,
  attemptedAt: Date
) {
  const products =
    await getProductsCollection();

  const result =
    await products.updateOne(
      {
        _id: product._id,
        ...(product.sourceUrl
          ? {
              sourceUrl:
                product.sourceUrl,
            }
          : {}),
      },
      {
        $set: {
          sourceUnavailable:
            true,
          sourceAvailabilityCheckedAt:
            attemptedAt,
          priceRefreshAttemptedAt:
            attemptedAt,
        },
      }
    );

  if (
    result.matchedCount === 0
  ) {
    return readLatestProduct(
      product,
      withUnavailableState(
        product,
        attemptedAt
      )
    );
  }

  return withUnavailableState(
    product,
    attemptedAt
  );
}

async function performProductPriceRefresh(
  product: WithId<ProductDocument>
): Promise<WithId<ProductDocument>> {
  const sourceUrl =
    cleanString(
      product.sourceUrl
    );

  if (!sourceUrl) {
    return product;
  }

  const attemptedAt =
    new Date();

  const source =
    getProductPriceSource(
      sourceUrl
    );

  if (!source) {
    await markRefreshAttempt(
      product,
      attemptedAt
    );

    return withAttemptDate(
      product,
      attemptedAt
    );
  }

  try {
    const remote =
      await fetchProductSourcePrice(
        sourceUrl
      );

    const previousPriceUsd =
      roundCurrency(
        Number(
          product.priceUsd
        ) || 0
      );

    const remotePriceUsd =
      roundCurrency(
        remote.priceUsd
      );

    const priceChanged =
      previousPriceUsd !==
      remotePriceUsd;

    const products =
      await getProductsCollection();

    const updateResult =
      await products.updateOne(
        {
          _id: product._id,
          sourceUrl,
          ...(priceChanged
            ? {
                priceUsd:
                  product.priceUsd,
              }
            : {}),
        },
        {
          $set: {
            ...(priceChanged
              ? {
                  priceUsd:
                    remotePriceUsd,
                  updatedAt:
                    attemptedAt,
                }
              : {}),
            priceCheckedAt:
              attemptedAt,
            priceRefreshAttemptedAt:
              attemptedAt,
            sourceUnavailable:
              false,
            sourceAvailabilityCheckedAt:
              attemptedAt,
          },
        }
      );

    if (
      updateResult.matchedCount ===
      0
    ) {
      return readLatestProduct(
        product,
        product
      );
    }

    return withSuccessfulCheck(
      product,
      attemptedAt,
      remotePriceUsd,
      priceChanged
    );
  } catch (error) {
    if (
      isProductSourceNotFoundError(
        error
      )
    ) {
      console.warn(
        `${getProductPriceSourceLabel(source)} source product is unavailable (HTTP 404 or out of stock); stored price was preserved and product was marked unavailable:`,
        product._id.toString(),
        sourceUrl
      );

      return markSourceUnavailable(
        product,
        attemptedAt
      );
    }

    try {
      await markRefreshAttempt(
        product,
        attemptedAt
      );
    } catch (markError) {
      console.warn(
        "Product price refresh attempt timestamp could not be saved:",
        product._id.toString(),
        markError instanceof Error
          ? markError.message
          : "unknown error"
      );
    }

    console.warn(
      "Product price refresh failed; stored price will be used:",
      product._id.toString(),
      error instanceof Error
        ? error.message
        : "unknown error"
    );

    return withAttemptDate(
      product,
      attemptedAt
    );
  }
}

export async function refreshProductPriceIfNeeded(
  product: WithId<ProductDocument>,
  _options?: {
    force?: boolean;
  }
): Promise<WithId<ProductDocument>> {
  // force geriye uyumluluk için korunuyor. Günlük limit bilinçli olarak
  // bypass edilmez.
  if (
    isProductPriceFresh(
      product
    )
  ) {
    return product;
  }

  const productId =
    product._id.toString();

  const existingPromise =
    refreshInFlight.get(
      productId
    );

  if (existingPromise) {
    return existingPromise;
  }

  const promise =
    performProductPriceRefresh(
      product
    );

  refreshInFlight.set(
    productId,
    promise
  );

  try {
    return await promise;
  } finally {
    if (
      refreshInFlight.get(
        productId
      ) === promise
    ) {
      refreshInFlight.delete(
        productId
      );
    }
  }
}

export async function refreshProductPricesIfNeeded(
  products:
    WithId<ProductDocument>[],
  options?: {
    force?: boolean;
  }
): Promise<
  WithId<ProductDocument>[]
> {
  if (
    products.length === 0
  ) {
    return [];
  }

  const results:
    WithId<ProductDocument>[] =
    new Array(
      products.length
    );

  let nextIndex = 0;

  const workerCount =
    Math.min(
      PRODUCT_PRICE_REFRESH_CONCURRENCY,
      products.length
    );

  const worker = async () => {
    while (true) {
      const index =
        nextIndex;

      nextIndex += 1;

      if (
        index >=
        products.length
      ) {
        return;
      }

      results[index] =
        await refreshProductPriceIfNeeded(
          products[index],
          options
        );
    }
  };

  await Promise.all(
    Array.from(
      {
        length:
          workerCount,
      },
      () => worker()
    )
  );

  return results;
}
