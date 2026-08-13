#!/usr/bin/env node
/** SOL-MAT-08: real PostgreSQL state machine with an injected isolated RAG boundary. */

import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"

import dotenv from "dotenv"
import pg from "pg"

dotenv.config({ path: ".env.local", quiet: true })
dotenv.config({ path: ".env", quiet: true })

const sourceUrl = String(process.env.DATABASE_URL || "postgresql://sotsiaal_user:sotsiaalai@127.0.0.1:5432/sotsiaal_ai?schema=public").trim()
const parsed = new URL(sourceUrl)
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname)) {
  throw new Error("Material RAG probe only creates a temporary database on loopback PostgreSQL")
}
const databaseName = `sotsiaal_ai_material_rag_probe_${Date.now()}_${process.pid}`
if (!/^sotsiaal_ai_material_rag_probe_[0-9_]+$/u.test(databaseName)) throw new Error("unsafe probe database name")
const adminUrl = new URL(parsed)
adminUrl.pathname = "/postgres"
adminUrl.search = ""
const probeUrl = new URL(parsed)
probeUrl.pathname = `/${databaseName}`
probeUrl.search = ""
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url))
const admin = new pg.Client({ connectionString: adminUrl.toString() })
let databaseCreated = false
let prisma = null
let reviewMaterialSubmission = null
let adminUserId = null
let passed = 0

const policy = Object.freeze({
  version: "synthetic-probe-v1",
  rightsEvidenceMode: "DOCUMENTED_LICENSE",
  collection: "synthetic_professional_materials",
  audience: "SOCIAL_WORKER",
  retentionMode: "DELETE_WITH_SUBMISSION_OR_ACCOUNT",
  withdrawalAuthority: "SUBMITTER_RIGHTS_HOLDER_OR_ADMIN"
})
const rights = Object.freeze({
  authorName: "Synthetic Author",
  rightsHolder: "Synthetic Rights Holder",
  rightsBasis: "synthetic_test_permission",
  rightsEvidence: "Synthetic probe evidence only; no real person or corpus."
})

function expect(label, condition, detail = "") {
  if (!condition) throw new Error(`PROBE_FAIL ${label}${detail ? ` — ${detail}` : ""}`)
  passed += 1
  console.log(`  PASS  ${label}`)
}

function migrate() {
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: probeUrl.toString() },
    encoding: "utf8",
    shell: false,
    timeout: 180_000
  })
  if (result.status !== 0) {
    process.stdout.write(result.stdout || "")
    process.stderr.write(result.stderr || "")
    throw new Error(`prisma migrate deploy failed (${result.status ?? "no status"})`)
  }
  console.log("MIGRATIONS_OK temporary_database_full_chain")
}

function createRag() {
  const chunks = new Map()
  const state = { mode: "ok", deleteFailures: 0, ingestCalls: 0, deleteCalls: 0 }
  return {
    state,
    chunks,
    async ingest({ identity }) {
      state.ingestCalls += 1
      if (state.mode === "http_400") {
        const error = new Error("synthetic 400")
        error.status = 400
        throw error
      }
      if (state.mode === "http_500") {
        const error = new Error("synthetic 500")
        error.status = 500
        throw error
      }
      if (state.mode === "timeout") {
        const error = new Error("synthetic timeout")
        error.status = 504
        throw error
      }
      if (state.mode === "zero") {
        chunks.set(identity.docId, 0)
        return { inserted: 0 }
      }
      chunks.set(identity.docId, 2)
      return { inserted: 2 }
    },
    async countChunks(docId) {
      return Number(chunks.get(docId) || 0)
    },
    async deleteDocument(docId) {
      state.deleteCalls += 1
      if (state.deleteFailures > 0) {
        state.deleteFailures -= 1
        return { ok: false, reason: "synthetic_delete_failure" }
      }
      chunks.set(docId, 0)
      return { ok: true }
    }
  }
}

async function createReviewed(ownerId, hash, suffix) {
  const created = await prisma.materialSubmission.create({
    data: {
      submittedByUserId: ownerId,
      comment: `synthetic ${suffix}`,
      originalName: `${suffix}.pdf`,
      mime: "application/pdf",
      size: 16,
      sha256: hash,
      storagePath: `uploads/${suffix}.pdf`,
      storageStatus: "ACTIVE",
      scanState: "CLEAN",
      validationState: "VALIDATED",
      scannedAt: new Date(),
      scanEngine: "ProbeClamAV",
      scanEngineVersion: "probe",
      scanSignatureVersion: "probe",
      scanSignatureUpdatedAt: new Date()
    }
  })
  return reviewMaterialSubmission({
    id: created.id,
    action: "mark_reviewed",
    expectedRevision: 0,
    reviewedBy: "synthetic-admin",
    actorUserId: adminUserId
  }, { db: prisma })
}

await admin.connect()
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`)
  databaseCreated = true
  process.env.DATABASE_URL = probeUrl.toString()
  migrate()
  const [{ default: db }, lifecycle, review] = await Promise.all([
    import("../lib/prisma.js"),
    import("../lib/materials/ragLifecycle.js"),
    import("../lib/materials/review.js")
  ])
  prisma = db
  reviewMaterialSubmission = review.reviewMaterialSubmission
  const {
    importReviewedMaterialToRag,
    queueMaterialRagDeletion,
    removeMaterialRagForAccountDeletion,
    retryMaterialRagIngest,
    retryMaterialRagDeletion
  } = lifecycle
  const owner = await prisma.user.create({
    data: { email: `sol-mat-08-${randomUUID()}@synthetic.invalid`, role: "SOCIAL_WORKER", emailVerified: new Date() }
  })
  const adminUser = await prisma.user.create({
    data: { email: `sol-mat-08-admin-${randomUUID()}@synthetic.invalid`, role: "ADMIN", emailVerified: new Date() }
  })
  adminUserId = adminUser.id
  const rag = createRag()
  const dependencies = { db: prisma, rag }

  const directClaim = await createReviewed(owner.id, "0".repeat(64), "direct-import-claim")
  const directRejected = await prisma.materialSubmission.update({
    where: { id: directClaim.id },
    data: { status: "imported", reviewRevision: { increment: 1 } }
  }).then(() => false, () => true)
  expect("database rejects imported without a positive persisted receipt", directRejected)

  const successful = await createReviewed(owner.id, "1".repeat(64), "success")
  const imported = await importReviewedMaterialToRag({
    id: successful.id,
    expectedRevision: successful.reviewRevision,
    actorUserId: adminUser.id,
    rights,
    policy
  }, dependencies)
  expect("imported exists only after positive chunk receipt", imported.status === "imported" && imported.ragIngestStatus === "IMPORTED" && rag.chunks.get(imported.ragDocId) === 2)
  expect("provenance, version, policy and rights evidence persist", imported.sourceId === `material:${imported.id}` && imported.ragVersion === 1 && imported.ragContentHash === successful.sha256 && imported.ragCollection === policy.collection && imported.ragAudience === policy.audience && imported.ragPolicyVersion === policy.version && imported.rightsEvidenceMode === policy.rightsEvidenceMode && imported.ragRetentionMode === policy.retentionMode && imported.ragWithdrawalAuthority === policy.withdrawalAuthority && imported.authorName === rights.authorName && imported.rightsHolder === rights.rightsHolder && imported.rightsBasis === rights.rightsBasis && Boolean(imported.ragIngestedAt))

  let fourHundred = null
  for (const [mode, hash, expectedAction] of [
    ["http_400", "2".repeat(64), "RAG_INGEST"],
    ["http_500", "3".repeat(64), "RAG_DELETE"],
    ["timeout", "4".repeat(64), "RAG_DELETE"],
    ["zero", "5".repeat(64), "RAG_DELETE"]
  ]) {
    const row = await createReviewed(owner.id, hash, mode)
    rag.state.mode = mode
    await importReviewedMaterialToRag({ id: row.id, expectedRevision: 1, actorUserId: adminUser.id, rights, policy }, dependencies).then(
      () => { throw new Error(`${mode} unexpectedly imported`) },
      () => {}
    )
    const failed = await prisma.materialSubmission.findUnique({ where: { id: row.id } })
    const job = await prisma.dataDeletionJob.findFirst({ where: { resourceId: row.id, action: expectedAction } })
    expect(`${mode} cannot produce imported`, failed.status === "reviewed" && failed.ragIngestStatus !== "IMPORTED")
    expect(`${mode} persists the correct retry/cleanup job`, Boolean(job) && job.status === "pending")
    if (mode === "http_400") fourHundred = { row: failed, job }
  }
  rag.state.mode = "ok"
  const retried = await retryMaterialRagIngest({
    jobId: fourHundred.job.id,
    actorUserId: adminUser.id,
    policy
  }, dependencies)
  expect("RAG ingest retry reuses the same version and closes the durable job", retried.status === "imported" && retried.ragDocId === fourHundred.row.ragDocId && (await prisma.dataDeletionJob.findUnique({ where: { id: fourHundred.job.id } }))?.status === "done")

  const duplicate = await createReviewed(owner.id, successful.sha256, "duplicate")
  const callsBeforeDuplicate = rag.state.ingestCalls
  await importReviewedMaterialToRag({ id: duplicate.id, expectedRevision: 1, actorUserId: adminUser.id, rights, policy }, dependencies).then(
    () => { throw new Error("duplicate unexpectedly imported") },
    error => expect("duplicate is rejected before a second RAG call", error?.code === "material_rag_duplicate" && rag.state.ingestCalls === callsBeforeDuplicate)
  )

  const finalize = await createReviewed(owner.id, "6".repeat(64), "finalize-failure")
  let failNextTransaction = false
  const failingDb = new Proxy(prisma, {
    get(target, property) {
      if (property !== "$transaction") return target[property]
      return async callback => {
        if (failNextTransaction) {
          failNextTransaction = false
          throw new Error("synthetic final database failure")
        }
        return target.$transaction(callback)
      }
    }
  })
  await importReviewedMaterialToRag({ id: finalize.id, expectedRevision: 1, actorUserId: adminUser.id, rights, policy }, {
    db: failingDb,
    rag,
    beforeFinalize: async () => { failNextTransaction = true }
  }).then(() => { throw new Error("final DB failure unexpectedly imported") }, () => {})
  const afterFinalizeFailure = await prisma.materialSubmission.findUnique({ where: { id: finalize.id } })
  const compensation = await prisma.dataDeletionJob.findFirst({ where: { resourceId: finalize.id, action: "RAG_DELETE" } })
  expect("DB final failure leaves no imported claim and persists compensation", afterFinalizeFailure.status === "reviewed" && afterFinalizeFailure.ragIngestStatus === "CLEANUP_PENDING" && Boolean(compensation))
  await importReviewedMaterialToRag({ id: finalize.id, expectedRevision: 1, actorUserId: adminUser.id, rights, policy }, dependencies).then(
    () => { throw new Error("cleanup-pending row unexpectedly reingested") },
    error => expect("compensation pending blocks a new ingest", error?.code === "material_rag_cleanup_pending")
  )
  const compensated = await retryMaterialRagDeletion({ jobId: compensation.id, actorUserId: adminUser.id }, dependencies)
  expect("DB-final compensation proves remote absence before retry is allowed", compensated.status === "done" && rag.chunks.get(afterFinalizeFailure.ragDocId) === 0)

  rag.state.deleteFailures = 1
  const queued = await queueMaterialRagDeletion({ submission: imported, actorUserId: adminUser.id, reason: "synthetic_withdrawal" }, dependencies)
  const firstDelete = await retryMaterialRagDeletion({ jobId: queued.job.id, actorUserId: adminUser.id }, dependencies)
  const secondDelete = await retryMaterialRagDeletion({ jobId: queued.job.id, actorUserId: adminUser.id }, dependencies)
  const afterRetry = await prisma.materialSubmission.findUnique({ where: { id: imported.id } })
  expect("RAG delete failure remains retryable", firstDelete.status === "failed")
  expect("RAG delete retry proves zero chunks and durable done", secondDelete.status === "done" && afterRetry.ragRemovalStatus === "DONE" && rag.chunks.get(imported.ragDocId) === 0)

  const accountRow = await createReviewed(owner.id, "7".repeat(64), "account-delete")
  const accountImported = await importReviewedMaterialToRag({ id: accountRow.id, expectedRevision: 1, actorUserId: adminUser.id, rights, policy }, dependencies)
  const accountRemoval = await removeMaterialRagForAccountDeletion(accountImported, { actorUserId: adminUser.id }, dependencies)
  expect("material-specific account deletion adapter removes the linked RAG copy", accountRemoval.ok && rag.chunks.get(accountImported.ragDocId) === 0)

  const audits = await prisma.dataAuditLog.count({ where: { resourceType: "MaterialSubmission" } })
  expect("ingest and removal transitions are audited", audits >= 12, `audits=${audits}`)
  console.log(`SOL-MAT-08 PostgreSQL probe: PASS (${passed}/${passed})`)
} finally {
  if (prisma) await prisma.$disconnect().catch(() => {})
  if (databaseCreated) {
    await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]).catch(() => {})
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => {})
  }
  const check = await admin.query("SELECT count(*)::int AS count FROM pg_database WHERE datname = $1", [databaseName])
  console.log(`cleanup database=${Number(check.rows[0]?.count ?? -1)} synthetic_remote=memory_only`)
  await admin.end()
}
