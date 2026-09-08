import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getDatabase,
} from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISTANBUL_OFFSET = "+03:00";

interface CustomerSystemOfferRevenueDocument {
  customerId?: string;
  vehicleId?: string;
  status?: string;
  finalCustomerTotalTry?: number;
  finalProfitTry?: number;
  systemSnapshot?: {
    productTotalTry?: number;
    profitTry?: number;
    exchangeRate?: number;
    commissionAmountTry?: number;
    commissionAmountUsd?: number;
    laborCostTry?: number;
    laborCostUsd?: number;
  };
  createdAt?: Date;
  installationPendingAt?: Date;
  completedAt?: Date;
  soldAt?: Date;
  customerPayment?: {
    method?: "cash" | "card" | "prepaid_card";
    cardAmountTry?: number;
    cardAmountUsd?: number;
    cashAmountTry?: number;
    shippingFeeTry?: number;
    offerNetProfitTry?: number;
    netProfitAfterShippingTry?: number;
    completedAt?: Date;
  };
}

interface SupplierOrderRevenueDocument {
  supplier?: string;
  totalUsd?: number;
  paymentMethod?: "card" | "customer_card" | "balance" | string;
  balanceUsedUsd?: number;
  cardAmountUsd?: number;
  customerCardAmountTry?: number;
  customerCardChargedUsd?: number;
  customerCardAppliedUsd?: number;
  customerCardSurplusUsd?: number;
  exchangeRate?: number;
  createdAt?: Date;
}

interface SupplierBalanceMovementRevenueDocument {
  supplier?: string;
  type?:
    | "manual_topup"
    | "customer_card_credit"
    | "stock_purchase_balance_usage"
    | string;
  amountUsd?: number;
  amountTry?: number;
  exchangeRate?: number;
  createdAt?: Date;
}

function roundMoney(
  value: number
) {
  return Math.round(
    (value + Number.EPSILON) *
      100
  ) / 100;
}

function safeNumber(
  value: unknown
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}

function getCurrentIstanbulPeriod() {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Europe/Istanbul",
        year:
          "numeric",
        month:
          "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const year =
    parts.find(
      (part) =>
        part.type === "year"
    )?.value;
  const month =
    parts.find(
      (part) =>
        part.type === "month"
    )?.value;

  return `${year}-${month}`;
}

function parsePeriod(
  rawPeriod: string | null
) {
  const period =
    rawPeriod?.trim() ||
    getCurrentIstanbulPeriod();

  const match =
    /^(\d{4})-(\d{2})$/.exec(
      period
    );

  if (!match) {
    return null;
  }

  const year =
    Number(match[1]);
  const month =
    Number(match[2]);

  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2200 ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  const nextMonth =
    month === 12
      ? 1
      : month + 1;
  const nextYear =
    month === 12
      ? year + 1
      : year;

  const startDateText =
    `${year}-${String(
      month
    ).padStart(2, "0")}-01`;
  const nextStartDateText =
    `${nextYear}-${String(
      nextMonth
    ).padStart(2, "0")}-01`;

  const lastDay =
    new Date(
      Date.UTC(
        year,
        month,
        0
      )
    ).getUTCDate();

  const endDateText =
    `${year}-${String(
      month
    ).padStart(2, "0")}-${String(
      lastDay
    ).padStart(2, "0")}`;

  return {
    value:
      period,
    year,
    month,
    start:
      new Date(
        `${startDateText}T00:00:00${ISTANBUL_OFFSET}`
      ),
    endExclusive:
      new Date(
        `${nextStartDateText}T00:00:00${ISTANBUL_OFFSET}`
      ),
    startDate:
      startDateText,
    endDate:
      endDateText,
    label:
      new Intl.DateTimeFormat(
        "tr-TR",
        {
          month:
            "long",
          year:
            "numeric",
          timeZone:
            "Europe/Istanbul",
        }
      ).format(
        new Date(
          `${startDateText}T12:00:00${ISTANBUL_OFFSET}`
        )
      ),
  };
}

function addSupplierAmount(
  map:
    Map<string, number>,
  supplier: unknown,
  amount: number
) {
  const key =
    String(
      supplier ??
        "Diğer"
    ).trim() ||
    "Diğer";

  map.set(
    key,
    roundMoney(
      (map.get(key) ?? 0) +
        amount
    )
  );
}

function mapSupplierBreakdown(
  map: Map<string, number>,
  tryMap?: Map<string, number>
) {
  return Array.from(
    map.entries()
  )
    .map(
      ([
        supplier,
        amountUsd,
      ]) => ({
        supplier,
        amountUsd:
          roundMoney(
            amountUsd
          ),
        ...(tryMap
          ? { amountTry: roundMoney(tryMap.get(supplier) ?? 0) }
          : {}),
      })
    )
    .sort(
      (a, b) =>
        b.amountUsd -
        a.amountUsd
    );
}

function getWorkKey(
  offer:
    CustomerSystemOfferRevenueDocument,
  fallbackIndex: number
) {
  const customerId =
    String(
      offer.customerId ??
        ""
    ).trim();
  const vehicleId =
    String(
      offer.vehicleId ??
        ""
    ).trim();

  if (
    customerId &&
    vehicleId
  ) {
    return `${customerId}::${vehicleId}`;
  }

  return `unknown-${fallbackIndex}`;
}

export async function GET(
  request: NextRequest
) {
  try {
    const period =
      parsePeriod(
        request.nextUrl.searchParams.get(
          "period"
        )
      );

    if (!period) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            "Dönem YYYY-MM formatında olmalıdır.",
        },
        {
          status: 400,
        }
      );
    }

    const db =
      await getDatabase();

    const offersCollection =
      db.collection<CustomerSystemOfferRevenueDocument>(
        "customerSystemOffers"
      );
    const supplierOrdersCollection =
      db.collection<SupplierOrderRevenueDocument>(
        "supplierOrders"
      );
    const balanceMovementsCollection =
      db.collection<SupplierBalanceMovementRevenueDocument>(
        "supplierBalanceMovements"
      );

    const dateFilter = {
      $gte:
        period.start,
      $lt:
        period.endExclusive,
    };

    const [
      createdOffers,
      installationPendingOffers,
      completedOffers,
      supplierOrders,
      balanceMovements,
    ] = await Promise.all([
      offersCollection
        .find({
          createdAt:
            dateFilter,
        })
        .toArray(),
      offersCollection
        .find({
          status:
            "installation_pending",
          installationPendingAt:
            dateFilter,
        })
        .toArray(),
      offersCollection
        .find({
          completedAt:
            dateFilter,
        })
        .toArray(),
      supplierOrdersCollection
        .find({
          createdAt:
            dateFilter,
        })
        .toArray(),
      balanceMovementsCollection
        .find({
          createdAt:
            dateFilter,
        })
        .toArray(),
    ]);

    /*
     * Teklif sayısı özel kural:
     * Aynı müşteri + aynı araç için dönem içindeki
     * tüm teklif varyasyonları tek iş teklifi sayılır.
     */
    const offerWorkKeys =
      new Set(
        createdOffers.map(
          (offer, index) =>
            getWorkKey(
              offer,
              index
            )
        )
      );

    const supplierPaidBySupplier =
      new Map<string, number>();
    const supplierBalanceAddedBySupplier =
      new Map<string, number>();
    const supplierBalanceUsedBySupplier =
      new Map<string, number>();
    const supplierCardPaidBySupplier =
      new Map<string, number>();
    const supplierCardPaidTryBySupplier =
      new Map<string, number>();
    const customerCardSurplusBySupplier =
      new Map<string, number>();
    const customerCardSurplusTryBySupplier =
      new Map<string, number>();

    let supplierPaidTotalUsd = 0;
    let supplierCardPaymentTotalUsd = 0;
    let supplierCardPaymentTotalTry = 0;
    let customerCardSurplusTotalUsd = 0;
    let customerCardSurplusTotalTry = 0;

    for (
      const order of
        supplierOrders
    ) {
      const totalUsd =
        Math.max(
          0,
          safeNumber(
            order.totalUsd
          )
        );
      const isCustomerCard = order.paymentMethod === "customer_card";
      const cardAmountUsd = isCustomerCard
        ? 0
        : Math.max(0, safeNumber(order.cardAmountUsd));
      const orderRate = Math.max(0, safeNumber(order.exchangeRate));
      const ownCardTry = orderRate > 0 ? roundMoney(cardAmountUsd * orderRate) : 0;

      supplierPaidTotalUsd += totalUsd;
      supplierCardPaymentTotalUsd += cardAmountUsd;
      supplierCardPaymentTotalTry += ownCardTry;

      addSupplierAmount(
        supplierPaidBySupplier,
        order.supplier,
        totalUsd
      );
      addSupplierAmount(
        supplierCardPaidBySupplier,
        order.supplier,
        cardAmountUsd
      );
      if (ownCardTry > 0) {
        addSupplierAmount(
          supplierCardPaidTryBySupplier,
          order.supplier,
          ownCardTry
        );
      }
    }

    let supplierBalanceAddedTotalUsd =
      0;
    let supplierBalanceUsedTotalUsd =
      0;

    for (
      const movement of
        balanceMovements
    ) {
      const amountUsd =
        safeNumber(
          movement.amountUsd
        );

      if (
        movement.type ===
          "manual_topup" ||
        movement.type ===
          "customer_card_credit" ||
        movement.type ===
          "customer_card_surplus"
      ) {
        const added =
          Math.max(
            0,
            amountUsd
          );

        supplierBalanceAddedTotalUsd +=
          added;
        addSupplierAmount(
          supplierBalanceAddedBySupplier,
          movement.supplier,
          added
        );
      }

      if (movement.type === "customer_card_surplus") {
        const surplusUsd = Math.max(0, amountUsd);
        const surplusTry = Math.max(
          0,
          safeNumber(movement.amountTry) ||
            (safeNumber(movement.exchangeRate) > 0
              ? roundMoney(surplusUsd * safeNumber(movement.exchangeRate))
              : 0)
        );
        customerCardSurplusTotalUsd += surplusUsd;
        customerCardSurplusTotalTry += surplusTry;
        addSupplierAmount(customerCardSurplusBySupplier, movement.supplier, surplusUsd);
        if (surplusTry > 0) {
          addSupplierAmount(customerCardSurplusTryBySupplier, movement.supplier, surplusTry);
        }
      }

      if (
        movement.type ===
          "stock_purchase_balance_usage"
      ) {
        const used =
          Math.abs(
            amountUsd
          );

        supplierBalanceUsedTotalUsd +=
          used;
        addSupplierAmount(
          supplierBalanceUsedBySupplier,
          movement.supplier,
          used
        );
      }
    }

    let completedRevenueCardTry = 0;
    let completedRevenuePrepaidCardTry = 0;
    let completedRevenueCashTry = 0;
    let completedShippingFeeTry = 0;
    let completedOfferNetProfitTry = 0;
    let completedNetProfitTry = 0;

    for (const offer of completedOffers) {
      const payment = offer.customerPayment;
      const cardTry = Math.max(0, safeNumber(payment?.cardAmountTry));
      const cashTry = Math.max(0, safeNumber(payment?.cashAmountTry));
      const shipping = Math.max(0, safeNumber(payment?.shippingFeeTry));

      if (payment?.method === "prepaid_card") {
        completedRevenuePrepaidCardTry += cardTry;
      } else {
        completedRevenueCardTry += cardTry;
      }
      completedRevenueCashTry += cashTry;
      completedShippingFeeTry += shipping;

      const storedOfferProfit = Number(payment?.offerNetProfitTry);
      const finalProfit = Number(offer.finalProfitTry);
      const snapshotProfit = Number(offer.systemSnapshot?.profitTry);
      const fallbackFromTotals =
        safeNumber(offer.finalCustomerTotalTry) -
        safeNumber(offer.systemSnapshot?.productTotalTry);

      const offerNetProfit = Number.isFinite(storedOfferProfit)
        ? storedOfferProfit
        : Number.isFinite(finalProfit)
          ? finalProfit
          : Number.isFinite(snapshotProfit)
            ? snapshotProfit
            : fallbackFromTotals;

      const storedNet = Number(payment?.netProfitAfterShippingTry);
      const netProfit = Number.isFinite(storedNet)
        ? storedNet
        : roundMoney(offerNetProfit - shipping);

      completedOfferNetProfitTry += offerNetProfit;
      completedNetProfitTry += netProfit;
    }

    const pendingReceivableTry =
      installationPendingOffers.reduce(
        (
          total,
          offer
        ) =>
          total +
          Math.max(
            0,
            safeNumber(
              offer.finalCustomerTotalTry
            )
          ),
        0
      );

    const completedRevenueTotalTry =
      completedRevenueCardTry +
      completedRevenuePrepaidCardTry +
      completedRevenueCashTry;

    return NextResponse.json({
      success: true,
      data: {
        period: {
          value:
            period.value,
          label:
            period.label,
          startDate:
            period.startDate,
          endDate:
            period.endDate,
        },
        counts: {
          offerWorkCount:
            offerWorkKeys.size,
          installationPendingCount:
            installationPendingOffers.length,
          completedCount:
            completedOffers.length,
        },
        supplierPayments: {
          totalUsd:
            roundMoney(
              supplierPaidTotalUsd
            ),
          bySupplier:
            mapSupplierBreakdown(
              supplierPaidBySupplier
            ),
        },
        supplierBalanceAdded: {
          totalUsd:
            roundMoney(
              supplierBalanceAddedTotalUsd
            ),
          bySupplier:
            mapSupplierBreakdown(
              supplierBalanceAddedBySupplier
            ),
        },
        supplierBalanceUsed: {
          totalUsd:
            roundMoney(
              supplierBalanceUsedTotalUsd
            ),
          bySupplier:
            mapSupplierBreakdown(
              supplierBalanceUsedBySupplier
            ),
        },
        completedRevenue: {
          totalTry:
            roundMoney(
              completedRevenueTotalTry
            ),
          cardTry:
            roundMoney(
              completedRevenueCardTry
            ),
          prepaidCardTry:
            roundMoney(
              completedRevenuePrepaidCardTry
            ),
          cashTry:
            roundMoney(
              completedRevenueCashTry
            ),
          shippingFeeTry:
            roundMoney(
              completedShippingFeeTry
            ),
        },
        pendingReceivableTry:
          roundMoney(
            pendingReceivableTry
          ),
        supplierCardPayments: {
          totalUsd: roundMoney(supplierCardPaymentTotalUsd),
          totalTry: roundMoney(supplierCardPaymentTotalTry),
          bySupplier: mapSupplierBreakdown(
            supplierCardPaidBySupplier,
            supplierCardPaidTryBySupplier
          ),
        },
        customerCardSurplus: {
          totalUsd: roundMoney(customerCardSurplusTotalUsd),
          totalTry: roundMoney(customerCardSurplusTotalTry),
          bySupplier: mapSupplierBreakdown(
            customerCardSurplusBySupplier,
            customerCardSurplusTryBySupplier
          ),
        },
        completedEarnings: {
          offerNetProfitTry: roundMoney(completedOfferNetProfitTry),
          shippingFeeTry: roundMoney(completedShippingFeeTry),
          netTry: roundMoney(completedNetProfitTry),
        },
      },
    });
  } catch (error) {
    console.error(
      "GET /api/total-revenue error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Toplam ciro bilgileri alınamadı.",
      },
      {
        status: 500,
      }
    );
  }
}
