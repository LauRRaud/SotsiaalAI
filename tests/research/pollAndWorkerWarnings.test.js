import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  attachResearchJobEvents,
  scheduleResearchPollTimeout
} from "../../app/api/research/jobs/[id]/stream/route.js";
import { scheduleResearchPersistencePollTimeout } from "../../components/chat/hooks/useChatStream.js";

function fakeTimers() {
  const timers = [];
  return {
    timers,
    setTimeout(callback, timeoutMs) {
      const timer = { callback, timeoutMs, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimeout(timer) {
      timer.cleared = true;
    }
  };
}

for (const [name, schedule] of [
  ["server db poll", scheduleResearchPollTimeout],
  ["client persistence poll", scheduleResearchPersistencePollTimeout]
]) {
  test(`${name} timeout runs once and can be cleaned before completion`, () => {
    const timers = fakeTimers();
    let timedOut = 0;
    const clear = schedule(() => { timedOut += 1; }, {
      timeoutMs: 123,
      setTimeoutImpl: timers.setTimeout,
      clearTimeoutImpl: timers.clearTimeout
    });
    assert.equal(timers.timers[0].timeoutMs, 123);
    clear();
    assert.equal(timers.timers[0].cleared, true);
    timers.timers[0].callback();
    assert.equal(timedOut, 0);

    const activeClear = schedule(() => { timedOut += 1; }, {
      timeoutMs: 456,
      setTimeoutImpl: timers.setTimeout,
      clearTimeoutImpl: timers.clearTimeout
    });
    timers.timers[1].callback();
    timers.timers[1].callback();
    activeClear();
    assert.equal(timedOut, 1);
  });
}

test("a terminal in-memory job replays the same result snapshot as DB polling", () => {
  const terminalJob = {
    id: "job-terminal-race",
    status: "done",
    result: { report_text: "Race'i järel valmis" },
    metrics: { total_ms: 42 }
  };
  const emitted = [];
  let subscribeCalls = 0;
  attachResearchJobEvents({
    job: terminalJob,
    emit: event => emitted.push(event),
    subscribe: () => {
      subscribeCalls += 1;
      return () => {};
    }
  });
  assert.equal(subscribeCalls, 0, "a job that completed before GET must use its durable snapshot");
  assert.deepEqual(
    emitted,
    [
      {
        type: "result",
        result: { report_text: "Race'i järel valmis" },
        metrics: { total_ms: 42 }
      },
      { type: "status", status: "done" },
      { type: "done" }
    ]
  );
});

test("completion while GET subscribes still delivers result before done", () => {
  const emitted = [];
  const job = { id: "job-subscribe-race", status: "running" };
  attachResearchJobEvents({
    job,
    emit: event => emitted.push(event),
    subscribe: (_jobId, emit) => {
      job.status = "done";
      emit({ type: "result", result: { report_text: "Valmis subscribe'i ajal" } });
      emit({ type: "status", status: "done" });
      emit({ type: "done" });
      return () => {};
    }
  });
  assert.deepEqual(emitted.map(event => event.type), ["result", "status", "done"]);
});

function environmentFile(mode) {
  return [
    "NODE_ENV=production",
    "NEXT_PUBLIC_SITE_URL=https://example.test",
    "APP_URL=https://example.test",
    "NEXTAUTH_URL=https://example.test",
    "NEXTAUTH_SECRET=test-secret-value",
    "DATABASE_URL=postgresql://user:pass@example.test/db?sslmode=verify-full",
    "OPENAI_API_KEY=test-key",
    "RAG_SERVICE_API_KEY=test-rag-key",
    "RAG_INTERNAL_HOST=rag.example.test",
    "RAG_API_BASE=https://rag.example.test",
    "EMAIL_FROM=test@example.test",
    `RESEARCH_JOB_MODE=${mode}`
  ].join("\n");
}

test("worker mode warns while inline mode remains unchanged", () => {
  const folder = mkdtempSync(join(tmpdir(), "sotsiaalai-perf-p0-"));
  try {
    const workerFile = join(folder, "worker.env");
    const inlineFile = join(folder, "inline.env");
    writeFileSync(workerFile, environmentFile("worker"));
    writeFileSync(inlineFile, environmentFile("inline"));

    // Spawn check-env with a hermetic environment so the real .env loaded by
    // imported app code (e.g. SUBSCRIPTION_RECURRING_ENABLED) cannot override the
    // fixture file under test. Mirrors tests/chat/ragAuthConfig.test.js.
    const spawnEnv = { ...process.env };
    for (const key of [
      "NODE_ENV", "NEXT_PUBLIC_SITE_URL", "APP_URL", "NEXTAUTH_URL", "NEXTAUTH_SECRET",
      "AUTH_SECRET", "DATABASE_URL", "OPENAI_API_KEY", "RAG_SERVICE_API_KEY", "RAG_API_KEY",
      "RAG_INTERNAL_HOST", "RAG_API_BASE", "EMAIL_FROM", "RESEARCH_JOB_MODE",
      "SUBSCRIPTION_RECURRING_ENABLED", "MAKSEKESKUS_PUBLIC_KEY"
    ]) {
      delete spawnEnv[key];
    }
    const worker = spawnSync(process.execPath, ["scripts/check-env.mjs", workerFile], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: spawnEnv
    });
    const inline = spawnSync(process.execPath, ["scripts/check-env.mjs", inlineFile], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: spawnEnv
    });
    assert.equal(worker.status, 0, worker.stderr);
    assert.equal(inline.status, 0, inline.stderr);
    assert.match(worker.stdout, /Research worker mode requires sotsiaalai-research-worker\.service/);
    assert.doesNotMatch(inline.stdout, /Research worker mode requires/);

    const deployScript = readFileSync("scripts/deploy-server.mjs", "utf8");
    assert.match(deployScript, /systemctl list-unit-files sotsiaalai-research-worker\.service/);
    assert.match(deployScript, /worker mode is selected but sotsiaalai-research-worker\.service is missing/);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
