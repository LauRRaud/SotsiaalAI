import crypto from "node:crypto"

import { getMailer } from "@/lib/mailer"
import prisma from "@/lib/prisma"
import { writeDataAudit } from "@/lib/privacy/audit"

const DEFAULT_ATTEMPT_LIMIT = 6
const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_STALE_MS = 10 * 60_000

function positiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

function messageIdForBatch(batchId) {
  const digest = crypto.createHash("sha256").update(`material-notification:${batchId}`).digest("hex").slice(0, 32)
  return `<${digest}@sotsiaal.ai>`
}

function backoffMs(attempt) {
  return Math.min(24 * 60 * 60_000, 60_000 * 2 ** Math.min(Math.max(attempt - 1, 0), 10))
}

function safeCode(error) {
  const code = String(error?.code || "").trim().toUpperCase()
  if (code === "EMAIL_TIMEOUT") return code
  if (/^[A-Z0-9_-]{2,80}$/u.test(code)) return code
  const status = Number(error?.responseCode || error?.status)
  if (Number.isFinite(status)) return `SMTP_${status}`
  return "SMTP_FAILED"
}

function notificationConfig(overrides = {}) {
  return {
    to: String(overrides.to ?? process.env.MATERIALS_NOTIFY_TO ?? "").trim().toLowerCase(),
    from: String(overrides.from ?? process.env.EMAIL_FROM ?? process.env.SMTP_FROM ?? "").trim(),
    baseUrl: String(overrides.baseUrl ?? process.env.NEXTAUTH_URL ?? "").trim().replace(/\/+$/u, "")
  }
}

async function finishNotification(db, row, data, audit, action, meta = {}) {
  return db.$transaction(async (tx) => {
    const updated = await tx.materialSubmissionBatch.updateMany({
      where: { id: row.id, notificationStatus: "SENDING", notificationClaimedAt: row.notificationClaimedAt },
      data
    })
    if (updated.count !== 1) throw new Error("material_notification_claim_lost")
    await audit({
      db: tx,
      actorUserId: null,
      targetUserId: row.submittedByUserId,
      action,
      resourceType: "MaterialSubmissionBatch",
      resourceId: row.id,
      meta: { attempts: row.notificationAttempts, ...meta }
    })
  })
}

export async function processNextMaterialNotification({
  db = prisma,
  now = new Date(),
  batchId = null,
  mailer = null,
  audit = writeDataAudit,
  config = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
  attemptLimit = DEFAULT_ATTEMPT_LIMIT,
  staleMs = DEFAULT_STALE_MS
} = {}) {
  const limit = positiveInteger(attemptLimit, DEFAULT_ATTEMPT_LIMIT)
  const staleBefore = new Date(now.getTime() - positiveInteger(staleMs, DEFAULT_STALE_MS))
  const candidate = await db.materialSubmissionBatch.findFirst({
    where: {
      status: "COMMITTED",
      ...(batchId ? { id: String(batchId) } : {}),
      notificationAttempts: { lt: limit },
      OR: [
        { notificationStatus: { in: ["PENDING", "RETRY"] }, notificationNextAt: { lte: now } },
        { notificationStatus: "SENDING", notificationClaimedAt: { lte: staleBefore } }
      ]
    },
    orderBy: [{ notificationNextAt: "asc" }, { id: "asc" }]
  })
  if (!candidate) return null

  const messageId = candidate.notificationMessageId || messageIdForBatch(candidate.id)
  const claim = await db.materialSubmissionBatch.updateMany({
    where: {
      id: candidate.id,
      notificationStatus: candidate.notificationStatus,
      notificationAttempts: { lt: limit },
      ...(candidate.notificationStatus === "SENDING"
        ? { notificationClaimedAt: candidate.notificationClaimedAt }
        : { notificationNextAt: candidate.notificationNextAt })
    },
    data: {
      notificationStatus: "SENDING",
      notificationClaimedAt: now,
      notificationMessageId: messageId,
      notificationAttempts: { increment: 1 },
      notificationLastError: null
    }
  })
  if (claim.count !== 1) return { status: "lost_race" }

  const row = await db.materialSubmissionBatch.findUnique({
    where: { id: candidate.id },
    include: { _count: { select: { submissions: true } } }
  })
  const resolved = notificationConfig(config)
  const invalidConfig = !resolved.to.includes("@") ? "NO_RECIPIENT" : !resolved.from ? "EMAIL_FROM_MISSING" : null
  if (invalidConfig) {
    const retry = Number(row.notificationAttempts || 0) < limit
    await finishNotification(db, row, {
      notificationStatus: retry ? "RETRY" : "FAILED",
      notificationClaimedAt: null,
      notificationNextAt: retry ? new Date(now.getTime() + backoffMs(row.notificationAttempts)) : null,
      notificationLastError: invalidConfig
    }, audit, "MATERIAL_NOTIFICATION_FAILED", { errorCode: invalidConfig, retry })
    return { status: retry ? "retry" : "failed", errorCode: invalidConfig, batchId: row.id }
  }

  const count = Number(row?._count?.submissions || 0)
  const adminUrl = resolved.baseUrl ? `${resolved.baseUrl}/materials` : null
  const transport = mailer || getMailer("material-notification-outbox")
  let timeoutHandle
  try {
    await Promise.race([
      transport.sendMail({
        to: resolved.to,
        from: resolved.from,
        subject: "Uus materjalide esitis",
        text: [
          `Materjalide ülevaatusjärjekorda lisati ${count} faili.`,
          adminUrl ? `Ava järjekord: ${adminUrl}` : "Ava Materjalide adminivaade."
        ].join("\n\n"),
        messageId
      }),
      new Promise((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(Object.assign(new Error("material notification timeout"), { code: "EMAIL_TIMEOUT" })),
          positiveInteger(timeoutMs, DEFAULT_TIMEOUT_MS)
        )
      })
    ])
    clearTimeout(timeoutHandle)
    await finishNotification(db, row, {
      notificationStatus: "SENT",
      notificationClaimedAt: null,
      notificationNextAt: null,
      notificationLastError: null,
      notifiedAt: now
    }, audit, "MATERIAL_NOTIFICATION_DELIVERED", { fileCount: count })
    return { status: "sent", batchId: row.id, messageId }
  } catch (error) {
    clearTimeout(timeoutHandle)
    const errorCode = safeCode(error)
    const retry = Number(row.notificationAttempts || 0) < limit
    await finishNotification(db, row, {
      notificationStatus: retry ? "RETRY" : "FAILED",
      notificationClaimedAt: null,
      notificationNextAt: retry ? new Date(now.getTime() + backoffMs(row.notificationAttempts)) : null,
      notificationLastError: errorCode
    }, audit, "MATERIAL_NOTIFICATION_FAILED", { errorCode, retry })
    return { status: retry ? "retry" : "failed", errorCode, batchId: row.id, messageId }
  }
}

export const materialNotificationInternals = Object.freeze({ backoffMs, messageIdForBatch, safeCode })
