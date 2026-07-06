import { sourceMeetsEvidenceRequirement } from "../rag/riskPolicy.js";
import {
  isLegalSource as isRagLegalSource,
  sourceLayerFor
} from "../rag/sourceMetadata.js";
import { extractExactQueryAnchors } from "./queryAnchors.js";

const ATTRIBUTION_DECISION_REASONS = Object.freeze({
  INSUFFICIENT_EVIDENCE_STRENGTH: "insufficient_evidence_strength",
  LEGAL_ACT_MISMATCH: "legal_act_mismatch",
  LEGAL_BACKGROUND_SUPPRESSED_BY_RESOURCE_DISCOVERY: "legal_background_suppressed_by_resource_discovery",
  BACKGROUND_SUPPRESSED_BY_LIFE_SITUATION_GUIDANCE: "background_suppressed_by_life_situation_guidance",
  BACKGROUND_SUPPRESSED_BY_COMPARISON: "background_suppressed_by_comparison",
  LEGAL_CURRENT_SOURCE_REQUIRED: "legal_current_source_required",
  LEGAL_MUNICIPALITY_MISMATCH: "legal_municipality_mismatch",
  LEGAL_PARAGRAPH_NOT_IN_ANSWER_OR_PLAN: "legal_paragraph_not_in_answer_or_plan",
  LEGAL_SOURCE_TYPE_MISMATCH: "legal_source_type_mismatch",
  QUERY_ANCHOR_MISMATCH: "query_anchor_mismatch",
  REPLY_OVERLAP_VALIDATED: "reply_overlap_validated",
  SINGLE_CANDIDATE_KEPT: "single_candidate_kept",
  SYNTHESIS_CONTEXT_SELECTED: "synthesis_context_selected",
  WEAK_REPLY_OVERLAP: "weak_reply_overlap"
});

export const ALLOWED_ATTRIBUTION_DECISION_REASONS = new Set(Object.values(ATTRIBUTION_DECISION_REASONS));

const STOPWORDS = new Set([
  "aga", "and", "are", "because", "been", "but", "can", "could", "does", "for", "from", "has", "have", "into", "its", "jah", "kas", "kui", "kuidas", "mida", "milline", "mis", "ning", "not", "oli", "oma", "see", "seda", "selle", "that", "the", "this", "was", "were", "what", "when", "where", "which", "with",
  "что", "как", "для", "или", "это", "его", "она", "они", "при", "чем", "чего"
]);

const QUERY_ANCHOR_IGNORE_TOKENS = new Set([
  "benefit", "benefits", "kasuta", "kasutatakse", "kasutatud", "kasutab", "kasutavad", "kasutamine", "olemas", "pakub", "pakuvad", "pakutakse", "saab", "saada", "service", "services", "teenus", "toetus"
]);

// Generic continuation wording that carries no source identity of its own.
// A follow-up made only of these tokens (e.g. "Räägi sellest paragrahvist
// lähemalt") cannot anchor-match any title; reply overlap decides instead.
const GENERIC_FOLLOWUP_QUERY_TOKENS = new Set([
  "raagi", "raakige", "selgita", "selgitage", "tapsusta", "tapsustage",
  "sellest", "sellele", "selle", "seda", "sealt", "seal",
  "lahemalt", "tapsemalt", "pikemalt", "rohkem", "veel", "palun",
  "paragrahv", "paragrahvi", "paragrahvist", "punkt", "punkti", "punktist",
  "allikas", "allika", "allikast", "artikkel", "artikli", "artiklist",
  "dokument", "dokumendi", "dokumendist", "seadus", "seaduse", "seadusest"
]);

function isGenericSourceFollowupQuery(query = "") {
  const tokens = uniqueTokens(normalizeText(query))
    .filter(token => !QUERY_ANCHOR_IGNORE_TOKENS.has(token))
    .filter(token => !GENERIC_FOLLOWUP_QUERY_TOKENS.has(token));
  return tokens.length === 0;
}

const WEAK_ORGANIZATION_NAME_ANCHORS = new Set([
  "asutus",
  "center",
  "centre",
  "keskus",
  "koda",
  "liit",
  "mtu",
  "organisatsioon",
  "sihtasutus",
  "uhendus",
  "uhing"
]);

const DEFAULT_TOPIC_IGNORE_TOKENS = new Set([
  "kas",
  "kusimus",
  "oluline",
  "seotud",
  "sotsiaalvaldkond",
  "teema"
]);

const MUNICIPALITY_SERVICE_SOURCE_TYPES = new Set([
  "kov_regulation",
  "kov_service",
  "kov_service_info",
  "kov_web",
  "municipal_regulation",
  "municipality_kov",
  "municipality_service",
  "municipality_web",
  "riigiteataja_regulation"
]);

const SERVICE_ITEM_TYPES = new Set(["benefit", "service", "toetus"]);

const SYNTHESIS_SOURCE_TYPES = new Set([
  "organization_profile",
  "organization_page",
  "public_body_info",
  "partner_service_info",
  "service_provider_info",
  "contact_page",
  "contacts",
  "journal_article",
  "official_guideline",
  "information_material",
  "analysis",
  "research_report",
  "study",
  "survey_report",
  "evaluation_report",
  "statistics",
  "statistical_report",
  "official_report",
  "methodology_guide",
  "state_guide",
  "quality_guideline",
  "service_standard",
  "practice_example",
  "project_description",
  "academic_paper",
  "policy_report",
  "policy_analysis",
  "guide",
  "manual",
  "training_material",
  "methodology_material",
  "worksheet",
  "template"
]);

const SYNTHESIS_COLLECTION_IDS = new Set([
  "organizations",
  "contacts",
  "public_body_info",
  "partner_service_info",
  "service_provider_info",
  "sotsiaaltoo_articles",
  "journal_articles",
  "studies",
  "research_reports",
  "national_guidelines",
  "policy_analyses",
  "organization_guidelines",
  "organization_materials",
  "training_materials",
  "statistics",
  "guides",
  "methodology_guides",
  "templates"
]);

const LIFE_SITUATION_SOURCE_TYPES = new Set([
  "national_law",
  "law",
  "kov_regulation",
  "regulation",
  "riigiteataja_regulation",
  "kov_service",
  "kov_service_info",
  "kov_web",
  "municipality_kov",
  "municipality_service",
  "municipality_web",
  "public_body_info",
  "official_guideline",
  "information_material",
  "contact_page",
  "contacts",
  "journal_article",
  "research_report",
  "study"
]);

const LIFE_SITUATION_COLLECTION_IDS = new Set([
  "national_law",
  "kov_rt",
  "kov_legal",
  "kov_services",
  "kov_web",
  "public_body_info",
  "national_guidelines",
  "contacts",
  "sotsiaaltoo_articles",
  "journal_articles",
  "research_reports",
  "studies"
]);

const LIFE_SITUATION_BACKGROUND_SOURCE_TYPES = new Set([
  "journal_article",
  "research_report",
  "study",
  "analysis"
]);

const LIFE_SITUATION_BACKGROUND_COLLECTION_IDS = new Set([
  "sotsiaaltoo_articles",
  "journal_articles",
  "research_reports",
  "studies"
]);

const COMPARISON_SOURCE_TYPES = new Set([
  "national_law",
  "law",
  "kov_regulation",
  "regulation",
  "riigiteataja_regulation",
  "kov_service",
  "kov_service_info",
  "kov_web",
  "municipality_kov",
  "municipality_service",
  "municipality_web",
  "public_body_info",
  "official_guideline",
  "methodology_guide",
  "methodology_material",
  "information_material",
  "journal_article",
  "research_report",
  "study",
  "analysis"
]);

const COMPARISON_COLLECTION_IDS = new Set([
  "national_law",
  "kov_rt",
  "kov_legal",
  "kov_services",
  "kov_web",
  "public_body_info",
  "national_guidelines",
  "methodology_guides",
  "guides",
  "sotsiaaltoo_articles",
  "journal_articles",
  "research_reports",
  "studies"
]);

const COMPARISON_BACKGROUND_SOURCE_TYPES = new Set([
  "journal_article",
  "research_report",
  "study",
  "analysis"
]);

const COMPARISON_BACKGROUND_COLLECTION_IDS = new Set([
  "sotsiaaltoo_articles",
  "journal_articles",
  "research_reports",
  "studies"
]);

const THEMATIC_QUERY_ISSUE_TOKENS = new Set([
  "probleem", "probleemid", "probleemne", "probleemsed",
  "kitsaskoht", "kitsaskohad", "mure", "mured", "murekoht", "murekohad", "murekohti",
  "puudus", "puudused", "puudujaak", "takistus", "takistused",
  "raskus", "raskused", "risk", "riskid", "valjakutse", "valjakutsed"
]);

function normalizeText(value = "") {
  return String(value || "")
    .replace(/\bshs\b/giu, "sotsiaalhoolekande seadus")
    .replace(/\bseadus\p{Letter}*/giu, "seadus")
    .replace(/\bparagrahv\p{Letter}*/giu, "paragrahv")
    .replace(/\btoimetulekutoetus\p{Letter}*/giu, "toimetulekutoetus")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeToken(token = "") {
  const value = String(token || "").trim();
  if (!value) return "";
  if (/^koduteen/.test(value)) return "koduteenus";
  if (/^tugiisikuteen/.test(value)) return "tugiisikuteenus";
  if (/^tugiisik/.test(value)) return "tugiisik";
  if (/^abistaja/.test(value)) return "abistaja";
  if (/^sotsiaalteen/.test(value)) return "sotsiaalteenus";
  if (/^toimetulekutoetu/.test(value)) return "toimetulekutoetus";
  if (/^hooldajatoetu/.test(value)) return "hooldajatoetus";
  if (/^lastekait/.test(value)) return "lastekaitse";
  if (/^tootukass/.test(value)) return "tootukassa";
  if (/^tehisintellekt/.test(value)) return "tehisintellekt";
  if (/^eetika/.test(value) || /^eetili/.test(value)) return "eetika";
  if (/^kusimus/.test(value)) return "kusimus";
  if (/^oluli/.test(value)) return "oluline";
  if (/^sotsiaalvaldk/.test(value)) return "sotsiaalvaldkond";
  if (/^toetu/.test(value)) return "toetus";
  if (/^teen(us|use|ust|useid|used|uste|usega|uses|usel|usele|usest|useks|useta|ustele|ustel|ustest|ustesse)$/.test(value)) {
    return "teenus";
  }
  if (/^(vald|valla|valda|vallas|vallast|vallale|vallal|vallalt|vallasse|vallaga|vallata|vallaks|vallani|vallana)$/.test(value)) {
    return "vald";
  }
  if (/^(linn|linna|linnas|linnast|linnale|linnal|linnalt|linnasse|linnaga|linnata|linnaks|linnani|linnana)$/.test(value)) {
    return "linn";
  }
  return value;
}

function tokensCompatible(left = "", right = "") {
  const a = String(left || "").trim();
  const b = String(right || "").trim();
  if (!a || !b) return false;
  if (a === b) return true;
  const minLength = Math.min(a.length, b.length);
  if (minLength >= 5 && (a.startsWith(b) || b.startsWith(a))) return true;
  return false;
}

function tokenListHasCompatible(tokens = [], token = "") {
  return (Array.isArray(tokens) ? tokens : []).some(sourceToken => tokensCompatible(sourceToken, token));
}

function tokenize(value = "") {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return normalized
    .split(" ")
    .map(token => token.trim())
    .map(normalizeToken)
    .filter(token => token.length >= 3)
    .filter(token => !STOPWORDS.has(token));
}

function uniqueTokens(value = "") {
  return Array.from(new Set(tokenize(value)));
}

function bigrams(tokens = []) {
  const out = new Set();
  for (let i = 0; i < tokens.length - 1; i += 1) {
    out.add(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return out;
}

function sourceText(source = {}) {
  return [
    source.title,
    source.short_ref,
    source.section,
    source.organization_name,
    source.organizationName,
    source.organization_id,
    source.organizationId,
    source.organization_slug,
    source.organizationSlug,
    source.metadata?.organization_name,
    source.metadata?.organizationName,
    source.metadata?.organization_id,
    source.metadata?.organizationId,
    source.metadata?.organization_slug,
    source.metadata?.organizationSlug,
    source.municipality_name,
    source.municipalityName,
    source.metadata?.municipality_name,
    source.metadata?.municipalityName,
    source.service_name,
    source.serviceName,
    source.canonical_item_id,
    source.canonicalItemId,
    source.item_type,
    source.itemType,
    source.resource_type,
    source.resourceType,
    source.paragraphNumber,
    source.paragraphTitle,
    source.journalTitle,
    source.text,
    source.chunk,
    source.evidenceText
  ].filter(Boolean).join("\n");
}

function sourceComparisonIdentityText(source = {}) {
  return [
    source.title,
    source.short_ref,
    source.section,
    source.service_name,
    source.serviceName,
    source.canonical_item_id,
    source.canonicalItemId,
    source.item_type,
    source.itemType,
    source.resource_type,
    source.resourceType,
    source.paragraphTitle,
    source.paragraph_title,
    source.metadata?.paragraphTitle,
    source.metadata?.paragraph_title,
    source.metadata?.service_name,
    source.metadata?.serviceName,
    source.metadata?.canonical_item_id,
    source.metadata?.canonicalItemId
  ].filter(Boolean).join("\n");
}

function normalizeParagraphRef(ref = "") {
  return String(ref || "").trim().replace(/\s+/g, "");
}

function normalizeActTitle(value = "") {
  return normalizeText(value)
    .replace(/\bseadus\b/gu, "seadus")
    .trim();
}

export function extractParagraphRefsFromReply(reply = "") {
  const refs = new Set();
  const source = String(reply || "");
  for (const match of source.matchAll(/(?:§+\s*|paragrahv(?:i|is|ist|ile|il|iga|iks)?\s+)(\d+[a-z]?)/giu)) {
    const ref = normalizeParagraphRef(match?.[1]);
    if (ref) refs.add(ref);
  }
  return Array.from(refs).slice(0, 8);
}

function sourceParagraphNumber(source = {}) {
  return normalizeParagraphRef(
    source?.paragraphNumber ||
    source?.paragraph_number ||
    source?.metadata?.paragraph_number ||
    source?.metadata?.paragraphNumber
  );
}

function sourceActTitle(source = {}) {
  return String(
    source?.actTitle ||
    source?.act_title ||
    source?.metadata?.act_title ||
    source?.metadata?.actTitle ||
    ""
  ).trim();
}

function sourceMunicipalityId(source = {}) {
  return String(
    source?.municipalityId ||
    source?.municipality_id ||
    source?.metadata?.municipality_id ||
    source?.metadata?.municipalityId ||
    ""
  ).trim();
}

export function isLegalSource(source = {}) {
  return isRagLegalSource({ source_type: source?.sourceType || source?.source_type });
}

function isNamedThingQuestion(query = "") {
  const normalized = normalizeText(query);
  if (!normalized) return false;
  if (/^(mis|mida|milline|what|which)\s+(on|oli|was|is)\b/.test(normalized)) return true;
  if (/^(что|какой|какая|какое)\s+/.test(normalized)) return true;
  const tokens = uniqueTokens(query);
  return tokens.length >= 1 && tokens.length <= 4 && normalized.length <= 90;
}

function sourceType(source = {}) {
  return String(source?.sourceType || source?.source_type || "").trim();
}

function sourceItemType(source = {}) {
  return String(source?.itemType || source?.item_type || source?.resourceType || source?.resource_type || "").trim().toLowerCase();
}

function isMunicipalityServiceOrBenefitSource(source = {}) {
  return MUNICIPALITY_SERVICE_SOURCE_TYPES.has(sourceType(source)) || SERVICE_ITEM_TYPES.has(sourceItemType(source));
}

function collectionId(source = {}) {
  return String(source?.collectionId || source?.collection_id || source?.metadata?.collection_id || source?.metadata?.collectionId || "").trim();
}

function isSynthesisSource(source = {}) {
  if (SYNTHESIS_SOURCE_TYPES.has(sourceType(source))) return true;
  if (SYNTHESIS_COLLECTION_IDS.has(collectionId(source))) return true;
  return false;
}

function isSynthesisQueryPlan(queryPlan = {}) {
  const mode = String(queryPlan?.mode || queryPlan?.queryPlanMode || "").trim();
  const strategy = String(queryPlan?.selection_strategy || queryPlan?.selectionStrategy || "").trim();
  return mode === "overview_synthesis" ||
    mode === "thematic_synthesis" ||
    mode === "broad_multi_source" ||
    mode === "resource_discovery" ||
    strategy === "overview_diversity_then_depth" ||
    strategy === "multi_source_diversity" ||
    strategy === "resource_discovery_diversity";
}

function isResourceDiscoveryQueryPlan(queryPlan = {}) {
  const mode = String(queryPlan?.mode || queryPlan?.queryPlanMode || "").trim();
  const strategy = String(queryPlan?.selection_strategy || queryPlan?.selectionStrategy || "").trim();
  return mode === "resource_discovery" || strategy === "resource_discovery_diversity";
}

function isOverviewSynthesisQueryPlan(queryPlan = {}) {
  const mode = String(queryPlan?.mode || queryPlan?.queryPlanMode || "").trim();
  const strategy = String(queryPlan?.selection_strategy || queryPlan?.selectionStrategy || "").trim();
  return mode === "overview_synthesis" || strategy === "overview_diversity_then_depth";
}

function isLifeSituationGuidanceQueryPlan(queryPlan = {}) {
  const mode = String(queryPlan?.mode || queryPlan?.queryPlanMode || "").trim();
  const strategy = String(queryPlan?.selection_strategy || queryPlan?.selectionStrategy || "").trim();
  const retrievalStrategy = String(queryPlan?.retrieval_strategy || queryPlan?.retrievalStrategy || queryPlan?.retrieval_strategy_selection?.retrieval_strategy || "").trim();
  return mode === "life_situation_guidance" ||
    retrievalStrategy === "life_situation_guidance_hybrid" ||
    (strategy === "multi_source_diversity" && queryPlan?.question_planner?.mode === "life_situation_guidance");
}

function isComparisonQueryPlan(queryPlan = {}) {
  const mode = String(queryPlan?.mode || queryPlan?.queryPlanMode || "").trim();
  const strategy = String(queryPlan?.selection_strategy || queryPlan?.selectionStrategy || "").trim();
  const retrievalStrategy = String(queryPlan?.retrieval_strategy || queryPlan?.retrievalStrategy || queryPlan?.retrieval_strategy_selection?.retrieval_strategy || "").trim();
  return mode === "comparison" ||
    retrievalStrategy === "comparison_balanced_sources" ||
    (strategy === "multi_source_diversity" && queryPlan?.question_planner?.mode === "comparison");
}

function synthesisTopicTokens(query = "") {
  return uniqueTokens(query)
    .filter(token => !QUERY_ANCHOR_IGNORE_TOKENS.has(token))
    .filter(token => !THEMATIC_QUERY_ISSUE_TOKENS.has(token));
}

function sourceMatchesSynthesisTopic(query = "", source = {}) {
  const queryTokens = synthesisTopicTokens(query);
  if (!queryTokens.length) return true;
  const sourceTokens = uniqueTokens(sourceText(source));
  return queryTokens.some(token => tokenListHasCompatible(sourceTokens, token));
}

function sourceMatchesExactQueryAnchors(query = "", source = {}) {
  const anchors = extractExactQueryAnchors(query);
  if (!anchors.length) return true;
  const sourceTokens = uniqueTokens(sourceText(source));
  const matchedCount = anchors.filter(token => tokenListHasCompatible(sourceTokens, token)).length;
  const required = anchors.length >= 3 ? 2 : 1;
  return matchedCount >= required;
}

function defaultQueryTopicTokens(query = "") {
  return uniqueTokens(query)
    .filter(token => !STOPWORDS.has(token))
    .filter(token => !QUERY_ANCHOR_IGNORE_TOKENS.has(token))
    .filter(token => !DEFAULT_TOPIC_IGNORE_TOKENS.has(token))
    .filter(token => !THEMATIC_QUERY_ISSUE_TOKENS.has(token));
}

function sourceMatchesDefaultQueryTopic(query = "", source = {}) {
  const queryTokens = defaultQueryTopicTokens(query);
  if (!queryTokens.length) return true;
  const sourceTokens = uniqueTokens(sourceText(source));
  return queryTokens.some(token => tokenListHasCompatible(sourceTokens, token));
}

function sourceMatchesResourceDiscoveryQuery(query = "", source = {}) {
  if (!isSynthesisSource(source)) return false;
  const anchors = extractExactQueryAnchors(query);
  if (!anchors.length) return true;
  const sourceTokens = uniqueTokens(sourceText(source));
  const distinctiveAnchors = anchors.filter(anchor => !WEAK_ORGANIZATION_NAME_ANCHORS.has(normalizeToken(anchor)));
  if (distinctiveAnchors.length && !distinctiveAnchors.some(token => tokenListHasCompatible(sourceTokens, normalizeToken(token)))) {
    return false;
  }
  return sourceMatchesExactQueryAnchors(query, source);
}

function isLifeSituationSource(source = {}) {
  if (LIFE_SITUATION_SOURCE_TYPES.has(sourceType(source))) return true;
  if (LIFE_SITUATION_COLLECTION_IDS.has(collectionId(source))) return true;
  if (isMunicipalityServiceOrBenefitSource(source)) return true;
  if (isLegalSource(source)) return true;
  return false;
}

function isLifeSituationBackgroundSource(source = {}) {
  if (LIFE_SITUATION_BACKGROUND_SOURCE_TYPES.has(sourceType(source))) return true;
  if (LIFE_SITUATION_BACKGROUND_COLLECTION_IDS.has(collectionId(source))) return true;
  return false;
}

function lifeSituationQueryTokens(queryPlan = {}) {
  const out = [];
  const topics = Array.isArray(queryPlan?.question_planner?.topics)
    ? queryPlan.question_planner.topics
    : Array.isArray(queryPlan?.topics) ? queryPlan.topics : [];
  for (const topic of topics) {
    out.push(...uniqueTokens(String(topic || "").replace(/_/g, " ")));
  }
  const lifeSituation = String(queryPlan?.question_planner?.life_situation || queryPlan?.life_situation || "");
  if (lifeSituation === "financial_hardship") {
    out.push(
      "toimetulekutoetus",
      "valtimatu",
      "sotsiaalabi",
      "taiendav",
      "sotsiaaltoetus",
      "volanoustamine",
      "toiduabi",
      "uurivolg",
      "ajutine",
      "majutus",
      "varjupaigateenus"
    );
  }
  if (lifeSituation === "elderly_relative_care_difficulty") {
    out.push("koduteenus", "abivajadus", "hindamine", "hooldus", "uldhooldusteenus", "sotsiaaltransport");
  }
  if (lifeSituation === "disabled_child_family_support") {
    out.push("puudega", "laps", "lapsehoiuteenus", "tugiisikuteenus", "rehabilitatsioon", "sotsiaalkindlustusamet");
  }
  return Array.from(new Set(out.filter(token => token && !QUERY_ANCHOR_IGNORE_TOKENS.has(token))));
}

function sourceMatchesLifeSituationQuery(query = "", source = {}, queryPlan = {}) {
  if (!isLifeSituationSource(source)) return false;
  const topicTokens = lifeSituationQueryTokens(queryPlan);
  if (!topicTokens.length) return sourceMatchesSynthesisTopic(query, source);
  const sourceTokens = uniqueTokens(sourceText(source));
  return topicTokens.some(token => tokenListHasCompatible(sourceTokens, token));
}

function isComparisonSource(source = {}) {
  if (COMPARISON_SOURCE_TYPES.has(sourceType(source))) return true;
  if (COMPARISON_COLLECTION_IDS.has(collectionId(source))) return true;
  if (isMunicipalityServiceOrBenefitSource(source)) return true;
  if (isLegalSource(source)) return true;
  return false;
}

function isComparisonBackgroundSource(source = {}) {
  if (COMPARISON_BACKGROUND_SOURCE_TYPES.has(sourceType(source))) return true;
  if (COMPARISON_BACKGROUND_COLLECTION_IDS.has(collectionId(source))) return true;
  return false;
}

function comparisonQueryTokens(queryPlan = {}, query = "") {
  const out = [];
  const topics = Array.isArray(queryPlan?.question_planner?.topics)
    ? queryPlan.question_planner.topics
    : Array.isArray(queryPlan?.topics) ? queryPlan.topics : [];
  for (const topic of topics) {
    out.push(...uniqueTokens(String(topic || "").replace(/_/g, " ")));
    if (topic === "koduteenus") out.push("koduteenus", "koduse", "kodu", "koristamine", "toiduvalmistamine", "asjaajamine");
    if (topic === "tugiisikuteenus") out.push("tugiisikuteenus", "tugiisik", "juhendamine", "motiveerimine", "iseseisev", "toimetulek");
    if (topic === "isikliku_abistaja_teenus") out.push("isiklik", "abistaja", "kõrvalabi", "korvalabi", "osalemine");
    if (topic === "lapsehoiuteenus") out.push("lapsehoid", "lapsehoiuteenus", "hooldamine");
    if (topic === "uldhooldusteenus") out.push("uldhooldusteenus", "hooldekodu", "hooldus");
    if (topic === "sotsiaaltransporditeenus") out.push("sotsiaaltransport", "transport");
  }
  if (!out.length) {
    out.push(...uniqueTokens(query));
  }
  return Array.from(new Set(out.filter(token => token && !QUERY_ANCHOR_IGNORE_TOKENS.has(token))));
}

function comparisonTopicIdentitySets(queryPlan = {}, query = "") {
  const topics = Array.isArray(queryPlan?.question_planner?.topics)
    ? queryPlan.question_planner.topics
    : Array.isArray(queryPlan?.topics) ? queryPlan.topics : [];
  const sets = [];
  for (const topic of topics) {
    if (topic === "koduteenus") sets.push(["koduteenus"]);
    if (topic === "tugiisikuteenus") sets.push(["tugiisikuteenus", "tugiisik"]);
    if (topic === "isikliku_abistaja_teenus") sets.push(["isiklik", "abistaja"]);
    if (topic === "lapsehoiuteenus") sets.push(["lapsehoiuteenus", "lapsehoid"]);
    if (topic === "uldhooldusteenus") sets.push(["uldhooldusteenus", "hooldekodu"]);
    if (topic === "sotsiaaltransporditeenus") sets.push(["sotsiaaltransporditeenus", "sotsiaaltransport"]);
  }
  if (sets.length) return sets;
  const queryTokens = uniqueTokens(query)
    .filter(token => !QUERY_ANCHOR_IGNORE_TOKENS.has(token))
    .filter(token => /teenus$/.test(token) || token === "tugiisik" || token === "abistaja");
  return queryTokens.map(token => [token]);
}

function sourceMatchesComparisonTopicIdentity(query = "", source = {}, queryPlan = {}) {
  const topicSets = comparisonTopicIdentitySets(queryPlan, query);
  if (!topicSets.length) return true;
  const sourceTokens = uniqueTokens(sourceComparisonIdentityText(source));
  if (!sourceTokens.length) return false;
  return topicSets.some(topicTokens =>
    topicTokens.some(token => tokenListHasCompatible(sourceTokens, token))
  );
}

function sourceMatchesComparisonQuery(query = "", source = {}, queryPlan = {}) {
  if (!isComparisonSource(source)) return false;
  if (!sourceMatchesComparisonTopicIdentity(query, source, queryPlan)) return false;
  const topicTokens = comparisonQueryTokens(queryPlan, query);
  if (!topicTokens.length) return sourceMatchesSynthesisTopic(query, source);
  const sourceTokens = uniqueTokens(sourceText(source));
  return topicTokens.some(token => tokenListHasCompatible(sourceTokens, token));
}

function normalizeIdentifier(value = "") {
  return String(value || "").trim().toLowerCase().replace(/-/g, "_");
}

function municipalityContextEntries(context = []) {
  return (Array.isArray(context) ? context : [])
    .map(item => ({
      ids: [
        item?.id,
        item?.municipalityId,
        item?.municipality_id,
        item?.slug
      ].map(normalizeIdentifier).filter(Boolean),
      names: [
        item?.displayName,
        `${item?.baseName || ""} ${String(item?.type || "").toLowerCase()}`.trim()
      ].filter(Boolean)
    }))
    .filter(item => item.ids.length || item.names.length);
}

function sourceMatchesMunicipalityContext(source = {}, context = []) {
  const entries = municipalityContextEntries(context);
  if (!entries.length) return true;
  const sourceMunicipality = normalizeIdentifier(sourceMunicipalityId(source));
  const sourceTokens = new Set(uniqueTokens(sourceText(source)));
  for (const entry of entries) {
    if (sourceMunicipality && entry.ids.includes(sourceMunicipality)) return true;
    for (const name of entry.names) {
      const nameTokens = uniqueTokens(name);
      if (nameTokens.length && nameTokens.every(token => sourceTokens.has(token))) return true;
    }
  }
  return false;
}

function serviceBenefitAnchorTokens(query = "") {
  return uniqueTokens(query).filter(token => {
    if (QUERY_ANCHOR_IGNORE_TOKENS.has(token)) return false;
    if (token === "sotsiaalteenus") return false;
    return /teenus$/.test(token) || /toetus$/.test(token);
  });
}

function isServiceBenefitQuery(query = "") {
  const tokens = uniqueTokens(query);
  return tokens.some(token => token === "teenus" || token === "sotsiaalteenus" || token === "toetus" || /teenus$/.test(token) || /toetus$/.test(token));
}

function sourceMatchesMunicipalityServiceBenefitQuery(query = "", source = {}, options = {}) {
  if (!isMunicipalityServiceOrBenefitSource(source)) return false;
  if (!isServiceBenefitQuery(query)) return false;
  if (!municipalityContextEntries(options?.municipalityContext).length) return false;
  if (!sourceMatchesMunicipalityContext(source, options?.municipalityContext)) return false;
  const specificTokens = serviceBenefitAnchorTokens(query);
  if (!specificTokens.length) return true;
  const sourceTokens = uniqueTokens(sourceText(source));
  return specificTokens.some(token => tokenListHasCompatible(sourceTokens, token));
}

function sourceMatchesQueryAnchor(query = "", source = {}, options = {}) {
  if (isLegalExactQuery(query)) return sourceMatchesLegalExactQuery(query, source);
  if (sourceMatchesMunicipalityServiceBenefitQuery(query, source, options)) return true;
  // A purely generic follow-up cannot anchor-match any source title; let the
  // reply-overlap threshold decide which selected sources actually supported
  // the continued answer.
  if (isGenericSourceFollowupQuery(query)) return true;
  if (!sourceMatchesExactQueryAnchors(query, source)) return false;
  if (!sourceMatchesDefaultQueryTopic(query, source)) return false;
  if (!isNamedThingQuestion(query)) return true;
  const queryTokens = uniqueTokens(query)
    .filter(token => !QUERY_ANCHOR_IGNORE_TOKENS.has(token));
  if (!queryTokens.length) return true;

  const sourceTokens = uniqueTokens(sourceText(source));
  const matched = queryTokens.filter(token => tokenListHasCompatible(sourceTokens, token));
  const required = queryTokens.length >= 2 ? queryTokens.length : 1;
  return matched.length >= required;
}

function isLegalExactQuery(query = "") {
  const normalized = normalizeText(query);
  return /\b\d{1,3}[a-z]?\b/.test(normalized) &&
    /\b(seadus|sotsiaalhoolekande|paragrahv)\b/.test(normalized);
}

function sourceMatchesLegalExactQuery(query = "", source = {}) {
  if (!isLegalExactQuery(query)) return false;
  const normalizedQuery = normalizeText(query);
  const normalizedSource = normalizeText(sourceText(source));
  if (!normalizedQuery || !normalizedSource) return false;
  const paragraphRef = normalizedQuery.match(/\b(\d{1,3}[a-z]?)\b/)?.[1] || "";
  if (paragraphRef && !new RegExp(`\\b${paragraphRef}\\b`).test(normalizedSource)) return false;
  const queryTokens = uniqueTokens(normalizedQuery)
    .filter(token => !/^(sotsiaalhoolekande|seadus|paragrahv)$/.test(token))
    .filter(token => !/^\d{1,3}[a-z]?$/.test(token));
  if (!queryTokens.length) return true;
  const sourceTokens = new Set(uniqueTokens(normalizedSource));
  return queryTokens.some(token => sourceTokens.has(token));
}

function scoreSourceForReply(reply = "", source = {}) {
  const replyNormalized = normalizeText(reply);
  const sourceNormalized = normalizeText(sourceText(source));
  if (!replyNormalized || !sourceNormalized) return 0;

  const titleNormalized = normalizeText(source.title || "");
  let score = titleNormalized && replyNormalized.includes(titleNormalized) ? 6 : 0;

  const replyTokens = uniqueTokens(replyNormalized);
  const sourceTokens = uniqueTokens(sourceNormalized);
  if (!replyTokens.length || !sourceTokens.length) return score;

  const common = sourceTokens.filter(token => tokenListHasCompatible(replyTokens, token));
  const uncommonCommon = common.filter(token => token.length >= 5 || /\d/.test(token));
  score += common.length * 0.8 + uncommonCommon.length * 0.7;

  const replyBigrams = bigrams(replyTokens);
  const sourceBigrams = bigrams(sourceTokens);
  for (const phrase of sourceBigrams) {
    if (replyBigrams.has(phrase)) score += 1.8;
  }

  const year = String(source.year || "").match(/\b(19|20)\d{2}\b/)?.[0] || "";
  if (year && new RegExp(`\\b${year}\\b`).test(replyNormalized)) score += 1;

  const coverage = common.length / Math.max(1, Math.min(replyTokens.length, sourceTokens.length));
  if (common.length >= 3 && coverage >= 0.08) score += 1.2;

  return score;
}

function stripSourceEvidence(source = {}) {
  if (!source || typeof source !== "object") return source;
  const { evidenceText: _evidenceText, ...rest } = source;
  const displayUrl = getDisplaySourceUrl(rest);
  if (!displayUrl) return rest;
  return {
    ...rest,
    url: rest.url || displayUrl,
    url_canonical: rest.url_canonical || rest.urlCanonical || displayUrl
  };
}

function getDisplaySourceUrl(source = {}) {
  return String(
    source?.url ||
    source?.url_canonical ||
    source?.urlCanonical ||
    source?.source_url ||
    source?.sourceUrl ||
    source?.official_url ||
    source?.officialUrl ||
    source?.official_website ||
    source?.officialWebsite ||
    source?.metadata?.url ||
    source?.metadata?.url_canonical ||
    source?.metadata?.urlCanonical ||
    source?.metadata?.source_url ||
    source?.metadata?.sourceUrl ||
    source?.metadata?.official_url ||
    source?.metadata?.officialUrl ||
    source?.metadata?.official_website ||
    source?.metadata?.officialWebsite ||
    ""
  ).trim();
}

export function getSourceAttributionId(source = {}, index = 0) {
  const legalId =
    isLegalSource(source)
      ? source?.id || source?.key || source?.chunk_id || source?.chunkId
      : "";
  const raw =
    legalId ||
    source?.source_id ||
    source?.sourceId ||
    source?.id ||
    source?.key ||
    source?.url ||
    source?.url_canonical ||
    source?.urlCanonical ||
    source?.source_url ||
    source?.sourceUrl ||
    source?.official_url ||
    source?.officialUrl ||
    source?.official_website ||
    source?.officialWebsite ||
    source?.metadata?.official_website ||
    source?.metadata?.officialWebsite ||
    source?.short_ref ||
    source?.title ||
    `source_${index}`;
  return String(raw || `source_${index}`).trim() || `source_${index}`;
}

function buildDecision(source, index, decision, reason, score = 0, evidence = null) {
  const sourceType = String(source?.sourceType || source?.source_type || "").trim() || undefined;
  const sourceLayerContract = sourceLayerFor(source);
  const paragraphNumber = sourceParagraphNumber(source) || undefined;
  const actTitle = sourceActTitle(source) || undefined;
  const municipalityId = sourceMunicipalityId(source) || undefined;
  const sourceStatus = String(source?.source_status || source?.sourceStatus || "").trim() || undefined;
  return {
    source_id: getSourceAttributionId(source, index),
    source_index: index,
    decision,
    reason,
    score: Number.isFinite(score) ? Number(score.toFixed(3)) : 0,
    ...(sourceType ? { source_type: sourceType } : {}),
    source_layer_contract: sourceLayerContract,
    ...(paragraphNumber ? { paragraph_number: paragraphNumber } : {}),
    ...(actTitle ? { act_title: actTitle } : {}),
    ...(municipalityId ? { municipality_id: municipalityId } : {}),
    ...(sourceStatus ? { source_status: sourceStatus } : {}),
    ...(source?.historical === true ? { historical: true } : {}),
    ...(evidence?.strength ? { evidence_strength: evidence.strength } : {}),
    ...(evidence?.requiredEvidence ? { required_evidence: evidence.requiredEvidence } : {}),
    ...(evidence?.reason ? { evidence_reason: evidence.reason } : {})
  };
}

function buildAttributionResult(list, decisions, displayedItems) {
  const displayedSources = displayedItems.map(item => stripSourceEvidence(item.source));
  const displayedSourceIds = displayedItems.map(item => getSourceAttributionId(item.source, item.index));
  const selectedContextSourceIds = list.map((source, index) => getSourceAttributionId(source, index));
  const selectedSourceSet = new Set(selectedContextSourceIds);
  const filteredOutSourceIds = decisions
    .filter(item => item.decision === "hide")
    .map(item => item.source_id);
  const filterReasons = decisions.reduce((acc, item) => {
    if (item.decision === "hide") acc[item.source_id] = item.reason;
    return acc;
  }, {});
  return {
    displayedSources,
    displayed_source_ids: displayedSourceIds,
    displayedSourceIds,
    attribution_decisions: decisions,
    attributionDecisions: decisions,
    filtered_out_source_ids: filteredOutSourceIds,
    filteredOutSourceIds,
    filtered_out_source_count: filteredOutSourceIds.length,
    filter_reasons: filterReasons,
    filterReasons,
    retrieved_source_ids: selectedContextSourceIds,
    selected_context_source_ids: selectedContextSourceIds,
    selected_context_source_count: selectedContextSourceIds.length,
    displayed_source_count: displayedSourceIds.length,
    answer_source_count: displayedSourceIds.length,
    displayed_sources_subset_of_selected: displayedSourceIds.every(id => selectedSourceSet.has(id)),
    answer_source_ids: displayedSourceIds
  };
}

function legalAllowedParagraphRefs(reply = "", legalLookupPlan = null) {
  const replyRefs = extractParagraphRefsFromReply(reply);
  if (replyRefs.length) return replyRefs;
  if (Array.isArray(legalLookupPlan?.paragraphRefs) && legalLookupPlan.paragraphRefs.length) {
    return legalLookupPlan.paragraphRefs.map(normalizeParagraphRef).filter(Boolean);
  }
  return [];
}

function sourceMatchesLegalContract(source = {}, legalLookupPlan = null, allowedParagraphRefs = []) {
  const allowedSourceTypes = new Set(
    (Array.isArray(legalLookupPlan?.sourceTypes) ? legalLookupPlan.sourceTypes : [])
      .map(value => String(value || "").trim())
      .filter(Boolean)
  );
  const sourceType = String(source?.sourceType || source?.source_type || "").trim();
  if (allowedSourceTypes.size && !allowedSourceTypes.has(sourceType)) {
    return ATTRIBUTION_DECISION_REASONS.LEGAL_SOURCE_TYPE_MISMATCH;
  }

  const expectedActTitle = normalizeActTitle(legalLookupPlan?.actTitle || "");
  if (expectedActTitle) {
    const actTitle = normalizeActTitle(sourceActTitle(source));
    if (!actTitle || actTitle !== expectedActTitle) {
      return ATTRIBUTION_DECISION_REASONS.LEGAL_ACT_MISMATCH;
    }
  }

  const expectedMunicipalityId = String(legalLookupPlan?.municipalityId || "").trim();
  if (expectedMunicipalityId) {
    const municipalityId = sourceMunicipalityId(source);
    if (!municipalityId || municipalityId !== expectedMunicipalityId) {
      return ATTRIBUTION_DECISION_REASONS.LEGAL_MUNICIPALITY_MISMATCH;
    }
  }

  if (legalLookupPlan?.requireCurrent) {
    const sourceStatus = String(source?.source_status || source?.sourceStatus || "").trim().toLowerCase();
    if ((sourceStatus && sourceStatus !== "active") || source?.historical === true) {
      return ATTRIBUTION_DECISION_REASONS.LEGAL_CURRENT_SOURCE_REQUIRED;
    }
  }

  const paragraphRefs = Array.isArray(allowedParagraphRefs) ? allowedParagraphRefs.map(normalizeParagraphRef).filter(Boolean) : [];
  if (paragraphRefs.length) {
    const paragraphNumber = sourceParagraphNumber(source);
    if (!paragraphNumber || !paragraphRefs.includes(paragraphNumber)) {
      return ATTRIBUTION_DECISION_REASONS.LEGAL_PARAGRAPH_NOT_IN_ANSWER_OR_PLAN;
    }
  }

  return null;
}

export function buildSourceAttribution(reply = "", sources = [], options = {}) {
  const list = Array.isArray(sources) ? sources : [];
  if (!list.length) return buildAttributionResult([], [], []);
  const legalLookupPlan = options?.legalLookupPlan && typeof options.legalLookupPlan === "object"
    ? options.legalLookupPlan
    : null;
  const query = String(options?.query || "");
  if (legalLookupPlan?.enabled) {
    const riskPolicy = options?.riskPolicy || null;
    const threshold = Number.isFinite(Number(options?.scoreThreshold)) ? Number(options.scoreThreshold) : 3.2;
    const allowedParagraphRefs = legalAllowedParagraphRefs(reply, legalLookupPlan);
    const displayItems = [];
    const decisions = list.map((source, index) => {
      const contractReason = sourceMatchesLegalContract(source, legalLookupPlan, allowedParagraphRefs);
      if (contractReason) {
        return buildDecision(source, index, "hide", contractReason, 0);
      }
      const evidence = sourceMeetsEvidenceRequirement(source, riskPolicy);
      const score = Math.max(scoreSourceForReply(reply, source), threshold + 0.2);
      if (!evidence.ok) {
        return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.INSUFFICIENT_EVIDENCE_STRENGTH, score, evidence);
      }
      displayItems.push({ source, index, score });
      return buildDecision(source, index, "display", ATTRIBUTION_DECISION_REASONS.REPLY_OVERLAP_VALIDATED, score, evidence);
    });

    displayItems.sort((a, b) => b.score - a.score || a.index - b.index);
    return buildAttributionResult(list, decisions, displayItems);
  }
  if (options?.packageAwareAnsweringUsed === true && Array.isArray(options?.packageDisplayedSourceIds)) {
    const allowed = new Set(options.packageDisplayedSourceIds.map(value => String(value || "").trim()).filter(Boolean));
    if (allowed.size) {
      const riskPolicy = options?.riskPolicy || null;
      const displayItems = [];
      const decisions = list.map((source, index) => {
        const id = getSourceAttributionId(source, index);
        if (!allowed.has(id)) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.QUERY_ANCHOR_MISMATCH, 0);
        }
        const evidence = sourceMeetsEvidenceRequirement(source, riskPolicy);
        if (!evidence.ok) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.INSUFFICIENT_EVIDENCE_STRENGTH, 0, evidence);
        }
        displayItems.push({ source, index, score: 10 });
        return buildDecision(source, index, "display", ATTRIBUTION_DECISION_REASONS.REPLY_OVERLAP_VALIDATED, 10, evidence);
      });
      return buildAttributionResult(list, decisions, displayItems);
    }
  }
  if (isSynthesisQueryPlan(options?.queryPlan)) {
    const resourceDiscoveryPlan = isResourceDiscoveryQueryPlan(options?.queryPlan);
    const lifeSituationPlan = isLifeSituationGuidanceQueryPlan(options?.queryPlan);
    const comparisonPlan = isComparisonQueryPlan(options?.queryPlan);
    const overviewPlan = isOverviewSynthesisQueryPlan(options?.queryPlan);
    const riskPolicy = options?.riskPolicy || null;
    const synthesisRiskPolicy = resourceDiscoveryPlan
      ? {
          ...(riskPolicy || {}),
          riskLevel: "low",
          requiredEvidence: "medium",
          insufficientEvidenceMode: false
        }
      : riskPolicy?.riskLevel === "high"
      ? riskPolicy
      : {
          ...(riskPolicy || {}),
          riskLevel: "low",
          requiredEvidence: "medium",
          insufficientEvidenceMode: false
        };
    const hasDisplayableLifeSituationPrimarySource = lifeSituationPlan && list.some((source) => {
      if (isLifeSituationBackgroundSource(source)) return false;
      if (!sourceMatchesLifeSituationQuery(query, source, options?.queryPlan)) return false;
      return sourceMeetsEvidenceRequirement(source, synthesisRiskPolicy).ok;
    });
    const hasDisplayableComparisonPrimarySource = comparisonPlan && list.some((source) => {
      if (isComparisonBackgroundSource(source)) return false;
      if (!sourceMatchesComparisonQuery(query, source, options?.queryPlan)) return false;
      return sourceMeetsEvidenceRequirement(source, synthesisRiskPolicy).ok;
    });
    const hasDisplayableResourceSource = resourceDiscoveryPlan && list.some((source) => {
      if (isLegalSource(source)) return false;
      if (!sourceMatchesResourceDiscoveryQuery(query, source)) return false;
      return sourceMeetsEvidenceRequirement(source, synthesisRiskPolicy).ok;
    });
    const displayItems = [];
    const decisions = list.map((source, index) => {
      if (resourceDiscoveryPlan && isLegalSource(source)) {
        if (hasDisplayableResourceSource) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.LEGAL_BACKGROUND_SUPPRESSED_BY_RESOURCE_DISCOVERY, 0);
        }
        if (!sourceMatchesExactQueryAnchors(query, source)) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.QUERY_ANCHOR_MISMATCH, 0);
        }
        const evidence = sourceMeetsEvidenceRequirement(source, synthesisRiskPolicy);
        if (!evidence.ok) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.INSUFFICIENT_EVIDENCE_STRENGTH, 0, evidence);
        }
        const score = Math.max(scoreSourceForReply(reply, source), 3.5);
        displayItems.push({ source, index, score });
        return buildDecision(source, index, "display", ATTRIBUTION_DECISION_REASONS.SYNTHESIS_CONTEXT_SELECTED, score, evidence);
      }
      if (lifeSituationPlan) {
        if (!sourceMatchesLifeSituationQuery(query, source, options?.queryPlan)) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.QUERY_ANCHOR_MISMATCH, 0);
        }
        if (hasDisplayableLifeSituationPrimarySource && isLifeSituationBackgroundSource(source)) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.BACKGROUND_SUPPRESSED_BY_LIFE_SITUATION_GUIDANCE, 0);
        }
        const evidence = sourceMeetsEvidenceRequirement(source, synthesisRiskPolicy);
        if (!evidence.ok) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.INSUFFICIENT_EVIDENCE_STRENGTH, 0, evidence);
        }
        const sourcePriority = isLegalSource(source) || isMunicipalityServiceOrBenefitSource(source) ? 6 : 5;
        const score = Math.max(scoreSourceForReply(reply, source), sourcePriority);
        displayItems.push({ source, index, score });
        return buildDecision(source, index, "display", ATTRIBUTION_DECISION_REASONS.SYNTHESIS_CONTEXT_SELECTED, score, evidence);
      }
      if (comparisonPlan) {
        if (!sourceMatchesComparisonQuery(query, source, options?.queryPlan)) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.QUERY_ANCHOR_MISMATCH, 0);
        }
        if (hasDisplayableComparisonPrimarySource && isComparisonBackgroundSource(source)) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.BACKGROUND_SUPPRESSED_BY_COMPARISON, 0);
        }
        const evidence = sourceMeetsEvidenceRequirement(source, synthesisRiskPolicy);
        if (!evidence.ok) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.INSUFFICIENT_EVIDENCE_STRENGTH, 0, evidence);
        }
        const sourcePriority = isLegalSource(source) || isMunicipalityServiceOrBenefitSource(source) ? 6 : 5;
        const score = Math.max(scoreSourceForReply(reply, source), sourcePriority);
        displayItems.push({ source, index, score });
        return buildDecision(source, index, "display", ATTRIBUTION_DECISION_REASONS.SYNTHESIS_CONTEXT_SELECTED, score, evidence);
      }
      if (!isSynthesisSource(source)) {
        return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.QUERY_ANCHOR_MISMATCH, 0);
      }
      if (resourceDiscoveryPlan) {
        if (!sourceMatchesResourceDiscoveryQuery(query, source)) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.QUERY_ANCHOR_MISMATCH, 0);
        }
        const evidence = sourceMeetsEvidenceRequirement(source, synthesisRiskPolicy);
        if (!evidence.ok) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.INSUFFICIENT_EVIDENCE_STRENGTH, 0, evidence);
        }
        const score = Math.max(scoreSourceForReply(reply, source), 5);
        displayItems.push({ source, index, score });
        return buildDecision(source, index, "display", ATTRIBUTION_DECISION_REASONS.SYNTHESIS_CONTEXT_SELECTED, score, evidence);
      }
      const synthesisTopicMatch = sourceMatchesSynthesisTopic(query, source) &&
        sourceMatchesExactQueryAnchors(query, source);
      if (!synthesisTopicMatch) {
        // Overview synthesis: document-level diversity selection has already
        // vetted relevance, so a selected source whose content visibly
        // supports the answer may display even when its title lacks the
        // literal query tokens. Non-overview synthesis keeps the strict
        // topic/anchor contract.
        const overviewReplyOverlap = overviewPlan ? scoreSourceForReply(reply, source) : 0;
        if (!(overviewPlan && overviewReplyOverlap >= 3.2)) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.QUERY_ANCHOR_MISMATCH, 0);
        }
      }
      const evidence = sourceMeetsEvidenceRequirement(source, synthesisRiskPolicy);
      if (!evidence.ok) {
        return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.INSUFFICIENT_EVIDENCE_STRENGTH, 0, evidence);
      }
      const score = Math.max(scoreSourceForReply(reply, source), 5);
      displayItems.push({ source, index, score });
      return buildDecision(source, index, "display", ATTRIBUTION_DECISION_REASONS.SYNTHESIS_CONTEXT_SELECTED, score, evidence);
    });
    displayItems.sort((a, b) => b.score - a.score || a.index - b.index);
    return buildAttributionResult(list, decisions, displayItems);
  }
  if (list.length === 1) {
    if (!sourceMatchesExactQueryAnchors(query, list[0])) {
      const decisions = [buildDecision(list[0], 0, "hide", ATTRIBUTION_DECISION_REASONS.QUERY_ANCHOR_MISMATCH, 0)];
      return buildAttributionResult(list, decisions, []);
    }
    const evidence = sourceMeetsEvidenceRequirement(list[0], options?.riskPolicy);
    if (!evidence.ok) {
      const decisions = [buildDecision(list[0], 0, "hide", ATTRIBUTION_DECISION_REASONS.INSUFFICIENT_EVIDENCE_STRENGTH, 0, evidence)];
      return buildAttributionResult(list, decisions, []);
    }
    const decisions = [buildDecision(list[0], 0, "display", ATTRIBUTION_DECISION_REASONS.SINGLE_CANDIDATE_KEPT, 0, evidence)];
    return buildAttributionResult(list, decisions, [{ source: list[0], index: 0, score: 0 }]);
  }
  const riskPolicy = options?.riskPolicy || null;
  const threshold = Number.isFinite(Number(options?.scoreThreshold)) ? Number(options.scoreThreshold) : 3.2;
  // For a generic follow-up the query carries no anchors, so reply overlap is
  // the only signal; require closeness to the best-supported source instead
  // of the absolute floor alone, so loosely overlapping neighbors stay hidden.
  const genericFollowup = isGenericSourceFollowupQuery(query);
  const genericTopScore = genericFollowup
    ? list.reduce((top, source) => Math.max(top, scoreSourceForReply(reply, source)), 0)
    : 0;
  const displayItems = [];
  const decisions = list.map((source, index) => {
    if (!sourceMatchesQueryAnchor(query, source, options)) {
      return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.QUERY_ANCHOR_MISMATCH, 0);
    }
    const rawScore = scoreSourceForReply(reply, source);
    const score = sourceMatchesLegalExactQuery(query, source) ? Math.max(rawScore, threshold + 0.2) : rawScore;
    const requiredScore = genericFollowup ? Math.max(threshold, genericTopScore * 0.45) : threshold;
    if (score < requiredScore) {
      return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.WEAK_REPLY_OVERLAP, score);
    }
    const evidence = sourceMeetsEvidenceRequirement(source, riskPolicy);
    if (!evidence.ok) {
      return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.INSUFFICIENT_EVIDENCE_STRENGTH, score, evidence);
    }
    displayItems.push({ source, index, score });
    return buildDecision(source, index, "display", ATTRIBUTION_DECISION_REASONS.REPLY_OVERLAP_VALIDATED, score, evidence);
  });

  displayItems.sort((a, b) => b.score - a.score || a.index - b.index);
  return buildAttributionResult(list, decisions, displayItems);
}

export function filterSourcesForReply(reply = "", sources = [], options = {}) {
  return buildSourceAttribution(reply, sources, options).displayedSources;
}
