import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { buildQuestionPlan } from "../../lib/chat/questionPlanner.js";
import { buildSemanticTurnContract } from "../../lib/chat/semanticTurnContract.js";
import { groupMatches, buildContextWithBudget } from "../../lib/chat/ragContext.js";
import { buildRequestedQualitativeSlotContract } from "../../lib/chat/retrievalContextAssembler.js";
import { extractGroupFacts, groupRequirementForClause } from "../../lib/chat/groupFactSemantics.js";
import { validateGroupFactReply } from "../../lib/chat/groupFactContract.js";
import { validateExactFactAnswer } from "../../lib/chat/factContract.js";
import { hasValidatedPublication, projectResponseDecision, projectGroupEvidenceLocators } from "../../lib/chat/responsePolicy.js";
import { resolveValidationRecovery } from "../../lib/chat/conversationalRecovery.js";
import { buildSourceAttribution } from "../../lib/chat/sourceAttribution.js";
import { buildRagTraceFromAttribution, handleMainChatResponse } from "../../lib/chat/mainResponseHandler.js";
import { buildRagDiagnostics, projectRagTraceForLog, projectRagDiagnosticEvidence } from "../../lib/chat/ragDiagnostics.js";

// Public Toobal 2016 source paragraph; synthetic IDs below are fixture-only.
const passage = "Pilootprojektis osalevad kuus omavalitsust. Kolm nendest – Kuressaare ja Põltsamaa linn ning Põlva vald – viivad ellu spetsiaalse sekkumiskava, ülejäänud kolmes (kontrollomavalitsusi ei avalikustata) sekkumistegevusi ei toimu.";
const question = "Kuidas jaotati omavalitsused 2014. aastal alanud alkoholipoliitika pilootprojektis ning millised omavalitsused rakendasid sekkumiskava Triinu Toobali 2016. aasta artikli järgi?";
const alternate = "Kuidas jagunesid pilootprojekti omavalitsused sekkumis- ja kontrollrühma ning millised omavalitsused viivad ellu sekkumiskava?";
const identity = { required: true, matched: true, confidence: "high", selectedDocumentId: "group-doc" };
const sha = text => createHash("sha256").update(text).digest("hex");

function setup({ message = question, bodies = [passage], metadata = {}, budget = {} } = {}) {
  const plan = buildQuestionPlan({ message });
  const matches = bodies.map((text, index) => ({ text, metadata: {
    doc_id: "group-doc", source_id: "group-source", chunk_id: "group-chunk-" + index,
    document_version: "fixture-v1", source_status: "active", source_type: "journal_article",
    collection_id: "journal_articles", title: "Alkoholipoliitika kohalikul tasandil", ...metadata
  } }));
  const rendered = buildContextWithBudget(groupMatches(matches), budget);
  const built = buildRequestedQualitativeSlotContract({ questionPlan: plan, renderedGroups: rendered.used,
    renderedBlocks: rendered.renderedBlocks, replyLang: "et", specificResearchFactQuestion: true, documentIdentityEvidence: identity });
  const meta = { documentIdentityEvidence: identity, requestedQualitativeSlotContract: built.trace,
    queryPlan: { mode: "specific_research_fact", semantic_turn_contract: buildSemanticTurnContract({ questionPlan: plan }) } };
  const sources = rendered.used.map((group, index) => ({ document_id: group.docId, source_id: group.sourceId,
    source_status: group.sourceStatus, source_type: group.sourceType, collection_id: group.collectionId,
    title: group.title, evidenceText: rendered.renderedBlocks[index].text,
    rendered_body_hash: rendered.renderedBlocks[index].renderedBodyHash,
    rendered_body_spans: rendered.renderedBlocks[index].bodySpans, rendered_block_index: index }));
  const validate = (reply = null, replyLang = "et") => validateGroupFactReply({ retrievalMeta: meta, sources, reply, replyLang });
  return { plan, built, meta, sources, validate, rendered, matches };
}

test("both F06 wordings produce canonical distribution and exhaustive membership without an answer key", () => {
  for (const message of [question, alternate]) {
    const { plan, built, validate } = setup({ message });
    const slots = plan.semantic_candidates.requested_fact_slots.slots;
    assert.deepEqual(slots.map(slot => slot.payload_kind), ["group_distribution", "group_membership"]);
    assert.equal(slots[1].completeness_required, true);
    assert.doesNotMatch(JSON.stringify(slots), /Kuressaare|Põltsamaa|Põlva|declared_count/u);
    assert.equal(built.trace.complete, true, JSON.stringify(built));
    const result = validate();
    assert.equal(result?.passed, true, JSON.stringify(result));
    assert.match(result.reply, /6 omavalitsuse.*rühmas 3.*kontrollrühmas 3/u);
    assert.match(result.reply, /Kuressaare linn, Põltsamaa linn, Põlva vald/u);
  }
});

test("locator binds literal source, rendered body and retrieved version with exact UTF16 offsets", () => {
  const prefix = "Sissejuhatus 😀.\n";
  const { built, validate } = setup({ bodies: [prefix + passage] });
  const locator = built.trace.slots[0].evidence_locator;
  assert.equal(locator.start, prefix.length);
  assert.equal(locator.chunk_start, prefix.length);
  assert.equal(locator.fragment_hash, sha(passage));
  assert.equal(locator.chunk_hash, sha(prefix + passage));
  assert.equal(validate().passed, true);
});

test("independent counts and mixed explicit/shared municipal heads are source-derived", () => {
  const other = passage.replace("kuus", "seitse").replace("Kolm", "Kaks")
    .replace("Kuressaare ja Põltsamaa linn ning Põlva vald", "Aru vald ja Laane linn").replace("kolmes", "viies");
  const result = setup({ bodies: [other] }).validate();
  assert.equal(result.passed, true, JSON.stringify(result));
  assert.match(result.reply, /7 omavalitsuse.*rühmas 2.*kontrollrühmas 5/u);
  assert.match(result.reply, /Aru vald, Laane linn/u);
  const digits = setup({ bodies: [passage.replace("kuus", "6").replace("Kolm", "3").replace("kolmes", "3")] }).validate();
  assert.equal(digits.passed, true);
});

test("question clause order changes reply order without swapping evidence roles", () => {
  const fixture = setup({ message: "Millised omavalitsused rakendasid sekkumiskava ning kuidas jaotati pilootprojekti omavalitsused?" });
  const result = fixture.validate();
  assert.equal(result.passed, true, JSON.stringify(result));
  assert.match(result.reply.split("\n")[0], /Sekkumiskava rakendavad omavalitsused/u);
  assert.match(result.reply.split("\n")[1], /6 omavalitsuse/u);
});

test("unknown or example membership allows only the independently proven distribution", () => {
  for (const body of [passage.replace(/– .* – /u, ""), passage.replace("Kuressaare", "näiteks Kuressaare")]) {
    const { validate, sources, meta } = setup({ bodies: [body] });
    const result = validate();
    assert.equal(result.passed, false);
    assert.equal(hasValidatedPublication(result.trace, result.reply), true, JSON.stringify(result));
    assert.equal(result.trace.response_decision.semantic_outcome, "PARTIAL");
    assert.deepEqual(result.trace.response_decision.missing_slot_indexes, [2]);
    assert.doesNotMatch(result.reply, /Kuressaare/u);
    const recovery = resolveValidationRecovery({ fallbackReply: result.reply, validationTrace: result.trace });
    assert.equal(recovery.reply, result.reply);
    assert.equal(recovery.recovery, null);
    const attribution = buildSourceAttribution(result.reply, sources, { query: question, queryPlan: meta.queryPlan,
      factValidation: result.trace, documentIdentityEvidence: identity });
    assert.deepEqual(attribution.displayed_source_ids, ["group-source"]);
    assert.deepEqual(attribution.validated_supporting_source_ids, ["group-source"]);
    assert.deepEqual(attribution.answer_source_ids, ["group-source"]);
    const exact = validateExactFactAnswer({ message: question, reply: result.reply, retrievalMeta: meta, sources });
    assert.equal(exact.passed, false);
    assert.equal(hasValidatedPublication(exact.trace, exact.reply), true);
  }
});

test("canonical reply authorization does not authorize wrong, missing or extra claims", () => {
  const { validate } = setup();
  const { reply } = validate();
  for (const wrong of [reply.replace("6 omavalitsuse", "8 omavalitsuse"),
    reply.replace("rühmas 3", "rühmas 2"), reply.replace("Kuressaare linn", "Saaremaa vald"),
    reply.replace("Põlva vald", "Põlva linn"), reply.replace("rakendavad", "ei rakenda"),
    reply.split("\n")[0], reply + "\nKõik kontrollomavalitsused on Tallinnas.",
    reply.replace("Kuressaare linn,", "Kuressaare linn, Kuressaare linn,")]) {
    assert.equal(hasValidatedPublication(validate(wrong).trace, wrong), false, wrong);
  }
});

test("negated questions and mixed unsupported requirements cannot reuse positive membership", () => {
  assert.equal(groupRequirementForClause("Millised omavalitsused ei rakendanud sekkumiskava?", "entity_list").group_role, "unsupported");
  assert.equal(hasValidatedPublication(setup({ message: question.replace("rakendasid", "ei rakendanud") }).validate()?.trace), false);
  const mixed = setup();
  mixed.meta.queryPlan.semantic_turn_contract.requested_facts.push({ index: 3, value_type: "money" });
  assert.equal(hasValidatedPublication(mixed.validate().trace), false);
});

test("false scope, polarity, relation, duplicate and count evidence cannot be admitted", () => {
  for (const body of [
    passage.replace("kuus", "seitse"), passage.replace("Põltsamaa", "Kuressaare"),
    passage.replace("viivad ellu", "ei vii ellu"), passage.replace("viivad ellu", "kavatsevad ellu viia"),
    "Kui rahastus leitakse, siis " + passage,
    "Järgmine kirjeldus on väär: „" + passage + "”",
    "Järgmine kirjeldus on väär:\n" + passage,
    "Kui rahastus leitakse, siis:\n" + passage,
    "Järgnevalt kirjeldatakse teist pilootprojekti, mitte alkoholipoliitika projekti.\n" + passage,
    passage + "\nSee jaotus ja nimekiri ei vasta tegelikkusele.",
    passage + " Kontrollrühmas toimusid sekkumistegevused.",
    passage + " Kuressaare linn ei rakendanud sekkumiskava.",
    passage + " Üks omavalitsus kuulus mõlemasse rühma.",
    passage.replace(". Kolm nendest", ". Koosolekul osales kuus inimest. Kolm nendest")
  ]) {
    assert.notEqual(extractGroupFacts(body).status, "ADMITTED", body);
    assert.equal(hasValidatedPublication(setup({ bodies: [body] }).validate()?.trace), false, body);
  }
});

test("conflicting source bodies or versions are not decided by ordering", () => {
  const wrong = passage.replace("kuus", "seitse").replace("kolmes", "neljas");
  const samePrefixConflict = passage + " Kontrollrühmas toimusid sekkumistegevused.";
  for (const bodies of [[passage, wrong], [wrong, passage], [passage, samePrefixConflict], [samePrefixConflict, passage]]) {
    assert.equal(hasValidatedPublication(setup({ bodies }).validate().trace), false);
  }
  for (const metadata of [{ document_version: null }, { source_status: "inactive" }]) {
    assert.equal(hasValidatedPublication(setup({ metadata }).validate().trace), false);
  }
});

test("source mutations, swapped identity and duplicate slot assignments invalidate publication", () => {
  for (const mutate of [
    fixture => { fixture.sources[0].evidenceText += " "; },
    fixture => { fixture.sources[0].document_id = "another-doc"; },
    fixture => { fixture.sources[0].source_status = "inactive"; },
    fixture => { fixture.sources[0].rendered_body_spans[0].provenance[0].document_version = "v2"; },
    fixture => { fixture.built.trace.slots.push(structuredClone(fixture.built.trace.slots[0])); },
    fixture => { fixture.built.trace.slots[0].admitted_payload.total = 99; }
  ]) {
    const fixture = setup();
    mutate(fixture);
    assert.equal(hasValidatedPublication(fixture.validate().trace), false);
  }
});

test("locators cannot point at an unrelated fragment or fabricated raw/rendered coordinates", () => {
  for (const mutate of [
    locator => { locator.chunk_start += 1; },
    locator => { locator.chunk_end -= 1; },
    locator => { locator.rendered_block_index = 3; },
    locator => { locator.offset_basis = "bytes"; },
    locator => { locator.chunk_offset_basis = "bytes"; },
    locator => { locator.end = "Pilootprojektis".length; locator.chunk_end = locator.end; locator.fragment_hash = sha("Pilootprojektis"); }
  ]) {
    const fixture = setup();
    mutate(fixture.built.trace.slots[0].evidence_locator);
    assert.equal(hasValidatedPublication(fixture.validate().trace), false);
  }
});

test("requested population cannot borrow another project in the identified document", () => {
  const result = setup({ bodies: [passage.replace("Pilootprojektis", "Naaberprojektis")] }).validate();
  assert.equal(result.trace.reason, "group_population_mismatch");
  assert.equal(hasValidatedPublication(result.trace), false);
});

test("later rejection and invalid decision index sets revoke partial publication", () => {
  const { trace, reply } = setup({ bodies: [passage.replace(/– .* – /u, "")] }).validate();
  for (const changed of [{ ...trace, reason: "document_identity_unconfirmed" },
    { ...trace, document_identity_matched: false },
    { ...trace, response_decision: { ...trace.response_decision, admitted_slot_indexes: [1, 1] } },
    { ...trace, response_decision: { ...trace.response_decision, admitted_slot_indexes: [1, 2] } }]) {
    assert.equal(hasValidatedPublication(changed, reply), false);
  }
});

test("new deterministic group path respects existing domain and current-evidence boundaries", () => {
  for (const patch of [{ semantic_turn_contract: { domain_scope: { effective: "out_of_scope" } } },
    { temporal_query_contract: { current_evidence_scope: "current" } }]) {
    const fixture = setup();
    fixture.meta.queryPlan = { ...fixture.meta.queryPlan, ...patch,
      semantic_turn_contract: { ...fixture.meta.queryPlan.semantic_turn_contract, ...patch.semantic_turn_contract } };
    assert.equal(fixture.validate().trace.reason, "group_scope_not_eligible");
  }
});

test("URL display rewriting never invents an original chunk coordinate", () => {
  const prefix = "Viide https://xn--e1afmkfd.xn--p1ai/path.\n";
  const fixture = setup({ bodies: [prefix + passage] });
  const result = fixture.validate();
  assert.notEqual(fixture.rendered.renderedBlocks[0].evidenceText, prefix + passage);
  assert.equal(result.trace.reason, "group_locator_missing");
});

test("duplicate bodies cannot conceal a missing/inactive/different-version provenance record", () => {
  const fixture = setup();
  for (const metadata of [{ source_status: "inactive" }, { document_version: "fixture-v2" }, { document_version: null }]) {
    const duplicate = { ...fixture.matches[0], metadata: { ...fixture.matches[0].metadata, ...metadata } };
    for (const matches of [[fixture.matches[0], duplicate], [duplicate, fixture.matches[0]]]) {
      const rendered = buildContextWithBudget(groupMatches(matches));
      const built = buildRequestedQualitativeSlotContract({ questionPlan: fixture.plan,
        renderedGroups: rendered.used, renderedBlocks: rendered.renderedBlocks,
        specificResearchFactQuestion: true, documentIdentityEvidence: identity });
      assert.equal(built.trace.complete, false, JSON.stringify(built));
    }
  }
});

test("a clipped conditional frame cannot turn the inner paragraph into an unconditional fact", () => {
  const prefix = "Kui rahastus leitakse, siis:\n";
  const fixture = setup({ bodies: [prefix + passage] });
  // Simulate a literal renderer clip; keep the independent original-body proof.
  const block = fixture.rendered.renderedBlocks[0];
  block.evidenceText = passage;
  block.renderedBodyHash = sha(passage);
  block.bodySpans[0] = { ...block.bodySpans[0], rendered_start_offset: 0, rendered_end_offset: passage.length,
    rendered_body_hash: sha(passage), literal_original_start: prefix.length };
  const built = buildRequestedQualitativeSlotContract({ questionPlan: fixture.plan,
    renderedGroups: fixture.rendered.used, renderedBlocks: [block],
    specificResearchFactQuestion: true, documentIdentityEvidence: identity });
  assert.equal(built.trace.complete, false);
});

test("language rendering changes labels but never historical municipality identity", () => {
  const fixture = setup();
  for (const lang of ["en", "ru"]) {
    const result = fixture.validate(null, lang);
    assert.equal(result.passed, true);
    assert.match(result.reply, /Kuressaare|Põltsamaa|Põlva/u);
  }
});

test("source attribution only displays the source of the validated actual reply", () => {
  const { validate, sources, meta } = setup();
  const result = validate();
  const extra = { ...sources[0], source_id: "unrelated", document_id: "unrelated-doc" };
  const options = { query: question, queryPlan: meta.queryPlan, factValidation: result.trace, documentIdentityEvidence: identity };
  assert.deepEqual(buildSourceAttribution(result.reply, [...sources, extra], options).displayed_source_ids, ["group-source"]);
  assert.deepEqual(buildSourceAttribution(result.reply + " Unsupported.", sources, options).displayed_source_ids, []);
  const partial = setup({ bodies: [passage.replace(/– .* – /u, "")] }).validate();
  assert.deepEqual(buildSourceAttribution(partial.reply + " Unsupported.", sources,
    { ...options, factValidation: partial.trace }).displayed_source_ids, []);
});

test("actual handler delivers and finalizes the same full/partial reply in JSON and SSE without model calls", async () => {
  for (const body of [passage, passage.replace(/– .* – /u, "")]) {
    for (const wantStream of [false, true]) {
      const fixture = setup({ bodies: [body] });
      let finalized;
      let modelCalls = 0;
      const noProvider = async () => { modelCalls += 1; throw new Error("Unexpected model call"); };
      const response = await handleMainChatResponse({
        req: new Request("http://localhost/api/chat"), wantStream, persist: false, convId: "fixture-conversation",
        userId: "fixture-user", normalizedRole: "USER", effectiveMessage: question, history: [],
        effectiveContext: fixture.rendered.text, replyLang: "et", isCrisis: false, extraSystemInstructions: [],
        sources: fixture.sources, retrievalMeta: fixture.meta, metadataExtra: {}, wantsDocumentDownload: false,
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
      assert.deepEqual(finalized.sources.map(source => source.source_id), ["group-source"]);
      const output = wantStream ? await response.text() : await response.json();
      if (wantStream) {
        const delta = output.match(/event: delta\ndata: ([^\n]+)/u);
        assert.equal(JSON.parse(delta[1]).t, finalized.reply);
        assert.match(output, /event: done/u);
      } else {
        assert.equal(output.reply, finalized.reply);
        assert.deepEqual(output.displayed_sources.map(source => source.source_id), ["group-source"]);
      }
    }
  }
});

test("stored trace and log round-trip preserve partial decision and evidence locators without member text", () => {
  const { validate, built, meta, sources } = setup({ bodies: [passage.replace(/– .* – /u, "")] });
  const result = validate();
  const attribution = buildSourceAttribution(result.reply, sources, { query: question, queryPlan: meta.queryPlan,
    factValidation: result.trace, documentIdentityEvidence: identity });
  const trace = buildRagTraceFromAttribution(sources, attribution, { ...meta, factValidation: result.trace,
    requestedQualitativeSlotContract: built.trace });
  for (const projected of [projectRagDiagnosticEvidence(trace), projectRagDiagnosticEvidence(projectRagTraceForLog(trace))]) {
    assert.equal(projected.qualitative_contract.slots[0].payload_kind, "group_distribution");
    assert.equal(projected.validation.response_decision.semantic_outcome, "PARTIAL");
    assert.equal(projected.validation.group_evidence_locators[0].document_version, "fixture-v1");
    assert.doesNotMatch(JSON.stringify(projected), /Kuressaare|Põltsamaa|Põlva|sekkumiskava rakendavad/u);
  }
  const diagnostics = buildRagDiagnostics({ trace });
  assert.equal(diagnostics.stages.find(stage => stage.id === "validation").status, "PARTIAL");
  assert.equal(diagnostics.answer_correctness, "NOT_PROVEN");
  assert.equal(diagnostics.root_cause_status, "NOT_PROVEN");
  assert.equal(projectResponseDecision({ ...result.trace.response_decision, secret: "hidden" }).secret, undefined);
  assert.equal(projectGroupEvidenceLocators([{ ...result.trace.group_evidence_locators[0], raw: passage }])[0].raw, undefined);
});
