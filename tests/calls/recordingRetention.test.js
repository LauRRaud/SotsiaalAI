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

  // SOL-CALL-06: tagastus on nüüd astmete kinnitus, mitte tõeväärtus „proovisime".
  const result = await purgeRecordingFile({ db, file: db._files[0], storage: fakeStorage(deleted) });

  assert.equal(result.purged, true);
  assert.deepEqual(deleted, ["uploads/rec1.ogg"], "falls back to the file's own path when the document is missing");
  assert.equal(db._files[0].status, "DELETED");
});

/* SOL-CALL-06 — kolm sammu, kolm veasüsti. Iga test tõendab kaht asja korraga:
   kutsuja EI SAA „purged: true" ja rida EI jää valetama, vaid jääb `DELETE_PENDING`-iks,
   kust sweep ta uuesti üles korjab. Negatiivkontroll on vana teostus: ta tagastas
   KÕIGIL kolmel juhul `true` ja kirjutas reale `DELETED`. */

function failingStorage(step, deleted = []) {
  return {
    async deleteStoredArtifact({ storagePath }) {
      if (step === "artifact") throw Object.assign(new Error("EACCES"), { code: "EACCES" });
      deleted.push(storagePath);
    },
    async discardEgressArtifact({ fileName }) {
      if (step === "egress_artifact") throw Object.assign(new Error("EBUSY"), { code: "EBUSY" });
      deleted.push(fileName);
    }
  };
}

test("SOL-CALL-06: füüsilise objekti tõrge ei anna DELETED-i ega 'purged'", async () => {
  const db = fakeDb({
    files: [{ id: "f1", createdDocumentId: "d1", filePath: "uploads/rec1.ogg", status: "AVAILABLE", retentionUntil: new Date("2026-07-01T00:00:00Z") }],
    documents: [{ id: "d1", storagePath: "uploads/rec1.ogg" }]
  });

  const result = await purgeRecordingFile({ db, file: db._files[0], storage: failingStorage("artifact") });

  assert.equal(result.purged, false);
  assert.equal(result.step, "artifact");
  assert.equal(db._files[0].status, "DELETE_PENDING", "rida ei tohi väita, et faili ei ole");
  assert.equal(db._docs.length, 1, "dokumendi rida ei tohi kaduda enne objekti");
});

test("SOL-CALL-06: dokumendi rea tõrge jätab kustutuse pooleli, mitte lõpetatuks", async () => {
  const db = fakeDb({
    files: [{ id: "f1", createdDocumentId: "d1", filePath: "uploads/rec1.ogg", status: "AVAILABLE", retentionUntil: new Date("2026-07-01T00:00:00Z") }],
    documents: [{ id: "d1", storagePath: "uploads/rec1.ogg" }]
  });
  db.userDocument.deleteMany = async () => {
    throw new Error("db down");
  };

  const result = await purgeRecordingFile({ db, file: db._files[0], storage: failingStorage(null) });

  assert.equal(result.purged, false);
  assert.equal(result.step, "document_row");
  assert.equal(db._files[0].status, "DELETE_PENDING");
});

test("SOL-CALL-06: failirea tõrge ei tohi jääda nähtamatuks", async () => {
  const db = fakeDb({
    files: [{ id: "f1", filePath: "uploads/rec1.ogg", status: "AVAILABLE", retentionUntil: new Date("2026-07-01T00:00:00Z") }]
  });
  let calls = 0;
  const realUpdate = db.callRecordingFile.update;
  db.callRecordingFile.update = async args => {
    calls += 1;
    if (calls > 1) throw new Error("db down");
    return realUpdate.call(db.callRecordingFile, args);
  };

  const result = await purgeRecordingFile({ db, file: db._files[0], storage: failingStorage(null) });

  assert.equal(result.purged, false);
  assert.equal(result.step, "file_row");
  assert.equal(db._files[0].status, "DELETE_PENDING", "kavatsus jääb kirja, seega sweep proovib uuesti");
});

test("SOL-CALL-06: pooleli jäänud kustutus korjatakse sweep'iga uuesti üles ja läheb siis lõpuni", async () => {
  const db = fakeDb({
    files: [{ id: "f1", createdDocumentId: "d1", filePath: "uploads/rec1.ogg", status: "AVAILABLE", retentionUntil: new Date("2026-07-01T00:00:00Z") }],
    documents: [{ id: "d1", storagePath: "uploads/rec1.ogg" }]
  });
  const now = () => new Date("2026-07-19T12:00:00Z");

  const first = await purgeExpiredCallRecordings({ db, now, storage: failingStorage("artifact") });
  assert.equal(first.purged, 0, "'purged' ei tohi kasvada kinnitamata kustutuse peale");
  assert.equal(first.failed, 1);
  assert.equal(db._files[0].status, "DELETE_PENDING");

  const deleted = [];
  const second = await purgeExpiredCallRecordings({ db, now, storage: failingStorage(null, deleted) });
  assert.equal(second.scanned, 1, "DELETE_PENDING peab sweep'i valikusse kuuluma");
  assert.equal(second.purged, 1);
  assert.deepEqual(deleted, ["uploads/rec1.ogg"]);
  assert.equal(db._files[0].status, "DELETED");
});

test("SOL-CALL-06: finaliseerimata salvestise TOORES fail kustutatakse egress-kaustast", async () => {
  /* See samm puudus täielikult: toores nimi saadeti dokumendisalvestusse, mis nõuab
     `uploads/` prefiksit — tee-viga neelati alla ja partiaal jäi kettale, samal ajal
     kui raport luges rea „purged" hulka. */
  const db = fakeDb({
    files: [{ id: "f1", filePath: "call-recording-x-y-20260810090000-abc.ogg", status: "QUARANTINED", providerStopConfirmedAt: new Date("2026-07-01T00:00:00Z"), retentionUntil: new Date("2026-07-01T00:00:00Z") }]
  });
  const deleted = [];

  const result = await purgeRecordingFile({ db, file: db._files[0], storage: failingStorage(null, deleted) });

  assert.equal(result.purged, true);
  assert.deepEqual(deleted, ["call-recording-x-y-20260810090000-abc.ogg"], "toores fail peab minema egress-rajale");
  assert.equal(db._files[0].status, "DELETED");
});

test("SOL-CALL-06: toore faili kustutuse tõrge jätab rea DELETE_PENDING-iks", async () => {
  const db = fakeDb({
    files: [{ id: "f1", filePath: "call-recording-x-y-20260810090000-abc.ogg", status: "QUARANTINED", providerStopConfirmedAt: new Date("2026-07-01T00:00:00Z"), retentionUntil: new Date("2026-07-01T00:00:00Z") }]
  });

  const result = await purgeRecordingFile({ db, file: db._files[0], storage: failingStorage("egress_artifact") });

  assert.equal(result.purged, false);
  assert.equal(result.step, "egress_artifact");
  assert.equal(db._files[0].status, "DELETE_PENDING");
});
