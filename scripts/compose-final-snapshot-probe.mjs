#!/usr/bin/env node
import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import process from "node:process"
import { fileURLToPath } from "node:url"

import { PrismaPg } from "@prisma/adapter-pg"
import dotenv from "dotenv"
import pg from "pg"

import { PrismaClient } from "../generated/prisma/client.ts"
import { createArtifactDocxBuffer } from "../lib/documents/docxExport.js"
import { finalizeArtifact, readFinalArtifactDownload } from "../lib/documents/artifactFinalization.js"
import {
  deleteStoredDocument,
  getStoredDocumentPath,
  writeStoredBuffer
} from "../lib/documents/server.js"

dotenv.config({ path: ".env.local", quiet: true })
dotenv.config({ path: ".env", quiet: true })
const sourceUrl = String(process.env.DATABASE_URL || "").trim()
if (!sourceUrl) throw new Error("DATABASE_URL puudub")
const parsed = new URL(sourceUrl)
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname})`)
}
const databaseName = `sotsiaal_ai_comp_final_probe_${Date.now()}`
const adminUrl = new URL(parsed)
adminUrl.pathname = "/postgres"
adminUrl.search = ""
const probeUrl = new URL(parsed)
probeUrl.pathname = `/${databaseName}`
const admin = new pg.Client({ connectionString: adminUrl.toString() })
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url))
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }), log: [] })
let templatePath = null
let passed = 0
let failed = 0

const hash = (value) => crypto.createHash("sha256").update(value).digest("hex")
function expect(label, condition) {
  if (condition) {
    passed += 1
    console.log(`  PASS  ${label}`)
  } else {
    failed += 1
    console.error(`  FAIL  ${label}`)
  }
}

async function main() {
  console.log("SOL-COMP-05 — päris-DB külmutatud lõppdokumendi sond\n")
  await admin.connect()
  await admin.query(`CREATE DATABASE "${databaseName}"`)
  const migrated = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: probeUrl.toString() }, stdio: "pipe", shell: false
  })
  if (migrated.error) throw migrated.error
  if (migrated.status !== 0) throw new Error(`prisma migrate deploy failed (${migrated.status})\n${migrated.stderr}`)

  const owner = await db.user.create({
    data: { email: "comp-final@probe.invalid", role: "SOCIAL_WORKER", emailVerified: new Date() }
  })
  const source = await db.userDocument.create({
    data: {
      ownerId: owner.id,
      title: "Algne allikas",
      originalName: "allikas.txt",
      kind: "MATERIAL",
      agentAllowed: true,
      mime: "text/plain",
      size: 12,
      sha256: hash("algne allikas"),
      storagePath: "uploads/probe-source.txt"
    }
  })
  templatePath = getStoredDocumentPath("probe-template.docx")
  const templateBytes = createArtifactDocxBuffer({
    artifact: { title: "Mall", type: "REPORT_DRAFT", content: "{{CONTENT}}" },
    sources: []
  })
  const storedTemplate = await writeStoredBuffer(templateBytes, templatePath)
  const template = await db.userDocument.create({
    data: {
      ownerId: owner.id,
      title: "Algne mall",
      originalName: "mall.docx",
      kind: "TEMPLATE",
      templateFor: "REPORT_DRAFT",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: storedTemplate.size,
      sha256: storedTemplate.sha256,
      storagePath: templatePath
    }
  })
  const artifact = await db.agentArtifact.create({
    data: {
      ownerId: owner.id,
      type: "REPORT_DRAFT",
      title: "Külmutatud tulemus",
      content: "Kinnitatud sisu",
      templateId: template.id,
      metadata: {
        generation: {
          model: "probe-model",
          promptVersion: "probe-prompt-v1",
          retrievalMode: "rag",
          evidenceChunks: [{ sourceDocumentId: source.id, chunkId: "chunk-7", chunkIndex: 7, textSha256: hash("tõend") }]
        }
      },
      sourceDocuments: { create: { documentId: source.id } }
    }
  })

  const finalized = await db.$transaction((tx) => finalizeArtifact(
    { artifactId: artifact.id, ownerId: owner.id, expectedUpdatedAt: artifact.updatedAt },
    { db: tx, now: new Date("2026-08-13T12:00:00Z") }
  ))
  const manifest = finalized.artifact.finalSnapshot.manifest
  expect("kinnitus ja hetktõmmis commit'iti koos", finalized.artifact.status === "FINAL" && Boolean(finalized.artifact.finalSnapshot))
  expect("manifest külmutas sisu, mudeli ja prompti", manifest.contentSha256 === hash("Kinnitatud sisu") && manifest.model === "probe-model" && manifest.promptVersion === "probe-prompt-v1")
  expect("manifest külmutas täpse tüki", manifest.evidenceChunks?.[0]?.chunkId === "chunk-7" && manifest.evidenceChunks?.[0]?.chunkIndex === 7)
  expect("manifest külmutas allika ja malli räsi", manifest.sources?.[0]?.sha256 === source.sha256 && manifest.templateSha256 === template.sha256)

  const firstDocx = await readFinalArtifactDownload({ artifactId: artifact.id, ownerId: owner.id, format: "docx" }, { db })
  const firstPdf = await readFinalArtifactDownload({ artifactId: artifact.id, ownerId: owner.id, format: "pdf" }, { db })
  await db.userDocument.update({ where: { id: source.id }, data: { title: "Ümber nimetatud", sha256: hash("muudetud") } })
  await db.agentArtifact.update({ where: { id: artifact.id }, data: { metadata: { generation: { evidenceChunks: [{ chunkId: "uus" }] } } } })
  await db.userDocument.delete({ where: { id: source.id } })
  await db.userDocument.delete({ where: { id: template.id } })
  await deleteStoredDocument(templatePath)
  templatePath = null

  const secondDocx = await readFinalArtifactDownload({ artifactId: artifact.id, ownerId: owner.id, format: "docx" }, { db })
  const secondPdf = await readFinalArtifactDownload({ artifactId: artifact.id, ownerId: owner.id, format: "pdf" }, { db })
  expect("allika kustutus kaskaadis ainult elava seose", await db.agentArtifactSourceDocument.count({ where: { artifactId: artifact.id } }) === 0)
  expect("allika ja malli kustutus säilitas tombstone-manifesti", secondDocx.manifest.sources?.[0]?.title === "Algne allikas" && secondDocx.manifest.template?.title === "Algne mall")
  expect("hilisem RAG-meta muutus ei muutnud tüki päritolu", secondDocx.manifest.evidenceChunks?.[0]?.chunkId === "chunk-7")
  expect("korduv DOCX on bait-identne", firstDocx.bytes.equals(secondDocx.bytes) && firstDocx.sha256 === secondDocx.sha256)
  expect("korduv PDF on bait-identne", firstPdf.bytes.equals(secondPdf.bytes) && firstPdf.sha256 === secondPdf.sha256)

  const rollbackArtifact = await db.agentArtifact.create({
    data: { ownerId: owner.id, type: "REPORT_DRAFT", content: "rollback", status: "DRAFT" }
  })
  const quotaError = await db.$transaction((tx) => finalizeArtifact(
    { artifactId: rollbackArtifact.id, ownerId: owner.id, maxSnapshotBytes: 0 },
    { db: tx }
  )).then(() => null, (error) => error)
  const rolledBack = await db.agentArtifact.findUnique({
    where: { id: rollbackArtifact.id }, include: { finalSnapshot: true }
  })
  expect("hetktõmmise kvoodiviga tagastab 413", quotaError?.status === 413)
  expect("hetktõmmise viga rollback'is ka FINAL-muutuse", rolledBack.status === "DRAFT" && rolledBack.finalSnapshot === null)

  console.log(`\n${passed}/${passed + failed} kontrolli läbis.`)
  if (failed) process.exitCode = 1
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1 })
  .finally(async () => {
    if (templatePath) await deleteStoredDocument(templatePath).catch(() => null)
    await db.$disconnect().catch(() => null)
    await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]).catch(() => null)
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null)
    await admin.end().catch(() => null)
    console.log("CLEANUP_OK temporary_database_removed")
  })
