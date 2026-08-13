import crypto from "node:crypto"

export const MATERIAL_SANITIZATION_VERSION = "materials-one-way-text-v1"
export const MATERIAL_SANITIZED_MIME = "text/plain; charset=utf-8"

const TEXT_MIME = "text/plain"
const CDR_REQUIRED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
])
const MAX_SANITIZED_BYTES = 16 * 1024 * 1024
const FORBIDDEN_UNICODE = /[\u007f-\u009f\u202a-\u202e\u2066-\u2069\ufeff]/gu

function sanitizationError(code, status = 503) {
  const error = new Error(code)
  error.code = code
  error.status = status
  return error
}

function normalizeExtractedText(bufferLike) {
  const buffer = Buffer.isBuffer(bufferLike) ? bufferLike : Buffer.from(bufferLike || [])
  if (!buffer.length || buffer.length > MAX_SANITIZED_BYTES) {
    throw sanitizationError("material_sanitized_derivative_invalid", 422)
  }
  let value
  try {
    value = new TextDecoder("utf-8", { fatal: true }).decode(buffer)
  } catch {
    throw sanitizationError("material_sanitized_derivative_invalid", 422)
  }
  const safeCharacters = Array.from(value
    .normalize("NFC")
    .replace(/\r\n?/gu, "\n")
    .replace(FORBIDDEN_UNICODE, ""))
    .filter(character => {
      const code = character.codePointAt(0)
      return code === 9 || code === 10 || code >= 32
    })
    .join("")
  const normalized = safeCharacters
    .trim()
  if (!normalized) throw sanitizationError("material_sanitized_derivative_empty", 422)
  return Buffer.from(`${normalized}\n`, "utf8")
}

export function createMaterialSanitizer({ cdr = null } = {}) {
  return {
    async sanitize({ buffer, mime, originalName } = {}) {
      let derivative
      if (mime === TEXT_MIME) {
        derivative = normalizeExtractedText(buffer)
      } else if (CDR_REQUIRED_MIMES.has(mime)) {
        if (typeof cdr?.extractSanitizedText !== "function") {
          throw sanitizationError("material_cdr_unavailable")
        }
        derivative = normalizeExtractedText(await cdr.extractSanitizedText({
          buffer: Buffer.from(buffer || []),
          mime,
          originalName: String(originalName || "material")
        }))
      } else {
        throw sanitizationError("material_cdr_mime_not_supported", 415)
      }
      return {
        buffer: derivative,
        mime: MATERIAL_SANITIZED_MIME,
        sha256: crypto.createHash("sha256").update(derivative).digest("hex"),
        version: MATERIAL_SANITIZATION_VERSION
      }
    }
  }
}

export const defaultMaterialSanitizer = createMaterialSanitizer()
