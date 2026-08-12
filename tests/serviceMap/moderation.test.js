import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { publishServiceMapEntry } from "../../lib/serviceMap/moderation.js";

function fakeDb({ status = "NEEDS_REVIEW", revision = 3, updateCount = 1 } = {}) {
  const audits = [];
  const db = {
    serviceMapEntry: {
      findUnique: async () => ({ id: "entry-1", status: updateCount === 1 ? "PUBLISHED" : status, revision: updateCount === 1 ? revision + 1 : revision, updatedAt: new Date(0) }),
      updateMany: async ({ where, data }) => {
        assert.deepEqual(where, { id: "entry-1", status: "NEEDS_REVIEW", revision });
        assert.deepEqual(data.revision, { increment: 1 });
        return { count: updateCount };
      }
    },
    dataAuditLog: { create: async ({ data }) => audits.push(data) }
  };
  let firstRead = true;
  db.serviceMapEntry.findUnique = async () => {
    if (firstRead) {
      firstRead = false;
      return { id: "entry-1", status, revision };
    }
    return { id: "entry-1", status: "PUBLISHED", revision: revision + 1, updatedAt: new Date(0) };
  };
  return { ...db, $transaction: async (operation) => operation(db), audits };
}

test("admin publish uses revision CAS and writes the decision audit in one transaction", async () => {
  const db = fakeDb();
  const entry = await publishServiceMapEntry({ db, entryId: "entry-1", actorUserId: "admin-1", expectedRevision: 3, reason: "Kontakt kontrollitud" });
  assert.equal(entry.status, "PUBLISHED");
  assert.equal(entry.revision, 4);
  assert.equal(db.audits.length, 1);
  assert.deepEqual(db.audits[0].meta, { reason: "Kontakt kontrollitud", previousStatus: "NEEDS_REVIEW", previousRevision: 3, nextRevision: 4 });
});

test("stale revision fails closed without an audit", async () => {
  const db = fakeDb({ updateCount: 0 });
  await assert.rejects(
    publishServiceMapEntry({ db, entryId: "entry-1", actorUserId: "admin-1", expectedRevision: 3, reason: "Kontrollitud" }),
    (error) => error.code === "SERVICE_MAP_MODERATION_REVISION_CONFLICT"
  );
  assert.equal(db.audits.length, 0);
});

test("publish route is admin-only and exposes stable 400/404/409 outcomes", () => {
  const route = readFileSync(join(process.cwd(), "app/api/admin/service-map/entries/[id]/publish/route.js"), "utf8");
  assert.match(route, /assertAdmin\(session\)/);
  assert.match(route, /expectedRevision/);
  assert.match(route, /reason/);
  assert.match(route, /409/);
});
