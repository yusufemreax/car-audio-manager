/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Loader2,
  MonitorSmartphone,
} from "lucide-react";

import type {
  Customer,
  CustomerVehicle,
} from "@/types/customer";
import type {
  CustomerSystemOffer,
} from "@/types/customer-system-offer";
import type {
  MultimediaPreparation,
} from "@/types/multimedia-preparation";
import {
  Button,
} from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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

interface Props {
  open: boolean;
  customer: Customer | null;
  vehicle: CustomerVehicle | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (offer: CustomerSystemOffer) => void;
}

function formatTry(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(value);
}

function multimediaLabel(system: MultimediaPreparation) {
  const details = [
    system.multimediaScreenSize
      ? `${system.multimediaScreenSize.replace(/[\"”″]/g, "").trim()}\"`
      : null,
    system.multimediaRam
      ? `${system.multimediaRam.replace(/\s*GB\s*/gi, "").trim()} GB RAM`
      : null,
    system.multimediaStorage
      ? `${system.multimediaStorage.replace(/\s*GB\s*/gi, "").trim()} GB`
      : null,
  ].filter(Boolean);

  return details.length > 0
    ? details.join(" · ")
    : system.name;
}

export function CustomerMultimediaOfferDialog({
  open,
  customer,
  vehicle,
  onOpenChange,
  onSaved,
}: Props) {
  const [systems, setSystems] =
    useState<MultimediaPreparation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [extraDiscount, setExtraDiscount] = useState("0");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSystems([]);
      setSelectedId("");
      setExtraDiscount("0");
      setError(null);
      return;
    }

    if (!vehicle?.vehicleGenerationId) {
      setSystems([]);
      setSelectedId("");
      setError(
        "Bu araç katalog üzerinden eklenmediği için uyumlu multimedya bulunamaz."
      );
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          status: "ready",
          vehicleGenerationId:
            vehicle.vehicleGenerationId ?? "",
        });
        const response = await fetch(
          `/api/multimedia-preparations?${params.toString()}`,
          { cache: "no-store" }
        );
        const result:
          ApiResponse<MultimediaPreparation[]> =
            await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message ??
              "Uyumlu hazır multimedyalar alınamadı."
          );
        }

        const compatibleSystems = result.data ?? [];
        setSystems(compatibleSystems);
        setSelectedId(
          compatibleSystems.length === 1
            ? compatibleSystems[0].id
            : ""
        );
      } catch (loadError) {
        setSystems([]);
        setSelectedId("");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Uyumlu hazır multimedyalar alınamadı."
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [open, vehicle]);

  const selectedSystem =
    systems.find((system) => system.id === selectedId) ?? null;

  const selectItems = useMemo(
    () =>
      systems.map((system) => ({
        value: system.id,
        label: multimediaLabel(system),
      })),
    [systems]
  );

  const discount = Math.max(0, Number(extraDiscount) || 0);
  const finalCustomerTotal = selectedSystem
    ? Math.max(0, selectedSystem.customerTotalTry - discount)
    : 0;
  const finalProfit = selectedSystem
    ? selectedSystem.profitTry - discount
    : 0;

  const save = async () => {
    if (!customer || !vehicle || !selectedSystem) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/customer-system-offers",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            offerType: "multimedia",
            customerId: customer.id,
            vehicleId: vehicle.id,
            readySystemId: selectedSystem.id,
            extraDiscountTry: discount,
          }),
        }
      );
      const result:
        ApiResponse<CustomerSystemOffer> =
          await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(
          result.message ??
            "Multimedya teklifi oluşturulamadı."
        );
      }

      onSaved(result.data);
      onOpenChange(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Multimedya teklifi oluşturulamadı."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MonitorSmartphone className="size-5" />
            Multimedya Teklifi Ekle
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {vehicle && (
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="font-semibold">
                {vehicle.brand} {vehicle.model}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {vehicle.vehicleGenerationName ?? "Kasa bilgisi yok"}
                {typeof vehicle.vehicleStartYear === "number" &&
                  typeof vehicle.vehicleEndYear === "number" && (
                    <> · {vehicle.vehicleStartYear}-{vehicle.vehicleEndYear}</>
                  )}
                {typeof vehicle.year === "number" && (
                  <> · Model yılı {vehicle.year}</>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Uyumlu hazır multimedyalar aranıyor...
            </div>
          ) : systems.length === 0 && !error ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Bu araç için tanımlanmış hazır multimedya bulunamadı.
            </div>
          ) : systems.length > 0 ? (
            <>
              <div className="space-y-2">
                <Label>Uyumlu Hazır Multimedya</Label>
                <Select
                  items={selectItems}
                  value={selectedId}
                  onValueChange={(value) => setSelectedId(value ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Hazır multimedya seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    {systems.map((system) => (
                      <SelectItem key={system.id} value={system.id}>
                        {multimediaLabel(system)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Yalnızca seçili aracın kasa kaydıyla birebir eşleşen hazır multimedyalar gösterilir.
                </p>
              </div>

              {selectedSystem && (
                <>
                  <div className="space-y-2 rounded-xl border p-4">
                    {selectedSystem.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between gap-4 text-sm"
                      >
                        <div>
                          <div className="font-medium">{item.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.brand} - {item.model} · {item.quantity} adet
                          </div>
                        </div>
                        <div className="font-medium">
                          ${(item.totalPriceUsd ?? 0).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Hazır Multimedya Tutarı</Label>
                      <div className="rounded-md border bg-muted/30 px-3 py-2 font-semibold">
                        {formatTry(selectedSystem.customerTotalTry)}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Hazır Multimedya Kazancı</Label>
                      <div className="rounded-md border bg-muted/30 px-3 py-2 font-semibold">
                        {formatTry(selectedSystem.profitTry)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Ek İndirim (TL)</Label>
                    <Input
                      type="number"
                      min="0"
                      max={selectedSystem.customerTotalTry}
                      step="0.01"
                      value={extraDiscount}
                      onChange={(event) =>
                        setExtraDiscount(event.target.value)
                      }
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border p-4">
                      <div className="text-xs text-muted-foreground">
                        Yeni Müşteri Tutarı
                      </div>
                      <div className="mt-1 text-xl font-bold">
                        {formatTry(finalCustomerTotal)}
                      </div>
                    </div>
                    <div className="rounded-xl border p-4">
                      <div className="text-xs text-muted-foreground">
                        Yeni Kazanç
                      </div>
                      <div
                        className={`mt-1 text-xl font-bold ${
                          finalProfit < 0 ? "text-destructive" : ""
                        }`}
                      >
                        {formatTry(finalProfit)}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Vazgeç
          </Button>
          <Button
            disabled={!selectedSystem || loading || saving}
            onClick={() => void save()}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Ekleniyor..." : "Teklifi Ekle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
