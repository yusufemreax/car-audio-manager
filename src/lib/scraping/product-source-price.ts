import {
  EgbPriceScraperError,
  fetchEgbProductPrice,
  isEgbUrl,
} from "@/lib/scraping/egb-price-scraper";
import {
  fetchOzdemirProductPrice,
  OzdemirProductPageError,
  OzdemirPriceScraperError,
} from "@/lib/scraping/ozdemir-price-scraper";
import {
  isOzdemirUrl,
  OzdemirSessionError,
} from "@/lib/scraping/ozdemir-session";

export type ProductPriceSource =
  | "EGB"
  | "OZDEMIR";

export interface ProductSourcePriceResult {
  source: ProductPriceSource;
  sourceUrl: string;
  finalUrl: string;
  responseStatus: number;
  loggedIn: boolean;
  loginPerformed?: boolean;
  rawPrice: string;
  priceUsd: number;
  listPriceUsd?: number | null;
  rawListPriceUsd?: string | null;
  priceTry?: number | null;
  rawPriceTry?: string | null;
}

export class ProductSourcePriceError extends Error {
  readonly code:
    | "INVALID_URL"
    | "UNSUPPORTED_SOURCE";
  readonly statusCode: number;

  constructor(
    message: string,
    code:
      | "INVALID_URL"
      | "UNSUPPORTED_SOURCE",
    statusCode = 400
  ) {
    super(message);
    this.name = "ProductSourcePriceError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function roundCurrency(
  value: number
) {
  return Math.round(
    (value + Number.EPSILON) *
      100
  ) / 100;
}

export function getProductPriceSource(
  value: string
): ProductPriceSource | null {
  const cleanValue =
    value.trim();

  if (!cleanValue) {
    return null;
  }

  if (isEgbUrl(cleanValue)) {
    return "EGB";
  }

  if (
    isOzdemirUrl(
      cleanValue
    )
  ) {
    return "OZDEMIR";
  }

  return null;
}

export function isSupportedProductSourceUrl(
  value: string
) {
  return (
    getProductPriceSource(
      value
    ) !== null
  );
}

export function getProductPriceSourceLabel(
  source: ProductPriceSource
) {
  return source === "EGB"
    ? "EGB"
    : "Özdemir Elektronik";
}

export async function fetchProductSourcePrice(
  sourceUrl: string
): Promise<ProductSourcePriceResult> {
  const cleanSourceUrl =
    sourceUrl.trim();

  if (!cleanSourceUrl) {
    throw new ProductSourcePriceError(
      "Ürün linki zorunludur.",
      "INVALID_URL",
      400
    );
  }

  const source =
    getProductPriceSource(
      cleanSourceUrl
    );

  if (!source) {
    throw new ProductSourcePriceError(
      "Yalnızca b2begb.com veya ozdemirelektronik.com ürün linkleri destekleniyor.",
      "UNSUPPORTED_SOURCE",
      400
    );
  }

  if (source === "EGB") {
    const result =
      await fetchEgbProductPrice(
        cleanSourceUrl
      );

    return {
      source: "EGB",
      sourceUrl:
        result.sourceUrl,
      finalUrl:
        result.finalUrl,
      responseStatus:
        result.responseStatus,
      loggedIn:
        result.loggedIn,
      loginPerformed:
        false,
      rawPrice:
        result.rawPrice,
      priceUsd:
        roundCurrency(
          result.priceUsd
        ),
      listPriceUsd: null,
      rawListPriceUsd: null,
      priceTry: null,
      rawPriceTry: null,
    };
  }

  const result =
    await fetchOzdemirProductPrice(
      cleanSourceUrl
    );

  return {
    source: "OZDEMIR",
    sourceUrl:
      result.sourceUrl,
    finalUrl:
      result.finalUrl,
    responseStatus:
      result.responseStatus,
    loggedIn:
      result.loggedIn,
    loginPerformed:
      result.loginPerformed,
    rawPrice:
      result.rawPriceUsd,
    priceUsd:
      roundCurrency(
        result.priceUsd
      ),
    listPriceUsd:
      result.listPriceUsd,
    rawListPriceUsd:
      result.rawListPriceUsd,
    priceTry:
      result.priceTry,
    rawPriceTry:
      result.rawPriceTry,
  };
}

function getDetailsResponseStatus(
  error: unknown
) {
  if (
    error &&
    typeof error === "object" &&
    "details" in error
  ) {
    const details =
      (
        error as {
          details?: Record<
            string,
            unknown
          >;
        }
      ).details;

    return Number(
      details?.responseStatus
    );
  }

  return Number.NaN;
}

export function isProductSourceNotFoundError(
  error: unknown
) {
  /*
   * Özdemir stokta-yok durumu HTTP 200 ile gelebilir.
   * Uygulama davranışı açısından bunu gerçek 404 ile aynı kabul ediyoruz:
   * fiyat korunur ve sourceUnavailable=true yapılır.
   */
  if (
    error instanceof
      OzdemirPriceScraperError &&
    error.code ===
      "OUT_OF_STOCK"
  ) {
    return true;
  }

  if (
    error instanceof
      EgbPriceScraperError ||
    error instanceof
      OzdemirProductPageError
  ) {
    return (
      error.code ===
        "HTTP_ERROR" &&
      getDetailsResponseStatus(
        error
      ) === 404
    );
  }

  return false;
}

export function getProductSourceErrorStatusCode(
  error: unknown
) {
  if (
    isProductSourceNotFoundError(
      error
    )
  ) {
    return 404;
  }

  if (
    error instanceof
      ProductSourcePriceError ||
    error instanceof
      EgbPriceScraperError ||
    error instanceof
      OzdemirProductPageError ||
    error instanceof
      OzdemirPriceScraperError ||
    error instanceof
      OzdemirSessionError
  ) {
    return error.statusCode;
  }

  return 500;
}

export function getProductSourceErrorCode(
  error: unknown
) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (
      error as {
        code?: unknown;
      }
    ).code === "string"
  ) {
    return (
      error as {
        code: string;
      }
    ).code;
  }

  return "UNKNOWN_ERROR";
}
