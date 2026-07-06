const PARAGRAPH_SIGN = "\u00A7";

function normalizeText(value = "") {
  return String(value || "")
    .replace(/\u00A7/g, ` ${PARAGRAPH_SIGN} `)
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const LEGAL_ACT_ALIAS_REGISTRY = Object.freeze([
  {
    actTitle: "Sotsiaalhoolekande seadus",
    aliases: [
      "shs",
      "sotsiaalhoolekande seadus",
      "sotsiaalhoolekande seaduse"
    ],
    jurisdictionLevel: "NATIONAL",
    sourceTypes: ["national_law"],
    collectionId: "national_regulations"
  },
  {
    actTitle: "Lastekaitseseadus",
    aliases: [
      "lasteks",
      "lastekaitseseadus",
      "lastekaitseseaduse"
    ],
    jurisdictionLevel: "NATIONAL",
    sourceTypes: ["national_law"],
    collectionId: "national_regulations"
  }
]);

const LEGAL_TOPIC_STOPWORDS = new Set([
  "shs",
  "seadus",
  "seaduse",
  "sotsiaalhoolekande",
  "lastekaitseseadus",
  "lastekaitseseaduse",
  "lasteks",
  "paragrahv",
  "paragrahvid",
  "sate",
  "satted",
  "sateid",
  "reguleerib",
  "reguleerivad",
  "millised",
  "milline",
  "millist",
  "mis",
  "kuidas",
  "kohta",
  "taotlemine",
  "taotleda",
  "kord",
  "valla",
  "linna",
  "riigiteataja",
  "riigi",
  "teataja",
  "olemas",
  "andmebaasis",
  "allikas",
  "allikad",
  "allikat"
]);

const LEGAL_TOPIC_CANONICAL_MAP = Object.freeze({
  toimetulekutoetust: "toimetulekutoetus",
  toimetulekutoetuse: "toimetulekutoetus"
});

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function extractParagraphRefs(text = "") {
  const normalized = normalizeText(text);
  const refs = new Set();
  const explicitPattern = new RegExp(
    `(?:${PARAGRAPH_SIGN}+\\s*|paragrahv(?:i|is|ist|ile|il|iga|iks)?\\s+)(\\d+[a-z]?)`,
    "giu"
  );
  for (const match of normalized.matchAll(explicitPattern)) {
    const ref = String(match?.[1] || "").trim();
    if (ref) refs.add(ref);
  }
  return Array.from(refs).slice(0, 8);
}

function findActAliasMatches(text = "") {
  const normalized = normalizeText(text);
  const matches = [];
  for (const entry of LEGAL_ACT_ALIAS_REGISTRY) {
    const matchedAliases = entry.aliases.filter((alias) => normalized.includes(normalizeText(alias)));
    if (matchedAliases.length) {
      matches.push({
        ...entry,
        matchedAliases: unique(matchedAliases)
      });
    }
  }
  return matches;
}

function isLegalSourceAvailabilityQuestion(normalized = "") {
  return /\b(kas|on|olemas)\b/.test(normalized) &&
    /\b(olemas|andmebaasis|allikas|allikad|allikat|sul)\b/.test(normalized) &&
    /\b(riigiteataja|riigi teataja|oigusakt|maarus|kord)\b/.test(normalized);
}

function detectMunicipalityRegulationHint(text = "", municipalities = []) {
  const normalized = normalizeText(text);
  const municipality = (Array.isArray(municipalities) ? municipalities : []).find((item) => {
    const displayName = normalizeText(item?.displayName || "");
    if (!displayName) return false;
    const collapsed = displayName.replace(/\s+/g, " ");
    return normalized.includes(collapsed) || collapsed.split(" ").some((part) => part.length >= 4 && normalized.includes(part));
  });
  const regulationHint = /\b(kord|maarus|riigiteataja|riigi teataja)\b/.test(normalized);
  if (!municipality || !regulationHint) return null;
  const sourceAvailability = isLegalSourceAvailabilityQuestion(normalized);
  return {
    actTitle: null,
    actAliases: unique([
      municipality.displayName,
      "Riigi Teataja",
      "riigiteataja",
      "Sotsiaalhoolekandelise abi andmise kord",
      "kord"
    ]),
    jurisdictionLevel: "MUNICIPALITY",
    sourceTypes: ["kov_regulation"],
    collectionId: "kov_legal",
    municipalityId: String(itemOr(municipality.id, municipality.municipalityId, municipality.municipality_id) || "").trim() || null,
    sourceAvailability
  };
}

function itemOr(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function extractTopicTerms(text = "", actAliases = []) {
  const aliasTokens = new Set(
    actAliases
      .flatMap((alias) => normalizeText(alias).split(/\s+/))
      .filter(Boolean)
  );
  const tokens = normalizeText(text)
    .replace(new RegExp(`${PARAGRAPH_SIGN}\\s*\\d+[a-z]?`, "gu"), " ")
    .split(/[^a-z0-9_]+/)
    .filter((token) =>
      token &&
      token.length >= 5 &&
      !/^\d+[a-z]?$/.test(token) &&
      !LEGAL_TOPIC_STOPWORDS.has(token) &&
      !aliasTokens.has(token)
    );
  const normalizedTokens = tokens.map((token) => LEGAL_TOPIC_CANONICAL_MAP[token] || token);
  return unique(normalizedTokens).slice(0, 6);
}

function emptyPlan() {
  return {
    enabled: false,
    mode: "legal_source_lookup",
    jurisdictionLevel: "UNKNOWN",
    sourceTypes: [],
    collectionId: null,
    actTitle: null,
    actAliases: [],
    municipalityId: null,
    paragraphRefs: [],
    topicTerms: [],
    requireCurrent: true,
    sourceAvailability: false
  };
}

export function detectLegalLookupPlan({
  message = "",
  sourceLookupRequest = false,
  fallbackParagraphRefs = [],
  effectiveMunicipalities = []
} = {}) {
  const currentMessage = String(message || "").trim();
  const currentParagraphRefs = extractParagraphRefs(currentMessage);
  const paragraphRefs = currentParagraphRefs.length
    ? currentParagraphRefs
    : Array.isArray(fallbackParagraphRefs)
      ? unique(fallbackParagraphRefs.map((item) => String(item || "").trim()).filter(Boolean)).slice(0, 8)
      : [];
  const actMatches = findActAliasMatches(currentMessage);
  const municipalityRegulation = detectMunicipalityRegulationHint(currentMessage, effectiveMunicipalities);

  const base = municipalityRegulation || actMatches[0] || null;
  if (!base) return emptyPlan();

  const sourceAvailability = base.sourceAvailability === true;
  const topicTerms = paragraphRefs.length === 0 && !sourceAvailability
    ? extractTopicTerms(currentMessage, base.matchedAliases || base.actAliases || [])
    : [];

  const mode = sourceAvailability
    ? "legal_source_lookup"
    : paragraphRefs.length > 0
    ? "explicit_paragraph"
    : topicTerms.length > 0
      ? "topic_to_paragraphs"
      : "legal_source_lookup";

  const shouldEnable = Boolean(
    sourceAvailability ||
    sourceLookupRequest ||
    paragraphRefs.length > 0 ||
    topicTerms.length > 0
  );

  if (!shouldEnable) return emptyPlan();

  return {
    enabled: true,
    mode,
    jurisdictionLevel: base.jurisdictionLevel,
    sourceTypes: [...base.sourceTypes],
    collectionId: base.collectionId,
    actTitle: base.actTitle || null,
    actAliases: unique(base.matchedAliases || base.actAliases || []),
    municipalityId: base.municipalityId || null,
    paragraphRefs,
    topicTerms,
    requireCurrent: true,
    sourceAvailability
  };
}

export function buildLegalLookupQueryEntries(plan, message = "") {
  if (!plan?.enabled) return [];
  const sourceType = Array.isArray(plan.sourceTypes) ? plan.sourceTypes[0] : null;
  const baseFilters = {
    ...(sourceType ? { source_type: sourceType } : {}),
    ...(plan.collectionId ? { collection_id: plan.collectionId } : {}),
    ...(plan.actTitle ? { act_title: plan.actTitle } : {}),
    ...(plan.municipalityId ? { municipality_id: plan.municipalityId } : {}),
    ...(plan.requireCurrent ? { source_status: "active", historical: false } : {})
  };
  const aliasQuery = Array.isArray(plan.actAliases) ? plan.actAliases.join("\n") : "";
  const availabilityAnchor = plan.sourceAvailability ? "Riigi Teataja õigusakt määrus kehtiv allikas" : "";
  const queryBase = [
    plan.actTitle,
    aliasQuery,
    availabilityAnchor,
    String(message || "").trim()
  ].filter(Boolean).join("\n");

  if (plan.mode === "explicit_paragraph") {
    return plan.paragraphRefs.map((ref) => ({
      query: [plan.actTitle, `${PARAGRAPH_SIGN} ${ref}`, String(message || "").trim()].filter(Boolean).join("\n"),
      filters: {
        ...baseFilters,
        paragraph_number: ref
      }
    }));
  }

  if (plan.mode === "topic_to_paragraphs") {
    return [{
      query: [queryBase, ...plan.topicTerms].filter(Boolean).join("\n"),
      filters: baseFilters
    }];
  }

  return [{
    query: queryBase || plan.actTitle || String(message || "").trim(),
    filters: baseFilters
  }];
}
