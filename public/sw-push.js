// Push notifications for the admin. Registered only from within the installed
// home-screen app (see components/admin/PushNotifications.tsx) — iOS Safari
// refuses Notification permission from an ordinary browser tab, so this file
// is inert until she has actually added the admin to her home screen.

self.addEventListener("push", (event) => {
  let payload = { title: "VIS Lashes", body: "" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url || "/admin/bookings" },
    })
  );
});

// Tapping the notification focuses an already-open admin tab rather than
// stacking a new one, and falls back to opening it if none is open.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/admin";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes("/admin") && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
