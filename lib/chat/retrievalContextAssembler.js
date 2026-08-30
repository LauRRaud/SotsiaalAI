import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";

import {
  collapsePages,
  groupMatches,
  diversifyGroupsMMR,
  selectOverviewSynthesisGroups,
  selectMultiSourceGroups,
  selectProfessionalMethodGuidanceGroups,
  selectTemporalGroups,
  temporalEvidenceYearsForGroup,
  rankGroupsWithTopicHints,
  filterGroupsForLegalPlan,
  buildContextWithBudget,
  renderOneContextBlock,
  makeShortRef,
  filterMunicipalityScopedMatches,
  filterMatchesToMunicipalities,
  displayUrl
} from "@/lib/chat/ragContext";
import { groundingStrength } from "@/lib/chat/safety";
import {
  RAG_TOP_K,
  RAG_CTX_MAX_CHARS,
  RAG_CTX_HEADROOM,
  CONTEXT_GROUPS_MAX,
  DIVERSIFY_LAMBDA
} from "@/lib/chat/settings";
import { shouldUseExternalSourcesForTurn } from "@/lib/chat/sourceNeed";
import {
  buildTemporalRetrievalPlan,
  buildTemporalBreakdownInstruction,
  buildTemporalFillQueries,
  extractTopicHints,
  isSelfContainedTemporalBreakdownTurn
} from "@/lib/chat/retrievalPlanning";
import {
  extractRecentUserText,
  normalizeIntentText,
  isMunicipalityDependentSocialHelpQuestion,
  getDocContextBudget,
  buildEphemeralDocContext,
  getEphemeralSourceLabel,
  detectMentionedMunicipalitiesFromUserText
} from "@/lib/chat/requestContext";
import {
  buildRagSearchQuery,
  searchRagQueries,
  extractParagraphReferences,
  inferSourceLookupSubject,
  detectSourceAvailabilityRequest,
  detectPreviousSourceUseRequest,
  buildSourceLookupSearchQuery,
  dedupeRagMatches,
  extractMatchGroupYear,
  inferRetrieversUsed,
  hasRecentAssistantSources,
  isContextDependentRetrievalTurn,
  isPluralSourceSetFollowup,
  isBroadMultiSourceRagQuestion,
  isThematicSynthesisRagQuestion,
  analyzeRagQuery
} from "@/lib/chat/retrievalOrchestrator";
import {
  buildDocumentScopedMissingFactQueries,
  buildDocumentScopedResearchFactQueries,
  buildGeneralBackgroundQueries,
  buildNationalServiceBenefitQuery,
  buildRagQueryPlan,
  buildServiceJurisdictionQuery
} from "@/lib/chat/queryPlanner";
import { buildQuestionPlan } from "@/lib/chat/questionPlanner";
import { factRelationTermMatchQuality, factRelationTokens } from "@/lib/chat/factRelationSemantics";
import {
  qualitativeActionClauses,
  qualitativeActionSignature
} from "@/lib/chat/qualitativeActionSemantics";
import {
  buildSemanticTurnContract,
  promoteSemanticDomainScope
} from "@/lib/chat/semanticTurnContract";
import { authorNamesCompatible, canonicalAuthorKey } from "@/lib/chat/authorIdentity";
import {
  buildSafeLanguagePlanTrace,
  matchesControlledEstonianTopic,
  refineChatLanguagePlanWithMorphology,
  shouldActivateCanonicalAuthorRetrieval,
  shouldActivateCanonicalSupplementalRetrieval
} from "@/lib/chat/languagePlan";
import {
  buildEvidencePackage,
  buildEvidencePackageInstruction,
  shouldBuildEvidencePackage
} from "@/lib/chat/evidencePackage";
import {
  buildTemporalAggregatePeriodRows,
  buildTemporalEvidenceRows,
  preferredTemporalQualitativeDevelopmentSpan,
  temporalSupplementalTitleTopicCoverage
} from "@/lib/chat/factContract";
import { buildPackageAwareContext } from "@/lib/chat/packageAwareContext";
import { buildSectionAttribution } from "@/lib/chat/sectionAttribution";
import { buildRuntimeSourcePackages } from "@/lib/chat/sourcePackages";
import {
  canonicalContactRoleFamilyLabel,
  contactRoleSemanticSelections,
  contactRoleQueryMatches,
  hasContactRoleSemanticSelector,
  isInstitutionalApplicationGuidance,
  normalizeContactRoleText
} from "@/lib/chat/contactRoleSemantics";
import { prisma } from "@/lib/prisma";
import {
  loadServiceMapContactVerificationProjection,
  SERVICE_MAP_CONTACT_CHECK_SCHEDULE,
  SERVICE_MAP_VERIFIABLE_CONTACT_NAMESPACES,
  SERVICE_MAP_CONTACT_TYPES
} from "@/lib/serviceMap/contactFreshnessProjection";
import {
  graphChannelLookup,
  graphHintsToQueryTexts,
  isGraphChannelEnabled,
  graphChannelSearchTopK,
  selectGraphChannelSupplement,
  GRAPH_CHANNEL_MAX_DISPLAYED
} from "@/lib/rag/graph/graphRetrieval";
import { buildRiskPolicyInstruction, classifyRagRisk } from "@/lib/rag/riskPolicy";
import { isLegalSource, isResearchOrJournalSource } from "@/lib/rag/sourceMetadata";
import {
  asksForParticipantGroupNumericRelation,
  extractUniformParticipantBreakdown,
  smallCardinalNumberValue
} from "@/lib/chat/factContract";

function finiteOptionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function monotonicDurationMs(startedAt, endedAt = performance.now()) {
  return Math.max(0, Math.round(endedAt - startedAt));
}

function mergedTimingWindowDurationMs(windows = []) {
  const sorted = (Array.isArray(windows) ? windows : [])
    .filter(window => Number.isFinite(window?.startedAt) && Number.isFinite(window?.endedAt))
    .map(window => ({ startedAt: window.startedAt, endedAt: Math.max(window.startedAt, window.endedAt) }))
    .sort((left, right) => left.startedAt - right.startedAt);
  if (!sorted.length) return 0;
  let total = 0;
  let currentStart = sorted[0].startedAt;
  let currentEnd = sorted[0].endedAt;
  for (const window of sorted.slice(1)) {
    if (window.startedAt <= currentEnd) {
      currentEnd = Math.max(currentEnd, window.endedAt);
      continue;
    }
    total += currentEnd - currentStart;
    currentStart = window.startedAt;
    currentEnd = window.endedAt;
  }
  return Math.max(0, Math.round(total + currentEnd - currentStart));
}

function stableSourceIdFromRawMatch(match = {}, index = 0) {
  const md = match?.metadata || {};
  const sourceType = String(match?.source_type || md.source_type || "").trim();
  const legalChunkId =
    /^(national_law|law|kov_regulation|regulation|riigiteataja_regulation)$/.test(sourceType)
      ? match?.chunk_id || match?.chunkId || md.chunk_id || md.chunkId || md.canonical_chunk_id || md.canonicalChunkId || match?.id
      : "";
  const raw =
    legalChunkId ||
    match?.source_id ||
    match?.sourceId ||
    md.source_id ||
    md.sourceId ||
    match?.id ||
    md.chunk_id ||
    md.chunkId ||
    md.doc_id ||
    md.docId ||
    md.item_id ||
    md.itemId ||
    md.article_id ||
    md.articleId ||
    md.source_url ||
    md.url ||
    md.title ||
    `retrieved_${index}`;
  return String(raw || `retrieved_${index}`).trim() || `retrieved_${index}`;
}

function stableSourceIdFromDisplaySource(source = {}, index = 0) {
  const sourceType = String(source?.sourceType || source?.source_type || "").trim();
  const legalId =
    /^(national_law|law|kov_regulation|regulation|riigiteataja_regulation)$/.test(sourceType)
      ? source?.id || source?.key || source?.chunk_id || source?.chunkId
      : "";
  const raw =
    legalId ||
    source?.source_id ||
    source?.sourceId ||
    source?.id ||
    source?.key ||
    source?.url ||
    source?.short_ref ||
    source?.title ||
    `source_${index}`;
  return String(raw || `source_${index}`).trim() || `source_${index}`;
}

function displayedSourceUrl(source = {}) {
  return String(
    source?.url ||
    source?.source_url ||
    source?.sourceUrl ||
    source?.url_canonical ||
    source?.urlCanonical ||
    source?.official_url ||
    source?.officialUrl ||
    source?.official_website ||
    source?.officialWebsite ||
    source?.metadata?.official_website ||
    source?.metadata?.officialWebsite ||
    ""
  ).trim();
}

function normalizeDisplayAliasText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function shouldIncludeContextAuthors(message = "", groups = [], options = {}) {
  if (options?.sourceLookupRequest === true) return true;
  const normalizedMessage = normalizeIntentText(message);
  if (!normalizedMessage) return false;
  if (/\b(autor|autorid|autori|autoreid|autorlus|kirjutas|kirjutanud|kelle kirjutatud|kelle artikkel)\b/.test(normalizedMessage)) {
    return true;
  }

  const messageWords = new Set(normalizedMessage.split(/[^a-z0-9]+/i).filter(Boolean));
  for (const group of Array.isArray(groups) ? groups : []) {
    for (const author of Array.isArray(group?.authors) ? group.authors : []) {
      const normalizedAuthor = normalizeIntentText(author);
      if (!normalizedAuthor) continue;
      if (normalizedMessage.includes(normalizedAuthor)) return true;
      const authorWords = normalizedAuthor.split(/[^a-z0-9]+/i).filter(Boolean);
      const surname = authorWords.at(-1);
      if (surname && surname.length >= 4 && messageWords.has(surname)) return true;
    }
  }
  return false;
}

function normalizePersonName(value = "") {
  return canonicalAuthorKey(value);
}

function personNameFromQuestion(message = "") {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  const match = text.match(/\b(?:millest|mida)\s+(?:on\s+)?(.+?)(?:\s+ise)?\s+ajakirjas\s+["'„“”]?Sotsiaaltöö["'„“”]?\s+kirjutanud\b/iu) ||
    text.match(/\b(?:millest|mida)\s+(?:on\s+)?(.+?)\s+kirjutanud\b/iu) ||
    text.match(/^\s*kes\s+on\s+(.+?)[?.!]*\s*$/iu) ||
    text.match(/^\s*(.+?)\s+(?:artiklid|artikleid|autorlus)\b/iu);
  return String(match?.[1] || "").replace(/\s+ise$/iu, "").trim();
}

export function selectPersonSourceGroups(
  message = "",
  groups = [],
  k = CONTEXT_GROUPS_MAX,
  personName = null,
  intent = null,
  topicTerms = [],
  coauthorNames = [],
  coauthorRequested = false
) {
  const candidates = Array.isArray(groups) ? groups.filter(Boolean) : [];
  const target = normalizePersonName(personName || personNameFromQuestion(message));
  const limit = Math.max(0, Math.min(Math.trunc(Number(k) || 0), candidates.length));
  if (!target || !limit) return candidates.slice(0, limit);
  const authored = [];
  const others = [];
  const requiredCoauthors = (Array.isArray(coauthorNames) ? coauthorNames : [])
    .map(normalizePersonName)
    .filter(Boolean);
  for (const group of candidates) {
    const normalizedAuthors = (Array.isArray(group?.authors) ? group.authors : [])
      .map(normalizePersonName)
      .filter(Boolean);
    const exactAuthor = normalizedAuthors.some(author => authorNamesCompatible(target, author))
      && requiredCoauthors.every(coauthor => normalizedAuthors.some(author => authorNamesCompatible(coauthor, author)))
      && (!coauthorRequested || requiredCoauthors.length > 0 || normalizedAuthors.length > 1);
    (exactAuthor ? authored : others).push(group);
  }
  const topicalAuthored = Array.isArray(topicTerms) && topicTerms.length
    ? authored.filter(group => matchesControlledEstonianTopic([
        group?.title,
        group?.section,
        ...(Array.isArray(group?.tags) ? group.tags : []),
        ...(Array.isArray(group?.bodies) ? group.bodies : [])
      ].filter(Boolean).join("\n"), topicTerms))
    : [];
  const preferredAuthored = topicalAuthored.length ? topicalAuthored : authored;
  if (coauthorRequested) return preferredAuthored.slice(0, limit);
  return (["authored_works", "authored_works_count"].includes(intent)
    ? preferredAuthored
    : [...preferredAuthored, ...others]).slice(0, limit);
}

function buildAuthorCorpusEvidence(matches = [], questionPlan = {}) {
  const enabled = ["authored_works", "authored_works_count"].includes(questionPlan?.person_source_intent);
  const required = questionPlan?.person_source_intent === "authored_works_count";
  const requestedAuthor = String(questionPlan?.person_name || "").trim();
  const target = normalizePersonName(requestedAuthor);
  const summaries = (Array.isArray(matches) ? matches : [])
    .map(match => match?.author_metadata_summary)
    .filter(summary => summary && typeof summary === "object")
    .filter(summary => authorNamesCompatible(
      summary.canonical_author_name || summary.requested_author,
      target
    ))
    .map(summary => {
      const documents = (Array.isArray(summary.documents) ? summary.documents : [])
        .map(document => ({
          documentId: String(document?.document_id || "").trim(),
          title: String(document?.title || "").trim(),
          year: String(document?.year || "").trim() || null,
          section: String(document?.section || "").trim() || null
        }))
        .filter(document => document.documentId && document.title)
        .sort((left, right) => (
          String(left.year || "").localeCompare(String(right.year || ""), "et") ||
          left.title.localeCompare(right.title, "et") ||
          left.documentId.localeCompare(right.documentId, "et")
        ));
      return {
        canonicalAuthorName: String(summary.canonical_author_name || summary.requested_author || "").trim(),
        canonicalAuthorKey: String(summary.canonical_author_key || "").trim(),
        documentCount: Number(summary.document_count),
        documentIds: Array.isArray(summary.document_ids)
          ? Array.from(new Set(summary.document_ids.map(value => String(value || "").trim()).filter(Boolean))).sort()
          : [],
        documents,
        complete: summary.complete === true,
        documentIdsComplete: summary.document_ids_complete === true,
        documentsComplete: summary.documents_complete === true,
        activeVersionsOnly: summary.active_versions_only === true
      };
    });
  const first = summaries[0] || null;
  const consistent = !!first && summaries.every(summary =>
    Number.isInteger(summary.documentCount) &&
    summary.documentCount === first.documentCount &&
    JSON.stringify(summary.documentIds) === JSON.stringify(first.documentIds) &&
    JSON.stringify(summary.documents) === JSON.stringify(first.documents)
  );
  const complete = !!(
    first &&
    consistent &&
    first.complete &&
    first.documentIdsComplete &&
    first.activeVersionsOnly &&
    first.documentCount === first.documentIds.length
  );
  return {
    enabled,
    required,
    requestedAuthor: requestedAuthor || null,
    canonicalAuthorName: complete ? first.canonicalAuthorName : null,
    canonicalAuthorKey: complete ? first.canonicalAuthorKey : null,
    matched: complete && first.documentCount > 0,
    complete,
    documentCount: complete ? first.documentCount : null,
    documentIds: complete ? first.documentIds : [],
    documents: complete && first.documentsComplete && first.documents.length === first.documentCount
      ? first.documents
      : [],
    documentsComplete: complete && first.documentsComplete && first.documents.length === first.documentCount,
    includesCoauthoredWorks: true,
    reasons: [
      ...(summaries.length ? [] : ["metadata_summary_missing"]),
      ...(!consistent && summaries.length ? ["metadata_summary_conflict"] : []),
      ...(first && !first.activeVersionsOnly ? ["active_version_scope_unconfirmed"] : []),
      ...(first && !first.documentIdsComplete ? ["document_id_set_incomplete"] : []),
      ...(first && !first.documentsComplete ? ["document_inventory_incomplete"] : []),
      ...(complete && first.documentCount === 0 ? ["author_not_found"] : [])
    ]
  };
}

function buildAuthorCorpusCountInstruction(replyLang = "et", evidence = {}) {
  if (!evidence?.complete || !Number.isInteger(Number(evidence?.documentCount))) return "";
  const count = Number(evidence.documentCount);
  if (replyLang === "en") {
    return `AUTHORSHIP_COUNT_EVIDENCE: Exact active author metadata identifies ${count} authored or co-authored works for the requested person in the current corpus. If the user asks how many works there are, use this metadata count; do not infer the total from the number of selected excerpts.`;
  }
  if (replyLang === "ru") {
    return `AUTHORSHIP_COUNT_EVIDENCE: Точные метаданные активных версий подтверждают ${count} авторских или соавторских работ запрошенного лица в текущем корпусе. Если пользователь спрашивает количество работ, используй этот итог метаданных, а не число выбранных фрагментов.`;
  }
  return `AUTHORSHIP_COUNT_EVIDENCE: aktiivsete versioonide täpne autorimeta kinnitab praeguses korpuses ${count} küsitud isiku autori- või kaasautorlusega tööd. Kui kasutaja küsib tööde arvu, kasuta seda metadata koguarvu; ära tuleta koguarvu valitud katkendite arvust.`;
}

function researchIdentityRoots(value = "") {
  const normalized = normalizeIntentText(value);
  const roots = new Set([normalized]);
  if (/^eaka/u.test(normalized)) roots.add("vanemaeal");
  if (/^vanemaeal/u.test(normalized)) roots.add("eaka");
  if (/^vagivall/u.test(normalized)) roots.add("vagival");
  for (const suffix of [
    "jatega", "jatele", "jatest", "jate", "misega", "misest", "mises", "mised",
    "mist", "mise", "mine", "usega", "usest", "uses", "used", "ust", "use", "sid",
    "te", "ed", "s"
  ]) {
    if (normalized.endsWith(suffix) && normalized.length - suffix.length >= 4) {
      roots.add(normalized.slice(0, -suffix.length));
    }
  }
  return Array.from(roots).filter(Boolean);
}

function researchIdentityCandidateRootEntries(normalizedCandidateText = "") {
  const text = String(normalizedCandidateText || "");
  const tokenMatches = Array.from(text.matchAll(
    /\d{1,3}(?:\p{Zs}+\d{3})+(?:[.,]\d+)?(?:\p{Zs}*%)?|\d+(?:[.,]\d+)?(?:\p{Zs}*%)?|[\p{L}]+/gu
  ));
  let segmentIndex = 0;
  let previousEnd = 0;
  let previousToken = "";
  let previousTokenWasYearMarker = false;
  return tokenMatches.map((match, index) => {
    const matchIndex = Number(match.index) || 0;
    const rawToken = String(match[0] || "");
    const token = normalizeIntentText(rawToken);
    const betweenTokens = text.slice(previousEnd, matchIndex);
    const nextRawToken = String(tokenMatches[index + 1]?.[0] || "");
    const nextToken = normalizeIntentText(nextRawToken);
    const nextMatchIndex = Number(tokenMatches[index + 1]?.index);
    const tokenEnd = matchIndex + rawToken.length;
    const afterToken = text.slice(tokenEnd, Number.isFinite(nextMatchIndex) ? nextMatchIndex : text.length);
    const previousIsYear = /^(?:19|20)\d{2}$/u.test(previousToken);
    const currentIsYear = /^(?:19|20)\d{2}$/u.test(token);
    const currentIsLowercaseWord = /\p{L}/u.test(rawToken) &&
      rawToken === rawToken.toLocaleLowerCase("et-EE");
    const currentIsLowercaseTemporalWord = currentIsLowercaseWord &&
      /^(?:aasta\p{L}*|kevad\p{L}*|sugi\p{L}*|talv\p{L}*|suvi\p{L}*)$/u.test(token);
    const yearRangeContinuation = previousIsYear && currentIsYear &&
      /[–—-]/u.test(betweenTokens) &&
      /^[\p{White_Space}.–—-]*$/u.test(betweenTokens);
    const yearMarkerContinuation = previousTokenWasYearMarker &&
      !/[\n\r]/u.test(betweenTokens) &&
      ((currentIsLowercaseWord && /^[\p{White_Space}.]*$/u.test(betweenTokens)) ||
        (currentIsYear && /[–—-]/u.test(betweenTokens) &&
          /^[\p{White_Space}.–—-]*$/u.test(betweenTokens)));
    const yearToAbbreviation = previousIsYear && /^(?:a|г|гг)$/u.test(token) &&
      rawToken === rawToken.toLocaleLowerCase("et-EE") &&
      !/[\n\r]/u.test(betweenTokens) &&
      /^[\p{White_Space}.]*$/u.test(betweenTokens);
    const yearToTemporalWord = previousIsYear && currentIsLowercaseTemporalWord &&
      !/[\n\r]/u.test(betweenTokens) &&
      /^[\p{White_Space}.]*$/u.test(betweenTokens);
    const yearContinuation = yearRangeContinuation || yearMarkerContinuation ||
      yearToAbbreviation || yearToTemporalWord;
    const compactToken = token.replace(/\p{White_Space}+/gu, "");
    const compactPreviousToken = previousToken.replace(/\p{White_Space}+/gu, "");
    const compactNextToken = nextToken.replace(/\p{White_Space}+/gu, "");
    const currentIsNumeric = /^\d+(?:[.,]\d+)?%?$/u.test(compactToken);
    const numericRangeKey = currentIsNumeric && (
      (/^\d+(?:[.,]\d+)?%?$/u.test(compactPreviousToken) && /[–—-]/u.test(betweenTokens)) ||
      (/^\d+(?:[.,]\d+)?%?$/u.test(compactNextToken) && /[–—-]/u.test(afterToken))
    )
      ? (/^\d+(?:[.,]\d+)?%?$/u.test(compactPreviousToken) && /[–—-]/u.test(betweenTokens)
          ? `range:${index - 1}-${index}`
          : `range:${index}-${index + 1}`)
      : null;
    const strongBoundaryText = yearContinuation
      ? betweenTokens.replace(/\./gu, "")
      : betweenTokens;
    segmentIndex += (strongBoundaryText.match(/[.!?;\n]+/gu) || []).length;
    previousEnd = tokenEnd;
    previousToken = token;
    previousTokenWasYearMarker = yearToAbbreviation;
    return {
      index,
      start: matchIndex,
      end: tokenEnd,
      segmentIndex,
      token,
      numericEvidenceKey: numericRangeKey || index,
      yearRangeAdjacent: currentIsYear && (
        (previousIsYear && /[–—-]/u.test(betweenTokens)) ||
        (/^(?:19|20)\d{2}$/u.test(nextToken) && /[–—-]/u.test(afterToken))
      ),
      yearSlashAdjacent: currentIsYear && (
        (/^(?:\d{1,2}|(?:19|20)\d{2})$/u.test(previousToken) && /\//u.test(betweenTokens)) ||
        (/^(?:\d{1,2}|(?:19|20)\d{2})$/u.test(nextToken) && /\//u.test(afterToken))
      ),
      roots: researchIdentityRoots(token)
    };
  });
}

function researchIdentityTermMatchesEntries(term = "", candidateEntries = []) {
  const normalizedTerm = normalizeIntentText(term);
  const termRoots = researchIdentityRoots(term);
  return candidateEntries.some(({ token: candidateToken, roots: candidateRoots = [] }) =>
    termRoots.some(termRoot => candidateRoots.some(candidateRoot => {
      const shorter = termRoot.length <= candidateRoot.length ? termRoot : candidateRoot;
      const longer = shorter === termRoot ? candidateRoot : termRoot;
      return (
        (shorter.length >= 4 && longer.startsWith(shorter)) ||
        (termRoot.length >= 5 && candidateToken.length >= 8 && candidateToken.includes(termRoot)) ||
        (candidateRoot.length >= 5 && normalizedTerm.length >= 8 && normalizedTerm.includes(candidateRoot))
      );
    }))
  );
}

const BOUNDED_EPISODE_METRIC_CATEGORY_TOKEN_PATTERNS = {
  people: [
    /^inimes\p{L}*$/u,
    /^(?:people|persons?)$/u,
    /^(?:человек\p{L}*|люд(?:и|еи|ям|ьми|ях))$/u
  ],
  participants: [
    /^(?:osalej\p{L}*|osale(?:s|sid|b|vad|n|me|te|ti|nud))$/u,
    /^participants?$/u,
    /^(?:участник\p{L}*|участниц\p{L}*)$/u
  ],
  volunteers: [/^vabatahtlik\p{L}*$/u, /^volunteers?$/u, /^волонтер\p{L}*$/u],
  hours: [
    /^tootun(?:d|n)\p{L}*$/u,
    /^(?:tund|tundi|tunde|tunnid|tundide\p{L}*|tunnil|tunnilt|tunnile|tunniga|tunniks|tunnist|tunnis)$/u,
    /^hours?$/u,
    /^(?:час|часа|часов|часы|часу|часе|часам|часами|часах)$/u
  ],
  counties: [
    /^(?:maakond(?!lik)\p{L}*|maakonna\p{L}*)$/u,
    /^(?:county|counties)$/u,
    /^уезд\p{L}*$/u
  ],
  municipalities: [/^omavalits(?!uslik)\p{L}*$/u, /^municipalit(?:y|ies)$/u, /^муниципал\p{L}*$/u],
  countries: [
    /^(?:riik|riiki|riigid|riigi|riigis|riigist|riigile|riigilt|riigiga|riigiks|riikide|riikides|riikidest|riikidele|riikidelt|riikidega|riikideks)$/u,
    /^(?:country|countries)$/u,
    /^стран\p{L}*$/u
  ],
  meetings: [/^kohtum\p{L}*$/u, /^meetings?$/u, /^встреч\p{L}*$/u],
  cases: [/^juhtum\p{L}*$/u, /^cases?$/u, /^случа\p{L}*$/u],
  respondents: [/^vastaj\p{L}*$/u, /^respondents?$/u, /^респондент\p{L}*$/u],
  specialists: [/^spetsialist\p{L}*$/u, /^specialists?$/u, /^специалист\p{L}*$/u],
  workers: [/^tootaj\p{L}*$/u, /^workers?$/u, /^(?:работник\p{L}*|сотрудник\p{L}*)$/u]
};

const BOUNDED_EPISODE_SUBJECT_ANCHOR_CATEGORIES = new Set([
  "participants",
  "volunteers",
  "counties",
  "municipalities",
  "meetings",
  "cases",
  "respondents",
  "specialists",
  "workers"
]);

const BOUNDED_EPISODE_PHASE_MODIFIERS = [
  {
    ordinal: "first",
    patterns: [/^esim(?:ene|ese\p{L}*|est\p{L}*|esi\p{L}*)$/u, /^first$/u, /^перв\p{L}*$/u]
  },
  {
    ordinal: "second",
    patterns: [/^tei(?:ne|se\p{L}*|st\p{L}*|si\p{L}*)$/u, /^second$/u, /^втор\p{L}*$/u]
  },
  {
    ordinal: "third",
    patterns: [/^kolm(?:as|and\p{L}*)$/u, /^third$/u, /^трет\p{L}*$/u]
  },
  {
    ordinal: "next",
    patterns: [
      /^(?:jargmi|jargnev)\p{L}*$/u,
      /^(?:next|subsequent|following)$/u,
      /^(?:следующ|последующ)\p{L}*$/u
    ]
  },
  { ordinal: "later", patterns: [/^hilisem\p{L}*$/u, /^later$/u, /^поздн\p{L}*$/u] }
];

const BOUNDED_EPISODE_PHASE_TOKEN_PATTERNS = [
  /^(?:katseetap|projekti?etap|etap|voor|faas|piloot)\p{L}*$/u,
  /^(?:pilot|trial|phase|stage|round)\p{L}*$/u,
  /^(?:пилот|этап|фаз|раунд)\p{L}*$/u
];

const BOUNDED_EPISODE_YEAR_CONTEXT_TOKEN_PATTERNS = [
  /^(?:aasta\p{L}*|jaanuar\p{L}*|veebruar\p{L}*|marts\p{L}*|aprill\p{L}*|mai|juuni\p{L}*|juuli\p{L}*|august\p{L}*|september\p{L}*|oktoober\p{L}*|november\p{L}*|detsember\p{L}*)$/u,
  /^(?:year\p{L}*|january|february|march|april|may|june|july|august|september|october|november|december)$/u,
  /^(?:год\p{L}*|январ\p{L}*|феврал\p{L}*|март\p{L}*|апрел\p{L}*|ма[ий]\p{L}*|июн\p{L}*|июл\p{L}*|август\p{L}*|сентябр\p{L}*|октябр\p{L}*|ноябр\p{L}*|декабр\p{L}*)$/u
];

const BOUNDED_EPISODE_YEAR_MARKER_TOKEN_PATTERN = /^(?:a|г|гг)$/u;

const BOUNDED_EPISODE_YEAR_PREPOSITION_PATTERNS = [
  /^(?:aastal|aastast|aastani)$/u,
  /^(?:in|during)$/u,
  /^в$/u
];

function boundedEpisodeMetricSlotMatchesEntries(slot = {}, candidateEntries = []) {
  const category = String(slot?.category || "").trim();
  const categoryPatterns = BOUNDED_EPISODE_METRIC_CATEGORY_TOKEN_PATTERNS[category] || [];
  if (categoryPatterns.length) {
    return candidateEntries.some(entry => categoryPatterns.some(pattern => pattern.test(entry.token)));
  }
  const queryTerms = Array.isArray(slot?.terms) ? slot.terms : [];
  return queryTerms.some(term =>
    researchIdentityTermMatchesEntries(term, candidateEntries)
  );
}

function boundedEpisodeNumericEntryIsYear(entry = {}, candidateEntries = [], excludedTokens = new Set()) {
  const compactToken = String(entry?.token || "").replace(/\p{White_Space}+/gu, "");
  if (excludedTokens.has(compactToken)) return true;
  if (!/^(?:19|20)\d{2}$/u.test(compactToken)) return false;
  if (entry.yearRangeAdjacent || entry.yearSlashAdjacent) return true;
  const previousEntry = candidateEntries.find(candidate => candidate.index === entry.index - 1) || null;
  const nextEntry = candidateEntries.find(candidate => candidate.index === entry.index + 1) || null;
  const previousEntrySharesSegment = previousEntry?.segmentIndex === entry.segmentIndex;
  const nextEntrySharesSegment = nextEntry?.segmentIndex === entry.segmentIndex;
  const hasPreviousYearContextToken = previousEntrySharesSegment && BOUNDED_EPISODE_YEAR_CONTEXT_TOKEN_PATTERNS.some(pattern =>
    pattern.test(previousEntry.token)
  );
  const hasNextYearContextToken = nextEntrySharesSegment && (
    BOUNDED_EPISODE_YEAR_MARKER_TOKEN_PATTERN.test(nextEntry.token) ||
    BOUNDED_EPISODE_YEAR_CONTEXT_TOKEN_PATTERNS.some(pattern => pattern.test(nextEntry.token))
  );
  const hasYearPreposition = previousEntrySharesSegment && BOUNDED_EPISODE_YEAR_PREPOSITION_PATTERNS.some(pattern =>
    pattern.test(previousEntry.token)
  );
  return hasPreviousYearContextToken || hasNextYearContextToken || hasYearPreposition;
}

function boundedEpisodeMetricSlotsHaveDistinctNumericEvidence(
  slots = [],
  candidateEntries = [],
  excludedNumericTokens = []
) {
  const excludedTokens = new Set((Array.isArray(excludedNumericTokens) ? excludedNumericTokens : [])
    .map(value => String(value || "").trim())
    .filter(Boolean));
  const percentageEvidenceKeys = new Set(candidateEntries.filter(entry =>
    /%$/u.test(entry.token.replace(/\p{White_Space}+/gu, ""))
  ).map(entry => entry.numericEvidenceKey));
  const numericEntries = candidateEntries.filter(entry => {
    const compactToken = entry.token.replace(/\p{White_Space}+/gu, "");
    return /^\d+(?:[.,]\d+)?$/u.test(compactToken) &&
      !percentageEvidenceKeys.has(entry.numericEvidenceKey) &&
      !boundedEpisodeNumericEntryIsYear(entry, candidateEntries, excludedTokens);
  });
  if (new Set(numericEntries.map(entry => entry.numericEvidenceKey)).size < slots.length) return false;
  const slotOptions = slots.map(slot => {
    const metricEntries = candidateEntries.filter(entry =>
      boundedEpisodeMetricSlotMatchesEntries(slot, [entry])
    );
    const numericIndexes = numericEntries.filter(numericEntry =>
      metricEntries.some(metricEntry =>
        metricEntry.segmentIndex === numericEntry.segmentIndex &&
        Math.abs(metricEntry.index - numericEntry.index) <= 4
      )
    ).map(entry => entry.numericEvidenceKey);
    return Array.from(new Set(numericIndexes));
  }).sort((left, right) => left.length - right.length);
  if (slotOptions.some(options => options.length === 0)) return false;

  const usedNumericIndexes = new Set();
  function assignSlot(slotIndex) {
    if (slotIndex >= slotOptions.length) return true;
    for (const numericIndex of slotOptions[slotIndex]) {
      if (usedNumericIndexes.has(numericIndex)) continue;
      usedNumericIndexes.add(numericIndex);
      if (assignSlot(slotIndex + 1)) return true;
      usedNumericIndexes.delete(numericIndex);
    }
    return false;
  }
  return assignSlot(0);
}

function boundedEpisodePhaseOrdinalsConflict(requested = null, candidate = null) {
  const requestedOrdinal = String(requested || "").trim().toLowerCase();
  const candidateOrdinal = String(candidate || "").trim().toLowerCase();
  if (!requestedOrdinal || !candidateOrdinal || requestedOrdinal === candidateOrdinal) return false;
  const nextSecondEquivalents = new Set(["next", "second"]);
  return !(nextSecondEquivalents.has(requestedOrdinal) && nextSecondEquivalents.has(candidateOrdinal));
}

function boundedEpisodeWindowHasCompetingPhaseCue(
  slots = [],
  candidateEntries = [],
  evidencePeriodYears = [],
  excludedNumericTokens = [],
  requestedPhaseOrdinal = null
) {
  const yearTokens = new Set((Array.isArray(evidencePeriodYears) ? evidencePeriodYears : [])
    .map(value => String(value || "").trim())
    .filter(Boolean));
  const yearEntries = candidateEntries.filter(entry => yearTokens.has(entry.token));
  if (!yearEntries.length) return false;
  const yearSegments = new Set(yearEntries.map(entry => entry.segmentIndex));
  const normalizedRequestedPhase = String(requestedPhaseOrdinal || "").trim().toLowerCase() || null;
  for (const modifierEntry of candidateEntries) {
    const modifier = BOUNDED_EPISODE_PHASE_MODIFIERS.find(item =>
      item.patterns.some(pattern => pattern.test(modifierEntry.token))
    );
    if (!modifier) continue;
    const phaseEntry = candidateEntries.find(entry =>
      entry.segmentIndex === modifierEntry.segmentIndex &&
      Math.abs(entry.index - modifierEntry.index) <= 2 &&
      BOUNDED_EPISODE_PHASE_TOKEN_PATTERNS.some(pattern => pattern.test(entry.token))
    );
    if (!phaseEntry) continue;
    const segmentEntries = candidateEntries.filter(entry => entry.segmentIndex === modifierEntry.segmentIndex);
    const hasRequestedMetric = slots.some(slot =>
      boundedEpisodeMetricSlotMatchesEntries(slot, segmentEntries)
    );
    if (!hasRequestedMetric) continue;
    const modifierConflicts = normalizedRequestedPhase
      ? boundedEpisodePhaseOrdinalsConflict(normalizedRequestedPhase, modifier.ordinal)
      : !yearSegments.has(modifierEntry.segmentIndex);
    if (!modifierConflicts) continue;
    const remainingEntries = candidateEntries.filter(entry => entry.segmentIndex !== modifierEntry.segmentIndex);
    const remainingTokens = new Set(remainingEntries.map(entry => entry.token));
    const completeWithoutCompetingSegment = evidencePeriodYears.every(year => remainingTokens.has(year)) &&
      slots.every(slot => boundedEpisodeMetricSlotMatchesEntries(slot, remainingEntries)) &&
      boundedEpisodeMetricSlotsHaveDistinctNumericEvidence(
        slots,
        remainingEntries,
        excludedNumericTokens
      );
    if (!completeWithoutCompetingSegment) return true;
  }
  return false;
}

function researchPersonMatchesAuthor(personName = "", author = "") {
  return authorNamesCompatible(personName, author);
}

function buildAuthorCorpusInventoryInstruction(replyLang = "et", evidence = {}) {
  const documents = Array.isArray(evidence?.documents) ? evidence.documents : [];
  if (!evidence?.complete || !evidence?.documentsComplete || !documents.length || documents.length > 50) {
    return "";
  }
  const author = String(evidence?.canonicalAuthorName || evidence?.requestedAuthor || "").trim();
  const rows = documents.map((document, index) => {
    const metadata = [document.year, document.section].filter(Boolean).join(", ");
    return `${index + 1}. ${document.title}${metadata ? ` (${metadata})` : ""}`;
  }).join("\n");
  if (replyLang === "en") {
    return `AUTHORSHIP_INVENTORY_EVIDENCE: The active registry contains the following complete authored/co-authored work inventory for ${author}:\n${rows}\nThis inventory is complete for the current corpus. When asked which works exist, list every row and do not say that completeness is unconfirmed.`;
  }
  if (replyLang === "ru") {
    return `AUTHORSHIP_INVENTORY_EVIDENCE: Активный реестр содержит следующий полный список авторских и соавторских работ для ${author}:\n${rows}\nЭто полный список для текущего корпуса. Если спрашивают, какие работы есть, перечисли каждую строку и не утверждай, что полнота не подтверждена.`;
  }
  return `AUTHORSHIP_INVENTORY_EVIDENCE: aktiivses registris on ${author} autori- või kaasautorlusega tööde täielik loend:\n${rows}\nLoend on praeguse korpuse kohta täielik. Kui küsitakse, millised tööd on, nimeta kõik read ja ära väida, et loendi täielikkus on kinnitamata.`;
}

function buildDeterministicAuthorCorpusReply(replyLang = "et", evidence = {}) {
  const documents = Array.isArray(evidence?.documents) ? evidence.documents : [];
  if (!evidence?.complete || !evidence?.documentsComplete || !documents.length || documents.length > 50) {
    return "";
  }
  const author = String(evidence?.canonicalAuthorName || evidence?.requestedAuthor || "").trim();
  const rows = documents.map((document, index) => {
    const metadata = [document.year, document.section].filter(Boolean).join(", ");
    return `${index + 1}. ${document.title}${metadata ? ` (${metadata})` : ""}`;
  }).join("\n");
  if (replyLang === "en") {
    return `The active corpus contains ${documents.length} works authored or co-authored by ${author}:\n${rows}`;
  }
  if (replyLang === "ru") {
    return `В активном корпусе есть ${documents.length} работ, автором или соавтором которых является ${author}:\n${rows}`;
  }
  return `Aktiivses korpuses on ${author} autori või kaasautorina ${documents.length} tööd:\n${rows}`;
}

function researchGroupDocumentId(group = {}, index = 0) {
  return String(
    group?.docId || group?.doc_id || group?.canonicalItemId || group?.canonical_item_id ||
    group?.articleId || group?.sourceId || group?.title || `research-source-${index}`
  ).trim();
}

function canonicalResearchTitleFamilyMatch(requestedTitle = "", candidateTitle = "") {
  const requested = normalizeIntentText(requestedTitle);
  const candidate = normalizeIntentText(candidateTitle);
  if (!requested || !candidate) {
    return { matched: false, kind: "none", priority: 0 };
  }
  if (candidate === requested) {
    return { matched: true, kind: "exact", priority: 3 };
  }
  // An explicitly named summary is a distinct document, not a request for
  // either sibling in the title family.
  if (/(?:^|\s)(?:kokkuvote|luhikokkuvote)$/u.test(requested)) {
    return { matched: false, kind: "none", priority: 0 };
  }
  const variants = [
    { title: `${requested} kokkuvote`, kind: "summary", priority: 2 },
    { title: `${requested}u kokkuvote`, kind: "summary", priority: 2 },
    { title: `${requested} luhikokkuvote`, kind: "short_summary", priority: 1 },
    { title: `${requested}u luhikokkuvote`, kind: "short_summary", priority: 1 }
  ];
  const variant = variants.find(item => item.title === candidate);
  return variant
    ? { matched: true, kind: variant.kind, priority: variant.priority }
    : { matched: false, kind: "none", priority: 0 };
}

function specificResearchDocumentLockEligible(questionPlan = {}, identityEvidence = null) {
  if (
    identityEvidence?.matched !== true ||
    identityEvidence?.confidence !== "high" ||
    !String(identityEvidence?.selectedDocumentId || "").trim()
  ) return false;
  const selectedDocumentId = String(identityEvidence.selectedDocumentId).trim();
  const trustedDocumentId = String(questionPlan?.trusted_document_id || "").trim();
  const trustedSource = String(questionPlan?.trusted_document_id_source || "").trim();
  const currentIdentity = questionPlan?.semantic_candidates?.current_turn_document_identity;
  const explicitTitle = currentIdentity?.title_hint?.provenance === "explicit_current_turn"
    ? String(currentIdentity?.title_hint?.value || "").trim()
    : "";
  if (
    !explicitTitle &&
    trustedDocumentId === selectedDocumentId &&
    trustedSource === "previous_source_exact_filter"
  ) return true;

  const requestedAuthors = Array.from(new Set((Array.isArray(questionPlan?.document_author_names)
    ? questionPlan.document_author_names
    : [])
    .map(value => String(value || "").trim())
    .filter(Boolean)));
  const requestedYears = Array.from(new Set((Array.isArray(questionPlan?.document_source_years)
    ? questionPlan.document_source_years
    : [])
    .map(value => String(value || "").trim())
    .filter(value => /^(?:19|20)\d{2}$/u.test(value))));
  const reasons = Array.isArray(identityEvidence?.reasons) ? identityEvidence.reasons : [];
  const exactTitleConfirmed = Boolean(explicitTitle) && reasons.includes("exact_title_anchor");
  const canonicalTitleFamilyConfirmed = Boolean(explicitTitle) &&
    reasons.includes("decisive_canonical_title_family_anchor");
  const allAuthorsConfirmed = requestedAuthors.length > 0 && requestedAuthors.every(author =>
    reasons.some(reason =>
      String(reason || "").startsWith("author_match:") &&
      authorNamesCompatible(author, String(reason || "").slice("author_match:".length))
    )
  );
  const explicitYearConfirmed = requestedYears.length > 0 && requestedYears.every(year =>
    reasons.includes(`source_year:${year}`)
  );
  const authorConfirmationTrusted = trustedDocumentId === selectedDocumentId &&
    trustedSource === "current_turn_author_confirmation" &&
    (Boolean(explicitTitle) || requestedYears.length > 0);
  return exactTitleConfirmed ||
    canonicalTitleFamilyConfirmed ||
    authorConfirmationTrusted ||
    (allAuthorsConfirmed && explicitYearConfirmed);
}

export function selectSpecificResearchFactGroups(_message = "", groups = [], questionPlan = {}) {
  const candidates = Array.isArray(groups) ? groups.filter(Boolean) : [];
  const subjectTerms = (Array.isArray(questionPlan?.document_subject_terms)
    ? questionPlan.document_subject_terms
    : []).map(value => String(value || "").trim()).filter(Boolean);
  const boundedEpisodeIdentity = questionPlan?.bounded_episode_metric_fact === true;
  const evidencePeriodYears = Array.from(new Set((Array.isArray(questionPlan?.evidence_period_years)
    ? questionPlan.evidence_period_years
    : []).map(value => String(value || "").trim()).filter(value => /^(?:19|20)\d{2}$/u.test(value))));
  const requestedEpisodePhaseOrdinal = String(questionPlan?.evidence_phase_ordinal || "").trim().toLowerCase() || null;
  const evidenceMetricTerms = Array.from(new Set((Array.isArray(questionPlan?.evidence_metric_terms)
    ? questionPlan.evidence_metric_terms
    : []).map(value => String(value || "").trim()).filter(Boolean)));
  const evidenceMetricSlots = (Array.isArray(questionPlan?.evidence_metric_slots)
    ? questionPlan.evidence_metric_slots
    : []).map(slot => ({
      category: String(slot?.category || "").trim(),
      terms: Array.from(new Set((Array.isArray(slot?.terms) ? slot.terms : [])
        .map(value => String(value || "").trim())
        .filter(Boolean)))
    })).filter(slot => slot.category && slot.terms.length);
  const effectiveEvidenceMetricSlots = evidenceMetricSlots.length
    ? evidenceMetricSlots
    : evidenceMetricTerms.map(term => ({ category: term, terms: [term] }));
  const requestedSourceYears = Array.from(new Set((Array.isArray(questionPlan?.document_source_years)
    ? questionPlan.document_source_years
    : []).map(value => String(value || "").trim()).filter(value => /^(?:19|20)\d{2}$/u.test(value))));
  const acronymAnchorTerms = Array.from(new Set(
    Array.from(String(_message || "").matchAll(/(?<![\p{L}\d])([\p{Lu}\d][\p{Lu}\d-]{1,})(?![\p{L}\d])/gu))
      .map(match => normalizeIntentText(match?.[1] || ""))
      .filter(term => /[a-z]/u.test(term))
  ));
  const plannedAnchorTerms = (Array.isArray(questionPlan?.document_anchor_terms)
    ? questionPlan.document_anchor_terms
    : []).map(value => normalizeIntentText(value)).filter(Boolean);
  const titleHint = normalizeIntentText(
    questionPlan?.semantic_candidates?.current_turn_document_identity?.title_hint?.value || ""
  );
  const explicitCurrentTitleHint =
    questionPlan?.semantic_candidates?.current_turn_document_identity?.title_hint?.provenance ===
      "explicit_current_turn" && !!titleHint;
  const explicitDocumentAnchorTerms = Array.from(new Set([
    ...acronymAnchorTerms,
    ...plannedAnchorTerms,
    String(questionPlan?.document_source_kind || "").trim(),
    ...subjectTerms.filter(term => /^(?:19|20)\d{2}$/u.test(term))
  ].map(value => normalizeIntentText(value)).filter(Boolean)));
  const requestedAuthors = Array.from(new Set((Array.isArray(questionPlan?.document_author_names)
    ? questionPlan.document_author_names
    : [questionPlan?.person_name])
    .map(value => String(value || "").trim())
    .filter(Boolean)));
  const requestedAuthor = requestedAuthors[0] || "";
  const requestedFactSlots = Array.isArray(
    questionPlan?.semantic_candidates?.requested_fact_slots?.slots
  )
    ? questionPlan.semantic_candidates.requested_fact_slots.slots.slice(0, 12)
    : [];
  const requestedFactRelationTerms = Array.from(new Set(
    requestedFactSlots.flatMap(slot => Array.isArray(slot?.relation_terms) ? slot.relation_terms : [])
      .map(value => String(value || "").trim())
      .filter(Boolean)
  )).slice(0, 24);
  const requestedExplicitValues = Array.from(new Set(
    requestedFactSlots.flatMap(slot => Array.isArray(slot?.explicit_values) ? slot.explicit_values : [])
      .map(value => String(value || "").trim())
      .filter(value => /^\d+(?:[.,]\d+)?%?$/u.test(value))
  ));
  const numericFactTerms = Array.from(new Set([
    ...(Array.isArray(questionPlan?.document_fact_terms) ? questionPlan.document_fact_terms : []),
    ...requestedExplicitValues
  ].map(value => String(value || "").trim()).filter(value => /^\d+(?:[.,]\d+)?%?$/u.test(value))));
  const requestedMetricSlots = requestedFactSlots.length
    ? requestedFactSlots
      .filter(slot => REQUESTED_METRIC_SUPPORTED_VALUE_TYPES.has(String(slot?.value_type || "")))
      .slice(0, REQUESTED_METRIC_CONTRACT_MAX_SLOTS)
    : [];
  const implicitNumericIdentity = [
    "implicit_multi_cohort_numeric_fact_shape",
    "implicit_explicit_value_relation_shape"
  ].includes(questionPlan?.planner_reason);
  const ranked = candidates.map((group, index) => {
    const identityText = [
      group?.title,
      group?.section,
      group?.description,
      group?.registryDescription,
      group?.registry_description,
      group?.organization,
      group?.organizationName,
      group?.organization_name,
      ...(Array.isArray(group?.tags) ? group.tags : []),
      group?.shortRef,
      group?.short_ref,
      group?.docId,
      group?.doc_id,
      group?.sourceId,
      group?.source_id,
      group?.canonicalItemId,
      group?.canonical_item_id,
      ...(Array.isArray(group?.bodies) ? group.bodies.slice(0, 2) : [])
    ].filter(Boolean).join(" ");
    const authors = Array.isArray(group?.authors) ? group.authors : [];
    const matchedRequestedAuthors = requestedAuthors.filter(requested => authors.some(author =>
      researchPersonMatchesAuthor(requested, author)
    ));
    const authorMatched = requestedAuthors.length > 0 && matchedRequestedAuthors.length === requestedAuthors.length;
    const normalizedIdentityText = normalizeIntentText(identityText);
    const normalizedTitle = normalizeIntentText(group?.title || "");
    const titleFamilyMatch = canonicalResearchTitleFamilyMatch(titleHint, normalizedTitle);
    const exactTitleAnchorMatched = titleFamilyMatch.kind === "exact";
    const canonicalTitleFamilyMatched = titleFamilyMatch.matched;
    const canonicalTitleFamilyVariant = titleFamilyMatch.kind;
    const titleAnchorPriority = titleFamilyMatch.priority;
    const explicitTitleAnchorMatched = explicitCurrentTitleHint && canonicalTitleFamilyMatched;
    const identityEntries = researchIdentityCandidateRootEntries(identityText);
    const titleEntries = researchIdentityCandidateRootEntries(group?.title || "");
    const subjectMatches = subjectTerms.filter(term => researchIdentityTermMatchesEntries(term, identityEntries));
    const titleSubjectMatches = subjectTerms.filter(term =>
      researchIdentityTermMatchesEntries(term, titleEntries)
    );
    const metricSubjectAnchorMatches = boundedEpisodeIdentity
      ? effectiveEvidenceMetricSlots.filter(slot =>
          BOUNDED_EPISODE_SUBJECT_ANCHOR_CATEGORIES.has(slot.category) &&
          boundedEpisodeMetricSlotMatchesEntries(slot, identityEntries)
        ).map(slot => slot.category)
      : [];
    const documentAnchorMatches = explicitDocumentAnchorTerms.filter(term =>
      researchIdentityTermMatchesEntries(term, identityEntries)
    );
    const titleDocumentAnchorMatches = explicitDocumentAnchorTerms.filter(term =>
      researchIdentityTermMatchesEntries(term, titleEntries)
    );
    const bodyText = (Array.isArray(group?.bodies) ? group.bodies : [])
      .map(value => String(value || ""))
      .join(" ");
    const normalizedBodyText = normalizeIntentText(bodyText);
    const requestedMetricShape = requestedMetricSlots.length
      ? (() => {
          const evidence = requestedMetricEvidenceCandidates(
            bodyText,
            requestedMetricSlots.map(slot => slot?.value_type)
          );
          const mapping = bestRequestedMetricAssignment(requestedMetricSlots, evidence.candidates);
          return {
            complete: !mapping.ambiguous && mapping.assignment?.length === requestedMetricSlots.length,
            mappedSlotCount: Array.isArray(mapping.assignment) ? mapping.assignment.length : 0,
            score: Array.isArray(mapping.assignment)
              ? mapping.assignment.reduce((sum, option) => sum + Number(option?.score || 0), 0)
              : 0
          };
        })()
      : { complete: false, mappedSlotCount: 0, score: 0 };
    const bodyEntries = authorMatched || boundedEpisodeIdentity
      ? researchIdentityCandidateRootEntries(bodyText)
      : [];
    const bodySubjectMatches = authorMatched
      ? subjectTerms.filter(term => researchIdentityTermMatchesEntries(term, bodyEntries))
      : [];
    const numericFactMatches = numericFactTerms.filter(term => {
      const normalizedTerm = normalizeIntentText(term).replace(/\s+/gu, "");
      if (!normalizedTerm) return false;
      const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(?<![a-z0-9])${escaped.replace("%", "\\s*%")}(?![a-z0-9])`, "u").test(normalizedBodyText);
    });
    const requestedFactRelationMatches = requestedFactRelationTerms.filter(term =>
      researchIdentityTermMatchesEntries(term, identityEntries)
    );
    const factFingerprintMatched = !titleHint && requestedAuthors.length === 0 && subjectMatches.length >= 1 && (
      (requestedFactRelationTerms.length >= 2 && requestedFactRelationMatches.length >= 2) ||
      (numericFactTerms.length >= 2 && numericFactMatches.length >= 2)
    );
    const evidencePeriodYearMatches = boundedEpisodeIdentity
      ? evidencePeriodYears.filter(year => new RegExp(`(?<![a-z0-9])${year}(?![a-z0-9])`, "u").test(normalizedBodyText))
      : [];
    const evidenceMetricMatches = boundedEpisodeIdentity
      ? effectiveEvidenceMetricSlots.filter(slot =>
          boundedEpisodeMetricSlotMatchesEntries(slot, bodyEntries)
        ).map(slot => slot.category)
      : [];
    const excludedEpisodeNumericTokens = [...evidencePeriodYears, ...requestedSourceYears];
    const boundedEpisodeWindowEvidence = boundedEpisodeIdentity
      ? (Array.isArray(group?.bodies) ? group.bodies : []).flatMap((body, bodyIndex) => {
          const bodyTextValue = String(body || "");
          const bodyRootEntries = researchIdentityCandidateRootEntries(bodyTextValue);
          const segmentIndexes = Array.from(new Set(bodyRootEntries.map(entry => entry.segmentIndex)));
          return segmentIndexes.map((segmentStart, segmentPosition) => {
            const windowSegmentIndexes = new Set(segmentIndexes.slice(segmentPosition, segmentPosition + 2));
            const windowEntries = bodyRootEntries.filter(entry => windowSegmentIndexes.has(entry.segmentIndex));
            const windowTokens = new Set(windowEntries.map(entry => entry.token.replace(/\p{White_Space}+/gu, "")));
            const periodYears = evidencePeriodYears.filter(year => windowTokens.has(year));
            const metricCategories = effectiveEvidenceMetricSlots.filter(slot =>
              boundedEpisodeMetricSlotMatchesEntries(slot, windowEntries)
            ).map(slot => slot.category);
            const distinctNumericEvidence = boundedEpisodeMetricSlotsHaveDistinctNumericEvidence(
              effectiveEvidenceMetricSlots,
              windowEntries,
              excludedEpisodeNumericTokens
            );
            const competingPhaseCue = boundedEpisodeWindowHasCompetingPhaseCue(
              effectiveEvidenceMetricSlots,
              windowEntries,
              evidencePeriodYears,
              excludedEpisodeNumericTokens,
              requestedEpisodePhaseOrdinal
            );
            return {
              bodyIndex,
              segmentStart,
              segmentEnd: windowEntries.at(-1)?.segmentIndex ?? segmentStart,
              evidenceBody: bodyTextValue.slice(
                windowEntries[0]?.start ?? 0,
                windowEntries.at(-1)?.end ?? bodyTextValue.length
              ).trim(),
              periodYears,
              metricCategories,
              distinctNumericEvidence,
              competingPhaseCue
            };
          });
        })
      : [];
    const completeEpisodeWindow = boundedEpisodeWindowEvidence.find(item =>
      item.periodYears.length === evidencePeriodYears.length &&
      item.metricCategories.length === effectiveEvidenceMetricSlots.length &&
      item.distinctNumericEvidence &&
      !item.competingPhaseCue
    ) || null;
    const resolvedSourceYear = extractMatchGroupYear(group);
    const sourceYearMatches = requestedSourceYears.filter(year => (
      Number.isInteger(resolvedSourceYear)
        ? resolvedSourceYear === Number(year)
        : new RegExp(`(?<![a-z0-9])${year}(?![a-z0-9])`, "u").test(normalizedIdentityText)
    ));
    const sourceYearCompatible = requestedSourceYears.length !== 1 || sourceYearMatches.length === 1;
    const channels = new Set([
      ...(Array.isArray(group?.retrievalChannels) ? group.retrievalChannels : []),
      ...(Array.isArray(group?.retrieval_channels) ? group.retrieval_channels : [])
    ].map(value => String(value || "").trim()).filter(Boolean));
    const researchOrJournal = isResearchOrJournalSource(group);
    const sourceCompatible = !isLegalSource(group);
    const boundedEpisodeCoLocated = !!(
      boundedEpisodeIdentity &&
      sourceCompatible &&
      researchOrJournal &&
      (subjectMatches.length >= 1 || metricSubjectAnchorMatches.length >= 1) &&
      sourceYearMatches.length === requestedSourceYears.length &&
      evidencePeriodYears.length >= 2 &&
      effectiveEvidenceMetricSlots.length >= 3 &&
      !!completeEpisodeWindow
    );
    let score = subjectMatches.length * 2;
    if (exactTitleAnchorMatched) score += 100;
    else if (canonicalTitleFamilyVariant === "summary") score += 90;
    else if (canonicalTitleFamilyVariant === "short_summary") score += 80;
    score += metricSubjectAnchorMatches.length * 2;
    score += authorMatched ? bodySubjectMatches.length : 0;
    score += documentAnchorMatches.length * 4;
    score += titleDocumentAnchorMatches.length * 2;
    if (authorMatched) score += 8 + matchedRequestedAuthors.length * 2;
    if (researchOrJournal) score += 2;
    if (channels.has("registry_fact")) score += 4;
    if (channels.has("author_match")) score += 4;
    if (channels.has("title_match")) score += 3;
    if (channels.has("exact_phrase")) score += 2;
    score += requestedFactRelationMatches.length;
    score += (implicitNumericIdentity || factFingerprintMatched) ? numericFactMatches.length * 2 : 0;
    score += sourceYearMatches.length * 6;
    if (boundedEpisodeCoLocated) score += 20;
    const authoredBodyThreshold = Math.min(2, Math.max(1, subjectTerms.length));
    const authoredIdentityMatched = authorMatched && (
      subjectTerms.length === 0 ||
      subjectMatches.length >= 1 ||
      bodySubjectMatches.length >= authoredBodyThreshold
    );
    const anonymousIdentityMatched = (
      canonicalTitleFamilyMatched
    ) || (
      subjectTerms.length >= 2 && subjectMatches.length >= 2
    ) || (
      explicitDocumentAnchorTerms.length >= 2 && documentAnchorMatches.length >= 2
    ) || (
      implicitNumericIdentity && subjectMatches.length >= 1 && numericFactMatches.length >= 2
    ) || (
      factFingerprintMatched
    ) || (
      explicitDocumentAnchorTerms.length === 1 &&
      documentAnchorMatches.length === 1 &&
      titleDocumentAnchorMatches.length === 1
    );
    const identityMatched = sourceCompatible && sourceYearCompatible && (boundedEpisodeIdentity
      ? boundedEpisodeCoLocated && (!requestedAuthors.length || authorMatched)
      : requestedAuthors.length ? authoredIdentityMatched : anonymousIdentityMatched);
    const strongAnchorCandidate = sourceCompatible && sourceYearCompatible && !requestedAuthors.length &&
      subjectMatches.length >= 1 &&
      titleSubjectMatches.length >= 1 &&
      channels.has("title_match") &&
      channels.has("exact_phrase");
    return {
      group,
      documentId: researchGroupDocumentId(group, index),
      score,
      identityMatched,
      exactTitleAnchorMatched,
      canonicalTitleFamilyMatched,
      canonicalTitleFamilyVariant,
      titleAnchorPriority,
      explicitTitleAnchorMatched,
      strongAnchorCandidate,
      authorMatched,
      matchedRequestedAuthors,
      sourceCompatible,
      sourceYearCompatible,
      researchOrJournal,
      subjectMatches,
      metricSubjectAnchorMatches,
      bodySubjectMatches,
      titleSubjectMatches,
      documentAnchorMatches,
      titleDocumentAnchorMatches,
      numericFactMatches,
      requestedFactRelationMatches,
      factFingerprintMatched,
      requestedMetricShape,
      evidencePeriodYearMatches,
      evidenceMetricMatches,
      sourceYearMatches,
      coLocatedBodyIndex: completeEpisodeWindow?.bodyIndex ?? null,
      coLocatedSegmentStart: completeEpisodeWindow?.segmentStart ?? null,
      coLocatedSegmentEnd: completeEpisodeWindow?.segmentEnd ?? null,
      coLocatedEvidenceBody: completeEpisodeWindow?.evidenceBody || null,
      boundedEpisodeCoLocated,
      channels: Array.from(channels)
    };
  }).sort((left, right) =>
    (right.sourceYearCompatible ? right.titleAnchorPriority : 0) -
      (left.sourceYearCompatible ? left.titleAnchorPriority : 0) ||
    Number(right.sourceCompatible) - Number(left.sourceCompatible) ||
    (requestedAuthors.length ? Number(right.authorMatched) - Number(left.authorMatched) : 0) ||
    right.sourceYearMatches.length - left.sourceYearMatches.length ||
    (boundedEpisodeIdentity ? Number(right.boundedEpisodeCoLocated) - Number(left.boundedEpisodeCoLocated) : 0) ||
    (boundedEpisodeIdentity ? right.sourceYearMatches.length - left.sourceYearMatches.length : 0) ||
    (boundedEpisodeIdentity ? right.evidencePeriodYearMatches.length - left.evidencePeriodYearMatches.length : 0) ||
    (boundedEpisodeIdentity ? right.evidenceMetricMatches.length - left.evidenceMetricMatches.length : 0) ||
    right.titleSubjectMatches.length - left.titleSubjectMatches.length ||
    right.subjectMatches.length - left.subjectMatches.length ||
    Number(right.strongAnchorCandidate) - Number(left.strongAnchorCandidate) ||
    right.requestedFactRelationMatches.length - left.requestedFactRelationMatches.length ||
    right.documentAnchorMatches.length - left.documentAnchorMatches.length ||
    right.titleDocumentAnchorMatches.length - left.titleDocumentAnchorMatches.length ||
    ((implicitNumericIdentity || right.factFingerprintMatched || left.factFingerprintMatched)
      ? right.numericFactMatches.length - left.numericFactMatches.length
      : 0) ||
    right.score - left.score
  );
  const trustedDocumentId = String(questionPlan?.trusted_document_id || "").trim();
  const trustedDocumentIdSource = [
    "current_turn_author_confirmation",
    "current_turn_document_identity",
    "previous_source_exact_filter"
  ].includes(questionPlan?.trusted_document_id_source)
    ? questionPlan.trusted_document_id_source
    : "previous_source_exact_filter";
  const trustedIndex = trustedDocumentId
    ? ranked.findIndex(candidate => candidate.documentId === trustedDocumentId)
    : -1;
  const highestCurrentTitlePriority = ranked.reduce(
    (highest, candidate) => Math.max(highest, Number(candidate?.titleAnchorPriority || 0)),
    0
  );
  const trustedCandidateMatchesCurrentTitle = !explicitCurrentTitleHint ||
    (
      ranked[trustedIndex]?.explicitTitleAnchorMatched === true &&
      ranked[trustedIndex]?.titleAnchorPriority === highestCurrentTitlePriority
    );
  if (
    trustedIndex > 0 &&
    trustedCandidateMatchesCurrentTitle &&
    ranked[trustedIndex]?.sourceYearCompatible &&
    (!requestedAuthors.length || ranked[trustedIndex]?.authorMatched) &&
    (!boundedEpisodeIdentity || ranked[trustedIndex]?.boundedEpisodeCoLocated)
  ) {
    const [trustedCandidate] = ranked.splice(trustedIndex, 1);
    ranked.unshift(trustedCandidate);
  }
  const best = ranked[0] || null;
  const trustedDocumentMatch = !!(
    trustedDocumentId &&
    best?.documentId === trustedDocumentId &&
    (!explicitCurrentTitleHint || best.explicitTitleAnchorMatched) &&
    best.sourceCompatible &&
    best.sourceYearCompatible &&
    (!requestedAuthors.length || best.authorMatched) &&
    (!boundedEpisodeIdentity || best.boundedEpisodeCoLocated)
  );
  if (trustedDocumentMatch) best.identityMatched = true;
  const runnerUp = ranked[1] || null;
  const decisiveStrongAnchorLead = !!(
    best?.strongAnchorCandidate &&
    (!runnerUp || best.score >= runnerUp.score + 2)
  );
  const decisiveDocumentAnchorLead = !!(
    best?.sourceCompatible &&
    best.sourceYearCompatible &&
    best.documentAnchorMatches.length >= 1 &&
    best.titleDocumentAnchorMatches.length >= 1 &&
    (!runnerUp || best.documentAnchorMatches.length > runnerUp.documentAnchorMatches.length)
  );
  const decisiveExactTitleLead = !!(
    best?.sourceYearCompatible && best.exactTitleAnchorMatched && !runnerUp?.exactTitleAnchorMatched
  );
  const decisiveCanonicalTitleFamilyLead = !!(
    best?.sourceCompatible &&
    best.sourceYearCompatible &&
    best.canonicalTitleFamilyMatched &&
    best.canonicalTitleFamilyVariant !== "exact" &&
    (!runnerUp || best.titleAnchorPriority > runnerUp.titleAnchorPriority)
  );
  const decisiveRankedTitleLead = !!(
    best?.sourceCompatible &&
    best.sourceYearCompatible &&
    best.researchOrJournal &&
    best.subjectMatches.length >= 1 &&
    best.titleSubjectMatches.length >= 1 &&
    best.channels.includes("title_match") &&
    (!runnerUp || best.score >= runnerUp.score + 3)
  );
  if (
    best &&
    !best.identityMatched &&
    !requestedAuthors.length &&
    !boundedEpisodeIdentity &&
    (
      decisiveExactTitleLead ||
      decisiveCanonicalTitleFamilyLead ||
      decisiveDocumentAnchorLead ||
      decisiveStrongAnchorLead ||
      decisiveRankedTitleLead
    )
  ) {
    best.identityMatched = true;
  }
  const decisiveTitleSubjectLead = !!(
    best?.identityMatched && runnerUp?.identityMatched &&
    best.titleSubjectMatches.length >= 2 &&
    best.titleSubjectMatches.length > runnerUp.titleSubjectMatches.length
  );
  const decisiveNumericFactLead = !!(
    implicitNumericIdentity && best?.identityMatched &&
    best.numericFactMatches.length >= 2 &&
    (!runnerUp || best.numericFactMatches.length > runnerUp.numericFactMatches.length)
  );
  const decisiveFactFingerprintLead = !!(
    best?.identityMatched && best.factFingerprintMatched &&
    (!runnerUp ||
      best.requestedFactRelationMatches.length > runnerUp.requestedFactRelationMatches.length ||
      best.numericFactMatches.length > runnerUp.numericFactMatches.length)
  );
  const decisiveBoundedEpisodeLead = !!(
    boundedEpisodeIdentity && best?.boundedEpisodeCoLocated && !runnerUp?.boundedEpisodeCoLocated
  );
  const competingBoundedEpisodeSources = !!(
    boundedEpisodeIdentity && best?.boundedEpisodeCoLocated && runnerUp?.boundedEpisodeCoLocated
  );
  const competingCanonicalTitleFamilySources = !!(
    explicitCurrentTitleHint &&
    best?.canonicalTitleFamilyMatched &&
    runnerUp?.canonicalTitleFamilyMatched &&
    best.titleAnchorPriority === runnerUp.titleAnchorPriority &&
    best.sourceCompatible &&
    runnerUp.sourceCompatible &&
    best.sourceYearCompatible &&
    runnerUp.sourceYearCompatible &&
    (!requestedAuthors.length || (best.authorMatched && runnerUp.authorMatched)) &&
    best.documentId !== runnerUp.documentId
  );
  const ambiguous = competingCanonicalTitleFamilySources || (!trustedDocumentMatch && !!(
    competingBoundedEpisodeSources || (
      best?.identityMatched && runnerUp?.identityMatched &&
      runnerUp.score >= best.score - 1 &&
      !decisiveExactTitleLead &&
      !decisiveCanonicalTitleFamilyLead &&
      !decisiveDocumentAnchorLead &&
      !decisiveTitleSubjectLead &&
      !decisiveNumericFactLead &&
      !decisiveFactFingerprintLead &&
      !decisiveBoundedEpisodeLead
    )
  ));
  const matched = !!best?.identityMatched && !ambiguous;
  const selectedGroup = matched && best?.coLocatedEvidenceBody
    ? { ...best.group, bodies: [best.coLocatedEvidenceBody] }
    : matched
      ? best.group
      : null;
  return {
    enabled: true,
    required: true,
    matched,
    confidence: matched ? "high" : ambiguous ? "ambiguous" : "low",
    requestedAuthor: requestedAuthor || null,
    requestedAuthors,
    subjectTerms,
    selectedDocumentId: matched ? best.documentId : null,
    selectedTitle: matched ? String(best.group?.title || "").trim() || null : null,
    reasons: best ? [
      ...(best.authorMatched ? best.matchedRequestedAuthors.map(author => `author_match:${author}`) : []),
      ...(best.exactTitleAnchorMatched ? ["exact_title_anchor"] : []),
      ...(best.canonicalTitleFamilyVariant === "summary"
        ? ["canonical_title_family_anchor:summary"]
        : best.canonicalTitleFamilyVariant === "short_summary"
          ? ["canonical_title_family_anchor:short_summary"]
          : []),
      ...(best.researchOrJournal ? ["source:research_or_journal"] : []),
      ...(!best.sourceCompatible ? ["source:legal_excluded"] : []),
      ...best.subjectMatches.map(term => `subject:${term}`),
      ...best.metricSubjectAnchorMatches.map(term => `metric_subject_anchor:${term}`),
      ...best.bodySubjectMatches.map(term => `body_subject:${term}`),
      ...best.documentAnchorMatches.map(term => `document_anchor:${term}`),
      ...best.channels.map(channel => `channel:${channel}`),
      ...(trustedDocumentMatch ? [trustedDocumentIdSource] : []),
      ...(decisiveExactTitleLead ? ["decisive_exact_title_anchor"] : []),
      ...(decisiveCanonicalTitleFamilyLead ? ["decisive_canonical_title_family_anchor"] : []),
      ...(decisiveDocumentAnchorLead ? ["decisive_document_anchor_lead"] : []),
      ...(decisiveStrongAnchorLead ? ["decisive_strong_anchor_lead"] : []),
      ...(decisiveRankedTitleLead ? ["decisive_ranked_title_lead"] : []),
      ...(decisiveNumericFactLead ? ["decisive_numeric_fact_lead"] : []),
      ...(decisiveFactFingerprintLead ? ["decisive_fact_fingerprint_lead"] : []),
      ...(best.requestedMetricShape.complete ? ["requested_metric_shape_observed"] : []),
      ...(best.boundedEpisodeCoLocated ? ["bounded_episode_evidence_colocated"] : []),
      ...(requestedEpisodePhaseOrdinal ? [`episode_phase:${requestedEpisodePhaseOrdinal}`] : []),
      ...best.sourceYearMatches.map(year => `source_year:${year}`),
      ...best.evidencePeriodYearMatches.map(year => `evidence_period:${year}`),
      ...best.evidenceMetricMatches.map(term => `evidence_metric:${term}`),
      ...(Number.isInteger(best.coLocatedBodyIndex) ? [`evidence_body:${best.coLocatedBodyIndex}`] : []),
      ...(Number.isInteger(best.coLocatedSegmentStart) && Number.isInteger(best.coLocatedSegmentEnd)
        ? [`evidence_segments:${best.coLocatedSegmentStart}-${best.coLocatedSegmentEnd}`]
        : []),
      ...(decisiveBoundedEpisodeLead ? ["decisive_bounded_episode_lead"] : []),
      ...(ambiguous ? ["ambiguous_identity"] : [])
    ] : ["no_identity_candidate"],
    candidates: ranked.slice(0, 5).map((item, index) => ({
      selectionRank: index + 1,
      documentId: item.documentId,
      title: String(item.group?.title || "").trim() || null,
      score: item.score,
      identityMatched: item.identityMatched,
      exactTitleAnchorMatched: item.exactTitleAnchorMatched,
      canonicalTitleFamilyMatched: item.canonicalTitleFamilyMatched,
      canonicalTitleFamilyVariant: item.canonicalTitleFamilyVariant,
      titleAnchorPriority: item.titleAnchorPriority,
      authorMatched: item.authorMatched,
      sourceCompatible: item.sourceCompatible,
      sourceYearCompatible: item.sourceYearCompatible,
      researchOrJournal: item.researchOrJournal,
      subjectMatches: item.subjectMatches,
      metricSubjectAnchorMatches: item.metricSubjectAnchorMatches,
      bodySubjectMatches: item.bodySubjectMatches,
      titleSubjectMatches: item.titleSubjectMatches,
      documentAnchorMatches: item.documentAnchorMatches,
      titleDocumentAnchorMatches: item.titleDocumentAnchorMatches,
      numericFactMatches: item.numericFactMatches,
      requestedFactRelationMatches: item.requestedFactRelationMatches,
      factFingerprintMatched: item.factFingerprintMatched,
      requestedMetricShape: item.requestedMetricShape,
      evidencePeriodYearMatches: item.evidencePeriodYearMatches,
      evidenceMetricMatches: item.evidenceMetricMatches,
      sourceYearMatches: item.sourceYearMatches,
      coLocatedBodyIndex: item.coLocatedBodyIndex,
      coLocatedSegmentStart: item.coLocatedSegmentStart,
      coLocatedSegmentEnd: item.coLocatedSegmentEnd,
      boundedEpisodeCoLocated: item.boundedEpisodeCoLocated
    })),
    groups: selectedGroup ? [selectedGroup] : []
  };
}

export function selectGroupsWithPreferredSourceYear(
  groups = [],
  preferredYears = [],
  k = CONTEXT_GROUPS_MAX,
  lambda = DIVERSIFY_LAMBDA
) {
  const candidates = Array.isArray(groups) ? groups : [];
  const limit = Math.max(0, Math.min(Math.trunc(Number(k) || 0), candidates.length));
  const years = Array.from(new Set((Array.isArray(preferredYears) ? preferredYears : [])
    .map(year => Number(year))
    .filter(year => Number.isInteger(year) && year >= 1900 && year <= 2100)));
  if (!limit) return [];
  if (years.length !== 1) return diversifyGroupsMMR(candidates, limit, lambda);

  const preferredYear = years[0];
  const preferredGroups = candidates.filter(group => extractMatchGroupYear(group) === preferredYear);
  if (!preferredGroups.length) return diversifyGroupsMMR(candidates, limit, lambda);

  const fallbackGroups = candidates.filter(group => extractMatchGroupYear(group) !== preferredYear);
  const preferredChosen = diversifyGroupsMMR(
    preferredGroups,
    Math.min(limit, preferredGroups.length),
    lambda
  );
  return [
    ...preferredChosen,
    ...diversifyGroupsMMR(fallbackGroups, Math.max(0, limit - preferredChosen.length), lambda)
  ].slice(0, limit);
}

const NUMERIC_FACT_COUNT_WORDS = new Map([
  ["uks", 1], ["uhe", 1], ["one", 1], ["kaks", 2], ["two", 2],
  ["kolm", 3], ["three", 3], ["neli", 4], ["four", 4],
  ["viis", 5], ["five", 5], ["kuus", 6], ["six", 6]
]);

function requestedProportionCount(message = "") {
  const normalized = normalizeIntentText(message);
  if (!/(?:\bosakaal\w*\b|\bprotsent\w*\b|%|\bkui\s+suur\s+osa\b)/u.test(normalized)) return 0;
  const explicitPercentages = new Set(
    Array.from(normalized.matchAll(/\b\d{1,3}(?:[.,]\d+)?\s*%/gu))
      .map(match => String(match[0] || "").replace(/\s+/gu, "").replace(",", "."))
  );
  if (explicitPercentages.size > 1) return explicitPercentages.size;
  const countMatch = normalized.match(
    /\b(\d{1,2}|uks|uhe|one|kaks|two|kolm|three|neli|four|viis|five|kuus|six)\s+(?:\S+\s+){0,2}?(?:osakaal\w*|protsent\w*|naitaja\w*)\b/u
  );
  if (!countMatch) return 1;
  const numeric = Number(countMatch[1]);
  if (Number.isInteger(numeric) && numeric > 0) return numeric;
  return NUMERIC_FACT_COUNT_WORDS.get(countMatch[1]) || 1;
}

function countUniquePercentageEvidence(group = {}) {
  const text = (Array.isArray(group?.bodies) ? group.bodies : [])
    .map(value => String(value || ""))
    .join("\n");
  const values = new Set();
  for (const match of text.matchAll(/\b(\d{1,3}(?:[.,]\d+)?)\s*(?:%|protsent\w*)/giu)) {
    values.add(String(match[1]).replace(",", "."));
  }
  return values.size;
}

function requestedPercentageEvidenceCount(message = "", group = {}) {
  const requested = Array.from(new Set(
    Array.from(String(message || "").matchAll(/(?<!\d)\d{1,3}(?:[.,]\d+)?\s*%/gu))
      .map(match => String(match[0] || "").replace(/\s+/gu, "").replace(",", "."))
  ));
  if (!requested.length) return null;
  const evidence = (Array.isArray(group?.bodies) ? group.bodies : [])
    .map(value => String(value || ""))
    .join("\n")
    .replace(/,/gu, ".");
  return requested.filter(term => {
    const number = term.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<!\\d)${number}\\s*%(?!\\d)`, "u").test(evidence);
  }).length;
}

const CONTACT_CHANNEL_CUE_PATTERN = /(?:^|[^\p{L}\p{N}])(?:helista\p{L}*|telefoninumb\p{L}*|nouandeliin\p{L}*|kriisiliin\p{L}*|abinumbr\p{L}*|hadaabinumbr\p{L}*|call\p{L}*|phone\p{L}*|hotline\p{L}*|helpline\p{L}*|dial\p{L}*|звон\p{L}*|позвон\p{L}*|телефон\p{L}*|лини\p{L}*)(?=$|[^\p{L}\p{N}])/u;

function requestedContactChannelCodes(message = "") {
  const text = String(message || "");
  if (!CONTACT_CHANNEL_CUE_PATTERN.test(normalizeIntentText(text))) return [];
  const codes = [];
  for (const match of text.matchAll(/(?<!\d)\+?\d(?:[\s-]*\d){2,7}(?!\d)/gu)) {
    const digits = String(match[0] || "").replace(/\D/gu, "");
    if (digits.length < 3 || digits.length > 8) continue;
    const numeric = Number(digits);
    const index = match.index || 0;
    const local = normalizeIntentText(text.slice(Math.max(0, index - 24), index + match[0].length + 24));
    if (
      numeric >= 1900 &&
      numeric <= 2100 &&
      /(?:^|[^\p{L}\p{N}])(?:aasta\p{L}*|year\p{L}*|год\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(local)
    ) continue;
    if (!codes.includes(digits)) codes.push(digits);
  }
  return codes;
}

function contactChannelCodeCoverage(value = "", codes = []) {
  const text = String(value || "");
  return codes.filter(code => new RegExp(
    `(?<!\\d)${code.split("").join("[\\s-]*")}(?!\\d)`,
    "u"
  ).test(text)).length;
}

export function buildPercentCountSemanticsInstruction(groups = []) {
  const relations = new Map();
  for (const group of Array.isArray(groups) ? groups : []) {
    for (const body of Array.isArray(group?.bodies) ? group.bodies : []) {
      for (const match of String(body || "").matchAll(
        /(?<![\p{L}\d])(\d+(?:[.,]\d+)?)\s*%\s*(?:\(|\[)?\s*n\s*[:=]\s*(\d+(?:[ .]\d{3})*|\d+)(?:\)|\])?/giu
      )) {
        const percent = String(match[1] || "").replace(",", ".");
        const count = String(match[2] || "").replace(/[ .]/gu, "");
        if (percent && count) relations.set(`${percent}%`, count);
      }
    }
  }
  if (!relations.size) return null;
  const pairs = Array.from(relations, ([percent, count]) => `${percent} = n ${count}`).join("; ");
  return `PERCENT_COUNT_SEMANTICS: tõendis olevad protsendi ja loenduse paarid on ${pairs}. Kuju X% (n=Y) tähendab, et allikas esitab selle näitaja juures loenduse Y. Ära nimeta Y-d valimi suuruseks, ära arvuta X% × Y põhjal uut inimeste arvu ja vasta paariga X% ehk Y inimest. Säilita iga näitaja juures tõendis nimetatud andmeaasta või uuringuaasta; kui näitajad pärinevad eri aastatest või allikatest, nimeta need eraldi ja ära pane kõiki ühe ühise aastapealkirja alla.`;
}

export function selectSingleSourceNumericFactGroups(message = "", groups = []) {
  const candidates = Array.isArray(groups) ? groups.filter(Boolean) : [];
  const expectedCount = requestedProportionCount(message);
  const requestedContactCodes = requestedContactChannelCodes(message);
  if ((!expectedCount && requestedContactCodes.length < 2) || !candidates.length) {
    return {
      enabled: false,
      sufficient: false,
      expectedCount: 0,
      evidenceCount: 0,
      groups: candidates
    };
  }
  if (!expectedCount) {
    const rankedCandidates = sortByGroupRank(candidates);
    const rankedEvidence = rankedCandidates.map((group, index) => {
      const bodies = Array.isArray(group?.bodies) ? group.bodies : [];
      const bodyCoverage = bodies.map(body => contactChannelCodeCoverage(body, requestedContactCodes));
      return {
        group,
        index,
        bodyCoverage,
        evidenceCount: bodyCoverage.length ? Math.max(...bodyCoverage) : 0
      };
    }).sort((left, right) => right.evidenceCount - left.evidenceCount || left.index - right.index);
    const primaryEvidence = rankedEvidence[0];
    const supportingBodies = (Array.isArray(primaryEvidence.group?.bodies) ? primaryEvidence.group.bodies : [])
      .filter((body, index) => primaryEvidence.bodyCoverage[index] === requestedContactCodes.length);
    return {
      enabled: true,
      sufficient: supportingBodies.length > 0,
      expectedCount: requestedContactCodes.length,
      evidenceCount: primaryEvidence.evidenceCount,
      groups: [{
        ...primaryEvidence.group,
        ...(supportingBodies.length ? { bodies: supportingBodies } : {})
      }]
    };
  }
  const primary = candidates[0];
  const requestedEvidenceCount = requestedPercentageEvidenceCount(message, primary);
  const evidenceCount = requestedEvidenceCount === null
    ? countUniquePercentageEvidence(primary)
    : requestedEvidenceCount;
  return {
    enabled: true,
    sufficient: evidenceCount >= expectedCount,
    expectedCount,
    evidenceCount,
    // A focused numerical answer may not borrow convenient numbers from a
    // second article merely because the primary article's exact chunk is absent.
    groups: [primary]
  };
}

function numericScopeBodyScore(message = "", body = "") {
  const normalizedMessage = normalizeIntentText(message);
  const normalizedBody = normalizeIntentText(body);
  if (!normalizedBody) return 0;
  const asksForYear = /\b(?:aasta\w*|millal|mis\s+ajast)\b/.test(normalizedMessage);
  const hasNumber = /\b\d+(?:[.,]\d+)?\b|%/.test(normalizedBody);
  const hasYear = /\b(?:19|20)\d{2}\b/.test(normalizedBody);
  const hasWholeScope = /\b(?:kogu\s+valim\w*|koguvalim\w*|koguarv\w*|uldarv\w*|kokku|valim\w*\s+(?:moodustas|koosnes))\b/.test(normalizedBody);
  let score = 0;
  if (hasWholeScope) score += 8;
  if (hasNumber) score += 2;
  if (asksForYear && hasYear) score += 3;
  return score;
}

export function prioritizeNumericScopeEvidence(message = "", groups = []) {
  const candidates = Array.isArray(groups) ? groups : [];
  if (!shouldUseNumericScopeInstruction(message)) return candidates;
  return candidates.map(group => {
    if (!Array.isArray(group?.bodies) || group.bodies.length < 2) return group;
    const bodies = group.bodies
      .map((body, index) => ({ body, index, score: numericScopeBodyScore(message, body) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(item => item.body);
    return { ...group, bodies };
  });
}

export function prioritizeRequestedNumericEvidence(message = "", groups = []) {
  const requestedPercentages = Array.from(new Set(
    Array.from(String(message || "").matchAll(/\b\d{1,3}(?:[.,]\d+)?\s*%/gu))
      .map(match => String(match[0] || "").replace(/\s+/gu, "").replace(",", "."))
  ));
  if (!requestedPercentages.length) return Array.isArray(groups) ? groups : [];
  return (Array.isArray(groups) ? groups : []).map(group => {
    if (!Array.isArray(group?.bodies) || group.bodies.length < 2) return group;
    const bodies = group.bodies
      .map((body, index) => {
        const normalized = String(body || "").replace(/\s+/gu, "").replace(/,/gu, ".");
        const coverage = requestedPercentages.filter(term => normalized.includes(term)).length;
        return { body, index, coverage };
      })
      .sort((left, right) => right.coverage - left.coverage || left.index - right.index)
      .map(item => item.body);
    return { ...group, bodies };
  });
}

function requestedFactSlotsFromQuestionPlan(questionPlan = {}) {
  const episodeSlots = (Array.isArray(questionPlan?.evidence_metric_slots)
    ? questionPlan.evidence_metric_slots
    : [])
    .map((slot, index) => ({
      index: index + 1,
      value_type: "count",
      input_form: "original",
      category: String(slot?.category || "").trim(),
      relation_terms: Array.from(new Set(
        (Array.isArray(slot?.terms) ? slot.terms : [])
          .map(value => String(value || "").trim())
          .filter(Boolean)
      )),
      slot_source: "evidence_metric_slots"
    }))
    .filter(slot => slot.category && slot.relation_terms.length);
  if (questionPlan?.bounded_episode_metric_fact === true && episodeSlots.length) {
    return {
      complete: true,
      truncated: false,
      unresolvedClauseCount: 0,
      emittedSlotCount: episodeSlots.length,
      slotSource: "evidence_metric_slots",
      slots: episodeSlots
    };
  }

  const requested = questionPlan?.semantic_candidates?.requested_fact_slots;
  const allSlots = Array.isArray(requested?.slots) ? requested.slots : [];
  const slots = allSlots
    .filter(slot => REQUESTED_METRIC_SUPPORTED_VALUE_TYPES.has(String(slot?.value_type || "")))
    .map(slot => ({ ...slot, slot_source: "requested_fact_slots" }));
  const unresolvedClauseCount = requested?.complete === true ? 0 : 1;
  const truncated = allSlots.length > 12;
  return {
    complete: requested?.complete === true,
    truncated,
    unresolvedClauseCount,
    emittedSlotCount: slots.length,
    slotSource: "requested_fact_slots",
    slots
  };
}

function requestedFactRelationAlternatives(slot = {}, relationTerm = "") {
  const normalizedTerm = normalizeIntentText(relationTerm);
  const variantEntry = (Array.isArray(slot?.relation_term_variants) ? slot.relation_term_variants : [])
    .find(item => normalizeIntentText(item?.term || "") === normalizedTerm);
  return Array.from(new Set([
    relationTerm,
    ...(Array.isArray(variantEntry?.variants) ? variantEntry.variants : [])
  ].map(value => String(value || "").trim()).filter(Boolean))).slice(0, 8);
}

const REQUESTED_QUALITATIVE_SLOT_VALUE_TYPES = new Set([
  "category",
  "date",
  "entity_list",
  "location",
  "method",
  "month",
  "organization",
  "person_role",
  "recommendation",
  "season",
  "text_relation",
  "timepoint"
]);

const REQUESTED_FACT_ANSWER_ANCHOR_STOPWORDS = new Set([
  "aasta", "aastal", "aastast", "aastane", "artikkel", "artiklis", "aruandes", "uuring", "uuringus",
  "allikas", "allika", "jargi", "kohta", "korral", "ning", "nende", "selle", "need", "mida", "mille",
  "milline", "millised", "kuidas", "kelle", "kus", "tehti", "kasutati", "oeldi", "anti", "tuleb",
  "oli", "olid", "olla", "olema", "saab", "voib", "pidi", "ja", "voi", "kui", "ka", "tema", "oma",
  "alla", "ule", "ligi", "umbes", "ligikaudu", "vahemalt", "enam", "rohkem", "kokku",
  "arv", "arvud", "arvuga", "arvudega", "naitaja", "naitajad", "naitajaid",
  "uks", "uht", "uhe", "kaks", "kaht", "kahe", "kolm", "kolme", "neli", "nelja", "viis", "viie",
  "the", "and", "or", "was", "were", "from", "with", "about", "according", "article", "report", "study",
  "и", "или", "был", "были", "это", "этот", "статья", "отчет", "исследование"
]);

function requestedFactRelationMatchDetails(slot = {}, value = "") {
  const evidenceTokens = requestedMetricEvidenceTokens(value);
  const relationTerms = Array.isArray(slot?.relation_terms)
    ? slot.relation_terms.map(term => String(term || "").trim()).filter(Boolean).slice(0, 8)
    : [];
  const matchedTerms = relationTerms.filter(term =>
    requestedFactRelationAlternatives(slot, term).some(variant =>
      evidenceTokens.some(token => requestedMetricTermMatchQuality(variant, token.value) >= 0.72)
    )
  );
  const minimumMatches = relationTerms.length <= 2
    ? 1
    : Math.min(2, Math.ceil(relationTerms.length * 0.35));
  return { relationTerms, matchedTerms, minimumMatches };
}

function requestedFactDistinctNumericValues(value = "") {
  return Array.from(new Set(
    Array.from(String(value || "").matchAll(/(?<![\p{L}\d])\d+(?:[.,]\d+)?(?![\p{L}\d])/gu))
      .map(match => String(match[0] || "").replace(",", "."))
      .filter(Boolean)
  ));
}

function requestedFactPhoneValues(value = "") {
  return requestedFactDistinctNumericValues(value).filter(item => {
    const digits = item.replace(/\D/gu, "");
    if (digits.length < 3 || digits.length > 12) return false;
    const numeric = Number(digits);
    return !(Number.isInteger(numeric) && numeric >= 1900 && numeric <= 2100);
  });
}

function requestedFactAgeValues(value = "") {
  const text = normalizeIntentText(value);
  const values = new Set();
  for (const match of text.matchAll(
    /\b(\d{1,3})\s*[-–—]\s*(\d{1,3})(?:\s*[-–—]\s*|\s+)?(?:aasta\p{L}*|year\p{L}*|лет\p{L}*)/gu
  )) {
    values.add(match[1]);
    values.add(match[2]);
  }
  for (const match of text.matchAll(
    /\b(?:alla|ule|kuni|vahemalt|vanuses|over|under|aged|age|старше|младше|возраст\p{L}*)\s+(\d{1,3})(?:\s*[-–—]\s*|\s+)?(?:aasta\p{L}*|year\p{L}*|лет\p{L}*)/gu
  )) values.add(match[1]);
  for (const match of text.matchAll(
    /(?<![\p{L}\d])([\p{L}]+)\s*[-–—]?\s*kuni\s+([\p{L}]+?)(?:aasta\p{L}*)(?![\p{L}\d])/gu
  )) {
    const lower = smallCardinalNumberValue(match[1], text.slice(Number(match.index) + match[1].length));
    const upper = smallCardinalNumberValue(match[2]);
    if (lower !== null) values.add(String(lower));
    if (upper !== null) values.add(String(upper));
  }
  return [...values];
}

function requestedFactContentAnchorTerms(slot = {}, value = "") {
  const relationTerms = Array.isArray(slot?.relation_terms) ? slot.relation_terms : [];
  const tokens = requestedMetricEvidenceTokens(value)
    .map(token => token.value)
    .filter(token => token && !/^\d+(?:[.,]\d+)?$/u.test(token))
    .filter(token => smallCardinalNumberValue(token) === null)
    .filter(token => token.length >= 3 && !REQUESTED_FACT_ANSWER_ANCHOR_STOPWORDS.has(token))
    .filter(token => !relationTerms.some(term =>
      requestedFactRelationAlternatives(slot, term).some(variant =>
        requestedMetricTermMatchQuality(variant, token) >= 0.72
      )
    ));
  return Array.from(new Set(tokens)).slice(0, 12);
}

function requestedExplicitValueEvidenceAnchors(slot = {}, option = null, assignment = []) {
  const candidate = option?.candidate;
  if (!candidate || slot?.value_type !== "explicit_value_relation") return [];
  const peers = (Array.isArray(assignment) ? assignment : [])
    .map(item => item?.candidate)
    .filter(Boolean);
  const sameFragmentPeers = peers
    .filter(peer => peer.fragmentIndex === candidate.fragmentIndex)
    .sort((left, right) => left.start - right.start);
  const peerPosition = sameFragmentPeers.findIndex(peer => peer.key === candidate.key);
  if (peerPosition < 0) return [];
  const localAnchors = sameFragmentPeers.map((peer, index) => {
    const previousEnd = index > 0 ? sameFragmentPeers[index - 1].end : 0;
    const nextStart = index < sameFragmentPeers.length - 1
      ? sameFragmentPeers[index + 1].start
      : String(peer.fragment || "").length;
    const afterAnchors = requestedFactContentAnchorTerms(
      slot,
      String(peer.fragment || "").slice(peer.end, nextStart)
    );
    const beforeAnchors = requestedFactContentAnchorTerms(
      slot,
      String(peer.fragment || "").slice(previousEnd, peer.start)
    );
    return afterAnchors[0] || beforeAnchors.at(-1) || "";
  });
  const localAnchor = localAnchors[peerPosition] || "";
  if (!localAnchor) return [];

  const distinctFragmentIndexes = new Set(peers.map(peer => peer.fragmentIndex));
  if (distinctFragmentIndexes.size <= 1) {
    if (peers.length === 1) return [localAnchor];
    const localAnchorCount = localAnchors.filter(anchor => anchor === localAnchor).length;
    if (localAnchorCount === 1) return [localAnchor];
    const adjacentIndexes = [peerPosition - 1, peerPosition + 1]
      .filter(index => index >= 0 && index < localAnchors.length);
    const groupAnchor = adjacentIndexes
      .map(index => localAnchors[index])
      .find(anchor =>
        anchor &&
        anchor !== localAnchor &&
        localAnchors.filter(item => item === anchor).length === 1
      ) || "";
    return groupAnchor ? [localAnchor, groupAnchor] : [];
  }
  const otherFragmentAnchorSets = peers
    .filter(peer => peer.fragmentIndex !== candidate.fragmentIndex)
    .map(peer => new Set(requestedFactContentAnchorTerms(slot, peer.fragment || "")));
  const contextAnchor = requestedFactContentAnchorTerms(slot, candidate.fragment || "")
    .find(anchor =>
      anchor !== localAnchor &&
      !otherFragmentAnchorSets.some(anchorSet => anchorSet.has(anchor))
    ) || "";
  return contextAnchor ? [localAnchor, contextAnchor] : [];
}

function requestedFactCoordinatedRoleAnchors(slot = {}, value = "") {
  const normalized = normalizeIntentText(value);
  // Coordinated course topics are not people. Bind a role pair only in an
  // actor/assessment clause, and require actor nouns on both sides.
  if (!/\b(?:kaasat\p{L}*|osale\p{L}*|hinnang\p{L}*|vaatest|arvam\p{L}*|respond\p{L}*|particip\p{L}*)\b/u.test(normalized)) return [];
  const actorWord = /(?:ja(?:d|de|te|lt|le|ga|ks|st|id)?$|^(?:spetsialist|ekspert|arst|juht|klient|patsient|lapse|laste|vanem|pere|partner|participant|respondent|employer|employee|parent)\p{L}*$)/u;
  const anchors = [];
  const pattern = /(?:\bnii\s+)?([\p{L}-]{3,})\s+(?:ning\s+ka|kui\s+ka|ja|ning|and|и)\s+(?:ka\s+|tema\s+|their\s+|его\s+|ее\s+)?([\p{L}-]{3,})/gu;
  for (const match of normalized.matchAll(pattern)) {
    if (![match[1], match[2]].every(candidate => actorWord.test(candidate))) continue;
    for (const candidate of [match[1], match[2]]) {
      const token = requestedMetricToken(candidate);
      if (!token || REQUESTED_FACT_ANSWER_ANCHOR_STOPWORDS.has(token)) continue;
      if (requestedFactContentAnchorTerms(slot, token).length && !anchors.includes(token)) anchors.push(token);
    }
  }
  return anchors.slice(0, 4);
}

function requestedFactActionObjectBindings(slot = {}, value = "") {
  const bindings = [];
  for (const clause of qualitativeActionClauses(value)) {
    const signature = qualitativeActionSignature(clause);
    if (!signature.entries.length) continue;
    const relation = requestedFactRelationMatchDetails(slot, clause);
    const contentAnchors = requestedFactContentAnchorTerms(slot, clause).filter(anchor =>
      !signature.terms.some(term => requestedMetricTermMatchQuality(term, anchor) >= 0.72)
    );
    const objectAnchors = Array.from(new Set([
      ...relation.matchedTerms,
      ...contentAnchors
    ])).slice(0, 8);
    if (!objectAnchors.length) continue;
    for (const entry of signature.entries) {
      if (bindings.some(binding =>
        binding.action_family === entry.family &&
        binding.object_anchor_terms.join("\u0000") === objectAnchors.join("\u0000")
      )) continue;
      bindings.push({
        action_family: entry.family,
        action_category: entry.category,
        evidence_action_terms: signature.entries
          .filter(item => item.family === entry.family)
          .map(item => item.term)
          .slice(0, 4),
        object_anchor_terms: objectAnchors,
        minimum_object_matches: 1,
        evidence_negated: signature.negated
      });
    }
  }
  return bindings.slice(0, 8);
}

function requestedFactMethodAnchors(slot = {}, value = "") {
  const tokens = requestedMetricEvidenceTokens(value);
  const anchors = [];
  tokens.forEach((token, index) => {
    if (!/^(?:analuus|meetod|metoodika)\p{L}*$/u.test(token.value)) return;
    const preceding = tokens[index - 1];
    if (!preceding || !requestedFactContentAnchorTerms(slot, preceding.value).length) return;
    if (/^(?:kasuta|teh|tege|labi|intervju|andme)/u.test(preceding.value)) return;
    anchors.push(preceding.value);
  });
  // A method can also be named as the predicate/object, without an adjective
  // before "analysis": e.g. "uurimismeetodiks oli vaatlus".
  const namedMethod = /\b(?:uurimismeetod\p{L}*|meetod\p{L}*|andmekogumi\p{L}*)\s+(?:oli|on|kasutati|kasutatakse|rakendati)\s+([\p{L}-]+)/gu;
  for (const match of normalizeIntentText(value).matchAll(namedMethod)) {
    const anchor = match[1];
    if (/^(?:meetod|analuus|metoodika|sobiv|erinev|mitu|mingi|teatav|sellin|sellis)/u.test(anchor)) continue;
    if (requestedFactContentAnchorTerms(slot, anchor).length) anchors.push(anchor);
  }
  return Array.from(new Set(anchors));
}

function requestedFactQualitativeEvidenceBinding(slot = {}, body = "") {
  const valueType = String(slot?.value_type || "");
  if (!REQUESTED_QUALITATIVE_SLOT_VALUE_TYPES.has(valueType)) return null;
  const minimumAnswerItems = Math.max(1, Number(slot?.minimum_answer_items || 1));
  const relationText = normalizeIntentText((Array.isArray(slot?.relation_terms) ? slot.relation_terms : []).join(" "));
  const phoneMode = /\b(?:telefoninumb\p{L}*|helista\p{L}*|phone\p{L}*|номер\p{L}*|позвон\p{L}*)\b/u.test(relationText);
  const ageMode = /\b(?:vanuseruh\p{L}*|varase\p{L}*|avaldum\p{L}*|age\p{L}*|onset\p{L}*|возраст\p{L}*)\b/u.test(relationText);
  const roleComparisonMode = valueType === "person_role" &&
    /\b(?:vorr\p{L}*|compar\p{L}*|сравн\p{L}*)\b/u.test(relationText);
  const fragments = requestedMetricEvidenceFragments(body);
  const candidates = [...fragments];
  const adjacentFallbackEnabled = phoneMode ||
    ageMode ||
    ["entity_list", "method", "person_role", "text_relation"].includes(valueType);
  for (let index = 0; adjacentFallbackEnabled && index < fragments.length - 1; index += 1) {
    const left = fragments[index];
    const right = fragments[index + 1];
    if (left.bodyIndex !== right.bodyIndex || right.relationScopeIndex - left.relationScopeIndex > 1) continue;
    candidates.push({
      text: `${left.text} ${right.text}`,
      startOffset: left.startOffset,
      bodyIndex: left.bodyIndex,
      relationScopeIndex: left.relationScopeIndex,
      adjacentFallback: true
    });
  }
  let best = null;
  let standaloneBindingFound = false;
  for (const candidate of candidates) {
    if (candidate.adjacentFallback && standaloneBindingFound) continue;
    const relation = requestedFactRelationMatchDetails(slot, candidate.text);
    const minimumRelationMatches = phoneMode || ageMode ? 1 : relation.minimumMatches;
    if (!relation.relationTerms.length || relation.matchedTerms.length < minimumRelationMatches) continue;
    const phoneValues = phoneMode ? requestedFactPhoneValues(candidate.text) : [];
    const ageValues = ageMode ? requestedFactAgeValues(candidate.text) : [];
    const roleAnchors = roleComparisonMode ? requestedFactCoordinatedRoleAnchors(slot, candidate.text) : [];
    const contentAnchors = requestedFactContentAnchorTerms(slot, candidate.text);
    const methodAnchors = valueType === "method" ? requestedFactMethodAnchors(slot, candidate.text) : [];
    const actionSignature = valueType === "recommendation"
      ? qualitativeActionSignature(candidate.text)
      : { terms: [], categories: [], negated: false };
    const actionObjectBindings = valueType === "recommendation"
      ? requestedFactActionObjectBindings(slot, candidate.text)
      : [];
    if (valueType === "recommendation" && !actionObjectBindings.length) continue;
    if (phoneMode && phoneValues.length < minimumAnswerItems) continue;
    if (ageMode && ageValues.length < 1) continue;
    if (roleComparisonMode && roleAnchors.length < minimumAnswerItems) continue;
    const evidenceAnchors = roleComparisonMode
      ? roleAnchors
      : valueType === "method" ? methodAnchors
      : valueType === "recommendation"
        ? []
        : contentAnchors;
    const minimumEvidenceAnchorCount = phoneMode || ageMode
      ? 0
      : roleComparisonMode
        ? minimumAnswerItems
        : valueType === "recommendation"
          ? 0
          : valueType === "text_relation"
            ? 1
          : Math.min(minimumAnswerItems, 2);
    const minimumAnchorMatches = phoneMode || ageMode
      ? 0
      : valueType === "recommendation"
        ? 0
        : valueType === "text_relation"
          ? 1
        : Math.min(minimumAnswerItems, 2);
    if (evidenceAnchors.length < minimumEvidenceAnchorCount) continue;
    const requiredNumericValues = phoneMode ? phoneValues : ageMode ? ageValues : [];
    const minimumActionMatches = valueType === "recommendation" && actionSignature.terms.length ? 1 : 0;
    const score = relation.matchedTerms.length * 5 + evidenceAnchors.length +
      requiredNumericValues.length * 3 + actionSignature.terms.length * 2;
    if (!candidate.adjacentFallback) standaloneBindingFound = true;
    if (!best || score > best.score) {
      best = {
        score,
        matched_relation_terms: relation.matchedTerms,
        minimum_relation_matches: minimumRelationMatches,
        minimum_answer_items: minimumAnswerItems,
        minimum_evidence_anchor_count: minimumEvidenceAnchorCount,
        minimum_anchor_matches: minimumAnchorMatches,
        evidence_anchor_terms: evidenceAnchors.slice(0, 8),
        required_numeric_values: requiredNumericValues.slice(0, 8),
        evidence_action_terms: actionSignature.terms,
        evidence_action_categories: actionSignature.categories,
        evidence_negated: actionSignature.negated,
        minimum_action_matches: minimumActionMatches,
        action_object_bindings: actionObjectBindings,
        evidence_fragment_hash: hashRenderedText(candidate.text),
        evidence_fragment_index: candidate.relationScopeIndex
      };
    }
  }
  return best;
}

function requestedFactEvidenceSlotPlan(questionPlan = {}, {
  specificResearchFactQuestion = false,
  documentIdentityEvidence = null
} = {}) {
  const requested = questionPlan?.semantic_candidates?.requested_fact_slots;
  const slots = Array.isArray(requested?.slots) ? requested.slots.slice(0, 12) : [];
  if (
    !specificResearchFactQuestion ||
    documentIdentityEvidence?.matched !== true ||
    documentIdentityEvidence?.confidence !== "high" ||
    requested?.complete !== true ||
    !slots.length
  ) return [];
  return slots;
}

function requestedFactScopeValueCovered(body = "", value = "") {
  const normalizedValue = String(value || "").trim();
  if (!/^\d{1,3}(?:[.,]\d+)?$/u.test(normalizedValue)) return false;
  const escapedValue = normalizedValue.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const normalizedBody = normalizeIntentText(body);
  return new RegExp(
    `(?:` +
      `(?:alla|ule|kuni|vahemalt|enam\\s+kui|rohkem\\s+kui|vahem\\s+kui|vanuses)\\s+${escapedValue}` +
      `(?:\\s*[-–—]\\s*|\\s+)?aasta\\p{L}*` +
      `|${escapedValue}\\s*[-–—]\\s*(?:aastan\\p{L}*|aastas\\p{L}*)` +
    `)`,
    "u"
  ).test(normalizedBody);
}

function requestedFactBodyAlignment(slots = [], body = "") {
  const candidateTokens = requestedMetricEvidenceTokens(body);
  const coveredSlotIndexes = [];
  let alignmentScore = 0;
  slots.forEach((slot, slotIndex) => {
    const slotValueType = String(slot?.value_type || "");
    const relationTerms = Array.isArray(slot?.relation_terms)
      ? slot.relation_terms.map(value => String(value || "").trim()).filter(Boolean).slice(0, 8)
      : [];
    if (slotValueType === "explicit_value_relation") {
      const evidence = requestedMetricEvidenceCandidates(body, [slotValueType]);
      const provisionalOptions = evidence.candidates
        .map(candidate => requestedMetricCandidateScore(
          slot,
          candidate,
          { allowProvisionalExplicitValue: true }
        ))
        .filter(Boolean);
      if (provisionalOptions.length !== 1) return;
      const anchors = requestedExplicitValueEvidenceAnchors(
        slot,
        provisionalOptions[0],
        [provisionalOptions[0]]
      );
      if (!anchors.length) return;
      coveredSlotIndexes.push(slotIndex);
      alignmentScore += 1;
      return;
    }
    if (!relationTerms.length) return;
    const qualitativeBinding = REQUESTED_QUALITATIVE_SLOT_VALUE_TYPES.has(slotValueType)
      ? requestedFactQualitativeEvidenceBinding(slot, body)
      : null;
    if (REQUESTED_QUALITATIVE_SLOT_VALUE_TYPES.has(slotValueType) && !qualitativeBinding) return;
    const matchedTermCount = qualitativeBinding
      ? qualitativeBinding.matched_relation_terms.length
      : relationTerms.filter(term =>
          requestedFactRelationAlternatives(slot, term).some(variant =>
            candidateTokens.some(token => requestedMetricTermMatchQuality(variant, token.value) >= 0.72)
          )
        ).length;
    const minimumMatches = qualitativeBinding?.minimum_relation_matches ??
      (relationTerms.length <= 2 ? 1 : Math.min(2, Math.ceil(relationTerms.length * 0.35)));
    if (matchedTermCount < minimumMatches) return;
    const scopeValues = Array.isArray(slot?.scope_values)
      ? slot.scope_values.map(value => String(value || "").trim()).filter(Boolean)
      : [];
    if (scopeValues.length && !scopeValues.every(value => requestedFactScopeValueCovered(body, value))) return;
    const expectedCardinality = Number(slot?.expected_cardinality || 0);
    const participantBreakdown = expectedCardinality > 1 ? extractUniformParticipantBreakdown(body) : null;
    if (
      expectedCardinality > 1 &&
      Number(participantBreakdown?.groupCardinality || participantBreakdown?.derivedGroupCardinality || 0) < expectedCardinality
    ) return;
    if (REQUESTED_METRIC_SUPPORTED_VALUE_TYPES.has(slotValueType)) {
      const evidence = requestedMetricEvidenceCandidates(body, [slotValueType]);
      const metricCandidateCovered = evidence.candidates.some(candidate => {
        if (requestedMetricCandidateScore({ ...slot, slot_source: "requested_fact_slots" }, candidate)) {
          return true;
        }
        if (relationTerms.length !== 1) return false;
        return candidate.tokens.some(token => {
          const quality = requestedMetricTermMatchQuality(relationTerms[0], token.value);
          if (!quality) return false;
          const distance = token.start >= candidate.end
            ? token.start - candidate.end
            : candidate.start >= token.end
              ? candidate.start - token.end
              : 0;
          return distance <= 96;
        });
      });
      if (!metricCandidateCovered) return;
    }
    coveredSlotIndexes.push(slotIndex);
    alignmentScore += matchedTermCount / relationTerms.length;
  });
  return { coveredSlotIndexes, alignmentScore };
}

function prioritizeRequestedFactBodies(slots = [], bodies = []) {
  const annotated = (Array.isArray(bodies) ? bodies : []).map((body, index) => ({
    body,
    index,
    ...requestedFactBodyAlignment(slots, body)
  }));
  const remaining = [...annotated];
  const ordered = [];
  const uncoveredSlots = new Set(slots.map((_, index) => index));
  while (remaining.length && uncoveredSlots.size) {
    remaining.sort((left, right) => {
      const rightGain = right.coveredSlotIndexes.filter(index => uncoveredSlots.has(index)).length;
      const leftGain = left.coveredSlotIndexes.filter(index => uncoveredSlots.has(index)).length;
      return rightGain - leftGain || right.alignmentScore - left.alignmentScore || left.index - right.index;
    });
    const best = remaining[0];
    const gain = best.coveredSlotIndexes.filter(index => uncoveredSlots.has(index));
    if (!gain.length) break;
    remaining.shift();
    ordered.push(best);
    gain.forEach(index => uncoveredSlots.delete(index));
  }
  return [...ordered, ...remaining.sort((left, right) => left.index - right.index)].map(item => item.body);
}

export function prioritizeRequestedFactSlotEvidence(questionPlan = {}, groups = [], options = {}) {
  const slots = requestedFactEvidenceSlotPlan(questionPlan, options);
  const candidates = Array.isArray(groups) ? groups : [];
  if (!slots.length) return candidates;
  const selectedDocumentId = String(options?.documentIdentityEvidence?.selectedDocumentId || "").trim();
  return candidates.map((group, groupIndex) => {
    if (researchGroupDocumentId(group, groupIndex) !== selectedDocumentId) return group;
    if (!Array.isArray(group?.bodies) || group.bodies.length < 2) return group;
    return { ...group, bodies: prioritizeRequestedFactBodies(slots, group.bodies) };
  });
}

export function buildRequestedFactSlotCoverage(questionPlan = {}, groups = [], options = {}) {
  const slots = requestedFactEvidenceSlotPlan(questionPlan, options);
  const selectedDocumentId = String(options?.documentIdentityEvidence?.selectedDocumentId || "").trim();
  const selectedGroups = (Array.isArray(groups) ? groups : []).filter((group, groupIndex) =>
    !selectedDocumentId || researchGroupDocumentId(group, groupIndex) === selectedDocumentId
  );
  const bodies = selectedGroups.flatMap(group => Array.isArray(group?.bodies) ? group.bodies : []);
  const coveredSlotIndexes = new Set();
  for (const body of bodies) {
    requestedFactBodyAlignment(slots, body).coveredSlotIndexes.forEach(index => coveredSlotIndexes.add(index));
  }
  const missingSlotIndexes = slots
    .map((_, index) => index)
    .filter(index => !coveredSlotIndexes.has(index));
  return {
    version: "requested_fact_slot_coverage_v1",
    enabled: slots.length > 0,
    selected_document_id: selectedDocumentId || null,
    requested_slot_count: slots.length,
    covered_slot_count: coveredSlotIndexes.size,
    covered_slot_indexes: [...coveredSlotIndexes].sort((left, right) => left - right),
    missing_slot_indexes: missingSlotIndexes,
    evidence_body_count: bodies.length,
    complete: slots.length > 0 && missingSlotIndexes.length === 0
  };
}

function requestedMetricSlotPlan(questionPlan = {}, {
  specificResearchFactQuestion = false,
  documentIdentityEvidence = null
} = {}) {
  const requested = requestedFactSlotsFromQuestionPlan(questionPlan);
  const slots = requested.slots;
  if (
    !specificResearchFactQuestion ||
    documentIdentityEvidence?.matched !== true ||
    documentIdentityEvidence?.confidence !== "high" ||
    !String(documentIdentityEvidence?.selectedDocumentId || "").trim() ||
    requested.complete !== true ||
    requested.truncated === true ||
    requested.unresolvedClauseCount !== 0 ||
    requested.emittedSlotCount !== slots.length ||
    slots.length < 1 ||
    slots.length > REQUESTED_METRIC_CONTRACT_MAX_SLOTS ||
    slots.some(slot =>
      !REQUESTED_METRIC_SUPPORTED_VALUE_TYPES.has(String(slot?.value_type || "")) ||
      !["original", "canonical_fallback"].includes(slot?.input_form)
    )
  ) return [];
  return slots;
}

function requestedMetricBodyAlignment(slots = [], body = "") {
  const evidence = requestedMetricEvidenceCandidates(
    body,
    slots.map(slot => slot?.value_type)
  );
  const { assignment, ambiguous, diagnostics } = bestRequestedMetricAssignment(slots, evidence.candidates);
  if (!ambiguous && Array.isArray(assignment) && assignment.length === slots.length) {
    return {
      coveredSlotCount: assignment.length,
      alignmentScore: assignment.reduce((sum, option) => sum + option.score, 0)
    };
  }
  return {
    coveredSlotCount: diagnostics.filter(slot => slot.matching_candidate_count > 0).length,
    alignmentScore: diagnostics.reduce((sum, slot) => sum + Number(slot.top_candidates?.[0]?.score || 0), 0)
  };
}

export function prioritizeRequestedMetricSlotEvidence(questionPlan = {}, groups = [], options = {}) {
  const slots = requestedMetricSlotPlan(questionPlan, options);
  const candidates = Array.isArray(groups) ? groups : [];
  if (!slots.length) return candidates;
  const selectedDocumentId = String(options?.documentIdentityEvidence?.selectedDocumentId || "").trim();
  return candidates.map((group, groupIndex) => {
    if (researchGroupDocumentId(group, groupIndex) !== selectedDocumentId) return group;
    if (!Array.isArray(group?.bodies) || group.bodies.length < 2) return group;
    const bodies = group.bodies
      .map((body, index) => ({
        body,
        index,
        ...requestedMetricBodyAlignment(slots, body)
      }))
      .sort((left, right) =>
        right.alignmentScore - left.alignmentScore ||
        right.coveredSlotCount - left.coveredSlotCount ||
        left.index - right.index
      )
      .map(item => item.body);
    return { ...group, bodies };
  });
}

export function buildNumericScopeEvidenceSummary(message = "", groups = []) {
  if (!shouldUseNumericScopeInstruction(message)) return "";
  const primary = Array.isArray(groups) ? groups.find(Boolean) : null;
  const bodies = Array.isArray(primary?.bodies) ? primary.bodies : [];
  const anchors = [];
  for (const body of bodies) {
    const sentences = String(body || "").split(/(?<=[.!?])\s+|[\r\n]+/u);
    for (const sentence of sentences) {
      const normalized = normalizeIntentText(sentence);
      const hasWholeScope = /\b(?:kogu\s+valim\w*|koguvalim\w*|koguarv\w*|uldarv\w*|valim\w*\s+(?:moodustas|koosnes))\b/.test(normalized);
      const hasNumericEvidence = /\b\d+(?:[.,]\d+)?\b|%/.test(normalized);
      if (!hasWholeScope || !hasNumericEvidence) continue;
      const clean = sentence.replace(/\s+/g, " ").trim();
      if (clean && !anchors.includes(clean)) anchors.push(clean.slice(0, 700));
      if (anchors.length >= 2) break;
    }
    if (anchors.length >= 2) break;
  }
  if (!anchors.length) return "";
  return [
    "NUMERIC_SCOPE_EVIDENCE:",
    "Järgmised laused nimetavad valitud põhiallika koguvalimi või üldarvu. Täpsustamata arvuküsimuses kasuta seda üldarvu; ära asenda seda alamrühma arvu ega avaldamisaastaga.",
    ...anchors.map((sentence, index) => `[${index + 1}] ${sentence}`)
  ].join("\n");
}

const REQUESTED_FACT_SLOT_CONTRACT_VERSION = "requested_fact_slot_contract_v1";
const REQUESTED_METRIC_CONTRACT_MAPPING_METHOD = "bounded_rendered_sentence_peer_alignment_v8";
const REQUESTED_METRIC_CONTRACT_MAX_SLOTS = 6;
const REQUESTED_METRIC_CONTRACT_MAX_EVIDENCE_CANDIDATES = 512;
// A coordinated evidence relation can leave the correct peer just below the
// first few locally-scored candidates. Keep a small, bounded alternative set
// for the joint assignment so that the later ordering and shared-subject
// checks decide the relation instead of a premature per-slot cutoff.
const REQUESTED_METRIC_CONTRACT_MAX_OPTIONS_PER_SLOT = 8;
// Keep the mapping bounded by the final rendered evidence body, but do not
// make the bound depend on an arbitrary number of sentence fragments. A
// single rendered source body can contain soft PDF separators between closely
// related evidence sentences; the old fragment-count cap rejected those
// relations even when the candidate terms and ordering were unambiguous.
const REQUESTED_METRIC_CONTRACT_MAX_EVIDENCE_CHAR_SPAN = 1800;
// PDF extraction can place a replacement-character separator inside one
// evidence sentence. Coordinated values may cross that soft separator, but
// must still remain in the same rendered body and semantic sentence scope.
const REQUESTED_METRIC_CONTRACT_MAX_COORDINATION_PEER_CHAR_SPAN = 640;
const REQUESTED_METRIC_SUPPORTED_VALUE_TYPES = new Set([
  "proportion",
  "count",
  "amount",
  "magnitude",
  "duration",
  "calendar_year",
  "explicit_value_relation"
]);

function requestedMetricToken(value = "") {
  return normalizeIntentText(value)
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .trim();
}

function requestedMetricTermMatchQuality(left = "", right = "") {
  return factRelationTermMatchQuality(left, right);
}

function requestedMetricEvidenceTokens(value = "") {
  return factRelationTokens(value);
}

function requestedMetricEvidenceFragments(value = "") {
  const text = String(value || "");
  const fragments = [];
  let bodyOffset = 0;
  let bodyIndex = 0;
  const bodySeparator = "\n---\n";
  for (const body of text.split(bodySeparator)) {
    const boundaries = /(?<=[.!?])\s+|[\r\n]+|�+/gu;
    let segmentStart = 0;
    let relationScopeIndex = 0;
    let continuesPreviousLine = false;
    for (const match of body.matchAll(boundaries)) {
      // The dot in "2018. aastast" is ordinal punctuation, not a sentence
      // boundary separating the year from its relation/unit.
      if (/\d+\.$/u.test(body.slice(0, Number(match.index))) &&
        /^(?:aasta|kuu|paev|päev|nadal|nädal)\p{L}*/u.test(body.slice(Number(match.index) + match[0].length))) continue;
      const raw = body.slice(segmentStart, Number(match.index));
      const fragment = raw.replace(/\s+/gu, " ").trim();
      if (fragment) {
        const leadingWhitespace = raw.search(/\S/u);
        fragments.push({
          text: fragment,
          startOffset: bodyOffset + segmentStart + Math.max(0, leadingWhitespace),
          bodyIndex,
          relationScopeIndex,
          continuesPreviousLine
        });
      }
      const boundary = String(match[0] || "");
      continuesPreviousLine = /^\r?\n$/u.test(boundary) && /\S/u.test(raw) && !/[.!?]\s*$/u.test(raw);
      if (!/^�+$/u.test(boundary)) relationScopeIndex += 1;
      segmentStart = Number(match.index) + boundary.length;
    }
    const tail = body.slice(segmentStart);
    const fragment = tail.replace(/\s+/gu, " ").trim();
    if (fragment) {
      const leadingWhitespace = tail.search(/\S/u);
      fragments.push({
        text: fragment,
        startOffset: bodyOffset + segmentStart + Math.max(0, leadingWhitespace),
        bodyIndex,
        relationScopeIndex,
        continuesPreviousLine
      });
    }
    bodyOffset += body.length + bodySeparator.length;
    bodyIndex += 1;
  }
  return fragments;
}

function requestedMetricEvidenceRelationTokens(fragments = [], fragmentIndex = 0) {
  const current = fragments[fragmentIndex];
  if (!current) return [];
  return fragments
    .filter(fragment =>
      fragment.bodyIndex === current.bodyIndex &&
      fragment.relationScopeIndex <= current.relationScopeIndex &&
      current.relationScopeIndex - fragment.relationScopeIndex <= 1
    )
    .flatMap(fragment => {
      const relativeOffset = fragment.startOffset - current.startOffset;
      return requestedMetricEvidenceTokens(fragment.text).map(token => ({
        ...token,
        start: token.start + relativeOffset,
        end: token.end + relativeOffset,
        parenthesisDepth: requestedMetricParenthesisDepth(fragment.text, token.start),
        categoryLocal: fragment === current ||
          (current.continuesPreviousLine && fragment === fragments[fragmentIndex - 1])
      }));
    });
}

function requestedMetricParenthesisDepth(value = "", index = 0) {
  let depth = 0;
  for (const character of String(value || "").slice(0, Math.max(0, index))) {
    if (/[([{]/u.test(character)) depth += 1;
    if (/[)\]}]/u.test(character)) depth = Math.max(0, depth - 1);
  }
  return depth;
}

function requestedMetricMentionQualifier(fragment = "", start = 0, end = 0) {
  const prefix = normalizeIntentText(String(fragment || "").slice(Math.max(0, start - 48), start));
  const suffix = normalizeIntentText(String(fragment || "").slice(end, Math.min(fragment.length, end + 36)));
  if (
    /(?:[~≈<>≤≥]|\d{1,3}(?:[.,]\d+)?\s*%?\s*(?:[–—-]|kuni|to))\s*$/u.test(prefix) ||
    /^\s*(?:[–—-]\s*\d{1,3}(?:[.,]\d+)?\s*%?|(?:voi|or|или)\s+(?:vahem|rohkem|less|more|меньше|больше))/u.test(suffix)
  ) return "range";
  if (/(?:^|\s)(?:mitte\s+(?:alla|vahem\s+kui)|not\s+(?:under|less\s+than)|не\s+менее)\s*$/u.test(prefix)) {
    return "at_least";
  }
  if (/(?:^|\s)(?:mitte\s+(?:ule|enam\s+kui|rohkem\s+kui)|not\s+(?:over|more\s+than)|не\s+(?:более|свыше))\s*$/u.test(prefix)) {
    return "at_most";
  }
  if (/(?:^|\s)(?:vahemalt|at\s+least|не\s+менее)\s*$/u.test(prefix)) return "at_least";
  if (/(?:^|\s)(?:kuni|at\s+most|up\s+to|не\s+более|до)\s*$/u.test(prefix)) return "at_most";
  if (/(?:^|\s)(?:ule|enam\s+kui|rohkem\s+kui|over|more\s+than|более|свыше)\s*$/u.test(prefix)) {
    return "over";
  }
  if (/(?:^|\s)(?:alla|vahem\s+kui|under|less\s+than|менее)\s*$/u.test(prefix)) {
    return "under";
  }
  if (/(?:^|\s)(?:ligi|umbes|ligikaudu|keskmiselt|peaaegu|ca\.?|u\.?|approximately|about|around|nearly|около|примерно)\s*$/u.test(prefix)) {
    return "about";
  }
  return null;
}

function requestedMetricMentionIsStructural(fragment = "", start = 0, end = 0) {
  const text = String(fragment || "");
  const prefix = text.slice(0, Math.max(0, start));
  const suffix = text.slice(Math.max(0, end));
  const bracketedReference = /\[\s*$/u.test(prefix) && /^\s*\]/u.test(suffix);
  const leadingListMarker = /^\s*$/u.test(prefix) && /^\s*[.)]\s+/u.test(suffix);
  const attachedFootnote = /\p{L}[.!?]$/u.test(prefix) && /^(?:\s|$)/u.test(suffix);
  return bracketedReference || leadingListMarker || attachedFootnote;
}

function requestedMetricEvidenceCandidates(renderedText = "", valueTypes = ["proportion"]) {
  const requestedValueTypes = new Set(
    (Array.isArray(valueTypes) ? valueTypes : [valueTypes])
      .map(value => String(value || ""))
      .filter(value => REQUESTED_METRIC_SUPPORTED_VALUE_TYPES.has(value))
  );
  if (!requestedValueTypes.size) {
    return { candidates: [], candidateCount: 0, fragmentCount: 0, truncated: false };
  }
  const candidates = [];
  const fragments = requestedMetricEvidenceFragments(renderedText);
  fragments.forEach((fragmentEntry, fragmentIndex) => {
    const fragment = fragmentEntry.text;
    const tokens = requestedMetricEvidenceRelationTokens(fragments, fragmentIndex);
    const occupiedSpans = [];
    const percentageMentions = requestedValueTypes.has("proportion") ||
      requestedValueTypes.has("explicit_value_relation")
      ? Array.from(fragment.matchAll(/(?<![\p{L}\p{N}])(\d{1,3}(?:[.,]\d+)?)\s*%(?![\p{L}\p{N}])/gu))
      : [];
    percentageMentions.forEach((mention, mentionIndex) => {
      const start = Number(mention.index);
      const end = start + String(mention[0] || "").length;
      const qualifier = requestedMetricMentionQualifier(fragment, start, end);
      if (qualifier === "range") return;
      const rawValue = String(mention[1] || "").replace(",", ".");
      const numericValue = Number(rawValue);
      if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) return;
      candidates.push({
        key: `${fragmentIndex}:${mentionIndex}`,
        fragment,
        fragmentIndex,
        mentionIndex,
        bodyIndex: fragmentEntry.bodyIndex,
        relationScopeIndex: fragmentEntry.relationScopeIndex,
        start,
        end,
        absoluteStart: fragmentEntry.startOffset + start,
        absoluteEnd: fragmentEntry.startOffset + end,
        value: rawValue,
        unit: "percent",
        qualifier,
        valueType: requestedValueTypes.has("proportion")
          ? "proportion"
          : "explicit_value_relation",
        parenthesisDepth: requestedMetricParenthesisDepth(fragment, start),
        tokens
      });
      occupiedSpans.push([start, end]);
    });
    const nonProportionTypes = [...requestedValueTypes].filter(value => value !== "proportion");
    if (nonProportionTypes.length) {
      const numericMentions = Array.from(fragment.matchAll(
        /(?<![\p{L}\p{N}%§])(\d+(?:[.,]\d+)?)(?:\s*\.?\s*(eurot?|eur|€|paeva\p{L}*|päeva\p{L}*|nadala\p{L}*|nädala\p{L}*|kuu\p{L}*|aasta\p{L}*))?(?![\p{L}\p{N}%])/gu
      ));
      numericMentions.forEach((mention, mentionIndex) => {
        const start = Number(mention.index);
        const end = start + String(mention[0] || "").length;
        if (occupiedSpans.some(([spanStart, spanEnd]) => start < spanEnd && end > spanStart)) return;
        const qualifier = requestedMetricMentionQualifier(fragment, start, end);
        if (qualifier === "range") return;
        if (requestedMetricMentionIsStructural(fragment, start, end)) return;
        const rawValue = String(mention[1] || "").replace(",", ".");
        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue) || numericValue < 0) return;
        const calendarYearValue = Number.isInteger(numericValue) && numericValue >= 1900 && numericValue <= 2100;
        if (calendarYearValue && !requestedValueTypes.has("calendar_year")) return;
        const unitText = String(mention[2] || "").trim();
        const normalizedUnit = normalizeIntentText(unitText);
        const inferredType = calendarYearValue
          ? "calendar_year"
          : /^(?:eurot?|eur|€)$/u.test(normalizedUnit)
          ? "amount"
          : /^(?:paev|nadal|kuu|aasta)\p{L}*$/u.test(normalizedUnit)
            ? "duration"
          : nonProportionTypes.length === 1
            ? nonProportionTypes[0]
            : "number";
        candidates.push({
          key: `${fragmentIndex}:number:${mentionIndex}`,
          fragment,
          fragmentIndex,
          mentionIndex,
          bodyIndex: fragmentEntry.bodyIndex,
          relationScopeIndex: fragmentEntry.relationScopeIndex,
          start,
          end,
          absoluteStart: fragmentEntry.startOffset + start,
          absoluteEnd: fragmentEntry.startOffset + end,
          value: rawValue,
          unit: unitText || null,
          qualifier,
          valueType: inferredType,
          parenthesisDepth: requestedMetricParenthesisDepth(fragment, start),
          tokens
        });
      });
      const wordMentions = Array.from(fragment.matchAll(
        /(?<![\p{L}\p{N}])([\p{L}]+)(?![\p{L}\p{N}])/gu
      ));
      wordMentions.forEach((mention, mentionIndex) => {
        const word = String(mention[1] || "");
        const followingSlice = fragment.slice(Number(mention.index) + word.length);
        const followingText = followingSlice.trimStart();
        const numericValue = smallCardinalNumberValue(word, followingText, fragment.slice(0, Number(mention.index)));
        if (numericValue === null || numericValue < 0) return;
        const start = Number(mention.index);
        const unitMatch = followingSlice.match(
          /^\s*(eurot?|eur|paeva\p{L}*|päeva\p{L}*|nadala\p{L}*|nädala\p{L}*|kuu\p{L}*|aasta\p{L}*)(?![\p{L}\p{N}])/u
        );
        const end = start + word.length + (unitMatch ? String(unitMatch[0] || "").length : 0);
        const qualifier = requestedMetricMentionQualifier(fragment, start, end);
        if (qualifier === "range") return;
        const unitText = String(unitMatch?.[1] || "").trim();
        const normalizedUnit = normalizeIntentText(unitText);
        const inferredType = /^(?:eurot?|eur)$/u.test(normalizedUnit)
          ? "amount"
          : /^(?:paev|nadal|kuu|aasta)\p{L}*$/u.test(normalizedUnit)
            ? "duration"
            : nonProportionTypes.length === 1
              ? nonProportionTypes[0]
              : "number";
        candidates.push({
          key: `${fragmentIndex}:word:${mentionIndex}`,
          fragment,
          fragmentIndex,
          mentionIndex,
          bodyIndex: fragmentEntry.bodyIndex,
          relationScopeIndex: fragmentEntry.relationScopeIndex,
          start,
          end,
          absoluteStart: fragmentEntry.startOffset + start,
          absoluteEnd: fragmentEntry.startOffset + end,
          value: String(numericValue),
          sourceWord: normalizeIntentText(word),
          unit: unitText || null,
          qualifier,
          valueType: inferredType,
          parenthesisDepth: requestedMetricParenthesisDepth(fragment, start),
          tokens
        });
      });
    }
  });
  return {
    candidates: candidates.slice(0, REQUESTED_METRIC_CONTRACT_MAX_EVIDENCE_CANDIDATES),
    candidateCount: candidates.length,
    fragmentCount: fragments.length,
    truncated: candidates.length > REQUESTED_METRIC_CONTRACT_MAX_EVIDENCE_CANDIDATES
  };
}

function requestedMetricCandidateScore(
  slot = {},
  candidate = {},
  { allowProvisionalExplicitValue = false } = {}
) {
  const slotValueType = String(slot?.value_type || "");
  const scopeValues = new Set((Array.isArray(slot?.scope_values) ? slot.scope_values : [])
    .map(value => String(value || "").replace(",", ".").trim())
    .filter(Boolean));
  if (scopeValues.has(String(candidate?.value || "").replace(",", ".").trim())) return null;
  const explicitValues = new Set((Array.isArray(slot?.explicit_values) ? slot.explicit_values : [])
    .map(value => String(value || "").replace(/\s+/gu, "").replace(",", ".").replace(/%$/u, ""))
    .filter(Boolean));
  const relationTerms = Array.isArray(slot?.relation_terms)
    ? slot.relation_terms.map(value => String(value || "").trim()).filter(Boolean).slice(0, 8)
    : [];
  const sourceWord = requestedMetricToken(candidate?.sourceWord || "");
  const modifierNoun = requestedMetricModifierNoun(candidate);
  if (slotValueType === "count" && modifierNoun && !relationTerms.some(term =>
    requestedFactRelationAlternatives(slot, term).some(variant =>
      requestedMetricTermMatchQuality(variant, modifierNoun) >= 0.72
    )
  )) return null;
  if (
    sourceWord &&
    relationTerms.some(relationTerm =>
      requestedFactRelationAlternatives(slot, relationTerm).some(variant =>
        requestedMetricTermMatchQuality(variant, sourceWord) >= 0.86
      )
    )
  ) return null;
  if (slotValueType === "explicit_value_relation") {
    const candidateValue = String(candidate?.value || "").replace(",", ".").trim();
    if (
      !allowProvisionalExplicitValue ||
      explicitValues.size !== 1 ||
      !explicitValues.has(candidateValue)
    ) return null;
    return {
      candidate,
      score: 4,
      matchedTermCount: 0,
      relationTermCount: relationTerms.length,
      localRelationHeadMatched: false,
      subjectHead: "",
      provisionalExplicitValue: true
    };
  }
  if (slotValueType === "calendar_year" && candidate?.valueType !== "calendar_year") return null;
  if (
    candidate?.valueType !== "number" &&
    slotValueType &&
    candidate?.valueType !== slotValueType
  ) return null;
  if (!relationTerms.length || !Array.isArray(candidate?.tokens)) return null;
  if (slot?.derivation === "coordinated_shared_head" && candidate.parenthesisDepth > 0) return null;
  let score = 0;
  let matchedTermCount = 0;
  let nearTermCount = 0;
  for (const relationTerm of relationTerms) {
    let best = null;
    for (const relationVariant of requestedFactRelationAlternatives(slot, relationTerm)) {
      for (const token of candidate.tokens) {
        const quality = requestedMetricTermMatchQuality(relationVariant, token.value);
        if (!quality) continue;
        const distance = token.start >= candidate.end
          ? token.start - candidate.end
          : candidate.start >= token.end
            ? candidate.start - token.end
            : 0;
        if (distance > 260) continue;
        const proximityBoost = distance <= 32
          ? 1.7
          : distance <= 96
            ? 1.1
            : distance <= 180
              ? 0.6
              : 0.25;
        const termScore = quality * (1 + proximityBoost);
        if (!best || termScore > best.termScore) best = { termScore, distance };
      }
    }
    if (!best) continue;
    matchedTermCount += 1;
    if (best.distance <= 96) nearTermCount += 1;
    score += best.termScore;
  }
  const minimumMatches = slot?.slot_source === "evidence_metric_slots"
    ? 1
    : relationTerms.length <= 2
      ? 1
      : Math.min(2, Math.ceil(relationTerms.length * 0.35));
  if (matchedTermCount < minimumMatches) return null;
  if (nearTermCount < 1) return null;
  const localRelationMatch = candidate.tokens
    .map(token => {
      const distance = token.start >= candidate.end
        ? token.start - candidate.end
        : candidate.start >= token.end
          ? candidate.start - token.end
          : 0;
      const matched = relationTerms.some(relationTerm =>
        requestedFactRelationAlternatives(slot, relationTerm).some(variant =>
          requestedMetricTermMatchQuality(variant, token.value) >= 0.72
        )
      );
      return { token, distance, matched };
    })
    .filter(item => item.matched && item.distance <= 40)
    .sort((left, right) => left.distance - right.distance)[0] || null;
  const localRelationHead = localRelationMatch?.token || null;
  const localRelationHeadMatched = !!localRelationHead;
  if (localRelationHeadMatched) {
    score += localRelationMatch.distance <= 12 ? 3.25 : 2;
  }
  return {
    candidate,
    score,
    matchedTermCount,
    relationTermCount: relationTerms.length,
    localRelationHeadMatched,
    subjectHead: localRelationHead?.value || "",
    localRelationHeadDistance: localRelationMatch?.distance ?? null
  };
}

function requestedMetricCandidateComesAfter(candidate = {}, previousCandidate = null) {
  if (!previousCandidate) return true;
  if (candidate.fragmentIndex !== previousCandidate.fragmentIndex) {
    return candidate.fragmentIndex > previousCandidate.fragmentIndex;
  }
  return candidate.start > previousCandidate.start;
}

function requestedMetricCoordinationAssignment(slots = [], assignment = []) {
  const qualified = assignment.map(option => ({ ...option }));
  const coordinationGroups = new Map();
  slots.forEach((slot, slotIndex) => {
    const group = Number(slot?.coordination_group);
    if (!Number.isInteger(group) || group <= 0) return;
    if (!coordinationGroups.has(group)) coordinationGroups.set(group, []);
    coordinationGroups.get(group).push(slotIndex);
  });
  for (const slotIndexes of coordinationGroups.values()) {
    if (slotIndexes.length < 2) return null;
    const peerOptions = slotIndexes.map(slotIndex => qualified[slotIndex]).filter(Boolean);
    if (peerOptions.length !== slotIndexes.length) return null;
    const firstSubjectHead = requestedMetricToken(peerOptions[0]?.subjectHead || "");
    const peersShareSubjectHead = !!firstSubjectHead && peerOptions.every(option =>
      requestedMetricTermMatchQuality(firstSubjectHead, option?.subjectHead || "") >= 0.86
    );
    const firstCoordinatedSlotIndex = Math.min(...slotIndexes);
    const firstPeerCandidate = peerOptions[0]?.candidate || null;
    const subjectAppearsInEarlierSlot = peersShareSubjectHead && qualified
      .slice(0, firstCoordinatedSlotIndex)
      .some((option, earlierSlotIndex) => {
        const earlierCoordinationGroup = Number(slots[earlierSlotIndex]?.coordination_group);
        const subjectMatches = requestedMetricTermMatchQuality(
          firstSubjectHead,
          option?.subjectHead || ""
        ) >= 0.86;
        if (!subjectMatches) return false;
        if (!Number.isInteger(earlierCoordinationGroup) || earlierCoordinationGroup <= 0) return true;
        const earlierCandidate = option?.candidate || null;
        return !!firstPeerCandidate &&
          !!earlierCandidate &&
          earlierCandidate.bodyIndex === firstPeerCandidate.bodyIndex &&
          earlierCandidate.absoluteEnd <= firstPeerCandidate.absoluteStart &&
          firstPeerCandidate.absoluteStart - earlierCandidate.absoluteEnd <=
            REQUESTED_METRIC_CONTRACT_MAX_COORDINATION_PEER_CHAR_SPAN;
      });
    const everyPeerHasLocalRelationHead = peerOptions.every(option => option.localRelationHeadMatched);
    if (!subjectAppearsInEarlierSlot && !everyPeerHasLocalRelationHead) return null;
    for (const slotIndex of slotIndexes) {
      qualified[slotIndex] = {
        ...qualified[slotIndex],
        sharedSubjectHeadMatched: subjectAppearsInEarlierSlot
      };
    }
  }
  return qualified;
}

function requestedMetricModifierNoun(candidate = {}) {
  const following = String(candidate.fragment || "").slice(candidate.end).match(/^\s+([\p{L}-]+)/u)?.[1] || "";
  return /ga$/u.test(following) && following.length >= 6 ? following : "";
}

function requestedMetricCategoryLocalScore(slot = {}, candidate = {}, slots = [], candidates = []) {
  const group = slot?.coordination_group;
  const peers = group ? slots.filter(peer => peer !== slot && peer.coordination_group === group) : [];
  if (!peers.length) return null;
  const uniqueTerms = (slot.relation_terms || []).filter(term => !peers.some(peer =>
    (peer.relation_terms || []).some(peerTerm => requestedFactRelationAlternatives(slot, term).some(variant =>
      requestedFactRelationAlternatives(peer, peerTerm).some(peerVariant =>
        requestedMetricTermMatchQuality(variant, peerVariant) >= 0.86
      )
    ))
  ));
  if (!uniqueTerms.length) return null;
  const fragmentOffset = candidate.absoluteStart - candidate.start;
  const adjacent = candidates.filter(peer => peer !== candidate && !requestedMetricModifierNoun(peer) &&
    peer.bodyIndex === candidate.bodyIndex && peer.parenthesisDepth === candidate.parenthesisDepth);
  const lower = Math.max(-160, ...adjacent.filter(peer => peer.absoluteEnd <= candidate.absoluteStart)
    .map(peer => peer.absoluteEnd - fragmentOffset));
  const upper = Math.min(candidate.fragment.length, ...adjacent.filter(peer => peer.absoluteStart >= candidate.absoluteEnd)
    .map(peer => peer.absoluteStart - fragmentOffset));
  let best = 0;
  for (const token of candidate.tokens) {
    if (!token.categoryLocal || token.start < lower || token.end > upper ||
      token.parenthesisDepth !== candidate.parenthesisDepth) continue;
    if (!uniqueTerms.some(term => requestedFactRelationAlternatives(slot, term).some(variant =>
      requestedMetricTermMatchQuality(variant, token.value) >= 0.72
    ))) continue;
    const follows = token.start >= candidate.end;
    const distance = follows ? token.start - candidate.end : candidate.start - token.end;
    if (distance < 0 || distance > 160) continue;
    // Bind a category inside this number's own span. A label after the number
    // is stronger than a preceding label that may belong to the previous one.
    best = Math.max(best, (follows ? 8 : 4) / (1 + distance / 80));
  }
  return best;
}

function bestRequestedMetricAssignment(slots = [], candidates = []) {
  const hasExplicitSlots = slots.some(slot => slot?.value_type === "explicit_value_relation");
  const allExplicitSlots = slots.length > 0 && slots.every(
    slot => slot?.value_type === "explicit_value_relation"
  );
  const explicitSlotValues = allExplicitSlots
    ? slots.map(slot => {
        const values = Array.from(new Set(
          (Array.isArray(slot?.explicit_values) ? slot.explicit_values : [])
            .map(value => String(value || "").replace(/\s+/gu, "").replace(",", ".").replace(/%$/u, ""))
            .filter(Boolean)
        ));
        return values.length === 1 ? values[0] : "";
      })
    : [];
  const hasCoordinationGroups = slots.some(slot => {
    const group = Number(slot?.coordination_group);
    return Number.isInteger(group) && group > 0;
  });
  const emptyResult = {
    assignment: null,
    ambiguous: false,
    diagnostics: [],
    coordinationGate: {
      evaluated: false,
      passed: null,
      rejectedAssignmentCount: null,
      qualifiedSolutionCount: null
    }
  };
  if (!slots.length || !candidates.length) return emptyResult;
  if (
    hasExplicitSlots &&
    (
      !allExplicitSlots ||
      explicitSlotValues.some(value => !value) ||
      new Set(explicitSlotValues).size !== explicitSlotValues.length
    )
  ) return emptyResult;
  const scoredOptionsBySlot = slots.map(slot => candidates
    .map(candidate => requestedMetricCandidateScore(
      slot,
      candidate,
      { allowProvisionalExplicitValue: allExplicitSlots }
    ))
    .filter(Boolean)
    .flatMap(option => {
      const localScore = requestedMetricCategoryLocalScore(slot, option.candidate, slots, candidates);
      return localScore === 0 ? [] : [{ ...option, score: option.score + (localScore || 0) }];
    })
    .sort((left, right) => right.score - left.score));
  const diagnostics = scoredOptionsBySlot.map((options, index) => ({
    slot_index: Number(slots[index]?.index) || index + 1,
    matching_candidate_count: options.length,
    top_candidates: options.slice(0, 3).map(option => ({
      evidence_value: option.candidate.value,
      score: Number(option.score.toFixed(3)),
      fragment_index: option.candidate.fragmentIndex,
      mention_index: option.candidate.mentionIndex,
      rendered_body_index: option.candidate.bodyIndex,
      relation_scope_index: option.candidate.relationScopeIndex,
      matched_term_count: option.matchedTermCount,
      relation_term_count: option.relationTermCount,
      parenthesis_depth: option.candidate.parenthesisDepth,
      local_relation_head_matched: option.localRelationHeadMatched,
      ...(typeof option.sharedSubjectHeadMatched === "boolean"
        ? { shared_subject_head_matched: option.sharedSubjectHeadMatched }
        : {})
    }))
  }));
  const optionsBySlot = scoredOptionsBySlot.map(options =>
    options.slice(0, REQUESTED_METRIC_CONTRACT_MAX_OPTIONS_PER_SLOT)
  );
  if (optionsBySlot.some(options => !options.length)) {
    return { ...emptyResult, diagnostics };
  }
  const solutions = [];
  let coordinationGateEvaluationCount = 0;
  let coordinationRejectedAssignmentCount = 0;
  let coordinationQualifiedAssignmentCount = 0;
  const visit = (slotIndex, usedCandidateKeys, assignment, totalScore) => {
    if (allExplicitSlots && solutions.length >= 2) return;
    if (slotIndex >= slots.length) {
      if (hasCoordinationGroups) coordinationGateEvaluationCount += 1;
      const qualifiedAssignment = requestedMetricCoordinationAssignment(slots, assignment);
      if (!qualifiedAssignment) {
        if (hasCoordinationGroups) coordinationRejectedAssignmentCount += 1;
        return;
      }
      if (hasCoordinationGroups) coordinationQualifiedAssignmentCount += 1;
      if (allExplicitSlots) {
        const anchors = qualifiedAssignment.map((option, index) =>
          requestedExplicitValueEvidenceAnchors(slots[index], option, qualifiedAssignment)
        );
        if (anchors.some(anchorSet => !anchorSet.length)) return;
      }
      const fragmentIndexes = qualifiedAssignment
        .map(option => option?.candidate?.fragmentIndex)
        .filter(Number.isInteger);
      const absoluteStarts = qualifiedAssignment
        .map(option => option?.candidate?.absoluteStart)
        .filter(Number.isFinite);
      const absoluteEnds = qualifiedAssignment
        .map(option => option?.candidate?.absoluteEnd)
        .filter(Number.isFinite);
      const fragmentSpan = fragmentIndexes.length === qualifiedAssignment.length
        ? Math.max(...fragmentIndexes) - Math.min(...fragmentIndexes)
        : Number.POSITIVE_INFINITY;
      const evidenceCharSpan =
        absoluteStarts.length === qualifiedAssignment.length &&
        absoluteEnds.length === qualifiedAssignment.length
        ? Math.max(...absoluteEnds) - Math.min(...absoluteStarts)
        : Number.POSITIVE_INFINITY;
      if (evidenceCharSpan > REQUESTED_METRIC_CONTRACT_MAX_EVIDENCE_CHAR_SPAN) return;
      solutions.push({
        assignment: qualifiedAssignment,
        totalScore,
        fragmentSpan,
        evidenceCharSpan,
        rankingScore: totalScore - fragmentSpan * 0.35
      });
      return;
    }
    const previousCandidate = assignment.at(-1)?.candidate || null;
    for (const option of optionsBySlot[slotIndex]) {
      if (usedCandidateKeys.has(option.candidate.key)) continue;
      if (
        !allExplicitSlots &&
        !requestedMetricCandidateComesAfter(option.candidate, previousCandidate)
      ) continue;
      const coordinationGroup = slots[slotIndex]?.coordination_group;
      if (coordinationGroup) {
        let peerCandidate = null;
        for (let previousSlotIndex = slotIndex - 1; previousSlotIndex >= 0; previousSlotIndex -= 1) {
          if (slots[previousSlotIndex]?.coordination_group !== coordinationGroup) continue;
          peerCandidate = assignment[previousSlotIndex]?.candidate || null;
          break;
        }
        if (
          peerCandidate &&
          (
            !(
              (
                option.candidate.bodyIndex === peerCandidate.bodyIndex &&
                Math.abs(option.candidate.relationScopeIndex - peerCandidate.relationScopeIndex) <= 1
              ) ||
              (
                option.candidate.bodyIndex === peerCandidate.bodyIndex + 1 &&
                option.candidate.absoluteStart - peerCandidate.absoluteEnd <=
                  REQUESTED_METRIC_CONTRACT_MAX_COORDINATION_PEER_CHAR_SPAN
              )
            ) ||
            option.candidate.parenthesisDepth !== peerCandidate.parenthesisDepth ||
            option.candidate.absoluteStart - peerCandidate.absoluteEnd >
              REQUESTED_METRIC_CONTRACT_MAX_COORDINATION_PEER_CHAR_SPAN
          )
        ) continue;
      }
      usedCandidateKeys.add(option.candidate.key);
      assignment.push(option);
      visit(slotIndex + 1, usedCandidateKeys, assignment, totalScore + option.score);
      assignment.pop();
      usedCandidateKeys.delete(option.candidate.key);
    }
  };
  visit(0, new Set(), [], 0);
  const coordinationGateEvaluated = coordinationGateEvaluationCount > 0;
  const coordinationGate = {
    evaluated: coordinationGateEvaluated,
    passed: coordinationGateEvaluated ? coordinationQualifiedAssignmentCount > 0 : null,
    rejectedAssignmentCount: coordinationGateEvaluated
      ? coordinationRejectedAssignmentCount
      : null,
    qualifiedSolutionCount: coordinationGateEvaluated
      ? coordinationQualifiedAssignmentCount
      : null
  };
  if (!solutions.length) {
    return { assignment: null, ambiguous: false, diagnostics, coordinationGate };
  }
  solutions.sort((left, right) => right.rankingScore - left.rankingScore);
  const best = solutions[0];
  const conflictingSolution = solutions.find(solution => best.assignment.some((option, index) => {
    const competingCandidate = solution.assignment[index]?.candidate;
    if (slots[index]?.value_type === "explicit_value_relation") {
      return option.candidate.key !== competingCandidate?.key;
    }
    return option.candidate.value !== competingCandidate?.value;
  }));
  const ambiguous = allExplicitSlots
    ? !!conflictingSolution
    : !!(
        conflictingSolution &&
        best.rankingScore - conflictingSolution.rankingScore < 0.9
      );
  return {
    assignment: ambiguous ? null : best.assignment,
    ambiguous,
    diagnostics,
    coordinationGate
  };
}

function requestedMetricMappedRelationVariants(slot = {}, candidate = {}, candidates = []) {
  const variants = (Array.isArray(slot.relation_term_variants) ? slot.relation_term_variants : [])
    .map(entry => ({ ...entry, variants: [...(entry.variants || [])] }));
  const terms = Array.isArray(slot.relation_terms) ? slot.relation_terms : [];
  const helpTerm = terms.find(term => /^(?:lisabi|lisaabi)$/u.test(normalizeIntentText(term)));
  if (!helpTerm || !terms.some(term => normalizeIntentText(term) === "palju")) return variants.slice(0, 8);
  const peers = candidates.filter(peer => peer.fragmentIndex === candidate.fragmentIndex && peer !== candidate);
  const before = peers.filter(peer => peer.end <= candidate.start).map(peer => peer.end);
  const after = peers.filter(peer => peer.start >= candidate.end).map(peer => peer.start);
  const local = normalizeIntentText(String(candidate.fragment || "").slice(
    before.length ? Math.max(...before) : 0,
    after.length ? Math.min(...after) : undefined
  ));
  // The source itself may call the mapped subcategory "palju abi". This
  // alias belongs only to that numeric slot, never to "abi" globally.
  if (/\bpalju\s+abi\b/u.test(local)) {
    const entry = variants.find(item => normalizeIntentText(item.term) === normalizeIntentText(helpTerm));
    if (entry) entry.variants = Array.from(new Set([...entry.variants, "abi"]));
    else variants.push({ term: helpTerm, variants: [helpTerm, "abi"] });
  }
  return variants.slice(0, 8);
}

function requestedMetricContractInstruction(trace = null, replyLang = "et") {
  if (!trace?.enabled || !trace?.complete || !Array.isArray(trace.slots) || !trace.slots.length) return "";
  const slotLines = trace.slots.map(slot => {
    const unit = slot.unit === "percent" ? "%" : slot.unit ? ` ${slot.unit}` : "";
    const scope = Array.isArray(slot?.scope_values) && slot.scope_values.length
      ? `; scope=${slot.scope_values.join(",")}`
      : "";
    const qualifier = slot?.qualifier ? `; qualifier=${slot.qualifier}` : "";
    const relation = Array.isArray(slot?.relation_terms) && slot.relation_terms.length
      ? `; relation=${slot.relation_terms.join("|")}`
      : "";
    const cardinality = Number.isInteger(Number(slot?.expected_cardinality)) &&
      Number(slot.expected_cardinality) > 1
      ? `; cardinality=${Number(slot.expected_cardinality)}`
      : "";
    return `slot_${slot.slot_index}: ${slot.value_type}=${slot.evidence_value}${unit}${scope}${qualifier}${cardinality}${relation}`;
  });
  if (replyLang === "en") {
    return [
      "REQUESTED_FACT_SLOT_CONTRACT_V1:",
      "The slots follow the user's numeric clauses in their original order; a deterministically split coordinated clause follows the category order in the question.",
      ...slotLines,
      "Answer every listed slot and use only these evidence-backed metric values. Do not add other percentages, counts or numeric background from RAG_CONTEXT. A year or source label explicitly requested by the user may still be stated as scope."
    ].join("\n");
  }
  if (replyLang === "ru") {
    return [
      "REQUESTED_FACT_SLOT_CONTRACT_V1:",
      "Слоты следуют числовым частям вопроса в исходном порядке; категории детерминированно разделённой части следуют порядку в вопросе.",
      ...slotLines,
      "Ответь на каждый слот и используй только эти подтверждённые доказательством значения. Не добавляй другие проценты, количества или числовой фон из RAG_CONTEXT. Явно запрошенный год или название источника можно указать как рамку."
    ].join("\n");
  }
  return [
    "REQUESTED_FACT_SLOT_CONTRACT_V1:",
    "Slotid järgivad kasutaja arvuklausleid nende algses järjekorras; deterministlikult jagatud koondklausli kategooriad järgivad küsimuse järjekorda.",
    ...slotLines,
    "Vasta igale loetletud slotile ja kasuta ainult neid tõendist kinnitatud mõõdikuväärtusi. Ära lisa RAG_CONTEXT-ist muid protsente, loendusi ega arvulist tausta. Kasutaja sõnaselgelt küsitud aasta või allikanimetuse võid esitada ulatuse märgendina."
  ].join("\n");
}

function requestedAnswerShapeInstruction(questionPlan = {}, replyLang = "et") {
  const requested = questionPlan?.semantic_candidates?.requested_fact_slots;
  const slots = Array.isArray(requested?.slots) ? requested.slots.slice(0, 12) : [];
  if (requested?.complete !== true || slots.length < 2) return "";
  const slotLines = slots.map((slot, index) => {
    const relation = (Array.isArray(slot?.relation_terms) ? slot.relation_terms : [])
      .slice(0, 8)
      .join(" ");
    const explicitValues = (Array.isArray(slot?.explicit_values) ? slot.explicit_values : [])
      .slice(0, 4)
      .join(", ");
    const scopeValues = (Array.isArray(slot?.scope_values) ? slot.scope_values : [])
      .slice(0, 4)
      .join(", ");
    return `slot_${index + 1}: ${String(slot?.value_type || "text_relation")}` +
      `${relation ? `; relation=${relation}` : ""}` +
      `${scopeValues ? `; scope=${scopeValues}` : ""}` +
      `${explicitValues ? `; explicit_values=${explicitValues}` : ""}`;
  });
  if (replyLang === "en") {
    return [
      "REQUESTED_ANSWER_SHAPE_V2:",
      ...slotLines,
      "Answer every requested slot in order as its own numbered line. Start each line with a short label that reuses the slot's relation words, then give its evidence-backed value. Do not combine separate qualitative slots into one generic sentence. If one slot is unsupported, identify that slot instead of silently omitting it or inventing a value."
    ].join("\n");
  }
  if (replyLang === "ru") {
    return [
      "REQUESTED_ANSWER_SHAPE_V2:",
      ...slotLines,
      "Ответь на каждый запрошенный слот по порядку отдельной нумерованной строкой. Начни строку с краткой метки, повторяющей слова связи слота, затем укажи подтвержденное значение. Не объединяй разные качественные слоты в одно общее предложение. Если один слот не подтверждён, назови его вместо молчаливого пропуска или выдуманного значения."
    ].join("\n");
  }
  return [
    "REQUESTED_ANSWER_SHAPE_V2:",
    ...slotLines,
    "Vasta igale küsitud slotile järjekorras eraldi nummerdatud real. Alusta rida lühikese sildiga, mis kordab sloti seosesõnu, ja anna seejärel tõendatud väärtus. Ära ühenda eri kvalitatiivseid slotte üheks üldlauseks. Kui mõni slot pole tõendatud, nimeta see eraldi, selle asemel et see vaikides välja jätta või väärtus välja mõelda."
  ].join("\n");
}

const REQUESTED_QUALITATIVE_SLOT_CONTRACT_VERSION = "requested_qualitative_slot_contract_v1";

function requestedQualitativeSlotContractInstruction(trace = null, replyLang = "et") {
  if (!trace?.enabled || !trace?.complete || !Array.isArray(trace?.slots) || !trace.slots.length) return "";
  const slotLines = trace.slots.map(slot => {
    const relation = (Array.isArray(slot?.relation_terms) ? slot.relation_terms : []).slice(0, 5).join(" ");
    const anchors = (Array.isArray(slot?.evidence_anchor_terms) ? slot.evidence_anchor_terms : []).slice(0, 5).join(", ");
    const numbers = (Array.isArray(slot?.required_numeric_values) ? slot.required_numeric_values : []).slice(0, 8).join(", ");
    const actions = (Array.isArray(slot?.evidence_action_terms) ? slot.evidence_action_terms : []).slice(0, 5).join(", ");
    const actionRelations = (Array.isArray(slot?.action_object_bindings) ? slot.action_object_bindings : [])
      .slice(0, 8)
      .map(binding => {
        const family = String(binding?.action_family || "").trim();
        const objects = (Array.isArray(binding?.object_anchor_terms) ? binding.object_anchor_terms : [])
          .slice(0, 5)
          .join("+");
        return family && objects ? `${family}=>${objects}` : "";
      })
      .filter(Boolean)
      .join(" | ");
    return `slot_${slot.slot_index}: ${slot.value_type}` +
      `${relation ? `; relation=${relation}` : ""}` +
      `${anchors ? `; evidence_keywords=${anchors}` : ""}` +
      `${numbers ? `; required_numbers=${numbers}` : ""}` +
      `${actions ? `; action_keywords=${actions}` : ""}` +
      `${actionRelations ? `; action_object_relations=${actionRelations}` : ""}`;
  });
  if (replyLang === "en") {
    return [
      "REQUESTED_QUALITATIVE_SLOT_CONTRACT_V1:",
      ...slotLines,
      "Use one separate numbered answer line for every listed slot. Keep its relation label and include the evidence keywords and required numbers that express the answer; do not output the internal slot_N identifier."
    ].join("\n");
  }
  if (replyLang === "ru") {
    return [
      "REQUESTED_QUALITATIVE_SLOT_CONTRACT_V1:",
      ...slotLines,
      "Дай для каждого слота отдельную нумерованную строку ответа. Сохрани метку связи и включи ключевые слова доказательства и обязательные числа, выражающие ответ; внутренний идентификатор slot_N не выводи."
    ].join("\n");
  }
  return [
    "REQUESTED_QUALITATIVE_SLOT_CONTRACT_V1:",
    ...slotLines,
    "Anna iga loetletud sloti kohta eraldi nummerdatud vastuserida. Säilita seosesilt ning lisa vastust väljendavad tõendi märksõnad ja kohustuslikud arvud; sisemist slot_N tunnust ära väljasta."
  ].join("\n");
}

export function buildRequestedQualitativeSlotContract({
  questionPlan = null,
  renderedGroups = [],
  replyLang = "et",
  specificResearchFactQuestion = false,
  documentIdentityEvidence = null
} = {}) {
  const requested = questionPlan?.semantic_candidates?.requested_fact_slots;
  const slots = (Array.isArray(requested?.slots) ? requested.slots : [])
    .filter(slot => REQUESTED_QUALITATIVE_SLOT_VALUE_TYPES.has(String(slot?.value_type || "")))
    .slice(0, 12);
  if (!slots.length) return { instruction: "", trace: null };
  const selectedDocumentId = String(documentIdentityEvidence?.selectedDocumentId || "").trim();
  const baseTrace = {
    version: REQUESTED_QUALITATIVE_SLOT_CONTRACT_VERSION,
    enabled: false,
    complete: false,
    selected_document_id: selectedDocumentId || null,
    reply_language: replyLang,
    requested_slot_count: slots.length,
    mapped_slot_count: 0,
    used_for_generation: false,
    used_for_validation: false
  };
  if (requested?.complete !== true) {
    return { instruction: "", trace: { ...baseTrace, reason: "requested_slots_incomplete" } };
  }
  if (
    !specificResearchFactQuestion ||
    documentIdentityEvidence?.matched !== true ||
    documentIdentityEvidence?.confidence !== "high" ||
    !selectedDocumentId
  ) {
    return { instruction: "", trace: { ...baseTrace, reason: "document_identity_not_high" } };
  }
  const eligibleBodies = (Array.isArray(renderedGroups) ? renderedGroups : [])
    .filter(group => String(group?.docId || group?.documentId || group?.document_id || "").trim() === selectedDocumentId)
    .flatMap(group => Array.isArray(group?.bodies) ? group.bodies : [])
    .map(value => String(value || ""))
    .filter(Boolean);
  const mappedSlots = [];
  for (const slot of slots) {
    const bindings = eligibleBodies
      .map(body => requestedFactQualitativeEvidenceBinding(slot, body))
      .filter(Boolean)
      .sort((left, right) => right.score - left.score);
    const binding = bindings[0];
    if (!binding) continue;
    mappedSlots.push({
      slot_index: Number(slot?.index) || mappedSlots.length + 1,
      value_type: String(slot?.value_type || "text_relation"),
      validation_language: replyLang,
      relation_terms: Array.isArray(slot?.relation_terms) ? slot.relation_terms.slice(0, 8) : [],
      relation_term_variants: Array.isArray(slot?.relation_term_variants)
        ? slot.relation_term_variants.slice(0, 8)
        : [],
      coordination_group: slot?.coordination_group ?? null,
      expected_cardinality: Number(slot?.expected_cardinality || 0) || null,
      minimum_answer_items: binding.minimum_answer_items,
      minimum_evidence_anchor_count: binding.minimum_evidence_anchor_count,
      minimum_relation_matches: binding.minimum_relation_matches,
      minimum_anchor_matches: binding.minimum_anchor_matches,
      matched_relation_terms: binding.matched_relation_terms,
      evidence_anchor_terms: binding.evidence_anchor_terms,
      required_numeric_values: binding.required_numeric_values,
      evidence_action_terms: binding.evidence_action_terms,
      evidence_action_categories: binding.evidence_action_categories,
      evidence_negated: binding.evidence_negated,
      minimum_action_matches: binding.minimum_action_matches,
      action_object_bindings: binding.action_object_bindings.map(actionBinding => ({
        action_family: actionBinding.action_family,
        action_category: actionBinding.action_category,
        evidence_action_terms: Array.isArray(actionBinding.evidence_action_terms)
          ? actionBinding.evidence_action_terms.slice(0, 4)
          : [],
        object_anchor_terms: Array.isArray(actionBinding.object_anchor_terms)
          ? actionBinding.object_anchor_terms.slice(0, 8)
          : [],
        minimum_object_matches: actionBinding.minimum_object_matches,
        evidence_negated: actionBinding.evidence_negated === true
      })),
      evidence_fragment_hash: binding.evidence_fragment_hash,
      evidence_fragment_index: binding.evidence_fragment_index
    });
  }
  const complete = mappedSlots.length === slots.length;
  const trace = {
    ...baseTrace,
    enabled: complete,
    complete,
    mapped_slot_count: mappedSlots.length,
    used_for_generation: complete,
    used_for_validation: complete,
    reason: complete ? "all_qualitative_slots_bound_to_rendered_evidence" : "qualitative_evidence_mapping_incomplete",
    missing_slot_indexes: slots
      .map(slot => Number(slot?.index))
      .filter(index => !mappedSlots.some(mapped => mapped.slot_index === index)),
    slots: mappedSlots
  };
  return {
    instruction: requestedQualitativeSlotContractInstruction(trace, replyLang),
    trace
  };
}

export function buildRequestedFactSlotContract({
  questionPlan = null,
  renderedGroups = [],
  renderedBlocks = [],
  replyLang = "et",
  specificResearchFactQuestion = false,
  documentIdentityEvidence = null
} = {}) {
  const requested = requestedFactSlotsFromQuestionPlan(questionPlan || {});
  const requestedSlots = requested.slots;
  if (!requestedSlots.length) return { instruction: "", trace: null };
  const questionScopeValues = Array.from(new Set(
    (Array.isArray(questionPlan?.semantic_candidates?.requested_fact_slots?.question_scope_values)
      ? questionPlan.semantic_candidates.requested_fact_slots.question_scope_values
      : [])
      .map(value => String(value || "").trim())
      .filter(value => /^\d+(?:[.,]\d+)?$/u.test(value))
  ));
  const sourceIdentityValues = new Set([
    ...(Array.isArray(questionPlan?.semantic_candidates?.requested_fact_slots?.numeric_roles?.source_identity_values)
      ? questionPlan.semantic_candidates.requested_fact_slots.numeric_roles.source_identity_values
      : []),
    ...(Array.isArray(questionPlan?.document_source_years) ? questionPlan.document_source_years : [])
  ].map(value => String(value || "").replace(",", ".").trim()).filter(Boolean));
  const baseTrace = {
    version: REQUESTED_FACT_SLOT_CONTRACT_VERSION,
    compatibility_contract: "requested_metric_contract_v2",
    slot_source: requested.slotSource,
    enabled: false,
    complete: false,
    source: "final_rendered_evidence",
    mapping_method: REQUESTED_METRIC_CONTRACT_MAPPING_METHOD,
    requested_slot_count: requestedSlots.length,
    requested_metric_slot_count: requestedSlots.length,
    requested_fact_slot_count: Array.isArray(questionPlan?.semantic_candidates?.requested_fact_slots?.slots)
      ? questionPlan.semantic_candidates.requested_fact_slots.slots.length
      : requestedSlots.length,
    mapped_slot_count: 0,
    question_scope_values: questionScopeValues,
    used_for_generation: false,
    used_for_validation: false
  };
  if (
    requested.complete !== true ||
    requested.truncated === true ||
    requested.unresolvedClauseCount !== 0 ||
    requested.emittedSlotCount !== requestedSlots.length
  ) {
    return { instruction: "", trace: { ...baseTrace, reason: "requested_slots_incomplete" } };
  }
  if (requestedSlots.length > REQUESTED_METRIC_CONTRACT_MAX_SLOTS) {
    return { instruction: "", trace: { ...baseTrace, reason: "slot_count_out_of_scope" } };
  }
  if (requestedSlots.some(slot => !REQUESTED_METRIC_SUPPORTED_VALUE_TYPES.has(String(slot?.value_type || "")))) {
    return { instruction: "", trace: { ...baseTrace, reason: "unsupported_value_type_v1" } };
  }
  if (requestedSlots.some(slot => !["original", "canonical_fallback"].includes(slot?.input_form))) {
    return { instruction: "", trace: { ...baseTrace, reason: "unsupported_language_or_input_v1" } };
  }
  if (
    !specificResearchFactQuestion ||
    documentIdentityEvidence?.matched !== true ||
    documentIdentityEvidence?.confidence !== "high"
  ) {
    return { instruction: "", trace: { ...baseTrace, reason: "document_identity_not_high" } };
  }
  if (
    !Array.isArray(renderedGroups) ||
    !Array.isArray(renderedBlocks) ||
    renderedBlocks.length !== renderedGroups.length
  ) {
    return { instruction: "", trace: { ...baseTrace, reason: "rendered_evidence_mapping_incomplete" } };
  }
  const selectedDocumentId = String(documentIdentityEvidence?.selectedDocumentId || "").trim();
  let bestMappedContract = null;
  let mappingDiagnostics = null;
  for (const [groupIndex, group] of (Array.isArray(renderedGroups) ? renderedGroups : []).slice(0, 8).entries()) {
    const sourceId = String(group?.sourceId || group?.source_id || group?.id || "").trim();
    const documentId = String(group?.docId || group?.documentId || group?.document_id || "").trim();
    const renderedText = String(renderedBlocks?.[groupIndex]?.evidenceText || "");
    if (!sourceId || !documentId || !renderedText) continue;
    if (selectedDocumentId && documentId !== selectedDocumentId) continue;
    const requestedValueTypes = requestedSlots.map(slot => slot?.value_type);
    const evidenceCandidates = requestedMetricEvidenceCandidates(renderedText, requestedValueTypes);
    const candidates = evidenceCandidates.candidates.filter(candidate =>
      !(candidate?.valueType === "calendar_year" && sourceIdentityValues.has(String(candidate?.value || "")))
    );
    const {
      assignment,
      ambiguous,
      diagnostics,
      coordinationGate
    } = bestRequestedMetricAssignment(requestedSlots, candidates);
    const currentDiagnostics = {
      evidence_candidate_count: evidenceCandidates.candidateCount,
      evidence_fragment_count: evidenceCandidates.fragmentCount,
      evidence_candidates_truncated: evidenceCandidates.truncated,
      ambiguous,
      candidate_scope: "lexical_pre_assignment",
      coordination_gate_evaluated: coordinationGate.evaluated,
      coordination_gate_passed: coordinationGate.passed,
      coordination_rejected_assignment_count: coordinationGate.rejectedAssignmentCount,
      coordination_qualified_solution_count: coordinationGate.qualifiedSolutionCount,
      slots: diagnostics
    };
    if (
      !mappingDiagnostics ||
      currentDiagnostics.slots.reduce((sum, slot) => sum + slot.matching_candidate_count, 0) >
        mappingDiagnostics.slots.reduce((sum, slot) => sum + slot.matching_candidate_count, 0)
    ) {
      mappingDiagnostics = currentDiagnostics;
    }
    if (evidenceCandidates.truncated) continue;
    if (ambiguous || !assignment || assignment.length !== requestedSlots.length) continue;
    const explicitEvidenceAnchors = assignment.map((option, index) =>
      requestedExplicitValueEvidenceAnchors(requestedSlots[index], option, assignment)
    );
    if (requestedSlots.some((slot, index) =>
      slot?.value_type === "explicit_value_relation" && explicitEvidenceAnchors[index].length === 0
    )) continue;
    const slots = assignment.map((option, index) => {
      const explicitAnchors = explicitEvidenceAnchors[index];
      const relationVariants = requestedSlots[index]?.value_type !== "explicit_value_relation"
        ? requestedMetricMappedRelationVariants(requestedSlots[index], option.candidate, candidates)
        : [];
      const originalVariants = Array.isArray(requestedSlots[index]?.relation_term_variants)
        ? requestedSlots[index].relation_term_variants : [];
      const sourceMappedVariantCount = relationVariants.reduce((count, entry) => {
        const original = originalVariants.find(item => item.term === entry.term)?.variants || [];
        return count + entry.variants.filter(variant => !original.includes(variant)).length;
      }, 0);
      const relationTerms = requestedSlots[index]?.value_type === "explicit_value_relation"
        ? explicitAnchors
        : Array.isArray(requestedSlots[index]?.relation_terms)
          ? requestedSlots[index].relation_terms.slice(0, 8)
          : [];
      return {
      slot_index: Number(requestedSlots[index]?.index) || index + 1,
      value_type: String(requestedSlots[index]?.value_type || option.candidate.valueType || "amount"),
      category: String(requestedSlots[index]?.category || "").trim() || null,
      slot_source: String(requestedSlots[index]?.slot_source || requested.slotSource || "").trim() || null,
      evidence_value: option.candidate.value,
      unit: option.candidate.unit,
      qualifier: option.candidate.qualifier || null,
      relation_terms: relationTerms,
      relation_term_variants: relationVariants,
      source_mapped_relation_variant_count: sourceMappedVariantCount,
      evidence_anchor_terms: explicitAnchors,
      coordination_group: requestedSlots[index]?.coordination_group ?? null,
      expected_cardinality: Number.isInteger(Number(requestedSlots[index]?.expected_cardinality)) &&
        Number(requestedSlots[index].expected_cardinality) > 1
        ? Number(requestedSlots[index].expected_cardinality)
        : null,
      scope_values: Array.isArray(requestedSlots[index]?.scope_values)
        ? requestedSlots[index].scope_values.slice(0, 4)
        : [],
      input_form: ["original", "canonical_fallback"].includes(requestedSlots[index]?.input_form)
        ? requestedSlots[index].input_form
        : "original",
      fragment_index: option.candidate.fragmentIndex,
      mention_index: option.candidate.mentionIndex,
      matched_term_count: option.matchedTermCount,
      relation_term_count: option.relationTermCount,
      parenthesis_depth: option.candidate.parenthesisDepth,
      local_relation_head_matched: option.localRelationHeadMatched,
      minimum_relation_matches: requestedSlots[index]?.value_type === "explicit_value_relation"
        ? Math.min(2, explicitAnchors.length)
        : Math.min(2, Math.max(1, option.matchedTermCount)),
      ...(typeof option.sharedSubjectHeadMatched === "boolean"
        ? { shared_subject_head_matched: option.sharedSubjectHeadMatched }
        : {})
      };
    });
    bestMappedContract = {
      ...baseTrace,
      enabled: true,
      complete: true,
      reason: "all_requested_slots_mapped_in_one_rendered_source",
      mapped_slot_count: slots.length,
      used_for_generation: true,
      used_for_validation: true,
      source_id: sourceId,
      document_id: documentId,
      rendered_evidence_hash: hashRenderedText(renderedText),
      mapping_diagnostics: currentDiagnostics,
      slots
    };
    break;
  }
  if (!bestMappedContract) {
    return {
      instruction: "",
      trace: {
        ...baseTrace,
        reason: mappingDiagnostics?.evidence_candidates_truncated
          ? "rendered_evidence_mapping_truncated"
          : "rendered_evidence_mapping_incomplete",
        ...(mappingDiagnostics ? { mapping_diagnostics: mappingDiagnostics } : {})
      }
    };
  }
  return {
    instruction: requestedMetricContractInstruction(bestMappedContract, replyLang),
    trace: bestMappedContract
  };
}

function buildUniformParticipantRelationContract(message = "", groups = [], replyLang = "et") {
  if (!asksForParticipantGroupNumericRelation(message)) return { instruction: "", trace: null };
  for (const group of (Array.isArray(groups) ? groups : []).slice(0, 1)) {
    for (const body of Array.isArray(group?.bodies) ? group.bodies : []) {
      const relation = extractUniformParticipantBreakdown(body);
      if (!relation.perGroupValue || !relation.totalValue || !relation.qualifiersComplete) continue;
      const supportingSentence = String(body || "")
        .split(/(?<=[.!?])\s+|[\r\n]+/u)
        .map(sentence => sentence.replace(/\s+/gu, " ").trim())
        .find(sentence => {
          const sentenceRelation = extractUniformParticipantBreakdown(sentence);
          return sentenceRelation.perGroupValue === relation.perGroupValue &&
            sentenceRelation.totalValue === relation.totalValue;
        })
        ?.slice(0, 700) || "";
      if (!supportingSentence) continue;
      const relationLines = [
        "EVIDENCE_DERIVED_RELATION_CONTRACT:",
        `supporting_evidence: ${supportingSentence}`,
        `participant_count_per_group: ${relation.perGroupValue}`,
        `participant_count_per_group_qualifier: ${relation.perGroupQualifier || "exact"}`,
        `total_participant_count: ${relation.totalValue}`,
        `total_participant_count_qualifier: ${relation.totalQualifier || "exact"}`,
        "numeric_qualifier_policy: preserve_each_qualifier_do_not_convert_bounds_or_estimates_to_exact_values",
        ...(relation.groupCardinality ? [`participant_group_count: ${relation.groupCardinality}`] : []),
        "requested_answer_scope: participant_groups_and_same_sample_total",
        "coverage_count_policy: omit_unless_the_question_explicitly_requests_coverage",
        "requested_group_policy: listed_groups_or_all_relation_groups_when_general",
        "listed_group_output_schema: user_requested_group_label + participant_count_only",
        "listed_group_label_policy: do_not_extend_with_evidence_qualifiers",
        "unrequested_qualifier_policy: omit_nonidentifying_descriptions"
      ];
      const instruction = replyLang === "en"
        ? [
            ...relationLines,
            "These values come from one explicit uniform-group relation in the selected source. Answer the participant-group sizes and the same-sample people total only. When the question names participant groups, use only each user-requested group label (with grammatical case adjusted if needed) followed by its participant count; do not extend that label with duties, activities, source qualifiers or descriptive relative clauses. When the question asks generally for all groups without naming them, state every group governed by this same evidence relation and preserve the source-based group or role name needed to identify it. State each included group exactly once with its group size and state the total exactly once; do not repeat the per-group number in an additional generic sentence. The supporting evidence can contain organization, jurisdiction or location coverage counts; those counts are outside this answer scope and must be omitted unless the question independently asks for coverage. If coverage is requested, state it separately with its own unit."
          ].join("\n")
        : replyLang === "ru"
          ? [
              ...relationLines,
              "Эти значения получены из одной явной связи одинакового размера групп в выбранном источнике. Отвечай только размерами групп участников и общим числом людей в той же выборке. Если в вопросе названы группы участников, используй только название каждой запрошенной пользователем группы (при необходимости изменяя падеж) и её число участников; не расширяй название обязанностями, действиями, уточнениями из источника или описательными придаточными. Если вопрос просит назвать все группы, не перечисляя их, укажи все группы, относящиеся к этой же связи в доказательстве, и сохрани название группы или роли из источника, необходимое для её идентификации. Каждую включённую группу укажи ровно один раз с размером группы, а общий итог — ровно один раз; не повторяй число на группу в отдельной общей фразе. В подтверждающем фрагменте могут быть числа организаций, административных единиц или мест; они не входят в этот ответ и должны быть опущены, если вопрос отдельно не запрашивает охват. Запрошенный охват указывай отдельно со своей единицей."
            ].join("\n")
          : [
              ...relationLines,
              "Need väärtused tulevad valitud põhiallika ühest selgest ühtlase rühmasuuruse seosest. Vasta ainult osalejarühmade suuruste ja sama valimi inimeste koguarvuga. Kui küsimus nimetab osalejarühmad, kasuta ainult iga kasutaja küsitud rühma nimetust (vajadusel käändes) ja selle osalejate arvu; ära pikenda rühmanimetust ülesannete, tegevuste, allikast lisatud täpsustuste ega kirjeldavate kõrvallausetega. Kui küsimus küsib kõiki rühmi neid ette nimetamata, esita kõik sama tõendiseosega hõlmatud rühmad ja säilita iga rühma eristamiseks vajalik allikapõhine rühma- või rollinimi. Esita iga kaasatud rühm täpselt ühe korra koos rühma suurusega ning koguarv täpselt ühe korra; ära korda rühma kohta käivat arvu eraldi üldlauses. Toetavas tõendis võivad esineda organisatsioonide, haldusüksuste või asukohtade katvusarvud; need ei kuulu sellesse vastuseulatusse ja tuleb välja jätta, kui küsimus katvust eraldi ei küsi. Küsitud katvus esita eraldi ning oma ühikuga."
            ].join("\n");
      return {
        instruction,
        trace: {
          version: "uniform_participant_relation_v4",
          enabled: true,
          source: "selected_evidence",
          relation_type: "uniform_participant_groups",
          participant_count_per_group: relation.perGroupValue,
          total_participant_count: relation.totalValue,
          participant_group_count: relation.groupCardinality || null,
          supporting_sentence_included: true,
          source_id: String(group?.sourceId || group?.source_id || group?.id || "").trim() || null,
          document_id: String(group?.docId || group?.documentId || group?.document_id || "").trim() || null
        }
      };
    }
  }
  return { instruction: "", trace: null };
}

function sourceAliasKeysForUrlMerge(source = {}) {
  const keys = [];
  const canonicalId = String(source?.canonical_item_id || source?.canonicalItemId || "").trim();
  if (canonicalId) keys.push(`canonical:${canonicalId}`);
  const title = normalizeDisplayAliasText(source?.title || source?.label || source?.short_ref);
  const muni = String(source?.municipality_id || source?.municipalityId || "").trim();
  const type = normalizeDisplayAliasText(source?.sourceType || source?.source_type || source?.resourceType || source?.resource_type);
  if (title && muni) keys.push(`title-muni:${muni}:${title}`);
  if (title && muni && type) keys.push(`title-muni-type:${muni}:${type}:${title}`);
  return keys;
}

function uniqueIds(values = []) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const id = String(value || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function hashRenderedText(value = "") {
  const text = String(value || "");
  if (!text) return null;
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function cleanContextText(value = "", maxLength = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 3)).trim()}...` : text;
}

function municipalityContactScope(municipalities = []) {
  const ids = uniqueIds(
    (Array.isArray(municipalities) ? municipalities : [])
      .flatMap((item) => [item?.id, item?.municipalityId, item?.municipality_id])
  );
  const names = uniqueIds(
    (Array.isArray(municipalities) ? municipalities : [])
      .flatMap((item) => [
        item?.displayName,
        item?.municipalityName,
        item?.name,
        item?.baseName && item?.type
          ? `${item.baseName} ${String(item.type).toLowerCase()}`
          : ""
      ])
  );
  return { ids, names };
}

export function excludeSupersededKovContactMatches(
  matches = [],
  serviceMapContacts = [],
  municipalities = [],
  { suppressUnscoped = false } = {}
) {
  if (!Array.isArray(matches)) return matches;
  const contactScope = Array.isArray(serviceMapContacts) && serviceMapContacts.length
    ? serviceMapContacts
    : municipalities;
  const { ids, names } = municipalityContactScope(contactScope);
  const hasMunicipalityScope = ids.length > 0 || names.length > 0;
  if (!hasMunicipalityScope && !suppressUnscoped) return matches;
  const municipalityIds = new Set(ids.map((value) => String(value).trim().toLowerCase()));
  const municipalityNames = new Set(names.map((value) => normalizeIntentText(value)));

  return matches.filter((entry) => {
    const itemType = String(entry?.itemType || entry?.item_type || "").trim().toLowerCase();
    const sourceType = String(entry?.sourceType || entry?.source_type || "").trim().toLowerCase();
    const isContactSource = itemType === "contact" ||
      itemType === "official_contact" ||
      sourceType === "contact" ||
      sourceType === "contacts" ||
      sourceType === "official_contact" ||
      sourceType === "contact_page";
    if (!isContactSource) return true;
    if (!hasMunicipalityScope) return false;
    const municipalityId = String(entry?.municipalityId || entry?.municipality_id || "").trim().toLowerCase();
    const municipalityName = normalizeIntentText(entry?.municipalityName || entry?.municipality_name || "");
    const superseded =
      (municipalityId && municipalityIds.has(municipalityId)) ||
      (municipalityName && municipalityNames.has(municipalityName));
    return !superseded;
  });
}

async function loadServiceMapKovContactsForMunicipalities(municipalities = []) {
  const { ids, names } = municipalityContactScope(municipalities);
  const or = [
    ...(ids.length ? [{ municipalityId: { in: ids } }] : []),
    ...names.map((name) => ({ municipalityName: { equals: name, mode: "insensitive" } }))
  ];
  if (!or.length) return [];
  const verificationProjection = await loadServiceMapContactVerificationProjection(prisma);
  const fullyVerifiedIds = new Set(verificationProjection.verifiedContactIds);
  const entries = await prisma.serviceMapEntry.findMany({
    where: {
      type: { in: SERVICE_MAP_CONTACT_TYPES },
      sourceNamespace: { in: SERVICE_MAP_VERIFIABLE_CONTACT_NAMESPACES },
      status: "PUBLISHED",
      tombstonedAt: null,
      sourceUrl: { not: null },
      AND: [
        verificationProjection.whereContactIdentity,
        { OR: or }
      ]
    },
    orderBy: [
      { type: "asc" },
      { title: "asc" }
    ],
    select: {
      id: true,
      type: true,
      title: true,
      description: true,
      municipalityId: true,
      municipalityName: true,
      county: true,
      address: true,
      phone: true,
      email: true,
      website: true,
      sourceUrl: true,
      updatedAt: true
    }
  });
  return entries.map(entry => {
    const fields = verificationProjection.contactFieldVerificationById[entry.id] || {};
    const fullyVerified = fullyVerifiedIds.has(entry.id);
    return {
      ...entry,
      description: fullyVerified ? entry.description : `Roll: ${contactRoleLabel(entry)}`,
      phone: fields.phone ? entry.phone : null,
      email: fields.email ? entry.email : null,
      address: fullyVerified ? entry.address : null,
      contactVerifiedAt: verificationProjection.verifiedIdentityAtById[entry.id] || null,
      contactFullyVerified: fullyVerified
    };
  });
}

const CONTACT_ROLE_UNKNOWN = "roll markimata";

function contactRoleLabel(entry = {}) {
  const description = String(entry?.description || "");
  const roleLine = description.match(/^\s*Roll:\s*(.+)$/mu);
  if (roleLine) return cleanContextText(roleLine[1], 80);
  const departmentLine = description.match(/^\s*Osakond:\s*(.+)$/mu);
  if (departmentLine) return cleanContextText(departmentLine[1], 80);
  return CONTACT_ROLE_UNKNOWN;
}

function decorateServiceMapKovContacts(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .filter(Boolean)
    .map((entry) => ({
      entry,
      role: contactRoleLabel(entry) || CONTACT_ROLE_UNKNOWN,
      municipality: cleanContextText(entry.municipalityName || entry.county, 80)
    }));
}

function contactRoleFamilyLabel(role = "") {
  return canonicalContactRoleFamilyLabel(cleanContextText(role, 80), CONTACT_ROLE_UNKNOWN);
}

function contactCountEntries(decorated = [], valueForItem = item => item.role) {
  const index = new Map();
  for (const item of decorated) {
    if (!index.has(item.municipality)) index.set(item.municipality, new Map());
    const values = index.get(item.municipality);
    const value = valueForItem(item) || CONTACT_ROLE_UNKNOWN;
    values.set(value, (values.get(value) || 0) + 1);
  }
  return [...index.entries()].flatMap(([municipality, values]) =>
    [...values.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "et"))
      .map(([label, count]) => ({ municipality, label, count }))
  );
}

function contactCountLines(decorated = [], valueForItem = item => item.role) {
  const byMunicipality = new Map();
  for (const entry of contactCountEntries(decorated, valueForItem)) {
    if (!byMunicipality.has(entry.municipality)) byMunicipality.set(entry.municipality, []);
    byMunicipality.get(entry.municipality).push(`${entry.label} (${entry.count})`);
  }
  return [...byMunicipality.entries()].map(([municipality, values]) =>
    `- ${[municipality, values.join(" · ")].filter(Boolean).join(": ")}`
  );
}

function serviceMapKovContactSummary(decorated = []) {
  const totals = new Map();
  for (const item of decorated) {
    totals.set(item.municipality, (totals.get(item.municipality) || 0) + 1);
  }
  return [
    "KOV_CONTACT_TOTAL (ametlikul lehel kinnitatud praeguste kontaktisikute arv, mitte kogu personali arv; sobimatu kontaktkanal on kontekstist eemaldatud):",
    ...[...totals.entries()].map(([municipality, count]) => `- ${municipality}: ${count}`),
    "KOV_CONTACT_ROLES (tapsete ametinimetuste arv):",
    ...contactCountLines(decorated),
    "KOV_CONTACT_ROLE_FAMILIES (sama valdkonna ametinimetused kokku):",
    ...contactCountLines(decorated, item => contactRoleFamilyLabel(item.role))
  ].join("\n");
}

function buildServiceMapKovContactEvidence(entries = [], options = {}) {
  const decorated = decorateServiceMapKovContacts(entries);
  const municipalityCounts = new Map();
  for (const item of decorated) {
    municipalityCounts.set(item.municipality, (municipalityCounts.get(item.municipality) || 0) + 1);
  }
  return {
    enabled: decorated.length > 0,
    totalCount: decorated.length,
    municipalities: [...municipalityCounts.entries()].map(([name, count]) => ({ name, count })),
    roles: contactCountEntries(decorated),
    roleFamilies: contactCountEntries(decorated, item => contactRoleFamilyLabel(item.role)),
    activeScope: options.activeScope ? {
      kind: options.activeScope.kind,
      contextual: options.activeScope.contextual === true,
      antecedentText: options.activeScope.antecedentText || "",
      anchoredSourceIds: options.activeScope.anchoredSourceIds || [],
      sourceIds: options.activeScope.sourceIds || [],
      count: options.activeScope.count,
      roles: options.activeScope.roles || [],
      roleFamilies: options.activeScope.roleFamilies || [],
      requestedRoleFamilies: options.activeScope.requestedRoleFamilies || []
    } : null,
    contacts: decorated.map(({ entry, role, municipality }) => ({
      sourceId: `service-map-contact:${entry.id}`,
      name: entry.title || "",
      role,
      roleFamily: contactRoleFamilyLabel(role),
      municipality,
      phone: entry.phone || "",
      email: entry.email || "",
      address: entry.address || "",
      verifiedAt: entry.contactVerifiedAt ? new Date(entry.contactVerifiedAt).toISOString() : null
    }))
  };
}

function serviceMapKovContactRow({ entry, role, municipality } = {}) {
  if (!entry) return "";
  const parts = [
    municipality,
    `roll: ${role || CONTACT_ROLE_UNKNOWN}`,
    cleanContextText(entry.title, 120),
    // Role already has its own field; keep only what it does not carry.
    cleanContextText(String(entry.description || "").replace(/^\s*Roll:.*$/mu, ""), 160),
    entry.phone ? `tel: ${cleanContextText(entry.phone, 80)}` : "",
    entry.email ? `email: ${cleanContextText(entry.email, 120)}` : "",
    entry.address ? `aadress: ${cleanContextText(entry.address, 140)}` : "",
    entry.website ? `veeb: ${cleanContextText(entry.website, 140)}` : "",
    entry.contactVerifiedAt ? `allikas kontrollitud: ${new Date(entry.contactVerifiedAt).toISOString().slice(0, 10)}` : ""
  ].filter(Boolean);
  return parts.length ? `- ${parts.join(" | ")}` : "";
}

function isCompleteKovContactListRequest(message = "") {
  const normalized = normalizeIntentText(message);
  if (/(?:^|[^\p{L}\p{N}])(?:kes\s+(?:nad|need)\s+on|mis\s+on\s+(?:(?:nende|kontakt\p{L}*)\s+)?(?:nimed|rollid|ametinimetused)|kontakt\p{L}*\s+nimed|(?:nende|neil)\s+(?:nimed|rollid|ametinimetused)|who\s+(?:are\s+)?they|what\s+are\s+(?:(?:their|contact\p{L}*)\s+)?(?:names|roles|job\s+titles)|contact\p{L}*\s+names|their\s+(?:names|roles|job\s+titles)|кто\s+они|как\s+их\s+зовут|какие\s+у\s+них\s+должности|имена\s+контакт\p{L}*|их\s+(?:имена|должности))(?=$|[^\p{L}\p{N}])/u.test(normalized)) return true;
  const allCue = /(?:^|[^\p{L}\p{N}])(?:koik|kogu\s+nimekir\p{L}*|loetle\p{L}*|nimeta\p{L}*|naita\p{L}*|millise\p{L}*|list\s+all|list|name\p{L}*|show\p{L}*|which|all|перечисл\p{L}*|назов\p{L}*|покаж\p{L}*|какие|все)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  const contactCue = /(?:^|[^\p{L}\p{N}])(?:kontakt\p{L}*|tootaj\p{L}*|spetsialist\p{L}*|ametnik\p{L}*|contact\p{L}*|employee\p{L}*|staff|specialist\p{L}*|контакт\p{L}*|сотрудник\p{L}*|специалист\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  return allCue && contactCue;
}

function isContactFreshnessRequest(message = "") {
  const normalized = normalizeIntentText(message);
  return /(?:^|[^\p{L}\p{N}])(?:varsk\p{L}*|ajakohas\p{L}*|kontrolli\p{L}*|kontrollit\p{L}*|kontrollkuupaev\p{L}*|millal\s+kontroll|kui\s+tihti|fresh\p{L}*|up\s+to\s+date|verif(?:y|ied|ication)\p{L}*|check\p{L}*|last\s+check\p{L}*|how\s+often|актуальн\p{L}*|свеж\p{L}*|провер\p{L}*|как\s+часто)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function isCurrentMunicipalContactPresenceRequest(normalized = "") {
  if (hasIndependentContactSourceCue(normalized)) return false;
  const asksPresence = /(?:^|[^\p{L}\p{N}])(?:kas|on|olemas|is|are|exists?|available|есть|имеется)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  const contactCue = /(?:^|[^\p{L}\p{N}])(?:kontakt\p{L}*|contact\p{L}*|контакт\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  return asksPresence && contactCue;
}

function contactRoleScopeMatches(entry = {}, normalizedMessage = "") {
  const role = contactRoleLabel(entry);
  const roleFamily = contactRoleFamilyLabel(role);
  return contactRoleQueryMatches(normalizedMessage, role, roleFamily);
}

function contactEntriesMatchingMessage(entries = [], message = "") {
  const normalized = normalizeIntentText(message);
  return entries.filter((entry) => {
    const title = normalizeIntentText(entry?.title);
    if (title && normalized.includes(title)) return true;
    return contactRoleScopeMatches(entry, normalized);
  });
}

function serviceMapContactSourceId(entry = {}) {
  return entry?.id ? `service-map-contact:${entry.id}` : "";
}

function contactEntryIdsFromSources(entries = [], sources = []) {
  const ids = new Set(contactSourceIdsFromSources(sources));
  return entries.filter(entry => ids.has(serviceMapContactSourceId(entry)));
}

function contactSourceIdsFromSources(sources = []) {
  return (Array.isArray(sources) ? sources : [])
    .map(source => String(source?.source_id || source?.sourceId || source?.id || "").trim())
    .filter(sourceId => sourceId.startsWith("service-map-contact:"));
}

function requestedContactRoleFamilyCounts(entries = [], selectorText = "") {
  const selections = contactRoleSemanticSelections(selectorText);
  if (!selections.length) return [];
  const decorated = decorateServiceMapKovContacts(entries);
  const municipalities = [...new Set(decorated.map(item => item.municipality))];
  return municipalities.flatMap(municipality => selections.map(selection => ({
    municipality,
    label: selection.label,
    count: decorated.filter(item =>
      item.municipality === municipality &&
      contactRoleFamilyLabel(item.role) === selection.label
    ).length
  })));
}

const CONTACT_SCOPE_GENERIC_TOKENS = new Set([
  "all", "ametnik", "ametnikud", "andmed", "anna", "are", "available", "can", "check", "checked", "contact", "contacts", "could", "current", "currently", "data", "date", "details", "do", "does", "email", "emails", "employee", "employees", "exist", "exists",
  "find", "for", "from", "get", "give", "has", "have", "hetkel", "how", "in", "info", "information", "is", "kas", "kes", "koik", "kontakt", "kontaktid", "kui", "last", "leia", "linn", "linnas", "list",
  "many", "me", "millal", "milline", "millised", "mitu", "mulle", "much", "name", "names", "nimed", "nimeta", "naita", "now", "number", "of", "often", "otsi", "palju", "palun", "phone", "phones", "please", "praegu", "present", "provide", "show", "sotsiaalosakond", "tell", "the", "tihti", "to", "total", "up", "verify", "verified", "viimati", "were", "what", "when", "would", "you",
  "sotsiaalosakonna", "sotsiaalvaldkond", "sotsiaalvaldkonna", "service", "services", "specialist", "specialists", "staff", "teenus", "teenused", "tootaja",
  "tootajad", "tootab", "tootavad", "vald", "vallas", "who", "work", "working", "worker", "workers", "social", "department",
  "avalik", "avalikud", "olemas", "nad", "need", "neid", "nendest", "them", "they", "these", "those", "there", "public", "automaatselt", "automatically", "автоматически", "всего", "где", "дай", "дайте", "данные", "есть", "имеется", "имена", "информация", "их", "когда", "количество", "мне", "можете", "можешь", "найди", "найдите", "них", "они", "пожалуйста", "последний", "последняя", "проверка", "работа", "работает",
  "работают", "работник", "работники", "сейчас", "сколько", "специалист", "специалисты", "сотрудник", "сотрудники", "услуга", "услуги", "часто", "эти"
]);

function contactScopeSelectorPresent(message = "", matches = [], entries = []) {
  if (matches.length) return true;
  const normalized = normalizeIntentText(message);
  if (hasContactRoleSemanticSelector(normalized)) return true;
  if (/(?:kelle\s+poole|kes[^.!?]{0,100}\btegeleb|who[^.!?]{0,100}\b(?:handles|deals\s+with)|кто[^.!?]{0,100}\bзанимается)/u.test(normalized)) return true;
  const locationNames = [...new Set((Array.isArray(entries) ? entries : [])
    .flatMap(entry => [entry?.municipalityName, entry?.county])
    .map(normalizeIntentText)
    .filter(Boolean))];
  const locationTokens = [...new Set(locationNames
    .flatMap(locationName => locationName.match(/[\p{L}\p{N}]+/gu) || [])
    .filter(token => token.length >= 4))];
  let selectorText = normalized;
  for (const locationName of locationNames) {
    selectorText = selectorText.replaceAll(locationName, " ");
  }
  const singularUntargetedContactField = /(?:^|[^\p{L}\p{N}])(?:telefon|phone|телефон|e-post|epost|e-mail|email)(?=$|[^\p{L}\p{N}])/u.test(selectorText);
  const meaningfulTokens = (normalizeContactRoleText(selectorText).match(/[\p{L}\p{N}]+/gu) || [])
    .filter(token => token.length >= 4)
    .filter(token => !CONTACT_SCOPE_GENERIC_TOKENS.has(token))
    .filter(token => !/^(?:tootaj|tootab|ametnik|spetsialist|employee|staff|worker|work|specialist|current|currently|praegu|hetkel|sotsiaalvaldk|sotsiaalosak|работа|работник|сотрудник|специалист|сейчас|текущ)/u.test(token))
    .filter(token => !/^(?:kontakt|contact|контакт|kontroll|varsk|ajakoh|verif|check|fresh|often|last|date|актуальн|свеж|провер|часто|последн)/u.test(token))
    .filter(token => !/^(?:telefon|phone|e-?post|email|meiliaadress|телефон|почт)/u.test(token))
    .filter(token => !/^(?:teenus|service|услуг)/u.test(token))
    .filter(token => !/^(?:koik|nait|nimet|loetl|millis|all|list|show|name|which|все|всех|покаж|перечисл|назов|какие)/u.test(token))
    .filter(token => !/^(?:social|department|социальн|отдел)/u.test(token))
    .filter(token => !/^(?:sotsiaalvaldk|sotsiaalosak)/u.test(token))
    .filter(token => !locationTokens.some(locationToken =>
      token.startsWith(locationToken) || locationToken.startsWith(token)
    ))
    .filter(token => !/^(?:linna|linnas|valla|vallas|omavalitsus|municipal|municipality|город|городе|волост)/u.test(token));
  return singularUntargetedContactField || meaningfulTokens.length > 0;
}

function resolveActiveContactScope(entries = [], message = "", history = [], { contextual = false } = {}) {
  const allEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];
  const currentMatches = contactEntriesMatchingMessage(allEntries, message);
  let scopedEntries = currentMatches;
  let selectorPresent = contactScopeSelectorPresent(message, currentMatches, allEntries);
  let selectorText = message;
  let antecedentText = "";
  let anchoredSourceIds = [];
  let exactAnchorUnavailable = false;

  if (contextual) {
    const anchorTurn = lastAssistantServiceMapContactTurn(history);
    antecedentText = contactAntecedentUserText(history, anchorTurn?.index);
    selectorText = antecedentText || message;
    const antecedentMatches = contactEntriesMatchingMessage(allEntries, antecedentText);
    selectorPresent = contactScopeSelectorPresent(antecedentText, antecedentMatches, allEntries);
    const rawAnchoredSourceIds = contactSourceIdsFromSources(anchorTurn?.sources);
    const anchoredIds = new Set(rawAnchoredSourceIds);
    const sourceMatches = contactEntryIdsFromSources(allEntries, anchorTurn?.sources);
    anchoredSourceIds = rawAnchoredSourceIds;
    if (antecedentMatches.length) {
      scopedEntries = anchoredIds.size
        ? antecedentMatches.filter(entry => anchoredIds.has(serviceMapContactSourceId(entry)))
        : antecedentMatches;
    } else if (anchoredIds.size) {
      scopedEntries = sourceMatches;
    }
    const resolvedAnchorIds = new Set(sourceMatches.map(serviceMapContactSourceId).filter(Boolean));
    exactAnchorUnavailable = anchoredIds.size > 0 &&
      [...anchoredIds].some(sourceId => !resolvedAnchorIds.has(sourceId));
    if (exactAnchorUnavailable) scopedEntries = [];
  }

  if (!scopedEntries.length && !selectorPresent && !exactAnchorUnavailable) scopedEntries = allEntries;
  const sourceIds = scopedEntries.map(serviceMapContactSourceId).filter(Boolean);
  const decorated = decorateServiceMapKovContacts(scopedEntries);
  const semanticSelections = contactRoleSemanticSelections(selectorText);
  return {
    kind: !scopedEntries.length
      ? semanticSelections.length && !exactAnchorUnavailable ? "known_zero" : "empty"
      : scopedEntries.length < allEntries.length ? "subset" : "all",
    contextual,
    antecedentText,
    anchoredSourceIds,
    sourceIds,
    count: scopedEntries.length,
    roles: contactCountEntries(decorated),
    roleFamilies: contactCountEntries(decorated, item => contactRoleFamilyLabel(item.role)),
    requestedRoleFamilies: requestedContactRoleFamilyCounts(allEntries, selectorText),
    entries: scopedEntries
  };
}

function serviceMapContactRowsForMessage(entries = [], message = "", { complete = false, activeScope = null } = {}) {
  const scopedEntries = Array.isArray(activeScope?.entries)
    ? activeScope.entries
    : entries;
  if (complete) return scopedEntries;
  const normalized = normalizeIntentText(message);
  if (
    isCurrentMunicipalStaffingCountFact(normalized) ||
    isCurrentMunicipalStaffingPresenceRequest(normalized)
  ) return [];
  return contactEntriesMatchingMessage(scopedEntries, message);
}

export function buildServiceMapKovContactContext(entries = [], options = {}) {
  const decorated = decorateServiceMapKovContacts(entries);
  if (!decorated.length) return "";

  const rowEntries = Array.isArray(options.rowEntries) ? options.rowEntries : entries;
  const rows = decorateServiceMapKovContacts(rowEntries)
    .slice()
    .sort((a, b) =>
      a.municipality.localeCompare(b.municipality, "et") ||
      a.role.localeCompare(b.role, "et") ||
      String(a.entry.title || "").localeCompare(String(b.entry.title || ""), "et"))
    .map(serviceMapKovContactRow)
    .filter(Boolean);

  return [
    "SERVICE_MAP_KOV_CONTACTS:",
    serviceMapKovContactSummary(decorated),
    ...(options.activeScope ? [
      `KOV_CONTACT_ACTIVE_SCOPE: ${options.activeScope.kind} | count: ${options.activeScope.count} | contextual: ${options.activeScope.contextual ? "yes" : "no"}`,
      ...contactCountLines(decorateServiceMapKovContacts(options.activeScope.entries)),
      ...contactCountLines(
        decorateServiceMapKovContacts(options.activeScope.entries),
        item => contactRoleFamilyLabel(item.role)
      )
    ] : []),
    ...(rows.length ? ["KOV_CONTACT_LIST:", ...rows] : [])
  ].join("\n");
}

const KOV_CONTACT_MODE_INSTRUCTIONS_EN = {
  overview: "For a general municipal services, department, or 'what can you help me with' turn, use KOV_CONTACT_ROLES to describe which specialists this municipality actually has and what topic each role covers. Do not name one or two people, phone numbers, or email addresses as default contacts. End by asking which topic the person needs help with, so the next answer can name the specialist for that topic.",
  contacts: "The user is asking for a contact, a specialist, or the current count. KOV_CONTACT_TOTAL is the exact count of freshness-eligible public contact entries; describe it as that, not as a verified total headcount. Every count answer must include that total scope; when a role is requested, add the matching role or role-family count separately. If 'social workers' could mean either the whole social-department contact layer or literal social-work job titles, give both scoped counts from KOV_CONTACT_TOTAL and KOV_CONTACT_ROLE_FAMILIES. If the topic is clear, name every contact whose role covers that topic (for a child topic, all child welfare specialists), not just the first one. If the topic is not clear, list the roles from KOV_CONTACT_ROLES and ask which topic; when the user explicitly asks for all contacts, list them all grouped by role.",
  service: "When answering about a specific municipal service or benefit, add the contact whose role matches that topic (benefit -> benefits specialist, child topic -> child welfare specialist, care -> care manager). Do not fall back to the general social welfare specialist when KOV_CONTACT_ROLES contains a closer role; if no closer role exists, say the municipality assigns the specialist by topic."
};

const KOV_CONTACT_MODE_INSTRUCTIONS_ET = {
  overview: "KOV teenuste, osakonna voi uldise 'millega saad aidata' kusimuse puhul kirjelda KOV_CONTACT_ROLES pohjal, millised spetsialistid selles vallas voi linnas tegelikult on ja mis teemaga iga roll tegeleb. Ara nimeta uht-kaht inimest, telefoninumbrit ega e-posti vaikimisi kontaktina. Lopeta kusimusega, mis teemaga inimest aidata saab, et jargmine vastus saaks nimetada just selle teema spetsialisti.",
  contacts: "Kasutaja kusib kontakti, spetsialisti voi praegust arvu. KOV_CONTACT_TOTAL on varskuskontrolli labinud avalike kontaktikirjete tapne arv; nimeta seda nii, mitte kinnitatud kogu personali arvuna. Iga arvuvastus peab sisaldama seda koguarvu ja ulatust; kindla rolli kusimuse korral lisa rolli voi rollipere arv eraldi. Kui 'sotsiaaltootajad' voib tahendada nii kogu sotsiaalosakonna kontaktikihti kui ka otsese sotsiaaltoo ametinimetusega inimesi, anna molemad selge ulatusega arvud KOV_CONTACT_TOTAL-i ja KOV_CONTACT_ROLE_FAMILIES-i pohjal. Kui teema on teada, nimeta koik selle teema rolliga kontaktid (lapse teemal koik laste heaolu spetsialistid), mitte ainult esimest. Kui teema ei ole teada, loetle KOV_CONTACT_ROLES-i rollid ja kusi teemat; koigi kontaktide selge palve korral loetle koik kontaktid rollide kaupa.",
  service: "Konkreetse KOV teenuse voi toetuse vastuses lisa selle teemaga sobiva rolliga kontakt (toetus -> toetuste spetsialist, lapse teema -> laste heaolu spetsialist, hooldus -> hooldusjuht). Ara kasuta uldist sotsiaalhoolekandespetsialisti vaikevastusena, kui KOV_CONTACT_ROLES sisaldab teemale tapsemat rolli; kui tapsemat rolli ei ole, utle, et sobiva spetsialisti maarab KOV teema jargi."
};

const KOV_CONTACT_MODE_INSTRUCTIONS_RU = {
  overview: "Для общего вопроса об услугах или отделе опиши по KOV_CONTACT_ROLES, какие специалисты действительно указаны у муниципалитета и за какие темы отвечает каждая роль. Не называй по умолчанию одного-двух людей и их контакты. В конце уточни тему обращения.",
  contacts: "Пользователь спрашивает контакт, специалиста или текущее количество. KOV_CONTACT_TOTAL — точное число прошедших проверку публичных контактных записей, а не подтвержденная общая численность персонала. Каждый ответ с количеством должен включать это общее число и его точный охват; для конкретной роли отдельно добавь число роли или группы ролей. Если слово 'социальные работники' может означать весь контактный слой социального отдела или только должности с социальным работником в названии, приведи оба числа с ясным пояснением по KOV_CONTACT_TOTAL и KOV_CONTACT_ROLE_FAMILIES. Для конкретной темы назови все подходящие контакты; при явном запросе всех контактов перечисли их по ролям.",
  service: "В ответе о конкретной муниципальной услуге или пособии добавь контакт с наиболее подходящей ролью. Не подменяй его общим специалистом, если KOV_CONTACT_ROLES содержит более точную роль."
};

export function buildServiceMapKovContactInstruction(replyLang = "et", options = {}) {
  const mode = KOV_CONTACT_MODE_INSTRUCTIONS_ET[options.mode] ? options.mode : "service";
  if (replyLang === "en") {
    return [
      "SERVICE_MAP_CONTACT_MODE:",
      "When the user's municipality is known and SERVICE_MAP_KOV_CONTACTS is present, use those entries as the authoritative municipal contact layer.",
      "Do not say municipal contacts are missing when that block contains phone or email data.",
      "KOV_CONTACT_ROLES lists the professional roles this municipality really has. Do not narrow the answer down to one or two generic job titles when more roles exist.",
      KOV_CONTACT_MODE_INSTRUCTIONS_EN[mode]
    ].join("\n");
  }
  if (replyLang === "ru") {
    return [
      "SERVICE_MAP_CONTACT_MODE:",
      "Если муниципалитет пользователя известен и есть SERVICE_MAP_KOV_CONTACTS, используй эти записи как авторитетный слой муниципальных контактов.",
      "Не утверждай, что контактов нет, если в блоке указан телефон или электронная почта.",
      "Не используй историческую численность персонала из статьи как текущее количество контактов.",
      "KOV_CONTACT_ROLES показывает фактические публичные должности муниципалитета; не сужай ответ до одной-двух общих ролей.",
      KOV_CONTACT_MODE_INSTRUCTIONS_RU[mode]
    ].join("\n");
  }
  return [
    "SERVICE_MAP_CONTACT_MODE:",
    "Kui kasutaja KOV on teada ja SERVICE_MAP_KOV_CONTACTS on olemas, kasuta neid kirjeid KOV kontaktide autoriteetse kontaktikihina.",
    "Ara utle, et KOV kontaktid puuduvad, kui selles plokis on telefon voi e-post.",
    "Ara kasuta praeguse kontaktide arvu jaoks ajaloolise artikli personaliarvu.",
    "KOV_CONTACT_ROLES naitab, millised ametirollid selles KOV-is tegelikult olemas on. Ara ahenda vastust kahe uldnimetusega inimeseni, kui rolle on rohkem.",
    KOV_CONTACT_MODE_INSTRUCTIONS_ET[mode]
  ].join("\n");
}

function contactReplyIntent(message = "") {
  const normalized = normalizeIntentText(message);
  return {
    numeric: /(?:^|[^\p{L}\p{N}])(?:mitu|kui\s+palju|how\s+many|number\s+of|сколько|число)(?=$|[^\p{L}\p{N}])/u.test(normalized),
    identity: /(?:^|[^\p{L}\p{N}])(?:kes|millise\p{L}*|nimeta\p{L}*|loetle\p{L}*|naita\p{L}*|kontakt\p{L}*\s+nimed|(?:nende|neil)\s+(?:nimed|rollid|ametinimetused)|mis\s+on\s+nende\s+(?:nimed|rollid|ametinimetused)|who|which|name\p{L}*|list\p{L}*|show\p{L}*|contact\p{L}*\s+names|their\s+(?:names|roles|job\s+titles)|what\s+are\s+their\s+(?:names|roles|job\s+titles)|кто|какие|назов\p{L}*|перечисл\p{L}*|покаж\p{L}*|имена\s+контакт\p{L}*|как\s+их\s+зовут|какие\s+у\s+них\s+должности|их\s+(?:имена|должности))(?=$|[^\p{L}\p{N}])/u.test(normalized),
    phone: /(?:^|[^\p{L}\p{N}])(?:telefon\p{L}*|phone\p{L}*|телефон\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized),
    email: /(?:^|[^\p{L}\p{N}])(?:e-post\p{L}*|epost\p{L}*|e-mail\p{L}*|email\p{L}*|meiliaadress\p{L}*|почт\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized),
    details: /(?:^|[^\p{L}\p{N}])(?:kontaktandm\p{L}*|kontaktinfo\p{L}*|contact\s+(?:details?|information)|контактн\p{L}*\s+(?:данн\p{L}*|информац\p{L}*))(?=$|[^\p{L}\p{N}])/u.test(normalized),
    freshness: isContactFreshnessRequest(normalized),
    presence: isCurrentMunicipalStaffingPresenceRequest(normalized) ||
      isCurrentMunicipalContactPresenceRequest(normalized)
  };
}

function supportsDeterministicContactReply(message = "") {
  const intent = contactReplyIntent(message);
  return Object.values(intent).some(Boolean) ||
    hasContactRequestTerm(normalizeIntentText(message));
}

function contactScopeLabel(scope = null) {
  const families = (Array.isArray(scope?.roleFamilies) ? scope.roleFamilies : [])
    .map(entry => String(entry?.label || "").trim())
    .filter(Boolean);
  if (families.length) return [...new Set(families)].join(", ");
  const requestedFamilies = (Array.isArray(scope?.requestedRoleFamilies) ? scope.requestedRoleFamilies : [])
    .map(entry => String(entry?.label || "").trim())
    .filter(Boolean);
  if (requestedFamilies.length) return [...new Set(requestedFamilies)].join(", ");
  const roles = (Array.isArray(scope?.roles) ? scope.roles : [])
    .map(entry => String(entry?.label || "").trim())
    .filter(Boolean);
  return [...new Set(roles)].join(", ");
}

function deterministicContactListLines(entries = [], replyLang = "et", intent = {}) {
  return decorateServiceMapKovContacts(entries)
    .slice()
    .sort((left, right) =>
      left.role.localeCompare(right.role, "et") ||
      String(left.entry.title || "").localeCompare(String(right.entry.title || ""), "et"))
    .map(({ entry, role }) => {
      const values = [];
      if (intent.phone || intent.details) {
        values.push(replyLang === "ru" ? `телефон: ${entry.phone || "—"}` : `tel: ${entry.phone || "—"}`);
      }
      if (intent.email || intent.details) {
        values.push(replyLang === "ru" ? `эл. почта: ${entry.email || "—"}` : `e-post: ${entry.email || "—"}`);
      }
      return `- **${entry.title}** — ${role}${values.length ? `; ${values.join("; ")}` : ""}`;
    });
}

function buildDeterministicServiceMapContactReply({
  message = "",
  replyLang = "et",
  entries = [],
  activeScope = null,
  loadState = "not_requested"
} = {}) {
  if (loadState !== "resolved" || !entries.length) {
    if (replyLang === "en") return "The requested current contact details could not be confirmed from the freshness-verified municipal contact registry.";
    if (replyLang === "ru") return "Запрошенные актуальные контактные данные не удалось подтвердить по проверенному на свежесть реестру контактов муниципалитета.";
    return "Küsitud praeguseid kontaktandmeid ei õnnestunud värskuskontrollitud KOV-i kontaktiregistrist kinnitada.";
  }

  const intent = contactReplyIntent(message);
  const scopedEntries = Array.isArray(activeScope?.entries)
    ? activeScope.entries
    : entries;
  const municipality = cleanContextText(entries[0]?.municipalityName || entries[0]?.county, 80);
  const scopeLabel = contactScopeLabel(activeScope);
  if (activeScope?.kind === "known_zero") {
    if (replyLang === "en") {
      return `No. The freshness-verified public contact registry has 0 records in the requested “${scopeLabel || "role or topic"}” scope for ${municipality}. This does not prove that the municipality has no such employee outside the public contact layer.`;
    }
    if (replyLang === "ru") {
      return `Нет. В проверенном на свежесть реестре публичных контактов для ${municipality} есть 0 записей в запрошенной группе «${scopeLabel || "должность или тема"}». Это не доказывает, что вне публичного контактного слоя у муниципалитета нет такого сотрудника.`;
    }
    return `Ei. Värskuskontrollitud avalikus kontaktiregistris on ${municipality} kohta küsitud „${scopeLabel || "rolli või teema"}” alamhulgas 0 kirjet. See ei tõenda, et KOV-is pole väljaspool avalikku kontaktikihti sellist töötajat.`;
  }
  if (activeScope?.kind === "empty") {
    if (replyLang === "en") return "The requested current contact details could not be confirmed from the freshness-verified municipal contact registry.";
    if (replyLang === "ru") return "Запрошенные актуальные контактные данные не удалось подтвердить по проверенному на свежесть реестру контактов муниципалитета.";
    return "Küsitud praeguseid kontaktandmeid ei õnnestunud värskuskontrollitud KOV-i kontaktiregistrist kinnitada.";
  }
  const scopeIsSubset = activeScope?.kind === "subset";
  const lines = [];
  const verifiedDates = [...new Set(scopedEntries
    .map(entry => entry?.contactVerifiedAt ? new Date(entry.contactVerifiedAt).toISOString().slice(0, 10) : "")
    .filter(Boolean))].sort();

  if (intent.freshness && verifiedDates.length) {
    const dateText = verifiedDates.length === 1
      ? verifiedDates[0]
      : `${verifiedDates[0]}–${verifiedDates.at(-1)}`;
    if (replyLang === "en") {
      lines.push(`SotsiaalAI's contact-source check is scheduled weekly. The source details for the requested public contact records were last verified on ${dateText}. This verifies the match with the source page, not the municipality's complete staff roster.`);
    } else if (replyLang === "ru") {
      lines.push(`Проверка источников контактов SotsiaalAI настроена на еженедельный запуск. Данные источников запрошенных публичных контактных записей в последний раз подтверждены ${dateText}. Это подтверждает соответствие странице-источнику, но не полный штат муниципалитета.`);
    } else {
      lines.push(`SotsiaalAI kontaktiallikate kontroll on seadistatud käima kord nädalas. Küsitud avalike kontaktikirjete allikaandmed kontrolliti viimati ${dateText}. See kinnitab vastavust allikalehele, mitte KOV-i täielikku personalikoosseisu.`);
    }
  }

  const requestedRoleFamilyCounts = intent.numeric && activeScope
    ? (Array.isArray(activeScope.requestedRoleFamilies) ? activeScope.requestedRoleFamilies : [])
    : [];

  if (replyLang === "en") {
    if (intent.presence) lines.push("Yes.");
    if (intent.numeric || intent.presence) {
      if (activeScope?.contextual) {
        lines.push(`The preceding role or topic scope contains ${scopedEntries.length} freshness-verified public contact records; this is not a confirmed staff headcount.`);
      } else {
        lines.push(`The Service Map has ${entries.length} freshness-verified public contact records for ${municipality}; this is not a confirmed staff headcount.`);
        if (scopeIsSubset) lines.push(`The requested “${scopeLabel || "role or topic"}” scope contains ${scopedEntries.length} public contact records.`);
      }
    }
  } else if (replyLang === "ru") {
    if (intent.presence) lines.push("Да.");
    if (intent.numeric || intent.presence) {
      if (activeScope?.contextual) {
        lines.push(`В предыдущей группе должностей или тем есть ${scopedEntries.length} проверенных на свежесть публичных контактных записей; это не является подтвержденной общей численностью сотрудников.`);
      } else {
        lines.push(`В Teenusekaart для ${municipality} есть ${entries.length} проверенных на свежесть публичных контактных записей; это не является подтвержденной общей численностью сотрудников.`);
        if (scopeIsSubset) lines.push(`К запрошенной группе «${scopeLabel || "должность или тема"}» относятся ${scopedEntries.length} публичных контактных записей.`);
      }
    }
  } else {
    if (intent.presence) lines.push("Jah.");
    if (intent.numeric || intent.presence) {
      if (activeScope?.contextual) {
        lines.push(`Eelmises rolli- või teemaalamhulgas on ${scopedEntries.length} värskuskontrollitud avalikku kontaktikirjet; see ei ole kinnitatud töötajate koguarv.`);
      } else {
        lines.push(`Teenusekaardil on ${municipality} kohta ${entries.length} värskuskontrollitud avalikku kontaktikirjet; see ei ole kinnitatud kogu personali arv.`);
        if (scopeIsSubset) lines.push(`Küsitud „${scopeLabel || "rolli või teema"}” alamhulka kuulub ${scopedEntries.length} avalikku kontaktikirjet.`);
      }
    }
  }

  if (requestedRoleFamilyCounts.length > 1 || (requestedRoleFamilyCounts.length === 1 && !scopeIsSubset)) {
    for (const roleFamily of requestedRoleFamilyCounts) {
      if (replyLang === "en") {
        lines.push(`The “${roleFamily.label}” role family contains ${roleFamily.count} public contact records.`);
      } else if (replyLang === "ru") {
        lines.push(`К группе должностей «${roleFamily.label}» относятся ${roleFamily.count} публичных контактных записей.`);
      } else {
        lines.push(`Rolliperes „${roleFamily.label}” on ${roleFamily.count} avalikku kontaktikirjet.`);
      }
    }
  }

  const shouldList = intent.identity || intent.phone || intent.email || intent.details ||
    (!intent.numeric && !intent.presence && !intent.freshness);
  if (shouldList) lines.push(...deterministicContactListLines(scopedEntries, replyLang, intent));
  return lines.filter(Boolean).join("\n\n");
}

function buildServiceMapKovContactSources(entries = []) {
  return decorateServiceMapKovContacts(entries).map((decorated) => {
    const { entry } = decorated;
    return {
      id: `service-map-contact:${entry.id}`,
      source_id: `service-map-contact:${entry.id}`,
      sourceId: `service-map-contact:${entry.id}`,
      title: entry.title || entry.municipalityName || "KOV kontakt",
      url: entry.sourceUrl || entry.website || undefined,
      source_url: entry.sourceUrl || undefined,
      sourceUrl: entry.sourceUrl || undefined,
      collectionId: "service_map",
      collection_id: "service_map",
      sourceType: "service_map_contact",
      source_type: "service_map_contact",
      municipality_id: entry.municipalityId || undefined,
      municipality_name: entry.municipalityName || undefined,
      last_checked: entry.contactVerifiedAt || undefined,
      short_ref: entry.title || entry.municipalityName || "KOV kontakt",
      evidenceText: serviceMapKovContactRow(decorated)
    };
  });
}

const SERVICE_MAP_CONTACT_MONITOR_SOURCE_ID = "service-map-contact-monitor";

function buildServiceMapContactMonitorSource(replyLang = "et") {
  const title = replyLang === "en"
    ? "Service Map contact-source monitoring"
    : replyLang === "ru"
      ? "Мониторинг источников контактов Карты услуг"
      : "Teenusekaardi kontaktiallikate kontroll";
  const evidenceText = replyLang === "en"
    ? "SotsiaalAI checks published municipal contact source pages automatically once a week."
    : replyLang === "ru"
      ? "SotsiaalAI автоматически проверяет страницы-источники опубликованных контактов самоуправлений раз в неделю."
      : "SotsiaalAI kontrollib avaldatud KOV-kontaktide allikalehti automaatselt kord nädalas.";
  return {
    id: SERVICE_MAP_CONTACT_MONITOR_SOURCE_ID,
    source_id: SERVICE_MAP_CONTACT_MONITOR_SOURCE_ID,
    sourceId: SERVICE_MAP_CONTACT_MONITOR_SOURCE_ID,
    title,
    url: "https://sotsiaal.ai/teenusekaart",
    source_url: "https://sotsiaal.ai/teenusekaart",
    sourceUrl: "https://sotsiaal.ai/teenusekaart",
    collectionId: "service_map",
    collection_id: "service_map",
    sourceType: "service_map_contact_monitor",
    source_type: "service_map_contact_monitor",
    short_ref: title,
    evidenceText
  };
}

function buildDeterministicContactMonitorReply(replyLang = "et") {
  if (replyLang === "en") {
    return "Yes. SotsiaalAI checks published municipal contact source pages automatically once a week.";
  }
  if (replyLang === "ru") {
    return "Да. SotsiaalAI автоматически проверяет страницы-источники опубликованных контактов самоуправлений раз в неделю.";
  }
  return "Jah. SotsiaalAI kontrollib avaldatud KOV-kontaktide allikalehti automaatselt kord nädalas.";
}

function buildDeterministicContactMunicipalityClarification(replyLang = "et") {
  if (replyLang === "en") {
    return "Please specify the municipality or city. Without that scope, I cannot confirm a current public contact from the freshness-verified municipal contact registry.";
  }
  if (replyLang === "ru") {
    return "Уточните, пожалуйста, волость или город. Без этого охвата я не могу подтвердить актуальный публичный контакт по проверенному на свежесть муниципальному реестру.";
  }
  return "Palun täpsusta vald või linn. Ilma selle ulatuseta ei saa ma värskuskontrollitud KOV-i kontaktiregistrist praegust avalikku kontakti kinnitada.";
}

function displaySourceIdForContextEntry(entry = {}, idx = 0) {
  const sourceType = String(entry.sourceType || "").trim();
  if (/^(national_law|law|kov_regulation|regulation|riigiteataja_regulation)$/.test(sourceType)) {
    return String(entry.key || entry.chunkId || entry.canonicalItemId || entry.sourceId || `source-${idx}`).trim();
  }
  return String(entry.sourceId || entry.key || entry.docId || entry.articleId || entry.url || entry.fileName || `source-${idx}`).trim();
}

function packageDisplayedSourcesFromPackages(sourcePackages = [], allowedIds = []) {
  const allowed = new Set((Array.isArray(allowedIds) ? allowedIds : [])
    .map(value => String(value || "").trim())
    .filter(Boolean));
  if (!allowed.size) return [];

  const seen = new Set();
  const out = [];

  for (const pkg of Array.isArray(sourcePackages) ? sourcePackages : []) {
    const sections = pkg?.sections && typeof pkg.sections === "object" ? pkg.sections : {};
    for (const [section, list] of Object.entries(sections)) {
      if (!Array.isArray(list)) continue;
      for (const source of list) {
        const id = String(source?.source_id || "").trim();
        if (!id || !allowed.has(id) || seen.has(id)) continue;
        seen.add(id);
        const url = displayedSourceUrl(source);
        out.push({
          id,
          source_id: id,
          sourceId: id,
          title: source.title || pkg.title || pkg.canonical_item_id || id,
          url: url
            ? displayUrl(url)
            : undefined,
          url_canonical: source.url_canonical || undefined,
          urlCanonical: source.urlCanonical || undefined,
          source_url: source.source_url || undefined,
          sourceUrl: source.sourceUrl || undefined,
          official_url: source.official_url || undefined,
          officialUrl: source.officialUrl || undefined,
          collectionId: source.collection_id || undefined,
          collection_id: source.collection_id || undefined,
          sourceType: source.source_type || undefined,
          source_type: source.source_type || undefined,
          authority: source.authority || undefined,
          municipality_id: source.municipality_id || pkg.municipality_id || undefined,
          municipality_name: source.municipality_name || pkg.municipality_name || undefined,
          source_status: source.source_status || undefined,
          last_checked: source.last_checked || pkg.last_checked || undefined,
          historical: source.historical === true ? true : undefined,
          canonical_item_id: pkg.canonical_item_id || undefined,
          canonicalItemId: pkg.canonical_item_id || undefined,
          item_type: source.item_type || undefined,
          itemType: source.item_type || undefined,
          resource_type: source.resource_type || undefined,
          resourceType: source.resource_type || undefined,
          section,
          evidence_strength: source.evidence_strength || undefined,
          short_ref: source.title || pkg.title || undefined,
          evidenceText: source.title || pkg.title || ""
        });
      }
    }
  }

  return out;
}

export function mergePackageDisplayedSources(existingSources = [], packageSources = []) {
  const out = Array.isArray(existingSources) ? existingSources.slice() : [];
  const indexById = new Map();
  const indexByAlias = new Map();
  out.forEach((source, index) => {
    const id = stableSourceIdFromDisplaySource(source, index);
    if (id && !indexById.has(id)) indexById.set(id, index);
    for (const alias of sourceAliasKeysForUrlMerge(source)) {
      if (!indexByAlias.has(alias)) indexByAlias.set(alias, index);
    }
  });

  for (const packageSource of Array.isArray(packageSources) ? packageSources : []) {
    const id = stableSourceIdFromDisplaySource(packageSource);
    if (!id) continue;
    const existingIndex = indexById.get(id) ??
      sourceAliasKeysForUrlMerge(packageSource)
        .map(alias => indexByAlias.get(alias))
        .find(index => typeof index === "number");
    if (typeof existingIndex !== "number") {
      indexById.set(id, out.length);
      for (const alias of sourceAliasKeysForUrlMerge(packageSource)) {
        if (!indexByAlias.has(alias)) indexByAlias.set(alias, out.length);
      }
      out.push(packageSource);
      continue;
    }
    const existing = out[existingIndex] || {};
    const existingUrl = displayedSourceUrl(existing);
    const packageUrl = displayedSourceUrl(packageSource);
    if (!existingUrl && packageUrl) {
      out[existingIndex] = {
        ...packageSource,
        ...existing,
        url: displayUrl(packageUrl),
        url_canonical: existing.url_canonical || packageSource.url_canonical || undefined,
        urlCanonical: existing.urlCanonical || packageSource.urlCanonical || undefined,
        source_url: existing.source_url || packageSource.source_url || undefined,
        sourceUrl: existing.sourceUrl || packageSource.sourceUrl || undefined,
        official_url: existing.official_url || packageSource.official_url || undefined,
        officialUrl: existing.officialUrl || packageSource.officialUrl || undefined
      };
    }
  }

  return out;
}

export function buildRagSearchErrorPayload({
  err,
  userId,
  role,
  isCrisis,
  stage = "rag_search",
  optional = false,
  queryPlan,
  selectionStrategy,
  topK,
  conversationId
} = {}) {
  const rawMessage = String(err?.message || "rag search error").trim();
  return {
    userId,
    role,
    isCrisis,
    stage,
    optional,
    error_message: rawMessage.slice(0, 240),
    queryPlanMode: queryPlan?.mode,
    queryPlanSelectionStrategy: selectionStrategy || queryPlan?.selection_strategy,
    queryPlanQueryOrder: queryPlan?.query_order,
    query_plan: queryPlan
      ? {
          mode: queryPlan.mode,
          query_order: queryPlan.query_order,
          selection_strategy: queryPlan.selection_strategy,
          query_count: queryPlan.query_count,
          rag_top_k: queryPlan.rag_top_k
        }
      : undefined,
    top_k: topK,
    conversation_id: conversationId
  };
}

async function logRagSearchError({
  err,
  event = "rag_error",
  logError,
  logEvent,
  userId,
  role,
  isCrisis,
  stage,
  optional,
  queryPlan,
  selectionStrategy,
  topK,
  conversationId
} = {}) {
  const payload = buildRagSearchErrorPayload({
    err,
    userId,
    role,
    isCrisis,
    stage,
    optional,
    queryPlan,
    selectionStrategy,
    topK,
    conversationId
  });
  if (typeof logError === "function") {
    logError(optional ? "rag.search.optional_error" : "rag.search.error", {
      err: payload.error_message,
      stage,
      optional,
      role,
      userId,
      conversationId,
      queryPlanMode: queryPlan?.mode,
      queryPlanSelectionStrategy: selectionStrategy || queryPlan?.selection_strategy
    });
  }
  if (typeof logEvent === "function") {
    await logEvent(event, payload);
  }
}

function hasServiceTerm(normalized = "") {
  return /\b[a-z0-9]*teenus[a-z0-9]*\b/u.test(normalized) ||
    /(?:^|[^\p{L}\p{N}])(?:sotsiaaltransport\p{L}*|koduabi\p{L}*|tugiisik\p{L}*|lapsehoid\p{L}*|uldhooldus\p{L}*|üldhooldus\p{L}*|varjupaik\p{L}*|volanoust\p{L}*|võlanõust\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function hasBenefitTerm(normalized = "") {
  return /\b[a-z0-9]*toetus[a-z0-9]*\b/u.test(normalized);
}

function hasAnyServiceOrBenefitTerm(normalized = "") {
  return hasServiceTerm(normalized) ||
    hasBenefitTerm(normalized) ||
    /(?:^|[^\p{L}\p{N}])(?:service\p{L}*|benefit\p{L}*|support\s+scheme\p{L}*|услуг\p{L}*|пособ\p{L}*|социальн\p{L}*\s+помощ\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function hasTargetGroupTerm(normalized = "") {
  return /\b(laps|lapse|lapsel|lapsele|lapsega|lapsed|laste|lastel|lastega|alaealine|alaealisele|pere|perel|perele|perega|vanem|vanemal|vanemale|eakas|eakal|eakale|eakaga|vanur|vanurile|puue|puudega|erivajadus|erivajadusega|hooldusvajadus|hooldusvajadusega|kriis|kriisis)\b/.test(normalized);
}

function isServiceJurisdictionClassificationQuestion(message = "") {
  const normalized = normalizeIntentText(message);
  if (!normalized || !hasServiceTerm(normalized)) return false;
  const mentionsJurisdiction = /\b(kov|kohalik|kohaliku|omavalitsus|omavalitsuse|riik|riigi|riiklik|riiklikud|riikliku)\b/.test(normalized);
  const asksClassification = /\b(kas|on|voi|või|kumma|kumb|kuulub|korraldab|vastutab|vastutus)\b/.test(normalized);
  return mentionsJurisdiction && asksClassification;
}

export function isNationalServiceBenefitQuestion(message = "") {
  const normalized = normalizeIntentText(message);
  if (!normalized) return false;
  const mentionsNationalLevel = /\b(riik|riigi|riiklik|riiklikud|riiklikke|shs|sotsiaalhoolekande seadus)\b/.test(normalized);
  const asksServiceOrBenefit = hasServiceTerm(normalized) || hasBenefitTerm(normalized);
  const asksListOrDefinition = /\b(mis|mida|millised|milliseid|loetle|nimeta|pakub|on|maara|maarab|reguleeri|reguleerib|sisalda|sisaldab|nimetab|saab|kohustus|kohustuse|kohustab|ulesanne|ulesanded|ülesanne|ülesanded|korralda|korraldab|korraldada|korraldamise|vastutab|vastutus)\b/.test(normalized);
  if (mentionsNationalLevel && asksServiceOrBenefit && asksListOrDefinition) return true;

  // Fee/condition questions about a concrete service or benefit are national
  // SHS-layer questions by default when no municipality is named. Municipality
  // routes are computed independently and keep priority in query-plan mode
  // selection, so a KOV-named fee question still takes the KOV route.
  const mentionsMunicipality = /\b(vald|valla|vallas|linn|linna|linnas|omavalitsus|omavalitsuse|kov)\b/.test(normalized);
  const asksFeeOrCondition = /\b(omaosalus|omaosaluse|omaosalust|tasu|tasud|tasuline|tasuta|hind|hinna|hinnad|maksab|maksumus|maksma)\b/.test(normalized);
  return !mentionsMunicipality && asksServiceOrBenefit && asksFeeOrCondition;
}

function isNationalServiceBenefitFollowup(message = "", history = []) {
  const normalized = normalizeIntentText(message).replace(/[.!?\s]+$/g, "");
  if (!/^(jah|jaa|jep|ok|okei|palun|sobib|1|2|3)$/.test(normalized)) return false;
  const recent = extractRecentUserText(history, 4).join("\n");
  return isNationalServiceBenefitQuestion(recent);
}

export function shouldCarryMunicipalityFromHistory(message = "") {
  const normalized = normalizeIntentText(message);
  if (!normalized) return false;
  const compact = normalized.replace(/[.!?\s]+$/g, "");
  if (/^(jah|jaa|jep|ok|okei|palun|sobib|1|2|3)$/.test(compact)) return true;

  const explicitLocationReference =
    /\b(seal|sealt|sinna|samas|selles vallas|selles linnas|selles omavalitsuses)\b/.test(normalized);
  if (explicitLocationReference) return true;

  // A new legal, research, document or numeric-fact question is an independent
  // retrieval turn even when its wording contains a social-service or target-
  // group term. Carrying the previous municipality here silently scopes away
  // the requested national or journal evidence.
  const independentSourceQuestion =
    /\b(shs|sotsiaalhoolekande seadus|paragrahv|uuring|uuringus|uuringu|aruanne|aruandes|artikl\w*|kaardistus\w*|intervjuu\w*|protsent\w*|jareldus\w*|järeldus\w*|autor\w*|aasta)\b/.test(normalized) ||
    normalized.includes("§");
  if (independentSourceQuestion) return false;

  const continuationLead = /^(aga|ja|ning|ent|veel)\b/.test(normalized);
  const contextDependentTurn = isContextDependentRetrievalTurn(message);
  const serviceOrBenefit = hasServiceTerm(normalized) || hasBenefitTerm(normalized);
  if (serviceOrBenefit && (continuationLead || contextDependentTurn)) return true;

  const socialHelpTerm =
    /\b(abi|sotsiaalabi|abi liigid|sotsiaalteenus|sotsiaalteenused|sotsiaalteenuseid|sotsiaaltoetus|sotsiaaltoetused|sotsiaaltoetusi)\b/.test(normalized);
  if (socialHelpTerm && (continuationLead || contextDependentTurn)) return true;
  if (hasTargetGroupTerm(normalized) && continuationLead && normalized.length <= 60) return true;

  if (normalized.length <= 40 && /\b(see|seda|selle|siin|too|need|neid|nende)\b/.test(normalized)) return true;
  return contextDependentTurn && /\b(kontakt|kontaktid|telefon|e-post|email|taotlus|taotlema)\b/.test(normalized);
}

function hasMunicipalStaffTerm(normalized = "") {
  return /(?:^|[^\p{L}\p{N}])(?:tootaj\p{L}*|sotsiaaltootaj\p{L}*|lastekaitsetootaj\p{L}*|juhtumikorraldaj\p{L}*|spetsialist\p{L}*|ametnik\p{L}*|sotsiaalosakon\p{L}*|social\s+worker\p{L}*|child\s+protection\s+worker\p{L}*|case\s+manager\p{L}*|employee\p{L}*|staff|worker\p{L}*|specialist\p{L}*|социальн\p{L}*\s+(?:работник\p{L}*|сотрудник\p{L}*|специалист\p{L}*)|работник\p{L}*|сотрудник\p{L}*|специалист\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function isMunicipalStaffingCountFact(normalized = "") {
  return /(?:^|[^\p{L}\p{N}])(?:mitu|mitme|arv\p{L}*|kui\s+palju|how\s+many|number\s+of|сколько|число)(?=$|[^\p{L}\p{N}])/u.test(normalized) &&
    hasMunicipalStaffTerm(normalized);
}

function isCurrentMunicipalStaffingCountFact(normalized = "") {
  return isMunicipalStaffingCountFact(normalized) &&
    /(?:^|[^\p{L}\p{N}])(?:praegu|hetkel|tana|tanase\p{L}*|ajakohas\p{L}*|kehtiv\p{L}*|now|currently|current|сейчас|теперь|текущ\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function isCurrentMunicipalStaffingPresenceRequest(normalized = "") {
  if (/(?:^|[^\p{L}\p{N}])(?:19|20)\d{2}(?=$|[^\p{L}\p{N}])|(?:^|[^\p{L}\p{N}])(?:oli|tootas|varem|ajalool\p{L}*|was|were|formerly|historical\p{L}*|был\p{L}*|раньше|работал\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized)) return false;
  if (!hasMunicipalStaffTerm(normalized)) return false;
  const compact = normalized.replace(/[.!?\s]+$/gu, "").trim();
  if (!compact || compact.length > 180) return false;
  if (/(?:^|[^\p{L}\p{N}])(?:kuidas|millist|millised|miks|tugi|tuge|toet\p{L}*|juhend\p{L}*|ulesan\p{L}*|roll\p{L}*|supervis\p{L}*|how|why|support\p{L}*|guidance|task\p{L}*|role\p{L}*|need\p{L}*|assist\p{L}*|challenge\p{L}*|way\p{L}*|supervis\p{L}*|как|почему|поддерж\p{L}*|руководств\p{L}*|задач\p{L}*|роль\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(compact)) return false;
  const staffForms = "(?:tootaja(?:d|id)?|sotsiaaltootaja(?:d|id)?|lastekaitsetootaja(?:d|id)?|juhtumikorraldaja(?:d|id)?|spetsialist(?:id|e)?|ametnik(?:ud|ke)?|social\\s+workers?|child\\s+protection\\s+workers?|case\\s+managers?|employees?|staff|specialists?|социальн\\p{L}*\\s+(?:работник\\p{L}*|сотрудник\\p{L}*|специалист\\p{L}*)|работник\\p{L}*|сотрудник\\p{L}*|специалист\\p{L}*)";
  const verbBeforeStaff = new RegExp(
    `^(?:kas\\s+)?(?:[\\p{L}\\p{N}-]+\\s+){0,8}(?:on|tootab|tootavad|is\\s+there|are\\s+there|does?\\s+[^\\s]+\\s+have|do\\s+[^\\s]+\\s+have|есть(?:\\s+ли)?|работает|работают)\\s+(?:(?:praegu|hetkel|tana|seal|siin|olemas|now|currently|there|сейчас|там)\\s+){0,2}(?:[\\p{L}\\p{N}-]+\\s+){0,5}${staffForms}(?:\\s+(?:olemas|ametis|working|employed|работает|работают))?(?:\\s+(?:in|at)\\s+(?:[\\p{L}\\p{N}-]+\\s*){1,4})?$`,
    "u"
  );
  const staffBeforeWork = new RegExp(
    `^(?:kas\\s+)?(?:[\\p{L}\\p{N}-]+\\s+){0,4}${staffForms}\\s+(?:(?:praegu|hetkel|now|currently|сейчас)\\s+)?(?:tootab|tootavad|works?|work|работает|работают)(?:\\s+[\\p{L}\\p{N}-]+){0,7}$`,
    "u"
  );
  const staffBeforeExistence = new RegExp(
    `^(?:kas\\s+)?${staffForms}\\s+(?:on|is|are|есть)(?:\\s+(?:praegu|hetkel|now|currently|сейчас))?\\s+(?:olemas|ametis|employed|present|на\\s+работе)(?:\\s+[\\p{L}\\p{N}-]+){0,5}$`,
    "u"
  );
  return verbBeforeStaff.test(compact) || staffBeforeWork.test(compact) || staffBeforeExistence.test(compact);
}

function isContextualCurrentMunicipalStaffingFollowup(message = "", history = [], { hasExplicitMunicipality = false } = {}) {
  const normalized = normalizeIntentText(message);
  if (!normalized || normalized.length > 100 || hasExplicitMunicipality) return false;
  if (/(?:^|[^\p{L}\p{N}])(?:19|20)\d{2}(?=$|[^\p{L}\p{N}])|(?:^|[^\p{L}\p{N}])(?:oli|tootas|varem|ajalool\p{L}*|was|were|formerly|historical|раньше|был\p{L}*|работал\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized)) return false;
  if (/(?:^|[^\p{L}\p{N}])(?:shs|seadus|paragrahv|artikkel|uuring|source|article|research|law|источник|статья|исследован\p{L}*|закон)(?=$|[^\p{L}\p{N}])/u.test(normalized)) return false;
  const asksCount = /(?:^|[^\p{L}\p{N}])(?:mitu|kui\s+palju|how\s+many|сколько)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  const currentCue = /(?:^|[^\p{L}\p{N}])(?:praegu|hetkel|tana|now|currently|сейчас|теперь)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  const anaphora = /(?:^|[^\p{L}\p{N}])(?:neid|nendest|nad|them|they|those|there|них|они|их)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  const workCue = /(?:^|[^\p{L}\p{N}])(?:tootab\p{L}*|work\p{L}*|работа\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  return asksCount && currentCue && (anaphora || workCue) && lastAssistantHasServiceMapContactSources(history);
}

function lastAssistantServiceMapContactTurn(history = []) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    const role = String(message?.role || "").toLowerCase();
    if (role !== "ai" && role !== "assistant") continue;
    const sources = Array.isArray(message?.displayed_sources)
      ? message.displayed_sources
      : Array.isArray(message?.displayedSources)
        ? message.displayedSources
        : Array.isArray(message?.sources)
          ? message.sources
          : [];
    const contactSources = sources.filter(source => {
      const sourceType = String(source?.source_type || source?.sourceType || "").trim();
      const sourceId = String(source?.source_id || source?.sourceId || source?.id || "").trim();
      return sourceType === "service_map_contact" || sourceId.startsWith("service-map-contact:");
    });
    return { index, sources: contactSources };
  }
  return { index: -1, sources: [] };
}

function lastAssistantServiceMapContactSources(history = []) {
  return lastAssistantServiceMapContactTurn(history).sources;
}

function contactAntecedentUserText(history = [], assistantIndex = -1) {
  const start = Number.isInteger(assistantIndex) && assistantIndex >= 0
    ? assistantIndex - 1
    : history.length - 1;
  for (let index = start; index >= 0; index -= 1) {
    const message = history[index];
    const role = String(message?.role || "").toLowerCase();
    if (role !== "user" && role !== "client") continue;
    return String(message?.text || message?.content || "").trim().slice(0, 700);
  }
  return "";
}

function lastAssistantHasServiceMapContactSources(history = []) {
  return lastAssistantServiceMapContactSources(history).length > 0;
}

function lastAssistantServiceMapMunicipalityText(history = []) {
  return [...new Set(lastAssistantServiceMapContactSources(history)
    .map(source => String(
      source?.municipality_name ||
      source?.municipalityName ||
      source?.metadata?.municipality_name ||
      source?.metadata?.municipalityName ||
      ""
    ).trim())
    .filter(Boolean))]
    .join("\n");
}

function isContextualMunicipalityContactFollowup(message = "", history = []) {
  const normalized = normalizeIntentText(message).replace(/[.!?\s]+$/gu, "");
  if (!normalized || normalized.length > 140 || !lastAssistantHasServiceMapContactSources(history)) return false;
  if (/(?:^|[^\p{L}\p{N}])(?:naita\s+(?:nad|need|neid)|(?:mitu|kui\s+palju)\s+(?:neid|nendest|neist|on\s+neid)|show\s+(?:them|these|those)|how\s+many\s+(?:of\s+them|are\s+there|of\s+these|of\s+those)|покаж\p{L}*\s+(?:их|этих)|сколько\s+(?:их|этих|из\s+них))(?=$|[^\p{L}\p{N}])/u.test(normalized)) return true;
  return /(?:^|[^\p{L}\p{N}])(?:kes\s+(?:nad|need)\s+on|mis\s+on\s+nende\s+(?:nimed|rollid|ametinimetused)|nimeta\s+(?:nad|need)|loetle\s+(?:nad|need)|(?:nende|tema)\s+(?:nimed|rollid|ametinimetused|kontakt\p{L}*|telefon\p{L}*|e-post\p{L}*|epost\p{L}*)|(?:kas|on)\s+need\s+(?:varsk\p{L}*|ajakohas\p{L}*)|(?:kas\s+)?need\s+kontakt\p{L}*\s+on\s+(?:varsk\p{L}*|ajakohas\p{L}*)|millal\s+(?:neid|need)\s+kontrolli\p{L}*|kui\s+tihti\s+(?:neid|need)\s+kontrolli\p{L}*|who\s+(?:are\s+)?they|what\s+are\s+their\s+(?:names|roles|job\s+titles)|list\s+them|name\s+them|their\s+(?:names|roles|job\s+titles|contact\p{L}*|phone\p{L}*|e-mail\p{L}*|email\p{L}*)|(?:are|were)\s+they\s+(?:fresh|current|up\s+to\s+date|checked|verified)|are\s+(?:these|those)\s+contacts?\s+(?:fresh|current|up\s+to\s+date|checked|verified)|when\s+were\s+(?:they|these\s+contacts?|those\s+contacts?)\s+(?:checked|verified)|how\s+often\s+(?:are|were)\s+(?:they|these|those)\s+(?:checked|verified)|кто\s+они|как\s+их\s+зовут|какие\s+у\s+них\s+должности|перечисл\p{L}*\s+их|назов\p{L}*\s+их|их\s+(?:имена|должности|контакт\p{L}*|телефон\p{L}*|почт\p{L}*)|(?:они|эти\s+контакты)\s+(?:актуальн\p{L}*|проверен\p{L}*)|когда\s+(?:их|эти\s+контакты)\s+провер\p{L}*|как\s+часто\s+их\s+провер\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

export function isMunicipalityServiceBenefitListRequest(message = "") {
  const normalized = normalizeIntentText(message);
  if (!normalized) return false;
  // A historical staffing/statistics question can contain plural benefit or
  // service words without asking for the municipality's current catalogue.
  // Keep that evidence in the article/research collections.
  if (isMunicipalStaffingCountFact(normalized)) return false;
  if (/\b(mitu|mitme|arv\w*)\b/.test(normalized) && /\b(?:19|20)\d{2}\b/.test(normalized)) return false;
  const asksList = /\b(kas|on|olemas|leia|otsi|tuvasta|loetle|nimeta|too valja|too välja|millised|mis|koik|kõik|nimekiri|ulevaade|ülevaade)\b/.test(normalized);
  const barePluralList = /\b(sotsiaalteenused|sotsiaalteenuseid|teenused|teenuseid|sotsiaaltoetused|sotsiaaltoetusi|toetused|toetusi|abi liigid)\b/.test(normalized);
  const asksServicesOrBenefits =
    hasServiceTerm(normalized) ||
    hasBenefitTerm(normalized) ||
    /\b(sotsiaalabi|abi liigid)\b/.test(normalized);
  return (asksList || barePluralList) && asksServicesOrBenefits;
}

function detectServiceBenefitIntent(message = "") {
  const normalized = normalizeIntentText(message);
  const wantsServices = hasServiceTerm(normalized);
  const wantsBenefits = hasBenefitTerm(normalized);
  const wantsGeneralSocialHelp = /\b(sotsiaalabi|abi liigid)\b/.test(normalized);
  return {
    wantsServices: wantsServices || wantsGeneralSocialHelp,
    wantsBenefits: wantsBenefits || wantsGeneralSocialHelp
  };
}

function detectServiceBenefitTurnIntent(message = "", history = []) {
  const current = detectServiceBenefitIntent(message);
  if (current.wantsServices || current.wantsBenefits) return current;
  if (isAffirmativeServiceBenefitFollowup(message, history) || isContextualServiceBenefitListFollowup(message, history)) {
    const previous = detectServiceBenefitIntent(extractRecentUserText(history, 4).join("\n"));
    if (previous.wantsServices || previous.wantsBenefits) return previous;
  }
  return {
    wantsServices: true,
    wantsBenefits: true
  };
}

function isAffirmativeServiceBenefitFollowup(message = "", history = []) {
  const normalized = normalizeIntentText(message).replace(/[.!?\s]+$/g, "");
  if (!/^(jah|jaa|jep|ok|okei|palun|sobib)$/.test(normalized)) return false;
  return isMunicipalityServiceBenefitListRequest(extractRecentUserText(history, 4).join("\n"));
}

function isContextualServiceBenefitListFollowup(message = "", history = []) {
  const normalized = normalizeIntentText(message).replace(/[.!?\s]+$/g, "");
  if (!normalized || normalized.length > 120) return false;
  return isMunicipalityServiceBenefitListRequest(extractRecentUserText(history, 4).join("\n"));
}

function hasMunicipalStaffNameOrRosterRequest(normalized = "") {
  if (!hasMunicipalStaffTerm(normalized)) return false;
  const compact = normalized.replace(/[.!?\s]+$/gu, "").trim();
  const explicitNameCue = /(?:^|[^\p{L}\p{N}])(?:nimi|nime|nimed|nimekiri|имен\p{L}*|список)(?=$|[^\p{L}\p{N}])/u.test(compact) ||
    /^(?:(?:what\s+(?:is|are)\s+)(?:[\p{L}\p{N}-]+\s+){0,6}(?:social\s+worker\p{L}*|child\s+protection\s+worker\p{L}*|case\s+manager\p{L}*|employee\p{L}*|specialist\p{L}*)\s+(?:name|names)|(?:name|names|roster)\s+(?:of\s+)?(?:[\p{L}\p{N}-]+\s+){0,4}(?:social\s+worker\p{L}*|child\s+protection\s+worker\p{L}*|case\s+manager\p{L}*|employee\p{L}*|specialist\p{L}*)|(?:[\p{L}\p{N}-]+\s+){0,4}(?:social\s+worker\p{L}*|child\s+protection\s+worker\p{L}*|case\s+manager\p{L}*|employee\p{L}*|specialist\p{L}*)\s+(?:name|names|roster))$/u.test(compact);
  const identityQuestionCue = /^(?:kes\s+on|who\s+(?:is|are)|кто\s+(?:является|работает|работают))\s+(?:(?:[\p{L}-]+\s+)?(?:valla|linna|omavalitsuse|municipality|city|муниципалитет\p{L}*|город\p{L}*)\s+)?(?:tootaja\p{L}*|sotsiaaltootaja\p{L}*|lastekaitsetootaja\p{L}*|juhtumikorraldaja\p{L}*|spetsialist\p{L}*|ametnik\p{L}*|social\s+worker\p{L}*|child\s+protection\s+worker\p{L}*|case\s+manager\p{L}*|employee\p{L}*|specialist\p{L}*|социальн\p{L}*\s+(?:работник\p{L}*|сотрудник\p{L}*|специалист\p{L}*)|работник\p{L}*|сотрудник\p{L}*|специалист\p{L}*)(?:\s+(?:[\p{L}-]+\s+){0,3}(?:vallas|linnas|omavalitsuses|municipality|city|муниципалитет\p{L}*|город\p{L}*))?$/u.test(compact);
  const interrogativeRosterCue = /^(?:millised\s+(?:[\p{L}-]+\s+){0,3}(?:tootajad|sotsiaaltootajad|lastekaitsetootajad|juhtumikorraldajad|spetsialistid|ametnikud)(?:\s+(?:tootavad|on\s+ametis)(?:\s+[\p{L}\p{N}-]+){0,7})?|kes\s+(?:tootavad|on\s+ametis)(?:\s+[\p{L}\p{N}-]+){0,7}\s+(?:tootaja\p{L}*|sotsiaaltootaja\p{L}*|lastekaitsetootaja\p{L}*|juhtumikorraldaja\p{L}*|spetsialist\p{L}*|ametnik\p{L}*)|which\s+(?:social\s+workers?|child\s+protection\s+workers?|case\s+managers?|employees?|specialists?)(?:\s+(?:work|are\s+employed)(?:\s+[\p{L}\p{N}-]+){0,7})?|кто\s+(?:работает|работают)(?:\s+[\p{L}\p{N}-]+){0,7}\s+(?:работник\p{L}*|сотрудник\p{L}*|специалист\p{L}*))$/u.test(compact);
  const allRosterCue = /^(?:koik|all|все)\s+(?:[\p{L}\p{N}-]+\s+){0,5}(?:tootajad|sotsiaaltootajad|lastekaitsetootajad|juhtumikorraldajad|spetsialistid|ametnikud|social\s+workers?|child\s+protection\s+workers?|case\s+managers?|employees?|specialists?|работники|сотрудники|специалисты)(?:(?:\s+(?:kes\s+)?(?:tootavad|on\s+ametis|working|employed|работают))(?:\s+[\p{L}\p{N}-]+){0,5}|\s+(?:in|at)\s+(?:[\p{L}\p{N}-]+\s*){1,4})?$/u.test(compact);
  const explicitRosterCue = /^(?:(?:palun\s+)?(?:loetle\p{L}*|nimeta\p{L}*)\s+(?:(?:koik|need)\s+)?(?:[\p{L}\p{N}-]+\s+){0,4}(?:tootajad|sotsiaaltootajad|lastekaitsetootajad|juhtumikorraldajad|spetsialistid|ametnikud)|(?:please\s+)?(?:list|name)\s+(?:(?:all|the)\s+)?(?:[\p{L}\p{N}-]+\s+){0,3}(?:social\s+workers?|child\s+protection\s+workers?|case\s+managers?|employees?|specialists?)|(?:перечисл\p{L}*|назов\p{L}*)\s+(?:[\p{L}\p{N}-]+\s+){0,4}(?:работники|сотрудники|специалисты))(?:(?:\s+(?:kes\s+)?(?:tootavad|on\s+ametis|working|employed|работают))(?:\s+[\p{L}\p{N}-]+){0,5}|\s+(?:in|at)\s+(?:[\p{L}\p{N}-]+\s*){1,4})?$/u.test(compact);
  return explicitNameCue || identityQuestionCue || interrogativeRosterCue || allRosterCue || explicitRosterCue;
}

function isMunicipalityContactInventoryRequest(message = "") {
  const normalized = normalizeIntentText(message);
  if (!normalized) return false;
  if (hasIndependentContactSourceCue(normalized)) return false;
  if (isCurrentMunicipalStaffingCountFact(normalized) || isCurrentMunicipalStaffingPresenceRequest(normalized)) {
    return true;
  }
  return hasContactRequestTerm(normalized) || hasMunicipalStaffNameOrRosterRequest(normalized);
}

function hasIndependentContactSourceCue(message = "") {
  const normalized = normalizeIntentText(message);
  if (isParticipantCountQuestion(normalized)) return true;
  if (/(?:^|[^\p{L}\p{N}])(?:19|20)\d{2}(?=$|[^\p{L}\p{N}])/u.test(normalized)) return true;
  if (/(?:^|[^\p{L}\p{N}])(?:varem|ajalool\p{L}*|tootas\p{L}*|kirjuta\p{L}*|kirjutis\p{L}*|artik(?:kel|l)\p{L}*|uuring\p{L}*|aruanne\p{L}*|autor\p{L}*|allikas\p{L}*|dokument\p{L}*|fail\p{L}*|pdf|formerly|historical\p{L}*|worked|wrote|writes|article\p{L}*|research\p{L}*|study|report\p{L}*|author\p{L}*|source\p{L}*|document\p{L}*|истор\p{L}*|раньше|работал\p{L}*|статья\p{L}*|исследован\p{L}*|отчет\p{L}*|автор\p{L}*|источник\p{L}*|документ\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized)) return true;
  if (isContactFreshnessRequest(normalized)) return false;
  return /(?:^|[^\p{L}\p{N}])(?:oli|was|were|был\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function hasServiceMapMonitorActor(message = "") {
  const normalized = normalizeIntentText(message);
  return /(?:^|[^\p{L}\p{N}])(?:sotsiaalai|sotsiaal\s+ai|susteem\p{L}*|platvorm\p{L}*|teenusekaart\p{L}*|sina|sa|system\p{L}*|platform\p{L}*|service\s+map|you|систем\p{L}*|платформ\p{L}*|карта\s+услуг|ты|вы)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function hasAutomaticContactCheckCue(message = "") {
  const normalized = normalizeIntentText(message);
  return /(?:^|[^\p{L}\p{N}])(?:automaat\p{L}*|automaatselt|automatic\p{L}*|automatically|автомат\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function hasContactCheckCadenceCue(message = "") {
  const normalized = normalizeIntentText(message);
  return /(?:^|[^\p{L}\p{N}])(?:kui\s+tihti|mis\s+sagedus\p{L}*|how\s+often|what\s+frequency|как\s+часто|с\s+какой\s+частот\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function isPassiveContactCheckCadenceRequest(message = "") {
  const normalized = normalizeIntentText(message);
  return /(?:kui\s+tihti|mis\s+sagedus\p{L}*)[^.!?]{0,90}\bkontrollit\p{L}*/u.test(normalized) ||
    /(?:how\s+often|what\s+frequency)[^.!?]{0,90}\b(?:are|were)\b[^.!?]{0,70}\b(?:checked|verified)\b/u.test(normalized) ||
    /(?:как\s+часто|с\s+какой\s+частот\p{L}*)[^.!?]{0,90}\bпровер\p{L}*ся\b/u.test(normalized);
}

function isPureContactUseOfServiceBenefitTerm(message = "") {
  const normalized = normalizeIntentText(message);
  if (!hasAnyServiceOrBenefitTerm(normalized) || !hasContactRequestTerm(normalized)) return false;
  const substantiveCue = /(?:^|[^\p{L}\p{N}])(?:tingimus\p{L}*|oigus\p{L}*|taotl\p{L}*|summa\p{L}*|maar\p{L}*|suurus\p{L}*|hind\p{L}*|tasu\p{L}*|maks\p{L}*|saaja\p{L}*|eligib\p{L}*|condition\p{L}*|apply\p{L}*|application\p{L}*|amount\p{L}*|price\p{L}*|cost\p{L}*|who\s+qualif\p{L}*|услови\p{L}*|право\p{L}*|заяв\p{L}*|сумм\p{L}*|размер\p{L}*|цен\p{L}*|стоимост\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  const asksServiceBenefitContent = /(?:^|[^\p{L}\p{N}])(?:(?:millise\p{L}*|mis|koik|loetle|nimeta)(?:\s+(?!(?:spetsialist|ametnik|kontakt)\p{L}*(?=$|\s))\p{L}+){0,4}\s+\p{L}*(?:teenus|toetus)\p{L}*(?!\s+(?:spetsialist\p{L}*|kontakt\p{L}*|ametnik\p{L}*))|(?:what|which|all|list|name)(?:\s+(?!(?:specialist|official|contact)\p{L}*(?=$|\s))\p{L}+){0,4}\s+(?:service\p{L}*|benefit\p{L}*)(?!\s+(?:specialist\p{L}*|contact\p{L}*|official\p{L}*))|(?:какие|все|перечисл\p{L}*|назов\p{L}*)(?:\s+(?!(?:специалист|сотрудник|контакт)\p{L}*(?=$|\s))\p{L}+){0,4}\s+(?:услуг\p{L}*|пособ\p{L}*)(?!\s+(?:специалист\p{L}*|контакт\p{L}*|сотрудник\p{L}*)))/u.test(normalized);
  if (substantiveCue || asksServiceBenefitContent) return false;
  const directContactCue = /(?:^|[^\p{L}\p{N}])(?:kontakt\p{L}*|telefon\p{L}*|e-post\p{L}*|epost\p{L}*|email\p{L}*|spetsialist\p{L}*|ametnik\p{L}*|contact\p{L}*|phone\p{L}*|e-mail\p{L}*|employee\p{L}*|staff|worker\p{L}*|specialist\p{L}*|official\p{L}*|контакт\p{L}*|телефон\p{L}*|почт\p{L}*|работник\p{L}*|специалист\p{L}*|сотрудник\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  return directContactCue;
}

function isParticipantCountQuestion(normalized = "") {
  const countCue = /(?:^|[^\p{L}\p{N}])(?:kui\s+palju|mitu|mitme|(?:kogu|uld)?arv\p{L}*|how\s+many|(?:total\s+)?number\s+of|count\s+of|сколько|число|количество)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  const participationCue = /(?:^|[^\p{L}\p{N}])(?:osale\p{L}*|osalus\p{L}*|osavot\p{L}*|vot\p{L}*\s+osa|participat\p{L}*|attend\p{L}*|(?:take|takes|taking|took|taken)\s+part(?!-)|участв\p{L}*|(?:приня\p{L}*|принима\p{L}*|прим(?:ет|ут))\s+участ\p{L}*|участ\p{L}*\s+(?:приня\p{L}*|принима\p{L}*|прим(?:ет|ут)))(?=$|[^\p{L}\p{N}])/u.test(normalized);
  const currentOperationalCue = /(?:^|[^\p{L}\p{N}])(?:praegu|hetkel|tana|current\p{L}*|currently|today|сейчас|сегодня)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  return countCue && participationCue && !currentOperationalCue;
}

function hasContactRequestTerm(normalized = "") {
  if (isInstitutionalApplicationGuidance(normalized)) return false;
  if (isParticipantCountQuestion(normalized)) return false;
  if (isMunicipalStaffingCountFact(normalized) && !isCurrentMunicipalStaffingCountFact(normalized)) return false;
  if (/\b(mitu|mitme|arv\w*)\b/.test(normalized) && /\b(?:19|20)\d{2}\b/.test(normalized)) return false;
  if (/(?:^|[^\p{L}\p{N}])(?:kontakt\p{L}*|telefoninumb\p{L}*|telefon\p{L}*|e-post\p{L}*|epost\p{L}*|email\p{L}*|meiliaadress\p{L}*|contact\p{L}*|phone\p{L}*|e-mail\p{L}*|official\s+contact\p{L}*|контакт\p{L}*|телефон\p{L}*|почт\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized)) {
    return true;
  }
  return /\b(kelle poole|kelle juurde|kelle kaest|kellega uhendust|kellega raakida|kes tegeleb|kes vastutab|kes minuga)\b/u.test(normalized);
}

// Which contact layer the turn needs. Without an explicit topic the answer must
// stay on the role level and ask, instead of defaulting to whichever one or two
// people carry the most generic job title.
export function resolveKovContactMode({
  message = "",
  listRequest = false,
  contactInventoryRequest = false,
  serviceSpecific = false
} = {}) {
  const normalized = normalizeIntentText(message);
  if (contactInventoryRequest) return "contacts";
  if (hasContactRequestTerm(normalized)) return "contacts";
  if (listRequest) return "overview";
  if (serviceSpecific) return "service";
  const hasTopic = hasServiceTerm(normalized) || hasBenefitTerm(normalized) || hasTargetGroupTerm(normalized);
  return hasTopic ? "service" : "overview";
}

function isMunicipalityServiceBenefitTurn(message = "", history = []) {
  return isMunicipalityServiceBenefitListRequest(message) ||
    isAffirmativeServiceBenefitFollowup(message, history);
}

function isConcreteKovItemGroup(group, itemType) {
  return String(group?.collectionId || "") === "kov_services" &&
    String(group?.itemType || "") === itemType;
}

function isKovRegulationGroup(group) {
  const collectionId = String(group?.collectionId || "").trim();
  return collectionId === "kov_regulations" || collectionId === "kov_legal";
}

function sortByGroupRank(groups = []) {
  return [...groups].sort((a, b) => {
    const aScore = typeof a?.rankScore === "number" ? a.rankScore : (a?.bestScore || 0);
    const bScore = typeof b?.rankScore === "number" ? b.rankScore : (b?.bestScore || 0);
    return bScore - aScore;
  });
}

function selectMunicipalityContactGroups(groups = [], maxGroups = 24) {
  const selected = [];
  const seen = new Set();
  for (const group of sortByGroupRank(groups)) {
    const sourceType = String(group?.sourceType || "").trim();
    const itemType = String(group?.itemType || group?.resourceType || "").trim();
    if (!["official_contact", "contact_page", "contact"].includes(sourceType) && itemType !== "contact") continue;
    const identity = normalizeIntentText(group?.canonicalItemId || group?.title || group?.sourceId || group?.key || "");
    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    selected.push(group);
    if (selected.length >= maxGroups) break;
  }
  return selected;
}

function prioritizeExactMunicipalityTitleGroups(groups = [], municipalities = [], { enabled = true } = {}) {
  if (!enabled) return groups;
  const municipalityNames = (Array.isArray(municipalities) ? municipalities : [])
    .map(item => normalizeIntentText(item?.displayName || item?.name || item?.municipalityName || ""))
    .filter(Boolean);
  if (!municipalityNames.length) return groups;
  return (Array.isArray(groups) ? groups : [])
    .map(group => {
      const title = normalizeIntentText(group?.title || "");
      const exactTitleMatch = municipalityNames.some(name => title.includes(name));
      if (!exactTitleMatch) return group;
      return {
        ...group,
        municipalityTitleBoost: 0.55,
        rankScore: (Number.isFinite(Number(group?.rankScore)) ? Number(group.rankScore) : Number(group?.bestScore) || 0.3) + 0.55
      };
    })
    .sort((left, right) => (right.rankScore || 0) - (left.rankScore || 0));
}

function roundTraceNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(6)) : undefined;
}

function summarizeHybridRetrieval(matches = []) {
  const channelCounts = {};
  const multiQueryCandidates = [];
  let scoredCount = 0;
  let topHybridScore = null;
  let topRrfScore = null;
  let mergeStrategy = null;
  let channelStats = null;
  let multiQueryStrategy = null;
  let multiQueryCandidateCount = 0;
  let multiQueryAnchoredCount = 0;
  let multiQueryMaxHitCount = 0;
  const normalizedMatches = Array.isArray(matches) ? matches : [];
  for (let index = 0; index < normalizedMatches.length; index += 1) {
    const match = normalizedMatches[index];
    const channels = Array.isArray(match?.retrieval_channels)
      ? match.retrieval_channels
      : Array.isArray(match?.retrievalChannels)
        ? match.retrievalChannels
        : [];
    for (const channel of channels) {
      const key = String(channel || "").trim();
      if (!key) continue;
      channelCounts[key] = (channelCounts[key] || 0) + 1;
    }
    const hybridScore = roundTraceNumber(match?.hybrid_score ?? match?.hybridScore);
    const rrfScore = roundTraceNumber(match?.rrf_score);
    if (typeof hybridScore === "number") {
      scoredCount += 1;
      topHybridScore = typeof topHybridScore === "number" ? Math.max(topHybridScore, hybridScore) : hybridScore;
    }
    if (typeof rrfScore === "number") {
      topRrfScore = typeof topRrfScore === "number" ? Math.max(topRrfScore, rrfScore) : rrfScore;
    }
    if (!mergeStrategy && match?.retrieval_merge_strategy && typeof match.retrieval_merge_strategy === "object") {
      mergeStrategy = match.retrieval_merge_strategy;
    }
    if (!channelStats && match?.retrieval_channel_stats && typeof match.retrieval_channel_stats === "object") {
      channelStats = match.retrieval_channel_stats;
    }
    const fusionStrategy = String(match?.multi_query_fusion_strategy || "").trim();
    if (fusionStrategy) {
      if (!multiQueryStrategy) multiQueryStrategy = fusionStrategy;
      multiQueryCandidateCount += 1;
      const hitCount = Number(match?.multi_query_hit_count || 0);
      if (match?.multi_query_exact_anchor_hit === true) multiQueryAnchoredCount += 1;
      if (Number.isFinite(hitCount)) multiQueryMaxHitCount = Math.max(multiQueryMaxHitCount, hitCount);
      if (multiQueryCandidates.length < 20) {
        multiQueryCandidates.push({
          source_id: stableSourceIdFromRawMatch(match, index),
          fusion_score: roundTraceNumber(match?.multi_query_fusion_score),
          best_retrieval_score: roundTraceNumber(match?.multi_query_best_score),
          query_hit_count: Number.isFinite(hitCount) ? hitCount : undefined,
          query_ids: Array.isArray(match?.multi_query_query_ids) ? match.multi_query_query_ids : undefined,
          query_ranks: match?.multi_query_query_ranks && typeof match.multi_query_query_ranks === "object"
            ? match.multi_query_query_ranks
            : undefined,
          primary_rank: finiteOptionalNumber(match?.multi_query_primary_rank) ?? undefined,
          best_rank: finiteOptionalNumber(match?.multi_query_best_rank) ?? undefined,
          exact_anchor_hit: match?.multi_query_exact_anchor_hit === true,
          anchor_channels: Array.isArray(match?.multi_query_anchor_channels)
            ? match.multi_query_anchor_channels
            : undefined
        });
      }
    }
  }
  if (!Object.keys(channelCounts).length && !mergeStrategy && !channelStats && scoredCount === 0 && !multiQueryStrategy) return null;
  return {
    merge_strategy: mergeStrategy
      ? {
          strategy: mergeStrategy.strategy,
          rrf_k: mergeStrategy.rrf_k,
          requested_retrievers: Array.isArray(mergeStrategy.requested_retrievers) ? mergeStrategy.requested_retrievers : undefined,
          channel_weights: mergeStrategy.channel_weights,
          channel_boosts: mergeStrategy.channel_boosts,
          bm25_config: mergeStrategy.bm25_config,
          score_formula: mergeStrategy.score_formula
        }
      : undefined,
    channel_counts: Object.keys(channelCounts).length ? channelCounts : channelStats?.channel_counts,
    top_channels: Array.isArray(channelStats?.top_channels) ? channelStats.top_channels : undefined,
    dense_only_count: typeof channelStats?.dense_only_count === "number" ? channelStats.dense_only_count : undefined,
    lexical_only_count: typeof channelStats?.lexical_only_count === "number" ? channelStats.lexical_only_count : undefined,
    dense_and_lexical_count: typeof channelStats?.dense_and_lexical_count === "number" ? channelStats.dense_and_lexical_count : undefined,
    bm25: channelStats?.bm25 && typeof channelStats.bm25 === "object" ? channelStats.bm25 : undefined,
    scored_count: scoredCount,
    top_hybrid_score: topHybridScore ?? undefined,
    top_rrf_score: topRrfScore ?? undefined,
    multi_query_fusion: multiQueryStrategy
      ? {
          strategy: multiQueryStrategy,
          candidate_count: multiQueryCandidateCount,
          anchored_candidate_count: multiQueryAnchoredCount,
          max_query_hit_count: multiQueryMaxHitCount,
          top_candidates: multiQueryCandidates
        }
      : undefined
  };
}

function buildMunicipalityRegulationPackageQueries(municipalities = []) {
  const out = [];
  const seen = new Set();
  for (const municipality of Array.isArray(municipalities) ? municipalities : []) {
    const municipalityId = String(municipality?.id || municipality?.municipalityId || municipality?.municipality_id || "").trim();
    if (!municipalityId || seen.has(municipalityId)) continue;
    seen.add(municipalityId);
    const name = String(municipality?.displayName || municipality?.name || municipality?.municipalityName || municipalityId).trim();
    out.push({
      query: [
        name,
        "sotsiaalhoolekandelise abi andmise kord",
        "sotsiaalabi määrus"
      ].filter(Boolean).join(" "),
      filters: {
        source_type: "kov_regulation",
        collection_id: {
          $in: ["kov_legal", "kov_regulations"]
        },
        municipality_id: municipalityId
      }
    });
  }
  return out;
}

function selectMunicipalityServiceBenefitGroups(groups = [], k = CONTEXT_GROUPS_MAX, intent = {}) {
  const selected = [];
  const seen = new Set();
  const add = (items) => {
    for (const item of items) {
      const key = item?.key || item?.docId || item?.articleId || item?.title;
      if (!key || seen.has(key) || selected.length >= k) continue;
      seen.add(key);
      selected.push(item);
    }
  };
  const benefits = sortByGroupRank(groups.filter(group => isConcreteKovItemGroup(group, "benefit")));
  const services = sortByGroupRank(groups.filter(group => isConcreteKovItemGroup(group, "service")));
  const regulations = sortByGroupRank(groups.filter(isKovRegulationGroup));
  const rest = sortByGroupRank(groups.filter(group =>
    !isConcreteKovItemGroup(group, "benefit") &&
    !isConcreteKovItemGroup(group, "service") &&
    !isKovRegulationGroup(group)
  ));
  const wantsServices = intent?.wantsServices !== false;
  const wantsBenefits = intent?.wantsBenefits !== false;

  if (wantsBenefits && !wantsServices) {
    add(benefits);
    add(regulations);
    add(rest);
    return selected;
  }

  if (wantsServices && !wantsBenefits) {
    add(services);
    add(regulations);
    add(rest);
    return selected;
  }

  if (benefits.length && services.length) {
    const benefitTarget = Math.min(benefits.length, Math.ceil(k / 2));
    add(benefits.slice(0, benefitTarget));
    add(services.slice(0, Math.max(1, k - selected.length - Math.min(1, regulations.length))));
    add(benefits.slice(benefitTarget));
    add(services);
  } else {
    add(benefits);
    add(services);
  }
  add(regulations);
  add(rest);
  return selected;
}

export function buildLegalExactSelection(groups = [], legalLookupPlan = null, options = {}) {
  if (!legalLookupPlan?.enabled) {
    return {
      groupedMatches: Array.isArray(groups) ? groups : [],
      selectionGroups: Array.isArray(groups) ? groups : [],
      missingParagraphRefs: [],
      insufficientPreciseLegalSourceSupport: false
    };
  }

  const filteredGroups = filterGroupsForLegalPlan(groups, legalLookupPlan);
  if (legalLookupPlan.mode !== "explicit_paragraph") {
    const rankedGroups = legalLookupPlan.mode === "topic_to_paragraphs"
      ? rankGroupsWithTopicHints(filteredGroups, legalLookupPlan.topicTerms || [], options)
      : filteredGroups;
    return {
      groupedMatches: rankedGroups,
      selectionGroups: rankedGroups,
      missingParagraphRefs: [],
      insufficientPreciseLegalSourceSupport: false
    };
  }

  const wantedParagraphRefs = Array.isArray(legalLookupPlan.paragraphRefs)
    ? legalLookupPlan.paragraphRefs.map(value => String(value || "").trim()).filter(Boolean)
    : [];
  const foundParagraphRefs = new Set(
    filteredGroups
      .map(group => String(group?.paragraphNumber || "").trim())
      .filter(Boolean)
  );
  const missingParagraphRefs = wantedParagraphRefs.filter(ref => !foundParagraphRefs.has(ref));
  const rankedGroups = sortByGroupRank(filteredGroups);

  return {
    groupedMatches: rankedGroups,
    selectionGroups: rankedGroups,
    missingParagraphRefs,
    insufficientPreciseLegalSourceSupport: missingParagraphRefs.length > 0 || rankedGroups.length === 0
  };
}

function buildLegalExactMissingInstruction(replyLang = "et", legalLookupPlan = null, missingParagraphRefs = []) {
  const refs = (Array.isArray(missingParagraphRefs) ? missingParagraphRefs : [])
    .map(ref => `§ ${String(ref || "").trim()}`)
    .filter(Boolean)
    .join(", ");
  const actTitle = String(legalLookupPlan?.actTitle || "the requested act").trim();

  if (replyLang === "en") {
    return refs
      ? `LEGAL_EXACT_LOOKUP_RESULT: The current retrieval did not find an exact current legal source for ${actTitle} ${refs}. State that the current search did not provide sufficiently precise legal confirmation and do not substitute a similar paragraph.`
      : `LEGAL_EXACT_LOOKUP_RESULT: The current retrieval did not find an exact current legal source for the requested paragraph. State that the current search did not provide sufficiently precise legal confirmation and do not substitute a similar paragraph.`;
  }

  if (replyLang === "ru") {
    return refs
      ? `LEGAL_EXACT_LOOKUP_RESULT: Текущий поиск не нашёл точный действующий правовой источник для ${actTitle} ${refs}. Скажи, что текущий поиск не дал достаточно точного правового подтверждения, и не подменяй его похожим параграфом.`
      : "LEGAL_EXACT_LOOKUP_RESULT: Текущий поиск не нашёл точный действующий правовой источник для запрошенного параграфа. Скажи, что текущий поиск не дал достаточно точного правового подтверждения, и не подменяй его похожим параграфом.";
  }

  return refs
    ? `LEGAL_EXACT_LOOKUP_RESULT: Praegune otsing ei leidnud ${actTitle} ${refs} kohta täpset kehtivat õigusallikat. Ütle, et praeguse otsinguga ei leitud piisavalt täpset õiguslikku allikakinnitust, ja ära asenda seda sarnase paragrahviga.`
    : "LEGAL_EXACT_LOOKUP_RESULT: Praegune otsing ei leidnud küsitud paragrahvi kohta täpset kehtivat õigusallikat. Ütle, et praeguse otsinguga ei leitud piisavalt täpset õiguslikku allikakinnitust, ja ära asenda seda sarnase paragrahviga.";
}

function isNationalLawSourceLookup(subject = "", combinedText = "") {
  const normalizedSubject = normalizeIntentText(subject);
  const normalizedCombined = normalizeIntentText(combinedText);
  if (/\bsotsiaalhoolekande sead/.test(normalizedSubject) || /\bshs\b/.test(normalizedCombined)) {
    return true;
  }
  return /\b(riigi teataja|riigiteataja)\b/.test(normalizedSubject) &&
    /\b(seadus|paragrahv|paragraph|shs|sotsiaalhoolekande)\b/.test(normalizedCombined);
}

export function buildRagContextBudgetOptions({
  temporalRetrievalPlan,
  municipalityContactRequest,
  municipalityServiceBenefitListRequest,
  broadMultiSourceQuestion,
  sourceLookupRequest,
  sourceLookupTargetsNationalLaw,
  sourceLookupParagraphRefs,
  sourceSetListingFollowup,
  contextGroupTarget
} = {}) {
  const maxGroups = Number.isFinite(Number(contextGroupTarget))
    ? Math.max(1, Math.trunc(Number(contextGroupTarget)))
    : CONTEXT_GROUPS_MAX;
  const paragraphRefs = Array.isArray(sourceLookupParagraphRefs) ? sourceLookupParagraphRefs : [];

  if (temporalRetrievalPlan?.enabled) {
    return {
      preferredYears: temporalRetrievalPlan.years,
      preferredTopicTerms: temporalRetrievalPlan.topicTerms,
      maxGroups
    };
  }
  if (municipalityContactRequest) {
    return {
      compact: true,
      maxGroups
    };
  }
  if (municipalityServiceBenefitListRequest) {
    return {
      compact: true,
      maxGroups
    };
  }
  if (sourceSetListingFollowup) {
    return {
      compact: true,
      maxGroups
    };
  }
  if (broadMultiSourceQuestion) {
    return {
      compact: true,
      maxGroups
    };
  }
  if (sourceLookupRequest && sourceLookupTargetsNationalLaw && paragraphRefs.length === 0) {
    return {
      compact: true,
      maxGroups
    };
  }
  return {
    maxGroups
  };
}

function buildLayeredContextInstruction(replyLang = "et") {
  if (replyLang === "en") {
    return [
      "LAYERED_CONTEXT_MODE:",
      "When sources support several levels, structure the answer from general/national background to municipal support or service and then to direct service provider or partner.",
      "Do not force every level into the answer.",
      "Mention municipal or provider-level details only when RAG_CONTEXT contains evidence for that level.",
      "If the municipality is missing for a municipality-dependent question, give only general background and ask for the municipality."
    ].join("\n");
  }

  if (replyLang === "ru") {
    return [
      "LAYERED_CONTEXT_MODE:",
      "Если источники покрывают несколько уровней, строй ответ от общего/государственного фона к поддержке или услуге местного самоуправления, затем к прямому поставщику услуги или партнёру.",
      "Не добавляй все уровни принудительно.",
      "Упоминай муниципальные детали или поставщика услуги только тогда, когда RAG_CONTEXT содержит подтверждение этого уровня.",
      "Если для вопроса нужен муниципалитет, но он неизвестен, дай только общий фон и спроси муниципалитет."
    ].join("\n");
  }

  return [
    "LAYERED_CONTEXT_MODE:",
    "Kui allikad toetavad mitut tasandit, struktureeri vastus üldisest või riiklikust taustast KOV toe või teenuseni ning sealt otsese teenuseosutaja või partnerini.",
    "Ära suru kõiki tasandeid vastusesse vägisi.",
    "Nimeta KOV- või teenusepartneri tasandi detaile ainult siis, kui RAG_CONTEXT sisaldab selle tasandi tõendust.",
    "Kui küsimus sõltub omavalitsusest, aga omavalitsus pole teada, anna ainult üldine taust ja küsi omavalitsust."
  ].join("\n");
}

function buildThematicSynthesisInstruction(replyLang = "et") {
  if (replyLang === "en") {
    return [
      "THEMATIC_SYNTHESIS_MODE:",
      "The user is asking for a thematic synthesis, not one narrow lookup.",
      "State the thematic conclusion directly, then group the answer into the supported main issues or themes.",
      "Combine journal articles, studies, reports, statistics, official guides, methodology materials and practice examples when the selected content supports them.",
      "Do not collapse the answer into one source type if several relevant source types are present.",
      "Make the answer reflect the sources that were actually selected, even when they use different wording for the same topic.",
      "Never mention RAG_CONTEXT, retrieval, search status or source-base width in the answer. If a requested detail is missing, state only that concrete missing detail."
    ].join("\n");
  }
  return [
    "THEMATIC_SYNTHESIS_MODE:",
    "Kasutaja küsib teemalist kokkuvõtet, mitte ühte kitsast allikat.",
    "Esita teemaline järeldus otse ja rühmita vastus seejärel toetatud põhiprobleemide või teemade kaupa.",
    "Ära raamista sünteesi väljenditega \"allikates tõuseb esile\", \"allikad näitavad\", \"allikates kordub\", \"valitud materjalide põhjal\" ega muu allikate vahendamist kirjeldava lausega. Ütle sama sisuline järeldus otse, näiteks \"Peamised võimalused ja riskid on…\".",
    "Esimesed kaks sisulist lauset esita ilma sõnadeta \"allikas\", \"allikad\", \"materjal\", \"otsing\", \"kontekst\", \"RAG\" ja \"artikkel\" ning ilma nende käändevormideta.",
    "Kombineeri ajakirjaartikleid, uuringuid, raporteid, statistikat, ametlikke juhendeid, metoodikamaterjale ja praktikakirjeldusi, kui valitud sisu neid toetab.",
    "Ära taanda vastust ainult ühele allikatüübile, kui kontekstis on mitu asjakohast allikatüüpi.",
    "Lase vastusel peegeldada päriselt valitud allikaid ka siis, kui need kasutavad sama teema kohta erinevat sõnastust.",
    "Ära nimeta vastuses RAG-konteksti, otsingu seisu ega allikabaasi laiust. Kui mõni küsitud detail puudub, nimeta ainult see konkreetne puuduv detail."
  ].join("\n");
}

function buildEvidencePreservationInstruction(replyLang = "et") {
  if (replyLang === "en") {
    return [
      "EVIDENCE_PRESERVATION:",
      "Before saying that the materials do not contain a concrete example, check every directly relevant named example in RAG_CONTEXT.",
      "If the context names and describes a system, practice, person or organization relevant to the question, include it and do not claim that the example is absent.",
      "Attribute the example briefly to its time. Unless the user explicitly asks about current operational status, the date or source-time wording is enough; do not add a separate paragraph about missing current confirmation.",
      "A relevant journal article or study can support a source-reported example; do not demand an official source unless the user asks for current official status or the risk policy requires it."
    ].join("\n");
  }
  if (replyLang === "ru") {
    return [
      "EVIDENCE_PRESERVATION:",
      "Прежде чем утверждать, что в материалах нет конкретного примера, проверь все прямо относящиеся к вопросу именованные примеры в RAG_CONTEXT.",
      "Если контекст называет и описывает систему, практику, человека или организацию, относящиеся к вопросу, включи этот пример и не утверждай, что его нет.",
      "Кратко укажи время примера. Если пользователь прямо не спрашивает о текущем рабочем статусе, даты или временной формулировки достаточно; не добавляй отдельный абзац об отсутствии текущего подтверждения.",
      "Подходящая журнальная статья или исследование могут подтверждать пример как сообщение источника; не требуй официальный источник, если пользователь не спрашивает именно о текущем официальном статусе или этого не требует политика риска."
    ].join("\n");
  }
  return [
    "EVIDENCE_PRESERVATION:",
    "Enne kui ütled, et materjalides konkreetset näidet ei ole, kontrolli kõiki RAG_CONTEXT-is olevaid küsimusega otseselt seotud nimelisi näiteid.",
    "Kui kontekst nimetab ja kirjeldab küsimusega seotud süsteemi, praktikat, inimest või organisatsiooni, lisa see vastusesse. Ära väida, et materjalides konkreetset näidet ei ole.",
    "Seo näide lühidalt selle ajaga. Kui kasutaja ei küsi sõnaselgelt tänast kasutusolekut, piisab aastast või ajavormist; ära lisa eraldi lõiku tänase kinnituse puudumise või uue allika vajaduse kohta.",
    "Asjakohane ajakirjaartikkel või uuring võib kinnitada allikapõhist näidet; ära nõua ametlikku allikat, kui kasutaja ei küsi just praegust ametlikku staatust või riskireegel seda ei nõua."
  ].join("\n");
}

export function shouldUseNumericScopeInstruction(message = "") {
  const normalized = normalizeIntentText(message);
  if (!normalized) return false;
  return asksForParticipantGroupNumericRelation(message) ||
    /\b(?:arv(?:u|ud)?|kokku|kui\s+palju|kui\s+suur\s+osa|mitu|osakaal\p{L}*|protsent\p{L}*|how\s+(?:many|much)|what\s+(?:percentages?|proportions?|shares?)|сколько|какая\s+доля|какой\s+процент\p{L}*)\b/u.test(normalized);
}

export function buildNumericScopeInstruction(replyLang = "et") {
  if (replyLang === "en") {
    return [
      "NUMERIC_SCOPE_MODE:",
      "Bind every number and year to the exact population, sample, subgroup and time period stated in RAG_CONTEXT.",
      "Answer only the numeric categories requested by the user; do not add unrelated numeric background, budgets or totals.",
      "Treat population, sample, subgroup and role names in the user's wording as claims to verify, not as evidence. If they conflict with RAG_CONTEXT, correct them and use only the categories supported by RAG_CONTEXT.",
      "If the evidence gives N people from each group and separately names M organizations, jurisdictions or locations represented in a role group, use N as the people count. M describes coverage only; mention it only if the user asks and label the counted unit explicitly. Never turn M into a people count.",
      "When the question asks for an unqualified count and the evidence gives both an overall total and subgroup counts, answer with the overall total first and label subgroup counts separately.",
      "Distinguish the year of the data, sample or decisions from the publication year; never substitute the publication year for the requested evidence year."
    ].join("\n");
  }
  if (replyLang === "ru") {
    return [
      "NUMERIC_SCOPE_MODE:",
      "Связывай каждое число и год с точной совокупностью, выборкой, подгруппой и периодом, указанными в RAG_CONTEXT.",
      "Указывай только запрошенные пользователем числовые категории; не добавляй посторонние числовые сведения, бюджеты или итоги.",
      "Считай названия совокупностей, выборок, подгрупп и ролей в вопросе пользователя утверждениями, которые нужно проверить, а не доказательством. Если они противоречат RAG_CONTEXT, исправь их и используй только категории, подтвержденные RAG_CONTEXT.",
      "Если доказательство указывает N человек из каждой группы и отдельно называет M организаций, административных единиц или мест, представленных в ролевой группе, используй N как число людей. M описывает только охват; упоминай его лишь по запросу пользователя и явно называй единицу подсчета. Никогда не превращай M в число людей.",
      "Если вопрос просит число без уточнения, а в доказательстве есть общий итог и числа подгрупп, сначала укажи общий итог, а подгруппы подпиши отдельно.",
      "Отличай год данных, выборки или решений от года публикации; не подменяй запрошенный год годом публикации."
    ].join("\n");
  }
  return [
    "NUMERIC_SCOPE_MODE:",
    "Seo iga arv ja aasta täpselt RAG_CONTEXT-is nimetatud üldkogumi, koguvalimi, alamrühma ning ajavahemikuga.",
    "Vasta ainult kasutaja küsitud arvukategooriatele; ära lisa kõrvalist arvulist tausta, eelarveid ega kogusummasid.",
    "Käsitle kasutaja küsimuses nimetatud üldkogumit, valimit, alamrühmi ja rolle kontrollitavate väidetena, mitte tõendina. Kui need lähevad RAG_CONTEXT-iga vastuollu, paranda eeldus ja kasuta ainult RAG_CONTEXT-is kinnitatud kategooriaid.",
    "Kui tõend annab N inimest igast rühmast ja nimetab eraldi rollirühmas esindatud M organisatsiooni, haldusüksust või asukohta, kasuta inimeste arvuna N-i. M kirjeldab ainult katvust; nimeta seda üksnes siis, kui kasutaja seda küsib, ja märgista loendatav üksus selgelt. Ära muuda M-i inimeste arvuks.",
    "Kui küsimus küsib täpsustamata arvu ning tõendis on nii üldarv kui alamrühmade arvud, vasta esmalt koguvalimi üldarvuga ja märgista alamrühmade arvud eraldi.",
    "Erista andmete, valimi või otsuste aastat avaldamisaastast; ära asenda küsitud tõendiaastat allika avaldamisaastaga."
  ].join("\n");
}

function buildOverviewSynthesisInstruction(replyLang = "et") {
  if (replyLang === "en") {
    return [
      "OVERVIEW_SYNTHESIS_MODE:",
      "The user is asking for a broad overview. Build a synthesis across the selected sources, not a summary of one article or document.",
      "Use recurring themes, patterns and differences in emphasis across sources.",
      "Do not generalize one document's claim to the whole field unless other selected sources support it.",
      "Preserve each claim's service, population and time scope. A rule about one service is not a rule about all services. Place each source title beside the exact sentence it supports; separate examples from different sources. Cover pages and contents headings are not substantive article evidence.",
      "If an excerpt refers only to 'the service' but does not identify which service its rule concerns, omit that rule or explicitly state that its service scope is unconfirmed. Do not fill in a missing antecedent from general knowledge.",
      "Use stronger documents in more depth only when their chunks add new details or perspectives.",
      "Do not add meta-commentary about the width of the selected source base. If a requested fact is unsupported, name only that specific missing fact briefly.",
      "The answer may be more substantive than a short two-paragraph reply, but keep it readable."
    ].join("\n");
  }
  return [
    "OVERVIEW_SYNTHESIS_MODE:",
    "Kasutaja küsib laia ülevaadet. Koosta valitud allikate ülene süntees, mitte ühe artikli või dokumendi kokkuvõte.",
    "Too välja korduvad teemad, mustrid ja eri allikate rõhuasetused.",
    "Ära üldista ühe dokumendi väidet kogu valdkonnale, kui teised valitud allikad seda ei toeta.",
    "Säilita iga väite teenuse, sihtrühma ja aja ulatus. Ühe teenuse korraldus ei kehti automaatselt kõigile teenustele. Pane allikapealkiri selle konkreetse lause juurde, mida see tõendab; eri allikatest pärit näited esita eraldi viidetega. Kaane ja sisukorra pealkirjad ei ole artikli sisulised tõendid.",
    "Kui katkend räägib ainult teenusest ega määra, millise teenuse kohta korraldus käib, jäta see korraldusväide välja või ütle selgelt, et teenuse liik jäi kinnitamata. Ära täida puuduvat viidet üldteadmisega.",
    "Kasuta tugevamaid dokumente sügavamalt ainult siis, kui nende lõigud lisavad uusi detaile või vaatenurki.",
    "Ära lisa vastusesse meta-kommentaari valitud allikabaasi laiuse kohta. Kui mõni küsitud fakt jäi kinnitamata, nimeta lühidalt ainult see konkreetne puuduv fakt.",
    "Vastus võib olla sisukam kui lühike kahe lõigu vastus, aga hoia see loetav."
  ].join("\n");
}

function buildResourceDiscoveryInstruction(replyLang = "et") {
  if (replyLang === "en") {
    return [
      "RESOURCE_DISCOVERY_MODE:",
      "The user is looking for organizations, materials, contacts, networks, or practical help resources.",
      "Prefer organization, material, guideline, contact, and resource sources from RAG_CONTEXT. If direct organization/material sources are sparse, use relevant journal articles, studies, and guidance materials as supporting material sources.",
      "Use legal sources as background only; do not make national law the sole displayed basis when organization or material sources are available.",
      "Do not discuss source-base width. If a requested resource type is missing, name only that specific gap briefly."
    ].join("\n");
  }
  if (replyLang === "ru") {
    return [
      "RESOURCE_DISCOVERY_MODE:",
      "Пользователь ищет организации, материалы, контакты, сети поддержки или практические источники помощи.",
      "Отдавай предпочтение источникам об организациях, материалах, руководствах, контактах и ресурсах из RAG_CONTEXT. Если прямых источников об организациях или материалах мало, используй релевантные журнальные статьи, исследования и руководства как поддерживающие материалы.",
      "Правовые источники используй как фон; не делай закон единственной основой ответа, если есть источники об организациях или материалах.",
      "Если база найденных источников узкая, скажи об этом естественно."
    ].join("\n");
  }
  return [
    "RESOURCE_DISCOVERY_MODE:",
    "Kasutaja otsib organisatsioone, materjale, kontakte, võrgustikke või praktilisi abiallikaid.",
    "Eelista RAG_CONTEXTis organisatsiooni-, materjali-, juhendi-, kontakti- ja ressursiallikaid. Kui otseseid organisatsiooni- või materjaliallikaid on vähe, kasuta toetavate materjalidena ka asjakohaseid ajakirjaartikleid, uuringuid ja juhendeid.",
    "Õigusallikaid kasuta taustaks; ära tee seadusest ainsat kuvatavat põhiallikat, kui organisatsiooni- või materjaliallikaid on olemas.",
    "Ära arutle allikabaasi laiuse üle. Kui mõni küsitud ressursiliik puudub, nimeta lühidalt ainult see konkreetne puudujääk."
  ].join("\n");
}

export function buildProfessionalMethodGuidanceInstruction(replyLang = "et", focus = "practice") {
  if (replyLang === "en") {
    return [
      "PROFESSIONAL_METHOD_GUIDANCE_MODE:",
      "Use the selected current official guidance as the primary framework. Explain the practical steps and decision points supported by RAG_CONTEXT, not just the first familiar model.",
      focus === "assessment"
        ? "Where supported, distinguish immediate safety/triage, initial screening, comprehensive assessment, an action plan and reassessment. Assessment domains are not separate assessment methods. Describe complementary models found in the selected sources separately and explain their role; do not present one framework as the only option."
        : "Where supported, distinguish immediate safety, supportive engagement, practical actions and referral or follow-up.",
      "These are coverage checks, not new evidence: do not invent a step, model, requirement or local availability. Label historical practice and complementary models as such; do not turn them into a mandatory current procedure.",
      "If the selected sources leave an important phase or method unconfirmed, state that specific limit briefly. Do not claim to list every possible method."
    ].join("\n");
  }
  if (replyLang === "ru") {
    return [
      "PROFESSIONAL_METHOD_GUIDANCE_MODE:",
      "Используй выбранное актуальное официальное руководство как основную рамку. Объясни подтверждённые RAG_CONTEXT практические шаги и точки принятия решений, а не только одну знакомую модель.",
      focus === "assessment"
        ? "Если источники подтверждают, различай срочную безопасность, предварительную и полную оценку, план действий и повторную оценку. Области оценки не являются отдельными методами. Дополнительные модели из выбранных источников опиши отдельно и объясни их роль; не представляй одну рамку единственным вариантом."
        : "Если источники подтверждают, различай срочную безопасность, поддерживающее общение, практические действия и направление к помощи или последующие действия.",
      "Это проверка полноты, а не новые доказательства: не выдумывай шаги, модели, требования или местную доступность. Историческую практику и дополнительные модели не представляй обязательной актуальной процедурой.",
      "Кратко обозначь конкретную неподтверждённую часть. Не утверждай, что перечислены все возможные методы."
    ].join("\n");
  }
  return [
    "PROFESSIONAL_METHOD_GUIDANCE_MODE:",
    "Kasuta valitud aktiivset ametlikku juhendit põhiraamistikuna. Selgita RAG_CONTEXT-is tõendatud praktilisi samme ja otsustuskohti, mitte ainult esimest tuttavat mudelit.",
    focus === "assessment"
      ? "Kui allikad kinnitavad, erista kohest turvalisust või kiiret ohuhinnangut, eelhindamist, põhjalikku hindamist, tegevusplaani ja kordushindamist. Hindamisvaldkonnad ei ole eraldi hindamismeetodid. Kirjelda valitud allikates olevaid täiendavaid mudeleid eraldi ja selgita nende rolli; ära esita üht raamistikku ainsa võimalusena."
      : "Kui allikad kinnitavad, erista kohest turvalisust, toetavat kontakti, praktilisi tegevusi ning abi juurde suunamist või järeltegevust.",
    "Need on kaetuse kontrollpunktid, mitte uued tõendid: ära mõtle välja sammu, mudelit, kohustust ega kohalikku kättesaadavust. Märgi ajalooline praktika ja täiendav mudel sellena; ära muuda neid kohustuslikuks praeguseks menetluseks.",
    "Kui valitud allikad ei kinnita olulist etappi või meetodit, nimeta lühidalt see konkreetne piir. Ära väida, et loetled kõik võimalikud meetodid."
  ].join("\n");
}

function buildPersonSourceLookupInstruction(replyLang = "et") {
  if (replyLang === "en") {
    return [
      "PERSON_SOURCE_LOOKUP_MODE:",
      "Distinguish works whose author metadata exactly names the person from works that merely mention or interview them.",
      "For a who-is question, combine only explicit dated role facts with the person's directly authored works; do not reduce the person to one old role when newer attributed evidence is available.",
      "For a what-has-the-author-written question, list themes only from directly authored works and keep the work titles and years attributable."
    ].join("\n");
  }
  return [
    "PERSON_SOURCE_LOOKUP_MODE:",
    "Erista teosed, mille autorimetaandmetes on küsitud isik, tekstidest, mis teda ainult mainivad või intervjueerivad.",
    "Küsimusele „kes on” vasta ainult allikates selgelt kinnitatud ja ajaliselt märgitud rollide ning isiku enda kirjutatud tööde põhjal; ära taanda inimest ühele vanale rollile, kui leidub uuemat atribueeritud tõendit.",
    "Küsimusele „millest autor on kirjutanud” nimeta teemad ainult isiku enda autorsusega töödest ning säilita pealkirjade ja aastate kontrollitav seos."
  ].join("\n");
}

function isReportedPracticeQuestion(message = "") {
  const normalized = normalizeIntentText(message);
  if (!normalized) return false;
  const asksUseOrPractice = /\b(kasuta|kasutatakse|kasutab|kasutavad|kasutus|rakenda|rakendatakse|toimib|praktika|praktikas|naide|näide)\b/.test(normalized);
  const asksAsQuestion = /\b(kas|kuidas|kus|millisel kujul|mismoodi)\b/.test(normalized) || /\?$/.test(String(message || "").trim());
  return asksUseOrPractice && asksAsQuestion;
}

function hasBackgroundPracticeSource(entries = []) {
  return (Array.isArray(entries) ? entries : []).some((entry = {}) => {
    const sourceType = String(entry.sourceType || entry.source_type || "").trim();
    const collectionId = String(entry.collectionId || entry.collection_id || "").trim();
    return sourceType === "journal_article" ||
      sourceType === "methodology_guide" ||
      sourceType === "state_guide" ||
      sourceType === "research_report" ||
      collectionId === "sotsiaaltoo_articles";
  });
}

export function shouldUseReportedPracticeInstruction(message = "", entries = []) {
  return isReportedPracticeQuestion(message) && hasBackgroundPracticeSource(entries);
}

function buildReportedPracticeInstruction(replyLang = "et") {
  if (replyLang === "en") {
    return [
      "REPORTED_PRACTICE_SOURCE_MODE:",
      "If RAG_CONTEXT contains a journal article, study or guide that describes an organization using a tool or practice, do not reject the point merely because the source is not an official current service register.",
      "Answer in source-bounded language: say that the source describes or reports the practice.",
      "If the user explicitly asks about current live operation, distinguish it from the reported use. Otherwise a brief date or past-tense framing is sufficient; do not add a separate current-status disclaimer."
    ].join("\n");
  }
  return [
    "REPORTED_PRACTICE_SOURCE_MODE:",
    "Kui RAG_CONTEXT sisaldab ajakirjaartiklit, uuringut või juhendit, mis kirjeldab mõne organisatsiooni tööriista või praktika kasutamist, ära lükka väidet tagasi ainult seepärast, et allikas ei ole ametlik tänase kasutusoleku register.",
    "Vasta allikaga piiratud sõnastuses: ütle, et allikas kirjeldab või käsitleb seda praktikat.",
    "Kui kasutaja küsib sõnaselgelt tänast kasutusolekut, erista see kirjeldatud kasutusest. Muul juhul piisab lühikesest aastast või ajavormist; ära lisa eraldi tänase seisu hoiatust."
  ].join("\n");
}

function buildMunicipalityListInstruction(replyLang = "et") {
  if (replyLang === "en") {
    return [
      "MUNICIPALITY_LIST_MODE:",
      "When listing municipal services and benefits, list only items explicitly present in RAG_CONTEXT.",
      "If the user asks about both services and benefits, answer both branches separately when both are present in RAG_CONTEXT.",
      "Separate services from benefits/supports. If one side is missing, say the current search did not find sufficient source confirmation for that branch instead of inventing names.",
      "Distinguish direct service pages from broad regulation categories such as 'other services'.",
      "Do not say that you lack access to the whole database. Refer to what the current search could or could not confirm."
    ].join("\n");
  }
  return [
    "MUNICIPALITY_LIST_MODE:",
    "Kui loetled KOV teenuseid ja toetusi, loetle ainult need nimetused, mis on RAG_CONTEXT-is otseselt olemas.",
    "Kui kasutaja kusib nii teenuseid kui toetusi, vasta molema haru kohta eraldi, kui molemad on RAG_CONTEXT-is olemas.",
    "Eralda teenused toetustest. Kui allikad ei anna yhe haru kohta piisavalt infot, ytle loomulikult, et praegune otsing ei leidnud selle kohta piisavat kinnitust; ara leiuta nimetusi juurde.",
    "Erista konkreetseid teenuselehti uldistest maaruse kategooriatest, nt 'muud teenused'.",
    "Kui allikad on leitud, vasta otse ja loomulikus keeles. Ara kasuta valjendeid \"Praegu nahtavas kontekstis\", \"RAG kontekstis\", \"kontekstis ei ole\" ega \"selles vaates ei ole\".",
    "Ara utle, et sul puudub ligipaas kogu andmebaasile. Viita sellele, mida praegune otsing sai voi ei saanud allikate pohjal kinnitada."
  ].join("\n");
}

function buildServiceJurisdictionInstruction(replyLang = "et") {
  if (replyLang === "en") {
    return [
      "SERVICE_JURISDICTION_MODE:",
      "The user is asking whether a service is municipal/local-government or national/state-level.",
      "Answer the classification directly. Do not ask for the municipality merely to classify the service.",
      "If recent conversation identifies a municipality, connect the answer to that municipality only when retrieved sources support it.",
      "Keep national legal framework and municipal implementation distinct."
    ].join("\n");
  }
  if (replyLang === "ru") {
    return [
      "SERVICE_JURISDICTION_MODE:",
      "Пользователь спрашивает, относится ли услуга к муниципальному или государственному уровню.",
      "Ответь на классификацию прямо. Не спрашивай муниципалитет только для того, чтобы классифицировать услугу.",
      "Если в недавнем разговоре указан муниципалитет, связывай ответ с ним только при наличии подтверждения в найденных источниках.",
      "Разделяй государственную правовую рамку и муниципальную организацию услуги."
    ].join("\n");
  }
  return [
    "SERVICE_JURISDICTION_MODE:",
    "Kasutaja küsib, kas teenus on KOV/kohaliku omavalitsuse või riigi tasandi teenus.",
    "Vasta liigitusele otse. Ära küsi omavalitsust ainult teenuse tasandi liigitamiseks.",
    "Kui hiljutisest vestlusest on omavalitsus teada, seo vastus selle omavalitsusega ainult siis, kui leitud allikad seda toetavad.",
    "Erista riiklik õigusraam ja KOV praktiline teenuse korraldus."
  ].join("\n");
}

function buildLegalCitationInstruction(replyLang = "et") {
  if (replyLang === "en") {
    return [
      "LEGAL_CITATION_MODE:",
      "When answering about a law, regulation or legal order, name the exact paragraph number and paragraph title if RAG_CONTEXT shows them.",
      "When the user names a specific law paragraph, answer about that exact paragraph only if the sources confirm it. Do not substitute a semantically similar provision for the requested paragraph.",
      "Do not invent paragraph numbers or quote legal wording that RAG_CONTEXT does not support.",
      "If the legal source support is only general or incomplete, say which part is confirmed and which exact provision the current search did not sufficiently confirm."
    ].join("\n");
  }
  if (replyLang === "ru") {
    return [
      "LEGAL_CITATION_MODE:",
      "Когда отвечаешь о законе, постановлении или порядке, укажи точный номер параграфа и заголовок, если они есть в RAG_CONTEXT.",
      "Не придумывай номера параграфов и не цитируй правовую формулировку, которой нет в RAG_CONTEXT.",
      "Если найденный правовой контекст общий или неполный, скажи, что подтверждено, а какого точного положения не видно."
    ].join("\n");
  }
  return [
    "LEGAL_CITATION_MODE:",
    "Kui vastad seaduse, määruse või korra kohta, nimeta täpne paragrahvinumber ja paragrahvi pealkiri, kui allikad neid kinnitavad.",
    "Kui kasutaja nimetab konkreetse seaduse paragrahvi, vasta selle täpse paragrahvi kohta ainult siis, kui allikad seda kinnitavad. Ära asenda küsitud paragrahvi semantiliselt sarnase sättega.",
    "Ära mõtle paragrahvinumbreid välja ega tsiteeri õiguslikku sõnastust, millele RAG_CONTEXT ei anna tuge.",
    "Kui leitud õiguslik allikatugi on ainult üldine või puudulik, ütle, mida see kinnitab, ja kasuta puuduva detaili kohta sõnastust: \"Ma ei leidnud praeguse otsinguga sellele piisavalt täpset õiguslikku allikakinnitust.\""
  ].join("\n");
}

function exactDocumentIdFromFilteredQueries(queries = []) {
  const entries = Array.isArray(queries) ? queries.filter(Boolean) : [];
  if (!entries.length) return null;
  const values = new Set();
  for (const entry of entries) {
    const filters = entry?.filters;
    if (!filters || typeof filters !== "object" || Array.isArray(filters)) return null;
    const value = ["doc_id", "document_id", "source_id", "canonical_item_id"]
      .map(key => filters[key])
      .find(candidate => typeof candidate === "string" && candidate.trim());
    if (!value) return null;
    values.add(value.trim());
  }
  return values.size === 1 ? Array.from(values)[0] : null;
}

function resolvedShadowYearRoleMentions(originalPlan = null, canonicalPlan = null) {
  const originalMentions = Array.isArray(originalPlan?.semantic_candidates?.year_role_mentions)
    ? originalPlan.semantic_candidates.year_role_mentions
    : [];
  const canonicalMentions = Array.isArray(canonicalPlan?.semantic_candidates?.year_role_mentions)
    ? canonicalPlan.semantic_candidates.year_role_mentions
    : [];
  const mentionKey = mention => {
    const value = String(mention?.value || "");
    const occurrenceIndex = typeof mention?.occurrence_index === "number" &&
      Number.isInteger(mention.occurrence_index) &&
      mention.occurrence_index > 0
      ? mention.occurrence_index
      : null;
    return value && occurrenceIndex !== null ? `${value}:${occurrenceIndex}` : null;
  };
  const resolved = new Map();
  for (const mention of originalMentions) {
    const key = mentionKey(mention);
    if (key) resolved.set(key, mention);
  }
  if (!resolved.size) {
    return canonicalMentions
      .filter(mention => mentionKey(mention))
      .slice(0, 8);
  }
  for (const mention of canonicalMentions) {
    const key = mentionKey(mention);
    if (!key) continue;
    const existing = resolved.get(key);
    if (existing?.role === "ambiguous" && mention?.role !== "ambiguous") {
      resolved.set(key, mention);
    }
  }
  const mentionIndex = mention => typeof mention?.mention_index === "number" &&
    Number.isInteger(mention.mention_index) &&
    mention.mention_index > 0
    ? mention.mention_index
    : Number.MAX_SAFE_INTEGER;
  return Array.from(resolved.values())
    .sort((left, right) => mentionIndex(left) - mentionIndex(right))
    .slice(0, 8);
}

function resolvedShadowRequestedNumericSlots(originalPlan = null, canonicalPlan = null) {
  const original = originalPlan?.semantic_candidates?.requested_numeric_slots;
  const canonical = canonicalPlan?.semantic_candidates?.requested_numeric_slots;
  const recognizedCount = value => typeof value?.recognized_clause_count === "number" &&
    Number.isInteger(value.recognized_clause_count) &&
    value.recognized_clause_count >= 0
    ? value.recognized_clause_count
    : 0;
  const originalRecognizedCount = recognizedCount(original);
  const canonicalRecognizedCount = recognizedCount(canonical);
  if (originalRecognizedCount > 0 && original?.complete === true) return original;
  if (
    canonicalRecognizedCount > 0 &&
    canonical?.complete === true &&
    canonicalRecognizedCount >= originalRecognizedCount
  ) {
    return canonical;
  }
  if (originalRecognizedCount > 0) return original;
  if (canonicalRecognizedCount > 0) return canonical;
  return original || canonical || {
    complete: true,
    recognized_clause_count: 0,
    emitted_slot_count: 0,
    unresolved_clause_count: 0,
    truncated: false,
    slots: []
  };
}

function resolvedShadowRequestedFactSlots(originalPlan = null, canonicalPlan = null) {
  const original = originalPlan?.semantic_candidates?.requested_fact_slots;
  const canonical = canonicalPlan?.semantic_candidates?.requested_fact_slots;
  const slotCount = value => Array.isArray(value?.slots) ? value.slots.length : 0;
  const originalSlotCount = slotCount(original);
  const canonicalSlotCount = slotCount(canonical);
  if (originalSlotCount > 0 && original?.complete === true) return original;
  if (
    canonicalSlotCount > 0 &&
    canonical?.complete === true &&
    canonicalSlotCount >= originalSlotCount
  ) {
    return canonical;
  }
  if (originalSlotCount > 0) return original;
  if (canonicalSlotCount > 0) return canonical;
  return original || canonical || {
    version: "requested_fact_slots_v2",
    complete: true,
    expected_cardinality: null,
    slots: []
  };
}

function resolvedShadowCurrentTurnDocumentIdentity(originalPlan = null, canonicalPlan = null) {
  const original = originalPlan?.semantic_candidates?.current_turn_document_identity;
  const canonical = canonicalPlan?.semantic_candidates?.current_turn_document_identity;
  const identity = value => value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
  const originalIdentity = identity(original);
  const canonicalIdentity = identity(canonical);
  const originalAuthor = originalIdentity?.author?.value ? originalIdentity.author : null;
  const canonicalAuthor = canonicalIdentity?.author?.value ? canonicalIdentity.author : null;
  const originalAuthors = Array.isArray(originalIdentity?.authors) && originalIdentity.authors.length
    ? originalIdentity.authors.filter(item => item?.value)
    : null;
  const canonicalAuthors = Array.isArray(canonicalIdentity?.authors) && canonicalIdentity.authors.length
    ? canonicalIdentity.authors.filter(item => item?.value)
    : null;
  const originalKind = originalIdentity?.document_kind?.value ? originalIdentity.document_kind : null;
  const canonicalKind = canonicalIdentity?.document_kind?.value ? canonicalIdentity.document_kind : null;
  const originalYears = Array.isArray(originalIdentity?.document_source_years) && originalIdentity.document_source_years.length
    ? originalIdentity.document_source_years
    : null;
  const canonicalYears = Array.isArray(canonicalIdentity?.document_source_years) && canonicalIdentity.document_source_years.length
    ? canonicalIdentity.document_source_years
    : [];
  const originalTitle = originalIdentity?.title_hint?.value ? originalIdentity.title_hint : null;
  const canonicalTitle = canonicalIdentity?.title_hint?.value ? canonicalIdentity.title_hint : null;
  const author = originalAuthor || canonicalAuthor || {
    value: null,
    provenance: null,
    confidence: null,
    span_start: null,
    span_end: null,
    input_form: null
  };
  const authors = originalAuthors || canonicalAuthors || (author.value ? [author] : []);
  const documentKind = originalKind || canonicalKind || {
    value: null,
    provenance: null
  };
  const titleHint = originalTitle || canonicalTitle || {
    value: null,
    provenance: null
  };
  const documentSourceYears = originalYears || canonicalYears;
  const explicitAnchorCount = Number(authors.length > 0) +
    Number(Boolean(documentKind.value)) +
    documentSourceYears.length +
    Number(Boolean(titleHint.value));
  return {
    version: "current_turn_document_identity_v1",
    scope: "current_turn",
    history_fallback_policy: "fill_missing_only",
    author,
    authors,
    author_keys: authors.map(item => normalizeIntentText(item.value)).filter(Boolean),
    document_kind: documentKind,
    document_source_years: documentSourceYears,
    title_hint: titleHint,
    explicit_anchor_count: explicitAnchorCount
  };
}

const CURRENT_TURN_AUTHOR_CONFIRMATION_VERSION = "current_turn_author_confirmation_v1";

function sourceAuthorMetadataValues(group = {}) {
  const values = [group?.authors, group?.author, group?.metadata?.authors, group?.metadata?.author]
    .flatMap(value => Array.isArray(value) ? value : [value])
    .flatMap(value => String(value || "").replace(/^\[|\]$/gu, "").split(/\s*(?:;|\||,)\s*/u))
    .map(value => String(value || "").replace(/^['"]|['"]$/gu, "").trim())
    .filter(Boolean);
  return Array.from(new Set(values));
}

function authorMetadataMatchesCandidate(candidate = "", metadataAuthor = "") {
  const candidateUnicode = normalizeIntentText(candidate);
  const metadataUnicode = normalizeIntentText(metadataAuthor);
  if (candidateUnicode && candidateUnicode === metadataUnicode) return "confirmed_exact";
  const candidateLatin = normalizePersonName(candidate);
  const metadataLatin = normalizePersonName(metadataAuthor);
  if (candidateLatin && candidateLatin === metadataLatin) return "confirmed_exact";
  return null;
}

function currentTurnIdentitySourceYears(identityCandidate = null) {
  return Array.from(new Set(
    (Array.isArray(identityCandidate?.document_source_years) ? identityCandidate.document_source_years : [])
      .map(year => String(year?.value || year || "").trim())
      .filter(year => /^(?:19|20)\d{2}$|^2100$/u.test(year))
  )).slice(0, 2);
}

function groupMatchesCurrentTurnDocumentKind(group = {}, documentKind = "") {
  const kind = String(documentKind || "").trim();
  if (!kind || ["document", "publication_verb", "study"].includes(kind)) return true;
  const metadataType = normalizeIntentText([
    group?.sourceType,
    group?.source_type,
    group?.itemType,
    group?.item_type,
    group?.resourceType,
    group?.resource_type
  ].filter(Boolean).join(" "));
  if (kind === "article") {
    const explicitlyReportLike = /(?:^|[^\p{L}\p{N}])(?:report|analysis|aruanne|raport)(?=$|[^\p{L}\p{N}])/u.test(metadataType);
    return isResearchOrJournalSource(group) && !explicitlyReportLike;
  }
  if (!metadataType) return false;
  if (kind === "report") return /(?:^|[^\p{L}\p{N}])(?:report|analysis|aruanne|raport)(?=$|[^\p{L}\p{N}])/u.test(metadataType);
  return true;
}

function groupMatchesCurrentTurnDocumentAnchors(group = {}, identityCandidate = null) {
  const requestedYears = currentTurnIdentitySourceYears(identityCandidate);
  if (requestedYears.length) {
    const groupYear = extractMatchGroupYear(group);
    if (!Number.isInteger(groupYear) || !requestedYears.includes(String(groupYear))) return false;
  }
  const explicitTitleHint = identityCandidate?.title_hint?.provenance === "explicit_current_turn"
    ? normalizeIntentText(identityCandidate?.title_hint?.value || "")
    : "";
  if (
    explicitTitleHint &&
    !canonicalResearchTitleFamilyMatch(explicitTitleHint, group?.title || "").matched
  ) return false;
  return groupMatchesCurrentTurnDocumentKind(group, identityCandidate?.document_kind?.value);
}

function buildCurrentTurnAuthorConfirmation(
  identityCandidate = null,
  retrievedGroups = [],
  languagePlan = null
) {
  const candidates = (Array.isArray(identityCandidate?.authors) && identityCandidate.authors.length
    ? identityCandidate.authors
    : [identityCandidate?.author])
    .filter(candidate => candidate && typeof candidate === "object" && candidate?.value)
    .slice(0, 4);
  const candidate = candidates[0] || null;
  const candidateValues = Array.from(new Set(
    candidates.map(item => String(item?.value || "").trim()).filter(Boolean)
  ));
  const candidateValue = String(candidate?.value || "").trim() || null;
  const candidateProvenance = candidates.length && candidates.every(item => item?.provenance === "explicit_current_turn")
    ? "explicit_current_turn"
    : null;
  const candidateConfidence = candidates.length && candidates.every(item => item?.confidence === "high")
    ? "high"
    : candidates.some(item => item?.confidence === "medium")
      ? "medium"
    : null;
  const candidateDocumentSourceYears = currentTurnIdentitySourceYears(identityCandidate);
  const candidateDocumentKind = String(identityCandidate?.document_kind?.value || "").trim() || null;
  const base = {
    version: CURRENT_TURN_AUTHOR_CONFIRMATION_VERSION,
    candidate_value: candidateValue,
    candidate_values: candidateValues,
    candidate_provenance: candidateProvenance,
    candidate_confidence: candidateConfidence,
    candidate_document_source_years: candidateDocumentSourceYears,
    candidate_document_kind: candidateDocumentKind,
    status: candidateValues.length ? "no_author_metadata" : "no_candidate",
    matched_source_count: 0,
    matched_document_ids: [],
    matched_author_values: [],
    promotion_eligible: false,
    confirmation_source: "retrieved_source_metadata"
  };
  if (!candidateValues.length) return base;

  const entries = (Array.isArray(retrievedGroups) ? retrievedGroups : [])
    .map((group, index) => ({
      group,
      documentId: researchGroupDocumentId(group, index),
      authors: sourceAuthorMetadataValues(group)
    }))
    .filter(entry => entry.authors.length && groupMatchesCurrentTurnDocumentAnchors(entry.group, identityCandidate));
  if (!entries.length) return base;

  const transliterationCandidate = languagePlan?.transliterationUsed === true
    ? String(languagePlan?.canonicalPersonName || "").trim()
    : "";
  const matched = [];
  for (const entry of entries) {
    const authorMatches = candidateValues.map(value => {
      for (const author of entry.authors) {
        const status = authorMetadataMatchesCandidate(value, author);
        if (status) return { author, status };
      }
      if (candidateValues.length === 1 && transliterationCandidate) {
        const author = entry.authors.find(value =>
          authorMetadataMatchesCandidate(transliterationCandidate, value)
        );
        if (author) return { author, status: "confirmed_existing_transliteration" };
      }
      return null;
    });
    if (authorMatches.every(Boolean)) matched.push({
      documentId: entry.documentId,
      authors: authorMatches.map(item => item.author),
      statuses: authorMatches.map(item => item.status)
    });
  }
  if (!matched.length) return {
    ...base,
    status: "not_confirmed"
  };

  const matchedStatuses = new Set(matched.flatMap(entry => entry.statuses));
  const status = matchedStatuses.size === 1 && matchedStatuses.has("confirmed_exact")
    ? "confirmed_exact"
    : "confirmed_existing_transliteration";
  const matchedDocumentIds = Array.from(new Set(
    matched.map(entry => String(entry.documentId || "").trim()).filter(Boolean)
  )).slice(0, 8);
  const matchedAuthorValues = Array.from(new Set(
    matched.flatMap(entry => entry.authors).map(entry => String(entry || "").trim()).filter(Boolean)
  )).slice(0, 8);
  return {
    ...base,
    status,
    matched_source_count: matchedDocumentIds.length,
    matched_document_ids: matchedDocumentIds,
    matched_author_values: matchedAuthorValues,
    promotion_eligible: candidateProvenance === "explicit_current_turn" &&
      candidateConfidence === "high" &&
      status === "confirmed_exact" &&
      matchedDocumentIds.length === 1
  };
}

function resolveQuestionSemanticCandidates(originalPlan = null, canonicalPlan = null) {
  const original = originalPlan?.semantic_candidates;
  const canonical = canonicalPlan?.semantic_candidates;
  if (!original && !canonical) return null;
  return {
    version: "question_semantic_candidates_v1",
    year_role_mentions: resolvedShadowYearRoleMentions(originalPlan, canonicalPlan),
    requested_numeric_slots: resolvedShadowRequestedNumericSlots(originalPlan, canonicalPlan),
    requested_fact_slots: resolvedShadowRequestedFactSlots(originalPlan, canonicalPlan),
    current_turn_document_identity: resolvedShadowCurrentTurnDocumentIdentity(originalPlan, canonicalPlan)
  };
}

function morphologyLexicalTerms(morphology = null) {
  const tokens = Array.isArray(morphology?.tokens) ? morphology.tokens : [];
  return Array.from(new Set(
    tokens.flatMap(token => [
      ...(Array.isArray(token?.lemmas) ? token.lemmas : []),
      ...(Array.isArray(token?.root_tokens) ? token.root_tokens : [])
    ])
      .map(value => String(value || "").trim().toLowerCase())
      .filter(value => value && value.length <= 120)
  )).slice(0, 64);
}

export async function assembleRetrievalContext({
  payloadAudience,
  // Test-only override for the graph channel: set by an authenticated chat
  // payload (graphChannelTest), lets eval compare flag-on behavior without
  // enabling RAG_GRAPH_CHANNEL_ENABLED for end users.
  graphChannelTestOverride = false,
  normalizedRole,
  rawHistory,
  trustedRagRecoveryState = null,
  effectiveMessage,
  forceSources,
  forcedMode,
  hasHistory,
  replyLang,
  languagePlan = null,
  ephemeralChunks,
  ephemeralSource,
  combineSources,
  userId,
  convId,
  isCrisis,
  logInfo,
  logError,
  logEvent,
  buildMissingMunicipalityInstruction,
  buildSourceLookupInstruction,
    docContextBudgets,
    onBeforeRag = null,
    // B0b: minimaalne dependency-injection ainult testimiseks. Tootmises jääb
    // määramata ja kasutatakse päris searchRagQueries'it.
    searchRagQueriesImpl = null
}) {
  const assemblyStartedAt = performance.now();
  const runRagSearchImpl = typeof searchRagQueriesImpl === "function"
    ? searchRagQueriesImpl
    : searchRagQueries;
  const retrievalTimings = [];
  const retrievalWindows = [];
  const runRagSearch = async (options = {}) => {
    const startedAt = performance.now();
    try {
      return await runRagSearchImpl({
        ...options,
        queryLanguage: options.queryLanguage || languagePlan?.queryLanguage || "unknown",
        lexicalTerms: Array.isArray(options.lexicalTerms)
          ? options.lexicalTerms
          : morphologyLexicalTerms(morphology),
        onTiming: timing => {
          if (!timing || typeof timing !== "object") return;
          retrievalTimings.push({
            request_id: typeof timing.request_id === "string" ? timing.request_id.slice(0, 200) : null,
            observabilityStage: typeof timing.observabilityStage === "string"
              ? timing.observabilityStage.slice(0, 100)
              : null,
            embedding_duration_ms: finiteOptionalNumber(timing.embedding_duration_ms),
            dense_duration_ms: finiteOptionalNumber(timing.dense_duration_ms),
            registry_duration_ms: finiteOptionalNumber(timing.registry_duration_ms),
            lexical_duration_ms: finiteOptionalNumber(timing.lexical_duration_ms),
            lemma_fts_shadow_duration_ms: finiteOptionalNumber(timing.lemma_fts_shadow_duration_ms),
            lemma_fts_shadow: timing.lemma_fts_shadow && typeof timing.lemma_fts_shadow === "object"
              ? timing.lemma_fts_shadow
              : null,
            document_sibling_duration_ms: finiteOptionalNumber(timing.document_sibling_duration_ms),
            fact_segment_duration_ms: finiteOptionalNumber(timing.fact_segment_duration_ms),
            shared_read_cache_hits: finiteOptionalNumber(timing.shared_read_cache_hits),
            shared_read_cache_waits: finiteOptionalNumber(timing.shared_read_cache_waits),
            shared_read_cache_misses: finiteOptionalNumber(timing.shared_read_cache_misses),
            shared_read_cache_bypasses: finiteOptionalNumber(timing.shared_read_cache_bypasses),
            shared_embedding_batch_hits: finiteOptionalNumber(timing.shared_embedding_batch_hits),
            shared_embedding_batch_waits: finiteOptionalNumber(timing.shared_embedding_batch_waits),
            shared_embedding_batch_misses: finiteOptionalNumber(timing.shared_embedding_batch_misses),
            shared_embedding_batch_bypasses: finiteOptionalNumber(timing.shared_embedding_batch_bypasses),
            lexical_scanned: finiteOptionalNumber(timing.lexical_scanned),
            lexical_exhaustive: timing.lexical_exhaustive === true,
            lexical_strategy: typeof timing.lexical_strategy === "string"
              ? timing.lexical_strategy.slice(0, 80)
              : null,
            retriever_duration_ms: finiteOptionalNumber(timing.retriever_duration_ms),
            retrieval_total_ms: finiteOptionalNumber(timing.retrieval_total_ms),
            retrieval_timeout_ms: finiteOptionalNumber(timing.retrieval_timeout_ms),
            aborted_stage: typeof timing.aborted_stage === "string"
              ? timing.aborted_stage.slice(0, 100)
              : null,
            time_since_previous_rag_request_ms: finiteOptionalNumber(timing.time_since_previous_rag_request_ms),
            http_status: finiteOptionalNumber(timing.http_status),
            outcome: typeof timing.outcome === "string" ? timing.outcome.slice(0, 40) : null
          });
        }
      });
    } finally {
      retrievalWindows.push({ startedAt, endedAt: performance.now() });
    }
  };
  const plannerStartedAt = performance.now();
  let morphology = null;
  const initialQueryLanguage = String(languagePlan?.queryLanguage || "unknown").toLowerCase();
  const shouldAnalyzeEstonianQuery =
    ["et", "unknown"].includes(initialQueryLanguage) &&
    !/[\u0400-\u04ff]/u.test(String(effectiveMessage || ""));
  if (shouldAnalyzeEstonianQuery) {
    try {
      morphology = await analyzeRagQuery(effectiveMessage);
    } catch (error) {
      if (typeof logError === "function") {
        logError("rag.query_analysis.error", {
          name: String(error?.name || "Error").slice(0, 80),
          code: String(error?.code || "QUERY_ANALYSIS_FAILED").slice(0, 80)
        });
      }
    }
  }
  languagePlan = refineChatLanguagePlanWithMorphology(languagePlan, morphology);
  const currentMessageMunicipalities = await detectMentionedMunicipalitiesFromUserText([], effectiveMessage, {
    logError
  });
  const originalQuestionPlan = buildQuestionPlan({
    message: effectiveMessage,
    role: normalizedRole,
    semanticInputForm: "original",
    morphology,
    resolvedMunicipalities: currentMessageMunicipalities
  });
  const shadowQuestionPlan = languagePlan?.canonicalQueryEt
    ? buildQuestionPlan({
        message: languagePlan.canonicalQueryEt,
        role: normalizedRole,
        semanticInputForm: "canonical_fallback",
        resolvedMunicipalities: currentMessageMunicipalities
      })
    : null;
  const canonicalRetrievalActive = shouldActivateCanonicalAuthorRetrieval(
    languagePlan,
    shadowQuestionPlan
  );
  const canonicalSupplementalRetrievalActive = shouldActivateCanonicalSupplementalRetrieval(languagePlan);
  const selectedQuestionPlan = canonicalRetrievalActive
    ? {
        ...shadowQuestionPlan,
        person_topic_terms: Array.isArray(languagePlan?.controlledTopicTermsEt)
          ? languagePlan.controlledTopicTermsEt
          : [],
        person_coauthor_names: Array.isArray(languagePlan?.canonicalCoauthorNames)
          ? languagePlan.canonicalCoauthorNames
          : [],
        person_coauthor_requested: languagePlan?.coauthorRequested === true,
        person_name_transliterated: languagePlan?.transliterationUsed === true
      }
    : originalQuestionPlan;
  const resolvedSemanticCandidates = resolveQuestionSemanticCandidates(
    originalQuestionPlan,
    shadowQuestionPlan
  );
  let questionPlan = resolvedSemanticCandidates
    ? {
        ...selectedQuestionPlan,
        semantic_candidates: resolvedSemanticCandidates
      }
    : selectedQuestionPlan;
  const canonicalRetrievalTermsEt = Array.from(new Set(
    (Array.isArray(languagePlan?.retrievalTermsEt) ? languagePlan.retrievalTermsEt : [])
      .map(value => String(value || "").trim())
      .filter(Boolean)
  )).slice(0, 16);
  questionPlan = {
    ...questionPlan,
    retrieval_terms_et: canonicalRetrievalTermsEt
  };
  let semanticTurnContract = buildSemanticTurnContract({
    message: effectiveMessage,
    languagePlan,
    questionPlan,
    morphology
  });
  questionPlan = {
    ...questionPlan,
    semantic_turn_contract: semanticTurnContract,
    history_reference: semanticTurnContract.history_reference
  };
  let ragRiskPolicy = classifyRagRisk(effectiveMessage, {
    isCrisis,
    role: normalizedRole,
    semanticContract: semanticTurnContract
  });
  const retrievalMessage = canonicalRetrievalActive
    ? languagePlan.canonicalQueryEt
    : canonicalSupplementalRetrievalActive &&
        questionPlan?.mode === "specific_research_fact" &&
        canonicalRetrievalTermsEt.length
      ? `${effectiveMessage}\nET_RETRIEVAL_TERMS: ${canonicalRetrievalTermsEt.join(" ")}`
      : effectiveMessage;
  const safeLanguagePlanTrace = buildSafeLanguagePlanTrace(languagePlan, shadowQuestionPlan, {
    canonicalRetrievalActive,
    canonicalSupplementalRetrievalActive
  });
  const plannerDurationMs = monotonicDurationMs(plannerStartedAt);
  const currentTurnDocumentIdentity = questionPlan?.semantic_candidates?.current_turn_document_identity;
  const currentTurnSourceYears = currentTurnIdentitySourceYears(currentTurnDocumentIdentity);
  const currentTurnTemporalPlan = buildTemporalRetrievalPlan({
    message: retrievalMessage,
    history: [],
    baseQuery: "",
    periodRole: questionPlan?.period_role || null,
    yearRoleMentions: questionPlan?.semantic_candidates?.year_role_mentions,
    evidencePeriodYears: questionPlan?.evidence_period_years
  });
  const explicitCurrentAuthorDocumentAnchor =
    currentTurnDocumentIdentity?.author?.provenance === "explicit_current_turn" &&
    currentTurnDocumentIdentity?.author?.confidence === "high" &&
    (
      currentTurnSourceYears.length > 0 ||
      String(currentTurnDocumentIdentity?.title_hint?.value || "").trim().length > 0
    );
  const explicitCurrentKindYearDocumentAnchor =
    currentTurnDocumentIdentity?.document_kind?.provenance === "explicit_current_turn" &&
    currentTurnSourceYears.length > 0;
  const explicitCurrentTitleDocumentAnchor =
    currentTurnDocumentIdentity?.title_hint?.provenance === "explicit_current_turn" &&
    String(currentTurnDocumentIdentity?.title_hint?.value || "").trim().length > 0;
  const currentTurnRefersToPreviousSource =
    semanticTurnContract?.history_reference?.explicit_source_anaphora === true;
  const suppressHistoryForExplicitCurrentDocument =
    questionPlan?.mode === "specific_research_fact" &&
    (
      explicitCurrentTitleDocumentAnchor ||
      (
        !currentTurnRefersToPreviousSource &&
        (
          explicitCurrentAuthorDocumentAnchor ||
          explicitCurrentKindYearDocumentAnchor
        )
      )
    );
  const suppressHistoryForSelfContainedTemporalBreakdown =
    !currentTurnRefersToPreviousSource &&
    isSelfContainedTemporalBreakdownTurn(retrievalMessage, currentTurnTemporalPlan);
  const retrievalHistory =
    canonicalRetrievalActive ||
    suppressHistoryForExplicitCurrentDocument ||
    suppressHistoryForSelfContainedTemporalBreakdown
      ? []
      : rawHistory;
  const previousSourceUseRequest = detectPreviousSourceUseRequest(retrievalHistory, effectiveMessage);
  const sourceLookupRequest = !previousSourceUseRequest && detectSourceAvailabilityRequest(retrievalHistory, effectiveMessage);
  const recentAssistantSourcesAvailable = hasRecentAssistantSources(retrievalHistory);
  const questionPlanForcesRag =
    questionPlan?.needs_rag === true &&
    questionPlan?.mode &&
    questionPlan.mode !== "default";
  const externalSourcesNeeded = shouldUseExternalSourcesForTurn(effectiveMessage, {
    forceSources,
    defaultToExternalSources: forcedMode === "rag" || questionPlanForcesRag,
    hasHistory: Array.isArray(retrievalHistory) ? retrievalHistory.length > 0 : hasHistory,
    hasRecentAssistantSources: recentAssistantSourcesAvailable,
    sourceLookupRequest,
    previousSourceUseRequest
  });
  const sourceLookupCombinedText = sourceLookupRequest
    ? [effectiveMessage, ...extractRecentUserText(retrievalHistory, 8)].join("\n")
    : "";
  const legalFollowupMessage = isContextDependentRetrievalTurn(effectiveMessage) &&
    /\b(?:selle|sellest|selles|sama)\s+paragrahv\w*/u.test(normalizeIntentText(effectiveMessage)) &&
    extractParagraphReferences(effectiveMessage).length === 0
    ? [effectiveMessage, ...extractRecentUserText(retrievalHistory, 1)].join("\n")
    : "";
  const sourceLookupSubject = sourceLookupRequest
    ? inferSourceLookupSubject(sourceLookupCombinedText)
    : "";
  const sourceLookupParagraphRefs = sourceLookupRequest ? extractParagraphReferences(sourceLookupCombinedText) : [];
  const sourceLookupTargetsNationalLaw = sourceLookupRequest &&
    isNationalLawSourceLookup(sourceLookupSubject, sourceLookupCombinedText);
  // A selected single-document fact route owns its context budget. Words such
  // as "kogemused" inside a named article must not reactivate overview cuts.
  const synthesisHeuristicsAllowed = !["specific_research_fact", "professional_method_guidance"].includes(questionPlan.mode);
  const thematicSynthesisQuestion = !sourceLookupRequest && synthesisHeuristicsAllowed && isThematicSynthesisRagQuestion(effectiveMessage);
  const broadMultiSourceQuestion = !sourceLookupRequest && synthesisHeuristicsAllowed && isBroadMultiSourceRagQuestion(effectiveMessage);
  const sourceSetListingFollowup = isPluralSourceSetFollowup(effectiveMessage);

  const audienceFilter = payloadAudience === "CLIENT" || normalizedRole === "CLIENT"
    ? {
        // Legacy documents have no marker and remain eligible as v0. A source
        // explicitly superseded by the lifecycle must never reach retrieval.
        is_current_version: { $ne: false },
        audience: {
          $in: ["CLIENT", "BOTH"]
        }
      }
    : {
        is_current_version: { $ne: false },
        audience: {
          $in: ["SOCIAL_WORKER", "BOTH"]
        }
      };

  const contextualCurrentMunicipalityStaffingFollowup = isContextualCurrentMunicipalStaffingFollowup(
    effectiveMessage,
    retrievalHistory,
    { hasExplicitMunicipality: currentMessageMunicipalities.length > 0 }
  );
  const contextualMunicipalityContactFollowup = isContextualMunicipalityContactFollowup(
    effectiveMessage,
    retrievalHistory
  );
  const carryMunicipalityFromHistory = !currentMessageMunicipalities.length && (
    shouldCarryMunicipalityFromHistory(effectiveMessage) ||
    contextualCurrentMunicipalityStaffingFollowup ||
    contextualMunicipalityContactFollowup
  );
  const contactFollowupAnchorText = contextualCurrentMunicipalityStaffingFollowup || contextualMunicipalityContactFollowup
    ? lastAssistantServiceMapMunicipalityText(retrievalHistory) || extractRecentUserText(retrievalHistory, 1).join("\n")
    : "";
  const mentionedMunicipalities = carryMunicipalityFromHistory
    ? contactFollowupAnchorText
      ? await detectMentionedMunicipalitiesFromUserText([], `${contactFollowupAnchorText}\n${effectiveMessage}`, {
          logError
        })
      : await detectMentionedMunicipalitiesFromUserText(retrievalHistory, effectiveMessage, {
          logError
        })
    : currentMessageMunicipalities;
  const effectiveMunicipalities = currentMessageMunicipalities.length
    ? currentMessageMunicipalities
    : carryMunicipalityFromHistory
      ? mentionedMunicipalities
      : [];
  const currentServiceBenefitIntent = detectServiceBenefitIntent(effectiveMessage);
  const normalizedMunicipalityQuestion = normalizeIntentText(effectiveMessage);
  const contactMonitorSubjectCue = /(?:^|[^\p{L}\p{N}])(?:kov|omavalits\p{L}*|kontakt\p{L}*|contact\p{L}*|municipal\p{L}*|контакт\p{L}*|муниципал\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalizedMunicipalityQuestion);
  const contactMonitorPlatformActor = hasServiceMapMonitorActor(normalizedMunicipalityQuestion);
  const contactMonitorPassiveCadence = isPassiveContactCheckCadenceRequest(normalizedMunicipalityQuestion);
  const contactMonitorCadenceCue = hasContactCheckCadenceCue(normalizedMunicipalityQuestion);
  const automaticContactCheckCue = hasAutomaticContactCheckCue(normalizedMunicipalityQuestion);
  const externalContactMonitorQuestion =
    isContactFreshnessRequest(normalizedMunicipalityQuestion) &&
    (automaticContactCheckCue || contactMonitorCadenceCue) &&
    contactMonitorSubjectCue &&
    !contactMonitorPlatformActor &&
    !contactMonitorPassiveCadence;
  const serviceMapContactMonitorRequest =
    !isCrisis &&
    !hasIndependentContactSourceCue(normalizedMunicipalityQuestion) &&
    isContactFreshnessRequest(normalizedMunicipalityQuestion) &&
    (contactMonitorPlatformActor || contactMonitorPassiveCadence) &&
    (automaticContactCheckCue || contactMonitorCadenceCue) &&
    contactMonitorSubjectCue;
  const municipalityStaffingCountRequest =
    isMunicipalStaffingCountFact(normalizedMunicipalityQuestion) ||
    contextualCurrentMunicipalityStaffingFollowup;
  const currentMunicipalityStaffingCountRequest =
    isCurrentMunicipalStaffingCountFact(normalizedMunicipalityQuestion) ||
    contextualCurrentMunicipalityStaffingFollowup;
  const legalSourceQuestion =
    /\b(seadus|shs|maarus|määrus|riigi teataja|riigiteataja|paragrahv|§|oigusakt|õigusakt)\b/.test(normalizedMunicipalityQuestion) ||
    /\b(?:abi andmise|teenuse osutamise|taotluse menetlemise) kord\b/.test(normalizedMunicipalityQuestion);
  const municipalityHelpActionRequest =
    isMunicipalityDependentSocialHelpQuestion(effectiveMessage) &&
    /\b(kuidas|kust|kuhu|kelle poole|kas saab|kas saan|on olemas|pakub|pakuvad|taotl\w*|poordu\w*|pöördu\w*)\b/.test(normalizedMunicipalityQuestion);
  const municipalityServiceOrBenefitRequest =
    questionPlan?.mode === "kov_service_or_benefit" ||
    isMunicipalityServiceBenefitListRequest(effectiveMessage) ||
    municipalityHelpActionRequest ||
    (
      (currentServiceBenefitIntent.wantsServices || currentServiceBenefitIntent.wantsBenefits) &&
      /\b(kuidas|kust|kuhu|kas saab|kas saan|on olemas|pakub|pakuvad|taotl\w*|tingimus\w*|oigus\w*|õigus\w*|tasu\w*|hind\w*|kontakt\w*)\b/.test(normalizedMunicipalityQuestion)
    );
  const currentMunicipalityContactEvidenceRequested =
    !isCrisis &&
    !hasIndependentContactSourceCue(normalizedMunicipalityQuestion) &&
    !externalContactMonitorQuestion &&
    (
      contextualCurrentMunicipalityStaffingFollowup ||
      contextualMunicipalityContactFollowup ||
      isMunicipalityContactInventoryRequest(effectiveMessage, retrievalHistory) ||
      hasContactRequestTerm(normalizedMunicipalityQuestion)
    );
  const pureCurrentMunicipalityContactIntent =
    currentMunicipalityContactEvidenceRequested &&
    (
      !hasAnyServiceOrBenefitTerm(normalizedMunicipalityQuestion) ||
      isPureContactUseOfServiceBenefitTerm(normalizedMunicipalityQuestion)
    );
  // A place-name mention is not itself a request for current municipal service
  // data. Journal and research questions often compare facts from several
  // towns; scoping those turns to KOV collections hides the cited article.
  const explicitMunicipalityScopeIntent =
    municipalityServiceOrBenefitRequest ||
    currentMunicipalityContactEvidenceRequested ||
    legalSourceQuestion ||
    municipalityHelpActionRequest;
  const allowMunicipalityScopedRag =
    effectiveMunicipalities.length === 1 &&
    !sourceLookupTargetsNationalLaw &&
    explicitMunicipalityScopeIntent;
  let serviceMapKovContacts = [];
  let serviceMapKovContactLoadState = allowMunicipalityScopedRag ? "zero" : "not_requested";
  if (allowMunicipalityScopedRag) {
    try {
      serviceMapKovContacts = await loadServiceMapKovContactsForMunicipalities(effectiveMunicipalities);
      serviceMapKovContactLoadState = serviceMapKovContacts.length ? "resolved" : "zero";
    } catch (err) {
      if (typeof logError === "function") {
        logError("service_map_contacts.load_failed", {
          err: err?.message || String(err),
          municipalities: effectiveMunicipalities.map((item) => item.displayName).filter(Boolean)
        });
      }
      serviceMapKovContacts = [];
      serviceMapKovContactLoadState = "failed";
    }
  }
  const municipalityContactRequest =
    allowMunicipalityScopedRag && pureCurrentMunicipalityContactIntent;
  const completeContactListRequest = isCompleteKovContactListRequest(effectiveMessage);
  const activeContactScope = currentMunicipalityContactEvidenceRequested
    ? resolveActiveContactScope(serviceMapKovContacts, effectiveMessage, retrievalHistory, {
        contextual: contextualCurrentMunicipalityStaffingFollowup || contextualMunicipalityContactFollowup
      })
    : null;
  const serviceMapKovContactRows = municipalityContactRequest ||
    hasContactRequestTerm(normalizedMunicipalityQuestion) ||
    municipalityServiceOrBenefitRequest
    ? serviceMapContactRowsForMessage(serviceMapKovContacts, effectiveMessage, {
        complete: completeContactListRequest,
        activeScope: activeContactScope
      })
    : [];
  const serviceMapKovContactContext = buildServiceMapKovContactContext(serviceMapKovContacts, {
    rowEntries: serviceMapKovContactRows,
    activeScope: activeContactScope
  });
  const municipalityServiceBenefitListRequest =
    allowMunicipalityScopedRag && !municipalityContactRequest && (
      isMunicipalityServiceBenefitTurn(effectiveMessage, retrievalHistory) ||
      isContextualServiceBenefitListFollowup(effectiveMessage, retrievalHistory)
    );
  const targetGroupFollowup = hasTargetGroupTerm(normalizeIntentText(effectiveMessage));
  const serviceJurisdictionQuestion = isServiceJurisdictionClassificationQuestion(effectiveMessage);
  const nationalServiceBenefitQuestion =
    isNationalServiceBenefitQuestion(effectiveMessage) ||
    isNationalServiceBenefitFollowup(effectiveMessage, retrievalHistory);
  const municipalityServiceBenefitRagRequest =
    allowMunicipalityScopedRag &&
    (
      municipalityServiceBenefitListRequest ||
      (!municipalityStaffingCountRequest && (currentServiceBenefitIntent.wantsServices || currentServiceBenefitIntent.wantsBenefits)) ||
      targetGroupFollowup
    );
  const overviewSynthesisQuestion =
    thematicSynthesisQuestion &&
    broadMultiSourceQuestion &&
    !allowMunicipalityScopedRag &&
    !municipalityServiceBenefitListRequest &&
    !municipalityServiceBenefitRagRequest &&
    !nationalServiceBenefitQuestion &&
    !serviceJurisdictionQuestion &&
    !sourceLookupTargetsNationalLaw;
  const resourceDiscoveryQuestion =
    questionPlan.mode === "resource_discovery" &&
    !sourceLookupRequest &&
    !overviewSynthesisQuestion &&
    !allowMunicipalityScopedRag &&
    !municipalityServiceBenefitListRequest &&
    !municipalityServiceBenefitRagRequest &&
    !nationalServiceBenefitQuestion &&
    !serviceJurisdictionQuestion &&
    !sourceLookupTargetsNationalLaw;
  const personSourceLookupQuestion =
    questionPlan.mode === "person_source_lookup" &&
    !sourceLookupRequest &&
    !allowMunicipalityScopedRag &&
    !sourceLookupTargetsNationalLaw;
  const specificResearchFactQuestion =
    questionPlan.mode === "specific_research_fact" &&
    !sourceLookupRequest &&
    !allowMunicipalityScopedRag &&
    !sourceLookupTargetsNationalLaw;
  const specificDocumentQuestion =
    (questionPlan.mode === "specific_document_summary" || questionPlan.mode === "specific_document_question") &&
    !sourceLookupRequest &&
    !allowMunicipalityScopedRag &&
    !sourceLookupTargetsNationalLaw;
  const professionalMethodGuidanceQuestion =
    questionPlan.mode === "professional_method_guidance" &&
    !sourceLookupRequest &&
    !allowMunicipalityScopedRag &&
    !municipalityServiceBenefitListRequest &&
    !municipalityServiceBenefitRagRequest &&
    !nationalServiceBenefitQuestion &&
    !serviceJurisdictionQuestion &&
    !sourceLookupTargetsNationalLaw;
  const municipalityServiceBenefitIntent = municipalityServiceBenefitListRequest
    ? detectServiceBenefitTurnIntent(effectiveMessage, retrievalHistory)
    : currentServiceBenefitIntent.wantsServices || currentServiceBenefitIntent.wantsBenefits
      ? currentServiceBenefitIntent
      : targetGroupFollowup
        ? {
            wantsServices: true,
            wantsBenefits: true
          }
      : {
          wantsServices: true,
          wantsBenefits: true
        };
  const municipalityQuestionNeedsClarification =
    !allowMunicipalityScopedRag &&
    !serviceJurisdictionQuestion &&
    !nationalServiceBenefitQuestion &&
    isMunicipalityDependentSocialHelpQuestion(effectiveMessage);
  const baseRagQueryText = sourceLookupRequest
    ? buildSourceLookupSearchQuery(effectiveMessage, retrievalHistory)
    : serviceJurisdictionQuestion
      ? buildServiceJurisdictionQuery(effectiveMessage)
    : nationalServiceBenefitQuestion
      ? buildNationalServiceBenefitQuery(effectiveMessage)
    : buildRagSearchQuery(
        retrievalMessage,
        retrievalHistory,
        trustedRagRecoveryState
      );
  const temporalRetrievalPlan = sourceLookupRequest
    ? {
        enabled: false,
        years: [],
        preferredYears: [],
        preferredYearsSource: "not_applied",
        typedYearRoleMentionsAvailable: false,
        ambiguousYearCount: 0,
        focusText: "",
        queries: baseRagQueryText ? [baseRagQueryText] : []
      }
    : buildTemporalRetrievalPlan({
        message: retrievalMessage,
        history: retrievalHistory,
        baseQuery: baseRagQueryText,
        periodRole: questionPlan?.period_role || null,
        yearRoleMentions: questionPlan?.semantic_candidates?.year_role_mentions,
        evidencePeriodYears: questionPlan?.evidence_period_years
      });
  const temporalCoverageYearRole = temporalRetrievalPlan.qualitativeSynthesisRequested === true
    ? "publication_year"
    : semanticTurnContract?.temporal?.requested_year_role;
  const journalChunksPerDocument = (
    broadMultiSourceQuestion ||
    overviewSynthesisQuestion ||
    resourceDiscoveryQuestion ||
    personSourceLookupQuestion ||
    sourceSetListingFollowup ||
    temporalRetrievalPlan.enabled ||
    municipalityContactRequest ||
    municipalityServiceBenefitListRequest ||
    municipalityServiceBenefitRagRequest ||
    nationalServiceBenefitQuestion ||
    serviceJurisdictionQuestion ||
    sourceLookupTargetsNationalLaw
  ) ? 3 : 8;
  const topicHints = extractTopicHints(temporalRetrievalPlan.focusText || retrievalMessage);
  const extraSystemInstructions = [
    ...(/\b(?:ajakiri|ajakirja\w*)\s+sotsiaaltoo\b/u.test(normalizeIntentText(effectiveMessage)) ? [
      "EXPLICIT_PUBLICATION_SCOPE: The user explicitly names a journal as the source scope. Answer the requested topic from the selected journal articles; do not ask what the already identified journal name means. If no relevant article supports the topic, state that evidence limitation."
    ] : []),
    ...(isInstitutionalApplicationGuidance(effectiveMessage) ? [
      "INSTITUTIONAL_APPLICATION_GUIDANCE: Answer the requested application/form and submission destination from the selected service evidence. A question about where or whom to approach with an application may be answered at the institution or role level. Do not invent a named worker, phone or email; exact personal contact details require separately verified contact evidence. Missing personal contacts must not erase supported application guidance."
    ] : []),
    ...(municipalityQuestionNeedsClarification
      ? [buildMissingMunicipalityInstruction(normalizedRole, replyLang)]
      : []),
    ...(sourceLookupRequest ? [buildSourceLookupInstruction(replyLang)] : []),
    ...(!sourceLookupRequest && externalSourcesNeeded ? [buildLayeredContextInstruction(replyLang)] : []),
    ...(resourceDiscoveryQuestion ? [buildResourceDiscoveryInstruction(replyLang)] : []),
    ...(professionalMethodGuidanceQuestion
      ? [buildProfessionalMethodGuidanceInstruction(replyLang, questionPlan.method_guidance_focus)]
      : []),
    ...(personSourceLookupQuestion ? [buildPersonSourceLookupInstruction(replyLang)] : []),
    ...(sourceSetListingFollowup ? [
      "SOURCE_SET_LISTING_MODE: Küsimus viitab eelmises vastuses kuvatud allikate täpsele kogumile. Loetle iga RAG_CONTEXT-is oleva valitud allika pealkiri täpselt ühe korra. Ära lisa muudest dokumentidest pealkirju ega jäta valitud allikat välja."
    ] : []),
    ...(personSourceLookupQuestion && questionPlan?.person_coauthor_requested ? [
      "COAUTHORSHIP_CONTRACT: Kui nimetad valitud töö kaasautoreid, kopeeri täielik autoriloend valitud allika metaandmetest. Ära jäta mõnda kaasautorit välja ega lisa nime, mida metadata ei kinnita."
    ] : []),
    ...(specificResearchFactQuestion ? [
      "DOCUMENT_IDENTITY_FIRST: see on ühe konkreetse uuringu, artikli või aruande faktiküsimus. Tuvasta esmalt küsitud dokument autori, teema, pealkirja ja registritunnuste järgi. Kasuta arvulisi või meetodifakte ainult sellest tuvastatud dokumendist; ära asenda neid sama teema teise uuringu arvudega."
    ] : []),
    ...(specificDocumentQuestion ? [
      "SPECIFIC_DOCUMENT_FIRST: vasta kõrgeima asetusega nimepidi küsitud dokumendi täieliku RAG_CONTEXT-i põhjal. Ära lisa naaberdokumentide juhiseid ega väida, et dokumendi hilisem osa puudub, kui see on valitud dokumendi kontekstis olemas."
    ] : []),
    ...(overviewSynthesisQuestion ? [buildOverviewSynthesisInstruction(replyLang)] : []),
    ...(thematicSynthesisQuestion && !overviewSynthesisQuestion ? [buildThematicSynthesisInstruction(replyLang)] : []),
    ...(shouldUseNumericScopeInstruction(effectiveMessage) ? [buildNumericScopeInstruction(replyLang)] : []),
    ...(externalSourcesNeeded && ragRiskPolicy.riskLevel !== "low"
      ? [buildRiskPolicyInstruction(ragRiskPolicy, replyLang)]
      : []),
    ...((legalSourceQuestion || sourceLookupTargetsNationalLaw || nationalServiceBenefitQuestion || serviceJurisdictionQuestion)
      ? [buildLegalCitationInstruction(replyLang)]
      : []),
    ...(serviceJurisdictionQuestion ? [buildServiceJurisdictionInstruction(replyLang)] : []),
    ...(municipalityServiceBenefitRagRequest ? [buildMunicipalityListInstruction(replyLang)] : []),
    ...(municipalityContactRequest ? [
      "MUNICIPALITY_CONTACT_INVENTORY_MODE: kasuta olemasolu korral selle KOV-i SERVICE_MAP_KOV_CONTACTS registrit, muidu valitud official_contact/contact_page allikaid. Koonda sama inimese mitme chunk'i kirjed üheks, nimeta kõik valitud kontaktid koos rolliga ja ära arvuta praegust koosseisu ajaloolisest artiklist. Kui küsimus on teenuste või toetuste loetelu jätk 'kes neid pakuvad?', selgita, et KOV korraldab abi ning kontaktid on teemapõhised; ära väida, et iga nimetatud inimene osutab kõiki loetletud teenuseid. Ütle allikate kontrollkuupäev ausalt, kui see on vastuses oluline."
    ] : []),
    ...(currentMunicipalityContactEvidenceRequested && serviceMapKovContactLoadState !== "resolved" ? [
      "CONTACT_FRESHNESS_STATUS: värskuskõlblikku kontrollitud KOV kontaktikihti ei ole selle pöörde jaoks saadaval. Ära kasuta vektorkorpuse vanu kontaktikirjeid praeguse nime, arvu, rolli, telefoni ega e-posti kinnitamiseks; ütle, et praegust kontakti ei saa piisavalt värske allikaga kinnitada."
    ] : []),
    ...(currentMunicipalityStaffingCountRequest ? [
      "CURRENT_MUNICIPAL_STAFFING_COUNT_MODE: vasta ainult valitud official_contact/contact_page allikate ning olemasolu korral SERVICE_MAP_KOV_CONTACTS-i põhjal. Loenda küsitud rollid eraldi, selgita lühidalt rollinimetuste vastavust ja ära kasuta praeguse koosseisu arvutamiseks ajaloolist ajakirjaartiklit."
    ] : []),
    ...(temporalRetrievalPlan.enabled ? [buildTemporalBreakdownInstruction(
      replyLang,
      temporalRetrievalPlan.years,
      {
        qualitativeSynthesis: temporalRetrievalPlan.qualitativeSynthesisRequested === true,
        periodYears: temporalRetrievalPlan.periodYears
      }
    )] : [])
  ];

  let matches = [];
  let ragSearchFailed = false;
  let groupedMatches = [];
  let chosen = [];
  let overviewSelection = null;
  let documentIdentityDurationMs = null;
  let factSegmentSearchDurationMs = null;
  let contextRenderDurationMs = null;
  let budgeted = {
    text: "",
    used: [],
    renderedBlocks: []
  };
  let temporalMissingYears = [];
  let temporalDevelopmentContextTrace = null;
  let renderedEvidenceGroups = [];
  let numericFactEvidence = {
    enabled: false,
    sufficient: false,
    expectedCount: 0,
    evidenceCount: 0
  };
  let numericRelationContract = null;
  let requestedFactSlotContract = null;
  let requestedMetricContract = null;
  let requestedQualitativeSlotContract = null;
  let requestedFactEvidenceCoverage = null;
  let authorCorpusEvidence = {
    enabled: questionPlan?.person_source_intent === "authored_works_count",
    required: questionPlan?.person_source_intent === "authored_works_count",
    requestedAuthor: questionPlan?.person_name || null,
    matched: false,
    complete: false,
    documentCount: null,
    documentIds: [],
    includesCoauthoredWorks: true,
    reasons: []
  };
  let documentIdentityEvidence = {
    enabled: specificResearchFactQuestion,
    required: specificResearchFactQuestion,
    matched: false,
    confidence: specificResearchFactQuestion ? "low" : "not_required",
    requestedAuthor: questionPlan?.person_name || null,
    subjectTerms: Array.isArray(questionPlan?.document_subject_terms) ? questionPlan.document_subject_terms : [],
    selectedDocumentId: null,
    selectedTitle: null,
    reasons: [],
    candidates: [],
    groups: []
  };
  let legalSelection = {
    groupedMatches: [],
    selectionGroups: [],
    missingParagraphRefs: [],
    insufficientPreciseLegalSourceSupport: false
  };
  const preferRagForSourceLookup = sourceLookupRequest;
  const structuredContactRegistryTurn = municipalityContactRequest &&
    !isCrisis &&
    !sourceLookupRequest &&
    !sourceLookupTargetsNationalLaw &&
    !legalSourceQuestion &&
    !municipalityServiceBenefitListRequest &&
    !municipalityServiceBenefitRagRequest &&
    !ephemeralChunks.length &&
    !combineSources &&
    effectiveMunicipalities.length === 1 &&
    supportsDeterministicContactReply(effectiveMessage);
  const structuredContactMissingMunicipalityTurn =
    currentMunicipalityContactEvidenceRequested &&
    pureCurrentMunicipalityContactIntent &&
    !serviceMapContactMonitorRequest &&
    effectiveMunicipalities.length === 0 &&
    !sourceLookupRequest &&
    !sourceLookupTargetsNationalLaw &&
    !legalSourceQuestion &&
    !ephemeralChunks.length &&
    !combineSources &&
    supportsDeterministicContactReply(effectiveMessage);
  const structuredContactMonitorTurn = serviceMapContactMonitorRequest &&
    !structuredContactRegistryTurn &&
    !sourceLookupRequest &&
    !sourceLookupTargetsNationalLaw &&
    !legalSourceQuestion &&
    !ephemeralChunks.length &&
    !combineSources;
  const structuredMunicipalityAmbiguityTurn = !isCrisis &&
    questionPlan?.municipality_ambiguous === true &&
    Array.isArray(questionPlan?.municipality_candidates) &&
    questionPlan.municipality_candidates.length > 1 &&
    ["kov_service_or_benefit", "kov_service_and_local_rule"].includes(questionPlan?.mode);
  const shouldRunRag =
    externalSourcesNeeded &&
    !previousSourceUseRequest &&
    !structuredContactRegistryTurn &&
    !structuredContactMissingMunicipalityTurn &&
    !structuredContactMonitorTurn &&
    !structuredMunicipalityAmbiguityTurn &&
    (preferRagForSourceLookup || !ephemeralChunks.length || combineSources);
  const queryPlanningStartedAt = performance.now();
  const {
    ragQueryText,
    legalLookupPlan,
    ragQueries,
    primaryRagQueries,
    searchFilters,
    sourceLookupTopK,
    ragSearchTopK,
    ragRetrievers,
    selectionStrategy,
    contextGroupTarget,
    queryPlan
  } = buildRagQueryPlan({
    baseRagQueryText,
    effectiveMessage: retrievalMessage,
    rawHistory: retrievalHistory,
    sourceLookupRequest,
    sourceLookupParagraphRefs,
    legalFollowupMessage,
    temporalRetrievalPlan,
    overviewSynthesisQuestion,
    thematicSynthesisQuestion,
    nationalServiceBenefitQuestion,
    serviceJurisdictionQuestion,
    allowMunicipalityScopedRag,
    municipalityContactRequest,
    municipalityServiceBenefitRagRequest,
    municipalityServiceBenefitListRequest,
    municipalityServiceBenefitIntent,
    effectiveMunicipalities,
    audienceFilter,
    sourceLookupTargetsNationalLaw,
    externalSourcesNeeded,
    shouldRunRag,
    previousSourceUseRequest,
    broadMultiSourceQuestion,
    ragRiskPolicy,
    questionPlan,
    resourceDiscoveryQuestion
  });
  if (
    canonicalSupplementalRetrievalActive &&
    !specificResearchFactQuestion &&
    Array.isArray(primaryRagQueries)
  ) {
    const canonicalQuery = String(languagePlan?.canonicalQueryEt || "").trim();
    const alreadyPlanned = primaryRagQueries.some(entry =>
      String(typeof entry === "string" ? entry : entry?.query || "").trim() === canonicalQuery
    );
    if (canonicalQuery && !alreadyPlanned) {
      primaryRagQueries.push({ query: canonicalQuery });
    }
    if (queryPlan && typeof queryPlan === "object") {
      queryPlan.cross_language_retrieval = {
        version: "cross_language_retrieval_v1",
        original_query_language: languagePlan?.queryLanguage || "unknown",
        original_query_preserved: true,
        canonical_et_query_added: !!canonicalQuery,
        semantic_retrieval_terms_et: canonicalRetrievalTermsEt,
        controlled_topic_count: Array.isArray(languagePlan?.controlledTopicTermsEt)
          ? languagePlan.controlledTopicTermsEt.length
          : 0
      };
    }
  }
  if (queryPlan && typeof queryPlan === "object") {
    queryPlan.semantic_turn_contract = semanticTurnContract;
    queryPlan.semantic_retrieval_terms_et = canonicalRetrievalTermsEt;
    if (specificResearchFactQuestion) {
      queryPlan.specific_research_fact_phases = {
        version: "specific_research_fact_phases_v1",
        strategy: "identity_then_document_scoped_fact",
        identity_query_count: Array.isArray(primaryRagQueries) ? primaryRagQueries.length : 0,
        document_scoped_fact_query_count: 0,
        document_scoped_fact_search_state: "not_started",
        document_scoped_fact_search_performed: false,
        selected_document_id: null
      };
    }
  }
  if (safeLanguagePlanTrace && queryPlan && typeof queryPlan === "object") {
    queryPlan.language_plan = safeLanguagePlanTrace;
  }
  const trustedSpecificResearchDocumentId = specificResearchFactQuestion &&
    !explicitCurrentTitleDocumentAnchor
    ? exactDocumentIdFromFilteredQueries(primaryRagQueries)
    : null;
  let specificResearchQuestionPlan = trustedSpecificResearchDocumentId
    ? {
        ...questionPlan,
        trusted_document_id: trustedSpecificResearchDocumentId,
        trusted_document_id_source: "previous_source_exact_filter"
      }
    : questionPlan;
  let currentTurnAuthorConfirmation = null;
  const queryPlanningDurationMs = monotonicDurationMs(queryPlanningStartedAt);

  // Graph-lite channel (C2): behind RAG_GRAPH_CHANNEL_ENABLED. Matched graph
  // entities expand retrieval queries with related forms/contacts/legal basis;
  // never produces answer text and never bypasses attribution.
  // Graph expansion only helps modes that look for related items (forms,
  // contacts, services). Comparison/legal/overview have purpose-built query
  // plans that graph expansions measurably dilute (eval 2026-06-12: §17
  // dropped from comparison displayed sources), so they are excluded.
  const GRAPH_CHANNEL_EXCLUDED_MODES = new Set([
    "comparison", "legal_exact", "explicit_paragraph", "overview_synthesis",
    "national_source_lookup", "source_lookup", "temporal", "municipality_service_benefit_list",
    "municipality_contact_list", "specific_research_fact"
  ]);
  let graphChannel = null;
  // Graph queries run as a SEPARATE pass (below, after the native search) rather
  // than mixed into primaryRagQueries — that keeps native retrieval at full
  // per-query depth and lets the graph supplement be marked and quota-capped.
  let graphChannelQueries = [];
  const graphChannelActive =
    shouldRunRag &&
    (isGraphChannelEnabled() || graphChannelTestOverride === true) &&
    !GRAPH_CHANNEL_EXCLUDED_MODES.has(String(queryPlan?.mode || ""));
  if (graphChannelActive) {
    try {
      const graphLookup = await graphChannelLookup({
        question: effectiveMessage,
        prisma,
        municipalityNames: effectiveMunicipalities.map((item) => item.displayName).filter(Boolean)
      });
      graphChannelQueries = graphHintsToQueryTexts(graphLookup);
      graphChannel = {
        matched_entities: graphLookup.matched_entities,
        hint_group_count: (graphLookup.hints || []).length,
        added_query_count: graphChannelQueries.length
      };
      if (queryPlan && typeof queryPlan === "object") queryPlan.graph_channel = graphChannel;
      logInfo?.("rag.graph_channel", graphChannel);
    } catch (graphErr) {
      logError?.("rag.graph_channel_failed", { message: graphErr?.message || String(graphErr) });
    }
  }

  if (shouldRunRag) {
    if (typeof onBeforeRag === "function") {
      await onBeforeRag();
    }
    try {
      matches = await runRagSearch({
        queries: primaryRagQueries,
        topK: ragSearchTopK,
        retrievers: ragRetrievers,
        journalChunksPerDocument,
        filters: searchFilters,
        userId,
        role: normalizedRole,
        conversationId: convId
      });
      matches = filterMunicipalityScopedMatches(matches, {
        allowMunicipalityScoped: allowMunicipalityScopedRag
      });
      matches = filterMatchesToMunicipalities(matches, effectiveMunicipalities);

      if ((sourceLookupTargetsNationalLaw || nationalServiceBenefitQuestion || serviceJurisdictionQuestion) && matches.length === 0) {
        const nationalFallbackMatches = await runRagSearch({
          queries: ragQueries,
          topK: sourceLookupRequest
            ? Math.min(24, Math.max(12, sourceLookupTopK || RAG_TOP_K))
            : nationalServiceBenefitQuestion || serviceJurisdictionQuestion
              ? Math.min(36, Math.max(18, RAG_TOP_K * 3))
              : Math.min(24, Math.max(12, RAG_TOP_K)),
          filters: audienceFilter,
          observabilityStage: "rag_search_national_fallback",
          userId,
          role: normalizedRole,
          conversationId: convId
        });
        matches = filterMunicipalityScopedMatches(nationalFallbackMatches, {
          allowMunicipalityScoped: false
        });
      }

      if (
        !sourceLookupRequest &&
        allowMunicipalityScopedRag &&
        !sourceLookupTargetsNationalLaw &&
        !municipalityContactRequest &&
        !municipalityServiceBenefitListRequest
      ) {
        const backgroundTopK = Math.min(12, Math.max(6, RAG_TOP_K));
        try {
          const backgroundMatches = await runRagSearch({
            queries: buildGeneralBackgroundQueries(ragQueries, ragQueryText),
            topK: backgroundTopK,
            filters: audienceFilter,
            observabilityStage: "rag_search_background_scope",
            userId,
            role: normalizedRole,
            conversationId: convId
          });
          matches = dedupeRagMatches([
            ...matches,
            ...filterMunicipalityScopedMatches(backgroundMatches, {
              allowMunicipalityScoped: false
            })
          ]);
        } catch (err) {
          await logRagSearchError({
            err,
            event: "rag_optional_search_error",
            logError,
            logEvent,
            userId,
            role: normalizedRole,
            isCrisis,
            stage: "rag_search_background_scope",
            optional: true,
            queryPlan,
            selectionStrategy,
            topK: backgroundTopK,
            conversationId: convId
          });
        }
      }

      if (
        !sourceLookupRequest &&
        allowMunicipalityScopedRag &&
        municipalityServiceBenefitRagRequest &&
        !municipalityServiceBenefitListRequest &&
        !(legalLookupPlan?.enabled && legalLookupPlan.mode === "explicit_paragraph")
      ) {
        const regulationQueries = buildMunicipalityRegulationPackageQueries(effectiveMunicipalities);
        if (regulationQueries.length) {
          const regulationTopK = Math.min(8, Math.max(4, regulationQueries.length * 4));
          try {
            const regulationMatches = await runRagSearch({
              queries: regulationQueries,
              topK: regulationTopK,
              filters: audienceFilter,
              observabilityStage: "rag_search_kov_regulation_package_candidates",
              userId,
              role: normalizedRole,
              conversationId: convId
            });
            matches = dedupeRagMatches([
              ...matches,
              ...filterMatchesToMunicipalities(
                filterMunicipalityScopedMatches(regulationMatches, {
                  allowMunicipalityScoped: true
                }),
                effectiveMunicipalities
              )
            ]);
          } catch (err) {
            await logRagSearchError({
              err,
              event: "rag_optional_search_error",
              logError,
              logEvent,
              userId,
              role: normalizedRole,
              isCrisis,
              stage: "rag_search_kov_regulation_package_candidates",
              optional: true,
              queryPlan,
              selectionStrategy,
              topK: regulationTopK,
              conversationId: convId
            });
          }
        }
      }

      // Graph-channel supplement (C2 quota): a separate pass so native depth is
      // untouched. Keep only graph-found documents native retrieval missed, mark
      // them retrieval_channel=graph, and cap to GRAPH_CHANNEL_MAX_DISPLAYED.
      if (graphChannelActive && graphChannelQueries.length) {
        try {
          const graphMatchesRaw = await runRagSearch({
            queries: graphChannelQueries,
            topK: graphChannelSearchTopK(graphChannelQueries.length),
            filters: searchFilters,
            observabilityStage: "rag_search_graph_channel",
            userId,
            role: normalizedRole,
            conversationId: convId
          });
          const graphMatchesScoped = filterMatchesToMunicipalities(
            filterMunicipalityScopedMatches(graphMatchesRaw, {
              allowMunicipalityScoped: allowMunicipalityScopedRag
            }),
            effectiveMunicipalities
          );
          const graphSupplement = selectGraphChannelSupplement(
            matches,
            graphMatchesScoped,
            GRAPH_CHANNEL_MAX_DISPLAYED
          );
          if (graphSupplement.length) {
            matches = dedupeRagMatches([...matches, ...graphSupplement]);
          }
          if (graphChannel) graphChannel.added_candidate_count = graphSupplement.length;
        } catch (graphErr) {
          logError?.("rag.graph_channel_search_failed", {
            message: graphErr?.message || String(graphErr)
          });
        }
      }
    } catch (err) {
      ragSearchFailed = true;
      await logRagSearchError({
        err,
        event: "rag_error",
        logError,
        logEvent,
        userId,
        role: normalizedRole,
        isCrisis,
        stage: "rag_search",
        optional: false,
        queryPlan,
        selectionStrategy,
        topK: ragSearchTopK,
        conversationId: convId
      });
    }

      groupedMatches = prioritizeExactMunicipalityTitleGroups(
        rankGroupsWithTopicHints(groupMatches(matches), topicHints, { ragRiskPolicy }),
        effectiveMunicipalities,
        { enabled: !allowMunicipalityScopedRag }
      );
    if (temporalRetrievalPlan.enabled) {
      const coveredYears = new Set(
        groupedMatches
          .flatMap(group => temporalEvidenceYearsForGroup(
            group,
            temporalRetrievalPlan.years,
            { requestedYearRole: temporalCoverageYearRole }
          ))
          .filter((year) => Number.isInteger(year))
      );
      const missingYears = temporalRetrievalPlan.years.filter((year) => !coveredYears.has(year));
      temporalMissingYears = missingYears;
      if (missingYears.length) {
        const fallbackSettled = await Promise.allSettled(
          missingYears.map((year) =>
            runRagSearch({
              queries: buildTemporalFillQueries({
                years: [year],
                focusText: temporalRetrievalPlan.focusText || effectiveMessage,
                message: effectiveMessage,
                topicHints,
                requestedYearRole: temporalCoverageYearRole
              }),
              topK: Math.max(12, RAG_TOP_K),
              filters: sourceLookupTargetsNationalLaw
                ? {
                    ...audienceFilter,
                    jurisdiction_level: "NATIONAL"
                  }
                : audienceFilter,
              observabilityStage: `rag_search_temporal_fill_${year}`,
              userId,
              role: normalizedRole,
              conversationId: convId
            })
          )
        );
        const fallbackMatches = fallbackSettled.flatMap((item) =>
          item.status === "fulfilled" && Array.isArray(item.value) ? item.value : []
        );
        matches = dedupeRagMatches([
          ...matches,
          ...filterMatchesToMunicipalities(
            filterMunicipalityScopedMatches(fallbackMatches, {
              allowMunicipalityScoped: allowMunicipalityScopedRag
            }),
            effectiveMunicipalities
          )
        ]);
        groupedMatches = prioritizeExactMunicipalityTitleGroups(
          rankGroupsWithTopicHints(groupMatches(matches), topicHints, { ragRiskPolicy }),
          effectiveMunicipalities,
          { enabled: !allowMunicipalityScopedRag }
        );
        const refreshedCoveredYears = new Set(groupedMatches.flatMap(group =>
          temporalEvidenceYearsForGroup(
            group,
            temporalRetrievalPlan.years,
            { requestedYearRole: temporalCoverageYearRole }
          )
        ));
        temporalMissingYears = temporalRetrievalPlan.years.filter(year => !refreshedCoveredYears.has(year));
      }
    }

    if (currentMunicipalityContactEvidenceRequested) {
      matches = excludeSupersededKovContactMatches(
        matches,
        serviceMapKovContacts,
        effectiveMunicipalities,
        { suppressUnscoped: effectiveMunicipalities.length === 0 }
      );
      groupedMatches = prioritizeExactMunicipalityTitleGroups(
        rankGroupsWithTopicHints(groupMatches(matches), topicHints, { ragRiskPolicy }),
        effectiveMunicipalities,
        { enabled: !allowMunicipalityScopedRag }
      );
    }

    const preLegalGroupedMatches = groupedMatches;
    legalSelection = buildLegalExactSelection(groupedMatches, legalLookupPlan, {
      ragRiskPolicy
    });
    groupedMatches = legalSelection.groupedMatches;
    if (legalSelection.insufficientPreciseLegalSourceSupport) {
      extraSystemInstructions.push(
        buildLegalExactMissingInstruction(replyLang, legalLookupPlan, legalSelection.missingParagraphRefs)
      );
    }

    if (legalLookupPlan?.enabled && legalLookupPlan.mode === "explicit_paragraph") {
      chosen = legalSelection.selectionGroups.slice(0, contextGroupTarget);
      if (questionPlan?.mode === "kov_service_and_local_rule") {
        const serviceGroups = sortByGroupRank(preLegalGroupedMatches).filter(group => {
          const sourceType = String(group?.sourceType || group?.source_type || group?.type || "").toLowerCase();
          return ["kov_service", "kov_service_info", "municipality_service"].includes(sourceType);
        }).slice(0, 3);
        chosen = [...chosen, ...serviceGroups].filter((group, index, groups) =>
          groups.findIndex(candidate => researchGroupDocumentId(candidate) === researchGroupDocumentId(group)) === index
        ).slice(0, contextGroupTarget);
        extraSystemInstructions.push(
          "COMPOSITE_KOV_EVIDENCE: vasta eraldi kahele osale: (1) kuidas teenust taotleda aktiivse omavalitsuse teenuseallika järgi ja (2) mida küsitud kohaliku korra paragrahv sätestab. Ära tuleta üht osa teise allikast."
        );
      }
    } else if (temporalRetrievalPlan.enabled && !specificResearchFactQuestion && !specificDocumentQuestion) {
      chosen = selectTemporalGroups(
        groupedMatches,
        temporalRetrievalPlan.years,
        CONTEXT_GROUPS_MAX,
        DIVERSIFY_LAMBDA,
        { requestedYearRole: temporalCoverageYearRole }
      );
    } else if (specificResearchFactQuestion) {
      currentTurnAuthorConfirmation = buildCurrentTurnAuthorConfirmation(
        questionPlan?.semantic_candidates?.current_turn_document_identity,
        groupedMatches,
        languagePlan
      );
      const confirmedCurrentTurnDocumentIds = Array.isArray(currentTurnAuthorConfirmation?.matched_document_ids)
        ? currentTurnAuthorConfirmation.matched_document_ids
          .map(value => String(value || "").trim())
          .filter(Boolean)
        : [];
      if (
        currentTurnAuthorConfirmation?.promotion_eligible === true &&
        confirmedCurrentTurnDocumentIds.length === 1
      ) {
        specificResearchQuestionPlan = {
          ...questionPlan,
          trusted_document_id: confirmedCurrentTurnDocumentIds[0],
          trusted_document_id_source: "current_turn_author_confirmation"
        };
      }
      const documentIdentityStartedAt = performance.now();
      documentIdentityEvidence = selectSpecificResearchFactGroups(
        effectiveMessage,
        groupedMatches,
        specificResearchQuestionPlan
      );
      documentIdentityDurationMs = monotonicDurationMs(documentIdentityStartedAt);
      const preselectedTrustedDocumentId = String(
        specificResearchQuestionPlan?.trusted_document_id || ""
      ).trim();
      if (
        preselectedTrustedDocumentId &&
        documentIdentityEvidence?.selectedDocumentId !== preselectedTrustedDocumentId
      ) {
        documentIdentityEvidence = {
          ...documentIdentityEvidence,
          matched: false,
          confidence: "low",
          selectedDocumentId: null,
          selectedTitle: null,
          groups: [],
          reasons: [
            ...(Array.isArray(documentIdentityEvidence?.reasons)
              ? documentIdentityEvidence.reasons
              : []),
            "trusted_document_id_mismatch"
          ]
        };
      }
      const lockedSpecificResearchDocumentId = specificResearchDocumentLockEligible(
        specificResearchQuestionPlan,
        documentIdentityEvidence
      )
        ? String(documentIdentityEvidence.selectedDocumentId || "").trim()
        : "";
      if (documentIdentityEvidence?.matched === true && !lockedSpecificResearchDocumentId) {
        documentIdentityEvidence = {
          ...documentIdentityEvidence,
          matched: false,
          confidence: "low",
          selectedDocumentId: null,
          selectedTitle: null,
          groups: [],
          reasons: [
            ...(Array.isArray(documentIdentityEvidence?.reasons)
              ? documentIdentityEvidence.reasons
              : []),
            "document_identity_not_lock_eligible"
          ]
        };
      }
      chosen = documentIdentityEvidence.groups;
      if (lockedSpecificResearchDocumentId) {
        specificResearchQuestionPlan = {
          ...specificResearchQuestionPlan,
          trusted_document_id: lockedSpecificResearchDocumentId,
          trusted_document_id_source: "current_turn_document_identity"
        };
      }
      const specificResearchPhases = queryPlan?.specific_research_fact_phases;
      if (specificResearchPhases && typeof specificResearchPhases === "object") {
        specificResearchPhases.selected_document_id = documentIdentityEvidence.selectedDocumentId || null;
        specificResearchPhases.document_scoped_fact_search_state = documentIdentityEvidence.matched
          ? "identity_resolved"
          : "identity_unconfirmed";
      }
      if (
        documentIdentityEvidence.matched &&
        lockedSpecificResearchDocumentId
      ) {
        const scopedQueries = buildDocumentScopedResearchFactQueries(specificResearchQuestionPlan);
        if (specificResearchPhases && typeof specificResearchPhases === "object") {
          specificResearchPhases.document_scoped_fact_query_count = scopedQueries.length;
        }
        if (scopedQueries.length) {
          if (specificResearchPhases && typeof specificResearchPhases === "object") {
            specificResearchPhases.document_scoped_fact_search_state = "started";
          }
          try {
            const scopedStartedAt = performance.now();
            const scopedMatches = await runRagSearch({
              queries: scopedQueries,
              topK: Math.min(24, Math.max(16, RAG_TOP_K)),
              retrievers: ragRetrievers,
              journalChunksPerDocument: 12,
              filters: {
                ...(searchFilters || {}),
                doc_id: lockedSpecificResearchDocumentId
              },
              observabilityStage: "rag_search_document_fact",
              userId,
              role: normalizedRole,
              conversationId: convId
            });
            factSegmentSearchDurationMs = monotonicDurationMs(scopedStartedAt);
            if (specificResearchPhases && typeof specificResearchPhases === "object") {
              specificResearchPhases.document_scoped_fact_search_performed = true;
            }
            matches = dedupeRagMatches([...matches, ...scopedMatches]);
            groupedMatches = prioritizeExactMunicipalityTitleGroups(
              rankGroupsWithTopicHints(groupMatches(matches), topicHints, { ragRiskPolicy }),
              effectiveMunicipalities,
              { enabled: !allowMunicipalityScopedRag }
            );
            const refreshedIdentityStartedAt = performance.now();
            const refreshedDocumentIdentityEvidence = selectSpecificResearchFactGroups(
              effectiveMessage,
              groupedMatches,
              specificResearchQuestionPlan
            );
            documentIdentityDurationMs += monotonicDurationMs(refreshedIdentityStartedAt);
            documentIdentityEvidence = refreshedDocumentIdentityEvidence.matched === true &&
              refreshedDocumentIdentityEvidence.selectedDocumentId === lockedSpecificResearchDocumentId
              ? refreshedDocumentIdentityEvidence
              : {
                  ...refreshedDocumentIdentityEvidence,
                  matched: false,
                  confidence: "low",
                  selectedDocumentId: null,
                  selectedTitle: null,
                  groups: [],
                  reasons: [
                    ...(Array.isArray(refreshedDocumentIdentityEvidence.reasons)
                      ? refreshedDocumentIdentityEvidence.reasons
                      : []),
                    "current_turn_document_lock_mismatch"
                  ]
                };
            chosen = documentIdentityEvidence.groups;
            let requestedFactCoverage = buildRequestedFactSlotCoverage(
              specificResearchQuestionPlan,
              chosen,
              { specificResearchFactQuestion: true, documentIdentityEvidence }
            );
            if (specificResearchPhases && typeof specificResearchPhases === "object") {
              specificResearchPhases.requested_fact_coverage_before_recovery = requestedFactCoverage;
            }
            const recoveryQueries = documentIdentityEvidence.matched === true &&
              requestedFactCoverage.enabled === true &&
              requestedFactCoverage.complete !== true
              ? buildDocumentScopedMissingFactQueries(
                  specificResearchQuestionPlan,
                  requestedFactCoverage.missing_slot_indexes
                )
              : [];
            if (recoveryQueries.length) {
              const recoveryStartedAt = performance.now();
              const recoveryMatches = await runRagSearch({
                queries: recoveryQueries,
                topK: Math.min(20, Math.max(12, RAG_TOP_K)),
                retrievers: ragRetrievers,
                journalChunksPerDocument: 12,
                filters: {
                  ...(searchFilters || {}),
                  doc_id: lockedSpecificResearchDocumentId
                },
                observabilityStage: "rag_search_document_fact_recovery",
                userId,
                role: normalizedRole,
                conversationId: convId
              });
              factSegmentSearchDurationMs = (factSegmentSearchDurationMs || 0) +
                monotonicDurationMs(recoveryStartedAt);
              matches = dedupeRagMatches([...matches, ...recoveryMatches]);
              groupedMatches = prioritizeExactMunicipalityTitleGroups(
                rankGroupsWithTopicHints(groupMatches(matches), topicHints, { ragRiskPolicy }),
                effectiveMunicipalities,
                { enabled: !allowMunicipalityScopedRag }
              );
              const recoveredIdentityStartedAt = performance.now();
              const recoveredIdentityEvidence = selectSpecificResearchFactGroups(
                effectiveMessage,
                groupedMatches,
                specificResearchQuestionPlan
              );
              documentIdentityDurationMs += monotonicDurationMs(recoveredIdentityStartedAt);
              documentIdentityEvidence = recoveredIdentityEvidence.matched === true &&
                recoveredIdentityEvidence.selectedDocumentId === lockedSpecificResearchDocumentId
                ? recoveredIdentityEvidence
                : {
                    ...recoveredIdentityEvidence,
                    matched: false,
                    confidence: "low",
                    selectedDocumentId: null,
                    selectedTitle: null,
                    groups: [],
                    reasons: [
                      ...(Array.isArray(recoveredIdentityEvidence.reasons)
                        ? recoveredIdentityEvidence.reasons
                        : []),
                      "current_turn_document_lock_mismatch_after_recovery"
                    ]
                  };
              chosen = documentIdentityEvidence.groups;
              requestedFactCoverage = buildRequestedFactSlotCoverage(
                specificResearchQuestionPlan,
                chosen,
                { specificResearchFactQuestion: true, documentIdentityEvidence }
              );
            }
            if (specificResearchPhases && typeof specificResearchPhases === "object") {
              specificResearchPhases.document_scoped_fact_search_state = "completed";
              specificResearchPhases.selected_document_id = documentIdentityEvidence.selectedDocumentId || null;
              specificResearchPhases.requested_fact_recovery_query_count = recoveryQueries.length;
              specificResearchPhases.requested_fact_coverage_after_recovery = requestedFactCoverage;
            }
          } catch (err) {
            if (specificResearchPhases && typeof specificResearchPhases === "object") {
              specificResearchPhases.document_scoped_fact_search_state = "failed";
            }
            await logRagSearchError({
              err,
              event: "rag_optional_search_error",
              logError,
              logEvent,
              userId,
              role: normalizedRole,
              isCrisis,
              stage: "rag_search_document_fact",
              optional: true,
              queryPlan,
              selectionStrategy,
              topK: Math.min(24, Math.max(16, RAG_TOP_K)),
              conversationId: convId
            });
          }
        }
      }
      if (!documentIdentityEvidence.matched) {
        extraSystemInstructions.push(
          "DOCUMENT_IDENTITY_UNCONFIRMED: küsitud uuringut või dokumenti ei tuvastatud piisava kindlusega. Ära kasuta ühegi naaberdokumendi arve. Küsi vajaduse korral lühidalt autorit, aastat või teemat täpsustavat küsimust."
        );
      }
    } else if (specificDocumentQuestion) {
      chosen = sortByGroupRank(groupedMatches).slice(0, 1);
    } else if (temporalRetrievalPlan.preferredYears?.length === 1) {
      chosen = selectGroupsWithPreferredSourceYear(
        groupedMatches,
        temporalRetrievalPlan.preferredYears,
        contextGroupTarget,
        DIVERSIFY_LAMBDA
      );
    } else if (municipalityContactRequest) {
      chosen = selectMunicipalityContactGroups(groupedMatches, contextGroupTarget);
    } else if (municipalityServiceBenefitListRequest) {
      chosen = selectMunicipalityServiceBenefitGroups(
        groupedMatches,
        contextGroupTarget,
        municipalityServiceBenefitIntent
      );
    } else if (professionalMethodGuidanceQuestion) {
      const methodSelection = selectProfessionalMethodGuidanceGroups(
        groupedMatches,
        questionPlan.preferred_source_count?.max || 4,
        DIVERSIFY_LAMBDA,
        { focus: questionPlan.method_guidance_focus, topicHints, question: effectiveMessage }
      );
      chosen = methodSelection.selected;
      queryPlan.method_guidance_selection = methodSelection.metadata;
      if (["missing", "unconfirmed"].includes(methodSelection.metadata.primary_guidance_status)) {
        extraSystemInstructions.push(
          "CURRENT_METHOD_GUIDANCE_UNCONFIRMED: valitud allikate hulgas ei ole kinnitatud aktiivset ajakohast põhijuhendit. Anna olemasoleva tõendi piires kasulik vastus, kuid ära nimeta selle menetlust praegu ametlikult nõutavaks või võimalike meetodite ammendavaks loeteluks."
        );
      }
    } else if (overviewSynthesisQuestion) {
      overviewSelection = selectOverviewSynthesisGroups(groupedMatches, contextGroupTarget, DIVERSIFY_LAMBDA, {
        minDocuments: 3,
        preferredSourceCount: 6,
        dominantShareLimit: 0.4
      });
      chosen = overviewSelection.selected;
    } else if (personSourceLookupQuestion) {
      authorCorpusEvidence = buildAuthorCorpusEvidence(matches, questionPlan);
      const inventoryInstruction = buildAuthorCorpusInventoryInstruction(replyLang, authorCorpusEvidence);
      if (inventoryInstruction) extraSystemInstructions.push(inventoryInstruction);
      if (authorCorpusEvidence.required) {
        const countInstruction = buildAuthorCorpusCountInstruction(replyLang, authorCorpusEvidence);
        if (countInstruction) {
          extraSystemInstructions.push(countInstruction);
        } else {
          extraSystemInstructions.push(
            "AUTHORSHIP_COUNT_UNCONFIRMED: täpset aktiivsete dokumentide autorimeta koguarvu ei saanud kinnitada. Ära tuleta koguarvu valitud katkendite või kuvatud allikate arvust."
          );
        }
      }
      chosen = selectPersonSourceGroups(
        retrievalMessage,
        groupedMatches,
        contextGroupTarget,
        questionPlan.person_name,
        questionPlan.person_source_intent,
        questionPlan.person_topic_terms,
        questionPlan.person_coauthor_names,
        questionPlan.person_coauthor_requested === true
      );
    } else if (resourceDiscoveryQuestion) {
      chosen = selectMultiSourceGroups(groupedMatches, contextGroupTarget, DIVERSIFY_LAMBDA);
    } else if (broadMultiSourceQuestion || selectionStrategy === "multi_source_diversity") {
      chosen = selectMultiSourceGroups(groupedMatches, contextGroupTarget, DIVERSIFY_LAMBDA);
    } else {
      chosen = diversifyGroupsMMR(groupedMatches, contextGroupTarget, DIVERSIFY_LAMBDA);
    }
    if (journalChunksPerDocument > 3 && !professionalMethodGuidanceQuestion) {
      // Focused numeric facts need the highest-ranked topical source, not an
      // MMR-diversified substitute that merely contains convenient numbers.
      const numericCandidateGroups = specificResearchFactQuestion
        ? documentIdentityEvidence.groups
        : groupedMatches;
      const factSegmentSearchStartedAt = performance.now();
      numericFactEvidence = selectSingleSourceNumericFactGroups(effectiveMessage, numericCandidateGroups);
      factSegmentSearchDurationMs = (factSegmentSearchDurationMs || 0) +
        monotonicDurationMs(factSegmentSearchStartedAt);
      if (numericFactEvidence.enabled) {
        chosen = numericFactEvidence.groups;
        if (!numericFactEvidence.sufficient) {
          extraSystemInstructions.push(
            "NUMERIC_SOURCE_COHERENCE: insufficient_same_source. Ära täida küsitud arve teise artikli, aruande või allikagrupi arvudega. Ütle lühidalt, et neid arvulisi väiteid ei saa valitud põhiallikaga piisavalt kinnitada."
          );
        }
      }
    }
    chosen = prioritizeRequestedNumericEvidence(effectiveMessage, chosen);
    const requestedMetricSlotEvidenceOptions = {
      specificResearchFactQuestion,
      documentIdentityEvidence
    };
    const requestedMetricSlotEvidenceActive = requestedMetricSlotPlan(
      questionPlan,
      requestedMetricSlotEvidenceOptions
    ).length > 0;
    chosen = prioritizeRequestedMetricSlotEvidence(
      questionPlan,
      chosen,
      requestedMetricSlotEvidenceOptions
    );
    chosen = prioritizeRequestedFactSlotEvidence(
      questionPlan,
      chosen,
      requestedMetricSlotEvidenceOptions
    );
    if (!requestedMetricSlotEvidenceActive) {
      chosen = prioritizeNumericScopeEvidence(effectiveMessage, chosen);
    }
    const contextRenderStartedAt = performance.now();
    const baseContextBudgetOptions = {
      ...buildRagContextBudgetOptions({
        temporalRetrievalPlan,
        municipalityContactRequest,
        municipalityServiceBenefitListRequest,
        broadMultiSourceQuestion: broadMultiSourceQuestion || resourceDiscoveryQuestion || professionalMethodGuidanceQuestion || personSourceLookupQuestion || selectionStrategy === "multi_source_diversity",
        sourceLookupRequest,
        sourceLookupTargetsNationalLaw,
        sourceLookupParagraphRefs,
        sourceSetListingFollowup,
        contextGroupTarget
      }),
      maxBodies: journalChunksPerDocument > 3 ? journalChunksPerDocument : 2,
      secondaryMaxBodies: journalChunksPerDocument > 3 ? 2 : undefined,
      secondaryBodyMaxChars: journalChunksPerDocument > 3 ? 1100 : undefined,
      allowExpandedBodyBudget: journalChunksPerDocument > 3,
      includeAuthors: shouldIncludeContextAuthors(retrievalMessage, chosen, { sourceLookupRequest })
    };
    budgeted = buildContextWithBudget(chosen, baseContextBudgetOptions);
    if (
      temporalRetrievalPlan.enabled &&
      temporalRetrievalPlan.comparisonRequested === true &&
      budgeted.used[0]?.docId
    ) {
      const renderedTemporalSources = budgeted.used.map((group, index) => ({
        source_id: group.sourceId || group.key,
        evidenceText: String(budgeted.renderedBlocks?.[index]?.text || "")
      }));
      const renderedAggregateRows = buildTemporalAggregatePeriodRows({
        sources: renderedTemporalSources.slice(0, 1),
        targetYears: temporalRetrievalPlan.years
      });
      const renderedAnnualRows = buildTemporalEvidenceRows({
        sources: renderedTemporalSources,
        targetYears: temporalRetrievalPlan.years
      });
      const renderedAnnualYears = new Set(renderedAnnualRows.map(row => row.year));
      const renderedAnnualCoverageIncomplete = temporalRetrievalPlan.years.some(
        year => !renderedAnnualYears.has(year)
      );
      if (renderedAggregateRows.length >= 2 && renderedAnnualCoverageIncomplete) {
        const renderedPrimaryEntry = budgeted.used[0];
        const renderedPrimaryBlock = budgeted.renderedBlocks[0];
        let primaryTemporalGroup = budgeted.used[0];
        const targetYearSet = new Set(temporalRetrievalPlan.years);
        const latestTargetYear = temporalRetrievalPlan.years.length
          ? Math.max(...temporalRetrievalPlan.years)
          : null;
        const companionSeedGroup = groupedMatches
          .map((group, groupIndex) => ({
            group,
            groupIndex,
            titleTopicCoverage: temporalSupplementalTitleTopicCoverage(
              group.title,
              temporalRetrievalPlan.topicTerms
            )
          }))
          .filter(({ group, titleTopicCoverage }) =>
            group.docId &&
            group.docId !== primaryTemporalGroup.docId &&
            targetYearSet.has(extractMatchGroupYear(group)) &&
            isResearchOrJournalSource({ source_type: group.sourceType }) &&
            titleTopicCoverage > 0
          )
          .sort((left, right) =>
            right.titleTopicCoverage - left.titleTopicCoverage ||
            left.groupIndex - right.groupIndex
          )[0]?.group;
        const primaryHasLaterDevelopment = (primaryTemporalGroup.bodies || []).some(body =>
          preferredTemporalQualitativeDevelopmentSpan(body, {
            sourceTitle: primaryTemporalGroup.title,
            topicTerms: temporalRetrievalPlan.topicTerms,
            minimumEvidenceYearExclusive: Number.isInteger(latestTargetYear)
              ? latestTargetYear
              : null
          })
        );
        const companionHasDevelopment = (companionSeedGroup?.bodies || []).some(body =>
          preferredTemporalQualitativeDevelopmentSpan(body, {
            sourceTitle: companionSeedGroup.title,
            topicTerms: temporalRetrievalPlan.topicTerms,
            requireTitleTopicMatch: true
          })
        );
        const developmentDocumentIds = Array.from(new Set([
          ...(!primaryHasLaterDevelopment ? [primaryTemporalGroup.docId] : []),
          ...(companionSeedGroup && !companionHasDevelopment ? [companionSeedGroup.docId] : [])
        ].filter(Boolean))).slice(0, 2);
        let rawDevelopmentGroupsByDocument = new Map();
        if (developmentDocumentIds.length) {
          try {
            const scopedDevelopmentMatches = await runRagSearch({
              queries: developmentDocumentIds.map(docId => ({
                query: temporalRetrievalPlan.focusText || effectiveMessage,
                filters: { doc_id: docId },
                min_top_k: 12
              })),
              topK: 12,
              retrievers: ragRetrievers,
              journalChunksPerDocument: 12,
              filters: searchFilters,
              observabilityStage: "rag_search_temporal_development",
              userId,
              role: normalizedRole,
              conversationId: convId
            });
            if (scopedDevelopmentMatches.length) {
              rawDevelopmentGroupsByDocument = new Map(
                groupMatches(scopedDevelopmentMatches)
                  .filter(group => group.docId && developmentDocumentIds.includes(group.docId))
                  .map(group => [group.docId, group])
              );
              matches = dedupeRagMatches([...matches, ...scopedDevelopmentMatches]);
              groupedMatches = prioritizeExactMunicipalityTitleGroups(
                rankGroupsWithTopicHints(groupMatches(matches), topicHints, { ragRiskPolicy }),
                effectiveMunicipalities,
                { enabled: !allowMunicipalityScopedRag }
              );
              const enrichedGroupsByDocument = new Map(
                groupedMatches
                  .filter(group => group.docId)
                  .map(group => [group.docId, group])
              );
              chosen = chosen.map(group => enrichedGroupsByDocument.get(group.docId) || group);
              primaryTemporalGroup = enrichedGroupsByDocument.get(primaryTemporalGroup.docId) || primaryTemporalGroup;
              chosen[0] = primaryTemporalGroup;
            }
          } catch (err) {
            await logRagSearchError({
              err,
              event: "rag_optional_search_error",
              logError,
              logEvent,
              userId,
              role: normalizedRole,
              isCrisis,
              stage: "rag_search_temporal_development",
              optional: true,
              queryPlan,
              selectionStrategy,
              topK: 12,
              conversationId: convId
            });
          }
        }
        const primaryDevelopmentCandidateGroup = rawDevelopmentGroupsByDocument.get(
          primaryTemporalGroup.docId
        ) || primaryTemporalGroup;
        const primaryDevelopmentCandidate = (primaryDevelopmentCandidateGroup.bodies || [])
          .map((body, originalBodyIndex) => ({
            body,
            originalBodyIndex,
            developmentSpan: preferredTemporalQualitativeDevelopmentSpan(body, {
              sourceTitle: primaryTemporalGroup.title,
              topicTerms: temporalRetrievalPlan.topicTerms,
              minimumEvidenceYearExclusive: Number.isInteger(latestTargetYear)
                ? latestTargetYear
                : null
            })
          }))
          .filter(candidate => candidate.developmentSpan)
          .sort((left, right) =>
            Number(right.developmentSpan.score || 0) - Number(left.developmentSpan.score || 0) ||
            left.originalBodyIndex - right.originalBodyIndex
          )[0] || null;
        const companionDevelopmentCandidate = groupedMatches
          .map((group, groupIndex) => {
            if (
              !group.docId ||
              group.docId === primaryTemporalGroup.docId ||
              !targetYearSet.has(extractMatchGroupYear(group)) ||
              !isResearchOrJournalSource({ source_type: group.sourceType })
            ) return null;
            const rawCandidateGroup = rawDevelopmentGroupsByDocument.get(group.docId) || group;
            const developmentCandidate = (rawCandidateGroup.bodies || [])
              .map((body, originalBodyIndex) => ({
                body,
                originalBodyIndex,
                developmentSpan: preferredTemporalQualitativeDevelopmentSpan(body, {
                  sourceTitle: group.title,
                  topicTerms: temporalRetrievalPlan.topicTerms,
                  requireTitleTopicMatch: true
                })
              }))
              .filter(candidate => candidate.developmentSpan)
              .sort((left, right) =>
                Number(right.developmentSpan.score || 0) - Number(left.developmentSpan.score || 0) ||
                left.originalBodyIndex - right.originalBodyIndex
              )[0];
            return developmentCandidate ? { group, groupIndex, ...developmentCandidate } : null;
          })
          .filter(Boolean)
          .sort((left, right) =>
            Number(right.developmentSpan.titleTopicCoverage || 0) -
              Number(left.developmentSpan.titleTopicCoverage || 0) ||
            Number(right.developmentSpan.score || 0) - Number(left.developmentSpan.score || 0) ||
            left.groupIndex - right.groupIndex
          )[0] || null;
        const companionGroup = companionDevelopmentCandidate?.group || null;
        const protectedAnnualSourceIds = new Set();
        for (const year of temporalRetrievalPlan.years) {
          const sourceIds = Array.from(new Set(
            renderedAnnualRows
              .filter(row => row.year === year)
              .map(row => row.source_id)
              .filter(Boolean)
          ));
          if (sourceIds.length === 1) protectedAnnualSourceIds.add(sourceIds[0]);
        }
        const existingCompanionIndex = companionGroup
          ? budgeted.used.findIndex((group, index) => index > 0 && group.docId === companionGroup.docId)
          : -1;
        const preserveExistingCompanionEvidence = existingCompanionIndex > 0 && protectedAnnualSourceIds.has(
          budgeted.used[existingCompanionIndex].sourceId || budgeted.used[existingCompanionIndex].key
        );
        let companionReplacementIndex = existingCompanionIndex;
        if (companionGroup && companionReplacementIndex < 0) {
          for (let index = budgeted.used.length - 1; index > 0; index -= 1) {
            const sourceId = budgeted.used[index].sourceId || budgeted.used[index].key;
            if (protectedAnnualSourceIds.has(sourceId)) continue;
            companionReplacementIndex = index;
            break;
          }
        }
        // A sibling chunk can repeat the same aggregate sentence with a page
        // boundary or overlap marker. Protect the bound fact identity here;
        // literal evidence text is still retained and revalidated downstream.
        const aggregateRowKey = row => JSON.stringify([
          Number(row?.period_start_year),
          Number(row?.period_end_year),
          String(row?.value || ""),
          row?.percentage === true,
          String(row?.source_id || "").trim(),
          (Array.isArray(row?.metric_tokens) ? row.metric_tokens : [])
            .map(token => String(token || "").trim().toLocaleLowerCase("et"))
            .filter(Boolean)
            .sort()
        ]);
        const renderedAggregateRowKeys = new Set(renderedAggregateRows.map(aggregateRowKey));
        let developmentAggregateRowKeys = new Set();
        let developmentContextAccepted = false;
        let developmentContextReason = "development_span_missing";

        if (
          renderedPrimaryEntry &&
          renderedPrimaryBlock &&
          primaryDevelopmentCandidate &&
          companionDevelopmentCandidate &&
          companionReplacementIndex > 0
        ) {
          const separator = "\n---\n";
          const pinDevelopmentUnit = ({ candidate, baseEntry, baseBlock = null, contextIndex, append }) => {
            const normalizedUnit = String(candidate?.developmentSpan?.text || "").trim();
            if (normalizedUnit.length < 45 || normalizedUnit.length > 480) return null;
            if (
              append &&
              normalizeIntentText(baseBlock?.evidenceText || "").includes(normalizeIntentText(normalizedUnit))
            ) {
              return { entry: baseEntry, block: baseBlock };
            }
            const originalBody = String(candidate?.body || "");
            let startOffset = Math.max(0, Math.min(originalBody.length, Number(candidate?.developmentSpan?.start) || 0));
            let endOffset = Math.max(startOffset, Math.min(
              originalBody.length,
              Number(candidate?.developmentSpan?.end) || originalBody.length
            ));
            while (startOffset < endOffset && /\s/u.test(originalBody[startOffset])) startOffset += 1;
            while (endOffset > startOffset && /\s/u.test(originalBody[endOffset - 1])) endOffset -= 1;
            const exactUnit = originalBody.slice(startOffset, endOffset);
            if (!exactUnit) return null;
            const bodies = append && Array.isArray(baseEntry?.bodies) ? [...baseEntry.bodies] : [];
            let originalBodyIndex = bodies.findIndex(body => String(body || "") === originalBody);
            if (originalBodyIndex < 0) {
              originalBodyIndex = bodies.length;
              bodies.push(originalBody);
            }
            const pinnedEntry = { ...baseEntry, bodies };
            const renderedUnitEntry = { ...pinnedEntry, bodies: [exactUnit] };
            const renderedUnitBudget = buildContextWithBudget([renderedUnitEntry], {
              maxGroups: 1,
              maxBodies: 1,
              includeAuthors: baseContextBudgetOptions.includeAuthors
            });
            const renderedUnitBlock = renderedUnitBudget.renderedBlocks[0];
            if (renderedUnitBlock?.truncated === true || !renderedUnitBlock?.evidenceText) return null;
            const span = {
              original_body_index: originalBodyIndex,
              original_body_hash: hashRenderedText(originalBody),
              rendered_body_hash: hashRenderedText(renderedUnitBlock.evidenceText),
              original_body_chars: originalBody.length,
              rendered_body_chars: renderedUnitBlock.evidenceText.length,
              start_offset: startOffset,
              end_offset: endOffset,
              truncated: startOffset > 0 || endOffset < originalBody.length
            };
            if (!append) {
              return {
                entry: pinnedEntry,
                block: {
                  ...renderedUnitBlock,
                  text: renderOneContextBlock(
                    renderedUnitEntry,
                    contextIndex,
                    { maxBodies: 1, includeAuthors: baseContextBudgetOptions.includeAuthors }
                  ),
                  originalBodyCount: bodies.length,
                  renderedBodyCount: 1,
                  originalBodyHash: hashRenderedText(bodies.join(separator)),
                  renderedBodyHash: hashRenderedText(renderedUnitBlock.evidenceText),
                  truncated: span.truncated || bodies.length > 1,
                  bodySpans: [span]
                }
              };
            }
            const evidenceText = [baseBlock?.evidenceText, renderedUnitBlock.evidenceText]
              .filter(Boolean)
              .join(separator);
            const renderedBodyCount = Number(baseBlock?.renderedBodyCount || 0) + 1;
            return {
              entry: pinnedEntry,
              block: {
                ...baseBlock,
                text: [baseBlock?.text, renderedUnitBlock.evidenceText].filter(Boolean).join(separator),
                evidenceText,
                originalBodyCount: bodies.length,
                renderedBodyCount,
                originalBodyHash: hashRenderedText(bodies.join(separator)),
                renderedBodyHash: hashRenderedText(evidenceText),
                truncated: baseBlock?.truncated === true || span.truncated || bodies.length > renderedBodyCount,
                bodySpans: [
                  ...(Array.isArray(baseBlock?.bodySpans) ? baseBlock.bodySpans : []),
                  span
                ]
              }
            };
          };
          const pinnedPrimary = pinDevelopmentUnit({
            candidate: primaryDevelopmentCandidate,
            baseEntry: renderedPrimaryEntry,
            baseBlock: renderedPrimaryBlock,
            contextIndex: 0,
            append: true
          });
          const pinnedCompanion = pinDevelopmentUnit({
            candidate: companionDevelopmentCandidate,
            baseEntry: preserveExistingCompanionEvidence
              ? budgeted.used[companionReplacementIndex]
              : companionGroup,
            baseBlock: preserveExistingCompanionEvidence
              ? budgeted.renderedBlocks[companionReplacementIndex]
              : null,
            contextIndex: companionReplacementIndex,
            append: preserveExistingCompanionEvidence
          });
          if (pinnedPrimary && pinnedCompanion) {
            const primaryPinnedEntry = pinnedPrimary.entry;
            const mergedPrimaryBlock = pinnedPrimary.block;
            const companionPinnedEntry = pinnedCompanion.entry;
            const exactCompanionBlock = pinnedCompanion.block;
            const candidateUsed = [...budgeted.used];
            const candidateBlocks = [...budgeted.renderedBlocks];
            candidateUsed[0] = primaryPinnedEntry;
            candidateUsed[companionReplacementIndex] = companionPinnedEntry;
            candidateBlocks[0] = mergedPrimaryBlock;
            candidateBlocks[companionReplacementIndex] = exactCompanionBlock;
            const candidateText = candidateBlocks.map(block => block.text).join("\n\n");
            const developmentAggregateRows = buildTemporalAggregatePeriodRows({
              sources: [{
                source_id: primaryPinnedEntry.sourceId || primaryPinnedEntry.key,
                evidenceText: mergedPrimaryBlock.text
              }],
              targetYears: temporalRetrievalPlan.years
            });
            developmentAggregateRowKeys = new Set(developmentAggregateRows.map(aggregateRowKey));
            const preservesRenderedAggregateRows =
              renderedAggregateRowKeys.size === developmentAggregateRowKeys.size &&
              [...renderedAggregateRowKeys].every(key => developmentAggregateRowKeys.has(key));
            const pinnedContextBudget = Math.max(
              500,
              Math.floor(RAG_CTX_MAX_CHARS * (1 - RAG_CTX_HEADROOM))
            );
            const contextStateIsAtomic =
              candidateUsed.length === candidateBlocks.length &&
              candidateText === candidateBlocks.map(block => block.text).join("\n\n");
            if (!preservesRenderedAggregateRows) {
              developmentContextReason = "aggregate_rows_changed";
            } else if (!contextStateIsAtomic) {
              developmentContextReason = "context_state_mismatch";
            } else if (candidateText.length > pinnedContextBudget) {
              developmentContextReason = "context_budget_exceeded";
            } else {
              budgeted = {
                text: candidateText,
                used: candidateUsed,
                renderedBlocks: candidateBlocks
              };
              developmentContextAccepted = true;
              developmentContextReason = "exact_qualitative_context_bound";
            }
          } else {
            developmentContextReason = "qualitative_unit_not_renderable";
          }
        } else if (companionReplacementIndex < 1) {
          developmentContextReason = "protected_secondary_slot_unavailable";
        }
        temporalDevelopmentContextTrace = {
          version: "temporal_development_context_v1",
          attempted: true,
          expansion_document_count: developmentDocumentIds.length,
          primary_source_id: renderedPrimaryEntry?.sourceId || renderedPrimaryEntry?.key || null,
          primary_original_body_count: Array.isArray(primaryTemporalGroup?.bodies)
            ? primaryTemporalGroup.bodies.length
            : 0,
          primary_body_hashes: (Array.isArray(primaryTemporalGroup?.bodies)
            ? primaryTemporalGroup.bodies
            : []).map(body => hashRenderedText(body)).slice(0, 16),
          primary_candidate_body_hashes: (Array.isArray(primaryDevelopmentCandidateGroup?.bodies)
            ? primaryDevelopmentCandidateGroup.bodies
            : []).map(body => hashRenderedText(body)).slice(0, 16),
          primary_development_span_found: !!primaryDevelopmentCandidate,
          companion_seed_source_id: companionSeedGroup?.sourceId || companionSeedGroup?.key || null,
          companion_seed_body_hashes: (Array.isArray(
            rawDevelopmentGroupsByDocument.get(companionSeedGroup?.docId)?.bodies
          )
            ? rawDevelopmentGroupsByDocument.get(companionSeedGroup?.docId).bodies
            : (companionSeedGroup?.bodies || [])
          ).map(body => hashRenderedText(body)).slice(0, 16),
          companion_source_id: companionGroup?.sourceId || companionGroup?.key || null,
          companion_body_hashes: (Array.isArray(companionGroup?.bodies)
            ? companionGroup.bodies
            : []).map(body => hashRenderedText(body)).slice(0, 16),
          companion_development_span_found: !!companionDevelopmentCandidate,
          companion_replacement_index: companionReplacementIndex,
          companion_existing_evidence_preserved: preserveExistingCompanionEvidence,
          protected_annual_source_count: protectedAnnualSourceIds.size,
          aggregate_row_count_before: renderedAggregateRowKeys.size,
          aggregate_row_count_after: developmentAggregateRowKeys.size,
          aggregate_rows_preserved:
            renderedAggregateRowKeys.size > 0 &&
            renderedAggregateRowKeys.size === developmentAggregateRowKeys.size &&
            [...renderedAggregateRowKeys].every(key => developmentAggregateRowKeys.has(key)),
          accepted: developmentContextAccepted,
          reason: developmentContextReason,
          topic_terms: temporalRetrievalPlan.topicTerms.slice(0, 12)
        };
      }
    }
    contextRenderDurationMs = monotonicDurationMs(contextRenderStartedAt);
    renderedEvidenceGroups = budgeted.used.map((group, index) => ({
      ...group,
      bodies: [String(budgeted.renderedBlocks?.[index]?.evidenceText || "")]
    }));
    requestedFactEvidenceCoverage = buildRequestedFactSlotCoverage(
      questionPlan,
      renderedEvidenceGroups,
      { specificResearchFactQuestion, documentIdentityEvidence }
    );
    if (
      requestedFactEvidenceCoverage.enabled === true &&
      requestedFactEvidenceCoverage.complete !== true
    ) {
      extraSystemInstructions.push(
        `REQUESTED_FACT_EVIDENCE_INCOMPLETE: final rendered evidence is missing requested slot indexes ` +
        `${requestedFactEvidenceCoverage.missing_slot_indexes.join(",")}. Do not silently omit them or fill them from another document.`
      );
    }
    const percentCountSemanticsInstruction = buildPercentCountSemanticsInstruction(renderedEvidenceGroups);
    if (percentCountSemanticsInstruction) extraSystemInstructions.push(percentCountSemanticsInstruction);
    const numericScopeEvidenceSummary = buildNumericScopeEvidenceSummary(effectiveMessage, renderedEvidenceGroups);
    if (numericScopeEvidenceSummary) extraSystemInstructions.push(numericScopeEvidenceSummary);
    const uniformRelationContract = buildUniformParticipantRelationContract(
      effectiveMessage,
      renderedEvidenceGroups.slice(0, 1),
      replyLang
    );
    numericRelationContract = uniformRelationContract.trace;
    if (uniformRelationContract.instruction) {
      extraSystemInstructions.push(uniformRelationContract.instruction);
    }
    if (shouldUseReportedPracticeInstruction(effectiveMessage, budgeted.used)) {
      extraSystemInstructions.push(buildReportedPracticeInstruction(replyLang));
    }
  }

  const ragContext = budgeted.text;
  const renderedRagBlocks = Array.isArray(budgeted.renderedBlocks)
    ? budgeted.renderedBlocks
    : [];
  const sourcePackageEntries = [
    ...budgeted.used,
    ...groupedMatches
  ];
  const sourcePackages = buildRuntimeSourcePackages(sourcePackageEntries.map((entry, idx) => ({
    ...entry,
    id: displaySourceIdForContextEntry(entry, idx),
    source_id: displaySourceIdForContextEntry(entry, idx),
    raw_source_id: entry.sourceId || undefined
  })));
  const packageAwareContext = buildPackageAwareContext(sourcePackages, {
    query: [effectiveMessage, languagePlan?.canonicalQueryEt].filter(Boolean).join(" "),
    role: normalizedRole
  });
  const packageAwareAnsweringUsed = !!(
    packageAwareContext.used &&
    !(legalLookupPlan?.enabled && legalLookupPlan.mode === "explicit_paragraph")
  );
  if (packageAwareContext.insufficientPreciseSupport === true) {
    ragRiskPolicy = {
      ...ragRiskPolicy,
      riskLevel: "high",
      stakes: "actionable",
      evidenceScope: "current_municipality",
      decisionSource: "package_support_contract",
      requiredEvidence: "strong",
      insufficientEvidenceMode: true,
      reasons: [
        ...(Array.isArray(ragRiskPolicy.reasons) ? ragRiskPolicy.reasons : []),
        packageAwareContext.packageSelectionStatus === "insufficient_service_match"
          ? "insufficient_service_match"
          : "missing_precise_service_evidence"
      ].filter((value, index, values) => values.indexOf(value) === index).slice(0, 6)
    };
    extraSystemInstructions.push(buildRiskPolicyInstruction(ragRiskPolicy, replyLang));
  }
  if (packageAwareContext.packageSelectionStatus === "insufficient_service_match") {
    extraSystemInstructions.push(
      "PACKAGE_SELECTION_STATUS: insufficient_service_match. Ära kasuta sama omavalitsuse teise teenuse paketti küsitud teenuse tasu, tähtaja, vormi, kontakti ega tingimuste kinnitamiseks. Kui RAG_CONTEXT ei sisalda küsitud teenuse otsest kinnitust, ütle, et kasutatud allikad ei kinnita detaili piisavalt."
    );
  }
  const sectionAttribution = buildSectionAttribution({
    sourcePackages,
    packageAwareAnswering: {
      used: packageAwareAnsweringUsed
    },
    ragRiskPolicy,
    queryPlan
  });
  if (packageAwareAnsweringUsed) {
    extraSystemInstructions.push(
      "Kasuta KOV teenuse või toetuse vastamisel SourcePackage'i esmase struktuurina. Teenuse olemasolu küsimuses anna kohe lühidalt ka teenuse sisu, taotlemise info ning kinnitatud vormi/kontakti lingid, kui need on SourcePackage'is olemas. Kombineeri KOV teenuselehe praktiline info ja KOV määruse info; ära luba neid detaile hiljem anda, kui need on allikates juba olemas. Ära väida puuduvat vormi, kontakti, õiguslikku alust, tasu ega tähtaega, kui package märgib selle sektsiooni puuduvaks."
    );
  }
  const sourcePackageContactEvidenceRequested = packageAwareAnsweringUsed &&
    packageAwareContext.requiredEvidenceSections?.includes("contacts");
  const useServiceMapKovContactContext =
    (currentMunicipalityContactEvidenceRequested || sourcePackageContactEvidenceRequested) &&
    !!serviceMapKovContactContext &&
    packageAwareContext.packageSelectionStatus !== "insufficient_service_match";
  const preciseServiceContactUnsupported = sourcePackageContactEvidenceRequested &&
    !useServiceMapKovContactContext;
  const kovContactMode = resolveKovContactMode({
    message: effectiveMessage,
    listRequest: municipalityServiceBenefitListRequest,
    contactInventoryRequest: municipalityContactRequest,
    serviceSpecific: packageAwareAnsweringUsed
  });
  if (useServiceMapKovContactContext) {
    extraSystemInstructions.push(buildServiceMapKovContactInstruction(replyLang, {
      mode: kovContactMode
    }));
  } else if (preciseServiceContactUnsupported) {
    extraSystemInstructions.push(
      "CONTACT_EVIDENCE_STATUS: insufficient_service_match. SourcePackage ei kinnita sellele teenusele kontakti. Ara esita RAG_CONTEXT-i eraldiseisvat uldkontakti, nime, telefoninumbrit ega e-posti selle teenuse kinnitatud kontaktina; utle, et kasutatud allikad ei kinnita teenuse kontaktisikut piisavalt."
    );
  }
  const docBudget = getDocContextBudget(normalizedRole, combineSources, docContextBudgets);
  const docQueryText = [effectiveMessage, ...extractRecentUserText(retrievalHistory, 2)].filter(Boolean).join("\n");
  const docContextResult = buildEphemeralDocContext(ephemeralChunks, {
    queryText: docQueryText,
    charBudget: docBudget.charBudget,
    maxChunks: docBudget.maxChunks,
    maxInputChunks: docContextBudgets.maxInputChunks,
    chunkCharsMax: docContextBudgets.chunkCharsMax
  });
  const docContext = docContextResult.text;
  const contextParts = [];

  if (docContext && !preferRagForSourceLookup) {
    contextParts.push(`USER DOCUMENT:\n${docContext}`);
  }
  if (packageAwareAnsweringUsed && packageAwareContext.contextText) {
    contextParts.push(packageAwareContext.contextText);
  }
  if (preferRagForSourceLookup) {
    if (ragContext) contextParts.push(ragContext);
  } else if (!docContext) {
    if (ragContext) contextParts.push(ragContext);
  } else if (combineSources && ragContext) {
    contextParts.push(ragContext);
  }
  if (useServiceMapKovContactContext) {
    contextParts.push(serviceMapKovContactContext);
  }

  const context = contextParts.filter(Boolean).join("\n\n");
  const lookupFallbackContext = sourceLookupRequest
    ? "SOURCE_LOOKUP_CONTEXT: The current targeted source lookup returned no matches."
    : "";
  const conversationalFallbackContext =
    !externalSourcesNeeded && !docContext
      ? "CONVERSATIONAL_CONTEXT: No verified external context was retrieved for this turn."
      : "";
  const effectiveContext = context && context.trim() ? context : lookupFallbackContext || conversationalFallbackContext;
  const renderedContextHash = hashRenderedText(effectiveContext);
  const grounding = groundingStrength(groupedMatches);
  const usedDocContext = contextParts.some((part) => part.startsWith("USER DOCUMENT:\n"));
  const usedRagContext = !!ragContext && contextParts.some((part) => part === ragContext);
  if (usedRagContext) {
    const answerShapeInstruction = requestedAnswerShapeInstruction(questionPlan, replyLang);
    if (answerShapeInstruction) extraSystemInstructions.push(answerShapeInstruction);
    const requestedMetricContractResult = buildRequestedFactSlotContract({
      questionPlan,
      renderedGroups: budgeted.used,
      renderedBlocks: renderedRagBlocks,
      replyLang,
      specificResearchFactQuestion,
      documentIdentityEvidence
    });
    requestedFactSlotContract = requestedMetricContractResult.trace;
    // Keep the legacy field during the trace-contract migration.
    requestedMetricContract = requestedFactSlotContract;
    if (requestedMetricContractResult.instruction) {
      extraSystemInstructions.push(requestedMetricContractResult.instruction);
    }
    const requestedQualitativeContractResult = buildRequestedQualitativeSlotContract({
      questionPlan,
      renderedGroups: renderedEvidenceGroups,
      replyLang,
      specificResearchFactQuestion,
      documentIdentityEvidence
    });
    requestedQualitativeSlotContract = requestedQualitativeContractResult.trace;
    if (requestedQualitativeContractResult.instruction) {
      extraSystemInstructions.push(requestedQualitativeContractResult.instruction);
    }
  }
  const usedServiceMapKovContactContext = !!serviceMapKovContactContext &&
    contextParts.some((part) => part === serviceMapKovContactContext);
  const groupedYears = Array.from(new Set(groupedMatches.map(extractMatchGroupYear).filter((year) => Number.isInteger(year))));
  const selectedYears = Array.from(new Set(chosen.map(extractMatchGroupYear).filter((year) => Number.isInteger(year))));
  const contextYears = Array.from(new Set(budgeted.used.map(extractMatchGroupYear).filter((year) => Number.isInteger(year))));
  const retrieversUsed = inferRetrieversUsed(matches, shouldRunRag ? ["dense"] : []);

  if (typeof logInfo === "function") {
    logInfo("rag.afterSearch", {
      rawMatches: matches.length,
      groups: groupedMatches.length,
      grounding,
      mmrSelected: chosen.length,
      groupedYears,
      selectedYears,
      contextYears,
      retrieversUsed,
      requestedYears: temporalRetrievalPlan.enabled ? temporalRetrievalPlan.years : [],
      preferredSourceYears: temporalRetrievalPlan.preferredYears || [],
      preferredSourceYearsSource: temporalRetrievalPlan.preferredYearsSource || "unknown",
      missingYears: temporalMissingYears,
      docChunkInputCount: ephemeralChunks.length,
      docChunkUsedCount: docContextResult.usedChunks,
      docContextChars: docContextResult.usedChars,
      serviceMapKovContactCount: serviceMapKovContacts.length,
      kovContactMode: usedServiceMapKovContactContext ? kovContactMode : undefined,
      ragSkipped: !shouldRunRag,
      externalSourcesNeeded,
      sourceLookupRequest,
      ragRiskLevel: ragRiskPolicy.riskLevel,
      ragRequiredEvidence: ragRiskPolicy.requiredEvidence,
      queryPlanMode: queryPlan.mode,
      queryPlanSelectionStrategy: selectionStrategy,
      queryPlanQueryOrder: queryPlan.query_order,
      municipalityMentioned: allowMunicipalityScopedRag,
      municipalityMatches: effectiveMunicipalities.map((item) => item.displayName)
    });
  }

  if (typeof logEvent === "function") {
    if (shouldRunRag || usedDocContext || usedRagContext || usedServiceMapKovContactContext) {
      await logEvent("rag_search", {
        userId,
        role: normalizedRole,
        isCrisis,
        ragMatchCount: matches.length,
        groupCount: groupedMatches.length,
        chosenGroupCount: chosen.length,
        grounding,
        groupedYears: groupedYears.join(",") || undefined,
        selectedYears: selectedYears.join(",") || undefined,
        contextYears: contextYears.join(",") || undefined,
        retrieversUsed,
        requestedYears: temporalRetrievalPlan.enabled ? temporalRetrievalPlan.years.join(",") : undefined,
        preferredSourceYears: temporalRetrievalPlan.preferredYears?.length
          ? temporalRetrievalPlan.preferredYears.join(",")
          : undefined,
        preferredSourceYearsSource: temporalRetrievalPlan.preferredYearsSource || "unknown",
        missingYears: temporalMissingYears.length ? temporalMissingYears.join(",") : undefined,
        docChunkInputCount: ephemeralChunks.length,
        docChunkUsedCount: docContextResult.usedChunks,
        docContextChars: docContextResult.usedChars,
        hadDocContext: usedDocContext,
        hadRagContext: usedRagContext,
        hadServiceMapKovContactContext: usedServiceMapKovContactContext,
        serviceMapKovContactCount: serviceMapKovContacts.length,
        kovContactMode: usedServiceMapKovContactContext ? kovContactMode : undefined,
        sourceLookupRequest,
        ragRiskLevel: ragRiskPolicy.riskLevel,
        ragRequiredEvidence: ragRiskPolicy.requiredEvidence,
        ragInsufficientEvidenceMode: ragRiskPolicy.insufficientEvidenceMode,
        queryPlanMode: queryPlan.mode,
        queryPlanSelectionStrategy: selectionStrategy,
        queryPlanQueryOrder: queryPlan.query_order,
        municipalityMentioned: allowMunicipalityScopedRag,
        municipalityMatches: effectiveMunicipalities.map((item) => item.displayName),
        retrievalTimings: retrievalTimings.length ? retrievalTimings : undefined
      });
    } else {
      await logEvent("chat_no_external_sources", {
        userId,
        role: normalizedRole,
        isCrisis,
      sourceLookupRequest,
      ragRiskLevel: ragRiskPolicy.riskLevel,
      messageLength: effectiveMessage.length
      });
    }

    if (isCrisis) {
      await logEvent("crisis_detected", {
        userId,
        role: normalizedRole,
        hasHistory,
        hadRagContext: usedRagContext
      });
    }
  }

  const docSources = ephemeralChunks && ephemeralChunks.length
    ? [{
        id: "user-document",
        title: getEphemeralSourceLabel(ephemeralSource, "(Uploaded document)"),
        url: undefined,
        file: undefined,
        fileName: getEphemeralSourceLabel(ephemeralSource, "") || undefined,
        audience: undefined,
        pageRange: undefined,
        authors: undefined,
        issueLabel: undefined,
        issueId: undefined,
        journalTitle: undefined,
        section: undefined,
        paragraphTitle: undefined,
        year: undefined,
        pages: undefined,
        short_ref: "(uploaded document)",
        evidenceText: docContext ? `USER DOCUMENT:\n${docContext}` : undefined
      }]
    : [];
  const ragSources = budgeted.used.map((entry, idx) => {
    const pageNumbers = Array.isArray(entry.pages) ? entry.pages : [];
    const pageRanges = Array.isArray(entry.pageRanges) ? Array.from(new Set(entry.pageRanges.filter(Boolean))) : [];
    const pageText = collapsePages([...pageRanges, ...pageNumbers]);
    const shortRefText = (makeShortRef(entry, pageText) || "").trim();
    const displaySourceId = displaySourceIdForContextEntry(entry, idx);
    const renderedBlock = renderedRagBlocks[idx];
    return {
      id: displaySourceId,
      source_id: entry.sourceId || undefined,
      sourceId: entry.sourceId || undefined,
      document_id: entry.docId || entry.doc_id || undefined,
      documentId: entry.docId || entry.doc_id || undefined,
      title: entry.title,
      url: entry.url ? displayUrl(entry.url) : undefined,
      file: undefined,
      fileName: entry.fileName || undefined,
      audience: entry.audience || undefined,
      pageRange: pageText || undefined,
      authors: Array.isArray(entry.authors) && entry.authors.length ? entry.authors : undefined,
      issueLabel: entry.issueLabel || undefined,
      issueId: entry.issueId || undefined,
      journalTitle: entry.journalTitle || undefined,
      actTitle: entry.actTitle || undefined,
      act_title: entry.actTitle || undefined,
      actReference: entry.actReference || undefined,
      act_reference: entry.actReference || undefined,
      collectionId: entry.collectionId || undefined,
      collection_id: entry.collectionId || undefined,
      sourceType: entry.sourceType || undefined,
      source_type: entry.sourceType || undefined,
      authority: entry.authority || undefined,
      municipality_id: entry.municipalityId || undefined,
      municipality_name: entry.municipalityName || undefined,
      source_status: entry.sourceStatus || undefined,
      last_checked: entry.lastChecked || undefined,
      valid_from: entry.validFrom || undefined,
      valid_to: entry.validTo || undefined,
      historical: entry.historical === true ? true : undefined,
      canonical_item_id: entry.canonicalItemId || undefined,
      canonicalItemId: entry.canonicalItemId || undefined,
      item_type: entry.itemType || undefined,
      itemType: entry.itemType || undefined,
      resource_type: entry.resourceType || undefined,
      resourceType: entry.resourceType || undefined,
      sections_present: Array.isArray(entry.sectionsPresent) && entry.sectionsPresent.length ? entry.sectionsPresent : undefined,
      sectionsPresent: Array.isArray(entry.sectionsPresent) && entry.sectionsPresent.length ? entry.sectionsPresent : undefined,
      retrieval_channels: Array.isArray(entry.retrievalChannels) && entry.retrievalChannels.length ? entry.retrievalChannels : undefined,
      retrievalChannels: Array.isArray(entry.retrievalChannels) && entry.retrievalChannels.length ? entry.retrievalChannels : undefined,
      section: entry.section || undefined,
      paragraphTitle: entry.paragraphTitle || undefined,
      paragraphNumber: entry.paragraphNumber || undefined,
      subsectionNumber: entry.subsectionNumber || undefined,
      pointNumber: entry.pointNumber || undefined,
      year: entry.year || undefined,
      pages: pageNumbers.length ? pageNumbers : undefined,
      short_ref: shortRefText || undefined,
      // Attribution may only inspect the exact block that was rendered into
      // RAG_CONTEXT. Using the original bodies here lets clipped-out facts
      // falsely support an answer the model could not have grounded.
      evidenceText: renderedBlock?.text || undefined
    };
  });

  let sources;
  if (preferRagForSourceLookup) {
    sources = ragSources;
  } else if (docSources.length && combineSources) {
    sources = [...docSources, ...ragSources];
  } else if (docSources.length) {
    sources = docSources;
  } else {
    sources = ragSources;
  }

  if (packageAwareAnsweringUsed) {
    const packageDisplaySources = packageDisplayedSourcesFromPackages(
      sourcePackages,
      packageAwareContext.packageCandidateSourceIds
    );
    const packageDisplayIds = new Set(
      packageAwareContext.packageCandidateSourceIds.map(value => String(value || "").trim()).filter(Boolean)
    );
    const retainedSources = sources.filter((source, index) => packageDisplayIds.has(stableSourceIdFromDisplaySource(source, index)));
    sources = mergePackageDisplayedSources(retainedSources, packageDisplaySources);
  }

  const scopeContactSourcesOnly = activeContactScope?.kind === "empty" || (
    activeContactScope?.kind === "subset" && (
      activeContactScope.contextual ||
      (!municipalityStaffingCountRequest && !isCurrentMunicipalStaffingPresenceRequest(normalizedMunicipalityQuestion))
    )
  );
  const serviceMapKovContactSourceEntries = scopeContactSourcesOnly
    ? activeContactScope.entries
    : serviceMapKovContacts;
  const serviceMapKovContactSources = usedServiceMapKovContactContext
    ? buildServiceMapKovContactSources(serviceMapKovContactSourceEntries)
    : [];
  const serviceMapContactMonitorSource = serviceMapContactMonitorRequest || (
    usedServiceMapKovContactContext && contactReplyIntent(effectiveMessage).freshness
  )
    ? buildServiceMapContactMonitorSource(replyLang)
    : null;
  const serviceMapKovContactEvidence = usedServiceMapKovContactContext
    ? buildServiceMapKovContactEvidence(serviceMapKovContacts, { activeScope: activeContactScope })
    : { enabled: false, totalCount: 0, municipalities: [], roles: [], roleFamilies: [], contacts: [] };
  if (serviceMapKovContactSources.length || serviceMapContactMonitorSource) {
    sources = [
      ...sources,
      ...serviceMapKovContactSources,
      ...(serviceMapContactMonitorSource ? [serviceMapContactMonitorSource] : [])
    ];
  }

  semanticTurnContract = promoteSemanticDomainScope(
    semanticTurnContract,
    [...budgeted.used, ...sources]
  );
  if (queryPlan && typeof queryPlan === "object") {
    queryPlan.semantic_turn_contract = semanticTurnContract;
    queryPlan.social_scope = semanticTurnContract?.domain_scope?.effective || "unknown";
    queryPlan.social_scope_reason = semanticTurnContract?.domain_scope?.reason || "not_classified";
    if (queryPlan.question_planner && typeof queryPlan.question_planner === "object") {
      queryPlan.question_planner.social_scope = queryPlan.social_scope;
      queryPlan.question_planner.social_scope_reason = queryPlan.social_scope_reason;
    }
  }

  const retrievedSourceIds = uniqueIds(matches.map(stableSourceIdFromRawMatch));
  const selectedContextSourceIds = uniqueIds(sources.map(stableSourceIdFromDisplaySource));
  const selectedContextDetails = budgeted.used.map((entry, idx) => {
    const renderedBlock = renderedRagBlocks[idx];
    return {
      source_id: displaySourceIdForContextEntry(entry, idx),
      raw_source_id: entry.sourceId || undefined,
      title: entry.title || undefined,
      section: entry.section || undefined,
      paragraph_number: entry.paragraphNumber || undefined,
      paragraph_title: entry.paragraphTitle || undefined,
      subsection_number: entry.subsectionNumber || undefined,
      body_preview: renderedBlock?.evidenceText
        ? String(renderedBlock.evidenceText).slice(0, 1000)
        : undefined,
      rendered_evidence_hash: hashRenderedText(renderedBlock?.text),
      original_body_hash: renderedBlock?.originalBodyHash || undefined,
      rendered_body_hash: renderedBlock?.renderedBodyHash || undefined,
      rendered_evidence_chars: renderedBlock?.text?.length || 0,
      rendered_evidence_truncated: renderedBlock?.truncated === true,
      rendered_body_count: Number.isFinite(Number(renderedBlock?.renderedBodyCount))
        ? Number(renderedBlock.renderedBodyCount)
        : 0,
      original_body_count: Number.isFinite(Number(renderedBlock?.originalBodyCount))
        ? Number(renderedBlock.originalBodyCount)
        : 0,
      rendered_body_spans: Array.isArray(renderedBlock?.bodySpans)
        ? renderedBlock.bodySpans
        : [],
      source_type: entry.sourceType || undefined,
      collection_id: entry.collectionId || undefined,
      canonical_item_id: entry.canonicalItemId || undefined,
      item_type: entry.itemType || undefined,
      resource_type: entry.resourceType || undefined,
      sections_present: Array.isArray(entry.sectionsPresent) && entry.sectionsPresent.length ? entry.sectionsPresent : undefined,
      municipality_id: entry.municipalityId || undefined,
      municipality_name: entry.municipalityName || undefined,
      source_status: entry.sourceStatus || undefined,
      historical: entry.historical === true ? true : undefined,
      retrieval_channels: Array.isArray(entry.retrievalChannels) && entry.retrievalChannels.length ? entry.retrievalChannels : undefined,
      hybrid_score: typeof entry.bestScore === "number" ? roundTraceNumber(entry.bestScore) : undefined,
      dense_score: typeof entry.denseScore === "number" ? roundTraceNumber(entry.denseScore) : undefined,
      lexical_score: typeof entry.lexicalScore === "number" ? roundTraceNumber(entry.lexicalScore) : undefined,
      lexical_score_normalized: typeof entry.lexicalScoreNormalized === "number" ? roundTraceNumber(entry.lexicalScoreNormalized) : undefined,
      bm25_score: typeof entry.bm25Score === "number" ? roundTraceNumber(entry.bm25Score) : undefined,
      bm25_coverage: typeof entry.bm25Coverage === "number" ? roundTraceNumber(entry.bm25Coverage) : undefined,
      bm25_matches: typeof entry.bm25Matches === "number" ? entry.bm25Matches : undefined,
      bm25_query_tokens: typeof entry.bm25QueryTokens === "number" ? entry.bm25QueryTokens : undefined,
      rrf_score: typeof entry.rrfScore === "number" ? roundTraceNumber(entry.rrfScore) : undefined,
      channel_boost: typeof entry.channelBoost === "number" ? roundTraceNumber(entry.channelBoost) : undefined,
      hybrid_rank: typeof entry.hybridRank === "number" ? entry.hybridRank : undefined,
      dense_rank: typeof entry.denseRank === "number" ? entry.denseRank : undefined,
      global_dense_rank: typeof entry.globalDenseRank === "number" ? entry.globalDenseRank : undefined,
      fact_segment_dense_rank: typeof entry.factSegmentDenseRank === "number" ? entry.factSegmentDenseRank : undefined,
      lexical_rank: typeof entry.lexicalRank === "number" ? entry.lexicalRank : undefined,
      rank_score: typeof entry.rankScore === "number" ? Number(entry.rankScore.toFixed(4)) : undefined,
      topic_boost: typeof entry.topicBoost === "number" ? Number(entry.topicBoost.toFixed(4)) : undefined,
      quality_adjust: typeof entry.qualityAdjust === "number" ? Number(entry.qualityAdjust.toFixed(4)) : undefined
    };
  });
  const hybridRetrieval = summarizeHybridRetrieval(matches);
  const insufficientPreciseLegalSourceSupport = !!(
    legalLookupPlan?.enabled &&
    legalLookupPlan.mode === "explicit_paragraph" &&
    legalSelection.insufficientPreciseLegalSourceSupport
  );
  const evidencePackage = shouldBuildEvidencePackage({
    queryPlan,
    legalLookupPlan,
    packageAwareAnsweringUsed,
    usedDocContext
  })
    ? buildEvidencePackage({
        queryPlan,
        selectedEntries: budgeted.used,
        selectedSources: sources,
        ragRiskPolicy,
        overviewSynthesis: overviewSelection?.metadata || null
      })
    : null;
  if (!currentTurnAuthorConfirmation) {
    currentTurnAuthorConfirmation = buildCurrentTurnAuthorConfirmation(
      questionPlan?.semantic_candidates?.current_turn_document_identity,
      groupedMatches,
      languagePlan
    );
  }

  if (shouldRunRag && !isCrisis) {
    extraSystemInstructions.push(buildEvidencePreservationInstruction(replyLang));
    extraSystemInstructions.push(
      "STRICT_CORPUS_BOUNDARY: Faktivastus peab tuginema ainult RAG_CONTEXT-is olevale otseselt asjakohasele materjalile. Kui kontekst puudub või käsitleb teist riiki, omavalitsust, teenust või teemat, ära lisa mudeli üldteadmisi faktidena. Ütle lühidalt, et kasutatud korpus ei kinnita vastust, ning nimeta ainult see lisainfo või ametlik allikas, mida oleks vastamiseks vaja."
    );
  }

  if (evidencePackage) {
    extraSystemInstructions.push(buildEvidencePackageInstruction(evidencePackage));
  }

  return {
    previousSourceUseRequest,
    sourceLookupRequest,
    extraSystemInstructions,
    effectiveContext,
    grounding,
    sources,
    retrievalMeta: {
      attributionQuery: retrievalMessage,
      personTopicTerms: canonicalRetrievalActive && Array.isArray(questionPlan?.person_topic_terms)
        ? questionPlan.person_topic_terms
        : [],
      personCoauthorNames: canonicalRetrievalActive && Array.isArray(questionPlan?.person_coauthor_names)
        ? questionPlan.person_coauthor_names
        : [],
      personCoauthorRequested: canonicalRetrievalActive && questionPlan?.person_coauthor_requested === true,
      responseReplyLang: languagePlan?.answerLanguage || replyLang,
      ragAttempted: shouldRunRag,
      ragSearchFailed,
      rawMatchesCount: matches.length,
      retrievedSourceIds,
      selectedContextSourceIds,
      selectedContextDetails,
      selectedContextCount: sources.length,
      temporalDevelopmentContext: temporalDevelopmentContextTrace,
      renderedContextHash,
      renderedContextChars: effectiveContext.length,
      retrieversUsed,
      hybridRetrieval,
      lemmaFtsShadow: {
        version: "lemma_fts_shadow_trace_v1",
        decision_mode: "shadow_only",
        production_path_changed: false,
        observations: retrievalTimings
          .map(timing => timing.lemma_fts_shadow)
          .filter(observation => observation && typeof observation === "object")
          .slice(0, 12)
      },
      sourcePackages,
      municipalityContext: effectiveMunicipalities.map((item) => ({
        slug: item.slug,
        id: item.id,
        municipalityId: item.municipalityId,
        baseName: item.baseName,
        type: item.type,
        displayName: item.displayName,
        matchedTerm: item.matchedTerm,
        matchSource: item.matchSource
      })),
      serviceMapKovContactCount: serviceMapKovContacts.length,
      serviceMapKovContactLoadState,
      currentMunicipalityContactEvidenceRequested,
      sourcePackageContactEvidenceRequested,
      serviceMapKovContactCheckSchedule: {
        ...SERVICE_MAP_CONTACT_CHECK_SCHEDULE,
        sourceId: serviceMapContactMonitorSource?.sourceId || null
      },
      structuredContactRegistryTurn,
      structuredContactMissingMunicipalityTurn,
      structuredContactMonitorTurn,
      structuredMunicipalityAmbiguityTurn,
      municipalityClarificationCandidates: structuredMunicipalityAmbiguityTurn
        ? questionPlan.municipality_candidates.slice(0, 4)
        : [],
      structuredAuthorCorpusTurn: authorCorpusEvidence.enabled === true &&
        authorCorpusEvidence.complete === true &&
        authorCorpusEvidence.documentsComplete === true,
      deterministicAuthorReply: buildDeterministicAuthorCorpusReply(replyLang, authorCorpusEvidence),
      deterministicContactReply: structuredContactRegistryTurn
        ? buildDeterministicServiceMapContactReply({
            message: effectiveMessage,
            replyLang,
            entries: serviceMapKovContacts,
            activeScope: activeContactScope,
            loadState: serviceMapKovContactLoadState
          })
        : structuredContactMissingMunicipalityTurn
          ? buildDeterministicContactMunicipalityClarification(replyLang)
        : structuredContactMonitorTurn
          ? buildDeterministicContactMonitorReply(replyLang)
          : null,
      serviceMapKovContactEvidence,
      packageAwareAnswering: {
        used: packageAwareAnsweringUsed,
        usedPackageIds: packageAwareAnsweringUsed ? packageAwareContext.usedPackageIds : [],
        missingSectionsUsed: packageAwareAnsweringUsed ? packageAwareContext.missingSectionsUsed : [],
        requestedSections: packageAwareAnsweringUsed ? packageAwareContext.requestedSections : [],
        packageSectionSourceIds: packageAwareAnsweringUsed ? packageAwareContext.packageSectionSourceIds : {},
        packageCandidateSourceIds: packageAwareAnsweringUsed ? packageAwareContext.packageCandidateSourceIds : [],
        packageDisplayedSourceIds: packageAwareAnsweringUsed ? packageAwareContext.packageDisplayedSourceIds : [],
        packageAnswerFlags: packageAwareContext.packageAnswerFlags || [],
        packageSelectionStatus: packageAwareContext.packageSelectionStatus,
        serviceAnchors: packageAwareContext.serviceAnchors || [],
        insufficientPreciseSupport: packageAwareContext.insufficientPreciseSupport === true,
        requiredEvidenceSections: packageAwareContext.requiredEvidenceSections || []
      },
      sectionAttribution,
      ragRiskPolicy,
      legalLookupPlan,
      insufficientPreciseLegalSourceSupport,
      numericFactEvidence: {
        enabled: numericFactEvidence.enabled,
        sufficient: numericFactEvidence.sufficient,
        expectedCount: numericFactEvidence.expectedCount,
        evidenceCount: numericFactEvidence.evidenceCount
      },
      numericRelationContract,
      requestedFactSlotContract,
      requestedMetricContract,
      requestedQualitativeSlotContract,
      requestedFactEvidenceCoverage,
      currentTurnAuthorConfirmation,
      authorCorpusEvidence: {
        enabled: authorCorpusEvidence.enabled === true,
        required: authorCorpusEvidence.required === true,
        requestedAuthor: authorCorpusEvidence.requestedAuthor || null,
        canonicalAuthorName: authorCorpusEvidence.canonicalAuthorName || null,
        canonicalAuthorKey: authorCorpusEvidence.canonicalAuthorKey || null,
        matched: authorCorpusEvidence.matched === true,
        complete: authorCorpusEvidence.complete === true,
        documentCount: Number.isInteger(Number(authorCorpusEvidence.documentCount))
          ? Number(authorCorpusEvidence.documentCount)
          : null,
        documentIds: Array.isArray(authorCorpusEvidence.documentIds)
          ? authorCorpusEvidence.documentIds.slice(0, 500)
          : [],
        documents: Array.isArray(authorCorpusEvidence.documents)
          ? authorCorpusEvidence.documents.slice(0, 50)
          : [],
        documentsComplete: authorCorpusEvidence.documentsComplete === true,
        includesCoauthoredWorks: authorCorpusEvidence.includesCoauthoredWorks === true,
        reasons: Array.isArray(authorCorpusEvidence.reasons) ? authorCorpusEvidence.reasons : []
      },
      documentIdentityEvidence: {
        enabled: documentIdentityEvidence.enabled === true,
        required: documentIdentityEvidence.required === true,
        matched: documentIdentityEvidence.matched === true,
        confidence: documentIdentityEvidence.confidence || null,
        requestedAuthor: documentIdentityEvidence.requestedAuthor || null,
        subjectTerms: Array.isArray(documentIdentityEvidence.subjectTerms) ? documentIdentityEvidence.subjectTerms : [],
        selectedDocumentId: documentIdentityEvidence.selectedDocumentId || null,
        selectedTitle: documentIdentityEvidence.selectedTitle || null,
        reasons: Array.isArray(documentIdentityEvidence.reasons) ? documentIdentityEvidence.reasons : [],
        candidates: Array.isArray(documentIdentityEvidence.candidates) ? documentIdentityEvidence.candidates : [],
        durationMs: documentIdentityDurationMs
      },
      performanceTimings: {
        planner_ms: plannerDurationMs,
        semantic_analysis_ms: finiteOptionalNumber(morphology?.analysis_ms) || 0,
        query_planning_ms: queryPlanningDurationMs,
        query_build_ms: queryPlanningDurationMs,
        retrieval_wall_ms: mergedTimingWindowDurationMs(retrievalWindows),
        multi_query_retrieval_ms: retrievalTimings.reduce(
          (sum, timing) => sum + (Number.isFinite(timing.retrieval_total_ms) ? timing.retrieval_total_ms : 0),
          0
        ),
        retrieval_parallel_sum_ms: retrievalTimings.reduce(
          (sum, timing) => sum + (Number.isFinite(timing.retrieval_total_ms) ? timing.retrieval_total_ms : 0),
          0
        ),
        retrieval_query_count: retrievalTimings.length,
        embedding_sum_ms: retrievalTimings.reduce(
          (sum, timing) => sum + (Number.isFinite(timing.embedding_duration_ms) ? timing.embedding_duration_ms : 0),
          0
        ),
        embedding_ms: retrievalTimings.reduce(
          (sum, timing) => sum + (Number.isFinite(timing.embedding_duration_ms) ? timing.embedding_duration_ms : 0),
          0
        ),
        dense_sum_ms: retrievalTimings.reduce(
          (sum, timing) => sum + (Number.isFinite(timing.dense_duration_ms) ? timing.dense_duration_ms : 0),
          0
        ),
        dense_ms: retrievalTimings.reduce(
          (sum, timing) => sum + (Number.isFinite(timing.dense_duration_ms) ? timing.dense_duration_ms : 0),
          0
        ),
        registry_ms: retrievalTimings.reduce(
          (sum, timing) => sum + (Number.isFinite(timing.registry_duration_ms) ? timing.registry_duration_ms : 0),
          0
        ),
        lexical_sum_ms: retrievalTimings.reduce(
          (sum, timing) => sum + (Number.isFinite(timing.lexical_duration_ms) ? timing.lexical_duration_ms : 0),
          0
        ),
        lexical_ms: retrievalTimings.reduce(
          (sum, timing) => sum + (Number.isFinite(timing.lexical_duration_ms) ? timing.lexical_duration_ms : 0),
          0
        ),
        lemma_fts_shadow_ms: retrievalTimings.reduce(
          (sum, timing) => sum + (
            Number.isFinite(timing.lemma_fts_shadow_duration_ms)
              ? timing.lemma_fts_shadow_duration_ms
              : 0
          ),
          0
        ),
        document_sibling_sum_ms: retrievalTimings.reduce(
          (sum, timing) => sum + (Number.isFinite(timing.document_sibling_duration_ms) ? timing.document_sibling_duration_ms : 0),
          0
        ),
        service_fact_segment_sum_ms: retrievalTimings.reduce(
          (sum, timing) => sum + (Number.isFinite(timing.fact_segment_duration_ms) ? timing.fact_segment_duration_ms : 0),
          0
        ),
        shared_read_cache_hits: retrievalTimings.reduce(
          (sum, timing) => sum + (Number.isFinite(timing.shared_read_cache_hits) ? timing.shared_read_cache_hits : 0),
          0
        ),
        shared_read_cache_waits: retrievalTimings.reduce(
          (sum, timing) => sum + (Number.isFinite(timing.shared_read_cache_waits) ? timing.shared_read_cache_waits : 0),
          0
        ),
        shared_read_cache_misses: retrievalTimings.reduce(
          (sum, timing) => sum + (Number.isFinite(timing.shared_read_cache_misses) ? timing.shared_read_cache_misses : 0),
          0
        ),
        shared_read_cache_bypasses: retrievalTimings.reduce(
          (sum, timing) => sum + (Number.isFinite(timing.shared_read_cache_bypasses) ? timing.shared_read_cache_bypasses : 0),
          0
        ),
        shared_embedding_batch_hits: retrievalTimings.reduce(
          (sum, timing) => sum + (Number.isFinite(timing.shared_embedding_batch_hits) ? timing.shared_embedding_batch_hits : 0),
          0
        ),
        shared_embedding_batch_waits: retrievalTimings.reduce(
          (sum, timing) => sum + (Number.isFinite(timing.shared_embedding_batch_waits) ? timing.shared_embedding_batch_waits : 0),
          0
        ),
        shared_embedding_batch_misses: retrievalTimings.reduce(
          (sum, timing) => sum + (Number.isFinite(timing.shared_embedding_batch_misses) ? timing.shared_embedding_batch_misses : 0),
          0
        ),
        shared_embedding_batch_bypasses: retrievalTimings.reduce(
          (sum, timing) => sum + (Number.isFinite(timing.shared_embedding_batch_bypasses) ? timing.shared_embedding_batch_bypasses : 0),
          0
        ),
        lexical_scanned_sum: retrievalTimings.reduce(
          (sum, timing) => sum + (Number.isFinite(timing.lexical_scanned) ? timing.lexical_scanned : 0),
          0
        ),
        lexical_corpus_scan_query_count: retrievalTimings.filter(
          timing => timing.lexical_strategy === "corpus_scan"
        ).length,
        lexical_exhaustive_query_count: retrievalTimings.filter(
          timing => timing.lexical_exhaustive === true
        ).length,
        ...Object.fromEntries(retrievalTimings.slice(0, 12).map((timing, index) => [
          `retrieval_query_${index + 1}_ms`,
          Number.isFinite(timing.retrieval_total_ms) ? timing.retrieval_total_ms : 0
        ])),
        document_identity_ms: documentIdentityDurationMs,
        fact_segment_search_ms: factSegmentSearchDurationMs,
        context_render_ms: contextRenderDurationMs,
        retrieval_context_total_ms: monotonicDurationMs(assemblyStartedAt)
      },
      overviewSynthesis: overviewSelection?.metadata || null,
      evidencePackage,
      temporalClaimContract: evidencePackage?.temporal_claim_contract || null,
      queryPlan,
      hadDocContext: usedDocContext,
      sourceCount:
        Number(chosen.length || 0) +
        Number(usedDocContext ? docContextResult.usedChunks || 0 : 0) +
        Number(serviceMapKovContacts.length || 0)
    }
  };
}
