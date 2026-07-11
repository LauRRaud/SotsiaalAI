import { createDataDeletionJob, DELETION_STATUS, markDataDeletionJob } from "@/lib/privacy/deletionJobs"
import { safeError } from "@/lib/privacy/safeError"

export async function deleteTrackedStorageFile({
  actorUserId = null,
  targetUserId = null,
  action = "FILE_DELETE",
  resourceType,
  resourceId = null,
  storagePath,
  deleteFile
} = {}) {
  if (!storagePath) return { ok: true, skipped: true }
  if (typeof deleteFile !== "function") throw new TypeError("deleteFile is required")

  const job = await createDataDeletionJob({
    actorUserId,
    targetUserId,
    action,
    resourceType,
    resourceId,
    storagePath,
    status: DELETION_STATUS.PENDING
  })
  if (!job) {
    return { ok: false, error: new Error("deletion_job_create_failed"), jobId: null }
  }

  try {
    await deleteFile(storagePath)
    await markDataDeletionJob(job, {
      status: DELETION_STATUS.DONE,
      incrementAttempts: true
    })
    return { ok: true, jobId: job?.id || null }
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
    return { ok: false, error, jobId: job?.id || null }
  }
}
