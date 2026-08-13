import { normalizePreInquiryJourneySharedInfo } from "@/lib/preInquiryJourneySharedInfo";
import { buildAssistiveDevicesHandoff, formatAssistiveDevicesForPreInquiry } from "@/lib/journey/assistiveDevices";
import { resolveJourneyMunicipality } from "@/lib/journey/municipalityResolver";

function cleanText(value, limit = 400) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function lowerText(value) {
  return cleanText(value, 12000).toLocaleLowerCase("et");
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : item?.title || item?.description || ""))
    .map((item) => cleanText(item, 240))
    .filter(Boolean);
}

function readStringFromContext(context = {}, keys = [], limit = 160) {
  if (!context || typeof context !== "object" || Array.isArray(context)) return "";
  for (const key of keys) {
    const value = cleanText(context[key], limit);
    if (value) return value;
  }
  return "";
}

function readObjectFromContext(context = {}, key = "") {
  const value = context && typeof context === "object" && !Array.isArray(context)
    ? context[key]
    : null;
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export const JOURNEY_SHARE_KEYS = Object.freeze([
  "summary",
  "domains",
  "missingInfo",
  "wish",
  "personContext",
  "assistiveDevices",
  "serviceContinuity",
  "municipality",
  "document",
  "title"
]);

const JOURNEY_SHARE_KEY_SET = new Set(JOURNEY_SHARE_KEYS);

export function partitionJourneyShareKeys(value) {
  if (!Array.isArray(value)) {
    const error = new TypeError("shareKeys must be an array");
    error.code = "INVALID_JOURNEY_SHARE_KEYS";
    error.status = 400;
    throw error;
  }
  const confirmedKeys = [];
  const ignoredKeys = [];
  for (const item of value) {
    const key = String(item || "").trim();
    if (!key) continue;
    const target = JOURNEY_SHARE_KEY_SET.has(key) ? confirmedKeys : ignoredKeys;
    if (!target.includes(key)) target.push(key);
  }
  return { confirmedKeys, ignoredKeys };
}

function inferRecipientType(journey = {}) {
  const text = lowerText([
    journey.primaryPath,
    journey.summary,
    ...normalizeList(journey.domains),
    ...normalizeList(journey.suggestedActions)
  ].join(" "));

  if (/teenuseosutaja|teenuse pakkuja|provider/u.test(text)) return "SERVICE_PROVIDER";
  if (/\bkov\b|omavalitsus|kohalik omavalitsus|sotsiaaltöötaja|sotsiaaltootaja/u.test(text)) return "KOV_CONTACT";
  return "";
}

function buildSuggestedMessageDraft({ topic, situation, missingInfoNotes }) {
  const lines = [
    "Tere",
    "",
    `Soovin pöörduda teemal: ${topic}.`,
    "",
    "Olukorra kirjeldus:",
    situation,
    "",
    missingInfoNotes ? `Täpsustamist vajav info:\n${missingInfoNotes}` : "",
    "",
    "Palun aidata välja selgitada, millised oleksid sobivad järgmised sammud.",
    "",
    "Lugupidamisega"
  ];

  return lines.filter((line, index, source) => line || source[index - 1] !== "").join("\n");
}

export function buildPreInquiryPrefillFromJourney(journey = {}, options = {}) {
  const context = journey.context && typeof journey.context === "object" && !Array.isArray(journey.context)
    ? journey.context
    : {};
  const { confirmedKeys } = partitionJourneyShareKeys(options.shareKeys ?? options.share ?? []);
  const shareKeys = new Set(confirmedKeys);
  const includeAssistiveDevices = shareKeys.has("assistiveDevices");
  const serviceContinuity = readObjectFromContext(context, "serviceContinuity");
  const assistiveDevices = buildAssistiveDevicesHandoff(journey);
  const assistiveDevicesText = includeAssistiveDevices
    ? formatAssistiveDevicesForPreInquiry(assistiveDevices.devices)
    : "";
  const missingInfo = shareKeys.has("missingInfo") ? normalizeList(journey.missingInfo) : [];
  const domains = shareKeys.has("domains") ? normalizeList(journey.domains) : [];
  const summary = shareKeys.has("summary") ? cleanText(journey.summary, 3000) : "";
  const personWish = shareKeys.has("wish")
    ? readStringFromContext(context, ["personWish", "wish"], 1000)
    : "";
  const personContext = shareKeys.has("personContext")
    ? readStringFromContext(context, ["personContext", "person", "subject"], 1000)
    : "";
  const documentNote = shareKeys.has("document")
    ? readStringFromContext(context, ["contextNote", "document"], 1000)
    : "";
  const topic = shareKeys.has("title")
    ? cleanText(journey.title || journey.primaryPath, 160)
    : "";
  const municipality = shareKeys.has("municipality")
    ? resolveJourneyMunicipality(journey).municipalityName
    : "";
  const continuityParts = shareKeys.has("serviceContinuity") ? [
    serviceContinuity.serviceName ? `Teenus või tugi: ${cleanText(serviceContinuity.serviceName, 180)}` : "",
    serviceContinuity.currentProvider ? `Praegune teenuseosutaja või kontakt: ${cleanText(serviceContinuity.currentProvider, 180)}` : "",
    serviceContinuity.endDate ? `Teadaolev lõppkuupäev: ${cleanText(serviceContinuity.endDate, 80)}` : "",
    serviceContinuity.userGoal ? `Kasutaja eesmärk: ${cleanText(serviceContinuity.userGoal, 600)}` : ""
  ].filter(Boolean) : [];
  const situationParts = [
    summary,
    personWish ? `Kasutaja soov: ${personWish}` : "",
    personContext ? `Isiku kontekst: ${personContext}` : "",
    documentNote ? `Lisatud kontekst: ${documentNote}` : "",
    assistiveDevicesText ? `Abivahendid ja kohandused:\n${assistiveDevicesText}` : "",
    continuityParts.length ? `Teenuse jätkumise kontroll:\n${continuityParts.join("\n")}` : "",
    domains.length ? `Seotud teemad: ${domains.join(", ")}` : ""
  ].filter(Boolean);
  const situation = situationParts.join("\n\n");
  const missingInfoNotes = missingInfo.map((item) => `- ${item}`).join("\n");
  const sharedJourneyInfo = normalizePreInquiryJourneySharedInfo({
    source: "journey_pre_inquiry_handoff",
    confirmedKeys,
    summary,
    domains,
    missingInfo,
    suggestedActions: [],
    primaryPath: "",
    contextNote: [
      personWish,
      personContext,
      documentNote,
      assistiveDevicesText ? `Abivahendid ja kohandused:\n${assistiveDevicesText}` : ""
    ].filter(Boolean).join("\n\n")
  });

  return {
    sourceJourneyId: journey.id || "",
    topic,
    situation,
    municipality,
    personContext,
    recipientType: inferRecipientType({ title: topic, summary, domains }),
    missingInfoNotes,
    suggestedMessageDraft: buildSuggestedMessageDraft({
      topic,
      situation,
      missingInfoNotes
    }),
    sharedJourneyInfo,
    sourceNotice: "journey_pre_inquiry_handoff"
  };
}
