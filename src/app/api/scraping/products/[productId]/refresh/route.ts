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
  isProductPriceRefreshAttemptedToday,
  refreshProductPriceIfNeeded,
} from "@/lib/product-price-refresh";

import {
  getProductPriceSource,
  getProductPriceSourceLabel,
  roundCurrency,
} from "@/lib/scraping/product-source-price";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

interface RouteContext {
  params:
    Promise<{
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
    } = await context.params;

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
      typeof product.sourceUrl ===
        "string"
        ? product.sourceUrl.trim()
        : "";

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

    const source =
      getProductPriceSource(
        sourceUrl
      );

    if (!source) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Bu ürün linki için desteklenen fiyat sağlayıcısı bulunamadı.",
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
        ) || 0
      );
    const alreadyCheckedToday =
      isProductPriceRefreshAttemptedToday(
        product
      );

    const refreshed =
      await refreshProductPriceIfNeeded(
        product,
        {
          force: true,
        }
      );

    const currentPriceUsd =
      roundCurrency(
        Number(
          refreshed.priceUsd
        ) || 0
      );
    const differenceUsd =
      roundCurrency(
        currentPriceUsd -
          previousPriceUsd
      );
    const unavailable =
      refreshed.sourceUnavailable ===
      true;

    return NextResponse.json({
      success: true,
      message:
        unavailable
          ? alreadyCheckedToday
            ? "Ürün bugün zaten kontrol edildi; kaynak ürün satışta değil durumunda."
            : `${getProductPriceSourceLabel(source)} ürün kaynağı erişilemiyor veya ürün stokta yok. Fiyat korunarak ürün satışta değil olarak işaretlendi.`
          : alreadyCheckedToday
            ? "Ürün bugün zaten kontrol edildi; tekrar dış istek yapılmadı."
            : differenceUsd === 0
              ? "Ürün fiyatı kontrol edildi; değişiklik yok."
              : "Ürün fiyatı güncellendi.",
      data: {
        productId,
        productCode:
          refreshed.productCode,
        brand:
          refreshed.brand,
        model:
          refreshed.model,
        source,
        sourceUrl,
        previousPriceUsd,
        currentPriceUsd,
        differenceUsd,
        priceChanged:
          differenceUsd !== 0,
        sourceUnavailable:
          unavailable,
        alreadyCheckedToday,
        priceCheckedAt:
          refreshed.priceCheckedAt instanceof Date
            ? refreshed.priceCheckedAt.toISOString()
            : null,
        sourceAvailabilityCheckedAt:
          refreshed.sourceAvailabilityCheckedAt instanceof Date
            ? refreshed.sourceAvailabilityCheckedAt.toISOString()
            : null,
      },
    });
  } catch (error) {
    console.error(
      "POST product price refresh error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Ürün fiyatı güncellenirken hata oluştu.",
      },
      {
        status: 500,
      }
    );
  }
}
