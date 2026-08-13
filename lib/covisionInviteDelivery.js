import crypto from "node:crypto";
import prisma from "./prisma.js";
import { getMailer, resolveBaseUrl, resolveMailFrom } from "./mailer.js";
import { buildCovisionInviteLink } from "./covisionInvites.js";
import { normalizeEmail } from "./covisionShared.js";

const MAX_ATTEMPTS = 4;
const LEASE_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 15_000;

function messageId(participantId) {
  const digest = crypto.createHash("sha256").update(String(participantId)).digest("hex").slice(0, 32);
  return `<covision-invite-${digest}@sotsiaal.ai>`;
}

function safeCode(error) {
  return String(error?.code || error?.name || "DELIVERY_FAILED")
    .toUpperCase().replace(/[^A-Z0-9_]/gu, "_").slice(0, 80);
}

function backoff(attempts) {
  return Math.min(24 * 60 * 60 * 1000, 5 * 60 * 1000 * (2 ** Math.max(0, attempts - 1)));
}

async function timeout(promise, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("Invite delivery timed out"), { code: "EMAIL_TIMEOUT" })), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function queueCovisionInviteDelivery(tx, { participantId, email, now = new Date() }) {
  const recipientEmail = normalizeEmail(email);
  if (!participantId || !recipientEmail) throw new TypeError("participantId and email are required");
  const existing = await tx.covisionInviteDelivery.findUnique({ where: { participantId } });
  const data = {
    recipientEmail,
    status: "PENDING",
    attempts: 0,
    nextAttemptAt: now,
    claimedAt: null,
    sentAt: null,
    lastErrorCode: null,
    messageId: messageId(participantId)
  };
  return existing
    ? tx.covisionInviteDelivery.update({ where: { participantId }, data })
    : tx.covisionInviteDelivery.create({ data: { participantId, ...data } });
}

export async function runCovisionInviteDelivery({
  db = prisma,
  now = new Date(),
  dryRun = false,
  batchSize = 40,
  mailer = getMailer("covision-invite-delivery"),
  baseUrl = resolveBaseUrl(),
  timeoutMs = TIMEOUT_MS
} = {}) {
  const recovered = dryRun ? { count: 0 } : await db.covisionInviteDelivery.updateMany({
    where: { status: "SENDING", claimedAt: { lt: new Date(now.getTime() - LEASE_MS) } },
    data: { status: "UNKNOWN", lastErrorCode: "AMBIGUOUS_AFTER_LEASE" }
  });
  const rows = await db.covisionInviteDelivery.findMany({
    where: { status: { in: ["PENDING", "RETRY"] }, nextAttemptAt: { lte: now }, attempts: { lt: MAX_ATTEMPTS } },
    select: { id: true },
    orderBy: { id: "asc" },
    take: Math.max(1, Math.min(Number(batchSize) || 40, 100))
  });
  const counters = { eligible: rows.length, claimed: 0, sent: 0, retried: 0, failed: 0, ambiguous: recovered.count };
  if (dryRun) return counters;

  const from = resolveMailFrom();
  for (const candidate of rows) {
    const claim = await db.covisionInviteDelivery.updateMany({
      where: { id: candidate.id, status: { in: ["PENDING", "RETRY"] }, nextAttemptAt: { lte: now }, attempts: { lt: MAX_ATTEMPTS } },
      data: { status: "SENDING", claimedAt: now, attempts: { increment: 1 }, lastErrorCode: null }
    });
    if (claim.count !== 1) continue;
    counters.claimed += 1;
    const row = await db.covisionInviteDelivery.findUnique({
      where: { id: candidate.id },
      include: { participant: { select: { covisionCaseId: true, inviteStatus: true, inviteExpiresAt: true } } }
    });
    if (
      !row
      || row.participant?.inviteStatus !== "INVITED"
      || (row.participant?.inviteExpiresAt && new Date(row.participant.inviteExpiresAt).getTime() <= now.getTime())
    ) {
      await db.covisionInviteDelivery.update({ where: { id: candidate.id }, data: { status: "CANCELLED", claimedAt: null } });
      continue;
    }
    try {
      if (!from) throw Object.assign(new Error("Sender missing"), { code: "EMAIL_FROM_MISSING", retryable: false });
      if (!baseUrl) throw Object.assign(new Error("App URL missing"), { code: "APP_URL_NOT_CONFIGURED", retryable: false });
      const link = buildCovisionInviteLink(row.participant.covisionCaseId, baseUrl);
      await timeout(mailer.sendMail({
        to: row.recipientEmail,
        from,
        subject: "SotsiaalAI kovisiooni kutse",
        text: `Sind kutsuti SotsiaalAI kovisiooni arutelusse.\n\nSisu avaneb alles pärast autentimist ja kinnitusi.\n${link}`,
        messageId: row.messageId
      }), timeoutMs);
      await db.covisionInviteDelivery.update({
        where: { id: row.id }, data: { status: "SENT", sentAt: new Date(), claimedAt: null, nextAttemptAt: now, lastErrorCode: null }
      });
      counters.sent += 1;
    } catch (error) {
      const code = safeCode(error);
      const ambiguous = code === "EMAIL_TIMEOUT";
      const retry = !ambiguous && error?.retryable !== false && row.attempts < MAX_ATTEMPTS;
      await db.covisionInviteDelivery.update({
        where: { id: row.id },
        data: {
          status: ambiguous ? "UNKNOWN" : retry ? "RETRY" : "FAILED",
          claimedAt: null,
          nextAttemptAt: retry ? new Date(now.getTime() + backoff(row.attempts)) : now,
          lastErrorCode: code
        }
      });
      counters[ambiguous ? "ambiguous" : retry ? "retried" : "failed"] += 1;
    }
  }
  return counters;
}

export async function expireCovisionInvitations({ db = prisma, now = new Date(), dryRun = false } = {}) {
  const where = { inviteStatus: "INVITED", inviteExpiresAt: { lte: now } };
  if (dryRun) return { expired: await db.covisionParticipant.count({ where }) };
  const result = await db.$transaction(async (tx) => {
    const candidates = await tx.covisionParticipant.findMany({ where, select: { id: true } });
    if (!candidates.length) return { expired: 0 };
    const ids = candidates.map(({ id }) => id);
    const changed = await tx.covisionParticipant.updateMany({
      where: { id: { in: ids }, inviteStatus: "INVITED", inviteExpiresAt: { lte: now } },
      data: { inviteStatus: "EXPIRED", decisionAt: now }
    });
    await tx.covisionInviteDelivery.updateMany({
      where: { participantId: { in: ids }, status: { in: ["PENDING", "RETRY"] } },
      data: { status: "CANCELLED", claimedAt: null }
    });
    return { expired: changed.count };
  });
  return result;
}

export const covisionInviteDeliveryInternals = { backoff, messageId, safeCode };
