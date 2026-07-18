export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runPaymentEmailDelivery } from "@/lib/payments/emailOutbox";

// Makse-/kutse e-kirjade outbox-worker (T09 E6). Repo-hallatav, VAIKIMISI
// MITTEAKTIIVNE. Käivitub ainult kehtiva job-võtme + PAYMENT_EMAIL_WORKER_ENABLED
// korral. Kordus saadab ainult e-kirja uuesti; makset ega õigust ei korda.

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

const JOB_KEY = String(process.env.PAYMENT_EMAIL_JOB_KEY || "").trim();

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
    request.headers.get("x-payment-email-key") ||
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
  if (!isTruthy(process.env.PAYMENT_EMAIL_WORKER_ENABLED)) {
    return json({ ok: false, message: "payment email worker disabled" }, 503);
  }

  const dryRun = isDryRun(request);
  const batchSize = Math.max(1, Number(process.env.PAYMENT_EMAIL_BATCH_SIZE || 40));
  const result = await runPaymentEmailDelivery({ db: prisma, dryRun, batchSize });

  return json({ ok: true, dryRun, ...result });
}
