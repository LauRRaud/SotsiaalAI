const EXACT_ANCHOR_STOPWORDS = new Set([
  "aga", "and", "are", "ehk", "for", "from", "ja", "kas", "kui", "kuidas", "mis", "mida", "millest",
  "nagu", "ning", "nt", "on", "or", "see", "selle", "selles", "the", "this", "voi", "või",
  "what", "which", "with"
]);

function normalizeAnchorToken(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "")
    .trim();
}

function cleanAnchorCandidate(value = "") {
  return String(value || "")
    .replace(/^[^\p{Letter}\p{Number}]+|[^\p{Letter}\p{Number}]+$/gu, "")
    .trim();
}

function looksLikeExactName(value = "") {
  const text = cleanAnchorCandidate(value);
  if (!text || text.length < 3) return false;
  if (/^[\p{Lu}0-9]{2,}$/u.test(text)) return true;
  if (/[\p{Ll}][\p{Lu}]/u.test(text)) return true;
  return /^[\p{Lu}][\p{Ll}\p{Letter}\p{Number}]{2,}$/u.test(text);
}

export function extractExactQueryAnchors(message = "", options = {}) {
  const text = String(message || "");
  if (!text.trim()) return [];
  const limit = Number.isFinite(Number(options?.limit)) ? Number(options.limit) : 8;
  const anchors = [];
  const seen = new Set();
  const add = (candidate) => {
    const cleaned = cleanAnchorCandidate(candidate);
    const normalized = normalizeAnchorToken(cleaned);
    if (!normalized || normalized.length < 3) return;
    if (EXACT_ANCHOR_STOPWORDS.has(normalized)) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    anchors.push(normalized);
  };

  for (const match of text.matchAll(/\b(?:nagu|nt|näiteks|naiteks|sealhulgas|sh)\b[:\s-]*([^.!?]{2,180})/giu)) {
    const segment = String(match?.[1] || "");
    for (const token of segment.split(/[,\s;:()[\]{}"“”„]+/u)) {
      if (looksLikeExactName(token)) add(token);
      if (anchors.length >= limit) return anchors;
    }
  }

  const firstWord = text.match(/\S+/u);
  const firstWordStart = firstWord?.index ?? -1;
  for (const match of text.matchAll(/[\p{Letter}\p{Number}_-]+/gu)) {
    const token = match?.[0] || "";
    const index = match?.index ?? -1;
    if (index === firstWordStart && !/[\p{Ll}][\p{Lu}]|^[\p{Lu}0-9]{2,}$/u.test(token)) continue;
    if (looksLikeExactName(token)) add(token);
    if (anchors.length >= limit) break;
  }

  return anchors;
}
