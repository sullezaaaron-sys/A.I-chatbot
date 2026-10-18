const CACHE = "ai-assistant-v2";
const ASSETS = [
  "/manifest.json",
  "/static/chat/style.css",
  "/static/chat/app.js",
  "/static/chat/icon-192.png",
  "/static/chat/icon-512.png",
];
const CDN = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(ASSETS);
      try { await cache.add(new Request(CDN, { mode: "no-cors" })); } catch (e) {}
      try { await cache.add("/"); } catch (e) {}      // page for first offline visit
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;                    // never touch API POSTs
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) return;        // never cache API calls

  if (req.mode === "navigate") {
    // Network first so the CSRF token is always fresh; cached page only when offline
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Static assets: cache first, refresh in background
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok || res.type === "opaque") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
