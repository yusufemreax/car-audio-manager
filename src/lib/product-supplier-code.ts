import type { ProductSupplier } from "@/types/supplier";
export function getSupplierProductCode(
  product: {
    productCode: string;
    supplierPrices?: Array<{ supplier: ProductSupplier; productCode?: string }>;
  },
  supplier?: ProductSupplier,
) {
  return (
    product.supplierPrices
      ?.find((row) => row.supplier === supplier)
      ?.productCode?.trim() || product.productCode
  );
}
