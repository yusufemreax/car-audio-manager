"use client";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PortalButton, PortalMessage, fieldClass, portalFetch } from "./shared";
import { customerPushSupported, prepareCustomerPush, customerPushSubscription } from "./customer-push";
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
  const [notificationStep, setNotificationStep] = useState(false);
  const [supported, setSupported] = useState(false);
  const [prepared, setPrepared] = useState<Awaited<ReturnType<typeof prepareCustomerPush>>>(null);
  const [subscription, setSubscription] = useState<PushSubscriptionJSON | null>(null);
  useEffect(() => {
    if (!open) return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setSupported(customerPushSupported());
      try {
        const ready = await prepareCustomerPush();
        if (!active) return;
        setPrepared(ready);
        if (ready && Notification.permission === "granted") {
          const existing = await customerPushSubscription(ready);
          if (active) setSubscription(existing);
        }
      } catch { /* Request submission remains available even when push setup fails. */ }
    });
    return () => { active = false; };
  }, [open]);
  async function sendRequest(push: PushSubscriptionJSON | null) {
    setBusy(true);setError("");
    try {
      await portalFetch("/api/portal/vehicle-requests", { method: "POST", body: JSON.stringify({ ...form, year: Number(form.year), requestId, ...(push ? { pushSubscription: push } : {}) }) });
      setSubscription(push);setSent(true);setNotificationStep(false);
    } catch(error) { setError(error instanceof Error ? error.message : "Talep gönderilemedi."); }
    finally { setBusy(false); }
  }
  return (
    <>
      <button
        type="button"
        className="text-sm font-bold text-amber-700 underline underline-offset-4 hover:text-amber-900"
        onClick={() => {
          setForm({ brand: "", model: "", year: "", generation: "" });
          setRequestId(requestKey());
          setSent(false);
          setNotificationStep(false);setPrepared(null);setSubscription(null);
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
              if (!subscription) { setError("");setNotificationStep(true);return; }
              await sendRequest(subscription);
            }}
          >
            <DialogHeader className="shrink-0 px-6 pt-6 pr-12">
              <DialogTitle>{notificationStep ? "Aracınız eklenince haber verelim" : "Aracımı bulamadım"}</DialogTitle>
              <DialogDescription>
                {notificationStep ? "Araç isteğiniz tamamlanınca size bildirim göndereceğiz. Bu cihazda bildirimleri açabilirsiniz." : "Aracınızın bilgilerini yazarak bize iletin. Talebinizi inceleyelim."}
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {sent ? (
                <PortalMessage>
                  Talebiniz iletildi. Araç bilgilerinizi inceleyeceğiz. {subscription ? "İsteğiniz tamamlandığında bu cihaza bildirim göndereceğiz." : "Bu talep için cihaz bildirimi açılmadı."}
                </PortalMessage>
              ) : notificationStep ? (
                <div className="space-y-3 rounded-xl bg-amber-50 p-4 text-sm leading-6">
                  <p>İzin penceresinde “İzin ver” seçeneğini seçin. Bildirim sizi araç seçim sayfasına götürecek.</p>
                  {!supported && <p>Bu tarayıcı cihaz bildirimini desteklemiyor. iPhone / iPad kullanıyorsanız siteyi Safari’den ana ekrana ekleyip ana ekran simgesinden açın.</p>}
                  {supported && Notification.permission === "denied" && <p>Bildirim izni kapalı. Tarayıcı / cihaz ayarlarından bu site için izni açıp tekrar deneyebilirsiniz.</p>}
                  <p className="text-xs text-slate-600">Bildirim izni isteğe bağlıdır; izin vermeden de araç isteğinizi gönderebilirsiniz.</p>
                </div>
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
            <DialogFooter className="shrink-0 flex-wrap border-t px-6 py-4">
              <PortalButton
                type="button"
                secondary
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                {sent ? "Kapat" : "Vazgeç"}
              </PortalButton>
              {!sent && notificationStep && <>
                <PortalButton type="button" secondary disabled={busy} onClick={() => { void sendRequest(null); }}>Bildirimsiz gönder</PortalButton>
                {supported && Notification.permission !== "denied" && <PortalButton type="button" disabled={busy} onClick={async () => {
                  if (busy) return;
                  // Ask before any await: Safari requires a direct user gesture.
                  const permission = Notification.requestPermission();
                  setBusy(true);setError("");
                  try {
                    if (await permission !== "granted") throw new Error("Bildirim izni verilmedi. İsterseniz bildirimsiz gönderebilirsiniz.");
                    const ready = prepared ?? await prepareCustomerPush();
                    if (!ready) throw new Error("Bu cihazda bildirim açılamadı.");
                    const push = await customerPushSubscription(ready);
                    await sendRequest(push);
                  } catch(error) { setError(error instanceof Error ? error.message : "Bildirim açılamadı.");setBusy(false); }
                }}>{busy ? "Gönderiliyor..." : "Bildirimleri aç ve gönder"}</PortalButton>}
              </>}
              {!sent && !notificationStep && (
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
