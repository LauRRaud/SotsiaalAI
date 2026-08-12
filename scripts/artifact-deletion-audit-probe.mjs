#!/usr/bin/env node
/** SOL-DOC-J-06 — artefakti kustutuse auditiaatomilisus päris PostgreSQL-is. */

import prisma from "../lib/prisma.js"
import { deleteOwnedArtifactWithAudit } from "../lib/documents/artifactDeletion.js"

const marker = `sol-doc-j06-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const email = `${marker}@synthetic.invalid`
let owner = null
let artifactId = null
let passed = 0
let failed = 0

function expect(label, condition) {
  if (condition) {
    passed += 1
    console.log(`  PASS  ${label}`)
  } else {
    failed += 1
    console.error(`  FAIL  ${label}`)
  }
}

try {
  owner = await prisma.user.create({
    data: { email, role: "SOCIAL_WORKER", emailVerified: new Date() }
  })
  const artifact = await prisma.agentArtifact.create({
    data: {
      ownerId: owner.id,
      type: "OTHER",
      title: "Sünteetiline kustutusauditi artefakt",
      status: "FINAL",
      content: "sünteetiline sisu",
      approvedAt: new Date()
    }
  })
  artifactId = artifact.id

  const failingDb = {
    $transaction: (run) => prisma.$transaction((tx) => run({
      agentArtifact: tx.agentArtifact,
      documentAudit: {
        create: async () => { throw new Error("INJECTED_DOCUMENT_AUDIT_FAILURE") }
      }
    }))
  }
  let auditFailure = false
  try {
    await deleteOwnedArtifactWithAudit({ artifact, ownerId: owner.id }, { db: failingDb })
  } catch (error) {
    auditFailure = error?.message === "INJECTED_DOCUMENT_AUDIT_FAILURE"
  }
  expect("audititõrge jõuab kutsujani", auditFailure)
  expect("audititõrge pöörab kustutuse tagasi", await prisma.agentArtifact.count({ where: { id: artifact.id } }) === 1)
  expect("audititõrke järel ei ole auditirida", await prisma.documentAudit.count({
    where: { ownerId: owner.id, action: "ARTIFACT_DELETE", meta: { path: ["deletedArtifactId"], equals: artifact.id } }
  }) === 0)

  await deleteOwnedArtifactWithAudit({ artifact, ownerId: owner.id })
  expect("edukas tehing kustutab artefakti", await prisma.agentArtifact.count({ where: { id: artifact.id } }) === 0)
  expect("edukas tehing kirjutab ühe auditi stabiilse ID-ga", await prisma.documentAudit.count({
    where: { ownerId: owner.id, action: "ARTIFACT_DELETE", meta: { path: ["deletedArtifactId"], equals: artifact.id } }
  }) === 1)

  console.log(`\nSOL-DOC-J-06 probe: ${passed}/${passed + failed}`)
  if (failed) process.exitCode = 1
} finally {
  if (artifactId && owner?.id) await prisma.documentAudit.deleteMany({
    where: { ownerId: owner.id, action: "ARTIFACT_DELETE", meta: { path: ["deletedArtifactId"], equals: artifactId } }
  }).catch(() => {})
  if (owner?.id) await prisma.user.delete({ where: { id: owner.id } }).catch(() => {})
  const remaining = await prisma.user.count({ where: { email } }).catch(() => -1)
  console.log(`cleanup users=${remaining}`)
  await prisma.$disconnect()
}
