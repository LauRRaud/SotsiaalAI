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
  batchSize = 25
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
  const transportReady = Boolean(mailer) || (hasConfiguredEmailTransport() && from);
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

  // 2) Escalation to the trusted contact after deadline + grace.
  const escalationCutoff = new Date(now.getTime() - FIELD_SAFETY.GRACE_MS);
  const dueEscalations = await db.fieldVisit.findMany({
    where: {
      ...activeSafetyWhere,
      safetyDeadlineAt: { not: null, lte: escalationCutoff },
      safetyEscalationStatus: { not: FIELD_SAFETY.STATUS_SENT },
      safetyEscalationAttempts: { lt: FIELD_SAFETY.MAX_ESCALATION_ATTEMPTS },
      OR: [
        { safetyEscalationNextAttemptAt: null },
        { safetyEscalationNextAttemptAt: { lte: now } }
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
    // CAS claim so two parallel sweeps never double-send.
    const claim = await db.fieldVisit.updateMany({
      where: {
        id: visit.id,
        safetyEscalationAttempts: visit.safetyEscalationAttempts,
        departedConfirmedAt: null,
        safetyCancelledAt: null
      },
      data: {
        safetyEscalationAttempts: visit.safetyEscalationAttempts + 1,
        safetyEscalationNextAttemptAt: new Date(now.getTime() + FIELD_SAFETY.ESCALATION_BACKOFF_MS)
      }
    });
    if (claim.count !== 1) {
      counters.skipped += 1;
      continue;
    }
    const recipient = cleanEmail(visit.safetyContactEmail);
    try {
      if (!recipient) throw Object.assign(new Error("recipient_missing"), { code: "RECIPIENT_MISSING" });
      if (!transportReady) throw Object.assign(new Error("transport_missing"), { code: "TRANSPORT_MISSING" });
      const workerName = await workerDisplayName(db, visit.ownerUserId);
      const message = buildFieldSafetyEscalationEmail({ visit, workerName });
      await (mailer || getMailer("field-safety")).sendMail({ to: recipient, from, ...message });
      await db.fieldVisit.updateMany({
        where: { id: visit.id },
        data: { safetyEscalatedAt: now, safetyEscalationStatus: FIELD_SAFETY.STATUS_SENT }
      });
      await logDataAudit({
        targetUserId: visit.ownerUserId,
        action: "field.safety_escalated",
        resourceType: "FIELD_VISIT",
        resourceId: visit.id,
        meta: { attempt: visit.safetyEscalationAttempts + 1 }
      });
      counters.escalated += 1;
    } catch (error) {
      const attempts = visit.safetyEscalationAttempts + 1;
      const terminal = attempts >= FIELD_SAFETY.MAX_ESCALATION_ATTEMPTS;
      await db.fieldVisit.updateMany({
        where: { id: visit.id },
        data: terminal ? { safetyEscalationStatus: FIELD_SAFETY.STATUS_FAILED } : {}
      });
      await logDataAudit({
        targetUserId: visit.ownerUserId,
        action: "field.safety_escalation_failed",
        resourceType: "FIELD_VISIT",
        resourceId: visit.id,
        meta: { attempt: attempts, errorCode: String(error?.code || "SEND_FAILED").slice(0, 60), terminal }
      });
      counters.escalationFailed += 1;
      console.error("[field-safety] escalation failed", safeError(error));
    }
  }

  // 3) "Resolved" notice after a late confirmation or cancellation.
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
    const claim = await db.fieldVisit.updateMany({
      where: { id: visit.id, safetyResolvedNotifiedAt: null },
      data: { safetyResolvedNotifiedAt: now }
    });
    if (claim.count !== 1) {
      counters.skipped += 1;
      continue;
    }
    const recipient = cleanEmail(visit.safetyContactEmail);
    try {
      if (recipient && transportReady) {
        const workerName = await workerDisplayName(db, visit.ownerUserId);
        const message = buildFieldSafetyResolvedEmail({ visit, workerName });
        await (mailer || getMailer("field-safety")).sendMail({ to: recipient, from, ...message });
      }
      await logDataAudit({
        targetUserId: visit.ownerUserId,
        action: "field.safety_resolved_notice",
        resourceType: "FIELD_VISIT",
        resourceId: visit.id
      });
      counters.resolvedNotices += 1;
    } catch (error) {
      // Roll the claim back so the notice is retried on the next sweep.
      await db.fieldVisit.updateMany({
        where: { id: visit.id, safetyResolvedNotifiedAt: now },
        data: { safetyResolvedNotifiedAt: null }
      });
      counters.skipped += 1;
      console.error("[field-safety] resolved notice failed", safeError(error));
    }
  }

  return counters;
}
