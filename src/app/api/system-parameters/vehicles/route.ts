import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  MongoServerError,
  ObjectId,
  type WithId,
} from "mongodb";

import {
  getVehicleCatalogCollections,
  normalizeVehicleName,
  type VehicleBrandDocument,
  type VehicleGenerationDocument,
  type VehicleModelDocument,
} from "@/lib/vehicle-catalog-store";

import type {
  VehicleBrand,
  VehicleCatalogEntity,
  VehicleCatalogResponse,
  VehicleGeneration,
  VehicleModel,
} from "@/types/vehicle-catalog";

function cleanString(
  value: unknown
) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ")
    : "";
}

function isEntity(
  value: unknown
): value is VehicleCatalogEntity {
  return (
    value === "brand" ||
    value === "model" ||
    value === "generation"
  );
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

function parseYear(
  value: unknown
) {
  const year = Number(value);

  if (
    !Number.isInteger(year) ||
    year < 1900 ||
    year > 2100
  ) {
    return null;
  }

  return year;
}

function serializeGeneration(
  item: WithId<VehicleGenerationDocument>
): VehicleGeneration {
  return {
    id: item._id.toString(),
    modelId:
      item.modelId.toString(),
    name: item.name,
    startYear:
      item.startYear,
    endYear:
      item.endYear,
    createdAt:
      item.createdAt.toISOString(),
    updatedAt:
      item.updatedAt.toISOString(),
  };
}

function serializeModel(
  item: WithId<VehicleModelDocument>,
  generations: VehicleGeneration[]
): VehicleModel {
  return {
    id: item._id.toString(),
    brandId:
      item.brandId.toString(),
    name: item.name,
    generations,
    createdAt:
      item.createdAt.toISOString(),
    updatedAt:
      item.updatedAt.toISOString(),
  };
}

async function loadCatalog(): Promise<VehicleCatalogResponse> {
  const {
    brands,
    models,
    generations,
  } =
    await getVehicleCatalogCollections();

  const [
    brandDocuments,
    modelDocuments,
    generationDocuments,
  ] = await Promise.all([
    brands
      .find({})
      .sort({
        name: 1,
      })
      .toArray(),
    models
      .find({})
      .sort({
        name: 1,
      })
      .toArray(),
    generations
      .find({})
      .sort({
        startYear: 1,
        endYear: 1,
        name: 1,
      })
      .toArray(),
  ]);

  const generationMap =
    new Map<string, VehicleGeneration[]>();

  for (
    const generation of
      generationDocuments
  ) {
    const key =
      generation.modelId.toString();
    const current =
      generationMap.get(key) ?? [];

    current.push(
      serializeGeneration(
        generation
      )
    );

    generationMap.set(
      key,
      current
    );
  }

  const modelMap =
    new Map<string, VehicleModel[]>();

  for (
    const model of
      modelDocuments
  ) {
    const key =
      model.brandId.toString();
    const current =
      modelMap.get(key) ?? [];

    current.push(
      serializeModel(
        model,
        generationMap.get(
          model._id.toString()
        ) ?? []
      )
    );

    modelMap.set(
      key,
      current
    );
  }

  const serializedBrands:
    VehicleBrand[] =
    brandDocuments.map(
      (brand) => ({
        id:
          brand._id.toString(),
        name: brand.name,
        models:
          modelMap.get(
            brand._id.toString()
          ) ?? [],
        createdAt:
          brand.createdAt.toISOString(),
        updatedAt:
          brand.updatedAt.toISOString(),
      })
    );

  return {
    brands:
      serializedBrands,
    summary: {
      brandCount:
        brandDocuments.length,
      modelCount:
        modelDocuments.length,
      generationCount:
        generationDocuments.length,
    },
  };
}

function duplicateResponse(
  entity: VehicleCatalogEntity
) {
  const labels = {
    brand: "Bu araç markası zaten tanımlı.",
    model:
      "Bu markada aynı araç modeli zaten tanımlı.",
    generation:
      "Bu modelde aynı kasa ve yıl aralığı zaten tanımlı.",
  } as const;

  return NextResponse.json(
    {
      success: false,
      message:
        labels[entity],
    },
    {
      status: 409,
    }
  );
}

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data:
        await loadCatalog(),
    });
  } catch (error) {
    console.error(
      "GET /api/system-parameters/vehicles error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Araç kataloğu getirilemedi.",
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
      (await request.json()) as Record<
        string,
        unknown
      >;

    if (!isEntity(body.entity)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Geçersiz araç parametresi türü.",
        },
        {
          status: 400,
        }
      );
    }

    const entity =
      body.entity;
    const name =
      cleanString(body.name);

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message:
            entity === "brand"
              ? "Marka adı zorunludur."
              : entity === "model"
                ? "Model adı zorunludur."
                : "Kasa / nesil adı zorunludur.",
        },
        {
          status: 400,
        }
      );
    }

    const collections =
      await getVehicleCatalogCollections();
    const now =
      new Date();

    if (entity === "brand") {
      await collections.brands.insertOne({
        name,
        normalizedName:
          normalizeVehicleName(
            name
          ),
        createdAt: now,
        updatedAt: now,
      });
    }

    if (entity === "model") {
      const brandId =
        toObjectId(
          body.brandId
        );

      if (!brandId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Geçerli bir marka seçilmelidir.",
          },
          {
            status: 400,
          }
        );
      }

      const brand =
        await collections.brands.findOne({
          _id: brandId,
        });

      if (!brand) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Araç markası bulunamadı.",
          },
          {
            status: 404,
          }
        );
      }

      await collections.models.insertOne({
        brandId,
        name,
        normalizedName:
          normalizeVehicleName(
            name
          ),
        createdAt: now,
        updatedAt: now,
      });
    }

    if (entity === "generation") {
      const modelId =
        toObjectId(
          body.modelId
        );
      const startYear =
        parseYear(
          body.startYear
        );
      const endYear =
        parseYear(
          body.endYear
        );

      if (!modelId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Geçerli bir araç modeli seçilmelidir.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        startYear === null ||
        endYear === null
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Başlangıç ve bitiş yılı 1900-2100 arasında olmalıdır.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        startYear > endYear
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Başlangıç yılı bitiş yılından büyük olamaz.",
          },
          {
            status: 400,
          }
        );
      }

      const model =
        await collections.models.findOne({
          _id: modelId,
        });

      if (!model) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Araç modeli bulunamadı.",
          },
          {
            status: 404,
          }
        );
      }

      await collections.generations.insertOne({
        brandId:
          model.brandId,
        modelId,
        name,
        normalizedName:
          normalizeVehicleName(
            name
          ),
        startYear,
        endYear,
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({
      success: true,
      data:
        await loadCatalog(),
    });
  } catch (error) {
    if (
      error instanceof MongoServerError &&
      error.code === 11000
    ) {
      const bodyEntity =
        (() => {
          const key =
            Object.keys(
              error.keyPattern ?? {}
            );

          if (
            key.includes("modelId") &&
            key.includes("startYear")
          ) {
            return "generation" as const;
          }

          if (
            key.includes("brandId")
          ) {
            return "model" as const;
          }

          return "brand" as const;
        })();

      return duplicateResponse(
        bodyEntity
      );
    }

    console.error(
      "POST /api/system-parameters/vehicles error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Araç parametresi kaydedilemedi.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PUT(
  request: NextRequest
) {
  try {
    const body =
      (await request.json()) as Record<
        string,
        unknown
      >;

    if (!isEntity(body.entity)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Geçersiz araç parametresi türü.",
        },
        {
          status: 400,
        }
      );
    }

    const entity =
      body.entity;
    const id =
      toObjectId(body.id);
    const name =
      cleanString(body.name);

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Geçersiz kayıt ID.",
        },
        {
          status: 400,
        }
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Ad alanı zorunludur.",
        },
        {
          status: 400,
        }
      );
    }

    const collections =
      await getVehicleCatalogCollections();
    const now =
      new Date();

    if (entity === "brand") {
      const result =
        await collections.brands.updateOne(
          {
            _id: id,
          },
          {
            $set: {
              name,
              normalizedName:
                normalizeVehicleName(
                  name
                ),
              updatedAt: now,
            },
          }
        );

      if (
        result.matchedCount === 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Araç markası bulunamadı.",
          },
          {
            status: 404,
          }
        );
      }
    }

    if (entity === "model") {
      const result =
        await collections.models.updateOne(
          {
            _id: id,
          },
          {
            $set: {
              name,
              normalizedName:
                normalizeVehicleName(
                  name
                ),
              updatedAt: now,
            },
          }
        );

      if (
        result.matchedCount === 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Araç modeli bulunamadı.",
          },
          {
            status: 404,
          }
        );
      }
    }

    if (entity === "generation") {
      const startYear =
        parseYear(
          body.startYear
        );
      const endYear =
        parseYear(
          body.endYear
        );

      if (
        startYear === null ||
        endYear === null
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Başlangıç ve bitiş yılı 1900-2100 arasında olmalıdır.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        startYear > endYear
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Başlangıç yılı bitiş yılından büyük olamaz.",
          },
          {
            status: 400,
          }
        );
      }

      const result =
        await collections.generations.updateOne(
          {
            _id: id,
          },
          {
            $set: {
              name,
              normalizedName:
                normalizeVehicleName(
                  name
                ),
              startYear,
              endYear,
              updatedAt: now,
            },
          }
        );

      if (
        result.matchedCount === 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Araç kasası bulunamadı.",
          },
          {
            status: 404,
          }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data:
        await loadCatalog(),
    });
  } catch (error) {
    if (
      error instanceof MongoServerError &&
      error.code === 11000
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Aynı isim / yıl bilgisine sahip kayıt zaten mevcut.",
        },
        {
          status: 409,
        }
      );
    }

    console.error(
      "PUT /api/system-parameters/vehicles error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Araç parametresi güncellenemedi.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(
  request: NextRequest
) {
  try {
    const entity =
      request.nextUrl.searchParams.get(
        "entity"
      );
    const id =
      toObjectId(
        request.nextUrl.searchParams.get(
          "id"
        )
      );

    if (!isEntity(entity)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Geçersiz araç parametresi türü.",
        },
        {
          status: 400,
        }
      );
    }

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Geçersiz kayıt ID.",
        },
        {
          status: 400,
        }
      );
    }

    const collections =
      await getVehicleCatalogCollections();

    let deletedModels = 0;
    let deletedGenerations = 0;

    if (entity === "brand") {
      const childModels =
        await collections.models
          .find(
            {
              brandId: id,
            },
            {
              projection: {
                _id: 1,
              },
            }
          )
          .toArray();

      const modelIds =
        childModels.map(
          (item) => item._id
        );

      if (
        modelIds.length > 0
      ) {
        const generationResult =
          await collections.generations.deleteMany({
            modelId: {
              $in: modelIds,
            },
          });

        deletedGenerations =
          generationResult.deletedCount;
      }

      const modelResult =
        await collections.models.deleteMany({
          brandId: id,
        });

      deletedModels =
        modelResult.deletedCount;

      const brandResult =
        await collections.brands.deleteOne({
          _id: id,
        });

      if (
        brandResult.deletedCount === 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Araç markası bulunamadı.",
          },
          {
            status: 404,
          }
        );
      }
    }

    if (entity === "model") {
      const generationResult =
        await collections.generations.deleteMany({
          modelId: id,
        });

      deletedGenerations =
        generationResult.deletedCount;

      const modelResult =
        await collections.models.deleteOne({
          _id: id,
        });

      if (
        modelResult.deletedCount === 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Araç modeli bulunamadı.",
          },
          {
            status: 404,
          }
        );
      }
    }

    if (entity === "generation") {
      const result =
        await collections.generations.deleteOne({
          _id: id,
        });

      if (
        result.deletedCount === 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Araç kasası bulunamadı.",
          },
          {
            status: 404,
          }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data:
        await loadCatalog(),
      deletion: {
        entity,
        deletedModels,
        deletedGenerations,
      },
    });
  } catch (error) {
    console.error(
      "DELETE /api/system-parameters/vehicles error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Araç parametresi silinemedi.",
      },
      {
        status: 500,
      }
    );
  }
}
