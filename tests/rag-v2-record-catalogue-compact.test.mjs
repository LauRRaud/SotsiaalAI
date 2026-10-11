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
  // Non-record evidence keeps its title, pages and declared values (no provenance or review state).
  const article = { ...evidence[0], selection: { reason: 'ranked', ranks: {}, rrf_contributions: {}, rrf_score: 1 }, pdf_pages: [3] };
  const plain = modelProjection([article], { tenant: 't' }).context;
  assert.deepEqual(plain.evidence[0].pdf_pages, [3]);
  assert.equal(plain.sources.D1.title, 'Toetus a');
  assert.equal(plain.sources.D1.source_type, 'municipal_benefit');
});

test('ADR-086: records that declare the same values share one source card; a card with its own value stays apart', () => {
  const evidence = [compactEntry(entry('a', {})), compactEntry(entry('b', {})), compactEntry(entry('c', { source_type: 'municipal_contact' })), compactEntry(entry('d', { source_type: 'municipal_contact' })),
    compactEntry(entry('e', { historical: true, source_status: 'repealed' }))];
  const { context, references } = modelProjection(evidence, { tenant: 't', query_id: 'q', generation_id: 'g', ...records(evidence) });
  assert.deepEqual(context.evidence.map(item => item.source), ['D1', 'D1', 'D2', 'D2', 'D3']);
  // What every card shares is still stated once; each card keeps what is its own.
  assert.deepEqual(context.records.source_defaults, { source_checked_at: '2026-09-24' });
  assert.deepEqual(context.sources, { D1: { source_type: 'municipal_benefit' }, D2: { source_type: 'municipal_contact' }, D3: { source_type: 'municipal_benefit', historical: true, source_status: 'repealed' } });
  // Every reference still names its own document.
  assert.deepEqual(Object.values(references).map(reference => reference.document_id), ['a', 'b', 'c', 'd', 'e']);
  // A card states the day of the check: contacts checked at different moments of one day share a card, and the packet
  // keeps each exact time.
  const checked = [compactEntry(entry('m', { source_type: 'municipal_contact', source_checked_at: '2026-10-05T11:29:07.758Z' })),
    compactEntry(entry('n', { source_type: 'municipal_contact', source_checked_at: '2026-10-05T11:29:09.120Z' })), compactEntry(entry('o', { source_type: 'municipal_contact', source_checked_at: '2026-10-04T08:00:00.000Z' }))];
  const days = modelProjection(checked, { tenant: 't', query_id: 'q', generation_id: 'g', ...records(checked) }).context;
  assert.deepEqual([days.evidence.map(item => item.source), days.records.source_defaults, days.sources], [['D1', 'D1', 'D2'], { source_type: 'municipal_contact' },
    { D1: { source_checked_at: '2026-10-05' }, D2: { source_checked_at: '2026-10-04' } }]);
  assert.equal(checked[0].source_metadata.source_checked_at.value, '2026-10-05T11:29:07.758Z');
  // Evidence that is not a record keeps a card of its own, also when two documents declare the same values.
  const ranked = id => ({ ...compactEntry(entry(id, {})), selection: { reason: 'ranked', ranks: {}, rrf_contributions: {}, rrf_score: 1 } });
  assert.deepEqual(modelProjection([ranked('x'), ranked('y')], { tenant: 't' }).context.evidence.map(item => item.source), ['D1', 'D2']);
});

test('ADR-086: the entry of a contact names the person and the role, its text holds the channels; the links of one record are one relation', () => {
  const evidence = [compactEntry(entry('directory', {})), compactEntry(entry('one', { source_type: 'municipal_contact' })), compactEntry(entry('two', { source_type: 'municipal_contact' }))];
  const contact = (key, ref, name) => ({ key, record_id: 'record-' + key, kind: 'contact', region: 'r', fields: Object.fromEntries(Object.entries({ name, role: 'sotsiaaltöö spetsialist',
    department: 'Sotsiaalosakond', phone: '5550 0001', email: 'x@example.invalid' }).map(([field, value]) => [field, { value, refs: [ref] }])) });
  const scope = { tenant: 't', query_id: 'q', generation_id: 'g', record_context: { version: 'synthetic', region: 'r', entries: [
    { key: 'R1', record_id: 'record-directory', kind: 'resource', region: 'r', fields: { title: { value: 'Kontaktid', refs: ['S1'] } }, detail: 'relevant_detail' },
    contact('R2', 'S2', 'Mari Maasikas'), { ...contact('R3', 'S3', 'Jaan Tamm'), fields: { name: { value: 'Jaan Tamm', refs: ['S3'] }, phone: { value: '5550 0002', refs: ['S3'] } } }],
  relations: [{ from: 'R1', relation: 'contact', to: 'R2', state: 'source_declared', refs: ['S1'] }, { from: 'R1', relation: 'contact', to: 'R3', state: 'source_declared', refs: ['S1'] },
    { from: 'R1', relation: 'contact', to: null, state: 'unavailable', refs: [] }, { from: 'R1', relation: 'contact', to: null, state: 'unavailable', refs: [] },
    { from: 'R1', relation: 'form', to: 'R4', state: 'source_declared', refs: ['S1'] }, { from: 'R1', relation: 'service', to: null, state: 'unavailable', refs: [] }] } };
  const { context } = modelProjection(evidence, scope);
  assert.deepEqual(context.records.entries.slice(1), [
    { key: 'R2', kind: 'contact', fields: { name: { value: 'Mari Maasikas', refs: ['S2'] }, role: { value: 'sotsiaaltöö spetsialist', refs: ['S2'] } } },
    { key: 'R3', kind: 'contact', fields: { name: { value: 'Jaan Tamm', refs: ['S3'] } } }]);
  assert.deepEqual(context.records.relations, [
    { from: 'R1', relation: 'contact', to: ['R2', 'R3'], state: 'source_declared', refs: ['S1'] },
    { from: 'R1', relation: 'contact', to: null, state: 'unavailable', refs: [], count: 2 },
    { from: 'R1', relation: 'form', to: 'R4', state: 'source_declared', refs: ['S1'] },
    { from: 'R1', relation: 'service', to: null, state: 'unavailable', refs: [] }]);
  // The packet keeps every field and every link as the record lane read them.
  assert.equal(scope.record_context.entries[1].fields.phone.value, '5550 0001');
  assert.equal(scope.record_context.relations.length, 6);
});

// ADR-121 (09.10.2026): the contact directory's room comes from the summaries of the records closest to the question.
// For a Tallinn question that named no district the city's general directory left one summary where nine fit.
test('ADR-121: the contact directory is left out when it would leave less than a third of the summaries, and only where few are left', async () => {
  const { directoryCrowdsOut, DIRECTORY_CHECK_UNDER, DIRECTORY_MIN_SHARE, RECORD_RETRIEVAL_VERSION, READABLE_RECORD_RETRIEVAL_VERSIONS } = await import('../lib/rag-v2/search/structured-record-source.js');
  assert.deepEqual([DIRECTORY_CHECK_UNDER, DIRECTORY_MIN_SHARE, RECORD_RETRIEVAL_VERSION], [6, 3, 'rag-v2/record-catalogue-5']);
  assert.ok(READABLE_RECORD_RETRIEVAL_VERSIONS.includes('rag-v2/record-catalogue-4'));
  // The measured turns (summaries with the directory, without it): only the first loses the directory.
  for (const [left, without, out] of [[1, 9, true], [4, 11, false], [5, 14, false], [4, 9, false], [6, 13, false], [30, 42, false]]) assert.equal(directoryCrowdsOut(left, without), out, `${left} of ${without}`);
  // Exactly a third stays; one under it goes; nothing left goes whenever anything would fit; equal counts stay.
  assert.deepEqual([directoryCrowdsOut(3, 9), directoryCrowdsOut(2, 7), directoryCrowdsOut(0, 1), directoryCrowdsOut(0, 0), directoryCrowdsOut(2, 2)], [false, true, true, false, false]);
  // A view with six or more summaries is not looked at again, whatever would fit without the directory.
  assert.deepEqual([directoryCrowdsOut(5, 16), directoryCrowdsOut(6, 40)], [true, false]);
});
