/**
 * FIELD-V1 (T24) shared constants. Imported by the server service, the
 * client sync layer and tests — this module must stay dependency-free.
 *
 * Visit statuses, item states and provenance values are application-level
 * constants (K1 rule: no PostgreSQL enums for lifecycle state).
 */

export const FIELD_VISIT_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  PLANNED: "PLANNED",
  IN_PROGRESS: "IN_PROGRESS",
  WRAP_UP: "WRAP_UP",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED"
});

export const FIELD_VISIT_STATUSES = Object.freeze(Object.values(FIELD_VISIT_STATUS));

/** Allowed status transitions — a jump outside the map is a 409, never silent. */
export const FIELD_VISIT_TRANSITIONS = Object.freeze({
  DRAFT: Object.freeze(["PLANNED", "CANCELLED"]),
  PLANNED: Object.freeze(["IN_PROGRESS", "WRAP_UP", "CANCELLED"]),
  IN_PROGRESS: Object.freeze(["WRAP_UP", "CANCELLED"]),
  WRAP_UP: Object.freeze(["IN_PROGRESS", "CLOSED", "CANCELLED"]),
  CLOSED: Object.freeze([]),
  CANCELLED: Object.freeze([])
});

/** K1 lifecycle mapping (doc ptk 3.4). */
export const FIELD_VISIT_K1_LIFECYCLE = Object.freeze({
  DRAFT: "DRAFT",
  PLANNED: "ACTIVE",
  IN_PROGRESS: "ACTIVE",
  WRAP_UP: "ACTIVE",
  CLOSED: "CLOSED",
  CANCELLED: "CLOSED"
});

export const FIELD_VISIT_K1_PHASE = Object.freeze({
  PLANNED: Object.freeze({ stage: 1, key: "prep", labelKey: "field.phase.prep" }),
  IN_PROGRESS: Object.freeze({ stage: 2, key: "on_site", labelKey: "field.phase.on_site" }),
  WRAP_UP: Object.freeze({ stage: 3, key: "follow_up", labelKey: "field.phase.follow_up" })
});

/**
 * The nine local item states (doc ptk 3.2). The device store is the state
 * owner; the server only ever sees QUEUED→UPLOADING traffic.
 */
export const FIELD_ITEM_STATE = Object.freeze({
  DEVICE_ONLY: "DEVICE_ONLY",
  QUEUED: "QUEUED",
  UPLOADING: "UPLOADING",
  SYNCED: "SYNCED",
  CONFLICT: "CONFLICT",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  PURGE_PENDING: "PURGE_PENDING",
  REMOVED: "REMOVED"
});

export const FIELD_ITEM_STATES = Object.freeze(Object.values(FIELD_ITEM_STATE));

/**
 * K2 provenance dictionary — the SAME eight values as CASEWORK-A0 ptk 2.3.
 * If lib/workspaces/provenance.js lands later (CASEWORK-P0) the values must
 * stay identical; the coordinator merges the two modules into one.
 */
export const FIELD_PROVENANCE = Object.freeze({
  KLIENDI_OELDUD: "KLIENDI_OELDUD",
  KLIENDI_KINNITATUD: "KLIENDI_KINNITATUD",
  DOKUMENDIST: "DOKUMENDIST",
  TEISE_SPETSIALISTI_INFO: "TEISE_SPETSIALISTI_INFO",
  TOOTAJA_TAHELEPANEK: "TOOTAJA_TAHELEPANEK",
  TOOTAJA_TOLGENDUS: "TOOTAJA_TOLGENDUS",
  AI_MUSTAND: "AI_MUSTAND",
  AMETLIKULT_KONTROLLITUD: "AMETLIKULT_KONTROLLITUD"
});

export const FIELD_PROVENANCES = Object.freeze(Object.values(FIELD_PROVENANCE));

export const FIELD_NOTE_KIND = Object.freeze({
  NOTE: "note",
  CHECKLIST: "checklist",
  CONSENT: "consent"
});

export const FIELD_NOTE_KINDS = Object.freeze(Object.values(FIELD_NOTE_KIND));

export const FIELD_ATTACHMENT_ROLE = Object.freeze({
  PHOTO: "photo",
  AUDIO: "audio"
});

export const FIELD_ATTACHMENT_ROLES = Object.freeze(Object.values(FIELD_ATTACHMENT_ROLE));

export const FIELD_CONSENT_KIND = Object.freeze({
  AUDIO: "audio",
  PHOTO: "photo"
});

export const FIELD_CONSENT_KINDS = Object.freeze(Object.values(FIELD_CONSENT_KIND));

/** Sync retry policy (doc ptk 3.3): max 5 automatic attempts, 5s → 5min. */
export const FIELD_SYNC_MAX_AUTO_ATTEMPTS = 5;
export const FIELD_SYNC_BACKOFF_BASE_MS = 5_000;
export const FIELD_SYNC_BACKOFF_MAX_MS = 5 * 60_000;

/** O-FD-1 / doc 4.5 local retention (all in milliseconds). */
export const FIELD_LOCAL_RETENTION = Object.freeze({
  /** Synced local copies purge 7 days after handover/close. */
  SYNCED_COPY_MS: 7 * 24 * 60 * 60 * 1000,
  /** Unsent content warns from day 30 … */
  UNSENT_WARN_MS: 30 * 24 * 60 * 60 * 1000,
  /** … and is deleted on day 37 after three explicit warnings. */
  UNSENT_DELETE_MS: 37 * 24 * 60 * 60 * 1000,
  /** Visit pack expires 72h after the planned window ends … */
  PACK_AFTER_PLANNED_MS: 72 * 60 * 60 * 1000,
  /** … or 7 days after creation when the visit never left DRAFT. */
  PACK_DRAFT_MS: 7 * 24 * 60 * 60 * 1000
});

/** O-FD-1 server retention (days). */
export const FIELD_SERVER_RETENTION_DAYS = Object.freeze({
  VISIT_AFTER_END: 90,
  RAW_AUDIO: 7,
  PHOTO: 90
});

/** Safety check-in (O-FD-3): reminder window and escalation grace/backoff. */
export const FIELD_SAFETY = Object.freeze({
  REMINDER_BEFORE_MS: 30 * 60_000,
  GRACE_MS: 15 * 60_000,
  MAX_ESCALATION_ATTEMPTS: 3,
  ESCALATION_BACKOFF_MS: 5 * 60_000,
  STATUS_SENT: "SENT",
  STATUS_FAILED: "FAILED"
});

export function isFieldVisitStatus(value) {
  return typeof value === "string" && Object.hasOwn(FIELD_VISIT_TRANSITIONS, value);
}

export function canTransitionFieldVisit(from, to) {
  return isFieldVisitStatus(from) && FIELD_VISIT_TRANSITIONS[from].includes(to);
}

export function isFieldProvenance(value) {
  return FIELD_PROVENANCES.includes(value);
}

export function isFieldNoteKind(value) {
  return FIELD_NOTE_KINDS.includes(value);
}

export function isFieldAttachmentRole(value) {
  return FIELD_ATTACHMENT_ROLES.includes(value);
}

export function isFieldItemState(value) {
  return FIELD_ITEM_STATES.includes(value);
}
