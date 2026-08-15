import assert from "node:assert/strict";
import test from "node:test";

import {
  AGGREGATE_TIME_ZONE,
  buildUrgentRequestAggregate
} from "../../lib/urgent/aggregate.js";
import { createModel } from "./fakePrisma.js";

/**
 * SOL-URG-11 — koond luges 20 000 rida ja vaikis sellest, ning liigitas Eesti
 * öise pöördumise UTC kellaaja järgi.
 *
 * Kaks poolt, mõlemad mõõdetavad:
 *   1. KATE — üle 20 000 rea peavad kõik kokku saama, ja kui ülempiir siiski
 *      täitub, peab vastus seda ütlema.
 *   2. AJAVÖÖND — ämber tuleb Eesti seinakellast, mitte UTC-st ega masina
 *      vööndist. Testitakse suve- ja talveaja mõlemal pool.
 */

function createPrisma(rows = []) {
  return { urgentRequest: createModel(rows, "req") };
}

/** Read on `id` järgi järjestatavad — kursor on `id`. */
function rowsAt(count, { at, municipalityId = "muni_1", prefix = "p" } = {}) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}_req_${String(index).padStart(6, "0")}`,
    authorId: `${prefix}_person_${index}`,
    municipalityId,
    sentAt: at
  }));
}

test("üle 20 000 rea saavad kõik kokku, mitte esimesed 20 000", async () => {
  const total = 20_001;
  const prisma = createPrisma(rowsAt(total, { at: new Date(Date.UTC(2026, 0, 15, 12, 0, 0)) }));

  const aggregate = await buildUrgentRequestAggregate({ db: prisma });

  assert.equal(Object.hasOwn(aggregate, "scannedRows"), false, "toorreaarv murrab k-anonüümsuse");
  assert.equal(aggregate.totalPeople, total);
  assert.equal(aggregate.truncated, false);
  assert.equal(aggregate.regions[0].people, total);
});

test("ülempiiri täitumine on vastuses NÄHTAV, mitte vaikne", async () => {
  const prisma = createPrisma(rowsAt(20, { at: new Date(Date.UTC(2026, 0, 15, 12, 0, 0)) }));

  const aggregate = await buildUrgentRequestAggregate({ db: prisma, pageSize: 4, maxPages: 2 });

  assert.equal(aggregate.truncated, true, "kärpimine jäi vaikseks");
  // Kärbitud vastus on endiselt aus vastus: ta lihtsalt ütleb, et ei kata kõike.
  assert.equal(aggregate.totalPeople, 8);
});

test("lehekülgitamine ei kaota ega dubleeri ridu piiri peal", async () => {
  // Täpselt kaks täislehekülge: vana `page.length < pageSize` lõpetus peab
  // tegema veel ühe tühja päringu, mitte jätma teist lehekülge lugemata.
  const prisma = createPrisma(rowsAt(10, { at: new Date(Date.UTC(2026, 0, 15, 12, 0, 0)) }));
  const aggregate = await buildUrgentRequestAggregate({ db: prisma, pageSize: 5 });
  assert.equal(aggregate.totalPeople, 10);
  assert.equal(aggregate.truncated, false);
});

// --- Ajavöönd -----------------------------------------------------------------

const TIME_CASES = [
  // [silt, UTC-hetk, Eesti ämber, UTC-ämber mille vana kood andis]
  ["suveöö", Date.UTC(2026, 6, 15, 20, 30), "night", "evening"],
  ["suvehommik", Date.UTC(2026, 6, 15, 4, 30), "morning", "night"],
  ["talveöö", Date.UTC(2026, 0, 15, 20, 30), "night", "evening"],
  ["talvehommik", Date.UTC(2026, 0, 15, 4, 30), "morning", "night"]
];

for (const [label, utcMs, estonianBucket, utcBucket] of TIME_CASES) {
  test(`${label}: ämber tuleb Eesti seinakellast (${estonianBucket}), mitte UTC-st (${utcBucket})`, async () => {
    const prisma = createPrisma(rowsAt(5, { at: new Date(utcMs), prefix: label }));
    const aggregate = await buildUrgentRequestAggregate({ db: prisma });

    assert.equal(aggregate.hourBuckets.length, 1);
    assert.equal(aggregate.hourBuckets[0].key, estonianBucket);
    assert.notEqual(aggregate.hourBuckets[0].key, utcBucket);
  });
}

test("suve- ja talveaja piir eristuvad samal UTC kellaajal", async () => {
  /* 20:30Z on suvel 23:30 (öö) ja talvel 22:30 (samuti öö) — see EI erista.
     19:30Z eristab: suvel 22:30 = öö, talvel 21:30 = õhtu. Just selline paar
     jääks ühte ämbrisse, kui vöönd oleks fikseeritud nihe, mitte kalender. */
  const summer = createPrisma(rowsAt(5, { at: new Date(Date.UTC(2026, 6, 15, 19, 30)), prefix: "s" }));
  const winter = createPrisma(rowsAt(5, { at: new Date(Date.UTC(2026, 0, 15, 19, 30)), prefix: "w" }));

  assert.equal((await buildUrgentRequestAggregate({ db: summer })).hourBuckets[0].key, "night");
  assert.equal((await buildUrgentRequestAggregate({ db: winter })).hourBuckets[0].key, "evening");
});

test("vastus ütleb välja, MILLISE kella järgi ämbrid on", async () => {
  const prisma = createPrisma(rowsAt(5, { at: new Date(Date.UTC(2026, 0, 15, 12, 0)) }));
  const aggregate = await buildUrgentRequestAggregate({ db: prisma });
  assert.equal(aggregate.timeZone, "Europe/Tallinn");
  assert.equal(AGGREGATE_TIME_ZONE, "Europe/Tallinn");
});
