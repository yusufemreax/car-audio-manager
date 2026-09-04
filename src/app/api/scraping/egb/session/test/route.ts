import {
  NextResponse,
} from "next/server";

import {
  EgbSessionError,
  loginEgb,
} from "@/lib/scraping/egb-session";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function POST() {
  try {
    /*
     * Her test çağrısında mevcut cache'i kullanmadan
     * gerçek login akışını baştan çalıştırır.
     *
     * Cookie response'a veya log'a yazılmaz.
     */
    await loginEgb();

    return NextResponse.json({
      success: true,
      message:
        "EGB otomatik giriş başarılı.",
      data: {
        source:
          "EGB",
        loggedIn:
          true,
        sessionStorage:
          "server-memory",
      },
    });
  } catch (error) {
    if (
      error instanceof
      EgbSessionError
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            error.message,
          data: {
            source:
              "EGB",
            loggedIn:
              false,
            errorCode:
              error.code,
          },
        },
        {
          status:
            error.statusCode,
        }
      );
    }

    console.error(
      "POST /api/scraping/egb/session/test error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "EGB otomatik giriş testi sırasında hata oluştu.",
      },
      {
        status: 500,
      }
    );
  }
}
