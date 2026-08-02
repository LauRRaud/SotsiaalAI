import { prisma } from "./prisma.js";
import { normalizeEmail } from "./covisionShared.js";
import { sendCovisionInviteEmails } from "./covisionInvites.js";
import { createClosureFromStageSnapshotsTx } from "./covisionCompletedCases.js";
import { canCreateCovision } from "./covisionAccessShared.js";
import {
  COVISION_STAGE_PHASES,
  COVISION_STAGE_PROGRESS_PHASES,
  COVISION_STAGE_WORK_OBJECT_KINDS,
  COVISION_STAGES,
  COVISION_WORK_OBJECT_KINDS,
  assertCovisionStageGate,
  covisionSessionPublicError,
  normalizeCovisionStageCompletePayload
} from "./covisionSessionShared.js";

export { covisionSessionPublicError };

export const COVISION_SESSION_ACTIONS = Object.freeze([
  "START_SESSION",
  "CONFIRM_PARTICIPANT",
  "INVITE_PARTICIPANT",
  "CONFIRM_CASE",
  "CONFIRM_SETTINGS",
  "SET_PHASE",
  "SUBMIT_WORK_ITEM",
  "SAVE_PRIVATE_STATE",
  "UPDATE_WORK_ITEM",
  "COMPLETE_STAGE",
  "PAUSE",
  "RESUME"
]);

const WORK_ITEM_STATUSES = Object.freeze([
  "private_draft",
  "shared_draft",
  "ready",
  "queued",
  "active",
  "shared",
  "completed",
  "answered",
  "open",
  "owner_confirmed",
  "needs_review",
  "needs_rephrase",
  "resolved",
  "not_applicable",
  "parked",
  "withdrawn",
  "removed"
]);

const MUTATING_ROLES = new Set(["OWNER", "CO_MODERATOR", "SUMMARY_REVIEWER", "PARTICIPANT"]);
const LEADER_ROLES = new Set(["OWNER", "CO_MODERATOR"]);
const ITEM_MANAGER_ROLES = new Set(["OWNER", "CO_MODERATOR", "SUMMARY_REVIEWER"]);
const INVITABLE_ROLES = new Set(["CO_MODERATOR", "SUMMARY_REVIEWER", "PARTICIPANT", "OBSERVER"]);
const LIVE_INVITE_STATUSES = new Set(["INVITED", "ACCEPTED"]);
const JSON_MAX_LENGTH = 32_000;
const SOURCE_LABEL_MAX_LENGTH = 240;
const ACTION_PAYLOAD_KEYS = Object.freeze({
  START_SESSION: new Set(),
  CONFIRM_PARTICIPANT: new Set(["present", "roleConfirmed", "agreementConfirmed", "ready"]),
  INVITE_PARTICIPANT: new Set(["email", "role"]),
  CONFIRM_CASE: new Set(),
  CONFIRM_SETTINGS: new Set(["settings"]),
  SET_PHASE: new Set(["phase"]),
  SUBMIT_WORK_ITEM: new Set(["stage", "kind", "status", "content", "sourceLabel", "order"]),
  SAVE_PRIVATE_STATE: new Set(["stage", "kind", "content"]),
  UPDATE_WORK_ITEM: new Set(["id", "status", "content", "sourceLabel", "order"]),
  PAUSE: new Set(),
  RESUME: new Set()
});

function fail(message, status, code = null, details = null) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  if (details) error.details = details;
  return error;
}

function invalid(code = "INVALID_REQUEST") {
  return fail("api.common.invalid_request", 400, code);
}

function forbidden(code = "FORBIDDEN") {
  return fail("api.common.forbidden", 403, code);
}

function conflict(code = "SESSION_CONFLICT", details = null) {
  return fail("covision.errors.save_failed", 409, code, details);
}

function notFound() {
  return fail("api.common.not_found", 404, "NOT_FOUND");
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requirePlainObject(value) {
  if (!isPlainObject(value)) throw invalid();
  return value;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function assertOnlyKeys(value, allowed) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw invalid("UNKNOWN_FIELD");
  }
}

function normalizeId(value) {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

function normalizeActor(value) {
  const userId = normalizeId(typeof value === "string" ? value : value?.userId);
  const email = typeof value === "object" && typeof value?.email === "string"
    ? value.email.trim().toLowerCase().slice(0, 254)
    : "";
  if (!userId) throw notFound();
  return { userId, email };
}

function normalizeExpectedVersion(value) {
  if (!Number.isInteger(value) || value < 0) throw invalid("EXPECTED_VERSION_REQUIRED");
  return value;
}

function normalizeExpectedUpdatedAt(value) {
  if (typeof value !== "string" || !value.trim() || !Number.isFinite(new Date(value).getTime())) {
    throw conflict("TOPIC_SEED_VERSION_CONFLICT");
  }
  return value;
}

function sameInstant(a, b) {
  const left = a instanceof Date ? a.getTime() : new Date(a).getTime();
  const right = b instanceof Date ? b.getTime() : new Date(b).getTime();
  return Number.isFinite(left) && Number.isFinite(right) && left === right;
}

function cloneJson(value) {
  let json;
  try {
    json = JSON.stringify(value);
  } catch {
    throw invalid("INVALID_JSON_VALUE");
  }
  if (!json || json.length > JSON_MAX_LENGTH) throw invalid("INVALID_JSON_VALUE");
  return JSON.parse(json);
}

function normalizeContent(value) {
  requirePlainObject(value);
  return cloneJson(value);
}

function normalizeOptionalText(value, maxLength = SOURCE_LABEL_MAX_LENGTH) {
  if (value == null) return null;
  if (typeof value !== "string") throw invalid();
  const normalized = value.replace(/\s+/g, " ").trim().slice(0, maxLength);
  return normalized || null;
}

function stageValues() {
  return Array.isArray(COVISION_STAGES)
    ? COVISION_STAGES.map((stage) => Number(stage)).filter(Number.isInteger)
    : Object.keys(COVISION_STAGES || {}).map(Number).filter(Number.isInteger);
}

function normalizeStage(value) {
  if (!Number.isInteger(value) || !stageValues().includes(value)) throw invalid("INVALID_STAGE");
  return value;
}

function phasesForStage(stage) {
  const phases = COVISION_STAGE_PHASES?.[stage] ?? COVISION_STAGE_PHASES?.[String(stage)];
  return Array.isArray(phases) ? phases : [];
}

function initialPhase(stage) {
  return phasesForStage(stage)[0] || "ready";
}

function startedPhase(stage) {
  return phasesForStage(stage)[1] || initialPhase(stage);
}

function normalizePhase(stage, value) {
  if (typeof value !== "string" || !phasesForStage(stage).includes(value)) {
    throw invalid("INVALID_PHASE");
  }
  return value;
}

function normalizePhaseTransition(stage, currentPhase, requestedPhase) {
  const nextPhase = normalizePhase(stage, requestedPhase);
  const phases = COVISION_STAGE_PROGRESS_PHASES?.[stage]
    ?? COVISION_STAGE_PROGRESS_PHASES?.[String(stage)]
    ?? [];
  const currentIndex = phases.indexOf(currentPhase);
  const nextIndex = phases.indexOf(nextPhase);
  if (currentIndex < 0 || nextIndex < currentIndex || nextIndex > currentIndex + 1) {
    throw conflict("PHASE_TRANSITION_CONFLICT");
  }
  return nextPhase;
}

function kindsForStage(stage) {
  const kinds = COVISION_STAGE_WORK_OBJECT_KINDS?.[stage]
    ?? COVISION_STAGE_WORK_OBJECT_KINDS?.[String(stage)];
  return Array.isArray(kinds) ? kinds : [];
}

function normalizeKind(stage, value) {
  if (typeof value !== "string") throw invalid("INVALID_WORK_KIND");
  const kind = value.trim();
  if (!COVISION_WORK_OBJECT_KINDS.includes(kind) || !kindsForStage(stage).includes(kind)) {
    throw invalid("INVALID_WORK_KIND");
  }
  return kind;
}

function normalizeStatus(value, fallback = "shared_draft") {
  if (value == null) return fallback;
  if (typeof value !== "string") throw invalid("INVALID_WORK_STATUS");
  const status = value.trim().toLowerCase();
  if (!WORK_ITEM_STATUSES.includes(status)) throw invalid("INVALID_WORK_STATUS");
  return status;
}

function normalizeOrder(value, fallback = 0) {
  if (value == null) return fallback;
  if (!Number.isInteger(value) || value < 0 || value > 10_000) throw invalid();
  return value;
}

export async function parseCovisionSessionJsonBody(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw invalid();
  }
  return requirePlainObject(body);
}

// Case creation now matches participant access: both specialist roles may own a
// Covision case (owner decision 02.08 — Covision is sold in the service
// provider plan and that plan costs more). Kept as a separate function from
// canUseCovisionRole on purpose: creation and participation are still distinct
// checks, they simply resolve to the same role set today. The client role is
// excluded here as it is in canUseCovisionRole.
// Single source of truth for the rule: canCreateCovision in covisionAccessShared.
export function assertCovisionCreator(auth) {
  if (canCreateCovision({ role: auth?.role, isAdmin: auth?.isAdmin })) return auth;
  throw fail("covision.errors.role_forbidden", 403, "CREATOR_ROLE_FORBIDDEN");
}

export function normalizeCovisionStartRequest(input) {
  requirePlainObject(input);
  assertOnlyKeys(input, new Set(["expectedUpdatedAt"]));
  return { expectedUpdatedAt: normalizeExpectedUpdatedAt(input.expectedUpdatedAt) };
}

export function normalizeCovisionSessionActionRequest(input) {
  requirePlainObject(input);
  assertOnlyKeys(input, new Set(["action", "expectedVersion", "payload"]));
  const action = typeof input.action === "string" ? input.action.trim().toUpperCase() : "";
  if (!COVISION_SESSION_ACTIONS.includes(action)) throw invalid("INVALID_ACTION");
  const expectedVersion = normalizeExpectedVersion(input.expectedVersion);
  const payload = input.payload == null ? {} : requirePlainObject(input.payload);
  if (action === "COMPLETE_STAGE") {
    if (hasOwn(payload, "expectedVersion")) throw invalid("AMBIGUOUS_EXPECTED_VERSION");
    const complete = normalizeCovisionStageCompletePayload({ ...payload, expectedVersion });
    return { action, expectedVersion, payload: complete };
  }
  assertOnlyKeys(payload, ACTION_PAYLOAD_KEYS[action]);
  if (action === "INVITE_PARTICIPANT") {
    return { action, expectedVersion, payload: normalizeParticipantInvite(payload) };
  }
  return { action, expectedVersion, payload };
}

function topicSeedCaseData(seed) {
  const snapshot = requirePlainObject(seed.sharedCardSnapshot);
  const title = normalizeOptionalText(snapshot.title, 160) || "Kovisiooni juhtum";
  const whyNow = normalizeOptionalText(snapshot.whyNow, 16_000);
  const expectedHelpTypes = Array.isArray(snapshot.requestedSupport)
    ? snapshot.requestedSupport.filter((item) => typeof item === "string").slice(0, 20)
    : [];
  const topics = [snapshot.contextType, snapshot.caseType]
    .filter((item) => typeof item === "string" && item.trim())
    .map((item) => item.trim().slice(0, 80));
  return {
    ownerId: seed.ownerId,
    title,
    summary: whyNow,
    anonymizedDescription: whyNow,
    expectedHelpTypes,
    topics,
    tags: topics,
    status: "ACTIVE",
    visibility: "PRIVATE",
    anonymityConfirmedAt: seed.ownerConfirmedAt || seed.sharedAt || new Date(),
    lastActivityAt: new Date()
  };
}

async function withAdvisoryLock(db, key, callback) {
  if (typeof db?.$transaction !== "function") return callback(db);
  return db.$transaction(async (tx) => {
    if (typeof tx?.$executeRaw === "function") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    }
    return callback(tx);
  });
}

function sessionCaseInclude(userId) {
  return {
    owner: {
      select: { id: true, email: true }
    },
    sourceTopicSeed: {
      select: { id: true, status: true }
    },
    participants: {
      orderBy: { createdAt: "asc" },
      include: {
        sessionState: true,
        user: {
          select: {
            id: true,
            profile: {
              select: { firstName: true, lastName: true }
            }
          }
        }
      }
    },
    sessionState: {
      include: {
        workItems: {
          where: { visibility: "shared" },
          orderBy: [{ stage: "asc" }, { order: "asc" }, { createdAt: "asc" }]
        },
        privateStates: {
          where: { userId },
          orderBy: [{ stage: "asc" }, { kind: "asc" }]
        },
        stageSnapshots: {
          orderBy: { stage: "asc" }
        }
      }
    }
  };
}

async function loadSessionCase(db, userId, covisionCaseId) {
  const id = normalizeId(covisionCaseId);
  if (!id) throw notFound();
  const covisionCase = await db.covisionCase.findUnique({
    where: { id },
    include: sessionCaseInclude(userId)
  });
  if (!covisionCase) throw notFound();
  return covisionCase;
}

function resolveAccess(covisionCase, userId, email = "") {
  const participant = (covisionCase.participants || []).find((item) =>
    LIVE_INVITE_STATUSES.has(item.inviteStatus)
    && (
      item.userId === userId
      || (!item.userId && email && String(item.email || "").toLowerCase() === email)
    ));
  if (covisionCase.ownerId === userId) {
    return {
      userId,
      role: "OWNER",
      participant: participant || null,
      inviteStatus: "ACCEPTED"
    };
  }
  if (!participant) return null;
  return {
    userId,
    role: participant.role,
    participant,
    inviteStatus: participant.inviteStatus
  };
}

function serializeParticipant(participant) {
  const state = participant.sessionState || null;
  const displayName = [
    participant.user?.profile?.firstName,
    participant.user?.profile?.lastName
  ].map((part) => String(part || "").trim()).filter(Boolean).join(" ") || null;
  return {
    id: participant.id,
    displayName,
    role: participant.role,
    inviteStatus: participant.inviteStatus,
    state: state ? {
      presentAt: state.presentAt,
      roleConfirmedAt: state.roleConfirmedAt,
      agreementConfirmedAt: state.agreementConfirmedAt,
      readyAt: state.readyAt,
      updatedAt: state.updatedAt
    } : null
  };
}

function serializeWorkItem(item) {
  return {
    id: item.id,
    stage: item.stage,
    kind: item.kind,
    status: item.status,
    visibility: item.visibility,
    authorParticipantId: item.authorParticipantId,
    content: item.content,
    sourceLabel: item.sourceLabel,
    order: item.order,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function serializePrivateState(state) {
  return {
    id: state.id,
    stage: state.stage,
    kind: state.kind,
    content: state.content,
    version: state.version,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt
  };
}

function serializeStageSnapshot(snapshot) {
  return {
    id: snapshot.id,
    stage: snapshot.stage,
    phase: snapshot.phase,
    sessionVersion: snapshot.sessionVersion,
    payload: snapshot.payload,
    completedAt: snapshot.completedAt
  };
}

function serializeSessionCase(covisionCase, access) {
  const session = covisionCase.sessionState;
  const canConfirmParticipant = Boolean(access.participant);
  const invited = access.inviteStatus === "INVITED";
  if (invited) {
    return {
      case: { id: covisionCase.id },
      me: {
        participantId: access.participant?.id || null,
        role: access.role,
        inviteStatus: access.inviteStatus,
        readOnly: true,
        allowedActions: canConfirmParticipant ? ["CONFIRM_PARTICIPANT"] : []
      },
      participants: access.participant ? [serializeParticipant(access.participant)] : [],
      session: session ? {
        version: session.version,
        serverNow: new Date()
      } : null
    };
  }
  return {
    case: {
      id: covisionCase.id,
      title: covisionCase.title,
      status: covisionCase.status,
      updatedAt: covisionCase.updatedAt
    },
    me: {
      participantId: access.participant?.id || null,
      role: access.role,
      inviteStatus: access.inviteStatus,
      readOnly: !MUTATING_ROLES.has(access.role),
      allowedActions:
        access.role === "OBSERVER" && canConfirmParticipant ? ["CONFIRM_PARTICIPANT"] : null
    },
    participants: (covisionCase.participants || []).map(serializeParticipant),
    session: session ? {
      id: session.id,
      stage: session.stage,
      phase: session.phase,
      version: session.version,
      serverNow: new Date(),
      startedAt: session.startedAt,
      stageStartedAt: session.stageStartedAt,
      pausedAt: session.pausedAt,
      totalPausedMs: session.totalPausedMs,
      settings: session.settings ?? null,
      caseConfirmedAt: session.caseConfirmedAt,
      settingsConfirmedAt: session.settingsConfirmedAt,
      updatedAt: session.updatedAt,
      workItems: (session.workItems || []).map(serializeWorkItem),
      privateStates: (session.privateStates || []).map(serializePrivateState),
      stageSnapshots: (session.stageSnapshots || []).map(serializeStageSnapshot)
    } : null
  };
}

export async function getCovisionSessionForUser(actor, covisionCaseId, { db = prisma } = {}) {
  const identity = normalizeActor(actor);
  const covisionCase = await loadSessionCase(db, identity.userId, covisionCaseId);
  const access = resolveAccess(covisionCase, identity.userId, identity.email);
  if (!access) throw notFound();
  return serializeSessionCase(covisionCase, access);
}

/**
 * Owner-only, idempotent WAITING -> IN_COVISION handoff. The frozen generalized
 * snapshot, the case, owner participant and initial session are committed in one
 * advisory-locked transaction; a competing request observes the same case.
 */
export async function startCovisionFromTopicSeed(
  userId,
  topicSeedId,
  { expectedUpdatedAt, db = prisma } = {}
) {
  const requesterId = normalizeId(userId);
  const seedId = normalizeId(topicSeedId);
  if (!requesterId || !seedId) throw notFound();
  const fingerprint = normalizeExpectedUpdatedAt(expectedUpdatedAt);

  const result = await withAdvisoryLock(db, `covisionTopicSeed:${seedId}`, async (tx) => {
    const seed = await tx.topicSeed.findFirst({
      where: { id: seedId, ownerId: requesterId }
    });
    if (!seed) throw notFound();

    if (
      seed.covisionCaseId
      && ["IN_COVISION", "FOLLOW_UP", "CLOSED"].includes(seed.status)
    ) {
      return { seedId: seed.id, covisionCaseId: seed.covisionCaseId, created: false };
    }
    if (seed.status !== "WAITING" || seed.covisionCaseId) {
      throw conflict("TOPIC_SEED_STATE_CONFLICT");
    }
    if (!sameInstant(seed.updatedAt, fingerprint)) {
      throw conflict("TOPIC_SEED_VERSION_CONFLICT");
    }

    const covisionCase = await tx.covisionCase.create({ data: topicSeedCaseData(seed) });
    const participant = await tx.covisionParticipant.create({
      data: {
        covisionCaseId: covisionCase.id,
        userId: requesterId,
        role: "OWNER",
        inviteStatus: "ACCEPTED"
      }
    });
    const session = await tx.covisionSessionState.create({
      data: {
        covisionCaseId: covisionCase.id,
        stage: 1,
        phase: initialPhase(1),
        version: 0
      }
    });
    await tx.covisionParticipantState.create({
      data: {
        sessionId: session.id,
        participantId: participant.id
      }
    });
    const updated = await tx.topicSeed.updateMany({
      where: {
        id: seed.id,
        ownerId: requesterId,
        status: "WAITING",
        covisionCaseId: null,
        updatedAt: seed.updatedAt
      },
      data: {
        status: "IN_COVISION",
        covisionCaseId: covisionCase.id
      }
    });
    if (!updated || updated.count !== 1) throw conflict("TOPIC_SEED_VERSION_CONFLICT");
    return { seedId: seed.id, covisionCaseId: covisionCase.id, created: true };
  });

  return {
    ...result,
    session: await getCovisionSessionForUser(requesterId, result.covisionCaseId, { db })
  };
}

function assertRole(access, allowed) {
  if (!allowed.has(access.role)) throw forbidden("ROLE_FORBIDDEN");
}

function assertParticipant(access) {
  if (!access.participant) throw forbidden("PARTICIPANT_REQUIRED");
  return access.participant;
}

async function createOwnerSession(tx, covisionCase, expectedVersion) {
  if (expectedVersion !== 0) throw conflict("SESSION_VERSION_CONFLICT");
  let participant = (covisionCase.participants || []).find((item) => item.userId === covisionCase.ownerId);
  if (!participant) {
    participant = await tx.covisionParticipant.create({
      data: {
        covisionCaseId: covisionCase.id,
        userId: covisionCase.ownerId,
        role: "OWNER",
        inviteStatus: "ACCEPTED"
      }
    });
  }
  const now = new Date();
  const session = await tx.covisionSessionState.create({
    data: {
      covisionCaseId: covisionCase.id,
      stage: 1,
      phase: startedPhase(1),
      version: 1,
      startedAt: now,
      stageStartedAt: now
    }
  });
  await tx.covisionParticipantState.create({
    data: { sessionId: session.id, participantId: participant.id, presentAt: now }
  });
  await tx.covisionCase.update({
    where: { id: covisionCase.id },
    data: { status: "ACTIVE", lastActivityAt: now }
  });
}

async function bumpSession(tx, session, expectedVersion, data = {}) {
  const result = await tx.covisionSessionState.updateMany({
    where: { id: session.id, version: expectedVersion },
    data: { ...data, version: { increment: 1 } }
  });
  if (!result || result.count !== 1) throw conflict("SESSION_VERSION_CONFLICT");
}

async function assertNoOtherActiveWorkItem(tx, sessionId, stage, excludeId = null) {
  const existing = await tx.covisionWorkItem.findFirst({
    where: {
      sessionId,
      stage,
      visibility: "shared",
      status: "active",
      ...(excludeId ? { id: { not: excludeId } } : {})
    }
  });
  if (existing) throw conflict("ACTIVE_WORK_ITEM_EXISTS");
}

function normalizeParticipantConfirmation(payload) {
  const data = requirePlainObject(payload);
  const fields = ["present", "roleConfirmed", "agreementConfirmed", "ready"];
  const normalized = {};
  for (const field of fields) {
    if (!hasOwn(data, field)) continue;
    if (data[field] !== true) throw invalid("CONFIRMATION_MUST_BE_TRUE");
    normalized[field] = true;
  }
  if (!Object.keys(normalized).length) throw invalid();
  return normalized;
}

function normalizeParticipantInvite(payload) {
  const data = requirePlainObject(payload);
  const email = normalizeEmail(data.email);
  const role = typeof data.role === "string" ? data.role.trim().toUpperCase() : "";
  if (!email || !INVITABLE_ROLES.has(role)) throw invalid("INVALID_PARTICIPANT_INVITE");
  return { email, role };
}

function normalizeSettings(payload) {
  const input = requirePlainObject(payload);
  return normalizeContent(input.settings);
}

function normalizeWorkItemCreate(payload, currentStage) {
  const input = requirePlainObject(payload);
  const stage = hasOwn(input, "stage") ? normalizeStage(input.stage) : currentStage;
  if (stage !== currentStage) throw conflict("STAGE_CONFLICT");
  return {
    stage,
    kind: normalizeKind(stage, input.kind),
    status: normalizeStatus(input.status),
    content: normalizeContent(input.content),
    sourceLabel: normalizeOptionalText(input.sourceLabel),
    order: normalizeOrder(input.order)
  };
}

function normalizePrivateState(payload, currentStage) {
  const input = requirePlainObject(payload);
  const stage = hasOwn(input, "stage") ? normalizeStage(input.stage) : currentStage;
  if (stage !== currentStage) throw conflict("STAGE_CONFLICT");
  return {
    stage,
    kind: normalizeKind(stage, input.kind),
    content: normalizeContent(input.content)
  };
}

function normalizeWorkItemUpdate(payload) {
  const input = requirePlainObject(payload);
  const id = normalizeId(input.id);
  if (!id) throw invalid();
  const data = {};
  if (hasOwn(input, "status")) data.status = normalizeStatus(input.status);
  if (hasOwn(input, "content")) data.content = normalizeContent(input.content);
  if (hasOwn(input, "sourceLabel")) data.sourceLabel = normalizeOptionalText(input.sourceLabel);
  if (hasOwn(input, "order")) data.order = normalizeOrder(input.order);
  if (!Object.keys(data).length) throw invalid();
  return { id, data };
}

const METHOD_ROLE_BY_DB_ROLE = Object.freeze({
  OWNER: "case_owner",
  CO_MODERATOR: "session_leader",
  SUMMARY_REVIEWER: "summary_keeper",
  PARTICIPANT: "participant",
  OBSERVER: "observer"
});

function participantReadiness(covisionCase) {
  const accepted = (covisionCase.participants || [])
    .filter((participant) => participant.inviteStatus === "ACCEPTED");
  return accepted.map((participant) => ({
    participantId: participant.id,
    role: METHOD_ROLE_BY_DB_ROLE[participant.role] || "participant",
    roleConfirmed: Boolean(participant.sessionState?.roleConfirmedAt),
    agreementConfirmed: Boolean(participant.sessionState?.agreementConfirmedAt),
    ready: Boolean(participant.sessionState?.readyAt),
    ...(participant.role === "OBSERVER"
      ? { observerConsent: Boolean(participant.sessionState?.agreementConfirmedAt) }
      : {})
  }));
}

function contentObjects(records) {
  return records
    .map((record) => record?.content)
    .filter(isPlainObject);
}

function firstContentValue(records, key) {
  for (const content of contentObjects(records).reverse()) {
    if (hasOwn(content, key)) return content[key];
  }
  return undefined;
}

function stateByKind(records, kind) {
  return records.find((record) => record.kind === kind) || null;
}

function textFromState(records, kind, ...keys) {
  const content = stateByKind(records, kind)?.content;
  if (!isPlainObject(content)) return null;
  for (const key of keys) {
    if (typeof content[key] === "string" && content[key].trim()) return content[key];
  }
  return null;
}

function objectFromState(records, kind, key) {
  const content = stateByKind(records, kind)?.content;
  if (!isPlainObject(content)) return null;
  const value = isPlainObject(content[key]) ? content[key] : content;
  return isPlainObject(value) ? value : null;
}

function latestBooleanForUser(records, userId, key) {
  return firstContentValue(records.filter((record) => record.userId === userId), key) === true;
}

function stageSevenOwnerConfirmationIsFresh(ownerPrivateStates) {
  const relevantKinds = new Set([
    "selected_direction",
    "next_step",
    "progress_marker",
    "follow_up"
  ]);
  const relevantStates = ownerPrivateStates.filter((state) => relevantKinds.has(state.kind));
  const confirmationState = stateByKind(relevantStates, "follow_up");
  if (!confirmationState || confirmationState.content?.ownerConfirmed !== true) return false;

  const confirmationAt = new Date(confirmationState.updatedAt).getTime();
  const latestEditAt = Math.max(
    ...relevantStates.map((state) => new Date(state.updatedAt).getTime())
  );
  return Number.isFinite(confirmationAt)
    && Number.isFinite(latestEditAt)
    && confirmationAt >= latestEditAt;
}

function workObjectMetadata(item) {
  const content = isPlainObject(item.content) ? item.content : {};
  return {
    id: item.id,
    kind: item.kind,
    status: item.status,
    visibility: item.visibility,
    ...(content.critical === true ? { critical: true } : {}),
    ...(typeof content.resolutionStatus === "string"
      ? { resolutionStatus: content.resolutionStatus }
      : {})
  };
}

async function buildServerStageGateState(tx, covisionCase, session, stage) {
  const workItems = await tx.covisionWorkItem.findMany({
    where: {
      sessionId: session.id,
      stage,
      visibility: "shared",
      status: { not: "removed" }
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }]
  });
  const privateStates = await tx.covisionPrivateState.findMany({
    where: { sessionId: session.id, stage },
    orderBy: { updatedAt: "asc" }
  });
  const ownerPrivateStates = privateStates.filter((state) => state.userId === covisionCase.ownerId);
  const summaryReviewerIds = (covisionCase.participants || [])
    .filter((participant) => (
      participant.role === "SUMMARY_REVIEWER"
      && participant.inviteStatus === "ACCEPTED"
      && participant.userId
      && participant.userId !== covisionCase.ownerId
    ))
    .map((participant) => participant.userId);
  const privacyReviewed = summaryReviewerIds.length > 0
    ? summaryReviewerIds.some((userId) => latestBooleanForUser(privateStates, userId, "privacyReviewed"))
    : firstContentValue(ownerPrivateStates, "privacyReviewed") === true;
  const allRecords = [...workItems, ...privateStates];
  const hasBlockingSafetyOrPrivacyIssue =
    session.settings?.hasBlockingSafetyOrPrivacyIssue === true
    || allRecords.some((record) => record.content?.hasBlockingSafetyOrPrivacyIssue === true);
  const workObjects = workItems.map(workObjectMetadata);
  let evidence;

  if (stage === 1) {
    evidence = {
      participants: participantReadiness(covisionCase),
      caseConfirmed: Boolean(session.caseConfirmedAt),
      settingsConfirmed: Boolean(session.settingsConfirmedAt),
      hasBlockingSafetyOrPrivacyIssue
    };
  } else if (stage === 2) {
    evidence = {
      workObjects,
      ownerPictureConfirmed:
        firstContentValue(ownerPrivateStates, "ownerPictureConfirmed") === true,
      ownerFocusConfirmed:
        firstContentValue(ownerPrivateStates, "ownerFocusConfirmed") === true,
      privacyReviewed,
      hasBlockingSafetyOrPrivacyIssue
    };
  } else if (stage === 3) {
    evidence = {
      workObjects,
      ownerEnough: firstContentValue(ownerPrivateStates, "ownerEnough") === true,
      hasBlockingSafetyOrPrivacyIssue
    };
  } else if (stage === 4) {
    evidence = {
      workObjects,
      ownerReady: firstContentValue(ownerPrivateStates, "ownerReady") === true,
      hasBlockingSafetyOrPrivacyIssue
    };
  } else if (stage === 5) {
    const active = workItems.find((item) => item.status === "active");
    evidence = {
      workObjects,
      activeObjectId: active?.id || null,
      ownerResonanceReady:
        firstContentValue(ownerPrivateStates, "ownerResonanceReady") === true,
      hasBlockingSafetyOrPrivacyIssue
    };
  } else if (stage === 6) {
    const active = workItems.find((item) => item.status === "active");
    evidence = {
      workObjects,
      activeObjectId: active?.id || null,
      impactReviewed: firstContentValue(ownerPrivateStates, "impactReviewed") === true,
      ownerReady: firstContentValue(ownerPrivateStates, "ownerReady") === true,
      hasBlockingSafetyOrPrivacyIssue
    };
  } else if (stage === 7) {
    evidence = {
      selectedDirection:
        textFromState(ownerPrivateStates, "selected_direction", "selectedDirection", "text"),
      nextStep: objectFromState(ownerPrivateStates, "next_step", "nextStep"),
      timeframe: firstContentValue(ownerPrivateStates, "timeframe") ?? null,
      progressMarker:
        textFromState(ownerPrivateStates, "progress_marker", "progressMarker", "text")
        ?? firstContentValue(ownerPrivateStates, "progressMarker")
        ?? null,
      followUp: objectFromState(ownerPrivateStates, "follow_up", "followUp"),
      ownerConfirmed: stageSevenOwnerConfirmationIsFresh(ownerPrivateStates),
      hasBlockingSafetyOrPrivacyIssue
    };
  } else {
    evidence = {
      workObjects,
      packageConfirmed: firstContentValue(ownerPrivateStates, "packageConfirmed") === true,
      followUpConfirmed: firstContentValue(ownerPrivateStates, "followUpConfirmed") === true,
      generalizationDecision:
        firstContentValue(ownerPrivateStates, "generalizationDecision") ?? null,
      learningDecision: firstContentValue(ownerPrivateStates, "learningDecision") ?? null,
      retentionDecision: firstContentValue(ownerPrivateStates, "retentionDecision") ?? null,
      practiceDecision: firstContentValue(ownerPrivateStates, "practiceDecision") ?? null,
      ownerFinalConfirmed: firstContentValue(ownerPrivateStates, "ownerFinalConfirmed") === true,
      hasBlockingSafetyOrPrivacyIssue
    };
  }

  return {
    workItems,
    readiness: participantReadiness(covisionCase),
    evidence,
    privateStateCount: privateStates.length
  };
}

function snapshotPayload(stage, evidence, serverMinimums) {
  return {
    stage,
    evidence,
    participantReadiness: serverMinimums.readiness,
    sharedWorkItems: serverMinimums.workItems.map((item) => ({
      id: item.id,
      kind: item.kind,
      status: item.status,
      authorParticipantId: item.authorParticipantId,
      content: item.content,
      sourceLabel: item.sourceLabel,
      order: item.order
    }))
  };
}

async function inviteParticipant(tx, covisionCase, session, payload) {
  const invitedUser = await tx.user.findUnique({
    where: { email: payload.email },
    select: { id: true }
  });
  if (
    normalizeEmail(covisionCase.owner?.email) === payload.email
    || invitedUser?.id === covisionCase.ownerId
  ) {
    throw conflict("CASE_OWNER_CANNOT_BE_INVITED");
  }

  const participant = (covisionCase.participants || []).find((item) => (
    (invitedUser?.id && item.userId === invitedUser.id)
    || normalizeEmail(item.email) === payload.email
  ));
  if (participant?.role === "OWNER" || participant?.userId === covisionCase.ownerId) {
    throw conflict("CASE_OWNER_CANNOT_BE_INVITED");
  }
  if (participant && LIVE_INVITE_STATUSES.has(participant.inviteStatus)) {
    throw conflict("PARTICIPANT_ALREADY_INVITED");
  }
  if (
    participant?.userId
    && invitedUser?.id
    && participant.userId !== invitedUser.id
  ) {
    throw conflict("PARTICIPANT_IDENTITY_CONFLICT");
  }

  let persisted = participant;
  if (participant) {
    persisted = await tx.covisionParticipant.update({
      where: { id: participant.id },
      data: {
        userId: invitedUser?.id || participant.userId || null,
        email: payload.email,
        role: payload.role,
        inviteStatus: "INVITED"
      }
    });
    if (participant.sessionState) {
      await tx.covisionParticipantState.update({
        where: { participantId: participant.id },
        data: {
          presentAt: null,
          roleConfirmedAt: null,
          agreementConfirmedAt: null,
          readyAt: null
        }
      });
    }
  } else {
    persisted = await tx.covisionParticipant.create({
      data: {
        covisionCaseId: covisionCase.id,
        userId: invitedUser?.id || null,
        email: payload.email,
        role: payload.role,
        inviteStatus: "INVITED"
      }
    });
  }
  if (!participant?.sessionState) {
    await tx.covisionParticipantState.create({
      data: { sessionId: session.id, participantId: persisted.id }
    });
  }
  return { email: payload.email };
}

async function applyLockedAction(tx, covisionCase, access, request) {
  const { action, expectedVersion, payload } = request;
  const session = covisionCase.sessionState;

  if (!session) {
    if (action !== "START_SESSION" || access.role !== "OWNER") {
      throw conflict("SESSION_NOT_STARTED");
    }
    await createOwnerSession(tx, covisionCase, expectedVersion);
    return;
  }

  if (session.version !== expectedVersion) throw conflict("SESSION_VERSION_CONFLICT");
  if (session.phase === "complete" || ["CLOSED", "ARCHIVED"].includes(covisionCase.status)) {
    throw conflict("SESSION_STAGE_WORK_COMPLETED");
  }
  if ((session.stageSnapshots || []).some((snapshot) => snapshot.stage === 8)) {
    throw conflict("SESSION_STAGE_WORK_COMPLETED");
  }
  const observerConfirmation = action === "CONFIRM_PARTICIPANT" && access.role === "OBSERVER";
  if (!MUTATING_ROLES.has(access.role) && !observerConfirmation) {
    throw forbidden("ROLE_FORBIDDEN");
  }
  if (access.inviteStatus !== "ACCEPTED" && action !== "CONFIRM_PARTICIPANT") {
    throw forbidden("INVITATION_NOT_ACCEPTED");
  }
  if (session.pausedAt && !["RESUME", "SAVE_PRIVATE_STATE"].includes(action)) {
    throw conflict("SESSION_PAUSED");
  }

  const now = new Date();
  const sessionPatch = {};
  let postCommit = null;

  if (action === "START_SESSION") {
    assertRole(access, LEADER_ROLES);
    if (session.startedAt) throw conflict("SESSION_ALREADY_STARTED");
    sessionPatch.startedAt = now;
    sessionPatch.stageStartedAt = now;
    sessionPatch.phase = startedPhase(session.stage);
  } else if (action === "CONFIRM_PARTICIPANT") {
    const participant = assertParticipant(access);
    const confirmation = normalizeParticipantConfirmation(payload);
    if ((confirmation.agreementConfirmed || confirmation.ready) && !session.settingsConfirmedAt) {
      throw conflict("SETTINGS_NOT_CONFIRMED");
    }
    const existingState = participant.sessionState;
    const roleConfirmedAt = confirmation.roleConfirmed ? now : existingState?.roleConfirmedAt;
    const agreementConfirmedAt = confirmation.agreementConfirmed ? now : existingState?.agreementConfirmedAt;
    if (confirmation.ready && (!roleConfirmedAt || !agreementConfirmedAt)) {
      throw invalid("PARTICIPANT_NOT_READY");
    }
    const stateData = {
      presentAt: confirmation.present ? now : existingState?.presentAt,
      roleConfirmedAt,
      agreementConfirmedAt,
      readyAt: confirmation.ready ? now : existingState?.readyAt
    };
    if (existingState) {
      await tx.covisionParticipantState.update({
        where: { participantId: participant.id },
        data: stateData
      });
    } else {
      await tx.covisionParticipantState.create({
        data: { sessionId: session.id, participantId: participant.id, ...stateData }
      });
    }
    if (
      confirmation.agreementConfirmed
      && (!participant.userId || participant.inviteStatus === "INVITED")
    ) {
      await tx.covisionParticipant.update({
        where: { id: participant.id },
        data: {
          ...(!participant.userId ? { userId: access.userId } : {}),
          ...(confirmation.agreementConfirmed && participant.inviteStatus === "INVITED"
            ? { inviteStatus: "ACCEPTED" }
            : {})
        }
      });
    }
  } else if (action === "INVITE_PARTICIPANT") {
    assertRole(access, LEADER_ROLES);
    postCommit = {
      invite: await inviteParticipant(tx, covisionCase, session, payload)
    };
  } else if (action === "CONFIRM_CASE") {
    assertRole(access, new Set(["OWNER"]));
    sessionPatch.caseConfirmedAt = now;
  } else if (action === "CONFIRM_SETTINGS") {
    assertRole(access, LEADER_ROLES);
    if (session.stage !== 1 || session.settingsConfirmedAt) {
      throw conflict("SETTINGS_ALREADY_CONFIRMED");
    }
    sessionPatch.settings = normalizeSettings(payload);
    sessionPatch.settingsConfirmedAt = now;
  } else if (action === "SET_PHASE") {
    assertRole(access, LEADER_ROLES);
    sessionPatch.phase = normalizePhaseTransition(session.stage, session.phase, payload.phase);
  } else if (action === "SUBMIT_WORK_ITEM") {
    const participant = assertParticipant(access);
    const item = normalizeWorkItemCreate(payload, session.stage);
    if (item.status === "active") {
      await assertNoOtherActiveWorkItem(tx, session.id, session.stage);
    }
    await tx.covisionWorkItem.create({
      data: {
        sessionId: session.id,
        authorParticipantId: participant.id,
        visibility: "shared",
        ...item
      }
    });
  } else if (action === "SAVE_PRIVATE_STATE") {
    const participant = assertParticipant(access);
    const privateUserId = participant.userId;
    if (!privateUserId) throw forbidden("PARTICIPANT_USER_REQUIRED");
    const state = normalizePrivateState(payload, session.stage);
    const existing = await tx.covisionPrivateState.findFirst({
      where: {
        sessionId: session.id,
        userId: privateUserId,
        stage: state.stage,
        kind: state.kind
      }
    });
    if (existing) {
      await tx.covisionPrivateState.update({
        where: { id: existing.id },
        data: { content: state.content, version: { increment: 1 } }
      });
    } else {
      await tx.covisionPrivateState.create({
        data: { sessionId: session.id, userId: privateUserId, ...state }
      });
    }
  } else if (action === "UPDATE_WORK_ITEM") {
    const participant = assertParticipant(access);
    const update = normalizeWorkItemUpdate(payload);
    const item = await tx.covisionWorkItem.findFirst({
      where: {
        id: update.id,
        sessionId: session.id,
        stage: session.stage,
        visibility: "shared"
      }
    });
    if (!item) throw notFound();
    const isAuthor = item.authorParticipantId === participant.id;
    if (!isAuthor && !ITEM_MANAGER_ROLES.has(access.role)) throw forbidden("WORK_ITEM_FORBIDDEN");
    if (!isAuthor && (hasOwn(update.data, "content") || hasOwn(update.data, "sourceLabel"))) {
      throw forbidden("WORK_ITEM_CONTENT_FORBIDDEN");
    }
    if (update.data.status === "active") {
      await assertNoOtherActiveWorkItem(tx, session.id, session.stage, item.id);
    }
    await tx.covisionWorkItem.update({ where: { id: item.id }, data: update.data });
  } else if (action === "COMPLETE_STAGE") {
    assertRole(access, LEADER_ROLES);
    if (session.stage === 1 && !session.startedAt) throw conflict("SESSION_NOT_STARTED");
    if (payload.stage !== session.stage) throw conflict("STAGE_CONFLICT");
    if (payload.phase !== session.phase) throw conflict("PHASE_CONFLICT");
    const serverMinimums = await buildServerStageGateState(
      tx,
      covisionCase,
      session,
      payload.stage
    );
    const gate = assertCovisionStageGate({
      stage: payload.stage,
      phase: payload.phase,
      expectedVersion,
      evidence: serverMinimums.evidence
    });
    const existingSnapshot = await tx.covisionStageSnapshot.findFirst({
      where: { sessionId: session.id, stage: session.stage }
    });
    if (existingSnapshot) throw conflict("STAGE_ALREADY_COMPLETED");
    const createdSnapshot = await tx.covisionStageSnapshot.create({
      data: {
        sessionId: session.id,
        stage: session.stage,
        phase: session.phase,
        sessionVersion: expectedVersion + 1,
        payload: snapshotPayload(session.stage, gate.evidence, serverMinimums),
        completedById: access.userId,
        completedAt: now
      }
    });
    if (session.stage < 8) {
      sessionPatch.stage = session.stage + 1;
      sessionPatch.phase = initialPhase(session.stage + 1);
      sessionPatch.stageStartedAt = now;
    } else {
      await createClosureFromStageSnapshotsTx(tx, covisionCase, session, {
        stage8Snapshot: createdSnapshot,
        now,
        closedById: access.userId
      });
      sessionPatch.phase = "complete";
    }
  } else if (action === "PAUSE") {
    assertRole(access, LEADER_ROLES);
    if (session.pausedAt) throw conflict("SESSION_ALREADY_PAUSED");
    sessionPatch.pausedAt = now;
  } else if (action === "RESUME") {
    assertRole(access, LEADER_ROLES);
    if (!session.pausedAt) throw conflict("SESSION_NOT_PAUSED");
    sessionPatch.totalPausedMs = session.totalPausedMs
      + Math.max(0, now.getTime() - new Date(session.pausedAt).getTime());
    sessionPatch.pausedAt = null;
  }

  await bumpSession(tx, session, expectedVersion, sessionPatch);
  await tx.covisionCase.update({
    where: { id: covisionCase.id },
    data: { lastActivityAt: now }
  });
  return postCommit;
}

export async function applyCovisionSessionAction(
  actor,
  covisionCaseId,
  input,
  { db = prisma, sendInvite = sendCovisionInviteEmails } = {}
) {
  const identity = normalizeActor(actor);
  const caseId = normalizeId(covisionCaseId);
  if (!caseId) throw notFound();
  const request = normalizeCovisionSessionActionRequest(input);

  const postCommit = await withAdvisoryLock(db, `covisionSession:${caseId}`, async (tx) => {
    const covisionCase = await loadSessionCase(tx, identity.userId, caseId);
    const access = resolveAccess(covisionCase, identity.userId, identity.email);
    if (!access) throw notFound();
    return applyLockedAction(tx, covisionCase, access, request);
  });

  if (postCommit?.invite) {
    try {
      await sendInvite({
        covisionCaseId: caseId,
        emails: [postCommit.invite.email],
        inviterEmail: identity.email || undefined
      });
    } catch {
      console.error("[covision-session] invite email failed");
    }
  }

  return getCovisionSessionForUser(identity, caseId, { db });
}
