import { normalizePreInquiryJourneySharedInfo } from "@/lib/preInquiryJourneySharedInfo";
import { buildAssistiveDevicesHandoff, formatAssistiveDevicesForPreInquiry } from "@/lib/journey/assistiveDevices";

const MUNICIPALITY_ALIASES = Object.freeze([
  ["tartus", "Tartu"],
  ["tartu", "Tartu"],
  ["tallinnas", "Tallinn"],
  ["tallinn", "Tallinn"],
  ["parnus", "Parnu"],
  ["parnu", "Parnu"],
  ["narvas", "Narva"],
  ["narva", "Narva"]
]);

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

function normalizeShareKeys(value = []) {
  const source = Array.isArray(value)
    ? value
    : String(value || "").split(/[,;\s]+/u);
  return new Set(
    source
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  );
}

function municipalityFromText(value) {
  const text = lowerText(value);
  for (const [alias, label] of MUNICIPALITY_ALIASES) {
    if (new RegExp(`\\b${alias}\\b`, "iu").test(text)) return label;
  }
  const match = text.match(/\b([a-z0-9õäöüšž-]{3,40}\s+(?:vald|linn))\b/iu);
  return match ? cleanText(match[1], 80) : "";
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
  const shareKeys = normalizeShareKeys(options.shareKeys || options.share || []);
  const includeAssistiveDevices = shareKeys.has("assistiveDevices");
  const serviceContinuity = readObjectFromContext(context, "serviceContinuity");
  const assistiveDevices = buildAssistiveDevicesHandoff(journey);
  const assistiveDevicesText = includeAssistiveDevices
    ? formatAssistiveDevicesForPreInquiry(assistiveDevices.devices)
    : "";
  const missingInfo = normalizeList(journey.missingInfo);
  const riskSignals = normalizeList(journey.riskSignals);
  const suggestedActions = normalizeList(journey.suggestedActions);
  const domains = normalizeList(journey.domains);
  const topic = serviceContinuity.serviceName
    ? cleanText(`Teenuse jätkumise täpsustamine: ${serviceContinuity.serviceName}`, 160)
    : cleanText(journey.title || journey.primaryPath || "Teekonna eelpöördumine", 160);
  const municipality = readStringFromContext(context, [
    "municipalityName",
    "municipality",
    "kov",
    "region"
  ]) || cleanText(serviceContinuity.municipality, 120) || municipalityFromText([journey.title, journey.summary].join(" "));
  const continuityParts = [
    serviceContinuity.serviceName ? `Teenus või tugi: ${cleanText(serviceContinuity.serviceName, 180)}` : "",
    serviceContinuity.currentProvider ? `Praegune teenuseosutaja või kontakt: ${cleanText(serviceContinuity.currentProvider, 180)}` : "",
    serviceContinuity.endDate ? `Teadaolev lõppkuupäev: ${cleanText(serviceContinuity.endDate, 80)}` : "",
    serviceContinuity.userGoal ? `Kasutaja eesmärk: ${cleanText(serviceContinuity.userGoal, 600)}` : ""
  ].filter(Boolean);
  const situationParts = [
    cleanText(journey.summary, 3000),
    assistiveDevicesText ? `Abivahendid ja kohandused:\n${assistiveDevicesText}` : "",
    continuityParts.length ? `Teenuse jätkumise kontroll:\n${continuityParts.join("\n")}` : "",
    domains.length ? `Seotud teemad: ${domains.join(", ")}` : "",
    suggestedActions.length ? `Soovitatud järgmised sammud: ${suggestedActions.join("; ")}` : "",
    riskSignals.length ? `Ettevaatlikud tähelepanekud: ${riskSignals.join("; ")}` : ""
  ].filter(Boolean);
  const situation = situationParts.join("\n\n");
  const missingInfoNotes = missingInfo.map((item) => `- ${item}`).join("\n");
  const sharedJourneyInfo = normalizePreInquiryJourneySharedInfo({
    source: "journey_pre_inquiry_handoff",
    summary: cleanText(journey.summary, 3000),
    domains,
    missingInfo,
    suggestedActions,
    primaryPath: cleanText(journey.primaryPath, 80),
    contextNote: [
      readStringFromContext(context, ["personContext", "person", "subject"], 1000),
      assistiveDevicesText ? `Abivahendid ja kohandused:\n${assistiveDevicesText}` : ""
    ].filter(Boolean).join("\n\n")
  });

  return {
    sourceJourneyId: journey.id || "",
    topic,
    situation,
    municipality,
    personContext: readStringFromContext(context, ["personContext", "person", "subject"], 500),
    recipientType: inferRecipientType(journey),
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
