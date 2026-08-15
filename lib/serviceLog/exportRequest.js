const ALLOWED_FETCH_SITES = new Set(["same-origin", "none"]);

/**
 * Report downloads also archive legal evidence, so they may only be initiated
 * by this application's UI or by an explicit browser navigation. Fetch
 * Metadata is available on the top-level GET where Origin is commonly absent.
 */
export function isTrustedReportExportRequest(req) {
  const fetchSite = String(req?.headers?.get?.("sec-fetch-site") || "").toLowerCase();
  if (fetchSite) return ALLOWED_FETCH_SITES.has(fetchSite);

  const origin = req?.headers?.get?.("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}
