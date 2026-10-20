import { ObjectId, MongoServerError } from "mongodb";
import { z } from "zod";
import type { PortalUser } from "@/types/portal";
import { portalStore } from "./store";
import { PortalError } from "./http";

export const vehicleRequestSchema = z.object({
  requestId: z.string().uuid(),
  brand: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1),
  generation: z.string().trim().max(100).optional().default(""),
});
export interface VehicleRequestDocument {
  requestId: string;
  brand: string;
  model: string;
  year: number;
  generation: string;
  accountId?: ObjectId;
  customer?: { name: string; phone: string };
  createdAt: Date;
}
export async function submitVehicleRequest(
  input: z.infer<typeof vehicleRequestSchema>,
  user: PortalUser | null,
) {
  const { vehicleRequests } = await portalStore();
  try {
    await vehicleRequests.insertOne({
      ...input,
      ...(user
        ? {
            accountId: new ObjectId(user.id),
            customer: {
              name: `${user.firstName} ${user.lastName}`,
              phone: user.phone,
            },
          }
        : {}),
      createdAt: new Date(),
    });
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.code !== 11000)
      throw error;
    const previous = await vehicleRequests.findOne({
      requestId: input.requestId,
    });
    if (
      !previous ||
      previous.brand !== input.brand ||
      previous.model !== input.model ||
      previous.year !== input.year ||
      previous.generation !== input.generation ||
      String(previous.accountId ?? "") !== (user?.id ?? "")
    )
      throw new PortalError(
        "Bu işlem anahtarı kullanılmış. Yeni talep için formu kapatıp yeniden açın.",
        409,
      );
  }
  return { received: true };
}
