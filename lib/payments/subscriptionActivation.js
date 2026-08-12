import { BillingMode, SubscriptionStatus } from "@/generated/prisma/client";
import { claimRecurringBillingMethod } from "@/lib/payments/billingMethodClaim";
import { applySubscriptionOrigin, selfOrigin } from "@/lib/payments/subscriptionOrigin";
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
      userId: true,
      validUntil: true,
      billingMode: true,
      billingInterval: true,
      billingMethodId: true,
      plan: true,
      planDefinitionId: true,
      billingSource: true,
      sponsorUserId: true,
      inviteId: true,
      sponsorOrganizationId: true,
      orgClientSponsorshipId: true,
      user: { select: { role: true } }
    }
  });
  if (!existing) return null;

  /* SOL-PAY-04: KES MAKSAB, muutub siin — mitte init'is. Init on kavatsus, mitte
     tõend (vt SOL-PAY-02): kui ta puhastaks sponsori seosed juba checkout'i
     avamisel, kaotaks lõpetamata makse perioodi päritolu, mille eest sponsor
     päriselt maksis. Õigust andev tehing on ainus koht, kus maksja on teada.
     Sponsori enda makse (kutse) ei tule kunagi siia: tal ei ole `subscriptionId`. */
  if (payment.userId && existing.userId && String(payment.userId) === String(existing.userId)) {
    await applySubscriptionOrigin(tx, {
      subscription: existing,
      origin: selfOrigin(),
      actorUserId: payment.userId,
      paymentId: payment.id || null,
      reason: "self_payment"
    });
  }

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

  const existingSubscription = await tx.subscription.findUnique({
    where: { id: payment.subscriptionId },
    select: { id: true, userId: true, billingMethodId: true }
  });
  if (!existingSubscription) return null;

  /* SOL-PAY-10: mandaadi salvestus elab ÜHES kohas ja käib kasutajapõhise
     nõuandeluku all. Varem oli siin oma teostus ja `token_return` callback'is
     teine — kaks rada võisid mõlemad lugeda nulli ja luua eraldi aktiivse
     tokenirea. */
  return claimRecurringBillingMethod(tx, {
    userId: existingSubscription.userId,
    preferredBillingMethodId: existingSubscription.billingMethodId,
    payload,
    at: paidAt
  });
}
