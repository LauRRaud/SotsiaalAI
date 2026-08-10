/**
 * FIELD-V1 pure sync state machine (doc ptk 3.2–3.3). No I/O, no browser
 * APIs — the IndexedDB layer (localStore.js) and the React hook feed events
 * in and persist the results, so every transition rule is unit-testable.
 */

import {
  FIELD_ITEM_STATE,
  FIELD_LOCAL_RETENTION,
  FIELD_SYNC_BACKOFF_BASE_MS,
  FIELD_SYNC_BACKOFF_MAX_MS,
  FIELD_SYNC_MAX_AUTO_ATTEMPTS,
  isFieldItemState,
  isFieldVisitClosed
} from "./constants.js";

export const FieldSyncEvent = Object.freeze({
  USER_APPROVED: "USER_APPROVED",
  USER_CANCELLED: "USER_CANCELLED",
  USER_RETRY: "USER_RETRY",
  USER_DELETED: "USER_DELETED",
  USER_EDITED: "USER_EDITED",
  UPLOAD_STARTED: "UPLOAD_STARTED",
  UPLOAD_OK: "UPLOAD_OK",
  UPLOAD_CONFLICT: "UPLOAD_CONFLICT",
  UPLOAD_RETRYABLE_ERROR: "UPLOAD_RETRYABLE_ERROR",
  UPLOAD_PERMANENT_ERROR: "UPLOAD_PERMANENT_ERROR",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  CONFLICT_RESOLVED: "CONFLICT_RESOLVED",
  PURGE_REQUESTED: "PURGE_REQUESTED",
  PURGE_DONE: "PURGE_DONE",
  RECONCILE_FOUND_ON_SERVER: "RECONCILE_FOUND_ON_SERVER",
  RECONCILE_NOT_ON_SERVER: "RECONCILE_NOT_ON_SERVER"
});

const S = FIELD_ITEM_STATE;

/**
 * Transition table: state -> event -> next state (or a function of the item).
 * Anything not listed is an invalid transition and returns null — callers
 * must treat null as "ignore, log a counter", never as a silent overwrite.
 */
const TRANSITIONS = Object.freeze({
  [S.DEVICE_ONLY]: {
    [FieldSyncEvent.USER_APPROVED]: S.QUEUED,
    [FieldSyncEvent.USER_DELETED]: S.REMOVED,
    [FieldSyncEvent.USER_EDITED]: S.DEVICE_ONLY
  },
  [S.QUEUED]: {
    [FieldSyncEvent.UPLOAD_STARTED]: S.UPLOADING,
    [FieldSyncEvent.USER_CANCELLED]: S.CANCELLED,
    [FieldSyncEvent.USER_EDITED]: S.QUEUED,
    [FieldSyncEvent.AUTH_REQUIRED]: S.QUEUED
  },
  [S.UPLOADING]: {
    [FieldSyncEvent.UPLOAD_OK]: S.SYNCED,
    [FieldSyncEvent.UPLOAD_CONFLICT]: S.CONFLICT,
    [FieldSyncEvent.UPLOAD_RETRYABLE_ERROR]: (item) =>
      nextAttemptCount(item) >= FIELD_SYNC_MAX_AUTO_ATTEMPTS ? S.FAILED : S.QUEUED,
    [FieldSyncEvent.UPLOAD_PERMANENT_ERROR]: S.FAILED,
    [FieldSyncEvent.AUTH_REQUIRED]: S.QUEUED,
    // App-restart reconcile: UPLOADING is never trusted (doc 2.2).
    [FieldSyncEvent.RECONCILE_FOUND_ON_SERVER]: S.SYNCED,
    [FieldSyncEvent.RECONCILE_NOT_ON_SERVER]: S.QUEUED
  },
  [S.SYNCED]: {
    [FieldSyncEvent.USER_EDITED]: S.DEVICE_ONLY,
    [FieldSyncEvent.PURGE_REQUESTED]: S.PURGE_PENDING,
    [FieldSyncEvent.USER_DELETED]: S.PURGE_PENDING
  },
  [S.CONFLICT]: {
    [FieldSyncEvent.CONFLICT_RESOLVED]: S.QUEUED,
    [FieldSyncEvent.USER_DELETED]: S.REMOVED
  },
  [S.FAILED]: {
    [FieldSyncEvent.USER_RETRY]: S.QUEUED,
    [FieldSyncEvent.USER_DELETED]: S.REMOVED,
    [FieldSyncEvent.USER_EDITED]: S.DEVICE_ONLY
  },
  [S.CANCELLED]: {
    [FieldSyncEvent.USER_APPROVED]: S.QUEUED,
    [FieldSyncEvent.USER_DELETED]: S.REMOVED
  },
  [S.PURGE_PENDING]: {
    [FieldSyncEvent.PURGE_DONE]: S.REMOVED
  },
  [S.REMOVED]: {}
});

function nextAttemptCount(item) {
  return Number(item?.attempts || 0) + 1;
}

/**
 * Apply an event to an item. Returns a NEW item object with updated state and
 * bookkeeping, or null when the transition is not allowed from this state.
 */
export function applyFieldSyncEvent(item, event, { now = new Date() } = {}) {
  const state = String(item?.state || "");
  if (!isFieldItemState(state)) return null;
  const row = TRANSITIONS[state]?.[event];
  if (row === undefined) return null;
  const nextState = typeof row === "function" ? row(item) : row;
  const next = { ...item, state: nextState, stateChangedAt: now.toISOString() };
  if (event === FieldSyncEvent.UPLOAD_RETRYABLE_ERROR) {
    next.attempts = nextAttemptCount(item);
    next.nextAttemptAt = new Date(now.getTime() + retryBackoffMs(next.attempts)).toISOString();
  }
  if (event === FieldSyncEvent.UPLOAD_OK || event === FieldSyncEvent.RECONCILE_FOUND_ON_SERVER) {
    next.attempts = 0;
    next.nextAttemptAt = null;
    next.lastError = null;
    next.syncedAt = now.toISOString();
  }
  if (event === FieldSyncEvent.USER_RETRY || event === FieldSyncEvent.CONFLICT_RESOLVED) {
    next.attempts = 0;
    next.nextAttemptAt = null;
  }
  if (event === FieldSyncEvent.USER_EDITED) {
    next.revision = Number(item?.revision || 1) + (state === S.SYNCED ? 1 : 0);
    next.editedAt = now.toISOString();
  }
  if (event === FieldSyncEvent.AUTH_REQUIRED) {
    next.needsLogin = true;
  }
  if (event === FieldSyncEvent.UPLOAD_STARTED) {
    next.needsLogin = false;
    next.uploadStartedAt = now.toISOString();
  }
  return next;
}

/** Exponential backoff 5s → 5min, capped (doc ptk 3.3). */
export function retryBackoffMs(attempts) {
  const n = Math.max(1, Number(attempts) || 1);
  return Math.min(FIELD_SYNC_BACKOFF_BASE_MS * 2 ** (n - 1), FIELD_SYNC_BACKOFF_MAX_MS);
}

/** True when the engine may auto-pick this item for upload right now. */
export function isUploadDue(item, now = new Date()) {
  if (String(item?.state) !== S.QUEUED) return false;
  if (item?.needsLogin) return false;
  if (!item?.nextAttemptAt) return true;
  return new Date(item.nextAttemptAt).getTime() <= now.getTime();
}

/**
 * Millal peaks mootor ISE uuesti ärkama? (SOL-FIELD-06)
 *
 * `isUploadDue()` vastab küsimusele „kas TOHIB praegu", aga keegi ei küsinud
 * teda enam pärast tähtaja saabumist: `runSync()` käis ainult mount'il, brauseri
 * `online` sündmusel ja kasutaja enda vajutusel. Lubatud 5 s → 5 min backoff oli
 * seega olemas ainult arvutusena — ühtki automaatset kordust ta ei käivitanud.
 *
 * @returns varaseim tähtaeg (ms epoch) või `null`, kui ootel ei ole midagi.
 *   `QUEUED` kirje ilma tähtajata on kohe küps ja annab `now`.
 */
export function nextFieldSyncWakeup(items, now = new Date()) {
  let earliest = null;
  for (const item of items || []) {
    if (String(item?.state) !== S.QUEUED) continue;
    if (item?.needsLogin) continue;
    const at = item?.nextAttemptAt ? new Date(item.nextAttemptAt).getTime() : now.getTime();
    if (!Number.isFinite(at)) continue;
    if (earliest === null || at < earliest) earliest = at;
  }
  return earliest;
}

export const FieldPurgeDecision = Object.freeze({
  KEEP: "KEEP",
  WARN: "WARN",
  PURGE: "PURGE"
});

/**
 * Local retention decision for one item (doc 4.5 / O-FD-1).
 * - SYNCED/PURGE_PENDING copies purge 7 days after sync.
 * - Unsent content (DEVICE_ONLY/QUEUED/FAILED/CANCELLED/CONFLICT) is NEVER
 *   purged silently: WARN from day 30, delete on day 37 only when at least
 *   three warnings were ACKNOWLEDGED and the user confirmed the deletion.
 *
 * SOL-FIELD-01 — MIS SIIN MUUTUS JA MIKS.
 *
 * `warnCount` LOEB KINNITATUD HOIATUSI, mitte taustakäike. Varem kasvatas teda
 * kord ööpäevas jooksev retention-käik ja mitte ükski komponent ei kuvanud teda:
 * „kolm hoiatust" tähendas päriselt „rakendus avati kolmel eri päeval". Saatmata
 * märge võis nii kaduda inimeselt, kes ei näinud ühtegi hoiatust.
 *
 * `purgeConfirmedAt` on VIIMANE EKSPLITSIITNE KINNITUS. Kolm nähtud hoiatust
 * ütlevad „ma tean, et see kaob"; kinnitus ütleb „kustuta". Ilma selleta jääb
 * otsus igavesti `WARN`-i — vaikimisi ALLES, mitte vaikimisi kustutatud.
 */
export function fieldItemPurgeDecision(item, now = new Date()) {
  const state = String(item?.state || "");
  const t = now.getTime();
  if (state === S.REMOVED) return FieldPurgeDecision.KEEP;
  if (state === S.PURGE_PENDING) return FieldPurgeDecision.PURGE;
  const created = new Date(item?.createdAt || item?.deviceCreatedAt || 0).getTime();
  if (state === S.SYNCED) {
    const since = new Date(item?.syncedAt || item?.stateChangedAt || 0).getTime();
    return since && t - since >= FIELD_LOCAL_RETENTION.SYNCED_COPY_MS
      ? FieldPurgeDecision.PURGE
      : FieldPurgeDecision.KEEP;
  }
  if (!created) return FieldPurgeDecision.KEEP;
  const age = t - created;
  if (
    age >= FIELD_LOCAL_RETENTION.UNSENT_DELETE_MS &&
    Number(item?.warnCount || 0) >= FIELD_UNSENT_WARNINGS_REQUIRED &&
    item?.purgeConfirmedAt
  ) {
    return FieldPurgeDecision.PURGE;
  }
  if (age >= FIELD_LOCAL_RETENTION.UNSENT_WARN_MS) return FieldPurgeDecision.WARN;
  return FieldPurgeDecision.KEEP;
}

/** Leping ütleb KOLM hoiatust — arv elab ühes kohas, mitte kolmes võrdluses. */
export const FIELD_UNSENT_WARNINGS_REQUIRED = 3;

/** Kaks kinnitatud hoiatust ei tohi mahtuda samasse päeva. */
const WARNING_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Kas SEE kirje vajab kasutajale NÄHTAVAT hoiatust just praegu?
 *
 * Kolm tingimust: sisu on hoiatuse-eas, kolme hoiatust ei ole veel kinnitatud,
 * ja eelmisest kinnitatud hoiatusest on möödas vähemalt ööpäev. Viimane on
 * lepingu mõte, mitte mugavus: kolm nuppuvajutust ühe minuti jooksul ei ole
 * kolm hoiatust.
 */
export function fieldWarningDue(item, now = new Date()) {
  if (fieldItemPurgeDecision(item, now) !== FieldPurgeDecision.WARN) return false;
  if (Number(item?.warnCount || 0) >= FIELD_UNSENT_WARNINGS_REQUIRED) return false;
  const lastWarnAt = item?.lastWarnAt ? new Date(item.lastWarnAt).getTime() : 0;
  if (!lastWarnAt) return true;
  return now.getTime() - lastWarnAt >= WARNING_COOLDOWN_MS;
}

/**
 * Kas kirje ootab VIIMAST kinnitust? Kolm hoiatust on nähtud, 37 päeva täis,
 * aga keegi ei ole veel öelnud „kustuta".
 */
export function fieldPurgeAwaitingConfirmation(item, now = new Date()) {
  if (fieldItemPurgeDecision(item, now) !== FieldPurgeDecision.WARN) return false;
  if (item?.purgeConfirmedAt) return false;
  const created = new Date(item?.createdAt || item?.deviceCreatedAt || 0).getTime();
  if (!created) return false;
  return (
    now.getTime() - created >= FIELD_LOCAL_RETENTION.UNSENT_DELETE_MS &&
    Number(item?.warnCount || 0) >= FIELD_UNSENT_WARNINGS_REQUIRED
  );
}

/**
 * Külastuspaketi säilitus (doc 4.5, SOL-FIELD-02).
 *
 * Leping annab KOLM tähtaega ja nad on JÄRJEKORRAS, mitte valikus:
 *   1. külastuse sulgemisel — pakett kaob KOHE;
 *   2. hiljemalt 72 h pärast planeeritud ajaakent;
 *   3. 7 p pärast seadmesse võtmist, kui planeeritud akent ei olegi (DRAFT).
 *
 * „HILJEMALT" ON ÜLEMPIIR, MITTE SOOVITUS. Seepärast kehtib punkt 2 ka siis, kui
 * külastus on IN_PROGRESS või WRAP_UP: just lõpetamata jäänud külastus on see,
 * mis paketi muidu igaveseks brauserisse jätaks — ja täpselt see oli leid.
 * Kaotus on taastatav (online „Võta seadmesse" uuesti), säilimine ei ole.
 *
 * `status` on paketi kirjel PEALMINE väli, mitte krüptitud sisu sees: säilituskäik
 * peab saama otsustada ilma iga paketti lahti krüptimata. Vanadel kirjetel teda ei
 * ole — nemad käivad punktide 2 ja 3 järgi, mis on endiselt õige ülempiir.
 */
export function fieldPackPurgeDue(pack, now = new Date()) {
  const t = now.getTime();
  if (isFieldVisitClosed(pack?.status)) return true;
  const plannedEnd = pack?.plannedEndAt ? new Date(pack.plannedEndAt).getTime() : 0;
  if (plannedEnd) return t - plannedEnd >= FIELD_LOCAL_RETENTION.PACK_AFTER_PLANNED_MS;
  const takenAt = pack?.takenAt ? new Date(pack.takenAt).getTime() : 0;
  if (!takenAt) return false;
  return t - takenAt >= FIELD_LOCAL_RETENTION.PACK_DRAFT_MS;
}

export const fieldSyncMachineInternals = Object.freeze({ TRANSITIONS, nextAttemptCount });
