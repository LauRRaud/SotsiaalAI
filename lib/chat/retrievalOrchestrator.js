import { RAG_BASE, RAG_TOP_K } from "./settings.js";

const RAG_SERVICE_KEY = String(process.env.RAG_SERVICE_API_KEY || "").trim();

const DEFAULT_RETRIEVER = "dense";

function normalizeIntentText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .trim();
}

function normalizeRetrieverName(value = "") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "";
}

function normalizeRetrieverList(value, fallback = []) {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const out = [];
  const seen = new Set();
  for (const item of [...raw, ...fallback]) {
    const normalized = normalizeRetrieverName(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function getMatchRetrievers(match = {}) {
  return normalizeRetrieverList(
    match?.retrievers_used ||
      match?.retrieversUsed ||
      match?.retrieval_channels ||
      match?.retrievalChannels ||
      match?.retrieval_channel ||
      match?.retrievalChannel ||
      match?.retriever,
    []
  );
}

function annotateRagResults(results = [], retrieversUsed = []) {
  const fallbackRetrievers = normalizeRetrieverList(retrieversUsed, [DEFAULT_RETRIEVER]);
  return (Array.isArray(results) ? results : []).map((match, index) => {
    const source = match && typeof match === "object" ? match : {};
    const matchRetrievers = normalizeRetrieverList(getMatchRetrievers(source), fallbackRetrievers);
    const primaryRetriever = matchRetrievers[0] || DEFAULT_RETRIEVER;
    return {
      ...source,
      retriever: source.retriever || primaryRetriever,
      retrieval_channel: source.retrieval_channel || source.retrievalChannel || primaryRetriever,
      retrievalChannel: source.retrievalChannel || source.retrieval_channel || primaryRetriever,
      retrieval_channels: matchRetrievers,
      retrievalChannels: matchRetrievers,
      retrieval_rank: Number.isFinite(Number(source.retrieval_rank))
        ? Number(source.retrieval_rank)
        : index + 1
    };
  });
}

function mergeNumericScore(existing, incoming, key, prefer = "max") {
  const a = Number(existing?.[key]);
  const b = Number(incoming?.[key]);
  if (!Number.isFinite(b)) return;
  if (!Number.isFinite(a)) {
    existing[key] = b;
    return;
  }
  existing[key] = prefer === "min" ? Math.min(a, b) : Math.max(a, b);
}

export function inferRetrieversUsed(matches = [], fallback = []) {
  const out = [];
  const seen = new Set();
  for (const retriever of normalizeRetrieverList(fallback, [])) {
    if (seen.has(retriever)) continue;
    seen.add(retriever);
    out.push(retriever);
  }
  for (const match of Array.isArray(matches) ? matches : []) {
    for (const retriever of getMatchRetrievers(match)) {
      if (seen.has(retriever)) continue;
      seen.add(retriever);
      out.push(retriever);
    }
  }
  return out;
}

function extractRecentUserText(history = [], maxItems = 2) {
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

function shouldUseRecentTextForRetrieval(message = "") {
  const normalized = normalizeIntentText(message);
  if (!normalized) return false;
  if (normalized.length <= 90) return true;
  return /\b(see|seda|sellest|selle|seal|siin|jah|jep|okei|ok|kontakt|kontaktid|telefon|e-post|email|taotlus|taotlema|pean|kuidas|kuhu|kellele)\b/.test(normalized);
}

function recentRetrievalContextLimit(message = "") {
  const normalized = normalizeIntentText(message);
  if (!normalized) return 2;
  if (normalized.length <= 40) return 6;
  if (/\b(see|seda|sellest|selle|seal|siin|jah|jep|okei|ok|kontakt|kontaktid|telefon|e-post|email|taotlus|taotlema|kuhu|kellele|mis valda|mis linna)\b/.test(normalized)) {
    return 5;
  }
  return 2;
}

const KEYWORD_FOCUS_STOPWORDS = new Set([
  "aga", "and", "are", "can", "could", "eestis", "ehk", "for", "from", "kas", "kasuta", "kasutatakse",
  "kasutatud", "kasutab", "kasutavad", "kasutamine", "kohta", "kohad", "kui", "kuidas", "kus",
  "mida", "millest", "mis", "need", "ning", "not", "nagu", "oleks", "oli", "on", "saab", "seda", "see", "selle", "selles", "siis",
  "that", "the", "this", "using", "was", "were", "what", "when", "where", "which", "with"
]);

const THEMATIC_SYNTHESIS_STOPWORDS = new Set([
  ...KEYWORD_FOCUS_STOPWORDS,
  "anna", "kokku", "kokkuvõte", "kokkuvotte", "laiem", "laiemalt", "peamised", "räägitud",
  "raagitud", "teema", "teemal", "teemad", "ülevaade", "ulevaade"
]);

const THEMATIC_ISSUE_TOKENS = new Set([
  "probleem", "probleeme", "probleemid", "probleemne", "probleemsed", "kitsaskoht", "kitsaskohad",
  "mure", "mured", "murekoht", "murekohad", "murekohti", "puudus", "puudused", "puudujääk", "puudujaak", "takistus", "takistused",
  "raskus", "raskused", "risk", "riskid", "väljakutse", "valjakutse", "väljakutsed", "valjakutsed"
]);

function compactKeywordText(value = "") {
  return normalizeIntentText(value)
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildKeywordFocusQueryParts(message = "") {
  const words = String(message || "")
    .split(/[^\p{Letter}\p{Number}]+/u)
    .map(word => word.trim())
    .filter(Boolean)
    .filter(word => word.length >= 3 || /^[A-Z0-9]{2,}$/.test(word))
    .filter(word => !/^\d+$/.test(word));
  const picked = [];
  const seen = new Set();
  for (const word of words) {
    const normalized = normalizeIntentText(word);
    if (!normalized || KEYWORD_FOCUS_STOPWORDS.has(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    picked.push(word);
    if (picked.length >= 8) break;
  }
  if (picked.length < 2) return [];
  const focused = picked.join(" ");
  if (!compactKeywordText(focused) || compactKeywordText(focused) === compactKeywordText(message)) return [];
  return [focused];
}

function buildExactAnchorQueryParts() {
  return [];
}

function keywordVariant(value = "") {
  const text = String(value || "").trim();
  const normalized = normalizeIntentText(text);
  if (!text || !normalized || normalized.length < 6) return "";
  const suffixes = ["stes", "tes", "des", "seks", "takse", "mise", "mises", "ga", "ks", "st", "le", "lt", "s"];
  for (const suffix of suffixes) {
    if (normalized.endsWith(suffix) && normalized.length - suffix.length >= 5) {
      return text.slice(0, Math.max(0, text.length - suffix.length));
    }
  }
  return "";
}

function thematicTokens(message = "") {
  const out = [];
  const seen = new Set();
  const words = String(message || "")
    .split(/[^\p{Letter}\p{Number}]+/u)
    .map(word => word.trim())
    .filter(Boolean)
    .filter(word => word.length >= 3 || /^[A-Z0-9]{2,}$/.test(word))
    .filter(word => !/^\d+$/.test(word));
  for (const word of words) {
    const normalized = normalizeIntentText(word);
    if (!normalized || THEMATIC_SYNTHESIS_STOPWORDS.has(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(word);
    const variant = keywordVariant(word);
    const variantKey = normalizeIntentText(variant);
    if (variant && variantKey && !seen.has(variantKey) && !THEMATIC_SYNTHESIS_STOPWORDS.has(variantKey)) {
      seen.add(variantKey);
      out.push(variant);
    }
    if (out.length >= 10) break;
  }
  return out;
}

export function isThematicSynthesisRagQuestion(message = "") {
  const normalized = normalizeIntentText(message).replace(/[.!?\s]+$/g, "");
  if (!normalized || normalized.length > 320) return false;
  const asksOpenTopic = /\b(mis|millest|millised|milliseid|mida|kuidas|anna|too|too valja|too välja|kokkuvote|kokkuvõte|ulevaade|ülevaade)\b/.test(normalized);
  const asksIssues = Array.from(THEMATIC_ISSUE_TOKENS).some(token => normalized.includes(token));
  const asksDiscussed = /\b(raagitud|raagitakse|räägitud|mainitud|mainitakse|kirjeldatud|kirjeldatakse|kurtnud|toodud|valja toodud|välja toodud|kasitletud|kasitletakse|käsitletud)\b/.test(normalized);
  const asksEvidenceAcrossCorpus = /\b(artikl|ajakirj|uuring|statistik|juhend|materjal|allik|praktik|kogemus)\b/.test(normalized);
  const topicTokenCount = thematicTokens(message)
    .filter(token => !THEMATIC_ISSUE_TOKENS.has(normalizeIntentText(token)))
    .length;
  return topicTokenCount >= 1 && (asksEvidenceAcrossCorpus || (asksOpenTopic && (asksIssues || asksDiscussed)));
}

export function buildThematicSynthesisQueryParts(message = "") {
  if (!isThematicSynthesisRagQuestion(message) && !isBroadMultiSourceRagQuestion(message)) return [];
  const tokens = thematicTokens(message);
  if (!tokens.length) return [];
  const focus = tokens.slice(0, 8).join(" ");
  const topicOnly = tokens
    .filter(token => !THEMATIC_ISSUE_TOKENS.has(normalizeIntentText(token)))
    .slice(0, 6)
    .join(" ") || focus;
  const parts = [
    focus,
    `${topicOnly} probleemid kitsaskohad väljakutsed`,
    `${topicOnly} uuring juhend statistika ajakiri praktika kogemus`,
    `${topicOnly} töökorraldus töökoormus ajapuudus dokumenteerimine andmesüsteem`,
    `${topicOnly} hinnang kogemus järelevalve kvaliteet kättesaadavus`
  ];
  if (normalizeIntentText(topicOnly).includes("lastekait")) {
    parts.push(
      "lastekaitse lastekaitsetootajad probleemid kitsaskohad dokumenteerimine ajapuudus",
      "lastekaitse abivajaduse hindamine juhtumitoo andmesusteem jarelevalve kvaliteet"
    );
  }
  const seen = new Set();
  return parts
    .map(part => part.trim())
    .filter(part => {
      const key = compactKeywordText(part);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

function readAssistantSources(message = {}) {
  if (Array.isArray(message?.displayed_sources)) return message.displayed_sources;
  if (Array.isArray(message?.displayedSources)) return message.displayedSources;
  if (Array.isArray(message?.sources)) return message.sources;
  return [];
}

function sourceAnchorText(source = {}) {
  const authors = Array.isArray(source?.authors)
    ? source.authors
    : typeof source?.authors === "string"
      ? source.authors.split(/[;,]/).map(item => item.trim()).filter(Boolean)
      : [];
  const parts = [
    source?.title,
    source?.label,
    authors.slice(0, 2).join(" "),
    source?.journalTitle || source?.journal_title,
    source?.issueLabel || source?.issueId || source?.issue_id,
    source?.year
  ].map(value => String(value || "").trim()).filter(Boolean);
  return Array.from(new Set(parts)).join(" ");
}

function cleanFilterValue(value) {
  const text = String(value || "").trim();
  return text ? text.slice(0, 220) : "";
}

function sourceFocusFilter(source = {}) {
  const docId = cleanFilterValue(source?.doc_id || source?.docId);
  const documentId = cleanFilterValue(source?.document_id || source?.documentId);
  const sourceId = cleanFilterValue(source?.source_id || source?.sourceId || source?.id);
  const canonicalItemId = cleanFilterValue(source?.canonical_item_id || source?.canonicalItemId);

  if (docId) return { doc_id: docId };
  if (documentId) return { document_id: documentId };
  if (sourceId) return { source_id: sourceId };
  if (canonicalItemId) return { canonical_item_id: canonicalItemId };
  return null;
}

function extractQuotedTitles(text = "") {
  const out = [];
  const source = String(text || "");
  for (const match of source.matchAll(/[„"“]([^„"“]{8,180})[”"“]/g)) {
    const title = String(match?.[1] || "").trim();
    if (title) out.push(title);
  }
  return out;
}

export function extractRecentAssistantSourceAnchors(history = [], maxItems = 3) {
  if (!Array.isArray(history) || !history.length) return [];
  const anchors = [];
  const seen = new Set();
  for (let i = history.length - 1; i >= 0 && anchors.length < maxItems; i -= 1) {
    const msg = history[i];
    const role = String(msg?.role || "").toLowerCase();
    if (role !== "ai" && role !== "assistant") continue;
    for (const src of readAssistantSources(msg)) {
      const anchor = sourceAnchorText(src);
      const key = normalizeIntentText(anchor);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      anchors.push(anchor.slice(0, 260));
      if (anchors.length >= maxItems) break;
    }
    if (anchors.length < maxItems) {
      for (const title of extractQuotedTitles(msg?.text || msg?.content || "")) {
        const key = normalizeIntentText(title);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        anchors.push(title.slice(0, 220));
        if (anchors.length >= maxItems) break;
      }
    }
  }
  return anchors;
}

export function extractRecentAssistantSourceFocus(history = [], maxItems = 2) {
  if (!Array.isArray(history) || !history.length) return [];
  const out = [];
  const seen = new Set();
  for (let i = history.length - 1; i >= 0 && out.length < maxItems; i -= 1) {
    const msg = history[i];
    const role = String(msg?.role || "").toLowerCase();
    if (role !== "ai" && role !== "assistant") continue;
    for (const src of readAssistantSources(msg)) {
      const anchor = sourceAnchorText(src);
      const filters = sourceFocusFilter(src);
      if (!anchor || !filters) continue;
      const key = JSON.stringify(filters);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        anchor: anchor.slice(0, 260),
        filters
      });
      if (out.length >= maxItems) break;
    }
  }
  return out;
}

export function hasRecentAssistantSources(history = []) {
  return extractRecentAssistantSourceAnchors(history, 1).length > 0;
}

function shouldUseRecentSourceAnchorsForRetrieval(message = "") {
  const normalized = normalizeIntentText(message);
  if (!normalized) return false;
  if (normalized.length <= 90) return true;
  return /\b(seal|sealt|selles|sellel|artiklis|artikli|allikas|tekstis|mainitakse|mainitud|naide|eesti|soome|ott|tootukassa|töötukassa)\b/.test(normalized);
}

export function isBroadMultiSourceRagQuestion(message = "") {
  const normalized = normalizeIntentText(message).replace(/[.!?\s]+$/g, "");
  if (!normalized || normalized.length > 300) return false;
  const broadIntent = /\b(vordle|võrdle|vordlus|võrdlus|analuusi|analüüsi|analyysi|analyseeri|suntees|süntees|sunteesi|sünteesi|ulevaade|ülevaade|laiemalt|laiem|teiste|teisi|mitme|mitmeid|mitu|erinevused|sarnasused|kasitlused|käsitlused|peamised|kokkuvotte|kokkuvõtte)\b/.test(normalized);
  const multiSourceScope = /\b(teiste|teisi|mitme|mitmeid|mitu|artiklite|allikate|materjalide|tekstide|ajakirjas|sotsiaaltoo|sotsiaaltöö|laiemalt)\b/.test(normalized);
  return (broadIntent && multiSourceScope) || isThematicSynthesisRagQuestion(message);
}

function isShortSourceLookupFollowup(message = "") {
  const normalized = normalizeIntentText(message);
  if (!normalized) return false;
  if (normalized.length <= 60) {
    return /\b(see|seda|selle|sellest|seal|siin|sealt|sinna|kontakt|kontaktid|telefon|e-post|email|taotlus)\b/.test(normalized);
  }
  return false;
}

export function buildRagSearchQuery(message = "", history = []) {
  const current = String(message || "").trim();
  if (!current) return "";
  const recent = shouldUseRecentTextForRetrieval(current)
    ? extractRecentUserText(history, recentRetrievalContextLimit(current))
    : [];
  const sourceAnchors = shouldUseRecentSourceAnchorsForRetrieval(current)
    ? extractRecentAssistantSourceAnchors(history, 3)
    : [];
  const keywordFocus = buildKeywordFocusQueryParts(current);
  const exactAnchorFocus = buildExactAnchorQueryParts(current);
  const thematicFocus = buildThematicSynthesisQueryParts(current);
  const parts = [current, ...exactAnchorFocus, ...thematicFocus, ...keywordFocus, ...sourceAnchors, ...recent].filter(Boolean);
  return Array.from(new Set(parts)).join("\n");
}

function splitBroadSearchQueries(query = "") {
  const seen = new Set();
  const lines = String(query || "")
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => {
      const key = compactKeywordText(line);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return lines.length > 1 ? lines.slice(0, 7) : lines;
}

export function buildSourceAnchoredRagQueries(message = "", history = [], baseQuery = "") {
  const query = String(baseQuery || buildRagSearchQuery(message, history) || "").trim();
  if (!query) return [];
  if (!shouldUseRecentSourceAnchorsForRetrieval(message)) return [query];

  const focused = extractRecentAssistantSourceFocus(history, 2)
    .map((item) => ({
      query: [String(message || "").trim(), item.anchor].filter(Boolean).join("\n") || query,
      filters: item.filters
    }))
    .filter((item) => item.query && item.filters);

  if (isBroadMultiSourceRagQuestion(message)) {
    if (isThematicSynthesisRagQuestion(message)) {
      return [
        ...splitBroadSearchQueries(query),
        ...focused
      ];
    }
    return [
      query,
      ...focused
    ];
  }

  return [
    ...focused,
    query
  ];
}

export function extractParagraphReferences(text = "") {
  const source = String(text || "");
  const refs = new Set();
  const explicitPattern = /(?:§+\s*|paragrahv(?:i|is|ist|ile|il|iga|iks)?\s+|paragraph\s+)(\d+[a-z]?(?:\s*[-–]\s*\d+[a-z]?)?)/giu;
  for (const match of source.matchAll(explicitPattern)) {
    const ref = String(match?.[1] || "").replace(/\s+/g, "").replace(/[–]/g, "-").trim();
    if (ref) refs.add(ref);
  }

  const normalized = normalizeIntentText(source);
  if (/\b(paragrahv|paragraph|loige|lõige|sate|säte|§)\b/.test(normalized) || source.includes("§")) {
    const listPattern = /(?:^|[\s,;])(\d{1,3}[a-z]?)(?=\s*(?:,|;|\bja\b|\band\b|\bning\b|$))/giu;
    for (const match of source.matchAll(listPattern)) {
      const ref = String(match?.[1] || "").trim();
      const matchIndex = Number(match?.index || 0);
      const prefixWindow = normalizeIntentText(source.slice(Math.max(0, matchIndex - 20), matchIndex));
      if (/\b(loige|lõige|lg|punkt|pt|alampunkt|sate|säte)\s*$/.test(prefixWindow)) continue;
      if (ref) refs.add(ref);
    }
  }
  return Array.from(refs).slice(0, 8);
}

export function inferSourceLookupSubject(text = "") {
  const normalized = normalizeIntentText(text);
  if (/\bsotsiaalhoolekande sead/.test(normalized) || /\bshs\b/.test(normalized)) {
    return "Sotsiaalhoolekande seadus";
  }
  if (/\bjogeva\b/.test(normalized) && /\b(riigi teataja|riigiteataja|maar|määr|kord|sotsiaalhoolekandelise abi)\b/.test(normalized)) {
    return "Sotsiaalhoolekandelise abi andmise kord Jõgeva vallas";
  }
  if (/\bjogeva\b/.test(normalized)) {
    return "Jõgeva vald sotsiaalteenused toetused";
  }
  if (/\briigi teataja|riigiteataja\b/.test(normalized)) {
    return "Riigi Teataja";
  }
  return "";
}

function _isToimetulekutoetusLegalSectionLookup(text = "") {
  const normalized = normalizeIntentText(text);
  return (/\bsotsiaalhoolekande sead/.test(normalized) || /\bshs\b/.test(normalized)) &&
    /\btoimetulekutoetus/.test(normalized) &&
    /\b(paragrahv|paragrahvid|sate|sated|säte|sätted|reguleerib|reguleerivad|millised|milliseid|mis)\b/.test(normalized);
}

function _buildToimetulekutoetusLegalSectionAnchors(subject = "Sotsiaalhoolekande seadus") {
  return [
    `${subject} 8. jagu Toimetulekutoetus paragrahvid 131 132 133 134 135`,
    `${subject} § 131 Toimetulekutoetus`,
    `${subject} § 132 Toimetulekutoetuse taotlemine`,
    `${subject} § 133 Toimetulekutoetuse arvestamise alused`,
    `${subject} § 134 Toimetulekutoetuse määramine ja maksmine`,
    `${subject} § 135 Riigieelarvest makstav täiendav sotsiaaltoetus`
  ];
}

export function detectSourceAvailabilityRequest(history = [], message = "") {
  const current = String(message || "").trim();
  if (!current) return false;
  const recent = extractRecentUserText(history, 6);
  const combined = [current, ...recent].join("\n");
  const normalizedCurrent = normalizeIntentText(current);
  const normalizedCombined = normalizeIntentText(combined);
  const hasSourceTerm =
    /(?:§|paragrahv[a-z0-9]*|paragraph|\bseadus[a-z0-9]*|sotsiaalhoolekande|\bshs\b|riigi teataja|riigiteataja|allik|materjal|andmebaas|dokument|source|document|legal act)/.test(normalizedCombined) ||
    current.includes("§");
  const genericSourcePlanningIntent =
    /\b(milliseid|mis)\s+(allikaid|viiteid|sources|citations)\s+(kasutada|use)\b/.test(normalizedCurrent) ||
    /\b(allikaid|viiteid|sources|citations)\s+(dokumendi|mustandi|kirja|taotluse|avaldus|draft|document|letter|application)\b/.test(normalizedCurrent);
  const hasAvailabilityIntent =
    /\b(kas\s+)?(su|sul|sinul|teil)\b/.test(normalizedCurrent) ||
    /\b(olemas|naed|näed|naitab|näitab|andmebaas|materjalides|allikates|leia|leidsid|kusin|küsin|kysin|küsisin|find|have|available|database|ask|asking)\b/.test(normalizedCurrent);
  const hasIdentificationIntent =
    /\b(mis|milline|millised|milliseid|kust|kus|what|which|where)\b/.test(normalizedCurrent) &&
    /\b(tekst|lause|katkend|paragrahv[a-z0-9]*|paragraph|loige[a-z0-9]*|lõige[a-z0-9]*|sate[a-z0-9]*|säte[a-z0-9]*|allik|viide|dokument|source|document|passage|quote|citation)\b/.test(normalizedCurrent);
  const legalProvisionLookupIntent =
    /\b(mis|milline|millised|milliseid|what|which)\b/.test(normalizedCurrent) &&
    /\b(paragrahv[a-z0-9]*|paragraph|sate[a-z0-9]*|säte[a-z0-9]*)\b/.test(normalizedCurrent) &&
    /\b(reguleerib|reguleerivad|kasitleb|käsitleb|puudutab|kehtestab)\b/.test(normalizedCurrent);
  const shortParagraphFollowup =
    /^[§\s\d,;a-zA-Z-]+$/.test(current) &&
    /\b(paragrahv|paragraph|§|seadus|shs|andmebaas|materjal)\b/.test(normalizedCombined);
  if (genericSourcePlanningIntent) return false;
  return Boolean(hasSourceTerm && (hasAvailabilityIntent || hasIdentificationIntent || legalProvisionLookupIntent || shortParagraphFollowup));
}

function historyHasAssistantAnswer(history = []) {
  if (!Array.isArray(history)) return false;
  return history.some((item) => {
    const role = String(item?.role || "").toLowerCase();
    if (role !== "ai" && role !== "assistant") return false;
    return typeof item?.text === "string" && item.text.trim().length > 0;
  });
}

export function detectPreviousSourceUseRequest(history = [], message = "") {
  const normalized = normalizeIntentText(message);
  if (!normalized || !historyHasAssistantAnswer(history)) return false;
  const asksSources = /\b(allik|viide|source|cite|citation)\b/.test(normalized);
  if (!asksSources) return false;

  const explicitPreviousAnswerReference =
    /\b(eelmise|eelmises|viimase|viimases|selle|selles)\s+(vastuse|vastuses|vastusena|selgituse|selgituses)\b/.test(normalized) ||
    /\b(sinu|teie|su)\s+(eelmise|viimase|selle)\s+(vastuse|selgituse)\b/.test(normalized);
  const explicitAssistantPastUse =
    /\b(sa|sina|te|teie|su)\b.{0,40}\b(kasutasid|viitasid|used|cited)\b/.test(normalized) ||
    /\b(milliseid|mis)\s+(allikaid|viiteid|sources|citations)\s+\b(kasutasid|viitasid|used|cited)\b/.test(normalized);
  const freshLookupTarget =
    /(?:§|paragrahv|paragraph|\bseadus|sotsiaalhoolekande|\bshs\b|riigi teataja|riigiteataja|oigusakt|legal act)\b/.test(normalized) ||
    /\b(mis|milline|kust|kus|what|which|where)\b/.test(normalized);

  if (explicitPreviousAnswerReference || explicitAssistantPastUse) {
    return true;
  }

  if (freshLookupTarget) {
    return false;
  }

  return /\b(vastus|vastuses|eelmis|viimas)\b/.test(normalized) &&
    /\b(kasutas|viitas|used|cited)\b/.test(normalized);
}

export function buildSourceLookupSearchQuery(message = "", history = []) {
  const current = String(message || "").trim();
  const recent = isShortSourceLookupFollowup(current)
    ? extractRecentUserText(history, 4)
    : [];
  const combined = [current, ...recent].filter(Boolean).join("\n");
  const subject = inferSourceLookupSubject(combined);
  const paragraphRefs = extractParagraphReferences(combined);
  const parts = [];
  if (subject) parts.push(subject);
  if (current) parts.push(current);
  for (const ref of paragraphRefs.slice(0, 4)) {
    parts.push(`${subject || ""} § ${ref}`.trim());
  }
  parts.push(...recent);
  return Array.from(new Set(parts.map((part) => part.trim()).filter(Boolean))).join("\n");
}

async function searchRagDirect({
  query,
  topK = RAG_TOP_K,
  filters,
  observabilityRoute = "api/chat",
  observabilityStage = "rag_search",
  userId = null,
  role = null,
  conversationId = null,
  timeoutMs = 12000
}) {
  const body = {
    query,
    top_k: topK,
    retrievers: ["dense", "title_match", "exact_phrase", "bm25"],
    where: filters || undefined
  };
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 12000));
  let res;
  let data = null;
  try {
    res = await fetch(`${RAG_BASE}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(observabilityRoute ? {
          "X-Observability-Route": observabilityRoute
        } : {}),
        ...(observabilityStage ? {
          "X-Observability-Stage": observabilityStage
        } : {}),
        ...(userId ? {
          "X-Observability-User-Id": String(userId)
        } : {}),
        ...(role ? {
          "X-Observability-Role": String(role)
        } : {}),
        ...(conversationId ? {
          "X-Observability-Conversation-Id": String(conversationId)
        } : {}),
        ...(RAG_SERVICE_KEY ? {
          "X-API-Key": RAG_SERVICE_KEY
        } : {})
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal
    });
    try {
      const raw = await res.text();
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) {
    return [];
  }
  const retrieversUsed = normalizeRetrieverList(data?.retrievers_used || data?.retrieversUsed, [DEFAULT_RETRIEVER]);
  return annotateRagResults(Array.isArray(data?.results) ? data.results : [], retrieversUsed).map((result) => ({
    ...result,
    ...(data?.merge_strategy ? { retrieval_merge_strategy: data.merge_strategy } : {}),
    ...(data?.channel_stats ? { retrieval_channel_stats: data.channel_stats } : {}),
    ...(data?.search_strategy ? { search_strategy: data.search_strategy } : {})
  }));
}

async function runWithConcurrency(items = [], limit = 3, task) {
  const list = Array.isArray(items) ? items : [];
  const results = new Array(list.length);
  let next = 0;
  const workerCount = Math.max(1, Math.min(Number(limit) || 1, list.length));
  async function worker() {
    while (next < list.length) {
      const index = next;
      next += 1;
      try {
        results[index] = {
          status: "fulfilled",
          value: await task(list[index], index)
        };
      } catch (reason) {
        results[index] = {
          status: "rejected",
          reason
        };
      }
    }
  }
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

export function dedupeRagMatches(matches = []) {
  const out = [];
  const seen = new Map();
  for (const match of Array.isArray(matches) ? matches : []) {
    const md = match?.metadata || {};
    const key = String(match?.id || md.chunk_id || md.chunkId || md.doc_id || md.docId || match?.text || "").slice(0, 220);
    if (!key) continue;
    const annotated = annotateRagResults([match], getMatchRetrievers(match))[0];
    if (seen.has(key)) {
      const existing = out[seen.get(key)];
      const mergedRetrievers = inferRetrieversUsed([existing, annotated]);
      existing.retrieval_channels = mergedRetrievers;
      existing.retrievalChannels = mergedRetrievers;
      existing.retriever = existing.retriever || mergedRetrievers[0] || DEFAULT_RETRIEVER;
      existing.retrieval_channel = existing.retrieval_channel || existing.retriever;
      existing.retrievalChannel = existing.retrievalChannel || existing.retriever;
      mergeNumericScore(existing, annotated, "hybrid_score");
      mergeNumericScore(existing, annotated, "hybridScore");
      mergeNumericScore(existing, annotated, "rrf_score");
      mergeNumericScore(existing, annotated, "dense_score");
      mergeNumericScore(existing, annotated, "lexical_score");
      mergeNumericScore(existing, annotated, "lexical_score_normalized");
      mergeNumericScore(existing, annotated, "bm25_score");
      mergeNumericScore(existing, annotated, "bm25_coverage");
      mergeNumericScore(existing, annotated, "bm25_matches");
      mergeNumericScore(existing, annotated, "bm25_query_tokens");
      mergeNumericScore(existing, annotated, "channel_boost");
      mergeNumericScore(existing, annotated, "hybrid_rank", "min");
      mergeNumericScore(existing, annotated, "hybridRank", "min");
      mergeNumericScore(existing, annotated, "dense_rank", "min");
      mergeNumericScore(existing, annotated, "lexical_rank", "min");
      if (!existing.retrieval_scores && annotated.retrieval_scores) existing.retrieval_scores = annotated.retrieval_scores;
      if (!existing.retrieval_merge_strategy && annotated.retrieval_merge_strategy) existing.retrieval_merge_strategy = annotated.retrieval_merge_strategy;
      if (!existing.retrieval_channel_stats && annotated.retrieval_channel_stats) existing.retrieval_channel_stats = annotated.retrieval_channel_stats;
      continue;
    }
    seen.set(key, out.length);
    out.push(annotated);
  }
  return out;
}

export async function searchRagQueries({
  queries,
  topK = RAG_TOP_K,
  filters,
  observabilityRoute = "api/chat",
  observabilityStage = "rag_search",
  userId = null,
  role = null,
  conversationId = null
}) {
  const normalizedQueries = [];
  const seen = new Set();
  for (const raw of (Array.isArray(queries) ? queries : [queries])) {
    if (!raw) continue;
    const queryText = typeof raw === "string" ? raw : raw?.query;
    const normalizedQuery = String(queryText || "").trim();
    if (!normalizedQuery) continue;
    const extraFilters = raw && typeof raw === "object" && !Array.isArray(raw) ? raw.filters || null : null;
    const dedupeKey = JSON.stringify({
      query: normalizedQuery,
      filters: extraFilters || null
    });
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    normalizedQueries.push({
      query: normalizedQuery,
      filters: extraFilters
    });
  }
  const uniqueQueries = normalizedQueries;
  if (!uniqueQueries.length) return [];
  if (uniqueQueries.length === 1) {
    return searchRagDirect({
      query: uniqueQueries[0].query,
      topK,
      filters: uniqueQueries[0].filters ? {
        ...(filters || {}),
        ...uniqueQueries[0].filters
      } : filters,
      observabilityRoute,
      observabilityStage,
      userId,
      role,
      conversationId
    });
  }

  const perQueryTopK = Math.max(4, Math.min(topK, Math.ceil(topK / uniqueQueries.length) + 2));
  const settled = await runWithConcurrency(uniqueQueries, 3, (entry, index) =>
    searchRagDirect({
      query: entry.query,
      topK: perQueryTopK,
      filters: entry.filters ? {
        ...(filters || {}),
        ...entry.filters
      } : filters,
      observabilityRoute,
      observabilityStage: `${observabilityStage}_q${index + 1}`,
      userId,
      role,
      conversationId,
      timeoutMs: 18000
    })
  );

  const merged = [];
  let firstError = null;
  for (const item of settled) {
    if (item.status === "fulfilled") {
      merged.push(...(Array.isArray(item.value) ? item.value : []));
    } else if (!firstError) {
      firstError = item.reason;
    }
  }
  if (!merged.length && firstError) throw firstError;
  return dedupeRagMatches(merged);
}

export function extractMatchGroupYear(entry) {
  const raw = entry?.year;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const matched = raw.match(/\b(19|20)\d{2}\b/);
    if (matched) return Number(matched[0]);
  }
  const fallbackValues = [entry?.issueLabel, entry?.issueId, entry?.title];
  for (const value of fallbackValues) {
    if (typeof value !== "string") continue;
    const matched = value.match(/\b(19|20)\d{2}\b/);
    if (matched) return Number(matched[0]);
  }
  return null;
}
