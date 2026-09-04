import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getNextProductCode,
} from "@/lib/product-code";

import {
  isProductCategory,
} from "@/lib/product-config";

export async function GET(
  request: NextRequest
) {
  try {
    const category =
      request.nextUrl.searchParams.get(
        "category"
      );

    if (
      !category ||
      !isProductCategory(
        category
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Geçersiz ürün kategorisi.",
        },
        {
          status: 400,
        }
      );
    }

    const productCode =
      await getNextProductCode(
        category
      );

    return NextResponse.json({
      success: true,

      data: {
        productCode,
      },
    });
  } catch (error) {
    console.error(
      "Product next code:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Ürün kodu oluşturulamadı.",
      },
      {
        status: 500,
      }
    );
  }
}