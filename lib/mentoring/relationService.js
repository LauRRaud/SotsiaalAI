import { NOTIFICATION_EVENT_TYPES } from "../notifications.js";
import {
  MENTORING_RELATION_STATUS,
  MENTORING_SUMMARY_STATUS,
  MENTORING_NOTE_KIND,
  MENTORING_CLOSE_REASONS,
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
import { serializeRelation } from "./serializers.js";

const OPEN_STATUSES = [
  MENTORING_RELATION_STATUS.DRAFT,
  MENTORING_RELATION_STATUS.ACTIVE,
  MENTORING_RELATION_STATUS.PAUSED
];

export async function listMyMentoringRelations(actor, options = {}) {
  const db = resolveDb(options);
  const relations = await db.mentoringRelation.findMany({
    where: { OR: [{ mentorUserId: actor.userId }, { menteeUserId: actor.userId }] },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 100,
    include: {
      mentorUser: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
      menteeUser: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } }
    }
  });
  return relations.map((relation) => serializeRelation(relation, {
    userId: actor.userId,
    mentorUser: relation.mentorUser,
    menteeUser: relation.menteeUser
  }));
}

export async function getMentoringRelation(actor, relationId, options = {}) {
  const db = resolveDb(options);
  const relation = await findRelationForMember(db, actor.userId, relationId);
  const otherId = otherPartyId(relation, actor.userId);
  const ownRoomMemberships = otherId ? await db.roomMember.findMany({
    where: { userId: actor.userId, leftAt: null },
    select: { roomId: true }
  }) : [];
  const ownRoomIds = ownRoomMemberships.map((membership) => membership.roomId);
  const sharedMemberships = ownRoomIds.length ? await db.roomMember.findMany({
    where: { userId: otherId, roomId: { in: ownRoomIds }, leftAt: null },
    select: { roomId: true }
  }) : [];
  const sharedRoomIds = sharedMemberships.map((membership) => membership.roomId);
  const [acceptances, meetings, summaries, notes, preparations, mentorUser, menteeUser, commonRooms] =
    await Promise.all([
      db.mentoringAgreementAcceptance.findMany({
        where: { relationId: relation.id },
        orderBy: { acceptedAt: "asc" }
      }),
      db.mentoringMeeting.findMany({
        where: { relationId: relation.id },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: 100
      }),
      db.mentoringSummary.findMany({
        where: { relationId: relation.id },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 100,
        include: { confirmations: true }
      }),
      db.mentoringPrivateNote.findMany({
        where: { ownerId: actor.userId, relationId: relation.id, kind: MENTORING_NOTE_KIND.NOTE },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 100
      }),
      db.mentoringPrivateNote.findMany({
        where: {
          relationId: relation.id,
          kind: MENTORING_NOTE_KIND.PREPARATION,
          OR: [
            { ownerId: actor.userId },
            { sharedAt: { not: null }, recalledAt: null }
          ]
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 50
      }),
      relation.mentorUserId
        ? db.user.findUnique({
          where: { id: relation.mentorUserId },
          select: { email: true, profile: { select: { firstName: true, lastName: true } } }
        })
        : null,
      relation.menteeUserId
        ? db.user.findUnique({
          where: { id: relation.menteeUserId },
          select: { email: true, profile: { select: { firstName: true, lastName: true } } }
        })
        : null,
      sharedRoomIds.length
        ? db.room.findMany({
          where: { id: { in: sharedRoomIds }, archivedAt: null },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          select: { id: true, title: true }
        })
        : []
    ]);
  return serializeRelation(relation, {
    userId: actor.userId,
    acceptances,
    meetings,
    summaries,
    notes,
    preparations,
    commonRooms,
    mentorUser,
    menteeUser
  });
}

export async function updateMentoringGoal(actor, relationId, payload = {}, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const goalSummary = normalizeText(payload.goalSummary);
  return withMentoringRelationLock(db, relationId, async (tx) => {
    const relation = await findRelationForMember(tx, actor.userId, relationId);
    if (!OPEN_STATUSES.includes(relation.status)) throw conflict("RELATION_NOT_OPEN");
    const expectedVersion = Number(payload.expectedVersion);
    if (!Number.isInteger(expectedVersion)) throw conflict("RELATION_VERSION_REQUIRED");
    const updated = await tx.mentoringRelation.updateMany({
      where: { id: relation.id, version: expectedVersion },
      data: { goalSummary, version: { increment: 1 }, lastActivityAt: now }
    });
    if (updated.count !== 1) throw conflict("RELATION_VERSION_CONFLICT");
    return { ok: true };
  });
}

/**
 * Kokkuleppe uus versioon (ptk 3.5): kumbki pool võib esitada; esitaja
 * kinnitab automaatselt; jõustub (ACTIVE) alles teise poole kinnitusega —
 * "viimane kinnitus lülitab" (ptk 4.3).
 */
export async function proposeMentoringAgreement(actor, relationId, payload = {}, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const locale = String(options.locale || "et");
  const agreementText = normalizeText(payload.agreementText, { required: true, field: "agreement" });
  return withMentoringRelationLock(db, relationId, async (tx) => {
    const relation = await findRelationForMember(tx, actor.userId, relationId);
    if (!OPEN_STATUSES.includes(relation.status)) throw conflict("RELATION_NOT_OPEN");
    const expectedVersion = Number(payload.expectedVersion);
    if (!Number.isInteger(expectedVersion)) throw conflict("RELATION_VERSION_REQUIRED");
    const nextAgreementVersion = relation.agreementVersion + 1;
    const updated = await tx.mentoringRelation.updateMany({
      where: { id: relation.id, version: expectedVersion },
      data: {
        agreementText,
        agreementVersion: nextAgreementVersion,
        version: { increment: 1 },
        lastActivityAt: now
      }
    });
    if (updated.count !== 1) throw conflict("RELATION_VERSION_CONFLICT");
    await tx.mentoringAgreementAcceptance.create({
      data: {
        relationId: relation.id,
        userId: actor.userId,
        agreementVersion: nextAgreementVersion,
        textSnapshot: agreementText,
        locale,
        acceptedAt: now
      }
    });
    await recordMentoringAudit(tx, {
      action: MENTORING_AUDIT_ACTIONS.AGREEMENT_PROPOSED,
      actorUserId: actor.userId,
      relationId: relation.id,
      meta: { agreementVersion: nextAgreementVersion }
    });
    await emitMentoringNotification(tx, {
      type: NOTIFICATION_EVENT_TYPES.MENTORING_AGREEMENT_UPDATED,
      userId: otherPartyId(relation, actor.userId),
      sourceId: relation.id,
      targetId: relation.id,
      dedupeSuffix: `v${nextAgreementVersion}`
    }, { now });
    return { ok: true, agreementVersion: nextAgreementVersion };
  });
}

export async function acceptMentoringAgreement(actor, relationId, payload = {}, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const locale = String(options.locale || "et");
  const agreementVersion = Number(payload.agreementVersion);
  if (!Number.isInteger(agreementVersion) || agreementVersion < 1) throw invalid("INVALID_AGREEMENT_VERSION");
  return withMentoringRelationLock(db, relationId, async (tx) => {
    const relation = await findRelationForMember(tx, actor.userId, relationId);
    if (!OPEN_STATUSES.includes(relation.status)) throw conflict("RELATION_NOT_OPEN");
    if (relation.agreementVersion !== agreementVersion || !relation.agreementText) {
      throw conflict("AGREEMENT_VERSION_STALE");
    }
    const existing = await tx.mentoringAgreementAcceptance.findFirst({
      where: { relationId: relation.id, userId: actor.userId, agreementVersion }
    });
    if (existing) return { ok: true, status: relation.status, alreadyAccepted: true };
    await tx.mentoringAgreementAcceptance.create({
      data: {
        relationId: relation.id,
        userId: actor.userId,
        agreementVersion,
        textSnapshot: relation.agreementText,
        locale,
        acceptedAt: now
      }
    });
    await recordMentoringAudit(tx, {
      action: MENTORING_AUDIT_ACTIONS.AGREEMENT_ACCEPTED,
      actorUserId: actor.userId,
      relationId: relation.id,
      meta: { agreementVersion }
    });

    let status = relation.status;
    const other = otherPartyId(relation, actor.userId);
    const otherAccepted = other
      ? await tx.mentoringAgreementAcceptance.findFirst({
        where: { relationId: relation.id, userId: other, agreementVersion },
        select: { id: true }
      })
      : null;
    if (relation.status === MENTORING_RELATION_STATUS.DRAFT && otherAccepted) {
      const activated = await tx.mentoringRelation.updateMany({
        where: {
          id: relation.id,
          status: MENTORING_RELATION_STATUS.DRAFT,
          agreementVersion,
          version: relation.version
        },
        data: {
          status: MENTORING_RELATION_STATUS.ACTIVE,
          version: { increment: 1 },
          lastActivityAt: now
        }
      });
      if (activated.count !== 1) throw conflict("RELATION_VERSION_CONFLICT");
      status = MENTORING_RELATION_STATUS.ACTIVE;
      await recordMentoringAudit(tx, {
        action: MENTORING_AUDIT_ACTIONS.RELATION_ACTIVATED,
        actorUserId: actor.userId,
        relationId: relation.id,
        meta: { agreementVersion }
      });
      for (const memberId of [relation.mentorUserId, relation.menteeUserId]) {
        await emitMentoringNotification(tx, {
          type: NOTIFICATION_EVENT_TYPES.MENTORING_RELATION_ACTIVATED,
          userId: memberId,
          sourceId: relation.id,
          targetId: relation.id,
          dedupeSuffix: "active"
        }, { now });
      }
    }
    return { ok: true, status, alreadyAccepted: false };
  });
}

export async function pauseMentoringRelation(actor, relationId, options = {}) {
  return togglePause(actor, relationId, true, options);
}

export async function resumeMentoringRelation(actor, relationId, options = {}) {
  return togglePause(actor, relationId, false, options);
}

async function togglePause(actor, relationId, pause, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  return withMentoringRelationLock(db, relationId, async (tx) => {
    const relation = await findRelationForMember(tx, actor.userId, relationId);
    const from = pause ? MENTORING_RELATION_STATUS.ACTIVE : MENTORING_RELATION_STATUS.PAUSED;
    const to = pause ? MENTORING_RELATION_STATUS.PAUSED : MENTORING_RELATION_STATUS.ACTIVE;
    if (relation.status !== from) throw conflict("RELATION_STATUS_CONFLICT");
    const updated = await tx.mentoringRelation.updateMany({
      where: { id: relation.id, status: from, version: relation.version },
      data: {
        status: to,
        pausedAt: pause ? now : null,
        version: { increment: 1 },
        lastActivityAt: now
      }
    });
    if (updated.count !== 1) throw conflict("RELATION_VERSION_CONFLICT");
    await recordMentoringAudit(tx, {
      action: pause
        ? MENTORING_AUDIT_ACTIONS.RELATION_PAUSED
        : MENTORING_AUDIT_ACTIONS.RELATION_RESUMED,
      actorUserId: actor.userId,
      relationId: relation.id
    });
    await emitMentoringNotification(tx, {
      type: pause
        ? NOTIFICATION_EVENT_TYPES.MENTORING_RELATION_PAUSED
        : NOTIFICATION_EVENT_TYPES.MENTORING_RELATION_RESUMED,
      userId: otherPartyId(relation, actor.userId),
      sourceId: relation.id,
      targetId: relation.id,
      dedupeSuffix: `${to}:${now.getTime()}`
    }, { now });
    return { ok: true, status: to };
  });
}

/**
 * Sulgemise eelvaade: "mis säilib / mis kustub" värav (ptk 3.10) — arvud
 * arvutab server.
 */
export async function previewMentoringClose(actor, relationId, options = {}) {
  const db = resolveDb(options);
  const relation = await findRelationForMember(db, actor.userId, relationId);
  if (relation.status === MENTORING_RELATION_STATUS.CLOSED) throw conflict("RELATION_ALREADY_CLOSED");
  const [confirmedCount, draftCount, meetingCount, myNoteCount] = await Promise.all([
    db.mentoringSummary.count({
      where: { relationId: relation.id, status: MENTORING_SUMMARY_STATUS.CONFIRMED }
    }),
    db.mentoringSummary.count({
      where: {
        relationId: relation.id,
        status: { in: [MENTORING_SUMMARY_STATUS.DRAFT, MENTORING_SUMMARY_STATUS.PENDING_CONFIRM] }
      }
    }),
    db.mentoringMeeting.count({ where: { relationId: relation.id } }),
    db.mentoringPrivateNote.count({
      where: { relationId: relation.id, ownerId: actor.userId, kind: MENTORING_NOTE_KIND.NOTE }
    })
  ]);
  return {
    keeps: {
      confirmedSummaries: confirmedCount,
      meetingFacts: meetingCount,
      agreementAcceptances: true,
      myPrivateNotes: myNoteCount
    },
    purges: {
      unconfirmedSummaries: draftCount,
      goalSummary: Boolean(relation.goalSummary),
      meetingTopicSummaries: true
    }
  };
}

/**
 * Sulgemine + purge ÜHES tehingus (O-EM-7): kinnitamata mustandid ja ühisala
 * toorkirjed (goalSummary, kohtumiste topicSummary) kustuvad; kinnitatud
 * kokkuvõtted, kokkuleppekinnitused, faktikiri ja privaatmärkmed jäävad.
 */
export async function closeMentoringRelation(actor, relationId, payload = {}, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const reasonKey = String(payload.reasonKey || "completed");
  if (!MENTORING_CLOSE_REASONS.includes(reasonKey)) throw invalid("INVALID_CLOSE_REASON");
  if (payload.confirmed !== true) throw invalid("CLOSE_CONFIRMATION_REQUIRED");
  return withMentoringRelationLock(db, relationId, async (tx) => {
    const relation = await findRelationForMember(tx, actor.userId, relationId);
    if (relation.status === MENTORING_RELATION_STATUS.CLOSED) {
      return { ok: true, status: MENTORING_RELATION_STATUS.CLOSED, alreadyClosed: true };
    }
    const updated = await tx.mentoringRelation.updateMany({
      where: { id: relation.id, status: { not: MENTORING_RELATION_STATUS.CLOSED }, version: relation.version },
      data: {
        status: MENTORING_RELATION_STATUS.CLOSED,
        closedAt: now,
        closedByUserId: actor.userId,
        closeReasonKey: reasonKey,
        goalSummary: null,
        purgedAt: now,
        version: { increment: 1 },
        lastActivityAt: now
      }
    });
    if (updated.count !== 1) throw conflict("RELATION_VERSION_CONFLICT");

    const purgedSummaries = await tx.mentoringSummary.deleteMany({
      where: {
        relationId: relation.id,
        status: { in: [MENTORING_SUMMARY_STATUS.DRAFT, MENTORING_SUMMARY_STATUS.PENDING_CONFIRM] }
      }
    });
    await tx.mentoringMeeting.updateMany({
      where: { relationId: relation.id, topicSummary: { not: null } },
      data: { topicSummary: null }
    });

    await recordMentoringAudit(tx, {
      action: MENTORING_AUDIT_ACTIONS.RELATION_CLOSED,
      actorUserId: actor.userId,
      relationId: relation.id,
      meta: { reasonKey }
    });
    await recordMentoringAudit(tx, {
      action: MENTORING_AUDIT_ACTIONS.RELATION_PURGED,
      actorUserId: actor.userId,
      relationId: relation.id,
      meta: { purgedSummaries: purgedSummaries.count }
    });
    // I3: sulgemisteate saab AINULT teine pool.
    await emitMentoringNotification(tx, {
      type: NOTIFICATION_EVENT_TYPES.MENTORING_RELATION_CLOSED,
      userId: otherPartyId(relation, actor.userId),
      sourceId: relation.id,
      targetId: relation.id,
      dedupeSuffix: "closed",
      emailPolicy: "OPTIONAL"
    }, { now });
    return { ok: true, status: MENTORING_RELATION_STATUS.CLOSED, alreadyClosed: false };
  });
}

/**
 * Inaktiivsuskontrolli vastus "suhe elab" (ptk 3.10): nullib kontrolli ja
 * uuendab aktiivsust.
 */
export async function confirmMentoringRelationAlive(actor, relationId, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  return withMentoringRelationLock(db, relationId, async (tx) => {
    const relation = await findRelationForMember(tx, actor.userId, relationId);
    if (relation.status === MENTORING_RELATION_STATUS.CLOSED) throw conflict("RELATION_ALREADY_CLOSED");
    if (!relation.inactivityCheckAt) return { ok: true, cleared: false };
    const updated = await tx.mentoringRelation.updateMany({
      where: { id: relation.id, version: relation.version },
      data: { inactivityCheckAt: null, version: { increment: 1 }, lastActivityAt: now }
    });
    if (updated.count !== 1) throw conflict("RELATION_VERSION_CONFLICT");
    return { ok: true, cleared: true };
  });
}

export function relationNotFound() {
  return notFound();
}
