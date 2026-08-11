import { PaymentKind } from "@/generated/prisma/client";

/**
 * SOL-PAY-05 — ALLKIRI TÕENDAB PÄRITOLU, MITTE SUMMAT.
 *
 * MIS OLI VALESTI. `PAID` otsuseks piisas kolmest asjast: kehtiv MAC, leitav
 * `providerPaymentId` ja `PAID`-iks mapitav staatus. Makse summa ja valuuta on
 * `Payment` real olemas (need kirjutas checkout ise), aga webhooki lukustatud
 * `select` ei lugenud neid ega võrrelnud millegagi — provideri payload'i summa
 * salvestati projektsioonina ja jäeti seisma. Vale konfiguratsioon, osaline
 * makse, vale transaction/reference sidumine või tulevane integratsioonimuutus
 * andnuks väiksema makse eest täismahus kuu või sponsorkutse õiguse.
 * MakeCommerce'i enda juhend ütleb otse, et merchant peab vastuvõetud summa
 * oodatuga võrdlema.
 *
 * MIS SIIN ON. Enne `PAID` üleminekut võrreldakse kanooniliselt: viide, summa
 * (täpne kümnendvõrdlus, mitte ujukoma), valuuta, `merchant_data` makse- ja
 * tellimuse-ID ning oodatud makseliik. Mittevastavus EI aktiveeri õigust — ta
 * läheb nähtavasse `REVIEW_REQUIRED` seisu koos loeteluga, mis ei klappinud.
 *
 * KAKS PIIRI, mis hoiavad selle ausana:
 *   · **Puuduv väli ei ole vastavus.** Kui provider summat üldse ei saada, ei
 *     saa me öelda „klapib" — see on `missing`, mis on samuti mittevastavus.
 *     Vastasel juhul saaks kontrollist mööda lihtsalt välja ära jättes.
 *   · **`merchant_data` võrreldakse ainult siis, kui ta kohal on** — teda ei
 *     saada iga sõnumitüüp ja tema puudumine ei ole tõend millegi vastu. Kohal
 *     olles peab ta klappima.
 */

const MONEY_PATTERN = /^-?\d+(?:\.\d+)?$/;

/**
 * Kanooniline rahakuju kahe kümnendkohaga ILMA ujukomata. `"7.9"` → `"7.90"`,
 * `"7.990"` → `"7.99"`, `"7.999"` → `null` (ei ole esitatav ega ümardata).
 * Prisma `Decimal` annab `toString()`-iga täpse kuju, seega sama tee kõlbab ka
 * andmebaasi väärtusele.
 */
export function canonicalMoney(value) {
  if (value === null || value === undefined) return null;
  const raw = String(typeof value === "object" && value?.toString ? value.toString() : value)
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");
  if (!MONEY_PATTERN.test(raw)) return null;

  const negative = raw.startsWith("-");
  const [integerPart, fractionPart = ""] = raw.replace(/^-/, "").split(".");
  const padded = `${fractionPart}00`.slice(0, 2);
  const remainder = fractionPart.slice(2);
  if (remainder && /[1-9]/.test(remainder)) return null;

  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "");
  const canonical = `${normalizedInteger}.${padded}`;
  if (canonical === "0.00") return "0.00";
  return negative ? `-${canonical}` : canonical;
}

export function canonicalCurrency(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(raw) ? raw : null;
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

/** `merchant_data` on JSON-sõne, mille meie ise checkout'i loomisel saatsime. */
export function parseMerchantData(payload = {}) {
  const raw =
    payload?.merchant_data ??
    payload?.merchantData ??
    payload?.transaction?.merchant_data ??
    payload?.transaction?.merchantData;
  if (!raw) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const FLOW_TO_KIND = Object.freeze({
  subscription_init: PaymentKind.SUBSCRIPTION_INITIAL,
  subscription_renewal_job: PaymentKind.SUBSCRIPTION_RENEWAL,
  invite_sponsored_init: PaymentKind.INVITE_SPONSORED
});

export function expectedKindForFlow(flow) {
  return FLOW_TO_KIND[String(flow || "").trim().toLowerCase()] || null;
}

function extractPayloadAmount(payload = {}) {
  return pickScalar(payload?.amount, payload?.transaction?.amount, payload?.payment?.amount);
}

function extractPayloadCurrency(payload = {}) {
  return pickScalar(payload?.currency, payload?.transaction?.currency, payload?.payment?.currency);
}

function extractPayloadReference(payload = {}) {
  return pickScalar(
    payload?.reference,
    payload?.merchant_reference,
    payload?.transaction?.reference,
    payload?.providerPaymentId,
    payload?.provider_payment_id
  );
}

/**
 * Kas see `PAID` sõnum kuulub sellele maksele ja selle summa eest?
 *
 * @param {object} options
 * @param {{id: string, subscriptionId: string|null, providerPaymentId: string, amount: *, currency: string, kind: string}} options.payment
 * @param {object} options.payload - provideri (verifitseeritud MAC-iga) payload
 * @returns {{ok: boolean, mismatches: Array<{field: string, expected: string|null, actual: string|null}>}}
 */
export function verifyPaidPayload({ payment, payload } = {}) {
  const mismatches = [];
  const add = (field, expected, actual) =>
    mismatches.push({
      field,
      expected: expected === undefined ? null : expected,
      actual: actual === undefined || actual === "" ? null : actual
    });

  if (!payment) {
    return { ok: false, mismatches: [{ field: "payment", expected: null, actual: null }] };
  }

  const expectedAmount = canonicalMoney(payment.amount);
  const actualAmount = canonicalMoney(extractPayloadAmount(payload));
  if (!actualAmount || !expectedAmount || actualAmount !== expectedAmount) {
    add("amount", expectedAmount, extractPayloadAmount(payload) || null);
  }

  const expectedCurrency = canonicalCurrency(payment.currency);
  const actualCurrency = canonicalCurrency(extractPayloadCurrency(payload));
  if (!actualCurrency || !expectedCurrency || actualCurrency !== expectedCurrency) {
    add("currency", expectedCurrency, extractPayloadCurrency(payload) || null);
  }

  const expectedReference = String(payment.providerPaymentId || "").trim();
  const actualReference = extractPayloadReference(payload);
  if (!actualReference || actualReference !== expectedReference) {
    add("reference", expectedReference || null, actualReference || null);
  }

  /* `merchant_data` on meie enda saadetud saatja-info. Kui ta on kohal, peab ta
     osutama SELLELE maksele — vale sidumine on täpselt see, mille vastu see
     kontroll on. Puudumine ei ole tõend millegi vastu (kõik sõnumitüübid teda ei
     kanna), seega teda ei nõuta. */
  const merchantData = parseMerchantData(payload);
  if (merchantData) {
    const merchantPaymentId = pickScalar(merchantData.paymentId, merchantData.payment_id);
    if (merchantPaymentId && merchantPaymentId !== String(payment.id)) {
      add("merchantData.paymentId", String(payment.id), merchantPaymentId);
    }

    const merchantSubscriptionId = pickScalar(merchantData.subscriptionId, merchantData.subscription_id);
    if (
      merchantSubscriptionId &&
      payment.subscriptionId &&
      merchantSubscriptionId !== String(payment.subscriptionId)
    ) {
      add("merchantData.subscriptionId", String(payment.subscriptionId), merchantSubscriptionId);
    }

    const expectedKind = expectedKindForFlow(merchantData.flow);
    if (expectedKind && payment.kind && expectedKind !== payment.kind) {
      add("kind", String(payment.kind), String(expectedKind));
    }
  }

  return { ok: mismatches.length === 0, mismatches };
}

/** Lühike, logi- ja auditikõlblik kokkuvõte (väärtused on summad/ID-d, mitte isikuandmed). */
export function describeMismatches(mismatches = []) {
  return mismatches.map((entry) => entry.field).join(",");
}
