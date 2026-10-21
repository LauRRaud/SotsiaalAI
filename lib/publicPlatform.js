/* Avaliku avamise üks tõeallikas. Avamine vajab teadlikku koodimuudatust,
   nagu avaliku registreerimise puhul; administraatori töö jääb lubatuks. */
export const PUBLIC_PLATFORM_OPEN = false;

const PUBLIC_FILES = new Set([
  "/favicon.ico", "/favicon.svg", "/apple-touch-icon.png",
  "/site.webmanifest", "/manifest.webmanifest", "/sw.js", "/robots.txt"
]);

const SERVICE_ENDPOINTS = new Set([
  "/api/health",
  "/api/subscription/webhook",
  "/api/subscription/callback",
  "/api/invites/sponsored/callback",
  "/api/internal/retention/cleanup",
  /* Taustatööd jooksevad ka enne avamist (omaniku otsus 21.10.2026): teavitused koos välitöö
     turvakontrolli, kiire abi aegumise ja kovisiooni kutsekirjadega ning praktikate ülevaated ei
     tohi värava taga seista. Iga marsruut kontrollib ise oma võtit (timingSafeEqual, tühi võti
     keelab). Nimeline loetelu: raha ja andmeekspordi tööd (subscription-*, payment-emails,
     usage-reservation-reaper, data-exports) jäävad värava taha, kuni nende kohta on eraldi otsus. */
  "/api/jobs/notifications",
  "/api/jobs/practice-reviews"
]);

export function normalizePlatformPath(pathname) {
  return String(pathname || "/").replace(/^\/(et|ru|en)(?=\/|$)/, "") || "/";
}

export function isPrelaunchPublicPath(pathname) {
  const path = normalizePlatformPath(pathname);
  if (path === "/" || path === "/admin" || PUBLIC_FILES.has(path) || SERVICE_ENDPOINTS.has(path)) return true;
  if (path.startsWith("/_next/") || path === "/api/auth" || path.startsWith("/api/auth/")) return true;
  if (/^\/(?:favicon-[\w-]+|apple-touch-icon-[\w-]+)\.png$/.test(path)) return true;
  return /^\/(?:logo|icons|og|room|audio|vendor|voice|i18n)\/.*\.(?:svg|png|jpe?g|webp|avif|gif|ico|mp3|wav|ogg|m4a|mp4|webm|js|css|json|wasm|woff2?)$/i.test(path);
}
