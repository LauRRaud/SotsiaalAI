import crypto from "node:crypto";
import { PaymentStatus } from "@/generated/prisma/client";

const MAKSEKESKUS_API_BASE = String(process.env.MAKSEKESKUS_API_BASE || "")
  .trim()
  .replace(/\/+$/, "");
const MAKSEKESKUS_API_KEY = String(process.env.MAKSEKESKUS_API_KEY || "").trim();
const MAKSEKESKUS_SHOP_ID = String(process.env.MAKSEKESKUS_SHOP_ID || "").trim();
const MAKSEKESKUS_PUBLIC_KEY = String(process.env.MAKSEKESKUS_PUBLIC_KEY || "").trim();
function readPositiveNumber(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

const MAKSEKESKUS_TIMEOUT_MS = readPositiveNumber(process.env.MAKSEKESKUS_TIMEOUT_MS, 15_000);
const MAKSEKESKUS_RECURRING_IP = String(
  process.env.MAKSEKESKUS_RECURRING_IP || process.env.MAKSEKESKUS_SERVER_IP || "127.0.0.1"
).trim();
const MAKSEKESKUS_IFRAME_SCRIPT_URL = String(
  process.env.MAKSEKESKUS_IFRAME_SCRIPT_URL || ""
).trim();

function joinApiPath(base, path) {
  const normalizedBase = String(base || "").trim().replace(/\/+$/, "");
  const normalizedPath = String(path || "").trim();
  if (!normalizedBase || !normalizedPath) return normalizedBase || normalizedPath;
  if (/\/v\d+$/i.test(normalizedBase) && /^\/v\d+\//i.test(normalizedPath)) {
    return `${normalizedBase}${normalizedPath.replace(/^\/v\d+/, "")}`;
  }
  return `${normalizedBase}${normalizedPath}`;
}

function normalizeLocale(locale) {
  const base = String(locale || "en")
    .toLowerCase()
    .split("-")[0]
    .trim();
  if (base === "et" || base === "ru" || base === "en") return base;
  return "en";
}

function normalizeIp(ip) {
  const raw = String(ip || "")
    .split(",")[0]
    .trim();
  return raw || "127.0.0.1";
}

function normalizeUrlMethod(method, fallback) {
  const normalized = String(method || fallback || "GET")
    .trim()
    .toUpperCase();
  return normalized === "POST" ? "POST" : "GET";
}

function buildTransactionUrl(url, method, fallbackMethod = "GET") {
  const value = String(url || "").trim();
  if (!value) return undefined;
  return {
    url: value,
    method: normalizeUrlMethod(method, fallbackMethod),
  };
}

function stringifyMerchantData(merchantData) {
  if (merchantData == null) return undefined;
  if (typeof merchantData === "string") {
    const trimmed = merchantData.trim();
    return trimmed || undefined;
  }
  try {
    return JSON.stringify(merchantData);
  } catch {
    return undefined;
  }
}

function getRedirectCheckoutUrl(payload = {}) {
  const redirectMethod = Array.isArray(payload?.payment_methods?.other)
    ? payload.payment_methods.other.find(
        (entry) => String(entry?.name || "").trim().toLowerCase() === "redirect"
      )
    : null;

  return String(
    redirectMethod?.url ||
      payload?.url ||
      payload?._links?.Pay?.href ||
      payload?._links?.pay?.href ||
      ""
  ).trim();
}

function getTransactionId(payload = {}) {
  return String(
    payload?.id || payload?.transactionId || payload?.transaction_id || payload?.transaction?.id || ""
  ).trim();
}

function getProviderPaymentId(payload = {}, fallback = "") {
  return String(
    payload?.reference ||
      payload?.merchant_reference ||
      payload?.transaction?.reference ||
      payload?.providerPaymentId ||
      payload?.provider_payment_id ||
      fallback
  ).trim();
}

function buildRequestHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${MAKSEKESKUS_API_KEY}`,
  };
}

async function callMaksekeskusApi(path, { method = "GET", body } = {}) {
  if (!MAKSEKESKUS_API_BASE || !MAKSEKESKUS_API_KEY || !MAKSEKESKUS_SHOP_ID) {
    throw new Error("api.subscription.provider_unavailable");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, MAKSEKESKUS_TIMEOUT_MS));

  try {
    const response = await fetch(joinApiPath(MAKSEKESKUS_API_BASE, path), {
      method,
      headers: buildRequestHeaders(),
      body: body == null ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(
        data?.messageKey ||
          data?.message ||
          data?.error ||
          "api.subscription.checkout_create_failed"
      );
      err.status = response.status;
      err.payload = data;
      throw err;
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

function buildTransactionPayload({
  providerPaymentId,
  amount,
  currency,
  locale,
  ip,
  returnUrl,
  cancelUrl,
  webhookUrl,
  returnMethod = "GET",
  cancelMethod = "GET",
  webhookMethod = "POST",
  customerEmail,
  customerName,
  customerCountry,
  description,
  merchantData,
  recurringRequired = false,
}) {
  const transaction = {
    amount: String(amount),
    currency: String(currency || "EUR")
      .trim()
      .toUpperCase(),
    reference: String(providerPaymentId || "").trim(),
    recurring_required: Boolean(recurringRequired),
    customer: {
      ip: normalizeIp(ip),
      ...(customerEmail ? { email: String(customerEmail).trim() } : {}),
      ...(customerName ? { name: String(customerName).trim() } : {}),
      ...(customerCountry ? { country: String(customerCountry).trim().toUpperCase() } : {}),
      locale: normalizeLocale(locale),
    },
    ...(description ? { description: String(description).trim() } : {}),
    ...(stringifyMerchantData(merchantData)
      ? { merchant_data: stringifyMerchantData(merchantData) }
      : {}),
  };

  const returnUrlObject = buildTransactionUrl(returnUrl, returnMethod, "GET");
  const cancelUrlObject = buildTransactionUrl(cancelUrl, cancelMethod, "GET");
  const notificationUrlObject = buildTransactionUrl(webhookUrl, webhookMethod, "POST");

  if (returnUrlObject || cancelUrlObject || notificationUrlObject) {
    transaction.transaction_url = {
      ...(returnUrlObject ? { return_url: returnUrlObject } : {}),
      ...(cancelUrlObject ? { cancel_url: cancelUrlObject } : {}),
      ...(notificationUrlObject ? { notification_url: notificationUrlObject } : {}),
    };
  }

  return { transaction };
}

async function createMaksekeskusTransaction({
  providerPaymentId,
  amount,
  currency,
  locale,
  ip,
  returnUrl,
  cancelUrl,
  webhookUrl,
  returnMethod,
  cancelMethod,
  webhookMethod,
  customerEmail,
  customerName,
  customerCountry,
  description,
  merchantData,
  recurringRequired = false,
}) {
  const payload = buildTransactionPayload({
    providerPaymentId,
    amount,
    currency,
    locale,
    ip,
    returnUrl,
    cancelUrl,
    webhookUrl,
    returnMethod,
    cancelMethod,
    webhookMethod,
    customerEmail,
    customerName,
    customerCountry,
    description,
    merchantData,
    recurringRequired,
  });

  const data = await callMaksekeskusApi("/v1/transactions", {
    method: "POST",
    body: payload,
  });

  const transactionId = getTransactionId(data);
  if (!transactionId) {
    throw new Error("api.subscription.checkout_create_failed");
  }

  return {
    transactionId,
    providerPaymentId: getProviderPaymentId(data, providerPaymentId),
    raw: data,
  };
}

function isLikelyTestEnvironment() {
  const source = `${MAKSEKESKUS_API_BASE} ${MAKSEKESKUS_IFRAME_SCRIPT_URL}`.toLowerCase();
  return source.includes("test");
}

export function getMaksekeskusSecretKey() {
  return MAKSEKESKUS_API_KEY;
}

function getMaksekeskusIframeScriptUrl() {
  if (MAKSEKESKUS_IFRAME_SCRIPT_URL) return MAKSEKESKUS_IFRAME_SCRIPT_URL;
  if (isLikelyTestEnvironment()) {
    return "https://static.cc-test.maksekeskus.ee/checkout/dist/checkout.min.js";
  }
  return "https://static.cc.maksekeskus.ee/checkout/dist/checkout.min.js";
}

export function makeProviderPaymentId(userId = "") {
  const userPart = String(userId || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-10);
  const rand = crypto.randomBytes(4).toString("hex");
  return `mk_${Date.now()}_${userPart || "user"}_${rand}`;
}

export function mapProviderPaymentStatus(input) {
  const raw = String(input || "")
    .toLowerCase()
    .trim();
  if (!raw) return null;
  if (["paid", "success", "succeeded", "completed", "complete", "authorized"].includes(raw)) {
    return PaymentStatus.PAID;
  }
  if (["failed", "declined", "error"].includes(raw)) {
    return PaymentStatus.FAILED;
  }
  if (["canceled", "cancelled", "voided", "expired"].includes(raw)) {
    return PaymentStatus.CANCELED;
  }
  if (["refunded", "refund", "part_refunded"].includes(raw)) {
    return PaymentStatus.REFUNDED;
  }
  if (["pending", "initiated", "created", "processing", "in_progress", "approved"].includes(raw)) {
    return PaymentStatus.INITIATED;
  }
  if (raw.includes("refund")) return PaymentStatus.REFUNDED;
  if (raw.includes("cancel") || raw.includes("void") || raw.includes("expired")) {
    return PaymentStatus.CANCELED;
  }
  if (raw.includes("fail") || raw.includes("declin") || raw.includes("error")) {
    return PaymentStatus.FAILED;
  }
  if (raw.includes("success") || raw.includes("paid") || raw.includes("complete") || raw.includes("authoriz")) {
    return PaymentStatus.PAID;
  }
  if (raw.includes("pending") || raw.includes("process") || raw.includes("init") || raw.includes("approv")) {
    return PaymentStatus.INITIATED;
  }
  return null;
}

export function extractProviderPaymentId(payload = {}, fallback = "") {
  return String(
    payload?.providerPaymentId ||
      payload?.provider_payment_id ||
      payload?.reference ||
      payload?.merchant_reference ||
      payload?.transaction?.reference ||
      payload?.transactionId ||
      payload?.transaction_id ||
      payload?.id ||
      fallback
  ).trim();
}

export function parseMaksekeskusFormMessage(rawBody = "") {
  const params = new URLSearchParams(String(rawBody || ""));
  const jsonText = String(params.get("json") || "").trim();
  const mac = String(params.get("mac") || "").trim();
  if (!jsonText) {
    return {
      jsonText: "",
      mac,
      payload: null,
    };
  }

  try {
    return {
      jsonText,
      mac,
      payload: JSON.parse(jsonText),
    };
  } catch {
    return {
      jsonText,
      mac,
      payload: null,
    };
  }
}

export function verifyMaksekeskusMac(jsonText, receivedMac, secret = MAKSEKESKUS_API_KEY) {
  const payload = String(jsonText || "");
  const signature = String(receivedMac || "").trim().toUpperCase();
  const sharedSecret = String(secret || "").trim();

  if (!sharedSecret) return true;
  if (!payload || !signature) return false;

  const digest = crypto
    .createHash("sha512")
    .update(`${payload}${sharedSecret}`)
    .digest("hex")
    .toUpperCase();

  if (digest.length !== signature.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function createMaksekeskusCheckout({
  providerPaymentId,
  amount,
  currency,
  locale,
  returnUrl,
  cancelUrl,
  webhookUrl,
  customerEmail,
  customerName,
  customerCountry,
  description,
  merchantData,
  ip,
}) {
  const transaction = await createMaksekeskusTransaction({
    providerPaymentId,
    amount,
    currency,
    locale,
    ip,
    returnUrl,
    cancelUrl,
    webhookUrl,
    customerEmail,
    customerName,
    customerCountry,
    description,
    merchantData,
    recurringRequired: false,
  });

  const checkoutUrl = getRedirectCheckoutUrl(transaction.raw);
  if (!checkoutUrl) {
    throw new Error("api.subscription.checkout_create_failed");
  }

  return {
    checkoutUrl,
    transactionId: transaction.transactionId,
    providerPaymentId: transaction.providerPaymentId || providerPaymentId,
    raw: transaction.raw,
  };
}

export async function createMaksekeskusRecurringSetup({
  providerPaymentId,
  amount,
  currency,
  locale,
  returnUrl,
  cancelUrl,
  webhookUrl,
  customerEmail,
  customerName,
  customerCountry,
  description,
  merchantData,
  ip,
}) {
  if (!MAKSEKESKUS_PUBLIC_KEY) {
    throw new Error("api.subscription.recurring_provider_unavailable");
  }

  const transaction = await createMaksekeskusTransaction({
    providerPaymentId,
    amount,
    currency,
    locale,
    ip,
    returnUrl,
    cancelUrl,
    webhookUrl,
    customerEmail,
    customerName,
    customerCountry,
    description,
    merchantData,
    recurringRequired: true,
  });

  return {
    transactionId: transaction.transactionId,
    providerPaymentId: transaction.providerPaymentId || providerPaymentId,
    publishableKey: MAKSEKESKUS_PUBLIC_KEY,
    scriptUrl: getMaksekeskusIframeScriptUrl(),
    raw: transaction.raw,
  };
}

export async function createMaksekeskusRecurringCharge({
  providerPaymentId,
  amount,
  currency,
  recurringToken,
  customerEmail,
  customerName,
  customerCountry,
  locale,
  webhookUrl,
  description,
  merchantData,
  ip,
}) {
  const token = String(recurringToken || "").trim();
  if (!token) {
    throw new Error("api.subscription.recurring_token_missing");
  }

  const transaction = await createMaksekeskusTransaction({
    providerPaymentId,
    amount,
    currency,
    locale,
    ip: ip || MAKSEKESKUS_RECURRING_IP,
    webhookUrl,
    webhookMethod: "POST",
    customerEmail,
    customerName,
    customerCountry,
    description,
    merchantData,
    recurringRequired: false,
  });

  const data = await callMaksekeskusApi(
    `/v1/transactions/${encodeURIComponent(transaction.transactionId)}/payments`,
    {
      method: "POST",
      body: {
        token,
      },
    }
  );

  return {
    transactionId: transaction.transactionId,
    providerPaymentId: getProviderPaymentId(
      data,
      transaction.providerPaymentId || providerPaymentId
    ),
    raw: {
      transaction: transaction.raw,
      payment: data,
    },
  };
}
