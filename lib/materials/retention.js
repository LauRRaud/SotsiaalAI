import { randomUUID } from "node:crypto"

import prisma from "@/lib/prisma"
import { writeDataAudit } from "@/lib/privacy/audit"
import { deleteQuarantinedMaterial, deleteStoredMaterial } from "./server.js"

const JOB_ACTION = "MATERIAL_RETENTION_DELETE"
const QUARANTINE_ACTION = "MATERIAL_QUARANTINE_DELETE"
const MAX_ATTEMPTS = 8

function text(value, max = 200) {
  const normalized = String(value || "").trim()
  return normalized ? normalized.slice(0, max) : ""
}

function retryAt(now, attempt) {
  const exponent = Math.max(0, Math.min(7, Number(attempt || 1) - 1))
  return new Date(now.getTime() + (60_000 * (2 ** exponent)))
}

function code(error, fallback) {
  return text(error?.code || error?.message || fallback, 120) || fallback
}

async function advisoryLock(tx, key) {
  if (typeof tx.$executeRaw === "function") {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key})::bigint)`
  }
}

async function markJobFailure(job, errorCode, { db, now }) {
  const attempt = Number(job.attempts || 0) + 1
  await db.dataDeletionJob.updateMany({
    where: { id: job.id, status: "processing", claimToken: job.claimToken },
    data: {
      status: "failed",
      attempts: attempt,
      lastError: errorCode,
      lastErrorCode: errorCode,
      nextAttemptAt: retryAt(now, attempt),
      claimToken: null,
      claimedAt: null
    }
  })
}

export async function scheduleDueMaterialRetention({ db = prisma, now = new Date(), limit = 100, audit = writeDataAudit } = {}) {
  const due = await db.materialSubmission.findMany({
    where: { retentionState: "SCHEDULED", retentionUntil: { lte: now } },
    orderBy: [{ retentionUntil: "asc" }, { id: "asc" }],
    take: Math.max(1, Math.min(500, Number(limit) || 100))
  })
  let queued = 0
  for (const submission of due) {
    await db.$transaction(async tx => {
      await advisoryLock(tx, `material-retention:${submission.id}`)
      const current = await tx.materialSubmission.findUnique({ where: { id: submission.id } })
      if (!current || current.retentionState !== "SCHEDULED" || !current.retentionUntil || current.retentionUntil > now) return
      let job = await tx.dataDeletionJob.findFirst({
        where: { action: JOB_ACTION, resourceType: "MaterialSubmission", resourceId: current.id, status: { in: ["pending", "processing", "failed", "done"] } }
      })
      if (!job) {
        job = await tx.dataDeletionJob.create({ data: {
          actorUserId: null,
          targetUserId: current.submittedByUserId,
          action: JOB_ACTION,
          resourceType: "MaterialSubmission",
          resourceId: current.id,
          storagePath: current.storagePath,
          externalRef: current.ragDocId,
          status: "pending",
          attempts: 0,
          maxAttempts: MAX_ATTEMPTS,
          nextAttemptAt: now
        } })
        queued += 1
      }
      await tx.materialSubmission.updateMany({
        where: { id: current.id, retentionState: "SCHEDULED" },
        data: { retentionState: "DELETE_PENDING", storageStatus: "DELETE_PENDING" }
      })
      await audit({
        db: tx,
        action: "MATERIAL_RETENTION_DELETE_QUEUED",
        resourceType: "MaterialSubmission",
        resourceId: current.id,
        targetUserId: current.submittedByUserId,
        meta: { retentionClass: current.retentionClass, retentionUntil: current.retentionUntil, jobId: job.id }
      })
    })
  }
  return { queued }
}

async function claimNextMaterialJob({ db, now, jobId = null, staleMs = 5 * 60_000 }) {
  const staleBefore = new Date(now.getTime() - staleMs)
  const candidate = await db.dataDeletionJob.findFirst({
    where: {
      action: JOB_ACTION,
      resourceType: "MaterialSubmission",
      ...(jobId ? { id: jobId } : {}),
      OR: [
        { status: { in: ["pending", "failed"] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        { status: "processing", claimedAt: { lte: staleBefore } }
      ]
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }]
  })
  if (!candidate) return null
  const claimToken = randomUUID()
  const claim = await db.dataDeletionJob.updateMany({
    where: { id: candidate.id, status: candidate.status, claimedAt: candidate.claimedAt },
    data: { status: "processing", claimToken, claimedAt: now }
  })
  if (claim.count !== 1) return { lostRace: true }
  return db.dataDeletionJob.findUnique({ where: { id: candidate.id } })
}

export async function processNextMaterialRetentionJob({
  db = prisma,
  now = new Date(),
  jobId = null,
  files = { remove: deleteStoredMaterial },
  ragDependencies = {},
  audit = writeDataAudit,
  beforeFinalize = async () => {}
} = {}) {
  const job = await claimNextMaterialJob({ db, now, jobId })
  if (!job || job.lostRace) return job
  const submission = await db.materialSubmission.findUnique({ where: { id: job.resourceId } })
  if (!submission) {
    await db.dataDeletionJob.updateMany({ where: { id: job.id, claimToken: job.claimToken }, data: {
      status: "done", lastError: null, lastErrorCode: null, nextAttemptAt: null, claimToken: null, claimedAt: null
    } })
    return { status: "done", replay: true, jobId: job.id }
  }
  if (submission.ragDocId && submission.ragRemovalStatus !== "DONE") {
    try {
      const { queueMaterialRagDeletion, retryMaterialRagDeletion } = await import("./ragLifecycle.js")
      const queued = await queueMaterialRagDeletion({ submission, reason: "retention_expired" }, { db, audit, now: () => now })
      const ragJob = await retryMaterialRagDeletion({ jobId: queued.job.id }, { db, audit, now: () => now, ...ragDependencies })
      if (ragJob.status !== "done") throw Object.assign(new Error("material_rag_delete_failed"), { code: "material_rag_delete_failed" })
    } catch (error) {
      await markJobFailure(job, code(error, "material_rag_delete_failed"), { db, now })
      return { status: "failed", stage: "rag", jobId: job.id }
    }
  }
  try {
    if (job.storagePath) await files.remove(job.storagePath)
  } catch (error) {
    await markJobFailure(job, code(error, "material_file_delete_failed"), { db, now })
    return { status: "failed", stage: "file", jobId: job.id }
  }
  try {
    await beforeFinalize({ job, submission })
    await db.$transaction(async tx => {
      await advisoryLock(tx, `material-retention:${submission.id}`)
      const deleted = await tx.materialSubmission.deleteMany({
        where: { id: submission.id, retentionState: "DELETE_PENDING", retentionUntil: { lte: now } }
      })
      if (deleted.count !== 1) throw Object.assign(new Error("material_retention_finalize_conflict"), { code: "material_retention_finalize_conflict" })
      await audit({
        db: tx,
        action: "MATERIAL_RETENTION_DELETED",
        resourceType: "MaterialSubmission",
        resourceId: submission.id,
        targetUserId: submission.submittedByUserId,
        meta: { retentionClass: submission.retentionClass, retentionUntil: submission.retentionUntil, ragDeleted: Boolean(submission.ragDocId) }
      })
      await tx.dataDeletionJob.updateMany({ where: { id: job.id, claimToken: job.claimToken }, data: {
        status: "done", attempts: { increment: 1 }, lastError: null, lastErrorCode: null,
        nextAttemptAt: null, storagePath: null, externalRef: null, claimToken: null, claimedAt: null
      } })
    })
    return { status: "done", jobId: job.id }
  } catch (error) {
    await markJobFailure(job, code(error, "material_db_finalize_failed"), { db, now })
    return { status: "failed", stage: "database", jobId: job.id }
  }
}

export async function sweepExpiredMaterialQuarantines({
  db = prisma,
  now = new Date(),
  limit = 100,
  files = { remove: deleteQuarantinedMaterial },
  audit = writeDataAudit
} = {}) {
  const rows = await db.materialUploadQuarantine.findMany({
    where: { storageState: { in: ["QUARANTINED", "WRITE_FAILED"] }, retentionState: "SCHEDULED", retentionUntil: { lte: now } },
    orderBy: [{ retentionUntil: "asc" }, { id: "asc" }],
    take: Math.max(1, Math.min(500, Number(limit) || 100))
  })
  const outcomes = []
  for (const receipt of rows) {
    let job = await db.dataDeletionJob.findFirst({ where: { action: QUARANTINE_ACTION, resourceType: "MaterialUploadQuarantine", resourceId: receipt.id } })
    if (!job) job = await db.dataDeletionJob.create({ data: {
      targetUserId: receipt.submittedByUserId,
      action: QUARANTINE_ACTION,
      resourceType: "MaterialUploadQuarantine",
      resourceId: receipt.id,
      storagePath: receipt.quarantinePath,
      status: "pending",
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      nextAttemptAt: now
    } })
    try {
      if (receipt.quarantinePath) await files.remove(receipt.quarantinePath)
      await db.$transaction(async tx => {
        await tx.materialUploadQuarantine.updateMany({ where: { id: receipt.id }, data: {
          quarantinePath: null, storageState: "REMOVED", retentionState: "DELETED"
        } })
        await tx.dataDeletionJob.updateMany({ where: { id: job.id }, data: {
          status: "done", attempts: { increment: 1 }, lastError: null, lastErrorCode: null, nextAttemptAt: null, storagePath: null
        } })
        await audit({ db: tx, action: "MATERIAL_QUARANTINE_RETENTION_DELETED", resourceType: "MaterialUploadQuarantine", resourceId: receipt.id, targetUserId: receipt.submittedByUserId, meta: { retentionClass: receipt.retentionClass } })
      })
      outcomes.push({ id: receipt.id, status: "done" })
    } catch (error) {
      const attempt = Number(job.attempts || 0) + 1
      await db.dataDeletionJob.updateMany({ where: { id: job.id }, data: {
        status: "failed", attempts: attempt, lastError: code(error, "quarantine_delete_failed"),
        lastErrorCode: code(error, "quarantine_delete_failed"), nextAttemptAt: retryAt(now, attempt)
      } })
      outcomes.push({ id: receipt.id, status: "failed" })
    }
  }
  return outcomes
}

export async function removeMaterialForAccountDeletion(submission, context = {}, dependencies = {}) {
  const db = dependencies.db || prisma
  const audit = dependencies.audit || writeDataAudit
  const now = dependencies.now || new Date()
  if (!submission?.id) return { ok: true, skipped: true }
  let job
  await db.$transaction(async tx => {
    await advisoryLock(tx, `material-retention:${submission.id}`)
    job = await tx.dataDeletionJob.findFirst({
      where: { action: JOB_ACTION, resourceType: "MaterialSubmission", resourceId: submission.id, status: { in: ["pending", "processing", "failed", "done"] } }
    })
    if (!job) job = await tx.dataDeletionJob.create({ data: {
      actorUserId: context.actorUserId || null,
      targetUserId: submission.submittedByUserId,
      action: JOB_ACTION,
      resourceType: "MaterialSubmission",
      resourceId: submission.id,
      storagePath: submission.storagePath,
      externalRef: submission.ragDocId,
      status: "pending",
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      nextAttemptAt: now
    } })
    await tx.materialSubmission.updateMany({ where: { id: submission.id }, data: {
      retentionClass: "MATERIAL_ACCOUNT_DELETE",
      retentionUntil: now,
      retentionPolicyVersion: "account-deletion-v1",
      retentionState: "DELETE_PENDING",
      retentionAnchorAt: now,
      storageStatus: "DELETE_PENDING"
    } })
    await audit({ db: tx, actorUserId: context.actorUserId, targetUserId: submission.submittedByUserId, action: "MATERIAL_ACCOUNT_DELETE_QUEUED", resourceType: "MaterialSubmission", resourceId: submission.id, meta: { jobId: job.id, ragDeleteRequired: Boolean(submission.ragDocId) } })
  })
  if (job.status === "done") return { ok: true, replay: true }
  const outcome = await processNextMaterialRetentionJob({
    db,
    now,
    jobId: job.id,
    files: dependencies.files || { remove: deleteStoredMaterial },
    ragDependencies: dependencies.ragDependencies || {},
    audit
  })
  return { ok: outcome?.status === "done", stage: outcome?.stage || null, jobId: job.id }
}

export { JOB_ACTION as MATERIAL_RETENTION_DELETE_ACTION }
