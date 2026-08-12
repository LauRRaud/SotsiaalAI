import { BillingMethodStatus, PaymentProvider } from "@/generated/prisma/client";
import {
  buildBillingMethodLabel,
  extractProviderCustomerId,
  extractRecurringMandateId,
  extractRecurringToken,
  extractRecurringTokenValidUntil
} from "@/lib/payments/recurring";
import { logPaymentEvent } from "@/lib/payments/observability";
import { encryptRecurringToken } from "@/lib/payments/tokenCrypto";

/**
 * SOL-PAY-10 — ÜKS MANDAAT, ÜKS RIDA.
 *
 * MIS OLI VALESTI. Recurring-mandaadi salvestas KAKS rada oma koodiga:
 * `token_return` callback (`app/api/subscription/callback`) ja PAID webhooki
 * `upsertRecurringBillingMethod()`. Kumbki luges esmalt olemasolevat viidet ja
 * lõi puudumisel uue rea; callback ei lukustanud makse rida üldse ja skeemis oli
 * `providerMandateId` ainult indeks, mitte piir. Kaks callback'i või callback +
 * webhook võisid mõlemad lugeda nulli ja luua ERALDI aktiivse krüptitud
 * tokenirea. Osa ridu ei olnud ühegi tellimusega seotud, aga kandsid endiselt
 * kasutatavat mandaati — revoke, limiit ja võtmerotatsioon ei tea siis, milline
 * rida on autoriteetne.
 *
 * MIS SIIN ON. Üks lukustatud claim, mida kutsuvad MÕLEMAD rajad, ja skeemis
 * unikaalsus `(provider, userId, providerMandateId)`.
 *
 * LUKUJÄRJEKORD (ummikuvaba): **makse rida FOR UPDATE → nõuandelukk kasutaja
 * peale**. Mõlemad rajad võtavad nad selles järjekorras; vastupidine järjekord
 * ühes rajas tähendaks klassikalist ummikut callback'i ja webhooki vahel.
 */

export const BILLING_METHOD_LOCK_NAMESPACE = 4716;

/**
 * @param {*} tx - Prisma tehing. Kutsuja PEAB olema võtnud makse rea luku.
 * @param {object} options
 * @param {string} options.userId
 * @param {string|null} [options.preferredBillingMethodId] - makse/tellimuse senine viide
 * @param {object} options.payload - provideri payload (token, mandaat, kaardi silt)
 * @param {Date} options.at
 * @returns {Promise<{id: string}|null>} `null`, kui tokenit ei ole või krüptovõti puudub
 */
export async function claimRecurringBillingMethod(
  tx,
  { userId, preferredBillingMethodId = null, payload = {}, at = new Date() }
) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return null;

  const recurringToken = extractRecurringToken(payload);
  if (!recurringToken) return null;

  let encrypted;
  try {
    encrypted = encryptRecurringToken(recurringToken);
  } catch (error) {
    /* E3/O-J1 fail-closed: ilma krüptovõtmeta mandaati EI salvestata ja
       korduvmakse ei aktiveeru. */
    logPaymentEvent("subscription_recurring_token_encryption_unavailable", {
      userId: normalizedUserId,
      code: error?.code || "PAYMENT_TOKEN_KEY_UNAVAILABLE"
    });
    return null;
  }

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BILLING_METHOD_LOCK_NAMESPACE}::int4, hashtext(${normalizedUserId})::int4)`;

  const providerMandateId = extractRecurringMandateId(payload) || null;
  const providerCustomerId = extractProviderCustomerId(payload) || null;
  const label = buildBillingMethodLabel(payload) || null;
  const expiresAtRaw = extractRecurringTokenValidUntil(payload);
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

  /* Olemasolev rida leitakse kolmes järjekorras: makse/tellimuse senine viide →
     sama mandaat → mitte midagi. Kolmas haru loob uue rea AINULT luku all, seega
     teine rada näeb teda juba olemasolevana. */
  const existing =
    (preferredBillingMethodId
      ? await tx.billingMethod.findUnique({
          where: { id: preferredBillingMethodId },
          select: { id: true }
        })
      : null) ||
    (providerMandateId
      ? await tx.billingMethod.findFirst({
          where: {
            userId: normalizedUserId,
            provider: PaymentProvider.MAKSEKESKUS,
            providerMandateId
          },
          select: { id: true }
        })
      : null);

  const data = {
    status: BillingMethodStatus.ACTIVE,
    provider: PaymentProvider.MAKSEKESKUS,
    providerToken: null,
    providerTokenCipher: encrypted.cipher,
    providerTokenKeyId: encrypted.keyId,
    providerMandateId,
    providerCustomerId,
    label,
    expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
    activatedAt: at,
    lastUsedAt: at,
    revokedAt: null
  };

  if (existing?.id) {
    return tx.billingMethod.update({ where: { id: existing.id }, data, select: { id: true } });
  }

  return tx.billingMethod.create({
    data: { userId: normalizedUserId, ...data },
    select: { id: true }
  });
}
