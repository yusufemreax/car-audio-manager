import {
  ObjectId,
} from "mongodb";

import {
  NextResponse,
} from "next/server";

import {
  getSystemPreparationsCollection,
  serializeSystemPreparation,
} from "@/lib/system-preparations-collection";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(
  _request: Request,
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
            "Geçersiz sistem ID.",
        },
        {
          status: 400,
        }
      );
    }

    const collection =
      await getSystemPreparationsCollection();

    const objectId =
      new ObjectId(id);

    const system =
      await collection.findOne({
        _id:
          objectId,
      });

    if (!system) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Sistem bulunamadı.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      system.status ===
      "ready"
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Bu sistem zaten hazır durumda.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Hazır sistemde boş
     * ürün alanı olmasın.
     */
    const missingItem =
      system.items.find(
        (item) =>
          !item.productId
      );

    if (missingItem) {
      return NextResponse.json(
        {
          success: false,

          message:
            `"${missingItem.label}" için ürün seçilmelidir.`,
        },
        {
          status: 400,
        }
      );
    }

    const now =
      new Date();

    await collection.updateOne(
      {
        _id:
          objectId,

        status:
          "draft",
      },
      {
        $set: {
          status:
            "ready",

          readyAt:
            now,

          updatedAt:
            now,
        },
      }
    );

    /*
     * DİKKAT:
     *
     * Inventory yok.
     * StockMovement yok.
     * Stok düşümü yok.
     */

    const updated =
      await collection.findOne({
        _id:
          objectId,
      });

    if (!updated) {
      throw new Error(
        "Hazır sistem okunamadı."
      );
    }

    return NextResponse.json({
      success: true,

      message:
        "Sistem hazır sistem olarak kaydedildi.",

      data:
        serializeSystemPreparation(
          updated
        ),
    });
  } catch (error) {
    console.error(
      "Ready system:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Sistem hazır duruma getirilemedi.",
      },
      {
        status: 500,
      }
    );
  }
}