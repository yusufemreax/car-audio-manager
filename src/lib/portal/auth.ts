import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { portalStore } from "./store";
import type { AccountDocument } from "./store";
import type { PortalUser } from "@/types/portal";
const derive = promisify(scrypt);
export const CUSTOMER_COOKIE = "car_audio_customer";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
export function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return digits;
}
export const contactSchema = z.object({
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().min(2).max(60),
  phone: z
    .string()
    .max(30)
    .transform(normalizePhone)
    .refine((value) => /^5\d{9}$/.test(value)),
});
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await derive(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${hash.toString("hex")}`;
}
export async function passwordMatches(password: string, stored: string) {
  const [prefix, salt, hex] = stored.split("$");
  if (
    prefix !== "scrypt" ||
    !/^[a-f0-9]{32}$/.test(salt ?? "") ||
    !/^[a-f0-9]{128}$/.test(hex ?? "")
  )
    return false;
  const hash = (await derive(password, salt, 64)) as Buffer;
  return timingSafeEqual(hash, Buffer.from(hex, "hex"));
}
const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function accountView(
  account: AccountDocument & { _id: import("mongodb").ObjectId },
): PortalUser {
  return {
    id: account._id.toString(),
    firstName: account.firstName,
    lastName: account.lastName,
    phone: account.phone,
    vehicles: (account.vehicles ?? []).map((vehicle) => ({
      id: vehicle.id,
      generationId: vehicle.vehicleGenerationId ?? "",
      label:
        `${vehicle.brand} ${vehicle.model} ${vehicle.vehicleGenerationName ?? ""}`.trim(),
      ...(vehicle.plate ? { plate: vehicle.plate } : {}),
    })),
  };
}
export async function customerSession(
  request: NextRequest,
): Promise<PortalUser | null> {
  const token = request.cookies.get(CUSTOMER_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const { sessions, accounts } = await portalStore();
  const session = await sessions.findOne({
    _id: tokenHash(token),
    expiresAt: { $gt: new Date() },
  });
  if (!session) return null;
  const account = await accounts.findOne({ _id: session.accountId });
  return account ? accountView(account) : null;
}
export async function setCustomerSession(
  response: NextResponse,
  accountId: import("mongodb").ObjectId,
) {
  const token = randomBytes(32).toString("hex");
  const { sessions } = await portalStore();
  await sessions.insertOne({
    _id: tokenHash(token),
    accountId,
    expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000),
  });
  response.cookies.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}
export async function endCustomerSession(
  request: NextRequest,
  response: NextResponse,
) {
  const token = request.cookies.get(CUSTOMER_COOKIE)?.value;
  if (token) {
    const { sessions } = await portalStore();
    await sessions.deleteOne({ _id: tokenHash(token) });
  }
  response.cookies.set(CUSTOMER_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
