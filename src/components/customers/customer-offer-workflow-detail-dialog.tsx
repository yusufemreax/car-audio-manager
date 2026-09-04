/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  Box,
  CreditCard,
  Loader2,
  PackageCheck,
  WalletCards,
} from "lucide-react";

import type {
  CustomerSystemOffer,
} from "@/types/customer-system-offer";

import type {
  CustomerOfferOrderSupplierPayment,
  CustomerOfferOrderSupplierSelection,
  CustomerOfferStockRequirement,
} from "@/types/customer-offer-workflow";

import {
  DEFAULT_PRODUCT_SUPPLIERS,
  PRODUCT_SUPPLIERS,
  type ProductSupplier,
  type SupplierPurchasePaymentMethod,
  type SupplierSummary,
} from "@/types/supplier";

import {
  Badge,
} from "@/components/ui/badge";

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

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CustomerOfferWorkflowDetailDialogProps {
  open: boolean;
  onOpenChange:
    (open: boolean) => void;
  offer:
    CustomerSystemOffer | null;
  stockRequirements:
    CustomerOfferStockRequirement[];
  loading?: boolean;
  processing?: boolean;
  onOrderCompleted?: (
    selections:
      CustomerOfferOrderSupplierSelection[],
    supplierPayments:
      CustomerOfferOrderSupplierPayment[]
  ) => Promise<boolean>;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

interface SupplierPaymentDraft {
  paymentMethod:
    SupplierPurchasePaymentMethod;
  balanceUsedUsd: string;
}

interface SupplierOrderGroup {
  supplier: ProductSupplier;
  totalUsd: number;
  productCount: number;
  totalQuantity: number;
}

function createDefaultPaymentDrafts(): Record<
  ProductSupplier,
  SupplierPaymentDraft
> {
  return {
    EGB: {
      paymentMethod:
        "card",
      balanceUsedUsd:
        "0",
    },
    OZDEMIR: {
      paymentMethod:
        "card",
      balanceUsedUsd:
        "0",
    },
    Diğer: {
      paymentMethod:
        "card",
      balanceUsedUsd:
        "0",
    },
  };
}

function roundMoney(
  value: number
) {
  return Math.round(
    (value + Number.EPSILON) *
      100
  ) / 100;
}

function formatTry(
  value: number
) {
  return new Intl.NumberFormat(
    "tr-TR",
    {
      style:
        "currency",
      currency:
        "TRY",
      minimumFractionDigits:
        2,
      maximumFractionDigits:
        2,
    }
  ).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}

function formatUsd(
  value: number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style:
        "currency",
      currency:
        "USD",
      minimumFractionDigits:
        2,
      maximumFractionDigits:
        2,
    }
  ).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}

function isWorkflowFinalized(
  offer:
    CustomerSystemOffer
) {
  return (
    Reflect.get(
      offer,
      "workflowFinalized"
    ) === true ||
    String(
      offer.status
    ) === "completed"
  );
}

function getStatusLabel(
  offer:
    CustomerSystemOffer
) {
  const status =
    String(
      offer.status
    );

  if (
    isWorkflowFinalized(
      offer
    )
  ) {
    return "Satıldı";
  }

  switch (status) {
    case "order_pending":
      return "Sipariş";
    case "installation_pending":
      return "Montaj Bekliyor";
    case "sold":
      return "Eski Satış";
    default:
      return "Teklif";
  }
}

function getProductName(
  item: {
    productCode?: string;
    brand?: string;
    model?: string;
    label?: string;
  }
) {
  const name = [
    item.brand,
    item.model,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    name ||
    item.label ||
    item.productCode ||
    "Ürün"
  );
}

function getDefaultSupplier(
  requirement:
    CustomerOfferStockRequirement
): ProductSupplier {
  const egb =
    DEFAULT_PRODUCT_SUPPLIERS[0];

  if (
    requirement.suppliers.includes(
      egb
    )
  ) {
    return egb;
  }

  return (
    requirement.suppliers[0] ??
    egb
  );
}

function getMissingTotalUsd(
  requirement:
    CustomerOfferStockRequirement
) {
  const stored =
    Number(
      requirement.missingTotalUsd
    );

  if (
    Number.isFinite(
      stored
    )
  ) {
    return roundMoney(
      Math.max(
        0,
        stored
      )
    );
  }

  return roundMoney(
    Math.max(
      0,
      Number(
        requirement.unitPriceUsd
      ) || 0
    ) *
      Math.max(
        0,
        requirement.missingQuantity
      )
  );
}

export function CustomerOfferWorkflowDetailDialog({
  open,
  onOpenChange,
  offer,
  stockRequirements,
  loading = false,
  processing = false,
  onOrderCompleted,
}: CustomerOfferWorkflowDetailDialogProps) {
  const [
    supplierByProductId,
    setSupplierByProductId,
  ] = useState<Record<string, ProductSupplier>>({});

  const [
    paymentBySupplier,
    setPaymentBySupplier,
  ] = useState<
    Record<
      ProductSupplier,
      SupplierPaymentDraft
    >
  >(
    createDefaultPaymentDrafts
  );

  const [
    supplierSummaries,
    setSupplierSummaries,
  ] = useState<SupplierSummary[]>([]);

  const [
    loadingSupplierBalances,
    setLoadingSupplierBalances,
  ] = useState(false);

  const [
    supplierLoadError,
    setSupplierLoadError,
  ] = useState<string | null>(
    null
  );

  const [
    validationError,
    setValidationError,
  ] = useState<string | null>(
    null
  );

  const status =
    offer
      ? String(
          offer.status
        )
      : "";

  const missingProducts =
    useMemo(
      () =>
        stockRequirements.filter(
          (item) =>
            item.missingQuantity >
            0
        ),
      [stockRequirements]
    );

  useEffect(() => {
    if (!open) {
      return;
    }

    const defaults:
      Record<
        string,
        ProductSupplier
      > = {};

    for (
      const requirement of
        missingProducts
    ) {
      defaults[
        requirement.productId
      ] =
        getDefaultSupplier(
          requirement
        );
    }

    setSupplierByProductId(
      defaults
    );
    setPaymentBySupplier(
      createDefaultPaymentDrafts()
    );
    setValidationError(
      null
    );
    setSupplierLoadError(
      null
    );
  }, [
    open,
    offer?.id,
    missingProducts,
  ]);

  useEffect(() => {
    if (
      !open ||
      status !==
        "order_pending"
    ) {
      return;
    }

    let cancelled =
      false;

    const loadSuppliers =
      async () => {
        setLoadingSupplierBalances(
          true
        );
        setSupplierLoadError(
          null
        );

        try {
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
                "Tedarikçi bakiyeleri alınamadı."
            );
          }

          if (!cancelled) {
            setSupplierSummaries(
              result.data ?? []
            );
          }
        } catch (error) {
          if (!cancelled) {
            setSupplierLoadError(
              error instanceof Error
                ? error.message
                : "Tedarikçi bakiyeleri alınamadı."
            );
          }
        } finally {
          if (!cancelled) {
            setLoadingSupplierBalances(
              false
            );
          }
        }
      };

    void loadSuppliers();

    return () => {
      cancelled =
        true;
    };
  }, [
    open,
    status,
    offer?.id,
  ]);

  const supplierGroups =
    useMemo(() => {
      const groups =
        new Map<
          ProductSupplier,
          SupplierOrderGroup
        >();

      for (
        const requirement of
          missingProducts
      ) {
        const supplier =
          supplierByProductId[
            requirement.productId
          ];

        if (!supplier) {
          continue;
        }

        const current =
          groups.get(
            supplier
          );

        const totalUsd =
          getMissingTotalUsd(
            requirement
          );

        if (current) {
          current.totalUsd =
            roundMoney(
              current.totalUsd +
                totalUsd
            );
          current.productCount +=
            1;
          current.totalQuantity +=
            requirement.missingQuantity;
          continue;
        }

        groups.set(
          supplier,
          {
            supplier,
            totalUsd,
            productCount:
              1,
            totalQuantity:
              requirement.missingQuantity,
          }
        );
      }

      return PRODUCT_SUPPLIERS
        .map(
          (supplier) =>
            groups.get(
              supplier
            )
        )
        .filter(
          (
            group
          ): group is SupplierOrderGroup =>
            Boolean(group)
        );
    }, [
      missingProducts,
      supplierByProductId,
    ]);

  const getSupplierBalance = (
    supplier:
      ProductSupplier
  ) =>
    supplierSummaries.find(
      (item) =>
        item.supplier ===
        supplier
    )?.balanceUsd ?? 0;

  const paymentSummary =
    useMemo(() => {
      let orderTotalUsd =
        0;
      let balanceUsedUsd =
        0;
      let cardAmountUsd =
        0;

      for (
        const group of
          supplierGroups
      ) {
        const draft =
          paymentBySupplier[
            group.supplier
          ];

        const used =
          draft.paymentMethod ===
            "balance"
            ? Math.max(
                0,
                roundMoney(
                  Number(
                    draft.balanceUsedUsd
                  ) || 0
                )
              )
            : 0;

        orderTotalUsd =
          roundMoney(
            orderTotalUsd +
              group.totalUsd
          );
        balanceUsedUsd =
          roundMoney(
            balanceUsedUsd +
              used
          );
        cardAmountUsd =
          roundMoney(
            cardAmountUsd +
              Math.max(
                0,
                group.totalUsd -
                  used
              )
          );
      }

      return {
        orderTotalUsd,
        balanceUsedUsd,
        cardAmountUsd,
      };
    }, [
      supplierGroups,
      paymentBySupplier,
    ]);

  const handleOrderCompleted =
    async () => {
      if (
        !offer ||
        status !==
          "order_pending" ||
        !onOrderCompleted
      ) {
        return;
      }

      const selections:
        CustomerOfferOrderSupplierSelection[] = [];

      for (
        const requirement of
          missingProducts
      ) {
        const supplier =
          supplierByProductId[
            requirement.productId
          ];

        if (!supplier) {
          setValidationError(
            `${getProductName(
              requirement
            )} için tedarikçi seçiniz.`
          );
          return;
        }

        if (
          !requirement.suppliers.includes(
            supplier
          )
        ) {
          setValidationError(
            `${supplier}, ${getProductName(
              requirement
            )} için geçerli bir tedarikçi değil.`
          );
          return;
        }

        selections.push({
          productId:
            requirement.productId,
          supplier,
        });
      }

      const supplierPayments:
        CustomerOfferOrderSupplierPayment[] = [];

      for (
        const group of
          supplierGroups
      ) {
        const draft =
          paymentBySupplier[
            group.supplier
          ];

        const balanceUsedUsd =
          draft.paymentMethod ===
            "balance"
            ? Math.max(
                0,
                roundMoney(
                  Number(
                    draft.balanceUsedUsd
                  ) || 0
                )
              )
            : 0;

        if (
          draft.paymentMethod ===
            "balance" &&
          balanceUsedUsd <= 0
        ) {
          setValidationError(
            `${group.supplier} için bakiyeden kullanılacak USD tutarını giriniz.`
          );
          return;
        }

        if (
          balanceUsedUsd >
          group.totalUsd
        ) {
          setValidationError(
            `${group.supplier} için bakiyeden kullanılacak tutar sipariş toplamından büyük olamaz.`
          );
          return;
        }

        if (
          balanceUsedUsd >
          getSupplierBalance(
            group.supplier
          )
        ) {
          setValidationError(
            `${group.supplier} bakiyesi yetersiz.`
          );
          return;
        }

        supplierPayments.push({
          supplier:
            group.supplier,
          paymentMethod:
            draft.paymentMethod,
          balanceUsedUsd,
        });
      }

      setValidationError(
        null
      );

      const completed =
        await onOrderCompleted(
          selections,
          supplierPayments
        );

      if (completed) {
        onOpenChange(
          false
        );
      }
    };

  return (
    <Dialog
      open={open}
      onOpenChange={
        onOpenChange
      }
    >
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden sm:max-w-6xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Box className="size-5" />

            {offer?.systemSnapshot
              .name ??
              "Teklif Detayı"}

            {offer && (
              <Badge variant="secondary">
                {getStatusLabel(
                  offer
                )}
              </Badge>
            )}
          </DialogTitle>

          <DialogDescription>
            Teklif ürünlerini, eksik stokları, tedarikçileri ve sipariş ödeme dağılımını buradan yönetebilirsiniz.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
              Teklif detayı yükleniyor...
            </div>
          ) : !offer ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Teklif detayı bulunamadı.
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="text-xs text-muted-foreground">
                    Teklif Tutarı
                  </div>
                  <div className="mt-1 font-semibold">
                    {formatTry(
                      offer.finalCustomerTotalTry
                    )}
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="text-xs text-muted-foreground">
                    Ek İndirim
                  </div>
                  <div className="mt-1 font-semibold">
                    {formatTry(
                      offer.extraDiscountTry
                    )}
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="text-xs text-muted-foreground">
                    Kazanç
                  </div>
                  <div className="mt-1 font-semibold">
                    {formatTry(
                      offer.finalProfitTry
                    )}
                  </div>
                </div>
              </div>

              {status ===
                "order_pending" && (
                <div className="space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="size-4 text-amber-500" />
                      <h3 className="font-semibold">
                        Sipariş Edilmesi Gereken Ürünler
                      </h3>
                    </div>

                    {missingProducts.length ===
                    0 ? (
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
                        Şu anda eksik ürün görünmüyor. Sipariş Tamamlandı ile montaj adımına geçebilirsiniz.
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>
                                Ürün
                              </TableHead>
                              <TableHead className="text-right">
                                Sipariş
                              </TableHead>
                              <TableHead className="text-right">
                                Birim $
                              </TableHead>
                              <TableHead className="text-right">
                                Toplam $
                              </TableHead>
                              <TableHead className="min-w-44">
                                Tedarikçi
                              </TableHead>
                            </TableRow>
                          </TableHeader>

                          <TableBody>
                            {missingProducts.map(
                              (item) => {
                                const supplierItems =
                                  item.suppliers.map(
                                    (supplier) => ({
                                      value:
                                        supplier,
                                      label:
                                        supplier,
                                    })
                                  );

                                return (
                                  <TableRow key={item.productId}>
                                    <TableCell>
                                      <div className="font-medium">
                                        {getProductName(
                                          item
                                        )}
                                      </div>
                                      {item.productCode && (
                                        <div className="mt-0.5 text-xs text-muted-foreground">
                                          {item.productCode}
                                        </div>
                                      )}
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        İhtiyaç {item.requiredQuantity} • Stok {item.availableQuantity}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                                      {item.missingQuantity}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                      {formatUsd(
                                        item.unitPriceUsd
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold tabular-nums">
                                      {formatUsd(
                                        getMissingTotalUsd(
                                          item
                                        )
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <Select
                                        items={
                                          supplierItems
                                        }
                                        value={
                                          supplierByProductId[
                                            item.productId
                                          ] ??
                                          null
                                        }
                                        onValueChange={(
                                          value
                                        ) => {
                                          if (!value) {
                                            return;
                                          }

                                          const supplier =
                                            item.suppliers.find(
                                              (current) =>
                                                current ===
                                                value
                                            );

                                          if (!supplier) {
                                            return;
                                          }

                                          setSupplierByProductId(
                                            (previous) => ({
                                              ...previous,
                                              [item.productId]:
                                                supplier,
                                            })
                                          );
                                          setValidationError(
                                            null
                                          );
                                        }}
                                        disabled={
                                          processing
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Tedarikçi seç" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {item.suppliers.map(
                                            (supplier) => (
                                              <SelectItem
                                                key={
                                                  supplier
                                                }
                                                value={
                                                  supplier
                                                }
                                              >
                                                {supplier}
                                              </SelectItem>
                                            )
                                          )}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                  </TableRow>
                                );
                              }
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  {missingProducts.length >
                    0 && (
                    <div className="space-y-3">
                      <div>
                        <h3 className="font-semibold">
                          Tedarikçi Bazlı Sipariş ve Ödeme
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Aynı tedarikçiden seçilen bütün ürünlerin USD toplamı tek ödeme olarak hesaplanır.
                        </p>
                      </div>

                      {supplierLoadError && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                          {supplierLoadError}
                        </div>
                      )}

                      <div className="space-y-3">
                        {supplierGroups.map(
                          (group) => {
                            const draft =
                              paymentBySupplier[
                                group.supplier
                              ];

                            const currentBalance =
                              getSupplierBalance(
                                group.supplier
                              );

                            const balanceUsed =
                              draft.paymentMethod ===
                                "balance"
                                ? Math.max(
                                    0,
                                    roundMoney(
                                      Number(
                                        draft.balanceUsedUsd
                                      ) || 0
                                    )
                                  )
                                : 0;

                            const cardAmount =
                              Math.max(
                                0,
                                roundMoney(
                                  group.totalUsd -
                                    balanceUsed
                                )
                              );

                            const paymentItems = [
                              {
                                value:
                                  "card",
                                label:
                                  "Kart",
                              },
                              {
                                value:
                                  "balance",
                                label:
                                  "Bakiye + Kart",
                              },
                            ];

                            return (
                              <div
                                key={
                                  group.supplier
                                }
                                className="rounded-xl border bg-muted/10 p-4"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <Badge>
                                        {group.supplier}
                                      </Badge>
                                      <span className="text-sm text-muted-foreground">
                                        {group.productCount} ürün • {group.totalQuantity} adet
                                      </span>
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    <div className="text-xs text-muted-foreground">
                                      Sipariş Toplamı
                                    </div>
                                    <div className="font-semibold">
                                      {formatUsd(
                                        group.totalUsd
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                  <div className="rounded-lg border bg-background p-3">
                                    <div className="text-xs text-muted-foreground">
                                      {group.supplier} Bakiyesi
                                    </div>
                                    <div className="mt-1 font-semibold">
                                      {loadingSupplierBalances
                                        ? "..."
                                        : formatUsd(
                                            currentBalance
                                          )}
                                    </div>
                                  </div>

                                  <div className="rounded-lg border bg-background p-3">
                                    <div className="text-xs text-muted-foreground">
                                      Bakiyeden
                                    </div>
                                    <div className="mt-1 font-semibold">
                                      {formatUsd(
                                        balanceUsed
                                      )}
                                    </div>
                                  </div>

                                  <div className="rounded-lg border bg-background p-3">
                                    <div className="text-xs text-muted-foreground">
                                      Kart Tutarı
                                    </div>
                                    <div className="mt-1 font-semibold">
                                      {formatUsd(
                                        cardAmount
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label>
                                      Ödeme Yöntemi
                                    </Label>

                                    <Select
                                      items={
                                        paymentItems
                                      }
                                      value={
                                        draft.paymentMethod
                                      }
                                      disabled={
                                        processing
                                      }
                                      onValueChange={(
                                        value
                                      ) => {
                                        const nextMethod:
                                          SupplierPurchasePaymentMethod =
                                            value ===
                                            "balance"
                                              ? "balance"
                                              : "card";

                                        setPaymentBySupplier(
                                          (previous) => ({
                                            ...previous,
                                            [group.supplier]: {
                                              ...previous[
                                                group.supplier
                                              ],
                                              paymentMethod:
                                                nextMethod,
                                              ...(nextMethod ===
                                              "card"
                                                ? {
                                                    balanceUsedUsd:
                                                      "0",
                                                  }
                                                : {}),
                                            },
                                          })
                                        );
                                        setValidationError(
                                          null
                                        );
                                      }}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="card">
                                          Kart
                                        </SelectItem>
                                        <SelectItem value="balance">
                                          Bakiye + Kart
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {draft.paymentMethod ===
                                  "balance" ? (
                                    <div className="space-y-2">
                                      <Label>
                                        Bakiyeden Kullanılacak ($)
                                      </Label>
                                      <div className="relative">
                                        <WalletCards className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          className="pl-9"
                                          value={
                                            draft.balanceUsedUsd
                                          }
                                          disabled={
                                            processing ||
                                            loadingSupplierBalances
                                          }
                                          onChange={(
                                            event
                                          ) => {
                                            setPaymentBySupplier(
                                              (previous) => ({
                                                ...previous,
                                                [group.supplier]: {
                                                  ...previous[
                                                    group.supplier
                                                  ],
                                                  balanceUsedUsd:
                                                    event.target.value,
                                                },
                                              })
                                            );
                                            setValidationError(
                                              null
                                            );
                                          }}
                                        />
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        En fazla {formatUsd(
                                          Math.min(
                                            currentBalance,
                                            group.totalUsd
                                          )
                                        )} kullanabilirsiniz. Kalan {formatUsd(
                                          cardAmount
                                        )} kart olarak kaydedilir.
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm sm:self-end">
                                      <CreditCard className="size-4 text-muted-foreground" />
                                      Toplamın tamamı kart ödemesi olarak kaydedilecek.
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>

                      <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-3">
                        <div>
                          <div className="text-xs text-muted-foreground">
                            Genel Sipariş Toplamı
                          </div>
                          <div className="mt-1 font-semibold">
                            {formatUsd(
                              paymentSummary.orderTotalUsd
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">
                            Toplam Bakiye Kullanımı
                          </div>
                          <div className="mt-1 font-semibold">
                            {formatUsd(
                              paymentSummary.balanceUsedUsd
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">
                            Toplam Kart
                          </div>
                          <div className="mt-1 font-semibold">
                            {formatUsd(
                              paymentSummary.cardAmountUsd
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <PackageCheck className="size-4" />
                  <h3 className="font-semibold">
                    Teklif Ürünleri
                  </h3>
                </div>

                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          Alan
                        </TableHead>
                        <TableHead>
                          Ürün
                        </TableHead>
                        <TableHead>
                          Kod
                        </TableHead>
                        <TableHead className="text-right">
                          Adet
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {offer.systemSnapshot.items.map(
                        (item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              {item.label}
                            </TableCell>
                            <TableCell className="font-medium">
                              {getProductName(
                                item
                              )}
                            </TableCell>
                            <TableCell>
                              {item.productCode ??
                                "-"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {item.quantity}
                            </TableCell>
                          </TableRow>
                        )
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {validationError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {validationError}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={
              processing
            }
            onClick={() =>
              onOpenChange(
                false
              )
            }
          >
            Kapat
          </Button>

          {offer &&
            status ===
              "order_pending" &&
            onOrderCompleted && (
              <Button
                type="button"
                disabled={
                  loading ||
                  processing ||
                  loadingSupplierBalances
                }
                onClick={() => {
                  void handleOrderCompleted();
                }}
              >
                {processing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <PackageCheck className="size-4" />
                )}
                {processing
                  ? "İşleniyor..."
                  : "Sipariş Tamamlandı"}
              </Button>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
