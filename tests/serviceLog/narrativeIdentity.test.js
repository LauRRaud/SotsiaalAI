import assert from "node:assert/strict";
import test from "node:test";
import { getNarrativeSeed, upsertNarrative } from "../../lib/serviceLog/narratives.js";

const ENV = { SERVICE_LOG_ENABLED: "1" };
const PROFILE = { id: "profile-1", ownershipMode: "SOLO" };

function makeDb() {
  const narratives = [];
  let revisionTick = new Date("2026-08-13T00:00:00.000Z").getTime();
  const entries = [
    {
      clientDisplayName: "Mari",
      clientExternalRef: "external-a",
      date: new Date("2026-08-05T00:00:00.000Z"),
      unit: "HOUR",
      quantity: 1,
      activities: [],
      note: "A fakt",
      noteProvenance: "TOOTAJA_TAHELEPANEK",
      status: "FINAL"
    },
    {
      clientDisplayName: "Mari",
      clientExternalRef: "external-b",
      date: new Date("2026-08-06T00:00:00.000Z"),
      unit: "HOUR",
      quantity: 2,
      activities: [],
      note: "B fakt",
      noteProvenance: "TOOTAJA_TAHELEPANEK",
      status: "FINAL"
    }
  ];
  const matches = (row, where) =>
    (where.referralId === undefined || row.referralId === where.referralId) &&
    (where.clientUserId === undefined || row.clientUserId === where.clientUserId) &&
    (where.clientExternalRef === undefined || row.clientExternalRef === where.clientExternalRef) &&
    (where.periodYear === undefined || row.periodYear === where.periodYear) &&
    (where.periodMonth === undefined || row.periodMonth === where.periodMonth) &&
    row.providerProfileId === where.providerProfileId;

  return {
    narratives,
    serviceProviderProfile: { findFirst: async () => PROFILE },
    serviceReferral: { findFirst: async () => null },
    serviceEntry: {
      findMany: async ({ where }) =>
        entries.filter(
          (row) =>
            row.clientDisplayName === where.clientDisplayName &&
            row.clientExternalRef === where.clientExternalRef &&
            row.date >= where.date.gte &&
            row.date < where.date.lt
        )
    },
    serviceMonthlyNarrative: {
      createMany: async ({ data }) => {
        const [candidate] = data;
        if (narratives.some((row) => matches(row, candidate))) return { count: 0 };
        narratives.push({
          ...candidate,
          id: `narrative-${narratives.length + 1}`,
          createdAt: new Date(revisionTick),
          updatedAt: new Date(revisionTick)
        });
        return { count: 1 };
      },
      findFirst: async ({ where }) => narratives.find((row) => matches(row, where)) || null,
      updateMany: async ({ where, data }) => {
        const row = narratives.find(
          (item) =>
            item.id === where.id &&
            item.providerProfileId === where.providerProfileId &&
            item.updatedAt.getTime() === where.updatedAt.getTime()
        );
        if (!row) return { count: 0 };
        revisionTick += 1;
        Object.assign(row, data, { updatedAt: new Date(revisionTick) });
        return { count: 1 };
      }
    }
  };
}

test("sama nimega eri välisviited saavad kaks eri kuunarratiivi", async () => {
  const db = makeDb();
  const first = await upsertNarrative(
    "user-1",
    {
      clientDisplayName: "Mari",
      clientExternalRef: "external-a",
      periodYear: 2026,
      periodMonth: 8,
      bodyText: "A lugu"
    },
    { db, env: ENV }
  );
  const second = await upsertNarrative(
    "user-1",
    {
      clientDisplayName: "Mari",
      clientExternalRef: "external-b",
      periodYear: 2026,
      periodMonth: 8,
      bodyText: "B lugu"
    },
    { db, env: ENV }
  );

  assert.notEqual(first.id, second.id);
  assert.equal(db.narratives.length, 2);
  assert.deepEqual(
    db.narratives.map((row) => row.clientExternalRef).sort(),
    ["external-a", "external-b"]
  );
});

test("narratiivi seed filtreerib sama nime juures püsiva välisviite järgi", async () => {
  const db = makeDb();
  const seed = await getNarrativeSeed(
    "user-1",
    {
      clientDisplayName: "Mari",
      clientExternalRef: "external-b",
      periodYear: 2026,
      periodMonth: 8
    },
    { db, env: ENV }
  );

  assert.equal(seed.entryCount, 1);
  assert.equal(seed.totals[0].total, 2);
  assert.equal(seed.notes[0].note, "B fakt");
});

test("suunamiseta väliskliendi narratiiv ei sünni ainult nime põhjal", async () => {
  const error = await upsertNarrative(
    "user-1",
    {
      clientDisplayName: "Mari",
      periodYear: 2026,
      periodMonth: 8,
      bodyText: "Nimeta identiteet"
    },
    { db: makeDb(), env: ENV }
  ).catch((caught) => caught);
  assert.equal(error.status, 400);
  assert.equal(error.messageKey, "service_log.errors.external_client_ref_required");
});

test("SOL-SLOG-J-04: sama revision'i kaks muutjat annavad ühe võitja ja värske projektsiooniga 409", async () => {
  const db = makeDb();
  const created = await upsertNarrative(
    "user-1",
    {
      clientDisplayName: "Mari",
      clientExternalRef: "external-a",
      periodYear: 2026,
      periodMonth: 8,
      bodyText: "Algtekst"
    },
    { db, env: ENV }
  );

  const first = await upsertNarrative(
    "user-1",
    {
      clientDisplayName: "Mari",
      clientExternalRef: "external-a",
      periodYear: 2026,
      periodMonth: 8,
      bodyText: "Esimene muudatus",
      expectedUpdatedAt: created.updatedAt
    },
    { db, env: ENV }
  );
  const stale = await upsertNarrative(
    "user-1",
    {
      clientDisplayName: "Mari",
      clientExternalRef: "external-a",
      periodYear: 2026,
      periodMonth: 8,
      bodyText: "Vaikne ülekirjutus",
      expectedUpdatedAt: created.updatedAt
    },
    { db, env: ENV }
  ).catch((error) => error);

  assert.equal(first.bodyText, "Esimene muudatus");
  assert.equal(stale.status, 409);
  assert.equal(stale.messageKey, "service_log.errors.narrative_version_conflict");
  assert.equal(stale.details.narrative.bodyText, "Esimene muudatus");
  assert.equal(db.narratives[0].bodyText, "Esimene muudatus");
});

test("SOL-SLOG-J-04: create/create kaotaja ei muutu vaikseks update'iks", async () => {
  const db = makeDb();
  const input = {
    clientDisplayName: "Mari",
    clientExternalRef: "external-a",
    periodYear: 2026,
    periodMonth: 8
  };
  const results = await Promise.allSettled([
    upsertNarrative("user-1", { ...input, bodyText: "Looja A" }, { db, env: ENV }),
    upsertNarrative("user-1", { ...input, bodyText: "Looja B" }, { db, env: ENV })
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.equal(rejected.reason.status, 409);
  assert.equal(db.narratives.length, 1);
});
