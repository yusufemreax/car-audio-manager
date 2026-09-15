import {
  randomUUID,
} from "node:crypto";

import {
  ObjectId,
} from "mongodb";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCustomersCollection,
} from "@/lib/customers-collection";

import {
  getVehicleCatalogCollections,
} from "@/lib/vehicle-catalog-store";

function cleanString(
  value: unknown
) {
  return typeof value === "string"
    ? value
        .trim()
        .replace(/\s+/g, " ")
    : "";
}

function toObjectId(
  value: unknown
) {
  if (
    typeof value !== "string" ||
    !ObjectId.isValid(value)
  ) {
    return null;
  }

  return new ObjectId(value);
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } =
      await context.params;

    const customerId =
      toObjectId(id);

    if (!customerId) {
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

    if (
      !body ||
      typeof body !== "object"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Araç bilgileri alınamadı.",
        },
        {
          status: 400,
        }
      );
    }

    const vehicleBrandId =
      toObjectId(
        Reflect.get(
          body,
          "vehicleBrandId"
        )
      );

    const vehicleModelId =
      toObjectId(
        Reflect.get(
          body,
          "vehicleModelId"
        )
      );

    const vehicleGenerationId =
      toObjectId(
        Reflect.get(
          body,
          "vehicleGenerationId"
        )
      );

    if (!vehicleBrandId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Araç markası seçmelisiniz.",
        },
        {
          status: 400,
        }
      );
    }

    if (!vehicleModelId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Araç modeli seçmelisiniz.",
        },
        {
          status: 400,
        }
      );
    }

    if (!vehicleGenerationId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Araç kasası seçmelisiniz.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      brands,
      models,
      generations,
    } =
      await getVehicleCatalogCollections();

    const brand =
      await brands.findOne({
        _id:
          vehicleBrandId,
      });

    if (!brand) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Seçilen araç markası sistemde bulunamadı.",
        },
        {
          status: 400,
        }
      );
    }

    const model =
      await models.findOne({
        _id:
          vehicleModelId,
        brandId:
          vehicleBrandId,
      });

    if (!model) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Seçilen araç modeli markayla eşleşmiyor.",
        },
        {
          status: 400,
        }
      );
    }

    const generation =
      await generations.findOne({
        _id:
          vehicleGenerationId,
        brandId:
          vehicleBrandId,
        modelId:
          vehicleModelId,
      });

    if (!generation) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Seçilen araç kasası modelle eşleşmiyor.",
        },
        {
          status: 400,
        }
      );
    }

    const rawYear =
      Reflect.get(
        body,
        "year"
      );

    let year:
      number | undefined;

    if (
      rawYear !== undefined &&
      rawYear !== null &&
      rawYear !== ""
    ) {
      const parsedYear =
        Number(rawYear);

      if (
        !Number.isInteger(
          parsedYear
        ) ||
        parsedYear <
          generation.startYear ||
        parsedYear >
          generation.endYear
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Model yılı ${generation.startYear}-${generation.endYear} aralığında olmalıdır.`,
          },
          {
            status: 400,
          }
        );
      }

      year = parsedYear;
    }

    const plate =
      cleanString(
        Reflect.get(
          body,
          "plate"
        )
      ).toLocaleUpperCase(
        "tr-TR"
      );

    const note =
      cleanString(
        Reflect.get(
          body,
          "note"
        )
      );

    const vehicle = {
      id: randomUUID(),

      vehicleBrandId:
        vehicleBrandId.toString(),
      vehicleModelId:
        vehicleModelId.toString(),
      vehicleGenerationId:
        vehicleGenerationId.toString(),

      brand:
        brand.name,
      model:
        model.name,

      vehicleGenerationName:
        generation.name,
      vehicleStartYear:
        generation.startYear,
      vehicleEndYear:
        generation.endYear,

      ...(year !== undefined
        ? {
            year,
          }
        : {}),
      ...(plate
        ? {
            plate,
          }
        : {}),
      ...(note
        ? {
            note,
          }
        : {}),
    };

    const customers =
      await getCustomersCollection();

    const now =
      new Date();

    /*
     * Customer document tipi eski araç alanlarını tanıyor olabilir.
     * MongoDB dokümanında yeni katalog alanlarını geriye uyumlu şekilde
     * saklamak için update işlemini yalnızca bu noktada genişletiyoruz.
     */
    const updateResult =
      await (
        customers as any
      ).updateOne(
        {
          _id:
            customerId,
        },
        {
          $push: {
            vehicles:
              vehicle,
          },
          $set: {
            updatedAt:
              now,
          },
        }
      );

    if (
      updateResult.matchedCount ===
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

    return NextResponse.json(
      {
        success: true,
        message:
          "Araç müşteriye eklendi.",
        data:
          vehicle,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "POST /api/customers/[id]/vehicles/catalog error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Araç kaydedilemedi.",
      },
      {
        status: 500,
      }
    );
  }
}
