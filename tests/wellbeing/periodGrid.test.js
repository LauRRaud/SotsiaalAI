import assert from "node:assert/strict";
import test from "node:test";

import {
  WELLBEING_MINIMUM_GROUP_SIZE_FLOOR,
  buildWellbeingAggregateDataset,
  resolveWellbeingMinimumGroupSize
} from "../../lib/wellbeing/aggregate.js";
import { resolveWellbeingPilotAggregateFilters } from "../../lib/wellbeing/pilotAccess.js";
import {
  assertNoFreeFormPeriod,
  currentWellbeingPeriodSelection,
  resolveWellbeingPeriod
} from "../../lib/wellbeing/periodGrid.js";

/* SOL-WB-06 kriteerium: „Negatiivne test peab proovima kattuvaid N ja N−1
   päringuid ning env-väärtust 1." */

test("the minimum group size has a floor in code that the environment cannot lower", () => {
  /* Põrand on seotud konstandiga, mitte kirjutatud numbriga: 12.08 tõsteti ta
     3-lt 5-le ja järgmine otsus (võimalik 10) ei tohi seda testi valeks teha
     asja pärast, mida ta ei mõõda. Mõõdetav omadus on „ei saa langetada". */
  for (const attempt of ["1", "0", "-5", "3", "bad"]) {
    assert.equal(
      resolveWellbeingMinimumGroupSize({ env: { WELLBEING_MIN_GROUP_SIZE: attempt } }),
      WELLBEING_MINIMUM_GROUP_SIZE_FLOOR,
      `${attempt} langetas privaatsuslävendit`
    );
  }
  /* Tõsta tohib. */
  const higher = WELLBEING_MINIMUM_GROUP_SIZE_FLOOR + 5;
  assert.equal(
    resolveWellbeingMinimumGroupSize({ env: { WELLBEING_MIN_GROUP_SIZE: String(higher) } }),
    higher
  );
});

test("a suppressed sample carries no counts at all, whatever the environment says", async () => {
  const prisma = {
    wellbeingRecord: {
      findMany: async () => [
        { ownerUserId: "u1", workflowType: "quick-check", computedSignal: { signalLevel: "red" }, loadFactors: [], resourceFactors: [], riskMarkers: ["risk.difficult_case"], id: "r1", createdAt: new Date() }
      ]
    }
  };

  const dataset = await buildWellbeingAggregateDataset({}, {
    prisma,
    env: { WELLBEING_MIN_GROUP_SIZE: "1" }
  });

  assert.equal(dataset.minimumGroupSize, WELLBEING_MINIMUM_GROUP_SIZE_FLOOR);
  assert.equal(dataset.suppressed, true);
  assert.deepEqual(dataset.metrics, []);
  assert.equal(JSON.stringify(dataset).includes("risk.difficult_case"), false);
});

/* Rünnaku eeldus oli VABALT NIHUTATAV piir. Kaks päringut, mille ajapiir erineb
   ühe inimese võrra, ei ole enam väljendatavad. */
test("free-form period boundaries are refused, not quietly rounded", () => {
  assert.throws(
    () => assertNoFreeFormPeriod({ periodStart: "2026-05-01", periodEnd: "2026-05-27" }),
    (error) => {
      assert.equal(error.message, "wellbeing.pilot.period_free_form_forbidden");
      assert.equal(error.status, 400);
      return true;
    }
  );
  assert.throws(() => assertNoFreeFormPeriod({ periodEnd: "2026-05-26" }), /period_free_form_forbidden/u);
  assert.doesNotThrow(() => assertNoFreeFormPeriod({ periodKind: "month", periodYear: 2026, periodIndex: 5 }));
});

test("the allowed grid snaps to Estonian calendar boundaries, not to server-local midnight", () => {
  const may = resolveWellbeingPeriod({ periodKind: "month", periodYear: 2026, periodIndex: 5 });
  /* Suvel on Eesti UTC+3, seega kuu algab UTC-s eelmise päeva kell 21. Kui see
     oleks UTC-kesköö, kaoks iga kuu esimese kolme tunni töö eelmisse kuusse. */
  assert.equal(may.periodStart.toISOString(), "2026-04-30T21:00:00.000Z");
  assert.equal(may.periodEnd.toISOString(), "2026-05-31T21:00:00.000Z");
  assert.equal(may.label, "2026-05");

  /* Talvel UTC+2 — ja kellakeeramise kuu ei ole 30×24 h. */
  const january = resolveWellbeingPeriod({ periodKind: "month", periodYear: 2026, periodIndex: 1 });
  assert.equal(january.periodStart.toISOString(), "2025-12-31T22:00:00.000Z");

  const q1 = resolveWellbeingPeriod({ periodKind: "quarter", periodYear: 2026, periodIndex: 1 });
  assert.equal(q1.periodStart.toISOString(), january.periodStart.toISOString());
  assert.equal(q1.periodEnd.toISOString(), "2026-03-31T21:00:00.000Z");

  const december = resolveWellbeingPeriod({ periodKind: "month", periodYear: 2026, periodIndex: 12 });
  assert.equal(december.periodEnd.toISOString(), "2026-12-31T22:00:00.000Z", "aastapiir läheb üle õigesti");

  const all = resolveWellbeingPeriod({});
  assert.equal(all.periodStart, null);
  assert.equal(all.periodEnd, null);
});

test("an out-of-grid selection is a 400, not a guess", () => {
  assert.throws(() => resolveWellbeingPeriod({ periodKind: "week", periodYear: 2026 }), /period_invalid/u);
  assert.throws(() => resolveWellbeingPeriod({ periodKind: "month", periodYear: 2026, periodIndex: 13 }), /period_invalid/u);
  assert.throws(() => resolveWellbeingPeriod({ periodKind: "quarter", periodYear: 2026, periodIndex: 5 }), /period_invalid/u);
  assert.throws(() => resolveWellbeingPeriod({ periodKind: "month", periodYear: 1900, periodIndex: 1 }), /period_invalid/u);
});

/* Kriteeriumi „kattuvad N ja N−1 päringud": vana rajaga oli see kaks kehtivat
   päringut, mille vahe on üks inimene. Nüüd on teine neist üldse keelatud. */
test("the differencing pair cannot be expressed through the pilot filters any more", () => {
  const access = {
    ok: true,
    isAdmin: false,
    allowedRoleGroups: ["SOCIAL_WORKER"],
    pilotScopes: []
  };

  const wholeMonth = resolveWellbeingPilotAggregateFilters(
    { periodKind: "month", periodYear: 2026, periodIndex: 5 },
    access
  );
  assert.equal(wholeMonth.periodLabel, "2026-05");

  /* N−1: sama kuu, aga lõpp ühe päeva võrra varem — vana rajal täiesti kehtiv. */
  assert.throws(
    () => resolveWellbeingPilotAggregateFilters(
      { periodStart: "2026-05-01", periodEnd: "2026-05-26" },
      access
    ),
    /period_free_form_forbidden/u
  );

  /* Ja segavariant, kus klient annab nii võrgu kui vaba piiri, ei tohi vaikselt
     ühe neist ära visata. */
  assert.throws(
    () => resolveWellbeingPilotAggregateFilters(
      { periodKind: "month", periodYear: 2026, periodIndex: 5, periodEnd: "2026-05-26" },
      access
    ),
    /period_free_form_forbidden/u
  );
});

test("the default selection is the current Estonian month", () => {
  const selection = currentWellbeingPeriodSelection(new Date("2026-01-01T00:30:00.000Z"));
  /* UTC 00:30 on Eestis juba 02:30 — ja jaanuar. Serverivööndis arvutades
     oleks vastus võinud olla detsember. */
  assert.deepEqual(selection, { periodKind: "month", periodYear: 2026, periodIndex: 1 });
});
