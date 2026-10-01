import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { DEFAULT_CONFIG, hash, id, stable } from '../lib/rag-v2/contracts.js';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { registeredSource } from '../lib/rag-v2/registered-source.js';
import { embeddingConfig, indexUnit } from '../lib/rag-v2/search/embedding.js';
import { sourceEntry } from '../lib/rag-v2/search/retrieval.js';
import { modelProjection } from '../lib/rag-v2/search/model-context.js';

// ADR-062, stage 1: the two acts of the 30.09 live check, read from Andmebaasi as committed; no network. The reader
// keeps their amendment notes and their own dates as data, and everything else is what reader source-structure-v29
// made of the same two files: the fixture holds its chunks' hashes and the whole model context, made with the
// committed v29 code and ingested as below (the embedding input hashes are the stored corpus versions').
const MARJAMAA = '401092026014', KUUSALU = '412092026022', tenant = 'legal-dates-test';
const v29 = JSON.parse(await fs.readFile(new URL('./fixtures/rag-v2-legal-dates-v29.json', import.meta.url), 'utf8'));
const rights = { access: 'local_private', usage: 'development_only' }, profile = { id: 'generic-fixtures', version: '1', months: [], categoryLabels: [] };
let root; const bundles = {};
const ACTS = [[MARJAMAA, 'marjamaa_vald', 'Märjamaa vald'], [KUUSALU, 'kuusalu_vald', 'Kuusalu vald']];
// A registry as the corpus has it: REGISTER.json names each act's file with its hash, and a source register it declares
// gives the act's municipality by that hash.
async function registry(dir, acts = ACTS, { sources = true } = {}) {
  await fs.mkdir(path.join(dir, 'oigusaktid'), { recursive: true }); await fs.mkdir(path.join(dir, 'register'), { recursive: true });
  const entries = [], listed = [];
  for (const [act, municipality_id, municipality_name] of acts) {
    const bytes = await fs.readFile(path.join('Andmebaasi', 'oigusaktid', `${act}.xml`));
    await fs.writeFile(path.join(dir, 'oigusaktid', `${act}.xml`), bytes);
    entries.push({ sha256: hash(bytes), municipality_id, municipality_name });
    listed.push({ role: 'source', path: `oigusaktid/${act}.xml`, sha256: hash(bytes) });
  }
  const register = JSON.stringify({ entries });
  await fs.writeFile(path.join(dir, 'register', 'kov.json'), register);
  await fs.writeFile(path.join(dir, 'REGISTER.json'), JSON.stringify({ entries: [{ role: 'source_register', path: 'register/kov.json', sha256: hash(register) }, ...(sources ? listed : [])] }));
  return listed;
}
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-legal-dates-'));
  // Ingested as the batch plan does: the registry's metadata for the entry, in canonical form.
  for (const entry of await registry(root)) {
    const metadata = await registeredSource(root, entry);
    bundles[path.basename(entry.path, '.xml')] = (await ingest({ tenant, inputRoot: root, metadataJson: stable(metadata), storeRoot: path.join(root, 'store'), rights, profile })).bundle;
  }
});
after(async () => {
  const target = path.resolve(root);
  assert(target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('rag-v2-legal-dates-'));
  await fs.rm(target, { recursive: true, force: true });
});
const section = (bundle, number) => bundle.source_units.find(unit => unit.locator.path === `/oigusakt[1]/sisu[1]/paragrahv[${number}]`);
const legal = bundle => bundle.document.fields.legal_text.value;

test('Märjamaa: the birth grant\'s own note dates it, and the amendment that starts the version changed only the preamble', () => {
  const bundle = bundles[MARJAMAA], unit = section(bundle, 1), [birth, school, third] = unit.amendments;
  assert.equal(bundle.version.processing_config.normalization, 'source-structure-v30');
  // § 1 p 1 (sünnitoetus 500 + 300): in force 24.03.2026, applied from 01.01.2026; not 04.09.2026, the version's start.
  assert.deepEqual(birth, { provision: '§ 1 p 1', offset: unit.raw_text.indexOf('lapse aastaseks saamisel;') + 'lapse aastaseks saamisel;'.length,
    path: '/oigusakt[1]/sisu[1]/paragrahv[1]/loige[1]/alampunkt[1]/muutmismarge[1]', act_reference: '421022026007', rt: 'RT IV, 21.03.2026, 7',
    published: '2026-03-21', in_force: '2026-03-24', applies_from: '2026-01-01', note: 'rakendatakse alates 01.01.2026' });
  assert.match(unit.raw_text.slice(0, birth.offset), /sünnitoetus – esimene osa 500 eurot lapse kohta sünni registreerimisel ja teine osa 300 eurot lapse kohta lapse aastaseks saamisel;$/u);
  assert.deepEqual([school.provision, school.in_force, school.applies_from], ['§ 1 p 2', '2026-03-24', '2026-01-01']);
  assert.deepEqual([third.provision, third.act_reference, third.in_force, third.applies_from, third.note], ['§ 1 p 3', '428122024039', '2025-01-01', undefined, undefined]);
  // Every note lies inside its section's text, in the text's order.
  for (const item of bundle.source_units) {
    const offsets = (item.amendments || []).map(note => note.offset);
    assert(offsets.every((offset, index) => Number.isInteger(offset) && offset > 0 && offset <= item.raw_text.length && (index === 0 || offset >= offsets[index - 1])));
  }
  assert.equal(bundle.document.fields.valid_from.value, '2026-09-04');
  const text = legal(bundle);
  assert.deepEqual({ ...text, history: text.history.length, structure: text.structure.map(note => [note.target, note.in_force]) }, {
    schema_version: 'rag-v2/legal-text-1', text_kind: 'terviktekst', adopted: '2018-05-15', original_reference: '418052018022', original_published: '2018-05-18',
    act_in_force_from: '2018-07-01', version_from: '2026-09-04', history: 4,
    version_change: { in_force: '2026-09-04', acts: ['401092026001'], provisions: ['preambul'] },
    structure: [['pealkiri', '2024-09-23'], ['preambul', '2026-09-04']],
    entry_into_force: [{ provision: '§ 4', unit_index: 4, path: '/oigusakt[1]/sisu[1]/paragrahv[4]/loige[1]/sisuTekst[1]/tavatekst[1]', text: 'Määrus jõustub 1. juulil 2018.' }] });
  assert.deepEqual(text.history.at(-2), { act_reference: '421022026007', rt: 'RT IV, 21.03.2026, 7', published: '2026-03-21', in_force: '2026-03-24',
    adopted: '2026-03-17', applies_from: '2026-01-01', note: 'rakendatakse alates 01.01.2026' });
  assert.deepEqual(bundle.document.fields.legal_text.provenance, [{ kind: 'riigi_teataja_xml', asset_hash: bundle.version.source_hash, path: '/oigusakt[1]' }]);
  assert.deepEqual(bundle.report.field_provenance.legal_text, bundle.document.fields.legal_text.provenance);
  assert(!bundle.report.warnings.some(warning => warning.code === 'amendment_note_position_unresolved'));
});

test('Kuusalu: the limits in § 3 carry no note; the act\'s own provision says from when it is applied', () => {
  const bundle = bundles[KUUSALU], text = legal(bundle);
  assert.match(section(bundle, 3).raw_text, /Üür – kuni 12 eurot 1 m² kohta kuus\./u);
  assert(bundle.source_units.every(unit => unit.amendments === undefined), 'no section of the act has a note');
  // 15.09.2026 starts the version because the preamble changed; the regulation is applied from 01.05.2026 (§ 5 lg 1).
  assert.equal(bundle.document.fields.valid_from.value, '2026-09-15');
  assert.deepEqual({ ...text, history: text.history.map(note => note.act_reference), structure: text.structure.map(note => [note.target, note.in_force]) }, {
    schema_version: 'rag-v2/legal-text-1', text_kind: 'terviktekst', adopted: '2026-04-23', original_reference: '428042026001', original_published: '2026-04-28',
    act_in_force_from: '2026-05-01', version_from: '2026-09-15', history: ['410092026016'],
    version_change: { in_force: '2026-09-15', acts: ['410092026016'], provisions: ['preambul'] },
    structure: [['preambul', '2026-09-15']],
    entry_into_force: [{ provision: '§ 5 lg 1', unit_index: 5, path: '/oigusakt[1]/sisu[1]/paragrahv[5]/loige[1]/sisuTekst[1]/tavatekst[1]', text: 'Määrust rakendatakse alates 01.05.2026.' }] });
  assert.equal(bundle.source_units[text.entry_into_force[0].unit_index], section(bundle, 5));
});

test('text, retrieval text and embedding inputs are the v29 reader\'s, and the model sees exactly what it saw', () => {
  assert.equal(v29.reader, 'source-structure-v29');
  for (const [act, bundle] of Object.entries(bundles)) {
    const before = v29.acts[act];
    assert.deepEqual(bundle.chunks.map(chunk => ({ embedding_input_hash: chunk.embedding_input_hash, source_text_sha256: hash(chunk.source_text),
      retrieval_text_sha256: hash(chunk.retrieval_text) })), before.chunks, act);
    for (const chunk of bundle.chunks) assert.equal(chunk.embedding_input_hash, hash(stable([DEFAULT_CONFIG.embeddingInputVersion, chunk.retrieval_text])));
    // Every chunk as evidence: the source card and each excerpt are the v29 bundle's, so nothing new reaches the model
    // until the rendering of stage 2. The new data is in the bundle only.
    const evidence = bundle.chunks.map(chunk => sourceEntry(indexUnit(chunk, bundle, embeddingConfig()), bundle, 'ranked_seed', null));
    const { context } = modelProjection(evidence, { tenant, query_id: 'query-fixture', generation_id: 'generation-fixture' });
    assert.deepEqual(context, before.model_context, act);
    const seen = JSON.stringify([context, evidence.map(entry => [entry.source_metadata, entry.bibliography])]);
    for (const hidden of ['legal_text', 'amendments', 'rakendatakse alates 01.01.2026', '421022026007', '2026-03-24', 'act_in_force_from']) assert(!seen.includes(hidden), `${act} ${hidden}`);
  }
});

test('reader-compare: a stored version read again gives the same units, chunks, fields and metadata; a registry that is not the stored input fails', async () => {
  const manifest = path.join(root, 'manifest.json');
  await fs.writeFile(manifest, JSON.stringify({ tenant, acts: Object.entries(bundles).map(([act, bundle]) => ({ globaal_id: act, version_id: bundle.version.id, source_path: `oigusaktid/${act}.xml` })) }));
  const run = (...args) => spawnSync(process.execPath, ['scripts/rag-v2-reader-compare.mjs', ...args], { encoding: 'utf8' });
  const result = run('--store', path.join(root, 'store'), '--manifest', manifest, '--registry', root);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout), chunks = Object.values(bundles).reduce((sum, bundle) => sum + bundle.chunks.length, 0);
  assert.deepEqual({ ...report, notes: undefined }, { reader: 'source-structure-v30', stored_normalizations: { 'source-structure-v30': 2 }, acts: 2, identical_acts: 2,
    stored_chunks: chunks, embedding_inputs_already_stored: chunks, embedding_inputs_new: 0, registry_xml_differs_from_stored: 0, different: [], notes: undefined, position_unresolved_acts: [],
    in_force_before_publication_acts: [], act_in_force_before_publication_acts: [] });
  assert.deepEqual(report.notes, { unit_notes: 4, with_applies_from: 2, with_own_words: 2, repeals: 0, position_unresolved: 0, structure_notes: 3, history_entries: 5,
    acts_with_version_change: 2, acts_with_entry_into_force: 2, acts_with_adoption_note: 0, acts_without_act_in_force_from: 0 });
  // The re-ingest reads the registry. A register that names another municipality changes every chunk's retrieval text,
  // and so every embedding input, and the metadata the version is made from.
  const against = async (name, acts, options) => {
    await registry(path.join(root, name), acts, options);
    const result = run('--store', path.join(root, 'store'), '--manifest', manifest, '--registry', path.join(root, name)), report = JSON.parse(result.stdout);
    return [result.status, report.identical_acts, report.embedding_inputs_new, report.registry_xml_differs_from_stored, report.different.map(act => act.reasons)];
  };
  assert.deepEqual(await against('other', ACTS.map(([act]) => [act, 'teine_vald', 'Teine vald'])), [1, 0, chunks, 0, [['chunks', 'metadata'], ['chunks', 'metadata']]]);
  // The same name under another municipality ID leaves every chunk and embedding input the same and changes the act's
  // regions (the region filter, the source card): only the metadata tells, by its hash in the version ID.
  assert.deepEqual(await against('renamed', ACTS.map(([act, , name]) => [act, 'rapla_vald', name])), [1, 0, 0, 0, [['metadata'], ['metadata']]]);
  // A registry that does not name the act's file, or does not have it, proves nothing: the plan would not find the source.
  assert.deepEqual(await against('unlisted', ACTS, { sources: false }), [1, 2, 0, 2, []]);
  const absent = run('--store', path.join(root, 'store'), '--manifest', manifest, '--registry', path.join(root, 'store')), absentReport = JSON.parse(absent.stdout);
  assert.equal(absent.status, 1);
  assert.deepEqual([absentReport.identical_acts, absentReport.embedding_inputs_new, absentReport.registry_xml_differs_from_stored], [2, 0, 2]);
  // A field the reader reads differently from the stored version leaves the text and every chunk the same. Here the stored
  // ones are changed: Märjamaa's start is its publication day, and Kuusalu's validity has lost its open end, without which
  // the validity filter no longer takes the act as in force. Both are on the source card or in the validity filters.
  const altered = path.join(root, 'altered');
  await fs.cp(path.join(root, 'store'), altered, { recursive: true });
  const change = async (act, edit) => {
    const folder = path.join(altered, id('tenant', tenant), 'versions', bundles[act].version.id);
    const kept = JSON.parse(await fs.readFile(path.join(folder, 'bundle.json'), 'utf8')), files = JSON.parse(await fs.readFile(path.join(folder, 'manifest.json'), 'utf8'));
    edit(kept.document.fields);
    await fs.writeFile(path.join(folder, 'bundle.json'), JSON.stringify(kept));
    await fs.writeFile(path.join(folder, 'manifest.json'), JSON.stringify({ ...files, files: { ...files.files, 'bundle.json': hash(JSON.stringify(kept)) } }));
  };
  assert.equal(bundles[KUUSALU].document.fields.valid_to.open_end, true);
  await change(MARJAMAA, fields => { fields.valid_from.value = fields.publication_date.value; });
  await change(KUUSALU, fields => { fields.valid_to = { value: null, provenance: fields.valid_to.provenance.filter(source => source.basis !== 'validity_without_end') }; });
  const field = run('--store', altered, '--manifest', manifest, '--registry', root), fieldReport = JSON.parse(field.stdout);
  assert.equal(field.status, 1);
  assert.deepEqual([fieldReport.identical_acts, fieldReport.embedding_inputs_new, fieldReport.different.map(act => [act.act, act.reasons])],
    [0, 0, [[MARJAMAA, ['fields']], [KUUSALU, ['fields']]]]);
  const usage = run();
  assert.equal(usage.status, 1); assert.deepEqual(JSON.parse(usage.stderr), { ok: false, code: 'reader_compare_usage' });
});
