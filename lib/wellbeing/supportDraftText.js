import { formatQuickCheckFactor } from "./quickCheck.js";
import { wellbeingLabel } from "./displayLabels.js";

export const WELLBEING_OUTPUT_TYPES = Object.freeze([
  "personal_summary",
  "manager_memo",
  "support_request",
  "covision_input",
  "redistribution_proposal",
  "boundary_agreement"
]);

export const WELLBEING_RECIPIENT_TYPES = Object.freeze([
  "manager",
  "pilot_support_contact",
  "supervisor",
  "covision",
  "other"
]);

const workflowLabels = {
  "quick-check": "Kiirkontroll",
  overview: "Ülevaade",
  "hard-case": "Raske juhtum",
  "workplace-violence": "Töövägivald",
  recovery: "Taastumine",
  "work-boundaries": "Tööpiirid",
  interruptions: "Katkestused",
  "work-processes": "Tööprotsessid",
  "role-boundaries": "Rollipiirid",
  "starter-support": "Alustaja tugi"
};

const outputTitles = {
  manager_memo: "Juhiga arutelu memo",
  support_request: "Abipalve",
  covision_input: "Kovisiooni sisend",
  redistribution_proposal: "Töö ümberjagamise ettepanek",
  boundary_agreement: "Tööpiiride kokkuleppe mustand",
  personal_summary: "Isiklik kokkuvõte"
};

export function assertAllowedWellbeingDraftValue(value, allowed, message) {
  const normalized = String(value || "").trim();
  if (!allowed.includes(normalized)) {
    const error = new Error(message);
    error.status = 400;
    throw error;
  }
  return normalized;
}

function factorLines(title, values = []) {
  const items = values.filter(Boolean);
  if (!items.length) return [`${title}: ei märgitud.`];
  return [
    `${title}:`,
    ...items.map((item) => {
      const quickCheckLabel = formatQuickCheckFactor(item);
      return `- ${quickCheckLabel === item ? wellbeingLabel(item) : quickCheckLabel}`;
    })
  ];
}

function actionLines(actions = []) {
  const items = actions
    .map((action) => action?.label || action?.workflowType)
    .filter(Boolean);
  if (!items.length) return ["Soovitud arutelu: täpsustada järgmine töökorralduslik samm."];
  return [
    "Soovitud arutelu:",
    ...items.map((item) => `- ${item}`)
  ];
}

function buildGeneratedText({ sourceWorkflowType, outputType, context = {} }) {
  const title = outputTitles[outputType] || "Jagatav töötoe mustand";
  const workflowTitle = workflowLabels[sourceWorkflowType] || sourceWorkflowType || "Tööheaolu";
  const signal = wellbeingLabel(context?.computedSignal?.signalLevel);

  if (outputType === "covision_input") {
    return [
      "Kovisiooni sisend",
      "",
      `Teema: ${workflowTitle}`,
      "Olukorra üldistatud kirjeldus: Tööheaolu töövoog näitab töökorralduslikku koormust, mida soovin kolleegidega arutada.",
      "Minu keskne küsimus: milline järgmine töökorralduslik samm aitaks koormust vähendada või tuge paremini kokku leppida?",
      "Mis teeb olukorra keeruliseks: signaal ja korduvad tegurid vajavad koos mõtestamist.",
      ...factorLines("Peamised tööalased koormustegurid", context.loadFactors),
      ...factorLines("Riskid või tähelepanu vajavad kohad", context.riskMarkers),
      ...factorLines("Kaitsetegurid või olemasolevad tugevused", context.resourceFactors),
      ...actionLines(context.recommendedActions),
      "Mida soovin kovisioonis arutada: milline tugi, piir või töövoo muudatus oleks realistlik järgmine samm."
    ].join("\n");
  }

  return [
    title,
    "",
    `Lähtekoht: ${workflowTitle}`,
    `Üldine signaal: ${signal}`,
    "Soovin arutada töökorralduslikku tuge nii, et toorandmeid, kliendiandmeid ega privaatseid märkmeid ei jagata.",
    ...factorLines("Peamised koormustegurid", context.loadFactors),
    ...factorLines("Puuduvad või nõrgad ressursid", context.resourceFactors),
    ...factorLines("Tähelepanu vajavad kohad", context.riskMarkers),
    ...actionLines(context.recommendedActions),
    "Palun lepime kokku ühe konkreetse järgmise sammu ja aja, millal kokkulepe üle vaadata."
  ].join("\n");
}

export function buildWellbeingShareableDraft({
  sourceWorkflowType,
  sourceRecordId = null,
  outputType,
  recipientType,
  context = {},
  generatedText = ""
} = {}) {
  const normalizedOutputType = assertAllowedWellbeingDraftValue(outputType, WELLBEING_OUTPUT_TYPES, "wellbeing.errors.invalid_output_type");
  const normalizedRecipientType = assertAllowedWellbeingDraftValue(recipientType, WELLBEING_RECIPIENT_TYPES, "wellbeing.errors.invalid_recipient_type");
  const normalizedWorkflowType = String(sourceWorkflowType || "").trim() || "quick-check";

  return {
    schemaVersion: "1.0",
    sourceWorkflowType: normalizedWorkflowType,
    sourceRecordId: sourceRecordId ? String(sourceRecordId) : null,
    outputType: normalizedOutputType,
    recipientType: normalizedRecipientType,
    generatedText: String(generatedText || "").trim() || buildGeneratedText({
      sourceWorkflowType: normalizedWorkflowType,
      outputType: normalizedOutputType,
      context
    }),
    editedText: null,
    userReviewed: false,
    userConfirmed: false,
    visibility: "private",
    status: "draft"
  };
}
