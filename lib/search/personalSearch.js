const MAX_QUERY_LENGTH = 120;
const RESULTS_PER_KIND = 8;

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
    title: text(row.title) || "Vestlus",
    status: row.isPinned ? "PINNED" : "ACTIVE",
    updatedAt: iso(row.lastActivityAt),
    href: `/vestlus?conversation=${encodeURIComponent(row.id)}`
  };
}

function toJourneyResult(row) {
  return {
    kind: "journey",
    title: text(row.title) || "Teekond",
    status: text(row.status) || "ACTIVE",
    updatedAt: iso(row.updatedAt),
    href: `/teekond/${encodeURIComponent(row.id)}`
  };
}

function toDocumentResult(row) {
  return {
    kind: "document",
    title: text(row.title) || text(row.originalName) || "Dokument",
    status: text(row.kind) || "MATERIAL",
    updatedAt: iso(row.updatedAt),
    // No safe per-document deep view exists: neither /documents nor /dokreziim
    // honours a document id, and there is no per-item anchor. Rather than invent
    // a dead ?document= param, every document result opens the canonical
    // owner-scoped documents surface (which itself routes CLIENT users to their
    // own document mode). The href is a constant, never built from user input.
    href: "/documents"
  };
}

/**
 * Reads only current-user rows and emits the intentionally small public shape.
 * It never selects or returns conversation messages, document content, or
 * Journey summaries.
 */
export async function searchPersonalObjects({ prisma, userId, query, now = new Date() } = {}) {
  const ownerId = text(userId);
  if (!ownerId) return [];
  const normalized = normalizePersonalSearchQuery(query);
  if (!normalized.ok || !normalized.query) return [];

  const [conversations, journeys, documents] = await Promise.all([
    prisma.conversation.findMany({
      where: {
        userId: ownerId,
        archivedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        AND: [titleWhere(normalized.query, ["title"])]
      },
      select: { id: true, title: true, isPinned: true, lastActivityAt: true },
      orderBy: [{ isPinned: "desc" }, { lastActivityAt: "desc" }],
      take: RESULTS_PER_KIND
    }),
    prisma.journey.findMany({
      where: { ownerUserId: ownerId, AND: [titleWhere(normalized.query, ["title"])] },
      select: { id: true, title: true, status: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: RESULTS_PER_KIND
    }),
    prisma.userDocument.findMany({
      where: { ownerId, AND: [titleWhere(normalized.query, ["title", "originalName"])] },
      select: { id: true, title: true, originalName: true, kind: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: RESULTS_PER_KIND
    })
  ]);

  return [
    ...conversations.map(toConversationResult),
    ...journeys.map(toJourneyResult),
    ...documents.map(toDocumentResult)
  ].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

export const PERSONAL_SEARCH_LIMITS = Object.freeze({
  maxQueryLength: MAX_QUERY_LENGTH,
  resultsPerKind: RESULTS_PER_KIND
});
