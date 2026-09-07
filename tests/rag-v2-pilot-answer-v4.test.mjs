import test from 'node:test';
import assert from 'node:assert/strict';
import { ANSWER_VERSION, validateAnswer } from '../lib/rag-v2/pilot/contracts.js';
import { renderAnswer } from '../lib/rag-v2/pilot/presentation.js';

const answer = { kind: 'grounded', blocks: [{ text: 'Supported claim.', factual: true, refs: ['S1'] }], limitations: [], clarification: null };

test('v4 rejects bare or grouped references in all visible fields without rewriting the draft', () => {
  for (const text of ['Supported claim. S1', 'S1 ütleb, et see on soovitus.', 'S1 and S2 support this.', 'Allikas S99.', '[S1, S2]', 'Источник: S2.', 'S1/S2', '(S1)', '„S1“']) {
    for (const field of ['block', 'limitation', 'clarification']) {
      const draft = structuredClone(answer);
      if (field === 'block') draft.blocks[0].text = text;
      if (field === 'limitation') draft.limitations = [text];
      if (field === 'clarification') draft.clarification = text;
      const before = JSON.stringify(draft);
      assert.throws(() => validateAnswer(draft, ['S1', 'S2']), err => {
        assert.equal(err.code, 'inline_answer_reference');
        assert.equal(err.validation.received.text, text);
        assert.equal(err.validation.path, field === 'block' ? '$.blocks[0].text' : field === 'limitation' ? '$.limitations[0]' : '$.clarification');
        return true;
      });
      assert.equal(JSON.stringify(draft), before);
    }
  }
});

test('v4 keeps embedded source codes and renders refs once; ambiguous standalone codes fail without deletion', () => {
  const text = 'The source names AS1, S1A, S10a, ES12 and S1_2026.';
  const draft = { ...answer, blocks: [{ ...answer.blocks[0], text, refs: ['S1', 'S1'] }] };
  const valid = validateAnswer(draft, ['S1']);
  assert.equal(valid.blocks[0].text, text);
  assert.equal(renderAnswer(valid, ANSWER_VERSION), text + ' [S1]');
  // A shape check cannot decide whether standalone S1 denotes a model citation or
  // a real-world code. V4 conservatively rejects it, and retains the exact draft.
  const ambiguous = { ...answer, blocks: [{ ...answer.blocks[0], text: 'The device is called S1.' }] };
  assert.throws(() => validateAnswer(ambiguous, ['S1']), { code: 'inline_answer_reference' });
  assert.equal(ambiguous.blocks[0].text, 'The device is called S1.');
});

test('historical v3 bare references remain readable with its original source-claim constraints', () => {
  const historical = { ...answer, blocks: [{ ...answer.blocks[0], text: 'S1 supports this. S1' }] };
  const old = validateAnswer(historical, ['S1'], 'm4-text-refs-3');
  assert.equal(renderAnswer(old, 'm4-text-refs-3'), 'S1 supports this. S1 [S1]');
  assert.throws(() => validateAnswer(historical, ['S1']), { code: 'inline_answer_reference' });
  for (const version of ['m4-text-refs-3', ANSWER_VERSION]) {
    assert.throws(() => validateAnswer({ ...answer, blocks: [{ ...answer.blocks[0], factual: false }] }, ['S1'], version));
    assert.throws(() => validateAnswer({ ...answer, blocks: [] }, ['S1'], version));
    assert.throws(() => validateAnswer({ ...answer, limitations: [' '] }, ['S1'], version));
    const unsupported = { kind: 'unsupported', blocks: [], limitations: ['These excerpts do not establish a price.'], clarification: null };
    assert.deepEqual(validateAnswer(unsupported, [], version), unsupported);
  }
});
