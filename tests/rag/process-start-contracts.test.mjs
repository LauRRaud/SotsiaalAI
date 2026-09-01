import assert from "node:assert/strict";
import { test } from "node:test";

import { buildQuestionPlan } from "../../lib/chat/questionPlanner.js";

function firstRequestedSlot(message) {
  return buildQuestionPlan({ message, role: "SOCIAL_WORKER" })
    .semantic_candidates.requested_fact_slots.slots[0];
}

test("a where-word asking where a process begins is not a physical location slot", () => {
  const slot = firstRequestedSlot(
    "Kust algab patsiendi raviteekond ning kas ravikindlustuse puudumine välistab pöördumise?"
  );

  assert.equal(slot.value_type, "text_relation");
  assert.ok(slot.relation_terms.includes("raviteekond"));
  assert.ok(slot.relation_terms.includes("ravikindlustuse"));
});

test("an actual place question remains a physical location slot", () => {
  const slot = firstRequestedSlot("Kus asub sõltuvushäirete keskus?");

  assert.equal(slot.value_type, "location");
});

test("an explicit specialist question keeps the more precise person-role slot", () => {
  const slot = firstRequestedSlot(
    "Millise spetsialisti vastuvõtust raviteekond algab ja kas keskusesse võib tulla ka ravikindlustuseta inimene?"
  );

  assert.equal(slot.value_type, "person_role");
});
