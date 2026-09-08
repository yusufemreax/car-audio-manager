import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function target(rel) {
  return path.join(root, rel);
}

function read(rel) {
  const file = target(rel);
  if (!fs.existsSync(file)) {
    throw new Error(`Dosya bulunamadi: ${rel}`);
  }
  return fs.readFileSync(file, "utf8");
}

function write(rel, content) {
  fs.writeFileSync(target(rel), content, "utf8");
  console.log(`OK  ${rel}`);
}

function patchCategoryCall(rel) {
  let source = read(rel);
  const fixedCall = `getProductsWithFreshPrices(\n        category && isProductCategory(category)\n          ? category\n          : undefined\n      )`;

  if (source.includes("category && isProductCategory(category)")) {
    console.log(`SKIP ${rel} (kategori tipi zaten guvenli)`);
    return;
  }

  const patterns = [
    /getProductsWithFreshPrices\(\s*category\s*\)/m,
    /getProductsWithFreshPrices\(\s*category\s*\?\?\s*undefined\s*\)/m,
  ];

  let changed = false;
  for (const pattern of patterns) {
    if (pattern.test(source)) {
      source = source.replace(pattern, fixedCall);
      changed = true;
      break;
    }
  }

  if (!changed) {
    throw new Error(
      `${rel}: getProductsWithFreshPrices(category) cagrisi bulunamadi. ` +
      `Dosyada cagrinin argumanini kategori type-guard ile ProductCategory'ye daraltin.`
    );
  }

  write(rel, source);
}

function patchProductDeleteInventoryQuery() {
  const rel = "src/app/api/products/[id]/route.ts";
  let source = read(rel);

  // Current inventory collection uses ObjectId for productId. Product creation also
  // writes insertedId (ObjectId), so DELETE should query with the validated objectId.
  const mixedIdPatterns = [
    /productId\s*:\s*\{\s*\$in\s*:\s*\[\s*objectId\s*,\s*id\s*,?\s*\]\s*\}/gm,
    /productId\s*:\s*\{\s*\$in\s*:\s*\[\s*id\s*,\s*objectId\s*,?\s*\]\s*\}/gm,
  ];

  let replacements = 0;
  for (const pattern of mixedIdPatterns) {
    source = source.replace(pattern, () => {
      replacements += 1;
      return "productId: objectId";
    });
  }

  if (replacements === 0) {
    // Idempotent case.
    const objectIdOnlyCount = (source.match(/productId\s*:\s*objectId/g) ?? []).length;
    if (objectIdOnlyCount >= 1) {
      console.log(`SKIP ${rel} (inventory productId zaten ObjectId)`);
      return;
    }

    throw new Error(
      `${rel}: productId $in [objectId, id] kalibi bulunamadi. ` +
      `DELETE bolumundeki inventory findOne/deleteMany filtrelerinde sadece objectId kullanin.`
    );
  }

  write(rel, source);
  console.log(`    ${replacements} adet mixed string/ObjectId filtresi duzeltildi.`);
}

function patchMockProducts() {
  const rel = "src/data/mock-products.ts";
  let source = read(rel);
  let inserted = 0;

  // Prettier/normal TS format: category kendi satirinda.
  source = source.replace(
    /(^|\n)([ \t]*)category\s*:/g,
    (match, lineStart, indent, offset, whole) => {
      const before = whole.slice(Math.max(0, offset - 500), offset);
      const objectStart = before.lastIndexOf("{");
      const currentObjectPrefix = objectStart >= 0 ? before.slice(objectStart) : before;

      if (/\bpriceUsd\s*:/.test(currentObjectPrefix)) {
        return match;
      }

      inserted += 1;
      return `${lineStart}${indent}priceUsd: 0,\n${indent}suppliers: ["EGB"],\n${indent}createdAt: "2026-01-01T00:00:00.000Z",\n${indent}updatedAt: "2026-01-01T00:00:00.000Z",\n${indent}category:`;
    }
  );

  // Tek satirlik mock nesneleri icin fallback.
  if (inserted === 0) {
    source = source.replace(
      /(\{\s*[^{}]*?\bmodel\s*:[^{}]*?,\s*)category\s*:/g,
      (match, prefix) => {
        if (/\bpriceUsd\s*:/.test(prefix)) {
          return match;
        }
        inserted += 1;
        return `${prefix}priceUsd: 0, suppliers: ["EGB"], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", category:`;
      }
    );
  }

  if (inserted === 0) {
    if (
      source.includes("priceUsd:") &&
      source.includes("suppliers:") &&
      source.includes("createdAt:") &&
      source.includes("updatedAt:")
    ) {
      console.log(`SKIP ${rel} (zorunlu Product alanlari zaten mevcut)`);
      return;
    }

    throw new Error(`${rel}: mock Product nesneleri bulunamadi.`);
  }

  write(rel, source);
  console.log(`    ${inserted} mock urune zorunlu alanlar eklendi.`);
}

function patchProductCodePrefix() {
  const rel = "src/lib/product-code.ts";
  let source = read(rel);

  if (/['"]vehicle-camera['"]\s*:/.test(source)) {
    console.log(`SKIP ${rel} (vehicle-camera prefix zaten mevcut)`);
    return;
  }

  const recordPattern = /((?:export\s+)?const\s+\w+\s*:\s*Record<\s*ProductCategory\s*,\s*string\s*>\s*=\s*\{)([\s\S]*?)(\n\s*\};)/m;
  const match = source.match(recordPattern);

  if (!match) {
    throw new Error(
      `${rel}: Record<ProductCategory, string> prefix haritasi bulunamadi.`
    );
  }

  const body = match[2];
  const bodyWithEntry = `${body.replace(/\s*$/, "")}\n  "vehicle-camera": "CAM",`;
  source = source.replace(recordPattern, `${match[1]}${bodyWithEntry}${match[3]}`);
  write(rel, source);
}

function main() {
  console.log("Car Audio Manager - Vercel TypeScript build fix\n");
  patchCategoryCall("src/app/api/inventory/route.ts");
  patchCategoryCall("src/app/api/products/route.ts");
  patchProductDeleteInventoryQuery();
  patchMockProducts();
  patchProductCodePrefix();
  console.log("\nTamamlandi. Simdi: npm run build");
}

try {
  main();
} catch (error) {
  console.error("\nHATA:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
