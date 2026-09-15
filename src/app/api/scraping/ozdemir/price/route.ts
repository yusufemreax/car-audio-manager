import { NextResponse } from "next/server";

import {
  fetchOzdemirProductPrice,
  OzdemirPriceScraperError,
} from "@/lib/scraping/ozdemir-price-scraper";
import {
  OzdemirProductPageError,
} from "@/lib/scraping/ozdemir-product-page";
import {
  OzdemirSessionError,
} from "@/lib/scraping/ozdemir-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PriceRequestBody {
  url?: string;
}

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as
        PriceRequestBody;

    const sourceUrl =
      body.url?.trim();

    if (!sourceUrl) {
      return NextResponse.json(
        {
          success: false,
          message:
            "url alanı zorunludur.",
        },
        {
          status: 400,
        }
      );
    }

    const result =
      await fetchOzdemirProductPrice(
        sourceUrl
      );

    return NextResponse.json({
      success: true,
      message:
        "Özdemir Elektronik bayi fiyatı başarıyla alındı.",
      data: {
        source:
          result.source,
        requestedUrl:
          result.sourceUrl,
        finalUrl:
          result.finalUrl,
        responseStatus:
          result.responseStatus,
        loginPerformed:
          result.loginPerformed,
        loggedIn:
          result.loggedIn,
        rawPriceUsd:
          result.rawPriceUsd,
        priceUsd:
          result.priceUsd,
        rawListPriceUsd:
          result.rawListPriceUsd,
        listPriceUsd:
          result.listPriceUsd,
        rawPriceTry:
          result.rawPriceTry,
        priceTry:
          result.priceTry,
      },
    });
  } catch (error) {
    if (
      error instanceof
        OzdemirSessionError ||
      error instanceof
        OzdemirProductPageError ||
      error instanceof
        OzdemirPriceScraperError
    ) {
      return NextResponse.json(
        {
          success: false,
          code: error.code,
          message:
            error.message,
          data:
            error.details ??
            null,
        },
        {
          status:
            error.statusCode,
        }
      );
    }

    console.error(
      "POST /api/scraping/ozdemir/price error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Özdemir fiyat kontrolü sırasında beklenmeyen hata oluştu.",
      },
      {
        status: 500,
      }
    );
  }
}
