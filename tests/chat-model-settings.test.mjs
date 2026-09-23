import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveReasoningEffortForModel } from '../lib/chat/settings.js';

test('assistant defaults to Luna 6 medium while retaining explicit environment overrides', async t => {
  const keys = ['OPENAI_MODEL', 'OPENAI_REASONING_EFFORT'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  t.after(() => { for (const key of keys) {
    if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key];
  } });
  for (const value of [undefined, '', '  ']) {
    if (value === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = value;
    delete process.env.OPENAI_REASONING_EFFORT;
    const settings = await import(`../lib/chat/settings.js?default=${String(value)}`);
    assert.equal(settings.DEFAULT_MODEL, 'gpt-6-luna');
    assert.equal(settings.OPENAI_REASONING_EFFORT, 'medium');
  }
  process.env.OPENAI_MODEL = ' gpt-6-luna ';
  process.env.OPENAI_REASONING_EFFORT = ' high ';
  const configured = await import('../lib/chat/settings.js?configured');
  assert.equal(configured.DEFAULT_MODEL, 'gpt-6-luna');
  assert.equal(configured.OPENAI_REASONING_EFFORT, 'high');
  process.env.OPENAI_MODEL = 'gpt-5.6-luna';
  delete process.env.OPENAI_REASONING_EFFORT;
  const overridden = await import('../lib/chat/settings.js?legacy-override');
  assert.equal(overridden.DEFAULT_MODEL, 'gpt-5.6-luna');
  assert.equal(overridden.OPENAI_REASONING_EFFORT, 'low');
});

test('reasoning settings use model-supported values and normalize legacy minimal', () => {
  for (const effort of ['none', 'low', 'medium', 'high', 'xhigh', 'max']) {
    assert.equal(resolveReasoningEffortForModel('gpt-6-luna', effort), effort);
  }
  assert.equal(resolveReasoningEffortForModel(' GPT-6-LUNA ', ' MINIMAL '), 'low');
  assert.equal(resolveReasoningEffortForModel('gpt-6-luna', 'invalid'), 'medium');
  assert.equal(resolveReasoningEffortForModel('gpt-6-astra', 'none'), 'medium');
  assert.equal(resolveReasoningEffortForModel('gpt-5.6-luna', 'minimal'), 'low');
  assert.equal(resolveReasoningEffortForModel('gpt-5', 'minimal'), 'minimal');
});
