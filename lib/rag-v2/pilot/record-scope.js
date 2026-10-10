import { defaultEstnltkAnalyzer } from '../search/estnltk.js';
import { reject, SCOPE_TURN_LIMIT } from './contracts.js';
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

// ADR-127 (10.10.2026): a part of a compound is not the word's own form. The morphology gives a compound its root tokens
// beside its lemma ("Raekülas": raekülas, raeküla, rae, küla), and the place reading took any of them for the word:
// "Raekülas" (a district of the city of Pärnu) and "raekojas" selected Rae vald, "Järvamaal" Järva vald, "Pärnumaal"
// Pärnu linn, "kanepiõli" Kanepi vald. A term is a part when another term of the same word can be written as two or more
// of the word's shorter terms end to end, that term among them (rae + küla = raeküla). A hyphen joins words, not parts,
// and the word as written is never a part. Measured with this rule on the server's own morphology (10.10.2026): of the
// 705 case forms of the municipalities' 76 name words none stops being read ("Saaremaal", "Sillamäel", "Rakveres": the
// name is the compound, not a part of it). What the rule does take away is an island named as a land, where the island is
// its municipality: "Muhumaal" and "Kihnumaal" read as muhu + maa and kihnu + maa. The directory the chat loads gives
// those two back as names of the municipality itself ("Muhumaa", "Kihnumaa": adapters/municipal-directory.js), so the
// whole word is the name and is read wherever a municipality's name is.
function ownTerms(all, word) {
  const list = [...all].map(term => term.slice(4)), parts = new Set();
  for (const whole of list) {
    // from[at]: the start of `whole` up to `at` can be cut into shorter terms; to[at]: so can its rest from `at`.
    const n = whole.length, shorter = list.filter(term => term.length < n), from = Array(n + 1).fill(false), to = Array(n + 1).fill(false);
    from[0] = to[n] = true;
    for (let at = 0; at < n; at++) if (from[at]) for (const term of shorter) if (whole.startsWith(term, at)) from[at + term.length] = true;
    for (let at = n - 1; at >= 0; at--) to[at] = shorter.some(term => whole.startsWith(term, at) && to[at + term.length]);
    for (let at = 0; at < n; at++) if (from[at]) for (const term of shorter) if (whole.startsWith(term, at) && to[at + term.length]) parts.add(term);
  }
  parts.delete(word.normalize('NFC').toLowerCase());
  return new Set([...all].filter(term => !parts.has(term.slice(4))));
}
// ADR-020, ADR-127 (10.10.2026): one test for the four places below (`mentioned` and `starts` of resolveRecordScope and
// of namedOccurrences). A name word is read in a user word only through the word's own readings (never a part of its
// compound), and a hyphenated name only in a hyphenated word and the other way round. Until now only `mentioned` had the
// hyphen rule: with "Keilas" elsewhere in the message `starts` found a second Keila linn in "Keila-Joal" and the turn
// saved it as the residence; "Elan Narva-Jõesuus, mitte Narvas" stayed open between the two.
const reads = (user, word) => !!user && user.own.has(canonical(word)) && word.includes('-') === user.word.includes('-');

async function analyzedWords(text, analyzer) {
  const found = [...text.matchAll(WORD)], breaks = [...text.matchAll(CLAUSE_BREAK)].map(match => match.index), result = [];
  for (let offset = 0; offset < found.length; offset += 96) {
    const batch = found.slice(offset, offset + 96), analyzed = await analyzer.analyze(batch.map(match => match[0]));
    batch.forEach((match, i) => {
      const all = terms(analyzed[i]);
      result.push({ word: match[0], index: match.index, terms: all, own: ownTerms(all, match[0]), clause: breaks.filter(at => at < match.index).length });
    });
  }
  return result;
}

/** The words of a text, each with its own readings (the word as written and its lemmas, lowercase; never a part of a
 * compound, ADR-127), for a lookup that is not the directory's own (ADR-103: settlement names). */
export async function wordTerms(text, analyzer = defaultEstnltkAnalyzer()) {
  return (await analyzedWords(text, analyzer)).map(item => ({ word: item.word, terms: [...item.own].map(term => term.replace(/^vmet/u, '')) }));
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
  if (!Array.isArray(turns) || !turns.length || turns.length > SCOPE_TURN_LIMIT || !Array.isArray(directory) || directory.length > 300
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
    // The test is `reads`: a name word is mentioned only when its own canonical form is among one user word's own
    // readings (ADR-127). Other readings of the name ("Tapa" -> "tapma"), parts of a compound ("Rae" in "Raekülas",
    // "Pärnu" in "Pärnumaal") and parts of a hyphenated user place name ("Narva" in "Narva-Jõesuus") select no area.
    const mentioned = word => userWords.some(user => reads(user, word));
    const matched = names.filter(name => name.words.every(mentioned));
    // A full city/rural-municipality name wins over its ambiguous shared base name.
    const specific = matched.filter(name => !matched.some(other => other.words.length > name.words.length
      && name.words.every(word => other.words.some(another => same(word, another)))));
    // Every occurrence of a name after a negation: that place is left out when the turn affirms another one; a turn
    // that only negates places selects none and does not fall back to an earlier mention (Codex G8, 28.09.2026).
    const starts = name => userWords.flatMap((_, i) => name.words.every((word, k) => reads(userWords[i + k], word)) ? [i] : []);
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
  const nameWords = [...new Set(names.flatMap(name => name.words).filter(word => !GENERIC.has(word.toLowerCase())))];
  for (const user of userWords) user.named = nameWords.some(word => reads(user, word));
  const mentioned = word => userWords.some(user => reads(user, word));
  const matched = names.filter(name => name.words.every(mentioned));
  const specific = matched.filter(name => !matched.some(other => other.words.length > name.words.length
    && name.words.every(word => other.words.some(another => same(word, another)))));
  const starts = name => userWords.flatMap((_, i) => name.words.every((word, k) => reads(userWords[i + k], word)) ? [i] : []);
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
// A past home is no home now ("Elasin Kose vallas, aga enam ma seal ei ela", measured 30.09): elasin, elas, elanud, lived, жил.
const PAST = /^(elasi|elas$|elasime|elasite|elanud|lived$|жил|проживал)/iu;
// The last verb of living before the place in its clause ("tegelikult elab ema Harkus", measured 30.09: the subject stands
// between the verb and the place); 'negated' when a negation stands right before it ("ei ela ema Harkus").
function livingInClause(userWords, i) {
  const clause = userWords[i].clause, word = j => (j >= 0 && userWords[j].clause === clause ? userWords[j].word.toLowerCase() : null);
  let crossed = false;
  for (let j = i - 1; j >= 0 && word(j) !== null; j--) {
    if (!LIVING.test(word(j))) { if (userWords[j].named) crossed = true; continue; }
    if (PAST.test(word(j))) return 'past';
    return ['ei', 'not', 'не'].includes(word(j - 1)) || word(j - 1) === 't' && /^(don|doesn|didn)$/u.test(word(j - 2) || '') ? 'negated' : crossed ? null : 'lives';
  }
  return null;
}
function residenceAt(userWords, i, length) {
  if (negatedAt(userWords, i) || livingInClause(userWords, i) === 'negated') return false;
  const clause = userWords[i].clause, word = j => (j >= 0 && userWords[j].clause === clause ? userWords[j].word.toLowerCase() : null);
  let j = i - 1;
  while (j >= i - 3 && FILLERS.has(word(j))) j--;
  const verb = word(j) || '', last = !userWords[i + length] || userWords[i + length].clause !== clause;
  return RESIDENCE.test(verb) && !PAST.test(verb) && (LIVING.test(verb) || last) || livingInClause(userWords, i) === 'lives';
}
// ADR-074: a mention that stands in the question itself. A syntax rule like the negation above (ET, EN, RU), not a reading
// of the sentence: a question word, or a request to the assistant, stands before the name in its clause ("Kas Maardus saab
// …", "tahan teada, mis toetusi Tartu vald maksab", "Räägi Maardu …"); or the clause has no such word and is a whole
// sentence that ends with a question mark ("Maardus saab isikliku abistaja teenust?"). A place in a clause that only tells
// something is not asked about, whatever question follows it ("töötan Maardus; millist koduteenust ma saan?").
// ADR-128: a request for information that is no question asks too ("Soovin infot Maardu … kohta"): requestedAt below.
const ASKING = new Set(['kas', 'kes', 'kelle', 'keda', 'kellele', 'kellelt', 'kellega', 'mis', 'mille', 'mida', 'millele', 'millest', 'milleks', 'millega', 'milles',
  'milline', 'millise', 'millist', 'millised', 'milliseid', 'missugune', 'missuguse', 'missugust', 'missugused', 'kus', 'kust', 'kuhu', 'kuidas', 'millal', 'miks', 'mitu', 'mitut',
  'räägi', 'rääkige', 'ütle', 'öelge', 'selgita', 'selgitage', 'kirjelda', 'kirjeldage', 'näita', 'näidake', 'otsi', 'otsige', 'leia', 'leidke',
  'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'tell', 'explain', 'describe', 'show', 'find',
  'что', 'чем', 'чего', 'какой', 'какая', 'какое', 'какие', 'какую', 'каких', 'кто', 'кому', 'кого', 'где', 'куда', 'откуда', 'когда', 'как', 'почему', 'зачем', 'сколько', 'ли', 'можно',
  'расскажи', 'расскажите', 'скажи', 'скажите', 'объясни', 'объясните', 'покажи', 'покажите', 'найди', 'найдите']);
// "kui palju", "kui kaua": "kui" asks only before a word of degree; alone it joins clauses ("kui töötan Maardus").
const DEGREE = new Set(['palju', 'suur', 'suure', 'suurt', 'kaua', 'tihti', 'kiiresti', 'pikk', 'pika', 'kallis', 'vana']);
// ADR-128 (10.10.2026): a request for information that is no question. "Soovin infot Maardu isikliku abistaja teenuse
// kohta." holds no question word and no question mark, so ADR-074 kept it with the residence (its own limit). Read on the
// words as written, like ASKING (person, tense and mood carry the rule: "soovin", "soovisin", "soovib" and "ei soovi" are
// one lemma), before the name and in its clause: a wish, need or search word of the speaker (WISH), then, over a few
// filler words only (BETWEEN), a word for what is wanted: information, to know, to ask (WANTED); or a word of interest
// (INTEREST).
// - Two parts, not a wish word alone: "Soovin kolida Maardusse", "Vajan abi Maardus", "Otsin Maardus korterit" and
//   "Palun aidake, töötan Maardus" hold a wish word and ask nothing about Maardu.
// - An information word alone is no request: "Sain infot Maardu linnavalitsusest" is a report. WISH has only present and
//   conditional forms of the speaker ("soovisin", "tahtsin", "sain", "soovib", "wants", "хочет" are not in it).
// - Only fillers between the two: "Soovin jagada infot Maardu linnavalitsuse kohta" gives information ("jagada" is no
//   filler); "would" needs its "like", so "I like the information about Maardu" is no request.
// - NOT_NOW: the word right before a wish or interest word takes it away when it denies it or puts it in the past ("ei
//   tahaks", "don't need", "не нужна"; "oli vaja", "pole vaja", "was looking for", "was interested", "была нужна"):
//   "vaja", "looking", "seeking", "interested" and "нужна" carry no tense themselves.
// - JOINS: where the comma is left out, the request must not reach into a clause that tells something ("Soovin infot
//   koduteenuse kohta sest töötan Maardus"). Left out on purpose: "if" ("I would like to know if home care is available
//   in Maardu"), "as" ("as soon as", "such as" stand inside requests), and "ja", "ning", "või", "vaid", "and", "и", "а",
//   which join the names and matters asked about far more often ("Maardu ja Viimsi valla koduteenuse kohta", "mitte
//   Tartu vaid Maardu kohta").
// - A line break ends the stretch: people write a request and a circumstance on two lines without a full stop ("Soovin
//   infot koduteenuse kohta" and under it "Töötan Maardus"). The cost: a request wrapped over two lines by hand, with
//   the name on the second, is not read.
// - So does a hyphen with a space on both sides, typed for a dash ("Soovin infot koduteenuse kohta - töötan Maardus"):
//   the clause breaks know only the real dashes, and what follows such a hyphen tells something as after a comma. A
//   hyphen inside a word or a name ("e-teenuste", "Põhja-Sakala valla") has no spaces and cuts nothing. The cost, as for
//   the line break: a request with such a hyphen before the name is not read ("Soovin infot - Maardu koduteenus").
// - Lists of their own, apart from ASKING: shortReply reads ASKING, and with the wish words in it "jah, soovin" and "jah
//   palun" would stop being short replies (ADR-103), and every clause with "palun" before a name would ask.
// Limits, kept: a run-on sentence with no joining word or with "ja" ("Soovin infot koduteenuse kohta ja töötan Maardus"),
// an aside in brackets, a denial two words back ("I no longer need …", "pole enam vaja") or by a word the list does not
// hold ("There is no need to ask …": "no" stays out, in Estonian it is a filler, "No tahaks teada …"), another person's
// interest ("My mother is interested in …": the word carries no person), reported speech ("He said he would ask …") and
// "teada anda" (to notify) read as requests; only the second condition of ADR-074 (the plan's queries name that
// municipality and no other) holds them. Not read: a bare name of the matter ("Maardu isikliku abistaja teenus"), the
// wanted word after the name ("Soovin Maardu koduteenuse kohta infot"), the name before the request, no wish word
// ("Infot Maardu koduteenuse kohta"), a third person's wish ("Ema soovib infot …"), punctuation between the wanted word
// and the name ("Soovin infot: Maardu koduteenus"), a spelling the lists do not hold. A first-person clause the plan left
// unattributed stays unresolved as before ("Ma soovin infot …", "I need information …"): this rule sets only `asking`.
const WISH = new Set(['soovin', 'sooviksin', 'sooviks', 'soovime', 'sooviksime', 'tahan', 'tahaksin', 'tahaks', 'tahame', 'tahaksime', 'vajan', 'vajaksin', 'vajame', 'vaja',
  'palun', 'paluksin', 'palume', 'otsin', 'otsime', 'want', 'need', 'would', 'd', 'looking', 'seeking', 'хочу', 'хотим', 'хотел', 'хотела', 'хотелось', 'нужна', 'нужно', 'нужны', 'прошу', 'ищу']);
const BETWEEN = new Set(['saada', 'anna', 'andke', 'mulle', 'meile', 'rohkem', 'täpsemat', 'täpsemalt', 'lisa', 'veel', 'ka', 'natuke', 'veidi', 'väga',
  'like', 'to', 'for', 'get', 'some', 'more', 'бы', 'получить', 'больше']);
const WANTED = new Set(['infot', 'info', 'lisainfot', 'informatsiooni', 'lisainformatsiooni', 'teavet', 'lisateavet', 'teada', 'ülevaadet', 'selgitust', 'selgitusi', 'küsida', 'uurida',
  'information', 'details', 'know', 'ask', 'информация', 'информацию', 'информации', 'сведения', 'узнать', 'знать', 'спросить']);
const INTEREST = new Set(['huvitab', 'huvitaks', 'huvitavad', 'interested', 'интересует', 'интересуют']);
const JOINS = new Set(['et', 'sest', 'kuna', 'kui', 'aga', 'kuid', 'kuigi', 'ent', 'ehkki', 'because', 'since', 'but', 'although', 'though', 'но', 'если', 'поскольку', 'хотя']);
// "t" and "d" are what the word pattern leaves of "don't" and "I'd".
const NOT_NOW = new Set(['ei', 'not', 't', 'не', 'ole', 'pole', 'oli', 'olnud', 'polnud', 'was', 'were', 'была', 'было', 'были']);
function requestedAt(text, userWords, at) {
  const clause = userWords[at].clause, lower = j => userWords[j].word.toLowerCase();
  const reaches = j => userWords[j].clause === clause && !JOINS.has(lower(j)) && !/\n|\s-\s/u.test(text.slice(userWords[j].index, userWords[j + 1].index));
  let from = at;
  while (from > 0 && reaches(from - 1)) from--;
  for (let j = from; j < at; j++) {
    if (j > from && NOT_NOW.has(lower(j - 1))) continue;
    if (INTEREST.has(lower(j))) return true;
    if (!WISH.has(lower(j))) continue;
    let k = j + 1;
    while (k < at && BETWEEN.has(lower(k))) k++;
    if (k < at && WANTED.has(lower(k))) return true;
  }
  return false;
}
function askingAt(text, userWords, at) {
  const clause = userWords[at].clause, lower = j => userWords[j].word.toLowerCase();
  const first = userWords.findIndex((user, j) => user.clause === clause
    && (ASKING.has(lower(j)) || lower(j) === 'kui' && userWords[j + 1]?.clause === clause && DEGREE.has(lower(j + 1))));
  // A question word after the name does not hide a request before it ("Soovin infot Maardu koduteenuse kohta kuidas taotleda").
  if (first >= 0 && first < at || requestedAt(text, userWords, at)) return true;
  if (first >= 0) return false;
  const start = sentenceStart(text, userWords[at].index), stop = text.slice(userWords[at].index).search(SENTENCE_END);
  const end = stop < 0 ? text.length : userWords[at].index + stop;
  return text[end] === '?' && !/[;:,–—]/u.test(text.slice(start, end));
}
// ADR-074: a message that points back at what was just spoken of ("Ja mis see maksab?", "Kuidas ma seda taotleda saan?",
// "Kas sealt saab abi?"): a form of "see" or "need", or "seal, sealt, sinna"; EN and RU likewise. Who speaks does not
// matter (Codex, review of #345: a first-person pronoun is no change of topic); "sest" is a conjunction and is not one.
const BACK = new Set(['see', 'selle', 'seda', 'sellesse', 'selles', 'sellest', 'sellele', 'sellel', 'sellelt', 'selleks', 'sellega', 'need', 'nende', 'neid', 'nendest',
  'nendele', 'nendel', 'nendega', 'seal', 'sealt', 'sinna', 'it', 'its', 'that', 'this', 'those', 'these', 'there',
  'это', 'этого', 'этому', 'этом', 'эта', 'эту', 'этой', 'эти', 'этих', 'там', 'туда', 'оттуда']);
/** Whether a message's words (lowercase) point back at what was spoken of before. */
export const refersBack = messageWords => messageWords.some(word => BACK.has(word));
/** ADR-103: whether a message is a short reply that asks nothing: at most limit words, no question word and no question
 * mark ("jah", "jah, Pihlakodu"). "Ja kuidas taotleda?" is a request of its own (ADR-081). messageWords: lowercase. */
export const shortReply = (messageWords, text, limit) => messageWords.length > 0 && messageWords.length <= limit
  && !/\?/u.test(typeof text === 'string' ? text : '') && !messageWords.some(word => ASKING.has(word));
// ADR-084 (Codex, review of #357-#364, F2): a municipality named by a common word, not by its name ("minu vallas", "oma
// linnas", "elukohajärgses omavalitsuses", "kodukohas"; EN and RU likewise). Such a message says where it asks about:
// "Kas see teenus on ka minu vallas olemas?" points back at the service and asks about the person's own municipality.
// Estonian words are read by their lemma, like the directory's names; the Russian ones by their stem.
// ADR-127 (10.10.2026) leaves this reading on all of a word's terms, not only its own: here the head of a compound still
// says the message names a place by a common word ("kesklinnas", "naabervallas", "koduvallas"), while a name inside a
// compound is not that municipality. As the server's morphology gave them that day: a first part comes as a stem ("valla"
// of "vallavalitsuses", "linna" of "linnavalitsusest") and is no common word, and "valdkonnas" is one root ("valdkond";
// "sotsiaalvaldkonnas" is sotsiaal + valdkond), so a field of work names no place. The cost that stays as it was: any
// compound that ends in "linn" or "vald" does ("vanalinnas", "pealinnas").
const COMMON_PLACE = Object.freeze(['vald', 'linn', 'omavalitsus', 'elukoht', 'kodukoht', 'koduvald', 'kodulinn', 'municipality', 'town', 'city', 'parish', 'hometown']);
const COMMON_PLACE_RU = /^(?:город|волост|самоуправлени|муниципалитет)/iu;
/** Whether a text names a municipality by a common word. */
export async function namesPlaceByCommonWord(text, analyzer = defaultEstnltkAnalyzer()) {
  if (typeof text !== 'string' || !text.trim()) return false;
  return (await analyzedWords(text, analyzer)).some(user => COMMON_PLACE.some(word => user.terms.has(canonical(word))) || COMMON_PLACE_RU.test(user.word));
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
 * its name is two municipalities'), whether it is negated there, whether it stands in the question itself or in a
 * request for information about it (asking, ADR-074 and ADR-128), and its clause. Latin names come through EstNLTK and
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
      negated: negatedAt(userWords, at) || livingInClause(userWords, at) === 'negated', residence: residenceAt(userWords, at, length), asking: askingAt(text, userWords, at),
      clause: { start: clause[0].index, end: clause.at(-1).index + clause.at(-1).word.length,
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
