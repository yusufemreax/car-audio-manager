import { NextRequest } from "next/server";
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
    return json(
      await submitVehicleRequest(input.data, await customerSession(request)),
      201,
    );
  } catch (error) {
    return failure(error);
  }
}
