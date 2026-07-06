import crypto from "node:crypto"

function readPositiveNumber(value, fallback) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback
  return numeric
}

const CACHE_TTL_MS = readPositiveNumber(process.env.AGENT_RETRIEVAL_DEBUG_TTL_MS, 2 * 60 * 60 * 1000)
const CACHE_MAX_ENTRIES = Math.max(
  1,
  Math.trunc(readPositiveNumber(process.env.AGENT_RETRIEVAL_DEBUG_MAX_ENTRIES, 500))
)

const retrievalCounters = {
  total_agent_requests: 0,
  retrieval_success_count: 0,
  retrieval_fallback_count: 0
}

const contentDebugMetaCache = new Map()

function nowMs() {
  return Date.now()
}

function cleanupDebugMetaCache() {
  const cutoff = nowMs() - CACHE_TTL_MS
  for (const [key, entry] of contentDebugMetaCache.entries()) {
    if (!entry || entry.createdAt < cutoff) {
      contentDebugMetaCache.delete(key)
    }
  }

  if (contentDebugMetaCache.size <= CACHE_MAX_ENTRIES) return

  const ordered = [...contentDebugMetaCache.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)
  for (const [key] of ordered.slice(0, Math.max(0, ordered.length - CACHE_MAX_ENTRIES))) {
    contentDebugMetaCache.delete(key)
  }
}

function buildCacheKey(userId, content) {
  const uid = String(userId || "").trim()
  const hash = crypto.createHash("sha256").update(String(content || ""), "utf8").digest("hex")
  return `${uid}:${hash}`
}

export function classifyRetrievalFailure(error, fallback = "rag_search_failed") {
  const explicit = String(error?.retrievalReason || "").trim()
  if (explicit) return explicit

  const status = Number(error?.status) || 0
  const message = String(error?.message || "").toLowerCase()
  const payloadText = JSON.stringify(error?.payload || {}).toLowerCase()
  const combined = `${message} ${payloadText}`.trim()

  if (error?.name === "AbortError" || combined.includes("abort")) {
    return "rag_timeout"
  }
  if (status === 408 || status === 504 || combined.includes("timeout")) {
    return "rag_timeout"
  }
  if (combined.includes("/ingest/text") || combined.includes("doc_id is required") || combined.includes("text is required")) {
    return "rag_ingest_failed"
  }

  return fallback
}

export function createRetrievalDebugMeta({
  retrievalMode,
  chunksUsed,
  documentsIndexed,
  tokenBudget,
  fallbackReason = null
}) {
  return {
    retrieval_mode: retrievalMode,
    chunks_used: Number(chunksUsed) || 0,
    documents_indexed: Number(documentsIndexed) || 0,
    token_budget: Number(tokenBudget) || 0,
    fallback_reason: fallbackReason || null
  }
}

export function recordRetrievalExecution(debugMeta) {
  retrievalCounters.total_agent_requests += 1
  if (debugMeta?.retrieval_mode === "rag") {
    retrievalCounters.retrieval_success_count += 1
  } else {
    retrievalCounters.retrieval_fallback_count += 1
  }
}

export function logAgentRetrieval(debugMeta) {
  if (!debugMeta) return

  if (debugMeta.retrieval_mode === "rag") {
    console.info(
      `AGENT_RETRIEVAL mode=rag documents=${debugMeta.documents_indexed} chunks=${debugMeta.chunks_used} token_budget=${debugMeta.token_budget}`
    )
    return
  }

  console.info(
    `AGENT_RETRIEVAL mode=fallback_source_material reason=${debugMeta.fallback_reason || "unknown"} documents=${debugMeta.documents_indexed} chunks=${debugMeta.chunks_used} token_budget=${debugMeta.token_budget}`
  )
}

export function logAgentRetrievalChunks(chunks) {
  if (process.env.NODE_ENV === "production") return
  if (!Array.isArray(chunks) || !chunks.length) return

  const grouped = new Map()
  for (const chunk of chunks) {
    const docId = String(chunk?.docId || "unknown")
    const entry = grouped.get(docId) || { chunkIds: [], scores: [] }
    entry.chunkIds.push(Number.isFinite(chunk?.chunkIndex) ? chunk.chunkIndex : chunk?.chunkId || null)
    const distance = Number.isFinite(Number(chunk?.distance)) ? Number(chunk.distance) : null
    const score = distance == null
      ? null
      : distance >= 0 && distance <= 1
        ? Number((1 - distance).toFixed(4))
        : Number((1 / (1 + distance)).toFixed(4))
    entry.scores.push(score)
    grouped.set(docId, entry)
  }

  for (const [docId, entry] of grouped.entries()) {
    console.info(
      `AGENT_RETRIEVAL_CHUNKS doc_id=${docId} chunk_ids=${JSON.stringify(entry.chunkIds)} scores=${JSON.stringify(entry.scores)}`
    )
  }
}

export function cacheRetrievalDebugMeta(userId, content, debugMeta) {
  const uid = String(userId || "").trim()
  const normalizedContent = String(content || "")
  if (!uid || !normalizedContent || !debugMeta) return

  cleanupDebugMetaCache()
  contentDebugMetaCache.set(buildCacheKey(uid, normalizedContent), {
    debugMeta,
    createdAt: nowMs()
  })
}

export function getCachedRetrievalDebugMeta(userId, content) {
  const uid = String(userId || "").trim()
  const normalizedContent = String(content || "")
  if (!uid || !normalizedContent) return null

  cleanupDebugMetaCache()
  const entry = contentDebugMetaCache.get(buildCacheKey(uid, normalizedContent))
  return entry?.debugMeta || null
}

export function getRetrievalStats() {
  const totalRequests = retrievalCounters.total_agent_requests
  const fallbackCount = retrievalCounters.retrieval_fallback_count

  return {
    total_requests: totalRequests,
    retrieval_success: retrievalCounters.retrieval_success_count,
    fallback_count: fallbackCount,
    fallback_rate: totalRequests > 0 ? fallbackCount / totalRequests : 0
  }
}
