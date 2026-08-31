// Typed time evidence shared by context binding and answer validation. A verb
// such as "tehti" (or the unrelated "tegemist") is never a time value.
const MONTHS = [
  /^jaanuar/u, /^veebruar/u, /^marts/u, /^aprill/u, /^mai(?:s|st|ni|kuu\p{L}*)?$/u,
  /^juuni/u, /^juuli/u, /^august/u, /^septemb(?:er|r)/u, /^oktoob(?:er|r)/u,
  /^novemb(?:er|r)/u, /^detsemb(?:er|r)/u
];
const SEASONS = [/^kevad/u, /^(?:suvi|suve)/u, /^sugi(?:s|se)/u, /^talv/u];
const normalize = value => String(value || "").normalize("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase();

export function qualitativeTimePayload(value = "", cardinalValue = () => null) {
  const text = normalize(value);
  const years = Array.from(text.matchAll(/\b(?:19|20)\d{2}\b/gu), match => Number(match[0]));
  const uniqueYears = [...new Set(years)];
  const calendar = [];
  const anchors = [];
  const assignedYearOffsets = new Set();
  for (const match of text.matchAll(/[\p{L}]+/gu)) {
    const month = MONTHS.findIndex(pattern => pattern.test(match[0]));
    const season = SEASONS.findIndex(pattern => pattern.test(match[0]));
    if (month < 0 && season < 0) continue;
    const before = text.slice(Math.max(0, match.index - 28), match.index);
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 24);
    const leadingYear = before.match(/\b((?:19|20)\d{2})(?:\.\s*aasta\p{L}*)?\s*$/u);
    const followingYear = after.match(/^\s+((?:19|20)\d{2})\b/u);
    const leadingOffset = leadingYear ? Math.max(0, match.index - 28) + leadingYear.index : null;
    const followingOffset = followingYear ? match.index + match[0].length + followingYear[0].indexOf(followingYear[1]) : null;
    const unusedLeadingYear = leadingYear && !assignedYearOffsets.has(leadingOffset);
    const year = unusedLeadingYear ? Number(leadingYear[1]) : followingYear ? Number(followingYear[1])
      : uniqueYears.length === 1 ? uniqueYears[0] : null;
    if (unusedLeadingYear) assignedYearOffsets.add(leadingOffset);
    else if (followingYear) assignedYearOffsets.add(followingOffset);
    const day = month >= 0 ? before.match(/\b([1-9]|[12]\d|3[01])\.?\s*$/u) : null;
    calendar.push({ year, month: month >= 0 ? month + 1 : null, season: season >= 0 ? season + 1 : null,
      day: day ? Number(day[1]) : null, offset: match.index });
    anchors.push(match[0]);
  }
  for (const match of text.matchAll(/\b(0?[1-9]|[12]\d|3[01])[./](0?[1-9]|1[012])[./]((?:19|20)\d{2})\b/gu)) {
    calendar.push({ day: Number(match[1]), month: Number(match[2]), year: Number(match[3]), season: null, offset: match.index });
  }
  if (calendar.length) {
    calendar.sort((a, b) => a.offset - b.offset);
    return { kind: "calendar", points: calendar.slice(0, 8).map(({ offset: _offset, ...point }) => point),
      anchor_terms: [...new Set(anchors)].slice(0, 8), numeric_values: uniqueYears.map(String) };
  }
  const relative = text.match(/\b([\p{L}]+|\d+)\s+(paev\p{L}*|nadal\p{L}*|kuu\p{L}*|aasta\p{L}*)\s+(parast|enne)\s+([\p{L}-]+)/u);
  if (relative) {
    const amount = /^\d+$/u.test(relative[1]) ? Number(relative[1]) : cardinalValue(relative[1]);
    if (Number.isFinite(amount) && amount > 0) {
      return { kind: "relative", amount, unit: relative[2].match(/^(?:paev|nadal|kuu|aasta)/u)[0],
        direction: relative[3], reference: relative[4], anchor_terms: [relative[2], relative[4]], numeric_values: [] };
    }
  }
  if (uniqueYears.length && /\b(?:aasta\p{L}*|periood\p{L}*)\b/u.test(text)) {
    return { kind: "calendar", points: uniqueYears.slice(0, 8).map(year => ({ year, month: null, day: null, season: null })),
      anchor_terms: [], numeric_values: uniqueYears.map(String) };
  }
  return null;
}

export function qualitativeTimePayloadMatches(expected, actual, termMatch) {
  if (!expected || !actual || expected.kind !== actual.kind) return false;
  if (expected.kind === "relative") {
    return expected.amount === actual.amount && expected.unit === actual.unit && expected.direction === actual.direction &&
      termMatch(expected.reference, actual.reference) >= 0.72;
  }
  return expected.points.length === actual.points.length && expected.points.every((point, index) =>
    ["year", "month", "day", "season"].every(key => point[key] === actual.points[index][key])
  );
}

export function genericPerformedTimeRelation(relationTerms = []) {
  return relationTerms.length > 0 && relationTerms.every(term =>
    /^(?:tehti|teha|tehtud|tegema|toimu\p{L}*|viidi|labi)$/u.test(normalize(term))
  );
}

export function hasPerformedStudyEvent(value = "") {
  const text = normalize(value);
  // Bind a generic "when was it done" to an actual study/event predicate,
  // not to a subgroup's interview dates or a nominal "tegemist on" clause.
  return /\b(?:uuring|uurimus|uurimine)\b/u.test(text) &&
    /\b(?:toimus|toimub|tehti|tehakse|viidi\s+labi|viiakse\s+labi|on\s+labi\s+viidud)\b/u.test(text);
}

export function isOrdinalTimeBoundary(prefix = "", suffix = "") {
  if (!/\d+\.$/u.test(prefix)) return false;
  const continuation = normalize(suffix).trimStart()
    .replace(/^(?:(?:ja|ning)\s+\d+\.\s*)+/u, "");
  const word = continuation.match(/^[\p{L}]+/u)?.[0] || "";
  return /^(?:aasta|kuu|paev|nadal)/u.test(word) || MONTHS.some(pattern => pattern.test(word));
}
