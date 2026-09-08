/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  Banknote,
  CalendarDays,
  ChartNoAxesCombined,
  CircleCheckBig,
  CreditCard,
  FileText,
  HandCoins,
  Loader2,
  PackageCheck,
  RefreshCw,
  Truck,
  WalletCards,
  Wrench,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  Input,
} from "@/components/ui/input";
import {
  Label,
} from "@/components/ui/label";

interface SupplierBreakdownItem {
  supplier: string;
  amountUsd: number;
  amountTry?: number;
}

interface TotalRevenueData {
  period: {
    value: string;
    label: string;
    startDate: string;
    endDate: string;
  };
  counts: {
    offerWorkCount: number;
    installationPendingCount: number;
    completedCount: number;
  };
  supplierPayments: {
    totalUsd: number;
    bySupplier: SupplierBreakdownItem[];
  };
  supplierBalanceAdded: {
    totalUsd: number;
    bySupplier: SupplierBreakdownItem[];
  };
  supplierBalanceUsed: {
    totalUsd: number;
    bySupplier: SupplierBreakdownItem[];
  };
  completedRevenue: {
    totalTry: number;
    cardTry: number;
    prepaidCardTry: number;
    cashTry: number;
    shippingFeeTry: number;
  };
  pendingReceivableTry: number;
  supplierCardPayments: {
    totalUsd: number;
    totalTry: number;
    bySupplier: SupplierBreakdownItem[];
  };
  customerCardSurplus: {
    totalUsd: number;
    totalTry: number;
    bySupplier: SupplierBreakdownItem[];
  };
  completedEarnings: {
    offerNetProfitTry: number;
    shippingFeeTry: number;
    netTry: number;
  };
}

interface ApiResponse {
  success: boolean;
  message?: string;
  data?: TotalRevenueData;
}

function getCurrentIstanbulPeriod() {
  const parts = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
    }
  ).formatToParts(new Date());

  const year = parts.find(
    (part) => part.type === "year"
  )?.value;

  const month = parts.find(
    (part) => part.type === "month"
  )?.value;

  return `${year}-${month}`;
}

function formatTry(value: number) {
  return new Intl.NumberFormat(
    "tr-TR",
    {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}

function formatUsd(value: number) {
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

function formatDate(value: string) {
  const [year, month, day] =
    value.split("-");

  return `${day}.${month}.${year}`;
}

function CountCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: typeof FileText;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Icon className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-muted-foreground">
              {title}
            </div>

            <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
              {value}
            </div>

            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SupplierBreakdown({
  items,
}: {
  items: SupplierBreakdownItem[];
}) {
  if (items.length === 0) {
    return (
      <div className="py-5 text-center text-sm text-muted-foreground">
        Bu dönemde hareket yok.
      </div>
    );
  }

  return (
    <div className="divide-y">
      {items.map((item) => (
        <div
          key={item.supplier}
          className="flex items-center justify-between gap-4 py-3"
        >
          <span className="text-sm font-medium">
            {item.supplier}
          </span>

          <div className="text-right">
            <div className="font-semibold tabular-nums">
              {formatUsd(item.amountUsd)}
            </div>

            {typeof item.amountTry === "number" &&
              item.amountTry > 0 && (
                <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  {formatTry(item.amountTry)}
                </div>
              )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SupplierMovementCard({
  value,
  title,
  amount,
  secondaryAmount,
  icon: Icon,
  description,
  children,
}: {
  value: string;
  title: string;
  amount: string;
  secondaryAmount?: string;
  icon: typeof FileText;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <Accordion>
        <AccordionItem
          value={value}
          className="border-none"
        >
          <AccordionTrigger className="px-5 py-4 text-left hover:no-underline">
            <div className="flex min-w-0 flex-1 items-center gap-4 pr-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="size-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {title}
                </div>

                {description && (
                  <p className="mt-1 text-xs font-normal leading-5 text-muted-foreground">
                    {description}
                  </p>
                )}
              </div>

              <div className="shrink-0 text-right">
                <div className="text-lg font-semibold tabular-nums">
                  {amount}
                </div>

                {secondaryAmount && (
                  <div className="mt-0.5 text-xs font-normal text-muted-foreground tabular-nums">
                    {secondaryAmount}
                  </div>
                )}
              </div>
            </div>
          </AccordionTrigger>

          <AccordionContent className="border-t px-5 pb-1 pt-1">
            {children}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
  negative = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <span
        className={
          strong
            ? "font-medium"
            : "text-muted-foreground"
        }
      >
        {label}
      </span>

      <span
        className={`text-right tabular-nums ${
          strong
            ? "font-semibold"
            : "font-medium"
        } ${
          negative
            ? "text-destructive"
            : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function TotalRevenuePageClient() {
  const [period, setPeriod] =
    useState(
      getCurrentIstanbulPeriod()
    );

  const [data, setData] =
    useState<TotalRevenueData | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(
    async (
      requestedPeriod: string
    ) => {
      if (!requestedPeriod) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/total-revenue?period=${encodeURIComponent(
            requestedPeriod
          )}`,
          {
            cache: "no-store",
          }
        );

        const result: ApiResponse =
          await response.json();

        if (
          !response.ok ||
          !result.success ||
          !result.data
        ) {
          throw new Error(
            result.message ??
              "Toplam ciro bilgileri alınamadı."
          );
        }

        setData(result.data);
      } catch (loadError) {
        setData(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Toplam ciro bilgileri alınamadı."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void load(period);
  }, [period, load]);

  const periodRangeText = useMemo(
    () =>
      data
        ? `${formatDate(
            data.period.startDate
          )} - ${formatDate(
            data.period.endDate
          )}`
        : "",
    [data]
  );

  return (
    <div className="min-w-0 space-y-6">
      {/* HEADER - same page rhythm as System Preparation / Bulk Order */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Toplam Ciro
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Teklif, sipariş, tahsilat, tedarikçi hareketleri ve gerçek kazancı aylık dönem bazında takip edin.
        </p>
      </div>

      {/* PERIOD INFO */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Dönem Bilgileri
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="revenuePeriod">
                Dönem
              </Label>

              <Input
                id="revenuePeriod"
                type="month"
                value={period}
                disabled={loading}
                onChange={(event) =>
                  setPeriod(
                    event.target.value
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                Tarih Aralığı
              </Label>

              <div className="flex h-9 items-center rounded-md border bg-muted/20 px-3 text-sm">
                {data ? (
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium capitalize">
                      {data.period.label}
                    </span>
                    <span className="text-muted-foreground">
                      •
                    </span>
                    <span className="text-muted-foreground">
                      {periodRangeText}
                    </span>
                    <span className="text-muted-foreground">
                      • iki tarih dahil
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">
                    Dönem bilgisi yükleniyor...
                  </span>
                )}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() =>
                void load(period)
              }
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
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex min-h-48 items-center justify-center rounded-xl border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Dönem verileri hesaplanıyor...
          </div>
        </div>
      ) : data ? (
        <>
          {/* WORK SUMMARY */}
          <section className="space-y-4">
            <div>
              <h2 className="font-semibold">
                İş Özeti
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Seçilen dönemdeki teklif, montaj bekleyen ve tamamlanan iş adetleri.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <CountCard
                title="Toplam Teklif"
                value={
                  data.counts.offerWorkCount
                }
                description="Aynı müşteri ve aynı araç için oluşturulan tüm teklif varyasyonları tek iş sayılır."
                icon={FileText}
              />

              <CountCard
                title="Montaj Bekleyen"
                value={
                  data.counts.installationPendingCount
                }
                description="Siparişi tamamlanan ve montaj aşamasında bulunan işler."
                icon={Wrench}
              />

              <CountCard
                title="Tamamlanan İş"
                value={
                  data.counts.completedCount
                }
                description="Montajı ve müşteri ödeme kaydı tamamlanan işler."
                icon={CircleCheckBig}
              />
            </div>
          </section>

          {/* MAIN FINANCE AREA - same 2-column language as System Preparation */}
          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            {/* LEFT */}
            <div className="min-w-0 space-y-6">
              <section className="space-y-4">
                <div>
                  <h2 className="font-semibold">
                    Tedarikçi Hareketleri
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Detay görmek için ilgili satırı açabilirsiniz.
                  </p>
                </div>

                <div className="space-y-3">
                  <SupplierMovementCard
                    value="supplier-payments"
                    title="Tedarikçilere Ödenen Toplam Tutar"
                    amount={formatUsd(
                      data.supplierPayments.totalUsd
                    )}
                    icon={Truck}
                  >
                    <SupplierBreakdown
                      items={
                        data.supplierPayments.bySupplier
                      }
                    />
                  </SupplierMovementCard>

                  <SupplierMovementCard
                    value="supplier-balance-added"
                    title="Tedarikçilere Eklenen Toplam Bakiye"
                    amount={formatUsd(
                      data.supplierBalanceAdded.totalUsd
                    )}
                    icon={WalletCards}
                  >
                    <SupplierBreakdown
                      items={
                        data.supplierBalanceAdded.bySupplier
                      }
                    />
                  </SupplierMovementCard>

                  <SupplierMovementCard
                    value="supplier-balance-used"
                    title="Tedarikçilerden Kullanılan Toplam Bakiye"
                    amount={formatUsd(
                      data.supplierBalanceUsed.totalUsd
                    )}
                    icon={HandCoins}
                  >
                    <SupplierBreakdown
                      items={
                        data.supplierBalanceUsed.bySupplier
                      }
                    />
                  </SupplierMovementCard>

                  <SupplierMovementCard
                    value="supplier-card-payments"
                    title="Kendi Kartımdan Siteye Ödenen"
                    amount={formatUsd(
                      data.supplierCardPayments.totalUsd
                    )}
                    secondaryAmount={
                      data.supplierCardPayments.totalTry > 0
                        ? formatTry(
                            data.supplierCardPayments.totalTry
                          )
                        : undefined
                    }
                    icon={CreditCard}
                    description="Müşteri kartıyla yapılan alışlar bu toplama dahil değildir."
                  >
                    <SupplierBreakdown
                      items={
                        data.supplierCardPayments.bySupplier
                      }
                    />
                  </SupplierMovementCard>

                  <SupplierMovementCard
                    value="customer-card-surplus"
                    title="Müşteri Kartından Siteye Kalan Bakiye"
                    amount={formatUsd(
                      data.customerCardSurplus.totalUsd
                    )}
                    secondaryAmount={
                      data.customerCardSurplus.totalTry > 0
                        ? formatTry(
                            data.customerCardSurplus.totalTry
                          )
                        : undefined
                    }
                    icon={WalletCards}
                    description="Müşteri kartıyla ürün alındıktan sonra tedarikçi/site bakiyesinde kalan tutar."
                  >
                    <SupplierBreakdown
                      items={
                        data.customerCardSurplus.bySupplier
                      }
                    />
                  </SupplierMovementCard>
                </div>
              </section>
            </div>

            {/* RIGHT SUMMARY */}
            <div className="min-w-0">
              <Card className="sticky top-20">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <ChartNoAxesCombined className="size-4" />
                    </div>

                    <div>
                      <CardTitle className="text-base">
                        Dönem Özeti
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Müşteri tahsilatı, alacak ve gerçek kazanç.
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5">
                  {/* COMPLETED REVENUE */}
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Banknote className="size-4" />
                      Tamamlanan İşlerden Alınan Ücret
                    </div>

                    <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                      {formatTry(
                        data.completedRevenue.totalTry
                      )}
                    </div>

                    <div className="mt-3 divide-y border-y">
                      <SummaryRow
                        label="Kart"
                        value={formatTry(
                          data.completedRevenue.cardTry
                        )}
                      />

                      <SummaryRow
                        label="Önceden Çekilen Kart"
                        value={formatTry(
                          data.completedRevenue.prepaidCardTry
                        )}
                      />

                      <SummaryRow
                        label="Nakit"
                        value={formatTry(
                          data.completedRevenue.cashTry
                        )}
                      />

                      <SummaryRow
                        label="Kargo Ücreti"
                        value={formatTry(
                          data.completedRevenue.shippingFeeTry
                        )}
                      />
                    </div>
                  </div>

                  {/* RECEIVABLE */}
                  <div className="border-t pt-5">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <PackageCheck className="size-4" />
                      Montaj Bekleyen İşlerden Alacak
                    </div>

                    <div className="mt-2 text-xl font-semibold tracking-tight tabular-nums">
                      {formatTry(
                        data.pendingReceivableTry
                      )}
                    </div>

                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Henüz montajı tamamlanmamış işlerden alınacak müşteri toplamı.
                    </p>
                  </div>

                  {/* REAL PROFIT */}
                  <div className="border-t pt-5">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Banknote className="size-4" />
                      Toplam Gerçek Kazanç
                    </div>

                    <div className="mt-2 text-3xl font-bold tracking-tight tabular-nums">
                      {formatTry(
                        data.completedEarnings.netTry
                      )}
                    </div>

                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Tamamlanan işlerde teklif üzerinde kayıtlı net kazançtan kargo ücreti düşülür.
                    </p>

                    <div className="mt-3 divide-y border-y">
                      <SummaryRow
                        label="Teklif Net Kazancı"
                        value={formatTry(
                          data.completedEarnings.offerNetProfitTry
                        )}
                      />

                      <SummaryRow
                        label="Kargo"
                        value={`-${formatTry(
                          data.completedEarnings.shippingFeeTry
                        )}`}
                        negative={
                          data.completedEarnings.shippingFeeTry > 0
                        }
                      />

                      <SummaryRow
                        label="Net Kazanç"
                        value={formatTry(
                          data.completedEarnings.netTry
                        )}
                        strong
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
