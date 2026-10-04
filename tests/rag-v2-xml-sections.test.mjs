import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { DEFAULT_CONFIG, hash, stable } from '../lib/rag-v2/contracts.js';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { registeredSource } from '../lib/rag-v2/registered-source.js';
import { xmlSections } from '../lib/rag-v2/text-source.js';

// ADR-076: a registered source may be named sections of a Riigi Teataja act. The State Budget Act of 2026 is 4 MB of
// budget tables (§ 1); its § 2 sets the national rates other acts refer to, among them the subsistence level. The file
// is read from Andmebaasi as committed; no network.
const BUDGET = '103072026024', MARJAMAA = '401092026014', tenant = 'xml-sections-test';
const rights = { access: 'local_private', usage: 'development_only' }, profile = { id: 'generic-fixtures', version: '1', months: [], categoryLabels: [] };
let root;
before(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-xml-sections-')); });
after(async () => {
  const target = path.resolve(root);
  assert(target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('rag-v2-xml-sections-'));
  await fs.rm(target, { recursive: true, force: true });
});
async function registry(name, act, extra = {}) {
  const dir = path.join(root, name), file = `oigusaktid/${act}.xml`;
  await fs.mkdir(path.join(dir, 'oigusaktid'), { recursive: true });
  const bytes = await fs.readFile(path.join('Andmebaasi', file));
  await fs.writeFile(path.join(dir, file), bytes);
  const entry = { role: 'source', path: file, sha256: hash(bytes), ...extra };
  await fs.writeFile(path.join(dir, 'REGISTER.json'), JSON.stringify({ entries: [entry] }));
  return { dir, entry };
}
const read = async ({ dir, entry }) => (await ingest({ tenant, inputRoot: dir, metadataJson: stable(await registeredSource(dir, entry)), storeRoot: path.join(dir, 'store'), rights, profile })).bundle;

test('the committed register names § 2 of the State Budget Act, and the file is Riigi Teataja\'s own bytes', async () => {
  const register = JSON.parse(await fs.readFile('Andmebaasi/REGISTER.json', 'utf8'));
  const entry = register.entries.find(item => item.path === `oigusaktid/${BUDGET}.xml`);
  assert.deepEqual([entry.role, entry.xml_sections, entry.original_path], ['source', ['2'], `riigiteataja.ee/et/akt/${BUDGET}.xml`]);
  assert.equal(hash(await fs.readFile(path.join('Andmebaasi', entry.path))), entry.sha256);
  // No other registered source selects sections: every other act is read whole, as before.
  assert.deepEqual(register.entries.filter(item => item.xml_sections !== undefined).map(item => item.path), [entry.path]);
});

test('only the selected section is read; identity, validity and jurisdiction are the act\'s own', async () => {
  const source = await registry('budget', BUDGET, { xml_sections: ['2'] });
  const metadata = await registeredSource(source.dir, source.entry);
  assert.deepEqual(metadata.source_selector, { xml_sections: ['2'] });
  assert.deepEqual([metadata.document_id, metadata.title, metadata.authority, metadata.jurisdiction_level, metadata.valid_from, metadata.valid_to],
    [`riigiteataja:${BUDGET}`, '2026. aasta riigieelarve seadus', 'Riigikogu', 'national', '2026-07-13+03:00', '2026-12-31+02:00']);
  const bundle = await read(source);
  assert.deepEqual(bundle.source_units.map(unit => unit.locator.path), ['/oigusakt[1]/sisu[1]/paragrahv[2]']);
  assert.deepEqual([...new Set(bundle.sections.map(section => section.title).filter(Boolean))], ['§ 2. Seadustest tulenevate määrade ja piirsummade kehtestamine']);
  const text = bundle.chunks.map(chunk => chunk.source_text).join('\n');
  // Riigi Teataja writes a no-break space between a number and its unit.
  assert.match(text, /üksi elava isiku või perekonna esimese liikme toimetulekupiir\s220\seurot\skalendrikuus/u);
  // Nothing of the budget tables (§ 1) or of the other sections.
  assert(!/Riigieelarve vahendid|tasandus- ja toetusfondi|Kaitsekulu/u.test(text));
  assert(bundle.chunks.length <= 6 && text.length < 9000, `${bundle.chunks.length} chunks, ${text.length} characters`);
  // The section is one legal unit cut by size, as in every act: the passage with the amount carries the section's
  // heading, and the subsection's opening words ("Sotsiaalhoolekande seaduse alusel ...") are in the passage before it.
  const at = bundle.chunks.findIndex(chunk => /toimetulekupiir\s220\seurot/u.test(chunk.source_text));
  assert.match(JSON.stringify(bundle.chunks[at].section_path), /§ 2\. Seadustest tulenevate määrade/u);
  assert(at > 0 && /Sotsiaalhoolekande seaduse alusel kehtestatavad määrad/u.test(bundle.chunks[at - 1].source_text) && bundle.chunks[at].previous_id === bundle.chunks[at - 1].id);
  assert.deepEqual([bundle.document.fields.source_type.value, bundle.document.fields.valid_from.value, bundle.document.fields.valid_to.value],
    ['legal_act', '2026-07-13', '2026-12-31']);
});

test('without the selection the same file is refused whole: the tables are over the text limit', async () => {
  const source = await registry('whole', BUDGET);
  await assert.rejects(read(source), error => error.code === 'text_limit');
});

test('a section the act does not have and a malformed selection are errors, not an empty or a whole source', async () => {
  const missing = await registry('missing', BUDGET, { xml_sections: ['2', '99'] });
  await assert.rejects(read(missing), error => error.code === 'xml_section_not_found');
  for (const [name, bad] of [['empty', []], ['words', ['§ 2']], ['number', [2]], ['twice', ['2', '2']], ['text', '2']]) {
    const source = await registry(`bad-${name}`, BUDGET, { xml_sections: bad });
    await assert.rejects(registeredSource(source.dir, source.entry), error => error.code === 'invalid_source_selector', name);
  }
  assert.equal(xmlSections({}), null);
  assert.deepEqual(xmlSections({ source_selector: { xml_sections: ['15¹', '2'] } }), ['15¹', '2']);
});

test('an act without a selection is read as before; a selection on it reads that section with its own notes only', async () => {
  const whole = await read(await registry('act-whole', MARJAMAA)), part = await read(await registry('act-part', MARJAMAA, { xml_sections: ['3'] }));
  assert(whole.source_units.length > 3);
  const third = whole.source_units.find(unit => unit.locator.path === '/oigusakt[1]/sisu[1]/paragrahv[3]');
  assert.deepEqual(part.source_units.map(unit => [unit.locator.path, unit.raw_text, unit.amendments ?? null]), [[third.locator.path, third.raw_text, third.amendments ?? null]]);
  // The act's history stays; notes on what was not read are not this source's.
  const legal = bundle => bundle.document.fields.legal_text.value;
  assert.deepEqual(legal(part).history, legal(whole).history);
  assert.deepEqual(legal(part).structure, []);
  assert(DEFAULT_CONFIG.maxTextChars < 4000000);
});
