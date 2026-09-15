/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  Copy,
  Eye,
  Loader2,
  MonitorSmartphone,
  Pencil,
  Search,
  TrendingUp,
} from "lucide-react";

import type {
  MultimediaPreparation,
} from "@/types/multimedia-preparation";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Input,
} from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTry(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function cleanCapacity(value?: string) {
  const cleaned = String(value ?? "")
    .replace(/\s*GB\s*/gi, "")
    .trim();

  return cleaned || "-";
}

function formatRamStorage(
  system: MultimediaPreparation
) {
  return `${cleanCapacity(system.multimediaRam)}-${cleanCapacity(system.multimediaStorage)}`;
}

function formatScreenSize(value?: string) {
  const cleaned = String(value ?? "")
    .replace(/["”″]/g, "")
    .trim();

  return cleaned ? `${cleaned}"` : "-";
}

function vehicleTitle(
  system: MultimediaPreparation
) {
  return `${system.vehicleBrandName} ${system.vehicleModelName}`.trim();
}

function vehicleGeneration(
  system: MultimediaPreparation
) {
  return `${system.vehicleGenerationName} · ${system.vehicleStartYear}-${system.vehicleEndYear}`;
}

export function ReadyMultimediasPageClient() {
  const router = useRouter();

  const [
    systems,
    setSystems,
  ] = useState<MultimediaPreparation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [
    selectedSystem,
    setSelectedSystem,
  ] = useState<MultimediaPreparation | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [
    copyingSystemId,
    setCopyingSystemId,
  ] = useState<string | null>(null);
  const [
    successMessage,
    setSuccessMessage,
  ] = useState<string | null>(null);

  const loadSystems = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/multimedia-preparations?status=ready",
        { cache: "no-store" }
      );
      const result:
        ApiResponse<MultimediaPreparation[]> =
          await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ??
            "Hazır multimedyalar alınamadı."
        );
      }

      setSystems(result.data ?? []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Hazır multimedyalar alınamadı."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSystems();
  }, [loadSystems]);

  const filteredSystems = useMemo(() => {
    const query = search
      .trim()
      .toLocaleLowerCase("tr-TR");

    if (!query) return systems;

    return systems.filter((system) => {
      const products = system.items
        .map(
          (item) =>
            `${item.brand ?? ""} ${item.model ?? ""} ${item.productCode ?? ""}`
        )
        .join(" ");

      const text = `
        ${system.vehicleBrandName}
        ${system.vehicleModelName}
        ${system.vehicleGenerationName}
        ${system.vehicleStartYear}
        ${system.vehicleEndYear}
        ${system.multimediaScreenSize ?? ""}
        ${system.multimediaRam ?? ""}
        ${system.multimediaStorage ?? ""}
        ${system.additionalDescription ?? ""}
        ${products}
      `.toLocaleLowerCase("tr-TR");

      return text.includes(query);
    });
  }, [systems, search]);

  const totalCustomerAmount = useMemo(
    () =>
      filteredSystems.reduce(
        (total, system) =>
          total + system.customerTotalTry,
        0
      ),
    [filteredSystems]
  );

  const totalProfit = useMemo(
    () =>
      filteredSystems.reduce(
        (total, system) =>
          total + system.profitTry,
        0
      ),
    [filteredSystems]
  );

  const averageProfit =
    filteredSystems.length > 0
      ? totalProfit / filteredSystems.length
      : 0;

  const editSystem = (
    system: MultimediaPreparation
  ) => {
    router.push(
      `/multimedia-preparation?editId=${encodeURIComponent(system.id)}`
    );
  };

  const openDetail = (
    system: MultimediaPreparation
  ) => {
    setSelectedSystem(system);
    setDetailOpen(true);
  };

  const copySystem = async (
    system: MultimediaPreparation
  ) => {
    if (copyingSystemId) return;

    setCopyingSystemId(system.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/multimedia-preparations/${encodeURIComponent(system.id)}/copy`,
        { method: "POST" }
      );
      const result:
        ApiResponse<MultimediaPreparation> =
          await response.json();

      if (
        !response.ok ||
        !result.success ||
        !result.data
      ) {
        throw new Error(
          result.message ??
            "Hazır multimedya kopyalanamadı."
        );
      }

      setSuccessMessage(
        `${vehicleTitle(system)} için hazır multimedya kopyalandı.`
      );
      await loadSystems();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Hazır multimedya kopyalanamadı."
      );
    } finally {
      setCopyingSystemId(null);
    }
  };

  return (
    <>
      <div className="min-w-0 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Hazır Multimedyalar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Araç marka, model ve kasa bazında tanımlanmış hazır multimedya sistemlerini görüntüleyin.
          </p>
        </div>

        {successMessage && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <MonitorSmartphone className="size-4" />
                  Hazır Multimedya
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {filteredSystems.length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Toplam Müşteri Tutarı
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold">
                  {formatTry(totalCustomerAmount)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <TrendingUp className="size-4" />
                  Toplam Kazanç
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-xl font-semibold ${totalProfit < 0 ? "text-destructive" : ""}`}>
                  {formatTry(totalProfit)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Ortalama Kazanç
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold">
                  {formatTry(averageProfit)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            className="pl-9"
            placeholder="Marka, model, kasa, ekran, RAM, hafıza veya açıklama ara..."
          />
        </div>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center rounded-xl border">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredSystems.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed text-center">
            <MonitorSmartphone className="mb-4 size-10 text-muted-foreground" />
            <h2 className="font-semibold">
              Hazır multimedya bulunamadı
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Multimedya Tanımlama ekranından bir araç için sistemi hazır multimedya olarak kaydettiğinizde burada görünecektir.
            </p>
          </div>
        ) : (
          <div className="w-full min-w-0 overflow-hidden rounded-xl border bg-card">
            <div className="w-full overflow-x-auto">
              <Table className="min-w-[1650px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[250px]">Araç</TableHead>
                    <TableHead className="text-center">Ekran</TableHead>
                    <TableHead className="text-center">RAM / Hafıza</TableHead>
                    <TableHead className="min-w-[220px]">Ek Açıklama</TableHead>
                    <TableHead className="text-center">Ürün</TableHead>
                    <TableHead className="text-right">Ürünler</TableHead>
                    <TableHead className="text-right">İşçilik</TableHead>
                    <TableHead className="text-right">Komisyon</TableHead>
                    <TableHead className="text-right">İndirim</TableHead>
                    <TableHead className="text-right">Müşteri Tutarı</TableHead>
                    <TableHead className="text-right">Kazanç</TableHead>
                    <TableHead className="min-w-[150px]">Tarih</TableHead>
                    <TableHead className="w-[156px]" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredSystems.map((system) => (
                    <TableRow key={system.id}>
                      <TableCell>
                        <div className="font-semibold">
                          {vehicleTitle(system)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {vehicleGeneration(system)}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">
                            Hazır
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            Kur: {system.exchangeRate.toLocaleString("tr-TR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 4,
                            })}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-center font-semibold">
                        {formatScreenSize(system.multimediaScreenSize)}
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono text-sm">
                          {formatRamStorage(system)}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <span className="line-clamp-2 text-sm text-muted-foreground">
                          {system.additionalDescription || "-"}
                        </span>
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge variant="outline">
                          {system.items.length}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="font-medium">
                          {formatTry(system.productTotalTry)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatUsd(system.productTotalUsd)}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="font-medium">
                          {formatTry(system.laborCostTry)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {system.laborItems.length} kalem
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="font-medium">
                          {formatTry(system.commissionAmountTry)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          %{system.commissionRate}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        {formatTry(system.discountTry)}
                      </TableCell>

                      <TableCell className="text-right font-semibold">
                        {formatTry(system.customerTotalTry)}
                      </TableCell>

                      <TableCell className={`text-right font-semibold ${system.profitTry < 0 ? "text-destructive" : ""}`}>
                        {formatTry(system.profitTry)}
                      </TableCell>

                      <TableCell>
                        {formatDate(system.readyAt ?? system.updatedAt)}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => editSystem(system)}
                          >
                            <Pencil className="size-4" />
                            <span className="sr-only">Düzenle</span>
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={copyingSystemId !== null}
                            onClick={() => void copySystem(system)}
                          >
                            {copyingSystemId === system.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Copy className="size-4" />
                            )}
                            <span className="sr-only">Kopyala</span>
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetail(system)}
                          >
                            <Eye className="size-4" />
                            <span className="sr-only">Detay</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelectedSystem(null);
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          {selectedSystem && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-4 pr-8">
                  <div className="min-w-0">
                    <DialogTitle>
                      {vehicleTitle(selectedSystem)}
                    </DialogTitle>
                    <DialogDescription>
                      {vehicleGeneration(selectedSystem)} · {formatScreenSize(selectedSystem.multimediaScreenSize)} · {formatRamStorage(selectedSystem)}
                      {selectedSystem.additionalDescription
                        ? ` · ${selectedSystem.additionalDescription}`
                        : ""}
                    </DialogDescription>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={copyingSystemId !== null}
                      onClick={() => void copySystem(selectedSystem)}
                    >
                      {copyingSystemId === selectedSystem.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                      Kopyala
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => editSystem(selectedSystem)}
                    >
                      <Pencil className="size-4" />
                      Düzenle
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">Araç</div>
                  <div className="mt-1 font-semibold">{vehicleTitle(selectedSystem)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{vehicleGeneration(selectedSystem)}</div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">Multimedya</div>
                  <div className="mt-1 font-semibold">{formatScreenSize(selectedSystem.multimediaScreenSize)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">RAM/Hafıza: {formatRamStorage(selectedSystem)}</div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">Ürün Sayısı</div>
                  <div className="mt-1 font-semibold">{selectedSystem.items.length}</div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">Kur</div>
                  <div className="mt-1 font-semibold">1 USD = {selectedSystem.exchangeRate.toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} TL</div>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alan</TableHead>
                      <TableHead>Ürün</TableHead>
                      <TableHead className="text-center">Adet</TableHead>
                      <TableHead className="text-right">USD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSystem.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.label}</TableCell>
                        <TableCell>
                          <div>{item.brand ?? "-"} {item.model ?? ""}</div>
                          <div className="text-xs text-muted-foreground">{item.productCode ?? "-"}</div>
                        </TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatUsd(item.totalPriceUsd ?? 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">Ürünler</div>
                  <div className="mt-1 font-semibold">{formatTry(selectedSystem.productTotalTry)}</div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">İşçilik</div>
                  <div className="mt-1 font-semibold">{formatTry(selectedSystem.laborCostTry)}</div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">Kazanç</div>
                  <div className="mt-1 font-semibold">{formatTry(selectedSystem.profitTry)}</div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">Müşteri Tutarı</div>
                  <div className="mt-1 font-semibold">{formatTry(selectedSystem.customerTotalTry)}</div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
