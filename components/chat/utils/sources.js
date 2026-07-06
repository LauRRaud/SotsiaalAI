function uniqueSortedPages(pages) {
  if (!Array.isArray(pages)) return [];
  const nums = pages.map(p => Number(p)).filter(p => Number.isFinite(p) && p > 0);
  return [...new Set(nums)].sort((a, b) => a - b);
}
export function collapsePages(pages) {
  const sorted = uniqueSortedPages(pages);
  if (!sorted.length) return "";
  const out = [];
  let start = null;
  let prev = null;
  for (const page of sorted) {
    if (start === null) {
      start = prev = page;
      continue;
    }
    if (page === prev + 1) {
      prev = page;
      continue;
    }
    out.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = prev = page;
  }
  if (start !== null) out.push(start === prev ? `${start}` : `${start}-${prev}`);
  return out.join(", ");
}
export function normalizePageRange(value) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (/^0+$/.test(raw)) return "";

  const tokens = raw
    .split(",")
    .map(part => part.trim())
    .filter(Boolean);
  if (!tokens.length) return "";

  const normalized = [];
  for (const token of tokens) {
    const rangeMatch = token.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= 0) continue;
      const safeStart = Math.max(1, start);
      normalized.push(safeStart === end ? `${end}` : `${safeStart}-${end}`);
      continue;
    }
    const singleMatch = token.match(/^\d+$/);
    if (singleMatch) {
      const page = Number(token);
      if (page > 0) normalized.push(`${page}`);
      continue;
    }
    normalized.push(token);
  }
  return normalized.join(", ");
}
function asAuthorArray(v) {
  if (!v) return [];
  const clean = value => {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "autor puudub" || normalized.startsWith("autor puudub ") ? "" : String(value || "").trim();
  };
  if (Array.isArray(v)) return v.map(clean).filter(Boolean);
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return [];
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map(clean).filter(Boolean);
    } catch {}
    return s.split(/[;,]/).map(clean).filter(Boolean);
  }
  return [];
}
export function prettifyFileName(name) {
  if (typeof name !== "string" || !name.trim()) return "";
  const noExt = name.replace(/\.[a-z0-9]+$/i, "");
  return noExt.replace(/[_-]+/g, " ").trim();
}
function joinSourceSegments(segments) {
  return segments
    .filter(Boolean)
    .map(segment => String(segment).trim())
    .filter(Boolean)
    .reduce((label, segment) => {
      if (!label) return segment;
      const separator = /[.!?]$/.test(label) ? " " : ". ";
      return `${label}${separator}${segment}`;
    }, "");
}
export function isSyntheticEvidenceRef(value) {
  return /^E\d+$/i.test(String(value || "").trim());
}
export function formatSourceLabel(src) {
  const shortRef = typeof src?.short_ref === "string" && src.short_ref.trim()
    ? src.short_ref.trim()
    : "";
  const syntheticEvidenceRef = isSyntheticEvidenceRef(shortRef);
  if (shortRef && shortRef.length > 8 && !syntheticEvidenceRef) return shortRef;

  const authors = asAuthorArray(src?.authors);
  const authorText = authors.length ? authors.join("; ") : null;
  const titleText = typeof src?.title === "string" && src.title.trim() ? src.title.trim() : "";
  const journal = typeof src?.journalTitle === "string" ? src.journalTitle.trim() : "";
  const issue = typeof src?.issueLabel === "string" ? src.issueLabel.trim() : typeof src?.issueId === "string" ? src.issueId.trim() : "";
  const year = typeof src?.year === "number" ? String(src.year) : typeof src?.year === "string" ? src.year.trim() : "";
  const pagesCombined = normalizePageRange(src?.pageRange) || collapsePages([...(Array.isArray(src?.pages) ? src.pages : []), ...(typeof src?.page === "number" ? [src.page] : [])]);
  const paragraphTitle = typeof src?.paragraphTitle === "string" ? src.paragraphTitle.trim() : typeof src?.paragraph_title === "string" ? src.paragraph_title.trim() : "";
  const section = !paragraphTitle && typeof src?.section === "string" ? src.section.trim() : "";
  const filePretty = src?.fileName ? prettifyFileName(src.fileName) : "";
  const issueSegment = [journal, issue && issue !== year ? issue : null, year || null].filter(Boolean).join(", ");
  const contextSegments = [issueSegment, paragraphTitle || section].filter(Boolean);
  const mainSegments = [];
  if (authorText) mainSegments.push(authorText);
  if (titleText) mainSegments.push(titleText);
  const tailSegments = [];
  if (contextSegments.length) tailSegments.push(contextSegments.join(", "));
  if (pagesCombined) tailSegments.push(`lk ${pagesCombined}`);
  let label = joinSourceSegments([...mainSegments, ...tailSegments]).trim();
  if (!label && filePretty) {
    const fallbackParts = [filePretty, contextSegments.join(", ") || null, pagesCombined ? `lk ${pagesCombined}` : null, section || null].filter(Boolean);
    label = fallbackParts.join(", ").trim();
  }
  let labelFromShortRef = false;
  if (!label && shortRef) {
    label = shortRef;
    labelFromShortRef = true;
  }
  if (!label) {
    const url = typeof src?.url === "string" ? src.url.replace(/^https?:\/\//, "") : "";
    label = url || "Allikas";
  }
  if (label && !/[.!?]$/.test(label)) {
    label = `${label}.`;
  }
  if (!labelFromShortRef && shortRef && shortRef.length <= 8 && !syntheticEvidenceRef && label && !label.startsWith(`${shortRef}:`)) {
    label = `${shortRef}: ${label}`;
  }
  return label;
}
export function normalizeSources(sources) {
  if (!Array.isArray(sources)) return [];
  return sources.map((src, idx) => {
    const url =
      src?.url ||
      src?.source ||
      src?.url_canonical ||
      src?.urlCanonical ||
      src?.source_url ||
      src?.sourceUrl ||
      src?.official_url ||
      src?.officialUrl ||
      src?.official_website ||
      src?.officialWebsite ||
      src?.metadata?.url ||
      src?.metadata?.url_canonical ||
      src?.metadata?.urlCanonical ||
      src?.metadata?.source_url ||
      src?.metadata?.sourceUrl ||
      src?.metadata?.official_url ||
      src?.metadata?.officialUrl ||
      src?.metadata?.official_website ||
      src?.metadata?.officialWebsite ||
      null;
    const page = typeof src?.page === "number" || typeof src?.page === "string" ? src.page : null;
    const label = formatSourceLabel(src);
    const sourceId = src?.source_id || src?.sourceId || null;
    const docId = src?.doc_id || src?.docId || null;
    const documentId = src?.document_id || src?.documentId || null;
    const chunkId = src?.chunk_id || src?.chunkId || null;
    const canonicalItemId = src?.canonical_item_id || src?.canonicalItemId || null;
    const key = src?.key || src?.id || sourceId || canonicalItemId || url || `${label}-${idx}`;
    const pages = Array.isArray(src?.pages) ? uniqueSortedPages(src.pages) : undefined;
    const pageLabel = normalizePageRange(src?.pageRange) || collapsePages([...(pages || []), page]);
    const authors = asAuthorArray(src?.authors);
    const issueLabel = typeof src?.issueLabel === "string" ? src.issueLabel : typeof src?.issueId === "string" ? src.issueId : undefined;
    const year = typeof src?.year === "number" || typeof src?.year === "string" ? src.year : undefined;
    const sourceType = typeof src?.sourceType === "string" ? src.sourceType : typeof src?.source_type === "string" ? src.source_type : typeof src?.origin === "string" ? src.origin : typeof src?.type === "string" ? src.type : undefined;
    return {
      key,
      source_id: typeof sourceId === "string" ? sourceId : undefined,
      sourceId: typeof sourceId === "string" ? sourceId : undefined,
      doc_id: typeof docId === "string" ? docId : undefined,
      docId: typeof docId === "string" ? docId : undefined,
      document_id: typeof documentId === "string" ? documentId : undefined,
      documentId: typeof documentId === "string" ? documentId : undefined,
      chunk_id: typeof chunkId === "string" ? chunkId : undefined,
      chunkId: typeof chunkId === "string" ? chunkId : undefined,
      canonical_item_id: typeof canonicalItemId === "string" ? canonicalItemId : undefined,
      canonicalItemId: typeof canonicalItemId === "string" ? canonicalItemId : undefined,
      label,
      url,
      page,
      pageRange: pageLabel || undefined,
      fileName: src?.fileName,
      sourceType,
      source_type: typeof src?.source_type === "string" ? src.source_type : undefined,
      origin: typeof src?.origin === "string" ? src.origin : undefined,
      short_ref: typeof src?.short_ref === "string" ? src?.short_ref : undefined,
      journalTitle: typeof src?.journalTitle === "string" ? src?.journalTitle : undefined,
      authors,
      title: typeof src?.title === "string" ? src.title : undefined,
      issueLabel,
      issueId: typeof src?.issueId === "string" ? src?.issueId : undefined,
      year,
      section: typeof src?.section === "string" ? src.section : undefined,
      paragraphTitle: typeof src?.paragraphTitle === "string" ? src.paragraphTitle : typeof src?.paragraph_title === "string" ? src.paragraph_title : undefined,
      pages
    };
  });
}
