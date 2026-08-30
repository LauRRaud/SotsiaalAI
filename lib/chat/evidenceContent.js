// A journal cover or contents page can carry an article's registry metadata,
// but its headings are not evidence for the article's substantive claims.
export function isJournalFrontMatter(value = "", source = {}) {
  const sourceKind = [source.sourceType, source.source_type, source.collectionId, source.collection_id,
    source.metadata?.source_type, source.metadata?.collection_id].filter(Boolean).join(" ");
  if (!/(?:journal|sotsiaaltoo|sotsiaaltöö)/iu.test(sourceKind)) return false;
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
