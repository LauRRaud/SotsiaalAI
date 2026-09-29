import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { hash } from '../lib/rag-v2/contracts.js';
import { rtAnnexFiles, annexTable, derivedAnnex } from '../lib/rag-v2/adapters/rt-annex.js';
import { registeredSource } from '../lib/rag-v2/registered-source.js';
import { ingest } from '../lib/rag-v2/ingestion.js';

// ADR-050: the assistive devices list is the annex PDF inside the regulation's RT XML. Both registered versions are
// read from Andmebaasi as committed; no network.
const VERSIONS = [
  { act: '129082025009', file: 'SOM_m43_lisa.pdf', rows: 325, pages: 16, hearingAid: '350,00', validTo: '2026-09-30' },
  { act: '126092026005', file: 'SOM_24092026_m37_lisa.pdf', rows: 327, pages: 17, hearingAid: '500,00', validTo: null },
];
const out = act => `oigusaktid/lisad/${act}-abivahendite-loetelu`;
let root;
before(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-rt-annex-')); });
after(async () => {
  const target = path.resolve(root);
  assert(target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('rag-v2-rt-annex-'));
  await fs.rm(target, { recursive: true, force: true });
});

test('the committed derived sources are exactly what the extractor reads from the registered XML annexes', async () => {
  for (const version of VERSIONS) {
    const derived = await derivedAnnex({ root: 'Andmebaasi', xmlPath: `oigusaktid/${version.act}.xml`, fileName: version.file, table: 'abivahendite_loetelu', out: out(version.act) });
    assert.equal(derived.rows, version.rows);
    assert.equal(derived.source, await fs.readFile(`Andmebaasi/${out(version.act)}.json`, 'utf8'), version.act);
    assert.equal(derived.metadata, await fs.readFile(`Andmebaasi/${out(version.act)}.meta.json`, 'utf8'), version.act);
  }
});

test('table rows keep their columns: prices under the right label, class codes with a full stop, repeated codes, rows across a line offset', async () => {
  for (const version of VERSIONS) {
    const [annex] = rtAnnexFiles(await fs.readFile(`Andmebaasi/oigusaktid/${version.act}.xml`));
    assert.equal(annex.file_name, version.file);
    const table = await annexTable(annex.bytes, 'abivahendite_loetelu');
    assert.equal(table.pages, version.pages);
    const row = code => table.rows.find(entry => entry.id === code);
    const cell = (code, label) => row(code).cells[table.columns.indexOf(label)];
    assert.equal(cell('22.06.12.01', 'Piirhind (müük)'), version.hearingAid);
    assert.equal(cell('22.06.12.01', 'Piirmäär (õigustatud isikult ülevõetava tasu maksmise kohustuse piirmäär ehk % piirhinnast)'), '90%');
    assert.equal(cell('22.06.12.01', 'Piirhind (üür / kuu)'), '');
    // A centred price and its note stay in one column ("taotluse alusel" starts left of the header).
    assert.equal(cell('22.06.06', 'Piirhind (müük)'), '200,00 erandi taotluse alusel');
    assert.equal(cell('22.06.06', 'Piirhind (üür / kuu)'), '');
    // "06." is printed with a full stop; a class name starting in the name column stays there even when it is long.
    assert.equal(row('06').cells[1], 'PROTEESID');
    assert.match(row('27').cells[1], /^ABIVAHENDID JA SEADMED KESKKONNATEGURITE PARENDAMISEKS/u);
    // "09.30" is a group heading and its own row; the repeat gets its occurrence in the id.
    assert.deepEqual(table.rows.filter(entry => entry.code === '09.30').map(entry => entry.id), ['09.30', '09.30-2']);
    // The old version prints the 22.06.15 code 0.2 below its name: the name is the row's, not the row above's.
    assert.equal(row('22.06.15').cells[1], 'kõrvatagused kuulmisabivahendid');
    assert(!table.rows.some(entry => entry.cells.some(value => /^(M M|I I|tk tk)$/u.test(value))));
  }
  await assert.rejects(annexTable(Buffer.from('%PDF-1.4'), 'unknown_table'), { code: 'unsupported_annex_table' });
});

test('the registry adapter checks the annex against its registered XML; an open act version gives the annex an open end on ingest', async () => {
  const dir = path.join(root, 'registry'), entries = [];
  const copy = async file => { await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true }); await fs.copyFile(path.join('Andmebaasi', file), path.join(dir, file)); };
  for (const version of VERSIONS) {
    for (const file of [`oigusaktid/${version.act}.xml`, `${out(version.act)}.json`, `${out(version.act)}.meta.json`]) await copy(file);
    const bytes = file => fs.readFile(path.join(dir, file));
    entries.push({ role: 'source', path: `oigusaktid/${version.act}.xml`, sha256: hash(await bytes(`oigusaktid/${version.act}.xml`)) },
      { role: 'source', path: `${out(version.act)}.json`, sha256: hash(await bytes(`${out(version.act)}.json`)), metadata_path: `${out(version.act)}.meta.json` },
      { role: 'metadata', path: `${out(version.act)}.meta.json`, sha256: hash(await bytes(`${out(version.act)}.meta.json`)) });
  }
  const write = list => fs.writeFile(path.join(dir, 'REGISTER.json'), JSON.stringify({ entries: list }));
  await write(entries);
  const annexEntry = act => entries.find(entry => entry.path === `${out(act)}.json`);
  const store = path.join(dir, 'store'), rights = { access: 'local_private', usage: 'development_only' };
  const profile = { id: 'generic-fixtures', version: '1', months: [], categoryLabels: [] };
  for (const version of VERSIONS) {
    const metadata = await registeredSource(dir, annexEntry(version.act));
    assert.equal(metadata.rt_annex.open_end, version.validTo === null);
    const { bundle } = await ingest({ tenant: 'rt-annex-test', inputRoot: dir, metadata, storeRoot: store, rights, profile });
    const fields = bundle.document.fields;
    assert.equal(fields.source_type.value, 'legal_act');
    assert.equal(fields.valid_to.value, version.validTo);
    assert.equal(fields.valid_to.open_end === true, version.validTo === null);
    assert(!bundle.report.warnings.some(warning => warning.code === 'title_not_matched_in_pdf'));
    assert(bundle.chunks.some(chunk => chunk.source_text.includes(`Piirhind (müük): ${version.hearingAid}`)));
  }
  // Every claim is checked against the registered XML.
  const meta = `${out('126092026005')}.meta.json`, original = JSON.parse(await fs.readFile(path.join(dir, meta), 'utf8'));
  const tampered = async (change, code) => {
    const text = JSON.stringify({ ...original, ...change(original) });
    await fs.writeFile(path.join(dir, meta), text);
    await write(entries.map(entry => (entry.path === meta ? { ...entry, sha256: hash(text) } : entry)));
    await assert.rejects(registeredSource(dir, annexEntry('126092026005')), { code });
  };
  await tampered(value => ({ rt_annex: { ...value.rt_annex, pdf_sha256: '0'.repeat(64) } }), 'rt_annex_file_mismatch');
  await tampered(value => ({ rt_annex: { ...value.rt_annex, file_name: 'other.pdf' } }), 'rt_annex_file_mismatch');
  await tampered(() => ({ valid_to: '2026-12-31' }), 'rt_annex_act_mismatch');
  await tampered(() => ({ source_type: 'guide' }), 'rt_annex_act_mismatch');
  await tampered(value => ({ rt_annex: { ...value.rt_annex, xml_path: 'oigusaktid/129082025009.xml' } }), 'rt_annex_source_not_registered');
  await tampered(value => ({ rt_annex: { ...value.rt_annex, act_reference: undefined } }), 'invalid_rt_annex');
});
