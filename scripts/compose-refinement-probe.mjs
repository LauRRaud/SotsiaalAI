#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { PrismaPg } from "@prisma/adapter-pg"
import dotenv from "dotenv"
import pg from "pg"
import { PrismaClient } from "../generated/prisma/client.ts"
import {
  buildArtifactRefinementRequestHash,
  claimArtifactRefinement,
  persistArtifactRefinement
} from "../lib/documents/artifactRefinements.js"
import { approveArtifact, updateDraftArtifact } from "../lib/documents/artifactMutation.js"

dotenv.config({ path: ".env.local", quiet: true })
dotenv.config({ path: ".env", quiet: true })
const sourceUrl = String(process.env.DATABASE_URL || "").trim()
if (!sourceUrl) throw new Error("DATABASE_URL puudub")
const parsed = new URL(sourceUrl)
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname})`)
}
const databaseName = `sotsiaal_ai_comp_refine_probe_${Date.now()}`
const adminUrl = new URL(parsed)
adminUrl.pathname = "/postgres"
adminUrl.search = ""
const probeUrl = new URL(parsed)
probeUrl.pathname = `/${databaseName}`
const admin = new pg.Client({ connectionString: adminUrl.toString() })
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url))
const makeDb = () => new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }), log: [] })
const db = makeDb()
const other = makeDb()
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

async function createArtifact(ownerId, suffix) {
  return db.agentArtifact.create({
    data: { ownerId, type: "REPORT_DRAFT", title: suffix, content: `algne-${suffix}`, status: "DRAFT" }
  })
}

async function persist(claim, artifact, content) {
  return db.$transaction((tx) => persistArtifactRefinement(
    {
      refinementId: claim.refinement.id,
      claimToken: claim.refinement.claimToken,
      ownerId: artifact.ownerId,
      artifactId: artifact.id,
      expectedUpdatedAt: artifact.updatedAt,
      content,
      used: claim.used,
      commitUsage: async () => null
    },
    { db: tx }
  ))
}

async function main() {
  console.log("SOL-COMP-01/02/03 — päris-DB refinement'i elutsüklisond\n")
  await admin.connect()
  await admin.query(`CREATE DATABASE "${databaseName}"`)
  const migrated = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: probeUrl.toString() }, stdio: "pipe", shell: false
  })
  if (migrated.error) throw migrated.error
  if (migrated.status !== 0) throw new Error(`prisma migrate deploy failed (${migrated.status})\n${migrated.stderr}`)

  const owner = await db.user.create({ data: { email: "comp-refine@probe.invalid", role: "SOCIAL_WORKER", emailVerified: new Date() } })
  const artifact = await createArtifact(owner.id, "race")
  const payload = { artifactId: artifact.id, expectedUpdatedAt: artifact.updatedAt.toISOString(), instruction: "täpsusta" }
  const claim = await claimArtifactRefinement({
    artifactId: artifact.id,
    ownerId: owner.id,
    idempotencyKey: "race-1",
    requestHash: buildArtifactRefinementRequestHash(payload),
    expectedUpdatedAt: artifact.updatedAt,
    leaseMs: 60_000
  }, { db })

  const patchResult = await db.$transaction((tx) => updateDraftArtifact(
    { artifactId: artifact.id, ownerId: owner.id, expectedUpdatedAt: artifact.updatedAt, content: "stale-patch" },
    { db: tx }
  )).then(() => null, error => error)
  const approveResult = await other.$transaction((tx) => approveArtifact(
    { artifactId: artifact.id, ownerId: owner.id, expectedUpdatedAt: artifact.updatedAt },
    { db: tx }
  )).then(() => null, error => error)
  expect("aktiivne refine blokeerib PATCH-i enne kirjutust", patchResult?.status === 409)
  expect("aktiivne refine blokeerib approve'i enne kirjutust", approveResult?.status === 409)
  expect("kaotajad ei muutnud artefakti", (await db.agentArtifact.findUnique({ where: { id: artifact.id } })).content === artifact.content)

  const completed = await persist(claim, artifact, "püsiv tulemus")
  expect("refinement püsistab tulemuse artefakti", (await db.agentArtifact.findUnique({ where: { id: artifact.id } })).content === "püsiv tulemus")
  const retry = await claimArtifactRefinement({
    artifactId: artifact.id,
    ownerId: owner.id,
    idempotencyKey: "race-1",
    requestHash: buildArtifactRefinementRequestHash(payload),
    expectedUpdatedAt: artifact.updatedAt
  }, { db })
  expect("sama võti tagastab pärast vastuse kadu sama tulemuse", retry.cached && retry.refinement.resultContent === completed.content)
  expect("sama võti ei loo teist mudelitöö rida", await db.agentArtifactRefinement.count({ where: { artifactId: artifact.id } }) === 1)
  expect("kinnitatud refinement jätab ühe auditirea", await db.documentAudit.count({ where: { artifactId: artifact.id, action: "ARTIFACT_REFINE" } }) === 1)

  const crashArtifact = await createArtifact(owner.id, "crash")
  const crashHash = buildArtifactRefinementRequestHash({ artifactId: crashArtifact.id, expectedUpdatedAt: crashArtifact.updatedAt.toISOString() })
  const first = await claimArtifactRefinement({
    artifactId: crashArtifact.id,
    ownerId: owner.id,
    idempotencyKey: "crash-1",
    requestHash: crashHash,
    expectedUpdatedAt: crashArtifact.updatedAt,
    now: new Date("2026-08-13T10:00:00Z"),
    leaseMs: 1000
  }, { db })
  const recovered = await claimArtifactRefinement({
    artifactId: crashArtifact.id,
    ownerId: owner.id,
    idempotencyKey: "crash-1",
    requestHash: crashHash,
    expectedUpdatedAt: crashArtifact.updatedAt,
    now: new Date("2026-08-13T10:00:02Z"),
    leaseMs: 60_000
  }, { db: other })
  expect("uus protsess võtab aegunud lease'i sama tööna üle", recovered.refinement.id === first.refinement.id && recovered.refinement.attempts === 2)
  expect("lease'i ülevõtt ei kuluta teist slot'i", recovered.refinement.slotAuditId === first.refinement.slotAuditId)
  const zombie = await persist(first, crashArtifact, "zombi").then(() => null, error => error)
  expect("vana claim ei saa pärast ülevõttu kirjutada", zombie?.status === 409)
  await persist(recovered, crashArtifact, "taastatud")
  expect("uus claim lõpetab taastatud tulemuse", (await db.agentArtifact.findUnique({ where: { id: crashArtifact.id } })).content === "taastatud")

  const finalArtifact = await createArtifact(owner.id, "final")
  await db.agentArtifact.update({ where: { id: finalArtifact.id }, data: { status: "FINAL" } })
  const beforeJobs = await db.agentArtifactRefinement.count()
  const finalError = await claimArtifactRefinement({
    artifactId: finalArtifact.id,
    ownerId: owner.id,
    idempotencyKey: "final-1",
    requestHash: "x".repeat(64),
    expectedUpdatedAt: finalArtifact.updatedAt
  }, { db }).then(() => null, error => error)
  expect("FINAL-refine katkeb 409-ga enne job'i", finalError?.status === 409)
  expect("FINAL-refine ei jäta slot'i ega job'i", await db.agentArtifactRefinement.count() === beforeJobs)

  console.log(`\n${passed}/${passed + failed} kontrolli läbis.`)
  if (failed) process.exitCode = 1
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1 })
  .finally(async () => {
    await Promise.all([db.$disconnect().catch(() => null), other.$disconnect().catch(() => null)])
    await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]).catch(() => null)
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null)
    await admin.end().catch(() => null)
    console.log("CLEANUP_OK temporary_database_removed")
  })
