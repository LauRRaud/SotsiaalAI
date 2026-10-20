/**
 * TÖÖHEAOLU — „MINU TUGIVÕIMALUSED" (TÜ küsitluse võrdlus ptk 8.2 p 4).
 *
 * Töötaja märgib, milliseid tugimeetmeid tööandja tema teada võimaldab ja
 * milliseid ta vajab. TLÜ 2024 järeldus: suur koormus takistab olemasolevate
 * meetmete kasutamist ja töötajaid tuleb võimalustest teavitada. Tööriist näitab
 * kolme rühma:
 *
 *   olemas ja vajan          — kasuta seda;
 *   olemas, praegu ei vaja   — tasub teada;
 *   vajan, aga pole või ei tea — sisend arenguvestluseks või juhiga arutelu memoks.
 *
 * Koondisse läheb ainult „vajan, aga pole" (`measures.gap.<meede>`): see on
 * KOV-i kuuraporti ressursiosa (ideed 21.2). Mida töötaja teab olemas olevat,
 * jääb talle.
 *
 * 1.1: „Mida tahaksin õppida" (TÜ küsitluse küsimus 16, `learningAreaCatalog.js`).
 * Valik suunab platvormi olemasolevatesse kohtadesse ja on arenguvestluse
 * sisendis; koondisse see ei lähe.
 */

import { wellbeingLabel } from "./displayLabels.js";
import { LEARNING_AREA_DESTINATIONS, LEARNING_AREA_VALUES } from "./learningAreaCatalog.js";
import {
  SUPPORT_MEASURE_GROUPS,
  SUPPORT_MEASURE_VALUES,
  supportMeasureGapKey
} from "./supportMeasureCatalog.js";

export const SUPPORT_MEASURES_SCHEMA_VERSION = "1.1";
export const SUPPORT_MEASURES_SCORING_VERSION = "support-measures-v2";

/* Kolm rühma × kaks küsimust: iga loend on oma vaates, et vaade mahuks. */
export const SUPPORT_MEASURES_FIELDS = Object.freeze({
  development: Object.freeze(["offeredDevelopment", "neededDevelopment"]),
  health: Object.freeze(["offeredHealth", "neededHealth"]),
  organisation: Object.freeze(["offeredOrganisation", "neededOrganisation"])
});

/* Õpisoov on oma väli ja oma sõnavara (`learningAreaCatalog.js`). */
export const SUPPORT_MEASURES_LEARNING_FIELD = "learningAreas";

export const SUPPORT_MEASURES_FIELD_KEYS = Object.freeze([
  ...Object.values(SUPPORT_MEASURES_FIELDS).flat(),
  SUPPORT_MEASURES_LEARNING_FIELD
]);

/* Platvormil endal olevad tugivormid: kui töötaja neid vajab ja tööandja ei
   paku, saab ta need siin ise käivitada. */
const PLATFORM_MEASURES = Object.freeze({
  covision: { workflowType: "covision", label: "Ava kovisioon", reason: "Kovisiooni saab platvormil kolleegidega ise käivitada." },
  supervision: { workflowType: "supervision", label: "Ava supervisioon", reason: "Supervisiooni saab platvormil leida ja kokku leppida." },
  mentoring: { workflowType: "mentoring", label: "Ava mentorlus", reason: "Mentorit saab platvormil otsida." }
});

/* Kuhu õpisoov suunab. Platvorm ei ole koolitaja: need on kohad, kus ta juba aitab. */
const LEARNING_ACTIONS = Object.freeze({
  luna: { workflowType: "luna", label: "Küsi Lunalt", reason: "Õigusaktid ja juhendid on Luna teadmusbaasis: küsi oma olukorra kohta." },
  method_mirror: { workflowType: "method_mirror", label: "Ava Meetodipeegel", reason: "Mõtle oma juhtumitöö ja meetodid läbi: see on eneseanalüüsi ja õppimise koht." },
  ethics_room: { workflowType: "ethics_room", label: "Ava Eetikaruum", reason: "Eetilise dilemma saab seal rahulikult läbi mõelda." },
  materials: { workflowType: "materials", label: "Ava materjalid", reason: "Juhendid ja õppematerjalid on materjalide all." },
  recovery: { workflowType: "recovery", label: "Ava Taastumine", reason: "Enesehoid algab sellest, mis sind taastab." },
  "work-processes": { workflowType: "work-processes", label: "Ava Tööprotsessid", reason: "Oma töökorralduse saad seal töövoo kaupa läbi vaadata." },
  covision: { workflowType: "covision", label: "Ava kovisioon", reason: "Meeskonna- ja võrgustikutööd õpib kõige paremini koos kolleegidega." }
});

/* Õpisoovi soovitusi on kuni kolm ja kõiki soovitusi (Ülevaate kaardita) kuni
   neli: viis kaarti mahub järgmiste sammude vaatesse (1536 × 640, kolm rida),
   seitse ei mahuks. Vähemalt üks õpisoovitus jääb alati. */
const LEARNING_ACTION_LIMIT = 3;
const ACTION_LIMIT = 4;

function selected(fields, key) {
  const values = Array.isArray(fields?.[key]) ? fields[key] : [];
  return values.filter((value) => SUPPORT_MEASURE_VALUES.includes(value));
}

/** Märgitud õpivaldkonnad kataloogi järjekorras. */
export function selectedLearningAreas(fields = {}) {
  const values = new Set(Array.isArray(fields?.[SUPPORT_MEASURES_LEARNING_FIELD]) ? fields[SUPPORT_MEASURES_LEARNING_FIELD] : []);
  return LEARNING_AREA_VALUES.filter((value) => values.has(value));
}

/** Kolm rühma meetmete väärtustena, kataloogi järjekorras. */
export function classifySupportMeasures(fields = {}) {
  const offered = new Set();
  const needed = new Set();
  for (const [group, [offeredKey, neededKey]] of Object.entries(SUPPORT_MEASURES_FIELDS)) {
    const groupValues = SUPPORT_MEASURE_GROUPS[group].map(([value]) => value);
    for (const value of selected(fields, offeredKey)) if (groupValues.includes(value)) offered.add(value);
    for (const value of selected(fields, neededKey)) if (groupValues.includes(value)) needed.add(value);
  }
  return {
    usedNeeded: SUPPORT_MEASURE_VALUES.filter((value) => offered.has(value) && needed.has(value)),
    availableUnused: SUPPORT_MEASURE_VALUES.filter((value) => offered.has(value) && !needed.has(value)),
    gaps: SUPPORT_MEASURE_VALUES.filter((value) => needed.has(value) && !offered.has(value))
  };
}

export function computeSupportMeasuresResult(fields = {}) {
  const { gaps, usedNeeded } = classifySupportMeasures(fields);
  const recommendedActions = gaps
    .filter((value) => PLATFORM_MEASURES[value])
    .map((value) => ({ ...PLATFORM_MEASURES[value] }));
  const learningActions = [];
  const learningLimit = Math.min(LEARNING_ACTION_LIMIT, Math.max(1, ACTION_LIMIT - recommendedActions.length));
  for (const area of selectedLearningAreas(fields)) {
    const destination = LEARNING_AREA_DESTINATIONS[area];
    if (learningActions.length >= learningLimit) break;
    if (!LEARNING_ACTIONS[destination]) continue;
    if ([...recommendedActions, ...learningActions].some((item) => item.workflowType === destination)) continue;
    learningActions.push({ ...LEARNING_ACTIONS[destination] });
  }
  recommendedActions.push(...learningActions);
  recommendedActions.push({
    workflowType: "overview",
    label: "Jälgi mustrit Ülevaates",
    reason: "Tugimeetmete puudujäägid on koos koormusmustriga paremini arutatavad."
  });
  return {
    /* Signaal on töökorralduslik ja ei ole kunagi punane: puuduv meede ei ole
       oht, vaid kokkuleppe teema. Kui vajadusi ei märgitud, ei ütle ta ka
       „tugi on olemas" — see oleks väide, mida vastused ei kanna. */
    signalLevel: gaps.length
      ? "needs_clearer_support_plan"
      : usedNeeded.length
        ? "support_available"
        : "insufficient_data",
    loadFactors: [],
    resourceFactors: gaps.map(supportMeasureGapKey),
    riskMarkers: [],
    recommendedActions
  };
}

function lines(values, fallback) {
  return values.length ? values.map((value) => `- ${wellbeingLabel(value)}`) : [`- ${fallback}`];
}

function buildOutputSummary(fields) {
  const { usedNeeded, availableUnused, gaps } = classifySupportMeasures(fields);
  const learning = selectedLearningAreas(fields);
  const overview = [
    "Minu tugivõimalused",
    "",
    "Olemas ja vajan:",
    ...lines(usedNeeded, "ei märkinud"),
    "",
    "Olemas, praegu ei vaja:",
    ...lines(availableUnused, "ei märkinud"),
    "",
    "Vajan, aga minu teada ei ole võimalik:",
    ...lines(gaps, "ei märkinud"),
    ...(learning.length ? ["", "Mida tahaksin õppida:", ...lines(learning, "")] : [])
  ].join("\n");

  const discussionInput = gaps.length || learning.length
    ? [
        "Arenguvestluse või juhiga arutelu sisend",
        ...(gaps.length
          ? [
              "",
              "Soovin arutada tugimeetmeid, mida vajan, aga mis minu teada ei ole praegu võimalikud:",
              ...lines(gaps, ""),
              "",
              "Palun selgitust, kas need on meie asutuses kättesaadavad ja kuidas neid kasutada saab, või kas saaksime leppida kokku mõne asendusvõimaluse."
            ]
          : []),
        ...(learning.length
          ? ["", "Mida tahaksin õppida:", ...lines(learning, ""), "", "Soovin arutada, millised koolitused või muud arenguvõimalused seda toetaksid."]
          : [])
      ].join("\n")
    : null;

  return { overview, discussionInput };
}

export function buildSupportMeasuresRecord({ period = null, roleGroup = null, standardizedFields = {} } = {}) {
  const normalizedFields = Object.fromEntries(
    SUPPORT_MEASURES_FIELD_KEYS.map((key) => [
      key,
      key === SUPPORT_MEASURES_LEARNING_FIELD ? selectedLearningAreas(standardizedFields) : selected(standardizedFields, key)
    ])
  );
  const computed = computeSupportMeasuresResult(normalizedFields);

  return {
    schemaVersion: SUPPORT_MEASURES_SCHEMA_VERSION,
    scoringVersion: SUPPORT_MEASURES_SCORING_VERSION,
    workflowType: "support-measures",
    createdAt: new Date().toISOString(),
    period,
    roleGroup,
    standardizedFields: normalizedFields,
    computedSignal: { signalLevel: computed.signalLevel },
    loadFactors: computed.loadFactors,
    resourceFactors: computed.resourceFactors,
    riskMarkers: computed.riskMarkers,
    recommendedActions: computed.recommendedActions,
    outputSummary: buildOutputSummary(normalizedFields),
    visibility: "private",
    aggregationEligible: true
  };
}
