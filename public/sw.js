/*
 * my market service worker — hand-written, no Workbox.
 *   precache:                /offline.html + its font and icon
 *   stale-while-revalidate:  /_next/static/* (hashed, immutable) and product image renditions (/api/files/*)
 *   network-first:           HTML navigations, falling back to the cached page, then the Kurdish offline page
 *   never touched:           /api/* (except image renditions), any non-GET (dashboard server actions, checkout),
 *                            /dashboard and checkout/cart/order pages are network-only (never stored)
 * Bump VERSION to drop old caches on deploy-incompatible changes.
 */
const VERSION = "v1";
const PRECACHE = `mm-precache-${VERSION}`;
const STATIC = `mm-static-${VERSION}`;
const IMAGES = `mm-img-${VERSION}`;
const PAGES = `mm-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [OFFLINE_URL, "/fonts/vazirmatn-arabic.woff2", "/icons/icon-192.png", "/icon.svg"];
const MAX_IMAGES = 120;
const MAX_PAGES = 30;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PRECACHE).then((c) => c.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  const keep = new Set([PRECACHE, STATIC, IMAGES, PAGES]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("mm-") && !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Pages whose HTML is personal or transactional: always from the network, never stored. */
function isPrivatePage(path) {
  return (
    path.startsWith("/dashboard") ||
    path.startsWith("/onboarding") ||
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/reset-password") ||
    /\/(cart|checkout|order)(\/|$)/.test(path)
  );
}

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function staleWhileRevalidate(event, cacheName, max) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(event.request);
  const network = fetch(event.request)
    .then(async (res) => {
      if (res.ok && res.type === "basic") {
        await cache.put(event.request, res.clone());
        if (max) await trim(cacheName, max);
      }
      return res;
    })
    .catch(() => undefined);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return (await network) ?? Response.error();
}

async function networkFirstPage(event, store) {
  try {
    const res = await fetch(event.request);
    if (store && res.ok && res.type === "basic" && !res.headers.get("Cache-Control")?.includes("no-store")) {
      const cache = await caches.open(PAGES);
      await cache.put(event.request, res.clone());
      event.waitUntil(trim(PAGES, MAX_PAGES));
    }
    return res;
  } catch {
    if (store) {
      const cached = await (await caches.open(PAGES)).match(event.request);
      if (cached) return cached;
    }
    return (await caches.match(OFFLINE_URL)) ?? Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // server actions, checkout, uploads: straight to the network
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;

  if (path.startsWith("/_next/static/") || path.startsWith("/fonts/") || path.startsWith("/icons/")) {
    event.respondWith(staleWhileRevalidate(event, STATIC));
    return;
  }
  if (/^\/api\/files\/stores\/[0-9a-f-]{36}\/[0-9a-f-]{36}-\d{2,5}\.webp$/.test(path) || path.startsWith("/images/")) {
    event.respondWith(staleWhileRevalidate(event, IMAGES, MAX_IMAGES));
    return;
  }
  if (path.startsWith("/api/")) return;
  // RSC payloads (client navigations) carry the RSC header; let the router handle failures itself.
  if (req.mode === "navigate" && !req.headers.get("RSC")) {
    event.respondWith(networkFirstPage(event, !isPrivatePage(path)));
  }
});

/* ---- New-order push notifications (seller dashboard) ------------------------------------------------------ */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "فرۆشگاکەم", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "فرۆشگاکەم";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/maskable-192.png",
      dir: data.dir || "rtl",
      lang: data.lang || "ckb",
      tag: data.tag,
      data: { url: data.url || "/dashboard/orders" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/dashboard/orders", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin) && "focus" in w) {
          w.navigate(target);
          return w.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
