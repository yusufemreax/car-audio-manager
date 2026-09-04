import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ObjectId,
} from "mongodb";

import {
  getDatabase,
} from "@/lib/mongodb";

import {
  isProductCategory,
} from "@/lib/product-config";

import {
  serializeProduct,
} from "@/lib/products-collection";

import {
  getProductsWithFreshPrices,
} from "@/lib/products-service";

interface InventoryDocument {
  productId:
    ObjectId | string;
  quantity: number;
  createdAt?: Date;
  updatedAt?: Date;
}

function normalizeProductId(
  value:
    ObjectId | string
) {
  return value instanceof ObjectId
    ? value.toString()
    : String(value);
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

    /*
     * Ürünler artık ortak 5 dakikalık fiyat TTL
     * katmanından geçerek okunuyor.
     */
    const products =
      await getProductsWithFreshPrices(
        category ?? undefined
      );

    if (
      products.length === 0
    ) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    const database =
      await getDatabase();

    const inventory =
      database.collection<InventoryDocument>(
        "inventory"
      );

    const productObjectIds =
      products.map(
        (product) =>
          product._id
      );

    const productStringIds =
      productObjectIds.map(
        (productId) =>
          productId.toString()
      );

    /*
     * Eski kayıtlarda productId string tutulmuş olabilir.
     * Yeni kayıtlarda ObjectId kullanılıyor.
     * İki formatı da okuyarak geriye uyumluluk sağlıyoruz.
     */
    const inventoryDocuments =
      await inventory
        .find({
          productId: {
            $in: [
              ...productObjectIds,
              ...productStringIds,
            ],
          },
        })
        .toArray();

    const quantityByProductId =
      new Map<string, number>();

    for (
      const item of
      inventoryDocuments
    ) {
      const productId =
        normalizeProductId(
          item.productId
        );

      quantityByProductId.set(
        productId,
        Math.max(
          0,
          Number(
            item.quantity
          ) || 0
        )
      );
    }

    return NextResponse.json({
      success: true,
      data:
        products.map(
          (product) => ({
            ...serializeProduct(
              product
            ),
            stockQuantity:
              quantityByProductId.get(
                product._id.toString()
              ) ?? 0,
          })
        ),
    });
  } catch (error) {
    console.error(
      "GET /api/inventory error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Stok bilgileri getirilemedi.",
      },
      {
        status: 500,
      }
    );
  }
}
