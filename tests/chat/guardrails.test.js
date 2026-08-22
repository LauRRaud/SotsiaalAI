import assert from "node:assert/strict";
import test from "node:test";

import { getChatSessionTurnLimit } from "../../lib/chat/guardrails.js";

test("a normal conversation supports the complete 75-turn RAG quality gate", () => {
  assert.equal(getChatSessionTurnLimit() >= 75, true);
});

test("the session turn limit accepts a bounded deployment override", () => {
  assert.equal(getChatSessionTurnLimit("120"), 120);
  assert.equal(getChatSessionTurnLimit("invalid"), getChatSessionTurnLimit());
});
