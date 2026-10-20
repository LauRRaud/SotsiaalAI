/**
 * Kiirkontrolli küsimused ja vastusevariandid.
 *
 * Võtmed ja väärtused on serveri lepingu osa (`lib/wellbeing/quickCheck.js`,
 * `lib/wellbeing/fieldSchemas.js`): neid siin ei muudeta. Kolm rühma vastavad
 * sammudele (nõudmised, ressursid, tugi ja tähendus); märkeruudud on kaks
 * viimast sammu (turvalisus, riskid ja toe vajadus).
 */

const options = (pairs) => pairs.map(([value, label]) => ({ value, label }));

const SUPPORT_OPTIONS = options([["available", "Kättesaadav"], ["partial", "Osaline"], ["unclear", "Ebaselge"], ["not_available", "Pole kättesaadav"]]);

export const QUICK_CHECK_GROUPS = Object.freeze({
  demands: [
    { key: "workloadLevel", label: "Töömaht", options: options([["low", "Madal"], ["moderate", "Mõõdukas"], ["high", "Kõrge"], ["critical", "Kriitiline"]]) },
    { key: "caseComplexityLevel", label: "Juhtumite keerukus", options: options([["routine", "Rutiinne"], ["moderate", "Mõõdukas"], ["complex", "Keerukas"], ["very_complex", "Väga keerukas"]]) },
    { key: "emotionalLoad", label: "Emotsionaalne koormus", options: options([["low", "Madal"], ["moderate", "Mõõdukas"], ["high", "Kõrge"], ["very_high", "Väga kõrge"]]) },
    { key: "documentationLoad", label: "Dokumenteerimise koormus", options: options([["low", "Madal"], ["moderate", "Mõõdukas"], ["high", "Kõrge"], ["very_high", "Väga kõrge"]]) },
    { key: "interruptionsLevel", label: "Katkestused", options: options([["low", "Madalad"], ["moderate", "Mõõdukad"], ["high", "Kõrged"], ["very_high", "Väga kõrged"]]) },
    { key: "afterHoursImpact", label: "Töövälise kättesaadavuse mõju", options: options([["none", "Puudub"], ["low", "Madal"], ["moderate", "Mõõdukas"], ["high", "Kõrge"]]) }
  ],
  resources: [
    { key: "recoveryLevel", label: "Taastumisvõimalus", options: options([["sufficient", "Piisav"], ["partial", "Osaline"], ["low", "Vähene"], ["none", "Puudub"]]) },
    { key: "decisionControl", label: "Otsustusruum töö üle", options: options([["high", "Kõrge"], ["moderate", "Mõõdukas"], ["low", "Madal"], ["none", "Puudub"]]) },
    { key: "priorityClarity", label: "Prioriteetide selgus", options: options([["clear", "Selge"], ["partly_clear", "Osaliselt selge"], ["unclear", "Ebaselge"]]) },
    { key: "workBoundaryClarity", label: "Tööpiiride selgus", options: options([["clear", "Selge"], ["partly_clear", "Osaliselt selge"], ["unclear", "Ebaselge"]]) }
  ],
  /* Juhi ja kolleegide tugi on eraldi küsimused: organisatsioonis on need eri
     meetmed ja TÜ küsitlus küsib neid eraldi. Tähenduslikkus on tugevus, mitte
     koormus (signaali ei muuda). */
  support: [
    { key: "managerSupport", label: "Juhi tugi", options: SUPPORT_OPTIONS },
    { key: "colleagueSupport", label: "Kolleegide tugi", options: SUPPORT_OPTIONS },
    { key: "workMeaning", label: "Tunnen, et mu tööl on mõte", options: options([["yes", "Jah"], ["partly", "Osaliselt"], ["no", "Praegu mitte"]]) }
  ]
});

/** Märkeruudud: [väli, sildi tõlkevõti, selgituse tõlkevõti]. */
export const QUICK_CHECK_RISKS = Object.freeze([
  { key: "difficultCaseMarker", labelKey: "wellbeing.quick_check.difficult_case_marker", hintKey: "wellbeing.quick_check.risk_hints.difficult_case" },
  { key: "covisionNeed", labelKey: "wellbeing.quick_check.covision_need", hintKey: "wellbeing.quick_check.risk_hints.covision" },
  { key: "supportNeed", labelKey: "wellbeing.quick_check.support_need", hintKey: "wellbeing.quick_check.risk_hints.support" }
]);

/* Turvalisuse märgid on oma samm: viis märkeruutu ja kolleegi või juhi märke
   teade ei mahtunud ühte vaatesse (1536 × 640: teade lõppes 68 px paneeli all). */
export const QUICK_CHECK_SAFETY = Object.freeze([
  { key: "clientViolenceMarker", labelKey: "wellbeing.quick_check.client_violence_marker", hintKey: "wellbeing.quick_check.risk_hints.client_violence" },
  { key: "colleagueMistreatmentMarker", labelKey: "wellbeing.quick_check.colleague_mistreatment_marker", hintKey: "wellbeing.quick_check.risk_hints.colleague_mistreatment" }
]);

/**
 * Algseis: küsimused on VASTAMATA. Varem olid väljad eeltäidetud („mõõdukas")
 * ja nende pealt arvutatud „Kollane" paistis inimese enda hinnanguna enne, kui
 * ta midagi oli valinud (kujundusaudit 08.10).
 */
export const QUICK_CHECK_EMPTY = Object.freeze({
  workloadLevel: null,
  caseComplexityLevel: null,
  emotionalLoad: null,
  documentationLoad: null,
  interruptionsLevel: null,
  afterHoursImpact: null,
  recoveryLevel: null,
  decisionControl: null,
  priorityClarity: null,
  workBoundaryClarity: null,
  managerSupport: null,
  colleagueSupport: null,
  workMeaning: null,
  difficultCaseMarker: false,
  clientViolenceMarker: false,
  colleagueMistreatmentMarker: false,
  covisionNeed: false,
  supportNeed: false
});
