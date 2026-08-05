import test from "node:test";
import assert from "node:assert/strict";

import { LICENCE_PUBLIC_STATUS } from "../../lib/mtr/assessment.js";
import { LICENCE_COVERAGE } from "../../lib/mtr/licensedServices.js";
import { LICENCE_SIGNAL_USAGE, licenceSignalFrom, licenceSignalsForServices } from "../../lib/mtr/licenceSignal.js";

const NOW = new Date("2026-08-05T12:00:00.000Z");

function assessment(overrides = {}) {
  return {
    providerServiceId: "s1",
    publicStatus: LICENCE_PUBLIC_STATUS.VERIFIED,
    coverage: LICENCE_COVERAGE.EXACT_MATCH,
    requirementAtAssessment: "REQUIRED",
    activityExpected: "Erihoolekandeteenus",
    publicStatusValidUntil: new Date("2026-08-08T09:00:00.000Z"),
    serviceKey: "TOETATUD_ELAMINE",
    statusSource: { verifiedAt: new Date("2026-08-05T09:00:00.000Z") },
    ...overrides
  };
}

test("signaal kannab kuut lubatud välja ja kasutusreeglit", () => {
  const signal = licenceSignalFrom(assessment(), { now: NOW });

  assert.equal(signal.licence_public_status, LICENCE_PUBLIC_STATUS.VERIFIED);
  assert.equal(signal.licence_requirement, "REQUIRED");
  assert.equal(signal.licence_coverage, LICENCE_COVERAGE.EXACT_MATCH);
  assert.equal(signal.licence_verified_at.toISOString(), "2026-08-05T09:00:00.000Z");
  assert.ok(signal.licence_claim_valid_until);
  assert.equal(signal.licence_activity, "Erihoolekandeteenus");
  assert.equal(signal.licence_usage, LICENCE_SIGNAL_USAGE.VERIFIED);
});

test("kontrolliajalugu ega veakoodid EI välju", () => {
  const signal = licenceSignalFrom(
    assessment({
      assessmentReason: "TIMEOUT",
      confirmedMissCount: 2,
      lastAttemptCheckId: "c9",
      statusSourceCheckId: "c8",
      coveringLicenceNumber: "SEH000598"
    }),
    { now: NOW }
  );

  const allowed = new Set([
    "licence_public_status",
    "licence_requirement",
    "licence_coverage",
    "licence_verified_at",
    "licence_claim_valid_until",
    "licence_activity",
    "licence_usage",
    "licence_other_verification"
  ]);
  for (const key of Object.keys(signal)) {
    assert.ok(allowed.has(key), `${key} ei tohi assistendini jõuda`);
  }
});

test("sidumata teenus ei anna signaali üldse", () => {
  assert.equal(licenceSignalFrom(assessment({ publicStatus: LICENCE_PUBLIC_STATUS.SERVICE_MAPPING_REQUIRED }), { now: NOW }), null);
  assert.equal(licenceSignalFrom(null, { now: NOW }), null);
});

test("aegunud positiivne väide ei jõua assistendini positiivsena", () => {
  const signal = licenceSignalFrom(
    assessment({ publicStatusValidUntil: new Date("2026-08-04T09:00:00.000Z") }),
    { now: NOW }
  );
  assert.equal(signal.licence_public_status, LICENCE_PUBLIC_STATUS.UNCONFIRMED);
  assert.equal(signal.licence_usage, LICENCE_SIGNAL_USAGE.UNKNOWN);
  assert.equal(signal.licence_coverage, null, "aegunud väitel ei ole kaetust");
  assert.equal(signal.licence_verified_at, null, "aegunud väitel ei ole kontrolli kuupäeva");
});

test("iga seis kannab OMA kasutusreeglit", () => {
  const cases = [
    /* Positiivne seis vajab KEHTIVAT aegumist — muidu langeb ta ise
       „teadmata" peale, mis on omaette reegel ja eraldi testis. */
    [LICENCE_PUBLIC_STATUS.ACTIVITY_VERIFIED, LICENCE_SIGNAL_USAGE.ACTIVITY_VERIFIED, true],
    [LICENCE_PUBLIC_STATUS.NO_SHS_LICENCE_REQUIRED, LICENCE_SIGNAL_USAGE.NO_SHS_LICENCE_REQUIRED, false],
    [LICENCE_PUBLIC_STATUS.NOT_FOUND, LICENCE_SIGNAL_USAGE.NOT_FOUND, false],
    [LICENCE_PUBLIC_STATUS.UNCONFIRMED, LICENCE_SIGNAL_USAGE.UNKNOWN, false],
    [LICENCE_PUBLIC_STATUS.NOT_CHECKED, LICENCE_SIGNAL_USAGE.UNKNOWN, false]
  ];
  for (const [status, usage, keepValidity] of cases) {
    const signal = licenceSignalFrom(
      assessment({ publicStatus: status, ...(keepValidity ? {} : { publicStatusValidUntil: null }) }),
      { now: NOW }
    );
    assert.equal(signal.licence_usage, usage, status);
  }
});

test("hoolduspere erisus sailib katalogist", () => {
  const signal = licenceSignalFrom(
    assessment({
      publicStatus: LICENCE_PUBLIC_STATUS.NO_SHS_LICENCE_REQUIRED,
      serviceKey: "ASENDUSHOOLDUS_HOOLDUSPERES",
      publicStatusValidUntil: null
    }),
    { now: NOW }
  );
  assert.equal(signal.licence_other_verification, "SKA_SUITABILITY_AND_STAR");
});

test("värske seis loetakse teenuse ID järgi otse andmebaasist", async () => {
  const prisma = {
    serviceLicenceAssessment: {
      findMany: async ({ where }) => {
        assert.deepEqual(where.providerServiceId.in, ["s1", "s2"], "duplikaadid ja tühjad kaovad");
        return [
          assessment({ providerServiceId: "s1" }),
          assessment({ providerServiceId: "s2", publicStatus: LICENCE_PUBLIC_STATUS.SERVICE_MAPPING_REQUIRED })
        ];
      }
    }
  };

  const signals = await licenceSignalsForServices(["s1", "s2", "s1", null, ""], { prisma, now: NOW });

  assert.equal(signals.size, 1, "sidumata teenus ei jõua kaardile");
  assert.equal(signals.get("s1").licence_public_status, LICENCE_PUBLIC_STATUS.VERIFIED);
  assert.deepEqual(await licenceSignalsForServices([], { prisma, now: NOW }), new Map());
});
