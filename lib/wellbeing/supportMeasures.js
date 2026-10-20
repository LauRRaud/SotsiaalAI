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
 */

import { wellbeingLabel } from "./displayLabels.js";
import {
  SUPPORT_MEASURE_GROUPS,
  SUPPORT_MEASURE_VALUES,
  supportMeasureGapKey
} from "./supportMeasureCatalog.js";

export const SUPPORT_MEASURES_SCHEMA_VERSION = "1.0";
export const SUPPORT_MEASURES_SCORING_VERSION = "support-measures-v1";

/* Kolm rühma × kaks küsimust: iga loend on oma vaates, et vaade mahuks. */
export const SUPPORT_MEASURES_FIELDS = Object.freeze({
  development: Object.freeze(["offeredDevelopment", "neededDevelopment"]),
  health: Object.freeze(["offeredHealth", "neededHealth"]),
  organisation: Object.freeze(["offeredOrganisation", "neededOrganisation"])
});

export const SUPPORT_MEASURES_FIELD_KEYS = Object.freeze(Object.values(SUPPORT_MEASURES_FIELDS).flat());

/* Platvormil endal olevad tugivormid: kui töötaja neid vajab ja tööandja ei
   paku, saab ta need siin ise käivitada. */
const PLATFORM_MEASURES = Object.freeze({
  covision: { workflowType: "covision", label: "Ava kovisioon", reason: "Kovisiooni saab platvormil kolleegidega ise käivitada." },
  supervision: { workflowType: "supervision", label: "Ava supervisioon", reason: "Supervisiooni saab platvormil leida ja kokku leppida." },
  mentoring: { workflowType: "mentoring", label: "Ava mentorlus", reason: "Mentorit saab platvormil otsida." }
});

function selected(fields, key) {
  const values = Array.isArray(fields?.[key]) ? fields[key] : [];
  return values.filter((value) => SUPPORT_MEASURE_VALUES.includes(value));
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
    ...lines(gaps, "ei märkinud")
  ].join("\n");

  const discussionInput = gaps.length
    ? [
        "Arenguvestluse või juhiga arutelu sisend",
        "",
        "Soovin arutada tugimeetmeid, mida vajan, aga mis minu teada ei ole praegu võimalikud:",
        ...lines(gaps, ""),
        "",
        "Palun selgitust, kas need on meie asutuses kättesaadavad ja kuidas neid kasutada saab, või kas saaksime leppida kokku mõne asendusvõimaluse."
      ].join("\n")
    : null;

  return { overview, discussionInput };
}

export function buildSupportMeasuresRecord({ period = null, roleGroup = null, standardizedFields = {} } = {}) {
  const normalizedFields = Object.fromEntries(
    SUPPORT_MEASURES_FIELD_KEYS.map((key) => [key, selected(standardizedFields, key)])
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
