import { BillingMethodStatus, PaymentKind, PaymentProvider, PaymentStatus } from "@/generated/prisma/client";
import {
  activateSubscriptionFromPayment,
  paidAtOrNow,
  upsertRecurringBillingMethod
} from "@/lib/payments/subscriptionActivation";
import { buildPaymentRawRecord } from "@/lib/payments/rawProjection";
import { logPaymentAudit, logPaymentEvent } from "@/lib/payments/observability";

// Reconciliation lahendamata maksetele (L-05, O-M2). Valib AINULT aegunud
// lahtised kirjed; aktiveerib AINULT verifitseeritud provideritulemusel;
// idempotentne (CAS lahtise seisu peal); vaikimisi mitteaktiivne (route-värav).
// Admin ei saa kunagi käsitsi "PAID"-i teha — ainult verifitseeritud provider.
//
// SOL-PAY-02: lahtiseid seise on nüüd kaks. `INITIATED` = checkout on avatud,
// kasutaja ei ole veel maksnud. `RECONCILE_PENDING` = kutse läks välja ja me EI
// TEA tulemust (timeout, 5xx, katkenud võrk või meie oma viga pärast
// providerikutset). Teine neist blokeerib kordusmakse valiku, seega tema
// lahendamine ei ole kosmeetika: ilma selleta jääks arveldus seisma.

const VERIFIED_TERMINALS = new Map([
  ["PAID", PaymentStatus.PAID],
  ["FAILED", PaymentStatus.FAILED],
  ["CANCELED", PaymentStatus.CANCELED],
  ["REFUNDED", PaymentStatus.REFUNDED]
]);

const UNRESOLVED_STATUSES = [PaymentStatus.INITIATED, PaymentStatus.RECONCILE_PENDING];

export function getUnresolvedPaymentWhere(now = new Date(), stuckAfterMs = 30 * 60 * 1000) {
  return {
    status: { in: UNRESOLVED_STATUSES },
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
    if (!current || !UNRESOLVED_STATUSES.includes(current.status)) return "already_resolved";

    const baseRaw = { ...(current.raw && typeof current.raw === "object" && !Array.isArray(current.raw) ? current.raw : {}), source: "maksekeskus_reconcile" };

    if (nextStatus === PaymentStatus.PAID) {
      /* L-05 tuum: kutsemakse PAID vajab webhook'i täisvoogu (toortoken sünnib
         seal) → jäta ja auditeeri.

         SOL-PAY-02: kordusmakse EI ole enam selles nimekirjas. Lahendamata
         kordusmakse hoiab tellimust valikust väljas, seega „ootame webhook'i"
         tähendaks siin peatunud arveldust juhul, kui webhook üldse ei tule.
         Verifitseeritud PAID on sama autoriteetne allikas mõlemal juhul. */
      const canActivateHere =
        (current.kind === PaymentKind.SUBSCRIPTION_INITIAL ||
          current.kind === PaymentKind.SUBSCRIPTION_RENEWAL) &&
        Boolean(current.subscriptionId);
      if (!canActivateHere) {
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
        select: { id: true, subscriptionId: true, billingMethodId: true, paidAt: true }
      });
      if (current.kind === PaymentKind.SUBSCRIPTION_INITIAL) {
        const billingMethod = await upsertRecurringBillingMethod(tx, { ...updated, id: paymentId }, payload, paidAt);
        if (billingMethod?.id) {
          await tx.payment.update({ where: { id: paymentId }, data: { billingMethodId: billingMethod.id } });
          await tx.subscription.update({
            where: { id: updated.subscriptionId },
            data: { billingMethodId: billingMethod.id }
          });
        }
      } else if (updated.billingMethodId) {
        // Kordusmakse: mandaat on juba olemas, kinnitatud laadimine teeb ta
        // kasutatavaks (sama, mida webhook'i kordusmakse-haru teeb).
        await tx.billingMethod.update({
          where: { id: updated.billingMethodId },
          data: { status: BillingMethodStatus.ACTIVE, lastUsedAt: paidAt }
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
 * @param {number} options.stuckAfterMs - ainult vanemad lahtised kirjed kui see
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
    where: getUnresolvedPaymentWhere(now, stuckAfterMs),
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(Number(batchSize) || 25, 200)),
    select: {
      id: true,
      providerPaymentId: true,
      subscriptionId: true,
      inviteId: true,
      kind: true,
      status: true,
      createdAt: true
    }
  });

  const results = {
    scanned: stuck.length,
    // SOL-PAY-02: eraldi näht, sest just need read hoiavad kordusmakset kinni.
    reconcilePending: stuck.filter(row => row.status === PaymentStatus.RECONCILE_PENDING).length,
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
