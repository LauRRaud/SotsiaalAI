#!/usr/bin/env node
/** SOL-DOC-J-03 — taastatav RAG-loaeemaldus päris PostgreSQL-is. RAG ise on süstitud. */

import prisma from "../lib/prisma.js"
import { updateOwnedDocument } from "../lib/documents/documentMutation.js"
import {
  attemptDocumentRagRemoval,
  prepareDocumentRagPermissionChange,
  queueDocumentRagRemovalWithin
} from "../lib/documents/ragPermission.js"
import { createDeletionJobRetryService } from "../lib/privacy/deletionJobRetryService.js"

const marker = `sol-doc-j03-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const email = `${marker}@synthetic.invalid`
let owner = null
let documentId = null
let passed = 0
let failed = 0

function expect(label, condition, detail = "") {
  if (condition) {
    passed += 1
    console.log(`  PASS  ${label}`)
  } else {
    failed += 1
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`)
  }
}

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

async function main() {
  owner = await prisma.user.create({
    data: { email, role: "SOCIAL_WORKER", emailVerified: new Date() }
  })
  const initial = await prisma.userDocument.create({
    data: {
      ownerId: owner.id,
      title: "Sünteetiline RAG-loa sond",
      originalName: "synthetic.txt",
      kind: "MATERIAL",
      agentAllowed: true,
      mime: "text/plain",
      size: 9,
      sha256: "b".repeat(64),
      storagePath: `uploads/${marker}.txt`
    },
    select
  })
  documentId = initial.id

  const revokePlan = prepareDocumentRagPermissionChange({
    document: initial,
    nextAgentAllowed: false,
    metadata: initial.metadata,
    actorUserId: owner.id,
    targetUserId: owner.id
  })
  const pending = await updateOwnedDocument({
    documentId,
    ownerId: owner.id,
    expectedUpdatedAt: initial.updatedAt,
    data: { agentAllowed: false },
    select,
    prepareWithin: revokePlan.prepareWithin
  })
  expect("keelamine loob pending seisu", pending.metadata?.ragRemoval?.status === "pending")
  const jobId = pending.metadata?.ragRemoval?.jobId
  const queued = await prisma.dataDeletionJob.findUnique({ where: { id: jobId } })
  expect("püsiv töö on enne kaugkatset olemas", queued?.status === "pending")

  const failedRemoval = await attemptDocumentRagRemoval(
    { document: pending, actorUserId: owner.id, targetUserId: owner.id },
    { deleteIndex: async () => ({ ok: false, reason: "synthetic_rag_down" }) }
  )
  const failedJob = await prisma.dataDeletionJob.findUnique({ where: { id: jobId } })
  expect("RAG-tõrge jääb dokumendil failed seisu", failedRemoval.metadata?.ragRemoval?.status === "failed")
  expect("RAG-tõrge jääb tööl failed seisu", failedJob?.status === "failed")

  let reenableStatus = null
  try {
    const blockedPlan = prepareDocumentRagPermissionChange({
      document: failedRemoval,
      nextAgentAllowed: true,
      metadata: failedRemoval.metadata,
      actorUserId: owner.id,
      targetUserId: owner.id
    })
    await updateOwnedDocument({
      documentId,
      ownerId: owner.id,
      expectedUpdatedAt: failedRemoval.updatedAt,
      data: { agentAllowed: true },
      select,
      prepareWithin: blockedPlan.prepareWithin
    })
  } catch (error) {
    reenableStatus = error?.status
  }
  expect("lõpetamata delete blokeerib korduslubamise", reenableStatus === 409)

  const retry = createDeletionJobRetryService({
    db: prisma,
    deleteRag: async () => ({ ok: true, missing: true })
  })
  await retry({ jobId, actorUserId: owner.id })
  const afterRetry = await prisma.userDocument.findUnique({ where: { id: documentId }, select })
  const doneJob = await prisma.dataDeletionJob.findUnique({ where: { id: jobId } })
  expect("retry lõpetab sama töö", doneJob?.status === "done")
  expect("retry viib dokumendi seisu done", afterRetry.metadata?.ragRemoval?.status === "done")

  const allowPlan = prepareDocumentRagPermissionChange({
    document: afterRetry,
    nextAgentAllowed: true,
    metadata: afterRetry.metadata,
    actorUserId: owner.id,
    targetUserId: owner.id
  })
  const allowed = await updateOwnedDocument({
    documentId,
    ownerId: owner.id,
    expectedUpdatedAt: afterRetry.updatedAt,
    data: { agentAllowed: true },
    select,
    prepareWithin: allowPlan.prepareWithin
  })
  expect("korduslubamine õnnestub alles pärast done seisu", allowed.agentAllowed === true)

  const auditActions = await prisma.dataAuditLog.findMany({
    where: {
      OR: [
        { resourceType: "UserDocument", resourceId: documentId },
        { resourceType: "DataDeletionJob", resourceId: jobId }
      ]
    },
    select: { action: true }
  })
  const actions = auditActions.map((row) => row.action)
  expect("järjekorda panek on auditeeritud", actions.includes("RAG_DELETE_REQUESTED"))
  expect("tõrge on auditeeritud", actions.includes("RAG_DELETE_PENDING"))
  expect("retry tulemus on auditeeritud", actions.includes("DATA_DELETION_JOB_RETRY_DONE"))

  const disablePlan = prepareDocumentRagPermissionChange({
    document: allowed,
    nextAgentAllowed: false,
    metadata: allowed.metadata,
    actorUserId: owner.id,
    targetUserId: owner.id
  })
  const toggleRace = await Promise.allSettled([
    (async () => {
      const pendingToggle = await updateOwnedDocument({
        documentId,
        ownerId: owner.id,
        expectedUpdatedAt: allowed.updatedAt,
        data: { agentAllowed: false },
        select,
        prepareWithin: disablePlan.prepareWithin
      })
      return attemptDocumentRagRemoval(
        { document: pendingToggle, actorUserId: owner.id, targetUserId: owner.id },
        { deleteIndex: async () => ({ ok: true, missing: true }) }
      )
    })(),
    updateOwnedDocument({
      documentId,
      ownerId: owner.id,
      expectedUpdatedAt: allowed.updatedAt,
      data: { agentAllowed: true },
      select
    })
  ])
  const toggleWinner = toggleRace.find((result) => result.status === "fulfilled")?.value
  const toggleLoser = toggleRace.find((result) => result.status === "rejected")?.reason
  const afterToggleRace = await prisma.userDocument.findUnique({ where: { id: documentId }, select })
  const unresolvedAfterRace = await prisma.dataDeletionJob.count({
    where: { resourceType: "UserDocument", resourceId: documentId, status: { in: ["pending", "failed"] } }
  })
  expect("paralleelne keela/luba: täpselt üks võitja", toggleRace.filter((result) => result.status === "fulfilled").length === 1)
  expect("paralleelne keela/luba: kaotaja saab 409", toggleLoser?.status === 409)
  expect(
    "paralleelne keela/luba: lõppseis on koherentne",
    afterToggleRace.agentAllowed === toggleWinner?.agentAllowed
      && unresolvedAfterRace === 0
      && (afterToggleRace.agentAllowed || afterToggleRace.metadata?.ragRemoval?.status === "done")
  )

  try {
    await prisma.$transaction(async (tx) => {
      const first = await queueDocumentRagRemovalWithin(tx, {
        document: afterToggleRace,
        actorUserId: owner.id,
        targetUserId: owner.id
      })
      const second = await queueDocumentRagRemovalWithin(tx, {
        document: afterToggleRace,
        actorUserId: owner.id,
        targetUserId: owner.id
      })
      expect("sama lõpetamata välisviit kasutab sama tööd", first.id === second.id)
      throw new Error("ROLLBACK_IDEMPOTENCY_PROBE")
    })
  } catch (error) {
    if (error?.message !== "ROLLBACK_IDEMPOTENCY_PROBE") throw error
  }

  console.log(`\nSOL-DOC-J-03 DB probe: ${passed}/${passed + failed}`)
  console.log("RAG runtime: NOT_PROVEN (kohalik RAG-võti/teenus puudub)")
  if (failed) process.exitCode = 1
}

try {
  await main()
} finally {
  if (documentId) {
    const jobRows = await prisma.dataDeletionJob.findMany({
      where: { resourceType: "UserDocument", resourceId: documentId },
      select: { id: true }
    }).catch(() => [])
    await prisma.dataAuditLog.deleteMany({
      where: {
        OR: [
          { resourceType: "UserDocument", resourceId: documentId },
          { resourceType: "DataDeletionJob", resourceId: { in: jobRows.map((row) => row.id) } }
        ]
      }
    }).catch(() => {})
    await prisma.dataDeletionJob.deleteMany({ where: { resourceType: "UserDocument", resourceId: documentId } }).catch(() => {})
  }
  if (owner?.id) await prisma.user.delete({ where: { id: owner.id } }).catch(() => {})
  const [users, jobs, audits] = await Promise.all([
    prisma.user.count({ where: { email } }).catch(() => -1),
    documentId ? prisma.dataDeletionJob.count({ where: { resourceType: "UserDocument", resourceId: documentId } }).catch(() => -1) : 0,
    documentId ? prisma.dataAuditLog.count({ where: { resourceType: "UserDocument", resourceId: documentId } }).catch(() => -1) : 0
  ])
  console.log(`cleanup users=${users} jobs=${jobs} audits=${audits}`)
  await prisma.$disconnect()
}
