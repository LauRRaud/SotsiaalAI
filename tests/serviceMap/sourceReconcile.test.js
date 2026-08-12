import test from "node:test";
import assert from "node:assert/strict";

import {
  reconcileCompleteServiceMapSource,
  SERVICE_MAP_SOURCE,
  withServiceMapSourceLock
} from "../../lib/serviceMap/sourceReconcile.js";

test("a complete generation hides only missing rows and writes one content-free audit", async () => {
  const rows = [
    { id: "a", sourceNamespace: SERVICE_MAP_SOURCE.RAG_SERVICE_PROVIDER, sourceGeneration: "old", status: "PUBLISHED", revision: 1 },
    { id: "b", sourceNamespace: SERVICE_MAP_SOURCE.RAG_SERVICE_PROVIDER, sourceGeneration: "new", status: "PUBLISHED", revision: 1 },
    { id: "foreign", sourceNamespace: SERVICE_MAP_SOURCE.KOV_FILE_CONTACT, sourceGeneration: "old", status: "PUBLISHED", revision: 1 }
  ];
  const audits = [];
  const db = {
    serviceMapEntry: {
      findMany: async ({ where }) => rows.filter((row) => row.sourceNamespace === where.sourceNamespace && row.sourceGeneration !== "new" && row.status !== "HIDDEN").map(({ id }) => ({ id })),
      updateMany: async ({ where, data }) => {
        const targets = rows.filter((row) => row.sourceNamespace === where.sourceNamespace && row.sourceGeneration !== "new" && row.status !== where.status.not);
        for (const row of targets) Object.assign(row, { status: data.status, tombstonedAt: data.tombstonedAt, revision: row.revision + 1 });
        return { count: targets.length };
      }
    },
    dataAuditLog: { create: async ({ data }) => audits.push(data) }
  };

  const hidden = await reconcileCompleteServiceMapSource({
    db,
    namespace: SERVICE_MAP_SOURCE.RAG_SERVICE_PROVIDER,
    generation: "new",
    now: new Date("2026-08-13T10:00:00.000Z")
  });

  assert.equal(hidden, 1);
  assert.equal(rows.find((row) => row.id === "a").status, "HIDDEN");
  assert.equal(rows.find((row) => row.id === "b").status, "PUBLISHED");
  assert.equal(rows.find((row) => row.id === "foreign").status, "PUBLISHED");
  assert.deepEqual(audits[0].meta, { generation: "new", hiddenCount: 1, hiddenEntryIds: ["a"], reason: "missing_from_complete_source" });
});

test("source lock is acquired inside the same transaction that runs the sync", async () => {
  const events = [];
  const tx = {
    $executeRawUnsafe: async (...args) => events.push(["lock", ...args])
  };
  const db = {
    $transaction: async (operation, options) => {
      events.push(["transaction", options]);
      return operation(tx);
    }
  };

  const result = await withServiceMapSourceLock(db, SERVICE_MAP_SOURCE.KOV_FILE_CONTACT, async (lockedDb) => {
    events.push(["operation", lockedDb === tx]);
    return "ok";
  });

  assert.equal(result, "ok");
  assert.equal(events[0][0], "transaction");
  assert.equal(events[1][0], "lock");
  assert.deepEqual(events[2], ["operation", true]);
});
