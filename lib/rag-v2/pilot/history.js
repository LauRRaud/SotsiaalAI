import { renderAnswer } from './presentation.js';
import { askedRegions, askedPerson } from './person-places.js';
import { openTurn } from './packed-json.js';
import { livePilotRows } from './lifetime.js';
import { validateAnswer } from './contracts.js';
import { assistantDialogue } from './dialogue.js';

// ADR-094: the durable record of a finished chat turn is the conversation itself, kept with the conversation's own
// messages: the question, the answer as shown, a short citation of each cited source, the forms, and what the next
// turn of the dialogue takes from this one. It is a few kilobytes (the turn's audit row is hundreds), it does not
// depend on the chat plan or on the corpus version, and it stays when the audit row is let go.
// The audit row remains the proof while it exists: a turn whose row can be read is shown from the row, with its
// references checked. A turn whose row is gone, or belongs to an earlier plan, is shown from this record as it was
// answered then, without being proved again.
export const HISTORY_VERSION = 'rag-v2/history-1';
export const isHistoryMessage = message => message?.metadata?.m4History?.version === HISTORY_VERSION;

// A cited source's place without the offsets and unit ids a reference check needs: what the source view names.
const place = ({ kind, path, act_reference, start, end }) => ({ kind, ...(path === undefined ? {} : { path }), ...(act_reference ? { act_reference } : {}),
  ...(Number.isFinite(start) ? { start } : {}), ...(Number.isFinite(end) ? { end } : {}) });

/** The record of a turn at its publication. `view` is what the service shows of the completed turn (its sources with
 *  their citations, its forms, its public context); `row` and `packet` are the turn as published. */
export function historyRecord({ row, view, packet }) {
  const used = new Set(view.answer.blocks.flatMap(block => block.refs || []));
  // A record is in focus for the next turn when the answer cited one of its own fields (as publishedDialogue reads it).
  const recordFocus = packet.record_context?.entries?.filter(record => Object.values(record.fields || {}).some(field => field.refs?.some(ref => used.has(ref)))
    && ['service', 'benefit', 'resource'].includes(record.kind)).map(record => ({ id: record.record_id, region: record.region }));
  const scope = packet.record_context?.scope;
  return { version: HISTORY_VERSION, turnId: row.id, mode: view.mode, answer: view.answer, answerVersion: view.answerVersion, language: view.language,
    ...(view.context ? { context: view.context } : {}), forms: view.forms || [],
    // Only the sources the answer cites, each with the ids that find the same excerpt in the corpus again.
    sources: view.sources.filter(source => source.used).map(({ used: _used, source_locations: places, ...source }) => {
      const reference = packet.reference_map[source.ref];
      return { ...source, ...(Array.isArray(places) ? { source_locations: places.map(place) } : {}),
        document: reference.document_id, chunk: reference.chunk_id, sha256: reference.source_text_sha256 };
    }),
    // What the dialogue goes on from: the turn's place in its topic, the state it left and what it was asked about.
    // userTurns: the topic's user turns as this turn was accepted with them (the state is bound to exactly these, and
    // a turn that got no answer has no record of its own); carried: what a full topic handed to this one (ADR-070).
    dialogue: { context: row.payload.context ?? null, contextMode: row.payload.contextMode, state: row.payload.dialogueState ?? null,
      ...(row.payload.dialogueStateFallback ? { stateFallback: row.payload.dialogueStateFallback } : {}), ...(recordFocus ? { recordFocus } : {}),
      askedRegions: askedRegions(scope), askedPerson: askedPerson(scope),
      ...(Array.isArray(row.payload.contextAudit?.userTurns) ? { userTurns: row.payload.contextAudit.userTurns } : {}),
      ...(row.payload.contextAudit?.selection?.carried ? { carried: row.payload.contextAudit.selection.carried } : {}) } };
}

/** An earlier answer as the next turn's dialogue takes it, from the turn's record: the same as publishedDialogue gives
 *  from the turn's row. */
export function historyDialogue(record) {
  return assistantDialogue(record.turnId, validateAnswer(record.answer, record.sources.map(source => source.ref), record.answerVersion), record.dialogue.recordFocus);
}

/**
 * The conversation's turns that the running plan has no row for, as rows the dialogue can go on from (acceptDialogue,
 * dialogueSummary, the store's dialogueSource). Each is made from its turn's record and marked `history`.
 * known: the ids of the plan's own rows; those turns are read from their rows.
 * A turn that got no answer has no record, but it is one of its topic's user turns and the state is bound to them all:
 * it comes back, as a stopped turn, from the list a later record of the topic holds.
 * A record without that list (written by the first step of ADR-094) is shown in the history but not continued.
 */
export function historyRows(messages, known = new Set()) {
  const questions = new Map(), records = new Map(), rows = new Map();
  for (const message of messages) {
    const id = message.metadata?.m4TurnId;
    if (typeof id !== 'string') continue;
    if (message.role === 'USER') questions.set(id, message.content);
    else if (isHistoryMessage(message) && message.metadata.m4History.dialogue?.context && Array.isArray(message.metadata.m4History.dialogue.userTurns)) records.set(id, message);
  }
  const base = { configHash: null, expiresAt: null };
  for (const [id, message] of records) {
    if (known.has(id)) continue;
    const record = message.metadata.m4History, dialogue = record.dialogue;
    rows.set(id, { ...base, id, state: 'completed', history: record, createdAt: message.createdAt,
      payload: { question: questions.get(id) ?? dialogue.userTurns.at(-1)?.text ?? '', contextMode: dialogue.contextMode, context: dialogue.context,
        contextAudit: { userTurns: dialogue.userTurns, selection: dialogue.carried ? { carried: dialogue.carried } : {} }, answer: record.answer, answerVersion: record.answerVersion,
        dialogueState: dialogue.state ?? null, ...(dialogue.stateFallback ? { dialogueStateFallback: dialogue.stateFallback } : {}) } });
  }
  // Every record's list is read, also a record of a turn the plan has a row for: its list may name a turn without one.
  for (const message of records.values()) {
    const dialogue = message.metadata.m4History.dialogue, own = dialogue.userTurns.filter(turn => !turn.carried), carried = dialogue.userTurns.filter(turn => turn.carried);
    own.forEach((turn, index) => {
      if (known.has(turn.turnId) || rows.has(turn.turnId) || records.has(turn.turnId)) return;
      // Its place in the topic: before the next listed turn that has a record (the list's last always has: its own).
      const step = own.slice(index + 1).findIndex(later => records.has(later.turnId));
      if (step < 0) return;
      const after = records.get(own[index + 1 + step].turnId).metadata.m4History.dialogue.context;
      rows.set(turn.turnId, { ...base, id: turn.turnId, state: 'stopped', history: null, createdAt: message.createdAt,
        payload: { question: turn.text, contextMode: turn.mode, context: { version: dialogue.context.version, scopeId: dialogue.context.scopeId, personId: dialogue.context.personId, mode: turn.mode,
          previousTurnId: turn.correctionOf ?? null, revision: after.revision - (step + 1) / (own.length + 1), correctionRevision: 0 },
          contextAudit: { userTurns: carried, selection: dialogue.carried ? { carried: dialogue.carried } : {} } } });
    });
  }
  return [...rows.values()];
}

/** The two messages of a published turn: the question and the answer as text, the record with the answer. */
export function historyMessages(record, question) {
  return { user: { content: question, metadata: { m4TurnId: record.turnId } },
    assistant: { content: renderAnswer(record.answer, record.answerVersion), metadata: { m4TurnId: record.turnId, m4History: record } } };
}

/** A turn as the chat shows it, from its record: the same fields a restored row gives, marked as history. */
export function historyTurn(assistant, question) {
  const record = assistant.metadata.m4History;
  return { id: record.turnId, state: 'completed', mode: record.mode, question, answer: record.answer, answerVersion: record.answerVersion, language: record.language,
    context: record.context ?? null, forms: record.forms || [], messageId: assistant.id,
    sources: record.sources.map(({ document: _document, chunk: _chunk, sha256: _hash, ...source }) => ({ ...source, used: true })), history: true };
}

/** The turns of a conversation, oldest first: each from its audit row when the running plan can read it, else from
 *  its record. A row that can no longer be restored (its source changed, access was taken away) falls back to the
 *  record too; without a record the failure stands, as before. `turnId` narrows to one turn (the source view).
 *  Returns the turns as the chat shows them, the restored rows by turn id and the records by turn id. */
export async function conversationTurns({ db, service, config, userId, convId, turnId = null }) {
  const [rows, messages] = await Promise.all([
    // A row past its time is gone for every reader, whether the purge has removed it yet or not: its turn is shown from
    // its record.
    db.m4PilotTurn.findMany({ where: { configHash: config.configHash, ...livePilotRows(), chatTurn: { userId, conversationId: convId }, ...(turnId ? { id: turnId } : {}) }, orderBy: { createdAt: 'asc' }, take: 100 }),
    db.conversationMessage.findMany({ where: { conversationId: convId, ...(turnId ? { metadata: { path: ['m4TurnId'], equals: turnId } } : {}) }, orderBy: { createdAt: 'asc' }, take: 400 })]);
  const questions = new Map(), records = new Map();
  for (const message of messages) {
    const id = message.metadata?.m4TurnId;
    if (typeof id !== 'string') continue;
    if (message.role === 'USER') questions.set(id, message.content);
    else if (isHistoryMessage(message)) records.set(id, message);
  }
  const fromRecord = id => ({ ...historyTurn(records.get(id), questions.get(id) ?? ''), createdAt: records.get(id).createdAt });
  const turns = [], restored = new Map();
  for (const stored of rows) {
    const row = openTurn(stored);
    try { turns.push({ ...await service.restore(row), createdAt: row.createdAt }); restored.set(row.id, row); }
    catch (error) { if (row.state !== 'completed' || !records.has(row.id)) throw error; turns.push(fromRecord(row.id)); }
  }
  const listed = new Set(rows.map(row => row.id));
  for (const id of records.keys()) if (!listed.has(id)) turns.push(fromRecord(id));
  return { turns: turns.sort((a, b) => a.createdAt - b.createdAt), rows: restored, records: new Map([...records].map(([id, message]) => [id, message.metadata.m4History])) };
}

/** One cited source of a history turn, for the source view: its citation, and its text when the corpus still holds
 *  the same excerpt. Otherwise the view says the source has changed since and links the present version. */
export async function historySourceView({ adapters, config, record, ref }) {
  const source = record?.sources.find(item => item.ref === ref);
  if (!source) return null;
  const found = await adapters.historySource?.(config, source) ?? { text: null, links: [] };
  return { title: source.title, version: source.version, pages: source.pages || [], ...(source.source_locations ? { source_locations: source.source_locations } : {}),
    text: found.text, ref, links: found.links || [], history: true, superseded: found.text === null };
}
