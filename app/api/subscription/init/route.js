export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { BillingInterval, BillingMode, PaymentProvider, PaymentStatus, SubscriptionStatus } from "@/generated/prisma/client";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";
import {
  createMaksekeskusRecurringSetup,
  getMaksekeskusCheckoutClientConfig,
  makeProviderPaymentId,
} from "@/lib/payments/maksekeskus";
import { resolveCheckoutUrl } from "@/lib/payments/checkoutUrls";
import { getInitialSubscriptionPaymentKind, isRecurringBillingEnabled } from "@/lib/payments/recurring";
import {
  claimCheckoutIntent,
  getStoredCheckoutTransactionId,
  normalizeClientIntentKey
} from "@/lib/payments/checkoutIntent";
import {
  PaymentFailureStage,
  classifyPaymentFailure
} from "@/lib/payments/providerOutcome";
import { logPaymentEvent } from "@/lib/payments/observability";
import { projectProviderPaymentRaw } from "@/lib/payments/rawProjection";
import { safeError } from "@/lib/privacy/safeError";
import {
  getRoleMonthlyAmount,
  getRolePlanDescription,
  resolveRoleBoundSubscriptionPlan
} from "@/lib/subscriptionPlans";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};
const SUBSCRIPTION_INIT_RATE_LIMIT_WINDOW_MS = Number(process.env.SUBSCRIPTION_INIT_RATE_LIMIT_WINDOW_MS || 60_000);
const SUBSCRIPTION_INIT_RATE_LIMIT_MAX = Number(process.env.SUBSCRIPTION_INIT_RATE_LIMIT_MAX || 10);

function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: NO_STORE_HEADERS
  });
}

function ok(payload = {}, status = 200) {
  return json(
    {
      ok: true,
      ...payload
    },
    status
  );
}

function errorJson(messageKey, status = 400, locale = "en", extras = {}) {
  const translated = serverT(locale, messageKey, undefined, messageKey);
  return json(
    {
      ok: false,
      messageKey,
      message: translated,
      error: translated,
      ...extras
    },
    status
  );
}

function localeFromRequest(request, bodyLocale) {
  const direct = normalizeServerLocale(bodyLocale);
  if (direct) return direct;

  const raw = String(request?.headers?.get("accept-language") || "");
  const parts = raw
    .split(",")
    .map((part) => part.split(";")[0].trim())
    .filter(Boolean);

  for (const part of parts) {
    const normalized = normalizeServerLocale(part);
    if (normalized) return normalized;
  }

  return "en";
}

async function requireUser(request) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });

    if (!token?.id) return null;
    return {
      token,
      userId: String(token.id),
      email: token.email ? String(token.email) : ""
    };
  } catch {
    return null;
  }
}

function normalizeCurrency(value) {
  const normalized = String(value || "EUR")
    .trim()
    .toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "EUR";
}

function isTruthyFlag(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isSubscriptionActive(subscription) {
  if (!subscription) return false;
  if (subscription.status !== SubscriptionStatus.ACTIVE) return false;
  if (!subscription.validUntil) return true;
  return new Date(subscription.validUntil).getTime() > Date.now();
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const locale = localeFromRequest(request, body?.locale || body?.lang);

  const session = await requireUser(request);
  if (!session) {
    return errorJson("api.common.unauthorized", 401, locale);
  }

  const ip = getRequestIpFromRequest(request);
  const limiter = consumeRateLimit(
    `subscription:init:${session.userId}:${ip}`,
    SUBSCRIPTION_INIT_RATE_LIMIT_MAX,
    SUBSCRIPTION_INIT_RATE_LIMIT_WINDOW_MS
  );
  if (!limiter.allowed) {
    logPaymentEvent("subscription_init_rate_limited", {
      userId: session.userId,
      ip
    });
    return json(
      {
        ok: false,
        messageKey: "api.common.rate_limited",
        message: serverT(locale, "api.common.rate_limited", undefined, "api.common.rate_limited")
      },
      429
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      role: true
    }
  });

  if (!user) {
    return errorJson("api.subscription.user_not_found", 404, locale);
  }

  const roleBoundPlan = resolveRoleBoundSubscriptionPlan(user.role, body?.plan);
  if (!roleBoundPlan) {
    return errorJson("api.subscription.plan_not_allowed", 400, locale);
  }
  const { planRole, plan, planDefinitionId } = roleBoundPlan;
  const amount = getRoleMonthlyAmount(planRole).toFixed(2);
  const currency = normalizeCurrency(process.env.SUBSCRIPTION_CURRENCY || "EUR");
  const recurringEnabled = isRecurringBillingEnabled();
  if (!isTruthyFlag(body?.acceptedTerms)) {
    return errorJson("api.subscription.checkout_terms_required", 400, locale);
  }
  if (!recurringEnabled) {
    return errorJson("api.subscription.recurring_provider_unavailable", 503, locale);
  }

  /* SOL-PAY-03: kavatsus tuleb kliendilt ja ta on kohustuslik. Võtmeta päring
     tähendaks „tee uus tasuline checkout", mis on täpselt see käitumine, mille
     leid nimetas. */
  const clientIntentKey = normalizeClientIntentKey(body?.idempotencyKey ?? body?.clientIntentKey);
  if (!clientIntentKey) {
    return errorJson("api.subscription.checkout_intent_required", 400, locale);
  }

  let paymentRecord = null;
  let providerCalled = false;
  try {
    logPaymentEvent("subscription_init_started", {
      userId: session.userId,
      plan,
      planRole,
      amount,
      currency
    });

    /* Kogu otsus „kas see kasutaja tohib avada uue tasutava checkout'i" käib ühe
       nõuandeluku all: aktiivsuse kontroll, tellimuse upsert ja makse loomine.
       Vana kood tegi kõik kolm eraldi päringutena, seega kaks paralleelset
       init'i võisid mõlemad läbida. */
    const claim = await claimCheckoutIntent({
      db: prisma,
      userId: session.userId,
      clientIntentKey,
      expected: { amount, currency, kind: getInitialSubscriptionPaymentKind() },
      createAttempt: async (tx) => {
        const existing = await tx.subscription.findFirst({
          where: { userId: session.userId },
          orderBy: [{ updatedAt: "desc" }],
          select: {
            id: true,
            status: true,
            validUntil: true,
            plan: true
          }
        });

        if (isSubscriptionActive(existing)) {
          const activeError = new Error("api.subscription.already_active");
          activeError.code = "SUBSCRIPTION_ALREADY_ACTIVE";
          throw activeError;
        }

        const subscription = existing
          ? await tx.subscription.update({
              where: { id: existing.id },
              data: {
                plan,
                planDefinitionId,
                billingMode: BillingMode.RECURRING,
                billingInterval: BillingInterval.MONTHLY,
                billingRetryCount: 0
              },
              select: {
                id: true,
                status: true,
                validUntil: true,
                plan: true
              }
            })
          : await tx.subscription.create({
              data: {
                userId: session.userId,
                status: SubscriptionStatus.NONE,
                plan,
                planDefinitionId,
                billingMode: BillingMode.RECURRING,
                billingInterval: BillingInterval.MONTHLY,
                billingRetryCount: 0
              },
              select: {
                id: true,
                status: true,
                validUntil: true,
                plan: true
              }
            });

        return tx.payment.create({
          data: {
            subscriptionId: subscription.id,
            userId: session.userId,
            provider: PaymentProvider.MAKSEKESKUS,
            kind: getInitialSubscriptionPaymentKind(),
            providerPaymentId: makeProviderPaymentId(session.userId),
            clientIntentKey,
            amount,
            currency,
            status: PaymentStatus.INITIATED,
            raw: {
              flow: "subscription_init",
              plan,
              planRole,
              locale,
              billingMode: BillingMode.RECURRING,
              recurringEnabled: true,
              checkoutConsent: true
            }
          },
          select: {
            id: true,
            providerPaymentId: true,
            status: true,
            subscriptionId: true,
            raw: true
          }
        });
      }
    });

    if (claim.outcome === "spent") {
      logPaymentEvent("subscription_init_intent_used", {
        userId: session.userId,
        paymentId: claim.payment?.id || null,
        status: claim.payment?.status || ""
      });
      return errorJson("api.subscription.checkout_intent_used", 409, locale);
    }

    if (claim.outcome === "in_progress" || claim.outcome === "conflict") {
      logPaymentEvent("subscription_init_checkout_in_progress", {
        userId: session.userId,
        paymentId: claim.payment?.id || null,
        outcome: claim.outcome
      });
      return errorJson("api.subscription.checkout_in_progress", 409, locale);
    }

    if (claim.outcome === "reused") {
      const clientConfig = getMaksekeskusCheckoutClientConfig();
      logPaymentEvent("subscription_init_checkout_reused", {
        userId: session.userId,
        paymentId: claim.payment.id,
        providerPaymentId: claim.payment.providerPaymentId
      });
      return ok({
        paymentId: claim.payment.id,
        providerPaymentId: claim.payment.providerPaymentId,
        checkoutMode: "iframe_recurring",
        reused: true,
        transactionId: getStoredCheckoutTransactionId(claim.payment),
        publishableKey: clientConfig.publishableKey,
        scriptUrl: clientConfig.scriptUrl
      });
    }

    paymentRecord = claim.payment;
    const providerPaymentId = paymentRecord.providerPaymentId;
    const subscription = { id: paymentRecord.subscriptionId };

    const returnUrl = resolveCheckoutUrl(process.env.MAKSEKESKUS_RETURN_URL, "/api/subscription/callback");
    const cancelUrl = resolveCheckoutUrl(process.env.MAKSEKESKUS_CANCEL_URL, "/api/subscription/callback");
    const webhookUrl = resolveCheckoutUrl(process.env.MAKSEKESKUS_WEBHOOK_URL, "/api/subscription/webhook");
    const commonCheckoutInput = {
      providerPaymentId,
      amount,
      currency,
      locale,
      returnUrl,
      cancelUrl,
      webhookUrl,
      customerEmail: session.email,
      description: getRolePlanDescription(planRole, locale),
      merchantData: {
        flow: "subscription_init",
        paymentId: paymentRecord.id,
        subscriptionId: subscription.id,
        plan,
        planRole,
      },
      ip,
    };

    const checkout = await createMaksekeskusRecurringSetup(commonCheckoutInput);
    /* SOL-PAY-02: siit edasi on provideri pool transaktsioon OLEMAS. Iga
       järgnev tõrge on MEIE oma ja ei tohi enam anda providerilt kinnitatud
       eitust — muidu visatakse hilisem PAID ära. */
    providerCalled = true;
    const finalProviderPaymentId = checkout.providerPaymentId || providerPaymentId;

    await prisma.payment.update({
      where: { id: paymentRecord.id },
      data: {
        providerPaymentId: finalProviderPaymentId,
        raw: {
          ...(paymentRecord.raw && typeof paymentRecord.raw === "object" ? paymentRecord.raw : {}),
          flow: "subscription_init",
          plan,
          planRole,
          amount,
          currency,
          locale,
          billingMode: BillingMode.RECURRING,
          recurringEnabled: true,
          checkoutConsent: true,
          checkoutMode: "iframe_recurring",
          transactionId: checkout.transactionId || null,
          checkout: projectProviderPaymentRaw(checkout.raw)
        }
      }
    });

    logPaymentEvent("subscription_init_checkout_created", {
      userId: session.userId,
      paymentId: paymentRecord.id,
      providerPaymentId: finalProviderPaymentId,
      checkoutMode: "iframe_recurring"
    });

    return ok({
      paymentId: paymentRecord.id,
      providerPaymentId: finalProviderPaymentId,
      checkoutMode: "iframe_recurring",
      transactionId: checkout.transactionId,
      publishableKey: checkout.publishableKey,
      scriptUrl: checkout.scriptUrl
    });
  } catch (error) {
    if (error?.code === "SUBSCRIPTION_ALREADY_ACTIVE") {
      return errorJson("api.subscription.already_active", 409, locale);
    }

    /* SOL-PAY-02: kolm eri asja, mis vana koodi jaoks olid kõik „FAILED".
       `outcome.status` on RECONCILE_PENDING alati, kui provider VÕIS makse vastu
       võtta — sealt saab hilisem PAID webhook ta veel üles korjata. */
    const outcome = classifyPaymentFailure({
      stage: providerCalled ? PaymentFailureStage.AFTER_PROVIDER : PaymentFailureStage.PROVIDER_CALL,
      error
    });

    if (paymentRecord?.id) {
      try {
        await prisma.payment.update({
          where: { id: paymentRecord.id },
          data: {
            status: outcome.status,
            ...(outcome.terminal ? { failedAt: new Date() } : {}),
            raw: {
              ...(paymentRecord.raw && typeof paymentRecord.raw === "object" ? paymentRecord.raw : {}),
              flow: "subscription_init",
              plan,
              planRole,
              amount,
              currency,
              locale,
              recurringEnabled: true,
              checkoutConsent: true,
              failureReason: outcome.reason,
              providerConfirmed: outcome.providerConfirmed,
              error: error?.message || "init_failed"
            }
          }
        });
      } catch {}
    }
    console.error("subscription init error", safeError(error));
    const messageKey = String(error?.message || "").startsWith("api.subscription.")
      ? String(error.message)
      : "api.subscription.checkout_create_failed";
    const status = messageKey === "api.subscription.provider_unavailable" ? 503 : 502;
    logPaymentEvent("subscription_init_failed", {
      userId: session.userId,
      paymentId: paymentRecord?.id || null,
      messageKey,
      status,
      paymentStatus: outcome.status,
      failureReason: outcome.reason,
      error
    });
    return errorJson(messageKey, status, locale);
  }
}
