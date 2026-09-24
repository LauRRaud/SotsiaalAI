import test from 'node:test';
import assert from 'node:assert/strict';
import { compactEntry, shareLimitations } from '../lib/rag-v2/search/structured-record-source.js';
import { modelProjection } from '../lib/rag-v2/search/model-context.js';

const metadata = values => Object.fromEntries(Object.entries({ source_type: 'municipal_benefit', authority: 'Synthetic', language: 'et', historical: null,
  source_status: null, valid_from: null, valid_to: null, source_checked_at: '2026-09-24', ...values }).map(([key, value]) => [key, { value, provenance: [{ path: '/x' }], review_state: 'imported_not_verified' }]));
const entry = (id, values, limitations = []) => ({ document_id: id, document_version_id: id + '-v', evidence_id: 'e-' + id, unit_id: 'u-' + id, chunk_id: 'c-' + id, span_ids: [],
  pdf_pages: [], source_locations: [{ kind: 'json_pointer', path: '/items/0/title' }], bibliography: { title: 'Toetus ' + id },
  source_text: 'Toetus ' + id, source_metadata: metadata(values), limitations });

test('R2: compact catalogue keeps each source’s declared status and validity; provenance stays in the audit only', () => {
  const repealed = compactEntry(entry('old', { historical: true, source_status: 'repealed', valid_from: '2019-01-01', valid_to: '2020-12-31' }));
  const current = compactEntry(entry('new', { historical: false }));
  const { context } = modelProjection([repealed, current], {});
  const [oldSource, newSource] = Object.values(context.sources);
  assert.deepEqual(oldSource.historical, { value: true });
  assert.deepEqual(oldSource.source_status, { value: 'repealed' });
  assert.deepEqual([oldSource.valid_from, oldSource.valid_to], [{ value: '2019-01-01' }, { value: '2020-12-31' }]);
  assert.deepEqual(oldSource.source_checked_at, { value: '2026-09-24' });
  // Undeclared or false fields add nothing; provenance and authority are not model input.
  for (const key of ['historical', 'source_status', 'valid_from', 'valid_to', 'authority']) assert.equal(newSource[key], undefined, key);
  assert.ok(!JSON.stringify(context).includes('provenance'));
});

test('R2: a warning shared by every source is listed once; a source-specific warning stays with its source', () => {
  const shared = { code: 'collected_listing', detail: 'Kogutud valla lehelt' };
  const evidence = [
    compactEntry(entry('a', {}, [shared, { code: 'description_not_verified' }, { code: 'amount_changed', detail: '2024 määr' }])),
    compactEntry(entry('b', {}, [shared, { code: 'amount_changed', detail: '2025 määr' }])),
    compactEntry(entry('c', {}, [shared])),
  ];
  assert.deepEqual(shareLimitations(evidence), [shared]);
  assert.deepEqual(evidence.map(e => e.limitations), [[{ code: 'amount_changed', detail: '2024 määr' }], [{ code: 'amount_changed', detail: '2025 määr' }], []]);
  const { context } = modelProjection(evidence, {});
  assert.deepEqual(Object.values(context.sources).map(s => s.limitations.map(w => w.detail)), [['2024 määr'], ['2025 määr'], []]);
  assert.deepEqual(shareLimitations([]), []);
});
