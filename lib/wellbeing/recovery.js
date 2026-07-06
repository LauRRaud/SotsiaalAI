export const RECOVERY_SCHEMA_VERSION = "1.0";
export const RECOVERY_SCORING_VERSION = "recovery-v1";

import { wellbeingLabel } from "./displayLabels.js";

export const RECOVERY_FIELD_KEYS = Object.freeze([
  "recoveryReason",
  "recoveryLevel",
  "workCapacityNext72h",
  "unavoidableTasks",
  "deferrableTasks",
  "redistributableTasks",
  "primaryLoadFactors",
  "supportNeed",
  "covisionNeed",
  "nextCheckpoint"
]);

const recoveryScores = {
  sufficient: 0,
  partial: 1,
  low: 2,
  none: 3
};

const capacityScores = {
  stable: 0,
  reduced: 1,
  low: 2,
  not_sustainable: 3
};

const loadFactorLabels = {
  documentation: "documentation.high",
  interruptions: "interruptions.high",
  difficult_case: "risk.difficult_case",
  workplace_violence: "risk.workplace_violence",
  after_hours: "after_hours.impact",
  role_conflict: "clarity.unclear"
};

function score(map, value) {
  return map[value] ?? 0;
}

function compactTasks(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8);
  return String(value || "")
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function action(workflowType, label, reason) {
  return { workflowType, label, reason };
}

export function computeRecoveryResult(fields = {}) {
  const loadFactors = [];
  const resourceFactors = [];
  const riskMarkers = [];
  const recommendedActions = [];

  for (const factor of fields.primaryLoadFactors || []) {
    const mapped = loadFactorLabels[factor] || factor;
    if (!loadFactors.includes(mapped)) loadFactors.push(mapped);
  }

  if (score(recoveryScores, fields.recoveryLevel) >= 2) {
    resourceFactors.push("recovery.low_or_none");
  }

  if (fields.supportNeed && fields.supportNeed !== "none") {
    resourceFactors.push(`support.${fields.supportNeed}`);
  }

  if (score(capacityScores, fields.workCapacityNext72h) >= 2) {
    riskMarkers.push("recovery.low_capacity_72h");
  }

  if (fields.recoveryLevel === "none" && score(capacityScores, fields.workCapacityNext72h) >= 2) {
    riskMarkers.push("recovery.no_recovery_with_low_capacity");
  }

  if (compactTasks(fields.redistributableTasks).length > 0 || fields.supportNeed === "manager") {
    recommendedActions.push(action(
      "work-boundaries",
      "Koosta töö ümberjagamise või tööpiiride kokkulepe",
      "Järgmise 24-72h koormus vajab kokkulepet."
    ));
  }

  if (fields.covisionNeed) {
    recommendedActions.push(action(
      "covision",
      "Koosta kovisiooni sisend",
      "Kasutaja märkis vajaduse kolleegitoe või kovisiooni järele."
    ));
  }

  recommendedActions.push(action(
    "overview",
    "Vaata mustrit Ülevaates",
    "Taastumisplaan peaks hiljem kajastuma korduvate koormustegurite vaates."
  ));

  const totalScore =
    score(recoveryScores, fields.recoveryLevel) +
    score(capacityScores, fields.workCapacityNext72h) +
    (fields.covisionNeed ? 1 : 0) +
    (fields.supportNeed && fields.supportNeed !== "none" ? 1 : 0);

  const signalLevel = riskMarkers.includes("recovery.no_recovery_with_low_capacity") || totalScore >= 5
    ? "organizational_support"
    : totalScore >= 2
      ? "prioritize"
      : "manageable";

  return {
    signalLevel,
    loadFactors,
    resourceFactors,
    riskMarkers,
    recommendedActions
  };
}

function taskBlock(title, tasks, fallback) {
  const items = compactTasks(tasks);
  if (!items.length) return `${title}: ${fallback}`;
  return [
    `${title}:`,
    ...items.map((item) => `- ${item}`)
  ].join("\n");
}

function buildOutputSummary(fields, result) {
  const signal = result.signalLevel;
  const recoveryPlan72h = [
    "24-72h taastumisplaan",
    "",
    `Signaal: ${wellbeingLabel(signal)}`,
    taskBlock("Vältimatud ülesanded", fields.unavoidableTasks, "täpsustada üks kuni kolm päriselt vältimatut tegevust."),
    taskBlock("Edasilükatavad ülesanded", fields.deferrableTasks, "märkida tegevused, mis võivad oodata."),
    taskBlock("Ümberjagatavad ülesanded", fields.redistributableTasks, "märkida tegevused, millele on vaja kokkulepet või asendust."),
    `Järgmine kontrollpunkt: ${wellbeingLabel(fields.nextCheckpoint)}.`
  ].join("\n");

  const managerMemo = [
    "Juhiga arutelu memo",
    "",
    "Vajan järgmise 24-72 tunni töökorralduslikku kokkulepet, et vältimatud tegevused oleksid kaetud ja taastumiseks tekiks realistlik ruum.",
    taskBlock("Ümberjagamise ettepanek", fields.redistributableTasks, "täpsustada koos juhiga."),
    "Palun lepime kokku, mida teha kohe, mida edasi lükata ja millal plaan üle vaadata."
  ].join("\n");

  return {
    recoveryPlan72h,
    managerMemo
  };
}

export function buildRecoveryRecord({ period = null, roleGroup = null, standardizedFields = {} } = {}) {
  const normalizedFields = {
    ...standardizedFields,
    unavoidableTasks: compactTasks(standardizedFields.unavoidableTasks),
    deferrableTasks: compactTasks(standardizedFields.deferrableTasks),
    redistributableTasks: compactTasks(standardizedFields.redistributableTasks),
    primaryLoadFactors: Array.isArray(standardizedFields.primaryLoadFactors)
      ? standardizedFields.primaryLoadFactors.filter(Boolean)
      : []
  };
  const computed = computeRecoveryResult(normalizedFields);

  return {
    schemaVersion: RECOVERY_SCHEMA_VERSION,
    scoringVersion: RECOVERY_SCORING_VERSION,
    workflowType: "recovery",
    createdAt: new Date().toISOString(),
    period,
    roleGroup,
    standardizedFields: normalizedFields,
    computedSignal: { signalLevel: computed.signalLevel },
    loadFactors: computed.loadFactors,
    resourceFactors: computed.resourceFactors,
    riskMarkers: computed.riskMarkers,
    recommendedActions: computed.recommendedActions,
    outputSummary: buildOutputSummary(normalizedFields, computed),
    visibility: "private",
    aggregationEligible: true
  };
}
