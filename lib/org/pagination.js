import { badRequest } from "./errors.js";

/**
 * Cursor on läbipaistmatu transpordiväärtus, mitte õigustõend. Skoop rakendub
 * päringus endiselt eraldi; cursor ütleb ainult, millisest reast jätkata.
 */
export function encodePageCursor(parts) {
  return Buffer.from(JSON.stringify(parts), "utf8").toString("base64url");
}

export function decodePageCursor(value, { dateKeys = [], stringKeys = [] } = {}) {
  const encoded = String(value || "").trim();
  if (!encoded) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("shape");

    const result = {};
    for (const key of stringKeys) {
      const text = String(parsed[key] || "").trim();
      if (!text || text.length > 500) throw new Error(`string:${key}`);
      result[key] = text;
    }
    for (const key of dateKeys) {
      const date = new Date(parsed[key]);
      if (Number.isNaN(date.getTime())) throw new Error(`date:${key}`);
      result[key] = date;
    }
    return result;
  } catch {
    throw badRequest("org.errors.invalid_cursor");
  }
}

export function normalizePageSize(value, fallback = 100, maximum = 200) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), maximum);
}

/** Prisma `where` stabiilse kahaneva liitjärjestuse järgmise lehe jaoks. */
export function descendingCursorWhere(cursor, keys) {
  if (!cursor) return null;
  return {
    OR: keys.map((key, index) => ({
      ...Object.fromEntries(keys.slice(0, index).map((previous) => [previous, cursor[previous]])),
      [key]: { lt: cursor[key] }
    }))
  };
}

/** Võtab ühe lisarea ainult `hasMore` tõendamiseks ja peidab cursori sisu. */
export function toCursorPage(rows, pageSize, cursorParts) {
  const hasMore = rows.length > pageSize;
  const items = hasMore ? rows.slice(0, pageSize) : rows;
  return {
    items,
    hasMore,
    nextCursor: hasMore && items.length ? encodePageCursor(cursorParts(items.at(-1))) : null
  };
}
