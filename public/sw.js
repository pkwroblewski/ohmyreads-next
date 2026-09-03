// OhMyReads Service Worker
//
// Caches only what is the same for every reader: hashed build assets, fonts,
// icons, the manifest and the static /offline page. Pages, RSC payloads and
// API responses are never stored — the old worker kept every same-origin 200,
// which on a shared device could hand one reader's dashboard to the next.

const CACHE_NAME = "ohmyreads-v2";
const OFFLINE_URL = "/offline";

// Static assets to cache on install
const PRECACHE = [OFFLINE_URL, "/site.webmanifest", "/icons/icon-192", "/icons/icon-512"];

// Path prefixes whose responses are immutable or reader-independent
const CACHEABLE_PREFIXES = ["/_next/static/", "/icons/", "/images/", "/fonts/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Precache what we can; a missing icon must not block activation.
      Promise.allSettled(PRECACHE.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

function isCacheableAsset(url) {
  return (
    CACHEABLE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)) ||
    url.pathname === "/site.webmanifest"
  );
}

function isPrivateResponse(response) {
  const cacheControl = response.headers.get("cache-control") || "";
  return /\b(private|no-store)\b/i.test(cacheControl);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never touch data: API responses, auth callbacks, and React Server
  // Component payloads (the `_rsc` query or the text/x-component accept type).
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/callback") ||
    url.searchParams.has("_rsc") ||
    (request.headers.get("accept") || "").includes("text/x-component")
  ) {
    return;
  }

  // Navigations: network only, offline page when the network is gone.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match(OFFLINE_URL);
        return (
          offline ||
          new Response("Offline", {
            status: 503,
            statusText: "Service Unavailable",
            headers: { "Content-Type": "text/plain" },
          })
        );
      })
    );
    return;
  }

  if (!isCacheableAsset(url)) return;

  // Static assets: cache first, then network, and keep what the network gave us.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.status === 200 && !isPrivateResponse(response)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
