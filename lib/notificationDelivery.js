import prisma from "@/lib/prisma";
import { getMailer, resolveBaseUrl, resolveMailFrom } from "@/lib/mailer";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";

const DEFAULT_BATCH_SIZE = 40;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_LEASE_MS = 10 * 60 * 1000;

function safeCode(error) {
  const raw = String(error?.code || error?.name || "DELIVERY_FAILED").toUpperCase();
  return raw.replace(/[^A-Z0-9_]/gu, "_").slice(0, 80) || "DELIVERY_FAILED";
}

function backoffMs(attempts) {
  return Math.min(24 * 60 * 60 * 1000, 5 * 60 * 1000 * (2 ** Math.max(0, attempts - 1)));
}

async function withTimeout(promise, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error("Notification delivery timed out");
          error.code = "EMAIL_TIMEOUT";
          reject(error);
        }, timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function recipientLocale(db, userId) {
  const acceptance = await db.frameworkAcceptance.findFirst({
    where: { userId, locale: { not: null } },
    select: { locale: true },
    orderBy: [{ acceptedAt: "desc" }, { id: "desc" }]
  });
  return normalizeServerLocale(acceptance?.locale) || "et";
}

function emailContent(event, locale, baseUrl) {
  const labelKey = `notifications.events.${String(event.type || "").toLowerCase()}`;
  const href = `${String(baseUrl || "").replace(/\/$/u, "")}/vestlus`;
  const subject = serverT(locale, "notifications.email_subject", null, "SotsiaalAI notification");
  const eventLabel = serverT(locale, labelKey, null, "You have a new notification");
  const intro = serverT(locale, "notifications.email_intro", null, "There is a new notification in SotsiaalAI.");
  const action = serverT(locale, "notifications.email_action", null, "Sign in to view it:");
  return { subject, text: `${intro}\n\n${eventLabel}\n\n${action}\n${href}` };
}

export async function runNotificationDelivery({
  db = prisma,
  now = new Date(),
  dryRun = false,
  batchSize = DEFAULT_BATCH_SIZE,
  cursor = null,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  leaseMs = DEFAULT_LEASE_MS,
  mailer = null,
  baseUrl = resolveBaseUrl()
} = {}) {
  const take = Math.max(1, Math.min(Number(batchSize) || DEFAULT_BATCH_SIZE, 100));
  const attemptLimit = Math.max(1, Math.min(Number(maxAttempts) || DEFAULT_MAX_ATTEMPTS, 10));
  const leaseCutoff = new Date(now.getTime() - Math.max(60_000, Number(leaseMs) || DEFAULT_LEASE_MS));
  const counters = {
    eligible: 0, claimed: 0, sent: 0, retried: 0, failed: 0,
    skippedPreference: 0, skippedRecipient: 0, skippedSender: 0, ambiguous: 0
  };

  if (!dryRun) {
    const recovered = await db.notificationEvent.updateMany({
      where: { emailStatus: "SENDING", emailClaimedAt: { lt: leaseCutoff } },
      data: { emailStatus: "UNKNOWN", emailLastErrorCode: "AMBIGUOUS_AFTER_LEASE" }
    });
    counters.ambiguous = recovered.count;
  }

  const rows = await db.notificationEvent.findMany({
    where: {
      emailStatus: { in: ["PENDING", "RETRY"] },
      emailNextAttemptAt: { lte: now },
      emailAttempts: { lt: attemptLimit },
      ...(cursor ? { id: { gt: String(cursor) } } : {})
    },
    select: { id: true },
    orderBy: { id: "asc" },
    take
  });
  counters.eligible = rows.length;
  if (dryRun) return { dryRun: true, ...counters, nextCursor: rows.at(-1)?.id || null };

  const transport = mailer || getMailer("notification-delivery");
  /* SOL-NOTIF-01: saatja aadress tuleb samast autoriteetsest kohast nagu
     ülejäänud mailerid. Puuduv saatja EI ole korduskatse väärt — ilma temata ei
     saa ükski katse õnnestuda, seega rida läheb nähtavasse `SKIPPED` seisu, mitte
     lõputusse `RETRY` ringi. */
  const from = resolveMailFrom();

  for (const row of rows) {
    const claim = await db.notificationEvent.updateMany({
      where: {
        id: row.id,
        emailStatus: { in: ["PENDING", "RETRY"] },
        emailNextAttemptAt: { lte: now },
        emailAttempts: { lt: attemptLimit }
      },
      data: {
        emailStatus: "SENDING",
        emailClaimedAt: now,
        emailAttempts: { increment: 1 },
        emailLastErrorCode: null
      }
    });
    if (claim.count !== 1) continue;
    counters.claimed += 1;

    const event = await db.notificationEvent.findUnique({
      where: { id: row.id },
      include: { user: { select: { id: true, email: true, notificationEmailEnabled: true } } }
    });
    if (!event?.user?.email || !from) {
      await db.notificationEvent.updateMany({
        where: { id: row.id, emailStatus: "SENDING", emailClaimedAt: now },
        data: {
          emailStatus: "SKIPPED_NO_RECIPIENT",
          emailNextAttemptAt: null,
          emailLastErrorCode: from ? "NO_RECIPIENT" : "EMAIL_FROM_MISSING"
        }
      });
      counters[from ? "skippedRecipient" : "skippedSender"] += 1;
      continue;
    }
    if (event.emailPolicy === "OPTIONAL" && event.user.notificationEmailEnabled !== true) {
      await db.notificationEvent.updateMany({
        where: { id: row.id, emailStatus: "SENDING", emailClaimedAt: now },
        data: { emailStatus: "SKIPPED_PREFERENCE", emailNextAttemptAt: null, emailLastErrorCode: null }
      });
      counters.skippedPreference += 1;
      continue;
    }

    try {
      if (!baseUrl) {
        const error = new Error("Application URL is not configured");
        error.code = "APP_URL_NOT_CONFIGURED";
        error.retryable = false;
        throw error;
      }
      const locale = await recipientLocale(db, event.userId);
      const content = emailContent(event, locale, baseUrl);
      await withTimeout(transport.sendMail({
        to: event.user.email,
        from,
        subject: content.subject,
        text: content.text,
        messageId: event.emailMessageId
      }), timeoutMs);
      await db.notificationEvent.updateMany({
        where: { id: row.id, emailStatus: "SENDING", emailClaimedAt: now },
        data: { emailStatus: "SENT", emailedAt: new Date(), emailNextAttemptAt: null, emailLastErrorCode: null }
      });
      counters.sent += 1;
    } catch (error) {
      const attempts = Number(event.emailAttempts || 0);
      const code = safeCode(error);
      /* SOL-NOTIF-05: `withTimeout` ei anna transpordile abort-signaali — timeout
         tähendab, et me EI TEA, kas SMTP kirja vastu võttis. Vana kood pani ta
         `RETRY`-ks (pime kordus, võimalik duplikaat), kuigi SAMA teadmatus
         lease-taastel läks `UNKNOWN`-i (saatmine peatub). Üks ebamäärane tulemus
         ei tohi kahte eri asja tähendada — mõlemad on nüüd `UNKNOWN`.

         Teavituskiri on inimesele suunatud uudis, mitte kandja: teine „sul on uus
         teade" on pigem müra kui abi, ja püsiv `Message-ID` üksi ei anna
         täpselt-üks-kord garantiid (vt SOL-PAY-11 sama valik). */
      const ambiguous = code === "EMAIL_TIMEOUT";
      const retry = !ambiguous && error?.retryable !== false && attempts < attemptLimit;
      await db.notificationEvent.updateMany({
        where: { id: row.id, emailStatus: "SENDING", emailClaimedAt: now },
        data: {
          emailStatus: ambiguous ? "UNKNOWN" : retry ? "RETRY" : "FAILED",
          emailNextAttemptAt: retry ? new Date(now.getTime() + backoffMs(attempts)) : null,
          emailLastErrorCode: code
        }
      });
      if (ambiguous) counters.ambiguous += 1;
      else counters[retry ? "retried" : "failed"] += 1;
    }
  }
  return { dryRun: false, ...counters, nextCursor: rows.at(-1)?.id || null };
}

export const notificationDeliveryInternals = Object.freeze({ backoffMs, emailContent, safeCode });
