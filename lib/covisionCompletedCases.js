import { prisma } from "./prisma.js";
import { createPracticeDraftFromClosureTx } from "./effectivePractices.js";
import { appendCovisionAuditEvent } from "./covisionAudit.js";

const MAX_TEXT = 4_000;
const MAX_SHORT = 240;
const PUBLIC_ERRORS = Object.freeze({
  "api.common.unauthorized": 401,
  "api.common.not_found": 404,
  "api.common.forbidden": 403,
  "completed_cases.errors.invalid": 400,
  "completed_cases.errors.not_ready": 409,
  "completed_cases.errors.conflict": 409
});

const LIFECYCLE_VALUES = new Set([
  "FOLLOW_UP_PENDING",
  "DECISION_PENDING",
  "CLOSED",
  "CONTINUATION_PENDING",
  "ARCHIVED"
]);
const SCOPES = new Set(["mine", "group", "visible"]);
const SORTS = new Set(["attention", "follow_up", "newest", "oldest", "title"]);
const DECISIONS = new Set(["close", "continue", "new_follow_up", "practice_candidate"]);

function fail(message, status, code = null) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

function invalid() {
  return fail("completed_cases.errors.invalid", 400, "INVALID_REQUEST");
}

function notFound() {
  return fail("api.common.not_found", 404, "NOT_FOUND");
}

function forbidden() {
  return fail("api.common.forbidden", 403, "FORBIDDEN");
}

function conflict(code = "VERSION_CONFLICT") {
  return fail("completed_cases.errors.conflict", 409, code);
}

function notReady(code = "STAGE_EIGHT_REQUIRED") {
  return fail("completed_cases.errors.not_ready", 409, code);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainObject(value) {
  if (!isPlainObject(value)) throw invalid();
  return value;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function assertOnlyKeys(value, allowed) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw invalid();
  }
}

function normalizeId(value) {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

function normalizeActor(value) {
  const userId = normalizeId(typeof value === "string" ? value : value?.userId);
  if (!userId) throw notFound();
  return { userId };
}

function normalizeText(value, maxLength = MAX_TEXT, { required = false } = {}) {
  if (value == null) {
    if (required) throw invalid();
    return null;
  }
  if (typeof value !== "string") throw invalid();
  const text = value.replace(/\s+/g, " ").trim().slice(0, maxLength);
  if (required && !text) throw invalid();
  return text || null;
}

function normalizeExpectedVersion(value) {
  if (!Number.isInteger(value) || value < 0) throw invalid();
  return value;
}

export async function parseCompletedCaseJsonBody(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw invalid();
  }
  return assertPlainObject(body);
}

export function covisionCompletedCasePublicError(error) {
  const messageKey = String(error?.message || "").trim();
  const status = Number(error?.status);
  return PUBLIC_ERRORS[messageKey] === status
    ? { messageKey, status }
    : { messageKey: "completed_cases.errors.request_failed", status: 500 };
}

async function withLock(db, key, callback) {
  if (typeof db?.$transaction !== "function") return callback(db);
  return db.$transaction(async (tx) => {
    if (typeof tx?.$executeRaw === "function") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    }
    return callback(tx);
  });
}

function accessWhere(userId) {
  return {
    OR: [
      { ownerId: userId },
      {
        assignedFollowUpUserId: userId,
        lifecycleStatus: "FOLLOW_UP_PENDING",
        followUps: {
          some: { assignedToUserId: userId, status: "SCHEDULED" }
        }
      },
      {
        covisionCase: {
          participants: { some: { userId, inviteStatus: "ACCEPTED" } }
        }
      }
    ]
  };
}

function scopeWhere(userId, scope) {
  if (scope === "mine") {
    return {
      OR: [
        { ownerId: userId },
        {
          assignedFollowUpUserId: userId,
          lifecycleStatus: "FOLLOW_UP_PENDING",
          followUps: {
            some: { assignedToUserId: userId, status: "SCHEDULED" }
          }
        }
      ]
    };
  }
  if (scope === "group") {
    return {
      covisionCase: {
        participants: { some: { userId, inviteStatus: "ACCEPTED" } }
      },
      NOT: { ownerId: userId }
    };
  }
  return accessWhere(userId);
}

const listInclude = Object.freeze({
  owner: {
    select: {
      id: true,
      profile: { select: { firstName: true, lastName: true } }
    }
  },
  assignedFollowUpUser: {
    select: {
      id: true,
      profile: { select: { firstName: true, lastName: true } }
    }
  },
  continuationTopicSeed: { select: { id: true, status: true } },
  effectivePractice: { select: { publicId: true, status: true } },
  covisionCase: {
    select: {
      participants: {
        where: { inviteStatus: "ACCEPTED" },
        select: { userId: true, inviteStatus: true }
      }
    }
  },
  followUps: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      id: true,
      status: true,
      scheduleLabel: true,
      scheduledFor: true,
      responsibleParty: true,
      channel: true,
      assignedToUserId: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true
    }
  }
});

const detailInclude = Object.freeze({
  ...listInclude,
  followUps: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      scheduleLabel: true,
      scheduledFor: true,
      responsibleParty: true,
      channel: true,
      assignedToUserId: true,
      whatWasDone: true,
      whatChanged: true,
      learning: true,
      resourceUsed: true,
      conditionChanged: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true
    }
  }
});

function userName(user) {
  const profile = user?.profile || {};
  return [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || null;
}

function dateOnly(value) {
  const date = new Date(value || 0);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

export function deriveCompletedCaseAttention(closure, now = new Date()) {
  if (["CLOSED", "CONTINUATION_PENDING", "ARCHIVED"].includes(closure?.lifecycleStatus)) {
    return "NONE";
  }
  if (closure?.lifecycleStatus === "DECISION_PENDING") return "DECISION_REQUIRED";
  const followUp = Array.isArray(closure?.followUps) ? closure.followUps[0] : null;
  if (!followUp || followUp.status !== "SCHEDULED") return "UNSCHEDULED";
  if (!followUp.scheduledFor) return "UPCOMING";
  const today = dateOnly(now);
  const due = dateOnly(followUp.scheduledFor);
  if (due === today) return "DUE_TODAY";
  return due < today ? "OVERDUE" : "UPCOMING";
}

function resolveAccessRole(closure, userId) {
  if (closure.ownerId === userId) return "OWNER";
  const hasActiveAssignment = closure.lifecycleStatus === "FOLLOW_UP_PENDING"
    && closure.assignedFollowUpUserId === userId
    && (closure.followUps || []).some((followUp) => (
      followUp.status === "SCHEDULED" && followUp.assignedToUserId === userId
    ));
  if (hasActiveAssignment) return "FOLLOW_UP_ASSIGNEE";
  if ((closure.covisionCase?.participants || []).some((participant) => (
    participant.userId === userId && participant.inviteStatus === "ACCEPTED"
  ))) return "PARTICIPANT";
  return null;
}

function serializeFollowUp(followUp, { detail = false } = {}) {
  if (!followUp) return null;
  return {
    status: followUp.status,
    scheduleLabel: followUp.scheduleLabel,
    scheduledFor: followUp.scheduledFor,
    responsibleParty: followUp.responsibleParty,
    channel: followUp.channel,
    completedAt: followUp.completedAt,
    createdAt: followUp.createdAt,
    updatedAt: followUp.updatedAt,
    ...(detail ? {
      whatWasDone: followUp.whatWasDone,
      whatChanged: followUp.whatChanged,
      learning: followUp.learning,
      resourceUsed: followUp.resourceUsed,
      conditionChanged: followUp.conditionChanged
    } : {})
  };
}

function serializeClosure(closure, userId, { detail = false, ownerPackage = null } = {}) {
  const accessRole = resolveAccessRole(closure, userId);
  if (!accessRole) throw notFound();
  const isOwner = accessRole === "OWNER";
  const canViewFollowUpDetail = isOwner || accessRole === "FOLLOW_UP_ASSIGNEE";
  const followUps = (closure.followUps || []).map((item) => serializeFollowUp(item, {
    detail: detail && canViewFollowUpDetail
  }));
  return {
    id: closure.id,
    generalizedTitle: closure.generalizedTitle,
    workFocus: closure.workFocus,
    selectedDirection: closure.selectedDirection,
    nextStep: closure.nextStep,
    timeframe: closure.timeframe,
    progressMarker: closure.progressMarker,
    sessionStartedAt: closure.sessionStartedAt,
    closedAt: closure.closedAt,
    lifecycleStatus: closure.lifecycleStatus,
    attentionStatus: deriveCompletedCaseAttention(closure),
    followUpStatus: followUps[0]?.status || null,
    ...(isOwner ? {
      practiceStatus: closure.practiceStatus,
      practice: closure.effectivePractice
        ? { id: closure.effectivePractice.publicId, status: closure.effectivePractice.status }
        : null
    } : {}),
    packageStatus: closure.packageStatus,
    retentionStatus: closure.retentionStatus,
    version: closure.version,
    owner: { name: userName(closure.owner), isMe: isOwner },
    assignedFollowUpUser: closure.assignedFollowUpUser
      ? { name: userName(closure.assignedFollowUpUser) }
      : null,
    myAccessRole: accessRole,
    package: {
      status: closure.packageStatus,
      contentVisible: isOwner,
      ...(detail && isOwner && ownerPackage ? { content: ownerPackage.content } : {})
    },
    followUps: detail ? followUps : undefined,
    followUp: followUps[0] || null,
    ...(detail && isOwner ? {
      decisionNote: closure.decisionNote || null,
      links: {
        sourceTopicSeedId: closure.sourceTopicSeedId || null,
        continuationTopicSeed: closure.continuationTopicSeed
          ? { id: closure.continuationTopicSeed.id, status: closure.continuationTopicSeed.status }
          : null
      }
    } : {}),
    createdAt: closure.createdAt,
    updatedAt: closure.updatedAt
  };
}

function normalizeListQuery(input = {}) {
  const scope = SCOPES.has(input.scope) ? input.scope : "visible";
  const sort = SORTS.has(input.sort) ? input.sort : "attention";
  const status = String(input.status || "").trim().toUpperCase();
  if (status && !LIFECYCLE_VALUES.has(status)) throw invalid();
  const q = normalizeText(input.q, 120) || "";
  return { scope, sort, status, q };
}

function attentionWeight(value) {
  return ({ OVERDUE: 0, DUE_TODAY: 1, DECISION_REQUIRED: 2, UNSCHEDULED: 3, UPCOMING: 4, NONE: 5 })[value] ?? 6;
}

function sortClosures(items, sort) {
  return [...items].sort((left, right) => {
    const tie = String(right.id).localeCompare(String(left.id));
    if (sort === "title") return left.generalizedTitle.localeCompare(right.generalizedTitle, "et") || tie;
    if (sort === "oldest") return new Date(left.closedAt) - new Date(right.closedAt) || tie;
    if (sort === "newest") return new Date(right.closedAt) - new Date(left.closedAt) || tie;
    if (sort === "follow_up") {
      const leftDate = new Date(left.followUp?.scheduledFor || "9999-12-31").getTime();
      const rightDate = new Date(right.followUp?.scheduledFor || "9999-12-31").getTime();
      return leftDate - rightDate || tie;
    }
    return attentionWeight(left.attentionStatus) - attentionWeight(right.attentionStatus)
      || new Date(right.closedAt) - new Date(left.closedAt)
      || tie;
  });
}

export async function listCompletedCases(actor, query = {}, { db = prisma } = {}) {
  const { userId } = normalizeActor(actor);
  const normalized = normalizeListQuery(query);
  const where = {
    ...scopeWhere(userId, normalized.scope),
    ...(normalized.status ? { lifecycleStatus: normalized.status } : {}),
    ...(normalized.q ? {
      AND: [{
        OR: [
          { generalizedTitle: { contains: normalized.q, mode: "insensitive" } },
          { workFocus: { contains: normalized.q, mode: "insensitive" } },
          { selectedDirection: { contains: normalized.q, mode: "insensitive" } },
          { nextStep: { contains: normalized.q, mode: "insensitive" } },
          { owner: { profile: { is: { firstName: { contains: normalized.q, mode: "insensitive" } } } } },
          { owner: { profile: { is: { lastName: { contains: normalized.q, mode: "insensitive" } } } } }
        ]
      }]
    } : {})
  };
  const rows = await db.covisionClosure.findMany({
    where,
    include: listInclude,
    orderBy: [{ closedAt: "desc" }, { id: "desc" }]
  });
  const cases = sortClosures(rows.map((row) => serializeClosure(row, userId)), normalized.sort);
  return {
    cases,
    counts: {
      total: cases.length,
      followUp: cases.filter((item) => item.lifecycleStatus === "FOLLOW_UP_PENDING").length,
      attention: cases.filter((item) => ["OVERDUE", "DUE_TODAY", "DECISION_REQUIRED"].includes(item.attentionStatus)).length,
      closed: cases.filter((item) => item.lifecycleStatus === "CLOSED").length,
      continuation: cases.filter((item) => item.lifecycleStatus === "CONTINUATION_PENDING").length,
      practice: cases.filter((item) => item.practiceStatus && item.practiceStatus !== "NONE").length
    }
  };
}

async function loadVisibleClosure(db, userId, closureId, include = detailInclude) {
  const id = normalizeId(closureId);
  if (!id) throw notFound();
  const closure = await db.covisionClosure.findFirst({
    where: { id, ...accessWhere(userId) },
    include
  });
  if (!closure || !resolveAccessRole(closure, userId)) throw notFound();
  return closure;
}

export async function getCompletedCaseDetail(actor, closureId, { db = prisma } = {}) {
  const { userId } = normalizeActor(actor);
  const closure = await loadVisibleClosure(db, userId, closureId);
  const ownerPackage = closure.ownerId === userId
    ? await db.covisionOwnerPackage.findUnique({ where: { closureId: closure.id } })
    : null;
  return serializeClosure(closure, userId, { detail: true, ownerPackage });
}

function snapshotByStage(session, stage) {
  return (session?.stageSnapshots || []).find((snapshot) => Number(snapshot.stage) === stage) || null;
}

function snapshotEvidence(snapshot) {
  const payload = isPlainObject(snapshot?.payload) ? snapshot.payload : {};
  return isPlainObject(payload.evidence) ? payload.evidence : {};
}

function snapshotItems(snapshot) {
  const payload = isPlainObject(snapshot?.payload) ? snapshot.payload : {};
  return Array.isArray(payload.sharedWorkItems) ? payload.sharedWorkItems : [];
}

function firstText(value) {
  if (typeof value === "string" && value.trim()) return value.replace(/\s+/g, " ").trim();
  if (!isPlainObject(value)) return null;
  for (const key of ["text", "title", "question", "label", "summary", "description"]) {
    if (typeof value[key] === "string" && value[key].trim()) return value[key].replace(/\s+/g, " ").trim();
  }
  if (isPlainObject(value.nextStep)) return firstText(value.nextStep);
  return null;
}

function itemText(snapshot, kinds) {
  const allowed = new Set(kinds);
  for (const item of snapshotItems(snapshot)) {
    if (!allowed.has(item?.kind)) continue;
    const text = firstText(item.content);
    if (text) return text;
  }
  return null;
}

export function parseScheduledFor(value) {
  const text = String(value || "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const european = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  let year;
  let month;
  let day;
  if (iso) [, year, month, day] = iso;
  if (european) [, day, month, year] = european;
  if (!year) return null;
  const normalizedYear = String(year).padStart(4, "0");
  const normalizedMonth = String(month).padStart(2, "0");
  const normalizedDay = String(day).padStart(2, "0");
  const date = new Date(`${normalizedYear}-${normalizedMonth}-${normalizedDay}T12:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return null;
  return date.getUTCFullYear() === Number(normalizedYear)
    && date.getUTCMonth() + 1 === Number(normalizedMonth)
    && date.getUTCDate() === Number(normalizedDay)
    ? date
    : null;
}

function closureSource(covisionCase) {
  const session = covisionCase.sessionState;
  const stage2 = snapshotByStage(session, 2);
  const stage3 = snapshotByStage(session, 3);
  const stage7 = snapshotByStage(session, 7);
  const stage8 = snapshotByStage(session, 8);
  if (!stage7 || !stage8 || session?.phase !== "complete") throw notReady();
  const seven = snapshotEvidence(stage7);
  const eight = snapshotEvidence(stage8);
  const selectedDirection = normalizeText(seven.selectedDirection, MAX_TEXT, { required: true });
  const nextStep = normalizeText(firstText(seven.nextStep), MAX_TEXT, { required: true });
  const timeframe = normalizeText(seven.timeframe, MAX_SHORT, { required: true });
  const progressMarker = normalizeText(firstText(seven.progressMarker), MAX_TEXT, { required: true });
  const followUp = isPlainObject(seven.followUp) ? seven.followUp : null;
  const scheduleLabel = normalizeText(followUp?.when, MAX_SHORT, { required: true });
  const responsibleParty = normalizeText(followUp?.responsibleParty, 80, { required: true });
  const channel = normalizeText(followUp?.channel, 80, { required: true });
  const workFocus = normalizeText(
    itemText(stage3, ["question", "open_question"]) || itemText(stage2, ["case_anchor"]),
    MAX_TEXT,
    { required: true }
  );
  const generalizedTitle = normalizeText(
    itemText(stage8, ["group_generalization"]) || covisionCase.title,
    180,
    { required: true }
  );
  if (
    seven.ownerConfirmed !== true
    || eight.packageConfirmed !== true
    || eight.followUpConfirmed !== true
    || eight.ownerFinalConfirmed !== true
  ) throw notReady("OWNER_CONFIRMATION_REQUIRED");
  return {
    generalizedTitle,
    workFocus,
    selectedDirection,
    nextStep,
    timeframe,
    progressMarker,
    followUp: {
      scheduleLabel,
      scheduledFor: parseScheduledFor(scheduleLabel),
      responsibleParty,
      channel
    },
    practiceStatus: eight.practiceDecision === "create_draft" ? "PRIVATE_DRAFT" : "NONE",
    retentionStatus: eight.retentionDecision === "do_not_retain"
      ? "DELETED"
      : "RETAINED_SELECTED_OUTPUT",
    ownerConfirmedAt: stage8.completedAt || new Date()
  };
}

async function purgeSessionDetailTx(
  tx,
  { sessionId, stage8SnapshotId, covisionCaseId, generalizedTitle, now = new Date() }
) {
  await tx.covisionPrivateState.deleteMany({ where: { sessionId } });
  await tx.covisionWorkItem.deleteMany({ where: { sessionId } });
  await tx.covisionStageSnapshot.deleteMany({
    where: { sessionId, stage: { not: 8 } }
  });
  await tx.covisionStageSnapshot.update({
    where: { id: stage8SnapshotId },
    data: { payload: { stage: 8, closureCreated: true } }
  });
  await tx.covisionSessionState.update({
    where: { id: sessionId },
    data: { settings: null }
  });
  await tx.covisionJourneyStep.deleteMany({ where: { covisionCaseId } });
  await tx.covisionParty.deleteMany({ where: { covisionCaseId } });
  await tx.covisionRiskFactor.deleteMany({ where: { covisionCaseId } });
  await tx.covisionMessage.deleteMany({ where: { covisionCaseId } });
  await tx.covisionSummary.deleteMany({ where: { covisionCaseId } });
  await tx.callSession.deleteMany({
    where: { contextType: "COVISION", contextId: covisionCaseId }
  });
  await tx.covisionCase.update({
    where: { id: covisionCaseId },
    data: {
      title: generalizedTitle,
      summary: null,
      anonymizedDescription: null,
      centralQuestion: null,
      expectedHelpTypes: [],
      topics: [],
      tags: [],
      sourcePreInquiryId: null,
      status: "CLOSED",
      lastActivityAt: now
    }
  });
}

/**
 * Finalize stage 8 inside the caller's existing advisory-locked transaction.
 * The caller passes the just-created stage-8 snapshot because the in-memory
 * session include still contains only stages 1-7 until the transaction is
 * reloaded. Only explicitly whitelisted, owner-confirmed fields cross into the
 * closure; snapshot IDs, participant readiness and unrelated work content do not.
 */
export async function createClosureFromStageSnapshotsTx(
  tx,
  covisionCase,
  session,
  { stage8Snapshot, now = new Date(), closedById = null } = {}
) {
  if (!tx || !covisionCase?.id || !session?.id || !stage8Snapshot) throw notReady();
  const existing = await tx.covisionClosure.findUnique({
    where: { covisionCaseId: covisionCase.id }
  });
  if (existing) {
    await purgeSessionDetailTx(tx, {
      sessionId: session.id,
      stage8SnapshotId: stage8Snapshot.id,
      covisionCaseId: covisionCase.id,
      generalizedTitle: existing.generalizedTitle,
      now
    });
    return existing;
  }

  const snapshots = (session.stageSnapshots || [])
    .filter((snapshot) => Number(snapshot.stage) !== 8)
    .concat(stage8Snapshot);
  const source = closureSource({
    ...covisionCase,
    sessionState: { ...session, phase: "complete", stageSnapshots: snapshots }
  });
  const created = await tx.covisionClosure.create({
    data: {
      covisionCaseId: covisionCase.id,
      sourceTopicSeedId: covisionCase.sourceTopicSeed?.id || null,
      ownerId: covisionCase.ownerId,
      assignedFollowUpUserId: covisionCase.ownerId,
      closedById: normalizeId(closedById) || covisionCase.ownerId,
      generalizedTitle: source.generalizedTitle,
      workFocus: source.workFocus,
      selectedDirection: source.selectedDirection,
      nextStep: source.nextStep,
      timeframe: source.timeframe,
      progressMarker: source.progressMarker,
      sessionStartedAt: session.startedAt,
      closedAt: now,
      ownerConfirmedAt: source.ownerConfirmedAt,
      lifecycleStatus: "FOLLOW_UP_PENDING",
      practiceStatus: source.practiceStatus,
      packageStatus: "CONFIRMED",
      retentionStatus: source.retentionStatus,
      followUps: {
        create: {
          assignedToUserId: covisionCase.ownerId,
          status: "SCHEDULED",
          ...source.followUp
        }
      },
      ownerPackage: {
        create: {
          ownerId: covisionCase.ownerId,
          status: "CONFIRMED",
          confirmedAt: source.ownerConfirmedAt,
          content: {
            selectedDirection: source.selectedDirection,
            nextStep: source.nextStep,
            timeframe: source.timeframe,
            progressMarker: source.progressMarker,
            followUp: source.followUp
          }
        }
      }
    }
  });
  if (source.practiceStatus === "PRIVATE_DRAFT") {
    await createPracticeDraftFromClosureTx(tx, created);
  }
  await appendCovisionAuditEvent(tx, {
    covisionCaseId: covisionCase.id,
    actorUserId: normalizeId(closedById) || covisionCase.ownerId,
    actorRoleSnapshot: "OWNER",
    action: "CLOSURE_CREATED",
    entityType: "CLOSURE",
    entityId: created.id,
    idempotencyKey: `${covisionCase.id}:closure:created`,
    metadata: { lifecycleStatus: "FOLLOW_UP_PENDING", retentionStatus: source.retentionStatus },
    occurredAt: now
  });
  if (covisionCase.sourceTopicSeed?.id) {
    await tx.topicSeed.update({
      where: { id: covisionCase.sourceTopicSeed.id },
      data: { status: "FOLLOW_UP", version: { increment: 1 } }
    });
  }
  await purgeSessionDetailTx(tx, {
    sessionId: session.id,
    stage8SnapshotId: stage8Snapshot.id,
    covisionCaseId: covisionCase.id,
    generalizedTitle: source.generalizedTitle,
    now
  });
  return created;
}

function normalizeCloseRequest(input) {
  assertPlainObject(input);
  assertOnlyKeys(input, new Set(["expectedVersion"]));
  return { expectedVersion: normalizeExpectedVersion(input.expectedVersion) };
}

const closeCaseInclude = Object.freeze({
  sourceTopicSeed: { select: { id: true } },
  sessionState: {
    include: {
      stageSnapshots: {
        where: { stage: { in: [2, 3, 7, 8] } },
        orderBy: { stage: "asc" }
      }
    }
  }
});

export async function closeCovisionCase(actor, covisionCaseId, input, { db = prisma } = {}) {
  const { userId } = normalizeActor(actor);
  const caseId = normalizeId(covisionCaseId);
  if (!caseId) throw notFound();
  const request = normalizeCloseRequest(input);
  const closureId = await withLock(db, `covisionSession:${caseId}`, async (tx) => {
    const covisionCase = await tx.covisionCase.findFirst({
      where: { id: caseId, ownerId: userId },
      include: closeCaseInclude
    });
    if (!covisionCase) throw notFound();
    const existing = await tx.covisionClosure.findUnique({ where: { covisionCaseId: caseId } });
    if (existing) return existing.id;
    const session = covisionCase.sessionState;
    if (!session || session.version !== request.expectedVersion) throw conflict();
    const stage8Snapshot = snapshotByStage(session, 8);
    if (session.phase !== "complete" || !stage8Snapshot) throw notReady();
    const created = await createClosureFromStageSnapshotsTx(tx, covisionCase, session, {
      stage8Snapshot,
      now: new Date(),
      closedById: userId
    });
    return created.id;
  });
  return getCompletedCaseDetail({ userId }, closureId, { db });
}

function normalizeFollowUpRequest(input) {
  assertPlainObject(input);
  assertOnlyKeys(input, new Set([
    "expectedVersion", "action", "scheduleLabel", "assignedToUserId",
    "whatWasDone", "whatChanged", "learning", "resourceUsed", "conditionChanged"
  ]));
  const action = String(input.action || "").trim().toLowerCase();
  if (!["complete", "reschedule"].includes(action)) throw invalid();
  const request = {
    expectedVersion: normalizeExpectedVersion(input.expectedVersion),
    action,
    assignedToUserId: hasOwn(input, "assignedToUserId") ? normalizeId(input.assignedToUserId) : null
  };
  if (action === "reschedule") {
    request.scheduleLabel = normalizeText(input.scheduleLabel, MAX_SHORT, { required: true });
  } else {
    request.whatWasDone = normalizeText(input.whatWasDone, MAX_TEXT, { required: true });
    request.whatChanged = normalizeText(input.whatChanged, MAX_TEXT);
    request.learning = normalizeText(input.learning, MAX_TEXT, { required: true });
    request.resourceUsed = normalizeText(input.resourceUsed, MAX_TEXT);
    request.conditionChanged = normalizeText(input.conditionChanged, MAX_TEXT);
  }
  return request;
}

async function assertAssigneeAllowed(tx, closure, userId) {
  if (closure.ownerId === userId) return;
  const accepted = (closure.covisionCase?.participants || []).some((participant) => (
    participant.userId === userId && participant.inviteStatus === "ACCEPTED"
  ));
  if (!accepted) throw invalid();
}

async function bumpClosure(tx, closure, data) {
  const updated = await tx.covisionClosure.updateMany({
    where: { id: closure.id, version: closure.version },
    data: { ...data, version: { increment: 1 } }
  });
  if (!updated || updated.count !== 1) throw conflict();
}

export async function updateCompletedCaseFollowUp(actor, closureId, input, { db = prisma } = {}) {
  const { userId } = normalizeActor(actor);
  const request = normalizeFollowUpRequest(input);
  await withLock(db, `covisionClosure:${normalizeId(closureId)}`, async (tx) => {
    const closure = await loadVisibleClosure(tx, userId, closureId);
    const accessRole = resolveAccessRole(closure, userId);
    const active = (closure.followUps || []).find((followUp) => followUp.status === "SCHEDULED");
    const assignedActive = accessRole === "FOLLOW_UP_ASSIGNEE"
      && closure.assignedFollowUpUserId === userId
      && active?.assignedToUserId === userId;
    if (accessRole !== "OWNER" && !assignedActive) throw forbidden();
    if (closure.version !== request.expectedVersion) throw conflict();
    if (!active) throw conflict("NO_ACTIVE_FOLLOW_UP");

    if (request.action === "complete") {
      await tx.covisionFollowUp.update({
        where: { id: active.id },
        data: {
          status: "COMPLETED",
          whatWasDone: request.whatWasDone,
          whatChanged: request.whatChanged,
          learning: request.learning,
          resourceUsed: request.resourceUsed,
          conditionChanged: request.conditionChanged,
          completedById: userId,
          completedAt: new Date()
        }
      });
      await bumpClosure(tx, closure, {
        lifecycleStatus: "DECISION_PENDING",
        assignedFollowUpUserId: null
      });
      await appendCovisionAuditEvent(tx, {
        covisionCaseId: closure.covisionCaseId,
        actorUserId: userId,
        actorRoleSnapshot: accessRole,
        action: "FOLLOW_UP_COMPLETED",
        entityType: "FOLLOW_UP",
        entityId: active.id,
        idempotencyKey: `${closure.id}:follow-up:${request.expectedVersion}:complete`,
        metadata: { lifecycleStatus: "DECISION_PENDING" }
      });
      return;
    }

    const nextAssignee = request.assignedToUserId || closure.assignedFollowUpUserId || closure.ownerId;
    if (request.assignedToUserId && accessRole !== "OWNER") throw forbidden();
    await assertAssigneeAllowed(tx, closure, nextAssignee);
    await tx.covisionFollowUp.update({
      where: { id: active.id },
      data: { status: "RESCHEDULED" }
    });
    await tx.covisionFollowUp.create({
      data: {
        closureId: closure.id,
        assignedToUserId: nextAssignee,
        status: "SCHEDULED",
        scheduleLabel: request.scheduleLabel,
        scheduledFor: parseScheduledFor(request.scheduleLabel),
        responsibleParty: nextAssignee === closure.ownerId ? "owner" : "designated_professional",
        channel: active.channel
      }
    });
    await bumpClosure(tx, closure, {
      lifecycleStatus: "FOLLOW_UP_PENDING",
      assignedFollowUpUserId: nextAssignee
    });
    await appendCovisionAuditEvent(tx, {
      covisionCaseId: closure.covisionCaseId,
      actorUserId: userId,
      actorRoleSnapshot: accessRole,
      action: "FOLLOW_UP_RESCHEDULED",
      entityType: "FOLLOW_UP",
      entityId: active.id,
      idempotencyKey: `${closure.id}:follow-up:${request.expectedVersion}:reschedule`,
      metadata: { assigned: nextAssignee === userId }
    });
  });
  return getCompletedCaseDetail({ userId }, closureId, { db });
}

function normalizeDecisionRequest(input) {
  assertPlainObject(input);
  assertOnlyKeys(input, new Set(["expectedVersion", "decision", "newQuestion", "scheduleLabel", "reason"]));
  const decision = String(input.decision || "").trim().toLowerCase();
  if (!DECISIONS.has(decision)) throw invalid();
  return {
    expectedVersion: normalizeExpectedVersion(input.expectedVersion),
    decision,
    newQuestion: decision === "continue"
      ? normalizeText(input.newQuestion, 300, { required: true })
      : null,
    scheduleLabel: decision === "new_follow_up"
      ? normalizeText(input.scheduleLabel, MAX_SHORT, { required: true })
      : null,
    reason: decision === "close"
      ? normalizeText(input.reason, MAX_TEXT, { required: true })
      : null
  };
}

export async function decideCompletedCase(actor, closureId, input, { db = prisma } = {}) {
  const { userId } = normalizeActor(actor);
  const request = normalizeDecisionRequest(input);
  await withLock(db, `covisionClosure:${normalizeId(closureId)}`, async (tx) => {
    const closure = await loadVisibleClosure(tx, userId, closureId);
    const accessRole = resolveAccessRole(closure, userId);
    if (accessRole !== "OWNER") throw forbidden();
    const allowedLifecycle = request.decision === "continue"
      ? ["DECISION_PENDING", "CONTINUATION_PENDING"]
      : ["DECISION_PENDING"];
    if (!allowedLifecycle.includes(closure.lifecycleStatus)) throw conflict("INVALID_LIFECYCLE_TRANSITION");
    if (closure.version !== request.expectedVersion) throw conflict();

    if (request.decision === "practice_candidate") {
      await createPracticeDraftFromClosureTx(tx, closure);
      if (closure.practiceStatus !== "PRIVATE_DRAFT") {
        await bumpClosure(tx, closure, { practiceStatus: "PRIVATE_DRAFT" });
      }
      await appendCovisionAuditEvent(tx, {
        covisionCaseId: closure.covisionCaseId,
        actorUserId: userId,
        actorRoleSnapshot: accessRole,
        action: "FINAL_DECISION",
        entityType: "CLOSURE",
        entityId: closure.id,
        idempotencyKey: `${closure.id}:decision:${request.expectedVersion}:practice_candidate`,
        metadata: { decision: "practice_candidate" }
      });
      return;
    }

    const active = (closure.followUps || []).find((followUp) => followUp.status === "SCHEDULED");
    if (request.decision === "close") {
      if (active) {
        await tx.covisionFollowUp.update({ where: { id: active.id }, data: { status: "CANCELLED" } });
      }
      await bumpClosure(tx, closure, {
        lifecycleStatus: "CLOSED",
        assignedFollowUpUserId: null,
        decisionNote: request.reason
      });
      await tx.covisionCase.update({ where: { id: closure.covisionCaseId }, data: { status: "CLOSED" } });
      if (closure.sourceTopicSeedId) {
        await tx.topicSeed.update({
          where: { id: closure.sourceTopicSeedId },
          data: { status: "CLOSED", version: { increment: 1 } }
        });
      }
      await appendCovisionAuditEvent(tx, {
        covisionCaseId: closure.covisionCaseId,
        actorUserId: userId,
        actorRoleSnapshot: accessRole,
        action: "FINAL_DECISION",
        entityType: "CLOSURE",
        entityId: closure.id,
        idempotencyKey: `${closure.id}:decision:${request.expectedVersion}:close`,
        metadata: { decision: "close" }
      });
      return;
    }

    if (request.decision === "new_follow_up") {
      if (active) {
        await tx.covisionFollowUp.update({ where: { id: active.id }, data: { status: "RESCHEDULED" } });
      }
      await tx.covisionFollowUp.create({
        data: {
          closureId: closure.id,
          assignedToUserId: closure.ownerId,
          status: "SCHEDULED",
          scheduleLabel: request.scheduleLabel,
          scheduledFor: parseScheduledFor(request.scheduleLabel),
          responsibleParty: "owner",
          channel: "platform"
        }
      });
      await bumpClosure(tx, closure, {
        lifecycleStatus: "FOLLOW_UP_PENDING",
        assignedFollowUpUserId: closure.ownerId
      });
      await appendCovisionAuditEvent(tx, {
        covisionCaseId: closure.covisionCaseId,
        actorUserId: userId,
        actorRoleSnapshot: accessRole,
        action: "FINAL_DECISION",
        entityType: "CLOSURE",
        entityId: closure.id,
        idempotencyKey: `${closure.id}:decision:${request.expectedVersion}:new_follow_up`,
        metadata: { decision: "new_follow_up" }
      });
      return;
    }

    if (closure.continuationTopicSeedId) return;
    const continuation = await tx.topicSeed.create({
      data: {
        ownerId: closure.ownerId,
        title: closure.generalizedTitle.slice(0, 80),
        caseType: "current",
        whyNow: request.newQuestion,
        requestedSupport: ["perspectives"],
        status: "DRAFT"
      }
    });
    await bumpClosure(tx, closure, {
      lifecycleStatus: "CONTINUATION_PENDING",
      assignedFollowUpUserId: null,
      continuationTopicSeedId: continuation.id
    });
    if (closure.sourceTopicSeedId) {
      await tx.topicSeed.update({
        where: { id: closure.sourceTopicSeedId },
        data: { status: "CLOSED", version: { increment: 1 } }
      });
    }
    await appendCovisionAuditEvent(tx, {
      covisionCaseId: closure.covisionCaseId,
      actorUserId: userId,
      actorRoleSnapshot: accessRole,
      action: "FINAL_DECISION",
      entityType: "CLOSURE",
      entityId: closure.id,
      idempotencyKey: `${closure.id}:decision:${request.expectedVersion}:continue`,
      metadata: { decision: "continue" }
    });
  });
  return getCompletedCaseDetail({ userId }, closureId, { db });
}

function normalizeArchiveRequest(input) {
  assertPlainObject(input);
  assertOnlyKeys(input, new Set(["expectedVersion"]));
  return { expectedVersion: normalizeExpectedVersion(input.expectedVersion) };
}

export async function archiveCompletedCase(actor, closureId, input, { db = prisma } = {}) {
  const { userId } = normalizeActor(actor);
  const request = normalizeArchiveRequest(input);
  await withLock(db, `covisionClosure:${normalizeId(closureId)}`, async (tx) => {
    const closure = await loadVisibleClosure(tx, userId, closureId);
    if (resolveAccessRole(closure, userId) !== "OWNER") throw forbidden();
    if (closure.lifecycleStatus === "ARCHIVED") return;
    if (closure.version !== request.expectedVersion) throw conflict();
    if (!['CLOSED', 'CONTINUATION_PENDING'].includes(closure.lifecycleStatus)) throw conflict();
    await bumpClosure(tx, closure, {
      lifecycleStatus: "ARCHIVED",
      assignedFollowUpUserId: null
    });
    await tx.covisionCase.update({ where: { id: closure.covisionCaseId }, data: { status: "ARCHIVED" } });
    await appendCovisionAuditEvent(tx, {
      covisionCaseId: closure.covisionCaseId,
      actorUserId: userId,
      actorRoleSnapshot: "OWNER",
      action: "CLOSURE_ARCHIVED",
      entityType: "CLOSURE",
      entityId: closure.id,
      idempotencyKey: `${closure.id}:archive:${request.expectedVersion}`,
      metadata: { lifecycleStatus: "ARCHIVED" }
    });
  });
  return getCompletedCaseDetail({ userId }, closureId, { db });
}
