import { prisma } from "@/lib/prisma";
import { normalizeText } from "@/lib/covisionShared";
import { writeDataAudit } from "@/lib/privacy/audit";

/**
 * A6.1 — Teemaseeme owner-private persistent core (O2 variant B).
 *
 * A TopicSeed is a SEPARATE preparation model from CovisionCase. An owner first
 * freezes a generalized card through DRAFT -> WAITING. A later server-owned,
 * atomic handoff may link that immutable snapshot to one CovisionCase and move
 * the seed to IN_COVISION. Owner edits remain limited to DRAFT.
 */

// Server whitelists — the client sends stable KEYS, never free text or labels.
export const TOPIC_SEED_CONTEXT_TYPES = Object.freeze([
  "adult", "child", "family", "couple", "network", "other"
]);
export const TOPIC_SEED_CASE_TYPES = Object.freeze([
  "current", "success", "past", "future"
]);
export const TOPIC_SEED_SUPPORT_KEYS = Object.freeze([
  "understanding", "perspectives", "role", "boundaries", "network",
  "method", "ethics", "paths", "next_step", "success_learning", "other"
]);
export const TOPIC_SEED_SAFETY_GATES = Object.freeze([
  "no_immediate_risk", "risk_unknown", "intervention_started", "risk_assessed"
]);

const TITLE_MAX = 80;
const WHY_NOW_MAX = 300;
const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;
const TOPIC_SEED_STATUSES = Object.freeze([
  "DRAFT",
  "WAITING",
  "IN_COVISION",
  "FOLLOW_UP",
  "CLOSED"
]);

const TOPIC_SEED_PUBLIC_ERRORS = Object.freeze({
  "api.common.unauthorized": 401,
  "api.common.not_found": 404,
  "covision.errors.role_forbidden": 403,
  "topic_seeds.errors.invalid": 400,
  "topic_seeds.errors.incomplete": 400,
  "topic_seeds.errors.confirmation_required": 400,
  "topic_seeds.errors.direct_identifier_detected": 422,
  "topic_seeds.errors.privacy_review_required": 422,
  "topic_seeds.errors.queue_conflict": 409,
  "topic_seeds.errors.edit_conflict": 409,
  "topic_seeds.errors.lifecycle_conflict": 409
});

const EDITABLE_FIELDS = Object.freeze([
  "title",
  "contextType",
  "caseType",
  "whyNow",
  "requestedSupport",
  "importance",
  "safetyGate"
]);

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainObject(value) {
  if (!isPlainObject(value)) throw fail("topic_seeds.errors.invalid", 400);
  return value;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/** Parse a JSON request body without turning malformed JSON or JSON null into a draft. */
export async function parseTopicSeedJsonBody(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw fail("topic_seeds.errors.invalid", 400);
  }
  return assertPlainObject(body);
}

/**
 * Convert an internal error to a fixed public key/status pair. Only explicitly
 * listed service/auth keys may cross the API boundary; arbitrary messages never do.
 */
export function topicSeedPublicError(error) {
  const messageKey = String(error?.message || "").trim();
  const allowedStatus = TOPIC_SEED_PUBLIC_ERRORS[messageKey];
  const errorStatus = Number(error?.status);
  return allowedStatus && errorStatus === allowedStatus
    ? { messageKey, status: allowedStatus }
    : { messageKey: "topic_seeds.errors.request_failed", status: 500 };
}

export function normalizeTopicSeedQueueRequest(input) {
  assertPlainObject(input);
  if (hasOwn(input, "confirmedNoIdentifiers") && typeof input.confirmedNoIdentifiers !== "boolean") {
    throw fail("topic_seeds.errors.invalid", 400);
  }
  if (hasOwn(input, "confirmedPrivacyReview") && typeof input.confirmedPrivacyReview !== "boolean") {
    throw fail("topic_seeds.errors.invalid", 400);
  }
  return {
    expectedVersion: normalizeExpectedVersion(input.expectedVersion),
    confirmedNoIdentifiers: input.confirmedNoIdentifiers === true,
    confirmedPrivacyReview: input.confirmedPrivacyReview === true
  };
}

export function normalizeExpectedVersion(value) {
  if (!Number.isInteger(value) || value < 1) throw fail("topic_seeds.errors.invalid", 400);
  return value;
}

function unique(values) {
  return [...new Set(values)];
}

function validEstonianPersonalCode(value) {
  if (!/^[1-8]\d{10}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const checksum = (weights) => digits.slice(0, 10)
    .reduce((sum, digit, index) => sum + digit * weights[index], 0) % 11;
  let expected = checksum([1, 2, 3, 4, 5, 6, 7, 8, 9, 1]);
  if (expected === 10) expected = checksum([3, 4, 5, 6, 7, 8, 9, 1, 2, 3]);
  if (expected === 10) expected = 0;
  return expected === digits[10];
}

/**
 * Deterministic server-side privacy preflight. Only category codes leave this
 * function; matched personal text is never persisted or logged as a finding.
 * Direct identifiers are fail-closed. A combination of weaker quasi-identifiers
 * requires a separate, explicit privacy review instead of reusing the generic
 * "no identifiers" checkbox.
 */
export function assessTopicSeedPrivacy(seed = {}) {
  const text = [seed.title, seed.whyNow]
    .filter((value) => typeof value === "string")
    .join("\n")
    .normalize("NFKC")
    .trim();
  const direct = [];
  const indirectSignals = [];

  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(text)) direct.push("EMAIL");

  const digitRuns = text.match(/(?:\+|00)?\d[\d\s().-]{5,}\d/gu) || [];
  if (digitRuns.some((candidate) => {
    const digits = candidate.replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15 && !validEstonianPersonalCode(digits);
  })) direct.push("PHONE");

  const personalCodes = text.match(/\b[1-8]\d{10}\b/gu) || [];
  if (personalCodes.some(validEstonianPersonalCode)) direct.push("PERSONAL_CODE");

  if (/\b(?:juhtumi|toimiku|menetluse|kliendi)\s*(?:nr|number|id)?\s*[:#-]?\s*[A-ZÕÄÖÜ0-9][A-ZÕÄÖÜ0-9/-]{4,}\b/iu.test(text)) {
    direct.push("CASE_NUMBER");
  }
  if (/\b[A-ZÕÄÖÜ][\p{L}'-]{2,}\s+[A-ZÕÄÖÜ][\p{L}'-]{2,}\b/u.test(text)) direct.push("PERSON_NAME");
  if (/\b[\p{L}'-]{2,}(?:\s+[\p{L}'-]{2,}){0,2}\s+(?:tänav|tn|tee|maantee|mnt|puiestee|pst|allee|põik)\s+\d{1,4}[a-z]?\b/iu.test(text)) {
    direct.push("ADDRESS");
  }

  if (/\b\d{1,3}\s*(?:-?aastane|aastat\s+vana)\b/iu.test(text)) indirectSignals.push("EXACT_AGE");
  if (/\b[\p{L}'-]{2,}\s+(?:küla|alevik|asum)\b/iu.test(text)) indirectSignals.push("SMALL_LOCATION");
  if (/\b(?:ainus|ainuke|haruldane|unikaalne|väga\s+ebatavaline)\b/iu.test(text)) indirectSignals.push("DISTINCTIVE_TRAIT");
  if (/\b(?:0?[1-9]|[12]\d|3[01])[./-](?:0?[1-9]|1[0-2])[./-](?:19|20)\d{2}\b/u.test(text)) indirectSignals.push("EXACT_DATE");

  return {
    direct: unique(direct),
    indirect: indirectSignals.length >= 2 ? unique(indirectSignals) : []
  };
}

function normalizeOptionalText(value, maxLength) {
  if (value == null) return null;
  if (typeof value !== "string") throw fail("topic_seeds.errors.invalid", 400);
  return normalizeText(value, maxLength) || null;
}

function normalizeWhitelistedKey(value, whitelist) {
  if (value == null) return null;
  if (typeof value !== "string") throw fail("topic_seeds.errors.invalid", 400);
  const key = normalizeText(value, 80);
  return whitelist.includes(key) ? key : null;
}

function normalizeSupportKeys(value) {
  if (!Array.isArray(value)) throw fail("topic_seeds.errors.invalid", 400);
  const seen = new Set();
  const out = [];
  for (const item of value) {
    if (typeof item !== "string") throw fail("topic_seeds.errors.invalid", 400);
    const key = normalizeText(item, 80);
    if (!TOPIC_SEED_SUPPORT_KEYS.includes(key)) throw fail("topic_seeds.errors.invalid", 400);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function validateCompleteFlag(input) {
  if (hasOwn(input, "complete") && typeof input.complete !== "boolean") {
    throw fail("topic_seeds.errors.invalid", 400);
  }
}

function normalizeImportance(value) {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 10) {
    throw fail("topic_seeds.errors.invalid", 400);
  }
  return value;
}

/**
 * Normalizes owner input to persistable fields. The client can never set ownerId,
 * status, audit times or the shared snapshot (they are server-controlled). When
 * `requireComplete` is true (the "Loo Teemaseeme" quick-seed action) all §9
 * mandatory fields must be present; otherwise a partial DRAFT is allowed.
 */
function normalizeTopicSeedInput(input = {}, { requireComplete = false } = {}) {
  assertPlainObject(input);
  validateCompleteFlag(input);

  const title = normalizeOptionalText(input.title, TITLE_MAX);

  const contextType = normalizeWhitelistedKey(input.contextType, TOPIC_SEED_CONTEXT_TYPES);
  if (input.contextType != null && !contextType) throw fail("topic_seeds.errors.invalid", 400);

  const caseType = normalizeWhitelistedKey(input.caseType, TOPIC_SEED_CASE_TYPES);
  if (input.caseType != null && !caseType) throw fail("topic_seeds.errors.invalid", 400);

  const whyNow = normalizeOptionalText(input.whyNow, WHY_NOW_MAX);

  const requestedSupport = hasOwn(input, "requestedSupport")
    ? normalizeSupportKeys(input.requestedSupport)
    : [];

  const importance = normalizeImportance(input.importance);

  const safetyGate = normalizeWhitelistedKey(input.safetyGate, TOPIC_SEED_SAFETY_GATES);
  if (input.safetyGate != null && !safetyGate) throw fail("topic_seeds.errors.invalid", 400);

  if (requireComplete && !isCompleteQuickSeedFields({ title, contextType, caseType, whyNow, requestedSupport, importance, safetyGate })) {
    throw fail("topic_seeds.errors.incomplete", 400);
  }

  return { title, contextType, caseType, whyNow, requestedSupport, importance, safetyGate };
}

function normalizeTopicSeedPatch(input, existing) {
  assertPlainObject(input);
  validateCompleteFlag(input);

  const patch = {};
  for (const field of EDITABLE_FIELDS) {
    if (!hasOwn(input, field)) continue;
    if (field === "title") patch.title = normalizeOptionalText(input.title, TITLE_MAX);
    if (field === "whyNow") patch.whyNow = normalizeOptionalText(input.whyNow, WHY_NOW_MAX);
    if (field === "contextType") {
      patch.contextType = normalizeWhitelistedKey(input.contextType, TOPIC_SEED_CONTEXT_TYPES);
      if (input.contextType != null && !patch.contextType) throw fail("topic_seeds.errors.invalid", 400);
    }
    if (field === "caseType") {
      patch.caseType = normalizeWhitelistedKey(input.caseType, TOPIC_SEED_CASE_TYPES);
      if (input.caseType != null && !patch.caseType) throw fail("topic_seeds.errors.invalid", 400);
    }
    if (field === "requestedSupport") patch.requestedSupport = normalizeSupportKeys(input.requestedSupport);
    if (field === "importance") patch.importance = normalizeImportance(input.importance);
    if (field === "safetyGate") {
      patch.safetyGate = normalizeWhitelistedKey(input.safetyGate, TOPIC_SEED_SAFETY_GATES);
      if (input.safetyGate != null && !patch.safetyGate) throw fail("topic_seeds.errors.invalid", 400);
    }
  }

  if (!Object.keys(patch).length) throw fail("topic_seeds.errors.invalid", 400);
  if (input.complete === true && !isCompleteQuickSeedFields({ ...existing, ...patch })) {
    throw fail("topic_seeds.errors.incomplete", 400);
  }
  return patch;
}

function isCompleteQuickSeedFields(seed) {
  return Boolean(
    seed.title &&
    seed.contextType &&
    seed.caseType &&
    seed.whyNow &&
    Array.isArray(seed.requestedSupport) && seed.requestedSupport.length &&
    seed.importance != null &&
    seed.safetyGate
  );
}

/** The frozen shareable card holds ONLY generalized, owner-approved fields. */
function buildTopicSeedSharedSnapshot(seed, frozenAtIso) {
  return {
    title: seed.title,
    contextType: seed.contextType,
    caseType: seed.caseType,
    whyNow: seed.whyNow,
    requestedSupport: Array.isArray(seed.requestedSupport) ? [...seed.requestedSupport] : [],
    importance: seed.importance,
    frozenAt: frozenAtIso
  };
}

function normalizePageSize(value, fallback = DEFAULT_PAGE_SIZE) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw fail("topic_seeds.errors.invalid", 400);
  return Math.min(parsed, MAX_PAGE_SIZE);
}

function encodeCursor(seed) {
  return Buffer.from(JSON.stringify({ id: seed.id, updatedAt: new Date(seed.updatedAt).toISOString() }))
    .toString("base64url");
}

function decodeCursor(value) {
  if (value == null || value === "") return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    const updatedAt = new Date(parsed?.updatedAt);
    if (!parsed?.id || !Number.isFinite(updatedAt.getTime()) || updatedAt.toISOString() !== parsed.updatedAt) {
      throw new Error("invalid cursor");
    }
    return { id: String(parsed.id), updatedAt };
  } catch {
    throw fail("topic_seeds.errors.invalid", 400);
  }
}

function seekWhere(cursor) {
  if (!cursor) return {};
  return {
    OR: [
      { updatedAt: { lt: cursor.updatedAt } },
      { updatedAt: cursor.updatedAt, id: { lt: cursor.id } }
    ]
  };
}

function normalizeStatus(value) {
  if (value == null || value === "" || value === "ALL") return null;
  const status = String(value).trim().toUpperCase();
  if (!TOPIC_SEED_STATUSES.includes(status)) throw fail("topic_seeds.errors.invalid", 400);
  return status;
}

async function withTransaction(db, callback) {
  if (typeof db?.$transaction === "function") return db.$transaction((tx) => callback(tx));
  return callback(db);
}

export function serializeTopicSeed(seed) {
  if (!seed) return null;
  return {
    id: seed.id,
    ownerId: seed.ownerId,
    title: seed.title ?? null,
    contextType: seed.contextType ?? null,
    caseType: seed.caseType ?? null,
    whyNow: seed.whyNow ?? null,
    requestedSupport: seed.requestedSupport || [],
    importance: seed.importance ?? null,
    safetyGate: seed.safetyGate ?? null,
    status: seed.status,
    version: seed.version,
    sharedCardSnapshot: seed.sharedCardSnapshot ?? null,
    privacyAssessment: seed.privacyAssessment ?? null,
    privacyReviewedAt: seed.privacyReviewedAt ?? null,
    ownerConfirmedAt: seed.ownerConfirmedAt ?? null,
    sharedAt: seed.sharedAt ?? null,
    covisionCaseId: seed.covisionCaseId ?? null,
    createdAt: seed.createdAt,
    updatedAt: seed.updatedAt
  };
}

export async function listTopicSeeds(userId, { db = prisma } = {}) {
  return (await listTopicSeedPage(userId, { limit: MAX_PAGE_SIZE, db })).seeds;
}

export async function listTopicSeedPage(
  userId,
  { cursor = null, limit = DEFAULT_PAGE_SIZE, status = null, db = prisma } = {}
) {
  const pageSize = normalizePageSize(limit);
  const normalizedStatus = normalizeStatus(status);
  const decodedCursor = decodeCursor(cursor);
  const where = {
    ownerId: userId,
    ...(normalizedStatus ? { status: normalizedStatus } : {}),
    ...seekWhere(decodedCursor)
  };
  const [rows, grouped] = await Promise.all([
    db.topicSeed.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: pageSize + 1
    }),
    db.topicSeed.groupBy({
      by: ["status"],
      where: { ownerId: userId },
      _count: { _all: true }
    })
  ]);
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  const counts = Object.fromEntries(TOPIC_SEED_STATUSES.map((item) => [item, 0]));
  for (const group of grouped || []) {
    if (TOPIC_SEED_STATUSES.includes(group.status)) counts[group.status] = Number(group?._count?._all || 0);
  }
  return {
    seeds: pageRows.map(serializeTopicSeed),
    counts: { ...counts, ALL: Object.values(counts).reduce((sum, count) => sum + count, 0) },
    nextCursor: hasMore && pageRows.length ? encodeCursor(pageRows.at(-1)) : null
  };
}

export async function listWaitingTopicSeedPage(
  userId,
  { cursor = null, limit = 50, db = prisma } = {}
) {
  const pageSize = normalizePageSize(limit, 50);
  const decodedCursor = decodeCursor(cursor);
  const rows = await db.topicSeed.findMany({
    where: {
      ownerId: userId,
      status: "WAITING",
      covisionCaseId: null,
      ...seekWhere(decodedCursor)
    },
    select: {
      id: true,
      version: true,
      status: true,
      covisionCaseId: true,
      sharedCardSnapshot: true,
      updatedAt: true
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: pageSize + 1
  });
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  return {
    seeds: pageRows.map((seed) => ({
      id: seed.id,
      version: seed.version,
      status: seed.status,
      covisionCaseId: seed.covisionCaseId ?? null,
      sharedCardSnapshot: seed.sharedCardSnapshot,
      updatedAt: seed.updatedAt
    })),
    nextCursor: hasMore && pageRows.length ? encodeCursor(pageRows.at(-1)) : null
  };
}

/** Owner-only visibility: returns the raw record only to its owner, else null. */
export async function getVisibleTopicSeed(userId, id, { db = prisma } = {}) {
  const seedId = String(id || "").trim();
  if (!seedId || !userId) return null;
  const seed = await db.topicSeed.findFirst({ where: { id: seedId, ownerId: userId } });
  return seed || null;
}

export async function createTopicSeed(userId, input = {}, { db = prisma } = {}) {
  assertPlainObject(input);
  const complete = input.complete === true;
  const data = normalizeTopicSeedInput(input, { requireComplete: complete });
  const seed = await db.topicSeed.create({
    data: {
      ownerId: userId,
      ...data,
      // status is ALWAYS DRAFT on create; only queueTopicSeed can mint WAITING.
      status: "DRAFT",
      version: 1
    }
  });
  return serializeTopicSeed(seed);
}

/**
 * Owner-only optimistic edit of a private DRAFT. The conditional write prevents
 * a stale editor from overwriting a newer version or a concurrently queued seed.
 */
export async function updateTopicSeed(userId, id, input, { db = prisma } = {}) {
  const existing = await getVisibleTopicSeed(userId, id, { db });
  if (!existing) throw fail("api.common.not_found", 404);

  assertPlainObject(input);
  if (existing.status !== "DRAFT") throw fail("topic_seeds.errors.edit_conflict", 409);

  const expectedVersion = normalizeExpectedVersion(input.expectedVersion);
  if (existing.version !== expectedVersion) {
    throw fail("topic_seeds.errors.edit_conflict", 409);
  }

  const data = normalizeTopicSeedPatch(input, existing);
  const result = await db.topicSeed.updateMany({
    where: {
      id: existing.id,
      ownerId: userId,
      status: "DRAFT",
      version: expectedVersion
    },
    data: { ...data, version: { increment: 1 } }
  });
  if (!result || result.count === 0) throw fail("topic_seeds.errors.edit_conflict", 409);

  const updated = await db.topicSeed.findUnique({ where: { id: existing.id } });
  return serializeTopicSeed(updated);
}

/**
 * Deliberate DRAFT -> WAITING transition (§7.4). Freezes the shareable snapshot.
 *
 * - owner-only (foreign/missing -> generic 404);
 * - only a COMPLETE quick seed can be queued (else 400 incomplete);
 * - the owner must consciously confirm the card carries no direct identifier
 *   (else 400 confirmation_required);
 * - version-safe: expectedVersion is a monotonic integer CAS, enforced as part
 *   of the atomic write. updatedAt is display metadata only;
 * - idempotent: re-queuing a WAITING seed returns it unchanged (no new snapshot,
 *   no new object).
 */
export async function queueTopicSeed(
  userId,
  id,
  {
    expectedVersion = null,
    confirmedNoIdentifiers = false,
    confirmedPrivacyReview = false,
    db = prisma
  } = {}
) {
  const existing = await getVisibleTopicSeed(userId, id, { db });
  if (!existing) throw fail("api.common.not_found", 404);

  // Idempotent repeat: already queued -> unchanged, no new snapshot/object.
  if (existing.status === "WAITING") return serializeTopicSeed(existing);

  if (!isCompleteQuickSeedFields(existing)) throw fail("topic_seeds.errors.incomplete", 400);
  if (confirmedNoIdentifiers !== true) throw fail("topic_seeds.errors.confirmation_required", 400);
  const privacy = assessTopicSeedPrivacy(existing);
  if (privacy.direct.length) {
    const error = fail("topic_seeds.errors.direct_identifier_detected", 422);
    error.privacyCategories = privacy.direct;
    throw error;
  }
  if (privacy.indirect.length && confirmedPrivacyReview !== true) {
    const error = fail("topic_seeds.errors.privacy_review_required", 422);
    error.privacyCategories = privacy.indirect;
    throw error;
  }
  const version = normalizeExpectedVersion(expectedVersion);
  if (existing.version !== version) {
    throw fail("topic_seeds.errors.queue_conflict", 409);
  }

  const now = new Date();
  // Atomic optimistic write: flips DRAFT -> WAITING only while updatedAt is still
  // the exact integer version we validated. A concurrent write increments version,
  // so this matches 0 rows and cannot freeze a stale snapshot.
  const result = await db.topicSeed.updateMany({
    where: { id: existing.id, ownerId: userId, status: "DRAFT", version },
    data: {
      status: "WAITING",
      version: { increment: 1 },
      sharedCardSnapshot: buildTopicSeedSharedSnapshot(existing, now.toISOString()),
      privacyAssessment: {
        automaticCheck: "PASSED",
        indirectCategories: privacy.indirect
      },
      privacyReviewedAt: privacy.indirect.length ? now : null,
      ownerConfirmedAt: now,
      sharedAt: now
    }
  });
  if (!result || result.count === 0) throw fail("topic_seeds.errors.queue_conflict", 409);

  const updated = await db.topicSeed.findUnique({ where: { id: existing.id } });
  return serializeTopicSeed(updated);
}

/** Owner-only hard delete for a private DRAFT. The content disappears, while a
 * content-free DataAuditLog receipt survives account deletion by design. */
export async function deleteTopicSeed(
  userId,
  id,
  { expectedVersion = null, db = prisma } = {}
) {
  const version = normalizeExpectedVersion(expectedVersion);
  return withTransaction(db, async (tx) => {
    const existing = await getVisibleTopicSeed(userId, id, { db: tx });
    if (!existing) throw fail("api.common.not_found", 404);
    if (existing.status !== "DRAFT" || existing.covisionCaseId || existing.version !== version) {
      throw fail("topic_seeds.errors.lifecycle_conflict", 409);
    }
    await writeDataAudit({
      db: tx,
      actorUserId: userId,
      targetUserId: userId,
      action: "TOPIC_SEED_DRAFT_DELETED",
      resourceType: "TopicSeed",
      resourceId: existing.id,
      meta: { status: existing.status, version }
    });
    const deleted = await tx.topicSeed.deleteMany({
      where: { id: existing.id, ownerId: userId, status: "DRAFT", covisionCaseId: null, version }
    });
    if (!deleted || deleted.count !== 1) throw fail("topic_seeds.errors.lifecycle_conflict", 409);
    return { id: existing.id, deleted: true };
  });
}

/** WAITING -> DRAFT withdrawal. The frozen shared snapshot and its confirmation
 * are cleared atomically; IN_COVISION/FOLLOW_UP/CLOSED rows are never recalled. */
export async function withdrawTopicSeed(
  userId,
  id,
  { expectedVersion = null, db = prisma } = {}
) {
  const version = normalizeExpectedVersion(expectedVersion);
  return withTransaction(db, async (tx) => {
    const existing = await getVisibleTopicSeed(userId, id, { db: tx });
    if (!existing) throw fail("api.common.not_found", 404);
    if (existing.status !== "WAITING" || existing.covisionCaseId || existing.version !== version) {
      throw fail("topic_seeds.errors.lifecycle_conflict", 409);
    }
    const updated = await tx.topicSeed.updateMany({
      where: {
        id: existing.id,
        ownerId: userId,
        status: "WAITING",
        covisionCaseId: null,
        version
      },
      data: {
        status: "DRAFT",
        version: { increment: 1 },
        sharedCardSnapshot: null,
        privacyAssessment: null,
        privacyReviewedAt: null,
        ownerConfirmedAt: null,
        sharedAt: null
      }
    });
    if (!updated || updated.count !== 1) throw fail("topic_seeds.errors.lifecycle_conflict", 409);
    await writeDataAudit({
      db: tx,
      actorUserId: userId,
      targetUserId: userId,
      action: "TOPIC_SEED_WAITING_WITHDRAWN",
      resourceType: "TopicSeed",
      resourceId: existing.id,
      meta: { fromStatus: "WAITING", toStatus: "DRAFT", fromVersion: version }
    });
    return serializeTopicSeed(await tx.topicSeed.findUnique({ where: { id: existing.id } }));
  });
}
