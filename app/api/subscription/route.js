export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { SubscriptionStatus } from "@/generated/prisma/client";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { prisma } from "@/lib/prisma";
import {
  formatEuroAmount,
  getRoleMonthlyAmount,
  normalizeSubscriptionRole
} from "@/lib/subscriptionPlans";
import { safeError } from "@/lib/privacy/safeError";

const ACTIVE_STATUS = SubscriptionStatus.ACTIVE;
const CANCELED_STATUS = SubscriptionStatus.CANCELED;
const PLAN_MAX_LEN = 80;
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
  if (!subscription) return null;

  const now = Date.now();
  const hasNoExpiry = subscription.validUntil == null;
  const validUntilTs = subscription.validUntil
    ? new Date(subscription.validUntil).getTime()
    : null;
  const daysLeft =
    validUntilTs && validUntilTs > now
      ? Math.ceil((validUntilTs - now) / (1000 * 60 * 60 * 24))
      : 0;
  const isActive =
    subscription.status === ACTIVE_STATUS &&
    (hasNoExpiry || daysLeft > 0);
  const billingSource = String(subscription.billingSource || "SELF").toUpperCase();
  const isSponsored = billingSource === "SPONSORED_BY_HOST";
  const sponsorEndsSoon = Boolean(isSponsored && isActive && daysLeft > 0 && daysLeft <= 7);
  const sponsorExpired = Boolean(isSponsored && !isActive);

  return {
    id: subscription.id,
    status: subscription.status,
    plan: subscription.plan,
    billingSource,
    validUntil: subscription.validUntil,
    nextBilling: subscription.nextBilling,
    canceledAt: subscription.canceledAt,
    updatedAt: subscription.updatedAt,
    isActive,
    daysLeft,
    isSponsored,
    sponsorEndsSoon,
    sponsorExpired
  };
}

function normalizePlan(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  const fallback = String(process.env.SUBSCRIPTION_DEFAULT_PLAN || "monthly").trim();
  const plan = raw || fallback || "monthly";
  return plan.length > PLAN_MAX_LEN ? plan.slice(0, PLAN_MAX_LEN) : plan;
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
  if (!ALLOW_DIRECT_ACTIVATION) {
    return errorJson("api.subscription.direct_activation_disabled", 409, locale, {
      initPath: "/api/subscription/init"
    });
  }

  try {
    const plan = normalizePlan(body?.plan);
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
    await prisma.subscription.updateMany({
      where: {
        userId: session.userId,
        status: ACTIVE_STATUS
      },
      data: {
        status: CANCELED_STATUS,
        canceledAt: now
      }
    });

    const subscription = await prisma.subscription.findFirst({
      where: { userId: session.userId },
      orderBy: [{ updatedAt: "desc" }]
    });

    return ok({
      subscription: shape(subscription)
    });
  } catch (error) {
    console.error("subscription DELETE error", safeError(error));
    return errorJson("api.subscription.cancel_failed", 500, locale);
  }
}
