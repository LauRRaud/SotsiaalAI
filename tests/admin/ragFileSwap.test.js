/**
 * SOL-RAGADMIN-01 — faili ja metadata olekumuutuse taastatav protokoll.
 *
 * MIDA SIIN TÕENDATAKSE. Leid ei olnud „koristus puudub" — koristus oli olemas
 * ja just tema tegi kahju. Asendamine kirjutas DB-le uue tee, kustutas vana
 * faili ja tegi seejärel veel mitu ebaõnnestuda võivat sammu; `catch` kustutas
 * **uue faili**. Üks tõrge hilisemas sammus jättis järele DB-rea, mis osutab
 * olematule failile — ja kumbagi faili enam ei olnud.
 *
 * TESTI KUJU TULEB KRITEERIUMIST: „veasüstetestid peavad katkestama IGA SAMMU
 * JÄREL ja tõendama, et aktiivne kirje osutab alati olemasolevale failile."
 * Seepärast on siin maailmamudel (failid + kirje) ja iga stsenaarium lõpeb SAMA
 * kontrolliga — `assertInvariant()`.
 *
 * NEGATIIVKONTROLL ON SISSE EHITATUD: sama veasüst käib läbi ka VANA raja
 * (`legacyReplace`) ja seal peab invariant KATKEMA. Ilma selleta ei tõendaks
 * roheline sviit, et stsenaarium leidu üldse reprodutseerib.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { afterCommit, commitFileRemoval, commitFileSwap, RAG_ADMIN_FILE_RESOURCE } from "../../lib/admin/rag/fileSwap.js";
import { createDeletionJobRetryService } from "../../lib/privacy/deletionJobRetryService.js";

/** Maailm: failisüsteem + üks aktiivne kirje. */
function world({ activePath = "vana.txt" } = {}) {
  return {
    files: new Set([activePath].filter(Boolean)),
    record: activePath ? { storagePath: activePath } : null,
    orphans: []
  };
}

function deleteFileFrom(state, { failOn = null } = {}) {
  return async path => {
    if (failOn && path === failOn) {
      const error = new Error("unlink failed");
      error.code = "EACCES";
      throw error;
    }
    state.files.delete(path);
  };
}

/**
 * INVARIANT: aktiivne kirje osutab alati olemasolevale failile.
 * Kirje puudumine on korras — kustutamine ongi lubatud lõppseis.
 */
function assertInvariant(state, label) {
  if (!state.record) return;
  assert.ok(
    state.files.has(state.record.storagePath),
    `${label}: kirje osutab failile, mida ei ole (${state.record.storagePath}); alles: [${[...state.files].join(",")}]`
  );
}

/** VANA rada, sõna-sõnalt nii nagu ta enne SOL-RAGADMIN-01 oli. */
async function legacyReplace(state, { newPath, afterSwapThrows = false }) {
  state.files.add(newPath);
  const previous = state.record?.storagePath || null;
  try {
    state.record = { storagePath: newPath };
    if (previous) state.files.delete(previous);
    if (afterSwapThrows) throw new Error("sünkroniseerimine kukkus");
  } catch (error) {
    /* Vana `catch`: kustuta uus fail — ka siis, kui DB temale juba osutab. */
    state.files.delete(newPath);
    throw error;
  }
}

/**
 * Orvu kirjapanek on SÜSTITUD: vaikimisi kirjutaks ta päris `DataDeletionJob`
 * rea ja test mõõdaks andmebaasiühendust, mitte protokolli.
 */
const collectOrphans = state => async entry => {
  state.orphans.push(entry);
  return { id: `job_${state.orphans.length}` };
};

const swapArgs = state => ({
  deleteFile: deleteFileFrom(state),
  recordOrphan: collectOrphans(state),
  resourceType: RAG_ADMIN_FILE_RESOURCE.KOV,
  resourceId: "kov_1"
});

/* ── 1. tõrge ENNE vahetuspunkti ────────────────────────────────────────── */

test("SOL-RAGADMIN-01: DB-kirjutuse tõrge jätab vana faili puutumata ja koristab uue", async () => {
  const state = world();
  state.files.add("uus.txt");

  await assert.rejects(
    commitFileSwap({
      ...swapArgs(state),
      commit: async () => {
        throw new Error("DB kukkus");
      },
      newStoragePath: "uus.txt",
      previousStoragePath: "vana.txt"
    }),
    /DB kukkus/
  );

  assert.ok(state.files.has("vana.txt"), "vana fail kustutati enne vahetuspunkti");
  assert.ok(!state.files.has("uus.txt"), "uut faili ei koristatud");
  assertInvariant(state, "1");
});

/* ── 2. tõrge PÄRAST vahetuspunkti — leiu tuum ──────────────────────────── */

test("SOL-RAGADMIN-01: vahetuspunkti JÄRGNE tõrge ei hävita uut faili", async () => {
  const state = world();
  state.files.add("uus.txt");

  await commitFileSwap({
    ...swapArgs(state),
    commit: async () => {
      state.record = { storagePath: "uus.txt" };
    },
    newStoragePath: "uus.txt",
    previousStoragePath: "vana.txt"
  });

  /* Järeltegevus kukub — täpselt see samm, mis vanas rajas viis mõlema faili
     hävitamiseni. */
  const result = await afterCommit("sync", async () => {
    throw new Error("sünkroniseerimine kukkus");
  });

  assert.equal(result, null, "järeltegevuse tõrge ei tohi erindina välja pääseda");
  assert.ok(state.files.has("uus.txt"), "uus fail hävitati vahetuspunkti JÄREL");
  assert.ok(!state.files.has("vana.txt"), "vana fail jäi koristamata");
  assertInvariant(state, "2");
});

test("SOL-RAGADMIN-01: NEGATIIVKONTROLL — VANA rada rikub invariandi sama süsti peal", async () => {
  const state = world();

  await assert.rejects(legacyReplace(state, { newPath: "uus.txt", afterSwapThrows: true }));

  /* Kirje osutab `uus.txt`-le, aga teda ei ole — ja `vana.txt` on samuti läinud. */
  assert.equal(state.record.storagePath, "uus.txt");
  assert.ok(!state.files.has("uus.txt"));
  assert.ok(!state.files.has("vana.txt"));
  assert.throws(
    () => assertInvariant(state, "negatiiv"),
    /kirje osutab failile, mida ei ole/,
    "vana rada EI rikkunud invarianti — süst ei reprodutseeri leidu"
  );
});

/* ── 3. vana faili koristuse tõrge ──────────────────────────────────────── */

test("SOL-RAGADMIN-01: vana faili koristuse tõrge EI kukuta päringut, vaid jätab orvu", async () => {
  const state = world();
  state.files.add("uus.txt");

  const result = await commitFileSwap({
    ...swapArgs(state),
    deleteFile: deleteFileFrom(state, { failOn: "vana.txt" }),
    commit: async () => {
      state.record = { storagePath: "uus.txt" };
    },
    newStoragePath: "uus.txt",
    previousStoragePath: "vana.txt"
  });

  /* DB on juba õige, seega see ei ole päringu viga — ta on koristusvõlg. */
  assert.equal(result.committed, true);
  assert.equal(result.orphanedPath, "vana.txt");
  assert.ok(state.files.has("uus.txt"));
  assertInvariant(state, "3");

  /* ORB EI KAO VAIKSELT: tema kohta peab jääma püsiv, uuesti proovitav rida. */
  assert.equal(state.orphans.length, 1, "orvu kohta ei jäänud ühtegi rida");
  assert.equal(state.orphans[0].storagePath, "vana.txt");
  assert.equal(state.orphans[0].resourceType, RAG_ADMIN_FILE_RESOURCE.KOV);
});

/* ── 4. kustutamine ─────────────────────────────────────────────────────── */

test("SOL-RAGADMIN-01: DB-rea eemalduse tõrge jätab faili ALLES", async () => {
  const state = world();

  await assert.rejects(
    commitFileRemoval({
      ...swapArgs(state),
      removeRecord: async () => {
        throw new Error("DB kukkus");
      },
      storagePath: "vana.txt"
    }),
    /DB kukkus/
  );

  assert.ok(state.files.has("vana.txt"), "fail kustutati enne DB-rida — kirje osutaks olematule failile");
  assertInvariant(state, "4");
});

test("SOL-RAGADMIN-01: faili koristuse tõrge kustutamisel jätab ORVU, mitte katkise kirje", async () => {
  const state = world();

  const result = await commitFileRemoval({
    ...swapArgs(state),
    deleteFile: deleteFileFrom(state, { failOn: "vana.txt" }),
    removeRecord: async () => {
      state.record = null;
    },
    storagePath: "vana.txt"
  });

  assert.equal(result.removed, true);
  assert.equal(result.orphanedPath, "vana.txt");
  assert.equal(state.record, null, "kirje jäi alles");
  assert.equal(state.orphans.length, 1, "orvu kohta ei jäänud ühtegi rida");
  /* Orb fail on ohutu: talle ei osuta keegi. Kirje ilma failita ei ole ohutu. */
  assertInvariant(state, "5");
});

/* ── 5. esmane üleslaadimine ────────────────────────────────────────────── */

test("SOL-RAGADMIN-01: esimene fail (vana puudub) käib sama protokolli läbi", async () => {
  const state = world({ activePath: null });
  state.files.add("uus.txt");

  const result = await commitFileSwap({
    ...swapArgs(state),
    commit: async () => {
      state.record = { storagePath: "uus.txt" };
    },
    newStoragePath: "uus.txt",
    previousStoragePath: null
  });

  assert.equal(result.orphanedPath, null);
  assertInvariant(state, "6");
});

/* ── 6. orb peab olema PÄRISELT koristatav ──────────────────────────────── */

function retryDb(job) {
  const rows = new Map([[job.id, { ...job }]]);
  const audits = [];
  const db = {
    rows,
    audits,
    dataAuditLog: {
      async create({ data }) {
        audits.push(data);
        return data;
      }
    },
    dataDeletionJob: {
      async findUnique({ where }) {
        return rows.get(where.id) || null;
      },
      async update({ where, data }) {
        const current = rows.get(where.id);
        const next = {
          ...current,
          ...data,
          attempts: data.attempts?.increment ? current.attempts + data.attempts.increment : current.attempts
        };
        rows.set(where.id, next);
        return next;
      }
    }
  };
  db.$transaction = fn => fn(db);
  return db;
}

test("SOL-RAGADMIN-01: orb KOV-fail jõuab KOV-kustutajani, mitte dokumendirajale", async () => {
  /* SEE ON MÕÕDETUD, MITTE OLETATUD: KOV-failid elavad `<docs>/kov/…` all, aga
     `deleteDocument` jõustab tee `<docs>/uploads/` sees ja viskaks
     `storage_path_invalid`. Ilma oma haruta oleks orbude järjekord selline, mis
     EI SAA kunagi tühjeneda — järelevalve, mis näeb välja nagu töötav. */
  const job = {
    id: "job_1",
    action: "FILE_DELETE",
    resourceType: RAG_ADMIN_FILE_RESOURCE.KOV,
    storagePath: "kov/harku/abc.txt",
    attempts: 0
  };
  const db = retryDb(job);
  const seen = { admin: [], document: [] };

  const retry = createDeletionJobRetryService({
    db,
    deleteDocument: async path => {
      seen.document.push(path);
    },
    deleteMaterial: async () => {},
    deleteRag: async () => ({ ok: true }),
    deleteRagAdminFile: async entry => {
      seen.admin.push(entry.storagePath);
      return true;
    },
    deleteUser: async () => {}
  });

  await retry({ jobId: "job_1", actorUserId: "admin_1" });

  assert.deepEqual(seen.admin, ["kov/harku/abc.txt"], "KOV-orb ei jõudnud KOV-kustutajani");
  assert.deepEqual(seen.document, [], "KOV-orb suunati dokumendirajale, mis viskaks storage_path_invalid");
  assert.equal(db.rows.get("job_1").status, "done");
});

test("SOL-RAGADMIN-01: tundmatu tüüp EI lähe vaikselt läbi, vaid jätkab dokumendirajal", async () => {
  /* Vaikne `true` kataks kirjaviga tüübinimes kinni ja fail jääks igaveseks. */
  const job = {
    id: "job_2",
    action: "FILE_DELETE",
    resourceType: "UserDocument",
    storagePath: "uploads/x.txt",
    attempts: 0
  };
  const db = retryDb(job);
  const seen = { admin: [], document: [] };

  const retry = createDeletionJobRetryService({
    db,
    deleteDocument: async path => {
      seen.document.push(path);
    },
    deleteMaterial: async () => {},
    deleteRag: async () => ({ ok: true }),
    deleteRagAdminFile: async () => false,
    deleteUser: async () => {}
  });

  await retry({ jobId: "job_2", actorUserId: "admin_1" });

  assert.deepEqual(seen.document, ["uploads/x.txt"]);
  assert.deepEqual(seen.admin, []);
});

test("SOL-RAGADMIN-01: sama tee iseenda asendamisel ei kustuta äsja kirjutatut", async () => {
  /* Kaitse selle vastu, et keegi kunagi ehitab determinstliku failitee: siis
     oleks `previous === new` ja koristus hävitaks just kirjutatud faili. */
  const state = world({ activePath: "sama.txt" });

  const result = await commitFileSwap({
    ...swapArgs(state),
    commit: async () => {
      state.record = { storagePath: "sama.txt" };
    },
    newStoragePath: "sama.txt",
    previousStoragePath: "sama.txt"
  });

  assert.equal(result.orphanedPath, null);
  assert.ok(state.files.has("sama.txt"), "asendamine iseendaga hävitas faili");
  assertInvariant(state, "7");
});
