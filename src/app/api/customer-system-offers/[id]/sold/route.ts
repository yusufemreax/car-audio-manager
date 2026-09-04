import {
  ObjectId,
} from "mongodb";

import {
  NextResponse,
} from "next/server";

import {
  getCustomerSystemOffersCollection,
  serializeCustomerSystemOffer,
} from "@/lib/customer-system-offers-collection";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(
  _request: Request,
  context: RouteContext
) {
  try {
    const {
      id,
    } =
      await context.params;

    if (
      !ObjectId.isValid(id)
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Geçersiz teklif ID.",
        },
        {
          status: 400,
        }
      );
    }

    const collection =
      await getCustomerSystemOffersCollection();

    const objectId =
      new ObjectId(id);

    const now =
      new Date();

    const result =
      await collection.updateOne(
        {
          _id:
            objectId,

          status:
            "offered",
        },
        {
          $set: {
            status:
              "sold",

            soldAt:
              now,

            updatedAt:
              now,
          },
        }
      );

    if (
      result.modifiedCount ===
      0
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Teklif bulunamadı veya daha önce satılmış.",
        },
        {
          status: 400,
        }
      );
    }

    const offer =
      await collection.findOne({
        _id:
          objectId,
      });

    if (!offer) {
      throw new Error(
        "Satış kaydı okunamadı."
      );
    }

    /*
     * READY SYSTEM'E UPDATE YOK.
     *
     * INVENTORY UPDATE YOK.
     */

    return NextResponse.json({
      success: true,

      message:
        "Sistem satıldı olarak işaretlendi.",

      data:
        serializeCustomerSystemOffer(
          offer
        ),
    });
  } catch (error) {
    console.error(
      "Sold offer:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Satış durumu güncellenemedi.",
      },
      {
        status: 500,
      }
    );
  }
}