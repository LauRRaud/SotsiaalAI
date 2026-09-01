import assert from "node:assert/strict";
import { test } from "node:test";
import { createSourceSelection, bindSourceSelection, normalizeSourceSelection, resolveSourceSelection,
  sourceSelectionBindingMatches, SOURCE_SELECTION_TTL_MS, sourceSelectionRecovery } from "../../lib/chat/sourceSelection.js";
import { recoveryWorkflow, normalizeTrustedRagRecovery, buildRecoveryBoundMessage } from "../../lib/chat/conversationalRecovery.js";
import { selectionMatchAllowed, selectionDocumentCurrent, scopeSelectionSearch, sourceSelectionCandidates } from "../../lib/chat/sourceSelectionEvidence.js";
import { readSourceSelectionContext, sourceSelectionClaimMatches } from "../../lib/chat/sourceSelectionStore.js";
import { assembleSourceSelection } from "../../lib/chat/sourceSelectionRetrieval.js";
import { handleSourceSelectionResponse, composeSelectedReplies } from "../../lib/chat/sourceSelectionResponse.js";
import { projectAttemptEvidence } from "../../lib/chat/ragAttemptEvidence.js";
import { projectRagTraceForLog, buildRagDiagnostics } from "../../lib/chat/ragDiagnostics.js";
import { groupMatches } from "../../lib/chat/ragContext.js";
import { buildQuestionPlan } from "../../lib/chat/questionPlanner.js";
import { buildCurrentTurnAuthorConfirmation } from "../../lib/chat/retrievalContextAssembler.js";
import { persistDone, persistInit } from "../../lib/chat/persistence.js";
import { claimChatTurn, initializeClaimedChatTurn } from "../../lib/chat/turnRegistry.js";

const now = 1788177600000;
const options = [1, 2].map(n => ({ documentId: `doc-${n}`, sourceId: `source-${n}`, documentVersion: "v1", title: `Teos ${n}`, year: "2024" }));
const offer = () => createSourceSelection(options, "root-user", { now, offerId: "offer" });
const binding = (message = "mõlemad") => bindSourceSelection(message, offer(), "issuer", now + 1);
const context = (message = "mõlemad") => ({ offer: offer(), binding: binding(message), rootMessage: "Algne küsimus", rootUserMessageId: "root-user" });
const metadata = (option = options[0]) => ({ doc_id: option.documentId, source_id: option.sourceId, document_version: option.documentVersion,
  collection_id: "sotsiaaltoo_articles", source_type: "journal_article", audience: "BOTH" });
const detail = () => ({ id: "doc-1", docId: "doc-1", activeVersion: "v1", lifecycleState: "ACTIVE", status: "COMPLETED", chunks: 2,
  error: null, collection_id: "sotsiaaltoo_articles", audience: "BOTH" });

test("ordered selection, exact title and both are deterministic; an unrelated question leaves selection", () => {
  for (const text of ["teine", "palun teine artikkel", "2", "Teos 2", "second", "второй"]) {
    assert.deepEqual(resolveSourceSelection(text, offer(), now + 1), { status: "selected", selectedIds: ["doc-2"] });
  }
  for (const text of ["mõlemad", "esimene ja teine", "both", "обе"]) assert.deepEqual(resolveSourceSelection(text, offer(), now).selectedIds, ["doc-1", "doc-2"]);
  assert.equal(resolveSourceSelection("Millised teenused on Tallinnas?", offer(), now).status, "new_question");
  for (const text of ["jah", "kolmas", "esimene ja esimene"]) assert.equal(resolveSourceSelection(text, offer(), now).status, "clarify");
});
test("revision binds option order, version, root and issuer; expiry does not authorize a retry", () => {
  assert.equal(normalizeSourceSelection({ ...offer(), options: [...options].reverse() }), null);
  assert.equal(normalizeSourceSelection({ ...offer(), options: [{ ...options[0], documentVersion: "v2" }, options[1]] }), null);
  assert.equal(resolveSourceSelection("teine", offer(), now + SOURCE_SELECTION_TTL_MS).status, "expired");
  assert.equal(sourceSelectionBindingMatches(binding("teine"), offer(), "mõlemad", { now }), false);
  assert.equal(sourceSelectionBindingMatches(binding(), offer(), "mõlemad", { now: now + SOURCE_SELECTION_TTL_MS, allowExpired: true }), true);
});
test("offer survives the actual workflow normalizer and keeps root question, not ordinal, as retrieval input", () => {
  const state = normalizeTrustedRagRecovery(recoveryWorkflow(sourceSelectionRecovery(offer(), "root-user")).ragRecovery);
  assert.deepEqual(state.sourceSelection, offer());
  assert.equal(buildRecoveryBoundMessage({ message: "teine", recoveryState: state,
    trustedHistory: [{ role: "user", text: "Algne küsimus" }] }), "Algne küsimus");
});
test("fresh detail rejects legacy, deleted, changed, private and wrong-audience documents", () => {
  assert.equal(selectionDocumentCurrent(detail(), options[0], "CLIENT"), true);
  for (const patch of [{ activeVersion: "v2" }, { lifecycleState: undefined }, { status: "DEGRADED" }, { chunks: 0 },
    { collection_id: "agent_documents" }, { audience: "SOCIAL_WORKER" }, { audience: "unknown" }, { metadataSummary: { source_types: ["agent_document"] } }]) {
    assert.equal(selectionDocumentCurrent({ ...detail(), ...patch }, options[0], "CLIENT"), false, JSON.stringify(patch));
  }
});
test("all query filters are pinned and absent/conflicting chunk identity never reaches context", () => {
  const scoped = scopeSelectionSearch({ filters: { doc_id: "foreign" }, queries: ["root", { query: "more", filters: { doc_id: "foreign", source_id: "foreign" } }] }, options[0]);
  assert.equal(scoped.filters.doc_id, "doc-1");
  assert.ok(scoped.queries.every(item => item.filters.doc_id === "doc-1" && item.filters.source_id === "source-1"));
  assert.equal(selectionMatchAllowed({ metadata: metadata() }, options[0], "CLIENT"), true);
  for (const patch of [{ document_version: null }, { document_version: "v2" }, { source_id: "foreign" }, { audience: "SOCIAL_WORKER" }, { is_current_version: false }]) {
    assert.equal(selectionMatchAllowed({ metadata: { ...metadata(), ...patch } }, options[0], "CLIENT"), false);
  }
  assert.equal(selectionMatchAllowed({ metadata: metadata(), docId: "foreign" }, options[0], "CLIENT"), false);
});
test("offer producer uses actual author plus body evidence, not ranked title metadata", () => {
  const message = "Priit Kiilaspä artikli järgi: mitu EL-i rändekava alusel saabunud leibkonda ja inimest elas 2017. aasta novembris Tartus ning milline oli nende leibkondade koosseis?";
  const body = "Tartus elab 2017. aasta novembri seisuga neli rändekava alusel saabunud leibkonda (kokku 10 inimest): kaks üksikisikut, üks kolmeliikmeline perekond ja üks viieliikmeline perekond.";
  const groups = groupMatches(options.map(option => ({ text: body, metadata: { ...metadata(option), chunk_id: option.documentId + "-chunk",
    title: option.title, authors: ["Priit Kiilaspä"], year: 2024, source_status: "active" } })));
  const plan = buildQuestionPlan({ message });
  const confirmation = buildCurrentTurnAuthorConfirmation(plan.semantic_candidates.current_turn_document_identity, groups, null, plan);
  assert.equal(confirmation.promotion_eligible, false);
  assert.deepEqual(sourceSelectionCandidates(confirmation, groups).map(item => item.documentId), ["doc-1", "doc-2"]);
  assert.deepEqual(sourceSelectionCandidates(confirmation, groups.map(group => ({ ...group, bodyEvidence: [] }))), []);
});

function dbFixture({ latest = "issuer", stored = null, foreign = false } = {}) {
  const issuer = { id: "issuer", role: "ASSISTANT", metadata: { workflow: recoveryWorkflow(sourceSelectionRecovery(offer(), "root-user")) } };
  const attempt = stored ? { userMessageId: "retry-user", assistantMessageId: "retry-error", evidence: { source_selection_binding: stored } } : null;
  const turn = stored ? { id: "retry", conversationId: "conv", attempt: 2, status: "ERROR" } : null;
  return { conversationMessage: { findFirst: async ({ where }) => {
    assert.equal(where.conversationId, "conv"); assert.equal(where.conversation.userId, "owner");
    if (foreign) return null;
    return where.id === "issuer" ? issuer : where.id === "root-user" ? { id: "root-user", role: "USER", content: "Algne küsimus" }
      : latest === "issuer" ? issuer : { id: latest, role: latest === "retry-user" ? "USER" : "ASSISTANT" };
  } }, chatTurn: { findUnique: async () => turn, findFirst: async ({ where }) => {
    assert.equal(where.userId, "owner"); assert.equal(where.status, "COMPLETED"); return foreign ? null : { id: "root-turn" };
  } }, ragAttempt: { findFirst: async ({ where }) => {
    assert.equal(where.attempt, 2); assert.equal(where.chatTurn.userId, "owner");
    assert.equal("userId" in where, false, "owner is a ChatTurn relation, not a RagAttempt field"); return attempt;
  } } };
}
const readArgs = { conversationId: "conv", userId: "owner", clientTurnKey: "key", message: "mõlemad", now: now + 1 };
test("owner-checked offer loads and a foreign conversation cannot restore it", async () => {
  assert.deepEqual((await readSourceSelectionContext(dbFixture(), readArgs)).binding, binding());
  assert.equal(await readSourceSelectionContext(dbFixture({ foreign: true }), readArgs), null);
});
test("interrupted attempt restores exact binding after user/error or before quota writes a user", async () => {
  for (const latest of ["retry-user", "retry-error", "issuer"]) {
    const recovered = await readSourceSelectionContext(dbFixture({ latest, stored: binding() }), readArgs);
    assert.deepEqual(recovered.binding, binding()); assert.equal(recovered.expectedLatestMessageId, latest);
  }
});
test("a newer turn, modified retry text or malformed binding cannot become ordinary retrieval", async () => {
  assert.equal((await readSourceSelectionContext(dbFixture({ latest: "newer", stored: binding() }), readArgs)).stale, true);
  assert.equal((await readSourceSelectionContext(dbFixture({ stored: binding() }), { ...readArgs, message: "teine" })).stale, true);
  assert.equal((await readSourceSelectionContext(dbFixture({ stored: { ...binding(), revision: "bad" } }), readArgs)).stale, true);
});
test("claim rechecks issuing revision/membership and requires retry binding equality under the lock", async () => {
  const args = { conversationId: "conv", userId: "owner", userMessage: "mõlemad", sourceSelectionBinding: binding(),
    expectedPreviousAssistantMessageId: "issuer", now: new Date(now + 1) };
  assert.equal(await sourceSelectionClaimMatches(dbFixture(), args), true);
  assert.equal(await sourceSelectionClaimMatches(dbFixture(), { ...args, sourceSelectionBinding: { ...binding(), selectedIds: ["foreign"] } }), false);
  assert.equal(await sourceSelectionClaimMatches(dbFixture({ stored: binding() }), { ...args, sourceSelectionBinding: null, existingTurn: { id: "retry", attempt: 2 } }), false);
});

const retrieval = option => ({ effectiveContext: option.title, sources: [{ sourceId: option.sourceId, docId: option.documentId }],
  retrievalMeta: { documentIdentityEvidence: { selectedDocumentId: option.documentId, decision: { eligible: true } }, sourceSelectionCandidates: options } });
test("both uses two isolated root-question assemblies and never pooled document context", async () => {
  const seen = [];
  const result = await assembleSourceSelection({ context: context(), rootUserMessageId: "root-user", now,
    args: { normalizedRole: "CLIENT", effectiveMessage: "Algne küsimus", rawHistory: [{ text: "untrusted" }], ephemeralChunks: ["untrusted"] },
    check: async () => true, assemble: async args => { seen.push(args); return retrieval(args.trustedSourceSelectionDocument); } });
  assert.equal(result.sourceSelectionTurn.partitions.length, 2);
  assert.deepEqual(seen.map(args => args.trustedSourceSelectionDocument.documentId), ["doc-1", "doc-2"]);
  assert.ok(seen.every(args => args.effectiveMessage === "Algne küsimus" && !args.rawHistory.length && !args.ephemeralChunks.length));
});
test("expired or changed source reissues a fresh offer without using stale selection", async () => {
  for (const expired of [false, true]) {
    const seen = [];
    const result = await assembleSourceSelection({ context: context(), rootUserMessageId: "root-user", now: expired ? now + SOURCE_SELECTION_TTL_MS : now,
      args: { normalizedRole: "CLIENT" }, check: async option => expired || option.documentVersion === "v2",
      assemble: async args => { seen.push(args); return { retrievalMeta: { sourceSelectionCandidates: options.map(item => ({ ...item, documentVersion: "v2" })) } }; } });
    assert.equal(result.sourceSelectionTurn.kind, "offer");
    assert.ok(seen.every(args => !args.trustedSourceSelectionDocument));
    assert.equal(result.sourceSelectionTurn.options[0].documentVersion, "v2");
  }
});
test("composite remaps each independently checked citation and rejects foreign source borrowing", () => {
  const parts = options.map(option => ({ option, output: { reply: "Kontrollitud väide [1].", sources: [{ sourceId: option.sourceId, docId: option.documentId }] } }));
  const composed = composeSelectedReplies(parts);
  assert.match(composed.reply, /\[2\]/); assert.equal(composed.sources.length, 2);
  parts[1].output.sources = parts[0].output.sources;
  assert.throws(() => composeSelectedReplies(parts), /cross_document/);
});
test("same final publication in JSON/SSE, one parent persist, isolated children and privacy-safe diagnostic projection", async () => {
  for (const wantStream of [false, true]) {
    let persisted;
    let childCalls = 0;
    let writes = 0;
    const input = { persist: true, wantStream, convId: "conv", userId: "owner", claimedTurn: { id: "turn" }, replyLang: "et",
      effectiveMessage: "mõlemad", normalizedRole: "CLIENT", metadataExtra: {},
      ragAttemptController: { fence: { id: "attempt", attempt: 1 }, stage: async () => true, stop: () => {} },
      sourceSelectionTurn: { kind: "selected", context: context(), rootUserMessageId: "root-user", options,
        partitions: options.map(option => ({ option, retrieval: retrieval(option) })), recheck: async () => true } };
    const response = await handleSourceSelectionResponse(input, { finalizeAssistantReply: async publication => {
      writes++; persisted = publication; return { attachments: [], persisted: { durable: true } };
    } }, async (child, deps) => {
      childCalls++; assert.equal(child.persist, false); assert.equal(child.wantStream, false);
      assert.equal(child.ragAttemptController, null); assert.equal(child.onUsageCommit, null);
      assert.equal(child.effectiveMessage, "Algne küsimus"); assert.equal(child.sources.length, 1);
      await deps.finalizeAssistantReply({ reply: "Kontrollitud vastus [1].", sources: child.sources,
        ragTrace: { fact_validation: { passed: childCalls === 1, reason: "fixture_reason" } } });
      return Response.json({ ok: true });
    });
    assert.equal(writes, 1); assert.equal(childCalls, 2);
    assert.deepEqual(persisted.sourceSelectionBinding, binding());
    const wire = await response.text(); assert.ok(wire.includes("Kontrollitud vastus"));
    const projected = projectAttemptEvidence({ source_selection_binding: binding(), trace: persisted.ragTrace, PRIVATE: "secret" });
    assert.equal(projected.trace.source_selection.parts.length, 2);
    assert.equal(projected.trace.source_selection.parts[1].fact_validation_passed, false);
    assert.equal(JSON.stringify(projected).includes("Kontrollitud vastus"), false);
    assert.equal(JSON.stringify(projected).includes("PRIVATE"), false);
    assert.equal(buildRagDiagnostics({ trace: projectRagTraceForLog(persisted.ragTrace) }).first_observed_failure.id, "source_selection_document_2");
  }
});

test("a selected-source model failure is recorded on the parent attempt at the model stage", async () => {
  const stages = [];
  const input = {
    persist: true,
    claimedTurn: { id: "turn" },
    replyLang: "et",
    effectiveMessage: "esimene",
    ragAttemptController: {
      fence: { id: "attempt", attempt: 1 },
      stage: async (stage, payload) => { stages.push({ stage, payload }); return true; },
      stop: () => {}
    },
    sourceSelectionTurn: {
      kind: "selected",
      rootUserMessageId: "root-user",
      options: [options[0]],
      context: context("esimene"),
      partitions: [{ option: options[0], retrieval: retrieval(options[0]) }]
    }
  };
  const providerError = Object.assign(
    new Error("400 Unsupported value: 'minimal' is not supported with the selected model."),
    { status: 400 }
  );

  await assert.rejects(
    () => handleSourceSelectionResponse(input, {
      callOpenAI: async () => { throw providerError; }
    }, async (_child, deps) => deps.callOpenAI({ reasoningEffort: "minimal" })),
    providerError
  );
  assert.deepEqual(
    stages.find(item => item.payload?.failure)?.payload.failure,
    { stage: "model", code: "model_reasoning_effort_unsupported" }
  );
});

test("binding-free old intent cannot acquire a newer offer on retry", async () => {
  const db = dbFixture();
  db.chatTurn.findUnique = async () => ({ id: "retry", attempt: 2, status: "ERROR", conversationId: "conv" });
  assert.equal(await readSourceSelectionContext(db, readArgs), null);
  assert.equal(await sourceSelectionClaimMatches(db, { conversationId: "conv", userId: "owner", userMessage: "mõlemad",
    sourceSelectionBinding: binding(), existingTurn: { id: "retry", attempt: 2 }, expectedPreviousAssistantMessageId: "issuer", now: new Date(now) }), false);
});
test("actual claim stores binding atomically and a changed latest message prevents all writes", async () => {
  for (const stale of [false, true]) {
    const db = dbFixture({ latest: stale ? "newer" : "issuer" });
    let created;
    let writes = 0;
    db.$executeRaw = async () => {};
    db.conversation = { findUnique: async () => ({ userId: "owner" }) };
    const oldFind = db.chatTurn.findFirst;
    db.chatTurn.findFirst = async args => args.where.status === "COMPLETED" ? oldFind(args) : null;
    db.chatTurn.create = async () => { writes++; return { id: "turn", attempt: 1 }; };
    db.ragAttempt.create = async ({ data }) => { writes++; created = data; return { id: "attempt", ...data }; };
    const result = await claimChatTurn({ userId: "owner", conversationId: "conv", clientTurnKey: "key", userMessage: "mõlemad",
      expectedPreviousAssistantMessageId: "issuer", sourceSelectionBinding: binding(), recordRagAttempt: true, deferUserMessage: true, now: new Date(now) },
    { prisma: { $transaction: callback => callback(db) }, writeUserTurn: async () => { throw new Error("Deferred means no user write yet"); } });
    assert.equal(result.outcome, stale ? "conversation_busy" : "claimed");
    if (stale) assert.equal(writes, 0);
    else assert.deepEqual(created.evidence.source_selection_binding, binding());
  }
});
test("terminal publication rejects a changed conversation or binding before any write or settlement", async () => {
  for (const initialOffer of [false, true]) {
    let writes = 0;
    const fence = { id: "attempt", chatTurnId: "turn", attempt: 1, conversationId: "conv", userId: "owner" };
    const row = { id: "attempt", chatTurnId: "turn", attempt: 1, status: "RUNNING", leaseExpiresAt: new Date(Date.now() + 60000),
      userMessageId: "current-user", evidence: initialOffer ? {} : { source_selection_binding: binding() },
      chatTurn: { id: "turn", attempt: 1, status: "RUNNING", conversationId: "conv", userId: "owner" } };
    const tx = { $executeRaw: async () => {}, ragAttempt: { findUnique: async () => row },
      conversationMessage: { findFirst: async () => ({ id: "newer-workflow-message", role: "ASSISTANT" }) },
      conversation: { findUnique: async () => { writes++; return { userId: "owner" }; } } };
    const result = await persistDone({ convId: "conv", userId: "owner", turnId: "turn", ragAttempt: fence,
      sourceSelectionBinding: initialOffer ? null : binding(), finalText: "Never publish stale answer",
      metadataExtra: initialOffer ? { workflow: recoveryWorkflow(sourceSelectionRecovery(offer(), "root-user")) } : {},
      settleUsage: async () => { writes++; } }, { prisma: { $transaction: callback => callback(tx) } });
    assert.equal(result, null); assert.equal(writes, 0);
  }
});
test("version/ACL change during answer withholds all old claims and returns refreshed offer", async () => {
  let published;
  const input = { persist: true, claimedTurn: { id: "turn" }, replyLang: "et", effectiveMessage: "teine",
    ragAttemptController: { fence: { attempt: 1 }, stage: async () => true, stop: () => {} },
    sourceSelectionTurn: { kind: "selected", rootUserMessageId: "root-user", options, context: context("teine"),
      partitions: [{ option: options[1], retrieval: retrieval(options[1]) }], recheck: async () => false,
      refresh: async () => options.map(option => ({ ...option, documentVersion: "v2" })) } };
  await handleSourceSelectionResponse(input, { finalizeAssistantReply: async output => {
    published = output; return { attachments: [], persisted: { durable: true } };
  } }, async (child, deps) => {
    await deps.finalizeAssistantReply({ reply: "Old fact must disappear.", sources: child.sources });
    return Response.json({ ok: true });
  });
  assert.doesNotMatch(published.reply, /Old fact/); assert.deepEqual(published.sources, []);
  assert.equal(published.ragTrace.source_selection.status, "changed");
  assert.equal(published.ragTrace.source_selection.parts[0].published, false);
  assert.equal(published.metadataExtra.workflow.ragRecovery.sourceSelection.options[0].documentVersion, "v2");
});

test("two different works cannot alias one displayed source", () => {
  assert.equal(createSourceSelection([options[0], { ...options[1], sourceId: options[0].sourceId }], "root-user"), null);
  assert.throws(() => composeSelectedReplies(options.map(option => ({ option: { ...option, sourceId: "shared" }, output: { reply: "x", sources: [] } }))), /ambiguous_source_id/);
});
test("deferred question rechecks selection snapshot after quota, before writing", async () => {
  let writes = 0;
  const fence = { id: "attempt", chatTurnId: "turn", attempt: 1, conversationId: "conv", userId: "owner" };
  const tx = { $executeRaw: async () => {}, ragAttempt: { findUnique: async () => ({ chatTurnId: "turn", attempt: 1, status: "RUNNING",
    leaseExpiresAt: new Date(Date.now() + 60000), evidence: { source_selection_binding: binding() },
    chatTurn: { id: "turn", attempt: 1, status: "RUNNING", conversationId: "conv", userId: "owner" } }) },
    conversationMessage: { findFirst: async () => ({ id: "newer-workflow-message" }) } };
  await assert.rejects(() => initializeClaimedChatTurn(fence, { userMessage: "mõlemad", expectedPreviousAssistantMessageId: "issuer" },
    { prisma: { $transaction: callback => callback(tx) }, writeUserTurn: async () => { writes++; } }), { code: "RAG_ATTEMPT_STALE" });
  assert.equal(writes, 0);
});
test("legacy workflow user write joins the same conversation lock before reading or mutating", async () => {
  const calls = [];
  const tx = { $executeRaw: async () => calls.push("lock"), conversation: {
    findUnique: async () => { calls.push("read"); return { id: "conv", userId: "owner", title: "fixture" }; },
    update: async () => calls.push("update") }, conversationMessage: { create: async () => { calls.push("user"); return { id: "user-message" }; } } };
  assert.equal(await persistInit({ convId: "conv", userId: "owner", userMessage: "fixture", role: "CLIENT" },
    { prisma: { $transaction: callback => callback(tx) } }), true);
  assert.equal(calls[0], "lock"); assert.ok(calls.indexOf("lock") < calls.indexOf("user"));
});
