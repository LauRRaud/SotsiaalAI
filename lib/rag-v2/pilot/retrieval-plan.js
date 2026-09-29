import { reject } from './contracts.js';
import { TYPED_STATE_VERSIONS } from './dialogue-state.js';
import { UNIFIED_RETRIEVAL_VERSION } from '../search/unified.js';
export { UNIFIED_RETRIEVAL_VERSION } from '../search/unified.js';

export function unifiedRetrievalEnabled(config) {
  if (config.retrievalRouting === undefined) return false;
  if (config.retrievalRouting !== UNIFIED_RETRIEVAL_VERSION) reject('unsupported_retrieval_routing', 403);
  return true;
}

const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString().slice(0, 10) === value;
const bound = (value, upper) => value.length === 4 ? `${value}-${upper ? '12-31' : '01-01'}` : value;

// Month names (ET, EN, RU) in any case form: "märtsil", "jaanuaris", "октября", "March".
const MONTHS = [['jaanuar', 'january', 'январ'], ['veebruar', 'february', 'феврал'], ['märts', 'march', 'март'], ['aprill', 'april', 'апрел'],
  ['mai', 'may', 'ма[йя]'], ['juun', 'june', 'июн'], ['juul', 'july', 'июл'], ['august', 'august', 'август'], ['septemb', 'september', 'сентябр'],
  ['oktoob', 'october', 'октябр'], ['novemb', 'november', 'ноябр'], ['detsemb', 'december', 'декабр']];
const MONTH = `(${MONTHS.flat().join('|')})\\p{L}*`;
const monthNumber = word => MONTHS.findIndex(names => names.some(name => new RegExp(`^${name}`, 'iu').test(word))) + 1;
const pad = n => String(n).padStart(2, '0');
const lastDay = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();
// A day or month in words or digits (ADR-041): "1. märtsil 2027", "01.03.2027", "1 March 2027", "2027. aasta jaanuaris".
const DAY_AND_MONTH = [
  [new RegExp(`(?<![\\p{L}\\p{N}])([0-3]?[0-9])\\.?\\s*${MONTH}\\s+([12][0-9]{3})(?![\\p{N}])`, 'giu'), m => ({ day: +m[1], month: monthNumber(m[2]), year: +m[3] })],
  [new RegExp(`(?<![\\p{L}\\p{N}])${MONTH}\\s+([0-3]?[0-9]),?\\s+([12][0-9]{3})(?![\\p{N}])`, 'giu'), m => ({ day: +m[2], month: monthNumber(m[1]), year: +m[3] })],
  [/(?<![\p{L}\p{N}.])([0-3]?[0-9])\.([01]?[0-9])\.([12][0-9]{3})(?![\p{N}])/gu, m => ({ day: +m[1], month: +m[2], year: +m[3] })],
  [new RegExp(`(?<![\\p{L}\\p{N}])([12][0-9]{3})\\.?\\s*(?:a\\.|aasta|года?|г\\.)?\\s+${MONTH}`, 'giu'), m => ({ month: monthNumber(m[2]), year: +m[1] })],
  [new RegExp(`(?<![\\p{L}\\p{N}])${MONTH}\\s+([12][0-9]{3})(?![\\p{N}])`, 'giu'), m => ({ month: monthNumber(m[1]), year: +m[2] })],
];
// A range between two days or months (ADR-044) is one period, so a version in force only in between stays:
// "01.01.2027–31.03.2027", "1. jaanuar 2027 kuni 31. märts 2027", or the year given once at the end: "01.01.–31.03.2027",
// "1. jaanuarist kuni 31. märtsini 2027", "jaanuarist märtsini 2027", "с 1 января по 31 марта 2027".
const SEPARATOR = '\\s*(?:[–—-]|kuni|until|to|through|до|по)\\s*';
const JOINED = new RegExp(`^${SEPARATOR}$`, 'iu');
// Estonian cases alone also say "from ... to": "jaanuarist märtsini 2027", "1. jaanuarist 31. märtsini 2027".
const FROM_MONTH = `(${MONTHS.flat().join('|')})\\p{L}*st`, TO_MONTH = `(${MONTHS.flat().join('|')})\\p{L}*ni`;
const RANGES = [
  [new RegExp(`(?<![\\p{L}\\p{N}])(?:([0-3]?[0-9])\\.?\\s*)?${FROM_MONTH}\\s+(?:kuni\\s+)?(?:([0-3]?[0-9])\\.?\\s*)?${TO_MONTH}\\s+([12][0-9]{3})(?![\\p{N}])`, 'giu'),
    m => [{ day: m[1] && +m[1], month: monthNumber(m[2]), year: +m[5] }, { day: m[3] && +m[3], month: monthNumber(m[4]), year: +m[5] }]],
  [new RegExp(`(?<![\\p{L}\\p{N}.])([0-3]?[0-9])\\.([01]?[0-9])\\.?${SEPARATOR}([0-3]?[0-9])\\.([01]?[0-9])\\.([12][0-9]{3})(?![\\p{N}])`, 'giu'),
    m => [{ day: +m[1], month: +m[2], year: +m[5] }, { day: +m[3], month: +m[4], year: +m[5] }]],
  [new RegExp(`(?<![\\p{L}\\p{N}])([0-3]?[0-9])\\.?\\s*${MONTH}${SEPARATOR}([0-3]?[0-9])\\.?\\s*${MONTH}\\s+([12][0-9]{3})(?![\\p{N}])`, 'giu'),
    m => [{ day: +m[1], month: monthNumber(m[2]), year: +m[5] }, { day: +m[3], month: monthNumber(m[4]), year: +m[5] }]],
  [new RegExp(`(?<![\\p{L}\\p{N}])${MONTH}${SEPARATOR}${MONTH}\\s+([12][0-9]{3})(?![\\p{N}])`, 'giu'),
    m => [{ month: monthNumber(m[1]), year: +m[3] }, { month: monthNumber(m[2]), year: +m[3] }]],
];
const first = ({ day, month, year }) => `${year}-${pad(month)}-${pad(day || 1)}`;
const last = ({ day, month, year }) => day ? first({ day, month, year }) : `${year}-${pad(month)}-${pad(lastDay(year, month))}`;
const blank = (text, match) => text.slice(0, match.index) + ' '.repeat(match[0].length) + text.slice(match.index + match[0].length);
// "Now" in the question ("praegu kehtiva seaduse järgi", "täna", "currently") returns to today's law only.
const NOW = /(?<![\p{L}])(praegu|praegu\p{L}+|täna|tänane|tänase|tänast|hetkel|hetkeseis\p{L}*|now|currently|today|сейчас|сегодня|нынешн\p{L}*)(?![\p{L}])/iu;

/** Date syntax only, not an intent classifier: years and ranges, and days or months in words or digits. They are
 * candidates for the publication search (years and ranges only) and additional legal validity periods beside
 * today's law, never a rule that removes today's law (a birth date or an appointment keeps it). */
export function dateCandidates(text, turn) {
  const periods = [];
  let masked = text;
  const add = (from, to, quote, precision) => {
    if (!validDate(from) || !validDate(to) || from > to) return false;
    if (!periods.some(previous => previous.from === from && previous.to === to)) periods.push({ from, to, basis: 'unspecified', support: [{ turn, quote }], ...(precision ? { precision } : {}) });
    return true;
  };
  // Ranges first: read as single days they would lose every version in force only in between.
  for (const [pattern, read] of RANGES) {
    for (const match of masked.matchAll(pattern)) {
      const [start, end] = read(match);
      if (!start.month || !end.month) continue;
      if (!add(first(start), last(end), match[0], 'range')) return { state: 'invalid_date_candidate', periods: [] };
      masked = blank(masked, match);
    }
  }
  const singles = [];
  for (const [pattern, read] of DAY_AND_MONTH) {
    for (const match of masked.matchAll(pattern)) {
      const value = read(match);
      if (!value.month) continue;
      singles.push({ ...value, start: match.index, end: match.index + match[0].length, quote: match[0] });
      masked = blank(masked, match);
    }
  }
  singles.sort((a, b) => a.start - b.start);
  for (let i = 0; i < singles.length; i++) {
    const value = singles[i], next = singles[i + 1];
    // Two full dates joined by a dash or "kuni" are one range: "01.01.2027–31.03.2027".
    const range = next && JOINED.test(text.slice(value.end, next.start));
    const ok = range ? add(first(value), last(next), text.slice(value.start, next.end), 'range')
      : add(first(value), last(value), value.quote, value.day ? 'day' : 'month');
    if (!ok) return { state: 'invalid_date_candidate', periods: [] };
    if (range) i++;
  }
  const dates = '(?:[12][0-9]{3}-[0-9]{2}-[0-9]{2}|[12][0-9]{3})';
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${dates})(?:${SEPARATOR}(${dates}))?(?![\\p{L}\\p{N}-])`, 'giu');
  for (const match of masked.matchAll(pattern)) {
    if (!add(bound(match[1], false), bound(match[2] || match[1], true), match[0], null)) return { state: 'invalid_date_candidate', periods: [] };
  }
  return periods.length > 2 ? { state: 'too_many_date_candidates', periods: [] }
    : { state: periods.length ? 'numeric_candidates_not_confirmed_intent' : 'no_numeric_candidates', periods };
}

export function retrievalPlan(query) {
  const turns = query.scopeTurns, previous = query.previousState;
  if (!Array.isArray(turns) || !turns.length || turns.length > 8) reject('invalid_unified_query');
  const offset = previous?.sourceTurnIds.length || 0;
  if (previous && (!TYPED_STATE_VERSIONS.includes(previous.version) || offset >= turns.length
    || previous.sourceTurnIds.some((id, index) => turns[index]?.turnId !== id))) reject('invalid_unified_query');
  let temporal = null;
  for (let i = turns.length - 1; i >= offset; i--) {
    const found = dateCandidates(turns[i].text, i + 1);
    if (found.state !== 'no_numeric_candidates') { temporal = found; break; }
    // "Now" without a date: today's law again, also after a period the model recorded (ADR-041).
    if (NOW.test(turns[i].text)) { temporal = { state: 'now', periods: [] }; break; }
    if (turns[i].mode === 'correction') { temporal = { state: 'cleared_by_correction', periods: [] }; break; }
  }
  temporal ||= { state: previous ? 'previous_model_interpretation' : 'no_period', periods: previous?.value.periods || [] };
  return { version: UNIFIED_RETRIEVAL_VERSION, temporal,
    // Event/validity ranges stay visible as intent context but cannot filter publication dates.
    // A day or a month in the question is not a publication period of journals.
    publicationCandidates: temporal.periods.filter(period => ['publication', 'unspecified'].includes(period.basis) && !period.precision),
    // A legal text is kept in a version valid today or in a period the user asked about (event, rule validity
    // or unclear), never because of a publication period (legal-validity.js).
    legalPeriods: temporal.periods.filter(period => period.basis !== 'publication'),
    knowledgeFilters: {}, interpretation: 'bounded_evidence_selection_not_verified_intent' };
}

export const UNIFIED_RETRIEVAL_INSTRUCTIONS = ' Unified retrieval: evidence.retrieval describes bounded candidate lanes, not a decision about the user\'s intent. '
  + 'Answer the current request using relevant evidence across lanes; an available municipal catalogue does not make every question a service request. Ask for locality only if the requested local help needs it. '
  + 'Period lanes filter ONLY publication dates of indexed journal documents. Numeric date candidates may describe a birth, an event, an appointment or an example; do not treat them as confirmed publication intent. The unrestricted knowledge lane remains available. '
  + 'Use publication-period evidence only when the requested time meaning matches. Preserve event time, rule/service validity, source publication, collection and checking dates separately. '
  + 'Coverage counts indexed source documents, not chunks, people, events or deduplicated articles. Selected excerpts are a sample; coverage metadata does not prove every document was read or every topic found. '
  + 'For a comparison use evidence from each relevant period, attribute observations to those sources, and state a narrow gap if one side is missing. Never infer prevalence, absence, causality or a corpus-wide trend from top-ranked excerpts. '
  + 'evidence.retrieval.scope.legal_validity: a legal text is in the evidence only in a version in force on as_of (today in Estonia) or in a listed period; excluded lists versions left out as not yet in force, expired or of unknown validity, with their dates. '
  + 'For a legal rule, compare the date the user asks about with each legal source\'s valid_from and valid_to. If no source in the evidence is in force at that date, say that the text in force then is not in the collection, name any excluded version with its dates, and do not state the rule from another version or from memory as the rule in force. '
  + 'evidence.retrieval.scope.municipality: a municipality\'s own texts are included only for the municipality named in the conversation (regions); when none is named, no local rules are included, so do not generalize from any municipality and ask for the municipality only if the answer depends on local rules. '
  + 'Do not present unrelated numeric candidates or the internal routing report to the user. If period meaning or requested range is unclear and affects the answer, ask a focused question in natural language. No additional planning call is needed.';
