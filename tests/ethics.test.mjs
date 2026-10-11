import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeEthicsContent, checkedEthicsSnapshot, ethicsIdentifierTypes, ethicsAssistantQuestion, ETHICS_FIELDS } from '../lib/ethics/shared.js';
import { askEthicsAssistant } from '../lib/ethics/assistantClient.js';

test('outgoing identifiers and malformed private fields are rejected', () => {
  for (const text of ['Mari Maasikas', 'Õnne Õun', 'Иван Петров', 'nimi@example.ee', '39101010015', '+372 51234567', 'Pikk tänav 12']) {
    assert.ok(ethicsIdentifierTypes(text).length, text);
    assert.throws(() => checkedEthicsSnapshot(text, true), /identifiers/);
  }
  assert.throws(() => checkedEthicsSnapshot('Üldistatud küsimus', false), /confirmation/);
  assert.throws(() => normalizeEthicsContent({ question: 'a'.repeat(2001) }), /invalid/);
  assert.throws(() => normalizeEthicsContent({ question: '\ud800' }), /invalid/);
  assert.throws(() => normalizeEthicsContent({ question: 'Q', ownerUserId: 'other' }), /invalid/);
  assert.equal(checkedEthicsSnapshot('Kuidas arvestada inimese soovi ja lähedaste muret?', true), 'Kuidas arvestada inimese soovi ja lähedaste muret?');
  for (const locale of ['et', 'en', 'ru']) assert.ok(ethicsAssistantQuestion('a'.repeat(2800), locale).length <= 4000);
});

test('assistant uses existing conversation pipeline, allowlists input and reuses retry keys', async () => {
  const calls = [], intent = { convId: 'conversation', clientTurnKey: 'same-turn' };
  let attempt = 0;
  const fetch = async (url, options) => {
    calls.push({ url, ...options, body: JSON.parse(options.body) });
    if (url === '/api/chat/pilot') return { ok: true };
    attempt++;
    return { ok: true, json: async () => ({ ok: true, completionStatus: attempt === 1 ? 'FAILED' : 'COMPLETED', answer: 'A', sources: [{ url: '/chat-source?ref=1' }] }) };
  };
  const input = { question: 'Reviewed snapshot', language: 'et', content: 'PRIVATE', title: 'PRIVATE' };
  await assert.rejects(askEthicsAssistant(input, intent, fetch), /assistant/);
  const result = await askEthicsAssistant(input, intent, fetch);
  assert.equal(result.sources.length, 1);
  const turns = calls.filter(c => c.url === '/api/ethics/chat');
  assert.deepEqual(turns[0].body, turns[1].body);
  assert.ok(!JSON.stringify(turns).includes('PRIVATE'));
  assert.equal(turns[0].headers['x-rag-pilot'], '1');
  assert.equal(calls[0].body.action, 'ensure');
  let rejectedCalls = 0;
  await assert.rejects(askEthicsAssistant(input, intent, async () => { rejectedCalls++; return { ok: false }; }), /assistant/);
  assert.equal(rejectedCalls, 1, 'no chat request if conversation creation fails');
  await assert.rejects(askEthicsAssistant(input, intent, async url => url === '/api/chat/pilot' ? { ok: true }
    : { ok: false, json: async () => ({ code: 'source_scope_unavailable' }) }), /ethics.errors.sources/);
});

test('all visible form labels, runtime error types and privacy texts exist in three languages', () => {
  const source = readFileSync(new URL('../components/ethics/EthicsPage.jsx', import.meta.url), 'utf8');
  const keys = [...source.matchAll(/label\('([\w.]+)'\)/g)].map(match => match[1]);
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    for (const key of keys) assert.equal(typeof key.split('.').reduce((node, part) => node?.[part], messages.ethics), 'string', `${locale}: ${key}`);
    for (const field of ETHICS_FIELDS) for (const key of ['short', 'label', 'hint']) assert.ok(messages.ethics.fields[field][key]);
    for (const key of ['invalid', 'empty', 'unauthorized', 'forbidden', 'missing', 'conflict', 'confirmation', 'snapshot', 'identifiers', 'assistant', 'sources', 'failed']) assert.ok(messages.ethics.errors[key]);
    assert.ok(messages.privacy.section7Ethics.body);
  }
});
