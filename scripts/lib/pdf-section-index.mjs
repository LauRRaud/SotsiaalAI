import { PDFParse } from "pdf-parse";

import {
  DEFAULT_ALLOWED_GUIDANCE_CLAIMS,
  DISALLOWED_CURRENT_EVIDENCE_CLAIMS
} from "./knowledge-docs.mjs";

const DEFAULT_MAX_TOC_SCAN_PAGES = 10;
const DEFAULT_MAX_HEADING_SCAN_PAGES = 250;
const MAX_TITLE_LENGTH = 140;
const MIN_TOC_ENTRY_COUNT = 3;
const MIN_HEADING_ENTRY_COUNT = 3;

function clean(value) {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

function arrayValue(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function unique(values = []) {
  return [...new Set(arrayValue(values).map(clean).filter(Boolean))];
}

export function slugifySectionId(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return normalized || "section";
}

export function normalizePdfText(text) {
  return String(text || "")
    .replace(/\r\n?/gu, "\n")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function splitLines(text) {
  return normalizePdfText(text)
    .split("\n")
    .map(line => clean(line))
    .filter(Boolean);
}

function isLikelyNoiseLine(line) {
  const value = clean(line);
  if (value.length < 4 || value.length > MAX_TITLE_LENGTH) return true;
  if (/^(\d+|lk\s*\d+|page\s*\d+)$/iu.test(value)) return true;
  if (/https?:\/\/|www\.|@/iu.test(value)) return true;
  if (/^\W+$/u.test(value)) return true;
  if (/^(copyright|isbn|issn|doi|allikas|source)\b/iu.test(value)) return true;
  return false;
}

function parseTocEntry(line, pageCount = 0) {
  const value = clean(line).replace(/\s+\.{2,}\s*/gu, " ");
  const patterns = [
    /^(.{4,140}?)\s*(?:\.{2,}|…{2,}|\s{3,})(\d{1,4})$/u,
    /^((?:\d+(?:\.\d+)*\.?\s+)?[^\d].{3,130}?)\s+(\d{1,4})$/u
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) continue;
    const title = clean(match[1]).replace(/\.{2,}$/u, "").trim();
    const page = Number.parseInt(match[2], 10);
    if (!title || isLikelyNoiseLine(title)) continue;
    if (!Number.isInteger(page) || page < 1) continue;
    if (pageCount && page > pageCount + 2) continue;
    return { title, page_start: Math.max(1, Math.min(pageCount || page, page)) };
  }
  return null;
}

function dedupeEntries(entries = []) {
  const seen = new Set();
  return entries
    .filter(entry => entry?.title && Number.isInteger(entry.page_start))
    .sort((a, b) => a.page_start - b.page_start || a.title.localeCompare(b.title, "et"))
    .filter(entry => {
      const key = `${entry.page_start}:${entry.title.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function sectionTypeFromTitle(title, fallback = "detected_section") {
  const value = clean(title).toLowerCase();
  if (/taotlem|avaldu|taotlus|blanket|vorm/u.test(value)) return "application";
  if (/tingimus|sihtr|abik.lblikk|kellele|eligib/u.test(value)) return "eligibility";
  if (/kontakt|aadress|telefon|e-post|email/u.test(value)) return "contacts";
  if (/tasu|hind|summa|maksm/u.test(value)) return "fees";
  if (/t.htaeg|otsustam|menetlus/u.test(value)) return "deadlines";
  if (/(igus|seadus|m..rus|legal|basis)/u.test(value)) return "legal_basis";
  if (/kokkuv.te|sissejuhatus|eesm.rk|kirjeldus/u.test(value)) return "description";
  return fallback;
}

function buildSections(entries = [], metadata = {}, options = {}) {
  const pageCount = Number(options.pageCount) || 0;
  const evidenceRole = clean(metadata.evidence_role) || "background";
  const allowedClaims = unique(metadata.allowed_claim_types).length
    ? unique(metadata.allowed_claim_types)
    : DEFAULT_ALLOWED_GUIDANCE_CLAIMS;
  const disallowedClaims = unique(metadata.disallowed_claim_types).length
    ? unique(metadata.disallowed_claim_types)
    : DISALLOWED_CURRENT_EVIDENCE_CLAIMS;
  const topicTags = unique(metadata.topics || metadata.topic_tags || metadata.tags);
  const usedIds = new Map();
  const sorted = dedupeEntries(entries);

  return sorted.map((entry, index) => {
    const next = sorted[index + 1];
    const pageStart = Math.max(1, Number(entry.page_start) || 1);
    const pageEnd = next
      ? Math.max(pageStart, Number(next.page_start) - 1)
      : Math.max(pageStart, pageCount || pageStart);
    const baseId = `${String(pageStart).padStart(3, "0")}-${slugifySectionId(entry.title)}`;
    const duplicate = usedIds.get(baseId) || 0;
    usedIds.set(baseId, duplicate + 1);
    const sectionId = duplicate ? `${baseId}-${duplicate + 1}` : baseId;
    return {
      section_id: sectionId,
      title: clean(entry.title),
      page_start: pageStart,
      page_end: pageEnd,
      section_type: entry.section_type || sectionTypeFromTitle(entry.title, options.sectionType || "detected_section"),
      evidence_role: evidenceRole,
      allowed_claim_types: allowedClaims,
      disallowed_claim_types: disallowedClaims,
      topic_tags: topicTags,
      detection_method: options.method || entry.method || "unknown",
      detection_confidence: options.confidence || entry.confidence || "low"
    };
  });
}

export function detectTocSectionsFromPages(pages = [], options = {}) {
  const pageCount = Number(options.pageCount) || pages.length;
  const maxScanPages = Math.max(1, Number(options.maxTocScanPages) || DEFAULT_MAX_TOC_SCAN_PAGES);
  const scanPages = pages.slice(0, Math.min(maxScanPages, Math.max(1, Math.ceil(pageCount * 0.15))));
  const entries = [];
  const tocPages = [];

  for (const page of scanPages) {
    const pageNo = Number(page.page) || Number(page.pageNumber) || 0;
    const lines = splitLines(page.text || "");
    const hasTocLabel = lines.some(line => /^(sisukord|contents?|table of contents)$/iu.test(line));
    const parsed = lines.map(line => parseTocEntry(line, pageCount)).filter(Boolean);
    if (hasTocLabel || parsed.length >= MIN_TOC_ENTRY_COUNT) {
      entries.push(...parsed);
      if (pageNo) tocPages.push(pageNo);
    }
  }

  const deduped = dedupeEntries(entries);
  const confidence = deduped.length >= 6 && tocPages.length ? "high" : deduped.length >= MIN_TOC_ENTRY_COUNT ? "medium" : "none";
  return {
    entries: confidence === "none" ? [] : deduped,
    method: "toc",
    confidence,
    toc_pages: unique(tocPages).map(Number),
    warnings: confidence === "none" ? ["no reliable table of contents detected"] : []
  };
}

function isHeadingCandidate(line) {
  const value = clean(line);
  if (isLikelyNoiseLine(value)) return false;
  if (/[.!?]$/u.test(value) && value.length > 45) return false;
  if (/^[*-]\s+/u.test(value)) return false;
  if (/^\d{1,4}$/u.test(value)) return false;
  if (/^(joonis|tabel|allikas|source|figure|table)\b/iu.test(value)) return false;
  if (/^\d+(?:\.\d+)*\.?\s+\S.{3,120}$/u.test(value)) return true;
  const words = value.split(/\s+/u);
  if (words.length < 2 || words.length > 12) return false;
  const first = value[0] || "";
  if (first === first.toUpperCase() && !/[,:;]/u.test(value) && words.length <= 8) return true;
  const uppercaseRatio = [...value.replace(/[^A-Za-zA-Z0-9]/gu, "")].filter(ch => ch === ch.toUpperCase() && /[A-Z]/u.test(ch)).length / Math.max(1, value.length);
  return first === first.toUpperCase() && uppercaseRatio > 0.08;
}

export function detectHeadingSectionsFromPages(pages = [], options = {}) {
  const maxPages = Math.max(1, Number(options.maxHeadingScanPages) || DEFAULT_MAX_HEADING_SCAN_PAGES);
  const entries = [];
  for (const page of pages.slice(0, maxPages)) {
    const pageNo = Number(page.page) || Number(page.pageNumber) || 0;
    const lines = splitLines(page.text || "");
    const limitedLines = lines.slice(0, 35);
    for (const line of limitedLines) {
      if (!isHeadingCandidate(line)) continue;
      entries.push({
        title: line.replace(/^\d+(?:\.\d+)*\.?\s*/u, "").trim() || line,
        page_start: pageNo || 1,
        method: "heading"
      });
    }
  }
  const deduped = dedupeEntries(entries);
  const confidence = deduped.length >= 8 ? "medium" : deduped.length >= MIN_HEADING_ENTRY_COUNT ? "low" : "none";
  return {
    entries: confidence === "none" ? [] : deduped,
    method: "heading",
    confidence,
    heading_candidates_count: deduped.length,
    warnings: confidence === "none" ? ["no reliable heading structure detected"] : confidence === "low" ? ["heading structure detected with low confidence"] : []
  };
}

export function buildSectionIndexFromPageText(pages = [], metadata = {}, options = {}) {
  const pageCount = Number(options.pageCount) || pages.length;
  const warnings = [];
  const toc = detectTocSectionsFromPages(pages, { ...options, pageCount });
  if (toc.entries.length) {
    return {
      ok: true,
      page_count: pageCount,
      method: toc.method,
      confidence: toc.confidence,
      toc_pages: toc.toc_pages,
      sectionIndex: buildSections(toc.entries, metadata, {
        pageCount,
        method: "toc",
        confidence: toc.confidence,
        sectionType: "toc_section"
      }),
      warnings
    };
  }

  warnings.push(...toc.warnings);
  const headings = detectHeadingSectionsFromPages(pages, options);
  if (headings.entries.length) {
    return {
      ok: true,
      page_count: pageCount,
      method: headings.method,
      confidence: headings.confidence,
      toc_pages: [],
      heading_candidates_count: headings.heading_candidates_count,
      sectionIndex: buildSections(headings.entries, metadata, {
        pageCount,
        method: "heading",
        confidence: headings.confidence,
        sectionType: "detected_heading_section"
      }),
      warnings: [...warnings, ...headings.warnings]
    };
  }

  return {
    ok: false,
    page_count: pageCount,
    method: "none",
    confidence: "none",
    toc_pages: [],
    heading_candidates_count: headings.heading_candidates_count || 0,
    sectionIndex: [],
    warnings: [...warnings, ...headings.warnings, "sectionIndex remains empty"]
  };
}

export function applyPdfSectionAnalysisToMetadata(metadata = {}, analysis = {}) {
  const sectionIndex = Array.isArray(analysis.sectionIndex) ? analysis.sectionIndex : [];
  const warnings = unique(analysis.warnings || []);
  return {
    ...metadata,
    page_count: analysis.page_count || metadata.page_count || null,
    sectionIndex,
    pdf_section_analysis: {
      checked: true,
      ok: sectionIndex.length > 0,
      method: analysis.method || "none",
      confidence: analysis.confidence || "none",
      page_count: analysis.page_count || null,
      section_count: sectionIndex.length,
      toc_pages: analysis.toc_pages || [],
      heading_candidates_count: analysis.heading_candidates_count || 0,
      warnings
    },
    quality: {
      ...(metadata.quality || {}),
      section_index_complete: sectionIndex.length > 0,
      section_index_method: analysis.method || "none",
      section_index_confidence: analysis.confidence || "none",
      needs_manual_review: Boolean(metadata.quality?.needs_manual_review) || sectionIndex.length === 0 || analysis.confidence === "low"
    }
  };
}

export async function extractPdfPagesFromBuffer(buffer, options = {}) {
  const parser = new PDFParse({ data: buffer });
  try {
    const info = await parser.getInfo({ parsePageInfo: true });
    const total = Number(info.total) || Number(info.pages?.length) || 0;
    const maxPages = Math.min(total || Number(options.maxPages) || DEFAULT_MAX_HEADING_SCAN_PAGES, Number(options.maxPages) || total || DEFAULT_MAX_HEADING_SCAN_PAGES);
    const pages = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const result = await parser.getText({ partial: [page] });
      pages.push({ page, text: normalizePdfText(result?.text || "") });
    }
    return { page_count: total || pages.length, pages };
  } finally {
    await parser.destroy().catch(() => {});
  }
}

export async function analyzePdfSectionIndex(buffer, metadata = {}, options = {}) {
  const extracted = await extractPdfPagesFromBuffer(buffer, { maxPages: options.maxPages || DEFAULT_MAX_HEADING_SCAN_PAGES });
  return buildSectionIndexFromPageText(extracted.pages, metadata, {
    ...options,
    pageCount: extracted.page_count
  });
}
