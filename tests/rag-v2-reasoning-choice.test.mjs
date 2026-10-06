import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readPilotConfig, reasoningOffer, validReasoningChoices, REASONING_EFFORTS } from '../lib/rag-v2/pilot/config.js';
import { approvedChatPlan, approvedScope, newChatPlan, renewChatPlan } from '../lib/rag-v2/pilot/chat-plan.js';
import { PilotService } from '../lib/rag-v2/pilot/service.js';
import { answerRequest, budgetLedgerId, digest } from '../lib/rag-v2/pilot/contracts.js';
import { embeddingConfig } from '../lib/rag-v2/search/embedding.js';
import { initialReasoning, readSavedReasoning, reasoningChoiceAvailable, saveReasoning, toggledReasoning,
  PILOT_REASONING_STORAGE_KEY } from '../lib/chat/m4PilotReasoning.js';

// ADR-092: the composer's lightning button "Kiire vastus". The owner-approved plan may offer the answer's reasoning effort
// as a choice (reasoningChoices); a chat request may then name one of them, and the answer is written with it. A plan
// without the field, and a request without the choice, behave as before.

test('a plan offers a choice only as a list of two or three different efforts that holds its own', () => {
  assert.deepEqual(REASONING_EFFORTS, ['low', 'medium', 'high']);
  for (const [reasoning, reasoningChoices, ok] of [['medium', ['low', 'medium'], true], ['medium', ['medium', 'low'], true], ['low', ['low', 'medium', 'high'], true],
    ['medium', ['low', 'high'], false], ['medium', ['medium'], false], ['medium', ['medium', 'medium'], false], ['medium', ['low', 'medium', 'max'], false],
    ['medium', 'low,medium', false], ['medium', [], false], [undefined, ['low', 'medium'], false]]) {
    assert.equal(validReasoningChoices({ reasoning, reasoningChoices }), ok, JSON.stringify([reasoning, reasoningChoices]));
  }
  // What the chat is told: the lowest and the highest effort offered, and the plan's own for a user who chose nothing.
  assert.deepEqual(reasoningOffer({ reasoning: 'medium', reasoningChoices: ['medium', 'low'] }), { quick: 'low', thorough: 'medium', fallback: 'medium' });
  assert.deepEqual(reasoningOffer({ reasoning: 'low', reasoningChoices: ['high', 'medium', 'low'] }), { quick: 'low', thorough: 'high', fallback: 'low' });
  assert.equal(reasoningOffer({ reasoning: 'medium' }), null);
  assert.equal(reasoningOffer(null), null);
});

test('the plan file: a valid choice is read as it is, an invalid one stops the chat', async t => {
  const original = { ...process.env };
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'm4-reasoning-')), file = path.join(dir, 'config.json');
  t.after(async () => { await fs.rm(dir, { recursive: true, force: true }); for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key]; Object.assign(process.env, original); });
  Object.assign(process.env, { M4_PILOT_CONFIG: file, M4_PILOT_ENABLED: '1', NODE_ENV: 'development' });
  const config = { id: 'test-pilot', mode: 'test', users: ['tester'], tenant: 'test', usage: 'development_only', expiresAt: null, retentionHours: null, timeoutMs: 1000,
    documents: { doc: 'version' }, budget: { attempts: 4, embeddingAttempts: 8, answerAttempts: 8, tokens: 10000, nanoUsd: 0 }, profileId: 'vector-ranked-first-v1', embedding: embeddingConfig() };
  const write = async (value, at) => { await fs.writeFile(file, JSON.stringify(value)); await fs.utimes(file, at, at); };
  await write(config, new Date(1e12));
  assert.equal(reasoningOffer(await readPilotConfig('tester')), null);
  await write({ ...config, reasoning: 'medium', reasoningChoices: ['low', 'medium'] }, new Date(1e12 + 1000));
  const read = await readPilotConfig('tester');
  assert.deepEqual(read.reasoningChoices, ['low', 'medium']);
  assert.deepEqual(reasoningOffer(read), { quick: 'low', thorough: 'medium', fallback: 'medium' });
  let at = 1e12 + 2000;
  for (const bad of [{ reasoningChoices: ['low', 'medium'] }, { reasoning: 'medium', reasoningChoices: ['low', 'high'] }, { reasoning: 'medium', reasoningChoices: ['medium'] },
    { reasoning: 'medium', reasoningChoices: 'low' }, { reasoning: 'medium', reasoningChoices: null }]) {
    await write({ ...config, ...bad }, new Date(at += 1000));
    await assert.rejects(readPilotConfig('tester'), { code: 'not_configured' }, JSON.stringify(bad));
  }
});

test('a new plan carries the choice only when it is asked for; it is approved content and a release keeps it', async () => {
  const embedding = { embedding_mode: 'real', provider: 'openai', model: 'text-embedding-3-large', dimensions: 3072, endpoint: 'https://api.openai.com/v1/embeddings' };
  const generation = { id: `search_generation_${'1'.repeat(64)}`, config: { embedding },
    snapshot: { documents: { [`document_${'a'.repeat(64)}`]: { version_id: `version_${'b'.repeat(64)}` } } } };
  const make = extra => newChatPlan({ generation, tenant: 'sotsiaalai-corpus', profileId: 'hybrid-estnltk-chat-v1', users: ['owner-user'], accountProject: 'proj_synthetic',
    prices: { embeddingInput: 130, answerInput: 125, answerOutput: 500 }, reasoning: 'medium', nanoUsd: 4e9, basis: 'Synthetic owner instruction', now: new Date('2026-10-06T08:00:00Z'), ...extra });
  const plain = await make({}), offering = await make({ reasoningChoices: ['low', 'medium'] });
  assert.equal('reasoningChoices' in plain, false);
  assert.deepEqual([offering.reasoning, offering.reasoningChoices], ['medium', ['low', 'medium']]);
  assert(approvedChatPlan(offering));
  assert.notEqual(approvedScope(offering), approvedScope(plain), 'the choice is part of what the owner approved');
  // Taking the choice out of an approved plan, or putting one in, breaks its approval.
  const { reasoningChoices: _choices, ...stripped } = offering;
  assert.equal(approvedChatPlan(stripped), false);
  assert.equal(approvedChatPlan({ ...plain, reasoningChoices: ['low', 'medium'] }), false);
  const renewed = await renewChatPlan(offering, { release: 'abcdef1', now: new Date('2026-10-06T09:00:00Z') });
  assert.deepEqual(renewed.reasoningChoices, ['low', 'medium']);
  assert.equal(approvedScope(renewed), approvedScope(offering));
  for (const reasoningChoices of [['low', 'high'], ['medium'], ['low', 'medium', 'medium']]) await assert.rejects(make({ reasoningChoices }), { code: 'invalid_reasoning_choices' });
  // A plan made to change a setting (the effort used unasked, 06.10.2026) is a new approved plan, but it keeps counting
  // against the ledger of the plan it replaces: the same cap, and the money already spent stays spent.
  assert.equal('budgetLedger' in offering, false);
  const lowered = await make({ reasoning: 'low', reasoningChoices: ['low', 'medium'], budgetLedger: budgetLedgerId(renewed), now: new Date('2026-10-06T10:00:00Z') });
  assert.deepEqual([lowered.reasoning, budgetLedgerId(lowered), budgetLedgerId(renewed)], ['low', offering.id, offering.id]);
  assert.notEqual(lowered.id, offering.id);
  assert(approvedChatPlan(lowered));
  assert.equal(budgetLedgerId(await renewChatPlan(lowered, { release: 'abcdef2', now: new Date('2026-10-06T11:00:00Z') })), offering.id);
  for (const budgetLedger of ['not a ledger', 'M4-UPPER', 7]) await assert.rejects(make({ budgetLedger }), { code: 'invalid_budget_ledger' });
});

test('a request may name only an effort the plan offers; a refusal comes before anything is stored or sent', async () => {
  // A store or an adapter that is touched fails the test: the refusal must come first.
  const untouched = new Proxy({}, { get: (_target, name) => { throw new Error(`touched ${String(name)}`); } });
  const service = config => new PilotService({ store: untouched, readConfig: async () => ({ configHash: 'c', mode: 'test', ...config }), adapters: untouched, call: untouched });
  const input = { convId: 'conversation-1', clientTurnKey: 'turn-key-0001', question: 'Küsimus', contextMode: 'new' };
  await assert.rejects(service({ reasoning: 'medium', reasoningChoices: ['low', 'medium'] }).run('user', { ...input, reasoning: 'high' }), { code: 'reasoning_not_offered' });
  await assert.rejects(service({ reasoning: 'medium' }).run('user', { ...input, reasoning: 'low' }), { code: 'reasoning_not_offered' });
  await assert.rejects(service({ reasoning: 'medium' }).run('user', { ...input, reasoning: 'medium' }), { code: 'reasoning_not_offered' }, 'no choice offered, none taken');
  for (const reasoning of ['', null, 1, ['low']]) {
    await assert.rejects(service({ reasoning: 'medium', reasoningChoices: ['low', 'medium'] }).run('user', { ...input, reasoning }), { code: 'reasoning_not_offered' }, JSON.stringify(reasoning));
  }
  // An offered effort passes this check and goes on to the store (which this stand-in refuses).
  await assert.rejects(service({ reasoning: 'medium', reasoningChoices: ['low', 'medium'] }).run('user', { ...input, reasoning: 'low' }), /touched purge/);
  await assert.rejects(service({ reasoning: 'medium', reasoningChoices: ['low', 'medium'] }).run('user', input), /touched purge/);
  // The answer request is written with the effort of the configuration it is given.
  const config = { model: 'gpt-6-luna', maxOutputTokens: 1000, reasoning: 'medium' };
  assert.equal(answerRequest(config, 'k', { evidence: [] }, 'et').reasoning.effort, 'medium');
  assert.equal(answerRequest({ ...config, reasoning: 'low' }, 'k', { evidence: [] }, 'et').reasoning.effort, 'low');
  // The choice is part of a turn's identity: the same key with another choice is another input.
  assert.notEqual(digest({ tenant: 't', userId: 'u', ...input }), digest({ tenant: 't', userId: 'u', ...input, reasoning: 'low' }));
});

test('the button\'s state: the plan\'s own effort until the user chooses, then the remembered choice while the plan offers it', () => {
  const offer = { quick: 'low', thorough: 'medium', fallback: 'medium' };
  assert.equal(reasoningChoiceAvailable(offer), true);
  for (const none of [null, undefined, {}, { quick: 'medium', thorough: 'medium', fallback: 'medium' }]) {
    assert.equal(reasoningChoiceAvailable(none), false);
    assert.equal(initialReasoning(none, 'low'), null); assert.equal(toggledReasoning(none, 'low'), null);
  }
  assert.equal(initialReasoning(offer), 'medium');
  assert.equal(initialReasoning(offer, 'low'), 'low');
  assert.equal(initialReasoning(offer, 'high'), 'medium', 'a remembered effort the plan no longer offers is not used');
  assert.equal(initialReasoning({ ...offer, fallback: 'low' }), 'low');
  assert.equal(toggledReasoning(offer, 'medium'), 'low'); assert.equal(toggledReasoning(offer, 'low'), 'medium');
  // Browser storage: the choice is kept under one key; blocked storage neither fails nor remembers.
  const kept = new Map(), storage = { getItem: key => kept.get(key) ?? null, setItem: (key, value) => kept.set(key, value) };
  assert.equal(readSavedReasoning(() => storage), null);
  saveReasoning(() => storage, 'low');
  assert.deepEqual([...kept], [[PILOT_REASONING_STORAGE_KEY, 'low']]);
  assert.equal(readSavedReasoning(() => storage), 'low');
  // The default changed from medium to low on 06.10.2026: a choice kept under the earlier key was made against the
  // other default and is not read, so every browser starts from the plan's effort again.
  assert.equal(PILOT_REASONING_STORAGE_KEY, 'sotsiaal.chat.reasoning.2');
  const earlier = { getItem: key => (key === 'sotsiaal.chat.reasoning' ? 'medium' : null) };
  assert.equal(initialReasoning({ ...offer, fallback: 'low' }, readSavedReasoning(() => earlier)), 'low');
  const blocked = () => { throw new Error('SecurityError'); };
  assert.equal(readSavedReasoning(blocked), null);
  assert.doesNotThrow(() => saveReasoning(blocked, 'low'));
});

test('the chat sends the choice with a pilot request, and the composer has the lightning button in three languages', async () => {
  const read = file => fs.readFile(file, 'utf8');
  const stream = await read('components/chat/hooks/useChatStream.js');
  assert.match(stream, /\.\.\.\(cfg\.pilotReasoning \? \{ reasoning: cfg\.pilotReasoning \} : \{\}\)/u);
  const body = await read('components/alalehed/ChatBody.jsx');
  assert.match(body, /usePilotReasoning\(pilotMode && !isRoomMode \? pilotReasoning : null\)/u);
  assert.match(body, /pilotReasoning: reasoningChoice\.effort,/u);
  assert.match(body, /quickAnswer=\{reasoningChoice\.available \? reasoningChoice\.quick : null\}/u);
  assert.match(await read('app/vestlus/page.js'), /pilotReasoning = reasoningOffer\(config\)/u);
  assert.match(await read('components/chat/hooks/usePilotReasoning.js'), /quick: available && effort === quick,/u);
  // One control for one setting: the button next to the microphone, pressed = the quick answer; no menu item beside it.
  const composer = await read('components/alalehed/chat/ChatComposer.jsx');
  assert.match(composer, /quickAnswer !== null && !isRoomMode \? <button type="button" className="conv-quick-answer" aria-label=\{t\("chat\.quick_answer\.button_aria"\)\} aria-pressed=\{quickAnswer \? "true" : "false"\} data-active=\{quickAnswer \? "true" : undefined\} data-tooltip=\{quickAnswer \? t\("chat\.quick_answer\.on"\) : t\("chat\.quick_answer\.off"\)\}[^>]* onClick=\{onToggleQuickAnswer\} \/>/u);
  assert.doesNotMatch(composer, /menuitemcheckbox|think_thoroughly/u);
  const labels = {};
  for (const locale of ['et', 'en', 'ru']) {
    const chat = JSON.parse(await read(`messages/${locale}.json`)).chat;
    assert.equal(chat.tools.think_thoroughly, undefined);
    labels[locale] = chat.quick_answer;
  }
  assert.deepEqual(labels, { et: { button_aria: 'Kiire vastus', on: 'Kiire vastus', off: 'Põhjalik vastus' },
    en: { button_aria: 'Quick answer', on: 'Quick answer', off: 'Thorough answer' },
    ru: { button_aria: 'Быстрый ответ', on: 'Быстрый ответ', off: 'Вдумчивый ответ' } });
  // The glyph is an outline in both states (owner 06.10.2026); the lit one has the text's tone and a firmer line. It
  // sits on the same button box as the microphone's.
  const css = await read('app/styles/chat.css');
  assert.match(css, /button\.conv-quick-answer\[data-active="true"\]::before \{\s*--glyph: url\("data:image\/svg\+xml,[^"]*fill='none' stroke='black' stroke-width='2\.1'/u);
  assert.match(css, /button\.conv-quick-answer\[data-active="true"\] \{\s*color: var\(--text-warm\);/u);
  assert.doesNotMatch(css.match(/button\.conv-quick-answer[^{]*\{[^}]*\}/gu).join('\n'), /fill='black'/u);
  assert.match(css, /button\.conv-quick-answer \{[^}]*min-inline-size: var\(--hit-target-min\);/u);
  assert.doesNotMatch(css, /menuitemcheckbox/u);
});
