import { PaymentStatus } from "@/generated/prisma/client";

/**
 * SOL-PAY-03 — ÜKS KAVATSUS = ÜKS TASUTAV CHECKOUT.
 *
 * MIS OLI VALESTI. Init kontrollis ainult, kas viimane tellimus on juba aktiivne,
 * ja lõi seejärel IGA päringu peale uue juhusliku `providerPaymentId`-ga makse ja
 * uue provideritransaktsiooni. Kliendi idempotentsusvõtit ei olnud ja skeemi
 * unikaalsus kehtis alles juba erinevate provider-viidete suhtes, seega kaks
 * paralleelset päringut ei põrganud kokku kuskil. Topeltklõps, kaks vahekaarti
 * või võrgu-retry võis avada kaks kehtivat recurring-checkout'i; mõlema tasumisel
 * pikendas kumbki webhook sama tellimust veel kuu võrra ja võis salvestada teise
 * mandaadi. Kasutaja kavatsus oli üks kuu ja üks mandaat.
 *
 * MIS SIIN ON. Kaks kihti, sest kumbki üksinda ei kata:
 *
 *   · **Kliendi võti** (`Payment.clientIntentKey`, unikaalne kasutaja kohta) —
 *     sama kavatsuse kordus tagastab SAMA checkout'i, mitte uue.
 *   · **Avatud katse claim kasutaja kohta** — nõuandelukk serialiseerib otsuse ja
 *     lukustatud otsus vaatab, kas kasutajal on juba avatud tasutav katse. Ainult
 *     võti üksi ei aitaks: kaks vahekaarti genereerivad kaks ERI võtit.
 *
 * Avatud katse taaskasutatakse (mitte ei keelata), kui ta on sama summa, valuuta
 * ja tellimuse peale — see on kasutajale ainus rada, mis ei tekita ummikteed ja
 * hoiab tasutavate checkout'ide arvu ühe peal. Erineva summa/paketi korral on
 * vastus aus konflikt, mitte vaikne vale summa.
 *
 * NB `pg_advisory_xact_lock` AINULT `$executeRaw` kaudu — `$queryRaw` kukub
 * `void`-tüübi deserialiseerimisel (vt lib/auth/verificationLinkDispatch.js).
 */

export const CHECKOUT_INTENT_LOCK_NAMESPACE = 4715;
export const CHECKOUT_INTENT_KEY_MAX_LENGTH = 128;

/** Kui kaua loetakse avatud `INITIATED` katset veel tasutavaks. */
export function getOpenCheckoutTtlMs() {
  const minutes = Number(process.env.SUBSCRIPTION_CHECKOUT_OPEN_MINUTES || 30);
  const safe = Number.isFinite(minutes) && minutes > 0 ? minutes : 30;
  return safe * 60 * 1000;
}

/**
 * Kui kaua on „makse rida on olemas, checkout'i veel ei ole" usutav pooleliolek.
 * Providerikutse enda ajapiir on 15 s, seega kaks minutit on lai varu. Ilma selle
 * piirita hoiaks surnud päring (protsessi surm keset kutset) kasutajat ummikus
 * kogu avatud katse akna — rida, millest ei saanud KUNAGI tasutavat checkout'i,
 * ei tohi blokeerida.
 */
export function getInFlightCheckoutMs() {
  const seconds = Number(process.env.SUBSCRIPTION_CHECKOUT_INFLIGHT_SECONDS || 120);
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 120;
  return safe * 1000;
}

/**
 * Võti tuleb kliendilt, seega ta on sisend nagu iga teine: kuju on piiratud ja
 * kõlbmatu võti ei muutu vaikselt „võtmeta" päringuks (see oli vana idempotentsuse
 * viga — puuduv võti tähendas „tee uus tasuline asi").
 */
export function normalizeClientIntentKey(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw.length > CHECKOUT_INTENT_KEY_MAX_LENGTH) return "";
  if (!/^[A-Za-z0-9._:-]+$/.test(raw)) return "";
  return raw;
}

function asPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/** Kas sellel real on kliendile tagastatav checkout olemas? */
export function getStoredCheckoutTransactionId(payment) {
  const raw = asPlainObject(payment?.raw);
  const direct = String(raw?.transactionId || "").trim();
  if (direct) return direct;
  const nested = asPlainObject(raw?.checkout);
  return String(nested?.transactionId || nested?.id || "").trim();
}

function sameMoney(payment, expected) {
  if (!expected) return true;
  const amountMatches = String(payment?.amount ?? "") === String(expected.amount ?? "");
  const currencyMatches =
    String(payment?.currency || "").toUpperCase() === String(expected.currency || "").toUpperCase();
  const kindMatches = !expected.kind || payment?.kind === expected.kind;
  return amountMatches && currencyMatches && kindMatches;
}

const OPEN_ATTEMPT_SELECT = {
  id: true,
  status: true,
  kind: true,
  amount: true,
  currency: true,
  clientIntentKey: true,
  providerPaymentId: true,
  subscriptionId: true,
  createdAt: true,
  raw: true
};

/**
 * Lukustatud claim. `createAttempt(tx)` kutsutakse AINULT siis, kui ükski
 * olemasolev katse ei kata seda kavatsust — ja ta jookseb samas tehingus, seega
 * kaks paralleelset päringut ei saa mõlemad luua.
 *
 * @param {object} options
 * @param {*} options.db - Prisma klient
 * @param {string} options.userId
 * @param {string} options.clientIntentKey - juba normaliseeritud
 * @param {{amount: string, currency: string, kind?: string}} [options.expected]
 * @param {Date} [options.now]
 * @param {number} [options.ttlMs]
 * @param {number} [options.inFlightMs]
 * @param {(tx: *) => Promise<object>} options.createAttempt
 * @returns {Promise<{outcome: "created"|"reused"|"in_progress"|"conflict"|"spent", payment: object|null}>}
 */
export async function claimCheckoutIntent({
  db,
  userId,
  clientIntentKey,
  expected = null,
  now = new Date(),
  ttlMs = null,
  inFlightMs = null,
  createAttempt
}) {
  const normalizedUserId = String(userId || "").trim();
  const key = normalizeClientIntentKey(clientIntentKey);
  if (!normalizedUserId || !key) {
    const error = new Error("api.subscription.checkout_intent_required");
    error.code = "CHECKOUT_INTENT_REQUIRED";
    throw error;
  }

  const openWindowMs = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : getOpenCheckoutTtlMs();
  const inFlightWindowMs =
    Number.isFinite(inFlightMs) && inFlightMs > 0 ? inFlightMs : getInFlightCheckoutMs();
  const openSince = new Date(now.getTime() - openWindowMs);
  const inFlightSince = new Date(now.getTime() - inFlightWindowMs);

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CHECKOUT_INTENT_LOCK_NAMESPACE}::int4, hashtext(${normalizedUserId})::int4)`;

    const sameIntent = await tx.payment.findFirst({
      where: { userId: normalizedUserId, clientIntentKey: key },
      select: OPEN_ATTEMPT_SELECT
    });

    if (sameIntent) {
      if (sameIntent.status === PaymentStatus.INITIATED) {
        if (getStoredCheckoutTransactionId(sameIntent)) {
          return { outcome: "reused", payment: sameIntent };
        }
        /* Rida on olemas, checkout'i veel ei ole: võitja on parajasti provideri
           kutses. Teine päring EI tohi hakata paralleelselt teist transaktsiooni
           looma — ta ütleb ausalt „pooleli". */
        if (sameIntent.createdAt >= inFlightSince) {
          return { outcome: "in_progress", payment: sameIntent };
        }
      }
      /* Kõik muu — lõppenud makse, ebamäärane `RECONCILE_PENDING` või ammu surnud
         pooleliolek — tähendab, et SEE kavatsus on ära kasutatud. Uus katse vajab
         uut võtit; vana rida jääb webhooki/reconciliation'i lahendada. */
      return { outcome: "spent", payment: sameIntent };
    }

    const openOther = await tx.payment.findFirst({
      where: {
        userId: normalizedUserId,
        status: PaymentStatus.INITIATED,
        ...(expected?.kind ? { kind: expected.kind } : {}),
        createdAt: { gte: openSince },
        NOT: { clientIntentKey: key }
      },
      orderBy: { createdAt: "desc" },
      select: OPEN_ATTEMPT_SELECT
    });

    /* Teine vahekaart, teine võti, sama kasutaja. Tasutavaid checkout'e tohib olla
       ÜKS: olemasolev antakse tagasi (mitte ei keelata), erineva summa korral on
       vastus aus konflikt. Checkout'ita ja mitte enam lennus olev rida ei ole
       tasutav ega blokeeri. */
    if (openOther) {
      if (getStoredCheckoutTransactionId(openOther)) {
        return sameMoney(openOther, expected)
          ? { outcome: "reused", payment: openOther }
          : { outcome: "conflict", payment: openOther };
      }
      if (openOther.createdAt >= inFlightSince) {
        return { outcome: "in_progress", payment: openOther };
      }
    }

    const created = await createAttempt(tx);
    return { outcome: "created", payment: created };
  });
}
