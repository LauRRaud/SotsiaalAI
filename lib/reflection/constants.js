/**
 * Meetodipeegli sõnastikud (T21 P3, O-CW-3; analüüsidoc ptk 3.2–3.3).
 * Rakenduskihi konstandid, MITTE PostgreSQL enumid (K1 reegel) — sama muster
 * mis `lib/workspaces/provenance.js`.
 *
 * Sõltuvusvaba: ei prismat, ei server-only'd. Ohutu importida nii serveri- kui
 * klientbundlist.
 */

import { PROVENANCE } from "../workspaces/provenance.js";

/**
 * Vahehindamise tulem (ideed 8.5 sõnastik, doc ptk 3.3 „Järeldus"). Hinnangu-
 * vaba loend: ükski väärtus ei ole skoor ega „õige/vale" — need on kümme ausat
 * olekut selle kohta, kuhu töötaja ise oma valiku hindamisega jõudis.
 */
export const INTERIM_OUTCOME = Object.freeze({
  CONTINUE: "CONTINUE",
  CONTINUE_ADAPTED: "CONTINUE_ADAPTED",
  NEEDS_TIME: "NEEDS_TIME",
  NOT_ASSESSABLE: "NOT_ASSESSABLE",
  CLIENT_DECLINED: "CLIENT_DECLINED",
  EXTERNAL_OBSTACLE: "EXTERNAL_OBSTACLE",
  TRY_DIFFERENT: "TRY_DIFFERENT",
  TAKE_TO_COVISION: "TAKE_TO_COVISION",
  TAKE_TO_SUPERVISION: "TAKE_TO_SUPERVISION",
  TAKE_TO_ETHICS: "TAKE_TO_ETHICS"
});

export const INTERIM_OUTCOMES = Object.freeze(Object.values(INTERIM_OUTCOME));

export function isInterimOutcome(value) {
  return typeof value === "string" && INTERIM_OUTCOMES.includes(value);
}

export function interimOutcomeLabelKey(value) {
  return isInterimOutcome(value) ? `reflection.interim_outcome.${value}` : null;
}

/**
 * Toevajadus (doc ptk 3.3 „Järeldus": kovisioon / supervisioon / eetiline
 * arutelu). Navigatsiooniline suund, MITTE andmeside — „vajan tuge" ei loo
 * ühtegi kirjet teises moodulis (ptk 3.5 Tööheaolu-rida on sama reegel).
 */
export const SUPPORT_NEED = Object.freeze({
  NONE: "NONE",
  COVISION: "COVISION",
  SUPERVISION: "SUPERVISION",
  ETHICS: "ETHICS"
});

export const SUPPORT_NEEDS = Object.freeze(Object.values(SUPPORT_NEED));

export function isSupportNeed(value) {
  return typeof value === "string" && SUPPORT_NEEDS.includes(value);
}

export function supportNeedLabelKey(value) {
  return isSupportNeed(value) ? `reflection.support_need.${value}` : null;
}

/**
 * Allikaviite liigid. V1 lepingus on ainult liik, millel on päris kasutajatee
 * ning üheselt kontrollitav omanik: spetsialistile saabunud eelpöördumine.
 * ARTIFACT/MEETING/CALL ei ole lubatud enne, kui neil on oma tegelik
 * sisenemispunkt ja liikmesusreegel; kliendile lubatud, kuid lahendamatu enum
 * oleks turva- ja tooteleping, mida süsteem ei täida (SOL-REF-02).
 */
export const REFLECTION_SOURCE_KIND = Object.freeze({
  PRE_INQUIRY: "PRE_INQUIRY"
});

export const REFLECTION_SOURCE_KINDS = Object.freeze(Object.values(REFLECTION_SOURCE_KIND));
const REFLECTION_SOURCE_LABEL_KINDS = Object.freeze([
  ...REFLECTION_SOURCE_KINDS,
  "ARTIFACT",
  "MEETING",
  "CALL"
]);

export function isReflectionSourceKind(value) {
  return typeof value === "string" && REFLECTION_SOURCE_KINDS.includes(value);
}

export function reflectionSourceKindLabelKey(value) {
  return typeof value === "string" && REFLECTION_SOURCE_LABEL_KINDS.includes(value)
    ? `reflection.source_kind.${value}`
    : null;
}

/**
 * Välja-tasemel päritolu (doc ptk 3.3 „Vaatlus": päritolumärgistus KOHUSTUSLIK,
 * kliendi-öeldud ≠ töötaja-tähelepanek; ideed 8.3: tähelepanek ≠ tõlgendus).
 * Marker on STRUKTURAALNE: iga vaatlus-/tõlgendusväli kannab fikseeritud
 * päritolu, mida kasutaja ei saa ümber määrata ega väljalt lahutada. Väärtused
 * tulevad jagatud K2 sõnastikust (üks sõnastik, mitte kaks — sama invariant
 * mis FIELD_PROVENANCE konsolideerimisel).
 */
export const REFLECTION_FIELD_PROVENANCE = Object.freeze({
  clientGoal: PROVENANCE.KLIENDI_OELDUD,
  clientReaction: PROVENANCE.KLIENDI_OELDUD,
  workerObservation: PROVENANCE.TOOTAJA_TAHELEPANEK,
  interpretation: PROVENANCE.TOOTAJA_TOLGENDUS
});

/**
 * Kirje vabateksti väljad + pikkuspiirid (sama kaitseklass mis T12 E3
 * pikkuspiiridel: server ei võta vastu piiramatut sisendit). Meetod on
 * vabatekst KUNI O-CW-5 kinnitab kataloogi (doc ptk 3.2).
 */
export const REFLECTION_TEXT_FIELDS = Object.freeze([
  "approach",
  "method",
  "action",
  "supportTechnique",
  "choiceReason",
  "methodCatalogRef",
  "clientGoal",
  "clientReaction",
  "workerObservation",
  "interpretation",
  "whatWorked",
  "whatDidNot",
  "nextStep"
]);

export const REFLECTION_TEXT_MAX_LENGTH = 4000;
