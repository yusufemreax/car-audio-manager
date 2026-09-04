import {
  ObjectId,
} from "mongodb";

import { z } from "zod";

import {
  productCategorySchema,
} from "@/lib/product-schema";

import {
  productCategoryDefinitions,
} from "@/lib/product-config";

const objectIdSchema =
  z.string().refine(
    (value) =>
      ObjectId.isValid(value),
    {
      message:
        "Geçersiz kayıt ID.",
    }
  );

const customItemSchema =
  z.object({
    id: z
      .string()
      .min(1),

    label: z
      .string()
      .trim()
      .min(
        1,
        "Ek ürün alanının adı zorunludur."
      )
      .max(150),

    category:
      productCategorySchema,

    subCategory: z
      .string()
      .trim()
      .min(1)
      .optional(),

    quantity: z
      .number()
      .int()
      .positive(
        "Adet sıfırdan büyük olmalıdır."
      ),

    productId:
      objectIdSchema.optional(),
  })
  .superRefine(
    (item, ctx) => {
      if (!item.subCategory) {
        return;
      }

      const definition =
        productCategoryDefinitions[
          item.category
        ];

      const field =
        definition.fields.find(
          (field) =>
            field.source ===
            "subCategory"
        );

      const valid =
        field?.options?.some(
          (option) =>
            option.value ===
            item.subCategory
        );

      if (!valid) {
        ctx.addIssue({
          code: "custom",

          path: [
            "subCategory",
          ],

          message:
            "Geçersiz alt kategori.",
        });
      }
    }
  );

export const systemPreparationSchema =
  z.object({
    name: z
      .string()
      .trim()
      .min(
        1,
        "Sistem adı zorunludur."
      )
      .max(200),

    templateId:
      objectIdSchema,

    exchangeRate: z
      .number()
      .finite()
      .positive(
        "Kur sıfırdan büyük olmalıdır."
      ),

    commissionRate: z
      .number()
      .finite()
      .min(
        0,
        "Komisyon oranı negatif olamaz."
      )
      .max(
        100,
        "Komisyon oranı 100'den büyük olamaz."
      ),

    discountTry: z
      .number()
      .finite()
      .nonnegative(
        "İndirim tutarı negatif olamaz."
      ),

    selections: z.array(
      z.object({
        templateItemId: z
          .string()
          .min(1),

        productId:
          objectIdSchema.optional(),
      })
    ),

    customItems:
      z.array(
        customItemSchema
      ),
  });