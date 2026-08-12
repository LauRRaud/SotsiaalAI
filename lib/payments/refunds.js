import { PaymentStatus } from "@/generated/prisma/client";
import { canonicalMoney } from "@/lib/payments/paymentVerification";

/**
 * SOL-PAY-06 — OSALINE TAGASTUS EI OLE TÄISTAGASTUS.
 *
 * MIS OLI VALESTI. Provideri `PART_REFUNDED` mapiti samasse `PaymentStatus.REFUNDED`
 * väärtusse nagu täielik tagastus, ja `REFUNDED` vaiketegevus on `cancel`. Seega
 * 0,01 € korrigeerimine lõpetas tellimuse kohe (`validUntil = now`), nullis
 * järgmise makse, revoke'is korduvmakse mandaadi ja sponsorkutse puhul võttis ära
 * ka juba antud tellimuse ning ruumiliikmesuse. Kasutaja kaotas kogu makstud
 * ligipääsu, kuigi suurem osa maksest jäi jõusse.
 *
 * MIS SIIN ON. Kaks eri seisu ja üks mehaaniline reegel:
 *
 *   **õigus lõpeb siis, kui makse on TÄIELIKULT tagastatud** — mitte siis, kui
 *   tagastati midagi.
 *
 * See ei ole tooteotsus, vaid raamatupidamise oma: kui tagastatud summa katab
 * kogu makse, siis makset enam ei ole. Osalise tagastuse MÕJU õigusele (kas
 * pool kuud, kas hinnavahe krediidina) ON tooteotsus ja teda ei ole siin
 * leiutatud — osaline tagastus jääb kirja, jääb nähtavaks ja EI vähenda
 * ligipääsu.
 *
 * TAGASTATUD SUMMA EI VÄHENE. Provideri sõnumid võivad korduda ja me ei tea, kas
 * summa on kumulatiivne või ühe tagastuse oma; maksimumi võtmine on ainus
 * tehe, mis on korduse suhtes ohutu MÕLEMA tõlgenduse korral.
 */

const REFUND_STATUSES = Object.freeze([PaymentStatus.REFUNDED, PaymentStatus.PART_REFUNDED]);

export function isRefundStatus(status) {
  return REFUND_STATUSES.includes(status);
}

function pickScalar(...candidates) {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;
    if (typeof candidate === "object") continue;
    const text = String(candidate).trim();
    if (text) return text;
  }
  return "";
}

/**
 * Tagastatud summa provideri payload'ist. Toetatud on nii otsene väli kui
 * `refunds[]` loend (summeeritakse). Tundmatu kuju → `null` (= me ei tea), mitte
 * `0` (= tagastati null) — see vahe otsustab, kas rida läheb täisrajale.
 */
export function extractRefundedAmount(payload = {}) {
  const direct = pickScalar(
    payload?.refunded_amount,
    payload?.refundedAmount,
    payload?.refund_amount,
    payload?.refundAmount,
    payload?.refund?.amount,
    payload?.transaction?.refunded_amount,
    payload?.transaction?.refundedAmount
  );
  if (direct) return canonicalMoney(direct);

  const refunds = Array.isArray(payload?.refunds)
    ? payload.refunds
    : Array.isArray(payload?.transaction?.refunds)
      ? payload.transaction.refunds
      : null;
  if (!refunds || refunds.length === 0) return null;

  let total = 0;
  let seen = 0;
  for (const entry of refunds) {
    const amount = canonicalMoney(pickScalar(entry?.amount, entry?.refunded_amount, entry?.sum));
    if (amount === null) continue;
    total += Number(amount);
    seen += 1;
  }
  if (!seen) return null;
  return canonicalMoney(total.toFixed(2));
}

/** Suurem kahest kanoonilisest summast; `null` tähendab „ei tea". */
export function maxRefundedAmount(a, b) {
  const left = canonicalMoney(a);
  const right = canonicalMoney(b);
  if (left === null) return right;
  if (right === null) return left;
  return Number(left) >= Number(right) ? left : right;
}

/**
 * Mis sellest tagastusest saab?
 *
 * @param {object} options
 * @param {{amount: *, refundedAmount: *}} options.payment - kohalik rida
 * @param {object} options.payload - provideri payload
 * @param {string} options.incomingStatus - `REFUNDED` või `PART_REFUNDED`
 * @returns {{status: string, refundedAmount: string|null, full: boolean, reason: string}}
 */
export function resolveRefundOutcome({ payment, payload = {}, incomingStatus } = {}) {
  const paid = canonicalMoney(payment?.amount);
  const refundedNow = extractRefundedAmount(payload);
  const refundedTotal = maxRefundedAmount(payment?.refundedAmount, refundedNow);

  /* Provideri `REFUNDED` on täistagastus ka ilma summata — tema oma seis on
     autoriteetsem kui meie tuletus. */
  if (incomingStatus === PaymentStatus.REFUNDED) {
    return {
      status: PaymentStatus.REFUNDED,
      refundedAmount: refundedTotal || paid,
      full: true,
      reason: "provider_full_refund"
    };
  }

  const coversWholePayment =
    paid !== null && refundedTotal !== null && Number(refundedTotal) >= Number(paid);

  if (coversWholePayment) {
    return {
      status: PaymentStatus.REFUNDED,
      refundedAmount: refundedTotal,
      full: true,
      reason: "refunds_cover_payment"
    };
  }

  return {
    status: PaymentStatus.PART_REFUNDED,
    refundedAmount: refundedTotal,
    full: false,
    reason: refundedTotal === null ? "partial_amount_unknown" : "partial"
  };
}
