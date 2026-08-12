#!/usr/bin/env node
/** SOL-DOC-J-05 — puuduva algfaili fail-closed andmekoopia päris PostgreSQL-is. */

import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import prisma from "../lib/prisma.js"
import { requestDataExport, runNextDataExport } from "../lib/dataExport/service.js"

const marker = `sol-doc-j05-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const email = `${marker}@synthetic.invalid`
const exportDir = await fs.mkdtemp(path.join(os.tmpdir(), "sotsiaalai-j05-"))
const previousDir = process.env.DATA_EXPORT_STORAGE_DIR
process.env.DATA_EXPORT_STORAGE_DIR = exportDir
let owner = null
let jobId = null
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
  const document = await prisma.userDocument.create({
    data: {
      ownerId: owner.id,
      title: "Puuduva faili sond",
      originalName: "missing.txt",
      kind: "MATERIAL",
      agentAllowed: false,
      mime: "text/plain",
      size: 12,
      sha256: "c".repeat(64),
      storagePath: `uploads/${marker}-missing.txt`
    }
  })
  const requested = await requestDataExport(owner.id, {
    db: prisma,
    now: new Date("2000-01-01T00:00:00Z")
  })
  jobId = requested.job.id

  let errorMessage = ""
  try {
    await runNextDataExport({ db: prisma, now: new Date("2000-01-01T00:01:00Z") })
  } catch (error) {
    errorMessage = String(error?.message || "")
  }
  const job = await prisma.dataExportJob.findUnique({ where: { id: jobId } })
  const audit = await prisma.dataAuditLog.findFirst({
    where: { action: "DATA_EXPORT_FAILED", resourceType: "DataExportJob", resourceId: jobId }
  })
  expect("worker katkeb stabiilse dokumendi ID-ga", errorMessage.includes(`data_export.document_file_unreadable|${document.id}|missing`))
  expect("töö lõppseis on FAILED", job?.status === "failed")
  expect("failureCode on masinloetav", job?.failureCode === `data_export.document_file_unreadable|${document.id}|missing`)
  expect("READY väljundteed ei ole", job?.outputPath === null)
  expect("ZIP-faili ei loodud", (await fs.readdir(exportDir)).length === 0)
  expect("FAILED seis on auditeeritud", Boolean(audit))

  console.log(`\nSOL-DOC-J-05 probe: ${passed}/${passed + failed}`)
  if (failed) process.exitCode = 1
} finally {
  if (jobId) await prisma.dataAuditLog.deleteMany({ where: { resourceType: "DataExportJob", resourceId: jobId } }).catch(() => {})
  if (owner?.id) await prisma.user.delete({ where: { id: owner.id } }).catch(() => {})
  await fs.rm(exportDir, { recursive: true, force: true })
  if (previousDir === undefined) delete process.env.DATA_EXPORT_STORAGE_DIR
  else process.env.DATA_EXPORT_STORAGE_DIR = previousDir
  const remaining = await prisma.user.count({ where: { email } }).catch(() => -1)
  console.log(`cleanup users=${remaining}`)
  await prisma.$disconnect()
}
