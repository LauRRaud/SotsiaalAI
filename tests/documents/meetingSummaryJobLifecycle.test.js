import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createMeetingSummaryJob,
  retryPendingMeetingSummaryUsageSettlements,
  runMeetingSummaryJob,
  shouldDeleteMeetingSummaryJob,
} from "../../lib/documents/meetingSummaryJobs.js";

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
