/**
 * External navigators receive the location embedded in their URL. Keep the
 * disclosure behind a fresh, explicit decision instead of making a sensitive
 * address-bearing URL a normal link.
 */
export function openExternalNavigation(url, warning, {
  confirm = globalThis.confirm,
  open = globalThis.open
} = {}) {
  if (!url || typeof confirm !== "function" || !confirm.call(globalThis, warning)) return false;
  if (typeof open !== "function") return false;
  open.call(globalThis, url, "_blank", "noopener,noreferrer");
  return true;
}
