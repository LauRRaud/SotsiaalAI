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
  return /\b(?:arv(?:u|ud|ust|uga)?|koguarv\w*|uldarv\w*|kokku|kui\s+palju|mitu|osakaal\w*|protsent\w*|millal|mis\s+aastal|millisel\s+aastal)\b/u.test(normalized);
}

function asksForYear(message = "") {
  const normalized = normalizeText(message);
  return /\b(?:millal|mis\s+aastal|millisel\s+aastal|mis\s+ajast)\b/u.test(normalized);
}

function asksForPublicationYear(message = "") {
  const normalized = normalizeText(message);
  return /\b(?:avaldat\w*|ilmus\w*|publitseerit\w*)\b/u.test(normalized);
}

function asksForWholeScope(message = "") {
  const normalized = normalizeText(message);
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
    selected_document_id: documentIdentity?.selectedDocumentId || null
  };
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
    claims.every(claim => source.allNumbers.has(claim.value))
  );
  if (!supportingSources.length) {
    const individuallySupported = claims.every(claim =>
      identityEligibleSources.some(source => source.allNumbers.has(claim.value))
    );
    return {
      passed: false,
      reply: failureReply(replyLang),
      trace: {
        ...baseTrace,
        reason: individuallySupported ? "cross_source_numeric_mix" : "unsupported_numeric_claim"
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
    : supportingSources.filter(source => yearClaims.every(claim => source.bodyYears.has(claim.value)));
  if (yearRequested && yearClaims.length && !yearCompatibleSources.length) {
    return {
      passed: false,
      reply: failureReply(replyLang),
      trace: { ...baseTrace, reason: "source_year_not_body_year" }
    };
  }

  const compatibleSources = yearCompatibleSources.length ? yearCompatibleSources : supportingSources;
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
      year_mode: publicationYearRequested ? "publication_year" : yearRequested ? "body_evidence_year" : "not_requested",
      whole_scope_checked: asksForWholeScope(message) && sourcesWithWholeScope.length > 0
    }
  };
}
