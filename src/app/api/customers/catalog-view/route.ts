import {
  NextResponse,
} from "next/server";

import {
  getCustomersCollection,
  serializeCustomer,
} from "@/lib/customers-collection";

function optionalString(
  value: unknown
) {
  return typeof value === "string" &&
    value.trim()
    ? value
    : undefined;
}

function optionalNumber(
  value: unknown
) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : undefined;
}

function serializeCustomerWithCatalog(
  customer: any
) {
  const serialized =
    serializeCustomer(
      customer
    ) as any;

  const rawVehicles =
    Array.isArray(
      customer?.vehicles
    )
      ? customer.vehicles
      : [];

  const serializedVehicles =
    Array.isArray(
      serialized?.vehicles
    )
      ? serialized.vehicles
      : [];

  return {
    ...serialized,
    vehicles:
      serializedVehicles.map(
        (vehicle: any) => {
          const raw =
            rawVehicles.find(
              (candidate: any) =>
                String(
                  candidate?.id ??
                    ""
                ) ===
                String(
                  vehicle?.id ??
                    ""
                )
            ) ?? {};

          return {
            ...vehicle,
            ...(optionalString(
              raw.vehicleBrandId
            )
              ? {
                  vehicleBrandId:
                    optionalString(
                      raw.vehicleBrandId
                    ),
                }
              : {}),
            ...(optionalString(
              raw.vehicleModelId
            )
              ? {
                  vehicleModelId:
                    optionalString(
                      raw.vehicleModelId
                    ),
                }
              : {}),
            ...(optionalString(
              raw.vehicleGenerationId
            )
              ? {
                  vehicleGenerationId:
                    optionalString(
                      raw.vehicleGenerationId
                    ),
                }
              : {}),
            ...(optionalString(
              raw.vehicleGenerationName
            )
              ? {
                  vehicleGenerationName:
                    optionalString(
                      raw.vehicleGenerationName
                    ),
                }
              : {}),
            ...(optionalNumber(
              raw.vehicleStartYear
            ) !== undefined
              ? {
                  vehicleStartYear:
                    optionalNumber(
                      raw.vehicleStartYear
                    ),
                }
              : {}),
            ...(optionalNumber(
              raw.vehicleEndYear
            ) !== undefined
              ? {
                  vehicleEndYear:
                    optionalNumber(
                      raw.vehicleEndYear
                    ),
                }
              : {}),
          };
        }
      ),
  };
}

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
          serializeCustomerWithCatalog
        ),
    });
  } catch (error) {
    console.error(
      "GET /api/customers/catalog-view error:",
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
