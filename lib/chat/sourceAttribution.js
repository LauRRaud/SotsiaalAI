import { sourceMeetsEvidenceRequirement } from "../rag/riskPolicy.js";
import {
  evidenceRoleFor,
  isLegalSource as isRagLegalSource,
  isResearchOrJournalSource as isRagResearchOrJournalSource,
  sourceLayerFor
} from "../rag/sourceMetadata.js";
import { extractExactQueryAnchors } from "./queryAnchors.js";
import { matchesControlledEstonianTopic } from "./languagePlan.js";
import { serializeDisplayedSourceTrust } from "./sourceTrust.js";
import { currentStatusEvidenceRequested } from "./currentStatusEvidence.js";
import { normalizeSemanticText } from "./semanticTurnContract.js";

const ATTRIBUTION_DECISION_REASONS = Object.freeze({
  INSUFFICIENT_EVIDENCE_STRENGTH: "insufficient_evidence_strength",
  LEGAL_ACT_MISMATCH: "legal_act_mismatch",
  LEGAL_BACKGROUND_SUPPRESSED_BY_RESOURCE_DISCOVERY: "legal_background_suppressed_by_resource_discovery",
  BACKGROUND_SUPPRESSED_BY_LIFE_SITUATION_GUIDANCE: "background_suppressed_by_life_situation_guidance",
  BACKGROUND_SUPPRESSED_BY_COMPARISON: "background_suppressed_by_comparison",
  FACT_CONTRACT_VALIDATED: "fact_contract_validated",
  FACT_VALIDATION_FAILED: "fact_validation_failed",
  CLAIM_SUPPORT_VALIDATED: "claim_support_validated",
  LEGAL_CURRENT_SOURCE_REQUIRED: "legal_current_source_required",
  LEGAL_MUNICIPALITY_MISMATCH: "legal_municipality_mismatch",
  LEGAL_PARAGRAPH_NOT_IN_ANSWER_OR_PLAN: "legal_paragraph_not_in_answer_or_plan",
  LEGAL_SOURCE_TYPE_MISMATCH: "legal_source_type_mismatch",
  QUERY_ANCHOR_MISMATCH: "query_anchor_mismatch",
  NON_ANSWER_SOURCE_SUPPRESSION: "non_answer_source_suppression",
  NO_SUPPORTED_ANSWER_CLAIM: "no_supported_answer_claim",
  REGISTRY_REFERENCE_REQUIRES_SUBSTANTIVE_SOURCE: "registry_reference_requires_substantive_source",
  REPLY_OVERLAP_VALIDATED: "reply_overlap_validated",
  SINGLE_CANDIDATE_KEPT: "single_candidate_kept",
  SYNTHESIS_CONTEXT_SELECTED: "synthesis_context_selected",
  TEMPORAL_SUPPLEMENT_CONTRACT_VALIDATED: "temporal_supplement_contract_validated",
  TEMPORAL_EVIDENCE_UNAVAILABLE: "temporal_evidence_unavailable",
  WEAK_REPLY_OVERLAP: "weak_reply_overlap"
});

const IDENTIFIED_PUBLICATION_SOURCE_TYPES = new Set([
  "academic_paper",
  "analysis",
  "article",
  "evaluation_report",
  "journal_article",
  "official_report",
  "policy_analysis",
  "policy_report",
  "research",
  "research_report",
  "statistical_report",
  "statistics",
  "study",
  "survey_report"
]);

export const ALLOWED_ATTRIBUTION_DECISION_REASONS = new Set(Object.values(ATTRIBUTION_DECISION_REASONS));

const STOPWORDS = new Set([
  "aga", "and", "are", "because", "been", "but", "can", "could", "does", "for", "from", "has", "have", "into", "its", "jah", "kas", "kui", "kuidas", "mida", "milline", "mis", "ning", "not", "oli", "oma", "see", "seda", "selle", "that", "the", "this", "was", "were", "what", "when", "where", "which", "with",
  "что", "как", "для", "или", "это", "его", "она", "они", "при", "чем", "чего"
]);

const MUNICIPALITY_CONTACT_SOURCE_TYPES = new Set([
  "contact_page",
  "contacts",
  "official_contact",
  "service_map_contact",
  "service_map_contact_monitor"
]);

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

function normalizeText(value = "") {
  return normalizeSemanticText(String(value || "")
    .replace(/\bshs\b/giu, "sotsiaalhoolekande seadus")
    .replace(/\bseadus\p{Letter}*/giu, "seadus")
    .replace(/\bparagrahv\p{Letter}*/giu, "paragrahv")
    .replace(/\btoimetulekutoetus\p{Letter}*/giu, "toimetulekutoetus"));
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
    ...(Array.isArray(source.authors) ? source.authors : []),
    source.author,
    source.metadata?.authors,
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

function sourceType(source = {}) {
  return String(source?.sourceType || source?.source_type || "").trim();
}

function sourceItemType(source = {}) {
  return String(source?.itemType || source?.item_type || source?.resourceType || source?.resource_type || "").trim().toLowerCase();
}

function isMunicipalityContactSource(source = {}) {
  const type = sourceType(source);
  return type === "service_map_contact" || type === "service_map_contact_monitor" ||
    (MUNICIPALITY_CONTACT_SOURCE_TYPES.has(type) && sourceItemType(source) === "contact");
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

function isPersonSourceLookupQueryPlan(queryPlan = {}) {
  const mode = String(queryPlan?.mode || queryPlan?.queryPlanMode || queryPlan?.question_planner?.mode || "").trim();
  const strategy = String(queryPlan?.selection_strategy || queryPlan?.selectionStrategy || queryPlan?.retrieval_strategy_selection?.selection_strategy || "").trim();
  return mode === "person_source_lookup" || strategy === "person_authorship_first";
}

function isMunicipalityContactQueryPlan(queryPlan = {}) {
  const mode = String(queryPlan?.mode || queryPlan?.queryPlanMode || "").trim();
  const strategy = String(queryPlan?.selection_strategy || queryPlan?.selectionStrategy || "").trim();
  return mode === "municipality_contact_list" || strategy === "municipality_contact_inventory";
}

function personNameFromQueryPlan(queryPlan = {}) {
  return String(queryPlan?.person_name || queryPlan?.personName || queryPlan?.question_planner?.person_name || "").trim();
}

function sourceAuthorValues(source = {}) {
  const values = [
    source?.authors,
    source?.author,
    source?.metadata?.authors,
    source?.metadata?.author
  ];
  return values
    .flatMap(value => Array.isArray(value) ? value : [value])
    .flatMap(value => String(value || "").replace(/^\[|\]$/g, "").split(/\s*(?:;|\||,)\s*/u))
    .map(value => normalizeText(value.replace(/^["']|["']$/g, "")))
    .filter(Boolean);
}

function sourceHasExactAuthor(source = {}, personName = "") {
  const normalizedPerson = normalizeText(personName);
  if (!normalizedPerson) return false;
  return sourceAuthorValues(source).some(author => author === normalizedPerson);
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

function sourceMatchesExactQueryAnchors(query = "", source = {}) {
  const anchors = extractExactQueryAnchors(query);
  if (!anchors.length) return true;
  const sourceTokens = uniqueTokens(sourceText(source));
  const matchedCount = anchors.filter(token => tokenListHasCompatible(sourceTokens, token)).length;
  const required = anchors.length >= 3 ? 2 : 1;
  return matchedCount >= required;
}

function isLifeSituationBackgroundSource(source = {}) {
  if (LIFE_SITUATION_BACKGROUND_SOURCE_TYPES.has(sourceType(source))) return true;
  if (LIFE_SITUATION_BACKGROUND_COLLECTION_IDS.has(collectionId(source))) return true;
  return false;
}

function isComparisonBackgroundSource(source = {}) {
  if (COMPARISON_BACKGROUND_SOURCE_TYPES.has(sourceType(source))) return true;
  if (COMPARISON_BACKGROUND_COLLECTION_IDS.has(collectionId(source))) return true;
  return false;
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

function replyClaims(reply = "") {
  const normalizedLines = String(reply || "")
    .replace(/```[\s\S]*?```/gu, " ")
    .split(/\n+|(?<=[.!?])\s+/u)
    .map(line => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/u, "").trim())
    .filter(Boolean);
  const claims = [];
  for (const line of normalizedLines) {
    const tokens = uniqueTokens(line);
    if (tokens.length < 2) continue;
    claims.push({
      index: claims.length,
      normalized: normalizeText(line),
      tokens,
      numbers: Array.from(new Set(line.match(/(?<![\p{Letter}\p{Number}])\d+(?:[.,]\d+)?%?/gu) || []))
        .map(value => value.replace(",", "."))
    });
    if (claims.length >= 64) break;
  }
  return claims;
}

function escapeRegExp(value = "") {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function sourceSupportsClaimNumber(sourceValue = "", claimNumber = "") {
  const normalizedNumber = String(claimNumber || "").trim();
  if (!normalizedNumber) return true;
  const isPercentage = normalizedNumber.endsWith("%");
  const numberOnly = isPercentage ? normalizedNumber.slice(0, -1) : normalizedNumber;
  const numericPattern = numberOnly
    .split(".")
    .map(part => escapeRegExp(part))
    .join("[.,]");
  const suffix = isPercentage ? "\\s*%" : "";
  return new RegExp(
    `(?:^|[^\\p{Letter}\\p{Number}])${numericPattern}${suffix}(?:$|[^\\p{Letter}\\p{Number}])`,
    "u"
  ).test(String(sourceValue || ""));
}

function sourceClaimSupport(claims = [], source = {}) {
  const rawSource = sourceText(source);
  const normalizedSource = normalizeText(rawSource);
  const sourceTokens = uniqueTokens(normalizedSource);
  const sourceBigrams = bigrams(sourceTokens);
  const supportedClaimIndices = [];
  let score = 0;
  for (const claim of claims) {
    const common = claim.tokens.filter(token => tokenListHasCompatible(sourceTokens, token));
    const distinctive = common.filter(token => token.length >= 5 || /\d/u.test(token));
    const matchingBigrams = Array.from(bigrams(claim.tokens)).filter(phrase => sourceBigrams.has(phrase));
    const numbersSupported = !claim.numbers.length || claim.numbers.every(number =>
      sourceSupportsClaimNumber(rawSource, number)
    );
    const coverage = common.length / Math.max(1, claim.tokens.length);
    const titleMention = normalizeText(source?.title || "") && claim.normalized.includes(normalizeText(source.title));
    const supported = numbersSupported && (
      titleMention ||
      (distinctive.length >= 2 && coverage >= 0.18) ||
      (matchingBigrams.length >= 1 && common.length >= 2)
    );
    if (!supported) continue;
    supportedClaimIndices.push(claim.index);
    score += Math.min(8, distinctive.length * 0.9 + matchingBigrams.length * 1.6 + (titleMention ? 3 : 0));
  }
  return {
    supported: supportedClaimIndices.length > 0,
    supported_claim_indices: supportedClaimIndices.slice(0, 32),
    supported_claim_count: supportedClaimIndices.length,
    score: Number(score.toFixed(3))
  };
}

function stableClaimHash(value = "") {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function buildClaimAttributionContract(reply = "", list = []) {
  const claims = replyClaims(reply);
  const sourceSupport = (Array.isArray(list) ? list : []).map((source, index) => ({
    source_id: getSourceAttributionId(source, index),
    ...sourceClaimSupport(claims, source)
  }));
  const claimGraph = claims.map(claim => ({
    claim_id: `claim_${claim.index + 1}`,
    claim_hash: stableClaimHash(claim.normalized),
    supporting_source_ids: sourceSupport
      .filter(source => source.supported_claim_indices.includes(claim.index))
      .map(source => source.source_id)
  }));
  return {
    version: "claim_attribution_contract_v2",
    claim_count: claims.length,
    claims: claimGraph,
    claim_supported_source_ids: sourceSupport
      .filter(source => source.supported)
      .map(source => source.source_id),
    source_support: sourceSupport
  };
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
    ...(evidence?.reason ? { evidence_reason: evidence.reason } : {}),
    ...(Number.isInteger(Number(evidence?.supported_claim_count)) ? {
      supported_claim_count: Number(evidence.supported_claim_count),
      supported_claim_indices: Array.isArray(evidence?.supported_claim_indices)
        ? evidence.supported_claim_indices.slice(0, 32)
        : []
    } : {})
  };
}

function uniqueAttributionIds(values = []) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [values])
      .map(value => String(value || "").trim())
      .filter(Boolean)
  ));
}

function validatedSupportingSourceIds(options = {}) {
  const validation = options?.factValidation && typeof options.factValidation === "object"
    ? options.factValidation
    : null;
  if (validation?.passed !== true) return [];
  return uniqueAttributionIds([
    ...(Array.isArray(validation.supporting_source_ids) ? validation.supporting_source_ids : []),
    validation.supporting_source_id,
    ...(Array.isArray(validation.temporal_supplemental_source_ids)
      ? validation.temporal_supplemental_source_ids
      : []),
    ...(Array.isArray(options?.contactInventoryValidatedSourceIds)
      ? options.contactInventoryValidatedSourceIds
      : []),
    options?.requestedFactSlotSourceId
  ]);
}

function buildAttributionResult(list, decisions, displayedItems, options = {}) {
  // A registry is a navigation aid, never the factual evidence for an answer.
  // Keep it when a substantive source is displayed beside it, but fail closed
  // when it would be the only displayed source. This is intentionally applied
  // after all route-specific selection so every answer mode has one boundary.
  const onlyRegistryReferences = displayedItems.length > 0 && displayedItems.every(item =>
    evidenceRoleFor(item.source) === "registry_reference"
  );
  if (onlyRegistryReferences) {
    for (const item of displayedItems) {
      const decision = decisions.find(candidate => candidate.source_index === item.index);
      if (decision) {
        decision.decision = "hide";
        decision.reason = ATTRIBUTION_DECISION_REASONS.REGISTRY_REFERENCE_REQUIRES_SUBSTANTIVE_SOURCE;
      }
    }
    displayedItems = [];
  }
  // Trust metadata is attached only after the display decision. It must never
  // strengthen, weaken or otherwise alter attribution selection.
  const displayedSources = displayedItems.map(item => serializeDisplayedSourceTrust(
    stripSourceEvidence(item.source),
    getSourceAttributionId(item.source, item.index)
  ));
  const displayedSourceIds = displayedItems.map(item => getSourceAttributionId(item.source, item.index));
  const selectedContextSourceIds = list.map((source, index) => getSourceAttributionId(source, index));
  const claimAttributionContract = options?.claimAttributionContract || null;
  const claimSupportedSourceIds = uniqueAttributionIds(claimAttributionContract?.claim_supported_source_ids);
  const validatedSourceIds = validatedSupportingSourceIds(options);
  const answerSupportSet = new Set([...claimSupportedSourceIds, ...validatedSourceIds]);
  const answerSourceIds = displayedSourceIds.filter(id => answerSupportSet.has(id));
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
    model_context_source_ids: selectedContextSourceIds,
    validated_supporting_source_ids: validatedSourceIds,
    claim_supported_source_ids: claimSupportedSourceIds,
    claim_support_graph: Array.isArray(claimAttributionContract?.claims)
      ? claimAttributionContract.claims
      : [],
    selected_context_source_count: selectedContextSourceIds.length,
    displayed_source_count: displayedSourceIds.length,
    answer_source_count: answerSourceIds.length,
    displayed_sources_subset_of_selected: displayedSourceIds.every(id => selectedSourceSet.has(id)),
    answer_source_ids: answerSourceIds,
    answer_source_semantics: "claim_or_validator_support"
  };
}

function buildAttributionResultWithFactValidatedContacts(list, decisions, displayedItems, options = {}) {
  const validatedSourceIds = new Set(
    (Array.isArray(options?.contactInventoryValidatedSourceIds)
      ? options.contactInventoryValidatedSourceIds
      : [])
      .map(value => String(value || "").trim())
      .filter(Boolean)
  );
  if (!validatedSourceIds.size) {
    return buildAttributionResult(list, decisions, displayedItems, options);
  }

  const displayedIndexes = new Set(displayedItems.map(item => item.index));
  for (let index = 0; index < list.length; index += 1) {
    const source = list[index];
    const sourceId = getSourceAttributionId(source, index);
    if (!validatedSourceIds.has(sourceId) || !isMunicipalityContactSource(source)) continue;

    const evidence = sourceMeetsEvidenceRequirement(source, options?.riskPolicy || null);
    const decision = decisions.find(item => item.source_index === index);
    if (!evidence.ok) {
      if (decision) {
        decision.decision = "hide";
        decision.reason = ATTRIBUTION_DECISION_REASONS.INSUFFICIENT_EVIDENCE_STRENGTH;
        decision.evidence_strength = evidence.strength;
        decision.required_evidence = evidence.requiredEvidence;
        decision.evidence_reason = evidence.reason;
      }
      continue;
    }

    if (!displayedIndexes.has(index)) continue;
    if (decision) {
      decision.decision = "display";
      decision.reason = ATTRIBUTION_DECISION_REASONS.FACT_CONTRACT_VALIDATED;
      decision.score = Math.max(Number(decision.score || 0), 10);
      decision.evidence_strength = evidence.strength;
      decision.required_evidence = evidence.requiredEvidence;
      decision.evidence_reason = evidence.reason;
    }
  }

  displayedItems.sort((a, b) => b.score - a.score || a.index - b.index);
  return buildAttributionResult(list, decisions, displayedItems, options);
}

function currentEvidenceDecision(query = "", queryPlan = null) {
  const scope = queryPlan?.temporal_query_contract?.current_evidence_scope;
  if (scope === "current") {
    return { value: true, source: "typed_temporal_contract" };
  }
  if (scope === "source_bounded") {
    return { value: false, source: "typed_temporal_contract" };
  }
  return { value: currentStatusEvidenceRequested(query), source: "raw_text_fallback" };
}

function buildSourceAttributionContractShadow(query, list, options = {}) {
  const contract = options?.queryPlan?.answer_validation_contract_shadow;
  if (contract?.mode !== "shadow") return null;
  const fields = contract?.planner?.fields || {};
  const fieldAvailable = fieldName => fields?.[fieldName]?.available === true;
  const fieldValue = fieldName => fieldAvailable(fieldName) ? fields?.[fieldName]?.value : null;
  const identityRequired = typeof options?.documentIdentityEvidence?.required === "boolean"
    ? options.documentIdentityEvidence.required
    : null;
  const identityMatched = identityRequired === true &&
    typeof options?.documentIdentityEvidence?.matched === "boolean"
    ? options.documentIdentityEvidence.matched
    : null;
  const rawAnchors = extractExactQueryAnchors(query);
  const queryPlan = options?.queryPlan && typeof options.queryPlan === "object"
    ? options.queryPlan
    : null;
  const currentDecision = currentEvidenceDecision(query, queryPlan);
  return {
    production_path: "hybrid_existing",
    decision_source: "not_fully_attributed",
    legacy_path_used: null,
    structured_path_used_for_decision: null,
    shadow_contract_used_for_decision: false,
    structured_path_scope: typeof contract.version === "string" ? contract.version : null,
    structured_observations: {
      planner_mode: typeof contract?.planner?.mode === "string" ? contract.planner.mode : null,
      route_mode: typeof contract?.planner?.route_mode === "string" ? contract.planner.route_mode : null,
      field_availability: {
        document_source_years: fieldAvailable("document_source_years"),
        period_role: fieldAvailable("period_role"),
        evidence_period_years: fieldAvailable("evidence_period_years")
      },
      document_source_years: Array.isArray(fieldValue("document_source_years"))
        ? fieldValue("document_source_years")
        : null,
      period_role: typeof fieldValue("period_role") === "string" ? fieldValue("period_role") : null,
      evidence_period_years: Array.isArray(fieldValue("evidence_period_years"))
        ? fieldValue("evidence_period_years")
        : null,
      document_identity_required: identityRequired,
      document_identity_matched: identityMatched,
      document_identity_confidence: typeof options?.documentIdentityEvidence?.confidence === "string"
        ? options.documentIdentityEvidence.confidence
        : null
    },
    legacy_observations: {
      query_plan_available: !!(options?.queryPlan && typeof options.queryPlan === "object"),
      current_status_observed: currentStatusEvidenceRequested(query),
      current_status_decision: currentDecision.value,
      current_status_decision_source: currentDecision.source,
      raw_anchor_observed: rawAnchors.length > 0,
      raw_anchor_match_observed: list.length && rawAnchors.length
        ? list.some(source => sourceMatchesExactQueryAnchors(query, source))
        : null,
      exact_anchor_match: list.length && rawAnchors.length
        ? list.some(source => sourceMatchesExactQueryAnchors(query, source))
        : null,
      exact_anchor_match_scope: "any_selected_source"
    },
    runtime_relation: "not_comparable"
  };
}

function identifiedPublicationFactEvidence(source = {}, index = 0, options = {}) {
  const queryPlan = options?.queryPlan && typeof options.queryPlan === "object"
    ? options.queryPlan
    : {};
  const factValidation = options?.factValidation && typeof options.factValidation === "object"
    ? options.factValidation
    : {};
  const documentIdentity = options?.documentIdentityEvidence && typeof options.documentIdentityEvidence === "object"
    ? options.documentIdentityEvidence
    : {};
  const sourceId = getSourceAttributionId(source, index);
  const sourceDocumentId = String(source?.document_id || source?.documentId || "").trim();
  const selectedDocumentId = String(documentIdentity?.selectedDocumentId || "").trim();
  const sourceStatus = String(source?.source_status || source?.sourceStatus || "").trim().toLowerCase();
  const sourceType = String(source?.source_type || source?.sourceType || "").trim().toLowerCase();
  const supportingSourceId = String(factValidation?.supporting_source_id || "").trim();
  const currentDecision = currentEvidenceDecision(options?.query, queryPlan);
  const validatedSourceBoundedFact =
    queryPlan?.mode === "specific_research_fact" &&
    factValidation?.passed === true &&
    !!supportingSourceId &&
    sourceId === supportingSourceId &&
    currentDecision.value === false;
  const documentIdentityMismatch = documentIdentity?.required === true && (
    documentIdentity?.matched !== true ||
    documentIdentity?.confidence !== "high" ||
    !selectedDocumentId ||
    sourceDocumentId !== selectedDocumentId
  );
  if (
    !validatedSourceBoundedFact ||
    documentIdentityMismatch ||
    sourceStatus !== "active" ||
    !IDENTIFIED_PUBLICATION_SOURCE_TYPES.has(sourceType) ||
    !isRagResearchOrJournalSource(source)
  ) {
    return null;
  }
  return {
    ok: true,
    strength: "strong",
    requiredEvidence: String(options?.riskPolicy?.requiredEvidence || "medium"),
    reason: documentIdentity?.required === true
      ? "identified_publication_primary_evidence"
      : "validated_source_bounded_fact"
  };
}

function sourceEvidenceForAttribution(source = {}, index = 0, options = {}) {
  return identifiedPublicationFactEvidence(source, index, options) ||
    sourceMeetsEvidenceRequirement(source, options?.riskPolicy || null);
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
  const query = String(options?.query || "");
  const claimAttributionContract = buildClaimAttributionContract(reply, list);
  const claimSupportBySourceId = new Map(
    claimAttributionContract.source_support.map(item => [item.source_id, item])
  );
  const claimSupportFor = (source, index) => claimSupportBySourceId.get(
    getSourceAttributionId(source, index)
  ) || { supported: false, supported_claim_indices: [], supported_claim_count: 0, score: 0 };
  const sourceAttributionContractShadow = buildSourceAttributionContractShadow(query, list, options);
  const withContractShadow = result => {
    const sectionSourceIds = options?.packageSectionSourceIds && typeof options.packageSectionSourceIds === "object"
      ? options.packageSectionSourceIds
      : {};
    const displayedSet = new Set(result?.displayed_source_ids || []);
    const usedSectionSourceIds = Object.fromEntries(
      Object.entries(sectionSourceIds)
        .map(([section, ids]) => [
          section,
          uniqueAttributionIds(ids).filter(id => displayedSet.has(id))
        ])
        .filter(([, ids]) => ids.length)
    );
    const packageSectionAttribution = options?.packageAwareAnsweringUsed === true
      ? {
          version: "package_section_attribution_v1",
          requested_sections: uniqueAttributionIds(options?.packageRequestedSections),
          used_sections: Object.keys(usedSectionSourceIds),
          used_section_source_ids: usedSectionSourceIds,
          displayed_source_ids: uniqueAttributionIds(Object.values(usedSectionSourceIds).flat())
        }
      : null;
    return {
      ...result,
      claimAttributionContract,
      ...(packageSectionAttribution
        ? {
            package_section_attribution: packageSectionAttribution,
            package_used_section_source_ids: packageSectionAttribution.displayed_source_ids
          }
        : {}),
      ...(sourceAttributionContractShadow ? { sourceAttributionContractShadow } : {})
    };
  };
  const finishAttribution = (decisions, displayedItems) => withContractShadow(
    buildAttributionResultWithFactValidatedContacts(list, decisions, displayedItems, {
      ...options,
      claimAttributionContract
    })
  );
  if (!list.length) return finishAttribution([], []);
  // The selected context stays in the trace, but "answer sources" may only
  // contain sources supporting the reply that the user actually receives.
  if (String(options?.nonAnswerSourceSuppressionReason || "").trim()) {
    const decisions = list.map((source, index) =>
      buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.NON_ANSWER_SOURCE_SUPPRESSION, 0)
    );
    return withContractShadow(buildAttributionResult(list, decisions, [], {
      ...options,
      claimAttributionContract
    }));
  }
  if (options?.factValidation?.passed === false) {
    const decisions = list.map((source, index) =>
      buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.FACT_VALIDATION_FAILED, 0)
    );
    return withContractShadow(buildAttributionResult(list, decisions, [], {
      ...options,
      claimAttributionContract
    }));
  }
  if (
    options?.queryPlan?.mode === "temporal" &&
    options?.factValidation?.passed === true &&
    options?.factValidation?.reason === "temporal_year_evidence_unavailable"
  ) {
    const decisions = list.map((source, index) =>
      buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.TEMPORAL_EVIDENCE_UNAVAILABLE, 0)
    );
    return finishAttribution(decisions, []);
  }
  const temporalValidatedSourceIds = new Set(
    options?.queryPlan?.mode === "temporal" &&
    options?.factValidation?.passed === true &&
    new Set([
      "temporal_year_value_rows",
      "temporal_aggregate_period_single_source"
    ]).has(options?.factValidation?.reason) &&
    Array.isArray(options?.factValidation?.supporting_source_ids)
      ? options.factValidation.supporting_source_ids
        .map(value => String(value || "").trim())
        .filter(Boolean)
      : []
  );
  const temporalSupplementalSourceIds = new Set(
    options?.queryPlan?.mode === "temporal" &&
    options?.factValidation?.passed === true &&
    options?.factValidation?.reason === "temporal_aggregate_period_single_source" &&
    Array.isArray(options?.factValidation?.temporal_supplemental_source_ids)
      ? options.factValidation.temporal_supplemental_source_ids
        .map(value => String(value || "").trim())
        .filter(Boolean)
      : []
  );
  if (temporalValidatedSourceIds.size) {
    const riskPolicy = options?.riskPolicy || null;
    const displayItems = [];
    const decisions = list.map((source, index) => {
      const sourceId = getSourceAttributionId(source, index);
      if (!temporalValidatedSourceIds.has(sourceId)) {
        if (!temporalSupplementalSourceIds.has(sourceId)) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.QUERY_ANCHOR_MISMATCH, 0);
        }
        const contextualEvidence = sourceMeetsEvidenceRequirement(source, riskPolicy);
        if (!contextualEvidence.ok) {
          return buildDecision(
            source,
            index,
            "hide",
            ATTRIBUTION_DECISION_REASONS.INSUFFICIENT_EVIDENCE_STRENGTH,
            0,
            contextualEvidence
          );
        }
        const contextualScore = Math.min(9, Math.max(scoreSourceForReply(reply, source), 5));
        displayItems.push({ source, index, score: contextualScore });
        return buildDecision(
          source,
          index,
          "display",
          ATTRIBUTION_DECISION_REASONS.TEMPORAL_SUPPLEMENT_CONTRACT_VALIDATED,
          contextualScore,
          contextualEvidence
        );
      }
      const evidence = sourceMeetsEvidenceRequirement(source, riskPolicy);
      if (!evidence.ok) {
        return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.INSUFFICIENT_EVIDENCE_STRENGTH, 0, evidence);
      }
      const score = Math.max(scoreSourceForReply(reply, source), 10);
      displayItems.push({ source, index, score });
      return buildDecision(
        source,
        index,
        "display",
        ATTRIBUTION_DECISION_REASONS.FACT_CONTRACT_VALIDATED,
        score,
        evidence
      );
    });
    displayItems.sort((left, right) => right.score - left.score || left.index - right.index);
    return finishAttribution(decisions, displayItems);
  }
  const legalLookupPlan = options?.legalLookupPlan && typeof options.legalLookupPlan === "object"
    ? options.legalLookupPlan
    : null;
  if (legalLookupPlan?.enabled) {
    const riskPolicy = options?.riskPolicy || null;
    const allowedParagraphRefs = legalAllowedParagraphRefs(reply, legalLookupPlan);
    const displayItems = [];
    const decisions = list.map((source, index) => {
      const contractReason = sourceMatchesLegalContract(source, legalLookupPlan, allowedParagraphRefs);
      if (contractReason) {
        return buildDecision(source, index, "hide", contractReason, 0);
      }
      const evidence = sourceMeetsEvidenceRequirement(source, riskPolicy);
      const claimSupport = claimSupportFor(source, index);
      const score = Math.max(claimSupport.score, scoreSourceForReply(reply, source));
      if (!evidence.ok) {
        return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.INSUFFICIENT_EVIDENCE_STRENGTH, score, evidence);
      }
      if (!claimSupport.supported) {
        return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.NO_SUPPORTED_ANSWER_CLAIM, score, claimSupport);
      }
      displayItems.push({ source, index, score });
      return buildDecision(source, index, "display", ATTRIBUTION_DECISION_REASONS.CLAIM_SUPPORT_VALIDATED, score, {
        ...evidence,
        ...claimSupport
      });
    });

    displayItems.sort((a, b) => b.score - a.score || a.index - b.index);
    return finishAttribution(decisions, displayItems);
  }
  if (
    options?.packageAwareAnsweringUsed === true &&
    (Array.isArray(options?.packageCandidateSourceIds) || Array.isArray(options?.packageDisplayedSourceIds))
  ) {
    const allowed = new Set(
      uniqueAttributionIds(options.packageCandidateSourceIds || options.packageDisplayedSourceIds)
    );
    const validatedContactSourceIds = new Set(
      (Array.isArray(options?.contactInventoryValidatedSourceIds)
        ? options.contactInventoryValidatedSourceIds
        : [])
        .map(value => String(value || "").trim())
        .filter(Boolean)
    );
    for (const sourceId of validatedContactSourceIds) allowed.add(sourceId);
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
        const factValidatedContact = validatedContactSourceIds.has(id);
        const claimSupport = claimSupportFor(source, index);
        if (!claimSupport.supported) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.NO_SUPPORTED_ANSWER_CLAIM, claimSupport.score, claimSupport);
        }
        const score = factValidatedContact ? Math.max(10, claimSupport.score) : claimSupport.score;
        displayItems.push({ source, index, score });
        return buildDecision(
          source,
          index,
          "display",
          factValidatedContact
            ? ATTRIBUTION_DECISION_REASONS.FACT_CONTRACT_VALIDATED
            : ATTRIBUTION_DECISION_REASONS.CLAIM_SUPPORT_VALIDATED,
          score,
          { ...evidence, ...claimSupport }
        );
      });
    return finishAttribution(decisions, displayItems);
    }
  }
  if (isMunicipalityContactQueryPlan(options?.queryPlan)) {
    const riskPolicy = options?.riskPolicy || null;
    const validatedSourceIds = new Set(
      (Array.isArray(options?.contactInventoryValidatedSourceIds)
        ? options.contactInventoryValidatedSourceIds
        : [])
        .map(value => String(value || "").trim())
        .filter(Boolean)
    );
    const displayItems = [];
    const decisions = list.map((source, index) => {
      const monitorSource = sourceType(source) === "service_map_contact_monitor";
      if (!isMunicipalityContactSource(source) || (!monitorSource && !sourceMatchesMunicipalityContext(source, options?.municipalityContext))) {
        return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.QUERY_ANCHOR_MISMATCH, 0);
      }
      const sourceId = getSourceAttributionId(source, index);
      const factValidated = validatedSourceIds.has(sourceId);
      const claimSupport = claimSupportFor(source, index);
      const evidence = sourceMeetsEvidenceRequirement(source, riskPolicy);
      if (!evidence.ok) {
        return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.INSUFFICIENT_EVIDENCE_STRENGTH, claimSupport.score, evidence);
      }
      if (!claimSupport.supported) {
        return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.NO_SUPPORTED_ANSWER_CLAIM, claimSupport.score, claimSupport);
      }
      const score = factValidated ? Math.max(claimSupport.score, 10) : claimSupport.score;
      displayItems.push({ source, index, score });
      return buildDecision(
        source,
        index,
        "display",
        factValidated
          ? ATTRIBUTION_DECISION_REASONS.FACT_CONTRACT_VALIDATED
          : ATTRIBUTION_DECISION_REASONS.CLAIM_SUPPORT_VALIDATED,
        score,
        { ...evidence, ...claimSupport }
      );
    });
    displayItems.sort((a, b) => b.score - a.score || a.index - b.index);
    return finishAttribution(decisions, displayItems);
  }
  if (isPersonSourceLookupQueryPlan(options?.queryPlan)) {
    const plannedPersonName = personNameFromQueryPlan(options?.queryPlan);
    const personName = plannedPersonName || String(query.match(/\b(?:kes\s+on|millest\s+(?:on\s+)?|mida\s+(?:on\s+)?)(.+?)(?:\s+kirjutanud)?[?.!]*$/iu)?.[1] || "").trim();
    const personTopicTerms = (Array.isArray(options?.personTopicTerms) ? options.personTopicTerms : [])
      .map(value => String(value || "").trim())
      .filter(Boolean)
      .slice(0, 8);
    const personCoauthorNames = (Array.isArray(options?.personCoauthorNames) ? options.personCoauthorNames : [])
      .map(value => String(value || "").trim())
      .filter(Boolean)
      .slice(0, 4);
    const personCoauthorRequested = options?.personCoauthorRequested === true;
    const riskPolicy = options?.riskPolicy || null;
    const displayItems = [];
    const decisions = list.map((source, index) => {
      if (!sourceHasExactAuthor(source, personName)) {
        return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.QUERY_ANCHOR_MISMATCH, 0);
      }
      const sourceAuthors = sourceAuthorValues(source);
      if (
        personCoauthorNames.some(coauthor => !sourceHasExactAuthor(source, coauthor))
        || (personCoauthorRequested && !personCoauthorNames.length && sourceAuthors.length < 2)
      ) {
        return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.QUERY_ANCHOR_MISMATCH, 0);
      }
      if (personTopicTerms.length && !matchesControlledEstonianTopic(sourceText(source), personTopicTerms)) {
        return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.QUERY_ANCHOR_MISMATCH, 0);
      }
      const evidence = sourceMeetsEvidenceRequirement(source, riskPolicy);
      if (!evidence.ok) {
        return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.INSUFFICIENT_EVIDENCE_STRENGTH, 0, evidence);
      }
      const claimSupport = claimSupportFor(source, index);
      if (!claimSupport.supported) {
        return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.NO_SUPPORTED_ANSWER_CLAIM, claimSupport.score, claimSupport);
      }
      const score = Math.max(claimSupport.score, scoreSourceForReply(reply, source));
      displayItems.push({ source, index, score });
      return buildDecision(source, index, "display", ATTRIBUTION_DECISION_REASONS.CLAIM_SUPPORT_VALIDATED, score, {
        ...evidence,
        ...claimSupport
      });
    });
    displayItems.sort((a, b) => b.score - a.score || a.index - b.index);
    return finishAttribution(decisions, displayItems);
  }
  if (isSynthesisQueryPlan(options?.queryPlan)) {
    const resourceDiscoveryPlan = isResourceDiscoveryQueryPlan(options?.queryPlan);
    const lifeSituationPlan = isLifeSituationGuidanceQueryPlan(options?.queryPlan);
    const comparisonPlan = isComparisonQueryPlan(options?.queryPlan);
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
      const index = list.indexOf(source);
      return claimSupportFor(source, index).supported &&
        sourceMeetsEvidenceRequirement(source, synthesisRiskPolicy).ok;
    });
    const hasDisplayableComparisonPrimarySource = comparisonPlan && list.some((source) => {
      if (isComparisonBackgroundSource(source)) return false;
      const index = list.indexOf(source);
      return claimSupportFor(source, index).supported &&
        sourceMeetsEvidenceRequirement(source, synthesisRiskPolicy).ok;
    });
    const hasDisplayableResourceSource = resourceDiscoveryPlan && list.some((source) => {
      if (isLegalSource(source)) return false;
      const index = list.indexOf(source);
      return claimSupportFor(source, index).supported &&
        sourceMeetsEvidenceRequirement(source, synthesisRiskPolicy).ok;
    });
    const displayItems = [];
    const decisions = list.map((source, index) => {
      if (resourceDiscoveryPlan && isLegalSource(source)) {
        if (hasDisplayableResourceSource) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.LEGAL_BACKGROUND_SUPPRESSED_BY_RESOURCE_DISCOVERY, 0);
        }
        const evidence = sourceMeetsEvidenceRequirement(source, synthesisRiskPolicy);
        if (!evidence.ok) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.INSUFFICIENT_EVIDENCE_STRENGTH, 0, evidence);
        }
        const claimSupport = claimSupportFor(source, index);
        if (!claimSupport.supported) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.NO_SUPPORTED_ANSWER_CLAIM, claimSupport.score, claimSupport);
        }
        const score = claimSupport.score;
        displayItems.push({ source, index, score });
        return buildDecision(source, index, "display", ATTRIBUTION_DECISION_REASONS.CLAIM_SUPPORT_VALIDATED, score, { ...evidence, ...claimSupport });
      }
      if (lifeSituationPlan) {
        if (hasDisplayableLifeSituationPrimarySource && isLifeSituationBackgroundSource(source)) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.BACKGROUND_SUPPRESSED_BY_LIFE_SITUATION_GUIDANCE, 0);
        }
        const evidence = sourceMeetsEvidenceRequirement(source, synthesisRiskPolicy);
        if (!evidence.ok) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.INSUFFICIENT_EVIDENCE_STRENGTH, 0, evidence);
        }
        const claimSupport = claimSupportFor(source, index);
        if (!claimSupport.supported) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.NO_SUPPORTED_ANSWER_CLAIM, claimSupport.score, claimSupport);
        }
        const score = claimSupport.score;
        displayItems.push({ source, index, score });
        return buildDecision(source, index, "display", ATTRIBUTION_DECISION_REASONS.CLAIM_SUPPORT_VALIDATED, score, { ...evidence, ...claimSupport });
      }
      if (comparisonPlan) {
        if (hasDisplayableComparisonPrimarySource && isComparisonBackgroundSource(source)) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.BACKGROUND_SUPPRESSED_BY_COMPARISON, 0);
        }
        const evidence = sourceMeetsEvidenceRequirement(source, synthesisRiskPolicy);
        if (!evidence.ok) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.INSUFFICIENT_EVIDENCE_STRENGTH, 0, evidence);
        }
        const claimSupport = claimSupportFor(source, index);
        if (!claimSupport.supported) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.NO_SUPPORTED_ANSWER_CLAIM, claimSupport.score, claimSupport);
        }
        const score = claimSupport.score;
        displayItems.push({ source, index, score });
        return buildDecision(source, index, "display", ATTRIBUTION_DECISION_REASONS.CLAIM_SUPPORT_VALIDATED, score, { ...evidence, ...claimSupport });
      }
      if (!isSynthesisSource(source)) {
        return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.QUERY_ANCHOR_MISMATCH, 0);
      }
      if (resourceDiscoveryPlan) {
        const evidence = sourceMeetsEvidenceRequirement(source, synthesisRiskPolicy);
        if (!evidence.ok) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.INSUFFICIENT_EVIDENCE_STRENGTH, 0, evidence);
        }
        const claimSupport = claimSupportFor(source, index);
        if (!claimSupport.supported) {
          return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.NO_SUPPORTED_ANSWER_CLAIM, claimSupport.score, claimSupport);
        }
        const score = claimSupport.score;
        displayItems.push({ source, index, score });
        return buildDecision(source, index, "display", ATTRIBUTION_DECISION_REASONS.CLAIM_SUPPORT_VALIDATED, score, { ...evidence, ...claimSupport });
      }
      const evidence = sourceMeetsEvidenceRequirement(source, synthesisRiskPolicy);
      if (!evidence.ok) {
        return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.INSUFFICIENT_EVIDENCE_STRENGTH, 0, evidence);
      }
      const claimSupport = claimSupportFor(source, index);
      if (!claimSupport.supported) {
        return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.NO_SUPPORTED_ANSWER_CLAIM, claimSupport.score, claimSupport);
      }
      const score = claimSupport.score;
      displayItems.push({ source, index, score });
      return buildDecision(source, index, "display", ATTRIBUTION_DECISION_REASONS.CLAIM_SUPPORT_VALIDATED, score, { ...evidence, ...claimSupport });
    });
    displayItems.sort((a, b) => b.score - a.score || a.index - b.index);
    return finishAttribution(decisions, displayItems);
  }
  if (list.length === 1) {
    const claimSupport = claimSupportFor(list[0], 0);
    if (!claimSupport.supported) {
      const decisions = [buildDecision(list[0], 0, "hide", ATTRIBUTION_DECISION_REASONS.NO_SUPPORTED_ANSWER_CLAIM, claimSupport.score, claimSupport)];
      return finishAttribution(decisions, []);
    }
    const evidence = sourceEvidenceForAttribution(list[0], 0, options);
    if (!evidence.ok) {
      const decisions = [buildDecision(list[0], 0, "hide", ATTRIBUTION_DECISION_REASONS.INSUFFICIENT_EVIDENCE_STRENGTH, 0, evidence)];
      return finishAttribution(decisions, []);
    }
    const decisions = [buildDecision(list[0], 0, "display", ATTRIBUTION_DECISION_REASONS.CLAIM_SUPPORT_VALIDATED, claimSupport.score, {
      ...evidence,
      ...claimSupport
    })];
    return finishAttribution(decisions, [{ source: list[0], index: 0, score: claimSupport.score }]);
  }
  const displayItems = [];
  const decisions = list.map((source, index) => {
    const claimSupport = claimSupportFor(source, index);
    if (!claimSupport.supported) {
      return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.NO_SUPPORTED_ANSWER_CLAIM, claimSupport.score, claimSupport);
    }
    const score = claimSupport.score;
    const evidence = sourceEvidenceForAttribution(source, index, options);
    if (!evidence.ok) {
      return buildDecision(source, index, "hide", ATTRIBUTION_DECISION_REASONS.INSUFFICIENT_EVIDENCE_STRENGTH, score, evidence);
    }
    displayItems.push({ source, index, score });
    return buildDecision(source, index, "display", ATTRIBUTION_DECISION_REASONS.CLAIM_SUPPORT_VALIDATED, score, {
      ...evidence,
      ...claimSupport
    });
  });

  displayItems.sort((a, b) => b.score - a.score || a.index - b.index);
  return finishAttribution(decisions, displayItems);
}

export function filterSourcesForReply(reply = "", sources = [], options = {}) {
  return buildSourceAttribution(reply, sources, options).displayedSources;
}
