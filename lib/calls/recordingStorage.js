import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const CALL_RECORDING_MIME_TYPE = "audio/ogg";
const CALL_RECORDING_EXTENSION = ".ogg";
const DEFAULT_FINALIZE_WAIT_MS = 15000;
const DEFAULT_FINALIZE_POLL_MS = 250;

function resolveRuntimeStorageDir(rawPath) {
  return path.resolve(/*turbopackIgnore: true*/ rawPath);
}

async function loadDocumentsStorage() {
  return import("../documents/server.js");
}

function resolveLocalDocsStorageDir(env = process.env) {
  const raw = String(env.DOCS_STORAGE_DIR || "").trim();
  if (env.NODE_ENV === "production" && !raw) {
    throw new Error("documents.errors.storage_dir_missing");
  }
  if (raw) return resolveRuntimeStorageDir(raw);
  return path.resolve("tmp", "documents");
}

function sanitizeId(value, fallback = "unknown") {
  const cleaned = String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_");
  return cleaned || fallback;
}

function safeTimestamp(value) {
  return new Date(value).toISOString().replace(/[^0-9]/g, "").slice(0, 14);
}

export function buildRecordingFileName({ callSessionId, recordingRequestId, now = new Date() }) {
  return `call-recording-${sanitizeId(callSessionId, "call")}-${sanitizeId(recordingRequestId, "request")}-${safeTimestamp(now)}${CALL_RECORDING_EXTENSION}`;
}

function resolveRecordingStorageDir(env = process.env) {
  const raw = String(env.RECORDING_STORAGE_DIR || "").trim();
  if (raw) return resolveRuntimeStorageDir(raw);
  return path.join(resolveLocalDocsStorageDir(env), "call-recordings");
}

export function resolveEgressOutputFilePath(fileName, env = process.env) {
  const egressRoot = String(env.RECORDING_EGRESS_OUTPUT_DIR || "").trim();
  const outputRoot = egressRoot ? resolveRuntimeStorageDir(egressRoot) : resolveRecordingStorageDir(env);
  return path.join(outputRoot, path.basename(fileName));
}

function resolveRecordingSourcePath(fileName, env = process.env) {
  const root = resolveRecordingStorageDir(env);
  const absoluteRoot = path.resolve(/*turbopackIgnore: true*/ root);
  const absolutePath = path.resolve(/*turbopackIgnore: true*/ root, path.basename(fileName));
  if (absolutePath !== absoluteRoot && !absolutePath.startsWith(`${absoluteRoot}${path.sep}`)) {
    throw new Error("call.recording_storage_path_invalid");
  }
  return absolutePath;
}

function durationSecondsBetween(startedAt, stoppedAt) {
  const start = startedAt ? new Date(startedAt).getTime() : 0;
  const stop = stoppedAt ? new Date(stoppedAt).getTime() : 0;
  if (!Number.isFinite(start) || !Number.isFinite(stop) || stop <= start) return null;
  return Math.round((stop - start) / 1000);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitForReadableStableFile(filePath, env = process.env) {
  const timeoutMs = Number(env.RECORDING_FINALIZE_WAIT_MS || DEFAULT_FINALIZE_WAIT_MS);
  const pollMs = Number(env.RECORDING_FINALIZE_POLL_MS || DEFAULT_FINALIZE_POLL_MS);
  const safeTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_FINALIZE_WAIT_MS;
  const safePollMs = Number.isFinite(pollMs) && pollMs > 0 ? pollMs : DEFAULT_FINALIZE_POLL_MS;
  const deadline = Date.now() + safeTimeoutMs;
  let lastError = null;

  while (Date.now() <= deadline) {
    try {
      const first = await fs.stat(/*turbopackIgnore: true*/ filePath);
      if (first.isFile() && first.size > 0) {
        await wait(Math.min(safePollMs, 500));
        const second = await fs.stat(/*turbopackIgnore: true*/ filePath);
        if (second.isFile() && second.size === first.size && second.size > 0) {
          return second;
        }
      }
    } catch (error) {
      lastError = error;
    }
    await wait(safePollMs);
  }

  if (lastError) throw lastError;
  throw new Error("call.recording_file_not_ready");
}

export function retentionUntilFromEnv(env = process.env, now = new Date()) {
  const days = Number(env.RECORDING_DEFAULT_RETENTION_DAYS || 90);
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 90;
  return new Date(now.getTime() + safeDays * 24 * 60 * 60 * 1000);
}

export function createRecordingStorage(env = process.env) {
  return {
    async ensureReady() {
      await fs.mkdir(/*turbopackIgnore: true*/ resolveRecordingStorageDir(env), { recursive: true });
      const { ensureDocumentsStorage } = await loadDocumentsStorage();
      await ensureDocumentsStorage();
    },

    async finalizeRecordingFile({ fileName, startedAt, stoppedAt }) {
      const {
        ensureDocumentsStorage,
        getStoredDocumentPath,
        resolveAbsoluteDocumentPath
      } = await loadDocumentsStorage();
      await ensureDocumentsStorage();
      const sourcePath = resolveRecordingSourcePath(fileName, env);
      await waitForReadableStableFile(sourcePath, env);
      const buffer = await fs.readFile(/*turbopackIgnore: true*/ sourcePath);
      const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
      const storagePath = getStoredDocumentPath(fileName);
      const destinationPath = resolveAbsoluteDocumentPath(storagePath);
      await fs.writeFile(/*turbopackIgnore: true*/ destinationPath, buffer);
      if (path.resolve(sourcePath) !== path.resolve(destinationPath)) {
        await fs.unlink(/*turbopackIgnore: true*/ sourcePath).catch(() => {});
      }
      return {
        storagePath,
        mimeType: CALL_RECORDING_MIME_TYPE,
        fileSizeBytes: buffer.byteLength,
        durationSeconds: durationSecondsBetween(startedAt, stoppedAt),
        checksum
      };
    }
  };
}
