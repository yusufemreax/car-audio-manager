import {
  ProductCategory,
} from "@/types/product";

import {
  SystemLaborItem,
} from "@/types/system-labor";

export type SystemPreparationStatus =
  | "draft"
  | "ready";

export type SystemPreparationItemSource =
  | "template"
  | "custom";

export interface SystemPreparationItem {
  id: string;
  source: SystemPreparationItemSource;
  templateItemId?: string;
  label: string;
  category: ProductCategory;
  subCategory?: string;
  quantity: number;

  /*
   * Ürün komisyon hesabına dahil mi?
   */
  isCommissionIncluded: boolean;

  productId?: string;
  productCode?: string;
  brand?: string;
  model?: string;
  imageUrl?: string;

  /*
   * Teklif/PDF gibi snapshot kullanan akışlarda ürün özellikleri
   * sonradan değişse bile teklif anındaki değerler korunur.
   */
  specifications?: Record<
    string,
    string | number | boolean
  >;

  unitPriceUsd?: number;
  totalPriceUsd?: number;
}

export interface SystemPreparation {
  id: string;
  name: string;

  /*
   * Şablon artık opsiyoneldir.
   */
  templateId?: string;
  templateName?: string;

  status: SystemPreparationStatus;

  exchangeRate: number;
  exchangeRateDate?: string;

  items: SystemPreparationItem[];

  productTotalUsd: number;
  productTotalTry: number;

  commissionRate: number;
  commissionAmountUsd: number;
  commissionAmountTry: number;

  laborItems: SystemLaborItem[];
  laborCostTry: number;

  /*
   * Eski ekranlarla geriye dönük uyumluluk.
   * Yeni kayıtlarda kullanılmaz.
   */
  laborCostUsd: number;

  discountTry: number;
  profitTry: number;
  customerTotalTry: number;

  createdAt: string;
  updatedAt: string;
  readyAt?: string;
}

export interface SystemPreparationSelectionPayload {
  templateItemId: string;
  productId?: string;
  isCommissionIncluded: boolean;
}

export interface SystemPreparationCustomItemPayload {
  id: string;
  label: string;
  category: ProductCategory;
  subCategory?: string;
  quantity: number;
  productId?: string;
  isCommissionIncluded: boolean;
}

export interface SystemPreparationPayload {
  name: string;

  /*
   * Şablon seçilmediyse hiç gönderilmez.
   */
  templateId?: string;

  exchangeRate: number;
  exchangeRateDate?: string;

  commissionRate: number;
  discountTry: number;

  laborItems: SystemLaborItem[];

  selections: SystemPreparationSelectionPayload[];
  customItems: SystemPreparationCustomItemPayload[];
}
