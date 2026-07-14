import { safeError } from "./safeError.js";

async function executeDeletionJob(job, actions, context) {
  if (job.action === "USER_DELETE" && job.resourceType === "User") {
    if (typeof actions.deleteUser !== "function") {
      throw new Error("user_delete_retry_not_configured")
    }
    await actions.deleteUser(job, context)
    return
  }
  if (job.action === "RAG_DELETE" && job.externalRef) {
    const result = await actions.deleteRag(job.externalRef, {
      route: "admin/deletion-job-retry",
      stage: "rag_delete",
      userId: job.targetUserId
    });
    if (!result.ok) throw result.error || new Error(result.reason || "rag_delete_failed");
    return;
  }
  if (job.action === "FILE_DELETE" && job.storagePath) {
    if (job.resourceType === "MaterialSubmission") {
      await actions.deleteMaterial(job.storagePath);
      return;
    }
    await actions.deleteDocument(job.storagePath);
    return;
  }
  throw new Error("manual_retry_not_supported_for_job_type");
}

export function createDeletionJobRetryService({
  db,
  deleteDocument,
  deleteMaterial,
  deleteRag,
  deleteUser
} = {}) {
  if (!db) throw new TypeError("db is required");

  return async function retry({ jobId, actorUserId, ipAddress = null, userAgent = null } = {}) {
    const id = String(jobId || "").trim();
    if (!id) throw new TypeError("jobId is required");
    const job = await db.dataDeletionJob.findUnique({ where: { id } });
    if (!job) {
      const error = new Error("Deletion job was not found");
      error.code = "DELETION_JOB_NOT_FOUND";
      throw error;
    }

    await db.dataDeletionJob.update({
      where: { id },
      data: { status: "pending", attempts: { increment: 1 }, lastError: null }
    });

    let status = "done";
    let lastError = null;
    try {
      await executeDeletionJob(
        job,
        { deleteDocument, deleteMaterial, deleteRag, deleteUser },
        { actorUserId, ipAddress, userAgent }
      );
    } catch (error) {
      status = "failed";
      lastError = safeError(error).message;
    }

    return db.$transaction(async tx => {
      const updated = await tx.dataDeletionJob.update({
        where: { id },
        data: { status, lastError }
      });
      if (
        status === "done"
        && job.action === "RAG_DELETE"
        && job.resourceType === "EffectivePractice"
        && job.resourceId
        && job.externalRef
      ) {
        await tx.effectivePractice.updateMany({
          where: { id: job.resourceId, ragSourceId: job.externalRef },
          data: {
            ragSourceId: null,
            ragMetadata: {
              syncStatus: "removed",
              reason: "durable_deletion_job",
              checkedAt: new Date().toISOString()
            }
          }
        });
      }
      await tx.dataAuditLog.create({
        data: {
          actorUserId,
          targetUserId: job.targetUserId,
          action: status === "done" ? "DATA_DELETION_JOB_RETRY_DONE" : "DATA_DELETION_JOB_RETRY_FAILED",
          resourceType: "DataDeletionJob",
          resourceId: id,
          ipAddress,
          userAgent,
          meta: { action: job.action, resourceType: job.resourceType, status, lastError }
        }
      });
      return updated;
    });
  };
}
