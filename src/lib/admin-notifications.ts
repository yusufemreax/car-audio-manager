import { createHash, randomUUID } from "node:crypto";
import { type ClientSession, type Db } from "mongodb";
import webpush from "web-push";
import { z } from "zod";
import { getDatabase } from "@/lib/mongodb";

export interface AdminNotice {
  _id: string;
  title: string;
  body: string;
  url: "/customer-appointments" | "/vehicle-requests";
  createdAt: Date;
  readAt?: Date;
}
interface PushConfig {
  _id: string;
  publicKey: string;
  privateKey: string;
  subject: string;
}
interface PushDevice {
  _id: string;
  ownerKey: string;
  keyId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  updatedAt: Date;
}
interface PushJob {
  _id: string;
  noticeId: string;
  deviceId: string;
  state: "pending" | "sent" | "failed";
  attempts: number;
  nextAttemptAt: Date;
  leaseUntil: Date;
  token?: string;
  createdAt: Date;
  completedAt?: Date;
}
export const adminOwnerKey = () =>
  createHash("sha256")
    .update(process.env.APP_SESSION_TOKEN ?? "")
    .digest("hex");
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function notificationStore(db: Db) {
  return {
    notices: db.collection<AdminNotice>("adminNotifications"),
    devices: db.collection<PushDevice>("adminPushSubscriptions"),
    jobs: db.collection<PushJob>("adminPushJobs"),
    config: db.collection<PushConfig>("adminPushConfig"),
  };
}
let indexes: Promise<unknown> | undefined;
export async function adminNotificationStore() {
  const db = await getDatabase();
  const store = notificationStore(db);
  if (!indexes)
    indexes = Promise.all([
      store.notices.createIndex({ createdAt: -1 }),
      store.notices.createIndex({ readAt: 1 }),
      store.jobs.createIndex({ state: 1, nextAttemptAt: 1, leaseUntil: 1 }),
      store.jobs.createIndex(
        { completedAt: 1 },
        { expireAfterSeconds: 604800 },
      ),
      store.devices.createIndex({ ownerKey: 1 }),
    ]).catch((error) => {
      indexes = undefined;
      throw error;
    });
  await indexes;
  return { db, ...store };
}
export async function queueAdminNotice(
  db: Db,
  session: ClientSession,
  notice: AdminNotice,
) {
  const { notices, devices, jobs } = notificationStore(db);
  const result = await notices.updateOne(
    { _id: notice._id },
    { $setOnInsert: notice },
    { session, upsert: true },
  );
  if (!result.upsertedCount) return;
  const registered = await devices
    .find({ ownerKey: adminOwnerKey() }, { session })
    .toArray();
  if (registered.length)
    await jobs.insertMany(
      registered.map((device) => ({
        _id: `${notice._id}:${device._id}`,
        noticeId: notice._id,
        deviceId: device._id,
        state: "pending" as const,
        attempts: 0,
        nextAttemptAt: new Date(),
        leaseUntil: new Date(0),
        createdAt: new Date(),
      })),
      { session },
    );
}
export async function getPushConfig(origin: string) {
  const { config } = await adminNotificationStore();
  const existing = await config.findOne({ _id: "web-push-v1" });
  if (existing) return existing;
  const keys = webpush.generateVAPIDKeys();
  const subject = process.env.WEB_PUSH_SUBJECT?.trim() || origin;
  const subjectUrl = new URL(subject);
  if (
    !["https:", "mailto:"].includes(subjectUrl.protocol) &&
    !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(subject)
  )
    throw new Error("Web push iletişim adresi geçersiz.");
  try {
    const created = await config.findOneAndUpdate(
      { _id: "web-push-v1" },
      { $setOnInsert: { ...keys, subject } },
      { upsert: true, returnDocument: "after" },
    );
    if (created) return created;
  } catch (error) {
    const concurrent = await config.findOne({ _id: "web-push-v1" });
    if (concurrent) return concurrent;
    throw error;
  }
  throw new Error("Web push anahtarları kaydedilemedi.");
}
export function isPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      ([
        "fcm.googleapis.com",
        "updates.push.services.mozilla.com",
        "web.push.apple.com",
      ].includes(url.hostname) ||
        url.hostname.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().max(4096).refine(isPushEndpoint),
  keys: z.object({
    p256dh: z
      .string()
      .regex(/^[A-Za-z0-9_-]+={0,2}$/)
      .refine((s) => Buffer.from(s, "base64url").length === 65),
    auth: z
      .string()
      .regex(/^[A-Za-z0-9_-]+={0,2}$/)
      .refine((s) => Buffer.from(s, "base64url").length === 16),
  }),
});
export async function savePushDevice(
  input: z.infer<typeof pushSubscriptionSchema>,
  origin: string,
) {
  const { devices } = await adminNotificationStore();
  const config = await getPushConfig(origin);
  await devices.updateOne(
    { _id: digest(input.endpoint) },
    {
      $set: {
        ...input,
        ownerKey: adminOwnerKey(),
        keyId: digest(config.publicKey),
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}
export async function removePushDevice(endpoint: string) {
  const { devices, jobs } = await adminNotificationStore();
  const id = digest(endpoint);
  const result = await devices.deleteOne({
    _id: id,
    ownerKey: adminOwnerKey(),
  });
  if (result.deletedCount)
    await jobs.deleteMany({ deviceId: id, state: "pending" });
}
// Persistent outbox: a failed push never rolls back a customer's successful request.
// Jobs are leased across processes. Later request/admin refresh retries delivery.
export async function deliverAdminPush() {
  const { notices, devices, jobs, config } = await adminNotificationStore();
  const vapid = await config.findOne({ _id: "web-push-v1" });
  if (!vapid) return;
  const deadline = Date.now() + 20000;
  for (let index = 0; index < 10 && Date.now() < deadline; index++) {
    const now = new Date(),
      token = randomUUID();
    const job = await jobs.findOneAndUpdate(
      {
        state: "pending",
        nextAttemptAt: { $lte: now },
        leaseUntil: { $lte: now },
      },
      {
        $set: { leaseUntil: new Date(now.getTime() + 60000), token },
        $inc: { attempts: 1 },
      },
      { returnDocument: "after", sort: { createdAt: 1 } },
    );
    if (!job) return;
    const [notice, device] = await Promise.all([
      notices.findOne({ _id: job.noticeId }),
      devices.findOne({
        _id: job.deviceId,
        ownerKey: adminOwnerKey(),
        keyId: digest(vapid.publicKey),
      }),
    ]);
    if (!notice || !device || !isPushEndpoint(device.endpoint)) {
      await jobs.updateOne(
        { _id: job._id, token },
        { $set: { state: "failed", completedAt: new Date() } },
      );
      continue;
    }
    try {
      // Keep lock-screen notifications free of names, phone numbers and prices.
      await webpush.sendNotification(
        { endpoint: device.endpoint, keys: device.keys },
        JSON.stringify({
          id: notice._id,
          title: notice.title,
          body:
            notice.url === "/customer-appointments"
              ? "Yeni bir montaj randevusu talebi var. Detayları admin panelinde inceleyin."
              : "Yeni bir araç isteği var. Detayları admin panelinde inceleyin.",
          url: notice.url,
        }),
        {
          vapidDetails: {
            subject: vapid.subject,
            publicKey: vapid.publicKey,
            privateKey: vapid.privateKey,
          },
          TTL: 86400,
          timeout: 8000,
          urgency: "high",
        },
      );
      await jobs.updateOne(
        { _id: job._id, token },
        { $set: { state: "sent", completedAt: new Date() } },
      );
    } catch (error) {
      const code = (error as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410)
        await devices.deleteOne({ _id: device._id });
      await jobs.updateOne(
        { _id: job._id, token },
        {
          $set: {
            state:
              code === 404 || code === 410 || job.attempts >= 5
                ? "failed"
                : "pending",
            nextAttemptAt: new Date(
              Date.now() + Math.min(3600, 30 * 2 ** job.attempts) * 1000,
            ),
            leaseUntil: new Date(0),
            ...(code === 404 || code === 410 || job.attempts >= 5
              ? { completedAt: new Date() }
              : {}),
          },
        },
      );
      // Do not log subscription endpoints or private VAPID keys.
      console.warn("Admin push delivery postponed", code ?? "network-error");
    }
  }
}
