"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { portalFetch, fullDate } from "@/components/portal/shared";
import { applicationKey, disableAdminPush } from "./notification-client";
interface Notice {
  id: string;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  read: boolean;
}
export function AdminNotifications() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ records: Notice[]; unread: number }>({
    records: [],
    unread: 0,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [key, setKey] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(false);
  const load = useCallback(async () => {
    const result = await portalFetch<{ records: Notice[]; unread: number }>(
      "/api/admin-notifications",
    );
    setData(result);
  }, []);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (document.visibilityState !== "hidden") void load().catch(() => {});
    };
    refresh();
    const interval = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    const prepare = async () => {
      const available =
        window.isSecureContext &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      if (active) setSupported(available);
      if (!available) return;
      try {
        const [{ publicKey }, reg] = await Promise.all([
          portalFetch<{ publicKey: string }>("/api/admin-notifications/push"),
          navigator.serviceWorker.register("/admin-sw.js", {
            scope: "/",
            updateViaCache: "none",
          }),
        ]);
        // Wait for the registration to activate before offering the permission button.
        const ready = reg.active ? reg : await navigator.serviceWorker.ready;
        const subscription = await ready.pushManager.getSubscription();
        if (subscription && Notification.permission === "granted") {
          if (
            subscription.options.applicationServerKey &&
            new Uint8Array(
              subscription.options.applicationServerKey,
            ).toString() !==
              new Uint8Array(applicationKey(publicKey)).toString()
          ) {
            await subscription.unsubscribe();
          } else {
            await portalFetch("/api/admin-notifications/push", {
              method: "POST",
              body: JSON.stringify(subscription.toJSON()),
            });
          }
        }
        if (active) {
          setRegistration(ready);
          setKey(publicKey);
          setEnabled(
            Boolean(await ready.pushManager.getSubscription()) &&
              Notification.permission === "granted",
          );
        }
      } catch {
        if (active)
          setError(
            "Cihaz bildirimi hazırlanamadı. Panel bildirimleri çalışmaya devam eder; sayfayı yenileyip tekrar deneyin.",
          );
      }
    };
    void prepare();
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);
  const markRead = async (id?: string) => {
    try {
      await portalFetch("/api/admin-notifications", {
        method: "POST",
        body: JSON.stringify(id ? { id } : { all: true }),
      });
      await load();
    } catch {
      setError("Bildirim okundu olarak işaretlenemedi.");
    }
  };
  return (
    <>
      <button
        type="button"
        aria-label={`Bildirimler, ${data.unread} okunmamış`}
        className="relative ml-auto inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
        onClick={() => {
          setOpen(true);
          void load().catch(() => setError("Bildirimler yüklenemedi."));
        }}
      >
        <Bell className="size-4" />
        <span className="hidden sm:inline">Bildirimler</span>
        {data.unread > 0 && (
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">
            {data.unread > 99 ? "99+" : data.unread}
          </span>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Bildirimler</DialogTitle>
            <DialogDescription>
              Yeni müşteri randevuları ve araç istekleri burada görünür.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            <div className="space-y-3 rounded-xl border p-4">
              <p className="text-sm font-medium">
                Bu cihazdaki web bildirimleri: {enabled ? "Açık" : "Kapalı"}
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                iPhone / iPad’de admin panelini HTTPS üzerinden açıp ana ekrana
                ekleyin. Ardından ana ekran simgesinden açarak aşağıdaki
                düğmeyle bildirim izni verin.
              </p>
              {!supported ? (
                <p className="text-xs text-muted-foreground">
                  Bu tarayıcıda cihaz bildirimi kullanılamıyor. Panel içindeki
                  bildirim listesi kullanılabilir.
                </p>
              ) : (
                <Button
                  size="sm"
                  variant={enabled ? "outline" : "default"}
                  disabled={busy || (!enabled && (!registration || !key))}
                  onClick={async () => {
                    setError("");
                    setBusy(true);
                    try {
                      if (enabled) {
                        await disableAdminPush();
                        setEnabled(false);
                      } else {
                        const permission =
                          Notification.permission === "granted"
                            ? "granted"
                            : await Notification.requestPermission();
                        if (permission !== "granted")
                          throw new Error(
                            "Bildirim izni verilmedi. İzin engellendiyse cihaz / tarayıcı ayarlarından açın.",
                          );
                        if (!registration)
                          throw new Error(
                            "Cihaz henüz hazır değil. Sayfayı yenileyin.",
                          );
                        const subscription =
                          await registration.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: applicationKey(key),
                          });
                        await portalFetch("/api/admin-notifications/push", {
                          method: "POST",
                          body: JSON.stringify(subscription.toJSON()),
                        });
                        setEnabled(true);
                      }
                    } catch (error) {
                      setError(
                        error instanceof Error
                          ? error.message
                          : "Cihaz bildirimi ayarlanamadı.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy
                    ? "İşleniyor..."
                    : enabled
                      ? "Bu cihazda kapat"
                      : "Bildirimleri aç"}
                </Button>
              )}
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-between gap-3 text-sm">
              <span>{data.unread} okunmamış</span>
              <button
                type="button"
                disabled={!data.unread}
                onClick={() => {
                  void markRead();
                }}
                className="font-medium underline disabled:opacity-40"
              >
                Tümünü okundu işaretle
              </button>
            </div>
            {!data.records.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Henüz bildirim yok.
              </p>
            ) : (
              data.records.map((notice) => (
                <Link
                  key={notice.id}
                  href={notice.url}
                  onClick={() => {
                    void markRead(notice.id);
                    setOpen(false);
                  }}
                  className={`block rounded-xl border p-4 ${notice.read ? "" : "border-amber-300 bg-amber-50 text-slate-950"}`}
                >
                  <p className="font-semibold">{notice.title}</p>
                  <p className="mt-1 text-sm">{notice.body}</p>
                  <p className="mt-2 text-xs opacity-60">
                    {fullDate(notice.createdAt)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
