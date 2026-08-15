import test from "node:test";
import assert from "node:assert/strict";

import {
  deleteFieldVisitAttachment,
  putFieldVisitAttachment,
  reconcileFieldVisitFileJobs
} from "../../lib/field/attachments.js";
import { createFieldDb, makeVisit } from "../helpers/fieldDb.mjs";

const NOW = new Date("2026-08-13T17:30:00.000Z");
const PNG = Buffer.from("89504e470d0a1a0a0000000049454e44ae426082", "hex");

function photoFile() {
  return {
    name: "capture.png",
    type: "image/png",
    size: PNG.length,
    async arrayBuffer() {
      return PNG;
    }
  };
}

function consent(overrides = {}) {
  return {
    id: "consent-1",
    visitId: "visit-1",
    clientItemId: "field-consent-photo-1",
    kind: "consent",
    consentKind: "photo",
    consentWithdrawnAt: null,
    ...overrides
  };
}

const quota = async (_limits, { db }, write) => db.$transaction((tx) => write(tx, {}));

function memoryFiles({ publishFailures = 0, removeFailures = 0 } = {}) {
  const stored = new Map();
  let publishLeft = publishFailures;
  let removeLeft = removeFailures;
  return {
    stored,
    async write(path, buffer) {
      stored.set(path, Buffer.from(buffer));
    },
    async publish(from, to) {
      if (publishLeft-- > 0) throw new Error("rename_failed");
      if (!stored.has(to)) {
        if (!stored.has(from)) throw new Error("staging_missing");
        stored.set(to, stored.get(from));
        stored.delete(from);
      }
    },
    async remove(path) {
      if (!path) return;
      if (removeLeft-- > 0) throw new Error("unlink_failed");
      stored.delete(path);
    },
    async exists(path) {
      return stored.has(path);
    }
  };
}

function dbWithConsent(note = consent()) {
  return createFieldDb({ visits: [makeVisit()], notes: [note] });
}

test("closed visit rejects an attachment with forged recovery metadata", async () => {
  const db = createFieldDb({
    visits: [makeVisit({ status: "CLOSED", closedAt: NOW })],
    notes: [consent()]
  });
  const files = memoryFiles();
  await assert.rejects(
    putFieldVisitAttachment(
      "user-1",
      "visit-1",
      "field-photo-forged-recovery-1",
      {
        file: photoFile(),
        role: "photo",
        consentClientItemId: "field-consent-photo-1",
        recoveryImport: true,
        deviceCreatedAt: "2026-08-13T17:29:59.000Z"
      },
      { db, now: NOW, quota, files }
    ),
    (error) => error.status === 409 && error.message === "field.errors.visit_read_only"
  );
  assert.equal(db.store.documents.length, 0);
  assert.equal(db.store.attachments.length, 0);
  assert.equal(files.stored.size, 0);
});

test("photo consent cannot be replaced by an unproven client boolean", async () => {
  const db = createFieldDb({ visits: [makeVisit()] });
  const files = memoryFiles();
  await assert.rejects(
    putFieldVisitAttachment(
      "user-1",
      "visit-1",
      "field-photo-direct-1",
      { file: photoFile(), role: "photo", documentOnly: true },
      { db, now: NOW, quota, files }
    ),
    (error) => error.status === 409 && error.message === "field.errors.document_request_required"
  );
  assert.equal(db.store.documents.length, 0);
  assert.equal(files.stored.size, 0);
});

test("missing, device-only, withdrawn and wrong-kind consent cannot unlock a photo", async () => {
  for (const note of [null, consent({ kind: "note" }), consent({ consentWithdrawnAt: NOW }), consent({ consentKind: "audio" })]) {
    const db = createFieldDb({ visits: [makeVisit()], notes: note ? [note] : [] });
    await assert.rejects(
      putFieldVisitAttachment(
        "user-1",
        "visit-1",
        `field-photo-${Math.random().toString(36).slice(2, 14)}`,
        { file: photoFile(), role: "photo", consentClientItemId: "field-consent-photo-1" },
        { db, now: NOW, quota, files: memoryFiles() }
      ),
      (error) => error.status === 409 && error.message === "field.errors.consent_required"
    );
  }
});

test("client-requested document exception is projected, audited and revocable by deletion", async () => {
  const db = createFieldDb({ visits: [makeVisit()] });
  const files = memoryFiles();
  const created = await putFieldVisitAttachment(
    "user-1",
    "visit-1",
    "field-photo-request-1",
    {
      file: photoFile(),
      role: "photo",
      documentOnly: true,
      documentRequestConfirmed: true,
      documentRequestReason: "Klient palus toetuse avalduse esikülje talletada."
    },
    { db, now: NOW, quota, files }
  );
  assert.equal(created.attachment.captureBasis, "CLIENT_DOCUMENT_REQUEST");
  assert.match(created.attachment.documentRequestReason, /toetuse avalduse/u);
  assert.equal(created.attachment.storageStatus, "ACTIVE");
  assert.equal(db.store.auditLog.at(-1).action, "field.photo_client_document_requested");

  await deleteFieldVisitAttachment("user-1", "visit-1", "field-photo-request-1", { db, now: NOW, files });
  assert.equal(db.store.attachments.length, 0);
  assert.equal(db.store.documents.length, 0);
  assert.equal(db.store.auditLog.at(-1).action, "field.attachment_deleted");
});

test("publish failure leaves only a pending carrier and restart reconcile completes it", async () => {
  const db = dbWithConsent();
  const files = memoryFiles({ publishFailures: 1 });
  await assert.rejects(
    putFieldVisitAttachment(
      "user-1",
      "visit-1",
      "field-photo-recover-1",
      { file: photoFile(), role: "photo", consentClientItemId: "field-consent-photo-1" },
      { db, now: NOW, quota, files }
    ),
    (error) => error.status === 503 && error.message === "field.errors.file_pending"
  );
  assert.equal(db.store.attachments[0].storageStatus, "PENDING_PUBLISH");
  assert.equal(db.store.deletionJobs[0].status, "failed");

  const recovered = await reconcileFieldVisitFileJobs({ ownerUserId: "user-1" }, { db, files });
  assert.equal(recovered[0].status, "done");
  assert.equal(db.store.attachments[0].storageStatus, "ACTIVE");
  assert.equal(db.store.deletionJobs[0].status, "done");
});

test("unlink and final DB/audit failures remain restart-recoverable tombstones", async () => {
  const db = dbWithConsent();
  const files = memoryFiles();
  await putFieldVisitAttachment(
    "user-1",
    "visit-1",
    "field-photo-delete-1",
    { file: photoFile(), role: "photo", consentClientItemId: "field-consent-photo-1" },
    { db, now: NOW, quota, files }
  );
  const originalAuditCreate = db.dataAuditLog.create;
  db.dataAuditLog.create = async () => {
    throw new Error("audit_failed");
  };
  await assert.rejects(
    deleteFieldVisitAttachment("user-1", "visit-1", "field-photo-delete-1", { db, now: NOW, files }),
    (error) => error.status === 503 && error.message === "field.errors.delete_pending"
  );
  assert.equal(db.store.attachments[0].storageStatus, "DELETE_PENDING");
  db.dataAuditLog.create = originalAuditCreate;
  const recovered = await reconcileFieldVisitFileJobs({ ownerUserId: "user-1" }, { db, files });
  assert.equal(recovered.at(-1).status, "done");
  assert.equal(db.store.attachments.length, 0);
  assert.equal(db.store.documents.length, 0);
});

test("a DB create failure leaves a durable staging job that removes the orphan", async () => {
  const db = dbWithConsent();
  const files = memoryFiles();
  db.userDocument.create = async () => {
    throw new Error("db_create_failed");
  };
  await assert.rejects(
    putFieldVisitAttachment(
      "user-1",
      "visit-1",
      "field-photo-db-fail-1",
      { file: photoFile(), role: "photo", consentClientItemId: "field-consent-photo-1" },
      { db, now: NOW, quota, files }
    ),
    /db_create_failed/u
  );
  assert.equal(files.stored.size, 0);
  assert.equal(db.store.attachments.length, 0);
  assert.equal(db.store.deletionJobs[0].status, "done");
});
