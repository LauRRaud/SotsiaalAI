import test from "node:test";
import assert from "node:assert/strict";

import {
  deleteFieldVisitNote,
  getFieldVisitDetail,
  listFieldVisits,
  putFieldVisitNote
} from "../../lib/field/service.js";
import { createFieldDb, makeVisit } from "../helpers/fieldDb.mjs";

const CLOSED_AT = new Date("2026-08-13T12:00:00.000Z");

function noteInput(overrides = {}) {
  return {
    kind: "note",
    provenance: "KLIENDI_OELDUD",
    body: "Seadmes enne sulgemist tehtud märge",
    revision: 1,
    deviceCreatedAt: "2026-08-13T11:59:00.000Z",
    ...overrides
  };
}

test("closed visit accepts only an explicit pre-close recovery import and audits it atomically", async () => {
  const db = createFieldDb({
    visits: [makeVisit({ status: "CLOSED", closedAt: CLOSED_AT })]
  });

  await assert.rejects(
    putFieldVisitNote("user-1", "visit-1", "recovery-note-1", noteInput(), { db, now: CLOSED_AT }),
    (error) => error.status === 409 && error.message === "field.errors.visit_read_only"
  );
  await assert.rejects(
    putFieldVisitNote(
      "user-1",
      "visit-1",
      "recovery-note-2",
      noteInput({ recoveryImport: true, deviceCreatedAt: "2026-08-13T12:00:01.000Z" }),
      { db, now: CLOSED_AT }
    ),
    (error) => error.status === 409 && error.message === "field.errors.visit_read_only"
  );

  const recovered = await putFieldVisitNote(
    "user-1",
    "visit-1",
    "recovery-note-3",
    noteInput({ recoveryImport: true }),
    { db, now: CLOSED_AT }
  );

  assert.equal(recovered.recovered, true);
  assert.equal(recovered.note.recoveryImportedAt, CLOSED_AT.toISOString());
  assert.equal(db.store.notes.length, 1);
  assert.equal(db.store.auditLog.length, 1);
  assert.equal(db.store.auditLog[0].action, "field.note_recovery_imported");
});

test("server note deletion is audited and a consent must use withdrawal instead", async () => {
  const db = createFieldDb({
    visits: [makeVisit({ status: "WRAP_UP" })],
    notes: [
      { id: "note-1", visitId: "visit-1", clientItemId: "server-note-1", kind: "note" },
      { id: "note-2", visitId: "visit-1", clientItemId: "server-consent-1", kind: "consent" }
    ]
  });

  await deleteFieldVisitNote("user-1", "visit-1", "server-note-1", { db });
  assert.equal(db.store.notes.some((row) => row.id === "note-1"), false);
  assert.equal(db.store.auditLog.at(-1).action, "field.note_deleted");

  await assert.rejects(
    deleteFieldVisitNote("user-1", "visit-1", "server-consent-1", { db }),
    (error) => error.status === 409 && error.message === "field.errors.consent_must_be_withdrawn"
  );
  assert.equal(db.store.notes.some((row) => row.id === "note-2"), true);
});

test("visit cursor returns all 51 rows exactly once with honest totals", async () => {
  const base = Date.parse("2026-08-13T12:00:00.000Z");
  const visits = Array.from({ length: 51 }, (_, index) => makeVisit({
    id: `visit-${String(index).padStart(3, "0")}`,
    status: index % 2 ? "CLOSED" : "WRAP_UP",
    createdAt: new Date(base - index * 1000),
    updatedAt: new Date(base - index * 1000),
    _count: { notes: index, attachments: 0 }
  }));
  const db = createFieldDb({ visits });

  const first = await listFieldVisits("user-1", { db, limit: 50 });
  const second = await listFieldVisits("user-1", { db, limit: 50, cursor: first.nextCursor });
  const ids = [...first.visits, ...second.visits].map((visit) => visit.id);

  assert.equal(first.visits.length, 50);
  assert.equal(second.visits.length, 1);
  assert.equal(new Set(ids).size, 51);
  assert.deepEqual(first.counts, { open: 26, closed: 25 });
});

test("detail and handover source no longer silently truncate 501 server notes", async () => {
  const notes = Array.from({ length: 501 }, (_, index) => ({
    id: `note-${String(index).padStart(3, "0")}`,
    visitId: "visit-1",
    clientItemId: `client-note-${String(index).padStart(3, "0")}`,
    revision: 1,
    kind: "note",
    provenance: "TOOTAJA_TAHELEPANEK",
    body: `Märge ${index}`,
    createdAt: new Date(Date.parse("2026-08-13T10:00:00.000Z") + index)
  }));
  const db = createFieldDb({ visits: [makeVisit()], notes });

  const detail = await getFieldVisitDetail("user-1", "visit-1", { db });
  assert.equal(detail.notes.length, 501);
  assert.equal(detail.notes.at(-1).clientItemId, "client-note-500");
});
