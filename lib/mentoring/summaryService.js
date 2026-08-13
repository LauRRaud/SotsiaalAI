import { NOTIFICATION_EVENT_TYPES } from "../notifications.js";
import {
  MENTORING_RELATION_STATUS,
  MENTORING_SUMMARY_STATUS,
  MENTORING_SUMMARY_KIND,
  MENTORING_AUDIT_ACTIONS
} from "./constants.js";
import {
  conflict,
  emitMentoringNotification,
  findRelationForMember,
  invalid,
  normalizeText,
  notFound,
  otherPartyId,
  recordMentoringAudit,
  resolveDb,
  withMentoringRelationLock
} from "./shared.js";
import { serializeSummary } from "./serializers.js";

const OPEN_STATUSES = [MENTORING_RELATION_STATUS.ACTIVE, MENTORING_RELATION_STATUS.PAUSED];

async function loadSummary(tx, relation, summaryId) {
  const id = String(summaryId || "").trim();
  if (!id) throw notFound();
  const summary = await tx.mentoringSummary.findFirst({
    where: { id, relationId: relation.id },
    include: { confirmations: true }
  });
  if (!summary) throw notFound();
  return summary;
}

export async function createMentoringSummary(actor, relationId, payload = {}, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const content = normalizeText(payload.content, { required: true, field: "summary" });
  const kind = String(payload.kind || MENTORING_SUMMARY_KIND.MEETING).toUpperCase();
  if (!Object.values(MENTORING_SUMMARY_KIND).includes(kind)) throw invalid("INVALID_SUMMARY_KIND");
  return withMentoringRelationLock(db, relationId, async (tx) => {
    const relation = await findRelationForMember(tx, actor.userId, relationId);
    if (!OPEN_STATUSES.includes(relation.status)) throw conflict("RELATION_NOT_OPEN");
    let meetingId = null;
    if (payload.meetingId) {
      const meeting = await tx.mentoringMeeting.findFirst({
        where: { id: String(payload.meetingId), relationId: relation.id },
        select: { id: true }
      });
      if (!meeting) throw notFound();
      meetingId = meeting.id;
    }
    const summary = await tx.mentoringSummary.create({
      data: {
        relationId: relation.id,
        meetingId,
        kind,
        content,
        status: MENTORING_SUMMARY_STATUS.DRAFT,
        createdByUserId: actor.userId
      }
    });
    await tx.mentoringRelation.updateMany({
      where: { id: relation.id },
      data: { lastActivityAt: now }
    });
    await recordMentoringAudit(tx, {
      action: MENTORING_AUDIT_ACTIONS.SUMMARY_CREATED,
      actorUserId: actor.userId,
      relationId: relation.id,
      summaryId: summary.id
    });
    return serializeSummary({ ...summary, confirmations: [] }, { userId: actor.userId });
  });
}

export async function updateMentoringSummary(actor, relationId, summaryId, payload = {}, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const content = normalizeText(payload.content, { required: true, field: "summary" });
  return withMentoringRelationLock(db, relationId, async (tx) => {
    const relation = await findRelationForMember(tx, actor.userId, relationId);
    if (!OPEN_STATUSES.includes(relation.status)) throw conflict("RELATION_NOT_OPEN");
    const summary = await loadSummary(tx, relation, summaryId);
    if (summary.status !== MENTORING_SUMMARY_STATUS.DRAFT
      && summary.status !== MENTORING_SUMMARY_STATUS.PENDING_CONFIRM) {
      throw conflict("SUMMARY_NOT_EDITABLE");
    }
    const expectedVersion = Number(payload.expectedVersion);
    if (!Number.isInteger(expectedVersion)) throw conflict("SUMMARY_VERSION_REQUIRED");
    // Sisu muutmine tühistab senised kinnitused (kinnitus käib täpse teksti
    // kohta) ja viib mustandi tagasi DRAFT-i.
    const updated = await tx.mentoringSummary.updateMany({
      where: { id: summary.id, relationId: relation.id, version: expectedVersion },
      data: { content, status: MENTORING_SUMMARY_STATUS.DRAFT, version: { increment: 1 }, updatedAt: now }
    });
    if (updated.count !== 1) throw conflict("SUMMARY_VERSION_CONFLICT");
    await tx.mentoringSummaryConfirmation.deleteMany({ where: { summaryId: summary.id } });
    const fresh = await loadSummary(tx, relation, summary.id);
    return serializeSummary(fresh, { userId: actor.userId });
  });
}

export async function submitMentoringSummary(actor, relationId, summaryId, payload = {}, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  return withMentoringRelationLock(db, relationId, async (tx) => {
    const relation = await findRelationForMember(tx, actor.userId, relationId);
    if (!OPEN_STATUSES.includes(relation.status)) throw conflict("RELATION_NOT_OPEN");
    const summary = await loadSummary(tx, relation, summaryId);
    if (summary.status !== MENTORING_SUMMARY_STATUS.DRAFT) throw conflict("SUMMARY_NOT_DRAFT");
    const expectedVersion = Number(payload.expectedVersion);
    if (!Number.isInteger(expectedVersion)) throw conflict("SUMMARY_VERSION_REQUIRED");
    const updated = await tx.mentoringSummary.updateMany({
      where: { id: summary.id, relationId: relation.id, status: MENTORING_SUMMARY_STATUS.DRAFT, version: expectedVersion },
      data: { status: MENTORING_SUMMARY_STATUS.PENDING_CONFIRM, version: { increment: 1 }, updatedAt: now }
    });
    if (updated.count !== 1) throw conflict("SUMMARY_VERSION_CONFLICT");
    await recordMentoringAudit(tx, {
      action: MENTORING_AUDIT_ACTIONS.SUMMARY_SUBMITTED,
      actorUserId: actor.userId,
      relationId: relation.id,
      summaryId: summary.id
    });
    await emitMentoringNotification(tx, {
      type: NOTIFICATION_EVENT_TYPES.MENTORING_SUMMARY_PENDING,
      userId: otherPartyId(relation, actor.userId),
      sourceId: summary.id,
      targetId: relation.id,
      dedupeSuffix: `v${summary.version + 1}:pending`
    }, { now });
    const fresh = await loadSummary(tx, relation, summary.id);
    return serializeSummary(fresh, { userId: actor.userId });
  });
}

/**
 * Kahepoolne kinnitus (ptk 4.5): mõlema poole kinnituskirje; viimane kinnitus
 * lülitab CONFIRMED SAMAS tehingus.
 */
export async function confirmMentoringSummary(actor, relationId, summaryId, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  return withMentoringRelationLock(db, relationId, async (tx) => {
    const relation = await findRelationForMember(tx, actor.userId, relationId);
    if (!OPEN_STATUSES.includes(relation.status)) throw conflict("RELATION_NOT_OPEN");
    const summary = await loadSummary(tx, relation, summaryId);
    if (summary.status !== MENTORING_SUMMARY_STATUS.PENDING_CONFIRM) {
      throw conflict("SUMMARY_NOT_PENDING");
    }
    const existing = summary.confirmations.find((c) => c.userId === actor.userId);
    if (!existing) {
      await tx.mentoringSummaryConfirmation.create({
        data: { summaryId: summary.id, userId: actor.userId, confirmedAt: now }
      });
    }
    const other = otherPartyId(relation, actor.userId);
    const otherConfirmed = other
      ? summary.confirmations.some((c) => c.userId === other)
        || Boolean(await tx.mentoringSummaryConfirmation.findFirst({
          where: { summaryId: summary.id, userId: other }, select: { id: true }
        }))
      : false;

    if (otherConfirmed) {
      const updated = await tx.mentoringSummary.updateMany({
        where: { id: summary.id, status: MENTORING_SUMMARY_STATUS.PENDING_CONFIRM, version: summary.version },
        data: {
          status: MENTORING_SUMMARY_STATUS.CONFIRMED,
          confirmedAt: now,
          version: { increment: 1 },
          updatedAt: now
        }
      });
      if (updated.count !== 1) throw conflict("SUMMARY_VERSION_CONFLICT");
      if (summary.correctionOfId) {
        const linked = await tx.mentoringSummary.updateMany({
          where: {
            id: summary.correctionOfId,
            relationId: relation.id,
            status: MENTORING_SUMMARY_STATUS.CONFIRMED,
            supersededById: null
          },
          data: { supersededById: summary.id, version: { increment: 1 }, updatedAt: now }
        });
        if (linked.count !== 1) throw conflict("SUMMARY_ALREADY_SUPERSEDED");
      }
      await recordMentoringAudit(tx, {
        action: MENTORING_AUDIT_ACTIONS.SUMMARY_CONFIRMED,
        actorUserId: actor.userId,
        relationId: relation.id,
        summaryId: summary.id
      });
      for (const memberId of [relation.mentorUserId, relation.menteeUserId]) {
        await emitMentoringNotification(tx, {
          type: NOTIFICATION_EVENT_TYPES.MENTORING_SUMMARY_CONFIRMED,
          userId: memberId,
          sourceId: summary.id,
          targetId: relation.id,
          dedupeSuffix: "confirmed"
        }, { now });
      }
    }
    await tx.mentoringRelation.updateMany({
      where: { id: relation.id },
      data: { lastActivityAt: now }
    });
    const fresh = await loadSummary(tx, relation, summary.id);
    return serializeSummary(fresh, { userId: actor.userId });
  });
}

export async function discardMentoringSummary(actor, relationId, summaryId, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  return withMentoringRelationLock(db, relationId, async (tx) => {
    const relation = await findRelationForMember(tx, actor.userId, relationId);
    const summary = await loadSummary(tx, relation, summaryId);
    if (summary.status === MENTORING_SUMMARY_STATUS.CONFIRMED) throw conflict("SUMMARY_CONFIRMED");
    const updated = await tx.mentoringSummary.updateMany({
      where: {
        id: summary.id,
        relationId: relation.id,
        status: { in: [MENTORING_SUMMARY_STATUS.DRAFT, MENTORING_SUMMARY_STATUS.PENDING_CONFIRM] },
        version: summary.version
      },
      data: { status: MENTORING_SUMMARY_STATUS.DISCARDED, version: { increment: 1 }, updatedAt: now }
    });
    if (updated.count !== 1) throw conflict("SUMMARY_VERSION_CONFLICT");
    await recordMentoringAudit(tx, {
      action: MENTORING_AUDIT_ACTIONS.SUMMARY_DISCARDED,
      actorUserId: actor.userId,
      relationId: relation.id,
      summaryId: summary.id
    });
    return { ok: true };
  });
}

/**
 * Kinnitatud kokkuvõtte parandus = UUS versioon supersedes-viitega (ptk 3.10:
 * kinnitatut tagasi ei võeta). Uus mustand alustab DRAFT-ist ja läbib sama
 * kahepoolse kinnituse; kinnitamisel märgitakse vana superseded.
 */
export async function superseedMentoringSummary(actor, relationId, summaryId, payload = {}, options = {}) {
  const db = resolveDb(options);
  const content = normalizeText(payload.content, { required: true, field: "summary" });
  return withMentoringRelationLock(db, relationId, async (tx) => {
    const relation = await findRelationForMember(tx, actor.userId, relationId);
    if (!OPEN_STATUSES.includes(relation.status)) throw conflict("RELATION_NOT_OPEN");
    const original = await loadSummary(tx, relation, summaryId);
    if (original.status !== MENTORING_SUMMARY_STATUS.CONFIRMED) throw conflict("SUMMARY_NOT_CONFIRMED");
    if (original.supersededById) throw conflict("SUMMARY_ALREADY_SUPERSEDED");
    const pendingCorrection = await tx.mentoringSummary.findFirst({
      where: {
        correctionOfId: original.id,
        status: { in: [MENTORING_SUMMARY_STATUS.DRAFT, MENTORING_SUMMARY_STATUS.PENDING_CONFIRM] }
      },
      select: { id: true }
    });
    if (pendingCorrection) throw conflict("SUMMARY_CORRECTION_PENDING");
    const replacement = await tx.mentoringSummary.create({
      data: {
        relationId: relation.id,
        meetingId: original.meetingId,
        kind: original.kind,
        content,
        status: MENTORING_SUMMARY_STATUS.DRAFT,
        correctionOfId: original.id,
        createdByUserId: actor.userId
      }
    });
    await recordMentoringAudit(tx, {
      action: MENTORING_AUDIT_ACTIONS.SUMMARY_CREATED,
      actorUserId: actor.userId,
      relationId: relation.id,
      summaryId: replacement.id,
      meta: { supersedes: original.id }
    });
    return serializeSummary({ ...replacement, confirmations: [] }, { userId: actor.userId });
  });
}
