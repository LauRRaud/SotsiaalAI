const SENSITIVE_KEY_RE = /^(authorization|cookie|password|token|accessToken|refreshToken|apiKey|secret|raw|body|payload|audioBuffer|file|content|text|messageContent)$/i
const MAX_STRING_LENGTH = 220
const MAX_STACK_LINES = 4
const MAX_DEPTH = 4
const MAX_ARRAY_ITEMS = 12
const MAX_OBJECT_KEYS = 30

function clip(value, max = MAX_STRING_LENGTH) {
  const text = String(value ?? "")
    .replace(/\bsk-[A-Za-z0-9_*.-]{8,}\b/g, "[redacted-api-key]")
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(0, max - 3))}...`
}

function isSensitiveKey(key) {
  return SENSITIVE_KEY_RE.test(String(key || ""))
}

function redactValue(value, depth, seen) {
  if (value == null) return value
  if (typeof value === "string") return clip(value)
  if (typeof value === "number" || typeof value === "boolean") return value
  if (typeof value === "bigint") return String(value)
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) return safeError(value)
  if (typeof Buffer !== "undefined" && Buffer.isBuffer?.(value)) {
    return `[buffer:${value.length}]`
  }
  if (typeof File !== "undefined" && value instanceof File) {
    return {
      name: clip(value.name, 120),
      type: value.type || null,
      size: value.size || 0
    }
  }
  if (depth >= MAX_DEPTH) return "[redacted:depth]"
  if (typeof value !== "object") return clip(value)
  if (seen.has(value)) return "[redacted:circular]"
  seen.add(value)

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map(item => redactValue(item, depth + 1, seen))
  }

  const out = {}
  for (const [key, entry] of Object.entries(value).slice(0, MAX_OBJECT_KEYS)) {
    out[key] = isSensitiveKey(key) ? "[redacted]" : redactValue(entry, depth + 1, seen)
  }
  return out
}

export function redactObject(value) {
  return redactValue(value, 0, new WeakSet())
}

function stackFingerprint(stack = "") {
  const lines = String(stack || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, MAX_STACK_LINES)
  return lines.length ? lines.join(" | ") : undefined
}

export function safeError(error, options = {}) {
  const correlationId =
    options.correlationId ||
    error?.correlationId ||
    error?.requestId ||
    error?.response?.headers?.get?.("x-request-id") ||
    null

  return {
    name: clip(error?.name || "Error", 80),
    message: clip(error?.message || String(error || "unknown error")),
    code: error?.code == null ? undefined : clip(error.code, 80),
    status: error?.status || error?.statusCode || error?.response?.status || undefined,
    fingerprint: stackFingerprint(error?.stack),
    correlationId: correlationId ? clip(correlationId, 120) : undefined,
    ...(options.includeCause && error?.cause ? { cause: safeError(error.cause) } : {})
  }
}

export function safeLogPayload(payload = {}) {
  return redactObject(payload)
}
