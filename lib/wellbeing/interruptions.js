export const INTERRUPTIONS_SCHEMA_VERSION = "1.0";
export const INTERRUPTIONS_SCORING_VERSION = "interruptions-v1";

import { wellbeingLabel, wellbeingLabelList } from "./displayLabels.js";

export const INTERRUPTIONS_FIELD_KEYS = Object.freeze([
  "interruptionClass",
  "sources",
  "frequency",
  "workImpact",
  "immediateResponseNeed",
  "canWait",
  "neededAgreement",
  "counterpart",
  "wrongChannelShare",
  "documentationInterruption",
  "recoveryImpact"
]);

const scoreMaps = {
  interruptionClass: {
    unavoidable: 0,
    negotiable: 1,
    deferrable: 1,
    wrong_channel: 2,
    role_boundary: 2,
    documentation_system: 2,
    partner_process: 2
  },
  frequency: { rare: 0, sometimes: 1, often: 2, very_often: 3 },
  workImpact: { low: 0, moderate: 1, high: 2 },
  immediateResponseNeed: { clear: 0, partial: 1, unclear: 2 },
  canWait: { few: 0, some: 1, many: 2 },
  wrongChannelShare: { none: 0, some: 1, many: 2 },
  recoveryImpact: { none: 0, some: 1, high: 2 }
};

function valueScore(fields, key) {
  return scoreMaps[key]?.[fields?.[key]] ?? 0;
}

function action(workflowType, label, reason) {
  return { workflowType, label, reason };
}

export function computeInterruptionsResult(fields = {}) {
  const loadFactors = [];
  const resourceFactors = [];
  const riskMarkers = [];
  const recommendedActions = [];

  if (valueScore(fields, "frequency") >= 2) loadFactors.push("interruptions.high_frequency");
  if (valueScore(fields, "workImpact") >= 1) loadFactors.push("interruptions.work_impact");
  if (fields.interruptionClass === "wrong_channel" || valueScore(fields, "wrongChannelShare") >= 1) {
    loadFactors.push("interruptions.wrong_channel");
  }
  if (fields.documentationInterruption || fields.interruptionClass === "documentation_system") {
    loadFactors.push("interruptions.documentation_system");
  }
  if (fields.interruptionClass === "role_boundary") loadFactors.push("interruptions.role_boundary");
  if (fields.interruptionClass === "partner_process") loadFactors.push("interruptions.partner_process");

  if (fields.neededAgreement === "focus_time" || valueScore(fields, "frequency") >= 2) {
    resourceFactors.push("focus_time.agreement_needed");
  }
  if (fields.neededAgreement === "channel_rules" || valueScore(fields, "wrongChannelShare") >= 1) {
    resourceFactors.push("channels.agreement_needed");
  }
  if (fields.immediateResponseNeed === "unclear") resourceFactors.push("urgency.criteria_unclear");
  if (fields.documentationInterruption) resourceFactors.push("process.documentation_simplification_needed");

  if (fields.recoveryImpact === "high") riskMarkers.push("interruptions.recovery_impact_high");
  if (fields.frequency === "very_often") riskMarkers.push("interruptions.very_frequent");
  if (fields.canWait === "many" && fields.immediateResponseNeed !== "clear") {
    riskMarkers.push("interruptions.many_can_wait");
  }

  recommendedActions.push(action(
    "work-boundaries",
    "Koosta fookusaja kokkulepe",
    "Katkestuste vähendamine vajab sageli tööpiiri, fookusaja või kanalite kokkulepet."
  ));
  if (fields.documentationInterruption || fields.interruptionClass === "documentation_system") {
    recommendedActions.push(action(
      "work-processes",
      "Ava Tööprotsessid",
      "Dokumenteerimise või infosüsteemi katkestus vajab töövoo auditit."
    ));
  }
  if (fields.recoveryImpact === "some" || fields.recoveryImpact === "high") {
    recommendedActions.push(action(
      "recovery",
      "Ava Taastumine",
      "Katkestuste mõju taastumisele vajab 24-72h koormuse hoidmist."
    ));
  }
  recommendedActions.push(action(
    "overview",
    "Jälgi mustrit Ülevaates",
    "Katkestuste marker aitab hiljem tööpäeva killustatuse mustrit üldistatult märgata."
  ));

  const totalScore =
    valueScore(fields, "interruptionClass") +
    valueScore(fields, "frequency") +
    valueScore(fields, "workImpact") +
    valueScore(fields, "immediateResponseNeed") +
    valueScore(fields, "canWait") +
    valueScore(fields, "wrongChannelShare") +
    valueScore(fields, "recoveryImpact") +
    (fields.documentationInterruption ? 1 : 0);

  const signalLevel = totalScore >= 12
    ? "needs_reorganization"
    : totalScore >= 3
      ? "needs_workflow_clarification"
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
  const interruptionMap = [
    "Katkestuste kaart",
    "",
    `Katkestuse liik: ${wellbeingLabel(fields.interruptionClass)}.`,
    "Allikad:",
    ...list(fields.sources, "täpsustada katkestuse allikas"),
    `Sagedus: ${wellbeingLabel(fields.frequency)}.`,
    `Mõju tööle: ${wellbeingLabel(fields.workImpact)}.`,
    `Kohe reageerimise selgus: ${wellbeingLabel(fields.immediateResponseNeed)}.`,
    `Oodata võiks: ${wellbeingLabel(fields.canWait)}.`
  ].join("\n");

  const focusTimeAgreement = [
    "Fookusaja kokkulepe",
    "",
    `Osapool: ${wellbeingLabel(fields.counterpart)}.`,
    "Ettepanek: leppida kokku kindel fookusaeg, mille ajal katkestused lähevad ainult selgelt kiireloomulise kriteeriumi alusel.",
    `Vajalik kokkulepe: ${wellbeingLabel(fields.neededAgreement)}.`
  ].join("\n");

  const channelAgreement = [
    "Suhtluskanalite kokkulepe",
    "",
    "Eesmärk: eristada kiiret, kokkulepitavat ja edasi lükatavat suhtlust.",
    `Valest kanalist tulev osa: ${wellbeingLabel(fields.wrongChannelShare)}.`,
    "Ettepanek: määrata, milline teema käib telefoni, sõnumi, e-kirja, tiimikanali või planeeritud arutelu kaudu."
  ].join("\n");

  const managerMemo = [
    "Juhiga arutelu memo",
    "",
    "Soovin arutada tööpäeva katkestuste vähendamist töökorralduslikult.",
    `Signaal: ${wellbeingLabel(result.signalLevel)}.`,
    `Peamine katkestuse liik: ${wellbeingLabel(fields.interruptionClass)}.`,
    `Kokkuleppe osapool: ${wellbeingLabel(fields.counterpart)}.`,
    `Vajalik kokkulepe: ${wellbeingLabel(fields.neededAgreement)}.`
  ].join("\n");

  return {
    interruptionMap,
    focusTimeAgreement,
    channelAgreement,
    managerMemo
  };
}

export function buildInterruptionsRecord({ period = null, roleGroup = null, standardizedFields = {} } = {}) {
  const computed = computeInterruptionsResult(standardizedFields);

  return {
    schemaVersion: INTERRUPTIONS_SCHEMA_VERSION,
    scoringVersion: INTERRUPTIONS_SCORING_VERSION,
    workflowType: "interruptions",
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
