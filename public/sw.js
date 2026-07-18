/**
 * SotsiaalAI service worker — FIELD-V1 offline shell (doc ptk 4.10 contract).
 *
 * HARD CONTRACT:
 *  1. No "/api/" response is EVER cached or served from a cache. The guard
 *     below runs before any caching logic; the sync layer owns all data and
 *     stores it in the encrypted per-user IndexedDB partition, never in the
 *     HTTP cache.
 *  2. Only the static application shell is cached: hashed /_next/static
 *     assets, icons and successfully fetched /valitoo navigations.
 *  3. The worker performs no background fetches and sends nothing anywhere —
 *     it is a shell, not a data channel.
 */

const SW_VERSION = "field-v1-1";
const STATIC_CACHE = `field-static-${SW_VERSION}`;
const SHELL_CACHE = `field-shell-${SW_VERSION}`;
const KNOWN_CACHES = [STATIC_CACHE, SHELL_CACHE];

const OFFLINE_FALLBACK_HTML = `<!doctype html>
<html lang="et"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SotsiaalAI — võrguta</title>
<style>body{font-family:system-ui,sans-serif;background:#140b07;color:#f5ede4;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center}main{max-width:28rem}h1{font-size:1.25rem}</style>
</head><body><main><h1>Oled võrguta</h1>
<p>See leht vajab ühendust. Välitöö vaade <a style="color:#e8b98a" href="/valitoo">/valitoo</a> töötab võrguta, kui oled seda varem avanud.</p>
</main></body></html>`;

self.addEventListener("install", () => {
  // Activation is deferred until the page says syncing is idle (the field
  // shell posts SKIP_WAITING) so an update never swaps the shell mid-sync.
});

self.addEventListener("message", (event) => {
  if (event?.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => !KNOWN_CACHES.includes(name)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/site.webmanifest"
  );
}

function isFieldNavigation(request, url) {
  return request.mode === "navigate" && (url.pathname === "/valitoo" || url.pathname.startsWith("/valitoo/"));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // CONTRACT GUARD: API responses are never cached and never served from a
  // cache — the request falls through to the network untouched.
  if (isApiRequest(url)) return;

  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })()
    );
    return;
  }

  if (isFieldNavigation(request, url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          const cached = (await cache.match(request)) || (await cache.match("/valitoo"));
          if (cached) return cached;
          return new Response(OFFLINE_FALLBACK_HTML, {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" }
          });
        }
      })()
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          return new Response(OFFLINE_FALLBACK_HTML, {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" }
          });
        }
      })()
    );
  }
});
