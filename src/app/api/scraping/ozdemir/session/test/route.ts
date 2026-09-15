import { NextResponse } from "next/server";

import {
  fetchOzdemirProductPage,
  hasOzdemirPriceArea,
  OzdemirProductPageError,
} from "@/lib/scraping/ozdemir-product-page";
import {
  isOzdemirGuestProductHtml,
  isOzdemirLoggedInHtml,
  OzdemirSessionError,
} from "@/lib/scraping/ozdemir-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TestRequestBody {
  url?: string;
}

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as
        TestRequestBody;

    const sourceUrl =
      body.url?.trim();

    if (!sourceUrl) {
      return NextResponse.json(
        {
          success: false,
          message:
            "url alanı zorunludur.",
        },
        {
          status: 400,
        }
      );
    }

    const result =
      await fetchOzdemirProductPage(
        sourceUrl
      );

    return NextResponse.json({
      success: true,
      message:
        result.loginPerformed
          ? "Özdemir ürün sayfası önce girişsiz açıldı, bayi girişi yapıldı ve aynı link yeniden açılarak oturum doğrulandı."
          : "Özdemir ürün sayfası mevcut oturumla açıldı; yeniden login gerekmedi.",
      data: {
        source:
          result.source,
        requestedUrl:
          result.sourceUrl,
        finalUrl:
          result.finalUrl,
        responseStatus:
          result.responseStatus,
        loginPerformed:
          result.loginPerformed,
        loggedIn:
          result.loggedIn,
        guestPromptFoundAfterFinalRequest:
          isOzdemirGuestProductHtml(
            result.html
          ),
        logoutMarkerFound:
          isOzdemirLoggedInHtml(
            result.html
          ),
        priceAreaFound:
          hasOzdemirPriceArea(
            result.html
          ),
        htmlLength:
          result.html.length,
      },
    });
  } catch (error) {
    if (
      error instanceof
        OzdemirSessionError ||
      error instanceof
        OzdemirProductPageError
    ) {
      return NextResponse.json(
        {
          success: false,
          code: error.code,
          message:
            error.message,
          data:
            error.details ??
            null,
        },
        {
          status:
            error.statusCode,
        }
      );
    }

    console.error(
      "POST /api/scraping/ozdemir/session/test error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Özdemir session testi sırasında beklenmeyen hata oluştu.",
      },
      {
        status: 500,
      }
    );
  }
}
