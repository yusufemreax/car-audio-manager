import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { portalStore } from "@/lib/portal/store";
import { json, failure, PortalError } from "@/lib/portal/http";
export async function GET(request: NextRequest) {
  try {
    if (
      !(await verifySessionToken(request.cookies.get(AUTH_COOKIE_NAME)?.value))
    )
      throw new PortalError("Admin girişi gerekli.", 401);
    const cursor = request.nextUrl.searchParams.get("cursor");
    if (cursor && !/^[a-f0-9]{24}$/i.test(cursor))
      throw new PortalError("Sayfa bilgisi geçersiz.");
    const { vehicleRequests } = await portalStore();
    const records = await vehicleRequests
      .find(cursor ? { _id: { $lt: new ObjectId(cursor) } } : {})
      .sort({ _id: -1 })
      .limit(101)
      .toArray();
    const page = records.slice(0, 100);
    return json({
      records: page.map((record) => ({
        id: record._id.toHexString(),
        brand: record.brand,
        model: record.model,
        year: record.year,
        generation: record.generation,
        customer: record.customer,
        createdAt: record.createdAt.toISOString(),
      })),
      nextCursor: records.length > 100 ? page.at(-1)!._id.toHexString() : null,
    });
  } catch (error) {
    return failure(error);
  }
}
