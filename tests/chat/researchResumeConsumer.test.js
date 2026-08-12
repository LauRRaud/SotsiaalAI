import assert from "node:assert/strict";
import test from "node:test";

import {
  claimActiveResearchLookupResult,
  claimResearchJobConsumer,
  consumeResearchJobStream,
  createResearchActiveStopRegistry,
  createResearchCreateStopCoordinator,
  createResearchExplicitStopAttemptGate,
  createResearchJobRequest,
  findActiveResearchJob,
  isCurrentResearchCreateAttempt,
  persistedResultMatchesRequest,
  recoverResearchJobByIntent,
  requestResearchJobStop
} from "../../components/chat/hooks/useChatStream.js";
import { createLatestRequestGate } from "../../lib/client/latestRequestGate.js";

function events(items) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) yield item;
    }
  };
}

test("an existing research job resumes through one GET stream and restores live progress", async () => {
  const calls = [];
  const statuses = [];
  const stages = [];
  const result = await consumeResearchJobStream({
    jobId: "job-existing-1",
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, method: init.method || "GET" });
      return { ok: true, body: {} };
    },
    createSSEReader: () => events([
      { event: "status", data: JSON.stringify({ status: "queued" }) },
      { event: "progress", data: JSON.stringify({ stage: "retrieving" }) },
      {
        event: "result",
        data: JSON.stringify({
          result: {
            report_text: "Taastatud uuringu tulemus",
            sources: [{ id: "source-1" }]
          }
        })
      },
      { event: "status", data: JSON.stringify({ status: "done" }) },
      { event: "done", data: "{}" }
    ]),
    normalizeSources: sources => sources.map(source => ({ ...source, normalized: true })),
    onStatus: status => statuses.push(status),
    onProgress: stage => stages.push(stage)
  });

  assert.deepEqual(calls, [{
    url: "/api/research/jobs/job-existing-1/stream",
    method: "GET"
  }]);
  assert.equal(calls.some(call => call.method === "POST"), false, "resume must never create a new job");
  assert.deepEqual(statuses, ["queued", "done"]);
  assert.deepEqual(stages, ["retrieving"]);
  assert.equal(result.completionState, "done");
  assert.equal(result.finalText, "Taastatud uuringu tulemus");
  assert.deepEqual(result.finalSources, [{ id: "source-1", normalized: true }]);
});

test("a cancelled resumed job terminates without inventing a successful result", async () => {
  const result = await consumeResearchJobStream({
    jobId: "job-cancelled-1",
    fetchImpl: async () => ({ ok: true, body: {} }),
    createSSEReader: () => events([
      { event: "status", data: JSON.stringify({ status: "running" }) },
      { event: "status", data: JSON.stringify({ status: "cancelled" }) },
      { event: "done", data: "{}" }
    ])
  });

  assert.equal(result.completionState, "cancelled");
  assert.equal(result.finalText, "");
  assert.deepEqual(result.finalSources, []);
});

test("concurrent active-job responses claim one placeholder and one GET stream", async () => {
  const calls = [];
  const consumerRef = { current: null };
  const sequenceRef = { current: 0 };
  const placeholders = [];
  const progress = [];

  const fetchImpl = async (url, init = {}) => {
    const method = init.method || "GET";
    calls.push({ url, method });
    if (url.startsWith("/api/research/jobs?")) {
      await Promise.resolve();
      return {
        ok: true,
        json: async () => ({
          jobs: [{
            id: "job-existing-concurrent",
            query: "Olemasolev uuring",
            createdAt: "2026-08-12T10:00:00.000Z"
          }]
        })
      };
    }
    return { ok: true, body: {} };
  };

  const resume = async () => {
    const active = await findActiveResearchJob({ convId: "conv-1", fetchImpl });
    const claim = claimResearchJobConsumer({
      consumerRef,
      sequenceRef,
      jobId: active?.id,
      convId: "conv-1"
    });
    if (!claim) return false;

    placeholders.push(active.id);
    const result = await consumeResearchJobStream({
      jobId: active.id,
      signal: claim.controller.signal,
      fetchImpl,
      createSSEReader: () => events([
        { event: "progress", data: JSON.stringify({ stage: "synthesizing" }) },
        { event: "result", data: JSON.stringify({ result: { report_text: "Valmis", sources: [] } }) },
        { event: "status", data: JSON.stringify({ status: "done" }) },
        { event: "done", data: "{}" }
      ]),
      onProgress: stage => progress.push(stage)
    });
    return result.completionState === "done";
  };

  const outcomes = await Promise.all([resume(), resume()]);
  assert.deepEqual(outcomes.sort(), [false, true]);
  assert.deepEqual(placeholders, ["job-existing-concurrent"]);
  assert.deepEqual(progress, ["synthesizing"]);
  assert.equal(calls.filter(call => call.url.includes("/stream")).length, 1);
  assert.equal(calls.filter(call => call.method === "POST").length, 0);
  assert.equal(sequenceRef.current, 1);
});

test("a late lookup from the previous conversation cannot claim or block the current one", async () => {
  const gate = createLatestRequestGate();
  const consumerRef = { current: null };
  const sequenceRef = { current: 0 };
  const calls = [];
  const placeholders = [];
  let releaseConversationA;

  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method || "GET" });
    if (url.includes("convId=conv-a")) {
      return new Promise(resolve => {
        releaseConversationA = () => resolve({
          ok: true,
          json: async () => ({ jobs: [{ id: "job-a" }] })
        });
      });
    }
    if (url.includes("convId=conv-b")) {
      return {
        ok: true,
        json: async () => ({ jobs: [{ id: "job-b" }] })
      };
    }
    return { ok: true, body: {} };
  };

  const attemptA = gate.begin("conv-a");
  const lookupA = findActiveResearchJob({
    convId: "conv-a",
    signal: attemptA.signal,
    fetchImpl
  });
  await Promise.resolve();
  gate.invalidate();

  const attemptB = gate.begin("conv-b");
  const activeB = await findActiveResearchJob({
    convId: "conv-b",
    signal: attemptB.signal,
    fetchImpl
  });
  releaseConversationA();
  const activeA = await lookupA;

  const claimA = claimActiveResearchLookupResult({
    lookupAttempt: attemptA,
    currentConvId: "conv-b",
    activeJob: activeA,
    consumerRef,
    sequenceRef
  });
  assert.equal(claimA, null);
  assert.deepEqual(placeholders, []);
  assert.equal(calls.filter(call => call.url.includes("/stream")).length, 0);

  const claimB = claimActiveResearchLookupResult({
    lookupAttempt: attemptB,
    currentConvId: "conv-b",
    activeJob: activeB,
    consumerRef,
    sequenceRef
  });
  assert.equal(claimB?.jobId, "job-b");
  placeholders.push(claimB.jobId);
  await consumeResearchJobStream({
    jobId: claimB.jobId,
    signal: claimB.controller.signal,
    fetchImpl,
    createSSEReader: () => events([{ event: "done", data: "{}" }])
  });

  assert.deepEqual(placeholders, ["job-b"]);
  assert.equal(calls.filter(call => call.url.includes("/stream")).length, 1);
  assert.equal(sequenceRef.current, 1);
});

test("persistence fallback accepts only the matching research job", () => {
  const repeatedQuery = "Sama päring";
  const delayedOldResult = {
    researchJobId: "job-old",
    updatedAt: "2026-08-12T10:05:00.000Z",
    messages: [
      { role: "user", text: repeatedQuery },
      { role: "ai", text: "Vana tulemus" }
    ]
  };
  assert.equal(
    persistedResultMatchesRequest(
      delayedOldResult,
      repeatedQuery,
      Date.parse("2026-08-12T10:00:00.000Z"),
      "job-new"
    ),
    false,
    "a delayed result for the same query must not complete the new job"
  );

  const longQuery = "pikk ".repeat(80).trim();
  assert.ok(longQuery.length > 200);
  assert.equal(
    persistedResultMatchesRequest(
      { ...delayedOldResult, researchJobId: "job-new" },
      longQuery.slice(0, 200),
      Date.parse("2026-08-12T10:04:00.000Z"),
      "job-new"
    ),
    true,
    "the exact job ID must survive a list item's truncated query"
  );
});

test("a lost create response recovers the exact intent before Stop", async () => {
  const calls = [];
  let lookups = 0;
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method || "GET" });
    if (url.startsWith("/api/research/jobs?")) {
      lookups += 1;
      return {
        ok: true,
        json: async () => ({
          jobs: lookups === 1
            ? []
            : [{ id: "job-created-with-lost-response", status: "running" }]
        })
      };
    }
    return { ok: true, json: async () => ({ ok: true, status: "cancelled" }) };
  };

  const recovered = await recoverResearchJobByIntent({
    convId: "conv-lost",
    intentKey: "intent-lost",
    fetchImpl,
    attempts: 2,
    waitImpl: async () => {}
  });
  assert.equal(recovered?.id, "job-created-with-lost-response");
  const stopped = await requestResearchJobStop({ jobId: recovered.id, fetchImpl });
  assert.equal(stopped.status, "cancelled");
  assert.match(calls[0].url, /convId=conv-lost/);
  assert.match(calls[0].url, /intentKey=intent-lost/);
  assert.deepEqual(calls.at(-1), {
    url: "/api/research/jobs/job-created-with-lost-response/stop",
    method: "POST"
  });
});

test("pending create response wakes Stop recovery and cancels the known job exactly once", async () => {
  let markLastLookupEmpty;
  let markLookupAborted;
  let lookupSignal;
  const lastLookupEmpty = new Promise(resolve => {
    markLastLookupEmpty = resolve;
  });
  const lookupAborted = new Promise(resolve => {
    markLookupAborted = resolve;
  });
  const stopCalls = [];
  const coordinator = createResearchCreateStopCoordinator({
    convId: "conv-pending-create",
    intentKey: "intent-pending-create",
    attempts: 1,
    lookupImpl: async ({ signal }) => {
      lookupSignal = signal;
      markLastLookupEmpty();
      return new Promise(resolve => {
        signal.addEventListener("abort", () => {
          markLookupAborted();
          resolve(null);
        }, { once: true });
      });
    },
    stopImpl: async ({ jobId }) => {
      stopCalls.push(jobId);
      return { jobId, status: "cancelled" };
    }
  });

  const stopFromClick = coordinator.requestStop();
  await lastLookupEmpty;
  const stopFromCreateResponse = coordinator.recordCreateJob({
    id: "job-durable-before-response",
    status: "queued"
  });
  await lookupAborted;
  assert.equal(lookupSignal.aborted, true, "the create ID preempts the stale intent lookup");

  const [clickResult, createResult] = await Promise.all([stopFromClick, stopFromCreateResponse]);
  assert.equal(clickResult.outcome, "cancelled");
  assert.equal(createResult.outcome, "cancelled");
  assert.deepEqual(stopCalls, ["job-durable-before-response"]);
  assert.equal(coordinator.shouldStartStream(), false, "a stopped create response opens no stream");
});

test("create timeout wakes a final intent lookup and stops a late durable job", async () => {
  let lookupCount = 0;
  const stopCalls = [];
  const baseController = new AbortController();
  const timeoutController = new AbortController();
  let timeoutWiringCalls = 0;
  const coordinator = createResearchCreateStopCoordinator({
    convId: "conv-create-timeout",
    intentKey: "intent-create-timeout",
    attempts: 1,
    lookupImpl: async () => {
      lookupCount += 1;
      return lookupCount === 1
        ? null
        : { id: "job-visible-after-timeout", status: "running" };
    },
    stopImpl: async ({ jobId }) => {
      stopCalls.push(jobId);
      return { jobId, status: "cancelled" };
    }
  });

  const stopResult = coordinator.requestStop();
  await new Promise(resolve => setImmediate(resolve));
  const createRequest = createResearchJobRequest({
    controller: baseController,
    payload: {
      query: "Ajastatud uuring",
      convId: "conv-create-timeout",
      idempotencyKey: "intent-create-timeout"
    },
    timeoutSignalImpl: (signal, timeoutMs) => {
      timeoutWiringCalls += 1;
      assert.equal(signal, baseController.signal);
      assert.equal(timeoutMs, 30_000);
      return timeoutController.signal;
    },
    fetchImpl: async (url, init = {}) => {
      assert.equal(url, "/api/research/jobs");
      assert.equal(init.method, "POST");
      assert.equal(init.signal, timeoutController.signal);
      return new Promise((resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          reject(Object.assign(new Error("timeout"), { name: "TimeoutError" }));
        }, { once: true });
      });
    }
  });
  timeoutController.abort();
  const createError = await createRequest.catch(error => error);
  assert.equal(createError.name, "TimeoutError");
  assert.equal(baseController.signal.aborted, false, "create timeout must not poison the stream controller");
  void coordinator.recordCreateFailure(createError);

  const result = await stopResult;
  assert.equal(result.outcome, "cancelled");
  assert.equal(timeoutWiringCalls, 1);
  assert.equal(lookupCount, 2, "one pending-create lookup plus one post-timeout lookup");
  assert.deepEqual(stopCalls, ["job-visible-after-timeout"]);
  assert.equal(coordinator.shouldStartStream(), false);
});

test("pending-create Stop lookup is bounded and never guesses a job ID", async () => {
  const calls = [];
  let timeoutSignals = 0;
  const coordinator = createResearchCreateStopCoordinator({
    convId: "conv-not-visible-yet",
    intentKey: "intent-not-visible-yet",
    lookupImpl: async ({ signal }) => {
      calls.push({ method: "GET", signal });
      return null;
    },
    attempts: 3,
    timeoutSignalImpl: (signal, timeoutMs) => {
      assert.equal(signal instanceof AbortSignal, true);
      assert.equal(timeoutMs, 4_000);
      timeoutSignals += 1;
      return `lookup-timeout-${timeoutSignals}`;
    },
    waitImpl: async () => {}
  });
  void coordinator.recordCreateFailure();
  const result = await coordinator.requestStop();

  assert.equal(result.outcome, "not_found");
  assert.equal(result.job, null);
  assert.equal(calls.length, 3);
  assert.equal(timeoutSignals, 3, "every lookup attempt has its own client timeout");
  assert.equal(calls.every(call => call.method === "GET"), true);
  assert.deepEqual(calls.map(call => call.signal), [
    "lookup-timeout-1",
    "lookup-timeout-2",
    "lookup-timeout-3"
  ]);
});

test("late pending-create recovery cannot write into a different conversation", () => {
  const originalAttempt = { convId: "conv-original" };
  assert.equal(isCurrentResearchCreateAttempt({
    attempt: originalAttempt,
    currentAttempt: originalAttempt,
    currentConvId: "conv-original"
  }), true);
  assert.equal(isCurrentResearchCreateAttempt({
    attempt: originalAttempt,
    currentAttempt: originalAttempt,
    currentConvId: "conv-next"
  }), false);
  assert.equal(isCurrentResearchCreateAttempt({
    attempt: originalAttempt,
    currentAttempt: { convId: "conv-next" },
    currentConvId: "conv-next"
  }), false);
});

test("a failed coordinator Stop retains the known job for one explicit retry", async () => {
  let stopCalls = 0;
  const coordinator = createResearchCreateStopCoordinator({
    convId: "conv-retry-stop",
    intentKey: "intent-retry-stop",
    attempts: 1,
    lookupImpl: async () => ({ id: "job-retry-stop", status: "running" }),
    stopImpl: async ({ jobId }) => {
      stopCalls += 1;
      assert.equal(jobId, "job-retry-stop");
      if (stopCalls === 1) throw Object.assign(new Error("failed"), { chatKey: "research.error.failed" });
      return { jobId, status: "cancelled" };
    }
  });

  const first = await coordinator.requestStop();
  assert.equal(first.outcome, "stop_failed");
  assert.equal(first.job?.id, "job-retry-stop");
  assert.equal(coordinator.shouldStartStream(), false);

  const retry = await coordinator.requestStop();
  assert.equal(retry.outcome, "cancelled");
  assert.equal(retry.job?.id, "job-retry-stop");
  assert.equal(stopCalls, 2);

  const sealed = await coordinator.requestStop();
  assert.equal(sealed.outcome, "cancelled");
  assert.equal(stopCalls, 2, "confirmed cancellation seals the coordinator against a third Stop");
});

test("late create outcomes cannot silently retry a failed pending-create Stop", async () => {
  let stopCalls = 0;
  const coordinator = createResearchCreateStopCoordinator({
    convId: "conv-explicit-retry",
    intentKey: "intent-explicit-retry",
    attempts: 1,
    lookupImpl: async () => ({ id: "job-explicit-retry", status: "running" }),
    stopImpl: async ({ jobId }) => {
      stopCalls += 1;
      if (stopCalls === 1) throw new Error("stop failed");
      return { jobId, status: "cancelled" };
    }
  });
  const gate = createResearchExplicitStopAttemptGate();
  const runHookAttempt = async ({ explicit = false } = {}) => {
    if (!gate.begin({ explicit })) return gate.lastResult();
    return gate.record(await coordinator.requestStop());
  };

  const first = await runHookAttempt({ explicit: true });
  assert.equal(first.outcome, "stop_failed");
  assert.equal(stopCalls, 1);

  await coordinator.recordCreateJob({ id: "job-explicit-retry", status: "running" });
  await coordinator.recordCreateFailure();
  await Promise.resolve();
  const lateTransportPath = await runHookAttempt();
  assert.equal(lateTransportPath.outcome, "stop_failed");
  assert.equal(stopCalls, 1, "late create success/failure must not impersonate a second user Stop");

  const retry = await runHookAttempt({ explicit: true });
  assert.equal(retry.outcome, "cancelled");
  assert.equal(stopCalls, 2);
  assert.equal(gate.attempts(), 2);
});

test("a late known job may still fulfil the original Stop after a bounded not-found result", async () => {
  let stopCalls = 0;
  const coordinator = createResearchCreateStopCoordinator({
    convId: "conv-late-visible",
    intentKey: "intent-late-visible",
    attempts: 1,
    lookupImpl: async () => null,
    stopImpl: async ({ jobId }) => {
      stopCalls += 1;
      return { jobId, status: "cancelled" };
    }
  });
  const gate = createResearchExplicitStopAttemptGate();
  const runHookAttempt = async ({ explicit = false } = {}) => {
    if (!gate.begin({ explicit })) return gate.lastResult();
    return gate.record(await coordinator.requestStop());
  };

  await coordinator.recordCreateFailure();
  const first = await runHookAttempt({ explicit: true });
  assert.equal(first.outcome, "not_found");
  assert.equal(stopCalls, 0);

  await coordinator.recordCreateJob({ id: "job-late-visible", status: "running" });
  const continuedOriginalStop = await runHookAttempt();
  assert.equal(continuedOriginalStop.outcome, "cancelled");
  assert.equal(stopCalls, 1, "not-found must not discard the user's original Stop intent");
});

test("a stale active-job Stop cannot mutate or block the next conversation job", async () => {
  const resolvers = new Map();
  const stopCalls = [];
  const registry = createResearchActiveStopRegistry({
    stopImpl: ({ jobId }) => {
      stopCalls.push(jobId);
      return new Promise(resolve => resolvers.set(jobId, resolve));
    }
  });
  const claimA = { token: 1, jobId: "job-a", convId: "conv-a", controller: new AbortController() };
  const claimB = { token: 2, jobId: "job-b", convId: "conv-b", controller: new AbortController() };
  let currentClaim = claimA;
  const cancelledMessages = [];
  const requestFor = claim => registry.requestStop({
    jobId: claim.jobId,
    claim,
    convId: claim.convId,
    messageId: `message-${claim.jobId}`,
    isCurrent: target => currentClaim === target.claim,
    onCancelled: target => cancelledMessages.push(target.messageId)
  });

  const stopA = requestFor(claimA);
  const duplicateA = requestFor(claimA);
  assert.equal(stopA, duplicateA, "the same durable job has one in-flight Stop");
  await Promise.resolve();
  currentClaim = claimB; // detach A, then claim B
  const stopB = requestFor(claimB);
  await Promise.resolve();
  assert.deepEqual(stopCalls, ["job-a", "job-b"], "B Stop is not blocked by A's pending response");

  resolvers.get("job-a")({ jobId: "job-a", status: "cancelled" });
  const resultA = await stopA;
  assert.equal(resultA.outcome, "cancelled");
  assert.deepEqual(cancelledMessages, [], "late A response cannot mutate B's message or teardown B");
  assert.equal(claimB.controller.signal.aborted, false);

  resolvers.get("job-b")({ jobId: "job-b", status: "cancelled" });
  const resultB = await stopB;
  assert.equal(resultB.outcome, "cancelled");
  assert.deepEqual(cancelledMessages, ["message-job-b"]);
});
