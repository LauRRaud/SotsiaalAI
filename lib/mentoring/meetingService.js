import { NOTIFICATION_EVENT_TYPES } from "../notifications.js";
import {
  MENTORING_RELATION_STATUS,
  MENTORING_MEETING_STATUS,
  MENTORING_MEETING_MODE,
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
import { serializeMeeting } from "./serializers.js";

function parseOccurredAt(value) {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  if (!Number.isFinite(date.getTime())) throw invalid("INVALID_MEETING_TIME");
  return date;
}

async function resolveRoomReference(tx, userId, roomId) {
  const id = String(roomId || "").trim();
  if (!id) return null;
  // Viide (SetNull), MITTE omandus: lubatud on ainult ruum, mille liige
  // kasutaja ise on — võõra ruumi ID ei salvestu.
  const membership = await tx.roomMember.findFirst({
    where: { roomId: id, userId, leftAt: null },
    select: { roomId: true }
  });
  if (!membership) throw notFound();
  return id;
}

export async function createMentoringMeeting(actor, relationId, payload = {}, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const occurredAt = parseOccurredAt(payload.occurredAt);
  const mode = String(payload.mode || MENTORING_MEETING_MODE.EXTERNAL).toUpperCase();
  if (!Object.values(MENTORING_MEETING_MODE).includes(mode)) throw invalid("INVALID_MEETING_MODE");
  const topicSummary = normalizeText(payload.topicSummary);
  return withMentoringRelationLock(db, relationId, async (tx) => {
    const relation = await findRelationForMember(tx, actor.userId, relationId);
    if (relation.status !== MENTORING_RELATION_STATUS.ACTIVE) throw conflict("RELATION_NOT_ACTIVE");
    const roomId = mode === MENTORING_MEETING_MODE.PLATFORM_ROOM
      ? await resolveRoomReference(tx, actor.userId, payload.roomId)
      : null;
    const meeting = await tx.mentoringMeeting.create({
      data: {
        relationId: relation.id,
        occurredAt,
        mode,
        roomId,
        topicSummary,
        status: MENTORING_MEETING_STATUS.PLANNED,
        createdByUserId: actor.userId
      }
    });
    await tx.mentoringRelation.updateMany({
      where: { id: relation.id },
      data: { lastActivityAt: now }
    });
    await recordMentoringAudit(tx, {
      action: MENTORING_AUDIT_ACTIONS.MEETING_CREATED,
      actorUserId: actor.userId,
      relationId: relation.id,
      meta: { meetingId: meeting.id }
    });
    await emitMentoringNotification(tx, {
      type: NOTIFICATION_EVENT_TYPES.MENTORING_MEETING_CHANGED,
      userId: otherPartyId(relation, actor.userId),
      sourceId: meeting.id,
      targetId: relation.id,
      dedupeSuffix: `created:${meeting.id}`
    }, { now });
    return serializeMeeting(meeting);
  });
}

export async function updateMentoringMeeting(actor, relationId, meetingId, payload = {}, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const id = String(meetingId || "").trim();
  if (!id) throw notFound();
  return withMentoringRelationLock(db, relationId, async (tx) => {
    const relation = await findRelationForMember(tx, actor.userId, relationId);
    const meeting = await tx.mentoringMeeting.findFirst({
      where: { id, relationId: relation.id }
    });
    if (!meeting) throw notFound();
    const expectedVersion = Number(payload.expectedVersion);
    if (!Number.isInteger(expectedVersion)) throw conflict("MEETING_VERSION_REQUIRED");

    const action = String(payload.action || "update");
    let data = {};
    let auditAction = MENTORING_AUDIT_ACTIONS.MEETING_UPDATED;
    let notifyType = NOTIFICATION_EVENT_TYPES.MENTORING_MEETING_CHANGED;

    if (action === "held") {
      if (meeting.status === MENTORING_MEETING_STATUS.CANCELLED) throw conflict("MEETING_CANCELLED");
      data = { status: MENTORING_MEETING_STATUS.HELD };
      auditAction = MENTORING_AUDIT_ACTIONS.MEETING_HELD;
    } else if (action === "cancel") {
      if (meeting.status !== MENTORING_MEETING_STATUS.PLANNED) throw conflict("MEETING_NOT_PLANNED");
      data = { status: MENTORING_MEETING_STATUS.CANCELLED };
      auditAction = MENTORING_AUDIT_ACTIONS.MEETING_CANCELLED;
      notifyType = NOTIFICATION_EVENT_TYPES.MENTORING_MEETING_CANCELLED;
    } else if (action === "update") {
      if (relation.status !== MENTORING_RELATION_STATUS.ACTIVE) throw conflict("RELATION_NOT_ACTIVE");
      if (meeting.status !== MENTORING_MEETING_STATUS.PLANNED) throw conflict("MEETING_NOT_PLANNED");
      const mode = payload.mode
        ? String(payload.mode).toUpperCase()
        : meeting.mode;
      if (!Object.values(MENTORING_MEETING_MODE).includes(mode)) throw invalid("INVALID_MEETING_MODE");
      data = {
        occurredAt: payload.occurredAt ? parseOccurredAt(payload.occurredAt) : meeting.occurredAt,
        mode,
        roomId: mode === MENTORING_MEETING_MODE.PLATFORM_ROOM
          ? (payload.roomId !== undefined
            ? await resolveRoomReference(tx, actor.userId, payload.roomId)
            : meeting.roomId)
          : null,
        topicSummary: payload.topicSummary !== undefined
          ? normalizeText(payload.topicSummary)
          : meeting.topicSummary
      };
    } else {
      throw invalid("INVALID_MEETING_ACTION");
    }

    const updated = await tx.mentoringMeeting.updateMany({
      where: { id: meeting.id, relationId: relation.id, version: expectedVersion },
      data: { ...data, version: { increment: 1 }, updatedAt: now }
    });
    if (updated.count !== 1) throw conflict("MEETING_VERSION_CONFLICT");
    await tx.mentoringRelation.updateMany({
      where: { id: relation.id },
      data: { lastActivityAt: now }
    });
    await recordMentoringAudit(tx, {
      action: auditAction,
      actorUserId: actor.userId,
      relationId: relation.id,
      meta: { meetingId: meeting.id }
    });
    await emitMentoringNotification(tx, {
      type: notifyType,
      userId: otherPartyId(relation, actor.userId),
      sourceId: meeting.id,
      targetId: relation.id,
      dedupeSuffix: `${action}:${now.getTime()}`
    }, { now });
    const fresh = await tx.mentoringMeeting.findFirst({ where: { id: meeting.id } });
    return serializeMeeting(fresh);
  });
}
