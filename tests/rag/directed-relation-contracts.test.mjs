import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { buildQuestionPlan } from "../../lib/chat/questionPlanner.js";
import { buildSemanticTurnContract } from "../../lib/chat/semanticTurnContract.js";
import { groupMatches, buildContextWithBudget } from "../../lib/chat/ragContext.js";
import { buildRequestedQualitativeSlotContract } from "../../lib/chat/retrievalContextAssembler.js";
import {
  directedRelationPayloadMatches,
  directedRelationSetMatches,
  extractDirectedRelations,
  isDirectedRelationSlot
} from "../../lib/chat/directedRelationSemantics.js";
import { validateDirectedRelationReply } from "../../lib/chat/directedRelationContract.js";
import { validateExactFactAnswer } from "../../lib/chat/factContract.js";
import {
  hasValidatedDirectedRelationPublication,
  hasValidatedPublication,
  projectDirectedRelationEvidenceLocators,
  projectResponseDecision
} from "../../lib/chat/responsePolicy.js";
import { buildSourceAttribution } from "../../lib/chat/sourceAttribution.js";
import { buildRagTraceFromAttribution, handleMainChatResponse } from "../../lib/chat/mainResponseHandler.js";
import { projectRagTraceForLog, projectRagDiagnosticEvidence } from "../../lib/chat/ragDiagnostics.js";

const passage = "Eluasemepõhine lähenemine erineb otsustavalt arenenud riikides varem valitsenud käsitlusest, mille kohaselt pakutakse kodutule kõigepealt rehabilitatsiooni, ja alles seejärel omaette eluaset. Eluasemepõhine lähenemine lähtub põhimõttest: enne eluase ja siis (tegelikult samal ajal) rehabilitatsioon.";
const question = "Milline on eluaseme ja rehabilitatsiooni järjekord kahes lähenemises, mida võrreldakse 2017. aasta artiklis „Trepist üles või alla. Eesti vajab tulemuslikumat kodutuse poliitikat”?";
const alternate = "2017. aasta artikli „Trepist üles või alla…” järgi: kummas järjekorras käivad eluase ja rehabilitatsioon kahes lähenemises?";
const identity = { required: true, matched: true, confidence: "high", selectedDocumentId: "directed-doc" };
const sha = value => createHash("sha256").update(String(value || "")).digest("hex");

function setup({ message = question, bodies = [passage], metadata = {}, replyLang = "et", budget = {} } = {}) {
  const plan = buildQuestionPlan({ message });
  const matches = bodies.map((text, index) => ({ text, metadata: {
    doc_id: "directed-doc", source_id: "directed-source", chunk_id: `directed-chunk-${index}`,
    document_version: "fixture-v1", source_status: "active", source_type: "journal_article",
    collection_id: "journal_articles", title: "Trepist üles või alla", ...metadata
  } }));
  const rendered = buildContextWithBudget(groupMatches(matches), budget);
  const built = buildRequestedQualitativeSlotContract({
    questionPlan: plan, renderedGroups: rendered.used, renderedBlocks: rendered.renderedBlocks,
    replyLang, specificResearchFactQuestion: true, documentIdentityEvidence: identity
  });
  const meta = {
    documentIdentityEvidence: identity,
    requestedQualitativeSlotContract: built.trace,
    queryPlan: {
      mode: "specific_research_fact",
      semantic_turn_contract: buildSemanticTurnContract({ questionPlan: plan })
    }
  };
  const sources = rendered.used.map((group, index) => ({
    document_id: group.docId, source_id: group.sourceId, source_status: group.sourceStatus,
    source_type: group.sourceType, collection_id: group.collectionId, title: group.title,
    evidenceText: rendered.renderedBlocks[index].text,
    rendered_body_hash: rendered.renderedBlocks[index].renderedBodyHash,
    rendered_body_spans: rendered.renderedBlocks[index].bodySpans, rendered_block_index: index
  }));
  const validate = (reply = null, lang = replyLang) => validateDirectedRelationReply({
    retrievalMeta: meta, sources, reply, replyLang: lang
  });
  return { plan, matches, rendered, built, meta, sources, validate };
}

test("F08 wordings produce one source-derived directed relation set", () => {
  for (const message of [question, alternate]) {
    const fixture = setup({ message });
    const slots = fixture.plan.semantic_candidates.requested_fact_slots.slots;
    assert.equal(slots.length, 1);
    assert.equal(isDirectedRelationSlot(slots[0]), true);
    assert.equal(slots[0].expected_cardinality, 2);
    assert.doesNotMatch(JSON.stringify(slots), /varem valitsenud|eluasemepõhine|rehabilitatsioon.*BEFORE/iu);
    assert.equal(fixture.built.trace.complete, true, JSON.stringify(fixture.built));
    const validation = fixture.validate();
    assert.equal(validation.passed, true, JSON.stringify(validation));
    assert.match(validation.reply, /Varem valitsenud käsitlus: esmalt rehabilitatsioon, seejärel eluase/u);
    assert.match(validation.reply, /Eluasemepõhine lähenemine: esmalt eluase, seejärel rehabilitatsioon/u);
    assert.match(validation.reply, /tegelikult toimuvad need samal ajal/u);
  }
});

test("simple help questions for a client, social worker or service specialist never enter the F08 gate", () => {
  for (const input of [
    { role: "client", message: "Mul ei ole täna ööbimiskohta. Kust ma abi saan?" },
    { role: "social_worker", message: "Kuhu saan kliendi täna öömajale suunata?" },
    { role: "specialist", message: "Kuidas selgitada inimesele meie teenuse järgmist sammu?" }
  ]) {
    const plan = buildQuestionPlan(input);
    assert.equal(plan.semantic_candidates.requested_fact_slots.slots.some(isDirectedRelationSlot), false);
  }
});

test("relative clause owns the earlier approach and simultaneity remains an explicit alternative", () => {
  const parsed = extractDirectedRelations(passage);
  assert.equal(parsed.status, "ADMITTED");
  assert.equal(parsed.candidates.length, 2);
  assert.deepEqual(parsed.candidates.map(item => ({
    approach: item.approach, event_a: item.event_a, relations: item.relations, event_b: item.event_b
  })), [{
    approach: "Varem valitsenud käsitlus", event_a: "rehabilitatsioon", relations: ["BEFORE"], event_b: "eluase"
  }, {
    approach: "Eluasemepõhine lähenemine", event_a: "eluase", relations: ["BEFORE", "OVERLAPS"], event_b: "rehabilitatsioon"
  }]);
});

test("A BEFORE B and B AFTER A are equivalent, but direction and OVERLAPS are not interchangeable", () => {
  const before = { approach: "Mudel", event_a: "hindamine", relations: ["BEFORE"], event_b: "otsus", polarity: "positive", qualifiers: [] };
  const inverse = { ...before, event_a: "otsus", relations: ["AFTER"], event_b: "hindamine" };
  assert.equal(directedRelationPayloadMatches(before, inverse), true);
  assert.equal(directedRelationPayloadMatches(before, { ...inverse, relations: ["BEFORE"] }), false);
  assert.equal(directedRelationPayloadMatches(before, { ...before, relations: ["BEFORE", "OVERLAPS"], qualifiers: ["corrective_simultaneity"] }), false);
});

test("semantic reply validation accepts inverse wording and rejects wrong ownership, direction and lost simultaneity", () => {
  const fixture = setup();
  const inverse = [
    "Varem valitsenud käsitlus: eluase pärast rehabilitatsiooni.",
    "Eluasemepõhine lähenemine: rehabilitatsioon pärast eluaset, tegelikult samal ajal."
  ].join("\n");
  assert.equal(fixture.validate(inverse).passed, true);
  const wrongDirection = [
    "Varem valitsenud käsitlus: esmalt eluase, seejärel rehabilitatsioon.",
    "Eluasemepõhine lähenemine: esmalt eluase, seejärel rehabilitatsioon, tegelikult samal ajal."
  ].join("\n");
  assert.equal(fixture.validate(wrongDirection).trace.reason, "directed_relation_rendered_reply_mismatch");
  const noOverlap = fixture.validate().reply.replace(/; allikas täpsustab[^.]+/u, "");
  assert.equal(fixture.validate(noOverlap).trace.reason, "directed_relation_rendered_reply_mismatch");
  const wrongOwner = fixture.validate().reply
    .replace("Varem valitsenud käsitlus", "VAHETA")
    .replace("Eluasemepõhine lähenemine", "Varem valitsenud käsitlus")
    .replace("VAHETA", "Eluasemepõhine lähenemine");
  assert.equal(fixture.validate(wrongOwner).trace.reason, "directed_relation_rendered_reply_mismatch");
  const borrowedOverlap = [
    "Varem valitsenud käsitlus: esmalt rehabilitatsioon, seejärel eluase.",
    "Eluasemepõhine lähenemine: esmalt eluase, seejärel rehabilitatsioon; tugi toimub samal ajal lõunasöögiga."
  ].join("\n");
  assert.equal(fixture.validate(borrowedOverlap).trace.reason, "directed_relation_rendered_reply_mismatch");
  const oneLineBorrowing = "Varem valitsenud käsitlus: esmalt rehabilitatsioon, seejärel eluase; Eluasemepõhine lähenemine: esmalt eluase, seejärel rehabilitatsioon, tegelikult samal ajal.";
  assert.equal(fixture.validate(oneLineBorrowing).trace.reason, "directed_relation_rendered_reply_mismatch");
});

test("a second independent pair passes the full planner-contract-validator path without F08 terms", () => {
  const independent = "Tavamenetluses tehakse esmalt hindamine ja alles seejärel otsus. Kiirmenetluses tehakse otsus enne hindamist, tegelikult hindamisega kattudes.";
  const parsed = extractDirectedRelations(independent);
  assert.equal(parsed.status, "ADMITTED", JSON.stringify(parsed));
  assert.equal(parsed.candidates.length, 2);
  assert.equal(directedRelationSetMatches(parsed.candidates, [{
    approach: "Tavamenetluses", event_a: "hindamine", relations: ["BEFORE"], event_b: "otsus", polarity: "positive", qualifiers: []
  }, {
    approach: "Kiirmenetluses", event_a: "otsus", relations: ["BEFORE", "OVERLAPS"], event_b: "hindamine", polarity: "positive", qualifiers: ["corrective_simultaneity"]
  }]), true);
  const fixture = setup({
    message: "Milline on hindamise ja otsuse järjekord kahes menetluses?",
    bodies: [independent]
  });
  assert.deepEqual(fixture.plan.semantic_candidates.requested_fact_slots.slots[0].requested_event_keys,
    ["hindamine", "otsus"]);
  assert.equal(fixture.built.trace.complete, true, JSON.stringify(fixture.built.trace));
  assert.equal(fixture.validate().passed, true);
  assert.match(fixture.validate().reply, /Tavamenetlus|Tavamenetluses/u);
  assert.match(fixture.validate().reply, /Kiirmenetlus|Kiirmenetluses/u);
});

test("the contract binds the source pair to the events asked in the question", () => {
  const independent = "Tavamenetluses tehakse esmalt hindamine ja alles seejärel otsus. Kiirmenetluses tehakse otsus enne hindamist, tegelikult hindamisega kattudes.";
  const wrongForF08 = setup({ bodies: [independent] });
  assert.equal(wrongForF08.built.trace.complete, false);
  assert.equal(wrongForF08.built.trace.reason, "directed_relation_cardinality_mismatch");
  const wrongForIndependent = setup({
    message: "Milline on hindamise ja otsuse järjekord kahes menetluses?",
    bodies: [passage]
  });
  assert.equal(wrongForIndependent.built.trace.complete, false);
  for (const bodies of [[independent, passage], [passage, independent]]) {
    const fixture = setup({ bodies });
    assert.equal(fixture.built.trace.complete, true, JSON.stringify(fixture.built.trace));
    assert.equal(fixture.validate().passed, true);
    assert.match(fixture.validate().reply, /rehabilitatsioon/u);
    assert.doesNotMatch(fixture.validate().reply, /hindamine|otsus/u);
  }
});

test("conditional, negated, conflicting and incomplete evidence fails closed", () => {
  for (const body of [
    passage.replace("enne eluase", "kui tugi on olemas, enne eluase"),
    passage.replace("enne eluase", "mitte enne eluase"),
    passage.replace(" ja siis (tegelikult samal ajal) rehabilitatsioon", ""),
    `Ei ole tõsi, et ${passage}`,
    `Kui autor oletab, siis ${passage}`
  ]) {
    const fixture = setup({ bodies: [body] });
    assert.equal(fixture.built.trace.complete, false);
    assert.equal(fixture.validate().passed, false);
  }
  const conflict = `${passage} Eluasemepõhine lähenemine lähtub põhimõttest: kõigepealt rehabilitatsioon ja alles seejärel eluase.`;
  const fixture = setup({ bodies: [conflict] });
  assert.equal(fixture.built.trace.complete, false);
  assert.match(fixture.built.trace.reason, /conflict/u);
  const unrelatedOverlap = "Tavamenetluses tehakse esmalt hindamine ja alles seejärel otsus. Kiirmenetluses tehakse otsus enne hindamist, samal ajal toimub lõunasöök.";
  const unrelated = setup({
    message: "Milline on hindamise ja otsuse järjekord kahes menetluses?",
    bodies: [unrelatedOverlap]
  });
  assert.equal(unrelated.built.trace.complete, true);
  assert.equal(unrelated.validate().passed, true);
  assert.doesNotMatch(unrelated.validate().reply, /samal ajal|overlap/iu);
});

test("locators bind rendered body, original chunk, active source and one immutable version", () => {
  const prefix = "Sissejuhatus 😀.\n";
  const fixture = setup({ bodies: [prefix + passage] });
  assert.equal(fixture.built.trace.complete, true, JSON.stringify(fixture.built.trace));
  const locators = fixture.built.trace.slots[0].evidence_locators;
  assert.equal(locators.length, 2);
  const first = [...locators].sort((left, right) => left.start - right.start)[0];
  assert.equal(first.start, prefix.length);
  assert.equal(first.chunk_start, prefix.length);
  assert.equal(first.fragment_hash, sha(passage.slice(0, passage.indexOf(" Eluasemepõhine lähenemine lähtub"))));
  assert.equal(fixture.validate().passed, true);
  assert.equal(hasValidatedDirectedRelationPublication(fixture.validate().trace, fixture.validate().reply), true);
});

test("body, hash, coordinates and version mutations cannot authorize publication", () => {
  const fixture = setup();
  const mutations = [];
  const changedBody = structuredClone(fixture.sources);
  changedBody[0].evidenceText = changedBody[0].evidenceText.replace("rehabilitatsiooni", "nõustamist");
  mutations.push({ sources: changedBody, meta: fixture.meta });
  const changedHash = structuredClone(fixture.meta);
  changedHash.requestedQualitativeSlotContract.slots[0].evidence_locators[0].fragment_hash = "0".repeat(64);
  mutations.push({ sources: fixture.sources, meta: changedHash });
  const changedCoordinate = structuredClone(fixture.meta);
  changedCoordinate.requestedQualitativeSlotContract.slots[0].evidence_locators[0].start += 1;
  mutations.push({ sources: fixture.sources, meta: changedCoordinate });
  const changedVersion = structuredClone(fixture.meta);
  changedVersion.requestedQualitativeSlotContract.slots[0].evidence_locators[0].document_version = "fixture-v2";
  mutations.push({ sources: fixture.sources, meta: changedVersion });
  for (const mutation of mutations) {
    const result = validateDirectedRelationReply({ retrievalMeta: mutation.meta, sources: mutation.sources, replyLang: "et" });
    assert.equal(result.passed, false);
    assert.equal(hasValidatedPublication(result.trace, result.reply), false);
  }
});

test("publication gate requires both validated locator atoms and the canonical reply hash", () => {
  const result = setup().validate();
  assert.equal(hasValidatedPublication(result.trace, result.reply), true);
  for (const trace of [
    { ...result.trace, directed_relation_evidence_locators: [] },
    { ...result.trace, directed_relation_evidence_locators: result.trace.directed_relation_evidence_locators.slice(0, 1) },
    { ...result.trace, directed_relation_evidence_locators: result.trace.directed_relation_evidence_locators.map(item => ({ ...item, relation_index: 1 })) },
    { ...result.trace, response_decision: { ...result.trace.response_decision, validated_reply_hash: "0".repeat(64) } }
  ]) assert.equal(hasValidatedPublication(trace, result.reply), false);
  assert.equal(hasValidatedPublication(result.trace, result.reply + " Lisand."), false);
});

test("generic exact-fact validator delegates to the typed directed contract", () => {
  const fixture = setup();
  const result = validateExactFactAnswer({ message: question, reply: fixture.validate().reply,
    sources: fixture.sources, retrievalMeta: fixture.meta, replyLang: "et" });
  assert.equal(result.passed, true);
  assert.equal(result.trace.version, "directed_relation_contract_v1");
});

test("actual handler publishes the canonical answer in JSON and SSE without a model call", async () => {
  for (const wantStream of [false, true]) {
    const fixture = setup();
    let finalized;
    let modelCalls = 0;
    const noProvider = async () => { modelCalls += 1; throw new Error("Unexpected model call"); };
    const response = await handleMainChatResponse({
      req: new Request("http://localhost/api/chat"), wantStream, persist: false,
      convId: "directed-fixture-conversation", userId: "directed-fixture-user", normalizedRole: "USER",
      effectiveMessage: question, history: [], effectiveContext: fixture.rendered.text, replyLang: "et",
      isCrisis: false, extraSystemInstructions: [], sources: fixture.sources, retrievalMeta: fixture.meta,
      metadataExtra: {}, wantsDocumentDownload: false,
      makeError: (message, status) => new Response(message, { status })
    }, {
      callOpenAI: noProvider, streamOpenAI: noProvider,
      finalizeAssistantReply: async input => {
        finalized = input;
        return { attachments: [], persisted: { required: false } };
      }
    });
    assert.equal(response.status, 200);
    assert.equal(modelCalls, 0);
    assert.equal(finalized.reply, fixture.validate().reply);
    assert.deepEqual(finalized.sources.map(source => source.source_id), ["directed-source"]);
    const output = wantStream ? await response.text() : await response.json();
    if (wantStream) {
      const delta = output.match(/event: delta\ndata: ([^\n]+)/u);
      assert.equal(JSON.parse(delta[1]).t, finalized.reply);
      assert.match(output, /event: done/u);
    } else {
      assert.equal(output.reply, finalized.reply);
      assert.deepEqual(output.displayed_sources.map(source => source.source_id), ["directed-source"]);
    }
  }
});

test("trace projection keeps relation hashes and coordinates but drops source text", () => {
  const fixture = setup();
  const validation = fixture.validate();
  const attribution = buildSourceAttribution(validation.reply, fixture.sources, {
    query: question, queryPlan: fixture.meta.queryPlan, factValidation: validation.trace,
    documentIdentityEvidence: identity
  });
  const trace = buildRagTraceFromAttribution(fixture.sources, attribution, {
    ...fixture.meta, factValidation: validation.trace, requestedQualitativeSlotContract: fixture.built.trace
  });
  for (const projected of [projectRagDiagnosticEvidence(trace), projectRagDiagnosticEvidence(projectRagTraceForLog(trace))]) {
    assert.equal(projected.qualitative_contract.slots[0].payload_kind, "directed_event_relation_set");
    assert.equal(projected.validation.response_decision.issuer, "directed_relation_contract_v1");
    assert.equal(projected.validation.directed_relation_evidence_locators.length, 2);
    assert.doesNotMatch(JSON.stringify(projected), /Eluasemepõhine|rehabilitatsioon|varem valitsenud/u);
  }
  assert.equal(projectResponseDecision({ ...validation.trace.response_decision, secret: "hidden" }).secret, undefined);
  assert.equal(projectDirectedRelationEvidenceLocators([{ ...validation.trace.directed_relation_evidence_locators[0], raw: passage }])[0].raw, undefined);
});
