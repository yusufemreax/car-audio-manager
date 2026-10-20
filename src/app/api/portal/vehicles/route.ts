import { NextRequest } from "next/server";
import { publicVehicles } from "@/lib/portal/catalog";
import { json, failure, rateLimit } from "@/lib/portal/http";
export async function GET(request: NextRequest) {
  try {
    await rateLimit(request, "vehicles", 90, 60);
    return json(await publicVehicles());
  } catch (error) {
    return failure(error);
  }
}
