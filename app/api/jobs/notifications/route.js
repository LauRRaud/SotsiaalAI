export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { runNotificationDelivery } from "@/lib/notificationDelivery";
import { reconcileNotificationEvents } from "@/lib/notificationReconciler";
import { projectDomainEvents } from "@/lib/events/projector";
import { runMentoringSweep } from "@/lib/mentoring/sweep";
import { safeError } from "@/lib/privacy/safeError";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

function json(payload, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE });
}

function authorized(request) {
  const key = String(process.env.NOTIFICATION_JOB_KEY || "").trim();
  if (!key) return false;
  const raw = request.headers.get("x-notification-job-key") || request.headers.get("x-cron-key") || "";
  const provided = Buffer.from(String(raw).trim());
  const expected = Buffer.from(key);
  if (provided.length !== expected.length) return false;
  try { return crypto.timingSafeEqual(provided, expected); } catch { return false; }
}

export async function POST(request) {
  if (!authorized(request)) return json({ ok: false, message: "unauthorized" }, 401);
  const url = new URL(request.url);
  const dryRun = ["1", "true", "yes"].includes(String(url.searchParams.get("dryRun") || "").toLowerCase());
  const batchSize = Math.max(1, Math.min(Number(process.env.NOTIFICATION_JOB_BATCH_SIZE) || 40, 100));
  try {
    const reconciled = { considered: 0, created: 0, existing: 0, skipped: 0 };
    const delivery = {
      eligible: 0, claimed: 0, sent: 0, retried: 0, failed: 0,
      skippedPreference: 0, skippedRecipient: 0, ambiguous: 0
    };
    const projected = {
      considered: 0, created: 0, existing: 0, failed: 0, zeroRecipients: 0
    };
    const mentoring = await runMentoringSweep({ dryRun, batchSize });
    let reconcileCursor = null;
    let projectorCursor = null;
    let deliveryCursor = null;
    let reconcilePages = 0;
    let projectorPages = 0;
    let deliveryPages = 0;
    for (; reconcilePages < 100; reconcilePages += 1) {
      const reconcilePage = await reconcileNotificationEvents({ dryRun, batchSize, cursor: reconcileCursor });
      for (const key of Object.keys(reconciled)) reconciled[key] += Number(reconcilePage[key] || 0);
      reconcileCursor = reconcilePage.nextCursor || null;
      if (!reconcileCursor) break;
    }
    for (; projectorPages < 100; projectorPages += 1) {
      const projectorPage = await projectDomainEvents({ dryRun, batchSize, cursor: projectorCursor });
      for (const key of Object.keys(projected)) projected[key] += Number(projectorPage[key] || 0);
      projectorCursor = projectorPage.nextCursor || null;
      if (!projectorCursor) break;
    }
    for (; deliveryPages < 100; deliveryPages += 1) {
      const deliveryPage = await runNotificationDelivery({ dryRun, batchSize, cursor: deliveryCursor });
      for (const key of Object.keys(delivery)) delivery[key] += Number(deliveryPage[key] || 0);
      deliveryCursor = deliveryPage.nextCursor || null;
      if (!deliveryCursor) break;
    }
    const truncated = Boolean(reconcileCursor || projectorCursor || deliveryCursor);
    projected.truncated = Boolean(projectorCursor);
    if (truncated) console.error("[jobs/notifications] processing truncated", {
      reconcile: Boolean(reconcileCursor), projector: Boolean(projectorCursor), delivery: Boolean(deliveryCursor)
    });
    return json({
      ok: true,
      dryRun,
      reconcilePages: Math.min(reconcilePages + 1, 100),
      projectorPages: Math.min(projectorPages + 1, 100),
      deliveryPages: Math.min(deliveryPages + 1, 100),
      truncated,
      reconciled,
      projected,
      mentoring,
      delivery
    });
  } catch (error) {
    console.error("[jobs/notifications] failed", safeError(error));
    return json({ ok: false, message: "notification_job_failed" }, 500);
  }
}
