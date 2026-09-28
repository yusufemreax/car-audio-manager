import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  MongoServerError,
  ObjectId,
} from "mongodb";

import type {
  ProductPayload,
} from "@/types/product";

import {
  normalizeProductSuppliers,
} from "@/types/supplier";

import {
  getProductsCollection,
  serializeProduct,
} from "@/lib/products-collection";

import {
  getInventoryCollection,
} from "@/lib/inventory-collection";

import {
  getProductsWithFreshPrices,
} from "@/lib/products-service";

import {
  getNextProductCode,
} from "@/lib/product-code";

import {
  isProductCategory,
} from "@/lib/product-config";

import {
  buildProductVehicleCompatibility,
  ProductVehicleCompatibilityError,
} from "@/lib/product-vehicle-compatibility";

import {
  getProductSourceErrorStatusCode,
} from "@/lib/scraping/product-source-price";

import {
  resolveProductSupplierPrices,
} from "@/lib/product-supplier-prices";

function cleanString(
  value: unknown
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export async function GET(
  request: NextRequest
) {
  try {
    const category =
      request.nextUrl.searchParams.get(
        "category"
      );

    if (
      category &&
      !isProductCategory(
        category
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Geçersiz ürün kategorisi.",
        },
        {
          status: 400,
        }
      );
    }

    let products =
      await getProductsWithFreshPrices(
        category &&
        isProductCategory(
          category
        )
          ? category
          : undefined
      );

    const compatibleVehicleGenerationId =
      request.nextUrl.searchParams.get(
        "compatibleVehicleGenerationId"
      );

    if (compatibleVehicleGenerationId) {
      if (
        category !== "multimedia-frame" ||
        !ObjectId.isValid(
          compatibleVehicleGenerationId
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Çerçeve uyumluluğu için geçerli bir araç kasa/yıl seçimi zorunludur.",
          },
          {
            status: 400,
          }
        );
      }

      const exactProducts =
        products.filter(
          (product) =>
            product.vehicleGenerationId?.toString() ===
            compatibleVehicleGenerationId
        );

      products =
        exactProducts.length > 0
          ? exactProducts
          : products.filter(
              (product) =>
                product.isUniversal === true
            );
    }

    return NextResponse.json({
      success: true,
      data:
        products.map(
          serializeProduct
        ),
    });
  } catch (error) {
    console.error(
      "GET /api/products error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Ürünler getirilemedi.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
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
    const sourceUrl =
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

    const suppliers =
      normalizeProductSuppliers(
        body.suppliers,
        false
      );

    if (
      suppliers.length === 0
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

    const supplierPrices =
      await resolveProductSupplierPrices(
        body.supplierPrices,
        suppliers,
        body.priceUsd,
        sourceUrl
      );
    const primarySupplierPrice =
      supplierPrices[0];
    const priceUsd =
      primarySupplierPrice.priceUsd;
    const primarySourceUrl =
      primarySupplierPrice.sourceUrl ?? "";

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

    const productsCollection =
      await getProductsCollection();
    const inventoryCollection =
      await getInventoryCollection();

    const vehicleCompatibility =
      await buildProductVehicleCompatibility(
        category,
        body
      );

    const MAX_CODE_RETRY =
      5;

    for (
      let attempt = 1;
      attempt <=
      MAX_CODE_RETRY;
      attempt++
    ) {
      try {
        const productCode =
          await getNextProductCode(
            category
          );

        const now =
          new Date();

        const productDocument = {
          productCode,
          brand,
          model,
          priceUsd,
          category,
          ...(vehicleCompatibility.isMultimediaFrame
            ? {
                isUniversal:
                  vehicleCompatibility.isUniversal,
                ...(!vehicleCompatibility.isUniversal
                  ? {
                      vehicleBrandId:
                        vehicleCompatibility.vehicleBrandId,
                      vehicleModelId:
                        vehicleCompatibility.vehicleModelId,
                      vehicleGenerationId:
                        vehicleCompatibility.vehicleGenerationId,
                    }
                  : {}),
              }
            : {}),
          suppliers,
          supplierPrices,
          ...(primarySourceUrl
            ? {
                sourceUrl:
                  primarySourceUrl,
                priceCheckedAt:
                  primarySupplierPrice.priceCheckedAt ?? now,
                priceRefreshAttemptedAt:
                  primarySupplierPrice.priceCheckedAt ?? now,
                sourceUnavailable:
                  false,
                sourceAvailabilityCheckedAt:
                  primarySupplierPrice.priceCheckedAt ?? now,
              }
            : {}),
          ...(cleanString(
            body.subCategory
          )
            ? {
                subCategory:
                  cleanString(
                    body.subCategory
                  ),
              }
            : {}),
          specifications:
            vehicleCompatibility.specifications,
          ...(cleanString(
            body.description
          )
            ? {
                description:
                  cleanString(
                    body.description
                  ),
              }
            : {}),
          ...(imageUrl &&
          imagePublicId
            ? {
                imageUrl,
                imagePublicId,
              }
            : {}),
          createdAt: now,
          updatedAt: now,
        };

        const insertResult =
          await productsCollection.insertOne(
            productDocument
          );

        try {
          await inventoryCollection.updateOne(
            {
              productId:
                insertResult.insertedId,
            },
            {
              $setOnInsert: {
                productId:
                  insertResult.insertedId,
                quantity: 0,
                createdAt:
                  now,
                updatedAt:
                  now,
              },
            },
            {
              upsert: true,
            }
          );
        } catch (
          inventoryError
        ) {
          await productsCollection.deleteOne(
            {
              _id:
                insertResult.insertedId,
            }
          );

          throw inventoryError;
        }

        const createdProduct =
          await productsCollection.findOne(
            {
              _id:
                insertResult.insertedId,
            }
          );

        if (!createdProduct) {
          throw new Error(
            "Oluşturulan ürün tekrar okunamadı."
          );
        }

        return NextResponse.json(
          {
            success: true,
            data:
              serializeProduct(
                createdProduct
              ),
          },
          {
            status: 201,
          }
        );
      } catch (error) {
        if (
          error instanceof
            MongoServerError &&
          error.code === 11000 &&
          attempt <
            MAX_CODE_RETRY
        ) {
          continue;
        }

        throw error;
      }
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "Ürün kodu oluşturulamadı.",
      },
      {
        status: 500,
      }
    );
  } catch (error) {
    console.error(
      "POST /api/products error:",
      error
    );

    if (
      error instanceof
        MongoServerError &&
      error.code === 11000
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Aynı ürün koduna sahip bir kayıt zaten bulunuyor.",
        },
        {
          status: 409,
        }
      );
    }

    const sourceStatus =
      getProductSourceErrorStatusCode(
        error
      );

    const responseStatus =
      error instanceof ProductVehicleCompatibilityError
        ? error.status
        : sourceStatus !== 500
          ? sourceStatus
          : 500;

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Ürün oluşturulamadı.",
      },
      {
        status:
          responseStatus,
      }
    );
  }
}
