import { performance } from "node:perf_hooks";
import { projectDiagnosticHistory, projectIdentityDecision, projectQualitativeGateChecks } from "@/lib/chat/ragDiagnostics";

import { persistInit, persistDone, writeUserTurn, PERSIST_FAILURE } from "@/lib/chat/persistence";
import { claimChatTurn, CHAT_TURN_OUTCOME } from "@/lib/chat/turnRegistry";
import { projectAttemptRuntime } from "./ragAttemptEvidence.js";
import { staleAttemptError, persistAttemptTerminal } from "./ragAttemptStore.js";
import { projectQuestionRequirementsShadow } from "./questionRequirements.js";
import { validateGroupFactReply } from "./groupFactContract.js";
import { hasValidatedPublication, projectResponseDecision, projectGroupEvidenceLocators, GROUP_CONTRACT_REASONS } from "./responsePolicy.js";
import { callOpenAI, resolveProviderReply, streamOpenAI, shouldFlushStreamDelta } from "@/lib/chat/openaiRuntime";
import { buildImmediateChatResponse, finalizeAssistantReply } from "@/lib/chat/responseFinalizer";
import {
  FACT_VALIDATOR_VERSION,
  buildFactValidationContractShadow,
  recoverSupportedReplyAfterNumericValidation,
  shouldValidateExactFactAnswer,
  validateExactFactAnswer
} from "@/lib/chat/factContract";
import {
  buildDeterministicMunicipalityClarification,
  buildDeterministicSocialScopeBoundary,
  buildNoContextRecovery,
  buildSocialAcknowledgementReply,
  inferNoContextRecoveryTarget,
  recoveryWorkflow,
  resolveModelClarification,
  resolveSocialScopeBoundary,
  resolveValidationRecovery,
  withConversationalRecoveryInstruction
} from "@/lib/chat/conversationalRecovery";
import { CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";
import { buildSourceAttribution, getSourceAttributionId } from "@/lib/chat/sourceAttribution";
import { prepareSourceAttributionLanguage } from "@/lib/chat/sourceAttributionLanguage";
import { analyzeRagQuery } from "@/lib/chat/retrievalOrchestrator";
import { persistSourcePackageSnapshots } from "@/lib/rag/sourcePackageSnapshots";
import { DEFAULT_MODEL } from "@/lib/chat/settings";
import {
  RAG_ATTRIBUTION_DECISIONS_ENABLED,
  RAG_DISPLAYED_SOURCES_ENFORCED,
  RAG_TRACE_V1_ENABLED
} from "@/lib/chat/settings";

export const RAG_CONTRACT_VERSION = "v1";

async function buildFinalSourceAttribution(reply, sources, options) {
  const attributionLanguage = await prepareSourceAttributionLanguage(reply, sources, options.queryPlan, analyzeRagQuery);
  return buildSourceAttribution(reply, sources, { ...options, attributionLanguage });
}

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
    !new Set(["requested_metric_contract_v2", "requested_fact_slot_contract_v1"]).has(value.version)
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
  const allowedValueTypes = new Set([
    "proportion", "count", "amount", "magnitude", "duration", "calendar_year",
    "explicit_value_relation"
  ]);
  const allowedSlotSources = new Set(["requested_fact_slots", "evidence_metric_slots"]);
  const slots = inputSlots
    .map(slot => {
      const evidenceValue = typeof slot?.evidence_value === "string" &&
        /^\d+(?:\.\d+)?$/u.test(slot.evidence_value) &&
        Number(slot.evidence_value) >= 0 &&
        Number(slot.evidence_value) <= 1_000_000_000_000
        ? slot.evidence_value
        : null;
      const valueType = allowedValueTypes.has(slot?.value_type) ? slot.value_type : null;
      const unit = slot?.unit === "percent"
        ? "percent"
        : typeof slot?.unit === "string" && slot.unit.trim()
          ? truncateTraceString(slot.unit, 32)
          : null;
      const qualifier = new Set(["over", "under", "at_least", "at_most", "about", "range"]).has(
        slot?.qualifier
      ) ? slot.qualifier : null;
      const rangeValid = qualifier !== "range" || (
        valueType === "proportion" && unit === "percent" && evidenceValue !== null &&
        typeof slot?.evidence_range_end === "string" && /^\d+(?:\.\d+)?$/u.test(slot.evidence_range_end) &&
        Number(evidenceValue) < Number(slot.evidence_range_end) && Number(slot.evidence_range_end) <= 100
      );
      return {
        slot_index: boundedInteger(slot?.slot_index, 1, REQUESTED_METRIC_CONTRACT_TRACE_MAX_SLOTS),
        value_type: valueType,
        slot_source: allowedSlotSources.has(slot?.slot_source) ? slot.slot_source : null,
        evidence_value_valid: evidenceValue !== null && rangeValid,
        unit,
        qualifier,
        ...(qualifier === "range" && rangeValid ? { range_endpoint_count: 2 } : {}),
        input_form: slot?.input_form === "original" || slot?.input_form === "canonical_fallback"
          ? slot.input_form
          : null,
        fragment_index: boundedInteger(slot?.fragment_index, 0, 2047),
        mention_index: boundedInteger(slot?.mention_index, 0, 511),
        matched_term_count: boundedInteger(slot?.matched_term_count, 0, 8),
        relation_term_count: boundedInteger(slot?.relation_term_count, 0, 8),
        ...(Array.isArray(slot?.named_scope_terms)
          ? { named_scope_term_count: boundedInteger(slot.named_scope_terms.length, 1, 3),
            named_scope_age_required: !!slot.named_scope_constraints?.age,
            named_scope_observation_year_required: !!slot.named_scope_constraints?.observation_year } : {}),
        source_mapped_relation_variant_count: boundedInteger(slot?.source_mapped_relation_variant_count, 0, 64),
        minimum_relation_matches: boundedInteger(slot?.minimum_relation_matches, 1, 8),
        expected_cardinality: boundedInteger(slot?.expected_cardinality, 2, 12),
        parenthesis_depth: boundedInteger(slot?.parenthesis_depth, 0, 8),
        local_relation_head_matched: slot?.local_relation_head_matched === true,
        ...(typeof slot?.inherited_scope_head_matched === "boolean"
          ? { inherited_scope_head_matched: slot.inherited_scope_head_matched }
          : {}),
        ...(typeof slot?.shared_subject_head_matched === "boolean"
          ? { shared_subject_head_matched: slot.shared_subject_head_matched }
          : {})
      };
    })
    .filter(slot =>
      slot.slot_index !== null &&
      slot.value_type &&
      slot.evidence_value_valid &&
      (slot.value_type !== "proportion" || slot.unit === "percent")
    )
    .slice(0, REQUESTED_METRIC_CONTRACT_TRACE_MAX_SLOTS)
    .map(({ evidence_value_valid: _evidenceValueValid, ...slot }) => slot);
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
    "bounded_inherited_scope_peer_alignment_v4",
    "bounded_evidence_subject_peer_alignment_v5",
    "bounded_rendered_sentence_peer_alignment_v6",
    "bounded_rendered_sentence_peer_alignment_v7",
    "bounded_rendered_sentence_peer_alignment_v8",
    "bounded_rendered_sentence_peer_alignment_v9",
    "bounded_rendered_sentence_peer_alignment_v10"
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
        candidate_scope: rawDiagnostics.candidate_scope === "lexical_pre_assignment"
          ? rawDiagnostics.candidate_scope
          : null,
        coordination_gate_evaluated: rawDiagnostics.coordination_gate_evaluated === true,
        coordination_gate_passed: typeof rawDiagnostics.coordination_gate_passed === "boolean"
          ? rawDiagnostics.coordination_gate_passed
          : null,
        coordination_rejected_assignment_count: boundedInteger(
          rawDiagnostics.coordination_rejected_assignment_count,
          0,
          1000000
        ),
        coordination_qualified_solution_count: boundedInteger(
          rawDiagnostics.coordination_qualified_solution_count,
          0,
          1000000
        ),
        slots: (Array.isArray(rawDiagnostics.slots) ? rawDiagnostics.slots : [])
          .map(slot => ({
            slot_index: boundedInteger(slot?.slot_index, 1, REQUESTED_METRIC_CONTRACT_TRACE_MAX_SLOTS),
            matching_candidate_count: boundedInteger(slot?.matching_candidate_count, 0, 512),
            top_candidates: (Array.isArray(slot?.top_candidates) ? slot.top_candidates : [])
              .map(candidate => ({
                evidence_value_valid: typeof candidate?.evidence_value === "string" &&
                  /^\d+(?:\.\d+)?$/u.test(candidate.evidence_value) &&
                  Number(candidate.evidence_value) >= 0 &&
                  Number(candidate.evidence_value) <= 1_000_000_000_000 &&
                  (candidate.qualifier !== "range" || (typeof candidate.evidence_range_end === "string" &&
                    /^\d+(?:\.\d+)?$/u.test(candidate.evidence_range_end) &&
                    Number(candidate.evidence_value) < Number(candidate.evidence_range_end) && Number(candidate.evidence_range_end) <= 100))
                  ? true
                  : false,
                ...(candidate?.qualifier === "range" && typeof candidate?.evidence_range_end === "string" &&
                  /^\d+(?:\.\d+)?$/u.test(candidate.evidence_range_end) &&
                  Number(candidate.evidence_value) < Number(candidate.evidence_range_end) && Number(candidate.evidence_range_end) <= 100
                  ? { qualifier: "range", range_endpoint_count: 2 } : {}),
                score: typeof candidate?.score === "number" && Number.isFinite(candidate.score) &&
                  candidate.score >= 0 && candidate.score <= 100
                  ? candidate.score
                  : null,
                fragment_index: boundedInteger(candidate?.fragment_index, 0, 2047),
                mention_index: boundedInteger(candidate?.mention_index, 0, 511),
                rendered_body_index: boundedInteger(candidate?.rendered_body_index, 0, 63),
                relation_scope_index: boundedInteger(candidate?.relation_scope_index, 0, 4095),
                matched_term_count: boundedInteger(candidate?.matched_term_count, 0, 8),
                relation_term_count: boundedInteger(candidate?.relation_term_count, 0, 8),
                parenthesis_depth: boundedInteger(candidate?.parenthesis_depth, 0, 8),
                local_relation_head_matched: candidate?.local_relation_head_matched === true,
                ...(typeof candidate?.inherited_scope_head_matched === "boolean"
                  ? { inherited_scope_head_matched: candidate.inherited_scope_head_matched }
                  : {}),
                ...(typeof candidate?.shared_subject_head_matched === "boolean"
                  ? { shared_subject_head_matched: candidate.shared_subject_head_matched }
                  : {})
              }))
              .filter(candidate => candidate.evidence_value_valid && candidate.score !== null)
              .map(({ evidence_value_valid: _evidenceValueValid, ...candidate }) => candidate)
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
    compatibility_contract: truncateTraceString(value.compatibility_contract, 80),
    slot_source: truncateTraceString(value.slot_source, 80),
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
    rendered_evidence_hash: renderedEvidenceHash,
    ...(mappingDiagnostics ? { mapping_diagnostics: mappingDiagnostics } : {}),
    slots
  };
}

const REQUESTED_QUALITATIVE_CONTRACT_TRACE_MAX_SLOTS = 12;

function sanitizeRequestedQualitativeContractTrace(value = null) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.version !== "requested_qualitative_slot_contract_v1"
  ) return null;
  const boundedInteger = (candidate, min, max) => typeof candidate === "number" &&
    Number.isInteger(candidate) &&
    candidate >= min &&
    candidate <= max
    ? candidate
    : null;
  const boundedArrayCount = (items, limit = 8) => Math.min(
    limit,
    (Array.isArray(items) ? items : []).filter(item => item !== null && typeof item !== "undefined").length
  );
  const allowedValueTypes = new Set([
    "category", "date", "distribution", "entity_list", "location", "method", "month", "organization",
    "person_role", "recommendation", "season", "text_relation", "timepoint"
  ]);
  const allowedActionFamilies = new Set([
    "recommend", "assign", "create", "provide", "deliver", "simplify", "use", "support",
    "improve", "continue", "avoid", "block", "require_state", "positive_state", "reject_state"
  ]);
  const allowedActionCategories = new Set(["enable", "avoid", "block"]);
  const inputSlots = Array.isArray(value.slots) ? value.slots : [];
  const slots = inputSlots.map(slot => ({
    slot_index: boundedInteger(slot?.slot_index, 1, REQUESTED_QUALITATIVE_CONTRACT_TRACE_MAX_SLOTS),
    value_type: allowedValueTypes.has(slot?.value_type) ? slot.value_type : null,
    payload_kind: ["known_value_interpretation", "referenced_study_period", "group_distribution", "group_membership"].includes(slot?.payload_kind) ? slot.payload_kind : null,
    admitted_payload_present: !!slot?.admitted_payload,
    reference_slot_index: boundedInteger(slot?.reference_slot_index, 1, REQUESTED_QUALITATIVE_CONTRACT_TRACE_MAX_SLOTS),
    validation_language: truncateTraceString(slot?.validation_language, 12),
    expected_cardinality: boundedInteger(slot?.expected_cardinality, 1, 100),
    minimum_answer_items: boundedInteger(slot?.minimum_answer_items, 1, 100),
    minimum_relation_matches: boundedInteger(slot?.minimum_relation_matches, 0, 8),
    minimum_evidence_anchor_count: boundedInteger(slot?.minimum_evidence_anchor_count, 0, 8),
    minimum_anchor_matches: boundedInteger(slot?.minimum_anchor_matches, 0, 8),
    relation_term_count: boundedArrayCount(slot?.relation_terms),
    matched_relation_term_count: boundedArrayCount(slot?.matched_relation_terms),
    evidence_anchor_term_count: boundedArrayCount(slot?.evidence_anchor_terms),
    evidence_action_term_count: boundedArrayCount(slot?.evidence_action_terms),
    evidence_action_categories: (Array.isArray(slot?.evidence_action_categories)
      ? slot.evidence_action_categories
      : []).filter(item => allowedActionCategories.has(item)).slice(0, 3),
    evidence_negated: slot?.evidence_negated === true,
    minimum_action_matches: boundedInteger(slot?.minimum_action_matches, 0, 8),
    required_numeric_value_count: boundedArrayCount(slot?.required_numeric_values),
    action_object_bindings: (Array.isArray(slot?.action_object_bindings)
      ? slot.action_object_bindings
      : []).slice(0, 8).map((binding, bindingIndex) => ({
      binding_index: bindingIndex + 1,
      action_family: allowedActionFamilies.has(binding?.action_family) ? binding.action_family : null,
      action_category: allowedActionCategories.has(binding?.action_category) ? binding.action_category : null,
      evidence_action_term_count: boundedArrayCount(binding?.evidence_action_terms, 4),
      object_anchor_count: boundedArrayCount(binding?.object_anchor_terms, 8),
      minimum_object_matches: boundedInteger(binding?.minimum_object_matches, 1, 8),
      evidence_negated: binding?.evidence_negated === true
    })).filter(binding => binding.action_family && binding.action_category),
    evidence_fragment_hash: typeof slot?.evidence_fragment_hash === "string" &&
      /^[a-f0-9]{64}$/u.test(slot.evidence_fragment_hash)
      ? slot.evidence_fragment_hash
      : null,
    evidence_fragment_index: boundedInteger(slot?.evidence_fragment_index, 0, 4095)
  })).filter(slot =>
    slot.slot_index !== null &&
    slot.value_type &&
    slot.evidence_fragment_hash
  ).slice(0, REQUESTED_QUALITATIVE_CONTRACT_TRACE_MAX_SLOTS);
  const requestedSlotCount = boundedInteger(
    value.requested_slot_count,
    1,
    REQUESTED_QUALITATIVE_CONTRACT_TRACE_MAX_SLOTS
  );
  const mappedSlotCount = boundedInteger(
    value.mapped_slot_count,
    0,
    REQUESTED_QUALITATIVE_CONTRACT_TRACE_MAX_SLOTS
  );
  const sanitizerDroppedSlot = slots.length !== inputSlots.length;
  const selectedDocumentIdPresent = !!truncateTraceString(value.selected_document_id, 240);
  const complete = value.complete === true &&
    !sanitizerDroppedSlot &&
    selectedDocumentIdPresent &&
    requestedSlotCount !== null &&
    mappedSlotCount === requestedSlotCount &&
    slots.length === mappedSlotCount;
  const allowedReasons = new Set([
    ...GROUP_CONTRACT_REASONS,
    "requested_slots_incomplete",
    "document_identity_not_high",
    "qualitative_evidence_mapping_incomplete",
    "qualitative_evidence_conflict",
    "all_qualitative_slots_bound_to_rendered_evidence"
  ]);
  return {
    version: value.version,
    enabled: value.enabled === true,
    complete,
    reason: allowedReasons.has(value.reason) ? value.reason : null,
    selected_document_id_present: selectedDocumentIdPresent,
    reply_language: truncateTraceString(value.reply_language, 12),
    requested_slot_count: requestedSlotCount,
    mapped_slot_count: mappedSlotCount,
    sanitizer_dropped_slot: sanitizerDroppedSlot,
    conflicting_slot_indexes: (Array.isArray(value.conflicting_slot_indexes) ? value.conflicting_slot_indexes : [])
      .map(item => boundedInteger(item, 1, REQUESTED_QUALITATIVE_CONTRACT_TRACE_MAX_SLOTS))
      .filter(item => item !== null).slice(0, REQUESTED_QUALITATIVE_CONTRACT_TRACE_MAX_SLOTS),
    used_for_generation: value.used_for_generation === true,
    used_for_validation: value.used_for_validation === true,
    missing_slot_indexes: (Array.isArray(value.missing_slot_indexes) ? value.missing_slot_indexes : [])
      .map(item => boundedInteger(item, 1, REQUESTED_QUALITATIVE_CONTRACT_TRACE_MAX_SLOTS))
      .filter(item => item !== null),
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
    "forward_explicit_year_cue",
    "nearest_explicit_year_cue",
    "conflicting_explicit_year_cues",
    "no_explicit_year_cue",
    "bounded_episode_period",
    "explicit_year_range",
    "explicit_observation_year"
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
    "enumerated_clause",
    "coordinated_shared_head",
    "coordinated_named_scope",
    "parallel_type_inheritance"
  ]);
  const allowedValueTypeSources = new Set([
    "explicit_cue",
    "enumerated_proportion_cue",
    "parallel_inheritance"
  ]);
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

function sanitizeShadowCurrentTurnDocumentIdentity(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const boundedString = (candidate, limit = 160) => {
    const stringValue = String(candidate || "").trim().replace(/\s+/gu, " ");
    return stringValue ? stringValue.slice(0, limit) : null;
  };
  const boundedSpan = candidate => typeof candidate === "number" && Number.isInteger(candidate) &&
    candidate >= 0 && candidate <= 20000
    ? candidate
    : null;
  const authorValue = boundedString(value?.author?.value);
  const authorProvenance = value?.author?.provenance === "explicit_current_turn"
    ? "explicit_current_turn"
    : null;
  const authorConfidence = ["high", "medium"].includes(value?.author?.confidence)
    ? value.author.confidence
    : null;
  const authorSpanStart = boundedSpan(value?.author?.span_start);
  const authorSpanEnd = boundedSpan(value?.author?.span_end);
  const authorInputForm = ["original", "canonical_fallback"].includes(value?.author?.input_form)
    ? value.author.input_form
    : null;
  const author = authorValue && authorProvenance && authorConfidence && authorSpanStart !== null &&
    authorSpanEnd !== null && authorSpanEnd > authorSpanStart && authorInputForm
    ? {
        value: authorValue,
        provenance: authorProvenance,
        confidence: authorConfidence,
        span_start: authorSpanStart,
        span_end: authorSpanEnd,
        input_form: authorInputForm
      }
    : {
        value: null,
        provenance: null,
        confidence: null,
        span_start: null,
        span_end: null,
        input_form: null
      };
  const documentKind = ["article", "report", "document", "publication_verb", "study"].includes(
    value?.document_kind?.value
  )
    ? value.document_kind.value
    : null;
  const documentSourceYears = (Array.isArray(value?.document_source_years) ? value.document_source_years : [])
    .map(year => String(year?.value || ""))
    .filter(year => /^(?:19|20)\d{2}$|^2100$/u.test(year))
    .filter((year, index, years) => years.indexOf(year) === index)
    .slice(0, 2)
    .map(year => ({
      value: year,
      role: "document_source_year",
      provenance: "explicit_current_turn"
    }));
  const titleHint = boundedString(value?.title_hint?.value);
  const explicitAnchorCount = Number(Boolean(author.value)) +
    Number(Boolean(documentKind)) +
    documentSourceYears.length +
    Number(Boolean(titleHint));
  return {
    version: value.version === "current_turn_document_identity_v1"
      ? "current_turn_document_identity_v1"
      : null,
    scope: value.scope === "current_turn" ? "current_turn" : null,
    history_fallback_policy: value.history_fallback_policy === "fill_missing_only"
      ? "fill_missing_only"
      : null,
    author,
    document_kind: {
      value: documentKind,
      provenance: documentKind ? "explicit_current_turn" : null
    },
    document_source_years: documentSourceYears,
    title_hint: {
      value: titleHint,
      provenance: titleHint ? "explicit_current_turn" : null
    },
    explicit_anchor_count: explicitAnchorCount
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

function sanitizeCurrentTurnAuthorConfirmation(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const statuses = new Set([
    "confirmed_exact",
    "confirmed_existing_transliteration",
    "not_confirmed",
    "no_candidate",
    "no_author_metadata"
  ]);
  const boundedCount = candidate => typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 0
    ? Math.min(candidate, 32)
    : null;
  const matchedDocumentIds = Array.isArray(value.matched_document_ids)
    ? value.matched_document_ids
      .map(item => truncateTraceString(item, 180))
      .filter(Boolean)
      .slice(0, 8)
    : [];
  const matchedAuthorValues = Array.isArray(value.matched_author_values)
    ? value.matched_author_values
      .map(item => truncateTraceString(item, 120))
      .filter(Boolean)
      .slice(0, 8)
    : [];
  return {
    version: value.version === "current_turn_author_confirmation_v1"
      ? "current_turn_author_confirmation_v1"
      : null,
    candidate_value: truncateTraceString(value.candidate_value, 120),
    candidate_provenance: value.candidate_provenance === "explicit_current_turn"
      ? "explicit_current_turn"
      : null,
    candidate_confidence: ["high", "medium"].includes(value.candidate_confidence)
      ? value.candidate_confidence
      : null,
    candidate_document_source_years: Array.isArray(value.candidate_document_source_years)
      ? value.candidate_document_source_years
        .map(item => String(item || ""))
        .filter(item => /^(?:19|20)\d{2}$|^2100$/u.test(item))
        .slice(0, 2)
      : [],
    candidate_document_kind: ["article", "report", "document", "publication_verb", "study"].includes(value.candidate_document_kind)
      ? value.candidate_document_kind
      : null,
    status: statuses.has(value.status) ? value.status : null,
    matched_source_count: boundedCount(value.matched_source_count),
    matched_document_ids: matchedDocumentIds,
    matched_author_values: matchedAuthorValues,
    promotion_eligible: value.promotion_eligible === true,
    confirmation_source: value.confirmation_source === "retrieved_source_metadata"
      ? "retrieved_source_metadata"
      : null
  };
}

function sanitizeAnswerValidationContractShadow(
  base = null,
  factValidation = null,
  attribution = null,
  authorConfirmation = null
) {
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
        ),
        current_turn_document_identity: sanitizeShadowPlannerField(
          fields?.current_turn_document_identity,
          sanitizeShadowCurrentTurnDocumentIdentity
        )
      }
    },
    ...(authorConfirmation
      ? { current_turn_author_confirmation: sanitizeCurrentTurnAuthorConfirmation(authorConfirmation) }
      : {}),
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
  const boundedArrayCount = (items, limit = 100) => Math.min(
    limit,
    (Array.isArray(items) ? items : []).filter(item => item !== null && typeof item !== "undefined").length
  );
  const allowedActionFamilies = new Set([
    "recommend", "assign", "create", "provide", "deliver", "simplify", "use", "support",
    "improve", "continue", "avoid", "block", "require_state", "positive_state", "reject_state"
  ]);
  const allowedActionCategories = new Set(["enable", "avoid", "block"]);
  return Object.fromEntries(Object.entries({
    version: typeof value.version === "string" ? value.version : undefined,
    enabled: value.enabled === true,
    buffered: value.buffered === true,
    passed: value.passed === true,
    reason: typeof value.reason === "string" ? value.reason : undefined,
    claim_count: boundedArrayCount(value.claim_values, 30),
    response_decision: projectResponseDecision(value.response_decision),
    group_evidence_locators: projectGroupEvidenceLocators(value.group_evidence_locators),
    category_relation_checked: value.category_relation_checked === true,
    category_relation_mode: typeof value.category_relation_mode === "string" ? value.category_relation_mode : undefined,
    expected_per_group_value_present: typeof value.expected_per_group_value === "string",
    observed_category_value_count: boundedArrayCount(value.observed_category_values, 30),
    mismatched_category_label_count: boundedArrayCount(value.mismatched_category_labels, 12),
    expected_total_value_present: typeof value.expected_total_value === "string",
    observed_total_value_present: typeof value.observed_total_value === "string",
    unsupported_category_label_count: boundedArrayCount(value.unsupported_category_labels, 12),
    unsupported_claim_count: boundedArrayCount(value.unsupported_claim_values, 30),
    temporal_claim_binding_reason: truncateTraceString(value.temporal_claim_binding_reason, 100),
    temporal_claim_bindings: Array.isArray(value.temporal_claim_bindings)
      ? value.temporal_claim_bindings.slice(0, 24).map(binding => Object.fromEntries(Object.entries({
          year: Number.isInteger(Number(binding?.year)) ? Number(binding.year) : undefined,
          period_start_year: Number.isInteger(Number(binding?.period_start_year)) ? Number(binding.period_start_year) : undefined,
          period_end_year: Number.isInteger(Number(binding?.period_end_year)) ? Number(binding.period_end_year) : undefined,
          source_id: truncateTraceString(binding?.source_id, 180)
        }).filter(([, item]) => typeof item !== "undefined")))
      : [],
    temporal_missing_years: Array.isArray(value.temporal_missing_years)
      ? value.temporal_missing_years
        .map(item => Number(item))
        .filter(item => Number.isInteger(item) && item >= 1900 && item <= 2100)
        .slice(0, 8)
      : [],
    temporal_supplemental_source_ids: sanitizeTraceStringList(value.temporal_supplemental_source_ids, 3),
    temporal_supplemental_bindings: Array.isArray(value.temporal_supplemental_bindings)
      ? value.temporal_supplemental_bindings.slice(0, 3).map(binding => Object.fromEntries(Object.entries({
          relation: truncateTraceString(binding?.relation, 80),
          document_id: truncateTraceString(binding?.document_id, 240),
          source_id: truncateTraceString(binding?.source_id, 180),
          publication_year: Number.isInteger(Number(binding?.publication_year)) ? Number(binding.publication_year) : undefined,
          title: truncateTraceString(binding?.title, 240)
        }).filter(([, item]) => typeof item !== "undefined")))
      : [],
    temporal_supplement_dropped_reason: truncateTraceString(value.temporal_supplement_dropped_reason, 100),
    contact_inventory_checked: value.contact_inventory_checked === true,
    contact_monitor_checked: value.contact_monitor_checked === true,
    contact_inventory_total_expected_count: boundedArrayCount(value.contact_inventory_total_expected, 30),
    contact_inventory_total_seen_count: boundedArrayCount(value.contact_inventory_total_seen, 30),
    contact_role_count_expected_count: boundedArrayCount(value.contact_role_count_expected, 80),
    contact_role_count_seen_count: boundedArrayCount(value.contact_role_count_seen, 80),
    contact_inventory_expected_name_count: Number.isFinite(Number(value.contact_inventory_expected_name_count))
      ? Number(value.contact_inventory_expected_name_count)
      : undefined,
    contact_inventory_seen_name_count: Number.isFinite(Number(value.contact_inventory_seen_name_count))
      ? Number(value.contact_inventory_seen_name_count)
      : undefined,
    missing_contact_name_count: boundedArrayCount(value.missing_contact_names, 80),
    unexpected_contact_item_count: boundedArrayCount(value.unexpected_contact_items, 80),
    unsupported_contact_role_relation_count: boundedArrayCount(value.unsupported_contact_role_relations, 80),
    contact_source_count: Number.isFinite(Number(value.contact_source_count))
      ? Number(value.contact_source_count)
      : undefined,
    contact_phone_claim_count: Number.isFinite(Number(value.contact_phone_claim_count))
      ? Number(value.contact_phone_claim_count)
      : undefined,
    contact_phone_relation_checked: value.contact_phone_relation_checked === true,
    unsupported_contact_phone_value_count: boundedArrayCount(value.unsupported_contact_phone_values, 30),
    unsupported_contact_phone_relation_count: boundedArrayCount(value.unsupported_contact_phone_relations, 30),
    contact_email_claim_count: Number.isFinite(Number(value.contact_email_claim_count))
      ? Number(value.contact_email_claim_count)
      : undefined,
    contact_email_relation_checked: value.contact_email_relation_checked === true,
    unsupported_contact_email_value_count: boundedArrayCount(value.unsupported_contact_email_values, 30),
    unsupported_contact_email_relation_count: boundedArrayCount(value.unsupported_contact_email_relations, 30),
    unsupported_contact_date_value_count: boundedArrayCount(value.unsupported_contact_date_values, 30),
    expected_contact_check_cadence_present: typeof value.expected_contact_check_cadence === "string",
    contact_check_cadence_expected_present: typeof value.contact_check_cadence_expected === "string",
    contact_check_cadence_claim_count: boundedArrayCount(value.contact_check_cadence_claims, 8),
    unsupported_contact_check_cadence_count: boundedArrayCount(value.unsupported_contact_check_cadences, 8),
    contact_check_cadence_validated: value.contact_check_cadence_validated === true,
    supporting_source_ids: sanitizeTraceStringList(value.supporting_source_ids, 100),
    source_count: Number.isFinite(Number(value.source_count)) ? Number(value.source_count) : undefined,
    supporting_source_id: typeof value.supporting_source_id === "string" ? value.supporting_source_id : undefined,
    supporting_source_count: Number.isFinite(Number(value.supporting_source_count))
      ? Number(value.supporting_source_count)
      : undefined,
    requested_metric_contract_checked: value.requested_metric_contract_checked === true,
    requested_metric_recovery: value.requested_metric_recovery === true,
    recovery_original_reason: ["requested_metric_unexpected_numeric_claim", "requested_metric_relation_mismatch"].includes(value.recovery_original_reason)
      ? value.recovery_original_reason : undefined,
    requested_metric_missing_slot_index: Number.isInteger(value.requested_metric_missing_slot_index) &&
      value.requested_metric_missing_slot_index >= 1 && value.requested_metric_missing_slot_index <= 6
      ? value.requested_metric_missing_slot_index : undefined,
    requested_metric_relation_diagnostics: (Array.isArray(value.requested_metric_relation_diagnostics)
      ? value.requested_metric_relation_diagnostics : []).slice(0, 6).map(entry => ({
      claim_index: Number.isInteger(entry?.claim_index) && entry.claim_index >= 0 && entry.claim_index <= 255
        ? entry.claim_index : null,
      required_term_count: Number.isInteger(entry?.required_term_count) && entry.required_term_count >= 0 && entry.required_term_count <= 8
        ? entry.required_term_count : null,
      matched_term_count: Number.isInteger(entry?.matched_term_count) && entry.matched_term_count >= 0 && entry.matched_term_count <= 8
        ? entry.matched_term_count : null,
      minimum_terms_matched: entry?.minimum_terms_matched === true,
      required_modifiers_matched: entry?.required_modifiers_matched === true,
      unique_relation_bound: entry?.unique_relation_bound === true,
      ...(typeof entry?.named_scope_bound === "boolean" ? { named_scope_bound: entry.named_scope_bound } : {}),
      ...(typeof entry?.age_scope_bound === "boolean" ? { age_scope_bound: entry.age_scope_bound } : {}),
      ...(typeof entry?.observation_year_bound === "boolean" ? { observation_year_bound: entry.observation_year_bound } : {})
    })),
    requested_fact_slot_contract_checked: value.requested_fact_slot_contract_checked === true,
    requested_qualitative_contract_checked: value.requested_qualitative_contract_checked === true,
    requested_metric_slot_count: Number.isFinite(Number(value.requested_metric_slot_count))
      ? Number(value.requested_metric_slot_count)
      : undefined,
    requested_qualitative_slot_count: Number.isFinite(Number(value.requested_qualitative_slot_count))
      ? Number(value.requested_qualitative_slot_count)
      : undefined,
    requested_fact_requested_slot_count: Number.isFinite(Number(value.requested_fact_requested_slot_count))
      ? Number(value.requested_fact_requested_slot_count)
      : undefined,
    requested_fact_covered_slot_count: Number.isFinite(Number(value.requested_fact_covered_slot_count))
      ? Number(value.requested_fact_covered_slot_count)
      : undefined,
    requested_fact_missing_slot_indexes: Array.isArray(value.requested_fact_missing_slot_indexes)
      ? value.requested_fact_missing_slot_indexes.map(Number).filter(Number.isInteger).slice(0, 12)
      : [],
    requested_fact_answer_missing_slot_indexes: Array.isArray(value.requested_fact_answer_missing_slot_indexes)
      ? value.requested_fact_answer_missing_slot_indexes.map(Number).filter(Number.isInteger).slice(0, 12)
      : [],
    requested_fact_answer_unit_count: Number.isFinite(Number(value.requested_fact_answer_unit_count))
      ? Number(value.requested_fact_answer_unit_count)
      : undefined,
    ...(Array.isArray(value.requested_fact_qualitative_gate_checks)
      ? { requested_fact_qualitative_gate_checks: projectQualitativeGateChecks(value.requested_fact_qualitative_gate_checks) }
      : {}),
    requested_fact_qualitative_slot_bindings: Array.isArray(value.requested_fact_qualitative_slot_bindings)
      ? value.requested_fact_qualitative_slot_bindings.slice(0, 12).map(binding => ({
          slot_index: Number.isFinite(Number(binding?.slot_index)) ? Number(binding.slot_index) : null,
          unit_index: Number.isFinite(Number(binding?.unit_index)) ? Number(binding.unit_index) : null,
          matched_relation_term_count: boundedArrayCount(binding?.matched_relation_terms, 8),
          matched_evidence_anchor_count: boundedArrayCount(binding?.matched_evidence_anchors, 8),
          substantive_answer_token_count: boundedArrayCount(binding?.substantive_answer_tokens, 12),
          required_numeric_value_count: boundedArrayCount(binding?.required_numeric_values, 8),
          action_object_binding_count: boundedArrayCount(binding?.action_object_bindings, 8),
          action_object_bindings: (Array.isArray(binding?.action_object_bindings)
            ? binding.action_object_bindings
            : []).slice(0, 8).map((actionBinding, bindingIndex) => ({
            binding_index: bindingIndex + 1,
            clause_index: Number.isFinite(Number(actionBinding?.clause_index))
              ? Number(actionBinding.clause_index)
              : null,
            expected_action_family: allowedActionFamilies.has(actionBinding?.expected_action_family)
              ? actionBinding.expected_action_family
              : null,
            answer_action_family: allowedActionFamilies.has(actionBinding?.answer_action_family)
              ? actionBinding.answer_action_family
              : null,
            action_category: allowedActionCategories.has(actionBinding?.action_category)
              ? actionBinding.action_category
              : null,
            answer_negated: actionBinding?.answer_negated === true,
            matched_object_count: Number.isFinite(Number(actionBinding?.matched_object_count))
              ? Math.max(0, Math.min(8, Number(actionBinding.matched_object_count)))
              : null,
            required_object_count: Number.isFinite(Number(actionBinding?.required_object_count))
              ? Math.max(0, Math.min(8, Number(actionBinding.required_object_count)))
              : null
          })).filter(actionBinding =>
            actionBinding.expected_action_family && actionBinding.answer_action_family && actionBinding.action_category
          )
        }))
      : [],
    requested_fact_metric_missing_slot_index: Number.isFinite(Number(value.requested_fact_metric_missing_slot_index))
      ? Number(value.requested_fact_metric_missing_slot_index)
      : undefined,
    requested_fact_metric_slot_bindings: Array.isArray(value.requested_fact_metric_slot_bindings)
      ? value.requested_fact_metric_slot_bindings.slice(0, 6).map(binding => ({
          slot_index: Number.isFinite(Number(binding?.slot_index)) ? Number(binding.slot_index) : null,
          value_type: truncateTraceString(binding?.value_type, 40),
          claim_index: Number.isFinite(Number(binding?.claim_index)) ? Number(binding.claim_index) : null,
          scope_value_count: boundedArrayCount(binding?.scope_values, 4),
          bound_scope_value_count: boundedArrayCount(binding?.bound_scope_values, 4)
        }))
      : [],
    requested_metric_slot_bindings: Array.isArray(value.requested_metric_slot_bindings)
      ? value.requested_metric_slot_bindings.slice(0, 6).map(binding => ({
          slot_index: Number.isFinite(Number(binding?.slot_index)) ? Number(binding.slot_index) : null,
          value_type: truncateTraceString(binding?.value_type, 40),
          claim_index: Number.isFinite(Number(binding?.claim_index)) ? Number(binding.claim_index) : null,
          ...(Array.isArray(binding?.claim_indexes) ? { claim_indexes: binding.claim_indexes.filter(index => Number.isSafeInteger(index) && index >= 0 && index <= 511).slice(0, 12) } : {}),
          matched_relation_term_count: boundedArrayCount(binding?.matched_relation_terms, 8),
          ...Object.fromEntries(["named_scope_bound", "age_scope_bound", "observation_year_bound"]
            .filter(key => typeof binding?.[key] === "boolean").map(key => [key, binding[key]]))
        }))
      : [],
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

function sanitizeConversationalRecoveryTrace(value = null) {
  if (!value || typeof value !== "object") return null;
  return Object.fromEntries(Object.entries({
    version: value.version === "conversational_recovery_v1"
      ? "conversational_recovery_v1"
      : undefined,
    active: value.active === true,
    action: truncateTraceString(value.action, 40),
    trigger: truncateTraceString(value.trigger, 80),
    reason: truncateTraceString(value.reason, 100),
    target: truncateTraceString(value.target, 40),
    missing_fields: sanitizeTraceStringList(value.missing_fields, 4),
    reply_source: truncateTraceString(value.reply_source, 40),
    question_asked: value.question_asked === true,
    model_call_count: Number.isFinite(Number(value.model_call_count))
      ? Math.max(0, Math.trunc(Number(value.model_call_count)))
      : undefined,
    additional_model_call_count: Number.isFinite(Number(value.additional_model_call_count))
      ? Math.max(0, Math.trunc(Number(value.additional_model_call_count)))
      : undefined,
    external_knowledge_allowed: value.external_knowledge_allowed === true,
    technical_status_allowed: value.technical_status_allowed === true,
    clarification_guard: truncateTraceString(value.clarification_guard, 60),
    correction_hint_count: Array.isArray(value.correction_hints)
      ? Math.min(2, value.correction_hints.length)
      : 0
  }).filter(([, item]) => typeof item !== "undefined"));
}

function sanitizeTemporalDevelopmentContextTrace(value = null) {
  if (!value || typeof value !== "object" || value.version !== "temporal_development_context_v1") {
    return null;
  }
  const finiteInteger = input => Number.isFinite(Number(input))
    ? Math.max(0, Math.trunc(Number(input)))
    : undefined;
  return Object.fromEntries(Object.entries({
    version: "temporal_development_context_v1",
    attempted: value.attempted === true,
    expansion_document_count: finiteInteger(value.expansion_document_count),
    primary_source_id: truncateTraceString(value.primary_source_id, 300),
    primary_original_body_count: finiteInteger(value.primary_original_body_count),
    primary_body_hashes: sanitizeTraceStringList(value.primary_body_hashes, 16),
    primary_candidate_body_hashes: sanitizeTraceStringList(value.primary_candidate_body_hashes, 16),
    primary_development_span_found: value.primary_development_span_found === true,
    companion_seed_source_id: truncateTraceString(value.companion_seed_source_id, 300),
    companion_seed_body_hashes: sanitizeTraceStringList(value.companion_seed_body_hashes, 16),
    companion_source_id: truncateTraceString(value.companion_source_id, 300),
    companion_body_hashes: sanitizeTraceStringList(value.companion_body_hashes, 16),
    companion_development_span_found: value.companion_development_span_found === true,
    companion_replacement_index: finiteInteger(value.companion_replacement_index),
    companion_existing_evidence_preserved: value.companion_existing_evidence_preserved === true,
    protected_annual_source_count: finiteInteger(value.protected_annual_source_count),
    aggregate_row_count_before: finiteInteger(value.aggregate_row_count_before),
    aggregate_row_count_after: finiteInteger(value.aggregate_row_count_after),
    aggregate_rows_preserved: value.aggregate_rows_preserved === true,
    accepted: value.accepted === true,
    reason: truncateTraceString(value.reason, 100),
    topic_terms: sanitizeTraceStringList(value.topic_terms, 12)
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
    reason_count: Array.isArray(value.reasons) ? value.reasons.length : 0,
    reasons_omitted: Math.max(0, (Array.isArray(value.reasons) ? value.reasons.length : 0) - 20),
    decision: projectIdentityDecision(value.decision),
    duration_ms: Number.isFinite(Number(value.durationMs)) ? Number(value.durationMs) : undefined,
    candidates: Array.isArray(value.candidates)
      ? value.candidates.slice(0, 5).map((candidate = {}) => ({
          document_id: truncateTraceString(candidate.documentId, 240),
          title: truncateTraceString(candidate.title, 240),
          score: Number.isFinite(Number(candidate.score)) ? Number(candidate.score) : undefined,
          identity_matched: candidate.identityMatched === true,
          author_matched: candidate.authorMatched === true,
          source_compatible: candidate.sourceCompatible === true,
          source_year_compatible: candidate.sourceYearCompatible === true,
          resolved_source_year: candidate.resolvedSourceYear ?? null,
          source_year_matches: sanitizeTraceStringList(candidate.sourceYearMatches, 8),
          subject_match_count: Array.isArray(candidate.subjectMatches) ? candidate.subjectMatches.length : 0,
          body_subject_match_count: Array.isArray(candidate.bodySubjectMatches) ? candidate.bodySubjectMatches.length : 0,
          research_or_journal: candidate.researchOrJournal === true,
          subject_terms: sanitizeTraceStringList(candidate.subjectMatches, 12),
          body_subject_terms: sanitizeTraceStringList(candidate.bodySubjectMatches, 12)
        }))
      : []
  }).filter(([, item]) => typeof item !== "undefined"));
}

function sanitizeLemmaFtsShadowTrace(value = null) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.version !== "lemma_fts_shadow_trace_v1"
  ) return null;
  const boundedCount = candidate => {
    if (candidate === null || typeof candidate === "undefined") return null;
    const number = Number(candidate);
    return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : null;
  };
  const observations = (Array.isArray(value.observations) ? value.observations : [])
    .slice(0, 12)
    .map(observation => {
      if (!observation || typeof observation !== "object" || Array.isArray(observation)) return null;
      const topCandidates = (Array.isArray(observation.top_candidates)
        ? observation.top_candidates
        : [])
        .slice(0, 12)
        .map((candidate, index) => ({
          chunk_id: truncateTraceString(candidate?.chunk_id, 240),
          document_id: truncateTraceString(candidate?.document_id, 240),
          rank: boundedCount(candidate?.rank) ?? index + 1
        }))
        .filter(candidate => candidate.chunk_id || candidate.document_id);
      return Object.fromEntries(Object.entries({
        version: observation.version === "lemma_fts_shadow_v1"
          ? "lemma_fts_shadow_v1"
          : undefined,
        enabled: observation.enabled === true,
        index_ready: observation.index_ready === true,
        executed: observation.executed === true,
        scheduled: observation.scheduled === true,
        execution_mode: ["async_shadow", "async_cached"].includes(observation.execution_mode)
          ? observation.execution_mode
          : undefined,
        reason: truncateTraceString(observation.reason, 80),
        query_language: ["et", "en", "ru", "unknown"].includes(observation.query_language)
          ? observation.query_language
          : "unknown",
        query_input_form: observation.query_input_form === "retrieval_query"
          ? "retrieval_query"
          : undefined,
        analyzer_version: truncateTraceString(observation.analyzer_version, 80),
        query_token_count: boundedCount(observation.query_token_count),
        candidate_count: boundedCount(observation.candidate_count),
        production_result_count: boundedCount(observation.production_result_count),
        chunk_overlap_count: boundedCount(observation.chunk_overlap_count),
        document_overlap_count: boundedCount(observation.document_overlap_count),
        top_candidates: topCandidates,
        analysis_ms: Number.isFinite(Number(observation.analysis_ms))
          ? Number(observation.analysis_ms)
          : undefined,
        query_ms: Number.isFinite(Number(observation.query_ms))
          ? Number(observation.query_ms)
          : undefined,
        total_ms: Number.isFinite(Number(observation.total_ms))
          ? Number(observation.total_ms)
          : undefined,
        background_total_ms: Number.isFinite(Number(observation.background_total_ms))
          ? Number(observation.background_total_ms)
          : undefined
      }).filter(([, item]) => typeof item !== "undefined"));
    })
    .filter(Boolean);
  return {
    version: "lemma_fts_shadow_trace_v1",
    decision_mode: value.decision_mode === "shadow_only" ? "shadow_only" : "unknown",
    production_path_changed: value.production_path_changed === true,
    observations
  };
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
    "lemma_fts_shadow_ms",
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

function sanitizeClaimSupportGraph(value = []) {
  return (Array.isArray(value) ? value : [])
    .map(claim => ({
      claim_id: /^claim_\d{1,3}$/u.test(String(claim?.claim_id || ""))
        ? String(claim.claim_id)
        : null,
      claim_hash: /^[a-f0-9]{8}$/u.test(String(claim?.claim_hash || ""))
        ? String(claim.claim_hash)
        : null,
      supporting_source_ids: uniqueTraceIds(claim?.supporting_source_ids).slice(0, 40)
    }))
    .filter(claim => claim.claim_id && claim.claim_hash)
    .slice(0, 64);
}

function sanitizePackageSectionAttribution(value = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const sectionIds = Object.fromEntries(
    Object.entries(value.used_section_source_ids && typeof value.used_section_source_ids === "object"
      ? value.used_section_source_ids
      : {})
      .slice(0, 8)
      .map(([section, ids]) => [String(section).slice(0, 40), uniqueTraceIds(ids).slice(0, 40)])
      .filter(([section, ids]) => section && ids.length)
  );
  return {
    version: "package_section_attribution_v1",
    requested_sections: uniqueTraceIds(value.requested_sections).slice(0, 8),
    used_sections: Object.keys(sectionIds),
    used_section_source_ids: sectionIds,
    displayed_source_ids: uniqueTraceIds(value.displayed_source_ids).slice(0, 40)
  };
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
  const modelContextIds = uniqueTraceIds(attribution?.model_context_source_ids || selectedIds);
  const validatedSupportingIds = uniqueTraceIds(attribution?.validated_supporting_source_ids || []);
  const claimSupportedIds = uniqueTraceIds(attribution?.claim_supported_source_ids || []);
  const filteredOutIds = uniqueTraceIds(attribution?.filtered_out_source_ids || []);
  const displayedNotInSelected = traceIdDifference(displayedIds, selectedIds);
  const displayedNotInAnswer = traceIdDifference(displayedIds, answerIds);

  return {
    selected_source_count: selectedIds.length,
    answer_source_count: answerIds.length,
    displayed_source_count: displayedIds.length,
    model_context_source_count: modelContextIds.length,
    validated_supporting_source_count: validatedSupportingIds.length,
    claim_supported_source_count: claimSupportedIds.length,
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
    temporal_claim_contract: value.temporal_claim_contract?.version === "temporal_claim_contract_v1"
      ? {
          version: "temporal_claim_contract_v1",
          target_years: Array.isArray(value.temporal_claim_contract.target_years)
            ? value.temporal_claim_contract.target_years
              .map(item => Number(item))
              .filter(item => Number.isInteger(item) && item >= 1900 && item <= 2100)
              .slice(0, 8)
            : [],
          evidence_rows: Array.isArray(value.temporal_claim_contract.evidence_rows)
            ? value.temporal_claim_contract.evidence_rows.slice(0, 48).map(row => Object.fromEntries(Object.entries({
                year: Number.isInteger(Number(row?.year)) ? Number(row.year) : undefined,
                value: truncateTraceString(row?.value, 40),
                percentage: row?.percentage === true,
                source_id: truncateTraceString(row?.source_id, 180)
              }).filter(([, item]) => typeof item !== "undefined")))
            : [],
          aggregate_period_rows: Array.isArray(value.temporal_claim_contract.aggregate_period_rows)
            ? value.temporal_claim_contract.aggregate_period_rows.slice(0, 48).map(row => Object.fromEntries(Object.entries({
                period_start_year: Number.isInteger(Number(row?.period_start_year)) ? Number(row.period_start_year) : undefined,
                period_end_year: Number.isInteger(Number(row?.period_end_year)) ? Number(row.period_end_year) : undefined,
                value: truncateTraceString(row?.value, 40),
                percentage: row?.percentage === true,
                source_id: truncateTraceString(row?.source_id, 180),
                metric_tokens: stringList(row?.metric_tokens, 6),
                evidence_unit: truncateTraceString(row?.evidence_unit, 640)
              }).filter(([, item]) => typeof item !== "undefined")))
            : [],
          supplemental_source_scopes: Array.isArray(value.temporal_claim_contract.supplemental_source_scopes)
            ? value.temporal_claim_contract.supplemental_source_scopes.slice(0, 3).map(scope => Object.fromEntries(Object.entries({
                relation: truncateTraceString(scope?.relation, 80),
                document_id: truncateTraceString(scope?.document_id, 240),
                source_id: truncateTraceString(scope?.source_id, 180),
                publication_year: Number.isInteger(Number(scope?.publication_year)) ? Number(scope.publication_year) : undefined,
                title: truncateTraceString(scope?.title, 240),
                evidence_units: stringList(scope?.evidence_units, 2).map(unit => truncateTraceString(unit, 480))
              }).filter(([, item]) => typeof item !== "undefined")))
            : [],
          qualitative_context_requested: value.temporal_claim_contract.qualitative_context_requested === true,
          missing_years: Array.isArray(value.temporal_claim_contract.missing_years)
            ? value.temporal_claim_contract.missing_years
              .map(item => Number(item))
              .filter(item => Number.isInteger(item) && item >= 1900 && item <= 2100)
              .slice(0, 8)
            : []
        }
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
          temporal_target_year_count: Number.isFinite(Number(value.trace_summary.temporal_target_year_count)) ? Number(value.trace_summary.temporal_target_year_count) : undefined,
          temporal_evidence_row_count: Number.isFinite(Number(value.trace_summary.temporal_evidence_row_count)) ? Number(value.trace_summary.temporal_evidence_row_count) : undefined,
          temporal_aggregate_period_row_count: Number.isFinite(Number(value.trace_summary.temporal_aggregate_period_row_count)) ? Number(value.trace_summary.temporal_aggregate_period_row_count) : undefined,
          temporal_supplemental_source_scope_count: Number.isFinite(Number(value.trace_summary.temporal_supplemental_source_scope_count)) ? Number(value.trace_summary.temporal_supplemental_source_scope_count) : undefined,
          temporal_missing_year_count: Number.isFinite(Number(value.trace_summary.temporal_missing_year_count)) ? Number(value.trace_summary.temporal_missing_year_count) : undefined,
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
  const requestedFactSlotContractTrace = sanitizeRequestedMetricContractTrace(
    retrievalMeta?.requestedFactSlotContract
  );
  const requestedQualitativeSlotContractTrace = sanitizeRequestedQualitativeContractTrace(
    retrievalMeta?.requestedQualitativeSlotContract
  );
  const packageSectionAttribution = sanitizePackageSectionAttribution(
    attribution?.package_section_attribution
  );
  const factValidationTrace = sanitizeFactValidationTrace(retrievalMeta?.factValidation);
  const conversationalRecoveryTrace = sanitizeConversationalRecoveryTrace(
    retrievalMeta?.conversationalRecovery
  );
  const temporalDevelopmentContextTrace = sanitizeTemporalDevelopmentContextTrace(
    retrievalMeta?.temporalDevelopmentContext
  );
  const answerValidationContractShadow = sanitizeAnswerValidationContractShadow(
    queryPlan?.answer_validation_contract_shadow,
    retrievalMeta?.factValidationContractShadow,
    attribution?.sourceAttributionContractShadow,
    retrievalMeta?.currentTurnAuthorConfirmation
  );
  const documentIdentityTrace = sanitizeDocumentIdentityTrace(retrievalMeta?.documentIdentityEvidence);
  const lemmaFtsShadowTrace = sanitizeLemmaFtsShadowTrace(retrievalMeta?.lemmaFtsShadow);
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
    trace_contract: {
      version: "rag_trace_layers_v1",
      layer: "server_runtime_trace",
      source_layer: null,
      projection: "unprojected_runtime",
      downstream_layers: {
        database_projection: "assistant_message.metadata.rag_trace",
        audit_normalization: "derived_audit_artifact_must_declare_source_layer",
        ui_observation: "independent_visible_ui_evidence"
      }
    },
    diagnostic_runtime: retrievalMeta?.diagnosticRuntime || null,
    question_requirements_shadow: projectQuestionRequirementsShadow(retrievalMeta?.questionRequirementsShadow),
    history_selection: projectDiagnosticHistory(retrievalMeta?.diagnosticHistory),
    diagnostic_turn_id: retrievalMeta?.diagnosticTurnId || null,
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
    model_context_source_ids: uniqueTraceIds(attribution?.model_context_source_ids || selectedContextSourceIds),
    validated_supporting_source_ids: uniqueTraceIds(attribution?.validated_supporting_source_ids || []),
    claim_supported_source_ids: uniqueTraceIds(attribution?.claim_supported_source_ids || []),
    claim_support_graph: sanitizeClaimSupportGraph(attribution?.claim_support_graph),
    ...(Array.isArray(retrievalMeta?.selectedContextDetails)
      ? { selected_context_details: sanitizeSelectedContextDetails(retrievalMeta.selectedContextDetails) }
      : {}),
    ...(temporalDevelopmentContextTrace
      ? { temporal_development_context: temporalDevelopmentContextTrace }
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
    package_candidate_source_ids: Array.isArray(retrievalMeta?.packageAwareAnswering?.packageCandidateSourceIds)
      ? retrievalMeta.packageAwareAnswering.packageCandidateSourceIds
      : [],
    package_displayed_source_ids: attribution?.package_used_section_source_ids || [],
    package_requested_sections: Array.isArray(retrievalMeta?.packageAwareAnswering?.requestedSections)
      ? retrievalMeta.packageAwareAnswering.requestedSections
      : [],
    ...(packageSectionAttribution ? { package_section_attribution: packageSectionAttribution } : {}),
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
    answer_source_semantics: attribution?.answer_source_semantics || "legacy_displayed_sources",
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
    ...(requestedFactSlotContractTrace
      ? { requested_fact_slot_contract: requestedFactSlotContractTrace }
      : {}),
    ...(requestedQualitativeSlotContractTrace
      ? { requested_qualitative_slot_contract: requestedQualitativeSlotContractTrace }
      : {}),
    ...(answerValidationContractShadow
      ? { answer_validation_contract_shadow: answerValidationContractShadow }
      : {}),
    ...(factValidationTrace ? { fact_validation: factValidationTrace } : {}),
    ...(conversationalRecoveryTrace
      ? { conversational_recovery: conversationalRecoveryTrace }
      : {}),
    ...(documentIdentityTrace ? { document_identity: documentIdentityTrace } : {}),
    ...(lemmaFtsShadowTrace ? { lemma_fts_shadow: lemmaFtsShadowTrace } : {}),
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
  const databaseRagTrace = ragTrace
    ? {
        ...ragTrace,
        trace_contract: {
          ...ragTrace.trace_contract,
          layer: "database_message_projection",
          source_layer: "server_runtime_trace",
          projection: "assistant_message.metadata.rag_trace"
        }
      }
    : null;
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
    ...(RAG_TRACE_V1_ENABLED ? { rag_trace: databaseRagTrace } : {})
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
    diagnostic_turn_id: ragTrace.diagnostic_turn_id,
    trace_contract: ragTrace.trace_contract,
    userId,
    role,
    isCrisis,
    retrieved_count: ragTrace.retrieved_count,
    selected_context_count: ragTrace.selected_context_count,
    retrievers_used: ragTrace.retrievers_used,
    retrieved_source_ids: ragTrace.retrieved_source_ids,
    selected_context_source_ids: ragTrace.selected_context_source_ids,
    model_context_source_ids: ragTrace.model_context_source_ids,
    validated_supporting_source_ids: ragTrace.validated_supporting_source_ids,
    claim_supported_source_ids: ragTrace.claim_supported_source_ids,
    claim_support_graph: ragTrace.claim_support_graph,
    selected_context_details: ragTrace.selected_context_details,
    source_packages: ragTrace.source_packages,
    package_aware_answering_used: ragTrace.package_aware_answering_used,
    used_package_ids: ragTrace.used_package_ids,
    missing_sections_used: ragTrace.missing_sections_used,
    package_candidate_source_ids: ragTrace.package_candidate_source_ids,
    package_displayed_source_ids: ragTrace.package_displayed_source_ids,
    package_requested_sections: ragTrace.package_requested_sections,
    package_section_attribution: ragTrace.package_section_attribution,
    package_answer_flags: ragTrace.package_answer_flags,
    package_selection_status: ragTrace.package_selection_status,
    insufficient_precise_support: ragTrace.insufficient_precise_support,
    required_evidence_sections: ragTrace.required_evidence_sections,
    package_attribution_checked: ragTrace.package_attribution_checked,
    high_risk_attribution_checked: ragTrace.high_risk_attribution_checked,
    section_attribution: ragTrace.section_attribution,
    attribution_flags: ragTrace.attribution_flags,
    answer_source_ids: ragTrace.answer_source_ids,
    answer_source_semantics: ragTrace.answer_source_semantics,
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
    requested_fact_slot_contract: ragTrace.requested_fact_slot_contract,
    requested_qualitative_slot_contract: ragTrace.requested_qualitative_slot_contract,
    answer_validation_contract_shadow: ragTrace.answer_validation_contract_shadow,
    fact_validation: ragTrace.fact_validation,
    conversational_recovery: ragTrace.conversational_recovery,
    query_plan: ragTrace.query_plan,
    hybrid_retrieval: ragTrace.hybrid_retrieval,
    retrieval_trace_level: ragTrace.retrieval_trace_level
  });
}

function resolveDisplayedSources(originalSources, attribution, factValidation = null, reply = "") {
  if (factValidation?.response_decision) return hasValidatedPublication(factValidation, reply) ? attribution?.displayedSources || [] : [];
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
  const requestedMetricContract = retrievalMeta?.requestedFactSlotContract || retrievalMeta?.requestedMetricContract;
  const validatedRequestedMetricContract =
    (
      factValidation?.requested_fact_slot_contract_checked === true ||
      factValidation?.requested_metric_contract_checked === true
    ) &&
    requestedMetricContract &&
    typeof requestedMetricContract === "object"
      ? {
          ...requestedMetricContract,
          used_for_validation: true
        }
      : requestedMetricContract;
  const requestedQualitativeContract = retrievalMeta?.requestedQualitativeSlotContract;
  const validatedRequestedQualitativeContract =
    factValidation?.requested_qualitative_contract_checked === true &&
    requestedQualitativeContract &&
    typeof requestedQualitativeContract === "object"
      ? {
          ...requestedQualitativeContract,
          used_for_validation: true
        }
      : requestedQualitativeContract;
  return {
    ...(retrievalMeta && typeof retrievalMeta === "object" ? retrievalMeta : {}),
    ...(validatedRequestedMetricContract
      ? {
          requestedFactSlotContract: validatedRequestedMetricContract,
          requestedMetricContract: validatedRequestedMetricContract
        }
      : {}),
    ...(validatedRequestedQualitativeContract
      ? { requestedQualitativeSlotContract: validatedRequestedQualitativeContract }
      : {}),
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

function withConversationalRecovery(retrievalMeta, recovery, performanceTimings = null) {
  if (!recovery && !performanceTimings) return retrievalMeta;
  return {
    ...(retrievalMeta && typeof retrievalMeta === "object" ? retrievalMeta : {}),
    ...(recovery ? { conversationalRecovery: recovery } : {}),
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

function withRecoveryWorkflowMetadata(metadataExtra, recovery) {
  const recoveryState = recoveryWorkflow(recovery);
  if (!recoveryState) return metadataExtra;
  return {
    ...(metadataExtra && typeof metadataExtra === "object" ? metadataExtra : {}),
    workflow: {
      ...(metadataExtra?.workflow && typeof metadataExtra.workflow === "object"
        ? metadataExtra.workflow
        : {}),
      ...recoveryState
    }
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
    diagnosticRef: replay?.id ? `message:${replay.id}` : null,
    reply: String(replay?.content || ""),
    sources: Array.isArray(metadata.sources) ? metadata.sources : [],
    displayedSources: Array.isArray(metadata.displayed_sources) ? metadata.displayed_sources : null,
    ragTrace: metadata.rag_trace || null,
    attributionDecisions: Array.isArray(metadata.attribution_decisions) ? metadata.attribution_decisions : null,
    attachments: Array.isArray(metadata.attachments) ? metadata.attachments : [],
    cards: Array.isArray(metadata.cards) ? metadata.cards : [],
    workflow: metadata.workflow && typeof metadata.workflow === "object" ? metadata.workflow : null,
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

export async function handleMainChatResponse(input, deps = {}) {
  let streamOwnsHeartbeat = false;
  try {
    const response = await handleMainChatResponseImpl(input, deps);
    streamOwnsHeartbeat = response?.ok === true && response.headers?.get("content-type")?.includes("text/event-stream");
    if (response?.ok === false) await input.onAttemptFailure?.("model", "unhandled_failure");
    return response;
  } finally {
    if (!streamOwnsHeartbeat) input.ragAttemptController?.stop();
  }
}

async function handleMainChatResponseImpl({
  req,
  wantStream,
  persist,
  convId,
  userId,
  normalizedRole,
  effectiveMessage,
  ragContractMessage = null,
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
  sessionTurnLimit = null,
  expectedRecoveryAssistantMessageId = null,
  recoveryRootUserMessageId = null,
  claimedTurn = null,
  ragAttemptController = null,
  onAttemptFailure = null
}, deps = {}) {
  let modelCallIndex = 0;
  const observeModel = async (observation, index) => {
    const runtime = projectAttemptRuntime(observation);
    if (runtime.prompt_hash) delete retrievalMeta.diagnosticRuntime.actual_model;
    Object.assign(retrievalMeta.diagnosticRuntime, runtime);
    if (ragAttemptController && !await ragAttemptController.stage("model", { runtime, modelCall: { index, runtime } })) throw staleAttemptError();
  };
  const callProvider = async input => {
    const index = ++modelCallIndex;
    if (ragAttemptController && !await ragAttemptController.stage("model")) throw staleAttemptError();
    try { return await (deps.callOpenAI || callOpenAI)({ ...input, onRuntimeObservation: observation => observeModel(observation, index) }); }
    catch (error) {
      await ragAttemptController?.stage("model", { failure: { stage: "model", code: input.signal?.aborted ? "request_cancelled" : "model_failed" } });
      throw error;
    }
  };
  const streamProvider = async input => {
    const index = ++modelCallIndex;
    if (ragAttemptController && !await ragAttemptController.stage("model")) throw staleAttemptError();
    return (deps.streamOpenAI || streamOpenAI)({ ...input, onRuntimeObservation: observation => observeModel(observation, index) });
  };
  const finalizeReply = async (input, options = {}) => {
    try {
      return await (deps.finalizeAssistantReply || finalizeAssistantReply)({ ...input,
        attemptNumber: ragAttemptController?.fence.attempt || null,
        ragAttempt: ragAttemptController?.fence || null }, { ...options, persistDone: completeTurnPersistence });
    } finally { ragAttemptController?.stop(); }
  };
  const initializePersistence = deps.persistInit || persistInit;
  // SOL-CHAT-05: terminalmarker peab olema süstitav — piir, mida ei saa testida, ei ole piir.
  const completeTurnPersistence = (input, options = {}) => persistAttemptTerminal(input, {
    controller: ragAttemptController, persist: deps.persistDone || persistDone, onFailure: onAttemptFailure
  }, options);
  const turnStartedAtMs = Number.isFinite(Number(requestStartedAtMs))
    ? Number(requestStartedAtMs)
    : performance.now();
  const evidenceMessage = String(ragContractMessage || effectiveMessage).trim() || effectiveMessage;
  const claimTurn = deps.claimChatTurn
    || (input => claimChatTurn(input, { writeUserTurn }));
  let turnId = claimedTurn?.id || null;
  let persistedUserMessageId = claimedTurn?.userMessageId || null;
  if (persist && convId && userId && !claimedTurn) {
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
        sessionTurnLimit,
        expectedPreviousAssistantMessageId: expectedRecoveryAssistantMessageId
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
        persistedUserMessageId = claim.turn?.userMessageId || null;
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

  // Request-scoped observation only: never change prompts or retrieval choices.
  retrievalMeta = {
    ...(retrievalMeta || {}),
    diagnosticTurnId: turnId,
    diagnosticRuntime: {
      configured_model: DEFAULT_MODEL,
      release_sha: process.env.RAG_BUILD_SHA || null,
      build_id: process.env.RAG_BUILD_ID || null,
      validator_version: FACT_VALIDATOR_VERSION,
      question_contract_version: retrievalMeta?.questionRequirementsShadow?.version || null,
      question_contract_hash: retrievalMeta?.questionRequirementsShadow?.contract_hash || null,
      history_message_count: Array.isArray(history) ? history.length : 0
    }
  };
  await ragAttemptController?.stage("context", { runtime: retrievalMeta.diagnosticRuntime });
  const factValidationContractShadow = buildFactValidationContractShadow({
    message: evidenceMessage,
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
  const deterministicAuthorReply = typeof retrievalMeta?.deterministicAuthorReply === "string"
    ? retrievalMeta.deterministicAuthorReply.trim()
    : "";
  const groupValidation = !isCrisis && !wantsDocumentDownload
    ? validateGroupFactReply({ retrievalMeta, sources, replyLang }) : null;
  const deterministicGroupTurn = hasValidatedPublication(groupValidation?.trace, groupValidation?.reply);
  const deterministicReply = deterministicGroupTurn ? groupValidation.reply : deterministicAuthorReply || deterministicContactReply;
  const deterministicAuthorTurn = retrievalMeta?.structuredAuthorCorpusTurn === true && !!deterministicAuthorReply;
  if (
    !isCrisis &&
    (
      deterministicGroupTurn || deterministicAuthorTurn ||
      retrievalMeta?.structuredContactRegistryTurn === true ||
      retrievalMeta?.structuredContactMissingMunicipalityTurn === true ||
      retrievalMeta?.structuredContactMonitorTurn === true
    ) &&
    deterministicReply
  ) {
    const validationStartedAt = performance.now();
    const factValidation = deterministicGroupTurn ? groupValidation : deterministicAuthorTurn
      ? null
      : validateExactFactAnswer({
          message: evidenceMessage,
          reply: deterministicReply,
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
    const validationRecovery = deterministicAuthorTurn && !deterministicGroupTurn
      ? { reply: deterministicReply, recovery: null }
      : resolveValidationRecovery({
          providerReply: deterministicReply,
          fallbackReply: factValidation?.reply || deterministicReply,
          userMessage: evidenceMessage,
          replyLang,
          validationTrace: factValidation?.trace,
          modelCallCount: 0,
          rootUserMessageId: recoveryRootUserMessageId || persistedUserMessageId
        });
    const reply = validationRecovery.reply;
    const deterministicRetrievalMeta = withFactValidationContractShadow(
      retrievalMeta,
      factValidationContractShadow,
      true
    );
    const validatedRetrievalMeta = withFactValidation(deterministicRetrievalMeta, factValidation?.trace, {
      first_model_call_ms: 0,
      model_ms: 0,
      fact_validation_ms: factValidationDurationMs
    });
    const responseRetrievalMeta = withConversationalRecovery(
      validatedRetrievalMeta,
      validationRecovery.recovery
    );
    const workflow = recoveryWorkflow(validationRecovery.recovery);
    const attribution = await buildFinalSourceAttribution(reply, sources, {
      query: retrievalMeta?.attributionQuery || evidenceMessage,
      riskPolicy: retrievalMeta?.ragRiskPolicy,
      legalLookupPlan: retrievalMeta?.legalLookupPlan || retrievalMeta?.queryPlan?.legalLookupPlan,
      queryPlan: retrievalMeta?.queryPlan,
      personTopicTerms: retrievalMeta?.personTopicTerms,
      personCoauthorNames: retrievalMeta?.personCoauthorNames,
      personCoauthorRequested: retrievalMeta?.personCoauthorRequested,
      packageCandidateSourceIds: retrievalMeta?.packageAwareAnswering?.packageCandidateSourceIds,
      packageDisplayedSourceIds: retrievalMeta?.packageAwareAnswering?.packageDisplayedSourceIds,
      packageRequestedSections: retrievalMeta?.packageAwareAnswering?.requestedSections,
      packageSectionSourceIds: retrievalMeta?.packageAwareAnswering?.packageSectionSourceIds,
      requestedFactSlotSourceId: retrievalMeta?.requestedFactSlotContract?.source_id,
      packageAwareAnsweringUsed: retrievalMeta?.packageAwareAnswering?.used === true,
      municipalityContext: retrievalMeta?.municipalityContext,
      documentIdentityEvidence: retrievalMeta?.documentIdentityEvidence,
      authorCorpusEvidence: retrievalMeta?.authorCorpusEvidence,
      factValidation: factValidation?.trace,
      contactInventoryValidatedSourceIds:
        factValidation?.trace?.passed === true && (
          factValidation?.trace?.contact_inventory_checked === true ||
          factValidation?.trace?.contact_monitor_checked === true
        )
          ? factValidation.trace.supporting_source_ids
          : []
    });
    const replySources = resolveDisplayedSources(sources, attribution, factValidation?.trace, reply);
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
      metadataExtra: buildAttributionMetadata(
        withRecoveryWorkflowMetadata(metadataExtra, validationRecovery.recovery),
        sources,
        attribution,
        responseRetrievalMeta
      ),
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
        logError("chat.persist.not_durable", {
          branch: deterministicGroupTurn ? "deterministic_group_fact" : deterministicAuthorTurn ? "deterministic_author_corpus" : "deterministic_contact",
          convId
        });
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
      diagnosticRef: persisted?.diagnosticRef,
      reply,
      sources: replySources,
      displayedSources: replySources,
      ragTrace,
      ragContract,
      attributionDecisions,
      attachments,
      cards: [],
      workflow,
      isCrisis,
      convId
    });
  }

  const socialAcknowledgementReply = !isCrisis
    ? buildSocialAcknowledgementReply(effectiveMessage, replyLang)
    : "";
  const plannedSocialScope = String(
    retrievalMeta?.queryPlan?.semantic_turn_contract?.domain_scope?.effective ||
    retrievalMeta?.queryPlan?.question_planner?.social_scope ||
    retrievalMeta?.queryPlan?.social_scope ||
    "unknown"
  ).trim();
  const socialScopeRecovery = !isCrisis &&
    !expectedRecoveryAssistantMessageId &&
    plannedSocialScope === "out_of_scope";
  const plannedSocialScopeBoundary = socialScopeRecovery && !socialAcknowledgementReply
    ? buildDeterministicSocialScopeBoundary({
        replyLang,
        scopeReason:
          retrievalMeta?.queryPlan?.question_planner?.social_scope_reason ||
          retrievalMeta?.queryPlan?.social_scope_reason
      })
    : null;
  const plannedMunicipalityClarification = !isCrisis &&
    retrievalMeta?.structuredMunicipalityAmbiguityTurn === true
    ? buildDeterministicMunicipalityClarification({
        candidates: retrievalMeta?.municipalityClarificationCandidates,
        replyLang,
        rootUserMessageId: recoveryRootUserMessageId || persistedUserMessageId
      })
    : null;

  if (
    socialScopeRecovery ||
    socialAcknowledgementReply ||
    !effectiveContext ||
    !effectiveContext.trim()
  ) {
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
        previousSourceUseRequest: !!noContextMeta?.previousSourceUseRequest,
        socialScopeRecovery,
        socialAcknowledgement: !!socialAcknowledgementReply
      });
    }

    const ragSearchFailed = noContextMeta?.ragSearchFailed === true;
    let clarificationCandidate = "";
    let clarificationModelCallMs = 0;
    let clarificationModelCallCount = 0;
    let clarificationModelFailed = false;
    if (
      !plannedSocialScopeBoundary &&
      !plannedMunicipalityClarification &&
      !isCrisis &&
      !ragSearchFailed &&
      !socialAcknowledgementReply
    ) {
      clarificationModelCallCount = 1;
      const clarificationCallStartedAt = performance.now();
      try {
        const aiResult = await callProvider({
          history,
          userMessage: modelUserMessage || effectiveMessage,
          context: "",
          effectiveRole: normalizedRole,
          grounding,
          includeSources: false,
          replyLang,
          isCrisis: false,
          extraSystemInstructions: withConversationalRecoveryInstruction(
            extraSystemInstructions,
            { replyLang, phase: "no_context" }
          ),
          maxOutputTokens: 240,
          reasoningEffort: "minimal",
          usageStage: "chat_recovery",
          userId,
          role: normalizedRole,
          signal: req.signal
        });
        clarificationCandidate = String(aiResult?.reply || "").trim();
      } catch (error) {
        const wasAborted =
          req.signal?.aborted === true ||
          error?.name === "AbortError" ||
          error?.name === "APIUserAbortError";
        if (wasAborted) {
          let releasedWithMarker = false;
          if (persist && convId && userId) {
            const marker = await completeTurnPersistence({
              convId,
              userId,
              status: "ABORTED",
              turnId,
              isCrisis,
              replyLang,
              settleUsage: typeof onUsageRelease === "function"
                ? tx => onUsageRelease("chat_call_aborted", tx)
                : null
            });
            releasedWithMarker = !!marker;
          }
          if (!releasedWithMarker) {
            await settleChatUsage(
              onUsageRelease,
              logError,
              "usage.chat_release.error",
              "chat_call_aborted"
            );
          }
          return makeError("chat.error.openai_request_failed", 502, {
            code: error?.name
          });
        }
        clarificationModelFailed = true;
        if (typeof logError === "function") {
          logError("openai.recovery.error", {
            err: error?.message || String(error),
            userId,
            role: normalizedRole
          });
        }
      } finally {
        clarificationModelCallMs = Math.max(
          0,
          Math.round(performance.now() - clarificationCallStartedAt)
        );
      }
    }
    const noContextRecovery = plannedSocialScopeBoundary || plannedMunicipalityClarification || buildNoContextRecovery({
      candidateReply: clarificationCandidate,
      fallbackReply: noContextReply,
      socialAcknowledgementReply,
      userMessage: evidenceMessage,
      replyLang,
      ragSearchFailed,
      isCrisis,
      target: inferNoContextRecoveryTarget(retrievalMeta),
      modelCallCount: clarificationModelCallCount,
      modelCallFailed: clarificationModelFailed,
      rootUserMessageId: recoveryRootUserMessageId || persistedUserMessageId
    });
    const reply = noContextRecovery.reply;
    const responseRetrievalMeta = withConversationalRecovery(
      tracedRetrievalMeta,
      noContextRecovery.recovery,
      {
        first_model_call_ms: clarificationModelCallMs,
        model_ms: clarificationModelCallMs
      }
    );
    const workflow = recoveryWorkflow(noContextRecovery.recovery);

    const suppressRecoverySources = !!noContextRecovery.recovery;
    const recoveryAttributionReason = noContextRecovery.recovery?.action === "ask_clarification"
      ? "conversational_clarification"
      : noContextRecovery.recovery?.reason || noContextRecovery.recovery?.action || "non_answer_turn";
    const attribution = await buildFinalSourceAttribution(reply, sources, {
      query: retrievalMeta?.attributionQuery || evidenceMessage,
      riskPolicy: retrievalMeta?.ragRiskPolicy,
      legalLookupPlan: retrievalMeta?.legalLookupPlan || retrievalMeta?.queryPlan?.legalLookupPlan,
      queryPlan: retrievalMeta?.queryPlan,
      personTopicTerms: retrievalMeta?.personTopicTerms,
      personCoauthorNames: retrievalMeta?.personCoauthorNames,
      personCoauthorRequested: retrievalMeta?.personCoauthorRequested,
      packageCandidateSourceIds: retrievalMeta?.packageAwareAnswering?.packageCandidateSourceIds,
      packageDisplayedSourceIds: retrievalMeta?.packageAwareAnswering?.packageDisplayedSourceIds,
      packageRequestedSections: retrievalMeta?.packageAwareAnswering?.requestedSections,
      packageSectionSourceIds: retrievalMeta?.packageAwareAnswering?.packageSectionSourceIds,
      requestedFactSlotSourceId: retrievalMeta?.requestedFactSlotContract?.source_id,
      packageAwareAnsweringUsed: retrievalMeta?.packageAwareAnswering?.used === true,
      municipalityContext: retrievalMeta?.municipalityContext,
      documentIdentityEvidence: retrievalMeta?.documentIdentityEvidence,
      authorCorpusEvidence: retrievalMeta?.authorCorpusEvidence,
      factValidation: null,
      nonAnswerSourceSuppressionReason: suppressRecoverySources
        ? recoveryAttributionReason
        : null
    });
    const replySources = resolveDisplayedSources(
      sources,
      attribution,
      suppressRecoverySources
        ? { passed: false }
        : null
    );
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
      reply,
      sources: replySources,
      displayedSources: replySources,
      ragTrace,
      ragContract,
      attributionDecisions,
      attachments: [],
      cards: [],
      metadataExtra: buildAttributionMetadata(
        withRecoveryWorkflowMetadata(metadataExtra, noContextRecovery.recovery),
        sources,
        attribution,
        responseRetrievalMeta
      ),
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
      diagnosticRef: persisted?.diagnosticRef,
      reply,
      sources: replySources,
      displayedSources: replySources,
      ragTrace,
      ragContract,
      attributionDecisions,
      attachments,
      cards: [],
      workflow,
      isCrisis,
      convId
    });
  }

  const exactFactValidationEnabled = !isCrisis && shouldValidateExactFactAnswer({
    message: evidenceMessage,
    sources,
    retrievalMeta
  });
  const answerSystemInstructions = !isCrisis
    ? withConversationalRecoveryInstruction(extraSystemInstructions, {
        replyLang,
        phase: "answer_or_clarify"
      })
    : extraSystemInstructions;

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
        extraSystemInstructions: answerSystemInstructions,
        userId,
        role: normalizedRole,
        signal: req.signal
      });
      const firstModelCallDurationMs = Math.max(0, Math.round(performance.now() - modelCallStartedAt));
      const providerReply = resolveProviderReply(aiResult?.reply, { replyLang, isCrisis });
      const dynamicFactValidationEnabled = exactFactValidationEnabled || shouldValidateExactFactAnswer({
        message: evidenceMessage,
        reply: providerReply,
        sources,
        retrievalMeta
      });
      const domainBoundary = !isCrisis
        ? resolveSocialScopeBoundary(providerReply, { replyLang, modelCallCount: 1 })
        : null;
      const modelClarification = !domainBoundary && !dynamicFactValidationEnabled
        ? resolveModelClarification(providerReply, {
            userMessage: evidenceMessage,
            replyLang,
            target: inferNoContextRecoveryTarget(retrievalMeta),
            modelCallCount: 1,
            rootUserMessageId: recoveryRootUserMessageId || persistedUserMessageId
          })
        : null;
      const factValidationStartedAt = dynamicFactValidationEnabled && !domainBoundary
        ? performance.now()
        : null;
      if (dynamicFactValidationEnabled && !domainBoundary) await ragAttemptController?.stage("validation");
      let factValidation = dynamicFactValidationEnabled && !domainBoundary
        ? validateExactFactAnswer({
          message: evidenceMessage,
          reply: providerReply,
          sources,
          retrievalMeta,
          replyLang
        })
        : null;
      factValidation = recoverSupportedReplyAfterNumericValidation({
        message: evidenceMessage,
        reply: providerReply,
        validation: factValidation,
        retrievalMeta,
        sources,
        replyLang
      });
      const factValidationDurationMs = factValidationStartedAt === null
        ? null
        : Math.max(0, Math.round(performance.now() - factValidationStartedAt));
      if (factValidation?.trace) factValidation.trace.validation_duration_ms = factValidationDurationMs;
      const validationRecovery = domainBoundary || modelClarification || resolveValidationRecovery({
          providerReply,
          fallbackReply: factValidation?.reply || providerReply,
          userMessage: evidenceMessage,
          replyLang,
          validationTrace: factValidation?.trace,
          modelCallCount: 1,
          rootUserMessageId: recoveryRootUserMessageId || persistedUserMessageId
        });
      const reply = validationRecovery.reply;
      const nonAnswerSourceSuppressionReason = domainBoundary
        ? "outside_social_scope"
        : modelClarification
          ? "conversational_clarification"
          : null;
      const responseFactValidationTrace = factValidation?.trace;
      const dynamicExactFactRetrievalMeta = withFactValidationContractShadow(
        retrievalMeta,
        factValidationContractShadow,
        dynamicFactValidationEnabled
      );
      const validatedRetrievalMeta = withFactValidation(dynamicExactFactRetrievalMeta, factValidation?.trace, {
        first_model_call_ms: firstModelCallDurationMs,
        model_ms: firstModelCallDurationMs,
        ...(factValidationDurationMs === null ? {} : { fact_validation_ms: factValidationDurationMs })
      });
      const responseRetrievalMeta = withConversationalRecovery(
        validatedRetrievalMeta,
        validationRecovery.recovery
      );
      const workflow = recoveryWorkflow(validationRecovery.recovery);
      const attribution = await buildFinalSourceAttribution(reply, sources, {
        query: retrievalMeta?.attributionQuery || evidenceMessage,
        riskPolicy: retrievalMeta?.ragRiskPolicy,
        legalLookupPlan: retrievalMeta?.legalLookupPlan || retrievalMeta?.queryPlan?.legalLookupPlan,
        queryPlan: retrievalMeta?.queryPlan,
        personTopicTerms: retrievalMeta?.personTopicTerms,
        personCoauthorNames: retrievalMeta?.personCoauthorNames,
        personCoauthorRequested: retrievalMeta?.personCoauthorRequested,
        packageCandidateSourceIds: retrievalMeta?.packageAwareAnswering?.packageCandidateSourceIds,
        packageDisplayedSourceIds: retrievalMeta?.packageAwareAnswering?.packageDisplayedSourceIds,
        packageRequestedSections: retrievalMeta?.packageAwareAnswering?.requestedSections,
        packageSectionSourceIds: retrievalMeta?.packageAwareAnswering?.packageSectionSourceIds,
        requestedFactSlotSourceId: retrievalMeta?.requestedFactSlotContract?.source_id,
        packageAwareAnsweringUsed: retrievalMeta?.packageAwareAnswering?.used === true,
        municipalityContext: retrievalMeta?.municipalityContext,
        documentIdentityEvidence: retrievalMeta?.documentIdentityEvidence,
        authorCorpusEvidence: retrievalMeta?.authorCorpusEvidence,
        factValidation: responseFactValidationTrace,
        nonAnswerSourceSuppressionReason,
        contactInventoryValidatedSourceIds:
          factValidation?.trace?.passed === true && (
            factValidation?.trace?.contact_inventory_checked === true ||
            factValidation?.trace?.contact_monitor_checked === true
          )
            ? factValidation.trace.supporting_source_ids
            : []
      });
      const replySources = resolveDisplayedSources(
        sources,
        attribution,
        nonAnswerSourceSuppressionReason ? { passed: false } : responseFactValidationTrace,
        reply
      );
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
        metadataExtra: buildAttributionMetadata(
          withRecoveryWorkflowMetadata(metadataExtra, validationRecovery.recovery),
          sources,
          attribution,
          responseRetrievalMeta
        ),
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
        diagnosticRef: persisted?.diagnosticRef,
        reply,
        sources: replySources,
        displayedSources: replySources,
        ragTrace,
        ragContract,
        attributionDecisions,
        attachments,
        cards: [],
        workflow,
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
  const factBufferEnabled = !isCrisis && (
    exactFactValidationEnabled || (
      Array.isArray(sources) && sources.some(source => String(source?.evidenceText || "").trim())
    )
  );
  const factBufferStartedAt = factBufferEnabled ? performance.now() : null;
  let firstModelCallDurationMs = null;
  let modelCallStartedAtMs = null;
  let modelDurationMs = null;
  let mayEmitDelta = !factBufferEnabled;
  const sse = new ReadableStream({
    async start(controller) {
      let streamFinalized = false;
      let aborted = false;
      let abortMetadataExtra = metadataExtra;

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
            metadataExtra: abortMetadataExtra,
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
        let conversationalRecovery = null;
        const domainBoundary = !isCrisis
          ? resolveSocialScopeBoundary(accumulated, { replyLang, modelCallCount: 1 })
          : null;
        const dynamicFactValidationEnabled = !domainBoundary && (
          exactFactValidationEnabled || shouldValidateExactFactAnswer({
            message: evidenceMessage,
            reply: accumulated,
            sources,
            retrievalMeta
        })
        );
        if (domainBoundary) {
          accumulated = domainBoundary.reply;
          conversationalRecovery = domainBoundary.recovery;
          abortMetadataExtra = withRecoveryWorkflowMetadata(metadataExtra, conversationalRecovery);
          if (factBufferEnabled) {
            pendingDelta = accumulated;
            mayEmitDelta = true;
          }
        } else if (dynamicFactValidationEnabled) {
          await ragAttemptController?.stage("validation");
          const factValidationStartedAt = performance.now();
          const providerReply = accumulated;
          factValidation = validateExactFactAnswer({
            message: evidenceMessage,
            reply: providerReply,
            sources,
            retrievalMeta,
            replyLang
          });
          factValidation = recoverSupportedReplyAfterNumericValidation({
            message: evidenceMessage,
            reply: providerReply,
            validation: factValidation,
            retrievalMeta,
            sources,
            replyLang
          });
          factValidationDurationMs = Math.max(0, Math.round(performance.now() - factValidationStartedAt));
          const validationRecovery = resolveValidationRecovery({
            providerReply,
            fallbackReply: factValidation?.reply || providerReply,
            userMessage: evidenceMessage,
            replyLang,
            validationTrace: factValidation?.trace,
            modelCallCount: 1,
            rootUserMessageId: recoveryRootUserMessageId || persistedUserMessageId
          });
          accumulated = validationRecovery.reply;
          conversationalRecovery = validationRecovery.recovery;
          abortMetadataExtra = withRecoveryWorkflowMetadata(metadataExtra, conversationalRecovery);
          pendingDelta = accumulated;
          factValidation.trace.buffered_response_ms = Math.max(0, Math.round(performance.now() - factBufferStartedAt));
          factValidation.trace.validation_duration_ms = factValidationDurationMs;
          mayEmitDelta = true;
        } else {
          const modelClarification = resolveModelClarification(accumulated, {
            userMessage: evidenceMessage,
            replyLang,
            target: inferNoContextRecoveryTarget(retrievalMeta),
            modelCallCount: 1,
            rootUserMessageId: recoveryRootUserMessageId || persistedUserMessageId
          });
          if (modelClarification) {
            accumulated = modelClarification.reply;
            conversationalRecovery = modelClarification.recovery;
            abortMetadataExtra = withRecoveryWorkflowMetadata(metadataExtra, conversationalRecovery);
          }
          if (factBufferEnabled) {
            pendingDelta = accumulated;
            mayEmitDelta = true;
          }
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
        const nonAnswerSourceSuppressionReason = domainBoundary
          ? "outside_social_scope"
          : conversationalRecovery?.action === "ask_clarification"
            ? "conversational_clarification"
            : null;
        const responseFactValidationTrace = factValidation?.trace;
        const attribution = await buildFinalSourceAttribution(accumulated, sources, {
          query: retrievalMeta?.attributionQuery || evidenceMessage,
          riskPolicy: retrievalMeta?.ragRiskPolicy,
          legalLookupPlan: retrievalMeta?.legalLookupPlan || retrievalMeta?.queryPlan?.legalLookupPlan,
          queryPlan: retrievalMeta?.queryPlan,
          personTopicTerms: retrievalMeta?.personTopicTerms,
          personCoauthorNames: retrievalMeta?.personCoauthorNames,
          personCoauthorRequested: retrievalMeta?.personCoauthorRequested,
          packageCandidateSourceIds: retrievalMeta?.packageAwareAnswering?.packageCandidateSourceIds,
          packageDisplayedSourceIds: retrievalMeta?.packageAwareAnswering?.packageDisplayedSourceIds,
          packageRequestedSections: retrievalMeta?.packageAwareAnswering?.requestedSections,
          packageSectionSourceIds: retrievalMeta?.packageAwareAnswering?.packageSectionSourceIds,
          requestedFactSlotSourceId: retrievalMeta?.requestedFactSlotContract?.source_id,
          packageAwareAnsweringUsed: retrievalMeta?.packageAwareAnswering?.used === true,
          municipalityContext: retrievalMeta?.municipalityContext,
          documentIdentityEvidence: retrievalMeta?.documentIdentityEvidence,
          authorCorpusEvidence: retrievalMeta?.authorCorpusEvidence,
          factValidation: responseFactValidationTrace,
          nonAnswerSourceSuppressionReason,
          contactInventoryValidatedSourceIds:
            factValidation?.trace?.passed === true && (
              factValidation?.trace?.contact_inventory_checked === true ||
              factValidation?.trace?.contact_monitor_checked === true
            )
              ? factValidation.trace.supporting_source_ids
              : []
        });
        const replySources = resolveDisplayedSources(
          sources,
          attribution,
          nonAnswerSourceSuppressionReason ? { passed: false } : responseFactValidationTrace,
          accumulated
        );
        const dynamicExactFactRetrievalMeta = withFactValidationContractShadow(
          retrievalMeta,
          factValidationContractShadow,
          dynamicFactValidationEnabled
        );
        const validatedRetrievalMeta = withFactValidation(dynamicExactFactRetrievalMeta, factValidation?.trace, {
          ...(firstModelCallDurationMs === null ? {} : { first_model_call_ms: firstModelCallDurationMs }),
          ...(modelDurationMs === null ? {} : { model_ms: modelDurationMs }),
          ...(factValidationDurationMs === null ? {} : { fact_validation_ms: factValidationDurationMs })
        });
        const responseRetrievalMeta = withConversationalRecovery(
          validatedRetrievalMeta,
          conversationalRecovery
        );
        const workflow = recoveryWorkflow(conversationalRecovery);
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
          metadataExtra: buildAttributionMetadata(
            withRecoveryWorkflowMetadata(metadataExtra, conversationalRecovery),
            sources,
            attribution,
            responseRetrievalMeta
          ),
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
              diagnosticRef: persisted?.diagnosticRef || null,
              attachments,
              sources: replySources,
              displayed_sources: replySources,
              ...ragContract,
              ...(ragTrace ? { rag_trace: ragTrace } : {}),
              ...(Array.isArray(attributionDecisions) ? { attribution_decisions: attributionDecisions } : {}),
              workflow
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
          extraSystemInstructions: answerSystemInstructions,
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
          await ragAttemptController?.stage("model", { failure: { stage: "model", code: "model_failed" } });
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
        ragAttemptController?.stop();
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
