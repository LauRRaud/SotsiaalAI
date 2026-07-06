export const STARTER_SUPPORT_SCHEMA_VERSION = "1.0";
export const STARTER_SUPPORT_SCORING_VERSION = "starter-support-v1";

import { wellbeingLabel, wellbeingLabelList } from "./displayLabels.js";

export const STARTER_SUPPORT_FIELD_KEYS = Object.freeze([
  "experienceStage",
  "roleArea",
  "unclearTopics",
  "existingSupport",
  "missingSupport",
  "casesNotCarryAlone",
  "covisionNeedSigns",
  "mentorDiscussionNeed",
  "managerDiscussionNeed",
  "workBoundaryNeed",
  "supportUrgency"
]);

const urgencyScore = {
  stable: 0,
  plan_needed: 1,
  soon: 2,
  urgent: 3
};

function hasAny(values, expected) {
  const selected = new Set(Array.isArray(values) ? values : []);
  return expected.some((value) => selected.has(value));
}

function action(workflowType, label, reason) {
  return { workflowType, label, reason };
}

export function computeStarterSupportResult(fields = {}) {
  const loadFactors = [];
  const resourceFactors = [];
  const riskMarkers = [];
  const recommendedActions = [];

  const missingSupportCount = Array.isArray(fields.missingSupport) ? fields.missingSupport.length : 0;
  const casesNotCarryCount = Array.isArray(fields.casesNotCarryAlone) ? fields.casesNotCarryAlone.length : 0;

  if (missingSupportCount > 0) loadFactors.push("starter_support.missing_support");
  if (casesNotCarryCount > 0) loadFactors.push("starter_support.cases_not_carry_alone");
  if (hasAny(fields.unclearTopics, ["role_boundaries"])) loadFactors.push("starter_support.role_uncertainty");
  if (hasAny(fields.unclearTopics, ["documentation"])) loadFactors.push("starter_support.documentation_uncertainty");

  if (fields.mentorDiscussionNeed || hasAny(fields.missingSupport, ["mentor"])) {
    resourceFactors.push("starter_support.mentor_needed");
  }
  if (fields.managerDiscussionNeed) resourceFactors.push("starter_support.manager_check_needed");
  if (fields.workBoundaryNeed) resourceFactors.push("starter_support.boundary_plan_needed");
  if (hasAny(fields.missingSupport, ["covision"])) resourceFactors.push("starter_support.covision_needed");

  if (hasAny(fields.unclearTopics, ["role_boundaries"])) riskMarkers.push("starter_support.early_role_uncertainty");
  if (casesNotCarryCount > 0) riskMarkers.push("starter_support.not_to_carry_alone");
  if ((urgencyScore[fields.supportUrgency] ?? 0) >= 2) riskMarkers.push("starter_support.support_agreement_needed_soon");

  recommendedActions.push(action(
    "role-boundaries",
    "Ava Rollipiirid",
    "Alustaja rolli ja vastutuse ebaselgus vajab eraldi rollipiiride selgitust."
  ));
  recommendedActions.push(action(
    "work-processes",
    "Ava Tööprotsessid",
    "Dokumenteerimise või töökorralduse ebaselgus vajab töövoo kaardistamist."
  ));
  recommendedActions.push(action(
    "work-boundaries",
    "Sõnasta alustaja tööpiirid",
    "Alustava spetsialisti kättesaadavus ja abi küsimise piirid vajavad kokkulepet."
  ));
  if (hasAny(fields.missingSupport, ["covision"]) || Array.isArray(fields.covisionNeedSigns) && fields.covisionNeedSigns.length > 0) {
    recommendedActions.push(action(
      "covision",
      "Valmista kovisiooni sisend",
      "Juhtumit, eetilist pinget või rolli ebaselgust ei peaks alustaja üksi kandma."
    ));
  }
  recommendedActions.push(action(
    "overview",
    "Jälgi mustrit Ülevaates",
    "Alustaja toe marker aitab hiljem näha, millised toe puudujäägid korduvad."
  ));

  const totalScore =
    missingSupportCount +
    casesNotCarryCount * 2 +
    (Array.isArray(fields.unclearTopics) ? Math.min(fields.unclearTopics.length, 3) : 0) +
    (Array.isArray(fields.covisionNeedSigns) ? Math.min(fields.covisionNeedSigns.length, 2) : 0) +
    (fields.mentorDiscussionNeed ? 1 : 0) +
    (fields.managerDiscussionNeed ? 1 : 0) +
    (urgencyScore[fields.supportUrgency] ?? 0);

  const signalLevel = totalScore >= 8
    ? "needs_urgent_support_agreement"
    : totalScore >= 3
      ? "needs_clearer_support_plan"
      : "support_available";

  return {
    signalLevel,
    loadFactors,
    resourceFactors,
    riskMarkers,
    recommendedActions
  };
}

function list(values = [], fallback) {
  return wellbeingLabelList(values, fallback);
}

function buildOutputSummary(fields, result) {
  const firstWeekPlan = [
    "Esimese nädala plaan",
    "",
    `Rollivaldkond: ${wellbeingLabel(fields.roleArea)}.`,
    "Selgitada esimesel nädalal:",
    ...list(fields.unclearTopics, "täpsustada kõige pakilisem ebaselge teema"),
    "Kokkuleppida regulaarne lühike kontrollpunkt juhiga või mentoriga."
  ].join("\n");

  const firstMonthFocus = [
    "Esimese kuu fookused",
    "",
    "Puuduv tugi:",
    ...list(fields.missingSupport, "täpsustada puuduv tugi"),
    "Olemasolev tugi:",
    ...list(fields.existingSupport, "täpsustada olemasolev tugi")
  ].join("\n");

  const hundredDaySupportPlan = [
    "100 päeva töötoe plaan",
    "",
    `Kogemuse etapp: ${wellbeingLabel(fields.experienceStage)}.`,
    "1. nädal: rolli, dokumenteerimise ja abi küsimise kanalid selgeks.",
    "1. kuu: mentoriga korduvad küsimused ja töövoo kitsaskohad läbi.",
    "100 päeva: vaadata üle koormus, tööpiirid, kovisiooni vajadus ja iseseisva töö maht.",
    `Signaal: ${wellbeingLabel(result.signalLevel)}.`
  ].join("\n");

  const managerMentorQuestions = [
    "Küsimused juhile või mentorile",
    "",
    "Millised juhtumid ei peaks jääma minu üksi kanda?",
    "Millal pöördun juhi, mentori, kolleegi või kovisiooni poole?",
    "Milline dokumenteerimise rutiin on selles rollis ootuspärane?",
    "Kuidas piiritleda töövälist kättesaadavust alustamise perioodil?"
  ].join("\n");

  const covisionNeedCheck = [
    "Kovisiooni vajaduse kontroll",
    "",
    "Märgid:",
    ...list(fields.covisionNeedSigns, "täpsustada kovisiooni vajaduse märk"),
    "Juhtumid, mida ei tohiks üksi kanda:",
    ...list(fields.casesNotCarryAlone, "täpsustada juhtum või olukord")
  ].join("\n");

  const boundaryDraft = [
    "Alustaja tööpiiride mustand",
    "",
    "Alustamise perioodil lepin kokku, millal küsin abi, millal eskaleerin ja millised kanalid on kiireloomuliseks suhtluseks.",
    `Tööpiiri vajadus: ${fields.workBoundaryNeed ? "jah" : "ei"}.`,
    `Toe kiireloomulisus: ${wellbeingLabel(fields.supportUrgency)}.`
  ].join("\n");

  return {
    firstWeekPlan,
    firstMonthFocus,
    hundredDaySupportPlan,
    managerMentorQuestions,
    covisionNeedCheck,
    boundaryDraft
  };
}

export function buildStarterSupportRecord({ period = null, roleGroup = null, standardizedFields = {} } = {}) {
  const computed = computeStarterSupportResult(standardizedFields);

  return {
    schemaVersion: STARTER_SUPPORT_SCHEMA_VERSION,
    scoringVersion: STARTER_SUPPORT_SCORING_VERSION,
    workflowType: "starter-support",
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
