/**
 * JTA-V1 (E4) — kohtumise märkme teenusleping.
 *
 * KANDEV ASI SIIN ON KAKS LUBADUST, MIS MÕLEMAD KATKEVAD VAIKSELT:
 *
 *   1. `PRIVAATNE_REFLEKSIOON` ei lähe STAR2-sse kunagi. Kui kihti saab ümber
 *      nimetada, on E6 ekspordikontroll teatrike: kirje liigutatakse
 *      `STAR2_KANTAV`-isse ja läheb välja. Ükski veateade ei tekiks.
 *   2. Päritolu ei tohi kaduda teksti parandamisega (L4) — sama auk mis E3-l.
 *
 * Mõlemad on siin nimeliselt.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { PROVENANCE } from "../../lib/workspaces/provenance.js";
import { CASEWORK_FLAG_KEYS } from "../../lib/casework/flags.js";
import {
  NOTE_LAYER,
  NOTE_LAYERS,
  addEntry,
  createNote,
  getNote,
  isNoteLayer,
  listNotes,
  listTransferableEntries,
  noteLayerLabelKey,
  removeEntry,
  updateEntry
} from "../../lib/casework/caseWorkMeetingNote.js";

const OWNER = "worker_a";
const STRANGER = "worker_b";
const CASE_ID = "case_1";

function withFeatureOn(fn) {
  return async (...args) => {
    const previous = process.env[CASEWORK_FLAG_KEYS.ENABLED];
    process.env[CASEWORK_FLAG_KEYS.ENABLED] = "1";
    try {
      return await fn(...args);
    } finally {
      if (previous === undefined) delete process.env[CASEWORK_FLAG_KEYS.ENABLED];
      else process.env[CASEWORK_FLAG_KEYS.ENABLED] = previous;
    }
  };
}

function db({
  assists = [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "ACTIVE" }],
  preps = [],
  notes = [],
  entries = [],
  beforeTransaction = null
} = {}) {
  let sequence = 0;
  const nextId = (prefix) => `${prefix}_${++sequence}`;

  const matchWhere = (row, where) =>
    Object.entries(where).every(([key, value]) => (value === undefined ? true : row[key] === value));

  const collection = (rows, prefix, defaults = {}) => ({
    async create({ data }) {
      const row = { id: nextId(prefix), createdAt: new Date(), updatedAt: new Date(), ...defaults, ...data };
      rows.push(row);
      return row;
    },
    async findFirst({ where }) {
      return rows.find((row) => matchWhere(row, where)) || null;
    },
    async findMany({ where = {} }) {
      return rows.filter((row) => matchWhere(row, where));
    },
    async updateMany({ where, data }) {
      const matching = rows.filter((row) => matchWhere(row, where));
      for (const row of matching) Object.assign(row, data, { updatedAt: new Date() });
      return { count: matching.length };
    },
    async deleteMany({ where }) {
      const keep = rows.filter((row) => !matchWhere(row, where));
      const removed = rows.length - keep.length;
      rows.length = 0;
      rows.push(...keep);
      return { count: removed };
    }
  });

  const database = {
    notes,
    entries,
    preps,
    async $transaction(callback) {
      if (beforeTransaction) await beforeTransaction();
      return callback(database);
    },
    caseWorkAssist: {
      async findFirst({ where }) {
        return assists.find((row) => row.id === where.id && row.ownerUserId === where.ownerUserId) || null;
      },
      async updateMany({ where }) {
        const matching = assists.filter(
          (row) =>
            row.id === where.id &&
            row.ownerUserId === where.ownerUserId &&
            (where.retentionState === undefined || row.retentionState === where.retentionState)
        );
        return { count: matching.length };
      }
    },
    caseWorkMeetingPrep: collection(preps, "prep"),
    caseWorkMeetingNote: collection(notes, "note"),
    caseWorkMeetingNoteEntry: collection(entries, "entry", { ordinal: 0 })
  };

  return database;
}

async function rejects(promise, status, messageKey) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.status, status, `oodatud ${status}, saadi ${error.status} (${error.messageKey})`);
    if (messageKey) assert.equal(error.messageKey, messageKey);
    return true;
  });
}

async function seed(store, { layer = NOTE_LAYER.FAKTID, provenance = PROVENANCE.TOOTAJA_TAHELEPANEK } = {}) {
  const note = await createNote({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: store });
  const base = { ownerUserId: OWNER, caseWorkAssistId: CASE_ID, meetingNoteId: note.id, db: store };
  const entry = await addEntry({ ...base, layer, text: "rida", provenance });
  return { note, base, entry };
}

/* ── sõnastik ───────────────────────────────────────────────────────────── */

test("kaheksa kihti, ja järjekord on tähendusega", () => {
  assert.equal(NOTE_LAYERS.length, 8);
  /* Kliendi oma sõnad ees, privaatne refleksioon lõpus — mitte tähestikus. */
  assert.equal(NOTE_LAYERS[0], NOTE_LAYER.KLIENDI_VAADE);
  assert.equal(NOTE_LAYERS[7], NOTE_LAYER.PRIVAATNE_REFLEKSIOON);
  assert.equal(isNoteLayer("MUU"), false);
  assert.equal(noteLayerLabelKey("MUU"), null);
  assert.equal(noteLayerLabelKey(NOTE_LAYER.FAKTID), "casework.note.layer_FAKTID");
});

/* ── privaatne refleksioon ──────────────────────────────────────────────── */

test(
  "PRIVAATNE_REFLEKSIOON kirjet ei saa teise kihti tõsta",
  withFeatureOn(async () => {
    const store = db();
    const { base, entry } = await seed(store, { layer: NOTE_LAYER.PRIVAATNE_REFLEKSIOON });

    /* SEE ON SELLE FAILI PÕHJUS. Ilma selle keeluta oleks E6 ekspordikontroll
       ainult teatrike — kirje liigutatakse üle ja läheb välja, ilma et kuskil
       tekiks jälge. */
    await rejects(
      updateEntry({ ...base, entryId: entry.id, layer: NOTE_LAYER.STAR2_KANTAV }),
      409,
      "casework.errors.note_private_layer_locked"
    );
    assert.equal(store.entries[0].layer, NOTE_LAYER.PRIVAATNE_REFLEKSIOON);

    /* Teksti ja järjekorda tohib muuta — keeld käib KIHI, mitte kirje kohta. */
    const edited = await updateEntry({ ...base, entryId: entry.id, text: "parandatud" });
    assert.equal(edited.text, "parandatud");
    assert.equal(edited.layer, NOTE_LAYER.PRIVAATNE_REFLEKSIOON);
  })
);

test(
  "teise kihi kirjet ei saa PRIVAATNE_REFLEKSIOON-iks nimetada",
  withFeatureOn(async () => {
    const store = db();
    const { base, entry } = await seed(store, { layer: NOTE_LAYER.FAKTID });
    /* Keeld on kahesuunaline: vastasel juhul saaks juba jagatud rea „tagasi
       privaatseks" nimetada ja lugeja ajalugu läheks segi. */
    await rejects(
      updateEntry({ ...base, entryId: entry.id, layer: NOTE_LAYER.PRIVAATNE_REFLEKSIOON }),
      409,
      "casework.errors.note_private_layer_locked"
    );
  })
);

test(
  "ekspordilugeja annab AINULT STAR2_KANTAV kirjed",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store, { layer: NOTE_LAYER.PRIVAATNE_REFLEKSIOON });
    await addEntry({ ...base, layer: NOTE_LAYER.STAR2_KANTAV, text: "kantav", provenance: PROVENANCE.DOKUMENDIST });
    await addEntry({ ...base, layer: NOTE_LAYER.KOKKULEPPED, text: "kokkulepe", provenance: PROVENANCE.KLIENDI_OELDUD });

    const { items } = await listTransferableEntries({
      ownerUserId: OWNER,
      caseWorkAssistId: CASE_ID,
      meetingNoteId: base.meetingNoteId,
      db: store
    });

    assert.equal(items.length, 1);
    assert.equal(items[0].layer, NOTE_LAYER.STAR2_KANTAV);
    /* Kihi väärtus on päringus KONSTANDINA, mitte parameetrina — privaatne
       refleksioon ei jõua siia ka siis, kui keegi teda küsib. */
    assert.equal(items.some((row) => row.layer === NOTE_LAYER.PRIVAATNE_REFLEKSIOON), false);
  })
);

/* ── päritolu ja valideerimine ──────────────────────────────────────────── */

test(
  "PATCH koos `provenance` väljaga EI MUUDA märgist",
  withFeatureOn(async () => {
    const store = db();
    const { base, entry } = await seed(store, { provenance: PROVENANCE.AI_MUSTAND });

    const patched = await updateEntry({
      ...base,
      entryId: entry.id,
      text: "töötaja parandas",
      provenance: PROVENANCE.TOOTAJA_TAHELEPANEK
    });
    assert.equal(patched.text, "töötaja parandas");
    assert.equal(patched.provenance, PROVENANCE.AI_MUSTAND, "märgis kadus teksti uuendusega");
  })
);

test(
  "päritoluta ega tundmatu kihiga kirje ei salvestu",
  withFeatureOn(async () => {
    const store = db();
    const note = await createNote({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: store });
    const base = { ownerUserId: OWNER, caseWorkAssistId: CASE_ID, meetingNoteId: note.id, db: store };

    for (const provenance of [null, "", "VALE"]) {
      await rejects(
        addEntry({ ...base, layer: NOTE_LAYER.FAKTID, text: "x", provenance }),
        400,
        "casework.errors.provenance_unknown"
      );
    }
    for (const layer of [null, "", "MUU", "faktid"]) {
      await rejects(
        addEntry({ ...base, layer, text: "x", provenance: PROVENANCE.TOOTAJA_TAHELEPANEK }),
        400,
        "casework.errors.note_layer_unknown"
      );
    }
    await rejects(
      addEntry({ ...base, layer: NOTE_LAYER.FAKTID, text: "   ", provenance: PROVENANCE.TOOTAJA_TAHELEPANEK }),
      400,
      "casework.errors.note_text_required"
    );
    assert.equal(store.entries.length, 0);
  })
);

/* ── ligipääs ───────────────────────────────────────────────────────────── */

test(
  "võõra juhtumi märge annab 404, mitte 403",
  withFeatureOn(async () => {
    const store = db();
    const { base, entry } = await seed(store);

    await rejects(createNote({ ownerUserId: STRANGER, caseWorkAssistId: CASE_ID, db: store }), 404);
    await rejects(listNotes({ ownerUserId: STRANGER, caseWorkAssistId: CASE_ID, db: store }), 404);
    await rejects(getNote({ ...base, ownerUserId: STRANGER }), 404);
    await rejects(removeEntry({ ...base, ownerUserId: STRANGER, entryId: entry.id }), 404);
    assert.equal(store.entries.length, 1);
  })
);

test(
  "võõras kirje annab 404 ka KIHIKONTROLLI ees (E3 õppetund)",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store);

    /* Olematu kirje „privaatseks nimetamine" ei tohi anda 409 — see ütleks, et
       kirje on olemas ja probleem on kihis. Sama viga, mis E3 kinnitamisel
       päris sessioonidega välja tuli. */
    await rejects(
      updateEntry({ ...base, entryId: "puudub", layer: NOTE_LAYER.PRIVAATNE_REFLEKSIOON }),
      404
    );
  })
);

test(
  "kirjutuskaitstud juhtumi märge ei muutu (409) ja L14 jõustub kirjutuse SEES",
  withFeatureOn(async () => {
    const readOnly = db({ assists: [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "READ_ONLY" }] });
    await rejects(createNote({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: readOnly }), 409);

    const assists = [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "ACTIVE" }];
    const racing = db({
      assists,
      beforeTransaction: () => {
        assists[0].retentionState = "READ_ONLY";
      }
    });
    await rejects(createNote({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: racing }), 409);
    assert.equal(racing.notes.length, 0);
  })
);

test(
  "märkme seos ettevalmistusega peab olema SAMAS juhtumis",
  withFeatureOn(async () => {
    const store = db({
      assists: [
        { id: CASE_ID, ownerUserId: OWNER, retentionState: "ACTIVE" },
        { id: "case_2", ownerUserId: OWNER, retentionState: "ACTIVE" }
      ],
      preps: [{ id: "prep_x", caseWorkAssistId: "case_2" }]
    });
    /* Kontrollimata FK laseks siduda kaks juhtumit, mille vahel ei ole mingit
       suhet — ja seos ise oleks siis ainus koht, kus nad kokku puutuvad. */
    await rejects(
      createNote({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, meetingPrepId: "prep_x", db: store }),
      404
    );
    assert.equal(store.notes.length, 0);
  })
);

/* ── elutsükkel ─────────────────────────────────────────────────────────── */

test(
  "märget ei saa kustutada, kirje saab",
  withFeatureOn(async () => {
    const noteService = await import("../../lib/casework/caseWorkMeetingNote.js");
    /* Kustutusoperatsioon ei tohi tekkida ka „sümmeetria pärast": märge on
       kohtumise jälg. */
    assert.equal(noteService.deleteNote, undefined, "märkmel on kustutusoperatsioon");
    assert.equal(noteService.removeNote, undefined, "märkmel on kustutusoperatsioon");

    const store = db();
    const { base, entry } = await seed(store);
    assert.deepEqual(await removeEntry({ ...base, entryId: entry.id }), { ok: true });
    assert.equal(store.entries.length, 0);
    await rejects(removeEntry({ ...base, entryId: entry.id }), 404);
  })
);

test(
  "märge tagastab kirjed ja säilitab kihid eraldi",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store, { layer: NOTE_LAYER.KLIENDI_VAADE });
    await addEntry({ ...base, layer: NOTE_LAYER.FAKTID, text: "fakt", provenance: PROVENANCE.DOKUMENDIST });

    const note = await getNote({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, meetingNoteId: base.meetingNoteId, db: store });
    assert.equal(note.entries.length, 2);
    assert.deepEqual(
      note.entries.map((row) => row.layer).sort(),
      [NOTE_LAYER.FAKTID, NOTE_LAYER.KLIENDI_VAADE].sort()
    );
  })
);

test("värav väljas: ükski operatsioon ei tööta ja vastus on 404", async () => {
  const previous = process.env[CASEWORK_FLAG_KEYS.ENABLED];
  delete process.env[CASEWORK_FLAG_KEYS.ENABLED];
  try {
    const store = db();
    await rejects(createNote({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: store }), 404);
    await rejects(listNotes({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: store }), 404);
    assert.equal(store.notes.length, 0);
  } finally {
    if (previous !== undefined) process.env[CASEWORK_FLAG_KEYS.ENABLED] = previous;
  }
});
