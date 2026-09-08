import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ObjectId,
} from "mongodb";

import type {
  ProductPayload,
} from "@/types/product";

import {
  normalizeProductSuppliers,
} from "@/types/supplier";

import {
  isProductCategory,
} from "@/lib/product-config";

import {
  getProductsCollection,
  serializeProduct,
} from "@/lib/products-collection";

import {
  getInventoryCollection,
} from "@/lib/inventory-collection";

import {
  getProductByIdWithFreshPrice,
} from "@/lib/products-service";

import {
  EgbPriceScraperError,
  fetchEgbProductPrice,
  isEgbUrl,
  roundCurrency,
} from "@/lib/scraping/egb-price-scraper";

interface RouteContext {
  params:
    Promise<{
      id: string;
    }>;
}

function cleanString(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}


function getObjectId(
  value: string
) {
  return ObjectId.isValid(
    value
  )
    ? new ObjectId(
        value
      )
    : null;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const {
      id,
    } = await context.params;

    const objectId =
      getObjectId(
        id
      );

    if (!objectId) {
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

    const product =
      await getProductByIdWithFreshPrice(
        objectId
      );

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

    return NextResponse.json({
      success: true,
      data:
        serializeProduct(
          product
        ),
    });
  } catch (error) {
    console.error(
      "GET /api/products/[id] error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Ürün getirilemedi.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const {
      id,
    } = await context.params;

    const objectId =
      getObjectId(
        id
      );

    if (!objectId) {
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

    const body =
      (await request.json()) as ProductPayload;

    const brand =
      cleanString(
        body.brand
      );
    const model =
      cleanString(
        body.model
      );
    const category =
      cleanString(
        body.category
      );
    const suppliers =
      normalizeProductSuppliers(
        body.suppliers,
        false
      );
    const hasSourceUrlField =
      Object.prototype.hasOwnProperty.call(
        body,
        "sourceUrl"
      );
    const requestedSourceUrl =
      cleanString(
        body.sourceUrl
      );

    if (!brand) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Marka zorunludur.",
        },
        {
          status: 400,
        }
      );
    }

    if (!model) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Model zorunludur.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !category ||
      !isProductCategory(
        category
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Geçerli bir ürün kategorisi zorunludur.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      suppliers.length ===
      0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "En az bir tedarikçi seçmelisiniz.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      hasSourceUrlField &&
      requestedSourceUrl &&
      !isEgbUrl(
        requestedSourceUrl
      )
    ) {
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

    const imageUrl =
      cleanString(
        body.imageUrl
      );
    const imagePublicId =
      cleanString(
        body.imagePublicId
      );

    if (
      (imageUrl &&
        !imagePublicId) ||
      (!imageUrl &&
        imagePublicId)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Ürün görsel bilgileri eksik.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      imageUrl &&
      !imageUrl.startsWith(
        "https://res.cloudinary.com/"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Geçersiz ürün görseli adresi.",
        },
        {
          status: 400,
        }
      );
    }

    const collection =
      await getProductsCollection();

    const existing =
      await collection.findOne({
        _id: objectId,
      });

    if (!existing) {
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

    const effectiveSourceUrl =
      hasSourceUrlField
        ? requestedSourceUrl
        : cleanString(
            existing.sourceUrl
          );

    if (
      effectiveSourceUrl &&
      !isEgbUrl(
        effectiveSourceUrl
      )
    ) {
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

    const now =
      new Date();

    let priceUsd: number;

    if (effectiveSourceUrl) {
      /*
       * Linkli üründe fiyat manuel değiştirilemez.
       * PUT sırasında server EGB'den yeniden okur.
       */
      const remotePrice =
        await fetchEgbProductPrice(
          effectiveSourceUrl
        );

      priceUsd =
        roundCurrency(
          remotePrice.priceUsd
        );
    } else {
      priceUsd =
        Number(
          body.priceUsd
        );

      if (
        !Number.isFinite(
          priceUsd
        ) ||
        priceUsd < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "USD fiyatı 0 veya daha büyük olmalıdır.",
          },
          {
            status: 400,
          }
        );
      }
    }

    const subCategory =
      cleanString(
        body.subCategory
      );
    const description =
      cleanString(
        body.description
      );

    await collection.updateOne(
      {
        _id: objectId,
      },
      {
        $set: {
          brand,
          model,
          priceUsd,
          category,
          suppliers,
          ...(effectiveSourceUrl
            ? {
                sourceUrl:
                  effectiveSourceUrl,
                priceCheckedAt:
                  now,
                priceRefreshAttemptedAt:
                  now,
              }
            : {}),
          specifications:
            body.specifications &&
            typeof body.specifications ===
              "object"
              ? body.specifications
              : {},
          updatedAt:
            now,
          ...(subCategory
            ? {
                subCategory,
              }
            : {}),
          ...(description
            ? {
                description,
              }
            : {}),
          ...(imageUrl &&
          imagePublicId
            ? {
                imageUrl,
                imagePublicId,
              }
            : {}),
        },
        $unset: {
          ...(!subCategory
            ? {
                subCategory:
                  "",
              }
            : {}),
          ...(hasSourceUrlField &&
          !requestedSourceUrl
            ? {
                sourceUrl:
                  "",
                priceCheckedAt:
                  "",
                priceRefreshAttemptedAt:
                  "",
              }
            : {}),
          ...(!description
            ? {
                description:
                  "",
              }
            : {}),
          ...(body.removeImage &&
          !(imageUrl &&
            imagePublicId)
            ? {
                imageUrl:
                  "",
                imagePublicId:
                  "",
              }
            : {}),
        },
      }
    );

    const updated =
      await collection.findOne({
        _id: objectId,
      });

    if (!updated) {
      throw new Error(
        "Güncellenen ürün tekrar okunamadı."
      );
    }

    return NextResponse.json({
      success: true,
      data:
        serializeProduct(
          updated
        ),
    });
  } catch (error) {
    console.error(
      "PUT /api/products/[id] error:",
      error
    );

    if (
      error instanceof
        EgbPriceScraperError
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            error.message,
        },
        {
          status:
            error.statusCode,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Ürün güncellenemedi.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const {
      id,
    } = await context.params;

    const objectId =
      getObjectId(
        id
      );

    if (!objectId) {
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

    const existing =
      await products.findOne({
        _id: objectId,
      });

    if (!existing) {
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

    const inventory =
      await getInventoryCollection();

    const inventoryRecord =
      await inventory.findOne({
        productId: objectId,
    });

    if (
      inventoryRecord &&
      Number(
        inventoryRecord.quantity
      ) > 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stokta bulunan ürün silinemez. Önce stok miktarını sıfırlayın.",
        },
        {
          status: 409,
        }
      );
    }

    await inventory.deleteMany({
      productId: objectId,
    });

    await products.deleteOne({
      _id: objectId,
    });

    return NextResponse.json({
      success: true,
      data: null,
    });
  } catch (error) {
    console.error(
      "DELETE /api/products/[id] error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Ürün silinemedi.",
      },
      {
        status: 500,
      }
    );
  }
}
