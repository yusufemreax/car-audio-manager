import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ObjectId,
} from "mongodb";

import {
  SystemPreparationPayload,
} from "@/types/system-preparation";

import {
  buildSystemPreparationData,
  SystemPreparationBuildError,
} from "@/lib/system-preparation-builder";

import {
  getSystemPreparationsCollection,
  serializeSystemPreparation,
} from "@/lib/system-preparations-collection";

interface RouteContext {
  params:
    Promise<{
      id: string;
    }>;
}

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

export async function GET(
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
            "Geçersiz sistem ID.",
        },
        {
          status:
            400,
        }
      );
    }

    const collection =
      await getSystemPreparationsCollection();

    const preparation =
      await collection.findOne(
        {
          _id:
            objectId,
        }
      );

    if (!preparation) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            "Sistem bulunamadı.",
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
        serializeSystemPreparation(
          preparation
        ),
    });
  } catch (
    error
  ) {
    console.error(
      "GET /api/system-preparations/[id] error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,
        message:
          "Sistem getirilemedi.",
      },
      {
        status:
          500,
      }
    );
  }
}

export async function PUT(
  request:
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
            "Geçersiz sistem ID.",
        },
        {
          status:
            400,
        }
      );
    }

    const collection =
      await getSystemPreparationsCollection();

    const existing =
      await collection.findOne(
        {
          _id:
            objectId,
        }
      );

    if (!existing) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            "Sistem bulunamadı.",
        },
        {
          status:
            404,
        }
      );
    }

    const body =
      (await request.json()) as
        SystemPreparationPayload;

    const preparationData =
      await buildSystemPreparationData(
        body
      );

    /*
     * Request -> builder zincirinden sonra false dahil olmak üzere
     * her ürün gerçek boolean taşımak zorunda.
     */
    const invalidCommissionItem =
      preparationData.items.find(
        (item) =>
          typeof item.isCommissionIncluded !==
          "boolean"
      );

    if (invalidCommissionItem) {
      throw new Error(
        `Komisyon seçimi oluşturulamadı: ${invalidCommissionItem.id}`
      );
    }

    const unset: Record<
      string,
      ""
    > = {};

    if (
      !preparationData.templateId
    ) {
      unset.templateId =
        "";
      unset.templateName =
        "";
    }

    if (
      !preparationData.exchangeRateDate
    ) {
      unset.exchangeRateDate =
        "";
    }

    await collection.updateOne(
      {
        _id:
          objectId,
      },
      {
        $set: {
          ...preparationData,
          status:
            existing.status,
          updatedAt:
            new Date(),
        },
        ...(Object.keys(
          unset
        ).length > 0
          ? {
              $unset:
                unset,
            }
          : {}),
      }
    );

    const updated =
      await collection.findOne(
        {
          _id:
            objectId,
        }
      );

    if (!updated) {
      throw new Error(
        "Güncellenen sistem tekrar okunamadı."
      );
    }

    /*
     * Update sonrası MongoDB'den tekrar okuyup alanın gerçekten
     * kaydedildiğini doğruluyoruz. false da boolean olduğu için geçer.
     */
    const missingStoredCommissionFlag =
      updated.items.find(
        (item) =>
          typeof item.isCommissionIncluded !==
          "boolean"
      );

    if (missingStoredCommissionFlag) {
      throw new Error(
        `MongoDB komisyon seçimini kaydetmedi: ${missingStoredCommissionFlag.id}`
      );
    }

    return NextResponse.json({
      success:
        true,
      data:
        serializeSystemPreparation(
          updated
        ),
    });
  } catch (
    error
  ) {
    console.error(
      "PUT /api/system-preparations/[id] error:",
      error
    );

    const status =
      error instanceof
      SystemPreparationBuildError
        ? error.status
        : 500;

    return NextResponse.json(
      {
        success:
          false,
        message:
          error instanceof Error
            ? error.message
            : "Sistem güncellenemedi.",
      },
      {
        status,
      }
    );
  }
}

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
            "Geçersiz sistem ID.",
        },
        {
          status:
            400,
        }
      );
    }

    const collection =
      await getSystemPreparationsCollection();

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
            "Sistem bulunamadı.",
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
  } catch (
    error
  ) {
    console.error(
      "DELETE /api/system-preparations/[id] error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,
        message:
          "Sistem silinemedi.",
      },
      {
        status:
          500,
      }
    );
  }
}
