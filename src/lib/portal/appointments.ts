import { ObjectId, MongoServerError, type WithId } from "mongodb";
import { randomBytes } from "node:crypto";
import type { PortalUser, PortalAppointment } from "@/types/portal";
import { portalStore, type AppointmentDocument } from "./store";
import { multimediaForBooking } from "./catalog";
import { createAppointmentOffer } from "./crm";
import { getPortalOrderRequirements } from "@/lib/customer-offer-stock-workflow";
import { queueAdminNotice } from "@/lib/admin-notifications";
import { PortalError } from "./http";
import {
  INSTALLATION_MINUTES,
  isEligibleStart,
  lockKeys,
  makeAvailability,
  shippingAvailability,
  addDays,
  BOOKING_DAYS,
} from "./schedule";

export function appointmentView(
  document: WithId<AppointmentDocument>,
): PortalAppointment {
  return {
    id: document._id.toString(),
    reference: document.reference,
    startsAt: document.startsAt.toISOString(),
    status: document.status,
    customer: document.customer,
    multimedia: document.multimedia,
  };
}
export async function availableAppointments(now = new Date()) {
  const { appointments } = await portalStore();
  const { earliestDate } = shippingAvailability(now);
  const min = new Date(`${earliestDate}T00:00:00+03:00`);
  const max = new Date(`${addDays(earliestDate, BOOKING_DAYS)}T23:59:59+03:00`);
  const occupied = await appointments
    .find(
      {
        status: { $in: ["pending", "confirmed"] },
        startsAt: {
          $gte: new Date(min.getTime() - INSTALLATION_MINUTES * 60000),
          $lte: max,
        },
      },
      { projection: { startsAt: 1 } },
    )
    .toArray();
  return makeAvailability(
    now,
    occupied.map((appointment) => appointment.startsAt),
  );
}
export async function bookAppointment(
  input: {
    multimediaId: string;
    startsAt: string;
    requestId: string;
    expectedPriceTry: number;
    vehicleId?: string;
    contact: { firstName: string; lastName: string; phone: string };
  },
  user: PortalUser | null,
  now = new Date(),
) {
  if (!user)
    throw new PortalError(
      "Randevu oluşturmak için giriş yapın veya üye olun.",
      401,
    );
  const start = new Date(input.startsAt);
  const { db, appointments, slots } = await portalStore();
  const customer = user
    ? { firstName: user.firstName, lastName: user.lastName, phone: user.phone }
    : input.contact;
  const previous = await appointments.findOne({ requestId: input.requestId });
  if (previous) {
    if (
      previous.customer.phone !== customer.phone ||
      previous.multimedia.id !== input.multimediaId ||
      previous.startsAt.getTime() !== start.getTime() ||
      (previous.selectedVehicleId ?? "") !== (input.vehicleId ?? "") ||
      String(previous.accountId ?? "") !== (user?.id ?? "")
    )
      throw new PortalError("İşlem anahtarı geçersiz.", 409);
    if (previous.status === "cancelled")
      throw new PortalError(
        "Bu randevu iptal edilmiş. Yeniden tarih seçin.",
        409,
      );
    return appointmentView(previous);
  }
  if (!isEligibleStart(start, now))
    throw new PortalError(
      "Bu tarih ve saat seçilemez. Takvimden uygun bir saat seçin.",
    );
  const { product: multimedia, snapshot } = await multimediaForBooking(
    input.multimediaId,
  );
  if (Math.abs(multimedia.priceTry - input.expectedPriceTry) > 0.01)
    throw new PortalError(
      "Paket fiyatı güncellendi. Yeni fiyatı kontrol edip randevuyu tekrar onaylayın.",
      409,
    );
  const appointment: WithId<AppointmentDocument> = {
    _id: new ObjectId(),
    reference: `AKS-${randomBytes(5).toString("hex").toUpperCase()}`,
    requestId: input.requestId,
    ...(input.vehicleId ? { selectedVehicleId: input.vehicleId } : {}),
    ...(user ? { accountId: new ObjectId(user.id) } : {}),
    customer,
    multimedia: {
      id: multimedia.id,
      title: multimedia.title,
      vehicle: multimedia.vehicle,
      priceTry: multimedia.priceTry,
    },
    startsAt: start,
    endsAt: new Date(start.getTime() + INSTALLATION_MINUTES * 60000),
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  const session = db.client.startSession();
  try {
    await session.withTransaction(async () => {
      // Seven unique half-hour cells make overlapping reservations mutually exclusive.
      await slots.insertMany(
        lockKeys(start).map((key) => ({
          _id: key,
          appointmentId: appointment._id,
        })),
        { session },
      );
      const link = await createAppointmentOffer(
        db,
        session,
        appointment,
        snapshot,
        input.vehicleId,
      );
      Object.assign(appointment, link);
      await appointments.insertOne(appointment, { session });
      await queueAdminNotice(db, session, {
        _id: `appointment:${appointment._id.toHexString()}`,
        title: "Yeni randevu talebi",
        body: `${customer.firstName} ${customer.lastName} · ${multimedia.vehicle}`,
        url: "/customer-appointments",
        createdAt: now,
      });
    });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      const retry = await appointments.findOne({
        requestId: input.requestId,
        "customer.phone": customer.phone,
      });
      if (
        retry &&
        retry.multimedia.id === input.multimediaId &&
        retry.startsAt.getTime() === start.getTime() &&
        (retry.selectedVehicleId ?? "") === (input.vehicleId ?? "") &&
        String(retry.accountId ?? "") === (user?.id ?? "") &&
        retry.status !== "cancelled"
      )
        return appointmentView(retry);
      throw new PortalError(
        "Bu saat az önce başka biri tarafından alındı. Takvimden yeni bir saat seçin.",
        409,
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }
  return appointmentView(appointment);
}
export async function changeAppointment(
  id: string,
  status: "confirmed" | "cancelled",
) {
  if (!ObjectId.isValid(id)) throw new PortalError("Randevu bulunamadı.", 404);
  const { db, appointments, slots } = await portalStore();
  // Bring pre-V2.24 appointments into the CRM once, without modifying their
  // agreed price. All new bookings already have the link in their transaction.
  if (status === "confirmed") {
    const old = await appointments.findOne({ _id: new ObjectId(id) });
    if (old?.status !== "cancelled" && old && !old.customerOfferId) {
      const { snapshot } = await multimediaForBooking(old.multimedia.id);
      const migration = db.client.startSession();
      try {
        await migration.withTransaction(async () => {
          const current = await appointments.findOne(
            { _id: old._id },
            { session: migration },
          );
          if (
            current &&
            current.status !== "cancelled" &&
            !current.customerOfferId
          ) {
            const link = await createAppointmentOffer(
              db,
              migration,
              current,
              snapshot,
            );
            await appointments.updateOne(
              { _id: old._id },
              { $set: link },
              { session: migration },
            );
          }
        });
      } finally {
        await migration.endSession();
      }
    }
  }
  const initial = await appointments.findOne({ _id: new ObjectId(id) });
  const initialOffer =
    status === "confirmed" &&
    initial?.customerOfferId &&
    initial.status !== "cancelled"
      ? await db
          .collection("customerSystemOffers")
          .findOne({ _id: initial.customerOfferId })
      : null;
  const requirements =
    initialOffer?.status === "offered"
      ? await getPortalOrderRequirements(initialOffer._id.toHexString())
      : undefined;
  const session = db.client.startSession();
  try {
    await session.withTransaction(async () => {
      const appointment = await appointments.findOne(
        { _id: new ObjectId(id) },
        { session },
      );
      if (!appointment) throw new PortalError("Randevu bulunamadı.", 404);
      if (appointment.status === "cancelled" && status !== "cancelled")
        throw new PortalError(
          "İptal edilmiş randevu yeniden onaylanamaz.",
          409,
        );
      if (appointment.status === status && status === "cancelled") return;
      if (status === "confirmed") {
        if (!appointment.customerOfferId)
          throw new PortalError("Randevunun teklifi bulunamadı.", 409);
        const offers = db.collection("customerSystemOffers");
        const offer = await offers.findOne(
          { _id: appointment.customerOfferId },
          { session },
        );
        if (!offer)
          throw new PortalError(
            "Teklif silinmiş. Müşteri kaydını kontrol edin.",
            409,
          );
        if (offer.status === "offered") {
          if (
            offer.stockProcessingToken ||
            offer.paymentProcessingToken ||
            !requirements
          )
            throw new PortalError(
              "Teklif işleniyor. Lütfen tekrar deneyin.",
              409,
            );
          await offers.updateOne(
            { _id: offer._id, status: "offered" },
            {
              $set: {
                status: "order_pending",
                orderPendingAt: new Date(),
                updatedAt: new Date(),
                stockRequirements: requirements,
              },
            },
            { session },
          );
        } else if (
          ![
            "order_pending",
            "installation_pending",
            "sold",
            "completed",
          ].includes(offer.status)
        ) {
          throw new PortalError(
            "Teklif durumu randevu onayına uygun değil.",
            409,
          );
        }
      }
      await appointments.updateOne(
        { _id: appointment._id },
        { $set: { status, updatedAt: new Date() } },
        { session },
      );
      if (status === "cancelled")
        await slots.deleteMany({ appointmentId: appointment._id }, { session });
    });
  } finally {
    await session.endSession();
  }
}
