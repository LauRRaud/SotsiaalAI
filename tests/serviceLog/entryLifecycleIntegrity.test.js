import test from "node:test";
import assert from "node:assert/strict";

import {
  finalizeEntry,
  listEntryCorrections,
  setManualConfirmation,
  updateEntry,
  voidEntry
} from "../../lib/serviceLog/entries.js";

const ENV = { SERVICE_LOG_ENABLED: "1" };
const PROFILE = { id: "profile-1", ownershipMode: "SOLO" };
const REVISION = new Date("2026-08-12T10:00:00.000Z");

function copy(row) {
  return row ? { ...row } : null;
}

function makeEntry(overrides = {}) {
  return {
    id: "entry-1",
    providerProfileId: PROFILE.id,
    ownerUserId: "user-1",
    clientUserId: null,
    clientDisplayName: "Mari",
    clientExternalRef: "external-1",
    date: new Date("2026-08-12T00:00:00.000Z"),
    unit: "HOUR",
    quantity: 1,
    status: "DRAFT",
    confirmedManually: false,
    finalizedAt: null,
    recordedFiscalYear: null,
    voidedAt: null,
    voidReason: null,
    updatedAt: REVISION,
    createdAt: new Date("2026-08-12T09:00:00.000Z"),
    ...overrides
  };
}

function matches(row, where = {}) {
  return (
    (where.id === undefined || row.id === where.id) &&
    (where.providerProfileId === undefined || row.providerProfileId === where.providerProfileId) &&
    (where.status === undefined || row.status === where.status) &&
    (where.clientUserId === undefined || row.clientUserId === where.clientUserId) &&
    (where.updatedAt === undefined || row.updatedAt?.getTime() === where.updatedAt?.getTime())
  );
}

function makeDb(initialEntries) {
  const entries = initialEntries.map(copy);
  const corrections = [];
  let revisionTick = REVISION.getTime();
  const db = {
    entries,
    corrections,
    serviceProviderProfile: { findFirst: async () => PROFILE },
    serviceReferral: { findFirst: async () => null },
    serviceEntry: {
      findFirst: async ({ where }) => copy(entries.find((row) => matches(row, where)) || null),
      updateMany: async ({ where, data }) => {
        const row = entries.find((candidate) => matches(candidate, where));
        if (!row) return { count: 0 };
        revisionTick += 1;
        Object.assign(row, data, { updatedAt: new Date(revisionTick) });
        return { count: 1 };
      }
    },
    serviceEntryCorrection: {
      create: async ({ data }) => {
        const row = {
          ...data,
          id: `correction-${corrections.length + 1}`,
          createdAt: new Date()
        };
        corrections.push(row);
        return row;
      }
    },
    $transaction: async (work) => work(db)
  };
  return db;
}

function splitResults(results) {
  return {
    fulfilled: results.filter((result) => result.status === "fulfilled"),
    rejected: results.filter((result) => result.status === "rejected")
  };
}

test("SOL-SLOG-08: kaks finalize-kutset annavad ühe võitja ja ühe 409", async () => {
  const db = makeDb([makeEntry()]);
  const results = splitResults(
    await Promise.allSettled([
      finalizeEntry("user-1", "entry-1", { db, env: ENV }),
      finalizeEntry("user-1", "entry-1", { db, env: ENV })
    ])
  );

  assert.equal(results.fulfilled.length, 1);
  assert.equal(results.rejected.length, 1);
  assert.equal(results.rejected[0].reason.status, 409);
  assert.equal(db.entries[0].status, "FINAL");
  assert.equal(db.entries[0].voidedAt, null);
  assert.equal(db.entries[0].voidReason, null);
});

test("SOL-SLOG-08: finalize ja void ei saa tekitada segaväljadega lõppseisu", async () => {
  const db = makeDb([makeEntry()]);
  const results = splitResults(
    await Promise.allSettled([
      finalizeEntry("user-1", "entry-1", { db, env: ENV }),
      voidEntry("user-1", "entry-1", { reason: "Vale mustand", db, env: ENV })
    ])
  );

  assert.equal(results.fulfilled.length, 1);
  assert.equal(results.rejected.length, 1);
  assert.equal(results.rejected[0].reason.status, 409);
  const row = db.entries[0];
  if (row.status === "FINAL") {
    assert.ok(row.finalizedAt);
    assert.equal(row.voidedAt, null);
    assert.equal(row.voidReason, null);
  } else {
    assert.equal(row.status, "VOID");
    assert.equal(row.finalizedAt, null);
    assert.equal(row.recordedFiscalYear, null);
    assert.ok(row.voidedAt);
  }
});

test("SOL-SLOG-J-01: FINAL-kirje tühistamise põhjus jääb paranduste ajalukku", async () => {
  const db = makeDb([
    makeEntry({ status: "FINAL", finalizedAt: new Date("2026-08-12T09:30:00.000Z"), recordedFiscalYear: 2026 })
  ]);

  const row = await voidEntry("user-1", "entry-1", {
    reason: "Vale teenuse kuupäev",
    db,
    env: ENV
  });

  assert.equal(row.status, "VOID");
  assert.equal(db.corrections.length, 1);
  assert.equal(db.corrections[0].reason, "Vale teenuse kuupäev");
  assert.deepEqual(db.corrections[0].changedFields, ["status", "voidedAt", "voidReason"]);
  assert.equal(db.corrections[0].previousValues.status, "FINAL");
});

test("SOL-SLOG-J-01: paranduste ajalugu on omaniku piires ja võõras saab 404", async () => {
  const correction = {
    id: "correction-1",
    reason: "Täpsustus",
    changedFields: ["note"],
    previousValues: { note: null },
    createdAt: new Date("2026-08-12T11:00:00.000Z"),
    actorUserId: "user-1"
  };
  const db = {
    serviceProviderProfile: {
      findFirst: async ({ where }) => ({
        id: where.ownerId === "user-1" ? "profile-1" : "profile-2",
        ownershipMode: "SOLO"
      })
    },
    serviceEntry: {
      findFirst: async ({ where }) =>
        where.id === "entry-1" && where.providerProfileId === "profile-1" ? { id: "entry-1" } : null
    },
    serviceEntryCorrection: {
      findMany: async ({ where }) => (where.entryId === "entry-1" ? [correction] : [])
    }
  };

  const own = await listEntryCorrections("user-1", "entry-1", { db, env: ENV });
  const foreign = await listEntryCorrections("user-2", "entry-1", { db, env: ENV }).catch(
    (error) => error
  );

  assert.equal(own.length, 1);
  assert.equal(own[0].reason, "Täpsustus");
  assert.equal(foreign.status, 404);
});

test("SOL-SLOG-09: stale parandus saab 409 koos värske reaga ja ühe ausa correction'iga", async () => {
  const db = makeDb([
    makeEntry({ status: "FINAL", finalizedAt: new Date("2026-08-12T09:30:00.000Z"), recordedFiscalYear: 2026 })
  ]);
  const expectedUpdatedAt = REVISION.toISOString();

  const first = await updateEntry(
    "user-1",
    "entry-1",
    { note: "esimene", reason: "Täpsustus", expectedUpdatedAt },
    { db, env: ENV }
  );
  const stale = await updateEntry(
    "user-1",
    "entry-1",
    { quantity: 2, reason: "Teine parandus", expectedUpdatedAt },
    { db, env: ENV }
  ).catch((error) => error);

  assert.equal(first.note, "esimene");
  assert.equal(stale.status, 409);
  assert.equal(stale.messageKey, "service_log.errors.version_conflict");
  assert.equal(stale.details.entry.note, "esimene");
  assert.equal(db.corrections.length, 1);
  assert.equal(db.corrections[0].previousValues.note, null);
  assert.deepEqual(db.corrections[0].changedFields, ["note"]);
});

test("SOL-SLOG-10: platvormikliendile ei saa osutaja paberkinnitust märkida", async () => {
  const db = makeDb([
    makeEntry({
      status: "FINAL",
      clientUserId: "client-1",
      finalizedAt: new Date("2026-08-12T09:30:00.000Z"),
      recordedFiscalYear: 2026
    })
  ]);

  const error = await setManualConfirmation("user-1", "entry-1", {
    confirmed: true,
    db,
    env: ENV
  }).catch((caught) => caught);

  assert.equal(error.status, 409);
  assert.equal(error.messageKey, "service_log.errors.manual_confirmation_external_only");
  assert.equal(db.entries[0].confirmedManually, false);
  assert.equal(db.corrections.length, 0);
});

test("SOL-SLOG-10: märkimine ja eemaldamine jätavad kaks järjestikust auditikirjet", async () => {
  const db = makeDb([
    makeEntry({ status: "FINAL", finalizedAt: new Date("2026-08-12T09:30:00.000Z"), recordedFiscalYear: 2026 })
  ]);

  await setManualConfirmation("user-1", "entry-1", { confirmed: true, db, env: ENV });
  await setManualConfirmation("user-1", "entry-1", { confirmed: false, db, env: ENV });

  assert.equal(db.entries[0].confirmedManually, false);
  assert.equal(db.corrections.length, 2);
  assert.deepEqual(
    db.corrections.map((row) => row.previousValues.confirmedManually),
    [false, true]
  );
  assert.ok(db.corrections.every((row) => row.actorUserId === "user-1"));
});

test("SOL-SLOG-10: üld-PATCH ei ole paberkinnituse tagauks", async () => {
  const db = makeDb([
    makeEntry({ status: "FINAL", finalizedAt: new Date("2026-08-12T09:30:00.000Z"), recordedFiscalYear: 2026 })
  ]);

  const error = await updateEntry(
    "user-1",
    "entry-1",
    { confirmedManually: true, expectedUpdatedAt: REVISION.toISOString() },
    { db, env: ENV }
  ).catch((caught) => caught);

  assert.equal(error.status, 400);
  assert.equal(error.messageKey, "service_log.errors.manual_confirmation_lifecycle_only");
  assert.equal(db.entries[0].confirmedManually, false);
});

test("lõppenud suunamise mustandile ei saa PATCH-iga uut mahtu lisada", async () => {
  const db = makeDb([makeEntry({ referralId: "referral-1" })]);
  db.serviceReferral.findFirst = async () => ({
    id: "referral-1",
    clientUserId: null,
    clientDisplayName: "Mari",
    clientExternalRef: "external-1",
    serviceId: null,
    unit: "HOUR",
    status: "ENDED",
    periodStart: new Date("2026-08-01T00:00:00.000Z"),
    periodEnd: new Date("2026-08-31T00:00:00.000Z")
  });

  const error = await updateEntry(
    "user-1",
    "entry-1",
    { quantity: 5, expectedUpdatedAt: REVISION.toISOString() },
    { db, env: ENV }
  ).catch((caught) => caught);

  assert.equal(error.status, 409);
  assert.equal(error.messageKey, "service_log.errors.referral_not_active");
  assert.equal(db.entries[0].quantity, 1);
});

test("lõppenud suunamise kinnitatud kirjet saab põhjusega parandada", async () => {
  const db = makeDb([
    makeEntry({ referralId: "referral-1", status: "FINAL", finalizedAt: REVISION })
  ]);
  db.serviceReferral.findFirst = async () => ({
    id: "referral-1",
    clientUserId: null,
    clientDisplayName: "Mari",
    clientExternalRef: "external-1",
    serviceId: null,
    unit: "HOUR",
    status: "ENDED",
    periodStart: new Date("2026-08-01T00:00:00.000Z"),
    periodEnd: new Date("2026-08-31T00:00:00.000Z")
  });

  const entry = await updateEntry(
    "user-1",
    "entry-1",
    { quantity: 5, reason: "Lõpparve parandus", expectedUpdatedAt: REVISION.toISOString() },
    { db, env: ENV }
  );

  assert.equal(entry.quantity, 5);
  assert.equal(db.corrections.length, 1);
  assert.equal(db.corrections[0].reason, "Lõpparve parandus");
});
