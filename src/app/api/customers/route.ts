import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  customerSchema,
} from "@/lib/customer-schema";

import {
  getCustomersCollection,
  serializeCustomer,
} from "@/lib/customers-collection";

export async function GET() {
  try {
    const collection =
      await getCustomersCollection();

    const customers =
      await collection
        .find({})
        .sort({
          updatedAt: -1,
        })
        .toArray();

    return NextResponse.json({
      success: true,

      data:
        customers.map(
          serializeCustomer
        ),
    });
  } catch (error) {
    console.error(
      "GET customers:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Müşteriler getirilemedi.",
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
      await request
        .json()
        .catch(() => null);

    const validation =
      customerSchema.safeParse(
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

    const now =
      new Date();

    const result =
      await collection.insertOne({
        name:
          validation.data.name,

        phone:
          validation.data.phone ||
          undefined,

        email:
          validation.data.email ||
          undefined,

        notes:
          validation.data.notes ||
          undefined,

        vehicles: [],

        createdAt:
          now,

        updatedAt:
          now,
      });

    const customer =
      await collection.findOne({
        _id:
          result.insertedId,
      });

    if (!customer) {
      throw new Error(
        "Müşteri okunamadı."
      );
    }

    return NextResponse.json(
      {
        success: true,

        data:
          serializeCustomer(
            customer
          ),
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "POST customer:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Müşteri oluşturulamadı.",
      },
      {
        status: 500,
      }
    );
  }
}