/* 1.1 (20.10.2026, TÜ küsitluse võrdlus ptk 8.2 p 1; tervikanalüüs I8, TO-5):
   Taastumine oli ainult 24–72 h ülesannete jaotus. Nüüd küsib ta enne seda
   psühholoogilist eemaldumist (neli sagedusküsimust viimase kahe nädala kohta),
   mis taastumiskogemustest (Sonnentag ja Fritz 2007: eemaldumine, lõõgastus,
   meisterlikkus, kontroll) praegu puudu jääb, ja ühte kokkulepet iseendaga.
   Ülesannete jaotus jääb viimaseks sammuks. */
export const RECOVERY_SCHEMA_VERSION = "1.1";
export const RECOVERY_SCORING_VERSION = "recovery-v2";

import { wellbeingLabel, wellbeingInlineList } from "./displayLabels.js";

export const RECOVERY_FIELD_KEYS = Object.freeze([
  "workThoughtsOffHours",
  "endOfDayExhaustion",
  "sleepAffected",
  "workAnxiety",
  "missingRecoveryExperiences",
  "selfAgreement",
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

export const RECOVERY_FREQUENCY_VALUES = Object.freeze(["rarely", "sometimes", "often", "almost_always"]);
const frequencyScores = { rarely: 0, sometimes: 1, often: 2, almost_always: 3 };
const frequent = (value) => (frequencyScores[value] ?? 0) >= 2;

/* Uni ja ärevus on tervisele lähedased vastused: sage vastus näitab töötajale
   teadet ja annab ainult talle jääva märgi (`privateMarkers.js`). Signaali nad
   ei muuda, sest signaal läheb koondisse ja kannaks nad sinna kaudselt kaasa. */
export function recoverySleepOrAnxietyFrequent(fields = {}) {
  return frequent(fields.sleepAffected) || frequent(fields.workAnxiety);
}

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

  const detachmentLow = frequent(fields.workThoughtsOffHours);
  if (detachmentLow) resourceFactors.push("recovery.detachment_low");
  if (frequent(fields.endOfDayExhaustion)) loadFactors.push("recovery.end_of_day_exhaustion");
  if (recoverySleepOrAnxietyFrequent(fields)) riskMarkers.push("recovery.sleep_or_anxiety_frequent");

  if (compactTasks(fields.redistributableTasks).length > 0 || fields.supportNeed === "manager") {
    recommendedActions.push(action(
      "work-boundaries",
      "Koosta töö ümberjagamise või tööpiiride kokkulepe",
      "Järgmise 24-72h koormus vajab kokkulepet."
    ));
  } else if (detachmentLow) {
    recommendedActions.push(action(
      "work-boundaries",
      "Lepi kokku töövälise kättesaadavuse piir",
      "Töö tuleb sageli vabasse aega kaasa; piir aitab tööst eemalduda."
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
    (fields.supportNeed && fields.supportNeed !== "none" ? 1 : 0) +
    (detachmentLow ? 1 : 0) +
    (frequent(fields.endOfDayExhaustion) ? 1 : 0);

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

const selfAgreementTexts = {
  write_unfinished: "Kirjutan tööpäeva lõpus lõpetamata asjad üles, et need ei käiks kaasas.",
  close_channels: "Panen vabal ajal töökanalid kinni.",
  transition: "Teen pärast tööd väikese ülemineku (jalutuskäik, muusika vms).",
  free_evening: "Hoian vähemalt ühe õhtu nädalas tööst täiesti vaba."
};

function buildOutputSummary(fields, result) {
  const signal = result.signalLevel;
  const missing = Array.isArray(fields.missingRecoveryExperiences) ? fields.missingRecoveryExperiences : [];
  /* Plaan on töötajale endale. Une ja ärevuse vastuseid ta ei kopeeri, sest
     valmis tekst on mõeldud ka edasi kasutamiseks. */
  const recoveryPlan72h = [
    "Taastumisplaan",
    "",
    `Signaal: ${wellbeingLabel(signal)}`,
    `Viimased kaks nädalat: tööle mõtlemine vabal ajal – ${wellbeingLabel(fields.workThoughtsOffHours)}; vaimne kurnatus tööpäeva lõpuks – ${wellbeingLabel(fields.endOfDayExhaustion)}.`,
    `Mis praegu puudu jääb: ${wellbeingInlineList(missing, "eraldi ei märkinud")}.`,
    `Minu kokkulepe iseendaga: ${selfAgreementTexts[fields.selfAgreement] || "praegu ei valinud."}`,
    "",
    taskBlock("Vältimatud ülesanded", fields.unavoidableTasks, "täpsustada üks kuni kolm päriselt vältimatut tegevust."),
    taskBlock("Edasilükatavad ülesanded", fields.deferrableTasks, "märkida tegevused, mis võivad oodata."),
    taskBlock("Ümberjagatavad ülesanded", fields.redistributableTasks, "märkida tegevused, millele on vaja kokkulepet või asendust."),
    `Järgmine kontrollpunkt: ${wellbeingLabel(fields.nextCheckpoint)}.`
  ].join("\n");

  const managerMemo = [
    "Juhiga arutelu memo",
    "",
    "Vajan järgmise 24-72 tunni töökorralduslikku kokkulepet, et vältimatud tegevused oleksid kaetud ja taastumiseks tekiks realistlik ruum.",
    ...(result.resourceFactors.includes("recovery.detachment_low")
      ? ["Töö tuleb sageli vabasse aega kaasa. Soovin kokkulepet, millal ma töö küsimustele ei vasta."]
      : []),
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
      : [],
    missingRecoveryExperiences: Array.isArray(standardizedFields.missingRecoveryExperiences)
      ? standardizedFields.missingRecoveryExperiences.filter(Boolean)
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
