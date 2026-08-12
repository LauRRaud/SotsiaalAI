#!/usr/bin/env node
/** SOL-DOC-J-02 — UserDocument CAS-võistlused päris PostgreSQL-is ja päris kettal. */

import fs from "node:fs/promises"

import prisma from "../lib/prisma.js"
import {
  updateOwnedDocument,
  updateOwnedDocumentWithStagedText
} from "../lib/documents/documentMutation.js"
import {
  deleteStoredDocument,
  ensureDocumentsStorage,
  getStoredDocumentPath,
  resolveAbsoluteDocumentPath,
  writeStoredTextDocument
} from "../lib/documents/server.js"

const suffix = `sol-doc-j02-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const email = `${suffix}@synthetic.invalid`
const paths = new Set()
let owner = null
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
  agentAllowed: true,
  content: true,
  size: true,
  sha256: true,
  storagePath: true,
  updatedAt: true
}

async function makeDocument({ title, content = "algne", kind = "MATERIAL", agentAllowed = false }) {
  const storagePath = getStoredDocumentPath(`${title}.txt`)
  const stored = await writeStoredTextDocument(content, storagePath)
  paths.add(storagePath)
  return prisma.userDocument.create({
    data: {
      ownerId: owner.id,
      title,
      originalName: `${title}.txt`,
      kind,
      agentAllowed,
      mime: "text/plain",
      size: stored.size,
      sha256: stored.sha256,
      storagePath,
      content: kind === "AUDIO_TRANSCRIPT" ? content : null
    },
    select
  })
}

function raceShape(results) {
  return {
    winners: results.filter((result) => result.status === "fulfilled"),
    losers: results.filter((result) => result.status === "rejected")
  }
}

async function main() {
  await ensureDocumentsStorage()
  owner = await prisma.user.create({
    data: { email, role: "SOCIAL_WORKER", emailVerified: new Date() }
  })

  const rename = await makeDocument({ title: "rename" })
  const renameRace = raceShape(await Promise.allSettled([
    updateOwnedDocument({ documentId: rename.id, ownerId: owner.id, expectedUpdatedAt: rename.updatedAt, data: { title: "Nimi A" }, select }),
    updateOwnedDocument({ documentId: rename.id, ownerId: owner.id, expectedUpdatedAt: rename.updatedAt, data: { title: "Nimi B" }, select })
  ]))
  const renameCurrent = await prisma.userDocument.findUnique({ where: { id: rename.id }, select })
  expect("kaks rename'i: täpselt üks võitja", renameRace.winners.length === 1)
  expect("kaks rename'i: kaotaja saab 409", renameRace.losers.length === 1 && renameRace.losers[0].reason?.status === 409)
  expect("kaks rename'i: värske nimi vastab võitjale", renameCurrent.title === renameRace.winners[0]?.value?.title)

  const transcript = await makeDocument({ title: "transcript", content: "algne", kind: "AUDIO_TRANSCRIPT", agentAllowed: true })
  const transcriptRace = raceShape(await Promise.allSettled([
    updateOwnedDocumentWithStagedText({ documentId: transcript.id, ownerId: owner.id, expectedUpdatedAt: transcript.updatedAt, storagePath: transcript.storagePath, content: "tekst A", data: {}, select }),
    updateOwnedDocumentWithStagedText({ documentId: transcript.id, ownerId: owner.id, expectedUpdatedAt: transcript.updatedAt, storagePath: transcript.storagePath, content: "tekst B", data: {}, select })
  ]))
  const transcriptCurrent = await prisma.userDocument.findUnique({ where: { id: transcript.id }, select })
  const diskContent = await fs.readFile(resolveAbsoluteDocumentPath(transcript.storagePath), "utf8")
  const siblings = (await fs.readdir(resolveAbsoluteDocumentPath(transcript.storagePath).replace(/[\\/][^\\/]+$/, "")))
    .filter((name) => name.startsWith(resolveAbsoluteDocumentPath(transcript.storagePath).split(/[\\/]/).pop() + "."))
  expect("kaks transkripti: täpselt üks võitja", transcriptRace.winners.length === 1)
  expect("kaks transkripti: kaotaja saab 409", transcriptRace.losers.length === 1 && transcriptRace.losers[0].reason?.status === 409)
  expect("kaks transkripti: DB ja ketas on koherentsed", transcriptCurrent.content === diskContent, `${transcriptCurrent.content}/${diskContent}`)
  expect("kaks transkripti: staged jääke ei ole", siblings.length === 0, siblings.join(","))

  const permission = await makeDocument({ title: "permission", agentAllowed: false })
  const permissionRace = raceShape(await Promise.allSettled([
    updateOwnedDocument({ documentId: permission.id, ownerId: owner.id, expectedUpdatedAt: permission.updatedAt, data: { agentAllowed: true }, select }),
    updateOwnedDocument({ documentId: permission.id, ownerId: owner.id, expectedUpdatedAt: permission.updatedAt, data: { agentAllowed: false }, select })
  ]))
  const permissionCurrent = await prisma.userDocument.findUnique({ where: { id: permission.id }, select })
  expect("loa ristvõistlus: täpselt üks võitja", permissionRace.winners.length === 1)
  expect("loa ristvõistlus: kaotaja saab 409", permissionRace.losers.length === 1 && permissionRace.losers[0].reason?.status === 409)
  expect("loa ristvõistlus: lõppseis vastab võitjale", permissionCurrent.agentAllowed === permissionRace.winners[0]?.value?.agentAllowed)

  console.log(`\nSOL-DOC-J-02 probe: ${passed}/${passed + failed}`)
  if (failed) process.exitCode = 1
}

try {
  await main()
} finally {
  if (owner?.id) await prisma.user.delete({ where: { id: owner.id } }).catch(() => {})
  for (const storagePath of paths) await deleteStoredDocument(storagePath).catch(() => {})
  const remaining = await prisma.user.count({ where: { email } }).catch(() => -1)
  console.log(`cleanup users=${remaining}`)
  await prisma.$disconnect()
}
