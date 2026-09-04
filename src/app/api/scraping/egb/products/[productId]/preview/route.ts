import {
  ObjectId,
} from "mongodb";

import {
  NextResponse,
} from "next/server";

import {
  getProductsCollection,
} from "@/lib/products-collection";

import {
  EgbPriceScraperError,
  fetchEgbProductPrice,
  roundCurrency,
} from "@/lib/scraping/egb-price-scraper";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

interface RouteContext {
  params: Promise<{
    productId: string;
  }>;
}

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const {
      productId,
    } =
      await context.params;

    if (
      !ObjectId.isValid(
        productId
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Geçersiz ürün ID.",
        },
        {
          status: 400,
        }
      );
    }

    const products =
      await getProductsCollection();

    const product =
      await products.findOne({
        _id:
          new ObjectId(
            productId
          ),
      });

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Ürün bulunamadı.",
        },
        {
          status: 404,
        }
      );
    }

    const sourceUrl =
      product.sourceUrl
        ?.trim() ?? "";

    if (!sourceUrl) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Bu üründe fiyat alınacak ürün linki tanımlı değil.",
          data: {
            productId,
            productCode:
              product.productCode,
            brand:
              product.brand,
            model:
              product.model,
          },
        },
        {
          status: 422,
        }
      );
    }

    const currentPriceUsd =
      roundCurrency(
        Number(
          product.priceUsd
        )
      );

    if (
      !Number.isFinite(
        currentPriceUsd
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Ürünün mevcut USD fiyatı geçersiz.",
        },
        {
          status: 422,
        }
      );
    }

    const remote =
      await fetchEgbProductPrice(
        sourceUrl
      );

    const differenceUsd =
      roundCurrency(
        remote.priceUsd -
          currentPriceUsd
      );

    const priceChanged =
      remote.priceUsd !==
      currentPriceUsd;

    return NextResponse.json({
      success: true,
      message:
        priceChanged
          ? "EGB fiyatı mevcut ürün fiyatından farklı."
          : "EGB fiyatı mevcut ürün fiyatıyla aynı.",
      data: {
        productId,
        productCode:
          product.productCode,
        brand:
          product.brand,
        model:
          product.model,
        source:
          remote.source,
        sourceUrl,
        currentPriceUsd,
        remotePriceUsd:
          remote.priceUsd,
        rawRemotePrice:
          remote.rawPrice,
        priceChanged,
        differenceUsd,
        responseStatus:
          remote.responseStatus,
        loggedIn:
          remote.loggedIn,
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
      "GET /api/scraping/egb/products/[productId]/preview error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "EGB fiyat karşılaştırması sırasında hata oluştu.",
      },
      {
        status: 500,
      }
    );
  }
}
