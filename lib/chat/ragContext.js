import { createHash } from "node:crypto";
import { domainToUnicode } from "node:url";

import { normalizePageReferences } from "./pageRanges.js";
import {
  buildTemporalAggregatePeriodRows,
  preferredTemporalQualitativeDevelopmentSpan
} from "./factContract.js";
import { RAG_CTX_MAX_CHARS, RAG_CTX_HEADROOM, CONTEXT_GROUPS_MAX, RAG_GROUP_BODY_MAX_CHARS } from "./settings.js";
import { KOV_RAG_SOURCE_TYPE_SET } from "../rag/sourceMetadata.js";
import { semanticTokens } from "./semanticTurnContract.js";

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

  const knownMarkers = new Set([
    "TITLE", "DESC", "AUTHORS", "JOURNAL", "ISSUE", "SECTION", "YEAR",
    "ITEM_TYPE", "STATUS", "RESOURCE_TYPE", "ADMIN_BODY", "COUNTY",
    "MUNICIPALITY", "PAGES", "PDF_SECTION"
  ]);
  const stripLeadingMarkerLines = (value = "") => {
    const lines = String(value || "").split(/\r?\n/);
    let firstBody = 0;
    for (; firstBody < lines.length; firstBody += 1) {
      const marker = lines[firstBody].match(/^\s*\[([A-Z_]+)\]/);
      if (!marker || !knownMarkers.has(marker[1])) break;
    }
    if (firstBody === 0 || firstBody >= lines.length) return "";
    return lines.slice(firstBody).join("\n").trim();
  };

  let body = raw.replace(
    /^\[TITLE\][\s\S]*?\[STATUS\]\s*(?:active|inactive|archived|stale|unknown|historical)\s*/i,
    ""
  );
  body = stripLeadingMarkerLines(body) || body.replace(/^\s*\[PAGES\]\s*[\d,\s\-–—]+/i, "").trim();

  if (body && body !== raw) return body;

  return stripLeadingMarkerLines(raw) || raw;
}

export function collapsePages(pages) {
  return normalizePageReferences(pages);
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
  const globalDenseRank = Number.isFinite(Number(m?.global_dense_rank)) ? Number(m.global_dense_rank) : null;
  const factSegmentDenseRank = Number.isFinite(Number(m?.fact_segment_dense_rank)) ? Number(m.fact_segment_dense_rank) : null;
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
    globalDenseRank,
    factSegmentDenseRank,
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
    const isKovServiceItem =
      m.collectionId === "kov_services" &&
      (m.sourceType === "municipality_kov" || KOV_RAG_SOURCE_TYPE_SET.has(m.sourceType));
    const shouldKeepChunkSeparate =
      (isKovServiceItem || isRegulationChunk) &&
      (m.canonicalItemId || m.itemId || m.chunkId);
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
      ? (isKovServiceItem
          ? (m.canonicalItemId || m.itemId || m.chunkId)
          : (m.itemId || regulationParagraphKey || m.chunkId))
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
        globalDenseRanks: [],
        factSegmentDenseRanks: [],
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
    if (typeof m.globalDenseRank === "number") entry.globalDenseRanks.push(m.globalDenseRank);
    if (typeof m.factSegmentDenseRank === "number") entry.factSegmentDenseRanks.push(m.factSegmentDenseRank);
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
    const bestGlobalDenseRank = entry.globalDenseRanks.filter(s => typeof s === "number").sort((a, b) => a - b)[0];
    const bestFactSegmentDenseRank = entry.factSegmentDenseRanks.filter(s => typeof s === "number").sort((a, b) => a - b)[0];
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
      globalDenseRank: typeof bestGlobalDenseRank === "number" ? bestGlobalDenseRank : null,
      factSegmentDenseRank: typeof bestFactSegmentDenseRank === "number" ? bestFactSegmentDenseRank : null,
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
    ...(Array.isArray(group?.authors) ? group.authors : []),
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

function topicTokens(value = "") {
  return semanticTokens(value);
}

function topicTokenMatches(left = "", right = "") {
  if (!left || !right) return false;
  if (left === right) return true;
  const shorterLength = Math.min(left.length, right.length);
  const lengthDifference = Math.abs(left.length - right.length);
  if (shorterLength >= 8 && left.slice(0, 8) === right.slice(0, 8)) return true;
  return shorterLength >= 5 && lengthDifference <= 4 &&
    (left.startsWith(right) || right.startsWith(left));
}

function textMatchesTopicHint(text = "", hint = "") {
  const textTokenList = topicTokens(text);
  const hintTokenList = topicTokens(hint);
  if (!textTokenList.length || !hintTokenList.length) return false;
  return hintTokenList.every(hintToken =>
    textTokenList.some(textToken => topicTokenMatches(hintToken, textToken))
  );
}

function topicTokenRecords(value = "") {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase();
  const records = [];
  for (const match of normalized.matchAll(/[a-z0-9]+/gi)) {
    records.push({
      token: match[0],
      index: match.index,
      end: match.index + match[0].length
    });
  }
  return records;
}

function findTopicHintPosition(text = "", hint = "") {
  const textRecords = topicTokenRecords(text);
  const hintTokenList = topicTokens(hint);
  if (!textRecords.length || !hintTokenList.length) return -1;

  for (let start = 0; start < textRecords.length; start += 1) {
    if (!topicTokenMatches(textRecords[start].token, hintTokenList[0])) continue;
    let textIndex = start + 1;
    let hintIndex = 1;
    while (hintIndex < hintTokenList.length && textIndex < textRecords.length && textIndex <= start + hintTokenList.length + 3) {
      if (topicTokenMatches(textRecords[textIndex].token, hintTokenList[hintIndex])) {
        hintIndex += 1;
      }
      textIndex += 1;
    }
    if (hintIndex === hintTokenList.length) return textRecords[start].index;
  }
  return -1;
}

function prioritizeBodyPassage(body = "", topicHints = []) {
  const source = String(body || "");
  if (source.length < 320 || !Array.isArray(topicHints) || !topicHints.length) return source;

  const positions = topicHints
    .map(hint => findTopicHintPosition(source, hint))
    .filter(position => position >= 0)
    .sort((a, b) => a - b);
  if (!positions.length || positions[0] < 220) return source;

  const matchPosition = positions[0];
  const lookbackStart = Math.max(0, matchPosition - 320);
  const beforeMatch = source.slice(lookbackStart, matchPosition);
  const sentenceBoundaryMatches = Array.from(beforeMatch.matchAll(/[.!?]\s+|\n+/g));
  const lastBoundary = sentenceBoundaryMatches.at(-1);
  const passageStart = lastBoundary
    ? lookbackStart + lastBoundary.index + lastBoundary[0].length
    : Math.max(0, matchPosition - 80);

  const forwardLimit = Math.min(source.length, matchPosition + 1100);
  const afterMatch = source.slice(matchPosition, forwardLimit);
  const endBoundaryMatches = Array.from(afterMatch.matchAll(/[.!?](?=\s|$)/g));
  const preferredEndBoundary = endBoundaryMatches[Math.min(1, endBoundaryMatches.length - 1)];
  const passageEnd = preferredEndBoundary
    ? matchPosition + preferredEndBoundary.index + preferredEndBoundary[0].length
    : forwardLimit;

  const focusedPassage = source.slice(passageStart, passageEnd).trim();
  const remainder = [source.slice(0, passageStart), source.slice(passageEnd)]
    .map(part => part.trim())
    .filter(Boolean)
    .join(" ");
  return [focusedPassage, remainder].filter(Boolean).join("\n---\n");
}

function rankBodiesWithTopicHints(group, topicHints = []) {
  const bodies = Array.isArray(group?.bodies) ? group.bodies : [];
  if (bodies.length < 2 || !Array.isArray(topicHints) || !topicHints.length) return bodies;

  const normalizedHints = Array.from(new Set(topicHints
    .map(item => normalizeTopicValue(item))
    .filter(Boolean)));
  if (!normalizedHints.length) return bodies;

  const sharedArticleText = [
    group?.title,
    ...(Array.isArray(group?.authors) ? group.authors : []),
    group?.section,
    group?.paragraphTitle,
    group?.journalTitle,
    ...(Array.isArray(group?.tags) ? group.tags : [])
  ].filter(Boolean).join(" \n ");
  const distinguishingHints = normalizedHints.filter(hint =>
    !textMatchesTopicHint(sharedArticleText, hint)
  );

  return bodies
    .map((body, index) => {
      const matchingHints = normalizedHints.filter(hint => textMatchesTopicHint(body, hint));
      const distinguishingMatches = distinguishingHints.filter(hint =>
        textMatchesTopicHint(body, hint)
      ).length;
      return {
        body,
        index,
        topicScore: distinguishingMatches * 100 + matchingHints.length
      };
    })
    .sort((a, b) => b.topicScore - a.topicScore || a.index - b.index)
    .map(item => prioritizeBodyPassage(
      item.body,
      distinguishingHints.length ? distinguishingHints : normalizedHints
    ));
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
  if (policy.evidenceScope === "current_authoritative_guidance") {
    const tier = currentMethodGuidanceTier(group);
    if (tier === 2) score += 0.6;
    else if (tier === 1) score += 0.3;
  }
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
  const immutablePublication = sourceType === "journal_article" || sourceType === "article";

  if (HIGH_AUTHORITY_SOURCE_TYPES.has(sourceType)) score += 0.24;
  else if (OFFICIAL_RANK_SOURCE_TYPES.has(sourceType)) score += 0.18;
  else if (BACKGROUND_RANK_SOURCE_TYPES.has(sourceType)) score -= 0.08;

  if (sourceStatus === "active") score += 0.06;
  else if (sourceStatus === "stale") score -= 0.22;
  else if (sourceStatus === "inactive" || sourceStatus === "archived") score -= 0.5;

  // Ajakirjaartikli ilmumisaasta kirjeldab väite aega, mitte allika vigasust.
  // Kehtiva õiguse/teenuse kõrge riskiga küsimustes teeb eraldi riskisooritaja
  // endiselt ametliku värske allika eelistuse. Üldises sisupäringus ei tohi vana
  // impordi `historical=true` kogu artikli otsinguskoori tühistada.
  if ((historical && !immutablePublication) || sourceType === "historical_source") score -= 0.35;

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
      const rankedGroup = {
        ...group,
        bodies: rankBodiesWithTopicHints(group, topicHints)
      };
      const topicBoost = scoreTopicHintMatch(rankedGroup, topicHints);
      const qualityAdjust = scoreSourceQuality(rankedGroup, { ...options, topicHints });
      const baseScore = typeof group?.bestScore === "number" ? group.bestScore : 0.3;
      return {
        ...rankedGroup,
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
  const tokenize = s => new Set(semanticTokens(s));
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
  return new Set(semanticTokens(value, { minLength: 4 }));
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

function currentMethodGuidanceTier(group = {}) {
  const status = String(group.sourceStatus || "").trim().toLowerCase();
  const historical = group.historical === true || String(group.historical || "").toLowerCase() === "true";
  if (status !== "active" || historical) return 0;
  const type = String(group.sourceType || "");
  if (["official_guideline", "state_guide", "quality_guideline", "service_standard"].includes(type)) return 2;
  if (["methodology_guide", "methodology_material", "information_material"].includes(type) ||
      ["method_guidance", "best_practice_guidance"].includes(group.resourceType)) return 1;
  return 0;
}

export function selectProfessionalMethodGuidanceGroups(groups, k = 4, lambda, options = {}) {
  const limit = Math.max(1, Math.min(4, Math.trunc(Number(k) || 4)));
  const topicTerms = Array.from(new Set((Array.isArray(options.topicHints) ? options.topicHints : [])
    .flatMap(topicTokens)
    .filter(term => !/^(?:kuidas|hinda|hinna|kaardista|aita|aida|abista|toeta|meetod|samm|etapp|protsess)/.test(term))));
  const eligible = (Array.isArray(groups) ? groups : []).filter(group => {
    if (["inactive", "archived", "stale"].includes(String(group.sourceStatus || "").toLowerCase())) return false;
    if (!topicTerms.length) return true;
    const sourceTokens = topicTokens(overviewText(group));
    const matchingTerms = topicTerms.filter(term => sourceTokens.some(token => topicTokenMatches(term, token)));
    return matchingTerms.length >= Math.min(2, topicTerms.length) &&
      matchingTerms.length / topicTerms.length >= 0.5;
  });
  const ranked = [...eligible].sort((a, b) => overviewGroupScore(b) - overviewGroupScore(a));
  const primary = ranked.find(group => currentMethodGuidanceTier(group) === 2) ||
    ranked.find(group => currentMethodGuidanceTier(group) === 1) || ranked[0];
  if (!primary) return {
    selected: [],
    metadata: { selection_strategy: "professional_method_guidance", primary_guidance_status: "missing", selected_document_count: 0 }
  };
  const selected = [primary];
  const selectedIds = new Set([groupSourceIdentity(primary)]);
  const add = group => {
    const id = groupSourceIdentity(group);
    if (selected.length >= limit || selectedIds.has(id)) return;
    selected.push(group);
    selectedIds.add(id);
  };
  if (options.focus === "assessment") {
    const complementaryModel = ranked.find(group =>
      !selectedIds.has(groupSourceIdentity(group)) &&
      /\b\w*(?:mudel|meetod|metoodika)\w*\b/.test(normalizeTopicValue([
        group.title, ...(Array.isArray(group.tags) ? group.tags : [])
      ].filter(Boolean).join(" ")))
    );
    if (complementaryModel) add(complementaryModel);
  }
  for (const group of diversifyGroupsMMR(ranked, ranked.length, lambda)) add(group);
  return {
    selected,
    metadata: {
      selection_strategy: "professional_method_guidance",
      primary_source_id: groupSourceIdentity(primary),
      primary_source_type: primary.sourceType || null,
      primary_guidance_status: currentMethodGuidanceTier(primary) === 2
        ? "current_official"
        : currentMethodGuidanceTier(primary) === 1 ? "current_method" : "unconfirmed",
      selected_document_count: selected.length
    }
  };
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

function groupBodyMentionsYear(group, year) {
  const yearText = String(year);
  const text = Array.isArray(group?.bodies) ? group.bodies.join("\n") : "";
  return new RegExp(`\\b${yearText}\\b`).test(text);
}

function inferTemporalEvidenceYears(group, targetYears = [], options = {}) {
  const years = [];
  const directYear = inferGroupYear(group);
  const publicationYearRequested = options?.requestedYearRole === "publication_year";
  for (const year of targetYears) {
    if (
      (publicationYearRequested && directYear === year) ||
      (!publicationYearRequested && groupBodyMentionsYear(group, year))
    ) {
      years.push(year);
    }
  }
  return years;
}

export function temporalEvidenceYearsForGroup(group, targetYears = [], options = {}) {
  return inferTemporalEvidenceYears(group, targetYears, options);
}

export function selectTemporalGroups(groups, years = [], k = CONTEXT_GROUPS_MAX, lambda, options = {}) {
  if (!Array.isArray(groups) || groups.length === 0) return [];
  const targetYears = Array.from(new Set((Array.isArray(years) ? years : [])
    .map(year => Number(year))
    .filter(year => Number.isInteger(year) && year >= 1900 && year <= 2100)));
  if (!targetYears.length) return diversifyGroupsMMR(groups, k, lambda);

  const allowedYears = new Set(targetYears);
  const yearScopedGroups = groups.filter(group => inferTemporalEvidenceYears(group, targetYears, options).length);
  if (!yearScopedGroups.length) return [];

  const limit = Math.max(1, Math.min(k, yearScopedGroups.length));
  const remaining = [...yearScopedGroups];
  const selected = [];

  for (const year of targetYears) {
    if (selected.length >= limit) break;
    const yearCandidates = remaining.filter(group => {
      const evidenceYears = inferTemporalEvidenceYears(group, targetYears, options);
      return evidenceYears.includes(year) && (
        options?.requestedYearRole === "publication_year"
          ? allowedYears.has(inferGroupYear(group))
          : groupBodyMentionsYear(group, year)
      );
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

function resolveContextMaxChars(options = {}) {
  if (options?.allowExpandedBodyBudget !== true) return RAG_CTX_MAX_CHARS;
  const narrowFactTarget = Math.max(
    Math.ceil(RAG_CTX_MAX_CHARS * 2),
    RAG_GROUP_BODY_MAX_CHARS * 10
  );
  return Math.max(RAG_CTX_MAX_CHARS, Math.min(16000, narrowFactTarget));
}

function normalizedPreferredContextYears(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map(value => Number(value))
    .filter(value => Number.isInteger(value) && value >= 1900 && value <= 2100)))
    .sort((left, right) => left - right)
    .slice(0, 8);
}

function preferredTemporalRangeSpan(body = "", preferredYears = []) {
  const text = String(body || "");
  const years = normalizedPreferredContextYears(preferredYears);
  if (!text || years.length < 2) return null;
  const startYear = years[0];
  const endYear = years[years.length - 1];
  const rangePattern = new RegExp(
    `\\b${startYear}\\b[\\s\\S]{0,120}?(?:(?<!\\p{L})(?:kuni|to|through|until|till|до|по)(?!\\p{L})|[-–—])[\\s\\S]{0,120}?\\b${endYear}\\b`,
    "giu"
  );
  for (const rangeMatch of text.matchAll(rangePattern)) {
    const matchStart = rangeMatch.index || 0;
    const matchEnd = matchStart + String(rangeMatch[0] || "").length;
    const previousBoundaries = [
      text.lastIndexOf(".", Math.max(0, matchStart - 1)),
      text.lastIndexOf("!", Math.max(0, matchStart - 1)),
      text.lastIndexOf("?", Math.max(0, matchStart - 1)),
      text.lastIndexOf("\n", Math.max(0, matchStart - 1))
    ];
    let start = Math.max(...previousBoundaries) + 1;
    while (start < text.length && /\s/u.test(text[start])) start += 1;

    const sentenceBoundaryAfter = (offset) => {
      const suffix = text.slice(Math.max(0, offset));
      const match = /[.!?](?=\s|$)|\n/u.exec(suffix);
      return match ? Math.max(0, offset) + (match.index || 0) + 1 : text.length;
    };
    const firstEnd = sentenceBoundaryAfter(matchEnd);
    let nextStart = firstEnd;
    while (nextStart < text.length && /\s/u.test(text[nextStart])) nextStart += 1;
    const secondEnd = nextStart < text.length ? sentenceBoundaryAfter(nextStart) : firstEnd;
    const end = secondEnd > firstEnd && secondEnd - start <= 640 ? secondEnd : firstEnd;
    if (end <= start) continue;
    const strictRows = buildTemporalAggregatePeriodRows({
      sources: [{
        source_id: "render_candidate",
        evidenceText: `render_candidate\n${text.slice(start, end)}`
      }],
      targetYears: years
    });
    if (strictRows.length < 2) continue;
    return { start, end, primaryEnd: firstEnd, rowCount: strictRows.length };
  }
  return null;
}

function clipContextBody(body = "", cap = RAG_GROUP_BODY_MAX_CHARS, preferredYears = [], options = {}) {
  const text = String(body || "");
  if (text.length <= cap) {
    return {
      renderedBody: text,
      rawRenderedBody: text,
      startOffset: 0,
      endOffset: text.length,
      truncated: false
    };
  }

  const preferredSpan = preferredTemporalRangeSpan(text, preferredYears);
  if (preferredSpan) {
    const candidateEnds = Array.from(new Set([preferredSpan.end, preferredSpan.primaryEnd]));
    const preferredEnd = candidateEnds.find(end => {
      const markerChars = (preferredSpan.start > 0 ? 3 : 0) + (end < text.length ? 3 : 0);
      return end - preferredSpan.start <= Math.max(1, cap - markerChars);
    });
    if (preferredEnd) {
      const rawRenderedBody = text.slice(preferredSpan.start, preferredEnd).trim();
      const startOffset = text.indexOf(rawRenderedBody, preferredSpan.start);
      const endOffset = startOffset + rawRenderedBody.length;
      return {
        renderedBody: `${startOffset > 0 ? "..." : ""}${rawRenderedBody}${endOffset < text.length ? "..." : ""}`,
        rawRenderedBody,
        startOffset,
        endOffset,
        truncated: true
      };
    }
  }

  if (options?.preferTemporalDevelopment === true) {
    const developmentSpan = preferredTemporalQualitativeDevelopmentSpan(text, {
      sourceTitle: options?.sourceTitle,
      topicTerms: options?.preferredTopicTerms,
      maxChars: cap,
      requireTitleTopicMatch: options?.requireTemporalDevelopmentTitleTopicMatch === true,
      minimumEvidenceYearExclusive: options?.minimumTemporalDevelopmentEvidenceYearExclusive
    });
    if (developmentSpan) {
      const rawRenderedBody = text.slice(developmentSpan.start, developmentSpan.end).trim();
      const markerChars = (developmentSpan.start > 0 ? 3 : 0) + (developmentSpan.end < text.length ? 3 : 0);
      if (rawRenderedBody.length <= Math.max(1, cap - markerChars)) {
        const startOffset = text.indexOf(rawRenderedBody, developmentSpan.start);
        const endOffset = startOffset + rawRenderedBody.length;
        return {
          renderedBody: `${startOffset > 0 ? "..." : ""}${rawRenderedBody}${endOffset < text.length ? "..." : ""}`,
          rawRenderedBody,
          startOffset,
          endOffset,
          truncated: true
        };
      }
    }
  }

  const rawRenderedBody = text.slice(0, Math.max(1, cap - 3)).trimEnd();
  return {
    renderedBody: `${rawRenderedBody}...`,
    rawRenderedBody,
    startOffset: 0,
    endOffset: rawRenderedBody.length,
    truncated: true
  };
}

function renderContextBlock(entry, index, options = {}) {
  const expandedBodyBudget = options?.allowExpandedBodyBudget === true;
  const contextMaxChars = resolveContextMaxChars(options);
  const bodyLimit = expandedBodyBudget
    ? Math.min(contextMaxChars, Math.max(RAG_GROUP_BODY_MAX_CHARS, RAG_GROUP_BODY_MAX_CHARS * 8))
    : RAG_GROUP_BODY_MAX_CHARS;
  const requestedBodyMaxChars = Number(options?.bodyMaxChars);
  const bodyMaxChars = Number.isFinite(requestedBodyMaxChars) && requestedBodyMaxChars >= 80
    ? Math.min(bodyLimit, Math.floor(requestedBodyMaxChars))
    : bodyLimit;
  const requestedMaxBodies = Number(options?.maxBodies);
  const maxBodies = Number.isFinite(requestedMaxBodies)
    ? Math.max(1, Math.min(8, Math.trunc(requestedMaxBodies)))
    : 2;
  const preferredYears = normalizedPreferredContextYears(options?.preferredYears);
  const preferredTopicTerms = Array.isArray(options?.preferredTopicTerms)
    ? options.preferredTopicTerms
    : [];
  const preferTemporalDevelopment = options?.preferTemporalDevelopment === true;
  const requireTemporalDevelopmentTitleTopicMatch =
    options?.requireTemporalDevelopmentTitleTopicMatch === true;
  const minimumTemporalDevelopmentEvidenceYearExclusive =
    options?.minimumTemporalDevelopmentEvidenceYearExclusive;
  const authors = options?.includeAuthors === false
    ? []
    : Array.isArray(entry.authors) ? entry.authors : [];
  const authorText = authors.length ? authors.slice(0, 2).join("; ") : null;
  const pageRangeText = normalizePageReferences(entry.pageRanges);
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
  const bodies = Array.isArray(entry.bodies) ? entry.bodies.filter(Boolean) : [];
  const separator = "\n---\n";
  let bodyText = "(sisukokkuvote puudub)";
  let bodySpans = [];
  let truncated = false;
  let renderedBodyCount = 0;
  if (bodies.length === 1) {
    renderedBodyCount = 1;
    const clippedBody = clipContextBody(bodies[0], bodyMaxChars, preferredYears, {
      preferTemporalDevelopment,
      preferredTopicTerms,
      sourceTitle: entry.title,
      requireTemporalDevelopmentTitleTopicMatch,
      minimumTemporalDevelopmentEvidenceYearExclusive
    });
    truncated = clippedBody.truncated;
    bodyText = clippedBody.renderedBody;
    const displayedBody = displayUrlsInText(bodyText);
    bodySpans = [{
      original_body_index: 0,
      original_body_hash: hashContextText(bodies[0]),
      rendered_body_hash: hashContextText(displayedBody),
      original_body_chars: bodies[0].length,
      rendered_body_chars: displayedBody.length,
      start_offset: clippedBody.startOffset,
      end_offset: clippedBody.endOffset,
      truncated
    }];
  } else if (bodies.length > 1) {
    const annotatedBodies = bodies.map((body, originalBodyIndex) => ({
      body,
      originalBodyIndex,
      preferredRangeSpan: preferredTemporalRangeSpan(body, preferredYears),
      preferredDevelopmentSpan: preferTemporalDevelopment
        ? preferredTemporalQualitativeDevelopmentSpan(body, {
            sourceTitle: entry.title,
            topicTerms: preferredTopicTerms,
            requireTitleTopicMatch: requireTemporalDevelopmentTitleTopicMatch,
            minimumEvidenceYearExclusive: minimumTemporalDevelopmentEvidenceYearExclusive
          })
        : null
    }));
    const selectedBodies = annotatedBodies.slice(0, maxBodies);
    const preferredBody = [...annotatedBodies]
      .filter(item => item.preferredRangeSpan)
      .sort((left, right) =>
        Number(right.preferredRangeSpan?.rowCount || 0) - Number(left.preferredRangeSpan?.rowCount || 0) ||
        left.originalBodyIndex - right.originalBodyIndex
      )[0];
    if (
      preferredBody &&
      !selectedBodies.some(item => item.originalBodyIndex === preferredBody.originalBodyIndex)
    ) {
      selectedBodies[selectedBodies.length - 1] = preferredBody;
    }
    const preferredDevelopmentBody = [...annotatedBodies]
      .filter(item => item.preferredDevelopmentSpan)
      .sort((left, right) =>
        Number(right.preferredDevelopmentSpan?.score || 0) - Number(left.preferredDevelopmentSpan?.score || 0) ||
        left.originalBodyIndex - right.originalBodyIndex
      )[0];
    if (
      preferredDevelopmentBody &&
      !selectedBodies.some(item => item.originalBodyIndex === preferredDevelopmentBody.originalBodyIndex)
    ) {
      const protectedRangeBodyIndex = preferredBody?.originalBodyIndex;
      const replaceIndex = selectedBodies.findIndex(item =>
        item.originalBodyIndex !== protectedRangeBodyIndex
      );
      if (replaceIndex >= 0) selectedBodies[replaceIndex] = preferredDevelopmentBody;
    }
    selectedBodies.sort((left, right) => left.originalBodyIndex - right.originalBodyIndex);
    renderedBodyCount = selectedBodies.length;
    truncated = selectedBodies.length < bodies.length;
    const available = Math.max(selectedBodies.length, bodyMaxChars - separator.length * (selectedBodies.length - 1));
    const caps = Array.from({ length: selectedBodies.length }, () => 0);
    let remaining = available;
    let unassigned = selectedBodies.map((_, bodyIndex) => bodyIndex);
    while (unassigned.length && remaining > 0) {
      const evenShare = Math.max(1, Math.floor(remaining / unassigned.length));
      const saturated = unassigned.filter(bodyIndex => selectedBodies[bodyIndex].body.length <= evenShare);
      if (!saturated.length) {
        for (const [activeIndex, bodyIndex] of unassigned.entries()) {
          const cap = evenShare + (activeIndex < remaining % unassigned.length ? 1 : 0);
          caps[bodyIndex] = Math.min(selectedBodies[bodyIndex].body.length, cap);
        }
        remaining = 0;
        break;
      }
      for (const bodyIndex of saturated) {
        caps[bodyIndex] = selectedBodies[bodyIndex].body.length;
        remaining -= caps[bodyIndex];
      }
      const saturatedIndexes = new Set(saturated);
      unassigned = unassigned.filter(bodyIndex => !saturatedIndexes.has(bodyIndex));
    }
    const clipBody = (selectedBody, cap) => {
      const clippedBody = clipContextBody(selectedBody.body, cap, preferredYears, {
        preferTemporalDevelopment,
        preferredTopicTerms,
        sourceTitle: entry.title,
        requireTemporalDevelopmentTitleTopicMatch,
        minimumTemporalDevelopmentEvidenceYearExclusive
      });
      if (clippedBody.truncated) truncated = true;
      const displayedBody = displayUrlsInText(clippedBody.renderedBody);
      bodySpans.push({
        original_body_index: selectedBody.originalBodyIndex,
        original_body_hash: hashContextText(selectedBody.body),
        rendered_body_hash: hashContextText(displayedBody),
        original_body_chars: selectedBody.body.length,
        rendered_body_chars: displayedBody.length,
        start_offset: clippedBody.startOffset,
        end_offset: clippedBody.endOffset,
        truncated: clippedBody.truncated
      });
      return clippedBody.renderedBody;
    };
    bodyText = selectedBodies.map((body, bodyIndex) => clipBody(body, caps[bodyIndex])).join(separator);
  }
  const renderedEvidenceText = displayUrlsInText(bodyText);
  return {
    text: [header, renderedEvidenceText].join("\n"),
    evidenceText: renderedEvidenceText,
    truncated,
    originalBodyCount: bodies.length,
    renderedBodyCount,
    originalBodyHash: hashContextText(bodies.join(separator)),
    renderedBodyHash: hashContextText(renderedEvidenceText),
    bodySpans
  };
}

function hashContextText(value = "") {
  return createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

export function renderOneContextBlock(entry, index, options = {}) {
  return renderContextBlock(entry, index, options).text;
}
function buildCompactContextWithBudget(groups, budget, maxGroups = CONTEXT_GROUPS_MAX, options = {}) {
  const usableGroups = (Array.isArray(groups) ? groups : []).slice(0, maxGroups);
  if (!usableGroups.length) {
    return {
      text: "",
      used: [],
      renderedBlocks: []
    };
  }

  const minBodyChars = 120;
  let low = minBodyChars;
  let high = options?.allowExpandedBodyBudget === true
    ? Math.min(resolveContextMaxChars(options), RAG_GROUP_BODY_MAX_CHARS * 8)
    : RAG_GROUP_BODY_MAX_CHARS;
  let bestText = "";
  let bestRenderedBlocks = [];

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const renderedBlocks = usableGroups.map((group, index) => renderContextBlock(
      group,
      index,
      contextBlockOptions(options, index, mid)
    ));
    const candidate = renderedBlocks.map(block => block.text).join("\n\n");

    if (candidate.length <= budget) {
      bestText = candidate;
      bestRenderedBlocks = renderedBlocks;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (bestText) {
    return {
      text: bestText,
      used: usableGroups,
      renderedBlocks: bestRenderedBlocks
    };
  }

  let acc = "";
  const used = [];
  const renderedBlocks = [];
  for (let i = 0; i < usableGroups.length; i++) {
    const renderedBlock = renderContextBlock(
      usableGroups[i],
      i,
      contextBlockOptions(options, i, minBodyChars)
    );
    const candidate = used.length ? acc + "\n\n" + renderedBlock.text : renderedBlock.text;
    if (candidate.length > budget) break;
    acc = candidate;
    used.push(usableGroups[i]);
    renderedBlocks.push(renderedBlock);
  }

  return {
    text: acc,
    used,
    renderedBlocks
  };
}

function contextBlockOptions(options = {}, index = 0, bodyMaxChars) {
  const secondary = index > 0;
  const secondaryBodyMaxChars = Number(options?.secondaryBodyMaxChars);
  return {
    bodyMaxChars: secondary && Number.isFinite(secondaryBodyMaxChars)
      ? secondaryBodyMaxChars
      : bodyMaxChars,
    includeAuthors: options?.includeAuthors,
    maxBodies: secondary && options?.secondaryMaxBodies != null
      ? options.secondaryMaxBodies
      : options?.maxBodies,
    allowExpandedBodyBudget: options?.allowExpandedBodyBudget,
    preferredYears: options?.preferredYears,
    preferredTopicTerms: options?.preferredTopicTerms,
    preferTemporalDevelopment: options?.preferTemporalDevelopment === true,
    requireTemporalDevelopmentTitleTopicMatch: secondary &&
      options?.secondaryTemporalDevelopmentRequiresTitleTopicMatch === true,
    minimumTemporalDevelopmentEvidenceYearExclusive: secondary
      ? null
      : options?.primaryTemporalDevelopmentMinimumEvidenceYearExclusive
  };
}
export function buildContextWithBudget(groups, options = {}) {
  if (!Array.isArray(groups) || groups.length === 0) return {
    text: "",
    used: [],
    renderedBlocks: []
  };
  const contextMaxChars = resolveContextMaxChars(options);
  const budget = Math.max(500, Math.floor(contextMaxChars * (1 - RAG_CTX_HEADROOM)));
  const maxGroups = Math.max(1, Math.trunc(Number(options?.maxGroups) || CONTEXT_GROUPS_MAX));
  const usableGroups = groups.slice(0, maxGroups);
  const preferredYears = Array.from(new Set((Array.isArray(options?.preferredYears) ? options.preferredYears : [])
    .map(year => Number(year))
    .filter(year => Number.isInteger(year) && year >= 1900 && year <= 2100)));

  if ((options?.compact || preferredYears.length >= 2) && usableGroups.length > 1) {
    return buildCompactContextWithBudget(usableGroups, budget, maxGroups, options);
  }

  let acc = "";
  const used = [];
  const renderedBlocks = [];
  for (let i = 0; i < usableGroups.length; i++) {
    const renderedBlock = renderContextBlock(
      usableGroups[i],
      i,
      contextBlockOptions(options, i)
    );
    const candidate = used.length ? acc + "\n\n" + renderedBlock.text : renderedBlock.text;
    if (candidate.length > budget) break;
    acc = candidate;
    used.push(usableGroups[i]);
    renderedBlocks.push(renderedBlock);
    if (used.length >= maxGroups) break;
  }
  return {
    text: acc,
    used,
    renderedBlocks
  };
}
