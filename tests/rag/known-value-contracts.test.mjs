import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { buildQuestionPlan } from "../../lib/chat/questionPlanner.js";
import { buildSemanticTurnContract } from "../../lib/chat/semanticTurnContract.js";
import { buildRequestedQualitativeSlotContract, buildRequestedFactSlotCoverage } from "../../lib/chat/retrievalContextAssembler.js";
import { validateExactFactAnswer } from "../../lib/chat/factContract.js";
import { knownValueInterpretationCandidate, knownValueInterpretationMatches, referencedStudyPeriodCandidate } from "../../lib/chat/knownValueSemantics.js";
import { projectQualitativeGateChecks } from "../../lib/chat/ragDiagnostics.js";
import { buildRagTraceFromAttribution } from "../../lib/chat/mainResponseHandler.js";
import { projectRagDiagnosticEvidence } from "../../lib/chat/ragDiagnostics.js";

// Active source re-read 2026-08-31T18:02:14Z; chunk SHA
// d042283c6e6f337b35b9deab7329ad9cc5f0d87c0d0cf3adbe97aa3a8f149171, UTF16[585,895).
const source = "WHO 2021/2022. aasta uuringu kohaselt oli viimase aasta jooksul tundnud end üksildasena 16% maailma noortest (Cosma jt 2023). Eesti noortest enim muret tekitavad näitajad olid 15-aastaste tüdrukute seas: selles rühmas on iga päev või suurema osa ajast tundnud üksildust 36% küsitletud noortest (Cosma jt 2023).";
const question = "Mida tähendab Ele Laksi 2026. aasta artiklis „Üksildus ja noored tänapäeva kogukondades” Eesti kohta esitatud 36% ning mis ajast pärineb viidatud uuring?";
const meaning = "36% Eesti küsitletud 15-aastastest tüdrukutest tundis üksildust iga päev või suurema osa ajast.";
const time = "Viidatud uuring pärineb 2021/2022. aastast.";
const identity = { required: true, matched: true, confidence: "high", selectedDocumentId: "study-doc" };

function setup(message = question, bodies = [source]) {
  const plan = buildQuestionPlan({ message });
  const groups = [{ docId: "study-doc", sourceId: "study-source", bodies }];
  const args = { questionPlan: plan, renderedGroups: groups, specificResearchFactQuestion: true, documentIdentityEvidence: identity };
  const built = buildRequestedQualitativeSlotContract(args);
  const slots = plan.semantic_candidates.requested_fact_slots.slots;
  const meta = { documentIdentityEvidence: identity, requestedQualitativeSlotContract: built.trace,
    queryPlan: { mode: "specific_research_fact", semantic_turn_contract: {
      requested_facts: slots, requested_fact_contract: { complete: true }
    } } };
  const validate = reply => validateExactFactAnswer({ message, reply, retrievalMeta: meta,
    sources: [{ document_id: "study-doc", source_id: "study-source", evidenceText: bodies.join("\n---\n") }] });
  return { plan, slots, built, args, groups, validate };
}

test("F05 verified original excerpt retains its exact hash", () => {
  assert.equal(createHash("sha256").update(source).digest("hex"), "a5c795d3e2bc48bf8cabc2f650db4f033c2d42b1bcfb6db77d312ef5e3fab046");
});

test("F05 known value and referenced period are separate canonical requirements, not an answer key", () => {
  for (const message of [question, "Mida tähendab uuringus Eesti 36% ja millal toimus viidatud uuring?"]) {
    const { plan, slots } = setup(message);
    assert.equal(slots.length, 2);
    assert.equal(slots[0].value_type, "text_relation");
    assert.equal(slots[0].payload_kind, "known_value_interpretation");
    assert.deepEqual(slots[0].known_anchor, { value: "36", unit: "percent" });
    assert.deepEqual(slots[0].explicit_values, ["36%"]);
    assert.equal(slots[1].value_type, "timepoint");
    assert.equal(slots[1].temporal_role, "referenced_study_period");
    assert.deepEqual(slots[1].explicit_values, []);
    assert.equal(slots[1].reference_slot_index, 1);
    assert.ok(!slots.flatMap(slot => slot.relation_terms).some(term => ["ele", "laksi"].includes(term)));
    assert.doesNotMatch(JSON.stringify(slots), /2021|2022|2023|girls|tudruk|daily|15/u);
    const contract = buildSemanticTurnContract({ questionPlan: plan });
    assert.deepEqual(contract.requested_facts, slots);
  }
});

test("different clauses never inherit a known value from an adjacent requirement", () => {
  const { slots } = setup("Mida tähendab Eesti 36% ja mida tähendab Soome 24%?");
  assert.deepEqual(slots.map(slot => slot.explicit_values), [["36%"], ["24%"]]);
  assert.deepEqual(slots.map(slot => slot.known_anchor.value), ["36", "24"]);
});

test("F05 source producer binds meaning and period and feeds the same payload to validator", () => {
  const { built, validate, plan, groups, args } = setup();
  assert.equal(built.trace.complete, true, JSON.stringify(built.trace));
  assert.deepEqual(built.trace.slots[0].admitted_payload.population,
    { cohort: "girls", age: { value: "15", unit: "year", operator: "equal" }, surveyed: true });
  assert.deepEqual(built.trace.slots[1].admitted_payload,
    { kind: "referenced_study_period", role: "referenced_study_period", start_year: "2021", end_year: "2022" });
  assert.match(built.instruction, /admitted_proposition=/u);
  assert.equal(buildRequestedFactSlotCoverage(plan, groups, args).complete, true);
  const result = validate(`${meaning}\n${time}`);
  assert.equal(result.passed, true, JSON.stringify(result));
});

test("F05 normal paraphrases preserve the typed proposition", () => {
  const { validate } = setup();
  for (const reply of [meaning,
    "Eestis tundis 36% küsitletud 15-aastastest tüdrukutest end üksildasena igapäevaselt või enamiku ajast."]) {
    const result = validate(`${reply}\nUuring toimus 2021–2022.`);
    assert.equal(result.passed, true, JSON.stringify(result));
  }
});

test("two atomic claims may share one sentence and the period may be requested first", () => {
  const reversed = "Mis ajast pärineb viidatud uuring ning mida tähendab uuringus Eesti 36%?";
  for (const message of [question, reversed]) {
    const { built, slots, validate } = setup(message);
    assert.equal(built.trace.complete, true, JSON.stringify(built.trace));
    const periodSlot = slots.find(slot => slot.payload_kind === "referenced_study_period");
    assert.equal(slots.find(slot => slot.index === periodSlot.reference_slot_index).payload_kind, "known_value_interpretation");
    for (const reply of [`${meaning.slice(0, -1)} ning ${time.toLowerCase()}`,
      `Uuring toimus 2021–2022 ning ${meaning}`]) {
      const result = validate(reply);
      assert.equal(result.passed, true, JSON.stringify(result));
    }
  }
});

test("same percentage cannot hide wrong population, age unit, phenomenon, frequency or negation", () => {
  const { validate } = setup();
  for (const wrong of [
    meaning.replace("tüdrukutest", "poistest"), meaning.replace("15-aastastest", "14-aastastest"),
    meaning.replace("15-aastastest", "15-eurostest"), meaning.replace("15-aastastest", "kuni 15-aastastest"),
    meaning.replace("15-aastastest", "13–15-aastastest"), meaning.replace("36%", "36 küsitletut"),
    meaning.replace("36%", "16%"), meaning.replace("tundis", "ei tundnud"),
    meaning.replace("üksildust", "ärevust"), meaning.replace("iga päev või suurema osa ajast", "mõnikord"),
    meaning.replace("või", "ja"), meaning.replace("või suurema osa ajast", ""),
    meaning.replace("Eesti", "Soome"), meaning.replace("küsitletud", "kõigist"),
    meaning.replace("15-aastastest tüdrukutest", "kõigist noortest")
  ]) {
    const result = validate(`${wrong}\n${time}`);
    assert.equal(result.passed, false, wrong);
  }
});

test("publication and citation years cannot replace the study interval", () => {
  const { validate } = setup();
  for (const wrong of ["Uuring pärineb 2023. aastast.", "Uuring pärineb 2026. aastast.",
    "Uuring toimus 2022/2021.", "Uuring toimus 2021.", "Uuring (Cosma jt 2023).",
    "Uuring toimus 2021/2022 ja uuring toimus 2023/2024."]) {
    assert.equal(validate(`${meaning}\n${wrong}`).passed, false, wrong);
  }
});

test("shared typed parser also binds other values, age, cohort, measure and country", () => {
  const anchor = { value: "24", unit: "percent" };
  const original = "Soome küsitletud 17-aastastest poistest tundis stressi iga päev 24%.";
  const candidate = knownValueInterpretationCandidate(original, anchor, ["soome"]);
  assert.equal(candidate.status, "ADMITTED");
  assert.equal(knownValueInterpretationMatches(candidate.payload, "24% Soome küsitletud 17-aastastest poistest tundis stressi iga päev."), true);
  assert.equal(knownValueInterpretationMatches(candidate.payload, original.replace("stressi", "hirmu")), false);
});

test("a neighboring unrelated study cannot lend its period to the known percentage", () => {
  assert.equal(setup(question, [source.replace("(Cosma jt 2023). Eesti", "(Teine jt 2023). Eesti")]).built.trace.complete, false);
  assert.equal(setup(question, [source.replace("WHO 2021/2022. aasta uuringu", "WHO uuringu")]).built.trace.complete, false);
  assert.equal(referencedStudyPeriodCandidate("Uuringu allikas (Cosma jt 2023).").status, "UNCHECKABLE");
  const sameNumberDifferentStudy = source.replace("16%", "36%").replace("(Cosma jt 2023)", "(Aas jt 2023)");
  const result = setup(question, [sameNumberDifferentStudy]).built.trace;
  assert.equal(result.complete, false);
  assert.deepEqual(result.missing_slot_indexes, [2]);
});

test("conflicting body propositions cannot be resolved by score or body order", () => {
  for (const bodies of [[source, source.replace("15-aastaste", "17-aastaste")],
    [source.replace("2021/2022", "2019/2020"), source]]) {
    assert.equal(setup(question, bodies).built.trace.complete, false);
    assert.equal(setup(question, [...bodies].reverse()).built.trace.complete, false);
  }
});

test("typed semantic rejection is observable without raw values or private text", () => {
  const { validate } = setup();
  const result = validate(`${meaning.replace("tüdrukutest", "poistest")}\n${time}`);
  const gates = result.trace.requested_fact_qualitative_gate_checks;
  assert.ok(gates, JSON.stringify(result.trace));
  const projected = projectQualitativeGateChecks(gates);
  assert.ok(projected.some(item => item.rejection_counts.known_value_population_mismatch > 0));
  assert.deepEqual(projectQualitativeGateChecks(projected), projected);
  assert.doesNotMatch(JSON.stringify(projected), /tudruk|poist|36|Cosma|2023/u);
});

test("population and frequency words in different predicate roles are not admitted", () => {
  const { validate } = setup();
  for (const wrong of [
    "36% Eesti küsitletud 15-aastastest tüdrukutest tundis üksildust harva, iga päev või suurema osa ajast mängisid nad telefoniga.",
    "36% Eesti küsitletud 15-aastastest tüdrukutest mängis iga päev või suurema osa ajast telefoniga, üksildust käsitleti artikli teises osas.",
    "Eesti küsitletud 15-aastaste tüdrukute kõrval oli kõigi vastanud noorte seas üksildust iga päev või suurema osa ajast tundnuid 36%.",
    "Eesti 15-aastaste tüdrukute kohta küsitletud emadest tundis 36% iga päev või suurema osa ajast üksildust.",
    "Eesti emade andmed olid 15-aastaste tüdrukute seas: selles rühmas on iga päev või suurema osa ajast tundnud üksildust 36% küsitletud noortest."
  ]) assert.equal(validate(`${wrong}\n${time}`).passed, false, wrong);
});

test("one valid sentence cannot hide another contradictory known-value or study claim", () => {
  const { validate } = setup();
  for (const wrong of [meaning.replace("tüdrukutest", "poistest"), meaning.replace("15-aastastest", "16-aastastest"),
    "Teine, selle näitajaga seostamata uuring pärineb 2021/2022. aastast.", "Uuring pärineb 2023. aastast."]) {
    assert.equal(validate(`${meaning}\n${time}\n${wrong}`).passed, false, wrong);
    assert.equal(validate(`${wrong}\n${meaning}\n${time}`).passed, false, wrong);
  }
});

test("study reference cannot cross conflicting bibliography or a second study predicate", () => {
  const referencePayload = setup().built.trace.slots[0].admitted_payload;
  for (const text of [
    source.replace("(Cosma jt 2023). Eesti", "(Aas jt 2023). Eesti"),
    source.replace("(Cosma jt 2023). Eesti", "(Cosma jt 2023) (Aas jt 2020). Eesti"),
    "WHO 2021/2022. aasta uuring puudutas õpetajaid; teises uuringus tundis 36% noortest üksildust.",
    "WHO 2021/2022. aasta uuring puudutas õpetajaid (Aas jt 2023); teist uuringut kirjeldab teine artikkel (Tamm jt 2024). Eesti 15-aastaste tüdrukute seas tundis 36% küsitletud noortest iga päev või suurema osa ajast üksildust (Tamm jt 2024).",
    "WHO 2021/2022. aasta uuring puudutas õpetajaid (Aas jt 2023), eraldi küsitluses tundis 36% noortest üksildust (Tamm jt 2024).",
    "WHO 2021/2022. aasta uuring puudutas õpetajaid (Aas jt 2023), eraldi tundis 36% noortest üksildust (Tamm jt 2024)."
  ]) assert.notEqual(referencedStudyPeriodCandidate(text, {
    referenceAnchor: { value: "36", unit: "percent" }, referencePayload
  }).status, "ADMITTED", text);
});

test("an internal body conflict survives duplicate clean bodies and canonical diagnostics", () => {
  const conflicting = `${source} Eestis küsitletud 16-aastastest poistest tundis üksildust iga päev või suurema osa ajast 36%.`;
  for (const bodies of [[conflicting], [conflicting, source], [source, conflicting]]) {
    const { built } = setup(question, bodies);
    assert.equal(built.trace.complete, false);
    assert.equal(built.trace.reason, "qualitative_evidence_conflict");
    assert.ok(built.trace.conflicting_slot_indexes.includes(1));
    const canonical = buildRagTraceFromAttribution([], null, { requestedQualitativeSlotContract: built.trace });
    const projected = projectRagDiagnosticEvidence(canonical);
    assert.equal(projected.qualitative_contract.reason, "qualitative_evidence_conflict");
    assert.ok(projected.qualitative_contract.conflicting_slot_indexes.includes(1));
  }
});

test("admitted type and dependency survive canonical trace without raw evidence payload", () => {
  const { built } = setup();
  const canonical = buildRagTraceFromAttribution([], null, { requestedQualitativeSlotContract: built.trace });
  const projected = projectRagDiagnosticEvidence(canonical);
  assert.equal(projected.qualitative_contract.slots[0].payload_kind, "known_value_interpretation");
  assert.equal(projected.qualitative_contract.slots[1].reference_slot_index, 1);
  assert.equal(projected.qualitative_contract.slots[0].admitted_payload_present, true);
  assert.doesNotMatch(JSON.stringify(projected.qualitative_contract), /girls|loneliness|Cosma|start_year|"36"/u);
});
