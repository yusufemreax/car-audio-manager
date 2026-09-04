import {
  EgbSessionError,
  getEgbSessionCookie,
  invalidateEgbSession,
  isEgbLoggedInHtml,
} from "@/lib/scraping/egb-session";

export const EGB_HOME_URL = "https://www.b2begb.com/";

const EGB_ALLOWED_HOSTS = new Set([
  "www.b2begb.com",
  "b2begb.com",
]);

const EGB_FETCH_TIMEOUT_MS = 15_000;
const EGB_FETCH_MAX_ATTEMPTS = 3;
const EGB_RETRY_DELAYS_MS = [500, 1_200];

type CurrencyMap = Record<string, number>;
type CurrencyVariableName = "currencies" | "exportDefaultCurrency";

export interface EgbExchangeRateResult {
  source: "EGB";
  sourceUrl: string;
  finalUrl: string;
  responseStatus: number;
  loggedIn: true;
  rawRate: string;
  rate: number;
  fetchedAt: Date;
  rateSource: "currencies.USD" | "exportDefaultCurrency.USD";
}

export type EgbExchangeRateScraperErrorCode =
  | "AUTH_CONFIG_MISSING"
  | "LOGIN_FAILED"
  | "NETWORK_ERROR"
  | "UNEXPECTED_REDIRECT"
  | "HTTP_ERROR"
  | "SESSION_EXPIRED"
  | "RATE_NOT_FOUND"
  | "INVALID_RATE";

export class EgbExchangeRateScraperError extends Error {
  readonly code: EgbExchangeRateScraperErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: EgbExchangeRateScraperErrorCode,
    statusCode: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "EgbExchangeRateScraperError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isRetryableHttpStatus(status: number) {
  return (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

function isEgbUrl(value: string) {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      EGB_ALLOWED_HOSTS.has(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

/**
 * EGB ana sayfasında kur verileri HTML div'inin içinde değil,
 * sayfanın script bölümündeki global değişkenlerde geliyor:
 *
 * currencies = {"TL":1,"USD":48.3668,"EUR":55.8934,"GBP":65.2762}
 *
 * Bu helper sadece ilgili değişkenin ilk { ... } bloğunu brace-depth
 * ile ayırır. Böylece aynı script satırındaki sonraki değişkenler
 * yanlışlıkla JSON'a dahil edilmez.
 */
export function extractCurrencyObjectLiteral(
  html: string,
  variableName: CurrencyVariableName
): string | null {
  const assignmentPattern = new RegExp(
    `\\b${variableName}\\s*=\\s*`,
    "i"
  );
  const assignmentMatch = assignmentPattern.exec(html);

  if (!assignmentMatch) {
    return null;
  }

  const searchStart = assignmentMatch.index + assignmentMatch[0].length;
  const openBraceIndex = html.indexOf("{", searchStart);

  if (openBraceIndex < 0) {
    return null;
  }

  let depth = 0;
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (let index = openBraceIndex; index < html.length; index += 1) {
    const char = html[index];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return html.slice(openBraceIndex, index + 1);
      }
    }
  }

  return null;
}

function parseCurrencyObject(
  html: string,
  variableName: CurrencyVariableName
): CurrencyMap | null {
  const rawObject = extractCurrencyObjectLiteral(html, variableName);

  if (!rawObject) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawObject) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const result: CurrencyMap = {};

    for (const [key, value] of Object.entries(parsed)) {
      const numericValue = Number(value);

      if (Number.isFinite(numericValue)) {
        result[key] = numericValue;
      }
    }

    return result;
  } catch {
    return null;
  }
}

function parseUsdDirectly(
  html: string,
  variableName: CurrencyVariableName
): number | null {
  const rawObject = extractCurrencyObjectLiteral(html, variableName);

  if (!rawObject) {
    return null;
  }

  const usdMatch = rawObject.match(
    /["']USD["']\s*:\s*([0-9]+(?:[.,][0-9]+)?)/i
  );

  if (!usdMatch?.[1]) {
    return null;
  }

  const value = Number(usdMatch[1].replace(",", "."));

  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * EGB HTML'inden USD/TRY kurunu okur.
 *
 * Öncelik:
 * 1) currencies.USD
 * 2) exportDefaultCurrency.USD
 *
 * div.dolar bilinçli olarak kullanılmaz; backend fetch cevabında bu div
 * boştur ve tarayıcı tarafında JavaScript ile sonradan doldurulur.
 */
export function parseEgbUsdTryRate(html: string) {
  const currencies = parseCurrencyObject(html, "currencies");
  const exportDefaultCurrency = parseCurrencyObject(
    html,
    "exportDefaultCurrency"
  );

  const usdFromCurrencies =
    currencies?.USD ?? parseUsdDirectly(html, "currencies");

  const usdFromExportDefault =
    exportDefaultCurrency?.USD ??
    parseUsdDirectly(html, "exportDefaultCurrency");

  const rate =
    typeof usdFromCurrencies === "number"
      ? usdFromCurrencies
      : typeof usdFromExportDefault === "number"
        ? usdFromExportDefault
        : null;

  if (rate === null) {
    throw new EgbExchangeRateScraperError(
      "EGB ana sayfasındaki script içinde currencies.USD veya exportDefaultCurrency.USD bulunamadı.",
      "RATE_NOT_FOUND",
      422,
      {
        hasCurrenciesAssignment: /\bcurrencies\s*=\s*\{/i.test(html),
        hasExportDefaultCurrencyAssignment:
          /\bexportDefaultCurrency\s*=\s*\{/i.test(html),
        htmlLength: html.length,
      }
    );
  }

  if (!Number.isFinite(rate) || rate <= 0 || rate >= 1_000) {
    throw new EgbExchangeRateScraperError(
      `EGB USD kuru geçersiz görünüyor: ${String(rate)}`,
      "INVALID_RATE",
      422,
      { rate }
    );
  }

  return {
    rawRate: String(rate),
    rate,
    rateSource:
      typeof usdFromCurrencies === "number"
        ? ("currencies.USD" as const)
        : ("exportDefaultCurrency.USD" as const),
  };
}

async function fetchEgbHomePage(cookie: string) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= EGB_FETCH_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(EGB_HOME_URL, {
        method: "GET",
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(EGB_FETCH_TIMEOUT_MS),
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          Cookie: cookie,
          Referer: EGB_HOME_URL,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
        },
      });

      if (
        isRetryableHttpStatus(response.status) &&
        attempt < EGB_FETCH_MAX_ATTEMPTS
      ) {
        if (response.body) {
          try {
            await response.body.cancel();
          } catch {
            // Cleanup failure is not critical.
          }
        }

        await sleep(EGB_RETRY_DELAYS_MS[attempt - 1] ?? 1_200);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;

      if (attempt >= EGB_FETCH_MAX_ATTEMPTS) {
        break;
      }

      await sleep(EGB_RETRY_DELAYS_MS[attempt - 1] ?? 1_200);
    }
  }

  throw new EgbExchangeRateScraperError(
    `EGB ana sayfasına ${EGB_FETCH_MAX_ATTEMPTS} denemede bağlanılamadı.`,
    "NETWORK_ERROR",
    502,
    {
      attempts: EGB_FETCH_MAX_ATTEMPTS,
      lastError: getErrorMessage(lastError),
    }
  );
}

function mapSessionError(error: EgbSessionError) {
  const code: EgbExchangeRateScraperErrorCode =
    error.code === "AUTH_CONFIG_MISSING"
      ? "AUTH_CONFIG_MISSING"
      : "LOGIN_FAILED";

  return new EgbExchangeRateScraperError(
    error.message,
    code,
    error.statusCode,
    error.details
  );
}

async function getSessionCookie(forceLogin = false) {
  try {
    return await getEgbSessionCookie({ forceLogin });
  } catch (error) {
    if (error instanceof EgbSessionError) {
      throw mapSessionError(error);
    }

    throw error;
  }
}

async function fetchAuthenticatedHomePage() {
  let cookie = await getSessionCookie();
  let response = await fetchEgbHomePage(cookie);

  if (!isEgbUrl(response.url)) {
    throw new EgbExchangeRateScraperError(
      "EGB kur isteği beklenmeyen bir adrese yönlendirildi.",
      "UNEXPECTED_REDIRECT",
      502,
      { finalUrl: response.url }
    );
  }

  let html = await response.text();

  const sessionInvalid =
    response.status === 401 ||
    response.status === 403 ||
    !isEgbLoggedInHtml(html);

  if (sessionInvalid) {
    invalidateEgbSession();

    cookie = await getSessionCookie(true);
    response = await fetchEgbHomePage(cookie);

    if (!isEgbUrl(response.url)) {
      throw new EgbExchangeRateScraperError(
        "EGB kur isteği login sonrasında beklenmeyen bir adrese yönlendirildi.",
        "UNEXPECTED_REDIRECT",
        502,
        { finalUrl: response.url }
      );
    }

    html = await response.text();
  }

  return { response, html };
}

export async function fetchEgbUsdTryRate(): Promise<EgbExchangeRateResult> {
  const { response, html } = await fetchAuthenticatedHomePage();

  if (!response.ok) {
    throw new EgbExchangeRateScraperError(
      `EGB ana sayfası alınamadı. HTTP ${response.status}.`,
      "HTTP_ERROR",
      502,
      {
        responseStatus: response.status,
        finalUrl: response.url,
      }
    );
  }

  if (!isEgbLoggedInHtml(html)) {
    throw new EgbExchangeRateScraperError(
      "EGB otomatik login sonrasında oturum doğrulanamadı.",
      "SESSION_EXPIRED",
      401,
      {
        loggedIn: false,
        responseStatus: response.status,
        finalUrl: response.url,
      }
    );
  }

  const parsed = parseEgbUsdTryRate(html);

  return {
    source: "EGB",
    sourceUrl: EGB_HOME_URL,
    finalUrl: response.url,
    responseStatus: response.status,
    loggedIn: true,
    rawRate: parsed.rawRate,
    rate: parsed.rate,
    rateSource: parsed.rateSource,
    fetchedAt: new Date(),
  };
}
