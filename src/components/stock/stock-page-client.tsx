/* eslint-disable react-hooks/set-state-in-effect */

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  InventoryProduct,
  StockMovementType,
} from "@/types/inventory";

import {
  ProductCategory,
} from "@/types/product";

import {
  productCategoryDefinitions,
} from "@/lib/product-config";

import {
  StockTable,
} from "@/components/stock/stock-table";

import {
  StockMovementDialog,
  StockMovementPayload,
} from "@/components/stock/stock-movement-dialog";

interface StockPageClientProps {
  category:
    ProductCategory;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

interface ExchangeRateResponse {
  success: boolean;
  data?: {
    rate: number;
  };
}

export function StockPageClient({
  category,
}: StockPageClientProps) {
  const categoryDefinition =
    productCategoryDefinitions[
      category
    ];

  const [
    products,
    setProducts,
  ] =
    useState<
      InventoryProduct[]
    >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  const [
    usdTryRate,
    setUsdTryRate,
  ] = useState<number | null>(
    null
  );

  const [
    movementOpen,
    setMovementOpen,
  ] = useState(false);

  const [
    movementType,
    setMovementType,
  ] =
    useState<StockMovementType>(
      "in"
    );

  const [
    selectedProduct,
    setSelectedProduct,
  ] =
    useState<
      InventoryProduct | null
    >(null);

  const totalStock =
    useMemo(
      () =>
        products.reduce(
          (
            total,
            product
          ) =>
            total +
            product.stockQuantity,
          0
        ),
      [products]
    );

  const loadProducts =
    useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        const response =
          await fetch(
            `/api/inventory?category=${encodeURIComponent(
              category
            )}`,
            {
              cache: "no-store",
            }
          );

        const result: ApiResponse<
          InventoryProduct[]
        > =
          await response.json();

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.message ??
              "Stok bilgileri getirilemedi."
          );
        }

        setProducts(
          result.data ?? []
        );
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Stok bilgileri getirilemedi."
        );
      } finally {
        setLoading(false);
      }
    }, [category]);

  const loadExchangeRate =
    useCallback(async () => {
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
          response.ok &&
          result.success &&
          result.data
        ) {
          setUsdTryRate(
            result.data.rate
          );
        }
      } catch (error) {
        console.error(
          "Kur alınamadı:",
          error
        );
      }
    }, []);

  useEffect(() => {
    void loadProducts();
    void loadExchangeRate();
  }, [
    loadProducts,
    loadExchangeRate,
  ]);

  const openMovement = (
    product:
      InventoryProduct,
    type:
      StockMovementType
  ) => {
    setSelectedProduct(
      product
    );

    setMovementType(type);
    setMovementOpen(true);
  };

  const handleMovement =
    async (
      payload:
        StockMovementPayload
    ) => {
      if (!selectedProduct) {
        return;
      }

      const response =
        await fetch(
          `/api/inventory/${selectedProduct.id}/movement`,
          {
            method: "POST",
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

      const result: ApiResponse<{
        quantity: number;
      }> =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ??
            "Stok işlemi gerçekleştirilemedi."
        );
      }

      await loadProducts();
    };

  return (
    <>
      <div className="space-y-6">
        {/* HEADER */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {
              categoryDefinition.label
            }{" "}
            Stokları
          </h1>

          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>
              {loading
                ? "Yükleniyor..."
                : `${products.length} farklı ürün`}
            </span>

            {!loading && (
              <span>
                Toplam{" "}
                <strong className="font-medium text-foreground">
                  {
                    totalStock
                  }
                </strong>{" "}
                adet stok
              </span>
            )}
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* CONTENT */}
        {loading ? (
          <div className="flex min-h-64 items-center justify-center rounded-xl border">
            <span className="text-sm text-muted-foreground">
              Stok bilgileri
              yükleniyor...
            </span>
          </div>
        ) : (
          <StockTable
            products={
              products
            }
            categoryDefinition={
              categoryDefinition
            }
            usdTryRate={
              usdTryRate
            }
            onStockIn={(
              product
            ) =>
              openMovement(
                product,
                "in"
              )
            }
            onStockOut={(
              product
            ) =>
              openMovement(
                product,
                "out"
              )
            }
          />
        )}
      </div>

      <StockMovementDialog
        open={
          movementOpen
        }
        onOpenChange={(
          open
        ) => {
          setMovementOpen(open);

          if (!open) {
            setSelectedProduct(
              null
            );
          }
        }}
        product={
          selectedProduct
        }
        type={
          movementType
        }
        onSubmit={
          handleMovement
        }
      />
    </>
  );
}
