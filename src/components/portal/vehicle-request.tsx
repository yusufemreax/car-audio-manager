"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PortalButton, PortalMessage, fieldClass, portalFetch } from "./shared";
function requestKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function VehicleRequestButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState("");
  const [form, setForm] = useState({
    brand: "",
    model: "",
    year: "",
    generation: "",
  });
  return (
    <>
      <button
        type="button"
        className="text-sm font-bold text-amber-700 underline underline-offset-4 hover:text-amber-900"
        onClick={() => {
          setForm({ brand: "", model: "", year: "", generation: "" });
          setRequestId(requestKey());
          setSent(false);
          setError("");
          setOpen(true);
        }}
      >
        Aracımı bulamadım
      </button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden p-0 sm:max-w-lg">
          <form
            className="flex min-h-0 flex-col"
            onSubmit={async (event) => {
              event.preventDefault();
              event.stopPropagation();
              if (busy || sent) return;
              setBusy(true);
              setError("");
              try {
                await portalFetch("/api/portal/vehicle-requests", {
                  method: "POST",
                  body: JSON.stringify({
                    ...form,
                    year: Number(form.year),
                    requestId,
                  }),
                });
                setSent(true);
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Talep gönderilemedi.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <DialogHeader className="shrink-0 px-6 pt-6 pr-12">
              <DialogTitle>Aracımı bulamadım</DialogTitle>
              <DialogDescription>
                Aracınızın bilgilerini yazarak bize iletin. Talebinizi
                inceleyelim.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {sent ? (
                <PortalMessage>
                  Talebiniz iletildi. Araç bilgilerinizi inceleyeceğiz.
                </PortalMessage>
              ) : (
                <>
                  {(
                    [
                      ["brand", "Marka", "Örn. Honda"],
                      ["model", "Model", "Örn. Jazz"],
                      ["year", "Yıl", "Örn. 2006"],
                      ["generation", "Kasa bilgisi (isteğe bağlı)", "Örn. GD"],
                    ] as const
                  ).map(([key, label, placeholder]) => (
                    <label
                      key={key}
                      className="block space-y-2 text-sm font-semibold"
                    >
                      {label}
                      <input
                        className={fieldClass}
                        type={key === "year" ? "number" : "text"}
                        required={key !== "generation"}
                        disabled={busy}
                        min={key === "year" ? 1900 : undefined}
                        max={
                          key === "year"
                            ? new Date().getFullYear() + 1
                            : undefined
                        }
                        step={key === "year" ? 1 : undefined}
                        maxLength={100}
                        placeholder={placeholder}
                        value={form[key]}
                        onChange={(event) =>
                          setForm({ ...form, [key]: event.target.value })
                        }
                      />
                    </label>
                  ))}
                  <p className="text-xs leading-5 text-slate-500">
                    Bu form araç ekleme talebidir. Randevu veya fiyat teklifi
                    oluşturmaz.
                  </p>
                </>
              )}
              {error && <PortalMessage error>{error}</PortalMessage>}
            </div>
            <DialogFooter className="shrink-0 border-t px-6 py-4">
              <PortalButton
                type="button"
                secondary
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                {sent ? "Kapat" : "Vazgeç"}
              </PortalButton>
              {!sent && (
                <PortalButton type="submit" disabled={busy}>
                  {busy ? "Gönderiliyor..." : "Talebi gönder"}
                </PortalButton>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
