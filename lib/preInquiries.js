import { prisma } from "@/lib/prisma";
import { getMailer, resolveBaseUrl } from "@/lib/mailer";
import { buildPreInquiryAssessment } from "./preInquiriesAssessment.js";
import {
  normalizePreInquiryReceiverChecklist,
  normalizePreInquiryReceiverNote
} from "./preInquiryReceiverWorkflow.js";
import {
  buildPreInquiryRoutingConfidence,
  explainPreInquiryRecipientMatch
} from "./preInquiryRouting.js";
import {
  buildPreInquiryAssessmentDraftSummary,
  buildPreInquiryAssessmentExportText,
  buildPreInquiryAssessmentSituation,
  normalizePreInquiryAssessmentState
} from "./preInquiriesQuestionnaire.js";
import {
  evaluateTextPrivacy,
  privacyConfirmationResponsePayload
} from "./privacy/privacyGuard.js";

const PRE_INQUIRY_RECIPIENT_TYPES = Object.freeze([
  "KOV_CONTACT",
  "SERVICE_PROVIDER"
]);

const PRE_INQUIRY_STATUSES = Object.freeze([
  "DRAFT",
  "READY",
  "SENT",
  "DOWNLOADED",
  "ARCHIVED"
]);

const MAX_SHORT_TEXT_LENGTH = 1_000;
const MAX_TEXT_LENGTH = 12_000;
const ASSIST_STOP_WORDS = new Set([
  "ning",
  "olen",
  "oleme",
  "vajan",
  "vajab",
  "palun",
  "soovin",
  "kuidas",
  "kuhu",
  "mida",
  "kelle",
  "poole",
  "pöörduda",
  "poorduda",
  "minu",
  "tema",
  "meie",
  "selle",
  "kohta"
]);

const NEED_AREA_RULES = Object.freeze([
  ["tervis ja liikumine", ["tervis", "liikum", "puue", "ravim", "haigus", "abivahend"]],
  ["vaimne tervis, mälu või toimetulek", ["vaimne", "ärevus", "depress", "mälu", "dements", "toimetulek"]],
  ["igapäevaelu toimingud", ["igapäev", "pesemine", "söömine", "korist", "koduteenus", "hooldus"]],
  ["eluase ja elukeskkond", ["eluase", "üür", "korter", "kodutu", "elukoht"]],
  ["rahaasjad ja toimetulek", ["raha", "võlg", "toimetulek", "sissetulek", "arve", "elamiskulu"]],
  ["töö, õppimine või hõive", ["töö", "töötu", "õpp", "hõive", "töötukassa"]],
  ["suhted ja tugivõrgustik", ["üksinda", "lähedane", "tugivõrg", "pere", "suhe"]],
  ["hoolduskoormus", ["hooldan", "hooldaja", "hoolduskoorm", "lähedase hooldus"]],
  ["laps ja pere", ["laps", "pere", "vanem", "kool", "laste"]],
  ["turvalisus, vägivald või muu oht", ["oht", "vägivald", "turvalis", "kiire", "häda", "ähvard"]]
]);

const URGENT_KEYWORDS = Object.freeze([
  "oht",
  "vägivald",
  "häda",
  "kiire",
  "ähvard",
  "turvalis",
  "enesetapp",
  "kriis"
]);

const preInquiryInclude = {
  recipientEntry: true,
  author: {
    select: {
      id: true,
      email: true,
      role: true
    }
  },
  recipientOwner: {
    select: {
      id: true,
      email: true,
      role: true
    }
  }
};

function normalizeText(value, maxLength = MAX_SHORT_TEXT_LENGTH) {
  const normalized = String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function normalizeRequiredText(value, fieldName, maxLength = MAX_TEXT_LENGTH) {
  const normalized = normalizeText(value, maxLength);
  if (!normalized) {
    const error = new Error(`pre_inquiries.errors.${fieldName}_required`);
    error.status = 400;
    throw error;
  }
  return normalized;
}

function normalizeEnum(value, values, fallback) {
  const normalized = String(value || "").trim().toUpperCase();
  return values.includes(normalized) ? normalized : fallback;
}

function hasAssessmentState(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sanitizeAssessmentStateStrings(value, privacyDecision) {
  if (typeof value === "string") {
    return evaluateTextPrivacy(value, {
      workflow: "pre_inquiry",
      privacyDecision
    }).processedText;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAssessmentStateStrings(item, privacyDecision));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sanitizeAssessmentStateStrings(item, privacyDecision)
      ])
    );
  }
  return value;
}

function inferRecipientType(entry, inputType) {
  const normalizedInput = normalizeEnum(inputType, PRE_INQUIRY_RECIPIENT_TYPES, "");
  if (normalizedInput) return normalizedInput;
  return entry?.type === "SERVICE_PROVIDER" ? "SERVICE_PROVIDER" : "KOV_CONTACT";
}

function buildDraft({ topic, situation, assessmentSummary = "", recipientName, recipientEmail, recipientType = "KOV_CONTACT" }) {
  const subject = topic || "Eelpöördumine";
  const greeting = recipientName ? `Lugupeetud ${recipientName}` : "Tere";
  const details = [
    situation,
    assessmentSummary
  ].map((value) => String(value || "").trim()).filter(Boolean).join("\n\n");
  const requestLine = recipientType === "SERVICE_PROVIDER"
    ? "Palun andke teada, kas teie teenus võiks sellises olukorras sobida, millised on tingimused, vabad ajad ja kas teenus eeldab KOV-i, SKA või muu asutuse otsust või suunamist."
    : "Palun aidata välja selgitada, millised toetused või teenused võiksid minu olukorras sobida ning millised oleksid järgmised sammud.";
  const lines = [
    greeting,
    "",
    `Soovin pöörduda teemal: ${subject}.`,
    "",
    "Olukorra lühikokkuvõte ja eelkaardistus:",
    details,
    "",
    requestLine,
    "",
    "Lugupidamisega"
  ];

  if (!recipientName && recipientEmail) {
    lines.splice(
      2,
      0,
      `Adressaat: ${recipientEmail}`,
      ""
    );
  }

  return lines.join("\n").slice(0, MAX_TEXT_LENGTH);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractAssistKeywords(...values) {
  const text = values
    .map((value) => String(value || ""))
    .join(" ")
    .toLocaleLowerCase("et")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ");
  const result = [];
  const seen = new Set();
  for (const word of text.split(/\s+/)) {
    const normalized = word.trim();
    if (normalized.length < 4 || ASSIST_STOP_WORDS.has(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= 12) break;
  }
  return result;
}

function scoreEntry(entry, keywords, preferredType) {
  const haystack = [
    entry.title,
    entry.description,
    entry.address,
    entry.municipalityName,
    entry.county,
    entry.providerProfile?.organizationName,
    entry.providerProfile?.serviceArea,
    ...(entry.providerProfile?.services || []),
    ...(entry.providerProfile?.serviceCategories || []),
    ...(entry.providerProfile?.targetGroups || []),
    ...(entry.providerProfile?.serviceItems || []).flatMap((service) => [
      service?.name,
      service?.description,
      service?.category,
      service?.priceDescription,
      service?.serviceArea,
      ...(service?.targetGroups || [])
    ])
  ].join(" ").toLocaleLowerCase("et");
  let score = 0;
  if (preferredType && entry.type === preferredType) score += 4;
  if (entry.email) score += 2;
  if (entry.phone) score += 1;
  for (const keyword of keywords) {
    if (haystack.includes(keyword)) score += 3;
  }
  return score;
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function buildAssessmentDraftSummary(assessment = {}) {
  const lines = [];
  if (assessment.lifeDomains?.length) {
    lines.push(`Puudutatud eluvaldkonnad: ${assessment.lifeDomains.join(", ")}.`);
  }
  if (assessment.targetGroups?.length) {
    lines.push(`Sihtrühmad ja rollid: ${assessment.targetGroups.join(", ")}.`);
  }
  if (assessment.clarifyingQuestions?.length) {
    lines.push("Kohtumisel või vastuses täpsustada:");
    lines.push(...assessment.clarifyingQuestions.slice(0, 4).map((question) => `- ${question}`));
  }
  return lines.join("\n");
}

function buildAssistantDraft({ topic, situation, assistantMessage, recipient, assessment }) {
  const assessmentSummary = buildAssessmentDraftSummary(assessment);
  const details = [situation, assistantMessage, assessmentSummary].filter(Boolean).join("\n\n");
  return buildDraft({
    topic,
    situation: details || situation || assistantMessage || "",
    recipientName: recipient?.title,
    recipientEmail: recipient?.email,
    recipientType: recipient?.type === "SERVICE_PROVIDER" ? "SERVICE_PROVIDER" : "KOV_CONTACT"
  });
}

function detectNeedAreas(...values) {
  const text = values
    .map((value) => String(value || ""))
    .join(" ")
    .toLocaleLowerCase("et");
  const detected = [];
  for (const [label, keywords] of NEED_AREA_RULES) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      detected.push(label);
    }
  }
  return detected.length ? detected : ["muu"];
}

function detectUrgencyLevel(...values) {
  const text = values
    .map((value) => String(value || ""))
    .join(" ")
    .toLocaleLowerCase("et");
  return URGENT_KEYWORDS.some((keyword) => text.includes(keyword)) ? "URGENT" : "NORMAL";
}

function summarizeSituation(...values) {
  const text = values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join("\n\n");
  if (!text) return "";
  return text.length > 900 ? `${text.slice(0, 897).trim()}...` : text;
}

function throwPrivacyConfirmation(result) {
  const error = new Error("privacy.confirmation_required");
  error.status = 409;
  error.privacyPayload = privacyConfirmationResponsePayload(result);
  throw error;
}

function evaluatePreInquiryPrivacy(input, privacyDecision) {
  const assessmentText = hasAssessmentState(input.assessmentState)
    ? buildPreInquiryAssessmentExportText(input.assessmentState)
    : "";
  const combinedText = [
    input.topic,
    input.situation,
    input.generatedDraft,
    input.userEditedDraft,
    assessmentText
  ].filter(Boolean).join("\n\n");
  const result = evaluateTextPrivacy(combinedText, {
    workflow: "pre_inquiry",
    privacyDecision
  });
  if (result.needsPrivacyConfirmation) {
    throwPrivacyConfirmation(result);
  }

  const apply = (value) => evaluateTextPrivacy(value, {
    workflow: "pre_inquiry",
    privacyDecision
  }).processedText;

  return {
    topic: apply(input.topic),
    situation: apply(input.situation),
    generatedDraft: apply(input.generatedDraft),
    userEditedDraft: apply(input.userEditedDraft),
    assessmentState: hasAssessmentState(input.assessmentState)
      ? sanitizeAssessmentStateStrings(input.assessmentState, privacyDecision)
      : null
  };
}

function inferSuggestedNextSteps({ suggestions, preferredRecipientType }) {
  const hasKov = suggestions.some((entry) => entry.type !== "SERVICE_PROVIDER");
  const hasProvider = suggestions.some((entry) => entry.type === "SERVICE_PROVIDER");
  if (preferredRecipientType === "SERVICE_PROVIDER" && hasProvider && !hasKov) return "SERVICE_PROVIDER";
  if (preferredRecipientType === "KOV_CONTACT" && hasKov && !hasProvider) return "KOV";
  if (hasKov && hasProvider) return "BOTH";
  if (hasProvider) return "SERVICE_PROVIDER";
  return "KOV";
}

function buildReasoningText(nextSteps) {
  if (nextSteps === "ASK_DETAILS") {
    return "Eelkaardistus algab lühikese küsimustikuna. Kontaktid ja mustand pakutakse alles siis, kui on teada vähemalt olukorra sisu, piirkond või soovitud pöördumise suund.";
  }
  if (nextSteps === "CRISIS") {
    return "Kirjelduses võib olla vahetu ohu või kriisi tunnuseid. Tavalise eelpöördumise kõrval tuleb eelistada kiiret abi: vahetu ohu korral 112 ning vajadusel kriisiabi või ohvriabi.";
  }
  if (nextSteps === "CHILD_PROTECTION") {
    return "Kirjeldus puudutab lapse või pere heaolu. Sellisel juhul peab pöördumise suund olema KOV lastekaitse või lapse heaolu kontakt, mitte üldine sotsiaalhoolekanne.";
  }
  if (nextSteps === "SERVICE_PROVIDER") {
    return "Selle teema puhul võib olla mõistlik küsida infot otse teenuseosutajalt. Kui teenus eeldab KOV-i, SKA või muu asutuse otsust või suunamist, tuleb see eraldi täpsustada.";
  }
  if (nextSteps === "BOTH") {
    return "Võid pöörduda KOV-i poole abi või teenuse määramise küsimuses ning samal ajal küsida teenuseosutajalt infot teenuse tingimuste ja sobivuse kohta.";
  }
  return "Sinu kirjeldus võib vajada kohaliku omavalitsuse sotsiaalvaldkonna spetsialisti abi, sest abi saamiseks võib olla vaja ametlikku abivajaduse väljaselgitamist või otsust.";
}

function buildPreInquiryAssistantMessage({
  suggestions,
  situationSummary,
  normalizedMunicipality,
  detectedUrgencyLevel,
  suggestedNextSteps
}) {
  if (suggestedNextSteps === "ASK_DETAILS") {
    return "Alustame eelkaardistust. Vastuste põhjal saab hiljem koostada pöördumise mustandi ja pakkuda sobivat KOV kontakti või teenuseosutajat.";
  }

  const missing = [];
  const summary = String(situationSummary || "").trim();
  if (!summary || summary.length < 80) {
    missing.push("olukorra lühike taust");
  }
  if (!normalizedMunicipality) {
    missing.push("omavalitsus või piirkond");
  }
  if (!detectedUrgencyLevel) {
    missing.push("kas olukord on kiireloomuline");
  }

  const target =
    suggestedNextSteps === "CRISIS"
      ? "kriisiabi või hädaabi suunda"
      : suggestedNextSteps === "CHILD_PROTECTION"
        ? "KOV lastekaitse või lapse heaolu kontakti"
        : suggestedNextSteps === "BOTH"
          ? "KOV-i kontakti ja teenuseosutajat"
          : suggestedNextSteps === "SERVICE_PROVIDER"
            ? "teenuseosutajat"
            : "KOV-i sotsiaalvaldkonna kontakti";
  const firstSentence = suggestions.length
    ? `Kaardistasin kirjelduse eelpöördumise jaoks ja pakkusin sobivat adressaati: ${target}.`
    : "Kaardistasin kirjelduse eelpöördumise jaoks, kuid sobivat adressaati ei leidnud veel struktureeritud kontaktidest.";
  const clarify = missing.length
    ? `Täpsustamiseks lisa võimalusel: ${missing.slice(0, 3).join(", ")}.`
    : "Kontrolli adressaati ja mustandit enne salvestamist või jagamist.";
  return `${firstSentence} ${clarify}`;
}

async function resolveRecipient(input = {}) {
  const recipientEntryId = normalizeText(input.recipientEntryId);
  const selectedRecipientEmail = normalizeText(input.selectedRecipientEmail)?.toLowerCase() || null;
  const explicitRecipientName = normalizeText(input.selectedRecipientName);

  let recipientEntry = null;
  if (recipientEntryId) {
    recipientEntry = await prisma.serviceMapEntry.findUnique({
      where: { id: recipientEntryId },
      include: {
        providerProfile: {
          select: {
            ownerId: true,
            organizationName: true,
            acceptsPlatformPreInquiries: true,
            acceptsEmailPreInquiries: true
          }
        }
      }
    });
  }

  const recipientType = inferRecipientType(recipientEntry, input.recipientType);
  const selectedRecipientName =
    explicitRecipientName ||
    recipientEntry?.title ||
    recipientEntry?.providerProfile?.organizationName ||
    null;
  const recipientEmail = selectedRecipientEmail || recipientEntry?.email || null;
  const matchedRecipientOwner = recipientEmail
    ? await prisma.user.findUnique({
        where: { email: recipientEmail },
        select: {
          id: true,
          acceptsPreInquiries: true
        }
      })
    : null;
  const providerAcceptsPlatform =
    recipientEntry?.type === "SERVICE_PROVIDER" &&
    recipientEntry?.providerProfile?.acceptsPlatformPreInquiries !== false;
  const matchedUserAcceptsPlatform = Boolean(matchedRecipientOwner?.acceptsPreInquiries);
  const recipientOwnerId =
    providerAcceptsPlatform && recipientEntry?.providerProfile?.ownerId
      ? recipientEntry.providerProfile.ownerId
      : matchedUserAcceptsPlatform
        ? matchedRecipientOwner.id
        : null;
  const deliveryChannel = recipientOwnerId ? "INTERNAL" : "EXTERNAL_EMAIL";

  return {
    recipientEntry,
    recipientType,
    selectedRecipientEmail: recipientEmail,
    selectedRecipientName,
    recipientOwnerId,
    deliveryChannel
  };
}

export function serializePreInquiry(inquiry) {
  if (!inquiry) return null;
  return {
    id: inquiry.id,
    authorId: inquiry.authorId,
    recipientOwnerId: inquiry.recipientOwnerId,
    recipientEntryId: inquiry.recipientEntryId,
    recipientType: inquiry.recipientType,
    deliveryChannel: inquiry.deliveryChannel,
    selectedRecipientEmail: inquiry.selectedRecipientEmail,
    selectedRecipientName: inquiry.selectedRecipientName,
    topic: inquiry.topic,
    situation: inquiry.situation,
    assessmentState: inquiry.assessmentState || null,
    generatedDraft: inquiry.generatedDraft,
    userEditedDraft: inquiry.userEditedDraft,
    receiverNote: inquiry.receiverNote || "",
    receiverChecklist: normalizePreInquiryReceiverChecklist(inquiry.receiverChecklist, inquiry),
    status: inquiry.status,
    sentAt: inquiry.sentAt,
    externalSendConfirmedAt: inquiry.externalSendConfirmedAt,
    createdAt: inquiry.createdAt,
    updatedAt: inquiry.updatedAt,
    recipientEntry: inquiry.recipientEntry
      ? {
          id: inquiry.recipientEntry.id,
          type: inquiry.recipientEntry.type,
          title: inquiry.recipientEntry.title,
          address: inquiry.recipientEntry.address,
          phone: inquiry.recipientEntry.phone,
          email: inquiry.recipientEntry.email,
          website: inquiry.recipientEntry.website,
          providerProfileId: inquiry.recipientEntry.providerProfileId
        }
      : null,
    author: inquiry.author
      ? {
          id: inquiry.author.id,
          email: inquiry.author.email,
          role: inquiry.author.role
        }
      : null,
    recipientOwner: inquiry.recipientOwner
      ? {
          id: inquiry.recipientOwner.id,
          email: inquiry.recipientOwner.email,
          role: inquiry.recipientOwner.role
        }
      : null
  };
}

function visiblePreInquiryWhere(userId) {
  return {
    OR: [
      { authorId: userId },
      { recipientOwnerId: userId }
    ]
  };
}

export async function listVisiblePreInquiries(userId, { limit = 100 } = {}) {
  if (!userId) return [];
  const take = Math.max(1, Math.min(Number(limit) || 100, 250));

  const inquiries = await prisma.preInquiry.findMany({
    where: visiblePreInquiryWhere(userId),
    take,
    orderBy: { updatedAt: "desc" },
    include: preInquiryInclude
  });

  return inquiries.map(serializePreInquiry);
}

export async function getVisiblePreInquiry(userId, inquiryId) {
  if (!userId || !inquiryId) return null;
  const inquiry = await prisma.preInquiry.findFirst({
    where: {
      id: inquiryId,
      ...visiblePreInquiryWhere(userId)
    },
    include: preInquiryInclude
  });
  return inquiry;
}

export async function createPreInquiry(userId, input = {}) {
  if (!userId) {
    const error = new Error("api.common.unauthorized");
    error.status = 401;
    throw error;
  }

  const assessmentState = hasAssessmentState(input.assessmentState)
    ? normalizePreInquiryAssessmentState(input.assessmentState)
    : null;
  const assessmentSituation = assessmentState ? buildPreInquiryAssessmentSituation(assessmentState) : "";
  const assessmentDraftSummary = assessmentState ? buildPreInquiryAssessmentDraftSummary(assessmentState) : "";
  const situation = normalizeRequiredText(input.situation || assessmentSituation, "situation");
  const topic = normalizeText(input.topic);
  const status = normalizeEnum(input.status, PRE_INQUIRY_STATUSES, "DRAFT");
  const recipient = await resolveRecipient(input);
  if (status === "SENT" && recipient.deliveryChannel !== "INTERNAL") {
    const error = new Error("pre_inquiries.errors.internal_recipient_required");
    error.status = 400;
    throw error;
  }
  const generatedDraft = normalizeText(input.generatedDraft, MAX_TEXT_LENGTH) || buildDraft({
    topic,
    situation,
    assessmentSummary: assessmentDraftSummary,
    recipientName: recipient.selectedRecipientName,
    recipientEmail: recipient.selectedRecipientEmail,
    recipientType: recipient.recipientType
  });
  const userEditedDraft = normalizeText(input.userEditedDraft, MAX_TEXT_LENGTH) || generatedDraft;
  const privacySafe = evaluatePreInquiryPrivacy({
    topic,
    situation,
    generatedDraft,
    userEditedDraft,
    assessmentState
  }, input.privacyDecision);

  const inquiry = await prisma.preInquiry.create({
    data: {
      authorId: userId,
      recipientOwnerId: recipient.recipientOwnerId,
      recipientEntryId: recipient.recipientEntry?.id || null,
      recipientType: recipient.recipientType,
      deliveryChannel: recipient.deliveryChannel,
      selectedRecipientEmail: recipient.selectedRecipientEmail,
      selectedRecipientName: recipient.selectedRecipientName,
      topic: normalizeText(privacySafe.topic),
      situation: normalizeRequiredText(privacySafe.situation, "situation"),
      assessmentState: privacySafe.assessmentState,
      generatedDraft: normalizeText(privacySafe.generatedDraft, MAX_TEXT_LENGTH) || generatedDraft,
      userEditedDraft: normalizeText(privacySafe.userEditedDraft, MAX_TEXT_LENGTH) || userEditedDraft,
      status
    },
    include: preInquiryInclude
  });

  return serializePreInquiry(inquiry);
}

export async function updatePreInquiry(userId, inquiryId, input = {}) {
  const existing = await getVisiblePreInquiry(userId, inquiryId);
  if (!existing) {
    const error = new Error("api.common.not_found");
    error.status = 404;
    throw error;
  }
  if (existing.authorId !== userId) {
    const error = new Error("api.common.forbidden");
    error.status = 403;
    throw error;
  }
  if (existing.status === "SENT") {
    const error = new Error("pre_inquiries.errors.sent_cannot_be_edited");
    error.status = 409;
    throw error;
  }

  const assessmentState = hasAssessmentState(input.assessmentState)
    ? normalizePreInquiryAssessmentState(input.assessmentState)
    : hasAssessmentState(existing.assessmentState)
      ? normalizePreInquiryAssessmentState(existing.assessmentState)
      : null;
  const assessmentSituation = assessmentState ? buildPreInquiryAssessmentSituation(assessmentState) : "";
  const assessmentDraftSummary = assessmentState ? buildPreInquiryAssessmentDraftSummary(assessmentState) : "";
  const situation = normalizeRequiredText(input.situation || existing.situation || assessmentSituation, "situation");
  const topic = normalizeText(input.topic ?? existing.topic);
  const recipient = await resolveRecipient({
    recipientEntryId: input.recipientEntryId ?? existing.recipientEntryId,
    recipientType: input.recipientType ?? existing.recipientType,
    selectedRecipientEmail: input.selectedRecipientEmail ?? existing.selectedRecipientEmail,
    selectedRecipientName: input.selectedRecipientName ?? existing.selectedRecipientName
  });
  const shouldRebuildGeneratedDraft = Boolean(input.assessmentState) || !existing.generatedDraft;
  const generatedDraft = normalizeText(input.generatedDraft, MAX_TEXT_LENGTH) || (shouldRebuildGeneratedDraft ? buildDraft({
    topic,
    situation,
    assessmentSummary: assessmentDraftSummary,
    recipientName: recipient.selectedRecipientName,
    recipientEmail: recipient.selectedRecipientEmail,
    recipientType: recipient.recipientType
  }) : existing.generatedDraft) || buildDraft({
    topic,
    situation,
    assessmentSummary: assessmentDraftSummary,
    recipientName: recipient.selectedRecipientName,
    recipientEmail: recipient.selectedRecipientEmail,
    recipientType: recipient.recipientType
  });
  const userEditedDraft = normalizeText(input.userEditedDraft, MAX_TEXT_LENGTH) || generatedDraft;
  const status = normalizeEnum(input.status, PRE_INQUIRY_STATUSES, existing.status || "DRAFT");
  if (status === "SENT" && recipient.deliveryChannel !== "INTERNAL") {
    const error = new Error("pre_inquiries.errors.internal_recipient_required");
    error.status = 400;
    throw error;
  }
  const privacySafe = evaluatePreInquiryPrivacy({
    topic,
    situation,
    generatedDraft,
    userEditedDraft,
    assessmentState
  }, input.privacyDecision);

  const inquiry = await prisma.preInquiry.update({
    where: { id: existing.id },
    data: {
      recipientOwnerId: recipient.recipientOwnerId,
      recipientEntryId: recipient.recipientEntry?.id || null,
      recipientType: recipient.recipientType,
      deliveryChannel: recipient.deliveryChannel,
      selectedRecipientEmail: recipient.selectedRecipientEmail,
      selectedRecipientName: recipient.selectedRecipientName,
      topic: normalizeText(privacySafe.topic),
      situation: normalizeRequiredText(privacySafe.situation, "situation"),
      assessmentState: privacySafe.assessmentState,
      generatedDraft: normalizeText(privacySafe.generatedDraft, MAX_TEXT_LENGTH) || generatedDraft,
      userEditedDraft: normalizeText(privacySafe.userEditedDraft, MAX_TEXT_LENGTH) || userEditedDraft,
      status
    },
    include: preInquiryInclude
  });

  return serializePreInquiry(inquiry);
}

export async function updatePreInquiryReceiverWorkflow(userId, inquiryId, input = {}) {
  const existing = await getVisiblePreInquiry(userId, inquiryId);
  if (!existing) {
    const error = new Error("api.common.not_found");
    error.status = 404;
    throw error;
  }
  if (existing.recipientOwnerId !== userId) {
    const error = new Error("api.common.forbidden");
    error.status = 403;
    throw error;
  }

  const nextStatus = normalizeEnum(input.status, ["READY", "ARCHIVED"], existing.status || "READY");
  const receiverNote = normalizePreInquiryReceiverNote(input.receiverNote);
  const receiverChecklist = normalizePreInquiryReceiverChecklist(input.receiverChecklist, existing);

  const inquiry = await prisma.preInquiry.update({
    where: { id: existing.id },
    data: {
      receiverNote,
      receiverChecklist,
      status: nextStatus
    },
    include: preInquiryInclude
  });

  return serializePreInquiry(inquiry);
}

export async function sendExternalPreInquiry(userId, inquiryId) {
  const existing = await getVisiblePreInquiry(userId, inquiryId);
  if (!existing) {
    const error = new Error("api.common.not_found");
    error.status = 404;
    throw error;
  }
  if (existing.authorId !== userId) {
    const error = new Error("api.common.forbidden");
    error.status = 403;
    throw error;
  }
  if (existing.deliveryChannel !== "EXTERNAL_EMAIL") {
    const error = new Error("pre_inquiries.errors.internal_cannot_email");
    error.status = 409;
    throw error;
  }
  if (!existing.selectedRecipientEmail) {
    const error = new Error("pre_inquiries.errors.recipient_email_required");
    error.status = 400;
    throw error;
  }
  if (existing.status === "SENT") {
    const error = new Error("pre_inquiries.errors.already_sent");
    error.status = 409;
    throw error;
  }

  const from = String(process.env.EMAIL_FROM || process.env.SMTP_FROM || "").trim();
  const hasSmtp = Boolean(process.env.EMAIL_SERVER || process.env.SMTP_HOST);
  if (!from || (process.env.NODE_ENV === "production" && !hasSmtp)) {
    const error = new Error("pre_inquiries.errors.email_not_configured");
    error.status = 503;
    throw error;
  }

  const subject = existing.topic ? `SotsiaalAI eelpöördumine: ${existing.topic}` : "SotsiaalAI eelpöördumine";
  const text = existing.userEditedDraft || existing.generatedDraft || existing.situation;
  const baseUrl = String(resolveBaseUrl() || "").replace(/\/+$/, "");
  const html = [
    `<p>${escapeHtml(text).replace(/\n/g, "<br />")}</p>`,
    baseUrl ? `<p><small>Koostatud SotsiaalAI platvormis: ${escapeHtml(baseUrl)}</small></p>` : ""
  ].filter(Boolean).join("\n");

  await getMailer("pre-inquiries").sendMail({
    to: existing.selectedRecipientEmail,
    from,
    replyTo: existing.author?.email || undefined,
    subject,
    text,
    html
  });

  const now = new Date();
  const inquiry = await prisma.preInquiry.update({
    where: { id: existing.id },
    data: {
      status: "SENT",
      sentAt: now,
      externalSendConfirmedAt: now
    },
    include: preInquiryInclude
  });

  return serializePreInquiry(inquiry);
}

export async function assistPreInquiry({
  topic = "",
  situation = "",
  assistantMessage = "",
  municipality = "",
  selectedNeedAreas = [],
  urgencyLevel = "",
  desiredRecipientType = "",
  recipientType = "",
  activeRole = "CLIENT",
  limit = 6
} = {}) {
  const normalizedTopic = normalizeText(topic);
  const normalizedSituation = normalizeText(situation, MAX_TEXT_LENGTH);
  const normalizedAssistantMessage = normalizeText(assistantMessage, MAX_TEXT_LENGTH);
  const normalizedMunicipality = normalizeText(municipality);
  const normalizedNeedAreas = Array.isArray(selectedNeedAreas)
    ? selectedNeedAreas.map((value) => normalizeText(value)).filter(Boolean)
    : [];
  const normalizedUrgencyLevel = normalizeText(urgencyLevel);
  const preferredRecipientType = normalizeEnum(
    desiredRecipientType || recipientType,
    PRE_INQUIRY_RECIPIENT_TYPES,
    ""
  );
  const keywords = extractAssistKeywords(
    normalizedTopic,
    normalizedSituation,
    normalizedAssistantMessage,
    normalizedMunicipality,
    normalizedNeedAreas.join(" ")
  );
  const preferredMapType =
    preferredRecipientType === "SERVICE_PROVIDER"
      ? "SERVICE_PROVIDER"
      : preferredRecipientType === "KOV_CONTACT"
        ? "KOV_SOCIAL_CONTACT"
        : "";

  const where = {
    status: { in: ["PUBLISHED", "NEEDS_REVIEW"] },
    ...(preferredMapType
      ? {
          type: preferredMapType === "KOV_SOCIAL_CONTACT"
            ? { in: ["KOV_SOCIAL_CONTACT", "KOV_GENERAL_CONTACT"] }
            : preferredMapType
        }
      : {})
  };

  const entries = await prisma.serviceMapEntry.findMany({
    where,
    take: 1500,
    orderBy: [{ type: "asc" }, { title: "asc" }],
    include: {
      providerProfile: {
        select: {
          id: true,
          ownerId: true,
          organizationName: true,
          shortDescription: true,
          services: true,
          serviceCategories: true,
          targetGroups: true,
          serviceArea: true,
          acceptsPlatformPreInquiries: true,
          acceptsEmailPreInquiries: true,
          serviceItems: {
            where: {
              mapVisible: true,
              status: "PUBLISHED"
            },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: {
              id: true,
              name: true,
              description: true,
              category: true,
              targetGroups: true,
              serviceArea: true,
              feeType: true,
              priceDescription: true,
              mapVisible: true,
              status: true
            }
          }
        }
      }
    }
  });

  const emails = [...new Set(entries.map((entry) => entry.email).filter(Boolean))];
  const usersByEmail = new Map();
  if (emails.length) {
    const users = await prisma.user.findMany({
      where: {
        email: { in: emails }
      },
      select: {
        id: true,
        email: true,
        acceptsPreInquiries: true
      }
    });
    for (const user of users) {
      if (user.email) usersByEmail.set(user.email.toLowerCase(), user);
    }
  }

  const suggestions = entries
    .map((entry) => {
      const providerAcceptsPlatform =
        entry.type === "SERVICE_PROVIDER" &&
        entry.providerProfile?.acceptsPlatformPreInquiries !== false;
      const providerAcceptsEmail =
        entry.type !== "SERVICE_PROVIDER" ||
        entry.providerProfile?.acceptsEmailPreInquiries !== false;
      const matchedUser = entry.email ? usersByEmail.get(entry.email.toLowerCase()) : null;
      const internalOwnerId =
        providerAcceptsPlatform && entry.providerProfile?.ownerId
          ? entry.providerProfile.ownerId
          : matchedUser?.acceptsPreInquiries
            ? matchedUser.id
            : null;
      const deliveryChannel = internalOwnerId ? "INTERNAL" : "EXTERNAL_EMAIL";
      const score = scoreEntry(entry, keywords, preferredMapType);
      const matchExplanation = explainPreInquiryRecipientMatch(entry, {
        municipality: normalizedMunicipality,
        needAreas: normalizedNeedAreas,
        keywords
      });
      return {
        id: entry.id,
        type: entry.type,
        title: entry.title,
        description: entry.description,
        email: entry.email,
        phone: entry.phone,
        address: entry.address,
        county: entry.county,
        municipalityName: entry.municipalityName,
        providerProfileId: entry.providerProfileId,
        providerServices: entry.providerProfile?.services || [],
        providerServiceItems: (entry.providerProfile?.serviceItems || []).map((service) => ({
          id: service.id,
          name: service.name,
          description: service.description,
          category: service.category,
          targetGroups: service.targetGroups || [],
          serviceArea: service.serviceArea,
          feeType: service.feeType,
          priceDescription: service.priceDescription
        })),
        deliveryChannel,
        canSendEmail: Boolean(entry.email && providerAcceptsEmail),
        routingReason: matchExplanation.reason,
        routingReasons: matchExplanation.reasons,
        matchedServices: matchExplanation.matchedServices,
        score
      };
    })
    .filter((entry) => entry.score > 0 || !keywords.length)
    .sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title), "et"))
    .slice(0, Math.max(1, Math.min(Number(limit) || 6, 12)));

  let primaryRecipient = suggestions[0] || null;
  const situationSummary = summarizeSituation(
    normalizedSituation,
    normalizedAssistantMessage
  );
  const detectedNeedAreas = detectNeedAreas(
    normalizedTopic,
    normalizedSituation,
    normalizedAssistantMessage,
    normalizedNeedAreas.join(" ")
  );
  const assessment = buildPreInquiryAssessment({
    topic: normalizedTopic,
    situation: normalizedSituation,
    assistantMessage: normalizedAssistantMessage,
    selectedNeedAreas: normalizedNeedAreas,
    urgencyLevel: normalizedUrgencyLevel
  });
  const detectedUrgencyLevel = assessment.urgencyLevel || detectUrgencyLevel(
    normalizedTopic,
    normalizedSituation,
    normalizedAssistantMessage
  );
  const inferredNextSteps = inferSuggestedNextSteps({
    suggestions,
    preferredRecipientType
  });
  const suggestedNextSteps = assessment.suggestedNextSteps === "KOV"
    ? inferredNextSteps
    : assessment.suggestedNextSteps;
  if (assessment.needsMoreInput) {
    primaryRecipient = null;
  }
  const reasoningText = buildReasoningText(suggestedNextSteps);
  const routingConfidence = buildPreInquiryRoutingConfidence({
    municipality: normalizedMunicipality,
    needAreas: normalizedNeedAreas,
    suggestions,
    needsMoreInput: assessment.needsMoreInput,
    suggestedNextSteps,
    urgencyLevel: detectedUrgencyLevel
  });
  const message = buildPreInquiryAssistantMessage({
    suggestions,
    situationSummary,
    normalizedMunicipality,
    detectedUrgencyLevel,
    suggestedNextSteps
  });
  const draft = assessment.needsMoreInput
    ? ""
    : buildAssistantDraft({
        topic: normalizedTopic,
        situation: normalizedSituation,
        assistantMessage: normalizedAssistantMessage,
        recipient: primaryRecipient,
        assessment
      });
  const recommendedRecipients = assessment.needsMoreInput ? [] : suggestions;
  const warnings = unique([
    ...assessment.warnings,
    "Eelpöördumine ei asenda ametlikku abivajaduse väljaselgitamist ega otsustamist.",
    detectedUrgencyLevel === "URGENT"
      ? "Kui olukord on vahetult ohtlik või vajab kiiret abi, helista 112 või pöördu kriisiabi poole."
      : ""
  ].filter(Boolean));

  return {
    activeRole,
    keywords,
    assessmentMode: assessment.assessmentMode,
    situationSummary,
    selectedNeedAreas: detectedNeedAreas,
    lifeDomains: assessment.lifeDomains,
    targetGroups: assessment.targetGroups,
    riskFlags: assessment.riskFlags,
    personalDataCategories: assessment.personalDataCategories,
    urgencyLevel: detectedUrgencyLevel,
    suggestedNextSteps,
    clarifyingQuestions: assessment.clarifyingQuestions,
    reasoningText,
    routingConfidence: routingConfidence.level,
    routingConfidenceLabel: routingConfidence.label,
    routingConfidenceText: routingConfidence.text,
    recommendedRecipients,
    selectedRecipientSuggestion: primaryRecipient,
    draftType: primaryRecipient?.type === "SERVICE_PROVIDER" ? "SERVICE_PROVIDER" : "KOV",
    draftSubject: normalizedTopic || "Eelpöördumine",
    draftBody: draft,
    channelSuggestion: primaryRecipient?.deliveryChannel || "EXTERNAL_EMAIL",
    warnings,
    suggestions: recommendedRecipients,
    draft,
    message
  };
}
