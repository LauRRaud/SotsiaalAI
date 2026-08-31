import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { buildQuestionPlan } from "../../lib/chat/questionPlanner.js";
import { groupMatches } from "../../lib/chat/ragContext.js";
import { buildCurrentTurnAuthorConfirmation, selectSpecificResearchFactGroups,
  describeSpecificResearchDocumentLock } from "../../lib/chat/retrievalContextAssembler.js";
import { buildRagTraceFromAttribution } from "../../lib/chat/mainResponseHandler.js";
import { validateExactFactAnswer } from "../../lib/chat/factContract.js";
import { projectAuthorTopicEvidence, projectRagDiagnosticEvidence, projectRagTraceForLog } from "../../lib/chat/ragDiagnostics.js";

// Public Priit Kiilaspä 2017 passage. IDs/versions are synthetic, not live proof.
const body = "Tartus elab 2017. aasta novembri seisuga neli rändekava alusel saabunud leibkonda (kokku 10 inimest): kaks üksikisikut, üks kolmeliikmeline perekond ja üks viieliikmeline perekond.";
const questions = [
  "Mitu EL-i rändekava alusel saabunud leibkonda ja inimest elas Tartus 2017. aasta novembris ning kuidas leibkonnad jagunesid Priit Kiilaspä artikli järgi?",
  "Priit Kiilaspä artikli järgi: mitu EL-i rändekava alusel saabunud leibkonda ja inimest elas 2017. aasta novembris Tartus ning milline oli nende leibkondade koosseis?"
];
const sha = value => createHash("sha256").update(value).digest("hex");
function groups(text = body, metadata = {}) {
  return groupMatches([{ text, metadata: { doc_id: "topic-doc", source_id: "topic-source", chunk_id: "topic-chunk",
    document_version: "fixture-v1", source_status: "active", source_type: "journal_article",
    collection_id: "journal_articles", title: "Neutraalne pealkiri", authors: ["Priit Kiilaspä"],
    year: 2017, ...metadata } }]);
}
function select(message = questions[0], candidates = groups(), override = {}) {
  const initial = buildQuestionPlan({ message });
  const confirmation = buildCurrentTurnAuthorConfirmation(initial.semantic_candidates.current_turn_document_identity, candidates, null, initial);
  const id = confirmation.promotion_document_ids?.[0];
  const plan = { ...initial, ...(confirmation.promotion_eligible ? {
    trusted_document_id: id, trusted_document_id_source: confirmation.promotion_source,
    ...(confirmation.topic_evidence.required ? {
      trusted_document_version: confirmation.topic_evidence.candidates.find(item => item.confirmed && item.document_id === id)?.document_version,
      trusted_author_topic_body_hashes: confirmation.topic_evidence.candidates.filter(item => item.confirmed && item.document_id === id).map(item => item.body_hash)
    } : {})
  } : {}), ...override };
  const identity = selectSpecificResearchFactGroups(message, candidates, plan);
  identity.decision = describeSpecificResearchDocumentLock(plan, identity);
  return { initial, confirmation, plan, identity };
}

test("both F07 wordings admit exact author plus independent body topic, without a title/year demand", () => {
  for (const message of questions) {
    const result = select(message);
    assert.equal(result.confirmation.promotion_eligible, true);
    assert.equal(result.plan.trusted_document_id_source, "current_turn_author_topic_confirmation");
    assert.equal(result.identity.matched, true);
    assert.equal(result.identity.decision.eligible, true);
    assert.equal(result.identity.decision.checks.author_body_topic_confirmed, true);
    assert.deepEqual(result.initial.document_source_years, [], "2017 observation must not become publication requirement");
    assert.equal(result.identity.authorTopicEvidence.topic_term_count, 3);
    const locator = result.identity.authorTopicEvidence.candidates[0];
    assert.equal(locator.body_hash, sha(body));
    assert.equal(locator.chunk_hash, sha(body));
    assert.equal(locator.fragment_hash, sha(body.slice(locator.start, locator.end)));
    assert.equal(locator.offset_basis, "retrieved_chunk_text_utf16");
  }
});

test("confirmation is general, not tied to the F07 author or locality", () => {
  const message = "Mari Kivi artikli järgi: mitu õppijat osales Pärnu täiskasvanuhariduse uuringus?";
  const result = select(message, groups("Pärnu täiskasvanuhariduse uuringus osales kaksteist õppijat.", { authors: ["Mari Kivi"] }));
  assert.equal(result.identity.decision.eligible, true, JSON.stringify(result.confirmation));
});

test("matching metadata and retrieval score cannot replace wrong-topic body evidence", () => {
  const candidates = groups("Tartus elab kümme inimest. Artikkel käsitleb noorsootöö korraldust.", {
    title: "Tartus rändekava alusel saabunud leibkonnad", tags: ["rändekava", "saabunud", "Tartus"]
  });
  candidates[0].retrievalChannels = ["registry_fact", "title_match", "author_match", "exact_phrase"];
  candidates[0].score = 999;
  const result = select(questions[0], candidates);
  assert.equal(result.confirmation.promotion_eligible, false);
  assert.equal(result.identity.matched, false);
  assert.equal(result.identity.decision.eligible, false);
  assert.equal(result.identity.authorTopicEvidence.status, "body_topic_not_confirmed");
});

test("metadata-only author confirmation and a forged trust label do not open the lock", () => {
  for (const source of ["current_turn_author_confirmation", "current_turn_author_topic_confirmation", "current_turn_document_identity"]) {
    const result = select(questions[0], groups("See on muu teema."), {
      trusted_document_id: "topic-doc", trusted_document_id_source: source, trusted_document_version: "fixture-v1"
    });
    assert.equal(result.identity.matched, false, source);
    assert.equal(result.identity.decision.eligible, false, source);
  }
});

test("two author-topic documents stay ambiguous regardless of score, order or supplied trusted ID", () => {
  const first = groups();
  first[0].retrievalChannels = ["registry_fact", "title_match", "author_match", "exact_phrase"];
  const second = groups(body, { doc_id: "another-doc", source_id: "another-source", title: "Teine teos" });
  for (const candidates of [[...first, ...second], [...second, ...first]]) {
    const result = select(questions[0], candidates, { trusted_document_id: "topic-doc", trusted_document_id_source: "current_turn_author_topic_confirmation", trusted_document_version: "fixture-v1" });
    assert.equal(result.confirmation.promotion_eligible, false);
    assert.equal(result.identity.matched, false);
    assert.equal(result.identity.confidence, "ambiguous");
    assert.equal(result.identity.authorTopicEvidence.confirmed_document_count, 2);
    assert.ok(result.identity.reasons.includes("multiple_author_topic_documents"));
    assert.equal(result.identity.decision.eligible, false);
  }
});

test("duplicates of one document are not a multiple-work ambiguity", () => {
  const result = select(questions[0], [...groups(), ...groups(body, { chunk_id: "second-chunk" })]);
  assert.equal(result.confirmation.topic_evidence.confirmed_document_count, 1);
  assert.equal(result.identity.decision.eligible, true);
});

test("a unique body-confirmed work outranks unrelated works by the same author", () => {
  const wrong = groups("Tartus osalesid inimesed muuseumipäeval.", { doc_id: "wrong-topic", title: "Tartus rändekava alusel saabunud leibkonnad" });
  wrong[0].retrievalChannels = ["registry_fact", "author_match", "title_match", "exact_phrase"];
  const result = select(questions[0], [...wrong, ...groups()]);
  assert.equal(result.confirmation.matched_source_count, 2);
  assert.equal(result.identity.selectedDocumentId, "topic-doc");
  assert.equal(result.identity.decision.eligible, true);
});

test("a different author cannot borrow the topic proof", () => {
  const result = select(questions[0], groups(body, { authors: ["Teine Autor"] }));
  assert.equal(result.confirmation.promotion_eligible, false);
  assert.equal(result.identity.decision.eligible, false);
});

test("publication requirements remain distinct from observations even on the new path", () => {
  const result = select(questions[0], groups(body, { year: 2024 }));
  assert.equal(result.identity.decision.eligible, true, "2017 is not a required publication year");
  const explicit = "Priit Kiilaspä 2023. aasta artikli järgi: mitu rändekava alusel saabunud leibkonda elas Tartus?";
  assert.equal(select(explicit, groups(body, { year: 2023 })).identity.decision.eligible, true);
  assert.equal(select(explicit, groups(body, { year: 2024 })).identity.decision.eligible, false);
});

test("inactive, unknown-status and legal sources do not enter the author-topic route", () => {
  for (const metadata of [{ source_status: "inactive" }, { source_status: null }, { source_status: "stale" }, { source_type: "law", collection_id: "legal_acts" }]) {
    assert.equal(select(questions[0], groups(body, metadata)).identity.decision.eligible, false, JSON.stringify(metadata));
  }
});

test("missing, wrong-document and tampered body provenance cannot confirm a topic", () => {
  for (const mutate of [
    value => { value.bodyEvidence = []; },
    value => { value.bodyEvidence[0].document_id = "foreign-doc"; },
    value => { value.bodyEvidence[0].normalized_body_hash = sha("different"); },
    value => { value.bodyEvidence[0].chunk_id = null; },
    value => { value.bodyEvidence[0].chunk_id = "x".repeat(181); },
    value => { value.bodyEvidence[0].document_version = "x".repeat(181); }
  ]) {
    const candidates = groups(); mutate(candidates[0]);
    const result = select(questions[0], candidates);
    assert.equal(result.identity.decision.eligible, false);
    assert.equal(result.confirmation.topic_evidence.candidates[0].reason, "body_provenance_missing");
  }
});

test("mixed document versions and version changes on scoped recall fail closed", () => {
  const first = select();
  const newer = groups(body, { document_version: "fixture-v2", chunk_id: "new-chunk" });
  assert.equal(select(questions[0], [...groups(), ...newer]).identity.decision.eligible, false);
  const recalled = selectSpecificResearchFactGroups(questions[0], newer, { ...first.plan, trusted_document_id_source: "current_turn_document_identity" });
  assert.equal(recalled.matched, false);
  assert.ok(recalled.reasons.includes("author_topic_locked_evidence_changed"));
  const differentBody = groups(body.replace("10 inimest", "20 inimest"));
  const lostOriginalProof = selectSpecificResearchFactGroups(questions[0], differentBody, { ...first.plan, trusted_document_id_source: "current_turn_document_identity" });
  assert.equal(lostOriginalProof.matched, false, "same version cannot replace the original identity body");
});

test("unsafe or out-of-chunk offsets cannot be admitted as identity locators", () => {
  for (const offset of [Number.MAX_SAFE_INTEGER, body.length + 1, -1]) {
    const candidates = groups(); candidates[0].bodyEvidence[0].chunk_body_offset = offset;
    assert.equal(select(questions[0], candidates).identity.decision.eligible, false, String(offset));
  }
});

test("every recorded locator field is independently checked at the document lock", () => {
  const result = select();
  for (const [key, value] of Object.entries({ source_id: "other-source", chunk_id: "other-chunk", start: 1, end: 2,
    offset_basis: "wrong_basis", fragment_hash: sha("other fragment"), document_version: "v-other" })) {
    const changed = structuredClone(result.identity);
    changed.authorTopicEvidence.candidates[0][key] = value;
    assert.equal(describeSpecificResearchDocumentLock(result.plan, changed).eligible, false, key);
  }
});

test("merged author metadata cannot be borrowed by another author's body chunk", () => {
  const candidates = groups();
  candidates[0].bodyEvidence[0].author_identity_hashes = [sha("other author")];
  const result = select(questions[0], candidates);
  assert.equal(result.identity.decision.eligible, false);
  assert.equal(result.confirmation.topic_evidence.candidates[0].reason, "body_author_metadata_unconfirmed");
});

test("raw snippet dedupe preserves conflicting author/source metadata in either input order", () => {
  const metadata = { doc_id: "topic-doc", source_id: "topic-source", chunk_id: "topic-chunk", document_version: "fixture-v1",
    source_status: "active", source_type: "journal_article", collection_id: "journal_articles",
    title: "Neutraalne pealkiri", authors: ["Priit Kiilaspä"], year: 2017 };
  for (const conflict of [{ authors: ["Teine Autor"] }, { source_id: "another-source" }]) {
    const first = { text: body, metadata };
    const second = { text: body, metadata: { ...metadata, ...conflict } };
    for (const raw of [[first, second], [second, first]]) {
      const candidates = groupMatches(raw);
      assert.equal(candidates[0].bodyEvidence.length, 2, JSON.stringify(conflict));
      assert.equal(select(questions[0], candidates).identity.decision.eligible, false, JSON.stringify(conflict));
    }
  }
});

test("one compound body token cannot count as two independent topic hits", () => {
  const initial = buildQuestionPlan({ message: questions[0] });
  const plan = { ...initial, document_subject_terms: ["sotsiaal", "hoolekande"] };
  const confirmation = buildCurrentTurnAuthorConfirmation(initial.semantic_candidates.current_turn_document_identity,
    groups("Sotsiaalhoolekande põhimõtted."), null, plan);
  assert.equal(confirmation.promotion_eligible, false);
  assert.equal(confirmation.topic_evidence.candidates[0].matched_term_count, 1);
});

test("the lock independently rechecks body proof instead of accepting a stale confirmation", () => {
  const result = select();
  const changed = structuredClone(result.identity);
  changed.groups[0].bodies = ["Tartus elab kümme inimest. Muu teema."];
  assert.equal(describeSpecificResearchDocumentLock(result.plan, changed).eligible, false);
  const missing = { ...result.identity, authorTopicEvidence: null };
  assert.equal(describeSpecificResearchDocumentLock(result.plan, missing).eligible, false);
  const rebound = structuredClone(result.identity);
  rebound.authorTopicEvidence.candidates[0].body_hash = sha("wrong body");
  assert.equal(describeSpecificResearchDocumentLock(result.plan, rebound).eligible, false);
});

test("widely separated keyword echoes and author-only terms are not a body topic", () => {
  const scattered = "Tartus. " + "Muu teema. ".repeat(150) + "Rändekava alusel saabunud.";
  assert.equal(select(questions[0], groups(scattered)).identity.decision.eligible, false);
  const initial = buildQuestionPlan({ message: questions[0] });
  const result = buildCurrentTurnAuthorConfirmation(initial.semantic_candidates.current_turn_document_identity, groups(), null,
    { ...initial, document_subject_terms: ["Priit", "Kiilaspä", "2017", "inimest", "alusel"] });
  assert.equal(result.promotion_eligible, false);
  assert.equal(result.topic_evidence.status, "independent_topic_anchors_missing");
});

test("source identity by itself cannot approve an unsupported numeric answer", () => {
  const { identity } = select();
  assert.equal(identity.decision.eligible, true);
  const result = validateExactFactAnswer({ message: questions[0], reply: "Tartus oli 999 leibkonda ja 9999 inimest.",
    sources: [{ document_id: "topic-doc", source_id: "topic-source", title: "Neutraalne pealkiri", evidenceText: body }],
    retrievalMeta: { queryPlan: { mode: "specific_research_fact" }, documentIdentityEvidence: identity }
  });
  assert.equal(result.passed, false);
});

test("body-topic reasons and locators survive trace/log projection without source text or query terms", () => {
  const { identity } = select();
  identity.authorTopicEvidence.secret = "PRIVATE_TEXT";
  identity.authorTopicEvidence.candidates[0].body = "PRIVATE_TEXT";
  identity.authorTopicEvidence.candidates[0].terms = ["PRIVATE_TEXT"];
  const trace = buildRagTraceFromAttribution([], {}, { documentIdentityEvidence: identity });
  const evidence = projectRagDiagnosticEvidence(trace);
  assert.equal(evidence.identity.author_topic_evidence?.status, "unique_author_topic_document");
  assert.equal(evidence.identity.decision.checks.author_body_topic_confirmed, true);
  assert.equal(evidence.identity.candidates[0].author_body_topic_confirmed, true);
  const logged = projectRagTraceForLog(trace);
  assert.deepEqual(projectRagDiagnosticEvidence(logged).identity.author_topic_evidence, evidence.identity.author_topic_evidence);
  assert.doesNotMatch(JSON.stringify(logged), /PRIVATE_TEXT|rändekava|Priit|saabunud|Tartus/u);
  const omissions = [];
  projectAuthorTopicEvidence({ ...identity.authorTopicEvidence, candidates: Array(10).fill(identity.authorTopicEvidence.candidates[0]) }, omissions);
  assert.ok(omissions.some(item => item.reason === "item_limit" && item.omitted === 2));
  for (const key of ["chunk_hash", "body_hash", "fragment_hash"]) {
    const changed = structuredClone(identity.authorTopicEvidence);
    changed.candidates[0][key] = "PRIVATE_TEXT";
    assert.doesNotMatch(JSON.stringify(projectAuthorTopicEvidence(changed)), /PRIVATE_TEXT/u, key);
  }
});
