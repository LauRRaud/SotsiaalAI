/**
 * Canonical casework dictionaries (CASEWORK-P0 / analüüsidoc ptk 2). These are
 * application-level constants — deliberately NOT PostgreSQL enums (K1 rule:
 * lifecycle, provenance and carrier state live in the app layer, never as a DB
 * enum).
 *
 * This module is the SINGLE source of the eight provenance values.
 * `lib/field/constants.js` re-exports `FIELD_PROVENANCE` from here so FIELD
 * (T24) and casework never carry two dictionaries — the string values stay
 * byte-identical to what FIELD already stores in production. Do NOT rename a
 * value: existing field rows carry these exact strings.
 *
 * Dependency-free: no prisma, no server-only, no descriptor/registry import.
 * Safe to import from both server and client bundles.
 */

/**
 * K2 provenance dictionary (doc ptk 2.3). A row-level origin marker: every
 * meaningful line of a meeting note / draft carries where it came from. The
 * marker never "heals" automatically (AI_MUSTAND → KLIENDI_KINNITATUD needs a
 * human action). ASCII-folded keys match the values already in production.
 */
export const PROVENANCE = Object.freeze({
  KLIENDI_OELDUD: "KLIENDI_OELDUD",
  KLIENDI_KINNITATUD: "KLIENDI_KINNITATUD",
  DOKUMENDIST: "DOKUMENDIST",
  TEISE_SPETSIALISTI_INFO: "TEISE_SPETSIALISTI_INFO",
  TOOTAJA_TAHELEPANEK: "TOOTAJA_TAHELEPANEK",
  TOOTAJA_TOLGENDUS: "TOOTAJA_TOLGENDUS",
  AI_MUSTAND: "AI_MUSTAND",
  AMETLIKULT_KONTROLLITUD: "AMETLIKULT_KONTROLLITUD"
});

export const PROVENANCES = Object.freeze(Object.values(PROVENANCE));

export function isProvenance(value) {
  return typeof value === "string" && PROVENANCES.includes(value);
}

/**
 * i18n label key for a provenance value (doc 2.3 rule 5: the dictionary is
 * i18n-keyed, never rendered from DB text). Returns null for an unknown value.
 */
export function provenanceLabelKey(value) {
  return isProvenance(value) ? `casework.provenance.${value}` : null;
}

/**
 * Carrier class (doc ptk 2.1). Three classes on casework objects:
 *   1 — work draft: purgeable, non-exportable, no evidentiary value; lives in JTA.
 *   2 — confirmed summary: frozen, versioned, audit trail; shareable as a frozen
 *       copy; still NOT a procedural document.
 *   3 — official carrier: STAR2 record / agency DMS; NEVER created on the platform.
 * @typedef {1|2|3} CarrierClass
 */
export const CARRIER_CLASS = Object.freeze({
  WORK_DRAFT: 1,
  CONFIRMED_SUMMARY: 2,
  OFFICIAL_CARRIER: 3
});

export const CARRIER_CLASSES = Object.freeze(Object.values(CARRIER_CLASS));

export function isCarrierClass(value) {
  return CARRIER_CLASSES.includes(value);
}

export function carrierClassLabelKey(value) {
  return isCarrierClass(value) ? `casework.carrier_class.${value}` : null;
}

/**
 * Maps an AgentArtifact status to a carrier class (doc ptk 2.1 / R2):
 * DRAFT → 1 (work draft), FINAL → 2 (confirmed summary). Class 3 never arises
 * from a platform artifact — an official carrier is off-platform by definition.
 * Returns null for an unknown status.
 */
export function carrierClassForArtifactStatus(status) {
  if (status === "DRAFT") return CARRIER_CLASS.WORK_DRAFT;
  if (status === "FINAL") return CARRIER_CLASS.CONFIRMED_SUMMARY;
  return null;
}

/**
 * A confirmed summary (class 2) is shareable as a frozen copy; a work draft
 * (class 1) is not. Encodes the R2 / 2.1 sharing rule in one place.
 */
export function isShareableCarrierClass(value) {
  return value === CARRIER_CLASS.CONFIRMED_SUMMARY;
}

/**
 * STAR2 transfer-state road (doc ptk 2.2). The casework PROFILE of the K1 4.7
 * artifact lifecycle expressed as a dictionary — CASEWORK-P0 persists nothing,
 * it only defines the vocabulary and the legal transitions. Invariants:
 * transitions are conscious user decisions (never timers); ULE_KANTUD is
 * write-protected + starts a retention clock (O-CW-2); EI_KANTA is a conscious
 * end, not "stalled".
 */
export const STAR2_TRANSFER_STATE = Object.freeze({
  MUSTAND: "MUSTAND",
  VAJAB_KONTROLLI: "VAJAB_KONTROLLI",
  KONTROLLITUD: "KONTROLLITUD",
  VALMIS_ULEKANDEKS: "VALMIS_ULEKANDEKS",
  ULE_KANTUD: "ULE_KANTUD",
  EI_KANTA: "EI_KANTA"
});

export const STAR2_TRANSFER_STATES = Object.freeze(Object.values(STAR2_TRANSFER_STATE));

/**
 * Sub-kinds of VAJAB_KONTROLLI (doc ptk 2.2): the review happens with the
 * client, or against a document / registry query.
 */
export const STAR2_REVIEW_KIND = Object.freeze({
  KLIENDIGA: "KLIENDIGA",
  DOKUMENDIGA: "DOKUMENDIGA"
});

export const STAR2_REVIEW_KINDS = Object.freeze(Object.values(STAR2_REVIEW_KIND));

/**
 * Legal transitions. A jump outside the map is illegal (would be a 409 once the
 * state is persisted in P2). ULE_KANTUD and EI_KANTA are terminal.
 */
export const STAR2_TRANSFER_TRANSITIONS = Object.freeze({
  MUSTAND: Object.freeze(["VAJAB_KONTROLLI", "EI_KANTA"]),
  VAJAB_KONTROLLI: Object.freeze(["KONTROLLITUD", "EI_KANTA"]),
  KONTROLLITUD: Object.freeze(["VALMIS_ULEKANDEKS", "EI_KANTA"]),
  VALMIS_ULEKANDEKS: Object.freeze(["ULE_KANTUD", "EI_KANTA"]),
  ULE_KANTUD: Object.freeze([]),
  EI_KANTA: Object.freeze([])
});

export function isStar2TransferState(value) {
  return typeof value === "string" && Object.hasOwn(STAR2_TRANSFER_TRANSITIONS, value);
}

export function isStar2ReviewKind(value) {
  return typeof value === "string" && STAR2_REVIEW_KINDS.includes(value);
}

export function canTransitionStar2(from, to) {
  return isStar2TransferState(from) && STAR2_TRANSFER_TRANSITIONS[from].includes(to);
}

/** A terminal state has no outgoing transition (2.2 write-protect / conscious end). */
export function isStar2Terminal(value) {
  return isStar2TransferState(value) && STAR2_TRANSFER_TRANSITIONS[value].length === 0;
}

export function star2TransferStateLabelKey(value) {
  return isStar2TransferState(value) ? `casework.star2.${value}` : null;
}
