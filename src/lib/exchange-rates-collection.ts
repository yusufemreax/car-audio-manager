import type {
  Collection,
} from "mongodb";

import {
  getDatabase,
} from "@/lib/mongodb";

export const EXCHANGE_RATES_COLLECTION =
  "exchangeRates";

export type ExchangeRateSource =
  "EGB";
export type ExchangeRateBaseCurrency =
  "USD";
export type ExchangeRateQuoteCurrency =
  "TRY";

export interface ExchangeRateDocument {
  source: ExchangeRateSource;
  baseCurrency: ExchangeRateBaseCurrency;
  quoteCurrency: ExchangeRateQuoteCurrency;
  rateDate: string;
  rate: number;
  rawRate?: string;
  fetchedAt: Date;
  createdAt: Date;
}

let indexesPromise:
  Promise<void> | null = null;

async function ensureExchangeRateIndexes(
  collection: Collection<ExchangeRateDocument>
) {
  if (!indexesPromise) {
    indexesPromise = collection
      .createIndex(
        {
          source: 1,
          baseCurrency: 1,
          quoteCurrency: 1,
          rateDate: 1,
        },
        {
          unique: true,
          name: "ux_exchangeRates_source_pair_rateDate",
        }
      )
      .then(() => undefined)
      .catch((error) => {
        indexesPromise = null;
        throw error;
      });
  }

  await indexesPromise;
}

export async function getExchangeRatesCollection(): Promise<
  Collection<ExchangeRateDocument>
> {
  const database =
    await getDatabase();

  const collection =
    database.collection<ExchangeRateDocument>(
      EXCHANGE_RATES_COLLECTION
    );

  await ensureExchangeRateIndexes(
    collection
  );

  return collection;
}
