export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  BillingMethodStatus,
  BillingMode,
  PaymentProvider,
  PaymentStatus,
  SubscriptionStatus
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createMaksekeskusRecurringCharge } from "@/lib/payments/maksekeskus";
import { logPaymentEvent } from "@/lib/payments/observability";
import { projectProviderPaymentRaw } from "@/lib/payments/rawProjection";
import { readBillingMethodRecurringToken } from "@/lib/payments/tokenCrypto";
import {
  buildRecurringPaymentReference,
  computeNextRetryAt,
  getDueRecurringSubscriptionWhere,
  getRenewalPaymentKind,
  isRecurringBillingEnabled,
  shouldCancelAfterRetryCount
} from "@/lib/payments/recurring";
import { getRoleMonthlyAmount, getRolePlanDescription, normalizeSubscriptionRole } from "@/lib/subscriptionPlans";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};
const JOB_KEY = String(process.env.SUBSCRIPTION_RENEWAL_JOB_KEY || "").trim();
const JOB_BATCH_SIZE = Math.max(1, Number(process.env.SUBSCRIPTION_RENEWAL_BATCH_SIZE || 25));

function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: NO_STORE_HEADERS
  });
}

function isDryRun(request) {
  const raw = String(new URL(request.url).searchParams.get("dryRun") || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function isAuthorized(request) {
  if (!JOB_KEY) return false;
  const header =
    request.headers.get("x-subscription-renewal-key") ||
    request.headers.get("x-cron-key") ||
    request.headers.get("x-api-key") ||
    "";
  // Ajaturvaline võrdlus (sama muster mis payment-alerts dispatch'is)
  const provided = Buffer.from(String(header).trim());
  const expected = Buffer.from(JOB_KEY);
  if (provided.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(provided, expected);
  } catch {
    return false;
  }
}

function buildChargeDescription(role, locale) {
  return getRolePlanDescription(role, locale || "en");
}

function normalizeLocale(rawLocale) {
  const locale = String(rawLocale || "").trim().toLowerCase();
  if (locale === "et" || locale === "ru" || locale === "en") return locale;
  return "en";
}

function isDuplicateRenewalPaymentError(error) {
  return error && typeof error === "object" && error.code === "P2002";
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return json({
      ok: false,
      message: "unauthorized"
    }, 401);
  }

  if (!isRecurringBillingEnabled()) {
    return json({
      ok: false,
      message: "recurring billing disabled"
    }, 503);
  }

  const dryRun = isDryRun(request);
  const now = new Date();
  const dueSubscriptions = await prisma.subscription.findMany({
    where: getDueRecurringSubscriptionWhere(now),
    orderBy: [{ nextBilling: "asc" }, { updatedAt: "asc" }],
    take: JOB_BATCH_SIZE,
    select: {
      id: true,
      userId: true,
      plan: true,
      billingRetryCount: true,
      nextBilling: true,
      billingMethodId: true,
      billingMethod: {
        select: {
          id: true,
          status: true,
          providerToken: true,
          providerTokenCipher: true,
          providerTokenKeyId: true,
          label: true
        }
      },
      user: {
        select: {
          email: true,
          role: true
        }
      }
    }
  });

  const results = [];

  for (const subscription of dueSubscriptions) {
    const role = normalizeSubscriptionRole(subscription?.user?.role);
    const amount = getRoleMonthlyAmount(role).toFixed(2);
    const currency = String(process.env.SUBSCRIPTION_CURRENCY || "EUR").trim().toUpperCase();
    const attemptNumber = Number(subscription.billingRetryCount || 0) + 1;
    const providerPaymentId = buildRecurringPaymentReference(subscription.id, {
      nextBilling: subscription.nextBilling,
      attemptNumber
    });

    if (dryRun) {
      results.push({
        subscriptionId: subscription.id,
        action: "dry_run",
        amount,
        currency,
        nextBilling: subscription.nextBilling
      });
      continue;
    }

    // E3 fail-closed: dekrüpti recurring token enne charge'i. Puuduva/vale
    // krüptovõtme korral ei laadi kaarti ega märgi maksehäireks — see on
    // konfiguratsiooniviga, mitte kliendi makse ebaõnnestumine.
    let recurringToken;
    try {
      recurringToken = readBillingMethodRecurringToken(subscription.billingMethod).token;
    } catch (tokenError) {
      logPaymentEvent("subscription_renewal_token_unavailable", {
        subscriptionId: subscription.id,
        billingMethodId: subscription.billingMethodId,
        code: tokenError?.code || "PAYMENT_TOKEN_UNAVAILABLE"
      });
      results.push({ subscriptionId: subscription.id, action: "token_unavailable" });
      continue;
    }

    let paymentRecord = null;

    try {
      paymentRecord = await prisma.payment.create({
        data: {
          subscriptionId: subscription.id,
          userId: subscription.userId,
          provider: PaymentProvider.MAKSEKESKUS,
          kind: getRenewalPaymentKind(),
          billingMethodId: subscription.billingMethodId,
          providerPaymentId,
          amount,
          currency,
          status: PaymentStatus.INITIATED,
          attemptNumber,
          raw: {
            flow: "subscription_renewal_job",
            subscriptionId: subscription.id,
            billingMode: BillingMode.RECURRING,
            scheduledAt: now.toISOString()
          }
        },
        select: {
          id: true
        }
      });

      const charge = await createMaksekeskusRecurringCharge({
        providerPaymentId,
        amount,
        currency,
        recurringToken,
        customerEmail: subscription.user?.email || "",
        locale: normalizeLocale(process.env.PAYMENT_OWNER_EMAIL_LOCALE),
        webhookUrl: String(process.env.MAKSEKESKUS_WEBHOOK_URL || "").trim(),
        description: buildChargeDescription(role, normalizeLocale(process.env.PAYMENT_OWNER_EMAIL_LOCALE)),
        merchantData: {
          flow: "subscription_renewal_job",
          subscriptionId: subscription.id,
          paymentId: paymentRecord.id,
        },
      });

      await prisma.payment.update({
        where: { id: paymentRecord.id },
        data: {
          providerPaymentId: charge.providerPaymentId || providerPaymentId,
          raw: {
            flow: "subscription_renewal_job",
            subscriptionId: subscription.id,
            billingMode: BillingMode.RECURRING,
            charge: projectProviderPaymentRaw(charge.raw)
          }
        }
      });

      logPaymentEvent("subscription_renewal_charge_created", {
        paymentId: paymentRecord.id,
        subscriptionId: subscription.id
      });

      results.push({
        subscriptionId: subscription.id,
        paymentId: paymentRecord.id,
        action: "charge_created"
      });
    } catch (error) {
      if (!paymentRecord?.id && isDuplicateRenewalPaymentError(error)) {
        logPaymentEvent("subscription_renewal_charge_duplicate_skipped", {
          subscriptionId: subscription.id,
          providerPaymentId,
          attemptNumber
        });

        results.push({
          subscriptionId: subscription.id,
          action: "duplicate_skipped",
          providerPaymentId,
          attemptNumber
        });
        continue;
      }

      const retryCount = Number(subscription.billingRetryCount || 0) + 1;
      const shouldCancel = shouldCancelAfterRetryCount(retryCount);
      const nextRetryAt = computeNextRetryAt(now, retryCount - 1);

      if (paymentRecord?.id) {
        await prisma.payment.update({
          where: { id: paymentRecord.id },
          data: {
            status: PaymentStatus.FAILED,
            failedAt: now,
            raw: {
              flow: "subscription_renewal_job",
              subscriptionId: subscription.id,
              error: error?.message || "recurring_charge_failed"
            }
          }
        }).catch(() => {});
      }

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: shouldCancel ? SubscriptionStatus.CANCELED : SubscriptionStatus.PAST_DUE,
          pastDueSince: now,
          billingRetryCount: retryCount,
          nextBilling: shouldCancel ? subscription.nextBilling : nextRetryAt
        }
      }).catch(() => {});

      if (subscription.billingMethodId) {
        await prisma.billingMethod.update({
          where: { id: subscription.billingMethodId },
          data: {
            status: BillingMethodStatus.FAILED
          }
        }).catch(() => {});
      }

      logPaymentEvent("subscription_renewal_charge_failed", {
        paymentId: paymentRecord?.id || null,
        subscriptionId: subscription.id,
        retryCount,
        shouldCancel,
        error
      });

      results.push({
        subscriptionId: subscription.id,
        paymentId: paymentRecord?.id || null,
        action: shouldCancel ? "canceled" : "past_due",
        retryCount,
        nextRetryAt
      });
    }
  }

  return json({
    ok: true,
    dryRun,
    processed: results.length,
    results
  });
}
