import {
  NextResponse,
} from "next/server";

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;

  rates: {
    TRY?: number;
  };
}

export async function GET() {
  try {
    const response =
      await fetch(
        "https://api.frankfurter.dev/v1/latest?base=USD&symbols=TRY",
        {
          next: {
            revalidate: 900,
          },
        }
      );

    if (!response.ok) {
      throw new Error(
        "Kur servisine ulaşılamadı."
      );
    }

    const data: FrankfurterResponse =
      await response.json();

    const rate =
      data.rates.TRY;

    if (
      typeof rate !== "number" ||
      !Number.isFinite(rate)
    ) {
      throw new Error(
        "USD/TRY kuru alınamadı."
      );
    }

    return NextResponse.json({
      success: true,

      data: {
        from: "USD",
        to: "TRY",

        rate,

        date: data.date,
      },
    });
  } catch (error) {
    console.error(
      "GET /api/exchange-rate error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Güncel dolar kuru alınamadı.",
      },
      {
        status: 500,
      }
    );
  }
}