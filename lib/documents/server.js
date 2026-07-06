import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authConfig } from "@/auth"
import { requireSubscription, roleFromSession } from "@/lib/authz"
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages"
import { maybeRunRetentionCleanup } from "@/lib/retention"
import {
  ALLOWED_DOCUMENT_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
  TEMPLATE_FOR_VALUES,
  DOCUMENT_KIND_VALUES
} from "@/lib/documents/constants"
import { toAsciiDownloadFileName } from "@/lib/documents/downloadHeaders"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "X-Content-Type-Options": "nosniff",
  Pragma: "no-cache",
  Expires: "0"
}

function resolveRuntimeStorageDir(rawPath) {
  return path.resolve(/*turbopackIgnore: true*/ rawPath)
}

export function json(data, status = 200, extraHeaders = {}) {
  return NextResponse.json(data, {
    status,
    headers: {
      ...NO_STORE_HEADERS,
      ...extraHeaders
    }
  })
}

export function localeFromRequest(request) {
  const requestUrl = request?.url ? new URL(request.url) : null
  const fromQuery = normalizeServerLocale(
    requestUrl?.searchParams?.get("locale") || requestUrl?.searchParams?.get("lang")
  )
  if (fromQuery) return fromQuery

  const fromHeader =
    normalizeServerLocale(request?.headers?.get("x-ui-locale")) ||
    normalizeServerLocale(request?.headers?.get("x-locale")) ||
    normalizeServerLocale(request?.headers?.get("accept-language"))

  return fromHeader || "en"
}

export function errorJson(messageKey, status = 400, locale = "en", extras = {}) {
  const translated = serverT(locale, messageKey, undefined, messageKey)
  return json(
    {
      ok: false,
      messageKey,
      message: translated,
      error: translated,
      ...extras
    },
    status
  )
}

const PUBLIC_ERROR_KEY_RE = /^(api|documents)\.[a-z0-9_.-]+$/i

export function publicErrorMessageKey(error, fallbackKey) {
  const message = String(error?.message || "").trim()
  return PUBLIC_ERROR_KEY_RE.test(message) ? message : fallbackKey
}

export function publicErrorStatus(error, fallbackStatus = 500) {
  const message = String(error?.message || "").trim()
  const status = Number(error?.status) || Number(error?.statusCode) || Number(error?.response?.status) || 500
  return PUBLIC_ERROR_KEY_RE.test(message) ? status : fallbackStatus
}

export async function requireDocumentUser() {
  try {
    await maybeRunRetentionCleanup()
    const session = await getServerSession(authConfig)
    const userId = session?.user?.id
    if (!userId) {
      return {
        ok: false,
        status: 401,
        message: "api.common.unauthorized"
      }
    }

    const gate = await requireSubscription(session, roleFromSession(session))
    if (!gate.ok) {
      return {
        ok: false,
        status: gate.status,
        message: gate.message,
        redirect: gate.redirect,
        requireSubscription: gate.requireSubscription
      }
    }

    return {
      ok: true,
      session,
      userId: String(userId)
    }
  } catch {
    return {
      ok: false,
      status: 401,
      message: "api.common.unauthorized"
    }
  }
}

export function resolveDocsStorageDir() {
  const raw = String(process.env.DOCS_STORAGE_DIR || "").trim()
  if (process.env.NODE_ENV === "production" && !raw) {
    throw new Error("documents.errors.storage_dir_missing")
  }
  if (raw) return resolveRuntimeStorageDir(raw)
  return path.resolve("tmp", "documents")
}

export function resolveAgentStorageDir() {
  const raw = String(process.env.AGENT_STORAGE_DIR || "").trim()
  if (process.env.NODE_ENV === "production" && !raw) {
    throw new Error("documents.errors.agent_storage_dir_missing")
  }
  if (raw) return resolveRuntimeStorageDir(raw)
  return path.resolve("tmp", "agent")
}

export function resolveDocsUploadsDir() {
  return path.join(resolveDocsStorageDir(), "uploads")
}

export async function ensureDocumentsStorage() {
  await fs.mkdir(/*turbopackIgnore: true*/ resolveDocsUploadsDir(), {
    recursive: true
  })
}

export function normalizeDocumentKind(value) {
  const normalized = String(value || "").trim().toUpperCase()
  return DOCUMENT_KIND_VALUES.includes(normalized) ? normalized : "MATERIAL"
}

export function normalizeTemplateFor(value, kind = "MATERIAL") {
  if (normalizeDocumentKind(kind) !== "TEMPLATE") return null
  const normalized = String(value || "").trim().toUpperCase()
  return TEMPLATE_FOR_VALUES.includes(normalized) ? normalized : null
}

export function sanitizeTextFilename(value, fallback = "document") {
  const withoutSeparators = String(value || "")
    .replace(/[/\\?%*:|"<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return withoutSeparators || fallback
}

export function getFileExtension(fileName) {
  const ext = path.extname(String(fileName || "").trim()).toLowerCase()
  return ext && ext.length <= 10 ? ext : ""
}

export function inferMimeFromFileName(fileName) {
  const extension = getFileExtension(fileName)
  for (const [mime, extensions] of Object.entries(ALLOWED_DOCUMENT_TYPES)) {
    if (extensions.includes(extension)) return mime
  }
  return ""
}

export function resolveAllowedMimeType(file) {
  const fileMime = String(file?.type || "").trim().toLowerCase()
  const inferredMime = inferMimeFromFileName(file?.name || "")
  if (fileMime && ALLOWED_DOCUMENT_TYPES[fileMime]) {
    const allowedExtensions = ALLOWED_DOCUMENT_TYPES[fileMime]
    const ext = getFileExtension(file?.name || "")
    if (!allowedExtensions.length || allowedExtensions.includes(ext)) {
      return fileMime
    }
  }
  if (inferredMime) return inferredMime
  return ""
}

export function ensureAllowedUpload(file) {
  if (!file || typeof file === "string") {
    const error = new Error("documents.errors.file_required")
    error.status = 400
    throw error
  }

  if (Number(file.size || 0) > MAX_DOCUMENT_SIZE_BYTES) {
    const error = new Error("documents.errors.file_too_large")
    error.status = 413
    throw error
  }

  const mime = resolveAllowedMimeType(file)
  if (!mime) {
    const error = new Error("documents.errors.mime_not_allowed")
    error.status = 415
    throw error
  }

  return mime
}

function looksLikePdf(buffer) {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-"
}

function looksLikeZip(buffer) {
  if (buffer.length < 4) return false
  const signature = buffer.subarray(0, 4)
  return (
    signature.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ||
    signature.equals(Buffer.from([0x50, 0x4b, 0x05, 0x06])) ||
    signature.equals(Buffer.from([0x50, 0x4b, 0x07, 0x08]))
  )
}

function looksLikeText(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096))
  for (const byte of sample) {
    if (byte === 0) return false
    if (byte < 9) return false
    if (byte > 13 && byte < 32) return false
  }
  return true
}

export function assertMimeMatchesBuffer(buffer, mime) {
  const ok =
    mime === "application/pdf"
      ? looksLikePdf(buffer)
      : mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ? looksLikeZip(buffer)
        : mime === "text/plain"
          ? looksLikeText(buffer)
          : false

  if (!ok) {
    const error = new Error("documents.errors.file_signature_invalid")
    error.status = 415
    throw error
  }
}

export function normalizeDocumentTitle(title, originalName) {
  const candidate = sanitizeTextFilename(title, "")
  if (candidate) return candidate
  return sanitizeTextFilename(originalName)
}

export function getStoredDocumentPath(originalName) {
  const extension = getFileExtension(originalName)
  const fileName = `${crypto.randomUUID()}${extension}`
  return path.posix.join("uploads", fileName)
}

export function resolveAbsoluteDocumentPath(storagePath) {
  const uploadsDir = resolveDocsUploadsDir()
  const normalized = path.normalize(String(storagePath || ""))
  const storageRoot = path.resolve(/*turbopackIgnore: true*/ resolveDocsStorageDir())
  const absolute = path.resolve(/*turbopackIgnore: true*/ storageRoot, normalized)
  const uploadsRoot = path.resolve(/*turbopackIgnore: true*/ uploadsDir)
  if (absolute !== uploadsRoot && !absolute.startsWith(`${uploadsRoot}${path.sep}`)) {
    throw new Error("documents.errors.storage_path_invalid")
  }
  return absolute
}

export async function writeUploadedFile(file, storagePath, mime) {
  const absolutePath = resolveAbsoluteDocumentPath(storagePath)
  const buffer = Buffer.from(await file.arrayBuffer())
  assertMimeMatchesBuffer(buffer, mime)
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex")
  await fs.writeFile(/*turbopackIgnore: true*/ absolutePath, buffer)
  return {
    size: buffer.byteLength,
    sha256
  }
}

export async function writeStoredBuffer(buffer, storagePath) {
  const absolutePath = resolveAbsoluteDocumentPath(storagePath)
  const nextBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || [])
  const sha256 = crypto.createHash("sha256").update(nextBuffer).digest("hex")
  await fs.writeFile(/*turbopackIgnore: true*/ absolutePath, nextBuffer)
  return {
    size: nextBuffer.byteLength,
    sha256
  }
}

export async function writeStoredTextDocument(content, storagePath) {
  return writeStoredBuffer(Buffer.from(String(content || ""), "utf8"), storagePath)
}

export async function deleteStoredDocument(storagePath) {
  const absolutePath = resolveAbsoluteDocumentPath(storagePath)
  try {
    await fs.unlink(/*turbopackIgnore: true*/ absolutePath)
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error
    }
  }
}

export async function statStoredDocument(storagePath) {
  const absolutePath = resolveAbsoluteDocumentPath(storagePath)
  return fs.stat(/*turbopackIgnore: true*/ absolutePath)
}

export async function readStoredDocument(storagePath) {
  const absolutePath = resolveAbsoluteDocumentPath(storagePath)
  return fs.readFile(/*turbopackIgnore: true*/ absolutePath)
}

export function buildDownloadHeaders(fileName, mime) {
  const safeName = sanitizeTextFilename(fileName)
  const asciiName = toAsciiDownloadFileName(safeName)
  const encodedName = encodeURIComponent(safeName)
  return {
    ...NO_STORE_HEADERS,
    "Content-Type": mime || "application/octet-stream",
    "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`
  }
}

export function makeSnippet(content, maxLength = 180) {
  const normalized = String(content || "").replace(/\s+/g, " ").trim()
  if (!normalized) return ""
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trim()}...`
}
