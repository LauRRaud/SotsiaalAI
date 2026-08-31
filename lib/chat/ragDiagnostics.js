// Diagnostic evidence is not a correctness verdict. Never infer PASS from a
// successful retrieval, a missing validator, or a completed model request.
export const RAG_DIAGNOSTICS_VERSION = "rag_diagnostics_v1";

const LIMIT = 160;
const TOKEN = /^[\p{L}\p{N}_.:/+-]{1,180}$/u;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const object = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const finite = value => typeof value === "number" && Number.isFinite(value) ? value : null;
const flag = value => typeof value === "boolean" ? value : null;
const token = value => typeof value === "string" && TOKEN.test(value) && !/^sk-/i.test(value) ? value : null;

function list(value, path, omissions, map = token) {
  if (!Array.isArray(value)) return [];
  if (value.length > LIMIT) omissions.push({ path, reason: "item_limit", omitted: value.length - LIMIT });
  const result = value.slice(0, LIMIT).map(map).filter(value => value !== null);
  const rejected = Math.min(value.length, LIMIT) - result.length;
  if (rejected) omissions.push({ path, reason: "redacted_or_invalid", omitted: rejected });
  return result;
}

function pick(value, keys, convert = token) {
  return Object.fromEntries(keys.map(key => [key, convert(value?.[key])]).filter(([, value]) => value !== null));
}

export function projectRagDiagnosticEvidence(input) {
  const trace = object(input);
  const omissions = [];
  const evidence = {
    source: "assistant_message.metadata.rag_trace",
    present: Object.keys(trace).length > 0,
    trace_level: token(trace.retrieval_trace_level),
    counts: pick(trace, ["retrieved_count", "selected_context_count", "rendered_context_chars", "selected_source_count", "answer_source_count", "displayed_source_count"], finite),
    context_hash: token(trace.rendered_context_hash),
    sources: {},
    omissions
  };
  for (const key of ["retrieved_source_ids", "selected_context_source_ids", "model_context_source_ids", "validated_supporting_source_ids", "claim_supported_source_ids", "answer_source_ids", "displayed_source_ids"]) {
    if (own(trace, key)) evidence.sources[key] = list(trace[key], key, omissions);
  }
  const plan = object(trace.query_plan);
  const semantic = object(plan.semantic_turn_contract);
  evidence.plan = {
    observed: own(trace, "query_plan"),
    ...pick(plan, ["mode", "selection_strategy", "intent"]),
    history_reference: pick(semantic.history_reference, ["explicit_source_anaphora", "carry_previous_source_filter"], flag)
  };
  evidence.identity = {
    observed: own(trace, "document_identity"),
    ...pick(trace.document_identity, ["status", "confidence", "reason", "selected_document_id", "source_id"]),
    ...pick(trace.document_identity, ["matched", "required", "confirmed", "enabled"], flag),
    reasons: list(trace.document_identity?.reasons, "document_identity.reasons", omissions)
  };
  const validation = object(trace.fact_validation);
  evidence.validation = {
    observed: own(trace, "fact_validation"),
    ...pick(validation, ["passed", "enabled", "buffered", "document_identity_matched", "document_identity_required", "requested_metric_contract_checked", "requested_qualitative_contract_checked", "requested_fact_slot_contract_checked"], flag),
    ...pick(validation, ["reason", "version", "selected_document_id"]),
    ...pick(validation, ["requested_metric_slot_count", "requested_metric_missing_slot_index", "requested_qualitative_slot_count", "requested_fact_answer_unit_count", "requested_fact_requested_slot_count", "requested_fact_covered_slot_count", "validation_duration_ms"], finite)
  };
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
  evidence.validation.relation_diagnostics = list(validation.requested_metric_relation_diagnostics, "fact_validation.requested_metric_relation_diagnostics", omissions, relation => ({
    ...pick(relation, ["claim_index", "required_term_count", "matched_term_count"], finite),
    ...pick(relation, ["minimum_terms_matched", "required_modifiers_matched", "unique_relation_bound"], flag)
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
    stage("validation", evidence.validation.enabled === false ? "NOT_APPLICABLE" : evidence.validation.passed === false ? "BLOCKED" : evidence.validation.passed === true ? "PASSED" : "NOT_PROVEN", evidence.validation.reason || "validation_result_not_recorded", ["fact_validation"]),
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
      ...pick(runtime, ["configured_model", "build_id", "release_sha", "prompt_hash", "index_generation"]),
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
    isCrisis: payload.isCrisis === true,
    trace_id: token(payload.diagnostic_turn_id) ? `turn:${payload.diagnostic_turn_id}` : null,
    ...pick(payload, ["role"]),
    ...evidence.counts,
    query_plan: pick(evidence.plan, ["mode", "selection_strategy"]),
    fact_validation: evidence.validation,
    retrieved_source_ids: evidence.sources.retrieved_source_ids || [],
    selected_context_source_ids: evidence.sources.selected_context_source_ids || [],
    answer_source_ids: evidence.sources.answer_source_ids || [],
    displayed_source_ids: evidence.sources.displayed_source_ids || [],
    attribution_decisions: evidence.attribution.decisions,
    displayed_sources_subset_of_selected: evidence.attribution.displayed_sources_subset_of_selected ?? null,
    displayed_sources_subset_of_answer: evidence.attribution.displayed_sources_subset_of_answer ?? null,
    rendered_context_hash: evidence.context_hash,
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
