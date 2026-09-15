import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ObjectId,
} from "mongodb";

import {
  getMultimediaPreparationsCollection,
  serializeMultimediaPreparation,
} from "@/lib/multimedia-preparations-collection";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Geçersiz multimedya ID.",
        },
        { status: 400 }
      );
    }

    const collection =
      await getMultimediaPreparationsCollection();
    const objectId = new ObjectId(id);
    const existing =
      await collection.findOne({
        _id: objectId,
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message: "Multimedya kaydı bulunamadı.",
        },
        { status: 404 }
      );
    }

    if (existing.status === "ready") {
      return NextResponse.json(
        {
          success: false,
          message: "Bu multimedya zaten hazır durumda.",
        },
        { status: 409 }
      );
    }

    if (!existing.multimediaProductId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Hazır multimedya oluşturmak için en az bir Multimedya ürünü seçmelisiniz.",
        },
        { status: 400 }
      );
    }

    const now = new Date();

    await collection.updateOne(
      { _id: objectId },
      {
        $set: {
          status: "ready",
          readyAt: now,
          updatedAt: now,
        },
      }
    );

    const updated =
      await collection.findOne({
        _id: objectId,
      });

    if (!updated) {
      throw new Error(
        "Hazır multimedya tekrar okunamadı."
      );
    }

    return NextResponse.json({
      success: true,
      data:
        serializeMultimediaPreparation(
          updated
        ),
    });
  } catch (error) {
    console.error(
      "POST /api/multimedia-preparations/[id]/ready error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Hazır multimedya oluşturulamadı.",
      },
      { status: 500 }
    );
  }
}
