"use client";

export const STATUS_LABEL_KEYS = {
  PENDING: "admin.rag.status.pending",
  PROCESSING: "admin.rag.status.processing",
  COMPLETED: "admin.rag.status.completed",
  FAILED: "admin.rag.status.failed"
};

export const AUDIENCE_LABEL_KEYS = {
  SOCIAL_WORKER: "admin.rag.audience.social_worker",
  CLIENT: "admin.rag.audience.client",
  BOTH: "admin.rag.audience.both"
};

export const AUDIENCE_VALUES = ["SOCIAL_WORKER", "CLIENT", "BOTH"];
const DEFAULT_POLL_MS = 15000;
export const POLL_MS = Number(process.env.NEXT_PUBLIC_RAG_POLL_MS || DEFAULT_POLL_MS);
export const PAGE_SIZE = 25;
export const DOCS_FETCH_LIMIT = 100;
export const MAX_DOCS_FETCH_PAGES = 50;

export const META_TEMPLATES = [
  { key: "base", labelKey: "admin.rag.meta.templates.base", file: "/rag-meta-templates/base.json" },
  { key: "periodical", labelKey: "admin.rag.meta.templates.periodical", file: "/rag-meta-templates/periodical.json" },
  { key: "regulation", labelKey: "admin.rag.meta.templates.regulation", file: "/rag-meta-templates/regulation.json" },
  { key: "report", labelKey: "admin.rag.meta.templates.report", file: "/rag-meta-templates/report.json" },
  { key: "web", labelKey: "admin.rag.meta.templates.web", file: "/rag-meta-templates/web.json" }
];

const META_REQUIRED_FIELDS = [
  { label: "docId", keys: ["docId", "doc_id"] },
  { label: "title", keys: ["title"] },
  { label: "section", keys: ["section"] },
  { label: "year", keys: ["year"] },
  { label: "audience", keys: ["audience"] },
  { label: "tags", keys: ["tags", "tags_list"] }
];

const META_RECOMMENDED_FIELDS = [
  { label: "description", keys: ["description"] },
  { label: "authors", keys: ["authors", "authors_list"] },
  { label: "issueLabel/issueId", keys: ["issueLabel", "issue_label", "issueId", "issue_id"] },
  { label: "articleId", keys: ["articleId", "article_id"] },
  { label: "pageRange", keys: ["pageRange"] },
  { label: "pdf_start_page/pdf_end_page", keys: ["pdf_start_page", "pdf_end_page", "pdfStartPage", "pdfEndPage"] },
  { label: "journalTitle", keys: ["journalTitle", "journal_title"] },
  { label: "language", keys: ["language"] },
  { label: "source_type", keys: ["source_type", "sourceType"] },
  { label: "source_url", keys: ["source_url", "sourceUrl", "url"] },
  { label: "collection_id", keys: ["collection_id", "collectionId"] },
  { label: "country", keys: ["country"] },
  { label: "jurisdiction_level", keys: ["jurisdiction_level", "jurisdictionLevel"] },
  { label: "municipality_name", keys: ["municipality_name", "municipalityName"] },
  { label: "district_name", keys: ["district_name", "districtName"] }
];

const hasMetaValue = (meta, keys = []) =>
  keys.some(key => {
    const value = meta?.[key];
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "number") return Number.isFinite(value);
    return String(value).trim().length > 0;
  });

export const validateMeta = meta => {
  const missingRequired = META_REQUIRED_FIELDS.filter(field => !hasMetaValue(meta, field.keys)).map(field => field.label);
  const missingRecommended = META_RECOMMENDED_FIELDS.filter(field => !hasMetaValue(meta, field.keys)).map(field => field.label);

  return {
    missingRequired,
    missingRecommended
  };
};

export function formatI18n(template, values) {
  if (typeof template !== "string") return "";
  if (!values || typeof values !== "object") return template;

  let out = template;
  for (const [key, value] of Object.entries(values)) {
    out = out.split(`{${key}}`).join(String(value));
  }

  return out;
}

export function toLocaleTag(locale) {
  const normalized = String(locale || "en").toLowerCase();
  if (normalized.startsWith("et")) return "et-EE";
  if (normalized.startsWith("ru")) return "ru-RU";
  return "en-US";
}

export const formatDateTime = (value, localeTag = "en-US") => {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat(localeTag, {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
  }
};

export const deriveStatus = doc => (doc && doc.status ? doc.status : "COMPLETED");
export const deriveSyncedAt = doc => doc?.insertedAt || doc?.lastIngested || doc?.updatedAt || doc?.createdAt || null;
export const deriveDocType = doc => normalizeUpper(doc?.type || doc?.source_type || "");

export const formatPdfRange = doc => {
  const start = doc?.pdf_start_page;
  const end = doc?.pdf_end_page;
  if (!start && !end) return "";
  if (start && end) return `${start}-${end}`;
  return String(start || end);
};

export const splitAuthors = value => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean).slice(0, 12);
  return String(value)
    .split(/[,;\n]+/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 12);
};

export const splitTags = value => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean).slice(0, 24);
  return String(value)
    .split(/[,;\n]+/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 24);
};

const normalizeAuthorsForDisplay = value => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return splitAuthors(value);
};

const normalizeTags = value => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return splitTags(value);
};

const normalizeString = value => (value == null ? "" : String(value).trim());
const normalizeUpper = value => normalizeString(value).toUpperCase();

export const createEmptyDetailForm = () => ({
  title: "",
  description: "",
  authors: "",
  section: "",
  year: "",
  issueLabel: "",
  issueId: "",
  journalTitle: "",
  articleId: "",
  audience: "BOTH",
  tags: "",
  pageRange: "",
  pdf_start_page: "",
  pdf_end_page: ""
});

export const buildDetailFormFromDoc = doc => ({
  title: doc.title || "",
  description: doc.description || "",
  authors: (doc.authors || []).join(", "),
  section: doc.section || "",
  year: doc.year ? String(doc.year) : "",
  issueLabel: doc.issueLabel || "",
  issueId: doc.issueId || "",
  journalTitle: doc.journalTitle || "",
  articleId: doc.articleId || "",
  audience: doc.audience || "BOTH",
  tags: (doc.tags || []).join(", "),
  pageRange: doc.pageRange || "",
  pdf_start_page: doc.pdf_start_page ? String(doc.pdf_start_page) : "",
  pdf_end_page: doc.pdf_end_page ? String(doc.pdf_end_page) : ""
});

export const normalizeDoc = item => {
  const meta = item.metadata || item;
  const authors = normalizeAuthorsForDisplay(item.authors || meta.authors);
  const tags = normalizeTags(item.tags || meta.tags);
  const id = item.id || meta.id || meta.articleId || meta.docId || meta.doc_id || meta.article_id;

  return {
    ...item,
    id,
    docId: normalizeString(meta.docId || meta.doc_id || id),
    articleId: normalizeString(meta.articleId || meta.article_id || ""),
    title: normalizeString(item.title || meta.title || ""),
    description: normalizeString(item.description || meta.description || ""),
    section: normalizeString(item.section || meta.section || ""),
    issueLabel: normalizeString(item.issueLabel || meta.issueLabel || meta.issue_id || ""),
    issueId: normalizeString(item.issueId || meta.issueId || meta.issue_id || ""),
    year: item.year || meta.year || "",
    audience: normalizeUpper(item.audience || meta.audience || "BOTH") || "BOTH",
    pageRange: normalizeString(item.pageRange || meta.pageRange || ""),
    authors,
    tags,
    pdf_start_page: meta.pdf_start_page,
    pdf_end_page: meta.pdf_end_page,
    source_path: meta.source_path || meta.sourcePath || item.source_path,
    source_url: normalizeString(meta.source_url || meta.sourceUrl || item.sourceUrl || meta.url || item.url || ""),
    url: normalizeString(item.url || meta.url || meta.source_url || meta.sourceUrl || item.sourceUrl || ""),
    journalTitle: normalizeString(item.journalTitle || meta.journalTitle || meta.journal_title || ""),
    language: normalizeString(item.language || meta.language || ""),
    source_type: normalizeString(meta.source_type || meta.sourceType || item.source_type || item.sourceType || item.type || ""),
    collection_id: normalizeString(meta.collection_id || meta.collectionId || item.collection_id || item.collectionId || ""),
    source_format: normalizeString(meta.source_format || meta.sourceFormat || item.source_format || item.sourceFormat || ""),
    municipality_id: normalizeString(meta.municipality_id || meta.municipalityId || item.municipality_id || item.municipalityId || ""),
    municipality_name: normalizeString(meta.municipality_name || meta.municipalityName || item.municipality_name || item.municipalityName || "")
  };
};
