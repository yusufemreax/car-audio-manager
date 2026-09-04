import {
  EgbSessionError,
  getEgbSessionCookie,
  invalidateEgbSession,
  isEgbLoggedInHtml,
} from "@/lib/scraping/egb-session";

export interface EgbPriceResult {
  source: "EGB";
  sourceUrl: string;
  finalUrl: string;
  responseStatus: number;
  loggedIn: true;
  rawPrice: string;
  priceUsd: number;
}

export type EgbPriceScraperErrorCode =
  | "INVALID_URL"
  | "AUTH_CONFIG_MISSING"
  | "LOGIN_FAILED"
  | "NETWORK_ERROR"
  | "UNEXPECTED_REDIRECT"
  | "HTTP_ERROR"
  | "SESSION_EXPIRED"
  | "PRICE_NOT_FOUND";

export class EgbPriceScraperError extends Error {
  readonly code: EgbPriceScraperErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: EgbPriceScraperErrorCode,
    statusCode: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "EgbPriceScraperError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

const EGB_ALLOWED_HOSTS =
  new Set([
    "www.b2begb.com",
    "b2begb.com",
  ]);

const EGB_FETCH_TIMEOUT_MS =
  15000;

const EGB_FETCH_MAX_ATTEMPTS =
  3;

const EGB_RETRY_DELAYS_MS = [
  500,
  1200,
];

export function roundCurrency(
  value: number
) {
  return Math.round(
    (value + Number.EPSILON) *
      100
  ) / 100;
}

export function isEgbUrl(
  value: string
) {
  try {
    const url =
      new URL(value);

    return (
      url.protocol === "https:" &&
      EGB_ALLOWED_HOSTS.has(
        url.hostname.toLowerCase()
      )
    );
  } catch {
    return false;
  }
}

function parseLocalizedNumber(
  value: string
) {
  let normalized =
    value
      .replace(/USD/gi, "")
      .replace(/\u00a0/g, "")
      .replace(/\s+/g, "")
      .trim();

  if (!normalized) {
    return Number.NaN;
  }

  const commaIndex =
    normalized.lastIndexOf(
      ","
    );
  const dotIndex =
    normalized.lastIndexOf(
      "."
    );

  if (
    commaIndex >= 0 &&
    dotIndex >= 0
  ) {
    if (
      commaIndex > dotIndex
    ) {
      normalized =
        normalized
          .replace(/\./g, "")
          .replace(",", ".");
    } else {
      normalized =
        normalized.replace(
          /,/g,
          ""
        );
    }
  } else if (
    commaIndex >= 0
  ) {
    normalized =
      normalized.replace(
        ",",
        "."
      );
  }

  return Number(normalized);
}

function parseUsdPrice(
  html: string
) {
  const match =
    html.match(
      /<div[^>]*class=["'][^"']*\bproduct-price-new\b[^"']*["'][^>]*>\s*([^<]+?)\s*<\/div>/i
    );

  const rawPrice =
    match?.[1]?.trim();

  if (!rawPrice) {
    return null;
  }

  const priceUsd =
    parseLocalizedNumber(
      rawPrice
    );

  if (
    !Number.isFinite(
      priceUsd
    ) ||
    priceUsd < 0
  ) {
    return null;
  }

  return {
    rawPrice,
    priceUsd:
      roundCurrency(
        priceUsd
      ),
  };
}

function sleep(
  milliseconds: number
) {
  return new Promise<void>(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}

function isRetryableHttpStatus(
  status: number
) {
  return (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : String(error);
}

async function fetchEgbPage(
  sourceUrl: string,
  egbCookie: string
) {
  let lastError:
    unknown = null;

  for (
    let attempt = 1;
    attempt <=
    EGB_FETCH_MAX_ATTEMPTS;
    attempt++
  ) {
    try {
      const response =
        await fetch(
          sourceUrl,
          {
            method: "GET",
            cache: "no-store",
            redirect: "follow",
            signal:
              AbortSignal.timeout(
                EGB_FETCH_TIMEOUT_MS
              ),
            headers: {
              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
              "Accept-Language":
                "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
              Cookie:
                egbCookie,
              Referer:
                "https://www.b2begb.com/",
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
            },
          }
        );

      if (
        isRetryableHttpStatus(
          response.status
        ) &&
        attempt <
          EGB_FETCH_MAX_ATTEMPTS
      ) {
        if (response.body) {
          try {
            await response.body.cancel();
          } catch {
            // Response cleanup failure is not critical.
          }
        }

        await sleep(
          EGB_RETRY_DELAYS_MS[
            attempt - 1
          ] ?? 1200
        );

        continue;
      }

      return response;
    } catch (error) {
      lastError = error;

      if (
        attempt >=
        EGB_FETCH_MAX_ATTEMPTS
      ) {
        break;
      }

      await sleep(
        EGB_RETRY_DELAYS_MS[
          attempt - 1
        ] ?? 1200
      );
    }
  }

  throw new EgbPriceScraperError(
    `EGB bağlantısı ${EGB_FETCH_MAX_ATTEMPTS} denemede kurulamadı.`,
    "NETWORK_ERROR",
    502,
    {
      attempts:
        EGB_FETCH_MAX_ATTEMPTS,
      lastError:
        getErrorMessage(
          lastError
        ),
    }
  );
}

function mapSessionError(
  error: EgbSessionError
) {
  const code:
    EgbPriceScraperErrorCode =
      error.code ===
      "AUTH_CONFIG_MISSING"
        ? "AUTH_CONFIG_MISSING"
        : "LOGIN_FAILED";

  return new EgbPriceScraperError(
    error.message,
    code,
    error.statusCode,
    error.details
  );
}

async function getSessionCookie(
  forceLogin = false
) {
  try {
    return await getEgbSessionCookie({
      forceLogin,
    });
  } catch (error) {
    if (
      error instanceof
      EgbSessionError
    ) {
      throw mapSessionError(
        error
      );
    }

    throw error;
  }
}

async function fetchAuthenticatedProductPage(
  sourceUrl: string
) {
  /*
   * =====================================================
   * 1. EXISTING SESSION / EGB_COOKIE
   * =====================================================
   */

  let cookie =
    await getSessionCookie();

  let response =
    await fetchEgbPage(
      sourceUrl,
      cookie
    );

  if (
    !isEgbUrl(
      response.url
    )
  ) {
    throw new EgbPriceScraperError(
      "EGB isteği beklenmeyen bir adrese yönlendirildi.",
      "UNEXPECTED_REDIRECT",
      502,
      {
        finalUrl:
          response.url,
      }
    );
  }

  let html =
    await response.text();

  /*
   * =====================================================
   * 2. SESSION EXPIRED?
   *
   * Login değilsek backend otomatik giriş yapar ve
   * ürün isteğini SADECE BİR KEZ yeniden dener.
   * =====================================================
   */

  const sessionInvalid =
    response.status === 401 ||
    response.status === 403 ||
    !isEgbLoggedInHtml(
      html
    );

  if (sessionInvalid) {
    invalidateEgbSession();

    cookie =
      await getSessionCookie(
        true
      );

    response =
      await fetchEgbPage(
        sourceUrl,
        cookie
      );

    if (
      !isEgbUrl(
        response.url
      )
    ) {
      throw new EgbPriceScraperError(
        "EGB isteği login sonrasında beklenmeyen bir adrese yönlendirildi.",
        "UNEXPECTED_REDIRECT",
        502,
        {
          finalUrl:
            response.url,
        }
      );
    }

    html =
      await response.text();
  }

  return {
    response,
    html,
  };
}

export async function fetchEgbProductPrice(
  sourceUrl: string
): Promise<EgbPriceResult> {
  const cleanSourceUrl =
    sourceUrl.trim();

  if (
    !isEgbUrl(
      cleanSourceUrl
    )
  ) {
    throw new EgbPriceScraperError(
      "Sadece b2begb.com ürün linkleri kullanılabilir.",
      "INVALID_URL",
      400
    );
  }

  const {
    response,
    html,
  } =
    await fetchAuthenticatedProductPage(
      cleanSourceUrl
    );

  if (!response.ok) {
    throw new EgbPriceScraperError(
      `EGB ürün sayfası alınamadı. HTTP ${response.status}.`,
      "HTTP_ERROR",
      502,
      {
        responseStatus:
          response.status,
        finalUrl:
          response.url,
      }
    );
  }

  if (
    !isEgbLoggedInHtml(
      html
    )
  ) {
    throw new EgbPriceScraperError(
      "EGB otomatik login sonrasında da oturum doğrulanamadı.",
      "SESSION_EXPIRED",
      401,
      {
        loggedIn: false,
        responseStatus:
          response.status,
        finalUrl:
          response.url,
      }
    );
  }

  const parsedPrice =
    parseUsdPrice(
      html
    );

  if (!parsedPrice) {
    throw new EgbPriceScraperError(
      "EGB ürün sayfasında product-price-new alanından USD fiyatı okunamadı.",
      "PRICE_NOT_FOUND",
      422,
      {
        responseStatus:
          response.status,
        finalUrl:
          response.url,
      }
    );
  }

  return {
    source: "EGB",
    sourceUrl:
      cleanSourceUrl,
    finalUrl:
      response.url,
    responseStatus:
      response.status,
    loggedIn: true,
    rawPrice:
      parsedPrice.rawPrice,
    priceUsd:
      parsedPrice.priceUsd,
  };
}
