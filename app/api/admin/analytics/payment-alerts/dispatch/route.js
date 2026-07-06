import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import { buildPaymentAlerts, buildPaymentPipelineFromCounts } from "@/lib/admin/payment-alerts";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const WEBHOOK_URL = String(process.env.PAYMENT_ALERT_WEBHOOK_URL || "").trim();
const WEBHOOK_SIGNING_SECRET = String(process.env.PAYMENT_ALERT_WEBHOOK_SIGNING_SECRET || "").trim();
const DISPATCH_KEY = String(process.env.PAYMENT_ALERT_DISPATCH_KEY || "").trim();
const DISPATCH_TIMEOUT_MS = Number(process.env.PAYMENT_ALERT_WEBHOOK_TIMEOUT_MS || 10_000);
const DISPATCH_DEDUPE_HOURS = Number(process.env.PAYMENT_ALERT_DISPATCH_DEDUPE_HOURS || 6);

function localeFromRequest(req) {
  const url = new URL(req.url);
  const fromQuery = normalizeServerLocale(url.searchParams.get("locale"));
  if (fromQuery) return fromQuery;

  const fromHeader =
    normalizeServerLocale(req.headers.get("x-ui-locale")) ||
    normalizeServerLocale(req.headers.get("x-locale")) ||
    normalizeServerLocale(req.headers.get("accept-language"));

  return fromHeader || "en";
}

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0"
    }
  });
}

function errorJson(messageKey, status = 400, locale = "en", extras = {}) {
  const translated = serverT(locale, messageKey, undefined, messageKey);
  return json(
    {
      ok: false,
      messageKey,
      message: translated,
      ...extras
    },
    status
  );
}

function timingSafeEqualToken(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (!left.length || !right.length || left.length !== right.length) return false;
  try {
    return crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function shouldUseFlag(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .trim();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function makeWebhookSignature(payloadText, timestamp) {
  if (!WEBHOOK_SIGNING_SECRET) return "";
  return crypto.createHmac("sha256", WEBHOOK_SIGNING_SECRET).update(`${timestamp}.${payloadText}`).digest("hex");
}

function trimText(value, max = 300) {
  const text = String(value || "");
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

async function resolvePaymentCounts(since) {
  const [
    initStarted,
    checkoutCreated,
    initFailed,
    callbackSuccess,
    callbackPending,
    callbackFailed,
    callbackCanceled,
    webhookProcessed,
    webhookPaid,
    webhookFailed,
    webhookCanceled,
    webhookRefunded,
    webhookError,
    webhookInvalidSignature,
    webhookInvalidPayload,
    webhookRateLimited
  ] = await Promise.all([
    prisma.chatLog.count({
      where: {
        event: "subscription_init_started",
        createdAt: { gte: since }
      }
    }),
    prisma.chatLog.count({
      where: {
        event: "subscription_init_checkout_created",
        createdAt: { gte: since }
      }
    }),
    prisma.chatLog.count({
      where: {
        event: "subscription_init_failed",
        createdAt: { gte: since }
      }
    }),
    prisma.chatLog.count({
      where: {
        event: "subscription_callback_redirect",
        createdAt: { gte: since },
        data: {
          path: ["paymentState"],
          equals: "success"
        }
      }
    }),
    prisma.chatLog.count({
      where: {
        event: "subscription_callback_redirect",
        createdAt: { gte: since },
        data: {
          path: ["paymentState"],
          equals: "pending"
        }
      }
    }),
    prisma.chatLog.count({
      where: {
        event: "subscription_callback_redirect",
        createdAt: { gte: since },
        data: {
          path: ["paymentState"],
          equals: "failed"
        }
      }
    }),
    prisma.chatLog.count({
      where: {
        event: "subscription_callback_redirect",
        createdAt: { gte: since },
        data: {
          path: ["paymentState"],
          equals: "canceled"
        }
      }
    }),
    prisma.chatLog.count({
      where: {
        event: "subscription_webhook_processed",
        createdAt: { gte: since }
      }
    }),
    prisma.chatLog.count({
      where: {
        event: "subscription_webhook_processed",
        createdAt: { gte: since },
        data: {
          path: ["resultStatus"],
          equals: "PAID"
        }
      }
    }),
    prisma.chatLog.count({
      where: {
        event: "subscription_webhook_processed",
        createdAt: { gte: since },
        data: {
          path: ["resultStatus"],
          equals: "FAILED"
        }
      }
    }),
    prisma.chatLog.count({
      where: {
        event: "subscription_webhook_processed",
        createdAt: { gte: since },
        data: {
          path: ["resultStatus"],
          equals: "CANCELED"
        }
      }
    }),
    prisma.chatLog.count({
      where: {
        event: "subscription_webhook_processed",
        createdAt: { gte: since },
        data: {
          path: ["resultStatus"],
          equals: "REFUNDED"
        }
      }
    }),
    prisma.chatLog.count({
      where: {
        event: "subscription_webhook_failed",
        createdAt: { gte: since }
      }
    }),
    prisma.chatLog.count({
      where: {
        event: "subscription_webhook_invalid_signature",
        createdAt: { gte: since }
      }
    }),
    prisma.chatLog.count({
      where: {
        event: "subscription_webhook_invalid_payload",
        createdAt: { gte: since }
      }
    }),
    prisma.chatLog.count({
      where: {
        event: "subscription_webhook_rate_limited",
        createdAt: { gte: since }
      }
    })
  ]);

  return {
    initStarted,
    checkoutCreated,
    initFailed,
    callbackSuccess,
    callbackPending,
    callbackFailed,
    callbackCanceled,
    webhookProcessed,
    webhookPaid,
    webhookFailed,
    webhookCanceled,
    webhookRefunded,
    webhookError,
    webhookInvalidSignature,
    webhookInvalidPayload,
    webhookRateLimited
  };
}

async function filterDedupedAlerts(alerts = []) {
  const dedupeSince = new Date(Date.now() - Math.max(1, DISPATCH_DEDUPE_HOURS) * 60 * 60 * 1000);
  const existingList = await Promise.all(
    alerts.map(alert =>
      prisma.chatLog.findFirst({
        where: {
          event: "payment_alert_dispatched",
          createdAt: { gte: dedupeSince },
          data: {
            path: ["code"],
            equals: String(alert?.code || "")
          }
        },
        select: {
          id: true
        }
      })
    )
  );
  return alerts.filter((_, idx) => !existingList[idx]);
}

export async function POST(req) {
  const url = new URL(req.url);
  const locale = localeFromRequest(req);
  const dryRun = shouldUseFlag(url.searchParams.get("dryRun"));
  const bypassDedupe = shouldUseFlag(url.searchParams.get("bypassDedupe"));
  const providedKey =
    req.headers.get("x-payment-alert-dispatch-key") || req.headers.get("x-cron-key") || req.headers.get("x-api-key") || "";

  const session = await getServerSession(authConfig).catch(() => null);
  const hasValidDispatchKey = DISPATCH_KEY && timingSafeEqualToken(providedKey, DISPATCH_KEY);
  if (!hasValidDispatchKey) {
    const authz = assertAdmin(session);
    if (!authz.ok) {
      return errorJson(authz.message || "api.common.forbidden", authz.status || 403, locale);
    }
  }

  if (!WEBHOOK_URL && !dryRun) {
    return errorJson("api.admin.analytics.payment_alerts_not_configured", 503, locale);
  }

  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const counts = await resolvePaymentCounts(since);
    const pipeline = buildPaymentPipelineFromCounts(counts);
    const alerts = buildPaymentAlerts(pipeline);
    const criticalAlerts = alerts.filter(alert => alert?.severity === "critical");

    if (!criticalAlerts.length) {
      return json({
        ok: true,
        dispatched: false,
        reason: "no_critical_alerts",
        messageKey: "api.admin.analytics.payment_alerts_no_critical",
        criticalCount: 0
      });
    }

    const pendingAlerts = bypassDedupe ? criticalAlerts : await filterDedupedAlerts(criticalAlerts);
    if (!pendingAlerts.length) {
      return json({
        ok: true,
        dispatched: false,
        reason: "deduped",
        messageKey: "api.admin.analytics.payment_alerts_deduped",
        criticalCount: criticalAlerts.length
      });
    }

    const payload = {
      source: "sotsiaalai",
      kind: "payment_alerts",
      generatedAt: new Date().toISOString(),
      periodDays: 30,
      alerts: pendingAlerts,
      pipeline
    };

    if (dryRun) {
      await prisma.chatLog
        .create({
          data: {
            event: "payment_alert_dispatch_dry_run",
            role: "payment",
            data: {
              criticalCount: criticalAlerts.length,
              pendingCount: pendingAlerts.length,
              bypassDedupe
            }
          }
        })
        .catch(() => {});

      return json({
        ok: true,
        dispatched: false,
        dryRun: true,
        reason: "dry_run",
        messageKey: "api.admin.analytics.payment_alerts_dry_run",
        criticalCount: criticalAlerts.length,
        pendingCount: pendingAlerts.length,
        alerts: pendingAlerts,
        pipeline
      });
    }

    const payloadText = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = makeWebhookSignature(payloadText, timestamp);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, DISPATCH_TIMEOUT_MS));

    let response;
    try {
      response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(signature
            ? {
                "x-sotsiaalai-signature": `sha256=${signature}`,
                "x-sotsiaalai-timestamp": timestamp,
                "x-sotsiaalai-event": "payment_alerts"
              }
            : {})
        },
        body: payloadText,
        cache: "no-store",
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const responseBody = trimText(await response.text().catch(() => ""));
      await prisma.chatLog.create({
        data: {
          event: "payment_alert_dispatch_failed",
          role: "payment",
          data: {
            status: response.status,
            statusText: response.statusText,
            responseBody,
            alertCodes: pendingAlerts.map(a => a.code)
          }
        }
      });
      return errorJson("api.admin.analytics.payment_alerts_dispatch_failed", 502, locale, {
        statusCode: response.status
      });
    }

    await Promise.all(
      pendingAlerts.map(alert =>
        prisma.chatLog.create({
          data: {
            event: "payment_alert_dispatched",
            role: "payment",
            data: {
              code: alert.code,
              severity: alert.severity,
              value: alert.value,
              threshold: alert.threshold || null,
              target: trimText(WEBHOOK_URL, 120)
            }
          }
        })
      )
    );

    return json({
      ok: true,
      dispatched: true,
      messageKey: "api.admin.analytics.payment_alerts_dispatched",
      sentCount: pendingAlerts.length,
      criticalCount: criticalAlerts.length
    });
  } catch (error) {
    await prisma.chatLog
      .create({
        data: {
          event: "payment_alert_dispatch_failed",
          role: "payment",
          data: {
            error: String(error?.message || "dispatch_failed")
          }
        }
      })
      .catch(() => {});
    return errorJson("api.admin.analytics.payment_alerts_dispatch_failed", 502, locale);
  }
}
