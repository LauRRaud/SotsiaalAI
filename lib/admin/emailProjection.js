const FULL_EMAIL_ENV = "ADMIN_ANALYTICS_SHOW_FULL_EMAILS";

export function isFullAdminEmailProjectionEnabled(env = process.env) {
  return String(env?.[FULL_EMAIL_ENV] || "").trim().toLowerCase() === "true";
}

export function maskAdminEmail(value) {
  const email = String(value || "").trim();
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const domainParts = domain.split(".");
  const host = String(domainParts.shift() || "");
  const suffix = domainParts.join(".");
  if (!host) return null;

  const localMasked = local.length <= 2
    ? `${local.slice(0, 1)}***`
    : `${local.slice(0, 1)}${"*".repeat(Math.min(8, Math.max(2, local.length - 2)))}${local.slice(-1)}`;
  const hostMasked = host.length <= 2
    ? `${host.slice(0, 1)}***`
    : `${host.slice(0, 1)}***${host.slice(-1)}`;

  return `${localMasked}@${hostMasked}${suffix ? `.${suffix}` : ""}`;
}

export function projectAdminEmail(value, { env = process.env } = {}) {
  const email = String(value || "").trim();
  if (!email) return null;
  return isFullAdminEmailProjectionEnabled(env) ? email : maskAdminEmail(email);
}

export function redactAdminEmailSideChannels(value) {
  if (typeof value === "string") {
    return value.replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      "[redacted-email]"
    );
  }
  if (Array.isArray(value)) return value.map(redactAdminEmailSideChannels);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactAdminEmailSideChannels(item)])
    );
  }
  return value;
}

export const ADMIN_EMAIL_PROJECTION_ENV = FULL_EMAIL_ENV;
