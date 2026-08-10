import assert from "node:assert/strict";
import test from "node:test";

import {
  filterRevokedServiceProfileMatches,
  ragMatchDocId,
  serviceProfileIdFromDocId,
  serviceProfileRagDocId
} from "../../lib/privacy/serviceProfileRetrievalGuard.js";

/**
 * SOL-SPROF-02 — „fail-closed lõpetama retrieval'i KOHE".
 *
 * Kaugkoopia kustutamine on lõplik lahendus, aga ta on võrgutoiming. Need testid
 * katavad TEIST, kohalikku väravat: mida päring vastuseks annab siis, kui luba on
 * juba maas, aga koopia veel alles. Kustutusprotokoll ise on
 * `serviceProfileRagRemoval.test.js`-is.
 */

function dbWith(rows, { onQuery = null } = {}) {
  return {
    serviceProviderProfile: {
      findMany: async (args) => {
        onQuery?.(args);
        return rows;
      }
    }
  };
}

const docId = (id) => serviceProfileRagDocId(id);

test("doc-ID ehitaja ja lugeja on sama tõe kaks otsa", () => {
  assert.equal(docId("p1"), "service-provider-profile::p1");
  assert.equal(serviceProfileIdFromDocId(docId("p1")), "p1");
  assert.equal(docId(""), "", "ID-ta profiilil ei ole dokumenti");
  assert.equal(serviceProfileIdFromDocId("kov::harku"), "", "võõras allikas ei ole profiil");
});

test("doc-ID loetakse ka metadata seest — RAG tagastab teda kolmes kujus", () => {
  assert.equal(ragMatchDocId({ doc_id: "a" }), "a");
  assert.equal(ragMatchDocId({ docId: "b" }), "b");
  assert.equal(ragMatchDocId({ metadata: { doc_id: "c" } }), "c");
  assert.equal(ragMatchDocId(null), "");
});

test("tagasi võetud luba kaotab profiili vastustest KOHE", async () => {
  /* Andmebaas ei tagasta ridu, sest päring nõuab kehtivat luba — täpselt see
     seis, kus vana kood oleks profiili edasi soovitanud, sest kaugkoopia oli
     veel olemas. */
  const guarded = await filterRevokedServiceProfileMatches(
    [{ doc_id: docId("p1"), text: "kontaktid" }],
    { db: dbWith([]) }
  );
  assert.deepEqual(guarded, []);
});

test("kehtiva loaga profiil jääb alles — värav ei tohi olla vaikne kustutaja", async () => {
  const guarded = await filterRevokedServiceProfileMatches(
    [{ doc_id: docId("p1"), text: "kontaktid" }],
    { db: dbWith([{ id: "p1" }]) }
  );
  assert.equal(guarded.length, 1);
});

test("muud allikad ei puutu väravasse — teda ei küsita nende pärast", async () => {
  let queried = 0;
  const guarded = await filterRevokedServiceProfileMatches(
    [{ doc_id: "kov::harku" }, { metadata: { doc_id: "effective-practice::x::v1" } }],
    { db: dbWith([], { onQuery: () => { queried += 1; } }) }
  );
  assert.equal(guarded.length, 2);
  assert.equal(queried, 0, "profiilivasteta päring ei tohi andmebaasi koormata");
});

test("päring nõuab MÕLEMAT tingimust: avaldatud JA soovitusluba", async () => {
  let seen = null;
  await filterRevokedServiceProfileMatches([{ doc_id: docId("p1") }], {
    db: dbWith([{ id: "p1" }], { onQuery: (args) => { seen = args; } })
  });
  assert.equal(seen.where.status, "PUBLISHED");
  assert.equal(seen.where.assistantRecommendationAllowed, true);
  assert.deepEqual(seen.where.id, { in: ["p1"] });
});

/* SOL-SPROF-02 SÜDA: vale suunas eksides oleks värav dekoratsioon. */
test("andmebaasita värav EI LASE profiile läbi", async () => {
  const guarded = await filterRevokedServiceProfileMatches([{ doc_id: docId("p1") }], { db: null });
  assert.deepEqual(guarded, [], "kontrollimata luba ei ole luba");
});

test("kukkunud loakontroll EI LASE profiile läbi, muu jääb alles", async () => {
  const db = {
    serviceProviderProfile: {
      findMany: async () => {
        throw new Error("ühendus katkes");
      }
    }
  };
  const guarded = await filterRevokedServiceProfileMatches(
    [{ doc_id: docId("p1") }, { doc_id: "kov::harku" }],
    { db }
  );
  assert.equal(guarded.length, 1);
  assert.equal(guarded[0].doc_id, "kov::harku", "tõrge ei tohi tappa teiste allikate vastuseid");
});

test("mitu vastet sama profiili kohta kaovad koos", async () => {
  const guarded = await filterRevokedServiceProfileMatches(
    [
      { doc_id: docId("p1"), metadata: { chunk_id: "1" } },
      { metadata: { doc_id: docId("p1"), chunk_id: "2" } },
      { doc_id: docId("p2") }
    ],
    { db: dbWith([{ id: "p2" }]) }
  );
  assert.equal(guarded.length, 1);
  assert.equal(guarded[0].doc_id, docId("p2"));
});

test("tühi vastete hulk ei tekita päringut ega viga", async () => {
  assert.deepEqual(await filterRevokedServiceProfileMatches([], { db: null }), []);
  assert.deepEqual(await filterRevokedServiceProfileMatches(null, { db: null }), []);
});
