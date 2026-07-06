import { buildAgentRagDocumentId, deleteDocumentIndex } from "@/lib/documents/embeddings"
import { logDataAudit } from "@/lib/privacy/audit"
import { createDataDeletionJob, DELETION_STATUS, markDataDeletionJob } from "@/lib/privacy/deletionJobs"
import { safeError } from "@/lib/privacy/safeError"

function shouldDeleteRagOnDocumentDelete() {
  return ["1", "true", "yes", "on"].includes(
    String(process.env.RAG_DELETE_ON_DOCUMENT_DELETE || "").trim().toLowerCase()
  )
}

function getDocumentRagExternalRef(document) {
  if (!document?.id || !document?.sha256) return null
  return buildAgentRagDocumentId(document)
}

export async function deleteDocumentRagReference({
  document,
  actorUserId,
  targetUserId,
  ipAddress = null,
  userAgent = null,
  action = "RAG_DELETE",
  auditResourceType = "UserDocument"
} = {}) {
  const externalRef = getDocumentRagExternalRef(document)
  if (!externalRef) {
    await createDataDeletionJob({
      actorUserId,
      targetUserId,
      action,
      resourceType: auditResourceType,
      resourceId: document?.id || null,
      externalRef: null,
      status: DELETION_STATUS.SKIPPED,
      lastError: "missing_rag_external_ref"
    })
    return { ok: true, skipped: true }
  }

  if (!shouldDeleteRagOnDocumentDelete()) {
    await createDataDeletionJob({
      actorUserId,
      targetUserId,
      action,
      resourceType: auditResourceType,
      resourceId: document.id,
      externalRef,
      status: DELETION_STATUS.SKIPPED,
      lastError: "RAG_DELETE_ON_DOCUMENT_DELETE is not enabled"
    })
    await logDataAudit({
      actorUserId,
      targetUserId,
      action: "RAG_DELETE_SKIPPED",
      resourceType: auditResourceType,
      resourceId: document.id,
      ipAddress,
      userAgent,
      meta: { externalRef, reason: "disabled_by_env" }
    })
    return { ok: true, skipped: true, externalRef }
  }

  const job = await createDataDeletionJob({
    actorUserId,
    targetUserId,
    action,
    resourceType: auditResourceType,
    resourceId: document.id,
    externalRef,
    status: DELETION_STATUS.PENDING
  })

  const result = await deleteDocumentIndex(document, {
    route: "privacy/document-delete",
    stage: action.toLowerCase(),
    userId: targetUserId
  })

  if (result.ok) {
    await markDataDeletionJob(job, {
      status: DELETION_STATUS.DONE,
      incrementAttempts: true
    })
    await logDataAudit({
      actorUserId,
      targetUserId,
      action: "RAG_DELETE",
      resourceType: auditResourceType,
      resourceId: document.id,
      ipAddress,
      userAgent,
      meta: { externalRef }
    })
    return { ok: true, externalRef }
  }

  await markDataDeletionJob(job, {
    status: DELETION_STATUS.FAILED,
    incrementAttempts: true,
    lastError: safeError(result.error).message
  })
  await logDataAudit({
    actorUserId,
    targetUserId,
    action: "RAG_DELETE_PENDING",
    resourceType: auditResourceType,
    resourceId: document.id,
    ipAddress,
    userAgent,
    meta: { externalRef, error: safeError(result.error) }
  })
  return { ok: false, pending: true, externalRef, error: result.error }
}
