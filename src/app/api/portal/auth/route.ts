import { NextRequest } from "next/server";
import { MongoServerError, ObjectId } from "mongodb";
import {
  catalogVehicles,
  ensurePortalCustomer,
  registrationVehiclesSchema,
} from "@/lib/portal/crm";
import { accountView } from "@/lib/portal/auth";
import { z } from "zod";
import {
  contactSchema,
  normalizePhone,
  customerSession,
  passwordHash,
  passwordMatches,
  setCustomerSession,
  endCustomerSession,
} from "@/lib/portal/auth";
import { portalStore } from "@/lib/portal/store";
import {
  json,
  failure,
  requireSameOrigin,
  rateLimit,
  PortalError,
} from "@/lib/portal/http";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    return json(await customerSession(request));
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    await rateLimit(request, "auth", 15, 900);
    const body = await request.json();
    if (body.action === "logout") {
      const response = json(null);
      await endCustomerSession(request, response);
      return response;
    }
    const credentials = z
      .object({
        phone: z
          .string()
          .max(30)
          .transform(normalizePhone)
          .refine((value) => /^5\d{9}$/.test(value)),
        password: z.string().min(8).max(128),
      })
      .safeParse(body);
    if (!credentials.success)
      throw new PortalError(
        "Geçerli cep telefonu ve en az 8 karakterlik şifre girin.",
      );
    await rateLimit(request, "phone-auth", 10, 900, credentials.data.phone);
    const { db, accounts } = await portalStore();
    let account;
    if (body.action === "register") {
      const contact = contactSchema.safeParse(body);
      if (!contact.success)
        throw new PortalError(
          "Ad, soyad ve cep telefonu bilgilerinizi kontrol edin.",
        );
      const selected = registrationVehiclesSchema.safeParse(body.vehicles);
      if (!selected.success)
        throw new PortalError(
          "Eklediğiniz araçların marka, model ve kasasını kontrol edin. En fazla 10 araç ekleyebilirsiniz.",
        );
      const vehicles = await catalogVehicles(selected.data);
      const document = {
        _id: new ObjectId(),
        ...contact.data,
        passwordHash: await passwordHash(credentials.data.password),
        createdAt: new Date(),
      };
      const session = db.client.startSession();
      try {
        await session.withTransaction(async () => {
          await accounts.insertOne(document, { session });
          await ensurePortalCustomer(
            db,
            session,
            contact.data,
            vehicles,
            document._id,
          );
        });
        account = await accounts.findOne({ _id: document._id });
        if (!account) throw new Error("Hesap okunamadı.");
      } catch (error) {
        if (error instanceof MongoServerError && error.code === 11000)
          throw new PortalError(
            "Bu telefon numarasıyla hesap var. Giriş yapın.",
            409,
          );
        throw error;
      } finally {
        await session.endSession();
      }
    } else if (body.action === "login") {
      account = await accounts.findOne({ phone: credentials.data.phone });
      const dummy = `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;
      const matches = await passwordMatches(
        credentials.data.password,
        account?.passwordHash ?? dummy,
      );
      if (!account || !matches)
        throw new PortalError("Telefon numarası veya şifre hatalı.", 401);
      if (!account.customerId) {
        const session = db.client.startSession();
        try {
          await session.withTransaction(async () => {
            await ensurePortalCustomer(
              db,
              session,
              account!,
              account!.vehicles ?? [],
              account!._id,
            );
          });
          account = await accounts.findOne({ _id: account._id });
          if (!account) throw new Error("Hesap okunamadı.");
        } finally {
          await session.endSession();
        }
      }
    } else throw new PortalError("Geçersiz işlem.");
    const response = json(accountView(account));
    await setCustomerSession(response, account._id);
    return response;
  } catch (error) {
    return failure(error);
  }
}
