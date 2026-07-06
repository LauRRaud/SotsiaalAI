import { loadMunicipalitySeedEntries, normalizeMunicipalitySearchText } from "@/lib/help/municipalityData";
import { geocodePlace } from "@/lib/help/geocoding";
import { findLocationAliasMatches } from "@/lib/help/locationAliases";

export function normalizeIntentText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .trim();
}

export function normalizeEphemeralChunk(text, maxChars) {
  const normalized = String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!normalized) return "";
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(1, maxChars - 3)).trimEnd()}...`;
}

function tokenizeForChunkSearch(text = "") {
  const tokens = String(text || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 3);
  return Array.from(new Set(tokens)).slice(0, 28);
}

function extractQueryPhrases(text = "") {
  const parts = String(text || "").toLowerCase().split(/[.?!\n;:]+/).map((s) => s.trim()).filter((s) => s.length >= 16);
  return Array.from(new Set(parts)).slice(0, 4);
}

export function extractRecentUserText(history = [], maxItems = 2) {
  if (!Array.isArray(history) || !history.length) return [];
  const picked = [];
  for (let i = history.length - 1; i >= 0 && picked.length < maxItems; i -= 1) {
    const msg = history[i];
    const role = String(msg?.role || "").toLowerCase();
    if (!(role === "user" || role === "client")) continue;
    const text = String(msg?.text || msg?.content || "").trim();
    if (!text) continue;
    picked.push(text.slice(0, 700));
  }
  return picked.reverse();
}

export function isMunicipalityDependentSocialHelpQuestion(message = "") {
  const normalized = normalizeIntentText(message);
  if (!normalized) return false;
  const mentionsMunicipalityLevel = /\b(kov|omavalitsus|omavalitsuse|vald|valla|vallalt|linna|linnalt|rahvastikuregistr|elukoha|elukohajarg)\b/.test(normalized);
  const mentionsSocialHelp = /\b(abi|sotsiaal|hoolekan|hooldus|koduteenus|koduhooldus|toimetulek|toime|taotle|taotlus|teenus|toetus|osakond)\b/.test(normalized);
  return mentionsMunicipalityLevel && mentionsSocialHelp;
}

export function getDocContextBudget(role = "CLIENT", combineSources = false, budgets = {}) {
  const {
    clientChars = 1800,
    clientCombinedChars = 1200,
    workerChars = 2600,
    workerCombinedChars = 1600,
    clientMaxChunks = 4,
    workerMaxChunks = 6
  } = budgets;
  const worker = role === "SOCIAL_WORKER";
  return {
    charBudget: worker
      ? combineSources ? workerCombinedChars : workerChars
      : combineSources ? clientCombinedChars : clientChars,
    maxChunks: worker ? workerMaxChunks : clientMaxChunks
  };
}

export function buildEphemeralDocContext(ephemeralChunks = [], options = {}) {
  const {
    maxChunks = 4,
    charBudget = 1800,
    maxInputChunks = 80,
    chunkCharsMax = 1800,
    queryText = ""
  } = options;
  const chunks = Array.isArray(ephemeralChunks) ? ephemeralChunks : [];
  if (!chunks.length) {
    return {
      text: "",
      usedChars: 0,
      usedChunks: 0
    };
  }

  const normalized = [];
  const seen = new Set();
  for (const raw of chunks.slice(0, maxInputChunks)) {
    const cleaned = normalizeEphemeralChunk(raw, chunkCharsMax);
    if (!cleaned) continue;
    const dedupeKey = cleaned.slice(0, 180).toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    normalized.push(cleaned);
  }
  if (!normalized.length) {
    return {
      text: "",
      usedChars: 0,
      usedChunks: 0
    };
  }

  const normalizedQueryText = String(queryText || "").trim().toLowerCase();
  const queryTokens = tokenizeForChunkSearch(normalizedQueryText);
  const queryPhrases = extractQueryPhrases(normalizedQueryText);
  const queryNumbers = Array.from(new Set((normalizedQueryText.match(/\d+/g) || []).slice(0, 5)));
  const scored = normalized.map((chunk, index) => {
    const lower = chunk.toLowerCase();
    let tokenHits = 0;
    for (const token of queryTokens) {
      if (lower.includes(token)) tokenHits += 1;
    }
    let phraseHits = 0;
    for (const phrase of queryPhrases) {
      if (lower.includes(phrase)) phraseHits += 1;
    }
    let numberHits = 0;
    for (const numberToken of queryNumbers) {
      if (lower.includes(numberToken)) numberHits += 1;
    }
    const score = tokenHits * 1.5 + phraseHits * 2.1 + numberHits * 1.1 + (index === 0 ? 0.1 : 0);
    return {
      index,
      chunk,
      score
    };
  });

  const ranked = [...scored].sort((a, b) => b.score - a.score || a.index - b.index);
  let usedChars = 0;
  const selected = [];
  for (const entry of ranked) {
    if (selected.length >= maxChunks) break;
    const remaining = charBudget - usedChars;
    if (remaining < 120) break;
    const piece = entry.chunk.length > remaining ? entry.chunk.slice(0, remaining).trimEnd() : entry.chunk;
    if (!piece) continue;
    selected.push({
      index: entry.index,
      text: piece
    });
    usedChars += piece.length + 8;
  }
  if (!selected.length) {
    const fallback = normalized[0].slice(0, charBudget).trim();
    return {
      text: fallback,
      usedChars: fallback.length,
      usedChunks: fallback ? 1 : 0
    };
  }

  selected.sort((a, b) => a.index - b.index);
  const text = selected.map((entry, idx) => `[DOC ${idx + 1}]\n${entry.text}`).join("\n\n---\n\n").trim();
  return {
    text,
    usedChars: Math.min(charBudget, text.length),
    usedChunks: selected.length
  };
}

function getEphemeralSourceNames(ephemeralSource) {
  const names = Array.isArray(ephemeralSource?.fileNames)
    ? ephemeralSource.fileNames.map((name) => String(name || "").trim()).filter(Boolean)
    : [];
  if (names.length) return names;
  const singleName = String(ephemeralSource?.fileName || "").trim();
  return singleName ? [singleName] : [];
}

export function getEphemeralSourceLabel(ephemeralSource, fallback = "chat-uploaded-material") {
  const names = getEphemeralSourceNames(ephemeralSource);
  if (!names.length) return fallback;
  return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
}

export function detectSourcesRequest(history = [], message = "") {
  const sourcesText = [];
  if (typeof message === "string") sourcesText.push(message);
  if (Array.isArray(history)) {
    for (const h of history) {
      const role = String(h?.role || "").toLowerCase();
      if (role === "user" || role === "client") {
        sourcesText.push(h?.text || h?.content || "");
      }
    }
  }
  const txt = sourcesText.join(" ").toLowerCase();
  const tokens = [
    "allik",
    "viide",
    "source",
    "cite",
    "citation",
    "\u0438\u0441\u0442\u043e\u0447\u043d",
    "\u0441\u0441\u044b\u043b\u043a"
  ];
  return tokens.some((token) => txt.includes(token));
}

export function shouldOfferDocumentDownload(message = "") {
  const lower = String(message || "").toLowerCase();
  const hasPdf = /\bpdf\b/.test(lower);
  const hasDocx = /\bdocx?\b/.test(lower);
  const hasWord = /\bms\s*word\b/.test(lower) || /\bwordi?\b/.test(lower);
  const hasFileIntent = /(allalaad|download|fail|file|dokument|document|export|eksport|laadi)/.test(lower);
  if (hasPdf || hasDocx) return true;
  if (hasWord && hasFileIntent) return true;
  return false;
}

export function normalizeRoomId(roomIdRaw) {
  const value = String(roomIdRaw || "").trim();
  return value || null;
}

export function isPlausibleConversationId(id) {
  if (!id || typeof id !== "string") return false;
  if (id.length < 8 || id.length > 200) return false;
  return /^[A-Za-z0-9._\-:+]+$/.test(id);
}

function collectRecentUserInputs(history = [], currentMessage = "", maxItems = 8) {
  const items = [];
  if (Array.isArray(history)) {
    for (let i = history.length - 1; i >= 0 && items.length < maxItems; i -= 1) {
      const entry = history[i];
      const role = String(entry?.role || "").toLowerCase();
      if (!(role === "user" || role === "client")) continue;
      const text = String(entry?.text || entry?.content || "").trim();
      if (!text) continue;
      items.push(text);
    }
  }
  const current = String(currentMessage || "").trim();
  if (current) items.unshift(current);
  return items.reverse();
}

let municipalitySeedEntriesPromise = null;

async function getMunicipalitySeedEntriesSafe(logError = null) {
  if (!municipalitySeedEntriesPromise) {
    municipalitySeedEntriesPromise = loadMunicipalitySeedEntries().catch((error) => {
      municipalitySeedEntriesPromise = null;
      if (typeof logError === "function") {
        logError("municipality_seed.load_failed", {
          err: error?.message || String(error)
        });
      }
      return [];
    });
  }
  return municipalitySeedEntriesPromise;
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function municipalityTypeInflectionPattern(type = "") {
  const normalized = normalizeMunicipalitySearchText(type);
  if (normalized === "vald") {
    return "(?:vald|valla|valda|vallas|vallast|vallale|vallal|vallalt|vallasse|vallaga|vallata|vallaks|vallani|vallana)";
  }
  if (normalized === "linn") {
    return "(?:linn|linna|linnas|linnast|linnale|linnal|linnalt|linnasse|linnaga|linnata|linnaks|linnani|linnana)";
  }
  return escapeRegExp(normalized);
}

function municipalityLookupPattern(term) {
  const normalizedTerm = normalizeMunicipalitySearchText(term);
  if (!normalizedTerm || normalizedTerm.length < 3) return null;

  const typedMatch = normalizedTerm.match(/^(.+?)\s+(vald|linn)$/);
  if (typedMatch) {
    const base = escapeRegExp(typedMatch[1]).replace(/\s+/g, "[\\s-]+");
    const typePattern = municipalityTypeInflectionPattern(typedMatch[2]);
    return new RegExp(`(^|[^a-z0-9])${base}[\\s-]+${typePattern}(?=$|[^a-z0-9])`, "i");
  }

  const escaped = escapeRegExp(normalizedTerm).replace(/\s+/g, "[\\s-]+");
  return new RegExp(`(^|[^a-z0-9])${escaped}(?:s|as|es|is|us|l|le|lt|st|ast|est|ist|ust|sse|asse|esse|isse|usse|ga|ta|ks|ni|na)?(?=$|[^a-z0-9])`, "i");
}

function containsMunicipalityLookupTerm(normalizedText, term) {
  if (!normalizedText) return false;
  const pattern = municipalityLookupPattern(term);
  if (!pattern) return false;
  return pattern.test(normalizedText);
}

function findMunicipalitySeedByDisplayName(entries = [], displayName = "") {
  const normalizedDisplayName = normalizeMunicipalitySearchText(displayName);
  if (!normalizedDisplayName) return null;

  return (Array.isArray(entries) ? entries : []).find((entry) => {
    if (!entry || entry.isActive === false) return false;
    return [
      entry.displayName,
      `${entry.baseName || ""} ${String(entry.type || "").toLowerCase()}`.trim(),
      entry.baseName
    ]
      .filter(Boolean)
      .some((value) => normalizeMunicipalitySearchText(value) === normalizedDisplayName);
  }) || null;
}

function buildMunicipalityMatch(entry, extra = {}) {
  if (!entry?.slug) return null;
  return {
    slug: entry.slug,
    id: entry.id || String(entry.slug || "").replace(/-/g, "_"),
    municipalityId: entry.municipalityId || entry.id || String(entry.slug || "").replace(/-/g, "_"),
    baseName: entry.baseName,
    type: entry.type,
    displayName: entry.displayName,
    ...extra
  };
}

const GEOCODING_PLACE_PREFIX_PATTERN =
  /\b(?:elan|asun|asub|asukoht|asukohas|piirkonnas|linnaosas|linnajaos|kulas|külas|alevis|alevikus|vallas|linnas|kohas|near|around|in)\s+([\p{L}\d][\p{L}\d.'-]*(?:\s+[\p{L}\d][\p{L}\d.'-]*){0,2})/giu;
const GEOCODING_PLACE_BEFORE_TOPIC_PATTERN =
  /(?:^|[.!?\n]\s*)([A-ZÕÄÖÜŠŽ][\p{L}\d.'-]*(?:\s+[A-ZÕÄÖÜŠŽ][\p{L}\d.'-]*){0,2})\s+(?=(?:koduteenus|koduhooldus|hooldus|sotsiaal|teenus|teenused|teenuseid|toetus|toetused|toetusi|abi)\b)/gu;

function cleanGeocodingPlaceCandidate(value = "") {
  const cleaned = String(value || "")
    .replace(/[,.!?;:()[\]{}]+$/g, "")
    .replace(/\b(?:milliseid|millised|mis|kas|kui|vajan|vajab|soovin|tahan|teenuseid|toetusi|abi)\b.*$/iu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 3 || cleaned.length > 80) return "";
  return cleaned;
}

function extractGeocodingPlaceCandidates(text = "") {
  const raw = String(text || "");
  const candidates = [];
  const seen = new Set();
  const matches = [
    ...raw.matchAll(GEOCODING_PLACE_PREFIX_PATTERN),
    ...raw.matchAll(GEOCODING_PLACE_BEFORE_TOPIC_PATTERN)
  ];
  for (const match of matches) {
    const candidate = cleanGeocodingPlaceCandidate(match?.[1] || "");
    const key = normalizeMunicipalitySearchText(candidate);
    if (!candidate || seen.has(key)) continue;
    seen.add(key);
    candidates.push(candidate);
    if (candidates.length >= 3) break;
  }
  return candidates;
}

async function findMunicipalityMatchesByGeocoding(entries = [], userText = "", options = {}) {
  const geocodeFn = typeof options.geocodePlaceFn === "function" ? options.geocodePlaceFn : geocodePlace;
  const candidates = extractGeocodingPlaceCandidates(userText);
  const matches = [];
  const seen = new Set();

  for (const rawPlace of candidates) {
    let geocoded = null;
    try {
      geocoded = await geocodeFn(rawPlace, {
        provider: options.geocoderProvider,
        timeoutMs: options.geocoderTimeoutMs || 2500
      });
    } catch (error) {
      if (typeof options.logError === "function") {
        options.logError("municipality_geocoder.lookup_failed", {
          err: error?.message || String(error),
          rawPlace
        });
      }
    }
    if (!geocoded) continue;

    const candidateTexts = [
      geocoded.municipalityDisplayName,
      ...(Array.isArray(geocoded.candidateStrings) ? geocoded.candidateStrings : [])
    ].filter(Boolean);

    for (const candidateText of candidateTexts) {
      const entry = findMunicipalitySeedByDisplayName(entries, candidateText);
      if (!entry || seen.has(entry.slug)) continue;
      seen.add(entry.slug);
      const match = buildMunicipalityMatch(entry, {
        matchedTerm: rawPlace,
        matchedLocation: geocoded.matchedPlace || rawPlace,
        matchScore: geocoded.confidence === "high" ? 3 : 2,
        matchSource: "geocoding",
        geocodingProvider: geocoded.provider || undefined
      });
      if (match) matches.push(match);
      break;
    }
  }

  return matches;
}

export async function detectMentionedMunicipalitiesFromUserText(history = [], currentMessage = "", options = {}) {
  const {
    maxHistoryItems = 6,
    maxMatches = 5,
    logError = null
  } = options;
  const userText = collectRecentUserInputs(history, currentMessage, maxHistoryItems).join("\n");
  const normalizedText = normalizeMunicipalitySearchText(userText);
  if (!normalizedText) return [];

  const entries = await getMunicipalitySeedEntriesSafe(logError);
  const matches = [];
  const seen = new Set();
  const aliasMatches = findLocationAliasMatches(userText);
  for (const alias of aliasMatches) {
    const entry = findMunicipalitySeedByDisplayName(entries, alias.municipalityDisplayName);
    if (!entry || seen.has(entry.slug)) continue;
    seen.add(entry.slug);
    const match = buildMunicipalityMatch(entry, {
      matchedTerm: alias.place,
      matchScore: 3,
      matchedLocation: alias.place,
      matchSource: "location_alias",
      aliasKind: alias.kind
    });
    if (match) matches.push(match);
  }

  for (const entry of entries) {
    if (!entry || entry.isActive === false) continue;
    const terms = [
      { term: entry.displayName, score: 4 },
      { term: `${entry.baseName || ""} ${String(entry.type || "").toLowerCase()}`.trim(), score: 4 },
      { term: entry.baseName, score: 1 }
    ].filter(item => item.term);
    const matched = terms.find((item) => containsMunicipalityLookupTerm(normalizedText, item.term));
    if (!matched || seen.has(entry.slug)) continue;
    seen.add(entry.slug);
    const match = buildMunicipalityMatch(entry, {
      matchedTerm: matched.term,
      matchScore: matched.score
    });
    if (match) matches.push(match);
  }

  const byBase = new Map();
  for (const match of matches) {
    const key = normalizeMunicipalitySearchText(match.baseName || match.displayName || match.slug);
    const group = byBase.get(key) || [];
    group.push(match);
    byBase.set(key, group);
  }
  const disambiguated = [];
  for (const group of byBase.values()) {
    const bestScore = Math.max(...group.map(item => Number(item.matchScore || 0)));
    disambiguated.push(...(bestScore >= 3 ? group.filter(item => Number(item.matchScore || 0) >= 3) : group));
  }

  if (!disambiguated.length && options.geocodeUnknownPlaces !== false) {
    const geocodedMatches = await findMunicipalityMatchesByGeocoding(entries, userText, {
      ...options,
      logError
    });
    disambiguated.push(...geocodedMatches);
  }

  return disambiguated.slice(0, maxMatches).map(({ matchScore: _matchScore, ...match }) => match);
}

export function buildDocumentMissingInstructionReply(replyLang) {
  if (replyLang === "en") {
    return "To run 1:1 agent workflow I still need a concrete instruction. Describe what exactly should be created and what to emphasize.";
  }
  if (replyLang === "ru") {
    return "Dlya zapuska 1:1 agent workflow nuzhna konkretnaya instrukciya: chto sozdavat i chto podcherknut.";
  }
  return "1:1 agent-workflow kaivitamiseks on vaja konkreetset juhist: mida tapselt koostada ja mida rohutada.";
}
