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

import type {
  SystemPreparation,
} from "@/types/system-preparation";

import {
  getCustomersCollection,
} from "@/lib/customers-collection";

import {
  getSystemPreparationsCollection,
  serializeSystemPreparation,
} from "@/lib/system-preparations-collection";

import {
  getMultimediaPreparationsCollection,
  serializeMultimediaPreparation,
} from "@/lib/multimedia-preparations-collection";

import {
  getCustomerSystemOffersCollection,
  serializeCustomerSystemOffer,
} from "@/lib/customer-system-offers-collection";

const offerSchema =
  z.object({
    offerType: z
      .enum([
        "system",
        "multimedia",
      ])
      .default(
        "system"
      ),

    customerId: z
      .string()
      .refine(
        ObjectId.isValid
      ),

    vehicleId: z
      .string()
      .min(1),

    readySystemId: z
      .string()
      .refine(
        ObjectId.isValid
      ),

    extraDiscountTry: z
      .number()
      .finite()
      .nonnegative(),
  });

export async function GET(
  request: NextRequest
) {
  try {
    const customerId =
      request.nextUrl.searchParams.get(
        "customerId"
      );

    const vehicleId =
      request.nextUrl.searchParams.get(
        "vehicleId"
      );

    const status =
      request.nextUrl.searchParams.get(
        "status"
      );

    const filter:
      Record<string, unknown> =
      {};

    if (
      customerId &&
      ObjectId.isValid(
        customerId
      )
    ) {
      filter.customerId =
        new ObjectId(
          customerId
        );
    }

    if (vehicleId) {
      filter.vehicleId =
        vehicleId;
    }

    if (
      status ===
        "offered" ||
      status ===
        "sold"
    ) {
      filter.status =
        status;
    }

    const collection =
      await getCustomerSystemOffersCollection();

    const records =
      await collection
        .find(filter)
        .sort({
          updatedAt: -1,
        })
        .toArray();

    return NextResponse.json({
      success: true,

      data:
        records.map(
          serializeCustomerSystemOffer
        ),
    });
  } catch (error) {
    console.error(
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Teklifler getirilemedi.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const validation =
      offerSchema.safeParse(
        body
      );

    if (
      !validation.success
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Teklif bilgileri geçersiz.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      offerType,
      customerId,
      vehicleId,
      readySystemId,
      extraDiscountTry,
    } = validation.data;

    /*
     * CUSTOMER + VEHICLE
     */
    const customers =
      await getCustomersCollection();

    const customer =
      await customers.findOne({
        _id:
          new ObjectId(
            customerId
          ),
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
        (vehicle) =>
          vehicle.id ===
          vehicleId
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

    let sourceId: ObjectId;
    let systemSnapshot: SystemPreparation;
    let sourceCustomerTotalTry: number;
    let sourceProfitTry: number;

    if (offerType === "multimedia") {
      if (
        !vehicle.vehicleGenerationId
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
      const multimedia =
        await multimediaCollection.findOne({
          _id: new ObjectId(
            readySystemId
          ),
          status: "ready",
        });

      if (!multimedia) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Hazır multimedya bulunamadı.",
          },
          {
            status: 404,
          }
        );
      }

      if (
        multimedia.vehicleGenerationId.toString() !==
        vehicle.vehicleGenerationId
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Seçilen hazır multimedya müşteri aracıyla uyumlu değil.",
          },
          {
            status: 400,
          }
        );
      }

      sourceId = multimedia._id;
      systemSnapshot =
        serializeMultimediaPreparation(
          multimedia
        );
      sourceCustomerTotalTry =
        multimedia.customerTotalTry;
      sourceProfitTry =
        multimedia.profitTry;
    } else {
      const systems =
        await getSystemPreparationsCollection();
      const readySystem =
        await systems.findOne({
          _id: new ObjectId(
            readySystemId
          ),
          status: "ready",
        });

      if (!readySystem) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Hazır sistem bulunamadı.",
          },
          {
            status: 404,
          }
        );
      }

      sourceId = readySystem._id;
      systemSnapshot =
        serializeSystemPreparation(
          readySystem
        );
      sourceCustomerTotalTry =
        readySystem.customerTotalTry;
      sourceProfitTry =
        readySystem.profitTry;
    }

    if (
      extraDiscountTry >
      sourceCustomerTotalTry
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

    const finalCustomerTotalTry =
      sourceCustomerTotalTry -
      extraDiscountTry;

    /*
     * Ek indirim direkt
     * kazançtan düşer.
     */
    const finalProfitTry =
      sourceProfitTry -
      extraDiscountTry;

    const collection =
      await getCustomerSystemOffersCollection();

    const now =
      new Date();

    const result =
      await collection.insertOne({
        offerType,

        customerId:
          new ObjectId(
            customerId
          ),

        vehicleId,

        readySystemId:
          sourceId,

        systemSnapshot,

        extraDiscountTry,

        finalCustomerTotalTry,

        finalProfitTry,

        status:
          "offered",

        createdAt:
          now,

        updatedAt:
          now,
      });

    const offer =
      await collection.findOne({
        _id:
          result.insertedId,
      });

    if (!offer) {
      throw new Error(
        "Teklif okunamadı."
      );
    }

    return NextResponse.json(
      {
        success: true,

        data:
          serializeCustomerSystemOffer(
            offer
          ),
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Teklif oluşturulamadı.",
      },
      {
        status: 500,
      }
    );
  }
}
