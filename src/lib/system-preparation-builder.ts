import {
  ObjectId,
  WithId,
} from "mongodb";

import {
  isProductCategory,
} from "@/lib/product-config";

import {
  getProductsByIdsWithFreshPrices,
} from "@/lib/products-service";

import {
  getSystemTemplatesCollection,
  SystemTemplateDocument,
} from "@/lib/system-templates-collection";

import {
  SystemPreparationItemDocument,
} from "@/lib/system-preparations-collection";

import {
  SystemLaborItem,
} from "@/types/system-labor";

import {
  SystemPreparationPayload,
} from "@/types/system-preparation";

export class SystemPreparationBuildError extends Error {
  status: number;

  constructor(
    message: string,
    status = 400
  ) {
    super(message);
    this.name =
      "SystemPreparationBuildError";
    this.status =
      status;
  }
}

export interface BuiltSystemPreparationData {
  name: string;
  templateId?: string;
  templateName?: string;
  exchangeRate: number;
  exchangeRateDate?: string;
  items: SystemPreparationItemDocument[];
  productTotalUsd: number;
  productTotalTry: number;
  commissionRate: number;
  commissionAmountUsd: number;
  commissionAmountTry: number;
  laborItems: SystemLaborItem[];
  laborCostTry: number;
  laborCostUsd: number;
  discountTry: number;
  profitTry: number;
  customerTotalTry: number;
}

function cleanString(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function safeNumber(
  value: unknown,
  fallback = 0
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : fallback;
}

/*
 * =========================================================
 * COMMISSION INCLUDED BOOLEAN
 * =========================================================
 *
 * false / "false" / 0 / "0" => false
 * true  / "true"  / 1 / "1" => true
 *
 * Alan hiç gelmezse eski clientlarla uyumluluk için true.
 */
function normalizeCommissionIncluded(
  value: unknown,
  fallback = true
): boolean {
  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  if (
    value === 0 ||
    value === "0"
  ) {
    return false;
  }

  if (
    value === 1 ||
    value === "1"
  ) {
    return true;
  }

  if (
    typeof value ===
    "string"
  ) {
    const normalized =
      value
        .trim()
        .toLowerCase();

    if (
      normalized ===
      "false"
    ) {
      return false;
    }

    if (
      normalized ===
      "true"
    ) {
      return true;
    }
  }

  return fallback;
}

function toObjectId(
  value: string
) {
  if (
    !ObjectId.isValid(
      value
    )
  ) {
    return null;
  }

  return new ObjectId(
    value
  );
}

function normalizeLaborItems(
  items: unknown
): SystemLaborItem[] {
  if (
    !Array.isArray(
      items
    )
  ) {
    return [];
  }

  return items.map(
    (
      rawItem,
      index
    ) => {
      const item =
        rawItem as Partial<SystemLaborItem>;

      const id =
        cleanString(
          item.id
        );

      const label =
        cleanString(
          item.label
        );

      const amountTry =
        safeNumber(
          item.amountTry,
          Number.NaN
        );

      if (
        !id ||
        !label
      ) {
        throw new SystemPreparationBuildError(
          "Tüm işçilik kalemlerine bir açıklama vermelisiniz."
        );
      }

      if (
        !Number.isFinite(
          amountTry
        ) ||
        amountTry <
          0
      ) {
        throw new SystemPreparationBuildError(
          `"${label}" için geçerli bir TL tutarı giriniz.`
        );
      }

      return {
        id,
        label,
        amountTry,
        sortOrder:
          index,
      };
    }
  );
}

function getTemplateLaborItems(
  template: {
    laborItems?: SystemLaborItem[];
    laborCostTry?: number;
    laborCostUsd?: number;
  }
): SystemLaborItem[] {
  if (
    Array.isArray(
      template.laborItems
    )
  ) {
    return template.laborItems.map(
      (
        item,
        index
      ) => ({
        id:
          item.id,
        label:
          item.label,
        amountTry:
          safeNumber(
            item.amountTry
          ),
        sortOrder:
          index,
      })
    );
  }

  const legacyTotal =
    Number.isFinite(
      template.laborCostTry
    )
      ? safeNumber(
          template.laborCostTry
        )
      : safeNumber(
          template.laborCostUsd
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

export async function buildSystemPreparationData(
  body:
    SystemPreparationPayload
): Promise<BuiltSystemPreparationData> {
  const name =
    cleanString(
      body.name
    );

  if (!name) {
    throw new SystemPreparationBuildError(
      "Sistem adı zorunludur."
    );
  }

  const exchangeRate =
    safeNumber(
      body.exchangeRate
    );

  if (
    exchangeRate <=
    0
  ) {
    throw new SystemPreparationBuildError(
      "Geçerli dolar kuru zorunludur."
    );
  }

  const exchangeRateDate =
    cleanString(
      body.exchangeRateDate
    );

  const commissionRate =
    safeNumber(
      body.commissionRate
    );

  if (
    commissionRate < 0 ||
    commissionRate > 100
  ) {
    throw new SystemPreparationBuildError(
      "Komisyon oranı 0 ile 100 arasında olmalıdır."
    );
  }

  const discountTry =
    safeNumber(
      body.discountTry
    );

  if (
    discountTry <
    0
  ) {
    throw new SystemPreparationBuildError(
      "İndirim tutarı negatif olamaz."
    );
  }

  const templatesCollection =
    await getSystemTemplatesCollection();

  const templateId =
    cleanString(
      body.templateId
    );

  let template:
    WithId<SystemTemplateDocument> |
    null = null;

  if (templateId) {
    const templateObjectId =
      toObjectId(
        templateId
      );

    if (!templateObjectId) {
      throw new SystemPreparationBuildError(
        "Geçersiz şablon ID."
      );
    }

    template =
      await templatesCollection.findOne(
        {
          _id:
            templateObjectId,
        }
      );

    if (!template) {
      throw new SystemPreparationBuildError(
        "Şablon bulunamadı.",
        404
      );
    }
  }

  const productIdStrings =
    new Set<string>();

  for (
    const selection of
      body.selections ??
      []
  ) {
    const productId =
      cleanString(
        selection.productId
      );

    if (productId) {
      productIdStrings.add(
        productId
      );
    }
  }

  for (
    const customItem of
      body.customItems ??
      []
  ) {
    const productId =
      cleanString(
        customItem.productId
      );

    if (productId) {
      productIdStrings.add(
        productId
      );
    }
  }

  const productObjectIds:
    ObjectId[] =
      [];

  for (
    const productId of
      productIdStrings
  ) {
    const objectId =
      toObjectId(
        productId
      );

    if (!objectId) {
      throw new SystemPreparationBuildError(
        `Geçersiz ürün ID: ${productId}`
      );
    }

    productObjectIds.push(
      objectId
    );
  }

  const products =
    productObjectIds.length >
    0
      ? await getProductsByIdsWithFreshPrices(
          productObjectIds
        )
      : [];

  const productMap =
    new Map(
      products.map(
        (product) => [
          product._id.toString(),
          product,
        ]
      )
    );

  const items:
    SystemPreparationItemDocument[] =
      [];

  if (template) {
    const selectionMap =
      new Map(
        (
          body.selections ??
          []
        ).map(
          (selection) => [
            selection.templateItemId,
            selection,
          ]
        )
      );

    for (
      const templateItem of
        template.items
    ) {
      const selection =
        selectionMap.get(
          templateItem.id
        );

      const productId =
        cleanString(
          selection?.productId
        );

      const product =
        productId
          ? productMap.get(
              productId
            )
          : undefined;

      if (
        productId &&
        !product
      ) {
        throw new SystemPreparationBuildError(
          `"${templateItem.label}" alanı için seçilen ürün bulunamadı.`
        );
      }

      const quantity =
        Math.max(
          1,
          safeNumber(
            templateItem.quantity,
            1
          )
        );

      if (product) {
        const unitPriceUsd =
          safeNumber(
            product.priceUsd
          );

        items.push({
          id:
            templateItem.id,
          source:
            "template",
          templateItemId:
            templateItem.id,
          label:
            templateItem.label,
          category:
            templateItem.category,
          ...(templateItem.subCategory
            ? {
                subCategory:
                  templateItem.subCategory,
              }
            : {}),
          quantity,
          isCommissionIncluded:
            normalizeCommissionIncluded(
              selection?.isCommissionIncluded
            ),
          productId:
            product._id,
          productCode:
            product.productCode,
          brand:
            product.brand,
          model:
            product.model,
          ...(product.imageUrl
            ? {
                imageUrl:
                  product.imageUrl,
              }
            : {}),
          specifications: {
            ...(product.specifications ?? {}),
          },
          unitPriceUsd,
          totalPriceUsd:
            unitPriceUsd *
            quantity,
        });
      } else {
        items.push({
          id:
            templateItem.id,
          source:
            "template",
          templateItemId:
            templateItem.id,
          label:
            templateItem.label,
          category:
            templateItem.category,
          ...(templateItem.subCategory
            ? {
                subCategory:
                  templateItem.subCategory,
              }
            : {}),
          quantity,
          isCommissionIncluded:
            normalizeCommissionIncluded(
              selection?.isCommissionIncluded
            ),
        });
      }
    }
  }

  for (
    const customItem of
      body.customItems ??
      []
  ) {
    const customItemId =
      cleanString(
        customItem.id
      );

    const customItemLabel =
      cleanString(
        customItem.label
      );

    if (!customItemId) {
      throw new SystemPreparationBuildError(
        "Ürün alanı ID bilgisi eksik."
      );
    }

    if (!customItemLabel) {
      throw new SystemPreparationBuildError(
        "Ürün alanı adı zorunludur."
      );
    }

    if (
      !isProductCategory(
        customItem.category
      )
    ) {
      throw new SystemPreparationBuildError(
        `"${customItemLabel}" için geçersiz ürün kategorisi.`
      );
    }

    const quantity =
      safeNumber(
        customItem.quantity,
        Number.NaN
      );

    if (
      !Number.isInteger(
        quantity
      ) ||
      quantity <= 0
    ) {
      throw new SystemPreparationBuildError(
        `"${customItemLabel}" için geçerli bir adet giriniz.`
      );
    }

    const productId =
      cleanString(
        customItem.productId
      );

    const product =
      productId
        ? productMap.get(
            productId
          )
        : undefined;

    if (
      productId &&
      !product
    ) {
      throw new SystemPreparationBuildError(
        `"${customItemLabel}" alanı için seçilen ürün bulunamadı.`
      );
    }

    if (product) {
      const unitPriceUsd =
        safeNumber(
          product.priceUsd
        );

      items.push({
        id:
          customItemId,
        source:
          "custom",
        label:
          customItemLabel,
        category:
          customItem.category,
        ...(customItem.subCategory
          ? {
              subCategory:
                customItem.subCategory,
            }
          : {}),
        quantity,
        isCommissionIncluded:
          normalizeCommissionIncluded(
            customItem.isCommissionIncluded
          ),
        productId:
          product._id,
        productCode:
          product.productCode,
        brand:
          product.brand,
        model:
          product.model,
        ...(product.imageUrl
          ? {
              imageUrl:
                product.imageUrl,
            }
          : {}),
        specifications: {
          ...(product.specifications ?? {}),
        },
        unitPriceUsd,
        totalPriceUsd:
          unitPriceUsd *
          quantity,
      });
    } else {
      items.push({
        id:
          customItemId,
        source:
          "custom",
        label:
          customItemLabel,
        category:
          customItem.category,
        ...(customItem.subCategory
          ? {
              subCategory:
                customItem.subCategory,
            }
          : {}),
        quantity,
        isCommissionIncluded:
          normalizeCommissionIncluded(
            customItem.isCommissionIncluded
          ),
      });
    }
  }

  let laborItems:
    SystemLaborItem[];

  if (
    Array.isArray(
      body.laborItems
    )
  ) {
    laborItems =
      normalizeLaborItems(
        body.laborItems
      );
  } else if (template) {
    laborItems =
      getTemplateLaborItems(
        template
      );
  } else {
    laborItems =
      [];
  }

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

  const productTotalUsd =
    items.reduce(
      (
        total,
        item
      ) =>
        total +
        (
          item.totalPriceUsd ??
          0
        ),
      0
    );

  const productTotalTry =
    productTotalUsd *
    exchangeRate;

  /*
   * Yalnızca komisyona dahil ürünler komisyon matrahına girer.
   * Alanı olmayan legacy payload true kabul edilir.
   */
  const commissionBaseUsd =
    items.reduce(
      (
        total,
        item
      ) => {
        if (
          item.isCommissionIncluded ===
          false
        ) {
          return total;
        }

        return (
          total +
          (
            item.totalPriceUsd ??
            0
          )
        );
      },
      0
    );

  const commissionAmountUsd =
    commissionBaseUsd *
    (
      commissionRate /
      100
    );

  const commissionAmountTry =
    commissionAmountUsd *
    exchangeRate;

  const profitTry =
    commissionAmountTry +
    laborCostTry -
    discountTry;

  const customerTotalTry =
    productTotalTry +
    profitTry;

  return {
    name,
    ...(template
      ? {
          templateId:
            template._id.toString(),
          templateName:
            template.name,
        }
      : {}),
    exchangeRate,
    ...(exchangeRateDate
      ? {
          exchangeRateDate,
        }
      : {}),
    items,
    productTotalUsd,
    productTotalTry,
    commissionRate,
    commissionAmountUsd,
    commissionAmountTry,
    laborItems,
    laborCostTry,
    laborCostUsd:
      0,
    discountTry,
    profitTry,
    customerTotalTry,
  };
}
