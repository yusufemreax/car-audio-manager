import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  addSupplierBalance,
  getSupplierSummaries,
} from "@/lib/supplier-store";

import {
  isProductSupplier,
} from "@/types/supplier";

interface RouteContext {
  params:
    Promise<{
      code: string;
    }>;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const {
      code,
    } = await context.params;

    const decodedCode =
      decodeURIComponent(
        code
      );

    if (
      !isProductSupplier(
        decodedCode
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Geçersiz tedarikçi.",
        },
        {
          status: 400,
        }
      );
    }

    const body =
      await request.json();

    const amountUsd =
      Number(
        body?.amountUsd
      );

    if (
      !Number.isFinite(
        amountUsd
      ) ||
      amountUsd <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Bakiye tutarı 0'dan büyük olmalıdır.",
        },
        {
          status: 400,
        }
      );
    }

    await addSupplierBalance(
      decodedCode,
      amountUsd,
      {
        note:
          typeof body?.note ===
            "string"
            ? body.note
            : undefined,
      }
    );

    const summaries =
      await getSupplierSummaries();

    const supplier =
      summaries.find(
        (item) =>
          item.supplier ===
          decodedCode
      );

    return NextResponse.json({
      success: true,
      data: supplier,
      message:
        "Tedarikçi bakiyesi eklendi.",
    });
  } catch (error) {
    console.error(
      "POST /api/suppliers/[code]/balance error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Bakiye eklenemedi.",
      },
      {
        status: 500,
      }
    );
  }
}
