import {
  z,
} from "zod";

export const customerSchema =
  z.object({
    name: z
      .string()
      .trim()
      .min(
        1,
        "Müşteri adı zorunludur."
      )
      .max(200),

    phone: z
      .string()
      .trim()
      .max(50)
      .optional(),

    email: z
      .string()
      .trim()
      .email(
        "Geçerli bir e-posta adresi giriniz."
      )
      .optional()
      .or(
        z.literal("")
      ),

    notes: z
      .string()
      .trim()
      .max(1000)
      .optional(),
  });

export const customerVehicleSchema =
  z.object({
    brand: z
      .string()
      .trim()
      .min(
        1,
        "Araç markası zorunludur."
      ),

    model: z
      .string()
      .trim()
      .min(
        1,
        "Araç modeli zorunludur."
      ),

    year: z
      .number()
      .int()
      .min(1900)
      .max(2100)
      .optional(),

    plate: z
      .string()
      .trim()
      .max(30)
      .optional(),

    note: z
      .string()
      .trim()
      .max(500)
      .optional(),
  });