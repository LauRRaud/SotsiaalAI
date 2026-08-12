import prisma from "@/lib/prisma";
import { getMailer, resolveBaseUrl } from "@/lib/mailer";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { logPaymentEvent } from "@/lib/payments/observability";

// Makse-/kutse e-kirjade idempotentne outbox (T09 E6, L-06). Tellimuse tõde
// elab Subscription/Payment kirjetes; see on ainult kohaletoimetamine. Owner- ja
// customer-mallid hoiavad payloadis ainult paymentId (PII lahendatakse saatmisel);
// kutse-mallid kannavad ühekordset join-tokenit (e-kirja vajalik sisu).

const DEFAULT_BATCH_SIZE = 40;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_LEASE_MS = 10 * 60 * 1000;
const OWNER_EMAIL = String(process.env.PAYMENT_OWNER_EMAIL || "info@sotsiaal.ai").trim().toLowerCase();
const OWNER_LOCALE = normalizeServerLocale(process.env.PAYMENT_OWNER_EMAIL_LOCALE) || "en";
const SUPPORT_EMAIL = "info@sotsiaal.ai";

function backoffMs(attempts) {
  return Math.min(24 * 60 * 60 * 1000, 5 * 60 * 1000 * (2 ** Math.max(0, attempts - 1)));
}

/**
 * SOL-PAY-07: eemalda ühekordne join-token payloadist. `null` = eemaldada ei ole
 * midagi (rida jääb puutumata).
 */
function stripDeliverySecrets(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  if (!("joinToken" in payload)) return null;
  const { joinToken: _joinToken, ...rest } = payload;
  return { ...rest, joinTokenDelivered: true };
}

function safeCode(error) {
  const raw = String(error?.code || error?.name || "EMAIL_FAILED").toUpperCase();
  return raw.replace(/[^A-Z0-9_]/gu, "_").slice(0, 80) || "EMAIL_FAILED";
}

function asIso(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

// Inimloetav kuupäev e-kirjades (ISO asemel). DD.MM.YYYY on kõigis kolmes
// keeles arusaadav; väldib toore ISO-stringi kuvamist kliendile.
function formatEmailDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${date.getUTCFullYear()}`;
}

function roleLabel(locale, role) {
  const normalized = String(role || "").toUpperCase();
  if (normalized.startsWith("SERVICE_PROVIDER")) return serverT(locale, "role.provider");
  if (normalized.startsWith("SOCIAL_WORKER")) return serverT(locale, "role.worker");
  return serverT(locale, "role.client");
}

function buildJoinLink(baseUrl, token) {
  const base = String(baseUrl || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/join?token=${encodeURIComponent(String(token || ""))}`;
}

/**
 * Lisa e-kiri outbox'i. Idempotentne dedupeKey kaudu: sama võti → uut kirjet ei
 * teki (P2002 → vaikselt jäetakse vahele). Ei kutsu SMTP-d — ainult järjekord.
 */
export async function enqueuePaymentEmail(
  db,
  { dedupeKey, template, toEmail, locale, payload = {}, paymentId = null, inviteId = null, now = new Date() } = {}
) {
  const recipient = String(toEmail || "").trim().toLowerCase();
  if (!dedupeKey || !template || !recipient || !recipient.includes("@")) {
    return { enqueued: false, reason: "missing_fields" };
  }
  try {
    await db.paymentEmailOutbox.create({
      data: {
        dedupeKey: String(dedupeKey),
        template: String(template),
        toEmail: recipient,
        locale: normalizeServerLocale(locale) || "en",
        payload,
        paymentId,
        inviteId,
        status: "PENDING",
        nextAttemptAt: now
      }
    });
    return { enqueued: true };
  } catch (error) {
    if (error?.code === "P2002") return { enqueued: false, reason: "duplicate" };
    throw error;
  }
}

async function renderInviteEmail(row, baseUrl, keyRoot, extraValues = {}) {
  const locale = normalizeServerLocale(row.locale) || "en";
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  const joinLink = buildJoinLink(baseUrl, payload.joinToken);
  const values = {
    inviterName: String(payload.inviterName || "SotsiaalAI"),
    roomTitle: String(payload.roomTitle || "Room"),
    joinLink,
    ...extraValues
  };
  return {
    subject: serverT(locale, `${keyRoot}.subject`, { roomTitle: values.roomTitle }),
    text: serverT(locale, `${keyRoot}.text`, values),
    html: serverT(locale, `${keyRoot}.html`, values)
  };
}

async function renderOwnerWebhookEmail(db, row) {
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  const payment = payload.paymentId
    ? await db.payment.findUnique({
        where: { id: String(payload.paymentId) },
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          createdAt: true,
          paidAt: true,
          user: { select: { id: true, email: true } },
          subscription: { select: { id: true, plan: true, status: true, validUntil: true, canceledAt: true } }
        }
      })
    : null;

  const adminUrl = `${(resolveBaseUrl() || "").replace(/\/+$/, "")}/admin/analytics`;
  const values = {
    status: String(payload.status || payment?.status || ""),
    providerPaymentId: String(payload.providerPaymentId || ""),
    paymentId: String(payment?.id || payload.paymentId || ""),
    userEmail: String(payment?.user?.email || ""),
    userId: String(payment?.user?.id || ""),
    amount: String(payment?.amount ?? ""),
    currency: String(payment?.currency || ""),
    paidAt: asIso(payment?.paidAt),
    createdAt: asIso(payment?.createdAt),
    subscriptionId: String(payment?.subscription?.id || ""),
    subscriptionPlan: String(payment?.subscription?.plan || ""),
    subscriptionStatus: String(payment?.subscription?.status || ""),
    subscriptionValidUntil: asIso(payment?.subscription?.validUntil),
    subscriptionCanceledAt: asIso(payment?.subscription?.canceledAt),
    subscriptionAction: String(payload.subscriptionAction || "none"),
    eventTime: asIso(row.createdAt) || "",
    adminUrl
  };
  return {
    subject: serverT(OWNER_LOCALE, "email.payment.owner_webhook.subject", values),
    text: serverT(OWNER_LOCALE, "email.payment.owner_webhook.text", values),
    html: serverT(OWNER_LOCALE, "email.payment.owner_webhook.html", values)
  };
}

async function renderCustomerConfirmationEmail(db, row, baseUrl) {
  const locale = normalizeServerLocale(row.locale) || "en";
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  const payment = payload.paymentId
    ? await db.payment.findUnique({
        where: { id: String(payload.paymentId) },
        select: {
          amount: true,
          currency: true,
          paidAt: true,
          raw: true,
          subscription: { select: { plan: true, validUntil: true } },
          invite: {
            select: { sponsoredRole: true, inviteeEmail: true, room: { select: { title: true } } }
          }
        }
      })
    : null;
  if (!payment) return null;

  const profileUrl = `${String(baseUrl || "http://localhost:3000").replace(/\/+$/, "")}/profiil`;
  const shared = {
    amount: String(payment.amount ?? ""),
    currency: String(payment.currency || ""),
    paidAt: formatEmailDate(payment.paidAt),
    profileUrl,
    supportEmail: SUPPORT_EMAIL
  };
  const hasInvite = Boolean(payment.invite);
  const label = roleLabel(locale, payment.invite?.sponsoredRole || payment.raw?.planRole || payment.subscription?.plan);
  if (hasInvite) {
    const values = {
      ...shared,
      roomTitle: String(payment.invite?.room?.title || ""),
      roleLabel: label,
      inviteeEmail: String(payment.invite?.inviteeEmail || "")
    };
    const root = "email.payment.customer_confirmation.sponsored";
    return {
      subject: serverT(locale, `${root}.subject`, values),
      text: serverT(locale, `${root}.text`, values),
      html: serverT(locale, `${root}.html`, values)
    };
  }
  const values = {
    ...shared,
    subscriptionPlan: label,
    subscriptionValidUntil: asIso(payment.subscription?.validUntil)
  };
  const root = "email.payment.customer_confirmation.subscription";
  return {
    subject: serverT(locale, `${root}.subject`, values),
    text: serverT(locale, `${root}.text`, values),
    html: serverT(locale, `${root}.html`, values)
  };
}

async function renderPaymentEmail(db, row, baseUrl) {
  const locale = normalizeServerLocale(row.locale) || "en";
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  switch (row.template) {
    case "invite_sponsored":
      return renderInviteEmail(row, baseUrl, "email.invite.sponsored", {
        roleLabel: roleLabel(locale, payload.targetRole)
      });
    case "invite_create":
      return renderInviteEmail(row, baseUrl, "email.invite.create");
    case "invite_resend":
      return renderInviteEmail(row, baseUrl, "email.invite.resend");
    case "sponsored_revoked": {
      const values = { roomTitle: String(payload.roomTitle || "Room"), supportEmail: SUPPORT_EMAIL };
      return {
        subject: serverT(locale, "email.invite.sponsored_revoked.subject", values),
        text: serverT(locale, "email.invite.sponsored_revoked.text", values),
        html: serverT(locale, "email.invite.sponsored_revoked.html", values)
      };
    }
    case "owner_webhook":
      return renderOwnerWebhookEmail(db, row);
    case "customer_confirmation":
      return renderCustomerConfirmationEmail(db, row, baseUrl);
    default:
      return null;
  }
}

/**
 * SOL-INV-03 — kutse-kirja SISU ehitatakse ÜHEST kohast.
 *
 * Kutse loomine saatis kirja oma koodiga ja outbox'i worker oma koodiga. Kaks
 * teostust sama kirja jaoks lahknevad esimese muudatusega ja siis sõltub see,
 * mida inimene loeb, sellest, kumb rada juhtus toimima. Kohene saatmine kutsub
 * nüüd sama renderdajat, mida kutsub taasproov.
 */
export async function renderInviteOutboxEmail({ template, locale, payload, baseUrl = resolveBaseUrl() }) {
  // Kutse-mallid ei loe andmebaasist midagi — kogu sisu on payloadis.
  return renderPaymentEmail(null, { template, locale, payload }, baseUrl);
}

/**
 * Repo-hallatav worker (route-värav). Claim CAS-iga, backoff, terminalne olek.
 * Kordus ei korda makset ega õiguse andmist — ainult saadab e-kirja uuesti.
 */
export async function runPaymentEmailDelivery({
  db = prisma,
  now = new Date(),
  dryRun = false,
  batchSize = DEFAULT_BATCH_SIZE,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  leaseMs = DEFAULT_LEASE_MS,
  mailer = null,
  baseUrl = resolveBaseUrl()
} = {}) {
  const take = Math.max(1, Math.min(Number(batchSize) || DEFAULT_BATCH_SIZE, 100));
  const attemptLimit = Math.max(1, Math.min(Number(maxAttempts) || DEFAULT_MAX_ATTEMPTS, 10));
  const leaseCutoff = new Date(now.getTime() - Math.max(60_000, Number(leaseMs) || DEFAULT_LEASE_MS));
  const counters = { eligible: 0, claimed: 0, sent: 0, retried: 0, failed: 0, skipped: 0, ambiguous: 0 };

  if (!dryRun) {
    const recovered = await db.paymentEmailOutbox.updateMany({
      where: { status: "SENDING", claimedAt: { lt: leaseCutoff } },
      data: { status: "RETRY", lastErrorCode: "AMBIGUOUS_AFTER_LEASE" }
    });
    counters.ambiguous = recovered.count;
  }

  const rows = await db.paymentEmailOutbox.findMany({
    where: {
      status: { in: ["PENDING", "RETRY"] },
      nextAttemptAt: { lte: now },
      attempts: { lt: attemptLimit }
    },
    select: { id: true },
    orderBy: { id: "asc" },
    take
  });
  counters.eligible = rows.length;
  if (dryRun) return { dryRun: true, ...counters };

  const transport = mailer || getMailer("payment-email-outbox");
  const from = String(process.env.EMAIL_FROM || process.env.SMTP_FROM || "").trim();

  for (const { id } of rows) {
    const claim = await db.paymentEmailOutbox.updateMany({
      where: { id, status: { in: ["PENDING", "RETRY"] }, nextAttemptAt: { lte: now }, attempts: { lt: attemptLimit } },
      data: { status: "SENDING", claimedAt: now, attempts: { increment: 1 }, lastErrorCode: null }
    });
    if (claim.count !== 1) continue;
    counters.claimed += 1;

    const row = await db.paymentEmailOutbox.findUnique({ where: { id } });
    const recipient = row?.template === "owner_webhook" ? OWNER_EMAIL : String(row?.toEmail || "").trim().toLowerCase();

    if (!recipient || !recipient.includes("@") || !from) {
      await db.paymentEmailOutbox.updateMany({
        where: { id, status: "SENDING", claimedAt: now },
        data: { status: "SKIPPED", nextAttemptAt: null, lastErrorCode: from ? "NO_RECIPIENT" : "EMAIL_FROM_MISSING" }
      });
      counters.skipped += 1;
      continue;
    }

    try {
      const content = await renderPaymentEmail(db, row, baseUrl);
      if (!content) {
        await db.paymentEmailOutbox.updateMany({
          where: { id, status: "SENDING", claimedAt: now },
          data: { status: "SKIPPED", nextAttemptAt: null, lastErrorCode: "NO_TEMPLATE" }
        });
        counters.skipped += 1;
        continue;
      }
      await Promise.race([
        transport.sendMail({ to: recipient, from, subject: content.subject, text: content.text, html: content.html }),
        new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error("email timeout"), { code: "EMAIL_TIMEOUT" })), timeoutMs))
      ]);
      /* SOL-PAY-07: kutse join-token on kandja, mitte ajalugu. Kui kiri on
         PÄRISELT välja läinud, on toortoken adressaadi postkastis ja tema koopia
         siin reas ainult suurendab riski — outbox'i terminalsed read elavad
         retentioni lõpuni. Ainult SENT: `FAILED`/`SKIPPED` rida võib operaator
         konfiguratsiooni parandades veel elustada. */
      const deliveredPayload = stripDeliverySecrets(row?.payload);
      await db.paymentEmailOutbox.updateMany({
        where: { id, status: "SENDING", claimedAt: now },
        data: {
          status: "SENT",
          sentAt: new Date(),
          nextAttemptAt: null,
          lastErrorCode: null,
          ...(deliveredPayload ? { payload: deliveredPayload } : {})
        }
      });
      counters.sent += 1;
    } catch (error) {
      const attempts = Number(row?.attempts || 0);
      const retry = attempts < attemptLimit;
      await db.paymentEmailOutbox.updateMany({
        where: { id, status: "SENDING", claimedAt: now },
        data: {
          status: retry ? "RETRY" : "FAILED",
          nextAttemptAt: retry ? new Date(now.getTime() + backoffMs(attempts)) : null,
          lastErrorCode: safeCode(error)
        }
      });
      counters[retry ? "retried" : "failed"] += 1;
      logPaymentEvent("payment_email_delivery_error", { outboxId: id, template: row?.template, code: safeCode(error) });
    }
  }

  return { dryRun: false, ...counters };
}

export const paymentEmailOutboxInternals = Object.freeze({ backoffMs, safeCode, renderPaymentEmail });
