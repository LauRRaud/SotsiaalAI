const MAX_QUERY_LENGTH = 120;
const RESULTS_PER_KIND = 8;
const SEARCH_KINDS = Object.freeze(["conversation", "journey", "document"]);
const EXHAUSTED_CURSOR = "__done__";

function text(value) {
  return String(value || "").trim();
}

function iso(value) {
  return value?.toISOString?.() || value || null;
}

export function normalizePersonalSearchQuery(raw) {
  const query = text(raw).replace(/\s+/g, " ");
  if (query.length > MAX_QUERY_LENGTH) return { ok: false, query: "" };
  return { ok: true, query };
}

export function normalizePersonalSearchCursor(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return Object.fromEntries(SEARCH_KINDS.map((kind) => {
    const value = text(source[kind]);
    return [kind, value && value.length <= 200 ? value : null];
  }));
}

function titleWhere(query, fields) {
  if (!query) return {};
  return {
    OR: fields.map((field) => ({
      [field]: { contains: query, mode: "insensitive" }
    }))
  };
}

function toConversationResult(row) {
  return {
    kind: "conversation",
    title: text(row.title) || null,
    status: row.isPinned ? "PINNED" : "ACTIVE",
    updatedAt: iso(row.lastActivityAt),
    href: `/vestlus?conversation=${encodeURIComponent(row.id)}`
  };
}

function toJourneyResult(row) {
  return {
    kind: "journey",
    title: text(row.title) || null,
    status: text(row.status) || "ACTIVE",
    updatedAt: iso(row.updatedAt),
    href: `/teekond/${encodeURIComponent(row.id)}`
  };
}

function toDocumentResult(row) {
  return {
    kind: "document",
    title: text(row.title) || text(row.originalName) || null,
    status: text(row.kind) || "MATERIAL",
    updatedAt: iso(row.updatedAt),
    href: `/documents/${encodeURIComponent(row.id)}`
  };
}

function emptyResponse() {
  return {
    results: [],
    partial: false,
    unavailableKinds: [],
    pagination: {
      hasMore: false,
      nextCursor: normalizePersonalSearchCursor(null)
    }
  };
}

function cursorArgs(cursor) {
  return cursor ? { cursor: { id: cursor }, skip: 1 } : {};
}

function isAccessBoundaryError(error) {
  const status = Number(error?.status || 0);
  const code = String(error?.code || error?.message || "").toUpperCase();
  return status === 401 || status === 403 || code === "UNAUTHORIZED" || code === "FORBIDDEN";
}

/**
 * Reads only current-user rows and emits an intentionally small public shape.
 * Each source owns its cursor; one unavailable source is named as partial while
 * authentication/authorization failures still reject the whole request.
 */
export async function searchPersonalObjects({
  prisma,
  userId,
  query,
  cursor = null,
  now = new Date()
} = {}) {
  const ownerId = text(userId);
  if (!ownerId) return emptyResponse();
  const normalized = normalizePersonalSearchQuery(query);
  if (!normalized.ok || !normalized.query) return emptyResponse();
  const cursors = normalizePersonalSearchCursor(cursor);
  const take = RESULTS_PER_KIND + 1;

  const sources = [
    {
      kind: "conversation",
      map: toConversationResult,
      promise: cursors.conversation === EXHAUSTED_CURSOR ? Promise.resolve([]) : prisma.conversation.findMany({
        where: {
          userId: ownerId,
          archivedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          AND: [titleWhere(normalized.query, ["title"])]
        },
        select: { id: true, title: true, isPinned: true, lastActivityAt: true },
        orderBy: [{ isPinned: "desc" }, { lastActivityAt: "desc" }, { id: "asc" }],
        take,
        ...cursorArgs(cursors.conversation)
      })
    },
    {
      kind: "journey",
      map: toJourneyResult,
      promise: cursors.journey === EXHAUSTED_CURSOR ? Promise.resolve([]) : prisma.journey.findMany({
        where: { ownerUserId: ownerId, AND: [titleWhere(normalized.query, ["title"])] },
        select: { id: true, title: true, status: true, updatedAt: true },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take,
        ...cursorArgs(cursors.journey)
      })
    },
    {
      kind: "document",
      map: toDocumentResult,
      promise: cursors.document === EXHAUSTED_CURSOR ? Promise.resolve([]) : prisma.userDocument.findMany({
        where: { ownerId, AND: [titleWhere(normalized.query, ["title", "originalName"])] },
        select: { id: true, title: true, originalName: true, kind: true, updatedAt: true },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take,
        ...cursorArgs(cursors.document)
      })
    }
  ];

  const settled = await Promise.allSettled(sources.map((source) => source.promise));
  const unavailableKinds = [];
  const nextCursor = normalizePersonalSearchCursor(null);
  const results = [];

  settled.forEach((outcome, index) => {
    const source = sources[index];
    if (outcome.status === "rejected") {
      if (isAccessBoundaryError(outcome.reason)) throw outcome.reason;
      unavailableKinds.push(source.kind);
      return;
    }
    const rows = Array.isArray(outcome.value) ? outcome.value : [];
    const pageRows = rows.slice(0, RESULTS_PER_KIND);
    if (rows.length > RESULTS_PER_KIND && pageRows.length) {
      nextCursor[source.kind] = text(pageRows.at(-1)?.id) || null;
    } else {
      nextCursor[source.kind] = EXHAUSTED_CURSOR;
    }
    results.push(...pageRows.map(source.map));
  });

  results.sort((left, right) => {
    const byDate = String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
    return byDate || `${left.kind}:${left.href}`.localeCompare(`${right.kind}:${right.href}`);
  });

  return {
    results,
    partial: unavailableKinds.length > 0,
    unavailableKinds,
    pagination: {
      hasMore: Object.values(nextCursor).some((value) => Boolean(value) && value !== EXHAUSTED_CURSOR),
      nextCursor
    }
  };
}

export const PERSONAL_SEARCH_LIMITS = Object.freeze({
  maxQueryLength: MAX_QUERY_LENGTH,
  resultsPerKind: RESULTS_PER_KIND
});
