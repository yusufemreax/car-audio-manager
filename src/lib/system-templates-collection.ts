import {
  Collection,
  WithId,
} from "mongodb";

import {
  ProductCategory,
} from "@/types/product";

import {
  SystemLaborItem,
} from "@/types/system-labor";

import {
  SystemTemplate,
} from "@/types/system-template";

import {
  getDatabase,
} from "@/lib/mongodb";

export interface SystemTemplateItemDocument {
  id: string;
  label: string;
  category: ProductCategory;
  subCategory?: string;
  quantity: number;
  sortOrder: number;
}

export interface SystemTemplateDocument {
  name: string;

  /*
   * Yeni kaynak alan.
   */
  laborItems?: SystemLaborItem[];

  /*
   * Türetilmiş toplam + eski kayıt uyumluluğu.
   */
  laborCostTry?: number;
  laborCostUsd?: number;

  items: SystemTemplateItemDocument[];
  createdAt: Date;
  updatedAt: Date;
}

export async function getSystemTemplatesCollection():
  Promise<Collection<SystemTemplateDocument>> {
  const db =
    await getDatabase();

  return db.collection<SystemTemplateDocument>(
    "systemTemplates"
  );
}

function getLaborItems(
  template:
    WithId<SystemTemplateDocument>
): SystemLaborItem[] {
  if (
    Array.isArray(
      template.laborItems
    )
  ) {
    return template.laborItems
      .map(
        (
          item,
          index
        ) => ({
          id:
            String(
              item.id ??
                `labor-${index + 1}`
            ),
          label:
            String(
              item.label ??
                "İşçilik"
            ),
          amountTry:
            Number(
              item.amountTry
            ) || 0,
          sortOrder:
            index,
        })
      );
  }

  const legacyTotal =
    Number.isFinite(
      template.laborCostTry
    )
      ? Number(
          template.laborCostTry
        )
      : Number(
          template.laborCostUsd ??
            0
        );

  if (
    legacyTotal <= 0
  ) {
    return [];
  }

  return [
    {
      id:
        "legacy-labor",
      label:
        "İşçilik",
      amountTry:
        legacyTotal,
      sortOrder:
        0,
    },
  ];
}

export function serializeSystemTemplate(
  template:
    WithId<SystemTemplateDocument>
): SystemTemplate {
  const laborItems =
    getLaborItems(
      template
    );

  const laborCostTry =
    laborItems.reduce(
      (
        total,
        item
      ) =>
        total +
        item.amountTry,
      0
    );

  return {
    id:
      template._id.toString(),
    name:
      template.name,
    laborItems,
    laborCostTry,
    items:
      template.items.map(
        (item) => ({
          id:
            item.id,
          label:
            item.label,
          category:
            item.category,
          ...(item.subCategory
            ? {
                subCategory:
                  item.subCategory,
              }
            : {}),
          quantity:
            item.quantity,
          sortOrder:
            item.sortOrder,
        })
      ),
    createdAt:
      template.createdAt.toISOString(),
    updatedAt:
      template.updatedAt.toISOString(),
  };
}
