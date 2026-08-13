#!/usr/bin/env node
/** SOL-MAT-12 — real PostgreSQL + disk retention/retry/account-deletion proof. */

import { spawnSync } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"

const sourceUrl = String(process.env.DATABASE_URL || "postgresql://sotsiaal_user:sotsiaalai@127.0.0.1:5432/sotsiaal_ai?schema=public").trim()
const parsed = new URL(sourceUrl)
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname)) throw new Error("probe requires loopback PostgreSQL")
const databaseName = `sotsiaal_ai_material_retention_probe_${Date.now()}`
const adminUrl = new URL(parsed)
adminUrl.pathname = "/postgres"
adminUrl.search = ""
const probeUrl = new URL(parsed)
probeUrl.pathname = `/${databaseName}`
const admin = new pg.Client({ connectionString: adminUrl.toString() })
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url))
const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sotsiaalai-material-retention-"))
let passed = 0

function expect(label, condition, detail = "") {
  if (!condition) throw new Error(`PROBE_FAIL ${label}${detail ? ` — ${detail}` : ""}`)
  passed += 1
  console.log(`  PASS  ${label}`)
}

function migrate() {
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: probeUrl.toString() }, stdio: "inherit", shell: false
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`prisma migrate deploy failed (${result.status})`)
}

const baseTime = new Date("2026-08-13T12:00:00.000Z")
const dayMs = 24 * 60 * 60 * 1000

await admin.connect()
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`)
  process.env.DATABASE_URL = probeUrl.toString()
  process.env.MATERIALS_STORAGE_DIR = storageRoot
  Object.assign(process.env, {
    MATERIALS_RETENTION_POLICY_STATUS: "CONFIRMED",
    MATERIALS_RETENTION_POLICY_VERSION: "synthetic-probe-v1",
    MATERIALS_RETENTION_PENDING_DAYS: "1",
    MATERIALS_RETENTION_REJECTED_DAYS: "2",
    MATERIALS_RETENTION_REVIEWED_DAYS: "3",
    MATERIALS_RETENTION_IMPORTED_ORIGINAL_DAYS: "4",
    MATERIALS_RETENTION_QUARANTINE_PENDING_DAYS: "1",
    MATERIALS_RETENTION_QUARANTINE_FAILED_DAYS: "2",
    MATERIALS_RETENTION_QUARANTINE_CLEAN_DAYS: "3"
  })
  migrate()

  const [{ default: prisma }, retention, retentionPolicy, server, notifications, { DATA_EXPORT_REGISTRY }] = await Promise.all([
    import("../lib/prisma.js"),
    import("../lib/materials/retention.js"),
    import("../lib/materials/retentionPolicy.js"),
    import("../lib/materials/server.js"),
    import("../lib/materials/notifications.js"),
    import("../lib/dataExport/registry.js")
  ])
  const owner = await prisma.user.create({ data: { email: `retention-${randomUUID()}@sol-mat.invalid`, role: "SOCIAL_WORKER" } })
  await server.ensureMaterialsStorage()
  let sequence = 0

  async function createSubmission(status, { due = false, rag = false, decisionPending = false } = {}) {
    sequence += 1
    const id = `retention-probe-${sequence}`
    const storagePath = `uploads/${id}.pdf`
    const bytes = Buffer.from(`synthetic-${id}`)
    await fs.writeFile(server.resolveAbsoluteMaterialPath(storagePath), bytes)
    const anchor = due ? new Date(baseTime.getTime() - 10 * dayMs) : baseTime
    const policy = decisionPending
      ? retentionPolicy.materialRetentionPolicyFromEnvironment({})
      : retentionPolicy.materialRetentionPolicyFromEnvironment(process.env)
    const retentionFields = retentionPolicy.retentionFieldsForSubmission(status, anchor, policy)
    const ragFields = rag ? {
      sourceId: `material:${id}`,
      ragDocId: `material:${id}:v1`,
      ragVersion: 1,
      ragContentHash: createHash("sha256").update(bytes).digest("hex"),
      ragCollection: "synthetic_materials",
      ragAudience: "SOCIAL_WORKER",
      ragPolicyVersion: "synthetic-rag-v1",
      rightsEvidenceMode: "DOCUMENTED_LICENSE",
      ragRetentionMode: "DELETE_WITH_SUBMISSION_OR_ACCOUNT",
      ragWithdrawalAuthority: "SUBMITTER_RIGHTS_HOLDER_OR_ADMIN",
      ragIngestStatus: "IMPORTED",
      ragIngestedAt: anchor,
      ragIngestedByUserId: owner.id,
      authorName: "Synthetic Author",
      rightsHolder: "Synthetic Rights Holder",
      rightsBasis: "Synthetic test licence",
      rightsEvidence: "Synthetic probe evidence",
      rightsConfirmedAt: anchor,
      rightsConfirmedByUserId: owner.id
    } : {}
    const created = await prisma.materialSubmission.create({ data: {
      id,
      submittedByUserId: owner.id,
      comment: "PRIVATE SYNTHETIC COMMENT",
      originalName: `private-${id}.pdf`,
      mime: "application/pdf",
      size: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      storagePath,
      storageStatus: "ACTIVE",
      scanState: "CLEAN",
      validationState: "VALIDATED",
      scannedAt: anchor,
      scanEngine: "Synthetic",
      scanEngineVersion: "1",
      scanSignatureVersion: "1",
      scanSignatureUpdatedAt: anchor,
      status: "pending",
      ...retentionPolicy.retentionFieldsForSubmission("pending", anchor, policy)
    } })
    if (status === "pending") return created
    const reviewed = await prisma.materialSubmission.update({ where: { id }, data: {
      status: status === "rejected" ? "rejected" : "reviewed",
      reviewRevision: { increment: 1 },
      reviewedAt: anchor,
      reviewedBy: owner.id,
      ...(status === "rejected" ? retentionFields : retentionPolicy.retentionFieldsForSubmission("reviewed", anchor, policy))
    } })
    if (status !== "imported") return reviewed
    return prisma.materialSubmission.update({ where: { id }, data: {
      status: "imported",
      reviewRevision: { increment: 1 },
      reviewedAt: anchor,
      reviewedBy: owner.id,
      ...ragFields,
      ...retentionFields
    } })
  }

  const statusDays = { pending: 1, rejected: 2, reviewed: 3, imported: 4 }
  for (const [status, days] of Object.entries(statusDays)) {
    const row = await createSubmission(status, { rag: status === "imported" })
    expect(`${status} persists its configured deterministic deadline`, row.retentionUntil.getTime() === baseTime.getTime() + days * dayMs)
  }
  const undecided = await createSubmission("pending", { decisionPending: true })
  expect("missing owner decision persists decision_pending without a fake date", undecided.retentionState === "DECISION_PENDING" && undecided.retentionUntil === null)

  const clock = await createSubmission("rejected", { due: true })
  const clockDeadline = clock.retentionUntil
  const before = await retention.scheduleDueMaterialRetention({ db: prisma, now: new Date(clockDeadline.getTime() - 1) })
  expect("deadline minus 1 ms is not due", before.queued === 0)
  const at = await retention.scheduleDueMaterialRetention({ db: prisma, now: clockDeadline })
  expect("deadline is due at the exact millisecond", at.queued === 1)

  const clockJob = await prisma.dataDeletionJob.findFirst({ where: { action: retention.MATERIAL_RETENTION_DELETE_ACTION, resourceId: clock.id } })
  const fileFailure = await retention.processNextMaterialRetentionJob({ db: prisma, now: clockDeadline, jobId: clockJob.id, files: {
    async remove() { throw Object.assign(new Error("synthetic disk failure"), { code: "synthetic_disk_failure" }) }
  } })
  expect("file failure persists retry and keeps the DB row", fileFailure.stage === "file" && Boolean(await prisma.materialSubmission.findUnique({ where: { id: clock.id } })))
  await prisma.dataDeletionJob.update({ where: { id: clockJob.id }, data: { nextAttemptAt: clockDeadline } })
  const fileRetry = await retention.processNextMaterialRetentionJob({ db: prisma, now: clockDeadline, jobId: clockJob.id })
  expect("file retry removes both disk and DB exactly once", fileRetry.status === "done" && !(await prisma.materialSubmission.findUnique({ where: { id: clock.id } })))

  const ragRow = await createSubmission("imported", { due: true, rag: true })
  await retention.scheduleDueMaterialRetention({ db: prisma, now: baseTime })
  const ragRetentionJob = await prisma.dataDeletionJob.findFirst({ where: { action: retention.MATERIAL_RETENTION_DELETE_ACTION, resourceId: ragRow.id } })
  let ragFailures = 1
  let ragPresent = true
  const rag = {
    async deleteDocument() {
      if (ragFailures-- > 0) throw Object.assign(new Error("synthetic RAG failure"), { code: "synthetic_rag_failure" })
      ragPresent = false
      return { ok: true }
    },
    async countChunks() { return ragPresent ? 1 : 0 }
  }
  const ragFailed = await retention.processNextMaterialRetentionJob({ db: prisma, now: baseTime, jobId: ragRetentionJob.id, ragDependencies: { rag } })
  expect("RAG failure blocks file and DB deletion with a durable retry", ragFailed.stage === "rag" && Boolean(await prisma.materialSubmission.findUnique({ where: { id: ragRow.id } })))
  await prisma.dataDeletionJob.update({ where: { id: ragRetentionJob.id }, data: { nextAttemptAt: baseTime } })
  const ragRetry = await retention.processNextMaterialRetentionJob({ db: prisma, now: baseTime, jobId: ragRetentionJob.id, ragDependencies: { rag } })
  expect("RAG retry confirms zero chunks before deleting the original", ragRetry.status === "done" && !ragPresent)

  const crashRow = await createSubmission("reviewed", { due: true })
  await retention.scheduleDueMaterialRetention({ db: prisma, now: baseTime })
  const crashJob = await prisma.dataDeletionJob.findFirst({ where: { action: retention.MATERIAL_RETENTION_DELETE_ACTION, resourceId: crashRow.id } })
  const crashed = await retention.processNextMaterialRetentionJob({ db: prisma, now: baseTime, jobId: crashJob.id, beforeFinalize: async () => {
    throw Object.assign(new Error("synthetic crash after disk delete"), { code: "synthetic_process_crash" })
  } })
  expect("crash after disk deletion leaves a retryable DB tombstone", crashed.stage === "database" && Boolean(await prisma.materialSubmission.findUnique({ where: { id: crashRow.id } })))
  await prisma.dataDeletionJob.update({ where: { id: crashJob.id }, data: { nextAttemptAt: baseTime } })
  const crashRetry = await retention.processNextMaterialRetentionJob({ db: prisma, now: baseTime, jobId: crashJob.id })
  expect("restart tolerates the already absent file and finalizes DB", crashRetry.status === "done")

  const parallelRow = await createSubmission("pending", { due: true })
  await retention.scheduleDueMaterialRetention({ db: prisma, now: baseTime })
  const parallelJob = await prisma.dataDeletionJob.findFirst({ where: { action: retention.MATERIAL_RETENTION_DELETE_ACTION, resourceId: parallelRow.id } })
  const parallel = await Promise.all([
    retention.processNextMaterialRetentionJob({ db: prisma, now: baseTime, jobId: parallelJob.id }),
    retention.processNextMaterialRetentionJob({ db: prisma, now: baseTime, jobId: parallelJob.id })
  ])
  expect("parallel sweep claims one job and writes one completion audit", parallel.filter(item => item?.status === "done").length === 1 && await prisma.dataAuditLog.count({ where: { action: "MATERIAL_RETENTION_DELETED", resourceId: parallelRow.id } }) === 1)
  expect("second sweep run is a no-op", (await retention.processNextMaterialRetentionJob({ db: prisma, now: baseTime, jobId: parallelJob.id })) === null)

  for (const [scanState, validationState, days] of [["PENDING", "PENDING", 1], ["FAILED", "PENDING", 2], ["CLEAN", "VALIDATED", 3], ["INFECTED", "PENDING", 1]]) {
    const id = `quarantine-${scanState.toLowerCase()}-${randomUUID()}`
    const quarantinePath = `quarantine/${id}`
    await fs.writeFile(server.resolveAbsoluteQuarantinePath(quarantinePath), Buffer.from("synthetic quarantine"))
    const fields = retentionPolicy.retentionFieldsForQuarantine({ scanState, validationState }, new Date(baseTime.getTime() - 10 * dayMs), retentionPolicy.materialRetentionPolicyFromEnvironment(process.env))
    await prisma.materialUploadQuarantine.create({ data: {
      id, submittedByUserId: owner.id, declaredMime: "application/pdf", size: 20, sha256: createHash("sha256").update(id).digest("hex"),
      quarantinePath, storageState: "QUARANTINED", scanState, validationState, ...fields
    } })
    expect(`${scanState} quarantine has its own configured expiry`, fields.retentionUntil.getTime() === baseTime.getTime() + (-10 + days) * dayMs)
  }
  const quarantineSweep = await retention.sweepExpiredMaterialQuarantines({ db: prisma, now: baseTime })
  expect("expired pending/failed/clean/infected quarantine bytes are durably removed", quarantineSweep.length === 4 && quarantineSweep.every(item => item.status === "done"))

  const accountRow = await createSubmission("imported", { rag: true })
  let accountRagPresent = true
  const accountResult = await retention.removeMaterialForAccountDeletion(accountRow, { actorUserId: owner.id }, { db: prisma, now: baseTime, ragDependencies: { rag: {
    async deleteDocument() { accountRagPresent = false; return { ok: true } },
    async countChunks() { return accountRagPresent ? 1 : 0 }
  } } })
  expect("account deletion uses the same durable RAG then file then DB path", accountResult.ok && !accountRagPresent && !(await prisma.materialSubmission.findUnique({ where: { id: accountRow.id } })))

  const exportRow = await createSubmission("pending", { decisionPending: true })
  const materialExport = DATA_EXPORT_REGISTRY.find(entry => entry.name === "material_submissions")
  const exported = await materialExport.collect({ db: prisma, userId: owner.id, readMaterial: server.readStoredMaterial })
  const exportedMetadata = JSON.parse(exported.find(entry => entry.name === "materials.json").content)
  const exportedRow = exportedMetadata.find(row => row.id === exportRow.id)
  expect("data copy says decision_pending instead of inventing a deadline", exportedRow.retentionDecision === "decision_pending" && exportedRow.retentionUntil === null)

  const batch = await prisma.materialSubmissionBatch.create({ data: {
    submittedByUserId: owner.id, idempotencyKey: `retention-notify-${randomUUID()}`, requestHash: randomUUID().replaceAll("-", ""),
    status: "COMMITTED", notificationStatus: "PENDING", notificationNextAt: baseTime
  } })
  await prisma.materialSubmission.update({ where: { id: exportRow.id }, data: { batchId: batch.id } })
  const sent = []
  await notifications.processNextMaterialNotification({ db: prisma, now: baseTime, batchId: batch.id, config: {
    to: "admin@synthetic.invalid", from: "noreply@synthetic.invalid", baseUrl: "https://synthetic.invalid"
  }, mailer: { async sendMail(message) { sent.push(message); return { messageId: message.messageId } } } })
  const mail = JSON.stringify(sent[0])
  expect("SMTP outbox is minimized and copies no email, filename or comment", sent.length === 1 && !mail.includes(owner.email) && !mail.includes(exportRow.originalName) && !mail.includes(exportRow.comment))

  await prisma.user.delete({ where: { id: owner.id } })
  expect("synthetic owner cleanup removes remaining material rows", await prisma.materialSubmission.count({ where: { submittedByUserId: owner.id } }) === 0)
  console.log(`PROBE_OK ${passed}/${passed}`)
  await prisma.$disconnect()
} finally {
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [databaseName]).catch(() => {})
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => {})
  await admin.end()
  const resolvedStorage = path.resolve(storageRoot)
  const tempRoot = path.resolve(os.tmpdir())
  if (resolvedStorage.startsWith(`${tempRoot}${path.sep}`) && path.basename(resolvedStorage).startsWith("sotsiaalai-material-retention-")) {
    await fs.rm(resolvedStorage, { recursive: true, force: true })
  }
  console.log(`CLEANUP_OK database=${databaseName} storage_removed=true remote_rag=synthetic_only`)
}
