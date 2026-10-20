import { ObjectId } from "mongodb";
import { NextRequest } from "next/server";
import { customerSession } from "@/lib/portal/auth";
import { portalStore } from "@/lib/portal/store";
import { appointmentView } from "@/lib/portal/appointments";
import { json, failure, PortalError } from "@/lib/portal/http";
export async function GET(request: NextRequest) {
  try {
    const user = await customerSession(request);
    if (!user) throw new PortalError("Hesabınıza giriş yapın.", 401);
    const { appointments } = await portalStore();
    const records = await appointments
      .find({ accountId: new ObjectId(user.id) })
      .sort({ startsAt: -1 })
      .limit(100)
      .toArray();
    return json(records.map(appointmentView));
  } catch (error) {
    return failure(error);
  }
}
