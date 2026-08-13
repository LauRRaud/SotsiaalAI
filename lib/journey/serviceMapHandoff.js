import { hasHealthContactSignal } from "./healthContact.js";
import { buildAssistiveDevicesHandoff, hasAssistiveDeviceSignal } from "./assistiveDevices.js";
import { resolveJourneyMunicipality } from "./municipalityResolver.js";

const SERVICE_KEYWORD_PRIORITY = Object.freeze([
  "tervisekontakt",
  "perearst",
  "tervisekeskus",
  "koduteenus",
  "hooldus",
  "hooldaja",
  "abivahend",
  "transport",
  "tugiisik",
  "toimetulek",
  "võlanõustamine",
  "volanoustamine",
  "lastekaitse",
  "pere",
  "teenus",
  "kontakt"
]);

const DOMAIN_KEYWORDS = Object.freeze([
  [/hooldus|kõrvalabi|korvalabi/iu, "hooldus"],
  [/elukoht|kodune|eluase/iu, "koduteenus"],
  [/toimetulek|rahaline/iu, "toimetulek"],
  [/tervis|abivahend/iu, "abivahend"],
  [/laps|pere/iu, "lastekaitse"]
]);

function cleanText(value, limit = 120) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function lowerText(value) {
  return cleanText(value, 12000).toLocaleLowerCase("et");
}

function actionOpensServiceMap(action) {
  if (!action || typeof action !== "object") return false;
  const type = String(action.type || action.action || action.kind || "").trim().toUpperCase();
  return type === "SERVICE_MAP" || type === "OPEN_SERVICE_MAP";
}

function hasServiceMapSignal(journey = {}) {
  if (hasHealthContactSignal(journey)) return true;
  if (hasAssistiveDeviceSignal(journey)) return true;
  if (journey.primaryPath === "SERVICE_MAP") return true;
  if ((journey.suggestedActions || []).some(actionOpensServiceMap)) return true;
  return (journey.domains || []).some((domain) => DOMAIN_KEYWORDS.some(([pattern]) => pattern.test(String(domain || ""))));
}

function keywordFromJourney(journey = {}) {
  const contextKeywords = Array.isArray(journey.context?.keywords) ? journey.context.keywords : [];
  const assistiveDevices = buildAssistiveDevicesHandoff(journey);
  if (assistiveDevices.hasAssistiveDeviceNeed) return assistiveDevices.keyword || "abivahend";
  const joined = lowerText([
    journey.title,
    journey.summary,
    ...(journey.domains || []),
    ...contextKeywords
  ].join(" "));

  for (const keyword of SERVICE_KEYWORD_PRIORITY) {
    if (joined.includes(keyword)) return keyword;
  }
  if (hasHealthContactSignal(journey)) return "tervisekontakt";
  for (const domain of journey.domains || []) {
    const match = DOMAIN_KEYWORDS.find(([pattern]) => pattern.test(String(domain || "")));
    if (match) return match[1];
  }
  return "";
}

function entryTypeFromJourney(journey = {}) {
  if (hasHealthContactSignal(journey)) return "";
  const text = lowerText([
    journey.summary,
    ...(journey.suggestedActions || []).map((action) => `${action?.title || ""} ${action?.description || ""}`)
  ].join(" "));
  if (/\bkov\b|omavalitsus|kohalik omavalitsus/u.test(text)) return "KOV_SOCIAL_CONTACT";
  if (/teenuseosutaja|teenuse pakkuja|provider/u.test(text)) return "SERVICE_PROVIDER";
  return "";
}

export function buildServiceMapHandoff(journey = {}) {
  const params = new URLSearchParams();
  const municipality = resolveJourneyMunicipality(journey).municipalityName;
  const keyword = hasServiceMapSignal(journey) ? keywordFromJourney(journey) : "";
  const type = entryTypeFromJourney(journey);

  if (keyword) params.set("q", keyword);
  if (municipality) params.set("municipalityName", municipality);
  if (type) params.set("type", type);
  if (params.toString()) params.set("journeyContext", "1");

  const query = params.toString();
  return {
    href: query ? `/teenusekaart?${query}` : "/teenusekaart",
    hasFilter: Boolean(keyword || municipality || type),
    filters: {
      keyword,
      municipalityName: municipality,
      type
    }
  };
}
