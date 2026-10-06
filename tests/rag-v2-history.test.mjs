import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { hash } from '../lib/rag-v2/contracts.js';
import { runtimeAdapters } from '../lib/rag-v2/pilot/retrieval.js';
import { historyRecord, historyMessages, historyTurn, isHistoryMessage, conversationTurns, historySourceView, HISTORY_VERSION } from '../lib/rag-v2/pilot/history.js';
import { completedView, PilotService } from '../lib/rag-v2/pilot/service.js';
import { PilotStore } from '../lib/rag-v2/pilot/store.js';
import { publishedDialogue } from '../lib/rag-v2/pilot/dialogue.js';
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
    askedRegions: ['naidislinn'], askedPerson: 'isa' });
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
  assert.deepEqual(asked.slice(0, 2), [{ configHash: 'plan-b', chatTurn: { userId: 'u', conversationId: 'c' } }, { conversationId: 'c' }]);
  // A row of the running plan that can no longer be restored is shown from its record; without one the failure stands.
  const fallen = await conversationTurns({ ...base, db: db([{ ...second, configHash: 'plan-b' }]), service: service(new Set(['turn-2'])) });
  assert.deepEqual(fallen.turns.map(turn => [turn.id, turn.history === true]), [['turn-1', true], ['turn-2', true]]);
  assert.equal(fallen.rows.has('turn-2'), false);
  await assert.rejects(conversationTurns({ ...base, db: db([third]), service: service(new Set(['turn-3'])) }), { code: 'reference_access_denied' });
  // One turn (the source view): both reads are narrowed to it.
  asked.length = 0;
  await conversationTurns({ ...base, db: db([]), service: service(new Set()), turnId: 'turn-1' });
  assert.deepEqual(asked, [{ configHash: 'plan-b', chatTurn: { userId: 'u', conversationId: 'c' }, id: 'turn-1' }, { conversationId: 'c', metadata: { path: ['m4TurnId'], equals: 'turn-1' } }]);
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
