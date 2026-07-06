import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  buildDownloadHeaders,
  getFileExtension,
  resolveDocsStorageDir,
  sanitizeTextFilename
} from "@/lib/documents/server";

import { KOV_FILE_ROLE_META, resolveKovFileKeyFromParam } from "./shared";

const KOV_STORAGE_SUBDIR = "kov";
const MAX_KOV_FILE_SIZE_BYTES = 12 * 1024 * 1024;

const ROLE_RULES = {
  "sources-json": {
    extensions: [".json"],
    mime: "application/json"
  },
  "data-json": {
    extensions: [".json"],
    mime: "application/json"
  },
  "meta-json": {
    extensions: [".json"],
    mime: "application/json"
  },
  "rag-md": {
    extensions: [".md", ".txt"],
    mime: "text/markdown"
  },
  "rt-json": {
    extensions: [".json"],
    mime: "application/json"
  },
  "rt-md": {
    extensions: [".md", ".txt"],
    mime: "text/markdown"
  },
  "rt-xml": {
    extensions: [".xml"],
    mime: "application/xml"
  }
};

function assertTextBuffer(buffer) {
  const text = buffer.toString("utf8");
  if (text.includes("\u0000")) {
    const error = new Error("kov.files.binary_not_allowed");
    error.status = 415;
    throw error;
  }
}

export function resolveKovStorageDir() {
  return path.join(resolveDocsStorageDir(), KOV_STORAGE_SUBDIR);
}

export async function ensureKovStorage() {
  await fs.mkdir(resolveKovStorageDir(), { recursive: true });
}

export function buildKovStoredFilePath(slug, paramRole, originalName = "") {
  const key = resolveKovFileKeyFromParam(paramRole);
  if (!key) {
    const error = new Error("kov.files.role_invalid");
    error.status = 400;
    throw error;
  }

  const roleRule = ROLE_RULES[paramRole];
  const ext = getFileExtension(originalName);
  const chosenExtension = roleRule.extensions.includes(ext) ? ext : roleRule.extensions[0];
  const safeSlug = String(slug || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  return path.posix.join(KOV_STORAGE_SUBDIR, safeSlug, `${crypto.randomUUID()}${chosenExtension}`);
}

function resolveAbsoluteKovPath(storagePath) {
  const storageDir = resolveKovStorageDir();
  const normalized = path.normalize(String(storagePath || ""));
  const absolute = path.resolve(resolveDocsStorageDir(), normalized);
  const storageRoot = path.resolve(storageDir);
  if (absolute !== storageRoot && !absolute.startsWith(`${storageRoot}${path.sep}`)) {
    throw new Error("kov.files.storage_path_invalid");
  }
  return absolute;
}

export async function writeUploadedKovFile(file, storagePath, paramRole) {
  if (!file || typeof file === "string") {
    const error = new Error("kov.files.file_required");
    error.status = 400;
    throw error;
  }

  if (Number(file.size || 0) > MAX_KOV_FILE_SIZE_BYTES) {
    const error = new Error("kov.files.file_too_large");
    error.status = 413;
    throw error;
  }

  const roleRule = ROLE_RULES[String(paramRole || "").trim()];
  if (!roleRule) {
    const error = new Error("kov.files.role_invalid");
    error.status = 400;
    throw error;
  }

  const ext = getFileExtension(file.name);
  if (!roleRule.extensions.includes(ext)) {
    const error = new Error("kov.files.extension_invalid");
    error.status = 415;
    throw error;
  }

  const absolutePath = resolveAbsoluteKovPath(storagePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  assertTextBuffer(buffer);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  await fs.writeFile(absolutePath, buffer);

  return {
    size: buffer.byteLength,
    sha256,
    mime: roleRule.mime
  };
}

export async function readStoredKovFile(storagePath) {
  return fs.readFile(resolveAbsoluteKovPath(storagePath));
}

export async function deleteStoredKovFile(storagePath) {
  try {
    await fs.unlink(resolveAbsoluteKovPath(storagePath));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

export function buildKovDownloadHeaders(fileKey, slug, originalName = "") {
  const meta = KOV_FILE_ROLE_META[fileKey];
  const fallbackName = meta?.fileNamePattern?.replace("{slug}", String(slug || "").trim()) || originalName || "kov-file";
  return buildDownloadHeaders(
    sanitizeTextFilename(originalName || fallbackName),
    fileKey === "ragMd" || fileKey === "rtMd"
      ? "text/markdown"
      : fileKey === "rtXml"
        ? "application/xml"
        : "application/json"
  );
}
