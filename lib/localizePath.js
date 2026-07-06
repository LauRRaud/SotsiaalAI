const SUPPORTED_LOCALES = ["et", "ru", "en"];
const DEFAULT_LOCALE = "et";
function normalizePathname(pathname = "/") {
  if (!pathname) return "/";
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}
export function stripLocaleFromPath(pathname = "/") {
  const normalized = normalizePathname(pathname);
  const stripped = normalized.replace(/^\/(et|ru|en)(?=\/|$)/, "") || "/";
  return stripped === "" ? "/" : stripped;
}
export function localizePath(pathname = "/") {
  const normalized = normalizePathname(pathname);
  const match = normalized.match(/^[^?#]+/);
  const basePath = match ? match[0] : normalized;
  const suffix = normalized.slice(basePath.length);
  const stripped = stripLocaleFromPath(basePath);
  // Keep links locale-neutral; language selection is handled via cookie.
  return `${stripped || "/"}${suffix}`;
}
export const LOCALES = SUPPORTED_LOCALES;
export { DEFAULT_LOCALE };
