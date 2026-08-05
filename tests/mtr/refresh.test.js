import test from "node:test";
import assert from "node:assert/strict";

import { LICENCE_PUBLIC_STATUS } from "../../lib/mtr/assessment.js";
import { dueProfiles, licenceCheckAlarms, refreshDueLicenceChecks } from "../../lib/mtr/refresh.js";

const NOW = new Date("2026-08-05T12:00:00.000Z");

function profile(id, nextCheckAt, name = `Osutaja ${id}`) {
  return { id, organizationName: name, licenceChecks: nextCheckAt === undefined ? [] : [{ nextCheckAt }] };
}

function fakePrisma({ profiles = [], checks = [], assessments = [] }) {
  return {
    serviceProviderProfile: { findMany: async () => profiles },
    licenceCheck: { findMany: async () => checks },
    serviceLicenceAssessment: { findMany: async () => assessments }
  };
}

test("küps on kontrollimata profiil ja see, mille tähtaeg on möödas", async () => {
  const prisma = fakePrisma({
    profiles: [
      profile("a", undefined),
      profile("b", new Date("2026-08-05T06:00:00.000Z")),
      profile("c", new Date("2026-08-06T06:00:00.000Z"))
    ]
  });

  const due = await dueProfiles({ prisma, now: NOW });

  assert.deepEqual(due.map((row) => row.id), ["a", "b"], "tuleviku tähtajaga profiili ei puututa");
});

test("korje käib profiilid ükshaaval ja üks tõrge ei katkesta teisi", async () => {
  const prisma = fakePrisma({ profiles: [profile("a"), profile("b"), profile("c")] });
  const order = [];
  let concurrent = 0;
  let maxConcurrent = 0;

  const summary = await refreshDueLicenceChecks({
    prisma,
    now: NOW,
    runCheck: async ({ providerProfileId }) => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((resolve) => setTimeout(resolve, 1));
      order.push(providerProfileId);
      concurrent -= 1;
      if (providerProfileId === "b") throw new Error("register ei vastanud");
      return { succeeded: providerProfileId === "a" };
    }
  });

  assert.deepEqual(order, ["a", "b", "c"], "järjestikku, mitte paralleelselt");
  assert.equal(maxConcurrent, 1, "korraga ainult üks päring võõra registri vastu");
  assert.equal(summary.due, 3);
  assert.equal(summary.checked, 2);
  assert.equal(summary.succeeded, 1);
  assert.equal(summary.failed, 2, "üks tõrge + üks ebaõnnestunud kontroll");
  assert.equal(summary.errors.length, 1);
});

test("alarmid toovad välja neli signaali, mis avaliku sildini ei jõua", async () => {
  const prisma = fakePrisma({
    checks: [
      {
        id: "c1",
        missingOrderedColumns: ["tegevusala liik"],
        unknownColumns: [],
        entityResolved: true,
        entitySourceResult: "OK",
        entityName: "Masaan OÜ",
        consecutiveFailureCount: 0,
        providerProfile: { organizationName: "Masaan OÜ" }
      },
      {
        id: "c2",
        missingOrderedColumns: [],
        unknownColumns: [],
        entityResolved: false,
        entitySourceResult: "OK",
        entityName: null,
        consecutiveFailureCount: 0,
        providerProfile: { organizationName: "Keegi" }
      },
      {
        id: "c3",
        missingOrderedColumns: [],
        unknownColumns: [],
        entityResolved: true,
        entitySourceResult: "OK",
        entityName: "Masaan OÜ",
        consecutiveFailureCount: 4,
        providerProfile: { organizationName: "MTÜ Masaan" }
      }
    ],
    assessments: [
      {
        providerServiceId: "s1",
        publicStatus: LICENCE_PUBLIC_STATUS.VERIFIED,
        publicStatusValidUntil: new Date("2026-08-04T09:00:00.000Z"),
        providerService: { name: "Aegunud", providerProfileId: "p1" }
      },
      {
        providerServiceId: "s2",
        publicStatus: LICENCE_PUBLIC_STATUS.VERIFIED,
        publicStatusValidUntil: new Date("2026-08-08T09:00:00.000Z"),
        providerService: { name: "Kehtiv", providerProfileId: "p1" }
      }
    ]
  });

  const alarms = await licenceCheckAlarms({ prisma, now: NOW });

  assert.deepEqual(alarms.schemaDrift.map((row) => row.id), ["c1"]);
  assert.deepEqual(alarms.identityUnresolved.map((row) => row.id), ["c2"]);
  assert.deepEqual(alarms.nameMismatch.map((row) => row.id), ["c3"], "profiilil MTÜ, registris OÜ");
  assert.deepEqual(alarms.repeatedFailures.map((row) => row.id), ["c3"]);
  assert.deepEqual(alarms.staleClaims.map((row) => row.providerServiceId), ["s1"], "aegunud märgis vajab pilku");
});
