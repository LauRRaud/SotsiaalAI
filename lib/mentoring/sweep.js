import { prisma as defaultPrisma } from "../prisma.js";
import { NOTIFICATION_EVENT_TYPES, createNotificationEvent } from "../notifications.js";
import {
  MENTORING_REQUEST_STATUS,
  MENTORING_RELATION_STATUS,
  MENTORING_MEETING_STATUS,
  MENTOR_CONSENT_STATUS,
  MENTOR_PROFILE_ORIGIN,
  MENTORING_AUDIT_ACTIONS,
  MENTORING_LIMITS
} from "./constants.js";
import { recordMentoringAudit } from "./shared.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function tallinnDate(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Tallinn", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function emit(db, counters, input, now) {
  counters.notificationsConsidered += 1;
  const result = await createNotificationEvent(input, { db, now, verifyRecipient: false });
  counters[result.created ? "notificationsCreated" : "notificationsExisting"] += 1;
  return result;
}

function subtractUtcMonths(value, months) {
  const date = new Date(value.getTime());
  date.setUTCMonth(date.getUTCMonth() - months);
  return date;
}

/**
 * Mentorluse taustatöö (ptk 9) olemasoleva 5-min sweep-mustriga: taotluste
 * EXPIRED; DRAFT-suhte 30p sulgemine; inaktiivsus 90+30p kahes faasis;
 * meeting_upcoming; EM2 message-anonümiseerimine. Iga toiming on idempotentne
 * (olekukontroll + tingimuslik kirjutus enne kõrvalmõju). Uut worker'it EI
 * looda — see jookseb /api/jobs/notifications sees.
 */
export async function runMentoringSweep({ db = defaultPrisma, now = new Date(), dryRun = false, batchSize = 50 } = {}) {
  const take = Math.max(1, Math.min(Number(batchSize) || 50, 100));
  const counters = {
    requestsExpired: 0,
    draftRelationsClosed: 0,
    inactivityChecksSent: 0,
    inactivityRelationsClosed: 0,
    meetingsUpcoming: 0,
    externalConsentsStaled: 0,
    messagesAnonymized: 0,
    notificationsConsidered: 0,
    notificationsCreated: 0,
    notificationsExisting: 0
  };

  // 0) Välise profiili nõusolekukontroll aegub fail-closed täpselt pärast
  //    12 kuu piiri. Üleminek ja adminite ID-põhised teavitused on idempotentsed.
  const externalCutoff = subtractUtcMonths(now, MENTORING_LIMITS.STALE_EXTERNAL_MONTHS);
  const staleExternal = await db.mentorProfile.findMany({
    where: {
      origin: MENTOR_PROFILE_ORIGIN.ESTA_IMPORT,
      userId: null,
      consentStatus: MENTOR_CONSENT_STATUS.CONSENTED,
      OR: [
        { checkedAt: null },
        { checkedAt: { lt: externalCutoff } },
        { checkedAt: { gt: now } },
        { consentCapturedAt: null },
        { consentEvidenceType: null },
        { consentEvidenceRef: null }
      ]
    },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take
  });
  const admins = dryRun ? [] : await db.user.findMany({
    where: { OR: [{ role: "ADMIN" }, { isAdmin: true }] },
    select: { id: true }
  });
  for (const profile of staleExternal) {
    if (dryRun) { counters.externalConsentsStaled += 1; continue; }
    await db.$transaction(async (tx) => {
      const updated = await tx.mentorProfile.updateMany({
        where: { id: profile.id, consentStatus: MENTOR_CONSENT_STATUS.CONSENTED, version: profile.version },
        data: { consentStatus: MENTOR_CONSENT_STATUS.STALE, version: { increment: 1 }, updatedAt: now }
      });
      if (updated.count !== 1) return;
      counters.externalConsentsStaled += 1;
      await recordMentoringAudit(tx, {
        action: MENTORING_AUDIT_ACTIONS.CONSENT_STATUS_CHANGED,
        profileId: profile.id,
        meta: { from: MENTOR_CONSENT_STATUS.CONSENTED, to: MENTOR_CONSENT_STATUS.STALE, byTimer: true }
      });
      for (const admin of admins) {
        await emit(tx, counters, {
          type: NOTIFICATION_EVENT_TYPES.MENTORING_EXTERNAL_CONSENT_STALE,
          userId: admin.id,
          sourceId: profile.id,
          targetId: profile.id,
          dedupeSuffix: `stale:${profile.version + 1}`
        }, now);
      }
    });
  }

  // 1) PENDING taotlused üle tähtaja → EXPIRED (teavitus menteele).
  const expiredCandidates = await db.mentoringRequest.findMany({
    where: { status: MENTORING_REQUEST_STATUS.PENDING, expiresAt: { lte: now } },
    select: { id: true, menteeId: true, version: true },
    take
  });
  for (const request of expiredCandidates) {
    if (dryRun) { counters.requestsExpired += 1; continue; }
    await db.$transaction(async (tx) => {
      const updated = await tx.mentoringRequest.updateMany({
        where: { id: request.id, status: MENTORING_REQUEST_STATUS.PENDING, version: request.version },
        data: { status: MENTORING_REQUEST_STATUS.EXPIRED, respondedAt: null, version: { increment: 1 } }
      });
      if (updated.count !== 1) return;
      counters.requestsExpired += 1;
      await recordMentoringAudit(tx, {
        action: MENTORING_AUDIT_ACTIONS.REQUEST_EXPIRED,
        requestId: request.id
      });
      await emit(tx, counters, {
        type: NOTIFICATION_EVENT_TYPES.MENTORING_REQUEST_EXPIRED,
        userId: request.menteeId,
        sourceId: request.id,
        targetId: request.id,
        dedupeSuffix: "EXPIRED"
      }, now);
    });
  }

  // 2) DRAFT-suhe ilma mõlema kinnituseta 30p → automaatne sulgemine
  //    (not_started), teavitus mõlemale.
  const draftCutoff = new Date(now.getTime() - MENTORING_LIMITS.DRAFT_RELATION_EXPIRY_DAYS * DAY_MS);
  const draftCandidates = await db.mentoringRelation.findMany({
    where: { status: MENTORING_RELATION_STATUS.DRAFT, createdAt: { lte: draftCutoff } },
    select: { id: true, mentorUserId: true, menteeUserId: true, version: true },
    take
  });
  for (const relation of draftCandidates) {
    if (dryRun) { counters.draftRelationsClosed += 1; continue; }
    await db.$transaction(async (tx) => {
      const updated = await tx.mentoringRelation.updateMany({
        where: { id: relation.id, status: MENTORING_RELATION_STATUS.DRAFT, version: relation.version },
        data: {
          status: MENTORING_RELATION_STATUS.CLOSED,
          closedAt: now,
          closeReasonKey: "not_started",
          purgedAt: now,
          version: { increment: 1 }
        }
      });
      if (updated.count !== 1) return;
      counters.draftRelationsClosed += 1;
      await tx.mentoringSummary.deleteMany({
        where: { relationId: relation.id, status: { in: ["DRAFT", "PENDING_CONFIRM"] } }
      });
      await recordMentoringAudit(tx, {
        action: MENTORING_AUDIT_ACTIONS.RELATION_CLOSED,
        relationId: relation.id,
        meta: { reasonKey: "not_started", byTimer: true }
      });
      for (const memberId of [relation.mentorUserId, relation.menteeUserId]) {
        if (!memberId) continue;
        await emit(tx, counters, {
          type: NOTIFICATION_EVENT_TYPES.MENTORING_RELATION_CLOSED,
          userId: memberId,
          sourceId: relation.id,
          targetId: relation.id,
          dedupeSuffix: "closed"
        }, now);
      }
    });
  }

  // 3a) ACTIVE suhe 90p vaikust → inaktiivsuskontroll mõlemale (üks kord).
  const inactivityCutoff = new Date(now.getTime() - MENTORING_LIMITS.INACTIVITY_CHECK_DAYS * DAY_MS);
  const checkCandidates = await db.mentoringRelation.findMany({
    where: {
      status: MENTORING_RELATION_STATUS.ACTIVE,
      inactivityCheckAt: null,
      lastActivityAt: { lte: inactivityCutoff }
    },
    select: { id: true, mentorUserId: true, menteeUserId: true, version: true },
    take
  });
  for (const relation of checkCandidates) {
    if (dryRun) { counters.inactivityChecksSent += 1; continue; }
    await db.$transaction(async (tx) => {
      const updated = await tx.mentoringRelation.updateMany({
        where: { id: relation.id, status: MENTORING_RELATION_STATUS.ACTIVE, inactivityCheckAt: null, version: relation.version },
        data: { inactivityCheckAt: now, version: { increment: 1 } }
      });
      if (updated.count !== 1) return;
      counters.inactivityChecksSent += 1;
      await recordMentoringAudit(tx, {
        action: MENTORING_AUDIT_ACTIONS.INACTIVITY_CHECK_SENT,
        relationId: relation.id
      });
      for (const memberId of [relation.mentorUserId, relation.menteeUserId]) {
        if (!memberId) continue;
        await emit(tx, counters, {
          type: NOTIFICATION_EVENT_TYPES.MENTORING_INACTIVITY_CHECK,
          userId: memberId,
          sourceId: relation.id,
          targetId: relation.id,
          dedupeSuffix: `check:${tallinnDate(now)}`
        }, now);
      }
    });
  }

  // 3b) Vastuseta inaktiivsuskontroll 30p → automaatne CLOSED (inactive).
  const closeCutoff = new Date(now.getTime() - MENTORING_LIMITS.INACTIVITY_CLOSE_DAYS * DAY_MS);
  const closeCandidates = await db.mentoringRelation.findMany({
    where: {
      status: MENTORING_RELATION_STATUS.ACTIVE,
      inactivityCheckAt: { not: null, lte: closeCutoff }
    },
    select: { id: true, mentorUserId: true, menteeUserId: true, version: true },
    take
  });
  for (const relation of closeCandidates) {
    if (dryRun) { counters.inactivityRelationsClosed += 1; continue; }
    await db.$transaction(async (tx) => {
      const updated = await tx.mentoringRelation.updateMany({
        where: {
          id: relation.id,
          status: MENTORING_RELATION_STATUS.ACTIVE,
          inactivityCheckAt: { not: null, lte: closeCutoff },
          version: relation.version
        },
        data: {
          status: MENTORING_RELATION_STATUS.CLOSED,
          closedAt: now,
          closeReasonKey: "inactive",
          goalSummary: null,
          purgedAt: now,
          version: { increment: 1 }
        }
      });
      if (updated.count !== 1) return;
      counters.inactivityRelationsClosed += 1;
      await tx.mentoringSummary.deleteMany({
        where: { relationId: relation.id, status: { in: ["DRAFT", "PENDING_CONFIRM"] } }
      });
      await tx.mentoringMeeting.updateMany({
        where: { relationId: relation.id, topicSummary: { not: null } },
        data: { topicSummary: null }
      });
      await recordMentoringAudit(tx, {
        action: MENTORING_AUDIT_ACTIONS.RELATION_CLOSED,
        relationId: relation.id,
        meta: { reasonKey: "inactive", byTimer: true }
      });
      await recordMentoringAudit(tx, {
        action: MENTORING_AUDIT_ACTIONS.RELATION_PURGED,
        relationId: relation.id,
        meta: { byTimer: true }
      });
      for (const memberId of [relation.mentorUserId, relation.menteeUserId]) {
        if (!memberId) continue;
        await emit(tx, counters, {
          type: NOTIFICATION_EVENT_TYPES.MENTORING_RELATION_CLOSED,
          userId: memberId,
          sourceId: relation.id,
          targetId: relation.id,
          dedupeSuffix: "closed"
        }, now);
      }
    });
  }

  // 4) Lähenev kohtumine (48h aknas) → teavitus mõlemale; dedupe kuupäevaga.
  const upcomingUntil = new Date(now.getTime() + MENTORING_LIMITS.MEETING_UPCOMING_HOURS * HOUR_MS);
  let meetingCursor = null;
  while (true) {
    const upcomingMeetings = await db.mentoringMeeting.findMany({
      where: {
        status: MENTORING_MEETING_STATUS.PLANNED,
        occurredAt: { gte: now, lte: upcomingUntil },
        ...(meetingCursor ? {
          AND: [{ OR: [
            { occurredAt: { gt: meetingCursor.occurredAt } },
            { occurredAt: meetingCursor.occurredAt, id: { gt: meetingCursor.id } }
          ] }]
        } : {})
      },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        occurredAt: true,
        relationId: true,
        relation: { select: { mentorUserId: true, menteeUserId: true, status: true } }
      },
      take
    });
    if (!upcomingMeetings.length) break;
    for (const meeting of upcomingMeetings) {
      if (meeting.relation?.status !== MENTORING_RELATION_STATUS.ACTIVE) continue;
      if (dryRun) { counters.meetingsUpcoming += 1; continue; }
      let created = false;
      for (const memberId of [meeting.relation.mentorUserId, meeting.relation.menteeUserId]) {
        if (!memberId) continue;
        const notification = await emit(db, counters, {
          type: NOTIFICATION_EVENT_TYPES.MENTORING_MEETING_UPCOMING,
          userId: memberId,
          sourceId: meeting.id,
          targetId: meeting.relationId,
          dedupeSuffix: `upcoming:${meeting.occurredAt.toISOString()}`,
          emailPolicy: "OPTIONAL"
        }, now);
        created ||= notification.created;
      }
      if (created) counters.meetingsUpcoming += 1;
    }
    const last = upcomingMeetings.at(-1);
    meetingCursor = { occurredAt: last.occurredAt, id: last.id };
    if (upcomingMeetings.length < take) break;
  }

  // 5) EM2 message-anonümiseerimine 90p pärast terminaalset olekut — vabateksti
  //    ei hoita igavesti (ptk 7.5).
  const anonymizeCutoff = new Date(now.getTime() - MENTORING_LIMITS.MESSAGE_ANONYMIZE_DAYS * DAY_MS);
  const anonymizeCandidates = await db.mentoringRequest.findMany({
    where: {
      status: {
        in: [
          MENTORING_REQUEST_STATUS.ACCEPTED,
          MENTORING_REQUEST_STATUS.DECLINED,
          MENTORING_REQUEST_STATUS.EXPIRED,
          MENTORING_REQUEST_STATUS.CANCELLED
        ]
      },
      anonymizedAt: null,
      message: { not: null },
      updatedAt: { lte: anonymizeCutoff }
    },
    select: { id: true },
    take
  });
  for (const request of anonymizeCandidates) {
    if (dryRun) { counters.messagesAnonymized += 1; continue; }
    await db.$transaction(async (tx) => {
      const updated = await tx.mentoringRequest.updateMany({
        where: { id: request.id, anonymizedAt: null },
        data: { message: null, anonymizedAt: now }
      });
      if (updated.count !== 1) return;
      counters.messagesAnonymized += 1;
      await recordMentoringAudit(tx, {
        action: MENTORING_AUDIT_ACTIONS.REQUEST_ANONYMIZED,
        requestId: request.id
      });
    });
  }

  return counters;
}
