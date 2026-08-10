import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { FIELD_PROVENANCE } from "../../lib/field/constants.js";
import { confirmFieldTranscript } from "../../lib/field/attachments.js";
import { putFieldVisitNote } from "../../lib/field/service.js";
import { createFieldDb, makeVisit } from "../helpers/fieldDb.mjs";

/**
 * SOL-FIELD-05 — TEKSTI VASTUVÕTMINE JA TOORHELI KELL ON ÜKS TOIMING.
 *
 * Vana kest tegi kaks päringut: märge läks sünkroonijärjekorda ja
 * `confirmTranscript` läks kohe, `.catch(() => {})` sees, `response.ok` väärtust
 * vaatamata. Kui teine kukkus, oli kinnitatud tekst serveris olemas, toorheli
 * jäi aga kuni 7-päevase varutähtajani — ja liides ütles, et kõik õnnestus.
 *
 * Kaks tõde ühest toimingust ei tohi lahkneda. Siin mõõdetakse just seda.
 */

const NOW = new Date("2026-08-10T09:00:00.000Z");

const audio = (overrides = {}) => ({
  id: "att-audio",
  visitId: "visit-1",
  clientItemId: "fld-audio-000001",
  role: "audio",
  documentId: "doc-1",
  transcriptConfirmedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides
});

const draft = (overrides = {}) => ({
  kind: "note",
  provenance: FIELD_PROVENANCE.AI_MUSTAND,
  body: "Transkriptist kinnitatud tekst.",
  revision: 1,
  aiConfirmed: true,
  transcriptClientItemId: "fld-audio-000001",
  ...overrides
});

const confirmedAt = (db) => db.store.attachments[0]?.transcriptConfirmedAt || null;

test("kinnitatud tekst käivitab toorheli kella SAMAS toimingus", async () => {
  const db = createFieldDb({ visits: [makeVisit()], attachments: [audio()] });

  const result = await putFieldVisitNote("user-1", "visit-1", "fld-note-000001", draft(), { db, now: NOW });

  assert.equal(result.created, true);
  assert.equal(db.store.notes.length, 1);
  assert.equal(confirmedAt(db)?.toISOString(), NOW.toISOString(), "kell pidi käivituma");
});

/* SEE ON LEID ISE: kui tekst ei jõua serverisse, EI TOHI ka kell käivituda —
   ja vastupidi. Kaks tõde ühest toimingust ei tohi lahkneda. */
test("kui teksti vastuvõtmine kukub, jääb toorheli kell käivitamata", async () => {
  const db = createFieldDb({ visits: [makeVisit()], attachments: [audio()] });
  db.fieldVisitNote.create = async () => {
    throw new Error("write_failed");
  };

  await assert.rejects(
    putFieldVisitNote("user-1", "visit-1", "fld-note-000001", draft(), { db, now: NOW }),
    /write_failed/
  );

  assert.equal(confirmedAt(db), null, "kell ei tohi käivituda ilma vastuvõetud tekstita");
  assert.equal(db.store.notes.length, 0);
});

test("ilma AI-kinnituseta märge ei puutu toorheli kella", async () => {
  const db = createFieldDb({ visits: [makeVisit()], attachments: [audio()] });

  await putFieldVisitNote(
    "user-1",
    "visit-1",
    "fld-note-000001",
    draft({ aiConfirmed: false, provenance: FIELD_PROVENANCE.TOOTAJA_TAHELEPANEK }),
    { db, now: NOW }
  );

  assert.equal(confirmedAt(db), null);
});

test("kadunud salvestis EI OLE viga — kustutada ei ole midagi", async () => {
  const db = createFieldDb({ visits: [makeVisit()] });

  const result = await putFieldVisitNote("user-1", "visit-1", "fld-note-000001", draft(), { db, now: NOW });

  assert.equal(result.created, true, "märge on kasutaja sisu ja ta ei tohi kaduda viite pärast");
});

test("kordus on idempotentne: kell ei liigu teisel saatmisel", async () => {
  const db = createFieldDb({ visits: [makeVisit()], attachments: [audio()] });

  await putFieldVisitNote("user-1", "visit-1", "fld-note-000001", draft(), { db, now: NOW });
  const first = confirmedAt(db);

  const later = new Date(NOW.getTime() + 3600 * 1000);
  const repeat = await putFieldVisitNote("user-1", "visit-1", "fld-note-000001", draft(), { db, now: later });

  assert.equal(repeat.existing, true, "sama sisu kordus on olemasolev kirje");
  assert.equal(confirmedAt(db)?.toISOString(), first?.toISOString(), "kell ei tohi teisel korral liikuda");
});

test("järgmise revisjoni kinnitamine käivitab kella, kui ta veel seisab", async () => {
  const db = createFieldDb({ visits: [makeVisit()], attachments: [audio()] });
  await putFieldVisitNote(
    "user-1",
    "visit-1",
    "fld-note-000001",
    draft({ aiConfirmed: false, transcriptClientItemId: null }),
    { db, now: NOW }
  );
  assert.equal(confirmedAt(db), null);

  const later = new Date(NOW.getTime() + 60 * 1000);
  await putFieldVisitNote(
    "user-1",
    "visit-1",
    "fld-note-000001",
    draft({ revision: 2, body: "Parandatud tekst." }),
    { db, now: later }
  );

  assert.equal(confirmedAt(db)?.toISOString(), later.toISOString());
});

/* Taastetee jääb alles ja on nüüd idempotentne: kordus ei liiguta kella ega
   vasta 404-ga, sest soovitud seis on juba käes. */
test("otsene kinnitustee: kordus ei liiguta kella ega anna 404-t", async () => {
  const db = createFieldDb({ visits: [makeVisit()], attachments: [audio()] });

  const first = await confirmFieldTranscript("user-1", "visit-1", "fld-audio-000001", { db, now: NOW });
  assert.deepEqual(first, { confirmed: true });
  const stamped = confirmedAt(db);

  const later = new Date(NOW.getTime() + 3600 * 1000);
  const second = await confirmFieldTranscript("user-1", "visit-1", "fld-audio-000001", { db, now: later });
  assert.equal(second.confirmed, true);
  assert.equal(second.alreadyConfirmed, true);
  assert.equal(confirmedAt(db)?.toISOString(), stamped?.toISOString());
});

test("otsene kinnitustee tundmatu salvestise kohta on endiselt 404", async () => {
  const db = createFieldDb({ visits: [makeVisit()] });
  await assert.rejects(
    confirmFieldTranscript("user-1", "visit-1", "fld-audio-000009", { db, now: NOW }),
    /not_found/
  );
});

/**
 * Kesta ja mootori side, mida ühiktest renderdada ei saa. Ta kukub, kui keegi
 * toob teise päringu või tingimusteta eduteate tagasi.
 */
test("kest ei tee enam teist päringut ega anna eduteadet ette", () => {
  const room = readFileSync(new URL("../../components/field/FieldVisitRoom.jsx", import.meta.url), "utf8");
  const start = room.indexOf("const confirmAiDraft");
  const confirm = room.slice(start, room.indexOf("const doHandover", start));

  assert.ok(start > -1, "kinnitusrada peab olemas olema");
  assert.equal(/confirmTranscript/.test(confirm), false, "eraldi kinnituspäringut ei tohi olla");
  assert.equal(/\.catch\(\(\) => \{\}\)/.test(confirm), false, "viga ei tohi neelata");
  assert.ok(/transcriptClientItemId/.test(confirm), "kinnitus peab rändama märkme endaga");
  assert.ok(
    /FIELD_ITEM_STATE\.SYNCED.*field\.ai\.confirmed/s.test(confirm),
    "eduteade tohib tulla ainult serveri vastuse järel"
  );

  const hook = readFileSync(new URL("../../components/field/useFieldSync.js", import.meta.url), "utf8");
  assert.ok(
    /return storeRef\.current\?\.getItem\(clientItemId\)/.test(hook),
    "approveItem peab tagastama lõppseisu, muidu ei saa ausat teadet anda"
  );

  for (const locale of ["et", "en", "ru"]) {
    const messages = JSON.parse(readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8"));
    for (const key of ["confirmed", "confirmQueued", "confirmFailed"]) {
      assert.equal(typeof messages.field?.ai?.[key], "string", `${locale}: field.ai.${key}`);
    }
  }
});
