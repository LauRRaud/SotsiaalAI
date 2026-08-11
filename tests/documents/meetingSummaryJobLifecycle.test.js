import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createMeetingSummaryJob,
  runMeetingSummaryJob,
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
