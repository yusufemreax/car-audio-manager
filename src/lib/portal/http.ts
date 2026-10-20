import { createHash } from "node:crypto";
import { MongoServerError } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { portalStore } from "./store";
export class PortalError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(
    { success: true, data },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
export function failure(error: unknown) {
  if (error instanceof PortalError)
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  console.error("Customer portal request failed", error);
  return NextResponse.json(
    { success: false, message: "İşlem tamamlanamadı. Lütfen tekrar deneyin." },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}
export function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get("sec-fetch-site") === "cross-site" ||
    !request.headers.get("content-type")?.includes("application/json")
  ) {
    throw new PortalError("İstek doğrulanamadı.", 403);
  }
}
export async function rateLimit(
  request: NextRequest,
  purpose: string,
  max: number,
  seconds: number,
  identity?: string,
) {
  const now = Date.now();
  const who =
    identity ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const key = createHash("sha256")
    .update(`${purpose}:${who}:${Math.floor(now / (seconds * 1000))}`)
    .digest("hex");
  const { limits } = await portalStore();
  let counter;
  try {
    counter = await limits.findOneAndUpdate(
      { _id: key },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date(now + seconds * 1000) },
      },
      { upsert: true, returnDocument: "after" },
    );
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.code !== 11000)
      throw error;
    counter = await limits.findOneAndUpdate(
      { _id: key },
      { $inc: { count: 1 } },
      { returnDocument: "after" },
    );
  }
  if (!counter || counter.count > max)
    throw new PortalError(
      "Çok fazla deneme yapıldı. Biraz sonra tekrar deneyin.",
      429,
    );
}
