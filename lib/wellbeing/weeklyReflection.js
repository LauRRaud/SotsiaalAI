/**
 * TÖÖHEAOLU — NÄDALA PEEGELDUS (nädalarütm; S4 „Tööheaolu nädalarütm",
 * TÜ küsitluse võrdlus ptk 8.5 samm 7).
 *
 * Kolm küsimust ja üks vaba rida: koormus, taastumine, kas tööl oli mõte ning
 * „mis andis sel nädalal tööle mõtte?". Kiirkontroll (14+ küsimust) jääb
 * põhjalikuks vaateks; see on kerge rütm, mida jõuab teha iga nädal.
 *
 * RÜTM ON KUTSE, MITTE KOHUSTUS (ideed 19.2, V2 püsiruum ptk 1.3): ainus kutse
 * on vaikne märk Tööheaolu laual, kui sel nädalal kirjet veel ei ole. Midagi ei
 * saadeta, vahelejäänud nädal ei jäta võlga ega punast märki. Meeldetuletus
 * (teavitus) tuleb alles siis, kui taustatööd on lubatud.
 *
 * Koondisse lähevad samad tegurid mis kiirkontrollis (`workload.high`,
 * `recovery.low_or_none`, `meaning.low`); vaba rida jääb töötajale.
 */

import { wellbeingLabel } from "./displayLabels.js";

export const WEEKLY_REFLECTION_SCHEMA_VERSION = "1.0";
export const WEEKLY_REFLECTION_SCORING_VERSION = "weekly-reflection-v1";

export const WEEKLY_REFLECTION_FIELD_KEYS = Object.freeze(["weeklyLoad", "weeklyRecovery", "weeklyMeaning", "meaningNote"]);

const loadScores = { low: 0, moderate: 1, high: 2, critical: 3 };
const recoveryScores = { sufficient: 0, partial: 1, low: 2, none: 3 };

/** ISO nädala võti (nt „2026-W43") — Tööheaolu laua märk ja kirje pealkiri. */
export function isoWeekKey(date = new Date()) {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((day - yearStart) / 86400000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function computeWeeklyReflectionResult(fields = {}) {
  const loadFactors = [];
  const resourceFactors = [];
  const recommendedActions = [];
  const load = loadScores[fields.weeklyLoad] ?? 0;
  const recovery = recoveryScores[fields.weeklyRecovery] ?? 0;

  if (load >= 2) loadFactors.push("workload.high");
  if (recovery >= 2) resourceFactors.push("recovery.low_or_none");
  if (fields.weeklyMeaning === "no") resourceFactors.push("meaning.low");

  if (load >= 2) {
    recommendedActions.push({ workflowType: "quick-check", label: "Tee põhjalikum kiirkontroll", reason: "Koormus oli sel nädalal kõrge; kiirkontroll näitab, millest see tuleb." });
  }
  if (recovery >= 2) {
    recommendedActions.push({ workflowType: "recovery", label: "Koosta taastumise plaan", reason: "Taastumist oli sel nädalal vähe." });
  }

  const signalLevel = (fields.weeklyLoad === "critical" && fields.weeklyRecovery === "none") || load + recovery >= 5
    ? "red"
    : load + recovery >= 3
      ? "yellow"
      : "green";

  return { signalLevel, loadFactors, resourceFactors, riskMarkers: [], recommendedActions };
}

/* Kokkuvõte kasutab vormiga samu sõnu (üldsõnastik ütleks taastumise kohta „madal"). */
const recoveryWords = { sufficient: "piisavalt", partial: "osaliselt", low: "vähe", none: "üldse mitte" };
const meaningWords = { yes: "jah", partly: "osaliselt", no: "praegu mitte" };

function buildOutputSummary(fields, createdAt) {
  const note = String(fields.meaningNote || "").trim();
  return {
    weekSummary: [
      `Minu nädal (${isoWeekKey(createdAt)})`,
      "",
      `Koormus: ${wellbeingLabel(fields.weeklyLoad)}.`,
      `Jõudsin taastuda: ${recoveryWords[fields.weeklyRecovery] || wellbeingLabel(fields.weeklyRecovery)}.`,
      `Tööl oli mõte: ${meaningWords[fields.weeklyMeaning] || wellbeingLabel(fields.weeklyMeaning)}.`,
      ...(note ? ["", `Mis andis tööle mõtte: ${note}`] : [])
    ].join("\n")
  };
}

export function buildWeeklyReflectionRecord({ period = null, roleGroup = null, standardizedFields = {} } = {}) {
  const createdAt = new Date();
  const normalizedFields = { ...standardizedFields, meaningNote: String(standardizedFields.meaningNote || "").trim() };
  const computed = computeWeeklyReflectionResult(normalizedFields);
  return {
    schemaVersion: WEEKLY_REFLECTION_SCHEMA_VERSION,
    scoringVersion: WEEKLY_REFLECTION_SCORING_VERSION,
    workflowType: "weekly-reflection",
    createdAt: createdAt.toISOString(),
    period,
    roleGroup,
    standardizedFields: normalizedFields,
    computedSignal: { signalLevel: computed.signalLevel },
    loadFactors: computed.loadFactors,
    resourceFactors: computed.resourceFactors,
    riskMarkers: computed.riskMarkers,
    recommendedActions: computed.recommendedActions,
    outputSummary: buildOutputSummary(normalizedFields, createdAt),
    visibility: "private",
    aggregationEligible: true
  };
}
