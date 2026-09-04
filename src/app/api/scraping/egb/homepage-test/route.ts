import { NextResponse } from "next/server";

import {
  getEgbSessionCookie,
  isEgbLoggedInHtml,
} from "@/lib/scraping/egb-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EGB_HOME_URL = "https://www.b2begb.com/";

const EGB_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";

function isTruthy(value: string | null) {
  if (!value) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(
    value.trim().toLowerCase()
  );
}

function countMatches(value: string, pattern: RegExp) {
  return Array.from(value.matchAll(pattern)).length;
}

function getSnippet(html: string, needle: string, radius = 400) {
  const index = html.toLowerCase().indexOf(needle.toLowerCase());

  if (index < 0) {
    return null;
  }

  const start = Math.max(0, index - radius);
  const end = Math.min(html.length, index + needle.length + radius);

  return html.slice(start, end);
}

async function fetchEgbHomepage(cookie: string) {
  const headers = new Headers();

  headers.set(
    "Accept",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
  );
  headers.set(
    "Accept-Language",
    "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7"
  );
  headers.set("Cache-Control", "no-cache");
  headers.set("Pragma", "no-cache");
  headers.set("Referer", EGB_HOME_URL);
  headers.set("User-Agent", EGB_USER_AGENT);
  headers.set("Cookie", cookie);

  return fetch(EGB_HOME_URL, {
    method: "GET",
    cache: "no-store",
    redirect: "follow",
    headers,
    signal: AbortSignal.timeout(20000),
  });
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const forceLogin = isTruthy(
      requestUrl.searchParams.get("forceLogin")
    );
    const format =
      requestUrl.searchParams.get("format")?.trim().toLowerCase() ??
      "html";

    /*
     * Bu endpoint SADECE test icindir.
     * Kur parse etmez, DB'ye yazmaz, exchange-rate servisini kullanmaz.
     * Amac backend'in EGB'den gercekte aldigi HTML'i oldugu gibi gormektir.
     */
    const cookie = await getEgbSessionCookie({
      forceLogin,
    });

    const response = await fetchEgbHomepage(cookie);
    const html = await response.text();

    const loggedIn = isEgbLoggedInHtml(html);

    const ideaCurCount = countMatches(
      html,
      /class\s*=\s*["'][^"']*\bideaCur\b[^"']*["']/gi
    );

    const dolarClassCount = countMatches(
      html,
      /class\s*=\s*["'][^"']*\bdolar\b[^"']*["']/gi
    );

    const containsExactExpectedStructure =
      /<div\s+class=["']ideaCur["']\s*>\s*<span\s*>\s*Dolar\s*:\s*<\/span>\s*<div\s+class=["']dolar["']\s*>/i.test(
        html
      );

    const debug = {
      requestedUrl: EGB_HOME_URL,
      finalUrl: response.url,
      responseStatus: response.status,
      responseOk: response.ok,
      loggedIn,
      htmlLength: html.length,
      ideaCurCount,
      dolarClassCount,
      containsIdeaCur: ideaCurCount > 0,
      containsDolarClass: dolarClassCount > 0,
      containsExactExpectedStructure,
      ideaCurSnippet: getSnippet(html, "ideaCur", 500),
      dolarSnippet: getSnippet(html, 'class="dolar"', 500),
    };

    if (format === "json") {
      return NextResponse.json({
        success: true,
        message: "EGB ana sayfa HTML'i test amaciyla alindi.",
        data: {
          ...debug,
          html,
        },
      });
    }

    return new Response(html, {
      status: response.status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-EGB-Requested-Url": EGB_HOME_URL,
        "X-EGB-Final-Url": response.url,
        "X-EGB-Response-Status": String(response.status),
        "X-EGB-Logged-In": String(loggedIn),
        "X-EGB-Html-Length": String(html.length),
        "X-EGB-IdeaCur-Count": String(ideaCurCount),
        "X-EGB-Dolar-Class-Count": String(dolarClassCount),
        "X-EGB-Exact-Structure": String(containsExactExpectedStructure),
      },
    });
  } catch (error) {
    console.error(
      "GET /api/scraping/egb/homepage-test error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "EGB ana sayfa test istegi sirasinda hata olustu.",
      },
      {
        status: 500,
      }
    );
  }
}
