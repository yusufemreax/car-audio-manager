import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const packageScriptDir = path.dirname(fileURLToPath(import.meta.url));
const tailTemplatePath = path.join(
  packageScriptDir,
  "customer-offer-stock-workflow.tail.txt"
);

const paths = {
  types: "src/types/customer-offer-workflow.ts",
  workflow: "src/lib/customer-offer-stock-workflow.ts",
  customersPage: "src/components/customers/customers-page-client.tsx",
  workflowRoute: "src/app/api/customer-system-offers/[id]/workflow/route.ts",
};

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(root, ".stock-reservation-update-backup", timestamp);
const changedFiles = [];
const warnings = [];

function absolute(relativePath) {
  return path.join(root, ...relativePath.split("/"));
}

function normalizeNewlines(text) {
  return text.replace(/\r\n/g, "\n");
}

function readRequired(relativePath) {
  const filePath = absolute(relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Dosya bulunamadı: ${relativePath}`);
  }
  return normalizeNewlines(fs.readFileSync(filePath, "utf8"));
}

function backup(relativePath, content) {
  const target = path.join(backupRoot, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function writeChanged(relativePath, original, next) {
  if (next === original) {
    return;
  }

  backup(relativePath, original);
  fs.writeFileSync(absolute(relativePath), next, "utf8");
  changedFiles.push(relativePath);
}

function insertBefore(text, marker, addition, label) {
  const index = text.indexOf(marker);
  if (index < 0) {
    throw new Error(`${label} için beklenen işaret bulunamadı: ${marker}`);
  }
  return `${text.slice(0, index)}${addition}${text.slice(index)}`;
}

function patchWorkflowTypes() {
  const relativePath = paths.types;
  const original = readRequired(relativePath);
  let text = original;

  if (!text.includes("reservedQuantity?: number;")) {
    const marker = "  suppliers: ProductSupplier[];\n}";
    if (!text.includes(marker)) {
      throw new Error(
        `${relativePath}: CustomerOfferStockRequirement sonu bulunamadı.`
      );
    }

    text = text.replace(
      marker,
      `  suppliers: ProductSupplier[];\n  /** Montaj bekleyen diğer tekliflerin ayırdığı toplam miktar. */\n  reservedQuantity?: number;\n  /** Fiziksel stoktan rezervasyonlar çıkarıldıktan sonra serbest kalan miktar. */\n  freeQuantity?: number;\n  /** Bu teklif için sipariş/stok kullanımı kararı gereken miktar. */\n  reservationConflictQuantity?: number;\n}`
    );
  }

  if (!text.includes("export type CustomerOfferReservedStockDecisionValue")) {
    const marker = "export interface CustomerOfferOrderSupplierSelection";
    const addition = `export type CustomerOfferReservedStockDecisionValue =\n  | "order"\n  | "use_stock";\n\nexport interface CustomerOfferReservedStockDecision {\n  productId: string;\n  decision: CustomerOfferReservedStockDecisionValue;\n}\n\nexport interface CustomerOfferStockReservationConflict {\n  productId: string;\n  productCode?: string;\n  brand?: string;\n  model?: string;\n  requiredQuantity: number;\n  availableQuantity: number;\n  reservedQuantity: number;\n  freeQuantity: number;\n  conflictQuantity: number;\n}\n\n`;

    text = insertBefore(text, marker, addition, relativePath);
  }

  if (!text.includes("reservedStockDecisions?: CustomerOfferReservedStockDecision[];")) {
    const requestStart = text.indexOf(
      "export interface CustomerOfferWorkflowRequest"
    );
    if (requestStart < 0) {
      throw new Error(`${relativePath}: CustomerOfferWorkflowRequest bulunamadı.`);
    }

    const requestEnd = text.indexOf("\n}", requestStart);
    if (requestEnd < 0) {
      throw new Error(`${relativePath}: CustomerOfferWorkflowRequest sonu bulunamadı.`);
    }

    text = `${text.slice(0, requestEnd)}\n  reservedStockDecisions?: CustomerOfferReservedStockDecision[];${text.slice(
      requestEnd
    )}`;
  }

  writeChanged(relativePath, original, text);
}

function patchWorkflowBackend() {
  const relativePath = paths.workflow;
  const original = readRequired(relativePath);
  let text = original;

  if (!text.includes("CustomerOfferReservedStockDecision,")) {
    const importNeedle = "  CustomerOfferOrderSupplierSelection,\n";
    if (!text.includes(importNeedle)) {
      throw new Error(
        `${relativePath}: customer-offer-workflow type import bloğu beklenen formatta değil.`
      );
    }

    text = text.replace(
      importNeedle,
      `${importNeedle}  CustomerOfferReservedStockDecision,\n  CustomerOfferStockReservationConflict,\n`
    );
  }

  if (!text.includes("reservedStockDecisions?: CustomerOfferReservedStockDecision[];")) {
    const optionsStart = text.indexOf(
      "export interface CustomerOfferWorkflowOptions"
    );
    if (optionsStart < 0) {
      throw new Error(`${relativePath}: CustomerOfferWorkflowOptions bulunamadı.`);
    }

    const optionsEnd = text.indexOf("\n}", optionsStart);
    if (optionsEnd < 0) {
      throw new Error(
        `${relativePath}: CustomerOfferWorkflowOptions sonu bulunamadı.`
      );
    }

    text = `${text.slice(0, optionsEnd)}\n  reservedStockDecisions?: CustomerOfferReservedStockDecision[];${text.slice(
      optionsEnd
    )}`;
  }

  const runMarker = "export async function runCustomerOfferWorkflow(";
  const runIndex = text.indexOf(runMarker);
  if (runIndex < 0) {
    throw new Error(`${relativePath}: runCustomerOfferWorkflow bulunamadı.`);
  }

  // İlk kurulumda runCustomerOfferWorkflow'dan hemen önceki export async
  // function workflow detay fonksiyonudur. Paket daha önce uygulanmışsa kendi
  // marker'ımızdan itibaren yenileyerek ikinci çalıştırmada helper'ları çoğaltmayız.
  const reservationMarker =
    "INSTALLATION RESERVATION / DELAYED STOCK CONSUMPTION";
  const existingMarkerIndex = text.indexOf(reservationMarker);
  let replaceIndex = -1;

  if (existingMarkerIndex >= 0) {
    replaceIndex = text.lastIndexOf("/*", existingMarkerIndex);
  } else {
    const beforeRun = text.slice(0, runIndex);
    const detailIndex = beforeRun.lastIndexOf("export async function ");
    if (detailIndex < 0) {
      throw new Error(
        `${relativePath}: workflow detay fonksiyonunun başlangıcı bulunamadı.`
      );
    }

    const detailHeader = beforeRun.slice(
      detailIndex,
      beforeRun.indexOf("{", detailIndex)
    );
    if (!/CustomerOfferWorkflow/i.test(detailHeader)) {
      throw new Error(
        `${relativePath}: runCustomerOfferWorkflow öncesindeki fonksiyon beklenen workflow detail fonksiyonu değil. Otomatik güncelleme durduruldu.`
      );
    }
    replaceIndex = detailIndex;
  }

  if (replaceIndex < 0) {
    throw new Error(`${relativePath}: workflow replacement başlangıcı bulunamadı.`);
  }

  if (!fs.existsSync(tailTemplatePath)) {
    throw new Error(`Tail şablonu bulunamadı: ${tailTemplatePath}`);
  }

  const tail = normalizeNewlines(fs.readFileSync(tailTemplatePath, "utf8"));
  text = `${text.slice(0, replaceIndex)}${tail.trimEnd()}\n`;

  writeChanged(relativePath, original, text);
}

function patchWorkflowRoute() {
  const relativePath = paths.workflowRoute;
  const original = readRequired(relativePath);
  let text = original;

  if (text.includes("reservedStockDecisions")) {
    return;
  }

  // En yaygın yapı: options objesinde payload/body.supplierSelections geçiriliyor.
  const selectionRegex = /(\n([ \t]*)supplierSelections:\s*([A-Za-z_$][\w$]*)\.supplierSelections,\s*\n)/;
  const selectionMatch = text.match(selectionRegex);

  if (selectionMatch) {
    const [, whole, indent, variable] = selectionMatch;
    text = text.replace(
      whole,
      `${whole}${indent}reservedStockDecisions: ${variable}.reservedStockDecisions,\n`
    );
    writeChanged(relativePath, original, text);
    return;
  }

  const paymentRegex = /(\n([ \t]*)payment:\s*([A-Za-z_$][\w$]*)\.payment,\s*\n)/;
  const paymentMatch = text.match(paymentRegex);
  if (paymentMatch) {
    const [, whole, indent, variable] = paymentMatch;
    text = text.replace(
      whole,
      `${whole}${indent}reservedStockDecisions: ${variable}.reservedStockDecisions,\n`
    );
    writeChanged(relativePath, original, text);
    return;
  }

  // Eğer request body üçüncü argüman olarak doğrudan geçiriliyorsa yeni alan zaten
  // backend'e ulaşır; ekstra patch gerekmez.
  const directBodyPass = /runCustomerOfferWorkflow\([\s\S]{0,500}?,\s*([A-Za-z_$][\w$]*)\s*\)/m;
  if (directBodyPass.test(text)) {
    warnings.push(
      `${relativePath}: request gövdesi workflow options olarak doğrudan geçiriliyor; route değişikliği gerekmedi.`
    );
    return;
  }

  throw new Error(
    `${relativePath}: reservedStockDecisions alanını backend'e geçirecek options bloğu otomatik bulunamadı.`
  );
}

function findCustomersComponentBodyBrace(text) {
  const functionMarkers = [
    "function CustomersPageClient",
    "const CustomersPageClient",
    "let CustomersPageClient",
  ];

  let markerIndex = -1;
  for (const marker of functionMarkers) {
    markerIndex = text.indexOf(marker);
    if (markerIndex >= 0) {
      break;
    }
  }

  if (markerIndex < 0) {
    return -1;
  }

  const parenStart = text.indexOf("(", markerIndex);
  if (parenStart < 0) {
    return text.indexOf("{", markerIndex);
  }

  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = parenStart; index < text.length; index += 1) {
    const char = text[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "(") {
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return text.indexOf("{", index + 1);
      }
    }
  }

  return -1;
}

function patchCustomersPage() {
  const relativePath = paths.customersPage;
  const original = readRequired(relativePath);
  let text = original;

  const importLine =
    'import { useCustomerOfferStockDecisionInterceptor } from "@/components/customers/customer-offer-stock-decision-interceptor";\n';

  // Import daha once hatali sekilde "use client" direktifinin ustune
  // yerlestirilmis olsa bile normalize et. Next.js direktifin tum importlardan
  // once gelmesini zorunlu tutar.
  text = text.replaceAll(importLine, "");

  const directiveRegex = /(^|\n)(["']use client["'];[ \t]*(?:\n|$))/m;
  const directiveMatch = text.match(directiveRegex);

  if (directiveMatch && directiveMatch.index !== undefined) {
    const directiveStart = directiveMatch.index + directiveMatch[1].length;
    const directiveEnd = directiveStart + directiveMatch[2].length;
    text = `${text.slice(0, directiveEnd)}${importLine}${text.slice(directiveEnd)}`;
  } else {
    // Hook kullanan bu component client component olmak zorunda. Direktif
    // mevcut degilse dosyanin en basina ekle.
    const bom = text.startsWith("\uFEFF") ? "\uFEFF" : "";
    const withoutBom = bom ? text.slice(1) : text;
    text = `${bom}"use client";\n\n${importLine}${withoutBom}`;
  }

  if (!text.includes("useCustomerOfferStockDecisionInterceptor();")) {
    const bodyBrace = findCustomersComponentBodyBrace(text);
    if (bodyBrace < 0) {
      throw new Error(
        `${relativePath}: CustomersPageClient fonksiyon gövdesi bulunamadı.`
      );
    }

    text = `${text.slice(
      0,
      bodyBrace + 1
    )}\n  useCustomerOfferStockDecisionInterceptor();${text.slice(bodyBrace + 1)}`;
  }

  writeChanged(relativePath, original, text);
}

function verify() {
  const checks = [
    [
      paths.types,
      [
        "CustomerOfferReservedStockDecision",
        "reservationConflictQuantity?: number;",
        "reservedStockDecisions?: CustomerOfferReservedStockDecision[];",
      ],
    ],
    [
      paths.workflow,
      [
        "resolveStartSaleRequirements",
        "moveToInstallationPendingWithoutStockDeduction",
        "completeOrderAndKeepProductsInInventory",
        "deductInstallationStock",
        "options.reservedStockDecisions",
      ],
    ],
    [
      paths.customersPage,
      ["useCustomerOfferStockDecisionInterceptor();"],
    ],
  ];

  for (const [relativePath, needles] of checks) {
    const content = readRequired(relativePath);
    for (const needle of needles) {
      if (!content.includes(needle)) {
        throw new Error(
          `Doğrulama başarısız: ${relativePath} içinde ${needle} bulunamadı.`
        );
      }
    }
  }

  const customersContent = readRequired(paths.customersPage);
  const clientDirectiveMatch = customersContent.match(/(^|\n)["']use client["'];/m);
  const interceptorImportIndex = customersContent.indexOf(
    'import { useCustomerOfferStockDecisionInterceptor }'
  );
  if (!clientDirectiveMatch || clientDirectiveMatch.index === undefined) {
    throw new Error(
      `Doğrulama başarısız: ${paths.customersPage} içinde \"use client\" direktifi bulunamadı.`
    );
  }
  const clientDirectiveIndex =
    clientDirectiveMatch.index + clientDirectiveMatch[1].length;
  if (
    interceptorImportIndex < 0 ||
    interceptorImportIndex < clientDirectiveIndex
  ) {
    throw new Error(
      `Doğrulama başarısız: interceptor importu \"use client\" direktifinden sonra olmalı.`
    );
  }

  const newComponent =
    "src/components/customers/customer-offer-stock-decision-interceptor.tsx";
  if (!fs.existsSync(absolute(newComponent))) {
    throw new Error(`Yeni interceptor dosyası bulunamadı: ${newComponent}`);
  }
}

function main() {
  const packageComponent = path.resolve(
    packageScriptDir,
    "..",
    "src",
    "components",
    "customers",
    "customer-offer-stock-decision-interceptor.tsx"
  );
  const targetComponent = absolute(
    "src/components/customers/customer-offer-stock-decision-interceptor.tsx"
  );

  if (!fs.existsSync(packageComponent) && !fs.existsSync(targetComponent)) {
    throw new Error(
      "customer-offer-stock-decision-interceptor.tsx paket içinde bulunamadı. ZIP'i proje köküne klasör yapısını koruyarak açın."
    );
  }

  // ZIP proje köküne açıldığında component zaten hedef konumdadır. Script başka
  // bir konumdan çalıştırılırsa da kopyalama desteği bırakıyoruz.
  if (!fs.existsSync(targetComponent) && fs.existsSync(packageComponent)) {
    fs.mkdirSync(path.dirname(targetComponent), { recursive: true });
    fs.copyFileSync(packageComponent, targetComponent);
    changedFiles.push(
      "src/components/customers/customer-offer-stock-decision-interceptor.tsx"
    );
  }

  patchWorkflowTypes();
  patchWorkflowBackend();
  patchWorkflowRoute();
  patchCustomersPage();
  verify();

  console.log("\nStok rezervasyon güncellemesi başarıyla uygulandı.\n");
  if (changedFiles.length > 0) {
    console.log("Değiştirilen dosyalar:");
    for (const file of changedFiles) {
      console.log(`  - ${file}`);
    }
  }

  if (warnings.length > 0) {
    console.log("\nBilgi:");
    for (const warning of warnings) {
      console.log(`  - ${warning}`);
    }
  }

  if (fs.existsSync(backupRoot)) {
    console.log(`\nYedek: ${path.relative(root, backupRoot)}`);
  }
  console.log("\nSon kontrol için: npm run build");
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
