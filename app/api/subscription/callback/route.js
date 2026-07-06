export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  BillingInterval,
  BillingMethodStatus,
  BillingMode,
  PaymentProvider,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeServerLocale } from "@/lib/i18n/serverMessages";
import { localizePath } from "@/lib/localizePath";
import {
  extractProviderPaymentId,
  getMaksekeskusSecretKey,
  parseMaksekeskusFormMessage,
  verifyMaksekeskusMac,
} from "@/lib/payments/maksekeskus";
import {
  extractRecurringToken,
  extractRecurringTokenValidUntil,
} from "@/lib/payments/recurring";
import { logPaymentEvent } from "@/lib/payments/observability";

function mapCallbackState(rawStatus) {
  const status = String(rawStatus || "")
    .toLowerCase()
    .trim();
  if (!status) return "pending";
  if (["paid", "success", "succeeded", "completed", "ok"].includes(status)) return "success";
  if (["failed", "error", "declined"].includes(status)) return "failed";
  if (["canceled", "cancelled", "aborted", "expired"].includes(status)) return "canceled";
  if (["pending", "processing", "initiated", "created", "approved"].includes(status)) {
    return "pending";
  }
  return "pending";
}

function pickLocale(url, req, payload = null) {
  const fromQuery = normalizeServerLocale(url.searchParams.get("locale"));
  if (fromQuery) return fromQuery;
  const fromPayload =
    normalizeServerLocale(payload?.customer?.locale) ||
    normalizeServerLocale(payload?.locale);
  if (fromPayload) return fromPayload;
  const fromHeader = normalizeServerLocale(req.headers.get("accept-language"));
  return fromHeader || "en";
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function asPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function persistRecurringToken(payload) {
  const providerPaymentId = extractProviderPaymentId(payload);
  const tokenId = extractRecurringToken(payload);
  const tokenValidUntil = parseDate(extractRecurringTokenValidUntil(payload));
  const isMultiUse = payload?.token?.multiuse === true || String(payload?.token?.multiuse || "").toLowerCase() === "true";

  if (!providerPaymentId || !tokenId || !isMultiUse) {
    return {
      updated: false,
      providerPaymentId,
      tokenId,
    };
  }

  const payment = await prisma.payment.findUnique({
    where: {
      provider_providerPaymentId: {
        provider: PaymentProvider.MAKSEKESKUS,
        providerPaymentId,
      },
    },
    select: {
      id: true,
      userId: true,
      subscriptionId: true,
      billingMethodId: true,
      raw: true,
    },
  });

  if (!payment?.subscriptionId) {
    return {
      updated: false,
      providerPaymentId,
      tokenId,
    };
  }

  const now = new Date();
  const billingMethod = await prisma.$transaction(async (tx) => {
    const existing =
      (payment.billingMethodId
        ? await tx.billingMethod.findUnique({
            where: { id: payment.billingMethodId },
            select: { id: true },
          })
        : null) ||
      (await tx.billingMethod.findFirst({
        where: {
          userId: payment.userId,
          provider: PaymentProvider.MAKSEKESKUS,
          providerToken: tokenId,
        },
        select: { id: true },
      }));

    const data = {
      status: BillingMethodStatus.ACTIVE,
      provider: PaymentProvider.MAKSEKESKUS,
      providerToken: tokenId,
      expiresAt: tokenValidUntil,
      activatedAt: now,
      lastUsedAt: now,
      revokedAt: null,
    };

    const method = existing?.id
      ? await tx.billingMethod.update({
          where: { id: existing.id },
          data,
          select: { id: true },
        })
      : await tx.billingMethod.create({
          data: {
            userId: payment.userId,
            ...data,
          },
          select: { id: true },
        });

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        billingMethodId: method.id,
        raw: {
          ...asPlainObject(payment.raw),
          tokenReturn: payload,
        },
      },
    });

    await tx.subscription.update({
      where: { id: payment.subscriptionId },
      data: {
        billingMode: BillingMode.RECURRING,
        billingInterval: BillingInterval.MONTHLY,
        billingMethodId: method.id,
      },
    });

    return method;
  });

  return {
    updated: true,
    providerPaymentId,
    tokenId,
    billingMethodId: billingMethod.id,
  };
}

function buildRedirectTarget(req, locale, paymentState, ref = "", extraParams = {}) {
  const target = new URL(localizePath("/tellimus", locale), req.url);
  target.searchParams.set("payment", paymentState);
  if (ref) target.searchParams.set("ref", ref);
  for (const [key, value] of Object.entries(extraParams || {})) {
    const normalized = String(value || "").trim();
    if (normalized) target.searchParams.set(key, normalized);
  }
  return target;
}

export async function GET(req) {
  const url = new URL(req.url);
  const locale = pickLocale(url, req);

  const rawStatus =
    url.searchParams.get("status") ||
    url.searchParams.get("payment_status") ||
    url.searchParams.get("transaction_status");
  const paymentState = mapCallbackState(rawStatus);
  const ref = String(
    url.searchParams.get("reference") ||
      url.searchParams.get("providerPaymentId") ||
      url.searchParams.get("transaction_id") ||
      ""
  )
    .trim()
    .slice(0, 180);

  logPaymentEvent("subscription_callback_redirect", {
    locale,
    rawStatus: rawStatus || "",
    paymentState,
    providerPaymentId: ref || "",
    method: "GET",
  });

  return NextResponse.redirect(buildRedirectTarget(req, locale, paymentState, ref), {
    status: 302,
  });
}

export async function POST(req) {
  const url = new URL(req.url);
  const rawBody = await req.text().catch(() => "");
  const parsed = parseMaksekeskusFormMessage(rawBody);
  const payload = parsed.payload;
  const signatureSecret = getMaksekeskusSecretKey();

  if (!parsed.jsonText || !payload) {
    logPaymentEvent("subscription_callback_invalid_payload", {
      reason: "missing_json",
    });
    return NextResponse.redirect(buildRedirectTarget(req, pickLocale(url, req), "failed"), {
      status: 302,
    });
  }

  if (!verifyMaksekeskusMac(parsed.jsonText, parsed.mac, signatureSecret)) {
    logPaymentEvent("subscription_callback_invalid_signature", {
      messageType: payload?.message_type || "",
    });
    return NextResponse.redirect(buildRedirectTarget(req, pickLocale(url, req, payload), "failed"), {
      status: 302,
    });
  }

  const locale = pickLocale(url, req, payload);
  const messageType = String(payload?.message_type || "").trim().toLowerCase();
  const providerPaymentId = extractProviderPaymentId(payload);
  const rawStatus = payload?.status || payload?.transaction?.status || "";
  const paymentState = mapCallbackState(rawStatus);

  if (messageType === "token_return") {
    try {
      const tokenResult = await persistRecurringToken(payload);
      logPaymentEvent("subscription_callback_token_processed", {
        providerPaymentId,
        updated: Boolean(tokenResult?.updated),
        billingMethodId: tokenResult?.billingMethodId || "",
      });
    } catch (error) {
      logPaymentEvent("subscription_callback_token_failed", {
        providerPaymentId,
        error,
      });
    }
  }

  logPaymentEvent("subscription_callback_redirect", {
    locale,
    rawStatus: rawStatus || "",
    paymentState,
    providerPaymentId: providerPaymentId || "",
    messageType,
    method: "POST",
  });

  return NextResponse.redirect(
    buildRedirectTarget(req, locale, paymentState, providerPaymentId, {
      callback: messageType || "payment_return",
    }),
    {
      status: 302,
    }
  );
}
