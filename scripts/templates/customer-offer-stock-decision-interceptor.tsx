"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createRoot,
  type Root,
} from "react-dom/client";

type ReservedStockDecisionValue =
  | "order"
  | "use_stock";

interface ReservedStockDecision {
  productId: string;
  decision: ReservedStockDecisionValue;
}

interface ReservationConflict {
  productId: string;
  productCode?: string;
  brand?: string;
  model?: string;
  requiredQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  freeQuantity: number;
  conflictQuantity: number;
}

interface UnavailableProduct {
  productId: string;
  productCode?: string;
  brand?: string;
  model?: string;
  missingQuantity?: number;
}

interface ApiProduct {
  id: string;
  productCode?: string;
  brand?: string;
  model?: string;
  sourceUnavailable?: boolean;
}

interface ReadySystemItem {
  productId?: string;
}

interface ReadySystem {
  id: string;
  items?: ReadySystemItem[];
}

function asNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function productLabel(product: UnavailableProduct) {
  const brandModel = [product.brand, product.model]
    .filter(Boolean)
    .join(" ");

  return (
    brandModel ||
    product.productCode ||
    `Ürün ${product.productId.slice(-6).toUpperCase()}`
  );
}

function normalizeConflict(value: unknown): ReservationConflict | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const productId = cleanString(source.productId);
  if (!productId) {
    return null;
  }

  const conflictQuantity = Math.max(
    0,
    Math.trunc(asNumber(source.conflictQuantity))
  );

  if (conflictQuantity <= 0) {
    return null;
  }

  return {
    productId,
    ...(cleanString(source.productCode)
      ? { productCode: cleanString(source.productCode) }
      : {}),
    ...(cleanString(source.brand)
      ? { brand: cleanString(source.brand) }
      : {}),
    ...(cleanString(source.model)
      ? { model: cleanString(source.model) }
      : {}),
    requiredQuantity: Math.max(0, Math.trunc(asNumber(source.requiredQuantity))),
    availableQuantity: Math.max(0, Math.trunc(asNumber(source.availableQuantity))),
    reservedQuantity: Math.max(0, Math.trunc(asNumber(source.reservedQuantity))),
    freeQuantity: Math.max(0, Math.trunc(asNumber(source.freeQuantity))),
    conflictQuantity,
  };
}

function normalizeUnavailableProduct(value: unknown): UnavailableProduct | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const productId = cleanString(source.productId ?? source.id);
  if (!productId) {
    return null;
  }

  const missingQuantity = Math.max(
    0,
    Math.trunc(asNumber(source.missingQuantity))
  );

  return {
    productId,
    ...(cleanString(source.productCode)
      ? { productCode: cleanString(source.productCode) }
      : {}),
    ...(cleanString(source.brand)
      ? { brand: cleanString(source.brand) }
      : {}),
    ...(cleanString(source.model)
      ? { model: cleanString(source.model) }
      : {}),
    ...(missingQuantity > 0
      ? { missingQuantity }
      : {}),
  };
}

function ReservedStockDecisionDialog({
  conflicts,
  onCancel,
  onConfirm,
}: {
  conflicts: ReservationConflict[];
  onCancel: () => void;
  onConfirm: (decisions: ReservedStockDecision[]) => void;
}) {
  const [choices, setChoices] = useState<
    Record<string, ReservedStockDecisionValue>
  >({});

  const allSelected = useMemo(
    () => conflicts.every((conflict) => Boolean(choices[conflict.productId])),
    [choices, conflicts]
  );

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border bg-background shadow-2xl"
      >
        <div className="border-b px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight">
            Stok başka montajlar için ayrılmış
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Fiziksel stokta görünen aşağıdaki ürünlerin serbest adedi montaj
            bekleyen diğer teklifler nedeniyle yetersiz. Her ürün için karar verin.
          </p>
        </div>

        <div className="max-h-[62vh] space-y-3 overflow-y-auto p-4 sm:p-6">
          {conflicts.map((conflict) => {
            const selected = choices[conflict.productId];

            return (
              <div key={conflict.productId} className="rounded-xl border bg-muted/20 p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div>
                    <div className="font-medium">{productLabel(conflict)}</div>
                    {conflict.productCode ? (
                      <div className="text-xs text-muted-foreground">
                        Kod: {conflict.productCode}
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                    {conflict.conflictQuantity} adet için karar gerekli
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <InfoBox label="Teklif ihtiyacı" value={`${conflict.requiredQuantity} adet`} />
                  <InfoBox label="Fiziksel stok" value={`${conflict.availableQuantity} adet`} />
                  <InfoBox label="Montaja ayrılmış" value={`${conflict.reservedQuantity} adet`} />
                  <InfoBox label="Serbest stok" value={`${conflict.freeQuantity} adet`} />
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                      selected === "order"
                        ? "border-primary bg-primary/10 ring-1 ring-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                    onClick={() =>
                      setChoices((current) => ({
                        ...current,
                        [conflict.productId]: "order",
                      }))
                    }
                  >
                    <div className="font-medium">Yeni sipariş ver</div>
                    <div className="mt-1 text-xs leading-4 text-muted-foreground">
                      Ayrılmış stok kullanılmaz; gereken miktar Sipariş adımına eklenir.
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                      selected === "use_stock"
                        ? "border-primary bg-primary/10 ring-1 ring-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                    onClick={() =>
                      setChoices((current) => ({
                        ...current,
                        [conflict.productId]: "use_stock",
                      }))
                    }
                  >
                    <div className="font-medium">Stoktaki ürünü kullan</div>
                    <div className="mt-1 text-xs leading-4 text-muted-foreground">
                      Bu ürün için ilave sipariş oluşturulmaz.
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t bg-muted/20 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            className="rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            onClick={onCancel}
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={!allSelected}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              if (!allSelected) return;
              onConfirm(
                conflicts.map((conflict) => ({
                  productId: conflict.productId,
                  decision: choices[conflict.productId],
                }))
              );
            }}
          >
            Seçimleri uygula ve devam et
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-semibold">{value}</div>
    </div>
  );
}

function UnavailableProductsDialog({
  title,
  description,
  products,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  products: UnavailableProduct[];
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border bg-background shadow-2xl"
      >
        <div className="border-b px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {description}
          </p>
        </div>

        <div className="max-h-[58vh] space-y-2 overflow-y-auto p-4 sm:p-6">
          {products.map((product) => (
            <div
              key={product.productId}
              className="flex items-start justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"
            >
              <div>
                <div className="font-medium">{productLabel(product)}</div>
                {product.productCode ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Kod: {product.productCode}
                  </div>
                ) : null}
              </div>
              <div className="shrink-0 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                {product.missingQuantity
                  ? `${product.missingQuantity} adet sipariş gerekli`
                  : "EGB sayfası 404"}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t bg-muted/20 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            className="rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            onClick={onCancel}
          >
            Vazgeç
          </button>
          <button
            type="button"
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function renderDialog<T>(render: (finish: (value: T) => void) => ReactNode) {
  return new Promise<T>((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    let root: Root | null = createRoot(host);
    let finished = false;

    const finish = (value: T) => {
      if (finished) return;
      finished = true;
      const currentRoot = root;
      root = null;
      queueMicrotask(() => {
        currentRoot?.unmount();
        host.remove();
      });
      resolve(value);
    };

    root.render(render(finish));
  });
}

function showReservedStockDecisionDialog(conflicts: ReservationConflict[]) {
  return renderDialog<ReservedStockDecision[] | null>((finish) => (
    <ReservedStockDecisionDialog
      conflicts={conflicts}
      onCancel={() => finish(null)}
      onConfirm={(decisions) => finish(decisions)}
    />
  ));
}

function showUnavailableProductsDialog(
  products: UnavailableProduct[],
  mode: "offer" | "order"
) {
  return renderDialog<boolean>((finish) => (
    <UnavailableProductsDialog
      products={products}
      title={
        mode === "offer"
          ? "Teklifte satışta olmayan ürün var"
          : "Sipariş verilemeyebilecek ürün var"
      }
      description={
        mode === "offer"
          ? "Aşağıdaki ürünlerin EGB ürün sayfası son kontrolde 404 döndü. Ürün artık satışta olmayabilir. Teklifi yine de oluşturabilirsiniz."
          : "Stokta eksik olan aşağıdaki ürünlerin EGB ürün sayfası son kontrolde 404 döndü. Bu ürünlerin tedarik edilemeyebileceğini kontrol edin."
      }
      confirmLabel={
        mode === "offer"
          ? "Yine de teklifi oluştur"
          : "Yine de Siparişe geç"
      }
      onCancel={() => finish(false)}
      onConfirm={() => finish(true)}
    />
  ));
}

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function pathNameOf(url: string) {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return "";
  }
}

function isCustomerOfferWorkflowUrl(url: string) {
  return /^\/api\/customer-system-offers\/[^/]+\/workflow\/?$/.test(
    pathNameOf(url)
  );
}

function isCreateCustomerOfferUrl(url: string) {
  return /^\/api\/customer-system-offers\/?$/.test(pathNameOf(url));
}

function collectStringValues(value: unknown, output = new Set<string>()) {
  if (typeof value === "string") {
    const cleaned = value.trim();
    if (cleaned) output.add(cleaned);
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStringValues(item, output));
    return output;
  }

  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) =>
      collectStringValues(item, output)
    );
  }

  return output;
}

function collectExplicitProductIds(value: unknown, output = new Set<string>()) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectExplicitProductIds(item, output));
    return output;
  }

  if (!value || typeof value !== "object") return output;

  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key === "productId" && typeof item === "string" && item.trim()) {
      output.add(item.trim());
    }
    collectExplicitProductIds(item, output);
  }

  return output;
}

async function readJson(nativeFetch: typeof window.fetch, url: string) {
  const response = await nativeFetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function getUnavailableProductsForNewOffer(
  nativeFetch: typeof window.fetch,
  requestBody: Record<string, unknown>
): Promise<UnavailableProduct[]> {
  const [productsPayload, readySystemsPayload] = await Promise.all([
    readJson(nativeFetch, "/api/products"),
    readJson(nativeFetch, "/api/system-preparations?status=ready"),
  ]);

  const products = Array.isArray(productsPayload?.data)
    ? (productsPayload?.data as ApiProduct[])
    : [];
  const readySystems = Array.isArray(readySystemsPayload?.data)
    ? (readySystemsPayload?.data as ReadySystem[])
    : [];

  const productIds = collectExplicitProductIds(requestBody);

  if (productIds.size === 0) {
    const requestStrings = collectStringValues(requestBody);
    const selectedSystem = readySystems.find(
      (system) => cleanString(system.id) && requestStrings.has(cleanString(system.id))
    );

    selectedSystem?.items?.forEach((item) => {
      const productId = cleanString(item.productId);
      if (productId) productIds.add(productId);
    });
  }

  if (productIds.size === 0) return [];

  return products
    .filter(
      (product) =>
        product.sourceUnavailable === true && productIds.has(cleanString(product.id))
    )
    .map((product) => ({
      productId: cleanString(product.id),
      ...(cleanString(product.productCode)
        ? { productCode: cleanString(product.productCode) }
        : {}),
      ...(cleanString(product.brand) ? { brand: cleanString(product.brand) } : {}),
      ...(cleanString(product.model) ? { model: cleanString(product.model) } : {}),
    }));
}

function cancelledResponse(message: string) {
  return new Response(
    JSON.stringify({
      success: false,
      message,
    }),
    {
      status: 409,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

function parseResponseDecisionData(payload: Record<string, unknown> | null) {
  const data =
    payload?.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : null;
  const nestedOffer =
    data?.offer && typeof data.offer === "object"
      ? (data.offer as Record<string, unknown>)
      : null;

  return { data, nestedOffer };
}

async function processStartSaleRequest(
  nativeFetch: typeof window.fetch,
  url: string,
  init: RequestInit,
  requestBody: Record<string, unknown>,
  depth = 0
): Promise<Response> {
  if (depth > 4) {
    return cancelledResponse("Teklif kontrol adımları tamamlanamadı.");
  }

  const response = await nativeFetch(url, {
    ...init,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) return response;

  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await response.clone().json()) as Record<string, unknown>;
  } catch {
    return response;
  }

  const { data, nestedOffer } = parseResponseDecisionData(payload);

  const stockDecisionRequired = Boolean(
    data?.stockDecisionRequired ??
      nestedOffer?.stockDecisionRequired ??
      payload?.stockDecisionRequired
  );

  const rawConflicts =
    (Array.isArray(data?.reservationConflicts) ? data?.reservationConflicts : null) ??
    (Array.isArray(nestedOffer?.reservationConflicts)
      ? nestedOffer?.reservationConflicts
      : null) ??
    (Array.isArray(payload?.reservationConflicts)
      ? payload?.reservationConflicts
      : []);

  const conflicts = rawConflicts
    .map(normalizeConflict)
    .filter((item): item is ReservationConflict => Boolean(item));

  if (stockDecisionRequired && conflicts.length > 0) {
    const decisions = await showReservedStockDecisionDialog(conflicts);
    if (!decisions) {
      return cancelledResponse("Stok tercihi seçilmeden işlem iptal edildi.");
    }

    return processStartSaleRequest(
      nativeFetch,
      url,
      init,
      {
        ...requestBody,
        reservedStockDecisions: decisions,
      },
      depth + 1
    );
  }

  const unavailableConfirmationRequired = Boolean(
    data?.unavailableOrderConfirmationRequired ??
      nestedOffer?.unavailableOrderConfirmationRequired ??
      payload?.unavailableOrderConfirmationRequired
  );

  const rawUnavailable =
    (Array.isArray(data?.unavailableOrderProducts)
      ? data?.unavailableOrderProducts
      : null) ??
    (Array.isArray(nestedOffer?.unavailableOrderProducts)
      ? nestedOffer?.unavailableOrderProducts
      : null) ??
    (Array.isArray(payload?.unavailableOrderProducts)
      ? payload?.unavailableOrderProducts
      : []);

  const unavailableProducts = rawUnavailable
    .map(normalizeUnavailableProduct)
    .filter((item): item is UnavailableProduct => Boolean(item));

  if (unavailableConfirmationRequired && unavailableProducts.length > 0) {
    const continueOrder = await showUnavailableProductsDialog(
      unavailableProducts,
      "order"
    );

    if (!continueOrder) {
      return cancelledResponse("Satış, tedarik edilemeyebilecek ürün kontrolünde iptal edildi.");
    }

    return processStartSaleRequest(
      nativeFetch,
      url,
      init,
      {
        ...requestBody,
        confirmUnavailableOrderProducts: true,
      },
      depth + 1
    );
  }

  return response;
}

/**
 * Müşteri tekliflerinde iki güvenlik kontrolünü mevcut ekranları bozmadan ekler:
 * 1) Montaj rezervasyon stok kararı.
 * 2) 404 ile satışta değil işaretlenen ürünler için teklif/sipariş uyarısı.
 */
export function useCustomerOfferStockDecisionInterceptor() {
  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);

    const interceptedFetch: typeof window.fetch = async (input, init) => {
      const url = getRequestUrl(input);
      const method = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();

      if (method !== "POST" || typeof init?.body !== "string") {
        return nativeFetch(input, init);
      }

      let requestBody: Record<string, unknown>;
      try {
        requestBody = JSON.parse(init.body) as Record<string, unknown>;
      } catch {
        return nativeFetch(input, init);
      }

      if (isCreateCustomerOfferUrl(url)) {
        if (requestBody.confirmUnavailableProducts === true) {
          return nativeFetch(input, init);
        }

        try {
          const unavailableProducts = await getUnavailableProductsForNewOffer(
            nativeFetch,
            requestBody
          );

          if (unavailableProducts.length > 0) {
            const continueOffer = await showUnavailableProductsDialog(
              unavailableProducts,
              "offer"
            );

            if (!continueOffer) {
              return cancelledResponse(
                "Teklif, satışta olmayan ürün kontrolünde iptal edildi."
              );
            }

            return nativeFetch(url, {
              ...init,
              body: JSON.stringify({
                ...requestBody,
                confirmUnavailableProducts: true,
              }),
            });
          }
        } catch (error) {
          console.warn("Teklif ürün uygunluk kontrolü çalıştırılamadı:", error);
        }

        return nativeFetch(input, init);
      }

      if (
        isCustomerOfferWorkflowUrl(url) &&
        requestBody.action === "start-sale"
      ) {
        return processStartSaleRequest(
          nativeFetch,
          url,
          init,
          requestBody
        );
      }

      return nativeFetch(input, init);
    };

    window.fetch = interceptedFetch;

    return () => {
      if (window.fetch === interceptedFetch) {
        window.fetch = nativeFetch;
      }
    };
  }, []);
}
