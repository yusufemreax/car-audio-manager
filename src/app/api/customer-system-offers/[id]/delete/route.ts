import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ObjectId,
} from "mongodb";

import {
  getDatabase,
} from "@/lib/mongodb";

interface RouteContext {
  params:
    Promise<{
      id: string;
    }>;
}

const CUSTOMER_SYSTEM_OFFERS_COLLECTION =
  "customerSystemOffers";

function toObjectId(
  value: string
) {
  if (
    !ObjectId.isValid(
      value
    )
  ) {
    return null;
  }

  return new ObjectId(
    value
  );
}

/*
 * =========================================================
 * DELETE
 * /api/customer-system-offers/[id]/delete
 *
 * Stok düşülmüş teklif silinmez.
 * Böylece stok hareketinin kaynak teklifi kaybolmaz.
 * =========================================================
 */
export async function DELETE(
  _request:
    NextRequest,
  context:
    RouteContext
) {
  try {
    const {
      id,
    } =
      await context.params;

    const objectId =
      toObjectId(
        id
      );

    if (!objectId) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            "Geçersiz teklif ID.",
        },
        {
          status:
            400,
        }
      );
    }

    const db =
      await getDatabase();

    const collection =
      db.collection(
        CUSTOMER_SYSTEM_OFFERS_COLLECTION
      );

    const offer =
      await collection.findOne(
        {
          _id:
            objectId,
        }
      );

    if (!offer) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            "Teklif bulunamadı.",
        },
        {
          status:
            404,
        }
      );
    }

    const status =
      String(
        offer.status ??
          "offered"
      );

    if (
      offer.stockDeductedAt ||
      status ===
        "installation_pending" ||
      status ===
        "completed"
    ) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            "Stok hareketi oluşmuş teklif kaldırılamaz.",
        },
        {
          status:
            409,
        }
      );
    }

    const result =
      await collection.deleteOne(
        {
          _id:
            objectId,
        }
      );

    if (
      result.deletedCount ===
      0
    ) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            "Teklif bulunamadı.",
        },
        {
          status:
            404,
        }
      );
    }

    return NextResponse.json({
      success:
        true,
      data:
        null,
    });
  } catch (error) {
    console.error(
      "DELETE /api/customer-system-offers/[id]/delete error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,
        message:
          error instanceof Error
            ? error.message
            : "Teklif kaldırılamadı.",
      },
      {
        status:
          500,
      }
    );
  }
}
