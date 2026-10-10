/**
 * Sotsiaal.pro service worker — FIELD-V1 offline shell (doc ptk 4.10 contract).
 *
 * HARD CONTRACT:
 *  1. No "/api/" response is EVER cached or served from a cache. The guard
 *     below runs before any caching logic; the sync layer owns all data and
 *     stores it in the encrypted per-user IndexedDB partition, never in the
 *     HTTP cache.
 *  2. Only the static application shell is cached: hashed /_next/static
 *     assets, the hashed text catalogue (/i18n/<locale>.<hash>.js), icons and
 *     successfully fetched /valitoo navigations. The catalogue used to be
 *     written inside every page's HTML; since it became a file of its own a
 *     cached /valitoo page needs it to show its texts offline.
 *  3. The worker performs no background fetches and sends nothing anywhere —
 *     it is a shell, not a data channel.
 */

const SW_VERSION = "field-v1-1";
const STATIC_CACHE = `field-static-${SW_VERSION}`;
const SHELL_CACHE = `field-shell-${SW_VERSION}`;
const KNOWN_CACHES = [STATIC_CACHE, SHELL_CACHE];

// Standalone page: it inherits nothing from the app's stylesheets, so the
// platform rules are repeated here by hand. The background is the one the
// sign-in confirmation pages use, scrollbars are hidden as everywhere on the
// site (base.css), and the body is border-box so its padding does not push
// the page 48px past the viewport.
const OFFLINE_FALLBACK_HTML = `<!doctype html>
<html lang="et"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sotsiaal.pro — võrguta</title>
<style>html{scrollbar-width:none;-ms-overflow-style:none}html::-webkit-scrollbar{display:none}body{box-sizing:border-box;font-family:system-ui,sans-serif;background:linear-gradient(180deg,#0d0d0d 0%,#161616 100%);color:#f5ede4;display:flex;min-height:100vh;min-height:100dvh;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center}main{max-width:28rem}h1{font-size:1.25rem}</style>
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
    url.pathname.startsWith("/i18n/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/site.webmanifest"
  );
}

function isCatalogueAsset(url) {
  return url.pathname.startsWith("/i18n/");
}

// The text catalogue changes its file name whenever a text changes. Without
// this the cache would keep every old catalogue for good (about 0.7 MB each):
// once a new one is stored, older files of the same language are dropped.
async function dropOlderCatalogues(cache, url) {
  const language = url.pathname.slice("/i18n/".length).split(".")[0];
  const prefix = `/i18n/${language}.`;
  for (const stored of await cache.keys()) {
    const storedUrl = new URL(stored.url);
    if (storedUrl.pathname.startsWith(prefix) && storedUrl.pathname !== url.pathname) await cache.delete(stored);
  }
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
        // A response the server marked "no-store" (a catalogue asked for under an
        // outdated name) is passed on but never kept.
        const keep = response.ok && !/no-store/i.test(response.headers.get("Cache-Control") || "");
        if (keep) {
          await cache.put(request, response.clone());
          if (isCatalogueAsset(url)) await dropOlderCatalogues(cache, url);
        }
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
