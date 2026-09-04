/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Filter,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import {
  Product,
  ProductSpecificationValue,
} from "@/types/product";

import {
  ProductCategoryDefinition,
  ProductFieldDefinition,
} from "@/lib/product-config";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

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

interface ProductTableProps {
  products: Product[];

  categoryDefinition:
    ProductCategoryDefinition;

  onEdit: (
    product: Product
  ) => void;

  onDelete: (
    product: Product
  ) => void;
}

type ColumnFilters = Record<
  string,
  string[]
>;

type PriceSortDirection =
  | "asc"
  | "desc"
  | null;

interface HeaderFilterProps {
  title: string;

  values: string[];

  selectedValues: string[];

  onChange: (
    values: string[]
  ) => void;
}

/*
 * EXCEL TARZI HEADER FILTER
 */
function HeaderFilter({
  title,
  values,
  selectedValues,
  onChange,
}: HeaderFilterProps) {
  const [
    search,
    setSearch,
  ] = useState("");

  const normalizedSearch =
    search
      .trim()
      .toLocaleLowerCase(
        "tr-TR"
      );

  const filteredValues =
    useMemo(() => {
      if (!normalizedSearch) {
        return values;
      }

      return values.filter(
        (value) =>
          value
            .toLocaleLowerCase(
              "tr-TR"
            )
            .includes(
              normalizedSearch
            )
      );
    }, [
      values,
      normalizedSearch,
    ]);

  const isFiltered =
    selectedValues.length > 0;

  const allVisibleSelected =
    filteredValues.length > 0 &&
    filteredValues.every(
      (value) =>
        selectedValues.includes(
          value
        )
    );

  const handleValueChange = (
    value: string,
    checked: boolean
  ) => {
    if (checked) {
      onChange(
        Array.from(
          new Set([
            ...selectedValues,
            value,
          ])
        )
      );

      return;
    }

    onChange(
      selectedValues.filter(
        (item) =>
          item !== value
      )
    );
  };

  const handleSelectAllVisible = (
    checked: boolean
  ) => {
    if (checked) {
      onChange(
        Array.from(
          new Set([
            ...selectedValues,
            ...filteredValues,
          ])
        )
      );

      return;
    }

    onChange(
      selectedValues.filter(
        (value) =>
          !filteredValues.includes(
            value
          )
      )
    );
  };

  return (
    <div className="flex items-center gap-1">
      <span>
        {title}
      </span>

      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`size-7 ${
                isFiltered
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            />
          }
        >
          <Filter
            className={`size-3.5 ${
              isFiltered
                ? "fill-current"
                : ""
            }`}
          />

          <span className="sr-only">
            {title} filtresi
          </span>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-64 p-0"
        >
          {/* FILTER HEADER */}
          <div className="border-b p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">
                {title}
              </span>

              {isFiltered && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={() =>
                    onChange([])
                  }
                >
                  <X className="size-3.5" />

                  <span className="sr-only">
                    Filtreyi temizle
                  </span>
                </Button>
              )}
            </div>

            <Input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target
                    .value
                )
              }
              placeholder="Ara..."
              className="h-8"
            />
          </div>

          {/* SELECT ALL */}
          <div className="border-b p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={
                  allVisibleSelected
                }
                onCheckedChange={(
                  checked
                ) =>
                  handleSelectAllVisible(
                    checked === true
                  )
                }
              />

              <span>
                Tümünü Seç
              </span>
            </label>
          </div>

          {/* VALUES */}
          <div className="max-h-64 overflow-y-auto p-2">
            {filteredValues.length ===
            0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                Sonuç bulunamadı.
              </div>
            ) : (
              filteredValues.map(
                (value) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                  >
                    <Checkbox
                      checked={selectedValues.includes(
                        value
                      )}
                      onCheckedChange={(
                        checked
                      ) =>
                        handleValueChange(
                          value,
                          checked ===
                            true
                        )
                      }
                    />

                    <span className="min-w-0 truncate">
                      {value}
                    </span>
                  </label>
                )
              )
            )}
          </div>

          {/* CLEAR */}
          {isFiltered && (
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() =>
                  onChange([])
                }
              >
                <X className="size-4" />

                Filtreyi Temizle
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/*
 * PRODUCT TABLE
 */
export function ProductTable({
  products,
  categoryDefinition,
  onEdit,
  onDelete,
}: ProductTableProps) {
  const [
    filters,
    setFilters,
  ] =
    useState<ColumnFilters>(
      {}
    );

  /*
   * PRICE SORT
   *
   * Fiyat kolonunda filtre yoktur.
   * Yalnızca artan / azalan sıralama yapılır.
   */
  const [
    priceSortDirection,
    setPriceSortDirection,
  ] =
    useState<PriceSortDirection>(
      null
    );

  const togglePriceSort =
    () => {
      setPriceSortDirection(
        (previous) => {
          if (
            previous ===
            null
          ) {
            return "asc";
          }

          if (
            previous ===
            "asc"
          ) {
            return "desc";
          }

          return null;
        }
      );
    };

  /*
   * Specification değerini
   * kullanıcıya gösterilecek
   * string'e dönüştürür.
   */
  const formatSpecificationValue = (
    value:
      | ProductSpecificationValue
      | undefined,
    field?: ProductFieldDefinition
  ): string => {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return "-";
    }

    /*
     * BOOLEAN
     */
    if (
      typeof value ===
      "boolean"
    ) {
      return value
        ? "Var"
        : "Yok";
    }

    /*
     * SELECT
     *
     * MongoDB'de örneğin:
     * channelCount = "4"
     *
     * UI:
     * 4 Kanal
     */
    if (
      field?.inputType ===
        "select" &&
      field.options
    ) {
      const option =
        field.options.find(
          (item) =>
            item.value ===
            String(value)
        );

      if (option) {
        return option.label;
      }
    }

    return String(value);
  };

  /*
   * Dinamik kategori kolonunun
   * değerini döndürür.
   */
  const getFieldValue = (
    product: Product,
    fieldKey: string,
    source:
      | "subCategory"
      | "specifications"
  ): string => {
    const field =
      categoryDefinition.fields.find(
        (item) =>
          item.key ===
          fieldKey
      );

    /*
     * Speaker subCategory
     */
    if (
      source ===
      "subCategory"
    ) {
      const value =
        product.subCategory;

      if (!value) {
        return "-";
      }

      const option =
        field?.options?.find(
          (item) =>
            item.value === value
        );

      return (
        option?.label ??
        value
      );
    }

    /*
     * Specifications
     */
    const value =
      product.specifications[
        fieldKey
      ];

    return formatSpecificationValue(
      value,
      field
    );
  };

  /*
   * Sabit kolonlar:
   *
   * productCode
   * brand
   * model
   */
  const getStaticColumnValue = (
    product: Product,
    columnKey: string
  ): string => {
    switch (columnKey) {
      case "productCode":
        return product.productCode;

      case "brand":
        return product.brand;

      case "model":
        return product.model;

      default:
        return "";
    }
  };

  /*
   * PRICE FORMAT
   */
  const formatPriceUsd = (
    value: number
  ) => {
    return new Intl.NumberFormat(
      "en-US",
      {
        style:
          "currency",
        currency:
          "USD",
        minimumFractionDigits:
          2,
        maximumFractionDigits:
          2,
      }
    ).format(
      Number.isFinite(
        value
      )
        ? value
        : 0
    );
  };

  /*
   * FILTER STATE
   */
  const setColumnFilter = (
    columnKey: string,
    values: string[]
  ) => {
    setFilters(
      (previous) => {
        const next = {
          ...previous,
        };

        if (
          values.length === 0
        ) {
          delete next[
            columnKey
          ];
        } else {
          next[columnKey] =
            values;
        }

        return next;
      }
    );
  };

  /*
   * Bir kolonun benzersiz
   * değerlerini çıkarır.
   *
   * Header filter içinde
   * kullanılır.
   */
  const getColumnValues = (
    columnKey: string,
    field?: ProductFieldDefinition
  ): string[] => {
    const values =
      products.map(
        (product) => {
          if (field) {
            return getFieldValue(
              product,
              field.key,
              field.source
            );
          }

          return getStaticColumnValue(
            product,
            columnKey
          );
        }
      );

    return Array.from(
      new Set(values)
    ).sort((a, b) =>
      a.localeCompare(
        b,
        "tr",
        {
          numeric: true,
          sensitivity: "base",
        }
      )
    );
  };

  /*
   * AKTİF FİLTRELERE GÖRE
   * ÜRÜNLER
   */
  const filteredProducts =
    useMemo(() => {
      return products.filter(
        (product) => {
          for (const [
            columnKey,
            selectedValues,
          ] of Object.entries(
            filters
          )) {
            if (
              selectedValues.length ===
              0
            ) {
              continue;
            }

            const dynamicField =
              categoryDefinition.fields.find(
                (field) =>
                  field.key ===
                  columnKey
              );

            const productValue =
              dynamicField
                ? getFieldValue(
                    product,
                    dynamicField.key,
                    dynamicField.source
                  )
                : getStaticColumnValue(
                    product,
                    columnKey
                  );

            if (
              !selectedValues.includes(
                productValue
              )
            ) {
              return false;
            }
          }

          return true;
        }
      );
    }, [
      products,
      filters,
      categoryDefinition,
    ]);

  /*
   * PRICE SORTED PRODUCTS
   */
  const sortedProducts =
    useMemo(() => {
      if (
        priceSortDirection ===
        null
      ) {
        return filteredProducts;
      }

      return [
        ...filteredProducts,
      ].sort(
        (
          first,
          second
        ) => {
          const firstPrice =
            Number(
              first.priceUsd
            ) || 0;

          const secondPrice =
            Number(
              second.priceUsd
            ) || 0;

          return priceSortDirection ===
            "asc"
            ? firstPrice -
                secondPrice
            : secondPrice -
                firstPrice;
        }
      );
    }, [
      filteredProducts,
      priceSortDirection,
    ]);

  const activeFilterCount =
    Object.values(
      filters
    ).filter(
      (values) =>
        values.length > 0
    ).length;

  const clearAllFilters =
    () => {
      setFilters({});
    };

  /*
   * BOŞ TABLO
   */
  if (
    products.length === 0
  ) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-8 text-center">
        <p className="font-medium">
          Henüz ürün bulunmuyor.
        </p>

        <p className="mt-1 text-sm text-muted-foreground">
          Bu kategoriye ilk
          ürününüzü
          ekleyebilirsiniz.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ACTIVE FILTER INFO */}
      {activeFilterCount >
        0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {
              activeFilterCount
            }{" "}
            aktif filtre
          </Badge>

          <span className="text-sm text-muted-foreground">
            {
              filteredProducts.length
            }{" "}
            / {products.length} ürün
          </span>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={
              clearAllFilters
            }
          >
            <X className="size-4" />

            Tüm Filtreleri
            Temizle
          </Button>
        </div>
      )}

      {/* TABLE */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {/* PRODUCT CODE */}
                <TableHead className="whitespace-nowrap">
                  <HeaderFilter
                    title="Ürün Kodu"
                    values={getColumnValues(
                      "productCode"
                    )}
                    selectedValues={
                      filters[
                        "productCode"
                      ] ?? []
                    }
                    onChange={(
                      values
                    ) =>
                      setColumnFilter(
                        "productCode",
                        values
                      )
                    }
                  />
                </TableHead>

                {/* BRAND */}
                <TableHead className="whitespace-nowrap">
                  <HeaderFilter
                    title="Marka"
                    values={getColumnValues(
                      "brand"
                    )}
                    selectedValues={
                      filters[
                        "brand"
                      ] ?? []
                    }
                    onChange={(
                      values
                    ) =>
                      setColumnFilter(
                        "brand",
                        values
                      )
                    }
                  />
                </TableHead>

                {/* MODEL */}
                <TableHead className="whitespace-nowrap">
                  <HeaderFilter
                    title="Model"
                    values={getColumnValues(
                      "model"
                    )}
                    selectedValues={
                      filters[
                        "model"
                      ] ?? []
                    }
                    onChange={(
                      values
                    ) =>
                      setColumnFilter(
                        "model",
                        values
                      )
                    }
                  />
                </TableHead>

                {/* SUPPLIERS */}
                <TableHead className="whitespace-nowrap">
                  Tedarikçi
                </TableHead>

                {/* PRICE - SORT ONLY */}
                <TableHead className="whitespace-nowrap text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="-mr-2 h-8 gap-1.5 px-2 font-medium"
                    onClick={
                      togglePriceSort
                    }
                  >
                    Fiyat (USD)

                    {priceSortDirection ===
                    "asc" ? (
                      <ArrowUp className="size-3.5" />
                    ) : priceSortDirection ===
                      "desc" ? (
                      <ArrowDown className="size-3.5" />
                    ) : (
                      <ArrowUpDown className="size-3.5 text-muted-foreground" />
                    )}

                    <span className="sr-only">
                      Fiyata göre sırala
                    </span>
                  </Button>
                </TableHead>

                {/* DYNAMIC COLUMNS */}
                {categoryDefinition.fields.map(
                  (field) => (
                    <TableHead
                      key={
                        field.key
                      }
                      className="whitespace-nowrap"
                    >
                      <HeaderFilter
                        title={
                          field.label
                        }
                        values={getColumnValues(
                          field.key,
                          field
                        )}
                        selectedValues={
                          filters[
                            field.key
                          ] ?? []
                        }
                        onChange={(
                          values
                        ) =>
                          setColumnFilter(
                            field.key,
                            values
                          )
                        }
                      />
                    </TableHead>
                  )
                )}

                {/* ACTIONS */}
                <TableHead className="w-[100px] whitespace-nowrap text-right">
                  İşlemler
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {/* NO FILTER RESULT */}
              {sortedProducts.length ===
              0 ? (
                <TableRow>
                  <TableCell
                    colSpan={
                      5 +
                      categoryDefinition
                        .fields.length
                    }
                    className="h-40 text-center"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Filter className="size-5 text-muted-foreground" />

                      <span className="text-sm font-medium">
                        Filtreye uygun
                        ürün bulunamadı.
                      </span>

                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={
                          clearAllFilters
                        }
                      >
                        Filtreleri
                        temizle
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedProducts.map(
                  (product) => (
                    <TableRow
                      key={
                        product.id
                      }
                    >
                      {/* PRODUCT CODE */}
                      <TableCell className="whitespace-nowrap font-medium">
                        {
                          product.productCode
                        }
                      </TableCell>

                      {/* BRAND */}
                      <TableCell className="whitespace-nowrap">
                        {
                          product.brand
                        }
                      </TableCell>

                      {/* MODEL */}
                      <TableCell className="whitespace-nowrap">
                        {
                          product.model
                        }
                      </TableCell>

                      {/* SUPPLIERS */}
                      <TableCell>
                        <div className="flex min-w-36 flex-wrap gap-1">
                          {(product.suppliers?.length
                            ? product.suppliers
                            : ["EGB"]
                          ).map((supplier) => (
                            <Badge
                              key={supplier}
                              variant="secondary"
                            >
                              {supplier}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>

                      {/* PRICE */}
                      <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                        {formatPriceUsd(
                          Number(
                            product.priceUsd
                          ) || 0
                        )}
                      </TableCell>

                      {/* DYNAMIC VALUES */}
                      {categoryDefinition.fields.map(
                        (field) => {
                          const value =
                            getFieldValue(
                              product,
                              field.key,
                              field.source
                            );

                          /*
                           * BOOLEAN
                           */
                          const rawValue =
                            field.source ===
                            "specifications"
                              ? product
                                  .specifications[
                                  field.key
                                ]
                              : undefined;

                          const isBoolean =
                            typeof rawValue ===
                            "boolean";

                          return (
                            <TableCell
                              key={
                                field.key
                              }
                              className="whitespace-nowrap"
                            >
                              {/* SUB CATEGORY */}
                              {field.source ===
                              "subCategory" ? (
                                <Badge variant="secondary">
                                  {
                                    value
                                  }
                                </Badge>
                              ) : isBoolean ? (
                                /*
                                 * BOOLEAN BADGE
                                 */
                                <Badge
                                  variant={
                                    rawValue
                                      ? "default"
                                      : "outline"
                                  }
                                >
                                  {
                                    value
                                  }
                                </Badge>
                              ) : (
                                /*
                                 * NORMAL SPECIFICATION
                                 */
                                <>
                                  {
                                    value
                                  }

                                  {value !==
                                    "-" &&
                                    field.unit && (
                                      <span className="ml-1 text-muted-foreground">
                                        {
                                          field.unit
                                        }
                                      </span>
                                    )}
                                </>
                              )}
                            </TableCell>
                          );
                        }
                      )}

                      {/* ACTIONS */}
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Düzenle"
                            onClick={() =>
                              onEdit(
                                product
                              )
                            }
                          >
                            <Pencil className="size-4" />

                            <span className="sr-only">
                              Düzenle
                            </span>
                          </Button>

                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Sil"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() =>
                              onDelete(
                                product
                              )
                            }
                          >
                            <Trash2 className="size-4" />

                            <span className="sr-only">
                              Sil
                            </span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                )
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}