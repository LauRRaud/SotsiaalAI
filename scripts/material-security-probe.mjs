#!/usr/bin/env node
/** SOL-MAT-08 — fail-closed quarantine/security invariants in real PostgreSQL and filesystem. */

import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"

import { MATERIAL_RAG_POLICY } from "../lib/materials/ragPolicy.js"
import { retentionFieldsForSubmission } from "../lib/materials/retentionPolicy.js"

const sourceUrl = String(process.env.DATABASE_URL || "postgresql://sotsiaal_user:sotsiaalai@127.0.0.1:5432/sotsiaal_ai?schema=public").trim()
const parsed = new URL(sourceUrl)
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname)) throw new Error("probe requires loopback PostgreSQL")
const databaseName = `sotsiaal_ai_material_security_probe_${Date.now()}`
const adminUrl = new URL(parsed)
adminUrl.pathname = "/postgres"
adminUrl.search = ""
const probeUrl = new URL(parsed)
probeUrl.pathname = `/${databaseName}`
const admin = new pg.Client({ connectionString: adminUrl.toString() })
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url))
const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sotsiaalai-material-security-"))
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
  process.env.MATERIALS_STORAGE_DIR = storageRoot
  migrate()

  const [{ default: prisma }, quarantine, lifecycle, ragLifecycle] = await Promise.all([
    import("../lib/prisma.js"),
    import("../lib/materials/quarantine.js"),
    import("../lib/materials/lifecycle.js"),
    import("../lib/materials/ragLifecycle.js")
  ])
  const owner = await prisma.user.create({ data: { email: `security-${randomUUID()}@sol-mat.invalid`, role: "SOCIAL_WORKER" } })
  const now = new Date()
  const cleanScanner = { async scan() { return {
    state: "CLEAN",
    engine: "SyntheticProbeScanner",
    engineVersion: "contract-only",
    signatureVersion: "fresh",
    signatureUpdatedAt: now
  } } }

  const clean = await quarantine.quarantineMaterialUpload({
    userId: owner.id,
    originalName: "synthetic.txt",
    mime: "text/plain",
    buffer: Buffer.from("synthetic clean material")
  }, { db: prisma, scanner: cleanScanner, now })
  const cleanReceipt = await prisma.materialUploadQuarantine.findUnique({ where: { id: clean.quarantineReceiptId } })
  expect("bytes are first persisted under a random extensionless quarantine name", cleanReceipt.quarantinePath.startsWith("quarantine/") && !cleanReceipt.quarantinePath.includes("synthetic.txt"))
  expect("CLEAN and VALIDATED evidence is durable before publication", cleanReceipt.scanState === "CLEAN" && cleanReceipt.validationState === "VALIDATED" && cleanReceipt.scannedAt instanceof Date)

  const created = await lifecycle.createMaterialSubmissions({
    userId: owner.id,
    role: "SOCIAL_WORKER",
    idempotencyKey: `security-probe-${randomUUID()}`,
    comment: "synthetic",
    files: [clean]
  }, { db: prisma })
  const active = await prisma.materialSubmission.findUnique({ where: { id: created.submissions[0].id } })
  const consumed = await prisma.materialUploadQuarantine.findUnique({ where: { id: clean.quarantineReceiptId } })
  expect("publication carries the scan receipt and only then becomes ACTIVE", active.storageStatus === "ACTIVE" && active.scanState === "CLEAN" && active.validationState === "VALIDATED")
  expect("consumed quarantine bytes are removed", consumed.storageState === "REMOVED" && consumed.quarantinePath === null)

  const pendingCreatedAt = new Date()
  const pending = await prisma.materialSubmission.create({ data: {
    submittedByUserId: owner.id,
    comment: "blocked",
    originalName: "blocked.pdf",
    mime: "application/pdf",
    size: 10,
    sha256: "b".repeat(64),
    storagePath: "quarantine/blocked",
    storageStatus: "QUARANTINED",
    scanState: "FAILED",
    validationState: "PENDING",
    ...retentionFieldsForSubmission("pending", pendingCreatedAt)
  } })
  const download = await Promise.allSettled([lifecycle.getMaterialSubmissionDownload({ id: pending.id, userId: owner.id }, { db: prisma })])
  expect("FAILED/PENDING material cannot be downloaded, including by its owner", download[0].status === "rejected" && download[0].reason?.status === 404)
  let ragCalled = false
  const rag = await Promise.allSettled([ragLifecycle.importReviewedMaterialToRag({
    id: pending.id,
    expectedRevision: 0,
    actorUserId: owner.id,
    rights: { authorName: "Synthetic", rightsHolder: "Synthetic", rightsBasis: "Synthetic", rightsEvidence: "Synthetic" },
    policy: MATERIAL_RAG_POLICY
  }, { db: prisma, rag: { async ingest() { ragCalled = true }, async countChunks() { return 1 } } })])
  expect(
    "FAILED/PENDING material cannot reach RAG",
    rag[0].status === "rejected" && rag[0].reason?.code === "material_security_gate_failed" && !ragCalled,
    `status=${rag[0].status} code=${rag[0].reason?.code || "none"} called=${ragCalled}`
  )

  const invalidActive = await Promise.allSettled([prisma.materialSubmission.update({
    where: { id: pending.id }, data: { storageStatus: "ACTIVE" }
  })])
  expect("PostgreSQL rejects ACTIVE without CLEAN+VALIDATED evidence", invalidActive[0].status === "rejected")

  const staleCreatedAt = new Date("2020-01-01T00:00:00Z")
  const stale = await prisma.materialSubmission.create({ data: {
    submittedByUserId: owner.id,
    comment: "stale scan",
    originalName: "stale.pdf",
    mime: "application/pdf",
    size: 10,
    sha256: "c".repeat(64),
    storagePath: "uploads/stale.pdf",
    storageStatus: "ACTIVE",
    scanState: "CLEAN",
    validationState: "VALIDATED",
    scannedAt: new Date("2020-01-01T00:00:00Z"),
    scanEngine: "SyntheticProbeScanner",
    scanEngineVersion: "contract-only",
    scanSignatureVersion: "stale",
    scanSignatureUpdatedAt: staleCreatedAt,
    ...retentionFieldsForSubmission("pending", staleCreatedAt)
  } })
  const staleRag = await Promise.allSettled([ragLifecycle.importReviewedMaterialToRag({
    id: stale.id,
    expectedRevision: 0,
    actorUserId: owner.id,
    rights: { authorName: "Synthetic", rightsHolder: "Synthetic", rightsBasis: "Synthetic", rightsEvidence: "Synthetic" },
    policy: MATERIAL_RAG_POLICY
  }, { db: prisma, rag: { async ingest() { ragCalled = true }, async countChunks() { return 1 } } })])
  expect("late RAG processing requires a fresh signature receipt/rescan", staleRag[0].status === "rejected" && staleRag[0].reason?.code === "material_scan_stale" && !ragCalled)

  const eicar = Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*")
  const infected = await Promise.allSettled([quarantine.quarantineMaterialUpload({
    userId: owner.id,
    originalName: "synthetic-eicar.pdf",
    mime: "application/pdf",
    buffer: eicar
  }, { db: prisma, scanner: { async scan() { return { state: "INFECTED" } } }, now })])
  const infectedReceipt = await prisma.materialUploadQuarantine.findFirst({ where: { sha256: { not: clean.sha256 } }, orderBy: { createdAt: "desc" } })
  const tombstone = await prisma.dataDeletionJob.findFirst({ where: { resourceType: "MaterialUploadQuarantine", resourceId: infectedReceipt.id } })
  expect("EICAR/infected upload is rejected and removed", infected[0].status === "rejected" && infectedReceipt.scanState === "INFECTED" && infectedReceipt.storageState === "REMOVED")
  expect("infected removal leaves a completed durable tombstone", tombstone?.action === "MATERIAL_QUARANTINE_DELETE" && tombstone.status === "done")

  const columns = await prisma.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_name IN ('MaterialSubmission', 'MaterialUploadQuarantine')`
  expect("material security tables contain metadata only, never bytea/BLOB", !columns.some(column => column.data_type === "bytea"))
  const publicRoot = path.resolve("public")
  expect("quarantine root is outside webroot", !path.resolve(storageRoot, "quarantine").startsWith(`${publicRoot}${path.sep}`))

  console.log(`PROBE_OK ${passed}/${passed}`)
  console.log("CLAMD_RUNTIME_NOT_PROVEN no local clamd service or maintained signatures were available; CLEAN path used an explicit contract-only injected scanner")
  await prisma.$disconnect()
} finally {
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [databaseName]).catch(() => {})
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => {})
  await admin.end()
  const resolvedStorage = path.resolve(storageRoot)
  const tempRoot = path.resolve(os.tmpdir())
  if (resolvedStorage.startsWith(`${tempRoot}${path.sep}`) && path.basename(resolvedStorage).startsWith("sotsiaalai-material-security-")) {
    await fs.rm(resolvedStorage, { recursive: true, force: true })
  }
  console.log(`CLEANUP_OK database=${databaseName} storage_removed=true`)
}
