import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEffectivePracticeRagDocId,
  buildEffectivePracticeRagText,
  buildCovisionKnowledgeQuery,
  normalizeCovisionKnowledgeResults
} from "../../lib/covisionKnowledge.js";

test("covision knowledge query combines case question, topics, risks and support intent", () => {
  const query = buildCovisionKnowledgeQuery({
    title: "Hoolduskoormuse juhtum",
    centralQuestion: "Kuidas toetada omastehooldajat?",
    summary: "Perel on suur hoolduskoormus ja teenuste leidmine on keeruline.",
    topics: ["hoolduskoormus", "KOV teenused"],
    expectedHelpTypes: ["metoodilist arutelu", "toimiva praktika näiteid"],
    riskFactors: [
      { type: "risk", label: "lähedaste läbipõlemine" },
      { type: "protective", label: "toimiv kontakt spetsialistiga" }
    ]
  });

  assert.match(query, /Kuidas toetada omastehooldajat/);
  assert.match(query, /hoolduskoormus/);
  assert.match(query, /lähedaste läbipõlemine/);
  assert.match(query, /seadus|juhend|metoodika|praktika|teenus|toetus/);
  assert.ok(query.length <= 1200);
});

test("covision knowledge results keep usable source details and drop empty hits", () => {
  const results = normalizeCovisionKnowledgeResults([
    {
      id: "hit-1",
      title: "Terviseprobleemiga laste ja perede toetamise hea tava",
      chunk: "Hea tava kirjeldab võrgustikutöö ja teenuste koordineerimise põhimõtteid.",
      distance: 0.22,
      source_url: "https://example.ee/hea-tava",
      source_type: "best_practice_guidance",
      metadata: {
        resource_type: "best_practice_guidance",
        organization: "Sotsiaalministeerium"
      }
    },
    { id: "empty", chunk: "   " }
  ]);

  assert.equal(results.length, 1);
  assert.equal(results[0].id, "hit-1");
  assert.equal(results[0].category, "practice");
  assert.equal(results[0].title, "Terviseprobleemiga laste ja perede toetamise hea tava");
  assert.equal(results[0].url, "https://example.ee/hea-tava");
  assert.match(results[0].snippet, /võrgustikutöö/);
});

test("published effective practice rag text is structured as a reusable practice example", () => {
  const text = buildEffectivePracticeRagText({
    id: "practice-1",
    title: "Võrgustikukohtumine hoolduskoormuse vähendamiseks",
    background: "Pere hoolduskoormus oli kasvanud.",
    mainChallenge: "Abi osapooled ei olnud samas infoväljas.",
    whatHelped: "KOV, perearst ja teenuseosutaja leppisid rollid kokku.",
    learningPoints: "Varajane rollijaotus vähendas korduvaid pöördumisi.",
    topics: ["hoolduskoormus", "võrgustikutöö"]
  });

  assert.match(text, /Praktikanäide/);
  assert.match(text, /Mis aitas/);
  assert.match(text, /hoolduskoormus/);
  assert.equal(buildEffectivePracticeRagDocId({ id: "practice-1" }), "effective-practice::practice-1");
});
