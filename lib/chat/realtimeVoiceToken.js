import crypto from "node:crypto";

const TOKEN_VERSION = 1;

function encode(value) {
  return Buffer.from(value).toString("base64url");
}

function signature(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function subjectHash(userId, secret) {
  return crypto.createHmac("sha256", secret).update(`voice-user:${userId}`).digest("base64url");
}

export function createVoiceSettlementToken({
  userId,
  idempotencyKey,
  ttsIdempotencyKey,
  startedAt,
  expiresAt
}, secret) {
  if (!secret) throw new TypeError("voice settlement secret is required");
  const payload = encode(JSON.stringify({
    v: TOKEN_VERSION,
    sub: subjectHash(userId, secret),
    key: String(idempotencyKey || ""),
    ttsKey: String(ttsIdempotencyKey || ""),
    iat: Number(startedAt),
    exp: Number(expiresAt)
  }));
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyVoiceSettlementToken(token, { userId, secret, now = Date.now() } = {}) {
  if (!secret || !userId || typeof token !== "string" || token.length > 2048) return null;
  const [payload, receivedSignature, extra] = token.split(".");
  if (!payload || !receivedSignature || extra) return null;
  const expectedSignature = signature(payload, secret);
  const receivedBuffer = Buffer.from(receivedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  ) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (parsed?.v !== TOKEN_VERSION) return null;
    if (parsed?.sub !== subjectHash(userId, secret)) return null;
    if (!parsed?.key || !Number.isFinite(parsed?.iat) || !Number.isFinite(parsed?.exp)) return null;
    if (Number(now) > parsed.exp || Number(now) < parsed.iat - 30_000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function realtimeSafetyIdentifier(userId, secret) {
  return subjectHash(userId, secret);
}

