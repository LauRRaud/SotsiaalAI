import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { readJson, readActive, readInput, loadVersion, openCatalog } from '../lib/rag-v2/catalog.js';
import { hash, id, validateBundle, validateMetadata, configuration } from '../lib/rag-v2/contracts.js';
import { parsePdf, structure } from '../lib/rag-v2/parser.js';

const inputRoot = process.env.RAG_V2_INPUT_ROOT;
const metadataFile = 'sotsiaaltoo-2-2025-artikkel-12-tehisintellekt-sotsiaaltoos.json';
const rights = { access: 'local_private', usage: 'development_only' };
const profile = await readJson(fileURLToPath(new URL('../lib/rag-v2/domain-profiles/sotsiaalai.json', import.meta.url)));
let temporary, sample, original, calls = 0;
const savedFetch = globalThis.fetch, savedConnect = net.Socket.prototype.connect;
const syntheticProfile = { id: 'synthetic-gardening', version: '1', months: [], categoryLabels: [] };

function options(overrides = {}) { return { tenant: 'sample', inputRoot, metadataFile, storeRoot: path.join(temporary, 'store'), profile, rights, ...overrides }; }
function fixture(text = 'Synthetic gardening guidance: water seedlings carefully.') {
  return { info: {}, pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800], items: [
    { text, item_index: 0, x: 50, y: 700, height: 12, width: 400, font: 'synthetic', transform: [12, 0, 0, 12, 50, 700] },
  ] }] };
}
async function synthetic(name, changes = {}) {
  const root = path.join(temporary, name);
  await fs.mkdir(root, { recursive: true });
  const metadata = { document_id: name, source_type: 'guide', title: 'Synthetic gardening', language: 'en', source_path: 'source.pdf', docId: 'shared-issue', ...changes };
  await fs.writeFile(path.join(root, 'source.pdf'), `%PDF-1.4\n% synthetic parser fixture ${name}`);
  await fs.writeFile(path.join(root, 'metadata.json'), JSON.stringify(metadata));
  return options({ inputRoot: root, metadataFile: 'metadata.json', profile: syntheticProfile });
}
async function cloneSample(name, changes) {
  const root = path.join(temporary, name);
  await fs.mkdir(root);
  await fs.copyFile(path.join(inputRoot, original.source_path), path.join(root, original.source_path));
  await fs.writeFile(path.join(root, metadataFile), JSON.stringify({ ...original, ...changes }));
  return options({ inputRoot: root });
}
before(async () => {
  globalThis.fetch = () => { calls++; throw new Error('unexpected_network'); };
  net.Socket.prototype.connect = function () { calls++; throw new Error('unexpected_network'); };
  temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'sotsiaalai-rag-v2-test-'));
  if (inputRoot) {
    original = await readJson(path.join(inputRoot, metadataFile));
    sample = await ingest(options());
  }
});
after(async () => {
  globalThis.fetch = savedFetch; net.Socket.prototype.connect = savedConnect;
  // This directory is created exclusively by this suite, never supplied by a caller.
  assert.ok(path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep));
  await fs.rm(temporary, { recursive: true, force: true });
  assert.equal(calls, 0, 'No network attempts are permitted');
});
const provided = { skip: !inputRoot && 'Set RAG_V2_INPUT_ROOT to run supplied-asset acceptance cases' };

test('I-01: supplied PDF, identity, metadata and original bytes are preserved', provided, async () => {
  const b = sample.bundle;
  assert.equal(b.pages.length, 13);
  assert.equal(b.document.fields.title.value, original.title);
  assert.deepEqual(b.document.fields.authors.value, ['Laur Raudsoo']);
  assert.deepEqual(b.document.legacy_metadata, original);
  assert.notEqual(b.document.id, b.version.id);
  assert.equal(hash(await fs.readFile(path.join(sample.output, 'original.pdf'))), 'a41995721ca13aa78898116ccef466aedf3576e26bb30fce3c145f4d8b87828b');
  assert.equal(hash(await fs.readFile(path.join(sample.output, 'metadata.json'))), 'd090594afae2c24541ab71ed63a86d013c999ab519606597d145395023eccd5a');
});
test('I-02: two distinct synthetic articles sharing issue docId survive', async () => {
  const a = await ingest(await synthetic('article-a'), { parsePdf: async () => fixture('Synthetic article A') });
  const b = await ingest(await synthetic('article-b'), { parsePdf: async () => fixture('Synthetic article B') });
  assert.notEqual(a.bundle.document.id, b.bundle.document.id);
  assert.equal(a.bundle.document.fields.issue_id_candidate.value, b.bundle.document.fields.issue_id_candidate.value);
  assert.deepEqual(Object.keys(b.bundle.document.external_ids), ['docId', 'articleId', 'source_id', 'document_id']);
  const active = await readActive(path.dirname(path.dirname(b.output)));
  assert.ok(active.documents[a.bundle.document.id]); assert.ok(active.documents[b.bundle.document.id]);
});
test('I-03: publication, PDF creation, imported check and legal validity remain separate', provided, () => {
  const f = sample.bundle.document.fields;
  assert.equal(f.publication_date.value, '2025-06-06');
  assert.ok(f.publication_date.provenance[0].span_ids.every(s => sample.bundle.spans.find(x => x.id === s).pdf_page === 1));
  assert.equal(f.asset_created_at.value, '2025-12-05T17:49:38+00:00');
  assert.equal(f.source_checked_at.value, '2026-04-26');
  assert.equal(f.source_checked_at.review_state, 'imported_not_verified');
  assert.equal(f.valid_from.value, null); assert.equal(f.valid_to.value, null);
});
test('I-04: each exact source range resolves; OTT is on PDF page 3', provided, () => {
  const b = sample.bundle;
  assert.deepEqual(b.document.fields.pdf_page_range.value, [1, 13]);
  assert.equal(b.document.fields.journal_page_range.value, null);
  for (const s of b.spans) {
    assert.equal(s.pdf_page, s.parser_page_index + 1);
    assert.equal(b.pages[s.parser_page_index].raw_text.slice(s.start, s.end), s.source_text);
  }
  assert.ok(b.spans.some(s => s.pdf_page === 3 && /OTT-süsteem/.test(s.source_text)));
  assert.ok(b.chunks.every(c => c.pdf_pages.length < 13));
  const broken = structuredClone(b); broken.spans[0].start++;
  assert.throws(() => validateBundle(broken), /invalid_source_span/);
});
test('I-05: Eetika and Uurimus/analüüs retain different meanings', provided, () => {
  assert.equal(sample.bundle.document.fields.legacy_section.value, 'Eetika');
  assert.equal(sample.bundle.document.fields.source_category.value, 'Uurimus/analüüs');
  assert.ok(sample.bundle.document.fields.source_category.provenance[0].span_ids.length);
});
test('I-06: margin cleanup has an audit trail and does not remove provenance', provided, () => {
  assert.ok(sample.bundle.report.transformations.length >= 26);
  assert.ok(sample.bundle.chunks.every(c => !c.retrieval_text.includes('05.12.25, 19:49')));
  assert.ok(sample.bundle.document.fields.source_urls.value.some(url => url.startsWith('https://www.tai.ee/et/sotsiaaltoo/')));
  assert.ok(sample.bundle.spans.some(s => s.source_text.includes('Laur Raudsoo')));
  assert.ok(sample.bundle.spans.some(s => s.source_text.includes('06. juuni 2025')));
});
test('I-07: section headings, chunk parents and structural edge evidence survive', provided, () => {
  const expected = [[3, 'Kas tehisintellekt on dokumenteerimisel'], [5, 'Kas vaimse tervise teenuste'], [8, 'Kelle kasuks ja kelle arvelt'], [12, 'Tehnoloogia väärtus oleneb']];
  for (const [page, title] of expected) {
    const section = sample.bundle.sections.find(s => s.title?.startsWith(title));
    assert.ok(section, title);
    assert.equal(sample.bundle.spans.find(s => s.id === section.span_ids[0]).pdf_page, page);
  }
  assert.ok(sample.bundle.chunks.every(c => c.section_path[0] === original.title && c.span_ids.length));
  assert.ok(sample.bundle.blocks.some(b => b.kind === 'paragraph'));
  assert.ok(sample.bundle.blocks.some(b => b.kind === 'quote'));
  assert.ok(sample.bundle.spans.every(s => sample.bundle.blocks.some(b => b.id === s.block_id && b.span_ids.includes(s.id))));
  assert.ok(sample.bundle.relations.every(r => r.verification_state === 'parser_structural' && r.span_ids.length));
});
test('I-08: original description is an unverified search aid, not evidence', provided, () => {
  const aid = sample.bundle.document.search_aids.description;
  assert.equal(aid.value, original.description); assert.equal(aid.role, 'search_aid_only');
  assert.equal(aid.review_state, 'not_verified');
  assert.ok(sample.bundle.report.warnings.some(w => w.code === 'description_not_verified' && w.detail.includes('enesejuhitud')));
  assert.ok(sample.bundle.chunks.every(c => !c.source_text.includes(original.description)));
});
test('I-09: missing bibliography is a hash-bound reviewed coverage limit', provided, () => {
  assert.equal(sample.bundle.document.fields.reference_list_state.value, 'not_visible_in_supplied_asset');
  assert.equal(sample.bundle.document.fields.in_text_citations_present.value, true);
  assert.ok(sample.bundle.spans.some(s => s.pdf_page === 13 && s.source_text.includes('Viidatud allikad')));
  assert.deepEqual(sample.bundle.knowledge_cards, []);
  assert.ok(sample.bundle.relations.every(r => r.type !== 'CITES'));
});
test('I-10: active/historical/BOTH never grant public or cross-tenant access', provided, async () => {
  const d = sample.bundle.document;
  assert.equal(d.fields.historical.value, true); assert.equal(d.fields.source_status.value, 'active');
  assert.equal(d.fields.audience.value, 'BOTH'); assert.deepEqual(d.rights, rights);
  const other = await ingest(options({ tenant: 'other-tenant' }));
  assert.notEqual(other.bundle.document.id, d.id);
  assert.ok(other.bundle.spans.every(s => s.tenant_id === 'other-tenant'));
});
test('I-11: repeat ingest reuses exactly the stored version and makes zero parser/model calls', provided, async () => {
  const again = await ingest(options(), { parsePdf: () => { throw new Error('must_not_parse'); } });
  assert.equal(again.reused, true); assert.deepEqual(again.bundle, sample.bundle);
  assert.equal(again.bundle.report.model_calls, 0);
});
test('I-12: unknown metadata survives; wrong known types fail visibly', async () => {
  const opts = await synthetic('unknown-fields', { custom: { note: 'synthetic' } });
  const result = await ingest(opts, { parsePdf: async () => fixture() });
  assert.deepEqual(result.bundle.document.legacy_metadata.custom, { note: 'synthetic' });
  assert.equal(result.bundle.document.fields.custom, undefined);
  await assert.rejects(ingest(await synthetic('invalid-type', { historical: 'yes' })), /invalid_metadata_historical/);
});
test('I-13: no text and partly scanned documents do not publish an empty success', async () => {
  const opts = await synthetic('empty');
  const blank = fixture(); blank.pages[0].items = [];
  await assert.rejects(ingest(opts, { parsePdf: async () => blank }), /needs_ocr/);
  const mixed = fixture(); mixed.pages.push({ ...blank.pages[0], pdf_page: 2, parser_page_index: 1 });
  await assert.rejects(ingest(opts, { parsePdf: async () => mixed }), /partial_text_needs_review/);
});
test('I-14: failure before publish preserves active generation and restart recovers staged version', async () => {
  const opts = await synthetic('restart');
  const first = await ingest(opts, { parsePdf: async () => fixture() });
  const dir = path.dirname(path.dirname(first.output));
  const before = await readActive(dir);
  await fs.writeFile(path.join(opts.inputRoot, 'source.pdf'), '%PDF-1.4\n% changed synthetic asset');
  await assert.rejects(ingest(opts, { parsePdf: async () => fixture('Updated synthetic text'), beforePublish: () => { throw new Error('injected'); } }), /ingest_failed/);
  assert.deepEqual(await readActive(dir), before);
  const failed = await Promise.all((await fs.readdir(path.join(dir, 'jobs'))).map(f => readJson(path.join(dir, 'jobs', f))));
  assert.ok(failed.some(j => j.state === 'failed' && j.states.includes('staged')));
  const second = await ingest(opts, { parsePdf: async () => fixture('Updated synthetic text') });
  assert.notEqual(second.bundle.version.id, first.bundle.version.id);
  assert.equal(second.bundle.document.id, first.bundle.document.id);
  assert.equal((await loadVersion(dir, first.bundle.version.id)).chunks[0].source_text, first.bundle.chunks[0].source_text);
});
test('I-15: path traversal and absolute paths rejected; Unicode names work', provided, async () => {
  for (const source_path of ['../secret.txt', 'C:\\secret.txt', '/etc/passwd']) {
    const opts = await synthetic(`bad-${hash(source_path).slice(0, 6)}`, { source_path });
    await assert.rejects(ingest(opts), /source_path_outside_root/);
  }
  assert.ok((await readInput(inputRoot, original.source_path, 1000000)).length);
});
test('M1 safety: same bytes with a new document ID are an explicit duplicate conflict', provided, async () => {
  await assert.rejects(ingest(await cloneSample('duplicate', { document_id: 'different-identity' })), /duplicate_asset_identity_conflict/);
});
test('M1 versioning: metadata update preserves document and embedding text hashes, old references still resolve', provided, async () => {
  const changed = await ingest(await cloneSample('checked-date', { last_checked: '2026-09-05' }));
  assert.equal(changed.bundle.document.id, sample.bundle.document.id);
  assert.notEqual(changed.bundle.version.id, sample.bundle.version.id);
  assert.deepEqual(changed.bundle.chunks.map(c => c.embedding_input_hash), sample.bundle.chunks.map(c => c.embedding_input_hash));
  assert.equal((await loadVersion(path.dirname(path.dirname(sample.output)), sample.bundle.version.id)).document.fields.source_checked_at.value, '2026-04-26');
});
test('M1 isolation: second domain uses same ingest core without SotsiaalAI category/audit leakage', async () => {
  const result = await ingest(await synthetic('garden'), { parsePdf: async () => fixture() });
  assert.equal(result.bundle.document.domain_profile.id, 'synthetic-gardening');
  assert.equal(result.bundle.document.fields.source_category.value, null);
  assert.equal(result.bundle.document.fields.reference_list_state.value, 'not_assessed');
});
test('M1 safety: limits, exclusive writer, corrupted version and corrupted catalog fail closed', async () => {
  const opts = await synthetic('bounded');
  await assert.rejects(ingest({ ...opts, config: { maxMetadataBytes: 10 } }), /input_size_limit/);
  assert.throws(() => configuration({ chunkMaxChars: 0 }), /invalid_configuration/);
  const lock = await openCatalog(opts.storeRoot, opts.tenant);
  try { await assert.rejects(ingest(opts), /catalog_busy/); } finally { await lock.close(); }
  const result = await ingest(opts, { parsePdf: async () => fixture() });
  await fs.appendFile(path.join(result.output, 'chunks.json'), 'corrupt');
  await assert.rejects(ingest(opts), /version_integrity_failed/);
  const brokenRoot = path.join(temporary, 'broken-store');
  const brokenDir = path.join(brokenRoot, id('tenant', 'sample'));
  await fs.mkdir(brokenDir, { recursive: true });
  await fs.writeFile(path.join(brokenDir, 'active.json'), '{');
  await assert.rejects(ingest({ ...opts, storeRoot: brokenRoot }), /ingest_failed/);
});
test('M1 parser: repeated text in the body is preserved even when identical margin text is removed', () => {
  const parsed = fixture('Body line');
  parsed.pages[0].items.push({ ...parsed.pages[0].items[0], text: 'Repeated date 2025', y: 790, item_index: 1 });
  parsed.pages[0].items.push({ ...parsed.pages[0].items[0], text: 'Repeated date 2025', y: 600, item_index: 2 });
  parsed.pages.push({ ...structuredClone(parsed.pages[0]), pdf_page: 2, parser_page_index: 1 });
  const s = structure(parsed, { tenant_id: 'synthetic', document_version_id: 'v' }, configuration());
  assert.equal(s.removed.length, 2);
  assert.equal(s.spans.filter(x => x.source_text === 'Repeated date 2025').length, 2);
});
test('M1 file boundary: a directory symlink outside the approved root is rejected', async () => {
  const root = path.join(temporary, 'symlink-input'), outside = path.join(temporary, 'outside');
  await fs.mkdir(root); await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, 'secret.txt'), 'synthetic secret');
  await fs.symlink(outside, path.join(root, 'escape'), 'junction');
  await assert.rejects(readInput(root, 'escape/secret.txt', 100), /source_path_outside_root/);
});
test('M1 real parser enforces page and wall-time limits', provided, async () => {
  const bytes = await fs.readFile(path.join(inputRoot, original.source_path));
  await assert.rejects(parsePdf(bytes, configuration({ maxPages: 1 })), /page_limit/);
  await assert.rejects(parsePdf(bytes, configuration({ maxPdfItemsPerPage: 1, maxPdfItems: 1 })), /item_limit/);
  await assert.rejects(parsePdf(bytes, configuration({ timeoutMs: 1 })), /parser_timeout/);
});
test('Audit: decoded item cardinality is bounded independently of text length', () => {
  const config=configuration({maxPdfItemsPerPage:2,maxPdfItems:3});
  const tooMany=fixture('A');tooMany.pages[0].items.push({...tooMany.pages[0].items[0],text:'B',item_index:1},{...tooMany.pages[0].items[0],text:'C',item_index:2});
  assert.throws(()=>structure(tooMany,{tenant_id:'synthetic',document_version_id:'v'},config),/item_limit/);
  const across=fixture('A');across.pages.push({...structuredClone(across.pages[0]),pdf_page:2,parser_page_index:1},{...structuredClone(across.pages[0]),pdf_page:3,parser_page_index:2},{...structuredClone(across.pages[0]),pdf_page:4,parser_page_index:3});
  assert.throws(()=>structure(across,{tenant_id:'synthetic',document_version_id:'v'},config),/item_limit/);
});
test('Audit: metadata fields and arrays are bounded before expansion', () => {
  const base={document_id:'d',title:'t',source_path:'x.pdf',source_type:'guide',language:'et'};
  assert.throws(()=>validateMetadata({...base,title:'x'.repeat(501)}),/metadata_title_too_long/);
  assert.throws(()=>validateMetadata({...base,description:'x'.repeat(20001)}),/metadata_description_too_long/);
  assert.throws(()=>validateMetadata({...base,authors:Array.from({length:33},()=> 'A')}),/metadata_authors_too_large/);
  assert.throws(()=>validateMetadata({...base,tags:['x'.repeat(201)]}),/metadata_tags_too_large/);
});
test('Audit: normalized output has an independent expanded-representation budget', async () => {
  const opts=await synthetic('expanded-budget');opts.config={maxExpandedChars:100};
  await assert.rejects(ingest(opts,{parsePdf:async()=>fixture('A sufficiently long synthetic body that exceeds the deliberately tiny expanded representation budget.')}),/expanded_representation_too_large/);
});
