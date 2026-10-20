import { NextRequest } from "next/server";
import { publicMultimedia } from "@/lib/portal/catalog";
import { json, failure, rateLimit } from "@/lib/portal/http";
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await rateLimit(request, "detail", 45, 60);
    const { id } = await context.params;
    return json(await publicMultimedia(id));
  } catch (error) {
    return failure(error);
  }
}
