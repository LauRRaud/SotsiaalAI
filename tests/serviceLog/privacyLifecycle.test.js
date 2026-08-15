import test from "node:test";
import assert from "node:assert/strict";

import {
  collectServiceLogDataExport,
  eraseServiceLogUserReferences,
  purgeExpiredServiceLogData
} from "../../lib/serviceLog/privacyLifecycle.js";

test("SOL-SLOG-J-05: töötaja ja kliendi koopiad on eri skoopides ning kolmanda isiku identiteet on väljas", async () => {
  const now = new Date("2026-08-13T00:00:00.000Z");
  const professionalEntry = {
    id: "entry-professional",
    providerProfileId: "profile-1",
    ownerUserId: "worker-1",
    clientUserId: "client-1",
    clientDisplayName: "Kolmas Isik",
    clientExternalRef: "secret-ref",
    note: "Töötaja dokumenteeritud fakt",
    confirmedByClientAt: now,
    createdAt: now,
    corrections: [{ id: "correction-1", actorUserId: "worker-1", reason: "Täpsustus", createdAt: now }]
  };
  const clientEntry = {
    id: "entry-client",
    providerProfileId: "profile-2",
    ownerUserId: "other-worker",
    clientUserId: "worker-1",
    clientDisplayName: "Kliendi nimi ei kuulu koopiasse",
    clientExternalRef: "external-secret",
    locationStamps: [{ lat: 59.437, lng: 24.7536 }],
    note: "Minu teenuskirje",
    noteProvenance: "worker_fact_note",
    unit: "HOUR",
    quantity: 2,
    confirmedByClientAt: now,
    createdAt: now
  };
  const db = {
    serviceProviderProfile: { findMany: async () => [{ id: "profile-1" }] },
    serviceReferral: {
      findMany: async ({ where }) =>
        where.clientUserId ? [{ id: "client-referral", clientUserId: "worker-1", kovName: "KOV" }] :
          [{ id: "referral-1", providerProfileId: "profile-1", clientDisplayName: "Kolmas Isik", kovName: "KOV" }]
    },
    serviceEntry: {
      findMany: async ({ where }) => (where.clientUserId ? [clientEntry] : [professionalEntry])
    },
    serviceMonthlyNarrative: {
      findMany: async ({ where }) =>
        where.clientUserId ? [{ id: "client-narrative", clientUserId: "worker-1", bodyText: "Minu lugu" }] :
          [{ id: "narrative-1", clientDisplayName: "Kolmas Isik", bodyText: "Tööalane narratiiv" }]
    },
    serviceWorkRoute: { findMany: async () => [{ id: "route-1", workerUserId: "worker-1", createdAt: now }] },
    serviceVisit: {
      findMany: async () => [{ id: "visit-1", clientDisplayName: "Kolmas Isik", address: "Salajane aadress", status: "COMPLETED" }]
    },
    serviceReportShare: {
      findMany: async () => [
        { id: "share-sent", ownerUserId: "worker-1", storagePath: "secret/path", fileName: "report.pdf", sentAt: now },
        { id: "share-received", ownerUserId: "other", recipientMembershipId: "membership-1", fileName: "report.pdf", sentAt: now }
      ]
    },
    serviceLogTimeSample: { findMany: async () => [{ id: "sample-1", ownerUserId: "worker-1", seconds: 12, recordedAt: now }] }
  };

  const files = await collectServiceLogDataExport({ db, userId: "worker-1" });
  const professional = files[0].content.toString("utf8");
  const client = files[1].content.toString("utf8");

  assert.match(professional, /entry-professional/);
  assert.match(professional, /correction-1/);
  assert.match(professional, /"view":"sender"/);
  assert.match(professional, /"view":"recipient"/);
  assert.doesNotMatch(professional, /Kolmas Isik|secret-ref|Salajane aadress|secret\/path/);
  assert.match(client, /entry-client/);
  assert.match(client, /"unit":"HOUR"/);
  assert.match(client, /"quantity":2/);
  assert.match(client, /confirmedByClientAt/);
  assert.doesNotMatch(client, /entry-professional/);
  assert.doesNotMatch(client, /Kliendi nimi ei kuulu koopiasse|external-secret|59\.437|24\.7536/);
  assert.doesNotMatch(client, /Minu teenuskirje|worker_fact_note|Minu lugu|client-referral/);
});

test("SOL-SLOG-J-06: konto kustutus tombstone'ib kõik Teenuspäeviku rollid idempotentses tehingus", async () => {
  const calls = [];
  const model = (name) => ({
    updateMany: async ({ where, data }) => {
      calls.push({ name, where, data });
      return { count: 1 };
    }
  });
  const db = {
    serviceReferral: model("referral"),
    serviceEntry: model("entry"),
    serviceEntryCorrection: model("correction"),
    serviceMonthlyNarrative: model("narrative"),
    serviceWorkRoute: model("route"),
    serviceVisit: model("visit"),
    serviceLogTimeSample: model("sample"),
    serviceReportShare: model("share")
  };
  db.$transaction = async (work) => work(db);

  const result = await eraseServiceLogUserReferences("user-1", {
    db,
    now: new Date("2026-08-13T00:00:00.000Z")
  });

  assert.equal(result.erased, 11);
  assert.equal(calls.length, 11);
  assert.ok(calls.some((call) => call.name === "route" && call.data.workerUserId === null && call.data.workerErasedAt));
  assert.ok(calls.some((call) => call.name === "visit" && call.data.clientUserId === null && call.data.clientErasedAt));
  assert.ok(calls.some((call) => call.name === "correction" && call.data.actorUserId === null && call.data.actorErasedAt));
});

test("SOL-SLOG-J-07: sweep kustutab batch'ides sõltuvused kirje→narratiiv→külastus→teekond→suunamine", async () => {
  const order = [];
  const model = (name, rows = [{ id: `${name}-1` }]) => ({
    findMany: async () => rows,
    deleteMany: async () => {
      order.push(name);
      return { count: rows.length };
    }
  });
  const db = {
    serviceEntry: model("entry"),
    serviceMonthlyNarrative: model("narrative"),
    serviceVisit: model("visit"),
    serviceWorkRoute: model("route"),
    serviceReferral: model("referral"),
    serviceLogTimeSample: { deleteMany: async () => ({ count: 2 }) }
  };

  const counts = await purgeExpiredServiceLogData({
    db,
    now: new Date("2034-01-01T00:00:00.000Z"),
    batchSize: 1
  });

  assert.deepEqual(order, ["entry", "narrative", "visit", "route", "referral"]);
  assert.deepEqual(counts, { entries: 1, narratives: 1, visits: 1, routes: 1, referrals: 1, timeSamples: 2 });
});
