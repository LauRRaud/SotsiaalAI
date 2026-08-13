#!/usr/bin/env node
/** SOL-MAT-03/04/05/06/07 — restart, quota race, idempotency, ownership and cursor in real PostgreSQL. */

import { spawnSync } from "node:child_process"
import { randomUUID, createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"
import pg from "pg"

import {
  retentionFieldsForImportedLayers,
  retentionFieldsForQuarantine,
  retentionFieldsForSubmission
} from "../lib/materials/retentionPolicy.js"

dotenv.config({ path: ".env.local", quiet: true })
dotenv.config({ path: ".env", quiet: true })

const sourceUrl = String(process.env.DATABASE_URL || "").trim()
if (!sourceUrl) throw new Error("DATABASE_URL is required")
const parsed = new URL(sourceUrl)
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname)) {
  throw new Error("Material lifecycle probe only creates a temporary database on localhost")
}

const databaseName = `sotsiaal_ai_material_probe_${Date.now()}`
if (!/^sotsiaal_ai_material_probe_\d+$/u.test(databaseName)) throw new Error("unsafe probe database name")
const adminUrl = new URL(parsed)
adminUrl.pathname = "/postgres"
adminUrl.search = ""
const probeUrl = new URL(parsed)
probeUrl.pathname = `/${databaseName}`
const admin = new pg.Client({ connectionString: adminUrl.toString() })
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url))
let passed = 0

function expect(label, condition, detail = "") {
  if (!condition) throw new Error(`PROBE_FAIL ${label}${detail ? ` — ${detail}` : ""}`)
  passed += 1
  console.log(`  PASS  ${label}`)
}

function migrate() {
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: probeUrl.toString() },
    stdio: "inherit",
    shell: false
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`prisma migrate deploy failed (${result.status})`)
}

await admin.connect()
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`)
  process.env.DATABASE_URL = probeUrl.toString()
  migrate()

  const [{ default: prisma }, lifecycle, reviewModule, quotaModule, usageModule] = await Promise.all([
    import("../lib/prisma.js"),
    import("../lib/materials/lifecycle.js"),
    import("../lib/materials/review.js"),
    import("../lib/documents/storageQuota.js"),
    import("../lib/storageUsage.js")
  ])
  const {
    createMaterialSubmissions: createMaterialSubmissionsRaw,
    getMaterialSubmissionDownload,
    listMaterialSubmissions,
    reconcileMaterialFileJobs,
    requestMaterialSubmissionDeletion
  } = lifecycle
  const { reviewMaterialSubmission } = reviewModule
  const { withStorageQuota } = quotaModule
  const { getUserStorageUsageBytes } = usageModule
  const store = new Map()
  const fileOps = {
    async write(path, buffer) { store.set(path, Buffer.from(buffer)) },
    async publish(staging, finalPath) {
      if (store.has(finalPath)) return
      if (!store.has(staging)) throw new Error("probe_staging_missing")
      store.set(finalPath, store.get(staging))
      store.delete(staging)
    },
    async remove(path) { store.delete(path) },
    async exists(path) { return store.has(path) }
  }
  async function createMaterialSubmissions(input, options = {}) {
    for (const file of input.files || []) {
      if (file.quarantineReceiptId) continue
      const quarantinePath = `quarantine/${randomUUID()}`
      store.set(quarantinePath, Buffer.from(file.buffer))
      const scannedAt = new Date()
      const receipt = await prisma.materialUploadQuarantine.create({ data: {
        submittedByUserId: input.userId,
        declaredMime: file.mime,
        size: file.size,
        sha256: file.sha256,
        quarantinePath,
        storageState: "QUARANTINED",
        scanState: "CLEAN",
        validationState: "VALIDATED",
        scannedAt,
        engine: "ProbeClamAV",
        engineVersion: "probe",
        signatureVersion: "probe",
        signatureUpdatedAt: scannedAt,
        ...retentionFieldsForQuarantine({ scanState: "CLEAN" }, scannedAt)
      } })
      Object.assign(file, {
        quarantineReceiptId: receipt.id,
        scanState: "CLEAN",
        validationState: "VALIDATED",
        scannedAt,
        scanEngine: receipt.engine,
        scanEngineVersion: receipt.engineVersion,
        scanSignatureVersion: receipt.signatureVersion,
        scanSignatureUpdatedAt: receipt.signatureUpdatedAt
      })
    }
    return createMaterialSubmissionsRaw(input, { ...options, quarantineFiles: { remove: fileOps.remove } })
  }
  const owner = await prisma.user.create({ data: { email: `owner-${randomUUID()}@sol-mat.invalid`, role: "SOCIAL_WORKER" } })
  const stranger = await prisma.user.create({ data: { email: `stranger-${randomUUID()}@sol-mat.invalid`, role: "SOCIAL_WORKER" } })
  const makeFile = (name, bytes = 1000) => {
    const buffer = Buffer.alloc(bytes, name.charCodeAt(0) || 1)
    const sanitizedBuffer = Buffer.from("x")
    return {
      originalName: `${name}.txt`,
      mime: "text/plain",
      size: buffer.byteLength,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      buffer,
      sanitizedBuffer,
      sanitizedSha256: createHash("sha256").update(sanitizedBuffer).digest("hex"),
      sanitizedMime: "text/plain; charset=utf-8",
      sanitizationVersion: "synthetic-probe-v1"
    }
  }
  const forcedQuota = (input, options, write) => withStorageQuota(
    { ...input, quotaBytes: 2002, dailyQuotaBytes: 100_000 }, options, write
  )

  const parallel = await Promise.allSettled(Array.from({ length: 4 }, (_, index) => createMaterialSubmissions({
    userId: owner.id,
    role: "SOCIAL_WORKER",
    idempotencyKey: `probe-race-${index}-${randomUUID()}`,
    comment: "race",
    files: [makeFile(`r${index}`)]
  }, { db: prisma, quota: forcedQuota, fileOps })))
  const won = parallel.filter((result) => result.status === "fulfilled").length
  const rejected = parallel.filter((result) => result.status === "rejected" && result.reason?.status === 413).length
  const usage = await getUserStorageUsageBytes(owner.id, { db: prisma })
  expect("four parallel uploads reserve exactly two quota slots", won === 2 && rejected === 2, `won=${won} 413=${rejected}`)
  expect("parallel uploads never exceed the quota", usage.materialBytes === 2000, `bytes=${usage.materialBytes}`)

  const idemOwner = await prisma.user.create({ data: { email: `idem-${randomUUID()}@sol-mat.invalid`, role: "SOCIAL_WORKER" } })
  const key = `probe-idempotency-${randomUUID()}`
  const input = { userId: idemOwner.id, role: "SOCIAL_WORKER", idempotencyKey: key, comment: "same", files: [makeFile("idem", 20)] }
  const first = await createMaterialSubmissions(input, { db: prisma, fileOps })
  const replay = await createMaterialSubmissions(input, { db: prisma, fileOps })
  expect("same idempotency key returns the same stored result", replay.replay && first.submissions[0].id === replay.submissions[0].id)
  const conflict = await Promise.allSettled([createMaterialSubmissions({ ...input, comment: "changed" }, { db: prisma, fileOps })])
  expect("same key with a changed payload returns 409", conflict[0].status === "rejected" && conflict[0].reason?.status === 409)
  const duplicate = await createMaterialSubmissions({ ...input, files: [makeFile("idem", 20)], idempotencyKey: `probe-duplicate-${randomUUID()}` }, { db: prisma, fileOps })
  expect("duplicate hash is surfaced", duplicate.submissions[0].duplicateOfId === first.submissions[0].id)

  const concurrentOwner = await prisma.user.create({ data: { email: `concurrent-${randomUUID()}@sol-mat.invalid`, role: "SOCIAL_WORKER" } })
  const concurrentInput = {
    userId: concurrentOwner.id,
    role: "SOCIAL_WORKER",
    idempotencyKey: `probe-same-key-${randomUUID()}`,
    comment: "one logical request",
    files: [makeFile("same-key", 25)]
  }
  const sameKey = await Promise.all(Array.from({ length: 4 }, () => createMaterialSubmissions(concurrentInput, { db: prisma, fileOps })))
  expect("four concurrent replays converge on one result", new Set(sameKey.map((row) => row.submissions[0].id)).size === 1)
  expect("concurrent idempotency creates one database row", (await prisma.materialSubmission.count({ where: { submittedByUserId: concurrentOwner.id } })) === 1)

  const failOwner = await prisma.user.create({ data: { email: `restart-${randomUUID()}@sol-mat.invalid`, role: "SOCIAL_WORKER" } })
  const failingOps = { ...fileOps, async publish() { throw new Error("probe_publish_failure") } }
  const interrupted = await Promise.allSettled([createMaterialSubmissions({
    userId: failOwner.id,
    role: "SOCIAL_WORKER",
    idempotencyKey: `probe-restart-${randomUUID()}`,
    comment: "restart",
    files: [makeFile("restart", 30)]
  }, { db: prisma, fileOps: failingOps })])
  expect("publish failure is reported instead of false success", interrupted[0].status === "rejected" && interrupted[0].reason?.status === 503)
  const pending = await prisma.materialSubmission.findFirst({ where: { submittedByUserId: failOwner.id } })
  expect("interrupted upload remains durably pending", pending?.storageStatus === "PENDING_PUBLISH")
  await reconcileMaterialFileJobs({ batchId: pending.batchId }, { db: prisma, files: fileOps })
  const recovered = await prisma.materialSubmission.findUnique({ where: { id: pending.id } })
  expect("restart reconciliation publishes the pending file", recovered?.storageStatus === "ACTIVE" && store.has(recovered.storagePath))

  const writeFailOwner = await prisma.user.create({ data: { email: `write-fail-${randomUUID()}@sol-mat.invalid`, role: "SOCIAL_WORKER" } })
  let writes = 0
  const writeFailOps = {
    ...fileOps,
    async write(path, buffer) {
      writes += 1
      if (writes === 2) throw new Error("probe_second_write_failure")
      await fileOps.write(path, buffer)
    }
  }
  const writeFailed = await Promise.allSettled([createMaterialSubmissions({
    userId: writeFailOwner.id,
    role: "SOCIAL_WORKER",
    idempotencyKey: `probe-write-fail-${randomUUID()}`,
    comment: "two files",
    files: [makeFile("write-a", 10), makeFile("write-b", 10)]
  }, { db: prisma, fileOps: writeFailOps })])
  const writeFailBatch = await prisma.materialSubmissionBatch.findFirst({ where: { submittedByUserId: writeFailOwner.id } })
  const writeFailJobs = await prisma.dataDeletionJob.findMany({ where: { externalRef: { startsWith: `${writeFailBatch.id}:` } } })
  expect("mid-batch file failure reports failure and creates no submissions", writeFailed[0].status === "rejected" && (await prisma.materialSubmission.count({ where: { submittedByUserId: writeFailOwner.id } })) === 0)
  expect("mid-batch file failure leaves only durable completed cleanup jobs", writeFailBatch.status === "FAILED" && writeFailJobs.every((job) => job.status === "done" && !store.has(job.storagePath)))

  const dbFailOwner = await prisma.user.create({ data: { email: `db-fail-${randomUUID()}@sol-mat.invalid`, role: "SOCIAL_WORKER" } })
  const dbFailed = await Promise.allSettled([createMaterialSubmissions({
    userId: dbFailOwner.id,
    role: "SOCIAL_WORKER",
    idempotencyKey: `probe-db-fail-${randomUUID()}`,
    comment: "db fail",
    files: [makeFile("db-fail", 10)]
  }, { db: prisma, fileOps, quota: async () => { throw new Error("probe_db_transaction_failure") } })])
  const dbFailBatch = await prisma.materialSubmissionBatch.findFirst({ where: { submittedByUserId: dbFailOwner.id } })
  const dbFailJobs = await prisma.dataDeletionJob.findMany({ where: { externalRef: { startsWith: `${dbFailBatch.id}:` } } })
  expect("database transaction failure creates no submission rows", dbFailed[0].status === "rejected" && (await prisma.materialSubmission.count({ where: { submittedByUserId: dbFailOwner.id } })) === 0)
  expect("database transaction failure removes every staged file", dbFailBatch.status === "FAILED" && dbFailJobs.every((job) => job.status === "done" && !store.has(job.storagePath)))

  const reviewOwner = await prisma.user.create({ data: { email: `review-${randomUUID()}@sol-mat.invalid`, role: "SOCIAL_WORKER" } })
  const reviewAdminA = await prisma.user.create({ data: { email: `review-admin-a-${randomUUID()}@sol-mat.invalid`, role: "ADMIN" } })
  const reviewAdminB = await prisma.user.create({ data: { email: `review-admin-b-${randomUUID()}@sol-mat.invalid`, role: "ADMIN" } })
  const reviewCreated = await createMaterialSubmissions({
    userId: reviewOwner.id,
    role: "SOCIAL_WORKER",
    idempotencyKey: `probe-review-${randomUUID()}`,
    comment: "review race",
    files: [makeFile("review-race", 20)]
  }, { db: prisma, fileOps })
  const reviewId = reviewCreated.submissions[0].id
  const reviewRace = await Promise.allSettled([
    reviewMaterialSubmission({ id: reviewId, action: "mark_reviewed", expectedRevision: 0, reviewedBy: reviewAdminA.email, actorUserId: reviewAdminA.id }, { db: prisma }),
    reviewMaterialSubmission({ id: reviewId, action: "reject", expectedRevision: 0, reviewedBy: reviewAdminB.email, reviewNote: "not suitable", actorUserId: reviewAdminB.id }, { db: prisma })
  ])
  const reviewWon = reviewRace.filter((row) => row.status === "fulfilled").length
  const reviewLost = reviewRace.filter((row) => row.status === "rejected" && row.reason?.status === 409).length
  const reviewed = await prisma.materialSubmission.findUnique({ where: { id: reviewId } })
  const reviewRaceDetail = reviewRace.map((row) => row.status === "fulfilled"
    ? `fulfilled:${row.value.status}`
    : `rejected:${row.reason?.status || row.reason?.code}:${row.reason?.message}:${row.reason?.current?.status || "no-current"}`).join(", ")
  expect("two concurrent review actions have exactly one CAS winner", reviewWon === 1 && reviewLost === 1, reviewRaceDetail)
  expect("review winner increments revision exactly once", reviewed.reviewRevision === 1)
  expect("review transition and audit commit together", (await prisma.dataAuditLog.count({ where: { resourceId: reviewId, action: { startsWith: "MATERIAL_REVIEW_" } } })) === 1)

  const rollbackOwner = await prisma.user.create({ data: { email: `review-rollback-${randomUUID()}@sol-mat.invalid`, role: "SOCIAL_WORKER" } })
  const rollbackCreated = await createMaterialSubmissions({
    userId: rollbackOwner.id,
    role: "SOCIAL_WORKER",
    idempotencyKey: `probe-review-rollback-${randomUUID()}`,
    comment: "review rollback",
    files: [makeFile("review-rollback", 20)]
  }, { db: prisma, fileOps })
  const rollbackId = rollbackCreated.submissions[0].id
  const auditFailed = await Promise.allSettled([reviewMaterialSubmission(
    { id: rollbackId, action: "mark_reviewed", expectedRevision: 0, reviewedBy: reviewAdminA.email, actorUserId: reviewAdminA.id },
    { db: prisma, audit: async () => { throw new Error("probe_review_audit_failure") } }
  )])
  const rolledBack = await prisma.materialSubmission.findUnique({ where: { id: rollbackId } })
  expect("review audit failure rolls back status and revision", auditFailed[0].status === "rejected" && rolledBack.status === "pending" && rolledBack.reviewRevision === 0)
  const longNote = await Promise.allSettled([reviewMaterialSubmission({
    id: rollbackId, action: "reject", expectedRevision: 0, reviewedBy: reviewAdminA.email, reviewNote: "x".repeat(2001), actorUserId: reviewAdminA.id
  }, { db: prisma })])
  expect("overlong review note is rejected without truncation", longNote[0].status === "rejected" && longNote[0].reason?.status === 400)

  let terminalRevision = reviewed.reviewRevision
  let terminalStatus = reviewed.status
  if (terminalStatus === "rejected") {
    const reopened = await reviewMaterialSubmission({ id: reviewId, action: "mark_reviewed", expectedRevision: terminalRevision, reviewedBy: reviewAdminA.email, actorUserId: reviewAdminA.id }, { db: prisma })
    terminalRevision = reopened.reviewRevision
    terminalStatus = reopened.status
  }
  // MAT08 keeps the application import action fail-closed until rights policy
  // and a positive RAG receipt exist. Seed a legacy imported row directly so
  // this MAT09 probe can still prove the DB-level terminal transition guard.
  const imported = await prisma.materialSubmission.update({
    where: { id: reviewId },
    data: {
      status: "imported",
      reviewRevision: { increment: 1 },
      reviewedAt: new Date(),
      reviewedBy: reviewAdminA.email,
      sourceId: `material:${reviewId}`,
      ragDocId: `material:${reviewId}:v1`,
      ragVersion: 1,
      ragContentHash: reviewed.sha256,
      ragCollection: "synthetic",
      ragAudience: "SOCIAL_WORKER",
      ragPolicyVersion: "synthetic-v1",
      rightsEvidenceMode: "DOCUMENTED_LICENSE",
      ragRetentionMode: "DELETE_WITH_SUBMISSION_OR_ACCOUNT",
      ragWithdrawalAuthority: "SUBMITTER_RIGHTS_HOLDER_OR_ADMIN",
      ragIngestStatus: "IMPORTED",
      ragIngestedAt: new Date(),
      ragIngestedByUserId: reviewAdminA.id,
      authorName: "Synthetic",
      rightsHolder: "Synthetic",
      rightsBasis: "Synthetic",
      rightsEvidence: "Synthetic",
      rightsConfirmedAt: new Date(),
      rightsConfirmedByUserId: reviewOwner.id,
      ...retentionFieldsForImportedLayers(new Date(), { derivativePresent: false })
    }
  })
  const triggerRejected = await Promise.allSettled([prisma.materialSubmission.update({
    where: { id: reviewId }, data: { status: "pending", reviewRevision: { increment: 1 } }
  })])
  expect("database trigger rejects imported-to-pending bypass", imported.status === "imported" && triggerRejected[0].status === "rejected")

  const fixedTime = new Date("2026-08-13T22:00:00.000Z")
  await prisma.materialSubmission.createMany({
    data: Array.from({ length: 105 }, (_, index) => ({
      submittedByUserId: failOwner.id,
      comment: "page",
      originalName: `page-${index}.txt`,
      mime: "text/plain",
      size: 1,
      sha256: String(index).padStart(64, "0"),
      storagePath: `uploads/page-${index}.txt`,
      scanState: "CLEAN",
      validationState: "VALIDATED",
      scannedAt: fixedTime,
      scanEngine: "ProbeClamAV",
      scanEngineVersion: "probe",
      scanSignatureVersion: "probe",
      scanSignatureUpdatedAt: fixedTime,
      ...retentionFieldsForSubmission("pending", fixedTime),
      createdAt: fixedTime,
      updatedAt: fixedTime
    }))
  })
  const page1 = await listMaterialSubmissions({ userId: failOwner.id, limit: 100 }, { db: prisma })
  const page2 = await listMaterialSubmissions({ userId: failOwner.id, limit: 100, cursor: page1.nextCursor }, { db: prisma })
  const pageIds = [...page1.submissions, ...page2.submissions].map((row) => row.id)
  expect("stable (createdAt,id) cursor returns every row once", pageIds.length === 106 && new Set(pageIds).size === 106)
  expect("owner total and hasMore are explicit", page1.total === 106 && page1.hasMore && !page2.hasMore)

  const privateRow = imported
  const hidden = await Promise.allSettled([getMaterialSubmissionDownload({ id: privateRow.id, userId: stranger.id }, { db: prisma })])
  expect("cross-user download is indistinguishable from missing", hidden[0].status === "rejected" && hidden[0].reason?.status === 404)
  const terminal = await Promise.allSettled([requestMaterialSubmissionDeletion({ id: privateRow.id, userId: reviewOwner.id }, { db: prisma, files: fileOps })])
  const durableRagWithdrawal = await prisma.dataDeletionJob.findFirst({
    where: { resourceId: privateRow.id, action: "MATERIAL_RAG_RETENTION_DELETE" }
  })
  expect("imported material cannot be silently withdrawn", terminal[0].status === "rejected" && terminal[0].reason?.status === 503 && Boolean(durableRagWithdrawal))

  const deleteCreated = await createMaterialSubmissions({
    userId: failOwner.id,
    role: "SOCIAL_WORKER",
    idempotencyKey: `probe-delete-${randomUUID()}`,
    comment: "delete",
    files: [makeFile("delete-candidate", 20)]
  }, { db: prisma, fileOps })
  const deleteReviewed = await reviewMaterialSubmission({
    id: deleteCreated.submissions[0].id, action: "reject", expectedRevision: 0, reviewedBy: reviewAdminA.email, actorUserId: reviewAdminA.id
  }, { db: prisma })
  const deleteId = deleteReviewed.id
  const deleteFailed = await Promise.allSettled([requestMaterialSubmissionDeletion(
    { id: deleteId, userId: failOwner.id },
    { db: prisma, files: { ...fileOps, async remove() { throw new Error("probe_delete_failure") } } }
  )])
  const pendingDelete = await prisma.materialSubmission.findUnique({ where: { id: deleteId } })
  const failedOriginalJob = await prisma.dataDeletionJob.findFirst({
    where: { resourceId: deleteId, action: "MATERIAL_ORIGINAL_RETENTION_DELETE" }
  })
  expect("file deletion failure reports 503 and keeps a retryable pending row", deleteFailed[0].status === "rejected" && deleteFailed[0].reason?.status === 503 && pendingDelete?.originalRetentionState === "DELETE_PENDING" && failedOriginalJob?.status === "failed")
  const deleteAuditFailed = await Promise.allSettled([requestMaterialSubmissionDeletion(
    { id: deleteId, userId: failOwner.id },
    { db: prisma, files: fileOps, audit: async () => { throw new Error("probe_delete_audit_failure") } }
  )])
  const rowAfterAuditFailure = await prisma.materialSubmission.findUnique({ where: { id: deleteId } })
  expect(
    "deletion audit failure cannot report success and keeps the row retryable",
    deleteAuditFailed[0].status === "rejected" && Boolean(rowAfterAuditFailure),
    `status=${deleteAuditFailed[0].status} code=${deleteAuditFailed[0].reason?.status || "none"} row=${Boolean(rowAfterAuditFailure)}`
  )
  const removed = await requestMaterialSubmissionDeletion({ id: deleteId, userId: failOwner.id }, { db: prisma, files: fileOps })
  const removedAgain = await requestMaterialSubmissionDeletion({ id: deleteId, userId: failOwner.id }, { db: prisma, files: fileOps })
  const retainedProvenance = await prisma.materialSubmission.findUnique({ where: { id: deleteId } })
  expect(
    "owner withdrawal deletes both file layers and retains provenance",
    removed.deleted && retainedProvenance?.originalRetentionState === "DELETED" && ["DELETED", "NOT_PRESENT"].includes(retainedProvenance?.derivativeRetentionState) && !retainedProvenance.storagePath && !retainedProvenance.derivativeStoragePath,
    `removed=${removed.deleted} original=${retainedProvenance?.originalRetentionState} derivative=${retainedProvenance?.derivativeRetentionState} originalPath=${Boolean(retainedProvenance?.storagePath)} derivativePath=${Boolean(retainedProvenance?.derivativeStoragePath)}`
  )
  expect("owner withdrawal is idempotent", removedAgain.deleted && removedAgain.replay)
  const deletionAuditCount = await prisma.dataAuditLog.count({
    where: { action: { in: ["MATERIAL_ORIGINAL_RETENTION_DELETED", "MATERIAL_DERIVATIVE_RETENTION_DELETED"] }, resourceId: deleteId }
  })
  const expectedDeletionAudits = retainedProvenance.derivativeRetentionState === "DELETED" ? 2 : 1
  expect("durable layered deletion writes mandatory audits", deletionAuditCount === expectedDeletionAudits, `audits=${deletionAuditCount} expected=${expectedDeletionAudits}`)

  const legacyOwner = await prisma.user.create({ data: { email: `legacy-${randomUUID()}@sol-mat.invalid`, role: "SOCIAL_WORKER" } })
  const legacy = async (index) => {
    const current = await getUserStorageUsageBytes(legacyOwner.id, { db: prisma })
    if (current.materialBytes + 1000 > 2000) throw Object.assign(new Error("quota"), { status: 413 })
    await new Promise((resolve) => setTimeout(resolve, 30))
    const createdAt = new Date()
    return prisma.materialSubmission.create({ data: {
      submittedByUserId: legacyOwner.id, comment: "legacy", originalName: `${index}.txt`, mime: "text/plain",
      size: 1000, sha256: String(index).padStart(64, "f"), storagePath: `uploads/legacy-${index}.txt`,
      scanState: "CLEAN", validationState: "VALIDATED", scannedAt: new Date(),
      scanEngine: "ProbeClamAV", scanEngineVersion: "probe", scanSignatureVersion: "probe", scanSignatureUpdatedAt: createdAt,
      ...retentionFieldsForSubmission("pending", createdAt)
    } })
  }
  const legacyResults = await Promise.allSettled(Array.from({ length: 4 }, (_, index) => legacy(index)))
  const legacyBytes = (await getUserStorageUsageBytes(legacyOwner.id, { db: prisma })).materialBytes
  expect("negative control: the former read-then-write quota race exceeds the limit", legacyResults.filter((row) => row.status === "fulfilled").length > 2 && legacyBytes > 2000)

  console.log(`PROBE_OK ${passed}/${passed}`)
  await prisma.$disconnect()
} finally {
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [databaseName]).catch(() => {})
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => {})
  await admin.end()
  console.log(`CLEANUP_OK dropped=${databaseName}`)
}
