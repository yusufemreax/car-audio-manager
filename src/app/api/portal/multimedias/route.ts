import { NextRequest } from "next/server";
import { publicMultimedias } from "@/lib/portal/catalog";
import { json, failure, rateLimit } from "@/lib/portal/http";
export async function GET(request: NextRequest) {
  try {
    await rateLimit(request, "catalog", 45, 60);
    return json(
      await publicMultimedias(
        request.nextUrl.searchParams.get("generationId") ?? "",
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
