import test from "node:test";
import assert from "node:assert/strict";

import { LICENCE_PUBLIC_STATUS } from "../../lib/mtr/assessment.js";
import { CHECK_SKIPPED, CHECK_TRIGGER, licenceStatusesForProfile, runLicenceCheck } from "../../lib/mtr/licenceCheckService.js";
import { LICENCE_COVERAGE } from "../../lib/mtr/licensedServices.js";

const NOW = new Date("2026-08-05T12:00:00.000Z");
const FRESH = "2026-08-05T09:00:00.000Z";

function fakePrisma({ profile, assessments = [], services = [], newestCheckId = undefined }) {
  const state = { checks: [], upserts: [], transactions: 0, lease: null };
  const tx = {
    licenceCheck: {
      findFirst: async () => (newestCheckId === undefined ? profile?.licenceChecks?.[0] || null : { id: newestCheckId }),
      create: async (args) => {
        state.checks.push(args);
        return { id: "check-new" };
      }
    },
    serviceLicenceAssessment: {
      upsert: async (args) => {
        state.upserts.push(args);
        return args.create;
      }
    }
  };
  return {
    state,
    $transaction: async (fn) => {
      state.transactions += 1;
      return fn(tx);
    },
    serviceProviderProfile: {
      findUnique: async () => profile,
      updateMany: async ({ where, data }) => {
        if (where.licenceCheckLeaseToken) {
          if (state.lease?.token !== where.licenceCheckLeaseToken) return { count: 0 };
          state.lease = null;
          return { count: 1 };
        }
        if (state.lease && state.lease.until > NOW) return { count: 0 };
        state.lease = { token: data.licenceCheckLeaseToken, until: data.licenceCheckLeaseUntil };
        return { count: 1 };
      }
    },
    serviceLicenceAssessment: { findMany: async () => assessments },
    serviceProviderService: { findMany: async () => services }
  };
}

function profileWith(services, overrides = {}) {
  return {
    id: "p1",
    registryCode: "17027241",
    organizationName: "Masaan OÜ",
    serviceItems: services,
    licenceChecks: [],
    ...overrides
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

function okLicences(licences = [licencePayload()], overrides = {}) {
  return async () => ({
    status: "OK",
    reason: null,
    registryCode: "17027241",
    checksumValid: true,
    licences,
    unknownColumns: [],
    missingOrderedColumns: [],
    attemptedAt: FRESH,
    checkedAt: FRESH,
    ...overrides
  });
}

const okEntity = async () => ({ status: "OK", reason: null, found: true, name: "Masaan OÜ" });

test("puuduv profiil ei tee midagi", async () => {
  const prisma = fakePrisma({ profile: null });
  const result = await runLicenceCheck({ providerProfileId: "x", prisma, now: NOW });
  assert.equal(result.skipped, CHECK_SKIPPED.PROFILE_NOT_FOUND);
  assert.equal(result.completed, false);
  assert.equal(prisma.state.checks.length, 0);
});

test("ilma registrikoodita ei tehta päringut ega kirjet, aga seis kirjutatakse", async () => {
  let queried = false;
  const prisma = fakePrisma({
    profile: profileWith([{ id: "s1", serviceKey: "TOETATUD_ELAMINE" }], { registryCode: null })
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
  assert.equal(result.succeeded, false);
  assert.equal(prisma.state.checks.length, 0);
  assert.equal(prisma.state.upserts[0].create.publicStatus, LICENCE_PUBLIC_STATUS.NOT_CHECKED);
});

test("käsitsi kontroll austab jahtumisaega ja ütleb, millal tohib uuesti", async () => {
  const prisma = fakePrisma({
    profile: profileWith([], { licenceChecks: [{ id: "c0", attemptedAt: new Date("2026-08-05T11:55:00.000Z"), result: "OK", consecutiveFailureCount: 0 }] })
  });

  const blocked = await runLicenceCheck({ providerProfileId: "p1", prisma, now: NOW, trigger: CHECK_TRIGGER.MANUAL });
  assert.equal(blocked.skipped, CHECK_SKIPPED.COOLDOWN);
  /* `retryAfter` on JÄRGMINE lubatud aeg, mitte eelmine katse. */
  assert.equal(blocked.retryAfter.toISOString(), "2026-08-05T12:10:00.000Z");

  const auto = await runLicenceCheck({
    providerProfileId: "p1",
    prisma,
    now: NOW,
    trigger: CHECK_TRIGGER.AUTO,
    fetchLicences: okLicences([]),
    resolveEntity: okEntity
  });
  assert.equal(auto.completed, true);
});

test("paralleelne käsitsi kontroll ei alusta teist MTR-i päringuahelat", async () => {
  const prisma = fakePrisma({ profile: profileWith([]) });
  let releaseFirst;
  const firstWaiting = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  let entityCalls = 0;
  const resolveEntity = async () => {
    entityCalls += 1;
    if (entityCalls === 1) await firstWaiting;
    return okEntity();
  };

  const first = runLicenceCheck({
    providerProfileId: "p1",
    prisma,
    now: NOW,
    trigger: CHECK_TRIGGER.MANUAL,
    fetchLicences: okLicences([]),
    resolveEntity
  });
  await new Promise((resolve) => setImmediate(resolve));
  const second = await runLicenceCheck({
    providerProfileId: "p1",
    prisma,
    now: NOW,
    trigger: CHECK_TRIGGER.MANUAL,
    fetchLicences: okLicences([]),
    resolveEntity
  });

  assert.equal(second.skipped, CHECK_SKIPPED.IN_PROGRESS);
  assert.equal(entityCalls, 1, "teine kontroll ei jõua välise registrini");
  releaseFirst();
  await first;
});

test("õnnestunud kontroll kirjutab kirje, load, kohad ja hinnangu ühe tehinguga", async () => {
  const prisma = fakePrisma({
    profile: profileWith([
      { id: "s1", serviceKey: "TOETATUD_ELAMINE" },
      { id: "s2", serviceKey: "TUGIISIK" },
      { id: "s3", serviceKey: null }
    ])
  });

  const result = await runLicenceCheck({
    providerProfileId: "p1",
    prisma,
    now: NOW,
    fetchLicences: okLicences(),
    resolveEntity: okEntity
  });

  assert.equal(result.completed, true);
  assert.equal(result.succeeded, true);
  assert.equal(result.result, "OK");
  assert.equal(result.nameMismatch, false);
  assert.equal(prisma.state.transactions, 1, "kirje ja kõik hinnangud ühes tehingus");

  const check = prisma.state.checks[0].data;
  assert.equal(check.result, "OK");
  assert.equal(check.licenceSourceResult, "OK");
  assert.equal(check.entitySourceResult, "OK");
  assert.equal(check.checksumValid, true);
  assert.equal(check.consecutiveFailureCount, 0);
  assert.equal(check.verifiedAt.toISOString(), FRESH);
  assert.equal(check.nextCheckAt.toISOString(), "2026-08-19T12:00:00.000Z", "edukas kontroll -> 14 paeva");
  const record = check.licences.create[0];
  assert.equal(record.activityType, "Toetatud elamise teenus");
  assert.equal(record.locations.create[0].address, "Riia 5, Tartu");

  const byService = new Map(prisma.state.upserts.map((row) => [row.where.providerServiceId, row.create]));
  assert.equal(byService.get("s1").publicStatus, LICENCE_PUBLIC_STATUS.VERIFIED);
  assert.equal(byService.get("s1").coverage, LICENCE_COVERAGE.EXACT_MATCH);
  assert.equal(byService.get("s1").statusSourceCheckId, "check-new");
  assert.equal(byService.get("s1").lastAttemptCheckId, "check-new");
  assert.ok(byService.get("s1").publicStatusValidUntil, "aegumine salvestub");
  assert.equal(byService.get("s1").coveringLicenceNumber, "SEH000598");

  /* 9. leid: seis, mis ei tulene kontrollist, EI seostu kontrolliga. */
  assert.equal(byService.get("s2").publicStatus, LICENCE_PUBLIC_STATUS.NO_SHS_LICENCE_REQUIRED);
  assert.equal(byService.get("s2").lastAttemptCheckId, null);
  assert.equal(byService.get("s3").publicStatus, LICENCE_PUBLIC_STATUS.SERVICE_MAPPING_REQUIRED);
  assert.equal(byService.get("s3").lastAttemptCheckId, null);
});

test("jäme vaste salvestub OMA seisuna", async () => {
  const prisma = fakePrisma({ profile: profileWith([{ id: "s1", serviceKey: "TOETATUD_ELAMINE" }]) });

  await runLicenceCheck({
    providerProfileId: "p1",
    prisma,
    now: NOW,
    fetchLicences: okLicences([licencePayload({ activityType: null })]),
    resolveEntity: okEntity
  });

  assert.equal(prisma.state.upserts[0].create.publicStatus, LICENCE_PUBLIC_STATUS.ACTIVITY_VERIFIED);
});

test("lahendamata identiteet: üldine result on UNCONFIRMED, kuigi load tulid", async () => {
  const prisma = fakePrisma({ profile: profileWith([{ id: "s1", serviceKey: "TOETATUD_ELAMINE" }]) });

  const result = await runLicenceCheck({
    providerProfileId: "p1",
    prisma,
    now: NOW,
    fetchLicences: okLicences(),
    resolveEntity: async () => ({ status: "UNCONFIRMED", reason: "RESULT_MISMATCH", found: false, name: null })
  });

  assert.equal(result.succeeded, false);
  const check = prisma.state.checks[0].data;
  assert.equal(check.result, "UNCONFIRMED", "üldine tulemus arvestab identiteeti");
  assert.equal(check.licenceSourceResult, "OK", "lubade päring ise õnnestus");
  assert.equal(check.entitySourceResult, "UNCONFIRMED");
  assert.equal(check.entityReason, "RESULT_MISMATCH");
  assert.equal(check.verifiedAt, null, "üldine kinnitusaeg tekib ainult täisedu korral");
  assert.ok(check.licenceSourceCheckedAt, "lubade vastuse aeg jääb siiski kirja");
  assert.equal(prisma.state.upserts[0].create.publicStatus, LICENCE_PUBLIC_STATUS.UNCONFIRMED);
});

test("korduskatsete astmestik kasvab, mitte ei jää esimesele astmele", async () => {
  const prisma = fakePrisma({
    profile: profileWith([{ id: "s1", serviceKey: "TOETATUD_ELAMINE" }], {
      licenceChecks: [{ id: "c0", attemptedAt: new Date("2026-08-05T06:00:00.000Z"), result: "UNCONFIRMED", consecutiveFailureCount: 1 }]
    })
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
  assert.equal(check.consecutiveFailureCount, 2, "teine järjestikune tõrge");
  /* Teine tõrge → 6 h, mitte uuesti 1 h. */
  assert.equal(check.nextCheckAt.toISOString(), "2026-08-05T18:00:00.000Z");
  assert.equal(check.checksumValid, null, "puuduv teadmine ei ole false");
});

test("vahepeal tekkinud uuem kontroll ei lase vana tulemust peale kirjutada", async () => {
  const prisma = fakePrisma({
    profile: profileWith([{ id: "s1", serviceKey: "TOETATUD_ELAMINE" }], {
      licenceChecks: [{ id: "c0", attemptedAt: new Date("2026-08-05T06:00:00.000Z"), result: "OK", consecutiveFailureCount: 0 }]
    }),
    newestCheckId: "c1"
  });

  const result = await runLicenceCheck({
    providerProfileId: "p1",
    prisma,
    now: NOW,
    fetchLicences: okLicences(),
    resolveEntity: okEntity
  });

  assert.equal(result.skipped, CHECK_SKIPPED.SUPERSEDED);
  assert.equal(prisma.state.checks.length, 0);
  assert.equal(prisma.state.upserts.length, 0);
});

test("varasem tõend kandub edasi: märgis püsib vana kontrolli najal", async () => {
  const prisma = fakePrisma({
    profile: profileWith([{ id: "s1", serviceKey: "TOETATUD_ELAMINE" }]),
    assessments: [
      {
        providerServiceId: "s1",
        publicStatus: LICENCE_PUBLIC_STATUS.VERIFIED,
        coverage: LICENCE_COVERAGE.EXACT_MATCH,
        confirmedMissCount: 0,
        publicStatusValidUntil: new Date("2026-08-08T09:00:00.000Z"),
        statusSourceCheckId: "check-old",
        coveringLicenceNumber: "SEH000598"
      }
    ]
  });

  await runLicenceCheck({ providerProfileId: "p1", prisma, now: NOW, fetchLicences: okLicences([]), resolveEntity: okEntity });

  const written = prisma.state.upserts[0].create;
  assert.equal(written.publicStatus, LICENCE_PUBLIC_STATUS.VERIFIED);
  assert.equal(written.confirmedMissCount, 1);
  assert.equal(written.statusSourceCheckId, "check-old", "tõend jääb vana kontrolli külge");
  assert.equal(written.lastAttemptCheckId, "check-new");
});

test("nimeanomaalia on admini signaal, mitte avalik seis", async () => {
  const prisma = fakePrisma({
    profile: profileWith([{ id: "s1", serviceKey: "TOETATUD_ELAMINE" }], { organizationName: "MTÜ Masaan" })
  });

  const result = await runLicenceCheck({
    providerProfileId: "p1",
    prisma,
    now: NOW,
    fetchLicences: okLicences(),
    resolveEntity: okEntity
  });

  assert.equal(result.nameMismatch, true);
  assert.equal(prisma.state.upserts[0].create.publicStatus, LICENCE_PUBLIC_STATUS.VERIFIED);
});

test("lugemisrada jõustab aegumise, mitte ei usu salvestatud seisu", async () => {
  const prisma = fakePrisma({
    profile: null,
    services: [
      {
        id: "s1",
        name: "Kehtiv",
        serviceKey: "TOETATUD_ELAMINE",
        licenceAssessment: {
          publicStatus: LICENCE_PUBLIC_STATUS.VERIFIED,
          coverage: LICENCE_COVERAGE.EXACT_MATCH,
          publicStatusValidUntil: new Date("2026-08-08T09:00:00.000Z"),
          statusSource: { verifiedAt: new Date(FRESH) }
        }
      },
      {
        id: "s2",
        name: "Aegunud",
        serviceKey: "TOETATUD_ELAMINE",
        licenceAssessment: {
          publicStatus: LICENCE_PUBLIC_STATUS.VERIFIED,
          coverage: LICENCE_COVERAGE.EXACT_MATCH,
          publicStatusValidUntil: new Date("2026-08-04T09:00:00.000Z"),
          statusSource: { verifiedAt: new Date("2026-08-01T09:00:00.000Z") }
        }
      },
      { id: "s3", name: "Sidumata", serviceKey: null, licenceAssessment: null }
    ]
  });

  const rows = await licenceStatusesForProfile({ providerProfileId: "p1", prisma, now: NOW });

  assert.equal(rows[0].publicStatus, LICENCE_PUBLIC_STATUS.VERIFIED);
  assert.equal(rows[0].publicClaimIsCurrent, true);
  assert.equal(rows[0].verifiedAt.toISOString(), FRESH);

  /* Salvestatud VERIFIED, mille aegumine on möödas, EI TOHI avalikult
     positiivsena paista — ka siis, kui korje pole veel jõudnud. */
  assert.equal(rows[1].publicStatus, LICENCE_PUBLIC_STATUS.UNCONFIRMED);
  assert.equal(rows[1].publicClaimIsCurrent, false);

  assert.equal(rows[2].publicStatus, null);
  assert.equal(rows[2].serviceKey, null);
});
