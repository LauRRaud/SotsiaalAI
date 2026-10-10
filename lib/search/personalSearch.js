import { openableDocumentWhere } from "@/lib/documents/recordingVisibility";

const MAX_QUERY_LENGTH = 120;
/* Üks leht on 20 rida KOKKU, mitte allika kohta: read tulevad kõigist allikatest
   ühes kuupäevajärjekorras ja „Näita rohkem” jätkab sealt, kus loend lõppes. */
const PAGE_SIZE = 20;
const EXCERPT_LENGTH = 96;
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

/* Juhtmärgid (ka nullbait) ei ole otsisõna osa: Postgres lükkab nullbaidiga
   teksti tagasi ja kogu otsing vastaks veaga. */
function withoutControlCharacters(value) {
  let out = "";
  for (const char of String(value || "")) {
    const code = char.codePointAt(0);
    out += code < 32 || code === 127 ? " " : char;
  }
  return out;
}

export function normalizePersonalSearchQuery(raw) {
  const query = withoutControlCharacters(raw).replace(/\s+/g, " ").trim();
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

function containsFilter(query) {
  return { contains: escapeLikePattern(query), mode: "insensitive" };
}

function titleWhere(query, fields) {
  if (!query) return {};
  const contains = containsFilter(query);
  return { OR: fields.map((field) => ({ [field]: contains })) };
}

/* Vestlust otsitakse sealt, kust vestluste loend seda otsib (lib/chat/conversationSearch.js):
   pealkirjast, kokkuvõttest ja sõnumite tekstist. Inimene ise vestlusele pealkirja ei
   pane ja loendis kannab vestlus nime, mis tuleb sõnumist: ainult pealkirja järgi
   otsides ei leiaks ta oma vestlust ühegi sõnaga, mida ta mäletab. Rakenduse enda
   pandud pealkiri pealkirjaks ei loe. */
function conversationWhere(query) {
  if (!query) return {};
  const contains = containsFilter(query);
  return {
    OR: [
      { AND: [{ title: contains }, { NOT: { title: { in: [...APP_GIVEN_CONVERSATION_TITLES] } } }] },
      { summary: contains },
      { messages: { some: { content: contains } } }
    ]
  };
}

/* Sõnumi tekst loendi reale: vormindusmärgid ja reavahetused välja. */
function plainText(value) {
  return String(value || "")
    .replace(/[*`]+/g, "")
    .replace(/^\s{0,3}(?:#{1,6}|>+)\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function foldedIndex(haystack, needle) {
  if (!needle) return -1;
  return haystack.toLowerCase().indexOf(needle.toLowerCase());
}

/**
 * Lõik tekstist otsisõna ümbert: rida, mille järgi inimene oma vestluse ära tunneb.
 * Lõige käib sõna piirilt ja lõigatud ots saab kolm punkti. Kui sõna tekstist ei
 * leia (andmebaas võrdleb tähti teisiti kui brauser), antakse teksti algus.
 */
export function matchExcerpt(content, query, max = EXCERPT_LENGTH) {
  const plain = plainText(content);
  if (!plain) return "";
  if (plain.length <= max) return plain;
  const needle = text(query);
  const found = foldedIndex(plain, needle);
  const at = found >= 0 && found < plain.length ? found : 0;
  let start = Math.max(0, at - Math.floor(Math.max(0, max - needle.length) / 3));
  if (start > 0) {
    const space = plain.indexOf(" ", start);
    if (space >= 0 && space < at) start = space + 1;
  }
  let end = Math.min(plain.length, start + max);
  if (end < plain.length) {
    const space = plain.lastIndexOf(" ", end);
    if (space > at + needle.length) end = space;
  }
  return `${start > 0 ? "…" : ""}${plain.slice(start, end).trim()}${end < plain.length ? "…" : ""}`;
}

function toConversationResult(row, query) {
  const stored = text(row.title);
  const title = stored && !APP_GIVEN_CONVERSATION_TITLES.includes(stored) ? stored : null;
  /* Kui otsisõna on pealkirjas endas, ei ole lõiku vaja; muidu näitab lõik, kus
     vestluses see sõna on. */
  const inTitle = Boolean(title) && foldedIndex(title, query) >= 0;
  const excerpt = inTitle ? "" : matchExcerpt(row.messages?.[0]?.content, query) || matchExcerpt(row.summary, query);
  return {
    kind: "conversation",
    title,
    excerpt: excerpt || null,
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

function stamp(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

/**
 * Paneb allikate read ühte kuupäevajärjekorda ja võtab neist ühe lehe. Iga allika
 * read on juba oma järjekorras (uuem enne) ja seda järjekorda ei muudeta: võetakse
 * alati see allikas, mille järgmine rida on kõige uuem (võrdse aja korral allikate
 * kindlas järjekorras). Nii on iga allika võetud read tema järjekorra algus ja
 * järgmine leht saab jätkata viimasest võetud reast.
 */
function takeNewestPage(batches, size) {
  const taken = [];
  while (taken.length < size) {
    let best = null;
    for (const batch of batches) {
      if (batch.used >= batch.rows.length) continue;
      const time = stamp(batch.at(batch.rows[batch.used]));
      if (!best || time > best.time) best = { batch, time };
    }
    if (!best) break;
    taken.push(best.batch.map(best.batch.rows[best.batch.used]));
    best.batch.used += 1;
  }
  return taken;
}

/**
 * Reads only current-user rows and emits an intentionally small public shape.
 * Each source owns its cursor; one unavailable source is named as partial while
 * authentication/authorization failures still reject the whole request.
 *
 * Leht on üks kuupäevajärjekord üle kõigi allikate. Igalt allikalt küsitakse lehe
 * jagu ridu ja üks peale: nii jääb igast täis vastanud allikast vähemalt üks rida
 * võtmata ja ükski veel lugemata rida ei saa olla uuem kui lehele võetud read.
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
  const take = PAGE_SIZE + 1;

  const sources = [
    {
      kind: "conversation",
      map: (row) => toConversationResult(row, normalized.query),
      at: (row) => row.lastActivityAt,
      read: () => prisma.conversation.findMany({
        where: {
          userId: ownerId,
          archivedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          AND: [conversationWhere(normalized.query)]
        },
        select: {
          id: true,
          title: true,
          summary: true,
          isPinned: true,
          lastActivityAt: true,
          /* Uusim sõnum, milles otsisõna on: sellest tuleb rea lõik. */
          messages: {
            where: { content: containsFilter(normalized.query) },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { content: true }
          }
        },
        orderBy: [{ lastActivityAt: "desc" }, { id: "asc" }],
        take,
        ...cursorArgs(cursors.conversation)
      })
    },
    {
      kind: "journey",
      map: toJourneyResult,
      at: (row) => row.updatedAt,
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
      at: (row) => row.updatedAt,
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
  const batches = [];
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
    batches.push({ kind: source.kind, map: source.map, at: source.at, rows, full: rows.length >= take, used: 0 });
  });

  if (asked.length && unavailableKinds.length === asked.length) {
    const error = new Error("PERSONAL_SEARCH_ALL_SOURCES_UNAVAILABLE");
    error.cause = firstFailure;
    throw error;
  }

  const results = takeNewestPage(batches, PAGE_SIZE);
  let pending = false;
  for (const batch of batches) {
    /* Allikal on veel ridu, kui mõni loetud rida jäi lehele võtmata või kui ta vastas
       täis lehega (siis võib tal ridu olla ka loetutest edasi). */
    if (batch.used >= batch.rows.length && !batch.full) continue;
    pending = true;
    /* Jätkatakse viimasest lehele võetud reast; kui sellest allikast ei võetud
       midagi, jääb ta sinna, kus oli. */
    nextCursor[batch.kind] = batch.used > 0 ? text(batch.rows[batch.used - 1]?.id) || null : cursors[batch.kind];
  }

  return {
    results,
    partial: unavailableKinds.length > 0,
    unavailableKinds,
    pagination: {
      /* Lugemata jäänud allikas on samuti „veel on”: muidu ei saaks seda uuesti küsida
         teisiti kui uue otsinguga, mis viskab juba laetud read minema. */
      hasMore: pending || unavailableKinds.length > 0,
      nextCursor
    }
  };
}

export const PERSONAL_SEARCH_LIMITS = Object.freeze({
  maxQueryLength: MAX_QUERY_LENGTH,
  pageSize: PAGE_SIZE,
  excerptLength: EXCERPT_LENGTH
});
