/**
 * FIELD-V1 safety check-in sweep (doc ptk 6, O-FD-3). Server-side dead-man
 * model: escalation fires on the ABSENCE of a departure confirmation, so it
 * works precisely when the worker's device is offline. Runs from the same
 * notification job the production 5-minute timer already calls.
 *
 * The escalation e-mail is deliberately minimal (doc 6.3): worker name,
 * planned window, the fact that the check-in is missing and the worker's own
 * instructions. No client name, no address, no visit content. This is NOT an
 * emergency service and both the UI and the e-mail say so.
 */

import prisma from "@/lib/prisma";
import { getMailer, hasConfiguredEmailTransport } from "@/lib/mailer";
import { createNotificationEvent, NOTIFICATION_EVENT_TYPES } from "@/lib/notifications";
import { logDataAudit } from "@/lib/privacy/audit";
import { safeError } from "@/lib/privacy/safeError";
import { enqueuePaymentEmail, runPaymentEmailDelivery } from "@/lib/payments/emailOutbox";
import { FIELD_SAFETY } from "./constants.js";

function cleanEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return email && email.includes("@") ? email : "";
}

function formatWindow(visit) {
  const start = visit.plannedStartAt ? new Date(visit.plannedStartAt).toISOString().slice(0, 16).replace("T", " ") : null;
  const deadline = visit.safetyDeadlineAt
    ? new Date(visit.safetyDeadlineAt).toISOString().slice(0, 16).replace("T", " ")
    : null;
  return { start, deadline };
}

export function buildFieldSafetyEscalationEmail({ visit, workerName }) {
  const { start, deadline } = formatWindow(visit);
  const contact = visit.safetyContactName ? `${visit.safetyContactName}` : "";
  const lines = [
    contact ? `Tere, ${contact}!` : "Tere!",
    "",
    `SotsiaalAI välitöö kontrollaken: ${workerName} määras Sind oma usalduskontaktiks ega ole kinnitanud külastuselt lahkumist kokkulepitud ajaks${deadline ? ` (${deadline} UTC)` : ""}.`,
    start ? `Planeeritud algus: ${start} UTC.` : null,
    "",
    visit.safetyInstructions
      ? `Töötaja enda juhis Sulle: ${visit.safetyInstructions}`
      : "Töötaja ei lisanud eraldi juhist. Mõistlik esimene samm on talle helistada.",
    "",
    "NB! See teavitus EI OLE hädaabiteenus ega asenda seda. Kui Sa töötajat kätte ei saa ja on põhjust arvata, et ta võib olla ohus, helista hädaabinumbrile 112.",
    "Kui töötaja kinnitab lahkumise hiljem, saadetakse Sulle eraldi teade, et olukord on lahenenud."
  ].filter((line) => line !== null);
  return {
    subject: `Välitöö kontrollaken: ${workerName} ei ole lahkumist kinnitanud`,
    text: lines.join("\n")
  };
}

export function buildFieldSafetyResolvedEmail({ visit, workerName }) {
  const contact = visit.safetyContactName ? `${visit.safetyContactName}` : "";
  const lines = [
    contact ? `Tere, ${contact}!` : "Tere!",
    "",
    `Olukord on lahenenud: ${workerName} kinnitas külastuselt lahkumise. Varasem kontrollakna teade oli seega valehäire või hilinenud kinnitus.`,
    "",
    "Aitäh, et olid valmis reageerima."
  ];
  return {
    subject: `Lahenenud: ${workerName} kinnitas lahkumise`,
    text: lines.join("\n")
  };
}

async function workerDisplayName(db, ownerUserId) {
  const user = await db.user.findUnique({
    where: { id: ownerUserId },
    select: { profile: { select: { firstName: true, lastName: true } }, email: true }
  });
  const name = [user?.profile?.firstName, user?.profile?.lastName]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
  return name || String(user?.email || "SotsiaalAI kasutaja");
}

const SAFETY_EMAIL_TEMPLATES = Object.freeze([
  "field_safety_escalation",
  "field_safety_resolved"
]);

function visitSafetyDeliveryStatus(status) {
  if (status === "SENT") return "SENT";
  if (status === "AMBIGUOUS" || status === "SENDING") return "UNKNOWN";
  if (["FAILED", "SKIPPED"].includes(status)) return "FAILED";
  return "PENDING";
}

export async function reconcileFieldSafetyEmailOutbox({ db = prisma, now = new Date() } = {}) {
  const rows = await db.paymentEmailOutbox.findMany({
    where: { template: { in: SAFETY_EMAIL_TEMPLATES } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });
  const counters = { sent: 0, escalationSent: 0, resolvedSent: 0, failed: 0, pending: 0, unknown: 0 };
  for (const row of rows) {
    const visitId = String(row.payload?.visitId || "");
    if (!visitId) continue;
    const status = visitSafetyDeliveryStatus(row.status);
    const isResolved = row.template === "field_safety_resolved";
    const data = isResolved
      ? {
          safetyResolvedNoticeStatus: status,
          ...(status === "SENT" ? { safetyResolvedNotifiedAt: row.sentAt || now } : {})
        }
      : {
          safetyEscalationStatus: status,
          ...(status === "SENT" ? { safetyEscalatedAt: row.sentAt || now } : {})
        };
    const terminalField = isResolved ? "safetyResolvedNoticeStatus" : "safetyEscalationStatus";
    const changed = await db.fieldVisit.updateMany({
      where: {
        id: visitId,
        OR: [{ [terminalField]: null }, { [terminalField]: { not: status } }]
      },
      data
    });
    if (changed.count && status === "SENT") {
      await logDataAudit({
        db,
        targetUserId: row.payload?.ownerUserId || null,
        action: isResolved ? "field.safety_resolved_notice" : "field.safety_escalated",
        resourceType: "FIELD_VISIT",
        resourceId: visitId,
        meta: { outboxId: row.id }
      });
    }
    if (status === "SENT") counters[isResolved ? "resolvedSent" : "escalationSent"] += 1;
    counters[status === "SENT" ? "sent" : status === "FAILED" ? "failed" : status === "UNKNOWN" ? "unknown" : "pending"] += 1;
  }
  return counters;
}

async function enqueueSafetyEmail(db, visit, kind, now) {
  const recipient = cleanEmail(visit.safetyContactEmail);
  if (!recipient) return { enqueued: false, reason: "recipient_missing" };
  const workerName = await workerDisplayName(db, visit.ownerUserId);
  const message = kind === "resolved"
    ? buildFieldSafetyResolvedEmail({ visit, workerName })
    : buildFieldSafetyEscalationEmail({ visit, workerName });
  return enqueuePaymentEmail(db, {
    dedupeKey: `field-safety:${visit.id}:${kind}`,
    template: kind === "resolved" ? "field_safety_resolved" : "field_safety_escalation",
    toEmail: recipient,
    locale: "et",
    payload: {
      visitId: visit.id,
      ownerUserId: visit.ownerUserId,
      kind,
      subject: message.subject,
      text: message.text
    },
    now
  });
}

/**
 * One sweep pass. Injectable mailer/now for tests; with no configured
 * transport the attempt fails visibly into the retry/backoff path — the
 * worker sees "signal did not reach the contact" instead of a silent no-op.
 */
export async function runFieldSafetySweep({
  db = prisma,
  now = new Date(),
  mailer = null,
  dryRun = false,
  batchSize = 25,
  emailTimeoutMs = 15_000
} = {}) {
  const counters = {
    reminders: 0,
    escalated: 0,
    escalationFailed: 0,
    resolvedNotices: 0,
    skipped: 0
  };
  const take = Math.max(1, Math.min(Number(batchSize) || 25, 100));
  const from = cleanEmail(process.env.EMAIL_FROM ?? process.env.SMTP_FROM);
  const transportReady = Boolean(from) && (Boolean(mailer) || hasConfiguredEmailTransport());
  const activeSafetyWhere = {
    safetyArmedAt: { not: null },
    safetyCancelledAt: null,
    departedConfirmedAt: null,
    closedAt: null,
    cancelledAt: null
  };

  // 1) Reminder to the worker shortly before the deadline (in-app + OPTIONAL
  //    e-mail via the existing notification conveyor).
  const remindBefore = new Date(now.getTime() + FIELD_SAFETY.REMINDER_BEFORE_MS);
  const dueReminders = await db.fieldVisit.findMany({
    where: {
      ...activeSafetyWhere,
      safetyRemindedAt: null,
      safetyDeadlineAt: { not: null, lte: remindBefore }
    },
    select: { id: true, ownerUserId: true, safetyDeadlineAt: true },
    orderBy: { safetyDeadlineAt: "asc" },
    take
  });
  for (const visit of dueReminders) {
    if (dryRun) {
      counters.reminders += 1;
      continue;
    }
    try {
      await createNotificationEvent(
        {
          userId: visit.ownerUserId,
          type: NOTIFICATION_EVENT_TYPES.FIELD_CHECKIN_DUE,
          sourceId: visit.id,
          targetId: visit.id,
          dedupeSuffix: visit.safetyDeadlineAt.toISOString(),
          emailPolicy: "OPTIONAL"
        },
        { db, now }
      );
      await db.fieldVisit.updateMany({
        where: { id: visit.id, safetyRemindedAt: null },
        data: { safetyRemindedAt: now }
      });
      counters.reminders += 1;
    } catch (error) {
      counters.skipped += 1;
      console.error("[field-safety] reminder failed", safeError(error));
    }
  }

  // 2) Queue escalation to the trusted contact after deadline + grace.
  const escalationCutoff = new Date(now.getTime() - FIELD_SAFETY.GRACE_MS);
  const dueEscalations = await db.fieldVisit.findMany({
    where: {
      ...activeSafetyWhere,
      safetyDeadlineAt: { not: null, lte: escalationCutoff },
      safetyEscalationAttempts: { lt: FIELD_SAFETY.MAX_ESCALATION_ATTEMPTS },
      AND: [
        {
          OR: [
            { safetyEscalationStatus: null },
            { safetyEscalationStatus: { not: FIELD_SAFETY.STATUS_SENT } }
          ]
        },
        {
          OR: [
            { safetyEscalationNextAttemptAt: null },
            { safetyEscalationNextAttemptAt: { lte: now } }
          ]
        }
      ]
    },
    select: {
      id: true,
      ownerUserId: true,
      plannedStartAt: true,
      safetyDeadlineAt: true,
      safetyContactName: true,
      safetyContactEmail: true,
      safetyInstructions: true,
      safetyEscalationAttempts: true,
      safetyEscalationNextAttemptAt: true
    },
    orderBy: { safetyDeadlineAt: "asc" },
    take
  });
  for (const visit of dueEscalations) {
    if (dryRun) {
      counters.escalated += 1;
      continue;
    }
    try {
      const queued = await enqueueSafetyEmail(db, visit, "escalation", now);
      if (!queued.enqueued && queued.reason !== "duplicate") {
        await db.fieldVisit.updateMany({
          where: { id: visit.id },
          data: { safetyEscalationStatus: "FAILED" }
        });
        counters.escalationFailed += 1;
        continue;
      }
      if (queued.enqueued) {
        await db.fieldVisit.updateMany({
          where: { id: visit.id, departedConfirmedAt: null, safetyCancelledAt: null },
          data: {
            safetyEscalationStatus: "PENDING",
            safetyEscalationAttempts: { increment: 1 },
            safetyEscalationNextAttemptAt: null
          }
        });
      }
    } catch (error) {
      await db.fieldVisit.updateMany({
        where: { id: visit.id },
        data: { safetyEscalationStatus: "FAILED" }
      });
      counters.escalationFailed += 1;
      console.error("[field-safety] escalation enqueue failed", safeError(error));
    }
  }

  // 3) Queue the resolved notice. The sent timestamp is set only after the
  // shared outbox has confirmed delivery.
  const dueResolved = await db.fieldVisit.findMany({
    where: {
      safetyEscalatedAt: { not: null },
      safetyResolvedNotifiedAt: null,
      OR: [{ departedConfirmedAt: { not: null } }, { safetyCancelledAt: { not: null } }]
    },
    select: {
      id: true,
      ownerUserId: true,
      safetyContactName: true,
      safetyContactEmail: true
    },
    take
  });
  for (const visit of dueResolved) {
    if (dryRun) {
      counters.resolvedNotices += 1;
      continue;
    }
    try {
      const queued = await enqueueSafetyEmail(db, visit, "resolved", now);
      if (!queued.enqueued && queued.reason !== "duplicate") {
        await db.fieldVisit.updateMany({ where: { id: visit.id }, data: { safetyResolvedNoticeStatus: "FAILED" } });
        counters.skipped += 1;
        continue;
      }
      if (queued.enqueued) {
        await db.fieldVisit.updateMany({
          where: { id: visit.id, safetyResolvedNotifiedAt: null },
          data: { safetyResolvedNoticeStatus: "PENDING" }
        });
      }
    } catch (error) {
      await db.fieldVisit.updateMany({ where: { id: visit.id }, data: { safetyResolvedNoticeStatus: "FAILED" } });
      counters.skipped += 1;
      console.error("[field-safety] resolved enqueue failed", safeError(error));
    }
  }

  // Missing SMTP/from is a visible terminal state, never a pretend success.
  if (!transportReady) {
    await db.paymentEmailOutbox.updateMany({
      where: { template: { in: SAFETY_EMAIL_TEMPLATES }, status: "PENDING" },
      data: { status: "FAILED", nextAttemptAt: null, lastErrorCode: from ? "TRANSPORT_MISSING" : "EMAIL_FROM_MISSING" }
    });
  } else {
    await runPaymentEmailDelivery({
      db,
      now,
      mailer: mailer || getMailer("field-safety"),
      batchSize: take,
      timeoutMs: emailTimeoutMs,
      templates: SAFETY_EMAIL_TEMPLATES
    });
  }
  const delivery = await reconcileFieldSafetyEmailOutbox({ db, now });
  counters.escalated = delivery.escalationSent;
  counters.resolvedNotices = delivery.resolvedSent;
  counters.escalationFailed += delivery.failed;

  return counters;
}
