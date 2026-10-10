import { getHelpTaxonomyBridge } from "../help/taxonomyBridge.js";
import { resolveJourneyMunicipality } from "./municipalityResolver.js";

/* SÕNAPIIR, MIS TUNNEB TÄPITÄHTI. JavaScripti `\b` ja `\w` loevad ka `u`-lipuga sõna osaks
   ainult ladina põhitähti, numbreid ja alakriipsu. Seepärast ei alanud „õppimine", „õpe" ega
   „üksildus" selle järgi sõnapiirilt ja need märksõnad ei sobinud kunagi; „töövorm" seevastu
   luges sõna „vorm" omaette sõnaks, sest „ö" ei olnud `\b` jaoks täht.

   Vasak piir on teksti algus või märk, mis ei ole täht ega number; parem piir on ettevaade.
   Tahavaadet (`(?<!…)`) siin meelega ei ole: seda faili loeb ka brauser (Teekonna leht) ja
   vanem Safari ei oska tahavaatega avaldist üldse lugeda, nii et kogu leht jääks avanemata. */
const WORD_CHAR = "[\\p{L}\\p{N}_]";

function wholeWords(...alternatives) {
  return new RegExp(`(?:^|[^\\p{L}\\p{N}_])(?:${alternatives.join("|")})(?!${WORD_CHAR})`, "iu");
}

const HELP_SIGNAL_RULES = Object.freeze([
  ["TRANSPORT", wholeWords(`transport${WORD_CHAR}*`, "sõit", "soit", "arsti juurde", "liikumisabi", "saatmine", "teenusele jõudmine", "teenusele joudmine", "koju toomine", "koju tuua", "abivahendi toomine")],
  ["DAILY_TASKS", wholeWords("poes käimine", "poes kaimine", "ostud", "igapäevased toimingud", "igapaevased toimingud", "asjaajamine")],
  ["HOME_HELP", wholeWords("koduabi", "kodune abi", "majapidamine", "koristamine", "kodune toimetulek", "paigaldamine", "abivahendi paigaldus")],
  ["DIGITAL_HELP", wholeWords("digiabi", "e-teenus", "digiasjaajamine", "arvuti", "telefon", "internet")],
  ["CARE_SUPPORT", wholeWords("hooldus", "hoolduskoormus", "kõrvalabi", "korvalabi", "toetav kohalolu")],
  ["CHILD_YOUTH_SUPPORT", wholeWords("laps", "noor", "lapse heaolu", "peretugi", "juhendamine")],
  ["LEARNING_GUIDANCE", wholeWords("õppimine", "oppimine", "õpe", "ope", "juhendamine", "oskuste arendamine")],
  ["SOCIAL_SUPPORT", wholeWords("üksildus", "uksildus", "suhtlemine", "sotsiaalne osalemine", "kogukondlik tugi")],
  ["ADMIN_FORM_HELP", wholeWords("avaldus", "vorm", "dokumendid", "dokumendi", "blankett", "asjaajamine", "taotluse täitmine", "taotluse taitmine", "abivahendi taotlus")]
]);

function cleanText(value = "", limit = 180) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function joinedJourneyText(journey = {}) {
  return [
    journey.summary,
    ...(journey.domains || [])
  ].join(" ");
}

export function inferHelpCategoryCode(journey = {}) {
  const text = joinedJourneyText(journey);
  for (const [code, pattern] of HELP_SIGNAL_RULES) {
    if (pattern.test(text)) return code;
  }
  return "";
}

export function buildHelpMediationHandoff(journey = {}) {
  const categoryCode = inferHelpCategoryCode(journey);
  const taxonomy = getHelpTaxonomyBridge(categoryCode || "OTHER");
  const { municipalityId, municipalityName } = resolveJourneyMunicipality(journey);
  const params = new URLSearchParams();
  if (categoryCode) params.set("q", taxonomy.needTags[0] || categoryCode.toLowerCase());
  if (municipalityName) params.set("municipalityName", municipalityName);
  params.set("type", "HELP_OFFER");
  params.set("journeyContext", "1");

  const createParams = new URLSearchParams();
  createParams.set("workflow", "help_request");
  createParams.set("fromJourney", cleanText(journey.id, 80));
  createParams.set("shareReview", "1");

  return {
    hasPracticalNeed: Boolean(categoryCode),
    categoryCode,
    taxonomy,
    municipalityId,
    municipalityName,
    viewOffersHref: `/teenusekaart?${params.toString()}`,
    createRequestHref: `/vestlus?${createParams.toString()}`,
    createOfferHref: "/vestlus?workflow=help_offer",
    browseRequestsHref: "/teenusekaart?type=HELP_REQUEST&journeyContext=1"
  };
}
