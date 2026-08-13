import crypto from "node:crypto"

import prisma from "@/lib/prisma"
import { withStorageQuota } from "@/lib/documents/storageQuota"
import { descendingCursorWhere, decodePageCursor, normalizePageSize, toCursorPage } from "@/lib/org/pagination"
import { getUtcDayStart } from "@/lib/storageGuardrails"
import { writeDataAudit } from "@/lib/privacy/audit"
import { serializeMaterialSubmission } from "./submissions.js"
import {
  deleteStoredMaterial,
  ensureMaterialsStorage,
  getStoredMaterialPath,
  publishStoredMaterial,
  storedMaterialExists,
  writeMaterialBuffer
} from "./server.js"

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$/u
const FILE_ACTION = Object.freeze({
  STAGE: "MATERIAL_FILE_STAGE",
  PUBLISH: "MATERIAL_FILE_PUBLISH",
  DELETE: "MATERIAL_FILE_DELETE"
})
const FILE_ACTIONS = Object.freeze(Object.values(FILE_ACTION))
const REVIEW_STATUSES = new Set(["pending", "reviewed", "rejected", "imported"])

function materialError(message, status, extra = null) {
  const error = new Error(message)
  error.status = status
  if (extra) Object.assign(error, extra)
  return error
}

export function normalizeMaterialIdempotencyKey(value) {
  const key = String(value || "").trim()
  if (!IDEMPOTENCY_KEY_RE.test(key)) throw materialError("materials_page.errors.idempotency_key_invalid", 400)
  return key
}

export function buildMaterialRequestHash({ comment = "", files = [] } = {}) {
  const canonical = JSON.stringify({
    comment: String(comment || ""),
    files: files.map((file) => ({
      name: String(file.originalName || "material"),
      mime: String(file.mime || ""),
      size: Number(file.size || file.buffer?.byteLength || 0),
      sha256: String(file.sha256 || "")
    }))
  })
  return crypto.createHash("sha256").update(canonical).digest("hex")
}

const defaultFiles = Object.freeze({
  write: writeMaterialBuffer,
  publish: publishStoredMaterial,
  remove: deleteStoredMaterial,
  exists: storedMaterialExists
})

function includeSubmitter() {
  return { submittedByUser: { select: { id: true, email: true } } }
}

export async function listMaterialSubmissions(
  { userId, admin = false, cursor = null, limit = 100, status = null } = {},
  { db = prisma } = {}
) {
  const ownerId = String(userId || "").trim()
  if (!ownerId) throw materialError("api.common.unauthorized", 401)
  const pageSize = normalizePageSize(limit, 100, 200)
  const decoded = decodePageCursor(cursor, { dateKeys: ["createdAt"], stringKeys: ["id"] })
  const normalizedStatus = String(status || "").trim().toLowerCase()
  if (normalizedStatus && !REVIEW_STATUSES.has(normalizedStatus)) {
    throw materialError("materials_page.errors.status_invalid", 400)
  }
  const scope = {
    storageStatus: { in: ["ACTIVE", "DELETE_PENDING"] },
    ...(!admin ? { submittedByUserId: ownerId } : {}),
    ...(normalizedStatus ? { status: normalizedStatus } : {}),
    ...(decoded ? descendingCursorWhere(decoded, ["createdAt", "id"]) : {})
  }
  const countScope = {
    storageStatus: { in: ["ACTIVE", "DELETE_PENDING"] },
    ...(!admin ? { submittedByUserId: ownerId } : {}),
    ...(normalizedStatus ? { status: normalizedStatus } : {})
  }
  const [rows, total, grouped] = await Promise.all([
    db.materialSubmission.findMany({
      where: scope,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: pageSize + 1,
      include: includeSubmitter()
    }),
    db.materialSubmission.count({ where: countScope }),
    db.materialSubmission.groupBy({
      by: ["status"],
      where: {
        storageStatus: { in: ["ACTIVE", "DELETE_PENDING"] },
        ...(!admin ? { submittedByUserId: ownerId } : {})
      },
      _count: { _all: true }
    })
  ])
  const page = toCursorPage(rows, pageSize, (row) => ({ createdAt: row.createdAt, id: row.id }))
  return {
    submissions: page.items.map(serializeMaterialSubmission),
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
    total,
    counts: Object.fromEntries(grouped.map((row) => [row.status, row._count._all]))
  }
}

async function claimBatch({ userId, idempotencyKey, requestHash, files, now, rateLimit, windowMs }, db) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId})::bigint)`
    const existing = await tx.materialSubmissionBatch.findUnique({
      where: { submittedByUserId_idempotencyKey: { submittedByUserId: userId, idempotencyKey } }
    })
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw materialError("materials_page.errors.idempotency_conflict", 409)
      }
      const jobs = await tx.dataDeletionJob.findMany({
        where: {
          action: { in: [FILE_ACTION.STAGE, FILE_ACTION.PUBLISH] },
          resourceType: "MaterialSubmission",
          externalRef: { startsWith: `${existing.id}:` }
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
      })
      return { batch: existing, jobs, replay: true }
    }

    const recent = await tx.materialSubmissionBatch.count({
      where: { submittedByUserId: userId, createdAt: { gte: new Date(now.getTime() - windowMs) } }
    })
    if (recent >= rateLimit) throw materialError("api.common.too_many_requests", 429)

    const batch = await tx.materialSubmissionBatch.create({
      data: { submittedByUserId: userId, idempotencyKey, requestHash, createdAt: now, updatedAt: now }
    })
    const jobs = []
    for (const [index, file] of files.entries()) {
      const finalPath = getStoredMaterialPath(file.originalName)
      const stagingPath = `${finalPath}.material-staged-${crypto.randomUUID()}`
      jobs.push(await tx.dataDeletionJob.create({
        data: {
          actorUserId: userId,
          targetUserId: userId,
          action: FILE_ACTION.STAGE,
          resourceType: "MaterialSubmission",
          resourceId: null,
          storagePath: stagingPath,
          externalRef: `${batch.id}:${index}:${finalPath}`,
          status: "pending",
          attempts: 0,
          createdAt: now,
          updatedAt: now
        }
      }))
    }
    return { batch, jobs, replay: false }
  })
}

function finalPathFromJob(job) {
  const parts = String(job.externalRef || "").split(":")
  return parts.slice(2).join(":")
}

export async function reconcileMaterialFileJobs(
  { batchId = null, jobId = null } = {},
  { db = prisma, files = defaultFiles, audit = writeDataAudit } = {}
) {
  const jobs = await db.dataDeletionJob.findMany({
    where: {
      action: { in: FILE_ACTIONS },
      status: { in: ["pending", "failed"] },
      ...(jobId ? { id: jobId } : {}),
      ...(batchId ? { externalRef: { startsWith: `${batchId}:` } } : {})
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  })
  const outcomes = []
  for (const job of jobs) {
    try {
      if (job.action === FILE_ACTION.STAGE) {
        await files.remove(job.storagePath)
        await db.dataDeletionJob.update({
          where: { id: job.id },
          data: { status: "done", attempts: { increment: 1 }, lastError: null }
        })
      } else if (job.action === FILE_ACTION.PUBLISH) {
        const submission = job.resourceId
          ? await db.materialSubmission.findUnique({ where: { id: job.resourceId } })
          : null
        if (!submission) throw new Error("material_submission_missing_for_publish")
        const finalPath = finalPathFromJob(job)
        if (!(await files.exists(finalPath))) {
          if (!(await files.exists(job.storagePath))) throw new Error("material_file_missing_both_paths")
          await files.publish(job.storagePath, finalPath)
        }
        await db.$transaction(async (tx) => {
          await tx.materialSubmission.updateMany({
            where: { id: submission.id, storageStatus: "PENDING_PUBLISH" },
            data: { storageStatus: "ACTIVE", storagePath: finalPath }
          })
          await tx.dataDeletionJob.update({
            where: { id: job.id },
            data: { status: "done", attempts: { increment: 1 }, lastError: null }
          })
        })
      } else {
        const submission = job.resourceId
          ? await db.materialSubmission.findUnique({ where: { id: job.resourceId } })
          : null
        await files.remove(job.storagePath)
        await db.$transaction(async (tx) => {
          if (submission) {
            await audit({
              db: tx,
              actorUserId: job.actorUserId || job.targetUserId,
              targetUserId: submission.submittedByUserId,
              action: "MATERIAL_SUBMISSION_DELETED",
              resourceType: "MaterialSubmission",
              resourceId: submission.id,
              meta: { status: submission.status, sha256: submission.sha256 }
            })
            await tx.materialSubmission.deleteMany({ where: { id: submission.id, storageStatus: "DELETE_PENDING" } })
          }
          await tx.dataDeletionJob.update({
            where: { id: job.id },
            data: { status: "done", attempts: { increment: 1 }, lastError: null }
          })
        })
      }
      outcomes.push({ jobId: job.id, status: "done" })
    } catch (error) {
      await db.dataDeletionJob.update({
        where: { id: job.id },
        data: { status: "failed", attempts: { increment: 1 }, lastError: String(error?.message || "material_file_job_failed").slice(0, 500) }
      }).catch(() => {})
      outcomes.push({ jobId: job.id, status: "failed" })
    }
  }

  if (batchId) {
    const [pending, total] = await Promise.all([
      db.materialSubmission.count({ where: { batchId, storageStatus: { not: "ACTIVE" } } }),
      db.materialSubmission.count({ where: { batchId } })
    ])
    if (total > 0 && pending === 0) {
      await db.materialSubmissionBatch.updateMany({ where: { id: batchId }, data: { status: "COMMITTED" } })
    }
  }
  return outcomes
}

export async function createMaterialSubmissions(
  { userId, role, idempotencyKey, comment, files, rateLimit = 8, windowMs = 15 * 60_000 } = {},
  { db = prisma, quota = withStorageQuota, fileOps = defaultFiles, now = new Date() } = {}
) {
  const ownerId = String(userId || "").trim()
  if (!ownerId) throw materialError("api.common.unauthorized", 401)
  const key = normalizeMaterialIdempotencyKey(idempotencyKey)
  const requestHash = buildMaterialRequestHash({ comment, files })
  const claim = await claimBatch({ userId: ownerId, idempotencyKey: key, requestHash, files, now, rateLimit, windowMs }, db)

  let existing = await db.materialSubmission.findMany({
    where: { batchId: claim.batch.id }, orderBy: { createdAt: "asc" }, include: includeSubmitter()
  })
  if (existing.length) {
    await reconcileMaterialFileJobs({ batchId: claim.batch.id }, { db, files: fileOps })
    existing = await db.materialSubmission.findMany({
      where: { batchId: claim.batch.id, storageStatus: "ACTIVE" }, orderBy: { createdAt: "asc" }, include: includeSubmitter()
    })
    if (existing.length === files.length) return { replay: true, submissions: existing.map(serializeMaterialSubmission) }
  }

  if (claim.replay && ["PREPARING", "COMMITTING"].includes(claim.batch.status)) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50))
      const batch = await db.materialSubmissionBatch.findUnique({ where: { id: claim.batch.id } })
      existing = await db.materialSubmission.findMany({
        where: { batchId: claim.batch.id, storageStatus: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        include: includeSubmitter()
      })
      if (batch?.status === "COMMITTED" && existing.length === files.length) {
        return { replay: true, submissions: existing.map(serializeMaterialSubmission) }
      }
      if (batch?.status === "FAILED") break
    }
    const refreshed = await db.materialSubmissionBatch.findUnique({ where: { id: claim.batch.id } })
    if (refreshed?.status !== "FAILED") {
      throw materialError("materials_page.errors.idempotency_in_progress", 409)
    }
  }

  await ensureMaterialsStorage()
  try {
    for (const [index, file] of files.entries()) {
      const job = claim.jobs[index]
      if (!job) throw materialError("materials_page.errors.upload_failed", 503)
      await fileOps.write(job.storagePath, file.buffer)
    }
  } catch (error) {
    await reconcileMaterialFileJobs({ batchId: claim.batch.id }, { db, files: fileOps }).catch(() => {})
    await db.materialSubmissionBatch.updateMany({
      where: { id: claim.batch.id, status: "PREPARING" }, data: { status: "FAILED" }
    }).catch(() => {})
    throw error
  }

  const totalBytes = files.reduce((sum, file) => sum + Number(file.size || file.buffer?.byteLength || 0), 0)
  let created
  try {
    created = await quota(
      { userId: ownerId, role, addBytes: totalBytes, dailyAddBytes: totalBytes, dayStart: getUtcDayStart(now) },
      { db },
      async (tx) => {
        const rows = []
        for (const [index, file] of files.entries()) {
          const duplicate = await tx.materialSubmission.findFirst({
            where: { sha256: file.sha256, storageStatus: "ACTIVE" },
            select: { id: true },
            orderBy: { createdAt: "asc" }
          })
          const row = await tx.materialSubmission.create({
            data: {
              submittedByUserId: ownerId,
              batchId: claim.batch.id,
              comment,
              originalName: file.originalName,
              mime: file.mime,
              size: file.size,
              sha256: file.sha256,
              storagePath: finalPathFromJob(claim.jobs[index]),
              storageStatus: "PENDING_PUBLISH",
              duplicateOfId: duplicate?.id || null
            },
            include: includeSubmitter()
          })
          await tx.dataDeletionJob.update({
            where: { id: claim.jobs[index].id },
            data: { action: FILE_ACTION.PUBLISH, resourceId: row.id, status: "pending", lastError: null }
          })
          rows.push(row)
        }
        await tx.materialSubmissionBatch.update({ where: { id: claim.batch.id }, data: { status: "COMMITTING" } })
        return rows
      }
    )
  } catch (error) {
    await reconcileMaterialFileJobs({ batchId: claim.batch.id }, { db, files: fileOps }).catch(() => {})
    await db.materialSubmissionBatch.updateMany({
      where: { id: claim.batch.id, status: "PREPARING" },
      data: { status: "FAILED" }
    }).catch(() => {})
    throw error
  }

  const outcomes = await reconcileMaterialFileJobs({ batchId: claim.batch.id }, { db, files: fileOps })
  if (outcomes.some((item) => item.status !== "done")) throw materialError("materials_page.errors.file_pending", 503)
  const active = await db.materialSubmission.findMany({
    where: { id: { in: created.map((row) => row.id) }, storageStatus: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    include: includeSubmitter()
  })
  return { replay: false, submissions: active.map(serializeMaterialSubmission) }
}

export async function requestMaterialSubmissionDeletion(
  { id, userId, admin = false } = {},
  { db = prisma, files = defaultFiles, audit = writeDataAudit, now = new Date() } = {}
) {
  const submissionId = String(id || "").trim()
  const actorId = String(userId || "").trim()
  if (!submissionId || !actorId) throw materialError("api.common.not_found", 404)
  const submission = await db.materialSubmission.findFirst({
    where: { id: submissionId, ...(!admin ? { submittedByUserId: actorId } : {}) }
  })
  if (!submission) {
    const completed = await db.dataDeletionJob.findFirst({
      where: { action: FILE_ACTION.DELETE, resourceType: "MaterialSubmission", resourceId: submissionId, status: "done", ...(!admin ? { targetUserId: actorId } : {}) }
    })
    if (completed) return { deleted: true, replay: true }
    throw materialError("api.common.not_found", 404)
  }
  if (submission.status === "imported") throw materialError("materials_page.errors.imported_terminal", 409)
  if (!admin && !["pending", "rejected"].includes(submission.status)) {
    throw materialError("materials_page.errors.withdraw_not_allowed", 409)
  }
  let job
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${submissionId})::bigint)`
    job = await tx.dataDeletionJob.findFirst({
      where: { action: FILE_ACTION.DELETE, resourceType: "MaterialSubmission", resourceId: submissionId, status: { in: ["pending", "failed", "done"] } }
    })
    if (!job) {
      await tx.materialSubmission.updateMany({ where: { id: submissionId }, data: { storageStatus: "DELETE_PENDING" } })
      job = await tx.dataDeletionJob.create({
        data: {
          actorUserId: actorId,
          targetUserId: submission.submittedByUserId,
          action: FILE_ACTION.DELETE,
          resourceType: "MaterialSubmission",
          resourceId: submissionId,
          storagePath: submission.storagePath,
          status: "pending",
          attempts: 0,
          createdAt: now,
          updatedAt: now
        }
      })
    }
  })
  if (job.status !== "done") {
    const [outcome] = await reconcileMaterialFileJobs({ jobId: job.id }, { db, files, audit })
    if (outcome?.status !== "done") throw materialError("materials_page.errors.delete_pending", 503)
  }
  return { deleted: true, replay: job.status === "done" }
}

export async function getMaterialSubmissionDownload({ id, userId, admin = false } = {}, { db = prisma } = {}) {
  const submission = await db.materialSubmission.findFirst({
    where: {
      id: String(id || "").trim(),
      storageStatus: "ACTIVE",
      ...(!admin ? { submittedByUserId: String(userId || "").trim() } : {})
    }
  })
  if (!submission) throw materialError("api.common.not_found", 404)
  return submission
}
