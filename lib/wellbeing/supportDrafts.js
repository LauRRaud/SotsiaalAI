import { prisma as defaultPrisma } from "../prisma.js";
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

function requireUserId(userId) {
  const normalized = String(userId || "").trim();
  if (!normalized) {
    const error = new Error("wellbeing.errors.unauthorized");
    error.status = 401;
    throw error;
  }
  return normalized;
}

function assertAllowed(value, allowed, message) {
  const normalized = String(value || "").trim();
  if (!allowed.includes(normalized)) {
    const error = new Error(message);
    error.status = 400;
    throw error;
  }
  return normalized;
}

function normalizeTake(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 20;
  return Math.min(Math.max(Math.trunc(number), 1), 50);
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
  const normalizedOutputType = assertAllowed(outputType, WELLBEING_OUTPUT_TYPES, "wellbeing.errors.invalid_output_type");
  const normalizedRecipientType = assertAllowed(recipientType, WELLBEING_RECIPIENT_TYPES, "wellbeing.errors.invalid_recipient_type");
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

export async function createWellbeingOutputDraftForUser(userId, payload = {}, options = {}) {
  const normalizedUserId = requireUserId(userId);
  const prisma = options.prisma || defaultPrisma;
  const draft = buildWellbeingShareableDraft(payload);

  return prisma.wellbeingOutputDraft.create({
    data: {
      userId: normalizedUserId,
      schemaVersion: draft.schemaVersion,
      sourceWorkflowType: draft.sourceWorkflowType,
      sourceRecordId: draft.sourceRecordId,
      outputType: draft.outputType,
      recipientType: draft.recipientType,
      generatedText: draft.generatedText,
      editedText: draft.editedText,
      userReviewed: draft.userReviewed,
      userConfirmed: draft.userConfirmed,
      visibility: draft.visibility,
      status: draft.status
    }
  });
}

export async function listWellbeingOutputDraftsForUser(userId, filters = {}, options = {}) {
  const normalizedUserId = requireUserId(userId);
  const prisma = options.prisma || defaultPrisma;
  const outputType = String(filters.outputType || "").trim();
  const recipientType = String(filters.recipientType || "").trim();

  return prisma.wellbeingOutputDraft.findMany({
    where: {
      userId: normalizedUserId,
      ...(WELLBEING_OUTPUT_TYPES.includes(outputType) ? { outputType } : {}),
      ...(WELLBEING_RECIPIENT_TYPES.includes(recipientType) ? { recipientType } : {})
    },
    orderBy: { createdAt: "desc" },
    take: normalizeTake(filters.take)
  });
}

export async function confirmWellbeingOutputDraftForUser(userId, draftId, payload = {}, options = {}) {
  const normalizedUserId = requireUserId(userId);
  const normalizedDraftId = String(draftId || "").trim();
  if (!normalizedDraftId) {
    const error = new Error("wellbeing.errors.output_draft_missing");
    error.status = 400;
    throw error;
  }

  if (!payload.userReviewed || !payload.userConfirmed) {
    const error = new Error("wellbeing.errors.output_review_required");
    error.status = 400;
    throw error;
  }

  const prisma = options.prisma || defaultPrisma;
  const update = await prisma.wellbeingOutputDraft.updateMany({
    where: {
      id: normalizedDraftId,
      userId: normalizedUserId
    },
    data: {
      editedText: typeof payload.editedText === "string" ? payload.editedText : undefined,
      userReviewed: true,
      userConfirmed: true,
      status: "ready_to_share",
      visibility: "private"
    }
  });

  if (update.count !== 1) {
    const error = new Error("wellbeing.errors.output_draft_not_found");
    error.status = 404;
    throw error;
  }

  return prisma.wellbeingOutputDraft.findFirst({
    where: {
      id: normalizedDraftId,
      userId: normalizedUserId
    }
  });
}
