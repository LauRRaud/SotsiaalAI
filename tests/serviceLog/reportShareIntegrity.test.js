import test from "node:test";
import assert from "node:assert/strict";

import {
  purgeServiceReportShareFiles,
  recallShare,
  shareMonthlyReport
} from "../../lib/serviceLog/reportShare.js";

const NOW = new Date("2026-08-12T12:00:00.000Z");

function makeDb({ auditFails = false, duplicate = false } = {}) {
  let rows = [];
  let audits = [];
  const recipient = {
    id: "membership-lead",
    userId: "lead-user",
    organizationId: "org-1",
    jobTitle: "Lead",
    user: { id: "lead-user", email: "lead@example.test", profile: null }
  };
  const db = {
    get rows() { return rows; },
    get audits() { return audits; },
    userDocument: {
      findFirst: async () => ({
        id: "doc-1",
        originalName: "report.csv",
        mime: "text/csv",
        storagePath: "uploads/source.csv",
        metadata: {
          month: "2026-08",
          retentionEndsAt: "2033-12-31T23:59:59.999Z",
          entryCount: 1
        }
      })
    },
    organizationMembership: {
      findMany: async () => [{
        id: "membership-owner",
        organizationId: "org-1",
        organization: { id: "org-1", displayName: "Org" },
        units: []
      }],
      findFirst: async () => recipient
    },
    organizationReportingLine: { findMany: async () => [] },
    organizationCapabilityGrant: {
      findMany: async () => [{ capability: "ORG_OWNER", membership: recipient }]
    },
    serviceReportShare: {
      create: async ({ data }) => {
        if (duplicate) {
          const error = new Error("duplicate");
          error.code = "P2002";
          throw error;
        }
        const row = { id: "share-1", createdAt: NOW, updatedAt: NOW, recalledAt: null, ...data };
        rows.push(row);
        return { id: row.id };
      },
      updateMany: async ({ where, data }) => {
        const row = rows.find((item) => item.id === where.id && (!where.status || item.status === where.status));
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      findFirst: async ({ where }) => rows.find((row) => row.id === where.id && row.ownerUserId === where.ownerUserId) || null,
      deleteMany: async ({ where }) => {
        const before = rows.length;
        rows = rows.filter((row) => row.id !== where.id || row.status !== where.status);
        return { count: before - rows.length };
      }
    },
    dataAuditLog: {
      create: async ({ data }) => {
        if (auditFails) throw new Error("audit down");
        audits.push(data);
        return data;
      }
    },
    $queryRaw: async () => [],
    $transaction: async (work) => {
      const rowsBefore = structuredClone(rows);
      const auditsBefore = structuredClone(audits);
      try {
        return await work(db);
      } catch (error) {
        rows = rowsBefore;
        audits = auditsBefore;
        throw error;
      }
    }
  };
  return db;
}

const INPUT = {
  ownerUserId: "owner-user",
  documentId: "doc-1",
  recipientMembershipId: "membership-lead"
};

function storage(overrides = {}) {
  const events = [];
  let seq = 0;
  return {
    events,
    readDocument: async () => Buffer.from("report bytes"),
    makeStoragePath: (name) => `uploads/${++seq}-${name}`,
    storeBuffer: async (buffer, path) => {
      events.push(`store:${path}`);
      return { size: buffer.length, sha256: "a".repeat(64) };
    },
    promoteFile: async (from, to) => events.push(`promote:${from}:${to}`),
    deleteFile: async (path) => events.push(`delete:${path}`),
    ...overrides
  };
}

test("jagamine liigub PREPARING reast SENT+i ja audit commitib samas tehingus", async () => {
  const db = makeDb();
  const files = storage();
  const result = await shareMonthlyReport(INPUT, { db, now: NOW, ...files });
  assert.equal(result.id, "share-1");
  assert.equal(db.rows[0].status, "SENT");
  assert.equal(db.rows[0].stagingStoragePath, null);
  assert.equal(db.audits.length, 1);
  assert.match(files.events.join("|"), /^store:.*\|promote:/);
});

test("store→DB vea järel puhastatakse mõlemad asukohad ja PREPARING rida", async () => {
  const db = makeDb();
  const files = storage({ storeBuffer: async () => { throw new Error("disk full"); } });
  await assert.rejects(() => shareMonthlyReport(INPUT, { db, now: NOW, ...files }), /disk full/);
  assert.equal(db.rows.length, 0);
  assert.equal(files.events.filter((event) => event.startsWith("delete:")).length, 2);
});

test("DB→audit vea järel SENT rollbackib ning fail ja PREPARING rida koristatakse", async () => {
  const db = makeDb({ auditFails: true });
  const files = storage();
  await assert.rejects(() => shareMonthlyReport(INPUT, { db, now: NOW, ...files }), /audit down/);
  assert.equal(db.rows.length, 0);
  assert.equal(db.audits.length, 0);
  assert.equal(files.events.filter((event) => event.startsWith("delete:")).length, 2);
});

test("puhastuse tõrge jätab taastatava PREPARING rea retention-sweepile", async () => {
  const db = makeDb({ auditFails: true });
  const files = storage({ deleteFile: async () => { throw new Error("unlink failed"); } });
  await assert.rejects(() => shareMonthlyReport(INPUT, { db, now: NOW, ...files }), /audit down/);
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0].status, "PREPARING");
  assert.ok(db.rows[0].stagingStoragePath);
});

test("P2002 juhtub enne faili kirjutust", async () => {
  const db = makeDb({ duplicate: true });
  const files = storage();
  const error = await shareMonthlyReport(INPUT, { db, now: NOW, ...files }).catch((value) => value);
  assert.equal(error.status, 409);
  assert.deepEqual(files.events, []);
});

test("tagasivõtmise auditivea korral rollbackib ka RECALLED", async () => {
  const db = makeDb({ auditFails: true });
  db.rows.push({
    id: "share-1",
    ownerUserId: "owner-user",
    organizationId: "org-1",
    month: "2026-08",
    status: "SENT",
    recalledAt: null,
    updatedAt: NOW
  });
  await assert.rejects(
    () => recallShare("share-1", { ownerUserId: "owner-user" }, { db, now: NOW }),
    /audit down/
  );
  assert.equal(db.rows[0].status, "SENT");
  assert.equal(db.rows[0].recalledAt, null);
});

test("retention-sweep eemaldab taastatava PREPARING rea alles pärast mõlema faili koristust", async () => {
  const events = [];
  const db = {
    serviceReportShare: {
      findMany: async () => [{ id: "share-p", storagePath: "final", stagingStoragePath: "staging" }],
      delete: async ({ where }) => events.push(`db:${where.id}`)
    }
  };
  const result = await purgeServiceReportShareFiles({
    db,
    now: NOW,
    deleteFile: async (path) => events.push(`file:${path}`)
  });
  assert.deepEqual(events, ["file:staging", "file:final", "db:share-p"]);
  assert.deepEqual(result, { scanned: 1, purged: 1, failed: 0 });
});
