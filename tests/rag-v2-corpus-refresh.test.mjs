import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { hash } from '../lib/rag-v2/contracts.js';
import { autoReview, nextPolicy, registerDownloads, KNOWN_WARNINGS } from '../lib/rag-v2/corpus-refresh.js';

// ADR-059: committed Riigi Teataja XML (Kose with its rates annex, Põlva's two versions) in a temporary registry.
let dir;
before(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-corpus-refresh-')); });
after(async () => {
  const target = path.resolve(dir);
  assert(target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('rag-v2-corpus-refresh-'));
  await fs.rm(target, { recursive: true, force: true });
});

const KOSE = 'oigusaktid/430042026009.xml', POLVA = 'oigusaktid/426052026009.xml', NEW = 'oigusaktid/429092026004.xml';
const ANNEX = 'oigusaktid/lisad/430042026009-lisa.json', ANNEX_META = 'oigusaktid/lisad/430042026009-lisa.meta.json';
const row = file => `| ${file.split('/').pop()} | [${file}](<${file}>) |\n`;

async function registry(name) {
  const root = path.join(dir, name), from = path.join(dir, `${name}-from`);
  for (const file of [KOSE, POLVA, ANNEX, ANNEX_META]) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.copyFile(path.join('Andmebaasi', file), path.join(root, file));
  }
  const sha = async file => hash(await fs.readFile(path.join(root, file)));
  const entries = [
    { path: KOSE, category: 'oigusaktid', role: 'source', sha256: await sha(KOSE) },
    { path: POLVA, category: 'oigusaktid', role: 'source', sha256: await sha(POLVA) },
    { path: ANNEX, category: 'oigusaktid', role: 'source', sha256: await sha(ANNEX), metadata_path: ANNEX_META },
    { path: ANNEX_META, category: 'oigusaktid', role: 'metadata', sha256: await sha(ANNEX_META) },
    { path: 'teadmised/kose.knowledge.json', category: 'teadmised', role: 'knowledge', sha256: '0'.repeat(64), source_path: KOSE },
  ];
  await fs.mkdir(path.join(root, 'teadmised'), { recursive: true });
  await fs.writeFile(path.join(root, 'teadmised/kose.knowledge.json'), JSON.stringify({ source_path: KOSE, source_sha256: entries[0].sha256 }));
  await fs.writeFile(path.join(root, 'REGISTER.json'), `${JSON.stringify({ counts: { oigusaktid: { files: 4, sources: 3 } }, entries }, null, 2)}\n`);
  await fs.writeFile(path.join(root, 'REGISTER.md'), ['| Kaust | Allikafaile | Faile kokku | Kasutus |', '|---|---:|---:|---|',
    '| oigusaktid | 3 | 4 | XML-aktid. |', '', '| Fail | Tee |', '|---|---|', row(KOSE) + row(POLVA) + row(ANNEX) + row(ANNEX_META)].join('\n'));
  await fs.mkdir(from, { recursive: true });
  return { root, from, entries };
}

test('downloaded acts: a new one is added, changed bytes replace the registered file, its annex is derived again', async () => {
  const { root, from, entries } = await registry('register');
  // Riigi Teataja wrote a new metadata version into Kose's XML; Põlva's is unchanged; 429092026004 is new.
  const kose = (await fs.readFile(path.join('Andmebaasi', KOSE), 'utf8')).replace(/<metaandmedVersioon>\d+<\/metaandmedVersioon>/u, '<metaandmedVersioon>99</metaandmedVersioon>');
  await fs.writeFile(path.join(from, '430042026009.xml'), kose);
  await fs.copyFile(path.join('Andmebaasi', POLVA), path.join(from, '426052026009.xml'));
  await fs.copyFile(path.join('Andmebaasi', NEW), path.join(from, '429092026004.xml'));
  const previous = path.join(dir, 'register-previous');
  const result = await registerDownloads({ root, from, previous });
  assert.deepEqual([result.added, result.replaced, result.unchanged, result.annexes], [[NEW], [KOSE], [POLVA], [ANNEX]]);
  assert.deepEqual(result.selection, [{ source: NEW }, { source: KOSE }, { source: ANNEX }]);
  // The card on Kose's old bytes needs the re-anchor script; the old bytes are kept for it.
  assert.deepEqual(result.knowledge, ['teadmised/kose.knowledge.json']);
  assert.equal(hash(await fs.readFile(path.join(previous, KOSE))), entries[0].sha256);
  const register = JSON.parse(await fs.readFile(path.join(root, 'REGISTER.json'), 'utf8'));
  const entry = file => register.entries.find(item => item.path === file);
  assert.equal(entry(KOSE).sha256, hash(Buffer.from(kose)));
  assert.equal(hash(await fs.readFile(path.join(root, KOSE))), hash(Buffer.from(kose)));
  // The annex text is the same PDF of the same version; its metadata names the new XML hash.
  assert.equal(entry(ANNEX).sha256, entries[2].sha256);
  const meta = JSON.parse(await fs.readFile(path.join(root, ANNEX_META), 'utf8'));
  assert.equal(meta.rt_annex.xml_sha256, hash(Buffer.from(kose)));
  assert.equal(entry(ANNEX_META).sha256, hash(await fs.readFile(path.join(root, ANNEX_META))));
  assert.deepEqual(entry(NEW), { path: NEW, category: 'oigusaktid', role: 'source', sha256: hash(await fs.readFile(path.join('Andmebaasi', NEW))),
    original_path: 'riigiteataja.ee/et/akt/429092026004.xml', review_status: 'version_and_jurisdiction_validation_pending' });
  assert.equal(register.entries.indexOf(entry(NEW)), register.entries.indexOf(entry(POLVA)) + 1);
  assert.deepEqual(register.counts.oigusaktid, { files: 5, sources: 4 });
  const md = await fs.readFile(path.join(root, 'REGISTER.md'), 'utf8');
  assert.match(md, /^\| oigusaktid \| 4 \| 5 \| XML-aktid\. \|$/mu);
  assert(md.includes(row(POLVA) + row(NEW)));
  // Run again: everything is registered now.
  const again = await registerDownloads({ root, from });
  assert.deepEqual([again.added, again.replaced, again.annexes, again.selection], [[], [], [], []]);
});

test('a downloaded file must be the act its name says', async () => {
  const { root, from } = await registry('wrong-name');
  await fs.copyFile(path.join('Andmebaasi', NEW), path.join(from, '111111111111.xml'));
  await assert.rejects(registerDownloads({ root, from }), { code: 'refresh_not_the_named_act' });
});

// Codex R3 (30.09.2026): a stop part-way left replaced files beside the old registry, and the next run overwrote the
// kept previous bytes with the new ones, so the Kose card could not be rebound.
const koseChanged = async () => (await fs.readFile(path.join('Andmebaasi', KOSE), 'utf8'))
  .replace(/<metaandmedVersioon>\d+<\/metaandmedVersioon>/u, '<metaandmedVersioon>99</metaandmedVersioon>');

test('a file that fails its check stops the refresh before anything is written; the same command then completes it', async () => {
  const { root, from, entries } = await registry('stop');
  const registerBefore = await fs.readFile(path.join(root, 'REGISTER.json'), 'utf8');
  await fs.writeFile(path.join(from, '430042026009.xml'), await koseChanged());
  await fs.copyFile(path.join('Andmebaasi', NEW), path.join(from, '999999999999.xml'));
  const previous = path.join(dir, 'stop-previous');
  await assert.rejects(registerDownloads({ root, from, previous }), { code: 'refresh_not_the_named_act' });
  assert.equal(hash(await fs.readFile(path.join(root, KOSE))), entries[0].sha256);
  assert.equal(await fs.readFile(path.join(root, 'REGISTER.json'), 'utf8'), registerBefore);
  await assert.rejects(fs.access(previous));
  await fs.rm(path.join(from, '999999999999.xml'));
  const result = await registerDownloads({ root, from, previous });
  assert.deepEqual(result.replaced, [KOSE]);
  assert.equal(hash(await fs.readFile(path.join(previous, KOSE))), entries[0].sha256);
});

test('after a stop between the files and the registry, a second run keeps the previous bytes and completes', async () => {
  const { root, from, entries } = await registry('resume');
  const kose = await koseChanged(), previous = path.join(dir, 'resume-previous');
  await fs.writeFile(path.join(from, '430042026009.xml'), kose);
  // The state a stop leaves: the previous bytes kept, the new file written, the registry still naming the old bytes.
  await fs.mkdir(path.dirname(path.join(previous, KOSE)), { recursive: true });
  await fs.copyFile(path.join(root, KOSE), path.join(previous, KOSE));
  await fs.writeFile(path.join(root, KOSE), kose);
  const result = await registerDownloads({ root, from, previous });
  assert.deepEqual([result.replaced, result.annexes, result.knowledge], [[KOSE], [ANNEX], ['teadmised/kose.knowledge.json']]);
  assert.equal(hash(await fs.readFile(path.join(previous, KOSE))), entries[0].sha256);
  const register = JSON.parse(await fs.readFile(path.join(root, 'REGISTER.json'), 'utf8'));
  assert.equal(register.entries.find(entry => entry.path === KOSE).sha256, hash(Buffer.from(kose)));
  // Without the kept bytes and with the old ones gone from disk, nothing is written: the card could not be rebound.
  const lost = await registry('lost');
  await fs.writeFile(path.join(lost.from, '430042026009.xml'), kose);
  await fs.writeFile(path.join(lost.root, KOSE), kose);
  const registerBefore = await fs.readFile(path.join(lost.root, 'REGISTER.json'), 'utf8');
  await assert.rejects(registerDownloads({ root: lost.root, from: lost.from, previous: path.join(dir, 'lost-previous') }), { code: 'refresh_registered_bytes_missing' });
  assert.equal(await fs.readFile(path.join(lost.root, 'REGISTER.json'), 'utf8'), registerBefore);
  assert.equal(await fs.readFile(path.join(lost.root, ANNEX_META), 'utf8'), await fs.readFile(path.join('Andmebaasi', ANNEX_META), 'utf8'));
});

const item = (id, fields, warnings = [], blockers = []) => ({ item_id: id, document_id: `document_${id}`, version_id: `version_${id}`, warnings, blockers,
  decision: 'pending', note: '', fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { value }])) });
const draft = items => ({ schema_version: 1, tenant: 't', batch_id: 'b', base_generation: 'g', reviewed_by: '', items, evidence_sha256: 'e' });

test('a clean draft is reviewed without hand edits; anything a person has to decide holds the review', () => {
  const clean = item('1', { act_reference: '1', authority: 'Tartu Linnavolikogu', municipality_name: 'Tartu linn', valid_from: '2026-07-01', title: 'Kord' });
  const annex = item('2', { authority: 'Saku Vallavolikogu', municipality_name: 'Saku vald', valid_from: '2026-02-01', title: 'Lisa' }, [{ code: 'collected_package_text' }]);
  const national = item('3', { authority: 'Riigikogu', valid_from: '2027-01-01', title: 'Seadus' });
  const { review } = autoReview(draft([clean, annex, national]), { reviewer: 'Claude (omanik 30.09: jätka arendust)' });
  assert.equal(review.reviewed_by, 'Claude (omanik 30.09: jätka arendust)');
  assert.deepEqual(review.items.map(i => [i.decision, i.note]), [['include', ''], ['include', KNOWN_WARNINGS.collected_package_text], ['include', '']]);
  const held = autoReview(draft([clean, item('4', { authority: 'Uus Vallavolikogu', valid_from: '2026-01-01', title: 'Kord' }),
    item('5', { authority: 'Riigikogu', title: 'Seadus' }), item('6', { authority: 'Riigikogu', valid_from: '2026-01-01', title: 'Seadus' }, [{ code: 'title_not_matched_in_pdf' }]),
    item('7', { authority: 'Riigikogu', valid_from: '2026-01-01', title: 'Seadus' }, [], [{ code: 'source_text_empty' }])]), { reviewer: 'x' });
  assert.deepEqual(held.held.map(h => [h.item_id, h.reasons]), [['4', ['municipality_unresolved']], ['5', ['valid_from_missing']],
    ['6', ['title_not_matched_in_pdf']], ['7', ['blocker:source_text_empty']]]);
  assert.throws(() => autoReview(draft([clean]), { reviewer: ' ' }), { code: 'refresh_reviewer_required' });
});

test('the next policy adds the reviewed documents that are in the store head, and nothing the head lacks', () => {
  const active = { documents: { d1: { version_id: 'v1' }, document_2: { version_id: 'version_2' } } };
  const review = { items: [{ document_id: 'document_2', version_id: 'version_2', decision: 'include' }] };
  const next = nextPolicy({ tenants: { t: { operator: ['d1'] } } }, review, active, 't');
  assert.deepEqual(next, { policy: { tenants: { t: { operator: ['d1', 'document_2'] } } }, added: 1, removed: [], versions: ['version_2'] });
  // An act a newer one replaced leaves the policy with its reason; the store keeps it.
  const replaced = nextPolicy({ tenants: { t: { operator: ['d1'] } } }, review, active, 't', [{ document_id: 'd1', reason: '107 replaced_by_newer 101' }]);
  assert.deepEqual([replaced.policy.tenants.t.operator, replaced.added, replaced.removed.length], [['document_2'], 1, 1]);
  assert.throws(() => nextPolicy({ tenants: { t: { operator: ['d1'] } } }, review, active, 't', [{ document_id: 'gone', reason: 'x' }]), { code: 'refresh_remove_not_in_policy' });
  assert.throws(() => nextPolicy({ tenants: { t: { operator: ['d1', 'document_2'] } } }, review, active, 't', [{ document_id: 'document_2', reason: 'x' }]), { code: 'refresh_remove_reviewed' });
  assert.throws(() => nextPolicy({ tenants: { t: { operator: ['d1'] } } }, review, active, 't', [{ document_id: 'd1' }]), { code: 'refresh_remove_invalid' });
  assert.throws(() => nextPolicy({ tenants: { t: { operator: ['d1'] } } }, { items: [{ document_id: 'document_2', version_id: 'version_3', decision: 'include' }] }, active, 't'),
    { code: 'refresh_version_not_in_head' });
  assert.throws(() => nextPolicy({ tenants: { t: { operator: ['gone'] } } }, review, active, 't'), { code: 'refresh_policy_document_not_in_head' });
});

test('the package holds the store head and the new versions, with the hash and head generations the server run checks', async () => {
  const { spawnSync } = await import('node:child_process');
  const { id } = await import('../lib/rag-v2/contracts.js');
  const store = path.join(dir, 'store'), tenantDir = path.join(store, id('tenant', 't')), work = path.join(dir, 'package');
  await fs.mkdir(path.join(tenantDir, 'publications'), { recursive: true });
  await fs.mkdir(path.join(tenantDir, 'versions', 'version_b'), { recursive: true });
  await fs.mkdir(path.join(tenantDir, 'versions', 'version_old'), { recursive: true });
  await fs.writeFile(path.join(tenantDir, 'active.json'), JSON.stringify({ schema_version: 'rag-v2/catalog-1', tenant_id: 't', generation: 'generation_new',
    documents: { d1: { version_id: 'version_a' }, document_2: { version_id: 'version_b' } } }));
  await fs.writeFile(path.join(tenantDir, 'publications', 'receipt.json'), '{}');
  await fs.writeFile(path.join(tenantDir, 'versions', 'version_b', 'bundle.json'), '{}');
  await fs.writeFile(path.join(tenantDir, 'versions', 'version_old', 'bundle.json'), '{}');
  await fs.mkdir(work, { recursive: true });
  await fs.writeFile(path.join(work, 'previous-policy.json'), JSON.stringify({ tenants: { t: { operator: ['d1'] } } }));
  await fs.writeFile(path.join(work, 'review.json'), JSON.stringify({ base_generation: 'generation_old',
    items: [{ document_id: 'document_2', version_id: 'version_b', decision: 'include' }] }));
  const run = spawnSync(process.execPath, ['scripts/rag-v2-corpus-refresh.mjs', 'package', '--store', store, '--tenant', 't', '--policy', path.join(work, 'previous-policy.json'),
    '--review', path.join(work, 'review.json'), '--out', path.join(work, 'out')], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const info = JSON.parse(await fs.readFile(path.join(work, 'out', 'ship.json'), 'utf8'));
  assert.equal(info.sha256, hash(await fs.readFile(path.join(work, 'out', 'ship.tgz'))));
  assert.deepEqual([info.base_generation, info.head_generation, info.policy_documents, info.added_documents, info.versions], ['generation_old', 'generation_new', 2, 1, 1]);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(work, 'out', 'policy.json'), 'utf8')), { tenants: { t: { operator: ['d1', 'document_2'] } } });
  const listed = spawnSync('tar', ['tzf', 'ship.tgz'], { cwd: path.join(work, 'out'), encoding: 'utf8' }).stdout.split(/\r?\n/u).filter(Boolean).map(name => name.replace(/\/$/u, '')).sort();
  assert.deepEqual(listed, ['active.json', 'publications', 'publications/receipt.json', 'versions/version_b', 'versions/version_b/bundle.json']);
});
