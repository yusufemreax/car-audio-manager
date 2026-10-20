import { NextRequest } from "next/server";
import { z } from "zod";
import {
  availableAppointments,
  bookAppointment,
} from "@/lib/portal/appointments";
import { contactSchema, customerSession } from "@/lib/portal/auth";
import {
  json,
  failure,
  rateLimit,
  requireSameOrigin,
  PortalError,
} from "@/lib/portal/http";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    await rateLimit(request, "calendar", 90, 60);
    return json(await availableAppointments());
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    await rateLimit(request, "book", 8, 3600);
    const user = await customerSession(request);
    const body = await request.json();
    const schema = z.object({
      multimediaId: z.string().regex(/^[a-f0-9]{24}$/i),
      startsAt: z.string().datetime({ offset: true }),
      requestId: z.string().uuid(),
      contact: contactSchema,
      expectedPriceTry: z.number().finite().nonnegative(),
      vehicleId: z.string().min(1).max(100).optional(),
    });
    const input = schema.safeParse({ ...body, contact: user ?? body.contact });
    if (!input.success)
      throw new PortalError(
        "İletişim bilgilerini ve randevu saatini kontrol edin.",
      );
    await rateLimit(request, "book-phone", 5, 3600, input.data.contact.phone);
    return json(await bookAppointment(input.data, user), 201);
  } catch (error) {
    return failure(error);
  }
}
