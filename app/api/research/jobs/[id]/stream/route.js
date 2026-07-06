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

async function getResearchJobId(params) {
  const resolvedParams = await params;
  return String(resolvedParams?.id || "").trim();
}

export async function GET(req, { params }) {
  const auth = await requireResearchAuth();
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
      { ok: false, messageKey: "api.common.forbidden", message: "api.common.forbidden" },
      403
    );
  }

  const encoder = new TextEncoder();
  let unsub = null;
  let closed = false;
  let heartbeat = null;
  let dbPoll = null;
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
        if (
          eventType === "done" ||
          (eventType === "status" &&
            (evt?.status === "done" || evt?.status === "error" || evt?.status === "cancelled"))
        ) {
          closeStream();
        }
      };

      const emitSnapshot = snapshot => {
        const status = String(snapshot?.status || "").trim();
        if (status === "done") {
          emit({ type: "result", result: snapshot.result || null, metrics: snapshot.metrics || null });
          emit({ type: "status", status: "done" });
          emit({ type: "done" });
          return true;
        }
        if (status === "error" || status === "cancelled") {
          emit({ type: "error", message: snapshot.error || "research.error.failed", metrics: snapshot.metrics || null });
          emit({ type: "status", status });
          emit({ type: "done" });
          return true;
        }
        return false;
      };

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
        return;
      }

      unsub = subscribeResearchJob(jobId, emit);
      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          closeStream();
        }
      }, 15_000);

      try {
        req.signal?.addEventListener(
          "abort",
          () => {
            closeStream();
          },
          { once: true }
        );
      } catch {}

      if (job.status === "done" || job.status === "error" || job.status === "cancelled") {
        emit({ type: "done" });
      }
    },
    cancel() {
      try {
        if (heartbeat) clearInterval(heartbeat);
        if (dbPoll) clearInterval(dbPoll);
        unsub?.();
      } catch {}
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
