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
  buildProductVehicleCompatibility,
  ProductVehicleCompatibilityError,
} from "@/lib/product-vehicle-compatibility";

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
  getProductSourceErrorStatusCode,
} from "@/lib/scraping/product-source-price";

import {
  resolveProductSupplierPrices,
} from "@/lib/product-supplier-prices";

interface RouteContext {
  params:
    Promise<{
      id: string;
    }>;
}

function cleanString(
  value: unknown
) {
  return typeof value === "string"
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
    const sourceUrl =
      cleanString(
        body.sourceUrl
      );
    const suppliers =
      normalizeProductSuppliers(
        body.suppliers,
        false
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

    const vehicleCompatibility =
      await buildProductVehicleCompatibility(
        category,
        body
      );

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

    const now =
      new Date();
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
          ...(vehicleCompatibility.isMultimediaFrame
            ? {
                isUniversal:
                  vehicleCompatibility.isUniversal,
              }
            : {}),
          ...(vehicleCompatibility.isMultimedia
            ? {
                isVehicleSpecific:
                  vehicleCompatibility.isVehicleSpecific,
              }
            : {}),
          ...(vehicleCompatibility.hasVehicleCompatibility
            ? {
                vehicleBrandId:
                  vehicleCompatibility.vehicleBrandId,
                vehicleModelId:
                  vehicleCompatibility.vehicleModelId,
                vehicleGenerationId:
                  vehicleCompatibility.vehicleGenerationId,
                vehicleCompatibilities:
                  vehicleCompatibility.vehicleCompatibilities,
              }
            : {}),
          suppliers,
          supplierPrices,
          specifications:
            vehicleCompatibility.specifications,
          updatedAt:
            now,
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
          ...(!primarySourceUrl
            ? {
                sourceUrl: "",
                priceCheckedAt:
                  "",
                priceRefreshAttemptedAt:
                  "",
                sourceUnavailable:
                  "",
                sourceAvailabilityCheckedAt:
                  "",
              }
            : {}),
          ...(!subCategory
            ? {
                subCategory:
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
                imageUrl: "",
                imagePublicId:
                  "",
              }
            : {}),
          ...(!vehicleCompatibility.hasVehicleCompatibility
            ? {
                vehicleBrandId: "",
                vehicleModelId: "",
                vehicleGenerationId: "",
                vehicleCompatibilities: "",
              }
            : {}),
          ...(!vehicleCompatibility.isMultimediaFrame
            ? {
                isUniversal: "",
              }
            : {}),
          ...(!vehicleCompatibility.isMultimedia
            ? {
                isVehicleSpecific: "",
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

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Ürün güncellenemedi.",
      },
      {
        status:
          error instanceof ProductVehicleCompatibilityError
            ? error.status
            : getProductSourceErrorStatusCode(
                error
              ),
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

    await collection.deleteOne({
      _id: objectId,
    });

    try {
      const inventoryCollection =
        await getInventoryCollection();

      await inventoryCollection.deleteOne({
        productId:
          objectId,
      });
    } catch (inventoryError) {
      console.error(
        "Product inventory could not be deleted:",
        inventoryError
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Ürün silindi.",
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
          "Ürün silinemedi.",
      },
      {
        status: 500,
      }
    );
  }
}
