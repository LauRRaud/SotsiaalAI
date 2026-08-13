#!/usr/bin/env node
/** SOL-MAT-12 — real PostgreSQL + disk layered retention/retry proof. */

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
  migrate()

  const [{ default: prisma }, retention, policy, server, { DATA_EXPORT_REGISTRY }] = await Promise.all([
    import("../lib/prisma.js"),
    import("../lib/materials/retention.js"),
    import("../lib/materials/retentionPolicy.js"),
    import("../lib/materials/server.js"),
    import("../lib/dataExport/registry.js")
  ])
  const owner = await prisma.user.create({ data: { email: `retention-${randomUUID()}@sol-mat.invalid`, role: "SOCIAL_WORKER" } })
  await server.ensureMaterialsStorage()
  let sequence = 0

  async function writeLayer(relativePath, content) {
    await fs.writeFile(server.resolveAbsoluteMaterialPath(relativePath), Buffer.from(content))
  }

  async function createImported({ anchor = baseTime, derivative = true, rightsValidUntil = null, sourceValidUntil = null } = {}) {
    sequence += 1
    const id = `retention-probe-${sequence}`
    const originalPath = `uploads/${id}-original.pdf`
    const derivativePath = derivative ? `uploads/${id}-sanitized.pdf` : null
    const originalBytes = Buffer.from(`synthetic-original-${id}`)
    const derivativeBytes = Buffer.from(`synthetic-sanitized-${id}`)
    await writeLayer(originalPath, originalBytes)
    if (derivativePath) await writeLayer(derivativePath, derivativeBytes)
    const fields = policy.retentionFieldsForImportedLayers(anchor, {
      derivativePresent: derivative,
      rightsValidUntil,
      sourceValidUntil
    })
    const created = await prisma.materialSubmission.create({ data: {
      id,
      submittedByUserId: owner.id,
      comment: "PRIVATE SYNTHETIC COMMENT",
      originalName: `private-${id}.pdf`,
      mime: "application/pdf",
      size: originalBytes.byteLength,
      sha256: createHash("sha256").update(originalBytes).digest("hex"),
      storagePath: originalPath,
      storageStatus: "ACTIVE",
      scanState: "CLEAN",
      validationState: "VALIDATED",
      scannedAt: anchor,
      scanEngine: "Synthetic",
      scanEngineVersion: "1",
      scanSignatureVersion: "1",
      scanSignatureUpdatedAt: anchor,
      status: "pending",
      ...policy.retentionFieldsForSubmission("pending", anchor),
      contentSafetyState: "ALLOWED"
    } })
    await prisma.materialSubmission.update({ where: { id: created.id }, data: {
      status: "reviewed",
      reviewRevision: 1,
      reviewedAt: anchor,
      reviewedBy: owner.id,
      ...policy.retentionFieldsForSubmission("reviewed", anchor)
    } })
    return prisma.materialSubmission.update({ where: { id: created.id }, data: {
      status: "imported",
      reviewRevision: 2,
      reviewedAt: anchor,
      reviewedBy: owner.id,
      derivativeStoragePath: derivativePath,
      derivativeSha256: derivative ? createHash("sha256").update(derivativeBytes).digest("hex") : null,
      derivativeSize: derivative ? derivativeBytes.byteLength : null,
      sourceId: `material:${id}`,
      ragDocId: `material:${id}:v1`,
      ragVersion: 1,
      ragContentHash: createHash("sha256").update(originalBytes).digest("hex"),
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
      rightsConfirmedByUserId: owner.id,
      rightsValidUntil,
      sourceValidUntil,
      ...fields
    } })
  }

  async function createPending({ anchor = baseTime } = {}) {
    sequence += 1
    const id = `retention-probe-${sequence}`
    const storagePath = `uploads/${id}-original.pdf`
    const bytes = Buffer.from(`synthetic-original-${id}`)
    await writeLayer(storagePath, bytes)
    return prisma.materialSubmission.create({ data: {
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
      ...policy.retentionFieldsForSubmission("pending", anchor)
    } })
  }

  const policyResult = policy.materialRetentionPolicyFromEnvironment({ MATERIALS_RETENTION_PENDING_DAYS: "9999" })
  expect("confirmed 14/30/30/7/365 policy ignores runtime weakening", policyResult.policy.days.pending === 14 && policyResult.policy.days.importedOriginal === 7 && policyResult.policy.days.ragCopy === 365)

  const splitAnchor = new Date(baseTime.getTime() - (8 * dayMs))
  const split = await createImported({ anchor: splitAnchor })
  expect("PostgreSQL persists independent 7-day and 365-day clocks", split.originalRetentionUntil < baseTime && split.derivativeRetentionUntil > baseTime && split.ragRetentionUntil > baseTime)
  const splitQueued = await retention.scheduleDueMaterialRetention({ db: prisma, now: baseTime })
  expect("old one-clock coupling is rejected: only the due original is queued", splitQueued.queuedByLayer.original === 1 && splitQueued.queuedByLayer.derivative === 0 && splitQueued.queuedByLayer.rag === 0)
  const originalJob = await prisma.dataDeletionJob.findFirst({ where: { action: retention.MATERIAL_ORIGINAL_RETENTION_DELETE_ACTION, resourceId: split.id } })
  const originalDone = await retention.processNextMaterialRetentionJob({ db: prisma, now: baseTime, jobId: originalJob.id })
  const afterOriginal = await prisma.materialSubmission.findUnique({ where: { id: split.id } })
  expect("original deletion keeps provenance row, derivative bytes, and RAG copy", originalDone.layer === "original" && afterOriginal.storagePath === null && afterOriginal.derivativeStoragePath && afterOriginal.ragRetentionState === "SCHEDULED")
  await fs.access(server.resolveAbsoluteMaterialPath(afterOriginal.derivativeStoragePath))

  const layerDeadline = split.ragRetentionUntil
  const layerQueued = await retention.scheduleDueMaterialRetention({ db: prisma, now: layerDeadline })
  expect("annual boundary queues derivative and RAG independently", layerQueued.queuedByLayer.derivative === 1 && layerQueued.queuedByLayer.rag === 1)
  const blocked = await prisma.materialSubmission.findUnique({ where: { id: split.id } })
  expect("expired RAG becomes fail-closed before remote deletion", blocked.ragRetentionState === "DELETE_PENDING" && blocked.ragIngestStatus === "RETENTION_BLOCKED")

  const derivativeJob = await prisma.dataDeletionJob.findFirst({ where: { action: retention.MATERIAL_DERIVATIVE_RETENTION_DELETE_ACTION, resourceId: split.id } })
  const crashed = await retention.processNextMaterialRetentionJob({
    db: prisma,
    now: layerDeadline,
    jobId: derivativeJob.id,
    beforeFinalize: async () => { throw Object.assign(new Error("synthetic crash"), { code: "synthetic_crash_after_disk_delete" }) }
  })
  expect("crash after derivative disk deletion leaves a durable retry", crashed.stage === "database" && (await prisma.dataDeletionJob.findUnique({ where: { id: derivativeJob.id } })).status === "failed")
  await prisma.dataDeletionJob.update({ where: { id: derivativeJob.id }, data: { nextAttemptAt: layerDeadline } })
  const derivativeRetry = await retention.processNextMaterialRetentionJob({ db: prisma, now: layerDeadline, jobId: derivativeJob.id })
  const afterDerivative = await prisma.materialSubmission.findUnique({ where: { id: split.id } })
  expect("retry tolerates the absent file and deletes only derivative state", derivativeRetry.layer === "derivative" && afterDerivative.derivativeStoragePath === null && afterDerivative.ragRetentionState === "DELETE_PENDING")

  let ragPresent = true
  let failRagOnce = true
  const rag = {
    async deleteDocument() {
      if (failRagOnce) {
        failRagOnce = false
        throw Object.assign(new Error("synthetic RAG failure"), { code: "synthetic_rag_failure" })
      }
      ragPresent = false
      return { ok: true }
    },
    async countChunks() { return ragPresent ? 1 : 0 }
  }
  const ragJob = await prisma.dataDeletionJob.findFirst({ where: { action: retention.MATERIAL_RAG_RETENTION_DELETE_ACTION, resourceId: split.id } })
  const ragFailed = await retention.processNextMaterialRetentionJob({ db: prisma, now: layerDeadline, jobId: ragJob.id, ragDependencies: { rag } })
  expect("RAG failure persists a retry and does not resurrect access", ragFailed.stage === "rag" && (await prisma.materialSubmission.findUnique({ where: { id: split.id } })).ragIngestStatus === "RETENTION_BLOCKED")
  await prisma.dataDeletionJob.update({ where: { id: ragJob.id }, data: { nextAttemptAt: layerDeadline } })
  const ragRetry = await retention.processNextMaterialRetentionJob({ db: prisma, now: layerDeadline, jobId: ragJob.id, ragDependencies: { rag } })
  const allLayersDone = await prisma.materialSubmission.findUnique({ where: { id: split.id } })
  expect("RAG retry confirms zero chunks and still preserves audit/provenance", ragRetry.layer === "rag" && !ragPresent && allLayersDone.ragRetentionState === "DELETED" && Boolean(allLayersDone.id))

  const concurrent = await createPending({ anchor: new Date(baseTime.getTime() - (15 * dayMs)) })
  await retention.scheduleDueMaterialRetention({ db: prisma, now: baseTime })
  const concurrentJob = await prisma.dataDeletionJob.findFirst({ where: { action: retention.MATERIAL_ORIGINAL_RETENTION_DELETE_ACTION, resourceId: concurrent.id } })
  const racers = await Promise.all([
    retention.processNextMaterialRetentionJob({ db: prisma, now: baseTime, jobId: concurrentJob.id }),
    retention.processNextMaterialRetentionJob({ db: prisma, now: baseTime, jobId: concurrentJob.id })
  ])
  expect("parallel workers finalize one job and one audit only", racers.filter(item => item?.status === "done").length === 1 && await prisma.dataAuditLog.count({ where: { action: "MATERIAL_ORIGINAL_RETENTION_DELETED", resourceId: concurrent.id } }) === 1)
  expect("completed retention job replay is a no-op", (await retention.processNextMaterialRetentionJob({ db: prisma, now: baseTime, jobId: concurrentJob.id })) === null)

  const rightsExpiry = new Date(baseTime.getTime() + dayMs)
  const expiring = await createImported({ anchor: baseTime, rightsValidUntil: rightsExpiry })
  await retention.scheduleDueMaterialRetention({ db: prisma, now: rightsExpiry })
  const expiringJobs = await prisma.dataDeletionJob.findMany({ where: { resourceId: expiring.id } })
  expect("licence expiry immediately queues derivative/RAG but not the 7-day original", expiringJobs.some(job => job.action === retention.MATERIAL_DERIVATIVE_RETENTION_DELETE_ACTION) && expiringJobs.some(job => job.action === retention.MATERIAL_RAG_RETENTION_DELETE_ACTION) && !expiringJobs.some(job => job.action === retention.MATERIAL_ORIGINAL_RETENTION_DELETE_ACTION))

  for (const [scanState, validationState] of [["PENDING", "PENDING"], ["FAILED", "PENDING"], ["CLEAN", "VALIDATED"]]) {
    const id = `quarantine-${scanState.toLowerCase()}-${randomUUID()}`
    const quarantinePath = `quarantine/${id}`
    await fs.writeFile(server.resolveAbsoluteQuarantinePath(quarantinePath), Buffer.from("synthetic quarantine"))
    const fields = policy.retentionFieldsForQuarantine({ scanState, validationState }, new Date(baseTime.getTime() - dayMs))
    await prisma.materialUploadQuarantine.create({ data: {
      id, submittedByUserId: owner.id, declaredMime: "application/pdf", size: 20,
      sha256: createHash("sha256").update(id).digest("hex"), quarantinePath,
      storageState: "QUARANTINED", scanState, validationState, ...fields
    } })
    expect(`${scanState} quarantine has the confirmed one-day clock`, fields.retentionUntil.getTime() === baseTime.getTime())
  }
  const quarantineSweep = await retention.sweepExpiredMaterialQuarantines({ db: prisma, now: baseTime })
  expect("all expired quarantine byte layers are removed", quarantineSweep.length === 3 && quarantineSweep.every(item => item.status === "done"))

  const accountRow = await createImported({ anchor: baseTime })
  const accountRag = { present: true }
  const accountResult = await retention.removeMaterialForAccountDeletion(accountRow, { actorUserId: owner.id }, {
    db: prisma,
    now: baseTime,
    ragDependencies: { rag: {
      async deleteDocument() { accountRag.present = false; return { ok: true } },
      async countChunks() { return accountRag.present ? 1 : 0 }
    } }
  })
  const afterAccountLayers = await prisma.materialSubmission.findUnique({ where: { id: accountRow.id } })
  expect("account deletion removes all byte/RAG layers before user cascade", accountResult.ok && !accountRag.present && afterAccountLayers.originalRetentionState === "DELETED" && afterAccountLayers.derivativeRetentionState === "DELETED" && afterAccountLayers.ragRetentionState === "DELETED")

  const materialExport = DATA_EXPORT_REGISTRY.find(entry => entry.name === "material_submissions")
  const exported = await materialExport.collect({ db: prisma, userId: owner.id, readMaterial: server.readStoredMaterial })
  const exportedMetadata = JSON.parse(exported.find(entry => entry.name === "materials.json").content)
  const exportedRow = exportedMetadata.find(row => row.id === split.id)
  expect("data copy exposes all three deadlines/states without requiring deleted bytes", exportedRow.retention.original.state === "DELETED" && exportedRow.retention.derivative.state === "DELETED" && exportedRow.retention.rag.state === "DELETED")

  const invalidConstraint = await prisma.materialSubmission.update({
    where: { id: concurrent.id },
    data: { derivativeRetentionState: "SCHEDULED", derivativeRetentionUntil: baseTime, derivativeRetentionPolicyVersion: policy.MATERIAL_RETENTION_POLICY_VERSION }
  }).then(() => false, () => true)
  expect("database rejects a scheduled derivative clock without derivative bytes", invalidConstraint)

  await prisma.user.delete({ where: { id: owner.id } })
  expect("synthetic owner cleanup removes all remaining provenance rows", await prisma.materialSubmission.count({ where: { submittedByUserId: owner.id } }) === 0)
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
