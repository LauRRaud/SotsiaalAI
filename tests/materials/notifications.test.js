import test from "node:test"
import assert from "node:assert/strict"

import {
  materialNotificationInternals,
  processNextMaterialNotification
} from "../../lib/materials/notifications.js"

const NOW = new Date("2026-08-13T21:00:00.000Z")

function makeDb(overrides = {}) {
  const batch = {
    id: "batch-1",
    submittedByUserId: "owner-1",
    status: "COMMITTED",
    notificationStatus: "PENDING",
    notificationMessageId: null,
    notificationAttempts: 0,
    notificationLastError: null,
    notificationNextAt: NOW,
    notificationClaimedAt: null,
    notifiedAt: null,
    ...overrides
  }
  const audits = []
  const db = {
    state: { batch, audits },
    materialSubmissionBatch: {
      findFirst: async () => {
        const ready = ["PENDING", "RETRY"].includes(batch.notificationStatus)
          ? batch.notificationNextAt <= NOW
          : batch.notificationStatus === "SENDING"
        return batch.status === "COMMITTED" && ready ? { ...batch } : null
      },
      updateMany: async ({ where, data }) => {
        if (where.id !== batch.id || where.notificationStatus !== batch.notificationStatus) return { count: 0 }
        if (where.notificationClaimedAt && where.notificationClaimedAt !== batch.notificationClaimedAt) return { count: 0 }
        for (const [key, value] of Object.entries(data)) {
          batch[key] = value && typeof value === "object" && "increment" in value
            ? Number(batch[key] || 0) + value.increment
            : value
        }
        return { count: 1 }
      },
      findUnique: async () => ({ ...batch, _count: { submissions: 2 } })
    },
    dataAuditLog: {
      create: async ({ data }) => {
        audits.push(data)
        return data
      }
    }
  }
  db.$transaction = async fn => fn(db)
  return db
}

const config = { to: "admin@example.test", from: "noreply@example.test", baseUrl: "https://app.example.test" }

test("material notification Message-ID is stable for the same batch", () => {
  assert.equal(
    materialNotificationInternals.messageIdForBatch("batch-1"),
    materialNotificationInternals.messageIdForBatch("batch-1")
  )
  assert.notEqual(
    materialNotificationInternals.messageIdForBatch("batch-1"),
    materialNotificationInternals.messageIdForBatch("batch-2")
  )
})

test("missing mail configuration becomes an audited visible retry", async () => {
  const db = makeDb()
  const result = await processNextMaterialNotification({ db, now: NOW, config: { to: "", from: "" } })
  assert.equal(result.status, "retry")
  assert.equal(db.state.batch.notificationStatus, "RETRY")
  assert.equal(db.state.batch.notificationLastError, "NO_RECIPIENT")
  assert.equal(db.state.audits[0].action, "MATERIAL_NOTIFICATION_FAILED")
})

test("SMTP retry reuses one Message-ID and sends no submitter, filename, or comment", async () => {
  const db = makeDb()
  const messages = []
  const failingMailer = {
    async sendMail(message) {
      messages.push(message)
      throw Object.assign(new Error("smtp down"), { responseCode: 451 })
    }
  }
  const first = await processNextMaterialNotification({ db, now: NOW, config, mailer: failingMailer })
  assert.equal(first.status, "retry")
  db.state.batch.notificationNextAt = NOW
  const succeedingMailer = { async sendMail(message) { messages.push(message); return { messageId: message.messageId } } }
  const second = await processNextMaterialNotification({ db, now: NOW, config, mailer: succeedingMailer })
  assert.equal(second.status, "sent")
  assert.equal(messages[0].messageId, messages[1].messageId)
  assert.doesNotMatch(JSON.stringify(messages), /owner-1|filename|comment|\.pdf/u)
  assert.equal(db.state.batch.notificationStatus, "SENT")
})

test("parallel notification workers claim one batch once", async () => {
  const db = makeDb()
  const messages = []
  const mailer = { async sendMail(message) { messages.push(message); return { messageId: message.messageId } } }
  const results = await Promise.all([
    processNextMaterialNotification({ db, now: NOW, config, mailer }),
    processNextMaterialNotification({ db, now: NOW, config, mailer })
  ])
  assert.equal(results.filter(item => item?.status === "sent").length, 1)
  assert.equal(messages.length, 1)
})
