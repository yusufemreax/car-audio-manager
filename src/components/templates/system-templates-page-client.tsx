/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Layers3,
  Pencil,
  Plus,
  Trash2,
  Wrench,
} from "lucide-react";

import {
  SystemTemplate,
  SystemTemplatePayload,
} from "@/types/system-template";

import {
  productCategoryDefinitions,
} from "@/lib/product-config";

import {
  SystemTemplateFormDialog,
} from "@/components/templates/system-template-form-dialog";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ApiResponse<T> {
  success: boolean;

  message?: string;

  data?: T;
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

export function SystemTemplatesPageClient() {
  const [
    templates,
    setTemplates,
  ] =
    useState<
      SystemTemplate[]
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
    formOpen,
    setFormOpen,
  ] = useState(false);

  const [
    selectedTemplate,
    setSelectedTemplate,
  ] =
    useState<
      SystemTemplate | null
    >(null);

  const [
    deleteOpen,
    setDeleteOpen,
  ] = useState(false);

  const [
    templateToDelete,
    setTemplateToDelete,
  ] =
    useState<
      SystemTemplate | null
    >(null);

  const [
    deleting,
    setDeleting,
  ] = useState(false);


  const loadTemplates =
    useCallback(async () => {
      setLoading(true);
      setError(null);

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
              "Şablonlar getirilemedi."
          );
        }

        setTemplates(
          result.data ?? []
        );
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Şablonlar getirilemedi."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadTemplates();
  }, [
    loadTemplates,
  ]);

  const totalSlotCount =
    useMemo(
      () =>
        templates.reduce(
          (
            total,
            template
          ) =>
            total +
            template.items
              .length,
          0
        ),
      [templates]
    );

  const averageLaborCostTry =
    useMemo(() => {
      if (
        templates.length === 0
      ) {
        return 0;
      }

      return (
        templates.reduce(
          (
            total,
            template
          ) =>
            total +
            template.laborCostTry,
          0
        ) /
        templates.length
      );
    }, [templates]);

  const openCreate = () => {
    setSelectedTemplate(
      null
    );

    setFormOpen(true);
  };

  const openEdit = (
    template:
      SystemTemplate
  ) => {
    setSelectedTemplate(
      template
    );

    setFormOpen(true);
  };

  const openDelete = (
    template:
      SystemTemplate
  ) => {
    setTemplateToDelete(
      template
    );

    setDeleteOpen(true);
  };

  const handleSave =
    async (
      payload:
        SystemTemplatePayload
    ) => {
      const editing =
        Boolean(
          selectedTemplate
        );

      const url =
        editing
          ? `/api/system-templates/${selectedTemplate!.id}`
          : "/api/system-templates";

      const response =
        await fetch(
          url,
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

      const result: ApiResponse<SystemTemplate> =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ??
            "Şablon kaydedilemedi."
        );
      }

      await loadTemplates();
    };

  const handleDelete =
    async () => {
      if (
        !templateToDelete
      ) {
        return;
      }

      setDeleting(true);

      try {
        const response =
          await fetch(
            `/api/system-templates/${templateToDelete.id}`,
            {
              method:
                "DELETE",
            }
          );

        const result: ApiResponse<null> =
          await response.json();

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.message ??
              "Şablon silinemedi."
          );
        }

        setDeleteOpen(false);
        setTemplateToDelete(
          null
        );

        await loadTemplates();
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Şablon silinemedi."
        );
      } finally {
        setDeleting(false);
      }
    };

  return (
    <>
      <div className="min-w-0 space-y-6">
        {/* HEADER */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Sistem Şablonları
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Araç ses sistemi
              hazırlarken
              kullanılacak hazır
              ürün yapılarını
              yönetin.
            </p>
          </div>

          <Button
            type="button"
            onClick={
              openCreate
            }
          >
            <Plus className="size-4" />

            Yeni Şablon
          </Button>
        </div>

        {/* SUMMARY */}
        {!loading && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Şablon
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="text-2xl font-semibold">
                  {
                    templates.length
                  }
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Toplam Ürün Alanı
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="text-2xl font-semibold">
                  {
                    totalSlotCount
                  }
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Ortalama İşçilik
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="text-2xl font-semibold">
                  {formatTry(
                    averageLaborCostTry
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* LOADING */}
        {loading ? (
          <div className="flex min-h-64 items-center justify-center rounded-xl border">
            <span className="text-sm text-muted-foreground">
              Şablonlar
              yükleniyor...
            </span>
          </div>
        ) : templates.length ===
          0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed text-center">
            <Layers3 className="mb-4 size-9 text-muted-foreground" />

            <h2 className="font-semibold">
              Henüz şablon yok
            </h2>

            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              İlk sistem
              şablonunuzu
              oluşturarak ürün
              kategorilerini ve
              işçilik maliyetini
              tanımlayın.
            </p>

            <Button
              type="button"
              className="mt-5"
              onClick={
                openCreate
              }
            >
              <Plus className="size-4" />

              İlk Şablonu
              Oluştur
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {templates.map(
              (template) => {
                const sortedItems =
                  [
                    ...template.items,
                  ].sort(
                    (
                      first,
                      second
                    ) =>
                      first.sortOrder -
                      second.sortOrder
                  );

                return (
                  <Card
                    key={
                      template.id
                    }
                    className="overflow-hidden"
                  >
                    <CardHeader className="border-b">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <CardTitle className="truncate text-base">
                            {
                              template.name
                            }
                          </CardTitle>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">
                              {
                                template
                                  .items
                                  .length
                              }{" "}
                              ürün alanı
                            </Badge>

                            <Badge variant="outline">
                              <Wrench className="mr-1 size-3" />

                              {formatTry(
                                template.laborCostTry
                              )}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              openEdit(
                                template
                              )
                            }
                          >
                            <Pencil className="size-4" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() =>
                              openDelete(
                                template
                              )
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4 pt-4">
                      {/* ITEMS */}
                      <div className="space-y-2">
                        {sortedItems.map(
                          (
                            item
                          ) => {
                            const category =
                              productCategoryDefinitions[
                                item.category
                              ];

                            const subCategoryField =
                              category.fields.find(
                                (
                                  field
                                ) =>
                                  field.source ===
                                  "subCategory"
                              );

                            const subCategory =
                              subCategoryField?.options?.find(
                                (
                                  option
                                ) =>
                                  option.value ===
                                  item.subCategory
                              );

                            return (
                              <div
                                key={
                                  item.id
                                }
                                className="flex items-center justify-between gap-4 rounded-lg bg-muted/30 px-3 py-2.5"
                              >
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium">
                                    {
                                      item.label
                                    }
                                  </div>

                                  <div className="mt-0.5 text-xs text-muted-foreground">
                                    {
                                      category.label
                                    }

                                    {subCategory && (
                                      <>
                                        {" "}
                                        •{" "}
                                        {
                                          subCategory.label
                                        }
                                      </>
                                    )}
                                  </div>
                                </div>

                                <Badge
                                  variant="outline"
                                  className="shrink-0"
                                >
                                  {
                                    item.quantity
                                  }{" "}
                                  adet
                                </Badge>
                              </div>
                            );
                          }
                        )}
                      </div>

                      {/* LABOR */}
                      <div className="flex items-center justify-between border-t pt-4">
                        <div className="text-xs text-muted-foreground">
                          İşçilik
                          Maliyeti
                        </div>

                        <div className="text-lg font-semibold">
                          {formatTry(
                            template.laborCostTry
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* ADD / EDIT */}
      <SystemTemplateFormDialog
        open={
          formOpen
        }
        onOpenChange={(
          open
        ) => {
          setFormOpen(open);

          if (!open) {
            setSelectedTemplate(
              null
            );
          }
        }}
        template={
          selectedTemplate
        }
        onSubmit={
          handleSave
        }
      />

      {/* DELETE CONFIRMATION */}
      <Dialog
        open={
          deleteOpen
        }
        onOpenChange={(
          open
        ) => {
          if (deleting) {
            return;
          }

          setDeleteOpen(open);

          if (!open) {
            setTemplateToDelete(
              null
            );
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Şablonu Sil
            </DialogTitle>

            <DialogDescription>
              <strong>
                {
                  templateToDelete?.name
                }
              </strong>{" "}
              şablonunu silmek
              istediğinize emin
              misiniz?
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-muted-foreground">
            Bu işlem şablonu
            kalıcı olarak
            silecektir.
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={
                deleting
              }
              onClick={() =>
                setDeleteOpen(
                  false
                )
              }
            >
              Vazgeç
            </Button>

            <Button
              type="button"
              variant="destructive"
              disabled={
                deleting
              }
              onClick={
                handleDelete
              }
            >
              {deleting
                ? "Siliniyor..."
                : "Şablonu Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}