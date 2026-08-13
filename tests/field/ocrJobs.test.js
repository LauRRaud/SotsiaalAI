import test from "node:test";
import assert from "node:assert/strict";

import { requestFieldOcr } from "../../lib/field/ocr.js";
import { createFieldDb, makeVisit } from "../helpers/fieldDb.mjs";

const NOW = new Date("2026-08-13T19:00:00.000Z");

function attachment(overrides = {}) {
  return {
    id: "attachment-1",
    visitId: "visit-1",
    clientItemId: "field-photo-ocr-1",
    role: "photo",
    storageStatus: "ACTIVE",
    visit: { id: "visit-1", ownerUserId: "user-1" },
    document: {
      id: "document-1",
      ownerId: "user-1",
      storagePath: "uploads/photo.png",
      sha256: "a".repeat(64)
    },
    ...overrides
  };
}

test("same attachment SHA computes once and returns the persisted result", async () => {
  const db = createFieldDb({ visits: [makeVisit()], attachments: [attachment()] });
  let executions = 0;
  const options = {
    db,
    now: NOW,
    readDocument: async () => Buffer.from("photo"),
    execute: async () => {
      executions += 1;
      return { text: "Loetud tekst", truncated: false };
    }
  };
  const first = await requestFieldOcr(
    { ownerUserId: "user-1", visitId: "visit-1", clientItemId: "field-photo-ocr-1", ipAddress: "127.0.0.1" },
    options
  );
  const second = await requestFieldOcr(
    { ownerUserId: "user-1", visitId: "visit-1", clientItemId: "field-photo-ocr-1", ipAddress: "127.0.0.1" },
    options
  );
  assert.equal(executions, 1);
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(second.jobId, first.jobId);
  assert.equal(db.store.ocrJobs[0].status, "DONE");
});

test("persistent user/IP rate events produce an honest 429 and Retry-After", async () => {
  const db = createFieldDb({
    visits: [makeVisit()],
    attachments: [
      attachment(),
      attachment({
        id: "attachment-2",
        clientItemId: "field-photo-ocr-2",
        document: { id: "document-2", ownerId: "user-1", storagePath: "uploads/photo-2.png", sha256: "b".repeat(64) }
      })
    ]
  });
  const options = {
    db,
    now: NOW,
    rateMax: 1,
    readDocument: async () => Buffer.from("photo"),
    execute: async () => ({ text: "Tekst", truncated: false })
  };
  await requestFieldOcr(
    { ownerUserId: "user-1", visitId: "visit-1", clientItemId: "field-photo-ocr-1", ipAddress: "10.0.0.1" },
    options
  );
  await assert.rejects(
    requestFieldOcr(
      { ownerUserId: "user-1", visitId: "visit-1", clientItemId: "field-photo-ocr-2", ipAddress: "10.0.0.1" },
      options
    ),
    (error) => error.status === 429 && error.retryAfter === 60 && error.message === "field.errors.ocr_rate_limited"
  );
});

test("no global worker slot leaves a recoverable PENDING job and returns 429", async () => {
  const db = createFieldDb({ visits: [makeVisit()], attachments: [attachment()] });
  db.$queryRaw = async () => [{ locked: false }];
  await assert.rejects(
    requestFieldOcr(
      { ownerUserId: "user-1", visitId: "visit-1", clientItemId: "field-photo-ocr-1", ipAddress: "10.0.0.2" },
      {
        db,
        now: NOW,
        readDocument: async () => Buffer.from("photo"),
        execute: async () => ({ text: "Ei käivitu", truncated: false })
      }
    ),
    (error) => error.status === 429 && error.retryAfter === 2 && error.message === "field.errors.ocr_busy"
  );
  assert.equal(db.store.ocrJobs[0].status, "PENDING");
});
