/* 1.1 (20.10.2026, TÜ küsitluse võrdlus ptk 8.2 p 3): töövoog eeldas, et tegija
   on klient. TLÜ 2024 uuringus oli 61% vastanutest kogenud töökiusu. Nüüd küsib
   ta, kellelt see tuli; kolleegi või juhi puhul on abiteed ja tekstid teised,
   kirje ei osale koondis ja juurde tuleb privaatne märkmik. */
export const WORKPLACE_VIOLENCE_SCHEMA_VERSION = "1.1";
export const WORKPLACE_VIOLENCE_SCORING_VERSION = "workplace-violence-v2";

import { wellbeingInlineList, wellbeingLabel } from "./displayLabels.js";

export const WORKPLACE_VIOLENCE_SOURCES = Object.freeze(["client_or_family", "colleague", "manager", "partner", "other"]);
const INTERNAL_SOURCES = new Set(["colleague", "manager"]);

/** Kas tegija on oma töökoha inimene (kolleeg või juht)? */
export function isInternalViolenceSource(fields = {}) {
  return INTERNAL_SOURCES.has(fields.sourceOfHarm);
}

export const WORKPLACE_VIOLENCE_FIELD_KEYS = Object.freeze([
  "violenceType",
  "dangerStatus",
  "sourceOfHarm",
  "privateLog",
  "generalizedDescription",
  "locationOrChannel",
  "documentedStatus",
  "workImpact",
  "safetyImpact",
  "nextStepNeed",
  "safetyAgreementNeed",
  "covisionNeed",
  "recoveryNeed"
]);

const scoreMaps = {
  dangerStatus: { ended: 0, uncertain: 4, ongoing: 5 },
  violenceType: {
    insult_or_humiliation: 1,
    aggression: 2,
    threat: 3,
    physical_danger: 4,
    stalking_or_intimidation: 3,
    repeated_harassment: 3,
    threatening_message: 3,
    lone_work_risk: 2
  },
  documentedStatus: { yes: 0, partial: 1, not_yet: 2 },
  workImpact: { low: 0, moderate: 1, high: 2 },
  safetyImpact: { none: 0, some: 1, high: 2 },
  safetyAgreementNeed: { no: 0, unclear: 1, yes: 2 },
  recoveryNeed: { none: 0, partial: 1, high: 2 }
};

function valueScore(fields, key) {
  return scoreMaps[key]?.[fields?.[key]] ?? 0;
}

function action(workflowType, label, reason) {
  return { workflowType, label, reason };
}

export function computeWorkplaceViolenceResult(fields = {}) {
  const loadFactors = ["violence.workplace"];
  const resourceFactors = [];
  const riskMarkers = [];
  const recommendedActions = [];
  const safetyNoticeRequired = fields.dangerStatus === "ongoing" || fields.dangerStatus === "uncertain";
  const internal = isInternalViolenceSource(fields);

  if (fields.violenceType) loadFactors.push(`violence.${fields.violenceType}`);
  /* Sama ainult töötajale jääv märk mis kiirkontrollis (`privateMarkers.js`). */
  if (internal) riskMarkers.push("risk.colleague_mistreatment");
  if (valueScore(fields, "workImpact") >= 1) loadFactors.push("work_impact.elevated");
  if (valueScore(fields, "safetyImpact") >= 1) loadFactors.push("safety_impact.present");
  if (fields.documentedStatus === "partial" || fields.documentedStatus === "not_yet") {
    resourceFactors.push("documentation.needs_neutral_record");
  }
  if (fields.safetyAgreementNeed === "yes" || fields.safetyAgreementNeed === "unclear") {
    resourceFactors.push("safety.agreement_needed");
  }
  if (fields.recoveryNeed === "partial" || fields.recoveryNeed === "high") {
    resourceFactors.push("recovery.follow_up_needed");
  }

  if (fields.dangerStatus === "ongoing") riskMarkers.push("workplace_violence.danger_ongoing");
  if (fields.dangerStatus === "uncertain") riskMarkers.push("workplace_violence.danger_uncertain");
  if (fields.violenceType === "physical_danger") riskMarkers.push("workplace_violence.physical_danger");
  if (fields.violenceType === "threat") riskMarkers.push("workplace_violence.threat");
  if (fields.safetyImpact === "high") riskMarkers.push("workplace_violence.safety_impact_high");

  if (fields.recoveryNeed === "partial" || fields.recoveryNeed === "high") {
    recommendedActions.push(action(
      "recovery",
      "Ava Taastumine",
      "Töövägivalla kogemuse järel tasub järgmise 24-72h töömaht ja taastumisruum eraldi läbi mõelda."
    ));
  }
  /* Kolleegi või juhi tehtut ei viida vaikimisi kolleegide rühma. */
  if (fields.covisionNeed && !internal) {
    recommendedActions.push(action(
      "covision",
      "Koosta kovisiooni sisend",
      "Töövägivalla olukord võib vajada kolleegidega üldistatud arutelu."
    ));
  }
  if (!internal && (fields.safetyAgreementNeed === "yes" || fields.safetyAgreementNeed === "unclear")) {
    recommendedActions.push(action(
      "work-boundaries",
      "Koosta turvalisuse kokkulepe",
      "Ohutus, tööpiirid, üksi töötamine või suhtluskanalid vajavad selget kokkulepet."
    ));
  }
  recommendedActions.push(action(
    "overview",
    "Jälgi mustrit Ülevaates",
    "Töövägivalla marker aitab hiljem koormuse mustrit üldistatult märgata."
  ));

  const totalScore =
    valueScore(fields, "dangerStatus") +
    valueScore(fields, "violenceType") +
    valueScore(fields, "documentedStatus") +
    valueScore(fields, "workImpact") +
    valueScore(fields, "safetyImpact") +
    valueScore(fields, "safetyAgreementNeed") +
    valueScore(fields, "recoveryNeed") +
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

/* Märkmik (`privateLog`) on ainult töötajale: ükski allolev tekst teda ei loe. */
function buildOutputSummary(fields, result) {
  const internal = isInternalViolenceSource(fields);
  const neutralIncidentDescription = [
    "Neutraalne juhtumikirjeldus",
    "",
    `Olukorra liik: ${wellbeingLabel(fields.violenceType)}.`,
    ...(fields.sourceOfHarm ? [`Kellelt: ${wellbeingLabel(fields.sourceOfHarm)}.`] : []),
    `Toimumise koht või kanal: ${wellbeingLabel(fields.locationOrChannel)}.`,
    `Üldistatud kirjeldus: ${text(fields.generalizedDescription, "kirjelda olukorda ilma kliendiandmete ja tuvastatavate detailideta.")}`,
    `Dokumenteerimise seis: ${wellbeingLabel(fields.documentedStatus)}.`,
    `Signaal: ${wellbeingLabel(result.signalLevel)}.`
  ].join("\n");

  const safetyAgreementInput = [
    "Turvalisuse kokkuleppe sisend",
    "",
    "Eesmärk: täpsustada töökorralduslik ohutus, suhtluskanalid, üksi töötamise piirid ja järelkontaktid.",
    `Ohu seis: ${wellbeingLabel(fields.dangerStatus)}.`,
    `Mõju turvatundele: ${wellbeingLabel(fields.safetyImpact)}.`,
    `Järgmise sammu vajadus: ${wellbeingLabel(fields.nextStepNeed)}.`,
    "Kokkuleppe ettepanek: leppida kokku, kes kontrollib ohutust, millal kasutatakse teist kanalit ja millal kaasatakse juht või kolleeg."
  ].join("\n");

  const managerMemo = [
    "Juhiga arutelu memo",
    "",
    "Soovin arutada töövägivalla olukorra järeltegevust töökorralduslikult, ilma kliendiandmeid või liigseid detaile jagamata.",
    `Olukorra liik: ${wellbeingLabel(fields.violenceType)}.`,
    `Ohu seis: ${wellbeingLabel(fields.dangerStatus)}.`,
    `Vajalik järgmine samm: ${wellbeingLabel(fields.nextStepNeed)}.`,
    `Turvalisuse kokkulepe: ${wellbeingLabel(fields.safetyAgreementNeed)}.`
  ].join("\n");

  const covisionInput = [
    "Kovisiooni sisend",
    "",
    "Teema: töövägivald või ohustav olukord",
    `Olukorra üldistatud kirjeldus: ${text(fields.generalizedDescription, "täpsustada üldistatult, ilma tuvastatavate detailideta.")}`,
    "Minu keskne küsimus: milline tööalane tugi, piir või ohutuskokkulepe aitaks olukorda professionaalselt ja turvaliselt käsitleda?",
    `Riskid või tähelepanu vajavad kohad: ${wellbeingInlineList(result.riskMarkers, "ei märgitud")}.`,
    "Mida soovin kovisioonis arutada: kuidas hoida turvalisust, rollipiire ja taastumist pärast töövägivalla olukorda."
  ].join("\n");

  const workArrangementRecommendation = [
    "Töökorralduse muutmise soovitus",
    "",
    "Vaata üle üksi töötamise, kodukülastuse, suhtluskanalite või korduva kontakti kokkulepped.",
    `Prioriteet: ${wellbeingLabel(result.signalLevel)}.`,
    `Soovitatud järgmine samm: ${wellbeingLabel(fields.nextStepNeed)}.`
  ].join("\n");

  if (!internal) {
    return {
      neutralIncidentDescription,
      safetyAgreementInput,
      managerMemo,
      covisionInput,
      workArrangementRecommendation,
      internalReport: null
    };
  }

  /* Kolleeg või juht: kliendikesksed tekstid (ohutuskokkulepe, töökorraldus,
     kovisioon) jäävad ära. Juhi puhul ei ole juhimemo vaiketee — juht võib olla
     osapool —, seega on pöördumise mustand, mille adressaadi valib töötaja.
     Adressaatide loetelu ootab asjatundja ülevaatust (arendusettepanek ptk 8.8). */
  const internalReport = [
    "Pöördumine ebaväärika kohtlemise kohta töökohal",
    "",
    "Kellele: kõrgem juht, personalitöötaja või töökeskkonnavolinik (vali, kellele saadad).",
    "Soovin teada anda ebaväärikast kohtlemisest töökohal ja arutada, kuidas olukord lahendada.",
    `Olukorra liik: ${wellbeingLabel(fields.violenceType)}.`,
    `Kellelt: ${wellbeingLabel(fields.sourceOfHarm)}.`,
    `Mõju tööle: ${wellbeingLabel(fields.workImpact)}; mõju turvatundele: ${wellbeingLabel(fields.safetyImpact)}.`,
    `Üldistatud kirjeldus: ${text(fields.generalizedDescription, "kirjelda toimunut neutraalselt: mis juhtus ja millal.")}`,
    "Mul on toimunu kohta kuupäevadega märkmed ja saan neid kohtumisel tutvustada.",
    "Palun lepime kokku kohtumise aja."
  ].join("\n");

  const colleagueMemo = [
    "Juhiga arutelu memo",
    "",
    "Soovin arutada kolleegi käitumist, mis on mõjutanud minu tööd ja turvatunnet, ning kokku leppida, kuidas olukorda lahendada.",
    `Olukorra liik: ${wellbeingLabel(fields.violenceType)}.`,
    `Mõju tööle: ${wellbeingLabel(fields.workImpact)}; mõju turvatundele: ${wellbeingLabel(fields.safetyImpact)}.`,
    "Palun lepime kokku järgmise sammu ja selle, millal olukorda uuesti arutame."
  ].join("\n");

  return {
    neutralIncidentDescription,
    safetyAgreementInput: null,
    managerMemo: fields.sourceOfHarm === "colleague" ? colleagueMemo : null,
    covisionInput: null,
    workArrangementRecommendation: null,
    internalReport
  };
}

export function buildWorkplaceViolenceRecord({ period = null, roleGroup = null, standardizedFields = {} } = {}) {
  const computed = computeWorkplaceViolenceResult(standardizedFields);

  return {
    schemaVersion: WORKPLACE_VIOLENCE_SCHEMA_VERSION,
    scoringVersion: WORKPLACE_VIOLENCE_SCORING_VERSION,
    workflowType: "workplace-violence",
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
    /* Kolleegilt või juhilt tulnud kohtlemine ei osale koondis üldse: väikeses
       meeskonnas osutaks ta ühele inimesele ja võiks paljastada teataja
       (arendusettepanek ptk 8.2 p 3). Parandus ehitab kirje sama builderiga,
       seega jääb piir ka parandusele. */
    aggregationEligible: !isInternalViolenceSource(standardizedFields)
  };
}
