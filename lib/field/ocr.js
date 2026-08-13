/**
 * FIELD-V1 OCR (doc ptk 5, O-FD-5): server-side, command-driven (Tesseract
 * `est`), strictly on user command and only over an already-synced photo.
 * The output is returned as an UNSAVED draft — the client shows it next to
 * the image and only a user confirmation turns it into a note with
 * AI_MUSTAND provenance. When no OCR binary is configured the endpoint says
 * so honestly (503) and the UI falls back to manual typing.
 */

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { readStoredDocument } from "@/lib/documents/server";

const MAX_OCR_OUTPUT_CHARS = 20000;
const OCR_RATE_WINDOW_MS = 60_000;
const OCR_RATE_MAX = 6;
const OCR_MAX_ATTEMPTS = 3;

function enabled(value) {
  return ["1", "true", "on", "yes"].includes(String(value ?? "false").trim().toLowerCase());
}

export function isFieldOcrConfigured(env = process.env) {
  return enabled(env.FIELD_OCR_ENABLED) && Boolean(String(env.FIELD_OCR_CMD || "tesseract").trim());
}

function runCommand(cmd, args, { timeoutMs = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
      if (error) reject(error);
      else resolve(String(stdout || ""));
    });
  });
}

/**
 * Runs OCR over an image buffer. `exec` is injectable for tests; the real
 * runner shells out to `tesseract <tmp> stdout -l est+eng`. The temp file is
 * always removed, also on failure.
 */
export async function runFieldOcr(buffer, { env = process.env, exec = runCommand } = {}) {
  if (!isFieldOcrConfigured(env)) {
    const error = new Error("field.errors.ocr_unavailable");
    error.status = 503;
    throw error;
  }
  const cmd = String(env.FIELD_OCR_CMD || "tesseract").trim();
  const lang = String(env.FIELD_OCR_LANG || "est+eng").trim();
  const tmpPath = path.join(os.tmpdir(), `sotsiaalai-field-ocr-${crypto.randomBytes(8).toString("hex")}`);
  await fs.writeFile(tmpPath, buffer);
  try {
    const text = await exec(cmd, [tmpPath, "stdout", "-l", lang]);
    const trimmed = String(text || "").trim();
    return {
      text: trimmed.length > MAX_OCR_OUTPUT_CHARS ? trimmed.slice(0, MAX_OCR_OUTPUT_CHARS) : trimmed,
      truncated: trimmed.length > MAX_OCR_OUTPUT_CHARS
    };
  } catch (cause) {
    const error = new Error("field.errors.ocr_failed");
    error.status = 502;
    error.cause = cause;
    throw error;
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}

function ocrError(message, status, retryAfter = null) {
  const error = new Error(message);
  error.status = status;
  if (retryAfter) error.retryAfter = retryAfter;
  return error;
}

export function hashFieldOcrIp(ipAddress, secret = process.env.AUTH_SECRET || "field-ocr") {
  return crypto.createHmac("sha256", String(secret)).update(String(ipAddress || "unknown")).digest("hex");
}

async function claimOcrRate(db, { ownerUserId, ipHash, now, max = OCR_RATE_MAX }) {
  const since = new Date(now.getTime() - OCR_RATE_WINDOW_MS);
  return db.$transaction(async (tx) => {
    const lockKeys = [
      `fieldOcrRate:owner:${ownerUserId}`,
      `fieldOcrRate:ip:${ipHash}`
    ].sort();
    for (const lockKey of lockKeys) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    }
    const [ownerCount, ipCount] = await Promise.all([
      tx.fieldOcrRateEvent.count({ where: { ownerUserId, createdAt: { gte: since } } }),
      tx.fieldOcrRateEvent.count({ where: { ipHash, createdAt: { gte: since } } })
    ]);
    if (ownerCount >= max || ipCount >= max) throw ocrError("field.errors.ocr_rate_limited", 429, 60);
    await tx.fieldOcrRateEvent.create({ data: { ownerUserId, ipHash, createdAt: now } });
    await tx.fieldOcrRateEvent.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } });
  });
}

async function claimGlobalOcrSlot(tx, concurrency) {
  for (let slot = 0; slot < concurrency; slot += 1) {
    const rows = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(hashtext(${`fieldOcrGlobal:${slot}`})) AS locked`;
    if (rows?.[0]?.locked === true) return slot;
  }
  return null;
}

/** Persistent photo+SHA job, process-wide rate limit and PostgreSQL-global worker slots. */
export async function requestFieldOcr(
  {
    ownerUserId,
    visitId,
    clientItemId,
    ipAddress = "unknown"
  },
  {
    db = prisma,
    now = new Date(),
    readDocument = readStoredDocument,
    execute = runFieldOcr,
    rateMax = OCR_RATE_MAX,
    concurrency = Math.max(1, Math.min(Number(process.env.FIELD_OCR_CONCURRENCY) || 2, 8))
  } = {}
) {
  const attachment = await db.fieldVisitAttachment.findFirst({
    where: {
      visit: { id: String(visitId || ""), ownerUserId },
      clientItemId: String(clientItemId || ""),
      role: "photo",
      storageStatus: "ACTIVE"
    },
    select: {
      id: true,
      visitId: true,
      document: { select: { id: true, ownerId: true, storagePath: true, sha256: true } }
    }
  });
  if (!attachment?.document || attachment.document.ownerId !== ownerUserId) {
    throw ocrError("api.common.not_found", 404);
  }
  const key = {
    attachmentId: attachment.id,
    contentSha256: attachment.document.sha256
  };
  const existing = await db.fieldOcrJob.findUnique({ where: { attachmentId_contentSha256: key } });
  if (existing?.status === "DONE") {
    return { status: "DONE", cached: true, jobId: existing.id, text: existing.resultText || "", truncated: Boolean(existing.resultTruncated) };
  }

  await claimOcrRate(db, {
    ownerUserId,
    ipHash: hashFieldOcrIp(ipAddress),
    now,
    max: Math.max(1, Number(rateMax) || OCR_RATE_MAX)
  });

  let job = existing;
  if (!job) {
    try {
      job = await db.fieldOcrJob.create({
        data: {
          ownerUserId,
          visitId: attachment.visitId,
          attachmentId: attachment.id,
          contentSha256: attachment.document.sha256,
          status: "PENDING",
          createdAt: now,
          updatedAt: now
        }
      });
    } catch (error) {
      if (error?.code !== "P2002") throw error;
      job = await db.fieldOcrJob.findUnique({ where: { attachmentId_contentSha256: key } });
    }
  }
  if (!job) throw ocrError("field.errors.ocr_failed", 500);

  const outcome = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fieldOcrJob:${attachment.id}:${attachment.document.sha256}`}))`;
    const fresh = await tx.fieldOcrJob.findUnique({ where: { id: job.id } });
    if (fresh?.status === "DONE") {
      return { status: "DONE", cached: true, jobId: fresh.id, text: fresh.resultText || "", truncated: Boolean(fresh.resultTruncated) };
    }
    if (Number(fresh?.attempts || 0) >= OCR_MAX_ATTEMPTS) {
      return { error: ocrError("field.errors.ocr_failed", 502) };
    }
    const slot = await claimGlobalOcrSlot(tx, Math.max(1, Math.min(Number(concurrency) || 2, 8)));
    if (slot == null) return { error: ocrError("field.errors.ocr_busy", 429, 2) };
    await tx.fieldOcrJob.update({
      where: { id: fresh.id },
      data: { status: "RUNNING", attempts: { increment: 1 }, leaseStartedAt: now, lastErrorCode: null }
    });
    try {
      const buffer = await readDocument(attachment.document.storagePath);
      const result = await execute(buffer);
      const completed = await tx.fieldOcrJob.update({
        where: { id: fresh.id },
        data: {
          status: "DONE",
          resultText: result.text,
          resultTruncated: Boolean(result.truncated),
          completedAt: now,
          leaseStartedAt: null,
          lastErrorCode: null
        }
      });
      return {
        status: "DONE",
        cached: false,
        jobId: completed.id,
        text: completed.resultText || "",
        truncated: Boolean(completed.resultTruncated)
      };
    } catch (error) {
      await tx.fieldOcrJob.update({
        where: { id: fresh.id },
        data: {
          status: "FAILED",
          leaseStartedAt: null,
          lastErrorCode: String(error?.code || error?.message || "OCR_FAILED").slice(0, 80)
        }
      });
      return { error: ocrError("field.errors.ocr_failed", 502) };
    }
  });
  if (outcome.error) throw outcome.error;
  return outcome;
}

export const fieldOcrInternals = Object.freeze({ claimOcrRate, claimGlobalOcrSlot });
