export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reapExpiredReservations } from "@/lib/usage/reservationReaper";

// Usage reservation-reaper worker (PERF-P0). Repo-managed, DEFAULT INACTIVE.
// Runs only with a valid job key AND USAGE_REAPER_ENABLED. Reports expired
// RESERVED reservations, but never settles them: expiry alone cannot distinguish
// an abandoned hold from a provider request that is still running.

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

const JOB_KEY = String(process.env.USAGE_REAPER_JOB_KEY || "").trim();

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
    request.headers.get("x-usage-reaper-key") ||
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
  if (!isTruthy(process.env.USAGE_REAPER_ENABLED)) {
    return json({ ok: false, message: "usage reaper disabled" }, 503);
  }

  const graceMinutes = Math.max(1, Number(process.env.USAGE_REAPER_GRACE_MINUTES || 5));
  const batchSize = Math.max(1, Number(process.env.USAGE_REAPER_BATCH_SIZE || 100));
  const dryRun = isDryRun(request);

  // Dry run: report how many rows WOULD be reaped without releasing anything.
  if (dryRun) {
    const { getExpiredReservationWhere } = await import("@/lib/usage/reservationReaper");
    const wouldReap = await prisma.usageReservation.count({
      where: getExpiredReservationWhere(new Date(), graceMinutes * 60 * 1000)
    });
    return json({ ok: true, dryRun: true, wouldReap });
  }

  const results = await reapExpiredReservations({
    db: prisma,
    graceMs: graceMinutes * 60 * 1000,
    batchSize
  });

  console.log("[usage-reservation-reaper]", JSON.stringify(results));
  return json({ ok: true, dryRun: false, ...results });
}
