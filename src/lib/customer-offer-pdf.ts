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
 * Multimedya özellikleri şablon adına / templateId'ye bağlı değildir.
 * Sistemde category = "multimedia" olan herhangi bir ürün varsa
 * o ürün için özellik bölümü PDF'e eklenir.
 */
function isMultimediaItem(
  item: OfferItem
) {
  return (
    String(
      item.category ?? ""
    )
      .trim()
      .toLowerCase() ===
    "multimedia"
  );
}

/*
 * Araç kamerası özellikleri de şablondan bağımsızdır.
 * Sistemde category = "vehicle-camera" olan ürün varsa
 * teklif çıktısında kamera özellikleri ayrıca gösterilir.
 */
function isVehicleCameraItem(
  item: OfferItem
) {
  return (
    String(
      item.category ?? ""
    )
      .trim()
      .toLowerCase() ===
    "vehicle-camera"
  );
}

type PdfSpecificationValue =
  | string
  | number
  | boolean;

type PdfSpecifications =
  Record<
    string,
    PdfSpecificationValue
  >;

interface PdfCustomerVehicle {
  id: string;
  brand: string;
  model: string;
  year?: number;
  plate?: string;
}

interface PdfCustomer {
  id: string;
  name: string;
  vehicles?: PdfCustomerVehicle[];
}

interface PdfCustomerContext {
  customerName: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear?: number;
}

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

function cleanString(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function getItemSnapshotSpecifications(
  item: OfferItem
): PdfSpecifications {
  const value =
    Reflect.get(
      item as object,
      "specifications"
    );

  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return {
    ...(value as PdfSpecifications),
  };
}

function getSpecificationText(
  specifications: PdfSpecifications,
  key: string,
  unit?: string
) {
  const value =
    specifications[key];

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "-";
  }

  const text =
    String(value).trim();

  if (!unit) {
    return text || "-";
  }

  const normalized =
    text.toLocaleLowerCase(
      "tr-TR"
    );

  if (
    normalized.includes(
      unit.toLocaleLowerCase(
        "tr-TR"
      )
    )
  ) {
    return text;
  }

  return unit === '"'
    ? `${text}"`
    : `${text} ${unit}`;
}

function getSpecificationBoolean(
  value: unknown
) {
  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  if (
    typeof value ===
    "number"
  ) {
    return value !== 0;
  }

  const normalized =
    cleanString(value)
      .toLocaleLowerCase(
        "tr-TR"
      );

  return [
    "true",
    "1",
    "var",
    "evet",
    "yes",
  ].includes(normalized);
}

function getCameraSetupText(
  value: unknown
) {
  const normalized =
    cleanString(value)
      .toLocaleLowerCase(
        "tr-TR"
      );

  switch (normalized) {
    case "front":
      return "Ön";
    case "front-rear":
      return "Ön - Arka";
    case "front-rear-interior":
      return "Ön - Arka - İç";
    default:
      return cleanString(value) || "-";
  }
}

function getCameraQualityText(
  value: unknown
) {
  const text =
    cleanString(value);

  switch (
    text.toLocaleLowerCase(
      "tr-TR"
    )
  ) {
    case "480p":
      return "480p";
    case "720p":
      return "720p";
    case "1080p":
      return "1080p HD";
    case "2k":
      return "2K";
    case "4k":
      return "4K";
    default:
      return text || "-";
  }
}

function getSdCardSupportText(
  value: unknown
) {
  const text =
    cleanString(value);

  if (!text) {
    return "-";
  }

  if (
    /gb$/i.test(text)
  ) {
    return text.replace(
      /\s*gb$/i,
      " GB"
    );
  }

  return `${text} GB`;
}

function getFeatureStatusCell(
  available: boolean
): Content {
  return {
    text:
      available
        ? "✓ VAR"
        : "YOK",
    bold:
      true,
    color:
      available
        ? "#15803d"
        : "#6b7280",
    fontSize:
      8,
    margin: [
      6,
      6,
      6,
      6,
    ],
  };
}

function getFeatureValueCell(
  value: string
): Content {
  return {
    text:
      value || "-",
    bold:
      true,
    color:
      "#111827",
    fontSize:
      8,
    margin: [
      6,
      6,
      6,
      6,
    ],
  };
}

function getFeatureLabelCell(
  value: string
): Content {
  return {
    text:
      value,
    color:
      "#6b7280",
    fontSize:
      7,
    bold:
      true,
    margin: [
      6,
      6,
      6,
      6,
    ],
  };
}

async function getOfferCustomerContext(
  offer: CustomerSystemOffer
): Promise<PdfCustomerContext> {
  try {
    const response =
      await fetch(
        "/api/customers",
        {
          cache:
            "no-store",
        }
      );

    const result: {
      success?: boolean;
      data?: PdfCustomer[];
    } =
      await response.json();

    if (!response.ok) {
      throw new Error(
        "Müşteri bilgileri alınamadı."
      );
    }

    const customer =
      (result.data ?? []).find(
        (current) =>
          current.id ===
          offer.customerId
      );

    const vehicle =
      customer?.vehicles?.find(
        (current) =>
          current.id ===
          offer.vehicleId
      );

    return {
      customerName:
        customer?.name ??
        "-",
      vehicleBrand:
        vehicle?.brand ??
        "-",
      vehicleModel:
        vehicle?.model ??
        "-",
      ...(typeof vehicle?.year ===
      "number"
        ? {
            vehicleYear:
              vehicle.year,
          }
        : {}),
    };
  } catch (error) {
    console.error(
      "PDF customer information could not be resolved:",
      error
    );

    return {
      customerName:
        "-",
      vehicleBrand:
        "-",
      vehicleModel:
        "-",
    };
  }
}

async function getOfferNumberForPdf(
  offer: CustomerSystemOffer
) {
  const storedNumber =
    cleanString(
      Reflect.get(
        offer as object,
        "offerNumber"
      )
    );

  if (storedNumber) {
    return storedNumber;
  }

  const response =
    await fetch(
      `/api/customer-system-offers/${encodeURIComponent(
        offer.id
      )}/offer-number`,
      {
        method:
          "POST",
      }
    );

  const result: {
    success?: boolean;
    message?: string;
    data?: {
      offerNumber?: string;
    };
  } =
    await response.json();

  const offerNumber =
    cleanString(
      result.data?.offerNumber
    );

  if (
    !response.ok ||
    !result.success ||
    !offerNumber
  ) {
    throw new Error(
      result.message ??
      "Teklif numarası oluşturulamadı."
    );
  }

  return offerNumber;
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

interface PdfItemProductData {
  imageUrl: string | null;
  specifications: PdfSpecifications;
}

async function getItemProductData(
  item: OfferItem
): Promise<PdfItemProductData> {
  const snapshotImageUrl =
    (
      "imageUrl" in item &&
      typeof item.imageUrl ===
        "string" &&
      item.imageUrl.trim()
    )
      ? getPdfImageUrl(
          item.imageUrl
        )
      : null;

  const snapshotSpecifications =
    getItemSnapshotSpecifications(
      item
    );

  const needsProductFallback =
    Boolean(
      item.productId &&
      (
        !snapshotImageUrl ||
        (
          isMultimediaItem(
            item
          ) &&
          Object.keys(
            snapshotSpecifications
          ).length === 0
        )
      )
    );

  if (!needsProductFallback) {
    return {
      imageUrl:
        snapshotImageUrl,
      specifications:
        snapshotSpecifications,
    };
  }

  try {
    const response =
      await fetch(
        `/api/products/${encodeURIComponent(
          item.productId!
        )}`,
        {
          cache:
            "no-store",
        }
      );

    const result: {
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
    ) {
      return {
        imageUrl:
          snapshotImageUrl,
        specifications:
          snapshotSpecifications,
      };
    }

    return {
      imageUrl:
        snapshotImageUrl ??
        (result.data.imageUrl
          ? getPdfImageUrl(
              result.data.imageUrl
            )
          : null),
      specifications:
        Object.keys(
          snapshotSpecifications
        ).length > 0
          ? snapshotSpecifications
          : {
              ...(result.data.specifications ?? {}),
            },
    };
  } catch (error) {
    console.error(
      "Product PDF data could not be resolved:",
      item.productId,
      error
    );

    return {
      imageUrl:
        snapshotImageUrl,
      specifications:
        snapshotSpecifications,
    };
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

async function buildCustomerOfferDocument(
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

  const commissionMultiplier =
    1 +
    commissionRate /
      100;

  /*
   * Teklif numarası MongoDB'de kalıcıdır. Eski tekliflerde
   * PDF ilk açıldığında numara oluşturulup kayda yazılır.
   */
  const [
    offerNumber,
    customerContext,
  ] = await Promise.all([
    getOfferNumberForPdf(
      offer
    ),
    getOfferCustomerContext(
      offer
    ),
  ]);

  const vehicleText =
    [
      customerContext.vehicleBrand,
      customerContext.vehicleModel,
      customerContext.vehicleYear
        ? String(
            customerContext.vehicleYear
          )
        : "",
    ]
      .filter(
        (value) =>
          value &&
          value !== "-"
      )
      .join(" ") ||
    "-";

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
          const productData =
            await getItemProductData(
              item
            );

          const imageDataUrl =
            productData.imageUrl
              ? await urlToDataUrl(
                  productData.imageUrl
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
           * Kullanıcının istediği:
           *
           * BİRİM TUTAR
           * KOMİSYONLU
           */
          const commissionedUnitPriceTry =
            baseUnitPriceTry *
            commissionMultiplier;

          /*
           * SATIR TOPLAMI
           */
          const totalTry =
            commissionedUnitPriceTry *
            quantity;

          return {
            item,
            imageDataUrl,
            specifications:
              productData.specifications,
            quantity,
            commissionedUnitPriceTry,
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
   * MULTIMEDIA FEATURES
   *
   * Yalnızca sistemde Multimedya ürünü varsa gösterilir.
   * Yeni snapshot'larda specifications doğrudan teklif
   * anındaki üründen gelir. Eski tekliflerde ürün API'si
   * fallback olarak kullanılır.
   * =======================================================
   */

  const multimediaSections:
    Content[] =
    preparedItems
      .filter(
        (prepared) =>
          isMultimediaItem(
            prepared.item
          )
      )
      .map(
        (prepared) => {
          const specifications =
            prepared.specifications;

          const displayTechnologyRaw =
            getSpecificationText(
              specifications,
              "displayTechnology"
            );

          const displayTechnology =
            displayTechnologyRaw ===
              "ips"
              ? "IPS"
              : displayTechnologyRaw ===
                  "qled"
                ? "QLED"
                : displayTechnologyRaw;

          const features: Array<{
            label: string;
            value: Content;
          }> = [
            {
              label: "RAM",
              value:
                getFeatureValueCell(
                  getSpecificationText(
                    specifications,
                    "ram",
                    "GB"
                  )
                ),
            },
            {
              label: "HAFIZA",
              value:
                getFeatureValueCell(
                  getSpecificationText(
                    specifications,
                    "storage",
                    "GB"
                  )
                ),
            },
            {
              label:
                "EKRAN BOYUTU",
              value:
                getFeatureValueCell(
                  getSpecificationText(
                    specifications,
                    "screenSize",
                    '"'
                  )
                ),
            },
            {
              label:
                "ANDROID SÜRÜMÜ",
              value:
                getFeatureValueCell(
                  getSpecificationText(
                    specifications,
                    "androidVersion"
                  )
                ),
            },
            {
              label:
                "GERİ GÖRÜŞ KAMERASI",
              value:
                getFeatureStatusCell(
                  true
                ),
            },
            {
              label:
                "ÖN KAYIT KAMERASI",
              value:
                getFeatureStatusCell(
                  getSpecificationBoolean(
                    specifications[
                      "hasFrontRecordingCamera"
                    ]
                  )
                ),
            },
            {
              label: "CARPLAY",
              value:
                getFeatureStatusCell(
                  getSpecificationBoolean(
                    specifications[
                      "hasCarPlay"
                    ]
                  )
                ),
            },
          ];

          if (
            displayTechnology !==
            "-"
          ) {
            features.push({
              label:
                "EKRAN TEKNOLOJİSİ",
              value:
                getFeatureValueCell(
                  displayTechnology
                ),
            });
          }

          if (
            Object.prototype.hasOwnProperty.call(
              specifications,
              "hasDsp"
            )
          ) {
            features.push({
              label: "DSP",
              value:
                getFeatureStatusCell(
                  getSpecificationBoolean(
                    specifications[
                      "hasDsp"
                    ]
                  )
                ),
            });
          }

          const featureRows:
            Content[][] = [];

          for (
            let index = 0;
            index <
            features.length;
            index += 2
          ) {
            const left =
              features[index];
            const right =
              features[
                index + 1
              ];

            featureRows.push([
              getFeatureLabelCell(
                left.label
              ),
              left.value,
              right
                ? getFeatureLabelCell(
                    right.label
                  )
                : {
                    text: "",
                  },
              right
                ? right.value
                : {
                    text: "",
                  },
            ]);
          }

          const multimediaName =
            [
              prepared.item.brand,
              prepared.item.model,
            ]
              .filter(Boolean)
              .join(" ")
              .trim();

          return {
            unbreakable: true,
            stack: [
              {
                columns: [
                  {
                    text:
                      "Multimedya Özellikleri",
                    bold: true,
                    fontSize: 12,
                    color:
                      "#111827",
                  },
                  {
                    text:
                      multimediaName,
                    alignment:
                      "right",
                    fontSize: 8,
                    color:
                      "#6b7280",
                  },
                ],
                margin: [
                  0,
                  0,
                  0,
                  8,
                ],
              },
              {
                table: {
                  widths: [
                    "24%",
                    "26%",
                    "24%",
                    "26%",
                  ],
                  body:
                    featureRows,
                },
                layout: {
                  fillColor: (
                    rowIndex
                  ) =>
                    rowIndex % 2 ===
                    0
                      ? "#f8fafc"
                      : "#ffffff",
                  hLineColor: () =>
                    "#e5e7eb",
                  vLineColor: () =>
                    "#e5e7eb",
                  hLineWidth: () =>
                    0.5,
                  vLineWidth: () =>
                    0.5,
                  paddingLeft: () =>
                    2,
                  paddingRight: () =>
                    2,
                  paddingTop: () =>
                    1,
                  paddingBottom: () =>
                    1,
                },
              },
            ],
            margin: [
              0,
              0,
              0,
              18,
            ],
          } as Content;
        }
      );


  /*
   * =======================================================
   * VEHICLE CAMERA FEATURES
   *
   * Şablondan bağımsızdır. Sistem içerisinde Araç Kamerası
   * kategorisinden ürün varsa ürünün snapshot specifications
   * alanından okunur. Eski tekliflerde ürün API fallback'i
   * preparedItems aşamasında zaten uygulanır.
   * =======================================================
   */

  const vehicleCameraSections:
    Content[] =
    preparedItems
      .filter(
        (prepared) =>
          isVehicleCameraItem(
            prepared.item
          )
      )
      .map(
        (prepared) => {
          const specifications =
            prepared.specifications;

          const cameraSetup =
            cleanString(
              specifications[
                "cameraSetup"
              ]
            ).toLocaleLowerCase(
              "tr-TR"
            );

          const features: Array<{
            label: string;
            value: Content;
          }> = [
            {
              label:
                "KAMERA TİPİ",
              value:
                getFeatureValueCell(
                  getCameraSetupText(
                    specifications[
                      "cameraSetup"
                    ]
                  )
                ),
            },
            {
              label:
                "ÖN KAMERA KALİTESİ",
              value:
                getFeatureValueCell(
                  getCameraQualityText(
                    specifications[
                      "frontCameraQuality"
                    ]
                  )
                ),
            },
          ];

          const hasRearCamera =
            cameraSetup ===
              "front-rear" ||
            cameraSetup ===
              "front-rear-interior" ||
            Boolean(
              cleanString(
                specifications[
                  "rearCameraQuality"
                ]
              )
            );

          const hasInteriorCamera =
            cameraSetup ===
              "front-rear-interior" ||
            Boolean(
              cleanString(
                specifications[
                  "interiorCameraQuality"
                ]
              )
            );

          if (hasRearCamera) {
            features.push({
              label:
                "ARKA KAMERA KALİTESİ",
              value:
                getFeatureValueCell(
                  getCameraQualityText(
                    specifications[
                      "rearCameraQuality"
                    ]
                  )
                ),
            });
          }

          if (hasInteriorCamera) {
            features.push({
              label:
                "İÇ KAMERA KALİTESİ",
              value:
                getFeatureValueCell(
                  getCameraQualityText(
                    specifications[
                      "interiorCameraQuality"
                    ]
                  )
                ),
            });
          }

          features.push(
            {
              label:
                "ADAS DESTEĞİ",
              value:
                getFeatureStatusCell(
                  getSpecificationBoolean(
                    specifications[
                      "hasAdas"
                    ]
                  )
                ),
            },
            {
              label:
                "SALLANTI SENSÖRÜ",
              value:
                getFeatureStatusCell(
                  getSpecificationBoolean(
                    specifications[
                      "hasShockSensor"
                    ]
                  )
                ),
            },
            {
              label:
                "PARK HALİNDE KAYIT",
              value:
                getFeatureStatusCell(
                  getSpecificationBoolean(
                    specifications[
                      "hasParkingMode"
                    ]
                  )
                ),
            },
            {
              label:
                "SD KART DESTEĞİ",
              value:
                getFeatureValueCell(
                  getSdCardSupportText(
                    specifications[
                      "sdCardSupport"
                    ]
                  )
                ),
            }
          );

          const featureRows:
            Content[][] = [];

          for (
            let index = 0;
            index <
            features.length;
            index += 2
          ) {
            const left =
              features[index];
            const right =
              features[
                index + 1
              ];

            featureRows.push([
              getFeatureLabelCell(
                left.label
              ),
              left.value,
              right
                ? getFeatureLabelCell(
                    right.label
                  )
                : {
                    text: "",
                  },
              right
                ? right.value
                : {
                    text: "",
                  },
            ]);
          }

          const cameraName =
            [
              prepared.item.brand,
              prepared.item.model,
            ]
              .filter(Boolean)
              .join(" ")
              .trim();

          return {
            unbreakable: true,
            stack: [
              {
                columns: [
                  {
                    text:
                      "Araç Kamerası Özellikleri",
                    bold: true,
                    fontSize: 12,
                    color:
                      "#111827",
                  },
                  {
                    text:
                      cameraName,
                    alignment:
                      "right",
                    fontSize: 8,
                    color:
                      "#6b7280",
                  },
                ],
                margin: [
                  0,
                  0,
                  0,
                  8,
                ],
              },
              {
                table: {
                  widths: [
                    "24%",
                    "26%",
                    "24%",
                    "26%",
                  ],
                  body:
                    featureRows,
                },
                layout: {
                  fillColor: (
                    rowIndex
                  ) =>
                    rowIndex % 2 ===
                    0
                      ? "#f8fafc"
                      : "#ffffff",
                  hLineColor: () =>
                    "#e5e7eb",
                  vLineColor: () =>
                    "#e5e7eb",
                  hLineWidth: () =>
                    0.5,
                  vLineWidth: () =>
                    0.5,
                  paddingLeft: () =>
                    2,
                  paddingRight: () =>
                    2,
                  paddingTop: () =>
                    1,
                  paddingBottom: () =>
                    1,
                },
              },
            ],
            margin: [
              0,
              0,
              0,
              18,
            ],
          } as Content;
        }
      );

  const productFeatureSections =
    [
      ...multimediaSections,
      ...vehicleCameraSections,
    ];

  /*
   * Bir multimedya + bir kamera gibi normal senaryolarda tüm
   * özellik bloklarını beraber tutuyoruz. Birinci sayfada yer
   * kalmazsa iki blok da birlikte ikinci sayfaya geçer. Çok sayıda
   * özellik bloğu varsa tek bir sayfaya zorlamamak için her bölüm
   * kendi başına unbreakable olarak akmaya devam eder.
   */
  const productFeatureContent:
    Content[] =
    productFeatureSections.length ===
    0
      ? []
      : productFeatureSections.length <=
          2
        ? [
            {
              unbreakable:
                true,
              stack:
                productFeatureSections,
            } as Content,
          ]
        : productFeatureSections;

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
            commissionedUnitPriceTry,
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
                commissionedUnitPriceTry
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
                185,
                78,
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

                {
                  text:
                    `Teklif No: ${offerNumber}`,
                  bold:
                    true,
                  fontSize:
                    9,
                  alignment:
                    "right",
                  color:
                    "#374151",
                  margin: [
                    0,
                    5,
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
         * OFFER / CUSTOMER / VEHICLE INFO
         * ===============================================
         */

        {
          table: {
            widths: [
              "34%",
              "46%",
              "20%",
            ],
            body: [
              [
                {
                  stack: [
                    {
                      text:
                        "MÜŞTERİ",
                      color:
                        "#6b7280",
                      fontSize:
                        7,
                      bold:
                        true,
                    },
                    {
                      text:
                        customerContext.customerName,
                      color:
                        "#111827",
                      fontSize:
                        10,
                      bold:
                        true,
                      margin: [
                        0,
                        4,
                        0,
                        0,
                      ],
                    },
                  ],
                  margin: [
                    8,
                    7,
                    8,
                    7,
                  ],
                },
                {
                  stack: [
                    {
                      text:
                        "ARAÇ",
                      color:
                        "#6b7280",
                      fontSize:
                        7,
                      bold:
                        true,
                    },
                    {
                      text:
                        vehicleText,
                      color:
                        "#111827",
                      fontSize:
                        10,
                      bold:
                        true,
                      margin: [
                        0,
                        4,
                        0,
                        0,
                      ],
                    },
                  ],
                  margin: [
                    8,
                    7,
                    8,
                    7,
                  ],
                },
                {
                  stack: [
                    {
                      text:
                        "TEKLİF TARİHİ",
                      color:
                        "#6b7280",
                      fontSize:
                        7,
                      bold:
                        true,
                    },
                    {
                      text:
                        formatDate(
                          offer.createdAt
                        ),
                      color:
                        "#111827",
                      fontSize:
                        9,
                      bold:
                        true,
                      margin: [
                        0,
                        4,
                        0,
                        0,
                      ],
                    },
                  ],
                  margin: [
                    8,
                    7,
                    8,
                    7,
                  ],
                },
              ],
            ],
          },
          layout: {
            fillColor: () =>
              "#f8fafc",
            hLineColor: () =>
              "#e5e7eb",
            vLineColor: () =>
              "#e5e7eb",
            hLineWidth: () =>
              0.6,
            vLineWidth: () =>
              0.6,
            paddingLeft: () =>
              0,
            paddingRight: () =>
              0,
            paddingTop: () =>
              0,
            paddingBottom: () =>
              0,
          },
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
            productFeatureSections.length > 0
              ? 12
              : 20,
          ],
        },

        ...productFeatureContent,

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
      [
        offerNumber,
        customerContext.customerName !==
          "-"
          ? customerContext.customerName
          : "",
        snapshot.name ||
          "teklif",
      ]
        .filter(Boolean)
        .join("-")
    );

  return {
    documentDefinition,
    fileName,
  };
}

function downloadBlob(
  blob: Blob,
  fileName: string
) {
  const url =
    URL.createObjectURL(
      blob
    );

  const anchor =
    document.createElement(
      "a"
    );

  anchor.href =
    url;
  anchor.download =
    fileName;

  document.body.appendChild(
    anchor
  );

  anchor.click();
  anchor.remove();

  window.setTimeout(
    () => {
      URL.revokeObjectURL(
        url
      );
    },
    1000
  );
}

async function createPdfBlob(
  documentDefinition:
    TDocumentDefinitions
): Promise<Blob> {
  const blob =
    await pdfMake
      .createPdf(
        documentDefinition
      )
      .getBlob();

  if (!blob) {
    throw new Error(
      "PDF blob oluşturulamadı."
    );
  }

  return blob;
}

async function convertPdfBlobToJpgBlobs(
  pdfBlob: Blob
): Promise<Blob[]> {
  const pdfjs =
    await import(
      "pdfjs-dist/legacy/build/pdf.mjs"
    );

  if (
    !pdfjs
      .GlobalWorkerOptions
      .workerSrc
  ) {
    pdfjs.GlobalWorkerOptions.workerSrc =
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
  }

  const pdfBytes =
    new Uint8Array(
      await pdfBlob.arrayBuffer()
    );

  const pdf =
    await pdfjs
      .getDocument({
        data:
          pdfBytes,
      })
      .promise;

  const renderScale =
    Math.max(
      2,
      Math.min(
        window.devicePixelRatio ||
          1,
        2.5
      )
    );

  const jpgBlobs:
    Blob[] = [];

  for (
    let pageNumber = 1;
    pageNumber <=
    pdf.numPages;
    pageNumber += 1
  ) {
    const page =
      await pdf.getPage(
        pageNumber
      );

    const viewport =
      page.getViewport({
        scale:
          renderScale,
      });

    const canvas =
      document.createElement(
        "canvas"
      );

    const context =
      canvas.getContext(
        "2d"
      );

    if (!context) {
      throw new Error(
        "JPG oluşturmak için canvas hazırlanamadı."
      );
    }

    canvas.width =
      Math.ceil(
        viewport.width
      );

    canvas.height =
      Math.ceil(
        viewport.height
      );

    context.fillStyle =
      "#ffffff";

    context.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    await page.render({
      canvasContext:
        context,
      viewport,
    } as any).promise;

    const jpgBlob =
      await new Promise<Blob>(
        (resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(
                  new Error(
                    `JPG sayfa ${pageNumber} oluşturulamadı.`
                  )
                );
                return;
              }

              resolve(blob);
            },
            "image/jpeg",
            0.95
          );
        }
      );

    jpgBlobs.push(
      jpgBlob
    );

    page.cleanup();
  }

  if (
    jpgBlobs.length ===
    0
  ) {
    throw new Error(
      "JPG oluşturulacak PDF sayfası bulunamadı."
    );
  }

  return jpgBlobs;
}

export async function createCustomerOfferPdf(
  offer:
    CustomerSystemOffer
) {
  const {
    documentDefinition,
    fileName,
  } =
    await buildCustomerOfferDocument(
      offer
    );

  const pdfBlob =
    await createPdfBlob(
      documentDefinition
    );

  downloadBlob(
    pdfBlob,
    `${fileName}.pdf`
  );
}

export async function createCustomerOfferJpg(
  offer:
    CustomerSystemOffer
) {
  const {
    documentDefinition,
    fileName,
  } =
    await buildCustomerOfferDocument(
      offer
    );

  const pdfBlob =
    await createPdfBlob(
      documentDefinition
    );

  const jpgBlobs =
    await convertPdfBlobToJpgBlobs(
      pdfBlob
    );

  if (
    jpgBlobs.length ===
    1
  ) {
    downloadBlob(
      jpgBlobs[0],
      `${fileName}.jpg`
    );
    return;
  }

  jpgBlobs.forEach(
    (jpgBlob, index) => {
      window.setTimeout(
        () => {
          downloadBlob(
            jpgBlob,
            `${fileName}-sayfa-${
              index + 1
            }.jpg`
          );
        },
        index * 250
      );
    }
  );
}