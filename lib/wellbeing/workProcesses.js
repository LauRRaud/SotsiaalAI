export const WORK_PROCESSES_SCHEMA_VERSION = "1.0";
export const WORK_PROCESSES_SCORING_VERSION = "work-processes-v1";

import { wellbeingLabel, wellbeingLabelList } from "./displayLabels.js";

export const WORK_PROCESSES_FIELD_KEYS = Object.freeze([
  "analysisFocus",
  "categories",
  "timeCostSources",
  "lowValueActivities",
  "informationBlockers",
  "unfinishedWork",
  "simplificationNeeds",
  "documentationDuplication",
  "switchingLoad",
  "processImpact",
  "counterpart"
]);

const scoreMaps = {
  documentationDuplication: { none: 0, low: 0, moderate: 1, high: 3 },
  switchingLoad: { low: 0, moderate: 1, high: 2 },
  processImpact: { low: 0, moderate: 2, high: 3 }
};

function valueScore(fields, key) {
  return scoreMaps[key]?.[fields?.[key]] ?? 0;
}

function hasAny(values, expected) {
  const selected = new Set(Array.isArray(values) ? values : []);
  return expected.some((value) => selected.has(value));
}

function action(workflowType, label, reason) {
  return { workflowType, label, reason };
}

export function computeWorkProcessesResult(fields = {}) {
  const loadFactors = [];
  const resourceFactors = [];
  const riskMarkers = [];
  const recommendedActions = [];

  if (hasAny(fields.categories, ["duplicate_entry"])) loadFactors.push("processes.duplicate_entry");
  if (hasAny(fields.categories, ["documentation"])) loadFactors.push("processes.documentation_load");
  if (hasAny(fields.categories, ["information_search"])) loadFactors.push("processes.information_search");
  if (hasAny(fields.categories, ["waiting"])) loadFactors.push("processes.waiting");
  if (hasAny(fields.categories, ["repetitive_tasks"])) loadFactors.push("processes.repetitive_tasks");
  if (fields.switchingLoad === "high") loadFactors.push("processes.switching_load_high");

  if (hasAny(fields.simplificationNeeds, ["single_entry"])) resourceFactors.push("processes.single_entry_needed");
  if (hasAny(fields.simplificationNeeds, ["shared_status_view"])) resourceFactors.push("processes.shared_status_view_needed");
  if (hasAny(fields.informationBlockers, ["unclear_owner"])) resourceFactors.push("processes.owner_clarity_needed");
  if (hasAny(fields.informationBlockers, ["missing_shared_view"])) resourceFactors.push("processes.information_flow_needed");

  if (fields.processImpact === "high") riskMarkers.push("processes.high_value_loss");
  if (fields.documentationDuplication === "high") riskMarkers.push("processes.duplicate_documentation_high");
  if (Array.isArray(fields.unfinishedWork) && fields.unfinishedWork.length >= 2) {
    riskMarkers.push("processes.unfinished_work_accumulates");
  }

  if (fields.switchingLoad === "high" || hasAny(fields.categories, ["information_search", "repetitive_tasks"])) {
    recommendedActions.push(action(
      "interruptions",
      "Ava Katkestused",
      "Ümberlülitumine ja korduv info otsimine vajavad katkestuste mustri eraldi kaardistamist."
    ));
  }
  recommendedActions.push(action(
    "work-boundaries",
    "Sõnasta töökorralduse kokkulepe",
    "Protsessi lihtsustamine vajab sageli kokkulepet aja, vastutuse või suhtluskanali kohta."
  ));
  if (hasAny(fields.informationBlockers, ["unclear_owner"])) {
    recommendedActions.push(action(
      "role-boundaries",
      "Täpsusta rollipiirid",
      "Ebaselge omanik või vastutus vajab rolli- ja vastutuspiiride täpsustamist."
    ));
  }
  recommendedActions.push(action(
    "overview",
    "Jälgi mustrit Ülevaates",
    "Tööprotsessi marker aitab hiljem korduvaid töökorralduse koormustegureid koondada."
  ));

  const totalScore =
    valueScore(fields, "documentationDuplication") +
    valueScore(fields, "switchingLoad") +
    valueScore(fields, "processImpact") +
    (Array.isArray(fields.timeCostSources) ? Math.min(fields.timeCostSources.length, 3) : 0) +
    (Array.isArray(fields.informationBlockers) ? Math.min(fields.informationBlockers.length, 2) : 0);

  const signalLevel = totalScore >= 8
    ? "needs_organizational_change"
    : totalScore >= 3
      ? "needs_simplification"
      : "manageable";

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
  const processMap = [
    "Tööprotsessi kaart",
    "",
    `Analüüsi fookus: ${wellbeingLabel(fields.analysisFocus)}.`,
    "Kategooriad:",
    ...list(fields.categories, "täpsustada töövoo kategooria"),
    "Peamised ajakulu allikad:",
    ...list(fields.timeCostSources, "täpsustada ajakulu allikas"),
    `Tööprotsessi mõju: ${wellbeingLabel(fields.processImpact)}.`
  ].join("\n");

  const topTimeThieves = [
    "Kolm suurimat ajaröövlit",
    "",
    ...list((fields.timeCostSources || []).slice(0, 3), "täpsustada kolm suurimat ajaröövlit")
  ].join("\n");

  const documentationSimplification = [
    "Dokumenteerimise lihtsustamise ettepanek",
    "",
    `Dubleerimise tase: ${wellbeingLabel(fields.documentationDuplication)}.`,
    "Lihtsustamise vajadused:",
    ...list(fields.simplificationNeeds, "täpsustada lihtsustamise vajadus"),
    "Vähese väärtusega või dubleerivad tegevused:",
    ...list(fields.lowValueActivities, "täpsustada madala väärtusega tegevus")
  ].join("\n");

  const informationFlowSummary = [
    "Info liikumise kokkuvõte",
    "",
    "Takistused:",
    ...list(fields.informationBlockers, "täpsustada info liikumise takistus"),
    "Pooleli jäävad tegevused:",
    ...list(fields.unfinishedWork, "täpsustada pooleli jääv töö")
  ].join("\n");

  const managerMemo = [
    "Töökorralduse arutelu memo",
    "",
    "Soovin arutada tööprotsessi lihtsustamist ja ajaröövlite vähendamist.",
    `Signaal: ${wellbeingLabel(result.signalLevel)}.`,
    `Fookus: ${wellbeingLabel(fields.analysisFocus)}.`,
    `Osapool: ${wellbeingLabel(fields.counterpart)}.`,
    "Ettepanek: valida üks korduv kitsaskoht, määrata omanik ja proovida lihtsustust järgmise tööperioodi jooksul."
  ].join("\n");

  return {
    processMap,
    topTimeThieves,
    documentationSimplification,
    informationFlowSummary,
    managerMemo
  };
}

export function buildWorkProcessesRecord({ period = null, roleGroup = null, standardizedFields = {} } = {}) {
  const computed = computeWorkProcessesResult(standardizedFields);

  return {
    schemaVersion: WORK_PROCESSES_SCHEMA_VERSION,
    scoringVersion: WORK_PROCESSES_SCORING_VERSION,
    workflowType: "work-processes",
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
