import { createArtifactError } from "@/lib/documents/artifacts"
import { safeError } from "@/lib/privacy/safeError"
import { RAG_SERVICE_KEY } from "@/lib/server/ragAuth"

const RAW_RAG_HOST = (process.env.RAG_INTERNAL_HOST || process.env.RAG_API_BASE || "127.0.0.1:8000").trim()
function readPositiveNumber(value, fallback) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback
  return numeric
}

const RAG_TIMEOUT_MS = readPositiveNumber(process.env.RAG_TIMEOUT_MS, 30_000)
const ALLOW_EXTERNAL = process.env.ALLOW_EXTERNAL_RAG === "1"
const LOCAL_HOST_RE = /^(127\.0\.0\.1|localhost|\[?::1\]?)(:\d+)?$/i
export const RAG_OBSERVABILITY_ROUTE_HEADER = "X-Observability-Route"
export const RAG_OBSERVABILITY_STAGE_HEADER = "X-Observability-Stage"
export const RAG_OBSERVABILITY_USER_ID_HEADER = "X-Observability-User-Id"
export const RAG_OBSERVABILITY_ROLE_HEADER = "X-Observability-Role"
export const RAG_OBSERVABILITY_CONVERSATION_ID_HEADER = "X-Observability-Conversation-Id"
export const RAG_OBSERVABILITY_ARTIFACT_ID_HEADER = "X-Observability-Artifact-Id"
export const RAG_OBSERVABILITY_RESEARCH_JOB_ID_HEADER = "X-Observability-Research-Job-Id"

export function normalizeBaseFromHost(host) {
  const trimmed = String(host || "").trim().replace(/\/+$/, "")
  if (!trimmed) return "http://127.0.0.1:8000"
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `http://${trimmed}`
}

export function getRagBaseUrl() {
  return normalizeBaseFromHost(RAW_RAG_HOST)
}

function isLocalBaseUrl(url) {
  try {
    const parsed = new URL(url)
    return LOCAL_HOST_RE.test(parsed.host)
  } catch {
    return false
  }
}

function assertRagAvailable(messageKey = "documents.artifacts.errors.analysis_unavailable") {
  if (!RAG_SERVICE_KEY) {
    throw createArtifactError(messageKey, 503)
  }

  const base = getRagBaseUrl()
  if (!ALLOW_EXTERNAL && !isLocalBaseUrl(base)) {
    throw createArtifactError(messageKey, 503)
  }

  return base
}

export function buildRagHeaders(contentType = "application/json", observability = null) {
  const headers = new Headers()
  headers.set("X-API-Key", RAG_SERVICE_KEY)
  if (contentType) {
    headers.set("Content-Type", contentType)
  }
  const route = String(observability?.route || "").trim()
  const stage = String(observability?.stage || "").trim()
  if (route) {
    headers.set(RAG_OBSERVABILITY_ROUTE_HEADER, route)
  }
  if (stage) {
    headers.set(RAG_OBSERVABILITY_STAGE_HEADER, stage)
  }
  const userId = String(observability?.userId || "").trim()
  const role = String(observability?.role || "").trim()
  const conversationId = String(observability?.conversationId || "").trim()
  const artifactId = String(observability?.artifactId || "").trim()
  const researchJobId = String(observability?.researchJobId || "").trim()
  if (userId) {
    headers.set(RAG_OBSERVABILITY_USER_ID_HEADER, userId)
  }
  if (role) {
    headers.set(RAG_OBSERVABILITY_ROLE_HEADER, role)
  }
  if (conversationId) {
    headers.set(RAG_OBSERVABILITY_CONVERSATION_ID_HEADER, conversationId)
  }
  if (artifactId) {
    headers.set(RAG_OBSERVABILITY_ARTIFACT_ID_HEADER, artifactId)
  }
  if (researchJobId) {
    headers.set(RAG_OBSERVABILITY_RESEARCH_JOB_ID_HEADER, researchJobId)
  }
  return headers
}

export async function ragServiceRequest(path, options = {}, messageKey = "documents.artifacts.errors.analysis_failed") {
  const base = assertRagAvailable(messageKey)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RAG_TIMEOUT_MS)

  try {
    const response = await fetch(`${base}${path}`, {
      cache: "no-store",
      ...options,
      signal: controller.signal
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      const status = response.status || 502
      const key = payload?.messageKey || messageKey
      const error = createArtifactError(key, status)
      error.payload = payload
      throw error
    }

    return payload
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = createArtifactError(messageKey, 504)
      timeoutError.cause = error
      throw timeoutError
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export async function deleteRagDocument(docId, observability = null) {
  const normalizedDocId = String(docId || "").trim()
  if (!normalizedDocId) {
    return { ok: false, skipped: true, reason: "missing_doc_id" }
  }

  try {
    const payload = await ragServiceRequest(
      `/documents/${encodeURIComponent(normalizedDocId)}`,
      {
        method: "DELETE",
        headers: buildRagHeaders("application/json", observability)
      },
      "documents.artifacts.errors.analysis_failed"
    )
    return { ok: true, payload }
  } catch (error) {
    try {
      console.error("[rag-service] delete failed", {
        docId: normalizedDocId,
        error: safeError(error)
      })
    } catch {}
    return { ok: false, error }
  }
}
