import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "../../app/api/chat/route.js";
import { persistDone } from "../../lib/chat/persistence.js";
import { assertRagAttemptOwner, createRagAttemptController, reapStaleRagAttempts, failRagAttempt, persistAttemptTerminal } from "../../lib/chat/ragAttemptStore.js";
import { attemptDiagnostics, projectAttemptEvidence, stableEvidenceHash } from "../../lib/chat/ragAttemptEvidence.js";
import { buildDiagnosticReport, diagnosticReportMarkdown } from "../../lib/chat/ragDiagnosticReport.js";
import { modelRequestEvidence } from "../../lib/chat/openaiRuntime.js";
import { claimChatTurn } from "../../lib/chat/turnRegistry.js";
import { createUsageService } from "../../lib/usage/service.js";
import { projectRagDiagnosticEvidence } from "../../lib/chat/ragDiagnostics.js";

const start = new Date("2026-08-31T12:00:00Z");
const fence = { id: "attempt-1", chatTurnId: "turn-1", attempt: 1, conversationId: "conversation-1", userId: "synthetic-owner" };
const row = (patch = {}) => ({ ...fence, status: "RUNNING", stage: "retrieval", sequence: 1,
  startedAt: start, leaseExpiresAt: new Date(start.getTime() + 900000),
  userMessageId: "question-1", evidence: {},
  chatTurn: { id: fence.chatTurnId, attempt: 1, status: "RUNNING", conversationId: fence.conversationId, userId: fence.userId }, ...patch });

function routeHarness({ outcome = "claimed", usageError = null, retrievalError = null } = {}) {
  const calls = [];
  const controller = { fence, stage: async name => { calls.push(name); return true; },
    settle: async (callback, tx) => callback(tx || {}), stop: () => calls.push("stop") };
  const deps = {
    bootstrapChatRequest: async () => ({ data: { payload: {}, userId: fence.userId, convId: fence.conversationId,
      persist: true, clientTurnKey: "same-intent", normalizedRole: "SOCIAL_WORKER", effectiveMessage: "Milline oli uuringu tulemus?",
      rawHistory: [], history: [], languagePlan: {}, replyLang: "et", L: {}, wantStream: false } }),
    handleDocumentWorkflowBranch: async () => null,
    handleHelpWorkflowBranch: async () => null,
    readCompletedChatTurnReplay: async () => null,
    claimChatTurn: async input => { calls.push(["claim", input]); return { outcome, turn: { id: fence.chatTurnId, attempt: 1 }, ragAttempt: row(), replay: { content: "Salvestatud vastus", metadata: {} } }; },
    createRagAttemptController: () => controller,
    initializeClaimedChatTurn: async () => { calls.push("user_written"); return { userMessageId: "question-1" }; },
    reserveUsageForRequest: async input => { calls.push(["reserve", input]); if (usageError) throw usageError; return { idempotencyKey: input.idempotencyKey }; },
    releaseUsageForRequest: async () => calls.push("release"),
    commitUsageForRequest: async () => calls.push("commit"),
    failRagAttempt: async (receivedFence, input) => { calls.push(["failed", receivedFence, input.failure]); await input.settleUsage({}); },
    assembleRetrievalContext: async () => { calls.push("retrieval_call"); if (retrievalError) throw retrievalError; return { sources: [], retrievalMeta: {}, effectiveContext: "" }; },
    handleMainChatResponse: async input => { calls.push(["answer", input]); return Response.json({ ok: true }); },
    logEvent: async () => {}
  };
  return { calls, deps };
}

test("claim and immutable attempt precede quota and retrieval; accepted question alone consumes a message slot", async () => {
  const { calls, deps } = routeHarness();
  const response = await POST(new Request("http://localhost/api/chat", { method: "POST" }), deps);
  assert.equal(response.status, 200);
  assert.equal(calls[0][0], "claim");
  assert.equal(calls[0][1].recordRagAttempt, true);
  assert.equal(calls[0][1].deferUserMessage, true);
  const reservation = calls.find(item => item[0] === "reserve");
  assert.equal(reservation[1].idempotencyKey, "same-intent");
  assert.ok(calls.indexOf("user_written") < calls.indexOf("retrieval_call"));
  const answer = calls.find(item => item[0] === "answer")[1];
  assert.equal(answer.claimedTurn.userMessageId, "question-1");
  assert.equal(answer.ragAttemptController.fence.attempt, 1);
});

test("replay, in-flight and competing turn never reserve quota or search", async () => {
  for (const outcome of ["replayed", "in_flight", "conversation_busy", "session_limit", "conversation_unavailable"]) {
    const { calls, deps } = routeHarness({ outcome });
    await POST(new Request("http://localhost/api/chat", { method: "POST" }), deps);
    assert.equal(calls.some(item => item[0] === "reserve"), false, outcome);
    assert.equal(calls.includes("retrieval_call"), false, outcome);
    assert.equal(calls.includes("user_written"), false, outcome);
  }
});

test("quota rejection closes attempt without writing a question or starting retrieval", async () => {
  const error = Object.assign(new Error("PRIVATE quota failure"), { code: "USAGE_LIMIT_EXCEEDED" });
  const { calls, deps } = routeHarness({ usageError: error });
  await POST(new Request("http://localhost/api/chat", { method: "POST" }), deps);
  assert.deepEqual(calls.find(item => item[0] === "failed")[2], { stage: "usage", code: "usage_reservation_failed" });
  assert.equal(calls.includes("user_written"), false);
  assert.equal(calls.includes("retrieval_call"), false);
  assert.ok(calls.includes("stop"));
});

test("early retrieval exception reaches attempt evidence before any assistant exists", async () => {
  const { calls, deps } = routeHarness({ retrievalError: new Error("PRIVATE source detail") });
  const response = await POST(new Request("http://localhost/api/chat", { method: "POST" }), deps);
  assert.equal(response.status, 503);
  assert.deepEqual(calls.find(item => item[0] === "failed")[2], { stage: "retrieval", code: "retrieval_failed" });
  assert.equal(calls.some(item => item[0] === "answer"), false);
  assert.ok(calls.includes("stop"));
});

test("unexpected post-retrieval exception closes the attempt and cannot leave a live heartbeat", async () => {
  const { calls, deps } = routeHarness();
  deps.assembleRetrievalContext = async () => null;
  const response = await POST(new Request("http://localhost/api/chat", { method: "POST" }), deps);
  assert.equal(response.status, 503);
  assert.equal(calls.find(item => item[0] === "failed")[2].code, "unhandled_failure");
  assert.ok(calls.includes("stop"));
});

test("retry of failed intent cannot run beside a newer active intent in the same conversation", async () => {
  let writes = 0;
  const tx = { $executeRaw: async () => {}, conversation: { findUnique: async () => ({ userId: fence.userId }) },
    chatTurn: { findUnique: async () => ({ id: "old-turn", conversationId: fence.conversationId, status: "ERROR", attempt: 1 }),
      findFirst: async () => ({ id: "new-turn", status: "RUNNING", updatedAt: start }), updateMany: async () => { writes++; } } };
  const result = await claimChatTurn({ userId: fence.userId, conversationId: fence.conversationId, clientTurnKey: "old-intent", now: start,
    recordRagAttempt: true, deferUserMessage: true }, { prisma: { $transaction: callback => callback(tx) }, writeUserTurn: async () => { writes++; } });
  assert.equal(result.outcome, "conversation_busy");
  assert.equal(writes, 0);
});

test("failure cleanup skips paid RAG without changing the normal release contract", async () => {
  const tx = { usageReservation: { findUnique: async () => ({ id: "rag-paid", status: "COMMITTED" }) } };
  const service = createUsageService();
  const input = { userId: fence.userId, idempotencyKey: "same-intent", tx };
  await assert.rejects(() => service.release(input), { code: "USAGE_RESERVATION_STATE_CONFLICT" });
  assert.equal((await service.release({ ...input, skipCommitted: true })).reservation.status, "COMMITTED");
});

test("quota-denied intent cannot bypass a now-full session on retry", async () => {
  let writes = 0;
  const tx = { $executeRaw: async () => {}, conversation: { findUnique: async () => ({ userId: fence.userId }) },
    conversationMessage: { count: async () => 5 },
    chatTurn: { findUnique: async () => ({ id: "old-turn", conversationId: fence.conversationId, status: "ERROR", attempt: 1, userMessageId: null }),
      findFirst: async () => null, updateMany: async () => { writes++; } } };
  const result = await claimChatTurn({ userId: fence.userId, conversationId: fence.conversationId, clientTurnKey: "old-intent", now: start,
    recordRagAttempt: true, deferUserMessage: true, sessionTurnLimit: 5 }, { prisma: { $transaction: callback => callback(tx) }, writeUserTurn: async () => { writes++; } });
  assert.equal(result.outcome, "session_limit");
  assert.equal(writes, 0);
});

test("terminal fallback preserves visible partial commit but refunds an undurable full reply", async () => {
  for (const status of ["ABORTED", "COMPLETED"]) {
    const calls = [], tx = {};
    const commit = async client => { assert.equal(client, tx); calls.push("commit"); };
    await persistAttemptTerminal({ status, settleUsage: commit }, {
      controller: { fence, stage: async () => true, stop: () => {} },
      persist: async input => { assert.equal(input.ragAttempt, fence); return null; },
      onFailure: async (stage, code, options) => {
        assert.equal(code, "persistence_failed");
        if (options.settleChatUsage) await options.settleChatUsage(tx);
        else calls.push("release");
        assert.equal(options.cancelled === true, status === "ABORTED");
      }
    });
    assert.deepEqual(calls, [status === "ABORTED" ? "commit" : "release"]);
  }
});

test("owned failure settles usage and closes attempt and turn in the same transaction", async () => {
  const calls = [];
  const current = row({ leaseExpiresAt: new Date(Date.now() + 900000) });
  const tx = { $executeRaw: async () => calls.push("lock"), ragAttempt: { findUnique: async () => current,
    updateMany: async args => { assert.equal(args.where.sequence, 1); assert.equal(args.data.status, "FAILED"); calls.push("attempt"); return { count: 1 }; } },
    chatTurn: { updateMany: async args => { assert.equal(args.where.attempt, 1); calls.push("turn"); return { count: 1 }; } } };
  const db = { $transaction: callback => callback(tx) };
  await failRagAttempt(fence, { failure: { stage: "retrieval", code: "retrieval_failed" }, settleUsage: async client => { assert.equal(client, tx); calls.push("settle"); } }, { prisma: db });
  assert.deepEqual(calls, ["lock", "settle", "attempt", "turn"]);
  calls.length = 0;
  await assert.rejects(() => failRagAttempt(fence, { settleUsage: async () => { throw new Error("settlement failed"); } }, { prisma: db }));
  assert.deepEqual(calls, ["lock"]);
});

test("stale attempt fence fails before messages, summaries or billing can be written", async () => {
  let writes = 0;
  const future = new Date(Date.now() + 900000);
  const attempt = row({ leaseExpiresAt: future, chatTurn: { ...row().chatTurn, attempt: 2 } });
  const tx = { $executeRaw: async () => {}, ragAttempt: { findUnique: async () => attempt },
    conversation: { findUnique: async () => ({ userId: fence.userId }), update: async () => { writes++; } },
    conversationMessage: { create: async () => { writes++; return { id: "answer" }; } } };
  const result = await persistDone({ convId: fence.conversationId, userId: fence.userId, turnId: fence.chatTurnId,
    attemptNumber: 1, ragAttempt: fence, finalText: "stale answer", settleUsage: async () => { writes++; } }, { prisma: { $transaction: callback => callback(tx) } });
  assert.equal(result, null);
  assert.equal(writes, 0);
  await assert.rejects(() => assertRagAttemptOwner(tx, fence), { code: "RAG_ATTEMPT_STALE" });
});

test("heartbeat and stage update cannot revive a superseded attempt", async () => {
  let writes = 0;
  const current = row({ chatTurn: { ...row().chatTurn, attempt: 2 } });
  const tx = { $executeRaw: async () => {}, ragAttempt: { findUnique: async () => current, updateMany: async () => { writes++; return { count: 1 }; } },
    chatTurn: { updateMany: async () => { writes++; return { count: 1 }; } } };
  const controller = createRagAttemptController(row(), { conversationId: fence.conversationId, userId: fence.userId,
    db: { $transaction: callback => callback(tx) }, now: () => start, heartbeatMs: 0 });
  assert.equal(await controller.heartbeat(), false);
  assert.equal(await controller.stage("model"), false);
  assert.equal(writes, 0);
});

test("reaper rechecks lease under lock and ignores a refreshed snapshot", async () => {
  let writes = 0;
  const snapshot = row({ leaseExpiresAt: start });
  const tx = { $executeRaw: async () => {}, ragAttempt: { findUnique: async () => row(), updateMany: async () => { writes++; return { count: 1 }; } } };
  const result = await reapStaleRagAttempts({ now: start, db: { ragAttempt: { findMany: async () => [snapshot] }, $transaction: callback => callback(tx) } });
  assert.deepEqual(result, { inspected: 1, abandoned: 0 });
  assert.equal(writes, 0);
});

test("attempt report preserves failed retries and their own question links", () => {
  const attempts = [row({ id: "attempt-1", status: "FAILED", evidence: { first_observed_failure: { stage: "retrieval", code: "retrieval_failed" } } }),
    row({ id: "attempt-2", attempt: 2, userMessageId: "question-2", status: "RUNNING" })];
  const report = buildDiagnosticReport({ conversationId: fence.conversationId, attempts, now: start,
    turns: [{ id: fence.chatTurnId, attempt: 2, status: "RUNNING" }],
    messages: [{ id: "question-1", role: "USER", content: "First question" }, { id: "question-2", role: "USER", content: "Retry question" }] });
  assert.equal(report.rows.length, 2);
  assert.equal(report.rows[0].question, "First question");
  assert.equal(report.rows[1].question, "Retry question");
  assert.equal(report.rows[0].diagnostics.first_observed_failure.code, "retrieval_failed");
  assert.equal(report.rows[0].diagnostics.root_cause_status, "UNKNOWN");
  assert.match(diagnosticReportMarkdown(report), /attempt:attempt-1/);
});

test("model request observation hashes actual payload without retaining user content or settings text", () => {
  const observed = modelRequestEvidence({ model: "test-model", input: [{ content: "PRIVATE user content" }], reasoning: { effort: "low" } });
  assert.match(observed.prompt_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(observed.prompt_hash, modelRequestEvidence({ model: "test-model", input: [{ content: "different" }] }).prompt_hash);
  assert.equal(stableEvidenceHash({ b: 2, a: 1 }), stableEvidenceHash({ a: 1, b: 2 }));
  const safe = projectAttemptEvidence({ runtime: { ...observed, raw: "PRIVATE", actual_model: "test-model" }, error: "PRIVATE", root_cause_status: "PROVEN",
    first_observed_failure: { stage: "model", code: "PRIVATE" } });
  assert.doesNotMatch(JSON.stringify(safe), /PRIVATE|user content|PROVEN/);
  assert.equal(safe.root_cause_status, "UNKNOWN");
  assert.deepEqual(projectAttemptEvidence(safe), safe);
});

test("durable safe trace keeps observed and unknown fields distinct across repeated projection", () => {
  for (const trace of [{}, { query_plan: { question_planner: { document_source_years: ["2026"], evidence_period_years: ["2021", "2022"] } },
    fact_validation: { enabled: true, passed: false, requested_fact_qualitative_gate_checks: [{ slot_index: 1, evaluated_unit_count: 2, candidate_unit_count: 0,
      rejection_counts: { evidence_anchors_missing: 2 }, assigned: false }] },
    conversational_recovery: { trigger: "technical_retrieval_failure", active: true }, model_context_source_ids: ["doc-1"] }]) {
    const once = projectAttemptEvidence({ trace });
    const twice = projectAttemptEvidence(JSON.parse(JSON.stringify(once)));
    const a = projectRagDiagnosticEvidence(once.trace), b = projectRagDiagnosticEvidence(twice.trace);
    assert.deepEqual(b, a);
    assert.equal(a.metric_contract.observed, false);
    assert.equal(a.qualitative_contract.observed, false);
    assert.equal(a.plan.observed, Object.hasOwn(trace, "query_plan"));
  }
});

test("completed fallback cannot hide an earlier recorded retrieval failure", () => {
  const diagnostic = attemptDiagnostics(row({ status: "COMPLETED", evidence: { first_observed_failure: { stage: "retrieval", code: "retrieval_failed" } } }), "COMPLETED");
  assert.equal(diagnostic.technical_status, "BLOCKED");
  assert.equal(diagnostic.root_cause_status, "UNKNOWN");
  assert.equal(diagnostic.evidence.source, "RagAttempt.evidence.trace");
});

test("model-call evidence retains separate hashed inputs with explicit truncation", () => {
  const calls = Array.from({ length: 13 }, (_, index) => ({ index: index + 1, runtime: { configured_model: "test-model", prompt_hash: stableEvidenceHash(index), raw_prompt: "PRIVATE" } }));
  const safe = projectAttemptEvidence({ model_calls: calls });
  assert.equal(safe.model_calls.length, 12);
  assert.equal(safe.model_calls_omitted, 1);
  assert.notEqual(safe.model_calls[0].runtime.prompt_hash, safe.model_calls[1].runtime.prompt_hash);
  assert.doesNotMatch(JSON.stringify(safe), /PRIVATE|raw_prompt/);
  assert.deepEqual(projectAttemptEvidence(safe), safe);
});
