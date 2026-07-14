import { deleteStoredDocument } from "@/lib/documents/server"
import { deleteStoredMaterial } from "@/lib/materials/server"
import { prisma } from "@/lib/prisma"
import { logDataAudit } from "@/lib/privacy/audit"
import { deleteDocumentRagReference } from "@/lib/privacy/documentDeletion"
import { createDataDeletionJob, DELETION_STATUS } from "@/lib/privacy/deletionJobs"
import { deleteTrackedStorageFile } from "@/lib/privacy/fileDeletion"
import { safeError } from "@/lib/privacy/safeError"
import { runUserDeletionCleanup } from "@/lib/privacy/userDeletionOrchestrator"
import {
  deleteUserAfterFinalPracticeSweep as deleteUserAfterFinalPracticeSweepPure,
  scrubOrDeleteEffectivePractices as scrubOrDeleteEffectivePracticesPure
} from "@/lib/privacy/effectivePracticeAccountCleanup"

async function collectUserPrivacyDeletionTargets(targetUserId) {
  const userId = String(targetUserId || "").trim()
  if (!userId) return { documents: [], materialSubmissions: [], artifacts: [] }

  const [documents, materialSubmissions, artifacts] = await Promise.all([
    prisma.userDocument.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        ownerId: true,
        title: true,
        originalName: true,
        kind: true,
        mime: true,
        size: true,
        sha256: true,
        storagePath: true,
        updatedAt: true
      }
    }),
    prisma.materialSubmission.findMany({
      where: { submittedByUserId: userId },
      select: {
        id: true,
        submittedByUserId: true,
        originalName: true,
        mime: true,
        size: true,
        sha256: true,
        storagePath: true
      }
    }),
    prisma.agentArtifact.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        ownerId: true,
        type: true,
        title: true,
        updatedAt: true
      }
    })
  ])

  return { documents, materialSubmissions, artifacts }
}
function summarizeDeletionFailures(failures = []) {
  return failures
    .map(item => `${item.stage}:${item.resourceType || "User"}:${item.resourceId || "unknown"}`)
    .join(", ")
    .slice(0, 1000)
}

async function performUserPrivacyCleanup({
  actorUserId,
  targetUserId,
  ipAddress,
  userAgent
}) {
  const targets = await collectUserPrivacyDeletionTargets(targetUserId)
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { email: true }
  })
  if (!user) {
    return {
      ok: true,
      alreadyDeleted: true,
      counts: { documents: 0, materialSubmissions: 0, artifacts: 0 }
    }
  }
  return runUserDeletionCleanup({
    targets,
    user,
    targetUserId,
    deleteRagReference: document => deleteDocumentRagReference({
      document,
      actorUserId,
      targetUserId,
      ipAddress,
      userAgent,
      action: "RAG_DELETE",
      auditResourceType: "UserDocument"
    }),
    deleteDocumentFile: document => deleteTrackedStorageFile({
      actorUserId,
      targetUserId,
      action: "FILE_DELETE",
      resourceType: "UserDocument",
      resourceId: document.id,
      storagePath: document.storagePath,
      deleteFile: deleteStoredDocument
    }),
    deleteMaterialFile: submission => deleteTrackedStorageFile({
      actorUserId,
      targetUserId,
      action: "FILE_DELETE",
      resourceType: "MaterialSubmission",
      resourceId: submission.id,
      storagePath: submission.storagePath,
      deleteFile: deleteStoredMaterial
    }),
    recordArtifact: artifact => createDataDeletionJob({
      actorUserId,
      targetUserId,
      action: "ARTIFACT_DB_DELETE",
      resourceType: "AgentArtifact",
      resourceId: artifact.id,
      status: DELETION_STATUS.SKIPPED,
      lastError: "database_cascade_only"
    }),
    deleteVerificationTokens: email => prisma.verificationToken.deleteMany({
      where: {
        OR: [
          { identifier: email },
          { identifier: `email-verify:${email}` }
        ]
      }
    }),
    deleteChatLogs: userId => prisma.chatLog.deleteMany({ where: { userId } }),
    deletePrivatePracticeCandidates: userId => scrubOrDeleteEffectivePracticesPure(userId, prisma),
    deleteUser: userId => deleteUserAfterFinalPracticeSweepPure(userId, prisma)
  })
}

export async function retryUserPrivacyDeletion({
  job,
  actorUserId,
  ipAddress = null,
  userAgent = null
} = {}) {
  const targetUserId = String(job?.targetUserId || job?.resourceId || "").trim()
  if (!targetUserId) throw new TypeError("Deletion job target user is required")
  const result = await performUserPrivacyCleanup({
    actorUserId,
    targetUserId,
    ipAddress,
    userAgent
  })
  if (!result.ok) {
    throw result.error || new Error(summarizeDeletionFailures(result.failures) || "user_delete_failed")
  }
  await prisma.dataDeletionJob.updateMany({
    where: {
      targetUserId,
      id: job?.id ? { not: job.id } : undefined,
      action: { in: ["RAG_DELETE", "FILE_DELETE"] },
      status: { in: [DELETION_STATUS.PENDING, DELETION_STATUS.FAILED] }
    },
    data: { status: DELETION_STATUS.DONE, lastError: null }
  })
  await logDataAudit({
    actorUserId,
    targetUserId,
    action: "USER_DELETE_RETRY_DONE",
    resourceType: "User",
    resourceId: targetUserId,
    ipAddress,
    userAgent,
    meta: { deletionJobId: job?.id || null, counts: result.counts }
  })
  return result
}

export async function deleteUserWithPrivacyCleanup({
  actorUserId,
  targetUserId,
  reason = "user_delete",
  ipAddress = null,
  userAgent = null
} = {}) {
  const normalizedTargetUserId = String(targetUserId || "").trim()
  if (!normalizedTargetUserId) {
    const error = new Error("targetUserId is required")
    error.status = 400
    throw error
  }

  const user = await prisma.user.findUnique({
    where: { id: normalizedTargetUserId },
    select: { id: true }
  })
  if (!user) {
    const error = new Error("User was not found")
    error.code = "P2025"
    throw error
  }

  const deletionJob = await prisma.$transaction(async tx => {
    const job = await tx.dataDeletionJob.create({
      data: {
        actorUserId: actorUserId || null,
        targetUserId: normalizedTargetUserId,
        action: "USER_DELETE",
        resourceType: "User",
        resourceId: normalizedTargetUserId,
        status: DELETION_STATUS.PENDING
      }
    })
    await tx.user.update({
      where: { id: normalizedTargetUserId },
      data: {
        accessSuspendedAt: new Date(),
        accessSuspendedReason: `deletion_pending:${String(reason || "user_delete").slice(0, 460)}`,
        accessSuspendedByUserId: actorUserId || normalizedTargetUserId,
        sessionVersion: { increment: 1 }
      }
    })
    await tx.session.deleteMany({ where: { userId: normalizedTargetUserId } })
    return job
  })

  await logDataAudit({
    actorUserId,
    targetUserId: normalizedTargetUserId,
    action: actorUserId && actorUserId !== normalizedTargetUserId ? "USER_DELETE_ADMIN" : "USER_DELETE_SELF",
    resourceType: "User",
    resourceId: normalizedTargetUserId,
    ipAddress,
    userAgent,
    meta: {
      reason,
      deletionJobId: deletionJob.id,
      state: "pending"
    }
  })

  const result = await performUserPrivacyCleanup({
    actorUserId,
    targetUserId: normalizedTargetUserId,
    ipAddress,
    userAgent
  })

  if (!result.ok) {
    const lastError = summarizeDeletionFailures(result.failures) || safeError(result.error).message
    await prisma.dataDeletionJob.update({
      where: { id: deletionJob.id },
      data: { status: DELETION_STATUS.FAILED, attempts: { increment: 1 }, lastError }
    })
    await logDataAudit({
      actorUserId,
      targetUserId: normalizedTargetUserId,
      action: "USER_DELETE_PENDING",
      resourceType: "User",
      resourceId: normalizedTargetUserId,
      ipAddress,
      userAgent,
      meta: { reason, deletionJobId: deletionJob.id, counts: result.counts, lastError }
    })
    return {
      ok: false,
      pending: true,
      deletionJobId: deletionJob.id,
      counts: result.counts
    }
  }

  await prisma.dataDeletionJob.update({
    where: { id: deletionJob.id },
    data: { status: DELETION_STATUS.DONE, attempts: { increment: 1 }, lastError: null }
  })
  await logDataAudit({
    actorUserId,
    targetUserId: normalizedTargetUserId,
    action: "USER_DELETE_DONE",
    resourceType: "User",
    resourceId: normalizedTargetUserId,
    ipAddress,
    userAgent,
    meta: { reason, deletionJobId: deletionJob.id, counts: result.counts }
  })

  return {
    ok: true,
    deletedUserId: normalizedTargetUserId,
    deletionJobId: deletionJob.id,
    counts: result.counts
  }
}
