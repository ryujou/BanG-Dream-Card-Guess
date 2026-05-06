const CACHE_NAME = "bangbangcai-v16";
const PRECACHE_URLS = [
  "/",
  "/player",
  "/note-shooter",
  "/note-shooter/bangdream.html",
  "/scores",
  "/solo",
  "/login",
  "/host",
  "/settings",
  "/qr",
  "/manifest.webmanifest",
  "/bg/bg_pattern_logo_pc.webp",
  "/bg/bg_pattern_logo_sp.webp",
  "/bg/bg_pattern_texture_pc.webp",
  "/bg/bg_pattern_texture_sp.webp",
  "/bg/monkey.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/note-shooter-api/") || url.pathname === "/ws") return;

  if (request.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname === "/note-shooter") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && url.origin === location.origin) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok && url.origin === location.origin) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
