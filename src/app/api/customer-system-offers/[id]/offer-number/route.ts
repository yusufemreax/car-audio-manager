import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ensureCustomerOfferNumber,
} from "@/lib/customer-offer-number";

interface RouteContext {
  params:
    Promise<{
      id: string;
    }>;
}

/*
 * Eski tekliflerde numara bulunmayabilir.
 * PDF veya başka bir ekran gerektiğinde bu endpoint
 * numarayı bir kez üretir ve customerSystemOffers
 * kaydına kalıcı olarak yazar.
 */
export async function POST(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const {
      id,
    } = await context.params;

    const offerNumber =
      await ensureCustomerOfferNumber(
        id
      );

    return NextResponse.json({
      success: true,
      data: {
        offerNumber,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Teklif numarası oluşturulamadı.",
      },
      {
        status: 400,
      }
    );
  }
}
