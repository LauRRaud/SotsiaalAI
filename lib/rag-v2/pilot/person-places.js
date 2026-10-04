import { defaultEstnltkAnalyzer } from '../search/estnltk.js';
import { resolveRecordScope, knowledgeRegionScope, personKey, quotedSentence, quotedSentenceAt, mentionedRegions, occurrenceNegated, sentenceStart, translatedMention, regionMentionCounts,
  locateQuote, placeOccurrences, firstPersonSingular, firstPersonPlural, refersBack, INTERPRETATION, USER_PERSON, UNCLEAR_PERSON } from './record-scope.js';

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

// ---- State v5 (Codex follow-up review 29.09, J1-J3): one reading of each person's municipality for search and memory ----
// The plan names the message (turn) of every place and quotes the clause that shows the person and the relation
// ("Minu ema elab Kose vallas", not only "Kose vallas"). The server finds that clause once in that message and reads the
// negation in its own sentence; a repeated clause or a wrong turn leaves the attribution unresolved, never the first
// or last occurrence guessed. resolvePersonRegions then turns the checked places into each person's region state, and
// the search scope and the saved state both come from that one result.
export const REGION_STATES = Object.freeze(['reported', 'unknown', 'negated', 'ambiguous', 'unresolved']);

/**
 * Whom the current message is about, for its search scope, its unattributed municipalities and the saved focus alike
 * (Codex V1: an unclear plan still decides for someone, the same one in search and memory): the person the plan names;
 * else, when the message names exactly one known person and does not speak in the first person singular, that person
 * ("Ja ema, kas tema saaks sotsiaaltransporti?", measured 30.09 with an unclear plan); else the conversation's focus;
 * else the user. text: the current message.
 */
export function regionTarget(person, previousValue, text = '') {
  const valid = value => typeof value === 'string' && value.trim() && personKey(value) !== UNCLEAR_PERSON;
  if (valid(person)) return personKey(person);
  const words = typeof text === 'string' ? text.toLowerCase().match(/\p{L}+/gu) || [] : [];
  const named = (previousValue?.people || []).map(entry => entry.person).filter(label => label !== USER_PERSON && valid(label))
    .filter(label => { const head = label.split(/\s+/u)[0]; return head.length >= 3 && words.some(word => word.startsWith(head)); });
  if (named.length === 1 && !firstPersonSingular(words)) return named[0];
  return personKey(valid(previousValue?.focus) ? previousValue.focus : USER_PERSON);
}

// A clause in the first person singular ("Elan Harku vallas", "Я живу в Козе") is the user's own; another person gets its
// place only when it says they live together ("koos emaga", "emaga", "вместе", "с мамой") or speaks in the plural ("me
// elame"). Being named a neighbour gives nobody the user's place (Codex V4).
// Words that name a person (Estonian stems, Russian and English): a clause with one is about that person, not the target.
const PERSON_NOUNS = Object.freeze(['ema', 'isa', 'vanaema', 'vanaisa', 'poeg', 'poja', 'tütar', 'tütre', 'vend', 'venna', 'õde',
  'abikaasa', 'mees', 'mehe', 'naine', 'naise', 'laps', 'lapse', 'sõber', 'sõbra', 'tuttav', 'naaber', 'naabri', 'sugulane', 'sugulase',
  'onu', 'tädi', 'mother', 'father', 'son', 'daughter', 'brother', 'sister', 'neighbo', 'friend', 'husband', 'wife', 'child',
  'мам', 'мать', 'отец', 'пап', 'сын', 'доч', 'брат', 'сестр', 'сосед', 'муж', 'жена', 'ребён', 'друг', 'подруг', 'бабушк', 'дедушк']);
function usersOwnClause(quote, person) {
  const words = (quote.toLowerCase().match(/[\p{L}']+/gu) || []);
  return firstPersonSingular(words) && !words.some(word => word.startsWith(person) && word.endsWith('ga'));
}

/**
 * The plan's v5 places checked against the conversation's messages ({ turn, text, read }; read: the saved state has read
 * it). An attribution the named unread message does not show once, with one mention of its place, is kept as relation
 * "unresolved", so that person's region is not decided from it. A place of a message the state has read, or its quote
 * restated from one, is already in the state and is left out. target: whose place an unattributed municipality of the
 * current message is (regionTarget); previousPeople: the saved state's persons.
 */
export async function checkedTurnPlaces(places, messages, directory, analyzer = defaultEstnltkAnalyzer(), { target = null, previousPeople = [] } = {}) {
  const checked = [], current = messages.filter(item => !item.read).at(-1), covered = [], mentionCache = new Map();
  // Every mention of a message, read once: the plan's checked places and the mentions it left out use the same reading of
  // each mention's negation (Codex R2, 30.09: "Praegu ei ela ema Kose vallas" was the mother's "not" only without a plan).
  const mentionsOf = async item => { if (!mentionCache.has(item.turn)) mentionCache.set(item.turn, await placeOccurrences(item.text, directory, analyzer)); return mentionCache.get(item.turn); };
  for (const place of Array.isArray(places) ? places.slice(0, PLACE_LIMITS.places) : []) {
    if (!place || typeof place.quote !== 'string' || !place.quote.trim() || place.quote.length > 160 || typeof place.person !== 'string'
      || !place.person.trim() || place.person.length > 40 || !['lives', 'not', 'other'].includes(place.relation) || !Number.isSafeInteger(place.turn)) continue;
    const message = messages.find(item => item.turn === place.turn), unread = messages.filter(item => !item.read);
    // What the saved state has read stays as it is; a quote in no message names nothing (both as in v4). A copy that differs
    // only in letter case, spacing or punctuation is found too, and the user's own words of it are read from then on.
    if (message?.read || !unread.some(item => locateQuote(item.text, place.quote))) continue;
    const found = message ? locateQuote(message.text, place.quote) : null, quote = found ? message.text.slice(found.at, found.at + found.length) : place.quote;
    // The clause names the municipality, whether it says the person lives there or not. A clause with several places
    // ("Ma ei ela enam Kose vallas, elan nüüd Harku vallas") is about the one of them the plan names; the name never adds
    // a place the clause does not have. A place in Cyrillic ("в Козе") is the municipality the plan names only when a word
    // of the clause is exactly that name (translatedMention); without the link it stays unresolved.
    const counts = await regionMentionCounts(quote, directory, analyzer), named = [...counts.keys()].sort();
    const name = typeof place.name === 'string' && place.name.trim() && place.name.length <= 80 ? place.name : null;
    const chosen = named.length > 1 && name ? (await mentionedRegions(name, directory, analyzer)).filter(region => named.includes(region)) : named;
    const translated = !named.length && name ? await translatedMention(quote, name, directory, analyzer) : null;
    if (!named.length && !translated) continue;
    const person = personKey(place.person), at = found ? found.at : -1;
    const region = chosen.length === 1 ? chosen[0] : translated?.region || null;
    // One mention of the place in the clause (Codex V2): in "Mina elan Kose vallas, aga ema ei ela Kose vallas" as one
    // quote, no mention is the user's.
    const unresolved = at < 0 ? 'quote_not_in_turn' : found.count > 1 ? 'quote_repeated'
      : person !== USER_PERSON && usersOwnClause(quote, person) ? 'clause_is_the_users'
      : named.length && chosen.length !== 1 ? 'quote_names_several_places' : translated?.reason
        || ((named.length ? counts.get(region) : translated.count) > 1 ? 'place_repeated_in_quote' : null);
    if (unresolved) {
      // ADR-074: "other" claims no home, so such a mention the server cannot place leaves its person's region as it is
      // (before: unresolved, and a known residence was lost); the current message's own mentions are read below.
      if (place.relation !== 'other') checked.push({ person, region, relation: 'unresolved', turn: place.turn, quote, reason: unresolved });
      continue;
    }
    // The negation at this very mention, as the server reads it without a plan; the quoted clause's only mention of the place.
    const clause = message.text.slice(sentenceStart(message.text, at), at + quote.length);
    const mention = (await mentionsOf(message)).find(item => item.start >= at && item.end <= at + quote.length
      && (item.region === region || item.candidates.includes(region)));
    const negated = translated ? (await translatedMention(clause, name, directory, analyzer)).negated === true
      : mention ? mention.negated : await occurrenceNegated(clause, region, directory, analyzer);
    // Only this mention is the plan's to say (Codex N2); the other mentions of a long quote are read below (Codex R1, 30.09:
    // "Ma ei ela enam Kose vallas, ema elab Harku vallas" quoted whole for the mother hid the user's negation).
    if (message === current && mention) covered.push(mention);
    // ADR-074: whether another mention of the current message stands in the question itself is the server's own reading
    // of that mention, never the plan's to say.
    checked.push({ person, region, relation: place.relation === 'lives' && negated ? 'not' : place.relation,
      turn: place.turn, quote, sentence: quotedSentenceAt(message.text, at, quote.length), ...(translated ? { name } : {}),
      ...(place.relation === 'other' && message === current ? { asking: mention?.asking === true } : {}) });
  }
  // Each municipality mention of the current message that no checked place's own quote contains (Codex V1; N1-N3, 30.09):
  // - a negation in the first person singular ("Ma ei ela enam Kose vallas", "Я больше не живу в Козе") is the user's,
  //   and the server reads it as the user's "not" (a move then keeps the new place and excludes the old one);
  // - so is a first-person residence the plan left out ("Olen Harkus.", measured 30.09): the user's "lives";
  // - a clause in the first person plural ("Me elame Tartu linnas") is the user's, and the one person it names or else the
  //   target's when the target has no place yet (it never replaces a known place);
  // - a clause that names one known person is that person's: a residence ("Mu naabrimees … elab Kose vallas", measured
  //   30.09 with a plan quote that left the place out) or a negation is read for them, another mention decides nothing;
  // - a mention that names nobody and says nothing of living there is another mention and changes no residence (ADR-074);
  // - otherwise (a home or a negation whose person the clause does not show) its person is unclear: the target, and for a
  //   negation everyone who lives there, get no place from it; a person the plan gave a checked new place in this message
  //   keeps it.
  // Only the person a mention is about changes; nobody's place changes because another person had the same one.
  if (current && target) {
    const labels = [...new Set([...(previousPeople || []).map(entry => entry.person), ...checked.map(item => item.person), personKey(target)])].filter(label => label !== USER_PERSON);
    // A person with no place yet, known from no earlier message and none of this one's checked places.
    const unplaced = who => who !== USER_PERSON && !(previousPeople || []).some(entry => entry.person === who && (entry.region?.id || entry.region?.status !== 'unknown'))
      && !checked.some(item => item.turn === current.turn && item.person === who);
    // A checked plural residence ("Me elame Tartu linnas" given to the user) is the target's too, when the target has no place.
    for (const item of checked.filter(entry => entry.turn === current.turn && entry.relation === 'lives' && entry.region && entry.person === USER_PERSON)) {
      if (firstPersonPlural(item.quote.toLowerCase().match(/\p{L}+/gu) || []) && unplaced(personKey(target))) {
        checked.push({ ...item, person: personKey(target), reason: 'shared_clause' });
      }
    }
    const unresolved = new Set();
    for (const mention of await mentionsOf(current)) {
      if (covered.includes(mention)) continue;
      const named = labels.filter(label => { const head = label.split(/\s+/u)[0]; return head.length >= 3 && mention.clause.words.some(word => word.startsWith(head)); });
      const plural = firstPersonPlural(mention.clause.words);
      const person = firstPersonSingular(mention.clause.words) ? USER_PERSON : !plural && named.length === 1 ? named[0] : null;
      const clause = current.text.slice(mention.clause.start, mention.clause.end);
      const read = (who, relation) => checked.push({ person: who, region: mention.region, relation, turn: current.turn, quote: clause, sentence: clause,
        reason: relation === 'not' ? 'server_read_negation' : 'server_read_residence' });
      if (person && mention.negated && mention.region) { read(person, 'not'); continue; }
      if (person && mention.residence && mention.region) { read(person, 'lives'); continue; }
      if (plural && mention.residence && mention.region) {
        for (const who of [USER_PERSON, ...(named.length === 1 ? named : unplaced(personKey(target)) ? [personKey(target)] : [])]) read(who, 'lives');
        continue;
      }
      if (person) { unresolved.add(person); continue; }
      // A clause that names someone the conversation does not know, or several persons ("Naabri omavalitsus on Kose vald",
      // measured 30.09), is about them: it decides nothing for the target or for anyone else.
      if (!plural && (named.length || PERSON_NOUNS.some(stem => mention.clause.words.some(word => word.startsWith(stem))))) continue;
      // ADR-074: a mention that says nothing of living there and names nobody ("Kust leian Harku valla toimetulekutoetuse
      // taotluse vormi?", 04.10: the plan's attribution did not reach the server) is another mention. It changes nobody's
      // residence (before: the target's became unresolved) and may be what the question asks about (questionRegionScope).
      // Its reason is no "server_read_" one: the clean-up below trusts only a home or a negation the server read.
      if (!mention.negated && !mention.residence) {
        checked.push({ person: personKey(target), region: mention.region, ...(mention.region ? {} : { candidates: mention.candidates }), relation: 'other',
          turn: current.turn, quote: clause, sentence: clause, reason: 'unattributed_other_mention', asking: mention.asking === true });
        continue;
      }
      const holders = mention.negated ? (previousPeople || []).filter(entry => mention.candidates.includes(entry.region?.id)).map(entry => entry.person) : [];
      for (const who of [personKey(target), ...holders]) unresolved.add(who);
    }
    // Someone who got a checked new home in this message, from the plan or read by the server, keeps it ("Ema elab Tartus, aga
    // töötab Harkus"): another mention decides nothing more for them.
    const moved = new Set(checked.filter(item => item.turn === current.turn && item.relation === 'lives').map(item => item.person));
    for (const person of unresolved) if (!moved.has(person)) checked.push({ person, region: null, relation: 'unresolved', turn: current.turn, quote: null, reason: 'place_not_attributed' });
    // A plan quote that names no place ("Mu naabrimees on eakas") says nothing once the server has read that person's own
    // mention in the same message.
    const serverRead = new Set(checked.filter(item => item.turn === current.turn && /^server_read_/u.test(item.reason || '')).map(item => item.person));
    for (let i = checked.length - 1; i >= 0; i--) {
      if (checked[i].turn === current.turn && checked[i].reason === 'place_link_unverified' && !checked[i].region && serverRead.has(checked[i].person)) checked.splice(i, 1);
    }
    // A plan attribution left unresolved for a place the server then read for the same person in the same message is that
    // reading's to decide (Codex R1: the mother's "ema elab Harku vallas" in a quote that was the user's clause).
    for (let i = checked.length - 1; i >= 0; i--) {
      const item = checked[i];
      if (item.turn === current.turn && item.relation === 'unresolved' && item.region && checked.some(other => other.turn === current.turn
        && /^server_read_/u.test(other.reason || '') && other.person === item.person && other.region === item.region)) checked.splice(i, 1);
    }
  }
  return checked;
}

const unknownRegion = () => ({ id: null, status: 'unknown', candidates: [], excluded: [], support: [] });
const sorted = values => [...new Set(values)].sort();
const regionOf = entry => ({ ...unknownRegion(), ...entry.region, candidates: [...(entry.region?.candidates || [])],
  excluded: [...(entry.region?.excluded || [])], support: [...(entry.region?.support || [])] });

/**
 * Each person's region after the checked places, turn by turn in time order and a turn's places as a set (their order
 * in the plan's answer means nothing). One affirmed place sets the region, and a newer one replaces it (a move); two
 * affirmed places in one turn leave it ambiguous; a negation clears only that person's own place, so an older replaced
 * place never comes back; an affirmed and a negated same place in one turn, or an unresolved attribution, leave it
 * unresolved. focus: whom the current message is about, kept within the person limit.
 */
export function resolvePersonRegions(previousPeople, places, focus = null) {
  const people = (previousPeople || []).map(entry => ({ person: entry.person, region: regionOf(entry) }));
  const turns = sorted((places || []).map(place => place.turn));
  for (const turn of turns) {
    const inTurn = places.filter(place => place.turn === turn);
    for (const person of sorted(inTurn.map(place => place.person))) {
      const own = inTurn.filter(place => place.person === person);
      let entry = people.find(item => item.person === person);
      if (!entry && own.every(place => place.relation === 'other')) continue;
      if (!entry) people.push(entry = { person, region: unknownRegion() });
      const lives = sorted(own.filter(place => place.relation === 'lives').map(place => place.region));
      const not = sorted(own.filter(place => place.relation === 'not').map(place => place.region));
      const support = own.filter(place => place.relation !== 'other' && (place.sentence || place.quote)).slice(0, 2).map(place => ({ turn, quote: place.sentence || place.quote }));
      const excluded = sorted([...entry.region.excluded, ...not]).filter(region => !lives.includes(region));
      if (own.some(place => place.relation === 'unresolved') || lives.some(region => not.includes(region))) {
        entry.region = { id: null, status: 'unresolved', candidates: sorted([...lives, ...own.filter(place => place.relation === 'unresolved' && place.region).map(place => place.region)]),
          excluded, support };
      } else if (lives.length === 1) {
        entry.region = { id: lives[0], status: 'reported', candidates: [], excluded, support };
      } else if (lives.length > 1) {
        entry.region = { id: null, status: 'ambiguous', candidates: lives, excluded, support };
      } else if (not.length) {
        const current = entry.region;
        if (current.id && not.includes(current.id)) entry.region = { id: null, status: 'negated', candidates: [], excluded, support };
        else if (current.status === 'ambiguous') {
          const left = current.candidates.filter(region => !not.includes(region));
          entry.region = left.length === 1 ? { id: left[0], status: 'reported', candidates: [], excluded, support }
            : { ...current, candidates: left, excluded, status: left.length ? 'ambiguous' : 'negated' };
        } else entry.region = { ...current, excluded, ...(current.id ? {} : { status: 'negated', support }) };
      }
    }
  }
  // The user, the person the message is about, then the most recently added others, within the limit.
  const keep = new Set([USER_PERSON, ...(focus ? [personKey(focus)] : [])]);
  const first = people.filter(entry => keep.has(entry.person)), others = people.filter(entry => !keep.has(entry.person));
  return [...first, ...others.slice(Math.max(0, others.length - (PLACE_LIMITS.people - first.length)))];
}

/** The search scope of one person's region state; the same state the dialogue state saves. */
export function regionScope(region, person, currentTurn, known) {
  if (region?.status === 'reported' && region.id && known(region.id)) {
    const fresh = region.support.some(source => source.turn === currentTurn);
    return { state: fresh ? 'person_mentioned_region' : 'person_region', region: region.id, person, interpretation: INTERPRETATION };
  }
  if (region?.status === 'ambiguous') return { state: 'ambiguous_region', region: null, candidates: region.candidates.filter(known), person };
  if (region?.status === 'negated') return { state: 'region_required_after_negation', region: null, person };
  if (region?.status === 'unresolved') return { state: 'region_required', region: null, person, reason: 'attribution_unresolved' };
  return { state: 'region_required', region: null, person };
}

/**
 * The municipality for this message under state v5: the region state of the target person (regionTarget: the person the
 * plan names, else the focus, else the user), computed by resolvePersonRegions from the previous state and this turn's
 * checked places, so the catalogue, the knowledge lane and the saved state agree (Codex J1-J3). A place the plan left out
 * is already a checked place (checkedTurnPlaces, Codex V1): unresolved, or another mention when it says nothing of living
 * there. The one way past this decision is a municipality the question itself asks about (questionRegionScope, ADR-074).
 */
export async function personRegionScope({ previousValue, places, person, turn, turnNumber, directory }) {
  const key = regionTarget(person, previousValue, turn?.text), known = region => directory.some(row => row.region === region);
  const region = resolvePersonRegions(previousValue?.people, places, key).find(entry => entry.person === key)?.region;
  return regionScope(region, key, turnNumber, known);
}

// ---- ADR-074 (04.10.2026): the municipality a question asks about is not where the person lives ----
// In the live questionnaire of 04.10 a user who had said "Elan Nõo vallas" asked "Kas Maardus saab isikliku abistaja
// teenust?". The plan read Maardu as another mention and wrote its queries about Maardu, and the search still read Nõo
// vald, because a known residence was the turn's only municipality. The source scope of a turn is now decided apart
// from the person's region state, which stays what the residence statements made it.
export const QUESTION_INTERPRETATION = 'asked_municipality_source_scope_not_residence';
const QUESTION_STATES = Object.freeze(['question_region', 'question_regions']);
// ADR-081: where the person has given no residence, the municipality of the turn comes from the plan's queries
// (knowledgeRegionScope) or from the question before it (continuedRegionScope); the next turn may go on about it too.
const UNPLACED_STATES = Object.freeze(['search_plan_region', 'search_plan_ambiguous_region', 'continued_region', 'continued_regions']);
/** The municipalities a turn's source scope was asked about; the next turn may go on about them. */
export const askedRegions = scope => (QUESTION_STATES.includes(scope?.state) || UNPLACED_STATES.includes(scope?.state)
  ? [scope.region, ...(scope.candidates || [])].filter(region => typeof region === 'string') : []);
/** The person whose question that was (the person the turn was about); only their own next request goes on with it. */
export function askedPerson(scope) {
  const person = QUESTION_STATES.includes(scope?.state) ? scope.person_scope?.person : UNPLACED_STATES.includes(scope?.state) ? scope.person : null;
  return typeof person === 'string' ? person : null;
}

// The municipalities the plan's queries name among the allowed ones: { regions, named }, named being whether any query
// names a municipality at all; null when a query names a municipality that is neither allowed nor set aside. aside:
// municipalities a query may name without deciding anything (the person's own, where the message is not about it).
async function queriedAmong(planQueries, allowed, aside, directory, analyzer) {
  const found = new Set();
  let named = false;
  for (const text of planQueries.slice(0, 8)) {
    for (const mention of await placeOccurrences(text, directory, analyzer)) {
      named = true;
      const hits = mention.candidates.filter(region => allowed.has(region));
      if (!hits.length && mention.candidates.some(region => aside.has(region))) continue;
      if (!hits.length) return null;
      hits.forEach(region => found.add(region));
    }
  }
  return { regions: [...found].sort(), named };
}

/**
 * The municipality the question asks about, or null when the person's own scope stands. scope: the person's own scope
 * (personRegionScope); where it decided nobody's place, knowledgeRegionScope reads the plan's queries as before.
 *
 * In the current message three readings must agree:
 * - the message names the municipality in another mention (relation "other": no home, no negation) of the person the
 *   message is about or of nobody;
 * - that mention stands in the question itself (asking, the server's own reading of the clause: record-scope.js). A
 *   place of work or of a visit in a clause that only tells something is a circumstance ("Elan Nõo vallas, töötan
 *   Maardus; millist koduteenust ma saan?" stays with Nõo vald, also when a query names only Maardu; Codex F2);
 * - the plan's queries name such a mention, and no other municipality than the ones set aside below.
 * A municipality the same message gives as a home, negates or leaves unresolved, and the person's own municipality,
 * are never asked ones: a query that names another municipality keeps the search with the person.
 *
 * A follow-up goes on with the municipality the last published answer was asked about (askedBefore, read from that
 * turn's own scope) when the message names no municipality itself, it is about the person that question was asked for
 * (askedPerson), and the plan's queries name that municipality ("Ja mis see maksab?" after a question about Maardu,
 * Codex F1). A plan that names another municipality or none returns the search to the person ("Millist koduteenust
 * ma ise saan?"). A request about another person is never a follow-up of this one's question: after the user's
 * question about Maardu, "Aga millist koduteenust ema saab?" is searched in the mother's own municipality, also when
 * a query still names Maardu (Codex, review of #345, F2).
 *
 * Set aside (measured 04.10: for "Ja mis see maksab?" the plan wrote two queries about Maardu's service and a third
 * about the user's own earlier request in Nõo vald, and the follow-up fell back to Nõo): a query about the person's own
 * municipality, which the current message does not name, is about an earlier matter and decides nothing. In a follow-up
 * this holds only for a message that points back at what was spoken of (refersBack: "see", "seda", "sealt"), whoever
 * speaks: "Kuidas ma seda taotleda saan?" goes on like "Kuidas seda taotleda?" (Codex, review of #345, F1). A message
 * that points back at nothing ("Aga millist koduteenust ma ise saan?") starts a request of its own, and there the
 * query about the person's municipality is the request itself.
 *
 * ADR-081 (measured 04.10: for "Ja mis see maksab?" the plan wrote one query, "Isikliku abistaja teenuse tasu kujunemine
 * inimese omaosalus", and the follow-up fell back to Nõo): a message that points back goes on with the asked
 * municipality also when the plan's queries name no municipality at all. The plan can still take the search away from
 * it by naming another municipality or the person's own; a message that points back at nothing needs the plan to name
 * the asked municipality, as before.
 *
 * The result names no person: the asked municipality is nobody's residence. The saved state never reads it.
 */
export async function questionRegionScope(scope, { places, planQueries, turnNumber, directory, analyzer = defaultEstnltkAnalyzer(), askedBefore = [], askedPerson: askedFor = null, text = '' }) {
  if (!scope || scope.state === 'region_required' && !scope.reason || !Array.isArray(places) || !Array.isArray(planQueries)) return null;
  const current = places.filter(place => place.turn === turnNumber), known = region => directory.some(row => row.region === region);
  const regionsOf = place => (place.region ? [place.region] : place.candidates || []);
  const own = [scope.region, ...(scope.candidates || [])];
  const result = (regions, askedIn) => ({ ...(regions.length === 1 ? { state: 'question_region', region: regions[0] } : { state: 'question_regions', region: null, candidates: regions }),
    asked_in: askedIn, person_scope: scope, interpretation: QUESTION_INTERPRETATION });
  const asked = new Set(current.filter(place => place.relation === 'other' && place.asking === true && [scope.person, UNCLEAR_PERSON].includes(place.person))
    .flatMap(regionsOf).filter(known));
  for (const region of [...own, ...current.filter(place => place.relation !== 'other').flatMap(regionsOf)]) asked.delete(region);
  // The person's own municipality where the current message does not name it.
  const unnamed = new Set(own.filter(region => typeof region === 'string' && !current.some(place => regionsOf(place).includes(region))));
  if (asked.size) {
    const queried = await queriedAmong(planQueries, asked, unnamed, directory, analyzer);
    return queried?.regions.length ? result(queried.regions, 'current_message') : null;
  }
  const earlier = new Set((Array.isArray(askedBefore) ? askedBefore : []).filter(region => known(region) && !own.includes(region)));
  if (current.length || !earlier.size || typeof askedFor !== 'string' || askedFor !== scope.person) return null;
  const words = typeof text === 'string' ? text.toLowerCase().match(/[\p{L}']+/gu) || [] : [];
  const back = refersBack(words), queried = await queriedAmong(planQueries, earlier, back ? unnamed : new Set(), directory, analyzer);
  if (queried?.regions.length) return result(queried.regions, 'earlier_question');
  return queried && back && !queried.named ? result([...earlier].sort(), 'earlier_question') : null;
}

/**
 * ADR-081: the follow-up of a person who has given no residence. Nobody's place is decided and the plan's queries name
 * no municipality (knowledgeRegionScope found none): a message that points back (refersBack), names no municipality
 * itself and is about the person the last published answer was asked for goes on with the municipality that answer was
 * searched in (askedBefore). "Kas Maardus saab isikliku abistaja teenust?" and then "Ja mis see maksab?", with a plan
 * that writes only "isikliku abistaja teenuse tasu kujunemine", is searched in Maardu. A source scope only.
 */
async function continuedRegionScope(scope, { places, planQueries, turnNumber, directory, analyzer, askedBefore, askedPerson: askedFor, text }) {
  if (scope?.state !== 'region_required' || scope.reason || !Array.isArray(places) || places.some(place => place.turn === turnNumber)) return null;
  const earlier = [...new Set((Array.isArray(askedBefore) ? askedBefore : []).filter(region => directory.some(row => row.region === region)))].sort();
  if (!earlier.length || typeof askedFor !== 'string' || askedFor !== scope.person) return null;
  const words = typeof text === 'string' ? text.toLowerCase().match(/[\p{L}']+/gu) || [] : [];
  if (!refersBack(words)) return null;
  const queried = await queriedAmong(Array.isArray(planQueries) ? planQueries : [], new Set(), new Set(), directory, analyzer);
  if (!queried || queried.named) return null;
  return earlier.length === 1 ? { state: 'continued_region', region: earlier[0], person: scope.person, asked_in: 'earlier_question', interpretation: INTERPRETATION }
    : { state: 'continued_regions', region: null, candidates: earlier, person: scope.person, asked_in: 'earlier_question' };
}

/** The turn's source scope for the catalogue and the knowledge lane's municipal texts: the asked municipality, else the
 * person's own scope, with the plan's queries read where nobody's place was decided (knowledgeRegionScope), and the
 * municipality of the question before where they name none (continuedRegionScope). */
export async function sourceRegionScope(scope, { places, planQueries, turnNumber, directory, analyzer = defaultEstnltkAnalyzer(), askedBefore = [], askedPerson: askedFor = null, text = '' }) {
  const input = { places, planQueries, turnNumber, directory, analyzer, askedBefore, askedPerson: askedFor, text };
  const asked = await questionRegionScope(scope, input);
  if (asked) return asked;
  const planned = await knowledgeRegionScope(scope, planQueries, directory, analyzer);
  return planned === scope ? await continuedRegionScope(scope, input) || scope : planned;
}
