import { digest, reject } from './contracts.js';
import { FACT_STATE_VERSIONS, previousStateFor } from './dialogue-state.js';
import { USER_PERSON, UNCLEAR_PERSON } from './record-scope.js';

// ADR-070: what a full topic hands to the topic that continues it. Before, the ninth message of a topic started with
// an empty context: the person's municipality and circumstances were gone and the answer asked for them again. Now the
// new topic begins with
// - the user's own earlier statements, taken from the full topic's saved state (each current fact's quotation and each
//   person's place sentence), as one carried user turn;
// - the full topic's last user message, as it was;
// - that state itself, with every quotation anchored in those carried turns, so it is an ordinary state of the new topic.
// The older messages' text stays behind, as before.
export const CARRY_LIMITS = Object.freeze({ messages: 1, statementChars: 1800 });

const readable = audit => {
  if (!audit || !FACT_STATE_VERSIONS.includes(audit.version) || !audit.value || !Array.isArray(audit.value.facts)) return false;
  const { hash, ...content } = audit;
  return hash === digest(content);
};
const labelled = person => typeof person === 'string' && ![USER_PERSON, UNCLEAR_PERSON].includes(person);
const quotes = sources => (Array.isArray(sources) ? sources : []).map(source => source?.quote).filter(quote => typeof quote === 'string' && quote.trim());

/**
 * The user's earlier statements of a state, one per line, in the user's own words; a statement about someone else
 * starts with that person's label ("ema: ..."). covered: texts that are carried anyway (the last message, when the state
 * has read it), whose quotations are not repeated. Places first, then the requested periods, then the facts from the
 * newest back while there is room; the lines stand in the state's own order. Returns null when there is nothing to say.
 */
export function carriedStatements(audit, covered = []) {
  if (!readable(audit)) return null;
  const value = audit.value, wanted = [];
  for (const entry of value.people || []) for (const quote of quotes(entry.region?.support)) wanted.push({ person: entry.person, quote });
  for (const period of value.periods || []) for (const quote of quotes(period.support)) wanted.push({ person: USER_PERSON, quote });
  const facts = value.facts.filter(fact => fact.status === 'current').flatMap(fact => quotes(fact.support).map(quote => ({ person: fact.person, quote })));
  const fixed = wanted.length;
  wanted.push(...facts.reverse());
  const lines = [];
  let room = CARRY_LIMITS.statementChars;
  wanted.forEach((item, index) => {
    if (covered.some(text => text.includes(item.quote)) || lines.some(line => line.text.includes(item.quote))) return;
    const text = labelled(item.person) ? `${item.person}: ${item.quote}` : item.quote;
    if (text.length + 1 > room) return;
    room -= text.length + 1;
    // The facts were taken newest first; they stand oldest first.
    lines.push({ text, order: index < fixed ? index : fixed + wanted.length - index });
  });
  return lines.length ? lines.sort((a, b) => a.order - b.order).map(line => line.text).join('\n') : null;
}

/**
 * The carried user turns of the topic that continues a full one, and what its selection records. rows: the full topic's
 * turns in order; withState: the plan keeps a dialogue state. read: how many of the carried turns the full topic's state
 * has read (the statements always, the last message when that state covers it).
 */
export function carriedContext(rows, withState) {
  const last = rows.at(-1), published = rows.filter(row => row.state === 'completed'), scopeId = last.payload.context.scopeId;
  const stateRow = withState ? published.at(-1) : null, audit = stateRow?.payload.dialogueState ?? null, usable = readable(audit);
  const covers = usable && audit.sourceTurnIds.includes(last.id);
  const statements = usable ? carriedStatements(audit, covers ? [last.payload.question] : []) : null;
  const turns = [
    ...(statements ? [{ turnId: `carried-${scopeId}`, text: statements, mode: 'same', correctionOf: null, carried: 'statements' }] : []),
    { turnId: last.id, text: last.payload.question, mode: 'same', correctionOf: null, carried: 'message' },
  ];
  return { turns, carry: { scopeId, turnIds: [last.id], stateTurnId: usable ? stateRow.id : null, assistantTurnId: published.at(-1)?.id ?? null,
    read: (statements ? 1 : 0) + (covers ? 1 : 0) } };
}

/**
 * The full topic's state as the continuing topic's first state: the current facts with their ids, the persons with their
 * places, the focus, needs, unknowns and periods, every quotation anchored in the carried turn that holds it. What has no
 * quotation among the carried turns is left out (a fact, a period) or becomes unknown (a person's place). The result is
 * bound to the new topic and its carried turns like any state (previousStateFor); null when the state read none of them.
 */
export function carriedState(audit, accepted) {
  const carry = accepted.selection.carried;
  if (!carry || !readable(audit) || audit.scopeId !== carry.scopeId || audit.personId !== accepted.context.personId) reject('dialogue_state_scope_mismatch', 403);
  const turns = accepted.userTurns.slice(0, carry.read);
  if (!turns.length || turns.some(turn => !turn.carried)) return null;
  const anchored = sources => (Array.isArray(sources) ? sources : []).flatMap(source => {
    const index = turns.findIndex(turn => turn.text.includes(source.quote));
    return index < 0 ? [] : [{ turn: index + 1, quote: source.quote }];
  }).filter((source, index, all) => all.findIndex(other => other.turn === source.turn && other.quote === source.quote) === index);
  const value = audit.value;
  const facts = value.facts.filter(fact => fact.status === 'current').map(fact => ({ ...fact, support: anchored(fact.support), superseded_by: null }))
    .filter(fact => fact.support.length);
  const current = new Set(facts.map(fact => fact.id));
  const based = (entries, min) => (entries || []).map(entry => ({ ...entry, based_on: entry.based_on.filter(id => current.has(id)) }))
    .filter((entry, index) => entry.based_on.length >= min && entry.based_on.length === entries[index].based_on.length);
  const people = (value.people || []).map(entry => {
    const support = anchored(entry.region?.support);
    return { person: entry.person, region: entry.region?.id && !support.length ? { ...entry.region, id: null, status: 'unknown', support: [] } : { ...entry.region, support } };
  });
  const periods = (value.periods || []).map(period => ({ ...period, support: anchored(period.support) }))
    .filter((period, index) => period.support.length && period.support.length === value.periods[index].support.length);
  const content = { version: audit.version, scopeId: accepted.context.scopeId, personId: accepted.context.personId,
    sourceTurnIds: turns.map(turn => turn.turnId), inputHash: digest(turns),
    value: { facts, needs: based(value.needs, 1), unknowns: based(value.unknowns, 0), periods, language_hint: value.language_hint ?? null,
      people, focus: value.focus, model: { accepted: true, dropped: [] } },
    carriedFrom: { scopeId: audit.scopeId, hash: audit.hash } };
  return previousStateFor({ ...content, hash: digest(content) }, accepted);
}
