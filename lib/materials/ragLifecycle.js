import { RAG_AVAILABLE, createRagRetiredError } from "@/lib/rag/retired";
import prisma from "@/lib/prisma"
import { deleteRagDocument } from "@/lib/documents/ragService";
import { writeDataAudit } from "@/lib/privacy/audit"

import { materialRagPolicyFromEnvironment } from "./ragPolicy.js";

export const MATERIAL_RAG_RESOURCE_TYPE = "MaterialSubmission"
export const MATERIAL_RAG_MAX_ATTEMPTS = 8

function text(value, max = 500) {
  const normalized = String(value || "").trim()
  return normalized ? normalized.slice(0, max) : ""
}

function materialRagError(code, status = 500, message = code) {
  const error = new Error(message)
  error.code = code
  error.status = status
  return error
}

function errorCode(error) {
  if (error?.code) return text(error.code, 120)
  if (Number(error?.status) === 504 || error?.name === "AbortError") return "rag_timeout"
  if (Number(error?.status) >= 400) return `rag_http_${Number(error.status)}`
  return "rag_ingest_failed"
}

function retryAt(now, attempt) {
  const exponent = Math.max(0, Math.min(7, Number(attempt || 1) - 1))
  return new Date(now.getTime() + (60_000 * (2 ** exponent)))
}

async function advisoryLock(tx, key) {
  if (typeof tx.$executeRaw === "function") {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key})::bigint)`
  }
}

export function createMaterialRagClient() {
  return {
    async ingest() { throw createRagRetiredError(); },
    async countChunks() { throw createRagRetiredError(); },
    async deleteDocument(docId) { return deleteRagDocument(docId); }
  };
}

async function enqueueJob(tx, {
  action,
  submission,
  docId,
  actorUserId,
  code,
  now
}) {
  await advisoryLock(tx, `material-rag:${action}:${submission.id}:${docId}`)
  const existing = await tx.dataDeletionJob.findFirst({
    where: {
      action,
      resourceType: MATERIAL_RAG_RESOURCE_TYPE,
      resourceId: submission.id,
      externalRef: docId,
      status: { in: ["pending", "processing", "failed"] }
    }
  })
  if (existing) {
    return tx.dataDeletionJob.update({
      where: { id: existing.id },
      data: {
        status: "pending",
        lastError: code,
        lastErrorCode: code,
        nextAttemptAt: now
      }
    })
  }
  return tx.dataDeletionJob.create({
    data: {
      actorUserId: actorUserId || null,
      targetUserId: submission.submittedByUserId,
      action,
      resourceType: MATERIAL_RAG_RESOURCE_TYPE,
      resourceId: submission.id,
      externalRef: docId,
      status: "pending",
      attempts: 0,
      maxAttempts: MATERIAL_RAG_MAX_ATTEMPTS,
      lastError: code,
      lastErrorCode: code,
      nextAttemptAt: now
    }
  })
}

export async function importReviewedMaterialToRag() {
  throw createRagRetiredError();
}

export async function queueMaterialRagDeletion(
  { submission, actorUserId, reason = "material_withdrawal" } = {},
  { db = prisma, audit = writeDataAudit, now = () => new Date() } = {}
) {
  if (!submission?.id || !submission?.ragDocId) return { ok: true, skipped: true, job: null }
  return db.$transaction(async tx => {
    const job = await enqueueJob(tx, {
      action: "RAG_DELETE",
      submission,
      docId: submission.ragDocId,
      actorUserId,
      code: reason,
      now: now()
    })
    await tx.materialSubmission.updateMany({
      where: { id: submission.id, ragDocId: submission.ragDocId },
      data: { ragRemovalStatus: "PENDING" }
    })
    await audit({
      db: tx,
      actorUserId,
      targetUserId: submission.submittedByUserId,
      action: "MATERIAL_RAG_DELETE_QUEUED",
      resourceType: MATERIAL_RAG_RESOURCE_TYPE,
      resourceId: submission.id,
      meta: { docId: submission.ragDocId, jobId: job.id, reason }
    })
    return { ok: true, skipped: false, job }
  })
}

export async function retryMaterialRagIngest(
  { jobId, actorUserId, policy: inputPolicy = materialRagPolicyFromEnvironment().policy } = {},
  dependencies = {}
) {
  const db = dependencies.db || prisma
  const job = await db.dataDeletionJob.findUnique({ where: { id: text(jobId, 200) } })
  if (!job || job.action !== "RAG_INGEST" || job.resourceType !== MATERIAL_RAG_RESOURCE_TYPE || !job.resourceId) {
    throw materialRagError("material_rag_ingest_job_not_found", 404)
  }
  const submission = await db.materialSubmission.findUnique({ where: { id: job.resourceId } })
  if (!submission) throw materialRagError("api.common.not_found", 404)
  return importReviewedMaterialToRag({
    id: submission.id,
    expectedRevision: submission.reviewRevision,
    actorUserId,
    rights: submission,
    policy: inputPolicy
  }, dependencies)
}

export async function retryMaterialRagDeletion(
  { jobId, actorUserId } = {},
  { db = prisma, rag = createMaterialRagClient(), audit = writeDataAudit, now = () => new Date() } = {}
) {
  const job = await db.dataDeletionJob.findUnique({ where: { id: text(jobId, 200) } })
  if (!job || job.action !== "RAG_DELETE" || job.resourceType !== MATERIAL_RAG_RESOURCE_TYPE || !job.externalRef) {
    throw materialRagError("material_rag_delete_job_not_found", 404)
  }
  if (!RAG_AVAILABLE) throw createRagRetiredError();
  const attempt = Number(job.attempts || 0) + 1
  let code = null
  try {
    const result = await rag.deleteDocument(job.externalRef, {
      route: "materials/rag-removal",
      stage: "rag_delete",
      userId: job.targetUserId
    })
    if (!result?.ok) throw result?.error || materialRagError(result?.reason || "rag_delete_failed")
    if (Number(await rag.countChunks(job.externalRef)) !== 0) throw materialRagError("material_rag_delete_chunks_remain")
  } catch (error) {
    code = errorCode(error)
  }
  return db.$transaction(async tx => {
    const done = !code
    const updated = await tx.dataDeletionJob.update({
      where: { id: job.id },
      data: {
        status: done ? "done" : "failed",
        attempts: attempt,
        lastError: code,
        lastErrorCode: code,
        nextAttemptAt: done ? null : retryAt(now(), attempt)
      }
    })
    await tx.materialSubmission.updateMany({
      where: { id: job.resourceId, ragDocId: job.externalRef },
      data: { ragRemovalStatus: done ? "DONE" : "FAILED" }
    })
    if (done) {
      await tx.materialSubmission.updateMany({
        where: { id: job.resourceId, ragDocId: job.externalRef, ragIngestStatus: "CLEANUP_PENDING" },
        data: {
          ragIngestStatus: "FAILED",
          ragIngestErrorCode: "compensation_done_retry_required",
          ragIngestNextAt: now()
        }
      })
    }
    await audit({
      db: tx,
      actorUserId,
      targetUserId: job.targetUserId,
      action: done ? "MATERIAL_RAG_DELETE_DONE" : "MATERIAL_RAG_DELETE_FAILED",
      resourceType: MATERIAL_RAG_RESOURCE_TYPE,
      resourceId: job.resourceId,
      meta: { docId: job.externalRef, jobId: job.id, code }
    })
    return updated
  })
}

export async function removeMaterialRagForAccountDeletion(
  submission,
  context = {},
  dependencies = {}
) {
  if (!submission?.ragDocId || submission?.ragRemovalStatus === "DONE") return { ok: true, skipped: true }
  const queued = await queueMaterialRagDeletion({
    submission,
    actorUserId: context.actorUserId,
    reason: "account_delete"
  }, dependencies)
  const job = await retryMaterialRagDeletion({
    jobId: queued.job.id,
    actorUserId: context.actorUserId
  }, dependencies)
  return { ok: job.status === "done", job }
}
