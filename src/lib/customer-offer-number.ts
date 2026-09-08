import {
  ObjectId,
} from "mongodb";

import {
  getDatabase,
} from "@/lib/mongodb";

const CUSTOMER_SYSTEM_OFFERS_COLLECTION =
  "customerSystemOffers";

const SYSTEM_COUNTERS_COLLECTION =
  "systemCounters";

const CUSTOMER_OFFER_COUNTER_ID =
  "customer-system-offer-global";

interface OfferCounterDocument {
  _id: string;
  sequence: number;
  createdAt: Date;
  updatedAt: Date;
}

function cleanString(
  value: unknown
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function parseDate(
  value: unknown
) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value;
  }

  if (
    typeof value === "string" &&
    value.trim()
  ) {
    const parsed =
      new Date(value);

    return Number.isNaN(
      parsed.getTime()
    )
      ? null
      : parsed;
  }

  return null;
}

function formatOfferNumber(
  sequence: number,
  createdAt?: unknown
) {
  const year =
    parseDate(createdAt)?.getFullYear() ??
    new Date().getFullYear();

  return `TKL-${year}-${String(
    sequence
  ).padStart(6, "0")}`;
}

async function reserveOfferNumberRange(
  count: number
) {
  const safeCount =
    Math.max(
      1,
      Math.trunc(count)
    );

  const db =
    await getDatabase();

  const counters =
    db.collection<OfferCounterDocument>(
      SYSTEM_COUNTERS_COLLECTION
    );

  const now =
    new Date();

  const counter =
    await counters.findOneAndUpdate(
      {
        _id:
          CUSTOMER_OFFER_COUNTER_ID,
      },
      {
        $inc: {
          sequence:
            safeCount,
        },
        $set: {
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      }
    );

  if (!counter) {
    throw new Error(
      "Teklif numarası oluşturulamadı."
    );
  }

  return {
    firstSequence:
      counter.sequence -
      safeCount +
      1,
    lastSequence:
      counter.sequence,
  };
}

async function reserveNextOfferNumber(
  createdAt?: unknown
) {
  const range =
    await reserveOfferNumberRange(
      1
    );

  return formatOfferNumber(
    range.firstSequence,
    createdAt
  );
}

function getOfferObjectId(
  value: string | ObjectId
) {
  if (
    value instanceof ObjectId
  ) {
    return value;
  }

  return ObjectId.isValid(value)
    ? new ObjectId(value)
    : null;
}

export async function ensureCustomerOfferNumber(
  offerId: string | ObjectId
): Promise<string> {
  const objectId =
    getOfferObjectId(
      offerId
    );

  if (!objectId) {
    throw new Error(
      "Geçersiz teklif ID."
    );
  }

  const db =
    await getDatabase();

  const offers =
    db.collection(
      CUSTOMER_SYSTEM_OFFERS_COLLECTION
    );

  const existing =
    await offers.findOne(
      {
        _id: objectId,
      },
      {
        projection: {
          offerNumber: 1,
          createdAt: 1,
        },
      }
    );

  if (!existing) {
    throw new Error(
      "Teklif bulunamadı."
    );
  }

  const existingNumber =
    cleanString(
      existing.offerNumber
    );

  if (existingNumber) {
    return existingNumber;
  }

  const reservedNumber =
    await reserveNextOfferNumber(
      existing.createdAt
    );

  const updateResult =
    await offers.updateOne(
      {
        _id: objectId,
        $or: [
          {
            offerNumber: {
              $exists: false,
            },
          },
          {
            offerNumber: null,
          },
          {
            offerNumber: "",
          },
        ],
      },
      {
        $set: {
          offerNumber:
            reservedNumber,
        },
      }
    );

  if (
    updateResult.modifiedCount >
    0
  ) {
    return reservedNumber;
  }

  /*
   * Aynı teklif için iki istek aynı anda geldiyse
   * diğer istek numarayı daha önce yazmış olabilir.
   * Sayaçta boşluk oluşabilir fakat aynı teklif iki
   * farklı numarayla kalmaz ve numaralar çakışmaz.
   */
  const concurrent =
    await offers.findOne(
      {
        _id: objectId,
      },
      {
        projection: {
          offerNumber: 1,
        },
      }
    );

  const concurrentNumber =
    cleanString(
      concurrent?.offerNumber
    );

  if (concurrentNumber) {
    return concurrentNumber;
  }

  throw new Error(
    "Teklif numarası kaydedilemedi."
  );
}

export async function ensureAllCustomerOfferNumbers() {
  const db =
    await getDatabase();

  const offers =
    db.collection(
      CUSTOMER_SYSTEM_OFFERS_COLLECTION
    );

  const withoutNumber =
    await offers
      .find(
        {
          $or: [
            {
              offerNumber: {
                $exists: false,
              },
            },
            {
              offerNumber: null,
            },
            {
              offerNumber: "",
            },
          ],
        },
        {
          projection: {
            _id: 1,
            createdAt: 1,
          },
        }
      )
      .sort({
        createdAt: 1,
        _id: 1,
      })
      .toArray();

  if (
    withoutNumber.length ===
    0
  ) {
    return;
  }

  /*
   * Eski kayıtları tek tek sayaç güncelleyerek yavaşlatmak yerine
   * gerekli numara aralığını tek Mongo işlemiyle ayırıp bulkWrite
   * ile topluca yazarız. Böylece ilk açılışta onlarca teklif olsa
   * bile ekran gereksiz yere beklemez.
   */
  const range =
    await reserveOfferNumberRange(
      withoutNumber.length
    );

  await offers.bulkWrite(
    withoutNumber.map(
      (offer, index) => ({
        updateOne: {
          filter: {
            _id: offer._id,
            $or: [
              {
                offerNumber: {
                  $exists: false,
                },
              },
              {
                offerNumber: null,
              },
              {
                offerNumber: "",
              },
            ],
          },
          update: {
            $set: {
              offerNumber:
                formatOfferNumber(
                  range.firstSequence +
                    index,
                  offer.createdAt
                ),
            },
          },
        },
      })
    ),
    {
      ordered: false,
    }
  );
}
