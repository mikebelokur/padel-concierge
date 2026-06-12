// Bump this on changes to the SW so `activate` purges the previous cache —
// critical because the old cache could hold a stale index.html pointing at
// asset hashes that no longer exist after a deploy (→ 404 → black screen).
const CACHE = "padel-concierge-v2";
const ASSETS = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) return; // never cache API

  // Navigations (the HTML app shell) MUST be network-first: always fetch the
  // freshest index.html so it references the current build's asset hashes.
  // Cache is only an offline fallback. (Cache-first here served a stale shell
  // after deploys → it requested deleted asset chunks → 404 → black screen.)
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Other same-origin GETs are content-hashed (immutable) assets — cache-first
  // is safe and fast for them.
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res.ok && url.origin === self.location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => cached))
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Padel Concierge", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Padel Concierge";
  const lang = data.lang === "ru" || data.lang === "ar" ? data.lang : "en";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag,
    lang,
    dir: lang === "ar" ? "rtl" : "ltr",
    data: { url: data.url || "/", lang },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        try {
          const u = new URL(c.url);
          if (u.origin === self.location.origin) {
            c.focus();
            if ("navigate" in c) return c.navigate(targetUrl);
            return c.postMessage({ type: "navigate", url: targetUrl });
          }
        } catch {}
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
