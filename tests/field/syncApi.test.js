import test from "node:test";
import assert from "node:assert/strict";

import { FIELD_PROVENANCE } from "../../lib/field/constants.js";
import { putFieldVisitNote, getFieldVisitDetail } from "../../lib/field/service.js";
import { createFieldDb, makeVisit } from "../helpers/fieldDb.mjs";

const NOW = new Date("2026-07-18T12:00:00.000Z");
const ITEM = "fld-note-000001";

function noteInput(overrides = {}) {
  return {
    kind: "note",
    provenance: FIELD_PROVENANCE.KLIENDI_OELDUD,
    body: "Klient ütles, et küte töötab.",
    revision: 1,
    ...overrides
  };
}

async function status(promise) {
  try {
    await promise;
    return null;
  } catch (error) {
    return { status: error.status, message: error.message, extras: error.extras || null };
  }
}

test("the same clientItemId replayed with the same content returns the existing row, never a duplicate", async () => {
  const db = createFieldDb({ visits: [makeVisit()] });

  const first = await putFieldVisitNote("user-1", "visit-1", ITEM, noteInput(), { db, now: NOW });
  assert.equal(first.created, true);

  const replay = await putFieldVisitNote("user-1", "visit-1", ITEM, noteInput(), { db, now: NOW });
  assert.equal(replay.created, false);
  assert.equal(replay.existing, true);
  assert.equal(replay.note.clientItemId, ITEM);

  // The duplicate guard is the (visitId, clientItemId) unique index: two tabs
  // sending the same item must leave exactly one server row.
  assert.equal(db.store.notes.length, 1);
});

test("a next-revision edit updates in place and keeps a single row", async () => {
  const db = createFieldDb({ visits: [makeVisit()] });
  await putFieldVisitNote("user-1", "visit-1", ITEM, noteInput(), { db, now: NOW });

  const updated = await putFieldVisitNote(
    "user-1",
    "visit-1",
    ITEM,
    noteInput({ revision: 2, body: "Parandatud: küte töötab ainult köögis." }),
    { db, now: NOW }
  );

  assert.equal(updated.updated, true);
  assert.equal(updated.note.revision, 2);
  assert.equal(db.store.notes.length, 1);
  assert.equal(db.store.notes[0].body, "Parandatud: küte töötab ainult köögis.");
});

test("a diverging revision returns 409 and preserves BOTH versions instead of overwriting", async () => {
  const db = createFieldDb({ visits: [makeVisit()] });
  await putFieldVisitNote("user-1", "visit-1", ITEM, noteInput(), { db, now: NOW });

  const conflict = await status(
    putFieldVisitNote(
      "user-1",
      "visit-1",
      ITEM,
      noteInput({ revision: 7, body: "Teise seadme versioon." }),
      { db, now: NOW }
    )
  );

  assert.equal(conflict.status, 409);
  assert.equal(conflict.message, "field.errors.note_conflict");

  // Server text untouched, device text parked in the conflict sibling fields.
  const row = db.store.notes[0];
  assert.equal(row.body, "Klient ütles, et küte töötab.");
  assert.equal(row.conflictState, "CONFLICT");
  assert.equal(row.conflictBody, "Teise seadme versioon.");
  assert.equal(row.conflictRevision, 7);
  // The 409 payload hands the owner both sides so the device copy is never lost.
  assert.equal(conflict.extras.conflict.body, "Klient ütles, et küte töötab.");
  assert.deepEqual(conflict.extras.conflict.conflict, {
    state: "CONFLICT",
    revision: 7,
    body: "Teise seadme versioon.",
    provenance: FIELD_PROVENANCE.KLIENDI_OELDUD
  });
});

test("resolving a conflict to the device version promotes it and clears the conflict", async () => {
  const db = createFieldDb({ visits: [makeVisit()] });
  await putFieldVisitNote("user-1", "visit-1", ITEM, noteInput(), { db, now: NOW });
  await status(
    putFieldVisitNote("user-1", "visit-1", ITEM, noteInput({ revision: 7, body: "Seadme tekst." }), {
      db,
      now: NOW
    })
  );

  const resolved = await putFieldVisitNote("user-1", "visit-1", ITEM, { resolve: "device" }, { db, now: NOW });

  assert.equal(resolved.resolved, true);
  assert.equal(resolved.note.body, "Seadme tekst.");
  assert.equal(resolved.note.conflict, null);
  assert.equal(db.store.notes[0].conflictBody, null);
});

test("resolving to the server version keeps server text and drops the device copy", async () => {
  const db = createFieldDb({ visits: [makeVisit()] });
  await putFieldVisitNote("user-1", "visit-1", ITEM, noteInput(), { db, now: NOW });
  await status(
    putFieldVisitNote("user-1", "visit-1", ITEM, noteInput({ revision: 7, body: "Seadme tekst." }), {
      db,
      now: NOW
    })
  );

  const resolved = await putFieldVisitNote("user-1", "visit-1", ITEM, { resolve: "server" }, { db, now: NOW });

  assert.equal(resolved.note.body, "Klient ütles, et küte töötab.");
  assert.equal(resolved.note.conflict, null);
  assert.equal(db.store.notes[0].conflictBody, null);
});

test("a foreign owner gets 404, never a 403 existence oracle", async () => {
  const db = createFieldDb({ visits: [makeVisit()] });

  const foreignWrite = await status(
    putFieldVisitNote("user-2", "visit-1", ITEM, noteInput(), { db, now: NOW })
  );
  assert.equal(foreignWrite.status, 404);
  assert.equal(foreignWrite.message, "api.common.not_found");

  const foreignRead = await status(getFieldVisitDetail("user-2", "visit-1", { db }));
  assert.equal(foreignRead.status, 404);
  assert.equal(foreignRead.message, "api.common.not_found");

  // A visit id that does not exist at all answers identically — the two cases
  // are indistinguishable from outside.
  const missing = await status(getFieldVisitDetail("user-1", "visit-does-not-exist", { db }));
  assert.equal(missing.status, 404);
  assert.equal(missing.message, "api.common.not_found");
  assert.equal(db.store.notes.length, 0);
});

test("malformed client item ids and unknown provenance fail closed with 400", async () => {
  const db = createFieldDb({ visits: [makeVisit()] });

  assert.equal((await status(putFieldVisitNote("user-1", "visit-1", "short", noteInput(), { db, now: NOW }))).status, 400);
  assert.equal(
    (await status(putFieldVisitNote("user-1", "visit-1", "bad id with spaces", noteInput(), { db, now: NOW }))).status,
    400
  );
  const badProvenance = await status(
    putFieldVisitNote("user-1", "visit-1", ITEM, noteInput({ provenance: "MADE_UP" }), { db, now: NOW })
  );
  assert.equal(badProvenance.status, 400);
  assert.equal(badProvenance.message, "field.errors.invalid_provenance");
  assert.equal(db.store.notes.length, 0);
});

test("a closed visit is read-only: late sync is refused with 409, not silently accepted", async () => {
  const db = createFieldDb({ visits: [makeVisit({ status: "CLOSED", closedAt: NOW })] });

  const late = await status(putFieldVisitNote("user-1", "visit-1", ITEM, noteInput(), { db, now: NOW }));

  assert.equal(late.status, 409);
  assert.equal(late.message, "field.errors.visit_read_only");
  assert.equal(db.store.notes.length, 0);
});

test("a unique-index race on the same content resolves to the existing row, not an error", async () => {
  const db = createFieldDb({ visits: [makeVisit()] });
  const original = db.fieldVisitNote.findFirst;
  let firstLookup = true;
  // Simulate the parallel-request window: the pre-check sees nothing, the
  // insert then loses the unique race.
  db.fieldVisitNote.findFirst = async (args) => {
    if (firstLookup) {
      firstLookup = false;
      await original.call(db.fieldVisitNote, args);
      await putFieldVisitNote("user-1", "visit-1", ITEM, noteInput(), { db, now: NOW });
      return null;
    }
    return original.call(db.fieldVisitNote, args);
  };

  const raced = await putFieldVisitNote("user-1", "visit-1", ITEM, noteInput(), { db, now: NOW });

  assert.equal(raced.existing, true);
  assert.equal(db.store.notes.length, 1);
});
