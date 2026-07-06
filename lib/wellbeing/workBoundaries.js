export const WORK_BOUNDARIES_SCHEMA_VERSION = "1.0";
export const WORK_BOUNDARIES_SCORING_VERSION = "work-boundaries-v1";

import { wellbeingLabel } from "./displayLabels.js";

export const WORK_BOUNDARIES_FIELD_KEYS = Object.freeze([
  "agreementType",
  "currentConcern",
  "boundaryClarity",
  "afterHoursPressure",
  "pauseProtection",
  "replacementCoverage",
  "urgentExceptionClarity",
  "counterpart",
  "desiredPrinciple",
  "exceptions",
  "reviewTime",
  "supportNeed"
]);

const scoreMaps = {
  boundaryClarity: { clear: 0, partly_clear: 1, unclear: 2 },
  afterHoursPressure: { none: 0, low: 1, moderate: 2, high: 3 },
  pauseProtection: { protected: 0, partial: 1, unclear: 2, none: 3 },
  replacementCoverage: { clear: 0, partial: 1, unclear: 2, missing: 3 },
  urgentExceptionClarity: { clear: 0, partly_clear: 1, unclear: 2 }
};

function valueScore(fields, key) {
  return scoreMaps[key]?.[fields?.[key]] ?? 0;
}

function action(workflowType, label, reason) {
  return { workflowType, label, reason };
}

export function computeWorkBoundariesResult(fields = {}) {
  const loadFactors = [];
  const resourceFactors = [];
  const riskMarkers = [];
  const recommendedActions = [];

  if (valueScore(fields, "afterHoursPressure") >= 2) {
    loadFactors.push("after_hours.impact");
  }
  if (valueScore(fields, "boundaryClarity") >= 2 || valueScore(fields, "urgentExceptionClarity") >= 2) {
    resourceFactors.push("clarity.unclear");
  }
  if (valueScore(fields, "pauseProtection") >= 2) {
    resourceFactors.push("recovery.low_or_none");
  }
  if (valueScore(fields, "replacementCoverage") >= 2) {
    resourceFactors.push("support.replacement_unclear");
  }
  if (fields.afterHoursPressure === "high" && fields.boundaryClarity === "unclear") {
    riskMarkers.push("boundaries.after_hours_unclear");
  }
  if (fields.pauseProtection === "none") {
    riskMarkers.push("boundaries.no_pause_protection");
  }

  if (resourceFactors.includes("recovery.low_or_none")) {
    recommendedActions.push(action(
      "recovery",
      "Ava taastumise töövoog",
      "Pausid või taastumisruum vajavad eraldi 24-72h plaani."
    ));
  }
  if (fields.replacementCoverage === "unclear" || fields.replacementCoverage === "missing") {
    recommendedActions.push(action(
      "work-processes",
      "Täpsusta tööprotsessi või asendust",
      "Asendus või info liikumine vajab töövoo kokkulepet."
    ));
  }
  recommendedActions.push(action(
    "overview",
    "Jälgi mustrit Ülevaates",
    "Tööpiiride kokkuleppe vajadus peaks hiljem korduvmustrina nähtav olema."
  ));

  const totalScore =
    valueScore(fields, "boundaryClarity") +
    valueScore(fields, "afterHoursPressure") +
    valueScore(fields, "pauseProtection") +
    valueScore(fields, "replacementCoverage") +
    valueScore(fields, "urgentExceptionClarity") +
    (fields.supportNeed && fields.supportNeed !== "none" ? 1 : 0);

  const signalLevel = riskMarkers.includes("boundaries.after_hours_unclear") || totalScore >= 9
    ? "needs_agreement"
    : totalScore >= 3
      ? "needs_clarification"
      : "clear";

  return {
    signalLevel,
    loadFactors,
    resourceFactors,
    riskMarkers,
    recommendedActions
  };
}

function text(value, fallback) {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function buildOutputSummary(fields, result) {
  const boundaryAgreement = [
    "Tööpiiride kokkuleppe mustand",
    "",
    `Kokkuleppe tüüp: ${wellbeingLabel(fields.agreementType)}.`,
    `Osapool: ${wellbeingLabel(fields.counterpart)}.`,
    `Praegune mure: ${text(fields.currentConcern, "täpsustada lühidalt, milline tööpiir vajab kokkulepet.")}`,
    `Soovitud põhimõte: ${text(fields.desiredPrinciple, "sõnastada lihtne ja kontrollitav põhimõte.")}`,
    `Kriisiolukorra erandid: ${text(fields.exceptions, "täpsustada, millal kokkuleppest võib erandi teha.")}`,
    `Ülevaatamise aeg: ${wellbeingLabel(fields.reviewTime)}.`
  ].join("\n");

  const managerMemo = [
    "Juhiga arutelu memo",
    "",
    "Vajan tööpiiride kokkulepet, et tööväline kättesaadavus, pausid, asendused ja kiireloomulised erandid oleksid selged.",
    `Signaal: ${wellbeingLabel(result.signalLevel)}.`,
    `Ettepanek: ${text(fields.desiredPrinciple, "leppida kokku üks konkreetne tööpiir ja selle ülevaatamise aeg.")}`
  ].join("\n");

  const documentInput = [
    "Dokumendi koostamise sisend",
    "",
    "Koosta tööpiiride kokkuleppe mustand järgmiste punktide põhjal:",
    `- Kokkuleppe tüüp: ${wellbeingLabel(fields.agreementType)}`,
    `- Osapool: ${wellbeingLabel(fields.counterpart)}`,
    `- Soovitud põhimõte: ${text(fields.desiredPrinciple, "täpsustamisel")}`,
    `- Erandid: ${text(fields.exceptions, "täpsustamisel")}`,
    `- Ülevaatamine: ${wellbeingLabel(fields.reviewTime)}`
  ].join("\n");

  return {
    boundaryAgreement,
    managerMemo,
    documentInput
  };
}

export function buildWorkBoundariesRecord({ period = null, roleGroup = null, standardizedFields = {} } = {}) {
  const computed = computeWorkBoundariesResult(standardizedFields);

  return {
    schemaVersion: WORK_BOUNDARIES_SCHEMA_VERSION,
    scoringVersion: WORK_BOUNDARIES_SCORING_VERSION,
    workflowType: "work-boundaries",
    createdAt: new Date().toISOString(),
    period,
    roleGroup,
    standardizedFields,
    computedSignal: { signalLevel: computed.signalLevel },
    loadFactors: computed.loadFactors,
    resourceFactors: computed.resourceFactors,
    riskMarkers: computed.riskMarkers,
    recommendedActions: computed.recommendedActions,
    outputSummary: buildOutputSummary(standardizedFields, computed),
    visibility: "private",
    aggregationEligible: true
  };
}
