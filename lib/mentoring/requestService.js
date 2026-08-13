import { NOTIFICATION_EVENT_TYPES } from "../notifications.js";
import {
  MENTOR_PROFILE_STATUS,
  MENTOR_CAPACITY,
  MENTORING_REQUEST_STATUS,
  MENTORING_RELATION_STATUS,
  MENTORING_AUDIT_ACTIONS,
  MENTORING_LIMITS
} from "./constants.js";
import {
  conflict,
  emitMentoringNotification,
  invalid,
  mentoringError,
  normalizeText,
  notFound,
  recordMentoringAudit,
  resolveDb,
  withMentoringProfileLock,
  withMentoringRelationLock
} from "./shared.js";
import { serializeRequestForMentee, serializeRequestForMentor } from "./serializers.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function isUniqueConflict(error) {
  return error?.code === "P2002" || error?.name === "UniqueConstraintError";
}

/**
 * Taotluse loomine (ptk 4.2): profiil ACTIVE või avaliku kinnitatud snapshot'iga
 * PENDING_REVIEW + capacity OPEN + mitte iseendale
 * + max 1 PENDING paari kohta (osaline unikaalindeks) + max 1 mitte-CLOSED
 * suhe suunas + rate-limit (max 5 PENDING) + 30p cooldown DECLINED järel.
 */
export async function createMentoringRequest(actor, payload = {}, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const profileId = String(payload.mentorProfileId || "").trim();
  if (!profileId) throw invalid("MISSING_PROFILE");
  const message = normalizeText(payload.message, { required: true, field: "message" });

  return withMentoringProfileLock(db, `request:${actor.userId}`, async (tx) => {
    const profile = await tx.mentorProfile.findFirst({
      where: {
        id: profileId,
        userId: { not: null },
        OR: [
          { status: MENTOR_PROFILE_STATUS.ACTIVE },
          { status: MENTOR_PROFILE_STATUS.PENDING_REVIEW, approvedSnapshotVisible: true }
        ]
      }
    });
    if (!profile) throw notFound();
    if (profile.userId === actor.userId) throw invalid("SELF_REQUEST_FORBIDDEN");
    if (profile.capacity !== MENTOR_CAPACITY.OPEN) {
      throw mentoringError("mentoring.errors.capacity_full", 409, "CAPACITY_FULL");
    }

    const pendingCount = await tx.mentoringRequest.count({
      where: { menteeId: actor.userId, status: MENTORING_REQUEST_STATUS.PENDING }
    });
    if (pendingCount >= MENTORING_LIMITS.MAX_PENDING_REQUESTS) {
      throw mentoringError("mentoring.errors.rate_limited", 429, "TOO_MANY_PENDING");
    }

    const existingPending = await tx.mentoringRequest.findFirst({
      where: {
        menteeId: actor.userId,
        mentorUserId: profile.userId,
        status: MENTORING_REQUEST_STATUS.PENDING
      },
      select: { id: true }
    });
    if (existingPending) throw conflict("REQUEST_ALREADY_PENDING");

    const cooldownSince = new Date(now.getTime() - MENTORING_LIMITS.DECLINED_COOLDOWN_DAYS * DAY_MS);
    const recentDecline = await tx.mentoringRequest.findFirst({
      where: {
        menteeId: actor.userId,
        mentorUserId: profile.userId,
        status: MENTORING_REQUEST_STATUS.DECLINED,
        respondedAt: { gt: cooldownSince }
      },
      select: { id: true }
    });
    if (recentDecline) {
      throw mentoringError("mentoring.errors.cooldown_active", 409, "DECLINE_COOLDOWN");
    }

    const openRelation = await tx.mentoringRelation.findFirst({
      where: {
        mentorUserId: profile.userId,
        menteeUserId: actor.userId,
        status: { not: MENTORING_RELATION_STATUS.CLOSED }
      },
      select: { id: true }
    });
    if (openRelation) throw conflict("RELATION_ALREADY_OPEN");

    let request;
    try {
      request = await tx.mentoringRequest.create({
        data: {
          menteeId: actor.userId,
          mentorProfileId: profile.id,
          mentorUserId: profile.userId,
          message,
          status: MENTORING_REQUEST_STATUS.PENDING,
          expiresAt: new Date(now.getTime() + MENTORING_LIMITS.REQUEST_EXPIRY_DAYS * DAY_MS)
        }
      });
    } catch (error) {
      if (isUniqueConflict(error)) throw conflict("REQUEST_ALREADY_PENDING");
      throw error;
    }

    await recordMentoringAudit(tx, {
      action: MENTORING_AUDIT_ACTIONS.REQUEST_CREATED,
      actorUserId: actor.userId,
      profileId: profile.id,
      requestId: request.id
    });
    await emitMentoringNotification(tx, {
      type: NOTIFICATION_EVENT_TYPES.MENTORING_REQUEST_CREATED,
      userId: profile.userId,
      sourceId: request.id,
      targetId: request.id
    }, { now });

    return serializeRequestForMentee(request, profile);
  });
}

export async function listMyMentoringRequests(actor, options = {}) {
  const db = resolveDb(options);
  const requests = await db.mentoringRequest.findMany({
    where: { menteeId: actor.userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    include: { mentorProfile: { select: { displayName: true } } }
  });
  return requests.map((request) => serializeRequestForMentee(request, request.mentorProfile));
}

export async function listIncomingMentoringRequests(actor, options = {}) {
  const db = resolveDb(options);
  const requests = await db.mentoringRequest.findMany({
    where: { mentorUserId: actor.userId, status: MENTORING_REQUEST_STATUS.PENDING },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 100,
    include: {
      mentee: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } }
    }
  });
  return requests.map((request) => {
    const first = request.mentee?.profile?.firstName || "";
    const last = request.mentee?.profile?.lastName || "";
    const name = `${first} ${last}`.trim() || request.mentee?.email || null;
    return serializeRequestForMentor(request, name);
  });
}

export async function cancelMentoringRequest(actor, requestId, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const id = String(requestId || "").trim();
  if (!id) throw notFound();
  return db.$transaction(async (tx) => {
    const request = await tx.mentoringRequest.findFirst({
      where: { id, menteeId: actor.userId }
    });
    if (!request) throw notFound();
    if (request.status !== MENTORING_REQUEST_STATUS.PENDING) throw conflict("REQUEST_NOT_PENDING");
    const updated = await tx.mentoringRequest.updateMany({
      where: { id, menteeId: actor.userId, status: MENTORING_REQUEST_STATUS.PENDING, version: request.version },
      data: {
        status: MENTORING_REQUEST_STATUS.CANCELLED,
        cancelledAt: now,
        version: { increment: 1 }
      }
    });
    if (updated.count !== 1) throw conflict("REQUEST_VERSION_CONFLICT");
    await recordMentoringAudit(tx, {
      action: MENTORING_AUDIT_ACTIONS.REQUEST_CANCELLED,
      actorUserId: actor.userId,
      requestId: id
    });
    return { ok: true, status: MENTORING_REQUEST_STATUS.CANCELLED };
  });
}

/**
 * Mentori vastus (ptk 4.2). ACCEPT loob MentoringRelation DRAFT-i SAMAS
 * tehingus (I1: suhe tekib ainult mentori enda ACCEPT-tehingus). DECLINE:
 * põhjendust EI edastata (viisakas seis).
 */
export async function respondMentoringRequest(actor, requestId, decision, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const id = String(requestId || "").trim();
  if (!id) throw notFound();
  const accept = decision === "ACCEPT";
  if (!accept && decision !== "DECLINE") throw invalid("INVALID_DECISION");

  return withMentoringRelationLock(db, `request:${id}`, async (tx) => {
    const request = await tx.mentoringRequest.findFirst({
      where: { id, mentorUserId: actor.userId }
    });
    if (!request) throw notFound();
    if (request.status !== MENTORING_REQUEST_STATUS.PENDING) throw conflict("REQUEST_NOT_PENDING");
    if (request.expiresAt && request.expiresAt.getTime() <= now.getTime()) {
      throw conflict("REQUEST_EXPIRED");
    }

    const nextStatus = accept
      ? MENTORING_REQUEST_STATUS.ACCEPTED
      : MENTORING_REQUEST_STATUS.DECLINED;
    const updated = await tx.mentoringRequest.updateMany({
      where: { id, mentorUserId: actor.userId, status: MENTORING_REQUEST_STATUS.PENDING, version: request.version },
      data: { status: nextStatus, respondedAt: now, version: { increment: 1 } }
    });
    if (updated.count !== 1) throw conflict("REQUEST_VERSION_CONFLICT");

    let relation = null;
    if (accept) {
      const openRelation = await tx.mentoringRelation.findFirst({
        where: {
          mentorUserId: actor.userId,
          menteeUserId: request.menteeId,
          status: { not: MENTORING_RELATION_STATUS.CLOSED }
        },
        select: { id: true }
      });
      if (openRelation) throw conflict("RELATION_ALREADY_OPEN");
      try {
        relation = await tx.mentoringRelation.create({
          data: {
            mentorUserId: actor.userId,
            menteeUserId: request.menteeId,
            requestId: request.id,
            status: MENTORING_RELATION_STATUS.DRAFT,
            lastActivityAt: now
          }
        });
      } catch (error) {
        if (isUniqueConflict(error)) throw conflict("RELATION_ALREADY_OPEN");
        throw error;
      }
      await recordMentoringAudit(tx, {
        action: MENTORING_AUDIT_ACTIONS.RELATION_STARTED,
        actorUserId: actor.userId,
        requestId: request.id,
        relationId: relation.id
      });
    }

    await recordMentoringAudit(tx, {
      action: accept
        ? MENTORING_AUDIT_ACTIONS.REQUEST_ACCEPTED
        : MENTORING_AUDIT_ACTIONS.REQUEST_DECLINED,
      actorUserId: actor.userId,
      requestId: request.id
    });
    await emitMentoringNotification(tx, {
      type: accept
        ? NOTIFICATION_EVENT_TYPES.MENTORING_REQUEST_ACCEPTED
        : NOTIFICATION_EVENT_TYPES.MENTORING_REQUEST_DECLINED,
      userId: request.menteeId,
      sourceId: request.id,
      targetId: request.id,
      dedupeSuffix: nextStatus,
      emailPolicy: accept ? "OPTIONAL" : "NONE"
    }, { now });

    return { ok: true, status: nextStatus, relationId: relation?.id || null };
  });
}
