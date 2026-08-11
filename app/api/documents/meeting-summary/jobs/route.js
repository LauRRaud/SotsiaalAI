import crypto from "node:crypto";
import { effectiveRoleFromSession } from "@/lib/authz";
import { estimateMaxAudioSecondsFromBytes, readAudioDurationSecondsFromBuffer } from "@/lib/audio/duration";
import {
  createMeetingSummaryJob,
  getMeetingSummaryJobPublic,
  runMeetingSummaryJob,
} from "@/lib/documents/meetingSummaryJobs";
import { errorJson, json, localeFromRequest, requireDocumentUser, usageErrorJson } from "@/lib/documents/server";
import { getRequestIpFromRequest } from "@/lib/request-ip";
import { consumeRateLimit } from "@/lib/rate-limit";
import { safeError } from "@/lib/privacy/safeError";
import {
  releaseUsageForRequest,
  reserveUsageForRequest
} from "@/lib/usage/routeAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RATE_LIMIT_WINDOW_MS = Number(process.env.MEETING_SUMMARY_RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX = Number(process.env.MEETING_SUMMARY_RATE_LIMIT_MAX || 6);
const MAX_AUDIO_MB = Number(process.env.MEETING_SUMMARY_MAX_AUDIO_MB || 12);
const MAX_AUDIO_BYTES = Math.max(1, Math.floor(MAX_AUDIO_MB * 1024 * 1024));

function isSupportedAudioMime(type) {
  const normalized = String(type || "").toLowerCase().trim();
  if (!normalized) return true;
  if (normalized.startsWith("audio/")) return true;
  return normalized === "video/webm" || normalized === "video/mp4";
}

export async function POST(request) {
  const locale = localeFromRequest(request);
  const auth = await requireDocumentUser();
  if (!auth?.ok) {
    return errorJson(auth?.message || "api.common.unauthorized", auth?.status || 401, locale, {
      redirect: auth?.redirect,
      requireSubscription: auth?.requireSubscription,
    });
  }

  const ip = getRequestIpFromRequest(request);
  const limit = consumeRateLimit(
    `meeting-summary:${auth.userId}:${ip}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS
  );
  if (!limit.allowed) {
    return json(
      {
        ok: false,
        messageKey: "api.stt.rate_limited",
        message: "api.stt.rate_limited",
      },
      429,
      {
        "Retry-After": String(limit.retryAfterSec),
      }
    );
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return errorJson("api.common.invalid_request", 400, locale);
  }

  const file = formData.get("audio");
  const inputLocale = String(formData.get("locale") || locale || "auto");
  if (!file || typeof file === "string") {
    return errorJson("api.stt.audio_missing", 400, locale);
  }
  if (!isSupportedAudioMime(file.type)) {
    return errorJson("api.stt.audio_format_unsupported", 415, locale, {
      mimeType: file.type || null,
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.byteLength) {
    return errorJson("api.stt.audio_missing", 400, locale);
  }
  if (buffer.byteLength > MAX_AUDIO_BYTES) {
    return errorJson("api.stt.audio_too_large", 413, locale, {
      maxMB: MAX_AUDIO_MB,
      sizeMB: Number((buffer.byteLength / (1024 * 1024)).toFixed(1)),
    });
  }

  const inputDurationSeconds = await readAudioDurationSecondsFromBuffer(buffer, file.type || null);
  // SOL-MEET-05: tundmatu kestus reserveeris varem alati täpselt 60 sekundit, ka 12 MB faili
  // puhul — see oli süsteemne möödapääs `STT_SECONDS` kuulimiidist. Nüüd on tundmatu kestuse
  // korral reservatsioon failimahust tuletatud OHUTU ÜLEMPIIR; lõplik arveldus toimub pärast
  // providerit mõõdetud tegeliku kestusega, seega kasutaja maksab ikkagi ainult tõe eest.
  const knownDurationSeconds = Number(inputDurationSeconds);
  const sttReservedSeconds =
    Number.isFinite(knownDurationSeconds) && knownDurationSeconds > 0
      ? Math.max(1, Math.ceil(knownDurationSeconds))
      : Math.max(1, estimateMaxAudioSecondsFromBytes(buffer.byteLength) || 60);

  const usageAttemptId = crypto.randomUUID();
  const usageHandles = [];
  try {
    usageHandles.push(await reserveUsageForRequest({
      request,
      userId: auth.userId,
      metric: "STT_SECONDS",
      amount: sttReservedSeconds,
      scope: "meeting_summary.stt",
      idempotencyKey: usageAttemptId,
      metadata: {
        fileSizeBytes: buffer.byteLength,
        durationSource: Number.isFinite(knownDurationSeconds) && knownDurationSeconds > 0 ? "parsed" : "size_estimate"
      }
    }));
    usageHandles.push(await reserveUsageForRequest({
      request,
      userId: auth.userId,
      metric: "DOCUMENT_GENERATE",
      scope: "meeting_summary.document",
      idempotencyKey: usageAttemptId,
      metadata: { source: "meeting_summary" }
    }));
  } catch (error) {
    await Promise.allSettled(
      usageHandles.map(handle => releaseUsageForRequest(handle, { reason: "meeting_summary_reservation_failed" }))
    );
    return usageErrorJson(error, "meeting_summary", locale);
  }

  try {
    const job = await createMeetingSummaryJob({
      userId: auth.userId,
      payload: {
        locale: inputLocale,
        role: effectiveRoleFromSession(auth.session),
        fileName: String(file.name || "meeting-summary.webm"),
        mimeType: String(file.type || "audio/webm"),
        fileSizeBytes: buffer.byteLength,
        inputDurationSeconds,
        audioBuffer: buffer,
      },
      usage: {
        stt: {
          idempotencyKey: usageHandles[0].idempotencyKey,
          state: "reserved",
          // SOL-MEET-05: töö vajab reserveeritud mahtu, et lõplik commit saaks mõõdetud tegeliku
          // kestuse SELLE piiri sisse klammerdada.
          reservedAmount: sttReservedSeconds
        },
        document: {
          idempotencyKey: usageHandles[1].idempotencyKey,
          state: "reserved"
        }
      }
    });

    queueMicrotask(() => {
      runMeetingSummaryJob(job).catch((error) => {
        try {
          console.error("[meeting-summary][job] failed", safeError(error));
        } catch {}
      });
    });

    return json({
      ok: true,
      job: getMeetingSummaryJobPublic(job.id),
    });
  } catch (error) {
    await Promise.allSettled(
      usageHandles.map(handle => releaseUsageForRequest(handle, { reason: "meeting_summary_job_create_failed" }))
    );
    const messageKey =
      error?.code === "ACTIVE_JOB_LIMIT"
        ? "documents.agent_workspace.meeting_summary.busy"
        : "documents.agent_workspace.meeting_summary.error";
    return errorJson(messageKey, error?.code === "ACTIVE_JOB_LIMIT" ? 429 : 500, locale);
  }
}
