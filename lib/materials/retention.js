import { randomUUID } from "node:crypto"

import prisma from "@/lib/prisma"
import { writeDataAudit } from "@/lib/privacy/audit"
import { deleteQuarantinedMaterial, deleteStoredMaterial } from "./server.js"

export const MATERIAL_ORIGINAL_RETENTION_DELETE_ACTION = "MATERIAL_ORIGINAL_RETENTION_DELETE"
export const MATERIAL_DERIVATIVE_RETENTION_DELETE_ACTION = "MATERIAL_DERIVATIVE_RETENTION_DELETE"
export const MATERIAL_RAG_RETENTION_DELETE_ACTION = "MATERIAL_RAG_RETENTION_DELETE"

const QUARANTINE_ACTION = "MATERIAL_QUARANTINE_DELETE"
const MAX_ATTEMPTS = 8
const UNSAFE_STATES = new Set(["PROHIBITED", "PERSONAL_DATA"])
const LAYERS = Object.freeze({
  original: Object.freeze({
    action: MATERIAL_ORIGINAL_RETENTION_DELETE_ACTION,
    state: "originalRetentionState",
    until: "originalRetentionUntil",
    retentionClass: "originalRetentionClass",
    path: "storagePath"
  }),
  derivative: Object.freeze({
    action: MATERIAL_DERIVATIVE_RETENTION_DELETE_ACTION,
    state: "derivativeRetentionState",
    until: "derivativeRetentionUntil",
    retentionClass: "derivativeRetentionClass",
    path: "derivativeStoragePath"
  }),
  rag: Object.freeze({
    action: MATERIAL_RAG_RETENTION_DELETE_ACTION,
    state: "ragRetentionState",
    until: "ragRetentionUntil",
    retentionClass: "ragRetentionClass",
    external: "ragDocId"
  })
})
const JOB_ACTIONS = Object.freeze(Object.values(LAYERS).map(layer => layer.action))

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

function layerByAction(action) {
  return Object.entries(LAYERS).find(([, layer]) => layer.action === action) || null
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

function dateIsDue(value, now) {
  const date = value ? new Date(value) : null
  return Boolean(date && Number.isFinite(date.getTime()) && date <= now)
}

function layerIsDue(submission, layerName, now) {
  const layer = LAYERS[layerName]
  if (submission[layer.state] !== "SCHEDULED") return false
  if (UNSAFE_STATES.has(submission.contentSafetyState)) return true
  if (dateIsDue(submission[layer.until], now)) return true
  if (["derivative", "rag"].includes(layerName)) {
    return dateIsDue(submission.rightsValidUntil, now) || dateIsDue(submission.sourceValidUntil, now)
  }
  return false
}

export async function scheduleDueMaterialRetention({ db = prisma, now = new Date(), limit = 100, submissionId = null, audit = writeDataAudit } = {}) {
  const due = await db.materialSubmission.findMany({
    where: {
      ...(submissionId ? { id: submissionId } : {}),
      OR: [
        { originalRetentionState: "SCHEDULED", originalRetentionUntil: { lte: now } },
        { derivativeRetentionState: "SCHEDULED", derivativeRetentionUntil: { lte: now } },
        { ragRetentionState: "SCHEDULED", ragRetentionUntil: { lte: now } },
        { contentSafetyState: { in: [...UNSAFE_STATES] } },
        { rightsValidUntil: { lte: now } },
        { sourceValidUntil: { lte: now } }
      ]
    },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: Math.max(1, Math.min(500, Number(limit) || 100))
  })
  let queued = 0
  const queuedByLayer = { original: 0, derivative: 0, rag: 0 }
  for (const candidate of due) {
    await db.$transaction(async tx => {
      await advisoryLock(tx, `material-retention:${candidate.id}`)
      const current = await tx.materialSubmission.findUnique({ where: { id: candidate.id } })
      if (!current) return
      for (const [layerName, layer] of Object.entries(LAYERS)) {
        if (!layerIsDue(current, layerName, now)) continue
        let job = await tx.dataDeletionJob.findFirst({
          where: {
            action: layer.action,
            resourceType: "MaterialSubmission",
            resourceId: current.id,
            status: { in: ["pending", "processing", "failed"] }
          }
        })
        if (!job) {
          job = await tx.dataDeletionJob.create({ data: {
            actorUserId: null,
            targetUserId: current.submittedByUserId,
            action: layer.action,
            resourceType: "MaterialSubmission",
            resourceId: current.id,
            storagePath: layer.path ? current[layer.path] : null,
            externalRef: layer.external ? current[layer.external] : null,
            status: "pending",
            attempts: 0,
            maxAttempts: MAX_ATTEMPTS,
            nextAttemptAt: now
          } })
          queued += 1
          queuedByLayer[layerName] += 1
        }
        const stateData = { [layer.state]: "DELETE_PENDING", [layer.until]: now }
        if (layerName === "rag") stateData.ragIngestStatus = "RETENTION_BLOCKED"
        await tx.materialSubmission.updateMany({
          where: { id: current.id, [layer.state]: "SCHEDULED" },
          data: stateData
        })
        await audit({
          db: tx,
          action: `MATERIAL_${layerName.toUpperCase()}_RETENTION_DELETE_QUEUED`,
          resourceType: "MaterialSubmission",
          resourceId: current.id,
          targetUserId: current.submittedByUserId,
          meta: { retentionClass: current[layer.retentionClass], retentionUntil: current[layer.until], jobId: job.id }
        })
      }
    })
  }
  return { queued, queuedByLayer }
}

async function claimNextMaterialJob({ db, now, jobId = null, staleMs = 5 * 60_000 }) {
  const staleBefore = new Date(now.getTime() - staleMs)
  const candidate = await db.dataDeletionJob.findFirst({
    where: {
      action: { in: JOB_ACTIONS },
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

async function finishMissingOrDeleted(job, { db }) {
  await db.dataDeletionJob.updateMany({
    where: { id: job.id, claimToken: job.claimToken },
    data: {
      status: "done",
      attempts: { increment: 1 },
      lastError: null,
      lastErrorCode: null,
      nextAttemptAt: null,
      storagePath: null,
      externalRef: null,
      claimToken: null,
      claimedAt: null
    }
  })
  return { status: "done", replay: true, jobId: job.id }
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
  const layerEntry = layerByAction(job.action)
  if (!layerEntry) return finishMissingOrDeleted(job, { db })
  const [layerName, layer] = layerEntry
  const submission = await db.materialSubmission.findUnique({ where: { id: job.resourceId } })
  if (!submission || ["DELETED", "NOT_PRESENT"].includes(submission[layer.state])) {
    return finishMissingOrDeleted(job, { db })
  }

  if (layerName === "rag") {
    try {
      if (job.externalRef && submission.ragRemovalStatus !== "DONE") {
        const { queueMaterialRagDeletion, retryMaterialRagDeletion } = await import("./ragLifecycle.js")
        const queued = await queueMaterialRagDeletion({ submission, reason: "retention_expired" }, { db, audit, now: () => now })
        const ragJob = await retryMaterialRagDeletion({ jobId: queued.job.id }, { db, audit, now: () => now, ...ragDependencies })
        if (ragJob.status !== "done") throw Object.assign(new Error("material_rag_delete_failed"), { code: "material_rag_delete_failed" })
      }
    } catch (error) {
      await markJobFailure(job, code(error, "material_rag_delete_failed"), { db, now })
      return { status: "failed", stage: "rag", layer: layerName, jobId: job.id }
    }
  } else {
    try {
      if (job.storagePath) await files.remove(job.storagePath)
    } catch (error) {
      await markJobFailure(job, code(error, "material_file_delete_failed"), { db, now })
      return { status: "failed", stage: "file", layer: layerName, jobId: job.id }
    }
  }

  try {
    await beforeFinalize({ job, submission, layer: layerName })
    await db.$transaction(async tx => {
      await advisoryLock(tx, `material-retention:${submission.id}`)
      const data = layerName === "original"
        ? { storagePath: null, storageStatus: "RETENTION_DELETED", originalRetentionState: "DELETED", originalDeletedAt: now }
        : layerName === "derivative"
          ? { derivativeStoragePath: null, derivativeRetentionState: "DELETED", derivativeDeletedAt: now }
          : { ragRetentionState: "DELETED", ragDeletedAt: now, ragIngestStatus: "DELETED", ragRemovalStatus: "DONE" }
      const changed = await tx.materialSubmission.updateMany({
        where: { id: submission.id, [layer.state]: "DELETE_PENDING" },
        data
      })
      if (changed.count !== 1) throw Object.assign(new Error("material_retention_finalize_conflict"), { code: "material_retention_finalize_conflict" })
      await audit({
        db: tx,
        action: `MATERIAL_${layerName.toUpperCase()}_RETENTION_DELETED`,
        resourceType: "MaterialSubmission",
        resourceId: submission.id,
        targetUserId: submission.submittedByUserId,
        meta: { retentionClass: submission[layer.retentionClass], retentionUntil: submission[layer.until] }
      })
      await tx.dataDeletionJob.updateMany({ where: { id: job.id, claimToken: job.claimToken }, data: {
        status: "done",
        attempts: { increment: 1 },
        lastError: null,
        lastErrorCode: null,
        nextAttemptAt: null,
        storagePath: null,
        externalRef: null,
        claimToken: null,
        claimedAt: null
      } })
    })
    return { status: "done", layer: layerName, jobId: job.id }
  } catch (error) {
    await markJobFailure(job, code(error, "material_db_finalize_failed"), { db, now })
    return { status: "failed", stage: "database", layer: layerName, jobId: job.id }
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

async function forceMaterialLayersDue(submission, reason, { db, now, audit }) {
  await db.$transaction(async tx => {
    await advisoryLock(tx, `material-retention:${submission.id}`)
    const current = await tx.materialSubmission.findUnique({ where: { id: submission.id } })
    if (!current) return
    const data = {}
    for (const [layerName, layer] of Object.entries(LAYERS)) {
      const present = layerName === "original"
        ? Boolean(current.storagePath)
        : layerName === "derivative"
          ? Boolean(current.derivativeStoragePath)
          : Boolean(current.ragDocId) && current.ragRetentionState !== "DELETED"
      if (present) {
        data[layer.state] = "SCHEDULED"
        data[layer.until] = now
      }
    }
    if (Object.keys(data).length) await tx.materialSubmission.update({ where: { id: current.id }, data })
    await audit({
      db: tx,
      action: "MATERIAL_EARLY_DELETION_REQUESTED",
      resourceType: "MaterialSubmission",
      resourceId: current.id,
      targetUserId: current.submittedByUserId,
      meta: { reason }
    })
  })
}

async function removeMaterialLayers(submission, context = {}, dependencies = {}, reason) {
  const db = dependencies.db || prisma
  const audit = dependencies.audit || writeDataAudit
  const now = dependencies.now || new Date()
  if (!submission?.id) return { ok: true, skipped: true }
  await forceMaterialLayersDue(submission, reason, { db, now, audit })
  await scheduleDueMaterialRetention({ db, now, submissionId: submission.id, audit })
  const jobs = await db.dataDeletionJob.findMany({
    where: { action: { in: JOB_ACTIONS }, resourceType: "MaterialSubmission", resourceId: submission.id, status: { in: ["pending", "processing", "failed"] } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  })
  const outcomes = []
  for (const job of jobs) {
    if (job.status === "failed" && job.nextAttemptAt > now) {
      await db.dataDeletionJob.update({ where: { id: job.id }, data: { nextAttemptAt: now } })
    }
    outcomes.push(await processNextMaterialRetentionJob({
      db,
      now,
      jobId: job.id,
      files: dependencies.files || { remove: deleteStoredMaterial },
      ragDependencies: dependencies.ragDependencies || {},
      audit
    }))
  }
  return {
    ok: outcomes.every(outcome => outcome?.status === "done"),
    outcomes,
    actorUserId: context.actorUserId || null
  }
}

export function removeMaterialForWithdrawal(submission, context = {}, dependencies = {}) {
  return removeMaterialLayers(submission, context, dependencies, "withdrawal")
}

export function removeMaterialForAccountDeletion(submission, context = {}, dependencies = {}) {
  return removeMaterialLayers(submission, context, dependencies, "account_delete")
}

// Backwards-compatible symbol for callers/tests that only need to identify material jobs.
export const MATERIAL_RETENTION_DELETE_ACTION = MATERIAL_ORIGINAL_RETENTION_DELETE_ACTION
