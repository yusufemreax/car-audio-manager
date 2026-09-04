import { NextResponse } from "next/server";

import {
  EgbSessionError,
  getEgbSessionCookie,
  invalidateEgbSession,
  isEgbLoggedInHtml,
} from "@/lib/scraping/egb-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EGB_HOME_URL = "https://www.b2begb.com/";
const REQUEST_TIMEOUT_MS = 15_000;

type CurrencyMap = Record<string, number>;

type CurrencyVariableName = "currencies" | "exportDefaultCurrency";

/**
 * EGB ana sayfasinda degiskenler su sekilde tanimlaniyor:
 * currencies = {"TL":1,"USD":48.3668,"EUR":55.8934,"GBP":65.2762},pageParams = {}
 *
 * Onceki testte /\{[^;]+\}/ kalibi tum script satirini yakaladigi icin JSON.parse basarisiz oluyordu.
 * Bu helper sadece degiskenin ilk { ... } blogunu brace-depth ile ayirir.
 */
function extractObjectLiteral(
  html: string,
  variableName: CurrencyVariableName
): string | null {
  const assignmentPattern = new RegExp(`\\b${variableName}\\s*=\\s*`, "i");
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
  const rawObject = extractObjectLiteral(html, variableName);

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

/**
 * Ek guvenlik: obje JSON parse edilemese bile ayni degisken blogundaki USD sayisini direkt okuyabiliriz.
 */
function parseUsdDirectly(
  html: string,
  variableName: CurrencyVariableName
): number | null {
  const rawObject = extractObjectLiteral(html, variableName);

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

async function fetchHomepage(cookie: string) {
  return fetch(EGB_HOME_URL, {
    method: "GET",
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const forceLogin = url.searchParams.get("forceLogin") === "1";

  try {
    if (forceLogin) {
      invalidateEgbSession();
    }

    let cookie = await getEgbSessionCookie({ forceLogin });
    let response = await fetchHomepage(cookie);
    let html = await response.text();

    const sessionInvalid =
      response.status === 401 ||
      response.status === 403 ||
      !isEgbLoggedInHtml(html);

    if (sessionInvalid) {
      invalidateEgbSession();
      cookie = await getEgbSessionCookie({ forceLogin: true });
      response = await fetchHomepage(cookie);
      html = await response.text();
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: `EGB ana sayfası alınamadı. HTTP ${response.status}.`,
          data: {
            finalUrl: response.url,
            responseStatus: response.status,
          },
        },
        { status: 502 }
      );
    }

    const rawCurrencies = extractObjectLiteral(html, "currencies");
    const rawExportDefaultCurrency = extractObjectLiteral(
      html,
      "exportDefaultCurrency"
    );

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

    return NextResponse.json({
      success: rate !== null,
      message:
        rate !== null
          ? "EGB HTML script içindeki USD kuru başarıyla okundu."
          : "EGB HTML script içinde USD kuru bulunamadı.",
      data: {
        requestedUrl: EGB_HOME_URL,
        finalUrl: response.url,
        responseStatus: response.status,
        loggedIn: isEgbLoggedInHtml(html),
        htmlLength: html.length,
        rate,
        rateSource:
          typeof usdFromCurrencies === "number"
            ? "currencies.USD"
            : typeof usdFromExportDefault === "number"
              ? "exportDefaultCurrency.USD"
              : null,
        currencies,
        exportDefaultCurrency,
        rawCurrenciesAssignment: rawCurrencies,
        rawExportDefaultCurrencyAssignment: rawExportDefaultCurrency,
        dolarDivMatch:
          html.match(
            /<div[^>]*class=["'][^"']*\bdolar\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
          )?.[0] ?? null,
      },
    });
  } catch (error) {
    const message =
      error instanceof EgbSessionError
        ? error.message
        : error instanceof Error
          ? error.message
          : "EGB kur test isteği sırasında bilinmeyen hata oluştu.";

    console.error("GET /api/scraping/egb/exchange-rate-test error:", error);

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: error instanceof EgbSessionError ? error.statusCode : 500,
      }
    );
  }
}
