const CACHE_NAME = "big-papas-menu-board-v1";
const SHELL = [
  "/menu-board/",
  "/menu-board/board.css",
  "/menu-board/board.js",
  "/menu-board/manifest.webmanifest",
  "/images/big-papas-logo.webp",
  "/images/big-hoss-hero.webp",
  "/images/menu-board-icon-192.webp",
  "/images/menu-board-icon-512.webp",
  "/favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/menu-board/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((response) => response || caches.match("/menu-board/"))),
  );
});
