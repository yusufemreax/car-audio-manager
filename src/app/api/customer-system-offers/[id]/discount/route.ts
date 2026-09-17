import {
  ObjectId,
} from "mongodb";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  z,
} from "zod";

import {
  getCustomerSystemOffersCollection,
  serializeCustomerSystemOffer,
} from "@/lib/customer-system-offers-collection";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

const requestSchema = z.object({
  extraDiscountTry: z
    .number()
    .finite()
    .nonnegative(),
});

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const {
      id,
    } = await context.params;

    if (!ObjectId.isValid(id)) {
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

    const validation =
      requestSchema.safeParse(
        await request.json()
      );

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Ek indirim tutarı geçersiz.",
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
    const offer =
      await collection.findOne({
        _id: objectId,
      });

    if (!offer) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Teklif bulunamadı.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      offer.offerType !==
      "multimedia"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Yalnızca multimedya teklifinin indirimi bu ekrandan düzenlenebilir.",
        },
        {
          status: 400,
        }
      );
    }

    if (offer.status !== "offered") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Satış işlemi başlamış teklifin indirimi değiştirilemez.",
        },
        {
          status: 409,
        }
      );
    }

    const extraDiscountTry =
      Math.round(
        validation.data.extraDiscountTry *
          100
      ) / 100;
    const baseCustomerTotalTry =
      Number(
        offer.systemSnapshot
          .customerTotalTry
      );
    const baseProfitTry =
      Number(
        offer.systemSnapshot
          .profitTry
      );

    if (
      !Number.isFinite(
        baseCustomerTotalTry
      ) ||
      !Number.isFinite(
        baseProfitTry
      )
    ) {
      throw new Error(
        "Teklif fiyat özeti geçersiz."
      );
    }

    if (
      extraDiscountTry >
      baseCustomerTotalTry
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Ek indirim müşteri toplamından büyük olamaz.",
        },
        {
          status: 400,
        }
      );
    }

    const updateResult =
      await collection.updateOne(
        {
          _id: objectId,
          offerType:
            "multimedia",
          status:
            "offered",
        },
        {
          $set: {
            extraDiscountTry,
            finalCustomerTotalTry:
              baseCustomerTotalTry -
              extraDiscountTry,
            finalProfitTry:
              baseProfitTry -
              extraDiscountTry,
            updatedAt:
              new Date(),
          },
        }
      );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Teklif durumu değiştiği için indirim güncellenemedi.",
        },
        {
          status: 409,
        }
      );
    }

    const updatedOffer =
      await collection.findOne({
        _id: objectId,
      });

    if (!updatedOffer) {
      throw new Error(
        "Güncellenen teklif tekrar okunamadı."
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Multimedya teklifi indirimi güncellendi.",
      data:
        serializeCustomerSystemOffer(
          updatedOffer
        ),
    });
  } catch (error) {
    console.error(
      "PATCH /api/customer-system-offers/[id]/discount error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Teklif indirimi güncellenemedi.",
      },
      {
        status: 500,
      }
    );
  }
}
