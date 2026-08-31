import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRagDiagnostics, projectRagDiagnosticEvidence, projectRagTraceForLog, selectDiagnosticReportRow } from "../../lib/chat/ragDiagnostics.js";
import { buildDiagnosticReport, diagnosticReportMarkdown } from "../../lib/chat/ragDiagnosticReport.js";
import { GET } from "../../app/api/chat/conversations/[id]/diagnostics/route.js";
import { persistDone } from "../../lib/chat/persistence.js";
import { finalizeAssistantReply, buildImmediateChatResponse } from "../../lib/chat/responseFinalizer.js";

const trace = {
  query_plan: { mode: "exact", semantic_turn_contract: { history_reference: { explicit_source_anaphora: false, carry_previous_source_filter: false } } },
  retrieved_count: 4,
  selected_context_count: 2,
  retrieved_source_ids: ["doc-a", "doc-b"],
  selected_context_source_ids: ["doc-a"],
  model_context_source_ids: ["doc-a"],
  displayed_source_ids: [],
  rendered_context_hash: "a".repeat(64),
  attribution_decisions: [{ source_id: "doc-a", reason: "validation_failed", displayed: false }],
  fact_validation: { enabled: true, passed: false, reason: "requested_fact_answer_incomplete", requested_fact_answer_missing_slot_indexes: [2] }
};

test("a blocking validator is observed, not an invented root cause", () => {
  const result = buildRagDiagnostics({ trace, turnId: "turn12345" });
  assert.equal(result.technical_status, "BLOCKED");
  assert.equal(result.first_observed_failure.id, "validation");
  assert.deepEqual(result.evidence.validation.requested_fact_answer_missing_slot_indexes, [2]);
  assert.equal(result.root_cause_status, "NOT_PROVEN");
  assert.equal(result.answer_correctness, "NOT_PROVEN");
  assert.equal(result.trace_id, "turn:turn12345");
});

test("missing trace, empty retrieval and a passing check never become answer PASS", () => {
  assert.equal(buildRagDiagnostics().technical_status, "NOT_PROVEN");
  const empty = buildRagDiagnostics({ trace: { retrieved_count: 0 } });
  assert.equal(empty.stages[1].code, "zero_candidates_not_proof_of_corpus_absence");
  assert.equal(empty.answer_correctness, "NOT_PROVEN");
  const passed = buildRagDiagnostics({ trace: { ...trace, fact_validation: { passed: true, enabled: true } } });
  assert.equal(passed.technical_status, "NO_FAILURE_OBSERVED");
  assert.equal(passed.answer_correctness, "NOT_PROVEN");
});

test("disabled validation and unknown persistence are not reported as failed", () => {
  const result = buildRagDiagnostics({ trace: { fact_validation: { enabled: false, passed: false } }, completionStatus: "UNKNOWN" });
  assert.equal(result.first_observed_failure, null);
  assert.equal(result.stages.find(stage => stage.id === "validation").status, "NOT_APPLICABLE");
  assert.equal(result.stages.find(stage => stage.id === "persistence").status, "NOT_PROVEN");
});

test("errors and interruptions remain visible even without a trace", () => {
  for (const status of ["ERROR", "ABORTED", "RUNNING"]) assert.equal(buildRagDiagnostics({ completionStatus: status }).technical_status, status);
});

test("log projection keeps diagnostics beyond key 30 and rejects free text and secrets", () => {
  const payload = { ...Object.fromEntries(Array.from({ length: 45 }, (_, i) => [`extra${i}`, "PRIVATE"])), ...trace, raw: "PRIVATE", body: "PRIVATE", apiKey: "sk-secret123456", query_plan: { ...trace.query_plan, question: "PRIVATE" }, selected_context_details: [{ source_id: "doc-a", body_preview: "PRIVATE" }], attribution_decisions: [{ source_id: "doc-a", reason: "validation_failed", text: "PRIVATE" }] };
  const result = projectRagTraceForLog(payload);
  assert.equal(result.fact_validation.reason, "requested_fact_answer_incomplete");
  assert.equal(result.query_plan.mode, "exact");
  assert.deepEqual(result.displayed_source_ids, []);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|sk-secret/);
});

test("crisis exclusion remains enforceable in the separate log projection", () => {
  assert.equal(projectRagTraceForLog({ ...trace, isCrisis: true }).isCrisis, true);
  assert.equal(projectRagTraceForLog({ ...trace, isCrisis: false }).isCrisis, false);
});

test("missing answer reference never opens another answer's latest trace", () => {
  const row = { diagnostics: { trace_id: "turn:turn12345" } };
  assert.equal(selectDiagnosticReportRow([row], "missing"), null);
  assert.equal(selectDiagnosticReportRow([row], ""), null);
  assert.equal(selectDiagnosticReportRow([row], null), row);
  assert.equal(selectDiagnosticReportRow([row], "turn:turn12345"), row);
});

test("bounded projection declares omissions, never invents missing counts", () => {
  const result = projectRagDiagnosticEvidence({ retrieved_source_ids: Array.from({ length: 170 }, (_, i) => `doc-${i}`) });
  assert.equal(result.sources.retrieved_source_ids.length, 160);
  assert.equal(result.omissions[0].omitted, 10);
  assert.equal(result.coverage, "LIMITED");
  assert.equal(Object.hasOwn(result.counts, "retrieved_count"), false);
});

test("actual producer metric, recovery and timing keys survive projection", () => {
  const result = projectRagDiagnosticEvidence({ ...trace,
    fact_validation: { requested_metric_missing_slot_index: 2, requested_fact_requested_slot_count: 3, requested_fact_covered_slot_count: 1, requested_metric_relation_diagnostics: [{ claim_index: 1, required_term_count: 2, matched_term_count: 1, unique_relation_bound: false }] },
    performance_timings: { retrieval_wall_ms: 234, fact_validation_ms: 9 },
    conversational_recovery: { active: true, action: "retry_same_question", trigger: "technical_retrieval_failure", question_asked: true, model_call_count: 1 }
  });
  assert.equal(result.validation.requested_metric_missing_slot_index, 2);
  assert.equal(result.validation.requested_fact_covered_slot_count, 1);
  assert.equal(result.validation.relation_diagnostics[0].unique_relation_bound, false);
  assert.equal(result.timings.retrieval_wall_ms, 234);
  assert.equal(result.timings.fact_validation_ms, 9);
  assert.equal(result.recovery.trigger, "technical_retrieval_failure");
});

test("a completed fallback still reports its recorded technical retrieval failure", () => {
  const result = buildRagDiagnostics({ trace: { ...trace, fact_validation: null, conversational_recovery: { trigger: "technical_retrieval_failure", reason: "rag_search_failed", active: false } } });
  assert.equal(result.technical_status, "BLOCKED");
  assert.equal(result.first_observed_failure.id, "retrieval");
  assert.equal(result.first_observed_failure.code, "technical_retrieval_failure");
  assert.equal(result.root_cause_status, "NOT_PROVEN");
});

const question = { id: "question01", role: "USER", content: "Question?", createdAt: "2026-08-31T10:00:00Z" };
const answer = { id: "answer001", role: "ASSISTANT", content: "Answer.", metadata: { rag_trace: trace }, createdAt: "2026-08-31T10:00:02Z" };
const turn = { id: "turn12345", userMessageId: question.id, assistantMessageId: answer.id, status: "COMPLETED", startedAt: question.createdAt, endedAt: answer.createdAt, attempt: 1 };

test("report pairs IDs, not array order, and marks orphan questions explicitly", () => {
  const report = buildDiagnosticReport({ conversationId: "conversation01", turns: [turn], messages: [answer, { ...question, id: "orphan000", content: "Other?" }, question] });
  const paired = report.rows.find(row => row.turn_id === turn.id);
  assert.equal(paired.question, "Question?");
  assert.equal(paired.answer, "Answer.");
  assert.equal(report.rows.find(row => row.question_message_id === "orphan000").pairing, "UNPAIRED_LEGACY_MESSAGE");
});

test("retry preserves the old answer reference and its explicit question pairing", () => {
  const oldAnswer = { ...answer, id: "oldanswer01", content: "Interrupted.", metadata: { completionStatus: "ABORTED", rag_diagnostics: buildRagDiagnostics({ turnId: turn.id, userMessageId: question.id, attempt: 1, completionStatus: "ABORTED" }) } };
  const report = buildDiagnosticReport({ conversationId: "conversation01", turns: [{ ...turn, attempt: 2 }], messages: [question, oldAnswer, answer] });
  const oldRow = selectDiagnosticReportRow(report.rows, "message:oldanswer01");
  assert.equal(oldRow.answer, "Interrupted.");
  assert.equal(oldRow.question, "Question?");
  assert.equal(oldRow.pairing, "PERSISTED_ATTEMPT");
  assert.equal(oldRow.diagnostics.trace_id, "turn:turn12345:attempt:1");
  assert.equal(oldRow.diagnostics.technical_status, "ABORTED");
  assert.equal(selectDiagnosticReportRow(report.rows, "message:answer001").diagnostics.trace_id, "turn:turn12345:attempt:2");
});

test("stalled RUNNING derives ERROR without rewriting the recorded status", () => {
  const report = buildDiagnosticReport({ conversationId: "conversation01", turns: [{ ...turn, status: "RUNNING", updatedAt: "2026-08-31T10:00:00Z", assistantMessageId: null }], messages: [question], now: new Date("2026-08-31T11:00:00Z") });
  assert.equal(report.rows[0].recorded_status, "RUNNING");
  assert.equal(report.rows[0].effective_status, "ERROR");
  assert.equal(report.rows[0].status_derivation, "lease_expired");
  assert.equal(report.rows[0].diagnostics.technical_status, "ERROR");
});

test("persistence snapshots attempt pairing in the same terminal transaction", async () => {
  let saved;
  let closed;
  const tx = {
    $executeRaw: async () => 1,
    conversation: { findUnique: async () => ({ userId: "owner01" }), update: async () => ({}) },
    conversationMessage: { create: async ({ data }) => { saved = data; return { id: "newanswer01" }; } },
    chatTurn: { findUnique: async () => ({ userMessageId: question.id, attempt: 2 }), updateMany: async ({ data }) => { closed = data; return { count: 1 }; } }
  };
  const result = await persistDone({ convId: "conversation01", userId: "owner01", finalText: "Saved answer.", turnId: turn.id, ragTrace: trace }, { prisma: { $transaction: async fn => fn(tx) } });
  assert.equal(result.assistantMessageId, "newanswer01");
  assert.equal(saved.metadata.rag_diagnostics.pairing_evidence.user_message_id, question.id);
  assert.equal(saved.metadata.rag_diagnostics.trace_id, "turn:turn12345:attempt:2");
  assert.equal(closed.assistantMessageId, "newanswer01");
});

test("finalization exposes the immutable saved message reference in JSON and SSE", async () => {
  const result = await finalizeAssistantReply({ persist: true, persistInitialized: true, convId: "conversation01", userId: "owner01", reply: "Answer." }, { persistAppend: async () => {}, persistDone: async () => ({ assistantMessageId: answer.id }) });
  assert.equal(result.persisted.diagnosticRef, "message:answer001");
  const json = await buildImmediateChatResponse({ diagnosticRef: result.persisted.diagnosticRef }).json();
  assert.equal(json.diagnosticRef, "message:answer001");
  const stream = await buildImmediateChatResponse({ wantStream: true, diagnosticRef: result.persisted.diagnosticRef }).text();
  assert.match(stream, /event: done\ndata: .*"diagnosticRef":"message:answer001"/);
});

test("Markdown is a bounded declared snapshot; content cannot close its fence", () => {
  const injected = "```\n![external](https://example.test/image)\n```";
  const report = buildDiagnosticReport({ conversationId: "conversation01", turns: [turn], messages: [{ ...question, content: injected }, answer], hasMore: true });
  const md = diagnosticReportMarkdown(report, "et");
  assert.match(md, /OSALINE ARUANNE/);
  assert.match(md, /````text\n```/);
  assert.match(md, /NOT_PROVEN/);
  assert.match(md, /Validaator ei leidnud/);
});

function deps({ admin = true, owner = "owner01", archived = false } = {}) {
  return { requireUser: async () => ({ ok: true, isAdmin: admin, userId: "owner01" }), enforceChatRateLimit: () => null, prisma: {
    conversation: { findUnique: async () => ({ userId: owner, archivedAt: archived ? new Date() : null }) },
    chatTurn: { findMany: async () => [turn] },
    conversationMessage: { findMany: async () => [question, answer] }
  } };
}
const req = () => new Request("http://localhost/api/chat/conversations/conversation01/diagnostics");
const params = { params: Promise.resolve({ id: "conversation01" }) };

test("diagnostic API requires login, admin AND conversation ownership", async () => {
  assert.equal((await GET(req(), params, { requireUser: async () => ({ ok: false, status: 401, message: "api.common.unauthorized" }) })).status, 401);
  assert.equal((await GET(req(), params, deps({ admin: false }))).status, 403);
  assert.equal((await GET(req(), params, deps({ owner: "other001" }))).status, 403);
  assert.equal((await GET(req(), params, deps({ archived: true }))).status, 404);
});

test("diagnostic API serves the same paired evidence as no-store JSON and Markdown", async () => {
  const response = await GET(req(), params, deps());
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal((await response.json()).report.rows[0].diagnostics.technical_status, "BLOCKED");
  const markdown = await GET(new Request(req().url + "?format=md&lang=et"), params, deps());
  assert.match(markdown.headers.get("content-disposition"), /attachment/);
  assert.match(await markdown.text(), /Question\?/);
});
