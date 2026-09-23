import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { hash, configuration, validateBundle } from '../lib/rag-v2/contracts.js';
import { structure } from '../lib/rag-v2/parser.js';
import { loadSnapshot } from '../lib/rag-v2/search/snapshot.js';
import { modelProjection, modelSourceMetadata, resolveModelReference } from '../lib/rag-v2/search/model-context.js';
import { KNOWLEDGE_SCHEMA } from '../lib/rag-v2/knowledge.js';
import { knowledgePreparationPlan, knowledgePreparationDraft } from '../lib/rag-v2/knowledge-preparation.js';
import { adaptMetadata } from '../lib/rag-v2/metadata-adapter.js';
import { metadataValue } from '../lib/rag-v2/metadata-values.js';
import { filtersMatch } from '../lib/rag-v2/search/ranking.js';
import { directoryScope, retrievalDirectory } from '../lib/rag-v2/search/discovery.js';
import { embeddingConfig } from '../lib/rag-v2/search/embedding.js';
import { registeredSource } from '../lib/rag-v2/registered-source.js';
import { textRanges, unitForSpan, chunkSourceLocations } from '../lib/rag-v2/source-locations.js';
import { verifiedBundle } from '../lib/rag-v2/search/snapshot.js';
import { runtimeAdapters } from '../lib/rag-v2/pilot/retrieval.js';
import { evidenceHtml } from '../lib/rag-v2/search/export.js';
import { PilotService } from '../lib/rag-v2/pilot/service.js';
import { pilotChatResult } from '../lib/chat/m4PilotClientContract.js';

let root, networkCalls = 0;
const savedFetch = globalThis.fetch, savedConnect = net.Socket.prototype.connect;
const rights = { access: 'local_private', usage: 'development_only' }, tenant = 'source-structure-test';
const profile = { id: 'generic-fixtures', version: '1', months: [], categoryLabels: [] };
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-source-structure-'));
  globalThis.fetch = net.Socket.prototype.connect = () => { networkCalls++; throw Error('unexpected_network'); };
});
after(async () => {
  globalThis.fetch = savedFetch; net.Socket.prototype.connect = savedConnect;
  const target = path.resolve(root);
  assert(target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('rag-v2-source-structure-'));
  await fs.rm(target, { recursive: true, force: true });
  assert.equal(networkCalls, 0);
});
async function source(name, format, bytes, extra = {}) {
  const dir = path.join(root, name); await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `source.${format}`), bytes);
  const metadata = { document_id: name, title: `Fixture ${name}`, source_type: 'fixture', language: 'en', source_path: `source.${format}`, source_format: format, ...extra };
  return { tenant, inputRoot: dir, metadata, storeRoot: path.join(dir, 'store'), rights, profile };
}
function exactLocations(bundle) {
  for (const span of bundle.spans) assert.equal(unitForSpan(bundle, span).raw_text.slice(span.start, span.end), span.source_text);
  for (const chunk of bundle.chunks) {
    assert(chunk.source_text.length <= bundle.version.processing_config.chunkMaxChars);
    assert(chunk.source_locations.length);
  }
}

test('two PDF columns are read down each column, below a spanning heading', () => {
  const items = [{ text: 'Spanning heading', x: 50, y: 760, width: 500, height: 22, item_index: 0 }];
  for (let i = 0; i < 6; i++) {
    items.push({ text: `Left paragraph line ${i}`, x: 50, y: 700 - i * 16, width: 200, height: 12, item_index: i * 2 + 1 });
    items.push({ text: `Right paragraph line ${i}`, x: 330, y: 700 - i * 16, width: 200, height: 12, item_index: i * 2 + 2 });
  }
  const result = structure({ pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800], items }] },
    { tenant_id: tenant, document_version_id: 'version-test' }, configuration());
  assert.equal(result.pages[0].columns, 2);
  const text = result.pages[0].raw_text;
  assert(text.indexOf('Left paragraph line 5') < text.indexOf('Right paragraph line 0'));
  assert(text.startsWith('Spanning heading\n'));
});

test('a narrow PDF gutter and rotated margin preserve column order and indented paragraphs', async () => {
  const items = [{ text: 'Vertical archive stamp', x: 17, y: 165, width: 476, height: 20, rotation: 90, item_index: 0 }];
  for (let i = 0; i < 8; i++) {
    items.push({ text: `Left line ${i}`, x: 42, y: 230 - i * 13, width: 177, height: 11, item_index: i * 2 + 1 });
    items.push({ text: `Right line ${i}`, x: 234, y: 230 - i * 13, width: 177, height: 11, item_index: i * 2 + 2 });
  }
  const scope = { tenant_id: tenant, document_version_id: 'narrow-columns' };
  const result = structure({ pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 468, 680], items }] }, scope, configuration());
  assert.equal(result.pages[0].columns, 2);
  assert(result.pages[0].raw_text.indexOf('Left line 7') < result.pages[0].raw_text.indexOf('Right line 0'));
  assert(!result.spans.some(span => span.source_text.includes('archive stamp')));
  assert(result.removed.some(span => span.source_text === 'Vertical archive stamp'));

  const lines = ['First short paragraph line one', 'First short paragraph line two',
    'Second indented paragraph is a longer line one.', 'Second paragraph continues on the next line.'];
  const parsed = { pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800], items: lines.map((text, i) =>
    ({ text, x: i === 2 ? 52 : 40, y: 700 - i * 13, height: 11, width: 400, item_index: i })) }] };
  const { bundle } = await ingest({ ...await source('indented-pdf', 'pdf', '%PDF-1.4 indented'), config: { chunkMaxChars: 120 } }, { parsePdf: async () => parsed });
  assert.deepEqual(bundle.chunks.map(chunk => chunk.source_text), [lines.slice(0, 2).join('\n'), lines.slice(2).join('\n')]);
});

test('a fitting paragraph is not split to fill the previous chunk; a long Unicode span stays bounded and lossless', async () => {
  const options = await source('paragraphs', 'pdf', '%PDF-1.4 fixture');
  const a = 'First paragraph is complete. '.repeat(3).trim(), b = 'Second paragraph is complete. '.repeat(3).trim();
  const parsed = { info: {}, pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800], items: [
    { text: a, x: 40, y: 700, height: 12, width: 450, item_index: 0 },
    { text: b, x: 40, y: 650, height: 12, width: 450, item_index: 1 },
  ] }] };
  const { bundle } = await ingest({ ...options, config: { chunkMaxChars: 100 } }, { parsePdf: async () => parsed });
  assert.deepEqual(bundle.chunks.map(chunk => chunk.source_text), [a, b]); exactLocations(bundle);
  const text = 'A sentence ends. Another sentence with 🧭 and õäöü. '.repeat(30);
  const ranges = textRanges(text, 100);
  assert.equal(ranges.map(range => text.slice(range.start, range.end)).join(''), text);
  assert(ranges.every(range => range.end - range.start <= 100 && text.slice(range.start, range.end).isWellFormed()));
});

test('source ranges never bridge omitted non-whitespace text', () => {
  const unit = { id: 'unit', raw_text: 'first\nOMITTED\nsecond', locator: { kind: 'pdf', pdf_page: 1 } };
  const spans = [{ id: 'a', source_unit_index: 0, start: 0, end: 5 }, { id: 'b', source_unit_index: 0, start: 14, end: 20 }];
  const locations = chunkSourceLocations({ source_units: [unit], spans }, { span_ids: ['a', 'b'] });
  assert.deepEqual(locations.map(({ start, end }) => ({ start, end })), [{ start: 0, end: 5 }, { start: 14, end: 20 }]);
});

test('HTML article, table cells, immutable asset and exact generic citations survive without fake PDF pages', async () => {
  const html = '<html><body><nav>Navigation excluded</nav><article><h1>Planting guide</h1><p>A complete source paragraph.</p><script>fetch("https://example.invalid")</script><table><tr><th>Crop</th><th>Month</th></tr><tr><td>Peas</td><td>May</td></tr></table></article><footer>Footer excluded</footer></body></html>';
  const options = await source('html', 'html', html);
  const result = await ingest(options), b = result.bundle;
  assert.equal(await fs.readFile(path.join(result.output, 'original.html'), 'utf8'), html);
  assert.deepEqual(b.pages, []); assert.equal(b.version.pdf_hash, null);
  assert(b.chunks.every(chunk => chunk.pdf_pages.length === 0));
  assert(!b.chunks.some(chunk => /Navigation|Footer|fetch/u.test(chunk.source_text)));
  assert(b.source_units.some(unit => /Peas\s+May/u.test(unit.raw_text))); exactLocations(b);
  assert.equal((await ingest(options)).reused, true);
  const snapshot = await loadSnapshot(options.storeRoot, tenant, [b.document.id]); assert.equal(snapshot.bundles.length, 1);
  const chunk = b.chunks.find(chunk => chunk.source_text.includes('complete source'));
  const entry = { evidence_id: 'evidence-fixture', document_id: b.document.id, document_version_id: b.version.id, unit_id: 'unit-fixture',
    chunk_id: chunk.id, span_ids: chunk.span_ids, source_locations: chunk.source_locations, pdf_pages: [], source_text: chunk.source_text,
    bibliography: { title: b.document.fields.title.value }, limitations: [] };
  const packet = { tenant, query_id: 'query-fixture', generation_id: 'generation-fixture', evidence: [entry] };
  const projection = modelProjection(packet.evidence, packet); packet.reference_map = projection.references;
  const expected = projection.references.S1;
  const context = { tenant, subject: 'operator', usage: 'development_only' }, policy = { allowed: async () => ({ documents: [b.document.id] }) };
  await resolveModelReference({ packet, reference: 'S1', queryId: packet.query_id, context, policy, sourceResolver: async () => expected });
  await assert.rejects(resolveModelReference({ packet, reference: 'S1', queryId: packet.query_id, context, policy,
    sourceResolver: async () => ({ ...expected, source_locations: [] }) }), { code: 'canonical_reference_mismatch' });
});

const xml = '<oigusakt xmlns="fixture"><metaandmed><valjaandja>Fixture issuer</valjaandja><globaalID>fixture-123</globaalID><kehtivus><kehtivuseAlgus>2025-01-01</kehtivuseAlgus><kehtivuseLopp>2026-12-31</kehtivuseLopp></kehtivus></metaandmed><aktinimi><nimi><pealkiri>Fictional garden rules</pealkiri></nimi></aktinimi><sisu><paragrahv id="p1"><kuvatavNr>1</kuvatavNr><pealkiri>Scope</pealkiri><loige><tavatekst>This fictional rule applies to the sample garden.</tavatekst></loige></paragrahv><paragrahv id="p2"><kuvatavNr>2</kuvatavNr><pealkiri>Exception</pealkiri><loige><tavatekst>This fictional exception applies only to the sample greenhouse.</tavatekst></loige></paragrahv></sisu></oigusakt>';
test('XML preserves legal units and distinct validity metadata; external entities and malformed XML fail', async () => {
  const options = await source('xml', 'xml', xml, { year: 2024, valid_from: '2024-01-01' });
  const { bundle: b } = await ingest(options);
  assert.equal(b.document.fields.title.value, 'Fictional garden rules');
  assert.equal(b.document.fields.publication_year.value, 2024);
  assert.equal(b.document.fields.valid_from.value, '2025-01-01');
  assert(b.document.fields.valid_from.provenance[0].path.endsWith('/kehtivuseAlgus[1]'));
  assert.equal(b.chunks.length, 2); assert(b.chunks.every(chunk => new Set(chunk.source_locations.map(location => location.element_id)).size === 1));
  assert(b.chunks.every(chunk => chunk.previous_id === null && chunk.next_id === null)); exactLocations(b);
  await assert.rejects(ingest(await source('xml-entity', 'xml', '<!DOCTYPE x [<!ENTITY x SYSTEM "file:///private">]>'+xml)), { code: 'xml_external_entities_forbidden' });
  await assert.rejects(ingest(await source('xml-broken', 'xml', xml.replace('</paragrahv>', '</wrong>'))), { code: 'invalid_xml_structure' });
});

test('JSON selectors retain exact field locations, allow disjoint records and reject overlapping asset identities', async () => {
  const content = { items: [{ id: 'first', title: 'First service', summary: 'Only the first service is described here.', amount: { value: 12, period: 'month' } },
    { id: 'second', title: 'Second service', summary: 'Only the second service is described here.' }] };
  const options = await source('json', 'json', JSON.stringify(content), { source_selector: { json_pointer: '/items/0' } });
  const { bundle: b } = await ingest(options);
  assert(b.source_units.every(unit => unit.locator.path.startsWith('/items/0/')));
  assert(!b.chunks.some(chunk => chunk.source_text.includes('second service'))); exactLocations(b);
  await ingest({ ...options, metadata: { ...options.metadata, document_id: 'second', source_selector: { json_pointer: '/items/1' } } });
  await assert.rejects(ingest({ ...options, metadata: { ...options.metadata, document_id: 'duplicate' } }), { code: 'duplicate_asset_identity_conflict' });
});

test('knowledge preparation and imported knowledge bind HTML quotes to source units', async () => {
  const quote = 'The source describes a fictional condition.';
  const options = await source('html-knowledge', 'html', `<article><p>${quote}</p></article>`);
  const { bundle: b } = await ingest(options);
  const config = { enabled: true, model: 'gpt-6-luna', accountProject: 'proj_fixture', reasoning: 'medium', timeoutMs: 10000,
    maxOutputTokens: 1000, maxDocumentInputTokens: 40000, maxInputTokens: 40000, maxApiAttempts: 1, maxSpendUsd: '1', prices: { input: 125, output: 500 } };
  const plan = knowledgePreparationPlan(b, config);
  assert.equal(plan.body.model, 'gpt-6-luna'); assert.deepEqual(plan.body.reasoning, { effort: 'medium' });
  assert.equal(plan.body.store, false); assert.equal(plan.body.text.format.strict, true);
  assert.equal(BigInt(plan.manifest.reserved_nano_usd), BigInt(plan.manifest.input_tokens_reserved) * 125n + 500000n);
  assert.equal(plan.sources[0].source_unit_index, 0); assert.equal(plan.sources[0].pdf_page, undefined);
  const draft = knowledgePreparationDraft({ cards: [{ key: 'condition', kind: 'condition', statement: quote, scope: 'Fixture', subject: null, predicate: null, object: null,
    anchors: [{ source_id: plan.sources[0].source_id, quote }] }], dependencies: [], unresolved: [] }, plan, b);
  const result = await ingest({ ...options, metadata: { ...options.metadata, knowledge: draft.knowledge } });
  assert.equal(result.bundle.knowledge_cards[0].anchors[0].source_unit_index, 0);
  const wrong = { schema_version: KNOWLEDGE_SCHEMA, cards: [{ key: 'bad', kind: 'assertion', statement: quote, scope: 'Fixture', anchors: [{ source_unit_index: 1, quote }] }], dependencies: [] };
  await assert.rejects(ingest({ ...options, metadata: { ...options.metadata, knowledge: wrong } }), { code: 'knowledge_anchor_page_missing' });
});

test('metadata variants remain visible and registry input derives XML identity from the actual XML', async () => {
  const input = { source_path: 'guide.pdf', source_format: 'pdf', metadata_variants: [{ metadata: { docId: 'guide', title: 'Guide', authors: ['Local author'], year: 2025, source_type: 'guide', language: 'en' } }],
    server_metadata: [{ metadata: { title: 'Guide', authors: ['Different author'], year: 2025 } }] };
  const adapted = adaptMetadata(input, 'guide.json'); assert.equal(adapted.document_id, 'guide');
  assert(adapted.metadata_adaptation.conflicts.some(conflict => conflict.field === 'authors'));
  assert.deepEqual(adapted.metadata_variants, input.metadata_variants);
  const options = await source('registered-xml', 'xml', xml);
  const metadata = await registeredSource(options.inputRoot, { role: 'source', path: 'source.xml', sha256: hash(xml) });
  assert.equal(metadata.document_id, 'riigiteataja:fixture-123');
  await assert.rejects(registeredSource(options.inputRoot, { role: 'review_source', path: 'source.xml', sha256: hash(xml) }), { code: 'registry_entry_requires_reconciliation' });
});

test('XML declarations and calendar-date zones preserve legal text and original date provenance', async () => {
  const document = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml.replace('2025-01-01</', '2025-01-01+02:00</')
    .replace('>1</kuvatavNr>', '><![CDATA[§ 1. ]]></kuvatavNr>');
  const { bundle } = await ingest(await source('xml-declaration', 'xml', document));
  assert.equal(bundle.document.fields.valid_from.value, '2025-01-01');
  assert.equal(bundle.document.fields.valid_from.provenance[0].raw, '2025-01-01+02:00');
  assert(bundle.source_units.some(unit => unit.raw_text.includes('§ 1.')));
});

test('municipality names title unnamed packages but do not conflict with service/contact titles', () => {
  for (const title of ['Koduteenus', 'Sotsiaaltöötaja']) {
    const metadata = adaptMetadata({ title, municipality_name: 'Näidisvald', municipality_id: 'example_vald' });
    assert.equal(metadata.title, title); assert.deepEqual(metadata.metadata_adaptation.conflicts, []);
    assert.equal(metadata.metadata_adaptation.origins.title, '/title');
  }
  const packageMetadata = adaptMetadata({ municipality: { name: 'Näidisvald' }, items: [] }, 'package.json');
  assert.equal(packageMetadata.title, 'Näidisvald'); assert.equal(packageMetadata.metadata_adaptation.origins.title, '/municipality/name');
  const named = adaptMetadata({ title: 'Näidisvalla üldkontakt', name: 'Näidisvallavalitsus', municipality_name: 'Näidisvald' });
  assert.deepEqual(named.metadata_adaptation.conflicts, []); assert.equal(named.name, 'Näidisvallavalitsus');
  const conflict = adaptMetadata({ title: 'Koduteenus', metadata_variants: [{ metadata: { title: 'Teine teenus' } }], municipality_name: 'Näidisvald' });
  assert.deepEqual(conflict.metadata_adaptation.conflicts.map(c => c.field), ['title']);
});

test('calendar-date comparison removes only lexical zones and retains genuine date conflicts', async () => {
  for (const raw of ['2025-01-01', '2025-01-01Z', '2025-01-01+02:00', '2025-01-01-14:00']) {
    assert.equal(metadataValue('valid_from', raw), '2025-01-01');
    assert.equal(metadataValue('source_checked_at', raw), raw);
  }
  for (const invalid of ['2025-02-30Z', '2025-01-01+20:00', '2025-01-01T00:00:00Z']) assert.equal(metadataValue('valid_from', invalid), invalid);
  const equivalent = adaptMetadata({ valid_from: '2025-01-01+02:00', effective_start: '2025-01-01' });
  assert.equal(equivalent.valid_from, '2025-01-01+02:00'); assert.deepEqual(equivalent.metadata_adaptation.conflicts, []);
  const differing = adaptMetadata({ valid_from: '2025-01-01+02:00', effective_start: '2025-01-02' });
  assert(differing.metadata_adaptation.conflicts.some(c => c.field === 'valid_from'));
  const document = xml.replace('2025-01-01</', '2025-01-01+02:00</');
  const options = await source('xml-equal-date', 'xml', document, { title: 'Fictional garden rules', valid_from: '2025-01-01+02:00' });
  const { bundle } = await ingest(options);
  assert(!bundle.report.warnings.some(w => w.code === 'source_metadata_conflict' && w.detail === 'valid_from'));
  assert.equal(bundle.document.fields.valid_from.value, '2025-01-01');
  assert.equal(bundle.document.fields.valid_from.candidates[0].value, '2025-01-01+02:00');
  const changed = await ingest({ ...options, metadata: { ...options.metadata, valid_from: '2025-01-02' } });
  assert(changed.bundle.report.warnings.some(w => w.code === 'source_metadata_conflict' && w.detail === 'valid_from'));
});

test('canonical municipality IDs reach directory filters and model metadata without guessing from names', async () => {
  const options = await source('municipality-scope', 'html', '<article><h1>Koduteenus</h1><p>Abi igapäevatoimingutega.</p></article>',
    { title: 'Koduteenus', municipality_id: 'example_vald', municipality_name: 'Näidisvald' });
  const { bundle } = await ingest(options);
  assert.deepEqual(bundle.document.fields.regions.value, ['example_vald']);
  assert.equal(filtersMatch(bundle, { region: 'example_vald' }), true);
  assert.equal(filtersMatch(bundle, { region: 'other_vald' }), false);
  assert.equal(filtersMatch(bundle, { valid_at: '2026-09-23' }), false, 'Unknown validity must not become current merely because municipality is known');
  const directory = retrievalDirectory(bundle, embeddingConfig());
  assert.equal(directoryScope([directory], { filters: { region: 'example_vald' }, includeDocumentLabels: false }).documentIds.length, 1);
  assert.equal(directoryScope([directory], { filters: { region: 'other_vald' } }).documentIds.length, 0);
  const metadata = modelSourceMetadata(bundle);
  assert.equal(metadata.municipality_name.value, 'Näidisvald'); assert.equal(metadata.municipality_id.value, 'example_vald');
  assert(metadata.regions.provenance.some(p => p.path === '/municipality_id'));
  const unknown = await ingest({ ...options, metadata: { ...options.metadata, municipality_id: undefined } });
  assert.equal(filtersMatch(unknown.bundle, { region: 'example_vald' }), false);
});

test('registered municipal records retain audience lists, collection dates and canonical URLs with provenance', async () => {
  const item = { id: 'garden-service', document_id: 'garden-service', title: 'Garden service', language: 'en', source_type: 'municipal_service',
    summary: 'A fictional municipal service.', audience: ['CLIENT', 'SOCIAL_WORKER'], url_canonical: 'https://example.test/service',
    checked_at: '2026-04-12', retrieved_at: '2026-04-11', valid_from: null, valid_to: null };
  const bytes = JSON.stringify({ items: [item] });
  const options = await source('registered-municipal', 'json', bytes);
  const metadata = await registeredSource(options.inputRoot, { role: 'source', path: 'source.json', sha256: hash(bytes) }, { itemId: item.id });
  const { bundle } = await ingest({ ...options, metadata });
  assert.deepEqual(bundle.document.fields.audience.value, ['CLIENT', 'SOCIAL_WORKER']);
  assert.deepEqual(bundle.document.fields.source_urls.value, ['https://example.test/service']);
  assert.equal(bundle.document.fields.source_urls.provenance[0].path, '/imported_metadata/url_canonical');
  assert.equal(bundle.document.fields.source_checked_at.value, '2026-04-12');
  assert.equal(bundle.document.fields.retrieved_at.value, '2026-04-11');
  assert.equal(bundle.document.fields.valid_from.value, null);
});

test('complete source metadata still adapts published dates and URLs without dropping original keys', async () => {
  const options = await source('published-html', 'html', '<article><p>A dated source.</p></article>',
    { published: '2024-09-25', url: 'https://example.test/article', publisher: 'Example Publisher' });
  const { bundle } = await ingest(options);
  assert.equal(bundle.document.fields.publication_date.value, '2024-09-25');
  assert.equal(bundle.document.fields.publication_date.provenance[0].path, '/published');
  assert.equal(bundle.document.fields.authority.value, 'Example Publisher');
  assert.equal(bundle.document.legacy_metadata.published, '2024-09-25');
  assert.deepEqual(bundle.document.legacy_metadata, options.metadata);
});

test('metadata provenance resolves in the immutable metadata asset, including absent optional fields', async () => {
  const options = await source('metadata-provenance', 'html', '<article><p>A source with sparse metadata.</p></article>');
  const { bundle } = await ingest(options);
  for (const field of [...Object.values(bundle.document.fields), ...Object.values(bundle.document.search_aids)]) {
    for (const provenance of field.provenance.filter(item => item.kind === 'metadata')) {
      let value = options.metadata;
      for (const key of provenance.path.slice(1).split('/')) {
        const decoded = key.replaceAll('~1', '/').replaceAll('~0', '~');
        assert(value && Object.hasOwn(value, decoded), `Missing metadata origin: ${provenance.path}`);
        value = value[decoded];
      }
    }
  }
});

test('invalid generic span indexes cannot fall back to PDF pages and forged cross-record neighbors are rejected', async () => {
  const parsed = { pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800], items: [
    { text: 'A canonical paragraph.', x: 40, y: 700, height: 12, width: 350, item_index: 0 } ] }] };
  const { bundle } = await ingest(await source('span-index', 'pdf', '%PDF-1.4 index'), { parsePdf: async () => parsed });
  const broken = structuredClone(bundle); broken.spans[0].source_unit_index = 99;
  assert.equal(unitForSpan(broken, broken.spans[0]), undefined);
  assert.throws(() => validateBundle(broken), /invalid_source_(unit_reference|span)/u);
  const decimal = structuredClone(bundle); decimal.spans[0].start = 0.1;
  assert.throws(() => validateBundle(decimal), /invalid_source_span/u);
  const { bundle: legal } = await ingest(await source('legal-neighbors', 'xml', xml));
  legal.chunks[0].next_id = legal.chunks[1].id;
  assert.throws(() => verifiedBundle(legal, tenant), /source_neighbor_mismatch/u);
});

test('the pilot transport and HTML export preserve generic references and reject changed locators', async () => {
  const { bundle, output } = await ingest(await source('pilot-html', 'html', '<article><p>An exact source quotation for the pilot.</p></article>'));
  const config = { mode: 'test', tenant, testBundlePath: path.join(output, 'bundle.json'), configHash: 'fixture',
    documents: { [bundle.document.id]: bundle.version.id } };
  const adapters = runtimeAdapters(async () => config, 'operator');
  const packet = await adapters.search(config, { hash: 'fixture' });
  assert.deepEqual(packet.reference_map.S1.source_locations, bundle.chunks[0].source_locations);
  await adapters.canonical(config, packet, 'S1');
  const row = { id: 'generic-restore', state: 'completed', configHash: config.configHash, expiresAt: null,
    payload: { packet, question: 'A source question', query: { language: 'en', tokens: 4 }, events: [],
      answer: { kind: 'partial', blocks: [{ text: 'The source has a statement.', refs: ['S1'], factual: true }], limitations: [], clarification: null } } };
  const service = new PilotService({ readConfig: async () => config, adapters, store: { mutate: async (_config, _row, fn) => fn() } });
  const restored = await service.restore(row);
  assert.deepEqual(restored.sources[0].source_locations, bundle.chunks[0].source_locations);
  assert.deepEqual(pilotChatResult(restored, 'conversation').sources[0].source_locations, bundle.chunks[0].source_locations);
  const report = evidenceHtml({ ...packet, warnings: [] });
  assert(report.includes('/article[1]/p[1]')); assert(!report.includes('PDF lk'));
  const forged = structuredClone(packet);
  forged.reference_map.S1.source_locations[0].path = '/article[1]/p[999]';
  await assert.rejects(adapters.canonical(config, forged, 'S1'), /canonical_reference_mismatch/u);
});

test('JSON record titles remain citable while technical package fields are excluded from evidence', async () => {
  const content = { organization_id: 'garden', slug: 'internal-slug', name: 'Garden centre', metadata_schema_version: 'v2.5',
    summary: 'Fictional garden services.', services: [{ id: 's1', title: 'Seedling service', summary: 'We supply seedlings.', resource_type: 'service', relatedContacts: ['contact-internal'] },
      { id: 's2', title: 'Tool service', summary: 'We lend garden tools.' }] };
  const { bundle } = await ingest(await source('json-content', 'json', JSON.stringify(content)));
  assert(bundle.source_units.some(unit => unit.locator.path === '/services/0/title' && unit.raw_text === 'Seedling service'));
  const text = bundle.chunks.map(chunk => chunk.source_text).join('\n');
  assert(!/internal-slug|v2\.5|contact-internal/u.test(text));
  for (const chunk of bundle.chunks) for (const next of [chunk.next_id, chunk.previous_id].filter(Boolean)) {
    assert.equal(bundle.chunks.find(candidate => candidate.id === next).record_key, chunk.record_key);
  }
});

test('nested HTML lists retain parent text and omit hidden inline content', async () => {
  const options = await source('nested-html', 'html', '<article><ul><li>Parent <strong>condition</strong><ul><li>Child detail</li></ul></li></ul><p>Visible<span hidden>Hidden</span></p></article>');
  const { bundle } = await ingest(options);
  const text = bundle.chunks.map(chunk => chunk.source_text).join('\n');
  assert.match(text, /Parent\s+condition\s+Child detail/u);
  assert(!text.includes('Hidden'));
});

test('legacy PDF bundles without generic source units remain readable', async () => {
  const options = await source('legacy', 'pdf', '%PDF-1.4 legacy fixture');
  const parsed = { info: {}, pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800], items: [
    { text: 'A retained historical PDF source.', x: 40, y: 700, height: 12, width: 350, item_index: 0 } ] }] };
  const { bundle } = await ingest(options, { parsePdf: async () => parsed });
  const legacy = structuredClone(bundle); legacy.schema_version = 'rag-v2/1'; delete legacy.source_units;
  delete legacy.version.source_format; delete legacy.version.source_hash;
  for (const chunk of legacy.chunks) delete chunk.source_locations;
  assert.equal(validateBundle(legacy), legacy);
});
