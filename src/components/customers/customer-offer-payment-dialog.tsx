/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CreditCard,
  Loader2,
  WalletCards,
} from "lucide-react";

import type {
  CustomerSystemOffer,
} from "@/types/customer-system-offer";

import type {
  CustomerOfferCompletionPayment,
  CustomerOfferPaymentMethod,
} from "@/types/customer-offer-workflow";

import {
  PRODUCT_SUPPLIERS,
  type ProductSupplier,
} from "@/types/supplier";

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

interface ExchangeRateResponse {
  success: boolean;
  message?: string;
  data?: {
    from: string;
    to: string;
    rate: number;
    date?: string;
  };
}

interface CustomerOfferPaymentDialogProps {
  open: boolean;
  onOpenChange:
    (open: boolean) => void;
  offer:
    CustomerSystemOffer | null;
  submitting?: boolean;
  onSubmit: (
    payment:
      CustomerOfferCompletionPayment
  ) => Promise<boolean>;
}

const PAYMENT_METHOD_ITEMS = [
  {
    value:
      "cash",
    label:
      "Nakit",
  },
  {
    value:
      "card",
    label:
      "Kart + Nakit",
  },
];

const SUPPLIER_ITEMS =
  PRODUCT_SUPPLIERS.map(
    (supplier) => ({
      value:
        supplier,
      label:
        supplier,
    })
  );

function roundMoney(
  value: number
) {
  return Math.round(
    (value + Number.EPSILON) *
      100
  ) / 100;
}

function toNumber(
  value: string
) {
  const normalized =
    value
      .trim()
      .replace(
        ",",
        "."
      );

  const parsed =
    Number(
      normalized
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
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

export function CustomerOfferPaymentDialog({
  open,
  onOpenChange,
  offer,
  submitting = false,
  onSubmit,
}: CustomerOfferPaymentDialogProps) {
  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState<CustomerOfferPaymentMethod>(
    "cash"
  );

  const [
    supplier,
    setSupplier,
  ] = useState<ProductSupplier>(
    "EGB"
  );

  const [
    exchangeRate,
    setExchangeRate,
  ] = useState<number | null>(
    null
  );

  const [
    exchangeRateDate,
    setExchangeRateDate,
  ] = useState<string | null>(
    null
  );

  const [
    cardAmountTry,
    setCardAmountTry,
  ] = useState("");

  const [
    cardAmountUsd,
    setCardAmountUsd,
  ] = useState("");

  const [
    loadingRate,
    setLoadingRate,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  const totalTry =
    Math.max(
      0,
      Number(
        offer?.finalCustomerTotalTry ??
          0
      ) || 0
    );

  const cardTryNumber =
    Math.max(
      0,
      toNumber(
        cardAmountTry
      )
    );

  const cardUsdNumber =
    Math.max(
      0,
      toNumber(
        cardAmountUsd
      )
    );

  const cashAmountTry =
    useMemo(
      () =>
        paymentMethod ===
        "cash"
          ? totalTry
          : roundMoney(
              Math.max(
                totalTry -
                  cardTryNumber,
                0
              )
            ),
      [
        paymentMethod,
        totalTry,
        cardTryNumber,
      ]
    );

  useEffect(() => {
    if (
      !open ||
      !offer
    ) {
      return;
    }

    setPaymentMethod(
      "cash"
    );
    setSupplier(
      "EGB"
    );
    setCardAmountTry(
      roundMoney(
        totalTry
      ).toFixed(2)
    );
    setCardAmountUsd("");
    setExchangeRate(
      null
    );
    setExchangeRateDate(
      null
    );
    setError(
      null
    );

    let cancelled =
      false;

    const loadExchangeRate =
      async () => {
        setLoadingRate(
          true
        );

        try {
          const response =
            await fetch(
              "/api/exchange-rate",
              {
                cache:
                  "no-store",
              }
            );

          const result:
            ExchangeRateResponse =
              await response.json();

          if (
            !response.ok ||
            !result.success ||
            !result.data ||
            !Number.isFinite(
              Number(
                result.data.rate
              )
            ) ||
            Number(
              result.data.rate
            ) <= 0
          ) {
            throw new Error(
              result.message ??
                "Güncel kur alınamadı."
            );
          }

          if (cancelled) {
            return;
          }

          const rate =
            Number(
              result.data.rate
            );

          setExchangeRate(
            rate
          );
          setExchangeRateDate(
            result.data.date ??
              null
          );
          setCardAmountUsd(
            roundMoney(
              totalTry /
                rate
            ).toFixed(2)
          );
        } catch (rateError) {
          if (cancelled) {
            return;
          }

          setError(
            rateError instanceof Error
              ? rateError.message
              : "Güncel kur alınamadı."
          );
        } finally {
          if (!cancelled) {
            setLoadingRate(
              false
            );
          }
        }
      };

    void loadExchangeRate();

    return () => {
      cancelled =
        true;
    };
  }, [
    open,
    offer?.id,
    totalTry,
  ]);

  const handleCardTryChange =
    (
      value: string
    ) => {
      setCardAmountTry(
        value
      );

      const nextTry =
        Math.max(
          0,
          toNumber(
            value
          )
        );

      if (
        exchangeRate &&
        exchangeRate > 0
      ) {
        setCardAmountUsd(
          roundMoney(
            nextTry /
              exchangeRate
          ).toFixed(2)
        );
      }
    };

  const handleSubmit =
    async () => {
      if (!offer) {
        return;
      }

      setError(
        null
      );

      if (
        paymentMethod ===
        "cash"
      ) {
        const saved =
          await onSubmit({
            method:
              "cash",
            cardAmountTry:
              0,
            cardAmountUsd:
              0,
            cashAmountTry:
              roundMoney(
                totalTry
              ),
            ...(exchangeRate &&
            exchangeRate > 0
              ? {
                  exchangeRate,
                }
              : {}),
            ...(exchangeRateDate
              ? {
                  exchangeRateDate,
                }
              : {}),
          });

        if (saved) {
          onOpenChange(
            false
          );
        }

        return;
      }

      if (
        cardTryNumber <= 0
      ) {
        setError(
          "Karttan çekilecek TL tutarını giriniz."
        );
        return;
      }

      if (
        cardTryNumber >
        totalTry
      ) {
        setError(
          "Kart tutarı teklif müşteri tutarından büyük olamaz."
        );
        return;
      }

      if (
        cardUsdNumber <= 0
      ) {
        setError(
          "Tedarikçi bakiyesine girecek USD tutarını giriniz."
        );
        return;
      }

      const saved =
        await onSubmit({
          method:
            "card",
          supplier,
          cardAmountTry:
            roundMoney(
              cardTryNumber
            ),
          cardAmountUsd:
            roundMoney(
              cardUsdNumber
            ),
          cashAmountTry:
            cashAmountTry,
          ...(exchangeRate &&
          exchangeRate > 0
            ? {
                exchangeRate,
              }
            : {}),
          ...(exchangeRateDate
            ? {
                exchangeRateDate,
              }
            : {}),
        });

      if (saved) {
        onOpenChange(
          false
        );
      }
    };

  return (
    <Dialog
      open={open}
      onOpenChange={(
        nextOpen
      ) => {
        if (
          submitting
        ) {
          return;
        }

        onOpenChange(
          nextOpen
        );
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WalletCards className="size-5" />
            Montaj ve Ödeme Tamamlama
          </DialogTitle>
          <DialogDescription>
            Kaydetmeden kapatırsanız teklif Montaj Bekliyor durumunda kalır ve hiçbir bakiye hareketi oluşmaz.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="text-xs text-muted-foreground">
              Müşteri Teklif Tutarı
            </div>
            <div className="mt-1 text-xl font-semibold">
              {formatTry(
                totalTry
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Ödeme Yöntemi
            </Label>
            <Select
              items={
                PAYMENT_METHOD_ITEMS
              }
              value={
                paymentMethod
              }
              onValueChange={(
                value
              ) => {
                if (
                  value ===
                    "cash" ||
                  value ===
                    "card"
                ) {
                  setPaymentMethod(
                    value
                  );
                  setError(
                    null
                  );
                }
              }}
              disabled={
                submitting
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">
                  Nakit
                </SelectItem>
                <SelectItem value="card">
                  Kart + Nakit
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {paymentMethod ===
            "card" && (
            <div className="space-y-4 rounded-xl border p-4">
              <div className="flex items-center gap-2 font-medium">
                <CreditCard className="size-4" />
                Kart Tahsilatı
              </div>

              <div className="space-y-2">
                <Label>
                  Kartın Çekileceği Tedarikçi
                </Label>
                <Select
                  items={
                    SUPPLIER_ITEMS
                  }
                  value={
                    supplier
                  }
                  onValueChange={(
                    value
                  ) => {
                    const selected =
                      PRODUCT_SUPPLIERS.find(
                        (item) =>
                          item ===
                          value
                      );

                    if (selected) {
                      setSupplier(
                        selected
                      );
                    }
                  }}
                  disabled={
                    submitting
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_SUPPLIERS.map(
                      (item) => (
                        <SelectItem
                          key={
                            item
                          }
                          value={
                            item
                          }
                        >
                          {item}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    Kart Tutarı (TL)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max={
                      totalTry
                    }
                    step="0.01"
                    value={
                      cardAmountTry
                    }
                    disabled={
                      submitting
                    }
                    onChange={(
                      event
                    ) =>
                      handleCardTryChange(
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Bakiyeye Girecek Tutar (USD)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      cardAmountUsd
                    }
                    disabled={
                      submitting ||
                      loadingRate
                    }
                    onChange={(
                      event
                    ) =>
                      setCardAmountUsd(
                        event.target.value
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Otomatik karşılıktır; yuvarlama veya gerçek çekim farkı için değiştirebilirsiniz.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="text-xs text-muted-foreground">
                    Kart USD
                  </div>
                  <div className="mt-1 font-semibold">
                    {formatUsd(
                      cardUsdNumber
                    )}
                  </div>
                </div>

                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="text-xs text-muted-foreground">
                    Nakit Kalan
                  </div>
                  <div className="mt-1 font-semibold">
                    {formatTry(
                      cashAmountTry
                    )}
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                {loadingRate
                  ? "Güncel kur yükleniyor..."
                  : exchangeRate
                    ? `Kur: 1 USD = ${exchangeRate.toFixed(
                        4
                      )} TL${
                        exchangeRateDate
                          ? ` • ${exchangeRateDate}`
                          : ""
                      }`
                    : "Kur bilgisi alınamadı."}
              </div>
            </div>
          )}

          {paymentMethod ===
            "cash" && (
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-xs text-muted-foreground">
                Nakit Tahsilat
              </div>
              <div className="mt-1 font-semibold">
                {formatTry(
                  totalTry
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Nakit seçildiğinde tedarikçi bakiyesi değişmez.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={
              submitting
            }
            onClick={() =>
              onOpenChange(
                false
              )
            }
          >
            Vazgeç
          </Button>

          <Button
            type="button"
            disabled={
              submitting ||
              (
                paymentMethod ===
                  "card" &&
                loadingRate
              )
            }
            onClick={() => {
              void handleSubmit();
            }}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <WalletCards className="size-4" />
            )}
            {submitting
              ? "Tamamlanıyor..."
              : "Montajı ve Satışı Tamamla"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
