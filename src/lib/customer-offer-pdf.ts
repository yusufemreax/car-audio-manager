"use client";

import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

import type {
  Content,
  TDocumentDefinitions,
} from "pdfmake/interfaces";

import type {
  CustomerSystemOffer,
} from "@/types/customer-system-offer";

import type {
  Product,
} from "@/types/product";

import type {
  SystemLaborItem,
} from "@/types/system-labor";

import {
  productCategoryDefinitions,
} from "@/lib/product-config";

/*
 * =========================================================
 * PDFMAKE FONT
 *
 * Roboto Türkçe karakterleri destekler.
 * =========================================================
 */

pdfMake.addVirtualFileSystem(
  pdfFonts
);

/*
 * =========================================================
 * TYPES
 * =========================================================
 */

type OfferItem =
  CustomerSystemOffer["systemSnapshot"]["items"][number];

/*
 * =========================================================
 * FORMATTERS
 * =========================================================
 */

function formatTry(
  value: number
) {
  return new Intl.NumberFormat(
    "tr-TR",
    {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}

function formatRate(
  value: number
) {
  return new Intl.NumberFormat(
    "tr-TR",
    {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }
  ).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}

function formatDate(
  value?: string
) {
  if (!value) {
    return "-";
  }

  try {
    /*
     * YYYY-MM-DD ise timezone yüzünden
     * bir gün geriye kaymasın.
     */
    const normalizedValue =
      /^\d{4}-\d{2}-\d{2}$/.test(
        value
      )
        ? `${value}T00:00:00`
        : value;

    const date =
      new Date(
        normalizedValue
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }

    return new Intl.DateTimeFormat(
      "tr-TR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    ).format(
      date
    );
  } catch {
    return value;
  }
}

/*
 * =========================================================
 * CATEGORY LABEL
 * =========================================================
 */

function getCategoryLabel(
  item: OfferItem
) {
  return (
    productCategoryDefinitions[
      item.category
    ]?.label ??
    item.category
  );
}

/*
 * =========================================================
 * SUB CATEGORY LABEL
 * =========================================================
 */

function getSubCategoryLabel(
  item: OfferItem
) {
  if (
    !item.subCategory
  ) {
    return "-";
  }

  const definition =
    productCategoryDefinitions[
      item.category
    ];

  const subCategoryField =
    definition?.fields.find(
      (field) =>
        field.source ===
        "subCategory"
    );

  const option =
    subCategoryField
      ?.options
      ?.find(
        (currentOption) =>
          currentOption.value ===
          item.subCategory
      );

  return (
    option?.label ??
    item.subCategory
  );
}

/*
 * =========================================================
 * UNIT PRICE USD
 *
 * Normalde unitPriceUsd kullanılır.
 *
 * Eski kayıtlarda yoksa totalPriceUsd /
 * quantity üzerinden hesaplanır.
 * =========================================================
 */

function getUnitPriceUsd(
  item: OfferItem
) {
  const quantity =
    Number(
      item.quantity
    ) || 1;

  if (
    typeof item.unitPriceUsd ===
      "number" &&
    Number.isFinite(
      item.unitPriceUsd
    )
  ) {
    return item.unitPriceUsd;
  }

  if (
    typeof item.totalPriceUsd ===
      "number" &&
    Number.isFinite(
      item.totalPriceUsd
    )
  ) {
    return (
      item.totalPriceUsd /
      quantity
    );
  }

  return 0;
}

/*
 * =========================================================
 * BLOB -> DATA URL
 * =========================================================
 */

function blobToDataUrl(
  blob: Blob
): Promise<string> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const reader =
        new FileReader();

      reader.onload =
        () => {
          if (
            typeof reader.result ===
            "string"
          ) {
            resolve(
              reader.result
            );

            return;
          }

          reject(
            new Error(
              "Resim okunamadı."
            )
          );
        };

      reader.onerror =
        () => {
          reject(
            new Error(
              "Resim okunamadı."
            )
          );
        };

      reader.readAsDataURL(
        blob
      );
    }
  );
}

/*
 * =========================================================
 * URL -> DATA URL
 * =========================================================
 */

async function urlToDataUrl(
  url: string
): Promise<string | null> {
  try {
    const response =
      await fetch(
        url,
        {
          cache:
            "no-store",
        }
      );

    if (
      !response.ok
    ) {
      return null;
    }

    const blob =
      await response.blob();

    return await blobToDataUrl(
      blob
    );
  } catch (
    error
  ) {
    console.error(
      "PDF image load error:",
      url,
      error
    );

    return null;
  }
}

/*
 * =========================================================
 * CLOUDINARY PDF IMAGE
 *
 * Ürün Cloudinary'de WEBP olabilir.
 *
 * pdfmake JPEG / PNG desteklediği için
 * PDF için Cloudinary'den küçük JPEG
 * istiyoruz.
 * =========================================================
 */

function getPdfImageUrl(
  url: string
) {
  if (
    !url.includes(
      "res.cloudinary.com"
    ) ||
    !url.includes(
      "/upload/"
    )
  ) {
    return url;
  }

  return url.replace(
    "/upload/",
    "/upload/f_jpg,q_auto:good,c_fit,w_180,h_140/"
  );
}

/*
 * =========================================================
 * PRODUCT IMAGE FALLBACK
 *
 * Yeni snapshot'larda imageUrl tutulacak.
 *
 * Eski kayıtlarda imageUrl yoksa mevcut
 * ürün API'sinden bulmaya çalışır.
 * =========================================================
 */

async function getItemImageUrl(
  item: OfferItem
): Promise<string | null> {
  /*
   * Snapshot'ta imageUrl varsa
   * öncelik her zaman ondadır.
   */
  if (
    "imageUrl" in item &&
    typeof item.imageUrl ===
      "string" &&
    item.imageUrl.trim()
  ) {
    return getPdfImageUrl(
      item.imageUrl
    );
  }

  if (
    !item.productId
  ) {
    return null;
  }

  try {
    const response =
      await fetch(
        `/api/products/${encodeURIComponent(
          item.productId
        )}`,
        {
          cache:
            "no-store",
        }
      );

    const result:
      {
        success:
          boolean;

        data?:
          Product;
      } =
      await response.json();

    if (
      !response.ok ||
      !result.success ||
      !result.data
        ?.imageUrl
    ) {
      return null;
    }

    return getPdfImageUrl(
      result.data.imageUrl
    );
  } catch (
    error
  ) {
    console.error(
      "Product image could not be resolved:",
      item.productId,
      error
    );

    return null;
  }
}

/*
 * =========================================================
 * PDF HEADER CELL
 * =========================================================
 */

function headerCell(
  text: string
): Content {
  return {
    text,
    bold:
      true,
    color:
      "#ffffff",
    fillColor:
      "#111827",
    fontSize:
      7,
    alignment:
      "center",
    margin: [
      1,
      5,
      1,
      5,
    ],
  };
}

/*
 * =========================================================
 * NORMAL TABLE CELL
 * =========================================================
 */

function textCell(
  text: string,
  alignment:
    "left" |
    "center" |
    "right" =
    "left"
): Content {
  return {
    text,
    fontSize:
      7,
    alignment,
    margin: [
      1,
      6,
      1,
      6,
    ],
  };
}

/*
 * =========================================================
 * SAFE FILE NAME
 * =========================================================
 */

function safeFileName(
  value: string
) {
  return value
    .trim()
    .replace(
      /[<>:"/\\|?*]+/g,
      "-"
    )
    .replace(
      /\s+/g,
      "-"
    )
    .replace(
      /-+/g,
      "-"
    );
}

/*
 * =========================================================
 * CREATE CUSTOMER OFFER PDF
 * =========================================================
 */

export async function createCustomerOfferPdf(
  offer:
    CustomerSystemOffer
) {
  const snapshot =
    offer.systemSnapshot;

  const exchangeRate =
    Number(
      snapshot.exchangeRate
    ) || 0;

  const commissionRate =
    Number(
      snapshot.commissionRate
    ) || 0;


  /*
   * =======================================================
   * LOGO
   *
   * public/LOGO.png
   *
   * Browser'da URL:
   * /LOGO.png
   * =======================================================
   */

  const logoDataUrl =
    await urlToDataUrl(
      "/LOGO.png"
    );

  if (
    !logoDataUrl
  ) {
    throw new Error(
      "public/LOGO.png dosyası okunamadı."
    );
  }

  /*
   * =======================================================
   * PRODUCT IMAGES
   * =======================================================
   */

  const preparedItems =
    await Promise.all(
      snapshot.items.map(
        async (
          item
        ) => {
          const imageUrl =
            await getItemImageUrl(
              item
            );

          const imageDataUrl =
            imageUrl
              ? await urlToDataUrl(
                  imageUrl
                )
              : null;

          const quantity =
            Math.max(
              1,
              Number(
                item.quantity
              ) || 1
            );

          /*
           * USD ürün birim fiyatı
           */
          const unitPriceUsd =
            getUnitPriceUsd(
              item
            );

          /*
           * Ürünün komisyonsuz TL fiyatı
           */
          const baseUnitPriceTry =
            unitPriceUsd *
            exchangeRate;

          /*
           * Eski teklif snapshot'larında alan yoksa true kabul edilir.
           */
          const itemWithCommission =
            item as typeof item & {
              isCommissionIncluded?: boolean;
            };

          const isCommissionIncluded =
            itemWithCommission.isCommissionIncluded !==
            false;

          /*
           * Dahil olan üründe komisyonlu,
           * dahil olmayan üründe komisyonsuz fiyat gösterilir.
           */
          const displayedUnitPriceTry =
            isCommissionIncluded
              ? baseUnitPriceTry *
                (
                  1 +
                  commissionRate /
                    100
                )
              : baseUnitPriceTry;

          /*
           * SATIR TOPLAMI
           */
          const totalTry =
            displayedUnitPriceTry *
            quantity;

          return {
            item,
            imageDataUrl,
            quantity,
            displayedUnitPriceTry,
            totalTry,
          };
        }
      )
    );

  /*
   * =======================================================
   * TOTALS
   * =======================================================
   */

  const totalProductTry =
    preparedItems.reduce(
      (
        total,
        current
      ) =>
        total +
        current.totalTry,
      0
    );

  const snapshotWithLaborItems =
    snapshot as typeof snapshot & {
      laborItems?: SystemLaborItem[];
    };

  /*
   * Yeni tekliflerde işçilik kalem kalem saklanır.
   * PDF'de tek satır gösterildiği için burada toplanır.
   * Eski tekliflerde laborItems olmadığı için laborCostTry
   * geriye dönük fallback olarak kullanılmaya devam eder.
   */
  const laborCostTry =
    Array.isArray(
      snapshotWithLaborItems.laborItems
    )
      ? snapshotWithLaborItems.laborItems.reduce(
          (
            total,
            item
          ) =>
            total +
            (Number(
              item.amountTry
            ) || 0),
          0
        )
      : Number(
          snapshot.laborCostTry
        ) || 0;

  /*
   * Hazır sistem üzerinde daha önce verilen
   * bir indirim olabilir.
   */
  const systemDiscountTry =
    Number(
      snapshot.discountTry
    ) || 0;

  /*
   * Müşteri teklifine özel
   * ekstra indirim.
   */
  const customerDiscountTry =
    Number(
      offer.extraDiscountTry
    ) || 0;

  /*
   * PDF'de tek "İndirim Tutarı"
   * gösterileceği için ikisini topluyoruz.
   */
  const totalDiscountTry =
    systemDiscountTry +
    customerDiscountTry;

  /*
   * CustomerSystemOffer kaydındaki gerçek
   * nihai fiyatı kullanıyoruz.
   */
  const finalOfferTry =
    Number(
      offer.finalCustomerTotalTry
    );

  const calculatedFinalTry =
    totalProductTry +
    laborCostTry -
    totalDiscountTry;

  const customerTotalTry =
    Number.isFinite(
      finalOfferTry
    )
      ? finalOfferTry
      : calculatedFinalTry;

  /*
   * =======================================================
   * EXCHANGE RATE DATE
   * =======================================================
   *
   * Yeni kayıtlarda exchangeRateDate kullanacağız.
   *
   * Eski kayıtlarda hazır sistemin oluşturulma
   * tarihi fallback olur.
   */

  const snapshotWithRateDate =
    snapshot as typeof snapshot & {
      exchangeRateDate?:
        string;
    };

  const exchangeRateDate =
    snapshotWithRateDate
      .exchangeRateDate ??
    snapshot.updatedAt ??
    snapshot.createdAt ??
    offer.createdAt;

  /*
   * =======================================================
   * TABLE BODY
   * =======================================================
   */

  const tableBody:
    Content[][] = [
      [
        headerCell(
          "Ürün Resmi"
        ),

        headerCell(
          "Kategori"
        ),

        headerCell(
          "Alt Kategori"
        ),

        headerCell(
          "Marka"
        ),

        headerCell(
          "Model"
        ),

        headerCell(
          "Adet"
        ),

        headerCell(
          "Birim Tutar"
        ),

        headerCell(
          "Toplam Tutar"
        ),
      ],

      ...preparedItems.map(
        (
          prepared
        ): Content[] => {
          const {
            item,
            imageDataUrl,
            quantity,
            displayedUnitPriceTry,
            totalTry,
          } =
            prepared;

          const imageCell:
            Content =
            imageDataUrl
              ? {
                  image:
                    imageDataUrl,

                  fit: [
                    34,
                    34,
                  ],

                  alignment:
                    "center",

                  margin: [
                    2,
                    3,
                    2,
                    3,
                  ],
                }
              : {
                  text:
                    "Görsel yok",

                  color:
                    "#9ca3af",

                  fontSize:
                    7,

                  alignment:
                    "center",

                  margin: [
                    2,
                    12,
                    2,
                    12,
                  ],
                };

          return [
            imageCell,

            textCell(
              getCategoryLabel(
                item
              ),
              "center"
            ),

            textCell(
              getSubCategoryLabel(
                item
              ),
              "center"
            ),

            textCell(
              item.brand ||
                "-",
              "center"
            ),

            textCell(
              item.model ||
                "-",
              "left"
            ),

            textCell(
              String(
                quantity
              ),
              "center"
            ),

            textCell(
              formatTry(
                displayedUnitPriceTry
              ),
              "right"
            ),

            textCell(
              formatTry(
                totalTry
              ),
              "right"
            ),
          ];
        }
      ),
    ];

  /*
   * =======================================================
   * DOCUMENT
   * =======================================================
   */

  const documentDefinition:
    TDocumentDefinitions = {
      pageSize:
        "A4",

      /*
       * Standart A4 dikey format:
       * 210 x 297 mm.
       *
       * Tablo kolonları ve görseller portrait
       * A4'e sığacak şekilde daraltılmıştır.
       */
      pageOrientation:
        "portrait",

      pageMargins: [
        24,
        28,
        24,
        40,
      ],

      defaultStyle: {
        font:
          "Roboto",

        fontSize:
          8,

        color:
          "#111827",
      },

      info: {
        title:
          "Araç Ses Sistemi Teklifi",

        subject:
          "Müşteri Teklifi",
      },

      footer: (
        currentPage,
        pageCount
      ) => ({
        columns: [
          {
            text:
              "Araç Ses Sistemi Teklifi",

            color:
              "#9ca3af",

            fontSize:
              7,
          },

          {
            text:
              `${currentPage} / ${pageCount}`,

            alignment:
              "right",

            color:
              "#9ca3af",

            fontSize:
              7,
          },
        ],

        margin: [
          24,
          12,
          24,
          0,
        ],
      }),

      content: [
        /*
         * ===============================================
         * LOGO
         * ===============================================
         */

        {
          columns: [
            {
              image:
                logoDataUrl,

              fit: [
                135,
                58,
              ],

              alignment:
                "left",
            },

            {
              stack: [
                {
                  text:
                    "TEKLİF",

                  bold:
                    true,

                  fontSize:
                    20,

                  alignment:
                    "right",

                  color:
                    "#111827",
                },

                {
                  text:
                    snapshot.name ??
                    "",

                  fontSize:
                    10,

                  alignment:
                    "right",

                  color:
                    "#6b7280",

                  margin: [
                    0,
                    6,
                    0,
                    0,
                  ],
                },
              ],
            },
          ],

          margin: [
            0,
            0,
            0,
            18,
          ],
        },

        /*
         * ===============================================
         * PRODUCTS TITLE
         * ===============================================
         */

        {
          text:
            "Ürünler",

          bold:
            true,

          fontSize:
            14,

          margin: [
            0,
            0,
            0,
            10,
          ],
        },

        /*
         * ===============================================
         * PRODUCT TABLE
         * ===============================================
         */

        {
          table: {
            headerRows:
              1,

            dontBreakRows:
              true,

            widths: [
              38,
              54,
              52,
              48,
              "*",
              28,
              62,
              66,
            ],

            body:
              tableBody,
          },

          layout: {
            hLineColor:
              () =>
                "#e5e7eb",

            vLineColor:
              () =>
                "#e5e7eb",

            hLineWidth:
              () =>
                0.6,

            vLineWidth:
              () =>
                0.6,

            paddingLeft:
              () =>
                2,

            paddingRight:
              () =>
                2,

            paddingTop:
              () =>
                2,

            paddingBottom:
              () =>
                2,
          },

          margin: [
            0,
            0,
            0,
            20,
          ],
        },

        /*
         * ===============================================
         * TOTALS
         * ===============================================
         */

        {
          columns: [
            {
              width:
                "*",

              text:
                "",
            },

            {
              width:
                280,

              table: {
                widths: [
                  "*",
                  112,
                ],

                body: [
                  [
                    {
                      text:
                        "Toplam Ürün Tutarı",

                      bold:
                        true,

                      margin: [
                        5,
                        7,
                        5,
                        7,
                      ],
                    },

                    {
                      text:
                        formatTry(
                          totalProductTry
                        ),

                      bold:
                        true,

                      alignment:
                        "right",

                      margin: [
                        5,
                        7,
                        5,
                        7,
                      ],
                    },
                  ],

                  [
                    {
                      text:
                        "İşçilik Tutarı",

                      margin: [
                        5,
                        7,
                        5,
                        7,
                      ],
                    },

                    {
                      text:
                        formatTry(
                          laborCostTry
                        ),

                      alignment:
                        "right",

                      margin: [
                        5,
                        7,
                        5,
                        7,
                      ],
                    },
                  ],

                  [
                    {
                      text:
                        "İndirim Tutarı",

                      color:
                        totalDiscountTry >
                        0
                          ? "#b91c1c"
                          : "#111827",

                      margin: [
                        5,
                        7,
                        5,
                        7,
                      ],
                    },

                    {
                      text:
                        totalDiscountTry >
                        0
                          ? `- ${formatTry(
                              totalDiscountTry
                            )}`
                          : formatTry(
                              0
                            ),

                      alignment:
                        "right",

                      color:
                        totalDiscountTry >
                        0
                          ? "#b91c1c"
                          : "#111827",

                      margin: [
                        5,
                        7,
                        5,
                        7,
                      ],
                    },
                  ],

                  [
                    {
                      text:
                        "Toplam Teklif Tutarı",

                      bold:
                        true,

                      fontSize:
                        11,

                      fillColor:
                        "#111827",

                      color:
                        "#ffffff",

                      margin: [
                        5,
                        9,
                        5,
                        9,
                      ],
                    },

                    {
                      text:
                        formatTry(
                          customerTotalTry
                        ),

                      bold:
                        true,

                      fontSize:
                        11,

                      alignment:
                        "right",

                      fillColor:
                        "#111827",

                      color:
                        "#ffffff",

                      margin: [
                        5,
                        9,
                        5,
                        9,
                      ],
                    },
                  ],
                ],
              },

              layout: {
                hLineColor:
                  () =>
                    "#e5e7eb",

                vLineColor:
                  () =>
                    "#e5e7eb",

                hLineWidth:
                  () =>
                    0.6,

                vLineWidth:
                  () =>
                    0.6,
              },
            },
          ],

          margin: [
            0,
            0,
            0,
            20,
          ],
        },

        /*
         * ===============================================
         * EXCHANGE RATE NOTE
         * ===============================================
         */

        {
          text: [
            {
              text:
                "Not: ",

              bold:
                true,
            },

            {
              text:
                "Ürün fiyatları dolar kuruna göre değişiklik gösterebilir. ",
            },

            {
              text:
                "Teklif için geçerli kur ",
            },

            {
              text:
                formatDate(
                  exchangeRateDate
                ),

              bold:
                true,
            },

            {
              text:
                " günü için ",
            },

            {
              text:
                `1 USD = ${formatRate(
                  exchangeRate
                )} TL`,

              bold:
                true,
            },

            {
              text:
                " olarak hesaplanmıştır.",
            },
          ],

          fontSize:
            8,

          color:
            "#6b7280",

          lineHeight:
            1.35,

          margin: [
            0,
            4,
            0,
            0,
          ],
        },
      ],
    };

  /*
   * =======================================================
   * DOWNLOAD
   * =======================================================
   */

  const fileName =
    safeFileName(
      snapshot.name ||
      `teklif-${offer.id}`
    );

  pdfMake
    .createPdf(
      documentDefinition
    )
    .download(
      `${fileName}.pdf`
    );
}