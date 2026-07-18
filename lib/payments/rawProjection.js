// Range allowlist Payment.raw jaoks (T09 PAYMENTS-V1, O-J1, E3).
//
// Provideri toor-payload'i EI salvestata. Ainult mittetundlikud tehnilised
// väljad, mis on vajalikud reconciliation'iks ja tõrkeanalüüsiks. Selgelt VÄLJAS:
// kliendi e-post/nimi/IP/riik, kaardi bränd/last4, recurring token, mandaat ja
// mis tahes muu vaba payload.

const MAX_FIELD_LENGTH = 200;

function pickScalar(...candidates) {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;
    if (typeof candidate === "object") continue;
    const text = String(candidate).trim();
    if (text) return text.slice(0, MAX_FIELD_LENGTH);
  }
  return undefined;
}

/**
 * Projitseeri provideri (Maksekeskus) payload allowlistitud tehniliseks kirjeks.
 * Sisendiks nii webhook/callback payload kui ka checkout/charge vastus.
 */
export function projectProviderPaymentRaw(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const transaction = source.transaction && typeof source.transaction === "object" ? source.transaction : {};
  const payment = source.payment && typeof source.payment === "object" ? source.payment : {};

  const projection = {};
  const transactionId = pickScalar(source.id, source.transactionId, source.transaction_id, transaction.id, payment.id);
  const reference = pickScalar(source.reference, source.merchant_reference, transaction.reference, payment.reference);
  const status = pickScalar(
    source.status,
    source.payment_status,
    source.transaction_status,
    transaction.status,
    payment.status
  );
  const messageType = pickScalar(source.message_type);
  const amount = pickScalar(source.amount, transaction.amount, payment.amount);
  const currency = pickScalar(source.currency, transaction.currency, payment.currency);
  const paidAt = pickScalar(
    source.paidAt,
    source.paid_at,
    source.transaction_time,
    source.completed_at,
    payment.paidAt
  );

  if (transactionId) projection.transactionId = transactionId;
  if (reference) projection.reference = reference;
  if (status) projection.status = status;
  if (messageType) projection.messageType = messageType;
  if (amount) projection.amount = amount;
  if (currency) projection.currency = currency;
  if (paidAt) projection.paidAt = paidAt;

  return projection;
}

/**
 * Ehita Payment.raw kirje: kureeritud sisemine baas (meie enda mittetundlikud
 * väljad) + allowlistitud provideri projektsioon võtme `provider` all.
 */
export function buildPaymentRawRecord(base = {}, providerPayload = null) {
  const record = {};
  for (const [key, value] of Object.entries(base || {})) {
    if (value === undefined) continue;
    record[key] = value;
  }
  const projection = providerPayload ? projectProviderPaymentRaw(providerPayload) : null;
  if (projection && Object.keys(projection).length > 0) {
    record.provider = projection;
  }
  return record;
}
