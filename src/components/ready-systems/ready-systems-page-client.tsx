/* eslint-disable react-hooks/immutability */
/* eslint-disable @next/next/no-location-assign-relative-destination */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Copy,
  Eye,
  Loader2,
  PackageCheck,
  Pencil,
  Search,
  TrendingUp,
} from "lucide-react";

import {
  SystemPreparation,
} from "@/types/system-preparation";

import {
  productCategoryDefinitions,
} from "@/lib/product-config";

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

/*
 * =========================================================
 * TYPES
 * =========================================================
 */

interface ApiResponse<T> {
  success: boolean;

  message?: string;

  data?: T;
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

function formatDate(
  value?: string
) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
}

/*
 * =========================================================
 * COMPONENT
 * =========================================================
 */

export function ReadySystemsPageClient() {
  const [
    systems,
    setSystems,
  ] =
    useState<
      SystemPreparation[]
    >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    selectedSystem,
    setSelectedSystem,
  ] =
    useState<
      SystemPreparation | null
    >(null);

  const [
    detailOpen,
    setDetailOpen,
  ] =
    useState(false);

  const [
    copyingSystemId,
    setCopyingSystemId,
  ] =
    useState<string | null>(
      null
    );

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState<string | null>(
      null
    );

  /*
   * =======================================================
   * LOAD
   * =======================================================
   */

  const loadSystems =
    useCallback(
      async () => {
        setLoading(true);

        setError(null);

        try {
          const response =
            await fetch(
              "/api/system-preparations?status=ready",
              {
                cache:
                  "no-store",
              }
            );

          const result: ApiResponse<
            SystemPreparation[]
          > =
            await response.json();

          if (
            !response.ok ||
            !result.success
          ) {
            throw new Error(
              result.message ??
                "Hazır sistemler alınamadı."
            );
          }

          setSystems(
            result.data ?? []
          );
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : "Hazır sistemler alınamadı."
          );
        } finally {
          setLoading(false);
        }
      },
      []
    );

  useEffect(() => {
    void loadSystems();
  }, [loadSystems]);

  /*
   * =======================================================
   * FILTER
   * =======================================================
   */

  const filteredSystems =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLocaleLowerCase(
            "tr-TR"
          );

      if (!query) {
        return systems;
      }

      return systems.filter(
        (system) => {
          const products =
            system.items
              .map(
                (item) =>
                  `${item.brand ?? ""} ${item.model ?? ""} ${item.productCode ?? ""}`
              )
              .join(" ");

          const text =
            `
              ${system.name}
              ${system.templateName ?? ""}
              ${products}
            `.toLocaleLowerCase(
              "tr-TR"
            );

          return text.includes(
            query
          );
        }
      );
    }, [
      systems,
      search,
    ]);

  /*
   * =======================================================
   * SUMMARY
   * =======================================================
   */

  const totalCustomerAmount =
    useMemo(
      () =>
        filteredSystems.reduce(
          (
            total,
            system
          ) =>
            total +
            system.customerTotalTry,
          0
        ),
      [filteredSystems]
    );

  const totalProfit =
    useMemo(
      () =>
        filteredSystems.reduce(
          (
            total,
            system
          ) =>
            total +
            system.profitTry,
          0
        ),
      [filteredSystems]
    );

  const averageProfit =
    filteredSystems.length >
    0
      ? totalProfit /
        filteredSystems.length
      : 0;

  /*
   * =======================================================
   * DETAIL
   * =======================================================
   */

  const openDetail = (
    system:
      SystemPreparation
  ) => {
    setSelectedSystem(
      system
    );

    setDetailOpen(true);
  };

  /*
   * =======================================================
   * EDIT READY SYSTEM
   * =======================================================
   */

  const editSystem = (
    system:
      SystemPreparation
  ) => {
    window.location.href =
      `/system-preparation?editId=${encodeURIComponent(
        system.id
      )}`;
  };

  /*
   * =======================================================
   * COPY READY SYSTEM
   * =======================================================
   *
   * Server tarafında mevcut hazır sistem snapshot&apos;ı
   * birebir kopyalanır.
   *
   * Stok değişmez.
   */
  const copySystem =
    async (
      system:
        SystemPreparation
    ) => {
      if (
        copyingSystemId
      ) {
        return;
      }

      setCopyingSystemId(
        system.id
      );

      setError(null);
      setSuccessMessage(
        null
      );

      try {
        const response =
          await fetch(
            `/api/system-preparations/${encodeURIComponent(
              system.id
            )}/copy`,
            {
              method:
                "POST",
            }
          );

        const result:
          ApiResponse<SystemPreparation> =
            await response.json();

        if (
          !response.ok ||
          !result.success ||
          !result.data
        ) {
          throw new Error(
            result.message ??
              "Hazır sistem kopyalanamadı."
          );
        }

        /*
         * Yeni kopyayı listenin başına ekliyoruz.
         * Tekrar GET atmaya gerek yok.
         */
        setSystems(
          (
            previous
          ) => [
            result.data!,
            ...previous,
          ]
        );

        setSuccessMessage(
          `${system.name} başarıyla kopyalandı.`
        );
      } catch (
        error
      ) {
        setError(
          error instanceof Error
            ? error.message
            : "Hazır sistem kopyalanamadı."
        );
      } finally {
        setCopyingSystemId(
          null
        );
      }
    };

  /*
   * =======================================================
   * RENDER
   * =======================================================
   */

  return (
    <>
      <div className="min-w-0 space-y-6">
        {/* =================================================
            HEADER
        ================================================= */}

        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Hazır Sistemler
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Daha önce
            oluşturulan hazır araç
            ses sistemlerini
            görüntüleyin.
          </p>
        </div>

        {successMessage && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
            {
              successMessage
            }
          </div>
        )}

        {/* =================================================
            SUMMARY
        ================================================= */}

        {!loading && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {/* SYSTEM COUNT */}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <PackageCheck className="size-4" />

                  Hazır Sistem
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="text-2xl font-semibold">
                  {
                    filteredSystems.length
                  }
                </div>
              </CardContent>
            </Card>

            {/* CUSTOMER TOTAL */}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Toplam Müşteri
                  Tutarı
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="text-xl font-semibold">
                  {formatTry(
                    totalCustomerAmount
                  )}
                </div>
              </CardContent>
            </Card>

            {/* PROFIT */}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <TrendingUp className="size-4" />

                  Toplam Kazanç
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div
                  className={`text-xl font-semibold ${
                    totalProfit <
                    0
                      ? "text-destructive"
                      : ""
                  }`}
                >
                  {formatTry(
                    totalProfit
                  )}
                </div>
              </CardContent>
            </Card>

            {/* AVERAGE */}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Ortalama Kazanç
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="text-xl font-semibold">
                  {formatTry(
                    averageProfit
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* =================================================
            SEARCH
        ================================================= */}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Sistem, şablon veya ürün ara..."
              className="pl-9"
            />
          </div>

          <div className="text-sm text-muted-foreground">
            {
              filteredSystems.length
            }{" "}
            kayıt
          </div>
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
            LOADING
        ================================================= */}

        {loading ? (
          <div className="flex min-h-64 items-center justify-center rounded-xl border">
            <span className="text-sm text-muted-foreground">
              Hazır sistemler
              yükleniyor...
            </span>
          </div>
        ) : filteredSystems.length ===
          0 ? (
          /*
           * ===============================================
           * EMPTY
           * ===============================================
           */

          <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed text-center">
            <PackageCheck className="mb-4 size-10 text-muted-foreground" />

            <h2 className="font-semibold">
              Hazır sistem
              bulunamadı
            </h2>

            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Sistem Hazırlama
              ekranından bir sistemi
              hazır sistem olarak
              kaydettiğinizde burada
              görünecektir.
            </p>
          </div>
        ) : (
          /*
           * ===============================================
           * TABLE
           * ===============================================
           */

          <div className="w-full min-w-0 overflow-hidden rounded-xl border bg-card">
            <div className="w-full overflow-x-auto">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">
                      Sistem
                    </TableHead>


                    <TableHead className="text-center">
                      Ürün
                    </TableHead>

                    <TableHead className="text-right">
                      Ürünler
                    </TableHead>

                    <TableHead className="text-right">
                      İşçilik
                    </TableHead>

                    <TableHead className="text-right">
                      Komisyon
                    </TableHead>

                    <TableHead className="text-right">
                      İndirim
                    </TableHead>

                    <TableHead className="text-right">
                      Müşteri
                      Tutarı
                    </TableHead>

                    <TableHead className="text-right">
                      Kazanç
                    </TableHead>

                    <TableHead className="min-w-[150px]">
                      Tarih
                    </TableHead>

                    <TableHead className="w-[156px]" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredSystems.map(
                    (
                      system
                    ) => (
                      <TableRow
                        key={
                          system.id
                        }
                      >
                        {/* SYSTEM */}

                        <TableCell>
                          <div className="font-medium">
                            {
                              system.name
                            }
                          </div>

                          <div className="mt-1 flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="text-[10px]"
                            >
                              Hazır
                            </Badge>

                            <span className="text-xs text-muted-foreground">
                              Kur:{" "}
                              {system.exchangeRate.toLocaleString(
                                "tr-TR",
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 4,
                                }
                              )}
                            </span>
                          </div>
                        </TableCell>

                        {/* TEMPLATE */}


                        {/* PRODUCT COUNT */}

                        <TableCell className="text-center">
                          <Badge variant="outline">
                            {
                              system.items.length
                            }
                          </Badge>
                        </TableCell>

                        {/* PRODUCT TOTAL */}

                        <TableCell className="text-right">
                          <div className="font-medium">
                            {formatTry(
                              system.productTotalTry
                            )}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            {formatUsd(
                              system.productTotalUsd
                            )}
                          </div>
                        </TableCell>

                        {/* LABOR */}

                        <TableCell className="text-right">
                          <div className="font-medium">
                            {formatTry(
                              system.laborCostTry
                            )}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            {system.laborItems.length}{" "}
                            kalem
                          </div>
                        </TableCell>

                        {/* COMMISSION */}

                        <TableCell className="text-right">
                          <div className="font-medium">
                            {formatTry(
                              system.commissionAmountTry
                            )}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            %
                            {
                              system.commissionRate
                            }
                          </div>
                        </TableCell>

                        {/* DISCOUNT */}

                        <TableCell className="text-right">
                          {formatTry(
                            system.discountTry
                          )}
                        </TableCell>

                        {/* CUSTOMER TOTAL */}

                        <TableCell className="text-right font-semibold">
                          {formatTry(
                            system.customerTotalTry
                          )}
                        </TableCell>

                        {/* PROFIT */}

                        <TableCell
                          className={`text-right font-semibold ${
                            system.profitTry <
                            0
                              ? "text-destructive"
                              : ""
                          }`}
                        >
                          {formatTry(
                            system.profitTry
                          )}
                        </TableCell>

                        {/* DATE */}

                        <TableCell>
                          <div className="text-sm">
                            {formatDate(
                              system.readyAt ??
                                system.updatedAt
                            )}
                          </div>
                        </TableCell>

                        {/* DETAIL */}

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                editSystem(
                                  system
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
                              variant="ghost"
                              size="sm"
                              disabled={
                                copyingSystemId !==
                                  null
                              }
                              onClick={() => {
                                void copySystem(
                                  system
                                );
                              }}
                            >
                              {copyingSystemId ===
                              system.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Copy className="size-4" />
                              )}

                              <span className="sr-only">
                                Kopyala
                              </span>
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                openDetail(
                                  system
                                )
                              }
                            >
                              <Eye className="size-4" />

                              <span className="sr-only">
                                Detay
                              </span>
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
        )}
      </div>

      {/* ===================================================
          DETAIL DIALOG
      =================================================== */}

      <Dialog
        open={
          detailOpen
        }
        onOpenChange={(
          open
        ) => {
          setDetailOpen(
            open
          );

          if (!open) {
            setSelectedSystem(
              null
            );
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          {selectedSystem && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-4 pr-8">
                  <div className="min-w-0">
                    <DialogTitle>
                      {
                        selectedSystem.name
                      }
                    </DialogTitle>

                    <DialogDescription>
                      {selectedSystem.templateName
                        ? `${selectedSystem.templateName} şablonundan oluşturulan hazır sistem.`
                        : "Şablon kullanılmadan sıfırdan oluşturulan hazır sistem."}
                    </DialogDescription>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        copyingSystemId !==
                          null
                      }
                      onClick={() => {
                        void copySystem(
                          selectedSystem
                        );
                      }}
                    >
                      {copyingSystemId ===
                      selectedSystem.id ? (
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
                      onClick={() =>
                        editSystem(
                          selectedSystem
                        )
                      }
                    >
                      <Pencil className="size-4" />
                      Düzenle
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              {/* GENERAL */}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">
                    Kur
                  </div>

                  <div className="mt-1 font-semibold">
                    1 USD ={" "}
                    {selectedSystem.exchangeRate.toLocaleString(
                      "tr-TR",
                      {
                        minimumFractionDigits: 4,
                        maximumFractionDigits: 4,
                      }
                    )}{" "}
                    TL
                  </div>
                </div>

                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">
                    Ürün Sayısı
                  </div>

                  <div className="mt-1 font-semibold">
                    {
                      selectedSystem
                        .items
                        .length
                    }
                  </div>
                </div>

                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">
                    Komisyon
                  </div>

                  <div className="mt-1 font-semibold">
                    %
                    {
                      selectedSystem.commissionRate
                    }
                  </div>
                </div>

                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">
                    Hazır Tarihi
                  </div>

                  <div className="mt-1 text-sm font-semibold">
                    {formatDate(
                      selectedSystem.readyAt
                    )}
                  </div>
                </div>
              </div>

              {/* PRODUCTS */}

              <div className="space-y-3">
                <h3 className="font-semibold">
                  Sistem İçeriği
                </h3>

                <div className="space-y-2">
                  {selectedSystem.items.map(
                    (
                      item,
                      index
                    ) => {
                      const category =
                        productCategoryDefinitions[
                          item.category
                        ];

                      return (
                        <div
                          key={
                            item.id
                          }
                          className="grid gap-3 rounded-xl border p-3 md:grid-cols-[40px_minmax(0,1fr)_120px_140px]"
                        >
                          <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-xs font-semibold">
                            {index +
                              1}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">
                                {
                                  item.label
                                }
                              </span>

                              {item.source ===
                                "custom" && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  Ek Alan
                                </Badge>
                              )}
                            </div>

                            <div className="mt-1 text-sm">
                              {item.brand &&
                              item.model
                                ? `${item.brand} - ${item.model}`
                                : "-"}
                            </div>

                            <div className="mt-1 text-xs text-muted-foreground">
                              {
                                category.label
                              }

                              {item.productCode && (
                                <>
                                  {" "}
                                  •{" "}
                                  {
                                    item.productCode
                                  }
                                </>
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-muted-foreground">
                              Adet
                            </div>

                            <div className="mt-1 font-medium">
                              {
                                item.quantity
                              }
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">
                              Tutar
                            </div>

                            <div className="mt-1 font-semibold">
                              {formatUsd(
                                item.totalPriceUsd ??
                                  0
                              )}
                            </div>

                            {item.unitPriceUsd !==
                              undefined && (
                              <div className="text-xs text-muted-foreground">
                                {formatUsd(
                                  item.unitPriceUsd
                                )}{" "}
                                ×{" "}
                                {
                                  item.quantity
                                }
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              {/* LABOR ITEMS */}

              {selectedSystem.laborItems.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">
                    İşçilik Kalemleri
                  </h3>

                  <div className="space-y-2">
                    {selectedSystem.laborItems.map(
                      (laborItem) => (
                        <div
                          key={laborItem.id}
                          className="flex items-center justify-between gap-4 rounded-xl border px-3 py-2.5"
                        >
                          <span className="text-sm">
                            {laborItem.label}
                          </span>
                          <span className="font-medium">
                            {formatTry(
                              laborItem.amountTry
                            )}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* CALCULATION */}

              <div className="grid gap-5 border-t pt-5 lg:grid-cols-2">
                {/* LEFT */}

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Ürünler
                    </span>

                    <span>
                      {formatTry(
                        selectedSystem.productTotalTry
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      İşçilik
                    </span>

                    <span>
                      {formatTry(
                        selectedSystem.laborCostTry
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Komisyon
                    </span>

                    <span>
                      {formatTry(
                        selectedSystem.commissionAmountTry
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      İndirim
                    </span>

                    <span>
                      -
                      {formatTry(
                        selectedSystem.discountTry
                      )}
                    </span>
                  </div>
                </div>

                {/* RIGHT */}

                <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-bold">
                      Toplam Müşteri
                      Tutarı
                    </span>

                    <span className="text-xl font-bold">
                      {formatTry(
                        selectedSystem.customerTotalTry
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2 font-bold">
                      <TrendingUp className="size-4" />

                      Kazanç
                    </span>

                    <span
                      className={`text-xl font-bold ${
                        selectedSystem.profitTry <
                        0
                          ? "text-destructive"
                          : ""
                      }`}
                    >
                      {formatTry(
                        selectedSystem.profitTry
                      )}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Kazanç =
                    Komisyon +
                    İşçilik -
                    İndirim
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}