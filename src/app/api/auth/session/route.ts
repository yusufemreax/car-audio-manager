import {
  NextResponse,
} from "next/server";
import {
  cookies,
} from "next/headers";

import {
  AUTH_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(
    AUTH_COOKIE_NAME
  )?.value;

  const session = await verifySessionToken(
    token
  );

  return NextResponse.json(
    {
      success: true,
      authenticated: Boolean(session),
    },
    {
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
