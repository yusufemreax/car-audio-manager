import { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { portalStore } from "@/lib/portal/store";
import { appointmentView, changeAppointment } from "@/lib/portal/appointments";
import {
  json,
  failure,
  requireSameOrigin,
  PortalError,
} from "@/lib/portal/http";
async function authorize(request: NextRequest) {
  if (!(await verifySessionToken(request.cookies.get(AUTH_COOKIE_NAME)?.value)))
    throw new PortalError("Admin girişi gerekli.", 401);
}
export async function GET(request: NextRequest) {
  try {
    await authorize(request);
    const { appointments } = await portalStore();
    return json(
      (
        await appointments.find({}).sort({ startsAt: -1 }).limit(500).toArray()
      ).map(appointmentView),
    );
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
      typeof body.id !== "string" ||
      !["confirmed", "cancelled"].includes(body.status)
    )
      throw new PortalError("İşlem geçersiz.");
    await changeAppointment(body.id, body.status);
    return json(null);
  } catch (error) {
    return failure(error);
  }
}
