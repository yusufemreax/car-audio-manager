"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  CreditCard,
  Loader2,
  PackageCheck,
  Plus,
  RefreshCw,
  Store,
  WalletCards,
} from "lucide-react";

import type {
  ProductSupplier,
  SupplierBalanceMovement,
  SupplierOrder,
  SupplierSummary,
} from "@/types/supplier";

import {
  PRODUCT_SUPPLIERS,
} from "@/types/supplier";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Textarea,
} from "@/components/ui/textarea";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
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
  ).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}

function formatDate(
  value: string
) {
  const date =
    new Date(
      value
    );

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
      dateStyle: "short",
      timeStyle: "short",
    }
  ).format(date);
}

function orderSourceLabel(
  order: SupplierOrder
) {
  return order.source ===
    "manual_stock"
    ? "Manuel Stok"
    : "Müşteri Teklifi";
}

function movementLabel(
  movement:
    SupplierBalanceMovement
) {
  switch (
    movement.type
  ) {
    case "manual_topup":
      return "Manuel Bakiye";
    case "customer_card_credit":
      return "Müşteri Kart Tahsilatı";
    case "stock_purchase_balance_usage":
      return "Stok Alışında Bakiye Kullanımı";
    default:
      return "Bakiye Hareketi";
  }
}

export function SuppliersPageClient() {
  const [
    suppliers,
    setSuppliers,
  ] = useState<SupplierSummary[]>([]);

  const [
    selectedSupplier,
    setSelectedSupplier,
  ] = useState<ProductSupplier>(
    "EGB"
  );

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
    success,
    setSuccess,
  ] = useState<string | null>(
    null
  );

  const [
    balanceDialogOpen,
    setBalanceDialogOpen,
  ] = useState(false);

  const [
    balanceAmount,
    setBalanceAmount,
  ] = useState("");

  const [
    balanceNote,
    setBalanceNote,
  ] = useState("");

  const [
    addingBalance,
    setAddingBalance,
  ] = useState(false);

  const load =
    useCallback(
      async () => {
        try {
          setLoading(true);
          setError(null);

          const response =
            await fetch(
              "/api/suppliers",
              {
                cache:
                  "no-store",
              }
            );

          const result:
            ApiResponse<SupplierSummary[]> =
              await response.json();

          if (
            !response.ok ||
            !result.success
          ) {
            throw new Error(
              result.message ??
                "Tedarikçiler getirilemedi."
            );
          }

          setSuppliers(
            result.data ??
              []
          );
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : "Tedarikçiler getirilemedi."
          );
        } finally {
          setLoading(false);
        }
      },
      []
    );

  useEffect(() => {
    void load();
  }, [load]);

  const current =
    useMemo(
      () =>
        suppliers.find(
          (item) =>
            item.supplier ===
            selectedSupplier
        ) ?? null,
      [
        suppliers,
        selectedSupplier,
      ]
    );

  const allOrderTotal =
    current?.orders.reduce(
      (total, order) =>
        total +
        order.totalUsd,
      0
    ) ?? 0;

  const customerCardCredits =
    current?.balanceMovements
      .filter(
        (movement) =>
          movement.type ===
          "customer_card_credit"
      )
      .reduce(
        (total, movement) =>
          total +
          movement.amountUsd,
        0
      ) ?? 0;

  const addBalance =
    async () => {
      const amountUsd =
        Number(
          balanceAmount
        );

      if (
        !Number.isFinite(
          amountUsd
        ) ||
        amountUsd <= 0
      ) {
        setError(
          "Eklenecek USD bakiyesi 0'dan büyük olmalıdır."
        );
        return;
      }

      try {
        setAddingBalance(
          true
        );
        setError(null);
        setSuccess(null);

        const response =
          await fetch(
            `/api/suppliers/${encodeURIComponent(
              selectedSupplier
            )}/balance`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
                  amountUsd,
                  note:
                    balanceNote.trim(),
                }),
            }
          );

        const result:
          ApiResponse<SupplierSummary> =
            await response.json();

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.message ??
              "Bakiye eklenemedi."
          );
        }

        setBalanceDialogOpen(
          false
        );
        setBalanceAmount("");
        setBalanceNote("");
        setSuccess(
          `${selectedSupplier} bakiyesine ${formatUsd(
            amountUsd
          )} eklendi.`
        );

        await load();
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Bakiye eklenemedi."
        );
      } finally {
        setAddingBalance(
          false
        );
      }
    };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold md:text-3xl">
              <Store className="size-7" />
              Tedarikçiler
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tedarikçi bakiyelerini, ürün alışlarını ve müşteri kart tahsilatlarını takip edin.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => {
              void load();
            }}
          >
            <RefreshCw
              className={
                loading
                  ? "size-4 animate-spin"
                  : "size-4"
              }
            />
            Yenile
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {PRODUCT_SUPPLIERS.map(
            (supplier) => {
              const summary =
                suppliers.find(
                  (item) =>
                    item.supplier ===
                    supplier
                );

              const active =
                selectedSupplier ===
                supplier;

              return (
                <button
                  key={supplier}
                  type="button"
                  className={`rounded-2xl border p-5 text-left transition ${
                    active
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "bg-card hover:bg-muted/30"
                  }`}
                  onClick={() =>
                    setSelectedSupplier(
                      supplier
                    )
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">
                      {supplier}
                    </div>
                    <WalletCards className="size-5 text-muted-foreground" />
                  </div>
                  <div className="mt-4 text-2xl font-semibold tabular-nums">
                    {formatUsd(
                      summary?.balanceUsd ??
                        0
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Kullanılabilir bakiye
                  </div>
                </button>
              );
            }
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            {success}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-64 items-center justify-center rounded-2xl border">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : current ? (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Güncel Bakiye
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">
                    {formatUsd(
                      current.balanceUsd
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Sipariş Kaydı
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">
                    {current.orders.length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Sipariş Toplamı
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">
                    {formatUsd(
                      allOrderTotal
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Müşteri Kartından Gelen
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">
                    {formatUsd(
                      customerCardCredits
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">
                  {current.supplier}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Sipariş ve bakiye hareketleri
                </p>
              </div>

              <Button
                type="button"
                onClick={() => {
                  setBalanceAmount("");
                  setBalanceNote("");
                  setError(null);
                  setBalanceDialogOpen(
                    true
                  );
                }}
              >
                <Plus className="size-4" />
                Bakiye Ekle
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PackageCheck className="size-5" />
                  Sipariş / Stok Alışları
                </CardTitle>
              </CardHeader>
              <CardContent>
                {current.orders.length ===
                0 ? (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Henüz sipariş veya stok alış kaydı yok.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tarih</TableHead>
                          <TableHead>Kaynak</TableHead>
                          <TableHead>Ürün</TableHead>
                          <TableHead className="text-right">Adet</TableHead>
                          <TableHead className="text-right">Birim</TableHead>
                          <TableHead className="text-right">Toplam</TableHead>
                          <TableHead>Ödeme</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {current.orders.map(
                          (order) => (
                            <TableRow key={order.id}>
                              <TableCell className="whitespace-nowrap text-xs">
                                {formatDate(order.createdAt)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {orderSourceLabel(order)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">
                                  {[order.brand, order.model]
                                    .filter(Boolean)
                                    .join(" ") || order.productCode || "Ürün"}
                                </div>
                                {order.productCode && (
                                  <div className="text-xs text-muted-foreground">
                                    {order.productCode}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {order.quantity}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatUsd(order.unitPriceUsd)}
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {formatUsd(order.totalUsd)}
                              </TableCell>
                              <TableCell>
                                {order.source === "customer_offer_order" ? (
                                  <span className="text-xs text-muted-foreground">
                                    Teklif siparişi
                                  </span>
                                ) : order.paymentMethod === "balance" ? (
                                  <div className="text-xs">
                                    <div>
                                      Bakiye: {formatUsd(order.balanceUsedUsd ?? 0)}
                                    </div>
                                    <div className="text-muted-foreground">
                                      Kart: {formatUsd(order.cardAmountUsd ?? 0)}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-xs">
                                    <CreditCard className="size-3.5" />
                                    Kart {formatUsd(order.cardAmountUsd ?? order.totalUsd)}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CircleDollarSign className="size-5" />
                  Bakiye Hareketleri
                </CardTitle>
              </CardHeader>
              <CardContent>
                {current.balanceMovements.length ===
                0 ? (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Henüz bakiye hareketi yok.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tarih</TableHead>
                          <TableHead>Hareket</TableHead>
                          <TableHead>Açıklama</TableHead>
                          <TableHead className="text-right">Tutar</TableHead>
                          <TableHead className="text-right">Son Bakiye</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {current.balanceMovements.map(
                          (movement) => {
                            const positive =
                              movement.amountUsd > 0;

                            return (
                              <TableRow key={movement.id}>
                                <TableCell className="whitespace-nowrap text-xs">
                                  {formatDate(movement.createdAt)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {positive ? (
                                      <ArrowUpRight className="size-4 text-emerald-500" />
                                    ) : (
                                      <ArrowDownRight className="size-4 text-rose-500" />
                                    )}
                                    <span className="text-sm">
                                      {movementLabel(movement)}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="max-w-80 text-sm text-muted-foreground">
                                  {movement.note ?? "-"}
                                </TableCell>
                                <TableCell className={`text-right font-semibold tabular-nums ${
                                  positive
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400"
                                }`}>
                                  {positive ? "+" : ""}{formatUsd(movement.amountUsd)}
                                </TableCell>
                                <TableCell className="text-right font-medium tabular-nums">
                                  {formatUsd(movement.balanceAfterUsd)}
                                </TableCell>
                              </TableRow>
                            );
                          }
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <Dialog
        open={balanceDialogOpen}
        onOpenChange={
          setBalanceDialogOpen
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <WalletCards className="size-5" />
              Bakiye Ekle
            </DialogTitle>
            <DialogDescription>
              {selectedSupplier} hesabına kendi kartınızdan veya başka bir kaynaktan USD bakiye ekleyin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supplierBalanceAmount">
                Tutar (USD)
              </Label>
              <Input
                id="supplierBalanceAmount"
                type="number"
                min="0.01"
                step="0.01"
                value={balanceAmount}
                disabled={addingBalance}
                onChange={(event) =>
                  setBalanceAmount(
                    event.target.value
                  )
                }
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplierBalanceNote">
                Açıklama
              </Label>
              <Textarea
                id="supplierBalanceNote"
                value={balanceNote}
                disabled={addingBalance}
                onChange={(event) =>
                  setBalanceNote(
                    event.target.value
                  )
                }
                placeholder="Örn: Kendi kredi kartımdan bakiye aktarımı"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={addingBalance}
              onClick={() =>
                setBalanceDialogOpen(
                  false
                )
              }
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={addingBalance}
              onClick={() => {
                void addBalance();
              }}
            >
              {addingBalance && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Bakiyeyi Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
