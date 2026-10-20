import { randomUUID } from "node:crypto";
import { ObjectId, type ClientSession, type Db } from "mongodb";
import { z } from "zod";
import type { CustomerDocument } from "@/lib/customers-collection";
import type { CustomerVehicle } from "@/types/customer";
import { publicVehicles } from "./catalog";
import { PortalError } from "./http";
import type { AccountDocument } from "./store";
import type { AppointmentDocument } from "./store";
import type { CustomerSystemOfferDocument } from "@/lib/customer-system-offers-collection";
import type { MultimediaPreparation } from "@/types/multimedia-preparation";

export const registrationVehiclesSchema = z
  .array(
    z.object({
      generationId: z.string().regex(/^[a-f0-9]{24}$/i),
      plate: z.string().trim().max(30).optional(),
    }),
  )
  .min(1)
  .max(10);

export async function catalogVehicles(
  input: z.infer<typeof registrationVehiclesSchema>,
) {
  const catalog = await publicVehicles();
  return input.map((selection): CustomerVehicle => {
    for (const brand of catalog)
      for (const model of brand.models) {
        const generation = model.generations.find(
          (item) => item.id === selection.generationId,
        );
        if (generation)
          return {
            id: randomUUID(),
            brand: brand.name,
            model: model.name,
            vehicleBrandId: brand.id,
            vehicleModelId: model.id,
            vehicleGenerationId: generation.id,
            vehicleGenerationName: generation.name,
            vehicleStartYear: generation.startYear,
            vehicleEndYear: generation.endYear,
            ...(selection.plate?.trim()
              ? { plate: selection.plate.trim().toLocaleUpperCase("tr-TR") }
              : {}),
          };
      }
    throw new PortalError(
      "Seçilen araç katalogda bulunamadı. Marka, model ve kasayı yeniden seçin.",
    );
  });
}

const plateKey = (plate?: string) =>
  (plate ?? "").replace(/\s/g, "").toLocaleUpperCase("tr-TR");
export function matchingVehicle(
  vehicles: CustomerVehicle[],
  requested: CustomerVehicle,
) {
  const compatible = vehicles.filter(
    (vehicle) => vehicle.vehicleGenerationId === requested.vehicleGenerationId,
  );
  if (!plateKey(requested.plate)) return compatible[0];
  return (
    compatible.find(
      (vehicle) => plateKey(vehicle.plate) === plateKey(requested.plate),
    ) ?? compatible.find((vehicle) => !plateKey(vehicle.plate))
  );
}

// All callers run in a transaction. The per-phone write serializes concurrent
// registrations/bookings, without imposing a new unique index on legacy CRM data.
export async function ensurePortalCustomer(
  db: Db,
  session: ClientSession,
  contact: { firstName: string; lastName: string; phone: string },
  requestedVehicles: CustomerVehicle[],
  accountId?: ObjectId,
) {
  await db
    .collection<{
      _id: string;
      updatedAt: Date;
      revision: number;
    }>("portalCustomerLinks")
    .updateOne(
      { _id: contact.phone },
      { $set: { updatedAt: new Date() }, $inc: { revision: 1 } },
      { upsert: true, session },
    );
  const customers = db.collection<CustomerDocument>("customers");
  const accounts = db.collection<AccountDocument>("portalAccounts");
  const account = accountId
    ? await accounts.findOne({ _id: accountId }, { session })
    : null;
  if (accountId && !account)
    throw new PortalError("Hesabınız bulunamadı. Yeniden giriş yapın.", 401);
  let customer = account?.customerId
    ? await customers.findOne({ _id: account.customerId }, { session })
    : null;
  if (!customer) {
    // Accept legacy +90 / 0 prefixes, spaces, parentheses and hyphens.
    const pattern = `^\\D*(?:(?:90|0)\\D*)?${contact.phone.split("").join("\\D*")}\\D*$`;
    const matches = await customers
      .find({ phone: { $regex: pattern } }, { session })
      .limit(2)
      .toArray();
    if (matches.length > 1)
      throw new PortalError(
        "Bu telefon için birden fazla müşteri kaydı bulunuyor. Kayıtların kontrolü için bizimle iletişime geçin.",
        409,
      );
    customer = matches[0] ?? null;
  }
  const now = new Date();
  if (!customer) {
    customer = {
      _id: new ObjectId(),
      name: `${contact.firstName} ${contact.lastName}`,
      phone: contact.phone,
      vehicles: [],
      createdAt: now,
      updatedAt: now,
    };
    await customers.insertOne(customer, { session });
  }
  const vehicles = [...(customer.vehicles ?? [])];
  const selected: CustomerVehicle[] = [];
  for (const requested of requestedVehicles) {
    let vehicle = matchingVehicle(vehicles, requested);
    if (!vehicle) {
      vehicle = requested;
      vehicles.push(vehicle);
    }
    if (!vehicle.plate && requested.plate) vehicle.plate = requested.plate;
    selected.push(vehicle);
  }
  await customers.updateOne(
    { _id: customer._id },
    { $set: { vehicles, updatedAt: now } },
    { session },
  );
  if (accountId) {
    // Keep only this account's submitted vehicle choices in the public profile;
    // phone matching never exposes legacy CRM notes, vehicles or offers.
    const owned = [...(account?.vehicles ?? [])];
    for (const vehicle of selected) {
      const existing = matchingVehicle(owned, vehicle);
      if (!existing) owned.push(vehicle);
      else if (!existing.plate && vehicle.plate) existing.plate = vehicle.plate;
    }
    await accounts.updateOne(
      { _id: accountId },
      { $set: { customerId: customer._id, vehicles: owned } },
      { session },
    );
  }
  return { customerId: customer._id, vehicles: selected };
}

export async function createAppointmentOffer(
  db: Db,
  session: ClientSession,
  appointment: AppointmentDocument & { _id: ObjectId },
  snapshot: MultimediaPreparation,
  selectedVehicleId?: string,
) {
  let plate: string | undefined;
  if (selectedVehicleId) {
    if (!appointment.accountId)
      throw new PortalError("Araç seçimi için giriş yapın.", 401);
    const account = await db
      .collection<AccountDocument>("portalAccounts")
      .findOne({ _id: appointment.accountId }, { session });
    const selected = account?.vehicles?.find(
      (item) =>
        item.id === selectedVehicleId &&
        item.vehicleGenerationId === snapshot.vehicleGenerationId,
    );
    if (!selected)
      throw new PortalError(
        "Seçilen araç hesabınıza veya bu pakete uygun değil.",
        400,
      );
    plate = selected.plate;
  }
  const [vehicle] = await catalogVehicles([
    { generationId: snapshot.vehicleGenerationId!, plate },
  ]);
  const link = await ensurePortalCustomer(
    db,
    session,
    appointment.customer,
    [vehicle],
    appointment.accountId,
  );
  const offerId = new ObjectId();
  const counter = await db
    .collection<{
      _id: string;
      sequence: number;
      createdAt: Date;
      updatedAt: Date;
    }>("systemCounters")
    .findOneAndUpdate(
      { _id: "customer-system-offer-global" },
      {
        $inc: { sequence: 1 },
        $set: { updatedAt: appointment.createdAt },
        $setOnInsert: { createdAt: appointment.createdAt },
      },
      { session, upsert: true, returnDocument: "after" },
    );
  if (!counter) throw new Error("Teklif numarası oluşturulamadı.");
  await db
    .collection<CustomerSystemOfferDocument>("customerSystemOffers")
    .insertOne(
      {
        _id: offerId,
        customerId: link.customerId,
        vehicleId: link.vehicles[0].id,
        offerType: "multimedia",
        readySystemId: new ObjectId(appointment.multimedia.id),
        systemSnapshot: snapshot,
        extraDiscountTry: 0,
        finalCustomerTotalTry: appointment.multimedia.priceTry,
        finalProfitTry:
          Math.round(
            (snapshot.profitTry +
              appointment.multimedia.priceTry -
              snapshot.customerTotalTry) *
              100,
          ) / 100,
        status: "offered",
        createdAt: appointment.createdAt,
        updatedAt: new Date(),
        offerNumber: `TKL-${appointment.createdAt.getFullYear()}-${String(counter.sequence).padStart(6, "0")}`,
        portalAppointmentId: appointment._id,
      } as CustomerSystemOfferDocument & {
        _id: ObjectId;
        offerNumber: string;
        portalAppointmentId: ObjectId;
      },
      { session },
    );
  return {
    customerId: link.customerId,
    vehicleId: link.vehicles[0].id,
    customerOfferId: offerId,
  };
}
