import {
  ExchangeRateServiceError,
  getUsdTryExchangeRate,
} from "@/lib/exchange-rate-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result =
      await getUsdTryExchangeRate();

    /*
     * ÖNEMLİ:
     * product-form-dialog.tsx mevcut olarak
     * result.success ve result.data bekliyor.
     * Bu response contract'ı değiştirilmemelidir.
     */
    return Response.json({
      success: true,
      message:
        result.fromCache
          ? "Günün EGB dolar kuru veritabanından alındı."
          : "Günün EGB dolar kuru EGB'den alındı ve veritabanına kaydedildi.",
      data: {
        rate: result.rate,
        date: result.rateDate,
        base: result.baseCurrency,
        quote: result.quoteCurrency,
        source: result.source,
        fromCache:
          result.fromCache,
        fetchedAt:
          result.fetchedAt,
        ...(result.rawRate
          ? {
              rawRate:
                result.rawRate,
            }
          : {}),
      },
    });
  } catch (error) {
    console.error(
      "GET /api/exchange-rate error:",
      error
    );

    if (
      error instanceof
      ExchangeRateServiceError
    ) {
      return Response.json(
        {
          success: false,
          message:
            error.message,
          data: null,
        },
        {
          status:
            error.statusCode,
        }
      );
    }

    return Response.json(
      {
        success: false,
        message:
          "Dolar kuru alınamadı.",
        data: null,
      },
      {
        status: 500,
      }
    );
  }
}
