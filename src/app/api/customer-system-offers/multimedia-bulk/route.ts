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
  getCustomersCollection,
} from "@/lib/customers-collection";
import {
  getCustomerSystemOffersCollection,
  serializeCustomerSystemOffer,
} from "@/lib/customer-system-offers-collection";
import {
  getMultimediaPreparationsCollection,
  serializeMultimediaPreparation,
} from "@/lib/multimedia-preparations-collection";

const requestSchema = z.object({
  customerId: z
    .string()
    .refine(ObjectId.isValid),
  vehicleId: z
    .string()
    .min(1),
});

const ACTIVE_STATUSES = [
  "offered",
  "order_pending",
  "installation_pending",
] as const;

export async function POST(
  request: NextRequest
) {
  try {
    const validation =
      requestSchema.safeParse(
        await request.json()
      );

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Müşteri veya araç bilgisi geçersiz.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      customerId,
      vehicleId,
    } = validation.data;
    const customerObjectId =
      new ObjectId(customerId);

    const customers =
      await getCustomersCollection();
    const customer =
      await customers.findOne({
        _id: customerObjectId,
      });

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Müşteri bulunamadı.",
        },
        {
          status: 404,
        }
      );
    }

    const vehicle =
      customer.vehicles.find(
        (item) =>
          item.id === vehicleId
      );

    if (!vehicle) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Araç bulunamadı.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      !vehicle.vehicleGenerationId ||
      !ObjectId.isValid(
        vehicle.vehicleGenerationId
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Müşteri aracı araç kataloğuna bağlı değil.",
        },
        {
          status: 400,
        }
      );
    }

    const multimediaCollection =
      await getMultimediaPreparationsCollection();
    const compatibleMultimedias =
      await multimediaCollection
        .find({
          vehicleGenerationId:
            new ObjectId(
              vehicle.vehicleGenerationId
            ),
          status: "ready",
        })
        .sort({
          createdAt: -1,
        })
        .toArray();

    if (
      compatibleMultimedias.length ===
      0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Bu araç için uyumlu hazır multimedya bulunamadı.",
        },
        {
          status: 404,
        }
      );
    }

    const offers =
      await getCustomerSystemOffersCollection();
    const sourceIds =
      compatibleMultimedias.map(
        (item) => item._id
      );
    const existingOffers =
      await offers
        .find({
          customerId:
            customerObjectId,
          vehicleId,
          offerType:
            "multimedia",
          readySystemId: {
            $in: sourceIds,
          },
          status: {
            $in: [
              ...ACTIVE_STATUSES,
            ],
          },
        })
        .project({
          readySystemId: 1,
        })
        .toArray();
    const existingSourceIds =
      new Set(
        existingOffers.map(
          (offer) =>
            offer.readySystemId.toString()
        )
      );
    const newMultimedias =
      compatibleMultimedias.filter(
        (item) =>
          !existingSourceIds.has(
            item._id.toString()
          )
      );

    if (newMultimedias.length === 0) {
      return NextResponse.json({
        success: true,
        message:
          "Uyumlu hazır multimedyaların tamamı zaten aktif tekliflerde bulunuyor.",
        data: [],
        compatibleCount:
          compatibleMultimedias.length,
        addedCount: 0,
        skippedCount:
          compatibleMultimedias.length,
      });
    }

    const now = new Date();
    const documents =
      newMultimedias.map(
        (multimedia) => ({
          offerType:
            "multimedia" as const,
          customerId:
            customerObjectId,
          vehicleId,
          readySystemId:
            multimedia._id,
          systemSnapshot:
            serializeMultimediaPreparation(
              multimedia
            ),
          extraDiscountTry: 0,
          finalCustomerTotalTry:
            multimedia.customerTotalTry,
          finalProfitTry:
            multimedia.profitTry,
          status:
            "offered" as const,
          createdAt: now,
          updatedAt: now,
        })
      );
    const insertResult =
      await offers.insertMany(
        documents
      );
    const insertedIds =
      Object.values(
        insertResult.insertedIds
      );
    const insertedOffers =
      await offers
        .find({
          _id: {
            $in: insertedIds,
          },
        })
        .sort({
          createdAt: -1,
        })
        .toArray();
    const skippedCount =
      compatibleMultimedias.length -
      insertedOffers.length;

    return NextResponse.json(
      {
        success: true,
        message:
          skippedCount > 0
            ? `${insertedOffers.length} multimedya teklifi eklendi, ${skippedCount} aktif teklif tekrar eklenmedi.`
            : `${insertedOffers.length} uyumlu multimedya teklifi eklendi.`,
        data:
          insertedOffers.map(
            serializeCustomerSystemOffer
          ),
        compatibleCount:
          compatibleMultimedias.length,
        addedCount:
          insertedOffers.length,
        skippedCount,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "POST /api/customer-system-offers/multimedia-bulk error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Multimedya teklifleri oluşturulamadı.",
      },
      {
        status: 500,
      }
    );
  }
}
