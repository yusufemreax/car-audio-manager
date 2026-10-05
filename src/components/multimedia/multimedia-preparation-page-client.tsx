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

import type {
  ProductSupplier,
} from "@/types/supplier";

import {
  SystemLaborItem,
} from "@/types/system-labor";

import {
  MultimediaPreparation,
  MultimediaPreparationPayload,
  type MultimediaPreparationMode,
} from "@/types/multimedia-preparation";

import type {
  VehicleCatalogResponse,
} from "@/types/vehicle-catalog";

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

import { calculateMultimediaAutoDiscount } from "@/lib/multimedia-auto-discount";

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
} from "@/components/system-preparation/product-selection-dialog";

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

  selectedSupplier?: ProductSupplier;
  selectedPriceUsd?: number;
  locked?: boolean;
}

function getSlotPriceUsd(
  slot: PreparedSlot
) {
  return slot.selectedPriceUsd ??
    slot.product?.priceUsd ??
    0;
}

function createModeSlots(
  mode: MultimediaPreparationMode
): PreparedSlot[] {
  const multimediaSlot: PreparedSlot = {
    id: "multimedia-screen",
    source: "custom",
    label: "Multimedya Ekran",
    category: "multimedia",
    quantity: 1,
    isCommissionIncluded: true,
    product: null,
    locked: true,
  };

  if (mode === "vehicle_specific") {
    return [multimediaSlot];
  }

  return [
    {
      id: "multimedia-frame",
      source: "custom",
      label: "Multimedya Çerçevesi",
      category: "multimedia-frame",
      quantity: 1,
      isCommissionIncluded: true,
      product: null,
      locked: true,
    },
    multimediaSlot,
  ];
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
 * MULTIMEDIA AUTO FRAME + DEFAULTS V2.16
 * =========================================================
 */

function createDefaultMultimediaLaborItems(): SystemLaborItem[] {
  return [
    {
      id: createCustomSlotId(),
      label: "Multimedya \u0130\u015f\u00e7ili\u011fi",
      amountTry: 1500,
      sortOrder: 0,
    },
  ];
}

interface AvailableProductSelection {
  product: Product;
  supplier: ProductSupplier;
  priceUsd: number;
}

function getAvailableProductSelections(
  sourceProducts: Product[]
): AvailableProductSelection[] {
  return sourceProducts.flatMap((product) => {
    const supplierPrices =
      product.supplierPrices?.length
        ? product.supplierPrices
        : (
            product.suppliers?.length
              ? product.suppliers
              : (["EGB"] as ProductSupplier[])
          ).map((supplier) => ({
            supplier,
            priceUsd: product.priceUsd,
            sourceUnavailable: product.sourceUnavailable,
          }));

    return supplierPrices
      .filter((item) => item.sourceUnavailable !== true)
      .map((item) => ({
        product,
        supplier: item.supplier,
        priceUsd: Number(item.priceUsd) || 0,
      }));
  });
}

/*
 * =========================================================
 * COMPONENT
 * =========================================================
 */

export function MultimediaPreparationPageClient() {
  /*
   * =======================================================
   * STATE
   * =======================================================
   */

  const [
    multimediaMode,
    setMultimediaMode,
  ] = useState<MultimediaPreparationMode>(
    "framed"
  );

  const [, setSystemName] = useState("");

  const [
    additionalDescription,
    setAdditionalDescription,
  ] = useState("");

  const [
    vehicleCatalog,
    setVehicleCatalog,
  ] = useState<VehicleCatalogResponse | null>(null);

  const [
    selectedVehicleBrandId,
    setSelectedVehicleBrandId,
  ] = useState("");

  const [
    selectedVehicleModelId,
    setSelectedVehicleModelId,
  ] = useState("");

  const [
    selectedVehicleGenerationId,
    setSelectedVehicleGenerationId,
  ] = useState("");

  const [
    loadingVehicleCatalog,
    setLoadingVehicleCatalog,
  ] = useState(false);

  const [
    slots,
    setSlots,
  ] =
    useState<
      PreparedSlot[]
    >(
      createModeSlots(
        "framed"
      )
    );

  const [
    laborItems,
    setLaborItems,
  ] =
    useState<
      SystemLaborItem[]
    >(
      () =>
        createDefaultMultimediaLaborItems()
    );

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
  ] = useState("20");

  const [automaticDiscount, setAutomaticDiscount] = useState(true);

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
  ] = useState<MultimediaPreparation | null>(
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

  const vehicleBrands =
    useMemo(
      () =>
        vehicleCatalog?.brands ?? [],
      [vehicleCatalog]
    );

  const selectedVehicleBrand =
    useMemo(
      () =>
        vehicleBrands.find(
          (item) =>
            item.id ===
            selectedVehicleBrandId
        ) ?? null,
      [
        vehicleBrands,
        selectedVehicleBrandId,
      ]
    );

  const vehicleModels =
    useMemo(
      () =>
        selectedVehicleBrand?.models ?? [],
      [selectedVehicleBrand]
    );

  const selectedVehicleModel =
    useMemo(
      () =>
        vehicleModels.find(
          (item) =>
            item.id ===
            selectedVehicleModelId
        ) ?? null,
      [
        vehicleModels,
        selectedVehicleModelId,
      ]
    );

  const vehicleGenerations =
    useMemo(
      () =>
        selectedVehicleModel?.generations ?? [],
      [selectedVehicleModel]
    );

  const selectedVehicleGeneration =
    useMemo(
      () =>
        vehicleGenerations.find(
          (item) =>
            item.id ===
            selectedVehicleGenerationId
        ) ?? null,
      [
        vehicleGenerations,
        selectedVehicleGenerationId,
      ]
    );

  /*
   * =======================================================
   * VEHICLE SELECT ITEMS
   *
   * Select state içinde teknik ID/value tutulur.
   * Kullanıcıya trigger üzerinde yalnızca label gösterilir.
   * =======================================================
   */

  const vehicleBrandSelectItems =
    useMemo(
      () =>
        vehicleBrands.map(
          (brand) => ({
            value: brand.id,
            label: brand.name,
          })
        ),
      [vehicleBrands]
    );

  const vehicleModelSelectItems =
    useMemo(
      () =>
        vehicleModels.map(
          (model) => ({
            value: model.id,
            label: model.name,
          })
        ),
      [vehicleModels]
    );

  const vehicleGenerationSelectItems =
    useMemo(
      () =>
        vehicleGenerations.map(
          (generation) => ({
            value: generation.id,
            label: `${generation.name} · ${generation.startYear}-${generation.endYear}`,
          })
        ),
      [vehicleGenerations]
    );

  useEffect(() => {
    let cancelled = false;

    const loadVehicleCatalog =
      async () => {
        setLoadingVehicleCatalog(true);

        try {
          const response = await fetch(
            "/api/system-parameters/vehicles",
            { cache: "no-store" }
          );

          const result:
            ApiResponse<VehicleCatalogResponse> =
              await response.json();

          if (
            !response.ok ||
            !result.success ||
            !result.data
          ) {
            throw new Error(
              result.message ??
                "Araç tanımları alınamadı."
            );
          }

          if (!cancelled) {
            setVehicleCatalog(result.data);
          }
        } catch (error) {
          if (!cancelled) {
            setError(
              error instanceof Error
                ? error.message
                : "Araç tanımları alınamadı."
            );
          }
        } finally {
          if (!cancelled) {
            setLoadingVehicleCatalog(false);
          }
        }
      };

    void loadVehicleCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      !selectedVehicleBrand ||
      !selectedVehicleModel ||
      !selectedVehicleGeneration
    ) {
      setSystemName("");
      return;
    }

    setSystemName(
      `${selectedVehicleBrand.name} ${selectedVehicleModel.name} ${selectedVehicleGeneration.name} ${selectedVehicleGeneration.startYear}-${selectedVehicleGeneration.endYear}`
    );
  }, [
    selectedVehicleBrand,
    selectedVehicleModel,
    selectedVehicleGeneration,
  ]);

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

      if (
        slot.category ===
          "multimedia-frame" &&
        !selectedVehicleGenerationId
      ) {
        setError(
          "Multimedya çerçevesi seçmeden önce araç marka, model ve kasa/yıl seçmelisiniz."
        );
        return;
      }

      if (
        slot.category === "multimedia" &&
        multimediaMode === "vehicle_specific" &&
        !selectedVehicleGenerationId
      ) {
        setError(
          "Araca özel ekran seçmeden önce araç marka, model ve kasa/yıl seçmelisiniz."
        );
        return;
      }

      const selectedFrame =
        slots.find(
          (currentSlot) =>
            currentSlot.category ===
              "multimedia-frame" &&
            currentSlot.product
        )?.product ?? null;
      const selectedFrameSize =
        selectedFrame
          ? String(
              selectedFrame.specifications?.size ??
                ""
            ).trim()
          : "";

      if (
        slot.category === "multimedia" &&
        multimediaMode === "framed" &&
        !selectedFrame
      ) {
        setError(
          "Multimedya ekran seçmeden önce çerçeveyi seçmelisiniz."
        );
        return;
      }

      if (
        slot.category === "multimedia" &&
        multimediaMode === "framed" &&
        !selectedFrameSize
      ) {
        setError(
          "Seçilen çerçevenin boyut bilgisi bulunamadı."
        );
        return;
      }

      setRefreshingProductSlotId(
        slotId
      );
      setError(null);

      try {
        /*
         * Her ürün seçiminde kategori yeniden okunur.
         * Böylece kullanıcı ürün yönetiminde yeni bir ürün
         * eklediyse sayfayı yenilemeden burada görebilir.
         */
        const productParams =
          new URLSearchParams({
            category:
              slot.category,
          });

        if (
          slot.category ===
            "multimedia-frame"
        ) {
          productParams.set(
            "compatibleVehicleGenerationId",
            selectedVehicleGenerationId
          );
        }

        if (
          slot.category ===
          "multimedia"
        ) {
          productParams.set(
            "vehicleSpecific",
            multimediaMode ===
              "vehicle_specific"
              ? "true"
              : "false"
          );

          if (
            multimediaMode ===
            "vehicle_specific"
          ) {
            productParams.set(
              "compatibleVehicleGenerationId",
              selectedVehicleGenerationId
            );
          } else {
            productParams.set(
              "screenSize",
              selectedFrameSize
            );
          }
        }

        const response =
          await fetch(
            `/api/products?${productParams.toString()}`,
            {
              cache:
                "no-store",
            }
          );

        const result: ApiResponse<
          Product[]
        > =
          await response.json();

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.message ??
              "Ürünler yenilenemedi."
          );
        }

        const refreshedCategoryProducts =
          result.data ??
          [];

        setProducts(
          (previous) => [
            ...previous.filter(
              (product) =>
                product.category !==
                slot.category
            ),
            ...refreshedCategoryProducts,
          ]
        );

        if (slot.product) {
          const refreshedSelectedProduct =
            refreshedCategoryProducts.find(
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
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Ürünler yenilenemedi."
        );
      } finally {
        setRefreshingProductSlotId(
          null
        );
      }
    };

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
          const response =
            await fetch(
              "/api/multimedia-preparations?status=ready",
              {
                cache:
                  "no-store",
              }
            );

          const result: ApiResponse<
            MultimediaPreparation[]
          > =
            await response.json();

          if (
            !response.ok ||
            !result.success
          ) {
            throw new Error(
              result.message ??
                "Hazır multimedya alınamadı."
            );
          }

          const preparation =
            (
              result.data ??
              []
            ).find(
              (item) =>
                item.id ===
                editId
            );

          if (!preparation) {
            throw new Error(
              "Düzenlenecek hazır multimedya bulunamadı."
            );
          }

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

          setAdditionalDescription(
            preparation.additionalDescription ??
              ""
          );

          setSelectedVehicleBrandId(
            preparation.vehicleBrandId
          );
          setSelectedVehicleModelId(
            preparation.vehicleModelId
          );
          setSelectedVehicleGenerationId(
            preparation.vehicleGenerationId
          );

          setCommissionRate(
            String(
              preparation.commissionRate ??
                0
            )
          );

          setAutomaticDiscount(preparation.automaticDiscount !== false);

          setDiscountTry(
            String(
              preparation.discountTry ??
                0
            )
          );

          setMultimediaMode(
            preparation.multimediaMode
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
              : "Hazır multimedya alınamadı."
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
   * LOAD PRODUCT CATALOG
   *
   * Sistem hazırlama artık stok listesini kullanmaz.
   * Ürünler doğrudan ürün kataloğundan (/api/products) gelir.
   *
   * Edit modunda mevcut ürün seçimlerini güncel katalog
   * kayıtlarıyla tekrar eşleştiririz.
   * =======================================================
   */

  useEffect(() => {
    const loadProducts =
      async () => {
        setLoadingProducts(
          true
        );

        setError(null);

        try {
          const response =
            await fetch(
              "/api/products",
              {
                cache:
                  "no-store",
              }
            );

          const result: ApiResponse<
            Product[]
          > =
            await response.json();

          if (
            !response.ok ||
            !result.success
          ) {
            throw new Error(
              result.message ??
                "Ürünler alınamadı."
            );
          }

          const loadedProducts =
            result.data ??
            [];

          setProducts(
            loadedProducts
          );

          if (
            editingPreparation
          ) {
            setSlots(
              createModeSlots(
                editingPreparation.multimediaMode
              ).map(
                (
                  modeSlot
                ): PreparedSlot => {
                  const item =
                    editingPreparation.items.find(
                      (currentItem) =>
                        currentItem.category ===
                        modeSlot.category
                    );

                  if (!item) {
                    return modeSlot;
                  }

                  const selectedProduct =
                    item.productId
                      ? loadedProducts.find(
                          (product) =>
                            product.id ===
                            item.productId
                        ) ?? null
                      : null;

                  return {
                    ...modeSlot,
                    subCategory:
                      item.subCategory,
                    quantity:
                      item.quantity,
                    isCommissionIncluded:
                      item.isCommissionIncluded !==
                      false,
                    product:
                      selectedProduct,
                    selectedSupplier:
                      item.supplier,
                    selectedPriceUsd:
                      item.unitPriceUsd,
                    locked:
                      true,
                  };
                }
              )
            );

            setCurrentPreparationId(
              editingPreparation.id
            );
          }
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : "Ürünler alınamadı."
          );
        } finally {
          setLoadingProducts(
            false
          );
        }
      };

    void loadProducts();
  }, [
    editingPreparation,
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

  const clearFrameSelections =
    () => {
      setSlots(
        (previous) =>
          previous.map(
            (slot) =>
              slot.product
                ? {
                    ...slot,
                    product: null,
                    selectedSupplier:
                      undefined,
                    selectedPriceUsd:
                      undefined,
                  }
                : slot
          )
      );
    };

  /*
   * =======================================================
   * REMOVE CUSTOM SLOT
   * =======================================================
   */


  /*
   * =========================================================
   * MULTIMEDIA AUTO FRAME + DEFAULTS V2.16 - AUTO FRAME
   * =========================================================
   */
  useEffect(() => {
    if (
      multimediaMode !== "framed" ||
      !selectedVehicleGenerationId ||
      editingPreparation
    ) {
      return;
    }

    const frameSlot =
      slots.find(
        (slot) =>
          slot.category ===
          "multimedia-frame"
      ) ?? null;

    if (!frameSlot || frameSlot.product) {
      return;
    }

    let cancelled = false;

    const autoSelectSingleFrame = async () => {
      try {
        const params = new URLSearchParams({
          category: "multimedia-frame",
          compatibleVehicleGenerationId:
            selectedVehicleGenerationId,
        });

        const response = await fetch(
          `/api/products?${params.toString()}`,
          { cache: "no-store" }
        );

        const result: ApiResponse<Product[]> =
          await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message ??
              "Uyumlu cerceveler alinamadi."
          );
        }

        const frameProducts = result.data ?? [];

        if (cancelled) {
          return;
        }

        setProducts((previous) => [
          ...previous.filter(
            (product) =>
              product.category !==
              "multimedia-frame"
          ),
          ...frameProducts,
        ]);

        const availableSelections =
          getAvailableProductSelections(
            frameProducts
          );

        if (availableSelections.length !== 1) {
          return;
        }

        const onlySelection =
          availableSelections[0];
        const nextFrameSize = String(
          onlySelection.product.specifications
            ?.size ?? ""
        ).trim();

        setSlots((previous) =>
          previous.map((slot) => {
            if (slot.id === frameSlot.id) {
              return {
                ...slot,
                product: onlySelection.product,
                selectedSupplier:
                  onlySelection.supplier,
                selectedPriceUsd:
                  onlySelection.priceUsd,
              };
            }

            if (
              slot.category === "multimedia" &&
              slot.product &&
              String(
                slot.product.specifications
                  ?.screenSize ?? ""
              ).trim() !== nextFrameSize
            ) {
              return {
                ...slot,
                product: null,
                selectedSupplier: undefined,
                selectedPriceUsd: undefined,
              };
            }

            return slot;
          })
        );

        setSuccessMessage(null);
      } catch (autoSelectError) {
        if (cancelled) {
          return;
        }

        setError(
          autoSelectError instanceof Error
            ? autoSelectError.message
            : "Uyumlu cerceveler alinamadi."
        );
      }
    };

    void autoSelectSingleFrame();

    return () => {
      cancelled = true;
    };
  }, [
    multimediaMode,
    selectedVehicleGenerationId,
    editingPreparation,
    slots,
  ]);

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
            getSlotPriceUsd(slot) *
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
            getSlotPriceUsd(slot) *
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
  const discountTryNumber = automaticDiscount
    ? calculateMultimediaAutoDiscount(productTotalTry + commissionAmountTry + laborCostTry)
    : Math.max(
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
    (): MultimediaPreparationPayload | null => {
      if (
        !selectedVehicleBrandId ||
        !selectedVehicleModelId ||
        !selectedVehicleGenerationId
      ) {
        setError(
          "Araç marka, model ve kasa seçimi zorunludur."
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
        multimediaMode,
        vehicleBrandId:
          selectedVehicleBrandId,
        vehicleModelId:
          selectedVehicleModelId,
        vehicleGenerationId:
          selectedVehicleGenerationId,

        ...(additionalDescription.trim()
          ? {
              additionalDescription:
                additionalDescription
                  .trim()
                  .slice(0, 500),
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

        automaticDiscount,
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
                      ...(slot.selectedSupplier
                        ? {
                            supplier:
                              slot.selectedSupplier,
                          }
                        : {}),
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
                      ...(slot.selectedSupplier
                        ? {
                            supplier:
                              slot.selectedSupplier,
                          }
                        : {}),
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
      MultimediaPreparation | null
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
              ? `/api/multimedia-preparations/${currentPreparationId}`
              : "/api/multimedia-preparations",
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

        const result: ApiResponse<MultimediaPreparation> =
          await response.json();

        if (
          !response.ok ||
          !result.success ||
          !result.data
        ) {
          throw new Error(
            result.message ??
              "Multimedya kaydedilemedi."
          );
        }

        setCurrentPreparationId(
          result.data.id
        );

        setSuccessMessage(
          editingReadySystem
            ? "Hazır multimedya bilgileri güncellendi."
            : editing
              ? "Taslak güncellendi."
              : "Taslak başarıyla kaydedildi."
        );

        return result.data;
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Multimedya kaydedilemedi."
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
          "Hazır multimedya oluşturmak için tüm ürün alanlarına ürün seçmelisiniz."
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
              `/api/multimedia-preparations/${preparation.id}/ready`,
              {
                method:
                  "POST",
              }
            );

          const result: ApiResponse<MultimediaPreparation> =
            await response.json();

          if (
            !response.ok ||
            !result.success ||
            !result.data
          ) {
            throw new Error(
              result.message ??
                "Hazır multimedya oluşturulamadı."
            );
          }
        }

        setSuccessMessage(
          wasEditingReadySystem
            ? "Hazır multimedya başarıyla güncellendi."
            : "Multimedya hazır multimedya olarak kaydedildi."
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
        setAdditionalDescription("");
        setSelectedVehicleBrandId("");
        setSelectedVehicleModelId("");
        setSelectedVehicleGenerationId("");

        setMultimediaMode(
          "framed"
        );

        setSlots(
          createModeSlots(
            "framed"
          )
        );

        setLaborItems(
          createDefaultMultimediaLaborItems()
        );

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
          "20"
        );

        setAutomaticDiscount(true);
        setDiscountTry(
          "0"
        );
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Hazır multimedya oluşturulamadı."
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
          Multimedya Tanımlama
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Uyumlu aracı seçin; ardından ürün, işçilik, komisyon ve fiyat yapısını Sistem Hazırlama ekranındaki gibi oluşturun.
        </p>

        {editingReadySystem && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1.5 text-xs font-medium">
            <Pencil className="size-3.5" />
            Hazır multimedya düzenleniyor
          </div>
        )}

        {loadingEditingPreparation && (
          <div className="mt-3 text-xs text-muted-foreground">
            Hazır multimedya yükleniyor...
          </div>
        )}
      </div>

      <div className="max-w-2xl space-y-2">
        <Label htmlFor="multimedia-additional-description">
          Ek Açıklama (Opsiyonel)
        </Label>
        <Input
          id="multimedia-additional-description"
          value={additionalDescription}
          maxLength={500}
          onChange={(event) => {
            setAdditionalDescription(
              event.target.value
            );
            setSuccessMessage(null);
          }}
          placeholder="Örn: Piano black çerçeve, kablosuz CarPlay"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Araç Uyumluluğu
          </CardTitle>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>Araç Markası</Label>
            <Select
              items={vehicleBrandSelectItems}
              value={selectedVehicleBrandId || null}
              onValueChange={(value) => {
                setSelectedVehicleBrandId(value ?? "");
                setSelectedVehicleModelId("");
                setSelectedVehicleGenerationId("");
                clearFrameSelections();
                setSuccessMessage(null);
              }}
              disabled={loadingVehicleCatalog}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={loadingVehicleCatalog ? "Yükleniyor..." : "Marka seçin"} />
              </SelectTrigger>
              <SelectContent>
                {vehicleBrands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Araç Modeli</Label>
            <Select
              items={vehicleModelSelectItems}
              value={selectedVehicleModelId || null}
              onValueChange={(value) => {
                setSelectedVehicleModelId(value ?? "");
                setSelectedVehicleGenerationId("");
                clearFrameSelections();
                setSuccessMessage(null);
              }}
              disabled={!selectedVehicleBrandId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Model seçin" />
              </SelectTrigger>
              <SelectContent>
                {vehicleModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Kasa / Yıl</Label>
            <Select
              items={vehicleGenerationSelectItems}
              value={selectedVehicleGenerationId || null}
              onValueChange={(value) => {
                setSelectedVehicleGenerationId(value ?? "");
                clearFrameSelections();
                setSuccessMessage(null);
              }}
              disabled={!selectedVehicleModelId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Kasa seçin" />
              </SelectTrigger>
              <SelectContent>
                {vehicleGenerations.map((generation) => (
                  <SelectItem key={generation.id} value={generation.id}>
                    {generation.name} · {generation.startYear}-{generation.endYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Multimedya Tipi</Label>
            <Select
              items={[
                {
                  value: "framed",
                  label: "Çerçeveli",
                },
                {
                  value: "vehicle_specific",
                  label: "Araca Özel",
                },
              ]}
              value={multimediaMode}
              onValueChange={(value) => {
                if (
                  value !== "framed" &&
                  value !== "vehicle_specific"
                ) {
                  return;
                }

                if (
                  editingReadySystem &&
                  value !== multimediaMode
                ) {
                  setEditingPreparation(null);
                }

                setMultimediaMode(value);
                setSlots(
                  createModeSlots(value)
                );
                setSuccessMessage(null);
                setError(null);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="framed">
                  Çerçeveli
                </SelectItem>
                <SelectItem value="vehicle_specific">
                  Araca Özel
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedVehicleGeneration && (
            <div className="md:col-span-2 xl:col-span-4 rounded-xl border bg-muted/30 px-4 py-3 text-sm">
              <span className="font-medium">Uyumlu araç:</span>{" "}
              {selectedVehicleBrand?.name} {selectedVehicleModel?.name}{" "}
              {selectedVehicleGeneration.name}{" "}
              ({selectedVehicleGeneration.startYear}-{selectedVehicleGeneration.endYear})
            </div>
          )}
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
                                    : slot.locked
                                      ? "Hazır Alan"
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
                            "custom" &&
                            !slot.locked && (
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
                          "custom" &&
                          !slot.locked && (
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

                                  updateSlot(
                                    slot.id,
                                    {
                                      category:
                                        value as ProductCategory,

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
                                          {formatUsd(getSlotPriceUsd(slot))}
                                        </span>
                                      </span>

                                      {slot.selectedSupplier && (
                                        <span>
                                          Tedarikçi:{" "}
                                          <span className="font-medium text-foreground">
                                            {slot.selectedSupplier}
                                          </span>
                                        </span>
                                      )}

                                      {usdTryRate && (
                                        <span>
                                          TL:{" "}
                                          <span className="font-medium text-foreground">
                                            {formatTry(
                                              getSlotPriceUsd(slot) * usdTryRate
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
                                    getSlotPriceUsd(slot) * slot.quantity
                                  )}
                                </div>

                                {usdTryRate && (
                                  <div className="mt-0.5 text-xs font-medium text-foreground">
                                    {formatTry(
                                      getSlotPriceUsd(slot) *
                                        slot.quantity *
                                        usdTryRate
                                    )}
                                  </div>
                                )}

                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  {formatUsd(getSlotPriceUsd(slot))}{" "}
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
                  Multimedya Özeti
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
                    &quot;Komisyona Dahil&quot;
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
                  <label className="flex items-center gap-2" htmlFor="automaticDiscount">
                    <input
                      id="automaticDiscount"
                      type="checkbox"
                      checked={automaticDiscount}
                      onChange={(event) => {
                        if (!event.target.checked) setDiscountTry(String(discountTryNumber));
                        setAutomaticDiscount(event.target.checked);
                        setSuccessMessage(null);
                      }}
                    />
                    Otomatik indirim
                  </label>
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
                      readOnly={automaticDiscount}
                      type="number"
                      min="0"
                      step="0.01"
                      value={automaticDiscount ? discountTryNumber : discountTry}
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
                        !selectedVehicleGenerationId ||
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
                      !selectedVehicleGenerationId ||
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
                        ? "Hazır Multimedya Güncelleniyor..."
                        : "Hazır Multimedya Kaydediliyor..."
                      : editingReadySystem
                        ? "Hazır Multimedyayı Güncelle"
                        : "Hazır Multimedya Olarak Kaydet"}
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
          selectedSupplier={productSelectionSlot.selectedSupplier}
          onSelect={(product, supplier, priceUsd) => {
            if (
              productSelectionSlot.category ===
              "multimedia-frame"
            ) {
              const nextFrameSize =
                String(
                  product.specifications?.size ??
                    ""
                ).trim();

              setSlots(
                (previous) =>
                  previous.map(
                    (slot) => {
                      if (
                        slot.id ===
                        productSelectionSlot.id
                      ) {
                        return {
                          ...slot,
                          product,
                          selectedSupplier:
                            supplier,
                          selectedPriceUsd:
                            priceUsd,
                        };
                      }

                      if (
                        slot.category ===
                          "multimedia" &&
                        slot.product &&
                        String(
                          slot.product.specifications?.screenSize ??
                            ""
                        ).trim() !==
                          nextFrameSize
                      ) {
                        return {
                          ...slot,
                          product: null,
                          selectedSupplier:
                            undefined,
                          selectedPriceUsd:
                            undefined,
                        };
                      }

                      return slot;
                    })
              );
              setSuccessMessage(null);
              setProductSelectionSlotId(null);
              return;
            }

            updateSlot(
              productSelectionSlot.id,
              {
                product,
                selectedSupplier:
                  supplier,
                selectedPriceUsd:
                  priceUsd,
              }
            );

            setProductSelectionSlotId(null);
          }}
          onClear={() => {
            if (
              productSelectionSlot.category ===
              "multimedia-frame"
            ) {
              setSlots(
                (previous) =>
                  previous.map(
                    (slot) =>
                      slot.category ===
                          "multimedia-frame" ||
                        slot.category ===
                          "multimedia"
                        ? {
                            ...slot,
                            product: null,
                            selectedSupplier:
                              undefined,
                            selectedPriceUsd:
                              undefined,
                          }
                        : slot
                  )
              );
              setSuccessMessage(null);
              setProductSelectionSlotId(null);
              return;
            }

            updateSlot(
              productSelectionSlot.id,
              {
                product: null,
                selectedSupplier:
                  undefined,
                selectedPriceUsd:
                  undefined,
              }
            );

            setProductSelectionSlotId(null);
          }}
        />
      )}
    </div>
  );
}
