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
  makeProviderPaymentId,
} from "@/lib/payments/maksekeskus";
import { getInitialSubscriptionPaymentKind, isRecurringBillingEnabled } from "@/lib/payments/recurring";
import { logPaymentEvent } from "@/lib/payments/observability";
import { safeError } from "@/lib/privacy/safeError";
import {
  getRoleMonthlyAmount,
  getRolePlanDescription,
  getRolePlanKey,
  normalizeSubscriptionRole
} from "@/lib/subscriptionPlans";

const PLAN_MAX_LEN = 80;
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

function normalizePlan(value, fallbackPlan) {
  const raw = typeof value === "string" ? value.trim() : "";
  const fallback = String(
    fallbackPlan || process.env.SUBSCRIPTION_DEFAULT_PLAN || "monthly"
  ).trim();
  const plan = raw || fallback || "monthly";
  return plan.length > PLAN_MAX_LEN ? plan.slice(0, PLAN_MAX_LEN) : plan;
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

function resolveUrl(request, envValue, fallbackPath) {
  const direct = String(envValue || "").trim();
  if (direct) {
    try {
      return new URL(direct).toString();
    } catch {}
  }

  try {
    return new URL(fallbackPath, request.url).toString();
  } catch {
    return "";
  }
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

  const planRole = normalizeSubscriptionRole(user.role);
  const plan = normalizePlan(body?.plan, getRolePlanKey(planRole));
  const amount = getRoleMonthlyAmount(planRole).toFixed(2);
  const currency = normalizeCurrency(process.env.SUBSCRIPTION_CURRENCY || "EUR");
  const recurringEnabled = isRecurringBillingEnabled();
  if (!isTruthyFlag(body?.acceptedTerms)) {
    return errorJson("api.subscription.checkout_terms_required", 400, locale);
  }
  if (!recurringEnabled) {
    return errorJson("api.subscription.recurring_provider_unavailable", 503, locale);
  }

  let paymentRecord = null;
  try {
    logPaymentEvent("subscription_init_started", {
      userId: session.userId,
      plan,
      planRole,
      amount,
      currency
    });

    const existing = await prisma.subscription.findFirst({
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
      return errorJson("api.subscription.already_active", 409, locale);
    }

    const subscription =
      existing ||
      (await prisma.subscription.create({
        data: {
          userId: session.userId,
          status: SubscriptionStatus.NONE,
          plan,
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
      }));

    const providerPaymentId = makeProviderPaymentId(session.userId);
    paymentRecord = await prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        userId: session.userId,
        provider: PaymentProvider.MAKSEKESKUS,
        kind: getInitialSubscriptionPaymentKind(),
        providerPaymentId,
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
        raw: true
      }
    });

    const returnUrl = resolveUrl(request, process.env.MAKSEKESKUS_RETURN_URL, "/api/subscription/callback");
    const cancelUrl = resolveUrl(request, process.env.MAKSEKESKUS_CANCEL_URL, "/api/subscription/callback");
    const webhookUrl = resolveUrl(request, process.env.MAKSEKESKUS_WEBHOOK_URL, "/api/subscription/webhook");
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
          checkout: checkout.raw || null
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
    if (paymentRecord?.id) {
      try {
        await prisma.payment.update({
          where: { id: paymentRecord.id },
          data: {
            status: PaymentStatus.FAILED,
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
      error
    });
    return errorJson(messageKey, status, locale);
  }
}
