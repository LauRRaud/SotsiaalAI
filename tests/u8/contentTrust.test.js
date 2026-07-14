import test from "node:test";
import assert from "node:assert/strict";
import { getContentTrustState } from "../../lib/contentTrustState.js";

test("AI generated content is never human-confirmed by default", () => {
  assert.equal(getContentTrustState({ generatedText: "AI tekst" }), "ai_draft");
});

test("human edits are visible and invalidate a prior confirmation", () => {
  assert.equal(getContentTrustState({ generatedText: "AI", editedText: "Inimese tekst" }), "human_edited");
  assert.equal(getContentTrustState({ generatedText: "AI", editedText: "Kinnitatud", currentText: "Muudetud", userConfirmed: true }), "human_edited");
});

test("human confirmation requires the exact stored visible version", () => {
  assert.equal(getContentTrustState({ generatedText: "AI", editedText: "Valmis", currentText: "Valmis", userConfirmed: true }), "human_confirmed");
});

test("empty content can never be represented as human-confirmed", () => {
  assert.equal(getContentTrustState({ generatedText: "", editedText: "", currentText: "", userConfirmed: true }), "ai_draft");
});
