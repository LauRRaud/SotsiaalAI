export const HARD_CASE_SCHEMA_VERSION = "1.0";
export const HARD_CASE_SCORING_VERSION = "hard-case-v1";

import { wellbeingInlineList, wellbeingLabel, wellbeingLabelList } from "./displayLabels.js";

export const HARD_CASE_FIELD_KEYS = Object.freeze([
  "caseType",
  "immediateDanger",
  "generalizedDescription",
  "professionalRole",
  "mainLoad",
  "ethicalTension",
  "moralDistress",
  "traumaExposure",
  "roleClarity",
  "shouldNotCarryAlone",
  "next24hNeeds",
  "covisionNeed",
  "recoveryNeed"
]);

const scoreMaps = {
  immediateDanger: { no: 0, uncertain: 4, yes: 5 },
  ethicalTension: { none: 0, low: 1, moderate: 2, high: 3 },
  moralDistress: { none: 0, some: 1, strong: 2 },
  traumaExposure: { none: 0, indirect: 1, direct: 2 },
  roleClarity: { clear: 0, partly_clear: 1, unclear: 2 },
  recoveryNeed: { none: 0, partial: 1, high: 2 }
};

function valueScore(fields, key) {
  return scoreMaps[key]?.[fields?.[key]] ?? 0;
}

function action(workflowType, label, reason) {
  return { workflowType, label, reason };
}

export function computeHardCaseResult(fields = {}) {
  const loadFactors = ["case.difficult"];
  const resourceFactors = [];
  const riskMarkers = [];
  const recommendedActions = [];
  const safetyNoticeRequired = fields.immediateDanger === "yes" || fields.immediateDanger === "uncertain";

  if (fields.mainLoad) loadFactors.push(`hard_case.load.${fields.mainLoad}`);
  if (valueScore(fields, "ethicalTension") >= 2) loadFactors.push("ethical_tension.elevated");
  if (valueScore(fields, "moralDistress") >= 1) loadFactors.push("moral_distress.present");
  if (valueScore(fields, "traumaExposure") >= 1) loadFactors.push("trauma.exposure");
  if (fields.shouldNotCarryAlone || fields.covisionNeed) resourceFactors.push("support.do_not_carry_alone");
  if (valueScore(fields, "roleClarity") >= 1) resourceFactors.push("role.clarity_partial_or_unclear");
  if (valueScore(fields, "recoveryNeed") >= 1) resourceFactors.push("recovery.follow_up_needed");

  if (fields.immediateDanger === "yes") riskMarkers.push("hard_case.immediate_danger");
  if (fields.immediateDanger === "uncertain") riskMarkers.push("hard_case.immediate_danger_uncertain");
  if (fields.shouldNotCarryAlone) riskMarkers.push("hard_case.should_not_carry_alone");
  if (valueScore(fields, "traumaExposure") >= 2) riskMarkers.push("hard_case.direct_trauma_exposure");
  if (valueScore(fields, "ethicalTension") >= 3) riskMarkers.push("hard_case.high_ethical_tension");

  if (fields.recoveryNeed === "partial" || fields.recoveryNeed === "high") {
    recommendedActions.push(action(
      "recovery",
      "Ava Taastumine",
      "Raske juhtumi järel tasub järgmise 24-72h töömaht ja taastumisruum eraldi läbi mõelda."
    ));
  }
  if (fields.covisionNeed || fields.shouldNotCarryAlone) {
    recommendedActions.push(action(
      "covision",
      "Koosta kovisiooni sisend",
      "Juhtum ei peaks jääma ainult ühe spetsialisti kanda."
    ));
  }
  if (fields.roleClarity === "partly_clear" || fields.roleClarity === "unclear") {
    recommendedActions.push(action(
      "role-boundaries",
      "Täpsusta rollipiire",
      "Rolli või vastutuse ebaselgus vajab eraldi selgitamist."
    ));
  }
  recommendedActions.push(action(
    "overview",
    "Jälgi mustrit Ülevaates",
    "Raske juhtumi marker aitab hiljem koormuse mustrit üldistatult märgata."
  ));

  const totalScore =
    valueScore(fields, "immediateDanger") +
    valueScore(fields, "ethicalTension") +
    valueScore(fields, "moralDistress") +
    valueScore(fields, "traumaExposure") +
    valueScore(fields, "roleClarity") +
    valueScore(fields, "recoveryNeed") +
    (fields.shouldNotCarryAlone ? 2 : 0) +
    (fields.covisionNeed ? 1 : 0);

  const signalLevel = safetyNoticeRequired || totalScore >= 11
    ? "urgent_attention"
    : totalScore >= 3
      ? "needs_attention"
      : "no_immediate_danger";

  return {
    signalLevel,
    safetyNoticeRequired,
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

function list(values = [], fallback) {
  return wellbeingLabelList(values, fallback);
}

function buildOutputSummary(fields, result) {
  const aftercarePlan24h = [
    "24h järelplaan",
    "",
    "1. Kontrolli, kas vahetu oht on välistatud või kas vajab eraldi tegutsemist.",
    "2. Pane kirja ainult tööks vajalikud üldistatud faktid.",
    "3. Lepi kokku üks järelkontakt või arutelu, kui juhtumit ei peaks üksi kandma.",
    "4. Hoia järgmise 24h töömaht realistlik ja märgi taastumise vajadus.",
    "",
    "Järgmise 24h vajadused:",
    ...list(fields.next24hNeeds, "täpsustada üks töökorralduslik järeltegevus")
  ].join("\n");

  const neutralSummary = [
    "Neutraalne kokkuvõte",
    "",
    `Juhtumi tüüp: ${wellbeingLabel(fields.caseType)}.`,
    `Üldistatud kirjeldus: ${text(fields.generalizedDescription, "kirjelda olukorda ilma kliendiandmete ja tuvastatavate detailideta.")}`,
    `Tööalane roll: ${wellbeingLabel(fields.professionalRole)}.`,
    `Peamine koormus: ${wellbeingLabel(fields.mainLoad)}.`,
    `Signaal: ${wellbeingLabel(result.signalLevel)}.`
  ].join("\n");

  const managerMemo = [
    "Juhiga arutelu memo",
    "",
    "Soovin arutada raske juhtumi järeltegevust töökorralduslikult, ilma kliendiandmeid või liigseid detaile jagamata.",
    `Peamine teema: ${wellbeingLabel(fields.mainLoad)}.`,
    `Mis vajab tuge: ${fields.shouldNotCarryAlone ? "juhtumit ei peaks üksi kandma" : "järgmine samm vajab täpsustamist"}.`,
    `Soovitud 24h järeltegevus: ${wellbeingInlineList(fields.next24hNeeds)}.`
  ].join("\n");

  const covisionInput = [
    "Kovisiooni sisend",
    "",
    "Teema: raske juhtum / eetiline või emotsionaalne koormus",
    `Olukorra üldistatud kirjeldus: ${text(fields.generalizedDescription, "täpsustada üldistatult, ilma tuvastatavate detailideta.")}`,
    "Minu keskne küsimus: milline tööalane piir, tugi või järeltegevus aitaks olukorda kanda professionaalselt ja turvaliselt?",
    `Mis teeb olukorra keeruliseks: ${wellbeingLabel(fields.mainLoad)}.`,
    `Riskid või tähelepanu vajavad kohad: ${wellbeingInlineList(result.riskMarkers, "ei märgitud")}.`,
    "Mida soovin kovisioonis arutada: realistlik järgmine samm, rolliselgus ja taastumisruum."
  ].join("\n");

  return {
    aftercarePlan24h,
    neutralSummary,
    managerMemo,
    covisionInput
  };
}

export function buildHardCaseRecord({ period = null, roleGroup = null, standardizedFields = {} } = {}) {
  const computed = computeHardCaseResult(standardizedFields);

  return {
    schemaVersion: HARD_CASE_SCHEMA_VERSION,
    scoringVersion: HARD_CASE_SCORING_VERSION,
    workflowType: "hard-case",
    createdAt: new Date().toISOString(),
    period,
    roleGroup,
    standardizedFields,
    computedSignal: {
      signalLevel: computed.signalLevel,
      safetyNoticeRequired: computed.safetyNoticeRequired
    },
    loadFactors: computed.loadFactors,
    resourceFactors: computed.resourceFactors,
    riskMarkers: computed.riskMarkers,
    recommendedActions: computed.recommendedActions,
    outputSummary: buildOutputSummary(standardizedFields, computed),
    visibility: "private",
    aggregationEligible: true
  };
}
