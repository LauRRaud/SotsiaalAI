export const USAGE_METRICS = Object.freeze([
  "CHAT_ASSISTANT_REPLY",
  "DOCUMENT_GENERATE",
  "DOCUMENT_REFINE",
  "FILE_ANALYZE",
  "DEEP_RESEARCH_RUN",
  "RAG_SEARCH",
  "STT_SECONDS",
  "TTS_CHARS",
  "STORAGE_BYTES"
]);

export const USAGE_PERIODS = Object.freeze(["DAILY", "WEEKLY", "MONTHLY", "LIFETIME"]);

function bigintOrNull(value, field) {
  if (value == null || value === "") return null;
  try {
    const parsed = BigInt(value);
    if (parsed < 0n) throw new Error();
    return parsed;
  } catch {
    throw new TypeError(`${field} must be a non-negative integer`);
  }
}

export function normalizeEntitlementInput(value = {}) {
  const metric = String(value.metric || "").trim().toUpperCase();
  const period = String(value.period || "").trim().toUpperCase();
  if (!USAGE_METRICS.includes(metric)) throw new TypeError("Unsupported usage metric");
  if (!USAGE_PERIODS.includes(period)) throw new TypeError("Unsupported usage period");
  const enabled = value.enabled !== false;
  const hardLimit = bigintOrNull(value.hardLimit, "hardLimit");
  const softLimit = bigintOrNull(value.softLimit, "softLimit");
  if (enabled && (hardLimit == null || hardLimit <= 0n)) {
    throw new TypeError("Enabled entitlement requires a positive hardLimit");
  }
  if (softLimit != null && hardLimit != null && softLimit > hardLimit) {
    throw new TypeError("softLimit cannot exceed hardLimit");
  }
  return { metric, period, enabled, softLimit, hardLimit };
}

export function normalizeReason(value) {
  const reason = String(value || "").trim();
  if (reason.length < 3 || reason.length > 500) {
    throw new TypeError("Reason must contain 3-500 characters");
  }
  return reason;
}

export function normalizePrice(value) {
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0 || price > 100000) {
    throw new TypeError("Invalid plan price");
  }
  return price.toFixed(2);
}
