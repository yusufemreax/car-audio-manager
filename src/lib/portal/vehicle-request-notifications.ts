import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import webpush from "web-push";
import { z } from "zod";
import { getDatabase } from "@/lib/mongodb";
import { getPushConfig, isPushEndpoint, pushSubscriptionSchema } from "@/lib/admin-notifications";
import { portalStore } from "./store";
import { PortalError } from "./http";

export type CustomerPushSubscription = z.infer<typeof pushSubscriptionSchema>;
interface CompletionPushJob {
  _id: string;
  subscription: CustomerPushSubscription;
  state: "pending" | "sent" | "failed";
  attempts: number;
  nextAttemptAt: Date;
  leaseUntil: Date;
  token?: string;
  completedAt?: Date;
}
let indexes: Promise<unknown> | undefined;
async function jobsStore() {
  const db = await getDatabase();
  const jobs = db.collection<CompletionPushJob>("portalVehicleRequestPushJobs");
  indexes ??= Promise.all([
    jobs.createIndex({ state: 1, nextAttemptAt: 1, leaseUntil: 1 }),
    jobs.createIndex({ completedAt: 1 }, { expireAfterSeconds: 604800 }),
  ]).catch(error => { indexes = undefined;throw error; });
  await indexes;
  return jobs;
}

export async function completeVehicleRequest(id: string) {
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new PortalError("Araç isteği geçersiz.");
  const { db, vehicleRequests } = await portalStore();
  const jobs = await jobsStore();
  const session = db.client.startSession();
  try {
    await session.withTransaction(async () => {
      const request = await vehicleRequests.findOne({ _id: new ObjectId(id) }, { session });
      if (!request) throw new PortalError("Araç isteği bulunamadı.", 404);
      if (request.status === "completed") return;
      await vehicleRequests.updateOne({ _id: request._id }, { $set: { status: "completed", completedAt: new Date() } }, { session });
      if (request.pushSubscription) {
        await jobs.updateOne({ _id: id }, { $setOnInsert: {
          subscription: request.pushSubscription,
          state: "pending", attempts: 0,
          nextAttemptAt: new Date(), leaseUntil: new Date(0),
        } }, { upsert: true, session });
      }
    });
  } finally { await session.endSession(); }
}

// Persistent, leased outbox: a push outage never undoes the completed request.
export async function deliverVehicleRequestPush(origin: string) {
  const jobs = await jobsStore();
  let config: Awaited<ReturnType<typeof getPushConfig>> | undefined;
  for (let index = 0; index < 5; index++) {
    const now = new Date(), token = randomUUID();
    const job = await jobs.findOneAndUpdate({ state: "pending", nextAttemptAt: { $lte: now }, leaseUntil: { $lte: now } }, {
      $set: { token, leaseUntil: new Date(Date.now() + 60000) }, $inc: { attempts: 1 },
    }, { returnDocument: "after" });
    if (!job) return;
    try {
      if (!isPushEndpoint(job.subscription.endpoint)) throw Object.assign(new Error("Invalid endpoint"), { statusCode: 410 });
      config ??= await getPushConfig(origin);
      await webpush.sendNotification(job.subscription, JSON.stringify({
        id: `vehicle-request:${job._id}`, title: "Araç isteğiniz tamamlandı",
        body: "İstediğiniz araç kataloğa eklendi. Aracınızı seçerek multimedya seçeneklerini inceleyebilirsiniz.",
        url: "/musteri#arac-sec",
      }), { vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey }, TTL: 86400, timeout: 5000 });
      await jobs.updateOne({ _id: job._id, token }, { $set: { state: "sent", completedAt: new Date() }, $unset: { subscription: "" } });
    } catch (error) {
      const code = (error as { statusCode?: number }).statusCode;
      const terminal = code === 404 || code === 410 || job.attempts >= 5;
      await jobs.updateOne({ _id: job._id, token }, { $set: {
        state: terminal ? "failed" : "pending", leaseUntil: new Date(0),
        nextAttemptAt: new Date(Date.now() + Math.min(3600, 30 * 2 ** job.attempts) * 1000),
        ...(terminal ? { completedAt: new Date() } : {}),
      }, ...(terminal ? { $unset: { subscription: "" } } : {}) });
      console.warn("Customer vehicle request push postponed", code ?? "network-error");
    }
  }
}
