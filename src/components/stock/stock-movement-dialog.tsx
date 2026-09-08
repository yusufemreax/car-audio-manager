/* eslint-disable react-hooks/set-state-in-effect */

"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CreditCard,
  Minus,
  Plus,
  WalletCards,
} from "lucide-react";

import {
  InventoryProduct,
  StockMovementType,
} from "@/types/inventory";

import {
  DEFAULT_PRODUCT_SUPPLIERS,
  PRODUCT_SUPPLIERS,
  isProductSupplier,
  type ProductSupplier,
  type SupplierPurchasePaymentMethod,
  type SupplierSummary,
} from "@/types/supplier";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface StockMovementPayload {
  type: StockMovementType;
  quantity: number;
  note?: string;

  /*
   * Yalnızca stok girişinde gönderilir.
   */
  supplier?: ProductSupplier;
  paymentMethod?: SupplierPurchasePaymentMethod;
  balanceUsedUsd?: number;
  customerCardAmountTry?: number;
  exchangeRate?: number;
  exchangeRateDate?: string;
}

interface StockMovementDialogProps {
  open: boolean;
  onOpenChange: (
    open: boolean
  ) => void;
  product:
    | InventoryProduct
    | null;
  type: StockMovementType;
  onSubmit: (
    payload: StockMovementPayload
  ) => Promise<void>;
  usdTryRate?: number | null;
  exchangeRateDate?: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

function roundMoney(
  value: number
) {
  return Math.round(
    (value + Number.EPSILON) *
      100
  ) / 100;
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

function formatTry(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function StockMovementDialog({
  open,
  onOpenChange,
  product,
  type,
  onSubmit,
  usdTryRate = null,
  exchangeRateDate = null,
}: StockMovementDialogProps) {
  const [
    quantity,
    setQuantity,
  ] = useState("");

  const [
    note,
    setNote,
  ] = useState("");

  const [
    supplier,
    setSupplier,
  ] = useState<ProductSupplier>(
    "EGB"
  );

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState<SupplierPurchasePaymentMethod>(
    "card"
  );

  const [
    balanceUsedUsd,
    setBalanceUsedUsd,
  ] = useState("0");

  const [
    customerCardAmountTry,
    setCustomerCardAmountTry,
  ] = useState("");

  const [
    suppliers,
    setSuppliers,
  ] = useState<SupplierSummary[]>([]);

  const [
    loadingSuppliers,
    setLoadingSuppliers,
  ] = useState(false);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    submitError,
    setSubmitError,
  ] = useState<string | null>(
    null
  );

  const isStockIn =
    type === "in";

  const allowedSuppliers =
    useMemo(
      () => {
        const productSuppliers =
          product?.suppliers?.length
            ? product.suppliers
            : [...DEFAULT_PRODUCT_SUPPLIERS];

        return PRODUCT_SUPPLIERS.filter(
          (item) =>
            productSuppliers.includes(
              item
            )
        );
      },
      [product]
    );

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuantity("");
    setNote("");
    setPaymentMethod(
      "card"
    );
    setBalanceUsedUsd(
      "0"
    );
    setCustomerCardAmountTry("");
    setSubmitError(null);

    const defaultSupplier =
      allowedSuppliers.includes(
        "EGB"
      )
        ? "EGB"
        : allowedSuppliers[0] ??
          "EGB";

    setSupplier(
      defaultSupplier
    );
  }, [
    open,
    product?.id,
    type,
    allowedSuppliers,
  ]);

  useEffect(() => {
    if (
      !open ||
      !isStockIn
    ) {
      return;
    }

    let cancelled =
      false;

    const loadSuppliers =
      async () => {
        setLoadingSuppliers(
          true
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
            setSuppliers(
              result.data ?? []
            );
          }
        } catch (error) {
          if (!cancelled) {
            setSubmitError(
              error instanceof Error
                ? error.message
                : "Tedarikçi bakiyeleri alınamadı."
            );
          }
        } finally {
          if (!cancelled) {
            setLoadingSuppliers(
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
    isStockIn,
  ]);

  const numericQuantity =
    Number(quantity);

  const newQuantity =
    useMemo(() => {
      if (
        !product ||
        !Number.isFinite(
          numericQuantity
        ) ||
        numericQuantity <= 0
      ) {
        return product?.stockQuantity ?? 0;
      }

      if (isStockIn) {
        return (
          product.stockQuantity +
          numericQuantity
        );
      }

      return (
        product.stockQuantity -
        numericQuantity
      );
    }, [
      product,
      numericQuantity,
      isStockIn,
    ]);

  const purchaseTotalUsd =
    roundMoney(
      (product?.priceUsd ?? 0) *
        (
          Number.isInteger(
            numericQuantity
          ) &&
          numericQuantity > 0
            ? numericQuantity
            : 0
        )
    );

  const currentSupplierBalance =
    suppliers.find(
      (item) =>
        item.supplier ===
        supplier
    )?.balanceUsd ?? 0;

  const balanceUsedNumber =
    paymentMethod === "balance"
      ? Math.max(
          0,
          roundMoney(
            Number(
              balanceUsedUsd
            ) || 0
          )
        )
      : 0;

  const cardAmountUsd =
    Math.max(
      0,
      roundMoney(
        purchaseTotalUsd -
          balanceUsedNumber
      )
    );

  const effectiveRate =
    Math.max(0, Number(usdTryRate ?? 0) || 0);
  const purchaseTotalTry =
    roundMoney(purchaseTotalUsd * effectiveRate);
  const customerCardTryNumber =
    Math.max(0, roundMoney(Number(customerCardAmountTry) || 0));
  const customerCardChargedUsd =
    effectiveRate > 0
      ? roundMoney(customerCardTryNumber / effectiveRate)
      : 0;
  const customerCardSurplusUsd =
    paymentMethod === "customer_card"
      ? Math.max(0, roundMoney(customerCardChargedUsd - purchaseTotalUsd))
      : 0;
  const customerCardSurplusTry =
    roundMoney(customerCardSurplusUsd * effectiveRate);

  const supplierItems =
    allowedSuppliers.map(
      (item) => ({
        value: item,
        label: item,
      })
    );

  const paymentItems = [
    { value: "card", label: "Kendi Kartım" },
    { value: "customer_card", label: "Müşteri Kartı" },
    { value: "balance", label: "Bakiye + Kendi Kartım" },
  ];

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!product) {
      return;
    }

    setSubmitError(null);

    if (
      !Number.isInteger(
        numericQuantity
      ) ||
      numericQuantity <= 0
    ) {
      setSubmitError(
        "Miktar sıfırdan büyük tam sayı olmalıdır."
      );
      return;
    }

    if (
      !isStockIn &&
      numericQuantity >
        product.stockQuantity
    ) {
      setSubmitError(
        `Stokta yalnızca ${product.stockQuantity} adet ürün bulunuyor.`
      );
      return;
    }

    if (isStockIn) {
      if (
        !allowedSuppliers.includes(
          supplier
        )
      ) {
        setSubmitError(
          "Bu ürün için geçerli bir tedarikçi seçiniz."
        );
        return;
      }

      if (
        paymentMethod ===
          "balance" &&
        balanceUsedNumber <= 0
      ) {
        setSubmitError(
          "Bakiyeden kullanılacak USD tutarını giriniz."
        );
        return;
      }

      if (
        balanceUsedNumber >
        purchaseTotalUsd
      ) {
        setSubmitError(
          "Bakiyeden kullanılacak tutar alış toplamından büyük olamaz."
        );
        return;
      }

      if (
        balanceUsedNumber >
        currentSupplierBalance
      ) {
        setSubmitError(
          `${supplier} bakiyesi yetersiz.`
        );
        return;
      }

      if (paymentMethod === "customer_card") {
        if (effectiveRate <= 0) {
          setSubmitError("Müşteri kartı için geçerli USD/TRY kuru bulunamadı.");
          return;
        }
        if (customerCardTryNumber <= 0) {
          setSubmitError("Müşteri kartından çekilen TL tutarını giriniz.");
          return;
        }
        if (customerCardChargedUsd < purchaseTotalUsd) {
          setSubmitError(
            `Müşteri kartı alış toplamını karşılamıyor. En az ${formatTry(purchaseTotalTry)} çekilmelidir.`
          );
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      await onSubmit({
        type,
        quantity:
          numericQuantity,
        note:
          note.trim() ||
          undefined,
        ...(isStockIn
          ? {
              supplier,
              paymentMethod,
              balanceUsedUsd:
                balanceUsedNumber,
              ...(effectiveRate > 0 ? { exchangeRate: effectiveRate } : {}),
              ...(exchangeRateDate ? { exchangeRateDate } : {}),
              ...(paymentMethod === "customer_card"
                ? { customerCardAmountTry: customerCardTryNumber }
                : {}),
            }
          : {}),
      });

      onOpenChange(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Stok işlemi gerçekleştirilemedi."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!product) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (submitting) {
          return;
        }

        onOpenChange(newOpen);
      }}
    >
      <DialogContent
        className={
          isStockIn
            ? "max-h-[92vh] overflow-y-auto sm:max-w-xl"
            : "sm:max-w-md"
        }
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isStockIn ? (
              <Plus className="size-5" />
            ) : (
              <Minus className="size-5" />
            )}

            {isStockIn
              ? "Stok Ekle"
              : "Stok Çıkar"}
          </DialogTitle>

          <DialogDescription>
            {product.brand}{" "}
            {product.model}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={
            handleSubmit
          }
          className="space-y-5"
        >
          {/* CURRENT STOCK */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">
                Mevcut Stok
              </div>

              <div className="mt-1 text-2xl font-semibold">
                {
                  product.stockQuantity
                }
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">
                İşlem Sonrası
              </div>

              <div
                className={`mt-1 text-2xl font-semibold ${
                  newQuantity < 0
                    ? "text-destructive"
                    : ""
                }`}
              >
                {newQuantity}
              </div>
            </div>
          </div>

          {/* QUANTITY */}
          <div className="space-y-2">
            <Label htmlFor="stockQuantity">
              Miktar
              <span className="ml-1 text-destructive">
                *
              </span>
            </Label>

            <Input
              id="stockQuantity"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(event) =>
                setQuantity(
                  event.target.value
                )
              }
              placeholder="1"
              required
              disabled={
                submitting
              }
            />
          </div>

          {/* SUPPLIER / PAYMENT - STOCK IN ONLY */}
          {isStockIn && (
            <div className="space-y-4 rounded-xl border bg-muted/10 p-4">
              <div>
                <div className="font-medium">
                  Tedarik ve Ödeme
                </div>

                <div className="mt-1 text-xs text-muted-foreground">
                  Stok girişinin hangi tedarikçiden ve hangi ödeme dağılımıyla yapıldığını kaydedin.
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    Tedarikçi
                    <span className="ml-1 text-destructive">
                      *
                    </span>
                  </Label>

                  <Select
                    items={
                      supplierItems
                    }
                    value={
                      supplier
                    }
                    disabled={
                      submitting ||
                      loadingSuppliers ||
                      allowedSuppliers.length ===
                        0
                    }
                    onValueChange={(value) => {
                      if (
                        isProductSupplier(
                          value
                        ) &&
                        allowedSuppliers.includes(
                          value
                        )
                      ) {
                        setSupplier(
                          value
                        );
                        setBalanceUsedUsd(
                          "0"
                        );
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tedarikçi seçiniz" />
                    </SelectTrigger>

                    <SelectContent>
                      {allowedSuppliers.map(
                        (item) => (
                          <SelectItem
                            key={item}
                            value={item}
                          >
                            {item}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>

                  <div className="flex flex-wrap gap-1.5">
                    {allowedSuppliers.map(
                      (item) => (
                        <Badge
                          key={item}
                          variant={
                            item === supplier
                              ? "default"
                              : "secondary"
                          }
                        >
                          {item}
                        </Badge>
                      )
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    Ödeme Yöntemi
                    <span className="ml-1 text-destructive">
                      *
                    </span>
                  </Label>

                  <Select
                    items={
                      paymentItems
                    }
                    value={
                      paymentMethod
                    }
                    disabled={
                      submitting
                    }
                    onValueChange={(value) => {
                      const nextMethod: SupplierPurchasePaymentMethod =
                        value === "balance"
                          ? "balance"
                          : value === "customer_card"
                            ? "customer_card"
                            : "card";

                      setPaymentMethod(nextMethod);
                      if (nextMethod !== "balance") {
                        setBalanceUsedUsd("0");
                      }
                      if (nextMethod !== "customer_card") {
                        setCustomerCardAmountTry("");
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="card">
                        Kendi Kartım
                      </SelectItem>

                      <SelectItem value="customer_card">
                        Müşteri Kartı
                      </SelectItem>

                      <SelectItem value="balance">
                        Bakiye + Kendi Kartım
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-background p-3">
                  <div className="text-xs text-muted-foreground">
                    Alış Toplamı
                  </div>

                  <div className="mt-1 font-semibold">
                    {formatUsd(
                      purchaseTotalUsd
                    )}
                  </div>
                </div>

                <div className="rounded-lg border bg-background p-3">
                  <div className="text-xs text-muted-foreground">
                    {supplier} Bakiyesi
                  </div>

                  <div className="mt-1 font-semibold">
                    {loadingSuppliers
                      ? "..."
                      : formatUsd(
                          currentSupplierBalance
                        )}
                  </div>
                </div>

                <div className="rounded-lg border bg-background p-3">
                  <div className="text-xs text-muted-foreground">
                    {paymentMethod === "customer_card"
                      ? "Site Bakiyesinde Kalacak"
                      : "Kendi Kartım"}
                  </div>

                  <div className="mt-1 font-semibold">
                    {paymentMethod === "customer_card"
                      ? formatUsd(customerCardSurplusUsd)
                      : formatUsd(cardAmountUsd)}
                  </div>
                </div>
              </div>

              {paymentMethod === "customer_card" && (
                <div className="space-y-3 rounded-xl border bg-background p-4">
                  <div className="space-y-2">
                    <Label htmlFor="customerCardAmountTry">
                      Müşteri Kartından Çekilen Tutar (TL)
                      <span className="ml-1 text-destructive">*</span>
                    </Label>
                    <Input
                      id="customerCardAmountTry"
                      type="number"
                      min="0"
                      step="0.01"
                      value={customerCardAmountTry}
                      onChange={(event) => setCustomerCardAmountTry(event.target.value)}
                      disabled={submitting}
                      placeholder={purchaseTotalTry > 0 ? purchaseTotalTry.toFixed(2) : "0.00"}
                    />
                  </div>
                  <div className="grid gap-2 text-sm sm:grid-cols-3">
                    <div className="rounded-lg bg-muted/30 p-3">
                      <div className="text-xs text-muted-foreground">Alış TL Karşılığı</div>
                      <div className="mt-1 font-semibold">{formatTry(purchaseTotalTry)}</div>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-3">
                      <div className="text-xs text-muted-foreground">Kart USD Karşılığı</div>
                      <div className="mt-1 font-semibold">{formatUsd(customerCardChargedUsd)}</div>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-3">
                      <div className="text-xs text-muted-foreground">Site Bakiyesinde Kalacak</div>
                      <div className="mt-1 font-semibold">
                        {formatUsd(customerCardSurplusUsd)}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          ({formatTry(customerCardSurplusTry)})
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Kur: {effectiveRate > 0 ? `1 USD = ${effectiveRate.toFixed(4)} TL` : "kur bulunamadı"}. Ürün alışından artan tutar tedarikçi/site bakiyesine eklenir.
                  </p>
                </div>
              )}

              {paymentMethod ===
                "balance" && (
                <div className="space-y-2">
                  <Label htmlFor="balanceUsedUsd">
                    Bakiyeden Kullanılacak Tutar ($)
                    <span className="ml-1 text-destructive">
                      *
                    </span>
                  </Label>

                  <div className="relative">
                    <WalletCards className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                      id="balanceUsedUsd"
                      type="number"
                      min="0"
                      step="0.01"
                      className="pl-9"
                      value={
                        balanceUsedUsd
                      }
                      onChange={(event) =>
                        setBalanceUsedUsd(
                          event.target.value
                        )
                      }
                      disabled={
                        submitting
                      }
                    />
                  </div>

                  <div className="text-xs text-muted-foreground">
                    En fazla {formatUsd(
                      Math.min(
                        currentSupplierBalance,
                        purchaseTotalUsd
                      )
                    )} kullanabilirsiniz. Kalan {formatUsd(
                      cardAmountUsd
                    )} kart ödemesi olarak kaydedilir.
                  </div>
                </div>
              )}

              {paymentMethod === "card" && (
                <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
                  <CreditCard className="size-4 text-muted-foreground" />
                  Alış toplamının tamamı kendi kartınızdan ödenmiş olarak kaydedilecek.
                </div>
              )}
            </div>
          )}

          {/* NOTE */}
          <div className="space-y-2">
            <Label htmlFor="stockNote">
              Açıklama
            </Label>

            <Textarea
              id="stockNote"
              value={note}
              onChange={(event) =>
                setNote(
                  event.target.value
                )
              }
              placeholder={
                isStockIn
                  ? "Örn: Yeni ürün alımı"
                  : "Örn: Araç montajı"
              }
              rows={3}
              disabled={
                submitting
              }
            />
          </div>

          {submitError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {submitError}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={
                submitting
              }
              onClick={() =>
                onOpenChange(false)
              }
            >
              Vazgeç
            </Button>

            <Button
              type="submit"
              variant={
                isStockIn
                  ? "default"
                  : "destructive"
              }
              disabled={
                submitting ||
                (
                  isStockIn &&
                  loadingSuppliers
                )
              }
            >
              {submitting
                ? "İşleniyor..."
                : isStockIn
                  ? "Stok Ekle"
                  : "Stok Çıkar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
