/**
 * TEENUSPÄEVIK — omaniku kontrolli leiud 02.08.
 *
 * Iga test siin vastab ÜHELE leiule ja kirjeldab selle tagajärge, mitte ainult
 * käitumist. Ilma nendeta ei ole parandustel midagi, mis neid paigal hoiaks.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createEntry, setManualConfirmation, updateEntry } from "../../lib/serviceLog/entries.js";
import {
  CLIENT_VIEW_LIMIT,
  confirmClientMonth,
  readClientMonth
} from "../../lib/serviceLog/clientView.js";
import { SAMPLE_KIND } from "../../lib/serviceLog/measurement.js";
import { readBaseline, recordSample } from "../../lib/serviceLog/timeSamples.js";

const ENV = { SERVICE_LOG_ENABLED: "1" };
const ENV_MEASURE = { SERVICE_LOG_ENABLED: "1", SERVICE_LOG_MEASUREMENT: "1" };
const ENV_CLIENT = { SERVICE_LOG_ENABLED: "1", SERVICE_LOG_CLIENT_VIEW: "1" };
const PROFILE = { id: "profile-1", ownershipMode: "SOLO" };

function completedVisit(overrides = {}) {
  return {
    id: "visit-1",
    providerProfileId: PROFILE.id,
    ownerUserId: "user-1",
    status: "COMPLETED",
    serviceEntryId: null,
    clientUserId: null,
    clientDisplayName: "Mari",
    clientExternalRef: null,
    referralId: null,
    serviceId: null,
    arrivedAt: new Date("2026-08-03T10:00:00.000Z"),
    completedAt: new Date("2026-08-03T11:00:00.000Z"),
    ...overrides
  };
}

function makeDb({ entries = [], samples = [], corrections = [], visits = null } = {}) {
  let seq = 0;
  const visitRows = visits || [completedVisit()];
  const db = {
    entries,
    samples,
    serviceProviderProfile: {
      findFirst: async ({ where }) =>
        where.ownerId === "user-1" && where.ownershipMode === "SOLO" ? PROFILE : null
    },
    serviceReferral: { findFirst: async () => null, findMany: async () => [] },
    serviceProviderService: { findFirst: async () => null },
    serviceVisit: {
      findFirst: async ({ where }) =>
        visitRows.find(
          (row) =>
            row.id === where.id &&
            row.providerProfileId === where.providerProfileId &&
            row.ownerUserId === where.ownerUserId
        ) || null
    },
    serviceEntryCorrection: {
      create: async ({ data }) => {
        const row = { ...data, id: `correction-${corrections.length + 1}`, createdAt: new Date() };
        corrections.push(row);
        return row;
      }
    },
    $transaction: async (work) =>
      typeof work === "function" ? work(db) : Promise.all(work),
    serviceLogTimeSample: {
      create: async ({ data }) => {
        samples.push({ ...data, recordedAt: new Date() });
        return data;
      },
      findMany: async () => samples.map((s) => ({ kind: s.kind, seconds: s.seconds })),
      deleteMany: async () => ({ count: 0 })
    },
    serviceEntry: {
      findFirst: async ({ where }) =>
        entries.find(
          (row) =>
            (where.id === undefined || row.id === where.id) &&
            (where.providerProfileId === undefined ||
              row.providerProfileId === where.providerProfileId) &&
            (where.clientRequestId === undefined ||
              row.clientRequestId === where.clientRequestId) &&
            (where.sourceFieldVisitId === undefined ||
              row.sourceFieldVisitId === where.sourceFieldVisitId)
        ) || null,
      findMany: async () => [],
      count: async () => entries.length,
      update: async ({ where, data }) => {
        const row = entries.find((item) => item.id === where.id);
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }) => {
        const row = entries.find(
          (item) =>
            item.id === where.id &&
            (where.providerProfileId === undefined || item.providerProfileId === where.providerProfileId) &&
            (where.status === undefined || item.status === where.status) &&
            (where.clientUserId === undefined || item.clientUserId === where.clientUserId) &&
            (where.updatedAt === undefined || item.updatedAt?.getTime() === where.updatedAt?.getTime())
        );
        if (!row) return { count: 0 };
        Object.assign(row, data, {
          updatedAt: new Date((row.updatedAt || new Date()).getTime() + 1)
        });
        return { count: 1 };
      },
      create: async ({ data }) => {
        /* Andmebaasi unikaalsused elavad SIIN, sest just neid me testime. */
        const clash = entries.find(
          (row) =>
            row.providerProfileId === data.providerProfileId &&
            ((data.clientRequestId && row.clientRequestId === data.clientRequestId) ||
              (data.sourceFieldVisitId && row.sourceFieldVisitId === data.sourceFieldVisitId))
        );
        if (clash) {
          const error = new Error("Unique constraint failed");
          error.code = "P2002";
          throw error;
        }
        seq += 1;
        const row = { ...data, id: `entry-${seq}`, createdAt: new Date(), updatedAt: new Date() };
        entries.push(row);
        return row;
      }
    }
  };
  return db;
}

function entryInput(overrides = {}) {
  return {
    clientDisplayName: "Mari",
    date: "2026-08-03",
    unit: "HOUR",
    quantity: "2",
    ...overrides
  };
}

/* LEID 2: `sourceFieldVisitId` tekkis eeltäites, aga ei jõudnud kunagi kirjele.
   Tagajärg: ühest külastusest sai teha piiramatu arvu teenuskirjeid ja miski ei
   näidanud, kust kirje tuli. */
test("lähtekülastus salvestub kirjele", async () => {
  const db = makeDb();
  const entry = await createEntry("user-1", entryInput({ sourceFieldVisitId: "visit-1" }), {
    db,
    env: ENV
  });
  assert.equal(entry.sourceFieldVisitId, "visit-1", "päritolu peab olema vastuses näha");
  assert.equal(db.entries[0].sourceFieldVisitId, "visit-1", "ja andmebaasis");
});

test("samast külastusest teist kirjet ei sünni", async () => {
  const db = makeDb();
  await createEntry("user-1", entryInput({ sourceFieldVisitId: "visit-1" }), { db, env: ENV });
  const error = await createEntry("user-1", entryInput({ sourceFieldVisitId: "visit-1" }), {
    db,
    env: ENV
  }).catch((e) => e);
  assert.equal(error.status, 409);
  assert.equal(error.messageKey, "service_log.errors.visit_already_used");
  assert.equal(db.entries.length, 1);
});

/* Kaks unikaalsust, kaks tähendust: kordussaatmine annab vana kirje tagasi,
   teine kirje samast külastusest on viga. Nad ei tohi segamini minna. */
test("kordussaatmine jääb kordussaatmiseks ka külastusega kirjel", async () => {
  const db = makeDb();
  const input = entryInput({ sourceFieldVisitId: "visit-1", clientRequestId: "req-1" });
  const first = await createEntry("user-1", input, { db, env: ENV });
  const second = await createEntry("user-1", input, { db, env: ENV });
  assert.equal(second.id, first.id, "sama võti = sama kirje, mitte viga");
  assert.equal(db.entries.length, 1);
});

test("võõras ja olematu lähtekülastus annavad mõlemad 404", async () => {
  for (const visits of [[], [completedVisit({ ownerUserId: "user-2" })]]) {
    const error = await createEntry(
      "user-1",
      entryInput({ sourceFieldVisitId: "visit-1" }),
      { db: makeDb({ visits }), env: ENV }
    ).catch((caught) => caught);
    assert.equal(error.status, 404);
  }
});

test("lõpetamata või juba kasutatud lähtekülastust ei saa päritoluks väita", async () => {
  const unfinished = await createEntry(
    "user-1",
    entryInput({ sourceFieldVisitId: "visit-1" }),
    { db: makeDb({ visits: [completedVisit({ status: "ARRIVED" })] }), env: ENV }
  ).catch((caught) => caught);
  assert.equal(unfinished.status, 409);
  assert.equal(unfinished.messageKey, "service_log.errors.visit_not_completed");

  const used = await createEntry(
    "user-1",
    entryInput({ sourceFieldVisitId: "visit-1" }),
    { db: makeDb({ visits: [completedVisit({ serviceEntryId: "entry-old" })] }), env: ENV }
  ).catch((caught) => caught);
  assert.equal(used.status, 409);
  assert.equal(used.messageKey, "service_log.errors.visit_already_used");
});

test("lähtekülastuse klient ja ajatemplid peavad kirje põhiandmetega sobima", async () => {
  for (const input of [
    entryInput({ sourceFieldVisitId: "visit-1", clientDisplayName: "Jüri" }),
    entryInput({ sourceFieldVisitId: "visit-1", date: "2026-08-04" }),
    entryInput({
      sourceFieldVisitId: "visit-1",
      arrivedAt: "2026-08-03T10:30:00.000Z",
      leftAt: "2026-08-03T11:00:00.000Z"
    })
  ]) {
    const error = await createEntry("user-1", input, {
      db: makeDb(),
      env: ENV
    }).catch((caught) => caught);
    assert.equal(error.status, 400);
    assert.equal(error.messageKey, "service_log.errors.source_visit_mismatch");
  }
});

/* LEID (P2): tavaline töökäik on „kinnita kirje → märgi paberil kinnitatuks".
   Põhjuse nõudmine tegi selle võimatuks: kasutaja oleks pidanud allkirja
   märkimist PÕHJENDAMA. */
test("lõplikul väliskliendi kirjel jätab paberkinnitus tegija ja vana väärtusega jälje", async () => {
  const updatedAt = new Date("2026-08-03T12:00:00.000Z");
  const corrections = [];
  const db = makeDb({
    corrections,
    entries: [
      {
        id: "entry-1",
        providerProfileId: PROFILE.id,
        ownerUserId: "user-1",
        status: "FINAL",
        date: new Date("2026-08-03"),
        unit: "HOUR",
        quantity: 2,
        clientDisplayName: "Mari",
        clientUserId: null,
        confirmedManually: false,
        updatedAt
      }
    ]
  });
  const updated = await setManualConfirmation("user-1", "entry-1", { confirmed: true,
    db,
    env: ENV
  });
  assert.equal(updated.confirmedManually, true);
  assert.equal(corrections.length, 1);
  assert.equal(corrections[0].actorUserId, "user-1");
  assert.deepEqual(corrections[0].previousValues, { confirmedManually: false });
});

/* Piir on kitsas: põhjuseta tohib muutuda AINULT kinnituse märge. Kogus on
   arvestatav fakt ja tema muutmine jääb RPS § 10 alla. */
test("muu välja muutmine nõuab endiselt põhjust", async () => {
  const updatedAt = new Date("2026-08-03T12:00:00.000Z");
  const db = makeDb({
    entries: [
      {
        id: "entry-1",
        providerProfileId: PROFILE.id,
        ownerUserId: "user-1",
        status: "FINAL",
        date: new Date("2026-08-03"),
        unit: "HOUR",
        quantity: 2,
        clientDisplayName: "Mari",
        confirmedManually: false,
        updatedAt
      }
    ]
  });
  const error = await updateEntry(
    "user-1",
    "entry-1",
    { quantity: "5", expectedUpdatedAt: updatedAt.toISOString() },
    { db, env: ENV }
  ).catch((e) => e);
  assert.equal(error.status, 400);
  assert.equal(error.messageKey, "service_log.errors.reason_required");
});

/* LEID 4: mõõtmine ehitati püsivaks tootefunktsiooniks. Omaniku täpsustus:
   ta on PILOODI vahend. Väljas lipuga ei tohi koguda midagi. */
test("mõõtmine on vaikimisi väljas ja ei kogu proove", async () => {
  const db = makeDb();
  const stored = await recordSample("user-1", { kind: SAMPLE_KIND.ENTRY_INPUT, seconds: 20 }, {
    db,
    env: ENV
  });
  assert.equal(stored, false);
  assert.equal(db.samples.length, 0, "proovi ei tohi tekkida");
});

test("piloodilipuga mõõtmine töötab", async () => {
  const db = makeDb();
  const stored = await recordSample("user-1", { kind: SAMPLE_KIND.ENTRY_INPUT, seconds: 20 }, {
    db,
    env: ENV_MEASURE
  });
  assert.equal(stored, true);
  assert.equal(db.samples.length, 1);
});

/* Väljas mõõtmine annab 404, mitte tühja baasjoone: pilooti mitte kuuluv
   kasutaja ei pea teadma, et selline vaade olemas on. */
test("väljas mõõtmine peidab ka baasjoone", async () => {
  const db = makeDb();
  const error = await readBaseline("user-1", {}, { db, env: ENV }).catch((e) => e);
  assert.equal(error.status, 404);
});

/* LEID: vaade näitas kuni 500 rida, aga kinnitus käis KÕIGI ridade peale —
   klient oleks kinnitanud midagi, mida ta ei näinud. Kinnitus on pöördumatu. */
test("kuud, mis vaatesse ei mahu, ei saa kinnitada", async () => {
  const db = makeDb();
  db.serviceEntry.findMany = async () => Array.from(
    { length: CLIENT_VIEW_LIMIT + 1 },
    (_, index) => ({
      id: `entry-${index}`,
      date: new Date("2026-08-01T00:00:00.000Z"),
      unit: "HOUR",
      quantity: 1,
      confirmedByClientAt: null,
      providerProfile: { organizationName: "OÜ Hooldus" }
    })
  );
  const error = await confirmClientMonth("client-1", { month: "2026-08", snapshotToken: "shown" }, {
    db,
    env: ENV_CLIENT
  }).catch((e) => e);
  assert.equal(error.status, 400);
  assert.equal(error.messageKey, "service_log.errors.client_month_too_large");
});

test("vaade ütleb ise, kui ridu on rohkem kui kuvatud", async () => {
  const db = makeDb();
  db.serviceEntry.findMany = async () => [
    {
      id: "e1",
      date: new Date("2026-08-03"),
      unit: "HOUR",
      quantity: 2,
      confirmedByClientAt: null,
      providerProfile: { organizationName: "OÜ Hooldus" }
    }
  ];
  db.serviceEntry.count = async () => 900;
  const report = await readClientMonth("client-1", { month: "2026-08" }, { db, env: ENV_CLIENT });
  assert.equal(report.totalCount, 900);
  assert.equal(report.truncated, true, "vaade peab tunnistama, et ta ei näita kõike");
});

/* STSENAARIUMIKONTROLL leidis: server võttis vastu asukohapunkti märke kohta,
   mida ei toimunudki. DoD 10 nõuab „üks punkt TEADLIKU SÜNDMUSE kohta" — punkt
   ilma oma templita ei ole seotud ühegi sündmusega. Ükski varasem test seda ei
   püüdnud, sest nad saatsid punkte ainult olemasolevate templitega. */
test("asukohapunkt ilma oma templita ei salvestu", async () => {
  const db = makeDb();
  const entry = await createEntry(
    "user-1",
    entryInput({
      arrivedAt: "2026-08-03T09:00:00.000Z",
      locationStamps: {
        arrivedAt: { lat: 58.38, lng: 26.72, acc: 11, at: "2026-08-03T09:00:05.000Z" },
        leftAt: { lat: 1, lng: 1 },
        returnedAt: { lat: 2, lng: 2 }
      }
    }),
    { db, env: { SERVICE_LOG_ENABLED: "1", SERVICE_LOG_LOCATION_STAMP: "1" } }
  );
  assert.deepEqual(entry.locationStampedAt, ["arrivedAt"], "ainult toimunud sündmus kannab punkti");
});
