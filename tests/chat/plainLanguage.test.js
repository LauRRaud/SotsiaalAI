import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluatePlainLanguageInvariant,
  normalizePlainLanguagePreference
} from "../../lib/chat/plainLanguage.js";
import { buildPlainLanguageSystemInstruction } from "../../lib/chat/mainRouteRuntime.js";
import { langStrings, toResponsesInput } from "../../lib/chat/promptBuilder.js";

const GOLDEN_CASES = [
  {
    name: "ET legal deadline and source",
    locale: "et",
    source: "Kui taotlus on täielik, vastab KOV 10 päeva jooksul [SHS § 15]. Otsus võib hilineda.",
    candidate: "Kui taotlus on täielik, peab KOV vastama 10 päeva jooksul. Otsus võib hilineda. Allikas: [SHS § 15]."
  },
  {
    name: "ET exception and amount",
    locale: "et",
    source: "Toetus on 200 €, välja arvatud juhul, kui erand on põhjendatud [määrus].",
    candidate: "Toetus on 200 €. Välja arvatud juhul, kui erand on põhjendatud. Vaata [määrus]."
  },
  {
    name: "ET crisis instruction",
    locale: "et",
    source: "Kui on otsene oht, helista kohe 112. Abi võib saabuda kiiresti.",
    candidate: "Kui on otsene oht, helista kohe 112. Abi võib saabuda kiiresti."
  },
  {
    name: "ET municipality condition",
    locale: "et",
    source: "Ainult juhul, kui elukoht on Tallinnas, kasuta vormi 3 [Tallinn].",
    candidate: "Ainult juhul, kui elukoht on Tallinnas, täida vorm 3. Allikas on [Tallinn]."
  },
  {
    name: "EN legal deadline and source",
    locale: "en",
    source: "If the application is complete, the authority replies within 30 days [Act s. 7]. It may take longer.",
    candidate: "If the application is complete, expect a reply within 30 days. It may take longer. See [Act s. 7]."
  },
  {
    name: "EN exception and percentage",
    locale: "en",
    source: "The rate is 80%, except when the special rule applies https://example.test/rule.",
    candidate: "The rate is 80%. Except when the special rule applies. Source: https://example.test/rule."
  },
  {
    name: "EN crisis instruction",
    locale: "en",
    source: "If there is immediate danger, call 112. Support may also be available locally.",
    candidate: "If there is immediate danger, call 112. Local support may also be available."
  },
  {
    name: "EN only-if condition",
    locale: "en",
    source: "The payment is 45 EUR only if the assessment is valid [guide].",
    candidate: "The payment is 45 EUR. It applies only if the assessment is valid. See [guide]."
  },
  {
    name: "RU legal deadline and source",
    locale: "ru",
    source: "Если заявление полное, ответ дают в течение 15 дней [Закон § 4]. Срок может измениться.",
    candidate: "Если заявление полное, ответ дают в течение 15 дней. Срок может измениться. Источник: [Закон § 4]."
  },
  {
    name: "RU exception and amount",
    locale: "ru",
    source: "Сумма — 120 €, кроме случая, когда действует особое правило [порядок].",
    candidate: "Сумма — 120 €. Кроме случая, когда действует особое правило. Источник: [порядок]."
  },
  {
    name: "RU crisis instruction",
    locale: "ru",
    source: "Если есть непосредственная опасность — звони 112. Помощь может приехать быстро.",
    candidate: "Если есть непосредственная опасность — звони 112. Помощь может приехать быстро."
  },
  {
    name: "RU only-if condition",
    locale: "ru",
    source: "Выплата составляет 60 EUR только если решение действует [правило].",
    candidate: "Выплата составляет 60 EUR. Она доступна только если решение действует. См. [правило]."
  }
];

test("plain-language preference accepts literal true only", () => {
  assert.equal(normalizePlainLanguagePreference(true), true);
  for (const value of [false, "true", 1, {}, [], null, undefined]) {
    assert.equal(normalizePlainLanguagePreference(value), false);
  }
});

test("localized plain-language instructions are server-owned and preserve invariants", () => {
  for (const locale of ["et", "en", "ru"]) {
    const instruction = buildPlainLanguageSystemInstruction(locale);
    assert.match(instruction, /PLAIN_LANGUAGE_MODE:/);
    assert.match(instruction, /112/);
    assert.ok(instruction.length > 250, locale);

    const request = toResponsesInput({
      history: [],
      userMessage: "test",
      context: "",
      effectiveRole: "CLIENT",
      grounding: "none",
      replyLang: locale,
      extraSystemInstructions: [instruction]
    });
    assert.equal(request.input.at(-2)?.role, "system");
    assert.equal(request.input.at(-2)?.content, instruction);
  }
});

test("12 golden cases preserve citations, numbers, conditions, uncertainty and exact crisis text", () => {
  for (const item of GOLDEN_CASES) {
    const crisisInstruction = langStrings(item.locale, "CLIENT").crisis;
    const result = evaluatePlainLanguageInvariant({
      source: item.source,
      candidate: item.candidate,
      crisisInstruction
    });
    assert.equal(result.ok, true, `${item.name}: ${JSON.stringify(result.missing)}`);
  }
});

test("invariant gate fails closed for every protected token class", () => {
  const crisis = langStrings("et", "CLIENT").crisis;
  const cases = [
    ["Vaata [SHS § 15].", "Vaata seadust.", "citations"],
    ["Tähtaeg on 10 päeva.", "Tähtaeg on varsti.", "numbers"],
    ["Kui taotlus on täielik, jätka.", "Taotlus on täielik. Jätka.", "conditions"],
    ["Otsus võib muutuda.", "Otsus muutub.", "uncertainty"],
    [`${crisis} Mine turvalisse kohta.`, "Helista hädaabisse. Mine turvalisse kohta.", "crisisInstruction"]
  ];

  for (const [source, candidate, key] of cases) {
    const result = evaluatePlainLanguageInvariant({ source, candidate, crisisInstruction: crisis });
    assert.equal(result.ok, false, key);
    assert.ok(result.missing[key].length > 0, key);
  }
});
