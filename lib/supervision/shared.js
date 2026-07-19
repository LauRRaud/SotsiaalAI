import { prisma as defaultPrisma } from "../prisma.js";
import { createNotificationEvent } from "../notifications.js";

/**
 * Supervisioon V0 — jagatud teenusekihi alus (lib/supervision/*).
 *
 * Muster järgib mentorluse/kovisiooni pretsedenti (lib/mentoring/shared.js,
 * lib/covisionLegacyWrite.js): loogika lib-is, route õhuke; iga muteeriv
 * toiming käib advisory-xact-luku + version-CAS-i alt; auditikirjed on
 * SISUVABAD (ainult id/enum/arv — vabatekst on arhitektuuriliselt keelatud,
 * Q2.2 M13 invariant + test T19).
 */

// SW ja SP on supervisioonis osalejana identsete õigustega (Q2.3). CLIENT ega
// ADMIN ei ole liikmerollid (otsused 5, 9).
export const SUPERVISION_MEMBER_ROLES = Object.freeze(["SOCIAL_WORKER", "SERVICE_PROVIDER"]);

/**
 * M13 auditisündmuste action-nimed (Q2.2 M13 loend). action on String, mitte
 * enum — aga koondasetus siia hoiab nimed ühes kohas ja testitavana (T19: iga
 * Q2.4 „✓"-rida loob täpselt ühe kirje õige action'iga). Grant-sündmused
 * (GRANT_ISSUED/REVOKED) elavad grants.js-s (processId=null).
 */
export const SUPERVISION_ACTIONS = Object.freeze({
  PROCESS_CREATED: "PROCESS_CREATED",
  PROCESS_UPDATED: "PROCESS_UPDATED",
  CONTRACT_VERSION_CREATED: "CONTRACT_VERSION_CREATED",
  CONTRACT_ACTIVATED: "CONTRACT_ACTIVATED",
  INVITE_SENT: "INVITE_SENT",
  INVITE_WITHDRAWN: "INVITE_WITHDRAWN",
  CONTRACT_ACCEPTED: "CONTRACT_ACCEPTED",
  PARTICIPANT_LEFT: "PARTICIPANT_LEFT",
  TOPIC_SHARED: "TOPIC_SHARED",
  TOPIC_WITHDRAWN: "TOPIC_WITHDRAWN",
  MEETING_PLANNED: "MEETING_PLANNED",
  MEETING_HELD: "MEETING_HELD",
  SUMMARY_SUBMITTED: "SUMMARY_SUBMITTED",
  SUMMARY_APPROVED: "SUMMARY_APPROVED",
  PROCESS_CLOSED: "PROCESS_CLOSED"
});

/**
 * Sisendi allowlist (Q2.4: tundmatu võti → 400). Route/teenus lubab AINULT
 * nimetatud võtmed; ükski tundmatu väli ei sõida läbi vaikselt.
 */
export function assertAllowedKeys(input, allowed) {
  if (input == null) return;
  if (typeof input !== "object" || Array.isArray(input)) throw invalid("INVALID_BODY");
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) throw invalid("UNKNOWN_FIELD");
  }
}

/** CAS-i oodatud versioon peab olema mittenegatiivne täisarv. */
export function requireExpectedVersion(value) {
  if (!Number.isInteger(value) || value < 0) throw invalid("INVALID_EXPECTED_VERSION");
  return value;
}

export function supervisionError(messageKey, status = 400, code = null) {
  const error = new Error(messageKey);
  error.status = status;
  if (code) error.code = code;
  return error;
}

export function notFound() {
  return supervisionError("api.common.not_found", 404, "NOT_FOUND");
}

export function unauthorized() {
  return supervisionError("api.common.unauthorized", 401, "UNAUTHORIZED");
}

export function forbidden(messageKey = "api.common.forbidden", code = "FORBIDDEN") {
  return supervisionError(messageKey, 403, code);
}

export function conflict(messageKey = "supervision.errors.conflict", code = "SUPERVISION_CONFLICT") {
  return supervisionError(messageKey, 409, code);
}

export function invalid(code = "INVALID_REQUEST") {
  return supervisionError("api.common.invalid_request", 400, code);
}

export function unprocessable(messageKey = "supervision.errors.rule_violation", code = "RULE_VIOLATION") {
  return supervisionError(messageKey, 422, code);
}

/** CAS: oodatud versioon ei kattu salvestatuga — mitte ühtegi rida ei muudetud. */
export function staleVersion() {
  return conflict("supervision.errors.stale_version", "STALE_VERSION");
}

export function resolveDb(options = {}) {
  return options.db || defaultPrisma;
}

/**
 * Autenditud kasutaja ILMA rolliväravata. Detail-/skoobitud rajad kasutavad
 * seda: võõra ja olematu objekti vastus on ühetaoline 404, sest membership-
 * skoobitud päring ei leia kirjet (CLIENT/ADMIN ei ole kunagi liige → 404, EI
 * 403). Ühetaolise-404 reegli kandev alus (Q2.4).
 */
export function requireSupervisionUser(session) {
  const userId = String(session?.user?.id || "").trim();
  if (!userId) throw unauthorized();
  const role = String(session?.user?.role || "").toUpperCase();
  const admin = role === "ADMIN" || session?.user?.isAdmin === true;
  return { userId, role, isAdmin: admin };
}

/**
 * Liikmeroll (SW/SP) on värav: loend- ja loomisrajad, kus tahame selget
 * 403-viga (mitte skoobitud 404). CLIENT ja ADMIN → 403 (nagu mentorluses).
 */
export function requireSupervisionMember(session) {
  const { userId, role, isAdmin } = requireSupervisionUser(session);
  if (isAdmin || !SUPERVISION_MEMBER_ROLES.includes(role)) {
    throw forbidden("supervision.errors.role_forbidden", "ROLE_FORBIDDEN");
  }
  return { userId, role };
}

/**
 * Admin-värav grant-haldusele. 403 mitte-adminile (Q2.10 test #1: SW/SP/CLIENT
 * → 403). NB see on teadlik erinevus protsessi-SISU-radade 404-normist
 * (Q2.4 "ühetaoline 404" kehtib M2/M6/M7/M8/M9/M12 detailidele, MITTE
 * admin-grant-API-le, mis on selgelt admin-only pind).
 */
export function requireSupervisionAdmin(session) {
  const { userId, role, isAdmin } = requireSupervisionUser(session);
  if (role !== "ADMIN" && !isAdmin) {
    throw forbidden("api.common.forbidden", "ADMIN_REQUIRED");
  }
  return { userId, role: "ADMIN" };
}

/**
 * Advisory-lock + tehing — kanooniline idioom (lib/covisionLegacyWrite.js:6).
 * Kõik protsessi muteerivad üleminekud käivad selle luku alt; xact-lukk vabaneb
 * tehingu lõpus automaatselt.
 */
export async function withSupervisionProcessLock(db, processId, callback) {
  return db.$transaction(async (tx) => {
    if (typeof tx?.$executeRaw === "function") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`supervision:${processId}`}))`;
    }
    return callback(tx);
  });
}

// Auditi metadata tohib kanda AINULT koode/id-sid/arve — vabatekst on
// arhitektuuriliselt keelatud (Q2.2 M13, test T19). Sama SAFE-muster nagu
// NotificationEvent sourceId/targetId (cuid, enum, ISO-kuupäev, arv).
const SAFE_META_STRING = /^[A-Za-z0-9._:@+-]+$/;

export function assertAuditMetadataSafe(metadata) {
  if (metadata == null) return;
  const walk = (value) => {
    if (value == null) return;
    const t = typeof value;
    if (t === "number" || t === "boolean") return;
    if (t === "string") {
      if (!SAFE_META_STRING.test(value)) {
        throw supervisionError("supervision.errors.audit_free_text", 500, "AUDIT_FREE_TEXT");
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (t === "object") {
      Object.values(value).forEach(walk);
      return;
    }
    throw supervisionError("supervision.errors.audit_free_text", 500, "AUDIT_FREE_TEXT");
  };
  walk(metadata);
}

/**
 * M13 auditikirje. metadata valideeritakse sisuvaba-invariandi vastu ENNE
 * kirjutust (fail-closed). Grant-sündmused kannavad processId=null.
 */
export async function recordSupervisionAudit(tx, {
  action,
  actorUserId = null,
  processId = null,
  targetKind = null,
  targetId = null,
  metadata = null
}) {
  assertAuditMetadataSafe(metadata);
  return tx.supervisionAuditEvent.create({
    data: {
      action,
      actorUserId: actorUserId || null,
      processId: processId || null,
      targetKind: targetKind || null,
      targetId: targetId || null,
      ...(metadata ? { metadata } : {})
    }
  });
}

/**
 * Teavituse emit äritehingu sees (fakt + viide, MITTE sisu — Q2.8, test #15).
 * verifyRecipient=false: tehingusisene seis on juba kontrollitud ja lugemisel
 * re-verifitseeritakse; dedupe teeb korduse idempotentseks.
 */
export async function emitSupervisionNotification(tx, {
  type,
  userId,
  sourceId,
  targetId,
  dedupeSuffix = "v1",
  emailPolicy = "NONE"
}, { now = new Date() } = {}) {
  if (!userId) return null;
  return createNotificationEvent(
    { type, userId, sourceId, targetId, dedupeSuffix, emailPolicy },
    { db: tx, now, verifyRecipient: false }
  );
}

export function normalizeText(value, { max = 20000, required = false, field = "text" } = {}) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized && required) throw invalid(`MISSING_${field.toUpperCase()}`);
  if (normalized.length > max) throw invalid(`TOO_LONG_${field.toUpperCase()}`);
  return normalized || null;
}

export const SUPERVISION_PUBLIC_ERRORS = Object.freeze({
  "api.common.unauthorized": 401,
  "api.common.invalid_request": 400,
  "api.common.forbidden": 403,
  "api.common.not_found": 404,
  "supervision.errors.role_forbidden": 403,
  "supervision.errors.grant_required": 403,
  "supervision.errors.conflict": 409,
  "supervision.errors.stale_version": 409,
  "supervision.errors.already_closed": 409,
  "supervision.errors.pending_summaries": 409,
  "supervision.errors.rule_violation": 422,
  "supervision.errors.role_not_allowed": 422,
  "supervision.errors.contract_not_accepted": 409,
  "supervision.errors.handoff_conflict": 409,
  "supervision.errors.handoff_fingerprint": 409
});
