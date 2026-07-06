const MAX_AUDIT_STRING_LENGTH = 500
const MAX_AUDIT_ARRAY_LENGTH = 25
const MAX_AUDIT_DEPTH = 4

const AUDIT_EVENT_TO_ACTION = {
  "document.uploaded": "UPLOAD",
  "document.upload_failed": "UPLOAD",
  "document.updated": "UPDATE",
  "document.deleted": "DELETE",
  "document.downloaded": "DOWNLOAD",
  "document.audio_selected": "UPDATE",
  "document.audio_uploaded": "UPLOAD",
  "document.transcription_started": "UPDATE",
  "document.transcription_completed": "UPDATE",
  "document.transcription_reused": "UPDATE",
  "document.transcription_failed": "UPDATE",
  "document.transcript_updated": "UPDATE",
  "document.transcript_used_for_draft": "ARTIFACT_CREATE",
  "document.transcript_summary_started": "ARTIFACT_CREATE",
  "document.transcript_summary_completed": "ARTIFACT_CREATE",
  "document.transcript_summary_failed": "ARTIFACT_CREATE",
  "artifact.created": "ARTIFACT_CREATE",
  "artifact.updated": "ARTIFACT_UPDATE",
  "artifact.refined": "ARTIFACT_REFINE",
  "artifact.deleted": "ARTIFACT_DELETE",
  "artifact.approved": "ARTIFACT_APPROVE",
  "artifact.approve_redundant": "ARTIFACT_APPROVE",
  "artifact.downloaded": "ARTIFACT_DOWNLOAD"
}

function sanitizeAuditString(value) {
  const normalized = String(value ?? "")
  if (normalized.length <= MAX_AUDIT_STRING_LENGTH) return normalized
  return `${normalized.slice(0, MAX_AUDIT_STRING_LENGTH - 1)}...`
}

function sanitizeAuditValue(value, depth = 0) {
  if (value == null) return value
  if (depth >= MAX_AUDIT_DEPTH) return "[truncated]"

  if (typeof value === "string") {
    return sanitizeAuditString(value)
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_AUDIT_ARRAY_LENGTH).map((item) => sanitizeAuditValue(item, depth + 1))
  }

  if (typeof value === "object") {
    const output = {}
    for (const [key, current] of Object.entries(value)) {
      if (key === "storagePath" || key === "absolutePath" || key === "filePath") continue
      output[key] = sanitizeAuditValue(current, depth + 1)
    }
    return output
  }

  return sanitizeAuditString(value)
}

function mapAuditEventToAction(event) {
  return AUDIT_EVENT_TO_ACTION[String(event || "").trim()] || null
}

export function buildDocumentAuditRecord(event, payload = {}) {
  const action = mapAuditEventToAction(event)
  if (!action) return null

  const ownerId = String(payload.userId || payload.ownerId || "").trim()
  if (!ownerId) return null

  const documentId = String(payload.documentId || "").trim() || null
  const artifactId = String(payload.artifactId || "").trim() || null
  const {
    userId: _userId,
    ownerId: _ownerId,
    documentId: _documentId,
    artifactId: _artifactId,
    ...meta
  } = payload || {}

  return {
    ownerId,
    documentId,
    artifactId,
    action,
    meta: {
      event: String(event),
      ...sanitizeAuditValue(meta)
    }
  }
}
