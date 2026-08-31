import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldValidateExactFactAnswer, validateExactFactAnswer, smallCardinalNumberValue } from "../../lib/chat/factContract.js";
import { buildRequestedFactSlotContract, buildRequestedQualitativeSlotContract, buildRequestedFactSlotCoverage,
  prioritizeRequestedFactSlotEvidence } from "../../lib/chat/retrievalContextAssembler.js";
import { hasUnresolvedPassageOpening } from "../../lib/chat/evidenceContent.js";
import { buildContextWithBudget, renderOneContextBlock } from "../../lib/chat/ragContext.js";
import { qualitativeTimePayload, qualitativeTimePayloadMatches } from "../../lib/chat/qualitativeTimeSemantics.js";
import { factRelationTermMatchQuality } from "../../lib/chat/factRelationSemantics.js";
import { buildDocumentScopedMissingFactQueries } from "../../lib/chat/queryPlanner.js";

const identity = { required: true, matched: true, confidence: "high", selectedDocumentId: "study-doc" };
const methodSlot = { index: 1, value_type: "method", relation_terms: ["meetodit", "kasutati"],
  relation_term_variants: [{ term: "meetodit", variants: ["meetod"] }, { term: "kasutati", variants: ["kasutama", "kasuta"] }], minimum_answer_items: 1 };
const timeSlot = { index: 2, value_type: "timepoint", relation_terms: ["tehti"],
  relation_term_variants: [{ term: "tehti", variants: ["tegema", "tege"] }], minimum_answer_items: 1 };
const countSlot = { index: 3, value_type: "count", relation_terms: ["inimesi", "osales"],
  relation_term_variants: [{ term: "inimesi", variants: ["inimene"] }, { term: "osales", variants: ["osalema", "osale"] }], input_form: "original" };
const planFor = slots => ({ mode: "specific_research_fact", semantic_candidates: { requested_fact_slots: { complete: true, slots } } });
function argsFor(slots, bodies) {
  return { questionPlan: planFor(slots), specificResearchFactQuestion: true, documentIdentityEvidence: identity,
    renderedGroups: [{ sourceId: "study-source", docId: identity.selectedDocumentId, bodies }],
    renderedBlocks: [{ evidenceText: bodies.join("\n---\n") }] };
}
function metaFor(slots, contract) {
  return { documentIdentityEvidence: identity,
    queryPlan: { mode: "specific_research_fact", semantic_turn_contract: {
      requested_facts: slots, requested_fact_contract: { complete: true }
    } }, requestedQualitativeSlotContract: contract };
}

test("canonical requested facts dispatch without transient planner fields", () => {
  const contract = buildRequestedQualitativeSlotContract(argsFor([methodSlot], ["Kasutati kvalitatiivset uurimismeetodit."])).trace;
  assert.equal(contract.complete, true);
  assert.equal(contract.used_for_validation, false);
  const retrievalMeta = metaFor([methodSlot], contract);
  assert.equal(shouldValidateExactFactAnswer({ retrievalMeta }), true);
  assert.equal(shouldValidateExactFactAnswer({ retrievalMeta: { requestedQualitativeSlotContract: contract } }), true);
  const sources = [{ source_id: "study-source", document_id: "study-doc", evidenceText: "Teenuste uuring\nKasutati kvalitatiivset uurimismeetodit." }];
  assert.equal(validateExactFactAnswer({ reply: "Meetod: kasutati kvalitatiivset uurimismeetodit.", sources, retrievalMeta }).passed, true);
  const incompleteMeta = { ...retrievalMeta, queryPlan: { ...retrievalMeta.queryPlan,
    question_planner: planFor([methodSlot]), semantic_turn_contract: { requested_facts: [methodSlot], requested_fact_contract: { complete: false } } } };
  assert.equal(validateExactFactAnswer({ reply: "Meetod: kasutati kvalitatiivset uurimismeetodit.", sources, retrievalMeta: incompleteMeta }).trace.reason, "requested_fact_plan_incomplete");
  assert.equal(shouldValidateExactFactAnswer({ retrievalMeta: { queryPlan: { mode: "multi_source_synthesis", semantic_turn_contract: {
    requested_facts: [{ value_type: "text_relation" }], requested_fact_contract: { complete: true }
  } } } }), false);
});

test("M01 quote boundary cannot lend the next sentence's participation relation to a metaphor", () => {
  for (const closing of ["”", '"', "’", "»"]) {
    const bodies = ["olla võimelised ise uuringus osalema (nt sügavas depressioonis ja suitsiidiriskis olev noor), linnaosavalitsuse sotsiaaltöötajad. Kokku saadi 42 inimese tagasiside.",
      `Oled üks number süsteemis, mitte inimene.${closing} Uuringus osalenute kirjeldused viitavad, et praktikas ei ole inimkeskse toetamise põhimõte nende kogemuses alati süsteemselt tagatud.`];
    const contract = buildRequestedFactSlotContract(argsFor([countSlot], bodies)).trace;
    assert.equal(contract.complete, true, closing);
    assert.equal(contract.slots[0].evidence_value, "42");
    assert.equal(contract.used_for_validation, false);
  }
});

test("M01 method/time coverage rejects generic headings, punctuation neighbors and undated conclusions", () => {
  const badBodies = ["Uuringu metoodika. Valdavalt on tegemist teenuspõhise lähenemisega.",
    "Vajadusel kasutati üldistatud näiteid. Analüüsi tulemusena sõnastati järeldused ning koostati ettepanekud."];
  const args = argsFor([methodSlot, timeSlot], badBodies);
  const contract = buildRequestedQualitativeSlotContract(args).trace;
  assert.equal(contract.complete, false);
  assert.deepEqual(contract.missing_slot_indexes, [1, 2]);
  const coverage = buildRequestedFactSlotCoverage(args.questionPlan, args.renderedGroups, args);
  assert.equal(coverage.complete, false);
  assert.deepEqual(coverage.missing_slot_indexes, [0, 1]);
  const queries = buildDocumentScopedMissingFactQueries(args.questionPlan, coverage.missing_slot_indexes);
  assert.equal(queries.length, 2);
  assert.match(queries[0].query, /uurimismeetod/u);
  assert.match(queries[1].query, /periood/u);
});

test("typed study period and compound method survive all-slot prioritization", () => {
  const body = "Käesolev uuring viidi läbi perioodil november 2025 kuni märts 2026 kasutades kvalitatiivset uurimismeetodit.";
  const bodies = ["Valdavalt on tegemist teenuspõhise lähenemisega.",
    "Jaanuari- ja veebruarikuus 2026 intervjueeriti uuringu otsest sihtgruppi, keda oli kokku 32.", body];
  const args = argsFor([methodSlot, timeSlot], bodies);
  const sorted = prioritizeRequestedFactSlotEvidence(args.questionPlan, args.renderedGroups, args);
  assert.equal(sorted[0].bodies[0], body);
  const contract = buildRequestedQualitativeSlotContract(args).trace;
  assert.equal(contract.complete, true);
  assert.deepEqual(contract.slots[0].evidence_anchor_terms, ["kvalitatiivset"]);
  assert.deepEqual(contract.slots[1].temporal_binding.points.map(point => [point.month, point.year]), [[11, 2025], [3, 2026]]);
  const retrievalMeta = metaFor([methodSlot, timeSlot], contract);
  const sources = [{ source_id: "study-source", document_id: "study-doc", evidenceText: `Teenuste uuring\n${body}` }];
  const valid = "Meetod: kasutati kvalitatiivset uurimismeetodit.\nUuring toimus 2025. aasta novembrist 2026. aasta märtsini.";
  assert.equal(validateExactFactAnswer({ reply: valid, sources, retrievalMeta }).passed, true);
  for (const time of ["Uuring tehti novembrist 2025 märtsini 2026.", "Uuring tehti novembrist 2025 kuni märtsini 2026."]) {
    assert.equal(validateExactFactAnswer({ reply: `${valid.split("\n")[0]}\n${time}`, sources, retrievalMeta }).passed, true, time);
  }
  for (const time of ["Uuring tehti jaanuaris ja veebruaris 2026.", "Uuring tehti novembris 2025.",
    "Uuring tehti novembrist 2026 märtsini 2025.", "Uuringu kohta tehti järeldused."]) {
    assert.equal(validateExactFactAnswer({ reply: `${valid.split("\n")[0]}\n${time}`, sources, retrievalMeta }).passed, false, time);
  }
});

test("relative follow-up timing retains its duration, direction and reference event", () => {
  const expected = qualitativeTimePayload("Kuus kuud pärast koolitust tehakse järelhindamine.", smallCardinalNumberValue);
  const matches = text => qualitativeTimePayloadMatches(expected, qualitativeTimePayload(text, smallCardinalNumberValue), factRelationTermMatchQuality);
  assert.equal(matches("Järelhindamine tehakse 6 kuud pärast koolitust."), true);
  assert.equal(matches("Järelhindamine tehakse 6 kuud enne koolitust."), false);
  assert.equal(matches("Järelhindamine tehakse 6 kuud pärast ravi."), false);
});

test("calendar payload preserves leading ordinal dates and years", () => {
  const payload = text => qualitativeTimePayload(text, smallCardinalNumberValue);
  assert.equal(qualitativeTimePayloadMatches(payload("10. märtsil 2026"), payload("11. märtsil 2026"), factRelationTermMatchQuality), false);
  assert.deepEqual(payload("2025. aasta novembrist 2026. aasta märtsini").points.map(point => [point.month, point.year]), [[11, 2025], [3, 2026]]);
  assert.equal(qualitativeTimePayloadMatches(payload("09.03.2026"), payload("9. märtsil 2026"), factRelationTermMatchQuality), true);
  assert.equal(payload("maikuus 2026").points[0].month, 5);
});

test("M02 supported decision-making cannot bind to generic personal support", () => {
  const slot = { index: 4, value_type: "recommendation", relation_terms: ["toetatud", "otsustamise"], minimum_answer_items: 1 };
  const unrelated = "Määrata kontaktisik, kes aitab leida vajalikku abi ning toetab inimest teenuste vahel liikumisel.";
  assert.equal(buildRequestedQualitativeSlotContract(argsFor([slot], [unrelated])).trace.complete, false);
  const evidence = "Toetatud otsustamise lahendusi tuleb kasutada alternatiivina eestkostele.";
  const contract = buildRequestedQualitativeSlotContract(argsFor([slot], [unrelated, evidence])).trace;
  assert.equal(contract.complete, true);
  assert.equal(contract.slots[0].minimum_relation_matches, 2);
  const retrievalMeta = metaFor([slot], contract);
  const sources = [{ source_id: "study-source", document_id: "study-doc", evidenceText: `Teenuste uuring\n${unrelated}\n${evidence}` }];
  assert.equal(validateExactFactAnswer({ reply: "Toetatud otsustamine: kasutada alternatiivina eestkostele.", sources, retrievalMeta }).passed, true);
  assert.equal(validateExactFactAnswer({ reply: "Toetatud abi: kasutada kontaktisikut alternatiivina.", sources, retrievalMeta }).passed, false);
});

test("M02 recommendation requires its primary action, not every consequence in a relative clause", () => {
  const slot = { index: 4, value_type: "recommendation", relation_terms: ["toetatud", "otsustamise"], minimum_answer_items: 1 };
  const evidence = "Sellest tulenevalt teeme ettepaneku arendada toetatud otsustamise põhimõttel toimivaid lahendusi, mis võimaldavad vähendada eestkoste ulatust ja toetada inimese iseseisvat otsustusõigust.";
  const contract = buildRequestedQualitativeSlotContract(argsFor([slot], [evidence])).trace;
  assert.equal(contract.complete, true);
  assert.deepEqual(contract.slots[0].action_object_bindings.map(binding => binding.action_family), ["improve"]);
  const retrievalMeta = metaFor([slot], contract);
  const sources = [{ source_id: "study-source", document_id: "study-doc", evidenceText: `Teenuste uuring\n${evidence}` }];
  for (const reply of ["Toetatud otsustamine: arendada eestkoste alternatiive ehk toetatud otsustamise süsteemi.",
    "Toetatud otsustamine: arendada lahendusi, mis vähendavad eestkoste ulatust ja toetavad inimese iseseisvat otsustusõigust."]) {
    assert.equal(validateExactFactAnswer({ reply, sources, retrievalMeta }).passed, true, reply);
  }
  for (const reply of ["Toetatud otsustamine: keelata lahendused, mis võimaldavad iseseisvat otsustamist.",
    "Toetatud otsustamist ei tule arendada."]) {
    assert.equal(validateExactFactAnswer({ reply, sources, retrievalMeta }).passed, false, reply);
  }
});

test("recommendation relative clauses retain an explicitly requested second object", () => {
  const slot = { index: 3, value_type: "recommendation", relation_terms: ["teenustele", "pääsu", "korduvate", "hindamiste"], minimum_answer_items: 1 };
  const evidence = "Teenustele pääsu tuleb lihtsustada, mis võimaldab vältida korduvaid hindamisi.";
  const contract = buildRequestedQualitativeSlotContract(argsFor([slot], [evidence])).trace;
  assert.equal(contract.complete, true);
  assert.deepEqual(contract.slots[0].action_object_bindings.map(binding => binding.action_family), ["simplify", "avoid"]);
  const retrievalMeta = metaFor([slot], contract);
  const sources = [{ source_id: "study-source", document_id: "study-doc", evidenceText: `Teenuste uuring\n${evidence}` }];
  assert.equal(validateExactFactAnswer({ reply: "Teenustele pääsu tuleb lihtsustada.", sources, retrievalMeta }).passed, false);
  assert.equal(validateExactFactAnswer({ reply: "Teenustele pääsu tuleb lihtsustada ning korduvaid hindamisi vältida.", sources, retrievalMeta }).passed, true);
});

test("synthesis does not give orphan service claims the preceding search hit's subject", () => {
  const group = { sourceId: "article", title: "Valdkondade koostöö", sourceType: "journal_article", bodies: [
    "Kohalikud omavalitsused katsetavad erihoolekandes koostööd. Rehabilitatsiooniteenuste valdkondi lähendatakse.",
    "Teenuse eelarvet ei jaotata enam ettevõttepõhiselt ja inimene valib teenuseosutaja."
  ] };
  assert.equal(hasUnresolvedPassageOpening(group.bodies[1], group), true);
  const result = buildContextWithBudget([group], { requireSelfContainedPassages: true });
  assert.match(result.text, /Rehabilitatsiooniteenuste/u);
  assert.doesNotMatch(result.text, /ettevõttepõhiselt/u);
  assert.equal(result.used[0].bodies.length, 1);
  assert.equal(hasUnresolvedPassageOpening("Abiteenuse korraldust muudeti. Teenuse eelarve kasvas.", group), false);
  assert.equal(hasUnresolvedPassageOpening(group.bodies[1], { ...group, title: "Rehabilitatsiooniteenuse korraldus" }), false);
  assert.equal(hasUnresolvedPassageOpening(group.bodies[1], { ...group, title: "Rehabilitatsiooniteenused ja erihoolekandeteenused" }), true);
  assert.equal(hasUnresolvedPassageOpening(group.bodies[1], { ...group, sourceType: "kov_service_info" }), false);
});

test("synthesis clipping preserves complete sentences and ordinal years without increasing the cap", () => {
  const complete = "Koostöö algas 2018. aastal ning jätkub kohalikes omavalitsustes.";
  const body = `${complete} Rehabilitatsiooniteenuste korralduse kohta järgneb pikk selgitus. ${"Lisateave. ".repeat(20)}`;
  const header = "(1) Näide\n";
  const result = renderOneContextBlock({ title: "Näide", bodies: [body] }, 0, { bodyMaxChars: 88, requireSelfContainedPassages: true });
  assert.equal(result, `${header}${complete}...`);
  assert.ok(result.length - header.length <= 88);
  const short = renderOneContextBlock({ title: "Näide", bodies: ["Uuring algas 2018. aastal ning " + "pikk ".repeat(30)] }, 0,
    { bodyMaxChars: 88, requireSelfContainedPassages: true });
  assert.doesNotMatch(short, /Uuring algas 2018\./u);
  const coordinated = renderOneContextBlock({ title: "Näide", bodies: ["Uuring algas 2018. ja 2019. aastal ning " + "pikk ".repeat(30)] }, 0,
    { bodyMaxChars: 88, requireSelfContainedPassages: true });
  assert.doesNotMatch(coordinated, /Uuring algas 2018\./u);
  const context = buildContextWithBudget([
    { sourceId: "first", title: "Esimene", bodies: [complete] },
    { sourceId: "empty", title: "Teine", bodies: ["Pikk lõpetamata lause " + "sõna ".repeat(50)] },
    { sourceId: "third", title: "Kolmas", bodies: [complete] }
  ], { requireSelfContainedPassages: true, secondaryBodyMaxChars: 88 });
  assert.deepEqual(context.used.map(group => group.sourceId), ["first", "third"]);
  assert.equal(context.renderedBlocks.length, context.used.length);
  assert.match(context.renderedBlocks[1].text, /^\(2\) Kolmas/u);
});
