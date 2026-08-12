import assert from "node:assert/strict";
import test from "node:test";

import {
  WELLBEING_MINIMUM_GROUP_SIZE_FLOOR,
  buildWellbeingAggregateDataset,
  resolveWellbeingMinimumGroupSize
} from "../../lib/wellbeing/aggregate.js";

function record(overrides = {}) {
  return {
    id: "record_1",
    ownerUserId: "user_1",
    workflowType: "quick-check",
    roleGroup: "child_protection",
    computedSignal: { signalLevel: "yellow" },
    loadFactors: ["documentation.high"],
    resourceFactors: ["support.unclear_or_missing"],
    riskMarkers: ["risk.difficult_case"],
    recommendedActions: [{ workflowType: "work-processes" }],
    standardizedFields: {
      generalizedDescription: "free text that must not be exported",
      clientName: "Sensitive Person"
    },
    createdAt: new Date("2026-05-26T10:00:00.000Z"),
    ...overrides
  };
}

/* Lävend on seotud EKSPORDITUD konstandiga, mitte kirjutatud numbriga: kui
   omanik otsustab hiljem 10 kasuks, ei tohi see test valeks minna asja pärast,
   mida ta ei mõõda. Mõõdetav omadus on „keskkond saab ainult tõsta". */
test("wellbeing aggregate has a minimum group size floor the environment cannot lower", () => {
  assert.equal(resolveWellbeingMinimumGroupSize({}), WELLBEING_MINIMUM_GROUP_SIZE_FLOOR);
  assert.equal(
    resolveWellbeingMinimumGroupSize({ env: { WELLBEING_MIN_GROUP_SIZE: "bad" } }),
    WELLBEING_MINIMUM_GROUP_SIZE_FLOOR
  );
  /* Tõstmine jääb võimalikuks. */
  const higher = WELLBEING_MINIMUM_GROUP_SIZE_FLOOR + 4;
  assert.equal(
    resolveWellbeingMinimumGroupSize({ env: { WELLBEING_MIN_GROUP_SIZE: String(higher) } }),
    higher
  );
  /* Vana lävend 3 ei ole enam seadistatav — just see on 12.08 otsuse sisu. */
  assert.equal(
    resolveWellbeingMinimumGroupSize({ env: { WELLBEING_MIN_GROUP_SIZE: "3" } }),
    WELLBEING_MINIMUM_GROUP_SIZE_FLOOR
  );
});

test("wellbeing aggregate suppresses detail categories below minimum distinct users", async () => {
  const prisma = {
    wellbeingRecord: {
      findMany: async () => [
        record({ id: "r1", ownerUserId: "user_1" }),
        record({ id: "r2", ownerUserId: "user_2", riskMarkers: ["risk.workplace_violence"] })
      ]
    }
  };

  const dataset = await buildWellbeingAggregateDataset(
    { roleGroup: "child_protection" },
    { prisma, env: { WELLBEING_MIN_GROUP_SIZE: "3" } }
  );

  assert.equal(dataset.minimumGroupSize, WELLBEING_MINIMUM_GROUP_SIZE_FLOOR);
  assert.equal(dataset.sampleSize, 2);
  assert.equal(dataset.suppressed, true);
  assert.deepEqual(dataset.metrics, []);
  assert.equal(JSON.stringify(dataset).includes("risk.difficult_case"), false);
  assert.equal(JSON.stringify(dataset).includes("risk.workplace_violence"), false);
});

test("wellbeing aggregate emits only anonymous counts and shares at sufficient group size", async () => {
  const prisma = {
    wellbeingRecord: {
      findMany: async () => [
        record({ id: "r1", ownerUserId: "user_1", computedSignal: { signalLevel: "red" } }),
        record({ id: "r2", ownerUserId: "user_2", computedSignal: { signalLevel: "yellow" } }),
        /* Kolm rohelist ühesugust rida, et valim ulatuks lävendini ja mõõdikute
           NIMEKIRI jääks samaks — muidu mõõdaks test lävendi muutust, mitte
           koondi kuju. */
        ...["user_3", "user_4", "user_5"].map((ownerUserId, index) => record({
          id: `r${index + 3}`,
          ownerUserId,
          workflowType: "work-processes",
          computedSignal: { signalLevel: "green" },
          loadFactors: ["documentation.high", "interruptions.high"],
          resourceFactors: ["processes.single_entry_needed"],
          riskMarkers: []
        }))
      ]
    }
  };

  const dataset = await buildWellbeingAggregateDataset(
    { roleGroup: "child_protection" },
    { prisma, env: { WELLBEING_MIN_GROUP_SIZE: "3" }, now: new Date("2026-05-26T12:00:00.000Z") }
  );

  assert.equal(dataset.sampleSize, 5);
  assert.equal(dataset.suppressed, false);
  assert.deepEqual(
    dataset.metrics.map((metric) => metric.metricKey),
    [
      "signal.green.count",
      "signal.green.share",
      "signal.red.count",
      "signal.red.share",
      "signal.yellow.count",
      "signal.yellow.share",
      "workflow.quick-check.count",
      "workflow.work-processes.count",
      "work_demand.documentation.high.count",
      "work_demand.interruptions.high.count",
      "work_resource.processes.single_entry_needed.count",
      "work_resource.support.unclear_or_missing.count",
      "risk_event.risk.difficult_case.count"
    ]
  );
  /* Üks punane viiest. Nimetaja on arvestatud ühikute arv, mis on siin sama mis
     valim, sest iga inimene andis täpselt ühe kirje. */
  assert.equal(dataset.metrics.find((metric) => metric.metricKey === "signal.red.share")?.metricValue, 1 / 5);
  /* `documentation.high` on kõigil viiel real. */
  assert.equal(dataset.metrics.find((metric) => metric.metricKey === "work_demand.documentation.high.count")?.metricValue, 5);
  assert.equal(dataset.metrics.every((metric) => metric.sampleSize === 5), true);
  assert.equal(dataset.metrics.every((metric) => metric.exportEligible === true), true);
});

test("wellbeing aggregate output does not contain identities or free-text fields", async () => {
  const prisma = {
    wellbeingRecord: {
      findMany: async () => [
        record({ id: "r1", ownerUserId: "user_1" }),
        record({ id: "r2", ownerUserId: "user_2" }),
        record({ id: "r3", ownerUserId: "user_3" })
      ]
    }
  };

  const dataset = await buildWellbeingAggregateDataset({}, { prisma });
  const serialized = JSON.stringify(dataset);

  assert.equal(serialized.includes("ownerUserId"), false);
  assert.equal(serialized.includes("user_1"), false);
  assert.equal(serialized.includes("standardizedFields"), false);
  assert.equal(serialized.includes("free text that must not be exported"), false);
  assert.equal(serialized.includes("Sensitive Person"), false);
});
