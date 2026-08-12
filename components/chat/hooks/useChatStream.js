import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { createSSEReader as defaultCreateSSEReader } from "../utils/sse";
import { normalizeSources as defaultNormalizeSources } from "../utils/sources";
import { localizePath } from "@/lib/localizePath";
import { createLatestRequestGate, withRequestTimeout } from "@/lib/client/latestRequestGate";
import { buildIntentSignature, resolveIntentKey } from "@/lib/usage/intentKey";

function formatI18n(template, values) {
  if (!values) return template;
  let out = template;
  for (const [key, value] of Object.entries(values)) {
    out = out.split(`{${key}}`).join(String(value));
  }
  return out;
}

function createLocalizedError(key, values) {
  const err = new Error(key);
  err.chatKey = key;
  err.chatValues = values;
  return err;
}

function readApiErrorKey(payload) {
  const key = typeof payload?.messageKey === "string" ? payload.messageKey.trim() : "";
  if (key) return key;
  const message = typeof payload?.message === "string" ? payload.message.trim() : "";
  if (!message) return "";
  if (/^[a-z][a-z0-9_.:-]*$/i.test(message)) return message;
  return "";
}

function getResearchProgressText(tr, stage) {
  if (stage === "planning") return tr("chat.deep_research.stage_planning");
  if (stage === "retrieving") return tr("chat.deep_research.stage_retrieving");
  if (stage === "synthesizing") return tr("chat.deep_research.stage_synthesizing");
  return tr("chat.deep_research.running");
}

/**
 * Consume one already-created research job. Creation deliberately lives elsewhere: reconnecting
 * after a soft navigation must issue only a GET for the existing job, never a second paid POST.
 * The function is UI-agnostic so the same event contract drives both a fresh and a resumed job.
 */
export async function consumeResearchJobStream({
  jobId,
  signal,
  fetchImpl = globalThis.fetch,
  createSSEReader = defaultCreateSSEReader,
  normalizeSources = defaultNormalizeSources,
  onStatus,
  onProgress,
  shouldStop
} = {}) {
  const id = String(jobId || "").trim();
  if (!id || typeof fetchImpl !== "function") {
    throw createLocalizedError("chat.deep_research.error_generic");
  }

  const response = await fetchImpl(`/api/research/jobs/${encodeURIComponent(id)}/stream`, {
    method: "GET",
    cache: "no-store",
    signal
  });
  if (!response?.ok || !response?.body) {
    const payload = await response?.json?.().catch(() => ({}));
    throw createLocalizedError(readApiErrorKey(payload) || "chat.deep_research.error_generic");
  }

  let completionState = "error";
  let finalText = "";
  let finalSources = [];
  const reader = createSSEReader(response.body);

  for await (const event of reader) {
    if (shouldStop?.()) break;
    if (event.event === "status") {
      try {
        const payload = JSON.parse(event.data || "{}");
        const status = String(payload?.status || "").trim();
        onStatus?.(status);
        if (status === "done") completionState = "done";
        if (status === "cancelled") completionState = "cancelled";
      } catch {}
      continue;
    }

    if (event.event === "progress") {
      try {
        const payload = JSON.parse(event.data || "{}");
        onProgress?.(String(payload?.stage || "").trim());
      } catch {}
      continue;
    }

    if (event.event === "result") {
      try {
        const payload = JSON.parse(event.data || "{}");
        finalText = String(payload?.result?.report_text || "").trim();
        finalSources = normalizeSources(payload?.result?.sources ?? []);
      } catch {}
      continue;
    }

    if (event.event === "error") {
      let errorKey = "chat.deep_research.error_generic";
      try {
        const payload = JSON.parse(event.data || "{}");
        const apiKey = readApiErrorKey(payload);
        if (apiKey === "research.error.cancelled") {
          errorKey = "chat.deep_research.cancelled";
        } else if (apiKey) {
          errorKey = apiKey;
        }
      } catch {}
      throw createLocalizedError(errorKey);
    }

    if (event.event === "done") break;
  }

  return { completionState, finalText, finalSources };
}

export async function findActiveResearchJob({
  convId,
  signal,
  fetchImpl = globalThis.fetch
} = {}) {
  const conversationId = String(convId || "").trim();
  if (!conversationId || typeof fetchImpl !== "function") return null;

  const response = await fetchImpl(
    `/api/research/jobs?convId=${encodeURIComponent(conversationId)}&status=active&limit=1`,
    { method: "GET", cache: "no-store", signal }
  );
  if (!response?.ok) return null;
  const payload = await response.json().catch(() => ({}));
  const active = Array.isArray(payload?.jobs) ? payload.jobs[0] : null;
  const jobId = String(active?.id || "").trim();
  return jobId ? { ...active, id: jobId } : null;
}

export async function findResearchJobByIntent({
  convId,
  intentKey,
  signal,
  fetchImpl = globalThis.fetch
} = {}) {
  const conversationId = String(convId || "").trim();
  const key = String(intentKey || "").trim();
  if (!conversationId || !key || typeof fetchImpl !== "function") return null;

  const params = new URLSearchParams({
    convId: conversationId,
    intentKey: key,
    limit: "1"
  });
  const response = await fetchImpl(`/api/research/jobs?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
    signal
  });
  if (!response?.ok) return null;
  const payload = await response.json().catch(() => ({}));
  const job = Array.isArray(payload?.jobs) ? payload.jobs[0] : null;
  const jobId = String(job?.id || "").trim();
  return jobId ? { ...job, id: jobId } : null;
}

export async function requestResearchJobStop({
  jobId,
  fetchImpl = globalThis.fetch
} = {}) {
  const id = String(jobId || "").trim();
  if (!id || typeof fetchImpl !== "function") {
    throw createLocalizedError("chat.deep_research.error_generic");
  }
  const response = await fetchImpl(`/api/research/jobs/${encodeURIComponent(id)}/stop`, {
    method: "POST"
  });
  const payload = await response?.json?.().catch(() => ({}));
  if (!response?.ok || payload?.ok === false) {
    throw createLocalizedError(readApiErrorKey(payload) || "chat.deep_research.error_generic");
  }
  return {
    jobId: id,
    status: String(payload?.status || "cancelled").trim().toLowerCase()
  };
}

export async function recoverResearchJobByIntent({
  convId,
  intentKey,
  fetchImpl = globalThis.fetch,
  attempts = 5,
  lookupTimeoutMs = 4_000,
  timeoutSignalImpl = withRequestTimeout,
  waitImpl = ms => new Promise(resolve => setTimeout(resolve, ms))
} = {}) {
  const maxAttempts = Math.max(1, Math.min(10, Math.trunc(Number(attempts) || 1)));
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const job = await findResearchJobByIntent({
        convId,
        intentKey,
        fetchImpl,
        signal: timeoutSignalImpl(null, lookupTimeoutMs)
      });
      if (job) return job;
    } catch {}
    if (attempt + 1 < maxAttempts) await waitImpl(Math.min(2000, 250 * (2 ** attempt)));
  }
  return null;
}

/**
 * One owner for the create-response/Stop race. A Stop request starts exact intent recovery, but the
 * reconciliation cannot finish `not_found` while the create request still has no definite outcome.
 * A job ID arriving from either path is stopped through the same single-flight promise.
 */
export function createResearchCreateStopCoordinator({
  convId,
  intentKey,
  fetchImpl = globalThis.fetch,
  attempts = 5,
  lookupTimeoutMs = 4_000,
  timeoutSignalImpl = withRequestTimeout,
  waitImpl = ms => new Promise(resolve => setTimeout(resolve, ms)),
  lookupImpl = findResearchJobByIntent,
  stopImpl = requestResearchJobStop
} = {}) {
  let knownJob = null;
  let createSettled = false;
  let stopRequested = false;
  let reconciliationPromise = null;
  let stopPromise = null;
  let terminalResult = null;
  let stateWaiters = [];
  let lookupController = null;

  const notifyStateChanged = () => {
    lookupController?.abort();
    const waiters = stateWaiters;
    stateWaiters = [];
    for (const resolve of waiters) resolve();
  };
  const waitForStateChange = () => new Promise(resolve => {
    stateWaiters.push(resolve);
  });

  const stopKnownJobOnce = job => {
    const jobId = String(job?.id || "").trim();
    if (!jobId) return Promise.resolve({ outcome: "not_found", job: null, stop: null, error: null });
    if (terminalResult) return Promise.resolve(terminalResult);
    if (stopPromise) return stopPromise;

    stopPromise = Promise.resolve(stopImpl({ jobId, fetchImpl }))
      .then(stop => {
        const result = {
          outcome: stop?.status === "cancelled" ? "cancelled" : "terminal",
          job,
          stop,
          error: null
        };
        terminalResult = result;
        return result;
      })
      .catch(error => ({ outcome: "stop_failed", job, stop: null, error }))
      .finally(() => {
        if (!terminalResult) stopPromise = null;
      });
    return stopPromise;
  };

  const recoverExactJobBatch = async () => {
    const maxAttempts = Math.max(1, Math.min(10, Math.trunc(Number(attempts) || 1)));
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (knownJob?.id) return knownJob;
      const controller = new AbortController();
      lookupController = controller;
      try {
        const job = await lookupImpl({
          convId,
          intentKey,
          fetchImpl,
          signal: timeoutSignalImpl(controller.signal, lookupTimeoutMs)
        });
        if (job?.id) return job;
      } catch {}
      finally {
        if (lookupController === controller) lookupController = null;
      }
      if (knownJob?.id) return knownJob;
      if (attempt + 1 < maxAttempts) {
        await Promise.race([
          waitImpl(Math.min(2000, 250 * (2 ** attempt))),
          waitForStateChange()
        ]);
      }
    }
    return null;
  };

  const reconcile = async () => {
    while (true) {
      if (terminalResult) return terminalResult;
      if (knownJob?.id) return stopKnownJobOnce(knownJob);

      const createWasSettledAtBatchStart = createSettled;
      const recovered = await recoverExactJobBatch();
      if (recovered?.id && !knownJob?.id) knownJob = recovered;
      if (knownJob?.id) return stopKnownJobOnce(knownJob);
      if (createSettled && createWasSettledAtBatchStart) {
        return { outcome: "not_found", job: null, stop: null, error: null };
      }
      // If the POST settled during the batch, run one fresh bounded batch after that outcome. This
      // covers a server commit that became visible just after the client timed out or disconnected.
      if (createSettled) continue;

      // The bounded lookup finished before the POST did. Wait instead of declaring success or
      // spinning; create success/failure wakes one final bounded recovery cycle.
      await waitForStateChange();
    }
  };

  const requestStop = () => {
    stopRequested = true;
    if (terminalResult) return Promise.resolve(terminalResult);
    if (reconciliationPromise) return reconciliationPromise;
    const current = reconcile().finally(() => {
      if (reconciliationPromise === current && !terminalResult) reconciliationPromise = null;
    });
    reconciliationPromise = current;
    return current;
  };

  const currentReconciliation = () => (
    stopRequested && reconciliationPromise
      ? reconciliationPromise
      : Promise.resolve(null)
  );

  const recordCreateJob = job => {
    const jobId = String(job?.id || "").trim();
    if (jobId) knownJob = { ...job, id: jobId };
    createSettled = true;
    notifyStateChanged();
    // A create outcome may wake the reconciliation started by the user's Stop, but it must never
    // invent a second Stop after that attempt already failed. Only a fresh explicit requestStop()
    // may retry a failed durable cancellation.
    return currentReconciliation();
  };

  const recordCreateFailure = () => {
    createSettled = true;
    notifyStateChanged();
    return currentReconciliation();
  };

  return Object.freeze({
    requestStop,
    recordCreateJob,
    recordCreateFailure,
    isStopRequested: () => stopRequested,
    shouldStartStream: () => !stopRequested && !terminalResult
  });
}

/**
 * Scope active-job Stop flights by durable job identity. A late response for conversation A may
 * finish on the server, but it cannot mutate or tear down conversation B's consumer. The map also
 * deduplicates repeated clicks for the same job while allowing a different current job to be
 * stopped without waiting for an older flight.
 */
export function createResearchActiveStopRegistry({
  stopImpl = requestResearchJobStop
} = {}) {
  const flights = new Map();

  const requestStop = ({
    jobId,
    claim = null,
    convId = "",
    messageId = null,
    fetchImpl = globalThis.fetch,
    isCurrent = () => false,
    onCancelled = () => {},
    onError = () => {}
  } = {}) => {
    const id = String(jobId || "").trim();
    if (!id) return Promise.resolve({ outcome: "not_found", target: null, stop: null, error: null });

    const existing = flights.get(id);
    if (existing) return existing.promise;

    const target = Object.freeze({
      jobId: id,
      claim,
      convId: String(convId || "").trim(),
      messageId
    });
    const flight = { target, promise: null };
    const targetIsCurrent = () => Boolean(isCurrent(target));

    flight.promise = Promise.resolve()
      .then(() => stopImpl({ jobId: id, fetchImpl }))
      .then(stop => {
        const outcome = stop?.status === "cancelled" ? "cancelled" : "terminal";
        if (outcome === "cancelled" && targetIsCurrent()) {
          onCancelled(target, stop);
        }
        return { outcome, target, stop, error: null };
      })
      .catch(error => {
        if (targetIsCurrent()) onError(target, error);
        return { outcome: "stop_failed", target, stop: null, error };
      })
      .finally(() => {
        if (flights.get(id) === flight) flights.delete(id);
      });

    flights.set(id, flight);
    return flight.promise;
  };

  return Object.freeze({
    requestStop,
    hasPending: jobId => flights.has(String(jobId || "").trim())
  });
}

/**
 * Only a real user Stop may open a new attempt after a confirmed Stop failure. Create completion
 * and catch paths may finish or reuse the attempt that is already in flight, but they cannot turn
 * a late transport event into an implicit retry.
 */
export function createResearchExplicitStopAttemptGate() {
  let attempts = 0;
  let lastResult = null;
  return Object.freeze({
    begin({ explicit = false } = {}) {
      // `not_found` is not a failed Stop: after a timed-out create request the durable row may
      // become visible later, and the original user intent must still be fulfilled automatically.
      // A real Stop failure, by contrast, requires another explicit user action.
      if (attempts > 0 && !explicit && lastResult?.outcome !== "not_found") return false;
      attempts += 1;
      return true;
    },
    record(result) {
      lastResult = result || null;
      return lastResult;
    },
    lastResult: () => lastResult,
    attempts: () => attempts
  });
}

export function isCurrentResearchCreateAttempt({
  attempt,
  currentAttempt,
  currentConvId
} = {}) {
  const convId = String(attempt?.convId || "").trim();
  return Boolean(
    attempt
    && currentAttempt === attempt
    && convId
    && String(currentConvId || "").trim() === convId
  );
}

export function claimActiveResearchLookupResult({
  lookupAttempt,
  currentConvId,
  activeJob,
  consumerRef,
  sequenceRef
} = {}) {
  const convId = String(currentConvId || "").trim();
  if (
    !lookupAttempt?.isCurrent?.()
    || String(lookupAttempt?.key || "").trim() !== convId
    || !activeJob?.id
  ) {
    return null;
  }
  return claimResearchJobConsumer({
    consumerRef,
    sequenceRef,
    jobId: activeJob.id,
    convId
  });
}

/**
 * Claim one UI consumer synchronously. Concurrent list responses run in separate microtasks, but
 * JavaScript executes this check-and-set without an await in between, so only one caller may add a
 * placeholder and open the durable job's stream.
 */
export function claimResearchJobConsumer({
  consumerRef,
  sequenceRef,
  jobId,
  convId,
  controller: suppliedController = null
} = {}) {
  const id = String(jobId || "").trim();
  const conversationId = String(convId || "").trim();
  if (!consumerRef || !sequenceRef || !id || !conversationId || consumerRef.current) return null;

  const controller = suppliedController || new AbortController();
  const token = (Number(sequenceRef.current) || 0) + 1;
  sequenceRef.current = token;
  const claim = { token, jobId: id, convId: conversationId, controller };
  consumerRef.current = claim;
  return claim;
}

const RESEARCH_POLL_TIMEOUT_MS = readPositiveNumber(
  process.env.NEXT_PUBLIC_RESEARCH_ACTIVE_JOB_STALE_MS,
  15 * 60 * 1000
);
const RESEARCH_ACTIVE_LOOKUP_TIMEOUT_MS = 10_000;
const RESEARCH_CREATE_TIMEOUT_MS = 30_000;

export function createResearchJobRequest({
  payload,
  controller,
  fetchImpl = globalThis.fetch,
  timeoutSignalImpl = withRequestTimeout,
  timeoutMs = RESEARCH_CREATE_TIMEOUT_MS
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw createLocalizedError("chat.deep_research.error_generic");
  }
  return fetchImpl("/api/research/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload || {}),
    signal: timeoutSignalImpl(controller?.signal || null, timeoutMs)
  });
}

function readPositiveNumber(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

export function scheduleResearchPersistencePollTimeout(onTimeout, {
  timeoutMs = RESEARCH_POLL_TIMEOUT_MS,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout
} = {}) {
  let active = true;
  const timer = setTimeoutImpl(() => {
    if (!active) return;
    active = false;
    onTimeout?.();
  }, timeoutMs);
  return () => {
    if (!active) return;
    active = false;
    clearTimeoutImpl(timer);
  };
}

function normalizeAttachments(payload) {
  if (!Array.isArray(payload)) return [];
  return payload
    .filter(item => item && typeof item === "object")
    .map(item => {
      const label = String(item.label || "").trim();
      const url = String(item.url || "").trim();
      const fileName = String(item.fileName || "").trim();
      const format = String(item.format || "").trim();
      if (!url) return null;
      return {
        label: label || "Download file",
        url,
        ...(fileName ? { fileName } : {}),
        ...(format ? { format } : {})
      };
    })
    .filter(Boolean);
}

function normalizeCards(payload) {
  if (!Array.isArray(payload)) return [];
  return payload
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const title = String(item.title || "").trim();
      const subtitle = String(item.subtitle || "").trim();
      const body = String(item.body || "").trim();
      const meta = String(item.meta || "").trim();
      const hint = String(item.hint || "").trim();
      if (!title && !body) return null;
      return {
        ...(title ? { title } : {}),
        ...(subtitle ? { subtitle } : {}),
        ...(body ? { body } : {}),
        ...(meta ? { meta } : {}),
        ...(hint ? { hint } : {})
      };
    })
    .filter(Boolean);
}

function normalizeWorkflow(payload) {
  return payload && typeof payload === "object" ? payload : null;
}

function isCompletedChatRunPayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  const status = String(payload.status || "").trim().toUpperCase();
  const text = String(payload.text || "").trim();
  return status === "COMPLETED" && text.length > 0;
}

function normalizeComparableText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function persistedResultMatchesRequest(
  payload,
  expectedUserText,
  startedAtMs,
  expectedResearchJobId = null
) {
  const researchJobId = String(expectedResearchJobId || "").trim();
  if (researchJobId) {
    return String(payload?.researchJobId || "").trim() === researchJobId;
  }

  const expected = normalizeComparableText(expectedUserText);
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  if (messages.length) {
    let latestAssistantIndex = -1;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (String(messages[i]?.role || "").toLowerCase() === "ai") {
        latestAssistantIndex = i;
        break;
      }
    }
    if (latestAssistantIndex === -1) return false;
    for (let i = latestAssistantIndex - 1; i >= 0; i -= 1) {
      if (String(messages[i]?.role || "").toLowerCase() !== "user") continue;
      return !expected || normalizeComparableText(messages[i]?.text) === expected;
    }
    return false;
  }

  const updatedAtMs = Date.parse(String(payload?.updatedAt || ""));
  return Number.isFinite(updatedAtMs) && updatedAtMs >= Math.max(0, Number(startedAtMs) || 0) - 1000;
}

async function readPersistedConversationResult({
  convId,
  normalizeSources,
  expectedUserText,
  expectedResearchJobId = null,
  startedAtMs
}) {
  const id = String(convId || "").trim();
  if (!id) return null;
  const response = await fetch(`/api/chat/run?convId=${encodeURIComponent(id)}`, {
    cache: "no-store"
  });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  if (!isCompletedChatRunPayload(payload)) return null;
  if (!persistedResultMatchesRequest(
    payload,
    expectedUserText,
    startedAtMs,
    expectedResearchJobId
  )) return null;
  const normalize = normalizeSources || defaultNormalizeSources;
  return {
    text: String(payload.text || "").trim(),
    sources: normalize(
      Array.isArray(payload.displayed_sources)
        ? payload.displayed_sources
        : payload.sources ?? []
    ),
    attachments: normalizeAttachments(payload.attachments),
    cards: normalizeCards(payload.cards),
    workflow: normalizeWorkflow(payload.workflow)
  };
}

function dispatchHelpListingsRefresh(workflow) {
  if (typeof window === "undefined") return;
  const helpState = workflow?.help;
  if (!helpState || typeof helpState !== "object") return;
  const justSaved =
    helpState.step === "saved" ||
    helpState.mode === "saved" ||
    (
      helpState.step === "browse" &&
      helpState.mode === "browse" &&
      !!helpState.sourceRecordId
    );
  if (!justSaved) return;
  try {
    window.dispatchEvent(new CustomEvent("sotsiaalai:refresh-help-listings"));
  } catch {}
}

export function resolveCrisisStateAfterEvent(currentIsCrisis, {
  phase,
  isCrisis
} = {}) {
  if (phase === "success" || phase === "done") return !!isCrisis;
  if (phase === "conversation-switch") return false;
  if (phase === "meta" && isCrisis === true) return true;
  return !!currentIsCrisis;
}

// Aus Retry (T03 E2): Retry on nähtav vaid ERROR/ABORTED pöördel ning kordab sama viimast
// kasutajasõnumit ühe uue teadliku pöördena. Tagastab korratava kasutajateksti ja seose
// (retryOf) ebaõnnestunud pöördega. Kui viimane pööre on veel pooleli (viimane sõnum on
// kasutajalt) või edukalt lõpetatud, pole midagi korrata.
export function resolveRetryTarget(messages) {
  if (!Array.isArray(messages) || !messages.length) return { canRetry: false };
  let aiIndex = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const role = String(messages[i]?.role || "").toLowerCase();
    if (role === "ai" || role === "assistant") {
      aiIndex = i;
      break;
    }
    if (role === "user") return { canRetry: false };
  }
  if (aiIndex === -1) return { canRetry: false };
  const ai = messages[aiIndex];
  const status = String(ai?.completionStatus || "").toUpperCase();
  if (status !== "ERROR" && status !== "ABORTED") return { canRetry: false };
  for (let i = aiIndex - 1; i >= 0; i -= 1) {
    if (String(messages[i]?.role || "").toLowerCase() === "user") {
      const userText = String(messages[i]?.text || "").trim();
      if (!userText) return { canRetry: false };
      const retryTarget = ai?.id ?? ai?.messageId ?? null;
      return {
        canRetry: true,
        userText,
        /* SOL-CHAT-03: marsruut aktsepteerib `retryOf` VÄLJA ainult stringina. Kohalik sõnumi-ID
           on arv, seega seos visati vaikselt ära ja auditist ei saanud kordust ebaõnnestunud
           pöördega siduda. Teisendus käib siin, kus ID sünnib. */
        retryOf: retryTarget == null ? null : String(retryTarget)
      };
    }
  }
  return { canRetry: false };
}

export function useChatStream(config) {
  const cfgRef = useRef(config);

  useEffect(() => {
    cfgRef.current = config;
  }, [config]);

  const [isGenerating, setIsGenerating] = useState(false);
  const isGeneratingRef = useRef(false);

  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  const abortRef = useRef(null);
  const researchJobIdRef = useRef(null);
  // SOL-RES-02: ühe kavatsuse võti, mis elab kuni serveri kindla vastuseni.
  const researchIntentRef = useRef(null);
  const researchStreamingMessageIdRef = useRef(null);
  const researchConsumerRef = useRef(null);
  const researchConsumerSequenceRef = useRef(0);
  const researchCreateRef = useRef(null);
  const researchActiveStopRegistryRef = useRef(null);
  if (!researchActiveStopRegistryRef.current) {
    researchActiveStopRegistryRef.current = createResearchActiveStopRegistry();
  }
  const researchLookupGateRef = useRef(null);
  if (!researchLookupGateRef.current) {
    researchLookupGateRef.current = createLatestRequestGate();
  }
  /* SOL-CHAT-03: ühe vestluspöörde kavatsuse võti. Elab kuni kavatsus on lahendatud — võrguviga,
     Stop ja „Proovi uuesti" kasutavad SAMA võtit, seega server näeb üht kavatsust, mitte kolme
     tasulist tööd. Lõpetatud pöörde järel kustutatakse, et tahtlik sama küsimuse uuesti küsimine
     oleks aus uus töö (sama reegel mis SOL-DOC-01 mustanditel). */
  const chatIntentRef = useRef(null);

  // Local-only teardown: stop reading the current stream and reset generating state, WITHOUT
  // touching any durable server-side research job.
  const teardownLocalStream = useCallback(() => {
    researchLookupGateRef.current?.invalidate();
    researchConsumerSequenceRef.current += 1;
    const activeConsumer = researchConsumerRef.current;
    try {
      activeConsumer?.controller?.abort?.();
      if (abortRef.current !== activeConsumer?.controller) abortRef.current?.abort?.();
    } catch {}
    researchConsumerRef.current = null;
    abortRef.current = null;
    researchJobIdRef.current = null;
    researchStreamingMessageIdRef.current = null;
    isGeneratingRef.current = false;
    setIsGenerating(false);
  }, []);

  // Explicit user Stop: additionally cancel the durable research job on the server.
  const stop = useCallback(() => {
    const pendingCreate = researchCreateRef.current;
    if (pendingCreate && !researchJobIdRef.current) {
      // The server may already have committed the job even though its POST response has not reached
      // the client. Recovery starts now and does not depend on that response ever settling.
      pendingCreate.stopRequested = true;
      void pendingCreate.requestStop?.();
      return;
    }

    const activeResearchJobId = researchJobIdRef.current;
    if (activeResearchJobId && typeof fetch === "function") {
      const claim = researchConsumerRef.current;
      const targetConvId = String(claim?.convId || cfgRef.current?.convId || "").trim();
      const targetMessageId = researchStreamingMessageIdRef.current;
      void researchActiveStopRegistryRef.current.requestStop({
        jobId: activeResearchJobId,
        claim,
        convId: targetConvId,
        messageId: targetMessageId,
        isCurrent: target => {
          const currentClaim = researchConsumerRef.current;
          return Boolean(
            currentClaim
            && currentClaim === target.claim
            && currentClaim.jobId === target.jobId
            && currentClaim.convId === target.convId
            && researchJobIdRef.current === target.jobId
            && String(cfgRef.current?.convId || "").trim() === target.convId
          );
        },
        onCancelled: target => {
          // A terminal job may have won the race before Stop. Only the exact consumer that issued
          // this Stop may be changed or torn down; a late A response is inert after B starts.
          const cfg = cfgRef.current;
          if (target.messageId != null) {
            const translated = cfg?.t?.("chat.deep_research.cancelled");
            const cancelledText = typeof translated === "string" && translated.trim()
              ? translated
              : "chat.deep_research.cancelled";
            cfg?.mutateMessage?.(target.messageId, message => ({
              ...message,
              text: cancelledText,
              sources: [],
              isStreaming: false
            }));
          }
          teardownLocalStream();
        },
        onError: (_target, error) => {
          // A failed Stop is retryable: retain the job ID, stream and button instead of pretending
          // the durable server work disappeared. Stale failures do not write into a newer chat.
          const cfg = cfgRef.current;
          const errorKey = error?.chatKey || "chat.deep_research.error_generic";
          const translated = cfg?.t?.(errorKey);
          cfg?.setErrorBanner?.(
            typeof translated === "string" && translated.trim() ? translated : errorKey
          );
        }
      });
      return;
    }
    teardownLocalStream();
  }, [teardownLocalStream]);

  // Soft detach (unmount, soft-nav, conversation switch): leave the durable research job running so
  // it survives navigation. Its report is persisted to the conversation on completion, and the job
  // is only ever cancelled by an explicit Stop — never by simply leaving the page.
  const detach = useCallback(() => {
    teardownLocalStream();
  }, [teardownLocalStream]);

  /**
   * Start the UI consumer for one existing durable job. The synchronous claim before the first
   * await makes StrictMode and concurrent list responses converge on one stream and placeholder.
   */
  const startResearchJobStream = useCallback(({
    jobId,
    convId: expectedConvId = null,
    expectedUserText = "",
    startedAtMs = Date.now(),
    controller: suppliedController = null,
    claim: suppliedClaim = null
  } = {}) => {
    const id = String(jobId || "").trim();
    const cfg = cfgRef.current;
    const convId = String(cfg?.convId || "").trim();
    const targetConvId = String(expectedConvId || convId).trim();
    if (!convId || targetConvId !== convId) return false;
    const claim = suppliedClaim
      && researchConsumerRef.current === suppliedClaim
      && suppliedClaim.jobId === id
      && suppliedClaim.convId === targetConvId
      ? suppliedClaim
      : claimResearchJobConsumer({
          consumerRef: researchConsumerRef,
          sequenceRef: researchConsumerSequenceRef,
          jobId: id,
          convId: targetConvId,
          controller: suppliedController
        });
    if (!claim) return false;

    const { controller, token } = claim;
    researchJobIdRef.current = id;
    abortRef.current = controller;
    isGeneratingRef.current = true;
    setIsGenerating(true);

    const tr = (key, values) => {
      const value = cfg?.t?.(key);
      const text = typeof value === "string" && value.trim() ? value : key;
      return formatI18n(text, values);
    };
    const isCurrent = () => (
      researchConsumerRef.current?.token === token
      && researchConsumerRef.current?.controller === controller
      && String(cfgRef.current?.convId || "").trim() === convId
    );

    let streamingMessageId = cfg.appendMessage?.({
      role: "ai",
      text: tr("chat.deep_research.running"),
      isStreaming: true,
      aiVisible: true,
      ...(cfg.isRoomMode ? { roomScoped: true } : {})
    });
    researchStreamingMessageIdRef.current = streamingMessageId;
    cfg.onAssistantMessageCreated?.(streamingMessageId);

    let finalText = "";
    let finalSources = [];
    let completionState = "error";
    let completedFromPersistence = false;
    let persistencePollTimer = null;
    let persistencePollBusy = false;
    let clearResearchPollTimeout = null;
    let researchTimeoutError = null;
    const researchStartedAtMs = Number.isFinite(Number(startedAtMs))
      ? Number(startedAtMs)
      : Date.now();

    const clearPersistencePoll = () => {
      if (persistencePollTimer && typeof window !== "undefined") {
        window.clearInterval(persistencePollTimer);
      }
      persistencePollTimer = null;
    };
    const clearResearchTimers = () => {
      clearPersistencePoll();
      clearResearchPollTimeout?.();
      clearResearchPollTimeout = null;
    };
    const applyPersistedResult = persisted => {
      if (!persisted?.text || streamingMessageId == null || !isCurrent()) return false;
      completedFromPersistence = true;
      completionState = "done";
      finalText = persisted.text;
      finalSources = persisted.sources;
      cfg.mutateMessage?.(streamingMessageId, message => ({
        ...message,
        text: persisted.text,
        sources: persisted.sources,
        attachments: persisted.attachments,
        cards: persisted.cards,
        workflow: persisted.workflow || normalizeWorkflow(message?.workflow),
        isStreaming: false
      }));
      clearResearchTimers();
      try {
        controller.abort();
      } catch {}
      return true;
    };
    const pollPersistedResult = async () => {
      if (completedFromPersistence || persistencePollBusy || !isCurrent()) return;
      persistencePollBusy = true;
      try {
        const persisted = await readPersistedConversationResult({
          convId,
          normalizeSources: cfg.normalizeSources || defaultNormalizeSources,
          expectedUserText,
          expectedResearchJobId: id,
          startedAtMs: researchStartedAtMs
        });
        if (persisted?.text) applyPersistedResult(persisted);
      } catch {
      } finally {
        persistencePollBusy = false;
      }
    };

    void (async () => {
      try {
        if (typeof window !== "undefined") {
          persistencePollTimer = window.setInterval(() => {
            void pollPersistedResult();
          }, 2500);
          clearResearchPollTimeout = scheduleResearchPersistencePollTimeout(() => {
            if (completedFromPersistence || !isCurrent()) return;
            researchTimeoutError = createLocalizedError("research.error.interrupted");
            clearPersistencePoll();
            if (streamingMessageId != null) {
              cfg.mutateMessage?.(streamingMessageId, message => ({
                ...message,
                text: tr("research.error.interrupted"),
                sources: [],
                isStreaming: false
              }));
            }
            try {
              controller.abort();
            } catch {}
          });
        }

        const consumed = await consumeResearchJobStream({
          jobId: id,
          signal: controller.signal,
          createSSEReader: cfg.createSSEReader || defaultCreateSSEReader,
          normalizeSources: cfg.normalizeSources || defaultNormalizeSources,
          onStatus: status => {
            if (!isCurrent() || streamingMessageId == null) return;
            if (status === "queued" || status === "running") {
              cfg.mutateMessage?.(streamingMessageId, message => ({
                ...message,
                text: tr("chat.deep_research.running"),
                isStreaming: true
              }));
            }
          },
          onProgress: stage => {
            if (!isCurrent() || streamingMessageId == null) return;
            cfg.mutateMessage?.(streamingMessageId, message => ({
              ...message,
              text: getResearchProgressText(tr, stage),
              isStreaming: true
            }));
          },
          shouldStop: () => completedFromPersistence || !isCurrent()
        });
        completionState = consumed.completionState;
        finalText = consumed.finalText;
        finalSources = consumed.finalSources;
        clearResearchTimers();

        if (!finalText && isCurrent()) {
          const persisted = await readPersistedConversationResult({
            convId,
            normalizeSources: cfg.normalizeSources || defaultNormalizeSources,
            expectedUserText,
            expectedResearchJobId: id,
            startedAtMs: researchStartedAtMs
          }).catch(() => null);
          if (persisted?.text) applyPersistedResult(persisted);
        }

        if (!isCurrent()) return;
        if (streamingMessageId != null) {
          const nextText = finalText || (
            completionState === "cancelled"
              ? tr("chat.deep_research.cancelled")
              : tr("chat.deep_research.error_generic")
          );
          cfg.mutateMessage?.(streamingMessageId, message => ({
            ...message,
            text: nextText,
            sources: finalSources,
            isStreaming: false
          }));
        }

        if (completionState === "done" && finalText) {
          cfg.onDeepResearchComplete?.();
          cfg.requestConversationsRefresh?.();
          return;
        }
        if (completionState !== "cancelled") {
          throw createLocalizedError("chat.deep_research.error_generic");
        }
      } catch (error) {
        clearResearchTimers();
        if (error?.name === "AbortError" && completedFromPersistence && finalText) {
          if (isCurrent()) {
            cfg.onDeepResearchComplete?.();
            cfg.requestConversationsRefresh?.();
          }
          return;
        }
        if (!isCurrent()) return;
        const errorKey = researchTimeoutError?.chatKey || (
          error?.name === "AbortError"
            ? "chat.deep_research.cancelled"
            : error?.chatKey === "research.error.cancelled"
              ? "chat.deep_research.cancelled"
              : error?.chatKey || "chat.deep_research.error_generic"
        );
        const errorText = tr(errorKey, error?.chatValues);
        if (streamingMessageId != null) {
          cfg.mutateMessage?.(streamingMessageId, message => ({
            ...message,
            text: errorText,
            sources: [],
            isStreaming: false
          }));
        } else {
          cfg.appendMessage?.({
            role: "ai",
            text: errorText,
            ...(cfg.isRoomMode ? { roomScoped: true } : {})
          });
        }
      } finally {
        clearResearchTimers();
        if (isCurrent()) {
          researchConsumerRef.current = null;
          abortRef.current = null;
          researchJobIdRef.current = null;
          researchStreamingMessageIdRef.current = null;
          isGeneratingRef.current = false;
          setIsGenerating(false);
          cfg.onFocusInput?.();
        }
        streamingMessageId = null;
      }
    })();

    return true;
  }, []);

  /**
   * SOL-RES-07 — a soft-nav reconnects to the owner's active job and starts its live GET stream.
   * The abort signal rejects a stale list response; the synchronous consumer claim above rejects
   * duplicate StrictMode/concurrent responses without creating another placeholder or job.
   */
  useEffect(() => {
    const convId = String(config?.convId || "").trim();
    if (!convId || typeof fetch !== "function") return undefined;
    if (researchConsumerRef.current) return undefined;

    const lookupAttempt = researchLookupGateRef.current.begin(convId);
    (async () => {
      try {
        const active = await findActiveResearchJob({
          convId,
          signal: withRequestTimeout(lookupAttempt.signal, RESEARCH_ACTIVE_LOOKUP_TIMEOUT_MS)
        });
        const currentConvId = String(cfgRef.current?.convId || "").trim();
        const claim = claimActiveResearchLookupResult({
          lookupAttempt,
          currentConvId,
          activeJob: active,
          consumerRef: researchConsumerRef,
          sequenceRef: researchConsumerSequenceRef
        });
        if (!claim) return;
        startResearchJobStream({
          jobId: active.id,
          convId,
          expectedUserText: String(active?.query || ""),
          startedAtMs: Date.parse(String(active?.createdAt || "")),
          claim
        });
      } catch {}
    })();

    return () => {
      if (lookupAttempt.isCurrent()) researchLookupGateRef.current?.invalidate();
    };
  }, [config?.convId, startResearchJobStream]);

  const sendMessage = useCallback(async (rawText, options = {}) => {
    const cfg = cfgRef.current;
    const tr = (key, values) => {
      const value = cfg?.t?.(key);
      const text = typeof value === "string" && value.trim() ? value : key;
      return formatI18n(text, values);
    };

    const text = String(rawText ?? "").trim();
    if (!text) return false;
    if (isGeneratingRef.current) return false;

    cfg.setErrorBanner?.(null);

    if (cfg.isRoomMode) {
      if (cfg.roomBlocked) {
        return false;
      }
      if (cfg.roomAuthRequired) {
        return false;
      }

      try {
        const roomPathId = encodeURIComponent(String(cfg.roomId || ""));
        const res = await fetch(`/api/rooms/${roomPathId}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            content: text,
            privacyDecision: options?.privacyDecision
          })
        });
        const data = await res.json().catch(() => ({}));

        if (res.status === 403) {
          return false;
        }
        if (res.status === 401) {
          return false;
        }
        if (!res.ok || data?.ok === false) {
          throw createLocalizedError("chat.room.send_error");
        }

        if (data?.message?.id && cfg.sendToAssistant) {
          cfg.onRoomMessageSent?.(data.message.id);
        }
      } catch {
        cfg.setErrorBanner?.(tr("chat.room.send_error"));
        return false;
      }
    }

    if (cfg.activeWorkflow === "deep_research" && !cfg.isRoomMode) {
      cfg.appendMessage?.({
        role: "user",
        text,
        aiVisible: true
      });

      isGeneratingRef.current = true;
      setIsGenerating(true);
      cfg.onFocusInput?.();

      const controller = new AbortController();
      abortRef.current = controller;

      let streamHandedOff = false;
      const createAttempt = {
        controller,
        convId: String(cfg.convId || "").trim(),
        intentKey: null,
        stopRequested: false,
        stopConfirmed: false,
        stopCoordinator: null,
        stopRecoveryPromise: null,
        stopAttemptGate: createResearchExplicitStopAttemptGate(),
        requestStop: null
      };
      researchCreateRef.current = createAttempt;

      const isCreateAttemptUiCurrent = () => isCurrentResearchCreateAttempt({
        attempt: createAttempt,
        currentAttempt: researchCreateRef.current,
        currentConvId: cfgRef.current?.convId
      });

      const handoffResearchJob = (jobId, startedAtMs = Date.now()) => {
        streamHandedOff = startResearchJobStream({
          jobId,
          convId: createAttempt.convId,
          expectedUserText: text,
          startedAtMs,
          controller
        });
        if (!streamHandedOff) {
          streamHandedOff = researchConsumerRef.current?.convId === createAttempt.convId;
        }
        return streamHandedOff;
      };

      const applyPendingStopResult = result => {
        const job = result?.job;
        const jobId = String(job?.id || "").trim();
        if (jobId && researchIntentRef.current?.key === createAttempt.intentKey) {
          researchIntentRef.current = null;
        }

        if (result?.outcome === "cancelled") {
          const mayWriteUi = isCreateAttemptUiCurrent();
          createAttempt.stopConfirmed = true;
          if (researchCreateRef.current === createAttempt) researchCreateRef.current = null;
          if (abortRef.current === controller) abortRef.current = null;
          try {
            controller.abort();
          } catch {}
          if (mayWriteUi) {
            cfg.appendMessage?.({
              role: "ai",
              text: tr("chat.deep_research.cancelled"),
              ...(cfg.isRoomMode ? { roomScoped: true } : {})
            });
            isGeneratingRef.current = false;
            setIsGenerating(false);
            cfg.onFocusInput?.();
          }
          return { outcome: "cancelled", handedOff: false, job };
        }

        if (result?.outcome === "not_found") {
          if (isCreateAttemptUiCurrent()) {
            cfg.setErrorBanner?.(tr("chat.deep_research.error_generic"));
          }
          return { outcome: "not_found", handedOff: false, job: null };
        }

        const mayWriteUi = isCreateAttemptUiCurrent();
        if (result?.outcome === "stop_failed" && mayWriteUi) {
          // A failed Stop is retryable: expose the recovered job and keep the explicit Stop path.
          const error = result.error;
          const errorKey = error?.chatKey || "chat.deep_research.error_generic";
          cfg.setErrorBanner?.(tr(errorKey, error?.chatValues));
        }
        return {
          outcome: result?.outcome || "terminal",
          handedOff: jobId && mayWriteUi
            ? handoffResearchJob(jobId, Date.parse(String(job?.createdAt || "")))
            : false,
          job: job || null
        };
      };

      const requestPendingCreateStop = (knownJob = null, { explicit = false } = {}) => {
        createAttempt.stopRequested = true;
        if (createAttempt.stopConfirmed) {
          return Promise.resolve({ outcome: "cancelled", handedOff: false, job: knownJob });
        }
        if (knownJob?.id) void createAttempt.stopCoordinator?.recordCreateJob(knownJob);
        if (createAttempt.stopRecoveryPromise) return createAttempt.stopRecoveryPromise;
        if (!createAttempt.intentKey || !createAttempt.stopCoordinator) {
          return Promise.resolve({ outcome: "waiting_for_intent", handedOff: false, job: null });
        }
        if (!createAttempt.stopAttemptGate.begin({ explicit })) {
          return Promise.resolve(
            createAttempt.stopAttemptGate.lastResult()
            || { outcome: "waiting_for_explicit_retry", handedOff: false, job: knownJob || null }
          );
        }

        const recoveryPromise = createAttempt.stopCoordinator.requestStop()
          .then(applyPendingStopResult)
          .then(result => createAttempt.stopAttemptGate.record(result))
          .finally(() => {
            if (createAttempt.stopRecoveryPromise === recoveryPromise) {
              createAttempt.stopRecoveryPromise = null;
            }
          });
        createAttempt.stopRecoveryPromise = recoveryPromise;
        return recoveryPromise;
      };
      createAttempt.requestStop = () => requestPendingCreateStop(null, { explicit: true });

      const runResearch = async () => {
        try {
          // SOL-RES-02: kavatsuse võti elab kuni serveri kindla vastuseni. Ilma selleta lõi iga
          // võrgu- või vastusevea kordus UUE tasulise uuringu; nüüd tagastab server sama töö.
          const researchPayload = {
            query: text,
            convId: cfg.convId,
            persist: true,
            uiLocale: cfg.locale || "et"
          };
          researchIntentRef.current = resolveIntentKey(
            researchIntentRef.current,
            buildIntentSignature(researchPayload)
          );
          createAttempt.intentKey = researchIntentRef.current.key;
          createAttempt.stopCoordinator = createResearchCreateStopCoordinator({
            convId: createAttempt.convId,
            intentKey: createAttempt.intentKey
          });
          if (createAttempt.stopRequested) void requestPendingCreateStop();
          const createResponse = await createResearchJobRequest({
            controller,
            payload: {
              ...researchPayload,
              idempotencyKey: createAttempt.intentKey
            }
          });
          const createPayload = await createResponse.json().catch(() => ({}));

          if (!createResponse.ok || createPayload?.ok === false || !createPayload?.id) {
            void createAttempt.stopCoordinator.recordCreateFailure();
          }

          if (createResponse.status === 401) {
            if (cfg.onAuthRedirect) {
              cfg.onAuthRedirect();
            } else if (typeof window !== "undefined") {
              const callbackUrl = localizePath("/vestlus", cfg.locale || "et");
              const params = new URLSearchParams({
                callbackUrl
              });
              window.location.href = `/api/auth/signin?${params.toString()}`;
            }
            return true;
          }

          if (createResponse.status === 403) {
            if (createPayload?.requireSubscription && createPayload?.redirect && typeof window !== "undefined") {
              window.location.href = String(createPayload.redirect);
              return true;
            }
            throw createLocalizedError(readApiErrorKey(createPayload) || "chat.deep_research.error_generic");
          }

          if (createResponse.status === 429) {
            const key = readApiErrorKey(createPayload);
            if (key) throw createLocalizedError(key);
            throw createLocalizedError("chat.error.rate_limit_generic");
          }

          if (!createResponse.ok || createPayload?.ok === false || !createPayload?.id) {
            throw createLocalizedError(readApiErrorKey(createPayload) || "chat.deep_research.error_generic");
          }

          // Server andis kindla vastuse ja töö on olemas: kavatsus on lahendatud.
          if (researchIntentRef.current?.key === createAttempt.intentKey) {
            researchIntentRef.current = null;
          }
          const jobId = String(createPayload.id || "").trim();
          if (!jobId) {
            throw createLocalizedError("chat.deep_research.error_generic");
          }
          void createAttempt.stopCoordinator.recordCreateJob({
            id: jobId,
            status: createPayload?.status,
            createdAt: new Date().toISOString()
          });
          if (createAttempt.stopRequested) {
            const stopped = await requestPendingCreateStop({
              id: jobId,
              status: createPayload?.status,
              createdAt: new Date().toISOString()
            });
            streamHandedOff = stopped.handedOff;
            return streamHandedOff;
          }
          handoffResearchJob(jobId);
          if (!streamHandedOff) return false;
          return true;
        } catch (err) {
          void createAttempt.stopCoordinator?.recordCreateFailure();
          if (createAttempt.stopRequested && createAttempt.intentKey) {
            if (createAttempt.stopConfirmed) return false;
            const stopped = await requestPendingCreateStop();
            streamHandedOff = stopped.handedOff;
            if (stopped.outcome !== "not_found" && stopped.outcome !== "waiting_for_intent") {
              return streamHandedOff;
            }
          }
          if (researchConsumerRef.current?.convId === createAttempt.convId) {
            streamHandedOff = true;
            return true;
          }
          const errorKey = err?.name === "AbortError"
            ? "chat.deep_research.cancelled"
            : err?.chatKey === "research.error.cancelled"
              ? "chat.deep_research.cancelled"
              : err?.chatKey || "chat.deep_research.error_generic";
          const errorText = tr(errorKey, err?.chatValues);
          if (isCreateAttemptUiCurrent()) {
            cfg.appendMessage?.({
              role: "ai",
              text: errorText,
              ...(cfg.isRoomMode ? { roomScoped: true } : {})
            });
          }
          return false;
        } finally {
          const ownsCreateAttempt = researchCreateRef.current === createAttempt;
          const mayWriteUi = isCreateAttemptUiCurrent();
          if (ownsCreateAttempt) researchCreateRef.current = null;
          if (!streamHandedOff && ownsCreateAttempt && mayWriteUi) {
            if (abortRef.current === controller) abortRef.current = null;
            isGeneratingRef.current = false;
            setIsGenerating(false);
            cfg.onFocusInput?.();
          }
        }
      };

      void runResearch();
      return true;
    }

    const shouldSendToAssistant = cfg.isRoomMode ? cfg.sendToAssistant : true;
    const isInitialHelpLaunch =
      (cfg.activeWorkflow === "help_request" || cfg.activeWorkflow === "help_offer")
      && Array.isArray(cfg.historyPayload)
      && cfg.historyPayload.length === 0;
    const selectedChatMode = isInitialHelpLaunch
      ? cfg.activeWorkflow
      : "rag";

    cfg.appendMessage?.({
      role: "user",
      text,
      aiVisible: shouldSendToAssistant
    });

    isGeneratingRef.current = shouldSendToAssistant;
    setIsGenerating(shouldSendToAssistant);
    cfg.onFocusInput?.();

    if (!shouldSendToAssistant) return true;

    const controller = new AbortController();
    abortRef.current = controller;

    chatIntentRef.current = resolveIntentKey(
      chatIntentRef.current,
      buildIntentSignature({
        convId: cfg.convId || null,
        roomId: cfg.isRoomMode ? cfg.roomId || null : null,
        text
      })
    );
    const clientTurnKey = chatIntentRef.current.key;

    const turnStartedAtMs = Date.now();
    const clientTimeout = setTimeout(() => controller.abort(), 180000);
    let streamingMessageId = null;
    let visibleText = "";
    let sources = [];
    let attachments = [];
    let cards = [];
    let workflow = null;
    let pendingCrisisState = null;
    let streamCompleted = false;
    streamingMessageId = cfg.appendMessage?.({
      role: "ai",
      text: "",
      isStreaming: true,
      aiVisible: true,
      ...(cfg.isRoomMode ? { roomScoped: true } : {})
    });
    cfg.onAssistantMessageCreated?.(streamingMessageId);
    const latestHelpWorkflowState = !cfg.isRoomMode && typeof cfg.getLatestHelpWorkflowState === "function"
      ? normalizeWorkflow(cfg.getLatestHelpWorkflowState())
      : normalizeWorkflow(cfg.helpWorkflowState);
    const doPushVisibleText = () => {
      if (streamingMessageId == null) return;
      startTransition(() => {
        cfg.mutateMessage?.(streamingMessageId, msg => ({
          ...msg,
          text: visibleText
        }));
      });
    };

    const flushAllPending = () => {
      doPushVisibleText();
    };

    const runStream = async () => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message: text,
            history: cfg.historyPayload,
            role: cfg.userRole,
            stream: true,
            persist: true,
            convId: cfg.convId,
            uiLocale: cfg.locale || "et",
            chatMode: selectedChatMode,
            helpWorkflowState: !cfg.isRoomMode && latestHelpWorkflowState && typeof latestHelpWorkflowState === "object"
              ? latestHelpWorkflowState
              : undefined,
            roomId: cfg.isRoomMode ? cfg.roomId : undefined,
            privacyDecision: options?.privacyDecision,
            retryOf: options?.retryOf ? String(options.retryOf) : undefined,
            clientTurnKey,
            idempotencyKey: clientTurnKey,
            ...(cfg.ephemeralChunks?.length
              ? {
                  ephemeralChunks: cfg.ephemeralChunks,
                  ...((cfg.ephemeralSource?.fileName || cfg.uploadPreview?.fileName)
                    ? {
                        ephemeralSource: {
                          fileName: cfg.ephemeralSource?.fileName || cfg.uploadPreview?.fileName,
                          ...(Array.isArray(cfg.ephemeralSource?.fileNames) && cfg.ephemeralSource.fileNames.length
                            ? {
                                fileNames: cfg.ephemeralSource.fileNames
                              }
                            : {})
                        }
                      }
                    : {}),
                  combineSources: !cfg.docOnlyMode
                }
              : {})
          }),
          signal: controller.signal
        });

        clearTimeout(clientTimeout);

        let parsedBody = null;
        let parsedBodyLoaded = false;
        const readJsonBody = async () => {
          if (parsedBodyLoaded) return parsedBody;
          parsedBodyLoaded = true;
          try {
            parsedBody = await res.json();
          } catch {
            parsedBody = null;
          }
          return parsedBody;
        };
        if (res.status === 401) {
          cfg.mutateMessage?.(streamingMessageId, msg => ({
            ...msg,
            text: tr("chat.room.auth_required"),
            isStreaming: false
          }));
          streamingMessageId = null;
          if (cfg.onAuthRedirect) {
            cfg.onAuthRedirect();
          } else if (typeof window !== "undefined") {
            const callbackUrl = localizePath("/vestlus", cfg.locale || "et");
            const params = new URLSearchParams({
              callbackUrl
            });
            window.location.href = `/api/auth/signin?${params.toString()}`;
          }
          return true;
        }

        if (res.status === 403) {
          const data = await readJsonBody();
          if (data?.requireSubscription && data?.redirect && typeof window !== "undefined") {
            cfg.mutateMessage?.(streamingMessageId, msg => ({
              ...msg,
              text: tr("chat.error.subscription_required_profile"),
              isStreaming: false
            }));
            streamingMessageId = null;
            window.location.href = String(data.redirect);
            return true;
          }
          const key = readApiErrorKey(data);
          throw createLocalizedError(key || (cfg.isRoomMode ? "chat.room.blocked" : "api.common.forbidden"));
        }

        if (res.status === 429) {
          const data = await readJsonBody();
          const key = readApiErrorKey(data);
          if (key) {
            throw createLocalizedError(key);
          }
          const retry = res.headers.get("retry-after");
          if (retry) {
            throw createLocalizedError("chat.error.rate_limit_retry", {
              seconds: retry
            });
          }
          throw createLocalizedError("chat.error.rate_limit_generic");
        }

        const contentType = res.headers.get("content-type") || "";

        if (!contentType.includes("text/event-stream")) {
          const data = await readJsonBody();

          if (!res.ok) {
            throw createLocalizedError(readApiErrorKey(data) || "chat.error.no_response");
          }

          const replyText = (data?.answer ?? data?.reply) || tr("chat.error.no_answer");
          const normalize = cfg.normalizeSources || defaultNormalizeSources;
          const normSources = normalize(Array.isArray(data?.displayed_sources) ? data.displayed_sources : data?.sources);
          const attachments = normalizeAttachments(data?.attachments);
          const cards = normalizeCards(data?.cards);
          const workflow = normalizeWorkflow(data?.workflow);

          cfg.setIsCrisis?.(currentIsCrisis => resolveCrisisStateAfterEvent(currentIsCrisis, {
            phase: "success",
            isCrisis: !!data?.isCrisis
          }));

          cfg.mutateMessage?.(streamingMessageId, msg => ({
            ...msg,
            text: replyText,
            sources: normSources,
            attachments,
            cards,
            workflow,
            isStreaming: false,
            completionStatus: "COMPLETED"
          }));

          // Sama reegel mis voo rajal: lahendatud kavatsus vabastab võtme (SOL-CHAT-03).
          chatIntentRef.current = null;
          dispatchHelpListingsRefresh(workflow);
          cfg.requestConversationsRefresh?.();
          streamingMessageId = null;
          return true;
        }

        if (!res.ok) {
          const data = await readJsonBody();
          throw createLocalizedError(readApiErrorKey(data) || "chat.error.no_response");
        }

        if (!res.body) {
          throw createLocalizedError("chat.error.stream_missing");
        }

        const reader = (cfg.createSSEReader || defaultCreateSSEReader)(res.body);

        for await (const ev of reader) {
          if (ev.event === "meta") {
            try {
              const payload = JSON.parse(ev.data);
              const rawSources = Array.isArray(payload?.sources)
                ? (Array.isArray(payload?.displayed_sources) ? payload.displayed_sources : payload.sources)
                : Array.isArray(payload?.displayed_sources)
                  ? payload.displayed_sources
                  : Array.isArray(payload?.groups)
                    ? payload.groups
                    : null;
              if (rawSources) {
                const normalize = cfg.normalizeSources || defaultNormalizeSources;
                sources = normalize(rawSources);
                cfg.mutateMessage?.(streamingMessageId, msg => ({
                  ...msg,
                  sources
                }));
              }
              workflow = normalizeWorkflow(payload?.workflow);
              if (workflow) {
                cfg.mutateMessage?.(streamingMessageId, msg => ({
                  ...msg,
                  workflow
                }));
              }
              if (typeof payload?.isCrisis !== "undefined") {
                pendingCrisisState = !!payload.isCrisis;
                if (pendingCrisisState) {
                  cfg.setIsCrisis?.(currentIsCrisis => resolveCrisisStateAfterEvent(currentIsCrisis, {
                    phase: "meta",
                    isCrisis: true
                  }));
                }
              }
            } catch {}
          } else if (ev.event === "delta") {
            try {
              const payload = JSON.parse(ev.data);
              if (payload?.t) {
                visibleText += payload.t;
                doPushVisibleText();
              }
            } catch {}
          } else if (ev.event === "error") {
            throw createLocalizedError("chat.error.stream_failed");
          } else if (ev.event === "done") {
            streamCompleted = true;
            try {
              const payload = ev?.data ? JSON.parse(ev.data) : {};
              attachments = normalizeAttachments(payload?.attachments);
              cards = normalizeCards(payload?.cards);
              const doneSources = Array.isArray(payload?.displayed_sources)
                ? payload.displayed_sources
                : Array.isArray(payload?.sources)
                  ? payload.sources
                  : null;
              if (doneSources) {
                const normalize = cfg.normalizeSources || defaultNormalizeSources;
                sources = normalize(doneSources);
              }
            } catch {}
            break;
          }
        }

        /* SOL-CHAT-06: `streamCompleted` on tõene AINULT valideeritud `done` sündmuse järel. Kui
           keha lõppes tavalise reader-EOF-iga (võrk, proxy, serveri surm), ei tohi UI näidata
           poolikut vastust lõpliku edukana ega jätta Retry-nuppu pakkumata. Serveri tõde küsitakse
           `/api/chat/run` pealt — see marsruut loeb nüüd pöörde enda rida (vt SOL-CHAT-04). */
        if (!streamCompleted) {
          const confirmed = !cfg.isRoomMode
            ? await readPersistedConversationResult({
                convId: cfg.convId,
                normalizeSources: cfg.normalizeSources,
                expectedUserText: text,
                startedAtMs: turnStartedAtMs
              }).catch(() => null)
            : null;
          if (!confirmed) {
            flushAllPending();
            throw createLocalizedError("chat.error.stream_incomplete");
          }
          visibleText = confirmed.text || visibleText;
          sources = confirmed.sources?.length ? confirmed.sources : sources;
          attachments = confirmed.attachments?.length ? confirmed.attachments : attachments;
          cards = confirmed.cards?.length ? confirmed.cards : cards;
          workflow = confirmed.workflow || workflow;
          streamCompleted = true;
        }

        if (streamCompleted && pendingCrisisState !== null) {
          cfg.setIsCrisis?.(currentIsCrisis => resolveCrisisStateAfterEvent(currentIsCrisis, {
            phase: "done",
            isCrisis: pendingCrisisState
          }));
        }

        flushAllPending();

        cfg.mutateMessage?.(streamingMessageId, msg => ({
          ...msg,
          text: (visibleText || "").trim() || tr("chat.error.no_answer"),
          sources,
          attachments,
          cards,
          workflow: workflow || normalizeWorkflow(msg?.workflow),
          isStreaming: false,
          completionStatus: "COMPLETED"
        }));

        // Kavatsus on lahendatud: järgmine sama tekstiga saatmine on TAHTLIK uus töö, mitte kordus.
        chatIntentRef.current = null;
        dispatchHelpListingsRefresh(workflow);
        cfg.requestConversationsRefresh?.();
        streamingMessageId = null;
        return true;
      } catch (err) {
        flushAllPending();
        clearTimeout(clientTimeout);

        if (err?.name === "AbortError") {
          if (streamingMessageId != null) {
            cfg.mutateMessage?.(streamingMessageId, msg => ({
              ...msg,
              text: msg.text
                ? `${msg.text}\n\n${tr("chat.error.interrupted_suffix")}`
                : tr("chat.error.interrupted"),
              isStreaming: false,
              completionStatus: "ABORTED"
            }));
            streamingMessageId = null;
          } else {
            cfg.appendMessage?.({
              role: "ai",
              text: tr("chat.error.interrupted"),
              completionStatus: "ABORTED",
              ...(cfg.isRoomMode ? { roomScoped: true } : {})
            });
          }
        } else {
          const isSilentRoomAccessError =
            cfg.isRoomMode &&
            (err?.chatKey === "chat.room.blocked" || err?.chatKey === "chat.room.auth_required");
          if (isSilentRoomAccessError) {
            return false;
          }
          const isSubscriptionRequired = err?.chatKey === "api.common.subscription_required";
          const errText = isSubscriptionRequired
            ? tr("chat.error.subscription_required_profile")
            : err?.chatKey
              ? tr(err.chatKey, err.chatValues)
              : tr("chat.error.generic");
          const errWithPrefix = isSubscriptionRequired
            ? errText
            : tr("chat.error.with_detail", {
                message: errText
              });

          if (streamingMessageId != null) {
            cfg.mutateMessage?.(streamingMessageId, msg => ({
              ...msg,
              text: errWithPrefix,
              sources: [],
              cards: [],
              isStreaming: false,
              completionStatus: "ERROR"
            }));
            streamingMessageId = null;
          } else {
            cfg.appendMessage?.({
              role: "ai",
              text: errWithPrefix,
              completionStatus: "ERROR",
              ...(cfg.isRoomMode ? { roomScoped: true } : {})
            });
          }
        }

        return false;
      } finally {
        abortRef.current = null;
        isGeneratingRef.current = false;
        setIsGenerating(false);
        cfg.onFocusInput?.();
      }
    };

    void runStream();
    return true;
  }, [startResearchJobStream]);

  // Aus Retry: kordab sama viimast kasutajasõnumit ühe uue teadliku pöördena.
  // isGeneratingRef vald väldib topeltpööret (topeltklikk, hiline SSE, võrguvea retry).
  const retryLast = useCallback((messages) => {
    if (isGeneratingRef.current) return false;
    const target = resolveRetryTarget(messages);
    if (!target.canRetry) return false;
    return sendMessage(target.userText, {
      retryOf: target.retryOf,
      isRetry: true
    });
  }, [sendMessage]);

  return {
    isGenerating,
    sendMessage,
    stop,
    retryLast,
    detach
  };
}
