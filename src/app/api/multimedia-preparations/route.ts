import { refreshMultimediaForOffers } from "@/lib/multimedia-offer-refresh";
import {
  ObjectId,
} from "mongodb";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  SystemPreparationStatus,
} from "@/types/system-preparation";

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

export async function GET(
  request:
    NextRequest
) {
  try {
    const statusParam =
      request.nextUrl.searchParams.get(
        "status"
      );

    const vehicleGenerationIdParam =
      request.nextUrl.searchParams.get(
        "vehicleGenerationId"
      );

    if (
      vehicleGenerationIdParam &&
      !ObjectId.isValid(
        vehicleGenerationIdParam
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Geçersiz araç kasası bilgisi.",
        },
        {
          status: 400,
        }
      );
    }

    let status:
      SystemPreparationStatus |
      undefined;

    if (statusParam) {
      if (
        statusParam !==
          "draft" &&
        statusParam !==
          "ready"
      ) {
        return NextResponse.json(
          {
            success:
              false,
            message:
              "Geçersiz multimedya durumu.",
          },
          {
            status:
              400,
          }
        );
      }

      status =
        statusParam;
    }

    const collection =
      await getMultimediaPreparationsCollection();

    const filter: {
      status?: SystemPreparationStatus;
      vehicleGenerationId?: ObjectId;
    } = {};

    if (status) {
      filter.status = status;
    }

    if (vehicleGenerationIdParam) {
      filter.vehicleGenerationId =
        new ObjectId(
          vehicleGenerationIdParam
        );
    }

    const preparations =
      await collection
        .find(
          filter
        )
        .sort({
          createdAt:
            -1,
        })
        .toArray();

    const data = [];
    for (const preparation of preparations) {
      if (preparation.status !== "ready") { data.push(serializeMultimediaPreparation(preparation)); continue; }
      try { const [fresh] = await refreshMultimediaForOffers([preparation]); data.push(serializeMultimediaPreparation(fresh)); }
      catch (error) { data.push({ ...serializeMultimediaPreparation(preparation), refreshWarning: error instanceof Error ? error.message : "Ürünler yenilenemedi; son kayıt gösteriliyor." }); }
    }
    return NextResponse.json({ success: true, data });
  } catch (
    error
  ) {
    console.error(
      "GET /api/multimedia-preparations error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,
        message:
          error instanceof Error
            ? error.message
            : "Multimedyalar getirilemedi.",
      },
      {
        status:
          500,
      }
    );
  }
}

export async function POST(
  request:
    NextRequest
) {
  try {
    const body =
      (await request.json()) as
        MultimediaPreparationPayload;

    const preparationData =
      await buildMultimediaPreparationData(
        body
      );

    /*
     * Builder sonucunda her item mutlaka gerçek boolean taşımalı.
     * Böylece false değeri Mongo yazımından önce kaybolamaz.
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

    const collection =
      await getMultimediaPreparationsCollection();

    const now =
      new Date();

    const insertResult =
      await collection.insertOne(
        {
          ...preparationData,
          status:
            "draft",
          createdAt:
            now,
          updatedAt:
            now,
        }
      );

    const createdPreparation =
      await collection.findOne(
        {
          _id:
            insertResult.insertedId,
        }
      );

    if (!createdPreparation) {
      throw new Error(
        "Oluşturulan sistem tekrar okunamadı."
      );
    }

    const missingStoredCommissionFlag =
      createdPreparation.items.find(
        (item) =>
          typeof item.isCommissionIncluded !==
          "boolean"
      );

    if (missingStoredCommissionFlag) {
      throw new Error(
        `MongoDB komisyon seçimini kaydetmedi: ${missingStoredCommissionFlag.id}`
      );
    }

    return NextResponse.json(
      {
        success:
          true,
        data:
          serializeMultimediaPreparation(
            createdPreparation
          ),
      },
      {
        status:
          201,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "POST /api/multimedia-preparations error:",
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
            : "Multimedya kaydedilemedi.",
      },
      {
        status,
      }
    );
  }
}
