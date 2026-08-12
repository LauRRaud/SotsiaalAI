export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  BillingInterval,
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
import { extractRecurringToken } from "@/lib/payments/recurring";
import { logPaymentEvent } from "@/lib/payments/observability";
import { buildPaymentRawRecord } from "@/lib/payments/rawProjection";
import { claimRecurringBillingMethod } from "@/lib/payments/billingMethodClaim";

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

function asPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function persistRecurringToken(payload) {
  const providerPaymentId = extractProviderPaymentId(payload);
  const tokenId = extractRecurringToken(payload);
  const isMultiUse = payload?.token?.multiuse === true || String(payload?.token?.multiuse || "").toLowerCase() === "true";

  if (!providerPaymentId || !tokenId || !isMultiUse) {
    return {
      updated: false,
      providerPaymentId,
    };
  }

  const now = new Date();
  /* SOL-PAY-10: kogu otsus käib ÜHES tehingus ja LUKUSTATUD makse rea peal.
     Vana kood luges makse tehingust väljas ja tegi mandaadi salvestuse oma
     teostusega — kaks callback'i või callback + webhook võisid mõlemad lugeda
     nulli ja luua eraldi aktiivse tokenirea.

     LUKUJÄRJEKORD on sama mis webhookis: makse rida FOR UPDATE → nõuandelukk
     kasutaja peale (viimase võtab `claimRecurringBillingMethod`). Vastupidine
     järjekord siin tähendaks ummikut nende kahe raja vahel. */
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT 1 FROM "Payment"
      WHERE "providerPaymentId" = ${providerPaymentId}
      FOR UPDATE
    `;

    const payment = await tx.payment.findUnique({
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

    if (!payment?.subscriptionId) return null;
    /* SOL-PAY-09: `userId` on nüüd nullitav — kustutatud maksja kirje jääb
       raamatupidamise jaoks alles. Hiline callback sellise rea peale ei tohi
       proovida makseviisi luua: FK kukuks ja kasutaja saaks 500 selle asemel,
       et me lihtsalt tunnistaksime, et maksjat ei ole enam. */
    if (!payment.userId) return null;

    const method = await claimRecurringBillingMethod(tx, {
      userId: payment.userId,
      preferredBillingMethodId: payment.billingMethodId,
      payload,
      at: now,
    });
    if (!method?.id) return null;

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        billingMethodId: method.id,
        raw: buildPaymentRawRecord(asPlainObject(payment.raw), payload),
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

  if (!outcome?.id) {
    return {
      updated: false,
      providerPaymentId,
    };
  }

  return {
    updated: true,
    providerPaymentId,
    billingMethodId: outcome.id,
  };
}

// Proxy taga on req.url origin localhost:3000 — brauserisuunamised peavad
// minema avaliku origini pihta (x-forwarded-host/host), muidu maandub
// maksja localhostil (juhtus 22.07 päris maksega).
function resolvePublicOrigin(requestUrl, headers) {
  const fallback = new URL(requestUrl).origin;
  const forwardedHost = String(headers?.get?.("x-forwarded-host") || "").trim();
  const directHost = String(headers?.get?.("host") || "").trim();
  const forwardedProto = String(headers?.get?.("x-forwarded-proto") || "").trim();
  const resolvedHost = forwardedHost || directHost;
  if (!resolvedHost) return fallback;
  const protocol = forwardedProto || (fallback.startsWith("https://") ? "https" : "http");
  return `${protocol}://${resolvedHost}`;
}

function buildRedirectTarget(req, locale, paymentState, ref = "", extraParams = {}) {
  const target = new URL(localizePath("/tellimus", locale), resolvePublicOrigin(req.url, req.headers));
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

  // Fail-closed (L-02): ilma seadistatud saladuseta ei verifitseeri ega
  // salvesta tokenit — tühi saladus ei tohi vaikimisi läbida.
  if (!String(signatureSecret || "").trim()) {
    logPaymentEvent("subscription_callback_signature_unconfigured", {
      messageType: payload?.message_type || "",
    });
    return NextResponse.redirect(buildRedirectTarget(req, pickLocale(url, req, payload), "failed"), {
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
