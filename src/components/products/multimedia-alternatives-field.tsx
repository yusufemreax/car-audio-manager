"use client";
import { useEffect, useState } from "react";
import type {
  Product,
  MultimediaAlternatives,
  ProductSpecificationValue,
} from "@/types/product";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function MultimediaAlternativesField({
  productId,
  specifications,
  isVehicleSpecific,
  value,
  onChange,
  disabled,
}: {
  productId?: string;
  specifications: Record<string, ProductSpecificationValue>;
  isVehicleSpecific: boolean;
  value: MultimediaAlternatives;
  onChange: (value: MultimediaAlternatives) => void;
  disabled: boolean;
}) {
  const [products, setProducts] = useState<Product[]>([]),
    [error, setError] = useState(""),
    [search, setSearch] = useState("");
  useEffect(() => {
    let active = true;
    void fetch("/api/products?category=multimedia", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success)
          throw new Error("Alternatif cihazlar yüklenemedi.");
        if (active) setProducts(result.data ?? []);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const compatible = products.filter(
    (product) =>
      Boolean(product.isVehicleSpecific) === isVehicleSpecific &&
      ["screenSize", "ram", "storage"].every(
        (key) =>
          String(specifications[key] ?? "").trim() !== "" &&
          String(product.specifications[key] ?? "").trim() ===
            String(specifications[key]).trim(),
      ),
  );
  return (
    <section className="space-y-4 rounded-xl border p-4">
      <div>
        <h3 className="font-semibold">Alternatif multimedya cihazları</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Aynı ekran boyutu, RAM ve hafızadaki cihazları tedarikçiye göre seçin.
          Uygun olduğunda çerçeveyle aynı tedarikçiden cihaz kullanılır. Seçim
          boşsa mevcut cihazın kendi tedarikçi bağlantıları kullanılır.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Input
        aria-label="Alternatif cihaz ara"
        placeholder="Marka, model veya kod ara..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        disabled={disabled}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {(["EGB", "OZDEMIR"] as const).map((supplier) => {
          const choices = compatible.filter((product) =>
            product.suppliers.includes(supplier),
          );
          const selected = choices.find(
            (product) => product.id === value[supplier],
          );
          const visible = choices.filter(
            (product) =>
              product.id === value[supplier] ||
              `${product.brand} ${product.model} ${product.productCode}`
                .toLocaleLowerCase("tr-TR")
                .includes(search.toLocaleLowerCase("tr-TR")),
          );
          return (
            <div key={supplier} className="space-y-2">
              <Label htmlFor={`multimedia-alternative-${supplier}`}>
                {supplier} alternatifi
              </Label>
              <select
                id={`multimedia-alternative-${supplier}`}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={disabled}
                value={value[supplier] ?? ""}
                onChange={(event) => {
                  const next = { ...value };
                  if (event.target.value) next[supplier] = event.target.value;
                  else delete next[supplier];
                  onChange(next);
                }}
              >
                <option value="">Alternatif seçilmedi</option>
                {value[supplier] && !selected && (
                  <option value={value[supplier]}>
                    Mevcut alternatif (uyumunu kontrol edin)
                  </option>
                )}
                {visible.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.id === productId ? "Bu cihaz · " : ""}
                    {product.brand} {product.model} ·{" "}
                    {product.supplierPrices?.find(
                      (row) => row.supplier === supplier,
                    )?.productCode || product.productCode}
                    {product.supplierPrices?.find(
                      (row) => row.supplier === supplier,
                    )?.sourceUnavailable
                      ? " · Satışta değil"
                      : ""}
                  </option>
                ))}
              </select>
              {value[supplier] && (
                <button
                  type="button"
                  className="text-xs underline"
                  disabled={disabled}
                  onClick={() => {
                    const next = { ...value };
                    delete next[supplier];
                    onChange(next);
                  }}
                >
                  Seçimi temizle
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
