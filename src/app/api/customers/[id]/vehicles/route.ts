import {
  ObjectId,
} from "mongodb";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  customerVehicleSchema,
} from "@/lib/customer-schema";

import {
  getCustomersCollection,
  serializeCustomer,
} from "@/lib/customers-collection";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(
  request: NextRequest,
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
            "Geçersiz müşteri ID.",
        },
        {
          status: 400,
        }
      );
    }

    const body =
      await request
        .json()
        .catch(() => null);

    const validation =
      customerVehicleSchema.safeParse(
        body
      );

    if (
      !validation.success
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            validation.error
              .issues[0]
              ?.message,
        },
        {
          status: 400,
        }
      );
    }

    const collection =
      await getCustomersCollection();

    const vehicle = {
      id:
        crypto.randomUUID(),

      brand:
        validation.data.brand,

      model:
        validation.data.model,

      year:
        validation.data.year,

      plate:
        validation.data.plate ||
        undefined,

      note:
        validation.data.note ||
        undefined,
    };

    const objectId =
      new ObjectId(id);

    const result =
      await collection.updateOne(
        {
          _id:
            objectId,
        },
        {
          $push: {
            vehicles:
              vehicle,
          },

          $set: {
            updatedAt:
              new Date(),
          },
        }
      );

    if (
      result.matchedCount ===
      0
    ) {
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

    const customer =
      await collection.findOne({
        _id:
          objectId,
      });

    if (!customer) {
      throw new Error(
        "Müşteri okunamadı."
      );
    }

    return NextResponse.json({
      success: true,

      data:
        serializeCustomer(
          customer
        ),
    });
  } catch (error) {
    console.error(
      "POST vehicle:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Araç eklenemedi.",
      },
      {
        status: 500,
      }
    );
  }
}