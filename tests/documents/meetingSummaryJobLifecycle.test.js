import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createMeetingSummaryJob as createMeetingSummaryJobRaw,
  retryPendingMeetingSummaryUsageSettlements,
  runMeetingSummaryJob as runMeetingSummaryJobRaw,
  shouldDeleteMeetingSummaryJob,
  sweepMeetingSummarySnapshots as sweepMeetingSummarySnapshotsRaw,
} from "../../lib/documents/meetingSummaryJobs.js";

// SOL-MEET-04: aktiivse töö claim elab nüüd andmebaasis. `lib/prisma` EI OLE testis fake, seega
// ilma süstitud kliendita hakkaks kogu see sviit vaikselt elavast PostgreSQL-ist sõltuma — ja CI-s,
// kus andmebaasi ei ole, kukuks. Võlts jäljendab täpselt seda ühte asja, mille peal leid seisab:
// `userId` unikaalsust ja tema P2002 viga.
function claimDb() {
  const rows = new Map();
  let seq = 0;
  return {
    rows,
    meetingSummaryJobClaim: {
      async create({ data }) {
        if (rows.has(data.userId)) {
          const error = new Error("Unique constraint failed on the fields: (`userId`)");
          error.code = "P2002";
          throw error;
        }
        const row = {
          id: `claim_${(seq += 1)}`,
          userId: data.userId,
          jobId: data.jobId,
          updatedAt: new Date(),
        };
        rows.set(data.userId, row);
        return row;
      },
      async findUnique({ where }) {
        return rows.get(where.userId) || null;
      },
      async updateMany({ where, data }) {
        let count = 0;
        for (const row of rows.values()) {
          if (where.userId != null && row.userId !== where.userId) continue;
          if (where.jobId != null && row.jobId !== where.jobId) continue;
          Object.assign(row, data);
          row.updatedAt = new Date();
          count += 1;
        }
        return { count };
      },
      async deleteMany({ where }) {
        let count = 0;
        for (const [userId, row] of [...rows]) {
          if (where.id != null && row.id !== where.id) continue;
          if (where.updatedAt != null && row.updatedAt.getTime() !== new Date(where.updatedAt).getTime()) continue;
          if (where.userId != null && row.userId !== where.userId) continue;
          if (where.jobId != null && row.jobId !== where.jobId) continue;
          rows.delete(userId);
          count += 1;
        }
        return { count };
      },
    },
  };
}

const db = claimDb();
const createMeetingSummaryJob = (input, opts = {}) => createMeetingSummaryJobRaw(input, { db, ...opts });
const runMeetingSummaryJob = (job, opts = {}) => runMeetingSummaryJobRaw(job, { db, ...opts });
const sweepMeetingSummarySnapshots = (opts = {}) => sweepMeetingSummarySnapshotsRaw({ db, ...opts });

// SOL-MEET-01. Leid oli VAIKNE kahes kohas korraga.
//
// 1) `createMeetingSummaryJob` pani töö esmalt protsessi Map'i ja kirjutas alles siis snapshoti.
//    Kirjutuse vea korral vabastas route reservatsioonid ja vastas 500-ga, aga Map'i jäänud
//    `queued` tööd ei eemaldanud keegi — sweep ei kustuta queued/running olekut. Kasutaja
//    aktiivse töö limiit jäi protsessi elueaks lukku ja iga järgmine katse sai „busy".
//
// 2) `runMeetingSummaryJob`-is olid running-märge, tema snapshot ja `import("openai")` try'st
//    VÄLJA jäetud. Nende viga jõudis ainult route'i `queueMicrotask(...).catch` logisse: tööd ei
//    märgitud error'iks ega vabastatud kasutust.
//
// Vigu ei jäljendata fake-fs-iga, vaid tekitatakse päriselt: kui `AGENT_STORAGE_DIR` osutab
// teekonda, mille vanem on tavaline FAIL, siis `mkdir` kukub päris vea koodiga.

const ORIGINAL_STORAGE_DIR = process.env.AGENT_STORAGE_DIR;
const ORIGINAL_OPENAI_KEY = process.env.OPENAI_API_KEY;

async function makeRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), "sotsiaalai-meeting-summary-"));
}

function jobsDirFor(storageDir) {
  return path.join(storageDir, "meeting-summary-jobs");
}

function usageRecorder() {
  const calls = [];
  return {
    calls,
    async commit(input) {
      calls.push({ action: "commit", ...input });
      return {};
    },
    async release(input) {
      calls.push({ action: "release", ...input });
      return {};
    },
  };
}

function reservedUsage(prefix) {
  return {
    stt: { idempotencyKey: `${prefix}-stt`, state: "reserved" },
    document: { idempotencyKey: `${prefix}-doc`, state: "reserved" },
  };
}

function samplePayload() {
  return {
    locale: "et",
    role: "USER",
    fileName: "meeting.webm",
    mimeType: "audio/webm",
    fileSizeBytes: 11,
    inputDurationSeconds: 12,
    audioBuffer: Buffer.from("audio-bytes"),
  };
}

function restoreEnv() {
  if (ORIGINAL_STORAGE_DIR === undefined) delete process.env.AGENT_STORAGE_DIR;
  else process.env.AGENT_STORAGE_DIR = ORIGINAL_STORAGE_DIR;
  if (ORIGINAL_OPENAI_KEY === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = ORIGINAL_OPENAI_KEY;
}

test("snapshoti kirjutuse viga ei jäta tööd nähtavaks ja uue saab KOHE alustada", async () => {
  const root = await makeRoot();
  const userId = "meet-01-user-create";

  try {
    process.env.AGENT_STORAGE_DIR = root;

    // Katkestame TÄPSELT kirjutuse etapi. Kataloogitasandi viga ei kõlba: aktiivsete tööde
    // loendus teeb enne kirjutust sama `mkdir`-i, nii et katkine kataloog kukutaks loenduse ja
    // ordering-viga jääks mõõtmata — vana kood läbis just sellepärast selle testi valesti.
    await assert.rejects(
      createMeetingSummaryJob(
        { userId, payload: samplePayload(), usage: reservedUsage("a") },
        {
          persist: async () => {
            throw new Error("ENOSPC: no space left on device");
          },
        }
      ),
      /ENOSPC/
    );

    // Kettale ei tohi jääda rida ega Map'i tööd: sama kasutaja järgmine katse peab läbi minema.
    const job = await createMeetingSummaryJob({
      userId,
      payload: samplePayload(),
      usage: reservedUsage("b"),
    });

    assert.equal(job.status, "queued");
    const files = await fs.readdir(jobsDirFor(root));
    assert.deepEqual(files, [`${job.id}.json`], "kettal on täpselt üks snapshot — õnnestunud töö oma");
  } finally {
    restoreEnv();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("impordi viga viib terminalolekusse ja vabastab MÕLEMAD reservatsioonid", async () => {
  const root = await makeRoot();
  const userId = "meet-01-user-import";

  try {
    process.env.AGENT_STORAGE_DIR = root;
    process.env.OPENAI_API_KEY = "test-key";

    const job = await createMeetingSummaryJob({
      userId,
      payload: samplePayload(),
      usage: reservedUsage("import"),
    });

    const usage = usageRecorder();
    await runMeetingSummaryJob(job, {
      usage,
      loadOpenAI: async () => {
        throw new Error("openai module is unavailable");
      },
    });

    assert.equal(job.status, "error");
    assert.ok(job.endedAt, "terminalolekul peab olema lõpuaeg");

    const released = usage.calls.filter(call => call.action === "release").map(call => call.idempotencyKey);
    assert.deepEqual(released.sort(), ["import-doc", "import-stt"]);
    assert.equal(job.usage.stt.state, "released");
    assert.equal(job.usage.document.state, "released");

    // Terminalolek peab kettale jõudma...
    const persisted = JSON.parse(
      await fs.readFile(path.join(jobsDirFor(root), `${job.id}.json`), "utf8")
    );
    assert.equal(persisted.status, "error");

    // ...ja kasutaja peab saama kohe uue töö alustada.
    const next = await createMeetingSummaryJob({
      userId,
      payload: samplePayload(),
      usage: reservedUsage("import-2"),
    });
    assert.equal(next.status, "queued");
  } finally {
    restoreEnv();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("running-märke snapshoti viga ei jäta tööd rippuma", async () => {
  const root = await makeRoot();
  const userId = "meet-01-user-running";

  try {
    process.env.AGENT_STORAGE_DIR = root;
    process.env.OPENAI_API_KEY = "test-key";

    const job = await createMeetingSummaryJob({
      userId,
      payload: samplePayload(),
      usage: reservedUsage("running"),
    });

    // Kataloog asendatakse failiga: running-märke snapshot kukub päris veaga.
    await fs.rm(jobsDirFor(root), { recursive: true, force: true });
    await fs.writeFile(jobsDirFor(root), "not-a-directory");

    const usage = usageRecorder();
    await runMeetingSummaryJob(job, {
      usage,
      loadOpenAI: async () => ({ default: class { constructor() {} } }),
    });

    // Terminalolek on mälus olemas ka siis, kui teda ei õnnestunud kettale kirjutada —
    // just see hoiab kasutaja limiidi lahti.
    assert.equal(job.status, "error");
    const released = usage.calls.filter(call => call.action === "release").map(call => call.idempotencyKey);
    assert.deepEqual(released.sort(), ["running-doc", "running-stt"]);
  } finally {
    restoreEnv();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("nurjunud rename ei jäta poolikut .tmp faili kataloogi", async () => {
  const root = await makeRoot();
  const userId = "meet-01-user-tmp";

  try {
    process.env.AGENT_STORAGE_DIR = root;
    process.env.OPENAI_API_KEY = "test-key";

    const job = await createMeetingSummaryJob({
      userId,
      payload: samplePayload(),
      usage: reservedUsage("tmp"),
    });

    // Sihtfaili asemel kataloog: kirjutus `.tmp`-sse õnnestub, rename kukub. Just see on juhtum,
    // kus vana kood jättis kokkuvõtte teksti kandva pooliku faili kataloogi vedelema.
    const target = path.join(jobsDirFor(root), `${job.id}.json`);
    await fs.rm(target, { force: true });
    await fs.mkdir(target, { recursive: true });

    const usage = usageRecorder();
    await runMeetingSummaryJob(job, {
      usage,
      loadOpenAI: async () => ({ default: class { constructor() {} } }),
    });

    assert.equal(job.status, "error");
    const leftovers = (await fs.readdir(jobsDirFor(root))).filter(name => name.endsWith(".tmp"));
    assert.deepEqual(leftovers, [], "poolikut .tmp faili ei tohi kataloogi jääda");
  } finally {
    restoreEnv();
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------------------------
// SOL-MEET-02. Ühik commit'iti ENNE kasutajale kuuluva dokumendi loomist ja `workCompleted` seati
// samal hetkel tõeseks. Kui dokument siis kukkus, kutsus catch küll üldise release'i, aga
// `settleMeetingSummaryUsage()` keeldub release'ist just `workCompleted` tõttu: kasutaja oli ühiku
// kulutanud ja dokumenti ei olnud kuskilt leida. Siin mõõdetakse kahte suunda ja `commit_pending`
// kordust; tehingu päris atomaarsust (rollback) mõõdab `npm run meeting:summary:probe`.
// ---------------------------------------------------------------------------------------------

async function runToDocument(job, { usage, persistDocument }) {
  const transcript = { text: "kohtumise tekst", usage: { type: "duration", seconds: 12 } };
  const summary = { output_text: "kokkuvõte" };
  class FakeOpenAI {
    constructor() {
      this.audio = { transcriptions: { create: async () => transcript } };
      this.responses = { create: async () => summary };
    }
  }
  return runMeetingSummaryJob(job, {
    usage,
    persistDocument,
    loadOpenAI: async () => ({ default: FakeOpenAI }),
  });
}

test("dokumendi loomise viga VABASTAB dokumendiühiku ega jäta tasutud tööd õhku", async () => {
  const root = await makeRoot();
  const userId = "meet-02-user-fail";

  try {
    process.env.AGENT_STORAGE_DIR = root;
    process.env.OPENAI_API_KEY = "test-key";

    const job = await createMeetingSummaryJob({
      userId,
      payload: samplePayload(),
      usage: reservedUsage("doc-fail"),
    });

    const usage = usageRecorder();
    await runToDocument(job, {
      usage,
      persistDocument: async () => {
        throw new Error("documents.errors.storage_quota_exceeded");
      },
    });

    assert.equal(job.status, "error");

    // STT on päriselt kulunud (provider vastas), seega tema commit JÄÄB.
    assert.equal(job.usage.stt.state, "committed");
    // Dokumendiühik peab olema vabastatud — see on kogu leiu tuum.
    assert.equal(job.usage.document.state, "released");
    assert.notEqual(job.usage.document.workCompleted, true);

    const documentCalls = usage.calls.filter(call => call.idempotencyKey === "doc-fail-doc");
    assert.deepEqual(documentCalls.map(call => call.action), ["release"]);
  } finally {
    restoreEnv();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("õnnestunud dokument annab ühe koherentse tulemuse: dokument JA võetud ühik", async () => {
  const root = await makeRoot();
  const userId = "meet-02-user-ok";

  try {
    process.env.AGENT_STORAGE_DIR = root;
    process.env.OPENAI_API_KEY = "test-key";

    const job = await createMeetingSummaryJob({
      userId,
      payload: samplePayload(),
      usage: reservedUsage("doc-ok"),
    });

    const usage = usageRecorder();
    const seen = [];
    await runToDocument(job, {
      usage,
      persistDocument: async (input) => {
        seen.push(input);
        // Päris rada commit'ib tehingu sees; siin jäljendame ainult seda, et ühik saab võetud.
        await input.usageCommit.usage.commit({
          userId: input.userId,
          idempotencyKey: input.usageCommit.idempotencyKey,
        });
        return { id: "doc_1", title: "Kokkuvõte" };
      },
    });

    assert.equal(job.status, "done");
    assert.equal(job.result.document.id, "doc_1");
    assert.equal(job.usage.document.state, "committed");
    assert.equal(job.usage.document.workCompleted, true);

    // Dokumendirajale peab jõudma roll — ilma temata ei saa kvooti üldse arvutada.
    assert.equal(seen[0].role, "USER");
    assert.equal(seen[0].usageCommit.idempotencyKey, "doc-ok-doc");
  } finally {
    restoreEnv();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("commit_pending jäetakse alles ja korratakse kuni ta õnnestub", async () => {
  const root = await makeRoot();
  const userId = "meet-02-user-pending";

  try {
    process.env.AGENT_STORAGE_DIR = root;

    const jobId = "11111111-2222-3333-4444-555555555555";
    const ended = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await fs.mkdir(jobsDirFor(root), { recursive: true });
    await fs.writeFile(
      path.join(jobsDirFor(root), `${jobId}.json`),
      JSON.stringify({
        id: jobId,
        userId,
        status: "done",
        createdAt: ended,
        updatedAt: ended,
        startedAt: ended,
        endedAt: ended,
        error: null,
        result: { summaryText: "kokkuvõte" },
        usage: {
          stt: { idempotencyKey: "pending-stt", state: "commit_pending" },
          document: { idempotencyKey: "pending-doc", state: "committed" },
        },
      }),
      "utf8"
    );

    let attempts = 0;
    const flaky = {
      async commit(input) {
        attempts += 1;
        if (attempts === 1) throw new Error("temporary database failure");
        return { idempotencyKey: input.idempotencyKey };
      },
      async release() {
        throw new Error("release ei tohiks siin juhtuda");
      },
    };

    const first = await retryPendingMeetingSummaryUsageSettlements({ usage: flaky });
    assert.equal(first.committed, 0);
    assert.equal(first.stillPending, 1);

    const second = await retryPendingMeetingSummaryUsageSettlements({ usage: flaky });
    assert.equal(second.committed, 1);

    const persisted = JSON.parse(
      await fs.readFile(path.join(jobsDirFor(root), `${jobId}.json`), "utf8")
    );
    assert.equal(persisted.usage.stt.state, "committed");
  } finally {
    restoreEnv();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("dokumendita terminaltöö commit_pending reservatsioon vabastatakse, mitte ei arveldata", async () => {
  const root = await makeRoot();
  const userId = "meet-02-user-missing-document";

  try {
    process.env.AGENT_STORAGE_DIR = root;
    const jobId = "11111111-2222-3333-4444-666666666666";
    const ended = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await fs.mkdir(jobsDirFor(root), { recursive: true });
    await fs.writeFile(
      path.join(jobsDirFor(root), `${jobId}.json`),
      JSON.stringify({
        id: jobId,
        userId,
        status: "error",
        createdAt: ended,
        updatedAt: ended,
        startedAt: ended,
        endedAt: ended,
        error: "documents.agent_workspace.meeting_summary.error",
        result: { summaryText: "kokkuvõte" },
        usage: {
          document: {
            idempotencyKey: "pending-document-without-document",
            state: "commit_pending",
            workCompleted: true,
          },
        },
      }),
      "utf8"
    );

    const usage = usageRecorder();
    const result = await retryPendingMeetingSummaryUsageSettlements({ usage });

    assert.equal(result.committed, 0);
    assert.deepEqual(usage.calls, [{
      action: "release",
      userId,
      idempotencyKey: "pending-document-without-document",
      reason: "meeting_summary_document_missing",
    }]);
    const persisted = JSON.parse(
      await fs.readFile(path.join(jobsDirFor(root), `${jobId}.json`), "utf8")
    );
    assert.equal(persisted.usage.document.state, "released");
  } finally {
    restoreEnv();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("pooleli arveldusega snapshotit ei visata TTL-i järgi ära", () => {
  const stale = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const base = { id: "j1", status: "done", endedAt: stale, updatedAt: stale, createdAt: stale };

  assert.equal(
    shouldDeleteMeetingSummaryJob({ ...base, usage: { stt: { state: "committed" } } }, Date.now()),
    true,
    "arveldatud terminaaltöö tohib TTL-i järel kaduda"
  );
  assert.equal(
    shouldDeleteMeetingSummaryJob({ ...base, usage: { stt: { state: "commit_pending" } } }, Date.now()),
    false,
    "pooleli arveldus on korduse AINUS sisend — teda ei tohi ära visata"
  );
});

// ---------------------------------------------------------------------------------------------
// SOL-MEET-03. Koristus käis AINULT protsessi `jobs` Map'i läbi. Pärast restarti on Map tühi, aga
// snapshot kannab valmis `summaryText` välja — seega jäi kohtumise tundlik kokkuvõte kettale
// TÄHTAJATULT. Otse kettale kirjutatud snapshot ONGI restardi tingimus: seda faili ei ole see
// protsess kunagi näinud.
// ---------------------------------------------------------------------------------------------

const SALADUS = "KLIENDI-NIMI-JA-DIAGNOOS";

async function writeSnapshot(root, record) {
  await fs.mkdir(jobsDirFor(root), { recursive: true });
  const file = path.join(jobsDirFor(root), `${record.id}.json`);
  await fs.writeFile(file, JSON.stringify(record), "utf8");
  return file;
}

function terminalSnapshot(id, { userId = "meet-03-user", agoMs = 0, usage = null } = {}) {
  const stamp = new Date(Date.now() - agoMs).toISOString();
  return {
    id,
    userId,
    status: "done",
    createdAt: stamp,
    updatedAt: stamp,
    startedAt: stamp,
    endedAt: stamp,
    error: null,
    result: { summaryText: `Kokkuvõte: ${SALADUS}`, document: { id: "doc_1" } },
    usage,
  };
}

async function ageFile(file, ms) {
  const when = new Date(Date.now() - ms);
  await fs.utimes(file, when, when);
}

test("restardi järel kustutab kataloogisweep aegunud terminalsnapshoti KOOS sisuga", async () => {
  const root = await makeRoot();
  try {
    process.env.AGENT_STORAGE_DIR = root;

    const file = await writeSnapshot(root, terminalSnapshot("aegunud-1", { agoMs: 2 * 60 * 60 * 1000 }));
    assert.ok((await fs.readFile(file, "utf8")).includes(SALADUS), "eeldus: sisu on kettal olemas");

    const summary = await sweepMeetingSummarySnapshots({ usage: usageRecorder() });

    assert.equal(summary.removed, 1);
    await assert.rejects(fs.readFile(file, "utf8"), /ENOENT/);
    const left = await fs.readdir(jobsDirFor(root));
    assert.deepEqual(left, [], "kataloogi ei tohi jääda ühtki jälge");
  } finally {
    restoreEnv();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("värske terminalsnapshot jääb TTL-i sees alles", async () => {
  const root = await makeRoot();
  try {
    process.env.AGENT_STORAGE_DIR = root;
    await writeSnapshot(root, terminalSnapshot("varske-1", { agoMs: 60 * 1000 }));

    const summary = await sweepMeetingSummarySnapshots({ usage: usageRecorder() });

    assert.equal(summary.removed, 0);
    assert.deepEqual(await fs.readdir(jobsDirFor(root)), ["varske-1.json"]);
  } finally {
    restoreEnv();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("pooleli arveldusega snapshot jääb alles ka üle TTL-i", async () => {
  const root = await makeRoot();
  try {
    process.env.AGENT_STORAGE_DIR = root;
    await writeSnapshot(
      root,
      terminalSnapshot("pending-1", {
        agoMs: 2 * 60 * 60 * 1000,
        usage: { stt: { idempotencyKey: "k", state: "commit_pending" } },
      })
    );

    const summary = await sweepMeetingSummarySnapshots({ usage: usageRecorder() });

    assert.equal(summary.removed, 0);
    assert.deepEqual(await fs.readdir(jobsDirFor(root)), ["pending-1.json"]);
  } finally {
    restoreEnv();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("restardist rippuma jäänud running-töö katkestatakse, kasutus vabastatakse ja siis ta aegub", async () => {
  const root = await makeRoot();
  try {
    process.env.AGENT_STORAGE_DIR = root;

    const hangingAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await writeSnapshot(root, {
      id: "rippuv-1",
      userId: "meet-03-user",
      status: "running",
      createdAt: hangingAt,
      updatedAt: hangingAt,
      startedAt: hangingAt,
      endedAt: null,
      error: null,
      result: null,
      usage: {
        stt: { idempotencyKey: "rippuv-stt", state: "reserved" },
        document: { idempotencyKey: "rippuv-doc", state: "reserved" },
      },
    });

    const usage = usageRecorder();
    const first = await sweepMeetingSummarySnapshots({ usage });

    assert.equal(first.interrupted, 1);
    assert.equal(first.removed, 0, "katkestatud töö saab uue lõpuaja, seega ta ei aegu samal hetkel");
    const released = usage.calls.filter(call => call.action === "release").map(call => call.idempotencyKey);
    assert.deepEqual(released.sort(), ["rippuv-doc", "rippuv-stt"], "rippuv töö peab kvoodi vabastama");

    // Teine sweep, kui ka tema oma tähtaeg on möödas.
    const later = await sweepMeetingSummarySnapshots({
      usage: usageRecorder(),
      now: Date.now() + 2 * 60 * 60 * 1000,
    });
    assert.equal(later.removed, 1);
    assert.deepEqual(await fs.readdir(jobsDirFor(root)), []);
  } finally {
    restoreEnv();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("loetamatu .json ja orb .tmp kaovad FAIL-CLOSED, aga alles siis, kui nad on seisnud", async () => {
  const root = await makeRoot();
  try {
    process.env.AGENT_STORAGE_DIR = root;
    await fs.mkdir(jobsDirFor(root), { recursive: true });

    const brokenOld = path.join(jobsDirFor(root), "katki-vana.json");
    const brokenFresh = path.join(jobsDirFor(root), "katki-varske.json");
    const tmpOld = path.join(jobsDirFor(root), "orb-vana.json.123.456.tmp");
    const tmpFresh = path.join(jobsDirFor(root), "orb-varske.json.123.456.tmp");

    await fs.writeFile(brokenOld, `{katkine json ${SALADUS}`, "utf8");
    await fs.writeFile(brokenFresh, `{katkine json ${SALADUS}`, "utf8");
    await fs.writeFile(tmpOld, `pooleli ${SALADUS}`, "utf8");
    await fs.writeFile(tmpFresh, `pooleli ${SALADUS}`, "utf8");
    await ageFile(brokenOld, 2 * 60 * 60 * 1000);
    await ageFile(tmpOld, 2 * 60 * 60 * 1000);

    const summary = await sweepMeetingSummarySnapshots({ usage: usageRecorder() });

    assert.equal(summary.orphans, 2, "kaks seisnud faili peavad kaduma");
    const left = (await fs.readdir(jobsDirFor(root))).sort();
    assert.deepEqual(left, ["katki-varske.json", "orb-varske.json.123.456.tmp"],
      "värsket faili ei tohi ära võtta — teine protsess võib olla teda parajasti kirjutamas");
  } finally {
    restoreEnv();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("kehtiv, aga tundmatu staatusega kirje loetakse loetamatuks, mitte 'alles jätta'", async () => {
  const root = await makeRoot();
  try {
    process.env.AGENT_STORAGE_DIR = root;
    const file = await writeSnapshot(root, {
      id: "vale-staatus",
      userId: "meet-03-user",
      status: "midagi-muud",
      createdAt: new Date().toISOString(),
      result: { summaryText: SALADUS },
    });
    await ageFile(file, 2 * 60 * 60 * 1000);

    const summary = await sweepMeetingSummarySnapshots({ usage: usageRecorder() });

    assert.equal(summary.orphans, 1);
    assert.deepEqual(await fs.readdir(jobsDirFor(root)), []);
  } finally {
    restoreEnv();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("elava töö snapshotti kataloogisweep EI puutu", async () => {
  const root = await makeRoot();
  try {
    process.env.AGENT_STORAGE_DIR = root;
    const job = await createMeetingSummaryJob({
      userId: "meet-03-user-live",
      payload: samplePayload(),
      usage: reservedUsage("live"),
    });

    const summary = await sweepMeetingSummarySnapshots({
      usage: usageRecorder(),
      now: Date.now() + 10 * 60 * 60 * 1000,
    });

    assert.equal(summary.removed, 0);
    assert.equal(summary.interrupted, 0);
    assert.deepEqual(await fs.readdir(jobsDirFor(root)), [`${job.id}.json`]);
  } finally {
    restoreEnv();
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------------------------
// SOL-MEET-04. Aktiivse töö piirangut kontrolliti Map'ist ja kataloogist ning uus töö lisati alles
// hiljem: kaks põimuva `await`-iga POST-i lugesid MÕLEMAD „aktiivseid ei ole" ja lõid mõlemad oma
// töö oma kasutusvõtmega. Siin mõõdetakse claim'i enda lepingut; päris samaaegsust päris
// unikaalindeksi vastu mõõdab `npm run meeting:summary:probe`.
// ---------------------------------------------------------------------------------------------

test("kaks samaaegset loomist annavad ÜHE töö — teine saab ausa busy", async () => {
  const root = await makeRoot();
  const userId = "meet-04-user-race";
  try {
    process.env.AGENT_STORAGE_DIR = root;

    const results = await Promise.allSettled([
      createMeetingSummaryJob({ userId, payload: samplePayload(), usage: reservedUsage("race-a") }),
      createMeetingSummaryJob({ userId, payload: samplePayload(), usage: reservedUsage("race-b") }),
    ]);

    const won = results.filter(r => r.status === "fulfilled");
    const lost = results.filter(r => r.status === "rejected");

    assert.equal(won.length, 1, "täpselt üks töö tohib sündida");
    assert.equal(lost.length, 1);
    assert.equal(lost[0].reason.code, "ACTIVE_JOB_LIMIT");
    assert.equal(lost[0].reason.message, "documents.agent_workspace.meeting_summary.busy");

    // Kaotaja ei tohi jätta kettale snapshotti — muidu oleks tal ka oma reservatsioonipaar elus.
    assert.deepEqual(await fs.readdir(jobsDirFor(root)), [`${won[0].value.id}.json`]);
  } finally {
    restoreEnv();
    db.rows.clear();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("terminalolek vabastab claim'i ja järgmise töö saab kohe alustada", async () => {
  const root = await makeRoot();
  const userId = "meet-04-user-release";
  try {
    process.env.AGENT_STORAGE_DIR = root;
    process.env.OPENAI_API_KEY = "test-key";

    const job = await createMeetingSummaryJob({
      userId, payload: samplePayload(), usage: reservedUsage("rel"),
    });
    assert.equal(db.rows.size, 1, "aktiivne töö hoiab claim'i");

    await runMeetingSummaryJob(job, {
      usage: usageRecorder(),
      loadOpenAI: async () => { throw new Error("provider maas"); },
    });

    assert.equal(job.status, "error");
    assert.equal(db.rows.size, 0, "terminalolek peab claim'i vabastama");

    const next = await createMeetingSummaryJob({
      userId, payload: samplePayload(), usage: reservedUsage("rel-2"),
    });
    assert.equal(next.status, "queued");
  } finally {
    restoreEnv();
    db.rows.clear();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("värsket claim'i EI saa üle võtta, aegunud oma saab", async () => {
  const root = await makeRoot();
  const userId = "meet-04-user-stale";
  try {
    process.env.AGENT_STORAGE_DIR = root;

    await createMeetingSummaryJob({ userId, payload: samplePayload(), usage: reservedUsage("s1") });

    await assert.rejects(
      createMeetingSummaryJob({ userId, payload: samplePayload(), usage: reservedUsage("s2") }),
      error => error.code === "ACTIVE_JOB_LIMIT"
    );

    // Claim vananeb (üle 15 min): rippuma jäänud protsess ei tohi kasutajat igaveseks lukustada.
    const held = db.rows.get(userId);
    held.updatedAt = new Date(Date.now() - 60 * 60 * 1000);

    const taken = await createMeetingSummaryJob({
      userId, payload: samplePayload(), usage: reservedUsage("s3"),
    });
    assert.equal(taken.status, "queued");
    assert.equal(db.rows.get(userId).jobId, taken.id, "claim peab kuuluma uuele tööle");
  } finally {
    restoreEnv();
    db.rows.clear();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("kaks samaaegset ülevõtjat: aegunud claim'i saab ainult ÜKS", async () => {
  const root = await makeRoot();
  const userId = "meet-04-user-cas";
  try {
    process.env.AGENT_STORAGE_DIR = root;

    await createMeetingSummaryJob({ userId, payload: samplePayload(), usage: reservedUsage("c1") });
    db.rows.get(userId).updatedAt = new Date(Date.now() - 60 * 60 * 1000);

    const results = await Promise.allSettled([
      createMeetingSummaryJob({ userId, payload: samplePayload(), usage: reservedUsage("c2") }),
      createMeetingSummaryJob({ userId, payload: samplePayload(), usage: reservedUsage("c3") }),
    ]);

    assert.equal(results.filter(r => r.status === "fulfilled").length, 1, "ülevõtt on compare-and-swap");
    assert.equal(results.filter(r => r.status === "rejected")[0].reason.code, "ACTIVE_JOB_LIMIT");
  } finally {
    restoreEnv();
    db.rows.clear();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("elavat claim'i ei saa üle võtta — jooks värskendab teda ise", async () => {
  const root = await makeRoot();
  const userId = "meet-04-user-heartbeat";
  try {
    process.env.AGENT_STORAGE_DIR = root;
    process.env.OPENAI_API_KEY = "test-key";

    const job = await createMeetingSummaryJob({
      userId, payload: samplePayload(), usage: reservedUsage("hb"),
    });

    // Claim „vananeb" enne kui töö jõuab käivituda — täpselt see olukord, kus pikk töö
    // muutuks vanas kujus ülevõetavaks.
    db.rows.get(userId).updatedAt = new Date(Date.now() - 60 * 60 * 1000);

    let takeoverDuringRun = null;
    class SlowOpenAI {
      constructor() {
        this.audio = {
          transcriptions: {
            create: async () => {
              // Jooks on siin juba käivitunud ja südamelöök tehtud.
              takeoverDuringRun = await createMeetingSummaryJob({
                userId, payload: samplePayload(), usage: reservedUsage("hb-2"),
              }).then(() => "ÜLE VÕETUD", error => error.code);
              return { text: "tekst", usage: { type: "duration", seconds: 3 } };
            },
          },
        };
        this.responses = { create: async () => ({ output_text: "kokkuvõte" }) };
      }
    }

    await runMeetingSummaryJob(job, {
      usage: usageRecorder(),
      loadOpenAI: async () => ({ default: SlowOpenAI }),
      persistDocument: async () => ({ id: "doc_hb", title: "Kokkuvõte" }),
    });

    assert.equal(takeoverDuringRun, "ACTIVE_JOB_LIMIT", "elav töö ei tohi olla ülevõetav");
    assert.equal(job.status, "done");
  } finally {
    restoreEnv();
    db.rows.clear();
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------------------------
// SOL-MEET-05. Tundmatu kestus reserveeris ALATI täpselt 60 sekundit, ka 12 MB faili puhul, ja
// commit tehti ilma `actualAmount`-ita — seega võeti alati kogu reserveeritud maht. Kokku andis
// see süsteemse möödapääsu `STT_SECONDS` kuulimiidist.
// SOL-MEET-06. Väline veatekst salvestati snapshoti ja tagastati kliendile puhastamata.
// ---------------------------------------------------------------------------------------------

function transcriptionOpenAI({ seconds = null, summary = "kokkuvõte" } = {}) {
  return class {
    constructor() {
      this.audio = {
        transcriptions: {
          create: async () => ({
            text: "kohtumise tekst",
            ...(seconds == null ? {} : { usage: { type: "duration", seconds } }),
          }),
        },
      };
      this.responses = { create: async () => ({ output_text: summary }) };
    }
  };
}

async function runWithReservation(userId, { reservedAmount, providerSeconds, parsedSeconds = null }) {
  const usage = usageRecorder();
  const job = await createMeetingSummaryJob({
    userId,
    payload: { ...samplePayload(), inputDurationSeconds: parsedSeconds },
    usage: {
      stt: { idempotencyKey: `${userId}-stt`, state: "reserved", reservedAmount },
      document: { idempotencyKey: `${userId}-doc`, state: "reserved" },
    },
  });

  await runMeetingSummaryJob(job, {
    usage,
    loadOpenAI: async () => ({ default: transcriptionOpenAI({ seconds: providerSeconds }) }),
    persistDocument: async () => ({ id: "doc", title: "Kokkuvõte" }),
  });

  const sttCommit = usage.calls.find(c => c.action === "commit" && c.idempotencyKey === `${userId}-stt`);
  return { job, sttCommit };
}

test("mõõdetud lühem kestus võetakse arvele tegeliku, mitte reserveeritud mahuga", async () => {
  const root = await makeRoot();
  try {
    process.env.AGENT_STORAGE_DIR = root;
    process.env.OPENAI_API_KEY = "test-key";

    // Tundmatu kestus → mahupõhine ohutu reserv 3000 s; päris audio oli 42 s.
    const { job, sttCommit } = await runWithReservation("meet-05-short", {
      reservedAmount: 3000,
      providerSeconds: 42,
    });

    assert.equal(job.status, "done");
    assert.equal(sttCommit.actualAmount, 42, "arvele läheb mõõdetud kestus, mitte reserv");
  } finally {
    restoreEnv();
    db.rows.clear();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("mõõdetud kestus klammerdub reservatsiooni piiri — rohkem kui reserveeriti ei võeta", async () => {
  const root = await makeRoot();
  try {
    process.env.AGENT_STORAGE_DIR = root;
    process.env.OPENAI_API_KEY = "test-key";

    const { sttCommit } = await runWithReservation("meet-05-clamp", {
      reservedAmount: 100,
      providerSeconds: 5000,
    });

    assert.equal(sttCommit.actualAmount, 100);
  } finally {
    restoreEnv();
    db.rows.clear();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("murdosa sekundit ümardatakse ÜLES, mitte alla", async () => {
  const root = await makeRoot();
  try {
    process.env.AGENT_STORAGE_DIR = root;
    process.env.OPENAI_API_KEY = "test-key";

    const { sttCommit } = await runWithReservation("meet-05-ceil", {
      reservedAmount: 600,
      providerSeconds: 12.2,
    });

    assert.equal(sttCommit.actualAmount, 13);
  } finally {
    restoreEnv();
    db.rows.clear();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("kui kestust ei õnnestunud kuskilt mõõta, jääb commit reservatsiooni peale", async () => {
  const root = await makeRoot();
  try {
    process.env.AGENT_STORAGE_DIR = root;
    process.env.OPENAI_API_KEY = "test-key";

    const { sttCommit } = await runWithReservation("meet-05-unknown", {
      reservedAmount: 600,
      providerSeconds: null,
      parsedSeconds: null,
    });

    assert.equal(sttCommit.actualAmount, undefined, "tundmatu mõõdu korral ei tohi väiksemat summat välja mõelda");
  } finally {
    restoreEnv();
    db.rows.clear();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("provideri toorviga EI jõua snapshoti ega kasutajani", async () => {
  const root = await makeRoot();
  const userId = "meet-06-user";
  const SALADUS = "sk-live-SECRET-KEY /var/lib/sotsiaalai/agent/internal";
  try {
    process.env.AGENT_STORAGE_DIR = root;
    process.env.OPENAI_API_KEY = "test-key";

    const job = await createMeetingSummaryJob({
      userId, payload: samplePayload(), usage: reservedUsage("leak"),
    });

    await runMeetingSummaryJob(job, {
      usage: usageRecorder(),
      loadOpenAI: async () => {
        throw new Error(`OpenAI request failed: ${SALADUS}`);
      },
    });

    assert.equal(job.status, "error");
    assert.equal(job.error, "documents.agent_workspace.meeting_summary.error",
      "avalik viga peab olema allowlistitud võti");
    assert.ok(!job.error.includes("sk-live"), "võti ei tohi kanda toorteksti");

    const persisted = await fs.readFile(path.join(jobsDirFor(root), `${job.id}.json`), "utf8");
    assert.ok(!persisted.includes("sk-live"), "saladus ei tohi püsivasse snapshoti jõuda");
    assert.ok(!persisted.includes("/var/lib/sotsiaalai"), "sisemine tee ei tohi snapshoti jõuda");
  } finally {
    restoreEnv();
    db.rows.clear();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("meie oma võtmega viga jõuab kasutajani muutmata", async () => {
  const root = await makeRoot();
  const userId = "meet-06-key";
  try {
    process.env.AGENT_STORAGE_DIR = root;
    delete process.env.OPENAI_API_KEY;

    const job = await createMeetingSummaryJob({
      userId, payload: samplePayload(), usage: reservedUsage("key"),
    });

    await runMeetingSummaryJob(job, { usage: usageRecorder() });

    assert.equal(job.status, "error");
    assert.equal(job.error, "api.stt.not_configured",
      "seadistusviga on kasutajale mõistetav ja peab võtmena alles jääma");
  } finally {
    restoreEnv();
    db.rows.clear();
    await fs.rm(root, { recursive: true, force: true });
  }
});
