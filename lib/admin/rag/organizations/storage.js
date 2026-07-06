import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  buildDownloadHeaders,
  getFileExtension,
  resolveDocsStorageDir,
  sanitizeTextFilename
} from "@/lib/documents/server";
import { resolveOrganizationFileKeyFromParam } from "./shared";

const ORG_STORAGE_SUBDIR = "organizations";
const MAX_ORG_FILE_SIZE_BYTES = 16 * 1024 * 1024;
const MIME_BY_EXTENSION = {
  ".json": "application/json",
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".csv": "text/csv"
};

export function resolveOrganizationStorageDir() {
  return path.join(resolveDocsStorageDir(), ORG_STORAGE_SUBDIR);
}

export async function ensureOrganizationStorage() {
  await fs.mkdir(resolveOrganizationStorageDir(), { recursive: true });
}

const ROLE_EXTENSIONS = {
  "sources-json": new Set([".json"]),
  "data-json": new Set([".json"]),
  "meta-json": new Set([".json"]),
  "rag-md": new Set([".md", ".txt"]),
  attachment: new Set([".json", ".md", ".txt", ".pdf", ".docx", ".csv"])
};

export function buildOrganizationStoredFilePath(slug, paramRole, originalName = "") {
  const fileKey = resolveOrganizationFileKeyFromParam(paramRole);
  if (!fileKey) {
    const error = new Error("organizations.files.role_invalid");
    error.status = 400;
    throw error;
  }

  const ext = getFileExtension(originalName);
  const allowedExtensions = ROLE_EXTENSIONS[String(paramRole || "").trim()];
  if (!allowedExtensions?.has(ext)) {
    const error = new Error("organizations.files.extension_invalid");
    error.status = 415;
    throw error;
  }

  const safeSlug = String(slug || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  return path.posix.join(ORG_STORAGE_SUBDIR, safeSlug, `${crypto.randomUUID()}${ext}`);
}

function resolveAbsoluteOrganizationPath(storagePath) {
  const storageDir = resolveOrganizationStorageDir();
  const normalized = path.normalize(String(storagePath || ""));
  const absolute = path.resolve(resolveDocsStorageDir(), normalized);
  const storageRoot = path.resolve(storageDir);
  if (absolute !== storageRoot && !absolute.startsWith(`${storageRoot}${path.sep}`)) {
    throw new Error("organizations.files.storage_path_invalid");
  }
  return absolute;
}

export async function writeUploadedOrganizationFile(file, storagePath, paramRole) {
  if (!file || typeof file === "string") {
    const error = new Error("organizations.files.file_required");
    error.status = 400;
    throw error;
  }

  if (Number(file.size || 0) > MAX_ORG_FILE_SIZE_BYTES) {
    const error = new Error("organizations.files.file_too_large");
    error.status = 413;
    throw error;
  }

  const ext = getFileExtension(file.name);
  const allowedExtensions = ROLE_EXTENSIONS[String(paramRole || "").trim()];
  if (!allowedExtensions?.has(ext)) {
    const error = new Error("organizations.files.extension_invalid");
    error.status = 415;
    throw error;
  }

  const absolutePath = resolveAbsoluteOrganizationPath(storagePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  await fs.writeFile(absolutePath, buffer);

  return {
    size: buffer.byteLength,
    sha256,
    mime: MIME_BY_EXTENSION[ext] || String(file.type || "").trim() || "application/octet-stream"
  };
}

export async function readStoredOrganizationFile(storagePath) {
  return fs.readFile(resolveAbsoluteOrganizationPath(storagePath));
}

export async function deleteStoredOrganizationFile(storagePath) {
  try {
    await fs.unlink(resolveAbsoluteOrganizationPath(storagePath));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

export function buildOrganizationDownloadHeaders(originalName = "") {
  const ext = getFileExtension(originalName);
  const mime = MIME_BY_EXTENSION[ext] || "application/octet-stream";
  return buildDownloadHeaders(sanitizeTextFilename(originalName || "organization-file"), mime);
}
