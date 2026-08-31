import assert from "node:assert/strict";
import { test } from "node:test";
import { buildQuestionPlan } from "../../lib/chat/questionPlanner.js";
import { buildQuestionRequirementsShadow, projectQuestionRequirementsShadow } from "../../lib/chat/questionRequirements.js";

test("shadow separates known percent interpretation from a study-time requirement without copying values", () => {
  for (const value of ["36", "27,5"]) {
    const message = `Mida tähendab artiklis „Mida uuriti?” ${value}% ning mis ajast pärineb viidatud uuring?`;
    const plan = buildQuestionPlan({ message }), before = structuredClone(plan);
    const shadow = buildQuestionRequirementsShadow({ originalMessage: message, resolvedQuestionPlan: plan });
    assert.deepEqual(shadow.requirements.map(item => item.kind), ["known_value_interpretation", "time"]);
    assert.equal(shadow.requirements[1].known_anchors.length, 0);
    assert.equal(shadow.requirements[0].known_anchors[0].unit, "percent");
    assert.deepEqual(plan, before, "shadow must not mutate production planning");
    assert.equal(shadow.used_for_validation, false);
    assert.equal(shadow.used_for_generation, false);
  }
});

test("source-relative modifier is not an independent shadow question; coordinated question remains one", () => {
  const prefix = "Kuidas erinevad kaks mudelit tegevuste järjekorra poolest";
  const modifier = buildQuestionRequirementsShadow({ originalMessage: `${prefix}, mida võrreldakse 2017. aasta artiklis?` });
  assert.equal(modifier.requirements.length, 1);
  assert.equal(modifier.source_modifier_count, 1);
  assert.equal(modifier.requirements[0].kind, "order_comparison");
  assert.equal(buildQuestionRequirementsShadow({ originalMessage: `${prefix} ja mida artiklis võrreldakse?` }).requirements.length, 2);
});

test("production planner excludes the bibliographic modifier but keeps a real second question", () => {
  const modifier = buildQuestionPlan({
    message: "Milline on eluaseme ja rehabilitatsiooni järjekord kahes lähenemises, mida võrreldakse 2017. aasta artiklis „Näide”?"
  });
  assert.equal(modifier.semantic_candidates.requested_fact_slots.slots.length, 1);
  assert.equal(modifier.semantic_candidates.requested_fact_slots.slots[0].payload_kind, "directed_event_relation_set");
  const explicit = buildQuestionPlan({
    message: "Milline on eluaseme ja rehabilitatsiooni järjekord kahes lähenemises ja mida artiklis võrreldakse?"
  });
  assert.equal(explicit.semantic_candidates.requested_fact_slots.slots.length, 2);
  assert.equal(explicit.semantic_candidates.requested_fact_slots.slots[1].payload_kind, undefined);
  const realSubordinate = buildQuestionPlan({
    message: "Palun selgita, mida võrreldakse 2017. aasta artiklis ja milline oli põhitulemus?"
  });
  assert.equal(realSubordinate.semantic_candidates.requested_fact_slots.slots.length, 2);
  assert.equal(buildQuestionRequirementsShadow({
    originalMessage: "Palun selgita, mida võrreldakse 2017. aasta artiklis ja milline oli põhitulemus?"
  }).requirements.length, 2);
});

test("original UTF-16 offsets survive emoji, decomposed accents, whitespace and repeated years", () => {
  const text = "🙂  Mida ta\u0308hendab 36%?\n\tMis ajast pärineb uuring: 2024 või 2024?";
  const shadow = buildQuestionRequirementsShadow({ originalMessage: text });
  for (const requirement of shadow.requirements) assert.equal(text.slice(requirement.origin_span.start, requirement.origin_span.end), requirement.text);
  assert.equal(shadow.requirements[0].origin_span.start, text.indexOf("Mida"));
  const percent = shadow.requirements[0].known_anchors[0];
  assert.equal(text.slice(percent.origin_span.start, percent.origin_span.end), "36%");
  assert.notEqual(shadow.contract_hash, buildQuestionRequirementsShadow({ originalMessage: text.replace("36", "37") }).contract_hash);
});

test("shadow diagnostics are idempotent and exclude private wording, author names and known values", () => {
  const shadow = buildQuestionRequirementsShadow({ originalMessage: "Mida tähendab PRIVATE_AUTHOR tekstis 36% ning mis ajast on uuring?" });
  const safe = projectQuestionRequirementsShadow(shadow);
  assert.doesNotMatch(JSON.stringify(safe), /PRIVATE_AUTHOR|tähendab|36%|known_anchors|expected_answer/);
  assert.deepEqual(projectQuestionRequirementsShadow(safe), safe);
  assert.equal(safe.requirement_count, 2);
  assert.equal(projectQuestionRequirementsShadow({ version: "unknown", text: "PRIVATE" }), null);
  assert.equal(buildQuestionRequirementsShadow({ originalMessage: "Kes on selle artikli autor?" }).requirements.length, 1);
});
