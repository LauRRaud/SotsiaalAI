import crypto from "node:crypto";

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const ESTONIA_BOUNDS = Object.freeze({ minLat: 57.3, maxLat: 59.9, minLon: 21.5, maxLon: 28.3 });

function secret(env = process.env) {
  return String(env.SERVICE_MAP_SUGGESTION_SECRET || env.NEXTAUTH_SECRET || "").trim();
}

function clean(value) {
  return String(value || "").trim();
}

function safeCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 &&
    lat >= ESTONIA_BOUNDS.minLat && lat <= ESTONIA_BOUNDS.maxLat &&
    lon >= ESTONIA_BOUNDS.minLon && lon <= ESTONIA_BOUNDS.maxLon;
}

function canonicalSuggestion(suggestion = {}) {
  if (!safeCoordinates(suggestion.latitude, suggestion.longitude)) return null;
  const normalizedAddress = clean(suggestion.normalizedAddress || suggestion.label);
  const provider = clean(suggestion.provider).toLowerCase();
  const adsObjectId = clean(suggestion.adsObjectId);
  if (!normalizedAddress || !provider || !adsObjectId) return null;
  return {
    normalizedAddress,
    latitude: Number(suggestion.latitude),
    longitude: Number(suggestion.longitude),
    adsObjectId,
    provider
  };
}

function signature(body, signingSecret) {
  return crypto.createHmac("sha256", signingSecret).update(body).digest("base64url");
}

function equal(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function signServiceMapSuggestion(suggestion, {
  userId,
  now = new Date(),
  ttlMs = DEFAULT_TTL_MS,
  env = process.env
} = {}) {
  const signingSecret = secret(env);
  const selected = canonicalSuggestion(suggestion);
  if (!signingSecret || !clean(userId) || !selected) return null;
  const payload = {
    v: 1,
    sub: clean(userId),
    exp: now.getTime() + ttlMs,
    ...selected
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signature(body, signingSecret)}`;
}

export function verifyServiceMapSuggestionToken(token, {
  userId,
  now = new Date(),
  env = process.env
} = {}) {
  const signingSecret = secret(env);
  const [body, providedSignature, extra] = String(token || "").split(".");
  if (!signingSecret || !body || !providedSignature || extra || !equal(providedSignature, signature(body, signingSecret))) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    const selected = canonicalSuggestion(payload);
    if (payload?.v !== 1 || payload?.sub !== clean(userId) || !Number.isFinite(payload?.exp) || payload.exp <= now.getTime()) return null;
    return selected;
  } catch {
    return null;
  }
}

export const serviceMapSuggestionTokenInternals = Object.freeze({ canonicalSuggestion, ESTONIA_BOUNDS });
