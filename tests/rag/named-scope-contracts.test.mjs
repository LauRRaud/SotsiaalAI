import assert from "node:assert/strict";
import { test } from "node:test";
import { buildQuestionPlan } from "../../lib/chat/questionPlanner.js";
import { buildRagQueryPlan } from "../../lib/chat/queryPlanner.js";
import { buildRequestedFactSlotContract } from "../../lib/chat/retrievalContextAssembler.js";
import { validateExactFactAnswer } from "../../lib/chat/factContract.js";
import { buildRagTraceFromAttribution } from "../../lib/chat/mainResponseHandler.js";
import { buildRagDiagnostics } from "../../lib/chat/ragDiagnostics.js";
import { diagnosticExplanationRows } from "../../lib/chat/ragDiagnosticExplanation.js";
import { serverT } from "../../lib/i18n/serverMessages.js";

const question = "Milliseid Eesti ja Euroopa Liidu üksi elavate üle 65-aastaste osakaale 2017. aasta kohta vahendab 2019. aasta artikkel „Mitmepalgeline üksildus SHARE vanemaealiste uuringu andmetel”?";
const body = "Kui Euroopa Liidus elas aastal 2017 üle 65aasta vanustest eakatest üksi keskmiselt 32,5% (meestest 22,4%; naistest 40,4%), siis Eestis on see koguni 43,6% (meestest 25,2%; naistest 53,1%) (Eurostat 2019).";
const identity = { required: true, matched: true, confidence: "high", selectedDocumentId: "doc" };
function fixture(message = question, text = body) {
  const questionPlan = buildQuestionPlan({ message });
  const trace = buildRequestedFactSlotContract({ questionPlan,
    renderedGroups: [{ sourceId: "source", docId: "doc", bodies: [text] }],
    renderedBlocks: [{ evidenceText: text }], specificResearchFactQuestion: true,
    documentIdentityEvidence: identity }).trace;
  const retrievalMeta = { queryPlan: { mode: "specific_research_fact", question_planner: questionPlan },
    requestedFactSlotContract: trace, requestedMetricContract: trace, documentIdentityEvidence: identity };
  return { questionPlan, trace, validate: reply => validateExactFactAnswer({ message, reply, retrievalMeta,
    sources: [{ source_id: "source", document_id: "doc", evidenceText: text }] }) };
}

test("named scopes create independent metrics; observation year cannot borrow a later publication noun", () => {
  const { questionPlan: p, trace } = fixture();
  assert.deepEqual(p.document_source_years, ["2019"]);
  assert.deepEqual(p.evidence_period_years, ["2017"]);
  assert.deepEqual(p.semantic_candidates.requested_fact_slots.slots.map(s => s.named_scope_terms), [["eesti"], ["euroopa", "liidu"]]);
  assert.equal(p.semantic_candidates.requested_fact_slots.qualitative_clause_count, 0);
  assert.equal(trace.complete, true);
  assert.deepEqual(trace.slots.map(s => [s.named_scope_terms, s.evidence_value]), [[["eesti"], "43.6"], [["euroopa", "liidu"], "32.5"]]);
  assert.equal(trace.mapping_diagnostics.ambiguous, false);
  assert.ok(trace.slots.every(s => s.parenthesis_depth === 0));
});

test("the original and reversed question order produce the same labelled values", () => {
  const reversed = fixture(question.replace("Eesti ja Euroopa Liidu", "Euroopa Liidu ja Eesti"));
  assert.equal(reversed.trace.complete, true);
  assert.deepEqual(reversed.trace.slots.map(s => s.evidence_value), ["32.5", "43.6"]);
  const alternate = fixture("Mis Eesti ja Euroopa Liidu üksi elavate üle 65-aastaste osakaalud olid 2017. aasta andmetes 2019. aasta artikli järgi?");
  assert.equal(alternate.trace.complete, true);
  assert.deepEqual(alternate.trace.slots.map(s => s.evidence_value), ["43.6", "32.5"]);
});

test("both correctly labelled decimal-comma answer orders pass; swapped values fail closed", () => {
  const { validate } = fixture();
  const lines = ["Eestis elas 2017. aastal üle 65-aastastest üksi 43,6%.", "Euroopa Liidus elas 2017. aastal üle 65-aastastest üksi keskmiselt 32,5%."];
  for (const reply of [lines.join("\n"), lines.toReversed().join("\n"),
    "Üle 65-aastastest elas 2017. aastal üksi Eestis 43,6%, Euroopa Liidus keskmiselt 32,5%."]) {
    const result = validate(reply);
    assert.equal(result.passed, true, JSON.stringify(result.trace));
  }
  for (const reply of [
    "Üle 65-aastastest elas 2017. aastal üksi Eestis keskmiselt 32,5%, Euroopa Liidus 43,6%.",
    "Eestis elas üle 65-aastastest üksi 43,6%, Eestis keskmiselt 32,5%.",
    "Üle 65-aastastest elas üksi 43,6% ja keskmiselt 32,5%.",
    "Eestis elas üle 65-aastastest üksi 25,2%, Euroopa Liidus keskmiselt 32,5%."
  ]) assert.equal(validate(reply).passed, false, reply);
});

test("named binding is reusable and refuses absent labels or competing labelled evidence", () => {
  const message = "Milliseid Rootsi ja Soome üksi elavate inimeste osakaale esitab 2020. aasta artikkel?";
  const correct = fixture(message, "Soomes elas üksi 24,7%, Rootsis 31,8%.");
  assert.equal(correct.trace.complete, true);
  assert.deepEqual(correct.trace.slots.map(s => s.evidence_value), ["31.8", "24.7"]);
  for (const text of ["Üksi elas 24,7% ja 31,8%.", "Soomes elas üksi 24,7%, Soomes 31,8%.",
    "Soomes elas üksi 24,7%, Rootsis 31,8%. Soomes elas üksi 31,8%, Rootsis 24,7%."]) {
    assert.equal(fixture(message, text).trace.complete, false, text);
  }
  for (const message of ["Milline Rootsi ja Soome ühine osakaal oli artikli järgi?",
    "Mis Rootsi ja Soome osakaal kokku oli 2020. aasta artikli järgi?"]) {
    const joint = buildQuestionPlan({ message });
    assert.ok(joint.semantic_candidates.requested_fact_slots.slots.every(s => !s.named_scope_terms));
  }
});

test("proper-name scopes cannot borrow another country's shared prefix", () => {
  const message = "Milliseid Austria ja Soome üksi elavate inimeste osakaale esitab 2020. aasta artikkel?";
  const correct = fixture(message, "Soomes elas üksi 24,7%, Austrias 31,8%.");
  assert.equal(correct.trace.complete, true);
  assert.equal(correct.validate("Austrias elas üksi 31,8%, Soomes 24,7%.").passed, true);
  assert.equal(correct.validate("Austraalias elas üksi 31,8%, Soomes 24,7%.").passed, false);
  assert.equal(fixture(message, "Soomes elas üksi 24,7%, Austraalias 31,8%.").trace.complete, false);
});

test("named metrics require their actual observation year and age comparison, not just source-present numbers", () => {
  const { trace, validate } = fixture();
  assert.deepEqual(trace.slots[0].named_scope_constraints, { age: { value: "65", operator: "over" }, observation_year: "2017" });
  const correct = "Eestis elas 2017. aastal üle 65-aastastest üksi 43,6%. Euroopa Liidus elas 2017. aastal üle 65-aastastest üksi keskmiselt 32,5%.";
  assert.equal(validate(correct).passed, true);
  const wrongYear = validate(correct.replaceAll("2017", "2019"));
  assert.equal(wrongYear.passed, false);
  assert.equal(wrongYear.trace.requested_metric_relation_diagnostics[0].observation_year_bound, false);
  for (const operator of ["alla", "täpselt", "vähemalt", "kuni", "mitte üle"]) {
    const result = validate(correct.replaceAll("üle", operator));
    assert.equal(result.passed, false, operator);
    assert.equal(result.trace.requested_metric_relation_diagnostics[0].age_scope_bound, false);
  }
  assert.equal(fixture(question, body.replace("üle 65", "alla 65")).trace.complete, false);
  assert.equal(fixture(question, body.replace("aastal 2017", "aastal 2019").replace("Eurostat 2019", "Eurostat 2017")).trace.complete, false);
  assert.equal(validate(correct + " Allikas: 2019. aasta artikkel.").passed, true);
  const syntheticQuestion = "Milliseid Rootsi ja Soome üksi elavate üle 70-aastaste osakaale 2018. aasta kohta esitab 2020. aasta artikkel?";
  const synthetic = fixture(syntheticQuestion, "Aastal 2018 elas üle 70-aastastest üksi Soomes 24,7%, Rootsis 31,8% (Statistika 2020).");
  assert.equal(synthetic.trace.complete, true);
  assert.equal(synthetic.validate("Aastal 2018 elas üle 70-aastastest üksi Rootsis 31,8%, Soomes 24,7%.").passed, true);
  assert.equal(synthetic.validate("Aastal 2020 elas üle 70-aastastest üksi Rootsis 31,8%, Soomes 24,7%.").passed, false);
});

test("year roles and scoped metric counts survive the safe canonical trace without raw scope terms", () => {
  const { questionPlan, trace } = fixture();
  const queryPlan = buildRagQueryPlan({ baseRagQueryText: question, effectiveMessage: question,
    rawHistory: [], effectiveMunicipalities: [], questionPlan }).queryPlan;
  const canonical = buildRagTraceFromAttribution([], {}, { queryPlan, requestedFactSlotContract: trace });
  const d = buildRagDiagnostics({ trace: canonical });
  assert.deepEqual(d.evidence.plan.years.source_years, ["2019"]);
  assert.deepEqual(d.evidence.plan.years.evidence_period_years, ["2017"]);
  assert.ok(d.evidence.plan.years.mentions.some(m => m.method === "explicit_observation_year" && m.value === "2017"));
  assert.deepEqual(canonical.requested_fact_slot_contract.slots.map(s => s.named_scope_term_count), [1, 2]);
  assert.doesNotMatch(JSON.stringify(canonical.requested_fact_slot_contract), /eesti|euroopa|liidu/u);
});

test("named metric scope checks reach both canonical diagnostics and the human explanation", () => {
  const { trace, validate } = fixture();
  const correct = "Eestis elas 2017. aastal üle 65-aastastest üksi 43,6%. Euroopa Liidus elas 2017. aastal üle 65-aastastest üksi keskmiselt 32,5%.";
  for (const [reply, passed] of [[correct, true], [correct.replaceAll("2017", "2019"), false]]) {
    const result = validate(reply);
    const canonical = buildRagTraceFromAttribution([], {}, { requestedFactSlotContract: trace, factValidation: result.trace });
    const d = buildRagDiagnostics({ trace: canonical });
    const checks = passed ? d.evidence.validation.metric_bindings : d.evidence.validation.relation_diagnostics;
    assert.equal(checks[0].observation_year_bound, passed);
    assert.equal(checks[0].age_scope_bound, true);
    assert.equal(checks[0].named_scope_bound, true);
    const rows = diagnosticExplanationRows(d, key => serverT("et", `chat.diagnostics.${key}`));
    assert.match(rows.find(row => row.key === "named_scope_checks").value, passed ? /vaatlusaasta: Jah/ : /vaatlusaasta: Ei/);
    assert.doesNotMatch(JSON.stringify(d.evidence.metric_contract), /2017|2019|43\.6|32\.5|eesti|liidu/u);
  }
});
