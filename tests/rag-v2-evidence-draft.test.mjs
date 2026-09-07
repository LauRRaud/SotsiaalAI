import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import { hash } from '../lib/rag-v2/contracts.js';
import { answerRequest } from '../lib/rag-v2/pilot/contracts.js';
import { evidenceDraftEnabled, evidenceDraftRequest, projectEvidenceDraft, EVIDENCE_DRAFT_SCHEMA, EVIDENCE_DRAFT_V2_SCHEMA,
  EVIDENCE_DRAFT_VERSION, EVIDENCE_DRAFT_PROMPT, EVIDENCE_DRAFT_V2_VERSION } from '../lib/rag-v2/pilot/evidence-draft.js';
import { evidenceSegments } from '../lib/rag-v2/pilot/evidence-segments.js';
import { PilotService } from '../lib/rag-v2/pilot/service.js';
import { digest } from '../lib/rag-v2/pilot/contracts.js';

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
const v2Config = { ...config, evidenceDraftVersion: EVIDENCE_DRAFT_V2_VERSION };

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

test('segments preserve CRLF, Unicode UTF-16 coordinates and complete conditions at conservative line boundaries', () => {
  const text = 'Äigus jääb 🌍.\r\nJärgnev tingimus kehtib ainult siis, kui teenus ei ole tagatud.';
  const segments = evidenceSegments('S1', text);
  assert.equal(segments.length, 2);
  assert.equal(segments.map(segment => segment.text).join(''), text);
  assert.deepEqual([segments[0].start, segments[0].end, segments[1].start], [0, 16, 16]);
  assert.equal(text.slice(segments[1].start, segments[1].end), 'Järgnev tingimus kehtib ainult siis, kui teenus ei ole tagatud.');
  assert.match(segments[1].text, /ainult siis, kui teenus ei ole tagatud/);
  assert.equal(segments[0].sourceTextSha256, hash(text));
});

test('whole paragraphs without a safe boundary stay whole and repeated text gets distinct occurrence IDs', () => {
  const paragraph = 'Tingimus: teenust ei anta, kui kohalik hind ja tähtaeg pole kinnitatud.\nsee jätkub samas lauses';
  assert.equal(evidenceSegments('S1', paragraph).length, 1);
  const repeated = evidenceSegments('S1', 'Sama lause.\nSama lause.');
  assert.equal(repeated.length, 2);
  assert.notEqual(repeated[0].segmentId, repeated[1].segmentId);
  assert.equal(repeated[0].sourceTextSha256, repeated[1].sourceTextSha256);
});

test('v2 request replaces source text with server segments and v2 projection exposes only the visible answer', async () => {
  const { packet } = fixture();
  const body = evidenceDraftRequest(v2Config, 'Question', packet.model_context, 'et');
  const submitted = JSON.parse(body.input[0].content).evidence.evidence;
  assert.ok(submitted[0].segments.length);
  assert.equal(submitted[0].text, undefined);
  assert.equal(submitted[0].segments[0].text, packet.model_context.evidence[0].text);
  assert.equal(body.text.format.schema, EVIDENCE_DRAFT_V2_SCHEMA);
  const segment = evidenceSegments('S1', packet.model_context.evidence[0].text)[0];
  const value = { kind: 'grounded', blocks: [{ evidence: [{ ref: 'S1', segmentId: segment.segmentId }], text: 'Opening a centre is a goal.', factual: true, refs: ['S1'] }], limitations: [], clarification: null };
  assert.equal(new Ajv().validate(EVIDENCE_DRAFT_V2_SCHEMA, value), true);
  const result = await projectEvidenceDraft(value, packet, v2Config, canonical);
  assert.deepEqual(result.answer.blocks, [{ text: 'Opening a centre is a goal.', factual: true, refs: ['S1'] }]);
  assert.equal(result.audit.bindings[0].segments[0].quote, packet.model_context.evidence[0].text);
  assert.equal(result.audit.bindings[0].segments[0].start, 0);
  assert.equal(result.audit.bindings[0].segments[0].end, packet.model_context.evidence[0].text.length);
  assert.equal(result.audit.semanticSupport, 'not_evaluated');
});

test('v2 restore and recovery recheck the private projection audit without exposing segments', async () => {
  const { packet } = fixture();
  packet.evidence.forEach(item => { item.bibliography = { title: 'Synthetic source' }; });
  const segment = evidenceSegments('S1', packet.model_context.evidence[0].text)[0];
  const draft = { kind: 'grounded', blocks: [{ evidence: [{ ref: 'S1', segmentId: segment.segmentId }], text: 'Supported.', factual: true, refs: ['S1'] }], limitations: [], clarification: null };
  const projected = await projectEvidenceDraft(draft, packet, v2Config, canonical);
  const row = { id: 'v2-turn', configHash: 'v2-config', state: 'completed', payload: {
    question: 'Question', query: { language: 'en' }, answer: projected.answer, answerVersion: 'm4-text-refs-4', packet,
    requestAudit: { evidenceDraftVersion: EVIDENCE_DRAFT_V2_VERSION, evidenceDraftPromptVersion: 'm4-evidence-first-2' },
    responseAudit: { draft: { text: JSON.stringify(draft), truncated: false } }, evidenceDraftAudit: projected.audit, messageId: 'message', events: [],
  }, expiresAt: null };
  const service = new PilotService({ store: { mutate: async (_config, _row, fn) => fn() }, readConfig: async () => ({ ...v2Config, configHash: 'v2-config', mode: 'test' }),
    adapters: { canonical }, call: async () => { throw Error('unexpected model call'); } });
  const restored = await service.restore(row);
  assert.deepEqual(restored.answer, projected.answer);
  assert.equal(Object.hasOwn(restored, 'evidenceDraftAudit'), false);
  assert.equal(JSON.stringify(restored).includes('segmentId'), false);
  const tampered = structuredClone(row);
  tampered.payload.evidenceDraftAudit.bindings[0].segments[0].start += 1;
  await assert.rejects(service.restore(tampered), { code: 'evidence_projection_mismatch' });
  const recovery = structuredClone(tampered);
  recovery.state = 'needs_recovery';
  await assert.rejects(service.recover(recovery), { code: 'evidence_projection_mismatch' });
});

test('v2 rejects forged IDs, missing/extra evidence fields, duplicates and ref mismatches without mutation', async () => {
  for (const change of [({ value, other }) => { value.blocks[0].evidence[0].segmentId = other.segmentId; },
    ({ value, segment }) => { value.blocks[0].evidence[0].quote = segment.text; }, ({ value }) => { value.blocks[0].evidence[0].offset = 0; },
    ({ value }) => { delete value.blocks[0].evidence[0].segmentId; }, ({ value }) => { value.blocks[0].evidence = []; },
    ({ value, segment }) => { value.blocks[0].evidence.push({ ref: 'S1', segmentId: segment.segmentId }); },
    ({ value }) => { value.blocks[0].refs = ['S2']; }, ({ packet }) => { packet.reference_map.S1.generation_id = 'foreign'; }]) {
    const { packet } = fixture();
    const segment = evidenceSegments('S1', packet.model_context.evidence[0].text)[0];
    const other = evidenceSegments('S2', packet.model_context.evidence[1].text)[0];
    const base = { kind: 'grounded', blocks: [{ evidence: [{ ref: 'S1', segmentId: segment.segmentId }], text: 'Supported.', factual: true, refs: ['S1'] }], limitations: [], clarification: null };
    const value = structuredClone(base);
    change({ value, packet, segment, other });
    const packetBefore = JSON.stringify(packet), valueBefore = JSON.stringify(value);
    await assert.rejects(projectEvidenceDraft(value, packet, v2Config, canonical), error => ['evidence_segment_id_mismatch', 'invalid_evidence_segment', 'evidence_reference_scope_mismatch', 'invalid_evidence_draft', 'duplicate_evidence_segment', 'evidence_reference_set_mismatch'].includes(error.code));
    assert.equal(JSON.stringify(value), valueBefore);
    assert.equal(JSON.stringify(packet), packetBefore);
  }
});

test('historical v1 candidate audit restores with its persisted v3 answer version', async () => {
  const { packet } = fixture();
  packet.evidence.forEach(item => { item.bibliography = { title: 'Synthetic source' }; });
  const oldConfig = { ...config, evidenceDraftVersion: EVIDENCE_DRAFT_VERSION, documents: { doc: 'v1', second: 'v2' }, configHash: 'old-config' };
  const draft = { kind: 'grounded', blocks: [{ evidence: [{ ref: 'S1', quote: 'The goal is to open a centre.' }], text: 'S1 supports this. S1', factual: true, refs: ['S1'] }], limitations: [], clarification: null };
  const projected = await projectEvidenceDraft(draft, packet, oldConfig, canonical, 'm4-text-refs-3');
  const row = { id: 'historical-turn', configHash: oldConfig.configHash, state: 'completed', payload: {
    question: 'Question', query: { language: 'en' }, answer: projected.answer, answerVersion: 'm4-text-refs-3', packet,
    requestAudit: { evidenceDraftVersion: EVIDENCE_DRAFT_VERSION, evidenceDraftPromptVersion: EVIDENCE_DRAFT_PROMPT },
    responseAudit: { draft: { text: JSON.stringify(draft), truncated: false } }, evidenceDraftAudit: projected.audit, messageId: 'message', events: [],
  }, expiresAt: null };
  const service = new PilotService({ store: { mutate: async (_config, _row, fn) => fn() }, readConfig: async () => oldConfig,
    adapters: { canonical }, call: async () => { throw Error('unexpected model call'); } });
  const restored = await service.restore(row);
  assert.equal(restored.answerVersion, 'm4-text-refs-3');
  assert.equal(restored.answer.blocks[0].text, 'S1 supports this. S1');
  assert.equal(restored.answerVersion, projected.audit.answerVersion);
  assert.equal(digest(projected.audit), digest(row.payload.evidenceDraftAudit));
});
