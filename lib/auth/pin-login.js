import crypto from "node:crypto";
import { hash as bcryptHash, compare as bcryptCompare } from "bcrypt";

function readPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const PIN_MIN = readPositiveInteger(process.env.LOGIN_PIN_MIN, 4);
const PIN_MAX = readPositiveInteger(process.env.LOGIN_PIN_MAX, 8);
export const OTP_TTL_MINUTES = readPositiveInteger(process.env.LOGIN_OTP_MINUTES, 15);
export const TEMP_LOGIN_TOKEN_MINUTES = readPositiveInteger(process.env.LOGIN_TEMP_LOGIN_MINUTES, 15);
export const TRUSTED_DEVICE_DAYS = readPositiveInteger(process.env.LOGIN_TRUSTED_DEVICE_DAYS, 30);
const TRUSTED_DEVICE_MAX = readPositiveInteger(process.env.LOGIN_TRUSTED_DEVICE_MAX, 3);
const TRUSTED_DEVICE_ADMIN_MAX = Math.max(
  TRUSTED_DEVICE_MAX,
  readPositiveInteger(process.env.LOGIN_TRUSTED_DEVICE_ADMIN_MAX, Math.max(5, TRUSTED_DEVICE_MAX))
);
const TRUSTED_DEVICE_NAME_MAX = readPositiveInteger(process.env.LOGIN_TRUSTED_DEVICE_NAME_MAX, 60);
const ACTIVE_SESSION_MAX = readPositiveInteger(process.env.LOGIN_SESSION_MAX, TRUSTED_DEVICE_MAX);
const ACTIVE_SESSION_ADMIN_MAX = Math.max(
  ACTIVE_SESSION_MAX,
  readPositiveInteger(process.env.LOGIN_SESSION_ADMIN_MAX, Math.max(TRUSTED_DEVICE_ADMIN_MAX, ACTIVE_SESSION_MAX))
);
export const DEVICE_COOKIE_NAME = process.env.LOGIN_DEVICE_COOKIE || "sotsiaalai_device";

function isAdminPrincipal(principal) {
  return Boolean(principal?.isAdmin) || String(principal?.role || "").toUpperCase() === "ADMIN";
}

export function getTrustedDeviceMaxForUser(user) {
  return isAdminPrincipal(user) ? TRUSTED_DEVICE_ADMIN_MAX : TRUSTED_DEVICE_MAX;
}

export function getActiveSessionMaxForUser(user) {
  return isAdminPrincipal(user) ? ACTIVE_SESSION_ADMIN_MAX : ACTIVE_SESSION_MAX;
}

export function normalizeTrustedDeviceName(input) {
  const normalized = String(input || "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.slice(0, TRUSTED_DEVICE_NAME_MAX);
}

export function normalizeEmail(input) {
  const s = String(input || "").trim().toLowerCase();
  return s.length > 254 ? s.slice(0, 254) : s;
}
export function normalizePin(input) {
  return String(input || "").trim().replace(/\s+/g, "");
}
export function isValidPin(pin) {
  return typeof pin === "string" && new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin);
}
export function maskEmail(email) {
  if (!email) return "";
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const maskedUser = user.length <= 2 ? `${user[0] || ""}*` : `${user[0]}${"*".repeat(Math.max(1, user.length - 2))}${user[user.length - 1]}`;
  const domainParts = domain.split(".");
  const maskedDomain = domainParts.length < 2 ? "***" : `${domainParts[0][0]}***.${domainParts.slice(1).join(".")}`;
  return `${maskedUser}@${maskedDomain}`;
}
export function randomOtpCode() {
  const value = crypto.randomInt(100000, 1000000);
  return value.toString().padStart(6, "0");
}
export async function hashOtpCode(code) {
  return bcryptHash(code, 10);
}
export async function compareOtpCode(code, codeHash) {
  if (!code || !codeHash) return false;
  try {
    return await bcryptCompare(code, codeHash);
  } catch {
    return false;
  }
}
export function generateOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}
function sha256(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}
export function hashOpaqueToken(token) {
  return sha256(token);
}
export function fingerprintUserAgent(userAgent) {
  if (!userAgent) return null;
  return sha256(userAgent.trim().toLowerCase());
}
export function computeIpFromHeaders(headers) {
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("cf-connecting-ip") || headers.get("true-client-ip") || null;
}
export function computeIpRange(ip) {
  if (!ip) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const parts = ip.split(".");
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  return null;
}
export function buildDeviceCookie(deviceToken) {
  const maxAgeSeconds = TRUSTED_DEVICE_DAYS * 24 * 60 * 60;
  return {
    name: DEVICE_COOKIE_NAME,
    value: deviceToken,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "strict",
      path: "/",
      maxAge: maxAgeSeconds
    }
  };
}

export function isDirectPinLoginAllowed({
  envValue = process.env.LOGIN_ALLOW_DIRECT_PIN,
  nodeEnv = process.env.NODE_ENV
} = {}) {
  return nodeEnv !== "production" && String(envValue || "").trim().toLowerCase() === "true";
}

export function pickTrustedDeviceIdsToEvict(devices = [], max = TRUSTED_DEVICE_MAX) {
  if (!Array.isArray(devices) || devices.length < max || max < 1) return [];
  const overflow = devices.length - max + 1;
  return devices
    .slice()
    .sort((a, b) => {
      const aLastUsed = a?.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
      const bLastUsed = b?.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
      if (aLastUsed !== bLastUsed) return aLastUsed - bLastUsed;
      const aCreated = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aCreated - bCreated;
    })
    .slice(0, overflow)
    .map((item) => item?.id)
    .filter(Boolean);
}

export function summarizeUserAgent(userAgent) {
  const raw = String(userAgent || "").trim();
  if (!raw) return "Unknown device";
  const normalized = raw.toLowerCase();
  let browser = "Browser";
  if (normalized.includes("edg/")) browser = "Edge";
  else if (normalized.includes("opr/") || normalized.includes("opera")) browser = "Opera";
  else if (normalized.includes("chrome/")) browser = "Chrome";
  else if (normalized.includes("firefox/")) browser = "Firefox";
  else if (normalized.includes("safari/")) browser = "Safari";

  let device = "desktop";
  if (normalized.includes("iphone")) device = "iPhone";
  else if (normalized.includes("ipad")) device = "iPad";
  else if (normalized.includes("android")) device = "Android";
  else if (normalized.includes("mobile")) device = "mobile device";
  else if (normalized.includes("mac os x") || normalized.includes("macintosh")) device = "Mac";
  else if (normalized.includes("windows")) device = "Windows PC";
  else if (normalized.includes("linux")) device = "Linux device";

  return `${browser} on ${device}`;
}

export function formatSecurityEventTime(locale, date = new Date()) {
  const normalized = String(locale || "").trim().toLowerCase();
  const formatterLocale =
    normalized.startsWith("et") ? "et-EE" : normalized.startsWith("ru") ? "ru-RU" : "en-GB";
  try {
    return new Intl.DateTimeFormat(formatterLocale, {
      timeZone: "Europe/Tallinn",
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  } catch {
    return date.toISOString();
  }
}
