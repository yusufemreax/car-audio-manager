import { NextRequest, after } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import {
  adminNotificationStore,
  deliverAdminPush,
} from "@/lib/admin-notifications";
import {
  json,
  failure,
  PortalError,
  requireSameOrigin,
} from "@/lib/portal/http";
export const runtime = "nodejs";
async function authorize(request: NextRequest) {
  if (!(await verifySessionToken(request.cookies.get(AUTH_COOKIE_NAME)?.value)))
    throw new PortalError("Admin girişi gerekli.", 401);
}
export async function GET(request: NextRequest) {
  try {
    await authorize(request);
    const { notices } = await adminNotificationStore();
    const [records, unread] = await Promise.all([
      notices.find({}).sort({ createdAt: -1 }).limit(50).toArray(),
      notices.countDocuments({ readAt: { $exists: false } }),
    ]);
    after(() =>
      deliverAdminPush().catch(() => {
        console.warn("Admin push processing deferred");
      }),
    );
    return json({
      records: records.map((notice) => ({
        id: notice._id,
        title: notice.title,
        body: notice.body,
        url: notice.url,
        createdAt: notice.createdAt.toISOString(),
        read: Boolean(notice.readAt),
      })),
      unread,
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    await authorize(request);
    requireSameOrigin(request);
    const body = await request.json();
    if (
      body.all !== true &&
      (typeof body.id !== "string" ||
        !/^(appointment|vehicle-request):[a-f0-9]{24}$/.test(body.id))
    )
      throw new PortalError("Bildirim seçimi geçersiz.");
    const { notices } = await adminNotificationStore();
    await notices.updateMany(
      body.all === true ? { readAt: { $exists: false } } : { _id: body.id },
      { $set: { readAt: new Date() } },
    );
    return json(null);
  } catch (error) {
    return failure(error);
  }
}
