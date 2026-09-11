import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  MongoServerError,
} from "mongodb";

import {
  ProductPayload,
} from "@/types/product";

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

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function cleanString(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

/*
 * =========================================================
 * GET
 *
 * /api/products
 * /api/products?category=speaker
 * =========================================================
 */

export async function GET(
  request:
    NextRequest
) {
  try {
    const category =
      request.nextUrl
        .searchParams
        .get(
          "category"
        );

    /*
     * Category gönderilmiş fakat
     * geçerli değilse 400.
     */
    if (
      category &&
      !isProductCategory(
        category
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Geçersiz ürün kategorisi.",
        },
        {
          status:
            400,
        }
      );
    }

    /*
     * Ürün listesi merkezi fiyat servisi üzerinden okunur. Böylece kaynak linki
     * olan ürünler Istanbul gününde en fazla bir kez EGB'den kontrol edilir ve
     * 404 durumu da ürün kaydına işlenir.
     */
    const products =
      await getProductsWithFreshPrices(
        category &&
        isProductCategory(
          category
        )
          ? category
          : undefined
      );

    return NextResponse.json({
      success:
        true,

      data:
        products.map(
          (
            product
          ) =>
            serializeProduct(
              product
            )
        ),
    });
  } catch (
    error
  ) {
    console.error(
      "GET /api/products error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        message:
          "Ürünler getirilemedi.",
      },
      {
        status:
          500,
      }
    );
  }
}

/*
 * =========================================================
 * POST
 *
 * CREATE PRODUCT
 * =========================================================
 */

export async function POST(
  request:
    NextRequest
) {
  try {
    const body =
      (await request.json()) as ProductPayload;

    /*
     * =====================================================
     * VALIDATION
     * =====================================================
     */

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

    if (
      !brand
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Marka zorunludur.",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      !model
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Model zorunludur.",
        },
        {
          status:
            400,
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
          success:
            false,

          message:
            "Geçerli bir ürün kategorisi zorunludur.",
        },
        {
          status:
            400,
        }
      );
    }

    const priceUsd =
      Number(
        body.priceUsd
      );

    if (
      !Number.isFinite(
        priceUsd
      ) ||
      priceUsd <
        0
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "USD fiyatı 0 veya daha büyük olmalıdır.",
        },
        {
          status:
            400,
        }
      );
    }

    /*
     * =====================================================
     * CLOUDINARY VALIDATION
     *
     * imageUrl varsa imagePublicId de olmak zorunda.
     * Tersi de aynı şekilde.
     * =====================================================
     */

    const imageUrl =
      cleanString(
        body.imageUrl
      );

    const imagePublicId =
      cleanString(
        body.imagePublicId
      );

    if (
      (
        imageUrl &&
        !imagePublicId
      ) ||
      (
        !imageUrl &&
        imagePublicId
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Ürün görsel bilgileri eksik.",
        },
        {
          status:
            400,
        }
      );
    }

    /*
     * Yalnızca Cloudinary HTTPS URL
     * kabul edelim.
     */
    if (
      imageUrl &&
      !imageUrl.startsWith(
        "https://res.cloudinary.com/"
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Geçersiz ürün görseli adresi.",
        },
        {
          status:
            400,
        }
      );
    }

    const productsCollection =
      await getProductsCollection();

    const inventoryCollection =
      await getInventoryCollection();

    /*
     * =====================================================
     * PRODUCT CODE
     *
     * Client'tan gelen productCode'a güvenmiyoruz.
     *
     * Backend yeniden üretiyor.
     *
     * Aynı anda iki insert olması ihtimalinde
     * unique index 11000 hatası verirse tekrar deniyoruz.
     * =====================================================
     */

    const MAX_CODE_RETRY =
      5;

    for (
      let attempt =
        1;
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

        /*
         * ===============================================
         * PRODUCT DOCUMENT
         * ===============================================
         */

        const productDocument = {
          productCode,

          brand,

          model,

          priceUsd,

          category,

          /*
           * Alt kategori boşsa MongoDB'ye
           * gereksiz boş string yazma.
           */
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
            body.specifications &&
            typeof body.specifications ===
              "object"
              ? body.specifications
              : {},

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

          /*
           * =============================================
           * CLOUDINARY
           * =============================================
           */

          ...(imageUrl &&
          imagePublicId
            ? {
                imageUrl,

                imagePublicId,
              }
            : {}),

          createdAt:
            now,

          updatedAt:
            now,
        };

        /*
         * ===============================================
         * INSERT PRODUCT
         * ===============================================
         */

        const insertResult =
          await productsCollection.insertOne(
            productDocument
          );

        /*
         * ===============================================
         * CREATE INVENTORY
         *
         * Yeni ürün ilk oluşturulduğunda stok = 0.
         * ===============================================
         */

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

                quantity:
                  0,

                createdAt:
                  now,

                updatedAt:
                  now,
              },
            },
            {
              upsert:
                true,
            }
          );
        } catch (
          inventoryError
        ) {
          /*
           * Inventory oluşturulamazsa
           * yarım ürün kaydı bırakmayalım.
           */
          await productsCollection.deleteOne(
            {
              _id:
                insertResult.insertedId,
            }
          );

          throw inventoryError;
        }

        /*
         * ===============================================
         * RETURN CREATED PRODUCT
         * ===============================================
         */

        const createdProduct =
          await productsCollection.findOne(
            {
              _id:
                insertResult.insertedId,
            }
          );

        if (
          !createdProduct
        ) {
          throw new Error(
            "Oluşturulan ürün tekrar okunamadı."
          );
        }

        return NextResponse.json(
          {
            success:
              true,

            data:
              serializeProduct(
                createdProduct
              ),
          },
          {
            status:
              201,
          }
        );
      } catch (
        error
      ) {
        /*
         * ===============================================
         * DUPLICATE PRODUCT CODE
         * ===============================================
         */

        if (
          error instanceof
            MongoServerError &&
          error.code ===
            11000 &&
          attempt <
            MAX_CODE_RETRY
        ) {
          /*
           * Başka istek aynı kodu bizden önce
           * aldı. Yeni max değer ile tekrar dene.
           */
          continue;
        }

        throw error;
      }
    }

    return NextResponse.json(
      {
        success:
          false,

        message:
          "Ürün kodu oluşturulamadı.",
      },
      {
        status:
          500,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "POST /api/products error:",
      error
    );

    if (
      error instanceof
        MongoServerError &&
      error.code ===
        11000
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Aynı ürün koduna sahip bir kayıt zaten bulunuyor.",
        },
        {
          status:
            409,
        }
      );
    }

    return NextResponse.json(
      {
        success:
          false,

        message:
          error instanceof Error
            ? error.message
            : "Ürün oluşturulamadı.",
      },
      {
        status:
          500,
      }
    );
  }
}