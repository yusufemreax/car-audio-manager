import { NextRequest } from "next/server";
import { getPushConfig } from "@/lib/admin-notifications";
import { json, failure, rateLimit } from "@/lib/portal/http";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    await rateLimit(request, "customer-push-config", 60, 3600);
    const config = await getPushConfig(new URL(request.url).origin);
    return json({ publicKey: config.publicKey });
  } catch(error) { return failure(error); }
}
