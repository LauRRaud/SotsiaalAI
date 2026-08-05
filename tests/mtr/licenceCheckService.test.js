import test from "node:test";
import assert from "node:assert/strict";

import { LICENCE_PUBLIC_STATUS } from "../../lib/mtr/assessment.js";
import { CHECK_SKIPPED, CHECK_TRIGGER, licenceStatusesForProfile, runLicenceCheck } from "../../lib/mtr/licenceCheckService.js";
import { LICENCE_COVERAGE } from "../../lib/mtr/licensedServices.js";

const NOW = new Date("2026-08-05T12:00:00.000Z");
const FRESH = "2026-08-05T09:00:00.000Z";

function fakePrisma({ profile, assessments = [], services = [] }) {
  const state = { checks: [], upserts: [] };
  return {
    state,
    serviceProviderProfile: {
      findUnique: async () => profile
    },
    serviceLicenceAssessment: {
      findMany: async () => assessments,
      upsert: async (args) => {
        state.upserts.push(args);
        return args.create;
      }
    },
    licenceCheck: {
      create: async (args) => {
        state.checks.push(args);
        return { id: "check-1" };
      }
    },
    serviceProviderService: {
      findMany: async () => services
    }
  };
}

function licencePayload(overrides = {}) {
  return {
    number: "SEH000598",
    organizationName: "Masaan OÜ",
    registryCode: "17027241",
    activity: "Erihoolekandeteenus",
    activityType: "Toetatud elamise teenus",
    validFrom: "2025-10-13",
    validUntil: null,
    indefinite: true,
    valid: true,
    licensedMaxPersons: 60,
    note: null,
    locations: [{ address: "Riia 5, Tartu", licensedMaxPersons: 60 }],
    ...overrides
  };
}

function okLicences(licences = [licencePayload()]) {
  return async () => ({
    status: "OK",
    reason: null,
    registryCode: "17027241",
    checksumValid: true,
    licences,
    unknownColumns: [],
    missingOrderedColumns: [],
    attemptedAt: FRESH,
    checkedAt: FRESH
  });
}

const okEntity = async () => ({ status: "OK", reason: null, registryCode: "17027241", found: true, name: "Masaan OÜ" });

test("puuduv profiil ei tee midagi", async () => {
  const prisma = fakePrisma({ profile: null });
  const result = await runLicenceCheck({ providerProfileId: "x", prisma, now: NOW });
  assert.equal(result.skipped, CHECK_SKIPPED.PROFILE_NOT_FOUND);
  assert.equal(prisma.state.checks.length, 0);
});

test("ilma registrikoodita ei tehta päringut ega kirjet, aga seis kirjutatakse", async () => {
  let queried = false;
  const prisma = fakePrisma({
    profile: { id: "p1", registryCode: null, organizationName: "X", serviceItems: [{ id: "s1", serviceKey: "TOETATUD_ELAMINE" }], licenceChecks: [] }
  });

  const result = await runLicenceCheck({
    providerProfileId: "p1",
    prisma,
    now: NOW,
    fetchLicences: async () => {
      queried = true;
      return {};
    },
    resolveEntity: async () => ({})
  });

  assert.equal(queried, false, "koodita ei küsita registrist midagi");
  assert.equal(result.skipped, CHECK_SKIPPED.NO_REGISTRY_CODE);
  assert.equal(prisma.state.checks.length, 0, "kontrollikirjet ei teki");
  assert.equal(prisma.state.upserts[0].create.publicStatus, LICENCE_PUBLIC_STATUS.NOT_CHECKED);
});

test("käsitsi kontroll austab jahtumisaega", async () => {
  const prisma = fakePrisma({
    profile: {
      id: "p1",
      registryCode: "17027241",
      organizationName: "Masaan OÜ",
      serviceItems: [],
      licenceChecks: [{ attemptedAt: new Date("2026-08-05T11:55:00.000Z"), result: "OK" }]
    }
  });

  const blocked = await runLicenceCheck({ providerProfileId: "p1", prisma, now: NOW, trigger: CHECK_TRIGGER.MANUAL });
  assert.equal(blocked.skipped, CHECK_SKIPPED.COOLDOWN);

  /* Automaatkorje ei ole jahtumisaja taga — teda ajastab `nextCheckAt`. */
  const auto = await runLicenceCheck({
    providerProfileId: "p1",
    prisma,
    now: NOW,
    trigger: CHECK_TRIGGER.AUTO,
    fetchLicences: okLicences([]),
    resolveEntity: okEntity
  });
  assert.equal(auto.ok, true);
});

test("õnnestunud kontroll kirjutab kirje, load, kohad ja hinnangu", async () => {
  const prisma = fakePrisma({
    profile: {
      id: "p1",
      registryCode: "17027241",
      organizationName: "Masaan OÜ",
      serviceItems: [
        { id: "s1", serviceKey: "TOETATUD_ELAMINE" },
        { id: "s2", serviceKey: "TUGIISIK" },
        { id: "s3", serviceKey: null }
      ],
      licenceChecks: []
    }
  });

  const result = await runLicenceCheck({
    providerProfileId: "p1",
    prisma,
    now: NOW,
    fetchLicences: okLicences(),
    resolveEntity: okEntity
  });

  assert.equal(result.ok, true);
  assert.equal(result.entityResolved, true);
  assert.equal(result.nameMismatch, false);

  const check = prisma.state.checks[0].data;
  assert.equal(check.result, "OK");
  assert.equal(check.registryCode, "17027241");
  assert.equal(check.entityResolved, true);
  assert.equal(check.nextCheckAt.toISOString(), "2026-08-06T12:00:00.000Z");
  const record = check.licences.create[0];
  assert.equal(record.licenceNumber, "SEH000598");
  assert.equal(record.activityType, "Toetatud elamise teenus");
  assert.equal(record.validFrom.toISOString(), "2025-10-13T00:00:00.000Z");
  assert.equal(record.locations.create[0].address, "Riia 5, Tartu");

  const byService = new Map(prisma.state.upserts.map((row) => [row.where.providerServiceId, row.create]));
  assert.equal(byService.get("s1").publicStatus, LICENCE_PUBLIC_STATUS.VERIFIED);
  assert.equal(byService.get("s1").coverage, LICENCE_COVERAGE.EXACT_MATCH);
  assert.equal(byService.get("s1").checkId, "check-1");
  assert.equal(byService.get("s2").publicStatus, LICENCE_PUBLIC_STATUS.NO_SHS_LICENCE_REQUIRED);
  assert.equal(byService.get("s3").publicStatus, LICENCE_PUBLIC_STATUS.SERVICE_MAPPING_REQUIRED);
  assert.equal(byService.get("s3").serviceKey, "", "sidumata teenusel ei ole võtit");
});

test("lahendamata identiteet ei anna avalikku väidet, kuigi load tulid", async () => {
  const prisma = fakePrisma({
    profile: {
      id: "p1",
      registryCode: "17027241",
      organizationName: "Masaan OÜ",
      serviceItems: [{ id: "s1", serviceKey: "TOETATUD_ELAMINE" }],
      licenceChecks: []
    }
  });

  const result = await runLicenceCheck({
    providerProfileId: "p1",
    prisma,
    now: NOW,
    fetchLicences: okLicences(),
    resolveEntity: async () => ({ status: "UNCONFIRMED", reason: "RESULT_MISMATCH", found: false, name: null })
  });

  assert.equal(result.entityResolved, false);
  assert.equal(prisma.state.checks[0].data.entityResolved, false);
  assert.equal(prisma.state.checks[0].data.reason, "RESULT_MISMATCH");
  assert.equal(prisma.state.upserts[0].create.publicStatus, LICENCE_PUBLIC_STATUS.UNCONFIRMED);
});

test("ebaõnnestunud päring salvestub kontrollina, mitte vaikusena", async () => {
  const prisma = fakePrisma({
    profile: {
      id: "p1",
      registryCode: "17027241",
      organizationName: "Masaan OÜ",
      serviceItems: [{ id: "s1", serviceKey: "TOETATUD_ELAMINE" }],
      licenceChecks: []
    }
  });

  await runLicenceCheck({
    providerProfileId: "p1",
    prisma,
    now: NOW,
    fetchLicences: async () => ({
      status: "UNCONFIRMED",
      reason: "TIMEOUT",
      licences: [],
      unknownColumns: [],
      missingOrderedColumns: [],
      attemptedAt: FRESH,
      checkedAt: null
    }),
    resolveEntity: okEntity
  });

  const check = prisma.state.checks[0].data;
  assert.equal(check.result, "UNCONFIRMED");
  assert.equal(check.reason, "TIMEOUT");
  assert.equal(check.verifiedAt, null, "tõlgendamata vastusel ei ole kinnitusaega");
  /* Tõrke korral järgmine katse tuleb tunni pärast, mitte ööpäeva pärast. */
  assert.equal(check.nextCheckAt.toISOString(), "2026-08-05T18:00:00.000Z");
  assert.equal(prisma.state.upserts[0].create.publicStatus, LICENCE_PUBLIC_STATUS.UNCONFIRMED);
});

test("varasem hinnang kandub edasi: kadunud luba ei kustuta märgist kohe", async () => {
  const prisma = fakePrisma({
    profile: {
      id: "p1",
      registryCode: "17027241",
      organizationName: "Masaan OÜ",
      serviceItems: [{ id: "s1", serviceKey: "TOETATUD_ELAMINE" }],
      licenceChecks: []
    },
    assessments: [
      { providerServiceId: "s1", publicStatus: LICENCE_PUBLIC_STATUS.VERIFIED, coverage: LICENCE_COVERAGE.EXACT_MATCH, consecutiveMissCount: 0 }
    ]
  });

  await runLicenceCheck({ providerProfileId: "p1", prisma, now: NOW, fetchLicences: okLicences([]), resolveEntity: okEntity });

  const written = prisma.state.upserts[0].create;
  assert.equal(written.publicStatus, LICENCE_PUBLIC_STATUS.VERIFIED);
  assert.equal(written.consecutiveMissCount, 1);
});

test("nimeanomaalia on admini signaal, mitte avalik seis", async () => {
  const prisma = fakePrisma({
    profile: {
      id: "p1",
      registryCode: "17027241",
      organizationName: "MTÜ Masaan",
      serviceItems: [{ id: "s1", serviceKey: "TOETATUD_ELAMINE" }],
      licenceChecks: []
    }
  });

  const result = await runLicenceCheck({
    providerProfileId: "p1",
    prisma,
    now: NOW,
    fetchLicences: okLicences(),
    resolveEntity: okEntity
  });

  assert.equal(result.nameMismatch, true, "profiilil MTÜ, registris OÜ");
  assert.equal(prisma.state.upserts[0].create.publicStatus, LICENCE_PUBLIC_STATUS.VERIFIED, "nimi ei muuda avalikku seisu");
});

test("lugemisrada annab teenuse kaupa seisu", async () => {
  const prisma = fakePrisma({
    profile: null,
    services: [
      {
        id: "s1",
        name: "Toetatud elamine",
        serviceKey: "TOETATUD_ELAMINE",
        licenceAssessment: { publicStatus: LICENCE_PUBLIC_STATUS.VERIFIED, coverage: LICENCE_COVERAGE.EXACT_MATCH }
      },
      { id: "s2", name: "Muu teenus", serviceKey: null, licenceAssessment: null }
    ]
  });

  const rows = await licenceStatusesForProfile({ providerProfileId: "p1", prisma });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].assessment.publicStatus, LICENCE_PUBLIC_STATUS.VERIFIED);
  assert.equal(rows[1].assessment, null);
  assert.equal(rows[1].serviceKey, null);
});
