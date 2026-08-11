/**
 * SOL-PAY-04 — KES MAKSAB, ON ÜKS OTSUS, MITTE VIIS VÄLJA.
 *
 * MIS OLI VALESTI. Tellimuse päritolu elab viies väljas (`billingSource`,
 * `sponsorUserId`, `inviteId`, `sponsorOrganizationId`, `orgClientSponsorshipId`)
 * ja iga rada kirjutas neist ainult need, mida ta ise vajas. Kui inimene maksis
 * pärast sponsorluse lõppu ise, muutis init plaani ja billing-mode'i ning
 * `activateSubscriptionFromPayment()` andis õiguse — aga `billingSource` jäi
 * `SPONSORED_BY_HOST`/`SPONSORED_BY_ORGANIZATION` ja sponsori seosed jäid rea
 * külge rippuma. Tagajärg ei olnud kosmeetiline: **tühistamine nõuab
 * `billingSource: "SELF"`**, seega omamaksja ei saanud oma tellimust lõpetada, ja
 * sponsori hilisem tagasimakse clawback'is perioodi, mille eest maksis kasutaja
 * ise.
 *
 * Sama auk oli sponsorluste VAHEL: organisatsioonisponsorlus kirjutas
 * `sponsorOrganizationId` ja jättis vana `sponsorUserId`/`inviteId` alles (ja
 * vastupidi). `lib/org/accessContext.js` valib sponsori just nende väljade järgi.
 *
 * MIS SIIN ON. Päritolu määratakse TERVIKUNA: iga ehitaja tagastab kõik viis
 * välja, ka need, mis tuleb nullida. Väljade loend on ühes kohas, seega uus
 * sponsoriliik ei saa vaikselt poolikuks jääda.
 */

export const SUBSCRIPTION_ORIGIN_FIELDS = Object.freeze([
  "billingSource",
  "sponsorUserId",
  "inviteId",
  "sponsorOrganizationId",
  "orgClientSponsorshipId"
]);

const EMPTY_ORIGIN = Object.freeze({
  billingSource: "SELF",
  sponsorUserId: null,
  inviteId: null,
  sponsorOrganizationId: null,
  orgClientSponsorshipId: null
});

/** Inimene maksab ise: ükski sponsoriseos ei jää rippuma. */
export function selfOrigin() {
  return { ...EMPTY_ORIGIN };
}

/** Ruumi host (või tema organisatsioon) maksab kutse alusel. */
export function hostSponsorOrigin({ sponsorUserId = null, inviteId = null } = {}) {
  return {
    ...EMPTY_ORIGIN,
    billingSource: "SPONSORED_BY_HOST",
    sponsorUserId: sponsorUserId || null,
    inviteId: inviteId || null
  };
}

/** Organisatsioon maksab kliendisponsorluse alusel. */
export function organizationSponsorOrigin({ organizationId = null, sponsorshipId = null } = {}) {
  return {
    ...EMPTY_ORIGIN,
    billingSource: "SPONSORED_BY_ORGANIZATION",
    sponsorOrganizationId: organizationId || null,
    orgClientSponsorshipId: sponsorshipId || null
  };
}

/** Rea päritolu kompaktselt — ledgeri jaoks ja võrdlemiseks. */
export function describeSubscriptionOrigin(subscription) {
  const source = {};
  for (const field of SUBSCRIPTION_ORIGIN_FIELDS) {
    source[field] = subscription?.[field] ?? null;
  }
  source.billingSource = String(source.billingSource || "SELF").toUpperCase();
  return source;
}

/** Kas päritolu päriselt muutub? Muutumatut vahetust ledgerisse ei kirjutata. */
export function originChanged(before, after) {
  const from = describeSubscriptionOrigin(before);
  const to = describeSubscriptionOrigin(after);
  return SUBSCRIPTION_ORIGIN_FIELDS.some((field) => from[field] !== to[field]);
}

/**
 * Päritolu vahetus JA tema jälg samas tehingus.
 *
 * Ledger on `DataAuditLog` — püsiv, indekseeritud ja süstitava `tx`-ga
 * kirjutatav tabel. Teadlikult MITTE `logPaymentAudit()`, mis kirjutab
 * `ChatLog`-i globaalse kliendiga põhitehingust väljas (vt SOL-PAY-08).
 *
 * @returns `true`, kui päritolu muutus (ja ledgeririda tekkis).
 */
export async function applySubscriptionOrigin(
  tx,
  { subscription, origin, actorUserId = null, paymentId = null, reason = "self_payment" }
) {
  if (!subscription?.id) return false;
  if (!originChanged(subscription, origin)) return false;

  await tx.subscription.update({
    where: { id: subscription.id },
    data: { ...origin }
  });

  await tx.dataAuditLog.create({
    data: {
      actorUserId: actorUserId || subscription.userId || null,
      targetUserId: subscription.userId || null,
      action: "subscription.billing_source_changed",
      resourceType: "Subscription",
      resourceId: subscription.id,
      meta: {
        reason,
        paymentId: paymentId || null,
        from: describeSubscriptionOrigin(subscription),
        to: describeSubscriptionOrigin(origin)
      }
    }
  });

  return true;
}
