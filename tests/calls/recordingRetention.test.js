import test from "node:test";
import assert from "node:assert/strict";

import { purgeExpiredCallRecordings, purgeRecordingFile } from "../../lib/calls/recordingRetention.js";

function fakeDb({ files = [], documents = [] } = {}) {
  const fileRows = files.map(f => ({ ...f }));
  const docRows = documents.map(d => ({ ...d }));
  return {
    _files: fileRows,
    _docs: docRows,
    callRecordingFile: {
      async findMany({ where, take } = {}) {
        const rows = fileRows.filter(r => {
          if (where?.retentionUntil?.lte && !(r.retentionUntil && new Date(r.retentionUntil) <= new Date(where.retentionUntil.lte))) return false;
          if (where?.status?.in && !where.status.in.includes(r.status)) return false;
          return true;
        });
        return typeof take === "number" ? rows.slice(0, take) : rows;
      },
      async update({ where, data }) {
        const row = fileRows.find(r => r.id === where.id);
        if (!row) throw new Error("not_found");
        Object.assign(row, data);
        return row;
      }
    },
    userDocument: {
      async findFirst({ where }) {
        return docRows.find(d => d.id === where.id) || null;
      },
      async deleteMany({ where }) {
        const idx = docRows.findIndex(d => d.id === where.id);
        if (idx >= 0) {
          docRows.splice(idx, 1);
          return { count: 1 };
        }
        return { count: 0 };
      }
    }
  };
}

function fakeStorage(deleted) {
  return {
    async deleteStoredArtifact({ storagePath }) {
      deleted.push(storagePath);
    }
  };
}

test("T12 E6: purge deletes the physical object, the document and marks the row DELETED (audit 12 K1)", async () => {
  const now = new Date("2026-07-19T12:00:00Z");
  const db = fakeDb({
    files: [{ id: "f1", createdDocumentId: "d1", filePath: "uploads/rec1.ogg", status: "AVAILABLE", retentionUntil: new Date("2026-07-01T00:00:00Z") }],
    documents: [{ id: "d1", storagePath: "uploads/rec1.ogg" }]
  });
  const deleted = [];

  const result = await purgeExpiredCallRecordings({ db, now: () => now, storage: fakeStorage(deleted) });

  assert.equal(result.scanned, 1);
  assert.equal(result.purged, 1);
  assert.deepEqual(deleted, ["uploads/rec1.ogg"], "physical file object is deleted");
  assert.equal(db._docs.length, 0, "linked document row is deleted");
  assert.equal(db._files[0].status, "DELETED");
  assert.equal(db._files[0].filePath, null, "filePath pointer is cleared");
});

test("T12 E6: purge leaves recordings whose retention has not elapsed", async () => {
  const now = new Date("2026-07-19T12:00:00Z");
  const db = fakeDb({
    files: [{ id: "f1", createdDocumentId: "d1", filePath: "uploads/rec1.ogg", status: "AVAILABLE", retentionUntil: new Date("2026-12-01T00:00:00Z") }],
    documents: [{ id: "d1", storagePath: "uploads/rec1.ogg" }]
  });
  const deleted = [];

  const result = await purgeExpiredCallRecordings({ db, now: () => now, storage: fakeStorage(deleted) });

  assert.equal(result.purged, 0);
  assert.equal(deleted.length, 0);
  assert.equal(db._files[0].status, "AVAILABLE", "untouched before retention elapses");
  assert.equal(db._docs.length, 1);
});

test("T12 E6: purge does not re-process already DELETED recordings", async () => {
  const now = new Date("2026-07-19T12:00:00Z");
  const db = fakeDb({
    files: [{ id: "f1", createdDocumentId: null, filePath: null, status: "DELETED", retentionUntil: new Date("2026-07-01T00:00:00Z") }]
  });

  const result = await purgeExpiredCallRecordings({ db, now: () => now, storage: fakeStorage([]) });

  assert.equal(result.scanned, 0, "DELETED rows are not candidates");
  assert.equal(result.purged, 0);
});

test("T12 E6: purgeRecordingFile is idempotent and falls back to filePath when the document is gone", async () => {
  const db = fakeDb({
    files: [{ id: "f1", createdDocumentId: "missing", filePath: "uploads/rec1.ogg", status: "FAILED", retentionUntil: new Date("2026-07-01T00:00:00Z") }]
  });
  const deleted = [];

  const ok = await purgeRecordingFile({ db, file: db._files[0], storage: fakeStorage(deleted) });

  assert.equal(ok, true);
  assert.deepEqual(deleted, ["uploads/rec1.ogg"], "falls back to the file's own path when the document is missing");
  assert.equal(db._files[0].status, "DELETED");
});
