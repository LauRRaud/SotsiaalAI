export const runtime = "nodejs";

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  BillingInterval,
  BillingMethodStatus,
  BillingMode,
  PaymentKind,
  PaymentProvider,
  PaymentStatus,
  SubscriptionStatus
} from "@/generated/prisma/client";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { getMailer, resolveBaseUrl } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";
import {
  extractProviderPaymentId,
  getMaksekeskusSecretKey,
  mapProviderPaymentStatus,
  parseMaksekeskusFormMessage,
  verifyMaksekeskusMac,
} from "@/lib/payments/maksekeskus";
import {
  buildBillingMethodLabel,
  extractProviderCustomerId,
  extractRecurringMandateId,
  extractRecurringToken,
  extractRecurringTokenValidUntil,
} from "@/lib/payments/recurring";
import { logPaymentEvent } from "@/lib/payments/observability";
import { safeError } from "@/lib/privacy/safeError";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};
const WEBHOOK_SECRET = String(getMaksekeskusSecretKey() || "").trim();
const SUBSCRIPTION_WEBHOOK_RATE_LIMIT_WINDOW_MS = Number(process.env.SUBSCRIPTION_WEBHOOK_RATE_LIMIT_WINDOW_MS || 60_000);
const SUBSCRIPTION_WEBHOOK_RATE_LIMIT_MAX = Number(process.env.SUBSCRIPTION_WEBHOOK_RATE_LIMIT_MAX || 120);
const REFUNDED_ACTION = normalizeSubscriptionAction(process.env.SUBSCRIPTION_WEBHOOK_REFUNDED_ACTION, "cancel");
const CANCELED_ACTION = normalizeSubscriptionAction(process.env.SUBSCRIPTION_WEBHOOK_CANCELED_ACTION, "none");
const FAILED_ACTION = normalizeSubscriptionAction(process.env.SUBSCRIPTION_WEBHOOK_FAILED_ACTION, "none");
const FINAL_STATUSES = new Set([PaymentStatus.PAID, PaymentStatus.CANCELED, PaymentStatus.FAILED, PaymentStatus.REFUNDED]);
const OWNER_NOTIFICATION_EMAIL = String(process.env.PAYMENT_OWNER_EMAIL || "info@sotsiaal.ai")
  .trim()
  .toLowerCase();
const OWNER_NOTIFICATION_LOCALE = normalizeServerLocale(process.env.PAYMENT_OWNER_EMAIL_LOCALE) || "en";
const ownerMailer = getMailer("payment-owner-webhook");
const customerMailer = getMailer("payment-customer-webhook");
const inviteMailer = getMailer("invite");

function roleLabelForNotification(locale, role) {
  const normalized = String(role || "").toUpperCase();
  if (normalized === "SERVICE_PROVIDER" || normalized === "SERVICE_PROVIDER_MONTHLY") {
    return serverT(locale, "role.provider");
  }
  if (normalized === "SOCIAL_WORKER" || normalized === "SOCIAL_WORKER_MONTHLY") {
    return serverT(locale, "role.worker");
  }
  return serverT(locale, "role.client");
}

function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: NO_STORE_HEADERS
  });
}

function addMonths(baseDate, months) {
  const date = new Date(baseDate);
  date.setMonth(date.getMonth() + months);
  return date;
}

function parsePaidAt(payload) {
  const raw =
    payload?.paidAt ||
    payload?.paid_at ||
    payload?.transaction_time ||
    payload?.completed_at ||
    payload?.updated_at ||
    null;
  if (!raw) return new Date();
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return new Date();
  return date;
}

function resolveIncomingStatus(payload) {
  const candidates = [
    payload?.status,
    payload?.transaction?.status,
    payload?.payment_status,
    payload?.transaction_status,
    payload?.event,
    payload?.type
  ];
  for (const candidate of candidates) {
    const mapped = mapProviderPaymentStatus(candidate);
    if (mapped) return mapped;
  }
  return null;
}

function normalizeSubscriptionAction(value, fallback) {
  const raw = String(value || "")
    .toLowerCase()
    .trim();
  if (raw === "cancel" || raw === "none") return raw;
  return fallback;
}

function actionForStatus(status) {
  if (status === PaymentStatus.REFUNDED) return REFUNDED_ACTION;
  if (status === PaymentStatus.CANCELED) return CANCELED_ACTION;
  if (status === PaymentStatus.FAILED) return FAILED_ACTION;
  return "none";
}

function asIso(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function buildJoinLink(token) {
  const base = resolveBaseUrl() || "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/join?token=${encodeURIComponent(token)}`;
}

async function sendInvitePaymentEmail({
  to,
  token,
  roomTitle,
  inviterName,
  locale,
  targetRole
}) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (!from) return;

  const joinLink = buildJoinLink(token);
  const roleLabel = roleLabelForNotification(locale, targetRole);

  await inviteMailer.sendMail({
    to,
    from,
    subject: serverT(locale, "email.invite.sponsored.subject", { roomTitle }),
    text: serverT(locale, "email.invite.sponsored.text", {
      inviterName,
      roomTitle,
      joinLink,
      roleLabel
    }),
    html: serverT(locale, "email.invite.sponsored.html", {
      inviterName,
      roomTitle,
      joinLink,
      roleLabel
    })
  });
}

function canSendOwnerNotification(result) {
  return Boolean(result?.updated) && Boolean(result?.paymentId) && Boolean(result?.status);
}

async function sendOwnerPaymentWebhookNotification({ providerPaymentId, status, paymentId, subscriptionAction }) {
  const to = OWNER_NOTIFICATION_EMAIL;
  const from = String(process.env.EMAIL_FROM || process.env.SMTP_FROM || "").trim();
  if (!to || !to.includes("@")) {
    logPaymentEvent("subscription_webhook_owner_email_skipped", {
      paymentId,
      providerPaymentId,
      status,
      reason: "recipient_missing"
    });
    return;
  }
  if (!from) {
    logPaymentEvent("subscription_webhook_owner_email_skipped", {
      paymentId,
      providerPaymentId,
      status,
      reason: "email_from_missing"
    });
    return;
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      createdAt: true,
      paidAt: true,
      user: {
        select: {
          id: true,
          email: true
        }
      },
      subscription: {
        select: {
          id: true,
          plan: true,
          status: true,
          validUntil: true,
          canceledAt: true
        }
      }
    }
  });

  const adminUrl = `${(resolveBaseUrl() || "").replace(/\/+$/, "")}/admin/analytics`;
  const values = {
    status: String(status || payment?.status || ""),
    providerPaymentId: String(providerPaymentId || ""),
    paymentId: String(payment?.id || paymentId || ""),
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
    subscriptionAction: String(subscriptionAction || "none"),
    eventTime: new Date().toISOString(),
    adminUrl
  };

  await ownerMailer.sendMail({
    to,
    from,
    subject: serverT(OWNER_NOTIFICATION_LOCALE, "email.payment.owner_webhook.subject", values),
    text: serverT(OWNER_NOTIFICATION_LOCALE, "email.payment.owner_webhook.text", values),
    html: serverT(OWNER_NOTIFICATION_LOCALE, "email.payment.owner_webhook.html", values)
  });

  logPaymentEvent("subscription_webhook_owner_email_sent", {
    paymentId: values.paymentId,
    providerPaymentId: values.providerPaymentId,
    status: values.status,
    subscriptionAction: values.subscriptionAction,
    to
  });
}

async function sendCustomerPaymentConfirmationEmail({ paymentId, providerPaymentId, locale }) {
  const from = String(process.env.EMAIL_FROM || process.env.SMTP_FROM || "").trim();
  if (!from) {
    logPaymentEvent("subscription_webhook_customer_email_skipped", {
      paymentId,
      providerPaymentId,
      reason: "email_from_missing"
    });
    return;
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      paidAt: true,
      user: {
        select: {
          email: true
        }
      },
      subscription: {
        select: {
          id: true,
          plan: true,
          status: true,
          validUntil: true,
          canceledAt: true
        }
      },
      invite: {
        select: {
          id: true,
          sponsoredRole: true,
          inviteeEmail: true,
          room: {
            select: {
              title: true
            }
          }
        }
      }
    }
  });

  const to = String(payment?.user?.email || "").trim().toLowerCase();
  if (!to || !to.includes("@")) {
    logPaymentEvent("subscription_webhook_customer_email_skipped", {
      paymentId,
      providerPaymentId,
      reason: "recipient_missing"
    });
    return;
  }

  const baseUrl = (resolveBaseUrl() || "http://localhost:3000").replace(/\/+$/, "");
  const profileUrl = `${baseUrl}/profiil`;
  const sharedValues = {
    amount: String(payment?.amount ?? ""),
    currency: String(payment?.currency || ""),
    paidAt: asIso(payment?.paidAt),
    profileUrl,
    supportEmail: "info@sotsiaal.ai"
  };
  const hasInvite = Boolean(payment?.invite);
  const roleLabel = roleLabelForNotification(
    locale,
    payment?.invite?.sponsoredRole || payment?.raw?.planRole || payment?.subscription?.plan
  );
  const subscriptionValues = {
    ...sharedValues,
    subscriptionPlan: roleLabel,
    subscriptionValidUntil: asIso(payment?.subscription?.validUntil)
  };
  const sponsoredValues = {
    ...sharedValues,
    roomTitle: String(payment?.invite?.room?.title || ""),
    roleLabel,
    inviteeEmail: String(payment?.invite?.inviteeEmail || "")
  };

  const keyRoot = hasInvite
    ? "email.payment.customer_confirmation.sponsored"
    : "email.payment.customer_confirmation.subscription";

  await customerMailer.sendMail({
    to,
    from,
    subject: serverT(locale, `${keyRoot}.subject`, hasInvite ? sponsoredValues : subscriptionValues),
    text: serverT(locale, `${keyRoot}.text`, hasInvite ? sponsoredValues : subscriptionValues),
    html: serverT(locale, `${keyRoot}.html`, hasInvite ? sponsoredValues : subscriptionValues)
  });

  logPaymentEvent("subscription_webhook_customer_email_sent", {
    paymentId,
    providerPaymentId,
    to,
    hasInvite
  });
}

async function activateSubscriptionFromPayment(tx, payment) {
  const existing = await tx.subscription.findUnique({
    where: { id: payment.subscriptionId },
    select: {
      id: true,
      validUntil: true,
      billingMode: true,
      billingInterval: true,
      billingMethodId: true
    }
  });
  if (!existing) return null;

  const now = new Date();
  const anchor =
    existing.validUntil && new Date(existing.validUntil).getTime() > now.getTime() ? new Date(existing.validUntil) : now;
  const validUntil = addMonths(anchor, 1);

  return tx.subscription.update({
    where: { id: existing.id },
    data: {
      status: SubscriptionStatus.ACTIVE,
      validUntil,
      nextBilling: existing.billingMode === BillingMode.RECURRING ? validUntil : null,
      lastBilledAt: paidAtOrNow(payment.paidAt),
      pastDueSince: null,
      billingRetryCount: 0,
      canceledAt: null
    },
    select: {
      id: true,
      status: true,
      validUntil: true,
      nextBilling: true
    }
  });
}

function paidAtOrNow(value) {
  const parsed = value ? new Date(value) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
  return new Date();
}

function asPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function upsertRecurringBillingMethod(tx, payment, payload, paidAt) {
  if (!payment?.subscriptionId) return null;
  const recurringToken = extractRecurringToken(payload);
  if (!recurringToken) return null;
  const expiresAtRaw = extractRecurringTokenValidUntil(payload);
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

  const existingSubscription = await tx.subscription.findUnique({
    where: { id: payment.subscriptionId },
    select: {
      id: true,
      userId: true,
      billingMethodId: true
    }
  });
  if (!existingSubscription) return null;

  const providerMandateId = extractRecurringMandateId(payload) || null;
  const providerCustomerId = extractProviderCustomerId(payload) || null;
  const label = buildBillingMethodLabel(payload) || null;
  const billingMethod =
    (existingSubscription.billingMethodId
      ? await tx.billingMethod.findUnique({
          where: { id: existingSubscription.billingMethodId },
          select: { id: true }
        })
      : null) ||
    (providerMandateId
      ? await tx.billingMethod.findFirst({
          where: {
            userId: existingSubscription.userId,
            provider: PaymentProvider.MAKSEKESKUS,
            providerMandateId
          },
          select: { id: true }
        })
      : null);

  const data = {
    status: BillingMethodStatus.ACTIVE,
    provider: PaymentProvider.MAKSEKESKUS,
    providerToken: recurringToken,
    providerMandateId,
    providerCustomerId,
    label,
    expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
    activatedAt: paidAt,
    lastUsedAt: paidAt,
    revokedAt: null
  };

  if (billingMethod?.id) {
    return tx.billingMethod.update({
      where: { id: billingMethod.id },
      data
    });
  }

  return tx.billingMethod.create({
    data: {
      userId: existingSubscription.userId,
      ...data
    }
  });
}

async function cancelSubscriptionFromPayment(tx, payment) {
  if (!payment?.subscriptionId) return null;
  await tx.subscription.updateMany({
    where: {
      id: payment.subscriptionId,
      status: SubscriptionStatus.ACTIVE
    },
    data: {
      status: SubscriptionStatus.CANCELED,
      canceledAt: new Date()
    }
  });
  return tx.subscription.findUnique({
    where: {
      id: payment.subscriptionId
    },
    select: {
      id: true,
      status: true,
      validUntil: true,
      nextBilling: true,
      canceledAt: true,
      plan: true,
      userId: true,
      updatedAt: true,
      createdAt: true
    }
  });
}

export async function POST(request) {
  const ip = getRequestIpFromRequest(request);
  const limiter = consumeRateLimit(
    `subscription:webhook:${ip}`,
    SUBSCRIPTION_WEBHOOK_RATE_LIMIT_MAX,
    SUBSCRIPTION_WEBHOOK_RATE_LIMIT_WINDOW_MS
  );
  if (!limiter.allowed) {
    logPaymentEvent("subscription_webhook_rate_limited", {
      ip
    });
    return json(
      {
        ok: false,
        messageKey: "api.common.rate_limited",
        message: "api.common.rate_limited"
      },
      429
    );
  }

  const rawBody = await request.text().catch(() => "");
  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  if (!rawBody) {
    logPaymentEvent("subscription_webhook_invalid_payload", {
      ip,
      reason: "empty_body"
    });
    return json(
      {
        ok: false,
        messageKey: "api.subscription.webhook_invalid_payload",
        message: "api.subscription.webhook_invalid_payload"
      },
      400
    );
  }

  if (
    !contentType.includes("application/x-www-form-urlencoded") &&
    !rawBody.includes("json=")
  ) {
    logPaymentEvent("subscription_webhook_invalid_payload", {
      ip,
      reason: "unsupported_content_type",
      contentType
    });
    return json(
      {
        ok: false,
        messageKey: "api.subscription.webhook_invalid_payload",
        message: "api.subscription.webhook_invalid_payload"
      },
      400
    );
  }

  const parsed = parseMaksekeskusFormMessage(rawBody);
  if (!parsed.jsonText || !parsed.payload) {
    logPaymentEvent("subscription_webhook_invalid_payload", {
      ip,
      reason: "invalid_form_payload"
    });
    return json(
      {
        ok: false,
        messageKey: "api.subscription.webhook_invalid_payload",
        message: "api.subscription.webhook_invalid_payload"
      },
      400
    );
  }

  if (!WEBHOOK_SECRET) {
    logPaymentEvent("subscription_webhook_signature_unconfigured", {
      ip
    });
    return json(
      {
        ok: false,
        messageKey: "api.subscription.webhook_signature_unconfigured",
        message: "api.subscription.webhook_signature_unconfigured"
      },
      503
    );
  }

  if (!verifyMaksekeskusMac(parsed.jsonText, parsed.mac, WEBHOOK_SECRET)) {
    logPaymentEvent("subscription_webhook_invalid_signature", {
      ip,
      signatureMode: "mac"
    });
    return json(
      {
        ok: false,
        messageKey: "api.subscription.webhook_signature_invalid",
        message: "api.subscription.webhook_signature_invalid"
      },
      401
    );
  }

  const payload = parsed.payload;

  const messageType = String(payload?.message_type || "payment_return")
    .trim()
    .toLowerCase();
  if (messageType && messageType !== "payment_return") {
    logPaymentEvent("subscription_webhook_ignored_message_type", {
      ip,
      messageType
    });
    return json({
      ok: true,
      ignored: true,
      messageType
    });
  }

  const providerPaymentId = extractProviderPaymentId(payload);
  const nextStatus = resolveIncomingStatus(payload);
  if (!providerPaymentId || !nextStatus) {
    logPaymentEvent("subscription_webhook_invalid_payload", {
      ip,
      reason: "missing_fields",
      providerPaymentId: providerPaymentId || "",
      incomingStatus: payload?.status || payload?.payment_status || payload?.transaction_status || ""
    });
    return json(
      {
        ok: false,
        messageKey: "api.subscription.webhook_invalid_payload",
        message: "api.subscription.webhook_invalid_payload"
      },
      400
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: {
          provider_providerPaymentId: {
            provider: PaymentProvider.MAKSEKESKUS,
            providerPaymentId
          }
        },
        select: {
          id: true,
          status: true,
          subscriptionId: true,
          inviteId: true,
          userId: true,
          kind: true,
          billingMethodId: true,
          raw: true
        }
      });
      const paymentLocale =
        normalizeServerLocale(payment?.raw?.locale) ||
        normalizeServerLocale(payment?.raw?.lang) ||
        "en";

      if (!payment) {
        return {
          notFound: true
        };
      }

      const sameStatus = payment.status === nextStatus;
      if (sameStatus) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            raw: {
              ...asPlainObject(payment.raw),
              source: "maksekeskus_webhook",
              payload
            }
          }
        });
        return {
          idempotent: true,
          paymentId: payment.id,
          status: payment.status,
          paymentLocale
        };
      }

      if (FINAL_STATUSES.has(payment.status) && nextStatus !== PaymentStatus.REFUNDED) {
        return {
          ignored: true,
          paymentId: payment.id,
          status: payment.status,
          paymentLocale
        };
      }

      const paidAt = nextStatus === PaymentStatus.PAID ? parsePaidAt(payload) : null;
      const subscriptionAction = nextStatus === PaymentStatus.PAID ? "activate" : actionForStatus(nextStatus);
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: nextStatus,
          ...(paidAt ? { paidAt } : {}),
          ...(nextStatus === PaymentStatus.FAILED || nextStatus === PaymentStatus.CANCELED ? { failedAt: new Date() } : {}),
          ...(nextStatus === PaymentStatus.REFUNDED ? { refundedAt: new Date() } : {}),
          raw: {
            ...asPlainObject(payment.raw),
            source: "maksekeskus_webhook",
            payload,
            subscriptionAction
          }
        },
        select: {
          id: true,
          status: true,
          subscriptionId: true,
          inviteId: true,
          kind: true,
          userId: true,
          billingMethodId: true
        }
      });

      let subscription = null;
      let inviteEmail = null;
      let billingMethod = null;

      if (updatedPayment.inviteId) {
        if (nextStatus === PaymentStatus.PAID) {
          const token = crypto.randomBytes(48).toString("base64url");
          const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("base64");
          const invite = await tx.invite.update({
            where: { id: updatedPayment.inviteId },
            data: {
              status: "SENT",
              sponsoredPaidAt: paidAt || new Date(),
              tokenHash
            },
            select: {
              id: true,
              sponsoredRole: true,
              inviteeEmail: true,
              room: {
                select: {
                  title: true
                }
              },
              inviter: {
                select: {
                  email: true
                }
              }
            }
          });

          inviteEmail = {
            to: invite.inviteeEmail,
            token,
            roomTitle: invite.room?.title || "Room",
            inviterName: invite.inviter?.email || "SotsiaalAI",
            locale:
              normalizeServerLocale(payment?.raw?.locale) ||
              normalizeServerLocale(payment?.raw?.lang) ||
              "en",
            targetRole: invite.sponsoredRole || "CLIENT"
          };
        } else if (
          nextStatus === PaymentStatus.CANCELED ||
          nextStatus === PaymentStatus.FAILED ||
          nextStatus === PaymentStatus.REFUNDED
        ) {
          await tx.invite.update({
            where: { id: updatedPayment.inviteId },
            data: {
              status: "REVOKED"
            }
          });
        }
      } else if (nextStatus === PaymentStatus.PAID) {
        if (payment.kind === PaymentKind.SUBSCRIPTION_INITIAL) {
          billingMethod = await upsertRecurringBillingMethod(tx, payment, payload, paidAt || new Date());

          if (billingMethod?.id) {
            await tx.payment.update({
              where: { id: updatedPayment.id },
              data: {
                billingMethodId: billingMethod.id
              }
            });
            await tx.subscription.update({
              where: { id: updatedPayment.subscriptionId },
              data: {
                billingMode: BillingMode.RECURRING,
                billingInterval: BillingInterval.MONTHLY,
                billingMethodId: billingMethod.id
              }
            });
          }
        } else if (payment.kind === PaymentKind.SUBSCRIPTION_RENEWAL && payment.billingMethodId) {
          await tx.billingMethod.update({
            where: { id: payment.billingMethodId },
            data: {
              status: BillingMethodStatus.ACTIVE,
              lastUsedAt: paidAt || new Date()
            }
          });
        }

        subscription = await activateSubscriptionFromPayment(tx, updatedPayment);
      } else if (subscriptionAction === "cancel") {
        subscription = await cancelSubscriptionFromPayment(tx, updatedPayment);
      } else if (
        payment.kind === PaymentKind.SUBSCRIPTION_RENEWAL &&
        (nextStatus === PaymentStatus.FAILED || nextStatus === PaymentStatus.CANCELED) &&
        payment.subscriptionId
      ) {
        subscription = await tx.subscription.update({
          where: { id: payment.subscriptionId },
          data: {
            status: SubscriptionStatus.PAST_DUE,
            pastDueSince: new Date(),
            billingRetryCount: {
              increment: 1
            }
          },
          select: {
            id: true,
            status: true,
            validUntil: true,
            nextBilling: true
          }
        });
      }

      return {
        updated: true,
        paymentId: updatedPayment.id,
        status: updatedPayment.status,
        subscription,
        billingMethodId: billingMethod?.id || payment.billingMethodId || null,
        subscriptionAction,
        inviteEmail,
        paymentLocale
      };
    });

    if (result?.notFound) {
      logPaymentEvent("subscription_webhook_payment_not_found", {
        providerPaymentId
      });
      return json({
        ok: true,
        ignored: true,
        messageKey: "api.subscription.payment_not_found",
        message: "api.subscription.payment_not_found"
      });
    }

    logPaymentEvent("subscription_webhook_processed", {
      providerPaymentId,
      resultStatus: result?.status || "",
      subscriptionAction: result?.subscriptionAction || "none",
      updated: Boolean(result?.updated),
      idempotent: Boolean(result?.idempotent),
      ignored: Boolean(result?.ignored)
    });

    if (result?.inviteEmail?.to && result?.status === PaymentStatus.PAID) {
      try {
        await sendInvitePaymentEmail({
          ...result.inviteEmail,
          locale: result.inviteEmail.locale
        });
      } catch (inviteError) {
        logPaymentEvent("subscription_webhook_invite_email_failed", {
          paymentId: result?.paymentId || "",
          providerPaymentId,
          error: inviteError
        });
      }
    }

    if (result?.updated && result?.status === PaymentStatus.PAID && result?.paymentId) {
      try {
        await sendCustomerPaymentConfirmationEmail({
          paymentId: result.paymentId,
          providerPaymentId,
          locale: result.paymentLocale || "en"
        });
      } catch (customerEmailError) {
        logPaymentEvent("subscription_webhook_customer_email_failed", {
          paymentId: result?.paymentId || "",
          providerPaymentId,
          error: customerEmailError
        });
      }
    }

    if (canSendOwnerNotification(result)) {
      try {
        await sendOwnerPaymentWebhookNotification({
          providerPaymentId,
          status: result?.status,
          paymentId: result?.paymentId,
          subscriptionAction: result?.subscriptionAction
        });
      } catch (notifyError) {
        logPaymentEvent("subscription_webhook_owner_email_failed", {
          paymentId: result?.paymentId || "",
          providerPaymentId,
          status: result?.status || "",
          error: notifyError
        });
      }
    }

    return json({
      ok: true,
      ...result
    });
  } catch (error) {
    console.error("subscription webhook error", safeError(error));
    logPaymentEvent("subscription_webhook_failed", {
      providerPaymentId,
      error
    });
    return json(
      {
        ok: false,
        messageKey: "api.subscription.webhook_process_failed",
        message: "api.subscription.webhook_process_failed"
      },
      500
    );
  }
}
