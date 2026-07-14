import { prisma } from "@/lib/prisma";
import { normalizeText } from "@/lib/covisionShared";

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

const TOPIC_SEED_PUBLIC_ERRORS = Object.freeze({
  "api.common.unauthorized": 401,
  "api.common.not_found": 404,
  "covision.errors.role_forbidden": 403,
  "topic_seeds.errors.invalid": 400,
  "topic_seeds.errors.incomplete": 400,
  "topic_seeds.errors.confirmation_required": 400,
  "topic_seeds.errors.queue_conflict": 409,
  "topic_seeds.errors.edit_conflict": 409
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
  if (
    hasOwn(input, "expectedUpdatedAt") &&
    input.expectedUpdatedAt != null &&
    typeof input.expectedUpdatedAt !== "string"
  ) {
    throw fail("topic_seeds.errors.invalid", 400);
  }
  if (hasOwn(input, "confirmedNoIdentifiers") && typeof input.confirmedNoIdentifiers !== "boolean") {
    throw fail("topic_seeds.errors.invalid", 400);
  }
  return {
    expectedUpdatedAt: input.expectedUpdatedAt ?? null,
    confirmedNoIdentifiers: input.confirmedNoIdentifiers === true
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

function sameUpdatedAtFingerprint(actual, expected) {
  if (actual == null || expected == null) return false;
  const a = actual instanceof Date ? actual.getTime() : new Date(actual).getTime();
  const b = expected instanceof Date ? expected.getTime() : new Date(expected).getTime();
  return Number.isFinite(a) && Number.isFinite(b) && a === b;
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
    sharedCardSnapshot: seed.sharedCardSnapshot ?? null,
    ownerConfirmedAt: seed.ownerConfirmedAt ?? null,
    sharedAt: seed.sharedAt ?? null,
    covisionCaseId: seed.covisionCaseId ?? null,
    createdAt: seed.createdAt,
    updatedAt: seed.updatedAt
  };
}

export async function listTopicSeeds(userId, { db = prisma } = {}) {
  const seeds = await db.topicSeed.findMany({
    where: { ownerId: userId },
    orderBy: [{ updatedAt: "desc" }]
  });
  return seeds.map(serializeTopicSeed);
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
      status: "DRAFT"
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

  const expectedUpdatedAt = input.expectedUpdatedAt;
  if (
    expectedUpdatedAt != null &&
    typeof expectedUpdatedAt !== "string" &&
    !(expectedUpdatedAt instanceof Date)
  ) {
    throw fail("topic_seeds.errors.invalid", 400);
  }
  if (!sameUpdatedAtFingerprint(existing.updatedAt, expectedUpdatedAt)) {
    throw fail("topic_seeds.errors.edit_conflict", 409);
  }

  const data = normalizeTopicSeedPatch(input, existing);
  const result = await db.topicSeed.updateMany({
    where: {
      id: existing.id,
      ownerId: userId,
      status: "DRAFT",
      updatedAt: existing.updatedAt
    },
    data
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
 * - version-safe: expectedUpdatedAt must be present, valid and equal to the fresh
 *   updatedAt, enforced as part of an ATOMIC conditional write. A missing, invalid
 *   or stale fingerprint -> generic 409 and nothing is written;
 * - idempotent: re-queuing a WAITING seed returns it unchanged (no new snapshot,
 *   no new object).
 */
export async function queueTopicSeed(userId, id, { expectedUpdatedAt = null, confirmedNoIdentifiers = false, db = prisma } = {}) {
  const existing = await getVisibleTopicSeed(userId, id, { db });
  if (!existing) throw fail("api.common.not_found", 404);

  // Idempotent repeat: already queued -> unchanged, no new snapshot/object.
  if (existing.status === "WAITING") return serializeTopicSeed(existing);

  if (!isCompleteQuickSeedFields(existing)) throw fail("topic_seeds.errors.incomplete", 400);
  if (confirmedNoIdentifiers !== true) throw fail("topic_seeds.errors.confirmation_required", 400);
  if (!sameUpdatedAtFingerprint(existing.updatedAt, expectedUpdatedAt)) {
    throw fail("topic_seeds.errors.queue_conflict", 409);
  }

  const now = new Date();
  // Atomic optimistic write: flips DRAFT -> WAITING only while updatedAt is still
  // the exact snapshot we validated. A concurrent write changes updatedAt, so this
  // matches 0 rows and becomes a generic 409 without writing a stale snapshot.
  const result = await db.topicSeed.updateMany({
    where: { id: existing.id, ownerId: userId, status: "DRAFT", updatedAt: existing.updatedAt },
    data: {
      status: "WAITING",
      sharedCardSnapshot: buildTopicSeedSharedSnapshot(existing, now.toISOString()),
      ownerConfirmedAt: now,
      sharedAt: now
    }
  });
  if (!result || result.count === 0) throw fail("topic_seeds.errors.queue_conflict", 409);

  const updated = await db.topicSeed.findUnique({ where: { id: existing.id } });
  return serializeTopicSeed(updated);
}
