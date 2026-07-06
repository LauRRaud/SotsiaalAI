import { domainToUnicode } from "node:url";

import { RAG_CTX_MAX_CHARS, RAG_CTX_HEADROOM, CONTEXT_GROUPS_MAX, RAG_GROUP_BODY_MAX_CHARS } from "./settings.js";
import { KOV_RAG_SOURCE_TYPE_SET } from "../rag/sourceMetadata.js";

const OFFICIAL_RANK_SOURCE_TYPES = new Set([
  "national_law",
  "law",
  "kov_regulation",
  "regulation",
  "state_guide",
  "kov_service_info",
  "official_form",
  "application_form",
  "web_form",
  "pdf_form",
  "official_contact",
  "contact_page"
]);

const HIGH_AUTHORITY_SOURCE_TYPES = new Set([
  "national_law",
  "law",
  "kov_regulation",
  "regulation",
  "state_guide"
]);

const BACKGROUND_RANK_SOURCE_TYPES = new Set([
  "journal_article",
  "practice_example",
  "project_description",
  "personal_story",
  "opinion",
  "methodology_guide",
  "quality_guideline",
  "service_standard",
  "template",
  "faq"
]);

const AS_ARRAY = value => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(v => String(v).trim()).filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
};

function normalizeTopicValue(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isMissingAuthorLabel(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "autor puudub" || normalized.startsWith("autor puudub ");
}

function cleanAuthors(value) {
  return AS_ARRAY(value).filter(author => !isMissingAuthorLabel(author));
}

function coerceBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return ["1", "true", "yes", "on"].includes(normalized);
}

export function displayUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    const unicodeHost = domainToUnicode(parsed.hostname) || parsed.hostname;
    const auth = parsed.username
      ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ""}@`
      : "";
    const host = `${unicodeHost}${parsed.port ? `:${parsed.port}` : ""}`;
    return `${parsed.protocol}//${auth}${host}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return raw;
  }
}

function displayUrlsInText(text = "") {
  return String(text || "").replace(/\bhttps?:\/\/[^\s<>"\]]+/g, (match) => {
    let url = match;
    let suffix = "";
    while (/[),.;:!?]$/.test(url)) {
      suffix = `${url.slice(-1)}${suffix}`;
      url = url.slice(0, -1);
    }
    return `${displayUrl(url)}${suffix}`;
  });
}

function stripSyntheticRagPrefix(text = "") {
  const raw = String(text || "").trim();
  if (!raw.startsWith("[TITLE]")) return raw;

  let body = raw.replace(
    /^\[TITLE\][\s\S]*?\[STATUS\]\s*(?:active|inactive|archived|stale|unknown|historical)\s*/i,
    ""
  );
  body = body.replace(/^\s*\[PAGES\]\s*[\d,\s\-–—]+/i, "");
  body = body.trim();

  return body || raw;
}

export function collapsePages(pages) {
  if (!Array.isArray(pages) || pages.length === 0) return "";
  const sorted = [...new Set(pages.filter(page => Number.isFinite(page) && page > 0))].sort((a, b) => a - b);
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
function normalizeMatch(m, idx) {
  const md = m?.metadata || {};
  const title = md.title || m?.title || md.fileName || m?.url || "Allikas";
  const bodyRaw = stripSyntheticRagPrefix(m?.text || m?.chunk || "" || "");
  const synth = [];
  if (!bodyRaw) {
    if (md.title) synth.push(md.title);
    const auth = cleanAuthors(md.authors || m?.authors);
    if (auth.length) synth.push(`Autor(id): ${auth.join(", ")}`);
    const jr = (md.journal_title || md.journalTitle || "").trim();
    const issue = (md.issueLabel || md.issueId || md.year || "").toString().trim();
    const mix = [jr, issue].filter(Boolean).join(" ");
    if (mix) synth.push(mix);
  }
  const body = bodyRaw || (synth.length ? synth.join(" · ") : "");
  const audience = md.audience || m?.audience || null;
  const url =
    md.source_url ||
    md.sourceUrl ||
    md.url ||
    md.url_canonical ||
    md.urlCanonical ||
    md.official_url ||
    md.officialUrl ||
    md.official_website ||
    md.officialWebsite ||
    m?.source_url ||
    m?.sourceUrl ||
    m?.url ||
    m?.url_canonical ||
    m?.urlCanonical ||
    m?.official_url ||
    m?.officialUrl ||
    m?.official_website ||
    m?.officialWebsite ||
    null;
  const fileName = m?.fileName || md.fileName || (md.source_path ? md.source_path.split("/").pop() : null) || null;
  const page = m?.page ?? md.page ?? null;
  const score = typeof m?.hybrid_score === "number"
    ? m.hybrid_score
    : typeof m?.hybridScore === "number"
      ? m.hybridScore
      : typeof m?.distance === "number"
        ? 1 - m.distance
        : null;
  const denseScore = typeof m?.dense_score === "number" ? m.dense_score : null;
  const lexicalScore = typeof m?.lexical_score === "number" ? m.lexical_score : null;
  const lexicalScoreNormalized = typeof m?.lexical_score_normalized === "number" ? m.lexical_score_normalized : null;
  const bm25Score = typeof m?.bm25_score === "number" ? m.bm25_score : null;
  const bm25Coverage = typeof m?.bm25_coverage === "number" ? m.bm25_coverage : null;
  const bm25Matches = Number.isFinite(Number(m?.bm25_matches)) ? Number(m.bm25_matches) : null;
  const bm25QueryTokens = Number.isFinite(Number(m?.bm25_query_tokens)) ? Number(m.bm25_query_tokens) : null;
  const rrfScore = typeof m?.rrf_score === "number" ? m.rrf_score : null;
  const channelBoost = typeof m?.channel_boost === "number" ? m.channel_boost : null;
  const hybridRank = Number.isFinite(Number(m?.hybrid_rank || m?.hybridRank)) ? Number(m?.hybrid_rank || m?.hybridRank) : null;
  const denseRank = Number.isFinite(Number(m?.dense_rank)) ? Number(m.dense_rank) : null;
  const lexicalRank = Number.isFinite(Number(m?.lexical_rank)) ? Number(m.lexical_rank) : null;
  const retrievalScores = m?.retrieval_scores && typeof m.retrieval_scores === "object" && !Array.isArray(m.retrieval_scores)
    ? m.retrieval_scores
    : null;
  const authors = cleanAuthors(md.authors || m?.authors);
  const pages = Array.isArray(md.pages) ? md.pages.filter(Number.isFinite) : Array.isArray(m?.pages) ? m.pages.filter(Number.isFinite) : [];
  if (Number.isFinite(page)) pages.push(page);
  const pageRange = md.pageRange || md.page_range || m?.pageRange || null;
  const issueLabel = md.issueLabel || md.issue_label || m?.issueLabel || null;
  const issueId = md.issueId || md.issue_id || m?.issueId || null;
  const journalTitle = md.journal_title || md.journalTitle || m?.journal_title || m?.journalTitle || null;
  const articleId = md.articleId || md.article_id || m?.articleId || null;
  const section = md.section || m?.section || null;
  const paragraphTitle = md.paragraph_title || md.paragraphTitle || m?.paragraph_title || m?.paragraphTitle || null;
  const paragraphNumber = md.paragraph_number || md.paragraphNumber || m?.paragraph_number || m?.paragraphNumber || null;
  const actTitle = md.act_title || md.actTitle || m?.act_title || m?.actTitle || null;
  const subsectionNumber = md.subsection_number || md.subsectionNumber || m?.subsection_number || m?.subsectionNumber || null;
  const pointNumber = md.point_number || md.pointNumber || m?.point_number || m?.pointNumber || null;
  const year = md.year || m?.year || null;
  const docId = md.doc_id || md.docId || m?.doc_id || m?.docId || null;
  const chunkId = md.chunk_id || md.chunkId || md.canonical_chunk_id || md.canonicalChunkId || m?.chunk_id || m?.chunkId || m?.canonical_chunk_id || m?.canonicalChunkId || m?.id || null;
  const sourceId = md.source_id || md.sourceId || m?.source_id || m?.sourceId || null;
  const organizationName = md.organization_name || md.organizationName || m?.organization_name || m?.organizationName || null;
  const organizationId = md.organization_id || md.organizationId || m?.organization_id || m?.organizationId || null;
  const organizationSlug = md.organization_slug || md.organizationSlug || m?.organization_slug || m?.organizationSlug || null;
  const officialWebsite = md.official_website || md.officialWebsite || m?.official_website || m?.officialWebsite || null;
  const municipalityId = md.municipality_id || md.municipalityId || m?.municipality_id || m?.municipalityId || null;
  const authority = md.authority || m?.authority || null;
  const sourceStatus = md.source_status || md.sourceStatus || md.content_status || md.contentStatus || m?.source_status || m?.sourceStatus || m?.content_status || m?.contentStatus || null;
  const lastChecked = md.last_checked || md.lastChecked || m?.last_checked || m?.lastChecked || null;
  const validFrom = md.valid_from || md.validFrom || m?.valid_from || m?.validFrom || null;
  const validTo = md.valid_to || md.validTo || m?.valid_to || m?.validTo || null;
  const historical = coerceBoolean(md.historical ?? m?.historical);
  const canonicalItemId = md.canonical_item_id || md.canonicalItemId || m?.canonical_item_id || m?.canonicalItemId || null;
  const itemId = md.item_id || md.itemId || m?.item_id || m?.itemId || null;
  const sourceType = md.source_type || m?.source_type || null;
  const collectionId = md.collection_id || m?.collection_id || null;
  const itemType = md.item_type || m?.item_type || null;
  const resourceType = md.resource_type || md.resourceType || m?.resource_type || m?.resourceType || null;
  const relatedForms = Array.isArray(md.related_forms)
    ? md.related_forms
    : Array.isArray(md.relatedForms)
      ? md.relatedForms
      : Array.isArray(m?.related_forms)
        ? m.related_forms
        : Array.isArray(m?.relatedForms)
          ? m.relatedForms
          : typeof md.related_forms === "string"
            ? md.related_forms.split(/[,;]/).map(s => s.trim()).filter(Boolean)
            : typeof md.relatedForms === "string"
              ? md.relatedForms.split(/[,;]/).map(s => s.trim()).filter(Boolean)
              : null;
  const relatedContacts = Array.isArray(md.related_contacts)
    ? md.related_contacts
    : Array.isArray(md.relatedContacts)
      ? md.relatedContacts
      : Array.isArray(m?.related_contacts)
        ? m.related_contacts
        : Array.isArray(m?.relatedContacts)
          ? m.relatedContacts
          : typeof md.related_contacts === "string"
            ? md.related_contacts.split(/[,;]/).map(s => s.trim()).filter(Boolean)
            : typeof md.relatedContacts === "string"
              ? md.relatedContacts.split(/[,;]/).map(s => s.trim()).filter(Boolean)
              : null;
  const relatedTo = Array.isArray(md.related_to)
    ? md.related_to
    : Array.isArray(md.relatedTo)
      ? md.relatedTo
      : Array.isArray(m?.related_to)
        ? m.related_to
        : Array.isArray(m?.relatedTo)
          ? m.relatedTo
          : typeof md.related_to === "string"
            ? md.related_to.split(/[,;]/).map(s => s.trim()).filter(Boolean)
            : typeof md.relatedTo === "string"
              ? md.relatedTo.split(/[,;]/).map(s => s.trim()).filter(Boolean)
              : null;
  const sectionsPresent = Array.isArray(md.sections_present)
    ? md.sections_present
    : Array.isArray(md.sectionsPresent)
      ? md.sectionsPresent
      : Array.isArray(m?.sections_present)
        ? m.sections_present
        : Array.isArray(m?.sectionsPresent)
          ? m.sectionsPresent
          : typeof md.sections_present === "string"
            ? md.sections_present.split(/[,;]/).map(s => s.trim()).filter(Boolean)
            : typeof md.sectionsPresent === "string"
              ? md.sectionsPresent.split(/[,;]/).map(s => s.trim()).filter(Boolean)
              : typeof m?.sections_present === "string"
                ? m.sections_present.split(/[,;]/).map(s => s.trim()).filter(Boolean)
                : typeof m?.sectionsPresent === "string"
                  ? m.sectionsPresent.split(/[,;]/).map(s => s.trim()).filter(Boolean)
                  : null;
  const jurisdictionLevel = md.jurisdiction_level || md.jurisdictionLevel || m?.jurisdiction_level || m?.jurisdictionLevel || null;
  const municipalityName = md.municipality_name || md.municipalityName || md.municipality || m?.municipality_name || m?.municipalityName || m?.municipality || null;
  const tags = Array.isArray(md.tags) && md.tags || (typeof md.tags === "string" ? md.tags.split(/[,;]/).map(s => s.trim()).filter(Boolean) : null) || Array.isArray(m?.tags) && m.tags || null;
  const retrievalChannels = [
    ...(Array.isArray(m?.retrieval_channels) ? m.retrieval_channels : []),
    ...(Array.isArray(m?.retrievalChannels) ? m.retrievalChannels : []),
    m?.retrieval_channel,
    m?.retrievalChannel,
    m?.retriever
  ].map(value => String(value || "").trim()).filter(Boolean);
  return {
    id: m?.id || `${title}-${idx}`,
    sourceId,
    docId,
    chunkId,
    itemId,
    articleId,
    title,
    body,
    audience,
    url,
    fileName,
    page,
    score,
    authors,
    pages,
    pageRange,
    issueLabel,
    issueId,
    journalTitle,
    section,
    paragraphTitle,
    paragraphNumber,
    actTitle,
    subsectionNumber,
    pointNumber,
    year,
    authority,
    organizationName,
    organizationId,
    organizationSlug,
    officialWebsite,
    municipalityId,
    sourceStatus,
    lastChecked,
    validFrom,
    validTo,
    historical,
    canonicalItemId,
    sourceType,
    collectionId,
    itemType,
    resourceType,
    relatedForms,
    relatedContacts,
    relatedTo,
    sectionsPresent,
    jurisdictionLevel,
    municipalityName,
    tags: Array.isArray(tags) ? tags : tags ? [tags].flat().filter(Boolean) : null,
    retrievalChannels,
    denseScore,
    lexicalScore,
    lexicalScoreNormalized,
    bm25Score,
    bm25Coverage,
    bm25Matches,
    bm25QueryTokens,
    rrfScore,
    channelBoost,
    hybridRank,
    denseRank,
    lexicalRank,
    retrievalScores
  };
}

function isMunicipalityScopedMatch(raw) {
  const md = raw?.metadata || {};
  const collectionId = String(md.collection_id || raw?.collection_id || "").trim();
  const sourceType = String(md.source_type || raw?.source_type || "").trim();
  const jurisdictionLevel = String(md.jurisdiction_level || md.jurisdictionLevel || raw?.jurisdiction_level || "").trim().toUpperCase();
  const municipalityName = String(
    md.municipality_name || md.municipalityName || md.municipality || raw?.municipality_name || raw?.municipality || ""
  ).trim();

  if (collectionId === "kov_services" || collectionId === "kov_regulations" || collectionId === "kov_legal") return true;
  if (sourceType === "municipality_kov") return true;
  if (jurisdictionLevel === "MUNICIPAL" || jurisdictionLevel === "LOCAL" || jurisdictionLevel === "KOV") return true;
  if (municipalityName && jurisdictionLevel !== "NATIONAL") return true;
  return false;
}

export function filterMunicipalityScopedMatches(matches, options = {}) {
  if (!Array.isArray(matches) || matches.length === 0) return [];
  if (options?.allowMunicipalityScoped) return matches;
  return matches.filter(match => !isMunicipalityScopedMatch(match));
}

function normalizeMunicipalityCompareValue(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function matchMunicipalityId(raw = {}) {
  const md = raw?.metadata || {};
  return md.municipality_id || md.municipalityId || raw?.municipality_id || raw?.municipalityId || "";
}

function matchMunicipalityName(raw = {}) {
  const md = raw?.metadata || {};
  return md.municipality_name || md.municipalityName || md.municipality || raw?.municipality_name || raw?.municipalityName || raw?.municipality || "";
}

export function filterMatchesToMunicipalities(matches, municipalities = []) {
  if (!Array.isArray(matches) || matches.length === 0) return [];
  const allowedIds = new Set();
  const allowedNames = new Set();
  for (const municipality of Array.isArray(municipalities) ? municipalities : []) {
    const municipalityId = normalizeMunicipalityCompareValue(
      municipality?.id || municipality?.municipalityId || municipality?.municipality_id || ""
    );
    const municipalityName = normalizeMunicipalityCompareValue(municipality?.displayName || municipality?.name || "");
    if (municipalityId) allowedIds.add(municipalityId);
    if (municipalityName) allowedNames.add(municipalityName);
  }
  if (!allowedIds.size && !allowedNames.size) return matches;

  return matches.filter((match) => {
    if (!isMunicipalityScopedMatch(match)) return true;
    const municipalityId = normalizeMunicipalityCompareValue(matchMunicipalityId(match));
    const municipalityName = normalizeMunicipalityCompareValue(matchMunicipalityName(match));
    if (municipalityId && allowedIds.has(municipalityId)) return true;
    if (municipalityName && allowedNames.has(municipalityName)) return true;
    return !municipalityId && !municipalityName;
  });
}

function normalizeLegalValue(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .trim();
}

function legalParagraphSet(values = []) {
  return new Set(
    (Array.isArray(values) ? values : [values])
      .map(value => String(value || "").trim())
      .filter(Boolean)
  );
}

export function filterGroupsForLegalPlan(groups = [], legalLookupPlan = null) {
  if (!Array.isArray(groups) || !groups.length || !legalLookupPlan?.enabled) return Array.isArray(groups) ? groups : [];

  const allowedSourceTypes = new Set(
    (Array.isArray(legalLookupPlan.sourceTypes) ? legalLookupPlan.sourceTypes : [])
      .map(value => String(value || "").trim())
      .filter(Boolean)
  );
  const allowedParagraphs = legalParagraphSet(legalLookupPlan.paragraphRefs || []);
  const expectedActTitle = normalizeLegalValue(legalLookupPlan.actTitle || "");
  const expectedMunicipalityId = String(legalLookupPlan.municipalityId || "").trim();

  return groups.filter((group) => {
    const sourceType = String(group?.sourceType || "").trim();
    if (allowedSourceTypes.size && !allowedSourceTypes.has(sourceType)) return false;

    if (legalLookupPlan.requireCurrent) {
      const sourceStatus = String(group?.sourceStatus || "").trim().toLowerCase();
      if (sourceStatus && sourceStatus !== "active") return false;
      if (group?.historical === true) return false;
    }

    if (expectedActTitle) {
      const actTitle = normalizeLegalValue(group?.actTitle || group?.title || "");
      if (!actTitle || actTitle !== expectedActTitle) return false;
    }

    if (expectedMunicipalityId) {
      const municipalityId = String(group?.municipalityId || "").trim();
      if (!municipalityId || municipalityId !== expectedMunicipalityId) return false;
    }

    if (allowedParagraphs.size) {
      const paragraphNumber = String(group?.paragraphNumber || "").trim();
      if (!paragraphNumber || !allowedParagraphs.has(paragraphNumber)) return false;
    }

    return true;
  });
}

function bodyRelevanceScore(match = {}, index = 0) {
  let score = typeof match?.score === "number" ? match.score : 0;
  if (typeof match?.bm25Score === "number") score += Math.min(1.2, match.bm25Score * 0.12);
  if (typeof match?.lexicalScoreNormalized === "number") score += Math.min(0.5, match.lexicalScoreNormalized);
  const channels = Array.isArray(match?.retrievalChannels)
    ? match.retrievalChannels.map(channel => String(channel || "").trim()).filter(Boolean)
    : [];
  if (channels.includes("exact_phrase")) score += 0.35;
  if (channels.includes("bm25")) score += 0.22;
  if (channels.includes("title_match")) score += 0.1;
  if (typeof match?.hybridRank === "number") score += Math.max(0, 0.12 - match.hybridRank * 0.005);
  return score - index * 0.000001;
}

export function groupMatches(matches) {
  if (!Array.isArray(matches) || matches.length === 0) return [];
  const seenSnippets = new Set();
  const order = [];
  const grouped = new Map();
  matches.forEach((raw, idx) => {
    const m = normalizeMatch(raw, idx);
    if (!m.body) return;
    const snippetKey = `${m.title}|${m.page ?? ""}|${m.body.slice(0, 120)}`;
    if (seenSnippets.has(snippetKey)) return;
    seenSnippets.add(snippetKey);
    const isRegulationChunk =
      (m.collectionId === "kov_regulations" || m.collectionId === "kov_legal" || m.collectionId === "national_regulations") &&
      ["riigiteataja_regulation", "kov_regulation", "national_law", "law", "regulation"].includes(m.sourceType);
    const shouldKeepChunkSeparate =
      ((m.collectionId === "kov_services" && (m.sourceType === "municipality_kov" || KOV_RAG_SOURCE_TYPE_SET.has(m.sourceType))) ||
        isRegulationChunk) &&
      (m.itemId || m.chunkId);
    const regulationParagraphKey = isRegulationChunk && m.paragraphNumber
      ? [
          m.docId || m.sourceId || m.collectionId || "regulation",
          `paragraph-${m.paragraphNumber}`,
          m.paragraphTitle || ""
        ].join("|")
      : "";
    const regulationParagraphTitle = isRegulationChunk && m.paragraphNumber
      ? [
          m.actTitle || (m.title ? String(m.title).split(" - § ")[0] : "") || "Õigusakt",
          `§ ${m.paragraphNumber}`,
          m.paragraphTitle || ""
        ].filter(Boolean).join(" ")
      : "";
    const groupKey = shouldKeepChunkSeparate
      ? (m.itemId || regulationParagraphKey || m.chunkId)
      : m.articleId || m.docId || (m.title ? `${m.title}|${m.fileName || ""}` : m.id || `match-${idx}`);
    let entry = grouped.get(groupKey);
    if (!entry) {
      entry = {
        key: groupKey,
        docId: m.docId || null,
        articleId: m.articleId || null,
        title: regulationParagraphTitle || m.title || null,
        url: m.url || null,
        fileName: m.fileName || null,
        audience: m.audience || null,
        issueLabel: m.issueLabel || null,
        issueId: m.issueId || null,
        journalTitle: m.journalTitle || null,
        section: m.section || null,
        paragraphTitle: m.paragraphTitle || null,
        paragraphNumber: m.paragraphNumber || null,
        actTitle: m.actTitle || null,
        subsectionNumber: m.subsectionNumber || null,
        pointNumber: m.pointNumber || null,
        year: m.year || null,
        sourceId: m.sourceId || null,
        authority: m.authority || null,
        organizationName: m.organizationName || null,
        organizationId: m.organizationId || null,
        organizationSlug: m.organizationSlug || null,
        officialWebsite: m.officialWebsite || null,
        municipalityId: m.municipalityId || null,
        sourceStatus: m.sourceStatus || null,
        lastChecked: m.lastChecked || null,
        validFrom: m.validFrom || null,
        validTo: m.validTo || null,
        historical: !!m.historical,
        canonicalItemId: m.canonicalItemId || null,
        jurisdictionLevel: m.jurisdictionLevel || null,
        municipalityName: m.municipalityName || null,
        sourceType: m.sourceType || null,
        collectionId: m.collectionId || null,
        itemType: m.itemType || null,
        resourceType: m.resourceType || null,
        relatedForms: new Set(),
        relatedContacts: new Set(),
        relatedTo: new Set(),
        sectionsPresent: Array.isArray(m.sectionsPresent) ? new Set(m.sectionsPresent) : new Set(),
        bodies: [],
        bodyRecords: [],
        authors: new Set(),
        pages: new Set(),
        pageRanges: new Set(),
        tags: new Set(),
        retrievalChannels: new Set(),
        denseScores: [],
        lexicalScores: [],
        lexicalScoreNormalized: [],
        bm25Scores: [],
        bm25Coverages: [],
        bm25Matches: [],
        bm25QueryTokens: [],
        rrfScores: [],
        channelBoosts: [],
        hybridRanks: [],
        denseRanks: [],
        lexicalRanks: [],
        retrievalScores: [],
        scores: []
      };
      grouped.set(groupKey, entry);
      order.push(groupKey);
    }
    entry.bodies.push(m.body);
    entry.bodyRecords.push({
      body: m.body,
      score: bodyRelevanceScore(m, idx),
      index: idx
    });
    if (Array.isArray(m.authors)) {
      for (const author of m.authors) if (author) entry.authors.add(author);
    }
    if (Array.isArray(m.pages)) {
      for (const p of m.pages) if (Number.isFinite(p)) entry.pages.add(Number(p));
    }
    if (Number.isFinite(m.page)) entry.pages.add(Number(m.page));
    if (m.pageRange) entry.pageRanges.add(m.pageRange);
    if (Array.isArray(m.tags)) {
      for (const tag of m.tags) if (tag) entry.tags.add(tag);
    }
    if (Array.isArray(m.retrievalChannels)) {
      for (const channel of m.retrievalChannels) if (channel) entry.retrievalChannels.add(channel);
    }
    if (typeof m.denseScore === "number") entry.denseScores.push(m.denseScore);
    if (typeof m.lexicalScore === "number") entry.lexicalScores.push(m.lexicalScore);
    if (typeof m.lexicalScoreNormalized === "number") entry.lexicalScoreNormalized.push(m.lexicalScoreNormalized);
    if (typeof m.bm25Score === "number") entry.bm25Scores.push(m.bm25Score);
    if (typeof m.bm25Coverage === "number") entry.bm25Coverages.push(m.bm25Coverage);
    if (typeof m.bm25Matches === "number") entry.bm25Matches.push(m.bm25Matches);
    if (typeof m.bm25QueryTokens === "number") entry.bm25QueryTokens.push(m.bm25QueryTokens);
    if (typeof m.rrfScore === "number") entry.rrfScores.push(m.rrfScore);
    if (typeof m.channelBoost === "number") entry.channelBoosts.push(m.channelBoost);
    if (typeof m.hybridRank === "number") entry.hybridRanks.push(m.hybridRank);
    if (typeof m.denseRank === "number") entry.denseRanks.push(m.denseRank);
    if (typeof m.lexicalRank === "number") entry.lexicalRanks.push(m.lexicalRank);
    if (m.retrievalScores) entry.retrievalScores.push(m.retrievalScores);
    if (typeof m.score === "number") entry.scores.push(m.score);
    if (!entry.url && m.url) entry.url = m.url;
    if (!entry.fileName && m.fileName) entry.fileName = m.fileName;
    if (!entry.title && (regulationParagraphTitle || m.title)) entry.title = regulationParagraphTitle || m.title;
    if (!entry.audience && m.audience) entry.audience = m.audience;
    if (!entry.section && m.section) entry.section = m.section;
    if (!entry.paragraphTitle && m.paragraphTitle) entry.paragraphTitle = m.paragraphTitle;
    if (!entry.paragraphNumber && m.paragraphNumber) entry.paragraphNumber = m.paragraphNumber;
    if (!entry.actTitle && m.actTitle) entry.actTitle = m.actTitle;
    if (!entry.subsectionNumber && m.subsectionNumber) entry.subsectionNumber = m.subsectionNumber;
    if (!entry.pointNumber && m.pointNumber) entry.pointNumber = m.pointNumber;
    if (!entry.issueLabel && m.issueLabel) entry.issueLabel = m.issueLabel;
    if (!entry.issueId && m.issueId) entry.issueId = m.issueId;
    if (!entry.journalTitle && m.journalTitle) entry.journalTitle = m.journalTitle;
    if (!entry.year && m.year) entry.year = m.year;
    if (!entry.sourceId && m.sourceId) entry.sourceId = m.sourceId;
    if (!entry.authority && m.authority) entry.authority = m.authority;
    if (!entry.organizationName && m.organizationName) entry.organizationName = m.organizationName;
    if (!entry.organizationId && m.organizationId) entry.organizationId = m.organizationId;
    if (!entry.organizationSlug && m.organizationSlug) entry.organizationSlug = m.organizationSlug;
    if (!entry.officialWebsite && m.officialWebsite) entry.officialWebsite = m.officialWebsite;
    if (!entry.municipalityId && m.municipalityId) entry.municipalityId = m.municipalityId;
    if (!entry.sourceStatus && m.sourceStatus) entry.sourceStatus = m.sourceStatus;
    if (!entry.lastChecked && m.lastChecked) entry.lastChecked = m.lastChecked;
    if (!entry.validFrom && m.validFrom) entry.validFrom = m.validFrom;
    if (!entry.validTo && m.validTo) entry.validTo = m.validTo;
    if (m.historical) entry.historical = true;
    if (!entry.canonicalItemId && m.canonicalItemId) entry.canonicalItemId = m.canonicalItemId;
    if (!entry.docId && m.docId) entry.docId = m.docId;
    if (!entry.articleId && m.articleId) entry.articleId = m.articleId;
    if (!entry.jurisdictionLevel && m.jurisdictionLevel) entry.jurisdictionLevel = m.jurisdictionLevel;
    if (!entry.municipalityName && m.municipalityName) entry.municipalityName = m.municipalityName;
    if (!entry.sourceType && m.sourceType) entry.sourceType = m.sourceType;
    if (!entry.collectionId && m.collectionId) entry.collectionId = m.collectionId;
    if (!entry.itemType && m.itemType) entry.itemType = m.itemType;
    if (!entry.resourceType && m.resourceType) entry.resourceType = m.resourceType;
    if (Array.isArray(m.relatedForms)) {
      for (const related of m.relatedForms) if (related) entry.relatedForms.add(related);
    }
    if (Array.isArray(m.relatedContacts)) {
      for (const related of m.relatedContacts) if (related) entry.relatedContacts.add(related);
    }
    if (Array.isArray(m.relatedTo)) {
      for (const related of m.relatedTo) if (related) entry.relatedTo.add(related);
    }
    if (Array.isArray(m.sectionsPresent)) {
      for (const sectionName of m.sectionsPresent) if (sectionName) entry.sectionsPresent.add(sectionName);
    }
  });
  return order.map(key => {
    const entry = grouped.get(key);
    if (!entry) return null;
    const authors = Array.from(entry.authors);
    const pages = Array.from(entry.pages).sort((a, b) => a - b);
    const pageRanges = Array.from(entry.pageRanges);
    const tags = Array.from(entry.tags);
    const relatedForms = Array.from(entry.relatedForms || []);
    const relatedContacts = Array.from(entry.relatedContacts || []);
    const relatedTo = Array.from(entry.relatedTo || []);
    const sectionsPresent = Array.from(entry.sectionsPresent || []);
    const retrievalChannels = Array.from(entry.retrievalChannels);
    const bestScore = entry.scores.filter(s => typeof s === "number").sort((a, b) => b - a)[0];
    const bestDenseScore = entry.denseScores.filter(s => typeof s === "number").sort((a, b) => b - a)[0];
    const bestLexicalScore = entry.lexicalScores.filter(s => typeof s === "number").sort((a, b) => b - a)[0];
    const bestLexicalScoreNormalized = entry.lexicalScoreNormalized.filter(s => typeof s === "number").sort((a, b) => b - a)[0];
    const bestBm25Score = entry.bm25Scores.filter(s => typeof s === "number").sort((a, b) => b - a)[0];
    const bestBm25Coverage = entry.bm25Coverages.filter(s => typeof s === "number").sort((a, b) => b - a)[0];
    const bestBm25Matches = entry.bm25Matches.filter(s => typeof s === "number").sort((a, b) => b - a)[0];
    const bestBm25QueryTokens = entry.bm25QueryTokens.filter(s => typeof s === "number").sort((a, b) => b - a)[0];
    const bestRrfScore = entry.rrfScores.filter(s => typeof s === "number").sort((a, b) => b - a)[0];
    const bestChannelBoost = entry.channelBoosts.filter(s => typeof s === "number").sort((a, b) => b - a)[0];
    const bestHybridRank = entry.hybridRanks.filter(s => typeof s === "number").sort((a, b) => a - b)[0];
    const bestDenseRank = entry.denseRanks.filter(s => typeof s === "number").sort((a, b) => a - b)[0];
    const bestLexicalRank = entry.lexicalRanks.filter(s => typeof s === "number").sort((a, b) => a - b)[0];
    const sortedBodies = (Array.isArray(entry.bodyRecords) && entry.bodyRecords.length
      ? [...entry.bodyRecords]
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map(item => item.body)
      : entry.bodies
    ).filter(Boolean);
    const bodyPreview = sortedBodies.length ? sortedBodies[0] : "";
    const { bodyRecords: _bodyRecords, ...safeEntry } = entry;
    return {
      ...safeEntry,
      authors,
      pages,
      pageRanges,
      tags,
      relatedForms,
      relatedContacts,
      relatedTo,
      sectionsPresent,
      retrievalChannels,
      bestScore: typeof bestScore === "number" ? bestScore : null,
      denseScore: typeof bestDenseScore === "number" ? bestDenseScore : null,
      lexicalScore: typeof bestLexicalScore === "number" ? bestLexicalScore : null,
      lexicalScoreNormalized: typeof bestLexicalScoreNormalized === "number" ? bestLexicalScoreNormalized : null,
      bm25Score: typeof bestBm25Score === "number" ? bestBm25Score : null,
      bm25Coverage: typeof bestBm25Coverage === "number" ? bestBm25Coverage : null,
      bm25Matches: typeof bestBm25Matches === "number" ? bestBm25Matches : null,
      bm25QueryTokens: typeof bestBm25QueryTokens === "number" ? bestBm25QueryTokens : null,
      rrfScore: typeof bestRrfScore === "number" ? bestRrfScore : null,
      channelBoost: typeof bestChannelBoost === "number" ? bestChannelBoost : null,
      hybridRank: typeof bestHybridRank === "number" ? bestHybridRank : null,
      denseRank: typeof bestDenseRank === "number" ? bestDenseRank : null,
      lexicalRank: typeof bestLexicalRank === "number" ? bestLexicalRank : null,
      retrievalScores: entry.retrievalScores[0] || null,
      bodies: sortedBodies,
      __sig: [entry.title || "", bodyPreview].join("\n").toLowerCase()
    };
  }).filter(Boolean);
}
function scoreTopicHintMatch(group, topicHints = []) {
  if (!Array.isArray(topicHints) || !topicHints.length) return 0;
  const normalizedHints = Array.from(new Set(topicHints
    .map(item => normalizeTopicValue(item))
    .filter(Boolean)));
  if (!normalizedHints.length) return 0;

  const tags = Array.isArray(group?.tags) ? group.tags.map(tag => normalizeTopicValue(tag)).filter(Boolean) : [];
  const titleText = normalizeTopicValue([
    group?.title,
    group?.section,
    group?.paragraphTitle,
    group?.journalTitle,
    ...(Array.isArray(group?.bodies) ? group.bodies.slice(0, 2) : [])
  ].filter(Boolean).join(" \n "));

  let score = 0;
  for (const hint of normalizedHints) {
    const tagExact = tags.some(tag => tag === hint);
    const tagContains = !tagExact && tags.some(tag => tag.includes(hint) || hint.includes(tag));
    const textContains = titleText.includes(hint);

    if (tagExact) score += 0.26;
    else if (tagContains) score += 0.18;

    if (textContains) score += 0.18;
  }
  if (normalizedHints.length >= 2 && normalizedHints.every(hint => titleText.includes(hint))) {
    score += 0.22;
  }
  return score;
}
function parsePageSpan(pageRange = "", pages = []) {
  const rawRange = String(pageRange || "").trim();
  if (rawRange) {
    const normalized = rawRange.replace(/\s*[-–—]\s*/g, "-");
    const match = normalized.match(/^(\d+)-(\d+)$/);
    if (match) {
      const start = Number(match[1]);
      const end = Number(match[2]);
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        return end - start + 1;
      }
    }
    const single = normalized.match(/^(\d+)$/);
    if (single) return 1;
  }
  if (Array.isArray(pages) && pages.length) {
    const numeric = pages.filter(Number.isFinite);
    if (numeric.length) {
      const min = Math.min(...numeric);
      const max = Math.max(...numeric);
      if (Number.isFinite(min) && Number.isFinite(max) && max >= min) {
        return max - min + 1;
      }
    }
  }
  return null;
}
function scoreRiskFit(group, options = {}) {
  const policy = options?.ragRiskPolicy || options?.riskPolicy || null;
  if (!policy) return 0;

  const riskLevel = String(policy?.riskLevel || "low").trim().toLowerCase();
  const sourceType = String(group?.sourceType || "").trim();
  const preferredSourceTypes = Array.isArray(policy?.preferredSourceTypes)
    ? new Set(policy.preferredSourceTypes.map(value => String(value || "").trim()).filter(Boolean))
    : new Set();
  const isPreferred = preferredSourceTypes.has(sourceType);
  const isBackground = BACKGROUND_RANK_SOURCE_TYPES.has(sourceType) || sourceType === "historical_source";
  const isOfficial = OFFICIAL_RANK_SOURCE_TYPES.has(sourceType) || HIGH_AUTHORITY_SOURCE_TYPES.has(sourceType);
  const sourceStatus = String(group?.sourceStatus || "").trim().toLowerCase();
  const historical = group?.historical === true || String(group?.historical || "").trim().toLowerCase() === "true";

  let score = 0;
  if (riskLevel === "high") {
    if (isPreferred) score += 0.22;
    else if (isOfficial) score += 0.12;
    if (isBackground) score -= 0.18;
    if (historical || sourceStatus === "stale") score -= 0.12;
  } else if (riskLevel === "medium") {
    if (isPreferred) score += 0.16;
    else if (isOfficial) score += 0.08;
    if (isBackground) score -= 0.1;
    if (historical || sourceStatus === "stale") score -= 0.08;
  } else if (riskLevel === "low") {
    if (isPreferred) score += 0.1;
    if (isBackground && !historical) score += 0.04;
  }
  return score;
}

function scoreSourceQuality(group, options = {}) {
  const titleText = normalizeTopicValue(group?.title);
  const sectionText = normalizeTopicValue(group?.section || group?.paragraphTitle);
  const composite = [titleText, sectionText].filter(Boolean).join(" ");
  let score = 0;
  const retrievalChannels = Array.isArray(group?.retrievalChannels)
    ? group.retrievalChannels.map(channel => String(channel || "").trim()).filter(Boolean)
    : [];

  if (retrievalChannels.includes("title_match")) score += 0.4;
  if (retrievalChannels.includes("exact_phrase")) score += 0.25;
  if (retrievalChannels.includes("bm25")) score += 0.18;

  const sourceType = String(group?.sourceType || "").trim();
  const sourceStatus = String(group?.sourceStatus || "").trim().toLowerCase();
  const historical = group?.historical === true || String(group?.historical || "").trim().toLowerCase() === "true";

  if (HIGH_AUTHORITY_SOURCE_TYPES.has(sourceType)) score += 0.24;
  else if (OFFICIAL_RANK_SOURCE_TYPES.has(sourceType)) score += 0.18;
  else if (BACKGROUND_RANK_SOURCE_TYPES.has(sourceType)) score -= 0.08;

  if (sourceStatus === "active") score += 0.06;
  else if (sourceStatus === "stale") score -= 0.22;
  else if (sourceStatus === "inactive" || sourceStatus === "archived") score -= 0.5;

  if (historical || sourceType === "historical_source") score -= 0.35;

  if (/\b(eessona|juhtkiri|editorial|foreword|saatesona)\b/.test(composite)) score -= 0.42;
  else if (/\b(sissejuhatus|introduction|intro)\b/.test(composite)) score -= 0.12;

  const topicHintsText = Array.isArray(options?.topicHints)
    ? normalizeTopicValue(options.topicHints.join(" "))
    : "";
  const asksForAmendment = /\b(muudat|muutmi|amend|change)\b/.test(topicHintsText);
  if (!asksForAmendment && /\b(seaduse muutmine|muutmise|muudab|muudatus|rakendussate|rakendussäte)\b/.test(composite)) {
    score -= 0.52;
  }

  const pageSpan = parsePageSpan(group?.pageRanges?.[0], group?.pages);
  if (typeof pageSpan === "number") {
    if (pageSpan === 1) score -= 0.05;
    else if (pageSpan >= 3) score += 0.06;
    else if (pageSpan >= 2) score += 0.03;
  }

  if (Array.isArray(group?.authors) && group.authors.length >= 1) score += 0.01;
  if (Array.isArray(group?.bodies) && group.bodies[0] && String(group.bodies[0]).length >= 500) score += 0.03;
  score += scoreRiskFit(group, options);

  return score;
}
export function rankGroupsWithTopicHints(groups, topicHints = [], options = {}) {
  if (!Array.isArray(groups) || groups.length === 0) return [];
  return groups
    .map(group => {
      const topicBoost = scoreTopicHintMatch(group, topicHints);
      const qualityAdjust = scoreSourceQuality(group, { ...options, topicHints });
      const baseScore = typeof group?.bestScore === "number" ? group.bestScore : 0.3;
      return {
        ...group,
        topicBoost,
        qualityAdjust,
        rankScore: baseScore + topicBoost + qualityAdjust
      };
    })
    .sort((a, b) => {
      const aScore = typeof a?.rankScore === "number" ? a.rankScore : (a?.bestScore || 0);
      const bScore = typeof b?.rankScore === "number" ? b.rankScore : (b?.bestScore || 0);
      return bScore - aScore;
    });
}
export function diversifyGroupsMMR(groups, k = CONTEXT_GROUPS_MAX, lambda) {
  const L = typeof lambda === "number" ? lambda : 0.5;
  if (!Array.isArray(groups) || groups.length === 0) return [];
  const K = Math.max(1, Math.min(k, groups.length));
  const tokenize = s => new Set(String(s || "").toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean));
  const cacheTokens = new Map();
  const tok = g => {
    const key = g.key || g.docId || g.articleId || g.title || "";
    if (cacheTokens.has(key)) return cacheTokens.get(key);
    const t = tokenize(g.__sig || g.title || "");
    cacheTokens.set(key, t);
    return t;
  };
  const jaccard = (a, b) => {
    if (!a || !b || a.size === 0 || b.size === 0) return 0;
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    const uni = a.size + b.size - inter;
    return uni > 0 ? inter / uni : 0;
  };
  const remaining = [...groups].sort((a, b) => (b.bestScore || 0) - (a.bestScore || 0));
  const selected = [];
  while (selected.length < K && remaining.length) {
    let bestIdx = 0;
    let bestVal = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const g = remaining[i];
      const rel = typeof g.rankScore === "number"
        ? g.rankScore
        : typeof g.bestScore === "number"
          ? g.bestScore
          : 0.3;
      let div = 0;
      if (selected.length) {
        const gt = tok(g);
        let maxSim = 0;
        for (const s of selected) {
          const sim = jaccard(gt, tok(s));
          if (sim > maxSim) maxSim = sim;
        }
        div = maxSim;
      }
      const mmr = L * rel - (1 - L) * div;
      if (mmr > bestVal) {
        bestVal = mmr;
        bestIdx = i;
      }
    }
    selected.push(remaining.splice(bestIdx, 1)[0]);
  }
  return selected;
}

const DOCUMENT_IDENTITY_FIELDS = [
  ["document_id", ["document_id", "documentId"]],
  ["doc_id", ["doc_id", "docId"]],
  ["article_id", ["article_id", "articleId"]],
  ["source_id", ["source_id", "sourceId"]],
  ["canonical_item_id", ["canonical_item_id", "canonicalItemId"]],
  ["url_canonical", ["url_canonical", "urlCanonical"]],
  ["url", ["url"]],
  ["title", ["title"]]
];

function valueFromAnyField(group = {}, fields = []) {
  for (const field of fields) {
    const value = group?.[field];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

export function resolveDocumentIdentity(group = {}, index = 0) {
  for (const [field, candidates] of DOCUMENT_IDENTITY_FIELDS) {
    const value = valueFromAnyField(group, candidates);
    if (!value) continue;
    return {
      id: value,
      field,
      weak: field === "title"
    };
  }
  return {
    id: `unknown_document_${index}`,
    field: "none",
    weak: true
  };
}

function groupSourceIdentity(group = {}, index = 0) {
  return String(
    group.canonicalItemId ||
    group.sourceId ||
    group.docId ||
    group.articleId ||
    group.url ||
    group.title ||
    group.key ||
    resolveDocumentIdentity(group, index).id ||
    ""
  ).trim();
}

function overviewGroupScore(group = {}) {
  if (typeof group?.rankScore === "number" && Number.isFinite(group.rankScore)) return group.rankScore;
  if (typeof group?.bestScore === "number" && Number.isFinite(group.bestScore)) return group.bestScore;
  return 0.3;
}

function overviewText(group = {}) {
  return [
    group?.title,
    group?.section,
    group?.paragraphTitle,
    group?.shortRef,
    group?.issueLabel,
    ...(Array.isArray(group?.tags) ? group.tags : []),
    ...(Array.isArray(group?.bodies) ? group.bodies : [])
  ].filter(Boolean).join("\n");
}

function tokenizeOverviewText(value = "") {
  return new Set(
    normalizeTopicValue(value)
      .split(/[^a-z0-9]+/i)
      .map(token => token.trim())
      .filter(token => token.length >= 4)
  );
}

function setJaccard(a, b) {
  if (!a || !b || !a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function addsOverviewDepth(candidate, selectedForDocument = []) {
  if (!selectedForDocument.length) return true;
  const candidateTokens = tokenizeOverviewText(overviewText(candidate));
  if (!candidateTokens.size) return false;
  let maxSimilarity = 0;
  for (const selected of selectedForDocument) {
    const similarity = setJaccard(candidateTokens, tokenizeOverviewText(overviewText(selected)));
    if (similarity > maxSimilarity) maxSimilarity = similarity;
  }
  return maxSimilarity <= 0.72;
}

function countBy(values = []) {
  return values.reduce((acc, value) => {
    const key = String(value || "").trim() || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export function selectMultiSourceGroups(groups, k = CONTEXT_GROUPS_MAX, lambda) {
  if (!Array.isArray(groups) || groups.length === 0) return [];
  const limit = Math.max(1, Math.min(k, groups.length));
  const diversified = diversifyGroupsMMR(groups, groups.length, lambda);
  const selected = [];
  const selectedKeys = new Set();
  const selectedRefs = new Set();

  for (const group of diversified) {
    if (selected.length >= limit) break;
    const key = groupSourceIdentity(group);
    if (key && selectedKeys.has(key)) continue;
    selected.push(group);
    selectedRefs.add(group);
    if (key) selectedKeys.add(key);
  }

  for (const group of diversified) {
    if (selected.length >= limit) break;
    if (selectedRefs.has(group)) continue;
    selected.push(group);
    selectedRefs.add(group);
  }

  return selected;
}

export function selectOverviewSynthesisGroups(groups, k = CONTEXT_GROUPS_MAX, lambda, options = {}) {
  const list = Array.isArray(groups) ? groups : [];
  if (!list.length) {
    return {
      selected: [],
      metadata: {
        overview_synthesis_used: true,
        selection_strategy: "overview_diversity_then_depth",
        distinct_candidate_document_count: 0,
        distinct_relevant_candidate_document_count: 0,
        distinct_selected_document_count: 0,
        selected_document_ids: [],
        document_identity_fields_used: {},
        chunks_per_document: {},
        initial_diversity_pass_document_count: 0,
        depth_pass_added_chunks: 0,
        dominant_document_id: null,
        dominant_document_share: 0,
        dominant_document_allowed: true,
        dominant_document_reason: "not_enough_relevant_documents",
        source_diversity_limited: true,
        source_diversity_reason: "not_enough_relevant_documents"
      }
    };
  }

  const limit = Math.max(1, Math.min(Number.isFinite(Number(k)) ? Number(k) : CONTEXT_GROUPS_MAX, list.length));
  const minDocuments = Math.max(1, Number.isFinite(Number(options.minDocuments)) ? Number(options.minDocuments) : 3);
  const preferredSourceCount = Math.max(minDocuments, Number.isFinite(Number(options.preferredSourceCount)) ? Number(options.preferredSourceCount) : 6);
  const targetDocuments = Math.max(minDocuments, Math.min(8, preferredSourceCount));
  const dominantShareLimit = Number.isFinite(Number(options.dominantShareLimit)) ? Number(options.dominantShareLimit) : 0.4;

  const ranked = diversifyGroupsMMR(list, list.length, lambda).map((group, index) => {
    const identity = resolveDocumentIdentity(group, index);
    return {
      group,
      index,
      score: overviewGroupScore(group),
      identity
    };
  }).sort((a, b) => b.score - a.score || a.index - b.index);

  const topScore = ranked[0]?.score || 0;
  const relevanceThreshold = topScore > 0
    ? Math.max(0.15, topScore * 0.55)
    : 0.15;
  const relevant = ranked.filter(item => item.score >= relevanceThreshold);
  const candidateDocumentIds = Array.from(new Set(ranked.map(item => item.identity.id)));
  const relevantDocumentIds = Array.from(new Set(relevant.map(item => item.identity.id)));
  const identityFieldCounts = countBy(ranked.map(item => item.identity.field));

  const buckets = new Map();
  for (const item of relevant) {
    if (!buckets.has(item.identity.id)) {
      buckets.set(item.identity.id, {
        identity: item.identity,
        items: []
      });
    }
    buckets.get(item.identity.id).items.push(item);
  }
  const sortedBuckets = Array.from(buckets.values())
    .map(bucket => ({
      ...bucket,
      items: bucket.items.sort((a, b) => b.score - a.score || a.index - b.index),
      bestScore: bucket.items[0]?.score || 0
    }))
    .sort((a, b) => b.bestScore - a.bestScore);

  const selectedItems = [];
  const selectedRefs = new Set();
  const selectedByDocument = new Map();
  const diversityTarget = Math.min(limit, Math.max(minDocuments, Math.min(targetDocuments, sortedBuckets.length)));

  for (const bucket of sortedBuckets) {
    if (selectedItems.length >= diversityTarget) break;
    const item = bucket.items[0];
    if (!item || selectedRefs.has(item.group)) continue;
    selectedItems.push(item);
    selectedRefs.add(item.group);
    selectedByDocument.set(bucket.identity.id, [item.group]);
  }

  const diversityPassDocumentCount = selectedByDocument.size;
  let depthAdded = 0;
  const enoughRelevantDocuments = relevantDocumentIds.length >= minDocuments;
  const orderedDepthCandidates = sortedBuckets
    .flatMap(bucket => bucket.items.slice(1))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  for (const item of orderedDepthCandidates) {
    if (selectedItems.length >= limit) break;
    if (selectedRefs.has(item.group)) continue;
    const selectedForDocument = selectedByDocument.get(item.identity.id) || [];
    if (!addsOverviewDepth(item.group, selectedForDocument)) continue;

    if (enoughRelevantDocuments) {
      const currentCount = selectedForDocument.length;
      const projectedShare = (currentCount + 1) / (selectedItems.length + 1);
      if (projectedShare > dominantShareLimit) {
        continue;
      }
    }

    selectedItems.push(item);
    selectedRefs.add(item.group);
    selectedByDocument.set(item.identity.id, [...selectedForDocument, item.group]);
    depthAdded++;
  }

  for (const item of relevant) {
    if (selectedItems.length >= limit) break;
    if (selectedRefs.has(item.group)) continue;
    if (enoughRelevantDocuments) {
      const currentCount = selectedByDocument.get(item.identity.id)?.length || 0;
      const projectedShare = (currentCount + 1) / (selectedItems.length + 1);
      if (projectedShare > dominantShareLimit) continue;
    }
    selectedItems.push(item);
    selectedRefs.add(item.group);
    const selectedForDocument = selectedByDocument.get(item.identity.id) || [];
    selectedByDocument.set(item.identity.id, [...selectedForDocument, item.group]);
  }

  const selectedDocumentIds = Array.from(selectedByDocument.keys());
  const chunksPerDocument = Object.fromEntries(
    Array.from(selectedByDocument.entries()).map(([id, values]) => [id, values.length])
  );
  const dominantEntry = Object.entries(chunksPerDocument)
    .sort((a, b) => b[1] - a[1])[0] || [null, 0];
  const dominantShare = selectedItems.length ? dominantEntry[1] / selectedItems.length : 0;
  const weakIdentityCount = ranked.filter(item => item.identity.weak).length;
  const sourceDiversityLimited = relevantDocumentIds.length < minDocuments ||
    (selectedDocumentIds.length < Math.min(minDocuments, relevantDocumentIds.length)) ||
    weakIdentityCount > Math.floor(ranked.length / 2);
  const sourceDiversityReason = relevantDocumentIds.length < minDocuments
    ? "not_enough_relevant_documents"
    : weakIdentityCount > Math.floor(ranked.length / 2)
      ? "metadata_missing_document_ids"
      : sourceDiversityLimited
        ? "retrieval_returned_low_quality_candidates"
        : null;
  const dominantAllowed = dominantShare <= dominantShareLimit || !enoughRelevantDocuments || selectedDocumentIds.length < minDocuments;
  const dominantReason = dominantAllowed
    ? !enoughRelevantDocuments
      ? "not_enough_relevant_documents"
      : dominantShare <= dominantShareLimit
        ? "within_limit"
        : "single_authoritative_document"
    : "dominant_document_limited";

  return {
    selected: selectedItems.map(item => item.group),
    metadata: {
      overview_synthesis_used: true,
      selection_strategy: "overview_diversity_then_depth",
      distinct_candidate_document_count: candidateDocumentIds.length,
      distinct_relevant_candidate_document_count: relevantDocumentIds.length,
      distinct_selected_document_count: selectedDocumentIds.length,
      selected_document_ids: selectedDocumentIds,
      document_identity_fields_used: identityFieldCounts,
      chunks_per_document: chunksPerDocument,
      initial_diversity_pass_document_count: diversityPassDocumentCount,
      depth_pass_added_chunks: depthAdded,
      dominant_document_id: dominantEntry[0],
      dominant_document_share: Number(dominantShare.toFixed(3)),
      dominant_document_allowed: dominantAllowed,
      dominant_document_reason: dominantReason,
      source_diversity_limited: sourceDiversityLimited,
      source_diversity_reason: sourceDiversityReason
    }
  };
}
function inferGroupYear(group) {
  const directYear = group?.year;
  if (typeof directYear === "number" && Number.isFinite(directYear)) return directYear;
  if (typeof directYear === "string") {
    const matched = directYear.match(/\b(19|20)\d{2}\b/);
    if (matched) return Number(matched[0]);
  }
  const fallbacks = [group?.issueLabel, group?.issueId, group?.title];
  for (const value of fallbacks) {
    if (typeof value !== "string") continue;
    const matched = value.match(/\b(19|20)\d{2}\b/);
    if (matched) return Number(matched[0]);
  }
  return null;
}

function groupMentionsYear(group, year) {
  const yearText = String(year);
  const text = [
    group?.title,
    group?.section,
    group?.paragraphTitle,
    group?.issueLabel,
    group?.issueId,
    ...(Array.isArray(group?.bodies) ? group.bodies : [])
  ].filter(Boolean).join("\n");
  return new RegExp(`\\b${yearText}\\b`).test(text);
}

function inferTemporalEvidenceYears(group, targetYears = []) {
  const years = [];
  const directYear = inferGroupYear(group);
  for (const year of targetYears) {
    if (directYear === year || groupMentionsYear(group, year)) {
      years.push(year);
    }
  }
  return years;
}

export function selectTemporalGroups(groups, years = [], k = CONTEXT_GROUPS_MAX, lambda) {
  if (!Array.isArray(groups) || groups.length === 0) return [];
  const targetYears = Array.from(new Set((Array.isArray(years) ? years : [])
    .map(year => Number(year))
    .filter(year => Number.isInteger(year) && year >= 1900 && year <= 2100)));
  if (!targetYears.length) return diversifyGroupsMMR(groups, k, lambda);

  const allowedYears = new Set(targetYears);
  const yearScopedGroups = groups.filter(group => inferTemporalEvidenceYears(group, targetYears).length);
  if (!yearScopedGroups.length) return [];

  const limit = Math.max(1, Math.min(k, yearScopedGroups.length));
  const remaining = [...yearScopedGroups];
  const selected = [];

  for (const year of targetYears) {
    if (selected.length >= limit) break;
    const yearCandidates = remaining.filter(group => {
      const evidenceYears = inferTemporalEvidenceYears(group, targetYears);
      return evidenceYears.includes(year) && (allowedYears.has(inferGroupYear(group)) || groupMentionsYear(group, year));
    });
    if (!yearCandidates.length) continue;
    const picked = diversifyGroupsMMR(yearCandidates, 1, lambda)[0] || yearCandidates[0];
    if (!picked) continue;
    selected.push(picked);
    const pickedKey = picked.key || picked.docId || picked.articleId || picked.title || "";
    const removeIndex = remaining.findIndex(group => {
      const groupKey = group.key || group.docId || group.articleId || group.title || "";
      return groupKey === pickedKey;
    });
    if (removeIndex >= 0) remaining.splice(removeIndex, 1);
  }

  if (selected.length >= limit) return selected.slice(0, limit);

  const filler = diversifyGroupsMMR(remaining, limit - selected.length, lambda);
  return [...selected, ...filler].slice(0, limit);
}
function firstAuthor(authors) {
  if (!Array.isArray(authors) || authors.length === 0) return null;
  for (const author of authors) {
    if (typeof author !== "string") continue;
    const trimmed = author.trim();
    if (trimmed && !isMissingAuthorLabel(trimmed)) return trimmed;
  }
  return null;
}
function shortIssue(entry) {
  const label = typeof entry.issueLabel === "string" && entry.issueLabel.trim() || typeof entry.issueId === "string" && entry.issueId.trim() || "";
  if (label) return label;
  const {
    year
  } = entry;
  if (typeof year === "number" && Number.isFinite(year)) return String(year);
  if (typeof year === "string") {
    const trimmed = year.trim();
    if (!trimmed) return "";
    return trimmed;
  }
  return "";
}
function prettifyFileName(name = "") {
  if (typeof name !== "string" || !name.trim()) return "";
  const noExt = name.replace(/\.[a-z0-9]+$/i, "");
  return noExt.replace(/[_-]+/g, " ").trim();
}
export function makeShortRef(entry, pagesCompact) {
  const author = firstAuthor(entry.authors);
  const title = typeof entry.title === "string" ? entry.title.trim() : "";
  const journal = typeof entry.journalTitle === "string" && entry.journalTitle.trim() || "";
  const issueRaw = shortIssue(entry);
  const year = typeof entry.year === "number" ? String(entry.year) : typeof entry.year === "string" ? entry.year.trim() : "";
  const pagesStr = pagesCompact ? `lk ${pagesCompact}` : "";
  const paragraphTitle = typeof entry.paragraphTitle === "string" && entry.paragraphTitle.trim() ? entry.paragraphTitle.trim() : "";
  const section = !paragraphTitle && typeof entry.section === "string" && entry.section.trim() ? entry.section.trim() : "";
  const fallbackName = prettifyFileName(entry.fileName) || (typeof entry.url === "string" ? displayUrl(entry.url).replace(/^https?:\/\/(www\.)?/, "").trim() : "");
  const issue = issueRaw && year && issueRaw === year ? "" : issueRaw;
  const journalPart = [journal, issue].filter(Boolean).join(" ").trim();
  const headParts = [];
  if (author && title && year) headParts.push(`${author}, ${year}`);
  if (!headParts.length && author) headParts.push(author);
  if (title) headParts.push(title);
  if (journalPart) headParts.push(journalPart);
  if (!headParts.length && fallbackName) headParts.push(fallbackName);
  const parts = [headParts.join(". "), pagesStr, paragraphTitle || section].filter(Boolean);
  return parts.join(" · ");
}
export function renderOneContextBlock(entry, index, options = {}) {
  const requestedBodyMaxChars = Number(options?.bodyMaxChars);
  const bodyMaxChars = Number.isFinite(requestedBodyMaxChars) && requestedBodyMaxChars >= 80
    ? Math.min(RAG_GROUP_BODY_MAX_CHARS, Math.floor(requestedBodyMaxChars))
    : RAG_GROUP_BODY_MAX_CHARS;
  const authors = Array.isArray(entry.authors) ? entry.authors : [];
  const authorText = authors.length ? authors.slice(0, 2).join("; ") : null;
  const pageRangeText = Array.isArray(entry.pageRanges) ? Array.from(new Set(entry.pageRanges.filter(Boolean))).join(", ") : "";
  const pageText = pageRangeText || collapsePages(entry.pages);
  const paragraphNumberText = typeof entry.paragraphNumber === "string" && entry.paragraphNumber.trim()
    ? entry.paragraphNumber.trim()
    : typeof entry.paragraphNumber === "number"
      ? String(entry.paragraphNumber)
      : "";
  const journalText = [entry.journalTitle, entry.issueLabel || entry.issueId].filter(Boolean).join(" ").trim() || null;
  const yearText =
    typeof entry.year === "number"
      ? String(entry.year)
      : typeof entry.year === "string" && entry.year.trim()
        ? entry.year.trim()
        : null;
  const headerParts = [];
  if (entry.title) headerParts.push(entry.title);
  if (journalText) headerParts.push(journalText);
  if (yearText) headerParts.push(`source_year=${yearText}`);
  if (entry.jurisdictionLevel) headerParts.push(`scope=${entry.jurisdictionLevel}`);
  if (entry.municipalityName) headerParts.push(`municipality=${entry.municipalityName}`);
  if (entry.collectionId) headerParts.push(`collection=${entry.collectionId}`);
  if (entry.sourceType) headerParts.push(`source_type=${entry.sourceType}`);
  if (entry.sourceStatus) headerParts.push(`source_status=${entry.sourceStatus}`);
  if (entry.historical) headerParts.push("historical=true");
  if (entry.lastChecked) headerParts.push(`last_checked=${entry.lastChecked}`);
  if (entry.validFrom) headerParts.push(`valid_from=${entry.validFrom}`);
  if (entry.validTo) headerParts.push(`valid_to=${entry.validTo}`);
  if (authorText) headerParts.push(authorText);
  if (pageText) headerParts.push(`lk ${pageText}`);
  if (paragraphNumberText && !headerParts.join(" ").includes(`§ ${paragraphNumberText}`)) headerParts.push(`§ ${paragraphNumberText}`);
  if (entry.paragraphTitle) headerParts.push(entry.paragraphTitle);
  else if (entry.section) headerParts.push(entry.section);
  const header = `(${index + 1}) ` + (headerParts.length ? headerParts.join(". ") : entry.title || "Allikas");
  const fullBody = entry.bodies.join("\n---\n") || "(sisukokkuvote puudub)";
  const bodyText = fullBody.length > bodyMaxChars ? `${fullBody.slice(0, Math.max(1, bodyMaxChars - 3)).trimEnd()}...` : fullBody;
  return [header, displayUrlsInText(bodyText)].join("\n");
}
function buildCompactContextWithBudget(groups, budget, maxGroups = CONTEXT_GROUPS_MAX) {
  const usableGroups = (Array.isArray(groups) ? groups : []).slice(0, maxGroups);
  if (!usableGroups.length) {
    return {
      text: "",
      used: []
    };
  }

  const minBodyChars = 120;
  let low = minBodyChars;
  let high = RAG_GROUP_BODY_MAX_CHARS;
  let bestText = "";

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = usableGroups.map((group, index) => renderOneContextBlock(group, index, {
      bodyMaxChars: mid
    })).join("\n\n");

    if (candidate.length <= budget) {
      bestText = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (bestText) {
    return {
      text: bestText,
      used: usableGroups
    };
  }

  let acc = "";
  const used = [];
  for (let i = 0; i < usableGroups.length; i++) {
    const block = renderOneContextBlock(usableGroups[i], i, {
      bodyMaxChars: minBodyChars
    });
    const candidate = used.length ? acc + "\n\n" + block : block;
    if (candidate.length > budget) break;
    acc = candidate;
    used.push(usableGroups[i]);
  }

  return {
    text: acc,
    used
  };
}
export function buildContextWithBudget(groups, options = {}) {
  if (!Array.isArray(groups) || groups.length === 0) return {
    text: "",
    used: []
  };
  const budget = Math.max(500, Math.floor(RAG_CTX_MAX_CHARS * (1 - RAG_CTX_HEADROOM)));
  const maxGroups = Math.max(1, Math.trunc(Number(options?.maxGroups) || CONTEXT_GROUPS_MAX));
  const usableGroups = groups.slice(0, maxGroups);
  const preferredYears = Array.from(new Set((Array.isArray(options?.preferredYears) ? options.preferredYears : [])
    .map(year => Number(year))
    .filter(year => Number.isInteger(year) && year >= 1900 && year <= 2100)));

  if ((options?.compact || preferredYears.length >= 2) && usableGroups.length > 1) {
    return buildCompactContextWithBudget(usableGroups, budget, maxGroups);
  }

  let acc = "";
  const used = [];
  for (let i = 0; i < usableGroups.length; i++) {
    const block = renderOneContextBlock(usableGroups[i], i);
    const candidate = used.length ? acc + "\n\n" + block : block;
    if (candidate.length > budget) break;
    acc = candidate;
    used.push(usableGroups[i]);
    if (used.length >= maxGroups) break;
  }
  return {
    text: acc,
    used
  };
}
