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
  isFieldItemState
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
 *   three warnings were shown (warnCount ≥ 3).
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
  if (age >= FIELD_LOCAL_RETENTION.UNSENT_DELETE_MS && Number(item?.warnCount || 0) >= 3) {
    return FieldPurgeDecision.PURGE;
  }
  if (age >= FIELD_LOCAL_RETENTION.UNSENT_WARN_MS) return FieldPurgeDecision.WARN;
  return FieldPurgeDecision.KEEP;
}

/** Visit-pack retention (doc 4.5): 72h after planned window / 7d for drafts. */
export function fieldPackPurgeDue(pack, now = new Date()) {
  const t = now.getTime();
  const plannedEnd = pack?.plannedEndAt ? new Date(pack.plannedEndAt).getTime() : 0;
  if (plannedEnd) return t - plannedEnd >= FIELD_LOCAL_RETENTION.PACK_AFTER_PLANNED_MS;
  const takenAt = pack?.takenAt ? new Date(pack.takenAt).getTime() : 0;
  if (!takenAt) return false;
  return t - takenAt >= FIELD_LOCAL_RETENTION.PACK_DRAFT_MS;
}

export const fieldSyncMachineInternals = Object.freeze({ TRANSITIONS, nextAttemptCount });
