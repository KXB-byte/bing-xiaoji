const CACHE_NAME = "xiaoji-v37";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./sync.js",
  "./app.js",
  "./supabase-schema.sql",
  "./supabase-reminder-cron.sql",
  "./manifest.webmanifest",
  "./icons/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: "reload" })))
      )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === "opaque") return response;
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch (error) {
    console.error("无法解析冰小记通知内容", error);
  }
  const title = typeof data.title === "string" ? data.title : "冰小记提醒";
  const body = typeof data.body === "string" ? data.body : "有事项即将开始";
  const itemId = typeof data.itemId === "string" ? data.itemId : "";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "./icons/icon.svg",
      badge: "./icons/icon.svg",
      tag: itemId ? `xiaoji-reminder-${itemId}` : "xiaoji-reminder",
      renotify: false,
      data: {
        itemId,
        date: typeof data.date === "string" ? data.date : "",
        url: "./"
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      if (existing) {
        existing.postMessage({
          type: "OPEN_REMINDER",
          itemId: event.notification.data?.itemId || "",
          date: event.notification.data?.date || ""
        });
        return existing.focus();
      }
      return self.clients.openWindow(event.notification.data?.url || "./");
    })
  );
});
