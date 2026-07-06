function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function firstValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    return value;
  }
  return null;
}

function normalizeWhitespace(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export const DEFAULT_AJAKIRI_LEGACY_REPLACEMENTS = Object.freeze({
  "sotsiaaltoo-1-2023-hooldekodude-rahastamise-reform-tahendab-kolossaalset-muutust-2023-1": {
    replacement_doc_id: "sotsiaaltoo-1-2023-hooldekodude-rahastamise-pohimotted-ja-kommentaar-2023-1",
    reason: "covered_by_combined_article"
  },
  "sotsiaaltoo-3-2022-mida-sotsiaaltootaja-saab-teha-enda-heaks-meelespea-2022-3": {
    replacement_doc_id: "sotsiaaltoo-3-2022-ole-iseenda-terapeut-koos-meelespeaga-2022-3",
    reason: "covered_by_combined_article"
  }
});

export function normalizeAjakiriTitle(value = "") {
  return normalizeWhitespace(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/&/g, " ja ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(sotsiaaltoo|ajakiri)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function flattenDocument(doc = {}) {
  const metadata = isObject(doc.metadata) ? doc.metadata : {};
  const docId = firstValue(doc.docId, doc.document_id, doc.documentId, metadata.document_id, metadata.documentId, doc.id);
  const sourceId = firstValue(doc.source_id, doc.sourceId, metadata.source_id, metadata.sourceId, docId);

  return {
    ...metadata,
    ...doc,
    doc_id: docId,
    docId,
    source_id: sourceId,
    document_id: firstValue(doc.document_id, doc.documentId, metadata.document_id, metadata.documentId, docId),
    title: firstValue(doc.title, metadata.title, doc.fileName, metadata.fileName, metadata.file_name),
    source_type: firstValue(doc.source_type, doc.sourceType, metadata.source_type, metadata.sourceType),
    source_file_type: firstValue(doc.source_file_type, doc.sourceFileType, metadata.source_file_type, metadata.sourceFileType),
    collection_id: firstValue(doc.collection_id, metadata.collection_id, doc.collectionId, metadata.collectionId),
    collection_family: firstValue(doc.collection_family, metadata.collection_family, doc.collectionFamily, metadata.collectionFamily),
    journalTitle: firstValue(doc.journalTitle, doc.journal_title, metadata.journalTitle, metadata.journal_title),
    type: firstValue(doc.type, metadata.type),
    year: firstValue(doc.year, metadata.year),
    fileName: firstValue(doc.fileName, metadata.fileName, metadata.file_name),
    source_path: firstValue(doc.source_path, metadata.source_path, doc.path, metadata.path)
  };
}

function lowerText(...values) {
  return values.filter(Boolean).map(value => String(value || "")).join(" ").toLowerCase();
}

export function extractAjakiriYear(doc = {}) {
  const flat = flattenDocument(doc);
  const direct = Number.parseInt(String(flat.year || ""), 10);
  if (Number.isFinite(direct) && direct >= 1900 && direct <= 2100) return direct;

  const text = lowerText(flat.docId, flat.source_id, flat.document_id, flat.fileName, flat.source_path);
  const matches = [...text.matchAll(/\b(20\d{2}|19\d{2})\b/g)].map(match => Number.parseInt(match[1], 10));
  return matches.length ? matches[matches.length - 1] : null;
}

export function isAjakiriDocument(doc = {}) {
  const flat = flattenDocument(doc);
  const text = lowerText(
    flat.collection_family,
    flat.collection_id,
    flat.journalTitle,
    flat.source_id,
    flat.document_id,
    flat.docId,
    flat.fileName,
    flat.source_path
  );

  return (
    flat.collection_family === "ajakiri_sotsiaaltoo" ||
    flat.collection_id === "sotsiaaltoo_articles" ||
    flat.journalTitle === "Sotsiaaltöö" ||
    text.includes("sotsiaaltoo") ||
    text.includes("sotsiaaltoo") ||
    text.includes("ajakiri_sotsiaaltoo")
  );
}

export function isArticleIngestDocument(doc = {}) {
  const flat = flattenDocument(doc);
  if (!isAjakiriDocument(flat)) return false;
  return flat.source_file_type === "article_ingest" || flat.source_type === "journal_article";
}

export function isLegacyAjakiriFileDocument(doc = {}) {
  const flat = flattenDocument(doc);
  if (!isAjakiriDocument(flat)) return false;
  if (isArticleIngestDocument(flat)) return false;

  const sourceType = String(flat.source_type || "").trim().toLowerCase();
  const sourceFileType = String(flat.source_file_type || "").trim().toLowerCase();
  const registryType = String(flat.type || "").trim().toUpperCase();

  return (
    sourceType === "file" ||
    sourceFileType === "unknown" ||
    (!sourceType && registryType === "FILE")
  );
}

function identityFor(doc = {}) {
  const flat = flattenDocument(doc);
  const titleKey = normalizeAjakiriTitle(flat.title);
  return {
    doc_id: String(flat.docId || flat.id || "").trim(),
    source_id: String(flat.source_id || "").trim(),
    document_id: String(flat.document_id || "").trim(),
    title: normalizeWhitespace(flat.title),
    title_key: titleKey,
    year: extractAjakiriYear(flat),
    source_type: String(flat.source_type || "").trim() || null,
    source_file_type: String(flat.source_file_type || "").trim() || null
  };
}

function chooseReplacement(candidates = [], legacy = {}) {
  const legacyYear = legacy.year;
  const exactYear = candidates.find(candidate => candidate.year && legacyYear && candidate.year === legacyYear);
  if (exactYear) {
    return {
      doc: exactYear,
      match_reason: "normalized_title_and_year"
    };
  }
  if (candidates.length === 1) {
    return {
      doc: candidates[0],
      match_reason: "unique_normalized_title"
    };
  }
  return null;
}

function chooseManualReplacement(legacy = {}, articleDocs = [], replacements = DEFAULT_AJAKIRI_LEGACY_REPLACEMENTS) {
  const mapping = replacements[legacy.doc_id];
  if (!mapping?.replacement_doc_id) return null;
  const replacement = articleDocs.find(article => article.doc_id === mapping.replacement_doc_id);
  if (!replacement) {
    return {
      missing: true,
      replacement_doc_id: mapping.replacement_doc_id,
      reason: mapping.reason || "manual_replacement_not_found"
    };
  }
  return {
    doc: replacement,
    reason: mapping.reason || "manual_replacement",
    match_reason: "manual_covered_by_combined_article"
  };
}

export function buildLegacyAjakiriCleanupPlan(documents = [], options = {}) {
  const articleDocs = [];
  const legacyDocs = [];
  const replacements = options.legacyReplacements || DEFAULT_AJAKIRI_LEGACY_REPLACEMENTS;

  for (const doc of documents) {
    if (isArticleIngestDocument(doc)) articleDocs.push(identityFor(doc));
    if (isLegacyAjakiriFileDocument(doc)) legacyDocs.push(identityFor(doc));
  }

  const articlesByTitle = new Map();
  for (const article of articleDocs) {
    if (!article.title_key || !article.doc_id) continue;
    const list = articlesByTitle.get(article.title_key) || [];
    list.push(article);
    articlesByTitle.set(article.title_key, list);
  }

  const actions = legacyDocs
    .filter(legacy => legacy.doc_id)
    .map(legacy => {
      const candidates = legacy.title_key ? articlesByTitle.get(legacy.title_key) || [] : [];
      const automaticReplacement = chooseReplacement(
        candidates.filter(candidate => candidate.doc_id !== legacy.doc_id),
        legacy
      );
      const manualReplacement = automaticReplacement
        ? null
        : chooseManualReplacement(legacy, articleDocs, replacements);
      const replacement = automaticReplacement || manualReplacement;

      if (!replacement || replacement.missing) {
        return {
          action: "review_legacy",
          doc_id: legacy.doc_id,
          source_id: legacy.source_id,
          document_id: legacy.document_id,
          title: legacy.title,
          title_key: legacy.title_key,
          year: legacy.year,
          source_type: legacy.source_type,
          source_file_type: legacy.source_file_type,
          reason: replacement?.missing
            ? "manual_replacement_not_found"
            : candidates.length > 1 ? "ambiguous_replacement" : "replacement_not_found",
          expected_replacement_doc_id: replacement?.replacement_doc_id || null,
          replacement_candidates: candidates.map(candidate => ({
            doc_id: candidate.doc_id,
            source_id: candidate.source_id,
            title: candidate.title,
            year: candidate.year
          }))
        };
      }

      return {
        action: "delete_duplicate",
        doc_id: legacy.doc_id,
        source_id: legacy.source_id,
        document_id: legacy.document_id,
        title: legacy.title,
        title_key: legacy.title_key,
        year: legacy.year,
        source_type: legacy.source_type,
        source_file_type: legacy.source_file_type,
        reason: replacement.reason || "legacy_file_replaced_by_article_ingest",
        replacement_doc_id: replacement.doc.doc_id,
        replacement_source_id: replacement.doc.source_id,
        replacement_title: replacement.doc.title,
        replacement_year: replacement.doc.year,
        match_reason: replacement.match_reason
      };
    })
    .sort((a, b) => String(a.title || a.doc_id).localeCompare(String(b.title || b.doc_id)));

  const summary = actions.reduce((acc, item) => {
    acc[item.action] = (acc[item.action] || 0) + 1;
    return acc;
  }, {
    total_documents: documents.length,
    article_ingest_documents: articleDocs.length,
    legacy_ajakiri_file_documents: legacyDocs.length
  });

  return {
    ok: true,
    summary,
    actions
  };
}

export function buildAjakiriRemovalPlan(documents = []) {
  const actions = [];
  const bySourceType = {};
  const bySourceFileType = {};

  for (const doc of documents) {
    if (!isAjakiriDocument(doc)) continue;
    const identity = identityFor(doc);
    if (!identity.doc_id) continue;

    const sourceType = identity.source_type || "unknown";
    const sourceFileType = identity.source_file_type || "unknown";
    bySourceType[sourceType] = (bySourceType[sourceType] || 0) + 1;
    bySourceFileType[sourceFileType] = (bySourceFileType[sourceFileType] || 0) + 1;

    actions.push({
      action: "delete_ajakiri_document",
      doc_id: identity.doc_id,
      source_id: identity.source_id,
      document_id: identity.document_id,
      title: identity.title,
      year: identity.year,
      source_type: identity.source_type,
      source_file_type: identity.source_file_type,
      reason: "remove_ajakiri_corpus_from_rag_index"
    });
  }

  actions.sort((a, b) => String(a.doc_id).localeCompare(String(b.doc_id)));

  return {
    ok: true,
    summary: {
      total_documents: documents.length,
      ajakiri_documents: actions.length,
      by_source_type: bySourceType,
      by_source_file_type: bySourceFileType
    },
    actions
  };
}
