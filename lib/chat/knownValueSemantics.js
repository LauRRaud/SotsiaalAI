// A bounded, shared evidence/answer parser. Unknown grammar is UNCHECKABLE,
// conflicting propositions are AMBIGUOUS; neither is admitted by token overlap.
// This module contains linguistic concepts, never benchmark values or authors.
const fold = value => String(value || "").normalize("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase();
const unique = values => [...new Set(values)];
const number = value => String(value).replace(",", ".");
const bibliographicCitation = /\(([\p{L}-]+(?:\s+[\p{L}-]+){0,4})\s+(?:jt|et\s+al\.?)\s*,?\s*((?:19|20)\d{2})\)/giu;

function withoutCitations(value) {
  return String(value).replace(bibliographicCitation, match => " ".repeat(match.length));
}

function citationKeys(value) {
  return unique([...fold(value).matchAll(bibliographicCitation)].map(match => `${match[1]}:${match[2]}`));
}

function percentValues(value) {
  return [...fold(value).matchAll(/(?<![\p{L}\d])(\d+(?:[.,]\d+)?)\s*(?:%|protsen\p{L}*)/gu)]
    .map(match => number(match[1]));
}

function frequencyPayload(text) {
  const matches = [...text.matchAll(/\b(?:iga\s+paev|igapaevaselt)(?:\s+voi\s+(?:suurema\s+osa|enamiku|enamuse)\s+ajast)?\b|\b(?:suurema\s+osa|enamiku|enamuse)\s+ajast\b|\bharva\b|\bmonikord\b/gu)];
  if (matches.length !== 1) return null;
  const expression = matches[0][0];
  const values = expression.includes(" voi ") ? ["daily", "most_of_time", "or"]
    : expression.includes("ajast") ? ["most_of_time"] : expression === "harva" ? ["rarely"]
    : expression === "monikord" ? ["sometimes"] : ["daily"];
  return { expression, values };
}

const cohorts = [
  ["girls", /\btudruk\p{L}*/gu], ["boys", /\bpo(?:is|iss)\p{L}*/gu],
  ["women", /\bnai(?:ne|se|si)\p{L}*/gu], ["men", /\bme(?:es|he|hi)\p{L}*/gu]
];
const phenomena = [
  ["loneliness", /\buksild\p{L}*/u], ["anxiety", /\barevu\p{L}*/u],
  ["stress", /\bstress\p{L}*/u], ["fear", /\bhirm\p{L}*/u],
  ["satisfaction", /\brahulolu\p{L}*/u]
];
const relationNoise = /^(?:tahenda\p{L}*|selgita\p{L}*|meaning|means?|interpret\p{L}*|esita\p{L}*|viida\p{L}*|naita\p{L}*|artikl\p{L}*|uuring\p{L}*|uurimus\p{L}*|protsen\p{L}*|osakaal\p{L}*)$/u;

export function knownValueScopeTerms(slot = {}) {
  return (slot.relation_terms || []).map(fold).filter(term => !relationNoise.test(term));
}

function scopeTermPresent(text, term) {
  // Inflection of the same named scope, not unrestricted common-prefix matching.
  return [...text.matchAll(/[\p{L}-]+/gu)].some(match => match[0] === term ||
    (match[0].startsWith(term) && /^(?:s|st|sse|l|lt|le|ga|sse|sest|ne|sed|se)$/u.test(match[0].slice(term.length))));
}

export function knownValueInterpretationCandidate(value = "", anchor = null, scopeTerms = []) {
  const text = fold(withoutCitations(value));
  const fail = status => ({ status, payload: null });
  const percents = percentValues(text);
  if (anchor?.unit !== "percent" || percents.length !== 1 || percents[0] !== number(anchor.value)) return fail("UNCHECKABLE");
  // Do not repair negated/qualified or multi-population claims by guessing a head.
  if (/\b(?:ei|mitte|pole|polnud|umbes|ligikaudu|vahemalt|kuni|ule|alla)\b/u.test(text)) return fail("UNCHECKABLE");
  const ages = [...text.matchAll(/\b(\d{1,3})\s*[-–—]?\s*aasta(?:ste|sed|seid|st|se|ne|stest|stelt|stel)\b/gu)];
  const groups = cohorts.flatMap(([kind, pattern]) => [...text.matchAll(pattern)].map(match => ({ kind, at: match.index, text: match[0] })));
  const measures = phenomena.filter(([, pattern]) => pattern.test(text)).map(([kind]) => kind);
  const frequency = frequencyPayload(text);
  if (ages.length !== 1 || groups.length !== 1 || measures.length !== 1 || !frequency) return fail("UNCHECKABLE");
  if (!/^\s+$/u.test(text.slice(ages[0].index + ages[0][0].length, groups[0].at))) return fail("AMBIGUOUS");
  if (!/\b(?:kusitlet\p{L}*|vastan\p{L}*|uuringus\s+osalen\p{L}*)\b/u.test(text)) return fail("UNCHECKABLE");
  if (!scopeTerms.every(term => scopeTermPresent(text, term))) return fail("UNCHECKABLE");
  const groupEnd = groups[0].at + groups[0].text.length;
  const topical = text.slice(groupEnd).match(/^\s+seas\s*:\s*selles\s+ruhmas\b/u);
  // Two admitted population constructions: a direct ablative denominator, or
  // an explicit topical cohort followed by "in this group". Mere mention of a
  // girl/age near a survey about mothers is not a denominator.
  if (!topical && !/st$/u.test(groups[0].text)) return fail("UNCHECKABLE");
  if (topical && scopeTerms.length && !scopeTerms.some(term =>
    scopeTermPresent(text.slice(0, ages[0].index).trim().split(/\s+/u)[0], term))) return fail("UNCHECKABLE");
  if (topical) {
    let heading = text.slice(0, ages[0].index);
    for (const term of scopeTerms) heading = heading.replace(/[\p{L}-]+/gu, token => scopeTermPresent(token, term) ? " " : token);
    heading = heading.replace(/\b(?:noorte|noortest|naitajad|naitaja|naitajate|olid|oli|on|esinesid|muret|tekitavad|enim|koige|korgemad|korgeimad|suurimad|osas|hulgas|seas)\b/gu, " ");
    if (/[\p{L}\p{N}]/u.test(heading)) return fail("UNCHECKABLE");
  }
  let grammar = topical ? text.slice(groupEnd + topical[0].length)
    : text.slice(0, ages[0].index) + " " + text.slice(groupEnd);
  grammar = grammar.replace(/(?<![\p{L}\d])\d+(?:[.,]\d+)?\s*(?:%|protsen\p{L}*)/gu, " ")
    .replace(/\b(?:kusitlet\p{L}*|vastan\p{L}*|uuringus\s+osalen\p{L}*)\b/gu, " ")
    .replace(frequency.expression, " ");
  if (topical) grammar = grammar.replace(/\bnoortest\b/gu, " ");
  for (const term of scopeTerms) grammar = grammar.replace(/[\p{L}-]+/gu, token => scopeTermPresent(token, term) ? " " : token);
  const predicates = [...grammar.matchAll(/\b(?:tundis|tundsid|tundnud|tunnevad|tunneb|tunnen)\b/gu)];
  if (predicates.length !== 1) return fail("UNCHECKABLE");
  grammar = grammar.replace(predicates[0][0], " ").replace(phenomena.find(([kind]) => kind === measures[0])[1], " ")
    .replace(/\b(?:on|end|ennast)\b/gu, " ").replace(/^\s*\d+[.)]\s*/u, " ");
  // Fully consume the proposition grammar: another predicate, population head,
  // unit, condition or unparsed qualifier makes it uncheckable, not a near match.
  if (/[\p{L}\p{N}]/u.test(grammar)) return fail("UNCHECKABLE");
  return { status: "ADMITTED", payload: { kind: "known_value_interpretation", value: number(anchor.value), unit: "percent",
    population: { cohort: groups[0].kind, age: { value: ages[0][1], unit: "year", operator: "equal" }, surveyed: true },
    measured_phenomenon: measures[0], frequency: frequency.values, scope_terms: [...scopeTerms] } };
}

export function knownValueInterpretationMatches(expected, answer) {
  if (!expected || expected.kind !== "known_value_interpretation") return false;
  const actual = knownValueInterpretationCandidate(answer, expected, expected.scope_terms);
  return actual.status === "ADMITTED" && JSON.stringify(actual.payload) === JSON.stringify(expected);
}

export function referencedStudyPeriodCandidate(value = "", { referenceAnchor = null, referencePayload = null } = {}) {
  const text = fold(withoutCitations(value));
  const fail = status => ({ status, payload: null });
  if (!/\b(?:uuring\p{L}*|uurimus\p{L}*)\b/u.test(text) || /\b(?:ei|mitte|pole|polnud)\b/u.test(text)) return fail("UNCHECKABLE");
  if ([...text.matchAll(/\b(?:uuring\p{L}*|uurimus\p{L}*|kusitlus\p{L}*)\b/gu)].length !== 1 || /;/u.test(text)) return fail("AMBIGUOUS");
  // Dates must be attached to a study/time expression, not merely present in its citation.
  const periods = [...text.matchAll(/\b((?:19|20)\d{2})(?:\s*(?:[/–—-]|kuni)\s*((?:19|20)\d{2}))?\b/gu)]
    .filter(match => {
      const before = text.slice(Math.max(0, match.index - 70), match.index);
      const after = text.slice(match.index + match[0].length, match.index + match[0].length + 40);
      return /^\.?\s*aasta\p{L}*\s+(?:uuring\p{L}*|uurimus\p{L}*)\b/u.test(after) ||
        /\b(?:uuring\p{L}*|uurimus\p{L}*)\s+(?:(?:toimus|tehti|parineb|aeg|periood|viidi\s+labi)\s*)?[:–-]?\s*(?:aasta\p{L}*\s+)?$/u.test(before);
    });
  if (periods.length !== 1) return fail(periods.length ? "AMBIGUOUS" : "UNCHECKABLE");
  const period = periods[0];
  if (period[2] && Number(period[2]) < Number(period[1])) return fail("UNCHECKABLE");
  if (referenceAnchor) {
    if (!referencePayload || referencePayload.kind !== "known_value_interpretation") return fail("UNCHECKABLE");
    if (!percentValues(text).includes(number(referenceAnchor.value))) return fail("UNCHECKABLE");
    // Cross-sentence linking needs an identical explicit bibliography reference.
    // An unrelated adjacent study must not supply the requested observation time.
    const sentences = String(value).split(/(?<!\d)[.!?]\s+/u);
    const periodSentence = sentences.find(sentence => fold(withoutCitations(sentence)).includes(period[0]));
    const anchorSentences = sentences.filter(sentence => knownValueInterpretationMatches(referencePayload, sentence));
    if (anchorSentences.length !== 1) return fail("AMBIGUOUS");
    const anchorSentence = anchorSentences[0];
    if (!periodSentence || !anchorSentence) return fail("UNCHECKABLE");
    const periodReferences = citationKeys(periodSentence);
    const anchorReferences = citationKeys(anchorSentence);
    if (periodReferences.length > 1 || anchorReferences.length > 1) return fail("AMBIGUOUS");
    if (periodSentence !== anchorSentence && (periodReferences.length !== 1 || anchorReferences.length !== 1 ||
      periodReferences[0] !== anchorReferences[0])) {
      return fail("AMBIGUOUS");
    }
  }
  return { status: "ADMITTED", payload: { kind: "referenced_study_period", role: "referenced_study_period",
    start_year: period[1], end_year: period[2] || period[1] } };
}

export function referencedStudyPeriodMatches(expected, answer) {
  // A bare/anaphoric study refers to the question's bound study. A different or
  // explicitly unrelated study with coincidentally equal years cannot satisfy it.
  const head = fold(answer).replace(/^\s*\d+[.)]\s*/u, "").trim();
  const clean = fold(withoutCitations(head)).trim();
  if (!/^(?:(?:viidatud|sama|see)\s+)?(?:uuring|uuringu|uurimus|uurimuse)\s+(?:parineb|toimus|tehti|viidi\s+labi|aeg\s*:|periood\s*:)\s*(?:aasta\p{L}*\s+)?(?:19|20)\d{2}(?:\s*(?:[/–—-]|kuni)\s*(?:19|20)\d{2})?(?:\.?\s*aasta\p{L}*)?[\s.!?]*$/u.test(clean)) return false;
  const actual = referencedStudyPeriodCandidate(answer);
  return actual.status === "ADMITTED" && JSON.stringify(actual.payload) === JSON.stringify(expected);
}

export function typedKnownValueCandidate(slot, text) {
  if (slot.payload_kind === "known_value_interpretation") {
    return knownValueInterpretationCandidate(text, slot.known_anchor, knownValueScopeTerms(slot));
  }
  if (slot.payload_kind === "referenced_study_period") {
    return referencedStudyPeriodCandidate(text, { referenceAnchor: slot.reference_known_anchor, referencePayload: slot.reference_payload });
  }
  return null;
}

export function typedKnownValueMatches(payload, answer) {
  return payload?.kind === "known_value_interpretation" ? knownValueInterpretationMatches(payload, answer)
    : payload?.kind === "referenced_study_period" ? referencedStudyPeriodMatches(payload, answer) : false;
}

export function typedKnownValueCheck(payload, answer) {
  if (payload?.kind !== "known_value_interpretation") return {
    passed: typedKnownValueMatches(payload, answer), reason: "study_period_payload_mismatch"
  };
  const actual = knownValueInterpretationCandidate(answer, payload, payload.scope_terms);
  if (actual.status !== "ADMITTED") return { passed: false, reason: "known_value_payload_uncheckable" };
  if (JSON.stringify(actual.payload.population) !== JSON.stringify(payload.population)) {
    return { passed: false, reason: "known_value_population_mismatch" };
  }
  if (actual.payload.measured_phenomenon !== payload.measured_phenomenon) return { passed: false, reason: "known_value_measure_mismatch" };
  if (JSON.stringify(actual.payload.frequency) !== JSON.stringify(payload.frequency)) return { passed: false, reason: "known_value_frequency_mismatch" };
  return { passed: true, reason: null };
}

export function typedKnownValueMentions(payload, answer) {
  return payload?.kind === "known_value_interpretation" ? percentValues(answer).includes(payload.value)
    : payload?.kind === "referenced_study_period" && /\b(?:uuring\p{L}*|uurimus\p{L}*)\b/u.test(fold(answer));
}

export function splitKnownValueAnswerClaims(text) {
  // Split only explicit independent claims, not "daily OR most of the time".
  // These atoms may share one original sentence; assignment remains one-to-one
  // between facts, rather than prohibiting two facts in a natural sentence.
  return String(text).split(/(?:\s*;\s*|,?\s+(?:ja|ning)\s+)(?=(?:(?:viidatud|sama|see)\s+)?(?:uuring|uuringu|uurimus|uurimuse)\s+(?:parineb|pärineb|toimus|tehti|viidi|aeg|periood)|\d+(?:[.,]\d+)?\s*%)/iu)
    .map(part => part.trim()).filter(Boolean);
}
