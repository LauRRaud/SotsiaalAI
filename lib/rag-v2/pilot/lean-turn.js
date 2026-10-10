import { digest, reject } from './contracts.js';
import { LEAN_PACKET, isLeanPacket } from '../search/model-context.js';

// ADR-093: what a finished turn keeps when its full audit is let go. A turn's row was about 0.4 MB, of which the
// conversation (the question and the answer) is about 1.3 KB; the rest is the audit of the turn: every excerpt and
// record the model was shown, the request as sent, the query vector, the search's working notes. The lean form keeps
// what the chat needs to show the turn and go on from it, and what a reader can still check:
//   - the question, the answer, the dialogue's context and state, the costs and times;
//   - the evidence the answer cites, whole, with its references (a cited source still opens and is still checked
//     against the corpus on every read);
//   - the records the answer cites and the forms they declare;
//   - the hashes of what was let go, and of the answer and the state as they were proved when the turn was published.
// It lets go: the evidence the answer does not cite, the model context, the search's audit, the request body, the
// query vector, the dialogue input and the state context. With them goes the proof repeated on every read that the
// answer follows from its evidence: a lean turn was proved once, when it was published.
export const LEAN_TURN = 'rag-v2/lean-turn-1';
export const isLeanTurn = row => row?.payload?.lean?.version === LEAN_TURN;

const citedRefs = answer => new Set((answer?.blocks || []).flatMap(block => block.refs || []));
const bytes = value => (value === undefined ? 0 : Buffer.byteLength(JSON.stringify(value), 'utf8'));

// The records the answer cites and the forms they declare: what the forms list and the next turn's record focus read.
function leanRecords(context, used) {
  if (!context || !Array.isArray(context.entries)) return context;
  const cited = context.entries.filter(entry => Object.values(entry.fields || {}).some(field => field.refs?.some(ref => used.has(ref))));
  const keys = new Set(cited.map(entry => entry.key));
  const relations = (context.relations || []).filter(link => link.relation === 'form' && link.to && keys.has(link.from));
  const forms = new Set(relations.map(link => link.to));
  return { ...context, entries: context.entries.filter(entry => keys.has(entry.key) || forms.has(entry.key)), relations };
}

/** The lean form of a turn's packet for its answer: the cited evidence under its own refs. */
export function leanPacket(packet, answer) {
  if (isLeanPacket(packet)) return packet;
  const used = citedRefs(answer);
  const reference_map = Object.fromEntries(Object.entries(packet.reference_map || {}).filter(([ref]) => used.has(ref)));
  const kept = new Set(Object.values(reference_map).map(reference => reference.evidence_id));
  // An entry keeps its ids, spans, places and text (what its reference is checked with) and its source's card (what the
  // sources panel shows). The search's aids and ranks, the processing notes and the act's dates go: none of them is
  // cited, shown or checked. Its place in its act (legal_place) stays: since ADR-129 (10.10.2026) the sources panel
  // shows the provision beside the act's title, and production keeps its turns lean.
  const evidence = (packet.evidence || []).filter(entry => kept.has(entry.evidence_id))
    .map(({ search_aids: _aids, legal_dates: _dates, selection: _selection, limitations: _notes, ...entry }) => entry);
  return { tenant: packet.tenant, query_id: packet.query_id, generation_id: packet.generation_id ?? null, lean: LEAN_PACKET, reference_map, evidence,
    ...(packet.record_context ? { record_context: leanRecords(packet.record_context, used) } : {}) };
}

/** The lean form of a completed turn's payload (its packet opened). A payload that is lean already stays as it is. */
export function leanPayload(payload, now = new Date()) {
  if (payload?.lean?.version === LEAN_TURN) return payload;
  if (!payload?.answer || !payload.packet) reject('lean_turn_requires_published_answer');
  const { vector: _vector, dialogue: _dialogue, previousDialogueState: _previous, dialogueStateContext: _context, ...kept } = payload;
  const { body, ...request } = payload.requestAudit || {};
  const assist = payload.searchAssist;
  return { ...kept, packet: leanPacket(payload.packet, payload.answer),
    ...(payload.requestAudit ? { requestAudit: request } : {}),
    // The checked places and the person are what the state was projected with; the plan's queries and the selection go.
    ...(assist ? { searchAssist: { ...(assist.places ? { places: assist.places } : {}), ...(assist.person ? { person: assist.person } : {}) } } : {}),
    lean: { version: LEAN_TURN, at: now.toISOString(),
      // As proved when the turn was published: a lean turn's answer and state must still be these.
      proved: { answer: digest(payload.answer), dialogueState: digest(payload.dialogueState ?? null), fallback: digest(payload.dialogueStateFallback ?? null) },
      // What was let go, so that a copy kept elsewhere can be told to be the same.
      full: { packet: digest(payload.packet), evidence: payload.packet.evidence?.length ?? 0, references: Object.keys(payload.packet.reference_map || {}).length,
        ...(body ? { requestBody: payload.requestAudit.bodyHash ?? digest(body) } : {}), bytes: bytes(payload) } } };
}

/** A lean turn's answer and state are the ones proved at publication; anything else is a changed row. */
export function checkLeanTurn(row) {
  const proved = row.payload.lean?.proved;
  if (!proved || digest(row.payload.answer) !== proved.answer || digest(row.payload.dialogueState ?? null) !== proved.dialogueState
    || digest(row.payload.dialogueStateFallback ?? null) !== proved.fallback) reject('lean_turn_changed', 403);
}
