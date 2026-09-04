import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ObjectId,
} from "mongodb";

import {
  SystemLaborItem,
} from "@/types/system-labor";

import {
  SystemTemplatePayload,
} from "@/types/system-template";

import {
  isProductCategory,
} from "@/lib/product-config";

import {
  getSystemTemplatesCollection,
  serializeSystemTemplate,
  SystemTemplateItemDocument,
} from "@/lib/system-templates-collection";

interface RouteContext {
  params:
    Promise<{
      id: string;
    }>;
}

function cleanString(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function safeNumber(
  value: unknown,
  fallback = 0
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : fallback;
}

function parseObjectId(
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

function validateItems(
  items:
    SystemTemplatePayload["items"]
):
  | {
      success: true;
      items:
        SystemTemplateItemDocument[];
    }
  | {
      success: false;
      message: string;
    } {
  if (
    !Array.isArray(
      items
    ) ||
    items.length ===
      0
  ) {
    return {
      success:
        false,
      message:
        "Şablona en az bir ürün alanı eklemelisiniz.",
    };
  }

  const normalized:
    SystemTemplateItemDocument[] =
      [];

  for (
    let index = 0;
    index <
    items.length;
    index += 1
  ) {
    const item =
      items[index];

    const id =
      cleanString(
        item.id
      );

    const label =
      cleanString(
        item.label
      );

    if (
      !id ||
      !label
    ) {
      return {
        success:
          false,
        message:
          "Şablon ürün alanı bilgileri eksik.",
      };
    }

    if (
      !isProductCategory(
        item.category
      )
    ) {
      return {
        success:
          false,
        message:
          `"${label}" için geçersiz ürün kategorisi.`,
      };
    }

    const quantity =
      safeNumber(
        item.quantity
      );

    if (
      !Number.isInteger(
        quantity
      ) ||
      quantity <=
        0
    ) {
      return {
        success:
          false,
        message:
          `"${label}" için geçerli bir adet giriniz.`,
      };
    }

    normalized.push({
      id,
      label,
      category:
        item.category,
      ...(cleanString(
        item.subCategory
      )
        ? {
            subCategory:
              cleanString(
                item.subCategory
              ),
          }
        : {}),
      quantity,
      sortOrder:
        index,
    });
  }

  return {
    success:
      true,
    items:
      normalized,
  };
}

function validateLaborItems(
  items:
    SystemTemplatePayload["laborItems"]
):
  | {
      success: true;
      items:
        SystemLaborItem[];
      total: number;
    }
  | {
      success: false;
      message: string;
    } {
  if (
    !Array.isArray(
      items
    )
  ) {
    return {
      success:
        false,
      message:
        "İşçilik kalemleri geçersiz.",
    };
  }

  const normalized:
    SystemLaborItem[] =
      [];

  for (
    let index = 0;
    index <
    items.length;
    index += 1
  ) {
    const item =
      items[index];

    const id =
      cleanString(
        item.id
      );

    const label =
      cleanString(
        item.label
      );

    const amountTry =
      safeNumber(
        item.amountTry,
        Number.NaN
      );

    if (
      !id ||
      !label
    ) {
      return {
        success:
          false,
        message:
          "Tüm işçilik kalemlerine bir açıklama vermelisiniz.",
      };
    }

    if (
      !Number.isFinite(
        amountTry
      ) ||
      amountTry <
        0
    ) {
      return {
        success:
          false,
        message:
          `"${label}" için geçerli bir TL tutarı giriniz.`,
      };
    }

    normalized.push({
      id,
      label,
      amountTry,
      sortOrder:
        index,
    });
  }

  return {
    success:
      true,
    items:
      normalized,
    total:
      normalized.reduce(
        (
          total,
          item
        ) =>
          total +
          item.amountTry,
        0
      ),
  };
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
      parseObjectId(
        id
      );

    if (!objectId) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            "Geçersiz şablon ID.",
        },
        {
          status:
            400,
        }
      );
    }

    const collection =
      await getSystemTemplatesCollection();

    const template =
      await collection.findOne(
        {
          _id:
            objectId,
        }
      );

    if (!template) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            "Şablon bulunamadı.",
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
        serializeSystemTemplate(
          template
        ),
    });
  } catch (
    error
  ) {
    console.error(
      "GET /api/system-templates/[id] error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,
        message:
          "Şablon getirilemedi.",
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
      parseObjectId(
        id
      );

    if (!objectId) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            "Geçersiz şablon ID.",
        },
        {
          status:
            400,
        }
      );
    }

    const body =
      (await request.json()) as
        SystemTemplatePayload;

    const name =
      cleanString(
        body.name
      );

    if (!name) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            "Şablon adı zorunludur.",
        },
        {
          status:
            400,
        }
      );
    }

    const itemValidation =
      validateItems(
        body.items
      );

    if (
      !itemValidation.success
    ) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            itemValidation.message,
        },
        {
          status:
            400,
        }
      );
    }

    const laborValidation =
      validateLaborItems(
        body.laborItems ??
          []
      );

    if (
      !laborValidation.success
    ) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            laborValidation.message,
        },
        {
          status:
            400,
        }
      );
    }

    const collection =
      await getSystemTemplatesCollection();

    const result =
      await collection.updateOne(
        {
          _id:
            objectId,
        },
        {
          $set: {
            name,
            laborItems:
              laborValidation.items,
            laborCostTry:
              laborValidation.total,
            items:
              itemValidation.items,
            updatedAt:
              new Date(),
          },
          $unset: {
            laborCostUsd:
              "",
          },
        }
      );

    if (
      result.matchedCount ===
      0
    ) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            "Şablon bulunamadı.",
        },
        {
          status:
            404,
        }
      );
    }

    const updated =
      await collection.findOne(
        {
          _id:
            objectId,
        }
      );

    if (!updated) {
      throw new Error(
        "Güncellenen şablon tekrar okunamadı."
      );
    }

    return NextResponse.json({
      success:
        true,
      data:
        serializeSystemTemplate(
          updated
        ),
    });
  } catch (
    error
  ) {
    console.error(
      "PUT /api/system-templates/[id] error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,
        message:
          error instanceof Error
            ? error.message
            : "Şablon güncellenemedi.",
      },
      {
        status:
          500,
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
      parseObjectId(
        id
      );

    if (!objectId) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            "Geçersiz şablon ID.",
        },
        {
          status:
            400,
        }
      );
    }

    const collection =
      await getSystemTemplatesCollection();

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
            "Şablon bulunamadı.",
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
      "DELETE /api/system-templates/[id] error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,
        message:
          "Şablon silinemedi.",
      },
      {
        status:
          500,
      }
    );
  }
}
