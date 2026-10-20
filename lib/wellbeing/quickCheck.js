/* 1.1 (20.10.2026, TÜ küsitluse võrdlus ptk 8.2): „Juhi või kolleegi tugi" on
   kaks küsimust, lisandusid töö tähenduslikkus ning kliendi vägivalla ja
   kolleegi või juhi ebaväärika kohtlemise märk. */
export const QUICK_CHECK_SCHEMA_VERSION = "1.1";
export const QUICK_CHECK_SCORING_VERSION = "quick-check-v2";

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
  "managerSupport",
  "colleagueSupport",
  "workMeaning",
  "covisionNeed",
  "workBoundaryClarity",
  "difficultCaseMarker",
  "clientViolenceMarker",
  "colleagueMistreatmentMarker",
  "supportNeed"
]);

const SUPPORT_SCALE = { available: 0, partial: 1, unclear: 2, not_available: 3 };

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
  managerSupport: SUPPORT_SCALE,
  colleagueSupport: SUPPORT_SCALE,
  workBoundaryClarity: { clear: 0, partly_clear: 1, unclear: 2 }
};

/* Kaks tugiküsimust annavad signaali üheskoos nii palju kui varem üks: arvesse
   läheb nõrgem neist. Muidu tõstaks küsimuse poolitamine üksi signaali kollaseks.
   Töö tähenduslikkus (`workMeaning`) on tugevus, mitte koormus, ja signaali ei
   muuda — signaal on töökorralduslik (ideed 19.4). */
const SUPPORT_KEYS = new Set(["managerSupport", "colleagueSupport"]);

const actionCatalog = {
  "workplace-violence": {
    workflowType: "workplace-violence",
    label: "Ava töövägivalla töövoog",
    reason: "Märkisid kliendi või tema lähedase ähvarduse või vägivalla."
  },
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
  "workplace-violence",
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
  /* Vana võti jääb, sest 1.0 kirjetes on ta alles. */
  "support.unclear_or_missing": "Juhi või kolleegi tugi on ebaselge või puudub",
  "support.manager_unclear_or_missing": "Juhi tugi on ebaselge või puudub",
  "support.colleague_unclear_or_missing": "Kolleegide tugi on ebaselge või puudub",
  "meaning.low": "Töö tähenduslikkuse tunne on praegu madal",
  "decision_control.low": "Otsustusruum töö üle on vähene",
  "clarity.unclear": "Prioriteedid või tööpiirid on ebaselged",
  "risk.difficult_case": "Märgitud on raske juhtum",
  "risk.workplace_violence": "Märgitud on töövägivalla kogemus",
  "risk.colleague_mistreatment": "Märgitud on kolleegi või juhi ebaväärikas kohtlemine",
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
  if (valueScore(fields, "managerSupport") >= 2) {
    resourceFactors.push("support.manager_unclear_or_missing");
    addUniqueAction(recommendedActions, "covision");
  }
  if (valueScore(fields, "colleagueSupport") >= 2) {
    resourceFactors.push("support.colleague_unclear_or_missing");
    addUniqueAction(recommendedActions, "covision");
  }
  if (fields.workMeaning === "no") resourceFactors.push("meaning.low");
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
  if (fields.clientViolenceMarker) {
    riskMarkers.push("risk.workplace_violence");
    addUniqueAction(recommendedActions, "workplace-violence");
  }
  /* Kolleegi või juhi ebaväärikas kohtlemine: märk jääb ainult töötajale
     (`privateMarkers.js`). Töövägivalla töövoog eeldab praegu, et tegija on
     klient, seega soovituskaarti ei teki; mida teha, ütleb vormi teade selle
     märke all. */
  if (fields.colleagueMistreatmentMarker) riskMarkers.push("risk.colleague_mistreatment");
  if (fields.supportNeed || fields.covisionNeed) addUniqueAction(recommendedActions, "covision");

  if (fields.workloadLevel === "critical" && fields.recoveryLevel === "none") {
    riskMarkers.push("recovery.none_with_critical_workload");
    addUniqueAction(recommendedActions, "recovery");
  }

  const totalScore = QUICK_CHECK_FIELD_KEYS.reduce((sum, key) => {
    if (SUPPORT_KEYS.has(key)) return sum;
    if (typeof fields[key] === "boolean") return sum + (fields[key] ? 2 : 0);
    return sum + valueScore(fields, key);
  }, Math.max(valueScore(fields, "managerSupport"), valueScore(fields, "colleagueSupport")));
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
