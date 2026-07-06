import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

function readPositiveNumber(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

function readPositiveInteger(value, fallback) {
  return Math.max(1, Math.trunc(readPositiveNumber(value, fallback)));
}

const JOB_TTL_MS = readPositiveNumber(process.env.RESEARCH_JOB_TTL_MS, 30 * 60 * 1000);
const JOB_SWEEP_MS = readPositiveNumber(process.env.RESEARCH_JOB_SWEEP_MS, 60 * 1000);
const ACTIVE_JOB_STALE_MS = readPositiveNumber(process.env.RESEARCH_ACTIVE_JOB_STALE_MS, 15 * 60 * 1000);
const DB_JOB_RETENTION_MS = readPositiveNumber(process.env.RESEARCH_DB_JOB_RETENTION_MS, 14 * 24 * 60 * 60 * 1000);
const DB_JOB_SWEEP_MS = readPositiveNumber(process.env.RESEARCH_DB_JOB_SWEEP_MS, 60 * 60 * 1000);
const DEFAULT_WORKER_LEASE_MS = readPositiveNumber(process.env.RESEARCH_WORKER_LEASE_MS, 10 * 60 * 1000);
const DEFAULT_WORKER_MAX_ATTEMPTS = readPositiveInteger(process.env.RESEARCH_WORKER_MAX_ATTEMPTS, 3);
const ACTIVE_STATUSES = ["queued", "running"];
const TERMINAL_STATUSES = ["done", "error", "cancelled"];

const jobs = new Map();
let seq = 1;
let lastDbSweepAt = 0;

function nowIso() {
  return new Date().toISOString();
}

function clampStatus(status) {
  if (status === "running" || status === "done" || status === "error" || status === "cancelled") {
    return status;
  }
  return "queued";
}

function emitToSubscribers(job, event) {
  if (!job?.subscribers?.size) return;
  for (const cb of job.subscribers) {
    try {
      cb(event);
    } catch {}
  }
}

function appendEvent(job, event) {
  if (!Array.isArray(job.events)) job.events = [];
  const fullEvent = {
    seq: seq++,
    at: nowIso(),
    ...event,
  };
  job.events.push(fullEvent);
  if (job.events.length > 200) {
    job.events = job.events.slice(-200);
  }
  emitToSubscribers(job, fullEvent);
  return fullEvent;
}

function toPublic(job) {
  if (!job) return null;
  return {
    id: job.id,
    status: clampStatus(job.status),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    error: job.error || null,
    metrics: job.metrics || null,
  };
}

function toPublicFromRecord(record) {
  if (!record) return null;
  return {
    id: record.id,
    status: clampStatus(record.status),
    createdAt: record.createdAt?.toISOString?.() || record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() || record.updatedAt,
    startedAt: record.startedAt?.toISOString?.() || record.startedAt || null,
    endedAt: record.endedAt?.toISOString?.() || record.endedAt || null,
    error: record.error || null,
    metrics: record.metrics || null,
    result: record.result || null,
    userId: record.userId,
    attempts: record.attempts || 0,
    workerId: record.workerId || null,
    leaseUntil: record.leaseUntil?.toISOString?.() || record.leaseUntil || null,
  };
}

function terminalStatus(status) {
  return status === "done" || status === "error" || status === "cancelled";
}

async function markStaleActiveJobsInterrupted() {
  if (!Number.isFinite(ACTIVE_JOB_STALE_MS) || ACTIVE_JOB_STALE_MS <= 0) return;
  const cutoff = new Date(Date.now() - ACTIVE_JOB_STALE_MS);
  await prisma.researchJob.updateMany({
    where: {
      status: { in: ACTIVE_STATUSES },
      updatedAt: { lt: cutoff },
      leaseUntil: null,
    },
    data: {
      status: "error",
      error: "research.error.interrupted",
      endedAt: new Date(),
    },
  });
}

function toRuntimeJob(record) {
  if (!record?.id) return null;
  const existing = jobs.get(record.id);
  if (existing && !terminalStatus(existing.status)) return existing;
  const createdAt = record.createdAt?.toISOString?.() || nowIso();
  const updatedAt = record.updatedAt?.toISOString?.() || createdAt;
  const job = {
    id: record.id,
    userId: record.userId,
    payload: record.payload || {},
    status: clampStatus(record.status),
    createdAt,
    updatedAt,
    startedAt: record.startedAt?.toISOString?.() || null,
    endedAt: record.endedAt?.toISOString?.() || null,
    error: record.error || null,
    result: record.result || null,
    metrics: record.metrics || null,
    attempts: record.attempts || 0,
    workerId: record.workerId || null,
    leaseUntil: record.leaseUntil?.toISOString?.() || null,
    cancelRequested: record.status === "cancelled",
    abortController: new AbortController(),
    events: [],
    subscribers: new Set(),
  };
  jobs.set(job.id, job);
  return job;
}

async function persistJobUpdate(job, data) {
  if (!job?.id) return;
  try {
    await prisma.researchJob.update({
      where: { id: job.id },
      data,
    });
  } catch (error) {
    try {
      console.error("[research][jobStore] persist update failed", error);
    } catch {}
  }
}

async function sweepExpiredPersistedJobs() {
  if (!Number.isFinite(DB_JOB_RETENTION_MS) || DB_JOB_RETENTION_MS <= 0) return;
  const now = Date.now();
  if (now - lastDbSweepAt < DB_JOB_SWEEP_MS) return;
  lastDbSweepAt = now;
  const cutoff = new Date(now - DB_JOB_RETENTION_MS);
  try {
    await prisma.researchJob.deleteMany({
      where: {
        status: { in: TERMINAL_STATUSES },
        endedAt: { lt: cutoff },
      },
    });
  } catch (error) {
    try {
      console.error("[research][jobStore] persisted sweep failed", error);
    } catch {}
  }
}

function shouldDelete(job, now) {
  if (!job) return true;
  if (job.status === "running" || job.status === "queued") return false;
  const ended = job.endedAt ? Date.parse(job.endedAt) : Date.parse(job.updatedAt || job.createdAt || nowIso());
  if (!Number.isFinite(ended)) return false;
  return now - ended > JOB_TTL_MS;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (shouldDelete(job, now)) jobs.delete(id);
  }
}, JOB_SWEEP_MS).unref?.();

export async function createResearchJob({ userId, payload }) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    const error = new Error("research.error.invalid_user");
    error.code = "INVALID_USER";
    throw error;
  }
  if ((await getActiveResearchJobCount(normalizedUserId)) > 0) {
    const error = new Error("research.error.active_job_limit");
    error.code = "ACTIVE_JOB_LIMIT";
    throw error;
  }
  await sweepExpiredPersistedJobs();
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  const job = {
    id,
    userId: normalizedUserId,
    payload,
    status: "queued",
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    endedAt: null,
    error: null,
    result: null,
    metrics: null,
    attempts: 0,
    workerId: null,
    leaseUntil: null,
    cancelRequested: false,
    abortController: new AbortController(),
    events: [],
    subscribers: new Set(),
  };
  try {
    await prisma.researchJob.create({
      data: {
        id,
        userId: normalizedUserId,
        payload: payload || {},
        status: "queued",
        createdAt: new Date(createdAt),
        updatedAt: new Date(createdAt),
      },
    });
  } catch (error) {
    if (error?.code === "P2002") {
      const activeJobError = new Error("research.error.active_job_limit");
      activeJobError.code = "ACTIVE_JOB_LIMIT";
      throw activeJobError;
    }
    throw error;
  }
  jobs.set(id, job);
  appendEvent(job, { type: "status", status: "queued" });
  return job;
}

export function getResearchJob(jobId) {
  return jobs.get(String(jobId));
}

export function getResearchJobPublic(jobId) {
  return toPublic(getResearchJob(jobId));
}

export async function getResearchJobSnapshot(jobId) {
  await sweepExpiredPersistedJobs();
  const liveJob = getResearchJob(jobId);
  if (liveJob) {
    return {
      ...toPublic(liveJob),
      result: liveJob.result || null,
      userId: liveJob.userId,
    };
  }
  const record = await prisma.researchJob.findUnique({
    where: { id: String(jobId || "") },
  });
  return toPublicFromRecord(record);
}

export function subscribeResearchJob(jobId, callback) {
  const job = getResearchJob(jobId);
  if (!job || typeof callback !== "function") {
    return () => {};
  }
  for (const event of job.events) {
    try {
      callback(event);
    } catch {}
  }
  job.subscribers.add(callback);
  return () => {
    try {
      job.subscribers.delete(callback);
    } catch {}
  };
}

export async function publishResearchProgress(job, payload) {
  if (!job) return;
  job.updatedAt = nowIso();
  appendEvent(job, { type: "progress", ...payload });
  const data = { updatedAt: new Date(job.updatedAt) };
  if (job.workerId && job.leaseUntil) {
    data.workerId = job.workerId;
    data.leaseUntil = new Date(job.leaseUntil);
  }
  await persistJobUpdate(job, data);
}

export async function markResearchRunning(job) {
  if (!job) return;
  job.status = "running";
  job.startedAt = nowIso();
  job.updatedAt = job.startedAt;
  appendEvent(job, { type: "status", status: "running" });
  const data = {
    status: "running",
    startedAt: new Date(job.startedAt),
  };
  if (job.workerId && job.leaseUntil) {
    data.workerId = job.workerId;
    data.leaseUntil = new Date(job.leaseUntil);
  }
  await persistJobUpdate(job, data);
}

export async function markResearchDone(job, result, metrics = null) {
  if (!job) return;
  const endedAt = nowIso();
  job.status = "done";
  job.updatedAt = endedAt;
  job.endedAt = endedAt;
  job.result = result || null;
  job.metrics = metrics || null;
  appendEvent(job, { type: "result", result: job.result, metrics: job.metrics });
  appendEvent(job, { type: "status", status: "done" });
  appendEvent(job, { type: "done" });
  await persistJobUpdate(job, {
    status: "done",
    error: null,
    result: job.result,
    metrics: job.metrics,
    workerId: null,
    leaseUntil: null,
    endedAt: new Date(endedAt),
  });
}

export async function markResearchFailed(job, errorMessage, metrics = null) {
  if (!job) return;
  const endedAt = nowIso();
  job.status = "error";
  job.updatedAt = endedAt;
  job.endedAt = endedAt;
  job.error = String(errorMessage || "research.error.failed");
  job.metrics = metrics || null;
  appendEvent(job, { type: "error", message: job.error, metrics: job.metrics });
  appendEvent(job, { type: "status", status: "error" });
  appendEvent(job, { type: "done" });
  await persistJobUpdate(job, {
    status: "error",
    error: job.error,
    metrics: job.metrics,
    workerId: null,
    leaseUntil: null,
    endedAt: new Date(endedAt),
  });
}

export async function cancelResearchJob(job, message = "research.error.cancelled") {
  if (!job) return;
  if (terminalStatus(job.status)) return;
  job.cancelRequested = true;
  try {
    job.abortController?.abort?.();
  } catch {}
  const endedAt = nowIso();
  job.status = "cancelled";
  job.updatedAt = endedAt;
  job.endedAt = endedAt;
  job.error = String(message || "research.error.cancelled");
  appendEvent(job, { type: "error", message: job.error });
  appendEvent(job, { type: "status", status: "cancelled" });
  appendEvent(job, { type: "done" });
  await persistJobUpdate(job, {
    status: "cancelled",
    error: job.error,
    workerId: null,
    leaseUntil: null,
    endedAt: new Date(endedAt),
  });
}

export function isResearchCancelled(job) {
  return Boolean(job?.cancelRequested || job?.status === "cancelled");
}

export async function syncResearchCancellation(job) {
  if (!job?.id || isResearchCancelled(job)) return isResearchCancelled(job);
  try {
    const record = await prisma.researchJob.findUnique({
      where: { id: job.id },
      select: { status: true, error: true },
    });
    if (record?.status === "cancelled") {
      job.cancelRequested = true;
      job.status = "cancelled";
      job.error = record.error || "research.error.cancelled";
      try {
        job.abortController?.abort?.();
      } catch {}
      return true;
    }
  } catch (error) {
    try {
      console.error("[research][jobStore] cancellation sync failed", error);
    } catch {}
  }
  return false;
}

export function assertResearchAccess(job, userId) {
  if (!job) return false;
  return String(job.userId) === String(userId);
}

export async function getResearchJobResult(jobId) {
  await sweepExpiredPersistedJobs();
  const job = getResearchJob(jobId);
  if (job) {
    return {
      ...toPublic(job),
      result: job.result || null,
    };
  }
  const record = await prisma.researchJob.findUnique({
    where: { id: String(jobId || "") },
  });
  return toPublicFromRecord(record);
}

export async function getActiveResearchJobCount(userId) {
  const targetUserId = String(userId || "").trim();
  if (!targetUserId) return 0;
  await sweepExpiredPersistedJobs();
  await markStaleActiveJobsInterrupted();
  return prisma.researchJob.count({
    where: {
      userId: targetUserId,
      status: { in: ACTIVE_STATUSES },
    },
  });
}

export async function hasActiveResearchJob(userId) {
  return (await getActiveResearchJobCount(userId)) > 0;
}

export async function claimNextResearchJob(options = {}) {
  await sweepExpiredPersistedJobs();
  const workerId = String(options.workerId || `research-worker-${process.pid}`).trim();
  const leaseMs = Math.max(30_000, Number(options.leaseMs) || DEFAULT_WORKER_LEASE_MS);
  const maxAttempts = Math.max(1, Number(options.maxAttempts) || DEFAULT_WORKER_MAX_ATTEMPTS);
  const staleMs = Math.max(30_000, Number(options.staleMs) || ACTIVE_JOB_STALE_MS);
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + leaseMs);
  const staleCutoff = new Date(now.getTime() - staleMs);

  await prisma.researchJob.updateMany({
    where: {
      status: { in: ACTIVE_STATUSES },
      attempts: { gte: maxAttempts },
      OR: [
        { status: "queued" },
        { leaseUntil: { lt: now } },
        { leaseUntil: null, updatedAt: { lt: staleCutoff } },
      ],
    },
    data: {
      status: "error",
      error: "research.error.failed",
      workerId: null,
      leaseUntil: null,
      endedAt: now,
    },
  });

  const rows = await prisma.$queryRaw`
    UPDATE "public"."ResearchJob"
    SET
      "status" = 'running',
      "workerId" = ${workerId},
      "leaseUntil" = ${leaseUntil},
      "attempts" = "attempts" + 1,
      "startedAt" = COALESCE("startedAt", ${now}),
      "updatedAt" = ${now},
      "error" = NULL
    WHERE "id" = (
      SELECT "id"
      FROM "public"."ResearchJob"
      WHERE
        (
          "status" = 'queued'
          OR (
            "status" = 'running'
            AND (
              "leaseUntil" < ${now}
              OR ("leaseUntil" IS NULL AND "updatedAt" < ${staleCutoff})
            )
          )
        )
        AND "attempts" < ${maxAttempts}
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *;
  `;
  const record = Array.isArray(rows) ? rows[0] : null;
  return toRuntimeJob(record);
}

export function startResearchJobLeaseHeartbeat(job, options = {}) {
  if (!job?.id) return () => {};
  const workerId = String(options.workerId || job.workerId || "").trim();
  const leaseMs = Math.max(30_000, Number(options.leaseMs) || DEFAULT_WORKER_LEASE_MS);
  const intervalMs = Math.max(5_000, Math.min(60_000, Number(options.intervalMs) || Math.trunc(leaseMs / 3)));
  let stopped = false;

  const renew = async () => {
    if (stopped || terminalStatus(job.status)) return;
    const leaseUntil = new Date(Date.now() + leaseMs);
    job.leaseUntil = leaseUntil.toISOString();
    try {
      await prisma.researchJob.updateMany({
        where: {
          id: job.id,
          status: "running",
          ...(workerId ? { workerId } : {}),
        },
        data: {
          leaseUntil,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      try {
        console.error("[research][jobStore] lease renewal failed", error);
      } catch {}
    }
  };

  const timer = setInterval(() => {
    void renew();
  }, intervalMs);
  timer.unref?.();
  void renew();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
