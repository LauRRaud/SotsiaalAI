import { defaultEstnltkAnalyzer } from '../search/estnltk.js';
import { reject } from './contracts.js';
import { nonempty } from '../contracts.js';

const WORD = /[\p{L}\p{M}]+(?:-[\p{L}\p{M}]+)*/gu;
const words = text => text.match(WORD) || [];
const terms = text => new Set(text.split(' ').filter(Boolean));
const canonical = word => `vmet${word.normalize('NFC').toLowerCase()}`;
// A place the user says it is not (ADR-044), ET, EN and RU. A syntax rule, not a reading of the whole sentence:
// - a particle right before the name: "Tartu vallas, mitte Tartu linnas", "pole enam Tallinnas", "not in Tallinn", "не в Таллинне";
// - a negated verb of living there: "ei ela enam Tallinnas", "don't live in Tallinn", "не живу в Таллинне".
// Another negated action keeps the place ("ei saa Tallinnas abi"), and a negation never reaches over a sentence or
// comma boundary ("Ma ei tea. Elan Tallinnas.").
const PARTICLES = new Set(['mitte', 'pole', 'not', 'не']);
const FILLERS = new Set(['enam', 'rohkem', 'praegu', 'ma', 'mina', 'me', 'meie', 'ta', 'tema', 'nad', 'nemad', 'sa', 'sina', 'te', 'teie',
  'in', 'at', 'from', 'в', 'во', 'на', 'из', 'я', 'мы', 'он', 'она', 'они']);
const RESIDENCE = /^(ela|asu|ole$|olen$|oled$|on$|oleme$|olete$|live|stay|am$|is$|are$|жив|прожива|нахож)/iu;
const CLAUSE_BREAK = /[.!?;:,–—]/gu;

async function analyzedWords(text, analyzer) {
  const found = [...text.matchAll(WORD)], breaks = [...text.matchAll(CLAUSE_BREAK)].map(match => match.index), result = [];
  for (let offset = 0; offset < found.length; offset += 96) {
    const batch = found.slice(offset, offset + 96), analyzed = await analyzer.analyze(batch.map(match => match[0]));
    batch.forEach((match, i) => result.push({ word: match[0], terms: terms(analyzed[i]), clause: breaks.filter(at => at < match.index).length }));
  }
  return result;
}

/** The occurrence of a name that starts at word i is one the user negates. */
function negatedAt(userWords, i) {
  const clause = userWords[i].clause;
  const word = j => (j >= 0 && userWords[j].clause === clause ? userWords[j].word.toLowerCase() : null);
  let j = i - 1;
  while (j >= i - 3 && FILLERS.has(word(j))) j--;
  if (PARTICLES.has(word(j))) return true;
  if (!RESIDENCE.test(word(j) || '')) return false;
  const k = j - 1;
  return ['ei', 'not', 'не'].includes(word(k)) || word(k) === 't' && /^(don|doesn|didn)$/.test(word(k - 1) || '');
}

// ADR-049: the persons of a v3 dialogue state. "user" is the user themself; "unclear" names nobody.
export const USER_PERSON = 'user', UNCLEAR_PERSON = 'unclear';
export const personKey = person => person.normalize('NFC').trim().toLowerCase();
const INTERPRETATION = 'source_scope_only_not_confirmed_residence';
/** The region of the person the latest request was about: a v3 state names the person, earlier ones keep one region. */
export function focusRegion(value) {
  if (!value.people) return value.region;
  const focus = personKey(value.focus);
  return value.people.find(entry => personKey(entry.person) === focus)?.region || { id: null, status: 'unknown', support: [] };
}
// The search plan read whose need the current request is about (ADR-049). That person keeps their own municipality,
// or has none yet: never the municipality of another person the conversation was about (Codex review 29.09: the user
// asking about their own place got the mother's Kose vald).
function personScope(value, person, directory) {
  if (!value?.people || typeof person !== 'string' || personKey(person) === UNCLEAR_PERSON) return null;
  const key = personKey(person), region = value.people.find(item => personKey(item.person) === key)?.region;
  return region?.id && directory.some(row => row.region === region.id)
    ? { state: 'person_region', region: region.id, person: key, interpretation: INTERPRETATION }
    : { state: 'region_required', region: null, person: key };
}

/** Names come from an adapter's canonical directory, never a list of hand-written
 * inflections. A mention selects evidence scope, not a verified residence fact.
 * person and planQueries: whose need the search plan says the current message is about, and its queries (ADR-049). */
export async function resolveRecordScope(turns, directory, analyzer = defaultEstnltkAnalyzer(), previousState = null, { person = null, planQueries = [] } = {}) {
  if (!Array.isArray(turns) || !turns.length || turns.length > 8 || !Array.isArray(directory) || directory.length > 300
    || directory.some(row => !nonempty(row.region) || row.region.length > 100 || !Array.isArray(row.names) || !row.names.length
      || row.names.some(name => !nonempty(name) || name.length > 200))) reject('invalid_record_scope');
  const names = directory.flatMap(row => row.names.map(name => ({ region: row.region, words: words(name) }))).filter(name => name.words.length);
  const same = (a, b) => canonical(a) === canonical(b);
  const previousIds = previousState?.sourceTurnIds || [];
  if (previousState && (!previousIds.length || previousIds.length >= turns.length
    || previousIds.some((id, i) => id !== turns[i]?.turnId))) reject('invalid_record_scope');
  // A validated state retires earlier mentions. Only newer user turns can select
  // a different area; do not rediscover a locality the user has since retracted.
  // After the current turn, a known municipality of the person it is about comes before an older turn whose state was
  // not kept (ADR-049); without one, that older turn may still say where the person is.
  for (const [index, turn] of turns.slice(previousIds.length).reverse().entries()) {
    if (index === 1) { const bound = personScope(previousState?.value, person, directory); if (bound?.region) return bound; }
    const userWords = await analyzedWords(turn.text, analyzer);
    // A name word is mentioned only when its own canonical form is among one user
    // word's surface/lemma terms. Other readings of the name ("Tapa" -> "tapma"),
    // shared compound parts ("Lääne-", "Pärnu" in "Põhja-Pärnumaa") and parts of a
    // hyphenated user place name ("Narva" in "Narva-Jõesuus") select no area.
    const mentioned = word => userWords.some(user => user.terms.has(canonical(word)) && word.includes('-') === user.word.includes('-'));
    const matched = names.filter(name => name.words.every(mentioned));
    // A full city/rural-municipality name wins over its ambiguous shared base name.
    const specific = matched.filter(name => !matched.some(other => other.words.length > name.words.length
      && name.words.every(word => other.words.some(another => same(word, another)))));
    // Every occurrence of a name after a negation: that place is left out when the turn affirms another one; a turn
    // that only negates places selects none and does not fall back to an earlier mention (Codex G8, 28.09.2026).
    const starts = name => userWords.flatMap((_, i) => name.words.every((word, k) => userWords[i + k]?.terms.has(canonical(word))) ? [i] : []);
    const negated = name => { const at = starts(name); return at.length > 0 && at.every(i => negatedAt(userWords, i)); };
    const affirmed = specific.filter(name => !negated(name));
    if (specific.length && !affirmed.length) return { state: 'region_required_after_negation', region: null };
    const regions = [...new Set(affirmed.map(name => name.region))];
    // The current message names another place than the known one of the person it is about ("Naabri omavalitsus on
    // Kose vald. Millist abi saan mina oma vallast?"). The plan's queries keep only that person's place, so they tell
    // whose the named place is: the person's own place in them keeps it; otherwise the mention wins (a move).
    if (regions.length === 1 && index === 0) {
      const bound = personScope(previousState?.value, person, directory);
      if (bound?.region && bound.region !== regions[0] && planQueries.length
        && (await resolveRecordScope(planQueries.slice(0, 8).map((text, i) => ({ turnId: `plan-${i + 1}`, text, mode: 'same' })), directory, analyzer)).region === bound.region) return bound;
    }
    if (regions.length === 1) return { state: 'mentioned_region', region: regions[0], turn_id: turn.turnId,
      interpretation: INTERPRETATION };
    // The candidates bound the knowledge lane's municipal texts (Tartu linn and Tartu vald, not a third one).
    if (regions.length > 1) return { state: 'ambiguous_region', region: null, candidates: regions.sort() };
    if (turn.mode === 'correction') return { state: 'region_required_after_correction', region: null };
  }
  if (previousState) {
    const bound = personScope(previousState.value, person, directory);
    if (bound) return bound;
    const region = focusRegion(previousState.value), focus = previousState.value.people ? personKey(previousState.value.focus) : null;
    // A v3 scope says whose municipality it is, so the answer can tell the neighbour's apart from the user's.
    if (region.id && directory.some(row => row.region === region.id)) return { state: 'dialogue_region', region: region.id,
      ...(focus ? { person: focus } : {}), interpretation: INTERPRETATION };
    return { state: region.status === 'ambiguous' ? 'ambiguous_region' : 'region_required', region: null };
  }
  return { state: 'region_required', region: null };
}

/** The knowledge lane's municipality (Codex review 27.09.2026). The conversation's own resolution comes first. When
 * the user's words name no municipality the resolver can read (another script: "в Нарва-Йыэсуу"), the search plan's
 * Estonian queries, which keep the places the user gave, are read the same way. A retracted place is never
 * rediscovered this way. A source scope only, never a residence fact. */
export async function knowledgeRegionScope(scope, planQueries, directory, analyzer = defaultEstnltkAnalyzer()) {
  if (scope.state !== 'region_required' || !Array.isArray(planQueries) || !planQueries.length) return scope;
  const planned = await resolveRecordScope(planQueries.slice(0, 8).map((text, index) => ({ turnId: `plan-${index + 1}`, text, mode: 'same' })),
    directory, analyzer);
  // The plan keeps only the place of the person the request is about, so a person-bound scope keeps its person.
  const person = scope.person ? { person: scope.person } : {};
  if (planned.region) return { state: 'search_plan_region', region: planned.region, ...person, interpretation: INTERPRETATION };
  if (planned.state === 'ambiguous_region') return { state: 'search_plan_ambiguous_region', region: null, candidates: planned.candidates, ...person };
  return scope;
}
