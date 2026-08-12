import assert from "node:assert/strict";
import test from "node:test";
import { getNarrativeSeed, upsertNarrative } from "../../lib/serviceLog/narratives.js";

const ENV = { SERVICE_LOG_ENABLED: "1" };
const PROFILE = { id: "profile-1", ownershipMode: "SOLO" };

function makeDb() {
  const narratives = [];
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
          createdAt: new Date(),
          updatedAt: new Date()
        });
        return { count: 1 };
      },
      findFirst: async ({ where }) => narratives.find((row) => matches(row, where)) || null,
      update: async ({ where, data }) => {
        const row = narratives.find((item) => item.id === where.id);
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
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
