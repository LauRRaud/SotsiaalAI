// A journal cover or contents page can carry an article's registry metadata,
// but its headings are not evidence for the article's substantive claims.
export function isJournalFrontMatter(value = "", source = {}) {
  const sourceKind = [source.sourceType, source.source_type, source.collectionId, source.collection_id,
    source.metadata?.source_type, source.metadata?.collection_id].filter(Boolean).join(" ");
  if (!/(?:journal|sotsiaaltoo|sotsiaaltöö)/iu.test(sourceKind)) return false;
  const body = String(value || "").replace(/^\s*\(\d+\)[^\r\n]*\r?\n/u, "").trim();
  // Publisher subscription copy is not a social-work article, even when an
  // article's registry title was attached to the same extracted page.
  const publisherPromotion = /^telli\s+(?:e[-‑]?uudiskiri|ajakiri)/iu.test(body) &&
    /(?:tellimuse|kaastöid|koostööettepanekuid)/iu.test(body.slice(0, 1200));
  if (publisherPromotion) return true;
  const text = String(value || "").replace(/\s+/gu, " ").trim();
  const opening = text.slice(0, 700);
  const cover = /\bNR\s*\d{1,2}\s*\/\s*20\d{2}\b/iu.test(opening) && /\bISSN\b/iu.test(opening);
  const contents = /\b(?:sisukord|table of contents)\b/iu.test(opening);
  if (!cover && !contents) return false;
  const questionHeadings = (text.slice(0, 1800).match(/\?/gu) || []).length;
  const editorialMarkers = new Set((text.slice(0, 2400).match(/\b(?:toimetus|toimetaja|väljaandja|tellimine|reklaam|sisukord|contents|publisher)\b/giu) || [])
    .map(word => word.toLowerCase())).size;
  const numberedEntries = (text.slice(0, 2400).match(/\b\d{1,3}\s+[A-ZÄÖÜÕ][\p{L}–-]{3,}/gu) || []).length;
  return (cover && (questionHeadings >= 2 || editorialMarkers >= 2)) ||
    (contents && (numberedEntries >= 3 || editorialMarkers >= 2));
}

// Search chunks are not necessarily adjacent. A generic definite subject at
// the start of an article excerpt must not borrow a referent from another hit.
// Narrow service-page metadata can identify it; a broad journal title cannot.
export function hasUnresolvedPassageOpening(value = "", source = {}) {
  const sourceKind = [source.sourceType, source.source_type, source.collectionId, source.collection_id].filter(Boolean).join(" ");
  if (!/(?:journal|sotsiaaltoo|sotsiaaltöö)/iu.test(sourceKind)) return false;
  const text = String(value || "").trim();
  const opening = text.match(/^(?:(?:selle|antud|nimetatud)\s+)?(teenuse|toetuse|programmi|projekti|mudeli|asutuse)\b/iu);
  if (!opening) return /^(?:see|selle|need|nende)\s/iu.test(text);
  const title = String(source.title || "").toLowerCase();
  const stem = opening[1].toLowerCase().replace(/(?:e|i)$/u, "");
  // A compound such as "rehabilitatsiooniteenus" identifies the service;
  // the bare noun "teenus" in a thematic title does not.
  const explicitSubjects = title.match(new RegExp(`\\b[\\p{L}-]{3,}${stem}\\p{L}*`, "gu")) || [];
  return explicitSubjects.length !== 1 || /\b(?:ja|ning|või)\b/u.test(title);
}
