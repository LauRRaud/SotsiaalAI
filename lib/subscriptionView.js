import { getRolePlanKey, normalizeSubscriptionRole, PLAN_DEFINITION_IDS } from "@/lib/subscriptionPlans";

// Ainus serialiseerija tellimuse kasutajale nähtavatele seisudele (T09 E1).
// Server on tõeallikas: UI, API ja usage-värav loevad sama tuletatud seisu.
// Admini eelvaade ei muuda kunagi päris kasutaja seisu.

const DAY_MS = 24 * 60 * 60 * 1000;

export const SUBSCRIPTION_VIEW_STATES = Object.freeze({
  NONE: "NONE",
  ACTIVE: "ACTIVE",
  CANCEL_AT_PERIOD_END: "CANCEL_AT_PERIOD_END",
  PAST_DUE: "PAST_DUE",
  CANCELED: "CANCELED",
  EXPIRED: "EXPIRED",
  SPONSORED_ACTIVE: "SPONSORED_ACTIVE",
  SPONSORED_EXPIRED: "SPONSORED_EXPIRED"
});

function getMaxRetryCount() {
  return Math.max(0, Number(process.env.SUBSCRIPTION_RENEWAL_MAX_RETRY_COUNT || 3));
}

/**
 * KAKS SPONSORLUSALLIKAT, ÜKS MÕISTE (SOL-ORG-07).
 *
 * `SPONSORED_BY_HOST` on üksikisiku kutse (ruumipõhine), `SPONSORED_BY_ORGANIZATION`
 * on organisatsiooni oma (T25 E5). Kasutaja jaoks on mõlemad sama asi: **keegi
 * teine maksab ja mina ei saa seda tellimust tühistada.**
 *
 * Kui serialiseerija tunneb ainult ühte, saab teise maksja vale vastuse: seis
 * jääb tavaliseks `ACTIVE`-ks, `isSponsored` on väär, lõpuhoiatust ei teki ja UI
 * pakub tühistamisnuppu, mis päris tellimust ei muuda (server puudutab ainult
 * `SELF` ridu). Vale nupp on halvem kui puuduv nupp.
 *
 * `sponsorKind` hoiab vahe alles neile, kes seda päriselt vajavad (nt kes maksab),
 * ilma et keegi peaks võrdlema sõnesid.
 */
const SPONSORED_BILLING_SOURCES = Object.freeze({
  SPONSORED_BY_HOST: "HOST",
  SPONSORED_BY_ORGANIZATION: "ORGANIZATION"
});

/** `SPONSORED_BY_*` → `"HOST"` / `"ORGANIZATION"`; kõik muu → `null`. */
export function sponsorKindFromBillingSource(billingSource) {
  return SPONSORED_BILLING_SOURCES[String(billingSource || "").toUpperCase()] || null;
}

/** Kas selle tellimuse eest maksab keegi teine? */
export function isSponsoredBillingSource(billingSource) {
  return sponsorKindFromBillingSource(billingSource) !== null;
}

/**
 * Serialiseeri Subscription kasutaja/UI/admin vaate jaoks. Tagastab kõik seisud
 * ühtse tuletusega: ACTIVE, CANCEL_AT_PERIOD_END, PAST_DUE (+retry-aken),
 * CANCELED, EXPIRED (passiivne aegumine) ja sponsoreeritud päritolu.
 */
export function serializeSubscription(subscription, { now = Date.now() } = {}) {
  if (!subscription) return null;

  const status = String(subscription.status || "NONE").toUpperCase();
  const validUntil = subscription.validUntil ? new Date(subscription.validUntil) : null;
  const validUntilTs = validUntil && !Number.isNaN(validUntil.getTime()) ? validUntil.getTime() : null;
  const hasNoExpiry = validUntilTs == null;
  const expired = validUntilTs != null && validUntilTs <= now;
  const daysLeft = validUntilTs && validUntilTs > now ? Math.ceil((validUntilTs - now) / DAY_MS) : 0;
  const isActive = status === "ACTIVE" && (hasNoExpiry || daysLeft > 0);

  const billingSource = String(subscription.billingSource || "SELF").toUpperCase();
  const sponsorKind = sponsorKindFromBillingSource(billingSource);
  const isSponsored = sponsorKind !== null;
  const cancelAtPeriodEnd = Boolean(subscription.cancelAtPeriodEnd);

  const isPastDue = status === "PAST_DUE";
  const retryCount = Number(subscription.billingRetryCount || 0);
  const maxRetries = getMaxRetryCount();
  const willRetry = isPastDue && retryCount < maxRetries;
  const nextRetryAt = isPastDue && willRetry ? subscription.nextBilling || null : null;

  const sponsorEndsSoon = Boolean(isSponsored && isActive && daysLeft > 0 && daysLeft <= 7);
  const sponsorExpired = Boolean(isSponsored && !isActive);

  let state = status;
  if (status === "NONE") {
    state = SUBSCRIPTION_VIEW_STATES.NONE;
  } else if (isPastDue) {
    state = SUBSCRIPTION_VIEW_STATES.PAST_DUE;
  } else if (status === "ACTIVE") {
    if (expired) {
      state = isSponsored ? SUBSCRIPTION_VIEW_STATES.SPONSORED_EXPIRED : SUBSCRIPTION_VIEW_STATES.EXPIRED;
    } else if (isSponsored) {
      state = SUBSCRIPTION_VIEW_STATES.SPONSORED_ACTIVE;
    } else if (cancelAtPeriodEnd) {
      state = SUBSCRIPTION_VIEW_STATES.CANCEL_AT_PERIOD_END;
    } else {
      state = SUBSCRIPTION_VIEW_STATES.ACTIVE;
    }
  } else if (status === "CANCELED") {
    state = isSponsored && isActive ? SUBSCRIPTION_VIEW_STATES.SPONSORED_ACTIVE : SUBSCRIPTION_VIEW_STATES.CANCELED;
  }

  return {
    id: subscription.id,
    status: subscription.status,
    state,
    plan: subscription.plan,
    billingSource,
    validUntil: subscription.validUntil,
    nextBilling: subscription.nextBilling,
    canceledAt: subscription.canceledAt,
    updatedAt: subscription.updatedAt,
    isActive,
    daysLeft,
    hasNoExpiry,
    cancelAtPeriodEnd,
    isPastDue,
    pastDueSince: subscription.pastDueSince || null,
    nextRetryAt,
    retryCount,
    maxRetries,
    willRetry,
    isSponsored,
    /* `"HOST"` | `"ORGANIZATION"` | `null`. UI tohib küsida, KES maksab, ilma et
       ta peaks ise `billingSource` sõnesid võrdlema — just see võrdlus jäi
       organisatsiooni allika lisandudes ühes kohas uuendamata. */
    sponsorKind,
    sponsorEndsSoon,
    sponsorExpired
  };
}

/**
 * Serveri rolli kanooniline tasuline pakett. Admin-internal ega tühi/legacy plaan
 * ei ole rolliga seotud aktiivne tasuline pakett.
 */
export function expectedPlanDefinitionIdForRole(role) {
  const planKey = getRolePlanKey(normalizeSubscriptionRole(role));
  return PLAN_DEFINITION_IDS[planKey];
}

/**
 * Mittesiduv anomaalia-indikaator (E1, O-M1/O-J4): kas aktiivse tellimuse
 * salvestatud planDefinitionId erineb konto rolli oodatavast paketist. Ei muuda
 * andmeid; kasutatakse ainult admini sünteetiliseks raportiks.
 */
export function isPlanRoleAnomaly(subscription) {
  if (!subscription) return false;
  const status = String(subscription.status || "").toUpperCase();
  if (status !== "ACTIVE") return false;
  /* Sponsoreeritud tellimuse pakett tuleb kutse/organisatsiooni lepingust, mitte
     inimese rollist — ta EI OLE anomaalia kummagi allika korral. */
  if (isSponsoredBillingSource(subscription.billingSource)) return false;
  const planDefinitionId = subscription.planDefinitionId;
  if (!planDefinitionId) return false;
  return planDefinitionId !== expectedPlanDefinitionIdForRole(subscription.user?.role || subscription.role);
}

/**
 * Admini-ainult agregaatarv: mitmel aktiivsel omamaksega tellimusel on rolliga
 * mittevastav pakett. Ei tagasta ega avalda ühegi kasutaja makseinfot.
 */
export async function countPlanRoleAnomalies(db, { now = new Date() } = {}) {
  const rows = await db.subscription.findMany({
    where: {
      status: "ACTIVE",
      billingSource: "SELF",
      planDefinitionId: { not: null },
      OR: [{ validUntil: null }, { validUntil: { gt: now } }]
    },
    select: {
      planDefinitionId: true,
      user: { select: { role: true } }
    }
  });

  let anomalies = 0;
  for (const row of rows) {
    if (row.planDefinitionId !== expectedPlanDefinitionIdForRole(row.user?.role)) anomalies += 1;
  }
  return { checked: rows.length, anomalies };
}
