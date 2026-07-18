import { prisma as defaultPrisma } from "../prisma.js";
import { createNotificationEvent } from "../notifications.js";
import { MENTORING_MEMBER_ROLES, MENTORING_LIMITS } from "./constants.js";

export function mentoringError(messageKey, status = 400, code = null) {
  const error = new Error(messageKey);
  error.status = status;
  if (code) error.code = code;
  return error;
}

export function notFound() {
  return mentoringError("api.common.not_found", 404, "NOT_FOUND");
}

export function conflict(code = "MENTORING_CONFLICT") {
  return mentoringError("mentoring.errors.conflict", 409, code);
}

export function invalid(code = "INVALID_REQUEST") {
  return mentoringError("api.common.invalid_request", 400, code);
}

export function resolveDb(options = {}) {
  return options.db || defaultPrisma;
}

/**
 * Mentorlus on professionaalide tööriist: mentee/mentor rollid on AINULT
 * SOCIAL_WORKER ja SERVICE_PROVIDER (O-EM-4). CLIENT ja ADMIN-konto ei pääse
 * liikmespindadele; admin tegutseb eraldi protseduurirajalt (I5).
 */
export function requireMentoringMember(session) {
  const userId = String(session?.user?.id || "").trim();
  if (!userId) throw mentoringError("api.common.unauthorized", 401);
  const role = String(session?.user?.role || "").toUpperCase();
  const admin = role === "ADMIN" || session?.user?.isAdmin === true;
  if (admin || !MENTORING_MEMBER_ROLES.includes(role)) {
    throw mentoringError("mentoring.errors.role_forbidden", 403, "ROLE_FORBIDDEN");
  }
  return { userId, role };
}

export function requireMentoringAdmin(session) {
  const userId = String(session?.user?.id || "").trim();
  if (!userId) throw mentoringError("api.common.unauthorized", 401);
  const role = String(session?.user?.role || "").toUpperCase();
  if (role !== "ADMIN" && session?.user?.isAdmin !== true) {
    // 404-norm: admini pinna olemasolu ei kinnitata mitte-adminile.
    throw notFound();
  }
  return { userId, role: "ADMIN" };
}

/**
 * Suhte-skoobitud lugemine: võõras JA admin saavad 404 (I4/I5, Kovisiooni
 * IDOR-etalon). Tagastab suhte koos positsiooniga.
 */
export async function findRelationForMember(db, userId, relationId, { select = null } = {}) {
  const id = String(relationId || "").trim();
  if (!id) throw notFound();
  const relation = await db.mentoringRelation.findFirst({
    where: {
      id,
      OR: [{ mentorUserId: userId }, { menteeUserId: userId }]
    },
    ...(select ? { select } : {})
  });
  if (!relation) throw notFound();
  return relation;
}

export function relationPosition(relation, userId) {
  if (relation.mentorUserId === userId) return "mentor";
  if (relation.menteeUserId === userId) return "mentee";
  return null;
}

export function otherPartyId(relation, userId) {
  return relation.mentorUserId === userId ? relation.menteeUserId : relation.mentorUserId;
}

/**
 * Advisory-lock + tehing (kanooniline idioom: covisionLegacyWrite). Kõik suhte
 * olekuüleminekud käivad selle luku alt.
 */
export async function withMentoringRelationLock(db, relationId, callback) {
  return db.$transaction(async (tx) => {
    if (typeof tx?.$executeRaw === "function") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`mentoring:${relationId}`}))`;
    }
    return callback(tx);
  });
}

export async function withMentoringProfileLock(db, profileKey, callback) {
  return db.$transaction(async (tx) => {
    if (typeof tx?.$executeRaw === "function") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`mentoring-profile:${profileKey}`}))`;
    }
    return callback(tx);
  });
}

/**
 * EM8 auditikirje. meta tohib kanda AINULT koode/ID-sid — vabatekst on
 * arhitektuuriliselt keelatud (I9).
 */
export async function recordMentoringAudit(tx, {
  action,
  actorUserId = null,
  profileId = null,
  relationId = null,
  requestId = null,
  summaryId = null,
  meta = null
}) {
  return tx.mentoringAuditEvent.create({
    data: {
      action,
      actorUserId: actorUserId || null,
      profileId: profileId || null,
      relationId: relationId || null,
      requestId: requestId || null,
      summaryId: summaryId || null,
      ...(meta ? { meta } : {})
    }
  });
}

/**
 * Teavituse emit äritehingu sees. verifyRecipient=false: tehingusisene seis on
 * juba kontrollitud ja read-verifitseeritakse igal lugemisel uuesti
 * (listNotificationEvents re-verify). Dedupe teeb korduse idempotentseks.
 */
export async function emitMentoringNotification(tx, {
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

export function normalizeText(value, { max = MENTORING_LIMITS.MAX_TEXT, required = false, field = "text" } = {}) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized && required) throw invalid(`MISSING_${field.toUpperCase()}`);
  if (normalized.length > max) throw invalid(`TOO_LONG_${field.toUpperCase()}`);
  return normalized || null;
}

export function normalizeTags(value, { max = MENTORING_LIMITS.MAX_TAGS } = {}) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  for (const item of value) {
    const tag = String(item || "").trim().slice(0, MENTORING_LIMITS.MAX_TAG_LENGTH);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
    if (result.length >= max) break;
  }
  return result;
}

export function touchActivity(data = {}, now = new Date()) {
  return { ...data, lastActivityAt: now };
}

export const MENTORING_PUBLIC_ERRORS = Object.freeze({
  "api.common.unauthorized": 401,
  "api.common.invalid_request": 400,
  "api.common.forbidden": 403,
  "api.common.not_found": 404,
  "mentoring.errors.role_forbidden": 403,
  "mentoring.errors.conflict": 409,
  "mentoring.errors.rate_limited": 429,
  "mentoring.errors.capacity_full": 409,
  "mentoring.errors.cooldown_active": 409,
  "mentoring.errors.client_data_confirmation_required": 400
});
