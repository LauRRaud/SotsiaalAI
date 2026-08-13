import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildJourneyDraft } from "../../lib/journey/draft.js";

function urgent(text) {
  return buildJourneyDraft({ situation: text }).riskSignals.some((item) => /112/u.test(item));
}

test("SOL-JOUR-11: negated, historical and tentative danger is not immediate in ET/EN/RU", () => {
  const negated = [
    "Olukord ei ole ohtlik ja vahetut ohtu ei ole.",
    "The situation is not dangerous and there is no immediate danger.",
    "Ситуация не опасна, непосредственной угрозы нет."
  ];
  for (const text of negated) {
    const draft = buildJourneyDraft({ situation: text });
    assert.equal(urgent(text), false, text);
    assert.equal(draft.riskSignals.length, 0, text);
  }

  const contextual = [
    "Vägivald oli varem, praegu olen turvalises kohas.",
    "There was violence before, but I am safe now.",
    "Насилие было раньше, сейчас я в безопасности.",
    "Kardan, et võib tekkida oht.",
    "I am afraid there might be danger.",
    "Я боюсь, что может возникнуть опасность.",
    "Naabrit ähvardati eile, mina ei ole ohus.",
    "My neighbour was threatened yesterday; I am safe.",
    "Соседу вчера угрожали, я в безопасности."
  ];
  for (const text of contextual) {
    const draft = buildJourneyDraft({ situation: text });
    assert.equal(urgent(text), false, text);
    assert.equal(draft.riskSignals.length, 1, text);
    assert.doesNotMatch(draft.riskSignals[0], /112/u, text);
    assert.notEqual(draft.primaryPath, "PRE_INQUIRY", text);
  }
});

test("SOL-JOUR-11: direct immediate danger stays fail-closed in ET/EN/RU", () => {
  for (const text of [
    "Olen vahetus ohus, mind ähvardatakse praegu.",
    "I am in immediate danger and I am being threatened now.",
    "Я в непосредственной опасности, мне угрожают прямо сейчас."
  ]) {
    const draft = buildJourneyDraft({ situation: text });
    assert.equal(urgent(text), true, text);
    assert.equal(draft.primaryPath, "PRE_INQUIRY", text);
  }
});

test("SOL-JOUR-11: the owner can correct or clear a stored risk signal", async () => {
  const detail = await readFile(
    new URL("../../components/journey/JourneyDetail.jsx", import.meta.url),
    "utf8"
  );
  assert.match(detail, /id="journey-detail-risk-signals"/u);
  assert.match(detail, /riskSignals:\s*textToLines\(form\.riskSignals\)/u);
});
