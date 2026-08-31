// Diagnostic evidence is not a correctness verdict. Never infer PASS from a
// successful retrieval, a missing validator, or a completed model request.
import { projectQuestionRequirementsShadow } from "./questionRequirements.js";
import { hasValidatedPublication, projectResponseDecision, projectGroupEvidenceLocators, GROUP_CONTRACT_REASONS } from "./responsePolicy.js";
export const RAG_DIAGNOSTICS_VERSION = "rag_diagnostics_v2";

const LIMIT = 160;
const TOKEN = /^[\p{L}\p{N}_.:/+-]{1,180}$/u;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const object = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const finite = value => typeof value === "number" && Number.isFinite(value) ? value : null;
const flag = value => typeof value === "boolean" ? value : null;
const token = value => typeof value === "string" && TOKEN.test(value) && !/^sk-/i.test(value) ? value : null;
const year = value => /^(?:19|20)\d{2}$|^2100$/u.test(String(value ?? "")) ? String(value) : null;
const member = values => value => values.includes(value) ? value : null;
const decisionReason = member(["candidate_not_confirmed", "previous_source_exact_filter", "document_lock_confirmed", "source_years_unconfirmed", "document_anchor_not_confirmed", "trusted_document_id_mismatch", "current_turn_document_lock_mismatch", "current_turn_document_lock_mismatch_after_recovery"]);
const historyReason = member(["canonical_retrieval", "explicit_current_document", "self_contained_temporal", "trusted_recovery", "context_dependent", "self_contained"]);
const qualitativeRejectionReasons = ["empty_unit", "relation_terms_missing", "temporal_payload_mismatch", "known_value_payload_uncheckable", "known_value_population_mismatch", "known_value_measure_mismatch", "known_value_frequency_mismatch", "typed_claim_conflict", "study_period_payload_mismatch", "required_numbers_missing", "evidence_anchors_missing", "action_object_mismatch", "evidence_payload_missing", "answer_items_missing"];
const boundedCount = value => Number.isSafeInteger(value) && value >= 0 && value <= 100000 ? value : null;
const authorTopicReasons = ["author_not_confirmed", "not_required", "independent_topic_anchors_missing", "source_not_active_research", "document_version_conflict", "body_provenance_missing", "body_author_metadata_unconfirmed", "body_topic_not_confirmed", "body_topic_confirmed", "multiple_author_topic_documents", "unique_author_topic_document", "author_topic_locked_evidence_changed"];
const identityReason = value => /^(?:source_year|evidence_period):(?:19|20)\d{2}$/u.test(value || "") ? value : member([...authorTopicReasons, "current_turn_author_topic_confirmation", "exact_title_anchor", "ambiguous_identity", "no_identity_candidate", "document_identity_not_lock_eligible", "trusted_document_id_mismatch", "current_turn_document_identity", "current_turn_author_confirmation", "previous_source_exact_filter", "current_turn_document_lock_mismatch", "current_turn_document_lock_mismatch_after_recovery", "decisive_exact_title_anchor", "decisive_canonical_title_family_anchor", "decisive_document_anchor_lead", "decisive_strong_anchor_lead", "decisive_ranked_title_lead", "decisive_numeric_fact_lead", "decisive_fact_fingerprint_lead", "decisive_bounded_episode_lead", "requested_metric_shape_observed", "bounded_episode_evidence_colocated"])(value);

function list(value, path, omissions, map = token, limit = LIMIT) {
  if (!Array.isArray(value)) return [];
  if (value.length > limit) omissions.push({ path, reason: "item_limit", omitted: value.length - limit });
  const result = value.slice(0, limit).map(map).filter(value => value !== null);
  const rejected = Math.min(value.length, limit) - result.length;
  if (rejected) omissions.push({ path, reason: "redacted_or_invalid", omitted: rejected });
  return result;
}

function pick(value, keys, convert = token) {
  return Object.fromEntries(keys.map(key => [key, convert(value?.[key])]).filter(([, value]) => value !== null));
}

// The same narrow boundary is used before persistence and on every read.
export function projectIdentityDecision(value, omissions = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    ...pick(value, ["stage"], member(["initial_lock", "scoped_search_recheck", "recovery_recheck"])),
    ...pick(value, ["reason"], decisionReason),
    ...pick(value, ["candidate_document_id", "locked_document_id"]),
    ...pick(value, ["candidate_confidence"], member(["high", "medium", "low", "ambiguous", "not_required"])),
    ...pick(value, ["eligible", "candidate_matched"], flag),
    ...pick(value, ["selected_source_year"], year),
    ...Object.fromEntries(["required_source_years", "confirmed_source_years", "unconfirmed_source_years"].filter(key => own(value, key)).map(key => [key, list(value[key], `document_identity.decision.${key}`, omissions, year)])),
    checks: pick(value.checks, ["exact_title_confirmed", "canonical_title_confirmed", "all_authors_confirmed", "all_source_years_confirmed", "author_confirmation_trusted", "author_body_topic_confirmed", "candidate_matches_locked_document"], flag)
  };
}

export function projectAuthorTopicEvidence(value, omissions = []) {
  if (!value || value.version !== "author_body_topic_v1") return null;
  const candidateCount = boundedCount(value.candidate_count) ?? (Array.isArray(value.candidates) ? value.candidates.length : 0);
  const omitted = Math.max(0, candidateCount - 8, boundedCount(value.candidates_omitted) || 0);
  if (omitted && Array.isArray(value.candidates) && value.candidates.length <= 8) {
    omissions.push({ path: "document_identity.author_topic_evidence.candidates", reason: "upstream_item_limit", omitted });
  }
  return { version: "author_body_topic_v1",
    ...pick(value, ["required"], flag),
    ...pick(value, ["status"], member(authorTopicReasons)),
    ...pick(value, ["topic_term_count", "confirmed_document_count"], boundedCount),
    candidate_count: candidateCount, candidates_omitted: omitted,
    confirmed_document_ids: list(value.confirmed_document_ids, "document_identity.author_topic_evidence.confirmed_document_ids", omissions, token, 8),
    candidates: list(value.candidates, "document_identity.author_topic_evidence.candidates", omissions, item => ({
      ...pick(item, ["document_id", "source_id", "document_version", "chunk_id"]),
      ...pick(item, ["chunk_hash", "body_hash", "fragment_hash"], value => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) ? value : null),
      ...pick(item, ["confirmed"], flag),
      ...pick(item, ["reason"], member(authorTopicReasons)),
      ...pick(item, ["matched_term_count"], boundedCount),
      ...pick(item, ["start", "end"], value => Number.isSafeInteger(value) && value >= 0 ? value : null),
      ...pick(item, ["offset_basis"], member(["retrieved_chunk_text_utf16"]))
    }), 8)
  };
}

export function projectDiagnosticHistory(value, omissions = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    ...pick(value, ["request_raw_count", "normalized_client_count", "retrieval_input_count", "retrieval_selected_count", "model_available_count", "model_selected_count"], value => Number.isSafeInteger(value) && value >= 0 ? value : null),
    ...pick(value, ["retrieval_input_origin"], member(["client_payload", "trusted_recovery"])),
    ...pick(value, ["model_selection_reason"], historyReason),
    ...(Array.isArray(value.retrieval_exclusion_reasons) ? { retrieval_exclusion_reasons: list(value.retrieval_exclusion_reasons, "history_selection.retrieval_exclusion_reasons", omissions, historyReason) } : {})
  };
}

// First-reject counts form a funnel, not independent tests of every later gate.
// No unit text, source terms, numbers, hashes of model drafts or private names.
export function projectQualitativeGateChecks(value, omissions = []) {
  if (!Array.isArray(value)) return null;
  return list(value, "fact_validation.qualitative_gate_checks", omissions, item =>
    Number.isInteger(item?.slot_index) && item.slot_index >= 1 && item.slot_index <= 12 ? {
    slot_index: item.slot_index,
    ...pick(item, ["evaluated_unit_count", "candidate_unit_count"], boundedCount),
    ...pick(item, ["assigned", "assignment_conflict"], flag),
    rejection_counts: pick(item.rejection_counts, qualitativeRejectionReasons, boundedCount)
  } : null, 12);
}

export function projectRagDiagnosticEvidence(input) {
  const trace = object(input);
  const omissions = (Array.isArray(trace.projection_omissions) ? trace.projection_omissions : []).slice(0, 160)
    .filter(item => /^[a-z_][a-z0-9_.]{0,120}$/u.test(item?.path || "") && ["item_limit", "redacted_or_invalid", "upstream_item_limit", "evidence_shortened"].includes(item?.reason))
    .map(item => ({ path: item.path, reason: item.reason, ...(boundedCount(item.omitted) !== null ? { omitted: item.omitted } : {}) }));
  const evidence = {
    source: "assistant_message.metadata.rag_trace",
    present: trace.projection === "rag_diagnostic_log_v1" ? trace.trace_present === true : Object.keys(trace).length > 0,
    trace_level: token(trace.retrieval_trace_level),
    counts: pick(trace, ["retrieved_count", "selected_context_count", "rendered_context_chars", "selected_source_count", "answer_source_count", "displayed_source_count"], finite),
    context_hash: token(trace.rendered_context_hash),
    question_requirements_shadow: projectQuestionRequirementsShadow(trace.question_requirements_shadow),
    sources: {},
    omissions
  };
  for (const key of ["retrieved_source_ids", "selected_context_source_ids", "model_context_source_ids", "validated_supporting_source_ids", "claim_supported_source_ids", "answer_source_ids", "displayed_source_ids"]) {
    if (own(trace, key)) evidence.sources[key] = list(trace[key], key, omissions);
  }
  const plan = object(trace.query_plan);
  const semantic = object(plan.semantic_turn_contract);
  const planner = object(plan.question_planner);
  const yearField = trace.answer_validation_contract_shadow?.planner?.fields?.year_role_mentions ?? plan.answer_validation_contract_shadow?.planner?.fields?.year_role_mentions;
  const mentionsObserved = yearField?.available === true && Array.isArray(yearField.value);
  const yearMentions = list(mentionsObserved ? yearField.value : [], "answer_validation_contract_shadow.planner.fields.year_role_mentions", omissions, mention => year(mention?.value) ? {
    value: year(mention.value),
    ...pick(mention, ["role"], member(["document_source_year", "evidence_year", "ambiguous"])),
    ...pick(mention, ["method"], member(["forward_explicit_year_cue", "nearest_explicit_year_cue", "conflicting_explicit_year_cues", "no_explicit_year_cue", "bounded_episode_period", "explicit_year_range", "explicit_observation_year"]))
  } : null);
  const sourceYears = list(planner.document_source_years, "query_plan.document_source_years", omissions, year);
  evidence.plan = {
    observed: own(trace, "query_plan"),
    ...pick(plan, ["mode", "selection_strategy", "intent"]),
    history_reference: pick(semantic.history_reference, ["explicit_source_anaphora", "carry_previous_source_filter"], flag),
    years: {
      observed: Array.isArray(planner.document_source_years),
      source_years: sourceYears,
      evidence_period_years: Array.isArray(planner.evidence_period_years) ? list(planner.evidence_period_years, "query_plan.evidence_period_years", omissions, year) : null,
      mentions_observed: mentionsObserved,
      mentions: mentionsObserved ? yearMentions : null,
      unselected_source_years: mentionsObserved && Array.isArray(planner.document_source_years) ? [...new Set(yearMentions.filter(mention => mention.role === "document_source_year" && !sourceYears.includes(mention.value)).map(mention => mention.value))] : null
    }
  };
  evidence.history = { observed: !!trace.history_selection, ...projectDiagnosticHistory(trace.history_selection, omissions) };
  evidence.identity = {
    observed: own(trace, "document_identity"),
    ...pick(trace.document_identity, ["status", "confidence", "reason", "selected_document_id", "source_id"]),
    ...pick(trace.document_identity, ["matched", "required", "confirmed", "enabled"], flag),
    reasons: list(trace.document_identity?.reasons, "document_identity.reasons", omissions, identityReason),
    reason_count: finite(trace.document_identity?.reason_count),
    reasons_omitted: finite(trace.document_identity?.reasons_omitted),
    decision: projectIdentityDecision(trace.document_identity?.decision, omissions),
    author_topic_evidence: projectAuthorTopicEvidence(trace.document_identity?.author_topic_evidence, omissions),
    candidates: list(trace.document_identity?.candidates, "document_identity.candidates", omissions, candidate => ({
      ...pick(candidate, ["document_id"]),
      ...pick(candidate, ["score", "subject_match_count", "body_subject_match_count"], finite),
      ...pick(candidate, ["identity_matched", "author_matched", "author_body_topic_confirmed", "source_compatible", "source_year_compatible"], flag),
      ...pick(candidate, ["resolved_source_year"], year),
      ...(Array.isArray(candidate?.source_year_matches) ? { source_year_matches: list(candidate.source_year_matches, "document_identity.candidates.source_year_matches", omissions, year) } : {})
    }))
  };
  if (evidence.identity.reasons_omitted > 0) omissions.push({ path: "document_identity.reasons", reason: "upstream_item_limit", omitted: evidence.identity.reasons_omitted });
  const validation = object(trace.fact_validation);
  const metricContract = trace.requested_fact_slot_contract || trace.requested_metric_contract;
  evidence.metric_contract = metricContract ? {
    observed: true,
    ...pick(metricContract, ["enabled", "complete", "sanitizer_dropped_slot"], flag),
    ...pick(metricContract, ["requested_slot_count", "mapped_slot_count"], finite),
    ...pick(metricContract, ["reason"], member(["requested_slots_incomplete", "slot_count_out_of_scope", "unsupported_value_type_v1", "unsupported_language_or_input_v1", "document_identity_not_high", "rendered_evidence_mapping_incomplete", "rendered_evidence_mapping_truncated", "all_requested_slots_mapped_in_one_rendered_source"])),
    mapping: {
      ...pick(metricContract.mapping_diagnostics, ["evidence_candidate_count", "evidence_fragment_count"], finite),
      ...pick(metricContract.mapping_diagnostics, ["evidence_candidates_truncated", "ambiguous"], flag)
    },
    slots: list(metricContract.slots, "metric_contract.slots", omissions, slot => ({
      ...pick(slot, ["slot_index"], finite),
      ...pick(slot, ["value_type"], member(["proportion", "count", "amount", "magnitude", "duration", "calendar_year", "explicit_value_relation"])),
      ...pick(slot, ["qualifier"], member(["over", "under", "at_least", "at_most", "about", "range"])),
      ...pick(slot, ["range_endpoint_count"], member([2])),
      ...pick(slot, ["named_scope_term_count"], member([1, 2, 3])),
      ...pick(slot, ["named_scope_age_required", "named_scope_observation_year_required"], flag)
    }))
  } : { observed: false };
  const qualitativeContract = trace.requested_qualitative_slot_contract;
  evidence.qualitative_contract = qualitativeContract ? {
    observed: true,
    ...pick(qualitativeContract, ["enabled", "complete", "sanitizer_dropped_slot"], flag),
    ...pick(qualitativeContract, ["requested_slot_count", "mapped_slot_count"], boundedCount),
    ...pick(qualitativeContract, ["reason"], member([...GROUP_CONTRACT_REASONS, "requested_slots_incomplete", "document_identity_not_high", "qualitative_evidence_mapping_incomplete", "qualitative_evidence_conflict", "all_qualitative_slots_bound_to_rendered_evidence"])),
    conflicting_slot_indexes: list(qualitativeContract.conflicting_slot_indexes, "qualitative_contract.conflicting_slot_indexes", omissions,
      value => Number.isInteger(value) && value >= 1 && value <= 12 ? value : null, 12),
    slots: list(qualitativeContract.slots, "qualitative_contract.slots", omissions, slot => ({
      ...pick(slot, ["slot_index", "evidence_fragment_index", "minimum_answer_items", "minimum_relation_matches", "minimum_anchor_matches", "relation_term_count", "matched_relation_term_count", "evidence_anchor_term_count", "required_numeric_value_count"], boundedCount),
      ...pick(slot, ["value_type"], member(["category", "date", "distribution", "entity_list", "location", "method", "month", "organization", "person_role", "recommendation", "season", "text_relation", "timepoint"])),
      ...pick(slot, ["payload_kind"], member(["known_value_interpretation", "referenced_study_period", "group_distribution", "group_membership"])),
      ...pick(slot, ["admitted_payload_present"], flag),
      ...pick(slot, ["reference_slot_index"], value => Number.isInteger(value) && value >= 1 && value <= 12 ? value : null),
      ...pick(slot, ["evidence_fragment_hash"], value => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) ? value : null)
    }), 12)
  } : { observed: false };
  evidence.validation = {
    response_decision: projectResponseDecision(validation.response_decision),
    group_evidence_locators: projectGroupEvidenceLocators(validation.group_evidence_locators),
    observed: own(trace, "fact_validation"),
    ...pick(validation, ["passed", "enabled", "buffered", "document_identity_matched", "document_identity_required", "requested_metric_contract_checked", "requested_qualitative_contract_checked", "requested_fact_slot_contract_checked"], flag),
    ...pick(validation, ["reason", "version", "selected_document_id", "document_identity_confidence"]),
    ...pick(validation, ["requested_metric_slot_count", "requested_metric_missing_slot_index", "requested_qualitative_slot_count", "requested_fact_answer_unit_count", "requested_fact_requested_slot_count", "requested_fact_covered_slot_count", "validation_duration_ms"], finite)
  };
  const gateChecks = projectQualitativeGateChecks(validation.requested_fact_qualitative_gate_checks, omissions);
  if (gateChecks) evidence.validation.qualitative_gate_checks = gateChecks;
  for (const key of ["requested_fact_missing_slot_indexes", "requested_fact_answer_missing_slot_indexes"]) {
    if (own(validation, key)) evidence.validation[key] = list(validation[key], `fact_validation.${key}`, omissions, finite);
  }
  evidence.validation.bindings = list(validation.requested_fact_qualitative_slot_bindings, "fact_validation.requested_fact_qualitative_slot_bindings", omissions, binding => ({
    ...pick(binding, ["slot_index", "unit_index", "matched_relation_term_count", "matched_evidence_anchor_count", "substantive_answer_token_count"], finite),
    actions: list(binding?.action_object_bindings, "fact_validation.action_object_bindings", omissions, action => ({
      ...pick(action, ["clause_index", "binding_index", "matched_object_count", "required_object_count"], finite),
      ...pick(action, ["action_category", "answer_action_family", "expected_action_family"]),
      ...pick(action, ["answer_negated"], flag)
    }))
  }));
  evidence.validation.metric_bindings = list(validation.requested_metric_slot_bindings, "fact_validation.requested_metric_slot_bindings", omissions, binding => ({
    ...pick(binding, ["slot_index", "claim_index", "matched_relation_term_count"], finite),
    ...pick(binding, ["named_scope_bound", "age_scope_bound", "observation_year_bound"], flag),
    ...(Array.isArray(binding?.claim_indexes) ? { claim_indexes: list(binding.claim_indexes, "metric_binding.claim_indexes", omissions, value => Number.isSafeInteger(value) && value >= 0 && value <= 511 ? value : null) } : {})
  }));
  evidence.validation.relation_diagnostics = list(validation.requested_metric_relation_diagnostics, "fact_validation.requested_metric_relation_diagnostics", omissions, relation => ({
    ...pick(relation, ["claim_index", "required_term_count", "matched_term_count"], finite),
    ...pick(relation, ["minimum_terms_matched", "required_modifiers_matched", "unique_relation_bound", "named_scope_bound", "age_scope_bound", "observation_year_bound"], flag)
  }));
  evidence.claims = list(trace.claim_support_graph, "claim_support_graph", omissions, claim => ({
    ...pick(claim, ["claim_id", "claim_hash"]),
    supporting_source_ids: list(claim?.supporting_source_ids, "claim_support_graph.supporting_source_ids", omissions)
  }));
  evidence.recovery = {
    observed: own(trace, "conversational_recovery"),
    ...pick(trace.conversational_recovery, ["reason", "action", "trigger", "target", "reply_source", "clarification_guard"]),
    ...pick(trace.conversational_recovery, ["active", "question_asked", "external_knowledge_allowed", "technical_status_allowed"], flag),
    ...pick(trace.conversational_recovery, ["model_call_count", "additional_model_call_count", "correction_hint_count"], finite),
    missing_fields: list(trace.conversational_recovery?.missing_fields, "conversational_recovery.missing_fields", omissions)
  };
  evidence.attribution = {
    observed: own(trace, "attribution_decisions") || own(trace, "displayed_source_ids"),
    ...pick(trace, ["displayed_sources_subset_of_selected", "displayed_sources_subset_of_answer"], flag),
    decisions: list(trace.attribution_decisions, "attribution_decisions", omissions, decision => ({
      ...pick(decision, ["source_id", "decision", "reason", "source_type"]),
      ...pick(decision, ["displayed", "supported", "used_in_answer"], flag)
    }))
  };
  evidence.context = list(trace.selected_context_details, "selected_context_details", omissions, context => {
    if (context?.rendered_evidence_truncated === true) omissions.push({ path: "rendered_context", reason: "evidence_shortened", source_id: token(context.source_id) });
    return {
      ...pick(context, ["source_id", "rendered_body_hash", "original_body_hash", "rendered_evidence_hash"]),
      ...pick(context, ["rendered_evidence_chars", "rendered_body_count", "original_body_count"], finite),
      ...pick(context, ["rendered_evidence_truncated"], flag)
    };
  });
  const timingKeys = ["planner_ms", "query_planning_ms", "query_build_ms", "retrieval_wall_ms", "multi_query_retrieval_ms", "retrieval_parallel_sum_ms", "embedding_sum_ms", "embedding_ms", "dense_sum_ms", "dense_ms", "registry_ms", "lexical_sum_ms", "lexical_ms", "lemma_fts_shadow_ms", "document_sibling_sum_ms", "service_fact_segment_sum_ms", "document_identity_ms", "fact_segment_search_ms", "context_render_ms", "model_ms", "first_model_call_ms", "request_total_ms", "turn_total_ms", "fact_validation_ms", "repair_call_ms", "retrieval_context_total_ms", "persistence_ms", "total_ms"];
  evidence.timings = pick(trace.performance_timings, timingKeys, finite);
  evidence.projection_excludes = ["raw_prompt_and_question", "source_body_previews", "model_draft", "free_text_planner_terms", "full_unbounded_runtime_trace"];
  evidence.insufficient_evidence = trace.rag_insufficient_evidence_mode === true || trace.insufficient_precise_support === true || trace.insufficient_precise_legal_source_support === true;
  evidence.missing_sections = ["query_plan", "retrieved_source_ids", "model_context_source_ids", "attribution_decisions"].filter(key => !own(trace, key));
  // The underlying legacy trace is bounded too; do not call it a complete
  // record merely because this projection did not reach its own limits.
  evidence.coverage = omissions.length ? "LIMITED" : evidence.missing_sections.length ? "INCOMPLETE" : "BOUNDED";
  evidence.omissions = Array.from(new Map(omissions.map(item => [JSON.stringify(item), item])).values());
  return evidence;
}

export function buildRagDiagnostics({ trace, turnId = null, userMessageId = null, attempt = null, completionStatus = "COMPLETED", runtime = null } = {}) {
  const evidence = projectRagDiagnosticEvidence(trace);
  const technicalRetrievalFailure = evidence.recovery.trigger === "technical_retrieval_failure";
  const stage = (id, status, code, paths = []) => ({ id, status, code, evidence_paths: paths });
  const stages = [
    stage("planning", evidence.plan.observed ? "OBSERVED" : "NOT_PROVEN", evidence.plan.observed ? "plan_recorded" : "plan_not_recorded", ["query_plan"]),
    stage("retrieval", technicalRetrievalFailure ? "BLOCKED" : own(evidence.counts, "retrieved_count") ? "OBSERVED" : "NOT_PROVEN", technicalRetrievalFailure ? "technical_retrieval_failure" : evidence.counts.retrieved_count === 0 ? "zero_candidates_not_proof_of_corpus_absence" : "retrieval_recorded", ["retrieved_count", "retrieved_source_ids", "conversational_recovery"]),
    stage("identity", evidence.identity.enabled === true && evidence.identity.required === true && evidence.identity.matched === false ? "BLOCKED" : evidence.identity.observed ? "OBSERVED" : "NOT_PROVEN", evidence.identity.required === true && evidence.identity.matched === false ? "document_identity_mismatch" : "document_identity", ["document_identity"]),
    stage("context", evidence.context_hash ? "OBSERVED" : "NOT_PROVEN", evidence.context_hash ? "rendered_context_identified" : "rendered_context_not_identified", ["rendered_context_hash", "model_context_source_ids"]),
    stage("validation", evidence.validation.enabled === false ? "NOT_APPLICABLE" : hasValidatedPublication(evidence.validation) && evidence.validation.response_decision.semantic_outcome === "PARTIAL" ? "PARTIAL" : evidence.validation.passed === false ? "BLOCKED" : evidence.validation.passed === true ? "PASSED" : "NOT_PROVEN", evidence.validation.reason || "validation_result_not_recorded", ["fact_validation"]),
    stage("attribution", evidence.attribution.displayed_sources_subset_of_selected === false || evidence.attribution.displayed_sources_subset_of_answer === false ? "BLOCKED" : evidence.attribution.observed ? "OBSERVED" : "NOT_PROVEN", "source_attribution", ["attribution_decisions", "displayed_source_ids"]),
    stage("persistence", completionStatus === "COMPLETED" ? "OBSERVED" : completionStatus === "RUNNING" ? "RUNNING" : ["ERROR", "ABORTED"].includes(completionStatus) ? "BLOCKED" : "NOT_PROVEN", token(completionStatus)?.toLowerCase() || "completion_not_recorded", ["ChatTurn.status"])
  ];
  const first = stages.find(item => item.status === "BLOCKED") || null;
  const technicalStatus = ["ERROR", "ABORTED", "RUNNING"].includes(completionStatus)
    ? completionStatus
    : first ? "BLOCKED" : evidence.present ? "NO_FAILURE_OBSERVED" : "NOT_PROVEN";
  return {
    schema_version: RAG_DIAGNOSTICS_VERSION,
    trace_id: token(turnId) ? `turn:${turnId}${Number.isSafeInteger(attempt) && attempt > 0 ? `:attempt:${attempt}` : ""}` : null,
    pairing_evidence: { turn_id: token(turnId), user_message_id: token(userMessageId), attempt: Number.isSafeInteger(attempt) && attempt > 0 ? attempt : null },
    technical_status: technicalStatus,
    answer_correctness: "NOT_PROVEN",
    root_cause_status: "NOT_PROVEN",
    first_observed_failure: first,
    limitations: ["automatic_checks_are_not_answer_correctness", "blocking_gate_is_not_necessarily_root_cause", "model_draft_not_logged", ...(!evidence.present ? ["trace_missing_or_non_rag_route"] : [])],
    runtime_missing_fields: ["configured_model", "build_id", "release_sha", "prompt_hash", "index_generation"].filter(key => !token(runtime?.[key])),
    runtime: {
      ...pick(runtime, ["configured_model", "actual_model", "build_id", "release_sha", "prompt_hash", "model_settings_hash", "index_generation", "registry_generation", "validator_version", "question_contract_version", "question_contract_hash", "query_plan_hash", "rendered_context_hash"]),
      ...pick(runtime, ["history_message_count"], finite)
    },
    stages,
    evidence
  };
}

// A separate, allowlisted projection for the generic event table. Never raise
// the global safeError limits and never copy raw prompts, body previews or drafts.
export function projectRagTraceForLog(payload = {}) {
  const evidence = projectRagDiagnosticEvidence(payload);
  return {
    projection: "rag_diagnostic_log_v1",
    trace_present: evidence.present,
    isCrisis: payload.isCrisis === true,
    trace_id: token(payload.diagnostic_turn_id) ? `turn:${payload.diagnostic_turn_id}` : null,
    ...pick(payload, ["role"]),
    ...evidence.counts,
    question_requirements_shadow: evidence.question_requirements_shadow,
    ...(evidence.plan.observed ? { query_plan: {
      ...pick(evidence.plan, ["mode", "selection_strategy", "intent"]), years: evidence.plan.years,
      semantic_turn_contract: { history_reference: evidence.plan.history_reference },
      question_planner: {
        ...(evidence.plan.years.observed ? { document_source_years: evidence.plan.years.source_years } : {}),
        ...(evidence.plan.years.evidence_period_years ? { evidence_period_years: evidence.plan.years.evidence_period_years } : {})
      }
    } } : {}),
    ...(evidence.plan.years.mentions_observed ? { answer_validation_contract_shadow: { planner: { fields: { year_role_mentions: { available: true, value: evidence.plan.years.mentions } } } } } : {}),
    ...(evidence.identity.observed ? { document_identity: evidence.identity } : {}),
    ...(evidence.history.observed ? { history_selection: evidence.history } : {}),
    ...(evidence.validation.observed ? { fact_validation: { ...evidence.validation,
      requested_fact_qualitative_gate_checks: evidence.validation.qualitative_gate_checks,
      requested_fact_qualitative_slot_bindings: evidence.validation.bindings.map(binding => ({ ...binding, action_object_bindings: binding.actions })),
      requested_metric_slot_bindings: evidence.validation.metric_bindings,
      requested_metric_relation_diagnostics: evidence.validation.relation_diagnostics } } : {}),
    ...(evidence.metric_contract.observed ? { requested_fact_slot_contract: { ...evidence.metric_contract, mapping_diagnostics: evidence.metric_contract.mapping } } : {}),
    ...(evidence.qualitative_contract.observed ? { requested_qualitative_slot_contract: evidence.qualitative_contract } : {}),
    ...Object.fromEntries(["retrieved_source_ids", "selected_context_source_ids", "model_context_source_ids", "answer_source_ids", "displayed_source_ids"]
      .filter(key => own(payload, key)).map(key => [key, evidence.sources[key] || []])),
    ...(own(payload, "attribution_decisions") ? { attribution_decisions: evidence.attribution.decisions } : {}),
    displayed_sources_subset_of_selected: evidence.attribution.displayed_sources_subset_of_selected ?? null,
    displayed_sources_subset_of_answer: evidence.attribution.displayed_sources_subset_of_answer ?? null,
    rendered_context_hash: evidence.context_hash,
    selected_context_details: evidence.context,
    claim_support_graph: evidence.claims,
    performance_timings: evidence.timings,
    ...(evidence.recovery.observed ? { conversational_recovery: evidence.recovery } : {}),
    rag_insufficient_evidence_mode: evidence.insufficient_evidence,
    retrieval_trace_level: evidence.trace_level,
    retrievers_used: list(payload.retrievers_used, "retrievers_used", evidence.omissions),
    rag_risk_level: token(payload.rag_risk_level),
    trace_coverage: evidence.coverage,
    omitted_fields: evidence.missing_sections,
    projection_omissions: evidence.omissions,
    source_layer: "server_runtime_trace"
  };
}

export function selectDiagnosticReportRow(rows, reference) {
  if (!Array.isArray(rows)) return null;
  if (reference === null) return rows.at(-1) || null;
  if (!reference) return null;
  return rows.find(row => (row.reference || row.diagnostics.trace_id || `message:${row.assistant_message_id || row.question_message_id}`) === reference) || null;
}
