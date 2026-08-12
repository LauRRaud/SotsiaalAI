import assert from "node:assert/strict";
import test from "node:test";

import { buildWellbeingAggregateDataset } from "../../lib/wellbeing/aggregate.js";
import { buildWellbeingPilotReport } from "../../lib/wellbeing/pilotReport.js";
import { readWellbeingRecordsPaged } from "../../lib/wellbeing/pagedRecords.js";

/**
 * Päris tabelit jäljendav fake: ta AUSTAB kursorit, `skip`-i ja järjestust.
 * Vana fake tagastas lihtsalt massiivi ja oleks iga lehekülgituse „läbinud" —
 * seepärast on see fake nii tehtud, et vale kursorikäsitlus annaks vale arvu.
 */
function tablePrisma(rows) {
  const sorted = [...rows].sort((a, b) => {
    const byTime = a.createdAt - b.createdAt;
    return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
  });
  let calls = 0;

  return {
    calls: () => calls,
    wellbeingRecord: {
      findMany: async ({ take, cursor, skip }) => {
        calls += 1;
        assert.ok(take > 0, "lehekülg peab olema piiratud");
        let start = 0;
        if (cursor?.id) {
          const index = sorted.findIndex((row) => row.id === cursor.id);
          assert.notEqual(index, -1, "kursor peab osutama olemasolevale reale");
          start = index + (Number(skip) || 0);
        }
        return sorted.slice(start, start + take);
      }
    }
  };
}

function record(index, overrides = {}) {
  return {
    id: `r${String(index).padStart(6, "0")}`,
    ownerUserId: `user_${index % 7}`,
    workflowType: "quick-check",
    computedSignal: { signalLevel: index === 0 ? "red" : "green" },
    loadFactors: [],
    resourceFactors: [],
    riskMarkers: [],
    createdAt: new Date(Date.UTC(2026, 0, 1) + index * 1000),
    ...overrides
  };
}

const TEN_THOUSAND_AND_ONE = Array.from({ length: 10001 }, (_, index) => record(index));

test("paging reads every row across pages without gaps or duplicates", async () => {
  const prisma = tablePrisma(TEN_THOUSAND_AND_ONE);
  const { records, truncated } = await readWellbeingRecordsPaged(prisma, {
    where: {},
    maxRecords: 50000,
    pageSize: 1000
  });

  assert.equal(records.length, 10001);
  assert.equal(truncated, false);
  assert.equal(new Set(records.map((row) => row.id)).size, 10001);
  assert.equal(records[0].id, "r000000");
  assert.equal(records.at(-1).id, "r010000");
  assert.ok(prisma.calls() >= 11, "üks päring ei saa 10 001 rida lugeda");
});

test("the same query returns the same rows in the same order twice", async () => {
  const prisma = tablePrisma(TEN_THOUSAND_AND_ONE);
  const first = await readWellbeingRecordsPaged(prisma, { where: {}, maxRecords: 5000, pageSize: 700 });
  const second = await readWellbeingRecordsPaged(prisma, { where: {}, maxRecords: 5000, pageSize: 250 });

  assert.deepEqual(first.records.map((row) => row.id), second.records.map((row) => row.id));
  assert.equal(first.truncated, true);
  assert.equal(second.truncated, true);
});

/* Sama millisekund on päris andmetes tavaline (topeltklikk, importimine).
   `createdAt` üksi ei ole totaalne järjestus ja rida võiks lehekülje piiril
   korduda või kaduda — `id` on see, mis selle ära hoiab. */
test("rows sharing a timestamp are still read exactly once", async () => {
  const sameMoment = new Date(Date.UTC(2026, 0, 1));
  const rows = Array.from({ length: 25 }, (_, index) => record(index, { createdAt: sameMoment }));
  const prisma = tablePrisma(rows);

  const { records } = await readWellbeingRecordsPaged(prisma, { where: {}, maxRecords: 100, pageSize: 10 });
  assert.equal(records.length, 25);
  assert.equal(new Set(records.map((row) => row.id)).size, 25);
});

/* Täpselt piiri peale jäänud valim ON täielik ja teda ei tohi valetada
   poolikuks — vastasel juhul kaotaks hoiatus tähenduse. */
test("a sample that exactly fills the limit is not called truncated", async () => {
  const prisma = tablePrisma(Array.from({ length: 300 }, (_, index) => record(index)));
  const { records, truncated } = await readWellbeingRecordsPaged(prisma, {
    where: {},
    maxRecords: 300,
    pageSize: 100
  });

  assert.equal(records.length, 300);
  assert.equal(truncated, false);
});

test("the aggregate says out loud when it did not see every record", async () => {
  const prisma = tablePrisma(TEN_THOUSAND_AND_ONE);
  const dataset = await buildWellbeingAggregateDataset({}, {
    prisma,
    env: { WELLBEING_MIN_GROUP_SIZE: "3" },
    maxRecords: 10000,
    pageSize: 1000
  });

  assert.equal(dataset.recordCount, 10000);
  assert.equal(dataset.truncated, true);
  assert.equal(dataset.truncationReason, "record_limit");
  assert.equal(dataset.recordLimit, 10000);

  /* Negatiivkontroll: sama andmestik piisava piiriga ei ole poolik — lipp
     mõõdab kärbet, mitte lihtsalt suurt hulka. */
  const complete = await buildWellbeingAggregateDataset({}, {
    prisma,
    env: { WELLBEING_MIN_GROUP_SIZE: "3" },
    maxRecords: 50000,
    pageSize: 1000
  });
  assert.equal(complete.recordCount, 10001);
  assert.equal(complete.truncated, false);
  assert.equal("truncationReason" in complete, false);
});

test("the pilot report carries the truncation into the decision text", () => {
  const truncatedReport = buildWellbeingPilotReport({
    sampleSize: 40,
    recordCount: 10000,
    minimumGroupSize: 3,
    truncated: true,
    metrics: []
  });
  assert.equal(truncatedReport.truncated, true);
  assert.match(truncatedReport.completenessNotice, /EI SISALDA kõiki/u);

  const wholeReport = buildWellbeingPilotReport({
    sampleSize: 40,
    recordCount: 120,
    minimumGroupSize: 3,
    metrics: []
  });
  assert.equal(wholeReport.truncated, false);
  assert.equal("completenessNotice" in wholeReport, false);
});
