import {
  NextRequest,
  NextResponse,
} from "next/server";

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
]);

interface SessionCheckResponse {
  success?: boolean;
  authenticated?: boolean;
}

async function hasValidSession(
  request: NextRequest
): Promise<boolean> {
  const cookieHeader =
    request.headers.get("cookie");

  if (!cookieHeader) {
    return false;
  }

  try {
    const sessionUrl = new URL(
      "/api/auth/session",
      request.url
    );

    const response = await fetch(
      sessionUrl,
      {
        method: "GET",
        headers: {
          cookie: cookieHeader,
          accept: "application/json",
          "x-car-audio-auth-check": "1",
        },
        cache: "no-store",
        redirect: "manual",
      }
    );

    if (!response.ok) {
      return false;
    }

    const result =
      (await response
        .json()
        .catch(() => null)) as
        | SessionCheckResponse
        | null;

    return (
      result?.success === true &&
      result?.authenticated === true
    );
  } catch (error) {
    console.error(
      "Proxy session validation error:",
      error
    );

    return false;
  }
}

function unauthorizedApiResponse() {
  return NextResponse.json(
    {
      success: false,
      message:
        "Oturum bulunamadı veya süresi dolmuş.",
    },
    {
      status: 401,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, max-age=0",
      },
    }
  );
}

export async function proxy(
  request: NextRequest
) {
  const {
    pathname,
    search,
  } = request.nextUrl;

  /*
   * Auth endpoint'lerinin kendi kendini
   * tekrar Proxy üzerinden doğrulamasını
   * engeller.
   */
  if (PUBLIC_PATHS.has(pathname)) {
    if (pathname === "/login") {
      const authenticated =
        await hasValidSession(request);

      if (authenticated) {
        return NextResponse.redirect(
          new URL("/", request.url)
        );
      }
    }

    return NextResponse.next();
  }

  /*
   * ÖNEMLİ:
   * Token imzasını Proxy runtime'ında
   * ikinci kez hesaplamıyoruz.
   *
   * /api/auth/session Node route'u,
   * login route'u ile aynı auth-session
   * kodunu ve aynı APP_AUTH_SECRET'i
   * kullanarak doğrulama yapar.
   */
  const authenticated =
    await hasValidSession(request);

  if (authenticated) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return unauthorizedApiResponse();
  }

  const loginUrl = new URL(
    "/login",
    request.url
  );

  loginUrl.searchParams.set(
    "next",
    `${pathname}${search}`
  );

  return NextResponse.redirect(
    loginUrl
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
