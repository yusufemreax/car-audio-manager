import type {
  WithId,
} from "mongodb";

import {
  getExchangeRatesCollection,
  type ExchangeRateDocument,
} from "@/lib/exchange-rates-collection";

import {
  EgbExchangeRateScraperError,
  fetchEgbUsdTryRate,
} from "@/lib/scraping/egb-exchange-rate-scraper";

const EGB_TIME_ZONE =
  "Europe/Istanbul";

export interface UsdTryExchangeRateResult {
  rate: number;
  rateDate: string;
  source: "EGB";
  baseCurrency: "USD";
  quoteCurrency: "TRY";
  rawRate?: string;
  fetchedAt: string;
  fromCache: boolean;
}

export type ExchangeRateServiceErrorCode =
  | "EGB_RATE_UNAVAILABLE"
  | "RATE_PERSIST_FAILED";

const inFlightByDate = new Map<
  string,
  Promise<UsdTryExchangeRateResult>
>();

export class ExchangeRateServiceError extends Error {
  readonly code: ExchangeRateServiceErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ExchangeRateServiceErrorCode,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ExchangeRateServiceError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function getIstanbulDateKey(
  date = new Date()
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: EGB_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(date);

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
  const day =
    parts.find(
      (part) =>
        part.type === "day"
    )?.value;

  if (!year || !month || !day) {
    throw new Error(
      "Türkiye tarihi oluşturulamadı."
    );
  }

  return `${year}-${month}-${day}`;
}

function serializeRate(
  document: WithId<ExchangeRateDocument>,
  fromCache: boolean
): UsdTryExchangeRateResult {
  return {
    rate: Number(document.rate),
    rateDate: document.rateDate,
    source: document.source,
    baseCurrency:
      document.baseCurrency,
    quoteCurrency:
      document.quoteCurrency,
    ...(document.rawRate
      ? {
          rawRate:
            document.rawRate,
        }
      : {}),
    fetchedAt:
      document.fetchedAt.toISOString(),
    fromCache,
  };
}

function isDuplicateKeyError(
  error: unknown
) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as {
        code?: number;
      }).code === 11000
  );
}

async function readStoredRate(
  rateDate: string
) {
  const collection =
    await getExchangeRatesCollection();

  return collection.findOne({
    source: "EGB",
    baseCurrency: "USD",
    quoteCurrency: "TRY",
    rateDate,
  });
}

async function fetchAndPersistRate(
  rateDate: string
): Promise<UsdTryExchangeRateResult> {
  let remote:
    Awaited<
      ReturnType<
        typeof fetchEgbUsdTryRate
      >
    >;

  try {
    remote =
      await fetchEgbUsdTryRate();
  } catch (error) {
    if (
      error instanceof
      EgbExchangeRateScraperError
    ) {
      throw new ExchangeRateServiceError(
        "EGB_RATE_UNAVAILABLE",
        error.message,
        error.statusCode,
        {
          scraperCode:
            error.code,
          ...(error.details ?? {}),
        }
      );
    }

    throw new ExchangeRateServiceError(
      "EGB_RATE_UNAVAILABLE",
      "EGB dolar kuru alınamadı.",
      502
    );
  }

  const collection =
    await getExchangeRatesCollection();

  const now = new Date();

  try {
    /*
     * Aynı anda birden fazla request ilk kuru isterse yalnızca
     * ilk insert başarılı olur. Diğer request mevcut günlük kaydı okur.
     */
    const writeResult =
      await collection.updateOne(
        {
          source: "EGB",
          baseCurrency: "USD",
          quoteCurrency: "TRY",
          rateDate,
        },
        {
          $setOnInsert: {
            source: "EGB",
            baseCurrency: "USD",
            quoteCurrency: "TRY",
            rateDate,
            rate: remote.rate,
            rawRate:
              remote.rawRate,
            fetchedAt:
              remote.fetchedAt,
            createdAt: now,
          },
        },
        {
          upsert: true,
        }
      );

    const stored =
      await collection.findOne({
        source: "EGB",
        baseCurrency: "USD",
        quoteCurrency: "TRY",
        rateDate,
      });

    if (!stored) {
      throw new Error(
        "Kur kaydı oluşturulduktan sonra okunamadı."
      );
    }

    return serializeRate(
      stored,
      writeResult.upsertedCount === 0
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const existing =
        await readStoredRate(
          rateDate
        );

      if (existing) {
        return serializeRate(
          existing,
          true
        );
      }
    }

    throw new ExchangeRateServiceError(
      "RATE_PERSIST_FAILED",
      "EGB dolar kuru MongoDB'ye kaydedilemedi.",
      500
    );
  }
}

export async function getUsdTryExchangeRate() {
  const rateDate =
    getIstanbulDateKey();

  /*
   * İstenen ana davranış:
   * Önce bugünün DB kaydı. Varsa hiçbir şekilde EGB'ye gitme.
   */
  const existing =
    await readStoredRate(
      rateDate
    );

  if (existing) {
    return serializeRate(
      existing,
      true
    );
  }

  /*
   * Aynı Node process'i içinde aynı anda gelen ilk istekleri de birleştir.
   */
  const inFlight =
    inFlightByDate.get(
      rateDate
    );

  if (inFlight) {
    return inFlight;
  }

  const promise =
    fetchAndPersistRate(
      rateDate
    );

  inFlightByDate.set(
    rateDate,
    promise
  );

  try {
    return await promise;
  } finally {
    if (
      inFlightByDate.get(
        rateDate
      ) === promise
    ) {
      inFlightByDate.delete(
        rateDate
      );
    }
  }
}
