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
