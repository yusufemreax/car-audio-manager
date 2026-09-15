"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CarFront,
  ChevronRight,
  CirclePlus,
  Layers3,
  Loader2,
  Pencil,
  Search,
  Shapes,
  Trash2,
  X,
} from "lucide-react";

import {
  Button,
} from "@/components/ui/button";
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

import type {
  VehicleBrand,
  VehicleCatalogEntity,
  VehicleCatalogResponse,
  VehicleGeneration,
  VehicleModel,
} from "@/types/vehicle-catalog";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

type EditorState =
  | {
      open: false;
    }
  | {
      open: true;
      mode: "add" | "edit";
      entity: VehicleCatalogEntity;
      id?: string;
      parentId?: string;
      name: string;
      startYear: string;
      endYear: string;
    };

type DeleteState =
  | {
      open: false;
    }
  | {
      open: true;
      entity: VehicleCatalogEntity;
      id: string;
      label: string;
      childText?: string;
    };

function normalizeSearch(
  value: string
) {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR");
}

function getGenerationLabel(
  generation: VehicleGeneration
) {
  return `${generation.name} · ${generation.startYear}-${generation.endYear}`;
}

function getBrandGenerationCount(
  brand: VehicleBrand
) {
  return brand.models.reduce(
    (total, model) =>
      total +
      model.generations.length,
    0
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-5 text-center">
      <Shapes className="mb-3 size-8 text-muted-foreground/50" />
      <div className="text-sm font-semibold">
        {title}
      </div>
      <div className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
        {description}
      </div>
    </div>
  );
}

function PanelHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  actionDisabled = false,
}: {
  title: string;
  subtitle: string;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b px-4 py-4">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold">
          {title}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {subtitle}
        </p>
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 shrink-0"
        onClick={onAction}
        disabled={actionDisabled}
      >
        <CirclePlus className="mr-1.5 size-3.5" />
        {actionLabel}
      </Button>
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={placeholder}
        className="h-9 pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          onClick={() =>
            onChange("")
          }
          className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Aramayı temizle"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function VehicleCatalogPageClient() {
  const [catalog, setCatalog] =
    useState<VehicleCatalogResponse>({
      brands: [],
      summary: {
        brandCount: 0,
        modelCount: 0,
        generationCount: 0,
      },
    });

  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [deleting, setDeleting] =
    useState(false);
  const [error, setError] =
    useState<string | null>(
      null
    );
  const [success, setSuccess] =
    useState<string | null>(
      null
    );

  const [selectedBrandId, setSelectedBrandId] =
    useState("");
  const [selectedModelId, setSelectedModelId] =
    useState("");
  const selectedBrandIdRef =
    useRef("");
  const selectedModelIdRef =
    useRef("");

  const [brandSearch, setBrandSearch] =
    useState("");
  const [modelSearch, setModelSearch] =
    useState("");
  const [generationSearch, setGenerationSearch] =
    useState("");

  const [editor, setEditor] =
    useState<EditorState>({
      open: false,
    });
  const [deleteState, setDeleteState] =
    useState<DeleteState>({
      open: false,
    });

  const modelPanelRef =
    useRef<HTMLDivElement | null>(
      null
    );
  const generationPanelRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const selectedBrand =
    useMemo(
      () =>
        catalog.brands.find(
          (brand) =>
            brand.id ===
            selectedBrandId
        ) ?? null,
      [
        catalog.brands,
        selectedBrandId,
      ]
    );

  const selectedModel =
    useMemo(
      () =>
        selectedBrand?.models.find(
          (model) =>
            model.id ===
            selectedModelId
        ) ?? null,
      [
        selectedBrand,
        selectedModelId,
      ]
    );

  useEffect(() => {
    selectedBrandIdRef.current =
      selectedBrandId;
  }, [selectedBrandId]);

  useEffect(() => {
    selectedModelIdRef.current =
      selectedModelId;
  }, [selectedModelId]);

  const syncSelection =
    useCallback(
      (
        nextCatalog:
          VehicleCatalogResponse
      ) => {
        const brand =
          nextCatalog.brands.find(
            (item) =>
              item.id ===
              selectedBrandIdRef.current
          ) ??
          nextCatalog.brands[0] ??
          null;

        const model =
          brand?.models.find(
            (item) =>
              item.id ===
              selectedModelIdRef.current
          ) ??
          brand?.models[0] ??
          null;

        const nextBrandId =
          brand?.id ?? "";
        const nextModelId =
          model?.id ?? "";

        selectedBrandIdRef.current =
          nextBrandId;
        selectedModelIdRef.current =
          nextModelId;
        setSelectedBrandId(
          nextBrandId
        );
        setSelectedModelId(
          nextModelId
        );
      },
      []
    );

  const loadCatalog =
    useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        const response =
          await fetch(
            "/api/system-parameters/vehicles",
            {
              cache: "no-store",
            }
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
              "Araç kataloğu getirilemedi."
          );
        }

        setCatalog(
          result.data
        );
        syncSelection(
          result.data
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Araç kataloğu getirilemedi."
        );
      } finally {
        setLoading(false);
      }
    }, [syncSelection]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const filteredBrands =
    useMemo(() => {
      const query =
        normalizeSearch(
          brandSearch
        );

      if (!query) {
        return catalog.brands;
      }

      return catalog.brands.filter(
        (brand) =>
          normalizeSearch(
            brand.name
          ).includes(query)
      );
    }, [
      catalog.brands,
      brandSearch,
    ]);

  const filteredModels =
    useMemo(() => {
      const models =
        selectedBrand?.models ?? [];
      const query =
        normalizeSearch(
          modelSearch
        );

      if (!query) {
        return models;
      }

      return models.filter(
        (model) =>
          normalizeSearch(
            model.name
          ).includes(query)
      );
    }, [
      selectedBrand,
      modelSearch,
    ]);

  const filteredGenerations =
    useMemo(() => {
      const generations =
        selectedModel?.generations ?? [];
      const query =
        normalizeSearch(
          generationSearch
        );

      if (!query) {
        return generations;
      }

      return generations.filter(
        (generation) =>
          normalizeSearch(
            `${generation.name} ${generation.startYear} ${generation.endYear}`
          ).includes(query)
      );
    }, [
      selectedModel,
      generationSearch,
    ]);

  const selectBrand = (
    brand: VehicleBrand
  ) => {
    const nextModelId =
      brand.models[0]?.id ?? "";

    selectedBrandIdRef.current =
      brand.id;
    selectedModelIdRef.current =
      nextModelId;
    setSelectedBrandId(
      brand.id
    );
    setSelectedModelId(
      nextModelId
    );
    setModelSearch("");
    setGenerationSearch("");
  };

  const selectModel = (
    model: VehicleModel
  ) => {
    selectedModelIdRef.current =
      model.id;
    setSelectedModelId(
      model.id
    );
    setGenerationSearch("");
  };

  const openAddBrand = () => {
    setEditor({
      open: true,
      mode: "add",
      entity: "brand",
      name: "",
      startYear: "",
      endYear: "",
    });
  };

  const openAddModel = () => {
    if (!selectedBrand) {
      return;
    }

    setEditor({
      open: true,
      mode: "add",
      entity: "model",
      parentId:
        selectedBrand.id,
      name: "",
      startYear: "",
      endYear: "",
    });
  };

  const openAddGeneration = () => {
    if (!selectedModel) {
      return;
    }

    const currentYear =
      new Date().getFullYear();

    setEditor({
      open: true,
      mode: "add",
      entity: "generation",
      parentId:
        selectedModel.id,
      name: "",
      startYear:
        String(currentYear),
      endYear:
        String(currentYear),
    });
  };

  const saveEditor = async () => {
    if (!editor.open) {
      return;
    }

    const name =
      editor.name
        .trim()
        .replace(/\s+/g, " ");

    if (!name) {
      setError(
        "Ad alanı zorunludur."
      );
      return;
    }

    if (
      editor.entity ===
      "generation"
    ) {
      const startYear =
        Number(
          editor.startYear
        );
      const endYear =
        Number(
          editor.endYear
        );

      if (
        !Number.isInteger(
          startYear
        ) ||
        !Number.isInteger(
          endYear
        ) ||
        startYear < 1900 ||
        endYear > 2100
      ) {
        setError(
          "Yıl bilgileri 1900-2100 arasında olmalıdır."
        );
        return;
      }

      if (
        startYear > endYear
      ) {
        setError(
          "Başlangıç yılı bitiş yılından büyük olamaz."
        );
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: Record<
        string,
        unknown
      > = {
        entity:
          editor.entity,
        name,
      };

      if (
        editor.mode === "edit"
      ) {
        payload.id =
          editor.id;
      }

      if (
        editor.entity === "model" &&
        editor.mode === "add"
      ) {
        payload.brandId =
          editor.parentId;
      }

      if (
        editor.entity ===
        "generation"
      ) {
        if (
          editor.mode === "add"
        ) {
          payload.modelId =
            editor.parentId;
        }

        payload.startYear =
          Number(
            editor.startYear
          );
        payload.endYear =
          Number(
            editor.endYear
          );
      }

      const response =
        await fetch(
          "/api/system-parameters/vehicles",
          {
            method:
              editor.mode ===
              "add"
                ? "POST"
                : "PUT",
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
            "Araç parametresi kaydedilemedi."
        );
      }

      setCatalog(
        result.data
      );
      syncSelection(
        result.data
      );
      setEditor({
        open: false,
      });

      setSuccess(
        editor.mode === "add"
          ? "Araç parametresi eklendi."
          : "Araç parametresi güncellendi."
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Araç parametresi kaydedilemedi."
      );
    } finally {
      setSaving(false);
    }
  };

  const executeDelete =
    async () => {
      if (!deleteState.open) {
        return;
      }

      setDeleting(true);
      setError(null);
      setSuccess(null);

      try {
        const params =
          new URLSearchParams({
            entity:
              deleteState.entity,
            id:
              deleteState.id,
          });

        const response =
          await fetch(
            `/api/system-parameters/vehicles?${params.toString()}`,
            {
              method: "DELETE",
            }
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
              "Araç parametresi silinemedi."
          );
        }

        setCatalog(
          result.data
        );
        syncSelection(
          result.data
        );
        setDeleteState({
          open: false,
        });
        setSuccess(
          "Araç parametresi silindi."
        );
      } catch (deleteError) {
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : "Araç parametresi silinemedi."
        );
      } finally {
        setDeleting(false);
      }
    };

  const openEditBrand = (
    brand: VehicleBrand
  ) => {
    setEditor({
      open: true,
      mode: "edit",
      entity: "brand",
      id: brand.id,
      name: brand.name,
      startYear: "",
      endYear: "",
    });
  };

  const openEditModel = (
    model: VehicleModel
  ) => {
    setEditor({
      open: true,
      mode: "edit",
      entity: "model",
      id: model.id,
      name: model.name,
      startYear: "",
      endYear: "",
    });
  };

  const openEditGeneration = (
    generation:
      VehicleGeneration
  ) => {
    setEditor({
      open: true,
      mode: "edit",
      entity: "generation",
      id: generation.id,
      name:
        generation.name,
      startYear:
        String(
          generation.startYear
        ),
      endYear:
        String(
          generation.endYear
        ),
    });
  };

  const editorTitle =
    !editor.open
      ? ""
      : editor.entity === "brand"
        ? editor.mode === "add"
          ? "Yeni Marka"
          : "Markayı Düzenle"
        : editor.entity === "model"
          ? editor.mode === "add"
            ? "Yeni Model"
            : "Modeli Düzenle"
          : editor.mode === "add"
            ? "Yeni Kasa / Nesil"
            : "Kasayı Düzenle";

  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CarFront className="size-5" />
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Araç Parametreleri
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Marka → Model → Kasa / yıl aralığı hiyerarşisini tek ekrandan yönetin.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void loadCatalog()
              }
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Layers3 className="mr-2 size-4" />
              )}
              Yenile
            </Button>

            <Button
              type="button"
              onClick={openAddBrand}
            >
              <CirclePlus className="mr-2 size-4" />
              Yeni Marka
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Marka
            </div>
            <div className="mt-1 text-2xl font-bold">
              {catalog.summary.brandCount}
            </div>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Model
            </div>
            <div className="mt-1 text-2xl font-bold">
              {catalog.summary.modelCount}
            </div>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Kasa / Nesil
            </div>
            <div className="mt-1 text-2xl font-bold">
              {catalog.summary.generationCount}
            </div>
          </div>
        </div>

        {(selectedBrand || selectedModel) && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 rounded-xl bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              Seçim:
            </span>
            {selectedBrand && (
              <span className="font-medium">
                {selectedBrand.name}
              </span>
            )}
            {selectedModel && (
              <>
                <ChevronRight className="size-3.5 text-muted-foreground" />
                <span className="font-medium">
                  {selectedModel.name}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          {success}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1fr_1.15fr]">
        {/* MARKALAR */}
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <PanelHeader
            title="Markalar"
            subtitle="Tek tık seçer, çift tık modelleri öne getirir."
            actionLabel="Marka"
            onAction={openAddBrand}
          />

          <div className="space-y-3 p-4">
            <SearchInput
              value={brandSearch}
              onChange={setBrandSearch}
              placeholder="Marka ara..."
            />

            {loading ? (
              <div className="flex min-h-44 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Yükleniyor...
              </div>
            ) : filteredBrands.length === 0 ? (
              <EmptyState
                title="Marka bulunamadı"
                description={
                  brandSearch
                    ? "Arama kriterinizi değiştirin."
                    : "İlk araç markanızı ekleyerek başlayın."
                }
              />
            ) : (
              <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
                {filteredBrands.map(
                  (brand) => {
                    const selected =
                      brand.id ===
                      selectedBrandId;
                    const generationCount =
                      getBrandGenerationCount(
                        brand
                      );

                    return (
                      <div
                        key={brand.id}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          selectBrand(
                            brand
                          )
                        }
                        onDoubleClick={() => {
                          selectBrand(
                            brand
                          );
                          modelPanelRef.current?.scrollIntoView({
                            behavior:
                              "smooth",
                            block:
                              "nearest",
                          });
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.key ===
                              "Enter" ||
                            event.key === " "
                          ) {
                            event.preventDefault();
                            selectBrand(
                              brand
                            );
                          }
                        }}
                        className={`group flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                          selected
                            ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                            : "hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold">
                          {brand.name
                            .slice(0, 2)
                            .toLocaleUpperCase(
                              "tr-TR"
                            )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">
                            {brand.name}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {brand.models.length} model · {generationCount} kasa
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1 opacity-70 transition group-hover:opacity-100">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditBrand(
                                brand
                              );
                            }}
                            aria-label="Markayı düzenle"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-red-600 hover:text-red-700"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteState({
                                open: true,
                                entity:
                                  "brand",
                                id: brand.id,
                                label:
                                  brand.name,
                                childText:
                                  `${brand.models.length} model ve ${generationCount} kasa da silinecek.`,
                              });
                            }}
                            aria-label="Markayı sil"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </section>

        {/* MODELLER */}
        <section
          ref={modelPanelRef}
          className="overflow-hidden rounded-2xl border bg-card shadow-sm"
        >
          <PanelHeader
            title={
              selectedBrand
                ? `${selectedBrand.name} Modelleri`
                : "Modeller"
            }
            subtitle="Bir marka seçildiğinde modeller burada listelenir."
            actionLabel="Model"
            onAction={openAddModel}
            actionDisabled={
              !selectedBrand
            }
          />

          <div className="space-y-3 p-4">
            <SearchInput
              value={modelSearch}
              onChange={setModelSearch}
              placeholder="Model ara..."
            />

            {!selectedBrand ? (
              <EmptyState
                title="Önce marka seçin"
                description="Sol taraftan bir marka seçtiğinizde o markaya ait modeller açılır."
              />
            ) : filteredModels.length === 0 ? (
              <EmptyState
                title="Model bulunamadı"
                description={
                  modelSearch
                    ? "Arama kriterinizi değiştirin."
                    : `${selectedBrand.name} için ilk modeli ekleyebilirsiniz.`
                }
              />
            ) : (
              <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
                {filteredModels.map(
                  (model) => {
                    const selected =
                      model.id ===
                      selectedModelId;

                    return (
                      <div
                        key={model.id}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          selectModel(
                            model
                          )
                        }
                        onDoubleClick={() => {
                          selectModel(
                            model
                          );
                          generationPanelRef.current?.scrollIntoView({
                            behavior:
                              "smooth",
                            block:
                              "nearest",
                          });
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.key ===
                              "Enter" ||
                            event.key === " "
                          ) {
                            event.preventDefault();
                            selectModel(
                              model
                            );
                          }
                        }}
                        className={`group flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                          selected
                            ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                            : "hover:bg-muted/40"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">
                            {model.name}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {model.generations.length} kasa / nesil
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1 opacity-70 transition group-hover:opacity-100">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditModel(
                                model
                              );
                            }}
                            aria-label="Modeli düzenle"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-red-600 hover:text-red-700"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteState({
                                open: true,
                                entity:
                                  "model",
                                id: model.id,
                                label:
                                  model.name,
                                childText:
                                  `${model.generations.length} kasa / nesil kaydı da silinecek.`,
                              });
                            }}
                            aria-label="Modeli sil"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </section>

        {/* KASALAR */}
        <section
          ref={generationPanelRef}
          className="overflow-hidden rounded-2xl border bg-card shadow-sm"
        >
          <PanelHeader
            title={
              selectedModel
                ? `${selectedModel.name} Kasaları`
                : "Kasalar / Yıl Aralıkları"
            }
            subtitle="Örn. MK6 · 2008-2012"
            actionLabel="Kasa"
            onAction={openAddGeneration}
            actionDisabled={
              !selectedModel
            }
          />

          <div className="space-y-3 p-4">
            <SearchInput
              value={generationSearch}
              onChange={setGenerationSearch}
              placeholder="Kasa veya yıl ara..."
            />

            {!selectedModel ? (
              <EmptyState
                title="Önce model seçin"
                description="Bir model seçtiğinizde kasa / nesil ve üretim yıl aralıkları burada görünür."
              />
            ) : filteredGenerations.length === 0 ? (
              <EmptyState
                title="Kasa kaydı bulunamadı"
                description={
                  generationSearch
                    ? "Arama kriterinizi değiştirin."
                    : `${selectedModel.name} için ilk kasa / nesil kaydını ekleyebilirsiniz.`
                }
              />
            ) : (
              <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
                {filteredGenerations.map(
                  (generation) => (
                    <div
                      key={
                        generation.id
                      }
                      className="group flex items-center gap-3 rounded-xl border p-3 transition hover:bg-muted/40"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <CarFront className="size-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">
                          {generation.name}
                        </div>
                        <div className="mt-1 inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          {generation.startYear} – {generation.endYear}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1 opacity-70 transition group-hover:opacity-100">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() =>
                            openEditGeneration(
                              generation
                            )
                          }
                          aria-label="Kasayı düzenle"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-red-600 hover:text-red-700"
                          onClick={() =>
                            setDeleteState({
                              open: true,
                              entity:
                                "generation",
                              id:
                                generation.id,
                              label:
                                getGenerationLabel(
                                  generation
                                ),
                            })
                          }
                          aria-label="Kasayı sil"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ADD / EDIT DIALOG */}
      <Dialog
        open={editor.open}
        onOpenChange={(open) => {
          if (
            !open &&
            !saving
          ) {
            setEditor({
              open: false,
            });
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editorTitle}
            </DialogTitle>
            <DialogDescription>
              {editor.open &&
              editor.entity === "generation"
                ? "Kasa / nesil adını ve bu kasanın üretim yıl aralığını tanımlayın."
                : "Araç kataloğundaki hiyerarşik kaydı tanımlayın."}
            </DialogDescription>
          </DialogHeader>

          {editor.open && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="vehicle-entity-name">
                  {editor.entity === "brand"
                    ? "Marka Adı"
                    : editor.entity === "model"
                      ? "Model Adı"
                      : "Kasa / Nesil"}
                </Label>
                <Input
                  id="vehicle-entity-name"
                  autoFocus
                  value={editor.name}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      name:
                        event.target.value,
                    })
                  }
                  placeholder={
                    editor.entity === "brand"
                      ? "Volkswagen"
                      : editor.entity === "model"
                        ? "Golf"
                        : "MK6"
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key ===
                        "Enter" &&
                      editor.entity !==
                        "generation"
                    ) {
                      event.preventDefault();
                      void saveEditor();
                    }
                  }}
                />
              </div>

              {editor.entity ===
                "generation" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="vehicle-start-year">
                      Başlangıç Yılı
                    </Label>
                    <Input
                      id="vehicle-start-year"
                      type="number"
                      min={1900}
                      max={2100}
                      value={
                        editor.startYear
                      }
                      onChange={(event) =>
                        setEditor({
                          ...editor,
                          startYear:
                            event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vehicle-end-year">
                      Bitiş Yılı
                    </Label>
                    <Input
                      id="vehicle-end-year"
                      type="number"
                      min={1900}
                      max={2100}
                      value={
                        editor.endYear
                      }
                      onChange={(event) =>
                        setEditor({
                          ...editor,
                          endYear:
                            event.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setEditor({
                  open: false,
                })
              }
              disabled={saving}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              onClick={() =>
                void saveEditor()
              }
              disabled={saving}
            >
              {saving && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              {editor.open &&
              editor.mode === "edit"
                ? "Güncelle"
                : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE DIALOG */}
      <Dialog
        open={deleteState.open}
        onOpenChange={(open) => {
          if (
            !open &&
            !deleting
          ) {
            setDeleteState({
              open: false,
            });
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Kaydı silmek istiyor musunuz?
            </DialogTitle>
            <DialogDescription>
              Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>

          {deleteState.open && (
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="text-sm font-semibold">
                {deleteState.label}
              </div>
              {deleteState.childText && (
                <div className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {deleteState.childText}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setDeleteState({
                  open: false,
                })
              }
              disabled={deleting}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                void executeDelete()
              }
              disabled={deleting}
            >
              {deleting && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
