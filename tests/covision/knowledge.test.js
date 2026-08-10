import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEffectivePracticeRagDocId,
  buildEffectivePracticeRagText,
  buildCovisionKnowledgeQuery,
  filterCovisionKnowledgeConsent,
  normalizeCovisionKnowledgeResults
} from "../../lib/covisionKnowledge.js";
import { serviceProfileRagDocId } from "../../lib/privacy/serviceProfileRetrievalGuard.js";

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

/**
 * SOL-SPROF-02 — kovisiooni teadmusotsing on TEINE uks samasse RAG-indeksisse.
 * Vestlusakna värav üksi ei kaitse siin midagi.
 */
test("kovisiooni teadmus ei tagasta tagasi võetud loaga teenuseprofiili", async () => {
  const allowed = await filterCovisionKnowledgeConsent(
    [
      { id: "hit-profile", doc_id: serviceProfileRagDocId("p1"), chunk: "Osutaja kontaktid" },
      { id: "hit-practice", doc_id: "effective-practice::x::v1", chunk: "Praktikanäide" }
    ],
    { db: { serviceProviderProfile: { findMany: async () => [] } } }
  );
  assert.deepEqual(allowed.map((entry) => entry.id), ["hit-practice"]);
});

test("kovisiooni teadmus ei küsi luba ilma profiilivasteta ja jätab muu puutumata", async () => {
  const results = [{ id: "hit-practice", doc_id: "effective-practice::x::v1", chunk: "Praktikanäide" }];
  const allowed = await filterCovisionKnowledgeConsent(results, {
    db: {
      serviceProviderProfile: {
        findMany: async () => {
          throw new Error("seda ei tohi kutsuda");
        }
      }
    }
  });
  assert.deepEqual(allowed, results);
});

test("kovisiooni värav filtreerib ENNE top_k lõikamist", async () => {
  /* Kui filtreerida pärast normaliseerimist, võtaks keelatud vaste lubatud
     vastelt koha ära — kaheksa kohta, üheksas jääks ukse taha. */
  const raw = [
    { id: "hit-profile", doc_id: serviceProfileRagDocId("p1"), chunk: "Osutaja kontaktid" },
    ...Array.from({ length: 8 }, (_, index) => ({
      id: `hit-${index}`,
      doc_id: `effective-practice::x${index}::v1`,
      chunk: `Praktikanäide ${index}`
    }))
  ];
  const allowed = await filterCovisionKnowledgeConsent(raw, {
    db: { serviceProviderProfile: { findMany: async () => [] } }
  });
  const normalized = normalizeCovisionKnowledgeResults(allowed);
  assert.equal(normalized.length, 8, "kõik kaheksa lubatud vastet peavad mahtuma");
  assert.equal(normalized.some((entry) => entry.docId?.startsWith("service-provider-profile::")), false);
});

test("published effective practice rag text is structured as a reusable practice example", () => {
  const text = buildEffectivePracticeRagText({
    publicId: "practice-public-1",
    version: 2,
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
  assert.equal(
    buildEffectivePracticeRagDocId({ publicId: "practice-public-1", version: 2 }),
    "effective-practice::practice-public-1::v2"
  );
  assert.equal(buildEffectivePracticeRagDocId({ id: "internal-row-id" }), "");
});
