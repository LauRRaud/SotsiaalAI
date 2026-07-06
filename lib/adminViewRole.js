export const ADMIN_VIEW_ROLE_COOKIE = "sotsiaalai_admin_view_role";

const ADMIN_VIEW_ROLE_VALUES = new Set(["SERVICE_PROVIDER", "SOCIAL_WORKER", "CLIENT"]);

function readCookieValue(cookieSource, name) {
  if (!cookieSource || !name) return "";

  if (typeof cookieSource.get === "function") {
    const entry = cookieSource.get(name);
    if (typeof entry === "string") return entry;
    if (entry && typeof entry === "object" && typeof entry.value === "string") {
      return entry.value;
    }
  }

  if (cookieSource.cookies && typeof cookieSource.cookies.get === "function") {
    const entry = cookieSource.cookies.get(name);
    if (typeof entry === "string") return entry;
    if (entry && typeof entry === "object" && typeof entry.value === "string") {
      return entry.value;
    }
  }

  return "";
}

export function normalizeAdminViewRole(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return ADMIN_VIEW_ROLE_VALUES.has(normalized) ? normalized : null;
}

export function getAdminViewRoleFromCookies(cookieSource) {
  return normalizeAdminViewRole(readCookieValue(cookieSource, ADMIN_VIEW_ROLE_COOKIE));
}
