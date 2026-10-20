/**
 * TÖÖHEAOLU — TUGEVUSED („Mis toimib").
 *
 * Ideed 19.4: privaatne Ülevaade näitab ka olemasolevaid tööressursse; ideed
 * 21.2: „raport peab näitama ka toimivaid ressursse"; TÜ küsitluse võrdlus
 * ptk 8.2 p 2. Tugevused ei tohi jääda riskide varju.
 *
 * Kirjed salvestavad tegurina PUUDUJÄÄGID (`loadFactors`, `resourceFactors`).
 * Tugevused tuletatakse siin töötaja enda kirjete vastustest — ainult selgelt
 * positiivsest vastusest (nt kolleegide tugi „kättesaadav", mitte „osaline").
 * Skoori ega üldhinnangut ei arvutata.
 *
 * KUS NEID NÄEB: Ülevaates ja töötaja enda koostatud juhimemos (tuletatud
 * vastustest, ka vanadest kirjetest). Anonüümsesse koondisse lähevad nad
 * salvestamisel kirje külge kirjutatud `strengthFactors`-i kaudu
 * (`records.js`), sest koond ei loe vastuseid — vt tööheaolu
 * arendusettepanek ptk 8.19.
 */

import { classifySupportMeasures } from "./supportMeasures.js";

/* [väli, väärtus, tugevus] töövoo kaupa. Sama tugevus võib tulla mitmest
   töövoost (taastumine ja tähendus nii kiirkontrollist kui nädala peegeldusest). */
const RULES = Object.freeze({
  "quick-check": [
    ["recoveryLevel", "sufficient", "strength.recovery"],
    ["decisionControl", "high", "strength.decision_control"],
    ["priorityClarity", "clear", "strength.priorities_clear"],
    ["workBoundaryClarity", "clear", "strength.boundaries_clear"],
    ["managerSupport", "available", "strength.manager_support"],
    ["colleagueSupport", "available", "strength.colleague_support"],
    ["workMeaning", "yes", "strength.work_meaning"]
  ],
  "weekly-reflection": [
    ["weeklyRecovery", "sufficient", "strength.recovery"],
    ["weeklyMeaning", "yes", "strength.work_meaning"]
  ],
  "work-boundaries": [
    ["boundaryClarity", "clear", "strength.boundaries_clear"],
    ["flexibleHours", "yes", "strength.flexible_hours"]
  ]
});

export const WELLBEING_STRENGTH_KEYS = Object.freeze([
  ...new Set([...Object.values(RULES).flat().map(([, , key]) => key), "strength.support_in_use"])
]);

/* Millistest töövoogudest tugevus saab tulla. Koond vajab seda täiendi kaitseks:
   „lähtetöövoogude ühikud − tugevus" on need, kes ei vastanud selgelt
   positiivselt (`aggregate.js`). */
export const WELLBEING_STRENGTH_SOURCES = Object.freeze(Object.fromEntries(
  WELLBEING_STRENGTH_KEYS.map((key) => [
    key,
    Object.freeze(key === "strength.support_in_use"
      ? ["support-measures"]
      : Object.keys(RULES).filter((workflowType) => RULES[workflowType].some(([, , strength]) => strength === key)))
  ])
));

/** Ühe kirje tugevused (iga tugevus üks kord). */
export function strengthsOfRecord(record) {
  const fields = record?.standardizedFields;
  if (!fields || typeof fields !== "object") return [];
  const found = new Set();
  for (const [field, value, key] of RULES[record.workflowType] || []) {
    if (fields[field] === value) found.add(key);
  }
  if (record.workflowType === "support-measures" && classifySupportMeasures(fields).usedNeeded.length) {
    found.add("strength.support_in_use");
  }
  return [...found];
}
