import { z } from "zod";

import {
  productCategorySchema,
} from "@/lib/product-schema";

import {
  productCategoryDefinitions,
} from "@/lib/product-config";

const templateItemSchema =
  z.object({
    id: z
      .string()
      .min(1),

    label: z
      .string()
      .trim()
      .min(
        1,
        "Slot adı zorunludur."
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

    sortOrder: z
      .number()
      .int()
      .nonnegative(),
  })
  .superRefine(
    (item, ctx) => {
      if (!item.subCategory) {
        return;
      }

      const categoryDefinition =
        productCategoryDefinitions[
          item.category
        ];

      const subCategoryField =
        categoryDefinition.fields.find(
          (field) =>
            field.source ===
            "subCategory"
        );

      /*
       * Kategorinin alt tipi yoksa
       * subCategory gönderilmemeli.
       */
      if (!subCategoryField) {
        ctx.addIssue({
          code: "custom",

          path: [
            "subCategory",
          ],

          message:
            "Bu kategori alt kategori desteklemiyor.",
        });

        return;
      }

      const valid =
        subCategoryField.options?.some(
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
            "Geçersiz alt kategori seçildi.",
        });
      }
    }
  );

export const systemTemplateSchema =
  z.object({
    name: z
      .string()
      .trim()
      .min(
        1,
        "Şablon adı zorunludur."
      )
      .max(200),

    laborCostUsd: z
      .number()
      .finite()
      .nonnegative(
        "İşçilik maliyeti negatif olamaz."
      ),

    items: z
      .array(
        templateItemSchema
      )
      .min(
        1,
        "Şablona en az bir ürün alanı eklenmelidir."
      ),
  });