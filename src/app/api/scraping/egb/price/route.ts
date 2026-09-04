import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  EgbPriceScraperError,
  fetchEgbProductPrice,
  isEgbUrl,
} from "@/lib/scraping/egb-price-scraper";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

interface PriceRequestBody {
  url?: string;
}

function cleanString(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      (await request.json()) as PriceRequestBody;

    const url =
      cleanString(
        body.url
      );

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

    if (!isEgbUrl(url)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Şimdilik yalnızca b2begb.com ürün linkleri destekleniyor.",
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
        "Ürün fiyatı EGB'den alındı.",
      data: result,
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
          data: {
            errorCode:
              error.code,
          },
        },
        {
          status:
            error.statusCode,
        }
      );
    }

    console.error(
      "POST /api/scraping/egb/price error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Ürün fiyatı linkten alınamadı.",
      },
      {
        status: 500,
      }
    );
  }
}
