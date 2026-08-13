import { inferHelpCategoryCode } from "./helpMediationHandoff.js";
import { resolveJourneyMunicipality } from "./municipalityResolver.js";

export const HELP_REQUEST_SHARE_KEYS = Object.freeze([
  "summary",
  "category",
  "region",
  "timing",
  "conditions",
  "ownWords"
]);

const HELP_REQUEST_SHARE_KEY_SET = new Set(HELP_REQUEST_SHARE_KEYS);

function cleanText(value, limit = 1000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function contextObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function partitionHelpRequestShareKeys(value) {
  if (!Array.isArray(value)) {
    const error = new TypeError("shareKeys must be an array");
    error.code = "INVALID_HELP_REQUEST_SHARE_KEYS";
    error.status = 400;
    throw error;
  }
  const confirmedKeys = [];
  const ignoredKeys = [];
  for (const item of value) {
    const key = String(item || "").trim();
    if (!key) continue;
    const target = HELP_REQUEST_SHARE_KEY_SET.has(key) ? confirmedKeys : ignoredKeys;
    if (!target.includes(key)) target.push(key);
  }
  return { confirmedKeys, ignoredKeys };
}

export function buildHelpRequestProjectionFromJourney(journey = {}, options = {}) {
  const { confirmedKeys, ignoredKeys } = partitionHelpRequestShareKeys(
    options.shareKeys ?? options.share ?? []
  );
  const selected = new Set(confirmedKeys);
  const context = contextObject(journey.context);
  const helpMediation = contextObject(context.helpMediation);
  const municipality = resolveJourneyMunicipality(journey);
  const summary = selected.has("summary") ? cleanText(journey.summary, 3000) : "";
  const ownWords = selected.has("ownWords")
    ? cleanText(context.personWish || context.ownWords, 1200)
    : "";
  const categoryCode = selected.has("category") ? inferHelpCategoryCode(journey) : "";
  const municipalityId = selected.has("region") ? municipality.municipalityId : "";
  const municipalityLabel = selected.has("region") ? municipality.municipalityName : "";
  const timing = selected.has("timing")
    ? cleanText(helpMediation.timing || context.timing, 300)
    : "";
  const conditions = selected.has("conditions")
    ? cleanText(helpMediation.conditions || context.conditions, 500)
    : "";
  const description = [
    summary,
    ownWords ? `Kasutaja sõnastatud vajadus: ${ownWords}` : ""
  ].filter(Boolean).join("\n\n");

  return {
    sourceJourneyId: cleanText(journey.id, 80),
    confirmedKeys,
    ignoredKeys,
    municipalityId,
    municipalityLabel,
    draft: {
      description,
      categoryCode,
      category: categoryCode,
      rawPlace: municipalityLabel,
      availabilityOrStart: timing,
      conditions,
      extraNotes: ""
    }
  };
}
