import assert from "node:assert/strict";
import test from "node:test";

import {
  __resetRagRequestClockForTests,
  searchRagQueries
} from "@/lib/chat/retrievalOrchestrator";
import { serviceProfileRagDocId } from "@/lib/privacy/serviceProfileRetrievalGuard";

/**
 * SOL-SPROF-02 — värav peab olema RETRIEVAL'I sees, mitte tema kõrval.
 *
 * `serviceProfileRetrievalGuard.test.js` mõõdab värava enda otsust. Siin
 * mõõdetakse juhtmestikku: kas `searchRagQueries` — ainus koht, kust RAG-vasted
 * vestlusesse välja lähevad — laseb tagasi võetud profiili mööda.
 */

const PROFILE_DOC = serviceProfileRagDocId("p1");

function fetchReturning(results) {
  return async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ results, retrievers_used: ["dense"] })
  });
}

const twoHits = [
  { id: "hit-profile", doc_id: PROFILE_DOC, text: "Osutaja kontaktid" },
  { id: "hit-kov", doc_id: "kov::harku", text: "KOV teenus" }
];

const dbAllowing = (ids) => ({
  serviceProviderProfile: { findMany: async () => ids.map((id) => ({ id })) }
});

test("tagasi võetud profiil ei jõua retrieval'ist välja", async () => {
  __resetRagRequestClockForTests();
  const matches = await searchRagQueries({
    queries: ["kes pakub tugiisikuteenust"],
    fetchImpl: fetchReturning(twoHits),
    timeoutMs: 3000,
    profileConsentDb: dbAllowing([])
  });
  assert.deepEqual(matches.map((m) => m.doc_id), ["kov::harku"]);
});

test("kehtiva loaga profiil jõuab retrieval'ist välja", async () => {
  __resetRagRequestClockForTests();
  const matches = await searchRagQueries({
    queries: ["kes pakub tugiisikuteenust"],
    fetchImpl: fetchReturning(twoHits),
    timeoutMs: 3000,
    profileConsentDb: dbAllowing(["p1"])
  });
  assert.deepEqual(matches.map((m) => m.doc_id).sort(), [PROFILE_DOC, "kov::harku"].sort());
});

/* Ilma andmebaasita ei ole vastust küsimusele „kas luba kehtib" — ja siis on
   ainus õige vastus „ei soovita". Muud allikad ei tohi seejuures kannatada. */
test("andmebaasita retrieval kukutab profiilid, ülejäänu jääb", async () => {
  __resetRagRequestClockForTests();
  const matches = await searchRagQueries({
    queries: ["kes pakub tugiisikuteenust"],
    fetchImpl: fetchReturning(twoHits),
    timeoutMs: 3000,
    profileConsentDb: null
  });
  assert.deepEqual(matches.map((m) => m.doc_id), ["kov::harku"]);
});

test("värava otsus kehtib ka mitme päringu liidetud tulemustele", async () => {
  __resetRagRequestClockForTests();
  const matches = await searchRagQueries({
    queries: ["esimene päring", "teine päring"],
    fetchImpl: fetchReturning(twoHits),
    timeoutMs: 3000,
    profileConsentDb: dbAllowing([])
  });
  assert.equal(matches.some((m) => m.doc_id === PROFILE_DOC), false);
  assert.equal(matches.length, 1, "dedupe ei tohi kadunud profiili tagasi tuua");
});
