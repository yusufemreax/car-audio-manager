"use client";

import { useEffect, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

type ReservedStockDecisionValue = "order" | "use_stock";

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

function asNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
    ...(cleanString(source.brand) ? { brand: cleanString(source.brand) } : {}),
    ...(cleanString(source.model) ? { model: cleanString(source.model) } : {}),
    requiredQuantity: Math.max(
      0,
      Math.trunc(asNumber(source.requiredQuantity))
    ),
    availableQuantity: Math.max(
      0,
      Math.trunc(asNumber(source.availableQuantity))
    ),
    reservedQuantity: Math.max(
      0,
      Math.trunc(asNumber(source.reservedQuantity))
    ),
    freeQuantity: Math.max(0, Math.trunc(asNumber(source.freeQuantity))),
    conflictQuantity,
  };
}

function productLabel(conflict: ReservationConflict) {
  const brandModel = [conflict.brand, conflict.model].filter(Boolean).join(" ");

  return (
    brandModel ||
    conflict.productCode ||
    `Ürün ${conflict.productId.slice(-6).toUpperCase()}`
  );
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

  const confirm = () => {
    if (!allSelected) {
      return;
    }

    onConfirm(
      conflicts.map((conflict) => ({
        productId: conflict.productId,
        decision: choices[conflict.productId],
      }))
    );
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reserved-stock-dialog-title"
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border bg-background shadow-2xl"
      >
        <div className="border-b px-5 py-4 sm:px-6">
          <h2
            id="reserved-stock-dialog-title"
            className="text-lg font-semibold tracking-tight"
          >
            Stok başka montajlar için ayrılmış
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Fiziksel stokta görünen aşağıdaki ürünlerin kullanılabilir adedi, montaj
            bekleyen diğer teklifler nedeniyle yetersiz. Her ürün için yeni sipariş
            verip vermeyeceğinizi seçin.
          </p>
        </div>

        <div className="max-h-[62vh] space-y-3 overflow-y-auto p-4 sm:p-6">
          {conflicts.map((conflict) => {
            const selected = choices[conflict.productId];

            return (
              <div
                key={conflict.productId}
                className="rounded-xl border bg-muted/20 p-4"
              >
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
                  <div className="rounded-lg border bg-background px-3 py-2">
                    <div className="text-muted-foreground">Teklif ihtiyacı</div>
                    <div className="mt-0.5 font-semibold">
                      {conflict.requiredQuantity} adet
                    </div>
                  </div>
                  <div className="rounded-lg border bg-background px-3 py-2">
                    <div className="text-muted-foreground">Fiziksel stok</div>
                    <div className="mt-0.5 font-semibold">
                      {conflict.availableQuantity} adet
                    </div>
                  </div>
                  <div className="rounded-lg border bg-background px-3 py-2">
                    <div className="text-muted-foreground">Montaja ayrılmış</div>
                    <div className="mt-0.5 font-semibold">
                      {conflict.reservedQuantity} adet
                    </div>
                  </div>
                  <div className="rounded-lg border bg-background px-3 py-2">
                    <div className="text-muted-foreground">Serbest stok</div>
                    <div className="mt-0.5 font-semibold">
                      {conflict.freeQuantity} adet
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                      selected === "order"
                        ? "border-primary bg-primary/10 ring-1 ring-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                    onClick={() => {
                      setChoices((current) => ({
                        ...current,
                        [conflict.productId]: "order",
                      }));
                    }}
                  >
                    <div className="font-medium">Yeni sipariş ver</div>
                    <div className="mt-1 text-xs leading-4 text-muted-foreground">
                      Ayrılmış stok kullanılmaz. Karar gereken miktar da Sipariş
                      adımına eklenir.
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                      selected === "use_stock"
                        ? "border-primary bg-primary/10 ring-1 ring-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                    onClick={() => {
                      setChoices((current) => ({
                        ...current,
                        [conflict.productId]: "use_stock",
                      }));
                    }}
                  >
                    <div className="font-medium">Stoktaki ürünü kullan</div>
                    <div className="mt-1 text-xs leading-4 text-muted-foreground">
                      Bu ürün için ilave sipariş oluşturulmaz. Fiziksel stok montaj
                      yapılana kadar stok ekranında kalır.
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
            onClick={confirm}
          >
            Seçimleri uygula ve devam et
          </button>
        </div>
      </div>
    </div>
  );
}

function showReservedStockDecisionDialog(
  conflicts: ReservationConflict[]
): Promise<ReservedStockDecision[] | null> {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.dataset.customerOfferStockDecisionDialog = "true";
    document.body.appendChild(host);

    let root: Root | null = createRoot(host);
    let finished = false;

    const finish = (value: ReservedStockDecision[] | null) => {
      if (finished) {
        return;
      }
      finished = true;

      const currentRoot = root;
      root = null;

      // React event tamamlandıktan sonra unmount ederek event-handler içindeki
      // senkron unmount uyarısını da önlüyoruz.
      queueMicrotask(() => {
        currentRoot?.unmount();
        host.remove();
      });

      resolve(value);
    };

    root.render(
      <ReservedStockDecisionDialog
        conflicts={conflicts}
        onCancel={() => finish(null)}
        onConfirm={(decisions) => finish(decisions)}
      />
    );
  });
}

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function isCustomerOfferWorkflowUrl(url: string) {
  try {
    const parsed = new URL(url, window.location.origin);
    return /^\/api\/customer-system-offers\/[^/]+\/workflow\/?$/.test(
      parsed.pathname
    );
  } catch {
    return false;
  }
}

/**
 * CustomersPageClient içindeki mevcut workflow kodunu değiştirmeden, yalnızca
 * start-sale isteğinin ilk cevabında rezervasyon çakışması gelirse kullanıcıdan
 * seçim alır ve aynı isteği seçimlerle tekrar gönderir.
 */
export function useCustomerOfferStockDecisionInterceptor() {
  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);

    const interceptedFetch: typeof window.fetch = async (input, init) => {
      const url = getRequestUrl(input);
      const method = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();

      if (
        method !== "POST" ||
        !isCustomerOfferWorkflowUrl(url) ||
        typeof init?.body !== "string"
      ) {
        return nativeFetch(input, init);
      }

      let requestBody: Record<string, unknown>;
      try {
        requestBody = JSON.parse(init.body) as Record<string, unknown>;
      } catch {
        return nativeFetch(input, init);
      }

      if (
        requestBody.action !== "start-sale" ||
        Array.isArray(requestBody.reservedStockDecisions)
      ) {
        return nativeFetch(input, init);
      }

      const firstResponse = await nativeFetch(input, init);
      if (!firstResponse.ok) {
        return firstResponse;
      }

      let responsePayload: Record<string, unknown> | null = null;
      try {
        responsePayload = (await firstResponse.clone().json()) as Record<
          string,
          unknown
        >;
      } catch {
        return firstResponse;
      }

      const data =
        responsePayload?.data && typeof responsePayload.data === "object"
          ? (responsePayload.data as Record<string, unknown>)
          : null;
      const offer =
        data?.offer && typeof data.offer === "object"
          ? (data.offer as Record<string, unknown>)
          : null;

      const decisionRequired = Boolean(
        data?.stockDecisionRequired ??
          offer?.stockDecisionRequired ??
          responsePayload?.stockDecisionRequired
      );
      const rawConflicts =
        (Array.isArray(data?.reservationConflicts)
          ? data?.reservationConflicts
          : null) ??
        (Array.isArray(offer?.reservationConflicts)
          ? offer?.reservationConflicts
          : null) ??
        (Array.isArray(responsePayload?.reservationConflicts)
          ? responsePayload?.reservationConflicts
          : []);

      const conflicts = rawConflicts
        .map(normalizeConflict)
        .filter((item): item is ReservationConflict => Boolean(item));

      if (!decisionRequired || conflicts.length === 0) {
        return firstResponse;
      }

      const decisions = await showReservedStockDecisionDialog(conflicts);
      if (!decisions) {
        return new Response(
          JSON.stringify({
            error: "Stok tercihi seçilmeden işlem iptal edildi.",
            message: "Stok tercihi seçilmeden işlem iptal edildi.",
          }),
          {
            status: 409,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      }

      const secondBody = {
        ...requestBody,
        reservedStockDecisions: decisions,
      };

      return nativeFetch(url, {
        ...init,
        body: JSON.stringify(secondBody),
      });
    };

    window.fetch = interceptedFetch;

    return () => {
      if (window.fetch === interceptedFetch) {
        window.fetch = nativeFetch;
      }
    };
  }, []);
}
