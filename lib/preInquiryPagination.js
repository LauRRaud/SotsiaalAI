const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 250;

function cursorError() {
  const error = new Error("pre_inquiries.errors.invalid_cursor");
  error.status = 400;
  return error;
}

export function normalizePreInquiryPageLimit(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(1, Math.min(parsed, MAX_LIMIT)) : DEFAULT_LIMIT;
}

export function encodePreInquiryCursor(row) {
  const updatedAt = new Date(row?.updatedAt);
  const id = String(row?.id || "").trim();
  if (!id || !Number.isFinite(updatedAt.getTime())) throw cursorError();
  return Buffer.from(JSON.stringify({ updatedAt: updatedAt.toISOString(), id }), "utf8").toString("base64url");
}

export function decodePreInquiryCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    const updatedAt = new Date(parsed?.updatedAt);
    const id = String(parsed?.id || "").trim();
    if (!id || !Number.isFinite(updatedAt.getTime())) throw cursorError();
    return { updatedAt, id };
  } catch {
    throw cursorError();
  }
}

export function preInquiryCursorWhere(cursor) {
  if (!cursor) return null;
  return {
    OR: [
      { updatedAt: { lt: cursor.updatedAt } },
      { updatedAt: cursor.updatedAt, id: { lt: cursor.id } }
    ]
  };
}
