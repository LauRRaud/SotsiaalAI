import { persistInit, persistDone } from "@/lib/chat/persistence";
import { callOpenAI, streamOpenAI, shouldFlushStreamDelta } from "@/lib/chat/openaiRuntime";
import { buildImmediateChatResponse, finalizeAssistantReply } from "@/lib/chat/responseFinalizer";
import { CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";
import { buildSourceAttribution, getSourceAttributionId } from "@/lib/chat/sourceAttribution";
import { persistSourcePackageSnapshots } from "@/lib/rag/sourcePackageSnapshots";
import {
  RAG_ATTRIBUTION_DECISIONS_ENABLED,
  RAG_DISPLAYED_SOURCES_ENFORCED,
  RAG_TRACE_V1_ENABLED
} from "@/lib/chat/settings";

const EMPTY_STREAM_REPLY_FALLBACK = "Sorry, I couldn't generate an answer right now.";
export const RAG_CONTRACT_VERSION = "v1";

function buildRagContractMetadata() {
  return {
    rag_contract_version: RAG_CONTRACT_VERSION,
    source_display_mode: RAG_DISPLAYED_SOURCES_ENFORCED ? "displayed_sources_enforced" : "legacy_sources_allowed"
  };
}

function truncateTraceString(value, maxLength = 240) {
  const text = String(value || "").trim();
  if (!text) return undefined;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function sanitizeSelectedContextDetails(details = []) {
  if (!Array.isArray(details)) return [];
  return details.map((entry = {}) => {
    const sanitized = {
      source_id: entry.source_id || undefined,
      raw_source_id: entry.raw_source_id || undefined,
      title: entry.title || undefined,
      section: entry.section || undefined,
      paragraph_number: entry.paragraph_number || undefined,
      paragraph_title: entry.paragraph_title || undefined,
      subsection_number: entry.subsection_number || undefined,
      body_preview: truncateTraceString(entry.body_preview),
      source_type: entry.source_type || undefined,
      collection_id: entry.collection_id || undefined,
      canonical_item_id: entry.canonical_item_id || undefined,
      item_type: entry.item_type || undefined,
      resource_type: entry.resource_type || undefined,
      sections_present: Array.isArray(entry.sections_present) ? entry.sections_present : undefined,
      municipality_id: entry.municipality_id || undefined,
      municipality_name: entry.municipality_name || undefined,
      source_status: entry.source_status || undefined,
      historical: entry.historical === true ? true : undefined,
      retrieval_channels: Array.isArray(entry.retrieval_channels) ? entry.retrieval_channels : undefined,
      hybrid_score: typeof entry.hybrid_score === "number" ? entry.hybrid_score : undefined,
      dense_score: typeof entry.dense_score === "number" ? entry.dense_score : undefined,
      lexical_score: typeof entry.lexical_score === "number" ? entry.lexical_score : undefined,
      lexical_score_normalized: typeof entry.lexical_score_normalized === "number" ? entry.lexical_score_normalized : undefined,
      bm25_score: typeof entry.bm25_score === "number" ? entry.bm25_score : undefined,
      bm25_coverage: typeof entry.bm25_coverage === "number" ? entry.bm25_coverage : undefined,
      bm25_matches: typeof entry.bm25_matches === "number" ? entry.bm25_matches : undefined,
      bm25_query_tokens: typeof entry.bm25_query_tokens === "number" ? entry.bm25_query_tokens : undefined,
      rrf_score: typeof entry.rrf_score === "number" ? entry.rrf_score : undefined,
      channel_boost: typeof entry.channel_boost === "number" ? entry.channel_boost : undefined,
      hybrid_rank: typeof entry.hybrid_rank === "number" ? entry.hybrid_rank : undefined,
      dense_rank: typeof entry.dense_rank === "number" ? entry.dense_rank : undefined,
      lexical_rank: typeof entry.lexical_rank === "number" ? entry.lexical_rank : undefined,
      rank_score: typeof entry.rank_score === "number" ? entry.rank_score : undefined,
      topic_boost: typeof entry.topic_boost === "number" ? entry.topic_boost : undefined,
      quality_adjust: typeof entry.quality_adjust === "number" ? entry.quality_adjust : undefined
    };
    return Object.fromEntries(Object.entries(sanitized).filter(([, value]) => typeof value !== "undefined"));
  });
}

function sanitizeSourcePackageSectionSources(sources = []) {
  if (!Array.isArray(sources)) return [];
  return sources.slice(0, 12).map((source = {}) => Object.fromEntries(Object.entries({
    source_id: source.source_id || undefined,
    title: source.title || undefined,
    source_type: source.source_type || undefined,
    collection_id: source.collection_id || undefined,
    item_type: source.item_type || undefined,
    resource_type: source.resource_type || undefined,
    municipality_id: source.municipality_id || undefined,
    municipality_name: source.municipality_name || undefined,
    source_status: source.source_status || undefined,
    last_checked: source.last_checked || undefined,
    historical: source.historical === true ? true : undefined
  }).filter(([, value]) => typeof value !== "undefined")));
}

function sanitizeSectionCounts(pkg = {}, sections = {}) {
  if (pkg.section_counts && typeof pkg.section_counts === "object") return pkg.section_counts;
  return Object.fromEntries(Object.entries(sections).map(([key, value]) => [
    key,
    Array.isArray(value) ? value.length : 0
  ]));
}

function sanitizeSourcePackages(packages = []) {
  if (!Array.isArray(packages)) return [];
  return packages.slice(0, 20).map((pkg = {}) => {
    const sections = pkg.sections && typeof pkg.sections === "object" ? pkg.sections : {};
    const sanitizedSections = {};
    for (const [key, value] of Object.entries(sections)) {
      sanitizedSections[key] = sanitizeSourcePackageSectionSources(value);
    }
    return Object.fromEntries(Object.entries({
      package_id: pkg.package_id || undefined,
      canonical_item_id: pkg.canonical_item_id || undefined,
      package_type: pkg.package_type || undefined,
      title: pkg.title || undefined,
      municipality_id: pkg.municipality_id || undefined,
      municipality_name: pkg.municipality_name || undefined,
      sections: sanitizedSections,
      section_counts: sanitizeSectionCounts(pkg, sanitizedSections),
      source_ids: Array.isArray(pkg.source_ids) ? pkg.source_ids : undefined,
      last_checked: pkg.last_checked || undefined,
      confidence: pkg.confidence || undefined,
      missing_sections: Array.isArray(pkg.missing_sections) ? pkg.missing_sections : undefined
    }).filter(([, value]) => typeof value !== "undefined"));
  });
}

function sanitizeLegalLookupPlan(plan = null) {
  if (!plan || typeof plan !== "object") return null;
  return {
    enabled: plan.enabled === true,
    mode: typeof plan.mode === "string" ? plan.mode : undefined,
    jurisdictionLevel: typeof plan.jurisdictionLevel === "string" ? plan.jurisdictionLevel : undefined,
    sourceTypes: Array.isArray(plan.sourceTypes) ? plan.sourceTypes : undefined,
    collectionId: typeof plan.collectionId === "string" ? plan.collectionId : undefined,
    actTitle: typeof plan.actTitle === "string" ? plan.actTitle : undefined,
    actAliases: Array.isArray(plan.actAliases) ? plan.actAliases : undefined,
    municipalityId: typeof plan.municipalityId === "string" ? plan.municipalityId : undefined,
    paragraphRefs: Array.isArray(plan.paragraphRefs) ? plan.paragraphRefs : undefined,
    topicTerms: Array.isArray(plan.topicTerms) ? plan.topicTerms : undefined,
    requireCurrent: plan.requireCurrent === true ? true : undefined
  };
}

function sanitizeSectionAttribution(entries = []) {
  if (!Array.isArray(entries)) return [];
  return entries.slice(0, 80).map((entry = {}) => Object.fromEntries(Object.entries({
    package_id: typeof entry.package_id === "string" ? entry.package_id : undefined,
    section: typeof entry.section === "string" ? entry.section : undefined,
    source_ids: Array.isArray(entry.source_ids) ? entry.source_ids.map(value => String(value || "").trim()).filter(Boolean).slice(0, 20) : [],
    evidence_strength: typeof entry.evidence_strength === "string" ? entry.evidence_strength : undefined,
    evidence_statuses: Array.isArray(entry.evidence_statuses) ? entry.evidence_statuses.map(value => String(value || "").trim()).filter(Boolean).slice(0, 8) : []
  }).filter(([, value]) => typeof value !== "undefined")));
}

function sanitizeAttributionFlags(flags = []) {
  return Array.isArray(flags) ? flags.map(value => String(value || "").trim()).filter(Boolean).slice(0, 40) : [];
}

function uniqueTraceIds(values = []) {
  const out = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const id = String(value || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function traceIdDifference(left = [], right = []) {
  const rightSet = new Set(uniqueTraceIds(right));
  return uniqueTraceIds(left).filter(id => !rightSet.has(id));
}

function buildSourceLayerMetrics({
  retrievedSourceIds = [],
  selectedContextSourceIds = [],
  attribution = null
}) {
  const retrievedIds = uniqueTraceIds(retrievedSourceIds);
  const selectedIds = uniqueTraceIds(selectedContextSourceIds);
  const answerIds = uniqueTraceIds(attribution?.answer_source_ids || attribution?.displayed_source_ids || []);
  const displayedIds = uniqueTraceIds(attribution?.displayed_source_ids || []);
  const filteredOutIds = uniqueTraceIds(attribution?.filtered_out_source_ids || []);
  const displayedNotInSelected = traceIdDifference(displayedIds, selectedIds);
  const displayedNotInAnswer = traceIdDifference(displayedIds, answerIds);

  return {
    selected_source_count: selectedIds.length,
    answer_source_count: answerIds.length,
    displayed_source_count: displayedIds.length,
    filtered_out_source_count: filteredOutIds.length,
    displayed_sources_subset_of_selected: displayedNotInSelected.length === 0,
    displayed_sources_subset_of_answer: displayedNotInAnswer.length === 0,
    displayed_not_in_selected_source_ids: displayedNotInSelected.slice(0, 40),
    displayed_not_in_answer_source_ids: displayedNotInAnswer.slice(0, 40),
    selected_but_not_displayed_source_ids: traceIdDifference(selectedIds, displayedIds).slice(0, 80),
    retrieved_but_not_displayed_source_ids: traceIdDifference(retrievedIds, displayedIds).slice(0, 80),
    attribution_filtered_source_ids: filteredOutIds,
    attribution_filter_reasons: attribution?.filter_reasons || {}
  };
}

function sanitizeOverviewSynthesisTrace(value = null) {
  if (!value || typeof value !== "object") return null;
  const selectedDocumentIds = Array.isArray(value.selected_document_ids)
    ? value.selected_document_ids.map(item => String(item || "").trim()).filter(Boolean).slice(0, 40)
    : [];
  const objectOfNumbers = (input = {}) => Object.fromEntries(
    Object.entries(input && typeof input === "object" ? input : {})
      .slice(0, 80)
      .map(([key, count]) => [String(key || "").trim(), Number.isFinite(Number(count)) ? Number(count) : 0])
      .filter(([key]) => key)
  );
  return Object.fromEntries(Object.entries({
    mode: "overview_synthesis",
    overview_synthesis_used: value.overview_synthesis_used === true,
    selection_strategy: String(value.selection_strategy || "overview_diversity_then_depth"),
    distinct_candidate_document_count: Number.isFinite(Number(value.distinct_candidate_document_count)) ? Number(value.distinct_candidate_document_count) : 0,
    distinct_relevant_candidate_document_count: Number.isFinite(Number(value.distinct_relevant_candidate_document_count)) ? Number(value.distinct_relevant_candidate_document_count) : 0,
    distinct_selected_document_count: Number.isFinite(Number(value.distinct_selected_document_count)) ? Number(value.distinct_selected_document_count) : selectedDocumentIds.length,
    selected_document_ids: selectedDocumentIds,
    document_identity_fields_used: objectOfNumbers(value.document_identity_fields_used),
    chunks_per_document: objectOfNumbers(value.chunks_per_document),
    initial_diversity_pass_document_count: Number.isFinite(Number(value.initial_diversity_pass_document_count)) ? Number(value.initial_diversity_pass_document_count) : 0,
    depth_pass_added_chunks: Number.isFinite(Number(value.depth_pass_added_chunks)) ? Number(value.depth_pass_added_chunks) : 0,
    dominant_document_id: value.dominant_document_id ? String(value.dominant_document_id) : null,
    dominant_document_share: Number.isFinite(Number(value.dominant_document_share)) ? Number(value.dominant_document_share) : 0,
    dominant_document_allowed: value.dominant_document_allowed === true,
    dominant_document_reason: value.dominant_document_reason ? String(value.dominant_document_reason) : null,
    source_diversity_limited: value.source_diversity_limited === true,
    source_diversity_reason: value.source_diversity_reason ? String(value.source_diversity_reason) : null
  }).filter(([, item]) => typeof item !== "undefined"));
}

function sanitizeEvidencePackageTrace(value = null) {
  if (!value || typeof value !== "object") return null;
  const stringList = (input = [], limit = 20) => Array.isArray(input)
    ? input.map(item => String(item || "").trim()).filter(Boolean).slice(0, limit)
    : [];
  const objectOfNumbers = (input = {}) => Object.fromEntries(
    Object.entries(input && typeof input === "object" ? input : {})
      .slice(0, 80)
      .map(([key, count]) => [String(key || "").trim(), Number.isFinite(Number(count)) ? Number(count) : 0])
      .filter(([key]) => key)
  );
  const sanitizeSelectedSource = (source = {}) => Object.fromEntries(Object.entries({
    id: source.id ? String(source.id) : undefined,
    title: truncateTraceString(source.title, 180),
    source_type: source.source_type ? String(source.source_type) : undefined,
    collection_id: source.collection_id ? String(source.collection_id) : undefined,
    resource_type: source.resource_type ? String(source.resource_type) : undefined,
    item_type: source.item_type ? String(source.item_type) : undefined,
    source_layer: source.source_layer ? String(source.source_layer) : undefined,
    source_year: Number.isFinite(Number(source.source_year)) ? Number(source.source_year) : undefined,
    paragraph_number: source.paragraph_number ? String(source.paragraph_number) : undefined,
    paragraph_title: truncateTraceString(source.paragraph_title, 180),
    section: source.section ? String(source.section) : undefined,
    canonical_item_id: source.canonical_item_id ? String(source.canonical_item_id) : undefined,
    municipality_id: source.municipality_id ? String(source.municipality_id) : undefined,
    municipality_name: source.municipality_name ? String(source.municipality_name) : undefined,
    url_present: source.url_present === true
  }).filter(([, item]) => typeof item !== "undefined"));
  const sanitizeSelectedDocument = (doc = {}) => Object.fromEntries(Object.entries({
    document_id: doc.document_id ? String(doc.document_id) : undefined,
    title: truncateTraceString(doc.title, 180),
    source_type: doc.source_type ? String(doc.source_type) : undefined,
    collection_id: doc.collection_id ? String(doc.collection_id) : undefined,
    source_year: Number.isFinite(Number(doc.source_year)) ? Number(doc.source_year) : undefined,
    chunk_count: Number.isFinite(Number(doc.chunk_count)) ? Number(doc.chunk_count) : undefined,
    source_ids: stringList(doc.source_ids, 12)
  }).filter(([, item]) => typeof item !== "undefined"));
  const sourceLayerMix = value.source_layer_mix && typeof value.source_layer_mix === "object"
    ? {
        by_layer: objectOfNumbers(value.source_layer_mix.by_layer),
        by_source_type: objectOfNumbers(value.source_layer_mix.by_source_type),
        by_collection_id: objectOfNumbers(value.source_layer_mix.by_collection_id),
        by_resource_type: objectOfNumbers(value.source_layer_mix.by_resource_type)
      }
    : {};

  return Object.fromEntries(Object.entries({
    version: value.version ? String(value.version) : undefined,
    mode: value.mode ? String(value.mode) : undefined,
    selected_sources: Array.isArray(value.selected_sources) ? value.selected_sources.slice(0, 24).map(sanitizeSelectedSource) : [],
    selected_documents: Array.isArray(value.selected_documents) ? value.selected_documents.slice(0, 40).map(sanitizeSelectedDocument) : [],
    source_layer_mix: sourceLayerMix,
    evidence_strength: value.evidence_strength && typeof value.evidence_strength === "object"
      ? Object.fromEntries(Object.entries({
          overall: value.evidence_strength.overall ? String(value.evidence_strength.overall) : undefined,
          selected_source_count: Number.isFinite(Number(value.evidence_strength.selected_source_count)) ? Number(value.evidence_strength.selected_source_count) : undefined,
          selected_document_count: Number.isFinite(Number(value.evidence_strength.selected_document_count)) ? Number(value.evidence_strength.selected_document_count) : undefined,
          risk_level: value.evidence_strength.risk_level ? String(value.evidence_strength.risk_level) : undefined,
          required_evidence: value.evidence_strength.required_evidence ? String(value.evidence_strength.required_evidence) : undefined,
          insufficient_evidence_mode: value.evidence_strength.insufficient_evidence_mode === true
        }).filter(([, item]) => typeof item !== "undefined"))
      : {},
    coverage_warnings: stringList(value.coverage_warnings, 30),
    missing_coverage: stringList(value.missing_coverage, 30),
    limitations: stringList(value.limitations, 20),
    answer_guidance: stringList(value.answer_guidance, 12),
    temporal_coverage: value.temporal_coverage && typeof value.temporal_coverage === "object"
      ? Object.fromEntries(Object.entries({
          years: Array.isArray(value.temporal_coverage.years)
            ? value.temporal_coverage.years
                .map(item => Number(item))
                .filter(item => Number.isInteger(item) && item >= 1900 && item <= 2100)
                .slice(0, 20)
            : [],
          min_year: Number.isFinite(Number(value.temporal_coverage.min_year)) ? Number(value.temporal_coverage.min_year) : undefined,
          max_year: Number.isFinite(Number(value.temporal_coverage.max_year)) ? Number(value.temporal_coverage.max_year) : undefined,
          year_range: value.temporal_coverage.year_range ? String(value.temporal_coverage.year_range) : undefined,
          span_years: Number.isFinite(Number(value.temporal_coverage.span_years)) ? Number(value.temporal_coverage.span_years) : undefined,
          source_count_with_year: Number.isFinite(Number(value.temporal_coverage.source_count_with_year)) ? Number(value.temporal_coverage.source_count_with_year) : undefined,
          document_count_with_year: Number.isFinite(Number(value.temporal_coverage.document_count_with_year)) ? Number(value.temporal_coverage.document_count_with_year) : undefined,
          by_year: objectOfNumbers(value.temporal_coverage.by_year),
          has_multi_year_range: value.temporal_coverage.has_multi_year_range === true
        }).filter(([, item]) => typeof item !== "undefined"))
      : undefined,
    trace_summary: value.trace_summary && typeof value.trace_summary === "object"
      ? Object.fromEntries(Object.entries({
          mode: value.trace_summary.mode ? String(value.trace_summary.mode) : undefined,
          selected_source_count: Number.isFinite(Number(value.trace_summary.selected_source_count)) ? Number(value.trace_summary.selected_source_count) : undefined,
          selected_document_count: Number.isFinite(Number(value.trace_summary.selected_document_count)) ? Number(value.trace_summary.selected_document_count) : undefined,
          source_layer_count: Number.isFinite(Number(value.trace_summary.source_layer_count)) ? Number(value.trace_summary.source_layer_count) : undefined,
          year_range: value.trace_summary.year_range ? String(value.trace_summary.year_range) : undefined,
          distinct_year_count: Number.isFinite(Number(value.trace_summary.distinct_year_count)) ? Number(value.trace_summary.distinct_year_count) : undefined,
          temporal_span_years: Number.isFinite(Number(value.trace_summary.temporal_span_years)) ? Number(value.trace_summary.temporal_span_years) : undefined,
          warning_count: Number.isFinite(Number(value.trace_summary.warning_count)) ? Number(value.trace_summary.warning_count) : undefined,
          planner_reason: truncateTraceString(value.trace_summary.planner_reason, 180),
          retrieval_strategy: value.trace_summary.retrieval_strategy ? String(value.trace_summary.retrieval_strategy) : undefined,
          selection_strategy: value.trace_summary.selection_strategy ? String(value.trace_summary.selection_strategy) : undefined,
          topics: stringList(value.trace_summary.topics, 12)
        }).filter(([, item]) => typeof item !== "undefined"))
      : {}
  }).filter(([, item]) => typeof item !== "undefined"));
}

export function buildRagTraceFromAttribution(sources = [], attribution, retrievalMeta = null) {
  const sourceList = Array.isArray(sources) ? sources : [];
  const sourceIds = sourceList.map((source, index) => getSourceAttributionId(source, index));
  const retrievedSourceIds = Array.isArray(retrievalMeta?.retrievedSourceIds)
    ? retrievalMeta.retrievedSourceIds
    : attribution?.retrieved_source_ids || sourceIds;
  const selectedContextSourceIds = Array.isArray(retrievalMeta?.selectedContextSourceIds)
    ? retrievalMeta.selectedContextSourceIds
    : attribution?.selected_context_source_ids || sourceIds;
  const retrievedCount = Number.isFinite(Number(retrievalMeta?.rawMatchesCount))
    ? Number(retrievalMeta.rawMatchesCount)
    : sourceList.length;
  const queryPlan = retrievalMeta?.queryPlan && typeof retrievalMeta.queryPlan === "object"
    ? { ...retrievalMeta.queryPlan }
    : {};
  const legalLookupPlan = sanitizeLegalLookupPlan(retrievalMeta?.legalLookupPlan);
  const overviewSynthesisTrace = sanitizeOverviewSynthesisTrace(retrievalMeta?.overviewSynthesis);
  const evidencePackageTrace = sanitizeEvidencePackageTrace(retrievalMeta?.evidencePackage);
  const sourceLayerMetrics = buildSourceLayerMetrics({
    retrievedSourceIds,
    selectedContextSourceIds,
    attribution
  });
  if (legalLookupPlan && !queryPlan.legalLookupPlan) {
    queryPlan.legalLookupPlan = legalLookupPlan;
  }
  return {
    retrieved_count: retrievedCount,
    selected_context_count: Number.isFinite(Number(retrievalMeta?.selectedContextCount))
      ? Number(retrievalMeta.selectedContextCount)
      : sourceList.length,
    retrievers_used: Array.isArray(retrievalMeta?.retrieversUsed)
      ? retrievalMeta.retrieversUsed
      : [],
    retrieved_source_ids: retrievedSourceIds,
    selected_context_source_ids: selectedContextSourceIds,
    ...(Array.isArray(retrievalMeta?.selectedContextDetails)
      ? { selected_context_details: sanitizeSelectedContextDetails(retrievalMeta.selectedContextDetails) }
      : {}),
    ...(Array.isArray(retrievalMeta?.sourcePackages)
      ? { source_packages: sanitizeSourcePackages(retrievalMeta.sourcePackages) }
      : {}),
    package_aware_answering_used: retrievalMeta?.packageAwareAnswering?.used === true,
    used_package_ids: Array.isArray(retrievalMeta?.packageAwareAnswering?.usedPackageIds)
      ? retrievalMeta.packageAwareAnswering.usedPackageIds
      : [],
    missing_sections_used: Array.isArray(retrievalMeta?.packageAwareAnswering?.missingSectionsUsed)
      ? retrievalMeta.packageAwareAnswering.missingSectionsUsed
      : [],
    package_displayed_source_ids: Array.isArray(retrievalMeta?.packageAwareAnswering?.packageDisplayedSourceIds)
      ? retrievalMeta.packageAwareAnswering.packageDisplayedSourceIds
      : [],
    package_answer_flags: Array.isArray(retrievalMeta?.packageAwareAnswering?.packageAnswerFlags)
      ? retrievalMeta.packageAwareAnswering.packageAnswerFlags
      : [],
    package_attribution_checked: retrievalMeta?.sectionAttribution?.package_attribution_checked === true,
    high_risk_attribution_checked: retrievalMeta?.sectionAttribution?.high_risk_attribution_checked === true,
    section_attribution: sanitizeSectionAttribution(retrievalMeta?.sectionAttribution?.section_attribution),
    attribution_flags: sanitizeAttributionFlags(retrievalMeta?.sectionAttribution?.attribution_flags),
    answer_source_ids: attribution?.answer_source_ids || attribution?.displayed_source_ids || [],
    displayed_source_ids: attribution?.displayed_source_ids || [],
    filtered_out_source_ids: attribution?.filtered_out_source_ids || [],
    filter_reasons: attribution?.filter_reasons || {},
    ...sourceLayerMetrics,
    attribution_decisions: attribution?.attribution_decisions || [],
    ...(retrievalMeta?.ragRiskPolicy
      ? {
          rag_risk_level: retrievalMeta.ragRiskPolicy.riskLevel,
          rag_required_evidence: retrievalMeta.ragRiskPolicy.requiredEvidence,
          rag_insufficient_evidence_mode: !!retrievalMeta.ragRiskPolicy.insufficientEvidenceMode
        }
      : {}),
    ...(overviewSynthesisTrace ? { overview_synthesis: overviewSynthesisTrace } : {}),
    ...(evidencePackageTrace ? { evidence_package: evidencePackageTrace } : {}),
    ...(typeof retrievalMeta?.insufficientPreciseLegalSourceSupport === "boolean"
      ? {
          insufficient_precise_legal_source_support: retrievalMeta.insufficientPreciseLegalSourceSupport,
          insufficientPreciseLegalSourceSupport: retrievalMeta.insufficientPreciseLegalSourceSupport
        }
      : {}),
    ...(Object.keys(queryPlan).length ? { query_plan: queryPlan } : {}),
    ...(retrievalMeta?.hybridRetrieval ? { hybrid_retrieval: retrievalMeta.hybridRetrieval } : {}),
    retrieval_trace_level: Array.isArray(retrievalMeta?.retrievedSourceIds)
      ? "retrieved_candidates"
      : "selected_context_sources"
  };
}

export function buildAttributionMetadata(metadataExtra, sources, attribution, retrievalMeta = null) {
  const ragTrace = buildRagTraceFromAttribution(sources, attribution, retrievalMeta);
  return {
    ...(metadataExtra && typeof metadataExtra === "object" ? metadataExtra : {}),
    ...buildRagContractMetadata(),
    displayed_sources: attribution?.displayedSources || [],
    displayed_source_ids: attribution?.displayed_source_ids || [],
    ...(typeof retrievalMeta?.insufficientPreciseLegalSourceSupport === "boolean"
      ? {
          insufficient_precise_legal_source_support: retrievalMeta.insufficientPreciseLegalSourceSupport,
          insufficientPreciseLegalSourceSupport: retrievalMeta.insufficientPreciseLegalSourceSupport
        }
      : {}),
    ...(RAG_ATTRIBUTION_DECISIONS_ENABLED ? { attribution_decisions: attribution?.attribution_decisions || [] } : {}),
    ...(RAG_TRACE_V1_ENABLED ? { rag_trace: ragTrace } : {})
  };
}

async function emitRagTraceEvent(logEvent, {
  userId,
  role,
  isCrisis,
  ragTrace
}) {
  if (!RAG_TRACE_V1_ENABLED || typeof logEvent !== "function" || !ragTrace) return;
  await logEvent("rag_trace", {
    userId,
    role,
    isCrisis,
    retrieved_count: ragTrace.retrieved_count,
    selected_context_count: ragTrace.selected_context_count,
    retrievers_used: ragTrace.retrievers_used,
    retrieved_source_ids: ragTrace.retrieved_source_ids,
    selected_context_source_ids: ragTrace.selected_context_source_ids,
    selected_context_details: ragTrace.selected_context_details,
    source_packages: ragTrace.source_packages,
    package_aware_answering_used: ragTrace.package_aware_answering_used,
    used_package_ids: ragTrace.used_package_ids,
    missing_sections_used: ragTrace.missing_sections_used,
    package_displayed_source_ids: ragTrace.package_displayed_source_ids,
    package_answer_flags: ragTrace.package_answer_flags,
    package_attribution_checked: ragTrace.package_attribution_checked,
    high_risk_attribution_checked: ragTrace.high_risk_attribution_checked,
    section_attribution: ragTrace.section_attribution,
    attribution_flags: ragTrace.attribution_flags,
    answer_source_ids: ragTrace.answer_source_ids,
    displayed_source_ids: ragTrace.displayed_source_ids,
    filtered_out_source_ids: ragTrace.filtered_out_source_ids,
    filter_reasons: ragTrace.filter_reasons,
    selected_source_count: ragTrace.selected_source_count,
    answer_source_count: ragTrace.answer_source_count,
    displayed_source_count: ragTrace.displayed_source_count,
    filtered_out_source_count: ragTrace.filtered_out_source_count,
    displayed_sources_subset_of_selected: ragTrace.displayed_sources_subset_of_selected,
    displayed_sources_subset_of_answer: ragTrace.displayed_sources_subset_of_answer,
    displayed_not_in_selected_source_ids: ragTrace.displayed_not_in_selected_source_ids,
    displayed_not_in_answer_source_ids: ragTrace.displayed_not_in_answer_source_ids,
    selected_but_not_displayed_source_ids: ragTrace.selected_but_not_displayed_source_ids,
    retrieved_but_not_displayed_source_ids: ragTrace.retrieved_but_not_displayed_source_ids,
    attribution_filtered_source_ids: ragTrace.attribution_filtered_source_ids,
    attribution_filter_reasons: ragTrace.attribution_filter_reasons,
    attribution_decisions: ragTrace.attribution_decisions,
    rag_risk_level: ragTrace.rag_risk_level,
    rag_required_evidence: ragTrace.rag_required_evidence,
    rag_insufficient_evidence_mode: ragTrace.rag_insufficient_evidence_mode,
    overview_synthesis: ragTrace.overview_synthesis,
    evidence_package: ragTrace.evidence_package,
    query_plan: ragTrace.query_plan,
    hybrid_retrieval: ragTrace.hybrid_retrieval,
    retrieval_trace_level: ragTrace.retrieval_trace_level
  });
}

function resolveDisplayedSources(originalSources, attribution) {
  return RAG_DISPLAYED_SOURCES_ENFORCED
    ? attribution?.displayedSources || []
    : Array.isArray(originalSources)
      ? originalSources
      : [];
}

function resolveAttributionDecisions(attribution) {
  return RAG_ATTRIBUTION_DECISIONS_ENABLED ? attribution?.attribution_decisions || [] : null;
}

function resolveRagTrace(sources, attribution, retrievalMeta) {
  return RAG_TRACE_V1_ENABLED ? buildRagTraceFromAttribution(sources, attribution, retrievalMeta) : null;
}

async function persistSourcePackagesFromTrace(ragTrace, logError) {
  const packages = Array.isArray(ragTrace?.source_packages) ? ragTrace.source_packages : [];
  if (!packages.length) return;
  try {
    await persistSourcePackageSnapshots(packages);
  } catch (error) {
    if (typeof logError === "function") {
      logError("source_packages.persist.error", {
        err: error?.message || String(error),
        packageCount: packages.length
      });
    }
  }
}

export async function handleMainChatResponse({
  req,
  wantStream,
  persist,
  convId,
  userId,
  normalizedRole,
  effectiveMessage,
  modelUserMessage = null,
  messageLength,
  history,
  effectiveContext,
  grounding,
  includeSources,
  replyLang,
  isCrisis,
  extraSystemInstructions,
  sources,
  retrievalMeta,
  metadataExtra,
  wantsDocumentDownload,
  roomId,
  saveRoomMessage,
  noContextReply,
  noContextMeta,
  makeError,
  logInfo,
  logError,
  logEvent
}) {
  if (!effectiveContext || !effectiveContext.trim()) {
    if (typeof logInfo === "function") {
      logInfo("branch.noContext", {
        role: normalizedRole,
        isCrisis,
        ragReturned: !!noContextMeta?.ragReturned,
        hadDocContext: !!noContextMeta?.hadDocContext,
        sourceLookupRequest: !!noContextMeta?.sourceLookupRequest,
        previousSourceUseRequest: !!noContextMeta?.previousSourceUseRequest
      });
    }
    if (typeof logEvent === "function") {
      await logEvent("no_context", {
        userId,
        role: normalizedRole,
        isCrisis,
        hadRagResults: !!noContextMeta?.ragReturned,
        hadDocContext: !!noContextMeta?.hadDocContext,
        sourceLookupRequest: !!noContextMeta?.sourceLookupRequest,
        previousSourceUseRequest: !!noContextMeta?.previousSourceUseRequest
      });
    }

    const attribution = buildSourceAttribution(noContextReply, sources, {
      query: effectiveMessage,
      riskPolicy: retrievalMeta?.ragRiskPolicy,
      legalLookupPlan: retrievalMeta?.legalLookupPlan || retrievalMeta?.queryPlan?.legalLookupPlan,
      queryPlan: retrievalMeta?.queryPlan,
      packageDisplayedSourceIds: retrievalMeta?.packageAwareAnswering?.packageDisplayedSourceIds,
      packageAwareAnsweringUsed: retrievalMeta?.packageAwareAnswering?.used === true,
      municipalityContext: retrievalMeta?.municipalityContext
    });
    const replySources = resolveDisplayedSources(sources, attribution);
    const ragTrace = resolveRagTrace(sources, attribution, retrievalMeta);
    const ragContract = buildRagContractMetadata();
    const attributionDecisions = resolveAttributionDecisions(attribution);
    await emitRagTraceEvent(logEvent, {
      userId,
      role: normalizedRole,
      isCrisis,
      ragTrace
    });
    await persistSourcePackagesFromTrace(ragTrace, logError);
    const { attachments } = await finalizeAssistantReply({
      persist,
      convId,
      userId,
      role: normalizedRole,
      userMessage: effectiveMessage,
      reply: noContextReply,
      sources: replySources,
      displayedSources: replySources,
      ragTrace,
      ragContract,
      attributionDecisions,
      attachments: [],
      cards: [],
      metadataExtra: buildAttributionMetadata(metadataExtra, sources, attribution, retrievalMeta),
      isCrisis,
      wantsDocumentDownload,
      replyLang,
      messageForDownload: effectiveMessage,
      roomId,
      saveRoomMessage
    });
    return buildImmediateChatResponse({
      wantStream,
      reply: noContextReply,
      sources: replySources,
      displayedSources: replySources,
      ragTrace,
      ragContract,
      attributionDecisions,
      attachments,
      cards: [],
      isCrisis,
      convId
    });
  }

  if (persist && convId && userId) {
    await persistInit({
      convId,
      userId,
      role: normalizedRole,
      sources,
      isCrisis,
      userMessage: effectiveMessage
    });
  }

  if (!wantStream) {
    try {
      const aiResult = await callOpenAI({
        history,
        userMessage: modelUserMessage || effectiveMessage,
        context: effectiveContext,
        effectiveRole: normalizedRole,
        grounding,
        includeSources,
        replyLang,
        isCrisis,
        extraSystemInstructions,
        userId,
        role: normalizedRole
      });
      const attribution = buildSourceAttribution(aiResult.reply, sources, {
        query: effectiveMessage,
        riskPolicy: retrievalMeta?.ragRiskPolicy,
        legalLookupPlan: retrievalMeta?.legalLookupPlan || retrievalMeta?.queryPlan?.legalLookupPlan,
        queryPlan: retrievalMeta?.queryPlan,
        packageDisplayedSourceIds: retrievalMeta?.packageAwareAnswering?.packageDisplayedSourceIds,
        packageAwareAnsweringUsed: retrievalMeta?.packageAwareAnswering?.used === true,
        municipalityContext: retrievalMeta?.municipalityContext
      });
      const replySources = resolveDisplayedSources(sources, attribution);
      const ragTrace = resolveRagTrace(sources, attribution, retrievalMeta);
      const ragContract = buildRagContractMetadata();
      const attributionDecisions = resolveAttributionDecisions(attribution);
      await emitRagTraceEvent(logEvent, {
        userId,
        role: normalizedRole,
        isCrisis,
        ragTrace
      });
      await persistSourcePackagesFromTrace(ragTrace, logError);
      const { attachments } = await finalizeAssistantReply({
        persist,
        persistInitialized: true,
        convId,
        userId,
        role: normalizedRole,
        userMessage: effectiveMessage,
        reply: aiResult.reply,
        sources: replySources,
        displayedSources: replySources,
        ragTrace,
        ragContract,
        attributionDecisions,
        attachments: [],
        cards: [],
        metadataExtra: buildAttributionMetadata(metadataExtra, sources, attribution, retrievalMeta),
        isCrisis,
        wantsDocumentDownload,
        replyLang,
        messageForDownload: effectiveMessage,
        roomId,
        saveRoomMessage
      });
      return buildImmediateChatResponse({
        wantStream: false,
        reply: aiResult.reply,
        sources: replySources,
        displayedSources: replySources,
        ragTrace,
        ragContract,
        attributionDecisions,
        attachments,
        cards: [],
        isCrisis,
        convId
      });
    } catch (err) {
      const rawErrMessage = (err?.response?.data?.error?.message || err?.error?.message || err?.message) ?? "chat.error.openai_request_failed";
      const safeMessageKey = typeof rawErrMessage === "string" && rawErrMessage.startsWith("chat.")
        ? rawErrMessage
        : "chat.error.openai_request_failed";
      if (typeof logError === "function") {
        logError("openai.call.error", {
          err: rawErrMessage,
          stack: err?.stack,
          userId,
          role: normalizedRole,
          isCrisis,
          messageLength
        });
      }
      if (typeof logEvent === "function") {
        await logEvent("openai_error", {
          userId,
          role: normalizedRole,
          isCrisis,
          message: rawErrMessage,
          messageLength
        });
      }
      if (persist && convId && userId) {
        await persistDone({
          convId,
          userId,
          status: "ERROR"
        });
      }
      return makeError(safeMessageKey, 502, {
        code: err?.name
      });
    }
  }

  const enc = new TextEncoder();
  let clientGone = false;
  let heartbeatTimer = null;
  let accumulated = "";
  let pendingDelta = "";
  let lastDeltaFlushAt = Date.now();
  const sse = new ReadableStream({
    async start(controller) {
      let streamFinalized = false;

      const flushPendingDelta = () => {
        if (!pendingDelta || clientGone) return;
        const text = pendingDelta;
        pendingDelta = "";
        lastDeltaFlushAt = Date.now();
        try {
          controller.enqueue(enc.encode(`event: delta\ndata: ${JSON.stringify({
            t: text
          })}\n\n`));
        } catch {
          clientGone = true;
        }
      };

      const finalizeStreamReply = async () => {
        if (streamFinalized) return;
        streamFinalized = true;
        if (!accumulated.trim()) {
          accumulated = EMPTY_STREAM_REPLY_FALLBACK;
          pendingDelta += EMPTY_STREAM_REPLY_FALLBACK;
        }
        flushPendingDelta();
        const attribution = buildSourceAttribution(accumulated, sources, {
          query: effectiveMessage,
          riskPolicy: retrievalMeta?.ragRiskPolicy,
          legalLookupPlan: retrievalMeta?.legalLookupPlan || retrievalMeta?.queryPlan?.legalLookupPlan,
          queryPlan: retrievalMeta?.queryPlan,
          packageDisplayedSourceIds: retrievalMeta?.packageAwareAnswering?.packageDisplayedSourceIds,
          packageAwareAnsweringUsed: retrievalMeta?.packageAwareAnswering?.used === true,
          municipalityContext: retrievalMeta?.municipalityContext
        });
        const replySources = resolveDisplayedSources(sources, attribution);
        const ragTrace = resolveRagTrace(sources, attribution, retrievalMeta);
        const ragContract = buildRagContractMetadata();
        const attributionDecisions = resolveAttributionDecisions(attribution);
        await emitRagTraceEvent(logEvent, {
          userId,
          role: normalizedRole,
          isCrisis,
          ragTrace
        });
        await persistSourcePackagesFromTrace(ragTrace, logError);
        const { attachments } = await finalizeAssistantReply({
          persist,
          persistInitialized: true,
          convId,
          userId,
          role: normalizedRole,
          userMessage: effectiveMessage,
          reply: accumulated,
          sources: replySources,
          displayedSources: replySources,
          ragTrace,
          attributionDecisions,
          attachments: [],
          cards: [],
          metadataExtra: buildAttributionMetadata(metadataExtra, sources, attribution, retrievalMeta),
          isCrisis,
          wantsDocumentDownload,
          replyLang,
          messageForDownload: effectiveMessage,
          roomId,
          saveRoomMessage
        });
        if (!clientGone) {
          try {
            controller.enqueue(enc.encode(`event: done\ndata: ${JSON.stringify({
              attachments,
              sources: replySources,
              displayed_sources: replySources,
              ...ragContract,
              ...(ragTrace ? { rag_trace: ragTrace } : {}),
              ...(Array.isArray(attributionDecisions) ? { attribution_decisions: attributionDecisions } : {})
            })}\n\n`));
          } catch {}
        }
      };

      try {
        req.signal?.addEventListener("abort", () => {
          clientGone = true;
          if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }
        });
      } catch {}

      heartbeatTimer = setInterval(() => {
        if (!clientGone) {
          try {
            controller.enqueue(enc.encode(`: keepalive\n\n`));
          } catch {
            clientGone = true;
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }
        }
      }, 15000);

      if (!clientGone) {
        try {
          controller.enqueue(enc.encode(`event: meta\ndata: ${JSON.stringify({
            isCrisis
          })}\n\n`));
        } catch {
          clientGone = true;
        }
      }

      try {
        const iter = await streamOpenAI({
          history,
          userMessage: modelUserMessage || effectiveMessage,
          context: effectiveContext,
          effectiveRole: normalizedRole,
          grounding,
          includeSources,
          replyLang,
          isCrisis,
          extraSystemInstructions,
          userId,
          role: normalizedRole
        });
        for await (const ev of iter) {
          if (ev.type === "delta" && ev.text) {
            accumulated += ev.text;
            pendingDelta += ev.text;
            if (!clientGone && shouldFlushStreamDelta(pendingDelta, lastDeltaFlushAt)) {
              flushPendingDelta();
            }
          } else if (ev.type === "done") {
            await finalizeStreamReply();
          }
        }
        if (!streamFinalized) {
          await finalizeStreamReply();
        }
      } catch (err) {
        const streamSafeMessage = "chat.error.openai_request_failed";
        if (!clientGone) {
          try {
            controller.enqueue(enc.encode(`event: error\ndata: ${JSON.stringify({
              message: streamSafeMessage
            })}\n\n`));
          } catch {}
        }
        if (typeof logError === "function") {
          logError("openai.stream.error", {
            err: err?.message,
            stack: err?.stack,
            userId,
            role: normalizedRole,
            isCrisis,
            messageLength
          });
        }
        if (typeof logEvent === "function") {
          await logEvent("openai_error", {
            userId,
            role: normalizedRole,
            isCrisis,
            message: err?.message || "openai stream error",
            messageLength
          });
        }
        if (persist && convId && userId) {
          await persistDone({
            convId,
            userId,
            status: "ERROR"
          });
        }
      } finally {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        if (!clientGone) {
          try {
            controller.close();
          } catch {}
        }
      }
    }
  });

  return new Response(sse, {
    headers: {
      ...CHAT_NO_STORE_HEADERS,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
