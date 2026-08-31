import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRagDiagnostics, projectRagDiagnosticEvidence, projectRagTraceForLog, selectDiagnosticReportRow } from "../../lib/chat/ragDiagnostics.js";
import { buildDiagnosticReport, diagnosticReportMarkdown } from "../../lib/chat/ragDiagnosticReport.js";
import { GET } from "../../app/api/chat/conversations/[id]/diagnostics/route.js";
import { persistDone } from "../../lib/chat/persistence.js";
import { finalizeAssistantReply, buildImmediateChatResponse } from "../../lib/chat/responseFinalizer.js";
import { buildRequestedFactSlotContract, describeSpecificResearchDocumentLock, describeSpecificResearchDocumentRecheck } from "../../lib/chat/retrievalContextAssembler.js";
import { validateExactFactAnswer } from "../../lib/chat/factContract.js";
import { buildRagTraceFromAttribution } from "../../lib/chat/mainResponseHandler.js";
import { diagnosticExplanationRows } from "../../lib/chat/ragDiagnosticExplanation.js";
import { serverT } from "../../lib/i18n/serverMessages.js";
import { buildQuestionPlan } from "../../lib/chat/questionPlanner.js";
import { buildRagQueryPlan } from "../../lib/chat/queryPlanner.js";

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

test("atomic range mapping and two bound endpoints survive canonical diagnostics without source text or values", () => {
  const message = "2024. aasta artiklis millises vahemikus oli töötute osakaal?";
  const questionPlan = buildQuestionPlan({ message });
  const body = "Töötute osakaal oli 12,5–18,5%.";
  const identity = { required: true, matched: true, confidence: "high", selectedDocumentId: "range-doc" };
  const contract = buildRequestedFactSlotContract({ questionPlan, renderedGroups: [{ sourceId: "range-source", docId: "range-doc" }], renderedBlocks: [{ evidenceText: body }], specificResearchFactQuestion: true, documentIdentityEvidence: identity }).trace;
  const sources = [{ id: "range-source", documentId: "range-doc", evidenceText: body }];
  const retrievalMeta = { queryPlan: { mode: "specific_research_fact", question_planner: questionPlan }, requestedFactSlotContract: contract, documentIdentityEvidence: identity };
  const result = validateExactFactAnswer({ message, reply: body, sources, retrievalMeta });
  assert.equal(result.passed, true, JSON.stringify(result.trace));
  const canonical = buildRagTraceFromAttribution(sources, {}, { ...retrievalMeta, factValidation: result.trace });
  const d = buildRagDiagnostics({ trace: canonical });
  assert.equal(d.evidence.metric_contract.complete, true);
  assert.equal(d.evidence.metric_contract.slots[0].qualifier, "range");
  assert.equal(d.evidence.metric_contract.slots[0].range_endpoint_count, 2);
  assert.deepEqual(d.evidence.validation.metric_bindings[0].claim_indexes, [0, 1]);
  const rows = diagnosticExplanationRows(d, key => serverT("et", `chat.diagnostics.${key}`));
  assert.match(rows.find(row => row.key === "metric_mapping").value, /1 \/ 1/);
  assert.equal(rows.find(row => row.key === "bound_range_claims").value, "1: 2");
  assert.doesNotMatch(JSON.stringify(d), /12[.,]5|18[.,]5|Töötute/);
  assert.equal(projectRagTraceForLog(canonical).requested_fact_slot_contract.complete, true);
  const invalid = buildRagTraceFromAttribution([], {}, { ...retrievalMeta, requestedFactSlotContract: { ...contract, slots: [{ ...contract.slots[0], evidence_range_end: "PRIVATE" }] } });
  assert.equal(invalid.requested_fact_slot_contract.sanitizer_dropped_slot, true);
  assert.equal(invalid.requested_fact_slot_contract.complete, false);
  assert.doesNotMatch(JSON.stringify(buildRagDiagnostics({ trace: invalid })), /PRIVATE/);
});

test("incomplete metric mapping explains zero candidates without inventing a root cause or old missing evidence", () => {
  const d = buildRagDiagnostics({ trace: { ...trace, requested_fact_slot_contract: { enabled: false, complete: false, reason: "rendered_evidence_mapping_incomplete", requested_slot_count: 1, mapped_slot_count: 0, mapping_diagnostics: { evidence_candidate_count: 0, evidence_fragment_count: 15 }, slots: [], raw: "PRIVATE" } } });
  const rows = diagnosticExplanationRows(d, key => serverT("et", `chat.diagnostics.${key}`));
  assert.match(rows.find(row => row.key === "metric_mapping").value, /0 \/ 1/);
  assert.equal(rows.find(row => row.key === "metric_candidates").value, "0");
  assert.equal(d.root_cause_status, "NOT_PROVEN");
  assert.doesNotMatch(JSON.stringify(d), /PRIVATE/);
  assert.equal(buildRagDiagnostics({ trace }).evidence.metric_contract.observed, false);
});

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

const yearPlan = {
  document_author_names: ["Example Author"],
  document_source_years: ["2019", "2022"],
  evidence_period_years: [],
  semantic_candidates: { year_role_mentions: ["2019", "2022", "2023"].map(value => ({ value, role: "document_source_year", raw: "PRIVATE" })) }
};
const identityCandidate = {
  enabled: true, required: true, matched: true, confidence: "high", selectedDocumentId: "doc-year-2023",
  groups: [{ year: 2023 }], reasons: ["author_match:Example Author"],
  candidates: [{ documentId: "doc-year-2023", identityMatched: true, authorMatched: true, resolvedSourceYear: 2023, sourceYearMatches: [], subjectMatches: ["PRIVATE"] }]
};

test("the actual lock decision records an author match and rejected year requirements without changing eligibility", () => {
  const decision = describeSpecificResearchDocumentLock(yearPlan, identityCandidate);
  assert.equal(decision.eligible, false);
  assert.equal(decision.reason, "source_years_unconfirmed");
  assert.equal(decision.checks.all_authors_confirmed, true);
  assert.deepEqual(decision.unconfirmed_source_years, ["2019", "2022"]);
  assert.equal(decision.selected_source_year, 2023);
  const titlePlan = { ...yearPlan, semantic_candidates: { current_turn_document_identity: { title_hint: { provenance: "explicit_current_turn", value: "Exact title" } } } };
  const titleDecision = describeSpecificResearchDocumentLock(titlePlan, { ...identityCandidate, reasons: [...identityCandidate.reasons, "exact_title_anchor"] });
  assert.equal(titleDecision.eligible, true, "exact title remains an alternative to the year condition");
  assert.equal(titleDecision.reason, "document_lock_confirmed");
});

test("recheck evidence belongs to the current candidate, not the previously locked source", () => {
  const changed = { ...identityCandidate, selectedDocumentId: "other-doc", groups: [{ year: 2024 }] };
  const recheck = describeSpecificResearchDocumentRecheck(changed, "doc-year-2023", "recovery_recheck");
  assert.equal(recheck.candidate_document_id, "other-doc");
  assert.equal(recheck.selected_source_year, 2024);
  assert.equal(recheck.locked_document_id, "doc-year-2023");
  assert.equal(recheck.checks.candidate_matches_locked_document, false);
  assert.equal(recheck.eligible, false);
  assert.equal(recheck.reason, "current_turn_document_lock_mismatch_after_recovery");
  assert.equal(describeSpecificResearchDocumentRecheck(identityCandidate, "doc-year-2023", "scoped_search_recheck").eligible, true);
});

test("producer to canonical trace to reports retains terminal decision beyond twenty reasons", () => {
  const decision = describeSpecificResearchDocumentLock(yearPlan, identityCandidate);
  const actualQuestionPlan = buildQuestionPlan({ message: "Millises vahemikus oli Põhja-Pärnumaal mitme kuhjunud võlanõudega inimeste osakaal võlanõustamisele suunatutest aastatel 2019–2022, nagu kirjeldab Anneli Kaljuri 2023. aasta artikkel?", role: "social_worker" });
  const correctedQueryPlan = buildRagQueryPlan({ baseRagQueryText: "Põhja-Pärnumaa", effectiveMessage: "Põhja-Pärnumaa", rawHistory: [], effectiveMunicipalities: [], questionPlan: actualQuestionPlan }).queryPlan;
  const correctedDiagnostics = buildRagDiagnostics({ trace: buildRagTraceFromAttribution([], {}, { queryPlan: correctedQueryPlan }) });
  assert.deepEqual(correctedDiagnostics.evidence.plan.years.source_years, ["2023"]);
  assert.deepEqual(correctedDiagnostics.evidence.plan.years.evidence_period_years, ["2019", "2022"]);
  assert.deepEqual(correctedDiagnostics.evidence.plan.years.mentions.filter(mention => mention.method === "explicit_year_range").map(mention => [mention.value, mention.role]), [["2019", "evidence_year"], ["2022", "evidence_year"]]);
  // Inject a legacy conflicting plan deliberately: this test protects trace
  // transport, not the old parser bug (year-role regressions cover parsing).
  const conflictingPlan = { ...actualQuestionPlan, document_source_years: yearPlan.document_source_years, evidence_period_years: [], semantic_candidates: { ...actualQuestionPlan.semantic_candidates, year_role_mentions: actualQuestionPlan.semantic_candidates.year_role_mentions.map(mention => ({ ...mention, role: "document_source_year" })) } };
  const actualQueryPlan = buildRagQueryPlan({ baseRagQueryText: "Põhja-Pärnumaa", effectiveMessage: "Põhja-Pärnumaa", rawHistory: [], effectiveMunicipalities: [], questionPlan: conflictingPlan }).queryPlan;
  const canonical = buildRagTraceFromAttribution([], {}, {
    queryPlan: actualQueryPlan,
    documentIdentityEvidence: { ...identityCandidate, matched: false, selectedDocumentId: null, groups: [], decision, reasons: [...Array(25).fill("subject:PRIVATE"), "document_identity_not_lock_eligible"] },
    diagnosticHistory: { request_raw_count: 4, normalized_client_count: 4, retrieval_input_count: 4, retrieval_selected_count: 0, model_available_count: 4, model_selected_count: 4, model_selection_reason: "context_dependent", retrieval_exclusion_reasons: ["explicit_current_document"], raw: "PRIVATE" }
  });
  assert.equal(canonical.document_identity.reasons_omitted, 6);
  const d = buildRagDiagnostics({ trace: canonical });
  assert.equal(d.first_observed_failure.id, "identity");
  assert.equal(d.evidence.identity.decision.reason, "source_years_unconfirmed");
  assert.deepEqual(d.evidence.plan.years.source_years, ["2019", "2022"]);
  assert.deepEqual(d.evidence.plan.years.unselected_source_years, ["2023"]);
  assert.deepEqual(d.evidence.plan.years.evidence_period_years, []);
  assert.equal(d.evidence.identity.candidates[0].resolved_source_year, "2023");
  assert.equal(d.evidence.history.retrieval_selected_count, 0);
  assert.equal(d.evidence.history.model_selected_count, 4);
  assert.equal(d.root_cause_status, "NOT_PROVEN");
  assert.doesNotMatch(JSON.stringify(d), /PRIVATE|Example Author/);
  const log = projectRagTraceForLog(canonical);
  assert.equal(log.document_identity.decision.reason, "source_years_unconfirmed");
  assert.equal(log.history_selection.model_selected_count, 4);
  assert.doesNotMatch(JSON.stringify(log), /PRIVATE|Example Author/);
  const md = diagnosticReportMarkdown(buildDiagnosticReport({ conversationId: "conversation01", turns: [turn], messages: [question, { ...answer, metadata: { rag_trace: canonical } }] }));
  assert.match(md, /Autor sobis, kuid kandidaat ei kinnitanud/);
  assert.match(md, /2019, 2022/);
  assert.match(md, /Kandidaadi allikaaasta: 2023/);
  assert.doesNotMatch(md, /PRIVATE|Example Author/);
});

test("missing old decision and history are explicitly unknown, never fabricated zeros", () => {
  const d = buildRagDiagnostics({ trace: { ...trace, document_identity: { required: true, candidates: [{ document_id: "legacy" }] } } });
  assert.equal(d.evidence.identity.decision, null);
  assert.equal(d.evidence.history.observed, false);
  assert.equal(Object.hasOwn(d.evidence.history, "request_raw_count"), false);
  assert.equal(Object.hasOwn(d.evidence.identity.candidates[0], "source_year_matches"), false);
  const rows = diagnosticExplanationRows(d, key => serverT("et", `chat.diagnostics.${key}`));
  assert.match(rows.find(row => row.key === "gate").value, /NOT_PROVEN/);
  assert.match(rows.find(row => row.key === "history_unknown").value, /NOT_PROVEN/);
});

test("new decision evidence rejects free-text enums, private anchor words and invalid years", () => {
  const d = projectRagDiagnosticEvidence({
    query_plan: { question_planner: { document_source_years: ["2023", "PRIVATE"] } },
    answer_validation_contract_shadow: { planner: { fields: { year_role_mentions: { available: true, value: [{ value: "2023", role: "PRIVATE" }, { value: "secret", role: "document_source_year" }] } } } },
    document_identity: { reasons: ["subject:PRIVATE", "body_subject:PRIVATE", "author_match:PRIVATE", "source_year:2023"], decision: { reason: "PRIVATE", selected_source_year: "sk-secret", candidate_confidence: "PRIVATE", author: "PRIVATE", checks: { raw: "PRIVATE" } } },
    history_selection: { request_raw_count: -1, model_selection_reason: "PRIVATE", retrieval_exclusion_reasons: ["PRIVATE"] }
  });
  assert.doesNotMatch(JSON.stringify(d), /PRIVATE|sk-secret/);
  assert.deepEqual(d.plan.years.source_years, ["2023"]);
  assert.equal(d.plan.years.evidence_period_years, null);
  assert.deepEqual(d.identity.reasons, ["source_year:2023"]);
  assert.equal(Object.hasOwn(d.history, "request_raw_count"), false);
});
