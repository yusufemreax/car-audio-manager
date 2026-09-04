import {
  NextResponse,
} from "next/server";

import {
  listCustomerOfferWorkflowOffers,
} from "@/lib/customer-offer-stock-workflow";

/*
 * =========================================================
 * GET
 * /api/customer-system-offers/workflow-list
 *
 * Teklifin hangi aşamada olduğuna bakmadan tüm kayıtları döndürür.
 * Böylece Teklifler sekmesi gerçek geçmişi kaybetmez.
 * =========================================================
 */
export async function GET() {
  try {
    const offers =
      await listCustomerOfferWorkflowOffers();

    return NextResponse.json({
      success:
        true,
      data:
        offers,
    });
  } catch (error) {
    console.error(
      "GET /api/customer-system-offers/workflow-list error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,
        message:
          error instanceof Error
            ? error.message
            : "Teklifler alınamadı.",
      },
      {
        status:
          500,
      }
    );
  }
}
