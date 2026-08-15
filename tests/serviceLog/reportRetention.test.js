import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  archiveRetainedServiceLogReportsForDeletedAccount,
  assertServiceLogReportDeletable,
  isServiceLogReportRetentionActive,
  partitionDocumentsForAccountDeletion,
  preserveServiceLogReportKind,
  purgeExpiredServiceLogReportArchives
} from "../../lib/serviceLog/reportRetention.js";
import { runUserDeletionCleanup } from "../../lib/privacy/userDeletionOrchestrator.js";

const NOW = new Date("2026-08-12T12:00:00.000Z");

function report(overrides = {}) {
  return {
    id: "report-1",
    kind: "SERVICE_LOG_REPORT",
    title: "Teenuspäevik 2026-07",
    originalName: "report.csv",
    mime: "text/csv",
    size: 12,
    sha256: "sha-report",
    storagePath: "uploads/report.csv",
    metadata: { retentionEndsAt: "2033-12-31T23:59:59.999Z", retentionBasis: "RPS_12" },
    createdAt: new Date("2026-08-02T10:00:00.000Z"),
    ...overrides
  };
}

test("Teenuspäeviku raporti DELETE on enne tähtaega 409 ja pärast tähtaega lubatud", () => {
  const document = report();
  assert.equal(isServiceLogReportRetentionActive(document, NOW), true);
  assert.throws(
    () => assertServiceLogReportDeletable(document, NOW),
    (error) => error.status === 409 && error.message === "documents.errors.retention_locked"
  );
  assert.doesNotThrow(() =>
    assertServiceLogReportDeletable(document, new Date("2034-01-01T00:00:00.000Z"))
  );
});

test("puuduv või vigane raporti säilitustähtaeg lukustab kustutuse", () => {
  for (const retentionEndsAt of [null, "not-a-date"]) {
    assert.throws(
      () => assertServiceLogReportDeletable(report({ metadata: { retentionEndsAt } }), NOW),
      (error) => error.status === 409
    );
  }
});

test("säilitatava raporti kind ei ole dokumendi PATCH kaudu muudetav", () => {
  const document = report();
  assert.equal(preserveServiceLogReportKind(document, "MATERIAL"), "SERVICE_LOG_REPORT");
  assert.equal(preserveServiceLogReportKind(document, "OTHER"), "SERVICE_LOG_REPORT");
  assert.equal(preserveServiceLogReportKind({ kind: "MATERIAL" }, "OTHER"), "OTHER");

  const route = readFileSync(new URL("../../app/api/documents/[id]/route.js", import.meta.url), "utf8");
  assert.match(route, /const kind = preserveServiceLogReportKind\(existing, requestedKind\)/);
});

test("konto kustutus eraldab säilitatava raporti failikustutuse sihtidest", () => {
  const ordinary = report({ id: "ordinary", kind: "MATERIAL", metadata: null });
  const expired = report({ id: "expired", metadata: { retentionEndsAt: "2026-08-01T00:00:00.000Z" } });
  const active = report({ id: "active" });
  const result = partitionDocumentsForAccountDeletion([ordinary, expired, active], NOW);
  assert.deepEqual(result.deletableDocuments.map((row) => row.id), ["ordinary", "expired"]);
  assert.deepEqual(result.retainedDocuments.map((row) => row.id), ["active"]);
});

test("konto kustutus teisaldab raporti identiteedita juriidilisse arhiivi", async () => {
  const documents = [report()];
  const archives = [];
  const tx = {
    userDocument: {
      findMany: async () => documents,
      delete: async ({ where }) => {
        const index = documents.findIndex((row) => row.id === where.id);
        documents.splice(index, 1);
      }
    },
    serviceLogReportLegalArchive: {
      upsert: async ({ create }) => {
        archives.push(create);
        return create;
      }
    }
  };
  const db = { $transaction: async (work) => work(tx) };

  const result = await archiveRetainedServiceLogReportsForDeletedAccount("user-1", {
    db,
    now: NOW,
    protectedDocumentIds: ["report-1"]
  });

  assert.equal(result.archived, 1);
  assert.equal(documents.length, 0, "UserDocument ei tohi konto kaskaadi oodata");
  assert.equal(archives.length, 1);
  assert.equal("ownerId" in archives[0], false);
  assert.equal("userId" in archives[0], false);
  assert.equal(archives[0].storagePath, "uploads/report.csv");
});

test("konto kustutuse orkestreerija arhiivib säilitatava raporti enne kasutajat ega kustuta tema faili", async () => {
  const events = [];
  const retained = report();
  const result = await runUserDeletionCleanup({
    targets: {
      documents: [],
      retainedDocuments: [retained],
      materialSubmissions: [],
      artifacts: [],
      preInquirySourceIds: []
    },
    user: { email: "user@example.test" },
    targetUserId: "user-1",
    deleteRagReference: async () => ({ ok: true }),
    deleteDocumentFile: async () => {
      events.push("file-delete");
      return { ok: true };
    },
    deleteMaterialFile: async () => ({ ok: true }),
    recordArtifact: async () => {},
    deleteVerificationTokens: async () => {},
    deleteChatLogs: async () => {},
    archiveRetainedDocuments: async () => {
      events.push("archive");
      return { archived: 1 };
    },
    deleteUser: async () => {
      events.push("user-delete");
      return {};
    }
  });

  assert.equal(result.ok, true);
  assert.deepEqual(events, ["archive", "user-delete"]);
  assert.equal(result.counts.retainedDocumentsArchived, 1);
});

test("juriidilise arhiivi koristus kustutab faili enne DB-rida ja ainult pärast tähtaega", async () => {
  const events = [];
  const db = {
    serviceLogReportLegalArchive: {
      findMany: async ({ where }) => {
        assert.equal(where.retentionEndsAt.lte.toISOString(), NOW.toISOString());
        return [{ id: "archive-1", storagePath: "uploads/report.csv" }];
      },
      delete: async ({ where }) => events.push(`db:${where.id}`)
    }
  };
  const result = await purgeExpiredServiceLogReportArchives({
    db,
    now: NOW,
    deleteFile: async (storagePath) => events.push(`file:${storagePath}`)
  });
  assert.deepEqual(events, ["file:uploads/report.csv", "db:archive-1"]);
  assert.deepEqual(result, { scanned: 1, purged: 1, failed: 0 });
});
