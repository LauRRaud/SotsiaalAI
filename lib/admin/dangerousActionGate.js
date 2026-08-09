/**
 * SOL-RAGADMIN-04 — hävitava adminitoimingu SERVERIPOOLNE värav, üks kord kirjas.
 *
 * MIKS SEE FAIL SÜNDIS. Värav oli olemas ja töötas — aga ta elas
 * `dangerousAnalyticsActions.js` sees privaatsete funktsioonidena, seega teda ei
 * saanud kasutada keegi teine. KOV RAG reset kirjutas seetõttu pelga
 * `confirmReset: true` peale ja kogu kaitse oli brauseri `window.confirm`.
 *
 * SIIN EI OLE UUT LOOGIKAT. Need on samad funktsioonid, mis kandsid analüütika
 * hävitavaid toiminguid; nad on ainult tõstetud kohta, kust neid saab jagada.
 * **Teine koopia oleks olnud halvim variant:** HMAC, TTL ja sõrmejälje kuju
 * peavad olema ÜKS implementatsioon, muidu lähevad nad esimese muudatusega lahku
 * ja üks pool jääb nõrgemaks, ilma et keegi seda näeks.
 *
 * VÄRAVA NELI SAMMU:
 *   1. **preview** — server arvutab mõju ja allkirjastab selle (`createPreview`)
 *   2. **signed token** — kliendi käes on HMAC-allkirjastatud sõrmejälg + TTL
 *   3. **exact confirmation** — admin kirjutab täpse teksti, mille server ütles
 *   4. **one-time consume** — `jti` broneeritakse auditireana, teistkordne
 *      kasutus põrkab (`reserveDangerousActionPreview`)
 *
 * Sõrmejälg on siin see, mis tegelikult kaitseb: kui mõju kinnitamise ja
 * kirjutuse vahel MUUTUB, ei kehti token enam. Ilma selleta kinnitaks admin ühe
 * plaani ja server täidaks teise.
 */

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const PREVIEW_TTL_MS = 5 * 60 * 1000;
const MAX_REASON_LENGTH = 500;
const JTI_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class DangerousActionError extends Error {
  constructor(messageKey, status = 400, code = "DANGEROUS_ACTION_REJECTED") {
    super(code);
    this.name = "DangerousActionError";
    this.messageKey = messageKey;
    this.status = status;
    this.code = code;
  }
}

export function reject(messageKey, code, status = 400) {
  throw new DangerousActionError(messageKey, status, code);
}

export function normalizeReason(value) {
  const reason = String(value || "").trim();
  if (reason.length < 3 || reason.length > MAX_REASON_LENGTH) {
    reject("api.admin.analytics.dangerous_reason_required", "DANGEROUS_REASON_REQUIRED");
  }
  return reason;
}

export function requireExecutionFields({ reason, confirmation, previewToken }) {
  const normalizedReason = normalizeReason(reason);
  if (!String(confirmation || "").trim()) {
    reject("api.admin.analytics.dangerous_confirmation_required", "DANGEROUS_CONFIRMATION_REQUIRED");
  }
  if (!String(previewToken || "").trim()) {
    reject("api.admin.analytics.dangerous_preview_required", "DANGEROUS_PREVIEW_REQUIRED");
  }
  return normalizedReason;
}

function resolvePreviewSecret(env = process.env) {
  const secret = String(
    env.ADMIN_DANGEROUS_ACTION_PREVIEW_SECRET ||
      env.NEXTAUTH_SECRET ||
      env.AUTH_SECRET ||
      ""
  ).trim();
  if (secret) return secret;
  if (String(env.NODE_ENV || "").toLowerCase() !== "production") {
    return "sotsiaalai-local-dangerous-action-preview";
  }
  reject("api.admin.analytics.dangerous_gate_unavailable", "DANGEROUS_GATE_UNAVAILABLE", 503);
}

export function stableFingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sign(encodedPayload, secret) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createPreview({ kind, fingerprint, impact, confirmation, now = new Date(), env = process.env }) {
  const expiresAt = new Date(now.getTime() + PREVIEW_TTL_MS);
  const payload = {
    v: 1,
    jti: randomUUID(),
    kind,
    fingerprint: stableFingerprint(fingerprint),
    impact: Number(impact || 0),
    confirmation,
    expiresAt: expiresAt.toISOString()
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encodedPayload, resolvePreviewSecret(env));
  return {
    confirmation,
    previewToken: `${encodedPayload}.${signature}`,
    previewExpiresAt: expiresAt.toISOString()
  };
}

export function assertPreview({
  kind,
  fingerprint,
  impact,
  expectedConfirmation,
  confirmation,
  previewToken,
  now = new Date(),
  env = process.env
}) {
  if (String(confirmation || "").trim() !== expectedConfirmation) {
    reject("api.admin.analytics.dangerous_confirmation_invalid", "DANGEROUS_CONFIRMATION_INVALID");
  }

  const [encodedPayload, signature, extra] = String(previewToken || "").split(".");
  if (!encodedPayload || !signature || extra) {
    reject("api.admin.analytics.dangerous_preview_invalid", "DANGEROUS_PREVIEW_INVALID");
  }

  const expectedSignature = sign(encodedPayload, resolvePreviewSecret(env));
  if (!safeEqual(signature, expectedSignature)) {
    reject("api.admin.analytics.dangerous_preview_invalid", "DANGEROUS_PREVIEW_INVALID");
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    reject("api.admin.analytics.dangerous_preview_invalid", "DANGEROUS_PREVIEW_INVALID");
  }

  if (
    payload?.v !== 1 ||
    !JTI_PATTERN.test(String(payload?.jti || "")) ||
    payload?.kind !== kind ||
    payload?.fingerprint !== stableFingerprint(fingerprint) ||
    Number(payload?.impact) !== Number(impact || 0) ||
    payload?.confirmation !== expectedConfirmation
  ) {
    reject("api.admin.analytics.dangerous_preview_stale", "DANGEROUS_PREVIEW_STALE");
  }

  const expiresAt = new Date(payload.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
    reject("api.admin.analytics.dangerous_preview_stale", "DANGEROUS_PREVIEW_STALE");
  }
  return payload;
}

export function requestAuditFields(request) {
  return {
    ipAddress: request?.headers?.get?.("x-forwarded-for") || request?.headers?.get?.("x-real-ip") || null,
    userAgent: request?.headers?.get?.("user-agent") || null
  };
}

/**
 * ÜHEKORDNE KASUTUS. `jti` broneeritakse auditirea PRIMAARVÕTMEKS, seega teine
 * kasutus põrkab andmebaasi unikaalsuse vastu, mitte mälus oleva loendi vastu —
 * see töötab ka mitme protsessi ja restardi üle.
 *
 * Auditirida sünnib ENNE tööd (`status: "started"`), sest hävitava toimingu jälg
 * peab olema olemas ka siis, kui töö poole peal katkeb.
 */
export async function reserveDangerousActionPreview({ db, jti, data }) {
  try {
    return await db.dataAuditLog.create({ data: { id: jti, ...data } });
  } catch (error) {
    if (error?.code === "P2002") {
      reject("api.admin.analytics.dangerous_preview_already_used", "DANGEROUS_PREVIEW_ALREADY_USED", 409);
    }
    throw error;
  }
}
