import test from 'node:test';
import assert from 'node:assert/strict';
import { pilotChatResult } from '../lib/chat/m4PilotClientContract.js';
import { rememberPilotIntent, forgetPilotIntent, readPilotIntentContext } from '../lib/chat/m4PilotIntent.js';
test('normal chat adapter publishes only completed answers and binds every link to a turn', () => {
  assert.equal(pilotChatResult({ state: 'unknown' }, 'conv').ok, false);
  assert.equal(pilotChatResult({ state: 'needs_recovery' }, 'conv').answer, undefined);
  const turn = { id: 'turn-123', state: 'completed', mode: 'test', answer: { kind: 'partial', blocks: [{ text: 'Piiratud vastus', refs: ['S1'] }], limitations: ['Puuduv tingimus'], clarification: null },
    sources: [{ ref: 'S1', title: '<script>not HTML</script>', pages: [3], used: true }] };
  const first = pilotChatResult(turn, 'conv-123');
  const second = pilotChatResult({ ...turn, id: 'turn-456' }, 'conv-123');
  assert.match(first.answer, /Piiratud vastus \[S1\]/);
  assert.match(first.answer, /Puuduv tingimus/);
  assert.match(first.sources[0].url, /^\/chat-source\?convId=conv-123&turnId=turn-123&ref=S1$/);
  assert.notEqual(first.sources[0].key, second.sources[0].key);
  assert.equal(first.pilotKind, 'partial');
});
test('pilot intent survives refresh without storing question text and clears only its own completed key', async () => {
  const map = new Map(); const storage = { getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
  const input = { convId: 'conversation', text: 'private question', language: 'et', key: 'first-key' };
  assert.equal(await rememberPilotIntent(storage, input), 'first-key');
  assert.equal(await rememberPilotIntent(storage, { ...input, key: 'second-key' }), 'first-key');
  assert.ok(![...map.values()][0].includes(input.text));
  forgetPilotIntent(storage, input.convId, 'other-key'); assert.equal(map.size, 1);
  forgetPilotIntent(storage, input.convId, 'first-key'); assert.equal(map.size, 0);
});

test('M4-C intent binds mode, scope and answer point; refresh restores only content-free selection', async () => {
  const map = new Map(), storage = { getItem: k => map.get(k) || null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) };
  const input = { convId: 'conversation', text: 'PRIVATE CIRCUMSTANCE', language: 'et', key: 'key-a', contextMode: 'correction', contextTurnId: 'scope-a', replyToTurnId: 'turn-a', replyToBlock: 2 };
  assert.equal(await rememberPilotIntent(storage, input), 'key-a');
  assert.equal(await rememberPilotIntent(storage, { ...input, key: 'key-b' }), 'key-a');
  assert.deepEqual(readPilotIntentContext(storage, input.convId), { contextMode: 'correction', contextTurnId: 'scope-a', replyToTurnId: 'turn-a', replyToBlock: 2 });
  for (const change of [{ contextMode: 'same' }, { contextTurnId: 'scope-b' }, { replyToTurnId: 'turn-b' }, { replyToBlock: 1 }]) {
    await rememberPilotIntent(storage, input);
    assert.equal(await rememberPilotIntent(storage, { ...input, ...change, key: 'changed-key' }), 'changed-key');
  }
  assert.ok(![...map.values()].some(value => value.includes(input.text)));
});


test('F11/F12: legacy suffix compatibility is narrow, versioned, and leaves original artifacts intact', async () => {
  const { renderAnswer, ANSWER_VERSION } = await import('../lib/rag-v2/pilot/presentation.js');
  const answer = text => ({ kind: 'grounded', blocks: [{ text, refs: ['S1', 'S3'] }], limitations: [], clarification: null });
  for (const text of ['Use cite as a word. [S1][S3]', 'Use cite as a word. citeS1S3']) {
    const raw = answer(text), before = JSON.stringify(raw);
    assert.equal(renderAnswer(raw), 'Use cite as a word. [S1, S3]');
    assert.equal(JSON.stringify(raw), before);
    assert.equal(renderAnswer(raw, ANSWER_VERSION), text + ' [S1, S3]');
  }
  for (const text of ['Unknown [S99]', 'Mixed [S99][S1]', 'Ambiguous citeS1UNKNOWN', 'The term [S1] occurs mid-sentence.', 'cite [ordinary] <script>alert(1)</script>']) {
    assert.equal(renderAnswer(answer(text)), text + ' [S1, S3]');
  }
  assert.throws(() => renderAnswer(answer('Text'), 'unrecognized-version'), { code: 'unsupported_answer_version' });
});

test('F05: mixed historical/completed/failed/unknown turns retain chronological questions and safe status keys', async () => {
  const { pilotChatMessages } = await import('../lib/chat/m4PilotClientContract.js');
  const complete = { id: 'a', state: 'completed', question: 'First', answer: { kind: 'grounded', blocks: [{ text: 'Supported [S1]', refs: ['S1'] }], limitations: [], clarification: null }, sources: [] };
  const turns = [complete, { id: 'b', state: 'answer_rejected', question: 'Second', failureKind: 'references', responseAudit: { draft: 'SECRET INVALID' } },
    { ...complete, id: 'c', question: 'Third' }, { id: 'd', state: 'unknown', question: 'Fourth' }];
  const messages = pilotChatMessages(turns, 'conversation');
  assert.deepEqual(messages.filter(m => m.role === 'user').map(m => m.text), ['First', 'Second', 'Third', 'Fourth']);
  assert.equal(messages[3].messageKey, 'm4Pilot.referenceFailed'); assert.equal(messages[3].completionStatus, 'FAILED');
  assert.equal(messages[7].messageKey, 'm4Pilot.unknown');
  assert.ok(!JSON.stringify(messages).includes('SECRET INVALID'));
});
