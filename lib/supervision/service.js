import {
  SUPERVISION_MEMBER_ROLES,
  SUPERVISION_ACTIONS as ACTIONS,
  assertAllowedKeys,
  conflict,
  forbidden,
  invalid,
  normalizeText,
  notFound,
  recordSupervisionAudit,
  requireExpectedVersion,
  requireOpenSupervisionProcess,
  requireSupervisionMember,
  requireSupervisionUser,
  resolveDb,
  staleVersion,
  unprocessable,
  withSupervisionProcessLock
} from "./shared.js";
import { assertActiveSupervisorGrant } from "./grants.js";
import { notifyContractPending, notifyInvite, notifyParticipantLeft } from "./notifications.js";
import {
  VIEWER_ROLES,
  serializeContractVersion,
  serializeProcessCard,
  serializeProcessForViewer
} from "./serializers.js";

/**
 * Protsessi tuum (Q2.2 M2/M3/M4/M5, Q2.4 read 4–13). Loogika lib-is, route
 * õhuke. Iga muteeriv toiming: advisory-xact-lukk `supervision:${processId}` +
 * allowlist + CAS (expectedVersion) + M13 auditikirje samas tehingus. Lugemine
 * on liikmesus-skoobitud: VÕÕR/CLIENT/ADMIN → ühetaoline 404 (Q2.3).
 */

const PROCESS_TYPES = new Set(["INDIVIDUAL", "GROUP"]);
const USER_SELECT = { id: true, email: true, profile: { select: { firstName: true, lastName: true } } };

function nowFrom(options) {
  return options.now || new Date();
}

function time(value) {
  if (!value) return 0;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d.getTime() : 0;
}

function normalizeType(value) {
  const t = String(value || "").trim().toUpperCase();
  if (!PROCESS_TYPES.has(t)) throw invalid("INVALID_TYPE");
  return t;
}

function normalizeMeetingCount(value) {
  if (value == null || value === "") return 5;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 100) throw invalid("INVALID_MEETING_COUNT");
  return n;
}

async function loadUsers(db, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map();
  if (!unique.length) return map;
  const rows = await db.user.findMany({ where: { id: { in: unique } }, select: USER_SELECT });
  for (const user of rows) map.set(user.id, user);
  return map;
}

/**
 * Vaataja suhe protsessiga (Q2.3). OS_STALE = OS†: ACCEPTED, aga aktiivse
 * kontraktiversiooni kinnitus puudub. role=null → VÕÕR/CLIENT/ADMIN/DECLINED/
 * WITHDRAWN → helistaja viskab ühetaolise 404.
 */
async function resolveViewer(db, process, userId) {
  if (process.supervisorId === userId) {
    return { role: VIEWER_ROLES.SV, participation: null, hasValidAcceptance: false };
  }
  const participation = await db.supervisionParticipation.findFirst({
    where: { processId: process.id, userId }
  });
  if (!participation) return { role: null, participation: null, hasValidAcceptance: false };
  if (participation.status === "INVITED") {
    return { role: VIEWER_ROLES.KUT, participation, hasValidAcceptance: false };
  }
  if (participation.status === "ACCEPTED") {
    let hasValidAcceptance = false;
    if (process.activeContractVersionId) {
      const acceptance = await db.supervisionContractAcceptance.findFirst({
        where: { participationId: participation.id, contractVersionId: process.activeContractVersionId }
      });
      hasValidAcceptance = Boolean(acceptance);
    }
    return {
      role: hasValidAcceptance ? VIEWER_ROLES.OS : VIEWER_ROLES.OS_STALE,
      participation,
      hasValidAcceptance
    };
  }
  if (participation.status === "LEFT") {
    return { role: VIEWER_ROLES.LAHK, participation, hasValidAcceptance: false };
  }
  return { role: null, participation, hasValidAcceptance: false };
}

async function loadProcessForViewer(db, processId, userId) {
  const id = String(processId || "").trim();
  if (!id) throw notFound();
  const process = await db.supervisionProcess.findUnique({ where: { id } });
  if (!process) throw notFound();
  const viewer = await resolveViewer(db, process, userId);
  if (!viewer.role) throw notFound();
  return { process, viewer };
}

/** SV-värav muteerivatele protsessi-toimingutele: mitte-SV → ühetaoline 404. */
async function requireSupervisorContext(db, processId, userId, { allowClosed = false } = {}) {
  const { process, viewer } = await loadProcessForViewer(db, processId, userId);
  if (viewer.role !== VIEWER_ROLES.SV) throw notFound();
  if (!allowClosed && process.status === "CLOSED") {
    throw conflict("supervision.errors.already_closed", "ALREADY_CLOSED");
  }
  return { process, viewer };
}

async function touchProcess(tx, processId, now) {
  await tx.supervisionProcess.update({ where: { id: processId }, data: { lastActivityAt: now } });
}

async function ensureAcceptance(tx, participationId, contractVersionId, now) {
  const existing = await tx.supervisionContractAcceptance.findFirst({
    where: { participationId, contractVersionId }
  });
  if (existing) return { acceptance: existing, created: false };
  try {
    const acceptance = await tx.supervisionContractAcceptance.create({
      data: { participationId, contractVersionId, acceptedAt: now }
    });
    return { acceptance, created: true };
  } catch (error) {
    if (error?.code === "P2002") {
      const acceptance = await tx.supervisionContractAcceptance.findFirst({
        where: { participationId, contractVersionId }
      });
      return { acceptance, created: false };
    }
    throw error;
  }
}

// === Lugemine ===

export async function getProcessDetail({ processId, session }, options = {}) {
  const db = resolveDb(options);
  const { userId } = requireSupervisionUser(session);
  const { process, viewer } = await loadProcessForViewer(db, processId, userId);

  const supervisor = process.supervisorId
    ? await db.user.findUnique({ where: { id: process.supervisorId }, select: USER_SELECT })
    : null;
  const activeContract = process.activeContractVersionId
    ? await db.supervisionContractVersion.findUnique({ where: { id: process.activeContractVersionId } })
    : null;

  if (viewer.role === VIEWER_ROLES.KUT) {
    return serializeProcessForViewer(process, viewer, { supervisor, activeContract });
  }

  const [participationsRaw, contractVersions, topics, meetings, summaries, closure] = await Promise.all([
    db.supervisionParticipation.findMany({ where: { processId: process.id }, orderBy: [{ invitedAt: "asc" }] }),
    db.supervisionContractVersion.findMany({ where: { processId: process.id }, orderBy: [{ versionNumber: "asc" }] }),
    db.supervisionSharedTopic.findMany({ where: { processId: process.id }, orderBy: [{ sharedAt: "asc" }] }),
    db.supervisionMeeting.findMany({ where: { processId: process.id }, orderBy: [{ seq: "asc" }] }),
    db.supervisionSummary.findMany({ where: { processId: process.id }, orderBy: [{ createdAt: "asc" }] }),
    db.supervisionClosure.findUnique({ where: { processId: process.id } })
  ]);

  // Osalejate nimekiri: SV näeb kõiki; teised liikmed ainult kaas-liikmeid
  // (ACCEPTED/LEFT), mitte ootel kutseid ega keeldumisi.
  const visibleParticipations = viewer.role === VIEWER_ROLES.SV
    ? participationsRaw
    : participationsRaw.filter((p) => ["ACCEPTED", "LEFT"].includes(p.status));
  const users = await loadUsers(db, visibleParticipations.map((p) => p.userId));
  const participants = visibleParticipations.map((p) => ({ participation: p, user: users.get(p.userId) }));

  const summaryIds = summaries.map((s) => s.id);
  const approvals = summaryIds.length
    ? await db.supervisionSummaryApproval.findMany({ where: { summaryId: { in: summaryIds } } })
    : [];

  return serializeProcessForViewer(process, viewer, {
    supervisor, activeContract, contractVersions, participants, topics, meetings, summaries, approvals, closure
  });
}

export async function listMyProcesses({ session }, options = {}) {
  const db = resolveDb(options);
  const { userId } = requireSupervisionMember(session);
  const supervised = await db.supervisionProcess.findMany({
    where: { supervisorId: userId },
    orderBy: [{ lastActivityAt: "desc" }]
  });
  const myParts = await db.supervisionParticipation.findMany({
    where: { userId, status: { in: ["INVITED", "ACCEPTED", "LEFT"] } }
  });
  const partByProcess = new Map(myParts.map((p) => [p.processId, p]));
  const partProcessIds = [...partByProcess.keys()];
  const partProcesses = partProcessIds.length
    ? await db.supervisionProcess.findMany({ where: { id: { in: partProcessIds } } })
    : [];

  const supervisorIds = [...supervised, ...partProcesses].map((p) => p.supervisorId);
  const users = await loadUsers(db, supervisorIds);

  const cards = [];
  for (const process of supervised) {
    cards.push(serializeProcessCard(process, {
      role: VIEWER_ROLES.SV, participation: null, supervisor: users.get(process.supervisorId)
    }));
  }
  for (const process of partProcesses) {
    const participation = partByProcess.get(process.id);
    const role = participation.status === "INVITED" ? VIEWER_ROLES.KUT
      : participation.status === "LEFT" ? VIEWER_ROLES.LAHK
        : VIEWER_ROLES.OS;
    cards.push(serializeProcessCard(process, { role, participation, supervisor: users.get(process.supervisorId) }));
  }
  cards.sort((a, b) => time(b.lastActivityAt) - time(a.lastActivityAt));
  return { ok: true, processes: cards };
}

// === Muteerimine ===

export async function createProcess({ session, input }, options = {}) {
  const db = resolveDb(options);
  const now = nowFrom(options);
  const { userId } = requireSupervisionMember(session);
  assertAllowedKeys(input, ["type", "title", "goal", "plannedMeetingCount"]);
  await assertActiveSupervisorGrant(userId, { db, now });

  const type = normalizeType(input?.type);
  const title = normalizeText(input?.title, { required: true, max: 200, field: "title" });
  const goal = normalizeText(input?.goal, { max: 20000, field: "goal" });
  const plannedMeetingCount = normalizeMeetingCount(input?.plannedMeetingCount);

  const process = await db.$transaction(async (tx) => {
    const created = await tx.supervisionProcess.create({
      data: { supervisorId: userId, type, title, goal, plannedMeetingCount, status: "DRAFT", lastActivityAt: now }
    });
    await recordSupervisionAudit(tx, {
      action: ACTIONS.PROCESS_CREATED, actorUserId: userId, processId: created.id,
      targetKind: "process", targetId: created.id
    });
    return created;
  });
  return getProcessDetail({ processId: process.id, session }, options);
}

export async function updateProcess({ processId, session, input }, options = {}) {
  const db = resolveDb(options);
  const now = nowFrom(options);
  const { userId } = requireSupervisionUser(session);
  assertAllowedKeys(input, ["title", "goal", "plannedMeetingCount", "expectedVersion"]);
  const { process } = await requireSupervisorContext(db, processId, userId);
  const expectedVersion = requireExpectedVersion(input?.expectedVersion);

  const data = {};
  if (input.title !== undefined) data.title = normalizeText(input.title, { required: true, max: 200, field: "title" });
  if (input.goal !== undefined) data.goal = normalizeText(input.goal, { max: 20000, field: "goal" });
  if (input.plannedMeetingCount !== undefined) data.plannedMeetingCount = normalizeMeetingCount(input.plannedMeetingCount);
  if (Object.keys(data).length === 0) throw invalid("EMPTY_PATCH");

  await withSupervisionProcessLock(db, process.id, async (tx) => {
    const { process: fresh } = await requireSupervisorContext(tx, process.id, userId);
    if (fresh.version !== expectedVersion) throw staleVersion();
    await tx.supervisionProcess.update({
      where: { id: process.id },
      data: { ...data, version: { increment: 1 }, lastActivityAt: now }
    });
    await recordSupervisionAudit(tx, {
      action: ACTIONS.PROCESS_UPDATED, actorUserId: userId, processId: process.id,
      targetKind: "process", targetId: process.id
    });
  });
  return getProcessDetail({ processId: process.id, session }, options);
}

export async function createContractVersion({ processId, session, input }, options = {}) {
  const db = resolveDb(options);
  const now = nowFrom(options);
  const { userId } = requireSupervisionUser(session);
  assertAllowedKeys(input, ["body"]);
  const { process } = await requireSupervisorContext(db, processId, userId);
  const body = normalizeText(input?.body, { required: true, max: 50000, field: "body" });

  const version = await withSupervisionProcessLock(db, process.id, async (tx) => {
    await requireSupervisorContext(tx, process.id, userId);
    const last = await tx.supervisionContractVersion.findFirst({
      where: { processId: process.id }, orderBy: [{ versionNumber: "desc" }]
    });
    const versionNumber = (last?.versionNumber || 0) + 1;
    const created = await tx.supervisionContractVersion.create({
      data: { processId: process.id, versionNumber, body, createdByUserId: userId, status: "DRAFT" }
    });
    await recordSupervisionAudit(tx, {
      action: ACTIONS.CONTRACT_VERSION_CREATED, actorUserId: userId, processId: process.id,
      targetKind: "contract_version", targetId: created.id, metadata: { versionNumber }
    });
    await touchProcess(tx, process.id, now);
    return created;
  });
  return { ok: true, contractVersion: serializeContractVersion(version) };
}

export async function activateContractVersion({ processId, versionId, session, input }, options = {}) {
  const db = resolveDb(options);
  const now = nowFrom(options);
  const { userId } = requireSupervisionUser(session);
  assertAllowedKeys(input, ["expectedVersion"]);
  const { process } = await requireSupervisorContext(db, processId, userId);
  const expectedVersion = requireExpectedVersion(input?.expectedVersion);
  const vid = String(versionId || "").trim();
  if (!vid) throw notFound();

  await withSupervisionProcessLock(db, process.id, async (tx) => {
    const { process: fresh } = await requireSupervisorContext(tx, process.id, userId);
    const version = await tx.supervisionContractVersion.findFirst({ where: { id: vid, processId: process.id } });
    if (!version) throw notFound();

    if (fresh.activeContractVersionId === version.id && version.status === "ACTIVE") {
      return; // idempotentne: juba aktiivne
    }
    if (fresh.version !== expectedVersion) throw staleVersion();
    if (version.status !== "DRAFT") {
      throw conflict("supervision.errors.conflict", "CONTRACT_VERSION_FINAL");
    }

    const activeVersion = fresh.activeContractVersionId
      ? await tx.supervisionContractVersion.findUnique({ where: { id: fresh.activeContractVersionId } })
      : null;
    if (activeVersion && version.versionNumber <= activeVersion.versionNumber) {
      throw conflict("supervision.errors.conflict", "CONTRACT_VERSION_NOT_FORWARD");
    }

    if (fresh.activeContractVersionId && fresh.activeContractVersionId !== version.id) {
      await tx.supervisionContractVersion.update({
        where: { id: fresh.activeContractVersionId }, data: { status: "SUPERSEDED" }
      });
    }
    await tx.supervisionContractVersion.update({
      where: { id: version.id }, data: { status: "ACTIVE", activatedAt: now }
    });

    const acceptedCount = await tx.supervisionParticipation.count({
      where: { processId: process.id, status: "ACCEPTED" }
    });
    const nextStatus = fresh.status === "DRAFT" && acceptedCount >= 1 ? "ACTIVE" : fresh.status;
    await tx.supervisionProcess.update({
      where: { id: process.id },
      data: { activeContractVersionId: version.id, status: nextStatus, version: { increment: 1 }, lastActivityAt: now }
    });
    await recordSupervisionAudit(tx, {
      action: ACTIONS.CONTRACT_ACTIVATED, actorUserId: userId, processId: process.id,
      targetKind: "contract_version", targetId: version.id, metadata: { versionNumber: version.versionNumber }
    });

    // U1: ACCEPTED osalejad, kel selle versiooni kinnitus puudu → contract_pending.
    const accepted = await tx.supervisionParticipation.findMany({
      where: { processId: process.id, status: "ACCEPTED" }
    });
    for (const participation of accepted) {
      const acceptance = await tx.supervisionContractAcceptance.findFirst({
        where: { participationId: participation.id, contractVersionId: version.id }
      });
      if (!acceptance) {
        await notifyContractPending(tx, {
          participationId: participation.id, processId: process.id, userId: participation.userId, versionId: version.id
        }, { now });
      }
    }
  });
  return getProcessDetail({ processId: process.id, session }, options);
}

export async function inviteParticipant({ processId, session, input }, options = {}) {
  const db = resolveDb(options);
  const now = nowFrom(options);
  const { userId } = requireSupervisionUser(session);
  assertAllowedKeys(input, ["userId"]);
  const { process } = await requireSupervisorContext(db, processId, userId);

  const targetUserId = String(input?.userId || "").trim();
  if (!targetUserId) throw invalid("MISSING_USER");
  if (targetUserId === userId) throw unprocessable("supervision.errors.rule_violation", "CANNOT_INVITE_SELF");
  const target = await db.user.findUnique({ where: { id: targetUserId }, select: { id: true, role: true } });
  if (!target) throw invalid("UNKNOWN_USER");
  if (!SUPERVISION_MEMBER_ROLES.includes(String(target.role || "").toUpperCase())) {
    throw unprocessable("supervision.errors.role_not_allowed", "INVITE_ROLE_NOT_ALLOWED");
  }

  await withSupervisionProcessLock(db, process.id, async (tx) => {
    await requireSupervisorContext(tx, process.id, userId);
    const freshTarget = await tx.user.findUnique({ where: { id: targetUserId }, select: { id: true, role: true } });
    if (!freshTarget) throw invalid("UNKNOWN_USER");
    if (!SUPERVISION_MEMBER_ROLES.includes(String(freshTarget.role || "").toUpperCase())) {
      throw unprocessable("supervision.errors.role_not_allowed", "INVITE_ROLE_NOT_ALLOWED");
    }
    const existing = await tx.supervisionParticipation.findFirst({
      where: { processId: process.id, userId: targetUserId }
    });
    if (existing) throw conflict("supervision.errors.conflict", "PARTICIPATION_EXISTS");
    const participation = await tx.supervisionParticipation.create({
      data: { processId: process.id, userId: targetUserId, invitedByUserId: userId, status: "INVITED", invitedAt: now }
    });
    await recordSupervisionAudit(tx, {
      action: ACTIONS.INVITE_SENT, actorUserId: userId, processId: process.id,
      targetKind: "participation", targetId: participation.id
    });
    await notifyInvite(tx, { participationId: participation.id, processId: process.id, userId: targetUserId }, { now });
    await touchProcess(tx, process.id, now);
  });
  return getProcessDetail({ processId: process.id, session }, options);
}

export async function withdrawInvite({ participationId, session }, options = {}) {
  const db = resolveDb(options);
  const now = nowFrom(options);
  const { userId } = requireSupervisionUser(session);
  const pid = String(participationId || "").trim();
  if (!pid) throw notFound();
  const participation = await db.supervisionParticipation.findUnique({ where: { id: pid } });
  if (!participation) throw notFound();
  const process = await db.supervisionProcess.findUnique({ where: { id: participation.processId } });
  if (!process || process.supervisorId !== userId) throw notFound();

  const result = await withSupervisionProcessLock(db, process.id, async (tx) => {
    await requireSupervisorContext(tx, process.id, userId);
    const fresh = await tx.supervisionParticipation.findUnique({ where: { id: pid } });
    if (!fresh || fresh.processId !== process.id) throw notFound();
    if (fresh.status === "WITHDRAWN") return fresh; // idempotentne
    if (fresh.status !== "INVITED") throw conflict("supervision.errors.conflict", "NOT_WITHDRAWABLE");
    const updated = await tx.supervisionParticipation.update({
      where: { id: pid }, data: { status: "WITHDRAWN", respondedAt: now }
    });
    await recordSupervisionAudit(tx, {
      action: ACTIONS.INVITE_WITHDRAWN, actorUserId: userId, processId: process.id,
      targetKind: "participation", targetId: pid
    });
    await touchProcess(tx, process.id, now);
    return updated;
  });
  return { ok: true, participation: { id: result.id, status: result.status } };
}

export async function respondToInvite({ participationId, session, input }, options = {}) {
  const db = resolveDb(options);
  const now = nowFrom(options);
  const { userId } = requireSupervisionUser(session);
  assertAllowedKeys(input, ["action", "contractVersionId"]);
  const pid = String(participationId || "").trim();
  if (!pid) throw notFound();
  const participation = await db.supervisionParticipation.findUnique({ where: { id: pid } });
  if (!participation || participation.userId !== userId) throw notFound();
  const action = String(input?.action || "").trim().toLowerCase();
  if (!["accept", "decline"].includes(action)) throw invalid("INVALID_ACTION");
  const process = await db.supervisionProcess.findUnique({ where: { id: participation.processId } });
  if (!process) throw notFound();

  const result = await withSupervisionProcessLock(db, process.id, async (tx) => {
    const freshProcess = await requireOpenSupervisionProcess(tx, process.id);
    const fresh = await tx.supervisionParticipation.findUnique({ where: { id: pid } });
    if (!fresh || fresh.processId !== process.id || fresh.userId !== userId) throw notFound();
    const me = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!SUPERVISION_MEMBER_ROLES.includes(String(me?.role || "").toUpperCase())) {
      throw forbidden("supervision.errors.role_forbidden", "ROLE_FORBIDDEN");
    }

    if (action === "decline") {
      if (fresh.status === "DECLINED") return fresh;
      if (fresh.status !== "INVITED") throw conflict("supervision.errors.conflict", "NOT_INVITED");
      const updated = await tx.supervisionParticipation.update({
        where: { id: pid }, data: { status: "DECLINED", respondedAt: now }
      });
      await touchProcess(tx, process.id, now);
      return updated;
    }

    // accept
    if (fresh.status !== "INVITED" && fresh.status !== "ACCEPTED") {
      throw conflict("supervision.errors.conflict", "NOT_INVITED");
    }
    const contractVersionId = String(input?.contractVersionId || "").trim();
    if (!contractVersionId) throw invalid("MISSING_CONTRACT_VERSION");
    if (!freshProcess.activeContractVersionId || freshProcess.activeContractVersionId !== contractVersionId) {
      throw conflict("supervision.errors.stale_version", "CONTRACT_VERSION_STALE");
    }
    if (fresh.status === "INVITED") {
      await tx.supervisionParticipation.update({ where: { id: pid }, data: { status: "ACCEPTED", respondedAt: now } });
    }
    const { created } = await ensureAcceptance(tx, pid, contractVersionId, now);
    if (freshProcess.status === "DRAFT" && freshProcess.activeContractVersionId) {
      await tx.supervisionProcess.update({ where: { id: process.id }, data: { status: "ACTIVE", lastActivityAt: now } });
    } else {
      await touchProcess(tx, process.id, now);
    }
    if (created || fresh.status === "INVITED") {
      await recordSupervisionAudit(tx, {
        action: ACTIONS.CONTRACT_ACCEPTED, actorUserId: userId, processId: process.id,
        targetKind: "participation", targetId: pid, metadata: { contractVersionId }
      });
    }
    return tx.supervisionParticipation.findUnique({ where: { id: pid } });
  });
  return { ok: true, participation: { id: result.id, status: result.status } };
}

export async function acceptContractVersion({ processId, session, input }, options = {}) {
  const db = resolveDb(options);
  const now = nowFrom(options);
  const { userId } = requireSupervisionUser(session);
  assertAllowedKeys(input, ["contractVersionId"]);
  const { process, viewer } = await loadProcessForViewer(db, processId, userId);
  if (![VIEWER_ROLES.OS, VIEWER_ROLES.OS_STALE].includes(viewer.role)) throw notFound();
  const contractVersionId = String(input?.contractVersionId || "").trim();
  if (!contractVersionId) throw invalid("MISSING_CONTRACT_VERSION");

  await withSupervisionProcessLock(db, process.id, async (tx) => {
    const { process: freshProcess, viewer: freshViewer } = await loadProcessForViewer(tx, process.id, userId);
    if (![VIEWER_ROLES.OS, VIEWER_ROLES.OS_STALE].includes(freshViewer.role)) throw notFound();
    if (freshProcess.status === "CLOSED") {
      throw conflict("supervision.errors.already_closed", "ALREADY_CLOSED");
    }
    if (!freshProcess.activeContractVersionId || freshProcess.activeContractVersionId !== contractVersionId) {
      throw conflict("supervision.errors.stale_version", "CONTRACT_VERSION_STALE");
    }
    const { created } = await ensureAcceptance(tx, freshViewer.participation.id, contractVersionId, now);
    if (created) {
      await recordSupervisionAudit(tx, {
        action: ACTIONS.CONTRACT_ACCEPTED, actorUserId: userId, processId: process.id,
        targetKind: "participation", targetId: freshViewer.participation.id, metadata: { contractVersionId }
      });
      await touchProcess(tx, process.id, now);
    }
  });
  return getProcessDetail({ processId: process.id, session }, options);
}

export async function leaveProcess({ participationId, session }, options = {}) {
  const db = resolveDb(options);
  const now = nowFrom(options);
  const { userId } = requireSupervisionUser(session);
  const pid = String(participationId || "").trim();
  if (!pid) throw notFound();

  const participation = await db.supervisionParticipation.findFirst({ where: { id: pid, userId } });
  if (!participation) throw notFound();
  const process = await db.supervisionProcess.findUnique({ where: { id: participation.processId } });
  if (!process) throw notFound();

  const result = await withSupervisionProcessLock(db, process.id, async (tx) => {
    const freshProcess = await requireOpenSupervisionProcess(tx, process.id);
    const fresh = await tx.supervisionParticipation.findFirst({
      where: { id: pid, processId: process.id, userId }
    });
    if (!fresh) throw notFound();
    if (fresh.status === "LEFT") return fresh;
    if (fresh.status !== "ACCEPTED") {
      throw conflict("supervision.errors.conflict", "PARTICIPATION_NOT_ACTIVE");
    }

    const updated = await tx.supervisionParticipation.update({
      where: { id: pid },
      data: { status: "LEFT", leftAt: now }
    });
    await recordSupervisionAudit(tx, {
      action: ACTIONS.PARTICIPANT_LEFT,
      actorUserId: userId,
      processId: process.id,
      targetKind: "participation",
      targetId: pid
    });

    const remaining = await tx.supervisionParticipation.findMany({
      where: { processId: process.id, status: "ACCEPTED" }
    });
    const pendingSummaries = await tx.supervisionSummary.findMany({
      where: { processId: process.id, status: "PENDING_APPROVAL" }
    });
    for (const summary of pendingSummaries) {
      const approvals = await tx.supervisionSummaryApproval.findMany({ where: { summaryId: summary.id } });
      const approvedIds = new Set(approvals.map((approval) => approval.participationId));
      if (remaining.every((row) => approvedIds.has(row.id))) {
        await tx.supervisionSummary.update({
          where: { id: summary.id },
          data: { status: "APPROVED", approvedAt: now, version: { increment: 1 } }
        });
        await recordSupervisionAudit(tx, {
          action: ACTIONS.SUMMARY_APPROVED,
          actorUserId: userId,
          processId: process.id,
          targetKind: "summary",
          targetId: summary.id
        });
      }
    }

    const recipients = [...new Set([freshProcess.supervisorId, ...remaining.map((row) => row.userId)])]
      .filter((recipientId) => recipientId && recipientId !== userId);
    for (const recipientId of recipients) {
      await notifyParticipantLeft(tx, {
        participationId: pid,
        processId: process.id,
        userId: recipientId
      }, { now });
    }
    await touchProcess(tx, process.id, now);
    return updated;
  });

  return {
    ok: true,
    participation: {
      id: result.id,
      status: result.status,
      leftAt: result.leftAt instanceof Date ? result.leftAt.toISOString() : result.leftAt
    }
  };
}

// Jagatud teenusekihi eksport hilisematele pakettidele (E3–E5).
export { loadProcessForViewer, resolveViewer, requireSupervisorContext, touchProcess, loadUsers, USER_SELECT };
