import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { receiveReportBody } from "../../lib/serviceLog/reportDeliveryClient.js";
import {
  confirmShareDelivery,
  createReportDeliveryToken,
  recordShareAccessAttempt,
  readVerifiedReportFile
} from "../../lib/serviceLog/reportShare.js";

const env = { NODE_ENV: "test", REPORT_DELIVERY_SECRET: "sol-org-16-test-secret" };
const content = Buffer.from("month;count\n2026-08;1\n", "utf8");

function documentRow() {
  return {
    id: "report_1",
    recipientMembershipId: "member_1",
    status: "SENT",
    organizationId: "org_1",
    ownerUserId: "owner_1",
    month: "2026-08",
    storagePath: "uploads/report.csv",
    fileName: "report.csv",
    mime: "text/csv",
    sizeBytes: content.byteLength,
    sha256: createHash("sha256").update(content).digest("hex"),
    updatedAt: new Date("2026-08-12T10:00:00Z"),
    recalledAt: null
  };
}

function confirmationDb({ auditFails = false } = {}) {
  const state = { row: documentRow(), audits: 0 };
  const tx = {
    $queryRaw: async () => [{ id: state.row.id }],
    serviceReportShare: {
      findFirst: async ({ where }) =>
        where.id === state.row.id && where.recipientMembershipId === state.row.recipientMembershipId
          ? { ...state.row }
          : null,
      updateMany: async () => {
        if (state.row.status !== "SENT") return { count: 0 };
        state.row = { ...state.row, status: "OPENED", openedAt: new Date("2026-08-12T11:00:00Z") };
        return { count: 1 };
      }
    },
    dataAuditLog: {
      create: async () => {
        if (auditFails) throw new Error("INJECTED_AUDIT_FAILURE");
        state.audits += 1;
        return {};
      }
    }
  };
  return {
    state,
    $transaction: async (callback) => {
      const before = { ...state.row };
      try {
        return await callback(tx);
      } catch (error) {
        state.row = before;
        throw error;
      }
    }
  };
}

test("SOL-ORG-16: missing file fails before a delivery can be confirmed", async () => {
  let reads = 0;
  await assert.rejects(
    () =>
      readVerifiedReportFile(documentRow(), {
        readFile: async () => {
          reads += 1;
          throw new Error("ENOENT");
        }
      }),
    /ENOENT/
  );
  assert.equal(reads, 1);
});

test("SOL-ORG-16: wrong file hash fails closed", async () => {
  const row = documentRow();
  row.sha256 = "f".repeat(64);
  await assert.rejects(
    () => readVerifiedReportFile(row, { readFile: async () => content }),
    (error) => error.code === "REPORT_FILE_HASH_MISMATCH"
  );
});

test("SOL-ORG-16: interrupted response body never calls delivery confirmation", async () => {
  let confirmations = 0;
  await assert.rejects(
    () =>
      receiveReportBody(
        { ok: true, headers: { get: () => "token" } },
        {
          readBody: async () => {
            throw new Error("INJECTED_STREAM_INTERRUPTION");
          },
          confirm: async () => {
            confirmations += 1;
            return true;
          }
        }
      ),
    /INJECTED_STREAM_INTERRUPTION/
  );
  assert.equal(confirmations, 0);
});

test("SOL-ORG-16: mandatory access-attempt audit failure blocks delivery", async () => {
  let auditAttempts = 0;
  const db = {
    serviceReportShare: {
      findFirst: async () => ({
        id: "report_1",
        organizationId: "org_1",
        ownerUserId: "owner_1"
      })
    },
    dataAuditLog: {
      create: async () => {
        auditAttempts += 1;
        throw new Error("INJECTED_ACCESS_AUDIT_FAILURE");
      }
    }
  };
  await assert.rejects(
    () =>
      recordShareAccessAttempt(
        "report_1",
        { membershipIds: ["member_1"], actorUserId: "recipient_1" },
        { db }
      ),
    /INJECTED_ACCESS_AUDIT_FAILURE/
  );
  assert.equal(auditAttempts, 1);
});

test("SOL-ORG-16: route writes access-attempt audit before constructing a byte response", async () => {
  const source = await readFile(
    new URL("../../app/api/org/[orgId]/aruanded/[shareId]/route.js", import.meta.url),
    "utf8"
  );
  const integrityCheck = source.indexOf("await readVerifiedReportFile(document)");
  const accessAudit = source.indexOf("await recordShareAccessAttempt(");
  const firstByteResponse = source.indexOf("new Response(");
  assert.ok(integrityCheck >= 0 && integrityCheck < accessAudit);
  assert.ok(accessAudit >= 0 && accessAudit < firstByteResponse);
});

test("SOL-ORG-16: audit failure rolls OPENED back in the same transaction", async () => {
  const row = documentRow();
  const token = createReportDeliveryToken(row, {
    actorUserId: "recipient_1",
    now: new Date("2026-08-12T10:00:00Z"),
    env
  });
  const db = confirmationDb({ auditFails: true });
  await assert.rejects(
    () =>
      confirmShareDelivery(
        token,
        { membershipIds: ["member_1"], actorUserId: "recipient_1", shareId: "report_1" },
        { db, now: new Date("2026-08-12T10:01:00Z"), env }
      ),
    /INJECTED_AUDIT_FAILURE/
  );
  assert.equal(db.state.row.status, "SENT");
  assert.equal(db.state.audits, 0);
});

test("SOL-ORG-16: full body plus valid receipt changes status and writes one audit", async () => {
  const row = documentRow();
  const token = createReportDeliveryToken(row, {
    actorUserId: "recipient_1",
    now: new Date("2026-08-12T10:00:00Z"),
    env
  });
  const db = confirmationDb();
  const result = await confirmShareDelivery(
    token,
    { membershipIds: ["member_1"], actorUserId: "recipient_1", shareId: "report_1" },
    { db, now: new Date("2026-08-12T10:01:00Z"), env }
  );
  assert.equal(result.alreadyOpened, false);
  assert.equal(db.state.row.status, "OPENED");
  assert.equal(db.state.audits, 1);
});
