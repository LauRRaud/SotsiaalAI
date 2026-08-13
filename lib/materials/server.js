import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

import {
  assertMimeMatchesBuffer,
  buildDownloadHeaders,
  ensureAllowedUpload,
  getFileExtension,
  sanitizeTextFilename
} from "@/lib/documents/server"

export { buildDownloadHeaders, ensureAllowedUpload, sanitizeTextFilename }

const FALLBACK_MATERIALS_STORAGE_DIR = "tmp/materials"
const MAX_COMMENT_LENGTH = 4_000

function resolveMaterialsStorageDir() {
  const raw = String(process.env.MATERIALS_STORAGE_DIR || "").trim()
  if (!raw && process.env.NODE_ENV === "production") {
    const error = new Error("materials_page.errors.storage_dir_missing")
    error.status = 503
    throw error
  }
  if (raw) return path.resolve(/*turbopackIgnore: true*/ raw)
  return path.resolve(/*turbopackIgnore: true*/ FALLBACK_MATERIALS_STORAGE_DIR)
}

export function resolveMaterialsUploadsDir() {
  return path.join(resolveMaterialsStorageDir(), "uploads")
}

export function resolveMaterialsQuarantineDir() {
  const quarantineDir = path.join(resolveMaterialsStorageDir(), "quarantine")
  const publicRoot = path.resolve(/*turbopackIgnore: true*/ "public")
  const resolved = path.resolve(/*turbopackIgnore: true*/ quarantineDir)
  if (resolved === publicRoot || resolved.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error("materials.errors.quarantine_inside_webroot")
  }
  return resolved
}

export function resolveMaterialsSanitizedDir() {
  return path.join(resolveMaterialsStorageDir(), "sanitized")
}

export async function ensureMaterialsStorage() {
  await fs.mkdir(/*turbopackIgnore: true*/ resolveMaterialsUploadsDir(), { recursive: true })
  await fs.mkdir(/*turbopackIgnore: true*/ resolveMaterialsQuarantineDir(), { recursive: true, mode: 0o700 })
  await fs.mkdir(/*turbopackIgnore: true*/ resolveMaterialsSanitizedDir(), { recursive: true, mode: 0o700 })
}

export function normalizeMaterialComment(value) {
  const normalized = String(value || "").replace(/\r\n/g, "\n").trim()
  if (!normalized) return ""
  return normalized.slice(0, MAX_COMMENT_LENGTH)
}

export function getStoredMaterialPath(originalName) {
  const extension = getFileExtension(originalName)
  return path.posix.join("uploads", `${crypto.randomUUID()}${extension}`)
}

export function getSanitizedMaterialPath(storagePath) {
  const name = path.basename(String(storagePath || ""))
  if (!name) throw new Error("materials.errors.storage_path_invalid")
  return path.posix.join("sanitized", `${name}.sanitized.txt`)
}

export function getQuarantinedMaterialPath() {
  return path.posix.join("quarantine", crypto.randomUUID())
}

export function resolveAbsoluteQuarantinePath(storagePath) {
  const normalized = path.normalize(String(storagePath || ""))
  const root = path.resolve(/*turbopackIgnore: true*/ resolveMaterialsQuarantineDir())
  const absolute = path.resolve(/*turbopackIgnore: true*/ resolveMaterialsStorageDir(), normalized)
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error("materials.errors.quarantine_path_invalid")
  }
  return absolute
}

export async function writeQuarantinedMaterial(buffer, storagePath) {
  await ensureMaterialsStorage()
  await fs.writeFile(/*turbopackIgnore: true*/ resolveAbsoluteQuarantinePath(storagePath), buffer, {
    flag: "wx",
    mode: 0o600
  })
}

export async function deleteQuarantinedMaterial(storagePath) {
  try {
    await fs.unlink(/*turbopackIgnore: true*/ resolveAbsoluteQuarantinePath(storagePath))
  } catch (error) {
    if (error?.code !== "ENOENT") throw error
  }
}

export function resolveAbsoluteMaterialPath(storagePath) {
  const uploadsDir = resolveMaterialsUploadsDir()
  const normalized = path.normalize(String(storagePath || ""))
  const storageRoot = path.resolve(/*turbopackIgnore: true*/ resolveMaterialsStorageDir())
  const absolute = path.resolve(/*turbopackIgnore: true*/ storageRoot, normalized)
  const allowedRoots = [uploadsDir, resolveMaterialsSanitizedDir()]
    .map(root => path.resolve(/*turbopackIgnore: true*/ root))
  if (!allowedRoots.some(root => absolute === root || absolute.startsWith(`${root}${path.sep}`))) {
    throw new Error("materials.errors.storage_path_invalid")
  }
  return absolute
}

export async function storedMaterialExists(storagePath) {
  if (!storagePath) return false
  try {
    await fs.stat(/*turbopackIgnore: true*/ resolveAbsoluteMaterialPath(storagePath))
    return true
  } catch (error) {
    if (error?.code === "ENOENT") return false
    throw error
  }
}

export async function writeMaterialBuffer(buffer, storagePath) {
  await ensureMaterialsStorage()
  await fs.writeFile(/*turbopackIgnore: true*/ resolveAbsoluteMaterialPath(storagePath), buffer, { mode: 0o600 })
}

export async function publishStoredMaterial(stagingPath, finalPath) {
  if (await storedMaterialExists(finalPath)) return
  await fs.rename(
    /*turbopackIgnore: true*/ resolveAbsoluteMaterialPath(stagingPath),
    /*turbopackIgnore: true*/ resolveAbsoluteMaterialPath(finalPath)
  )
}

export async function writeUploadedMaterial(file, storagePath, mime) {
  const absolutePath = resolveAbsoluteMaterialPath(storagePath)
  const buffer = Buffer.from(await file.arrayBuffer())
  assertMimeMatchesBuffer(buffer, mime)
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex")
  await fs.writeFile(/*turbopackIgnore: true*/ absolutePath, buffer)

  return {
    size: buffer.byteLength,
    sha256
  }
}

export async function readStoredMaterial(storagePath) {
  return fs.readFile(/*turbopackIgnore: true*/ resolveAbsoluteMaterialPath(storagePath))
}

export async function readSanitizedMaterial(storagePath) {
  return readStoredMaterial(getSanitizedMaterialPath(storagePath))
}

export async function deleteStoredMaterial(storagePath) {
  try {
    await fs.unlink(/*turbopackIgnore: true*/ resolveAbsoluteMaterialPath(storagePath))
  } catch (error) {
    if (error?.code !== "ENOENT") throw error
  }
}
