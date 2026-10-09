/**
 * Kiirkontrolli küsimused ja vastusevariandid.
 *
 * Võtmed ja väärtused on serveri lepingu osa (`lib/wellbeing/quickCheck.js`,
 * `lib/wellbeing/fieldSchemas.js`): neid siin ei muudeta. Kaks rühma vastavad
 * kahele sammule (nõudmised ja ressursid); kolm märkeruutu on kolmas samm.
 */

const options = (pairs) => pairs.map(([value, label]) => ({ value, label }));

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
    { key: "supportAvailability", label: "Juhi või kolleegi tugi", options: options([["available", "Kättesaadav"], ["partial", "Osaline"], ["unclear", "Ebaselge"], ["not_available", "Pole kättesaadav"]]) },
    { key: "workBoundaryClarity", label: "Tööpiiride selgus", options: options([["clear", "Selge"], ["partly_clear", "Osaliselt selge"], ["unclear", "Ebaselge"]]) }
  ]
});

/** Märkeruudud: [väli, sildi tõlkevõti, selgituse tõlkevõti]. */
export const QUICK_CHECK_RISKS = Object.freeze([
  { key: "difficultCaseMarker", labelKey: "wellbeing.quick_check.difficult_case_marker", hintKey: "wellbeing.quick_check.risk_hints.difficult_case" },
  { key: "covisionNeed", labelKey: "wellbeing.quick_check.covision_need", hintKey: "wellbeing.quick_check.risk_hints.covision" },
  { key: "supportNeed", labelKey: "wellbeing.quick_check.support_need", hintKey: "wellbeing.quick_check.risk_hints.support" }
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
  supportAvailability: null,
  workBoundaryClarity: null,
  difficultCaseMarker: false,
  covisionNeed: false,
  supportNeed: false
});
