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
  type MultimediaPreparationDocument,
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
    const existing =
      await collection.findOne({
        _id: new ObjectId(id),
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message: "Kopyalanacak multimedya bulunamadı.",
        },
        { status: 404 }
      );
    }

    if (existing.status !== "ready") {
      return NextResponse.json(
        {
          success: false,
          message: "Yalnızca hazır multimedyalar kopyalanabilir.",
        },
        { status: 400 }
      );
    }

    const {
      _id: _ignoredId,
      ...withoutId
    } = existing;
    void _ignoredId;

    const now = new Date();

    const copiedDocument:
      MultimediaPreparationDocument = {
        ...withoutId,
        items: existing.items.map(
          (item) => ({
            ...item,
            ...(item.productId
              ? {
                  productId:
                    new ObjectId(
                      item.productId.toString()
                    ),
                }
              : {}),
            isCommissionIncluded:
              typeof item.isCommissionIncluded ===
              "boolean"
                ? item.isCommissionIncluded
                : true,
          })
        ),
        ...(Array.isArray(existing.laborItems)
          ? {
              laborItems:
                existing.laborItems.map(
                  (item, index) => ({
                    ...item,
                    sortOrder: index,
                  })
                ),
            }
          : {}),
        status: "ready",
        createdAt: now,
        updatedAt: now,
        readyAt: now,
      };

    const insertResult =
      await collection.insertOne(
        copiedDocument
      );
    const copied =
      await collection.findOne({
        _id: insertResult.insertedId,
      });

    if (!copied) {
      throw new Error(
        "Kopyalanan multimedya tekrar okunamadı."
      );
    }

    return NextResponse.json(
      {
        success: true,
        data:
          serializeMultimediaPreparation(
            copied
          ),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "POST /api/multimedia-preparations/[id]/copy error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Hazır multimedya kopyalanamadı.",
      },
      { status: 500 }
    );
  }
}
