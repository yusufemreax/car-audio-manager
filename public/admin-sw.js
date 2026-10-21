/* Only push/click handlers: admin HTML and API responses are never cached. */
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data = {};
      try {
        data = event.data ? event.data.json() : {};
      } catch {}
      const url = ["/customer-appointments", "/vehicle-requests"].includes(
        data.url,
      )
        ? data.url
        : "/";
      await self.registration.showNotification(data.title || "Aksoy Tuning", {
        body: data.body || "Admin panelinde yeni bir bildirim var.",
        icon: "/admin-icon-192.png",
        badge: "/admin-icon-192.png",
        tag: typeof data.id === "string" ? data.id : "admin-notice",
        data: { url },
      });
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const path = ["/customer-appointments", "/vehicle-requests"].includes(
        event.notification.data?.url,
      )
        ? event.notification.data.url
        : "/";
      const url = new URL(path, self.location.origin).href;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        const current = new URL(client.url);
        if (
          current.origin === self.location.origin &&
          !current.pathname.startsWith("/musteri")
        ) {
          await client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
