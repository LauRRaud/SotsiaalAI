import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { hash } from '../lib/rag-v2/contracts.js';
import { runtimeAdapters } from '../lib/rag-v2/pilot/retrieval.js';
import { historyRecord, historyMessages, historyTurn, isHistoryMessage, conversationTurns, historySourceView, historyRows, historyDialogue, HISTORY_VERSION } from '../lib/rag-v2/pilot/history.js';
import { completedView, PilotService } from '../lib/rag-v2/pilot/service.js';
import { PilotStore } from '../lib/rag-v2/pilot/store.js';
import { publishedDialogue, acceptDialogue, dialogueSummary, DIALOGUE_LIMITS } from '../lib/rag-v2/pilot/dialogue.js';
import { stateAudit, previousStateFor } from '../lib/rag-v2/pilot/dialogue-state.js';
import { conversationExpiry, pilotExpiry } from '../lib/rag-v2/pilot/lifetime.js';
import { newChatPlan, approvedChatPlan, approvedScope, renewChatPlan } from '../lib/rag-v2/pilot/chat-plan.js';
import { validRetentionHours, validPlanKind, OPENING_STORAGE } from '../lib/rag-v2/pilot/config.js';
import { leanPayload } from '../lib/rag-v2/pilot/lean-turn.js';
import { renderAnswer } from '../lib/rag-v2/pilot/presentation.js';
import { pilotChatResult, pilotChatMessages } from '../lib/chat/m4PilotClientContract.js';
import { municipalPacket } from './fixtures/rag-v2-municipal-packet.mjs';

// ADR-094: the durable record of a finished chat turn is the conversation itself, kept with the conversation's own
// messages. It is what the chat shows of the turn and what the dialogue goes on from, a few kilobytes, and it does not
// depend on the plan, the corpus version or the turn's audit row.

const bytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
// A published turn's row: a packet of Tallinn's size, an answer citing a passage and two records, one of which declares
// a form.
function publishedRow(id = 'turn-1') {
  const packet = municipalPacket();
  const entry = key => packet.record_context.entries.find(item => item.key === key);
  entry('R1').detail = 'selected_detail';
  Object.assign(entry('R3'), { kind: 'form', fields: { title: { value: 'Näidisteenuse taotlus', refs: ['S9'] }, official_url: { value: 'https://naidislinn.example/vormid/taotlus.pdf', refs: ['S9'] }, format: { value: 'PDF', refs: ['S9'] } } });
  // ADR-074: the question was about another person's municipality.
  packet.record_context.scope = { state: 'question_region', region: 'naidislinn', person_scope: { person: 'isa' } };
  const answer = { kind: 'grounded', blocks: [{ text: 'Esimene väide.', factual: true, refs: ['S1'] }, { text: 'Teine väide.', factual: true, refs: ['S7', 'S12'] }], limitations: ['Täpne summa sõltub andmetest.'], clarification: null };
  return { id, state: 'completed', configHash: 'plan-a', createdAt: new Date('2026-10-06T10:00:00Z'), expiresAt: null,
    payload: { question: 'Millist abi saab isa kodus?', contextMode: 'new', query: { language: 'et', tokens: 9 }, events: [], answer, answerVersion: 'm4-text-refs-2', messageId: 'message-1', packet,
      context: { version: 'd', scopeId: 'scope-1', personId: 'person-1', scopeTurnId: id, revision: 1, correctionRevision: 0, mode: 'new' }, contextAudit: { userTurns: [{ text: 'Millist abi saab isa kodus?' }] },
      dialogueState: { version: 's', value: { facts: [{ topic: 'living', status: 'current' }] } } } };
}
const recordOf = row => historyRecord({ row, view: completedView(row, 'real'), packet: row.payload.packet });

test('the record of a turn holds the conversation: the answer, the cited sources with a short citation, the forms, the dialogue', () => {
  const row = publishedRow(), view = completedView(row, 'real'), record = recordOf(row);
  assert.equal(view.sources.length, 104, 'the row shows every source of its packet');
  assert.equal(record.version, HISTORY_VERSION);
  assert.deepEqual([record.turnId, record.mode, record.answer, record.answerVersion, record.language], ['turn-1', 'real', row.payload.answer, 'm4-text-refs-2', 'et']);
  // Only what the answer cites, each with its citation and the ids that find the same excerpt again.
  assert.deepEqual(record.sources.map(source => source.ref), ['S1', 'S7', 'S12']);
  const first = record.sources[0], reference = row.payload.packet.reference_map.S1;
  assert.deepEqual([first.title, first.authors, first.year, first.pageRange, first.pages, first.version, first.document, first.chunk, first.sha256],
    [row.payload.packet.evidence[0].bibliography.title, ['A. Autor', 'B. Autor', 'C. Autor'], 2024, '4–5', [4, 5], reference.document_version_id, reference.document_id, reference.chunk_id, reference.source_text_sha256]);
  assert.equal('used' in first, false);
  // A place keeps what the source view names; the offsets' unit ids and the record ids stay with the audit.
  assert.deepEqual(Object.keys(record.sources[1].source_locations[0]).sort(), ['end', 'kind', 'path', 'start']);
  assert.equal(record.sources[1].checked, '2026-10-05');
  assert.deepEqual(record.forms, [{ title: 'Näidisteenuse taotlus', url: 'https://naidislinn.example/vormid/taotlus.pdf', format: 'pdf' }]);
  assert.deepEqual(record.context, view.context);
  // What the next turn takes: the turn's place in its topic, its state, the records in focus, what was asked about.
  assert.deepEqual(record.dialogue, { context: row.payload.context, contextMode: 'new', state: row.payload.dialogueState, recordFocus: publishedDialogue(row).recordFocus,
    askedRegions: ['naidislinn'], askedPerson: 'isa', userTurns: [{ text: 'Millist abi saab isa kodus?' }] });
  // A few kilobytes for a turn whose packet is more than half a megabyte.
  assert(bytes(record) < 6000 && bytes(row.payload.packet) > 500000, `${bytes(record)} of ${bytes(row.payload.packet)}`);
  // The same record from the turn's lean row is not expected: the record is made once, from the turn as published.
  assert.equal(bytes(leanPayload(row.payload)) > bytes(record), true);
});

test('the two messages of a turn hold the question and the answer as text; the record goes with the answer', () => {
  const row = publishedRow(), record = recordOf(row), messages = historyMessages(record, row.payload.question);
  assert.deepEqual(messages.user, { content: 'Millist abi saab isa kodus?', metadata: { m4TurnId: 'turn-1' } });
  assert.equal(messages.assistant.content, renderAnswer(row.payload.answer, 'm4-text-refs-2'));
  assert.match(messages.assistant.content, /^Esimene väide\. \[S1\]\n\nTeine väide\. \[S7, S12\]\n\nTäpne summa sõltub andmetest\.$/u);
  assert.deepEqual(messages.assistant.metadata, { m4TurnId: 'turn-1', m4History: record });
  assert(isHistoryMessage(messages.assistant));
  assert.equal(isHistoryMessage(messages.user), false);
  assert.equal(isHistoryMessage({ metadata: { m4TurnId: 'x' } }), false, 'a placeholder message of an earlier turn is no record');
});

test('the chat shows a turn from its record as it shows it from its row', () => {
  const row = publishedRow(), view = completedView(row, 'real'), record = recordOf(row);
  const turn = historyTurn({ id: 'message-1', metadata: { m4History: record } }, row.payload.question);
  assert.equal(turn.history, true);
  const fromRow = pilotChatResult(view, 'conversation-1'), fromRecord = pilotChatResult(turn, 'conversation-1');
  assert.equal(fromRecord.answer, fromRow.answer);
  assert.deepEqual(fromRecord.attachments, fromRow.attachments);
  assert.deepEqual([fromRecord.completionStatus, fromRecord.pilotKind, fromRecord.pilotMode, fromRecord.pilotContext], [fromRow.completionStatus, fromRow.pilotKind, fromRow.pilotMode, fromRow.pilotContext]);
  // The same cited sources with the same headings and addresses; a place is shorter in the record.
  const plain = sources => sources.map(({ source_locations: _places, ...source }) => source);
  assert.deepEqual(plain(fromRecord.sources), plain(fromRow.sources));
  assert.equal(fromRecord.sources.length, 3);
  const [user, ai] = pilotChatMessages([{ ...turn, createdAt: row.createdAt }], 'conversation-1');
  assert.deepEqual([user.role, user.text, ai.role, ai.text, ai.completionStatus], ['user', 'Millist abi saab isa kodus?', 'ai', fromRow.answer, 'COMPLETED']);
});

test('a conversation\'s turns come from the rows the running plan can read and from the records of the rest', async () => {
  const first = publishedRow('turn-1'), second = publishedRow('turn-2'), third = publishedRow('turn-3'), stopped = { id: 'turn-4', state: 'stopped', configHash: 'plan-b', createdAt: new Date('2026-10-06T10:03:00Z'), payload: { question: 'Katkenud küsimus', error: 'x' } };
  second.createdAt = new Date('2026-10-06T10:01:00Z'); third.createdAt = new Date('2026-10-06T10:02:00Z');
  const message = (row, at) => { const pair = historyMessages(recordOf(row), row.payload.question);
    return [{ id: `${row.id}-u`, role: 'USER', createdAt: at, ...pair.user }, { id: `${row.id}-a`, role: 'ASSISTANT', createdAt: at, ...pair.assistant }]; };
  const messages = [...message(first, first.createdAt), ...message(second, second.createdAt), { id: 'old-u', role: 'USER', createdAt: new Date(1), content: '[Kaitstud M4 sisepiloodi küsimus]', metadata: { m4TurnId: 'old' } },
    { id: 'old-a', role: 'ASSISTANT', createdAt: new Date(1), content: '[Kaitstud M4 sisepiloodi vastus]', metadata: { m4TurnId: 'old' } }];
  const asked = [];
  const db = rows => ({ m4PilotTurn: { findMany: async query => { asked.push(query.where); return rows; } }, conversationMessage: { findMany: async query => { asked.push(query.where); return messages; } } });
  const service = failing => ({ restore: async row => { if (failing.has(row.id)) throw Object.assign(new Error('reference_access_denied'), { code: 'reference_access_denied' });
    return row.state === 'completed' ? completedView(row, 'real') : { id: row.id, state: row.state, question: row.payload.question }; } });
  const config = { configHash: 'plan-b' }, base = { config, userId: 'u', convId: 'c' };
  // The running plan (plan-b) holds the third turn and the stopped one; the first two are of an earlier plan and are
  // read from their records. A placeholder pair of a turn before ADR-094 has no record and is not listed.
  const listed = await conversationTurns({ ...base, db: db([third, stopped]), service: service(new Set()) });
  assert.deepEqual(listed.turns.map(turn => [turn.id, turn.state, turn.history === true]), [['turn-1', 'completed', true], ['turn-2', 'completed', true], ['turn-3', 'completed', false], ['turn-4', 'stopped', false]]);
  assert.deepEqual([listed.turns[0].question, listed.turns[0].answer, listed.turns[0].messageId], [first.payload.question, first.payload.answer, 'turn-1-a']);
  assert.deepEqual([...listed.rows.keys()], ['turn-3', 'turn-4']);
  assert.deepEqual([...listed.records.keys()], ['turn-1', 'turn-2']);
  // The rows asked for are the running plan's live ones: a row past its time is read by no one, purged or not.
  const { OR: live, ...rows } = asked[0];
  assert.deepEqual([rows, asked[1]], [{ configHash: 'plan-b', chatTurn: { userId: 'u', conversationId: 'c' } }, { conversationId: 'c' }]);
  assert.deepEqual([live[0], Object.keys(live[1].expiresAt)], [{ expiresAt: null }, ['gt']]);
  // A row of the running plan that can no longer be restored is shown from its record; without one the failure stands.
  const fallen = await conversationTurns({ ...base, db: db([{ ...second, configHash: 'plan-b' }]), service: service(new Set(['turn-2'])) });
  assert.deepEqual(fallen.turns.map(turn => [turn.id, turn.history === true]), [['turn-1', true], ['turn-2', true]]);
  assert.equal(fallen.rows.has('turn-2'), false);
  await assert.rejects(conversationTurns({ ...base, db: db([third]), service: service(new Set(['turn-3'])) }), { code: 'reference_access_denied' });
  // One turn (the source view): both reads are narrowed to it.
  asked.length = 0;
  await conversationTurns({ ...base, db: db([]), service: service(new Set()), turnId: 'turn-1' });
  assert.deepEqual([{ ...asked[0], OR: undefined }, asked[1]].map(where => JSON.parse(JSON.stringify(where))),
    [{ configHash: 'plan-b', chatTurn: { userId: 'u', conversationId: 'c' }, id: 'turn-1' }, { conversationId: 'c', metadata: { path: ['m4TurnId'], equals: 'turn-1' } }]);
});

test('a history turn\'s source opens with its text only while the corpus holds the same excerpt', async () => {
  const record = recordOf(publishedRow()), config = { documents: {} }, seen = [];
  const adapters = found => ({ historySource: async (_config, source) => { seen.push(source); return found; } });
  const same = await historySourceView({ adapters: adapters({ text: 'Sama lõik', links: ['https://naidis.example/a'] }), config, record, ref: 'S7' });
  assert.deepEqual(same, { title: record.sources[1].title, version: record.sources[1].version, pages: [], source_locations: record.sources[1].source_locations, text: 'Sama lõik', ref: 'S7',
    links: ['https://naidis.example/a'], history: true, superseded: false });
  assert.deepEqual([seen[0].document, seen[0].chunk, seen[0].sha256], [record.sources[1].document, record.sources[1].chunk, record.sources[1].sha256]);
  const changed = await historySourceView({ adapters: adapters({ text: null, links: ['https://naidis.example/a'] }), config, record, ref: 'S1' });
  assert.deepEqual([changed.text, changed.superseded, changed.pages, changed.links], [null, true, [4, 5], ['https://naidis.example/a']]);
  // Without the corpus lookup nothing is claimed about the text; a ref the answer did not cite is no source of the turn.
  assert.deepEqual((await historySourceView({ adapters: {}, config, record, ref: 'S1' })).superseded, true);
  assert.equal(await historySourceView({ adapters: adapters({ text: 'x', links: [] }), config, record, ref: 'S2' }), null);
  assert.equal(await historySourceView({ adapters: adapters({ text: 'x', links: [] }), config, record: undefined, ref: 'S1' }), null);
});

test('the store publishes a turn with its two messages as text and marks the conversation active', async () => {
  const row = publishedRow(), { answer, packet, messageId: _message, ...claimed } = row.payload, written = { messages: [], conversation: [], turn: null };
  const stored = { ...row, state: 'needs_recovery', chatTurnId: 'chat', payload: { ...claimed, userId: 'u', convId: 'c', timings: {} } };
  const tx = { $executeRaw: async () => {}, $queryRaw: async () => [], conversation: { findUnique: async () => ({ userId: 'u', metadata: { m4: true } }), update: async query => { written.conversation.push(query); return {}; } },
    conversationMessage: { create: async ({ data }) => { written.messages.push(data); return { id: `message-${written.messages.length}` }; } }, chatTurn: { update: async () => ({}) },
    m4PilotTurn: { findUnique: async () => stored, count: async () => 0, update: async ({ data }) => { written.turn = data; return { ...stored, ...data }; } } };
  const store = new PilotStore({ $transaction: async fn => fn(tx) }), service = new PilotService({ store, readConfig: async () => ({}), adapters: {} });
  const config = { id: 'm4-plan', tenant: packet.tenant, configHash: 'plan-a', mode: 'real' };
  const before = Date.now();
  await store.publish(config, stored, answer, packet, service.history(config, { ...stored, payload: { ...stored.payload, answer } }, answer, packet));
  assert.deepEqual(written.messages.map(message => [message.role, message.conversationId, message.content]), [['USER', 'c', 'Millist abi saab isa kodus?'], ['ASSISTANT', 'c', renderAnswer(answer, 'm4-text-refs-2')]]);
  assert.equal(written.messages[0].authorId, 'u');
  assert.equal(written.messages[1].createdAt - written.messages[0].createdAt, 1, 'the answer is dated after its question');
  assert.deepEqual(written.messages[0].metadata, { m4TurnId: 'turn-1' });
  assert.equal(written.messages[1].metadata.m4History.version, HISTORY_VERSION);
  assert.deepEqual(written.messages[1].metadata.m4History.sources.map(source => source.ref), ['S1', 'S7', 'S12']);
  assert.deepEqual(written.conversation.map(query => query.where), [{ id: 'c' }]);
  assert(written.conversation[0].data.lastActivityAt >= before && written.conversation[0].data.lastActivityAt.getTime() === written.messages[0].createdAt.getTime());
  assert.equal(written.turn.state, 'completed');
  // A turn whose record cannot be made (here an answer version the chat cannot show) is still published, as turns were
  // before ADR-094: with the placeholders, and without the record.
  const logged = [], log = console.error;
  console.error = (...parts) => logged.push(parts);
  let none;
  try { none = service.history(config, { ...stored, payload: { ...stored.payload, answerVersion: 'm4-unknown-version' } }, answer, packet); } finally { console.error = log; }
  assert.equal(none, null);
  assert.deepEqual(logged, [['[rag-v2] history record not made', 'unsupported_answer_version']]);
  written.messages.length = 0;
  await store.publish(config, stored, answer, packet, none);
  assert.deepEqual(written.messages.map(message => message.content), ['[Kaitstud M4 sisepiloodi küsimus]', '[Kaitstud M4 sisepiloodi vastus]']);
});

test('the corpus gives a history source its text for the same version and the same excerpt, else only the present links', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-history-'));
  try {
    const tenant = 'history-test', dir = path.join(root, 'source');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'source.html'), '<article><p>An exact source quotation for the history.</p></article>');
    const { bundle, output } = await ingest({ tenant, inputRoot: dir, storeRoot: path.join(dir, 'store'), rights: { access: 'local_private', usage: 'development_only' },
      profile: { id: 'generic-fixtures', version: '1', months: [], categoryLabels: [] },
      metadata: { document_id: 'history-source', title: 'Fixture history source', source_type: 'fixture', language: 'en', source_path: 'source.html', source_format: 'html',
        source_urls: ['https://naidis.example/allikas', 'http://naidis.example/turvamata'] } });
    const config = { mode: 'test', tenant, testBundlePath: path.join(output, 'bundle.json'), configHash: 'fixture', documents: { [bundle.document.id]: bundle.version.id } };
    const adapters = runtimeAdapters(async () => config, 'operator'), chunk = bundle.chunks[0];
    // The record's source as historyRecord keeps it: the ids and the hash of the excerpt the answer cited.
    const source = { ref: 'S1', title: 'Fixture history source', version: bundle.version.id, document: bundle.document.id, chunk: chunk.id, sha256: hash(chunk.source_text) };
    const links = ['https://naidis.example/allikas'];
    assert.deepEqual(await adapters.historySource(config, source), { text: chunk.source_text, links });
    assert.match(chunk.source_text, /An exact source quotation for the history./u);
    // Another version of the document since, another excerpt under the same id, or an excerpt that is no longer there:
    // the text as it was is not shown, the present version is linked.
    assert.deepEqual(await adapters.historySource(config, { ...source, version: 'version_earlier' }), { text: null, links });
    assert.deepEqual(await adapters.historySource(config, { ...source, sha256: hash('another text') }), { text: null, links });
    assert.deepEqual(await adapters.historySource(config, { ...source, chunk: 'chunk_gone' }), { text: null, links });
    // A document the running plan does not hold (taken out of the corpus, or out of this plan's access) gives nothing.
    assert.deepEqual(await adapters.historySource({ ...config, documents: {} }, source), { text: null, links: [] });
    assert.deepEqual(await adapters.historySource(config, { ...source, document: 'document_other' }), { text: null, links: [] });
    assert.deepEqual(await adapters.historySource(config, { ref: 'S1' }), { text: null, links: [] });
    // The whole way: the source view of a history turn.
    const record = { sources: [source] };
    assert.deepEqual(await historySourceView({ adapters, config, record, ref: 'S1' }), { title: 'Fixture history source', version: bundle.version.id, pages: [], text: chunk.source_text, ref: 'S1', links, history: true, superseded: false });
    assert.equal((await historySourceView({ adapters, config: { ...config, documents: {} }, record, ref: 'S1' })).superseded, true);
  } finally {
    const target = path.resolve(root);
    assert(target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('rag-v2-history-'));
    await fs.rm(target, { recursive: true, force: true });
  }
});

// ADR-094, step 2: the dialogue goes on from a turn's record when its audit row cannot be read. The rows made from the
// records must give the dialogue exactly what the audit rows gave: the state of a topic is bound to its user turns.
const plan = { configHash: 'plan-a', embedding: { model: 'test' }, model: 'test', maxOutputTokens: 1000, reasoning: 'low' };
// A conversation accepted turn by turn as the store does it: the plan's rows, and the two messages of each published turn.
function conversation(config = plan) {
  const rows = [], messages = [];
  let head = null;
  const next = (question, mode = 'same', answered = true) => {
    const id = `turn-${String(rows.length + 1).padStart(8, '0')}`, at = new Date(1000 * (rows.length + 1));
    const contextAudit = acceptDialogue(config, { question, contextMode: mode }, rows, head, id);
    const answer = { kind: 'grounded', blocks: [{ text: `Vastus ${rows.length + 1}.`, factual: true, refs: ['S1'] }, { text: 'Teine punkt.', factual: true, refs: ['S1'] }], limitations: [], clarification: null };
    const packet = { reference_map: { S1: { document_id: 'doc', document_version_id: 'v1', chunk_id: 'chunk', source_text_sha256: 'a'.repeat(64), evidence_id: 'e1', pdf_pages: [1] } },
      evidence: [{ evidence_id: 'e1', bibliography: { title: 'Allikas' } }] };
    const row = { id, state: answered ? 'completed' : 'stopped', configHash: config.configHash, createdAt: at, expiresAt: null,
      payload: { question, contextMode: mode, context: contextAudit.context, contextAudit, query: { language: 'et', tokens: 1 }, events: [],
        ...(answered ? { answer, answerVersion: 'm4-text-refs-2', packet, dialogueState: stateAudit({ facts: [], note: id }, contextAudit) } : {}) } };
    rows.push(row); head = { configHash: config.configHash, turnId: id, revision: contextAudit.context.revision, scopeId: contextAudit.context.scopeId, personId: contextAudit.context.personId };
    if (answered) {
      const pair = historyMessages(historyRecord({ row, view: completedView(row, 'real'), packet }), question);
      messages.push({ id: `${id}-u`, role: 'USER', createdAt: at, ...pair.user }, { id: `${id}-a`, role: 'ASSISTANT', createdAt: new Date(at.getTime() + 1), ...pair.assistant });
    }
    return row;
  };
  // What the store reads back: JSON as the database returns it.
  return { rows, next, head: () => head, messages: () => JSON.parse(JSON.stringify(messages)).map(message => ({ ...message, createdAt: new Date(message.createdAt) })) };
}
const withoutTime = accepted => ({ ...accepted, context: { ...accepted.context, acceptedAt: null } });

test('the next turn is accepted from the records as from the audit rows: the same user turns, topic, person and state binding', () => {
  const c = conversation();
  c.next('Olen 67 ja elan Harkus.', 'new'); c.next('Milline abi?', 'same', false); const third = c.next('Parandus: elan Tartus.', 'correction');
  const input = { question: 'Aga hind?', contextMode: 'same' }, other = { ...plan, configHash: 'plan-b' };
  const fromRows = acceptDialogue(plan, input, c.rows, c.head(), 'turn-next');
  // Another plan reads none of these rows: every turn comes from the records.
  const recorded = historyRows(c.messages());
  assert.deepEqual(recorded.map(row => [row.id, row.state, Boolean(row.history)]).sort(), [['turn-00000001', 'completed', true], ['turn-00000002', 'stopped', false], ['turn-00000003', 'completed', true]]);
  // The turn that got no answer has no record: it is one of the topic's user turns and comes back from the third's list.
  const lost = recorded.find(row => row.id === 'turn-00000002');
  assert.deepEqual([lost.payload.question, lost.payload.context.mode, lost.payload.context.revision > 1 && lost.payload.context.revision < 3], ['Milline abi?', 'same', true]);
  const fromRecords = acceptDialogue(other, input, recorded, c.head(), 'turn-next');
  assert.deepEqual(fromRecords.userTurns, fromRows.userTurns);
  assert.deepEqual(fromRecords.userTurns.map(turn => [turn.text, turn.mode, turn.correctionOf]), [['Olen 67 ja elan Harkus.', 'new', null], ['Milline abi?', 'same', null],
    ['Parandus: elan Tartus.', 'correction', 'turn-00000002'], ['Aga hind?', 'same', null]]);
  assert.deepEqual(withoutTime(fromRecords), withoutTime(fromRows));
  assert.deepEqual([fromRecords.context.revision, fromRecords.context.correctionRevision, fromRecords.selection.assistantTurnId, fromRecords.selection.headFromEarlierPlan], [4, 1, third.id, undefined]);
  // The state the third turn saved binds to the turns as the records give them.
  const source = recorded.find(row => row.id === third.id);
  assert.deepEqual(previousStateFor(source.payload.dialogueState, fromRecords), third.payload.dialogueState);
  // The earlier answer as the dialogue takes it: the same from the record as from the row.
  assert.deepEqual(historyDialogue(source.history), publishedDialogue(third));
  // A turn the plan has a row for is read from the row; its record still brings back the turn its list names.
  assert.deepEqual(historyRows(c.messages(), new Set([third.id])).map(row => row.id).sort(), ['turn-00000001', 'turn-00000002']);
  const mixed = acceptDialogue(plan, input, [third, ...historyRows(c.messages(), new Set([third.id]))], c.head(), 'turn-next');
  assert.deepEqual(withoutTime(mixed), withoutTime(fromRows));
  // What the composer reads: the active topic is known, so the next message continues it.
  const summary = dialogueSummary(recorded, c.head());
  assert.deepEqual([summary.active.scopeId, summary.active.userTurns, summary.unavailable, summary.scopes.length, summary.scopes[0].answers.length], [third.payload.context.scopeId, 3, false, 1, 2]);
});

test('a full topic hands its last message and answer on from the records as from the rows', () => {
  const c = conversation();
  c.next('Esimene.', 'new');
  for (let turn = 2; turn <= DIALOGUE_LIMITS.scopeTurns; turn++) c.next(`Sõnum ${turn}.`);
  const ninth = c.next('Üheksas.'), other = { ...plan, configHash: 'plan-b' };
  assert.equal(ninth.payload.context.mode, 'new');
  assert.deepEqual(ninth.payload.contextAudit.userTurns.map(turn => [turn.text, turn.carried ?? null]), [[`Sõnum ${DIALOGUE_LIMITS.scopeTurns}.`, 'message'], ['Üheksas.', null]]);
  const input = { question: 'Kümnes.', contextMode: 'same' }, recorded = historyRows(c.messages());
  assert.equal(recorded.length, DIALOGUE_LIMITS.scopeTurns + 1);
  const fromRows = acceptDialogue(plan, input, c.rows, c.head(), 'turn-next'), fromRecords = acceptDialogue(other, input, recorded, c.head(), 'turn-next');
  assert.deepEqual(withoutTime(fromRecords), withoutTime(fromRows));
  assert.deepEqual(fromRecords.userTurns.map(turn => turn.text), [`Sõnum ${DIALOGUE_LIMITS.scopeTurns}.`, 'Üheksas.', 'Kümnes.']);
  assert.deepEqual(fromRecords.selection.carried, ninth.payload.contextAudit.selection.carried);
  // The same when the full topic itself is read from the records: the ninth message is accepted from them.
  const eight = conversation();
  eight.next('Esimene.', 'new');
  for (let turn = 2; turn <= DIALOGUE_LIMITS.scopeTurns; turn++) eight.next(`Sõnum ${turn}.`);
  const again = { question: 'Üheksas.', contextMode: 'same' };
  assert.deepEqual(withoutTime(acceptDialogue(other, again, historyRows(eight.messages()), eight.head(), 'turn-next')), withoutTime(acceptDialogue(plan, again, eight.rows, eight.head(), 'turn-next')));
});

test('a head the dialogue does not know starts a new topic after a plan change; a record of the first step is shown, not continued', () => {
  const c = conversation();
  c.next('Olen 67 ja elan Harkus.', 'new'); const failed = c.next('Uus inimene.', 'new_person', false);
  const other = { ...plan, configHash: 'plan-b' }, recorded = historyRows(c.messages());
  // The last turn before the plan change got no answer: nothing names its person, and no later record lists it.
  assert.deepEqual(recorded.map(row => row.id), ['turn-00000001']);
  const accepted = acceptDialogue(other, { question: 'Aga hind?', contextMode: 'same' }, recorded, c.head(), 'turn-next');
  assert.deepEqual([accepted.context.scopeId, accepted.context.personId, accepted.selection.headFromEarlierPlan, accepted.userTurns.length, accepted.context.revision], ['turn-next', 'turn-next', true, 1, 2]);
  assert.equal(failed.payload.context.revision, 2);
  assert.deepEqual([dialogueSummary(recorded, c.head()).active, dialogueSummary(recorded, c.head()).unavailable], [null, true]);
  // A record written before the list of user turns was kept holds no dialogue to go on from.
  const early = c.messages().map(message => (message.metadata.m4History ? { ...message, metadata: { ...message.metadata,
    m4History: { ...message.metadata.m4History, dialogue: { ...message.metadata.m4History.dialogue, userTurns: undefined } } } } : message));
  assert.deepEqual(historyRows(early), []);
  // Messages of other kinds and placeholders are not turns.
  assert.deepEqual(historyRows([{ id: 'x', role: 'ASSISTANT', content: 'tere', metadata: null, createdAt: new Date() }, { id: 'y', role: 'ASSISTANT', content: '[Kaitstud M4 sisepiloodi vastus]', metadata: { m4TurnId: 'old' }, createdAt: new Date() }]), []);
});

// ADR-094, step 3: the audit row is temporary and the conversation follows the published 90-day rule.
test('a head without an answer whose row is gone stands in its topic\'s last known turn; one that began its own topic leaves nothing to continue', () => {
  const c = conversation();
  const first = c.next('Olen 67 ja elan Harkus.', 'new'), second = c.next('Milline abi?');
  const lost = c.next('See ei saanud vastust.', 'same', false);
  // The lost turn's row has expired and no record lists it: the dialogue has two turns, and the head names the topic.
  const recorded = historyRows(c.messages()), head = c.head();
  assert.deepEqual([recorded.map(row => row.id), head.turnId, head.scopeId], [[first.id, second.id], lost.id, first.payload.context.scopeId]);
  const accepted = acceptDialogue(plan, { question: 'Aga hind?', contextMode: 'same' }, recorded, head, 'turn-next');
  assert.deepEqual(accepted.userTurns.map(turn => turn.text), ['Olen 67 ja elan Harkus.', 'Milline abi?', 'Aga hind?']);
  assert.deepEqual([accepted.context.scopeId, accepted.context.personId, accepted.context.revision, accepted.selection.assistantTurnId], [first.payload.context.scopeId, first.payload.context.personId, 4, second.id]);
  assert.deepEqual(previousStateFor(recorded[1].payload.dialogueState, accepted), second.payload.dialogueState);
  const summary = dialogueSummary(recorded, head);
  assert.deepEqual([summary.active.scopeId, summary.unavailable], [first.payload.context.scopeId, false]);
  // A head written before the head named its topic gives no such stand-in.
  assert.throws(() => acceptDialogue(plan, { question: 'Aga hind?', contextMode: 'same' }, recorded, { configHash: head.configHash, turnId: head.turnId, revision: head.revision }, 'turn-next'), { code: 'context_unavailable' });
  // A lost head that began another person's topic: nothing of that topic is known, and the older person is not taken up.
  const other = conversation();
  other.next('Vana inimene.', 'new'); other.next('Uus inimene.', 'new_person', false);
  assert.throws(() => acceptDialogue(plan, { question: 'Aga hind?', contextMode: 'same' }, historyRows(other.messages()), other.head(), 'turn-next'), { code: 'context_unavailable' });
  assert.deepEqual([dialogueSummary(historyRows(other.messages()), other.head()).active, dialogueSummary(historyRows(other.messages()), other.head()).unavailable], [null, true]);
});

test('a conversation lives 90 days from its last activity whatever time the plan gives the audit row; a plan without any limit keeps both', async () => {
  const at = new Date('2026-10-06T12:00:00Z'), day = 86400000, saved = process.env.CONVERSATION_TTL_DAYS;
  try {
    delete process.env.CONVERSATION_TTL_DAYS;
    assert.equal(conversationExpiry({ expiresAt: null, retentionHours: 24 }, at).getTime(), at.getTime() + 90 * day);
    assert.equal(conversationExpiry({ expiresAt: '2026-10-07T00:00:00Z', retentionHours: null }, at).getTime(), at.getTime() + 90 * day, 'the plan\'s own end does not end the conversation');
    assert.equal(conversationExpiry({ expiresAt: null, retentionHours: null }, at), null, 'the explicit absence of a limit');
    process.env.CONVERSATION_TTL_DAYS = '30';
    assert.equal(conversationExpiry({ expiresAt: null, retentionHours: 168 }, at).getTime(), at.getTime() + 30 * day);
  } finally { if (saved === undefined) delete process.env.CONVERSATION_TTL_DAYS; else process.env.CONVERSATION_TTL_DAYS = saved; }
  // The audit row's time is the plan's, as before.
  const row = pilotExpiry({ expiresAt: null, retentionHours: 24 }).getTime() - Date.now();
  assert(row > 23.9 * 3600000 && row <= 24 * 3600000);
  assert.equal(pilotExpiry({ expiresAt: null, retentionHours: null }), null);
  // The plan carries the retention time as a checked, approved setting.
  for (const [value, ok] of [[1, true], [24, true], [168, true], [169, false], [0, false], [1.5, false], ['24', false], [null, false]]) assert.equal(validRetentionHours(value), ok, String(value));
  const embedding = { embedding_mode: 'real', provider: 'openai', model: 'text-embedding-3-large', dimensions: 3072, endpoint: 'https://api.openai.com/v1/embeddings' };
  const generation = { id: `search_generation_${'1'.repeat(64)}`, config: { embedding }, snapshot: { documents: { [`document_${'a'.repeat(64)}`]: { version_id: `version_${'b'.repeat(64)}` } } } };
  const make = extra => newChatPlan({ generation, tenant: 'sotsiaalai-corpus', profileId: 'hybrid-estnltk-chat-v1', users: ['owner-user'], accountProject: 'proj_synthetic',
    prices: { embeddingInput: 130, answerInput: 125, answerOutput: 500 }, reasoning: 'low', nanoUsd: 4e9, basis: 'Synthetic owner instruction', now: new Date('2026-10-06T08:00:00Z'), ...extra });
  const kept = await make({}), week = await make({ retentionHours: 168, auditDays: 0 });
  assert.deepEqual([kept.retentionHours, week.retentionHours, week.auditDays], [null, 168, 0]);
  assert(approvedChatPlan(kept) && approvedChatPlan(week));
  assert.notEqual(approvedScope(week), approvedScope(await make({ auditDays: 0 })));
  assert.equal(approvedChatPlan({ ...week, retentionHours: null }), false, 'changing the setting breaks the approval');
  await assert.rejects(make({ retentionHours: 200 }), { code: 'invalid_retention_hours' });
  // A plan made for the opening must state both storage times (owner's decision of 06.10.2026): how long a row lives
  // and for how many days a finished turn keeps its full audit. A development plan, and a plan without a kind, need
  // neither.
  for (const [config, ok] of [[{}, true], [{ kind: 'development', retentionHours: null }, true], [{ kind: 'opening', retentionHours: 168, auditDays: 0 }, true],
    [{ kind: 'opening', retentionHours: 24, auditDays: 7 }, true], [{ kind: 'opening', retentionHours: null, auditDays: 0 }, false], [{ kind: 'opening', retentionHours: 168 }, false],
    [{ kind: 'opening' }, false], [{ kind: 'production', retentionHours: 168, auditDays: 0 }, false]]) assert.equal(validPlanKind(config), ok, JSON.stringify(config));
  assert.deepEqual(OPENING_STORAGE, { auditDays: 0, retentionHours: 168 });
  for (const extra of [{ kind: 'opening' }, { kind: 'opening', retentionHours: 168 }, { kind: 'opening', auditDays: 0 }]) await assert.rejects(make(extra), { code: 'opening_plan_requires_retention' });
  await assert.rejects(make({ kind: 'production', retentionHours: 168, auditDays: 0 }), { code: 'invalid_plan_kind' });
  const opening = await make({ kind: 'opening', ...OPENING_STORAGE });
  assert.deepEqual([opening.kind, opening.retentionHours, opening.auditDays, approvedChatPlan(opening), 'kind' in kept], ['opening', 168, 0, true, false]);
  assert.notEqual(approvedScope(opening), approvedScope(week), 'the kind is part of what was approved');
  // A release's renewal keeps the kind and its times.
  const renewed = await renewChatPlan(opening, { release: 'abcdef1' });
  assert.deepEqual([renewed.kind, renewed.retentionHours, renewed.auditDays, approvedScope(renewed) === approvedScope(opening)], ['opening', 168, 0, true]);
  // An opening plan's conversations follow the published 90 days whatever else it says.
  assert.equal(conversationExpiry(opening, new Date('2026-10-06T10:00:00Z')).getTime(), Date.parse('2026-10-06T10:00:00Z') + 90 * 86400000);
});
