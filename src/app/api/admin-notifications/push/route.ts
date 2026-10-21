import { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import {
  getPushConfig,
  pushSubscriptionSchema,
  savePushDevice,
  removePushDevice,
  isPushEndpoint,
} from "@/lib/admin-notifications";
import {
  json,
  failure,
  PortalError,
  requireSameOrigin,
  rateLimit,
} from "@/lib/portal/http";
export const runtime = "nodejs";
async function authorize(request: NextRequest) {
  if (!(await verifySessionToken(request.cookies.get(AUTH_COOKIE_NAME)?.value)))
    throw new PortalError("Admin girişi gerekli.", 401);
}
export async function GET(request: NextRequest) {
  try {
    await authorize(request);
    const config = await getPushConfig(new URL(request.url).origin);
    return json({ publicKey: config.publicKey });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    await authorize(request);
    requireSameOrigin(request);
    await rateLimit(request, "admin-push-subscribe", 30, 3600);
    const parsed = pushSubscriptionSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new PortalError("Cihaz bildirim kaydı geçersiz.");
    await savePushDevice(parsed.data, new URL(request.url).origin);
    return json(null);
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: NextRequest) {
  try {
    await authorize(request);
    requireSameOrigin(request);
    const body = await request.json();
    if (
      typeof body.endpoint !== "string" ||
      body.endpoint.length > 4096 ||
      !isPushEndpoint(body.endpoint)
    )
      throw new PortalError("Cihaz kaydı geçersiz.");
    await removePushDevice(body.endpoint);
    return json(null);
  } catch (error) {
    return failure(error);
  }
}
