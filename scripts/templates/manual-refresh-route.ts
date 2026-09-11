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
  isEgbUrl,
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

function cleanString(
  value: unknown
) {
  return typeof value === "string"
    ? value.trim()
    : "";
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
      cleanString(
        product.sourceUrl
      );

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

    if (!isEgbUrl(sourceUrl)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Bu ürün linki için desteklenen bir fiyat sağlayıcısı yok.",
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

    const priceChanged =
      currentPriceUsd !==
      previousPriceUsd;

    const unavailable =
      refreshed.sourceUnavailable ===
      true;

    return NextResponse.json({
      success: true,
      message:
        unavailable
          ? alreadyCheckedToday
            ? "Ürün bugün zaten kontrol edildi. EGB ürün sayfası 404 durumunda; mevcut fiyat korunuyor."
            : "EGB ürün sayfası 404 döndü. Fiyat güncellenmedi ve ürün satışta değil olarak işaretlendi."
          : alreadyCheckedToday
            ? "Ürün bugün zaten kontrol edildi. Günlük fiyat kontrolü tekrar çalıştırılmadı."
            : priceChanged
              ? "Ürün fiyatı EGB güncel fiyatıyla güncellendi."
              : "Ürün fiyatı kontrol edildi; değişiklik yok.",
      data: {
        productId,
        productCode:
          refreshed.productCode ??
          "",
        brand:
          refreshed.brand ??
          "",
        model:
          refreshed.model ??
          "",
        source: "EGB",
        sourceUrl,
        previousPriceUsd,
        remotePriceUsd:
          currentPriceUsd,
        currentPriceUsd,
        differenceUsd:
          roundCurrency(
            currentPriceUsd -
              previousPriceUsd
          ),
        priceChanged,
        updated:
          priceChanged,
        checkedToday:
          true,
        sourceUnavailable:
          unavailable,
        ...(refreshed.priceCheckedAt instanceof Date
          ? {
              priceCheckedAt:
                refreshed.priceCheckedAt.toISOString(),
            }
          : {}),
        ...(refreshed.sourceAvailabilityCheckedAt instanceof Date
          ? {
              sourceAvailabilityCheckedAt:
                refreshed.sourceAvailabilityCheckedAt.toISOString(),
            }
          : {}),
      },
    });
  } catch (error) {
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
