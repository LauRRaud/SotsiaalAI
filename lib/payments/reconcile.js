import { PaymentKind, PaymentProvider, PaymentStatus } from "@/generated/prisma/client";
import {
  activateSubscriptionFromPayment,
  paidAtOrNow,
  upsertRecurringBillingMethod
} from "@/lib/payments/subscriptionActivation";
import { buildPaymentRawRecord } from "@/lib/payments/rawProjection";
import { logPaymentAudit, logPaymentEvent } from "@/lib/payments/observability";

// Reconciliation stuck-INITIATED maksetele (L-05, O-M2). Valib AINULT aegunud
// INITIATED kirjed; aktiveerib AINULT verifitseeritud provideritulemusel;
// idempotentne (CAS status=INITIATED); vaikimisi mitteaktiivne (route-värav).
// Admin ei saa kunagi käsitsi "PAID"-i teha — ainult verifitseeritud provider.

const VERIFIED_TERMINALS = new Map([
  ["PAID", PaymentStatus.PAID],
  ["FAILED", PaymentStatus.FAILED],
  ["CANCELED", PaymentStatus.CANCELED],
  ["REFUNDED", PaymentStatus.REFUNDED]
]);

export function getStuckInitiatedWhere(now = new Date(), stuckAfterMs = 30 * 60 * 1000) {
  return {
    status: PaymentStatus.INITIATED,
    provider: PaymentProvider.MAKSEKESKUS,
    createdAt: { lt: new Date(now.getTime() - Math.max(0, stuckAfterMs)) }
  };
}

async function applyReconciledStatus({ db, paymentId, verifiedStatus, payload, now }) {
  const nextStatus = VERIFIED_TERMINALS.get(String(verifiedStatus || "").toUpperCase());
  if (!nextStatus) return "pending";

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "Payment" WHERE "id" = ${paymentId} FOR UPDATE`;
    const current = await tx.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, status: true, subscriptionId: true, inviteId: true, kind: true, raw: true, paidAt: true }
    });
    // Idempotentne: kui vahepeal (nt webhook) juba lahendatud, ära tee midagi.
    if (!current || current.status !== PaymentStatus.INITIATED) return "already_resolved";

    const baseRaw = { ...(current.raw && typeof current.raw === "object" && !Array.isArray(current.raw) ? current.raw : {}), source: "maksekeskus_reconcile" };

    if (nextStatus === PaymentStatus.PAID) {
      // L-05 tuum: ainult esmatellimus aktiveeritakse siin (turvaline, autoriteetne).
      // Kutse- ja uuendusmakse PAID vajab webhook'i täisvoogu → jäta ja auditeeri.
      if (current.kind !== PaymentKind.SUBSCRIPTION_INITIAL || !current.subscriptionId) {
        logPaymentAudit({ action: "reconcile_paid_needs_webhook", result: "skipped", paymentId, inviteId: current.inviteId, subscriptionId: current.subscriptionId });
        return "needs_webhook";
      }
      const paidAt = paidAtOrNow(payload?.paidAt || payload?.paid_at || now);
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.PAID,
          paidAt,
          raw: buildPaymentRawRecord(baseRaw, payload)
        },
        select: { id: true, subscriptionId: true, paidAt: true }
      });
      const billingMethod = await upsertRecurringBillingMethod(tx, { ...updated, id: paymentId }, payload, paidAt);
      if (billingMethod?.id) {
        await tx.payment.update({ where: { id: paymentId }, data: { billingMethodId: billingMethod.id } });
        await tx.subscription.update({
          where: { id: updated.subscriptionId },
          data: { billingMethodId: billingMethod.id }
        });
      }
      await activateSubscriptionFromPayment(tx, { ...updated, id: paymentId });
      logPaymentAudit({ action: "reconcile_activate", result: "paid", paymentId, subscriptionId: updated.subscriptionId });
      return "activated";
    }

    // FAILED / CANCELED / REFUNDED: märgi makse terminaliks; kutse revoke'itakse.
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: nextStatus,
        ...(nextStatus === PaymentStatus.FAILED || nextStatus === PaymentStatus.CANCELED ? { failedAt: now } : {}),
        ...(nextStatus === PaymentStatus.REFUNDED ? { refundedAt: now } : {}),
        raw: buildPaymentRawRecord(baseRaw, payload)
      }
    });
    if (current.inviteId) {
      await tx.invite.updateMany({
        where: { id: current.inviteId, status: { in: ["PENDING_PAYMENT", "SENT"] } },
        data: { status: "REVOKED" }
      });
    }
    logPaymentAudit({ action: "reconcile_terminal", result: String(nextStatus).toLowerCase(), paymentId, inviteId: current.inviteId, subscriptionId: current.subscriptionId });
    return nextStatus === PaymentStatus.FAILED ? "failed" : nextStatus === PaymentStatus.CANCELED ? "canceled" : "refunded";
  });
}

/**
 * @param {object} options
 * @param {*} options.db - Prisma client / tx
 * @param {Date} options.now
 * @param {number} options.stuckAfterMs - ainult vanemad INITIATED kui see
 * @param {number} options.batchSize
 * @param {(payment: object) => Promise<{status: string, payload?: object}|null>} [options.queryProviderStatus]
 *   Verifitseeritud provideri seisu päring. PUUDUB vaikimisi → ainult-raport (ei aktiveeri).
 * @param {boolean} [options.dryRun]
 */
export async function reconcileStuckPayments({
  db,
  now = new Date(),
  stuckAfterMs = 30 * 60 * 1000,
  batchSize = 25,
  queryProviderStatus = null,
  dryRun = false
} = {}) {
  const stuck = await db.payment.findMany({
    where: getStuckInitiatedWhere(now, stuckAfterMs),
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(Number(batchSize) || 25, 200)),
    select: {
      id: true,
      providerPaymentId: true,
      subscriptionId: true,
      inviteId: true,
      kind: true,
      createdAt: true
    }
  });

  const results = {
    scanned: stuck.length,
    activated: 0,
    failed: 0,
    canceled: 0,
    refunded: 0,
    pending: 0,
    needs_webhook: 0,
    already_resolved: 0,
    errors: 0,
    providerQueried: Boolean(queryProviderStatus) && !dryRun
  };

  // Vaikimisi mitteaktiivne provideri suhtes: ilma queryProviderStatus'eta või
  // dryRun'is EI aktiveerita midagi — ainult raporteeritakse stuck-loend.
  if (dryRun || !queryProviderStatus) {
    results.pending = stuck.length;
    return results;
  }

  for (const payment of stuck) {
    try {
      const verified = await queryProviderStatus(payment);
      const status = verified?.status ? String(verified.status).toUpperCase() : null;
      if (!status || status === "PENDING" || status === "INITIATED") {
        results.pending += 1;
        continue;
      }
      const outcome = await applyReconciledStatus({
        db,
        paymentId: payment.id,
        verifiedStatus: status,
        payload: verified?.payload || {},
        now
      });
      results[outcome] = (results[outcome] || 0) + 1;
    } catch (error) {
      results.errors += 1;
      logPaymentEvent("subscription_reconcile_error", { paymentId: payment.id, error });
    }
  }

  return results;
}
