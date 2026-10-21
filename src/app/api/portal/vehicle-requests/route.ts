import { NextRequest, after } from "next/server";
import { deliverAdminPush } from "@/lib/admin-notifications";
import { customerSession } from "@/lib/portal/auth";
import {
  vehicleRequestSchema,
  submitVehicleRequest,
} from "@/lib/portal/vehicle-requests";
import {
  json,
  failure,
  requireSameOrigin,
  rateLimit,
  PortalError,
} from "@/lib/portal/http";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    await rateLimit(request, "vehicle-request", 8, 3600);
    const input = vehicleRequestSchema.safeParse(await request.json());
    if (!input.success)
      throw new PortalError(
        "Marka, model ve geçerli bir yıl girin. Kasa bilgisi isteğe bağlıdır.",
      );
    const result = await submitVehicleRequest(
      input.data,
      await customerSession(request),
    );
    after(() =>
      deliverAdminPush().catch(() => {
        console.warn("Admin push processing deferred");
      }),
    );
    return json(result, 201);
  } catch (error) {
    return failure(error);
  }
}
