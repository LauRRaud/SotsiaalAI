/** Public website origin; deployment overrides also support local previews. */
export function getPublicSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://sotsiaal.pro").replace(/\/+$/, "");
}
