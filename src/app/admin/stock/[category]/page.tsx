import { notFound } from "next/navigation";


import {
  isProductCategory,
} from "@/lib/product-config";
import { StockPageClient } from "@/components/stock/stock-page-client";

interface StockCategoryPageProps {
  params: Promise<{
    category: string;
  }>;
}

export default async function StockCategoryPage({
  params,
}: StockCategoryPageProps) {
  const { category } = await params;

  if (!isProductCategory(category)) {
    notFound();
  }

  return (
    <StockPageClient
      category={category}
    />
  );
}