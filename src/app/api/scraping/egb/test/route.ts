import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  EgbPriceScraperError,
  fetchEgbProductPrice,
} from "@/lib/scraping/egb-price-scraper";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

interface ScrapeRequestBody {
  url?: string;
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      (await request
        .json()
        .catch(
          () => null
        )) as
        | ScrapeRequestBody
        | null;

    const url =
      body?.url?.trim();

    if (!url) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Ürün linki zorunludur.",
        },
        {
          status: 400,
        }
      );
    }

    const result =
      await fetchEgbProductPrice(
        url
      );

    return NextResponse.json({
      success: true,
      message:
        "EGB ürün fiyatı başarıyla alındı.",
      data: {
        source:
          result.source,
        requestedUrl:
          url,
        finalUrl:
          result.finalUrl,
        responseStatus:
          result.responseStatus,
        loggedIn:
          result.loggedIn,
        rawPrice:
          result.rawPrice,
        priceUsd:
          result.priceUsd,
      },
    });
  } catch (error) {
    if (
      error instanceof
      EgbPriceScraperError
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            error.message,
          ...(error.details
            ? {
                data:
                  error.details,
              }
            : {}),
        },
        {
          status:
            error.statusCode,
        }
      );
    }

    console.error(
      "POST /api/scraping/egb/test error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "EGB fiyat kontrolü sırasında hata oluştu.",
      },
      {
        status: 500,
      }
    );
  }
}
