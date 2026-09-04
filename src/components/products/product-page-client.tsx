/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  PackagePlus,
} from "lucide-react";

import {
  Product,
  ProductCategory,
} from "@/types/product";

import {
  productCategoryDefinitions,
} from "@/lib/product-config";

import {
  Button,
} from "@/components/ui/button";

import {
  ProductTable,
} from "@/components/products/product-table";

import {
  ProductFormDialog,
} from "@/components/products/product-form-dialog";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/*
 * =========================================================
 * TYPES
 * =========================================================
 */

interface ProductPageClientProps {
  category: ProductCategory;
}

interface ApiResponse<T> {
  success: boolean;

  message?: string;

  data?: T;
}

/*
 * =========================================================
 * COMPONENT
 * =========================================================
 */

export function ProductPageClient({
  category,
}: ProductPageClientProps) {
  /*
   * =======================================================
   * CATEGORY DEFINITION
   * =======================================================
   */

  const categoryDefinition =
    productCategoryDefinitions[
      category
    ];

  /*
   * =======================================================
   * STATE
   * =======================================================
   */

  const [
    products,
    setProducts,
  ] = useState<Product[]>(
    []
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    formOpen,
    setFormOpen,
  ] = useState(false);

  const [
    selectedProduct,
    setSelectedProduct,
  ] =
    useState<Product | null>(
      null
    );

  const [
    deleteProduct,
    setDeleteProduct,
  ] =
    useState<Product | null>(
      null
    );

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  /*
   * =======================================================
   * LOAD PRODUCTS
   * =======================================================
   */

  const loadProducts =
    useCallback(
      async () => {
        setLoading(true);

        setError(null);

        try {
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
                "Ürünler getirilemedi."
            );
          }

          setProducts(
            result.data ??
              []
          );
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : "Ürünler getirilemedi."
          );
        } finally {
          setLoading(false);
        }
      },
      [category]
    );

  /*
   * =======================================================
   * INITIAL LOAD
   *
   * Kategori değiştiğinde
   * ürünler yeniden yüklenir.
   * =======================================================
   */

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  /*
   * =======================================================
   * ADD
   * =======================================================
   */

  const handleAdd =
    () => {
      setError(null);

      /*
       * Yeni ürün ekleme olduğu için
       * edit product temizlenir.
       */
      setSelectedProduct(
        null
      );

      setFormOpen(
        true
      );
    };

  /*
   * =======================================================
   * EDIT
   * =======================================================
   */

  const handleEdit = (
    product: Product
  ) => {
    setError(null);

    setSelectedProduct(
      product
    );

    setFormOpen(
      true
    );
  };

  /*
   * =======================================================
   * PRODUCT SAVED
   *
   * ProductFormDialog:
   *
   * POST / PUT işlemini kendisi yapıyor.
   *
   * Buraya API'den dönen güncel Product
   * nesnesi geliyor.
   *
   * Tekrar GET atmak yerine products state'ini
   * anında güncelliyoruz.
   * =======================================================
   */

  const handleProductSaved =
    (
      savedProduct:
        Product
    ) => {
      setProducts(
        (
          previousProducts
        ) => {
          /*
           * Ürün zaten listede varsa:
           *
           * EDIT işlemidir.
           */
          const exists =
            previousProducts.some(
              (
                product
              ) =>
                product.id ===
                savedProduct.id
            );

          if (exists) {
            return previousProducts.map(
              (
                product
              ) =>
                product.id ===
                savedProduct.id
                  ? savedProduct
                  : product
            );
          }

          /*
           * Ürün listede yoksa:
           *
           * ADD işlemidir.
           *
           * Yeni ürünü tablonun başına
           * ekliyoruz.
           */
          return [
            savedProduct,
            ...previousProducts,
          ];
        }
      );

      /*
       * Edit state temizlenir.
       */
      setSelectedProduct(
        null
      );

      /*
       * Dialog kapanır.
       */
      setFormOpen(
        false
      );

      /*
       * Önceki hata varsa temizle.
       */
      setError(null);
    };

  /*
   * =======================================================
   * DELETE
   * =======================================================
   */

  const handleDelete =
    async () => {
      if (
        !deleteProduct
      ) {
        return;
      }

      setDeleting(true);

      setError(null);

      try {
        const response =
          await fetch(
            `/api/products/${deleteProduct.id}`,
            {
              method:
                "DELETE",
            }
          );

        const result:
          ApiResponse<never> =
          await response.json();

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.message ??
              "Ürün silinemedi."
          );
        }

        /*
         * Silme işleminde de tekrar GET
         * atmaya gerek yok.
         *
         * Ürünü local state'ten direkt
         * çıkarıyoruz.
         */
        setProducts(
          (
            previousProducts
          ) =>
            previousProducts.filter(
              (
                product
              ) =>
                product.id !==
                deleteProduct.id
            )
        );

        setDeleteProduct(
          null
        );
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Ürün silinemedi."
        );
      } finally {
        setDeleting(false);
      }
    };

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <>
      <div className="space-y-6">
        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {
                categoryDefinition.label
              }
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? "Ürünler yükleniyor..."
                : `${products.length} ürün bulunuyor`}
            </p>
          </div>

          <Button
            type="button"
            onClick={
              handleAdd
            }
            className="w-full sm:w-auto"
          >
            <PackagePlus className="size-4" />

            Yeni Ürün
          </Button>
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
            PRODUCTS
        ================================================= */}

        {loading ? (
          <div className="flex min-h-64 items-center justify-center rounded-xl border">
            <span className="text-sm text-muted-foreground">
              Ürünler
              yükleniyor...
            </span>
          </div>
        ) : (
          <ProductTable
            products={
              products
            }
            categoryDefinition={
              categoryDefinition
            }
            onEdit={
              handleEdit
            }
            onDelete={
              setDeleteProduct
            }
          />
        )}
      </div>

      {/* ===================================================
          PRODUCT FORM
      =================================================== */}

      <ProductFormDialog
        open={
          formOpen
        }

        onOpenChange={(
          open
        ) => {
          setFormOpen(
            open
          );

          /*
           * Dialog kullanıcı tarafından
           * kapatılırsa edit state temizlenir.
           */
          if (!open) {
            setSelectedProduct(
              null
            );
          }
        }}

        /*
         * ESKİ:
         *
         * categoryDefinition={categoryDefinition}
         *
         * ARTIK YOK.
         *
         * Dialog doğrudan ProductCategory bekliyor.
         */
        category={
          category
        }

        product={
          selectedProduct
        }

        /*
         * ESKİ:
         *
         * onSubmit={handleSave}
         *
         * ARTIK YOK.
         *
         * ProductFormDialog POST/PUT işlemini
         * kendi yapıyor ve kaydedilen ürünü
         * onSaved ile geri gönderiyor.
         */
        onSaved={
          handleProductSaved
        }
      />

      {/* ===================================================
          DELETE CONFIRMATION
      =================================================== */}

      <AlertDialog
        open={Boolean(
          deleteProduct
        )}
        onOpenChange={(
          open
        ) => {
          /*
           * Silme işlemi devam ederken
           * dialog kapanmasın.
           */
          if (
            !open &&
            !deleting
          ) {
            setDeleteProduct(
              null
            );
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Ürün silinsin mi?
            </AlertDialogTitle>

            <AlertDialogDescription>
              <strong>
                {
                  deleteProduct
                    ?.brand
                }{" "}
                {
                  deleteProduct
                    ?.model
                }
              </strong>{" "}
              ürünü kalıcı
              olarak silinecek.
              Bu işlem geri
              alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={
                deleting
              }
            >
              Vazgeç
            </AlertDialogCancel>

            <Button
              type="button"
              variant="destructive"
              disabled={
                deleting
              }
              onClick={() =>
                void handleDelete()
              }
            >
              {deleting
                ? "Siliniyor..."
                : "Ürünü Sil"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}