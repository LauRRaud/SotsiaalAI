import { AGENT_ARTIFACT_STATUS_VALUES, AGENT_ARTIFACT_TYPE_VALUES } from "./constants.js"

export function parseListLimit(value, { fallback, maxLimit }) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(Math.floor(parsed), maxLimit)
}

export function parseListOffset(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.floor(parsed)
}

export function buildPaginationMeta({ total, limit, offset }) {
  const safeTotal = Number.isFinite(Number(total)) ? Math.max(0, Math.floor(Number(total))) : 0
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.floor(Number(limit))) : 1
  const safeOffset = parseListOffset(offset)
  const hasPrevious = safeOffset > 0
  const hasNext = safeOffset + safeLimit < safeTotal

  return {
    total: safeTotal,
    limit: safeLimit,
    offset: safeOffset,
    hasPrevious,
    hasNext,
    previousOffset: hasPrevious ? Math.max(0, safeOffset - safeLimit) : 0,
    nextOffset: hasNext ? safeOffset + safeLimit : safeOffset
  }
}

export function normalizeArtifactStatusFilter(value) {
  const normalized = String(value || "").trim().toUpperCase()
  return AGENT_ARTIFACT_STATUS_VALUES.includes(normalized) ? normalized : null
}

export function normalizeArtifactListSort(value) {
  const normalized = String(value || "").trim().toLowerCase()
  return ["updated_desc", "updated_asc", "approved_desc", "title_asc"].includes(normalized)
    ? normalized
    : "updated_desc"
}

export function buildArtifactOrderBy(sort) {
  if (sort === "updated_asc") return [{ updatedAt: "asc" }]
  if (sort === "approved_desc") return [{ approvedAt: "desc" }, { updatedAt: "desc" }]
  if (sort === "title_asc") return [{ title: "asc" }, { updatedAt: "desc" }]
  return [{ updatedAt: "desc" }]
}

export function buildArtifactSearchWhere(search) {
  const normalized = String(search || "").trim()
  if (!normalized) return null

  const upperSearch = normalized.toUpperCase().replace(/\s+/g, "_")
  const typeMatch = AGENT_ARTIFACT_TYPE_VALUES.includes(upperSearch) ? [{ type: upperSearch }] : []

  return {
    OR: [
      { title: { contains: normalized, mode: "insensitive" } },
      { content: { contains: normalized, mode: "insensitive" } },
      ...typeMatch,
      {
        sourceDocuments: {
          some: {
            document: {
              OR: [
                { title: { contains: normalized, mode: "insensitive" } },
                { originalName: { contains: normalized, mode: "insensitive" } }
              ]
            }
          }
        }
      }
    ]
  }
}
