/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Check,
  Package,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import {
  Product,
  ProductCategory,
} from "@/types/product";

import {
  SystemTemplate,
} from "@/types/system-template";

import {
  SystemLaborItem,
} from "@/types/system-labor";

import {
  SystemPreparation,
  SystemPreparationPayload,
} from "@/types/system-preparation";

import {
  productCategories,
  productCategoryDefinitions,
} from "@/lib/product-config";

import {
  Badge,
} from "@/components/ui/badge";

import {
  Button,
} from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  ProductSelectionDialog,
} from "./product-selection-dialog";

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

interface PreparedSlot {
  id: string;

  source:
    | "template"
    | "custom";

  templateItemId?: string;

  label: string;

  category:
    ProductCategory;

  subCategory?: string;

  quantity: number;

  /*
   * false ise ürün toplamda kalır fakat komisyon hesabına girmez.
   */
  isCommissionIncluded: boolean;

  product:
    Product | null;
}

/*
 * =========================================================
 * PRODUCT CATEGORY CACHE
 *
 * Sistem Hazirlama ve Hazir Sistem Duzenleme ekraninda tum
 * urun katalogunu ilk acilista beklemiyoruz. Kategori bazli
 * lazy-load + memory cache kullanilir.
 * =========================================================
 */

const PRODUCT_CATEGORY_CACHE_TTL_MS =
  5 * 60 * 1000;

const PRODUCT_CATEGORY_REVALIDATE_MS =
  30 * 1000;

interface ProductCategoryCacheEntry {
  products: Product[];
  loadedAt: number;
}

const productCategoryCache =
  new Map<
    ProductCategory,
    ProductCategoryCacheEntry
  >();

const productCategoryRequests =
  new Map<
    ProductCategory,
    Promise<Product[]>
  >();

async function fetchCategoryProductsCached(
  category: ProductCategory,
  options?: {
    force?: boolean;
  }
) {
  const now = Date.now();
  const cached =
    productCategoryCache.get(
      category
    );

  if (
    !options?.force &&
    cached &&
    now - cached.loadedAt <
      PRODUCT_CATEGORY_CACHE_TTL_MS
  ) {
    return cached.products;
  }

  const inFlight =
    productCategoryRequests.get(
      category
    );

  if (inFlight) {
    return inFlight;
  }

  const request =
    (async () => {
      const response =
        await fetch(
          `/api/products?category=${encodeURIComponent(
            category
          )}`,
          {
            cache: "no-store",
          }
        );

      const result: ApiResponse<
        Product[]
      > = await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ??
            "Urunler yenilenemedi."
        );
      }

      const categoryProducts =
        result.data ?? [];

      productCategoryCache.set(
        category,
        {
          products:
            categoryProducts,
          loadedAt:
            Date.now(),
        }
      );

      return categoryProducts;
    })();

  productCategoryRequests.set(
    category,
    request
  );

  try {
    return await request;
  } finally {
    if (
      productCategoryRequests.get(
        category
      ) === request
    ) {
      productCategoryRequests.delete(
        category
      );
    }
  }
}

/*
 * =========================================================
 * FORMATTERS
 * =========================================================
 */

function formatUsd(
  value: number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",

      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(value);
}

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

/*
 * =========================================================
 * CUSTOM SLOT ID
 * =========================================================
 */

function createCustomSlotId() {
  if (
    typeof crypto !==
      "undefined" &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

/*
 * =========================================================
 * COMPONENT
 * =========================================================
 */

export function SystemPreparationPageClient() {
  /*
   * =======================================================
   * STATE
   * =======================================================
   */

  const [
    templates,
    setTemplates,
  ] =
    useState<
      SystemTemplate[]
    >([]);

  const [
    selectedTemplateId,
    setSelectedTemplateId,
  ] = useState("");

  const [
    systemName,
    setSystemName,
  ] = useState("");

  const [
    slots,
    setSlots,
  ] =
    useState<
      PreparedSlot[]
    >([]);

  const [
    laborItems,
    setLaborItems,
  ] =
    useState<
      SystemLaborItem[]
    >([]);

  const [
    products,
    setProducts,
  ] =
    useState<
      Product[]
    >([]);

  const [
    usdTryRate,
    setUsdTryRate,
  ] = useState<number | null>(
    null
  );

  const [
    exchangeRateDate,
    setExchangeRateDate,
  ] = useState<string | null>(
    null
  );

  const [
    commissionRate,
    setCommissionRate,
  ] = useState("0");

  const [
    discountTry,
    setDiscountTry,
  ] = useState("0");

  const [
    loadingProducts,
    setLoadingProducts,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    readySaving,
    setReadySaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  const [
    successMessage,
    setSuccessMessage,
  ] = useState<string | null>(
    null
  );

  const [
    currentPreparationId,
    setCurrentPreparationId,
  ] = useState<string | null>(
    null
  );

  /*
   * =======================================================
   * READY SYSTEM EDIT MODE
   *
   * Hazır Sistemler ekranından:
   * ?editId=<systemPreparationId>
   *
   * ile gelindiğinde mevcut hazır sistem aynı kayıt
   * üzerinde düzenlenir. Yeni sistem oluşturulmaz.
   * =======================================================
   */

  const [
    editingPreparation,
    setEditingPreparation,
  ] = useState<SystemPreparation | null>(
    null
  );

  const [
    editingReadySystemId,
    setEditingReadySystemId,
  ] = useState<string | null>(
    null
  );

  const [
    loadingEditingPreparation,
    setLoadingEditingPreparation,
  ] = useState(false);

  const editingReadySystem =
    Boolean(
      editingReadySystemId &&
        currentPreparationId ===
          editingReadySystemId
    );

  /*
   * =======================================================
   * PRODUCT SELECTION DIALOG
   * =======================================================
   */

  const [
    productSelectionSlotId,
    setProductSelectionSlotId,
  ] = useState<string | null>(
    null
  );

  const [
    refreshingProductSlotId,
    setRefreshingProductSlotId,
  ] = useState<string | null>(
    null
  );

  const productSelectionSlot =
    useMemo(
      () =>
        productSelectionSlotId
          ? slots.find(
              (slot) =>
                slot.id ===
                productSelectionSlotId
            ) ?? null
          : null,
      [slots, productSelectionSlotId]
    );

  const mergeCategoryProducts = (
    category: ProductCategory,
    categoryProducts: Product[]
  ) => {
    setProducts(
      (previous) => [
        ...previous.filter(
          (product) =>
            product.category !==
            category
        ),
        ...categoryProducts,
      ]
    );
  };

  const prefetchCategory = (
    category: ProductCategory
  ) => {
    const cached =
      productCategoryCache.get(
        category
      );

    if (
      cached &&
      Date.now() - cached.loadedAt <
        PRODUCT_CATEGORY_CACHE_TTL_MS
    ) {
      mergeCategoryProducts(
        category,
        cached.products
      );
      return;
    }

    void fetchCategoryProductsCached(
      category
    )
      .then(
        (categoryProducts) => {
          mergeCategoryProducts(
            category,
            categoryProducts
          );
        }
      )
      .catch(
        (prefetchError) => {
          console.warn(
            "Urun kategorisi on yuklenemedi:",
            category,
            prefetchError
          );
        }
      );
  };

  const openProductSelection =
    async (
      slotId: string
    ) => {
      const slot =
        slots.find(
          (currentSlot) =>
            currentSlot.id ===
            slotId
        );

      if (!slot) {
        return;
      }

      setError(null);

      const cached =
        productCategoryCache.get(
          slot.category
        );

      /*
       * Cache varsa dialog hemen acilir. 30 saniyeden eski veri
       * arka planda yenilenir; kullanici bekletilmez.
       */
      if (cached) {
        mergeCategoryProducts(
          slot.category,
          cached.products
        );

        setProductSelectionSlotId(
          slotId
        );

        if (
          Date.now() -
            cached.loadedAt >=
          PRODUCT_CATEGORY_REVALIDATE_MS
        ) {
          void fetchCategoryProductsCached(
            slot.category,
            {
              force: true,
            }
          )
            .then(
              (categoryProducts) => {
                mergeCategoryProducts(
                  slot.category,
                  categoryProducts
                );

                const refreshed =
                  slot.product
                    ? categoryProducts.find(
                        (product) =>
                          product.id ===
                          slot.product?.id
                      )
                    : null;

                if (refreshed) {
                  updateSlot(
                    slot.id,
                    {
                      product:
                        refreshed,
                    }
                  );
                }
              }
            )
            .catch(
              (refreshError) => {
                console.warn(
                  "Urun kategorisi arka planda yenilenemedi:",
                  slot.category,
                  refreshError
                );
              }
            );
        }

        return;
      }

      setRefreshingProductSlotId(
        slotId
      );

      try {
        const categoryProducts =
          await fetchCategoryProductsCached(
            slot.category
          );

        mergeCategoryProducts(
          slot.category,
          categoryProducts
        );

        if (slot.product) {
          const refreshedSelectedProduct =
            categoryProducts.find(
              (product) =>
                product.id ===
                slot.product?.id
            );

          if (refreshedSelectedProduct) {
            updateSlot(
              slot.id,
              {
                product:
                  refreshedSelectedProduct,
              }
            );
          }
        }

        setProductSelectionSlotId(
          slotId
        );
      } catch (selectionError) {
        setError(
          selectionError instanceof Error
            ? selectionError.message
            : "Urunler yenilenemedi."
        );
      } finally {
        setRefreshingProductSlotId(
          null
        );
      }
    };

  /*
   * =======================================================
   * SELECTED TEMPLATE
   * =======================================================
   */

  const selectedTemplate =
    useMemo(
      () =>
        templates.find(
          (template) =>
            template.id ===
            selectedTemplateId
        ) ?? null,
      [
        templates,
        selectedTemplateId,
      ]
    );

  /*
   * =======================================================
   * TEMPLATE SELECT ITEMS
   *
   * Base UI:
   * value = MongoDB ID
   * label = Şablon adı
   * =======================================================
   */

  const templateSelectItems =
    useMemo(
      () => [
        {
          value:
            "__none__",
          label:
            "Şablonsuz / Sıfırdan",
        },
        ...templates.map(
          (template) => ({
            value:
              template.id,
            label:
              template.name,
          })
        ),
      ],
      [templates]
    );

  /*
   * =======================================================
   * CATEGORY SELECT ITEMS
   * =======================================================
   */

  const categorySelectItems =
    useMemo(
      () =>
        productCategories.map(
          (category) => ({
            value:
              category.value,

            label:
              category.label,
          })
        ),
      []
    );

  /*
   * =======================================================
   * LOAD TEMPLATES
   * =======================================================
   */

  useEffect(() => {
    const loadTemplates =
      async () => {
        try {
          const response =
            await fetch(
              "/api/system-templates",
              {
                cache: "no-store",
              }
            );

          const result: ApiResponse<
            SystemTemplate[]
          > =
            await response.json();

          if (
            !response.ok ||
            !result.success
          ) {
            throw new Error(
              result.message ??
                "Şablonlar alınamadı."
            );
          }

          setTemplates(
            result.data ?? []
          );
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : "Şablonlar alınamadı."
          );
        }
      };

    void loadTemplates();
  }, []);

  /*
   * =======================================================
   * LOAD EXCHANGE RATE
   * =======================================================
   */

  useEffect(() => {
    const loadExchangeRate =
      async () => {
        try {
          const response =
            await fetch(
              "/api/exchange-rate",
              {
                cache: "no-store",
              }
            );

          const result: ExchangeRateResponse =
            await response.json();

          if (
            !response.ok ||
            !result.success ||
            !result.data
          ) {
            throw new Error(
              result.message ??
                "Kur alınamadı."
            );
          }

          setUsdTryRate(
            result.data.rate
          );

          setExchangeRateDate(
            result.data.date ??
              null
          );
        } catch (error) {
          console.error(
            "Kur alınamadı:",
            error
          );
        }
      };

    void loadExchangeRate();
  }, []);

  /*
   * =======================================================
   * LOAD READY SYSTEM FOR EDIT
   *
   * Hazır Sistemler sayfasındaki Düzenle aksiyonu
   * bu sayfayı ?editId=<id> ile açar.
   *
   * GET status=ready aynı zamanda güncel kuru da
   * server tarafında yenilediği için eski sistem güncel
   * kur bilgisiyle formda açılır.
   * =======================================================
   */

  useEffect(() => {
    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }

    const editId =
      new URLSearchParams(
        window.location.search
      ).get(
        "editId"
      );

    if (!editId) {
      return;
    }

    let cancelled =
      false;

    const loadReadySystem =
      async () => {
        setLoadingEditingPreparation(
          true
        );

        setError(null);

        try {
          /*
           * Duzenlemede tum hazir sistem listesini indirmiyoruz.
           * Sadece editId kaydi okunur. Bu ayni zamanda liste GET'inin
           * yaptigi toplu kur refresh maliyetini de kaldirir.
           */
          const response =
            await fetch(
              `/api/system-preparations/${encodeURIComponent(
                editId
              )}`,
              {
                cache:
                  "no-store",
              }
            );

          const result: ApiResponse<
            SystemPreparation
          > =
            await response.json();

          if (
            !response.ok ||
            !result.success ||
            !result.data
          ) {
            throw new Error(
              result.message ??
                "Hazır sistem alınamadı."
            );
          }

          const preparation =
            result.data;

          if (cancelled) {
            return;
          }

          setEditingPreparation(
            preparation
          );

          setEditingReadySystemId(
            preparation.id
          );

          setCurrentPreparationId(
            preparation.id
          );

          setSystemName(
            preparation.name
          );

          setCommissionRate(
            String(
              preparation.commissionRate ??
                0
            )
          );

          setDiscountTry(
            String(
              preparation.discountTry ??
                0
            )
          );

          setSelectedTemplateId(
            preparation.templateId ??
              ""
          );

          setLaborItems(
            (preparation.laborItems ?? [])
              .map(
                (
                  item,
                  index
                ) => ({
                  ...item,
                  sortOrder:
                    index,
                })
              )
          );

          setSuccessMessage(
            null
          );
        } catch (error) {
          if (cancelled) {
            return;
          }

          setError(
            error instanceof Error
              ? error.message
              : "Hazır sistem alınamadı."
          );
        } finally {
          if (!cancelled) {
            setLoadingEditingPreparation(
              false
            );
          }
        }
      };

    void loadReadySystem();

    return () => {
      cancelled =
        true;
    };
  }, []);

  /*
   * =======================================================
   * HYDRATE EDITING PRODUCTS ONLY
   *
   * Yeni sistem acilisinda hic urun katalogu yuklenmez.
   * Hazir Sistem Duzenle'de ise sadece kayitta secili urun ID'leri
   * paralel okunur. Kategori kataloglari daha sonra lazy-load olur.
   * =======================================================
   */

  useEffect(() => {
    if (!editingPreparation) {
      setLoadingProducts(
        false
      );
      return;
    }

    let cancelled = false;

    const hydrateEditingProducts =
      async () => {
        setLoadingProducts(
          true
        );

        setError(null);

        try {
          const productIds =
            Array.from(
              new Set(
                editingPreparation.items
                  .map(
                    (item) =>
                      item.productId
                  )
                  .filter(
                    (
                      productId
                    ): productId is string =>
                      Boolean(
                        productId
                      )
                  )
              )
            );

          const loadedProducts =
            (
              await Promise.all(
                productIds.map(
                  async (
                    productId
                  ) => {
                    try {
                      const response =
                        await fetch(
                          `/api/products/${encodeURIComponent(
                            productId
                          )}`,
                          {
                            cache:
                              "no-store",
                          }
                        );

                      const result: ApiResponse<
                        Product
                      > =
                        await response.json();

                      if (
                        !response.ok ||
                        !result.success ||
                        !result.data
                      ) {
                        return null;
                      }

                      return result.data;
                    } catch {
                      return null;
                    }
                  }
                )
              )
            ).filter(
              (
                product
              ): product is Product =>
                Boolean(
                  product
                )
            );

          if (cancelled) {
            return;
          }

          const productMap =
            new Map(
              loadedProducts.map(
                (product) => [
                  product.id,
                  product,
                ]
              )
            );

          setProducts(
            (previous) => {
              const loadedIds =
                new Set(
                  loadedProducts.map(
                    (product) =>
                      product.id
                  )
                );

              return [
                ...previous.filter(
                  (product) =>
                    !loadedIds.has(
                      product.id
                    )
                ),
                ...loadedProducts,
              ];
            }
          );

          setSlots(
            editingPreparation.items.map(
              (
                item
              ): PreparedSlot => ({
                id:
                  item.id,
                source:
                  item.source,
                templateItemId:
                  item.templateItemId,
                label:
                  item.label,
                category:
                  item.category,
                subCategory:
                  item.subCategory,
                quantity:
                  item.quantity,
                isCommissionIncluded:
                  item.isCommissionIncluded !==
                  false,
                product:
                  item.productId
                    ? productMap.get(
                        item.productId
                      ) ?? null
                    : null,
              })
            )
          );

          setCurrentPreparationId(
            editingPreparation.id
          );
        } catch (hydrateError) {
          if (cancelled) {
            return;
          }

          setError(
            hydrateError instanceof Error
              ? hydrateError.message
              : "Secili urunler alinamadi."
          );
        } finally {
          if (!cancelled) {
            setLoadingProducts(
              false
            );
          }
        }
      };

    void hydrateEditingProducts();

    return () => {
      cancelled = true;
    };
  }, [editingPreparation]);

  /*
   * =======================================================
   * TEMPLATE CHANGED
   *
   * - Şablon seçilirse ürün alanları + işçilik kalemleri gelir.
   * - Şablonsuz seçilirse kullanıcı sıfırdan oluşturur.
   * =======================================================
   */

  useEffect(() => {
    const editingTemplateId =
      editingPreparation?.templateId ??
      "";

    if (
      editingPreparation &&
      editingTemplateId ===
        selectedTemplateId
    ) {
      return;
    }

    if (!selectedTemplate) {
      setSlots([]);
      setLaborItems([]);

      if (!editingReadySystemId) {
        setCurrentPreparationId(
          null
        );
        setCommissionRate(
          "0"
        );
        setDiscountTry(
          "0"
        );
      }

      setSuccessMessage(
        null
      );
      setError(null);
      return;
    }

    setSlots(
      [...selectedTemplate.items]
        .sort(
          (
            first,
            second
          ) =>
            first.sortOrder -
            second.sortOrder
        )
        .map(
          (
            item
          ): PreparedSlot => ({
            id:
              item.id,
            source:
              "template",
            templateItemId:
              item.id,
            label:
              item.label,
            category:
              item.category,
            subCategory:
              item.subCategory,
            quantity:
              item.quantity,
            isCommissionIncluded:
              true,
            product:
              null,
          })
        )
    );

    setLaborItems(
      (selectedTemplate.laborItems ?? [])
        .map(
          (
            item,
            index
          ) => ({
            ...item,
            sortOrder:
              index,
          })
        )
    );

    if (!editingReadySystemId) {
      setCurrentPreparationId(
        null
      );
      setCommissionRate(
        "0"
      );
      setDiscountTry(
        "0"
      );
    }

    setSuccessMessage(
      null
    );
    setError(null);
  }, [
    selectedTemplate,
    selectedTemplateId,
    editingPreparation,
    editingReadySystemId,
  ]);

  /*
   * =======================================================
   * SLOT UPDATE
   * =======================================================
   */

  const updateSlot = (
    slotId: string,
    updates: Partial<PreparedSlot>
  ) => {
    setSlots(
      (previous) =>
        previous.map(
          (slot) =>
            slot.id ===
            slotId
              ? {
                  ...slot,

                  ...updates,
                }
              : slot
        )
    );

    /*
     * Ekranda değişiklik olduysa
     * hazır olduğuna dair eski
     * mesajı kaldır.
     */
    setSuccessMessage(null);
  };

  /*
   * =======================================================
   * ADD CUSTOM SLOT
   * =======================================================
   */

  const addCustomSlot =
    () => {
      const defaultCategory =
        productCategories[0]
          .value;

      setSlots(
        (previous) => [
          ...previous,

          {
            id:
              createCustomSlotId(),

            source:
              "custom",

            label: "",

            category:
              defaultCategory,

            quantity: 1,

            isCommissionIncluded:
              true,

            product:
              null,
          },
        ]
      );

      prefetchCategory(
        defaultCategory
      );

      setSuccessMessage(null);
    };

  /*
   * =======================================================
   * REMOVE CUSTOM SLOT
   * =======================================================
   */

  const removeCustomSlot = (
    slotId: string
  ) => {
    setSlots(
      (previous) =>
        previous.filter(
          (slot) =>
            slot.id !==
            slotId
        )
    );

    setSuccessMessage(null);
  };

  /*
   * =======================================================
   * LABOR ITEMS
   * =======================================================
   */

  const addLaborItem = () => {
    setLaborItems(
      (previous) => [
        ...previous,
        {
          id:
            createCustomSlotId(),
          label: "",
          amountTry: 0,
          sortOrder:
            previous.length,
        },
      ]
    );

    setSuccessMessage(null);
  };

  const updateLaborItem = (
    itemId: string,
    updates: Partial<SystemLaborItem>
  ) => {
    setLaborItems(
      (previous) =>
        previous.map(
          (item) =>
            item.id ===
            itemId
              ? {
                  ...item,
                  ...updates,
                }
              : item
        )
    );

    setSuccessMessage(null);
  };

  const removeLaborItem = (
    itemId: string
  ) => {
    setLaborItems(
      (previous) =>
        previous
          .filter(
            (item) =>
              item.id !==
              itemId
          )
          .map(
            (
              item,
              index
            ) => ({
              ...item,
              sortOrder:
                index,
            })
          )
    );

    setSuccessMessage(null);
  };

  /*
   * =======================================================
   * SUB CATEGORY OPTIONS
   * =======================================================
   */

  const getSubCategoryOptions = (
    category:
      ProductCategory
  ) => {
    const definition =
      productCategoryDefinitions[
        category
      ];

    const field =
      definition.fields.find(
        (field) =>
          field.source ===
          "subCategory"
      );

    return (
      field?.options ??
      []
    );
  };

  /*
   * =======================================================
   * TOTALS
   * =======================================================
   */

  const productTotalUsd =
    useMemo(() => {
      return slots.reduce(
        (
          total,
          slot
        ) => {
          if (!slot.product) {
            return total;
          }

          return (
            total +
            slot.product.priceUsd *
              slot.quantity
          );
        },
        0
      );
    }, [slots]);

  const exchangeRate =
    usdTryRate ?? 0;

  /*
   * ÜRÜN TL
   */
  const productTotalTry =
    productTotalUsd *
    exchangeRate;

  /*
   * İŞÇİLİK TL
   *
   * İşçilik kalemlerinin toplamıdır.
   */
  const laborCostTry =
    laborItems.reduce(
      (
        total,
        item
      ) =>
        total +
        (Number(
          item.amountTry
        ) || 0),
      0
    );

  /*
   * KOMİSYON
   */
  const commissionRateNumber =
    Math.min(
      100,
      Math.max(
        0,
        Number(
          commissionRate
        ) || 0
      )
    );

  /*
   * Komisyon yalnızca "Komisyona Dahil" seçili ürünler
   * üzerinden hesaplanır.
   */
  const commissionBaseUsd =
    useMemo(() => {
      return slots.reduce(
        (
          total,
          slot
        ) => {
          if (
            !slot.product ||
            !slot.isCommissionIncluded
          ) {
            return total;
          }

          return (
            total +
            slot.product.priceUsd *
              slot.quantity
          );
        },
        0
      );
    }, [slots]);

  const commissionAmountUsd =
    commissionBaseUsd *
    (
      commissionRateNumber /
      100
    );

  const commissionAmountTry =
    commissionAmountUsd *
    exchangeRate;

  /*
   * İNDİRİM TL
   */
  const discountTryNumber =
    Math.max(
      0,
      Number(
        discountTry
      ) || 0
    );

  /*
   * KAZANÇ TL
   *
   * Komisyon
   * + İşçilik
   * - İndirim
   */
  const profitTry =
    commissionAmountTry +
    laborCostTry -
    discountTryNumber;

  /*
   * TOPLAM MÜŞTERİ TUTARI
   *
   * Ürünlerin TL karşılığı
   * + Kazanç
   */
  const customerTotalTry =
    productTotalTry +
    profitTry;

  /*
   * =======================================================
   * SELECT COUNTS
   * =======================================================
   */

  const selectedCount =
    slots.filter(
      (slot) =>
        slot.product !==
        null
    ).length;

  const allSelected =
    slots.length > 0 &&
    selectedCount ===
      slots.length;

  /*
   * =======================================================
   * BUILD PAYLOAD
   * =======================================================
   */

  const buildPayload =
    (): SystemPreparationPayload | null => {
      if (
        !systemName.trim()
      ) {
        setError(
          "Sistem adı zorunludur."
        );

        return null;
      }

      if (
        !usdTryRate ||
        usdTryRate <= 0
      ) {
        setError(
          "Güncel kur bilgisi bulunamadı."
        );

        return null;
      }

      /*
       * CUSTOM SLOT VALIDATION
       */
      const invalidCustomSlot =
        slots.find(
          (slot) =>
            slot.source ===
              "custom" &&
            !slot.label.trim()
        );

      if (
        invalidCustomSlot
      ) {
        setError(
          "Eklenen ürün alanlarının adı zorunludur."
        );

        return null;
      }

      const invalidLaborItem =
        laborItems.find(
          (item) =>
            !item.label.trim() ||
            !Number.isFinite(
              Number(
                item.amountTry
              )
            ) ||
            Number(
              item.amountTry
            ) < 0
        );

      if (
        invalidLaborItem
      ) {
        setError(
          "İşçilik kalemlerinde açıklama ve geçerli TL tutarı zorunludur."
        );

        return null;
      }

      return {
        name:
          systemName.trim(),

        ...(selectedTemplate
          ? {
              templateId:
                selectedTemplate.id,
            }
          : {}),

        exchangeRate:
          usdTryRate,

        ...(exchangeRateDate
          ? {
              exchangeRateDate,
            }
          : {}),

        commissionRate:
          commissionRateNumber,

        discountTry:
          discountTryNumber,

        laborItems:
          laborItems.map(
            (
              item,
              index
            ) => ({
              id:
                item.id,
              label:
                item.label.trim(),
              amountTry:
                Number(
                  item.amountTry
                ) || 0,
              sortOrder:
                index,
            })
          ),

        /*
         * TEMPLATE ITEMS
         */
        selections:
          slots
            .filter(
              (slot) =>
                slot.source ===
                "template"
            )
            .map(
              (slot) => ({
                templateItemId:
                  slot.templateItemId!,

                ...(slot.product
                  ? {
                      productId:
                        slot.product.id,
                    }
                  : {}),

                isCommissionIncluded:
                  slot.isCommissionIncluded ===
                  true,
              })
            ),

        /*
         * CUSTOM ITEMS
         */
        customItems:
          slots
            .filter(
              (slot) =>
                slot.source ===
                "custom"
            )
            .map(
              (slot) => ({
                id:
                  slot.id,

                label:
                  slot.label.trim(),

                category:
                  slot.category,

                ...(slot.subCategory
                  ? {
                      subCategory:
                        slot.subCategory,
                    }
                  : {}),

                quantity:
                  slot.quantity,

                ...(slot.product
                  ? {
                      productId:
                        slot.product.id,
                    }
                  : {}),

                isCommissionIncluded:
                  slot.isCommissionIncluded ===
                  true,
              })
            ),
      };
    };

  /*
   * =======================================================
   * SAVE DRAFT
   * =======================================================
   */

  const saveDraft =
    async (): Promise<
      SystemPreparation | null
    > => {
      const payload =
        buildPayload();

      if (!payload) {
        return null;
      }

      setSaving(true);

      setError(null);

      setSuccessMessage(
        null
      );

      try {
        const editing =
          Boolean(
            currentPreparationId
          );

        const response =
          await fetch(
            editing
              ? `/api/system-preparations/${currentPreparationId}`
              : "/api/system-preparations",
            {
              method:
                editing
                  ? "PUT"
                  : "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  payload
                ),
            }
          );

        const result: ApiResponse<SystemPreparation> =
          await response.json();

        if (
          !response.ok ||
          !result.success ||
          !result.data
        ) {
          throw new Error(
            result.message ??
              "Sistem kaydedilemedi."
          );
        }

        setCurrentPreparationId(
          result.data.id
        );

        setSuccessMessage(
          editingReadySystem
            ? "Hazır sistem bilgileri güncellendi."
            : editing
              ? "Taslak güncellendi."
              : "Taslak başarıyla kaydedildi."
        );

        return result.data;
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Sistem kaydedilemedi."
        );

        return null;
      } finally {
        setSaving(false);
      }
    };

  /*
   * =======================================================
   * SAVE AS READY SYSTEM
   *
   * DİKKAT:
   * Bu aşamada stok hareketi yapılmıyor.
   * =======================================================
   */

  const saveAsReady =
    async () => {
      const wasEditingReadySystem =
        editingReadySystem;

      if (!allSelected) {
        setError(
          "Hazır sistem oluşturmak için tüm ürün alanlarına ürün seçmelisiniz."
        );

        return;
      }

      const invalidCustomSlot =
        slots.find(
          (slot) =>
            slot.source ===
              "custom" &&
            !slot.label.trim()
        );

      if (
        invalidCustomSlot
      ) {
        setError(
          "Eklenen ürün alanlarının adı zorunludur."
        );

        return;
      }

      setReadySaving(true);

      setError(null);

      setSuccessMessage(
        null
      );

      try {
        /*
         * Önce sistemin mevcut
         * halini kaydet.
         */
        const preparation =
          await saveDraft();

        if (
          !preparation
        ) {
          return;
        }

        /*
         * YENİ HAZIR SİSTEM:
         * Taslak kaydedildikten sonra status "ready" yapılır.
         *
         * MEVCUT HAZIR SİSTEM DÜZENLEME:
         * PUT işlemi mevcut kaydın "ready" durumunu korur.
         * Bu nedenle /ready endpoint'i tekrar ÇAĞRILMAZ.
         *
         * Aksi halde endpoint:
         * "Bu sistem zaten hazır durumda."
         * hatası döndürür.
         *
         * Bu aşamada stok hareketi yapılmaz.
         */
        if (
          !wasEditingReadySystem
        ) {
          const response =
            await fetch(
              `/api/system-preparations/${preparation.id}/ready`,
              {
                method:
                  "POST",
              }
            );

          const result: ApiResponse<SystemPreparation> =
            await response.json();

          if (
            !response.ok ||
            !result.success ||
            !result.data
          ) {
            throw new Error(
              result.message ??
                "Hazır sistem oluşturulamadı."
            );
          }
        }

        setSuccessMessage(
          wasEditingReadySystem
            ? "Hazır sistem başarıyla güncellendi."
            : "Sistem hazır sistem olarak kaydedildi."
        );

        /*
         * Yeni sistem hazırlamak
         * için formu temizle.
         *
         * Eğer kaydettikten sonra
         * aynı ekranda göstermeyi
         * istersen burayı
         * kaldırabiliriz.
         */
        setSystemName("");

        setSelectedTemplateId(
          ""
        );

        setSlots([]);

        setLaborItems([]);

        setCurrentPreparationId(
          null
        );

        setEditingPreparation(
          null
        );

        setEditingReadySystemId(
          null
        );

        if (
          wasEditingReadySystem &&
          typeof window !==
            "undefined"
        ) {
          const currentUrl =
            new URL(
              window.location.href
            );

          currentUrl.searchParams.delete(
            "editId"
          );

          window.history.replaceState(
            {},
            "",
            `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`
          );
        }

        setCommissionRate(
          "0"
        );

        setDiscountTry(
          "0"
        );
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Hazır sistem oluşturulamadı."
        );
      } finally {
        setReadySaving(false);
      }
    };

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <div className="min-w-0 space-y-6">
      {/* ===================================================
          HEADER
      =================================================== */}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Sistem Hazırlama
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          İsterseniz hazır bir şablondan başlayın, isterseniz ürün ve işçilik alanlarını sıfırdan oluşturun.
        </p>

        {editingReadySystem && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1.5 text-xs font-medium">
            <Pencil className="size-3.5" />

            Hazır sistem düzenleniyor
          </div>
        )}

        {loadingEditingPreparation && (
          <div className="mt-3 text-xs text-muted-foreground">
            Hazır sistem yükleniyor...
          </div>
        )}
      </div>

      {/* ===================================================
          GENERAL INFO
      =================================================== */}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Sistem Bilgileri
          </CardTitle>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-2">
          {/* SYSTEM NAME */}

          <div className="space-y-2">
            <Label htmlFor="systemName">
              Sistem Adı
            </Label>

            <Input
              id="systemName"
              value={
                systemName
              }
              onChange={(
                event
              ) => {
                setSystemName(
                  event
                    .target
                    .value
                );

                setSuccessMessage(
                  null
                );
              }}
              placeholder="Örn: Golf 7 Middle Sistem"
            />
          </div>

          {/* TEMPLATE */}

          <div className="space-y-2">
            <Label>
              Şablon (Opsiyonel)
            </Label>

            <Select
              items={
                templateSelectItems
              }
              value={
                selectedTemplateId ||
                "__none__"
              }
              onValueChange={(
                value
              ) => {
                const selectedValue =
                  value ??
                  "__none__";

                const nextTemplateId =
                  selectedValue ===
                  "__none__"
                    ? ""
                    : selectedValue;

                if (
                  editingReadySystem &&
                  nextTemplateId !==
                    selectedTemplateId
                ) {
                  /*
                   * Kullanıcı edit sırasında template'i
                   * bilinçli olarak değiştirdi. Eski snapshot
                   * slotlarını tekrar hydrate etme.
                   */
                  setEditingPreparation(
                    null
                  );
                }

                setSelectedTemplateId(
                  nextTemplateId
                );
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Şablonsuz / Sıfırdan" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="__none__">
                  Şablonsuz / Sıfırdan
                </SelectItem>

                {templates.map(
                  (
                    template
                  ) => (
                    <SelectItem
                      key={
                        template.id
                      }
                      value={
                        template.id
                      }
                    >
                      {
                        template.name
                      }
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ===================================================
          MESSAGES
      =================================================== */}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          {
            successMessage
          }
        </div>
      )}

      {/* ===================================================
          SYSTEM
      =================================================== */}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* =================================================
              LEFT
          ================================================= */}

          <div className="min-w-0 space-y-4">
            {/* HEADER */}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">
                  Sistem İçeriği
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedCount} /{" "}
                  {slots.length} ürün
                  seçildi
                </p>
              </div>

              <div className="flex items-center gap-2">
                {allSelected &&
                  slots.length >
                    0 && (
                    <Badge>
                      <Check className="mr-1 size-3" />

                      Hazır
                    </Badge>
                  )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={
                    addCustomSlot
                  }
                >
                  <Plus className="size-4" />

                  {selectedTemplate
                    ? "Ek Ürün Alanı"
                    : "Ürün Alanı Ekle"}
                </Button>
              </div>
            </div>

            {/* PRODUCT CATALOG LOADING */}

            {loadingProducts ? (
              <div className="flex min-h-48 items-center justify-center rounded-xl border">
                <span className="text-sm text-muted-foreground">
                  Ürünler
                  yükleniyor...
                </span>
              </div>
            ) : (
              /*
               * ===============================================
               * SLOTS
               * ===============================================
               */

              slots.map(
                (
                  slot,
                  index
                ) => {
                  const subCategories =
                    getSubCategoryOptions(
                      slot.category
                    );

                  /*
                   * Alt kategori:
                   * "__all__" = tümü
                   */
                  const subCategorySelectItems =
                    [
                      {
                        value:
                          "__all__",

                        label:
                          "Tümü",
                      },

                      ...subCategories.map(
                        (
                          option
                        ) => ({
                          value:
                            option.value,

                          label:
                            option.label,
                        })
                      ),
                    ];

                  return (
                    <Card
                      key={
                        slot.id
                      }
                    >
                      <CardContent className="space-y-4 pt-6">
                        {/* =====================================
                            SLOT HEADER
                        ===================================== */}

                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold">
                              {index +
                                1}
                            </div>

                            <div className="min-w-0">
                              <div className="font-medium">
                                {slot.label ||
                                  "Yeni Ürün Alanı"}
                              </div>

                              <div className="mt-1 flex flex-wrap gap-2">
                                <Badge variant="outline">
                                  {slot.source ===
                                  "template"
                                    ? "Şablon"
                                    : "Ek Alan"}
                                </Badge>

                                <Badge variant="secondary">
                                  {
                                    slot.quantity
                                  }{" "}
                                  adet
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {slot.source ===
                            "custom" && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="shrink-0 text-destructive hover:text-destructive"
                              onClick={() =>
                                removeCustomSlot(
                                  slot.id
                                )
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>

                        {/* =====================================
                            CUSTOM SLOT SETTINGS
                        ===================================== */}

                        {slot.source ===
                          "custom" && (
                          <div className="grid gap-4 rounded-xl border bg-muted/10 p-4 md:grid-cols-2 xl:grid-cols-4">
                            {/* SLOT NAME */}

                            <div className="space-y-2 md:col-span-2 xl:col-span-1">
                              <Label>
                                Alan Adı
                              </Label>

                              <Input
                                value={
                                  slot.label
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateSlot(
                                    slot.id,
                                    {
                                      label:
                                        event
                                          .target
                                          .value,
                                    }
                                  )
                                }
                                placeholder="Örn: Ek Subwoofer"
                              />
                            </div>

                            {/* CATEGORY */}

                            <div className="space-y-2">
                              <Label>
                                Kategori
                              </Label>

                              <Select
                                items={
                                  categorySelectItems
                                }
                                value={
                                  slot.category
                                }
                                onValueChange={(
                                  value
                                ) => {
                                  if (
                                    !value
                                  ) {
                                    return;
                                  }

                                  const nextCategory =
                                    value as ProductCategory;

                                  updateSlot(
                                    slot.id,
                                    {
                                      category:
                                        nextCategory,

                                      subCategory:
                                        undefined,

                                      /*
                                       * Kategori
                                       * değişince önceki
                                       * ürün artık geçersiz.
                                       */
                                      product:
                                        null,
                                    }
                                  );

                                  /*
                                   * Kullanici kategori secer secmez urunleri
                                   * arka planda hazirla.
                                   */
                                  prefetchCategory(
                                    nextCategory
                                  );
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>

                                <SelectContent>
                                  {productCategories.map(
                                    (
                                      category
                                    ) => (
                                      <SelectItem
                                        key={
                                          category.value
                                        }
                                        value={
                                          category.value
                                        }
                                      >
                                        {
                                          category.label
                                        }
                                      </SelectItem>
                                    )
                                  )}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* SUB CATEGORY */}

                            <div className="space-y-2">
                              <Label>
                                Alt Kategori
                              </Label>

                              {subCategories.length >
                              0 ? (
                                <Select
                                  items={
                                    subCategorySelectItems
                                  }
                                  value={
                                    slot.subCategory ??
                                    "__all__"
                                  }
                                  onValueChange={(
                                    value
                                  ) => {
                                    const selectedValue =
                                      value ??
                                      "__all__";

                                    updateSlot(
                                      slot.id,
                                      {
                                        subCategory:
                                          selectedValue ===
                                          "__all__"
                                            ? undefined
                                            : selectedValue,

                                        /*
                                         * Alt kategori
                                         * değişince ürün
                                         * temizlenmeli.
                                         */
                                        product:
                                          null,
                                      }
                                    );
                                  }}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>

                                  <SelectContent>
                                    <SelectItem value="__all__">
                                      Tümü
                                    </SelectItem>

                                    {subCategories.map(
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
                              ) : (
                                <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
                                  Alt kategori
                                  yok
                                </div>
                              )}
                            </div>

                            {/* QUANTITY */}

                            <div className="space-y-2">
                              <Label>
                                Adet
                              </Label>

                              <Input
                                type="number"
                                min="1"
                                step="1"
                                value={
                                  slot.quantity
                                }
                                onChange={(
                                  event
                                ) => {
                                  const quantity =
                                    Number(
                                      event
                                        .target
                                        .value
                                    );

                                  updateSlot(
                                    slot.id,
                                    {
                                      quantity:
                                        Number.isInteger(
                                          quantity
                                        ) &&
                                        quantity >
                                          0
                                          ? quantity
                                          : 1,

                                      product:
                                        null,
                                    }
                                  );
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* =====================================
                            PRODUCT AREA
                        ===================================== */}

                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_150px] lg:items-end">
                          <div className="space-y-2">
                            <Label>
                              Ürün
                            </Label>

                            {slot.product ? (
                              <div className="rounded-xl border bg-muted/20 p-3">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="min-w-0">
                                    <div className="truncate font-medium">
                                      {slot.product.brand}{" "}
                                      -{" "}
                                      {slot.product.model}
                                    </div>

                                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                      <span>
                                        Kod:{" "}
                                        <span className="font-medium text-foreground">
                                          {slot.product.productCode}
                                        </span>
                                      </span>

                                      <span>
                                        Birim:{" "}
                                        <span className="font-medium text-foreground">
                                          {formatUsd(slot.product.priceUsd)}
                                        </span>
                                      </span>

                                      {usdTryRate && (
                                        <span>
                                          TL:{" "}
                                          <span className="font-medium text-foreground">
                                            {formatTry(
                                              slot.product.priceUsd * usdTryRate
                                            )}
                                          </span>
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0"
                                    disabled={
                                      refreshingProductSlotId ===
                                      slot.id
                                    }
                                    onPointerEnter={() => {
                                      prefetchCategory(
                                        slot.category
                                      );
                                    }}
                                    onFocus={() => {
                                      prefetchCategory(
                                        slot.category
                                      );
                                    }}
                                    onClick={() => {
                                      void openProductSelection(
                                        slot.id
                                      );
                                    }}
                                  >
                                    {refreshingProductSlotId ===
                                    slot.id
                                      ? "Yenileniyor..."
                                      : "Ürünü Değiştir"}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                className="h-auto min-h-20 w-full justify-start rounded-xl border-dashed px-4 py-4 text-left"
                                disabled={
                                  refreshingProductSlotId ===
                                  slot.id
                                }
                                onPointerEnter={() => {
                                  prefetchCategory(
                                    slot.category
                                  );
                                }}
                                onFocus={() => {
                                  prefetchCategory(
                                    slot.category
                                  );
                                }}
                                onClick={() => {
                                  void openProductSelection(
                                    slot.id
                                  );
                                }}
                              >
                                <div>
                                  <div className="font-medium">
                                    {refreshingProductSlotId ===
                                    slot.id
                                      ? "Ürünler Yenileniyor..."
                                      : "Ürün Seç"}
                                  </div>

                                  <div className="mt-1 text-xs font-normal text-muted-foreground">
                                    {productCategoryDefinitions[slot.category].label}
                                    {slot.subCategory ? ` • ${slot.subCategory}` : ""}
                                    {" • "}
                                    {slot.quantity}{" "}
                                    adet gerekli
                                  </div>
                                </div>
                              </Button>
                            )}
                          </div>

                          <div className="rounded-lg border bg-muted/20 px-3 py-2.5 text-right">
                            <div className="text-xs text-muted-foreground">
                              Tutar
                            </div>

                            {slot.product ? (
                              <>
                                <div className="font-semibold">
                                  {formatUsd(
                                    slot.product.priceUsd * slot.quantity
                                  )}
                                </div>

                                {usdTryRate && (
                                  <div className="mt-0.5 text-xs font-medium text-foreground">
                                    {formatTry(
                                      slot.product.priceUsd *
                                        slot.quantity *
                                        usdTryRate
                                    )}
                                  </div>
                                )}

                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  {formatUsd(slot.product.priceUsd)}{" "}
                                  × {slot.quantity}
                                </div>
                              </>
                            ) : (
                              <div className="font-semibold text-muted-foreground">
                                -
                              </div>
                            )}
                          </div>
                        </div>
                      
                        {/* =====================================
                            COMMISSION INCLUDED
                        ===================================== */}

                        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border bg-muted/10 px-4 py-3">
                          <div>
                            <div className="text-sm font-medium">
                              Komisyona Dahil
                            </div>

                            <div className="mt-0.5 text-xs text-muted-foreground">
                              Seçiliyse bu ürün komisyon hesabına katılır.
                            </div>
                          </div>

                          <input
                            type="checkbox"
                            checked={
                              slot.isCommissionIncluded ===
                              true
                            }
                            onChange={(
                              event
                            ) => {
                              const checked =
                                event.currentTarget.checked;

                              updateSlot(
                                slot.id,
                                {
                                  isCommissionIncluded:
                                    checked,
                                }
                              );
                            }}
                            className="size-4 shrink-0 cursor-pointer accent-current"
                          />
                        </label>
                      </CardContent>
                    </Card>
                  );
                }
              )
            )}

            {/* NO SLOT */}

            {!loadingProducts &&
              slots.length ===
                0 && (
                <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed text-center">
                  <Package className="mb-3 size-8 text-muted-foreground" />

                  <div className="font-medium">
                    Ürün alanı
                    bulunmuyor
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={
                      addCustomSlot
                    }
                  >
                    <Plus className="size-4" />

                    Ürün Alanı
                    Ekle
                  </Button>
                </div>
              )}

            {/* LABOR ITEMS */}

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      İşçilik Kalemleri
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Montaj ve diğer işçilikleri ayrı ayrı ekleyin.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={
                      addLaborItem
                    }
                  >
                    <Plus className="size-4" />
                    İşçilik Ekle
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {laborItems.length === 0 ? (
                  <button
                    type="button"
                    onClick={
                      addLaborItem
                    }
                    className="flex min-h-24 w-full flex-col items-center justify-center rounded-xl border border-dashed text-center transition-colors hover:bg-muted/30"
                  >
                    <Plus className="mb-2 size-5 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      İşçilik kalemi ekle
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      Örn: Amfi Montajı, Multimedya Montajı
                    </span>
                  </button>
                ) : (
                  laborItems.map(
                    (
                      laborItem,
                      index
                    ) => (
                      <div
                        key={
                          laborItem.id
                        }
                        className="grid gap-3 rounded-xl border bg-muted/10 p-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end"
                      >
                        <div className="space-y-2">
                          <Label>
                            İşçilik Açıklaması
                          </Label>
                          <Input
                            value={
                              laborItem.label
                            }
                            onChange={(
                              event
                            ) =>
                              updateLaborItem(
                                laborItem.id,
                                {
                                  label:
                                    event.target.value,
                                }
                              )
                            }
                            placeholder="Örn: Amfi Montajı"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>
                            Tutar (TL)
                          </Label>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                              ₺
                            </span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="pl-7"
                              value={
                                laborItem.amountTry
                              }
                              onChange={(
                                event
                              ) =>
                                updateLaborItem(
                                  laborItem.id,
                                  {
                                    amountTry:
                                      Number(
                                        event.target.value
                                      ) || 0,
                                  }
                                )
                              }
                            />
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            removeLaborItem(
                              laborItem.id
                            )
                          }
                        >
                          <Trash2 className="size-4" />
                          <span className="sr-only">
                            {index + 1}. işçilik kalemini sil
                          </span>
                        </Button>
                      </div>
                    )
                  )
                )}

                <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-3 py-3">
                  <span className="text-sm font-medium">
                    Toplam İşçilik
                  </span>
                  <span className="font-semibold">
                    {formatTry(
                      laborCostTry
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* =================================================
              RIGHT SUMMARY
          ================================================= */}

          <div className="min-w-0">
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle className="text-base">
                  Sistem Özeti
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* ===========================================
                    PRODUCT TOTAL USD
                =========================================== */}

                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Ürünler
                  </span>

                  <span className="font-medium">
                    {formatUsd(
                      productTotalUsd
                    )}
                  </span>
                </div>

                {/* PRODUCT TRY */}

                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Ürünler TL
                  </span>

                  <span className="font-medium">
                    {formatTry(
                      productTotalTry
                    )}
                  </span>
                </div>

                {/* ===========================================
                    LABOR
                =========================================== */}

                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">
                    İşçilik
                  </span>

                  <span className="font-medium">
                    {formatTry(
                      laborCostTry
                    )}
                  </span>
                </div>

                <div className="border-t" />

                {/* ===========================================
                    COMMISSION RATE
                =========================================== */}

                <div className="space-y-2">
                  <Label htmlFor="commissionRate">
                    Komisyon Oranı
                    (%)
                  </Label>

                  <div className="relative">
                    <Input
                      id="commissionRate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={
                        commissionRate
                      }
                      onChange={(
                        event
                      ) => {
                        setCommissionRate(
                          event
                            .target
                            .value
                        );

                        setSuccessMessage(
                          null
                        );
                      }}
                      className="pr-8"
                    />

                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      %
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Komisyon yalnızca
                    "Komisyona Dahil"
                    seçili ürünler
                    üzerinden
                    hesaplanır.
                  </p>
                </div>

                {/* ===========================================
                    COMMISSION USD
                =========================================== */}

                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Komisyon Tutarı
                  </span>

                  <span className="font-medium">
                    {formatUsd(
                      commissionAmountUsd
                    )}
                  </span>
                </div>

                {/* COMMISSION TRY */}

                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Komisyon TL
                  </span>

                  <span className="font-medium">
                    {formatTry(
                      commissionAmountTry
                    )}
                  </span>
                </div>

                {/* ===========================================
                    DISCOUNT
                =========================================== */}

                <div className="space-y-2">
                  <Label htmlFor="discountTry">
                    İndirim Tutarı
                    (TL)
                  </Label>

                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      ₺
                    </span>

                    <Input
                      id="discountTry"
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        discountTry
                      }
                      onChange={(
                        event
                      ) => {
                        setDiscountTry(
                          event
                            .target
                            .value
                        );

                        setSuccessMessage(
                          null
                        );
                      }}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="border-t" />

                {/* ===========================================
                    CUSTOMER TOTAL
                =========================================== */}

                <div className="flex items-center justify-between gap-4">
                  <span className="font-bold">
                    Toplam Müşteri
                    Tutarı
                  </span>

                  <span className="text-xl font-bold">
                    {formatTry(
                      customerTotalTry
                    )}
                  </span>
                </div>

                {/* ===========================================
                    PROFIT
                =========================================== */}

                <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 px-3 py-3">
                  <div>
                    <div className="font-bold">
                      Kazanç
                    </div>

                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      Komisyon +
                      İşçilik -
                      İndirim
                    </div>
                  </div>

                  <span
                    className={`text-xl font-bold ${
                      profitTry <
                      0
                        ? "text-destructive"
                        : ""
                    }`}
                  >
                    {formatTry(
                      profitTry
                    )}
                  </span>
                </div>

                {/* ===========================================
                    EXCHANGE RATE
                =========================================== */}

                {usdTryRate && (
                  <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <div>
                      Kur:{" "}

                      <span className="font-medium text-foreground">
                        1 USD ={" "}

                        {usdTryRate.toLocaleString(
                          "tr-TR",
                          {
                            minimumFractionDigits: 4,
                            maximumFractionDigits: 4,
                          }
                        )}{" "}
                        TL
                      </span>
                    </div>

                    {exchangeRateDate && (
                      <div className="mt-1">
                        Kur tarihi:{" "}

                        {
                          exchangeRateDate
                        }
                      </div>
                    )}
                  </div>
                )}

                {/* ===========================================
                    ACTIONS
                =========================================== */}

                <div className="space-y-2 pt-2">
                  {/* SAVE DRAFT */}

                  {!editingReadySystem && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={
                        saving ||
                        readySaving ||
                        !systemName.trim() ||
                        !usdTryRate
                      }
                      onClick={() => {
                        void saveDraft();
                      }}
                    >
                      {saving
                        ? "Kaydediliyor..."
                        : currentPreparationId
                          ? "Taslağı Güncelle"
                          : "Taslak Kaydet"}
                    </Button>
                  )}

                  {/* READY */}

                  <Button
                    type="button"
                    className="w-full"
                    disabled={
                      saving ||
                      readySaving ||
                      !systemName.trim() ||
                      !usdTryRate ||
                      !allSelected
                    }
                    onClick={() => {
                      void saveAsReady();
                    }}
                  >
                    <Package className="size-4" />

                    {readySaving
                      ? editingReadySystem
                        ? "Hazır Sistem Güncelleniyor..."
                        : "Hazır Sistem Kaydediliyor..."
                      : editingReadySystem
                        ? "Hazır Sistemi Güncelle"
                        : "Hazır Sistem Olarak Kaydet"}
                  </Button>

                  <p className="text-center text-[11px] text-muted-foreground">
                    Hazır sistem
                    {editingReadySystem
                      ? " güncellendiğinde "
                      : " kaydedildiğinde "}
                    bu aşamada stok hareketi yapılmaz.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

      {productSelectionSlot && (
        <ProductSelectionDialog
          open={Boolean(productSelectionSlotId)}
          onOpenChange={(open) => {
            if (!open) {
              setProductSelectionSlotId(null);
            }
          }}
          products={products}
          category={productSelectionSlot.category}
          subCategory={productSelectionSlot.subCategory}
          requiredQuantity={productSelectionSlot.quantity}
          exchangeRate={usdTryRate ?? 0}
          selectedProductId={productSelectionSlot.product?.id}
          onSelect={(product) => {
            updateSlot(
              productSelectionSlot.id,
              { product }
            );

            setProductSelectionSlotId(null);
          }}
          onClear={() => {
            updateSlot(
              productSelectionSlot.id,
              { product: null }
            );

            setProductSelectionSlotId(null);
          }}
        />
      )}
    </div>
  );
}