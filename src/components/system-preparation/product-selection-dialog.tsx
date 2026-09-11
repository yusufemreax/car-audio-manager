"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  Check,
  Filter,
  PackageSearch,
  Search,
  X,
} from "lucide-react";

import {
  Product,
  ProductCategory,
} from "@/types/product";

import {
  ProductFieldDefinition,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/*
 * =========================================================
 * TYPES
 * =========================================================
 */

interface ProductSelectionDialogProps {
  open: boolean;

  onOpenChange:
    (open: boolean) => void;

  products:
    Product[];

  category:
    ProductCategory;

  subCategory?: string;

  requiredQuantity:
    number;

  exchangeRate:
    number;

  selectedProductId?: string;

  onSelect:
    (
      product:
        Product
    ) => void;

  onClear?: () => void;
}

interface FilterOption {
  value: string;
  label: string;
}

type ColumnFilters =
  Record<
    string,
    string[]
  >;

interface HeaderFilterProps {
  title: string;

  options:
    FilterOption[];

  selectedValues:
    string[];

  onChange:
    (
      values: string[]
    ) => void;
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
 * NORMALIZE
 * =========================================================
 */

function normalize(
  value:
    string |
    number |
    boolean |
    null |
    undefined
) {
  return String(
    value ?? ""
  )
    .trim()
    .toLocaleLowerCase(
      "tr-TR"
    );
}

/*
 * =========================================================
 * PRODUCT FIELD DISPLAY VALUE
 * =========================================================
 */

function getProductFieldValue(
  product:
    Product,

  field:
    ProductFieldDefinition
): string {
  /*
   * SUB CATEGORY
   */
  if (
    field.source ===
    "subCategory"
  ) {
    const rawValue =
      product.subCategory ??
      "";

    if (
      !rawValue
    ) {
      return "-";
    }

    const option =
      field.options?.find(
        (
          item
        ) =>
          item.value ===
          rawValue
      );

    return (
      option?.label ??
      rawValue
    );
  }

  /*
   * SPECIFICATION
   */
  const rawValue =
    product.specifications?.[
      field.key
    ];

  if (
    rawValue ===
      undefined ||
    rawValue ===
      null ||
    rawValue ===
      ""
  ) {
    return "-";
  }

  /*
   * BOOLEAN
   */
  if (
    field.inputType ===
    "boolean"
  ) {
    return rawValue ===
      true
      ? "Var"
      : "Yok";
  }

  /*
   * SELECT
   */
  if (
    field.inputType ===
    "select"
  ) {
    const option =
      field.options?.find(
        (
          item
        ) =>
          item.value ===
          String(
            rawValue
          )
      );

    if (
      option
    ) {
      return option.label;
    }
  }

  /*
   * NUMBER
   */
  if (
    field.inputType ===
      "number" &&
    field.unit
  ) {
    return `${rawValue} ${field.unit}`;
  }

  return String(
    rawValue
  );
}

/*
 * =========================================================
 * UNIQUE OPTIONS
 * =========================================================
 */

function getUniqueOptions(
  values:
    string[]
): FilterOption[] {
  const unique =
    Array.from(
      new Set(
        values.filter(
          (
            value
          ) =>
            value !==
            undefined &&
            value !==
            null &&
            String(
              value
            ).trim() !==
            ""
        )
      )
    );

  return unique
    .sort(
      (
        first,
        second
      ) =>
        first.localeCompare(
          second,
          "tr",
          {
            numeric: true,
            sensitivity:
              "base",
          }
        )
    )
    .map(
      (
        value
      ) => ({
        value,
        label:
          value,
      })
    );
}

/*
 * =========================================================
 * EXCEL STYLE HEADER FILTER
 * =========================================================
 */

function HeaderFilter({
  title,
  options,
  selectedValues,
  onChange,
}: HeaderFilterProps) {
  const [
    search,
    setSearch,
  ] =
    useState("");

  const filteredOptions =
    useMemo(() => {
      const query =
        normalize(
          search
        );

      if (
        !query
      ) {
        return options;
      }

      return options.filter(
        (
          option
        ) =>
          normalize(
            option.label
          ).includes(
            query
          )
      );
    }, [
      options,
      search,
    ]);

  const hasFilter =
    selectedValues.length >
    0;

  const allVisibleSelected =
    filteredOptions.length >
      0 &&
    filteredOptions.every(
      (
        option
      ) =>
        selectedValues.includes(
          option.value
        )
    );

  const toggleValue = (
    value: string,
    checked: boolean
  ) => {
    if (
      checked
    ) {
      if (
        selectedValues.includes(
          value
        )
      ) {
        return;
      }

      onChange([
        ...selectedValues,
        value,
      ]);

      return;
    }

    onChange(
      selectedValues.filter(
        (
          item
        ) =>
          item !==
          value
      )
    );
  };

  const selectVisible =
    () => {
      const next =
        new Set(
          selectedValues
        );

      filteredOptions.forEach(
        (
          option
        ) => {
          next.add(
            option.value
          );
        }
      );

      onChange(
        Array.from(
          next
        )
      );
    };

  const clearVisible =
    () => {
      const visibleValues =
        new Set(
          filteredOptions.map(
            (
              option
            ) =>
              option.value
          )
        );

      onChange(
        selectedValues.filter(
          (
            value
          ) =>
            !visibleValues.has(
              value
            )
        )
      );
    };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`
              size-7
              shrink-0
              ${
                hasFilter
                  ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                  : "text-muted-foreground"
              }
            `}
          />
        }
      >
        <Filter className="size-3.5" />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-72 p-0"
      >
        {/* HEADER */}

        <div className="border-b px-3 py-3">
          <div className="text-sm font-semibold">
            {title}
          </div>

          <div className="mt-2 relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event
                    .target
                    .value
                )
              }
              placeholder="Ara..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        {/* ALL / CLEAR */}

        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={
              allVisibleSelected
                ? clearVisible
                : selectVisible
            }
          >
            {allVisibleSelected
              ? "Görünenleri Kaldır"
              : "Görünenleri Seç"}
          </button>

          {selectedValues.length >
            0 && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() =>
                onChange(
                  []
                )
              }
            >
              Temizle
            </button>
          )}
        </div>

        {/* OPTIONS */}

        <div className="max-h-64 overflow-y-auto p-2">
          {filteredOptions.length ===
          0 ? (
            <div className="px-2 py-6 text-center text-xs text-muted-foreground">
              Sonuç bulunamadı.
            </div>
          ) : (
            filteredOptions.map(
              (
                option
              ) => {
                const checked =
                  selectedValues.includes(
                    option.value
                  );

                return (
                  <label
                    key={
                      option.value
                    }
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      checked={
                        checked
                      }
                      onCheckedChange={(
                        value
                      ) =>
                        toggleValue(
                          option.value,
                          value ===
                            true
                        )
                      }
                    />

                    <span className="min-w-0 flex-1 truncate">
                      {
                        option.label
                      }
                    </span>
                  </label>
                );
              }
            )
          )}
        </div>

        {/* SELECTED COUNT */}

        {selectedValues.length >
          0 && (
          <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
            {
              selectedValues.length
            } değer seçildi
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/*
 * =========================================================
 * COMPONENT
 * =========================================================
 */

export function ProductSelectionDialog({
  open,
  onOpenChange,
  products,
  category,
  subCategory,
  requiredQuantity,
  exchangeRate,
  selectedProductId,
  onSelect,
  onClear,
}: ProductSelectionDialogProps) {
  /*
   * =======================================================
   * STATE
   * =======================================================
   */

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    columnFilters,
    setColumnFilters,
  ] =
    useState<ColumnFilters>(
      {}
    );

  /*
   * =======================================================
   * CATEGORY
   * =======================================================
   */

  const categoryDefinition =
    productCategoryDefinitions[
      category
    ];

  /*
   * =======================================================
   * TABLE FIELDS
   * =======================================================
   */

  const tableFields =
    useMemo(
      () =>
        categoryDefinition
          ?.fields ??
        [],
      [
        categoryDefinition,
      ]
    );

  /*
   * =======================================================
   * CATEGORY PRODUCTS
   *
   * Burada sadece popup'a ait kategori /
   * alt kategori ürünlerini çıkarıyoruz.
   *
   * Sistem hazırlama aşamasında stok kontrolü yapılmaz.
   * Katalogdaki tüm uygun ürünler seçilebilir.
   * =======================================================
   */

  const categoryProducts =
    useMemo(
      () =>
        products.filter(
          (
            product
          ) => {
            if (
              product.category !==
              category
            ) {
              return false;
            }

            if (
              subCategory &&
              product.subCategory !==
                subCategory
            ) {
              return false;
            }

            return true;
          }
        ),
      [
        products,
        category,
        subCategory,
      ]
    );

  /*
   * =======================================================
   * FILTER OPTIONS
   * =======================================================
   */

  const filterOptions =
    useMemo(() => {
      const result:
        Record<
          string,
          FilterOption[]
        > = {};

      /*
       * PRODUCT CODE
       */
      result.productCode =
        getUniqueOptions(
          categoryProducts.map(
            (
              product
            ) =>
              product.productCode
          )
        );

      /*
       * BRAND
       */
      result.brand =
        getUniqueOptions(
          categoryProducts.map(
            (
              product
            ) =>
              product.brand
          )
        );

      /*
       * MODEL
       */
      result.model =
        getUniqueOptions(
          categoryProducts.map(
            (
              product
            ) =>
              product.model
          )
        );

      /*
       * USD
       */
      result.usd =
        getUniqueOptions(
          categoryProducts.map(
            (
              product
            ) =>
              formatUsd(
                product.priceUsd
              )
          )
        );

      /*
       * TRY
       */
      result.try =
        getUniqueOptions(
          categoryProducts.map(
            (
              product
            ) =>
              formatTry(
                product.priceUsd *
                  exchangeRate
              )
          )
        );

      /*
       * DYNAMIC FIELDS
       */
      tableFields.forEach(
        (
          field
        ) => {
          result[
            `field:${field.key}`
          ] =
            getUniqueOptions(
              categoryProducts.map(
                (
                  product
                ) =>
                  getProductFieldValue(
                    product,
                    field
                  )
              )
            );
        }
      );

      return result;
    }, [
      categoryProducts,
      tableFields,
      exchangeRate,
    ]);

  /*
   * =======================================================
   * UPDATE COLUMN FILTER
   * =======================================================
   */

  const updateColumnFilter =
    (
      key: string,
      values: string[]
    ) => {
      setColumnFilters(
        (
          previous
        ) => {
          const next = {
            ...previous,
          };

          if (
            values.length ===
            0
          ) {
            delete next[
              key
            ];

            return next;
          }

          next[
            key
          ] = values;

          return next;
        }
      );
    };

  /*
   * =======================================================
   * ACTIVE FILTER COUNT
   * =======================================================
   */

  const activeFilterCount =
    useMemo(
      () =>
        Object.values(
          columnFilters
        ).filter(
          (
            values
          ) =>
            values.length >
            0
        ).length,
      [
        columnFilters,
      ]
    );

  /*
   * =======================================================
   * FILTER PRODUCTS
   * =======================================================
   */

  const filteredProducts =
    useMemo(() => {
      const globalSearch =
        normalize(
          search
        );

      return categoryProducts
        .filter(
          (
            product
          ) => {
            /*
             * ===============================================
             * GLOBAL SEARCH
             * ===============================================
             */

            if (
              globalSearch
            ) {
              const dynamicValues =
                tableFields.map(
                  (
                    field
                  ) =>
                    getProductFieldValue(
                      product,
                      field
                    )
                );

              const searchable =
                normalize(
                  [
                    product.productCode,
                    product.brand,
                    product.model,
                    ...dynamicValues,
                    product.priceUsd,
                    product.priceUsd *
                      exchangeRate,
                  ].join(
                    " "
                  )
                );

              if (
                !searchable.includes(
                  globalSearch
                )
              ) {
                return false;
              }
            }

            /*
             * ===============================================
             * PRODUCT CODE
             * ===============================================
             */

            const codeFilters =
              columnFilters
                .productCode ??
              [];

            if (
              codeFilters.length >
                0 &&
              !codeFilters.includes(
                product.productCode
              )
            ) {
              return false;
            }

            /*
             * ===============================================
             * BRAND
             * ===============================================
             */

            const brandFilters =
              columnFilters
                .brand ??
              [];

            if (
              brandFilters.length >
                0 &&
              !brandFilters.includes(
                product.brand
              )
            ) {
              return false;
            }

            /*
             * ===============================================
             * MODEL
             * ===============================================
             */

            const modelFilters =
              columnFilters
                .model ??
              [];

            if (
              modelFilters.length >
                0 &&
              !modelFilters.includes(
                product.model
              )
            ) {
              return false;
            }

            /*
             * ===============================================
             * USD
             * ===============================================
             */

            const usdFilters =
              columnFilters
                .usd ??
              [];

            if (
              usdFilters.length >
                0 &&
              !usdFilters.includes(
                formatUsd(
                  product.priceUsd
                )
              )
            ) {
              return false;
            }

            /*
             * ===============================================
             * TRY
             * ===============================================
             */

            const tryFilters =
              columnFilters
                .try ??
              [];

            if (
              tryFilters.length >
                0 &&
              !tryFilters.includes(
                formatTry(
                  product.priceUsd *
                    exchangeRate
                )
              )
            ) {
              return false;
            }

            /*
             * ===============================================
             * DYNAMIC FIELDS
             * ===============================================
             */

            for (
              const field of
              tableFields
            ) {
              const key =
                `field:${field.key}`;

              const filters =
                columnFilters[
                  key
                ] ?? [];

              if (
                filters.length ===
                0
              ) {
                continue;
              }

              const value =
                getProductFieldValue(
                  product,
                  field
                );

              if (
                !filters.includes(
                  value
                )
              ) {
                return false;
              }
            }

            return true;
          }
        )
        .sort(
          (
            first,
            second
          ) => {
            const brandCompare =
              first.brand.localeCompare(
                second.brand,
                "tr",
                {
                  sensitivity:
                    "base",
                }
              );

            if (
              brandCompare !==
              0
            ) {
              return brandCompare;
            }

            return first.model.localeCompare(
              second.model,
              "tr",
              {
                sensitivity:
                  "base",
              }
            );
          }
        );
    }, [
      categoryProducts,
      search,
      columnFilters,
      tableFields,
      exchangeRate,
    ]);

  /*
   * =======================================================
   * SELECT PRODUCT
   * =======================================================
   */

  const handleSelect =
    (
      product:
        Product
    ) => {
      if (
        product.sourceUnavailable ===
        true
      ) {
        return;
      }

      onSelect(
        product
      );

      onOpenChange(
        false
      );

      setSearch(
        ""
      );

      setColumnFilters(
        {}
      );
    };

  /*
   * =======================================================
   * CLOSE
   * =======================================================
   */

  const handleOpenChange =
    (
      value:
        boolean
    ) => {
      onOpenChange(
        value
      );

      if (
        !value
      ) {
        setSearch(
          ""
        );

        setColumnFilters(
          {}
        );
      }
    };

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <Dialog
      open={
        open
      }
      onOpenChange={
        handleOpenChange
      }
    >
      <DialogContent
        className="
          flex
          max-h-[92vh]
          flex-col
          overflow-hidden
          sm:max-w-[96vw]
          2xl:max-w-[1500px]
        "
      >
        {/* =================================================
            HEADER
        ================================================= */}

        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <PackageSearch className="size-5" />

            Ürün Seç
          </DialogTitle>

          <DialogDescription>
            <strong>
              {
                categoryDefinition
                  ?.label
              }
            </strong>{" "}
            ürünlerini özellik ve
            fiyat bilgilerine göre
            karşılaştırarak
            seçebilirsiniz.
          </DialogDescription>
        </DialogHeader>

        {/* =================================================
            TOP BAR
        ================================================= */}

        <div className="flex shrink-0 flex-col gap-3 border-b pb-4 lg:flex-row lg:items-center lg:justify-between">
          {/* GLOBAL SEARCH */}

          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event
                    .target
                    .value
                )
              }
              placeholder="Ürünlerde ara..."
              className="pl-9"
            />
          </div>

          {/* INFO */}

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-md border bg-muted/20 px-2.5 py-1.5 text-xs text-muted-foreground">
              <strong className="text-foreground">
                {
                  filteredProducts.length
                }
              </strong>{" "}
              ürün
            </div>

            <div className="rounded-md border bg-muted/20 px-2.5 py-1.5 text-xs text-muted-foreground">
              İhtiyaç:{" "}

              <strong className="text-foreground">
                {
                  requiredQuantity
                }{" "}
                adet
              </strong>
            </div>

            {activeFilterCount >
              0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setColumnFilters(
                    {}
                  )
                }
              >
                <X className="size-3.5" />

                Filtreleri Temizle

                <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">
                  {
                    activeFilterCount
                  }
                </span>
              </Button>
            )}
          </div>
        </div>

        {/* =================================================
            TABLE CONTAINER

            Sadece tablo scroll olur.
            Popup scroll olmaz.

            ~10 satır görünür.
        ================================================= */}

        <div className="min-h-0 w-full overflow-hidden rounded-xl border">
          <div
            className="
              h-[min(620px,calc(100vh-320px))]
              min-h-[360px]
              w-full
              overflow-auto
              overscroll-contain
            "
          >
            <Table className="min-w-max">
              {/* =============================================
                  HEADER
              ============================================= */}

              <TableHeader className="sticky top-0 z-30 bg-background shadow-[0_1px_0_0_hsl(var(--border))]">
                <TableRow className="hover:bg-background">
                  {/* CODE */}

                  <TableHead className="sticky left-0 z-40 min-w-32 bg-background">
                    <div className="flex items-center justify-between gap-1">
                      <span>
                        Kod
                      </span>

                      <HeaderFilter
                        title="Ürün Kodu"
                        options={
                          filterOptions
                            .productCode ??
                          []
                        }
                        selectedValues={
                          columnFilters
                            .productCode ??
                          []
                        }
                        onChange={(
                          values
                        ) =>
                          updateColumnFilter(
                            "productCode",
                            values
                          )
                        }
                      />
                    </div>
                  </TableHead>

                  {/* BRAND */}

                  <TableHead className="min-w-36">
                    <div className="flex items-center justify-between gap-1">
                      <span>
                        Marka
                      </span>

                      <HeaderFilter
                        title="Marka"
                        options={
                          filterOptions
                            .brand ??
                          []
                        }
                        selectedValues={
                          columnFilters
                            .brand ??
                          []
                        }
                        onChange={(
                          values
                        ) =>
                          updateColumnFilter(
                            "brand",
                            values
                          )
                        }
                      />
                    </div>
                  </TableHead>

                  {/* MODEL */}

                  <TableHead className="min-w-44">
                    <div className="flex items-center justify-between gap-1">
                      <span>
                        Model
                      </span>

                      <HeaderFilter
                        title="Model"
                        options={
                          filterOptions
                            .model ??
                          []
                        }
                        selectedValues={
                          columnFilters
                            .model ??
                          []
                        }
                        onChange={(
                          values
                        ) =>
                          updateColumnFilter(
                            "model",
                            values
                          )
                        }
                      />
                    </div>
                  </TableHead>

                  {/* DYNAMIC FIELDS */}

                  {tableFields.map(
                    (
                      field
                    ) => {
                      const filterKey =
                        `field:${field.key}`;

                      return (
                        <TableHead
                          key={
                            field.key
                          }
                          className="min-w-32"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="whitespace-nowrap">
                              {
                                field.label
                              }

                              {field.unit
                                ? ` (${field.unit})`
                                : ""}
                            </span>

                            <HeaderFilter
                              title={
                                field.label
                              }
                              options={
                                filterOptions[
                                  filterKey
                                ] ?? []
                              }
                              selectedValues={
                                columnFilters[
                                  filterKey
                                ] ?? []
                              }
                              onChange={(
                                values
                              ) =>
                                updateColumnFilter(
                                  filterKey,
                                  values
                                )
                              }
                            />
                          </div>
                        </TableHead>
                      );
                    }
                  )}

                  {/* USD */}

                  <TableHead className="min-w-32">
                    <div className="flex items-center justify-end gap-1">
                      <span>
                        USD
                      </span>

                      <HeaderFilter
                        title="USD Fiyat"
                        options={
                          filterOptions
                            .usd ??
                          []
                        }
                        selectedValues={
                          columnFilters
                            .usd ??
                          []
                        }
                        onChange={(
                          values
                        ) =>
                          updateColumnFilter(
                            "usd",
                            values
                          )
                        }
                      />
                    </div>
                  </TableHead>

                  {/* TRY */}

                  <TableHead className="min-w-36">
                    <div className="flex items-center justify-end gap-1">
                      <span>
                        TL
                      </span>

                      <HeaderFilter
                        title="TL Fiyat"
                        options={
                          filterOptions
                            .try ??
                          []
                        }
                        selectedValues={
                          columnFilters
                            .try ??
                          []
                        }
                        onChange={(
                          values
                        ) =>
                          updateColumnFilter(
                            "try",
                            values
                          )
                        }
                      />
                    </div>
                  </TableHead>

                  {/* ACTION */}

                  <TableHead className="sticky right-0 z-40 min-w-28 bg-background text-right">
                    İşlem
                  </TableHead>
                </TableRow>
              </TableHeader>

              {/* =============================================
                  BODY
              ============================================= */}

              <TableBody>
                {filteredProducts.length ===
                0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={
                        6 +
                        tableFields.length
                      }
                      className="h-52 text-center"
                    >
                      <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                        <PackageSearch className="size-8 opacity-50" />

                        <div>
                          Uygun ürün
                          bulunamadı.
                        </div>

                        {(activeFilterCount >
                          0 ||
                          search) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSearch(
                                ""
                              );

                              setColumnFilters(
                                {}
                              );
                            }}
                          >
                            Filtreleri
                            Temizle
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map(
                    (
                      product
                    ) => {
                      const selected =
                        product.id ===
                        selectedProductId;

                      const unavailable =
                        product.sourceUnavailable ===
                        true;

                      const tryPrice =
                        product.priceUsd *
                        exchangeRate;

                      return (
                        <TableRow
                          key={
                            product.id
                          }
                          className={
                            unavailable
                              ? "opacity-55 cursor-not-allowed"
                              : selected
                                ? "bg-muted/60"
                                : undefined
                          }
                        >
                          {/* CODE */}

                          <TableCell
                            className={`
                              sticky
                              left-0
                              z-10
                              h-13
                              whitespace-nowrap
                              bg-background
                              font-mono
                              text-xs
                              font-medium
                              ${
                                selected
                                  ? "bg-muted"
                                  : ""
                              }
                            `}
                          >
                            {
                              product.productCode
                            }
                          </TableCell>

                          {/* BRAND */}

                          <TableCell className="h-13 whitespace-nowrap font-medium">
                            {
                              product.brand
                            }
                          </TableCell>

                          {/* MODEL */}

                          <TableCell className="h-13 whitespace-nowrap">
                            <div>
                              {product.model}
                            </div>
                            {unavailable ? (
                              <div className="mt-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                                Satışta değil · EGB sayfası bulunamadı (404)
                              </div>
                            ) : null}
                          </TableCell>

                          {/* DYNAMIC */}

                          {tableFields.map(
                            (
                              field
                            ) => (
                              <TableCell
                                key={
                                  field.key
                                }
                                className="h-13 whitespace-nowrap text-sm"
                              >
                                {getProductFieldValue(
                                  product,
                                  field
                                )}
                              </TableCell>
                            )
                          )}

                          {/* USD */}

                          <TableCell className="h-13 whitespace-nowrap text-right font-medium tabular-nums">
                            {formatUsd(
                              product.priceUsd
                            )}
                          </TableCell>

                          {/* TRY */}

                          <TableCell className="h-13 whitespace-nowrap text-right font-medium tabular-nums">
                            {exchangeRate >
                            0
                              ? formatTry(
                                  tryPrice
                                )
                              : "-"}
                          </TableCell>

                          {/* ACTION */}

                          <TableCell
                            className={`
                              sticky
                              right-0
                              z-10
                              h-13
                              bg-background
                              text-right
                              ${
                                selected
                                  ? "bg-muted"
                                  : ""
                              }
                            `}
                          >
                            <Button
                              type="button"
                              size="sm"
                              variant={
                                selected
                                  ? "secondary"
                                  : "default"
                              }
                              disabled={
                                unavailable
                              }
                              onClick={() =>
                                handleSelect(
                                  product
                                )
                              }
                            >
                              {unavailable ? (
                                "Seçilemez"
                              ) : selected ? (
                                <>
                                  <Check className="size-4" />

                                  Seçili
                                </>
                              ) : (
                                "Seç"
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    }
                  )
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* =================================================
            FOOTER
        ================================================= */}

        <DialogFooter className="shrink-0 border-t pt-4">
          {selectedProductId &&
            onClear && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onClear();

                  setSearch(
                    ""
                  );

                  setColumnFilters(
                    {}
                  );

                  onOpenChange(
                    false
                  );
                }}
              >
                <X className="size-4" />

                Seçimi Kaldır
              </Button>
            )}

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              handleOpenChange(
                false
              )
            }
          >
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}