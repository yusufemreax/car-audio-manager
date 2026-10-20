import type { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import type { CustomerVehicle } from "@/types/customer";
import type { VehicleRequestDocument } from "./vehicle-requests";
export interface AccountDocument {
  customerId?: ObjectId;
  vehicles?: CustomerVehicle[];
  firstName: string;
  lastName: string;
  phone: string;
  passwordHash: string;
  createdAt: Date;
}
export interface AppointmentDocument {
  customerId?: ObjectId;
  vehicleId?: string;
  customerOfferId?: ObjectId;
  selectedVehicleId?: string;
  reference: string;
  requestId: string;
  accountId?: ObjectId;
  customer: { firstName: string; lastName: string; phone: string };
  multimedia: { id: string; title: string; vehicle: string; priceTry: number };
  startsAt: Date;
  endsAt: Date;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}
let indexes: Promise<unknown> | undefined;
export async function portalStore() {
  const db = await getDatabase();
  const store = {
    db,
    accounts: db.collection<AccountDocument>("portalAccounts"),
    vehicleRequests: db.collection<VehicleRequestDocument>(
      "portalVehicleRequests",
    ),
    sessions: db.collection<{
      _id: string;
      accountId: ObjectId;
      expiresAt: Date;
    }>("portalSessions"),
    appointments: db.collection<AppointmentDocument>("portalAppointments"),
    slots: db.collection<{ _id: string; appointmentId: ObjectId }>(
      "portalAppointmentSlots",
    ),
    limits: db.collection<{ _id: string; count: number; expiresAt: Date }>(
      "portalRateLimits",
    ),
  };
  if (!indexes)
    indexes = Promise.all([
      store.accounts.createIndex({ phone: 1 }, { unique: true }),
      store.vehicleRequests.createIndex({ requestId: 1 }, { unique: true }),
      store.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      store.appointments.createIndex({ requestId: 1 }, { unique: true }),
      store.appointments.createIndex({ startsAt: 1, status: 1 }),
      store.appointments.createIndex({ accountId: 1, createdAt: -1 }),
      store.limits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]).catch((error) => {
      indexes = undefined;
      throw error;
    });
  await indexes;
  return store;
}
