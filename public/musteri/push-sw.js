/* Customer-only push/click handlers. No page, API or authentication caching. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("push", event => {
  event.waitUntil((async () => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch {}
    await self.registration.showNotification(data.title || "Aksoy Tuning", {
      body: data.body || "Araç isteğinizle ilgili yeni bir gelişme var.",
      icon: "/admin-icon-192.png", badge: "/admin-icon-192.png",
      tag: typeof data.id === "string" ? data.id : "vehicle-request-completed",
      data: { url: "/musteri#arac-sec" },
    });
  })());
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL("/musteri#arac-sec", self.location.origin).href;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      const current = new URL(client.url);
      if (current.origin === self.location.origin && (current.pathname === "/musteri" || current.pathname.startsWith("/musteri/"))) {
        await client.navigate(url);return client.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
