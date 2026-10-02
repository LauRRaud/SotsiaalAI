import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptDialogue, buildDialogueQuery, dialogueInput, dialogueRequest, DIALOGUE_VERSION, DIALOGUE_LIMITS } from '../lib/rag-v2/pilot/dialogue.js';

const config = { configHash: 'config', embedding: { model: 'test' }, model: 'test', maxOutputTokens: 1000, reasoning: 'low' };
function accepted(language) {
  let head = null;
  const rows = [];
  const next = (question, mode = 'same', extra = {}) => {
    const id = `turn-${String(rows.length + 1).padStart(8, '0')}`;
    const result = acceptDialogue(config, { question, contextMode: mode, language, ...extra }, rows, head, id);
    const row = { id, state: 'stopped', payload: { question, contextMode: mode, context: result.context } };
    rows.push(row); head = { configHash: config.configHash, turnId: id, revision: result.context.revision };
    return result;
  };
  return { rows, next };
}

test('dialogue contract: ET/EN/RU preserve four user turns and correction provenance, then isolate new topic/person', () => {
  for (const [language, messages] of Object.entries({ et: ['Olen 67 ja elan Harkus.', 'Milline abi?', 'Parandus: elan Tartus.', 'Aga hind?'],
    en: ['I am 67 and live in Harku.', 'Which support?', 'Correction: I live in Tartu.', 'What about the price?'],
    ru: ['Мне 67, я живу в Харку.', 'Какая помощь?', 'Поправка: я живу в Тарту.', 'А цена?'] })) {
    const f = accepted(language);
    const first = f.next(messages[0], 'new'); f.next(messages[1]);
    const correction = f.next(messages[2], 'correction'), fourth = f.next(messages[3]);
    assert.equal(fourth.userTurns.length, 4);
    assert.equal(fourth.userTurns[0].text, messages[0]);
    assert.equal(fourth.userTurns[2].correctionOf, f.rows[1].id);
    assert.equal(fourth.context.correctionRevision, 1);
    assert.equal(fourth.context.scopeId, correction.context.scopeId);
    const query = buildDialogueQuery(fourth, config);
    assert.equal(query.text, messages.join('\n\n'));
    assert.doesNotMatch(query.text, /USER MESSAGE|USER CORRECTION|Active topic and person/);
    assert.deepEqual(query.strictFilters, {}); // No stale location becomes a hard filter.
    const topic = f.next('Different topic', 'new');
    assert.equal(topic.userTurns.length, 1); assert.equal(topic.context.personId, first.context.personId);
    const person = f.next('Different person', 'new_person');
    assert.equal(person.userTurns.length, 1); assert.notEqual(person.context.personId, first.context.personId);
    const returned = f.next('Return explicitly', 'same', { contextTurnId: f.rows[0].id });
    assert.equal(returned.context.personId, first.context.personId);
    assert.equal(returned.context.correctionRevision, 1);
    assert.equal(returned.userTurns[2].text, messages[2]);
    assert.ok(!returned.userTurns.some(x => x.text === 'Different person'));
  }
});

test('dialogue contract: a full topic goes on in a new topic of the same person without clipping; expired head never falls back to an older scope', () => {
  const f = accepted('et');
  const first = f.next('Turn 0', 'new');
  for (let i = 1; i < DIALOGUE_LIMITS.scopeTurns; i++) f.next('Turn ' + i);
  // The chat has no topic choice (02.10.2026): the next message of a full topic starts a new one for the same person,
  // with nothing of the full one, and says which topic was full.
  const ninth = f.next('One too many');
  assert.deepEqual([ninth.context.mode, ninth.userTurns.map(turn => turn.text), ninth.context.personId, ninth.selection.previousScopeFull],
    ['new', ['One too many'], first.context.personId, first.context.scopeId]);
  assert.notEqual(ninth.context.scopeId, first.context.scopeId);
  assert.equal(f.rows.length, DIALOGUE_LIMITS.scopeTurns + 1);
  assert.equal(f.next('Tenth').context.scopeId, ninth.context.scopeId);
  // An explicit choice of the full topic is still refused: it would have to clip it.
  assert.throws(() => f.next('Back to the full one', 'same', { contextTurnId: f.rows[0].id }), { code: 'context_window_full' });
  const head = { configHash: config.configHash, turnId: 'missing-turn', revision: 50 };
  assert.throws(() => acceptDialogue(config, { question: 'Continue', contextMode: 'same' }, f.rows, head, 'new-turn'), { code: 'context_unavailable' });
  assert.throws(() => acceptDialogue(config, { question: 'Continue', contextMode: 'same', contextTurnId: 'foreign-turn' }, f.rows, head, 'new-turn'), { code: 'context_reference_unavailable' });
  const full = { context: f.rows[0].payload.context, userTurns: [{ text: 'a '.repeat(4600), mode: 'new' }], selection: {} };
  assert.throws(() => buildDialogueQuery(full, config), { code: 'context_search_budget_exceeded' });
  assert.throws(() => dialogueInput({ ...full, userTurns: [{ text: 'a '.repeat(9100) }], selection: {} }), { code: 'context_dialogue_budget_exceeded' });
});

test('dialogue contract: after a chat plan rebuild "same" starts a new topic, while an expired head of this plan still fails', () => {
  // The conversation's head names a turn of the earlier plan; this plan has no turn in the conversation yet.
  const earlier = { configHash: 'earlier-plan', turnId: 'turn-old-0001', revision: 7 };
  const same = acceptDialogue(config, { question: 'Aga hind?', contextMode: 'same' }, [], earlier, 'new-turn-1');
  assert.equal(same.context.scopeId, 'new-turn-1'); assert.equal(same.context.personId, 'new-turn-1');
  assert.equal(same.context.selection, 'new_scope'); assert.equal(same.context.revision, 1);
  assert.equal(same.selection.headFromEarlierPlan, true); assert.deepEqual(same.sourceTurnIds, []);
  assert.equal(acceptDialogue(config, { question: 'Uus', contextMode: 'new' }, [], earlier, 'new-turn-2').selection.headFromEarlierPlan, undefined);
  // Nothing to correct and no earlier topic to name under this plan.
  assert.throws(() => acceptDialogue(config, { question: 'Parandus', contextMode: 'correction' }, [], earlier, 'new-turn-3'), { code: 'context_required' });
  assert.throws(() => acceptDialogue(config, { question: 'Jätk', contextMode: 'same', contextTurnId: 'turn-old-0001' }, [], earlier, 'new-turn-4'), { code: 'context_reference_unavailable' });
  // This plan already has turns here: a head of another plan is ambiguous and still fails.
  const f = accepted('et'); f.next('Esimene', 'new');
  assert.throws(() => acceptDialogue(config, { question: 'Jätk', contextMode: 'same' }, f.rows, earlier, 'new-turn-5'), { code: 'context_unavailable' });
});

test('synthetic guarantee: old assistant is explicitly unverified dialogue, its references cannot become current evidence', () => {
  const f = accepted('en'); f.next('What help is available?', 'new');
  const current = f.next('Explain the second point.');
  const assistant = { role: 'published_assistant_dialogue', turnId: 'old-turn', evidenceStatus: 'NOT_A_FACT_SOURCE',
    blocks: [{ point: 1, text: 'Intro', historicalReferences: ['old-turn/S1'] }, { point: 2, text: 'SYNTHETIC UNSUPPORTED GUARANTEE: You will receive free home support within 24 hours.', historicalReferences: ['old-turn/S1'] }], limitations: [], clarification: null };
  const dialogue = dialogueInput(current, assistant);
  const evidence = { evidence: [{ ref: 'S1', text: 'The excerpt offers no guarantee.' }] };
  const body = dialogueRequest(config, 'Explain the second point.', evidence, 'en', dialogue.value);
  const data = JSON.parse(body.input[0].content);
  assert.equal(data.dialogue.publishedAssistant.blocks[1].historicalReferences[0], 'old-turn/S1');
  assert.deepEqual(data.evidence, evidence);
  assert.match(body.instructions, /Do not reaffirm an unsupported guarantee/);
  assert.match(body.instructions, /same-named references in the new evidence packet/);
  assert.doesNotMatch(buildDialogueQuery(current, config, assistant).text, /GUARANTEE/);
  const explicit = { ...current, selection: { ...current.selection, replyToBlock: 2 } };
  assert(buildDialogueQuery(explicit, config, assistant).text.endsWith(assistant.blocks[1].text));
  assert.doesNotMatch(buildDialogueQuery(explicit, config, assistant).text, /User-selected prior answer point/);
  assert.equal(data.dialogue.publishedAssistant.evidenceStatus, 'NOT_A_FACT_SOURCE');
  assert.equal(data.dialogue.version, DIALOGUE_VERSION);
  // This is a prompt/input contract assertion, NOT a Luna semantic-quality assertion.
});
