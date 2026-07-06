import { prisma } from "@/lib/prisma"
import { safeError } from "@/lib/privacy/safeError"

export const DELETION_STATUS = Object.freeze({
  PENDING: "pending",
  DONE: "done",
  FAILED: "failed",
  SKIPPED: "skipped"
})

function normalizeText(value, max = 500) {
  const text = String(value || "").trim()
  if (!text) return null
  return text.length > max ? text.slice(0, max) : text
}

export async function createDataDeletionJob({
  actorUserId = null,
  targetUserId = null,
  action,
  resourceType,
  resourceId = null,
  storagePath = null,
  externalRef = null,
  status = DELETION_STATUS.PENDING,
  attempts = 0,
  lastError = null
} = {}) {
  if (!action || !resourceType) return null
  try {
    return await prisma.dataDeletionJob.create({
      data: {
        actorUserId: normalizeText(actorUserId, 240),
        targetUserId: normalizeText(targetUserId, 240),
        action: normalizeText(action, 120),
        resourceType: normalizeText(resourceType, 120),
        resourceId: normalizeText(resourceId, 240),
        storagePath: normalizeText(storagePath, 1000),
        externalRef: normalizeText(externalRef, 500),
        status: normalizeText(status, 40) || DELETION_STATUS.PENDING,
        attempts: Math.max(0, Number(attempts) || 0),
        lastError: normalizeText(lastError, 1000)
      }
    })
  } catch (error) {
    try {
      console.error("[data-deletion-job] create failed", safeError(error))
    } catch {}
    return null
  }
}

export async function markDataDeletionJob(job, { status, lastError = null, incrementAttempts = false } = {}) {
  const id = typeof job === "string" ? job : job?.id
  if (!id) return null
  try {
    return await prisma.dataDeletionJob.update({
      where: { id },
      data: {
        status: normalizeText(status, 40) || DELETION_STATUS.PENDING,
        ...(incrementAttempts ? { attempts: { increment: 1 } } : {}),
        lastError: normalizeText(lastError, 1000)
      }
    })
  } catch (error) {
    try {
      console.error("[data-deletion-job] update failed", safeError(error))
    } catch {}
    return null
  }
}
