import {
  BillingMethodStatus,
  BillingMode,
  PaymentProvider,
  SubscriptionStatus
} from "@/generated/prisma/client";
import {
  buildBillingMethodLabel,
  extractProviderCustomerId,
  extractRecurringMandateId,
  extractRecurringToken,
  extractRecurringTokenValidUntil
} from "@/lib/payments/recurring";
import { logPaymentEvent } from "@/lib/payments/observability";
import { encryptRecurringToken } from "@/lib/payments/tokenCrypto";
import { getPlanDefinitionId, getRolePlanKey } from "@/lib/subscriptionPlans";

// Autoriteetne tellimuse aktiveerimine ja recurring-mandaadi salvestus. Jagatud
// webhook'i ja reconciliation-worker'i vahel, et verifitseeritud PAID annaks
// mõlemal rajal identse tulemuse (T09 E1/E2/E3).

export function addMonths(baseDate, months) {
  const date = new Date(baseDate);
  date.setMonth(date.getMonth() + months);
  return date;
}

export function paidAtOrNow(value) {
  const parsed = value ? new Date(value) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
  return new Date();
}

/**
 * Aktiveeri tellimus makse pealt. Säilitab P1a: puuduva planDefinitionId korral
 * tuletatakse pakett RANGELT serveri rollist, mitte võimalik-eskaleeritud plaanist.
 */
export async function activateSubscriptionFromPayment(tx, payment) {
  const existing = await tx.subscription.findUnique({
    where: { id: payment.subscriptionId },
    select: {
      id: true,
      validUntil: true,
      billingMode: true,
      billingInterval: true,
      billingMethodId: true,
      plan: true,
      planDefinitionId: true,
      user: { select: { role: true } }
    }
  });
  if (!existing) return null;

  const now = new Date();
  const anchor =
    existing.validUntil && new Date(existing.validUntil).getTime() > now.getTime()
      ? new Date(existing.validUntil)
      : now;
  const validUntil = addMonths(anchor, 1);
  const planDefinitionId =
    existing.planDefinitionId || getPlanDefinitionId(getRolePlanKey(existing.user.role), existing.user.role);

  return tx.subscription.update({
    where: { id: existing.id },
    data: {
      status: SubscriptionStatus.ACTIVE,
      planDefinitionId,
      validUntil,
      nextBilling: existing.billingMode === BillingMode.RECURRING ? validUntil : null,
      lastBilledAt: paidAtOrNow(payment.paidAt),
      pastDueSince: null,
      billingRetryCount: 0,
      cancelAtPeriodEnd: false,
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

/**
 * Salvesta recurring-mandaat. E3/O-J1: token krüptitakse serveri võtmega ja
 * plaintekst-mandaati EI kirjutata. Fail-closed: kui krüptovõti puudub, mandaati
 * EI salvestata ja korduvmakse EI aktiveeru (billingMethodId jääb seadmata →
 * renewal ei vali seda tellimust).
 */
export async function upsertRecurringBillingMethod(tx, payment, payload, paidAt) {
  if (!payment?.subscriptionId) return null;
  const recurringToken = extractRecurringToken(payload);
  if (!recurringToken) return null;

  let encrypted;
  try {
    encrypted = encryptRecurringToken(recurringToken);
  } catch (error) {
    logPaymentEvent("subscription_recurring_token_encryption_unavailable", {
      subscriptionId: payment.subscriptionId,
      paymentId: payment.id,
      code: error?.code || "PAYMENT_TOKEN_KEY_UNAVAILABLE"
    });
    return null;
  }

  const expiresAtRaw = extractRecurringTokenValidUntil(payload);
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

  const existingSubscription = await tx.subscription.findUnique({
    where: { id: payment.subscriptionId },
    select: { id: true, userId: true, billingMethodId: true }
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
    providerToken: null,
    providerTokenCipher: encrypted.cipher,
    providerTokenKeyId: encrypted.keyId,
    providerMandateId,
    providerCustomerId,
    label,
    expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
    activatedAt: paidAt,
    lastUsedAt: paidAt,
    revokedAt: null
  };

  if (billingMethod?.id) {
    return tx.billingMethod.update({ where: { id: billingMethod.id }, data });
  }

  return tx.billingMethod.create({
    data: { userId: existingSubscription.userId, ...data }
  });
}
