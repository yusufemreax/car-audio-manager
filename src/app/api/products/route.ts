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
  getNextProductCode,
} from "@/lib/product-code";

import {
  isProductCategory,
} from "@/lib/product-config";

import {
  getProductsWithFreshPrices,
} from "@/lib/products-service";

import {
  EgbPriceScraperError,
  fetchEgbProductPrice,
  isEgbUrl,
  roundCurrency,
} from "@/lib/scraping/egb-price-scraper";

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

    const products =
      await getProductsWithFreshPrices(
        category ?? undefined
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

    const sourceUrl =
      cleanString(
        body.sourceUrl
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

    if (
      sourceUrl &&
      !isEgbUrl(
        sourceUrl
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

    const suppliers =
      normalizeProductSuppliers(
        body.suppliers,
        false
      );

    if (
      suppliers.length ===
      0
    ) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            "En az bir tedarikçi seçmelisiniz.",
        },
        {
          status:
            400,
        }
      );
    }

    let priceUsd: number;
    let priceCheckedAt:
      Date | undefined;

    if (sourceUrl) {
      /*
       * Linkli üründe client'tan gelen fiyatı kullanmıyoruz.
       * Kayıt anında EGB'den yeniden okuyup server-side doğruluyoruz.
       */
      const remotePrice =
        await fetchEgbProductPrice(
          sourceUrl
        );

      priceUsd =
        roundCurrency(
          remotePrice.priceUsd
        );

      priceCheckedAt =
        new Date();
    } else {
      /*
       * Link yoksa kullanıcı fiyatı manuel girer.
       */
      priceUsd =
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

          suppliers,

          ...(sourceUrl
            ? {
                sourceUrl,
                priceCheckedAt:
                  priceCheckedAt!,
                priceRefreshAttemptedAt:
                  priceCheckedAt!,
              }
            : {}),

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