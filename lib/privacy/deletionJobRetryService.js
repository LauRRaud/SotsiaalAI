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
  /* SOL-CALL-01 — kinnitamata egress-stopi püsiv taasproov. Uut töölist ei ehitatud:
     see tabel kannab juba RAG_DELETE-i ja RAG_INGEST-i ning tal on `nextAttemptAt`,
     `attempts` ja `maxAttempts` olemas. `externalRef` = egressId. */
  if (job.action === "CALL_EGRESS_STOP" && job.externalRef) {
    if (typeof actions.stopCallEgress !== "function") {
      throw new Error("call_egress_stop_retry_not_configured");
    }
    const result = await actions.stopCallEgress({
      egressId: job.externalRef,
      recordingFileId: job.resourceId
    });
    /* Ainult providerikinnitus loeb. Veatu kutse ilma kinnituseta EI ole edu — muidu
       märgiks järjekord töö tehtuks ja salvestus võiks edasi käia. */
    if (!result?.stopped) throw new Error(result?.errorCode || "call_egress_stop_unconfirmed");
    return;
  }
  /* SOL-CALL-03 — start aegus ja vastus kadus, seega egressId-d EI OLE. Ainus tee
     orvuni on ruum: `storagePath` kannab siin `providerRoomName`-i. */
  if (job.action === "CALL_EGRESS_ORPHAN_STOP" && job.storagePath) {
    if (typeof actions.stopOrphanRoomEgress !== "function") {
      throw new Error("call_egress_orphan_retry_not_configured");
    }
    const result = await actions.stopOrphanRoomEgress({ providerRoomName: job.storagePath });
    if (!result?.cleared) throw new Error(result?.errorCode || "call_egress_orphan_unconfirmed");
    return;
  }
  if (job.action === "FILE_DELETE" && job.storagePath) {
    if (job.resourceType === "MaterialSubmission") {
      await actions.deleteMaterial(job.storagePath);
      return;
    }
    /* SOL-RAGADMIN-01 — RAG-admini failid EI ELA `uploads/` all.
       `deleteDocument` jõustab tee `<docs>/uploads/` sees ja viskaks KOV-
       (`<docs>/kov/…`) või organisatsioonitee (`<docs>/organizations/…`) peal
       `storage_path_invalid`. Ilma selle haruta oleks orbude järjekord selline,
       mis EI SAA kunagi tühjeneda — järelevalve, mis näeb välja nagu töötav. */
    if (typeof actions.deleteRagAdminFile === "function") {
      const handled = await actions.deleteRagAdminFile(job);
      if (handled) return;
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
  deleteRagAdminFile,
  deleteUser,
  stopCallEgress,
  stopOrphanRoomEgress
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
        { deleteDocument, deleteMaterial, deleteRag, deleteRagAdminFile, deleteUser, stopCallEgress, stopOrphanRoomEgress },
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
      /* SOL-SPROF-01/-02 — sama muster kui praktikatel ülal: viit kustub AINULT
         siis, kui kaugkoopia kustutus on kinnitatud. Ilma selleta jääks profiil
         igavesti `pending_removal`-i ka pärast õnnestunud taasproovi, ja järgmine
         salvestus alustaks kustutust otsast peale. */
      if (
        status === "done"
        && job.action === "RAG_DELETE"
        && job.resourceType === "ServiceProviderProfile"
        && job.resourceId
        && job.externalRef
      ) {
        await tx.serviceProviderProfile.updateMany({
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
      /* SOL-CALL-01 — kinnitatud stop on AINUS hetk, mil tohib öelda, et salvestamine
         lõppes. Fail jääb QUARANTINED-iks: tema füüsilise kustutuse teeb retention-
         koristus, mis nüüd tohib teda puutuda, sest stop on tõendatud.
         `updateMany` mitte `update`, et puuduv rida ei katkestaks tehingut. */
      if (status === "done" && job.action === "CALL_EGRESS_STOP" && job.resourceId) {
        const confirmedAt = new Date();
        await tx.callRecordingFile.updateMany({
          where: { id: job.resourceId },
          data: { providerStopConfirmedAt: confirmedAt }
        });
        const file = await tx.callRecordingFile.findUnique({ where: { id: job.resourceId } });
        if (file?.recordingRequestId) {
          await tx.callRecordingRequest.updateMany({
            where: { id: file.recordingRequestId, status: { in: ["STOPPING", "STOP_FAILED"] } },
            data: { status: "STOPPED", stoppedAt: confirmedAt }
          });
        }
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
