#!/usr/bin/env node
/** SOL-DOC-J-04 — SavedAnalysis andmekoopia päris PostgreSQL-is. */

import prisma from "../lib/prisma.js"
import { dataExportInternals } from "../lib/dataExport/service.js"

const marker = `sol-doc-j04-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const emails = [`owner-${marker}@synthetic.invalid`, `foreign-${marker}@synthetic.invalid`]
const userIds = []
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
  const [owner, foreign] = await Promise.all(emails.map((email) => prisma.user.create({
    data: { email, role: "SOCIAL_WORKER", emailVerified: new Date() }
  })))
  userIds.push(owner.id, foreign.id)
  await Promise.all([
    prisma.savedAnalysis.create({
      data: {
        ownerId: owner.id,
        title: "Omaniku sünteetiline analüüs",
        content: "ainult omaniku eksporditav analüüs",
        sourceDocumentIds: ["deleted-source-id"],
        metadata: { disclaimer: "ai_explanation_not_official_decision" }
      }
    }),
    prisma.savedAnalysis.create({
      data: {
        ownerId: foreign.id,
        title: "Võõras sünteetiline analüüs",
        content: "ei tohi omaniku koopiasse jõuda",
        sourceDocumentIds: ["foreign-source-id"]
      }
    })
  ])

  const { entries, manifest } = await dataExportInternals.collectExportEntries(
    { id: `job-${marker}`, userId: owner.id },
    { db: prisma, now: new Date() }
  )
  const entry = entries.find((item) => item.name === "saved-analyses.ndjson")
  const exported = entry?.content?.toString("utf8") || ""
  const surface = manifest.surfaces.find((item) => item.name === "saved_analyses")
  expect("manifest loendab täpselt ühe omaniku analüüsi", surface?.recordCount === 1)
  expect("omaniku sisu on kaasas", exported.includes("ainult omaniku eksporditav analüüs"))
  expect("pealkiri ja disclaimer on kaasas", exported.includes("Omaniku sünteetiline analüüs") && exported.includes("ai_explanation_not_official_decision"))
  expect("kustutatud allika viide säilib", exported.includes("deleted-source-id"))
  expect("võõras sisu on välistatud", !exported.includes("ei tohi omaniku koopiasse jõuda") && !exported.includes("foreign-source-id"))
  expect("pind on versioonitud", surface?.version === "1.0")

  console.log(`\nSOL-DOC-J-04 probe: ${passed}/${passed + failed}`)
  if (failed) process.exitCode = 1
} finally {
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {})
  const remaining = await prisma.user.count({ where: { email: { in: emails } } }).catch(() => -1)
  console.log(`cleanup users=${remaining}`)
  await prisma.$disconnect()
}
