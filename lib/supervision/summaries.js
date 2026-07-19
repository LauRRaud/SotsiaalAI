import {
  SUPERVISION_ACTIONS as ACTIONS,
  assertAllowedKeys,
  conflict,
  invalid,
  normalizeText,
  notFound,
  recordSupervisionAudit,
  requireExpectedVersion,
  requireSupervisionUser,
  resolveDb,
  staleVersion,
  withSupervisionProcessLock
} from "./shared.js";
import { loadProcessForViewer } from "./service.js";
import { VIEWER_ROLES, serializeSummary } from "./serializers.js";
import { notifySummaryPending } from "./notifications.js";

/**
 * M9/M10 kokkuvõtted (Q2.2, Q2.4 read 20–23). Mustand (DRAFT, ainult SV näeb) →
 * submit (PENDING_APPROVAL) → kinnitused (M10) → APPROVED samas tehingus, kui
 * KÕIK hetkel ACCEPTED-osalused on kinnitanud (LEFT ei blokeeri; OS† ei kinnita).
 * Pärast APPROVED on body muutumatu (server keelab).
 */

const SUMMARY_KINDS = new Set(["MEETING", "FINAL"]);

async function requireSupervisorSummaryProcess(db, processId, userId) {
  const { process, viewer } = await loadProcessForViewer(db, processId, userId);
  if (viewer.role !== VIEWER_ROLES.SV) throw notFound();
  if (process.status === "CLOSED") throw conflict("supervision.errors.already_closed", "ALREADY_CLOSED");
  return { process };
}

async function loadSummaryAsSupervisor(db, summaryId, userId, { allowClosed = false } = {}) {
  const id = String(summaryId || "").trim();
  if (!id) throw notFound();
  const summary = await db.supervisionSummary.findUnique({ where: { id } });
  if (!summary) throw notFound();
  const { process, viewer } = await loadProcessForViewer(db, summary.processId, userId);
  if (viewer.role !== VIEWER_ROLES.SV) throw notFound();
  if (!allowClosed && process.status === "CLOSED") throw conflict("supervision.errors.already_closed", "ALREADY_CLOSED");
  return { summary, process };
}

async function serializeWithApprovals(db, summaryId) {
  const summary = await db.supervisionSummary.findUnique({ where: { id: summaryId } });
  const approvals = await db.supervisionSummaryApproval.findMany({ where: { summaryId } });
  return serializeSummary(summary, approvals);
}

export async function createSummary({ processId, session, input }, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const { userId } = requireSupervisionUser(session);
  assertAllowedKeys(input, ["kind", "meetingId", "body"]);
  const { process } = await requireSupervisorSummaryProcess(db, processId, userId);

  const kind = String(input?.kind || "").trim().toUpperCase();
  if (!SUMMARY_KINDS.has(kind)) throw invalid("INVALID_KIND");
  const body = normalizeText(input?.body, { required: true, max: 50000, field: "body" });

  let meetingId = null;
  if (kind === "MEETING") {
    meetingId = String(input?.meetingId || "").trim();
    if (!meetingId) throw invalid("MISSING_MEETING");
    const meeting = await db.supervisionMeeting.findFirst({ where: { id: meetingId, processId: process.id } });
    if (!meeting) throw notFound();
    const existing = await db.supervisionSummary.findFirst({ where: { meetingId } });
    if (existing) throw conflict("supervision.errors.conflict", "SUMMARY_EXISTS_FOR_MEETING");
  } else {
    if (input?.meetingId) throw invalid("FINAL_HAS_NO_MEETING");
    const existingFinal = await db.supervisionSummary.findFirst({ where: { processId: process.id, kind: "FINAL" } });
    if (existingFinal) throw conflict("supervision.errors.conflict", "FINAL_SUMMARY_EXISTS");
  }

  const summary = await withSupervisionProcessLock(db, process.id, async (tx) => {
    const created = await tx.supervisionSummary.create({
      data: { processId: process.id, meetingId, kind, body, status: "DRAFT", createdByUserId: userId, version: 0 }
    });
    await tx.supervisionProcess.update({ where: { id: process.id }, data: { lastActivityAt: now } });
    return created;
  });
  // Mustandi loomine on SV-privaatne — EI M13 auditit (nagu M6); audit tuleb submit'il.
  return { ok: true, summary: serializeSummary(summary, []) };
}

export async function updateSummary({ summaryId, session, input }, options = {}) {
  const db = resolveDb(options);
  const { userId } = requireSupervisionUser(session);
  assertAllowedKeys(input, ["body", "expectedVersion"]);
  const { summary, process } = await loadSummaryAsSupervisor(db, summaryId, userId);
  const expectedVersion = requireExpectedVersion(input?.expectedVersion);
  const body = normalizeText(input?.body, { required: true, max: 50000, field: "body" });

  await withSupervisionProcessLock(db, process.id, async (tx) => {
    const fresh = await tx.supervisionSummary.findUnique({ where: { id: summary.id } });
    if (!fresh) throw notFound();
    if (fresh.status === "APPROVED") throw conflict("supervision.errors.conflict", "SUMMARY_IMMUTABLE");
    if (fresh.status !== "DRAFT") throw conflict("supervision.errors.conflict", "SUMMARY_NOT_DRAFT");
    if (fresh.version !== expectedVersion) throw staleVersion();
    await tx.supervisionSummary.update({ where: { id: summary.id }, data: { body, version: { increment: 1 } } });
  });
  return { ok: true, summary: await serializeWithApprovals(db, summary.id) };
}

export async function submitSummary({ summaryId, session, input }, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const { userId } = requireSupervisionUser(session);
  assertAllowedKeys(input, ["expectedVersion"]);
  const { summary, process } = await loadSummaryAsSupervisor(db, summaryId, userId);
  const expectedVersion = requireExpectedVersion(input?.expectedVersion);

  await withSupervisionProcessLock(db, process.id, async (tx) => {
    const fresh = await tx.supervisionSummary.findUnique({ where: { id: summary.id } });
    if (!fresh) throw notFound();
    if (fresh.status === "PENDING_APPROVAL") return; // idempotentne
    if (fresh.status !== "DRAFT") throw conflict("supervision.errors.conflict", "SUMMARY_NOT_DRAFT");
    if (fresh.version !== expectedVersion) throw staleVersion();
    await tx.supervisionSummary.update({
      where: { id: summary.id }, data: { status: "PENDING_APPROVAL", submittedAt: now, version: { increment: 1 } }
    });
    await recordSupervisionAudit(tx, {
      action: ACTIONS.SUMMARY_SUBMITTED, actorUserId: userId, processId: process.id,
      targetKind: "summary", targetId: summary.id
    });
    // U1: teata kõigile ACCEPTED-osalejatele, kes pole veel kinnitanud (algul kõik).
    const accepted = await tx.supervisionParticipation.findMany({
      where: { processId: process.id, status: "ACCEPTED" }
    });
    for (const participation of accepted) {
      await notifySummaryPending(tx, {
        summaryId: summary.id, processId: process.id, userId: participation.userId, participationId: participation.id
      }, { now });
    }
  });
  return { ok: true, summary: await serializeWithApprovals(db, summary.id) };
}

export async function discardSummary({ summaryId, session }, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const { userId } = requireSupervisionUser(session);
  const { summary, process } = await loadSummaryAsSupervisor(db, summaryId, userId);

  await withSupervisionProcessLock(db, process.id, async (tx) => {
    const fresh = await tx.supervisionSummary.findUnique({ where: { id: summary.id } });
    if (!fresh) throw notFound();
    if (fresh.status === "DISCARDED") return; // idempotentne
    if (fresh.status === "APPROVED") throw conflict("supervision.errors.conflict", "SUMMARY_IMMUTABLE");
    await tx.supervisionSummary.update({ where: { id: summary.id }, data: { status: "DISCARDED", version: { increment: 1 } } });
    await tx.supervisionProcess.update({ where: { id: process.id }, data: { lastActivityAt: now } });
  });
  return { ok: true, summary: await serializeWithApprovals(db, summary.id) };
}

export async function approveSummary({ summaryId, session }, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const { userId } = requireSupervisionUser(session);
  const id = String(summaryId || "").trim();
  if (!id) throw notFound();
  const summary = await db.supervisionSummary.findUnique({ where: { id } });
  if (!summary) throw notFound();
  const { process, viewer } = await loadProcessForViewer(db, summary.processId, userId);
  if (process.status === "CLOSED") throw conflict("supervision.errors.already_closed", "ALREADY_CLOSED");

  // Kinnitada saab AINULT OS (kehtiv kontraktikinnitus). OS† → 409; SV kinnitab
  // implitsiitselt submit'iga → 409; LAHK/KUT/VÕÕR → 404.
  if (viewer.role === VIEWER_ROLES.OS_STALE) {
    throw conflict("supervision.errors.contract_not_accepted", "CONTRACT_NOT_ACCEPTED");
  }
  if (viewer.role === VIEWER_ROLES.SV) {
    throw conflict("supervision.errors.conflict", "SUPERVISOR_APPROVES_VIA_SUBMIT");
  }
  if (viewer.role !== VIEWER_ROLES.OS) throw notFound();

  await withSupervisionProcessLock(db, process.id, async (tx) => {
    const fresh = await tx.supervisionSummary.findUnique({ where: { id } });
    if (!fresh) throw notFound();
    if (fresh.status === "APPROVED") return; // idempotentne
    if (fresh.status !== "PENDING_APPROVAL") throw conflict("supervision.errors.conflict", "SUMMARY_NOT_PENDING");

    // M10 kinnitus (unique [summary, participation] → topeltklikk idempotentne)
    const existing = await tx.supervisionSummaryApproval.findFirst({
      where: { summaryId: id, participationId: viewer.participation.id }
    });
    if (!existing) {
      try {
        await tx.supervisionSummaryApproval.create({
          data: { summaryId: id, participationId: viewer.participation.id, approvedAt: now }
        });
      } catch (error) {
        if (error?.code !== "P2002") throw error;
      }
    }

    // Lävi luku all: kui KÕIK hetkel ACCEPTED-osalused on kinnitanud → APPROVED.
    const accepted = await tx.supervisionParticipation.findMany({
      where: { processId: process.id, status: "ACCEPTED" }
    });
    const approvals = await tx.supervisionSummaryApproval.findMany({ where: { summaryId: id } });
    const approvedIds = new Set(approvals.map((a) => a.participationId));
    const thresholdMet = accepted.length > 0 && accepted.every((p) => approvedIds.has(p.id));
    if (thresholdMet) {
      await tx.supervisionSummary.update({
        where: { id }, data: { status: "APPROVED", approvedAt: now, version: { increment: 1 } }
      });
      await recordSupervisionAudit(tx, {
        action: ACTIONS.SUMMARY_APPROVED, actorUserId: userId, processId: process.id,
        targetKind: "summary", targetId: id
      });
    }
    await tx.supervisionProcess.update({ where: { id: process.id }, data: { lastActivityAt: now } });
  });
  return { ok: true, summary: await serializeWithApprovals(db, id) };
}
