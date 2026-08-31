import { createHash } from "node:crypto";
import { buildRagDiagnostics, projectRagTraceForLog } from "./ragDiagnostics.js";
import { projectSourceSelectionBinding } from "./sourceSelection.js";

export const RAG_ATTEMPT_VERSION = "rag_attempt_v1";
export const RAG_ATTEMPT_STAGES = new Set(["claimed", "usage", "planning", "retrieval", "context", "model", "validation", "attribution", "persistence"]);
const FAILURE_CODES = new Set(["usage_reservation_failed", "retrieval_failed", "model_failed", "persistence_failed", "request_cancelled", "lease_expired", "attempt_superseded", "unhandled_failure"]);
const token = value => typeof value === "string" && /^[\p{L}\p{N}_.:/+-]{1,180}$/u.test(value) && !/^sk-/i.test(value) ? value : null;
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value) ? value : null;
const count = value => Number.isSafeInteger(value) && value >= 0 && value <= 1e8 ? value : null;

export function stableEvidenceHash(value) {
  const stable = input => Array.isArray(input) ? input.map(stable) : input && typeof input === "object"
    ? Object.fromEntries(Object.keys(input).sort().filter(key => input[key] !== undefined).map(key => [key, stable(input[key])])) : input;
  return createHash("sha256").update(JSON.stringify(stable(value)) ?? "null").digest("hex");
}

export function projectAttemptRuntime(input = {}) {
  const result = {};
  for (const key of ["release_sha", "build_id", "configured_model", "actual_model", "validator_version", "question_contract_version", "index_generation", "registry_generation"]) {
    const value = token(input?.[key]);
    if (value !== null) result[key] = value;
  }
  for (const key of ["prompt_hash", "model_settings_hash", "query_plan_hash", "rendered_context_hash", "question_contract_hash"]) {
    const value = digest(input?.[key]);
    if (value !== null) result[key] = value;
  }
  const historyCount = count(input?.history_message_count);
  if (historyCount !== null) result.history_message_count = historyCount;
  return result;
}

// Same projection on write and read. No error.message, prompt, body or model draft.
export function projectAttemptEvidence(input = {}) {
  const failure = input?.first_observed_failure;
  const first = RAG_ATTEMPT_STAGES.has(failure?.stage) && FAILURE_CODES.has(failure?.code)
    ? { stage: failure.stage, code: failure.code } : null;
  return {
    schema_version: RAG_ATTEMPT_VERSION,
    ...(projectSourceSelectionBinding(input?.source_selection_binding)
      ? { source_selection_binding: projectSourceSelectionBinding(input.source_selection_binding) } : {}),
    runtime: projectAttemptRuntime(input?.runtime),
    model_calls: (Array.isArray(input?.model_calls) ? input.model_calls : []).slice(0, 12).flatMap(call =>
      Number.isSafeInteger(call?.index) && call.index > 0 && call.index <= 100
        ? [{ index: call.index, runtime: projectAttemptRuntime(call.runtime) }] : []),
    model_calls_omitted: Math.max(count(input?.model_calls_omitted) || 0,
      ...(Array.isArray(input?.model_calls) ? input.model_calls : []).map(call => count(call?.index) !== null ? Math.max(0, call.index - 12) : 0)),
    stages: (Array.isArray(input?.stages) ? input.stages : []).slice(0, 24).flatMap(item =>
      RAG_ATTEMPT_STAGES.has(item?.stage) && count(item?.elapsed_ms) !== null
        ? [{ stage: item.stage, elapsed_ms: item.elapsed_ms }] : []),
    stages_omitted: (count(input?.stages_omitted) || 0) + Math.max(0, (input?.stages?.length || 0) - 24),
    first_observed_failure: first,
    root_cause_status: "UNKNOWN",
    root_cause: null,
    root_cause_evidence_refs: [],
    human_eval_status: "NOT_REVIEWED",
    ...(input?.trace ? { trace: projectRagTraceForLog(input.trace) } : {})
  };
}

export function attemptDiagnostics(attempt, completionStatus) {
  const evidence = projectAttemptEvidence({ ...attempt?.evidence,
    first_observed_failure: attempt?.evidence?.first_observed_failure || (attempt?.status === "ABANDONED"
      ? { stage: attempt.stage, code: "lease_expired" } : null) });
  const diagnostic = buildRagDiagnostics({ trace: evidence.trace, turnId: attempt?.chatTurnId,
    userMessageId: attempt?.userMessageId, attempt: attempt?.attempt, completionStatus, runtime: evidence.runtime });
  return {
    ...diagnostic,
    technical_status: evidence.first_observed_failure && completionStatus === "COMPLETED" ? "BLOCKED" : diagnostic.technical_status,
    evidence: { ...diagnostic.evidence, source: "RagAttempt.evidence.trace" },
    root_cause_status: "UNKNOWN",
    human_eval_status: "NOT_REVIEWED",
    attempt_evidence: evidence,
    ...(evidence.first_observed_failure ? {
      first_observed_failure: { id: evidence.first_observed_failure.stage, status: "BLOCKED", code: evidence.first_observed_failure.code, evidence_paths: ["RagAttempt.evidence.first_observed_failure"] }
    } : {})
  };
}
