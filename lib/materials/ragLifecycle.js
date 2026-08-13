import prisma from "@/lib/prisma"
import { buildRagHeaders, deleteRagDocument, ragServiceRequest } from "@/lib/documents/ragService"
import { writeDataAudit } from "@/lib/privacy/audit"
import { readStoredMaterial } from "./server.js"
import {
  buildMaterialRagIdentity,
  materialRagPolicyFromEnvironment,
  requireMaterialRagPolicy
} from "./ragPolicy.js"
import { materialRetentionPolicyFromEnvironment, retentionFieldsForSubmission } from "./retentionPolicy.js"

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

function materialScanIsFresh(submission, now = new Date()) {
  const scanned = new Date(submission.scanSignatureUpdatedAt || submission.scannedAt || 0)
  const maxAge = Number(process.env.MATERIALS_CLAMD_SIGNATURE_MAX_AGE_MS || 36 * 60 * 60_000)
  return Number.isFinite(scanned.getTime()) && (now.getTime() - scanned.getTime()) <= maxAge
}

async function advisoryLock(tx, key) {
  if (typeof tx.$executeRaw === "function") {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key})::bigint)`
  }
}

function requireRights(input = {}) {
  const rights = {
    authorName: text(input.authorName, 500),
    rightsHolder: text(input.rightsHolder, 500),
    rightsBasis: text(input.rightsBasis, 500),
    rightsEvidence: text(input.rightsEvidence, 4_000)
  }
  const missing = Object.entries(rights).filter(([, value]) => !value).map(([key]) => key)
  if (missing.length) {
    const error = materialRagError("material_rights_evidence_required", 409)
    error.missingRightsFields = missing
    throw error
  }
  return rights
}

export function createMaterialRagClient({
  request = ragServiceRequest,
  deleteDocument = deleteRagDocument,
  readMaterial = readStoredMaterial
} = {}) {
  return {
    async ingest({ submission, identity, policy, rights, actorUserId }) {
      if (submission.mime !== "application/pdf") {
        throw materialRagError("material_rag_mime_not_supported", 409)
      }
      const buffer = await readMaterial(submission.storagePath)
      const metadata = {
        docId: identity.docId,
        doc_id: identity.docId,
        source_id: identity.sourceId,
        source_type: "professional_material",
        title: submission.originalName,
        fileName: submission.originalName,
        mimeType: submission.mime,
        collection_id: policy.collection,
        audience: policy.audience,
        audiences: policy.audience === "BOTH" ? ["CLIENT", "SOCIAL_WORKER"] : [policy.audience],
        content_hash: identity.contentHash,
        version: Number(submission.ragVersion || 1),
        author: rights.authorName,
        rights_holder: rights.rightsHolder,
        rights_basis: rights.rightsBasis,
        rights_evidence_mode: policy.rightsEvidenceMode,
        rights_policy_version: policy.version,
        submitted_by_user_id: submission.submittedByUserId,
        ingested_by_user_id: actorUserId
      }
      const form = new FormData()
      form.append("file", new Blob([buffer], { type: submission.mime }), submission.originalName)
      form.append("metadata_text", JSON.stringify(metadata))
      return request("/ingest/pdf-with-metadata", {
        method: "POST",
        headers: buildRagHeaders(null, {
          route: "admin/materials",
          stage: "rag_ingest",
          userId: actorUserId
        }),
        body: form
      }, "materials_page.errors.rag_ingest_failed")
    },
    async countChunks(docId) {
      try {
        const result = await request(`/documents/${encodeURIComponent(docId)}`, {
          method: "GET",
          headers: buildRagHeaders()
        }, "materials_page.errors.rag_ingest_failed")
        return Number(result?.chunks || 0)
      } catch (error) {
        if (Number(error?.status) === 404) return 0
        throw error
      }
    },
    deleteDocument(docId, observability) {
      return deleteDocument(docId, observability)
    }
  }
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

async function persistIngestFailure({
  db,
  audit,
  submission,
  identity,
  actorUserId,
  code,
  remoteTouched,
  now
}) {
  const action = remoteTouched ? "RAG_DELETE" : "RAG_INGEST"
  return db.$transaction(async tx => {
    const job = await enqueueJob(tx, {
      action,
      submission,
      docId: identity.docId,
      actorUserId,
      code,
      now
    })
    await tx.materialSubmission.updateMany({
      where: { id: submission.id, status: { not: "imported" } },
      data: {
        sourceId: identity.sourceId,
        ragDocId: identity.docId,
        ragContentHash: identity.contentHash,
        ragIngestStatus: remoteTouched ? "CLEANUP_PENDING" : "FAILED",
        ragIngestErrorCode: code,
        ragIngestNextAt: remoteTouched ? null : retryAt(now, Number(submission.ragIngestAttempts || 0) + 1),
        ragRemovalStatus: remoteTouched ? "PENDING" : null
      }
    })
    await audit({
      db: tx,
      actorUserId,
      targetUserId: submission.submittedByUserId,
      action: "MATERIAL_RAG_INGEST_FAILED",
      resourceType: MATERIAL_RAG_RESOURCE_TYPE,
      resourceId: submission.id,
      meta: { code, retryJobId: job.id, retryAction: action, docId: identity.docId }
    })
    return job
  })
}

export async function importReviewedMaterialToRag(
  {
    id,
    expectedRevision,
    actorUserId,
    rights: inputRights,
    policy: inputPolicy = materialRagPolicyFromEnvironment().policy
  } = {},
  {
    db = prisma,
    rag = createMaterialRagClient(),
    audit = writeDataAudit,
    now = () => new Date(),
    beforeFinalize = async () => {}
  } = {}
) {
  const submissionId = text(id, 200)
  const actorId = text(actorUserId, 200)
  const revision = Number(expectedRevision)
  if (!submissionId || !actorId) throw materialRagError("material_rag_identity_required", 400)
  if (!Number.isSafeInteger(revision) || revision < 0) throw materialRagError("materials_page.errors.review_revision_required", 400)
  const policy = requireMaterialRagPolicy(inputPolicy)

  let claimed
  await db.$transaction(async tx => {
    await advisoryLock(tx, `material-rag-ingest:${submissionId}`)
    const current = await tx.materialSubmission.findUnique({ where: { id: submissionId } })
    if (!current) throw materialRagError("api.common.not_found", 404)
    if (current.status === "imported" && current.ragIngestStatus === "IMPORTED") {
      claimed = current
      return
    }
    if (current.ragIngestStatus === "CLEANUP_PENDING" || ["PENDING", "FAILED"].includes(current.ragRemovalStatus)) {
      throw materialRagError("material_rag_cleanup_pending", 409)
    }
    if (current.scanState !== "CLEAN" || current.validationState !== "VALIDATED") {
      throw materialRagError("material_security_gate_failed", 409)
    }
    if (!materialScanIsFresh(current, now())) {
      throw materialRagError("material_scan_stale", 409)
    }
    if (current.status !== "reviewed" || current.reviewRevision !== revision || current.storageStatus !== "ACTIVE") {
      throw materialRagError("materials_page.errors.review_conflict", 409)
    }
    const rights = requireRights(inputRights || current)
    const retryingSameVersion = current.ragIngestStatus === "FAILED"
      && current.ragDocId
      && Number(current.ragVersion) > 0
    const nextVersion = retryingSameVersion ? Number(current.ragVersion) : Number(current.ragVersion || 0) + 1
    const identity = buildMaterialRagIdentity(current, nextVersion)
    const duplicate = await tx.materialSubmission.findFirst({
      where: {
        id: { not: current.id },
        sha256: current.sha256,
        ragCollection: policy.collection,
        ragAudience: policy.audience,
        status: "imported",
        ragIngestStatus: "IMPORTED"
      },
      select: { id: true }
    })
    if (duplicate) {
      const error = materialRagError("material_rag_duplicate", 409)
      error.duplicateOfId = duplicate.id
      throw error
    }
    const changed = await tx.materialSubmission.updateMany({
      where: { id: current.id, status: "reviewed", reviewRevision: revision },
      data: {
        sourceId: identity.sourceId,
        ragDocId: identity.docId,
        ragVersion: nextVersion,
        ragContentHash: identity.contentHash,
        ragCollection: policy.collection,
        ragAudience: policy.audience,
        ragPolicyVersion: policy.version,
        rightsEvidenceMode: policy.rightsEvidenceMode,
        ragRetentionMode: policy.retentionMode,
        ragWithdrawalAuthority: policy.withdrawalAuthority,
        ragIngestStatus: "PROCESSING",
        ragIngestErrorCode: null,
        ragIngestNextAt: null,
        ragRemovalStatus: null,
        ragIngestAttempts: { increment: 1 },
        authorName: rights.authorName,
        rightsHolder: rights.rightsHolder,
        rightsBasis: rights.rightsBasis,
        rightsEvidence: rights.rightsEvidence,
        rightsConfirmedAt: now(),
        rightsConfirmedByUserId: current.submittedByUserId
      }
    })
    if (changed.count !== 1) throw materialRagError("materials_page.errors.review_conflict", 409)
    await audit({
      db: tx,
      actorUserId: actorId,
      targetUserId: current.submittedByUserId,
      action: "MATERIAL_RAG_INGEST_STARTED",
      resourceType: MATERIAL_RAG_RESOURCE_TYPE,
      resourceId: current.id,
      meta: {
        sourceId: identity.sourceId,
        docId: identity.docId,
        contentHash: identity.contentHash,
        collection: policy.collection,
        audience: policy.audience,
        policyVersion: policy.version
      }
    })
    claimed = { ...current, ...rights, ...identity, ragVersion: nextVersion, ragIngestAttempts: Number(current.ragIngestAttempts || 0) + 1 }
  })

  if (claimed.status === "imported" && claimed.ragIngestStatus === "IMPORTED") return claimed
  const identity = { sourceId: claimed.sourceId, docId: claimed.docId, contentHash: claimed.contentHash }
  let remoteTouched = false
  try {
    const receipt = await rag.ingest({ submission: claimed, identity, policy, rights: claimed, actorUserId: actorId })
    remoteTouched = true
    if (!(Number(receipt?.inserted) > 0)) throw materialRagError("material_rag_zero_chunk_receipt", 502)
    const chunks = await rag.countChunks(identity.docId)
    if (!(Number(chunks) > 0)) throw materialRagError("material_rag_zero_chunk_presence", 502)
    await beforeFinalize({ submission: claimed, identity, receipt, chunks })
    const importedAt = now()
    const retention = retentionFieldsForSubmission("imported", importedAt, materialRetentionPolicyFromEnvironment())
    return await db.$transaction(async tx => {
      const changed = await tx.materialSubmission.updateMany({
        where: {
          id: claimed.id,
          status: "reviewed",
          reviewRevision: revision,
          ragDocId: identity.docId,
          ragIngestStatus: "PROCESSING"
        },
        data: {
          status: "imported",
          reviewRevision: { increment: 1 },
          reviewedAt: importedAt,
          reviewedBy: actorId,
          ragIngestStatus: "IMPORTED",
          ragIngestedAt: importedAt,
          ragIngestedByUserId: actorId,
          ragIngestErrorCode: null,
          ragIngestNextAt: null,
          ...retention
        }
      })
      if (changed.count !== 1) throw materialRagError("material_rag_finalize_conflict", 409)
      await tx.dataDeletionJob.updateMany({
        where: {
          action: "RAG_INGEST",
          resourceType: MATERIAL_RAG_RESOURCE_TYPE,
          resourceId: claimed.id,
          externalRef: identity.docId,
          status: { in: ["pending", "processing", "failed"] }
        },
        data: { status: "done", lastError: null, lastErrorCode: null, nextAttemptAt: null }
      })
      await audit({
        db: tx,
        actorUserId: actorId,
        targetUserId: claimed.submittedByUserId,
        action: "MATERIAL_RAG_IMPORTED",
        resourceType: MATERIAL_RAG_RESOURCE_TYPE,
        resourceId: claimed.id,
        meta: { docId: identity.docId, chunkCount: Number(chunks), policyVersion: policy.version }
      })
      return tx.materialSubmission.findUnique({ where: { id: claimed.id } })
    })
  } catch (error) {
    if (Number(error?.status) >= 500 || error?.name === "AbortError") remoteTouched = true
    const code = errorCode(error)
    await persistIngestFailure({
      db,
      audit,
      submission: claimed,
      identity,
      actorUserId: actorId,
      code,
      remoteTouched,
      now: now()
    })
    throw error
  }
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
