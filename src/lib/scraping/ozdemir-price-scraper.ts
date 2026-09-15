import {
  fetchOzdemirProductPage,
  OzdemirProductPageError,
} from "@/lib/scraping/ozdemir-product-page";
import {
  parseOzdemirProductPriceHtml,
} from "@/lib/scraping/ozdemir-price-parser";
import {
  isOzdemirLoggedInHtml,
} from "@/lib/scraping/ozdemir-session";

export type OzdemirPriceScraperErrorCode =
  | "PRICE_NOT_FOUND"
  | "SESSION_EXPIRED"
  | "OUT_OF_STOCK";

export class OzdemirPriceScraperError extends Error {
  readonly code: OzdemirPriceScraperErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: OzdemirPriceScraperErrorCode,
    statusCode: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "OzdemirPriceScraperError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface OzdemirPriceResult {
  source: "OZDEMIR";
  sourceUrl: string;
  finalUrl: string;
  responseStatus: number;
  loggedIn: boolean;
  loginPerformed: boolean;
  priceUsd: number;
  rawPriceUsd: string;
  listPriceUsd: number | null;
  rawListPriceUsd: string | null;
  priceTry: number | null;
  rawPriceTry: string | null;
}

function normalizeHtmlText(
  value: string
) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Özdemir sayfası HTTP 200 ve fiyatlı olsa bile ürün satışta olmayabilir.
 * Gerçek ürün detay alanındaki iki güvenilir marker'ı kontrol ediyoruz:
 *
 *   <div class="... SOmessage ..."><span>Stokta Yok</span></div>
 *   <p class="stock in-stock">Stokta Yok</p>
 *
 * Sayfanın altındaki önerilen ürünlerde veya JS çeviri metinlerinde geçen
 * "Stokta Yok" ifadelerini availability kararı için kullanmıyoruz.
 */
export function isOzdemirProductOutOfStockHtml(
  html: string
) {
  const statusMessageMatch =
    html.match(
      /<div[^>]*class=["'][^"']*\bSOmessage\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
    );

  if (
    statusMessageMatch &&
    /\bStokta\s+Yok\b/i.test(
      normalizeHtmlText(
        statusMessageMatch[1]
      )
    )
  ) {
    return true;
  }

  const stockParagraphMatches =
    html.matchAll(
      /<p[^>]*class=["'][^"']*\bstock\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi
    );

  for (const match of stockParagraphMatches) {
    if (
      /\bStokta\s+Yok\b/i.test(
        normalizeHtmlText(
          match[1] ?? ""
        )
      )
    ) {
      return true;
    }
  }

  return false;
}

export async function fetchOzdemirProductPrice(
  sourceUrl: string
): Promise<OzdemirPriceResult> {
  const page =
    await fetchOzdemirProductPage(
      sourceUrl
    );

  const loggedIn =
    page.loggedIn &&
    isOzdemirLoggedInHtml(
      page.html
    );

  if (!loggedIn) {
    throw new OzdemirPriceScraperError(
      "Özdemir Elektronik ürün sayfasında bayi oturumu doğrulanamadı.",
      "SESSION_EXPIRED",
      401,
      {
        responseStatus:
          page.responseStatus,
        finalUrl:
          page.finalUrl,
      }
    );
  }

  /*
   * ÖNEMLİ:
   * Özdemir stokta olmayan ürünlerde de fiyat bilgisini HTML içinde tutuyor.
   * Bu nedenle fiyat parse edilmeden ÖNCE stok durumunu kontrol ediyoruz.
   * OUT_OF_STOCK uygulama genelinde 404 ile aynı availability akışına girer.
   */
  if (
    isOzdemirProductOutOfStockHtml(
      page.html
    )
  ) {
    throw new OzdemirPriceScraperError(
      "Özdemir Elektronik ürün stokta bulunmuyor.",
      "OUT_OF_STOCK",
      404,
      {
        responseStatus:
          page.responseStatus,
        finalUrl:
          page.finalUrl,
        availability:
          "OUT_OF_STOCK",
      }
    );
  }

  const parsed =
    parseOzdemirProductPriceHtml(
      page.html
    );

  if (!parsed) {
    throw new OzdemirPriceScraperError(
      "Özdemir Elektronik ürün sayfasında bayi USD fiyatı bulunamadı.",
      "PRICE_NOT_FOUND",
      422,
      {
        responseStatus:
          page.responseStatus,
        finalUrl:
          page.finalUrl,
      }
    );
  }

  return {
    source: "OZDEMIR",
    sourceUrl:
      page.sourceUrl,
    finalUrl:
      page.finalUrl,
    responseStatus:
      page.responseStatus,
    loggedIn,
    loginPerformed:
      page.loginPerformed,
    priceUsd:
      parsed.priceUsd,
    rawPriceUsd:
      parsed.rawPriceUsd,
    listPriceUsd:
      parsed.listPriceUsd,
    rawListPriceUsd:
      parsed.rawListPriceUsd,
    priceTry:
      parsed.priceTry,
    rawPriceTry:
      parsed.rawPriceTry,
  };
}

export {
  OzdemirProductPageError,
};
