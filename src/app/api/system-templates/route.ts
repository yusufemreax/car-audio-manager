import {
  NextRequest,
  NextResponse,
} from "next/server";

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

    if (!id) {
      return {
        success:
          false,
        message:
          "Şablon ürün alanı ID bilgisi eksik.",
      };
    }

    if (!label) {
      return {
        success:
          false,
        message:
          "Tüm ürün alanlarına bir isim vermelisiniz.",
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

export async function GET() {
  try {
    const collection =
      await getSystemTemplatesCollection();

    const templates =
      await collection
        .find({})
        .sort({
          createdAt:
            -1,
        })
        .toArray();

    return NextResponse.json({
      success:
        true,
      data:
        templates.map(
          serializeSystemTemplate
        ),
    });
  } catch (
    error
  ) {
    console.error(
      "GET /api/system-templates error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,
        message:
          "Şablonlar getirilemedi.",
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

    const now =
      new Date();

    const result =
      await collection.insertOne(
        {
          name,
          laborItems:
            laborValidation.items,
          laborCostTry:
            laborValidation.total,
          items:
            itemValidation.items,
          createdAt:
            now,
          updatedAt:
            now,
        }
      );

    const created =
      await collection.findOne(
        {
          _id:
            result.insertedId,
        }
      );

    if (!created) {
      throw new Error(
        "Oluşturulan şablon tekrar okunamadı."
      );
    }

    return NextResponse.json(
      {
        success:
          true,
        data:
          serializeSystemTemplate(
            created
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
      "POST /api/system-templates error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,
        message:
          error instanceof Error
            ? error.message
            : "Şablon kaydedilemedi.",
      },
      {
        status:
          500,
      }
    );
  }
}
