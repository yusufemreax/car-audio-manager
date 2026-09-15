import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ObjectId,
} from "mongodb";

import {
  MultimediaPreparationPayload,
} from "@/types/multimedia-preparation";

import {
  buildMultimediaPreparationData,
  SystemPreparationBuildError,
} from "@/lib/multimedia-preparation-builder";

import {
  getMultimediaPreparationsCollection,
  serializeMultimediaPreparation,
} from "@/lib/multimedia-preparations-collection";

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
            "Geçersiz multimedya ID.",
        },
        {
          status:
            400,
        }
      );
    }

    const collection =
      await getMultimediaPreparationsCollection();

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
            "Multimedya bulunamadı.",
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
        serializeMultimediaPreparation(
          preparation
        ),
    });
  } catch (
    error
  ) {
    console.error(
      "GET /api/multimedia-preparations/[id] error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,
        message:
          "Multimedya getirilemedi.",
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
            "Geçersiz multimedya ID.",
        },
        {
          status:
            400,
        }
      );
    }

    const collection =
      await getMultimediaPreparationsCollection();

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
            "Multimedya bulunamadı.",
        },
        {
          status:
            404,
        }
      );
    }

    const body =
      (await request.json()) as
        MultimediaPreparationPayload;

    const preparationData =
      await buildMultimediaPreparationData(
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

    if (!preparationData.multimediaProductId) {
      unset.multimediaProductId = "";
    }

    if (!preparationData.multimediaScreenSize) {
      unset.multimediaScreenSize = "";
    }

    if (!preparationData.multimediaRam) {
      unset.multimediaRam = "";
    }

    if (!preparationData.multimediaStorage) {
      unset.multimediaStorage = "";
    }

    if (!preparationData.additionalDescription) {
      unset.additionalDescription = "";
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
        "Güncellenen multimedya tekrar okunamadı."
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
        serializeMultimediaPreparation(
          updated
        ),
    });
  } catch (
    error
  ) {
    console.error(
      "PUT /api/multimedia-preparations/[id] error:",
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
            : "Multimedya güncellenemedi.",
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
            "Geçersiz multimedya ID.",
        },
        {
          status:
            400,
        }
      );
    }

    const collection =
      await getMultimediaPreparationsCollection();

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
            "Multimedya bulunamadı.",
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
      "DELETE /api/multimedia-preparations/[id] error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,
        message:
          "Multimedya silinemedi.",
      },
      {
        status:
          500,
      }
    );
  }
}
