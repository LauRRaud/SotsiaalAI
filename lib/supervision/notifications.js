import { NOTIFICATION_EVENT_TYPES } from "../notifications.js";
import { emitSupervisionNotification } from "./shared.js";

/**
 * Supervisiooni U1 teavitused (Q2.8). Iga emitter kutsutakse äritehingu SEEST
 * (tx) ja loob NotificationEvent'i, mis kannab AINULT fakti + viite (type +
 * sourceId + targetId), MITTE sisu (test #15). sourceType/targetKind tulevad
 * registri spec'ist (lib/notifications.js EVENT_SPECS). dedupeKey =
 * type:sourceId:userId:dedupeSuffix — teeb korduse idempotentseks.
 *
 * `supervision_prep_waiting` EI ole siin: see on teadlikult AINULT
 * continuity-allikas (Q2.8), mitte push-teavitus (restoratiivne, mitte survestav).
 */

/** Kutse loodud (rida 10) → kutsutu. */
export async function notifyInvite(tx, { participationId, processId, userId }, ctx = {}) {
  return emitSupervisionNotification(tx, {
    type: NOTIFICATION_EVENT_TYPES.SUPERVISION_INVITE,
    userId,
    sourceId: participationId,
    targetId: processId,
    dedupeSuffix: "v1"
  }, ctx);
}

/** Uue kontraktiversiooni aktiveerimine (rida 9) → ACCEPTED, kel kinnitus puudu. */
export async function notifyContractPending(tx, { participationId, processId, userId, versionId }, ctx = {}) {
  return emitSupervisionNotification(tx, {
    type: NOTIFICATION_EVENT_TYPES.SUPERVISION_CONTRACT_PENDING,
    userId,
    sourceId: participationId,
    targetId: processId,
    // versioonipõhine dedupe: iga uus versioon annab uue kirje.
    dedupeSuffix: versionId
  }, ctx);
}

/** Läheneva kohtumise meeldetuletus (olemasolev tähtaja-kategooria) → liige. */
export async function notifyMeetingUpcoming(tx, { meetingId, processId, userId }, ctx = {}) {
  return emitSupervisionNotification(tx, {
    type: NOTIFICATION_EVENT_TYPES.SUPERVISION_MEETING_UPCOMING,
    userId,
    sourceId: meetingId,
    targetId: processId,
    dedupeSuffix: "v1"
  }, ctx);
}

/** Kokkuvõtte submit (rida 22) → ACCEPTED, kelle kinnitus puudu. */
export async function notifySummaryPending(tx, { summaryId, processId, userId, participationId }, ctx = {}) {
  return emitSupervisionNotification(tx, {
    type: NOTIFICATION_EVENT_TYPES.SUPERVISION_SUMMARY_PENDING,
    userId,
    sourceId: summaryId,
    targetId: processId,
    dedupeSuffix: participationId
  }, ctx);
}

/** Sulgemistehing (rida 25) → kõik liikmed. */
export async function notifyClosed(tx, { processId, userId }, ctx = {}) {
  return emitSupervisionNotification(tx, {
    type: NOTIFICATION_EVENT_TYPES.SUPERVISION_CLOSED,
    userId,
    sourceId: processId,
    targetId: processId,
    dedupeSuffix: "v1"
  }, ctx);
}

function continuityIso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

/**
 * U2 „Jätka siit" supervisiooni-allikas (Q2.8). Tagastab KUNI 2 kirjet kasutaja
 * kohta (kinnitamata kontrakt/kokkuvõte ees, ettevalmistus tagapool), et mitte
 * ummistada 7-kirje limiiti. `supervision_prep_waiting` on AINULT siin (mitte
 * NotificationEvent) — restoratiivne kontekst, mitte survestav teavitus.
 * Kirjed kannavad viidet + labelKey'd, MITTE sisu.
 */
export async function buildSupervisionContinuity(db, userId) {
  const uid = String(userId || "").trim();
  if (!uid) return [];
  // Kaitse: kui db-l pole supervisiooni-mudeleid (nt kitsas continuity-fake),
  // ei lisa supervisioon midagi — koostur töötab edasi muutumatult.
  if (typeof db?.supervisionParticipation?.findMany !== "function") return [];
  const items = [];
  const enc = (value) => encodeURIComponent(String(value));

  // Kutsed (INVITED) — kõrgeim.
  const invites = await db.supervisionParticipation.findMany({
    where: { userId: uid, status: "INVITED" },
    select: { id: true, processId: true, updatedAt: true },
    orderBy: [{ updatedAt: "desc" }], take: 5
  });
  for (const inv of invites) {
    items.push({
      kind: "supervision", id: `inv:${inv.processId}`,
      href: `/supervisioon/${enc(inv.processId)}`,
      labelKey: "workspace_continuity.supervision_invite",
      date: continuityIso(inv.updatedAt), priority: 0
    });
  }

  const accepted = await db.supervisionParticipation.findMany({
    where: { userId: uid, status: "ACCEPTED" },
    select: { id: true, processId: true, updatedAt: true }, take: 20
  });
  for (const participation of accepted) {
    const process = await db.supervisionProcess.findUnique({
      where: { id: participation.processId },
      select: { id: true, status: true, activeContractVersionId: true }
    });
    if (!process || process.status !== "ACTIVE") continue;

    // Kinnitamata aktiivne kontraktiversioon (OS†).
    if (process.activeContractVersionId) {
      const acceptance = await db.supervisionContractAcceptance.findFirst({
        where: { participationId: participation.id, contractVersionId: process.activeContractVersionId },
        select: { id: true }
      });
      if (!acceptance) {
        items.push({
          kind: "supervision", id: `ctr:${process.id}`,
          href: `/supervisioon/${enc(process.id)}?ala=kontrakt`,
          labelKey: "workspace_continuity.supervision_contract_pending",
          date: continuityIso(participation.updatedAt), priority: 0
        });
      }
    }

    // Ootel kokkuvõtted, mille kasutaja pole kinnitanud.
    const pendingSummaries = await db.supervisionSummary.findMany({
      where: { processId: participation.processId, status: "PENDING_APPROVAL" },
      select: { id: true, processId: true, updatedAt: true }, take: 5
    });
    for (const summary of pendingSummaries) {
      const approved = await db.supervisionSummaryApproval.findFirst({
        where: { summaryId: summary.id, participationId: participation.id }, select: { id: true }
      });
      if (!approved) {
        items.push({
          kind: "supervision", id: `sum:${summary.id}`,
          href: `/supervisioon/${enc(summary.processId)}?ala=kokkuvotted&summary=${enc(summary.id)}`,
          labelKey: "workspace_continuity.supervision_summary_pending",
          date: continuityIso(summary.updatedAt), priority: 1
        });
      }
    }

    // Ettevalmistus: järgmine PLANNED kohtumine olemas JA 0 jagatud teemat.
    const nextMeeting = await db.supervisionMeeting.findFirst({
      where: { processId: participation.processId, status: "PLANNED" },
      select: { id: true, plannedAt: true }, orderBy: [{ seq: "asc" }]
    });
    if (nextMeeting) {
      const myTopics = await db.supervisionSharedTopic.count({
        where: { processId: participation.processId, authorParticipationId: participation.id, status: "SHARED" }
      });
      if (myTopics === 0) {
        items.push({
          kind: "supervision", id: `prep:${process.id}`,
          href: `/supervisioon/${enc(process.id)}?ala=eeskamber`,
          labelKey: "workspace_continuity.supervision_prep_waiting",
          date: continuityIso(nextMeeting.plannedAt || participation.updatedAt), priority: 2
        });
      }
    }
  }

  items.sort((a, b) => a.priority - b.priority || String(b.date || "").localeCompare(String(a.date || "")));
  return items.slice(0, 2);
}
