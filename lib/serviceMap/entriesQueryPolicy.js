function normalize(value) {
  return String(value || "").trim().toLocaleLowerCase("et");
}

export function serviceMapQueryFingerprint(query = {}) {
  return JSON.stringify([
    normalize(query.keyword), normalize(query.municipalityId), normalize(query.municipalityName),
    normalize(query.county), normalize(query.type),
    query.includeUnlocated === true, query.includeNeedsReview === true
  ]);
}

export function encodeServiceMapCursor(position, query = {}) {
  return Buffer.from(JSON.stringify({ v: 1, f: serviceMapQueryFingerprint(query), ...position }), "utf8").toString("base64url");
}

export function decodeServiceMapCursor(value, query = {}) {
  if (!value) return null;
  try {
    const decoded = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    if (decoded?.v !== 1 || decoded?.f !== serviceMapQueryFingerprint(query) || !decoded?.id) return null;
    const help = ["HELP_REQUEST", "HELP_OFFER", "HELP_LISTINGS"].includes(String(query.type || "").toUpperCase());
    if (help && (decoded.kind !== "help" || !decoded.updatedAt)) return null;
    if (!help && (decoded.kind !== "service" || !decoded.title)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function readServiceMapEntriesQuery(requestOrUrl, options = {}) {
  const url = new URL(typeof requestOrUrl === "string" ? requestOrUrl : requestOrUrl.url);
  const canPreviewReviewEntries = options.canPreviewReviewEntries === true;
  const requestedReviewPreview = url.searchParams.get("includeNeedsReview") === "1";
  const requestedUnlocatedPreview = url.searchParams.get("includeUnlocated") === "1";

  const query = {
    keyword: url.searchParams.get("q") || url.searchParams.get("keyword") || "",
    municipalityId: url.searchParams.get("municipalityId") || "",
    municipalityName: url.searchParams.get("municipality") || url.searchParams.get("municipalityName") || "",
    county: url.searchParams.get("county") || "",
    type: url.searchParams.get("type") || "",
    includeUnlocated: canPreviewReviewEntries && requestedUnlocatedPreview,
    includeNeedsReview: canPreviewReviewEntries && requestedReviewPreview,
    limit: Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 24, 100)),
    cursorRaw: url.searchParams.get("cursor") || ""
  };
  query.cursor = decodeServiceMapCursor(query.cursorRaw, query);
  query.invalidCursor = Boolean(query.cursorRaw && !query.cursor);
  query.paged = true;
  return query;
}
