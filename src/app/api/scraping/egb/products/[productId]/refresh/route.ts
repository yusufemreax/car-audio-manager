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

export async function POST(
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

    const objectId =
      new ObjectId(
        productId
      );

    const product =
      await products.findOne({
        _id: objectId,
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
        },
        {
          status: 422,
        }
      );
    }

    const previousPriceUsd =
      roundCurrency(
        Number(
          product.priceUsd
        )
      );

    if (
      !Number.isFinite(
        previousPriceUsd
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
          previousPriceUsd
      );

    const priceChanged =
      remote.priceUsd !==
      previousPriceUsd;

    if (!priceChanged) {
      return NextResponse.json({
        success: true,
        message:
          "Ürün fiyatı zaten güncel.",
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
          previousPriceUsd,
          remotePriceUsd:
            remote.priceUsd,
          currentPriceUsd:
            previousPriceUsd,
          rawRemotePrice:
            remote.rawPrice,
          differenceUsd: 0,
          priceChanged: false,
          updated: false,
        },
      });
    }

    const now =
      new Date();

    const updateResult =
      await products.updateOne(
        {
          _id: objectId,
        },
        {
          $set: {
            priceUsd:
              remote.priceUsd,
            updatedAt:
              now,
          },
        }
      );

    if (
      updateResult.matchedCount !==
      1
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Ürün fiyatı MongoDB üzerinde güncellenemedi.",
        },
        {
          status: 500,
        }
      );
    }

    const updatedProduct =
      await products.findOne({
        _id: objectId,
      });

    if (!updatedProduct) {
      throw new Error(
        "Güncellenen ürün tekrar okunamadı."
      );
    }

    const savedPriceUsd =
      roundCurrency(
        Number(
          updatedProduct.priceUsd
        )
      );

    if (
      savedPriceUsd !==
      remote.priceUsd
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Ürün fiyatı güncellendi ancak MongoDB doğrulaması başarısız oldu.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Ürün fiyatı EGB güncel fiyatıyla güncellendi.",
      data: {
        productId,
        productCode:
          updatedProduct.productCode,
        brand:
          updatedProduct.brand,
        model:
          updatedProduct.model,
        source:
          remote.source,
        sourceUrl,
        previousPriceUsd,
        remotePriceUsd:
          remote.priceUsd,
        currentPriceUsd:
          savedPriceUsd,
        rawRemotePrice:
          remote.rawPrice,
        differenceUsd,
        priceChanged: true,
        updated: true,
        updatedAt:
          updatedProduct.updatedAt.toISOString(),
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
      "POST /api/scraping/egb/products/[productId]/refresh error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "EGB fiyat güncellemesi sırasında hata oluştu.",
      },
      {
        status: 500,
      }
    );
  }
}
