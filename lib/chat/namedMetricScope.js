// A deliberately narrow shared parser for the new named-proportion family.
// Unrecognized or conflicting age/time scope remains unsupported, never guessed.
const normalize = value => String(value || "").normalize("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase();
const ageOperators = { ule: "over", "enam kui": "over", "rohkem kui": "over", alla: "under",
  "vahem kui": "under", vahemalt: "at_least", kuni: "at_most", tapselt: "equal" };

export function namedMetricAgeScopes(value = "") {
  const text = normalize(value);
  return [...text.matchAll(/\b(ule|enam\s+kui|rohkem\s+kui|alla|vahem\s+kui|vahemalt|kuni|tapselt)\s+(\d{1,3})\s*[-–—]?\s*aasta\p{L}*\b/gu)]
    .map(match => ({ value: match[2], operator: ageOperators[match[1].replace(/\s+/gu, " ")],
      ...(/\b(?:mitte|ei\s+ole|ei\s+olnud)\s*$/u.test(text.slice(Math.max(0, match.index - 24), match.index)) ? { negated: true } : {}) }));
}

function observationYears(value = "") {
  const text = normalize(value);
  return [...new Set([...text.matchAll(/(?<!\d)(?:19\d{2}|20\d{2}|2100)(?!\d)/gu)]
    .filter(match => {
      const before = text.slice(Math.max(0, match.index - 24), match.index);
      const after = text.slice(match.index + 4);
      return /\baastal\s*$/u.test(before) || /^\.?\s*aastal\b/u.test(after) ||
        /^\.?\s*aasta\s+(?:andme\p{L}*|statistik\p{L}*|naitaj\p{L}*|kohta)\b/u.test(after) ||
        /^\s*:/u.test(after);
    }).map(match => /\bmitte\s*$/u.test(text.slice(Math.max(0, match.index - 16), match.index)) ? `not:${match[0]}` : match[0]))];
}

export function namedMetricScopeMatches(value = "", claimStart = 0, claimEnd = claimStart, constraints = null) {
  if (!constraints) return { passed: true };
  // Preserve offsets; subgroup parentheses and bibliographic citation years
  // cannot supply the main cohort. Newlines may continue a common scope label.
  const text = String(value || "").replace(/\([^()]*\)/gu, match => " ".repeat(match.length));
  const boundaries = [...text.matchAll(/[.;!?]/gu)].filter(match => {
    if (match[0] !== ".") return true;
    const before = text.slice(Math.max(0, match.index - 4), match.index);
    const after = text.slice(match.index + 1);
    return !(/\d$/u.test(before) && /^\d/u.test(after)) &&
      !(/^(?:19\d{2}|20\d{2}|2100)$/u.test(before) && /^\s*aasta\p{L}*\b/iu.test(after));
  }).map(match => match.index);
  const start = Math.max(-1, ...boundaries.filter(index => index < claimStart)) + 1;
  const end = Math.min(text.length, ...boundaries.filter(index => index >= claimEnd));
  const local = text.slice(start, end);
  const ages = namedMetricAgeScopes(local);
  const years = observationYears(local);
  const ageBound = !constraints.age || (ages.length > 0 && ages.every(age =>
    age.value === constraints.age.value && age.operator === constraints.age.operator &&
    (age.negated === true) === (constraints.age.negated === true)));
  const yearBound = !constraints.observation_year ||
    (years.length === 1 && years[0] === constraints.observation_year);
  return { passed: ageBound && yearBound, age_bound: ageBound, observation_year_bound: yearBound };
}
