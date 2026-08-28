import { contactRoleTextMatches } from "@/lib/chat/contactRoleSemantics";
import { isResearchOrJournalSource } from "@/lib/rag/sourceMetadata";

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
  for (const match of text.matchAll(/(?<![\p{L}\d])(?:\d{1,3}(?:[\p{Zs}.]\d{3})+|\d+)(?:[.,]\d+)?\s*%?/gu)) {
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

const NON_EST_SMALL_NUMBER_VALUES = new Map([
  ["one", "1"], ["two", "2"], ["three", "3"], ["four", "4"], ["five", "5"],
  ["six", "6"], ["seven", "7"], ["eight", "8"], ["nine", "9"], ["ten", "10"],
  ["один", "1"], ["одна", "1"], ["два", "2"], ["две", "2"], ["три", "3"],
  ["четыре", "4"], ["пять", "5"], ["шесть", "6"], ["семь", "7"],
  ["восемь", "8"], ["девять", "9"], ["десять", "10"]
]);

const RUSSIAN_SMALL_NUMBER_FORMS = [
  [1, /^(?:один|одна|одно|одного|одной|одному|одним|одну)$/u],
  [2, /^(?:два|две|двух|двум|двумя)$/u],
  [3, /^(?:три|трех|трем|тремя)$/u],
  [4, /^(?:четыре|четырех|четырем|четырьмя)$/u],
  [5, /^(?:пять|пяти|пятью)$/u],
  [6, /^(?:шесть|шести|шестью)$/u],
  [7, /^(?:семь|семи|семью)$/u],
  [8, /^(?:восемь|восьми|восемью)$/u],
  [9, /^(?:девять|девяти|девятью)$/u],
  [10, /^(?:десять|десяти|десятью)$/u]
];

function normalizedNumericClaims(value = "") {
  const claims = numericClaims(value);
  const normalized = normalizeText(stripStructuralNumbers(value));
  for (const match of normalized.matchAll(/(?<![\p{L}\d])[\p{L}]+(?![\p{L}\d])/gu)) {
    const word = String(match[0] || "");
    const followingText = normalized.slice((match.index || 0) + word.length).trimStart();
    // „Viis läbi/ellu/edasi” is a verb, not the cardinal number five.
    if (word === "viis" && /^(?:labi|ellu|edasi|sisse|valja)\b/u.test(followingText)) continue;
    const mapped = ESTONIAN_SMALL_NUMBER_FORMS.find(([, pattern]) => pattern.test(word));
    const russianMapped = RUSSIAN_SMALL_NUMBER_FORMS.find(([, pattern]) => pattern.test(word));
    const mappedValue = mapped?.[0] ?? russianMapped?.[0] ?? Number(NON_EST_SMALL_NUMBER_VALUES.get(word));
    if (!Number.isFinite(mappedValue)) continue;
    claims.push({
      value: String(mappedValue),
      numeric: mappedValue,
      percentage: false,
      year: false,
      index: match.index || 0
    });
  }
  return claims.sort((left, right) => left.index - right.index);
}

function evidenceNumericClaims(value = "") {
  const claims = normalizedNumericClaims(value);
  const seenPercentages = new Set(
    claims.filter(claim => claim.percentage).map(claim => claim.value)
  );
  // PDF-i tekstikiht võib sõna ja protsendi kokku liita (nt „lõpuks68%”).
  // Vastuse arvud loetakse endiselt rangelt; siin taastame ainult allikas selgelt
  // protsendimärgiga kirjutatud väärtuse, mitte suvalist sõna sisse sulanud numbrit.
  for (const match of String(value || "").matchAll(/(?<!\d)(\d+(?:[.,]\d+)?)\s*%(?!\d)/gu)) {
    const normalized = normalizeNumber(match?.[1] || "");
    const numeric = Number(normalized);
    if (!normalized || !Number.isFinite(numeric) || seenPercentages.has(normalized)) continue;
    claims.push({
      value: normalized,
      numeric,
      percentage: true,
      year: false,
      index: match.index || 0
    });
    seenPercentages.add(normalized);
  }
  return claims.sort((left, right) => left.index - right.index);
}

function splitEvidence(source = {}, index = 0) {
  const evidenceText = String(source?.evidenceText || "").trim();
  const newline = evidenceText.indexOf("\n");
  const header = newline >= 0 ? evidenceText.slice(0, newline) : "";
  const body = newline >= 0 ? evidenceText.slice(newline + 1) : evidenceText;
  const attributionSourceId = String(
    source?.source_id ||
    source?.sourceId ||
    source?.id ||
    source?.key ||
    source?.url ||
    source?.url_canonical ||
    source?.urlCanonical ||
    source?.source_url ||
    source?.sourceUrl ||
    source?.official_url ||
    source?.officialUrl ||
    source?.official_website ||
    source?.officialWebsite ||
    source?.short_ref ||
    source?.title ||
    `source_${index}`
  ).trim();
  return {
    sourceId: String(source?.id || source?.source_id || source?.sourceId || `source_${index + 1}`),
    attributionSourceId,
    sourceType: String(source?.sourceType || source?.source_type || "").trim(),
    documentId: String(source?.documentId || source?.document_id || "").trim() || null,
    title: String(source?.title || "").trim() || null,
    evidenceText,
    header,
    body,
    allNumbers: new Set(evidenceNumericClaims(evidenceText).map(claim => claim.value)),
    bodyYears: new Set(numericClaims(body).filter(claim => claim.year).map(claim => claim.value)),
    wholeScopeNumbers: extractWholeScopeNumbers(body)
  };
}

function extractWholeScopeNumbers(body = "", { includeFallback = true } = {}) {
  const fallbackValues = new Set();
  const explicitWholeValues = new Set();
  const sentences = String(body || "").split(/(?<=[.!?])\s+|[\r\n]+/u);
  for (const sentence of sentences) {
    const normalized = normalizeText(stripStructuralNumbers(sentence));
    const claims = alignedCategoryNumericClaims(normalized).filter(claim => !claim.year);
    if (!claims.length) continue;
    const totalCuePattern = /(?<!\p{L})(?:kokku|kogu\s*valim\w*|koguvalim\w*|koguarv\w*|uldarv\w*|valim\w*\s+(?:moodustas|koosnes)|in\s+total|total|altogether|всего|итого)(?!\p{L})/gu;
    const totalCues = [...normalized.matchAll(totalCuePattern)];
    if (totalCues.length) {
      for (const totalCue of totalCues) {
        const cueStart = totalCue.index || 0;
        const cueEnd = cueStart + String(totalCue[0] || "").length;
        const totalValue = totalValueAroundCue(normalized, totalCue);
        if (!totalValue) continue;
        const numericAfter = claims.find(claim =>
          claim.index >= cueEnd && claim.value === totalValue
        );
        const numericBefore = [...claims].reverse().find(claim =>
          claim.index < cueStart && claim.value === totalValue
        );
        const totalClaim = numericAfter || numericBefore || null;
        const lowerBound = Math.min(cueStart, totalClaim?.index ?? cueStart);
        const upperBound = Math.max(cueEnd, (totalClaim?.index ?? cueEnd) + 1);
        const clauseStart = Math.max(
          normalized.lastIndexOf(";", Math.max(0, lowerBound - 1)),
          normalized.lastIndexOf(",", Math.max(0, lowerBound - 1))
        ) + 1;
        const followingDelimiters = [normalized.indexOf(";", upperBound), normalized.indexOf(",", upperBound)]
          .filter(index => index >= 0);
        const clauseEnd = followingDelimiters.length ? Math.min(...followingDelimiters) : normalized.length;
        const rawClause = normalized.slice(clauseStart, clauseEnd);
        const leadingWhitespace = rawClause.length - rawClause.trimStart().length;
        const clause = rawClause.trim();
        const cueOffset = cueStart - clauseStart - leadingWhitespace;
        const localCue = { 0: String(totalCue[0] || ""), index: Math.max(0, cueOffset) };
        const totalCategory = categoryAroundTotalCue(clause, localCue, totalValue);
        const explicitWholeScope = !totalCategory ||
          totalCategory.wholeSampleScope ||
          isGenericParticipantCategoryLabel(totalCategory.label);
        (explicitWholeScope ? explicitWholeValues : fallbackValues).add(totalValue);
      }
      continue;
    }
    const subgroupCue = normalized.search(/\b(?:neist|nendest|sealhulgas|sh|millest)\b/u);
    if (subgroupCue < 0 || claims.length < 2) continue;
    const firstClaimBeforeSubgroup = [...claims].reverse().find(claim => claim.index < subgroupCue);
    if (firstClaimBeforeSubgroup) fallbackValues.add(firstClaimBeforeSubgroup.value);
  }
  return explicitWholeValues.size
    ? explicitWholeValues
    : includeFallback
      ? fallbackValues
      : new Set();
}

function asksForNumericFact(message = "") {
  if (asksForParticipantGroupNumericRelation(message)) return true;
  const normalized = normalizeText(message);
  return /%|(?:^|[^\p{L}\p{N}])(?:arv(?:u|ud|ust|uga)?|koguarv\p{L}*|uldarv\p{L}*|kokku|kui\s+palju|kui\s+suur\s+osa|mitu|nait(?:aja|ude?)\p{L}*|osakaal\p{L}*|protsent\p{L}*|millal|mis\s+aastal|millisel\s+aastal|how\s+many|number\s+of|total|percentage|percent|when|what\s+year|which\s+year|сколько|число|итого|всего|процент\p{L}*|когда|каком\s+году)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function asksForYear(message = "") {
  const normalized = normalizeText(message);
  if (/\b(?:mis\s+aasta(?:l|st)?|millisel\s+aastal|mis\s+ajast)\b/u.test(normalized)) return true;
  if (!/\bmillal\b/u.test(normalized)) return false;
  if (/(?:^|[^\p{L}])(?:helistada|helistama|helistage|helista(?:n|me|ks\p{L}*|takse)?)(?=$|[^\p{L}])/u.test(normalized)) return false;
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

function normalizedTemporalTargetYears(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map(value => Number(value))
    .filter(value => Number.isInteger(value) && value >= YEAR_MIN && value <= YEAR_MAX)))
    .slice(0, 8);
}

function temporalNumericClaims(value = "") {
  const text = String(value || "");
  const claims = [];
  for (const match of text.matchAll(/(?<![\p{L}\d])(?:\d{1,3}(?:[\p{Zs}.]\d{3})+|\d+)(?:[.,]\d+)?\s*%?/gu)) {
    const raw = String(match[0] || "").trim();
    const index = match.index || 0;
    const lineStart = Math.max(text.lastIndexOf("\n", Math.max(0, index - 1)), text.lastIndexOf("\r", Math.max(0, index - 1))) + 1;
    const beforeOnLine = text.slice(lineStart, index);
    const after = text.slice(index + String(match[0] || "").length);
    if (!beforeOnLine.trim() && /^\d{1,3}$/u.test(raw) && /^[.)]\s+/u.test(after)) continue;
    if (text[index - 1] === "[" && text[index + String(match[0] || "").length] === "]") continue;
    const normalized = normalizeNumber(raw);
    const numeric = Number(normalized);
    if (!normalized || !Number.isFinite(numeric)) continue;
    claims.push({
      value: normalized,
      numeric,
      percentage: raw.endsWith("%"),
      year: Number.isInteger(numeric) && numeric >= YEAR_MIN && numeric <= YEAR_MAX,
      index
    });
  }
  for (const match of text.matchAll(/(?<![\p{L}\d])[\p{L}]+(?![\p{L}\d])/gu)) {
    const word = normalizeText(match[0]);
    const followingText = normalizeText(text.slice((match.index || 0) + String(match[0] || "").length)).trimStart();
    if (word === "viis" && /^(?:labi|ellu|edasi|sisse|valja)\b/u.test(followingText)) continue;
    const mapped = ESTONIAN_SMALL_NUMBER_FORMS.find(([, pattern]) => pattern.test(word));
    const russianMapped = RUSSIAN_SMALL_NUMBER_FORMS.find(([, pattern]) => pattern.test(word));
    const mappedValue = mapped?.[0] ?? russianMapped?.[0] ?? Number(NON_EST_SMALL_NUMBER_VALUES.get(word));
    if (!Number.isFinite(mappedValue)) continue;
    claims.push({
      value: String(mappedValue),
      numeric: mappedValue,
      percentage: false,
      year: false,
      index: match.index || 0
    });
  }
  return claims.sort((left, right) => left.index - right.index);
}

export function buildTemporalEvidenceRows({ sources = [], targetYears = [] } = {}) {
  const normalizedTargetYears = normalizedTemporalTargetYears(targetYears);
  if (!normalizedTargetYears.length) return [];
  const targetYearSet = new Set(normalizedTargetYears);
  const rows = [];
  const seen = new Set();
  const rowCountsByYear = new Map();

  for (const [sourceIndex, rawSource] of (Array.isArray(sources) ? sources : []).entries()) {
    const source = splitEvidence(rawSource, sourceIndex);
    if (!source.body) continue;
    const sourceId = source.attributionSourceId;
    if (!sourceId || sourceId.length > 300 || /[\r\n]/u.test(sourceId)) continue;
    const bodyClaims = temporalNumericClaims(source.body);
    for (const yearClaim of bodyClaims.filter(claim => claim.year && targetYearSet.has(claim.numeric))) {
      const unit = temporalClaimUnitAroundIndex(source.body, yearClaim.index || 0).text;
      const unitClaims = temporalNumericClaims(unit);
      const unitYears = Array.from(new Set(
        unitClaims.filter(claim => claim.year && targetYearSet.has(claim.numeric)).map(claim => claim.numeric)
      ));
      if (unitYears.length !== 1 || !targetYearSet.has(unitYears[0])) continue;
      const unitValues = unitClaims.filter(claim => !claim.year);
      if (!unitValues.length) continue;
      const evidenceUnit = String(unit || "").replace(/\s+/gu, " ").trim().slice(0, 280);
      for (const valueClaim of unitValues) {
        if (Number(rowCountsByYear.get(unitYears[0]) || 0) >= 6) continue;
        const row = {
          year: unitYears[0],
          value: valueClaim.value,
          percentage: valueClaim.percentage === true,
          source_id: sourceId,
          evidence_unit: evidenceUnit
        };
        const key = [row.year, row.value, row.percentage ? "percent" : "number", row.source_id].join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(row);
        rowCountsByYear.set(unitYears[0], Number(rowCountsByYear.get(unitYears[0]) || 0) + 1);
      }
    }
  }

  return rows.slice(0, 48);
}

function temporalRangeContextTokensAllowed(tokens = []) {
  return (Array.isArray(tokens) ? tokens : []).every(token =>
    /^(?:aasta\p{L}*|jaanuar\p{L}*|veebruar\p{L}*|marts\p{L}*|aprill\p{L}*|mai|juuni\p{L}*|juuli\p{L}*|august\p{L}*|september\p{L}*|oktoober\p{L}*|november\p{L}*|detsember\p{L}*|years?|january|february|march|april|may|june|july|august|september|october|november|december|год\p{L}*|январ\p{L}*|феврал\p{L}*|март\p{L}*|апрел\p{L}*|ма[йяе]\p{L}*|июн\p{L}*|июл\p{L}*|август\p{L}*|сентябр\p{L}*|октябр\p{L}*|ноябр\p{L}*|декабр\p{L}*)$/u.test(token)
  );
}

function explicitTemporalRangeInUnit(value = "", startYear = null, endYear = null) {
  const text = String(value || "");
  const startToken = String(startYear || "");
  const endToken = String(endYear || "");
  if (!startToken || !endToken || startToken === endToken) return null;
  let startIndex = text.indexOf(startToken);
  while (startIndex >= 0) {
    const endIndex = text.indexOf(endToken, startIndex + startToken.length);
    if (endIndex < 0) return null;
    const between = text.slice(startIndex + startToken.length, endIndex);
    const normalizedBetween = normalizeText(between);
    const wordRangeMatch = /(?<!\p{L})(?:kuni|to|through|until|till|до|по)(?!\p{L})/iu.exec(normalizedBetween);
    const connectorContextTokens = wordRangeMatch
      ? normalizeText([
          normalizedBetween.slice(0, wordRangeMatch.index || 0),
          normalizedBetween.slice((wordRangeMatch.index || 0) + String(wordRangeMatch[0] || "").length)
        ].join(" ")).match(/[\p{L}]+/gu) || []
      : [];
    const wordRangeCue = !!wordRangeMatch && temporalRangeContextTokensAllowed(connectorContextTokens);
    const dashRangeMatch = /(?<!\p{L})[-–—](?!\p{L})/u.exec(between);
    const dashContextTokens = dashRangeMatch
      ? normalizeText([
          between.slice(0, dashRangeMatch.index || 0),
          between.slice((dashRangeMatch.index || 0) + String(dashRangeMatch[0] || "").length)
        ].join(" ")).match(/[\p{L}]+/gu) || []
      : [];
    const compactDashRangeCue = between.length <= 32 &&
      !!dashRangeMatch &&
      !/[!?;,/\\]/u.test(between) &&
      temporalRangeContextTokensAllowed(dashContextTokens);
    if (
      between.length <= 120 &&
      (wordRangeCue || compactDashRangeCue)
    ) {
      return {
        startIndex,
        endIndex,
        valueStartIndex: endIndex + endToken.length
      };
    }
    startIndex = text.indexOf(startToken, startIndex + startToken.length);
  }
  return null;
}

function temporalMetricTokensAroundClaim(value = "", claimIndex = 0) {
  const text = String(value || "");
  const boundedIndex = Math.max(0, Math.min(Number(claimIndex) || 0, text.length));
  const suffix = text.slice(boundedIndex);
  const claimToken = suffix.match(/^(?:(?:\d{1,3}(?:[\p{Zs}.]\d{3})+|\d+)(?:[.,]\d+)?\s*%?|\p{L}+)/u)?.[0] || "";
  const claimEnd = boundedIndex + claimToken.length;
  const beforeBoundary = Math.max(
    text.lastIndexOf(",", Math.max(0, boundedIndex - 1)),
    text.lastIndexOf(";", Math.max(0, boundedIndex - 1)),
    text.lastIndexOf(".", Math.max(0, boundedIndex - 1)),
    text.lastIndexOf("!", Math.max(0, boundedIndex - 1)),
    text.lastIndexOf("?", Math.max(0, boundedIndex - 1)),
    text.lastIndexOf("\n", Math.max(0, boundedIndex - 1))
  );
  const afterBoundaries = [",", ";", ".", "!", "?", "\n"]
    .map(separator => text.indexOf(separator, claimEnd))
    .filter(index => index >= 0);
  const nextNumericClaim = temporalNumericClaims(text.slice(claimEnd))[0];
  const nextNumericBoundary = nextNumericClaim
    ? claimEnd + (nextNumericClaim.index || 0)
    : text.length;
  const afterBoundary = Math.min(
    afterBoundaries.length ? Math.min(...afterBoundaries) : text.length,
    nextNumericBoundary
  );
  const semanticTokens = segment => (normalizeText(segment).match(/[\p{L}]+/gu) || [])
    .filter(token => token.length >= 3 && !CATEGORY_LABEL_STOP_WORDS.has(token));
  const afterTokens = semanticTokens(text.slice(claimEnd, afterBoundary)).slice(0, 3);
  const beforeTokens = semanticTokens(text.slice(beforeBoundary + 1, boundedIndex)).slice(-3).reverse();
  return Array.from(new Set([...afterTokens, ...beforeTokens])).slice(0, 6);
}

function temporalStrongEntityFamilies(value = "") {
  return Array.from(new Set(
    (normalizeText(value).match(/[\p{L}]+/gu) || [])
      .map(token => categoryEntityFamily(token))
      .filter(family => family && family !== "person")
  ));
}

function temporalNextUnitContinuesAggregateSubject(baseUnit = "", nextUnit = "") {
  const baseFamilies = new Set(temporalStrongEntityFamilies(baseUnit));
  const nextFamilies = temporalStrongEntityFamilies(nextUnit);
  if (nextFamilies.some(family => baseFamilies.has(family))) return true;
  return /^(?:see|need|nende|sama|samuti|kokku|this|these|those|its|the\s+same|also|in\s+total|это|эти|тот\s+же|та\s+же|также|всего)(?=$|[^\p{L}])/u
    .test(normalizeText(nextUnit));
}

function boundedTemporalAggregateBlock(body = "", rangeUnit = null) {
  if (!rangeUnit?.text) return "";
  const text = String(body || "");
  const base = String(rangeUnit.text || "");
  const nextStart = Math.min(text.length, Number(rangeUnit.end || 0) + 1);
  const paragraphEnd = text.indexOf("\n", nextStart);
  const boundedEnd = Math.min(
    paragraphEnd >= 0 ? paragraphEnd : text.length,
    nextStart + Math.max(0, 640 - base.length)
  );
  const nextWindow = text.slice(nextStart, boundedEnd).trimStart();
  const nextBoundary = temporalPunctuationBoundaries(nextWindow)[0];
  if (!nextWindow || typeof nextBoundary !== "number") return base;
  const nextUnit = nextWindow.slice(0, nextBoundary).trim();
  if (!nextUnit || temporalNumericClaims(nextUnit).some(claim => claim.year)) return base;
  const normalizedNext = normalizeText(nextUnit);
  if (/(?:uus|jargmin\p{L}*|teine)\s+(?:periood|etapp|faas|projekt)|(?:new|next|another)\s+(?:period|stage|phase|project)|(?:нов\p{L}*|следующ\p{L}*|друг\p{L}*)\s+(?:период|этап|фаз|проект)/u.test(normalizedNext)) {
    return base;
  }
  if (!temporalNextUnitContinuesAggregateSubject(base, nextUnit)) return base;
  return `${base}. ${nextUnit}`.slice(0, 640);
}

function temporalSourceLooksLikeAnnualDistribution(value = "") {
  const normalized = normalizeText(value);
  return /(?:vastavalt|aasta(?:te)?\s+(?:kaupa|loikes|eraldi)|aastapohis\p{L}*|respectively|by\s+(?:individual\s+)?year|year-by-year|по\s+годам|соответственно)/u.test(normalized);
}

function temporalSourceContainsDirectionalValues(value = "") {
  const normalized = normalizeText(value);
  return /(?:kasv\p{L}*|lang\p{L}*|suuren\p{L}*|vahen\p{L}*|tous\p{L}*|kahan\p{L}*|upward|downward|increas\p{L}*|decreas\p{L}*|grew|rose|fell|declin\p{L}*|рост\p{L}*|сниж\p{L}*|увелич\p{L}*|уменьш\p{L}*|возрос\p{L}*|упал\p{L}*)/u.test(normalized);
}

export function buildTemporalAggregatePeriodRows({ sources = [], targetYears = [] } = {}) {
  const normalizedTargetYears = normalizedTemporalTargetYears(targetYears).sort((left, right) => left - right);
  if (normalizedTargetYears.length < 2) return [];
  const periodStartYear = normalizedTargetYears[0];
  const periodEndYear = normalizedTargetYears[normalizedTargetYears.length - 1];
  const rows = [];
  const seen = new Set();

  for (const [sourceIndex, rawSource] of (Array.isArray(sources) ? sources : []).entries()) {
    const source = splitEvidence(rawSource, sourceIndex);
    if (!source.body) continue;
    const sourceId = source.attributionSourceId;
    if (!sourceId || sourceId.length > 300 || /[\r\n]/u.test(sourceId)) continue;
    const bodyClaims = temporalNumericClaims(source.body);
    for (const startClaim of bodyClaims.filter(claim => claim.year && claim.numeric === periodStartYear)) {
      const rangeUnit = temporalClaimUnitAroundIndex(source.body, startClaim.index || 0);
      const range = explicitTemporalRangeInUnit(rangeUnit.text, periodStartYear, periodEndYear);
      if (!range) continue;
      const aggregateBlock = boundedTemporalAggregateBlock(source.body, rangeUnit);
      if (
        temporalSourceLooksLikeAnnualDistribution(aggregateBlock) ||
        temporalSourceContainsDirectionalValues(aggregateBlock)
      ) continue;
      const unitYearClaims = temporalNumericClaims(aggregateBlock).filter(claim => claim.year);
      if (unitYearClaims.some(claim => claim.numeric < periodStartYear || claim.numeric > periodEndYear)) continue;
      const tailClaims = temporalNumericClaims(aggregateBlock.slice(range.valueStartIndex));
      if (tailClaims.some(claim => claim.year)) continue;
      const valueClaims = tailClaims.filter(claim => !claim.year);
      const distinctValues = new Set(valueClaims.map(claim => `${claim.value}|${claim.percentage ? "percent" : "number"}`));
      if (distinctValues.size < 2) continue;
      const evidenceUnit = String(aggregateBlock || "").replace(/\s+/gu, " ").trim().slice(0, 640);
      const unitRows = [];
      for (const claim of valueClaims) {
        const metricTokens = temporalMetricTokensAroundClaim(
          aggregateBlock,
          range.valueStartIndex + (claim.index || 0)
        );
        if (!metricTokens.length) continue;
        unitRows.push({
          period_start_year: periodStartYear,
          period_end_year: periodEndYear,
          value: claim.value,
          percentage: claim.percentage === true,
          source_id: sourceId,
          metric_tokens: metricTokens,
          evidence_unit: evidenceUnit
        });
      }
      if (new Set(unitRows.map(row => row.metric_tokens[0])).size < 2) continue;
      for (const row of unitRows) {
        const key = [
          row.period_start_year,
          row.period_end_year,
          row.value,
          row.percentage ? "percent" : "number",
          row.source_id,
          row.metric_tokens.join(",")
        ].join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(row);
      }
    }
  }

  return rows.slice(0, 48);
}

export function selectSingleSourceTemporalAggregateRows(rows = []) {
  const boundedRows = Array.isArray(rows) ? rows.slice(0, 48) : [];
  const sourceIds = new Set(boundedRows.map(row => String(row?.source_id || "").trim()).filter(Boolean));
  return boundedRows.length >= 2 && sourceIds.size === 1 ? boundedRows : [];
}

function temporalSourcePublicationYear(source = {}) {
  const values = [
    source?.year,
    source?.source_year,
    source?.sourceYear,
    source?.publication_year,
    source?.publicationYear,
    source?.publication_date,
    source?.publicationDate,
    source?.published_at,
    source?.publishedAt,
    source?.issue_date,
    source?.issueDate,
    source?.issue_label,
    source?.issueLabel,
    source?.issue_id,
    source?.issueId
  ];
  for (const value of values) {
    const matched = String(value || "").match(/\b(?:19|20)\d{2}\b/u)?.[0];
    const year = Number(matched || value);
    if (Number.isInteger(year) && year >= YEAR_MIN && year <= YEAR_MAX) return year;
  }
  return null;
}

function temporalSourceDocumentId(rawSource = {}, sourceIndex = 0, parsedSource = null) {
  const source = parsedSource || splitEvidence(rawSource, sourceIndex);
  return String(
    source.documentId ||
    rawSource?.canonical_item_id ||
    rawSource?.canonicalItemId ||
    rawSource?.doc_id ||
    rawSource?.docId ||
    source.attributionSourceId
  ).trim();
}

function temporalSupplementalTopicTokens(topicTerms = []) {
  const ignored = new Set([
    "aasta", "aastad", "aastate", "aastatel", "annual", "artikkel", "article", "figures",
    "help", "loikes", "metrics", "muutus", "naitaja", "naitajad", "sotsiaal", "sotsiaaltoo",
    "source", "support", "teenus", "trend", "trendi", "year", "years"
  ]);
  return Array.from(new Set((Array.isArray(topicTerms) ? topicTerms : [])
    .flatMap(term => normalizeText(term).match(/[\p{L}]+/gu) || [])
    .filter(token => token.length >= 4)
    .filter(token => !ignored.has(token))
    .filter(token => !/^(?:aasta|annual|artik|figures?|год\p{L}*|источник\p{L}*|loike|metrics?|muutu|naitaj|показател\p{L}*|service|source|teenus|trend|тренд\p{L}*|услуг\p{L}*|years?)/u.test(token))
    .filter(token => !CATEGORY_LABEL_STOP_WORDS.has(token))))
    .slice(0, 12);
}

export function temporalSupplementalTopicTermsFromQueryPlan(queryPlan = {}) {
  const planner = queryPlan?.question_planner && typeof queryPlan.question_planner === "object"
    ? queryPlan.question_planner
    : queryPlan;
  return [
    ...(Array.isArray(planner?.topics) ? planner.topics : []),
    ...(Array.isArray(planner?.entities) ? planner.entities : []),
    ...(Array.isArray(planner?.subject_terms) ? planner.subject_terms : [])
  ].map(value => String(value || "").trim()).filter(Boolean).slice(0, 16);
}

function temporalUnitMatchesSupplementalTopic(unit = "", topicTokens = []) {
  const unitTokens = normalizeText(unit).match(/[\p{L}]+/gu) || [];
  return topicTokens.some(topicToken =>
    unitTokens.some(unitToken => categoryTokenMatches(topicToken, unitToken))
  );
}

export function buildTemporalSupplementalSourceScopes({
  sources = [],
  primarySourceId = "",
  primaryDocumentId = "",
  primaryTitle = "",
  topicTerms = []
} = {}) {
  const topicTokens = temporalSupplementalTopicTokens(topicTerms);
  const primaryId = String(primarySourceId || "").trim();
  const primaryDocId = String(primaryDocumentId || "").trim();
  const normalizedPrimaryTitle = normalizeText(primaryTitle);
  if (!primaryId || !topicTokens.length) return [];
  const scopes = [];
  const seenSourceIds = new Set();
  const seenDocumentIds = new Set();
  const seenTitles = new Set();

  for (const [sourceIndex, rawSource] of (Array.isArray(sources) ? sources : []).entries()) {
    if (!isResearchOrJournalSource(rawSource)) continue;
    const source = splitEvidence(rawSource, sourceIndex);
    const sourceId = source.attributionSourceId;
    const documentId = temporalSourceDocumentId(rawSource, sourceIndex, source);
    const title = String(source.title || "").replace(/\s+/gu, " ").trim();
    const normalizedTitle = normalizeText(title);
    if (
      !source.body ||
      !sourceId ||
      !documentId ||
      sourceId === primaryId ||
      (primaryDocId && documentId === primaryDocId) ||
      (normalizedPrimaryTitle && normalizedTitle === normalizedPrimaryTitle) ||
      sourceId.length > 300 ||
      documentId.length > 300 ||
      /[\r\n]/u.test(sourceId) ||
      /[\r\n]/u.test(documentId) ||
      seenSourceIds.has(sourceId) ||
      seenDocumentIds.has(documentId) ||
      (normalizedTitle && seenTitles.has(normalizedTitle))
    ) continue;
    const publicationYear = temporalSourcePublicationYear(rawSource);
    if (!publicationYear || !title || title.length > 240 || /[\r\n]/u.test(title)) continue;
    const evidenceUnits = temporalTextUnits(source.body)
      .map(unit => String(unit || "").replace(/\s+/gu, " ").trim())
      .filter(unit => unit.length >= 45 && unit.length <= 480)
      .filter(unit => temporalUnitMatchesSupplementalTopic(unit, topicTokens))
      .filter(unit => !temporalAggregatePeriodFraming(unit))
      .filter(unit => !temporalUnitStatesEvidenceUnavailable(unit))
      .filter(unit => !temporalSourceContainsDirectionalValues(unit))
      .filter(unit => !/(?:trend\p{L}*|aastatevahel\p{L}*|year-to-year|between-year|динамик\p{L}*|тренд\p{L}*)/u.test(normalizeText(unit)))
      .sort((left, right) => {
        const matches = value => topicTokens.filter(topicToken =>
          (normalizeText(value).match(/[\p{L}]+/gu) || [])
            .some(unitToken => categoryTokenMatches(topicToken, unitToken))
        ).length;
        return matches(right) - matches(left) || left.length - right.length;
      });
    if (!evidenceUnits.length) continue;
    seenSourceIds.add(sourceId);
    seenDocumentIds.add(documentId);
    seenTitles.add(normalizedTitle);
    scopes.push({
      document_id: documentId,
      source_id: sourceId,
      publication_year: publicationYear,
      title,
      evidence_units: [evidenceUnits[0]]
    });
    if (scopes.length >= 3) break;
  }

  return scopes;
}

function temporalPunctuationBoundaries(value = "") {
  const text = String(value || "");
  const boundaries = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "\n" || character === ";" || character === "!" || character === "?") {
      boundaries.push(index);
      continue;
    }
    if (character !== ".") continue;
    const previousCharacter = text[index - 1] || "";
    const nextCharacter = text[index + 1] || "";
    if (/\d/u.test(previousCharacter) && /\d/u.test(nextCharacter)) continue;
    const precedingYear = text.slice(Math.max(0, index - 4), index);
    const followingText = text.slice(index + 1).trimStart();
    if (
      /^(?:19|20)\d{2}$/u.test(precedingYear) &&
      /^(?:[,)\-–—]|(?:ja|ning|voi|and|or|и)\b|(?:aasta|aastal|year|г\.|год)\b)/iu.test(followingText)
    ) continue;
    boundaries.push(index);
  }
  return boundaries;
}

function temporalClaimUnitAroundIndex(value = "", index = 0) {
  const text = String(value || "");
  const boundedIndex = Math.max(0, Math.min(Number(index) || 0, text.length));
  const boundaries = temporalPunctuationBoundaries(text);
  const preceding = boundaries.filter(position => position < boundedIndex);
  const following = boundaries.filter(position => position >= boundedIndex);
  const start = preceding.length ? preceding[preceding.length - 1] + 1 : 0;
  const end = following.length ? following[0] : text.length;
  return {
    text: text.slice(start, end),
    start,
    end
  };
}

function temporalClaimContractFromRetrievalMeta(retrievalMeta = null, sources = null) {
  const rawContract = retrievalMeta?.temporalClaimContract ||
    retrievalMeta?.evidencePackage?.temporal_claim_contract;
  if (rawContract?.version !== "temporal_claim_contract_v1") return null;
  const typedContract = retrievalMeta?.queryPlan?.temporal_query_contract;
  if (typedContract?.production_source !== "question_planner") return null;
  const targetYears = normalizedTemporalTargetYears(rawContract.target_years);
  if (targetYears.length < 2) return null;
  const typedTargetYears = normalizedTemporalTargetYears(typedContract?.breakdown_years);
  if (
    typedTargetYears.length !== targetYears.length ||
    typedTargetYears.some(year => !targetYears.includes(year))
  ) return null;
  const targetYearSet = new Set(targetYears);
  const normalizedRows = rows => (Array.isArray(rows) ? rows : [])
    .map(row => ({
      year: Number(row?.year),
      value: normalizeNumber(row?.value),
      percentage: row?.percentage === true,
      source_id: String(row?.source_id || "").trim()
    }))
    .filter(row => targetYearSet.has(row.year) && row.value && row.source_id)
    .slice(0, 48);
  const periodStartYear = Math.min(...targetYears);
  const periodEndYear = Math.max(...targetYears);
  const normalizedAggregateRows = rows => (Array.isArray(rows) ? rows : [])
    .map(row => ({
      period_start_year: Number(row?.period_start_year),
      period_end_year: Number(row?.period_end_year),
      value: normalizeNumber(row?.value),
      percentage: row?.percentage === true,
      source_id: String(row?.source_id || "").trim(),
      metric_tokens: Array.from(new Set((Array.isArray(row?.metric_tokens) ? row.metric_tokens : [])
        .map(token => normalizeText(token))
        .filter(Boolean)))
        .slice(0, 6),
      evidence_unit: String(row?.evidence_unit || "").replace(/\s+/gu, " ").trim().slice(0, 640)
    }))
    .filter(row =>
      row.period_start_year === periodStartYear &&
      row.period_end_year === periodEndYear &&
      row.value &&
      row.source_id &&
      row.metric_tokens.length > 0 &&
      row.evidence_unit
    )
    .slice(0, 48);
  const normalizedSupplementalScopes = scopes => (Array.isArray(scopes) ? scopes : [])
    .map(scope => ({
      document_id: String(scope?.document_id || "").trim(),
      source_id: String(scope?.source_id || "").trim(),
      publication_year: Number(scope?.publication_year),
      title: String(scope?.title || "").replace(/\s+/gu, " ").trim(),
      evidence_units: Array.from(new Set((Array.isArray(scope?.evidence_units) ? scope.evidence_units : [])
        .map(unit => String(unit || "").replace(/\s+/gu, " ").trim())
        .filter(unit => unit.length >= 45 && unit.length <= 480)))
        .slice(0, 2)
    }))
    .filter(scope =>
      scope.document_id &&
      scope.source_id &&
      Number.isInteger(scope.publication_year) &&
      scope.publication_year >= YEAR_MIN &&
      scope.publication_year <= YEAR_MAX &&
      scope.title &&
      scope.title.length <= 240 &&
      scope.evidence_units.length > 0
    )
    .slice(0, 3);
  const contractRows = normalizedRows(rawContract.evidence_rows);
  const contractAggregateRows = selectSingleSourceTemporalAggregateRows(
    normalizedAggregateRows(rawContract.aggregate_period_rows)
  );
  const contractSupplementalScopes = normalizedSupplementalScopes(rawContract.supplemental_source_scopes);
  const contractMissingYears = normalizedTemporalTargetYears(rawContract.missing_years)
    .filter(year => targetYearSet.has(year));
  let evidenceRows = contractRows;
  let aggregatePeriodRows = contractAggregateRows;
  let supplementalSourceScopes = contractSupplementalScopes;
  let missingYears = contractMissingYears;
  let integrityConfirmed = null;
  if (Array.isArray(sources)) {
    evidenceRows = normalizedRows(buildTemporalEvidenceRows({ sources, targetYears }));
    const rowKey = row => [row.year, row.value, row.percentage ? "percent" : "number", row.source_id].join("|");
    const aggregateRowKey = row => [
      row.period_start_year,
      row.period_end_year,
      row.value,
      row.percentage ? "percent" : "number",
      row.source_id,
      row.metric_tokens.join(","),
      normalizeText(row.evidence_unit)
    ].join("|");
    const supplementalScopeKey = scope => [
      scope.document_id,
      scope.source_id,
      scope.publication_year,
      normalizeText(scope.title),
      ...scope.evidence_units.map(unit => normalizeText(unit))
    ].join("|");
    const contractRowKeys = new Set(contractRows.map(rowKey));
    const liveRowKeys = new Set(evidenceRows.map(rowKey));
    missingYears = targetYears.filter(year => !evidenceRows.some(row => row.year === year));
    aggregatePeriodRows = missingYears.length
      ? selectSingleSourceTemporalAggregateRows(normalizedAggregateRows(
          buildTemporalAggregatePeriodRows({ sources: sources.slice(0, 1), targetYears })
        ))
      : [];
    supplementalSourceScopes = aggregatePeriodRows.length
      ? normalizedSupplementalScopes(buildTemporalSupplementalSourceScopes({
          sources,
          primarySourceId: aggregatePeriodRows[0]?.source_id,
          primaryDocumentId: temporalSourceDocumentId(sources[0] || {}, 0),
          primaryTitle: String(sources[0]?.title || "").trim(),
          topicTerms: temporalSupplementalTopicTermsFromQueryPlan(retrievalMeta?.queryPlan)
        }))
      : [];
    const contractAggregateRowKeys = new Set(contractAggregateRows.map(aggregateRowKey));
    const liveAggregateRowKeys = new Set(aggregatePeriodRows.map(aggregateRowKey));
    const contractSupplementalScopeKeys = new Set(contractSupplementalScopes.map(supplementalScopeKey));
    const liveSupplementalScopeKeys = new Set(supplementalSourceScopes.map(supplementalScopeKey));
    integrityConfirmed = contractRowKeys.size === liveRowKeys.size &&
      [...contractRowKeys].every(key => liveRowKeys.has(key)) &&
      contractMissingYears.length === missingYears.length &&
      contractMissingYears.every(year => missingYears.includes(year)) &&
      contractAggregateRowKeys.size === liveAggregateRowKeys.size &&
      [...contractAggregateRowKeys].every(key => liveAggregateRowKeys.has(key)) &&
      contractSupplementalScopeKeys.size === liveSupplementalScopeKeys.size &&
      [...contractSupplementalScopeKeys].every(key => liveSupplementalScopeKeys.has(key));
  }
  return {
    version: rawContract.version,
    targetYears,
    evidenceRows,
    aggregatePeriodRows,
    supplementalSourceScopes,
    missingYears,
    integrityConfirmed
  };
}

function temporalUnitStatesEvidenceUnavailable(value = "") {
  const normalized = normalizeText(value);
  return /(?:ei\s+(?:ole|leidu|sisaldu|kajastu|saa|voimalda|esita|anna)|pole|puudu\p{L}*|kinnitamata|toendamata|not\s+(?:available|reported|provided|shown|confirmed|proven)|unavailable|cannot\s+(?:confirm|establish|infer)|does\s+not\s+(?:report|provide|show)|no\s+year-specific|insufficient\s+evidence|нет|не\s+(?:указан\p{L}*|приведен\p{L}*|подтвержден\p{L}*|доказан\p{L}*|представлен\p{L}*)|недостаточно\s+(?:данных|доказательств))/u.test(normalized);
}

function temporalTextUnits(value = "") {
  const text = String(value || "");
  const boundaries = temporalPunctuationBoundaries(text);
  const units = [];
  let start = 0;
  for (const boundary of boundaries) {
    const unit = text.slice(start, boundary).trim();
    if (unit) units.push(unit);
    start = boundary + 1;
  }
  const finalUnit = text.slice(start).trim();
  if (finalUnit) units.push(finalUnit);
  return units;
}

function temporalAggregatePeriodFraming(value = "") {
  const normalized = normalizeText(value);
  return /(?:kogu|terve)\s+(?:ajavahemik\p{L}*|periood\p{L}*)|(?:ajavahemik\p{L}*|periood\p{L}*)\s+(?:koond\p{L}*|kogunaitaj\p{L}*)|koond(?:periood|naitaj|andm|tulemus)\p{L}*|(?:aggregate|overall|combined)\s+(?:period|figures?|metrics?|results?|data)|(?:whole|entire)\s+period|in\s+total\s+(?:for|over|during)\s+the\s+period|(?:за\s+весь|в\s+целом\s+за)\s+период|сводн\p{L}*\s+(?:за\s+)?период|итог\p{L}*\s+за\s+период/u.test(normalized);
}

function temporalAggregateFramingNegated(value = "") {
  const normalized = normalizeText(value);
  return /(?:(?:(?:kogu|terve)\s+(?:ajavahemik\p{L}*|periood\p{L}*)|(?:ajavahemik\p{L}*|periood\p{L}*)\s+(?:koond\p{L}*|kogunaitaj\p{L}*)|koond(?:periood|naitaj|andm|tulemus)\p{L}*)\s+(?:ei\s+(?:ole|leidu|sisaldu|kajastu|saa|esita)|pole|puudu\p{L}*|kinnitamata|toendamata)|(?:no|not|unavailable)\s+(?:aggregate|overall|combined)\s+(?:period|figures?|metrics?|results?|data)|(?:aggregate|overall|combined)\s+(?:period|figures?|metrics?|results?|data)\s+(?:is|are|was|were)?\s*(?:not|unavailable)|(?:нет|не\s+(?:представлен\p{L}*|подтвержден\p{L}*))\s+(?:сводн\p{L}*|итог\p{L}*))/u.test(normalized);
}

function temporalPositiveAggregatePeriodFraming(value = "") {
  return temporalTextUnits(value).some(unit =>
    temporalAggregatePeriodFraming(unit) && !temporalAggregateFramingNegated(unit)
  );
}

function temporalAggregateClaimInFramedBlock(value = "", claimIndex = 0) {
  const text = String(value || "");
  const boundedIndex = Math.max(0, Math.min(Number(claimIndex) || 0, text.length));
  const lineStart = text.lastIndexOf("\n", Math.max(0, boundedIndex - 1)) + 1;
  const lineEndMatch = text.indexOf("\n", boundedIndex);
  const lineEnd = lineEndMatch >= 0 ? lineEndMatch : text.length;
  const currentLine = text.slice(lineStart, lineEnd).trim();
  if (currentLine.length <= 500 && temporalPositiveAggregatePeriodFraming(currentLine)) return true;
  if (!/^\s*(?:[-*•]|\d{1,2}[.)])\s+/u.test(text.slice(lineStart, lineEnd))) return false;

  let cursor = lineStart;
  let scannedLines = 0;
  let scannedChars = 0;
  let blankLines = 0;
  while (cursor > 0 && scannedLines < 12 && scannedChars <= 900) {
    const previousEnd = cursor - 1;
    const previousStart = text.lastIndexOf("\n", Math.max(0, previousEnd - 1)) + 1;
    const previousLine = text.slice(previousStart, previousEnd).trim();
    scannedLines += 1;
    scannedChars += cursor - previousStart;
    cursor = previousStart;
    if (!previousLine) {
      blankLines += 1;
      if (blankLines > 1) return false;
      continue;
    }
    if (/^\s*(?:[-*•]|\d{1,2}[.)])\s+/u.test(previousLine)) continue;
    return previousLine.length <= 300 && temporalPositiveAggregatePeriodFraming(previousLine);
  }
  return false;
}

function temporalAnnualBreakdownUnavailable(value = "") {
  const annualScope = /(?:eraldi\s+(?:aasta|aastate|aastaarv|naitaj)|aasta(?:te)?\s+(?:kaupa|loikes|eraldi)|aasta(?:te)?\s+kohta.{0,50}eraldi\s+naitaj|aastapohis\p{L}*|uksikaasta\p{L}*|year-specific|separate\s+annual|annual\s+(?:breakdown|figures?|rows?|values?)|(?:separate|comparable)\s+(?:figures?|rows?|values?)\s+(?:for|by)\s+(?:(?:the\s+)?(?:requested\s+)?years|(?:(?:19|20)\d{2}(?:\s*(?:,|and|or|&)\s*(?:19|20)\d{2}){1,5}|(?:19|20)\d{2}\s*(?:[-–—]|to|through)\s*(?:19|20)\d{2})(?:\s+years)?)|by\s+individual\s+year|по\s+отдельн\p{L}*\s+год|отдельн\p{L}*\s+годов\p{L}*|годов\p{L}*\s+(?:разбивк|показател)|по\s+годам.{0,50}отдельн\p{L}*\s+показател)/u;
  const explicitNegativeAnnualScope = /(?:mitte\s+(?:eraldi\s+)?aasta(?:te)?\s+(?:kaupa|loikes)|not\s+(?:available\s+)?(?:separately\s+)?by\s+(?:individual\s+)?year|не\s+(?:представлен\p{L}*|приведен\p{L}*)\s+по\s+годам)/u;
  return temporalTextUnits(value).some(unit => {
    const normalized = normalizeText(unit);
    return annualScope.test(normalized) && (
      temporalUnitStatesEvidenceUnavailable(unit) || explicitNegativeAnnualScope.test(normalized)
    );
  });
}

function temporalTrendUnavailable(value = "") {
  const trendScope = /(?:trend\p{L}*|muutus\p{L}*\s+aast|aastatevahel\p{L}*|kasv\p{L}*|lang\p{L}*|suuren\p{L}*|vahen\p{L}*|tous\p{L}*|kahan\p{L}*|between-year\s+change|year-to-year\s+(?:trend|change)|increas\p{L}*|decreas\p{L}*|grew|rose|fell|declin\p{L}*|динамик\p{L}*|тренд\p{L}*|изменен\p{L}*\s+между\s+год|рост\p{L}*|сниж\p{L}*|увелич\p{L}*|уменьш\p{L}*)/u;
  return temporalTextUnits(value).some(unit => trendScope.test(normalizeText(unit)) && temporalUnitStatesEvidenceUnavailable(unit));
}

function temporalUnsupportedDirectionalClaim(value = "") {
  const direction = /(?:kasv\p{L}*|lang\p{L}*|suuren\p{L}*|vahen\p{L}*|tous\p{L}*|kahan\p{L}*|upward|downward|increas\p{L}*|decreas\p{L}*|grew|rose|fell|declin\p{L}*|рост\p{L}*|сниж\p{L}*|увелич\p{L}*|уменьш\p{L}*|возрос\p{L}*|упал\p{L}*)/u;
  return temporalTextUnits(value).some(unit => direction.test(normalizeText(unit)) && !temporalUnitStatesEvidenceUnavailable(unit));
}

function temporalAggregateReplyLanguage(value = "", replyLang = "") {
  const explicitLanguage = String(replyLang || "").trim().toLowerCase();
  if (["et", "en", "ru"].includes(explicitLanguage)) return explicitLanguage;
  const replyText = String(value || "");
  if (/\p{Script=Cyrillic}/u.test(replyText)) return "ru";
  return /\b(?:the|selected|evidence|year|trend|overall|combined|period|figures?)\b/iu.test(replyText)
    ? "en"
    : "et";
}

function temporalAggregateSafePrimaryReply(rows = [], originalReply = "", replyLang = "") {
  const groupedEvidenceUnits = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const evidenceUnit = String(row?.evidence_unit || "").replace(/\s+/gu, " ").trim();
    if (!evidenceUnit) continue;
    const key = normalizeText(evidenceUnit);
    const prior = groupedEvidenceUnits.get(key) || { text: evidenceUnit, count: 0 };
    groupedEvidenceUnits.set(key, { text: prior.text, count: prior.count + 1 });
  }
  const evidenceUnit = [...groupedEvidenceUnits.values()]
    .sort((left, right) => right.count - left.count || left.text.length - right.text.length)[0]?.text || "";
  const periodStartYear = Math.min(...rows.map(row => Number(row?.period_start_year)).filter(Number.isInteger));
  const periodEndYear = Math.max(...rows.map(row => Number(row?.period_end_year)).filter(Number.isInteger));
  if (!evidenceUnit || !Number.isInteger(periodStartYear) || !Number.isInteger(periodEndYear)) return "";

  const language = temporalAggregateReplyLanguage(originalReply, replyLang);
  if (language === "ru") {
    return `Сводные показатели за весь период ${periodStartYear}–${periodEndYear}:\n- ${evidenceUnit}\n\nВ отобранных доказательствах отдельные показатели по отдельным годам не представлены, поэтому подтвердить межгодовой тренд нельзя.`;
  }
  if (language === "en") {
    return `Combined figures for the whole ${periodStartYear}–${periodEndYear} period:\n- ${evidenceUnit}\n\nThe selected evidence does not provide separate figures for the requested years, so it cannot establish a year-to-year trend.`;
  }
  return `Kogu perioodi ${periodStartYear}–${periodEndYear} koondnäitajad:\n- ${evidenceUnit}\n\nValitud tõend ei esita näitajaid küsitud aastate kaupa eraldi, mistõttu ei saa aastatevahelist trendi kinnitada.`;
}

function temporalAggregateCanonicalReply(primaryReply = "", supplementalBindings = [], originalReply = "", replyLang = "") {
  const primary = String(primaryReply || "").trim();
  const bindings = Array.isArray(supplementalBindings) ? supplementalBindings : [];
  if (!primary || !bindings.length) return primary;
  const language = temporalAggregateReplyLanguage(originalReply, replyLang);
  const heading = language === "ru"
    ? "Дополнительный контекст:"
    : language === "en"
      ? "Additional context:"
      : "Lisakontekst:";
  const lines = bindings.map(binding =>
    `- ${binding.publication_year} — ${binding.title}: ${binding.evidence_unit}`
  );
  return `${primary}\n\n${heading}\n${lines.join("\n")}`;
}

function splitTemporalSupplementalSection(value = "") {
  const reply = String(value || "").trim();
  const headingLine = /(?:^|\n)[ \t]*(?:(?:#{1,4}[ \t]*)|\*{2})?(?:lisakontekst|additional context|дополнительный контекст)[ \t]*:?(?:\*{2})?[ \t]*:?[ \t]*(?:\r?\n|$)/iu.exec(reply);
  const inlineHeading = /(?:^|\n)[ \t]*(?:#{1,4}[ \t]*)?(?:lisakontekst|additional context|дополнительный контекст)[ \t]*:[ \t]*/iu.exec(reply);
  const heading = [headingLine, inlineHeading]
    .filter(Boolean)
    .sort((left, right) => (left.index || 0) - (right.index || 0) || String(left[0] || "").length - String(right[0] || "").length)[0] || null;
  if (heading) {
    return {
      primaryReply: reply.slice(0, heading.index || 0).trim(),
      supplementalText: reply.slice((heading.index || 0) + String(heading[0] || "").length).trim(),
      headingFound: true,
      headingRecognized: true
    };
  }
  const trailingHeadingPattern = /^(?:[ \t]*(?:#{1,4}[ \t]+[^\r\n]{1,80}|\*{2}[^\r\n*]{1,80}\*{2}:?|\p{L}[^\r\n.!?]{1,60}:))[ \t]*\r?$/gmu;
  for (const candidate of reply.matchAll(trailingHeadingPattern)) {
    const candidateIndex = candidate.index || 0;
    const preceding = reply.slice(0, candidateIndex).trim();
    if (
      !preceding ||
      !temporalPositiveAggregatePeriodFraming(preceding) ||
      !temporalAnnualBreakdownUnavailable(preceding) ||
      !temporalTrendUnavailable(preceding)
    ) continue;
    return {
      primaryReply: preceding,
      supplementalText: reply.slice(candidateIndex + String(candidate[0] || "").length).trim(),
      headingFound: true,
      headingRecognized: false
    };
  }
  const terminalBoundaries = Array.from(new Set([
    ...temporalPunctuationBoundaries(reply).map(index => index + 1),
    reply.length
  ])).sort((left, right) => left - right);
  for (const boundary of terminalBoundaries) {
    const preceding = reply.slice(0, boundary).trim();
    const trailing = reply.slice(boundary).trim();
    if (
      !trailing ||
      !temporalPositiveAggregatePeriodFraming(preceding) ||
      !temporalAnnualBreakdownUnavailable(preceding) ||
      !temporalTrendUnavailable(preceding)
    ) continue;
    return {
      primaryReply: preceding,
      supplementalText: trailing,
      headingFound: true,
      headingRecognized: false
    };
  }
  return {
    primaryReply: reply,
    supplementalText: "",
    headingFound: false,
    headingRecognized: false
  };
}

function validateTemporalSupplementalSection(reply = "", scopes = []) {
  const split = splitTemporalSupplementalSection(reply);
  if (!split.headingFound) {
    return {
      primaryReply: split.primaryReply,
      resolvedReply: split.primaryReply,
      supportingSourceIds: [],
      bindings: [],
      droppedReason: null
    };
  }
  const normalizedScopes = Array.isArray(scopes) ? scopes : [];
  const lines = split.supplementalText
    .split(/\r?\n/u)
    .map(line => line.replace(/^\s*(?:[-*•]|\d{1,2}[.)])\s*/u, "").trim())
    .filter(Boolean);
  if (
    !split.headingRecognized ||
    !split.primaryReply ||
    !normalizedScopes.length ||
    !lines.length ||
    lines.length > normalizedScopes.length
  ) {
    return {
      primaryReply: split.primaryReply,
      resolvedReply: split.primaryReply,
      supportingSourceIds: [],
      bindings: [],
      droppedReason: "temporal_supplement_structure_invalid"
    };
  }

  const usedSourceIds = new Set();
  const bindings = [];
  for (const line of lines) {
    const normalizedLine = normalizeText(line);
    let matchedEvidenceUnit = "";
    const matchedScope = normalizedScopes.find(scope => {
      if (usedSourceIds.has(scope.source_id)) return false;
      const evidenceUnit = (Array.isArray(scope.evidence_units) ? scope.evidence_units : []).find(unit =>
        normalizedLine === normalizeText(`${scope.publication_year} — ${scope.title}: ${unit}`)
      );
      if (!evidenceUnit) return false;
      matchedEvidenceUnit = String(evidenceUnit || "").replace(/\s+/gu, " ").trim();
      return true;
    });
    if (!matchedScope) {
      return {
        primaryReply: split.primaryReply,
        resolvedReply: split.primaryReply,
        supportingSourceIds: [],
        bindings: [],
        droppedReason: "temporal_supplement_evidence_mismatch"
      };
    }
    usedSourceIds.add(matchedScope.source_id);
    bindings.push({
      document_id: matchedScope.document_id,
      source_id: matchedScope.source_id,
      publication_year: matchedScope.publication_year,
      title: matchedScope.title,
      evidence_unit: matchedEvidenceUnit
    });
  }

  return {
    primaryReply: split.primaryReply,
    resolvedReply: String(reply || "").trim(),
    supportingSourceIds: [...usedSourceIds],
    bindings,
    droppedReason: null
  };
}

function validateTemporalAggregatePeriodFallback({ reply = "", contract = null, eligibleSources = [], replyLang = "et" } = {}) {
  const aggregateRows = Array.isArray(contract?.aggregatePeriodRows) ? contract.aggregatePeriodRows : [];
  if (!aggregateRows.length) return { passed: false, reason: "temporal_aggregate_period_rows_missing" };
  const supportingSourceIds = new Set(aggregateRows.map(row => row.source_id).filter(Boolean));
  if (supportingSourceIds.size !== 1) {
    return { passed: false, reason: "temporal_aggregate_period_source_ambiguous" };
  }
  const sourceId = [...supportingSourceIds][0];
  const supportingSource = eligibleSources.find(source => source.attributionSourceId === sourceId);
  if (!supportingSource) return { passed: false, reason: "temporal_aggregate_period_source_missing" };
  const eligibleSourceIds = new Set(eligibleSources.map(source => source.attributionSourceId).filter(Boolean));
  const supplementalSourceScopes = (Array.isArray(contract?.supplementalSourceScopes)
    ? contract.supplementalSourceScopes
    : []).filter(scope => eligibleSourceIds.has(scope.source_id));
  const supplementalValidation = validateTemporalSupplementalSection(reply, supplementalSourceScopes);
  const primaryReply = temporalAggregateSafePrimaryReply(
    aggregateRows,
    supplementalValidation.primaryReply || reply,
    replyLang
  );
  if (!primaryReply) return { passed: false, reason: "temporal_aggregate_primary_canonicalization_failed" };
  supplementalValidation.resolvedReply = temporalAggregateCanonicalReply(
    primaryReply,
    supplementalValidation.bindings,
    reply,
    replyLang
  );
  const primaryClaims = temporalNumericClaims(primaryReply);

  const targetYearSet = new Set(contract.targetYears);
  const targetYearClaims = primaryClaims.filter(claim => claim.year && targetYearSet.has(claim.numeric));
  const extraYearClaims = primaryClaims.filter(claim => claim.year && !targetYearSet.has(claim.numeric));
  if (extraYearClaims.length) {
    return {
      passed: false,
      reason: "temporal_extra_year_not_allowed",
      unsupportedClaimValues: extraYearClaims.map(claim => claim.value)
    };
  }
  const periodStartYear = Math.min(...contract.targetYears);
  const periodEndYear = Math.max(...contract.targetYears);
  const answeredTargetYears = new Set(targetYearClaims.map(claim => claim.numeric));
  const periodExpressed = explicitTemporalRangeInUnit(primaryReply, periodStartYear, periodEndYear) !== null ||
    contract.targetYears.every(year => answeredTargetYears.has(year));
  if (!periodExpressed) {
    return { passed: false, reason: "temporal_aggregate_period_scope_missing" };
  }
  if (!temporalPositiveAggregatePeriodFraming(primaryReply)) {
    return { passed: false, reason: "temporal_aggregate_period_not_framed_as_aggregate" };
  }
  if (!temporalAnnualBreakdownUnavailable(primaryReply)) {
    return { passed: false, reason: "temporal_aggregate_annual_limit_not_disclosed" };
  }
  if (!temporalTrendUnavailable(primaryReply) || temporalUnsupportedDirectionalClaim(primaryReply)) {
    return { passed: false, reason: "temporal_aggregate_trend_limit_not_disclosed" };
  }

  const valueClaims = primaryClaims.filter(claim => !claim.year);
  if (!valueClaims.length) return { passed: false, reason: "temporal_aggregate_value_missing" };
  const bindings = [];
  for (const claim of valueClaims) {
    if (!temporalAggregateClaimInFramedBlock(primaryReply, claim.index || 0)) {
      return {
        passed: false,
        reason: "temporal_aggregate_value_outside_framed_block",
        unsupportedClaimValues: [claim.value]
      };
    }
    const unit = temporalClaimUnitAroundIndex(primaryReply, claim.index || 0);
    const unitTargetYears = Array.from(new Set(
      temporalNumericClaims(unit.text)
        .filter(item => item.year && targetYearSet.has(item.numeric))
        .map(item => item.numeric)
    ));
    if (unitTargetYears.length === 1) {
      return {
        passed: false,
        reason: "temporal_aggregate_value_bound_to_single_year",
        unsupportedClaimValues: [claim.value]
      };
    }
    const candidateRows = aggregateRows.filter(row =>
      row.value === claim.value &&
      row.percentage === claim.percentage &&
      row.source_id === sourceId
    );
    if (!candidateRows.length || !numericClaimSupportedBySource(primaryReply, claim, supportingSource)) {
      return {
        passed: false,
        reason: "temporal_aggregate_value_row_missing",
        unsupportedClaimValues: [claim.value]
      };
    }
    const replyMetricTokens = temporalMetricTokensAroundClaim(primaryReply, claim.index || 0);
    const replyMetricFamilies = Array.from(new Set(
      replyMetricTokens.map(token => categoryEntityFamily(token)).filter(Boolean)
    ));
    const matchedRow = candidateRows.find(row => {
      const primarySourceMetricFamily = categoryEntityFamily(row.metric_tokens[0] || "");
      return primarySourceMetricFamily
        ? replyMetricFamilies.includes(primarySourceMetricFamily) &&
          replyMetricFamilies.every(family => family === primarySourceMetricFamily)
        : row.metric_tokens.some(sourceToken =>
            replyMetricTokens.some(replyToken => categoryTokenMatches(sourceToken, replyToken))
          );
    });
    if (!matchedRow) {
      return {
        passed: false,
        reason: "temporal_aggregate_metric_relation_mismatch",
        unsupportedClaimValues: [claim.value]
      };
    }
    bindings.push({
      period_start_year: matchedRow.period_start_year,
      period_end_year: matchedRow.period_end_year,
      value: claim.value,
      source_id: sourceId
    });
  }

  return {
    passed: true,
    reason: "temporal_aggregate_period_single_source",
    yearMode: "temporal_aggregate_period_single_source",
    bindings: Array.from(new Map(
      bindings.map(binding => [`${binding.period_start_year}|${binding.period_end_year}|${binding.value}|${binding.source_id}`, binding])
    ).values()),
    supportingSourceIds: [sourceId],
    supplementalSupportingSourceIds: supplementalValidation.supportingSourceIds,
    supplementalBindings: supplementalValidation.bindings,
    supplementalDroppedReason: supplementalValidation.droppedReason,
    reply: supplementalValidation.resolvedReply,
    missingTargetYears: contract.missingYears
  };
}

function validateTemporalClaimBindings({ reply = "", claims = [], contract = null, eligibleSources = [], replyLang = "et" } = {}) {
  if (!contract) return null;
  if (contract.integrityConfirmed === false) {
    return { passed: false, reason: "temporal_contract_rendered_evidence_mismatch" };
  }
  const targetYearSet = new Set(contract.targetYears);
  const eligibleSourceIds = new Set(eligibleSources.map(source => source.attributionSourceId).filter(Boolean));
  const evidenceRows = contract.evidenceRows.filter(row => eligibleSourceIds.has(row.source_id));
  if (evidenceRows.length !== contract.evidenceRows.length) {
    return { passed: false, reason: "temporal_contract_source_mismatch" };
  }
  const aggregatePeriodRows = (Array.isArray(contract.aggregatePeriodRows) ? contract.aggregatePeriodRows : [])
    .filter(row => eligibleSourceIds.has(row.source_id));
  if (aggregatePeriodRows.length !== (contract.aggregatePeriodRows || []).length) {
    return { passed: false, reason: "temporal_contract_source_mismatch" };
  }
  if (aggregatePeriodRows.length) {
    return validateTemporalAggregatePeriodFallback({
      reply,
      contract: { ...contract, aggregatePeriodRows },
      eligibleSources,
      replyLang
    });
  }
  const missingYearSet = new Set(contract.missingYears);
  const unitCache = new Map();
  const unitForClaim = claim => {
    const unit = temporalClaimUnitAroundIndex(reply, claim.index || 0);
    const key = `${unit.start}:${unit.end}`;
    if (!unitCache.has(key)) {
      unitCache.set(key, {
        ...unit,
        key,
        claims: temporalNumericClaims(unit.text)
      });
    }
    return unitCache.get(key);
  };
  const bindings = [];
  const supportingSourceIds = new Set();
  const targetYearClaims = claims.filter(claim => claim.year && targetYearSet.has(claim.numeric));
  const answeredTargetYears = new Set(targetYearClaims.map(claim => claim.numeric));
  const missingTargetYears = contract.targetYears.filter(year => !answeredTargetYears.has(year));
  if (missingTargetYears.length) {
    return {
      passed: false,
      reason: "temporal_target_year_missing_from_answer",
      missingTargetYears
    };
  }

  const numericClaimGroups = new Map();
  for (const claim of claims.filter(item => !item.year)) {
    const unit = unitForClaim(claim);
    const unitTargetYears = Array.from(new Set(
      unit.claims.filter(item => item.year && targetYearSet.has(item.numeric)).map(item => item.numeric)
    ));
    if (unitTargetYears.length !== 1) {
      return {
        passed: false,
        reason: unitTargetYears.length ? "temporal_numeric_claim_has_multiple_years" : "temporal_numeric_claim_has_no_year",
        unsupportedClaimValues: [claim.value]
      };
    }
    const group = numericClaimGroups.get(unit.key) || {
      year: unitTargetYears[0],
      claims: []
    };
    group.claims.push(claim);
    numericClaimGroups.set(unit.key, group);
  }

  for (const group of numericClaimGroups.values()) {
    let commonSourceIds = null;
    for (const claim of group.claims) {
      const claimSourceIds = new Set(evidenceRows
        .filter(item =>
          item.year === group.year &&
          item.value === claim.value &&
          item.percentage === claim.percentage
        )
        .map(item => item.source_id));
      if (!claimSourceIds.size) {
        return {
          passed: false,
          reason: "temporal_year_value_row_missing",
          unsupportedClaimValues: [claim.value]
        };
      }
      commonSourceIds = commonSourceIds === null
        ? claimSourceIds
        : new Set([...commonSourceIds].filter(sourceId => claimSourceIds.has(sourceId)));
    }
    if (!commonSourceIds?.size) {
      return {
        passed: false,
        reason: "temporal_unit_cross_source_numeric_mix",
        unsupportedClaimValues: group.claims.map(claim => claim.value)
      };
    }
    const sourceId = [...commonSourceIds][0];
    for (const claim of group.claims) {
      bindings.push({ year: group.year, value: claim.value, source_id: sourceId });
    }
    supportingSourceIds.add(sourceId);
  }

  const extraYearClaims = claims.filter(item => item.year && !targetYearSet.has(item.numeric));
  if (extraYearClaims.length) {
    return {
      passed: false,
      reason: "temporal_extra_year_not_allowed",
      unsupportedClaimValues: extraYearClaims.map(claim => claim.value)
    };
  }

  for (const year of contract.targetYears) {
    const rowsForYear = evidenceRows.filter(row => row.year === year);
    const bindingsForYear = bindings.filter(binding => binding.year === year);
    if (rowsForYear.length) {
      if (!bindingsForYear.length) {
        return { passed: false, reason: "temporal_year_value_not_answered", missingTargetYears: [year] };
      }
      continue;
    }
    if (!missingYearSet.has(year)) {
      return { passed: false, reason: "temporal_year_contract_incomplete", missingTargetYears: [year] };
    }
    const unavailableUnitFound = targetYearClaims
      .filter(claim => claim.numeric === year)
      .map(unitForClaim)
      .some(unit => {
        const nonYearClaims = unit.claims.filter(claim => !claim.year);
        return !nonYearClaims.length && temporalUnitStatesEvidenceUnavailable(unit.text);
      });
    if (!unavailableUnitFound) {
      return { passed: false, reason: "temporal_missing_year_not_disclosed", missingTargetYears: [year] };
    }
  }

  const uniqueBindings = Array.from(new Map(
    bindings.map(binding => [`${binding.year}|${binding.value}|${binding.source_id}`, binding])
  ).values());
  return {
    passed: true,
    reason: uniqueBindings.length ? "temporal_year_value_rows" : "temporal_year_evidence_unavailable",
    bindings: uniqueBindings,
    supportingSourceIds: Array.from(supportingSourceIds),
    missingTargetYears: contract.targetYears.filter(year => missingYearSet.has(year))
  };
}

function contactPhoneClaims(value = "") {
  const claims = [];
  for (const match of String(value || "").matchAll(/(?<!\d)\+?\d(?:[\s()-]*\d){6,11}(?!\d)/gu)) {
    const raw = String(match[0] || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/u.test(raw)) continue;
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("372") && (digits.length === 10 || digits.length === 11)) {
      digits = digits.slice(3);
    }
    if (digits.length < 7 || digits.length > 8) continue;
    claims.push({
      value: digits,
      index: match.index || 0,
      end: (match.index || 0) + raw.length
    });
  }
  return claims;
}

function contactNumericClaims(value = "") {
  const text = String(value || "");
  const claims = [];
  for (const match of text.matchAll(/(?<![\p{L}\d])(?:\d{1,3}(?:[ .]\d{3})+|\d+)(?:[.,]\d+)?\s*%?/gu)) {
    const raw = String(match[0] || "").trim();
    const index = match.index || 0;
    const end = index + raw.length;
    const lineStart = text.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
    const linePrefix = text.slice(lineStart, index);
    const structuralListNumber = /^\s*$/u.test(linePrefix) && /^[.)]\s/u.test(text.slice(end));
    const bracketCitation = text[index - 1] === "[" && text[end] === "]";
    if (structuralListNumber || bracketCitation) continue;
    const normalized = normalizeNumber(raw);
    const numeric = Number(normalized);
    if (!normalized || !Number.isFinite(numeric)) continue;
    claims.push({
      value: normalized,
      numeric,
      percentage: raw.endsWith("%"),
      year: Number.isInteger(numeric) && numeric >= YEAR_MIN && numeric <= YEAR_MAX,
      index
    });
  }
  for (const match of text.matchAll(/\p{L}+/gu)) {
    const rawWord = String(match[0] || "");
    const word = normalizeText(rawWord);
    const followingText = normalizeText(text.slice((match.index || 0) + rawWord.length));
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

function contactEmailClaims(value = "") {
  const claims = [];
  for (const match of String(value || "").matchAll(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/giu)) {
    const raw = String(match[0] || "").trim();
    claims.push({
      value: raw.toLocaleLowerCase("et"),
      index: match.index || 0,
      end: (match.index || 0) + raw.length
    });
  }
  return claims;
}

function contactDateClaims(value = "") {
  const claims = [];
  for (const match of String(value || "").matchAll(/(?<!\d)(?:(\d{4})[-./](\d{1,2})[-./](\d{1,2})|(\d{1,2})[-./](\d{1,2})[-./](\d{4}))(?!\d)/gu)) {
    const year = Number(match[1] || match[6]);
    const month = Number(match[2] || match[5]);
    const day = Number(match[3] || match[4]);
    if (year < YEAR_MIN || year > YEAR_MAX || month < 1 || month > 12 || day < 1 || day > 31) continue;
    const raw = String(match[0] || "");
    claims.push({
      value: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      index: match.index || 0,
      end: (match.index || 0) + raw.length
    });
  }
  return claims;
}

function contactItemBoundsAroundIndex(value = "", index = 0, contacts = []) {
  const text = String(value || "");
  const lines = [];
  for (const match of text.matchAll(/^.*$/gmu)) {
    const lineText = String(match[0] || "");
    const bulletMatch = lineText.match(/^(\s*)(?:[-*•]|\d{1,3}[.)])\s+/u);
    lines.push({
      text: lineText,
      start: match.index || 0,
      end: (match.index || 0) + lineText.length,
      bullet: Boolean(bulletMatch),
      indentation: String(bulletMatch?.[1] || "").replace(/\t/gu, "    ").length
    });
  }
  const currentIndex = Math.max(0, lines.findIndex(line => index >= line.start && index <= line.end));
  let startIndex = currentIndex;
  if (!lines[currentIndex]?.bullet) {
    for (let cursor = currentIndex - 1; cursor >= Math.max(0, currentIndex - 3); cursor -= 1) {
      if (!String(lines[cursor]?.text || "").trim()) break;
      startIndex = cursor;
      if (lines[cursor]?.bullet) break;
    }
  }

  const initialIndentation = lines[startIndex]?.indentation || 0;
  if (
    lines[startIndex]?.bullet &&
    contacts.length &&
    !contactKnownNamesInItem(lines[startIndex]?.text, contacts).length
  ) {
    for (let cursor = startIndex - 1; cursor >= Math.max(0, startIndex - 8); cursor -= 1) {
      const line = lines[cursor];
      if (!String(line?.text || "").trim()) continue;
      if (
        line?.bullet &&
        line.indentation < initialIndentation &&
        contactKnownNamesInItem(line.text, contacts).length
      ) {
        startIndex = cursor;
        break;
      }
    }
  }

  const rootIndentation = lines[startIndex]?.indentation || 0;
  let endIndex = Math.max(currentIndex, startIndex);
  for (let cursor = endIndex + 1; cursor < Math.min(lines.length, startIndex + 10); cursor += 1) {
    const line = String(lines[cursor]?.text || "");
    if (!line.trim()) break;
    if (lines[cursor]?.bullet && lines[cursor].indentation <= rootIndentation) break;
    endIndex = cursor;
  }
  const start = lines[startIndex]?.start || 0;
  const end = lines[endIndex]?.end || text.length;
  return { text: text.slice(start, end), start, end };
}

function structuredContactEvidence(retrievalMeta = null) {
  const raw = retrievalMeta?.serviceMapKovContactEvidence;
  if (!raw || typeof raw !== "object" || raw.enabled !== true) return null;
  const contacts = (Array.isArray(raw.contacts) ? raw.contacts : [])
    .map(contact => ({
      sourceId: String(contact?.sourceId || "").trim(),
      name: String(contact?.name || "").trim(),
      role: String(contact?.role || "").trim(),
      roleFamily: String(contact?.roleFamily || "").trim(),
      municipality: String(contact?.municipality || "").trim(),
      phones: contactPhoneClaims(contact?.phone).map(claim => claim.value),
      emails: contactEmailClaims(contact?.email).map(claim => claim.value),
      addressNumbers: new Set(numericClaims(contact?.address).map(claim => claim.value)),
      checkedAt: String(contact?.verifiedAt || contact?.checkedAt || "").trim()
    }))
    .filter(contact => contact.sourceId && contact.name);
  const roleEntry = entry => ({
    municipality: String(entry?.municipality || "").trim(),
    label: String(entry?.label || "").trim(),
    count: Number(entry?.count)
  });
  const activeScopeRaw = raw.activeScope && typeof raw.activeScope === "object" ? raw.activeScope : null;
  const activeScopeSourceIds = new Set(
    (Array.isArray(activeScopeRaw?.sourceIds) ? activeScopeRaw.sourceIds : [])
      .map(value => String(value || "").trim())
      .filter(sourceId => contacts.some(contact => contact.sourceId === sourceId))
  );
  const rawSchedule = retrievalMeta?.serviceMapKovContactCheckSchedule;
  return {
    totalCount: Number.isInteger(Number(raw.totalCount)) ? Number(raw.totalCount) : contacts.length,
    municipalities: (Array.isArray(raw.municipalities) ? raw.municipalities : [])
      .map(entry => ({ name: String(entry?.name || "").trim(), count: Number(entry?.count) }))
      .filter(entry => entry.name && Number.isInteger(entry.count)),
    roles: (Array.isArray(raw.roles) ? raw.roles : [])
      .map(roleEntry)
      .filter(entry => entry.label && Number.isInteger(entry.count)),
    roleFamilies: (Array.isArray(raw.roleFamilies) ? raw.roleFamilies : [])
      .map(roleEntry)
      .filter(entry => entry.label && Number.isInteger(entry.count)),
    activeScope: activeScopeRaw ? {
      kind: String(activeScopeRaw.kind || "").trim() || "all",
      contextual: activeScopeRaw.contextual === true,
      count: Number.isInteger(Number(activeScopeRaw.count)) ? Number(activeScopeRaw.count) : activeScopeSourceIds.size,
      sourceIds: activeScopeSourceIds,
      roles: (Array.isArray(activeScopeRaw.roles) ? activeScopeRaw.roles : [])
        .map(roleEntry)
        .filter(entry => entry.label && Number.isInteger(entry.count)),
      roleFamilies: (Array.isArray(activeScopeRaw.roleFamilies) ? activeScopeRaw.roleFamilies : [])
        .map(roleEntry)
        .filter(entry => entry.label && Number.isInteger(entry.count)),
      requestedRoleFamilies: (Array.isArray(activeScopeRaw.requestedRoleFamilies) ? activeScopeRaw.requestedRoleFamilies : [])
        .map(roleEntry)
        .filter(entry => entry.label && Number.isInteger(entry.count))
    } : null,
    contacts,
    checkSchedule: rawSchedule && typeof rawSchedule === "object" ? {
      cadence: String(rawSchedule.cadence || "").trim().toLowerCase(),
      sourceId: String(rawSchedule.sourceId || "").trim()
    } : null
  };
}

function contactCheckCadenceClaims(value = "") {
  const normalized = normalizeText(value);
  const claims = [];
  if (/(?:^|[^\p{L}\p{N}])(?:kord\s+nadala\p{L}*|iga\s+nadal\p{L}*|once\s+(?:a|per)\s+week|every\s+week|weekly|раз\s+в\s+недел\p{L}*|кажд\p{L}*\s+недел\p{L}*|еженедельн\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized)) claims.push("weekly");
  if (/(?:^|[^\p{L}\p{N}])(?:iga\s+paev\p{L}*|kord\s+paevas|daily|every\s+day|ежедневн\p{L}*|кажд\p{L}*\s+день)(?=$|[^\p{L}\p{N}])/u.test(normalized)) claims.push("daily");
  if (/(?:^|[^\p{L}\p{N}])(?:kord\s+kuus|iga\s+kuu|monthly|every\s+month|ежемесячн\p{L}*|кажд\p{L}*\s+месяц)(?=$|[^\p{L}\p{N}])/u.test(normalized)) claims.push("monthly");
  return [...new Set(claims)];
}

function asksForContactCheckCadence(value = "") {
  const normalized = normalizeText(value);
  return /(?:^|[^\p{L}\p{N}])(?:kui\s+tihti|mis\s+sagedus\p{L}*|how\s+often|what\s+frequency|как\s+часто|с\s+какой\s+частот\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function contactLabelMentioned(value = "", label = "") {
  const expected = significantCategoryLabelTokens(label);
  if (!expected.length) return false;
  const actual = normalizeText(value).match(/[\p{L}]+/gu) || [];
  const required = expected.length === 1 ? 1 : Math.max(2, Math.ceil(expected.length * 0.6));
  return expected.filter(token => actual.some(candidate => categoryTokenMatches(token, candidate))).length >= required;
}

function contactRoleLabelMentioned(value = "", label = "") {
  return contactRoleTextMatches(value, label);
}

function contactTotalScopeMentioned(value = "") {
  const normalized = normalizeText(value);
  return /(?:^|[^\p{L}\p{N}])(?:kontakt\p{L}*|kontaktikirj\p{L}*|nimekirj\p{L}*|teenusekaart\p{L}*|contact\p{L}*|record\p{L}*|public\s+list\p{L}*|контакт\p{L}*|контактн\p{L}*\s+запис\p{L}*|список\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function contactCountWorkforceClaim(value = "") {
  const normalized = normalizeText(value);
  return /(?:^|[^\p{L}\p{N}])(?:tootab\p{L}*|tootaj\p{L}*|inime\p{L}*|personali\p{L}*|headcount|employee\p{L}*|staff|people|work\p{L}*|сотрудник\p{L}*|работа\p{L}*|человек\p{L}*|штат\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function contactCountExplicitlyDistinguished(value = "") {
  const normalized = normalizeText(value);
  return /(?:kontakt\p{L}*|contact\p{L}*|контакт\p{L}*)[\s\S]{0,90}(?:mitte|ei\s+ole|not|isn'?t|не\s+(?:является|означает))[\s\S]{0,90}(?:personali\p{L}*|tootaj\p{L}*|headcount|employee\p{L}*|staff|сотрудник\p{L}*|штат\p{L}*)/u.test(normalized);
}

function contactTotalClaimScopeSupported(value = "") {
  if (!contactTotalScopeMentioned(value)) return false;
  return !contactCountWorkforceClaim(value) || contactCountExplicitlyDistinguished(value);
}

function asksForCombinedContactTotal(message = "") {
  const normalized = normalizeText(message);
  return /(?:^|[^\p{L}\p{N}])(?:kokku|uhtekokku|combined|in\s+total|altogether|итого|всего)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function asksForCompleteContactList(message = "") {
  const normalized = normalizeText(message);
  const asksWhoTheyAre = /(?:^|[^\p{L}\p{N}])(?:kes\s+(?:nad|need)\s+on|mis\s+on\s+(?:(?:nende|kontakt\p{L}*)\s+)?(?:nimed|rollid|ametinimetused)|kontakt\p{L}*\s+nimed|(?:nende|neil)\s+(?:nimed|rollid|ametinimetused)|who\s+(?:are\s+)?they|what\s+are\s+(?:(?:their|contact\p{L}*)\s+)?(?:names|roles|job\s+titles)|contact\p{L}*\s+names|their\s+(?:names|roles|job\s+titles)|кто\s+они|как\s+их\s+зовут|какие\s+у\s+них\s+должности|имена\s+контакт\p{L}*|их\s+(?:имена|должности))(?=$|[^\p{L}\p{N}])/u.test(normalized);
  if (asksWhoTheyAre) return true;
  const contactCue = /(?:^|[^\p{L}\p{N}])(?:kontakt\p{L}*|tootaj\p{L}*|sotsiaaltootaj\p{L}*|spetsialist\p{L}*|ametnik\p{L}*|sotsiaalosakon\p{L}*|contact\p{L}*|employee\p{L}*|staff|specialist\p{L}*|social\s+department\p{L}*|контакт\p{L}*|сотрудник\p{L}*|специалист\p{L}*|социальн\p{L}*\s+отдел\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  const explicitAll = /(?:^|[^\p{L}\p{N}])(?:koik|kogu\s+nimekir\p{L}*|loetle\p{L}*|nimeta\p{L}*|naita\p{L}*|millise\p{L}*|list\s+all|list|name\p{L}*|show\p{L}*|which|all\s+(?:the\s+)?(?:contact\p{L}*|employee\p{L}*|staff|specialist\p{L}*)|перечисл\p{L}*|назов\p{L}*|покаж\p{L}*|какие|все)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  return contactCue && explicitAll;
}

function contactAnswerIntent(message = "") {
  const normalized = normalizeText(message);
  const contactSubject = /(?:^|[^\p{L}\p{N}])(?:kontakt\p{L}*|tootaj\p{L}*|sotsiaaltootaj\p{L}*|spetsialist\p{L}*|ametnik\p{L}*|sotsiaalosakon\p{L}*|contact\p{L}*|employee\p{L}*|staff|social\s+worker\p{L}*|specialist\p{L}*|official\p{L}*|social\s+department\p{L}*|контакт\p{L}*|сотрудник\p{L}*|работник\p{L}*|специалист\p{L}*|социальн\p{L}*\s+отдел\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  const wantsContactCount = contactSubject && /(?:^|[^\p{L}\p{N}])(?:mitu|kui\s+palju|arv\p{L}*|koguarv\p{L}*|uldarv\p{L}*|how\s+many|number\s+of|contact\s+count|staff\s+count|сколько|число|количество)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  const wantsPresence = contactSubject && /(?:^|[^\p{L}\p{N}])(?:kas|on|olemas|leidub|tootab\p{L}*|do|does|has|have|is|are|exists?|available|works?|working|есть|имеется|работает|работают)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  return {
    wantsPhone: /(?:^|[^\p{L}\p{N}])(?:telefon\p{L}*|phone\p{L}*|телефон\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized),
    wantsEmail: /(?:^|[^\p{L}\p{N}])(?:e-post\p{L}*|epost\p{L}*|e-mail\p{L}*|email\p{L}*|meiliaadress\p{L}*|mail\s+address\p{L}*|почт\p{L}*|электронн\p{L}*\s+почт\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized),
    wantsContactDetails: /(?:^|[^\p{L}\p{N}])(?:kontaktandm\p{L}*|kontaktinfo\p{L}*|contact\s+(?:details?|information)|контактн\p{L}*\s+(?:данн\p{L}*|информац\p{L}*))(?=$|[^\p{L}\p{N}])/u.test(normalized),
    wantsIdentity: /(?:^|[^\p{L}\p{N}])(?:kes|kelle\s+poole|millise\p{L}*|nimeta\p{L}*|loetle\p{L}*|naita\p{L}*|kontakt\p{L}*\s+nimed|(?:nende|neil)\s+(?:nimed|rollid|ametinimetused)|mis\s+on\s+nende\s+(?:nimed|rollid|ametinimetused)|who|which|name\p{L}*|list\p{L}*|show\p{L}*|contact\p{L}*\s+names|their\s+(?:names|roles|job\s+titles)|what\s+are\s+their\s+(?:names|roles|job\s+titles)|кто|какие|назов\p{L}*|перечисл\p{L}*|покаж\p{L}*|имена\s+контакт\p{L}*|как\s+их\s+зовут|какие\s+у\s+них\s+должности|их\s+(?:имена|должности))(?=$|[^\p{L}\p{N}])/u.test(normalized),
    wantsFreshness: /(?:^|[^\p{L}\p{N}])(?:varsk\p{L}*|ajakohas\p{L}*|kontrolli\p{L}*|kontrollit\p{L}*|kontrollkuupaev\p{L}*|millal\s+kontroll|kui\s+tihti|fresh\p{L}*|up\s+to\s+date|verif(?:y|ied|ication)\p{L}*|check\p{L}*|last\s+check\p{L}*|how\s+often|актуальн\p{L}*|свеж\p{L}*|провер\p{L}*|как\s+часто)(?=$|[^\p{L}\p{N}])/u.test(normalized),
    wantsContactCount,
    wantsPresence
  };
}

function contactAnswerIntentRequested(message = "") {
  return Object.values(contactAnswerIntent(message)).some(Boolean);
}

function asksForPluralContactValues(message = "", answerIntent = {}) {
  if (!answerIntent.wantsPhone && !answerIntent.wantsEmail && !answerIntent.wantsContactDetails) return false;
  const normalized = normalizeText(message);
  return /(?:^|[^\p{L}\p{N}])(?:(?:nende|neil|need|neid)\p{L}*[^.!?]{0,50}(?:telefonid|telefoninumbrid|e-postid|epostid|kontaktandmed)|(?:telefonid|telefoninumbrid|e-postid|epostid|kontaktandmed)[^.!?]{0,50}(?:nende|neil|need|neid)\p{L}*|their\s+(?:phones|phone\s+numbers|emails|e-mail\s+addresses|contact\s+details)|(?:these|those)\s+contacts?[^.!?]{0,40}(?:phones|emails|details)|их\s+(?:телефоны|номера\s+телефонов|адреса\s+электронной\s+почты|контактные\s+данные))(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function contactKnownNamesInItem(item = "", contacts = []) {
  const normalized = normalizeText(item);
  return contacts.filter(contact => normalized.includes(normalizeText(contact.name)));
}

function contactTupleRelationFailures(reply = "", claims = [], contacts = [], valueKey = "phones", targetSourceIds = null) {
  const unsupported = [];
  const mismatched = [];
  const implicitTarget = targetSourceIds?.size === 1
    ? contacts.find(contact => targetSourceIds.has(contact.sourceId)) || null
    : null;
  for (const claim of claims) {
    const owners = contacts.filter(contact => contact[valueKey].includes(claim.value));
    if (!owners.length) {
      unsupported.push(claim.value);
      continue;
    }
    const segmentOwner = nearestContactOwnerAtIndex(reply, claim.index, contacts) || implicitTarget;
    const targetMismatch = targetSourceIds?.size && !targetSourceIds.has(segmentOwner?.sourceId);
    if (!segmentOwner || targetMismatch || !owners.some(owner => owner.sourceId === segmentOwner.sourceId)) {
      mismatched.push(claim.value);
    }
  }
  return { unsupported, mismatched };
}

function escapeRegex(value = "") {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function contactNameOccurrences(bounds = {}, contacts = []) {
  const item = String(bounds?.text || "");
  const occurrences = [];
  for (const contact of contacts) {
    if (!contact?.name) continue;
    const pattern = new RegExp(escapeRegex(contact.name), "giu");
    for (const match of item.matchAll(pattern)) {
      occurrences.push({
        contact,
        index: Number(bounds?.start || 0) + (match.index || 0),
        end: Number(bounds?.start || 0) + (match.index || 0) + String(match[0] || "").length
      });
    }
  }
  return occurrences.sort((left, right) => left.index - right.index || left.end - right.end);
}

function nearestContactOwnerAtIndex(reply = "", index = 0, contacts = []) {
  const bounds = contactItemBoundsAroundIndex(reply, index, contacts);
  const occurrences = contactNameOccurrences(bounds, contacts);
  const preceding = occurrences.filter(entry => entry.index <= index).at(-1);
  if (preceding) return preceding.contact;
  return occurrences.length === 1 ? occurrences[0].contact : null;
}

function roleEntrySupportedForContact(entry = {}, contact = {}, contacts = []) {
  if (entry.municipality && normalizeText(entry.municipality) !== normalizeText(contact.municipality)) return false;
  const entryLabel = normalizeText(entry.label);
  const ownRole = normalizeText(contact.role);
  const ownFamily = normalizeText(contact.roleFamily);
  if (entryLabel === ownRole || entryLabel === ownFamily) return true;
  const entryFamilies = new Set(contacts
    .filter(candidate => normalizeText(candidate.role) === entryLabel || normalizeText(candidate.roleFamily) === entryLabel)
    .map(candidate => normalizeText(candidate.roleFamily))
    .filter(Boolean));
  return Boolean(ownFamily && entryFamilies.has(ownFamily));
}

function contactRoleRelationFailures(reply = "", evidence = null) {
  if (!evidence) return [];
  const roleEntries = [...evidence.roles, ...evidence.roleFamilies];
  const failures = [];
  for (const contact of evidence.contacts) {
    const namePattern = new RegExp(escapeRegex(contact.name), "giu");
    for (const match of String(reply || "").matchAll(namePattern)) {
      const matchIndex = match.index || 0;
      const bounds = contactItemBoundsAroundIndex(reply, matchIndex, evidence.contacts);
      const occurrences = contactNameOccurrences(bounds, evidence.contacts);
      const nextContact = occurrences.find(entry => entry.index > matchIndex);
      const item = occurrences.length === 1
        ? bounds.text
        : String(reply || "").slice(matchIndex, nextContact?.index || bounds.end);
      const claimedRoles = roleEntries.filter(entry => contactRoleLabelMentioned(item, entry.label));
      if (!claimedRoles.length) continue;
      const relationSupported = claimedRoles.every(entry =>
        roleEntrySupportedForContact(entry, contact, evidence.contacts)
      );
      if (!relationSupported) failures.push(contact.name);
    }
  }
  return [...new Set(failures)];
}

function missingRequiredContactRoles(reply = "", requiredContacts = [], evidence = null) {
  if (!evidence) return [];
  const roleEntries = [...evidence.roles, ...evidence.roleFamilies];
  const missing = [];
  for (const contact of requiredContacts) {
    if (!contact?.name || !contact?.role || normalizeText(contact.role) === "roll markimata") continue;
    const namePattern = new RegExp(escapeRegex(contact.name), "giu");
    const occurrences = [...String(reply || "").matchAll(namePattern)];
    if (!occurrences.length) continue;
    const hasOwnRole = occurrences.some(match => {
      const bounds = contactItemBoundsAroundIndex(reply, match.index || 0, evidence.contacts);
      return roleEntries.some(entry =>
        contactRoleLabelMentioned(bounds.text, entry.label) &&
        roleEntrySupportedForContact(entry, contact, evidence.contacts)
      );
    });
    if (!hasOwnRole) missing.push(contact.name);
  }
  return [...new Set(missing)];
}

function unexpectedContactPersonClaims(reply = "", evidence = null, allowedContacts = null) {
  if (!evidence) return [];
  const allowed = Array.isArray(allowedContacts) ? allowedContacts : evidence.contacts;
  const knownNames = allowed.map(contact => normalizeText(contact.name)).filter(Boolean);
  const roleLabels = [...evidence.roles, ...evidence.roleFamilies].map(entry => entry.label);
  const municipalityNames = evidence.municipalities.map(entry => normalizeText(entry.name));
  const unexpected = [];
  for (const line of String(reply || "").split(/[\r\n]+/u)) {
    let cleaned = line.replace(/[*_`]/gu, " ");
    for (const contact of allowed) {
      if (!contact?.name) continue;
      cleaned = cleaned.replace(new RegExp(escapeRegex(contact.name), "giu"), " ");
    }
    for (const match of cleaned.matchAll(/(?:^|[^\p{L}])([\p{Lu}][\p{L}'’.-]*(?:\s+[\p{Lu}][\p{L}'’.-]*){1,3})(?=$|[^\p{L}])/gu)) {
      const fullCandidate = String(match[1] || "").trim();
      const normalizedFullCandidate = normalizeText(fullCandidate);
      if (!normalizedFullCandidate || knownNames.some(name => normalizedFullCandidate.includes(name))) continue;
      if (/(?:^|\s)(?:the\s+)?service\s+map(?:$|\s)/u.test(normalizedFullCandidate)) continue;
      const candidate = fullCandidate.split(/\s+/u).slice(0, 2).join(" ");
      const normalizedCandidate = normalizeText(candidate);
      if (municipalityNames.some(name => normalizedCandidate.includes(name))) continue;
      if (roleLabels.some(label => contactRoleLabelMentioned(candidate, label))) continue;
      if (/(?:linnavalitsus|vallavalitsus|sotsiaalosakond|teenusekaart|kontakt|allikas|source|municipal|social\s+department|источник|муниципал)/u.test(normalizedCandidate)) continue;
      unexpected.push(candidate);
    }
  }
  return [...new Set(unexpected)];
}

function contactCountClaimSupported(message = "", reply = "", claim = {}, evidence = null) {
  if (!evidence || claim.percentage) return false;
  const sentence = sentenceAroundIndex(reply, claim.index || 0);
  if (
    ["subset", "known_zero"].includes(evidence.activeScope?.kind) &&
    claim.numeric === evidence.activeScope.count &&
    contactTotalClaimScopeSupported(sentence) &&
    (
      evidence.activeScope.contextual ||
      [
        ...evidence.activeScope.roles,
        ...evidence.activeScope.roleFamilies,
        ...evidence.activeScope.requestedRoleFamilies
      ]
        .some(entry => contactRoleLabelMentioned(sentence, entry.label))
    )
  ) {
    return true;
  }
  const municipalityCounts = evidence.municipalities.length
    ? evidence.municipalities
    : [{ name: "", count: evidence.totalCount }];
  if (asksForCombinedContactTotal(message) && claim.numeric === evidence.totalCount && contactTotalClaimScopeSupported(sentence)) {
    return true;
  }
  if (municipalityCounts.some(entry =>
    claim.numeric === entry.count &&
    contactTotalClaimScopeSupported(sentence) &&
    (municipalityCounts.length === 1 || contactLabelMentioned(sentence, entry.name))
  )) {
    return true;
  }
  return [...evidence.roles, ...evidence.roleFamilies].some(entry =>
    claim.numeric === entry.count &&
    contactRoleLabelMentioned(sentence, entry.label) &&
    (!contactCountWorkforceClaim(sentence) || contactTotalScopeMentioned(sentence) || contactCountExplicitlyDistinguished(sentence)) &&
    (municipalityCounts.length === 1 || contactLabelMentioned(sentence, entry.municipality))
  );
}

function requestedContactRoleCounts(message = "", evidence = null) {
  if (!evidence) return [];
  if (evidence.activeScope?.contextual) return [];
  const requestedFamilies = (Array.isArray(evidence.activeScope?.requestedRoleFamilies)
    ? evidence.activeScope.requestedRoleFamilies
    : []).filter(entry => contactRoleLabelMentioned(message, entry.label));
  if (requestedFamilies.length) return requestedFamilies;
  const matchedFamilies = evidence.roleFamilies.filter(entry => contactRoleLabelMentioned(message, entry.label));
  if (matchedFamilies.length) return matchedFamilies;
  return evidence.roles.filter(entry => contactRoleLabelMentioned(message, entry.label));
}

function contactRoleCountSeen(reply = "", claims = [], entry = {}) {
  return claims.some(claim => {
    if (claim.numeric !== entry.count) return false;
    const sentence = sentenceAroundIndex(reply, claim.index || 0);
    return contactRoleLabelMentioned(sentence, entry.label) &&
      (!contactCountWorkforceClaim(sentence) || contactTotalScopeMentioned(sentence) || contactCountExplicitlyDistinguished(sentence));
  });
}

function contactAuxiliaryNumericClaimSupported(reply = "", claim = {}, evidence = null) {
  const sentence = sentenceAroundIndex(reply, claim.index || 0);
  if (claim.year) {
    const checkedYears = new Set(evidence.contacts
      .map(contact => Number(contact.checkedAt.slice(0, 4)))
      .filter(year => Number.isInteger(year)));
    return checkedYears.has(claim.numeric) && /(?:kontroll|varsk|verified|checked|провер\p{L}*)/u.test(normalizeText(sentence));
  }
  return evidence.contacts.some(contact =>
    contact.addressNumbers.has(claim.value) &&
    (normalizeText(sentence).includes(normalizeText(contact.name)) || /(?:aadress|address|адрес)/u.test(normalizeText(sentence)))
  );
}

function isMunicipalityContactInventory(retrievalMeta = null) {
  const queryPlan = retrievalMeta?.queryPlan && typeof retrievalMeta.queryPlan === "object"
    ? retrievalMeta.queryPlan
    : {};
  const mode = String(queryPlan?.mode || queryPlan?.queryPlanMode || "").trim();
  const strategy = String(queryPlan?.selection_strategy || queryPlan?.selectionStrategy || "").trim();
  return mode === "municipality_contact_list" || strategy === "municipality_contact_inventory";
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

const CALENDAR_MONTH_PATTERNS = Object.freeze([
  /\b(?:jaanuar\p{L}*|january|январ\p{L}*)\b/u,
  /\b(?:veebruar\p{L}*|february|феврал\p{L}*)\b/u,
  /\b(?:marts\p{L}*|march|март\p{L}*)\b/u,
  /\b(?:aprill\p{L}*|april|апрел\p{L}*)\b/u,
  /\b(?:mai\p{L}*|may|ма[йя]\p{L}*)\b/u,
  /\b(?:juuni\p{L}*|june|июн\p{L}*)\b/u,
  /\b(?:juuli\p{L}*|july|июл\p{L}*)\b/u,
  /\b(?:august\p{L}*|август\p{L}*)\b/u,
  /\b(?:septembr\p{L}*|сентябр\p{L}*)\b/u,
  /\b(?:oktoobr\p{L}*|october|октябр\p{L}*)\b/u,
  /\b(?:novembr\p{L}*|ноябр\p{L}*)\b/u,
  /\b(?:detsembr\p{L}*|december|декабр\p{L}*)\b/u
]);

function calendarDateClaimSupportedByEquivalentWording(reply = "", claim = {}, source = {}) {
  if (claim.percentage || claim.year || !Number.isInteger(claim.numeric) || claim.numeric < 1 || claim.numeric > 31) {
    return false;
  }
  const claimIndex = Math.max(0, claim.index || 0);
  const replySentence = normalizeText(String(reply || "").slice(
    Math.max(0, claimIndex - 4),
    Math.min(String(reply || "").length, claimIndex + 96)
  ));
  const monthIndex = CALENDAR_MONTH_PATTERNS.findIndex(pattern => pattern.test(replySentence));
  if (monthIndex < 0) return false;
  const dayPattern = new RegExp(`(?<![\\p{L}\\d])${claim.numeric}\\.?\\s+`, "u");
  if (!dayPattern.test(replySentence)) return false;
  const replyYears = numericClaims(replySentence).filter(item => item.year).map(item => item.value);
  if (!replyYears.length) return false;

  const day = String(claim.numeric).padStart(2, "0");
  const month = String(monthIndex + 1).padStart(2, "0");
  return replyYears.some(year => new RegExp(
    `(?<!\\d)0?${day.replace(/^0/u, "")}[-./]0?${month.replace(/^0/u, "")}[-./]${year}(?!\\d)`,
    "u"
  ).test(source.body));
}

function numericDateClaimSupportedByEquivalentFormatting(reply = "", claim = {}, source = {}) {
  if (claim.percentage || claim.year) return false;
  const claimIndex = Math.max(0, claim.index || 0);
  const localReply = String(reply || "").slice(
    claimIndex,
    Math.min(String(reply || "").length, claimIndex + 32)
  );
  const fullNumericDate = localReply.match(/^(\d{1,2})[-./](\d{1,2})[-./]((?:19|20)\d{2})(?!\d)/u);
  if (fullNumericDate) {
    const day = Number(fullNumericDate[1]);
    const month = Number(fullNumericDate[2]);
    const year = fullNumericDate[3];
    if (
      [day, month].includes(claim.numeric) &&
      new RegExp(`(?<!\\d)0?${day}[-./]0?${month}[-./]${year}(?!\\d)`, "u").test(source.body)
    ) return true;
  }

  const datePrefix = String(claim.value || "").match(/^(\d{1,2})[.]([0-1]?\d)$/u);
  if (!datePrefix) return false;
  const replyYears = numericClaims(localReply).filter(item => item.year).map(item => item.value);
  if (!replyYears.length) return false;
  const day = Number(datePrefix[1]);
  const month = Number(datePrefix[2]);
  if (!Number.isInteger(day) || day < 1 || day > 31 || !Number.isInteger(month) || month < 1 || month > 12) {
    return false;
  }
  return replyYears.some(year => new RegExp(
    `(?<!\\d)0?${day}[-./]0?${month}[-./]${year}(?!\\d)`,
    "u"
  ).test(source.body));
}

function numericClaimSupportedBySource(reply = "", claim = {}, source = {}) {
  return source.allNumbers.has(claim.value) ||
    durationClaimSupportedByEquivalentWording(reply, claim, source) ||
    calendarDateClaimSupportedByEquivalentWording(reply, claim, source) ||
    numericDateClaimSupportedByEquivalentFormatting(reply, claim, source);
}

const CATEGORY_LABEL_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "consisted", "for", "from", "in", "included", "is", "of", "on", "or", "participated", "the", "to", "was", "were", "who", "with",
  "et", "iga", "ja", "kaasati", "kes", "koosnes", "kokku", "kui", "mida", "mis", "moodustas", "ning", "oli", "olid", "olema", "olnud", "oma", "on", "osaleb", "osales", "total", "voi",
  "был", "была", "были", "быть", "в", "включал", "включала", "включали", "всего", "есть", "и", "из", "или", "итого", "к", "как", "которые", "на", "по", "с", "состоял", "состояла", "состояло", "участвовал", "участвовали"
]);

const CATEGORY_LABEL_GENERIC_PREFIXES = [
  "group", "inime", "isik", "osalej", "participant", "person", "ruhm", "sihtruhm",
  "sample", "study", "uuring", "valim", "выборк", "групп", "исслед", "участник", "человек"
];

const CATEGORY_NUMBER_TOKEN_SOURCE = String.raw`(?:\d{1,3}(?:[ .]\d{3})+|\d+(?:[.,]\d+)?|null|uks|uht|uhe|kaks|kaht|kahe|kolm|kolme|neli|nelja|viis|viit|viie|kuus|kuut|kuue|seitse|seitset|seitsme|kaheksa|uheksa|kumme|kummet|one|two|three|four|five|six|seven|eight|nine|ten|один|одна|одно|одного|одной|одному|одним|одну|два|две|двух|двум|двумя|три|трех|трем|тремя|четыре|четырех|четырем|четырьмя|пять|пяти|пятью|шесть|шести|шестью|семь|семи|семью|восемь|восьми|восемью|девять|девяти|девятью|десять|десяти|десятью)`;

const PARTICIPANT_UNIT_SOURCE = String.raw`(?:inim\p{L}*|isik\p{L}*|osalej\p{L}*|vastaj\p{L}*|praktik\p{L}*|kohtunik\p{L}*|sotsiaaltootaj\p{L}*|tootaj\p{L}*|people|persons?|participants?|respondents?|practitioners?|judges?|workers?|social\s+workers?|человек\p{L}*|люд\p{L}*|лиц\p{L}*|участник\p{L}*|респондент\p{L}*|практик\p{L}*|суд(?:ья|ьи|ей|ье|ью|ьям|ьями|ьях)\p{L}*|работник\p{L}*|сотрудник\p{L}*)`;

function parsedCategoryNumberValue(value = "") {
  const normalized = normalizeText(value);
  const claim = normalizedNumericClaims(normalized).find(item => !item.year);
  if (claim) return claim.value;
  return NON_EST_SMALL_NUMBER_VALUES.get(normalized) || null;
}

function alignedCategoryNumericClaims(value = "") {
  const normalized = normalizeText(value);
  const claims = [];
  const pattern = new RegExp(
    `(?<![\\p{L}\\d])(${CATEGORY_NUMBER_TOKEN_SOURCE})(?=$|[^\\p{L}\\d])`,
    "gu"
  );
  for (const match of normalized.matchAll(pattern)) {
    const numberValue = parsedCategoryNumberValue(match[1]);
    const numeric = Number(numberValue);
    if (!numberValue || !Number.isFinite(numeric)) continue;
    claims.push({
      value: numberValue,
      numeric,
      year: Number.isInteger(numeric) && numeric >= YEAR_MIN && numeric <= YEAR_MAX,
      index: match.index || 0
    });
  }
  return claims;
}

function significantCategoryLabelTokens(value = "") {
  return (normalizeText(value).match(/[\p{L}]+/gu) || [])
    .filter(token => token.length >= 4)
    .filter(token => !CATEGORY_LABEL_STOP_WORDS.has(token))
    .filter(token => !CATEGORY_LABEL_GENERIC_PREFIXES.some(prefix => token.startsWith(prefix)));
}

const CATEGORY_ENTITY_FAMILY_PATTERNS = [
  ["person", /^(?:inim\p{L}*|isik\p{L}*|people|persons?|человек\p{L}*|люд\p{L}*|лиц\p{L}*)$/u],
  ["volunteer", /^(?:vabatahtlik\p{L}*|volunteers?|добровол\p{L}*)$/u],
  ["court", /^(?:kohus\p{L}*|kohtu\p{L}*|maakoh\p{L}*|courts?|суд\p{L}*)$/u],
  ["institution", /^(?:asutus\p{L}*|asutuse\p{L}*|erihoolekandeasut\p{L}*|institutions?|учрежд\p{L}*)$/u],
  ["municipality", /^(?:omavalits\p{L}*|kov|municipalit\p{L}*|муниципал\p{L}*)$/u],
  ["city", /^(?:linn\p{L}*|cities|city|город\p{L}*)$/u],
  ["parish", /^(?:vald\p{L}*|parishes|parish|волост\p{L}*)$/u],
  ["county", /^(?:maakond(?:a|i|ade(?:sse|s|st|le|l|lt|ks|ni|na|ta|ga)?)?|maakonna(?:d|sse|s|st|le|l|lt|ks|ni|na|ta|ga)?|counties|county|уезд\p{L}*)$/u],
  ["region", /^(?:piirkond\p{L}*|regions?|регион\p{L}*|район\p{L}*)$/u],
  ["location", /^(?:asukoht\p{L}*|locations?|мест\p{L}*)$/u],
  ["organization", /^(?:organisatsioon\p{L}*|organi[sz]ations?|организац\p{L}*)$/u],
  ["association", /^(?:uhing\p{L}*|associations?|объединен\p{L}*)$/u],
  ["unit", /^(?:uksus\p{L}*|units?|подразделен\p{L}*)$/u],
  ["school", /^(?:kool\p{L}*|schools?|школ\p{L}*)$/u],
  ["hospital", /^(?:haigla\p{L}*|hospitals?|больниц\p{L}*)$/u],
  ["service", /^(?:teenus\p{L}*|services?|услуг\p{L}*)$/u],
  ["training", /^(?:koolitus\p{L}*|trainings?|обучен\p{L}*)$/u],
  ["source", /^(?:allik\p{L}*|sources?|источник\p{L}*)$/u],
  ["article", /^(?:artikkel\p{L}*|articles?|стат\p{L}*)$/u],
  ["document", /^(?:dokum\p{L}*|documents?|документ\p{L}*)$/u],
  ["country", /^(?:riik\p{L}*|countries|country|стран\p{L}*)$/u],
  ["round", /^(?:voor\p{L}*|rounds?|раунд\p{L}*)$/u],
  ["stage", /^(?:etapp\p{L}*|stages?|этап\p{L}*)$/u],
  ["phase", /^(?:faas\p{L}*|phases?|фаз\p{L}*)$/u],
  ["interview", /^(?:intervjuu\p{L}*|interviews?|интервью\p{L}*)$/u],
  ["question", /^(?:kusimus\p{L}*|questions?|вопрос\p{L}*)$/u],
  ["method", /^(?:meetod\p{L}*|methods?|метод\p{L}*)$/u],
  ["topic", /^(?:teema\p{L}*|topics?|тем\p{L}*)$/u],
  ["case", /^(?:juhtum\p{L}*|cases?|случа\p{L}*)$/u],
  ["year", /^(?:aasta\p{L}*|years?|год\p{L}*)$/u],
  ["occurrence", /^(?:kord\p{L}*|times?|раз\p{L}*)$/u],
  ["minute", /^(?:minut\p{L}*|minutes?|минут\p{L}*)$/u],
  ["hour", /^(?:(?:too)?(?:tund(?:i|e|ide(?:sse|s|st|le|l|lt|ks|ni|na|ta|ga)?)?|tunni(?:d|sse|s|st|le|l|lt|ks|ni|na|ta|ga)?)|hours?|час\p{L}*)$/u],
  ["day", /^(?:paev\p{L}*|days?|дн\p{L}*)$/u],
  ["week", /^(?:nadal\p{L}*|weeks?|недел\p{L}*)$/u],
  ["month", /^(?:kuu\p{L}*|months?|месяц\p{L}*)$/u],
  ["money", /^(?:euro\p{L}*|euros?|евро\p{L}*)$/u]
];

function categoryEntityFamily(value = "") {
  const normalized = normalizeText(value);
  return CATEGORY_ENTITY_FAMILY_PATTERNS.find(([, pattern]) => pattern.test(normalized))?.[0] || null;
}

function categoryTokenMatches(left = "", right = "") {
  if (left === right) return true;
  const leftEntityFamily = categoryEntityFamily(left);
  const rightEntityFamily = categoryEntityFamily(right);
  if (leftEntityFamily && leftEntityFamily === rightEntityFamily) return true;
  const prefixLength = Math.min(7, left.length, right.length);
  return prefixLength >= 5 && left.slice(0, prefixLength) === right.slice(0, prefixLength);
}

function containsCategoryNumber(value = "") {
  return new RegExp(`(?:^|[^\\p{L}\\d])${CATEGORY_NUMBER_TOKEN_SOURCE}(?=$|[^\\p{L}\\d])`, "u")
    .test(normalizeText(value));
}

function splitNumericCategorySegments(value = "") {
  const segments = [];
  // A comma before a complement clause belongs to the same fact relation:
  // "61% hooldajatest leidis, et ..." must not degrade into the label "leidis".
  for (const part of String(value || "").split(
    /;|(?:(?<!\d)[.]|[.](?!\d))|(?:(?<!\d),|,(?!\d))(?!\s*(?:et|that|что)(?=$|[^\p{L}]))/iu
  )) {
    const conjunctions = [...part.matchAll(/\s+(?:ja|ning|and|и)\s+|\s*:\s*/gu)];
    let start = 0;
    for (const conjunction of conjunctions) {
      const left = part.slice(start, conjunction.index || 0);
      const right = part.slice((conjunction.index || 0) + String(conjunction[0] || "").length);
      if (!containsCategoryNumber(left) || !containsCategoryNumber(right)) continue;
      segments.push(left);
      start = (conjunction.index || 0) + String(conjunction[0] || "").length;
    }
    segments.push(part.slice(start));
  }
  return segments.map(segment => segment.trim()).filter(Boolean);
}

function numericCategoryScope(value = "") {
  const normalized = normalizeText(value);
  const totalCue = /(?:^|[^\p{L}])(?:kokku|koguarv\p{L}*|uldarv\p{L}*|in\s+total|total|altogether|всего|итого)(?=$|[^\p{L}])/u.test(normalized);
  const wholeSampleCue = /(?:^|[^\p{L}])(?:valim\p{L}*|uuring\p{L}*|sample\p{L}*|study|выборк\p{L}*|исслед\p{L}*)(?=$|[^\p{L}])/u.test(normalized);
  return { explicitTotal: totalCue, wholeSample: wholeSampleCue };
}

function categorySemanticTokens(value = "") {
  return (normalizeText(value).match(/[\p{L}]+/gu) || [])
    .filter(token => !CATEGORY_LABEL_STOP_WORDS.has(token))
    .filter(token => !["altogether", "koguarv", "uldarv"].some(prefix => token.startsWith(prefix)));
}

function isEntityCoverageCategoryLabel(value = "") {
  const normalized = normalizeText(value);
  const groupCue = uniformGroupCue(normalized);
  const prefixTokens = groupCue
    ? significantCategoryLabelTokens(normalized.slice(0, groupCue.index || 0))
    : [];
  const tokens = categorySemanticTokens(value);
  const finalToken = prefixTokens.at(-1) || tokens.at(-1) || "";
  const precedingTokens = (prefixTokens.length ? prefixTokens : tokens).slice(0, -1);
  const hasLeadingEntityScope = precedingTokens.some(token =>
    /^(?:kohus\p{L}*|kohtu\p{L}*|maakoh\p{L}*|asutus\p{L}*|asutuse\p{L}*|erihoolekandeasut\p{L}*|omavalits\p{L}*|kov|linn\p{L}*|vald\p{L}*|maakond\p{L}*|piirkond\p{L}*|asukoht\p{L}*|organisatsioon\p{L}*|uhing\p{L}*|uksus\p{L}*|courts?|institutions?|municipalit\p{L}*|authorit\p{L}*|cities|city|counties|county|regions?|locations?|organi[sz]ations?)$/u.test(token)
  );
  const estonianPluralRolePattern = /^(?:inimesed|isikud|kohtunikud|osalejad|praktikud|sotsiaaltootajad|tootajad|vastajad)$/u;
  const estonianPluralRoleInLabel = (prefixTokens.length ? prefixTokens : tokens)
    .some(token => estonianPluralRolePattern.test(token));
  const hasEntityRoleSeparator = /(?:\s[-–—]\s|:)/u.test(normalized);
  if (hasLeadingEntityScope && (hasEntityRoleSeparator || estonianPluralRoleInLabel)) {
    return true;
  }
  return /^(?:kohus\p{L}*|kohtu\p{L}*|maakoh\p{L}*|asutus\p{L}*|asutuse\p{L}*|erihoolekandeasut\p{L}*|omavalits\p{L}*|kov|linn\p{L}*|vald\p{L}*|maakond\p{L}*|piirkond\p{L}*|asukoht\p{L}*|organisatsioon\p{L}*|uhing\p{L}*|uksus\p{L}*|kool\p{L}*|haigla\p{L}*|teenus\p{L}*|koolitus\p{L}*|allik\p{L}*|artikkel\p{L}*|dokum\p{L}*|aasta\p{L}*|protsent\p{L}*|riik\p{L}*|voor\p{L}*|etapp\p{L}*|faas\p{L}*|intervjuu\p{L}*|kusimus\p{L}*|meetod\p{L}*|teema\p{L}*|juhtum\p{L}*|kord\p{L}*|minut\p{L}*|tund\p{L}*|paev\p{L}*|nadal\p{L}*|kuu\p{L}*|euro\p{L}*|courts?|institutions?|municipalit\p{L}*|authorit\p{L}*|cities|city|counties|county|regions?|locations?|organi[sz]ations?|schools?|hospitals?|services?|trainings?|sources?|articles?|documents?|years?|countries|country|rounds?|stages?|phases?|interviews?|questions?|methods?|topics?|cases?|times?|minutes?|hours?|days?|weeks?|months?|euros?|суд(?:ы|а|ов|ам|ами|ах)\p{L}*|учрежд\p{L}*|муниципал\p{L}*|город\p{L}*|район\p{L}*|регион\p{L}*|мест\p{L}*|организац\p{L}*|школ\p{L}*|больниц\p{L}*|услуг\p{L}*|обучен\p{L}*|источник\p{L}*|стат\p{L}*|документ\p{L}*|год\p{L}*|стран\p{L}*|этап\p{L}*|фаз\p{L}*|интервью\p{L}*|вопрос\p{L}*|метод\p{L}*|тем\p{L}*|случа\p{L}*|минут\p{L}*|час\p{L}*|дн\p{L}*|недел\p{L}*|месяц\p{L}*|евро\p{L}*)$/u.test(finalToken);
}

function extractNumericCategoryLabels(value = "") {
  const labels = [];
  for (const line of String(value || "").split(/[\r\n]+/u)) {
    for (const segment of splitNumericCategorySegments(line)) {
      const normalizedSegment = normalizeText(stripStructuralNumbers(segment));
      const numberFirst = normalizedSegment.match(new RegExp(
        `^(?:[-*•]\\s*)?(${CATEGORY_NUMBER_TOKEN_SOURCE})\\s*%?(?:\\s*[:=–—-]\\s*|\\s+)(.+?)\\s*[.]?\\s*$`,
        "u"
      ));
      const labelFirst = numberFirst ? null : normalizedSegment.match(new RegExp(
        `^(?:[-*•]\\s*)?(.+?)(?:\\s*[:=–—-]\\s*|\\s+)(${CATEGORY_NUMBER_TOKEN_SOURCE})\\s*%?\\s*[.]?\\s*$`,
        "u"
      ));
      const numberValue = parsedCategoryNumberValue(numberFirst?.[1] || labelFirst?.[2]);
      const label = String(numberFirst?.[2] || labelFirst?.[1] || "").trim();
      const tokens = significantCategoryLabelTokens(label);
      const categoryScope = numericCategoryScope(label);
      if (
        !numberValue ||
        !tokens.length
      ) continue;
      labels.push({
        value: numberValue,
        label,
        tokens,
        percentage: /%/u.test(normalizedSegment),
        explicitTotalScope: categoryScope.explicitTotal,
        wholeSampleScope: categoryScope.wholeSample
      });
    }
  }
  return labels;
}

function isGenericParticipantCategoryLabel(value = "") {
  const normalized = normalizeText(value);
  return /(?:^|[^\p{L}])(?:inim\p{L}*|isik\p{L}*|osalej\p{L}*|vastaj\p{L}*|praktik\p{L}*|people|persons?|participants?|respondents?|practitioners?|человек\p{L}*|люд\p{L}*|лиц\p{L}*|участник\p{L}*|респондент\p{L}*|практик\p{L}*)(?=$|[^\p{L}])/u.test(normalized);
}

function isGroupCountCategoryLabel(value = "") {
  const normalized = normalizeText(value);
  const tokens = categorySemanticTokens(value);
  const finalToken = tokens.at(-1) || "";
  const hasGroupHead = /^(?:.*(?:siht)?ruhm\p{L}*|.*groups?|.*categories?|.*групп\p{L}*|.*категор\p{L}*)$/u.test(finalToken);
  if (!hasGroupHead) return false;
  const groupCue = uniformGroupCue(normalized);
  if (!groupCue) return true;
  const prefix = normalized.slice(0, groupCue.index || 0);
  return significantCategoryLabelTokens(prefix).length === 0;
}

function categoryIsWholeTotal(category = {}, knownTotalValue = null) {
  const genericParticipant = isGenericParticipantCategoryLabel(category.label);
  if (
    category.explicitTotalScope &&
    genericParticipant &&
    knownTotalValue &&
    category.value === knownTotalValue
  ) return true;
  return Boolean(
    category.wholeSampleScope &&
    genericParticipant &&
    knownTotalValue &&
    category.value === knownTotalValue
  );
}

function categoryRepresentsParticipant(category = {}, knownTotalValue = null) {
  if (category.percentage || isGroupCountCategoryLabel(category.label)) return false;
  if (isEntityCoverageCategoryLabel(category.label)) return false;
  if (categoryIsWholeTotal(category, knownTotalValue)) return false;
  return true;
}

function countedParticipantValues(value = "") {
  const normalized = normalizeText(value);
  const matches = [];
  const pattern = new RegExp(
    `(?<![\\p{L}\\d])(${CATEGORY_NUMBER_TOKEN_SOURCE})\\s+(?:[\\p{L}-]+\\s+){0,2}?(${PARTICIPANT_UNIT_SOURCE})(?=$|[^\\p{L}])`,
    "gu"
  );
  for (const match of normalized.matchAll(pattern)) {
    const numberValue = parsedCategoryNumberValue(match[1]);
    if (!numberValue) continue;
    matches.push({
      value: numberValue,
      start: match.index || 0,
      end: (match.index || 0) + String(match[0] || "").length
    });
  }
  return matches;
}

function closestParticipantValue(counts = [], cue = null, maxDistance = 80) {
  if (!cue || !counts.length) return null;
  const cueStart = cue.index || 0;
  const cueEnd = cueStart + String(cue[0] || "").length;
  const ranked = counts
    .map(count => ({
      ...count,
      distance: count.end <= cueStart
        ? cueStart - count.end
        : count.start >= cueEnd
          ? count.start - cueEnd
          : 0
    }))
    .sort((left, right) => left.distance - right.distance || left.start - right.start);
  return ranked[0]?.distance <= maxDistance ? ranked[0].value : null;
}

function totalValueAroundCue(value = "", cue = null) {
  if (!cue) return null;
  const normalized = normalizeText(value);
  const cueStart = cue.index || 0;
  const cueEnd = cueStart + String(cue[0] || "").length;
  const participantCounts = countedParticipantValues(normalized);
  const numericValues = alignedCategoryNumericClaims(normalized).filter(claim => !claim.year);
  const participantAfter = participantCounts
    .filter(count => count.start >= cueEnd)
    .sort((left, right) => left.start - right.start)[0];
  const numericAfter = numericValues.find(claim => claim.index >= cueEnd);
  const numericBefore = [...numericValues].reverse().find(claim => claim.index < cueStart);
  let immediateTotalBeforeCue = false;
  if (numericBefore) {
    const beforeCueText = normalized.slice(numericBefore.index, cueStart).trim();
    immediateTotalBeforeCue = new RegExp(
      `^${CATEGORY_NUMBER_TOKEN_SOURCE}(?:\\s+(?:[\\p{L}-]+\\s+){0,2}?${PARTICIPANT_UNIT_SOURCE})?\\s*[-–—,;:]?$`,
      "u"
    ).test(beforeCueText);
  }
  if (numericAfter) {
    const beforeNumericAfter = normalized.slice(cueEnd, numericAfter.index);
    const numericAfterStartsSubgroup = /(?:^|[^\p{L}])(?:neist|nendest|millest|sealhulgas|sh|including|of\s+whom|of\s+these|из\s+них|среди\s+них)(?=$|[^\p{L}])/u.test(beforeNumericAfter);
    const numericAfterStartsNewClause = /[;,]/u.test(beforeNumericAfter);
    if (immediateTotalBeforeCue && (numericAfterStartsSubgroup || numericAfterStartsNewClause)) {
      return numericBefore.value;
    }
    const numericTail = normalized.slice(numericAfter.index);
    const numericAfterDescribesGroup = new RegExp(
      `^${CATEGORY_NUMBER_TOKEN_SOURCE}\\s+(?:[\\p{L}-]+\\s+){0,2}?(?:siht\\s*[-–—]?\\s*ruhm\\p{L}*|ruhm\\p{L}*|group\\p{L}*|categor\\p{L}*|групп\\p{L}*|категор\\p{L}*)(?=$|[^\\p{L}])`,
      "u"
    ).test(numericTail);
    if (!numericAfterDescribesGroup || !participantAfter) return numericAfter.value;
  }
  if (immediateTotalBeforeCue) return numericBefore.value;
  return participantAfter?.value || numericBefore?.value || null;
}

function categoryAroundTotalCue(value = "", cue = null, totalValue = null) {
  if (!cue || !totalValue) return null;
  const existing = extractNumericCategoryLabels(value).find(category =>
    category.explicitTotalScope &&
    category.value === totalValue &&
    categorySemanticTokens(category.label).length
  );
  if (existing) return existing;
  const cueEnd = (cue.index || 0) + String(cue[0] || "").length;
  const numericAfter = alignedCategoryNumericClaims(value).find(claim =>
    !claim.year && claim.index >= cueEnd && claim.value === totalValue
  );
  if (!numericAfter) return null;
  const tailCategory = extractNumericCategoryLabels(value.slice(numericAfter.index))
    .find(category => category.value === totalValue);
  return tailCategory ? { ...tailCategory, explicitTotalScope: true } : null;
}

function uniformGroupCue(value = "") {
  const estonianGroupCount = String.raw`(?:\d+|null\p{L}*|uhe\p{L}*|kahe\p{L}*|kolme\p{L}*|nelja\p{L}*|viie\p{L}*|kuue\p{L}*|seitsme\p{L}*|kaheksa\p{L}*|uheksa\p{L}*|kumne\p{L}*)`;
  const russianGroupCount = String.raw`(?:\d+|одн\p{L}*|дв\p{L}*|тр\p{L}*|четыр\p{L}*|пят\p{L}*|шест\p{L}*|сем\p{L}*|восем\p{L}*|девят\p{L}*|десят\p{L}*)`;
  const patterns = [
    new RegExp(
      `(?:^|[^\\p{L}])(?:iga\\p{L}*|koig\\p{L}*)\\s+(?:${estonianGroupCount}\\s+)?(?:siht\\s*[-–—]?\\s*ruhm\\p{L}*|ruhm\\p{L}*)(?=$|[^\\p{L}])`,
      "u"
    ),
    new RegExp(
      `(?:^|[^\\p{L}])(?:(?:in|from)\\s+)?(?:each|every)\\s+(?:(?:of\\s+)?(?:the\\s+)?)?(?:${CATEGORY_NUMBER_TOKEN_SOURCE}\\s+)?(?:groups?|categories?)(?=$|[^\\p{L}])`,
      "u"
    ),
    /(?:^|[^\p{L}])per\s+(?:group|category)(?=$|[^\p{L}])/u,
    new RegExp(
      `(?:^|[^\\p{L}])(?:(?:в|из|по)\\s+)?кажд\\p{L}*(?:\\s+из)?\\s+(?:${russianGroupCount}\\s+)?(?:групп\\p{L}*|категор\\p{L}*)(?=$|[^\\p{L}])`,
      "u"
    )
  ];
  return patterns
    .map(pattern => pattern.exec(value))
    .filter(Boolean)
    .sort((left, right) => (left.index || 0) - (right.index || 0))[0] || null;
}

export function extractUniformParticipantBreakdown(value = "") {
  const perGroupValues = new Set();
  const totalValues = extractWholeScopeNumbers(value, { includeFallback: false });
  const sentences = normalizeText(value).split(/(?<=[.!?])\s+/u);
  for (const rawSentence of sentences) {
    const sentence = normalizeText(stripStructuralNumbers(rawSentence));
    const counts = countedParticipantValues(sentence);
    if (counts.length) {
      const groupCue = uniformGroupCue(sentence);
      const perGroupValue = closestParticipantValue(counts, groupCue);
      if (perGroupValue) perGroupValues.add(perGroupValue);
    }
  }
  return {
    perGroupValue: perGroupValues.size === 1 ? [...perGroupValues][0] : null,
    totalValue: totalValues.size === 1 ? [...totalValues][0] : null
  };
}

function uniformParticipantRelation(source = {}, reply = "", categoryLabels = []) {
  const sourceBreakdown = extractUniformParticipantBreakdown(source.body);
  const replyBreakdown = extractUniformParticipantBreakdown(reply);
  const knownTotalValue = sourceBreakdown.totalValue || replyBreakdown.totalValue;
  const participantCategories = categoryLabels
    .filter(category => categoryRepresentsParticipant(category, knownTotalValue));
  const sourceHasUniformParticipantRelation = Boolean(sourceBreakdown.perGroupValue);
  const expectedPerGroupValue = sourceHasUniformParticipantRelation
    ? sourceBreakdown.perGroupValue
    : null;
  const observedCategoryValues = participantCategories.map(({ value }) => value);
  const mismatchedCategoryValues = expectedPerGroupValue && participantCategories.length >= 2
    ? participantCategories.filter(({ value }) => value !== expectedPerGroupValue)
    : [];
  const perGroupMismatch = Boolean(
    sourceHasUniformParticipantRelation &&
    replyBreakdown.perGroupValue &&
    sourceBreakdown.perGroupValue !== replyBreakdown.perGroupValue
  );
  const totalMismatch = Boolean(
    sourceHasUniformParticipantRelation &&
    sourceBreakdown.totalValue &&
    replyBreakdown.totalValue &&
    sourceBreakdown.totalValue !== replyBreakdown.totalValue
  );
  const checked = sourceHasUniformParticipantRelation && Boolean(
    (expectedPerGroupValue && participantCategories.length >= 2) ||
    (sourceBreakdown.perGroupValue && replyBreakdown.perGroupValue) ||
    (sourceBreakdown.totalValue && replyBreakdown.totalValue)
  );
  return {
    checked,
    mismatch: perGroupMismatch || totalMismatch || mismatchedCategoryValues.length > 0,
    expectedPerGroupValue,
    observedCategoryValues,
    mismatchedCategoryLabels: mismatchedCategoryValues
      .map(({ value, label }) => `${value}: ${String(label || "")}`.slice(0, 160)),
    expectedTotalValue: sourceHasUniformParticipantRelation
      ? sourceBreakdown.totalValue || null
      : null,
    observedTotalValue: sourceHasUniformParticipantRelation
      ? replyBreakdown.totalValue || null
      : null
  };
}

export function asksForParticipantGroupNumericRelation(message = "") {
  const normalized = normalizeText(message);
  const explicitCountOrProportionCue = /%|(?:^|[^\p{L}])(?:arv\p{L}*|kokku|kui\s+palju|mitu|osakaal\p{L}*|protsent\p{L}*|count\p{L}*|how\s+many|number\p{L}*|total|share|percent\p{L}*|proportion\p{L}*|сколько|числ\p{L}*|всего|итого|дол\p{L}*|процент\p{L}*)(?=[^\p{L}]|$)/u.test(normalized);
  const participantOrGroupCue = /(?:^|[^\p{L}])(?:categor\p{L}*|group\p{L}*|participant\p{L}*|kategoor\p{L}*|osal\p{L}*|\p{L}*ruhm\p{L}*|категор\p{L}*|групп\p{L}*|участ\p{L}*)(?=[^\p{L}]|$)/u.test(normalized);
  const broadRelationCue = participantOrGroupCue ||
    /(?:^|[^\p{L}])(?:role\p{L}*|roll\p{L}*|рол\p{L}*)(?=[^\p{L}]|$)/u.test(normalized);
  const localizedSizeRelationCue =
    /(?:^|[^\p{L}])kui\s+suur(?:ed)?\s+(?:oli(?:d)?|on)\s+(?:(?:iga|need)\s+)?(?:kategoor\p{L}*|osal\p{L}*(?:\s+\p{L}*ruhm\p{L}*)?|\p{L}*ruhm\p{L}*)(?=\s*(?:$|[,:;?!]|\b(?:ja|ning|kokku)\b))/u.test(normalized) ||
    /(?:^|[^\p{L}])(?:how\s+large|what\s+size)\s+(?:was|were|is|are)\s+(?:(?:each|every|the)\s+)?(?:(?:participant\p{L}*\s+)?group\p{L}*|participant\p{L}*|categor\p{L}*)(?=\s*(?:$|[,:;?!]|\b(?:and|total|overall)\b))/u.test(normalized) ||
    /(?:^|[^\p{L}])what\s+(?:was|is)\s+the\s+size\s+of\s+(?:(?:each|every|the)\s+)?(?:(?:participant\p{L}*\s+)?group\p{L}*|participant\p{L}*|categor\p{L}*)(?=\s*(?:$|[,:;?!]|\b(?:and|total|overall)\b))/u.test(normalized);
  return (explicitCountOrProportionCue && broadRelationCue) || localizedSizeRelationCue;
}

function asksForCategoricalNumericBreakdown(message = "") {
  const normalized = normalizeText(message);
  const explicitCategoryCue = asksForParticipantGroupNumericRelation(message);
  const listShape = (String(message || "").match(/,/gu) || []).length >= 2 &&
    /(?:^|[^\p{L}])(?:and|ja|ning|и)(?=[^\p{L}]|$)/u.test(normalized);
  return asksForNumericFact(message) && (explicitCategoryCue || listShape);
}

function sourceSupportsCategoryLabel(source = {}, tokens = []) {
  if (!tokens.length) return true;
  const evidenceTokens = normalizeText(source.body).match(/[\p{L}]+/gu) || [];
  const windowSize = Math.max(12, tokens.length * 5);
  const requiredMatches = tokens.length === 1 ? 1 : Math.max(2, Math.ceil(tokens.length * 0.6));
  for (let start = 0; start < evidenceTokens.length; start += 1) {
    const window = evidenceTokens.slice(start, start + windowSize);
    const matchedTokens = tokens.filter(token =>
      window.some(evidenceToken => categoryTokenMatches(token, evidenceToken))
    );
    if (matchedTokens.length >= requiredMatches) {
      return true;
    }
  }
  return false;
}

function unsupportedNumericCategoryLabels(message = "", reply = "", source = {}) {
  if (!asksForCategoricalNumericBreakdown(message)) return [];
  const labels = extractNumericCategoryLabels(reply);
  if (labels.length < 2) return [];
  const sourceBreakdown = extractUniformParticipantBreakdown(source.body);
  const replyBreakdown = extractUniformParticipantBreakdown(reply);
  const sourceTotalValue = sourceBreakdown.totalValue || replyBreakdown.totalValue;
  return labels
    .filter(category => !categoryIsWholeTotal(category, sourceTotalValue))
    .filter(category => !(
      sourceBreakdown.perGroupValue &&
      category.value === sourceBreakdown.perGroupValue &&
      isGenericParticipantCategoryLabel(category.label) &&
      uniformGroupCue(normalizeText(category.label))
    ))
    .filter(({ tokens }) => !sourceSupportsCategoryLabel(source, tokens))
    .map(({ label }) => label);
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

function temporalYearDecision(message = "", retrievalMeta = null) {
  const rawYearRequested = asksForYear(message);
  const rawPublicationYearRequested = asksForPublicationYear(message);
  const contract = retrievalMeta?.queryPlan?.temporal_query_contract;
  const typedContractAvailable = contract?.production_source === "question_planner";
  const requestedYearRole = ["publication_year", "evidence_year", "none", "ambiguous"].includes(
    contract?.requested_year_role
  )
    ? contract.requested_year_role
    : null;
  const documentSourceYears = typedContractAvailable && Array.isArray(contract?.document_source_years)
    ? contract.document_source_years
    : [];
  const evidenceYears = typedContractAvailable && Array.isArray(contract?.evidence_years)
    ? contract.evidence_years
    : [];
  if (typedContractAvailable && requestedYearRole && requestedYearRole !== "ambiguous") {
    return {
      yearRequested: requestedYearRole !== "none",
      publicationYearRequested: requestedYearRole === "publication_year",
      source: "typed_temporal_contract",
      mode: requestedYearRole === "publication_year"
        ? "publication_year"
        : requestedYearRole === "evidence_year"
          ? "body_evidence_year"
          : "none",
      requestedYearRole,
      documentSourceYears,
      evidenceYears
    };
  }
  if (!rawYearRequested) {
    return {
      yearRequested: false,
      publicationYearRequested: false,
      source: "not_applied",
      mode: "none",
      requestedYearRole: requestedYearRole || "none",
      documentSourceYears,
      evidenceYears
    };
  }
  if (typedContractAvailable && rawPublicationYearRequested && documentSourceYears.length) {
    return {
      yearRequested: true,
      publicationYearRequested: true,
      source: "typed_temporal_contract",
      mode: "publication_year",
      requestedYearRole: "publication_year",
      documentSourceYears,
      evidenceYears
    };
  }
  if (typedContractAvailable && evidenceYears.length) {
    return {
      yearRequested: true,
      publicationYearRequested: false,
      source: "typed_temporal_contract",
      mode: "body_evidence_year",
      requestedYearRole: "evidence_year",
      documentSourceYears,
      evidenceYears
    };
  }
  return {
    yearRequested: rawYearRequested,
    publicationYearRequested: rawPublicationYearRequested,
    source: "raw_text_fallback",
    mode: rawPublicationYearRequested ? "publication_year" : "body_evidence_year",
    requestedYearRole: requestedYearRole || "ambiguous",
    documentSourceYears: [],
    evidenceYears: []
  };
}

function asksForWholeScope(message = "") {
  const normalized = normalizeText(message);
  const quantitativePattern = /(?:^|[^\p{L}\p{N}])(?:kui\s+palju|mitu|koguarv\p{L}*|uldarv\p{L}*|how\s+many|number\s+of|total|сколько|число|всего|итого)(?=$|[^\p{L}\p{N}])/gu;
  const quantitativeSlots = normalized.match(quantitativePattern) || [];
  const explicitTotalCue = /(?:^|[^\p{L}\p{N}])(?:kokku|koguarv\p{L}*|uldarv\p{L}*|in\s+total|total|altogether|всего|итого|общее\s+число)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  if (!explicitTotalCue && quantitativeSlots.length > 1) return false;
  if (asksForCategoricalNumericBreakdown(message) && !explicitTotalCue) return false;
  return (explicitTotalCue || quantitativeSlots.length > 0 || /(?:^|[^\p{L}\p{N}])(?:arv|arvu|arvud|arvust|arvuga)(?=$|[^\p{L}\p{N}])/u.test(normalized)) &&
    !/(?:^|[^\p{L}\p{N}])(?:osakaal\p{L}*|protsent\p{L}*|percentage|percent|процент\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function shadowField(contract, fieldName) {
  const field = contract?.planner?.fields?.[fieldName];
  return field && typeof field === "object" ? field : null;
}

function shadowFieldAvailable(contract, fieldName) {
  return shadowField(contract, fieldName)?.available === true;
}

function shadowFieldValue(contract, fieldName) {
  return shadowFieldAvailable(contract, fieldName)
    ? shadowField(contract, fieldName)?.value
    : null;
}

export function buildFactValidationContractShadow({ message = "", retrievalMeta = null } = {}) {
  const contract = retrievalMeta?.queryPlan?.answer_validation_contract_shadow;
  if (contract?.mode !== "shadow") return null;
  const metricSlots = Array.isArray(shadowFieldValue(contract, "evidence_metric_slots"))
    ? shadowFieldValue(contract, "evidence_metric_slots")
    : [];
  const yearRoleMentionValue = shadowFieldValue(contract, "year_role_mentions");
  const yearRoleMentionsAvailable = Array.isArray(yearRoleMentionValue);
  const yearRoleMentions = yearRoleMentionsAvailable
    ? yearRoleMentionValue
    : [];
  const requestedNumericSlots = shadowFieldValue(contract, "requested_numeric_slots");
  const requestedNumericSlotsAvailable = !!requestedNumericSlots &&
    typeof requestedNumericSlots === "object" &&
    !Array.isArray(requestedNumericSlots) &&
    Array.isArray(requestedNumericSlots.slots);
  const requestedSlotList = requestedNumericSlotsAvailable
    ? requestedNumericSlots.slots
    : [];
  const phaseOrdinal = shadowFieldValue(contract, "evidence_phase_ordinal");
  return {
    production_path: "not_run",
    validation_applied: false,
    legacy_path_used: false,
    structured_path_used_for_decision: false,
    structured_observations: {
      planner_mode: typeof contract?.planner?.mode === "string" ? contract.planner.mode : null,
      route_mode: typeof contract?.planner?.route_mode === "string" ? contract.planner.route_mode : null,
      field_availability: {
        document_source_years: shadowFieldAvailable(contract, "document_source_years"),
        period_role: shadowFieldAvailable(contract, "period_role"),
        evidence_period_years: shadowFieldAvailable(contract, "evidence_period_years"),
        evidence_phase_ordinal: shadowFieldAvailable(contract, "evidence_phase_ordinal"),
        evidence_metric_terms: shadowFieldAvailable(contract, "evidence_metric_terms"),
        evidence_metric_slots: shadowFieldAvailable(contract, "evidence_metric_slots"),
        bounded_episode_metric_fact: shadowFieldAvailable(contract, "bounded_episode_metric_fact"),
        year_role_mentions: shadowFieldAvailable(contract, "year_role_mentions"),
        requested_numeric_slots: shadowFieldAvailable(contract, "requested_numeric_slots")
      },
      document_source_years: Array.isArray(shadowFieldValue(contract, "document_source_years"))
        ? shadowFieldValue(contract, "document_source_years")
        : null,
      period_role: typeof shadowFieldValue(contract, "period_role") === "string"
        ? shadowFieldValue(contract, "period_role")
        : null,
      evidence_period_years: Array.isArray(shadowFieldValue(contract, "evidence_period_years"))
        ? shadowFieldValue(contract, "evidence_period_years")
        : null,
      evidence_phase_ordinal: ["first", "second", "third", "next", "later"].includes(phaseOrdinal)
        ? phaseOrdinal
        : null,
      evidence_metric_term_count: Array.isArray(shadowFieldValue(contract, "evidence_metric_terms"))
        ? shadowFieldValue(contract, "evidence_metric_terms").length
        : null,
      evidence_metric_slot_categories: shadowFieldAvailable(contract, "evidence_metric_slots")
        ? metricSlots
            .map(slot => String(slot?.category || "").trim())
            .filter(Boolean)
            .slice(0, 12)
        : null,
      bounded_episode_metric_fact: shadowFieldAvailable(contract, "bounded_episode_metric_fact")
        ? shadowFieldValue(contract, "bounded_episode_metric_fact") === true
        : null,
      typed_document_source_years: yearRoleMentionsAvailable
        ? yearRoleMentions
            .filter(mention => mention?.role === "document_source_year")
            .map(mention => String(mention?.value || ""))
            .filter(Boolean)
            .slice(0, 8)
        : null,
      typed_evidence_years: yearRoleMentionsAvailable
        ? yearRoleMentions
            .filter(mention => mention?.role === "evidence_year")
            .map(mention => String(mention?.value || ""))
            .filter(Boolean)
            .slice(0, 8)
        : null,
      ambiguous_years: yearRoleMentionsAvailable
        ? yearRoleMentions
            .filter(mention => mention?.role === "ambiguous")
            .map(mention => String(mention?.value || ""))
            .filter(Boolean)
            .slice(0, 8)
        : null,
      requested_numeric_slot_count: requestedNumericSlotsAvailable
        ? requestedSlotList.length
        : null,
      requested_numeric_recognized_clause_count: requestedNumericSlotsAvailable &&
        typeof requestedNumericSlots?.recognized_clause_count === "number" &&
        Number.isInteger(requestedNumericSlots.recognized_clause_count)
        ? requestedNumericSlots.recognized_clause_count
        : null,
      requested_numeric_emitted_slot_count: requestedNumericSlotsAvailable &&
        typeof requestedNumericSlots?.emitted_slot_count === "number" &&
        Number.isInteger(requestedNumericSlots.emitted_slot_count)
        ? requestedNumericSlots.emitted_slot_count
        : null,
      requested_numeric_slot_types: requestedNumericSlotsAvailable
        ? requestedSlotList
            .map(slot => String(slot?.value_type || ""))
            .filter(Boolean)
            .slice(0, 12)
        : null,
      requested_numeric_slots_complete: requestedNumericSlotsAvailable &&
        typeof requestedNumericSlots.complete === "boolean"
        ? requestedNumericSlots.complete
        : null,
      requested_numeric_slots_truncated: requestedNumericSlotsAvailable &&
        typeof requestedNumericSlots.truncated === "boolean"
        ? requestedNumericSlots.truncated
        : null,
      requested_numeric_unresolved_clause_count: requestedNumericSlotsAvailable &&
        typeof requestedNumericSlots?.unresolved_clause_count === "number" &&
        Number.isInteger(requestedNumericSlots.unresolved_clause_count)
        ? requestedNumericSlots.unresolved_clause_count
        : null
    },
    legacy_observations: {
      asks_for_numeric_fact: asksForNumericFact(message),
      asks_for_year: asksForYear(message),
      asks_for_publication_year: asksForPublicationYear(message),
      asks_for_whole_scope: asksForWholeScope(message),
      asks_for_categorical_numeric_breakdown: asksForCategoricalNumericBreakdown(message),
      contact_answer_intent_requested: contactAnswerIntentRequested(message)
    },
    runtime_relation: "not_comparable"
  };
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

function contactFailureReply(replyLang = "et") {
  if (replyLang === "en") {
    return "The requested current contact details could not be confirmed from the freshness-verified municipal contact registry.";
  }
  if (replyLang === "ru") {
    return "Запрошенные актуальные контактные данные не удалось подтвердить по проверенному на свежесть реестру контактов муниципалитета.";
  }
  return "Küsitud praeguseid kontaktandmeid ei õnnestunud värskuskontrollitud KOV-i kontaktiregistrist kinnitada.";
}

export function shouldValidateExactFactAnswer({ message = "", sources = [], retrievalMeta = null } = {}) {
  if (retrievalMeta?.structuredContactMissingMunicipalityTurn === true) return true;
  if (retrievalMeta?.structuredContactMonitorTurn === true) return true;
  if (retrievalMeta?.structuredContactRegistryTurn === true) return true;
  if (isMunicipalityContactInventory(retrievalMeta)) return true;
  if (
    retrievalMeta?.currentMunicipalityContactEvidenceRequested === true &&
    contactAnswerIntentRequested(message)
  ) return true;
  if (temporalClaimContractFromRetrievalMeta(retrievalMeta, sources)) return true;
  if (retrievalMeta?.numericFactEvidence?.enabled === true) return true;
  if (!asksForNumericFact(message)) return false;
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
  const temporalDecision = temporalYearDecision(message, retrievalMeta);
  const baseTrace = {
    version: "exact_numeric_fact_v6",
    enabled: true,
    buffered: true,
    passed: false,
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
      : null,
    temporal_decision_source: temporalDecision.source,
    temporal_year_mode: temporalDecision.mode,
    temporal_year_contract: {
      year_requested: temporalDecision.yearRequested,
      publication_year_requested: temporalDecision.publicationYearRequested,
      requested_year_role: temporalDecision.requestedYearRole,
      document_source_years: temporalDecision.documentSourceYears.slice(0, 8),
      evidence_years: temporalDecision.evidenceYears.slice(0, 8)
    }
  };
  if (retrievalMeta?.structuredContactMissingMunicipalityTurn === true) {
    const expectedReply = String(retrievalMeta?.deterministicContactReply || "").trim();
    const actualReply = String(reply || "").trim();
    const passed = Boolean(expectedReply && actualReply === expectedReply);
    return {
      passed,
      reply: passed ? actualReply : contactFailureReply(replyLang),
      trace: {
        ...baseTrace,
        passed,
        reason: passed ? "contact_municipality_clarification_validated" : "contact_municipality_clarification_mismatch",
        contact_municipality_clarification_checked: true,
        supporting_source_ids: []
      }
    };
  }
  if (retrievalMeta?.structuredContactMonitorTurn === true) {
    const monitorSources = evidenceSources.filter(source => source.sourceType === "service_map_contact_monitor");
    const schedule = retrievalMeta?.serviceMapKovContactCheckSchedule;
    const expectedCadence = String(schedule?.cadence || "").trim().toLowerCase();
    const scheduleSourceId = String(schedule?.sourceId || "").trim();
    const cadenceClaims = contactCheckCadenceClaims(reply);
    const unsupportedCadences = cadenceClaims.filter(cadence => cadence !== expectedCadence);
    const sourcePresent = Boolean(
      scheduleSourceId && monitorSources.some(source => source.sourceId === scheduleSourceId)
    );
    const passed = Boolean(
      expectedCadence &&
      cadenceClaims.includes(expectedCadence) &&
      !unsupportedCadences.length &&
      sourcePresent
    );
    return {
      passed,
      reply: passed ? String(reply || "").trim() : contactFailureReply(replyLang),
      trace: {
        ...baseTrace,
        passed,
        reason: passed ? "contact_monitor_schedule_validated" : !sourcePresent
          ? "contact_check_cadence_source_missing"
          : unsupportedCadences.length
            ? "unsupported_contact_check_cadence"
            : "contact_check_cadence_missing",
        contact_monitor_checked: true,
        contact_check_cadence_expected: expectedCadence || null,
        contact_check_cadence_claims: cadenceClaims,
        unsupported_contact_check_cadences: unsupportedCadences,
        supporting_source_ids: passed ? [scheduleSourceId] : []
      }
    };
  }
  const contactEvidence = structuredContactEvidence(retrievalMeta);
  const contactInventoryValidation = retrievalMeta?.structuredContactRegistryTurn === true ||
    isMunicipalityContactInventory(retrievalMeta);
  const mixedStructuredContactValidation = !contactInventoryValidation &&
    retrievalMeta?.currentMunicipalityContactEvidenceRequested === true &&
    contactAnswerIntentRequested(message);
  if (contactInventoryValidation || mixedStructuredContactValidation) {
    const contactSources = evidenceSources.filter(source => source.sourceType === "service_map_contact");
    const contactMonitorSources = evidenceSources.filter(source => source.sourceType === "service_map_contact_monitor");
    if (!contactEvidence?.contacts.length || !contactSources.length) {
      return {
        passed: false,
        reply: contactFailureReply(replyLang),
        trace: {
          ...baseTrace,
          reason: "contact_inventory_unavailable",
          contact_inventory_checked: true,
          contact_inventory_load_state: String(retrievalMeta?.serviceMapKovContactLoadState || "unknown"),
          contact_inventory_expected_name_count: contactEvidence?.contacts.length || 0,
          contact_source_count: contactSources.length,
          supporting_source_ids: []
        }
      };
    }
    {
      const contactClaims = contactNumericClaims(reply);
      const contactBaseTrace = {
        ...baseTrace,
        claim_values: contactClaims.map(claim => claim.value)
      };
      const messageNormalized = normalizeText(message);
      const activeScopeContacts = contactEvidence.activeScope
        ? contactEvidence.contacts.filter(contact => contactEvidence.activeScope.sourceIds.has(contact.sourceId))
        : contactEvidence.contacts;
      const targetedContacts = contactEvidence.contacts.filter(contact =>
        messageNormalized.includes(normalizeText(contact.name))
      );
      const targetedSourceIds = new Set(targetedContacts.map(contact => contact.sourceId));
      const replyDates = contactDateClaims(reply);
      const replyPhones = contactPhoneClaims(reply).filter(phone =>
        !replyDates.some(date => phone.index >= date.index && phone.index < date.end)
      );
      const replyEmails = contactEmailClaims(reply);
      const phoneRelations = contactTupleRelationFailures(
        reply,
        replyPhones,
        contactEvidence.contacts,
        "phones",
        targetedSourceIds
      );
      const emailRelations = contactTupleRelationFailures(
        reply,
        replyEmails,
        contactEvidence.contacts,
        "emails",
        targetedSourceIds
      );
      const nonPhoneClaims = contactClaims.filter(claim =>
        !replyPhones.some(phone => claim.index >= phone.index && claim.index < phone.end)
      );
      const nonContactValueClaims = nonPhoneClaims.filter(claim =>
        !replyEmails.some(email => claim.index >= email.index && claim.index < email.end) &&
        !replyDates.some(date => claim.index >= date.index && claim.index < date.end)
      );
      const supportedCheckedDates = new Set(contactEvidence.contacts
        .map(contact => contact.checkedAt.slice(0, 10))
        .filter(Boolean));
      const dateSupportingContacts = contactEvidence.contacts.filter(contact =>
        replyDates.some(claim => claim.value === contact.checkedAt.slice(0, 10))
      );
      const unsupportedDates = replyDates
        .filter(() => contactInventoryValidation || contactAnswerIntent(message).wantsFreshness)
        .filter(claim => !supportedCheckedDates.has(claim.value))
        .map(claim => claim.value);
      const answerIntent = contactAnswerIntent(message);
      const unsupportedClaims = nonPhoneClaims
        .filter(claim => nonContactValueClaims.includes(claim))
        .filter(() => contactInventoryValidation || answerIntent.wantsContactCount)
        .filter(claim =>
          !contactCountClaimSupported(message, reply, claim, contactEvidence) &&
          !contactAuxiliaryNumericClaimSupported(reply, claim, contactEvidence)
        )
        .map(claim => claim.value);
      const cadenceClaims = contactCheckCadenceClaims(reply);
      const expectedCadence = contactEvidence.checkSchedule?.cadence || "";
      const cadenceSourceId = contactEvidence.checkSchedule?.sourceId || "";
      const unsupportedCadences = cadenceClaims.filter(cadence => cadence !== expectedCadence);
      const requiredCadenceMissing = asksForContactCheckCadence(message) &&
        (!expectedCadence || !cadenceClaims.includes(expectedCadence));
      const cadenceSourceMissing = cadenceClaims.length > 0 && (
        !cadenceSourceId ||
        !contactMonitorSources.some(source => source.sourceId === cadenceSourceId)
      );
      const countRequired = !answerIntent.wantsFreshness && (
        (contactInventoryValidation && asksForNumericFact(message)) ||
        answerIntent.wantsContactCount
      );
      const activeScopeMunicipalityCounts = new Map();
      for (const contact of activeScopeContacts) {
        activeScopeMunicipalityCounts.set(contact.municipality, (activeScopeMunicipalityCounts.get(contact.municipality) || 0) + 1);
      }
      const expectedTotals = contactEvidence.activeScope?.kind === "known_zero"
        ? [{ name: "", count: contactEvidence.activeScope.count }]
        : contactEvidence.activeScope?.kind === "subset"
          ? contactEvidence.activeScope.contextual || asksForCombinedContactTotal(message)
          ? [{ name: "", count: contactEvidence.activeScope.count }]
          : [...activeScopeMunicipalityCounts.entries()].map(([name, count]) => ({ name, count }))
        : contactEvidence.activeScope?.contextual
          ? [{ name: "", count: contactEvidence.activeScope.count }]
        : asksForCombinedContactTotal(message)
        ? [{ name: "", count: contactEvidence.totalCount }]
        : contactEvidence.municipalities.length
          ? contactEvidence.municipalities
          : [{ name: "", count: contactEvidence.totalCount }];
      const seenTotals = expectedTotals.filter(expected => nonContactValueClaims.some(claim => {
        if (claim.numeric !== expected.count) return false;
        const sentence = sentenceAroundIndex(reply, claim.index || 0);
        return contactTotalClaimScopeSupported(sentence) &&
          (expectedTotals.length === 1 || contactLabelMentioned(sentence, expected.name));
      }));
      const totalClaimsComplete = !countRequired || seenTotals.length === expectedTotals.length;
      const requestedRoleCounts = countRequired
        ? requestedContactRoleCounts(message, contactEvidence)
        : [];
      const seenRequestedRoleCounts = requestedRoleCounts.filter(entry =>
        contactRoleCountSeen(reply, nonContactValueClaims, entry)
      );
      const roleClaimsComplete = !countRequired || seenRequestedRoleCounts.length === requestedRoleCounts.length;
      const requireAllContacts = contactInventoryValidation && asksForCompleteContactList(message);
      const requireActiveScopeValues = Boolean(contactEvidence.activeScope) &&
        asksForPluralContactValues(message, answerIntent);
      const replyNormalized = normalizeText(reply);
      const seenContacts = contactEvidence.contacts.filter(contact =>
        replyNormalized.includes(normalizeText(contact.name))
      );
      const supportedRoleMentioned = [...contactEvidence.roles, ...contactEvidence.roleFamilies]
        .some(entry => contactRoleLabelMentioned(reply, entry.label));
      const supportedScopedTotalMentioned = nonContactValueClaims.some(claim =>
        contactCountClaimSupported(message, reply, claim, contactEvidence)
      );
      const requireActiveScopeNames = requireAllContacts || requireActiveScopeValues || (
        answerIntent.wantsIdentity && (
          contactEvidence.activeScope?.kind === "subset" ||
          contactEvidence.activeScope?.contextual
        )
      );
      const requiredIdentityContacts = requireActiveScopeNames ? activeScopeContacts : [];
      const missingContactNames = requireActiveScopeNames
        ? requiredIdentityContacts
          .filter(contact => !seenContacts.some(seen => seen.sourceId === contact.sourceId))
          .map(contact => contact.name)
        : [];
      const allowedReplyContacts = contactEvidence.activeScope?.kind === "subset"
        ? activeScopeContacts
        : contactEvidence.contacts;
      const unexpectedContactItems = unexpectedContactPersonClaims(reply, contactEvidence, allowedReplyContacts);
      const unsupportedRoleRelations = contactRoleRelationFailures(reply, contactEvidence);
      const missingContactRoles = (requireAllContacts || answerIntent.wantsIdentity)
        ? missingRequiredContactRoles(reply, requiredIdentityContacts, contactEvidence)
        : [];
      const missingTargetIdentityNames = answerIntent.wantsIdentity
        ? targetedContacts
          .filter(contact => !seenContacts.some(seen => seen.sourceId === contact.sourceId))
          .map(contact => contact.name)
        : [];
      const requiredTargetMentionMissing = targetedContacts.length > 0 && (
        answerIntent.wantsIdentity ? missingTargetIdentityNames.length > 0 : !seenContacts.length
      );
      const requiredGeneralIdentityMissing = answerIntent.wantsIdentity &&
        !targetedContacts.length &&
        contactEvidence.activeScope?.kind !== "known_zero" &&
        !seenContacts.length;
      const requiredContactNameMissing = !countRequired &&
        !answerIntent.wantsPhone &&
        !answerIntent.wantsEmail &&
        !answerIntent.wantsContactDetails &&
        (requiredTargetMentionMissing || requiredGeneralIdentityMissing);
      const requiredContactEvidenceMissing = !countRequired &&
        !answerIntent.wantsPhone &&
        !answerIntent.wantsEmail &&
        !answerIntent.wantsContactDetails &&
        !answerIntent.wantsIdentity &&
        !answerIntent.wantsFreshness &&
        !targetedContacts.length &&
        !seenContacts.length &&
        !supportedRoleMentioned &&
        !supportedScopedTotalMentioned;
      const requiredPhoneMissing = answerIntent.wantsPhone && !replyPhones.length;
      const requiredEmailMissing = answerIntent.wantsEmail && !replyEmails.length;
      const requiredContactValueMissing = answerIntent.wantsContactDetails && !replyPhones.length && !replyEmails.length;
      const replyStartsWithNegativePresence = /^(?:ei|no|нет)(?=$|[^\p{L}\p{N}])/u.test(replyNormalized);
      const supportedPositivePresence = seenContacts.length > 0 ||
        replyPhones.length > 0 ||
        replyEmails.length > 0 ||
        supportedRoleMentioned ||
        nonContactValueClaims.some(claim =>
          claim.numeric > 0 && contactCountClaimSupported(message, reply, claim, contactEvidence)
        );
      const supportedZeroPresence = nonContactValueClaims.some(claim =>
        claim.numeric === 0 && contactCountClaimSupported(message, reply, claim, contactEvidence)
      );
      const expectedPresenceCount = Number.isInteger(Number(contactEvidence.activeScope?.count))
        ? Number(contactEvidence.activeScope.count)
        : Number(contactEvidence.totalCount);
      const contactPresenceMismatch = answerIntent.wantsPresence && (
        expectedPresenceCount > 0
          ? replyStartsWithNegativePresence || !supportedPositivePresence
          : !replyStartsWithNegativePresence || !supportedZeroPresence
      );
      const phoneOwners = replyPhones.flatMap(claim =>
        contactEvidence.contacts.filter(contact => contact.phones.includes(claim.value))
      );
      const emailOwners = replyEmails.flatMap(claim =>
        contactEvidence.contacts.filter(contact => contact.emails.includes(claim.value))
      );
      const replyPhoneOwnerIds = new Set(phoneOwners.map(contact => contact.sourceId));
      const replyEmailOwnerIds = new Set(emailOwners.map(contact => contact.sourceId));
      const missingContactPhones = requireActiveScopeValues && (answerIntent.wantsPhone || answerIntent.wantsContactDetails)
        ? activeScopeContacts
          .filter(contact => contact.phones.length && !replyPhoneOwnerIds.has(contact.sourceId))
          .map(contact => contact.name)
        : [];
      const missingContactEmails = requireActiveScopeValues && (answerIntent.wantsEmail || answerIntent.wantsContactDetails)
        ? activeScopeContacts
          .filter(contact => contact.emails.length && !replyEmailOwnerIds.has(contact.sourceId))
          .map(contact => contact.name)
        : [];
      const roleSupportingContacts = contactEvidence.contacts.filter(contact =>
        contactRoleLabelMentioned(reply, contact.role) || contactRoleLabelMentioned(reply, contact.roleFamily)
      );
      const supportingContacts = contactEvidence.activeScope?.contextual
        ? activeScopeContacts
        : countRequired || requireAllContacts || supportedScopedTotalMentioned
          ? contactEvidence.contacts
          : requireActiveScopeNames
            ? requiredIdentityContacts
        : [...seenContacts, ...phoneOwners, ...emailOwners, ...roleSupportingContacts, ...dateSupportingContacts];
      const supportingSourceIds = [...new Set(supportingContacts.map(contact => contact.sourceId))]
        .filter(sourceId => contactSources.some(source => source.sourceId === sourceId));
      if (
        cadenceClaims.includes(expectedCadence) &&
        cadenceSourceId &&
        contactMonitorSources.some(source => source.sourceId === cadenceSourceId)
      ) {
        supportingSourceIds.push(cadenceSourceId);
      }
      if (
        phoneRelations.unsupported.length ||
        phoneRelations.mismatched.length ||
        emailRelations.unsupported.length ||
        emailRelations.mismatched.length ||
        unsupportedDates.length ||
        unsupportedClaims.length ||
        !totalClaimsComplete ||
        !roleClaimsComplete ||
        missingContactNames.length ||
        unexpectedContactItems.length ||
        unsupportedRoleRelations.length ||
        missingContactRoles.length ||
        requiredContactNameMissing ||
        requiredContactEvidenceMissing ||
        requiredPhoneMissing ||
        requiredEmailMissing ||
        requiredContactValueMissing ||
        contactPresenceMismatch ||
        missingContactPhones.length ||
        missingContactEmails.length ||
        unsupportedCadences.length ||
        requiredCadenceMissing ||
        cadenceSourceMissing
      ) {
        return {
          passed: false,
          reply: failureReply(replyLang),
          trace: {
            ...contactBaseTrace,
            reason: phoneRelations.unsupported.length
              ? "unsupported_contact_phone"
              : phoneRelations.mismatched.length
                ? "unsupported_contact_phone_relation"
                : emailRelations.unsupported.length
                  ? "unsupported_contact_email"
                : emailRelations.mismatched.length
                  ? "unsupported_contact_email_relation"
                  : unsupportedDates.length
                    ? "unsupported_contact_checked_date"
                    : unsupportedClaims.length
                      ? "unsupported_contact_inventory_claim"
                      : !totalClaimsComplete
                        ? "contact_inventory_total_missing"
                        : !roleClaimsComplete
                          ? "contact_role_count_missing"
                        : missingContactNames.length
                          ? "contact_inventory_names_incomplete"
                          : unexpectedContactItems.length
                            ? "unexpected_contact_items"
                            : unsupportedRoleRelations.length
                              ? "unsupported_contact_role_relation"
                              : missingContactRoles.length
                                ? "contact_role_not_answered"
                              : requiredPhoneMissing
                                ? "contact_phone_not_answered"
                              : requiredEmailMissing
                                ? "contact_email_not_answered"
                                : missingContactPhones.length
                                  ? "contact_phone_list_incomplete"
                                  : missingContactEmails.length
                                    ? "contact_email_list_incomplete"
                                  : unsupportedCadences.length
                                    ? "unsupported_contact_check_cadence"
                                    : requiredCadenceMissing
                                      ? "contact_check_cadence_missing"
                                      : cadenceSourceMissing
                                        ? "contact_check_cadence_source_missing"
                                  : requiredContactValueMissing
                                    ? "contact_details_not_answered"
                                    : contactPresenceMismatch
                                      ? "contact_presence_mismatch"
                                    : requiredContactEvidenceMissing
                                      ? "contact_evidence_not_answered"
                                      : "contact_name_not_answered",
            contact_inventory_checked: true,
            contact_inventory_total_expected: expectedTotals.map(entry => `${entry.name}:${entry.count}`),
            contact_inventory_total_seen: seenTotals.map(entry => `${entry.name}:${entry.count}`),
            contact_role_count_expected: requestedRoleCounts.map(entry => `${entry.municipality}:${entry.label}:${entry.count}`),
            contact_role_count_seen: seenRequestedRoleCounts.map(entry => `${entry.municipality}:${entry.label}:${entry.count}`),
            contact_inventory_expected_name_count: contactEvidence.contacts.length,
            contact_inventory_seen_name_count: seenContacts.length,
            missing_contact_names: missingContactNames,
            unexpected_contact_items: unexpectedContactItems,
            unsupported_contact_role_relations: unsupportedRoleRelations,
            missing_contact_roles: missingContactRoles,
            unsupported_claim_values: unsupportedClaims,
            unsupported_contact_phone_values: phoneRelations.unsupported,
            unsupported_contact_phone_relations: phoneRelations.mismatched,
            unsupported_contact_email_values: emailRelations.unsupported,
            unsupported_contact_email_relations: emailRelations.mismatched,
            unsupported_contact_date_values: unsupportedDates,
            missing_target_contact_names: missingTargetIdentityNames,
            missing_contact_phone_names: missingContactPhones,
            missing_contact_email_names: missingContactEmails,
            expected_contact_check_cadence: expectedCadence || null,
            contact_check_cadence_claims: cadenceClaims,
            unsupported_contact_check_cadences: unsupportedCadences,
            supporting_source_ids: supportingSourceIds
          }
        };
      }
      return {
        passed: true,
        reply: String(reply || "").trim(),
        trace: {
          ...contactBaseTrace,
          passed: true,
          reason: "contact_inventory_cross_source",
          contact_inventory_checked: true,
          contact_source_count: contactSources.length,
          contact_inventory_total_expected: expectedTotals.map(entry => `${entry.name}:${entry.count}`),
          contact_inventory_total_seen: seenTotals.map(entry => `${entry.name}:${entry.count}`),
          contact_role_count_expected: requestedRoleCounts.map(entry => `${entry.municipality}:${entry.label}:${entry.count}`),
          contact_role_count_seen: seenRequestedRoleCounts.map(entry => `${entry.municipality}:${entry.label}:${entry.count}`),
          contact_inventory_expected_name_count: contactEvidence.contacts.length,
          contact_active_scope_count: activeScopeContacts.length,
          contact_inventory_seen_name_count: seenContacts.length,
          contact_phone_claim_count: replyPhones.length,
          contact_phone_relation_checked: replyPhones.length > 0,
          contact_email_claim_count: replyEmails.length,
          contact_email_relation_checked: replyEmails.length > 0,
          contact_check_cadence_expected: expectedCadence || null,
          contact_check_cadence_claims: cadenceClaims,
          contact_check_cadence_validated: cadenceClaims.length > 0,
          supporting_source_count: supportingSourceIds.length,
          supporting_source_ids: supportingSourceIds,
          category_relation_checked: nonContactValueClaims.length > 0,
          year_mode: "freshness_checked_contact_inventory",
          whole_scope_checked: true
        }
      };
    }
    return {
      passed: false,
      reply: failureReply(replyLang),
      trace: {
        ...baseTrace,
        reason: "contact_inventory_sources_missing",
        contact_inventory_checked: true
      }
    };
  }
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

  const temporalClaimContract = retrievalMeta?.queryPlan?.mode === "temporal"
    ? temporalClaimContractFromRetrievalMeta(retrievalMeta, sources)
    : null;
  if (temporalClaimContract) {
    const temporalValidation = validateTemporalClaimBindings({
      reply,
      claims: temporalNumericClaims(reply),
      contract: temporalClaimContract,
      eligibleSources: identityEligibleSources,
      replyLang
    });
    if (temporalValidation?.passed !== true) {
      const identityEligibleSourceIds = new Set(
        identityEligibleSources.map(source => source.attributionSourceId).filter(Boolean)
      );
      const contractAggregatePeriodRows = Array.isArray(temporalClaimContract.aggregatePeriodRows)
        ? temporalClaimContract.aggregatePeriodRows
        : [];
      const aggregatePeriodRows = contractAggregatePeriodRows.filter(row =>
        identityEligibleSourceIds.has(row.source_id)
      );
      const aggregateSupportingSourceIds = Array.from(new Set(
        aggregatePeriodRows.map(row => String(row?.source_id || "").trim()).filter(Boolean)
      ));
      return {
        passed: false,
        reply: failureReply(replyLang),
        trace: {
          ...baseTrace,
          reason: "cross_source_numeric_mix",
          temporal_claim_binding_reason: temporalValidation?.reason || "temporal_claim_binding_failed",
          temporal_missing_years: Array.isArray(temporalValidation?.missingTargetYears)
            ? temporalValidation.missingTargetYears
            : temporalClaimContract.missingYears,
          unsupported_claim_values: Array.isArray(temporalValidation?.unsupportedClaimValues)
            ? temporalValidation.unsupportedClaimValues
            : [],
          temporal_aggregate_period_available:
            aggregatePeriodRows.length >= 2 &&
            aggregatePeriodRows.length === contractAggregatePeriodRows.length &&
            aggregateSupportingSourceIds.length === 1,
          temporal_aggregate_supporting_source_id: aggregateSupportingSourceIds.length === 1
            ? aggregateSupportingSourceIds[0]
            : null
        }
      };
    }
    const supportingSourceIds = Array.isArray(temporalValidation.supportingSourceIds)
      ? temporalValidation.supportingSourceIds
      : [];
    return {
      passed: true,
      reply: String(temporalValidation.reply || reply || "").trim(),
      trace: {
        ...baseTrace,
        passed: true,
        reason: temporalValidation.reason,
        supporting_source_id: supportingSourceIds[0] || null,
        supporting_source_count: supportingSourceIds.length,
        supporting_source_ids: supportingSourceIds,
        temporal_claim_bindings: Array.isArray(temporalValidation.bindings)
          ? temporalValidation.bindings.slice(0, 24)
          : [],
        temporal_missing_years: Array.isArray(temporalValidation.missingTargetYears)
          ? temporalValidation.missingTargetYears
          : [],
        temporal_supplemental_source_ids: Array.isArray(temporalValidation.supplementalSupportingSourceIds)
          ? temporalValidation.supplementalSupportingSourceIds
          : [],
        temporal_supplemental_bindings: Array.isArray(temporalValidation.supplementalBindings)
          ? temporalValidation.supplementalBindings
          : [],
        temporal_supplement_dropped_reason: temporalValidation.supplementalDroppedReason || null,
        year_mode: temporalValidation.yearMode || "temporal_year_value_source_rows",
        whole_scope_checked: true
      }
    };
  }

  if (!claims.length) {
    return { passed: false, reply: failureReply(replyLang), trace: { ...baseTrace, reason: "no_numeric_claim" } };
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
  if (temporalDecision.yearRequested && !yearClaims.length) {
    return { passed: false, reply: failureReply(replyLang), trace: { ...baseTrace, reason: "missing_requested_year" } };
  }
  const yearRequested = temporalDecision.yearRequested;
  const publicationYearRequested = temporalDecision.publicationYearRequested;
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
  const categoryLabels = extractNumericCategoryLabels(reply);
  const uniformRelations = compatibleSources.map(source => ({
    source,
    relation: uniformParticipantRelation(source, reply, categoryLabels)
  }));
  const uniformRelationChecked = asksForCategoricalNumericBreakdown(message) &&
    uniformRelations.some(({ relation }) => relation.checked);
  const uniformCompatibleSources = uniformRelationChecked
    ? uniformRelations.filter(({ relation }) => relation.checked && !relation.mismatch).map(({ source }) => source)
    : compatibleSources;
  if (uniformRelationChecked && !uniformCompatibleSources.length) {
    const relation = uniformRelations.find(item => item.relation.mismatch)?.relation || uniformRelations[0]?.relation;
    return {
      passed: false,
      reply: failureReply(replyLang),
      trace: {
        ...baseTrace,
        reason: "numeric_category_value_mismatch",
        category_relation_checked: true,
        category_relation_mode: "uniform_participant_groups",
        expected_per_group_value: relation?.expectedPerGroupValue || null,
        observed_category_values: relation?.observedCategoryValues || [],
        mismatched_category_labels: relation?.mismatchedCategoryLabels || [],
        expected_total_value: relation?.expectedTotalValue || null,
        observed_total_value: relation?.observedTotalValue || null
      }
    };
  }
  const categoryRelationChecked = asksForCategoricalNumericBreakdown(message) && (
    categoryLabels.length >= 2 || uniformRelationChecked
  );
  const categoryCompatibleSources = categoryRelationChecked
    ? uniformCompatibleSources.filter(source => !unsupportedNumericCategoryLabels(message, reply, source).length)
    : uniformCompatibleSources;
  if (categoryRelationChecked && !categoryCompatibleSources.length) {
    const unsupportedLabels = Array.from(new Set(
      compatibleSources.flatMap(source => unsupportedNumericCategoryLabels(message, reply, source))
    ));
    return {
      passed: false,
      reply: failureReply(replyLang),
      trace: {
        ...baseTrace,
        reason: "unsupported_numeric_category_relation",
        category_relation_checked: true,
        unsupported_category_labels: unsupportedLabels
      }
    };
  }
  const relationCompatibleSources = categoryCompatibleSources.length
    ? categoryCompatibleSources
    : compatibleSources;
  const firstNonYearClaim = claims.find(claim => !claim.year);
  const replyWholeScopeNumbers = extractWholeScopeNumbers(reply);
  const claimedWholeScopeValues = replyWholeScopeNumbers.size
    ? replyWholeScopeNumbers
    : new Set(firstNonYearClaim ? [firstNonYearClaim.value] : []);
  const sourcesWithWholeScope = relationCompatibleSources.filter(source => source.wholeScopeNumbers.size > 0);
  if (
    asksForWholeScope(message) &&
    claimedWholeScopeValues.size &&
    sourcesWithWholeScope.length &&
    !sourcesWithWholeScope.some(source =>
      [...claimedWholeScopeValues].every(value => source.wholeScopeNumbers.has(value))
    )
  ) {
    return {
      passed: false,
      reply: failureReply(replyLang),
      trace: { ...baseTrace, reason: "whole_scope_mismatch" }
    };
  }

  const supportingSource = (
    sourcesWithWholeScope.find(source =>
      [...claimedWholeScopeValues].every(value => source.wholeScopeNumbers.has(value))
    ) ||
    relationCompatibleSources[0]
  );
  const supportingUniformRelation = uniformRelations
    .find(item => item.source === supportingSource)?.relation || null;
  return {
    passed: true,
    reply: String(reply || "").trim(),
    trace: {
      ...baseTrace,
      passed: true,
      reason: "all_claims_in_one_rendered_source",
      supporting_source_id: supportingSource?.sourceId || null,
      duration_equivalence_used: durationEquivalenceUsed,
      category_relation_checked: categoryRelationChecked,
      category_relation_mode: uniformRelationChecked ? "uniform_participant_groups" : null,
      expected_per_group_value: supportingUniformRelation?.expectedPerGroupValue || null,
      observed_category_values: supportingUniformRelation?.observedCategoryValues || [],
      expected_total_value: supportingUniformRelation?.expectedTotalValue || null,
      observed_total_value: supportingUniformRelation?.observedTotalValue || null,
      year_mode: publicationYearRequested ? "publication_year" : yearRequested ? "body_evidence_year" : "not_requested",
      whole_scope_checked: asksForWholeScope(message) && sourcesWithWholeScope.length > 0
    }
  };
}
