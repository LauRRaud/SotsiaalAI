import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPlainLanguageReadingAid,
  canExplainJourneySummary
} from "@/lib/journey/plainLanguageExplanation";

test("plain-language reading aid keeps the original source available and separates its sentences", () => {
  const source = "Esita taotlus 17. juuliks. Kui vajalik info puudub, küsi abi.";
  assert.equal(canExplainJourneySummary({ source }), true);
  assert.deepEqual(buildPlainLanguageReadingAid(source), [
    "Esita taotlus 17. juuliks.",
    "Kui vajalik info puudub, küsi abi."
  ]);
});

test("the reading aid never rewrites: dates, numbers and words survive verbatim", () => {
  const source = "Maksa 42 eurot enne 01.09.2026. Otsus tehakse 30 päeva jooksul.";
  const aid = buildPlainLanguageReadingAid(source);
  // Every sentence is a verbatim slice of the source — nothing added or paraphrased.
  for (const line of aid) {
    assert.ok(source.includes(line), `line not found verbatim in source: ${line}`);
  }
  const joined = aid.join(" ");
  assert.ok(joined.includes("42 eurot"));
  assert.ok(joined.includes("01.09.2026"));
  assert.ok(joined.includes("30 päeva"));
});

test("an empty or blank source is never explainable and yields no reading aid", () => {
  assert.equal(canExplainJourneySummary({ source: "" }), false);
  assert.equal(canExplainJourneySummary({ source: "   " }), false);
  assert.equal(canExplainJourneySummary({}), false);
  assert.deepEqual(buildPlainLanguageReadingAid(""), []);
  assert.deepEqual(buildPlainLanguageReadingAid("   "), []);
});

test("plain-language explanation is unavailable for crisis, legal and official sources", () => {
  assert.equal(canExplainJourneySummary({ source: "Helista kohe 112." }), false);
  assert.equal(canExplainJourneySummary({ source: "Nõusolek tuleb allkirjastada." }), false);
  assert.equal(canExplainJourneySummary({ source: "Käesolev ametlik otsus kehtib." }), false);
  assert.equal(canExplainJourneySummary({ source: "Tavaline kokkuvõte.", isOfficial: true }), false);
});

test("the crisis/legal boundary also holds for English and Russian source text", () => {
  assert.equal(canExplainJourneySummary({ source: "Call emergency services now." }), false);
  assert.equal(canExplainJourneySummary({ source: "This legal decision is final." }), false);
  assert.equal(canExplainJourneySummary({ source: "Требуется согласие пациента." }), false);
  assert.equal(canExplainJourneySummary({ source: "Позвоните 112 немедленно." }), false);
});
