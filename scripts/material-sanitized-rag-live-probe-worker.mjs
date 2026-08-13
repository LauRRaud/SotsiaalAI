#!/usr/bin/env node

import assert from "node:assert/strict"
import crypto from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import prisma from "../lib/prisma.js"
import {
  importReviewedMaterialToRag,
  queueMaterialRagDeletion,
  retryMaterialRagDeletion
} from "../lib/materials/ragLifecycle.js"
import { reviewMaterialSubmission } from "../lib/materials/review.js"
import { retentionFieldsForSubmission } from "../lib/materials/retentionPolicy.js"
import {
  deleteStoredMaterial,
  getSanitizedMaterialPath,
  readSanitizedMaterial,
  storedMaterialExists,
  writeMaterialBuffer
} from "../lib/materials/server.js"
import { buildRagHeaders, deleteRagDocument, ragServiceRequest } from "../lib/documents/ragService.js"
import {
  assertLocalDocumentRagProbeConfig,
  isRemoteDocumentCopyAbsent
} from "./document-rag-removal-live-safety.mjs"

const marker = `sol-mat-08-live-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`
const rawOnly = `RAW-ONLY-${marker}`
const sanitizedOnly = `SANITIZED-ONLY-${marker}`
const raw = Buffer.from(rawOnly)
const derivative = Buffer.from(`${sanitizedOnly}\n`)
const rawHash = crypto.createHash("sha256").update(raw).digest("hex")
const storagePath = `uploads/${marker}.txt`
const ragHost = process.env.RAG_INTERNAL_HOST || process.env.RAG_API_BASE

let storageRoot = null
let ownerId = null
let submissionId = null
let ragDocId = null

async function remote(id) {
  try {
    return await ragServiceRequest(`/documents/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: buildRagHeaders()
    })
  } catch (error) {
    if (Number(error?.status) === 404) return null
    throw error
  }
}

async function search(query, docId) {
  return ragServiceRequest("/search", {
    method: "POST",
    headers: buildRagHeaders(),
    body: JSON.stringify({ query, top_k: 5, filterDocId: docId })
  })
}

async function main() {
  const config = assertLocalDocumentRagProbeConfig({
    databaseUrl: process.env.DATABASE_URL,
    ragHost,
    ragServiceKey: process.env.RAG_SERVICE_API_KEY
  })
  storageRoot = await mkdtemp(path.join(tmpdir(), "sol-mat-08-storage-"))
  process.env.MATERIALS_STORAGE_DIR = storageRoot
  const health = await fetch(`${config.ragBaseUrl}/health`, { cache: "no-store" })
  assert.equal(health.ok, true)

  const owner = await prisma.user.create({
    data: { email: `${marker}@synthetic.invalid`, role: "SOCIAL_WORKER", emailVerified: new Date() }
  })
  ownerId = owner.id
  await writeMaterialBuffer(raw, storagePath)
  await writeMaterialBuffer(derivative, getSanitizedMaterialPath(storagePath))
  const createdAt = new Date()
  const submission = await prisma.materialSubmission.create({
    data: {
      submittedByUserId: ownerId,
      comment: "synthetic isolated material probe",
      originalName: "synthetic.txt",
      mime: "text/plain",
      size: raw.length,
      sha256: rawHash,
      storagePath,
      storageStatus: "ACTIVE",
      scanState: "CLEAN",
      validationState: "VALIDATED",
      scannedAt: new Date(),
      scanEngine: "Synthetic local ClamAV",
      scanEngineVersion: "1.0",
      scanSignatureVersion: "synthetic-1",
      scanSignatureUpdatedAt: createdAt,
      ...retentionFieldsForSubmission("pending", createdAt)
    }
  })
  submissionId = submission.id
  await reviewMaterialSubmission({
    id: submission.id,
    action: "mark_reviewed",
    expectedRevision: 0,
    reviewedBy: "synthetic-probe",
    actorUserId: ownerId
  })

  const imported = await importReviewedMaterialToRag({
    id: submission.id,
    expectedRevision: 1,
    actorUserId: ownerId,
    rights: {
      authorName: "Synthetic author",
      rightsHolder: "Synthetic rights holder",
      rightsBasis: "DOCUMENTED_PERMISSION",
      rightsEvidence: "synthetic probe permission",
      clientCaseMaterial: false,
      confidential: false,
      containsPersonalData: false
    }
  })
  ragDocId = imported.ragDocId
  assert.equal(imported.derivativeStoragePath, getSanitizedMaterialPath(storagePath))
  assert.equal(imported.derivativeRetentionState, "SCHEDULED")
  assert.equal(imported.ragRetentionState, "SCHEDULED")
  assert.equal(imported.contentSafetyState, "ALLOWED")
  assert.ok(imported.originalRetentionUntil < imported.derivativeRetentionUntil)
  assert.equal(imported.derivativeRetentionUntil.getTime(), imported.ragRetentionUntil.getTime())
  assert.ok(Number((await remote(ragDocId))?.chunks) > 0, "ingest receipt must be remotely present")
  assert.match(JSON.stringify(await search(sanitizedOnly, ragDocId)), /SANITIZED-ONLY/u)
  assert.doesNotMatch(JSON.stringify(await search(rawOnly, ragDocId)), /RAW-ONLY/u)
  assert.equal((await readSanitizedMaterial(storagePath)).toString(), `${sanitizedOnly}\n`)

  const queued = await queueMaterialRagDeletion({ submission: imported, actorUserId: ownerId, reason: "synthetic_probe" })
  const completed = await retryMaterialRagDeletion({ jobId: queued.job.id, actorUserId: ownerId })
  assert.equal(completed.status, "done")
  assert.equal(isRemoteDocumentCopyAbsent(await remote(ragDocId)), true)
  assert.equal(Number((await search(sanitizedOnly, ragDocId))?.results?.length || 0), 0)

  console.log("SOL-MAT-08 sanitized RAG live probe: PASS")
  console.log("runtime=PROVEN raw=isolated derivative=ingested search=present delete=absent")
}

async function cleanup() {
  if (ragDocId) await deleteRagDocument(ragDocId).catch(() => {})
  if (storagePath) await deleteStoredMaterial(storagePath).catch(() => {})
  if (storagePath) await deleteStoredMaterial(getSanitizedMaterialPath(storagePath)).catch(() => {})
  if (submissionId) {
    await prisma.dataAuditLog.deleteMany({ where: { resourceId: submissionId } }).catch(() => {})
    await prisma.dataDeletionJob.deleteMany({ where: { resourceId: submissionId } }).catch(() => {})
    await prisma.materialSubmission.deleteMany({ where: { id: submissionId } }).catch(() => {})
  }
  if (ownerId) await prisma.user.deleteMany({ where: { id: ownerId } }).catch(() => {})
  const counts = {
    users: ownerId ? await prisma.user.count({ where: { id: ownerId } }).catch(() => -1) : 0,
    submissions: submissionId ? await prisma.materialSubmission.count({ where: { id: submissionId } }).catch(() => -1) : 0,
    jobs: ragDocId ? await prisma.dataDeletionJob.count({ where: { externalRef: ragDocId } }).catch(() => -1) : 0,
    raw: await storedMaterialExists(storagePath).catch(() => true),
    derivative: await storedMaterialExists(getSanitizedMaterialPath(storagePath)).catch(() => true)
  }
  if (storageRoot) await rm(storageRoot, { recursive: true, force: true })
  console.log(`cleanup users=${counts.users} submissions=${counts.submissions} jobs=${counts.jobs} raw=${Number(counts.raw)} derivative=${Number(counts.derivative)}`)
  assert.deepEqual(counts, { users: 0, submissions: 0, jobs: 0, raw: false, derivative: false })
}

try {
  await main()
} catch (error) {
  console.error(`SOL-MAT-08 sanitized RAG live probe: NOT_PROVEN — ${error?.message || "unknown error"}`)
  process.exitCode = 1
} finally {
  await cleanup().catch(error => {
    console.error(`cleanup failed: ${error?.message || "unknown error"}`)
    process.exitCode = 1
  })
  await prisma.$disconnect()
}
