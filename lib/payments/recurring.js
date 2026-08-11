import {
  BillingMode,
  BillingMethodStatus,
  PaymentKind,
  PaymentProvider,
  PaymentStatus,
  SubscriptionStatus,
} from "@/generated/prisma/client";

const MAX_RETRY_COUNT = Math.max(
  0,
  Number(process.env.SUBSCRIPTION_RENEWAL_MAX_RETRY_COUNT || 3)
);

function asDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(baseDate, days) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  return date;
}

export function isRecurringBillingEnabled() {
  const raw = String(process.env.SUBSCRIPTION_RECURRING_ENABLED || "")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function getInitialSubscriptionPaymentKind() {
  return PaymentKind.SUBSCRIPTION_INITIAL;
}

export function getInviteSponsoredPaymentKind() {
  return PaymentKind.INVITE_SPONSORED;
}

export function getRenewalPaymentKind() {
  return PaymentKind.SUBSCRIPTION_RENEWAL;
}

function getRetryScheduleDays() {
  const raw = String(process.env.SUBSCRIPTION_RENEWAL_RETRY_DAYS || "1,3,5").trim();
  const values = raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value >= 0);
  return values.length ? values : [1, 3, 5];
}

export function computeNextRetryAt(failedAt, retryCount = 0) {
  const base = asDate(failedAt) || new Date();
  const schedule = getRetryScheduleDays();
  const index = Math.max(0, Math.min(schedule.length - 1, Number(retryCount || 0)));
  return addDays(base, schedule[index]);
}

export function shouldCancelAfterRetryCount(retryCount = 0) {
  return Number(retryCount || 0) >= MAX_RETRY_COUNT;
}

export function extractRecurringToken(payload = {}) {
  return String(
    payload?.recurringToken ||
      payload?.recurring_token ||
      payload?.card_token ||
      payload?.token?.id ||
      payload?.token ||
      payload?.payment_token ||
      ""
  ).trim();
}

export function extractRecurringTokenValidUntil(payload = {}) {
  return String(
    payload?.token?.valid_until ||
      payload?.token?.validUntil ||
      payload?.valid_until ||
      payload?.validUntil ||
      ""
  ).trim();
}

export function extractRecurringMandateId(payload = {}) {
  return String(
    payload?.mandateId ||
      payload?.mandate_id ||
      payload?.agreementId ||
      payload?.agreement_id ||
      payload?.recurringId ||
      payload?.recurring_id ||
      ""
  ).trim();
}

export function extractProviderCustomerId(payload = {}) {
  return String(
    payload?.customerId ||
      payload?.customer_id ||
      payload?.customer?.id ||
      ""
  ).trim();
}

export function buildBillingMethodLabel(payload = {}) {
  const brand = String(
    payload?.cardBrand || payload?.card_brand || payload?.card?.brand || ""
  ).trim();
  const last4 = String(
    payload?.cardLast4 || payload?.card_last4 || payload?.card?.last4 || ""
  ).trim();
  if (brand && last4) return `${brand} **** ${last4}`;
  if (last4) return `Card **** ${last4}`;
  return "";
}

export function buildRecurringPaymentReference(subscriptionId = "", options = {}) {
  const suffix = String(subscriptionId || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-10);
  const nextBilling = asDate(options?.nextBilling);
  const cycleMarker = nextBilling
    ? nextBilling.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)
    : "initial";
  const attemptNumber = Math.max(1, Number(options?.attemptNumber || 1));
  return `mk_renew_${cycleMarker}_a${attemptNumber}_${suffix || "sub"}`;
}

export function getRecurringMaxRetryCount() {
  return MAX_RETRY_COUNT;
}

/**
 * SOL-PAY-01 — RETRY-SEIS PEAB OLEMA VALITAV.
 *
 * MIS OLI VALESTI. Valik nõudis `status: ACTIVE` JA maksemeetodit `ACTIVE`.
 * Esimese tõrke käsitlus muutis tellimuse `PAST_DUE`-ks ja maksemeetodi
 * `FAILED`-iks — st arvutas hoolikalt `nextRetryAt`-i, kasvatas
 * `billingRetryCount`-i ja pani kirja tähtaja, mille peale ükski järgmine jooks
 * enam kunagi ei vaadanud. `SUBSCRIPTION_RENEWAL_MAX_RETRY_COUNT`, päevagraafik
 * ja lõplik `cancel` olid surnud kood: üks ajutine võrgu- või kaarditõrge
 * lõpetas automaatse uuendamise jäädavalt, kuigi liides lubas korduskatset.
 *
 * MIS SIIN ON. Valik on kaks haru: tavaline tähtaeg (`ACTIVE`) ja lubatud
 * korduskatse (`PAST_DUE`, mille katsete arv on veel lae all ja mille
 * `nextBilling` kannab järgmise katse aega). Maksemeetodi `ACTIVE` nõue jääb
 * mõlemal — aga tema tähendus on nüüd „meetod on kasutatav", mitte „viimane
 * katse õnnestus": ühe tagasilükatud kaardimakse peale ei märgita meetodit enam
 * katkiseks (vt `planRenewalFailure`).
 */
function getDueRecurringSubscriptionBaseWhere(now) {
  return {
    billingMode: BillingMode.RECURRING,
    billingInterval: "MONTHLY",
    // O-M4: perioodi lõpus tühistatavat tellimust ei uuendata.
    cancelAtPeriodEnd: false,
    billingMethod: {
      status: BillingMethodStatus.ACTIVE,
      provider: PaymentProvider.MAKSEKESKUS,
    },
    OR: [
      {
        status: SubscriptionStatus.ACTIVE,
        OR: [{ nextBilling: null }, { nextBilling: { lte: now } }],
      },
      {
        status: SubscriptionStatus.PAST_DUE,
        billingRetryCount: { lt: MAX_RETRY_COUNT },
        nextBilling: { lte: now },
      },
    ],
  };
}

export function getDueRecurringSubscriptionWhere(now = new Date()) {
  return {
    ...getDueRecurringSubscriptionBaseWhere(now),
    /* SOL-PAY-02: lahendamata katsega tellimust EI laadita uuesti. Teadmata
       tulemusega kutse võis raha juba võtta; teine katse oleks sama kuu eest
       teine laadimine. Rida lahendab webhook või reconciliation-worker, mille
       järel tellimus tuleb valikusse tagasi. */
    payments: { none: { status: PaymentStatus.RECONCILE_PENDING } },
  };
}

/**
 * SOL-PAY-02: sama valik vastupidise märgiga — need tellimused, mis JÄID
 * lahendamata katse taha kinni. Ilma selleta oleks „ei laadi uuesti" vaikne
 * peatus: worker ei raporteeriks neist midagi.
 */
export function getUnresolvedRenewalSubscriptionWhere(now = new Date()) {
  return {
    ...getDueRecurringSubscriptionBaseWhere(now),
    payments: { some: { status: PaymentStatus.RECONCILE_PENDING } },
  };
}

/**
 * SOL-PAY-01 — ühe ebaõnnestunud katse tagajärg ÜHES kohas.
 *
 * Otsus oli laiali marsruudi `catch`-is ja tema kolm poolt (tellimuse seis,
 * järgmise katse aeg, maksemeetodi seis) ei olnud kuskil koos loetavad. Kaks
 * reeglit, mis siit välja paistavad:
 *
 *   · **Maksemeetod märgitakse `FAILED`-iks ALLES loobumisel.** Tagasi lükatud
 *     kaardimakse on tellimuse sündmus (`PAST_DUE` + loendur), mitte tõend, et
 *     meetod ise on katki. Vana kood märkis ta katkiseks esimese tõrke peale ja
 *     lukustas sellega ka enda korduskatse välja.
 *   · **Loobumisel jääb `nextBilling` puutumata** — tühistatud tellimusel ei ole
 *     järgmist katset, mida ajastada.
 */
/**
 * Tõrke tagajärg tellimuse reale. Kaks rada kirjutavad selle: worker'i `catch`
 * (kutse ei jõudnud läbi) ja webhook (provider ütles ise „ei"). Kui neist ainult
 * ühel on päevagraafik ja lõplik tühistus, siis oleneb korduskatse käitumine
 * sellest, KUMB rada tõrke avastas — täpselt see erinevus jättis webhookilt
 * tulnud eituse `nextBilling`-u minevikku (kohene uus laadimine) ja lae peal
 * igaveseks `PAST_DUE` seisu.
 */
export function buildRenewalFailureSubscriptionUpdate(
  plan,
  { failedAt = new Date(), currentNextBilling = null } = {}
) {
  return {
    status: plan.subscriptionStatus,
    pastDueSince: failedAt,
    billingRetryCount: plan.retryCount,
    nextBilling: plan.cancel ? currentNextBilling : plan.nextRetryAt,
    ...(plan.cancel ? { canceledAt: failedAt } : {}),
  };
}

export function planRenewalFailure({ retryCountBefore = 0, failedAt = new Date() } = {}) {
  const retryCount = Number(retryCountBefore || 0) + 1;
  const cancel = shouldCancelAfterRetryCount(retryCount);
  return {
    retryCount,
    cancel,
    subscriptionStatus: cancel ? SubscriptionStatus.CANCELED : SubscriptionStatus.PAST_DUE,
    nextRetryAt: cancel ? null : computeNextRetryAt(failedAt, retryCount - 1),
    billingMethodStatus: cancel ? BillingMethodStatus.FAILED : null,
  };
}
