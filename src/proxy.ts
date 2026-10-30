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

const ADMIN_LEGACY_PATHS = [
  "/customer-appointments",
  "/customers",
  "/multimedia-preparation",
  "/products",
  "/ready-multimedias",
  "/ready-systems",
  "/stock",
  "/suppliers",
  "/system-parameters",
  "/system-preparation",
  "/templates",
  "/vehicle-requests",
  "/bulk-stock-order",
  "/total-revenue",
];

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
  } = request.nextUrl;

  // The domain root is the customer catalog. Keep the visible URL at /.
  if (pathname === "/") {
    const customerUrl = request.nextUrl.clone();
    customerUrl.pathname = "/musteri";
    return NextResponse.rewrite(customerUrl);
  }

  // Customer routes expose only the dedicated retail APIs. Admin routes keep their existing session check.
  if (pathname === "/musteri" || pathname.startsWith("/musteri/") || pathname.startsWith("/api/portal/")) {
    return NextResponse.next();
  }

  // Keep old bookmarks working while moving every dashboard page under /admin.
  if (ADMIN_LEGACY_PATHS.some((base) => pathname === base || pathname.startsWith(`${base}/`))) {
    const adminUrl = request.nextUrl.clone();
    adminUrl.pathname = `/admin${pathname}`;
    return NextResponse.redirect(adminUrl);
  }

  const token = request.cookies.get(
    AUTH_COOKIE_NAME
  )?.value;

  const session = await verifySessionToken(
    token
  );

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(
        new URL("/admin", request.url)
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
    `${pathname}${request.nextUrl.search}`
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
