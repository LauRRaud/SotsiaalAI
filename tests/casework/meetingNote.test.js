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
import { readFile } from "node:fs/promises";

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
  NOTE_REVISION_KIND,
  listEntryRevisions,
  retractEntry,
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
  revisions = [],
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

  /**
   * Ajaloorida on MUUTUMATU (SOL-CW-15) ja seda jouustab toodangus andmebaasi
   * `BEFORE UPDATE` trigger. Fake, mis lubaks `updateMany`-t, tahendaks et
   * „append-only" on testis ainult kokkulepe — ja just kokkulepped on need, mis
   * vaikselt katkevad. `deleteMany` on lubatud, sest kaskaad peab labi minema.
   */
  const appendOnly = (rows, prefix) => {
    const base = collection(rows, prefix);
    return {
      create: base.create,
      findFirst: base.findFirst,
      findMany: base.findMany,
      deleteMany: base.deleteMany,
      async updateMany() {
        throw new Error("CaseWorkMeetingNoteEntryRevision rows are immutable");
      }
    };
  };

  const database = {
    notes,
    entries,
    revisions,
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
    caseWorkMeetingNoteEntry: collection(entries, "entry", { ordinal: 0, revision: 1, retractedAt: null }),
    caseWorkMeetingNoteEntryRevision: appendOnly(revisions, "rev")
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
      updateEntry({ ...base, entryId: entry.id, layer: NOTE_LAYER.STAR2_KANTAV, reason: "vale kiht" }),
      409,
      "casework.errors.note_private_layer_locked"
    );
    assert.equal(store.entries[0].layer, NOTE_LAYER.PRIVAATNE_REFLEKSIOON);

    /* Teksti ja järjekorda tohib muuta — keeld käib KIHI, mitte kirje kohta. */
    const edited = await updateEntry({ ...base, entryId: entry.id, text: "parandatud", reason: "kirjaviga" });
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
      updateEntry({ ...base, entryId: entry.id, layer: NOTE_LAYER.PRIVAATNE_REFLEKSIOON, reason: "vale kiht" }),
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
      provenance: PROVENANCE.TOOTAJA_TAHELEPANEK,
      reason: "AI mustand vajas täpsustust"
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
    await rejects(retractEntry({ ...base, ownerUserId: STRANGER, entryId: entry.id, reason: "x" }), 404);
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
      updateEntry({ ...base, entryId: "puudub", layer: NOTE_LAYER.PRIVAATNE_REFLEKSIOON, reason: "x" }),
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
  "SOL-CW-15: kõva kustutust EI OLE — ei märkmel ega kirjel",
  withFeatureOn(async () => {
    const noteService = await import("../../lib/casework/caseWorkMeetingNote.js");
    /* Kustutusoperatsioon ei tohi tekkida ka „sümmeetria pärast": märge on
       kohtumise jälg. */
    assert.equal(noteService.deleteNote, undefined, "märkmel on kustutusoperatsioon");
    assert.equal(noteService.removeNote, undefined, "märkmel on kustutusoperatsioon");
    /* JA KIRJEL SAMUTI MITTE. `removeEntry()` tegi `deleteMany`-t: kõik read
       sai ükshaaval ära võtta ja alles jäi tühi konteiner, mis näis endiselt
       kohtumise tõendina. */
    assert.equal(noteService.removeEntry, undefined, "kirje kõva kustutus on tagasi");
    assert.equal(noteService.deleteEntry, undefined, "kirje kõva kustutus on tagasi");
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

/* ── SOL-CW-15: parandus ja tühistus jätavad jälje ──────────────────────── */

test(
  "SOL-CW-15: parandus säilitab eelmise versiooni, tegija, aja ja põhjuse",
  withFeatureOn(async () => {
    /* Varem asendas `updateEntry()` teksti jäljetult: kohtumise tõendit sai
       ümber kirjutada ja miski ei eristanud eksituse parandamist sisu
       muutmisest. */
    const store = db();
    const { base, entry } = await seed(store);

    const edited = await updateEntry({
      ...base,
      entryId: entry.id,
      text: "klient ütles hoopis teisiti",
      reason: "kirjutasin valesti üles"
    });

    assert.equal(edited.text, "klient ütles hoopis teisiti");
    assert.equal(edited.revision, 2, "versiooniloendur ei kasvanud");

    assert.equal(store.revisions.length, 1);
    const [history] = store.revisions;
    assert.equal(history.kind, NOTE_REVISION_KIND.CORRECTION);
    assert.equal(history.text, "rida", "ajalugu ei kanna ASENDATUD teksti");
    assert.equal(history.revision, 1, "ajalugu peab ütlema, MITMES versioon asendati");
    assert.equal(history.reason, "kirjutasin valesti üles");
    assert.equal(history.actorUserId, OWNER);
    assert.equal(history.layer, NOTE_LAYER.FAKTID, "kiht peab kaasa käima, muidu ei saa vana rida taastada");
    assert.equal(history.provenance, PROVENANCE.TOOTAJA_TAHELEPANEK);
    assert.ok(history.createdAt instanceof Date);
  })
);

test(
  "SOL-CW-15: parandus ILMA põhjuseta ei lähe läbi ega jäta poolikut jälge",
  withFeatureOn(async () => {
    const store = db();
    const { base, entry } = await seed(store);

    for (const reason of [undefined, null, "", "   "]) {
      await rejects(
        updateEntry({ ...base, entryId: entry.id, text: "uus", reason }),
        400,
        "casework.errors.note_reason_required"
      );
    }
    assert.equal(store.entries[0].text, "rida", "tekst muutus ilma põhjuseta");
    assert.equal(store.revisions.length, 0);

    await rejects(
      retractEntry({ ...base, entryId: entry.id, reason: "  " }),
      400,
      "casework.errors.note_reason_required"
    );
    assert.equal(store.entries[0].retractedAt ?? null, null);
  })
);

test(
  "SOL-CW-15: KORDUV parandus ei kirjuta esimest üle — algne sisu jääb alles",
  withFeatureOn(async () => {
    /* Üks „eelmine tekst" väli oleks siin katki läinud: teine parandus kirjutaks
       esimese üle ja algne versioon kaoks just siis, kui teda kõige rohkem vaja
       on — korduvalt muudetud rea juures. */
    const store = db();
    const { base, entry } = await seed(store);

    await updateEntry({ ...base, entryId: entry.id, text: "teine", reason: "esimene parandus" });
    await updateEntry({ ...base, entryId: entry.id, text: "kolmas", reason: "teine parandus" });

    assert.equal(store.entries[0].revision, 3);
    assert.equal(store.revisions.length, 2);
    assert.deepEqual(
      store.revisions.map((row) => [row.revision, row.text]),
      [
        [1, "rida"],
        [2, "teine"]
      ],
      "ajaloost ei saa algset teksti enam kätte"
    );
  })
);

test(
  "SOL-CW-15: tühistus jätab rea alles, tekst kaob pinnalt ja seisab ajaloos",
  withFeatureOn(async () => {
    const store = db();
    const { base, entry } = await seed(store);

    const retracted = await retractEntry({
      ...base,
      entryId: entry.id,
      reason: "see lause ei olnud kliendi oma"
    });

    assert.ok(retracted.retractedAt, "rida ei ole tühistatud");
    assert.equal(retracted.text, null, "tühistatud rida kannab endiselt oma teksti");
    assert.equal(store.entries.length, 1, "rida kustutati andmebaasist");
    assert.equal(store.entries[0].text, "rida", "sisu ei ole enam taastatav");

    assert.equal(store.revisions.length, 1);
    assert.equal(store.revisions[0].kind, NOTE_REVISION_KIND.RETRACTION);
    assert.equal(store.revisions[0].text, "rida");
    assert.equal(store.revisions[0].reason, "see lause ei olnud kliendi oma");
  })
);

test(
  "SOL-CW-15: tühistatud kirjet ei saa parandada ega teist korda tühistada",
  withFeatureOn(async () => {
    const store = db();
    const { base, entry } = await seed(store);
    await retractEntry({ ...base, entryId: entry.id, reason: "eksitus" });

    await rejects(
      updateEntry({ ...base, entryId: entry.id, text: "tagaukse tekst", reason: "põhjus" }),
      409,
      "casework.errors.note_entry_retracted"
    );
    /* Teine tühistus näitaks auditis kahte tegu seal, kus oli üks. */
    await rejects(
      retractEntry({ ...base, entryId: entry.id, reason: "uuesti" }),
      409,
      "casework.errors.note_entry_retracted"
    );
    assert.equal(store.revisions.length, 1);
  })
);

test(
  "SOL-CW-15: KÕIK read tühistatud — märge EI OLE tühi puutumata konteiner",
  withFeatureOn(async () => {
    /* See on auditi nõutud negatiivtest. Vana teostusega jäi pärast kõigi ridade
       kustutamist alles tühi märge, mis näis endiselt kohtumise tõendina, ja
       algne sisu oli jäädavalt kadunud. */
    const store = db();
    const { base } = await seed(store, { layer: NOTE_LAYER.KLIENDI_VAADE });
    await addEntry({ ...base, layer: NOTE_LAYER.FAKTID, text: "fakt", provenance: PROVENANCE.DOKUMENDIST });
    await addEntry({
      ...base,
      layer: NOTE_LAYER.KOKKULEPPED,
      text: "kokkulepe",
      provenance: PROVENANCE.KLIENDI_OELDUD
    });

    for (const row of [...store.entries]) {
      await retractEntry({ ...base, entryId: row.id, reason: "kohtumine jäi ära" });
    }

    const note = await getNote({
      ownerUserId: OWNER,
      caseWorkAssistId: CASE_ID,
      meetingNoteId: base.meetingNoteId,
      db: store
    });

    /* 1. Read on ALLES ja nad ütlevad, et nad on tagasi võetud. */
    assert.equal(note.entries.length, 3, "tühistatud read kadusid — märge näib puutumata");
    assert.equal(note.entries.every((row) => Boolean(row.retractedAt)), true);
    assert.equal(note.entries.every((row) => row.text === null), true, "tühistatud tekst on ikka pinnal");

    /* 2. Algne sisu on TAASTATAV lubatud kujul: paranduste ajaloost. */
    const { items } = await listEntryRevisions({
      ownerUserId: OWNER,
      caseWorkAssistId: CASE_ID,
      meetingNoteId: base.meetingNoteId,
      db: store
    });
    assert.equal(items.length, 3);
    assert.deepEqual(
      items.map((row) => row.text).sort(),
      ["fakt", "kokkulepe", "rida"],
      "algne sisu ei ole ajaloost taastatav"
    );
    assert.equal(items.every((row) => row.kind === NOTE_REVISION_KIND.RETRACTION), true);
    assert.equal(items.every((row) => row.reason === "kohtumine jäi ära"), true);
  })
);

test(
  "SOL-CW-15: tühistatud STAR2_KANTAV kirje EI LÄHE ekspordisse",
  withFeatureOn(async () => {
    /* Tagasivõetud lause kandmine registrisse oleks tühistuse vaikne
       tühistamine — ja piir on `WHERE`-is, mitte kutsuja pool. */
    const store = db();
    const { base } = await seed(store, { layer: NOTE_LAYER.STAR2_KANTAV });
    const teine = await addEntry({
      ...base,
      layer: NOTE_LAYER.STAR2_KANTAV,
      text: "jääb kehtima",
      provenance: PROVENANCE.DOKUMENDIST
    });

    await retractEntry({ ...base, entryId: store.entries[0].id, reason: "vale info" });

    const { items } = await listTransferableEntries({
      ownerUserId: OWNER,
      caseWorkAssistId: CASE_ID,
      meetingNoteId: base.meetingNoteId,
      db: store
    });
    assert.equal(items.length, 1);
    assert.equal(items[0].id, teine.id);
  })
);

test(
  "SOL-CW-15: ajalugu on omanikupiiri sees ja kirjutusteed tal ei ole",
  withFeatureOn(async () => {
    const store = db();
    const { base, entry } = await seed(store);
    await updateEntry({ ...base, entryId: entry.id, text: "uus", reason: "parandus" });

    await rejects(
      listEntryRevisions({
        ownerUserId: STRANGER,
        caseWorkAssistId: CASE_ID,
        meetingNoteId: base.meetingNoteId,
        db: store
      }),
      404
    );

    /* Muutumatust jõustab toodangus andmebaasi trigger; fake jäljendab teda ja
       see kutse tõendab, et teenuskiht ajaloorida EI uuenda. */
    await assert.rejects(
      () => store.caseWorkMeetingNoteEntryRevision.updateMany({ where: { id: store.revisions[0].id }, data: {} }),
      /immutable/
    );
  })
);

test(
  "SOL-CW-15: paralleelne parandus ei kaota teise teksti vaikselt",
  withFeatureOn(async () => {
    /* Kaks parandust, mis loevad sama versiooni, kirjutaksid ilma CAS-ita kaks
       ajaloorida sama numbri alla ja teine kaotaks esimese teksti. */
    const store = db();
    const { base, entry } = await seed(store);

    const original = store.caseWorkMeetingNoteEntry.findFirst;
    let raced = false;
    store.caseWorkMeetingNoteEntry.findFirst = async (args) => {
      const row = await original(args);
      if (!raced && row?.revision === 1) {
        raced = true;
        /* Lugemine andis hetktõmmise; ALLES SEEJÄREL jõudis „teine sessioon"
           vahele ja parandas rea ära. Koopia on kohustuslik — fake tagastab
           elava objekti ja ilma temata näeks kutsuja juba uut versiooni, mis
           tähendaks, et test mõõdaks fake'i, mitte võidujooksu. */
        const snapshot = { ...row };
        store.entries[0].revision = 2;
        store.entries[0].text = "teise sessiooni tekst";
        return snapshot;
      }
      return row;
    };

    await rejects(
      updateEntry({ ...base, entryId: entry.id, text: "minu tekst", reason: "parandus" }),
      409,
      "casework.errors.note_entry_changed"
    );
    store.caseWorkMeetingNoteEntry.findFirst = original;
    assert.equal(store.entries[0].text, "teise sessiooni tekst", "teise sessiooni parandus kirjutati üle");
  })
);

test("SOL-CW-15: muutumatus ja kohustuslik põhjus on ANDMEBAASIS, mitte ainult teenuskihis", async () => {
  /* Teenuskihi kontroll kaitseb ainult neid teid, mis temast läbi käivad.
     Otse-SQL, tulevane teine kutsuja ja migratsioonijärgne skript ei käi. */
  const sql = await readFile(
    new URL("../../prisma/migrations/20260809160000_jta_v1_note_entry_revisions/migration.sql", import.meta.url),
    "utf8"
  );
  assert.match(sql, /CREATE TRIGGER "CaseWorkMeetingNoteEntryRevision_prevent_update"/);
  assert.match(sql, /BEFORE UPDATE ON "CaseWorkMeetingNoteEntryRevision"/);
  assert.doesNotMatch(sql, /BEFORE DELETE ON "CaseWorkMeetingNoteEntryRevision"/, "kaskaad peab läbi minema");
  assert.match(sql, /CHECK \(btrim\("reason"\) <> ''\)/);
  assert.match(sql, /ADD COLUMN "retractedAt"/);
  assert.match(sql, /ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1/);
});
