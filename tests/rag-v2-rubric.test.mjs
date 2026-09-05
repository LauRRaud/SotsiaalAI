import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { prepareRubric, verifyRubric, hasAtom, digest, canonicalContext, contextId,
  makeReviewPacket, regrade, verifyInputs } from '../lib/rag-v2/evaluation/rubric-v2.js';
import { tokenCount } from '../lib/rag-v2/search/embedding.js';

let calls = 0;
const savedFetch = globalThis.fetch, savedConnect = net.Socket.prototype.connect;
before(() => { globalThis.fetch = () => { calls++; throw Error('network'); }; net.Socket.prototype.connect = () => { calls++; throw Error('network'); }; });
after(() => { globalThis.fetch = savedFetch; net.Socket.prototype.connect = savedConnect; assert.equal(calls, 0); });
const atom = start => ({ source: 'a', page: 1, start });
const full = (id, ...all) => ({ id, support: 'full', rationale: 'Synthetic source statement, not a real human judgment.', all });
const partial = (id, ...all) => ({ ...full(id, ...all), support: 'partial' });
const stamp = decision => Object.assign(decision, { state: 'approved', reviewed_by: { role: 'human_reviewer', name: 'SYNTHETIC TEST ONLY' },
  reviewed_at: '2026-09-05T12:00:00Z', reason: 'Synthetic evaluation contract', basis: 'Synthetic test receipt; no real review asserted.' });

function fixture({ missing = false } = {}) {
  const texts = ['A subject', 'B action', 'C condition', 'D alternate', 'E part'];
  const spans = texts.map((text, i) => ({ id: `s${i}`, source_text: text, pdf_page: 1, start: i * 20, end: i * 20 + text.length }));
  const fields = { title: { value: 'Synthetic source', provenance: [] }, authors: { value: ['Author'], provenance: [{ kind: 'synthetic' }] }, publication_date: { value: null } };
  const b = { document: { id: 'doc', fields }, version: { id: 'v', pdf_hash: 'a'.repeat(64) }, spans,
    chunks: spans.map((s, i) => ({ id: `c${i}`, source_text: s.source_text, span_ids: [s.id], pdf_pages: [1] })) };
  const snapshot = { tenant: 'synthetic', source_generation: 'source-g', snapshot_hash: 'snapshot-h', documents: { doc: { version_id: 'v' } }, bundles: [b] };
  const bindings = { source_payload_sha256: 'payload', questions_sha256: 'questions', corpus_snapshot_sha256: snapshot.snapshot_hash };
  const spec = { schema_version: 'rag-v2/semantic-rubric-proposal-2', version: 'test', proposed_by: { name: 'Synthetic assistant', role: 'assistant' }, sources: { a: 'a'.repeat(64) }, families: { f: {
    scope: 'synthetic', requirements: [
      { id: 'a', meaning: 'A subject or alternative', scope: 'source a', mandatory: true, evidence_sets: [full('first', atom('A subject')), full('alternative', atom('D alternate')), partial('part', atom('E part'))] },
      { id: 'b', meaning: 'B AND C together', scope: 'source a', mandatory: true, evidence_sets: [full('together', atom('B action'), atom('C condition'))] },
      ...(missing ? [{ id: 'missing', meaning: 'Measured outcomes', scope: 'actual evidence', mandatory: true, evidence_sets: [] }] : []),
    ] } } };
  const rubric = prepareRubric(spec, snapshot, bindings);
  const entries = b.chunks.map(c => ({ document_id: 'doc', document_version_id: 'v', chunk_id: c.id, source_text: c.source_text,
    span_ids: c.span_ids, pdf_pages: c.pdf_pages, bibliography: { title: fields.title.value, authors: fields.authors.value, publication_date: null }, source_metadata: {}, limitations: [] }));
  const questions = { cases: [{ id: 'q', family: 'f', language: 'en', query: 'Synthetic question' }] };
  const rows = selected => ['lexical', 'vector', 'hybrid', 'hybrid_structure'].map(method => ({ question_id: 'q', family: 'f', language: 'en', method,
    all_required_in_final_context: true, observed_support: 'full', outcome: 'support_found',
    packet: { evidence: selected, model_context: null }, measurements: { model_context_tokens: 0 } }));
  return { snapshot, rubric, entries, questions, rows };
}
function run(f, selected, approve = true, change) {
  const results = { rows: f.rows(selected) }, { decisions } = makeReviewPacket(results, f.questions, f.snapshot, f.rubric);
  if (approve) for (const d of Object.values(decisions.decisions)) {
    if (d.type === 'corpus') continue;
    stamp(d);
    if (d.type === 'context') { d.exhaustive = true; d.contradiction = 'none'; d.no_other_support_for = f.rubric.families.f.requirements.map(r => r.id); }
  }
  if (change) change(decisions);
  return { results, decisions, graded: regrade(results, f.questions, f.snapshot, f.rubric, decisions) };
}

test('rubric: an alternative covers only its requirement; AND constituents cannot become OR', () => {
  const f = fixture();
  const alt = run(f, [f.entries[3], f.entries[1]]).graded.rows[0].v2;
  assert.equal(alt.requirements[0].status, 'full'); assert.equal(alt.requirements[1].status, 'absent'); assert.equal(alt.status, 'partial');
  assert.equal(run(f, [f.entries[3], f.entries[1], f.entries[2]]).graded.rows[0].v2.status, 'full');
});
test('rubric: wrong source, page, span or altered text never matches a supporting atom', () => {
  const f = fixture(), a = f.rubric.families.f.requirements[0].evidence_sets[0].all[0];
  assert.equal(hasAtom([f.entries[0]], a), true);
  for (const changes of [{ document_id: 'wrong' }, { document_version_id: 'wrong' }, { pdf_pages: [2] }, { span_ids: [] }, { source_text: 'same topic without statement' }]) {
    assert.equal(hasAtom([{ ...f.entries[0], ...changes }], a), false);
  }
});
test('rubric: partial, absent and unresolved review are different; absent needs an exhaustive receipt', () => {
  const f = fixture();
  assert.equal(run(f, [f.entries[4]]).graded.rows[0].v2.status, 'partial');
  assert.equal(run(f, []).graded.rows[0].v2.status, 'absent');
  assert.equal(run(f, [], false).graded.rows[0].v2.status, 'needs_review');
  assert.equal(run(f, [f.entries[0], f.entries[1], f.entries[2]], false).graded.rows[0].v2.status, 'needs_review');
  const pending = run(f, [f.entries[4]], true, d => { Object.values(d.decisions).find(x => x.type === 'context').no_other_support_for = []; });
  assert.equal(pending.graded.rows[0].v2.status, 'needs_review');
});
test('rubric: finding every corpus-available subanswer does not answer a missing mandatory outcome', () => {
  const f = fixture({ missing: true }), { graded } = run(f, [f.entries[0], f.entries[1], f.entries[2]]);
  assert.equal(graded.rows[0].v2.status, 'partial');
  assert.equal(graded.rows[0].difference, 'v1_coverage_not_whole_question');
  assert.equal(graded.rows[0].v2.requirements.find(r => r.id === 'missing').status, 'absent');
});
test('rubric: method names and retrieval order cannot change the same semantic context judgment', () => {
  const f = fixture(), { graded, results } = run(f, [f.entries[0], f.entries[1], f.entries[2]]);
  assert.equal(new Set(graded.rows.map(r => digest(r.v2))).size, 1);
  assert.equal(new Set(graded.rows.map(r => r.review_context_id)).size, 1);
  assert.deepEqual(graded.rows.map(r => r.v1), results.rows);
  const a = canonicalContext(f.entries, f.snapshot), b = canonicalContext([...f.entries].reverse(), f.snapshot);
  assert.equal(contextId('f', a), contextId('f', b));
  const packet = makeReviewPacket(results, f.questions, f.snapshot, f.rubric).packet;
  assert.ok(!JSON.stringify(packet).includes('hybrid')); assert.ok(!JSON.stringify(packet).includes('ranked_seed'));
});
test('rubric: assistant proposals cannot be promoted to human approval; changed content invalidates receipts', () => {
  const f = fixture();
  assert.throws(() => run(f, [], true, d => { d.decisions['definition:f'].reviewed_by.role = 'assistant'; }), /invalid_human_review_receipt/);
  assert.throws(() => run(f, [], true, d => { d.decisions['definition:f'].content_sha256 = 'changed'; }), /review_content_mismatch/);
  assert.throws(() => run(f, [], true, d => { d.bindings.rubric_sha256 = 'changed'; }), /review_binding_mismatch/);
});
test('rubric: an explicitly reviewed contradiction remains visible and excludes final full', () => {
  const f = fixture();
  const { graded } = run(f, [f.entries[0], f.entries[1], f.entries[2]], true, d => { Object.values(d.decisions).find(x => x.type === 'context').contradiction = 'present'; });
  assert.equal(graded.rows[0].v2.contradiction, 'present'); assert.equal(graded.rows[0].v2.status, 'needs_review');
});
test('rubric: altered source atom, v1 payload and context cannot pass identity validation', () => {
  const f = fixture(); verifyRubric(f.rubric, f.snapshot, f.rubric.bindings);
  const changed = structuredClone(f.rubric); changed.families.f.requirements[0].evidence_sets[0].all[0].spans[0].id = 'foreign';
  assert.throws(() => verifyRubric(changed, f.snapshot, f.rubric.bindings), /rubric_span_mismatch/);
  const groups = {}, rows = f.rows([f.entries[0]]);
  for (const r of rows) {
    const context = { sources: { D1: r.packet.evidence[0].bibliography }, evidence: [{ source: 'D1', text: f.entries[0].source_text, pdf_pages: [1] }] };
    Object.assign(r.packet, { tenant: f.snapshot.tenant, state: 'ok', generation_id: 'g', corpus: { documents: f.snapshot.documents }, model_context: context });
    r.measurements.model_context_tokens = tokenCount(JSON.stringify(context));
  }
  const payload = { rows, questions_sha256: digest(f.questions), anchor_groups_sha256: digest(groups) };
  const results = { ...payload, provenance: { result_payload_sha256: digest(payload), corpus: { tenant: f.snapshot.tenant,
    source_generation_id: f.snapshot.source_generation, snapshot_sha256: f.snapshot.snapshot_hash, document_count: 1, search_generation_id: 'g' } } };
  verifyInputs(results, f.questions, f.snapshot, groups);
  results.rows[0].packet.evidence[0].source_text = 'forged';
  assert.throws(() => verifyInputs(results, f.questions, f.snapshot, groups), /v1_payload_mismatch/);
});
test('rubric: offline CLI covers all 84 saved rows, keeps v1 bytes and rejects overwriting output', async () => {
  const cwd = fileURLToPath(new URL('../', import.meta.url)), base = path.join(cwd, 'tmp/rag-v2-m2-3');
  await fs.mkdir(base, { recursive: true });
  const testDir = await fs.mkdtemp(path.join(base, 'test-'));
  const exec = promisify(execFile), out = path.join(testDir, 'result');
  try {
    const run = await exec(process.execPath, ['scripts/rag-v2-regrade.mjs', '--output', out], { cwd, windowsHide: true });
    const receipt = JSON.parse(run.stdout); assert.equal(receipt.network_attempts, 0); assert.equal(receipt.retrieval_calls, 0);
    assert.equal(receipt.source_files_unchanged, true); assert.equal(receipt.summary.rows, 84); assert.equal(receipt.summary.needs_review, 84);
    assert.equal(receipt.summary.quality_percentage, null);
    const output = JSON.parse(await fs.readFile(path.join(out, 'regrade-results.json'), 'utf8'));
    const original = JSON.parse(await fs.readFile(path.join(cwd, 'tmp/rag-v2-multi-source/server-real-9526a805-1/multi-source-v1-results.json'), 'utf8'));
    assert.deepEqual(output.rows.map(r => r.v1), original.rows);
    for (const row of output.rows) assert.equal(row.preserved_tokens, row.v1.measurements.model_context_tokens);
    const repeatedOut = path.join(testDir, 'with-decisions');
    await exec(process.execPath, ['scripts/rag-v2-regrade.mjs', '--output', repeatedOut,
      '--rubric', path.join(out, 'rubric-v2.json'), '--decisions', path.join(out, 'review-decisions.json')], { cwd, windowsHide: true });
    const repeated = JSON.parse(await fs.readFile(path.join(repeatedOut, 'regrade-results.json'), 'utf8'));
    assert.deepEqual(repeated, output);
    await assert.rejects(exec(process.execPath, ['scripts/rag-v2-regrade.mjs', '--output', out], { cwd, windowsHide: true }), error => error.stderr.includes('EEXIST'));
  } finally {
    assert.ok(path.resolve(testDir).startsWith(path.resolve(base) + path.sep));
    await fs.rm(testDir, { recursive: true, force: true });
  }
});
