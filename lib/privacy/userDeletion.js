import { deleteStoredDocument } from "@/lib/documents/server"
import { deleteStoredMaterial } from "@/lib/materials/server"
import { prisma } from "@/lib/prisma"
import { logDataAudit } from "@/lib/privacy/audit"
import { deleteDocumentRagReference } from "@/lib/privacy/documentDeletion"
import { createDataDeletionJob, DELETION_STATUS, markDataDeletionJob } from "@/lib/privacy/deletionJobs"
import { safeError } from "@/lib/privacy/safeError"

async function deleteTrackedFile({
  actorUserId,
  targetUserId,
  action,
  resourceType,
  resourceId,
  storagePath,
  deleteFile
}) {
  if (!storagePath) return { ok: true, skipped: true }
  const job = await createDataDeletionJob({
    actorUserId,
    targetUserId,
    action,
    resourceType,
    resourceId,
    storagePath,
    status: DELETION_STATUS.PENDING
  })

  try {
    await deleteFile(storagePath)
    await markDataDeletionJob(job, {
      status: DELETION_STATUS.DONE,
      incrementAttempts: true
    })
    return { ok: true }
  } catch (error) {
    await markDataDeletionJob(job, {
      status: DELETION_STATUS.FAILED,
      incrementAttempts: true,
      lastError: safeError(error).message
    })
    try {
      console.error("[privacy] file cleanup failed", {
        resourceType,
        resourceId,
        error: safeError(error)
      })
    } catch {}
    return { ok: false, error }
  }
}

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

  const targets = await collectUserPrivacyDeletionTargets(normalizedTargetUserId)
  const user = await prisma.user.findUnique({
    where: { id: normalizedTargetUserId },
    select: { email: true }
  })

  for (const document of targets.documents) {
    await deleteDocumentRagReference({
      document,
      actorUserId,
      targetUserId: normalizedTargetUserId,
      ipAddress,
      userAgent,
      action: "RAG_DELETE",
      auditResourceType: "UserDocument"
    })
    await deleteTrackedFile({
      actorUserId,
      targetUserId: normalizedTargetUserId,
      action: "FILE_DELETE",
      resourceType: "UserDocument",
      resourceId: document.id,
      storagePath: document.storagePath,
      deleteFile: deleteStoredDocument
    })
  }

  for (const submission of targets.materialSubmissions) {
    await deleteTrackedFile({
      actorUserId,
      targetUserId: normalizedTargetUserId,
      action: "FILE_DELETE",
      resourceType: "MaterialSubmission",
      resourceId: submission.id,
      storagePath: submission.storagePath,
      deleteFile: deleteStoredMaterial
    })
  }

  for (const artifact of targets.artifacts) {
    // AgentArtifact content is stored in the database. No artifact filesystem
    // storage path is present in the current schema.
    await createDataDeletionJob({
      actorUserId,
      targetUserId: normalizedTargetUserId,
      action: "ARTIFACT_DB_DELETE",
      resourceType: "AgentArtifact",
      resourceId: artifact.id,
      status: DELETION_STATUS.SKIPPED,
      lastError: "database_cascade_only"
    })
  }

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
      documentCount: targets.documents.length,
      materialSubmissionCount: targets.materialSubmissions.length,
      artifactCount: targets.artifacts.length
    }
  })

  const email = String(user?.email || "").trim().toLowerCase()
  if (email) {
    await prisma.verificationToken.deleteMany({
      where: {
        OR: [
          { identifier: email },
          { identifier: `email-verify:${email}` }
        ]
      }
    }).catch(error => {
      try {
        console.error("[privacy] verification token cleanup failed", safeError(error))
      } catch {}
    })
  }

  await prisma.chatLog.deleteMany({
    where: { userId: normalizedTargetUserId }
  }).catch(error => {
    try {
      console.error("[privacy] chat log cleanup failed", safeError(error))
    } catch {}
  })

  await prisma.user.delete({
    where: { id: normalizedTargetUserId }
  })

  return {
    ok: true,
    deletedUserId: normalizedTargetUserId,
    counts: {
      documents: targets.documents.length,
      materialSubmissions: targets.materialSubmissions.length,
      artifacts: targets.artifacts.length
    }
  }
}
