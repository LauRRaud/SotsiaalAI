import { buildAgentRagDocumentId, deleteDocumentIndex } from "@/lib/documents/embeddings"
import { logDataAudit } from "@/lib/privacy/audit"
import { createDataDeletionJob, DELETION_STATUS, markDataDeletionJob } from "@/lib/privacy/deletionJobs"
import { isRagRetiredFailure } from "@/lib/privacy/ragDeletionResult"
import { safeError } from "@/lib/privacy/safeError"

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
  /* Väljalülitatud indeksist ei saa midagi eemaldada. Kohustus jääb kirja (töö ülal,
     koos indeksi viitega), aga see ei ole takistus ülejäänud kustutamisele:
     vt `ragDeletionResult.js`. */
  return { ok: false, pending: true, retired: isRagRetiredFailure(result), externalRef, error: result.error }
}
