#!/usr/bin/env node
/**
 * SOL-DOC-J-03 live boundary probe worker.
 *
 * The command refuses non-loopback PostgreSQL and RAG endpoints. It creates
 * only uniquely named synthetic rows/content and removes both the remote RAG
 * copy and local rows in finally, including after a failed assertion.
 */

import assert from "node:assert/strict"
import crypto from "node:crypto"

import prisma from "../lib/prisma.js"
import { buildAgentRagDocumentId, ensureDocumentIndexed } from "../lib/documents/embeddings.js"
import { updateOwnedDocument } from "../lib/documents/documentMutation.js"
import {
  attemptDocumentRagRemoval,
  prepareDocumentRagPermissionChange
} from "../lib/documents/ragPermission.js"
import {
  deleteRagDocument,
  ragServiceRequest,
  buildRagHeaders
} from "../lib/documents/ragService.js"
import { searchDocumentChunks } from "../lib/documents/search.js"
import { createDeletionJobRetryService } from "../lib/privacy/deletionJobRetryService.js"
import { deleteUserWithPrivacyCleanup } from "../lib/privacy/userDeletion.js"
import {
  assertLocalDocumentRagProbeConfig,
  isRemoteDocumentCopyAbsent
} from "./document-rag-removal-live-safety.mjs"

const marker = `sol-doc-j03-live-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`
const email = `${marker}@synthetic.invalid`
const content = `Sünteetiline RAG eemaldussond ${marker}. Sellel tekstil ei ole päris isiku andmeid.`
const sha256 = crypto.createHash("sha256").update(content).digest("hex")
const ragHost = process.env.RAG_INTERNAL_HOST || process.env.RAG_API_BASE

let ownerId = null
let documentId = null
let ragDocId = null
let remoteTouched = false

const select = {
  id: true,
  ownerId: true,
  title: true,
  originalName: true,
  kind: true,
  agentAllowed: true,
  mime: true,
  size: true,
  sha256: true,
  storagePath: true,
  content: true,
  metadata: true,
  createdAt: true,
  updatedAt: true
}

async function getRemoteDocument(id) {
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

async function assertRemoteAbsent(document, label) {
  const remote = await getRemoteDocument(ragDocId)
  assert.equal(
    isRemoteDocumentCopyAbsent(remote),
    true,
    `${label}: GET must prove 404 or a clean tombstone with zero chunks`
  )
  const results = await searchDocumentChunks(marker, [document], 5, {
    route: "probe/document-rag-removal",
    stage: label,
    userId: ownerId
  })
  assert.equal(results.length, 0, `${label}: scoped search must return no chunks`)
}

async function main() {
  const config = assertLocalDocumentRagProbeConfig({
    databaseUrl: process.env.DATABASE_URL,
    ragHost,
    ragServiceKey: process.env.RAG_SERVICE_API_KEY
  })

  const health = await fetch(`${config.ragBaseUrl}/health`, { cache: "no-store" })
  assert.equal(health.ok, true, `loopback RAG health failed with ${health.status}`)

  const owner = await prisma.user.create({
    data: { email, role: "SOCIAL_WORKER", emailVerified: new Date() }
  })
  ownerId = owner.id
  const initial = await prisma.userDocument.create({
    data: {
      ownerId,
      title: "Sünteetiline RAG eemaldussond",
      originalName: "synthetic-transcript.txt",
      kind: "CALL_TRANSCRIPT",
      agentAllowed: true,
      mime: "text/plain",
      size: Buffer.byteLength(content),
      sha256,
      storagePath: `uploads/${marker}.txt`,
      content
    },
    select
  })
  documentId = initial.id

  ragDocId = buildAgentRagDocumentId(initial)
  remoteTouched = true
  const indexed = await ensureDocumentIndexed(initial, {
    route: "probe/document-rag-removal",
    stage: "initial_ingest",
    userId: ownerId
  })
  assert.equal(indexed.ragDocId, ragDocId)
  const beforeDisable = await getRemoteDocument(ragDocId)
  assert.ok(Number(beforeDisable?.chunks) > 0, "negative control: remote copy must exist before disable")
  const beforeSearch = await searchDocumentChunks(marker, [initial], 5)
  assert.ok(beforeSearch.some(result => result.docId === ragDocId), "negative control: scoped search must find the copy")

  const revokePlan = prepareDocumentRagPermissionChange({
    document: initial,
    nextAgentAllowed: false,
    metadata: initial.metadata,
    actorUserId: ownerId,
    targetUserId: ownerId
  })
  const pending = await updateOwnedDocument({
    documentId,
    ownerId,
    expectedUpdatedAt: initial.updatedAt,
    data: { agentAllowed: false },
    select,
    prepareWithin: revokePlan.prepareWithin
  })
  const jobId = pending.metadata?.ragRemoval?.jobId
  assert.ok(jobId, "disable must persist a deletion job before the remote attempt")

  const failed = await attemptDocumentRagRemoval(
    { document: pending, actorUserId: ownerId, targetUserId: ownerId },
    { deleteIndex: async () => ({ ok: false, reason: "synthetic_first_attempt_failure" }) }
  )
  const failedJob = await prisma.dataDeletionJob.findUnique({ where: { id: jobId } })
  assert.equal(failed.metadata?.ragRemoval?.status, "failed")
  assert.equal(failedJob?.status, "failed")
  assert.ok(await getRemoteDocument(ragDocId), "failed attempt must leave the remote copy present for retry proof")

  const retry = createDeletionJobRetryService({
    db: prisma,
    deleteRag: (externalRef, observability) => deleteRagDocument(externalRef, observability)
  })
  await retry({ jobId, actorUserId: ownerId })
  const removed = await prisma.userDocument.findUnique({ where: { id: documentId }, select })
  const completedJob = await prisma.dataDeletionJob.findUnique({ where: { id: jobId } })
  assert.equal(completedJob?.status, "done")
  assert.equal(removed?.metadata?.ragRemoval?.status, "done")
  await assertRemoteAbsent(removed, "permission_retry")

  const allowPlan = prepareDocumentRagPermissionChange({
    document: removed,
    nextAgentAllowed: true,
    metadata: removed.metadata,
    actorUserId: ownerId,
    targetUserId: ownerId
  })
  const reallowed = await updateOwnedDocument({
    documentId,
    ownerId,
    expectedUpdatedAt: removed.updatedAt,
    data: { agentAllowed: true },
    select,
    prepareWithin: allowPlan.prepareWithin
  })
  await ensureDocumentIndexed(reallowed, {
    route: "probe/document-rag-removal",
    stage: "fresh_reingest",
    userId: ownerId
  })
  assert.ok(Number((await getRemoteDocument(ragDocId))?.chunks) > 0, "re-enable must create a fresh remote copy")

  const accountRagJobsBefore = await prisma.dataDeletionJob.count({
    where: {
      action: "RAG_DELETE",
      resourceType: "UserDocument",
      resourceId: documentId,
      externalRef: ragDocId
    }
  })

  const accountDeletion = await deleteUserWithPrivacyCleanup({
    actorUserId: ownerId,
    targetUserId: ownerId,
    reason: "synthetic_document_rag_live_probe"
  })
  assert.equal(accountDeletion.ok, true, "synthetic account deletion must cross the real RAG delete boundary")
  assert.equal(await prisma.user.count({ where: { id: ownerId } }), 0)
  await assertRemoteAbsent(reallowed, "account_deletion")

  const accountRagJobs = await prisma.dataDeletionJob.findMany({
    where: {
      action: "RAG_DELETE",
      resourceType: "UserDocument",
      resourceId: documentId,
      externalRef: ragDocId
    },
    orderBy: { createdAt: "asc" }
  })
  assert.equal(accountRagJobs.length, accountRagJobsBefore + 1, "account deletion must persist its own external deletion job")
  assert.equal(accountRagJobs.at(-1)?.status, "done", "account deletion RAG job must carry provider-confirmed done state")

  console.log("SOL-DOC-J-03 live RAG probe: PASS")
  console.log("runtime=PROVEN ingest=present disable_retry=absent reingest=present account_delete=absent")
}

async function cleanup() {
  let remoteCleanup = remoteTouched ? "pending" : "not_touched"
  if (remoteTouched && ragDocId) {
    const deletion = await deleteRagDocument(ragDocId, {
      route: "probe/document-rag-removal",
      stage: "finally_cleanup",
      userId: ownerId
    })
    remoteCleanup = Boolean(deletion?.ok)
      && isRemoteDocumentCopyAbsent(await getRemoteDocument(ragDocId))
      ? "absent"
      : "failed"
  }

  if (ownerId || documentId || ragDocId) {
    const jobs = await prisma.dataDeletionJob.findMany({
      where: {
        OR: [
          ...(ownerId ? [{ targetUserId: ownerId }, { resourceId: ownerId }] : []),
          ...(documentId ? [{ resourceId: documentId }] : []),
          ...(ragDocId ? [{ externalRef: ragDocId }] : [])
        ]
      },
      select: { id: true }
    }).catch(() => [])
    const jobIds = jobs.map(job => job.id)
    await prisma.dataAuditLog.deleteMany({
      where: {
        OR: [
          ...(ownerId ? [{ actorUserId: ownerId }, { targetUserId: ownerId }, { resourceId: ownerId }] : []),
          ...(documentId ? [{ resourceId: documentId }] : []),
          ...(jobIds.length ? [{ resourceId: { in: jobIds } }] : [])
        ]
      }
    }).catch(() => {})
    if (jobIds.length) {
      await prisma.dataDeletionJob.deleteMany({ where: { id: { in: jobIds } } }).catch(() => {})
    }
    if (documentId) await prisma.userDocument.deleteMany({ where: { id: documentId } }).catch(() => {})
    if (ownerId) await prisma.user.deleteMany({ where: { id: ownerId } }).catch(() => {})
  }

  const [users, documents, jobs, audits] = await Promise.all([
    ownerId ? prisma.user.count({ where: { id: ownerId } }).catch(() => -1) : 0,
    documentId ? prisma.userDocument.count({ where: { id: documentId } }).catch(() => -1) : 0,
    ragDocId ? prisma.dataDeletionJob.count({ where: { externalRef: ragDocId } }).catch(() => -1) : 0,
    documentId ? prisma.dataAuditLog.count({ where: { resourceId: documentId } }).catch(() => -1) : 0
  ])
  console.log(`cleanup remote=${remoteCleanup} users=${users} documents=${documents} jobs=${jobs} audits=${audits}`)
}

try {
  await main()
} catch (error) {
  console.error(`SOL-DOC-J-03 live RAG probe: NOT_PROVEN — ${error?.message || "unknown error"}`)
  process.exitCode = 1
} finally {
  await cleanup().catch(error => {
    console.error(`cleanup failed: ${error?.message || "unknown error"}`)
    process.exitCode = 1
  })
  await prisma.$disconnect()
}
