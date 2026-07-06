import test from "node:test";
import assert from "node:assert/strict";

import { shouldUseExternalSourcesForTurn } from "../../lib/chat/sourceNeed.js";

test("uses RAG for ordinary municipality services and supports questions", () => {
  assert.equal(
    shouldUseExternalSourcesForTurn("Kas Jõgeva pakub sotsiaalteenuseid ja toetusi?"),
    true
  );
});

test("uses RAG for service jurisdiction classification questions", () => {
  assert.equal(
    shouldUseExternalSourcesForTurn("Varjupaigateenus on KOV või riiklik teenus?"),
    true
  );
});

test("uses RAG for affirmative numbered follow-ups when there is history", () => {
  assert.equal(
    shouldUseExternalSourcesForTurn("2", { hasHistory: true }),
    true
  );
});

test("does not treat a decline as a retrieval follow-up by itself", () => {
  assert.equal(
    shouldUseExternalSourcesForTurn("ei", { hasHistory: true }),
    false
  );
});

test("uses RAG for short article follow-ups when recent assistant sources exist", () => {
  const options = {
    hasHistory: true,
    hasRecentAssistantSources: true
  };

  assert.equal(
    shouldUseExternalSourcesForTurn("kas seal Eestit ka mainitakse?", options),
    true
  );
  assert.equal(
    shouldUseExternalSourcesForTurn("Soome", options),
    true
  );
  assert.equal(
    shouldUseExternalSourcesForTurn("OTT", options),
    true
  );
});

test("uses RAG for work and social-field AI questions without requiring a KOV term", () => {
  assert.equal(
    shouldUseExternalSourcesForTurn("kas tehisintellekti kasutatakse tĆ¶Ć¶tukassas?"),
    true
  );
});

test("uses RAG for mental health digital support and chatbot questions", () => {
  assert.equal(
    shouldUseExternalSourcesForTurn("Vaimse tervise valdkonnas on esile kerkinud vestlusrobotid, nagu Woebot ja Wysa?"),
    true
  );
});

test("uses RAG for substantive knowledge questions without domain keyword whitelisting", () => {
  assert.equal(
    shouldUseExternalSourcesForTurn("mis on murekohad lastekaitses?"),
    true
  );
  assert.equal(
    shouldUseExternalSourcesForTurn("millest räägitakse järelevalve ja dokumenteerimise puhul?"),
    true
  );
  assert.equal(
    shouldUseExternalSourcesForTurn("kas Woebot, Wysa, Vivibot ja XiaoE on allikates mainitud?"),
    true
  );
});

test("uses RAG for natural situation descriptions and broad professional questions", () => {
  assert.equal(
    shouldUseExternalSourcesForTurn("kui mul on kodus üks eakas, kes ei tööta, siis mida tuleb teha"),
    true
  );
  assert.equal(
    shouldUseExternalSourcesForTurn("ma olen sotsiaaltöö spetsialist, aga mul ei ole lastekaitsega tegemist, mis teemad on lastekaitses peamised"),
    true
  );
  assert.equal(
    shouldUseExternalSourcesForTurn("mul pole süüa, mida teha"),
    true
  );
  assert.equal(
    shouldUseExternalSourcesForTurn("mul pole süüa"),
    true
  );
});

test("does not use RAG for assistant capability and greeting turns", () => {
  assert.equal(
    shouldUseExternalSourcesForTurn("kas sa saad mind aidata?"),
    false
  );
  assert.equal(
    shouldUseExternalSourcesForTurn("tere"),
    false
  );
});

test("does not use RAG for a source-anchored decline", () => {
  assert.equal(
    shouldUseExternalSourcesForTurn("ei", {
      hasHistory: true,
      hasRecentAssistantSources: true
    }),
    false
  );
});

test("uses RAG for broad comparison follow-ups when recent assistant sources exist", () => {
  const options = {
    hasHistory: true,
    hasRecentAssistantSources: true
  };

  assert.equal(
    shouldUseExternalSourcesForTurn("võrdle seda teiste artiklitega", options),
    true
  );
  assert.equal(
    shouldUseExternalSourcesForTurn("tee laiem ülevaade ajakirjas Sotsiaaltöö", options),
    true
  );
});

test("does not use RAG when the user asks about the source UI itself", () => {
  assert.equal(
    shouldUseExternalSourcesForTurn("Miks vastuste allikad näitab imelikult?"),
    false
  );
});
