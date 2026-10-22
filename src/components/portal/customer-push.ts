import { portalFetch } from "./shared";
export function customerPushSupported() {
  return window.isSecureContext && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}
function applicationKey(value: string): ArrayBuffer {
  const text = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(text, character => character.charCodeAt(0)).buffer;
}
export async function prepareCustomerPush() {
  if (!customerPushSupported()) return null;
  const [{ publicKey }, registration] = await Promise.all([
    portalFetch<{ publicKey: string }>("/api/portal/push-config"),
    navigator.serviceWorker.register("/musteri/push-sw.js", { scope: "/musteri/", updateViaCache: "none" }),
  ]);
  if (!registration.active) {
    const worker = registration.installing ?? registration.waiting;
    if (!worker) throw new Error("Bildirim servisi başlatılamadı.");
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => { worker.removeEventListener("statechange", changed);reject(new Error("Bildirim servisi hazırlanamadı. Tekrar deneyin.")); }, 10000);
      function changed() {
        if (worker!.state === "activated" || worker!.state === "redundant") {
          window.clearTimeout(timer);worker!.removeEventListener("statechange", changed);
          if (worker!.state === "activated") resolve();else reject(new Error("Bildirim servisi başlatılamadı."));
        }
      }
      worker.addEventListener("statechange", changed);changed();
    });
  }
  return { registration, publicKey };
}
export async function customerPushSubscription(prepared: NonNullable<Awaited<ReturnType<typeof prepareCustomerPush>>>) {
  let subscription = await prepared.registration.pushManager.getSubscription();
  const key = applicationKey(prepared.publicKey);
  if (subscription?.options.applicationServerKey && new Uint8Array(subscription.options.applicationServerKey).toString() !== new Uint8Array(key).toString()) {
    await subscription.unsubscribe();subscription = null;
  }
  subscription ??= await prepared.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  return subscription.toJSON();
}
