#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"
import pg from "pg"

dotenv.config({ path: ".env.local", quiet: true })
dotenv.config({ path: ".env", quiet: true })

const sourceUrl = String(process.env.DATABASE_URL || "").trim()
if (!sourceUrl) throw new Error("DATABASE_URL is required")
const parsed = new URL(sourceUrl)
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname)) {
  throw new Error("Material notification probe only creates a temporary database on localhost")
}

const databaseName = `sotsiaal_ai_material_notification_probe_${Date.now()}`
if (!/^sotsiaal_ai_material_notification_probe_\d+$/u.test(databaseName)) throw new Error("unsafe probe database name")
const adminUrl = new URL(parsed)
adminUrl.pathname = "/postgres"
adminUrl.search = ""
const probeUrl = new URL(parsed)
probeUrl.pathname = `/${databaseName}`
const admin = new pg.Client({ connectionString: adminUrl.toString() })
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url))
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
  migrate()
  const [{ default: prisma }, { processNextMaterialNotification }] = await Promise.all([
    import("../lib/prisma.js"),
    import("../lib/materials/notifications.js")
  ])

  const owner = await prisma.user.create({
    data: { email: `material-notify-${randomUUID()}@sol.invalid`, role: "SOCIAL_WORKER" }
  })
  const baseTime = new Date("2026-08-13T21:00:00.000Z")
  const config = { to: "admin@sol.invalid", from: "noreply@sol.invalid", baseUrl: "https://app.sol.invalid" }

  async function createBatch(label) {
    const batch = await prisma.materialSubmissionBatch.create({
      data: {
        submittedByUserId: owner.id,
        idempotencyKey: `notification-probe-${label}-${randomUUID()}`,
        requestHash: randomUUID().replaceAll("-", ""),
        status: "COMMITTED",
        notificationStatus: "PENDING",
        notificationNextAt: baseTime
      }
    })
    await prisma.materialSubmission.create({
      data: {
        submittedByUserId: owner.id,
        batchId: batch.id,
        comment: "PRIVATE COMMENT MUST NOT ENTER MAIL",
        originalName: "private-client-name.pdf",
        mime: "application/pdf",
        size: 20,
        sha256: "a".repeat(64),
        storagePath: `materials/${batch.id}.pdf`,
        storageStatus: "ACTIVE",
        scanState: "CLEAN",
        validationState: "VALIDATED",
        scannedAt: baseTime,
        scanEngine: "ProbeClamAV",
        scanEngineVersion: "probe",
        scanSignatureVersion: "probe",
        scanSignatureUpdatedAt: baseTime
      }
    })
    return batch
  }

  const concurrentBatch = await createBatch("parallel")
  const sent = []
  const mailer = { async sendMail(message) { sent.push(message); return { messageId: message.messageId } } }
  const race = await Promise.all([
    processNextMaterialNotification({ db: prisma, now: baseTime, batchId: concurrentBatch.id, config, mailer }),
    processNextMaterialNotification({ db: prisma, now: baseTime, batchId: concurrentBatch.id, config, mailer })
  ])
  const concurrentRow = await prisma.materialSubmissionBatch.findUnique({ where: { id: concurrentBatch.id } })
  expect("two workers send one notification", race.filter((item) => item?.status === "sent").length === 1 && sent.length === 1)
  expect("committed upload intent reaches audited SENT", concurrentRow.notificationStatus === "SENT"
    && await prisma.dataAuditLog.count({ where: { resourceId: concurrentBatch.id, action: "MATERIAL_NOTIFICATION_DELIVERED" } }) === 1)
  expect("admin email contains no submitter, filename, or comment", !JSON.stringify(sent[0]).includes(owner.email)
    && !JSON.stringify(sent[0]).includes("private-client-name")
    && !JSON.stringify(sent[0]).includes("PRIVATE COMMENT"))

  const retryBatch = await createBatch("retry")
  const retryMessages = []
  const failed = await processNextMaterialNotification({
    db: prisma,
    now: baseTime,
    batchId: retryBatch.id,
    config,
    mailer: { async sendMail(message) { retryMessages.push(message); throw Object.assign(new Error("smtp 451"), { responseCode: 451 }) } }
  })
  const afterFailure = await prisma.materialSubmissionBatch.findUnique({ where: { id: retryBatch.id } })
  const retried = await processNextMaterialNotification({
    db: prisma,
    now: afterFailure.notificationNextAt,
    batchId: retryBatch.id,
    config,
    mailer: { async sendMail(message) { retryMessages.push(message); return { messageId: message.messageId } } }
  })
  expect("SMTP failure persists retry state and later succeeds", failed.status === "retry" && retried.status === "sent")
  expect("SMTP retry reuses the stable Message-ID", retryMessages.length === 2 && retryMessages[0].messageId === retryMessages[1].messageId)

  const configBatch = await createBatch("config")
  const missingConfig = await processNextMaterialNotification({
    db: prisma, now: baseTime, batchId: configBatch.id, config: { to: "", from: "" }
  })
  const configRow = await prisma.materialSubmissionBatch.findUnique({ where: { id: configBatch.id } })
  expect("missing config is a visible audited retry", missingConfig.status === "retry"
    && configRow.notificationStatus === "RETRY"
    && await prisma.dataAuditLog.count({ where: { resourceId: configBatch.id, action: "MATERIAL_NOTIFICATION_FAILED" } }) === 1)

  const crashBatch = await createBatch("crash")
  const crashMessages = []
  const crashMailer = { async sendMail(message) { crashMessages.push(message); return { messageId: message.messageId } } }
  const crashed = await Promise.allSettled([processNextMaterialNotification({
    db: prisma,
    now: baseTime,
    batchId: crashBatch.id,
    config,
    mailer: crashMailer,
    audit: async () => { throw new Error("probe_audit_commit_crash") }
  })])
  const stranded = await prisma.materialSubmissionBatch.findUnique({ where: { id: crashBatch.id } })
  const recovered = await processNextMaterialNotification({
    db: prisma,
    now: new Date(baseTime.getTime() + 11 * 60_000),
    batchId: crashBatch.id,
    config,
    mailer: crashMailer
  })
  expect("post-SMTP commit failure leaves a reclaimable durable claim", crashed[0].status === "rejected" && stranded.notificationStatus === "SENDING")
  expect("stale claim recovery reuses the same Message-ID", recovered.status === "sent"
    && crashMessages.length === 2
    && crashMessages[0].messageId === crashMessages[1].messageId)

  console.log(`PROBE_OK ${passed}/${passed}`)
  await prisma.$disconnect()
} finally {
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`).catch(() => {})
  await admin.end().catch(() => {})
  console.log(`CLEANUP_OK dropped=${databaseName}`)
}
