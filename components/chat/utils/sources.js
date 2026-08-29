import { normalizePageReferences, uniqueSortedPageNumbers } from "../../../lib/chat/pageRanges.js";

export function normalizeSourceLabelPages(value) {
  return String(value || "").replace(/\blk\s+([\d](?:[\d\s,;\-–—]*\d)?)/giu, (match, pages) => {
    const normalized = normalizePageReferences(pages);
    return normalized ? `lk ${normalized}` : match;
  });
}

function uniqueSortedPages(pages) {
  return uniqueSortedPageNumbers(pages);
}
export function collapsePages(pages) {
  return normalizePageReferences(pages);
}
export function normalizePageRange(value) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (/^0+$/.test(raw)) return "";
  return normalizePageReferences(raw);
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
    ? normalizeSourceLabelPages(src.short_ref.trim())
    : "";
  const syntheticEvidenceRef = isSyntheticEvidenceRef(shortRef);
  const municipalityName = String(src?.municipalityName || src?.municipality_name || "").trim();
  const sourceType = String(src?.sourceType || src?.source_type || src?.type || "").trim().toLowerCase();
  const municipalSource = ["kov_service", "kov_service_info", "municipality_service", "kov_regulation"].includes(sourceType);
  if (shortRef && shortRef.length > 8 && !syntheticEvidenceRef) {
    if (!municipalSource) return shortRef;
    const kindLabel = sourceType === "kov_regulation" ? "kohalik õigusakt" : "teenuseinfo";
    const status = String(src?.sourceStatus || src?.source_status || "").trim().toLowerCase();
    const statusLabel = ["active", "current", "kehtiv"].includes(status) ? "kehtiv" : "";
    return joinSourceSegments([
      municipalityName && !shortRef.toLowerCase().includes(municipalityName.toLowerCase()) ? municipalityName : null,
      shortRef,
      [statusLabel, kindLabel].filter(Boolean).join(" ")
    ]);
  }

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
    const municipalityId = typeof src?.municipalityId === "string"
      ? src.municipalityId
      : typeof src?.municipality_id === "string"
        ? src.municipality_id
        : typeof src?.metadata?.municipalityId === "string"
          ? src.metadata.municipalityId
          : typeof src?.metadata?.municipality_id === "string"
            ? src.metadata.municipality_id
            : undefined;
    const municipalityName = typeof src?.municipalityName === "string"
      ? src.municipalityName
      : typeof src?.municipality_name === "string"
        ? src.municipality_name
        : typeof src?.metadata?.municipalityName === "string"
          ? src.metadata.municipalityName
          : typeof src?.metadata?.municipality_name === "string"
            ? src.metadata.municipality_name
            : undefined;
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
      source_type: sourceType,
      municipality_id: municipalityId,
      municipalityId,
      municipality_name: municipalityName,
      municipalityName,
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
