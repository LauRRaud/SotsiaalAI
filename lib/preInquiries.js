import { prisma } from "@/lib/prisma";
import { getMailer, resolveBaseUrl } from "@/lib/mailer";
import { findPreInquiryCanonicalRoom, withPreInquiryRoomLock } from "@/lib/rooms/preInquiryRoom";
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
  buildPreInquiryDownloadContent,
  normalizePreInquiryAssessmentState
} from "./preInquiriesQuestionnaire.js";
import {
  evaluateTextPrivacy,
  privacyConfirmationResponsePayload
} from "./privacy/privacyGuard.js";
import { serializePublicServiceAvailability } from "./serviceAvailability.js";
import { emitDomainEvent } from "@/lib/events/emitDomainEvent";
import { DomainEventType } from "@/lib/events/registry";

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

function normalizeNextContactOn(value, currentValue = null) {
  if (value === undefined) return currentValue || null;
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) {
    throw preInquiryError("pre_inquiries.errors.next_contact_invalid", 400);
  }
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw preInquiryError("pre_inquiries.errors.next_contact_invalid", 400);
  }
  return normalized;
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

async function resolveRecipient(input = {}, { db = prisma } = {}) {
  const recipientEntryId = normalizeText(input.recipientEntryId);
  const selectedRecipientEmail = normalizeText(input.selectedRecipientEmail)?.toLowerCase() || null;
  const explicitRecipientName = normalizeText(input.selectedRecipientName);

  let recipientEntry = null;
  if (recipientEntryId) {
    recipientEntry = await db.serviceMapEntry.findUnique({
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
    ? await db.user.findUnique({
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

export function serializePreInquiry(inquiry, { viewerId = null } = {}) {
  if (!inquiry) return null;
  const normalizedViewerId = String(viewerId || "").trim();
  const isAuthor = Boolean(normalizedViewerId && normalizedViewerId === String(inquiry.authorId || ""));
  const isRecipient = Boolean(
    normalizedViewerId && normalizedViewerId === String(inquiry.recipientOwnerId || "")
  );
  const serialized = {
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
    status: inquiry.status,
    sentAt: inquiry.sentAt,
    openedAt: inquiry.openedAt,
    recalledAt: inquiry.recalledAt,
    supersededById: inquiry.supersededById,
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
          role: inquiry.author.role,
          ...(isAuthor && inquiry.author.email ? { email: inquiry.author.email } : {})
        }
      : null,
    recipientOwner: inquiry.recipientOwner
      ? {
          id: inquiry.recipientOwner.id,
          role: inquiry.recipientOwner.role,
          ...(isRecipient && inquiry.recipientOwner.email
            ? { email: inquiry.recipientOwner.email }
            : {})
        }
      : null
  };
  if (isRecipient) {
    serialized.receiverNote = inquiry.receiverNote || "";
    serialized.receiverChecklist = normalizePreInquiryReceiverChecklist(
      inquiry.receiverChecklist,
      inquiry
    );
    serialized.nextContactOn = inquiry.nextContactOn || null;
  }
  return serialized;
}

function visiblePreInquiryWhere(userId) {
  return {
    OR: [
      { authorId: userId },
      {
        recipientOwnerId: userId,
        recalledAt: null,
        OR: [
          { sentAt: { not: null } },
          { status: "SENT" }
        ]
      }
    ]
  };
}

export async function listVisiblePreInquiries(userId, { limit = 100, db = prisma } = {}) {
  if (!userId) return [];
  const take = Math.max(1, Math.min(Number(limit) || 100, 250));

  const inquiries = await db.preInquiry.findMany({
    where: visiblePreInquiryWhere(userId),
    take,
    orderBy: { updatedAt: "desc" },
    include: preInquiryInclude
  });

  return inquiries.map((inquiry) => serializePreInquiry(inquiry, { viewerId: userId }));
}

export async function getVisiblePreInquiry(userId, inquiryId, { db = prisma } = {}) {
  if (!userId || !inquiryId) return null;
  const inquiry = await db.preInquiry.findFirst({
    where: {
      id: inquiryId,
      ...visiblePreInquiryWhere(userId)
    },
    include: preInquiryInclude
  });
  return inquiry;
}

// --- A3: DOWNLOADED lifecycle ---------------------------------------------------

/**
 * True when the offline-download-relevant content differs. A substantive edit of
 * a DOWNLOADED record makes the earlier downloaded copy stale.
 */
/**
 * A substantive change is one that alters the CANONICAL downloadable text — the
 * exact bytes that would land in the .txt file. Comparing the rendered content
 * (not a hand-picked field list) means every visible field is covered, including
 * the recipient name: changing a DOWNLOADED record's recipient invalidates the
 * offline copy just as editing its body does (A3 Sol round: point 4).
 */
export function preInquiryContentChanged(current = {}, next = {}) {
  return buildPreInquiryDownloadContent(current) !== buildPreInquiryDownloadContent(next);
}

/**
 * Server-enforced status for an author edit of a pre-inquiry.
 *
 * DOWNLOADED is NEVER settable through an ordinary edit — it is minted only by the
 * download endpoint (markPreInquiryDownloaded). A client-requested DOWNLOADED is
 * therefore ignored (the current status is kept), closing the PATCH side-channel
 * that would otherwise let a client fake the state (A3 Sol round: point 3).
 *
 * - a DOWNLOADED record whose downloadable content changed reverts to READY,
 *   because the offline copy is now stale (semantics #4); a no-op edit keeps it;
 * - a DOWNLOADED record may still be sent / archived (semantics #6);
 * - from any other state the requested status is used (existing behaviour).
 */
export function resolvePreInquiryEditStatus({ currentStatus, requestedStatus, contentChanged }) {
  // Sending / archiving always wins — a DOWNLOADED record may still be sent, and
  // the content being sent is the current edited content (semantics #6).
  if (requestedStatus === "SENT" || requestedStatus === "ARCHIVED") return requestedStatus;
  // A substantive edit of a DOWNLOADED record invalidates the offline copy -> READY
  // (semantics #4); a no-op edit keeps it DOWNLOADED.
  if (currentStatus === "DOWNLOADED") return contentChanged ? "READY" : "DOWNLOADED";
  // From any non-DOWNLOADED state a client can NEVER promote to DOWNLOADED via an
  // edit: the requested DOWNLOADED is ignored (kept as current). Only the download
  // endpoint mints DOWNLOADED — this closes the PATCH side-channel (point 3).
  if (requestedStatus === "DOWNLOADED") return currentStatus;
  return requestedStatus;
}

/** True when a DB `updatedAt` equals the client-supplied snapshot fingerprint. */
export function sameUpdatedAtFingerprint(actual, expected) {
  if (actual == null || expected == null) return false;
  const a = actual instanceof Date ? actual.getTime() : new Date(actual).getTime();
  const b = expected instanceof Date ? expected.getTime() : new Date(expected).getTime();
  return Number.isFinite(a) && Number.isFinite(b) && a === b;
}

function preInquiryError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function loadPreInquiryAfterMutation(db, inquiryId) {
  return db.preInquiry.findUnique({
    where: { id: inquiryId },
    include: preInquiryInclude
  });
}

async function emitPreInquiryEvent(tx, {
  type,
  inquiryId,
  actorUserId,
  occurredAt,
  statusKey = null
}) {
  const timestamp = occurredAt instanceof Date ? occurredAt : new Date();
  return emitDomainEvent(tx, {
    type,
    actorKind: "user",
    actorUserId,
    sourceId: inquiryId,
    workspaceId: inquiryId,
    actionTarget: `pre_inquiry:${inquiryId}`,
    idempotencyKey: `${type}:${inquiryId}:${timestamp.toISOString()}`,
    occurredAt: timestamp,
    meta: statusKey ? { statusKey } : {}
  });
}

/**
 * U3-lite recall. The author's visibility pre-check and the under-lock owner
 * re-check both use 404 for missing/foreign ids. A successful retry returns the
 * same recalled row before fingerprint validation, making a double submit
 * idempotent while a genuine stale first attempt remains a 409.
 */
export async function recallPreInquiry(
  userId,
  inquiryId,
  { expectedUpdatedAt = null, db = prisma } = {}
) {
  const existing = await db.preInquiry.findFirst({
    where: { id: inquiryId, authorId: userId },
    select: { id: true }
  });
  if (!existing) throw preInquiryError("api.common.not_found", 404);

  return withPreInquiryRoomLock(existing.id, async (tx) => {
    const fresh = await loadPreInquiryAfterMutation(tx, existing.id);
    if (!fresh || fresh.authorId !== userId) {
      throw preInquiryError("api.common.not_found", 404);
    }
    if (fresh.recalledAt) return serializePreInquiry(fresh, { viewerId: userId });
    if (fresh.deliveryChannel !== "INTERNAL") {
      throw preInquiryError("pre_inquiries.errors.external_cannot_be_recalled", 409);
    }
    if (fresh.openedAt) {
      throw preInquiryError("pre_inquiries.errors.already_opened", 409);
    }
    if (await findPreInquiryCanonicalRoom(fresh.id, { db: tx })) {
      throw preInquiryError("pre_inquiries.errors.already_opened", 409);
    }
    if (fresh.status !== "SENT" || !fresh.sentAt) {
      throw preInquiryError("pre_inquiries.errors.not_recallable", 409);
    }
    if (!sameUpdatedAtFingerprint(fresh.updatedAt, expectedUpdatedAt)) {
      throw preInquiryError("pre_inquiries.errors.recall_conflict", 409);
    }

    const occurredAt = new Date();
    const result = await tx.preInquiry.updateMany({
      where: {
        id: fresh.id,
        authorId: userId,
        updatedAt: fresh.updatedAt,
        openedAt: null,
        recalledAt: null
      },
      data: { recalledAt: occurredAt, updatedAt: occurredAt }
    });
    if (result.count !== 1) {
      throw preInquiryError("pre_inquiries.errors.recall_conflict", 409);
    }
    await emitPreInquiryEvent(tx, {
      type: DomainEventType.PRE_INQUIRY_RECALLED,
      inquiryId: fresh.id,
      actorUserId: userId,
      occurredAt
    });
    return serializePreInquiry(await loadPreInquiryAfterMutation(tx, fresh.id), { viewerId: userId });
  }, { db });
}

/** Marks the platform recipient's explicit acceptance as the first trusted open. */
export async function acceptPreInquiry(userId, inquiryId, { db = prisma } = {}) {
  const existing = await db.preInquiry.findFirst({
    where: {
      id: inquiryId,
      recipientOwnerId: userId,
      recalledAt: null
    },
    select: { id: true }
  });
  if (!existing) throw preInquiryError("api.common.not_found", 404);

  return withPreInquiryRoomLock(existing.id, async (tx) => {
    const fresh = await loadPreInquiryAfterMutation(tx, existing.id);
    if (!fresh || fresh.recipientOwnerId !== userId || fresh.recalledAt) {
      throw preInquiryError("api.common.not_found", 404);
    }
    if (!fresh.sentAt && fresh.status !== "SENT") {
      throw preInquiryError("pre_inquiries.errors.not_sent", 409);
    }
    // Accept is idempotent after the recipient has already opened the item. In
    // particular, never resurrect an ARCHIVED workflow back to READY on a
    // repeated click or a delayed retry.
    if (fresh.openedAt && fresh.status !== "SENT") {
      return serializePreInquiry(fresh, { viewerId: userId });
    }

    const occurredAt = fresh.openedAt || new Date();
    const result = await tx.preInquiry.updateMany({
      where: {
        id: fresh.id,
        recipientOwnerId: userId,
        updatedAt: fresh.updatedAt,
        recalledAt: null
      },
      data: {
        status: fresh.status === "SENT" ? "READY" : fresh.status,
        openedAt: occurredAt,
        updatedAt: occurredAt
      }
    });
    if (result.count !== 1) {
      throw preInquiryError("pre_inquiries.errors.open_conflict", 409);
    }
    await emitPreInquiryEvent(tx, {
      type: DomainEventType.PRE_INQUIRY_OPENED,
      inquiryId: fresh.id,
      actorUserId: userId,
      occurredAt,
      statusKey: "READY"
    });
    if (tx.notificationEvent?.updateMany) {
      await tx.notificationEvent.updateMany({
        where: {
          userId,
          type: "PRE_INQUIRY_ARRIVED",
          sourceType: "PRE_INQUIRY",
          sourceId: fresh.id,
          readAt: null
        },
        data: { readAt: occurredAt }
      });
    }
    return serializePreInquiry(await loadPreInquiryAfterMutation(tx, fresh.id), { viewerId: userId });
  }, { db });
}

/**
 * Sends one corrected INTERNAL version after the original was opened. The
 * recipient and delivery channel are copied from the locked server row; the
 * client can only provide corrected user-facing content and a privacy decision.
 */
export async function sendPreInquiryCorrection(
  userId,
  inquiryId,
  input = {},
  { db = prisma } = {}
) {
  const existing = await db.preInquiry.findFirst({
    where: { id: inquiryId, authorId: userId },
    select: { id: true }
  });
  if (!existing) throw preInquiryError("api.common.not_found", 404);

  const outcome = await withPreInquiryRoomLock(existing.id, async (tx) => {
    const fresh = await loadPreInquiryAfterMutation(tx, existing.id);
    if (!fresh || fresh.authorId !== userId) {
      throw preInquiryError("api.common.not_found", 404);
    }

    if (fresh.supersededById) {
      const replacement = await loadPreInquiryAfterMutation(tx, fresh.supersededById);
      if (!replacement || replacement.authorId !== userId) {
        throw preInquiryError("pre_inquiries.errors.correction_conflict", 409);
      }
      return {
        inquiry: serializePreInquiry(replacement, { viewerId: userId }),
        created: false
      };
    }
    if (fresh.recalledAt) {
      throw preInquiryError("pre_inquiries.errors.recalled_cannot_be_corrected", 409);
    }
    if (fresh.deliveryChannel !== "INTERNAL") {
      throw preInquiryError("pre_inquiries.errors.external_cannot_be_corrected", 409);
    }
    if (!fresh.recipientOwnerId) {
      throw preInquiryError("pre_inquiries.errors.not_sent", 409);
    }
    if (!fresh.openedAt) {
      throw preInquiryError("pre_inquiries.errors.correction_requires_open", 409);
    }
    if (!sameUpdatedAtFingerprint(fresh.updatedAt, input.expectedUpdatedAt)) {
      throw preInquiryError("pre_inquiries.errors.correction_conflict", 409);
    }

    const topic = normalizeText(input.topic ?? fresh.topic);
    const situation = normalizeRequiredText(input.situation, "situation");
    const correctedDraft = normalizeRequiredText(
      input.userEditedDraft ?? input.correctionText,
      "correction"
    );
    const privacySafe = evaluatePreInquiryPrivacy({
      topic,
      situation,
      generatedDraft: correctedDraft,
      userEditedDraft: correctedDraft,
      assessmentState: null
    }, input.privacyDecision);
    const finalTopic = normalizeText(privacySafe.topic);
    const finalSituation = normalizeRequiredText(privacySafe.situation, "situation");
    const finalDraft = normalizeRequiredText(
      privacySafe.userEditedDraft || privacySafe.generatedDraft,
      "correction"
    );
    const sentAt = new Date();

    const replacement = await tx.preInquiry.create({
      data: {
        authorId: userId,
        recipientOwnerId: fresh.recipientOwnerId,
        recipientEntryId: fresh.recipientEntryId,
        sourceJourneyId: fresh.sourceJourneyId,
        recipientType: fresh.recipientType,
        deliveryChannel: "INTERNAL",
        selectedRecipientEmail: fresh.selectedRecipientEmail,
        selectedRecipientName: fresh.selectedRecipientName,
        topic: finalTopic,
        situation: finalSituation,
        assessmentState: null,
        generatedDraft: null,
        userEditedDraft: finalDraft,
        status: "SENT",
        sentAt
      },
      include: preInquiryInclude
    });

    const linked = await tx.preInquiry.updateMany({
      where: {
        id: fresh.id,
        authorId: userId,
        updatedAt: fresh.updatedAt,
        supersededById: null
      },
      data: { supersededById: replacement.id }
    });
    if (linked.count !== 1) {
      throw preInquiryError("pre_inquiries.errors.correction_conflict", 409);
    }
    return {
      inquiry: serializePreInquiry(replacement, { viewerId: userId }),
      created: true
    };
  }, { db });

  if (outcome.created && outcome.inquiry.recipientOwnerId) {
    await dispatchInternalArrivalEmail(outcome.inquiry.recipientOwnerId, { db });
  }
  return outcome;
}

/**
 * A3: the AUTHOR marks a saved pre-inquiry DOWNLOADED after downloading it for
 * offline use (semantics #1–3, #5, #7). Only DRAFT/READY transition to
 * DOWNLOADED; SENT/ARCHIVED (and an already-DOWNLOADED record) keep their status.
 *
 * Ownership is enforced and a foreign record's existence never leaks: a record
 * the caller cannot see -> 404; a visible record they do not author -> 403.
 *
 * The mark is VERSION-SAFE (A3 Sol round: point 2). It runs under the SAME
 * withPreInquiryRoomLock as updatePreInquiry, so a concurrent edit and a mark can
 * never interleave. Owner, status and updatedAt are re-read fresh UNDER the lock
 * in the same transaction; if the client's snapshot (`expectedUpdatedAt`) no
 * longer matches the fresh record, a generic 409 is returned and nothing is
 * marked. This makes the outcome deterministic regardless of ordering:
 *  - edit before mark -> the fingerprint is stale -> 409 (offline copy is stale);
 *  - mark before edit -> the mark succeeds; a later substantive edit reverts to
 *    READY via resolvePreInquiryEditStatus.
 */
export async function markPreInquiryDownloaded(userId, inquiryId, { expectedUpdatedAt = null, db = prisma } = {}) {
  // Visibility pre-check OUTSIDE the lock: a foreign record's existence must not
  // leak (404) and a non-author is rejected (403) before any lock is taken.
  const existing = await getVisiblePreInquiry(userId, inquiryId, { db });
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

  return withPreInquiryRoomLock(existing.id, async (tx) => {
    const fresh = await tx.preInquiry.findUnique({
      where: { id: existing.id },
      include: preInquiryInclude
    });
    // Re-checked under the lock; a record that vanished / changed author is 404.
    if (!fresh || fresh.authorId !== userId) {
      const error = new Error("api.common.not_found");
      error.status = 404;
      throw error;
    }
    if (fresh.status !== "DRAFT" && fresh.status !== "READY") {
      // SENT / ARCHIVED / already DOWNLOADED -> a download does not change the state.
      return serializePreInquiry(fresh, { viewerId: userId });
    }
    // Version guard: a DRAFT/READY -> DOWNLOADED transition REQUIRES a fingerprint
    // that is present, a valid date and equal to the fresh updatedAt. A missing,
    // malformed or stale fingerprint is a generic 409 and marks nothing — the
    // author can only ever mark the exact snapshot they downloaded (point 1).
    if (!sameUpdatedAtFingerprint(fresh.updatedAt, expectedUpdatedAt)) {
      const error = new Error("pre_inquiries.errors.download_conflict");
      error.status = 409;
      throw error;
    }
    const updated = await tx.preInquiry.update({
      where: { id: existing.id },
      data: { status: "DOWNLOADED" },
      include: preInquiryInclude
    });
    return serializePreInquiry(updated, { viewerId: userId });
  }, { db });
}

/**
 * Resolves the optional Teekond (journey) back-link for a new pre-inquiry.
 * The server never trusts the client-supplied id; ownership is confirmed here.
 *
 * - missing / empty id -> null (a normal, unlinked pre-inquiry);
 * - id owned by the author -> that id (a persistent link is created);
 * - id that is missing, deleted or owned by another user -> the same generic
 *   404 in every case, so a foreign journey's existence never leaks.
 */
export async function resolveSourceJourneyId(userId, rawSourceJourneyId, { db = prisma } = {}) {
  const sourceJourneyId = String(rawSourceJourneyId || "").trim();
  if (!sourceJourneyId) return null;

  const journey = await db.journey.findFirst({
    where: {
      id: sourceJourneyId,
      ownerUserId: userId
    },
    select: { id: true }
  });

  if (!journey) {
    const error = new Error("journeys.errors.not_found");
    error.status = 404;
    throw error;
  }

  return journey.id;
}

export async function createPreInquiry(userId, input = {}, { db = prisma } = {}) {
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
  const recipient = await resolveRecipient(input, { db });
  const sourceJourneyId = await resolveSourceJourneyId(userId, input.sourceJourneyId, { db });
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

  const sentAt = status === "SENT" ? new Date() : null;
  const inquiry = await db.preInquiry.create({
    data: {
      authorId: userId,
      recipientOwnerId: recipient.recipientOwnerId,
      recipientEntryId: recipient.recipientEntry?.id || null,
      sourceJourneyId,
      recipientType: recipient.recipientType,
      deliveryChannel: recipient.deliveryChannel,
      selectedRecipientEmail: recipient.selectedRecipientEmail,
      selectedRecipientName: recipient.selectedRecipientName,
      topic: normalizeText(privacySafe.topic),
      situation: normalizeRequiredText(privacySafe.situation, "situation"),
      assessmentState: privacySafe.assessmentState,
      generatedDraft: normalizeText(privacySafe.generatedDraft, MAX_TEXT_LENGTH) || generatedDraft,
      userEditedDraft: normalizeText(privacySafe.userEditedDraft, MAX_TEXT_LENGTH) || userEditedDraft,
      status,
      sentAt
    },
    include: preInquiryInclude
  });

  if (shouldSendInternalArrival({
    previousStatus: null,
    nextStatus: status,
    deliveryChannel: recipient.deliveryChannel,
    recipientOwnerId: recipient.recipientOwnerId
  })) {
    await dispatchInternalArrivalEmail(recipient.recipientOwnerId, { db });
  }

  return serializePreInquiry(inquiry, { viewerId: userId });
}

/**
 * Once a shared (canonical) room exists for a pre-inquiry, the recipient is
 * fixed: reassigning recipientOwnerId would orphan the room's participants and
 * could expose the previous recipient's room to a new one. Block the change with
 * a generic 409; a deliberate recipient-transfer flow is future work.
 *
 * Runs against the caller-supplied `client` (the transaction that also performs
 * the update) so the existence check and the update are atomic under the shared
 * pre-inquiry room advisory lock.
 */
export async function assertRecipientChangeAllowed(
  client,
  { inquiryId, previousRecipientOwnerId, nextRecipientOwnerId }
) {
  if (String(nextRecipientOwnerId || "") === String(previousRecipientOwnerId || "")) return;
  const room = await findPreInquiryCanonicalRoom(inquiryId, { db: client });
  if (room) {
    const error = new Error("pre_inquiries.errors.recipient_locked_by_room");
    error.status = 409;
    throw error;
  }
}

export async function updatePreInquiry(userId, inquiryId, input = {}, { db = prisma } = {}) {
  const existing = await getVisiblePreInquiry(userId, inquiryId, { db });
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
  if (existing.openedAt || existing.supersededById) {
    const error = new Error("pre_inquiries.errors.opened_cannot_be_edited");
    error.status = 409;
    throw error;
  }

  // Everything that touches the recipient runs UNDER the advisory lock against a
  // fresh read of the record, using the same transaction. A concurrent PATCH's
  // recipient change can therefore never be clobbered by this call's pre-lock
  // snapshot: whoever holds the lock first commits; the next re-reads the result.
  let arrival = null;
  const inquiry = await withPreInquiryRoomLock(existing.id, async (tx) => {
    const fresh = await tx.preInquiry.findUnique({
      where: { id: existing.id },
      select: {
        recipientEntryId: true,
        recipientType: true,
        recipientOwnerId: true,
        selectedRecipientEmail: true,
        selectedRecipientName: true,
        status: true,
        sentAt: true,
        openedAt: true,
        recalledAt: true,
        supersededById: true,
        generatedDraft: true,
        userEditedDraft: true,
        situation: true,
        topic: true,
        assessmentState: true
      }
    });
    if (!fresh) {
      const error = new Error("api.common.not_found");
      error.status = 404;
      throw error;
    }
    if (fresh.status === "SENT") {
      const error = new Error("pre_inquiries.errors.sent_cannot_be_edited");
      error.status = 409;
      throw error;
    }
    if (fresh.openedAt || fresh.supersededById) {
      const error = new Error("pre_inquiries.errors.opened_cannot_be_edited");
      error.status = 409;
      throw error;
    }

    // Resolve the recipient from the FRESH record's defaults, using the same tx.
    const recipient = await resolveRecipient({
      recipientEntryId: input.recipientEntryId ?? fresh.recipientEntryId,
      recipientType: input.recipientType ?? fresh.recipientType,
      selectedRecipientEmail: input.selectedRecipientEmail ?? fresh.selectedRecipientEmail,
      selectedRecipientName: input.selectedRecipientName ?? fresh.selectedRecipientName
    }, { db: tx });

    // Compare the FRESH DB owner with the freshly resolved next owner.
    await assertRecipientChangeAllowed(tx, {
      inquiryId: existing.id,
      previousRecipientOwnerId: fresh.recipientOwnerId,
      nextRecipientOwnerId: recipient.recipientOwnerId
    });

    const assessmentState = hasAssessmentState(input.assessmentState)
      ? normalizePreInquiryAssessmentState(input.assessmentState)
      : hasAssessmentState(fresh.assessmentState)
        ? normalizePreInquiryAssessmentState(fresh.assessmentState)
        : null;
    const assessmentSituation = assessmentState ? buildPreInquiryAssessmentSituation(assessmentState) : "";
    const assessmentDraftSummary = assessmentState ? buildPreInquiryAssessmentDraftSummary(assessmentState) : "";
    const situation = normalizeRequiredText(input.situation || fresh.situation || assessmentSituation, "situation");
    const topic = normalizeText(input.topic ?? fresh.topic);
    const shouldRebuildGeneratedDraft = Boolean(input.assessmentState) || !fresh.generatedDraft;
    const generatedDraft = normalizeText(input.generatedDraft, MAX_TEXT_LENGTH) || (shouldRebuildGeneratedDraft ? buildDraft({
      topic,
      situation,
      assessmentSummary: assessmentDraftSummary,
      recipientName: recipient.selectedRecipientName,
      recipientEmail: recipient.selectedRecipientEmail,
      recipientType: recipient.recipientType
    }) : fresh.generatedDraft) || buildDraft({
      topic,
      situation,
      assessmentSummary: assessmentDraftSummary,
      recipientName: recipient.selectedRecipientName,
      recipientEmail: recipient.selectedRecipientEmail,
      recipientType: recipient.recipientType
    });
    const userEditedDraft = normalizeText(input.userEditedDraft, MAX_TEXT_LENGTH) || generatedDraft;
    const requestedStatus = normalizeEnum(input.status, PRE_INQUIRY_STATUSES, fresh.status || "DRAFT");
    // DOWNLOADED is minted ONLY by the download endpoint. An ordinary PATCH that
    // requests it is a rejected invalid transition (400) with no DB write — this
    // closes the side-channel regardless of the current status (point 2).
    if (requestedStatus === "DOWNLOADED") {
      const error = new Error("api.common.invalid_request");
      error.status = 400;
      throw error;
    }
    if (requestedStatus === "SENT" && recipient.deliveryChannel !== "INTERNAL") {
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

    const finalTopic = normalizeText(privacySafe.topic);
    const finalSituation = normalizeRequiredText(privacySafe.situation, "situation");
    const finalGeneratedDraft = normalizeText(privacySafe.generatedDraft, MAX_TEXT_LENGTH) || generatedDraft;
    const finalUserEditedDraft = normalizeText(privacySafe.userEditedDraft, MAX_TEXT_LENGTH) || userEditedDraft;
    const finalAssessmentState = privacySafe.assessmentState;

    // A3: a DOWNLOADED record whose downloadable content changed reverts to READY,
    // because the earlier offline copy is now stale (a re-download re-marks it).
    const status = resolvePreInquiryEditStatus({
      currentStatus: fresh.status,
      requestedStatus,
      contentChanged: preInquiryContentChanged(
        {
          topic: fresh.topic,
          situation: fresh.situation,
          userEditedDraft: fresh.userEditedDraft,
          generatedDraft: fresh.generatedDraft,
          assessmentState: fresh.assessmentState,
          selectedRecipientName: fresh.selectedRecipientName
        },
        {
          topic: finalTopic,
          situation: finalSituation,
          userEditedDraft: finalUserEditedDraft,
          generatedDraft: finalGeneratedDraft,
          assessmentState: finalAssessmentState,
          selectedRecipientName: recipient.selectedRecipientName
        }
      )
    });

    const updated = await tx.preInquiry.update({
      where: { id: existing.id },
      data: {
        recipientOwnerId: recipient.recipientOwnerId,
        recipientEntryId: recipient.recipientEntry?.id || null,
        recipientType: recipient.recipientType,
        deliveryChannel: recipient.deliveryChannel,
        selectedRecipientEmail: recipient.selectedRecipientEmail,
        selectedRecipientName: recipient.selectedRecipientName,
        topic: finalTopic,
        situation: finalSituation,
        assessmentState: finalAssessmentState,
        generatedDraft: finalGeneratedDraft,
        userEditedDraft: finalUserEditedDraft,
        status,
        sentAt: status === "SENT" ? fresh.sentAt || new Date() : fresh.sentAt
      },
      include: preInquiryInclude
    });

    arrival = {
      previousStatus: fresh.status,
      nextStatus: status,
      deliveryChannel: recipient.deliveryChannel,
      recipientOwnerId: recipient.recipientOwnerId
    };
    return updated;
  }, { db });

  // Best-effort arrival email is dispatched AFTER the transaction commits.
  if (arrival && shouldSendInternalArrival(arrival)) {
    await dispatchInternalArrivalEmail(arrival.recipientOwnerId);
  }

  return serializePreInquiry(inquiry, { viewerId: userId });
}

export async function updatePreInquiryReceiverWorkflow(
  userId,
  inquiryId,
  input = {},
  { db = prisma } = {}
) {
  const existing = await db.preInquiry.findFirst({
    where: {
      id: inquiryId,
      recipientOwnerId: userId,
      recalledAt: null
    },
    select: { id: true }
  });
  if (!existing) throw preInquiryError("api.common.not_found", 404);

  return withPreInquiryRoomLock(existing.id, async (tx) => {
    const fresh = await loadPreInquiryAfterMutation(tx, existing.id);
    if (!fresh || fresh.recipientOwnerId !== userId || fresh.recalledAt) {
      throw preInquiryError("api.common.not_found", 404);
    }
    if (!fresh.sentAt && fresh.status !== "SENT") {
      throw preInquiryError("pre_inquiries.errors.not_sent", 409);
    }

    const fallbackStatus = fresh.status === "ARCHIVED" ? "ARCHIVED" : "READY";
    const nextStatus = normalizeEnum(input.status, ["READY", "ARCHIVED"], fallbackStatus);
    const receiverNote = normalizePreInquiryReceiverNote(input.receiverNote);
    const receiverChecklist = normalizePreInquiryReceiverChecklist(input.receiverChecklist, fresh);
    const nextContactOn = normalizeNextContactOn(input.nextContactOn, fresh.nextContactOn);
    if (!sameUpdatedAtFingerprint(fresh.updatedAt, input.expectedUpdatedAt)) {
      throw preInquiryError("pre_inquiries.errors.open_conflict", 409);
    }
    const occurredAt = new Date();
    const result = await tx.preInquiry.updateMany({
      where: {
        id: fresh.id,
        recipientOwnerId: userId,
        updatedAt: fresh.updatedAt,
        recalledAt: null
      },
      data: {
        receiverNote,
        receiverChecklist,
        nextContactOn,
        status: nextStatus,
        openedAt: fresh.openedAt || occurredAt,
        updatedAt: occurredAt
      }
    });
    if (result.count !== 1) {
      throw preInquiryError("pre_inquiries.errors.open_conflict", 409);
    }
    const eventType = nextStatus === "ARCHIVED" && fresh.status !== "ARCHIVED"
      ? DomainEventType.PRE_INQUIRY_ARCHIVED
      : !fresh.openedAt
        ? DomainEventType.PRE_INQUIRY_OPENED
        : DomainEventType.PRE_INQUIRY_REPLIED;
    await emitPreInquiryEvent(tx, {
      type: eventType,
      inquiryId: fresh.id,
      actorUserId: userId,
      occurredAt,
      statusKey: nextStatus
    });
    if (fresh.nextContactOn !== nextContactOn && tx.notificationEvent?.updateMany) {
      const cancelledAt = new Date();
      await tx.notificationEvent.updateMany({
        where: {
          userId,
          type: "NEXT_CONTACT_DUE",
          sourceType: "PRE_INQUIRY",
          sourceId: fresh.id,
          readAt: null
        },
        data: {
          readAt: cancelledAt,
          expiresAt: cancelledAt,
          emailStatus: "CANCELLED",
          emailNextAttemptAt: null,
          emailLastErrorCode: null
        }
      });
    }
    return serializePreInquiry(await loadPreInquiryAfterMutation(tx, fresh.id), { viewerId: userId });
  }, { db });
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

  return serializePreInquiry(inquiry, { viewerId: userId });
}

// A5/U1-lite: internal pre-inquiry arrival notification.
// Fires once, when a pre-inquiry transitions to SENT on the INTERNAL channel to
// a platform recipient. The email is a notification only — it never carries the
// topic, situation or draft; the recipient reads the content signed in on the
// platform. Recipient consent is the existing acceptsPreInquiries opt-in (a
// prerequisite for INTERNAL delivery).
export function shouldSendInternalArrival({ previousStatus, nextStatus, deliveryChannel, recipientOwnerId }) {
  return Boolean(
    recipientOwnerId &&
    deliveryChannel === "INTERNAL" &&
    nextStatus === "SENT" &&
    previousStatus !== "SENT"
  );
}

export function buildInternalArrivalEmail({ baseUrl } = {}) {
  const signInUrl = String(baseUrl || "").replace(/\/+$/, "");
  const subject = "Uus eelpöördumine SotsiaalAI-s";
  const line = signInUrl
    ? `Sulle saabus uus eelpöördumine SotsiaalAI-s. Logi sisse, et see üle vaadata: ${signInUrl}`
    : "Sulle saabus uus eelpöördumine SotsiaalAI-s. Logi sisse platvormile, et see üle vaadata.";
  const html = [
    `<p>${escapeHtml(line)}</p>`,
    "<p><small>See on automaatne teavitus. Eelpöördumise sisu on nähtav ainult platvormile sisse logides.</small></p>"
  ].join("\n");
  return { subject, text: line, html };
}

export async function sendInternalPreInquiryArrivalEmail(
  recipientOwnerId,
  { db = prisma, mailer, resolveUrl = resolveBaseUrl, from } = {}
) {
  const sender = String(from ?? process.env.EMAIL_FROM ?? process.env.SMTP_FROM ?? "").trim();
  if (!recipientOwnerId || !sender) return { sent: false, reason: "no_sender" };

  const recipient = await db.user.findUnique({
    where: { id: String(recipientOwnerId) },
    select: { email: true }
  });
  const to = String(recipient?.email || "").trim();
  if (!to) return { sent: false, reason: "no_recipient_email" };

  const { subject, text, html } = buildInternalArrivalEmail({ baseUrl: resolveUrl() });
  const transport = mailer || getMailer("pre-inquiries");
  await transport.sendMail({ to, from: sender, subject, text, html });
  return { sent: true, to };
}

export async function dispatchInternalArrivalEmail(recipientOwnerId, options = {}) {
  // Best-effort side effect: a failed notification must never fail the save,
  // but the request still waits for the attempt so serverless runtimes cannot
  // freeze the unfinished promise after returning the response.
  try {
    return await sendInternalPreInquiryArrivalEmail(recipientOwnerId, options);
  } catch (error) {
    console.error("[pre-inquiries] internal arrival email failed", error?.message || error);
    return { sent: false, reason: "send_failed" };
  }
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
} = {}, { db = prisma, now = null } = {}) {
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

  const entries = await db.serviceMapEntry.findMany({
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
              availabilityStatus: true,
              availabilityDescription: true,
              availabilityCheckedAt: true,
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
    const users = await db.user.findMany({
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
          priceDescription: service.priceDescription,
          availabilityStatus: service.availabilityStatus,
          availabilityDescription: service.availabilityDescription,
          availabilityCheckedAt: service.availabilityCheckedAt,
          availability: serializePublicServiceAvailability(service, { now })
        })),
        providerProfile: entry.providerProfile ? {
          organizationName: entry.providerProfile.organizationName,
          services: entry.providerProfile.services || [],
          acceptsPlatformPreInquiries: entry.providerProfile.acceptsPlatformPreInquiries,
          acceptsEmailPreInquiries: entry.providerProfile.acceptsEmailPreInquiries,
          serviceItems: (entry.providerProfile.serviceItems || []).map((service) => ({
            id: service.id,
            name: service.name,
            mapVisible: service.mapVisible,
            status: service.status,
            availability: serializePublicServiceAvailability(service, { now })
          }))
        } : null,
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
