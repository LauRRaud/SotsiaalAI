import { NextResponse } from "next/server";
import { requireResearchAuth } from "@/lib/research/auth";
import {
  assertResearchAccess,
  getResearchJob,
  getResearchJobSnapshot,
  subscribeResearchJob,
} from "@/lib/research/jobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const RESEARCH_POLL_TIMEOUT_MS = readPositiveNumber(
  process.env.RESEARCH_ACTIVE_JOB_STALE_MS,
  15 * 60 * 1000
);

function readPositiveNumber(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

export function scheduleResearchPollTimeout(onTimeout, {
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

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: NO_STORE_HEADERS
  });
}

function sseHeaders() {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}

function toSse(event, payload) {
  return `event: ${event}\ndata: ${JSON.stringify(payload || {})}\n\n`;
}

export function terminalResearchSnapshotEvents(snapshot) {
  const status = String(snapshot?.status || "").trim();
  if (status === "done") {
    return [
      { type: "result", result: snapshot?.result || null, metrics: snapshot?.metrics || null },
      { type: "status", status: "done" },
      { type: "done" }
    ];
  }
  if (status === "error" || status === "cancelled") {
    return [
      {
        type: "error",
        message: snapshot?.error || "research.error.failed",
        metrics: snapshot?.metrics || null
      },
      { type: "status", status },
      { type: "done" }
    ];
  }
  return [];
}

export function attachResearchJobEvents({
  job,
  emit,
  subscribe = subscribeResearchJob
} = {}) {
  const terminalEvents = terminalResearchSnapshotEvents(job);
  if (terminalEvents.length) {
    for (const event of terminalEvents) emit?.(event);
    return () => {};
  }
  return subscribe?.(job?.id, emit) || (() => {});
}

async function getResearchJobId(params) {
  const resolvedParams = await params;
  return String(resolvedParams?.id || "").trim();
}

export async function GET(req, { params }) {
  // Oma töö edenemise jälgimine ei sõltu tellimusest (SOL-RES-01).
  const auth = await requireResearchAuth({ allowWithoutSubscription: true });
  if (!auth.ok) {
    return json(
      {
        ok: false,
        messageKey: auth.message,
        message: auth.message,
        requireSubscription: auth.requireSubscription,
        redirect: auth.redirect,
      },
      auth.status
    );
  }

  const jobId = await getResearchJobId(params);
  /* SOL-RES-03: runtime-objekt on ainult sellel protsessil, kes tööd päriselt jooksutab. Kui teda
     siin ei ole (worker-režiim), langeb voog allpool automaatselt andmebaasi pollimisele — see on
     protsessideülene kanal. Varem hoidis päritoluprotsess iga töö kohta stale objekti ja voog
     tellis sellelt sündmusi, mida keegi kunagi ei saatnud. */
  const job = getResearchJob(jobId);
  const jobSnapshot = job || await getResearchJobSnapshot(jobId);
  if (!jobSnapshot) {
    return json(
      { ok: false, messageKey: "research.error.not_found", message: "research.error.not_found" },
      404
    );
  }
  if (!assertResearchAccess(jobSnapshot, auth.userId)) {
    return json(
      { ok: false, messageKey: "research.error.not_found", message: "research.error.not_found" },
      404
    );
  }

  const encoder = new TextEncoder();
  let unsub = null;
  let closed = false;
  let heartbeat = null;
  let dbPoll = null;
  let clearPollTimeout = null;
  let missingSnapshotCount = 0;

  const stream = new ReadableStream({
    start(controller) {
      const closeStream = () => {
        if (closed) return;
        closed = true;
        try {
          if (heartbeat) {
            clearInterval(heartbeat);
            heartbeat = null;
          }
          if (dbPoll) {
            clearInterval(dbPoll);
            dbPoll = null;
          }
          clearPollTimeout?.();
          clearPollTimeout = null;
          unsub?.();
        } catch {}
        try {
          controller.close();
        } catch {}
      };

      const emit = evt => {
        if (closed) return;
        const eventType = String(evt?.type || "message");
        try {
          controller.enqueue(encoder.encode(toSse(eventType, evt)));
        } catch {
          closeStream();
          return;
        }
        if (eventType === "done") {
          closeStream();
        }
      };

      const emitSnapshot = snapshot => {
        const events = terminalResearchSnapshotEvents(snapshot);
        for (const event of events) emit(event);
        return events.length > 0;
      };

      try {
        req.signal?.addEventListener(
          "abort",
          () => {
            closeStream();
          },
          { once: true }
        );
      } catch {}

      if (!job) {
        if (emitSnapshot(jobSnapshot)) return;
        emit({ type: "status", status: jobSnapshot.status || "queued" });
        heartbeat = setInterval(() => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          } catch {
            closeStream();
          }
        }, 15_000);
        dbPoll = setInterval(() => {
          if (closed) return;
          getResearchJobSnapshot(jobId)
            .then(snapshot => {
              if (!snapshot) {
                missingSnapshotCount += 1;
                if (missingSnapshotCount >= 6) {
                  emit({ type: "error", message: "research.error.not_found" });
                  emit({ type: "status", status: "error" });
                  emit({ type: "done" });
                }
                return;
              }
              missingSnapshotCount = 0;
              emitSnapshot(snapshot);
            })
            .catch(() => {
              emit({ type: "error", message: "research.error.failed" });
              emit({ type: "status", status: "error" });
              emit({ type: "done" });
            });
        }, 2500);
        clearPollTimeout = scheduleResearchPollTimeout(() => {
          emit({ type: "error", message: "research.error.interrupted" });
          emit({ type: "status", status: "error" });
          emit({ type: "done" });
        });
        return;
      }

      unsub = attachResearchJobEvents({ job, emit });
      if (closed) {
        // A terminal job may replay its complete event history synchronously during subscribe.
        // `closeStream()` ran before `unsub` was assigned, so release that subscription here and
        // do not install a heartbeat that could never be cleared.
        unsub?.();
        unsub = null;
        return;
      }
      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          closeStream();
        }
      }, 15_000);
    },
    cancel() {
      try {
        if (heartbeat) clearInterval(heartbeat);
        if (dbPoll) clearInterval(dbPoll);
        clearPollTimeout?.();
        clearPollTimeout = null;
        unsub?.();
      } catch {}
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
