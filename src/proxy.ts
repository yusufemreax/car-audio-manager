import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  AUTH_COOKIE_NAME,
  verifySessionToken,
} from "./lib/auth-session";

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
]);

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

  const token = request.cookies.get(
    AUTH_COOKIE_NAME
  )?.value;

  const session = await verifySessionToken(
    token
  );

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(
        new URL("/", request.url)
      );
    }

    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  if (session) {
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
