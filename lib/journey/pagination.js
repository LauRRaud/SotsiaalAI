import { JOURNEY_PAGE_LIMITS } from "./constants.js";

function publicError(message, status = 400, code = "JOURNEY_CURSOR_INVALID") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export function normalizeJourneyPageLimit(value, fallback = JOURNEY_PAGE_LIMITS.default) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw publicError("journeys.errors.page_limit_invalid");
  }
  return Math.min(parsed, JOURNEY_PAGE_LIMITS.maximum);
}

export function encodeJourneyCursor(row, field = "updatedAt") {
  const date = row?.[field] instanceof Date ? row[field] : new Date(row?.[field]);
  const id = String(row?.id || "").trim();
  if (!id || !Number.isFinite(date.getTime())) {
    throw publicError("journeys.errors.cursor_invalid");
  }
  return Buffer.from(JSON.stringify([date.toISOString(), id]), "utf8").toString("base64url");
}

export function decodeJourneyCursor(value) {
  try {
    const decoded = JSON.parse(Buffer.from(String(value || ""), "base64url").toString("utf8"));
    if (!Array.isArray(decoded) || decoded.length !== 2) throw new Error("shape");
    const date = new Date(decoded[0]);
    const id = String(decoded[1] || "").trim();
    if (!id || !Number.isFinite(date.getTime())) throw new Error("value");
    return { value: date, id };
  } catch {
    throw publicError("journeys.errors.cursor_invalid");
  }
}

export function journeyCursorWhere(cursor, field = "updatedAt") {
  if (!cursor) return null;
  const decoded = decodeJourneyCursor(cursor);
  return {
    OR: [
      { [field]: { lt: decoded.value } },
      { [field]: decoded.value, id: { lt: decoded.id } }
    ]
  };
}

export function makeJourneyPage(rows, limit, field = "updatedAt", totalCount = null) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return {
    items,
    totalCount,
    hasMore,
    nextCursor: hasMore && items.length ? encodeJourneyCursor(items.at(-1), field) : null
  };
}
