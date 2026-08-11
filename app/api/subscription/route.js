export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { SubscriptionStatus } from "@/generated/prisma/client";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { prisma } from "@/lib/prisma";
import {
  formatEuroAmount,
  getRoleMonthlyAmount,
  normalizeSubscriptionRole,
  resolveRoleBoundSubscriptionPlan
} from "@/lib/subscriptionPlans";
import { isSponsoredBillingSource, serializeSubscription } from "@/lib/subscriptionView";
import { logPaymentAudit } from "@/lib/payments/observability";
import { safeError } from "@/lib/privacy/safeError";

const ACTIVE_STATUS = SubscriptionStatus.ACTIVE;
const CANCELED_STATUS = SubscriptionStatus.CANCELED;
const ALLOW_DIRECT_ACTIVATION = process.env.SUBSCRIPTION_ALLOW_DIRECT_ACTIVATION === "1";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

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
      userId: String(token.id)
    };
  } catch {
    return null;
  }
}

function shape(subscription) {
  return serializeSubscription(subscription);
}

export async function GET(request) {
  const locale = localeFromRequest(request);
  const session = await requireUser(request);
  if (!session) {
    return errorJson("api.common.unauthorized", 401, locale);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        email: true,
        role: true
      }
    });

    if (!user) {
      return errorJson("api.subscription.user_not_found", 404, locale);
    }

    const subscription = await prisma.subscription.findFirst({
      where: { userId: session.userId },
      orderBy: [{ updatedAt: "desc" }]
    });

    return ok({
      user: {
        ...user,
        planRole: normalizeSubscriptionRole(user.role),
        monthlyAmount: getRoleMonthlyAmount(user.role),
        monthlyAmountLabel: formatEuroAmount(getRoleMonthlyAmount(user.role), locale)
      },
      subscription: shape(subscription)
    });
  } catch (error) {
    console.error("subscription GET error", safeError(error));
    return errorJson("api.subscription.load_failed", 500, locale);
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const locale = localeFromRequest(request, body?.locale || body?.lang);
  const session = await requireUser(request);
  if (!session) {
    return errorJson("api.common.unauthorized", 401, locale);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true }
    });
    if (!user) {
      return errorJson("api.subscription.user_not_found", 404, locale);
    }
    const roleBoundPlan = resolveRoleBoundSubscriptionPlan(user.role, body?.plan);
    if (!roleBoundPlan) {
      return errorJson("api.subscription.plan_not_allowed", 400, locale);
    }
    if (!ALLOW_DIRECT_ACTIVATION) {
      return errorJson("api.subscription.direct_activation_disabled", 409, locale, {
        initPath: "/api/subscription/init"
      });
    }
    const { plan, planDefinitionId } = roleBoundPlan;
    const now = new Date();
    const validUntil = new Date(now);
    validUntil.setMonth(validUntil.getMonth() + 1);

    const existing = await prisma.subscription.findFirst({
      where: { userId: session.userId },
      orderBy: [{ createdAt: "desc" }]
    });

    const subscription = existing
      ? await prisma.subscription.update({
          where: { id: existing.id },
          data: {
            status: ACTIVE_STATUS,
            plan,
            planDefinitionId,
            validUntil,
            nextBilling: validUntil,
            canceledAt: null
          }
        })
      : await prisma.subscription.create({
          data: {
            userId: session.userId,
            status: ACTIVE_STATUS,
            plan,
            planDefinitionId,
            validUntil,
            nextBilling: validUntil
          }
        });

    return ok({
      subscription: shape(subscription)
    });
  } catch (error) {
    console.error("subscription POST error", safeError(error));
    return errorJson("api.subscription.activate_failed", 500, locale);
  }
}

export async function DELETE(request) {
  const locale = localeFromRequest(request);
  const session = await requireUser(request);
  if (!session) {
    return errorJson("api.common.unauthorized", 401, locale);
  }

  try {
    const now = new Date();
    // O-M4: kasutaja tühistus = cancelAtPeriodEnd. Makstud ligipääs kestab
    // validUntil-ini, uusi uuendusmakseid ei alustata (nextBilling nulli).
    // Ainult omamaksega (SELF) ACTIVE tellimus; sponsoreeritut kasutaja ei tühista.
    const periodEnd = await prisma.subscription.updateMany({
      where: {
        userId: session.userId,
        status: ACTIVE_STATUS,
        billingSource: "SELF"
      },
      data: {
        cancelAtPeriodEnd: true,
        nextBilling: null
      }
    });
    // PAST_DUE (ligipääs juba lõppenud): tühistus peatab retry'd kohe.
    const pastDueCanceled = await prisma.subscription.updateMany({
      where: {
        userId: session.userId,
        status: SubscriptionStatus.PAST_DUE,
        billingSource: "SELF"
      },
      data: {
        status: CANCELED_STATUS,
        canceledAt: now,
        cancelAtPeriodEnd: true,
        nextBilling: null
      }
    });

    const subscription = await prisma.subscription.findFirst({
      where: { userId: session.userId },
      orderBy: [{ updatedAt: "desc" }]
    });

    const canceledSomething = periodEnd.count > 0 || pastDueCanceled.count > 0;

    if (subscription && canceledSomething) {
      logPaymentAudit({
        action: "subscription_cancel_requested",
        result: pastDueCanceled.count > 0 ? "canceled" : "cancel_at_period_end",
        subscriptionId: subscription.id,
        userId: session.userId
      });
    }

    /* SOL-PAY-04 kõrvalparandus: tühistus nõuab `billingSource: "SELF"`, aga
       vastus oli seni `ok` ka siis, kui ükski rida ei liikunud. Just see vaikimine
       tegi päritolu-veast nähtamatu vea: omamaksja klõpsas „lõpeta", sai eduka
       vastuse ja tellimus uuenes edasi. Sponsoreeritud tellimust kasutaja ei
       tühista — aga see öeldakse nüüd välja. */
    if (!canceledSomething && isSponsoredBillingSource(subscription?.billingSource)) {
      logPaymentAudit({
        action: "subscription_cancel_requested",
        result: "sponsored_not_cancelable",
        subscriptionId: subscription?.id || null,
        userId: session.userId
      });
      return errorJson("api.subscription.cancel_not_self_paid", 409, locale, {
        subscription: shape(subscription)
      });
    }

    return ok({
      subscription: shape(subscription)
    });
  } catch (error) {
    console.error("subscription DELETE error", safeError(error));
    return errorJson("api.subscription.cancel_failed", 500, locale);
  }
}
