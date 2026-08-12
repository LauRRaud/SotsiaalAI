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
  /* Fikstuuri suuruse määrab SOL-WB-06 saba lahtrisummutus: iga lahter peab
     lävendi ületama, muidu läheb ta kinni ja see test hakkaks mõõtma summutust,
     mitte koondi kuju. Viis inimest signaali kohta, viis kõige väiksema töövoo
     ja iga teguri taga. */
  const prisma = {
    wellbeingRecord: {
      findMany: async () => Array.from({ length: 15 }, (unused, index) => {
        const band = index < 5 ? "red" : index < 10 ? "yellow" : "green";
        return record({
          id: `r${index + 1}`,
          ownerUserId: `user_${index + 1}`,
          workflowType: band === "red" ? "quick-check" : "work-processes",
          computedSignal: { signalLevel: band },
          loadFactors: band === "green"
            ? ["documentation.high", "interruptions.high"]
            : ["documentation.high"],
          resourceFactors: band === "green"
            ? ["processes.single_entry_needed"]
            : ["support.unclear_or_missing"],
          riskMarkers: band === "green" ? [] : ["risk.difficult_case"]
        });
      })
    }
  };

  const dataset = await buildWellbeingAggregateDataset(
    { roleGroup: "child_protection" },
    { prisma, env: { WELLBEING_MIN_GROUP_SIZE: "3" }, now: new Date("2026-05-26T12:00:00.000Z") }
  );

  assert.equal(dataset.sampleSize, 15);
  assert.equal(dataset.suppressed, false);
  /* Enesekontroll: kui fikstuur libiseb lävendist alla, kaob mõni võti allolevast
     loendist ja test läheks punaseks põhjusel, mida ta ei mõõda. See rida ütleb
     selle põhjuse kohe välja. */
  assert.equal(dataset.cellSuppression.withheldCellCount, 0);
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
  /* Viis punast viieteistkümnest. Nimetaja on arvestatud ühikute arv, mis on siin
     sama mis valim, sest iga inimene andis täpselt ühe kirje. */
  assert.equal(dataset.metrics.find((metric) => metric.metricKey === "signal.red.share")?.metricValue, 5 / 15);
  /* `documentation.high` on kõigil viieteistkümnel real. */
  assert.equal(dataset.metrics.find((metric) => metric.metricKey === "work_demand.documentation.high.count")?.metricValue, 15);
  assert.equal(dataset.metrics.every((metric) => metric.sampleSize === 15), true);
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
