export const QUICK_CHECK_SCHEMA_VERSION = "1.0";
export const QUICK_CHECK_SCORING_VERSION = "quick-check-v1";

export const QUICK_CHECK_FIELD_KEYS = Object.freeze([
  "workloadLevel",
  "caseComplexityLevel",
  "emotionalLoad",
  "documentationLoad",
  "interruptionsLevel",
  "recoveryLevel",
  "afterHoursImpact",
  "decisionControl",
  "priorityClarity",
  "supportAvailability",
  "covisionNeed",
  "workBoundaryClarity",
  "difficultCaseMarker",
  "supportNeed"
]);

const scoreMaps = {
  workloadLevel: { low: 0, moderate: 1, high: 2, critical: 3 },
  caseComplexityLevel: { routine: 0, moderate: 1, complex: 2, very_complex: 3 },
  emotionalLoad: { low: 0, moderate: 1, high: 2, very_high: 3 },
  documentationLoad: { low: 0, moderate: 1, high: 2, very_high: 3 },
  interruptionsLevel: { low: 0, moderate: 1, high: 2, very_high: 3 },
  recoveryLevel: { sufficient: 0, partial: 1, low: 2, none: 3 },
  afterHoursImpact: { none: 0, low: 1, moderate: 2, high: 3 },
  decisionControl: { high: 0, moderate: 1, low: 2, none: 3 },
  priorityClarity: { clear: 0, partly_clear: 1, unclear: 2 },
  supportAvailability: { available: 0, partial: 1, unclear: 2, not_available: 3 },
  workBoundaryClarity: { clear: 0, partly_clear: 1, unclear: 2 }
};

const actionCatalog = {
  "hard-case": {
    workflowType: "hard-case",
    label: "Ava raske juhtumi töövoog",
    reason: "Märgitud on raske juhtum, mida ei peaks üksi kandma."
  },
  "work-processes": {
    workflowType: "work-processes",
    label: "Vaata tööprotsesse",
    reason: "Dokumenteerimise või korduvtegevuste koormus on kõrge."
  },
  interruptions: {
    workflowType: "interruptions",
    label: "Kaardista katkestused",
    reason: "Katkestused killustavad tööpäeva."
  },
  recovery: {
    workflowType: "recovery",
    label: "Koosta taastumise plaan",
    reason: "Taastumisvõimalus on vähene või puudub."
  },
  "work-boundaries": {
    workflowType: "work-boundaries",
    label: "Täpsusta tööpiire",
    reason: "Töövälise kättesaadavuse või tööpiiride mõju vajab kokkulepet."
  },
  "role-boundaries": {
    workflowType: "role-boundaries",
    label: "Selgita rollipiire",
    reason: "Prioriteedid, otsustusruum või rollipiirid on ebaselged."
  },
  covision: {
    workflowType: "covision",
    label: "Valmista kovisiooni sisend",
    reason: "Sisestus viitab vajadusele kolleegitoe või kovisiooni järele."
  }
};

const actionPriority = [
  "hard-case",
  "work-processes",
  "interruptions",
  "recovery",
  "work-boundaries",
  "role-boundaries",
  "covision"
];

const factorLabels = {
  "workload.high": "Töömaht on kõrge",
  "case_complexity.high": "Juhtumite keerukus on kõrge",
  "emotional_load.high": "Emotsionaalne koormus on kõrge",
  "documentation.high": "Dokumenteerimise koormus on kõrge",
  "interruptions.high": "Katkestuste tase on kõrge",
  "after_hours.impact": "Töövälise kättesaadavuse mõju on kõrge",
  "recovery.low_or_none": "Taastumisvõimalus on vähene või puudub",
  "support.unclear_or_missing": "Juhi või kolleegi tugi on ebaselge või puudub",
  "decision_control.low": "Otsustusruum töö üle on vähene",
  "clarity.unclear": "Prioriteedid või tööpiirid on ebaselged",
  "risk.difficult_case": "Märgitud on raske juhtum",
  "recovery.none_with_critical_workload": "Kriitiline töömaht koos puuduva taastumisega"
};

function valueScore(fields, key) {
  return scoreMaps[key]?.[fields?.[key]] ?? 0;
}

function addUniqueAction(actions, key) {
  if (!actions.some((action) => action.workflowType === key)) {
    actions.push(actionCatalog[key]);
  }
}

export function computeQuickCheckResult(fields = {}) {
  const loadFactors = [];
  const resourceFactors = [];
  const riskMarkers = [];
  const recommendedActions = [];

  if (valueScore(fields, "workloadLevel") >= 2) loadFactors.push("workload.high");
  if (valueScore(fields, "caseComplexityLevel") >= 2) loadFactors.push("case_complexity.high");
  if (valueScore(fields, "emotionalLoad") >= 2) {
    loadFactors.push("emotional_load.high");
    addUniqueAction(recommendedActions, "recovery");
  }
  if (valueScore(fields, "documentationLoad") >= 2) {
    loadFactors.push("documentation.high");
    addUniqueAction(recommendedActions, "work-processes");
  }
  if (valueScore(fields, "interruptionsLevel") >= 2) {
    loadFactors.push("interruptions.high");
    addUniqueAction(recommendedActions, "interruptions");
  }
  if (valueScore(fields, "afterHoursImpact") >= 2) {
    loadFactors.push("after_hours.impact");
    addUniqueAction(recommendedActions, "work-boundaries");
  }

  if (valueScore(fields, "recoveryLevel") >= 2) {
    resourceFactors.push("recovery.low_or_none");
    addUniqueAction(recommendedActions, "recovery");
  }
  if (valueScore(fields, "supportAvailability") >= 2) {
    resourceFactors.push("support.unclear_or_missing");
    addUniqueAction(recommendedActions, "covision");
  }
  if (valueScore(fields, "decisionControl") >= 2) {
    resourceFactors.push("decision_control.low");
    addUniqueAction(recommendedActions, "role-boundaries");
  }
  if (valueScore(fields, "priorityClarity") >= 2 || valueScore(fields, "workBoundaryClarity") >= 2) {
    resourceFactors.push("clarity.unclear");
    addUniqueAction(recommendedActions, "role-boundaries");
  }

  if (fields.difficultCaseMarker) {
    riskMarkers.push("risk.difficult_case");
    recommendedActions.unshift(actionCatalog["hard-case"]);
  }
  if (fields.supportNeed || fields.covisionNeed) addUniqueAction(recommendedActions, "covision");

  if (fields.workloadLevel === "critical" && fields.recoveryLevel === "none") {
    riskMarkers.push("recovery.none_with_critical_workload");
    addUniqueAction(recommendedActions, "recovery");
  }

  const totalScore = QUICK_CHECK_FIELD_KEYS.reduce((sum, key) => {
    if (typeof fields[key] === "boolean") return sum + (fields[key] ? 2 : 0);
    return sum + valueScore(fields, key);
  }, 0);
  const signalLevel =
    riskMarkers.includes("recovery.none_with_critical_workload") || totalScore >= 18
      ? "red"
      : totalScore >= 8
        ? "yellow"
        : "green";

  return {
    signalLevel,
    loadFactors,
    resourceFactors,
    riskMarkers,
    recommendedActions: recommendedActions.toSorted(
      (a, b) => actionPriority.indexOf(a.workflowType) - actionPriority.indexOf(b.workflowType)
    )
  };
}

export function buildQuickCheckRecord({ period = null, roleGroup = null, standardizedFields = {} } = {}) {
  const computed = computeQuickCheckResult(standardizedFields);

  return {
    schemaVersion: QUICK_CHECK_SCHEMA_VERSION,
    scoringVersion: QUICK_CHECK_SCORING_VERSION,
    workflowType: "quick-check",
    createdAt: new Date().toISOString(),
    period,
    roleGroup,
    standardizedFields,
    computedSignal: { signalLevel: computed.signalLevel },
    loadFactors: computed.loadFactors,
    resourceFactors: computed.resourceFactors,
    riskMarkers: computed.riskMarkers,
    recommendedActions: computed.recommendedActions,
    visibility: "private",
    aggregationEligible: true
  };
}

export function formatQuickCheckFactor(value) {
  return factorLabels[value] || value;
}
