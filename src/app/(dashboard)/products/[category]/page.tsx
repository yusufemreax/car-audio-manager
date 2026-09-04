import { notFound } from "next/navigation";

import { ProductPageClient } from "@/components/products/product-page-client";

import {
  isProductCategory,
} from "@/lib/product-config";

export default async function ProductCategoryPage(
  props: {
    params: Promise<{
      category: string;
    }>;
  },
) {
  const params = await props.params;

  if (!isProductCategory(params.category)) {
    notFound();
  }

  return (
    <ProductPageClient
      category={params.category}
    />
  );
}