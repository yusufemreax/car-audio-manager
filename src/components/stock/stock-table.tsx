"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  Filter,
  Minus,
  Plus,
  X,
} from "lucide-react";

import {
  InventoryProduct,
} from "@/types/inventory";

import {
  ProductSpecificationValue,
} from "@/types/product";

import {
  ProductCategoryDefinition,
  ProductFieldDefinition,
} from "@/lib/product-config";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type ColumnFilters =
  Record<string, string[]>;

interface HeaderFilterProps {
  title: string;

  values: string[];

  selectedValues: string[];

  onChange: (
    values: string[]
  ) => void;
}

interface StockTableProps {
  products:
    InventoryProduct[];

  categoryDefinition:
    ProductCategoryDefinition;

  usdTryRate:
    | number
    | null;

  onStockIn: (
    product: InventoryProduct
  ) => void;

  onStockOut: (
    product: InventoryProduct
  ) => void;
}

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

  const handleSelectAll = (
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
        (item) =>
          !filteredValues.includes(
            item
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
          <div className="border-b p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">
                {title}
              </span>

              {isFiltered && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() =>
                    onChange([])
                  }
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>

            <Input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Ara..."
              className="h-8"
            />
          </div>

          <div className="border-b p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={
                  allVisibleSelected
                }
                onCheckedChange={(
                  checked
                ) =>
                  handleSelectAll(
                    checked === true
                  )
                }
              />

              Tümünü Seç
            </label>
          </div>

          <div className="max-h-64 overflow-y-auto p-2">
            {filteredValues.length ===
            0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Sonuç bulunamadı.
              </div>
            ) : (
              filteredValues.map(
                (value) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
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

                    <span className="truncate">
                      {value}
                    </span>
                  </label>
                )
              )
            )}
          </div>

          {isFiltered && (
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start"
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

export function StockTable({
  products,
  categoryDefinition,
  usdTryRate,
  onStockIn,
  onStockOut,
}: StockTableProps) {
  const [
    filters,
    setFilters,
  ] =
    useState<ColumnFilters>(
      {}
    );

  const formatSpecificationValue = (
    value:
      | ProductSpecificationValue
      | undefined,
    field?:
      ProductFieldDefinition
  ): string => {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return "-";
    }

    if (
      typeof value ===
      "boolean"
    ) {
      return value
        ? "Var"
        : "Yok";
    }

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

  const getFieldValue = (
    product:
      InventoryProduct,
    field:
      ProductFieldDefinition
  ) => {
    if (
      field.source ===
      "subCategory"
    ) {
      const value =
        product.subCategory;

      if (!value) {
        return "-";
      }

      const option =
        field.options?.find(
          (item) =>
            item.value === value
        );

      return (
        option?.label ??
        value
      );
    }

    return formatSpecificationValue(
      product.specifications[
        field.key
      ],
      field
    );
  };

  const getStaticValue = (
    product:
      InventoryProduct,
    key: string
  ): string => {
    switch (key) {
      case "productCode":
        return product.productCode;

      case "brand":
        return product.brand;

      case "model":
        return product.model;

      case "priceUsd":
        return String(
          product.priceUsd
        );

      case "stockQuantity":
        return String(
          product.stockQuantity
        );

      default:
        return "";
    }
  };

  const setColumnFilter = (
    key: string,
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
          delete next[key];
        } else {
          next[key] =
            values;
        }

        return next;
      }
    );
  };

  const getColumnValues = (
    key: string,
    field?:
      ProductFieldDefinition
  ) => {
    const values =
      products.map(
        (product) =>
          field
            ? getFieldValue(
                product,
                field
              )
            : getStaticValue(
                product,
                key
              )
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

  const filteredProducts =
    useMemo(() => {
      return products.filter(
        (product) => {
          for (const [
            key,
            selectedValues,
          ] of Object.entries(
            filters
          )) {
            const field =
              categoryDefinition.fields.find(
                (item) =>
                  item.key === key
              );

            const value =
              field
                ? getFieldValue(
                    product,
                    field
                  )
                : getStaticValue(
                    product,
                    key
                  );

            if (
              !selectedValues.includes(
                value
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

  const activeFilterCount =
    Object.values(
      filters
    ).filter(
      (values) =>
        values.length > 0
    ).length;

  if (
    products.length === 0
  ) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed">
        <span className="text-sm text-muted-foreground">
          Bu kategoride ürün bulunmuyor.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
            onClick={() =>
              setFilters({})
            }
          >
            <X className="size-4" />

            Tüm Filtreleri
            Temizle
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <HeaderFilter
                    title="Ürün Kodu"
                    values={getColumnValues(
                      "productCode"
                    )}
                    selectedValues={
                      filters.productCode ??
                      []
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

                <TableHead>
                  <HeaderFilter
                    title="Marka"
                    values={getColumnValues(
                      "brand"
                    )}
                    selectedValues={
                      filters.brand ??
                      []
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

                <TableHead>
                  <HeaderFilter
                    title="Model"
                    values={getColumnValues(
                      "model"
                    )}
                    selectedValues={
                      filters.model ??
                      []
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

                <TableHead>
                  <HeaderFilter
                    title="Fiyat ($)"
                    values={getColumnValues(
                      "priceUsd"
                    )}
                    selectedValues={
                      filters.priceUsd ??
                      []
                    }
                    onChange={(
                      values
                    ) =>
                      setColumnFilter(
                        "priceUsd",
                        values
                      )
                    }
                  />
                </TableHead>

                <TableHead className="whitespace-nowrap">
                  Güncel TL
                </TableHead>

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

                <TableHead>
                  <HeaderFilter
                    title="Stok"
                    values={getColumnValues(
                      "stockQuantity"
                    )}
                    selectedValues={
                      filters.stockQuantity ??
                      []
                    }
                    onChange={(
                      values
                    ) =>
                      setColumnFilter(
                        "stockQuantity",
                        values
                      )
                    }
                  />
                </TableHead>

                <TableHead className="whitespace-nowrap text-right">
                  İşlemler
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredProducts.map(
                (product) => (
                  <TableRow
                    key={
                      product.id
                    }
                  >
                    <TableCell className="whitespace-nowrap font-medium">
                      {
                        product.productCode
                      }
                    </TableCell>

                    <TableCell>
                      {
                        product.brand
                      }
                    </TableCell>

                    <TableCell className="whitespace-nowrap">
                      {
                        product.model
                      }
                    </TableCell>

                    <TableCell className="whitespace-nowrap font-medium">
                      {typeof product.priceUsd ===
                      "number"
                        ? formatUsd(
                            product.priceUsd
                          )
                        : "-"}
                    </TableCell>

                    <TableCell className="whitespace-nowrap">
                      {usdTryRate &&
                      typeof product.priceUsd ===
                        "number"
                        ? formatTry(
                            product.priceUsd *
                              usdTryRate
                          )
                        : "-"}
                    </TableCell>

                    {categoryDefinition.fields.map(
                      (field) => {
                        const value =
                          getFieldValue(
                            product,
                            field
                          );

                        const rawValue =
                          field.source ===
                          "specifications"
                            ? product
                                .specifications[
                                field.key
                              ]
                            : undefined;

                        return (
                          <TableCell
                            key={
                              field.key
                            }
                            className="whitespace-nowrap"
                          >
                            {typeof rawValue ===
                            "boolean" ? (
                              <Badge
                                variant={
                                  rawValue
                                    ? "default"
                                    : "outline"
                                }
                              >
                                {value}
                              </Badge>
                            ) : field.source ===
                              "subCategory" ? (
                              <Badge variant="secondary">
                                {value}
                              </Badge>
                            ) : (
                              <>
                                {value}

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

                    {/* STOCK */}
                    <TableCell>
                      {product.stockQuantity ===
                      0 ? (
                        <Badge variant="destructive">
                          0
                        </Badge>
                      ) : product.stockQuantity <=
                        3 ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500 text-amber-600"
                        >
                          {
                            product.stockQuantity
                          }
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          {
                            product.stockQuantity
                          }
                        </Badge>
                      )}
                    </TableCell>

                    {/* ACTIONS */}
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            onStockIn(
                              product
                            )
                          }
                        >
                          <Plus className="size-4" />

                          Stok Ekle
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          disabled={
                            product.stockQuantity <=
                            0
                          }
                          onClick={() =>
                            onStockOut(
                              product
                            )
                          }
                        >
                          <Minus className="size-4" />

                          Stok Çıkar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}