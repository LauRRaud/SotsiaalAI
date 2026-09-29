import { defaultEstnltkAnalyzer } from '../search/estnltk.js';
import { resolveRecordScope, personKey, quotedSentence, INTERPRETATION, USER_PERSON, UNCLEAR_PERSON } from './record-scope.js';

// ADR-051: whose municipality a place is. The search plan reads the current message and names, for every place it
// mentions, the person and the relation (lives there, does not, or another mention). The server keeps only what the
// message itself shows: the quote is the message's own text and names one municipality, and the sentence around it
// decides a negation ("Minu elukoht ei ole Kose vald" is never a residence, whatever the plan says). The same reading
// selects the catalogue and becomes each person's municipality in the dialogue state (Codex review 29.09, F1/F2).
export const PLACE_LIMITS = Object.freeze({ places: 4, people: 4 });

/**
 * The plan's place attributions, checked against the messages they come from. messages is the current message's text,
 * or the messages the saved state has not read yet as { turn, text }, oldest first: after a turn whose state was not
 * kept, the places of its message still reach the next state. A place found in several of them belongs to the latest.
 */
export async function checkedPlaces(places, messages, directory, analyzer = defaultEstnltkAnalyzer()) {
  const unread = typeof messages === 'string' ? [{ turn: undefined, text: messages }] : messages, checked = [];
  for (const place of Array.isArray(places) ? places.slice(0, PLACE_LIMITS.places) : []) {
    const message = typeof place?.quote === 'string' ? unread.findLast(item => item.text.includes(place.quote)) : null;
    if (!message || !place.quote.trim() || place.quote.length > 160
      || typeof place.person !== 'string' || !place.person.trim() || place.person.length > 40 || !['lives', 'not', 'other'].includes(place.relation)) continue;
    const named = await resolveRecordScope([{ turnId: 'place', text: place.quote, mode: 'same' }], directory, analyzer);
    if (!named.region) continue;
    const sentence = quotedSentence(message.text, place.quote);
    const read = await resolveRecordScope([{ turnId: 'sentence', text: sentence, mode: 'same' }], directory, analyzer);
    const affirmed = read.region === named.region || read.state === 'ambiguous_region' && read.candidates.includes(named.region);
    checked.push({ person: personKey(place.person), region: named.region, relation: place.relation === 'lives' && !affirmed ? 'not' : place.relation,
      quote: place.quote, sentence, ...(message.turn === undefined ? {} : { turn: message.turn }) });
  }
  return checked.sort((a, b) => (a.turn ?? Infinity) - (b.turn ?? Infinity));
}

/** People from the previous state and the checked places, in message order: "lives" sets a person's municipality,
 * "not" clears it. turn: the current message, for places that do not name their own. */
export function nextPeople(previousPeople, places, turn) {
  const people = (previousPeople || []).map(entry => ({ person: entry.person, region: { ...entry.region, support: [...entry.region.support] } }));
  for (const place of places || []) {
    let entry = people.find(item => item.person === place.person);
    if (place.relation === 'lives') {
      if (!entry) people.push(entry = { person: place.person, region: null });
      entry.region = { id: place.region, status: 'reported', support: [{ turn: place.turn ?? turn, quote: place.sentence }] };
    } else if (place.relation === 'not' && entry?.region.id === place.region) entry.region = { id: null, status: 'unknown', support: [] };
  }
  // The user first; then the most recently added others, within the limit.
  const user = people.filter(entry => entry.person === USER_PERSON), others = people.filter(entry => entry.person !== USER_PERSON);
  return [...user, ...others.slice(Math.max(0, others.length - (PLACE_LIMITS.people - user.length)))];
}

/** The focus: the plan's person for this message, or the previous focus when the plan could not tell. */
export const nextFocus = (previousFocus, person) =>
  (typeof person === 'string' && person.trim() && personKey(person) !== UNCLEAR_PERSON ? personKey(person) : previousFocus || UNCLEAR_PERSON);

/**
 * The municipality for this message under state v4: the person the plan names keeps a place the message gives them,
 * then their own municipality, else none. Returns null when the resolver should decide as before: the plan could not
 * tell whom the message is about, or it attributed no place although the message names one. turnNumber: the current
 * message's number; a place without one is the current message's.
 */
export async function placeScope({ previousValue, places, person, turn, turnNumber, directory, analyzer }) {
  if (typeof person !== 'string' || !person.trim() || personKey(person) === UNCLEAR_PERSON) return null;
  const current = turnNumber ?? Infinity, at = place => place.turn ?? current;
  if (!places.some(place => at(place) === current)) {
    const mention = await resolveRecordScope([turn], directory, analyzer);
    if (mention.region || mention.state === 'ambiguous_region' || mention.state === 'region_required_after_negation') return null;
  }
  const key = personKey(person), known = region => directory.some(row => row.region === region);
  // The person's places from the latest message that gives one, unless a later message says they no longer live there.
  const lived = places.filter(place => place.person === key && place.relation === 'lives' && known(place.region));
  const latest = Math.max(...lived.map(at)), later = places.filter(place => place.person === key && place.relation === 'not' && at(place) > latest);
  const own = [...new Set(lived.filter(place => at(place) === latest).map(place => place.region))]
    .filter(region => !later.some(place => place.region === region));
  if (own.length === 1) return { state: 'person_mentioned_region', region: own[0], person: key, interpretation: INTERPRETATION };
  if (own.length > 1) return { state: 'ambiguous_region', region: null, candidates: own.sort(), person: key };
  const region = nextPeople(previousValue?.people, places, 0).find(entry => entry.person === key)?.region;
  return region?.id && known(region.id) ? { state: 'person_region', region: region.id, person: key, interpretation: INTERPRETATION }
    : { state: 'region_required', region: null, person: key };
}
