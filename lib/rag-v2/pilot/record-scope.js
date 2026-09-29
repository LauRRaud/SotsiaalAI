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
const FILLERS = new Set(['enam', 'rohkem', 'praegu', 'nüüd', 'hetkel', 'now', 'сейчас', 'теперь', 'ma', 'mina', 'me', 'meie', 'ta', 'tema', 'nad', 'nemad', 'sa', 'sina', 'te', 'teie',
  'in', 'at', 'from', 'в', 'во', 'на', 'из', 'я', 'мы', 'он', 'она', 'они']);
const RESIDENCE = /^(ela|asu|ole$|olen$|oled$|on$|oleme$|olete$|live|stay|am$|is$|are$|жив|прожива|нахож)/iu;
const CLAUSE_BREAK = /[.!?;:,–—]/gu;

async function analyzedWords(text, analyzer) {
  const found = [...text.matchAll(WORD)], breaks = [...text.matchAll(CLAUSE_BREAK)].map(match => match.index), result = [];
  for (let offset = 0; offset < found.length; offset += 96) {
    const batch = found.slice(offset, offset + 96), analyzed = await analyzer.analyze(batch.map(match => match[0]));
    batch.forEach((match, i) => result.push({ word: match[0], index: match.index, terms: terms(analyzed[i]), clause: breaks.filter(at => at < match.index).length }));
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
export const INTERPRETATION = 'source_scope_only_not_confirmed_residence';
// The quote with the rest of its sentence in the user's message (ADR-049, Codex review 29.09): a quote "Kose vald" from
// "Minu elukoht ei ole Kose vald." must not anchor Kose, so the negation around it is read too.
const SENTENCE_END = /[.!?\n]/u;
export function quotedSentence(text, quote) {
  const at = typeof text === 'string' ? text.indexOf(quote) : -1;
  return at < 0 ? quote : quotedSentenceAt(text, at, quote.length);
}
/**
 * Where a quote is in a text: its exact occurrences, else the ones that differ only in letter case, spacing and
 * punctuation ("elan Tartu vallas mitte Tartu linnas" in "Elan Tartu vallas, mitte Tartu linnas."). Returns
 * { at, length, count } in the text's own characters, or null; no other letter may differ.
 */
export function locateQuote(text, quote) {
  if (typeof text !== 'string' || typeof quote !== 'string' || !quote.trim()) return null;
  const exact = text.indexOf(quote);
  if (exact >= 0) return { at: exact, length: quote.length, count: text.split(quote).length - 1 };
  const loose = value => {
    const chars = [], index = [];
    for (const [i, char] of [...value.matchAll(/./gsu)].map(found => [found.index, found[0]])) {
      if (/[\p{L}\p{N}]/u.test(char)) { chars.push(char.toLowerCase()); index.push(i); }
      else if (chars.length && chars.at(-1) !== ' ') { chars.push(' '); index.push(i); }
    }
    while (chars.at(-1) === ' ') { chars.pop(); index.pop(); }
    return { text: chars.join(''), index };
  };
  const haystack = loose(text), needle = loose(quote).text;
  if (!needle) return null;
  const starts = [];
  for (let from = haystack.text.indexOf(needle); from >= 0; from = haystack.text.indexOf(needle, from + 1)) starts.push(from);
  if (!starts.length) return null;
  const at = haystack.index[starts[0]], last = haystack.index[starts[0] + needle.length - 1];
  return { at, length: last + [...text.slice(last)][0].length - at, count: starts.length };
}
/** The sentence around one located occurrence (Codex J2: never the first occurrence of a repeated place name). */
export function quotedSentenceAt(text, at, length) {
  let start = at, end = at + length;
  while (start > 0 && !SENTENCE_END.test(text[start - 1])) start--;
  while (end < text.length && !SENTENCE_END.test(text[end])) end++;
  return text.slice(start, end);
}
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
  // A person's region that the conversation decided (negated, ambiguous or an unresolved attribution) is never
  // replaced by a search query's text (Codex J1): only a place nobody gave may come from the plan's queries.
  if (scope.state !== 'region_required' || scope.reason || !Array.isArray(planQueries) || !planQueries.length) return scope;
  const planned = await resolveRecordScope(planQueries.slice(0, 8).map((text, index) => ({ turnId: `plan-${index + 1}`, text, mode: 'same' })),
    directory, analyzer);
  // The plan keeps only the place of the person the request is about, so a person-bound scope keeps its person.
  const person = scope.person ? { person: scope.person } : {};
  if (planned.region) return { state: 'search_plan_region', region: planned.region, ...person, interpretation: INTERPRETATION };
  if (planned.state === 'ambiguous_region') return { state: 'search_plan_ambiguous_region', region: null, candidates: planned.candidates, ...person };
  return scope;
}

// Codex follow-up review 29.09 (J1-J3): a quoted clause is read for the one place it names and for the negation at that
// place, whatever else its sentence says ("Mina ei ela Kose vallas, aga ema elab Kose vallas" gives the user a negated
// and the mother an affirmed Kose). The same directory words and negation rule as resolveRecordScope.
async function namedOccurrences(text, directory, analyzer) {
  const names = directory.flatMap(row => row.names.map(name => ({ region: row.region, words: words(name) }))).filter(name => name.words.length);
  const same = (a, b) => canonical(a) === canonical(b);
  const userWords = await analyzedWords(text, analyzer);
  const mentioned = word => userWords.some(user => user.terms.has(canonical(word)) && word.includes('-') === user.word.includes('-'));
  const matched = names.filter(name => name.words.every(mentioned));
  const specific = matched.filter(name => !matched.some(other => other.words.length > name.words.length
    && name.words.every(word => other.words.some(another => same(word, another)))));
  const starts = name => userWords.flatMap((_, i) => name.words.every((word, k) => userWords[i + k]?.terms.has(canonical(word))) ? [i] : []);
  return { userWords, occurrences: specific.flatMap(name => starts(name).map(at => ({ region: name.region, at, length: name.words.length }))) };
}
/** The municipalities a text names, negated or not, in the directory's own names. */
export async function mentionedRegions(text, directory, analyzer = defaultEstnltkAnalyzer()) {
  return [...new Set((await namedOccurrences(text, directory, analyzer)).occurrences.map(item => item.region))].sort();
}
/** Whether the last mention of region in text (a sentence up to the end of a quoted clause) is negated. */
export async function occurrenceNegated(text, region, directory, analyzer = defaultEstnltkAnalyzer()) {
  const { userWords, occurrences } = await namedOccurrences(text, directory, analyzer);
  const last = occurrences.filter(item => item.region === region).sort((a, b) => a.at - b.at).at(-1);
  return last ? negatedAt(userWords, last.at) : false;
}
// A place written in Cyrillic (Codex J1-J3; exact since the review of state v5, 29.09, V3). The plan names it in the
// directory's words ("Kose vald" for "в Козе"). Each Cyrillic word is transliterated by a fixed table and compared
// exactly with every municipality's own name in the whole directory: the word as it is, or without one Russian case
// ending, when the rest is the name, or an a-ending name without its a ("Козе" Kose, "Таллине" Tallinn, "Нарве" Narva;
// a name ending in e is not declined, so "косой" is no Kose).
// Diacritics, z/s and doubled letters are the same on both sides; no other letter may differ. A Latin-script word never
// takes this way (EstNLTK reads it against the directory), so "koos" is no Kose. The link holds only when exactly one
// municipality has the word and it is the one the plan names.
const CYRILLIC = Object.freeze({ а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'o', ж: 's', з: 's', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ts', ш: 's', щ: 's', ъ: '', ы: 'o', ь: '', э: 'e', ю: 'u', я: 'a' });
// At a word's start or after a hyphen, a vowel or a soft sign they carry a j: Йыхви is Jõhvi, Ярве Järve, Вильянди Viljandi.
const IOTATED = Object.freeze({ я: 'ja', ю: 'ju', ё: 'jo' });
const RUSSIAN_ENDINGS = Object.freeze(['ом', 'ой', 'ей', 'ем', 'е', 'у', 'а', 'ы', 'и', 'ю']);
const skeleton = text => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/z/gu, 's').replace(/(.)\1/gu, '$1');
function transliterated(word) {
  const chars = [...word.toLowerCase()];
  return skeleton(chars.map((char, i) => {
    const start = i === 0 || chars[i - 1] === '-';
    if (char === 'й') return start ? 'j' : 'i';
    return IOTATED[char] && (start || /[аеёиоуыэюяьъ]/u.test(chars[i - 1])) ? IOTATED[char] : CYRILLIC[char] ?? char;
  }).join(''));
}
const GENERIC = new Set(['vald', 'linn', 'alev', 'alevik', 'küla', 'maakond']);
const nameSkeletons = row => [...new Set(row.names.flatMap(words).filter(word => !GENERIC.has(word.toLowerCase())).map(skeleton))];
/** The municipalities of the whole directory that one Cyrillic word names. */
function cyrillicRegions(word, directory) {
  if (!/\p{Script=Cyrillic}/u.test(word) || [...word].length < 3) return [];
  const whole = transliterated(word);
  const stems = RUSSIAN_ENDINGS.filter(ending => word.toLowerCase().endsWith(ending) && [...word].length - ending.length >= 3)
    .map(ending => transliterated(word.slice(0, -ending.length)));
  return directory.filter(row => nameSkeletons(row).some(name => name === whole
    || stems.some(stem => stem === name || /a$/u.test(name) && name.length >= 4 && stem === name.slice(0, -1)))).map(row => row.region).sort();
}
/**
 * The municipality a text writes in Cyrillic, from the name the plan gives it: { region, negated, count } when the name is
 * one municipality and words of the text name exactly it (count: how many such words), else { reason }; null when the
 * name is no municipality. negated reads the last such word in text.
 */
export async function translatedMention(text, name, directory, analyzer = defaultEstnltkAnalyzer()) {
  const planned = await mentionedRegions(name, directory, analyzer);
  if (planned.length !== 1) return planned.length ? { reason: 'name_names_several_places' } : null;
  const userWords = await analyzedWords(text, analyzer);
  const found = userWords.map((user, index) => ({ index, regions: cyrillicRegions(user.word, directory) })).filter(item => item.regions.includes(planned[0]));
  if (!found.length) return { reason: 'place_link_unverified' };
  if (found.some(item => item.regions.length > 1)) return { reason: 'name_matches_several_places' };
  return { region: planned[0], negated: negatedAt(userWords, found.at(-1).index), count: found.length };
}
// A mention that says someone lives there: a verb of living right before the place and no negation ("Elan Harku vallas",
// "Я живу в Харку", "I live in Harku"); "olen"/"asun" only when the place ends the clause ("Olen Harkus.", not "Olen Harkus
// tööl"). Whose home it is, is the clause's person's to say.
const LIVING = /^(ela|live|жив|прожива)/iu;
function residenceAt(userWords, i, length) {
  if (negatedAt(userWords, i)) return false;
  const clause = userWords[i].clause, word = j => (j >= 0 && userWords[j].clause === clause ? userWords[j].word.toLowerCase() : null);
  let j = i - 1;
  while (j >= i - 3 && FILLERS.has(word(j))) j--;
  const verb = word(j) || '', last = !userWords[i + length] || userWords[i + length].clause !== clause;
  return RESIDENCE.test(verb) && (LIVING.test(verb) || last);
}
// A clause in the first person plural ("Me elame Tartu linnas", "Мы живём в Козе") speaks of the user and others.
const PLURAL = new Set(['me', 'meie', 'elame', 'oleme', 'asume', 'we', 'мы', 'живём', 'живем']);
/** Whether a clause's words (lowercase) speak in the first person plural. */
export const firstPersonPlural = clauseWords => clauseWords.some(word => PLURAL.has(word));
// A clause in the first person singular ("Ma ei ela enam Kose vallas", "Я больше не живу в Козе") is the user's own,
// unless it says the user lives with someone or speaks in the plural ("me elame", "koos", "вместе", "с мамой").
const SINGULAR = new Set(['ma', 'mina', 'elan', 'olen', 'asun', 'elasin', 'kolisin', 'viibin', 'i', 'я', 'живу', 'проживаю']);
const SHARED = new Set(['me', 'meie', 'elame', 'oleme', 'asume', 'we', 'koos', 'ühes', 'with', 'together', 'мы', 'живём', 'живем', 'вместе', 'с', 'со']);
/** Whether a clause's words (lowercase) speak of the user alone, in the first person singular. */
export const firstPersonSingular = clauseWords => clauseWords.some(word => SINGULAR.has(word)) && !clauseWords.some(word => SHARED.has(word));
/**
 * Every municipality mention of a text (Codex review 30.09, N1-N3): where it is (characters), its municipality (null when
 * its name is two municipalities'), whether it is negated there, and its clause. Latin names come through EstNLTK and
 * Cyrillic ones through the exact transliteration, and both are read the same way.
 */
export async function placeOccurrences(text, directory, analyzer = defaultEstnltkAnalyzer()) {
  const { userWords, occurrences } = await namedOccurrences(text, directory, analyzer);
  const cyrillic = userWords.flatMap((user, at) => cyrillicRegions(user.word, directory).map(region => ({ region, at, length: 1 })));
  const byStart = new Map();
  for (const item of [...occurrences, ...cyrillic]) byStart.set(item.at, [...(byStart.get(item.at) || []), item]);
  return [...byStart.values()].sort((a, b) => a[0].at - b[0].at).map(items => {
    const at = items[0].at, length = Math.max(...items.map(item => item.length)), regions = [...new Set(items.map(item => item.region))];
    const first = userWords[at], last = userWords[at + length - 1], clause = userWords.filter(user => user.clause === first.clause);
    return { region: regions.length === 1 ? regions[0] : null, candidates: regions.sort(), start: first.index, end: last.index + last.word.length,
      negated: negatedAt(userWords, at), residence: residenceAt(userWords, at, length), clause: { start: clause[0].index, end: clause.at(-1).index + clause.at(-1).word.length,
        words: clause.map(user => user.word.toLowerCase()) } };
  });
}
/** How many times a text names each municipality, in the directory's own names (Codex V2: one mention to read). */
export async function regionMentionCounts(text, directory, analyzer = defaultEstnltkAnalyzer()) {
  const counts = new Map();
  for (const item of (await namedOccurrences(text, directory, analyzer)).occurrences) counts.set(item.region, (counts.get(item.region) || 0) + 1);
  return counts;
}
/** Where the sentence around a position starts (the counterpart of quotedSentenceAt). */
export function sentenceStart(text, at) {
  let start = at;
  while (start > 0 && !SENTENCE_END.test(text[start - 1])) start--;
  return start;
}
