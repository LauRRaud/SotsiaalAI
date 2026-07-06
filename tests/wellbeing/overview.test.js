import assert from "node:assert/strict";
import test from "node:test";

import { buildWellbeingOverviewForUser } from "../../lib/wellbeing/overview.js";

function record(overrides = {}) {
  return {
    id: "rec",
    workflowType: "quick-check",
    computedSignal: { signalLevel: "green" },
    loadFactors: [],
    resourceFactors: [],
    riskMarkers: [],
    recommendedActions: [],
    createdAt: new Date("2026-05-25T10:00:00.000Z"),
    ...overrides
  };
}

test("overview returns insufficient data when no quick checks exist", async () => {
  const calls = [];
  const prisma = {
    wellbeingRecord: {
      findMany: async (args) => {
        calls.push(args);
        return [];
      }
    }
  };

  const overview = await buildWellbeingOverviewForUser("user_1", {}, { prisma });

  assert.equal(overview.periodSignal, "insufficient_data");
  assert.equal(overview.recordCount, 0);
  assert.equal(overview.quickCheckCount, 0);
  assert.deepEqual(overview.signalCounts, { green: 0, yellow: 0, red: 0 });
  assert.deepEqual(overview.recommendedWorkflowTypes, []);
  assert.equal(calls[0].where.workflowType, undefined);
});

test("overview supports week and month period presets", async () => {
  const calls = [];
  const prisma = {
    wellbeingRecord: {
      findMany: async (args) => {
        calls.push(args);
        return [record()];
      }
    }
  };

  const overview = await buildWellbeingOverviewForUser(
    "user_1",
    { period: "week" },
    { prisma, now: new Date("2026-05-26T12:00:00.000Z") }
  );

  assert.equal(overview.period.key, "week");
  assert.equal(overview.period.label, "Nädal");
  assert.equal(overview.period.dayCount, 7);
  assert.equal(calls[0].where.createdAt.gte.toISOString(), "2026-05-19T12:00:00.000Z");
  assert.equal(calls[0].where.createdAt.lt.toISOString(), "2026-05-26T12:00:00.000Z");
});

test("overview aggregates quick-check signals, recurring load factors and actions", async () => {
  const prisma = {
    wellbeingRecord: {
      findMany: async () => [
        record({
          id: "red",
          computedSignal: { signalLevel: "red" },
          loadFactors: ["documentation.high", "interruptions.high"],
          resourceFactors: ["recovery.low_or_none"],
          riskMarkers: ["risk.difficult_case"],
          recommendedActions: [{ workflowType: "hard-case" }, { workflowType: "recovery" }]
        }),
        record({
          id: "yellow",
          computedSignal: { signalLevel: "yellow" },
          loadFactors: ["documentation.high"],
          resourceFactors: ["support.unclear_or_missing"],
          riskMarkers: [],
          recommendedActions: [{ workflowType: "work-processes" }]
        }),
        record({
          id: "green",
          computedSignal: { signalLevel: "green" },
          loadFactors: [],
          resourceFactors: [],
          riskMarkers: [],
          recommendedActions: []
        })
      ]
    }
  };

  const overview = await buildWellbeingOverviewForUser("user_1", {}, { prisma });

  assert.equal(overview.periodSignal, "red");
  assert.equal(overview.quickCheckCount, 3);
  assert.deepEqual(overview.signalCounts, { green: 1, yellow: 1, red: 1 });
  assert.deepEqual(overview.topLoadFactors, [
    { key: "documentation.high", label: "Dokumenteerimise koormus on kõrge", count: 2 },
    { key: "interruptions.high", label: "Katkestuste tase on kõrge", count: 1 }
  ]);
  assert.deepEqual(overview.topResourceFactors, [
    { key: "recovery.low_or_none", label: "Taastumisvõimalus on vähene või puudub", count: 1 },
    { key: "support.unclear_or_missing", label: "Juhi või kolleegi tugi on ebaselge või puudub", count: 1 }
  ]);
  assert.deepEqual(overview.recommendedWorkflowTypes, ["hard-case", "recovery", "work-processes"]);
});

test("overview exposes separate work demand, resource and risk event sections", async () => {
  const prisma = {
    wellbeingRecord: {
      findMany: async () => [
        record({
          id: "demand",
          loadFactors: ["documentation.high", "interruptions.high"],
          resourceFactors: ["support.unclear_or_missing"],
          riskMarkers: ["risk.difficult_case"]
        }),
        record({
          id: "repeated-demand",
          loadFactors: ["documentation.high"],
          resourceFactors: ["recovery.low_or_none"],
          riskMarkers: ["risk.difficult_case"]
        })
      ]
    }
  };

  const overview = await buildWellbeingOverviewForUser("user_1", {}, { prisma });

  assert.deepEqual(overview.workDemands, [
    { key: "documentation.high", label: "Dokumenteerimise koormus on kõrge", count: 2, category: "work_demand" },
    { key: "interruptions.high", label: "Katkestuste tase on kõrge", count: 1, category: "work_demand" }
  ]);
  assert.deepEqual(overview.workResources, [
    { key: "recovery.low_or_none", label: "Taastumisvõimalus on vähene või puudub", count: 1, category: "work_resource" },
    { key: "support.unclear_or_missing", label: "Juhi või kolleegi tugi on ebaselge või puudub", count: 1, category: "work_resource" }
  ]);
  assert.deepEqual(overview.riskEvents, [
    { key: "risk.difficult_case", label: "Märgitud on raske juhtum", count: 2, category: "risk_event" }
  ]);
});

test("overview aggregates records across wellbeing workflows and builds a generalized manager memo", async () => {
  const prisma = {
    wellbeingRecord: {
      findMany: async () => [
        record({
          id: "quick",
          workflowType: "quick-check",
          computedSignal: { signalLevel: "yellow" },
          loadFactors: ["documentation.high"],
          resourceFactors: ["support.unclear_or_missing"],
          recommendedActions: [{ workflowType: "work-processes" }]
        }),
        record({
          id: "process",
          workflowType: "work-processes",
          computedSignal: { signalLevel: "needs_organizational_change" },
          loadFactors: ["processes.duplicate_entry", "processes.switching_load_high"],
          resourceFactors: ["processes.single_entry_needed"],
          riskMarkers: ["processes.high_value_loss"],
          recommendedActions: [{ workflowType: "role-boundaries" }]
        }),
        record({
          id: "starter",
          workflowType: "starter-support",
          computedSignal: { signalLevel: "needs_urgent_support_agreement" },
          loadFactors: ["starter_support.missing_support"],
          resourceFactors: ["starter_support.mentor_needed"],
          riskMarkers: ["starter_support.not_to_carry_alone"],
          recommendedActions: [{ workflowType: "covision" }]
        })
      ]
    }
  };

  const overview = await buildWellbeingOverviewForUser("user_1", {}, { prisma });

  assert.equal(overview.recordCount, 3);
  assert.equal(overview.quickCheckCount, 1);
  assert.equal(overview.periodSignal, "red");
  assert.deepEqual(overview.workflowCounts, [
    { workflowType: "quick-check", label: "Kiirkontroll", count: 1 },
    { workflowType: "starter-support", label: "Alustaja tugi", count: 1 },
    { workflowType: "work-processes", label: "Tööprotsessid", count: 1 }
  ]);
  assert.deepEqual(overview.riskMarkers, [
    { key: "processes.high_value_loss", label: "oluline töö jääb madala väärtusega tegevuste taha", count: 1 },
    { key: "starter_support.not_to_carry_alone", label: "olukorda ei peaks üksi kandma", count: 1 }
  ]);
  assert.match(overview.managerMemo.title, /Juhiga jagatav memo/);
  assert.match(overview.managerMemo.text, /Koondatud tööheaolu ülevaade/);
  assert.match(overview.managerMemo.text, /Töövoogude arv: 3/);
  assert.match(overview.managerMemo.text, /Perioodi signaal: punane/);
  assert.match(overview.managerMemo.text, /Korduvad koormustegurid/);
  assert.doesNotMatch(overview.managerMemo.text, /complex_family_case|same_data_multiple_places|needs_organizational_change/);
});
