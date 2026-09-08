import {
  Collection,
  ObjectId,
  WithId,
} from "mongodb";

import {
  ProductCategory,
} from "@/types/product";

import {
  SystemLaborItem,
} from "@/types/system-labor";

import {
  SystemPreparation,
  SystemPreparationItemSource,
  SystemPreparationStatus,
} from "@/types/system-preparation";

import {
  getDatabase,
} from "@/lib/mongodb";

export interface SystemPreparationItemDocument {
  id: string;
  source: SystemPreparationItemSource;
  templateItemId?: string;
  label: string;
  category: ProductCategory;
  subCategory?: string;
  quantity: number;

  /*
   * Legacy kayıtlarda undefined olabilir; serializer true kabul eder.
   */
  isCommissionIncluded: boolean;

  productId?: ObjectId;
  productCode?: string;
  brand?: string;
  model?: string;
  imageUrl?: string;
  specifications?: Record<
    string,
    string | number | boolean
  >;
  unitPriceUsd?: number;
  totalPriceUsd?: number;
}

export interface SystemPreparationDocument {
  name: string;

  templateId?: string;
  templateName?: string;

  status: SystemPreparationStatus;

  exchangeRate: number;
  exchangeRateDate?: string;

  items: SystemPreparationItemDocument[];

  productTotalUsd: number;
  productTotalTry: number;

  commissionRate: number;
  commissionAmountUsd: number;
  commissionAmountTry: number;

  laborItems?: SystemLaborItem[];
  laborCostTry: number;
  laborCostUsd?: number;

  discountTry: number;
  profitTry: number;
  customerTotalTry: number;

  createdAt: Date;
  updatedAt: Date;
  readyAt?: Date;
}

export async function getSystemPreparationsCollection():
  Promise<Collection<SystemPreparationDocument>> {
  const db =
    await getDatabase();

  return db.collection<SystemPreparationDocument>(
    "systemPreparations"
  );
}

function getLaborItems(
  preparation:
    WithId<SystemPreparationDocument>
): SystemLaborItem[] {
  if (
    Array.isArray(
      preparation.laborItems
    )
  ) {
    return preparation.laborItems.map(
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
    Number(
      preparation.laborCostTry ??
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

export function serializeSystemPreparation(
  preparation:
    WithId<SystemPreparationDocument>
): SystemPreparation {
  const laborItems =
    getLaborItems(
      preparation
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
      preparation._id.toString(),
    name:
      preparation.name,

    ...(preparation.templateId
      ? {
          templateId:
            preparation.templateId,
        }
      : {}),
    ...(preparation.templateName
      ? {
          templateName:
            preparation.templateName,
        }
      : {}),

    status:
      preparation.status,
    exchangeRate:
      preparation.exchangeRate,
    ...(preparation.exchangeRateDate
      ? {
          exchangeRateDate:
            preparation.exchangeRateDate,
        }
      : {}),

    items:
      preparation.items.map(
        (item) => ({
          id:
            item.id,
          source:
            item.source,
          ...(item.templateItemId
            ? {
                templateItemId:
                  item.templateItemId,
              }
            : {}),
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
          isCommissionIncluded:
            typeof item.isCommissionIncluded ===
            "boolean"
              ? item.isCommissionIncluded
              : true,
          ...(item.productId
            ? {
                productId:
                  item.productId.toString(),
              }
            : {}),
          ...(item.productCode
            ? {
                productCode:
                  item.productCode,
              }
            : {}),
          ...(item.brand
            ? {
                brand:
                  item.brand,
              }
            : {}),
          ...(item.model
            ? {
                model:
                  item.model,
              }
            : {}),
          ...(item.imageUrl
            ? {
                imageUrl:
                  item.imageUrl,
              }
            : {}),
          ...(item.specifications
            ? {
                specifications: {
                  ...item.specifications,
                },
              }
            : {}),
          ...(item.unitPriceUsd !==
          undefined
            ? {
                unitPriceUsd:
                  item.unitPriceUsd,
              }
            : {}),
          ...(item.totalPriceUsd !==
          undefined
            ? {
                totalPriceUsd:
                  item.totalPriceUsd,
              }
            : {}),
        })
      ),

    productTotalUsd:
      preparation.productTotalUsd,
    productTotalTry:
      preparation.productTotalTry,
    commissionRate:
      preparation.commissionRate,
    commissionAmountUsd:
      preparation.commissionAmountUsd,
    commissionAmountTry:
      preparation.commissionAmountTry,

    laborItems,
    laborCostTry,
    laborCostUsd:
      Number(
        preparation.laborCostUsd ??
          0
      ),

    discountTry:
      preparation.discountTry,
    profitTry:
      preparation.profitTry,
    customerTotalTry:
      preparation.customerTotalTry,

    createdAt:
      preparation.createdAt.toISOString(),
    updatedAt:
      preparation.updatedAt.toISOString(),
    ...(preparation.readyAt
      ? {
          readyAt:
            preparation.readyAt.toISOString(),
        }
      : {}),
  };
}
