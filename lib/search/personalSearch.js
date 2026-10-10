import { openableDocumentWhere } from "@/lib/documents/recordingVisibility";

const MAX_QUERY_LENGTH = 120;
const RESULTS_PER_KIND = 8;
const SEARCH_KINDS = Object.freeze(["conversation", "journey", "document"]);
const EXHAUSTED_CURSOR = "__done__";

/* Kursor on rea id. Kuju katab kõik, mida need kolm tabelit id-na kannavad: cuid,
   UUID, Teekonna `jrn_…` ja vestluse kliendi antud id (sama märgistik, mida lubab
   lib/chat/routeServerUtils.js `isPlausibleChatId`). Kõik muu (nullbait, tühikud,
   jutumärgid, liiga pikk tekst) ei jõua andmebaasi: allikas algab siis esimesest
   lehest. Alampiiri pikkusele ei ole: päris rea id tagasilükkamine paneks „Näita
   rohkem” sama lehte kordama, lühike id andmebaasile ohtu ei tee. */
const CURSOR_ID_SHAPE = /^[A-Za-z0-9._:+-]{1,200}$/;

/* Pealkirjad, mille paneb vestlusele rakendus ise (lib/chat/m4PilotServer.js), mitte
   inimene. Otsing neid pealkirjaks ei loe: muidu loetleks „sisepiloot” või lihtsalt
   „pi” kõik vestlused ühe ja sama sisemise nime all. Test hoiab loendit selle faili
   kirjutatud pealkirjadega kooskõlas. */
export const APP_GIVEN_CONVERSATION_TITLES = Object.freeze(["M4 sisepiloot"]);

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

export function isPersonalSearchCursorValue(value) {
  return typeof value === "string" && (value === EXHAUSTED_CURSOR || CURSOR_ID_SHAPE.test(value));
}

export function normalizePersonalSearchCursor(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return Object.fromEntries(SEARCH_KINDS.map((kind) => {
    const value = source[kind];
    return [kind, isPersonalSearchCursorValue(value) ? value : null];
  }));
}

/* Prisma `contains` paneb teksti LIKE-mustrisse muutmata ja seal on `%` ning `_`
   metamärgid: otsisõna „%” vastas igale pealkirjale ja „50%” leidis rohkem, kui
   kirjutati. Postgres loeb kaldkriipsu paomärgiks, nii et otsitakse täpselt seda
   teksti, mis väljale kirjutati. */
export function escapeLikePattern(value) {
  return String(value ?? "").replace(/[\\%_]/g, "\\$&");
}

function titleWhere(query, fields) {
  if (!query) return {};
  const contains = escapeLikePattern(query);
  return {
    OR: fields.map((field) => ({
      [field]: { contains, mode: "insensitive" }
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
 *
 * Kui ükski loetud allikas ei vastanud, ei ole see „vasteid ei leitud”: funktsioon
 * viskab vea ja marsruut ütleb, et otsingut ei saanud teha.
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
      read: () => prisma.conversation.findMany({
        where: {
          userId: ownerId,
          archivedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          AND: [
            titleWhere(normalized.query, ["title"]),
            { NOT: { title: { in: [...APP_GIVEN_CONVERSATION_TITLES] } } }
          ]
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
      read: () => prisma.journey.findMany({
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
      /* Rida viib dokumendi lehele: tingimus on sama, millega see leht dokumendi avab
         (kõrvale pandud või kustutamisel salvestis ja mitteaktiivne välitöö manus on peidus). */
      read: () => prisma.userDocument.findMany({
        where: { ownerId, ...openableDocumentWhere(), AND: [titleWhere(normalized.query, ["title", "originalName"])] },
        select: { id: true, title: true, originalName: true, kind: true, updatedAt: true },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take,
        ...cursorArgs(cursors.document)
      })
    }
  ];

  /* Lõpuni loetud allikat uuesti ei küsita. */
  const asked = sources.filter((source) => cursors[source.kind] !== EXHAUSTED_CURSOR);
  const settled = await Promise.allSettled(asked.map((source) => source.read()));
  const unavailableKinds = [];
  const nextCursor = Object.fromEntries(SEARCH_KINDS.map((kind) => [kind, EXHAUSTED_CURSOR]));
  const results = [];
  let firstFailure = null;

  settled.forEach((outcome, index) => {
    const source = asked[index];
    if (outcome.status === "rejected") {
      if (isAccessBoundaryError(outcome.reason)) throw outcome.reason;
      unavailableKinds.push(source.kind);
      firstFailure = firstFailure || outcome.reason;
      /* Lugemata jäänud allikas jätkab järgmisel korral sealt, kus ta oli (null = algusest). */
      nextCursor[source.kind] = cursors[source.kind];
      return;
    }
    const rows = Array.isArray(outcome.value) ? outcome.value : [];
    const pageRows = rows.slice(0, RESULTS_PER_KIND);
    if (rows.length > RESULTS_PER_KIND && pageRows.length) {
      nextCursor[source.kind] = text(pageRows.at(-1)?.id) || null;
    }
    results.push(...pageRows.map(source.map));
  });

  if (asked.length && unavailableKinds.length === asked.length) {
    const error = new Error("PERSONAL_SEARCH_ALL_SOURCES_UNAVAILABLE");
    error.cause = firstFailure;
    throw error;
  }

  results.sort((left, right) => {
    const byDate = String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
    return byDate || `${left.kind}:${left.href}`.localeCompare(`${right.kind}:${right.href}`);
  });

  return {
    results,
    partial: unavailableKinds.length > 0,
    unavailableKinds,
    pagination: {
      /* Lugemata jäänud allikas on samuti „veel on”: muidu ei saaks seda uuesti küsida
         teisiti kui uue otsinguga, mis viskab juba laetud read minema. */
      hasMore: unavailableKinds.length > 0
        || Object.values(nextCursor).some((value) => Boolean(value) && value !== EXHAUSTED_CURSOR),
      nextCursor
    }
  };
}

export const PERSONAL_SEARCH_LIMITS = Object.freeze({
  maxQueryLength: MAX_QUERY_LENGTH,
  resultsPerKind: RESULTS_PER_KIND
});
