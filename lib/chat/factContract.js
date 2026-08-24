const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNumber(value = "") {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/%$/, "");
}

function stripStructuralNumbers(value = "") {
  return String(value || "")
    .replace(/^\s*\d{1,3}[.)]\s+/gmu, "")
    .replace(/\[\d{1,3}\]/gu, "");
}

function numericClaims(value = "") {
  const text = stripStructuralNumbers(value);
  const claims = [];
  for (const match of text.matchAll(/(?<![\p{L}\d])(?:\d{1,3}(?:[ .]\d{3})+|\d+)(?:[.,]\d+)?\s*%?/gu)) {
    const raw = String(match[0] || "").trim();
    const normalized = normalizeNumber(raw);
    const numeric = Number(normalized);
    if (!normalized || !Number.isFinite(numeric)) continue;
    claims.push({
      value: normalized,
      numeric,
      percentage: raw.endsWith("%"),
      year: Number.isInteger(numeric) && numeric >= YEAR_MIN && numeric <= YEAR_MAX,
      index: match.index || 0
    });
  }
  return claims;
}

const ESTONIAN_SMALL_NUMBER_FORMS = [
  [0, /^(?:null|nulli(?:l|lt|st|s|ga|ks|ni|ta)?)$/u],
  [1, /^(?:uks|uht|uhe(?:l|lt|st|s|ga|ks|ni|ta)?)$/u],
  [2, /^(?:kaks|kaht|kahe(?:l|lt|st|s|ga|ks|ni|ta)?)$/u],
  [3, /^(?:kolm|kolme(?:l|lt|st|s|ga|ks|ni|ta)?)$/u],
  [4, /^(?:neli|nelja(?:l|lt|st|s|ga|ks|ni|ta)?)$/u],
  [5, /^(?:viis|viit|viie(?:l|lt|st|s|ga|ks|ni|ta)?)$/u],
  [6, /^(?:kuus|kuut|kuue(?:l|lt|st|s|ga|ks|ni|ta)?)$/u],
  [7, /^(?:seitse|seitset|seitsme(?:l|lt|st|s|ga|ks|ni|ta)?)$/u],
  [8, /^(?:kaheksa(?:l|lt|st|s|ga|ks|ni|ta)?)$/u],
  [9, /^(?:uheksa(?:l|lt|st|s|ga|ks|ni|ta)?)$/u],
  [10, /^(?:kumme|kummet|kumne(?:l|lt|st|s|ga|ks|ni|ta)?)$/u]
];

function normalizedNumericClaims(value = "") {
  const claims = numericClaims(value);
  const normalized = normalizeText(stripStructuralNumbers(value));
  for (const match of normalized.matchAll(/\b[a-z]+\b/gu)) {
    const word = String(match[0] || "");
    const followingText = normalized.slice((match.index || 0) + word.length).trimStart();
    // „Viis läbi/ellu/edasi” is a verb, not the cardinal number five.
    if (word === "viis" && /^(?:labi|ellu|edasi|sisse|valja)\b/u.test(followingText)) continue;
    const mapped = ESTONIAN_SMALL_NUMBER_FORMS.find(([, pattern]) => pattern.test(word));
    if (!mapped) continue;
    claims.push({
      value: String(mapped[0]),
      numeric: mapped[0],
      percentage: false,
      year: false,
      index: match.index || 0
    });
  }
  return claims.sort((left, right) => left.index - right.index);
}

function splitEvidence(source = {}, index = 0) {
  const evidenceText = String(source?.evidenceText || "").trim();
  const newline = evidenceText.indexOf("\n");
  const header = newline >= 0 ? evidenceText.slice(0, newline) : "";
  const body = newline >= 0 ? evidenceText.slice(newline + 1) : evidenceText;
  return {
    sourceId: String(source?.id || source?.source_id || source?.sourceId || `source_${index + 1}`),
    documentId: String(source?.documentId || source?.document_id || "").trim() || null,
    title: String(source?.title || "").trim() || null,
    evidenceText,
    header,
    body,
    allNumbers: new Set(normalizedNumericClaims(evidenceText).map(claim => claim.value)),
    bodyYears: new Set(numericClaims(body).filter(claim => claim.year).map(claim => claim.value)),
    wholeScopeNumbers: extractWholeScopeNumbers(body)
  };
}

function extractWholeScopeNumbers(body = "") {
  const values = new Set();
  const sentences = String(body || "").split(/(?<=[.!?])\s+|[\r\n]+/u);
  for (const sentence of sentences) {
    const claims = normalizedNumericClaims(sentence).filter(claim => !claim.year);
    if (!claims.length) continue;
    const normalized = normalizeText(sentence);
    if (/\b(?:kokku|kogu\s*valim\w*|koguvalim\w*|koguarv\w*|uldarv\w*|valim\w*\s+(?:moodustas|koosnes))\b/u.test(normalized)) {
      values.add(claims[0].value);
      continue;
    }
    const subgroupCue = String(sentence).toLowerCase().search(/\b(?:neist|nendest|sealhulgas|sh|millest)\b/u);
    if (subgroupCue < 0 || claims.length < 2) continue;
    const firstClaimBeforeSubgroup = claims.find(claim => claim.index < subgroupCue);
    if (firstClaimBeforeSubgroup) values.add(firstClaimBeforeSubgroup.value);
  }
  return values;
}

function asksForNumericFact(message = "") {
  const normalized = normalizeText(message);
  return /%|\b(?:arv(?:u|ud|ust|uga)?|koguarv\w*|uldarv\w*|kokku|kui\s+palju|mitu|nait(?:aja|ude?)\w*|osakaal\w*|protsent\w*|millal|mis\s+aastal|millisel\s+aastal)\b/u.test(normalized);
}

function asksForYear(message = "") {
  const normalized = normalizeText(message);
  if (/\b(?:mis\s+aasta(?:l|st)?|millisel\s+aastal|mis\s+ajast)\b/u.test(normalized)) return true;
  if (!/\bmillal\b/u.test(normalized)) return false;
  return !/\b(?:jarelhind\w*|jarelmoj\w*|parast|moodudes|kest\w*|intervall\w*|paev\w*|nadal\w*|kuu|kuud|kuuga|kuul|aasta\s+parast)\b/u.test(normalized);
}

function extractPercentCountRelations(value = "") {
  const text = stripStructuralNumbers(value);
  const relations = [];
  for (const match of text.matchAll(/(?<![\p{L}\d])(\d+(?:[.,]\d+)?)\s*%\s*(?:\(|\[)?\s*n\s*[:=]\s*(\d+(?:[ .]\d{3})*|\d+)(?:\)|\])?/giu)) {
    const percent = normalizeNumber(match[1]);
    const count = normalizeNumber(match[2]);
    if (!percent || !count) continue;
    relations.push({
      percent,
      count,
      index: match.index || 0
    });
  }
  return relations;
}

function sentenceAroundIndex(value = "", index = 0) {
  const text = String(value || "");
  const start = Math.max(
    text.lastIndexOf(".", Math.max(0, index - 1)),
    text.lastIndexOf("!", Math.max(0, index - 1)),
    text.lastIndexOf("?", Math.max(0, index - 1)),
    text.lastIndexOf("\n", Math.max(0, index - 1))
  ) + 1;
  const endings = [".", "!", "?", "\n"]
    .map(separator => text.indexOf(separator, index))
    .filter(position => position >= 0);
  const end = endings.length ? Math.min(...endings) : text.length;
  return text.slice(start, end);
}

function paragraphAroundIndex(value = "", index = 0) {
  const text = String(value || "");
  const startSeparator = text.lastIndexOf("\n\n", Math.max(0, index - 1));
  const start = startSeparator >= 0 ? startSeparator + 2 : 0;
  const endSeparator = text.indexOf("\n\n", index);
  const end = endSeparator >= 0 ? endSeparator : text.length;
  return text.slice(start, end);
}

function durationClaimSupportedByEquivalentWording(reply = "", claim = {}, source = {}) {
  if (claim.value !== "12" || claim.percentage || claim.year) return false;
  const replySentence = normalizeText(sentenceAroundIndex(reply, claim.index || 0));
  const claimsTwelveMonths = /(?<![\p{L}\d])12(?:\s*[-–—]\s*|\s+)(?:kuu\p{L}*|month\p{L}*|месяц\p{L}*)(?![\p{L}\d])/u
    .test(replySentence);
  if (!claimsTwelveMonths) return false;

  const evidence = normalizeText(source.body);
  return /\b(?:viimase|eelneva|moodunud)\s+aasta(?:\s+jooksul)?\b/u.test(evidence) ||
    /\b(?:during\s+)?(?:the\s+)?(?:last|past|previous)\s+year\b/u.test(evidence) ||
    /\b(?:за\s+)?последн\p{L}*\s+год\p{L}*\b/u.test(evidence);
}

function numericClaimSupportedBySource(reply = "", claim = {}, source = {}) {
  return source.allNumbers.has(claim.value) ||
    durationClaimSupportedByEquivalentWording(reply, claim, source);
}

function explicitPeopleCounts(value = "") {
  const counts = new Set();
  for (const match of normalizeText(value).matchAll(/(?<![\p{L}\d])(\d+(?:[ .]\d{3})*|\d+)\s+(?:inimest|inimese|isikut|isiku|osalejat|osaleja|vastajat|vastaja|ohvrit|ohvri)\b/gu)) {
    counts.add(normalizeNumber(match[1]));
  }
  return counts;
}

function percentCountRelationMismatch(reply = "", source = {}) {
  const relations = extractPercentCountRelations(source.body);
  if (!relations.length) return false;
  for (const relation of relations) {
    const replyPercentPattern = new RegExp(`(?<![\\p{L}\\d])${relation.percent.replace(".", "[.,]")}\\s*%`, "u");
    const replyPercentMatch = replyPercentPattern.exec(String(reply || ""));
    if (!replyPercentMatch) continue;
    const replySentence = sentenceAroundIndex(reply, replyPercentMatch.index || 0);
    const replyParagraph = paragraphAroundIndex(reply, replyPercentMatch.index || 0);
    const evidenceSentence = sentenceAroundIndex(source.body, relation.index);
    const normalizedReplyParagraph = normalizeText(replyParagraph);
    const normalizedEvidenceSentence = normalizeText(evidenceSentence);
    const countPattern = relation.count.replace(".", "[.,]");
    const replyTreatsCountAsSampleAfterCount = new RegExp(
      `(?<![\\p{L}\\d])${countPattern}\\s+(?:inimese|isiku|osaleja|vastaja)?\\s*(?:suuruses\\s+)?valim\\w*`,
      "u"
    ).test(normalizedReplyParagraph);
    const replyTreatsCountAsSampleBeforeCount = new RegExp(
      `\\bvalim\\w*(?:\\s+\\S+){0,6}\\s+${countPattern}(?![\\p{L}\\d])`,
      "u"
    ).test(normalizedReplyParagraph);
    const replyTreatsCountAsSample = replyTreatsCountAsSampleAfterCount || replyTreatsCountAsSampleBeforeCount;
    const evidenceTreatsCountAsSample = new RegExp(
      `(?<![\\p{L}\\d])${countPattern}\\s+(?:inimese|isiku|osaleja|vastaja)?\\s*(?:suuruses\\s+)?valim\\w*`,
      "u"
    ).test(normalizedEvidenceSentence);
    if (replyTreatsCountAsSample && !evidenceTreatsCountAsSample) return true;

    const evidenceCounts = explicitPeopleCounts(evidenceSentence);
    for (const claimedCount of explicitPeopleCounts(replySentence)) {
      if (claimedCount !== relation.count && !evidenceCounts.has(claimedCount)) return true;
    }
  }
  return false;
}

function asksForPublicationYear(message = "") {
  const normalized = normalizeText(message);
  return /\b(?:avaldat\w*|ilmus\w*|publitseerit\w*)\b/u.test(normalized);
}

function asksForWholeScope(message = "") {
  const normalized = normalizeText(message);
  const quantitativeSlots = normalized.match(/\b(?:kui\s+palju|mitu|koguarv\w*|uldarv\w*)\b/gu) || [];
  if (quantitativeSlots.length > 1) return false;
  return /\b(?:arv\w*|kokku|kui\s+palju|mitu|koguarv\w*|uldarv\w*)\b/u.test(normalized) &&
    !/\b(?:osakaal\w*|protsent\w*)\b/u.test(normalized);
}

function failureReply(replyLang = "et") {
  if (replyLang === "en") {
    return "The retrieved source excerpts do not confirm the requested value, scope, and year unambiguously enough to give an exact answer.";
  }
  if (replyLang === "ru") {
    return "В найденных фрагментах источников недостаточно однозначно подтверждены запрошенные значение, охват и год, поэтому точный ответ дать нельзя.";
  }
  return "Kasutatud allikakatkenditest ei saa küsitud arvu, ulatust ja aastat piisavalt üheselt kinnitada.";
}

export function shouldValidateExactFactAnswer({ message = "", sources = [], retrievalMeta = null } = {}) {
  if (!asksForNumericFact(message)) return false;
  if (retrievalMeta?.numericFactEvidence?.enabled === true) return true;
  return Array.isArray(sources) && sources.some(source => String(source?.evidenceText || "").trim());
}

export function validateExactFactAnswer({
  message = "",
  reply = "",
  sources = [],
  retrievalMeta = null,
  replyLang = "et"
} = {}) {
  const evidenceSources = (Array.isArray(sources) ? sources : [])
    .map(splitEvidence)
    .filter(source => source.evidenceText);
  const documentIdentity = retrievalMeta?.documentIdentityEvidence && typeof retrievalMeta.documentIdentityEvidence === "object"
    ? retrievalMeta.documentIdentityEvidence
    : null;
  const authorCorpus = retrievalMeta?.authorCorpusEvidence && typeof retrievalMeta.authorCorpusEvidence === "object"
    ? retrievalMeta.authorCorpusEvidence
    : null;
  const claims = normalizedNumericClaims(reply);
  const baseTrace = {
    version: "exact_numeric_fact_v2",
    enabled: true,
    buffered: true,
    claim_values: claims.map(claim => claim.value),
    source_count: evidenceSources.length,
    document_identity_required: documentIdentity?.required === true,
    document_identity_matched: documentIdentity?.matched === true,
    document_identity_confidence: documentIdentity?.confidence || null,
    selected_document_id: documentIdentity?.selectedDocumentId || null,
    author_corpus_required: authorCorpus?.required === true,
    author_corpus_complete: authorCorpus?.complete === true,
    author_corpus_document_count: Number.isInteger(Number(authorCorpus?.documentCount))
      ? Number(authorCorpus.documentCount)
      : null
  };
  if (authorCorpus?.required === true) {
    if (
      authorCorpus.complete !== true ||
      authorCorpus.matched !== true ||
      !Number.isInteger(Number(authorCorpus.documentCount))
    ) {
      return {
        passed: false,
        reply: failureReply(replyLang),
        trace: { ...baseTrace, reason: "author_corpus_count_unconfirmed" }
      };
    }
    if (!evidenceSources.length) {
      return {
        passed: false,
        reply: failureReply(replyLang),
        trace: { ...baseTrace, reason: "author_corpus_sources_missing" }
      };
    }
    if (!claims.length) {
      return {
        passed: false,
        reply: failureReply(replyLang),
        trace: { ...baseTrace, reason: "author_corpus_count_not_answered" }
      };
    }
    const expectedCount = Number(authorCorpus.documentCount);
    const nonYearClaims = claims.filter(claim => !claim.year);
    if (!nonYearClaims.some(claim => claim.numeric === expectedCount)) {
      return {
        passed: false,
        reply: failureReply(replyLang),
        trace: { ...baseTrace, reason: "author_corpus_count_mismatch" }
      };
    }
    if (nonYearClaims.some(claim => claim.numeric !== expectedCount)) {
      return {
        passed: false,
        reply: failureReply(replyLang),
        trace: { ...baseTrace, reason: "unsupported_author_corpus_numeric_claim" }
      };
    }
    const unsupportedYears = claims
      .filter(claim => claim.year)
      .filter(claim => !evidenceSources.some(source => source.allNumbers.has(claim.value)));
    if (unsupportedYears.length) {
      return {
        passed: false,
        reply: failureReply(replyLang),
        trace: { ...baseTrace, reason: "unsupported_author_work_year" }
      };
    }
    return {
      passed: true,
      reply: String(reply || "").trim(),
      trace: {
        ...baseTrace,
        passed: true,
        reason: "author_metadata_aggregate",
        supporting_source_id: evidenceSources[0]?.sourceId || null,
        supporting_source_count: evidenceSources.length,
        year_mode: "publication_year_per_source",
        whole_scope_checked: true
      }
    };
  }
  if (documentIdentity?.required === true && (
    documentIdentity.matched !== true || documentIdentity.confidence !== "high"
  )) {
    return {
      passed: false,
      reply: failureReply(replyLang),
      trace: { ...baseTrace, reason: "document_identity_unconfirmed" }
    };
  }
  if (!evidenceSources.length) {
    return { passed: false, reply: failureReply(replyLang), trace: { ...baseTrace, reason: "no_rendered_evidence" } };
  }
  if (!claims.length) {
    return { passed: false, reply: failureReply(replyLang), trace: { ...baseTrace, reason: "no_numeric_claim" } };
  }

  const selectedDocumentId = String(documentIdentity?.selectedDocumentId || "").trim();
  const selectedTitle = normalizeText(documentIdentity?.selectedTitle || "");
  const identityEligibleSources = documentIdentity?.required === true
    ? evidenceSources.filter(source =>
        (selectedDocumentId && source.documentId === selectedDocumentId) ||
        (selectedTitle && normalizeText(source.title) === selectedTitle)
      )
    : evidenceSources;
  if (documentIdentity?.required === true && !identityEligibleSources.length) {
    return {
      passed: false,
      reply: failureReply(replyLang),
      trace: { ...baseTrace, reason: "identified_document_missing_from_rendered_sources" }
    };
  }

  const supportingSources = identityEligibleSources.filter(source =>
    claims.every(claim => numericClaimSupportedBySource(reply, claim, source))
  );
  if (!supportingSources.length) {
    const individuallySupported = claims.every(claim =>
      identityEligibleSources.some(source => numericClaimSupportedBySource(reply, claim, source))
    );
    const unsupportedClaimValues = claims
      .filter(claim => !identityEligibleSources.some(source => numericClaimSupportedBySource(reply, claim, source)))
      .map(claim => claim.value);
    return {
      passed: false,
      reply: failureReply(replyLang),
      trace: {
        ...baseTrace,
        reason: individuallySupported ? "cross_source_numeric_mix" : "unsupported_numeric_claim",
        unsupported_claim_values: unsupportedClaimValues
      }
    };
  }

  const yearClaims = claims.filter(claim => claim.year);
  if (asksForYear(message) && !yearClaims.length) {
    return { passed: false, reply: failureReply(replyLang), trace: { ...baseTrace, reason: "missing_requested_year" } };
  }
  const yearRequested = asksForYear(message);
  const publicationYearRequested = asksForPublicationYear(message);
  const yearCompatibleSources = !yearRequested || publicationYearRequested
    ? supportingSources
    : supportingSources.filter(source => yearClaims.some(claim => source.bodyYears.has(claim.value)));
  if (yearRequested && yearClaims.length && !yearCompatibleSources.length) {
    return {
      passed: false,
      reply: failureReply(replyLang),
      trace: { ...baseTrace, reason: "source_year_not_body_year" }
    };
  }

  const compatibleSources = yearCompatibleSources.length ? yearCompatibleSources : supportingSources;
  const durationEquivalenceUsed = compatibleSources.some(source =>
    claims.some(claim => !source.allNumbers.has(claim.value) &&
      durationClaimSupportedByEquivalentWording(reply, claim, source))
  );
  if (compatibleSources.every(source => percentCountRelationMismatch(reply, source))) {
    return {
      passed: false,
      reply: failureReply(replyLang),
      trace: { ...baseTrace, reason: "numeric_relation_mismatch" }
    };
  }
  const firstNonYearClaim = claims.find(claim => !claim.year);
  const sourcesWithWholeScope = compatibleSources.filter(source => source.wholeScopeNumbers.size > 0);
  if (
    asksForWholeScope(message) &&
    firstNonYearClaim &&
    sourcesWithWholeScope.length &&
    !sourcesWithWholeScope.some(source => source.wholeScopeNumbers.has(firstNonYearClaim.value))
  ) {
    return {
      passed: false,
      reply: failureReply(replyLang),
      trace: { ...baseTrace, reason: "whole_scope_mismatch" }
    };
  }

  const supportingSource = (
    sourcesWithWholeScope.find(source => source.wholeScopeNumbers.has(firstNonYearClaim?.value)) ||
    compatibleSources[0]
  );
  return {
    passed: true,
    reply: String(reply || "").trim(),
    trace: {
      ...baseTrace,
      passed: true,
      reason: "all_claims_in_one_rendered_source",
      supporting_source_id: supportingSource?.sourceId || null,
      duration_equivalence_used: durationEquivalenceUsed,
      year_mode: publicationYearRequested ? "publication_year" : yearRequested ? "body_evidence_year" : "not_requested",
      whole_scope_checked: asksForWholeScope(message) && sourcesWithWholeScope.length > 0
    }
  };
}
