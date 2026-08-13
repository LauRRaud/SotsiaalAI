export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { runEffectivePracticeReviewScheduler } from "@/lib/effectivePractices";
import { safeError } from "@/lib/privacy/safeError";

// P1-B: review-deadline + overdue-assignment scheduler. Same secret-gated job-route
// pattern as subscription-renewals (timing-safe key, ?dryRun, bounded batch). It
// produces durable, idempotent audit markers only — never candidate text or PII.

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};
const JOB_KEY = String(process.env.PRACTICE_REVIEW_JOB_KEY || "").trim();
const JOB_BATCH_SIZE = Math.max(1, Number(process.env.PRACTICE_REVIEW_BATCH_SIZE || 50));

function json(payload, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE_HEADERS });
}

function boolFlag(request, name) {
  const raw = String(new URL(request.url).searchParams.get(name) || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function positiveInt(request, name) {
  const raw = Number(new URL(request.url).searchParams.get(name));
  return Number.isInteger(raw) && raw >= 0 ? raw : null;
}

function isAuthorized(request) {
  if (!JOB_KEY) return false;
  const header =
    request.headers.get("x-practice-review-key") ||
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
  const dryRun = boolFlag(request, "dryRun");
  const overdueDays = positiveInt(request, "overdueDays");
  const dueWithinDays = positiveInt(request, "dueWithinDays");
  const reviewGraceDays = positiveInt(request, "reviewGraceDays");
  try {
    const result = await runEffectivePracticeReviewScheduler({
      now: new Date(),
      batchSize: JOB_BATCH_SIZE,
      dryRun,
      ...(overdueDays != null ? { overdueDays } : {}),
      ...(dueWithinDays != null ? { dueWithinDays } : {}),
      ...(reviewGraceDays != null ? { reviewGraceDays } : {})
    });
    return json({
      ok: true,
      dryRun,
      reviewsDue: result.reviewsDue,
      assignmentsOverdue: result.assignmentsOverdue,
      reviewTasksCreated: result.reviewTasksCreated,
      movedToReReview: result.movedToReReview,
      reviews: result.reviews,
      assignments: result.assignments
    });
  } catch (error) {
    console.error("[jobs/practice-reviews] scheduler failed", safeError(error));
    return json({ ok: false, message: "practice_review_scheduler_failed" }, 500);
  }
}
