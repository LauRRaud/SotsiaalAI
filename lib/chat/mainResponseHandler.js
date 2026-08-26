import { performance } from "node:perf_hooks";

import { persistInit, persistDone, writeUserTurn, PERSIST_FAILURE } from "@/lib/chat/persistence";
import { claimChatTurn, CHAT_TURN_OUTCOME } from "@/lib/chat/turnRegistry";
import { callOpenAI, resolveProviderReply, streamOpenAI, shouldFlushStreamDelta } from "@/lib/chat/openaiRuntime";
import { buildImmediateChatResponse, finalizeAssistantReply } from "@/lib/chat/responseFinalizer";
import {
  buildFactValidationContractShadow,
  shouldValidateExactFactAnswer,
  validateExactFactAnswer
} from "@/lib/chat/factContract";
import { CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";
import { buildSourceAttribution, getSourceAttributionId } from "@/lib/chat/sourceAttribution";
import { persistSourcePackageSnapshots } from "@/lib/rag/sourcePackageSnapshots";
import {
  RAG_ATTRIBUTION_DECISIONS_ENABLED,
  RAG_DISPLAYED_SOURCES_ENFORCED,
  RAG_TRACE_V1_ENABLED
} from "@/lib/chat/settings";

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
      rendered_evidence_hash: typeof entry.rendered_evidence_hash === "string"
        ? entry.rendered_evidence_hash
        : undefined,
      original_body_hash: typeof entry.original_body_hash === "string"
        ? entry.original_body_hash
        : undefined,
      rendered_body_hash: typeof entry.rendered_body_hash === "string"
        ? entry.rendered_body_hash
        : undefined,
      rendered_evidence_chars: typeof entry.rendered_evidence_chars === "number"
        ? entry.rendered_evidence_chars
        : undefined,
      rendered_evidence_truncated: entry.rendered_evidence_truncated === true,
      rendered_body_count: typeof entry.rendered_body_count === "number"
        ? entry.rendered_body_count
        : undefined,
      original_body_count: typeof entry.original_body_count === "number"
        ? entry.original_body_count
        : undefined,
      rendered_body_spans: Array.isArray(entry.rendered_body_spans)
        ? entry.rendered_body_spans.slice(0, 8).map(span => Object.fromEntries(Object.entries({
            original_body_index: Number.isFinite(Number(span?.original_body_index)) ? Number(span.original_body_index) : undefined,
            original_body_hash: typeof span?.original_body_hash === "string" ? span.original_body_hash : undefined,
            rendered_body_hash: typeof span?.rendered_body_hash === "string" ? span.rendered_body_hash : undefined,
            original_body_chars: Number.isFinite(Number(span?.original_body_chars)) ? Number(span.original_body_chars) : undefined,
            rendered_body_chars: Number.isFinite(Number(span?.rendered_body_chars)) ? Number(span.rendered_body_chars) : undefined,
            start_offset: Number.isFinite(Number(span?.start_offset)) ? Number(span.start_offset) : undefined,
            end_offset: Number.isFinite(Number(span?.end_offset)) ? Number(span.end_offset) : undefined,
            truncated: span?.truncated === true
          }).filter(([, value]) => typeof value !== "undefined")))
        : undefined,
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

function sanitizeTraceStringList(input = [], limit = 20) {
  return Array.isArray(input)
    ? input.map(item => String(item || "").trim()).filter(Boolean).slice(0, limit)
    : [];
}

function sanitizeNumericRelationContractTrace(value = null) {
  if (!value || typeof value !== "object") return null;
  return Object.fromEntries(Object.entries({
    version: typeof value.version === "string" ? value.version : undefined,
    enabled: value.enabled === true,
    source: typeof value.source === "string" ? value.source : undefined,
    relation_type: typeof value.relation_type === "string" ? value.relation_type : undefined,
    participant_count_per_group: typeof value.participant_count_per_group === "string"
      ? value.participant_count_per_group
      : undefined,
    total_participant_count: typeof value.total_participant_count === "string"
      ? value.total_participant_count
      : undefined,
    supporting_sentence_included: value.supporting_sentence_included === true,
    source_id: truncateTraceString(value.source_id, 240),
    document_id: truncateTraceString(value.document_id, 240)
  }).filter(([, item]) => typeof item !== "undefined"));
}

const REQUESTED_METRIC_CONTRACT_TRACE_MAX_SLOTS = 6;

function sanitizeRequestedMetricContractTrace(value = null) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.version !== "requested_metric_contract_v1"
  ) return null;
  const allowedReasons = new Set([
    "requested_slots_incomplete",
    "slot_count_out_of_scope",
    "unsupported_value_type_v1",
    "unsupported_language_or_input_v1",
    "document_identity_not_high",
    "rendered_evidence_mapping_incomplete",
    "rendered_evidence_mapping_truncated",
    "all_requested_slots_mapped_in_one_rendered_source"
  ]);
  const boundedInteger = (candidate, min, max) => typeof candidate === "number" &&
    Number.isInteger(candidate) &&
    candidate >= min &&
    candidate <= max
    ? candidate
    : null;
  const inputSlots = Array.isArray(value.slots) ? value.slots : [];
  const slots = inputSlots
    .map(slot => {
      const evidenceValue = typeof slot?.evidence_value === "string" &&
        /^\d{1,3}(?:\.\d+)?$/u.test(slot.evidence_value) &&
        Number(slot.evidence_value) >= 0 &&
        Number(slot.evidence_value) <= 100
        ? slot.evidence_value
        : null;
      return {
        slot_index: boundedInteger(slot?.slot_index, 1, REQUESTED_METRIC_CONTRACT_TRACE_MAX_SLOTS),
        value_type: slot?.value_type === "proportion" ? "proportion" : null,
        evidence_value: evidenceValue,
        unit: slot?.unit === "percent" ? "percent" : null,
        input_form: slot?.input_form === "original" || slot?.input_form === "canonical_fallback"
          ? slot.input_form
          : null,
        fragment_index: boundedInteger(slot?.fragment_index, 0, 2047),
        mention_index: boundedInteger(slot?.mention_index, 0, 511),
        matched_term_count: boundedInteger(slot?.matched_term_count, 0, 8),
        relation_term_count: boundedInteger(slot?.relation_term_count, 0, 8),
        parenthesis_depth: boundedInteger(slot?.parenthesis_depth, 0, 8),
        local_relation_head_matched: slot?.local_relation_head_matched === true,
        inherited_scope_head_matched: slot?.inherited_scope_head_matched === true,
        ...(typeof slot?.shared_subject_head_matched === "boolean"
          ? { shared_subject_head_matched: slot.shared_subject_head_matched }
          : {})
      };
    })
    .filter(slot => slot.slot_index !== null && slot.value_type && slot.evidence_value && slot.unit)
    .slice(0, REQUESTED_METRIC_CONTRACT_TRACE_MAX_SLOTS);
  const sanitizerDroppedSlot = slots.length !== inputSlots.length;
  const requestedSlotCount = boundedInteger(
    value.requested_slot_count,
    1,
    REQUESTED_METRIC_CONTRACT_TRACE_MAX_SLOTS
  );
  const mappedSlotCount = boundedInteger(
    value.mapped_slot_count,
    0,
    REQUESTED_METRIC_CONTRACT_TRACE_MAX_SLOTS
  );
  const source = value.source === "final_rendered_evidence" ? value.source : null;
  const mappingMethod = new Set([
    "bounded_lexical_relation_alignment_v1",
    "bounded_ordered_local_relation_alignment_v2",
    "bounded_ordered_peer_scope_alignment_v3",
    "bounded_inherited_scope_peer_alignment_v4"
  ]).has(value.mapping_method) ? value.mapping_method : null;
  const sourceId = truncateTraceString(value.source_id, 240);
  const documentId = truncateTraceString(value.document_id, 240);
  const renderedEvidenceHash = typeof value.rendered_evidence_hash === "string" &&
    /^[a-f0-9]{64}$/u.test(value.rendered_evidence_hash)
    ? value.rendered_evidence_hash
    : null;
  const rawDiagnostics = value.mapping_diagnostics;
  const mappingDiagnostics = rawDiagnostics && typeof rawDiagnostics === "object" && !Array.isArray(rawDiagnostics)
    ? {
        evidence_candidate_count: boundedInteger(rawDiagnostics.evidence_candidate_count, 0, 10000),
        evidence_fragment_count: boundedInteger(rawDiagnostics.evidence_fragment_count, 0, 10000),
        evidence_candidates_truncated: rawDiagnostics.evidence_candidates_truncated === true,
        ambiguous: rawDiagnostics.ambiguous === true,
        slots: (Array.isArray(rawDiagnostics.slots) ? rawDiagnostics.slots : [])
          .map(slot => ({
            slot_index: boundedInteger(slot?.slot_index, 1, REQUESTED_METRIC_CONTRACT_TRACE_MAX_SLOTS),
            matching_candidate_count: boundedInteger(slot?.matching_candidate_count, 0, 512),
            top_candidates: (Array.isArray(slot?.top_candidates) ? slot.top_candidates : [])
              .map(candidate => ({
                evidence_value: typeof candidate?.evidence_value === "string" &&
                  /^\d{1,3}(?:\.\d+)?$/u.test(candidate.evidence_value) &&
                  Number(candidate.evidence_value) >= 0 &&
                  Number(candidate.evidence_value) <= 100
                  ? candidate.evidence_value
                  : null,
                score: typeof candidate?.score === "number" && Number.isFinite(candidate.score) &&
                  candidate.score >= 0 && candidate.score <= 100
                  ? candidate.score
                  : null,
                fragment_index: boundedInteger(candidate?.fragment_index, 0, 2047),
                mention_index: boundedInteger(candidate?.mention_index, 0, 511),
                matched_term_count: boundedInteger(candidate?.matched_term_count, 0, 8),
                relation_term_count: boundedInteger(candidate?.relation_term_count, 0, 8),
                parenthesis_depth: boundedInteger(candidate?.parenthesis_depth, 0, 8),
                local_relation_head_matched: candidate?.local_relation_head_matched === true,
                inherited_scope_head_matched: candidate?.inherited_scope_head_matched === true,
                ...(typeof candidate?.shared_subject_head_matched === "boolean"
                  ? { shared_subject_head_matched: candidate.shared_subject_head_matched }
                  : {})
              }))
              .filter(candidate => candidate.evidence_value && candidate.score !== null)
              .slice(0, 3)
          }))
          .filter(slot => slot.slot_index !== null && slot.matching_candidate_count !== null)
          .slice(0, REQUESTED_METRIC_CONTRACT_TRACE_MAX_SLOTS)
      }
    : null;
  const complete = value.complete === true &&
    !sanitizerDroppedSlot &&
    !!source &&
    !!mappingMethod &&
    !!sourceId &&
    !!documentId &&
    !!renderedEvidenceHash &&
    requestedSlotCount !== null &&
    mappedSlotCount === requestedSlotCount &&
    slots.length === mappedSlotCount;
  return {
    version: value.version,
    enabled: value.enabled === true,
    complete,
    reason: allowedReasons.has(value.reason) ? value.reason : null,
    source,
    mapping_method: mappingMethod,
    requested_slot_count: requestedSlotCount,
    mapped_slot_count: mappedSlotCount,
    sanitizer_dropped_slot: sanitizerDroppedSlot,
    used_for_generation: value.used_for_generation === true,
    used_for_validation: value.used_for_validation === true,
    source_id: sourceId,
    document_id: documentId,
    rendered_evidence_hash: renderedEvidenceHash,
    ...(mappingDiagnostics ? { mapping_diagnostics: mappingDiagnostics } : {}),
    slots
  };
}

function sanitizeShadowProvenance(value = null) {
  if (!value || typeof value !== "object") return null;
  return {
    layer: truncateTraceString(value.layer, 80),
    method: truncateTraceString(value.method, 120),
    span_start: typeof value.span_start === "number" && Number.isInteger(value.span_start)
      ? value.span_start
      : null,
    span_end: typeof value.span_end === "number" && Number.isInteger(value.span_end)
      ? value.span_end
      : null
  };
}

function sanitizeShadowMetricSlots(value) {
  return (Array.isArray(value) ? value : [])
    .map(slot => ({
      category: truncateTraceString(slot?.category, 80),
      terms: sanitizeTraceStringList(slot?.terms, 8)
    }))
    .filter(slot => slot.category || slot.terms.length)
    .slice(0, 12);
}

function sanitizeShadowYearRoleMentions(value) {
  if (!Array.isArray(value)) return null;
  const allowedRoles = new Set(["document_source_year", "evidence_year", "ambiguous"]);
  const allowedCueFamilies = new Set([
    "article",
    "report",
    "document",
    "publication_verb",
    "study",
    "data",
    "sample",
    "event",
    "project"
  ]);
  const allowedMethods = new Set([
    "nearest_explicit_year_cue",
    "conflicting_explicit_year_cues",
    "no_explicit_year_cue",
    "bounded_episode_period"
  ]);
  const positiveInteger = candidate => typeof candidate === "number" &&
    Number.isInteger(candidate) &&
    candidate > 0 &&
    candidate <= 8
    ? candidate
    : null;
  const nonNegativeInteger = candidate => typeof candidate === "number" &&
    Number.isInteger(candidate) &&
    candidate >= 0 &&
    candidate <= 20000
    ? candidate
    : null;
  return value
    .map(mention => ({
      mention_index: positiveInteger(mention?.mention_index),
      occurrence_index: positiveInteger(mention?.occurrence_index),
      span_start: nonNegativeInteger(mention?.span_start),
      span_end: nonNegativeInteger(mention?.span_end),
      span_basis: mention?.span_basis === "normalized_question" ? "normalized_question" : null,
      value: /^(?:19|20)\d{2}$|^2100$/u.test(String(mention?.value || ""))
        ? String(mention.value)
        : null,
      role: allowedRoles.has(mention?.role) ? mention.role : null,
      cue_family: allowedCueFamilies.has(mention?.cue_family) ? mention.cue_family : null,
      method: allowedMethods.has(mention?.method) ? mention.method : null,
      input_form: ["original", "canonical_fallback"].includes(mention?.input_form)
        ? mention.input_form
        : null
    }))
    .filter(mention =>
      mention.mention_index &&
      mention.occurrence_index &&
      mention.span_start !== null &&
      mention.span_end !== null &&
      mention.span_end > mention.span_start &&
      mention.span_basis &&
      mention.value &&
      mention.role &&
      mention.method &&
      mention.input_form
    )
    .slice(0, 8);
}

function sanitizeShadowRequestedNumericSlots(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const allowedValueTypes = new Set(["count", "proportion", "amount", "magnitude"]);
  const allowedDerivations = new Set([
    "explicit_clause",
    "coordinated_shared_head",
    "parallel_type_inheritance"
  ]);
  const allowedValueTypeSources = new Set(["explicit_cue", "parallel_inheritance"]);
  const boundedInteger = candidate => typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 0
    ? candidate
    : null;
  const rawSlots = Array.isArray(value?.slots) ? value.slots : [];
  const validSlots = rawSlots
    .map(slot => ({
      index: boundedInteger(slot?.index) > 0 ? slot.index : null,
      value_type: allowedValueTypes.has(slot?.value_type) ? slot.value_type : null,
      relation_term_count: boundedInteger(slot?.relation_term_count),
      derivation: allowedDerivations.has(slot?.derivation) ? slot.derivation : null,
      coordination_group: boundedInteger(slot?.coordination_group) > 0
        ? slot.coordination_group
        : null,
      value_type_source: allowedValueTypeSources.has(slot?.value_type_source)
        ? slot.value_type_source
        : null,
      input_form: ["original", "canonical_fallback"].includes(slot?.input_form)
        ? slot.input_form
        : null
    }))
    .filter(slot =>
      slot.index &&
      slot.value_type &&
      slot.relation_term_count > 0 &&
      slot.derivation &&
      slot.value_type_source &&
      slot.input_form
    );
  const recognizedClauseCount = boundedInteger(value?.recognized_clause_count);
  const unresolvedClauseCount = boundedInteger(value?.unresolved_clause_count);
  const inputEmittedSlotCount = boundedInteger(value?.emitted_slot_count);
  const truncated = value?.truncated === true || rawSlots.length > 12 || validSlots.length > 12;
  const slots = validSlots.slice(0, 12);
  const sanitizerDroppedSlot = validSlots.length !== rawSlots.length;
  const complete = value?.complete === true &&
    recognizedClauseCount !== null &&
    unresolvedClauseCount === 0 &&
    inputEmittedSlotCount === slots.length &&
    slots.length >= recognizedClauseCount &&
    !truncated &&
    !sanitizerDroppedSlot;
  return {
    complete,
    recognized_clause_count: recognizedClauseCount,
    emitted_slot_count: inputEmittedSlotCount === null ? null : slots.length,
    unresolved_clause_count: unresolvedClauseCount,
    truncated,
    slots
  };
}

function sanitizeShadowPlannerField(value, sanitizeValue) {
  if (!value || typeof value !== "object") return null;
  const available = value.available === true;
  return {
    value: available
      ? value.value === null
        ? null
        : sanitizeValue(value.value)
      : null,
    available,
    state: ["present", "absent", "not_applicable"].includes(value.state)
      ? value.state
      : available ? "present" : "absent",
    provenance: sanitizeShadowProvenance(value.provenance),
    confidence: typeof value.confidence === "number" && Number.isFinite(value.confidence)
      ? value.confidence
      : null,
    confidence_source: truncateTraceString(value.confidence_source, 80),
    used_for_production_decision: value.used_for_production_decision === true
  };
}

function sanitizeAnswerValidationContractShadow(base = null, factValidation = null, attribution = null) {
  if (!base || typeof base !== "object" || base.mode !== "shadow") return null;
  const fields = base?.planner?.fields || {};
  const stringListField = name => sanitizeShadowPlannerField(
    fields?.[name],
    fieldValue => sanitizeTraceStringList(fieldValue, 16)
  );
  const factStructured = factValidation?.structured_observations || {};
  const factLegacy = factValidation?.legacy_observations || {};
  const attributionStructured = attribution?.structured_observations || {};
  const attributionLegacy = attribution?.legacy_observations || {};
  const factInteger = value => typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
  return {
    version: truncateTraceString(base.version, 80),
    mode: "shadow",
    production_decision_source: base.production_decision_source === "existing_production_paths"
      ? "existing_production_paths"
      : "unknown",
    planner: {
      mode: truncateTraceString(base?.planner?.mode, 80),
      route_mode: truncateTraceString(base?.planner?.route_mode, 80),
      semantic_candidates_version: base?.planner?.semantic_candidates_version === "question_semantic_candidates_v1"
        ? "question_semantic_candidates_v1"
        : null,
      fields: {
        document_source_years: stringListField("document_source_years"),
        period_role: sanitizeShadowPlannerField(
          fields?.period_role,
          fieldValue => truncateTraceString(fieldValue, 80)
        ),
        evidence_period_years: stringListField("evidence_period_years"),
        evidence_phase_ordinal: sanitizeShadowPlannerField(
          fields?.evidence_phase_ordinal,
          fieldValue => ["first", "second", "third", "next", "later"].includes(fieldValue)
            ? fieldValue
            : null
        ),
        evidence_metric_terms: stringListField("evidence_metric_terms"),
        evidence_metric_slots: sanitizeShadowPlannerField(
          fields?.evidence_metric_slots,
          sanitizeShadowMetricSlots
        ),
        bounded_episode_metric_fact: sanitizeShadowPlannerField(
          fields?.bounded_episode_metric_fact,
          fieldValue => fieldValue === true
        ),
        year_role_mentions: sanitizeShadowPlannerField(
          fields?.year_role_mentions,
          sanitizeShadowYearRoleMentions
        ),
        requested_numeric_slots: sanitizeShadowPlannerField(
          fields?.requested_numeric_slots,
          sanitizeShadowRequestedNumericSlots
        )
      }
    },
    fact_validation: factValidation && typeof factValidation === "object" ? {
      production_path: factValidation.production_path === "legacy" ? "legacy" : "not_run",
      validation_applied: factValidation.validation_applied === true,
      legacy_path_used: factValidation.legacy_path_used === true,
      structured_path_used_for_decision: factValidation.structured_path_used_for_decision === true,
      structured_observations: {
        planner_mode: truncateTraceString(factStructured.planner_mode, 80),
        route_mode: truncateTraceString(factStructured.route_mode, 80),
        field_availability: Object.fromEntries(
          Object.entries(factStructured.field_availability || {})
            .slice(0, 9)
            .map(([name, available]) => [truncateTraceString(name, 80), available === true])
        ),
        document_source_years: Array.isArray(factStructured.document_source_years)
          ? sanitizeTraceStringList(factStructured.document_source_years, 8)
          : null,
        period_role: truncateTraceString(factStructured.period_role, 80),
        evidence_period_years: Array.isArray(factStructured.evidence_period_years)
          ? sanitizeTraceStringList(factStructured.evidence_period_years, 8)
          : null,
        evidence_phase_ordinal: ["first", "second", "third", "next", "later"].includes(
          factStructured.evidence_phase_ordinal
        )
          ? factStructured.evidence_phase_ordinal
          : null,
        evidence_metric_term_count: factInteger(factStructured.evidence_metric_term_count),
        evidence_metric_slot_categories: Array.isArray(factStructured.evidence_metric_slot_categories)
          ? sanitizeTraceStringList(factStructured.evidence_metric_slot_categories, 12)
          : null,
        bounded_episode_metric_fact: typeof factStructured.bounded_episode_metric_fact === "boolean"
          ? factStructured.bounded_episode_metric_fact
          : null,
        typed_document_source_years: Array.isArray(factStructured.typed_document_source_years)
          ? sanitizeTraceStringList(factStructured.typed_document_source_years, 8)
          : null,
        typed_evidence_years: Array.isArray(factStructured.typed_evidence_years)
          ? sanitizeTraceStringList(factStructured.typed_evidence_years, 8)
          : null,
        ambiguous_years: Array.isArray(factStructured.ambiguous_years)
          ? sanitizeTraceStringList(factStructured.ambiguous_years, 8)
          : null,
        requested_numeric_slot_count: factInteger(factStructured.requested_numeric_slot_count),
        requested_numeric_recognized_clause_count: factInteger(
          factStructured.requested_numeric_recognized_clause_count
        ),
        requested_numeric_emitted_slot_count: factInteger(
          factStructured.requested_numeric_emitted_slot_count
        ),
        requested_numeric_slot_types: Array.isArray(factStructured.requested_numeric_slot_types)
          ? sanitizeTraceStringList(factStructured.requested_numeric_slot_types, 12)
          : null,
        requested_numeric_slots_complete: typeof factStructured.requested_numeric_slots_complete === "boolean"
          ? factStructured.requested_numeric_slots_complete
          : null,
        requested_numeric_slots_truncated: typeof factStructured.requested_numeric_slots_truncated === "boolean"
          ? factStructured.requested_numeric_slots_truncated
          : null,
        requested_numeric_unresolved_clause_count: factInteger(
          factStructured.requested_numeric_unresolved_clause_count
        )
      },
      legacy_observations: {
        asks_for_numeric_fact: factLegacy.asks_for_numeric_fact === true,
        asks_for_year: factLegacy.asks_for_year === true,
        asks_for_publication_year: factLegacy.asks_for_publication_year === true,
        asks_for_whole_scope: factLegacy.asks_for_whole_scope === true,
        asks_for_categorical_numeric_breakdown: factLegacy.asks_for_categorical_numeric_breakdown === true,
        contact_answer_intent_requested: factLegacy.contact_answer_intent_requested === true
      },
      runtime_relation: "not_comparable"
    } : null,
    attribution: attribution && typeof attribution === "object" ? {
      production_path: attribution.production_path === "hybrid_existing"
        ? "hybrid_existing"
        : "unknown",
      decision_source: attribution.decision_source === "not_fully_attributed"
        ? "not_fully_attributed"
        : "unknown",
      legacy_path_used: typeof attribution.legacy_path_used === "boolean"
        ? attribution.legacy_path_used
        : null,
      structured_path_used_for_decision: typeof attribution.structured_path_used_for_decision === "boolean"
        ? attribution.structured_path_used_for_decision
        : null,
      shadow_contract_used_for_decision: attribution.shadow_contract_used_for_decision === true,
      structured_path_scope: truncateTraceString(attribution.structured_path_scope, 80),
      structured_observations: {
        planner_mode: truncateTraceString(attributionStructured.planner_mode, 80),
        route_mode: truncateTraceString(attributionStructured.route_mode, 80),
        field_availability: Object.fromEntries(
          Object.entries(attributionStructured.field_availability || {})
            .slice(0, 3)
            .map(([name, available]) => [truncateTraceString(name, 80), available === true])
        ),
        document_source_years: Array.isArray(attributionStructured.document_source_years)
          ? sanitizeTraceStringList(attributionStructured.document_source_years, 8)
          : null,
        period_role: truncateTraceString(attributionStructured.period_role, 80),
        evidence_period_years: Array.isArray(attributionStructured.evidence_period_years)
          ? sanitizeTraceStringList(attributionStructured.evidence_period_years, 8)
          : null,
        document_identity_required: typeof attributionStructured.document_identity_required === "boolean"
          ? attributionStructured.document_identity_required
          : null,
        document_identity_matched: typeof attributionStructured.document_identity_matched === "boolean"
          ? attributionStructured.document_identity_matched
          : null,
        document_identity_confidence: truncateTraceString(
          attributionStructured.document_identity_confidence,
          40
        )
      },
      legacy_observations: {
        query_plan_available: attributionLegacy.query_plan_available === true,
        current_status_observed: attributionLegacy.current_status_observed === true,
        raw_anchor_observed: attributionLegacy.raw_anchor_observed === true,
        raw_anchor_match_observed: typeof attributionLegacy.raw_anchor_match_observed === "boolean"
          ? attributionLegacy.raw_anchor_match_observed
          : null,
        exact_anchor_match: typeof attributionLegacy.exact_anchor_match === "boolean"
          ? attributionLegacy.exact_anchor_match
          : null,
        exact_anchor_match_scope: truncateTraceString(attributionLegacy.exact_anchor_match_scope, 80)
      },
      runtime_relation: "not_comparable"
    } : null
  };
}

function sanitizeFactValidationTrace(value = null) {
  if (!value || typeof value !== "object") return null;
  return Object.fromEntries(Object.entries({
    version: typeof value.version === "string" ? value.version : undefined,
    enabled: value.enabled === true,
    buffered: value.buffered === true,
    passed: value.passed === true,
    reason: typeof value.reason === "string" ? value.reason : undefined,
    claim_values: Array.isArray(value.claim_values)
      ? value.claim_values.map(item => String(item || "")).filter(Boolean).slice(0, 30)
      : [],
    category_relation_checked: value.category_relation_checked === true,
    category_relation_mode: typeof value.category_relation_mode === "string" ? value.category_relation_mode : undefined,
    expected_per_group_value: typeof value.expected_per_group_value === "string" ? value.expected_per_group_value : undefined,
    observed_category_values: sanitizeTraceStringList(value.observed_category_values, 30),
    mismatched_category_labels: sanitizeTraceStringList(value.mismatched_category_labels, 12),
    expected_total_value: typeof value.expected_total_value === "string" ? value.expected_total_value : undefined,
    observed_total_value: typeof value.observed_total_value === "string" ? value.observed_total_value : undefined,
    unsupported_category_labels: Array.isArray(value.unsupported_category_labels)
      ? value.unsupported_category_labels.map(item => String(item || "")).filter(Boolean).slice(0, 12)
      : [],
    unsupported_claim_values: sanitizeTraceStringList(value.unsupported_claim_values, 30),
    contact_inventory_checked: value.contact_inventory_checked === true,
    contact_monitor_checked: value.contact_monitor_checked === true,
    contact_inventory_total_expected: sanitizeTraceStringList(value.contact_inventory_total_expected, 30),
    contact_inventory_total_seen: sanitizeTraceStringList(value.contact_inventory_total_seen, 30),
    contact_role_count_expected: sanitizeTraceStringList(value.contact_role_count_expected, 80),
    contact_role_count_seen: sanitizeTraceStringList(value.contact_role_count_seen, 80),
    contact_inventory_expected_name_count: Number.isFinite(Number(value.contact_inventory_expected_name_count))
      ? Number(value.contact_inventory_expected_name_count)
      : undefined,
    contact_inventory_seen_name_count: Number.isFinite(Number(value.contact_inventory_seen_name_count))
      ? Number(value.contact_inventory_seen_name_count)
      : undefined,
    missing_contact_names: sanitizeTraceStringList(value.missing_contact_names, 80),
    unexpected_contact_items: sanitizeTraceStringList(value.unexpected_contact_items, 80),
    unsupported_contact_role_relations: sanitizeTraceStringList(value.unsupported_contact_role_relations, 80),
    contact_source_count: Number.isFinite(Number(value.contact_source_count))
      ? Number(value.contact_source_count)
      : undefined,
    contact_phone_claim_count: Number.isFinite(Number(value.contact_phone_claim_count))
      ? Number(value.contact_phone_claim_count)
      : undefined,
    contact_phone_relation_checked: value.contact_phone_relation_checked === true,
    unsupported_contact_phone_values: sanitizeTraceStringList(value.unsupported_contact_phone_values, 30),
    unsupported_contact_phone_relations: sanitizeTraceStringList(value.unsupported_contact_phone_relations, 30),
    contact_email_claim_count: Number.isFinite(Number(value.contact_email_claim_count))
      ? Number(value.contact_email_claim_count)
      : undefined,
    contact_email_relation_checked: value.contact_email_relation_checked === true,
    unsupported_contact_email_values: sanitizeTraceStringList(value.unsupported_contact_email_values, 30),
    unsupported_contact_email_relations: sanitizeTraceStringList(value.unsupported_contact_email_relations, 30),
    unsupported_contact_date_values: sanitizeTraceStringList(value.unsupported_contact_date_values, 30),
    expected_contact_check_cadence: typeof value.expected_contact_check_cadence === "string"
      ? value.expected_contact_check_cadence
      : undefined,
    contact_check_cadence_expected: typeof value.contact_check_cadence_expected === "string"
      ? value.contact_check_cadence_expected
      : undefined,
    contact_check_cadence_claims: sanitizeTraceStringList(value.contact_check_cadence_claims, 8),
    unsupported_contact_check_cadences: sanitizeTraceStringList(value.unsupported_contact_check_cadences, 8),
    contact_check_cadence_validated: value.contact_check_cadence_validated === true,
    supporting_source_ids: sanitizeTraceStringList(value.supporting_source_ids, 100),
    source_count: Number.isFinite(Number(value.source_count)) ? Number(value.source_count) : undefined,
    supporting_source_id: typeof value.supporting_source_id === "string" ? value.supporting_source_id : undefined,
    supporting_source_count: Number.isFinite(Number(value.supporting_source_count))
      ? Number(value.supporting_source_count)
      : undefined,
    document_identity_required: value.document_identity_required === true,
    document_identity_matched: value.document_identity_matched === true,
    document_identity_confidence: typeof value.document_identity_confidence === "string"
      ? value.document_identity_confidence
      : undefined,
    selected_document_id: typeof value.selected_document_id === "string"
      ? value.selected_document_id
      : undefined,
    author_corpus_required: value.author_corpus_required === true,
    author_corpus_complete: value.author_corpus_complete === true,
    author_corpus_document_count: Number.isInteger(Number(value.author_corpus_document_count))
      ? Number(value.author_corpus_document_count)
      : undefined,
    validation_duration_ms: Number.isFinite(Number(value.validation_duration_ms))
      ? Number(value.validation_duration_ms)
      : undefined,
    year_mode: typeof value.year_mode === "string" ? value.year_mode : undefined,
    whole_scope_checked: value.whole_scope_checked === true,
    buffered_response_ms: Number.isFinite(Number(value.buffered_response_ms))
      ? Number(value.buffered_response_ms)
      : undefined
  }).filter(([, item]) => typeof item !== "undefined"));
}

function sanitizeDocumentIdentityTrace(value = null) {
  if (!value || typeof value !== "object") return null;
  return Object.fromEntries(Object.entries({
    enabled: value.enabled === true,
    required: value.required === true,
    matched: value.matched === true,
    confidence: typeof value.confidence === "string" ? value.confidence : undefined,
    requested_author: truncateTraceString(value.requestedAuthor, 120),
    subject_terms: sanitizeTraceStringList(value.subjectTerms, 12),
    selected_document_id: truncateTraceString(value.selectedDocumentId, 240),
    selected_title: truncateTraceString(value.selectedTitle, 240),
    reasons: sanitizeTraceStringList(value.reasons, 20),
    duration_ms: Number.isFinite(Number(value.durationMs)) ? Number(value.durationMs) : undefined,
    candidates: Array.isArray(value.candidates)
      ? value.candidates.slice(0, 5).map((candidate = {}) => ({
          document_id: truncateTraceString(candidate.documentId, 240),
          title: truncateTraceString(candidate.title, 240),
          score: Number.isFinite(Number(candidate.score)) ? Number(candidate.score) : undefined,
          identity_matched: candidate.identityMatched === true,
          author_matched: candidate.authorMatched === true,
          source_compatible: candidate.sourceCompatible === true,
          research_or_journal: candidate.researchOrJournal === true,
          subject_terms: sanitizeTraceStringList(candidate.subjectMatches, 12),
          body_subject_terms: sanitizeTraceStringList(candidate.bodySubjectMatches, 12)
        }))
      : []
  }).filter(([, item]) => typeof item !== "undefined"));
}

function sanitizePerformanceTimings(value = null) {
  if (!value || typeof value !== "object") return null;
  const allowed = [
    "planner_ms",
    "query_planning_ms",
    "query_build_ms",
    "retrieval_wall_ms",
    "multi_query_retrieval_ms",
    "retrieval_parallel_sum_ms",
    "retrieval_query_count",
    "embedding_sum_ms",
    "embedding_ms",
    "dense_sum_ms",
    "dense_ms",
    "registry_ms",
    "lexical_sum_ms",
    "lexical_ms",
    "document_sibling_sum_ms",
    "service_fact_segment_sum_ms",
    "shared_read_cache_hits",
    "shared_read_cache_waits",
    "shared_read_cache_misses",
    "shared_read_cache_bypasses",
    "shared_embedding_batch_hits",
    "shared_embedding_batch_waits",
    "shared_embedding_batch_misses",
    "shared_embedding_batch_bypasses",
    "lexical_scanned_sum",
    "lexical_corpus_scan_query_count",
    "lexical_exhaustive_query_count",
    "document_identity_ms",
    "fact_segment_search_ms",
    "context_render_ms",
    "first_model_call_ms",
    "fact_validation_ms",
    "repair_call_ms",
    "retrieval_context_total_ms",
    "model_ms",
    "persistence_ms",
    "turn_total_ms",
    "request_total_ms",
    "total_ms"
  ];
  const sanitized = {};
  for (const key of allowed) {
    if (value[key] !== null && typeof value[key] !== "undefined" && Number.isFinite(Number(value[key]))) {
      sanitized[key] = Number(value[key]);
    }
  }
  for (const [key, item] of Object.entries(value)) {
    if (!/^retrieval_query_([1-9]|1[0-2])_ms$/.test(key)) continue;
    if (item !== null && typeof item !== "undefined" && Number.isFinite(Number(item))) {
      sanitized[key] = Number(item);
    }
  }
  return Object.keys(sanitized).length ? sanitized : null;
}

async function emitTurnPerformanceEvent(logEvent, {
  userId,
  role,
  conversationId,
  turnId,
  retrievalMeta,
  timings = {}
}) {
  if (typeof logEvent !== "function") return;
  const performanceTimings = sanitizePerformanceTimings({
    ...(retrievalMeta?.performanceTimings || {}),
    ...timings,
    ...(Number.isFinite(Number(timings?.turn_total_ms))
      ? { request_total_ms: Number(timings.turn_total_ms) }
      : {})
  });
  if (!performanceTimings) return;
  await logEvent("chat_turn_performance", {
    userId,
    role,
    conversationId,
    turnId,
    ...performanceTimings
  });
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
  const numericRelationContractTrace = sanitizeNumericRelationContractTrace(retrievalMeta?.numericRelationContract);
  const requestedMetricContractTrace = sanitizeRequestedMetricContractTrace(retrievalMeta?.requestedMetricContract);
  const factValidationTrace = sanitizeFactValidationTrace(retrievalMeta?.factValidation);
  const answerValidationContractShadow = sanitizeAnswerValidationContractShadow(
    queryPlan?.answer_validation_contract_shadow,
    retrievalMeta?.factValidationContractShadow,
    attribution?.sourceAttributionContractShadow
  );
  const documentIdentityTrace = sanitizeDocumentIdentityTrace(retrievalMeta?.documentIdentityEvidence);
  const performanceTimings = sanitizePerformanceTimings(retrievalMeta?.performanceTimings);
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
    rendered_context_hash: typeof retrievalMeta?.renderedContextHash === "string"
      ? retrievalMeta.renderedContextHash
      : null,
    rendered_context_chars: Number.isFinite(Number(retrievalMeta?.renderedContextChars))
      ? Number(retrievalMeta.renderedContextChars)
      : 0,
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
    package_selection_status: retrievalMeta?.packageAwareAnswering?.packageSelectionStatus || null,
    insufficient_precise_support: retrievalMeta?.packageAwareAnswering?.insufficientPreciseSupport === true,
    required_evidence_sections: Array.isArray(retrievalMeta?.packageAwareAnswering?.requiredEvidenceSections)
      ? retrievalMeta.packageAwareAnswering.requiredEvidenceSections
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
    ...(numericRelationContractTrace ? { numeric_relation_contract: numericRelationContractTrace } : {}),
    ...(requestedMetricContractTrace ? { requested_metric_contract: requestedMetricContractTrace } : {}),
    ...(answerValidationContractShadow
      ? { answer_validation_contract_shadow: answerValidationContractShadow }
      : {}),
    ...(factValidationTrace ? { fact_validation: factValidationTrace } : {}),
    ...(documentIdentityTrace ? { document_identity: documentIdentityTrace } : {}),
    ...(performanceTimings ? { performance_timings: performanceTimings } : {}),
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
    package_selection_status: ragTrace.package_selection_status,
    insufficient_precise_support: ragTrace.insufficient_precise_support,
    required_evidence_sections: ragTrace.required_evidence_sections,
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
    numeric_relation_contract: ragTrace.numeric_relation_contract,
    requested_metric_contract: ragTrace.requested_metric_contract,
    answer_validation_contract_shadow: ragTrace.answer_validation_contract_shadow,
    fact_validation: ragTrace.fact_validation,
    query_plan: ragTrace.query_plan,
    hybrid_retrieval: ragTrace.hybrid_retrieval,
    retrieval_trace_level: ragTrace.retrieval_trace_level
  });
}

function resolveDisplayedSources(originalSources, attribution, factValidation = null) {
  if (factValidation?.passed === false) return [];
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

function withFactValidation(retrievalMeta, factValidation, performanceTimings = null) {
  if (!factValidation && !performanceTimings) return retrievalMeta;
  return {
    ...(retrievalMeta && typeof retrievalMeta === "object" ? retrievalMeta : {}),
    ...(factValidation ? { factValidation } : {}),
    ...(performanceTimings
      ? {
          performanceTimings: {
            ...(retrievalMeta?.performanceTimings || {}),
            ...performanceTimings
          }
        }
      : {})
  };
}

function withFactValidationContractShadow(retrievalMeta, shadow, legacyPathUsed = false) {
  if (!shadow || typeof shadow !== "object") return retrievalMeta;
  return {
    ...(retrievalMeta && typeof retrievalMeta === "object" ? retrievalMeta : {}),
    factValidationContractShadow: {
      ...shadow,
      production_path: legacyPathUsed ? "legacy" : "not_run",
      validation_applied: legacyPathUsed === true,
      legacy_path_used: legacyPathUsed === true,
      structured_path_used_for_decision: false
    }
  };
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

async function settleChatUsage(callback, logError, event, reason = null) {
  if (typeof callback !== "function") return;
  try {
    await callback(reason);
  } catch (error) {
    if (typeof logError === "function") {
      logError(event, { error: error?.message || String(error), reason });
    }
  }
}

/**
 * SOL-CHAT-01 ja SOL-CHAT-02 — üks juur, üks parandus.
 *
 * MIS OLI VALESTI. Tasuline ühik commit'iti kohe pärast providerit ja ALLES SEEJÄREL püsistati
 * vestlus; `settleChatUsage()` neelas nii commit'i kui release'i vea. Nii sai üks pööre lõppeda
 * kolmel viisil, mida keegi ei parandanud: limiit kulus ja vastust ei olnud kuskil (püsistus
 * kukkus pärast commit'i) · vastus oli olemas ja limiit kulumata (commit kukkus, logi neelas) ·
 * katkestatud pööre jäi reservatsiooni kinni kuni TTL-ini (release kukkus, logi neelas).
 *
 * PARANDUS on järjekord + atomaarsus, mitte uus valve. Arveldus antakse nüüd `persistDone`-i
 * TEHINGUSSE (`settleUsage`): kas terminalmarker ja arveldus mõlemad või mitte kumbki. Sellega
 * kaob mõlemast leiust vaikne haru — „arvestatud, aga kadunud" ja „püsiv, aga arveldamata" ei ole
 * enam olekud, mida kood suudab toota. Vaata `lib/usage/paidResult.js` päist: kui püsiv tulemus
 * ja tasu langevad ühte sammu, jääb kehtima ainult esimene piir (viga enne tasu vabastab).
 *
 * `persist === false` (nt ruumirada ilma vestluseta) on ainus rada, kus siduda ei ole millegagi;
 * seal jääb arveldus eraldi sammuks ja see on siin nimeliselt välja öeldud, mitte vaikimisi.
 */
/**
 * SOL-CHAT-03: lõpetatud kavatsuse KORDUS. Tulemus on juba olemas ja kuulub kasutajale — teda
 * ei tehta uuesti ega arveldata uuesti. Vastus ehitatakse salvestatud assistendisõnumist, seega
 * kordus näeb täpselt sama asja, mis vestluses on.
 */
export function buildReplayResponse({ wantStream, convId, replay, isCrisis }) {
  const metadata = replay?.metadata && typeof replay.metadata === "object" ? replay.metadata : {};
  return buildImmediateChatResponse({
    wantStream,
    reply: String(replay?.content || ""),
    sources: Array.isArray(metadata.sources) ? metadata.sources : [],
    displayedSources: Array.isArray(metadata.displayed_sources) ? metadata.displayed_sources : null,
    ragTrace: metadata.rag_trace || null,
    attributionDecisions: Array.isArray(metadata.attribution_decisions) ? metadata.attribution_decisions : null,
    attachments: Array.isArray(metadata.attachments) ? metadata.attachments : [],
    cards: Array.isArray(metadata.cards) ? metadata.cards : [],
    isCrisis: typeof metadata.isCrisis === "boolean" ? metadata.isCrisis : isCrisis,
    convId
  });
}

async function settleAfterFinalize({ persisted, onUsageCommit, onUsageRelease, logError }) {
  if (!persisted?.required) {
    await settleChatUsage(onUsageCommit, logError, "usage.chat_commit.error");
    return true;
  }
  if (persisted.durable) return true;
  await settleChatUsage(
    onUsageRelease,
    logError,
    "usage.chat_release.error",
    "chat_reply_not_durable"
  );
  return false;
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
  logEvent,
  requestStartedAtMs = null,
  onUsageCommit = null,
  onUsageRelease = null,
  chatUsageReused = false,
  // SOL-CHAT-03: kliendi stabiilne kavatsuse võti. `null` = vana klient, vt allpool nimelist piiri.
  clientTurnKey = null,
  sessionTurnLimit = null
}, deps = {}) {
  const callProvider = deps.callOpenAI || callOpenAI;
  const streamProvider = deps.streamOpenAI || streamOpenAI;
  const finalizeReply = deps.finalizeAssistantReply || finalizeAssistantReply;
  const initializePersistence = deps.persistInit || persistInit;
  // SOL-CHAT-05: terminalmarker peab olema süstitav — piir, mida ei saa testida, ei ole piir.
  const completeTurnPersistence = deps.persistDone || persistDone;
  const turnStartedAtMs = Number.isFinite(Number(requestStartedAtMs))
    ? Number(requestStartedAtMs)
    : performance.now();
  const claimTurn = deps.claimChatTurn
    || (input => claimChatTurn(input, { writeUserTurn }));
  let turnId = null;
  if (persist && convId && userId) {
    /* SOL-CHAT-01: kasutaja küsimuse kirjutamine on pöörde EELDUS, mitte kõrvaltoiming. Kui ta
       ei õnnestu, ei tohi providerit üldse kutsuda — muidu tekib tasuline vastus küsimuseta.
       Siin ei ole veel midagi tarbitud, seega reservatsioon vabastatakse tervikuna.

       SOL-CHAT-03/-04: stabiilse kliendivõtmega käib see kirjutus pöörde nõude SEEST — üks
       kavatsus = üks rida, sessioonipiir loetakse ja kirjutatakse sama luku all. Ilma võtmeta
       (vana klient) jääb vana rada alles, aga siis ei ole ka kaitset — see on nimeline piir. */
    let initFailure = null;
    const onFailure = reason => {
      initFailure = initFailure || reason;
    };

    if (clientTurnKey) {
      const claim = await claimTurn({
        userId,
        conversationId: convId,
        clientTurnKey,
        role: normalizedRole,
        userMessage: effectiveMessage,
        sessionTurnLimit
      });
      if (claim.outcome === CHAT_TURN_OUTCOME.REPLAYED) {
        /* Sama kavatsus on juba lõpetatud: tulemus kuulub kasutajale ja teda ei tehta uuesti.
           Kasutust ei puudutata — reservatsioon on sama võtme all juba COMMITTED. */
        if (typeof logInfo === "function") {
          logInfo("chat.turn.replayed", { convId, attempt: claim.turn?.attempt });
        }
        return buildReplayResponse({ wantStream, convId, replay: claim.replay, isCrisis });
      }
      if (claim.outcome === CHAT_TURN_OUTCOME.IN_FLIGHT || claim.outcome === CHAT_TURN_OUTCOME.CONVERSATION_BUSY) {
        /* Sama kliendivõtmega IN_FLIGHT kordus sai kasutusteenuselt algse päringu reservatsiooni.
           Kordus ei oma seda ega tohi aktiivse provideritöö alt kvooti vabastada. Teise
           kavatsuse CONVERSATION_BUSY reservatsioon on aga uus ja tuleb endiselt vabastada. */
        if (claim.outcome !== CHAT_TURN_OUTCOME.IN_FLIGHT || !chatUsageReused) {
          await settleChatUsage(onUsageRelease, logError, "usage.chat_release.error", "chat_turn_conflict");
        }
        return makeError("chat.error.turn_in_flight", 409);
      }
      if (claim.outcome === CHAT_TURN_OUTCOME.SESSION_LIMIT) {
        await settleChatUsage(onUsageRelease, logError, "usage.chat_release.error", "chat_session_limit");
        return makeError("api.common.rate_limited", 429, {
          scope: "chat_session_turns",
          limit: claim.limit,
          used: claim.used
        });
      }
      if (claim.outcome === CHAT_TURN_OUTCOME.CONVERSATION_UNAVAILABLE) {
        /* SOL-CHAT-11: võõra omaniku või arhiveeritud vestlus oli varem VAIKNE EDU — `persistInit`
           lihtsalt väljus ja provideritöö jooksis edasi. Nüüd on ta selge klient-viga ENNE
           providerikutset: 409, mitte 503, sest server töötab — konflikt on kliendi olekus. */
        await settleChatUsage(onUsageRelease, logError, "usage.chat_release.error", "chat_conversation_unavailable");
        if (typeof logError === "function") {
          logError("chat.turn.conversation_unavailable", { convId, reason: claim.reason });
        }
        return makeError("chat.error.conversation_unavailable", 409);
      }
      if (claim.outcome !== CHAT_TURN_OUTCOME.CLAIMED) {
        onFailure(PERSIST_FAILURE.WRITE_FAILED);
      } else {
        turnId = claim.turn?.id || null;
      }
    } else {
      const initialized = await initializePersistence({
        convId,
        userId,
        role: normalizedRole,
        sources,
        isCrisis,
        userMessage: effectiveMessage
      }, { onFailure });
      if (initialized === false) onFailure(PERSIST_FAILURE.WRITE_FAILED);
    }

    if (initFailure) {
      await settleChatUsage(
        onUsageRelease,
        logError,
        "usage.chat_release.error",
        "chat_persist_init_failed"
      );
      if (typeof logError === "function") {
        logError("chat.persist.init_failed", { convId, reason: initFailure });
      }
      return makeError("chat.error.not_saved", 503);
    }
  }

  const factValidationContractShadow = buildFactValidationContractShadow({
    message: effectiveMessage,
    retrievalMeta
  });
  const tracedRetrievalMeta = withFactValidationContractShadow(
    retrievalMeta,
    factValidationContractShadow,
    false
  );

  const deterministicContactReply = typeof retrievalMeta?.deterministicContactReply === "string"
    ? retrievalMeta.deterministicContactReply.trim()
    : "";
  if (
    !isCrisis &&
    (
      retrievalMeta?.structuredContactRegistryTurn === true ||
      retrievalMeta?.structuredContactMissingMunicipalityTurn === true ||
      retrievalMeta?.structuredContactMonitorTurn === true
    ) &&
    deterministicContactReply
  ) {
    const validationStartedAt = performance.now();
    const factValidation = validateExactFactAnswer({
      message: effectiveMessage,
      reply: deterministicContactReply,
      sources,
      retrievalMeta,
      replyLang
    });
    const factValidationDurationMs = Math.max(0, Math.round(performance.now() - validationStartedAt));
    if (factValidation?.trace) {
      factValidation.trace.validation_duration_ms = factValidationDurationMs;
      factValidation.trace.buffered_response_ms = 0;
      factValidation.trace.deterministic_response = true;
    }
    const reply = factValidation?.reply || deterministicContactReply;
    const deterministicRetrievalMeta = withFactValidationContractShadow(
      retrievalMeta,
      factValidationContractShadow,
      true
    );
    const responseRetrievalMeta = withFactValidation(deterministicRetrievalMeta, factValidation?.trace, {
      first_model_call_ms: 0,
      model_ms: 0,
      fact_validation_ms: factValidationDurationMs
    });
    const attribution = buildSourceAttribution(reply, sources, {
      query: retrievalMeta?.attributionQuery || effectiveMessage,
      riskPolicy: retrievalMeta?.ragRiskPolicy,
      legalLookupPlan: retrievalMeta?.legalLookupPlan || retrievalMeta?.queryPlan?.legalLookupPlan,
      queryPlan: retrievalMeta?.queryPlan,
      personTopicTerms: retrievalMeta?.personTopicTerms,
      personCoauthorNames: retrievalMeta?.personCoauthorNames,
      personCoauthorRequested: retrievalMeta?.personCoauthorRequested,
      packageDisplayedSourceIds: retrievalMeta?.packageAwareAnswering?.packageDisplayedSourceIds,
      packageAwareAnsweringUsed: retrievalMeta?.packageAwareAnswering?.used === true,
      municipalityContext: retrievalMeta?.municipalityContext,
      documentIdentityEvidence: retrievalMeta?.documentIdentityEvidence,
      factValidation: factValidation?.trace,
      contactInventoryValidatedSourceIds:
        factValidation?.trace?.passed === true && (
          factValidation?.trace?.contact_inventory_checked === true ||
          factValidation?.trace?.contact_monitor_checked === true
        )
          ? factValidation.trace.supporting_source_ids
          : []
    });
    const replySources = resolveDisplayedSources(sources, attribution, factValidation?.trace);
    const ragTrace = resolveRagTrace(sources, attribution, responseRetrievalMeta);
    const ragContract = buildRagContractMetadata();
    const attributionDecisions = resolveAttributionDecisions(attribution);
    await emitRagTraceEvent(logEvent, {
      userId,
      role: normalizedRole,
      isCrisis,
      ragTrace
    });
    await persistSourcePackagesFromTrace(ragTrace, logError);
    const persistenceStartedAt = performance.now();
    const { attachments, persisted } = await finalizeReply({
      settleUsage: typeof onUsageCommit === "function" ? tx => onUsageCommit(tx) : null,
      persist,
      persistInitialized: true,
      turnId,
      convId,
      userId,
      role: normalizedRole,
      userMessage: effectiveMessage,
      reply,
      sources: replySources,
      displayedSources: replySources,
      ragTrace,
      ragContract,
      attributionDecisions,
      attachments: [],
      cards: [],
      metadataExtra: buildAttributionMetadata(metadataExtra, sources, attribution, responseRetrievalMeta),
      isCrisis,
      wantsDocumentDownload,
      replyLang,
      messageForDownload: effectiveMessage,
      roomId,
      saveRoomMessage
    });
    const persistenceDurationMs = Math.max(0, Math.round(performance.now() - persistenceStartedAt));
    const settled = await settleAfterFinalize({
      persisted,
      onUsageCommit,
      onUsageRelease,
      logError
    });
    if (!settled) {
      if (typeof logError === "function") {
        logError("chat.persist.not_durable", { branch: "deterministic_contact", convId });
      }
      return makeError("chat.error.not_saved", 503);
    }
    await emitTurnPerformanceEvent(logEvent, {
      userId,
      role: normalizedRole,
      conversationId: convId,
      turnId,
      retrievalMeta: responseRetrievalMeta,
      timings: {
        model_ms: 0,
        persistence_ms: persistenceDurationMs,
        turn_total_ms: Math.max(0, Math.round(performance.now() - turnStartedAtMs))
      }
    });
    return buildImmediateChatResponse({
      wantStream,
      reply,
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
        // B0: eristab "otsing kukkus" olukorda "tulemusi ei olnud" omast.
        ragSearchFailed: !!noContextMeta?.ragSearchFailed,
        hadRagResults: !!noContextMeta?.ragReturned,
        hadDocContext: !!noContextMeta?.hadDocContext,
        sourceLookupRequest: !!noContextMeta?.sourceLookupRequest,
        previousSourceUseRequest: !!noContextMeta?.previousSourceUseRequest
      });
    }

    const attribution = buildSourceAttribution(noContextReply, sources, {
      query: retrievalMeta?.attributionQuery || effectiveMessage,
      riskPolicy: retrievalMeta?.ragRiskPolicy,
      legalLookupPlan: retrievalMeta?.legalLookupPlan || retrievalMeta?.queryPlan?.legalLookupPlan,
      queryPlan: retrievalMeta?.queryPlan,
      personTopicTerms: retrievalMeta?.personTopicTerms,
      personCoauthorNames: retrievalMeta?.personCoauthorNames,
      personCoauthorRequested: retrievalMeta?.personCoauthorRequested,
      packageDisplayedSourceIds: retrievalMeta?.packageAwareAnswering?.packageDisplayedSourceIds,
      packageAwareAnsweringUsed: retrievalMeta?.packageAwareAnswering?.used === true,
      municipalityContext: retrievalMeta?.municipalityContext,
      documentIdentityEvidence: retrievalMeta?.documentIdentityEvidence,
      factValidation: null
    });
    const replySources = resolveDisplayedSources(sources, attribution);
    const ragTrace = resolveRagTrace(sources, attribution, tracedRetrievalMeta);
    const ragContract = buildRagContractMetadata();
    const attributionDecisions = resolveAttributionDecisions(attribution);
    await emitRagTraceEvent(logEvent, {
      userId,
      role: normalizedRole,
      isCrisis,
      ragTrace
    });
    await persistSourcePackagesFromTrace(ragTrace, logError);
    const { attachments, persisted } = await finalizeReply({
      settleUsage: typeof onUsageCommit === "function" ? tx => onUsageCommit(tx) : null,
      persist,
      // Kasutaja küsimus on juba kirjutatud (pöörde nõude sees või vanal rajal persistInit'iga).
      persistInitialized: true,
      turnId,
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
      metadataExtra: buildAttributionMetadata(metadataExtra, sources, attribution, tracedRetrievalMeta),
      isCrisis,
      wantsDocumentDownload,
      replyLang,
      messageForDownload: effectiveMessage,
      roomId,
      saveRoomMessage
    });
    const noContextSettled = await settleAfterFinalize({
      persisted,
      onUsageCommit,
      onUsageRelease,
      logError
    });
    if (!noContextSettled) {
      if (typeof logError === "function") {
        logError("chat.persist.not_durable", { branch: "no_context", convId });
      }
      return makeError("chat.error.not_saved", 503);
    }
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

  const exactFactValidationEnabled = shouldValidateExactFactAnswer({
    message: effectiveMessage,
    sources,
    retrievalMeta
  });
  const exactFactRetrievalMeta = withFactValidationContractShadow(
    retrievalMeta,
    factValidationContractShadow,
    exactFactValidationEnabled
  );

  if (!wantStream) {
    // SOL-CHAT-01: „kas ühik on arvestatud" ei ole enam tuletatav sellest, kas provider jõudis
    // lõpuni — arveldus toimub püsistuse tehingus. Ainult see lipp otsustab, kas catch vabastab.
    let usageSettled = false;
    try {
      const modelCallStartedAt = performance.now();
      const aiResult = await callProvider({
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
        role: normalizedRole,
        signal: req.signal
      });
      const firstModelCallDurationMs = Math.max(0, Math.round(performance.now() - modelCallStartedAt));
      const providerReply = resolveProviderReply(aiResult?.reply, { replyLang, isCrisis });
      const factValidationStartedAt = exactFactValidationEnabled ? performance.now() : null;
      const factValidation = exactFactValidationEnabled
        ? validateExactFactAnswer({
            message: effectiveMessage,
            reply: providerReply,
            sources,
            retrievalMeta,
            replyLang
          })
        : null;
      const factValidationDurationMs = factValidationStartedAt === null
        ? null
        : Math.max(0, Math.round(performance.now() - factValidationStartedAt));
      if (factValidation?.trace) factValidation.trace.validation_duration_ms = factValidationDurationMs;
      const reply = factValidation?.reply || providerReply;
      const responseRetrievalMeta = withFactValidation(exactFactRetrievalMeta, factValidation?.trace, {
        first_model_call_ms: firstModelCallDurationMs,
        model_ms: firstModelCallDurationMs,
        ...(factValidationDurationMs === null ? {} : { fact_validation_ms: factValidationDurationMs })
      });
      const attribution = buildSourceAttribution(reply, sources, {
        query: retrievalMeta?.attributionQuery || effectiveMessage,
        riskPolicy: retrievalMeta?.ragRiskPolicy,
        legalLookupPlan: retrievalMeta?.legalLookupPlan || retrievalMeta?.queryPlan?.legalLookupPlan,
        queryPlan: retrievalMeta?.queryPlan,
        personTopicTerms: retrievalMeta?.personTopicTerms,
        personCoauthorNames: retrievalMeta?.personCoauthorNames,
        personCoauthorRequested: retrievalMeta?.personCoauthorRequested,
        packageDisplayedSourceIds: retrievalMeta?.packageAwareAnswering?.packageDisplayedSourceIds,
        packageAwareAnsweringUsed: retrievalMeta?.packageAwareAnswering?.used === true,
        municipalityContext: retrievalMeta?.municipalityContext,
        documentIdentityEvidence: retrievalMeta?.documentIdentityEvidence,
        factValidation: factValidation?.trace,
        contactInventoryValidatedSourceIds:
          factValidation?.trace?.passed === true && (
            factValidation?.trace?.contact_inventory_checked === true ||
            factValidation?.trace?.contact_monitor_checked === true
          )
            ? factValidation.trace.supporting_source_ids
            : []
      });
      const replySources = resolveDisplayedSources(sources, attribution, factValidation?.trace);
      const ragTrace = resolveRagTrace(sources, attribution, responseRetrievalMeta);
      const ragContract = buildRagContractMetadata();
      const attributionDecisions = resolveAttributionDecisions(attribution);
      await emitRagTraceEvent(logEvent, {
        userId,
        role: normalizedRole,
        isCrisis,
        ragTrace
      });
      await persistSourcePackagesFromTrace(ragTrace, logError);
      const persistenceStartedAt = performance.now();
      const { attachments, persisted } = await finalizeReply({
        settleUsage: typeof onUsageCommit === "function" ? tx => onUsageCommit(tx) : null,
        persist,
        persistInitialized: true,
        turnId,
        convId,
        userId,
        role: normalizedRole,
        userMessage: effectiveMessage,
        reply,
        sources: replySources,
        displayedSources: replySources,
        ragTrace,
        ragContract,
        attributionDecisions,
        attachments: [],
        cards: [],
        metadataExtra: buildAttributionMetadata(metadataExtra, sources, attribution, responseRetrievalMeta),
        isCrisis,
        wantsDocumentDownload,
        replyLang,
        messageForDownload: effectiveMessage,
        roomId,
        saveRoomMessage
      });
      const persistenceDurationMs = Math.max(0, Math.round(performance.now() - persistenceStartedAt));
      const settled = await settleAfterFinalize({
        persisted,
        onUsageCommit,
        onUsageRelease,
        logError
      });
      usageSettled = true;
      if (!settled) {
        if (typeof logError === "function") {
          logError("chat.persist.not_durable", { branch: "non_stream", convId });
        }
        return makeError("chat.error.not_saved", 503);
      }
      await emitTurnPerformanceEvent(logEvent, {
        userId,
        role: normalizedRole,
        conversationId: convId,
        turnId,
        retrievalMeta: responseRetrievalMeta,
        timings: {
          model_ms: firstModelCallDurationMs,
          persistence_ms: persistenceDurationMs,
          turn_total_ms: Math.max(0, Math.round(performance.now() - turnStartedAtMs))
        }
      });
      return buildImmediateChatResponse({
        wantStream: false,
        reply,
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
      const wasAborted =
        req.signal?.aborted === true ||
        err?.name === "AbortError" ||
        err?.name === "APIUserAbortError";
      /* SOL-CHAT-02: terminalmarker ja reservatsiooni vabastus on üks tehing. Kui marker ei
         jõua kettale, ei vabastata ka ühikut — pööre jääb tervikuna korratavaks, mitte pooleks. */
      let releasedWithMarker = false;
      if (!usageSettled && persist && convId && userId) {
        const marker = await completeTurnPersistence({
          convId,
          userId,
          status: wasAborted ? "ABORTED" : "ERROR",
          turnId,
          isCrisis,
          replyLang,
          settleUsage: typeof onUsageRelease === "function"
            ? tx => onUsageRelease(wasAborted ? "chat_call_aborted" : "chat_provider_failed", tx)
            : null
        });
        releasedWithMarker = !!marker;
      }
      if (!usageSettled && !releasedWithMarker) {
        await settleChatUsage(
          onUsageRelease,
          logError,
          "usage.chat_release.error",
          wasAborted ? "chat_call_aborted" : "chat_provider_failed"
        );
      }
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
          messageLength,
          aborted: wasAborted
        });
      }
      if (typeof logEvent === "function") {
        await logEvent(wasAborted ? "chat_call_aborted" : "openai_error", {
          userId,
          role: normalizedRole,
          isCrisis,
          message: rawErrMessage,
          messageLength
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
  /* SOL-CHAT-05: `accumulated` on PROVIDERI puhver, mitte see, mida kasutaja nägi. Katkestuse
     puhul tohib püsiv jälg kanda ainult päriselt VÄLJA SAADETUD teksti — muidu vajutab kasutaja
     Stop, näeb poolt lauset, ja vestluse taasavamisel ilmub pikem sisu, mida talle ei näidatud. */
  let emitted = "";
  let pendingDelta = "";
  let lastDeltaFlushAt = Date.now();
  const factBufferStartedAt = exactFactValidationEnabled ? performance.now() : null;
  let firstModelCallDurationMs = null;
  let modelCallStartedAtMs = null;
  let modelDurationMs = null;
  let mayEmitDelta = !exactFactValidationEnabled;
  const sse = new ReadableStream({
    async start(controller) {
      let streamFinalized = false;
      let aborted = false;

      const flushPendingDelta = () => {
        if (!mayEmitDelta || !pendingDelta || clientGone) return;
        const text = pendingDelta;
        pendingDelta = "";
        lastDeltaFlushAt = Date.now();
        try {
          controller.enqueue(enc.encode(`event: delta\ndata: ${JSON.stringify({
            t: text
          })}\n\n`));
          emitted += text;
        } catch {
          clientGone = true;
        }
      };

      /* Aus Stop (T03 E2 + SOL-CHAT-05): serveripoolne abort salvestab AINULT juba VÄLJA SAADETUD
         osalise teksti tähisega ABORTED (või ausa tühja katkestuse), arvestab nähtava vastuse
         kasutuseks ja vabastab ainult väljundita katkestuse reservatsiooni. Taustal valmivat
         täisvastust ei püsistata ning `done` sündmust ei emiteerita.
         `streamFinalized` lipp on kutsuja hoida — siia jõutakse nii Stop'i kui ka „Stop jõudis
         finaliseerimise vahele" rajalt. */
      const finalizeAsAborted = async () => {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        const hasVisibleOutput = emitted.length > 0;
        const settleAbortedUsage = hasVisibleOutput ? onUsageCommit : onUsageRelease;
        const releaseReason = "chat_stream_aborted";
        // SOL-CHAT-02: ABORTED marker ja kasutusarvestus ühes tehingus; kui marker ei jõua
        // kettale, arveldatakse eraldi sammuna, aga mitte kaks korda.
        let settledWithMarker = false;
        if (persist && convId && userId) {
          const marker = await completeTurnPersistence({
            convId,
            userId,
            status: "ABORTED",
            turnId,
            finalText: emitted,
            metadataExtra,
            isCrisis,
            replyLang,
            settleUsage: typeof settleAbortedUsage === "function"
              ? tx => hasVisibleOutput
                ? settleAbortedUsage(tx)
                : settleAbortedUsage(releaseReason, tx)
              : null
          });
          settledWithMarker = !!marker;
        }
        if (!settledWithMarker) {
          await settleChatUsage(
            settleAbortedUsage,
            logError,
            hasVisibleOutput ? "usage.chat_commit.error" : "usage.chat_release.error",
            hasVisibleOutput ? undefined : releaseReason
          );
        }
        if (typeof logEvent === "function") {
          await logEvent("chat_stream_aborted", {
            userId,
            role: normalizedRole,
            isCrisis,
            messageLength,
            partialChars: emitted.length,
            // Vahe `accumulated` ja `emitted` vahel ON leiu enda mõõt: kui ta on suurem kui null,
            // oli providerilt tulnud tekst, mida kasutaja ei näinud ja mida seega ei salvestatud.
            discardedChars: Math.max(0, accumulated.length - emitted.length)
          });
        }
      };

      const finalizeStreamReply = async () => {
        if (streamFinalized) return;
        streamFinalized = true;
        if (modelCallStartedAtMs !== null && modelDurationMs === null) {
          modelDurationMs = Math.max(0, Math.round(performance.now() - modelCallStartedAtMs));
        }
        if (!accumulated.trim()) {
          accumulated = resolveProviderReply("", { replyLang, isCrisis });
          pendingDelta += accumulated;
        }
        let factValidation = null;
        let factValidationDurationMs = null;
        if (exactFactValidationEnabled) {
          const factValidationStartedAt = performance.now();
          factValidation = validateExactFactAnswer({
            message: effectiveMessage,
            reply: accumulated,
            sources,
            retrievalMeta,
            replyLang
          });
          factValidationDurationMs = Math.max(0, Math.round(performance.now() - factValidationStartedAt));
          accumulated = factValidation.reply;
          pendingDelta = accumulated;
          factValidation.trace.buffered_response_ms = Math.max(0, Math.round(performance.now() - factBufferStartedAt));
          factValidation.trace.validation_duration_ms = factValidationDurationMs;
          mayEmitDelta = true;
        }
        flushPendingDelta();
        /* SOL-CHAT-05: Stop võib jõuda täpselt siia — provider on `done` andnud, aga kliendile ei
           ole veel midagi lõplikku kinnitatud. Vana kood pani `streamFinalized = true` juba
           sisenemisel, seega hilisem `finalizeStreamAbort()` ei teinud enam midagi ja täisvastus
           commit'iti kasutajale, kes seda ei näinud. Piir on kliendile antud `done`: kuni teda ei
           ole, VÕIDAB abort. */
        if (aborted) {
          await finalizeAsAborted();
          return;
        }
        const attribution = buildSourceAttribution(accumulated, sources, {
          query: retrievalMeta?.attributionQuery || effectiveMessage,
          riskPolicy: retrievalMeta?.ragRiskPolicy,
          legalLookupPlan: retrievalMeta?.legalLookupPlan || retrievalMeta?.queryPlan?.legalLookupPlan,
          queryPlan: retrievalMeta?.queryPlan,
          personTopicTerms: retrievalMeta?.personTopicTerms,
          personCoauthorNames: retrievalMeta?.personCoauthorNames,
          personCoauthorRequested: retrievalMeta?.personCoauthorRequested,
          packageDisplayedSourceIds: retrievalMeta?.packageAwareAnswering?.packageDisplayedSourceIds,
          packageAwareAnsweringUsed: retrievalMeta?.packageAwareAnswering?.used === true,
          municipalityContext: retrievalMeta?.municipalityContext,
          documentIdentityEvidence: retrievalMeta?.documentIdentityEvidence,
          factValidation: factValidation?.trace,
          contactInventoryValidatedSourceIds:
            factValidation?.trace?.passed === true && (
              factValidation?.trace?.contact_inventory_checked === true ||
              factValidation?.trace?.contact_monitor_checked === true
            )
              ? factValidation.trace.supporting_source_ids
              : []
        });
        const replySources = resolveDisplayedSources(sources, attribution, factValidation?.trace);
        const responseRetrievalMeta = withFactValidation(exactFactRetrievalMeta, factValidation?.trace, {
          ...(firstModelCallDurationMs === null ? {} : { first_model_call_ms: firstModelCallDurationMs }),
          ...(modelDurationMs === null ? {} : { model_ms: modelDurationMs }),
          ...(factValidationDurationMs === null ? {} : { fact_validation_ms: factValidationDurationMs })
        });
        const ragTrace = resolveRagTrace(sources, attribution, responseRetrievalMeta);
        const ragContract = buildRagContractMetadata();
        const attributionDecisions = resolveAttributionDecisions(attribution);
        await emitRagTraceEvent(logEvent, {
          userId,
          role: normalizedRole,
          isCrisis,
          ragTrace
        });
        await persistSourcePackagesFromTrace(ragTrace, logError);
        // SOL-CHAT-05, teine kontrollpunkt: omistamine ja RAG-jälg on `await`-id, mille ajal Stop
        // võib saabuda. Viimane värav enne püsivat kirjutust ja tasu.
        if (aborted) {
          await finalizeAsAborted();
          return;
        }
        const persistenceStartedAt = performance.now();
        const { attachments, persisted } = await finalizeReply({
          settleUsage: typeof onUsageCommit === "function" ? tx => onUsageCommit(tx) : null,
          persist,
          persistInitialized: true,
          turnId,
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
          metadataExtra: buildAttributionMetadata(metadataExtra, sources, attribution, responseRetrievalMeta),
          isCrisis,
          wantsDocumentDownload,
          replyLang,
          messageForDownload: effectiveMessage,
          roomId,
          saveRoomMessage
        });
        const persistenceDurationMs = Math.max(0, Math.round(performance.now() - persistenceStartedAt));
        const streamSettled = await settleAfterFinalize({
          persisted,
          onUsageCommit,
          onUsageRelease,
          logError
        });
        /* SOL-CHAT-01: `done` on kliendile lubadus, et pööre on lõpetatud ja leitav. Kui püsivat
           vastust ei tekkinud, ei tohi seda lubadust anda — muidu on ekraanil täisvastus, mida
           vestluse taasavamisel enam ei ole. Sel juhul läheb välja `error` ja ühik on vabastatud. */
        if (!streamSettled) {
          if (typeof logError === "function") {
            logError("chat.persist.not_durable", { branch: "stream", convId });
          }
          if (!clientGone) {
            try {
              controller.enqueue(enc.encode(`event: error\ndata: ${JSON.stringify({
                message: "chat.error.not_saved"
              })}\n\n`));
            } catch {}
          }
          return;
        }
        await emitTurnPerformanceEvent(logEvent, {
          userId,
          role: normalizedRole,
          conversationId: convId,
          turnId,
          retrievalMeta: responseRetrievalMeta,
          timings: {
            ...(modelDurationMs === null ? {} : { model_ms: modelDurationMs }),
            persistence_ms: persistenceDurationMs,
            turn_total_ms: Math.max(0, Math.round(performance.now() - turnStartedAtMs))
          }
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

      const finalizeStreamAbort = async () => {
        if (streamFinalized) return;
        streamFinalized = true;
        await finalizeAsAborted();
      };

      try {
        req.signal?.addEventListener("abort", () => {
          aborted = true;
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
        const modelCallStartedAt = performance.now();
        modelCallStartedAtMs = modelCallStartedAt;
        const iter = await streamProvider({
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
          role: normalizedRole,
          signal: req.signal
        });
        firstModelCallDurationMs = Math.max(0, Math.round(performance.now() - modelCallStartedAt));
        for await (const ev of iter) {
          if (aborted) break;
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
        if (aborted && !streamFinalized) {
          await finalizeStreamAbort();
        } else if (!streamFinalized) {
          await finalizeStreamReply();
        }
      } catch (err) {
        const wasAborted =
          aborted ||
          req.signal?.aborted === true ||
          err?.name === "AbortError" ||
          err?.name === "APIUserAbortError";
        if (wasAborted) {
          await finalizeStreamAbort();
        } else {
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
          // Vt SOL-CHAT-02 finalizeStreamAbort'is: sama leping voo tehnilise vea rajal.
          let releasedWithMarker = false;
          if (!streamFinalized && persist && convId && userId) {
            const marker = await completeTurnPersistence({
              convId,
              userId,
              status: "ERROR",
              turnId,
              isCrisis,
              replyLang,
              settleUsage: typeof onUsageRelease === "function"
                ? tx => onUsageRelease("chat_stream_failed", tx)
                : null
            });
            releasedWithMarker = !!marker;
          }
          if (!streamFinalized && !releasedWithMarker) {
            await settleChatUsage(
              onUsageRelease,
              logError,
              "usage.chat_release.error",
              "chat_stream_failed"
            );
          }
        }
      } finally {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        // Sulge voog ka pärast abort'i (klient on läinud), et vältida rippuvat SSE-lukku.
        try {
          controller.close();
        } catch {}
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
