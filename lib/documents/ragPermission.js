import { prisma } from "@/lib/prisma"
import { buildAgentRagDocumentId } from "@/lib/documents/ragIdentity"
import { writeDataAudit } from "@/lib/privacy/audit"
import { safeError } from "@/lib/privacy/safeError"

export const DOCUMENT_RAG_RESOURCE_TYPE = "UserDocument"
export const DOCUMENT_RAG_ACTION = "RAG_DELETE"

function permissionError(message, status = 409) {
  const error = new Error(message)
  error.status = status
  return error
}

function removalMetadata({ status, jobId, externalRef, reason, now = new Date() }) {
  return {
    status,
    jobId: jobId || null,
    externalRef,
    reason: String(reason || "").slice(0, 120),
    checkedAt: now.toISOString()
  }
}

export async function queueDocumentRagRemovalWithin(
  db,
  { document, actorUserId, targetUserId, now = new Date() }
) {
  const externalRef = buildAgentRagDocumentId(document)
  const existing = await db.dataDeletionJob.findFirst({
    where: {
      action: DOCUMENT_RAG_ACTION,
      resourceType: DOCUMENT_RAG_RESOURCE_TYPE,
      resourceId: document.id,
      externalRef,
      status: { in: ["pending", "failed"] }
    },
    select: { id: true, status: true }
  })
  const job = existing || await db.dataDeletionJob.create({
    data: {
      actorUserId,
      targetUserId,
      action: DOCUMENT_RAG_ACTION,
      resourceType: DOCUMENT_RAG_RESOURCE_TYPE,
      resourceId: document.id,
      externalRef,
      status: "pending",
      nextAttemptAt: now,
      maxAttempts: 8
    },
    select: { id: true, status: true }
  })
  await writeDataAudit({
    db,
    actorUserId,
    targetUserId,
    action: "RAG_DELETE_REQUESTED",
    resourceType: DOCUMENT_RAG_RESOURCE_TYPE,
    resourceId: document.id,
    meta: { externalRef, jobId: job.id }
  })
  return { ...job, externalRef }
}

/**
 * Ehitab CAS-tehingu eelsammu. Keelamisel sünnivad töö, audit ja `pending`
 * seis samas tehingus; lubamisel blokeerib iga lõpetamata vana kustutus.
 */
export function prepareDocumentRagPermissionChange({
  document,
  nextAgentAllowed,
  metadata,
  actorUserId,
  targetUserId,
  now = new Date()
}) {
  const wasAllowed = Boolean(document?.agentAllowed)
  const willBeAllowed = Boolean(nextAgentAllowed)
  if (wasAllowed === willBeAllowed) return { removalRequested: false, prepareWithin: null }

  if (willBeAllowed) {
    return {
      removalRequested: false,
      prepareWithin: async (tx) => {
        const unresolved = await tx.dataDeletionJob.findFirst({
          where: {
            action: DOCUMENT_RAG_ACTION,
            resourceType: DOCUMENT_RAG_RESOURCE_TYPE,
            resourceId: document.id,
            status: { in: ["pending", "failed"] }
          },
          select: { id: true }
        })
        if (unresolved) throw permissionError("documents.errors.rag_removal_pending")
        return null
      }
    }
  }

  return {
    removalRequested: true,
    prepareWithin: async (tx) => {
      const job = await queueDocumentRagRemovalWithin(tx, {
        document,
        actorUserId,
        targetUserId,
        now
      })
      return {
        data: {
          metadata: {
            ...(metadata && typeof metadata === "object" ? metadata : {}),
            ragRemoval: removalMetadata({
              status: "pending",
              jobId: job.id,
              externalRef: job.externalRef,
              reason: "permission_revoked",
              now
            })
          }
        }
      }
    }
  }
}

/** Kaugkatse järel liiguvad töö ja dokumendi taastatav seis koos. */
export async function attemptDocumentRagRemoval(
  { document, actorUserId, targetUserId },
  { db = prisma, deleteIndex, now = new Date() } = {}
) {
  const state = document?.metadata?.ragRemoval
  if (!state?.jobId || !state?.externalRef) {
    throw permissionError("documents.errors.rag_removal_state_missing", 500)
  }

  let result
  try {
    result = typeof deleteIndex === "function"
      ? await deleteIndex(document, {
          route: "documents/permission",
          stage: "rag_delete",
          userId: targetUserId
        })
      : { ok: false, reason: "rag_delete_not_configured" }
  } catch (error) {
    result = { ok: false, error, reason: "rag_delete_threw" }
  }
  const done = Boolean(result?.ok)
  const reason = done
    ? (result?.missing ? "already_absent" : "deleted")
    : String(result?.reason || safeError(result?.error).message || "rag_delete_failed")

  return db.$transaction(async (tx) => {
    await tx.dataDeletionJob.update({
      where: { id: state.jobId },
      data: {
        status: done ? "done" : "failed",
        attempts: { increment: 1 },
        lastError: done ? null : reason,
        lastErrorCode: done ? null : reason.slice(0, 120),
        nextAttemptAt: done ? null : now
      }
    })
    const current = await tx.userDocument.findFirst({
      where: { id: document.id, ownerId: targetUserId },
      select: { id: true, metadata: true, agentAllowed: true }
    })
    if (current && !current.agentAllowed) {
      await tx.userDocument.update({
        where: { id: current.id },
        data: {
          metadata: {
            ...(current.metadata && typeof current.metadata === "object" ? current.metadata : {}),
            ragRemoval: removalMetadata({
              status: done ? "done" : "failed",
              jobId: state.jobId,
              externalRef: state.externalRef,
              reason,
              now
            })
          }
        }
      })
    }
    await writeDataAudit({
      db: tx,
      actorUserId,
      targetUserId,
      action: done ? "RAG_DELETE" : "RAG_DELETE_PENDING",
      resourceType: DOCUMENT_RAG_RESOURCE_TYPE,
      resourceId: document.id,
      meta: { externalRef: state.externalRef, jobId: state.jobId, reason }
    })
    return tx.userDocument.findFirst({ where: { id: document.id, ownerId: targetUserId } })
  })
}

/** Defense in depth: lõpetamata delete'i peale ei tohi sama dokumenti ingestida. */
export async function assertDocumentRagIngestReady(document, { db = prisma } = {}) {
  if (!document?.agentAllowed) throw permissionError("documents.artifacts.errors.source_not_allowed", 400)
  const unresolved = await db.dataDeletionJob.findFirst({
    where: {
      action: DOCUMENT_RAG_ACTION,
      resourceType: DOCUMENT_RAG_RESOURCE_TYPE,
      resourceId: document.id,
      status: { in: ["pending", "failed"] }
    },
    select: { id: true }
  })
  if (unresolved) throw permissionError("documents.errors.rag_removal_pending")
  return true
}
