import type {
  WithId,
} from "mongodb";

import {
  getProductsCollection,
  type ProductDocument,
} from "@/lib/products-collection";

import {
  EgbPriceScraperError,
  fetchEgbProductPrice,
  isEgbUrl,
  roundCurrency,
} from "@/lib/scraping/egb-price-scraper";

export const PRODUCT_PRICE_REFRESH_TTL_MS =
  5 * 60 * 1000;

const PRODUCT_PRICE_REFRESH_CONCURRENCY =
  3;

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
      product.priceCheckedAt
    )
  ) {
    return product.priceCheckedAt;
  }

  return null;
}

export function isProductPriceFresh(
  product: WithId<ProductDocument>,
  now = new Date()
) {
  const sourceUrl =
    cleanString(
      product.sourceUrl
    );

  /*
   * Linki olmayan ürünlerde dış fiyat kaynağı yok.
   * Bu yüzden MongoDB'deki kayıt doğrudan güncel kabul edilir.
   */
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
    now.getTime() -
      lastAttemptAt.getTime() <
    PRODUCT_PRICE_REFRESH_TTL_MS
  );
}

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
    ...(priceChanged
      ? {
          updatedAt:
            checkedAt,
        }
      : {}),
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

  /*
   * Şimdilik canlı fiyat sağlayıcımız EGB.
   * Başka bir tedarikçi scraper'ı geldiğinde burada
   * provider seçimi genişletilebilir.
   */
  if (!isEgbUrl(sourceUrl)) {
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
      await fetchEgbProductPrice(
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

    if (priceChanged) {
      /*
       * Ürün bu sırada kullanıcı tarafından değiştirilmişse
       * eski fiyatın üzerine körlemesine yazmıyoruz.
       */
      const updateResult =
        await products.updateOne(
          {
            _id: product._id,
            sourceUrl,
            priceUsd:
              product.priceUsd,
          },
          {
            $set: {
              priceUsd:
                remotePriceUsd,
              priceCheckedAt:
                attemptedAt,
              priceRefreshAttemptedAt:
                attemptedAt,
              updatedAt:
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
        true
      );
    }

    /*
     * Fiyat aynıysa ürünün business updatedAt alanını
     * değiştirmiyoruz. Yalnızca fiyat kontrol zamanları ilerler.
     */
    const updateResult =
      await products.updateOne(
        {
          _id: product._id,
          sourceUrl,
        },
        {
          $set: {
            priceCheckedAt:
              attemptedAt,
            priceRefreshAttemptedAt:
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
      previousPriceUsd,
      false
    );
  } catch (error) {
    /*
     * EGB geçici olarak erişilemezse uygulamanın ürün okuma
     * akışını bozmuyoruz. Eski Mongo fiyatıyla devam ediyoruz.
     * Ancak aynı hatayı her request'te tekrar denememek için
     * attempt zamanını kaydediyoruz; 5 dakika sonra yeniden denenir.
     */
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
      error instanceof
        EgbPriceScraperError
        ? `${error.code}: ${error.message}`
        : error instanceof Error
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
  options?: {
    force?: boolean;
  }
): Promise<WithId<ProductDocument>> {
  const force =
    options?.force === true;

  if (
    !force &&
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
    products.length ===
    0
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
