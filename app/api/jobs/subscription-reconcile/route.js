export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchMaksekeskusTransactionStatusByReference } from "@/lib/payments/maksekeskus";
import { logPaymentEvent } from "@/lib/payments/observability";
import { reconcileStuckPayments } from "@/lib/payments/reconcile";

// Reconciliation-worker (L-05, O-M2). Repo-hallatav, VAIKIMISI MITTEAKTIIVNE üksus.
// Käivitub ainult: (1) kehtiva job-võtmega, (2) SUBSCRIPTION_RECONCILE_ENABLED
// seatuna. Provideri päring toimub ainult SUBSCRIPTION_RECONCILE_QUERY_PROVIDER
// operaatori-loaga; muidu ainult-raport. Admin ei saa käsitsi "PAID"-i teha.

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

const JOB_KEY = String(process.env.SUBSCRIPTION_RECONCILE_JOB_KEY || "").trim();

function isTruthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

function json(payload, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE_HEADERS });
}

function isDryRun(request) {
  const raw = String(new URL(request.url).searchParams.get("dryRun") || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function isAuthorized(request) {
  if (!JOB_KEY) return false;
  const header =
    request.headers.get("x-subscription-reconcile-key") ||
    request.headers.get("x-cron-key") ||
    request.headers.get("x-api-key") ||
    "";
  const provided = Buffer.from(String(header).trim());
  const expected = Buffer.from(JOB_KEY);
  if (provided.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(provided, expected);
  } catch {
    return false;
  }
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return json({ ok: false, message: "unauthorized" }, 401);
  }
  if (!isTruthy(process.env.SUBSCRIPTION_RECONCILE_ENABLED)) {
    return json({ ok: false, message: "reconcile disabled" }, 503);
  }

  const dryRun = isDryRun(request);
  const stuckMinutes = Math.max(5, Number(process.env.PAYMENT_RECONCILE_STUCK_MINUTES || 30));
  const batchSize = Math.max(1, Number(process.env.SUBSCRIPTION_RECONCILE_BATCH_SIZE || 25));
  const queryProvider = isTruthy(process.env.SUBSCRIPTION_RECONCILE_QUERY_PROVIDER);

  const queryProviderStatus =
    queryProvider && !dryRun
      ? async (payment) => fetchMaksekeskusTransactionStatusByReference(payment.providerPaymentId)
      : null;

  const results = await reconcileStuckPayments({
    db: prisma,
    stuckAfterMs: stuckMinutes * 60 * 1000,
    batchSize,
    queryProviderStatus,
    dryRun
  });

  logPaymentEvent("subscription_reconcile_run", {
    dryRun,
    providerQueried: results.providerQueried,
    scanned: results.scanned,
    activated: results.activated,
    failed: results.failed,
    canceled: results.canceled,
    refunded: results.refunded,
    pending: results.pending
  });

  return json({ ok: true, dryRun, ...results });
}
