import {
  NextResponse,
} from "next/server";

import {
  fetchProductSourcePrice,
  getProductSourceErrorCode,
  getProductSourceErrorStatusCode,
} from "@/lib/scraping/product-source-price";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

interface PriceRequest {
  url?: string;
}

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request
        .json()
        .catch(
          () => null
        )) as
        | PriceRequest
        | null;

    const url =
      typeof body?.url ===
        "string"
        ? body.url.trim()
        : "";

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
      await fetchProductSourcePrice(
        url
      );

    return NextResponse.json({
      success: true,
      message:
        result.source ===
        "EGB"
          ? "EGB ürün fiyatı başarıyla alındı."
          : "Özdemir Elektronik bayi fiyatı başarıyla alındı.",
      data: {
        source:
          result.source,
        requestedUrl:
          url,
        sourceUrl:
          result.sourceUrl,
        finalUrl:
          result.finalUrl,
        responseStatus:
          result.responseStatus,
        loginPerformed:
          result.loginPerformed ??
          false,
        loggedIn:
          result.loggedIn,
        rawPrice:
          result.rawPrice,
        priceUsd:
          result.priceUsd,
        listPriceUsd:
          result.listPriceUsd ??
          null,
        rawListPriceUsd:
          result.rawListPriceUsd ??
          null,
        priceTry:
          result.priceTry ??
          null,
        rawPriceTry:
          result.rawPriceTry ??
          null,
      },
    });
  } catch (error) {
    console.error(
      "POST /api/scraping/products/price error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        code:
          getProductSourceErrorCode(
            error
          ),
        message:
          error instanceof Error
            ? error.message
            : "Ürün fiyatı linkten alınamadı.",
      },
      {
        status:
          getProductSourceErrorStatusCode(
            error
          ),
      }
    );
  }
}
