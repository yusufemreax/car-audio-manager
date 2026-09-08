/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Check,
  Loader2,
  Package,
  Plus,
  Trash2,
} from "lucide-react";

import type {
  Product,
  ProductCategory,
} from "@/types/product";

import {
  DEFAULT_PRODUCT_SUPPLIERS,
  PRODUCT_SUPPLIERS,
  type ProductSupplier,
  type SupplierPurchasePaymentMethod,
  type SupplierSummary,
} from "@/types/supplier";

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
  Textarea,
} from "@/components/ui/textarea";

import {
  ProductSelectionDialog,
} from "@/components/system-preparation/product-selection-dialog";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

interface ExchangeRateResponse {
  success: boolean;
  message?: string;
  data?: {
    rate: number;
    date?: string;
  };
}

interface OrderRow {
  id: string;
  label: string;
  category: ProductCategory;
  subCategory?: string;
  productId: string;
  quantity: number;
}

interface SelectedOrderItem {
  productId: string;
  quantity: number;
}

interface BulkPurchaseResult {
  batchOrderId: string;
  supplier: ProductSupplier;
  paymentMethod: SupplierPurchasePaymentMethod;
  itemCount: number;
  totalQuantity: number;
  purchaseTotalUsd: number;
  purchaseTotalTry: number;
  balanceUsedUsd: number;
  cardAmountUsd: number;
  customerCardAmountTry: number;
  customerCardSurplusUsd: number;
  customerCardSurplusTry: number;
}

const PAYMENT_ITEMS = [
  {
    value: "card",
    label: "Kendi Kartım",
  },
  {
    value: "customer_card",
    label: "Müşteri Kartı",
  },
  {
    value: "balance",
    label: "Bakiye + Kendi Kartım",
  },
];

const DEFAULT_CATEGORY =
  (productCategories[0]?.value ??
    "speaker") as ProductCategory;

/*
 * =========================================================
 * PRODUCT CATALOG CACHE
 *
 * Toplu sipariş ekranında tüm ürün kataloğunu sayfa açılışında
 * yüklemiyoruz. Kategoriler ihtiyaç oldukça alınır ve client
 * belleğinde tutulur. Aynı kategori tekrar açıldığında dialog
 * ağ isteğini beklemeden açılır.
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

function createInitialRow(
  id = "row-1"
): OrderRow {
  return {
    id,
    label: "",
    category: DEFAULT_CATEGORY,
    subCategory: undefined,
    productId: "",
    quantity: 1,
  };
}

function getSubCategoryOptions(
  category: ProductCategory
) {
  const definition =
    productCategoryDefinitions[
      category
    ];

  const field =
    definition?.fields.find(
      (item) =>
        item.source ===
        "subCategory"
    );

  return field?.options ?? [];
}

function roundMoney(
  value: number
) {
  return Math.round(
    (value + Number.EPSILON) *
      100
  ) / 100;
}

function toNumber(
  value: string
) {
  const parsed =
    Number(
      value
        .trim()
        .replace(",", ".")
    );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

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
  ).format(
    Number.isFinite(value)
      ? value
      : 0
  );
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
  ).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}

function getProductSuppliers(
  product: Product
): ProductSupplier[] {
  return product.suppliers?.length
    ? product.suppliers
    : [...DEFAULT_PRODUCT_SUPPLIERS];
}

export function BulkStockOrderPageClient() {
  const rowCounterRef =
    useRef(1);

  const [
    products,
    setProducts,
  ] = useState<Product[]>([]);

  const [
    suppliers,
    setSuppliers,
  ] = useState<SupplierSummary[]>([]);

  const [
    supplier,
    setSupplier,
  ] = useState<ProductSupplier>("EGB");

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState<SupplierPurchasePaymentMethod>(
    "card"
  );

  const [
    rows,
    setRows,
  ] = useState<OrderRow[]>([
    createInitialRow(),
  ]);

  const [
    balanceUsedUsd,
    setBalanceUsedUsd,
  ] = useState("0");

  const [
    customerCardAmountTry,
    setCustomerCardAmountTry,
  ] = useState("");

  const [
    note,
    setNote,
  ] = useState("");

  const [
    exchangeRate,
    setExchangeRate,
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
    loading,
    setLoading,
  ] = useState(true);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  const [
    success,
    setSuccess,
  ] = useState<string | null>(
    null
  );

  const [
    lastResult,
    setLastResult,
  ] = useState<BulkPurchaseResult | null>(
    null
  );

  const [
    productSelectionRowId,
    setProductSelectionRowId,
  ] = useState<string | null>(
    null
  );

  const [
    refreshingProductRowId,
    setRefreshingProductRowId,
  ] = useState<string | null>(
    null
  );

  const mergeCategoryProducts =
    useCallback(
      (
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
      },
      []
    );

  const fetchCategoryProducts =
    useCallback(
      async (
        category: ProductCategory,
        options?: {
          force?: boolean;
        }
      ) => {
        const now =
          Date.now();

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
                  cache:
                    "no-store",
                }
              );

            const result:
              ApiResponse<Product[]> =
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
      },
      []
    );

  const prefetchCategory =
    useCallback(
      (
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

        void fetchCategoryProducts(
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
                "Ürün kategorisi ön yüklenemedi:",
                category,
                prefetchError
              );
            }
          );
      },
      [
        fetchCategoryProducts,
        mergeCategoryProducts,
      ]
    );

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError(null);

        try {
          /*
           * Sayfa açılışını ürün kataloğuna bağlamıyoruz.
           * Önce yalnızca zorunlu tedarikçi özetini getiriyoruz.
           */
          const suppliersResponse =
            await fetch(
              "/api/suppliers",
              {
                cache:
                  "no-store",
              }
            );

          const suppliersResult:
            ApiResponse<SupplierSummary[]> =
              await suppliersResponse.json();

          if (
            !suppliersResponse.ok ||
            !suppliersResult.success
          ) {
            throw new Error(
              suppliersResult.message ??
                "Tedarikçi bilgileri getirilemedi."
            );
          }

          setSuppliers(
            suppliersResult.data ?? []
          );
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Toplu sipariş bilgileri yüklenemedi."
          );
        } finally {
          setLoading(false);
        }
      },
      []
    );

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * Kur bilgisi sayfanın açılmasını bloklamaz. İlk günlük EGB
   * kur isteği yavaş olsa bile kullanıcı ürün satırlarını
   * düzenlemeye başlayabilir.
   */
  useEffect(() => {
    let cancelled =
      false;

    const loadExchangeRate =
      async () => {
        try {
          const exchangeResponse =
            await fetch(
              "/api/exchange-rate",
              {
                cache:
                  "no-store",
              }
            );

          const exchangeResult:
            ExchangeRateResponse =
              await exchangeResponse.json();

          if (
            cancelled ||
            !exchangeResponse.ok ||
            !exchangeResult.success ||
            !exchangeResult.data?.rate
          ) {
            return;
          }

          setExchangeRate(
            exchangeResult.data.rate
          );
          setExchangeRateDate(
            exchangeResult.data.date ??
              null
          );
        } catch (exchangeError) {
          if (!cancelled) {
            console.warn(
              "Kur bilgisi alınamadı:",
              exchangeError
            );
          }
        }
      };

    void loadExchangeRate();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * İlk satırın varsayılan kategorisini sayfa açılırken arka
   * planda hazırla. Kullanıcı Ürün Seç'e ulaştığında çoğu kez
   * dialog beklemeden açılmış olur.
   */
  useEffect(() => {
    prefetchCategory(
      DEFAULT_CATEGORY
    );
  }, [prefetchCategory]);

  const productById =
    useMemo(
      () =>
        new Map(
          products.map(
            (product) => [
              product.id,
              product,
            ]
          )
        ),
      [products]
    );

  const currentSupplierSummary =
    useMemo(
      () =>
        suppliers.find(
          (item) =>
            item.supplier ===
            supplier
        ),
      [
        suppliers,
        supplier,
      ]
    );

  const currentSupplierBalance =
    currentSupplierSummary
      ?.balanceUsd ??
    0;

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

  const productSelectionRow =
    useMemo(
      () =>
        productSelectionRowId
          ? rows.find(
              (row) =>
                row.id ===
                productSelectionRowId
            ) ?? null
          : null,
      [
        rows,
        productSelectionRowId,
      ]
    );

  const productSelectionProducts =
    useMemo(
      () => {
        if (
          !productSelectionRow
        ) {
          return [];
        }

        const usedByOtherRows =
          new Set(
            rows
              .filter(
                (row) =>
                  row.id !==
                  productSelectionRow.id
              )
              .map(
                (row) =>
                  row.productId
              )
              .filter(Boolean)
          );

        return products.filter(
          (product) =>
            getProductSuppliers(
              product
            ).includes(
              supplier
            ) &&
            (
              product.id ===
                productSelectionRow.productId ||
              !usedByOtherRows.has(
                product.id
              )
            )
        );
      },
      [
        products,
        rows,
        supplier,
        productSelectionRow,
      ]
    );

  const selectedRows =
    useMemo(
      () =>
        rows
          .map(
            (row) => {
              if (!row.productId) {
                return null;
              }

              const product =
                productById.get(
                  row.productId
                );

              if (!product) {
                return null;
              }

              const totalUsd =
                roundMoney(
                  product.priceUsd *
                    row.quantity
                );

              return {
                ...row,
                product,
                totalUsd,
              };
            }
          )
          .filter(
            (
              item
            ): item is NonNullable<
              typeof item
            > =>
              Boolean(item)
          ),
      [
        rows,
        productById,
      ]
    );

  const items:
    SelectedOrderItem[] =
      useMemo(
        () =>
          selectedRows.map(
            (row) => ({
              productId:
                row.productId,
              quantity:
                row.quantity,
            })
          ),
        [selectedRows]
      );

  const purchaseTotalUsd =
    useMemo(
      () =>
        roundMoney(
          selectedRows.reduce(
            (
              total,
              item
            ) =>
              total +
              item.totalUsd,
            0
          )
        ),
      [selectedRows]
    );

  const totalQuantity =
    useMemo(
      () =>
        selectedRows.reduce(
          (
            total,
            item
          ) =>
            total +
            item.quantity,
          0
        ),
      [selectedRows]
    );

  const effectiveRate =
    exchangeRate ??
    0;

  const purchaseTotalTry =
    roundMoney(
      purchaseTotalUsd *
        effectiveRate
    );

  const numericBalanceUsedUsd =
    Math.max(
      0,
      roundMoney(
        toNumber(
          balanceUsedUsd
        )
      )
    );

  const numericCustomerCardTry =
    Math.max(
      0,
      roundMoney(
        toNumber(
          customerCardAmountTry
        )
      )
    );

  const customerCardChargedUsd =
    effectiveRate > 0
      ? roundMoney(
          numericCustomerCardTry /
            effectiveRate
        )
      : 0;

  const customerCardSurplusUsd =
    Math.max(
      0,
      roundMoney(
        customerCardChargedUsd -
          purchaseTotalUsd
      )
    );

  const customerCardSurplusTry =
    roundMoney(
      customerCardSurplusUsd *
        effectiveRate
    );

  const ownCardUsd =
    paymentMethod ===
    "customer_card"
      ? 0
      : paymentMethod ===
          "balance"
        ? Math.max(
            0,
            roundMoney(
              purchaseTotalUsd -
                numericBalanceUsedUsd
            )
          )
        : purchaseTotalUsd;

  const addRow =
    () => {
      rowCounterRef.current +=
        1;

      setRows(
        (current) => [
          ...current,
          createInitialRow(
            `row-${rowCounterRef.current}`
          ),
        ]
      );

      setSuccess(null);
      setLastResult(null);
    };

  const updateRow =
    (
      rowId: string,
      updates:
        Partial<OrderRow>
    ) => {
      setRows(
        (current) =>
          current.map(
            (row) =>
              row.id === rowId
                ? {
                    ...row,
                    ...updates,
                  }
                : row
          )
      );

      setSuccess(null);
      setLastResult(null);
    };

  const openProductSelection =
    async (
      rowId: string
    ) => {
      const row =
        rows.find(
          (currentRow) =>
            currentRow.id ===
            rowId
        );

      if (!row) {
        return;
      }

      setError(null);

      const cached =
        productCategoryCache.get(
          row.category
        );

      /*
       * Cache varsa dialog'u ÖNCE aç. Kullanıcı ağ isteğini
       * beklemez. Katalog 30 saniyeden eskiyse arka planda
       * güncellenir (stale-while-revalidate).
       */
      if (cached) {
        mergeCategoryProducts(
          row.category,
          cached.products
        );

        setProductSelectionRowId(
          rowId
        );

        if (
          Date.now() -
            cached.loadedAt >=
          PRODUCT_CATEGORY_REVALIDATE_MS
        ) {
          void fetchCategoryProducts(
            row.category,
            {
              force: true,
            }
          )
            .then(
              (categoryProducts) => {
                mergeCategoryProducts(
                  row.category,
                  categoryProducts
                );
              }
            )
            .catch(
              (refreshError) => {
                console.warn(
                  "Ürün kategorisi arka planda yenilenemedi:",
                  row.category,
                  refreshError
                );
              }
            );
        }

        return;
      }

      /*
       * Kategori ilk kez açılıyorsa yalnızca O kategori alınır.
       * Tüm ürün kataloğunu hiçbir zaman beklemiyoruz.
       */
      setRefreshingProductRowId(
        rowId
      );

      try {
        const categoryProducts =
          await fetchCategoryProducts(
            row.category
          );

        mergeCategoryProducts(
          row.category,
          categoryProducts
        );

        setProductSelectionRowId(
          rowId
        );
      } catch (selectionError) {
        setError(
          selectionError instanceof Error
            ? selectionError.message
            : "Ürünler yenilenemedi."
        );
      } finally {
        setRefreshingProductRowId(
          null
        );
      }
    };

  const removeRow =
    (
      rowId: string
    ) => {
      setRows(
        (current) =>
          current.filter(
            (row) =>
              row.id !==
              rowId
          )
      );

      if (
        productSelectionRowId ===
        rowId
      ) {
        setProductSelectionRowId(
          null
        );
      }

      setSuccess(null);
      setLastResult(null);
    };

  const changeSupplier =
    (
      nextSupplier:
        ProductSupplier
    ) => {
      setSupplier(
        nextSupplier
      );
      setProductSelectionRowId(
        null
      );

      setRows(
        (current) =>
          current.map(
            (row) => ({
              ...row,
              productId: "",
            })
          )
      );

      setBalanceUsedUsd(
        "0"
      );
      setCustomerCardAmountTry(
        ""
      );
      setSuccess(null);
      setLastResult(null);
    };

  const validate =
    () => {
      if (
        rows.length ===
        0
      ) {
        return "En az bir sipariş satırı ekleyiniz.";
      }

      for (
        let index = 0;
        index < rows.length;
        index += 1
      ) {
        const row =
          rows[index];

        if (!row.productId) {
          return `${index + 1}. satırda ürün seçiniz.`;
        }

        if (
          !Number.isInteger(
            row.quantity
          ) ||
          row.quantity <= 0
        ) {
          return `${index + 1}. satır için geçerli adet giriniz.`;
        }
      }

      if (
        items.length ===
        0
      ) {
        return "Siparişe en az bir ürün seçiniz.";
      }

      if (
        paymentMethod ===
          "balance"
      ) {
        if (
          numericBalanceUsedUsd <=
          0
        ) {
          return "Bakiyeden kullanılacak USD tutarını giriniz.";
        }

        if (
          numericBalanceUsedUsd >
          purchaseTotalUsd
        ) {
          return "Bakiyeden kullanılacak tutar sipariş toplamından büyük olamaz.";
        }

        if (
          numericBalanceUsedUsd >
          currentSupplierBalance
        ) {
          return `${supplier} bakiyesi yetersiz.`;
        }
      }

      if (
        paymentMethod ===
          "customer_card"
      ) {
        if (
          effectiveRate <=
          0
        ) {
          return "Müşteri kartı işlemi için güncel kur bilgisi alınamadı.";
        }

        if (
          numericCustomerCardTry <=
          0
        ) {
          return "Müşteri kartından çekilen TL tutarını giriniz.";
        }

        if (
          customerCardChargedUsd <
          purchaseTotalUsd
        ) {
          return `Müşteri kartından en az ${formatTry(
            purchaseTotalTry
          )} çekilmelidir.`;
        }
      }

      return null;
    };

  const submit =
    async () => {
      const validationMessage =
        validate();

      if (
        validationMessage
      ) {
        setError(
          validationMessage
        );
        return;
      }

      setSubmitting(true);
      setError(null);
      setSuccess(null);
      setLastResult(null);

      try {
        const response =
          await fetch(
            "/api/inventory/bulk-purchase",
            {
              method:
                "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
                  supplier,
                  paymentMethod,
                  items,
                  balanceUsedUsd:
                    paymentMethod ===
                    "balance"
                      ? numericBalanceUsedUsd
                      : 0,
                  customerCardAmountTry:
                    paymentMethod ===
                    "customer_card"
                      ? numericCustomerCardTry
                      : 0,
                  exchangeRate:
                    effectiveRate >
                    0
                      ? effectiveRate
                      : undefined,
                  exchangeRateDate:
                    exchangeRateDate ??
                    undefined,
                  note:
                    note.trim() ||
                    undefined,
                }),
            }
          );

        const result:
          ApiResponse<BulkPurchaseResult> =
            await response.json();

        if (
          !response.ok ||
          !result.success ||
          !result.data
        ) {
          throw new Error(
            result.message ??
              "Toplu stok siparişi kaydedilemedi."
          );
        }

        setLastResult(
          result.data
        );
        setSuccess(
          result.message ??
            "Toplu sipariş başarıyla stoklara eklendi."
        );

        rowCounterRef.current =
          1;
        setRows([
          createInitialRow(),
        ]);
        setBalanceUsedUsd(
          "0"
        );
        setCustomerCardAmountTry(
          ""
        );
        setNote("");

        const suppliersResponse =
          await fetch(
            "/api/suppliers",
            {
              cache:
                "no-store",
            }
          );

        const suppliersResult:
          ApiResponse<SupplierSummary[]> =
            await suppliersResponse.json();

        if (
          suppliersResponse.ok &&
          suppliersResult.success
        ) {
          setSuppliers(
            suppliersResult.data ??
              []
          );
        }
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Toplu stok siparişi kaydedilemedi."
        );
      } finally {
        setSubmitting(false);
      }
    };

  const selectedCount =
    selectedRows.length;

  const allSelected =
    rows.length > 0 &&
    rows.every(
      (row) =>
        Boolean(row.productId)
    );

  return (
    <div className="min-w-0 space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Toplu Stok Siparişi
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Bir tedarikçiden aynı siparişte birden fazla ürünü seçin, adetlerini belirleyin ve tek işlemle stoklara ekleyin.
        </p>
      </div>

      {/* GENERAL INFO - same visual language as System Preparation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Sipariş Bilgileri
          </CardTitle>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>
              Tedarikçi
            </Label>

            <Select
              items={
                PRODUCT_SUPPLIERS.map(
                  (item) => ({
                    value: item,
                    label: item,
                  })
                )
              }
              value={supplier}
              disabled={
                submitting || loading
              }
              onValueChange={(value) => {
                if (
                  value &&
                  PRODUCT_SUPPLIERS.includes(
                    value as ProductSupplier
                  )
                ) {
                  changeSupplier(
                    value as ProductSupplier
                  );
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {PRODUCT_SUPPLIERS.map(
                  (item) => (
                    <SelectItem
                      key={item}
                      value={item}
                    >
                      {item}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              Güncel Kur
            </Label>

            <div className="flex h-9 items-center rounded-md border bg-muted/20 px-3 text-sm">
              {effectiveRate > 0 ? (
                <>
                  <span className="font-medium">
                    1 USD = {effectiveRate.toLocaleString(
                      "tr-TR",
                      {
                        minimumFractionDigits: 4,
                        maximumFractionDigits: 4,
                      }
                    )} TL
                  </span>

                  {exchangeRateDate && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({exchangeRateDate})
                    </span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">
                  Kur bilgisi alınamadı.
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MESSAGES */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          <div className="font-medium">
            {success}
          </div>

          {lastResult && (
            <div className="mt-1 text-xs leading-5">
              {lastResult.itemCount} ürün çeşidi • {lastResult.totalQuantity} adet • {formatUsd(
                lastResult.purchaseTotalUsd
              )} toplam alış
              {lastResult.customerCardSurplusUsd > 0
                ? ` • ${formatUsd(
                    lastResult.customerCardSurplusUsd
                  )} site bakiyesinde kaldı`
                : ""}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-48 items-center justify-center rounded-xl border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Tedarikçi bilgileri hazırlanıyor...
          </div>
        </div>
      ) : (
        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* LEFT - copied visual structure from System Preparation */}
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">
                  Sipariş İçeriği
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedCount} / {rows.length} ürün seçildi
                </p>
              </div>

              <div className="flex items-center gap-2">
                {allSelected &&
                  rows.length > 0 && (
                    <Badge>
                      <Check className="mr-1 size-3" />
                      Hazır
                    </Badge>
                  )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={submitting}
                  onClick={addRow}
                >
                  <Plus className="size-4" />
                  Ürün Alanı Ekle
                </Button>
              </div>
            </div>

            {rows.map(
              (row, index) => {
                const product =
                  row.productId
                    ? productById.get(
                        row.productId
                      ) ?? null
                    : null;

                const rowTotalUsd =
                  product
                    ? roundMoney(
                        product.priceUsd *
                          row.quantity
                      )
                    : 0;

                const refreshing =
                  refreshingProductRowId ===
                  row.id;

                const subCategories =
                  getSubCategoryOptions(
                    row.category
                  );

                const subCategorySelectItems = [
                  {
                    value: "__all__",
                    label: "Tümü",
                  },
                  ...subCategories.map(
                    (option) => ({
                      value: option.value,
                      label: option.label,
                    })
                  ),
                ];

                return (
                  <Card key={row.id}>
                    <CardContent className="space-y-4 pt-6">
                      {/* SLOT HEADER */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold">
                            {index + 1}
                          </div>

                          <div className="min-w-0">
                            <div className="font-medium">
                              {row.label ||
                                "Yeni Ürün Alanı"}
                            </div>

                            <div className="mt-1 flex flex-wrap gap-2">
                              <Badge variant="outline">
                                Ek Alan
                              </Badge>

                              <Badge variant="secondary">
                                {row.quantity} adet
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-destructive hover:text-destructive"
                          disabled={submitting}
                          onClick={() =>
                            removeRow(row.id)
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>

                      {/* ROW SETTINGS - same grid/borders as System Preparation */}
                      <div className="grid gap-4 rounded-xl border bg-muted/10 p-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-2 md:col-span-2 xl:col-span-1">
                          <Label>
                            Alan Adı
                          </Label>

                          <Input
                            value={row.label}
                            disabled={submitting}
                            onChange={(event) =>
                              updateRow(
                                row.id,
                                {
                                  label:
                                    event.target.value,
                                }
                              )
                            }
                            placeholder="Örn: Multimedya"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>
                            Kategori
                          </Label>

                          <Select
                            items={
                              categorySelectItems
                            }
                            value={row.category}
                            disabled={submitting}
                            onValueChange={(value) => {
                              if (!value) {
                                return;
                              }

                              const nextCategory =
                                value as ProductCategory;

                              updateRow(
                                row.id,
                                {
                                  category:
                                    nextCategory,
                                  subCategory:
                                    undefined,
                                  productId: "",
                                }
                              );

                              /*
                               * Kullanıcı kategori seçtiği anda ürünleri arka
                               * planda hazırla; Ürün Seç butonuna basmasını
                               * bekleme.
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
                                (category) => (
                                  <SelectItem
                                    key={category.value}
                                    value={category.value}
                                  >
                                    {category.label}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>
                            Alt Kategori
                          </Label>

                          {subCategories.length > 0 ? (
                            <Select
                              items={
                                subCategorySelectItems
                              }
                              value={
                                row.subCategory ??
                                "__all__"
                              }
                              disabled={submitting}
                              onValueChange={(value) => {
                                const selectedValue =
                                  value ??
                                  "__all__";

                                updateRow(
                                  row.id,
                                  {
                                    subCategory:
                                      selectedValue ===
                                      "__all__"
                                        ? undefined
                                        : selectedValue,
                                    productId: "",
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
                                  (option) => (
                                    <SelectItem
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
                              Alt kategori yok
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>
                            Adet
                          </Label>

                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={row.quantity}
                            disabled={submitting}
                            onChange={(event) => {
                              const quantity =
                                Number(
                                  event.target.value
                                );

                              updateRow(
                                row.id,
                                {
                                  quantity:
                                    Number.isInteger(
                                      quantity
                                    ) &&
                                    quantity > 0
                                      ? quantity
                                      : 1,
                                }
                              );
                            }}
                          />
                        </div>
                      </div>

                      {/* PRODUCT AREA */}
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_150px] lg:items-end">
                        <div className="space-y-2">
                          <Label>
                            Ürün
                          </Label>

                          {product ? (
                            <div className="rounded-xl border bg-muted/20 p-3">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                  <div className="truncate font-medium">
                                    {product.brand} - {product.model}
                                  </div>

                                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                    <span>
                                      Kod:{" "}
                                      <span className="font-medium text-foreground">
                                        {product.productCode}
                                      </span>
                                    </span>

                                    <span>
                                      Birim:{" "}
                                      <span className="font-medium text-foreground">
                                        {formatUsd(
                                          product.priceUsd
                                        )}
                                      </span>
                                    </span>

                                    {effectiveRate > 0 && (
                                      <span>
                                        TL:{" "}
                                        <span className="font-medium text-foreground">
                                          {formatTry(
                                            product.priceUsd *
                                              effectiveRate
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
                                    submitting ||
                                    refreshing
                                  }
                                  onPointerEnter={() => {
                                    prefetchCategory(
                                      row.category
                                    );
                                  }}
                                  onFocus={() => {
                                    prefetchCategory(
                                      row.category
                                    );
                                  }}
                                  onClick={() => {
                                    void openProductSelection(
                                      row.id
                                    );
                                  }}
                                >
                                  {refreshing
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
                                submitting ||
                                refreshing
                              }
                              onPointerEnter={() => {
                                prefetchCategory(
                                  row.category
                                );
                              }}
                              onFocus={() => {
                                prefetchCategory(
                                  row.category
                                );
                              }}
                              onClick={() => {
                                void openProductSelection(
                                  row.id
                                );
                              }}
                            >
                              <div>
                                <div className="font-medium">
                                  {refreshing
                                    ? "Ürünler Yenileniyor..."
                                    : "Ürün Seç"}
                                </div>

                                <div className="mt-1 text-xs font-normal text-muted-foreground">
                                  {productCategoryDefinitions[
                                    row.category
                                  ]?.label ?? row.category}
                                  {row.subCategory
                                    ? ` • ${row.subCategory}`
                                    : ""}
                                  {" • "}
                                  {row.quantity} adet gerekli
                                </div>
                              </div>
                            </Button>
                          )}
                        </div>

                        <div className="rounded-lg border bg-muted/20 px-3 py-2.5 text-right">
                          <div className="text-xs text-muted-foreground">
                            Tutar
                          </div>

                          {product ? (
                            <>
                              <div className="font-semibold">
                                {formatUsd(
                                  rowTotalUsd
                                )}
                              </div>

                              {effectiveRate > 0 && (
                                <div className="mt-0.5 text-xs font-medium text-foreground">
                                  {formatTry(
                                    rowTotalUsd *
                                      effectiveRate
                                  )}
                                </div>
                              )}

                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {formatUsd(
                                  product.priceUsd
                                )}{" "}
                                × {row.quantity}
                              </div>
                            </>
                          ) : (
                            <div className="font-semibold text-muted-foreground">
                              -
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
            )}

            {rows.length === 0 && (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed text-center">
                <Package className="mb-3 size-8 text-muted-foreground" />

                <div className="font-medium">
                  Ürün alanı bulunmuyor
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  disabled={submitting}
                  onClick={addRow}
                >
                  <Plus className="size-4" />
                  Ürün Alanı Ekle
                </Button>
              </div>
            )}
          </div>

          {/* RIGHT SUMMARY - same sticky Card layout as System Preparation */}
          <div className="min-w-0">
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle className="text-base">
                  Sipariş Özeti
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Ürünler
                  </span>
                  <span className="font-medium">
                    {formatUsd(
                      purchaseTotalUsd
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Ürünler TL
                  </span>
                  <span className="font-medium">
                    {formatTry(
                      purchaseTotalTry
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Toplam Adet
                  </span>
                  <span className="font-medium">
                    {totalQuantity}
                  </span>
                </div>

                <div className="border-t" />

                <div className="space-y-2">
                  <Label>
                    Ödeme Yöntemi
                  </Label>

                  <Select
                    items={PAYMENT_ITEMS}
                    value={paymentMethod}
                    disabled={submitting}
                    onValueChange={(value) => {
                      const method:
                        SupplierPurchasePaymentMethod =
                          value ===
                          "customer_card"
                            ? "customer_card"
                            : value ===
                                "balance"
                              ? "balance"
                              : "card";

                      setPaymentMethod(
                        method
                      );

                      if (
                        method !==
                        "balance"
                      ) {
                        setBalanceUsedUsd(
                          "0"
                        );
                      }

                      if (
                        method !==
                        "customer_card"
                      ) {
                        setCustomerCardAmountTry(
                          ""
                        );
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="card">
                        Kendi Kartım
                      </SelectItem>
                      <SelectItem value="customer_card">
                        Müşteri Kartı
                      </SelectItem>
                      <SelectItem value="balance">
                        Bakiye + Kendi Kartım
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/30 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    {supplier} Bakiyesi
                  </span>
                  <span className="font-medium">
                    {formatUsd(
                      currentSupplierBalance
                    )}
                  </span>
                </div>

                {paymentMethod === "card" && (
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">
                      Kendi Kartımdan
                    </span>
                    <span className="font-semibold">
                      {formatUsd(
                        ownCardUsd
                      )}
                    </span>
                  </div>
                )}

                {paymentMethod ===
                  "balance" && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="bulkBalanceUsed">
                        Bakiyeden Kullanılacak ($)
                      </Label>

                      <Input
                        id="bulkBalanceUsed"
                        type="number"
                        min="0"
                        step="0.01"
                        value={balanceUsedUsd}
                        disabled={submitting}
                        onChange={(event) =>
                          setBalanceUsedUsd(
                            event.target.value
                          )
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Kendi Kartımdan
                      </span>
                      <span className="font-semibold">
                        {formatUsd(
                          ownCardUsd
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {paymentMethod ===
                  "customer_card" && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="bulkCustomerCardTry">
                        Müşteri Kartından Çekilen (TL)
                      </Label>

                      <Input
                        id="bulkCustomerCardTry"
                        type="number"
                        min="0"
                        step="0.01"
                        value={customerCardAmountTry}
                        disabled={submitting}
                        onChange={(event) =>
                          setCustomerCardAmountTry(
                            event.target.value
                          )
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Alış TL Karşılığı
                      </span>
                      <span className="font-medium">
                        {formatTry(
                          purchaseTotalTry
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/30 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">
                        Site Bakiyesinde Kalacak
                      </span>
                      <span className="font-semibold">
                        {formatUsd(
                          customerCardSurplusUsd
                        )}
                      </span>
                    </div>

                    {customerCardSurplusUsd > 0 &&
                      effectiveRate > 0 && (
                        <div className="text-right text-xs text-muted-foreground">
                          {formatTry(
                            customerCardSurplusTry
                          )}
                        </div>
                      )}
                  </div>
                )}

                <div className="border-t" />

                <div className="space-y-2">
                  <Label htmlFor="bulkOrderNote">
                    Not
                  </Label>

                  <Textarea
                    id="bulkOrderNote"
                    value={note}
                    rows={3}
                    disabled={submitting}
                    placeholder="Opsiyonel sipariş notu"
                    onChange={(event) =>
                      setNote(
                        event.target.value
                      )
                    }
                  />
                </div>

                <Button
                  type="button"
                  className="w-full"
                  disabled={
                    submitting ||
                    rows.length === 0 ||
                    !allSelected
                  }
                  onClick={() => {
                    void submit();
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Kaydediliyor...
                    </>
                  ) : (
                    <>
                      <Package className="size-4" />
                      Toplu Siparişi Stoklara Ekle
                    </>
                  )}
                </Button>

                <p className="text-center text-[11px] text-muted-foreground">
                  Her ürün stok hareketine ve tedarikçi sipariş geçmişine ayrı satır olarak kaydedilir.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {productSelectionRow && (
        <ProductSelectionDialog
          open={Boolean(
            productSelectionRowId
          )}
          onOpenChange={(open) => {
            if (!open) {
              setProductSelectionRowId(
                null
              );
            }
          }}
          products={
            productSelectionProducts
          }
          category={
            productSelectionRow.category
          }
          subCategory={
            productSelectionRow.subCategory
          }
          requiredQuantity={
            productSelectionRow.quantity
          }
          exchangeRate={
            effectiveRate
          }
          selectedProductId={
            productSelectionRow.productId ||
            undefined
          }
          onSelect={(product) => {
            updateRow(
              productSelectionRow.id,
              {
                productId:
                  product.id,
              }
            );

            setProductSelectionRowId(
              null
            );
          }}
          onClear={() => {
            updateRow(
              productSelectionRow.id,
              {
                productId: "",
              }
            );

            setProductSelectionRowId(
              null
            );
          }}
        />
      )}
    </div>
  );
}
