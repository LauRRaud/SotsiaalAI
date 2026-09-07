import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import { hash } from '../lib/rag-v2/contracts.js';
import { answerRequest } from '../lib/rag-v2/pilot/contracts.js';
import { evidenceDraftEnabled, evidenceDraftRequest, projectEvidenceDraft, EVIDENCE_DRAFT_SCHEMA } from '../lib/rag-v2/pilot/evidence-draft.js';

const config = { tenant: 'tenant', documents: { doc: 'v1', second: 'v2' }, model: 'gpt-5.6-luna', maxOutputTokens: 2048, reasoning: 'low' };
function fixture() {
  const texts = ['The goal is to open a centre. Service is not guaranteed.', 'The centre opened on Monday.'];
  const packet = { tenant: 'tenant', query_id: 'query', generation_id: 'gen', reference_map: {}, evidence: [], model_context: { evidence: [] } };
  texts.forEach((text, i) => {
    const ref = `S${i + 1}`, evidence_id = `e${i}`;
    packet.reference_map[ref] = { tenant: 'tenant', query_id: 'query', generation_id: 'gen', document_id: i ? 'second' : 'doc', document_version_id: i ? 'v2' : 'v1', source_text_sha256: hash(text), evidence_id };
    packet.evidence.push({ evidence_id, source_text: text }); packet.model_context.evidence.push({ ref, text });
  });
  const value = { kind: 'grounded', blocks: [{ evidence: [{ ref: 'S1', quote: 'The goal is to open a centre.' }], text: 'Opening a centre is a goal.', factual: true, refs: ['S1'] }], limitations: [], clarification: null };
  return { packet, value };
}
const canonical = async (c, p, ref) => { assert.equal(c.documents[p.reference_map[ref].document_id], p.reference_map[ref].document_version_id); };

test('exact quote binds original text coordinates and keeps private evidence out of the visible projection', async () => {
  const { packet, value } = fixture();
  assert.equal(new Ajv().validate(EVIDENCE_DRAFT_SCHEMA, value), true);
  const result = await projectEvidenceDraft(value, packet, config, canonical);
  assert.deepEqual(result.answer.blocks, [{ text: 'Opening a centre is a goal.', factual: true, refs: ['S1'] }]);
  assert.equal(result.audit.bindings[0].quotes[0].start, 0);
  assert.equal(result.audit.bindings[0].quotes[0].end, 29);
  assert.equal(result.audit.semanticSupport, 'not_evaluated');
});
test('forged quote, text from the other source, changed negation and unmatched final references fail closed', async () => {
  for (const change of [
    b => { b.evidence[0].quote = 'The centre opened on Monday.'; },
    b => { b.evidence[0].quote = 'Service is guaranteed.'; },
    b => { b.evidence[0].ref = 'S99'; },
    b => { b.refs = ['S2']; },
    b => { b.evidence = []; },
    b => { b.factual = false; },
  ]) {
    const { packet, value } = fixture(); change(value.blocks[0]); const before = JSON.stringify(value);
    await assert.rejects(projectEvidenceDraft(value, packet, config, canonical));
    assert.equal(JSON.stringify(value), before);
  }
});
test('cross-turn, version, tenant, canonical and source-text mismatches reject even a genuine quote', async () => {
  for (const change of [p => { p.reference_map.S1.query_id = 'other'; }, p => { p.reference_map.S1.document_version_id = 'old'; },
    p => { p.reference_map.S1.tenant = 'foreign'; }, p => { p.model_context.evidence[0].text += ' forged'; }]) {
    const { packet, value } = fixture(); change(packet);
    await assert.rejects(projectEvidenceDraft(value, packet, config, canonical), { code: 'evidence_reference_scope_mismatch' });
  }
  const { packet, value } = fixture();
  await assert.rejects(projectEvidenceDraft(value, packet, config, async () => { throw Error('revoked'); }), /revoked/);
});
test('ambiguous exact occurrences and oversized output are rejected without invented offsets', async () => {
  const { packet, value } = fixture();
  packet.evidence[0].source_text = 'Repeated. Repeated.';
  packet.model_context.evidence[0].text = 'Repeated. Repeated.';
  packet.reference_map.S1.source_text_sha256 = hash('Repeated. Repeated.'); value.blocks[0].evidence[0].quote = 'Repeated.';
  await assert.rejects(projectEvidenceDraft(value, packet, config, canonical), { code: 'evidence_excerpt_ambiguous' });
  value.blocks[0].evidence[0].quote = 'x'.repeat(33000);
  await assert.rejects(projectEvidenceDraft(value, packet, config, canonical), { code: 'evidence_draft_too_large' });
});
test('multiple excerpts support a bounded synthesis; partial, clarification and unsupported retain v3 contracts', async () => {
  const { packet, value } = fixture();
  value.blocks[0].evidence.push({ ref: 'S2', quote: 'The centre opened on Monday.' }); value.blocks[0].refs.push('S2');
  assert.equal((await projectEvidenceDraft(value, packet, config, canonical)).audit.bindings[0].quotes.length, 2);
  for (const answer of [{ ...value, kind: 'partial', limitations: ['The excerpts do not establish capacity.'] },
    { kind: 'clarification', blocks: [], limitations: [], clarification: 'Which centre?' },
    { kind: 'unsupported', blocks: [], limitations: ['These excerpts do not establish a price.'], clarification: null }]) {
    const projected = await projectEvidenceDraft(answer, packet, config, canonical); assert.equal(projected.answer.kind, answer.kind);
  }
});
test('genuine goal quote or a contiguous quote omitting negation may bind while a manually assessed claim is false', async () => {
  const { packet, value } = fixture();
  value.blocks[0].text = 'The centre opened.';
  const wrongGoal = await projectEvidenceDraft(value, packet, config, canonical);
  assert.equal(wrongGoal.audit.sourceBinding, 'pass'); assert.equal(wrongGoal.audit.semanticSupport, 'not_evaluated');
  // Semantic fixture verdict: FAIL. The code deliberately does not claim entailment.
  value.blocks[0].evidence[0].quote = 'guaranteed.'; value.blocks[0].text = 'The service is guaranteed.';
  const missingNegation = await projectEvidenceDraft(value, packet, config, canonical);
  assert.equal(missingNegation.audit.sourceBinding, 'pass'); assert.equal(missingNegation.audit.semanticSupport, 'not_evaluated');
});
test('candidate is opt-in and keeps the baseline body, language, evidence and output budget intact', () => {
  assert.equal(evidenceDraftEnabled(config), false);
  assert.throws(() => evidenceDraftEnabled({ ...config, evidenceDraftVersion: 'unknown' }));
  const { packet } = fixture();
  for (const language of ['et', 'en', 'ru']) {
    const baseline = answerRequest(config, 'Question', packet.model_context, language);
    const body = evidenceDraftRequest(config, 'Question', packet.model_context, language);
    assert.equal(body.max_output_tokens, 2048); assert.deepEqual(body.input, baseline.input);
    assert.ok(body.instructions.startsWith(baseline.instructions));
    assert.equal(baseline.text.format.schema.properties.blocks.items.properties.evidence, undefined);
  }
});
