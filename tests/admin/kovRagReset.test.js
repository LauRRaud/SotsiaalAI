/**
 * SOL-RAGADMIN-02 — KOV RAG reset ei tohi raporteerida edu, kui dokument jäi alles.
 *
 * MIDA SIIN TÕENDATAKSE. Reset kogus `deleteRagDocument()` tõrked massiivi ja
 * jätkas: arhiveeris snapshot'id, viis admini oleku „mitte-ingestitud" seisu ja
 * tagastas `ok: true`. Dokument jäi RAG-teenuses aktiivseks — andmebaas ja admin
 * väitsid puhtamat maailma, kui päriselt oli.
 *
 * TESTI KUJU TULEB KRITEERIUMIST: „negatiivne test peab sundima ühe dokumendi
 * kustutuse ebaõnnestuma ja tõendama serveri ning UI ausa osalise vea." Seepärast
 * on siin maailmamudel (RAG-dokumendid + DB olek) ja iga stsenaarium lõpeb SAMA
 * kontrolliga — `assertInvariant()`.
 *
 * NEGATIIVKONTROLL ON SISSE EHITATUD: sama veasüst käib läbi ka VANA raja
 * (`legacyReset`) ja seal peab invariant KATKEMA. Ilma selleta ei tõendaks
 * roheline sviit, et süst leidu üldse reprodutseerib.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { describeKovRagResetOutcome } from "../../components/admin/rag/kov/ragResetMessage.js";
import {
  commitRagReset,
  queueRagDocumentDeleteRetry,
  RAG_RESET_PARTIAL,
  RAG_RESET_RETRY_JOB
} from "../../lib/admin/rag/kov/ragResetProtocol.js";
import { createDeletionJobRetryService } from "../../lib/privacy/deletionJobRetryService.js";

/** Maailm: RAG-teenuse dokumendid + KOV admini/snapshot'ide olek. */
function world({ docs = ["kov-harku", "kov-rt-harku"] } = {}) {
  return {
    ragDocs: new Set(docs),
    /* `true` = snapshot'id arhiveeritud ja admini rida lähtestatud, ehk
       „pakett on puhas". */
    dbSaysReset: false,
    commits: 0,
    jobs: []
  };
}

/**
 * INVARIANT: admini olek ei tohi kunagi väita puhtamat maailma, kui RAG-is
 * päriselt on. Ingestitud olek koos allesjäänud dokumentidega on korras — see
 * ongi tõsi.
 */
function assertInvariant(state, label) {
  if (!state.dbSaysReset) return;
  assert.equal(
    state.ragDocs.size,
    0,
    `${label}: DB ütleb „lähtestatud", aga RAG-is on alles [${[...state.ragDocs].join(",")}]`
  );
}

function deleteFrom(state, { failOn = null } = {}) {
  return async docId => {
    if (failOn && docId === failOn) {
      const error = new Error("documents.artifacts.errors.analysis_failed");
      error.status = 503;
      return { ok: false, error };
    }
    state.ragDocs.delete(docId);
    return { ok: true };
  };
}

const commitFrom = state => async () => {
  state.dbSaysReset = true;
  state.commits += 1;
  return { archived_source_package_snapshots: 3, reset_kov_admin_rows: 1 };
};

/**
 * Järjekorda panek on SÜSTITUD, et testid saaksid püsiva rea TÕENDADA, mitte
 * loota. Vaikimisi kirjutaks ta päris `DataDeletionJob` rea.
 */
const collectJobs = (state, { fails = false } = {}) => async entry => {
  if (fails) return null;
  state.jobs.push(entry);
  return { id: `job_${state.jobs.length}` };
};

const resetArgs = (state, options = {}) => ({
  docIds: [...state.ragDocs],
  deleteDocument: deleteFrom(state, options),
  commit: commitFrom(state),
  queueRetry: collectJobs(state, options),
  resourceId: "harku-vald"
});

/** VANA rada, sõna-sõnalt nii nagu ta enne SOL-RAGADMIN-02 oli. */
async function legacyReset(state, { failOn = null } = {}) {
  const execution = { deleted_rag_documents: [], failed_rag_documents: [] };
  const remove = deleteFrom(state, { failOn });

  for (const docId of [...state.ragDocs]) {
    const result = await remove(docId);
    if (result.ok) execution.deleted_rag_documents.push({ docId });
    else execution.failed_rag_documents.push({ docId, error: String(result.error?.message || "delete_failed") });
  }

  /* Vana rada: arhiveeri ja lähtesta admini rida tõrgetest HOOLIMATA. */
  state.dbSaysReset = true;
  state.commits += 1;
  return { ok: true, execution };
}

/* ── 1. täielik õnnestumine ─────────────────────────────────────────────── */

test("SOL-RAGADMIN-02: kui iga dokument kustub, muutub DB olek ja tulemus on DONE", async () => {
  const state = world();

  const execution = await commitRagReset(resetArgs(state));

  assert.equal(execution.reset_state, "DONE");
  assert.equal(execution.db_state_changed, true);
  assert.equal(execution.deleted_rag_documents.length, 2);
  assert.deepEqual(execution.failed_rag_documents, []);
  assert.equal(execution.archived_source_package_snapshots, 3, "commit'i tulemus ei jõudnud vastusesse");
  assert.equal(state.commits, 1);
  assert.equal(state.ragDocs.size, 0);
  assertInvariant(state, "1");
});

test("SOL-RAGADMIN-02: kustutada polegi midagi — see EI OLE tõrge", async () => {
  const state = world({ docs: [] });

  const execution = await commitRagReset(resetArgs(state));

  assert.equal(execution.reset_state, "DONE");
  assert.equal(state.commits, 1, "tühi plaan ei tohi DB-olekut kinni hoida");
  assertInvariant(state, "2");
});

/* ── 2. üks kustutus kukub — leiu tuum ──────────────────────────────────── */

test("SOL-RAGADMIN-02: ühe dokumendi tõrge katkestab ENNE DB-oleku muutust", async () => {
  const state = world();

  const error = await commitRagReset(resetArgs(state, { failOn: "kov-rt-harku" })).then(
    () => null,
    caught => caught
  );

  assert.ok(error, "osaline reset läks vaikselt läbi");
  assert.equal(error.code, RAG_RESET_PARTIAL);
  assert.equal(error.status, 502);
  assert.equal(state.commits, 0, "DB olekut muudeti, kuigi dokument jäi alles");
  assert.equal(state.dbSaysReset, false);

  /* Vastus kannab MÕLEMAT poolt: mis läks ja mis jäi. */
  assert.equal(error.execution.reset_state, "PARTIAL");
  assert.equal(error.execution.db_state_changed, false);
  assert.deepEqual(error.execution.deleted_rag_documents, [{ docId: "kov-harku" }]);
  assert.equal(error.execution.failed_rag_documents.length, 1);
  assert.equal(error.execution.failed_rag_documents[0].docId, "kov-rt-harku");
  /* Kood ja staatus, MITTE erindi teade — teade on `messageKey`, kohati
     kaugteenuse omast payload'ist. */
  assert.equal(error.execution.failed_rag_documents[0].error, "rag_delete_failed:503");

  /* Allesjäänud dokument on endiselt RAG-is ja admini olek ütleb sedasama. */
  assert.ok(state.ragDocs.has("kov-rt-harku"));
  assertInvariant(state, "3");
});

test("SOL-RAGADMIN-02: NEGATIIVKONTROLL — VANA rada rikub invariandi sama süsti peal", async () => {
  const state = world();

  const result = await legacyReset(state, { failOn: "kov-rt-harku" });

  /* Vana rada: `ok: true`, DB lähtestatud — ja dokument endiselt teenuses. */
  assert.equal(result.ok, true);
  assert.equal(result.execution.failed_rag_documents.length, 1);
  assert.equal(state.dbSaysReset, true);
  assert.ok(state.ragDocs.has("kov-rt-harku"));
  assert.throws(
    () => assertInvariant(state, "negatiiv"),
    /DB ütleb „lähtestatud"/u,
    "vana rada EI rikkunud invarianti — süst ei reprodutseeri leidu"
  );
});

/* ── 3. allesjäänud dokument ei kao vaikselt ─────────────────────────────── */

test("SOL-RAGADMIN-02: allesjäänud dokument saab püsiva järjekorrarea", async () => {
  const state = world();

  const error = await commitRagReset(resetArgs(state, { failOn: "kov-harku" })).then(
    () => null,
    caught => caught
  );

  assert.equal(state.jobs.length, 1, "allesjäänud dokumendi kohta ei jäänud ühtegi rida");
  assert.equal(state.jobs[0].docId, "kov-harku");
  assert.equal(state.jobs[0].resourceId, "harku-vald");
  assert.equal(error.execution.failed_rag_documents[0].retry_queued, true);
  assert.equal(error.execution.failed_rag_documents[0].retry_job_id, "job_1");
  assert.equal(error.execution.retry_queued_count, 1);
  assert.equal(error.execution.retry_not_queued_count, 0);
  assertInvariant(state, "4");
});

test("SOL-RAGADMIN-02: järjekorda panemise tõrget EI vaikita eduks", async () => {
  /* Kui isegi rida ei tekkinud, siis on ainus koht, kus dokumendist teada
     saab, see teade — ja ta peab seda ütlema. */
  const state = world({ docs: ["kov-harku"] });

  const error = await commitRagReset(resetArgs(state, { failOn: "kov-harku", fails: true })).then(
    () => null,
    caught => caught
  );

  assert.equal(error.code, RAG_RESET_PARTIAL);
  assert.equal(error.execution.failed_rag_documents[0].retry_queued, false);
  assert.equal(error.execution.failed_rag_documents[0].retry_job_id, null);
  assert.equal(error.execution.retry_queued_count, 0);
  assert.equal(error.execution.retry_not_queued_count, 1);
  assert.equal(state.commits, 0);
  assertInvariant(state, "5");
});

/* ── 4. järjekord peab PÄRISELT tühjenema ───────────────────────────────── */

function retryDb(job) {
  const rows = new Map([[job.id, { ...job }]]);
  const db = {
    rows,
    audits: [],
    dataAuditLog: {
      async create({ data }) {
        db.audits.push(data);
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

test("SOL-RAGADMIN-02: järjekorrarida jõuab RAG-kustutajani, mitte failirajale", async () => {
  /* SEE ON MÕÕDETUD, MITTE OLETATUD (sama õppetund mis SOL-RAGADMIN-01):
     järjekord, mis ei saa kunagi tühjeneda, on halvem kui järjekorra puudumine,
     sest ta näeb välja nagu töötav järelevalve. */
  const job = {
    id: "job_1",
    action: RAG_RESET_RETRY_JOB.ACTION,
    resourceType: RAG_RESET_RETRY_JOB.RESOURCE_TYPE,
    resourceId: "harku-vald",
    externalRef: "kov-harku",
    storagePath: null,
    attempts: 0
  };
  const db = retryDb(job);
  const seen = { rag: [], document: [], material: [] };

  const retry = createDeletionJobRetryService({
    db,
    deleteDocument: async path => {
      seen.document.push(path);
    },
    deleteMaterial: async path => {
      seen.material.push(path);
    },
    deleteRag: async docId => {
      seen.rag.push(docId);
      return { ok: true };
    },
    deleteRagAdminFile: async () => false,
    deleteUser: async () => {}
  });

  await retry({ jobId: "job_1", actorUserId: "admin_1" });

  assert.deepEqual(seen.rag, ["kov-harku"], "rida ei jõudnud RAG-kustutajani");
  assert.deepEqual(seen.document, [], "rida suunati failikustutajale");
  assert.equal(db.rows.get("job_1").status, "done");
});

test("SOL-RAGADMIN-02: järjekorrarida ei kanna teenuse tõrke TEADET ega failiteed", async () => {
  const lookups = [];
  const created = [];
  const db = {
    dataDeletionJob: {
      async findFirst(query) {
        lookups.push(query.where);
        return null;
      }
    }
  };

  const error = new Error("documents.artifacts.errors.analysis_failed");
  error.status = 504;
  const job = await queueRagDocumentDeleteRetry({
    docId: "kov-harku",
    resourceId: "harku-vald",
    error,
    db,
    createJob: async data => {
      created.push(data);
      return { id: "job_1" };
    }
  });

  assert.equal(job.id, "job_1");
  assert.equal(created.length, 1);
  assert.equal(created[0].action, "RAG_DELETE");
  assert.equal(created[0].resourceType, "MunicipalityKovAdmin");
  assert.equal(created[0].externalRef, "kov-harku");
  assert.equal(created[0].lastError, "rag_delete_failed:504");
  /* `storagePath` peab jääma tühjaks: `executeDeletionJob` valib haru `action`
     järgi, aga siia pandud vabatekst suunaks kaotsi läinud `externalRef`-i
     korral töö failikustutajale. */
  assert.equal(created[0].storagePath, undefined);
  assert.equal(lookups[0].externalRef, "kov-harku");
});

test("SOL-RAGADMIN-02: sama dokumendi kohta ei teki teist lahtist rida", async () => {
  const created = [];
  const db = {
    dataDeletionJob: {
      async findFirst() {
        return { id: "job_existing" };
      }
    }
  };

  const job = await queueRagDocumentDeleteRetry({
    docId: "kov-harku",
    db,
    createJob: async data => {
      created.push(data);
      return { id: "job_new" };
    }
  });

  assert.equal(job.id, "job_existing");
  assert.deepEqual(created, [], "järjekord täitus sama tööga ja mattis nähtavuse enda alla");
});

/* ── 5. UI aus osaline viga ─────────────────────────────────────────────── */

const partialPayload = {
  ok: false,
  message: "api.admin.kov.rag_reset_partial",
  execution: {
    reset_state: "PARTIAL",
    db_state_changed: false,
    deleted_rag_documents: [{ docId: "kov-harku" }],
    failed_rag_documents: [{ docId: "kov-rt-harku", error: "rag_delete_failed:503", retry_queued: true }],
    retry_queued_count: 1,
    retry_not_queued_count: 0
  }
};

test("SOL-RAGADMIN-02: UI ütleb osalise reseti VÄLJA, mitte eduteatena", async () => {
  const outcome = describeKovRagResetOutcome(partialPayload, { et: true });

  assert.equal(outcome.type, "error");
  assert.equal(outcome.partial, true);
  assert.match(outcome.text, /JÄI POOLELI/u);
  assert.match(outcome.text, /kov-rt-harku/u);
  assert.match(outcome.text, /EI muudetud/u);
  assert.match(outcome.text, /järjekorras: 1/u);
  assert.doesNotMatch(outcome.text, /ei pea eraldi kustutama/u, "osaline reset kandis eduteate teksti");
});

test("SOL-RAGADMIN-02: NEGATIIVKONTROLL — `ok: true` EI päästa osalist tulemust", async () => {
  /* Vana UI-värav oli `response.ok && payload.ok !== false`. Kui mõni tulevane
     serverirada unustab staatuse, peab teade ikka aus olema — otsustab TÖÖ
     TULEMUS, mitte staatus. */
  const outcome = describeKovRagResetOutcome({ ...partialPayload, ok: true }, { et: true });

  assert.equal(outcome.type, "error");
  assert.equal(outcome.partial, true);
  assert.match(outcome.text, /JÄI POOLELI/u);
});

test("SOL-RAGADMIN-02: järjekorda panemata dokument on teates eraldi välja öeldud", async () => {
  const outcome = describeKovRagResetOutcome(
    {
      ok: false,
      execution: {
        ...partialPayload.execution,
        failed_rag_documents: [{ docId: "kov-rt-harku", error: "rag_delete_failed:503", retry_queued: false }],
        retry_queued_count: 0,
        retry_not_queued_count: 1
      }
    },
    { et: true }
  );

  assert.match(outcome.text, /Järjekorda EI õnnestunud panna: 1/u);
});

test("SOL-RAGADMIN-02: täielik õnnestumine kannab endiselt eduteadet", async () => {
  const outcome = describeKovRagResetOutcome(
    {
      ok: true,
      execution: {
        reset_state: "DONE",
        db_state_changed: true,
        deleted_rag_documents: [{ docId: "kov-harku" }],
        failed_rag_documents: []
      }
    },
    { et: true }
  );

  assert.equal(outcome.type, "success");
  assert.equal(outcome.partial, false);
  assert.match(outcome.text, /resetiti paketina/u);
});
