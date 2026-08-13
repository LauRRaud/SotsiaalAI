import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { DATA_EXPORT_REGISTRY } from "@/lib/dataExport/registry";
import { buildPortableZip, sha256 } from "@/lib/dataExport/zip";
import { createNotificationEvent, NOTIFICATION_EVENT_TYPES } from "@/lib/notifications";
import { logDataAudit } from "@/lib/privacy/audit";
import { prisma as defaultPrisma } from "@/lib/prisma";

export const DATA_EXPORT_STATUS = Object.freeze({
  QUEUED: "queued",
  RUNNING: "running",
  READY: "ready",
  FAILED: "failed",
  CANCELLED: "cancelled",
  EXPIRED: "expired"
});
export const DATA_EXPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES = [DATA_EXPORT_STATUS.QUEUED, DATA_EXPORT_STATUS.RUNNING, DATA_EXPORT_STATUS.READY];

function exportError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function storageDirectory() {
  const configured = String(process.env.DATA_EXPORT_STORAGE_DIR || "").trim();
  if (process.env.NODE_ENV === "production" && !configured) throw exportError("data_export.storage_missing", 500);
  // Runtime-only storage root (env-configured in prod; cwd-relative dev fallback).
  // The turbopackIgnore hint stops Next's file tracer from treating this cwd-relative
  // path.resolve as "the whole project is reachable" and pulling next.config.mjs +
  // the repo root into every route's NFT bundle (10 build warnings, larger traces).
  return path.resolve(/* turbopackIgnore: true */ configured || path.join("tmp", "data-exports"));
}

function storageFileName(jobId) {
  if (!/^[A-Za-z0-9_-]+$/u.test(String(jobId || ""))) throw exportError("data_export.invalid_job", 400);
  return `${jobId}.zip`;
}

function serializeJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    requestedAt: job.requestedAt?.toISOString?.() || job.requestedAt || null,
    readyAt: job.readyAt?.toISOString?.() || job.readyAt || null,
    expiresAt: job.expiresAt?.toISOString?.() || job.expiresAt || null,
    downloadedAt: job.downloadedAt?.toISOString?.() || job.downloadedAt || null,
    failureCode: job.failureCode || null,
    canCancel: job.status === DATA_EXPORT_STATUS.QUEUED || job.status === DATA_EXPORT_STATUS.RUNNING,
    canDownload: job.status === DATA_EXPORT_STATUS.READY && new Date(job.expiresAt).getTime() > Date.now()
  };
}

function isUniqueConflict(error) {
  return error?.code === "P2002" || error?.name === "UniqueConstraintError";
}

async function advisoryLock(db, userId) {
  if (typeof db.$executeRawUnsafe !== "function") return;
  try {
    await db.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `data-export:${userId}`);
  } catch {
    // Unit-test and non-Postgres adapters do not implement advisory locks; the
    // partial unique index remains the durable production race guard.
  }
}

export async function requestDataExport(userId, { db = defaultPrisma, now = new Date(), audit = logDataAudit } = {}) {
  const ownerId = String(userId || "").trim();
  if (!ownerId) throw exportError("api.common.unauthorized", 401);

  const create = async tx => {
    await advisoryLock(tx, ownerId);
    const active = await tx.dataExportJob.findFirst({
      where: { userId: ownerId, status: { in: ACTIVE_STATUSES } },
      orderBy: { requestedAt: "desc" }
    });
    if (active) return { created: false, job: active };
    const job = await tx.dataExportJob.create({
      data: {
        userId: ownerId,
        idempotencyKey: `v1:${now.getTime()}:${crypto.randomUUID()}`,
        status: DATA_EXPORT_STATUS.QUEUED,
        requestedAt: now
      }
    });
    return { created: true, job };
  };

  let result;
  try {
    result = typeof db.$transaction === "function" ? await db.$transaction(create) : await create(db);
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const job = await db.dataExportJob.findFirst({
      where: { userId: ownerId, status: { in: ACTIVE_STATUSES } },
      orderBy: { requestedAt: "desc" }
    });
    if (!job) throw error;
    result = { created: false, job };
  }
  if (result.created) {
    await audit({ actorUserId: ownerId, targetUserId: ownerId, action: "DATA_EXPORT_REQUESTED", resourceType: "DataExportJob", resourceId: result.job.id, meta: { status: "queued" } });
  }
  return { ...result, job: serializeJob(result.job) };
}

export async function listDataExports(userId, { db = defaultPrisma } = {}) {
  const ownerId = String(userId || "").trim();
  if (!ownerId) throw exportError("api.common.unauthorized", 401);
  const jobs = await db.dataExportJob.findMany({
    where: { userId: ownerId }, orderBy: [{ requestedAt: "desc" }, { id: "desc" }], take: 10
  });
  return jobs.map(serializeJob);
}

export async function cancelDataExport(userId, jobId, { db = defaultPrisma, now = new Date(), audit = logDataAudit } = {}) {
  const ownerId = String(userId || "").trim();
  const id = String(jobId || "").trim();
  const result = await db.dataExportJob.updateMany({
    where: { id, userId: ownerId, status: { in: [DATA_EXPORT_STATUS.QUEUED, DATA_EXPORT_STATUS.RUNNING] } },
    data: { status: DATA_EXPORT_STATUS.CANCELLED, cancelledAt: now, outputPath: null, outputSha256: null, outputBytes: null }
  });
  if (result.count !== 1) throw exportError("api.common.not_found", 404);
  const job = await db.dataExportJob.findFirst({ where: { id, userId: ownerId } });
  await audit({ actorUserId: ownerId, targetUserId: ownerId, action: "DATA_EXPORT_CANCELLED", resourceType: "DataExportJob", resourceId: id, meta: { status: "cancelled" } });
  return serializeJob(job);
}

async function collectExportEntries(job, { db, now, ...collectDependencies }) {
  const entries = [];
  const surfaces = [];
  for (const surface of DATA_EXPORT_REGISTRY) {
    const collected = await surface.collect({ db, userId: job.userId, ...collectDependencies });
    const files = collected.map(item => ({ name: item.name, content: item.content, manifest: item.manifest }));
    entries.push(...files);
    surfaces.push({
      name: surface.name,
      version: surface.version,
      thirdPartyExcluded: surface.thirdPartyExcluded === true,
      recordCount: collected.reduce((sum, item) => sum + Number(item.count || 0), 0),
      files: files.map(file => ({
        name: file.name,
        sha256: sha256(file.content),
        ...(file.manifest ? file.manifest : {})
      }))
    });
  }
  const manifest = {
    schemaVersion: "data-export-v1",
    jobId: job.id,
    generatedAt: now.toISOString(),
    surfaces
  };
  entries.unshift({ name: "manifest.json", content: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8") });
  return { entries, manifest };
}

export async function runNextDataExport({
  db = defaultPrisma,
  now = new Date(),
  audit = logDataAudit,
  notify = createNotificationEvent,
  ...collectDependencies
} = {}) {
  const candidate = await db.dataExportJob.findFirst({
    where: { status: DATA_EXPORT_STATUS.QUEUED }, orderBy: { requestedAt: "asc" }
  });
  if (!candidate) return null;
  const claim = await db.dataExportJob.updateMany({
    where: { id: candidate.id, status: DATA_EXPORT_STATUS.QUEUED },
    data: { status: DATA_EXPORT_STATUS.RUNNING, startedAt: now, attempts: { increment: 1 } }
  });
  if (claim.count !== 1) return null;
  const job = await db.dataExportJob.findUnique({ where: { id: candidate.id } });
  try {
    const { entries, manifest } = await collectExportEntries(job, { db, now, ...collectDependencies });
    const archive = buildPortableZip(entries, now);
    const directory = storageDirectory();
    await fs.mkdir(directory, { recursive: true });
    const outputPath = path.join(directory, storageFileName(job.id));
    await fs.writeFile(outputPath, archive, { flag: "wx" });
    const expiresAt = new Date(now.getTime() + DATA_EXPORT_TTL_MS);
    const updated = await db.dataExportJob.update({ where: { id: job.id }, data: {
      status: DATA_EXPORT_STATUS.READY, readyAt: now, expiresAt, outputPath, outputSha256: sha256(archive), outputBytes: archive.length, manifest, failureCode: null
    } });
    await audit({ actorUserId: job.userId, targetUserId: job.userId, action: "DATA_EXPORT_READY", resourceType: "DataExportJob", resourceId: job.id, meta: { status: "ready", bytes: archive.length } });
    await notify({ type: NOTIFICATION_EVENT_TYPES.DATA_EXPORT_READY, userId: job.userId, sourceId: job.id, targetId: job.id, emailPolicy: "OPTIONAL" }, { db, verifyRecipient: false, now });
    return serializeJob(updated);
  } catch (error) {
    const failureCode = String(error?.message || "data_export.failed").slice(0, 120);
    await db.dataExportJob.updateMany({ where: { id: job.id, status: DATA_EXPORT_STATUS.RUNNING }, data: { status: DATA_EXPORT_STATUS.FAILED, failureCode, outputPath: null } });
    await audit({ actorUserId: job.userId, targetUserId: job.userId, action: "DATA_EXPORT_FAILED", resourceType: "DataExportJob", resourceId: job.id, meta: { status: "failed", failureCode } });
    throw error;
  }
}

export async function readDataExportForOwner(userId, jobId, { db = defaultPrisma, now = new Date(), audit = logDataAudit } = {}) {
  const ownerId = String(userId || "").trim();
  const job = await db.dataExportJob.findFirst({ where: { id: String(jobId || ""), userId: ownerId, status: DATA_EXPORT_STATUS.READY, expiresAt: { gt: now } } });
  if (!job?.outputPath) throw exportError("api.common.not_found", 404);
  let content;
  try { content = await fs.readFile(job.outputPath); } catch { throw exportError("api.common.not_found", 404); }
  await db.dataExportJob.updateMany({ where: { id: job.id, userId: ownerId, downloadedAt: null }, data: { downloadedAt: now } });
  await audit({ actorUserId: ownerId, targetUserId: ownerId, action: "DATA_EXPORT_DOWNLOADED", resourceType: "DataExportJob", resourceId: job.id, meta: { status: "downloaded" } });
  return { job: serializeJob(job), content };
}

export async function expireDataExports({ db = defaultPrisma, now = new Date(), audit = logDataAudit } = {}) {
  const rows = await db.dataExportJob.findMany({ where: { status: DATA_EXPORT_STATUS.READY, expiresAt: { lte: now } }, select: { id: true, userId: true, outputPath: true } });
  for (const row of rows) {
    if (row.outputPath) await fs.unlink(row.outputPath).catch(error => { if (error?.code !== "ENOENT") throw error; });
    await db.dataExportJob.updateMany({ where: { id: row.id, status: DATA_EXPORT_STATUS.READY }, data: { status: DATA_EXPORT_STATUS.EXPIRED, outputPath: null, outputSha256: null, outputBytes: null, manifest: null } });
    await audit({ actorUserId: row.userId, targetUserId: row.userId, action: "DATA_EXPORT_EXPIRED", resourceType: "DataExportJob", resourceId: row.id, meta: { status: "expired" } });
  }
  return rows.length;
}

export const dataExportInternals = Object.freeze({ serializeJob, collectExportEntries, storageDirectory, storageFileName });
