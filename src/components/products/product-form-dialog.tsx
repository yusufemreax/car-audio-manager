/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import {
  ImagePlus,
  Loader2,
  Trash2,
} from "lucide-react";

import {
  Product,
  ProductCategory,
  ProductPayload,
  ProductSpecificationValue,
} from "@/types/product";

import {
  PRODUCT_SUPPLIERS,
  type ProductSupplier,
} from "@/types/supplier";

import {
  ProductFieldDefinition,
  isProductCategory,
  productCategoryDefinitions,
} from "@/lib/product-config";

import {
  Button,
} from "@/components/ui/button";

import {
  Checkbox,
} from "@/components/ui/checkbox";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Input,
} from "@/components/ui/input";

import {
  Label,
} from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Textarea,
} from "@/components/ui/textarea";

/*
 * =========================================================
 * TYPES
 * =========================================================
 */

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

interface ExchangeRateResponse {
  success: boolean;

  message?: string;

  data?: {
    from: string;
    to: string;
    rate: number;
    date?: string;
  };
}

interface NextProductCodeResponse {
  success: boolean;

  message?: string;

  data?: {
    productCode: string;
  };
}

interface ProductImageUploadResponse {
  success: boolean;

  message?: string;

  data?: {
    imageUrl: string;
    imagePublicId: string;
    width: number;
    height: number;
    bytes: number;
  };
}

interface SourcePriceResponse {
  success: boolean;
  message?: string;
  data?: {
    source: "EGB";
    sourceUrl: string;
    finalUrl: string;
    responseStatus: number;
    loggedIn: true;
    rawPrice: string;
    priceUsd: number;
  };
}

interface ProductFormDialogProps {
  open: boolean;

  onOpenChange:
    (open: boolean) => void;

  /*
   * Parent gönderirse kullanılır.
   *
   * Gönderilmezse URL'deki:
   *
   * /products/[category]
   *
   * parametresinden otomatik çözülür.
   */
  category?: ProductCategory;

  product?: Product | null;

  onSaved?:
    (product: Product) => void;
}

interface ProductFormState {
  productCode: string;

  brand: string;

  model: string;

  priceUsd: string;

  subCategory: string;

  suppliers: ProductSupplier[];

  sourceUrl: string;

  specifications: Record<
    string,
    ProductSpecificationValue | string
  >;

  description: string;
}

/*
 * =========================================================
 * EMPTY FORM
 * =========================================================
 */

function createEmptyForm(): ProductFormState {
  return {
    productCode: "",
    brand: "",
    model: "",
    priceUsd: "",
    subCategory: "",
    suppliers: ["EGB"],
    sourceUrl: "",
    specifications: {},
    description: "",
  };
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
  ).format(value);
}

function isSupportedSourceUrl(
  value: string
) {
  try {
    const url =
      new URL(value);

    return (
      url.protocol === "https:" &&
      (
        url.hostname.toLowerCase() ===
          "www.b2begb.com" ||
        url.hostname.toLowerCase() ===
          "b2begb.com"
      )
    );
  } catch {
    return false;
  }
}

/*
 * =========================================================
 * AMPLIFIER POWER / CHANNEL HELPERS
 * =========================================================
 */

const amplifierPowerChannelOptions = [
  "1CH",
  "2CH",
  "4CH",
  "6CH",
  "8CH",
];

function parsePowerChannelValue(
  value: unknown,
  defaultChannel: string
) {
  const rawValue =
    String(
      value ?? ""
    ).trim();

  if (!rawValue) {
    return {
      watt: "",
      channel:
        defaultChannel,
    };
  }

  const match =
    rawValue.match(
      /^(.+?)\s*[xX]\s*(1CH|2CH|4CH|6CH|8CH)$/i
    );

  if (!match) {
    return {
      watt:
        rawValue,
      channel:
        defaultChannel,
    };
  }

  return {
    watt:
      match[1].trim(),
    channel:
      match[2].toUpperCase(),
  };
}

function createPowerChannelValue(
  watt: string,
  channel: string
) {
  const cleanWatt =
    watt.trim();

  if (!cleanWatt) {
    return "";
  }

  return `${cleanWatt}x${channel}`;
}

/*
 * =========================================================
 * IMAGE HELPERS
 * =========================================================
 */

async function uploadProductImage(
  file: File
) {
  const formData =
    new FormData();

  formData.append(
    "file",
    file
  );

  const response =
    await fetch(
      "/api/product-images",
      {
        method: "POST",
        body: formData,
      }
    );

  const result:
    ProductImageUploadResponse =
    await response.json();

  if (
    !response.ok ||
    !result.success ||
    !result.data
  ) {
    throw new Error(
      result.message ??
        "Resim yüklenemedi."
    );
  }

  return result.data;
}

async function deleteProductImage(
  publicId: string
) {
  if (
    !publicId.trim()
  ) {
    return;
  }

  try {
    const response =
      await fetch(
        "/api/product-images",
        {
          method: "DELETE",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              publicId,
            }),
        }
      );

    if (!response.ok) {
      console.error(
        "Cloudinary resmi silinemedi:",
        publicId
      );
    }
  } catch (error) {
    console.error(
      "Cloudinary resmi silinemedi:",
      error
    );
  }
}

/*
 * =========================================================
 * COMPONENT
 * =========================================================
 */

export function ProductFormDialog({
  open,
  onOpenChange,
  category,
  product = null,
  onSaved,
}: ProductFormDialogProps) {
  /*
   * =======================================================
   * ROUTE PARAMETER
   *
   * Örn:
   *
   * /products/speaker
   *             ↑
   *          category
   * =======================================================
   */

  const params =
    useParams<{
      category?: string;
    }>();

  const routeCategory =
    useMemo<ProductCategory | null>(
      () => {
        const value =
          params?.category;

        if (
          !value ||
          !isProductCategory(
            value
          )
        ) {
          return null;
        }

        return value;
      },
      [
        params?.category,
      ]
    );

  /*
   * =======================================================
   * MODE
   * =======================================================
   */

  const mode:
    "add" | "edit" =
    product
      ? "edit"
      : "add";

  /*
   * =======================================================
   * RESOLVED CATEGORY
   *
   * Öncelik:
   *
   * 1. category prop
   * 2. edit product.category
   * 3. URL /products/[category]
   *
   * Böylece add ekranında parent category
   * göndermese bile dialog çalışır.
   * =======================================================
   */

  const resolvedCategory =
    useMemo<ProductCategory | null>(
      () => {
        if (category) {
          return category;
        }

        if (
          product?.category
        ) {
          return product.category;
        }

        return routeCategory;
      },
      [
        category,
        product?.category,
        routeCategory,
      ]
    );

  /*
   * =======================================================
   * CATEGORY DEFINITION
   * =======================================================
   */

  const categoryDefinition =
    useMemo(
      () => {
        if (
          !resolvedCategory
        ) {
          return undefined;
        }

        return productCategoryDefinitions[
          resolvedCategory
        ];
      },
      [
        resolvedCategory,
      ]
    );

  /*
   * undefined güvenliği.
   *
   * categoryDefinition yoksa [].
   */
  const categoryFields =
    useMemo<
      ProductFieldDefinition[]
    >(
      () =>
        categoryDefinition
          ?.fields ?? [],
      [
        categoryDefinition,
      ]
    );

  /*
   * =======================================================
   * STATE
   * =======================================================
   */

  const [
    powerChannels,
    setPowerChannels,
  ] =
    useState<
      Record<string, string>
    >({});

  const [
    imageFile,
    setImageFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    imagePreviewUrl,
    setImagePreviewUrl,
  ] =
    useState("");

  const [
    removeImage,
    setRemoveImage,
  ] =
    useState(false);

  const [
    uploadingImage,
    setUploadingImage,
  ] =
    useState(false);

  const [
    form,
    setForm,
  ] =
    useState<ProductFormState>(
      createEmptyForm()
    );

  const [
    usdTryRate,
    setUsdTryRate,
  ] =
    useState<number | null>(
      null
    );

  const [
    exchangeRateDate,
    setExchangeRateDate,
  ] =
    useState<string | null>(
      null
    );

  const [
    loadingExchangeRate,
    setLoadingExchangeRate,
  ] =
    useState(false);

  const [
    loadingProductCode,
    setLoadingProductCode,
  ] =
    useState(false);

  const [
    loadingSourcePrice,
    setLoadingSourcePrice,
  ] =
    useState(false);

  const [
    sourcePriceError,
    setSourcePriceError,
  ] =
    useState<string | null>(
      null
    );

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  /*
   * =======================================================
   * RESET / LOAD PRODUCT
   * =======================================================
   */

  useEffect(() => {
    if (!open) {
      return;
    }

    setError(null);
    setSourcePriceError(
      null
    );
    setLoadingSourcePrice(
      false
    );

    /*
     * EDIT MODE
     */
    if (product) {
      const editSpecifications = {
        ...product.specifications,
      };

      /*
       * Eski amfi kayıtlarında bridgeRms tek alandı.
       * Yeni yapıda bunu Köprü 4Ω alanına taşıyoruz.
       */
      if (
        resolvedCategory ===
          "amplifier" &&
        editSpecifications[
          "bridgeRmsAt4Ohm"
        ] === undefined &&
        editSpecifications[
          "bridgeRms"
        ] !== undefined
      ) {
        editSpecifications[
          "bridgeRmsAt4Ohm"
        ] =
          editSpecifications[
            "bridgeRms"
          ];
      }

      delete editSpecifications[
        "bridgeRms"
      ];

      const nextPowerChannels:
        Record<string, string> = {};

      for (
        const field of
        categoryFields
      ) {
        if (
          field.inputType !==
          "power-channel"
        ) {
          continue;
        }

        const parsed =
          parsePowerChannelValue(
            editSpecifications[
              field.key
            ],
            field.defaultChannel ??
              "4CH"
          );

        nextPowerChannels[
          field.key
        ] = parsed.channel;
      }

      setPowerChannels(
        nextPowerChannels
      );

      setForm({
        productCode:
          product.productCode,

        brand:
          product.brand,

        model:
          product.model,

        priceUsd:
          String(
            product.priceUsd
          ),

        subCategory:
          product.subCategory ??
          "",

        suppliers:
          product.suppliers?.length
            ? product.suppliers
            : ["EGB"],

        sourceUrl:
          product.sourceUrl ??
          "",

        specifications:
          editSpecifications,

        description:
          product.description ??
          "",
      });

      setImageFile(
        null
      );

      setImagePreviewUrl(
        product?.imageUrl ??
          ""
      );

      setRemoveImage(
        false
      );

      setUploadingImage(
        false
      );

      return;
    }

    /*
     * ADD MODE
     */

    const specifications:
      Record<
        string,
        ProductSpecificationValue | string
      > = {};

    const nextPowerChannels:
      Record<string, string> = {};

    for (
      const field of
      categoryFields
    ) {
      if (
        field.source !==
        "specifications"
      ) {
        continue;
      }

      /*
       * Boolean alanlar default false.
       */
      if (
        field.inputType ===
        "boolean"
      ) {
        specifications[
          field.key
        ] = false;

        continue;
      }

      if (
        field.inputType ===
        "power-channel"
      ) {
        nextPowerChannels[
          field.key
        ] =
          field.defaultChannel ??
          "4CH";
      }

      /*
       * Text / select / number / power-channel
       * başlangıçta boş.
       */
      specifications[
        field.key
      ] = "";
    }

    setPowerChannels(
      nextPowerChannels
    );

    setForm({
      ...createEmptyForm(),

      specifications,
    });

    setImageFile(
      null
    );

    setImagePreviewUrl(
      ""
    );

    setRemoveImage(
      false
    );

    setUploadingImage(
      false
    );
  }, [
    open,
    product,
    resolvedCategory,
    categoryFields,
  ]);

  /*
   * =======================================================
   * SOURCE URL -> AUTOMATIC USD PRICE
   *
   * Link doluysa fiyat kullanıcı tarafından yazılmaz.
   * 650 ms debounce sonrasında EGB'den okunur.
   * Backend de kayıt sırasında fiyatı yeniden doğrular.
   * =======================================================
   */

  useEffect(() => {
    if (!open) {
      return;
    }

    const sourceUrl =
      form.sourceUrl.trim();

    if (!sourceUrl) {
      setLoadingSourcePrice(
        false
      );
      setSourcePriceError(
        null
      );

      return;
    }

    if (
      !isSupportedSourceUrl(
        sourceUrl
      )
    ) {
      setLoadingSourcePrice(
        false
      );
      setSourcePriceError(
        "Şimdilik yalnızca b2begb.com ürün linkleri destekleniyor."
      );

      return;
    }

    let cancelled =
      false;

    const timeoutId =
      window.setTimeout(
        async () => {
          setLoadingSourcePrice(
            true
          );
          setSourcePriceError(
            null
          );

          try {
            const response =
              await fetch(
                "/api/scraping/egb/price",
                {
                  method:
                    "POST",
                  headers: {
                    "Content-Type":
                      "application/json",
                  },
                  body:
                    JSON.stringify({
                      url:
                        sourceUrl,
                    }),
                  cache:
                    "no-store",
                }
              );

            const result:
              SourcePriceResponse =
                await response.json();

            if (
              !response.ok ||
              !result.success ||
              !result.data
            ) {
              throw new Error(
                result.message ??
                  "Ürün fiyatı linkten alınamadı."
              );
            }

            if (cancelled) {
              return;
            }

            setForm(
              (previous) => {
                /*
                 * Kullanıcı debounce sırasında başka link yazdıysa
                 * eski request'in fiyatını yeni linke uygulama.
                 */
                if (
                  previous.sourceUrl.trim() !==
                  sourceUrl
                ) {
                  return previous;
                }

                return {
                  ...previous,
                  priceUsd:
                    String(
                      result.data!.priceUsd
                    ),
                };
              }
            );
          } catch (sourceError) {
            if (cancelled) {
              return;
            }

            setSourcePriceError(
              sourceError instanceof Error
                ? sourceError.message
                : "Ürün fiyatı linkten alınamadı."
            );
          } finally {
            if (!cancelled) {
              setLoadingSourcePrice(
                false
              );
            }
          }
        },
        650
      );

    return () => {
      cancelled = true;
      window.clearTimeout(
        timeoutId
      );
    };
  }, [
    open,
    form.sourceUrl,
  ]);

  /*
   * =======================================================
   * AUTOMATIC PRODUCT CODE
   *
   * Sadece ADD işleminde çalışır.
   *
   * speaker   -> spk-001
   * amplifier -> amp-001
   * cable     -> cbl-001
   * ...
   *
   * EDIT işleminde mevcut kod korunur.
   * =======================================================
   */

  useEffect(() => {
    if (
      !open ||
      mode !== "add"
    ) {
      return;
    }

    if (
      !resolvedCategory
    ) {
      setLoadingProductCode(
        false
      );

      setError(
        "Ürün kategorisi belirlenemedi."
      );

      return;
    }

    let cancelled =
      false;

    const loadProductCode =
      async () => {
        setLoadingProductCode(
          true
        );

        try {
          const response =
            await fetch(
              `/api/products/next-code?category=${encodeURIComponent(
                resolvedCategory
              )}`,
              {
                cache:
                  "no-store",
              }
            );

          const result:
            NextProductCodeResponse =
            await response.json();

          if (
            !response.ok ||
            !result.success ||
            !result.data
              ?.productCode
          ) {
            throw new Error(
              result.message ??
                "Ürün kodu oluşturulamadı."
            );
          }

          if (cancelled) {
            return;
          }

          setForm(
            (
              previous
            ) => ({
              ...previous,

              productCode:
                result.data!
                  .productCode,
            })
          );
        } catch (
          error
        ) {
          if (cancelled) {
            return;
          }

          setError(
            error instanceof Error
              ? error.message
              : "Ürün kodu oluşturulamadı."
          );
        } finally {
          if (
            !cancelled
          ) {
            setLoadingProductCode(
              false
            );
          }
        }
      };

    void loadProductCode();

    return () => {
      cancelled =
        true;
    };
  }, [
    open,
    mode,
    resolvedCategory,
  ]);

  /*
   * =======================================================
   * EXCHANGE RATE
   * =======================================================
   */

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled =
      false;

    const loadExchangeRate =
      async () => {
        setLoadingExchangeRate(
          true
        );

        try {
          const response =
            await fetch(
              "/api/exchange-rate",
              {
                cache:
                  "no-store",
              }
            );

          const result:
            ExchangeRateResponse =
            await response.json();

          if (
            !response.ok ||
            !result.success ||
            !result.data
          ) {
            throw new Error(
              result.message ??
                "Kur bilgisi alınamadı."
            );
          }

          if (cancelled) {
            return;
          }

          setUsdTryRate(
            result.data.rate
          );

          setExchangeRateDate(
            result.data.date ??
              null
          );
        } catch (
          error
        ) {
          console.error(
            "Exchange rate error:",
            error
          );

          if (
            !cancelled
          ) {
            setUsdTryRate(
              null
            );

            setExchangeRateDate(
              null
            );
          }
        } finally {
          if (
            !cancelled
          ) {
            setLoadingExchangeRate(
              false
            );
          }
        }
      };

    void loadExchangeRate();

    return () => {
      cancelled =
        true;
    };
  }, [open]);

  /*
   * =======================================================
   * TRY PRICE
   * =======================================================
   */

  const priceTry =
    useMemo(() => {
      const priceUsd =
        Number(
          form.priceUsd
        );

      if (
        !Number.isFinite(
          priceUsd
        ) ||
        !usdTryRate
      ) {
        return 0;
      }

      return (
        priceUsd *
        usdTryRate
      );
    }, [
      form.priceUsd,
      usdTryRate,
    ]);

  /*
   * =======================================================
   * SET SPECIFICATION
   * =======================================================
   */

  const setSpecification =
    (
      key: string,
      value:
        ProductSpecificationValue |
        string
    ) => {
      setForm(
        (
          previous
        ) => ({
          ...previous,

          specifications: {
            ...previous.specifications,

            [key]:
              value,
          },
        })
      );
    };


  const isFieldVisible =
    (
      field:
        ProductFieldDefinition
    ) => {
      if (
        !field.visibleWhen
      ) {
        return true;
      }

      const dependencyValue =
        String(
          form.specifications[
            field.visibleWhen.key
          ] ??
          ""
        );

      if (
        field.visibleWhen.values
          ?.length
      ) {
        return field.visibleWhen.values.includes(
          dependencyValue
        );
      }

      return (
        dependencyValue ===
        (field.visibleWhen.value ??
          "")
      );
    };

  const handleAmplifierChannelCountChange =
    (value: string) => {
      setForm(
        (previous) => {
          const specifications:
            ProductFormState["specifications"] = {
              ...previous.specifications,
              channelCount:
                value,
            };

          /*
           * Subw alanları yalnızca 5 kanal amfide geçerli.
           * 5 kanaldan başka seçime geçilirse eski değerleri
           * payload'a taşımamak için state'ten de siliyoruz.
           */
          if (
            value !== "5"
          ) {
            delete specifications[
              "subwooferRmsAt4Ohm"
            ];

            delete specifications[
              "subwooferRmsAt2Ohm"
            ];
          }

          return {
            ...previous,
            specifications,
          };
        }
      );

      if (
        value !== "5"
      ) {
        setPowerChannels(
          (previous) => ({
            ...previous,
            subwooferRmsAt4Ohm:
              "1CH",
            subwooferRmsAt2Ohm:
              "1CH",
          })
        );
      }
    };

  /*
   * =======================================================
   * IMAGE PREVIEW CLEANUP
   * =======================================================
   */

  useEffect(() => {
    return () => {
      if (
        imagePreviewUrl.startsWith(
          "blob:"
        )
      ) {
        URL.revokeObjectURL(
          imagePreviewUrl
        );
      }
    };
  }, [
    imagePreviewUrl,
  ]);

  /*
   * =======================================================
   * IMAGE CHANGE
   * =======================================================
   */

  const handleImageChange = (
    event:
      React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target
        .files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes =
      new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
      ]);

    if (
      !allowedTypes.has(
        file.type
      )
    ) {
      setError(
        "Sadece JPG, PNG veya WEBP resimleri yüklenebilir."
      );

      event.target.value =
        "";

      return;
    }

    const maxFileSize =
      5 * 1024 * 1024;

    if (
      file.size >
      maxFileSize
    ) {
      setError(
        "Resim boyutu maksimum 5 MB olabilir."
      );

      event.target.value =
        "";

      return;
    }

    if (
      file.size ===
      0
    ) {
      setError(
        "Boş resim dosyası seçilemez."
      );

      event.target.value =
        "";

      return;
    }

    setError(
      null
    );

    setImageFile(
      file
    );

    setRemoveImage(
      false
    );

    setImagePreviewUrl(
      URL.createObjectURL(
        file
      )
    );
  };

  /*
   * =======================================================
   * REMOVE IMAGE FROM FORM
   * =======================================================
   */

  const handleRemoveImage =
    () => {
      setImageFile(
        null
      );

      setImagePreviewUrl(
        ""
      );

      setRemoveImage(
        true
      );

      setError(
        null
      );
    };

  /*
   * =======================================================
   * VALIDATION
   * =======================================================
   */

  const validateForm =
    (): string | null => {
      if (
        !resolvedCategory
      ) {
        return "Ürün kategorisi belirlenemedi.";
      }

      if (
        !categoryDefinition
      ) {
        return "Ürün kategorisi tanımı bulunamadı.";
      }

      if (
        !form.productCode.trim()
      ) {
        return "Ürün kodu oluşturulamadı.";
      }

      if (
        !form.brand.trim()
      ) {
        return "Marka zorunludur.";
      }

      if (
        !form.model.trim()
      ) {
        return "Model zorunludur.";
      }

      const sourceUrl =
        form.sourceUrl.trim();

      if (sourceUrl) {
        if (
          !isSupportedSourceUrl(
            sourceUrl
          )
        ) {
          return "Şimdilik yalnızca b2begb.com ürün linkleri destekleniyor.";
        }

        if (loadingSourcePrice) {
          return "Ürün fiyatı linkten okunuyor. Lütfen işlemin tamamlanmasını bekleyin.";
        }

        if (sourcePriceError) {
          return sourcePriceError;
        }

        if (
          form.priceUsd ===
          ""
        ) {
          return "Ürün linkinden fiyat alınamadı.";
        }
      } else if (
        form.priceUsd ===
        ""
      ) {
        return "USD fiyatı zorunludur.";
      }

      const priceUsd =
        Number(
          form.priceUsd
        );

      if (
        !Number.isFinite(
          priceUsd
        ) ||
        priceUsd < 0
      ) {
        return "USD fiyatı 0 veya daha büyük olmalıdır.";
      }

      if (
        form.suppliers.length ===
        0
      ) {
        return "En az bir tedarikçi seçmelisiniz.";
      }

      /*
       * CATEGORY DYNAMIC FIELDS
       */
      for (
        const field of
        categoryFields
      ) {
        if (
          !isFieldVisible(
            field
          )
        ) {
          continue;
        }

        const value =
          field.source ===
          "specifications"
            ? form.specifications[
                field.key
              ]
            : undefined;

        /*
         * POWER + CHANNEL
         *
         * Örn: 100x4CH
         */
        if (
          field.source ===
            "specifications" &&
          field.inputType ===
            "power-channel"
        ) {
          const parsed =
            parsePowerChannelValue(
              value,
              field.defaultChannel ??
                "4CH"
            );

          if (
            !parsed.watt
          ) {
            if (
              field.required
            ) {
              return `${field.label} zorunludur.`;
            }

            continue;
          }

          const wattValue =
            Number(
              parsed.watt
            );

          if (
            !Number.isFinite(
              wattValue
            ) ||
            wattValue < 0
          ) {
            return `${field.label} 0 veya daha büyük olmalıdır.`;
          }

          const selectedChannel =
            powerChannels[
              field.key
            ] ??
            parsed.channel;

          if (
            !amplifierPowerChannelOptions.includes(
              selectedChannel
            )
          ) {
            return `${field.label} için geçerli bir kanal seçiniz.`;
          }

          continue;
        }

        if (
          !field.required
        ) {
          continue;
        }

        /*
         * SUB CATEGORY
         */
        if (
          field.source ===
          "subCategory"
        ) {
          if (
            !form.subCategory
              .trim()
          ) {
            return `${field.label} zorunludur.`;
          }

          continue;
        }

        /*
         * BOOLEAN
         *
         * true ve false ikisi de
         * geçerli değer.
         */
        if (
          field.inputType ===
          "boolean"
        ) {
          continue;
        }

        /*
         * NUMBER
         *
         * 0 geçerli.
         *
         * Örnek:
         * Kablo -> 0 GA
         */
        if (
          field.inputType ===
          "number"
        ) {
          if (
            value ===
              undefined ||
            value ===
              null ||
            value === ""
          ) {
            return `${field.label} zorunludur.`;
          }

          const numericValue =
            Number(value);

          if (
            !Number.isFinite(
              numericValue
            ) ||
            numericValue < 0
          ) {
            return `${field.label} 0 veya daha büyük olmalıdır.`;
          }

          continue;
        }

        /*
         * TEXT / SELECT
         */
        if (
          value ===
            undefined ||
          value ===
            null ||
          String(
            value
          ).trim() === ""
        ) {
          return `${field.label} zorunludur.`;
        }
      }

      return null;
    };

  /*
   * =======================================================
   * BUILD PAYLOAD
   * =======================================================
   */

  const buildPayload =
    (): ProductPayload | null => {
      if (
        !resolvedCategory
      ) {
        return null;
      }

      const specifications:
        Record<
          string,
          ProductSpecificationValue
        > = {};

      for (
        const field of
        categoryFields
      ) {
        /*
         * subCategory ayrı property'de.
         */
        if (
          field.source !==
          "specifications"
        ) {
          continue;
        }

        if (
          !isFieldVisible(
            field
          )
        ) {
          continue;
        }

        const currentValue =
          form.specifications[
            field.key
          ];

        /*
         * POWER + CHANNEL
         *
         * MongoDB'ye tek string olarak gider:
         * 100x4CH
         */
        if (
          field.inputType ===
          "power-channel"
        ) {
          const parsed =
            parsePowerChannelValue(
              currentValue,
              field.defaultChannel ??
                "4CH"
            );

          if (
            !parsed.watt
          ) {
            continue;
          }

          const selectedChannel =
            powerChannels[
              field.key
            ] ??
            parsed.channel;

          specifications[
            field.key
          ] =
            createPowerChannelValue(
              parsed.watt,
              selectedChannel
            );

          continue;
        }

        /*
         * BOOLEAN
         */
        if (
          field.inputType ===
          "boolean"
        ) {
          specifications[
            field.key
          ] =
            currentValue ===
            true;

          continue;
        }

        /*
         * NUMBER
         */
        if (
          field.inputType ===
          "number"
        ) {
          if (
            currentValue ===
              undefined ||
            currentValue ===
              null ||
            currentValue === ""
          ) {
            /*
             * Optional number.
             */
            continue;
          }

          specifications[
            field.key
          ] =
            Number(
              currentValue
            );

          continue;
        }

        /*
         * TEXT / SELECT
         */
        if (
          currentValue ===
            undefined ||
          currentValue ===
            null ||
          String(
            currentValue
          ).trim() === ""
        ) {
          continue;
        }

        specifications[
          field.key
        ] =
          String(
            currentValue
          ).trim();
      }

      return {
        productCode:
          form.productCode
            .trim(),

        brand:
          form.brand
            .trim(),

        model:
          form.model
            .trim(),

        priceUsd:
          Number(
            form.priceUsd
          ),

        category:
          resolvedCategory,

        suppliers:
          form.suppliers,

        sourceUrl:
          form.sourceUrl.trim(),

        ...(form.subCategory
          .trim()
          ? {
              subCategory:
                form.subCategory
                  .trim(),
            }
          : {}),

        specifications,

        ...(form.description
          .trim()
          ? {
              description:
                form.description
                  .trim(),
            }
          : {}),
      };
    };

  /*
   * =======================================================
   * SUBMIT
   * =======================================================
   */

  const handleSubmit =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      setError(null);

      const validationError =
        validateForm();

      if (
        validationError
      ) {
        setError(
          validationError
        );

        return;
      }

      const payload =
        buildPayload();

      if (!payload) {
        setError(
          "Ürün bilgileri oluşturulamadı."
        );

        return;
      }

      setSubmitting(true);

      let uploadedImage:
        ProductImageUploadResponse["data"] |
        null =
        null;

      try {
        /*
         * ===============================================
         * 1. IMAGE UPLOAD
         * ===============================================
         *
         * Görsel kullanıcı dosya seçtiği anda değil,
         * ürün kaydedilirken Cloudinary'e gönderilir.
         *
         * Böylece kullanıcı Vazgeç derse Cloudinary'de
         * sahipsiz dosya oluşmaz.
         */

        if (
          imageFile
        ) {
          setUploadingImage(
            true
          );

          uploadedImage =
            await uploadProductImage(
              imageFile
            );

          setUploadingImage(
            false
          );
        }

        /*
         * ===============================================
         * 2. FINAL PRODUCT PAYLOAD
         * ===============================================
         */

        const finalPayload:
          ProductPayload = {
            ...payload,

            /*
             * Yeni resim yüklendiyse
             * Cloudinary bilgilerini ürüne ekle.
             */
            ...(uploadedImage
              ? {
                  imageUrl:
                    uploadedImage
                      .imageUrl,

                  imagePublicId:
                    uploadedImage
                      .imagePublicId,
                }
              : {}),

            /*
             * Edit işleminde kullanıcı mevcut resmi
             * kaldırdıysa backend'e bildir.
             *
             * Yeni resim seçilmişse removeImage gönderme.
             */
            ...(removeImage &&
            !uploadedImage
              ? {
                  removeImage:
                    true,
                }
              : {}),
          };

        /*
         * ===============================================
         * 3. SAVE PRODUCT
         * ===============================================
         */

        const response =
          await fetch(
            mode ===
              "edit" &&
            product
              ? `/api/products/${product.id}`
              : "/api/products",
            {
              method:
                mode ===
                "edit"
                  ? "PUT"
                  : "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  finalPayload
                ),
            }
          );

        const result:
          ApiResponse<Product> =
          await response.json();

        if (
          !response.ok ||
          !result.success ||
          !result.data
        ) {
          throw new Error(
            result.message ??
              (
                mode ===
                "edit"
                  ? "Ürün güncellenemedi."
                  : "Ürün oluşturulamadı."
              )
          );
        }

        /*
         * ===============================================
         * 4. DELETE OLD CLOUDINARY IMAGE
         * ===============================================
         *
         * Eski resmi ürün kaydı BAŞARILI olmadan
         * kesinlikle silmiyoruz.
         */

        const oldPublicId =
          product?.imagePublicId ??
          "";

        if (
          oldPublicId
        ) {
          const imageChanged =
            Boolean(
              uploadedImage &&
              uploadedImage
                .imagePublicId !==
                oldPublicId
            );

          if (
            imageChanged ||
            (
              removeImage &&
              !uploadedImage
            )
          ) {
            await deleteProductImage(
              oldPublicId
            );
          }
        }

        /*
         * ===============================================
         * 5. COMPLETE
         * ===============================================
         */

        setImageFile(
          null
        );

        setRemoveImage(
          false
        );

        onSaved?.(
          result.data
        );

        onOpenChange(
          false
        );
      } catch (
        error
      ) {
        /*
         * Cloudinary upload başarılı oldu fakat
         * MongoDB ürün kaydı başarısız olduysa
         * yeni resmi temizle.
         */

        if (
          uploadedImage
            ?.imagePublicId
        ) {
          await deleteProductImage(
            uploadedImage
              .imagePublicId
          );
        }

        setError(
          error instanceof Error
            ? error.message
            : mode ===
                "edit"
              ? "Ürün güncellenemedi."
              : "Ürün oluşturulamadı."
        );
      } finally {
        setUploadingImage(
          false
        );

        setSubmitting(
          false
        );
      }
    };

  /*
   * =======================================================
   * DYNAMIC FIELD RENDER
   * =======================================================
   */

  const renderDynamicField =
    (
      field:
        ProductFieldDefinition
    ) => {
      if (
        !isFieldVisible(
          field
        )
      ) {
        return null;
      }

      const fieldLabel =
        field.unit
          ? `${field.label} (${field.unit})`
          : field.label;

      /*
       * ===================================================
       * SUB CATEGORY SELECT
       * ===================================================
       */

      if (
        field.source ===
          "subCategory" &&
        field.inputType ===
          "select"
      ) {
        const selectItems =
          (
            field.options ??
            []
          ).map(
            (
              option
            ) => ({
              value:
                option.value,

              label:
                option.label,
            })
          );

        return (
          <div
            key={
              field.key
            }
            className="space-y-2"
          >
            <Label>
              {fieldLabel}

              {field.required
                ? " *"
                : ""}
            </Label>

            <Select
              items={
                selectItems
              }
              value={
                form.subCategory
              }
              disabled={
                submitting
              }
              onValueChange={(
                newValue
              ) => {
                setForm(
                  (
                    previous
                  ) => ({
                    ...previous,

                    subCategory:
                      newValue ??
                      "",
                  })
                );
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={`${field.label} seçiniz`}
                />
              </SelectTrigger>

              <SelectContent>
                {field.options?.map(
                  (
                    option
                  ) => (
                    <SelectItem
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {
                        option.label
                      }
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        );
      }

      /*
       * ===================================================
       * SPECIFICATION SELECT
       * ===================================================
       */

      if (
        field.source ===
          "specifications" &&
        field.inputType ===
          "select"
      ) {
        const currentValue =
          form.specifications[
            field.key
          ];

        const selectValue =
          currentValue ===
            undefined ||
          currentValue ===
            null
            ? ""
            : String(
                currentValue
              );

        const selectItems =
          (
            field.options ??
            []
          ).map(
            (
              option
            ) => ({
              value:
                option.value,

              label:
                option.label,
            })
          );

        return (
          <div
            key={
              field.key
            }
            className="space-y-2"
          >
            <Label>
              {fieldLabel}

              {field.required
                ? " *"
                : ""}
            </Label>

            <Select
              items={
                selectItems
              }
              value={
                selectValue
              }
              disabled={
                submitting
              }
              onValueChange={(
                newValue
              ) => {
                const selectedValue =
                  newValue ??
                  "";

                if (
                  resolvedCategory ===
                    "amplifier" &&
                  field.key ===
                    "channelCount"
                ) {
                  handleAmplifierChannelCountChange(
                    selectedValue
                  );

                  return;
                }

                setSpecification(
                  field.key,
                  selectedValue
                );
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={`${field.label} seçiniz`}
                />
              </SelectTrigger>

              <SelectContent>
                {field.options?.map(
                  (
                    option
                  ) => (
                    <SelectItem
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {
                        option.label
                      }
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        );
      }

      /*
       * ===================================================
       * AMPLIFIER POWER + CHANNEL
       * ===================================================
       */

      if (
        field.source ===
          "specifications" &&
        field.inputType ===
          "power-channel"
      ) {
        const currentValue =
          form.specifications[
            field.key
          ];

        const parsed =
          parsePowerChannelValue(
            currentValue,
            field.defaultChannel ??
              "4CH"
          );

        const selectedChannel =
          powerChannels[
            field.key
          ] ??
          parsed.channel;

        const channelItems =
          amplifierPowerChannelOptions.map(
            (value) => ({
              value,
              label: value,
            })
          );

        return (
          <div
            key={field.key}
            className="space-y-2"
          >
            <Label
              htmlFor={`spec-${field.key}`}
            >
              {field.label}

              {field.required
                ? " *"
                : ""}
            </Label>

            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Input
                  id={`spec-${field.key}`}
                  type="number"
                  min="0"
                  step="any"
                  value={
                    parsed.watt
                  }
                  disabled={
                    submitting
                  }
                  placeholder="100"
                  className="pr-10"
                  onChange={(
                    event
                  ) => {
                    setSpecification(
                      field.key,
                      createPowerChannelValue(
                        event.target.value,
                        selectedChannel
                      )
                    );
                  }}
                />

                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                  W
                </span>
              </div>

              <Select
                items={
                  channelItems
                }
                value={
                  selectedChannel
                }
                disabled={
                  submitting
                }
                onValueChange={(
                  newValue
                ) => {
                  const nextChannel =
                    newValue ??
                    field.defaultChannel ??
                    "4CH";

                  setPowerChannels(
                    (previous) => ({
                      ...previous,
                      [field.key]:
                        nextChannel,
                    })
                  );

                  if (
                    parsed.watt
                  ) {
                    setSpecification(
                      field.key,
                      createPowerChannelValue(
                        parsed.watt,
                        nextChannel
                      )
                    );
                  }
                }}
              >
                <SelectTrigger className="w-24 shrink-0">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {amplifierPowerChannelOptions.map(
                    (value) => (
                      <SelectItem
                        key={value}
                        value={value}
                      >
                        {value}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-muted-foreground">
              Kayıt değeri: {
                parsed.watt
                  ? createPowerChannelValue(
                      parsed.watt,
                      selectedChannel
                    )
                  : `Watt değeri x ${selectedChannel}`
              }
            </p>
          </div>
        );
      }

      /*
       * ===================================================
       * BOOLEAN
       * ===================================================
       */

      if (
        field.source ===
          "specifications" &&
        field.inputType ===
          "boolean"
      ) {
        const checked =
          form.specifications[
            field.key
          ] === true;

        return (
          <div
            key={
              field.key
            }
            className="flex min-h-16 items-center gap-3 rounded-xl border bg-muted/10 px-4 py-3"
          >
            <Checkbox
              id={`spec-${field.key}`}
              checked={
                checked
              }
              disabled={
                submitting
              }
              onCheckedChange={(
                value
              ) => {
                setSpecification(
                  field.key,

                  value ===
                    true
                );
              }}
            />

            <Label
              htmlFor={`spec-${field.key}`}
              className="cursor-pointer"
            >
              {fieldLabel}
            </Label>
          </div>
        );
      }

      /*
       * ===================================================
       * NUMBER
       * ===================================================
       */

      if (
        field.source ===
          "specifications" &&
        field.inputType ===
          "number"
      ) {
        const currentValue =
          form.specifications[
            field.key
          ];

        return (
          <div
            key={
              field.key
            }
            className="space-y-2"
          >
            <Label
              htmlFor={`spec-${field.key}`}
            >
              {fieldLabel}

              {field.required
                ? " *"
                : ""}
            </Label>

            <Input
              id={`spec-${field.key}`}
              type="number"

              /*
               * 0 geçerli.
               *
               * Örn:
               * Kesit = 0 GA
               */
              min="0"

              step="any"

              value={
                currentValue ===
                  undefined ||
                currentValue ===
                  null
                  ? ""
                  : String(
                      currentValue
                    )
              }

              disabled={
                submitting
              }

              onChange={(
                event
              ) => {
                /*
                 * State'te string tutuyoruz.
                 *
                 * Böylece kullanıcı input'u
                 * tamamen silebilir.
                 *
                 * Submit'te number'a çevrilir.
                 */
                setSpecification(
                  field.key,

                  event
                    .target
                    .value
                );
              }}
            />
          </div>
        );
      }

      /*
       * ===================================================
       * TEXT
       * ===================================================
       */

      if (
        field.source ===
          "specifications" &&
        field.inputType ===
          "text"
      ) {
        const currentValue =
          form.specifications[
            field.key
          ];

        return (
          <div
            key={
              field.key
            }
            className="space-y-2"
          >
            <Label
              htmlFor={`spec-${field.key}`}
            >
              {fieldLabel}

              {field.required
                ? " *"
                : ""}
            </Label>

            <Input
              id={`spec-${field.key}`}
              value={
                currentValue ===
                  undefined ||
                currentValue ===
                  null
                  ? ""
                  : String(
                      currentValue
                    )
              }
              disabled={
                submitting
              }
              onChange={(
                event
              ) => {
                setSpecification(
                  field.key,

                  event
                    .target
                    .value
                );
              }}
            />
          </div>
        );
      }

      return null;
    };

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <Dialog
      open={open}
      onOpenChange={(
        newOpen
      ) => {
        if (
          submitting ||
          uploadingImage
        ) {
          return;
        }

        onOpenChange(
          newOpen
        );
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {mode ===
            "edit"
              ? "Ürün Düzenle"
              : "Yeni Ürün"}
          </DialogTitle>

          <DialogDescription>
            {categoryDefinition
              ?.label ??
              "Ürün"}{" "}
            bilgilerini giriniz.
          </DialogDescription>
        </DialogHeader>

        {/* =================================================
            CATEGORY ERROR
        ================================================= */}

        {!resolvedCategory && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Ürün kategorisi
            belirlenemedi.
            Geçerli bir ürün
            kategori sayfasından
            tekrar deneyiniz.
          </div>
        )}

        <form
          onSubmit={
            handleSubmit
          }
          className="space-y-6"
        >
          {/* =================================================
              PRODUCT IMAGE
          ================================================= */}

          <div className="space-y-3">
            <div>
              <Label>
                Ürün Görseli
              </Label>

              <p className="mt-1 text-xs text-muted-foreground">
                JPG, PNG veya WEBP
                yükleyebilirsiniz.
                Maksimum dosya boyutu
                5 MB.
              </p>
            </div>

            <div className="flex flex-col gap-4 rounded-xl border bg-muted/10 p-4 sm:flex-row sm:items-center">
              {/* PREVIEW */}

              <div className="flex size-36 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-background">
                {imagePreviewUrl ? (
                  <img
                    src={
                      imagePreviewUrl
                    }
                    alt={
                      form.model
                        ? `${form.brand} ${form.model}`
                        : "Ürün görseli"
                    }
                    className="h-full w-full object-contain p-2"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 px-3 text-center text-muted-foreground">
                    <ImagePlus className="size-8" />

                    <span className="text-xs">
                      Görsel yok
                    </span>
                  </div>
                )}
              </div>

              {/* IMAGE ACTIONS */}

              <div className="min-w-0 flex-1 space-y-3">
                <Input
                  key={
                    imageFile
                      ? `${imageFile.name}-${imageFile.lastModified}`
                      : "empty-product-image"
                  }
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={
                    submitting ||
                    uploadingImage
                  }
                  onChange={
                    handleImageChange
                  }
                />

                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    Görsel ürün kaydedilirken
                    Cloudinary&apos;ye yüklenir.
                  </p>

                  <p>
                    Veritabanında yalnızca
                    görsel URL&apos;si ve
                    Cloudinary public ID
                    bilgisi tutulur.
                  </p>
                </div>

                {imagePreviewUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      submitting ||
                      uploadingImage
                    }
                    className="text-destructive hover:text-destructive"
                    onClick={
                      handleRemoveImage
                    }
                  >
                    <Trash2 className="size-4" />

                    Resmi Kaldır
                  </Button>
                )}

                {uploadingImage && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />

                    Resim Cloudinary&apos;ye
                    yükleniyor...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* =================================================
              COMMON FIELDS
          ================================================= */}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* PRODUCT CODE */}

            <div className="space-y-2">
              <Label htmlFor="productCode">
                Ürün Kodu
              </Label>

              <div className="relative">
                <Input
                  id="productCode"
                  value={
                    loadingProductCode
                      ? ""
                      : form.productCode
                  }
                  placeholder={
                    loadingProductCode
                      ? "Oluşturuluyor..."
                      : ""
                  }
                  readOnly
                  className="bg-muted/40 pr-10 font-mono"
                />

                {loadingProductCode && (
                  <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Ürün kodu
                kategoriye göre
                otomatik
                oluşturulur.
              </p>
            </div>

            {/* CATEGORY */}

            <div className="space-y-2">
              <Label>
                Kategori
              </Label>

              <Input
                value={
                  categoryDefinition
                    ?.label ??
                  ""
                }
                placeholder="Kategori belirlenemedi"
                readOnly
                className="bg-muted/40"
              />
            </div>

            {/* BRAND */}

            <div className="space-y-2">
              <Label htmlFor="brand">
                Marka *
              </Label>

              <Input
                id="brand"
                value={
                  form.brand
                }
                disabled={
                  submitting
                }
                onChange={(
                  event
                ) => {
                  setForm(
                    (
                      previous
                    ) => ({
                      ...previous,

                      brand:
                        event
                          .target
                          .value,
                    })
                  );
                }}
                placeholder="Örn: Hertz"
              />
            </div>

            {/* MODEL */}

            <div className="space-y-2">
              <Label htmlFor="model">
                Model *
              </Label>

              <Input
                id="model"
                value={
                  form.model
                }
                disabled={
                  submitting
                }
                onChange={(
                  event
                ) => {
                  setForm(
                    (
                      previous
                    ) => ({
                      ...previous,

                      model:
                        event
                          .target
                          .value,
                    })
                  );
                }}
                placeholder="Örn: SV 200"
              />
            </div>

            {/* USD PRICE */}

            <div className="space-y-2">
              <Label htmlFor="priceUsd">
                Fiyat (USD) *
              </Label>

              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>

                <Input
                  id="priceUsd"
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    form.priceUsd
                  }
                  disabled={
                    submitting
                  }
                  readOnly={
                    Boolean(
                      form.sourceUrl.trim()
                    )
                  }
                  aria-busy={
                    loadingSourcePrice
                  }
                  className={`pl-7 ${
                    form.sourceUrl.trim()
                      ? "cursor-not-allowed bg-muted/50"
                      : ""
                  }`}
                  onChange={(
                    event
                  ) => {
                    if (
                      form.sourceUrl.trim()
                    ) {
                      return;
                    }

                    setForm(
                      (
                        previous
                      ) => ({
                        ...previous,

                        priceUsd:
                          event
                            .target
                            .value,
                      })
                    );
                  }}
                  placeholder={
                    form.sourceUrl.trim()
                      ? "Linkten okunuyor..."
                      : "0.00"
                  }
                />
              </div>

              {form.sourceUrl.trim() ? (
                loadingSourcePrice ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Fiyat ürün linkinden alınıyor...
                  </p>
                ) : sourcePriceError ? (
                  <p className="text-xs text-destructive">
                    {sourcePriceError}
                  </p>
                ) : form.priceUsd ? (
                  <p className="text-xs text-emerald-600">
                    Fiyat ürün linkinden otomatik alındı.
                  </p>
                ) : null
              ) : (
                <p className="text-xs text-muted-foreground">
                  Ürün linki girilmezse fiyatı manuel yazabilirsiniz.
                </p>
              )}
            </div>

            {/* TRY PRICE */}

            <div className="space-y-2">
              <Label>
                TL Karşılığı
              </Label>

              <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3">
                {loadingExchangeRate ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />

                    Kur alınıyor...
                  </div>
                ) : usdTryRate ? (
                  <span className="font-medium">
                    {formatTry(
                      priceTry
                    )}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Kur bilgisi
                    alınamadı.
                  </span>
                )}
              </div>

              {usdTryRate && (
                <p className="text-xs text-muted-foreground">
                  1 USD ={" "}

                  {usdTryRate.toLocaleString(
                    "tr-TR",
                    {
                      minimumFractionDigits: 4,
                      maximumFractionDigits: 4,
                    }
                  )}{" "}
                  TL

                  {exchangeRateDate
                    ? ` • ${exchangeRateDate}`
                    : ""}
                </p>
              )}
            </div>

            {/* PRODUCT SOURCE URL */}

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sourceUrl">
                Ürün Linki
              </Label>

              <Input
                id="sourceUrl"
                type="url"
                value={
                  form.sourceUrl
                }
                disabled={
                  submitting
                }
                onChange={(
                  event
                ) => {
                  const nextSourceUrl =
                    event.target.value;

                  setSourcePriceError(
                    null
                  );

                  setForm(
                    (previous) => ({
                      ...previous,

                      sourceUrl:
                        nextSourceUrl,

                      /*
                       * Link doluysa eski/manual fiyatı göstermeyelim.
                       * Link kaldırılırsa add modunda boş, edit modunda
                       * ürünün mevcut fiyatı ile manuel girişe dön.
                       */
                      priceUsd:
                        nextSourceUrl.trim()
                          ? ""
                          : product
                            ? String(
                                product.priceUsd
                              )
                            : "",
                    })
                  );
                }}
                placeholder="https://www.b2begb.com/urun/..."
              />

              <p className="text-xs text-muted-foreground">
                Opsiyoneldir. Link girerseniz USD fiyat alanı salt okunur olur ve fiyat EGB'den otomatik alınır. Link girmezseniz fiyatı manuel yazabilirsiniz.
              </p>
            </div>

            {/* SUPPLIERS */}

            <div className="space-y-2 sm:col-span-2">
              <Label>
                Tedarikçiler *
              </Label>

              <div className="grid gap-2 sm:grid-cols-3">
                {PRODUCT_SUPPLIERS.map(
                  (supplier) => {
                    const checked =
                      form.suppliers.includes(
                        supplier
                      );

                    return (
                      <label
                        key={supplier}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                          checked
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/30"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={submitting}
                          onCheckedChange={(value) => {
                            setForm((previous) => {
                              const next =
                                value
                                  ? Array.from(
                                      new Set([
                                        ...previous.suppliers,
                                        supplier,
                                      ])
                                    )
                                  : previous.suppliers.filter(
                                      (item) =>
                                        item !==
                                        supplier
                                    );

                              return {
                                ...previous,
                                suppliers:
                                  next,
                              };
                            });
                          }}
                        />

                        <span className="text-sm font-medium">
                          {supplier}
                        </span>
                      </label>
                    );
                  }
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Ürün birden fazla tedarikçiden temin edilebiliyorsa birden fazla seçim yapabilirsiniz. Yeni ürünlerde varsayılan EGB&apos;dir.
              </p>
            </div>
          </div>

          {/* =================================================
              CATEGORY FIELDS
          ================================================= */}

          {categoryFields.length >
            0 && (
            <div className="space-y-4 border-t pt-5">
              <div>
                <h3 className="font-semibold">
                  Ürün Özellikleri
                </h3>

                <p className="mt-1 text-sm text-muted-foreground">
                  {categoryDefinition
                    ?.label ??
                    "Ürün"}{" "}
                  kategorisine ait
                  teknik özellikleri
                  giriniz.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {categoryFields.map(
                  (
                    field
                  ) =>
                    renderDynamicField(
                      field
                    )
                )}
              </div>
            </div>
          )}

          {/* =================================================
              DESCRIPTION
          ================================================= */}

          <div className="space-y-2 border-t pt-5">
            <Label htmlFor="description">
              Açıklama
            </Label>

            <Textarea
              id="description"
              value={
                form.description
              }
              disabled={
                submitting
              }
              onChange={(
                event
              ) => {
                setForm(
                  (
                    previous
                  ) => ({
                    ...previous,

                    description:
                      event
                        .target
                        .value,
                  })
                );
              }}
              placeholder="Ürünle ilgili ek açıklamalar..."
              className="min-h-24 resize-y"
            />
          </div>

          {/* =================================================
              ERROR
          ================================================= */}

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* =================================================
              FOOTER
          ================================================= */}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={
                submitting ||
                uploadingImage
              }
              onClick={() =>
                onOpenChange(
                  false
                )
              }
            >
              Vazgeç
            </Button>

            <Button
              type="submit"
              disabled={
                submitting ||
                uploadingImage ||
                loadingSourcePrice ||
                loadingProductCode ||
                !resolvedCategory ||
                !categoryDefinition ||
                !form.productCode
              }
            >
              {(submitting ||
                uploadingImage ||
                loadingSourcePrice) && (
                <Loader2 className="size-4 animate-spin" />
              )}

              {loadingSourcePrice
                ? "Fiyat alınıyor..."
                : uploadingImage
                ? "Resim yükleniyor..."
                : submitting
                ? mode ===
                  "edit"
                  ? "Güncelleniyor..."
                  : "Kaydediliyor..."
                : mode ===
                    "edit"
                  ? "Güncelle"
                  : "Ürünü Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}