/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Car,
  Loader2,
} from "lucide-react";

import type {
  Customer,
} from "@/types/customer";

import type {
  VehicleCatalogResponse,
} from "@/types/vehicle-catalog";

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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

interface VehicleFormDialogProps {
  open: boolean;
  customer: Customer | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function VehicleFormDialog({
  open,
  customer,
  onOpenChange,
  onSaved,
}: VehicleFormDialogProps) {
  const [
    catalog,
    setCatalog,
  ] = useState<VehicleCatalogResponse | null>(null);

  const [
    selectedBrandId,
    setSelectedBrandId,
  ] = useState("");

  const [
    selectedModelId,
    setSelectedModelId,
  ] = useState("");

  const [
    selectedGenerationId,
    setSelectedGenerationId,
  ] = useState("");

  const [
    selectedYear,
    setSelectedYear,
  ] = useState("");

  const [
    plate,
    setPlate,
  ] = useState("");

  const [
    note,
    setNote,
  ] = useState("");

  const [
    loadingCatalog,
    setLoadingCatalog,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const brands =
    catalog?.brands ?? [];

  const selectedBrand =
    useMemo(
      () =>
        brands.find(
          (brand) =>
            brand.id ===
            selectedBrandId
        ) ?? null,
      [
        brands,
        selectedBrandId,
      ]
    );

  const models =
    selectedBrand?.models ?? [];

  const selectedModel =
    useMemo(
      () =>
        models.find(
          (model) =>
            model.id ===
            selectedModelId
        ) ?? null,
      [
        models,
        selectedModelId,
      ]
    );

  const generations =
    selectedModel?.generations ?? [];

  const selectedGeneration =
    useMemo(
      () =>
        generations.find(
          (generation) =>
            generation.id ===
            selectedGenerationId
        ) ?? null,
      [
        generations,
        selectedGenerationId,
      ]
    );

  const brandItems =
    useMemo(
      () =>
        brands.map(
          (brand) => ({
            value: brand.id,
            label: brand.name,
          })
        ),
      [brands]
    );

  const modelItems =
    useMemo(
      () =>
        models.map(
          (model) => ({
            value: model.id,
            label: model.name,
          })
        ),
      [models]
    );

  const generationItems =
    useMemo(
      () =>
        generations.map(
          (generation) => ({
            value: generation.id,
            label:
              `${generation.name} · ${generation.startYear}-${generation.endYear}`,
          })
        ),
      [generations]
    );

  const yearItems =
    useMemo(() => {
      if (!selectedGeneration) {
        return [];
      }

      const result: Array<{
        value: string;
        label: string;
      }> = [];

      for (
        let year =
          selectedGeneration.endYear;
        year >=
        selectedGeneration.startYear;
        year -= 1
      ) {
        result.push({
          value: String(year),
          label: String(year),
        });
      }

      return result;
    }, [selectedGeneration]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedBrandId("");
    setSelectedModelId("");
    setSelectedGenerationId("");
    setSelectedYear("");
    setPlate("");
    setNote("");
    setError(null);

    let cancelled = false;

    const loadCatalog =
      async () => {
        setLoadingCatalog(true);

        try {
          const response =
            await fetch(
              "/api/system-parameters/vehicles",
              {
                cache:
                  "no-store",
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
                "Araç tanımları alınamadı."
            );
          }

          if (!cancelled) {
            setCatalog(
              result.data
            );
          }
        } catch (loadError) {
          if (!cancelled) {
            setCatalog(null);
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Araç tanımları alınamadı."
            );
          }
        } finally {
          if (!cancelled) {
            setLoadingCatalog(false);
          }
        }
      };

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const save =
    async () => {
      if (!customer?.id) {
        setError(
          "Araç eklenecek müşteri bulunamadı."
        );
        return;
      }

      if (!selectedBrand) {
        setError(
          "Araç markası seçmelisiniz."
        );
        return;
      }

      if (!selectedModel) {
        setError(
          "Araç modeli seçmelisiniz."
        );
        return;
      }

      if (!selectedGeneration) {
        setError(
          "Araç kasası seçmelisiniz."
        );
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const response =
          await fetch(
            `/api/customers/${encodeURIComponent(
              customer.id
            )}/vehicles/catalog`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
                  vehicleBrandId:
                    selectedBrand.id,
                  vehicleModelId:
                    selectedModel.id,
                  vehicleGenerationId:
                    selectedGeneration.id,
                  ...(selectedYear
                    ? {
                        year:
                          Number(
                            selectedYear
                          ),
                      }
                    : {}),
                  ...(plate.trim()
                    ? {
                        plate:
                          plate
                            .trim()
                            .toLocaleUpperCase(
                              "tr-TR"
                            ),
                      }
                    : {}),
                  ...(note.trim()
                    ? {
                        note:
                          note.trim(),
                      }
                    : {}),
                }),
            }
          );

        const result:
          ApiResponse<unknown> =
            await response.json();

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.message ??
              "Araç kaydedilemedi."
          );
        }

        onSaved();
        onOpenChange(false);
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Araç kaydedilemedi."
        );
      } finally {
        setSaving(false);
      }
    };

  return (
    <Dialog
      open={open}
      onOpenChange={
        onOpenChange
      }
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="size-5" />
            Müşteriye Araç Ekle
          </DialogTitle>

          <DialogDescription>
            {customer?.name
              ? `${customer.name} için sistemde tanımlı marka, model ve kasa bilgisinden araç seçin.`
              : "Sistemde tanımlı marka, model ve kasa bilgisinden araç seçin."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Araç Markası</Label>

            <Select
              items={brandItems}
              value={
                selectedBrandId ||
                null
              }
              onValueChange={(
                value
              ) => {
                setSelectedBrandId(
                  value ?? ""
                );
                setSelectedModelId(
                  ""
                );
                setSelectedGenerationId(
                  ""
                );
                setSelectedYear("");
                setError(null);
              }}
              disabled={
                loadingCatalog
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    loadingCatalog
                      ? "Yükleniyor..."
                      : "Marka seçin"
                  }
                />
              </SelectTrigger>

              <SelectContent>
                {brands.map(
                  (brand) => (
                    <SelectItem
                      key={
                        brand.id
                      }
                      value={
                        brand.id
                      }
                    >
                      {brand.name}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Araç Modeli</Label>

            <Select
              items={modelItems}
              value={
                selectedModelId ||
                null
              }
              onValueChange={(
                value
              ) => {
                setSelectedModelId(
                  value ?? ""
                );
                setSelectedGenerationId(
                  ""
                );
                setSelectedYear("");
                setError(null);
              }}
              disabled={
                !selectedBrandId
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Model seçin" />
              </SelectTrigger>

              <SelectContent>
                {models.map(
                  (model) => (
                    <SelectItem
                      key={
                        model.id
                      }
                      value={
                        model.id
                      }
                    >
                      {model.name}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Kasa / Yıl Aralığı</Label>

            <Select
              items={
                generationItems
              }
              value={
                selectedGenerationId ||
                null
              }
              onValueChange={(
                value
              ) => {
                setSelectedGenerationId(
                  value ?? ""
                );
                setSelectedYear("");
                setError(null);
              }}
              disabled={
                !selectedModelId
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Kasa seçin" />
              </SelectTrigger>

              <SelectContent>
                {generations.map(
                  (generation) => (
                    <SelectItem
                      key={
                        generation.id
                      }
                      value={
                        generation.id
                      }
                    >
                      {generation.name}{" "}
                      ·{" "}
                      {generation.startYear}
                      -
                      {generation.endYear}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              Model Yılı
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (Opsiyonel)
              </span>
            </Label>

            <Select
              items={yearItems}
              value={
                selectedYear ||
                null
              }
              onValueChange={(
                value
              ) => {
                setSelectedYear(
                  value ?? ""
                );
                setError(null);
              }}
              disabled={
                !selectedGeneration
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Model yılı seçin" />
              </SelectTrigger>

              <SelectContent>
                {yearItems.map(
                  (item) => (
                    <SelectItem
                      key={
                        item.value
                      }
                      value={
                        item.value
                      }
                    >
                      {item.label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-vehicle-plate">
              Plaka
            </Label>

            <Input
              id="customer-vehicle-plate"
              value={plate}
              onChange={(event) =>
                setPlate(
                  event.target.value
                )
              }
              placeholder="34 ABC 123"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-vehicle-note">
              Not
            </Label>

            <Input
              id="customer-vehicle-note"
              value={note}
              onChange={(event) =>
                setNote(
                  event.target.value
                )
              }
              placeholder="Araçla ilgili opsiyonel not"
              autoComplete="off"
            />
          </div>
        </div>

        {selectedGeneration && (
          <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm">
            <div className="font-medium">
              {selectedBrand?.name}{" "}
              {selectedModel?.name}
            </div>
            <div className="mt-1 text-muted-foreground">
              {selectedGeneration.name}{" "}
              ·{" "}
              {selectedGeneration.startYear}
              -
              {selectedGeneration.endYear}
              {selectedYear && (
                <>
                  {" "}· Model yılı:{" "}
                  {selectedYear}
                </>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onOpenChange(false)
            }
            disabled={saving}
          >
            Vazgeç
          </Button>

          <Button
            type="button"
            onClick={() =>
              void save()
            }
            disabled={
              saving ||
              loadingCatalog ||
              !selectedGeneration
            }
          >
            {saving && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Aracı Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
