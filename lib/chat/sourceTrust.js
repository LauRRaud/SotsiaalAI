const CHECKED_AT_ALIASES = Object.freeze([
  "checkedAt",
  "checked_at",
  "last_checked",
  "lastChecked",
  "web_checked_at",
  "webCheckedAt"
]);

function firstValue(source, aliases) {
  for (const key of aliases) {
    const direct = source?.[key];
    if (direct !== undefined && direct !== null && String(direct).trim()) return direct;
    const nested = source?.metadata?.[key];
    if (nested !== undefined && nested !== null && String(nested).trim()) return nested;
  }
  return null;
}

function parseTrustedDate(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T00:00:00.000Z`)
    : new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
}

function normalizedSourceType(source) {
  return String(
    source?.source_type || source?.sourceType || source?.origin || source?.type || "unknown"
  ).trim().toLowerCase() || "unknown";
}

function normalizedSourceStatus(source) {
  return String(source?.source_status || source?.sourceStatus || "").trim().toLowerCase();
}

export function normalizeSourceTrust(source = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const checkedDate = parseTrustedDate(firstValue(source, CHECKED_AT_ALIASES));
  const validTo = parseTrustedDate(firstValue(source, ["valid_to", "validTo"]));
  const sourceType = normalizedSourceType(source);
  const sourceStatus = normalizedSourceStatus(source);
  const historical = source?.historical === true || sourceType === "historical_source";
  const inactive = ["inactive", "archived"].includes(sourceStatus);
  const expired = validTo ? validTo.getTime() < now.getTime() : false;
  const futureCheckedAt = checkedDate ? checkedDate.getTime() > now.getTime() + 86_400_000 : false;
  const maxAgeDaysRaw = Number(source?.max_age_days ?? source?.maxAgeDays ?? options.maxAgeDays ?? 180);
  const maxAgeDays = Number.isFinite(maxAgeDaysRaw) && maxAgeDaysRaw > 0 ? maxAgeDaysRaw : 180;
  const ageDays = checkedDate && !futureCheckedAt
    ? Math.max(0, Math.floor((now.getTime() - checkedDate.getTime()) / 86_400_000))
    : null;

  let freshness = "unknown";
  let warning = null;
  if (inactive) {
    freshness = "inactive";
    warning = "inactive";
  } else if (historical) {
    freshness = "historical";
    warning = "historical";
  } else if (expired) {
    freshness = "stale";
    warning = "expired";
  } else if (checkedDate && !futureCheckedAt) {
    freshness = ageDays > maxAgeDays ? "stale" : "fresh";
    if (freshness === "stale") warning = "stale";
  }

  return {
    source_type: sourceType,
    checked_at: checkedDate && !futureCheckedAt ? checkedDate.toISOString() : null,
    freshness,
    warning,
    age_days: ageDays
  };
}

export function serializeDisplayedSourceTrust(source = {}, sourceId, options = {}) {
  const trust = normalizeSourceTrust(source, options);
  return {
    ...source,
    source_id: String(sourceId || source?.source_id || source?.sourceId || "").trim(),
    source_trust_type: trust.source_type,
    source_checked_at: trust.checked_at,
    source_freshness: trust.freshness,
    ...(trust.warning ? { source_warning: trust.warning } : {})
  };
}

export { CHECKED_AT_ALIASES };
