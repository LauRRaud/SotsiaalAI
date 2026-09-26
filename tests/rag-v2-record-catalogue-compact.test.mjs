import test from 'node:test';
import assert from 'node:assert/strict';
import { compactEntry, shareLimitations } from '../lib/rag-v2/search/structured-record-source.js';
import { modelProjection } from '../lib/rag-v2/search/model-context.js';

const metadata = values => Object.fromEntries(Object.entries({ source_type: 'municipal_benefit', authority: 'Synthetic', language: 'et', historical: null,
  source_status: null, valid_from: null, valid_to: null, source_checked_at: '2026-09-24', ...values }).map(([key, value]) => [key, { value, provenance: [{ path: '/x' }], review_state: 'imported_not_verified' }]));
const entry = (id, values, limitations = []) => ({ document_id: id, document_version_id: id + '-v', evidence_id: 'e-' + id, unit_id: 'u-' + id, chunk_id: 'c-' + id, span_ids: [],
  pdf_pages: [], source_locations: [{ kind: 'json', path: '/items/0/title', record_id: 'record-' + id }], bibliography: { title: 'Toetus ' + id, authors: null, publication_date: null },
  source_text: 'Toetus ' + id, source_metadata: metadata(values), limitations, selection: { reason: 'structured_record', ranks: {}, rrf_contributions: {}, rrf_score: null } });
const records = entries => ({ record_context: { version: 'synthetic', region: 'r', entries: entries.map((e, i) => ({ key: 'R' + (i + 1), record_id: 'record-' + e.document_id,
  kind: 'benefit', region: 'r', fields: { title: { value: e.source_text, refs: ['S' + (i + 1)] } }, detail: 'catalogue' })), relations: [] } });

test('R2: compact catalogue keeps each source’s declared status and validity; provenance stays in the audit only', () => {
  const repealed = compactEntry(entry('old', { historical: true, source_status: 'repealed', valid_from: '2019-01-01', valid_to: '2020-12-31' }));
  const current = compactEntry(entry('new', { historical: false }));
  const { context } = modelProjection([repealed, current], records([repealed, current]));
  const [oldSource, newSource] = Object.values(context.sources);
  assert.equal(oldSource.historical, true);
  assert.equal(oldSource.source_status, 'repealed');
  assert.deepEqual([oldSource.valid_from, oldSource.valid_to], ['2019-01-01', '2020-12-31']);
  // Values shared by every card are stated once; a differing card keeps its own.
  assert.deepEqual(context.records.source_defaults, { source_type: 'municipal_benefit', source_checked_at: '2026-09-24' });
  // Undeclared or false fields add nothing; provenance and authority are not model input.
  for (const key of ['historical', 'source_status', 'valid_from', 'valid_to', 'authority']) assert.equal(newSource[key], undefined, key);
  assert.ok(!JSON.stringify(context).includes('provenance'));
});

test('R2: a warning shared by every source is listed once; a source-specific warning stays with its source', () => {
  const shared = { code: 'collected_package_text', detail: 'Kogutud valla lehelt' };
  // Processing notes (description_not_verified, layout_coverage_limit) never reach the model.
  const evidence = [
    compactEntry(entry('a', {}, [shared, { code: 'description_not_verified' }, { code: 'metadata_candidate_conflict', detail: '2024 määr' }])),
    compactEntry(entry('b', {}, [shared, { code: 'layout_coverage_limit', detail: 'Processing note' }, { code: 'metadata_candidate_conflict', detail: '2025 määr' }])),
    compactEntry(entry('c', {}, [shared])),
  ];
  assert.deepEqual(shareLimitations(evidence), [shared]);
  assert.deepEqual(evidence.map(e => e.limitations), [[{ code: 'metadata_candidate_conflict', detail: '2024 määr' }], [{ code: 'metadata_candidate_conflict', detail: '2025 määr' }], []]);
  const { context } = modelProjection(evidence, records(evidence));
  assert.deepEqual(Object.values(context.sources).map(s => (s.limitations || []).map(w => w.detail)), [['2024 määr'], ['2025 määr'], []]);
  assert.deepEqual(shareLimitations([]), []);
});

test('ADR-025: record evidence reaches the model as ref, source and text only; the audit keeps paths and IDs', () => {
  const evidence = [compactEntry(entry('a', {})), compactEntry(entry('b', {}))];
  const scope = { tenant: 't', query_id: 'q', generation_id: 'g', ...records(evidence) };
  const { context, references } = modelProjection(evidence, scope);
  assert.deepEqual(context.evidence[0], { ref: 'S1', source: 'D1', text: 'Toetus a' });
  assert.deepEqual(context.records.entries[0], { key: 'R1', kind: 'benefit', fields: { title: { value: 'Toetus a', refs: ['S1'] } } });
  assert.equal(context.sources.D1.title, undefined, 'the record title is not repeated on its source card');
  assert.deepEqual(references.S1.source_locations, [{ kind: 'json', path: '/items/0/title', record_id: 'record-a' }]);
  assert.equal(scope.record_context.entries[0].record_id, 'record-a', 'the packet keeps the full record context');
  // Non-record evidence keeps its full projection.
  const article = { ...evidence[0], selection: { reason: 'ranked', ranks: {}, rrf_contributions: {}, rrf_score: 1 }, pdf_pages: [3] };
  const plain = modelProjection([article], { tenant: 't' }).context;
  assert.deepEqual(plain.evidence[0].pdf_pages, [3]);
  assert.equal(plain.sources.D1.title, 'Toetus a');
  assert.deepEqual(plain.sources.D1.source_type, { value: 'municipal_benefit' });
});
