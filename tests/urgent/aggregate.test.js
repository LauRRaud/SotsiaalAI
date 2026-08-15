import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildUrgentRequestAggregate, URGENT_MIN_GROUP_SIZE } from "../../lib/urgent/aggregate.js";
import { createModel } from "./fakePrisma.js";

function createPrisma(rows = []) {
  return { urgentRequest: createModel(rows, "req") };
}

/** n eristuvat inimest samas piirkonnas, kõik öösel. */
function people(count, { municipalityId = "muni_1", hour = 23, prefix = "p" } = {}) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}_req_${index}`,
    authorId: `${prefix}_person_${index}`,
    municipalityId,
    sentAt: new Date(Date.UTC(2026, 7, 5, hour, 0, 0))
  }));
}

test("lävi on 5 ja see on konstant", () => {
  assert.equal(URGENT_MIN_GROUP_SIZE, 5);
});

test("alla läve rühm ei tule välja", async () => {
  const prisma = createPrisma(people(4));
  const aggregate = await buildUrgentRequestAggregate({ db: prisma });
  assert.deepEqual(aggregate.regions, []);
  assert.equal(aggregate.totalPeople, null);
  assert.equal(aggregate.totalSuppressed, true);
});

test("läve saavutanud rühm tuleb välja", async () => {
  const prisma = createPrisma(people(5));
  const aggregate = await buildUrgentRequestAggregate({ db: prisma });
  assert.equal(aggregate.regions.length, 1);
  assert.equal(aggregate.regions[0].people, 5);
  assert.equal(aggregate.totalPeople, 5);
});

test("valim on ERISTUVAD INIMESED, mitte sündmused", async () => {
  // See on kogu faili mõte. Ühe inimese viis pöördumist EI OLE viis inimest ja
  // sündmusepõhine summutus ei ole k-anonüümsus.
  const sameHuman = Array.from({ length: 20 }, (_, index) => ({
    id: `req_${index}`,
    authorId: "person_1",
    municipalityId: "muni_1",
    sentAt: new Date(Date.UTC(2026, 7, 5, 23, 0, 0))
  }));
  const prisma = createPrisma(sameHuman);
  const aggregate = await buildUrgentRequestAggregate({ db: prisma });

  assert.deepEqual(aggregate.regions, []);
  assert.equal(aggregate.totalPeople, null);
});

test("läve saab ainult TÕSTA, mitte langetada", async () => {
  const prisma = createPrisma(people(5));

  const lowered = await buildUrgentRequestAggregate({ db: prisma, minimumGroupSize: 1 });
  assert.equal(lowered.minimumGroupSize, URGENT_MIN_GROUP_SIZE);
  assert.equal(lowered.regions.length, 1);

  for (const attempt of [0, -5, "1", null, 4.5]) {
    const result = await buildUrgentRequestAggregate({ db: prisma, minimumGroupSize: attempt });
    assert.equal(result.minimumGroupSize, URGENT_MIN_GROUP_SIZE, `${attempt} langetas läve`);
  }

  const raised = await buildUrgentRequestAggregate({ db: prisma, minimumGroupSize: 10 });
  assert.equal(raised.minimumGroupSize, 10);
  assert.deepEqual(raised.regions, []);
});

test("summutatud rühmade metaandmed ei reeda alla läve aktiivsust", async () => {
  const prisma = createPrisma([
    ...people(5, { municipalityId: "muni_big", prefix: "big" }),
    ...people(2, { municipalityId: "muni_small", prefix: "small" })
  ]);
  const aggregate = await buildUrgentRequestAggregate({ db: prisma });
  assert.equal(aggregate.regions.length, 1);
  assert.equal(aggregate.regions[0].key, "muni_big");
  assert.equal("suppressedGroups" in aggregate, false);
  assert.equal("scannedRows" in aggregate, false);
});

test("tühi ja alla läve valim on väljundis eristamatud", async () => {
  const empty = await buildUrgentRequestAggregate({ db: createPrisma() });
  const belowThreshold = await buildUrgentRequestAggregate({ db: createPrisma(people(4)) });

  assert.deepEqual(belowThreshold, empty);
});

test("koondi API ei anna kutsujale meelevaldseid ajapiire", async () => {
  const source = await readFile(
    new URL("../../app/api/admin/urgent-desks/aggregate/route.js", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(source, /searchParams\.get\(["'](?:from|to)["']\)/);
});

test("kellaaja ämbrid järgivad sama läve", async () => {
  const prisma = createPrisma([
    ...people(5, { hour: 23, prefix: "night" }),
    ...people(3, { hour: 12, prefix: "day" })
  ]);
  const aggregate = await buildUrgentRequestAggregate({ db: prisma });
  const buckets = Object.fromEntries(aggregate.hourBuckets.map((row) => [row.key, row.people]));
  assert.equal(buckets.night, 5);
  assert.equal(buckets.day, undefined);
});

test("autorita kirje ei kanna „eristuva inimese“ tähendust", async () => {
  const prisma = createPrisma([
    ...people(4),
    { id: "req_erased", authorId: null, municipalityId: "muni_1", sentAt: new Date("2026-08-05T23:00:00Z") }
  ]);
  const aggregate = await buildUrgentRequestAggregate({ db: prisma });
  assert.deepEqual(aggregate.regions, []);
});

test("koond ei loe sisu isegi mällu", async () => {
  const source = await readFile(new URL("../../lib/urgent/aggregate.js", import.meta.url), "utf8");
  // Kui `select` siia laieneb, on leke tehtud enne, kui midagi kuvatakse.
  const select = source.slice(source.indexOf("select: {"), source.indexOf("});", source.indexOf("select: {")));
  assert.doesNotMatch(select, /situationVerbatim|assistantStructured|contactName|contactPhone|declineReason/);
  assert.match(select, /authorId: true/);
  assert.match(select, /municipalityId: true/);
});

test("koondis ei ole ühtegi välja, mis lubaks rühma üksikuteks lahutada", async () => {
  const prisma = createPrisma(people(6));
  const aggregate = await buildUrgentRequestAggregate({ db: prisma });
  const json = JSON.stringify(aggregate);
  assert.doesNotMatch(json, /person_/);
  assert.doesNotMatch(json, /req_/);
});
