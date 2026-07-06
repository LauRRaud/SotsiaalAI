import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_MODEL, OPENAI_MAX_OUTPUT_TOKENS } from "@/lib/chat/settings";
import { logEvent } from "@/lib/chat/logger";
import { logDocumentsAudit } from "@/lib/documents/audit";
import {
  ensureDocumentsStorage,
  getStoredDocumentPath,
  normalizeDocumentTitle,
  resolveAgentStorageDir,
  resolveAbsoluteDocumentPath,
  sanitizeTextFilename,
} from "@/lib/documents/server";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { logOpenAIUsage } from "@/lib/openaiUsage";
import { prisma } from "@/lib/prisma";

function readPositiveNumber(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

const JOB_TTL_MS = readPositiveNumber(process.env.MEETING_SUMMARY_JOB_TTL_MS, 30 * 60 * 1000);
const JOB_SWEEP_MS = readPositiveNumber(process.env.MEETING_SUMMARY_JOB_SWEEP_MS, 60 * 1000);
const ACTIVE_JOB_STALE_MS = readPositiveNumber(process.env.MEETING_SUMMARY_ACTIVE_JOB_STALE_MS, 15 * 60 * 1000);
const OPENAI_STT_MODEL = process.env.OPENAI_STT_MODEL || "gpt-4o-mini-transcribe";
const SUMMARY_MAX_OUTPUT_TOKENS = Math.max(
  1,
  Math.trunc(
    readPositiveNumber(
      process.env.MEETING_SUMMARY_MAX_OUTPUT_TOKENS,
      OPENAI_MAX_OUTPUT_TOKENS || 1100
    )
  )
);

const jobs = new Map();

function nowIso() {
  return new Date().toISOString();
}

function shouldDelete(job, now) {
  if (!job) return true;
  if (job.status === "queued" || job.status === "running") return false;
  const ended = job.endedAt ? Date.parse(job.endedAt) : Date.parse(job.updatedAt || job.createdAt);
  if (!Number.isFinite(ended)) return false;
  return now - ended > JOB_TTL_MS;
}

function resolveMeetingSummaryJobsDir() {
  return path.join(resolveAgentStorageDir(), "meeting-summary-jobs");
}

function getMeetingSummaryJobFilePath(jobId) {
  const safeId = String(jobId || "").trim();
  if (!safeId) return "";
  return path.join(resolveMeetingSummaryJobsDir(), `${safeId}.json`);
}

async function ensureMeetingSummaryJobsStorage() {
  await fs.mkdir(resolveMeetingSummaryJobsDir(), { recursive: true });
}

function toPersistedJob(job) {
  if (!job?.id) return null;
  return {
    id: job.id,
    userId: String(job.userId || ""),
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    error: job.error || null,
    result: job.result || null,
  };
}

async function persistMeetingSummaryJob(job) {
  const record = toPersistedJob(job);
  if (!record) return;
  const filePath = getMeetingSummaryJobFilePath(record.id);
  if (!filePath) return;
  await ensureMeetingSummaryJobsStorage();
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(record), "utf8");
  await fs.rename(tempPath, filePath);
}

async function readPersistedMeetingSummaryJob(jobId) {
  const filePath = getMeetingSummaryJobFilePath(jobId);
  if (!filePath) return null;
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function deletePersistedMeetingSummaryJob(jobId) {
  const filePath = getMeetingSummaryJobFilePath(jobId);
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function shouldInterruptStaleActiveJob(job) {
  if (!job || (job.status !== "queued" && job.status !== "running")) return false;
  const updated = Date.parse(job.updatedAt || job.createdAt || "");
  if (!Number.isFinite(updated)) return false;
  return Date.now() - updated > ACTIVE_JOB_STALE_MS;
}

async function markPersistedMeetingSummaryJobInterrupted(job) {
  if (!job?.id) return null;
  const interrupted = {
    ...job,
    status: "error",
    updatedAt: nowIso(),
    endedAt: nowIso(),
    error: "documents.agent_workspace.meeting_summary.error",
    result: job.result || null,
  };
  interrupted.endedAt = interrupted.updatedAt;
  await persistMeetingSummaryJob(interrupted);
  return interrupted;
}

async function listPersistedMeetingSummaryJobIds() {
  try {
    await ensureMeetingSummaryJobsStorage();
    const entries = await fs.readdir(resolveMeetingSummaryJobsDir(), { withFileTypes: true });
    return entries
      .filter(entry => entry?.isFile?.() && entry.name.endsWith(".json"))
      .map(entry => entry.name.slice(0, -5))
      .filter(Boolean);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

function toPublicFromRecord(job, includeResult = false) {
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    error: job.error || null,
    ...(includeResult ? { result: job.result || null } : {}),
    userId: job.userId,
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (shouldDelete(job, now)) {
      jobs.delete(id);
      void deletePersistedMeetingSummaryJob(id).catch(() => {});
    }
  }
}, JOB_SWEEP_MS).unref?.();

function languageFromLocale(locale) {
  const base = String(locale || "").trim().toLowerCase().split("-")[0];
  if (!base || base === "auto") return undefined;
  if (base.length === 2) return base;
  return undefined;
}

function summaryLanguageLabel(locale) {
  const base = String(locale || "").trim().toLowerCase().split("-")[0];
  if (base === "ru") return "Russian";
  if (base === "en") return "English";
  return "Estonian";
}

function toNullableNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function serializeDocument(document) {
  return {
    id: document.id,
    title: document.title,
    originalName: document.originalName,
    kind: document.kind,
    templateFor: document.templateFor,
    agentAllowed: Boolean(document.agentAllowed),
    mime: document.mime,
    size: document.size,
    readOnly: false,
    frameworkAcceptance: null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function toPublic(job, includeResult = false) {
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    error: job.error || null,
    ...(includeResult ? { result: job.result || null } : {}),
  };
}

export async function createMeetingSummaryJob({ userId, payload }) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    const error = new Error("documents.agent_workspace.meeting_summary.error");
    error.code = "INVALID_USER";
    throw error;
  }
  if (await getActiveMeetingSummaryJobCount(normalizedUserId) > 0) {
    const error = new Error("documents.agent_workspace.meeting_summary.busy");
    error.code = "ACTIVE_JOB_LIMIT";
    throw error;
  }
  const createdAt = nowIso();
  const job = {
    id: crypto.randomUUID(),
    userId: normalizedUserId,
    payload,
    status: "queued",
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    endedAt: null,
    error: null,
    result: null,
  };
  jobs.set(job.id, job);
  await persistMeetingSummaryJob(job);
  return job;
}

function getMeetingSummaryJob(jobId) {
  return jobs.get(String(jobId || "").trim());
}

export function getMeetingSummaryJobPublic(jobId) {
  return toPublic(getMeetingSummaryJob(jobId), false);
}

export async function getMeetingSummaryJobSnapshot(jobId) {
  const normalizedJobId = String(jobId || "").trim();
  if (!normalizedJobId) return null;
  const liveJob = getMeetingSummaryJob(normalizedJobId);
  if (liveJob) {
    return {
      ...toPublic(liveJob, true),
      userId: liveJob.userId,
    };
  }

  let record = await readPersistedMeetingSummaryJob(normalizedJobId);
  if (!record) return null;
  if (shouldInterruptStaleActiveJob(record)) {
    record = await markPersistedMeetingSummaryJobInterrupted(record);
  }
  return toPublicFromRecord(record, true);
}

export async function getMeetingSummaryJobResult(jobId) {
  const snapshot = await getMeetingSummaryJobSnapshot(jobId);
  if (!snapshot) return null;
  return {
    id: snapshot.id,
    status: snapshot.status,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    startedAt: snapshot.startedAt,
    endedAt: snapshot.endedAt,
    error: snapshot.error || null,
    result: snapshot.result || null,
  };
}

export function assertMeetingSummaryAccess(job, userId) {
  return Boolean(job) && String(job.userId) === String(userId);
}

async function getActiveMeetingSummaryJobCount(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return 0;
  const seenIds = new Set();
  let count = 0;
  for (const job of jobs.values()) {
    const jobId = String(job?.id || "").trim();
    if (jobId) seenIds.add(jobId);
    if (String(job.userId) !== normalizedUserId) continue;
    if (job.status === "queued" || job.status === "running") count += 1;
  }
  const persistedJobIds = await listPersistedMeetingSummaryJobIds();
  for (const jobId of persistedJobIds) {
    if (seenIds.has(jobId)) continue;
    let record = await readPersistedMeetingSummaryJob(jobId);
    if (!record || String(record.userId || "").trim() !== normalizedUserId) continue;
    if (shouldInterruptStaleActiveJob(record)) {
      record = await markPersistedMeetingSummaryJobInterrupted(record);
    }
    if (record && (record.status === "queued" || record.status === "running")) {
      count += 1;
    }
  }
  return count;
}

function markMeetingSummaryRunning(job) {
  const startedAt = nowIso();
  job.status = "running";
  job.startedAt = startedAt;
  job.updatedAt = startedAt;
}

async function markMeetingSummaryDone(job, result) {
  const endedAt = nowIso();
  job.status = "done";
  job.updatedAt = endedAt;
  job.endedAt = endedAt;
  job.payload = null;
  job.result = result;
  await persistMeetingSummaryJob(job);
}

async function markMeetingSummaryFailed(job, errorMessage) {
  const endedAt = nowIso();
  job.status = "error";
  job.updatedAt = endedAt;
  job.endedAt = endedAt;
  job.payload = null;
  job.error = String(errorMessage || "documents.agent_workspace.meeting_summary.error");
  await persistMeetingSummaryJob(job);
}

async function persistMeetingSummaryDocument({ userId, locale, text }) {
  const baseLocale = normalizeServerLocale(locale) || "et";
  const prefix = serverT(
    baseLocale,
    "documents.agent_workspace.meeting_summary.document_title",
    undefined,
    "Meeting summary"
  );
  const stamp = new Intl.DateTimeFormat(baseLocale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date())
    .replace(/[/:]/g, "-");
  const title = normalizeDocumentTitle(`${prefix} ${stamp}`, `${prefix}.txt`);
  const originalName = sanitizeTextFilename(`${title}.txt`, "meeting-summary.txt");
  const storagePath = getStoredDocumentPath(originalName);
  const absolutePath = resolveAbsoluteDocumentPath(storagePath);
  const buffer = Buffer.from(String(text || ""), "utf8");
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  await ensureDocumentsStorage();
  await fs.writeFile(absolutePath, buffer);

  try {
    const document = await prisma.userDocument.create({
      data: {
        ownerId: userId,
        title,
        originalName,
        kind: "MATERIAL",
        templateFor: null,
        agentAllowed: true,
        mime: "text/plain",
        size: buffer.byteLength,
        sha256,
        storagePath,
      },
      select: {
        id: true,
        title: true,
        originalName: true,
        kind: true,
        templateFor: true,
        agentAllowed: true,
        mime: true,
        size: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await logDocumentsAudit("document.uploaded", {
      userId,
      documentId: document.id,
      title: document.title,
      originalName: document.originalName,
      kind: document.kind,
      generatedBy: "meeting_summary_job",
    });

    return serializeDocument(document);
  } catch (error) {
    try {
      await fs.unlink(absolutePath);
    } catch {}
    throw error;
  }
}

function buildSystemPrompt() {
  return [
    "You are SotsiaalAI's meeting-summary assistant for social work workflows.",
    "Create a concise factual meeting summary from dictated notes.",
    "Return only the summary text in markdown.",
    "Do not invent facts, names, dates, decisions, or risks that are not in the transcript.",
    "Keep wording neutral, professional, and usable as source material for a later formal report.",
  ].join(" ");
}

function buildUserPrompt({ transcript, locale }) {
  return [
    `Write in ${summaryLanguageLabel(locale)}.`,
    "Goal: create a practical meeting summary that can later be used as source material for a report.",
    "Suggested structure:",
    "- Meeting summary",
    "- Main facts",
    "- Needs and agreed actions",
    "- Risks or follow-up",
    "Keep it concise. Prefer bullets when useful. Omit anything uncertain instead of guessing.",
    "",
    "TRANSCRIPT",
    String(transcript || "").trim(),
  ].join("\n");
}

export async function runMeetingSummaryJob(job) {
  if (!job?.payload) return;

  const locale = normalizeServerLocale(job.payload.locale) || "et";
  const translated = (key, fallback = key) => serverT(locale, key, undefined, fallback);

  if (!process.env.OPENAI_API_KEY) {
    await markMeetingSummaryFailed(job, translated("api.stt.not_configured"));
    return;
  }

  markMeetingSummaryRunning(job);
  await persistMeetingSummaryJob(job);

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const file = new File([job.payload.audioBuffer], job.payload.fileName || "meeting-summary.webm", {
      type: job.payload.mimeType || "audio/webm",
    });
    const language = languageFromLocale(locale);

    const sttStartedAt = Date.now();
    const transcription = await client.audio.transcriptions.create({
      file,
      model: OPENAI_STT_MODEL,
      response_format: "json",
      ...(language ? { language } : {}),
    });
    const transcriptText = String(transcription?.text || "").trim();
    if (!transcriptText) {
      throw new Error(translated("api.stt.transcription_failed"));
    }

    const usage = transcription?.usage;
    const usageType = String(usage?.type || "").trim() || null;
    const isTokenUsage = usageType === "tokens";
    const isDurationUsage = usageType === "duration";
    const measuredDurationSeconds =
      (isDurationUsage ? toNullableNumber(usage?.seconds) : null) ??
      toNullableNumber(job.payload.inputDurationSeconds);

    await logEvent("stt_cost_usage", {
      userId: job.userId,
      role: job.payload.role,
      provider: "openai",
      model: OPENAI_STT_MODEL,
      route: "api/documents/meeting-summary/jobs",
      stage: "meeting_summary_transcribe",
      latency_ms: Date.now() - sttStartedAt,
      request_size_bytes: toNullableNumber(job.payload.fileSizeBytes),
      file_size_bytes: toNullableNumber(job.payload.fileSizeBytes),
      duration_seconds: measuredDurationSeconds,
      text_chars: transcriptText.length,
      input_tokens: isTokenUsage ? toNullableNumber(usage?.input_tokens) : null,
      output_tokens: isTokenUsage ? toNullableNumber(usage?.output_tokens) : null,
      total_tokens: isTokenUsage ? toNullableNumber(usage?.total_tokens) : null,
      audio_tokens: isTokenUsage ? toNullableNumber(usage?.input_token_details?.audio_tokens) : null,
      text_tokens: isTokenUsage ? toNullableNumber(usage?.input_token_details?.text_tokens) : null,
      mime_type: job.payload.mimeType || null,
      language: String(language || locale || "auto"),
      usage_type: usageType,
      cost_read_directly: Boolean(usageType),
      cost_estimation_basis: null,
    });

    await logEvent("stt_request", {
      userId: job.userId,
      role: job.payload.role,
      provider: "openai",
      locale: String(language || locale || "auto"),
      fileSizeBytes: job.payload.fileSizeBytes,
      mimeType: job.payload.mimeType || null,
      textLength: transcriptText.length,
      durationSeconds: measuredDurationSeconds,
    });

    await logEvent("chat_request", {
      userId: job.userId,
      role: job.payload.role,
      route: "api/documents/meeting-summary/jobs",
      stage: "meeting_summary_summarize",
      textLength: transcriptText.length,
      source: "meeting_summary_job",
    });

    const summaryStartedAt = Date.now();
    const summaryResponse = await client.responses.create({
      model: DEFAULT_MODEL,
      max_output_tokens: SUMMARY_MAX_OUTPUT_TOKENS,
      text: {
        verbosity: "low",
      },
      reasoning: {
        effort: "low",
      },
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: buildSystemPrompt() }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: buildUserPrompt({ transcript: transcriptText, locale }) }],
        },
      ],
    });

    await logOpenAIUsage({
      response: summaryResponse,
      model: DEFAULT_MODEL,
      route: "api/documents/meeting-summary/jobs",
      stage: "meeting_summary_summarize",
      latencyMs: Date.now() - summaryStartedAt,
      userId: job.userId,
      role: job.payload.role,
    });

    const summaryText = String(summaryResponse?.output_text || "").trim();
    if (!summaryText) {
      throw new Error(translated("documents.agent_workspace.meeting_summary.error"));
    }

    const document = await persistMeetingSummaryDocument({
      userId: job.userId,
      locale,
      text: summaryText,
    });

    await logEvent("meeting_summary_job", {
      userId: job.userId,
      role: job.payload.role,
      route: "api/documents/meeting-summary/jobs",
      stage: "meeting_summary_done",
      duration_seconds: measuredDurationSeconds,
      transcript_chars: transcriptText.length,
      summary_chars: summaryText.length,
      document_id: document.id,
    });

    await markMeetingSummaryDone(job, {
      summaryText,
      document,
    });
  } catch (error) {
    await markMeetingSummaryFailed(
      job,
      String(error?.message || translated("documents.agent_workspace.meeting_summary.error"))
    );
  }
}
