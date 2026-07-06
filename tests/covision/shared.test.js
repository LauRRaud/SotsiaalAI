import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAnonymizedDraft,
  detectAnonymityIssues,
  draftCovisionSummary,
  inferCovisionTopics,
  suggestCentralQuestions
} from "../../lib/covisionShared.js";

test("covision anonymity check flags direct identifiers", () => {
  const issues = detectAnonymityIssues(
    "Klient Mari Mets elab aadressil Tamme tn 12, telefon +372 5123 4567, isikukood 48901011234 ja e-post mari@example.ee."
  );
  const types = new Set(issues.map((issue) => issue.type));

  assert.equal(types.has("name"), true);
  assert.equal(types.has("address"), true);
  assert.equal(types.has("phone"), true);
  assert.equal(types.has("personal_code"), true);
  assert.equal(types.has("email"), true);
});

test("covision anonymized draft removes direct contact details", () => {
  const draft = buildAnonymizedDraft("Helista +372 5123 4567 või kirjuta mari@example.ee. Kohtumine oli 2026-05-06.");

  assert.match(draft, /\[telefon eemaldatud\]/);
  assert.match(draft, /\[e-post eemaldatud\]/);
  assert.match(draft, /\[kuupäev üldistada\]/);
  assert.doesNotMatch(draft, /mari@example\.ee/);
});

test("covision topic inference reuses the shared need taxonomy", () => {
  const topics = inferCovisionTopics("Hoolduskoormus kasvab ja perearstiga kontakt ei toimi.");

  assert.equal(topics.includes("hoolduskoormus"), true);
});

test("covision question suggestions stay in a supporting role", () => {
  const questions = suggestCentralQuestions({
    description: "Inimene keeldub teenusest ja hoolduskoormus kasvab.",
    topics: ["hoolduskoormus"],
    riskFactors: [{ type: "risk", label: "teenusest keeldumine" }]
  });

  assert.equal(questions.length, 3);
  assert.match(questions.join(" "), /kaaluda|läbi mõelda|dokumenteerimine/);
  assert.doesNotMatch(questions.join(" "), /tuleb kindlasti|otsus on/);
});

test("covision summary draft groups structured discussion without deciding outcome", () => {
  const summary = draftCovisionSummary(
    {
      centralQuestion: "Kuidas edasi liikuda?",
      riskFactors: [{ type: "risk", label: "isolatsioon" }]
    },
    [
      { messageType: "observation", body: "Võrgustik on ebaühtlaselt kaasatud." },
      { messageType: "next_step", body: "Võiks kaaluda võrgustiku kohtumist." }
    ]
  );

  assert.match(summary.content, /Keskne küsimus/);
  assert.match(summary.keyObservations, /Võrgustik/);
  assert.match(summary.possibleNextSteps, /Võiks kaaluda/);
  assert.doesNotMatch(summary.content, /lõplik otsus/);
});
