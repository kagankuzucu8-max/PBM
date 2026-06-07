const CACHE_NAME = "pbm-shell-v1";
const SHELL_ASSETS = ["/", "/index.html", "/manifest.json", "/pbm-icon-192.png"];
const FIREBASE_CONFIG = /*__PBM_FIREBASE_CONFIG__*/ {};

if (FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.messagingSenderId && FIREBASE_CONFIG.appId) {
  importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");
  firebase.initializeApp(FIREBASE_CONFIG);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const notification = payload.notification || {};
    const data = payload.data || {};
    if (notification.title) return;
    self.registration.showNotification(notification.title || "PBM Market Drop", {
      body: notification.body || "A new PBM market update is available.",
      icon: notification.icon || "/pbm-icon-192.png",
      badge: "/pbm-icon-192.png",
      image: notification.image,
      tag: data.post_id || data.type || "pbm-market-drop",
      data: { href: data.href || "/social" },
    });
  });
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((cached) => cached || caches.match("/index.html")),
    ),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification?.data?.href || "/social";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      if (existing) {
        existing.navigate(href);
        return existing.focus();
      }
      return self.clients.openWindow(href);
    }),
  );
});
