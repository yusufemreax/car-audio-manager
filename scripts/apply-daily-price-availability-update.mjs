import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(scriptDir, "templates");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(root, ".daily-price-availability-update-backup", timestamp);
const changedFiles = [];

const paths = {
  productType: "src/types/product.ts",
  productsCollection: "src/lib/products-collection.ts",
  productPriceRefresh: "src/lib/product-price-refresh.ts",
  productsRoute: "src/app/api/products/route.ts",
  productSelectionDialog: "src/components/system-preparation/product-selection-dialog.tsx",
  systemPreparationBuilder: "src/lib/system-preparation-builder.ts",
  manualRefreshRoute: "src/app/api/scraping/egb/products/[productId]/refresh/route.ts",
  bulkRefreshRoute: "src/app/api/scraping/products/refresh-prices/route.ts",
  workflowTypes: "src/types/customer-offer-workflow.ts",
  workflow: "src/lib/customer-offer-stock-workflow.ts",
  workflowRoute: "src/app/api/customer-system-offers/[id]/workflow/route.ts",
  interceptor: "src/components/customers/customer-offer-stock-decision-interceptor.tsx",
};

function abs(relativePath) {
  return path.join(root, ...relativePath.split("/"));
}

function read(relativePath) {
  const filePath = abs(relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Dosya bulunamadı: ${relativePath}`);
  }
  return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

function backup(relativePath, original) {
  const target = path.join(backupRoot, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, original, "utf8");
}

function write(relativePath, original, next) {
  if (original === next) return;
  backup(relativePath, original);
  fs.mkdirSync(path.dirname(abs(relativePath)), { recursive: true });
  fs.writeFileSync(abs(relativePath), next, "utf8");
  changedFiles.push(relativePath);
}

function replaceRequired(text, from, to, label) {
  if (!text.includes(from)) {
    throw new Error(`${label}: beklenen kod bloğu bulunamadı.`);
  }
  return text.replace(from, to);
}

function template(name) {
  const filePath = path.join(templatesDir, name);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Paket şablonu bulunamadı: scripts/templates/${name}`);
  }
  return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

function replaceWithTemplate(relativePath, templateName) {
  const original = read(relativePath);
  const next = template(templateName);
  write(relativePath, original, next);
}

function patchProductType() {
  const p = paths.productType;
  const original = read(p);
  let text = original;

  if (!text.includes("sourceUnavailable?: boolean;")) {
    text = replaceRequired(
      text,
      "  sourceUrl?: string;\n  priceCheckedAt?: string;",
      "  sourceUrl?: string;\n  priceCheckedAt?: string;\n  /** Son günlük kontrolde ürün kaynağı HTTP 404 döndürdüyse true. */\n  sourceUnavailable?: boolean;\n  /** Ürün kaynağının erişilebilirlik durumunun son kontrol zamanı. */\n  sourceAvailabilityCheckedAt?: string;",
      p
    );
  }

  write(p, original, text);
}

function patchProductsCollection() {
  const p = paths.productsCollection;
  const original = read(p);
  let text = original;

  if (!text.includes("sourceUnavailable?: boolean;")) {
    text = replaceRequired(
      text,
      "  priceCheckedAt?: Date;\n  priceRefreshAttemptedAt?: Date;",
      "  priceCheckedAt?: Date;\n  priceRefreshAttemptedAt?: Date;\n  sourceUnavailable?: boolean;\n  sourceAvailabilityCheckedAt?: Date;",
      p
    );
  }

  if (!text.includes("sourceAvailabilityCheckedAt:\n            product.sourceAvailabilityCheckedAt.toISOString()")) {
    const marker = `    ...(product.priceCheckedAt instanceof Date\n      ? {\n          priceCheckedAt:\n            product.priceCheckedAt.toISOString(),\n        }\n      : {}),`;
    const addition = `${marker}\n    ...(typeof product.sourceUnavailable === \"boolean\"\n      ? {\n          sourceUnavailable:\n            product.sourceUnavailable,\n        }\n      : {}),\n    ...(product.sourceAvailabilityCheckedAt instanceof Date\n      ? {\n          sourceAvailabilityCheckedAt:\n            product.sourceAvailabilityCheckedAt.toISOString(),\n        }\n      : {}),`;
    text = replaceRequired(text, marker, addition, p);
  }

  write(p, original, text);
}

function patchProductsRoute() {
  const p = paths.productsRoute;
  const original = read(p);
  let text = original;

  if (!text.includes('getProductsWithFreshPrices,')) {
    const marker = `import {\n  getInventoryCollection,\n} from \"@/lib/inventory-collection\";`;
    text = replaceRequired(
      text,
      marker,
      `${marker}\n\nimport {\n  getProductsWithFreshPrices,\n} from \"@/lib/products-service\";`,
      p
    );
  }

  const oldBlock = `    const collection =\n      await getProductsCollection();\n\n    const filter =\n      category\n        ? {\n            category,\n          }\n        : {};\n\n    const products =\n      await collection\n        .find(\n          filter\n        )\n        .sort({\n          createdAt:\n            -1,\n        })\n        .toArray();`;

  const newBlock = `    /*\n     * Ürün listesi merkezi fiyat servisi üzerinden okunur. Böylece kaynak linki\n     * olan ürünler Istanbul gününde en fazla bir kez EGB'den kontrol edilir ve\n     * 404 durumu da ürün kaydına işlenir.\n     */\n    const products =\n      await getProductsWithFreshPrices(\n        category &&\n        isProductCategory(\n          category\n        )\n          ? category\n          : undefined\n      );`;

  if (!text.includes("Istanbul gününde en fazla bir kez")) {
    text = replaceRequired(text, oldBlock, newBlock, p);
  }

  write(p, original, text);
}

function patchProductSelectionDialog() {
  const p = paths.productSelectionDialog;
  const original = read(p);
  let text = original;

  if (!text.includes("product.sourceUnavailable ===\n        true")) {
    const oldHandle = `  const handleSelect =\n    (\n      product:\n        Product\n    ) => {\n      onSelect(\n        product\n      );`;
    const newHandle = `  const handleSelect =\n    (\n      product:\n        Product\n    ) => {\n      if (\n        product.sourceUnavailable ===\n        true\n      ) {\n        return;\n      }\n\n      onSelect(\n        product\n      );`;
    text = replaceRequired(text, oldHandle, newHandle, p);
  }

  if (!text.includes("const unavailable =\n                        product.sourceUnavailable")) {
    const marker = `                      const selected =\n                        product.id ===\n                        selectedProductId;`;
    const replacement = `${marker}\n\n                      const unavailable =\n                        product.sourceUnavailable ===\n                        true;`;
    text = replaceRequired(text, marker, replacement, p);
  }

  if (!text.includes('"opacity-55 cursor-not-allowed"')) {
    const oldClass = `                          className={\n                            selected\n                              ? \"bg-muted/60\"\n                              : undefined\n                          }`;
    const newClass = `                          className={\n                            unavailable\n                              ? \"opacity-55 cursor-not-allowed\"\n                              : selected\n                                ? \"bg-muted/60\"\n                                : undefined\n                          }`;
    text = replaceRequired(text, oldClass, newClass, p);
  }

  if (!text.includes("EGB sayfası bulunamadı (404)")) {
    const oldModel = `                          <TableCell className=\"h-13 whitespace-nowrap\">\n                            {\n                              product.model\n                            }\n                          </TableCell>`;
    const newModel = `                          <TableCell className=\"h-13 whitespace-nowrap\">\n                            <div>\n                              {product.model}\n                            </div>\n                            {unavailable ? (\n                              <div className=\"mt-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300\">\n                                Satışta değil · EGB sayfası bulunamadı (404)\n                              </div>\n                            ) : null}\n                          </TableCell>`;
    text = replaceRequired(text, oldModel, newModel, p);
  }

  if (!text.includes("disabled={\n                                unavailable")) {
    const marker = `                              onClick={() =>\n                                handleSelect(\n                                  product\n                                )\n                              }\n                            >`;
    const replacement = `                              disabled={\n                                unavailable\n                              }\n                              onClick={() =>\n                                handleSelect(\n                                  product\n                                )\n                              }\n                            >`;
    text = replaceRequired(text, marker, replacement, p);
  }

  if (!text.includes('unavailable ? (\n                                "Seçilemez"')) {
    const oldText = `                              {selected ? (\n                                <>\n                                  <Check className=\"size-4\" />\n\n                                  Seçili\n                                </>\n                              ) : (\n                                \"Seç\"\n                              )}`;
    const newText = `                              {unavailable ? (\n                                \"Seçilemez\"\n                              ) : selected ? (\n                                <>\n                                  <Check className=\"size-4\" />\n\n                                  Seçili\n                                </>\n                              ) : (\n                                \"Seç\"\n                              )}`;
    text = replaceRequired(text, oldText, newText, p);
  }

  write(p, original, text);
}

function patchSystemPreparationBuilder() {
  const p = paths.systemPreparationBuilder;
  const original = read(p);
  let text = original;

  text = text.replace(
    "sourceUrl varsa son fiyat kontrolünü 5 dakikalık TTL ile değerlendirir.",
    "sourceUrl varsa ürünün bugün kontrol edilip edilmediğini Europe/Istanbul gününe göre değerlendirir."
  ).replace(
    "TTL dolmuşsa EGB fiyatını yeniler.",
    "Bugün kontrol edilmediyse EGB fiyatını yeniler; 404 ise ürünü satışta değil işaretler."
  );

  if (!text.includes("const unavailableProduct =")) {
    const marker = `  const productMap =\n    new Map(\n      products.map(\n        (product) => [\n          product._id.toString(),\n          product,\n        ]\n      )\n    );`;
    const addition = `${marker}\n\n  const unavailableProduct =\n    products.find(\n      (product) =>\n        product.sourceUnavailable ===\n        true\n    );\n\n  if (unavailableProduct) {\n    const productName =\n      [\n        unavailableProduct.productCode,\n        unavailableProduct.brand,\n        unavailableProduct.model,\n      ]\n        .filter(Boolean)\n        .join(\" · \" );\n\n    throw new SystemPreparationBuildError(\n      \`\${productName || \"Seçilen ürün\"} EGB ürün sayfası 404 döndüğü için Sistem Hazırlamada kullanılamaz.\`,\n      409\n    );\n  }`;
    text = replaceRequired(text, marker, addition, p);
  }

  write(p, original, text);
}

function patchWorkflowTypes() {
  const p = paths.workflowTypes;
  const original = read(p);
  let text = original;

  if (!text.includes("confirmUnavailableOrderProducts?: boolean;")) {
    const marker = "  reservedStockDecisions?: CustomerOfferReservedStockDecision[];\n}";
    text = replaceRequired(
      text,
      marker,
      "  reservedStockDecisions?: CustomerOfferReservedStockDecision[];\n  /** 404 ile satışta değil işaretlenen eksik ürünlerle Sipariş adımına devam onayı. */\n  confirmUnavailableOrderProducts?: boolean;\n}",
      p
    );
  }

  write(p, original, text);
}

function patchWorkflowBackend() {
  const p = paths.workflow;
  const original = read(p);
  let text = original;

  if (!text.includes("confirmUnavailableOrderProducts?: boolean;")) {
    const marker = "  reservedStockDecisions?: CustomerOfferReservedStockDecision[];\n}";
    text = replaceRequired(
      text,
      marker,
      "  reservedStockDecisions?: CustomerOfferReservedStockDecision[];\n  confirmUnavailableOrderProducts?: boolean;\n}",
      p
    );
  }

  if (!text.includes("function getUnavailableOrderProducts(")) {
    const marker = "async function moveToInstallationPendingWithoutStockDeduction(";
    const helper = `function getUnavailableOrderProducts(\n  requirements: CustomerOfferStockRequirement[],\n  productByProductId: Map<\n    string,\n    WithId<ProductDocument>\n  >\n) {\n  return requirements\n    .filter(\n      (requirement) =>\n        requirement.missingQuantity > 0\n    )\n    .flatMap((requirement) => {\n      const product =\n        productByProductId.get(\n          requirement.productId\n        );\n\n      if (\n        product?.sourceUnavailable !==\n        true\n      ) {\n        return [];\n      }\n\n      return [\n        {\n          productId:\n            requirement.productId,\n          ...(requirement.productCode\n            ? { productCode: requirement.productCode }\n            : {}),\n          ...(requirement.brand\n            ? { brand: requirement.brand }\n            : {}),\n          ...(requirement.model\n            ? { model: requirement.model }\n            : {}),\n          missingQuantity:\n            requirement.missingQuantity,\n        },\n      ];\n    });\n}\n\n`;
    const index = text.indexOf(marker);
    if (index < 0) throw new Error(`${p}: montaj helper işareti bulunamadı.`);
    text = `${text.slice(0, index)}${helper}${text.slice(index)}`;
  }

  if (!text.includes("unavailableOrderConfirmationRequired: true")) {
    const marker = `      const decidedRequirements = applyReservedStockDecisions(\n        reservationResolution.requirements,\n        options.reservedStockDecisions\n      );\n\n      if (hasShortage(decidedRequirements)) {`;
    const replacement = `      const decidedRequirements = applyReservedStockDecisions(\n        reservationResolution.requirements,\n        options.reservedStockDecisions\n      );\n\n      const unavailableOrderProducts =\n        getUnavailableOrderProducts(\n          decidedRequirements,\n          reservationResolution.productByProductId\n        );\n\n      if (\n        unavailableOrderProducts.length > 0 &&\n        options.confirmUnavailableOrderProducts !== true\n      ) {\n        await releaseStockProcessingToken(\n          offersCollection,\n          offerId,\n          token\n        );\n\n        return {\n          offer: {\n            ...serializeOffer(claimed),\n            unavailableOrderConfirmationRequired: true,\n            unavailableOrderProducts,\n          },\n          stockRequirements: decidedRequirements,\n          message:\n            \"Sipariş gerektiren bazı ürünlerin EGB sayfası 404 döndü. Devam etmeden önce kullanıcı onayı gerekiyor.\",\n        };\n      }\n\n      if (hasShortage(decidedRequirements)) {`;
    text = replaceRequired(text, marker, replacement, p);
  }

  write(p, original, text);
}

function patchWorkflowRoute() {
  const p = paths.workflowRoute;
  const original = read(p);
  let text = original;

  if (!text.includes("confirmUnavailableOrderProducts:")) {
    const marker = "          reservedStockDecisions: body.reservedStockDecisions,\n";
    text = replaceRequired(
      text,
      marker,
      `${marker}          confirmUnavailableOrderProducts:\n            body.confirmUnavailableOrderProducts,\n`,
      p
    );
  }

  write(p, original, text);
}

function verify() {
  const checks = [
    [paths.productType, ["sourceUnavailable?: boolean;", "sourceAvailabilityCheckedAt?: string;"]],
    [paths.productsCollection, ["sourceUnavailable?: boolean;", "sourceAvailabilityCheckedAt?: Date;"]],
    [paths.productPriceRefresh, ["Europe/Istanbul", "sourceUnavailable:", "responseStatus", "günlük limit"]],
    [paths.productsRoute, ["getProductsWithFreshPrices", "Istanbul gününde en fazla bir kez"]],
    [paths.productSelectionDialog, ["Seçilemez", "EGB sayfası bulunamadı (404)"]],
    [paths.systemPreparationBuilder, ["Sistem Hazırlamada kullanılamaz"]],
    [paths.workflowTypes, ["confirmUnavailableOrderProducts?: boolean;"]],
    [paths.workflow, ["getUnavailableOrderProducts", "unavailableOrderConfirmationRequired: true"]],
    [paths.workflowRoute, ["confirmUnavailableOrderProducts:"]],
    [paths.interceptor, ["Teklifte satışta olmayan ürün var", "Sipariş verilemeyebilecek ürün var", "useCustomerOfferStockDecisionInterceptor"]],
  ];

  for (const [p, needles] of checks) {
    const content = read(p);
    for (const needle of needles) {
      if (!content.includes(needle)) {
        throw new Error(`Doğrulama başarısız: ${p} içinde '${needle}' bulunamadı.`);
      }
    }
  }

  const interceptor = read(paths.interceptor);
  if (!interceptor.trimStart().startsWith('"use client";')) {
    throw new Error("Interceptor içinde use client direktifi ilk ifade değil.");
  }

  if (read(paths.productPriceRefresh).includes("5 * 60 * 1000")) {
    throw new Error("Eski 5 dakikalık TTL kodu halen mevcut.");
  }
}

function main() {
  // Bu dosyalar tek amaçlı oldukları için kontrollü tam şablonla güncellenir.
  replaceWithTemplate(paths.productPriceRefresh, "product-price-refresh.ts");
  replaceWithTemplate(paths.manualRefreshRoute, "manual-refresh-route.ts");
  replaceWithTemplate(paths.bulkRefreshRoute, "bulk-refresh-route.ts");
  replaceWithTemplate(paths.interceptor, "customer-offer-stock-decision-interceptor.tsx");

  // Büyük/çok amaçlı dosyalarda yalnızca gerekli bloklara dokunulur.
  patchProductType();
  patchProductsCollection();
  patchProductsRoute();
  patchProductSelectionDialog();
  patchSystemPreparationBuilder();
  patchWorkflowTypes();
  patchWorkflowBackend();
  patchWorkflowRoute();

  verify();

  console.log("\nGünlük fiyat + 404 ürün uygunluk güncellemesi başarıyla uygulandı.\n");
  console.log("Değiştirilen dosyalar:");
  for (const file of changedFiles) {
    console.log(`  - ${file}`);
  }
  console.log(`\nYedek: ${path.relative(root, backupRoot)}`);
  console.log("\nŞimdi çalıştırın: npm run build");
}

try {
  main();
} catch (error) {
  console.error("\nGüncelleme uygulanamadı:");
  console.error(error instanceof Error ? error.message : error);
  if (fs.existsSync(backupRoot)) {
    console.error(`Yedek klasörü: ${path.relative(root, backupRoot)}`);
  }
  process.exitCode = 1;
}
