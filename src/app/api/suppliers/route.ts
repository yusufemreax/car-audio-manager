import {
  NextResponse,
} from "next/server";

import {
  getSupplierSummaries,
} from "@/lib/supplier-store";

export async function GET() {
  try {
    const suppliers =
      await getSupplierSummaries();

    return NextResponse.json({
      success: true,
      data: suppliers,
    });
  } catch (error) {
    console.error(
      "GET /api/suppliers error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Tedarikçiler getirilemedi.",
      },
      {
        status: 500,
      }
    );
  }
}
