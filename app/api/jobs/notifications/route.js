export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { runNotificationDelivery } from "@/lib/notificationDelivery";
import { reconcileNotificationEvents } from "@/lib/notificationReconciler";
import { projectDomainEvents } from "@/lib/events/projector";
import { runMentoringSweep } from "@/lib/mentoring/sweep";
import { runSupervisionSweep } from "@/lib/supervision/sweep";
import { expireCovisionInvitations, runCovisionInviteDelivery } from "@/lib/covisionInviteDelivery";
import { repairEffectivePracticeAssignments } from "@/lib/effectivePractices";
import { runEffectivePracticeRagRecovery } from "@/lib/effectivePracticeRagRecovery";
import { runFieldSafetySweep } from "@/lib/field/safety";
import { runUrgentExpirySweep } from "@/lib/urgent/sweep";
import { endExpiredNetworkShares } from "@/lib/network/shareExpiry";
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

/**
 * SOL-NOTIF-06 — OHUTUSKRIITILINE TÖÖ EI TOHI SÕLTUDA TEISE TÖÖ TERVISEST.
 *
 * Kõik etapid olid ÜHES `try` plokis järjestikuste `await`-idena ja välitöö
 * dead-man kontroll ning kiire abi aegumine olid viimased. Ükskõik millise
 * varasema etapi viga hüppas ühisesse `catch`-i ja need kaks jäid käivitamata:
 * tavalise teavituse või SMTP infrastruktuuri rike blokeeris check-in
 * eskalatsiooni ja abipalve nähtava lõpetamise.
 *
 * Iga etapp jookseb nüüd oma veapiiri sees ja tema seis on vastuses nähtav.
 * Ohutusetapid ei ole enam „viimased, kui jõuame" — nad on eraldi ja nad
 * käivituvad ALATI.
 */
async function runStage(name, statuses, work) {
  try {
    const value = await work();
    statuses[name] = { ok: true };
    return value;
  } catch (error) {
    statuses[name] = { ok: false, code: String(error?.code || error?.name || "STAGE_FAILED").slice(0, 80) };
    console.error(`[jobs/notifications] stage failed: ${name}`, safeError(error));
    return null;
  }
}

export async function POST(request) {
  if (!authorized(request)) return json({ ok: false, message: "unauthorized" }, 401);
  const url = new URL(request.url);
  const dryRun = ["1", "true", "yes"].includes(String(url.searchParams.get("dryRun") || "").toLowerCase());
  const batchSize = Math.max(1, Math.min(Number(process.env.NOTIFICATION_JOB_BATCH_SIZE) || 40, 100));

  const stages = {};
  const reconciled = { considered: 0, created: 0, existing: 0, skipped: 0 };
  const delivery = {
    eligible: 0, claimed: 0, sent: 0, retried: 0, failed: 0,
    skippedPreference: 0, skippedRecipient: 0, skippedSender: 0, ambiguous: 0
  };
  const projected = { considered: 0, created: 0, existing: 0, failed: 0, zeroRecipients: 0 };
  let reconcileCursor = null;
  let projectorCursor = null;
  let deliveryCursor = null;
  let reconcilePages = 0;
  let projectorPages = 0;
  let deliveryPages = 0;

  const mentoring = await runStage("mentoring", stages, () => runMentoringSweep({ dryRun, batchSize }));
  const supervision = await runStage("supervision", stages, () => runSupervisionSweep({ dryRun, batchSize }));
  const covisionExpiry = await runStage("covisionExpiry", stages, () => expireCovisionInvitations({ dryRun }));
  const covisionInvites = await runStage("covisionInvites", stages, () => runCovisionInviteDelivery({ dryRun, batchSize }));
  const practiceAssignments = await runStage("practiceAssignments", stages, () => (
    repairEffectivePracticeAssignments({ userId: "system", role: "SYSTEM" }, { dryRun, batchSize })
  ));
  const practiceRagRecovery = await runStage("practiceRagRecovery", stages, () => (
    runEffectivePracticeRagRecovery({ dryRun, batchSize })
  ));
  if (practiceRagRecovery?.alarm === true && stages.practiceRagRecovery?.ok === true) {
    console.error("[jobs/notifications] practice RAG recovery alarm", {
      failed: Number(practiceRagRecovery.failed || 0),
      deadLetter: Number(practiceRagRecovery.deadLetter || 0),
      remaining: Number(practiceRagRecovery.remaining || 0)
    });
    stages.practiceRagRecovery = { ok: false, code: "PRACTICE_RAG_RECOVERY_ALARM" };
  }

  /* Iga silmus on oma eelarve: ühe etapi 100 lehekülge ei söö ära teise oma ja
     tema viga ei võta teistelt käivitust. */
  await runStage("reconcile", stages, async () => {
    for (; reconcilePages < 100; reconcilePages += 1) {
      const page = await reconcileNotificationEvents({ dryRun, batchSize, cursor: reconcileCursor });
      for (const key of Object.keys(reconciled)) reconciled[key] += Number(page[key] || 0);
      reconcileCursor = page.nextCursor || null;
      if (!reconcileCursor) break;
    }
  });

  await runStage("projector", stages, async () => {
    for (; projectorPages < 100; projectorPages += 1) {
      const page = await projectDomainEvents({ dryRun, batchSize, cursor: projectorCursor });
      for (const key of Object.keys(projected)) projected[key] += Number(page[key] || 0);
      projectorCursor = page.nextCursor || null;
      if (!projectorCursor) break;
    }
  });

  await runStage("delivery", stages, async () => {
    for (; deliveryPages < 100; deliveryPages += 1) {
      const page = await runNotificationDelivery({ dryRun, batchSize, cursor: deliveryCursor });
      for (const key of Object.keys(delivery)) delivery[key] += Number(page[key] || 0);
      deliveryCursor = page.nextCursor || null;
      if (!deliveryCursor) break;
    }
  });

  /* FIELD-V1 dead-man kontroll ja SK-V1 E5 kiire abi aegumine sõidavad sama
     taimeriga, aga nad EI sõltu enam ülalolevate etappide tervisest. Vaikus on
     halvim võimalik tulemus inimesele, kes kirjutas kell 23:47. */
  const fieldSafety = await runStage("fieldSafety", stages, () => runFieldSafetySweep({ dryRun, batchSize }));
  const urgentExpiry = await runStage("urgentExpiry", stages, () => runUrgentExpirySweep({ dryRun, batchSize }));
  const networkShares = await runStage("networkShares", stages, () => endExpiredNetworkShares({
    dryRun,
    batchSize
  }));

  const truncated = Boolean(reconcileCursor || projectorCursor || deliveryCursor);
  projected.truncated = Boolean(projectorCursor);
  if (truncated) console.error("[jobs/notifications] processing truncated", {
    reconcile: Boolean(reconcileCursor), projector: Boolean(projectorCursor), delivery: Boolean(deliveryCursor)
  });

  const failedStages = Object.entries(stages).filter(([, value]) => !value.ok).map(([name]) => name);
  const safetyOk = stages.fieldSafety?.ok === true && stages.urgentExpiry?.ok === true;

  return json({
    // Ohutusetapid on eraldi väljas: „ok" ei tohi peita seda, et üks etapp kukkus.
    ok: failedStages.length === 0,
    safetyOk,
    stages,
    failedStages,
    dryRun,
    reconcilePages: Math.min(reconcilePages + 1, 100),
    projectorPages: Math.min(projectorPages + 1, 100),
    deliveryPages: Math.min(deliveryPages + 1, 100),
    truncated,
    reconciled,
    projected,
    mentoring,
    supervision,
    covisionExpiry,
    covisionInvites,
    practiceAssignments,
    practiceRagRecovery,
    delivery,
    fieldSafety,
    urgentExpiry,
    networkShares
  }, failedStages.length === 0 ? 200 : 207);
}
