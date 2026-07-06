import { getHelpTaxonomyBridge } from "../help/taxonomyBridge.js";

const HELP_SIGNAL_RULES = Object.freeze([
  ["TRANSPORT", /\b(transport|sõit|soit|arsti juurde|liikumisabi|saatmine|teenusele jõudmine|teenusele joudmine|koju toomine|koju tuua|abivahendi toomine)\b/iu],
  ["DAILY_TASKS", /\b(poes käimine|poes kaimine|ostud|igapäevased toimingud|igapaevased toimingud|asjaajamine)\b/iu],
  ["HOME_HELP", /\b(koduabi|kodune abi|majapidamine|koristamine|kodune toimetulek|paigaldamine|abivahendi paigaldus)\b/iu],
  ["DIGITAL_HELP", /\b(digiabi|e-teenus|digiasjaajamine|arvuti|telefon|internet)\b/iu],
  ["CARE_SUPPORT", /\b(hooldus|hoolduskoormus|kõrvalabi|korvalabi|toetav kohalolu)\b/iu],
  ["CHILD_YOUTH_SUPPORT", /\b(laps|noor|lapse heaolu|peretugi|juhendamine)\b/iu],
  ["LEARNING_GUIDANCE", /\b(õppimine|oppimine|õpe|ope|juhendamine|oskuste arendamine)\b/iu],
  ["SOCIAL_SUPPORT", /\b(üksildus|uksildus|suhtlemine|sotsiaalne osalemine|kogukondlik tugi)\b/iu],
  ["ADMIN_FORM_HELP", /\b(avaldus|vorm|dokumendid|dokumendi|blankett|asjaajamine|taotluse täitmine|taotluse taitmine|abivahendi taotlus)\b/iu]
]);

function cleanText(value = "", limit = 180) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function normalizeList(value = []) {
  return (Array.isArray(value) ? value : [])
    .map((item) => (typeof item === "string" ? item : item?.title || item?.label || item?.name || ""))
    .map((item) => cleanText(item, 120))
    .filter(Boolean);
}

function mediationRelevantActions(value = []) {
  return (Array.isArray(value) ? value : []).filter((action) => {
    if (!action || typeof action !== "object") return true;
    const type = String(action.type || action.action || action.kind || "").trim().toUpperCase();
    return type !== "ASSISTIVE_DEVICES";
  });
}

function contextObject(journey = {}) {
  return journey.context && typeof journey.context === "object" && !Array.isArray(journey.context)
    ? journey.context
    : {};
}

function joinedJourneyText(journey = {}) {
  const context = contextObject(journey);
  return [
    journey.title,
    journey.summary,
    ...(journey.domains || []),
    ...(journey.missingInfo || []),
    ...(journey.riskSignals || []),
    ...normalizeList(mediationRelevantActions(journey.suggestedActions)),
    ...normalizeList(context.needTags),
    ...normalizeList(context.keywords)
  ].join(" ");
}

function inferHelpCategoryCode(journey = {}) {
  const text = joinedJourneyText(journey);
  for (const [code, pattern] of HELP_SIGNAL_RULES) {
    if (pattern.test(text)) return code;
  }
  return "";
}

function municipalityFromJourney(journey = {}) {
  const context = contextObject(journey);
  return cleanText(
    context.municipalityName
    || context.municipalityText
    || context.municipality
    || context.kov
    || context.region
    || context.municipalityId
    || ""
  );
}

export function buildHelpMediationHandoff(journey = {}) {
  const categoryCode = inferHelpCategoryCode(journey);
  const taxonomy = getHelpTaxonomyBridge(categoryCode || "OTHER");
  const municipalityName = municipalityFromJourney(journey);
  const params = new URLSearchParams();
  if (categoryCode) params.set("q", taxonomy.needTags[0] || categoryCode.toLowerCase());
  if (municipalityName) params.set("municipalityName", municipalityName);
  params.set("type", "HELP_OFFER");
  params.set("journeyContext", "1");

  const createParams = new URLSearchParams();
  createParams.set("workflow", "help_request");
  createParams.set("fromJourney", cleanText(journey.id, 80));
  createParams.set("shareReview", "1");
  if (categoryCode) createParams.set("category", categoryCode);
  if (municipalityName) createParams.set("municipalityName", municipalityName);

  return {
    hasPracticalNeed: Boolean(categoryCode),
    categoryCode,
    taxonomy,
    municipalityName,
    viewOffersHref: `/teenusekaart?${params.toString()}`,
    createRequestHref: `/vestlus?${createParams.toString()}`,
    createOfferHref: "/vestlus?workflow=help_offer",
    browseRequestsHref: "/teenusekaart?type=HELP_REQUEST&journeyContext=1"
  };
}
