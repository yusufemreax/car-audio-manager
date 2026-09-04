import {
  ProductCategory,
} from "@/types/product";

import {
  SystemLaborItem,
} from "@/types/system-labor";

export interface SystemTemplateItem {
  id: string;
  label: string;
  category: ProductCategory;
  subCategory?: string;
  quantity: number;
  sortOrder: number;
}

export interface SystemTemplate {
  id: string;
  name: string;

  /*
   * İşçilik artık kalem kalem tutulur.
   */
  laborItems: SystemLaborItem[];

  /*
   * Liste/kart/toplam ekranlarında hızlı kullanım için
   * laborItems toplamının türetilmiş değeridir.
   */
  laborCostTry: number;

  items: SystemTemplateItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SystemTemplatePayload {
  name: string;
  laborItems: SystemLaborItem[];
  items: SystemTemplateItem[];
}
