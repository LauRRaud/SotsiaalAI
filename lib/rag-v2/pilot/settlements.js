import { defaultEstnltkAnalyzer } from '../search/estnltk.js';
import { mentionedRegions, wordTerms, locateQuote } from './record-scope.js';

// ADR-103 (07.10.2026): a settlement is not a municipality. The place reading knew the 78 municipalities' own names
// only, so a user who answered "Tabasalu" (an alevik of Harku vald) to the question about the municipality got four
// general answers: no turn had a municipality, and Harku's own rules and contacts never reached the answer.
//
// A settlement name is read only where something says the word is a place:
// - the search plan attributed it as a place (its quote in a message the saved state has not read);
// - the current message is a bare reply (at most three words) to an open question about a place;
// - the saved state already anchors a person's municipality in a quote with that name.
// Nothing else is scanned for the 4700 names: "Jüri", "Anna" and "Peetri" are people too, and "Ole", "Loo" and "Vee"
// are words. An admitted settlement becomes one more name of its municipality for this turn's directory, so every
// reading that follows (whose place, a negation, a question, the plan's queries, the saved state's anchor) is the one
// the municipalities' own names get. A name of several municipalities becomes a name of each: the turn is ambiguous
// between them and the answer asks.
const KIND_NAMES = Object.freeze({ k: 'küla', a: 'alevik', v: 'alev', l: 'linn', o: 'linnaosa' });
// A town before a district, an alev, an alevik and a village of the same name: "Kuressaare" is the town in Saaremaa
// vald, not the village of that name in Viljandi vald; "Nõmme" the district of Tallinn before eight villages.
const RANK = Object.freeze({ l: 5, o: 4, v: 3, a: 2, k: 1 });
// The kind a message or the plan's name gives the place ("Nõmme külas", "Peetri alevik").
const KIND_WORDS = new Map(Object.entries({ küla: 'k', külas: 'k', külast: 'k', külla: 'k', alevik: 'a', alevikus: 'a', alevikust: 'a', alevikku: 'a',
  alev: 'v', alevis: 'v', alevist: 'v', linn: 'l', linnas: 'l', linnast: 'l', linnaosa: 'o', linnaosas: 'o', linnaosast: 'o' }));
const key = name => name.normalize('NFC').toLowerCase();
// Case endings a name takes where the morphology does not give the name itself ("Vanamõisas", "Haabneemes").
const ENDINGS = Object.freeze(['sse', 'st', 'lt', 'le', 's', 'l']);
export const SETTLEMENT_LIMITS = Object.freeze({ admitted: 6, replyWords: 3, replyNameLetters: 4 });

/**
 * The settlements an adapter knows, as rows { name, kind, region, preferred }: the official units of the regions the
 * directory has, and the adapter's own hand-written aliases (a district, a village), which decide before the official
 * units when both know a name (preferred). units: { region: 'Name:kind;…' }; aliases: [{ place, region }].
 */
export function settlementRows(units, aliases, directory) {
  const known = new Set(directory.map(row => row.region)), rows = [];
  for (const [region, list] of Object.entries(units)) {
    if (!known.has(region)) continue;
    for (const item of list.split(';')) { const at = item.lastIndexOf(':'); rows.push({ name: item.slice(0, at), kind: item.slice(at + 1), region, preferred: false }); }
  }
  for (const alias of aliases) {
    if (!known.has(alias.region)) continue;
    const official = rows.find(row => row.region === alias.region && key(row.name) === key(alias.place));
    rows.push({ name: alias.place, kind: official?.kind ?? null, region: alias.region, preferred: true });
  }
  return rows;
}

const INDEX = new WeakMap();
function indexOf(rows) {
  if (!INDEX.has(rows)) {
    const index = new Map();
    for (const row of rows) index.set(key(row.name), [...(index.get(key(row.name)) || []), row]);
    INDEX.set(rows, index);
  }
  return INDEX.get(rows);
}

/** The settlement one word names: { name, kind, regions } or null. hint: the kind the text gives it, when it does. */
function settlementOf(index, word, terms, hint = null) {
  const surface = key(word);
  // The word as written; a reading of the whole word (never a part of a compound: "salu" in "Tabasalus"); the word
  // without a case ending.
  const whole = terms.filter(term => surface.startsWith(term) && term.length >= Math.max(3, surface.length - 4)).sort((a, b) => b.length - a.length);
  const stripped = ENDINGS.filter(ending => surface.endsWith(ending) && surface.length - ending.length >= 3).map(ending => surface.slice(0, -ending.length));
  for (const candidate of [surface, ...whole, ...stripped]) {
    let entries = index.get(candidate);
    if (!entries) continue;
    // The kind the text gives first ("Nõmme külas" is a village, not the district); then the adapter's own names; then
    // the units of the highest kind.
    if (hint && entries.some(entry => entry.kind === hint)) entries = entries.filter(entry => entry.kind === hint);
    if (entries.some(entry => entry.preferred)) entries = entries.filter(entry => entry.preferred);
    else {
      const top = Math.max(...entries.map(entry => RANK[entry.kind] || 0));
      entries = entries.filter(entry => (RANK[entry.kind] || 0) === top);
    }
    // read: the official name is among the word's own readings, so the name alone finds the word in the directory's
    // matching; otherwise the word as written is a second name (withSettlements), never both for one word.
    return { name: entries[0].name, kind: entries.every(entry => entry.kind === entries[0].kind) ? entries[0].kind : null, regions: [...new Set(entries.map(entry => entry.region))].sort(),
      read: surface === key(entries[0].name) || terms.includes(key(entries[0].name)) };
  }
  return null;
}

/** The settlements a text names. A text that names a municipality by its own name names no settlement here: the
 * municipality's name decides ("Elan Tabasalus, Harku vallas"; "Kose" is Kose vald). */
async function settlementsIn(text, index, directory, analyzer, { minLetters = 1, name = null } = {}) {
  if (typeof text !== 'string' || !text.trim() || (await mentionedRegions(text, directory, analyzer)).length) return [];
  const words = await wordTerms(text, analyzer), found = [];
  // The kind the plan's own name for the place carries decides among same-named units ("Nõmme küla").
  const planned = typeof name === 'string' ? name.split(/\s+/u).map(part => KIND_WORDS.get(key(part))).find(Boolean) || null : null;
  for (const [i, item] of words.entries()) {
    if (KIND_WORDS.has(key(item.word))) continue;
    const hint = KIND_WORDS.get(key(words[i + 1]?.word || '')) || planned;
    if ([...item.word].length < minLetters && !KIND_WORDS.has(key(words[i + 1]?.word || ''))) continue;
    const settlement = settlementOf(index, item.word, item.terms, hint);
    if (settlement) found.push({ ...settlement, word: item.word });
  }
  return found;
}

// The saved state's open questions that ask for a place (ET, EN, RU): a bare reply to one of them is a place.
const PLACE_QUESTION = /elukoh|omavalitsus|\bvald|\bvalla|\blinn|asukoh|piirkon|\bkus\b|kuhu|municipal|\bwhere\b|\blive|resid|\btown\b|\bcity\b|волост|город|муниципалитет|самоуправлен|где\b|прожива|жив[её]/iu;
const asksForPlace = value => (value?.unknowns || []).some(item => typeof item?.question === 'string' && PLACE_QUESTION.test(item.question));
// Words a bare reply may hold beside the place.
const REPLY_WORDS = new Set(['jah', 'jaa', 'ja', 'ei', 'elan', 'elab', 'elame', 'olen', 'on', 'asun', 'asub', 'siin', 'seal', 'praegu', 'hetkel', 'minu', 'mu', 'tema',
  'yes', 'no', 'in', 'да', 'нет', 'в']);

/**
 * The settlements admitted for one turn. rows: the adapter's settlements (settlementRows); directory: the
 * municipalities' own names; places: the plan's place attributions; messages: the conversation's messages as
 * { turn, text, read } (read: the saved state has read it); previousValue: the saved state's value.
 * Each is { name, kind, word, read, regions, turn, via } with via "plan", "reply" or "state".
 */
export async function admittedSettlements({ rows, directory, places = [], messages = [], previousValue = null, analyzer = defaultEstnltkAnalyzer() }) {
  if (!Array.isArray(rows) || !rows.length || !Array.isArray(directory)) return [];
  const index = indexOf(rows), admitted = [], current = messages.filter(item => !item.read).at(-1);
  const admit = (found, turn, via) => { for (const item of found) if (!admitted.some(other => other.turn === turn && key(other.word) === key(item.word))) admitted.push({ ...item, turn, via }); };
  // The plan's attributions, in the messages the saved state has not read (checkedTurnPlaces reads the same ones).
  for (const place of Array.isArray(places) ? places.slice(0, 4) : []) {
    if (!place || typeof place.quote !== 'string' || !place.quote.trim() || place.quote.length > 160 || !Number.isSafeInteger(place.turn)) continue;
    const message = messages.find(item => item.turn === place.turn), found = message && !message.read ? locateQuote(message.text, place.quote) : null;
    if (!found) continue;
    const quote = message.text.slice(found.at, found.at + found.length);
    let named = await settlementsIn(quote, index, directory, analyzer, { name: place.name });
    // A place written in another script ("в Табасалу") is the settlement the plan names; the existing reading links
    // the name to a word of the clause (translatedMention), or leaves it unresolved.
    if (!named.length && /\p{Script=Cyrillic}/u.test(quote) && typeof place.name === 'string' && place.name.length <= 80) {
      named = (await settlementsIn(place.name, index, directory, analyzer, { name: place.name })).map(item => ({ ...item, word: item.name }));
    }
    admit(named, place.turn, 'plan');
  }
  // A bare reply to an open question about a place.
  if (current && asksForPlace(previousValue)) {
    const words = current.text.match(/[\p{L}\p{M}]+(?:-[\p{L}\p{M}]+)*/gu) || [];
    if (words.length && words.length <= SETTLEMENT_LIMITS.replyWords) {
      const found = await settlementsIn(current.text, index, directory, analyzer, { minLetters: SETTLEMENT_LIMITS.replyNameLetters });
      const rest = words.filter(word => !found.some(item => key(item.word) === key(word)) && !KIND_WORDS.has(key(word)));
      if (found.length === 1 && rest.every(word => REPLY_WORDS.has(key(word)))) admit(found, current.turn, 'reply');
    }
  }
  // What the saved state already anchors: a person's municipality whose quote names a settlement of it.
  for (const entry of previousValue?.people || []) {
    for (const source of entry.region?.id ? entry.region.support || [] : []) {
      const found = (await settlementsIn(source.quote, index, directory, analyzer)).filter(item => item.regions.includes(entry.region.id));
      admit(found, source.turn, 'state');
    }
  }
  return admitted.slice(0, SETTLEMENT_LIMITS.admitted);
}

/** The directory with each admitted settlement as one more name of its municipality or municipalities: its official
 * name, and the word as the user wrote it where the morphology does not read the name from it ("Vanamõisas"), so the
 * directory's own matching finds the mention whatever its case ending, and finds it once. */
export function withSettlements(directory, admitted) {
  if (!Array.isArray(admitted) || !admitted.length) return directory;
  const rows = directory.map(row => ({ ...row, names: [...row.names] }));
  for (const item of admitted) {
    for (const row of rows.filter(entry => item.regions.includes(entry.region))) {
      for (const name of item.read === false ? [item.name, item.word] : [item.name]) if (typeof name === 'string' && name && name.length <= 200 && !row.names.some(other => key(other) === key(name))) row.names.push(name);
    }
  }
  return rows;
}

/** The turn's scope with the settlement it was reached by, for the answer to say which municipality the place lies in,
 * or to ask which of several is meant. Only a settlement of the current message: a later turn does not repeat it.
 * ADR-106: the other settlements the turn admitted, each with its one municipality, go with the scope as known_places
 * (the conversation's places, not the turn's). On 08.10.2026 the user's village had brought her municipality's rules for
 * twenty turns; when she then asked which municipality would help if her mother moved to that village, the turn's scope
 * was the mother's municipality and the answer said it could not tell where the village lies.
 * A place of the turn's own municipality is not listed: the answer already works with that municipality, and with
 * the place before it the answer said again where it lies (a measured turn of 08.10.2026, two turns after it had). */
export function namedPlace(scope, admitted, turnNumber) {
  if (!scope || !Array.isArray(admitted)) return scope;
  const regions = new Set([scope.region, ...(scope.candidates || [])].filter(region => typeof region === 'string'));
  const ofTurn = admitted.filter(entry => entry.via !== 'state' && entry.turn === turnNumber);
  // A scope without a municipality still carries a name of several municipalities ("Ema elab Nõmme külas": whose
  // residence it is stays unresolved, as for any clause that names several places), so the answer can ask which one.
  const item = ofTurn.find(entry => entry.regions.some(region => regions.has(region))) || (regions.size ? null : ofTurn.find(entry => entry.regions.length > 1));
  const label = entry => `${entry.name}${KIND_NAMES[entry.kind] && !key(entry.name).endsWith(KIND_NAMES[entry.kind]) ? ` ${KIND_NAMES[entry.kind]}` : ''}`;
  const known = admitted.filter(entry => entry !== item && entry.regions.length === 1 && entry.regions[0] !== scope.region).map(entry => ({ name: label(entry), municipality: entry.regions[0] }))
    .filter((entry, index, all) => all.findIndex(other => other.name === entry.name) === index);
  const named = item ? { ...scope, named_place: { name: label(item), ...(item.regions.length === 1 ? { municipality: item.regions[0] } : { municipalities: item.regions }) } } : scope;
  return known.length ? { ...named, known_places: known } : named;
}
