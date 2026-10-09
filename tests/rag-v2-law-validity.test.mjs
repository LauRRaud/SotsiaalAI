import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { actsEnding, analyseGroup, coverage, exitCode, groupsInForce, groupStatus, municipalCoverage } from '../lib/rag-v2/law-validity.js';

// ADR-038: the legal texts of the active corpus against Riigi Teataja.
const window = { from: '2026-09-27', to: '2027-10-31' };
const v = (id, from, to = null) => ({ id, from, to });
const RLS = [v('109042026003', '2026-04-10', '2026-06-11'), v('103062026020', '2026-06-12', '2026-07-18'), v('111072026165', '2026-07-19', '2026-07-31'),
  v('111072026166', '2026-08-01', '2026-10-30'), v('111072026167', '2026-11-01', '2026-12-31'), v('111072026168', '2027-01-01', '2027-06-30'), v('111072026169', '2027-07-01')];

test('municipal coverage names a register municipality with no indexed act in force on the day', () => {
  const acts = [{ regions: ['a_vald'], index_from: '2020-01-01', index_to: null }, { regions: ['b_vald'], index_from: '2020-01-01', index_to: '2026-09-29' },
    { regions: ['c_linn'], index_from: '2026-10-01', index_to: null }];
  const register = [{ municipality_id: 'a_vald', municipality_name: 'A vald' }, { municipality_id: 'b_vald', municipality_name: 'B vald' },
    { municipality_id: 'c_linn', municipality_name: 'C linn', legacy_metadata: {} }];
  // An ended act and one that starts later do not cover today.
  assert.deepEqual(municipalCoverage(acts, register, '2026-09-30'), { municipalities: 3,
    without_current_act: [{ municipality_id: 'b_vald', municipality_name: 'B vald' }, { municipality_id: 'c_linn', municipality_name: 'C linn' }] });
  assert.deepEqual(municipalCoverage(acts, register, '2026-10-01').without_current_act.map(entry => entry.municipality_id), ['b_vald']);
});

test('coverage finds the one uncovered day, holes that began earlier, overlaps and an end within the horizon', () => {
  assert.deepEqual(coverage(RLS, window), { gaps: [{ from: '2026-10-31', to: '2026-10-31' }], overlaps: [], ends_on: null });
  assert.deepEqual(coverage([v('a', '2026-01-01', '2026-06-11'), v('b', '2026-10-15')], window).gaps, [{ from: '2026-09-27', to: '2026-10-14' }]);
  // A stale end date in the corpus shows up as an overlap with the version that replaced it.
  assert.deepEqual(coverage([v('stale', '2026-04-10', '2026-12-31'), v('new', '2026-08-01', '2026-10-30')], window).overlaps,
    [{ a: 'stale', b: 'new', from: '2026-09-27', to: '2026-10-30' }]);
  assert.equal(coverage([v('jan', '2027-01-01', '2027-01-31'), v('dec', '2026-12-01', '2026-12-31')], window).ends_on, '2027-01-31');
  assert.equal(coverage([v('ended', '2025-01-01', '2026-05-28')], window).ends_on, '2026-05-28');
  assert.equal(coverage([v('long ago', '2020-01-01', '2021-12-31')], window).ends_on, null);
  assert.deepEqual(coverage([v('future', '2027-01-01')], window), { gaps: [], overlaps: [], ends_on: null });
});

test('a group reports changed validity, missing versions, gaps and overlaps, and asks a person about an ending group', () => {
  const corpus = [{ globaal_id: '109042026003', document_id: 'd1', index_from: '2026-04-10', index_to: '2026-12-31' },
    { globaal_id: '111072026166', document_id: 'd2', index_from: '2026-08-01', index_to: '2026-10-30' }];
  const current = { 109042026003: { from: '2026-04-10', to: '2026-06-11' }, 111072026166: { from: '2026-08-01', to: '2026-10-30' } };
  const published = RLS.map(x => ({ globaal_id: x.id, from: x.from, to: x.to }));
  const result = analyseGroup({ group: '1027446', corpus, current, published, searched: true, today: window.from, horizon: window.to });
  const kinds = result.findings.map(f => f.kind);
  assert.deepEqual(result.findings.find(f => f.kind === 'validity_changed'), { kind: 'validity_changed', globaal_id: '109042026003', document_id: 'd1',
    index: '2026-04-10..2026-12-31', riigi_teataja: '2026-04-10..2026-06-11' });
  assert.deepEqual(result.findings.filter(f => f.kind === 'missing_version').map(f => f.globaal_id), ['111072026167', '111072026168', '111072026169']);
  assert(kinds.includes('riigi_teataja_gap') && kinds.includes('corpus_overlap'));
  assert.deepEqual(result.review, []);
  assert.equal(groupStatus(result), 'changed');
  const ending = analyseGroup({ group: 'g', corpus: [{ globaal_id: 'x', document_id: 'd', index_from: '2025-01-01', index_to: '2026-05-28' }],
    current: { x: { from: '2025-01-01', to: '2026-05-28' } }, published: [{ globaal_id: 'x', from: '2025-01-01', to: '2026-05-28' }], searched: true,
    today: window.from, horizon: window.to, replacements: [{ globaal_id: 'y', group: 'h', from: '2026-05-29', to: null, paragraphs: 23 }] });
  assert.deepEqual(ending.findings, []);
  assert.deepEqual(ending.review.map(r => r.kind), ['group_ends', 'replacement_candidate']);
  assert.equal(groupStatus(ending), 'review');
  // An act of the same issuer starting the next day proves no replacement, even when the corpus has it (Codex, #218 P1).
  const nearby = analyseGroup({ group: 'g', corpus: [{ globaal_id: 'x', document_id: 'd', index_from: '2025-01-01', index_to: '2026-05-28' }],
    current: { x: { from: '2025-01-01', to: '2026-05-28' } }, published: [{ globaal_id: 'x', from: '2025-01-01', to: '2026-05-28' }], searched: true,
    today: window.from, horizon: window.to, replacements: [{ globaal_id: 'y', group: 'h', from: '2026-05-29', to: null, in_corpus: true }] });
  assert.deepEqual([nearby.review.map(r => [r.kind, r.in_corpus]), nearby.notes], [[['group_ends', undefined], ['replacement_candidate', true]], []]);
  assert.equal(groupStatus(nearby), 'review');
  // Riigi Teataja's repeal stub ends the group; the act that repealed it answers the question when the corpus has it.
  const stubbed = repealedBy => analyseGroup({ group: 'g', corpus: [{ globaal_id: 'x', document_id: 'd', index_from: '2025-01-01', index_to: '2026-05-28' }],
    current: { x: { from: '2025-01-01', to: '2026-05-28' } }, searched: true, today: window.from, horizon: window.to,
    published: [{ globaal_id: 'x', from: '2025-01-01', to: '2026-05-28' }, { globaal_id: 's', from: '2026-05-29', to: null, repealed: true, repealed_by: 'n', repealed_by_in_corpus: repealedBy }] });
  assert.deepEqual([stubbed(true).findings, stubbed(true).review, stubbed(true).notes], [[], [], [{ kind: 'replaced_in_corpus', on: '2026-05-28', repeal_stub: 's', repealed_by: 'n' }]]);
  assert.deepEqual([stubbed(false).findings, stubbed(false).review.map(r => [r.kind, r.repealed_by])], [[], [['group_repealed', 'n']]]);
  // The same act listed twice by a search is one version, not an overlap with itself.
  assert.deepEqual(analyseGroup({ group: 'g', corpus: [], current: {}, searched: true, today: window.from, horizon: window.to,
    published: [{ globaal_id: 'z', from: '2020-01-01', to: null }, { globaal_id: 'z', from: '2020-01-01', to: null }] }).findings.map(f => f.kind), ['missing_version']);
  const lost = analyseGroup({ group: 'g', corpus: [], current: {}, published: [], searched: false, today: window.from, horizon: window.to });
  assert.deepEqual(lost.review.map(r => r.kind), ['search_miss']);
  assert.equal(groupStatus({ ...lost, errors: [{ error: 'timeout' }] }), 'fetch_failed');
  assert.equal(exitCode([{ findings: [], review: [] }]), 0);
  assert.equal(exitCode([{ findings: [], review: [{}] }]), 10);
  assert.equal(exitCode([{ findings: [{}], review: [], errors: [{ error: 'http_503' }] }]), 20);
});

// A small Riigi Teataja: current XML per act and the search API, which, like the real one, orders a result set
// differently on every request (pages overlap and miss acts). One act always fails; one title's page 2 always
// repeats page 1 in the same order, so its results never add up.
function riigiTeataja() {
  const xml = (id, group, from, to, title, repealedBy) => `<?xml version="1.0"?><oigusakt><metaandmed><valjaandja>Riigikogu</valjaandja><tekstiliik>terviktekst</tekstiliik>`
    + `<kehtivus><kehtivuseAlgus>${from}</kehtivuseAlgus>${to ? `<kehtivuseLopp>${to}+03:00</kehtivuseLopp>` : ''}</kehtivus>`
    + `<globaalID>${id}</globaalID><terviktekstiGrupiID>${group}</terviktekstiGrupiID></metaandmed><aktinimi><nimi><pealkiri>${title}</pealkiri></nimi></aktinimi>`
    + (repealedBy ? `<muutmismarge><tavatekst>Kehtetu</tavatekst><avaldamismarge><aktViide>${repealedBy}</aktViide></avaldamismarge></muutmismarge><sisu/>`
      : '<sisu><paragrahv><loige>tekst</loige></paragrahv></sisu>') + '</oigusakt>';
  const rt = (id, group, title, issuer, from, to = null) => ({ globaalID: Number(id), terviktekstID: group, pealkiri: title, valjaandja: issuer,
    tekst: 'terviktekst', mitteJoustunud: false, kehtivus: { algus: from, lopp: to } });
  const filler = (issuer, from, title) => Array.from({ length: 519 }, (_, i) => rt(from + i, from + i, `${title} ${i}`, issuer, '2020-01-01'));
  const acts = [...RLS.map(x => rt(x.id, 1027446, 'Riigilõivuseadus', 'Riigikogu', x.from, x.to)), rt(105, 55, 'Muutumatu seadus', 'Riigikogu', '2020-01-01'),
    rt(200, 66, 'Sotsiaaltoetuste kord', 'Suur vald', '2020-01-01'), ...filler('Suur vald', 10000, 'Sotsiaaltoetuste määr'),
    rt(300, 77, 'Kinnisvara toetuste kord', 'Kinni vald', '2020-01-01'), ...filler('Kinni vald', 20000, 'Kinnisvara toetuste kord'),
    rt(400, 99, 'Vana kord', 'Väike vald', '2020-01-01', '2026-05-28'), { ...rt(401, 99, 'Vana kord', 'Väike vald', '2026-05-29'), repealedBy: '402' },
    rt(402, 98, 'Uus kord', 'Väike vald', '2026-05-29'),
    rt(410, 90, 'Lõppev kord', 'Keskmine vald', '2020-01-01', '2026-09-26'), rt(411, 91, 'Sotsiaalosakonna töökord', 'Keskmine vald', '2026-09-27'),
    rt(450, 95, 'Mahajäetud kord', 'Väike vald', '2020-01-01', '2026-09-26'), { ...rt(451, 95, 'Mahajäetud kord', 'Väike vald', '2026-09-27'), repealedBy: '452' },
    rt(452, 94, 'Asenduskord', 'Väike vald', '2026-09-27'),
    rt(460, 96, 'Kadunud kord', 'Väike vald', '2020-01-01'), { ...rt(461, 96, 'Kadunud kord', 'Väike vald', '2027-01-01'), noXml: true }];
  return http.createServer((request, response) => {
    const url = new URL(request.url, 'http://x');
    const act = url.pathname.match(/^\/et\/akt\/(\d+)\.xml$/);
    if (act?.[1] === '999') { response.writeHead(503); return response.end(); }
    if (act) {
      const found = acts.find(a => String(a.globaalID) === act[1]);
      if (!found || found.noXml) { response.writeHead(404); return response.end(); }
      response.writeHead(200, { 'content-type': 'application/xml' });
      return response.end(xml(act[1], found.terviktekstID, found.kehtivus.algus, found.kehtivus.lopp, found.pealkiri, found.repealedBy));
    }
    if (url.pathname === '/api/oigusakt_otsing/1/otsi') {
      const q = url.searchParams, limit = Number(q.get('limiit')), page = Number(q.get('leht'));
      if (q.get('pealkiri').startsWith('Puuduv')) { response.writeHead(404); return response.end(); }
      if (q.get('pealkiri').startsWith('Vigane')) { response.writeHead(200, { 'content-type': 'application/json' }); return response.end('{"staatus":"VIGA"}'); }
      const stuck = q.get('pealkiri').startsWith('Kinnisvara'), served = stuck ? 1 : page;
      const matching = acts.filter(a => a.pealkiri.toLowerCase().includes(q.get('pealkiri').toLowerCase()) && (!q.get('valjaandja') || a.valjaandja === q.get('valjaandja')))
        .map(a => [stuck ? 0 : Math.random(), a]).sort((x, y) => x[0] - y[0]).map(([, a]) => a);
      response.writeHead(200, { 'content-type': 'application/json' });
      return response.end(JSON.stringify({ metaandmed: { kokku: matching.length, leht: page, limiit: limit }, aktid: matching.slice((served - 1) * limit, served * limit) }));
    }
    response.writeHead(404); response.end();
  });
}
const cli = (args, env, node = []) => new Promise(resolve => {
  const child = spawn(process.execPath, [...node, 'scripts/rag-v2-law-validity.mjs', ...args], { env: { ...process.env, ...env } });
  let stdout = '', stderr = '';
  child.stdout.on('data', d => { stdout += d; }); child.stderr.on('data', d => { stderr += d; });
  child.on('close', code => resolve({ code, stdout, stderr }));
});

test('the check writes a repeatable report and tells a failed request apart from an unchanged source', async () => {
  const server = riigiTeataja(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-law-validity-'));
  const env = { RAG_V2_RT_BASE: `http://127.0.0.1:${server.address().port}`, RAG_V2_RT_PAUSE_MS: '0' };
  const manifest = async (name, acts) => { const file = path.join(dir, name); await fs.writeFile(file, JSON.stringify({ store_generation: 'g', acts })); return file; };
  const act = (id, group, title, from, to, issuer = 'Riigikogu') => ({ document_id: `d${id}`, globaal_id: id, group, title, issuer, regions: [], index_from: from, index_to: to });
  try {
    const clean = await cli(['check', '--manifest', await manifest('clean.json', [act('105', '55', 'Muutumatu seadus', '2020-01-01', null)]),
      '--out', path.join(dir, 'clean'), '--today', '2026-09-27'], env);
    assert.equal(clean.code, 0, clean.stderr); assert.equal(JSON.parse(clean.stdout).summary.unchanged, 1);
    // A municipality of the register with no indexed act in force is a finding while every group is unchanged.
    const register = path.join(dir, 'kov.json');
    await fs.writeFile(register, JSON.stringify({ entries: [{ municipality_id: 'muutumatu_vald', municipality_name: 'Muutumatu vald' },
      { municipality_id: 'puuduv_vald', municipality_name: 'Puuduv vald' }] }));
    const covered = await cli(['check', '--manifest', await manifest('covered.json', [{ ...act('105', '55', 'Muutumatu seadus', '2020-01-01', null), regions: ['muutumatu_vald'] }]),
      '--out', path.join(dir, 'covered'), '--today', '2026-09-27', '--municipalities', register], env);
    assert.equal(covered.code, 10, covered.stderr);
    assert.deepEqual(JSON.parse(covered.stdout), { today: '2026-09-27', groups: 1, summary: { unchanged: 1 }, municipalities_without_current_act: 1, exit: 10 });
    assert.match(await fs.readFile(path.join(dir, 'covered', 'law-validity-2026-09-27.md'), 'utf8'), /kehtiva aktita indeksis: 1 \/ 2\r?\n\r?\n- Puuduv vald \(puuduv_vald\)/);
    // A repealed act whose repealing act the corpus has: explained in the report, not a missing text.
    const repealed = await cli(['check', '--manifest', await manifest('repealed.json', [act('400', '99', 'Vana kord', '2020-01-01', '2026-05-28', 'Väike vald'),
      act('402', '98', 'Uus kord', '2026-05-29', null, 'Väike vald')]), '--out', path.join(dir, 'repealed'), '--today', '2026-09-27'], env);
    assert.equal(repealed.code, 0, repealed.stdout + repealed.stderr);
    const explained = JSON.parse(await fs.readFile(path.join(dir, 'repealed', 'law-validity-2026-09-27.json'), 'utf8')).groups[0];
    assert.deepEqual(explained.notes, [{ kind: 'replaced_in_corpus', on: '2026-05-28', repeal_stub: '401', repealed_by: '402' }]);
    // Codex #218: a nearby act in the corpus stays a candidate; a repeal stub found again by the replacement search
    // stays a stub, so a person is asked for the repealing act and the empty record is never offered as a text.
    const reviewed = await cli(['check', '--manifest', await manifest('review.json', [act('410', '90', 'Lõppev kord', '2020-01-01', '2026-09-26', 'Keskmine vald'),
      act('411', '91', 'Sotsiaalosakonna töökord', '2026-09-27', null, 'Keskmine vald'), act('450', '95', 'Mahajäetud kord', '2020-01-01', '2026-09-26', 'Väike vald')]),
    '--out', path.join(dir, 'review'), '--today', '2026-09-27'], env);
    assert.equal(reviewed.code, 10, reviewed.stdout + reviewed.stderr);
    const [ending, , repealedGroup] = JSON.parse(await fs.readFile(path.join(dir, 'review', 'law-validity-2026-09-27.json'), 'utf8')).groups;
    assert.deepEqual([ending.status, ending.notes, ending.review.map(r => [r.kind, r.globaal_id, r.in_corpus])],
      ['review', [], [['group_ends', undefined, undefined], ['replacement_candidate', '411', true]]]);
    assert.deepEqual([repealedGroup.status, repealedGroup.findings, repealedGroup.review.map(r => [r.kind, r.repeal_stub, r.repealed_by])],
      ['review', [], [['group_repealed', '451', '452']]]);
    const rls = await cli(['check', '--manifest', await manifest('rls.json', [act('111072026166', '1027446', 'Riigilõivuseadus', '2026-08-01', '2026-10-30'),
      act('111072026167', '1027446', 'Riigilõivuseadus', '2026-11-01', '2026-12-31'), act('111072026168', '1027446', 'Riigilõivuseadus', '2027-01-01', '2027-06-30'),
      act('111072026169', '1027446', 'Riigilõivuseadus', '2027-07-01', null)]), '--out', path.join(dir, 'rls'), '--today', '2026-09-27'], env);
    assert.equal(rls.code, 10, rls.stderr);
    const report = JSON.parse(await fs.readFile(path.join(dir, 'rls', 'law-validity-2026-09-27.json'), 'utf8'));
    assert.deepEqual(report.groups[0].findings.map(f => f.kind).sort(), ['corpus_gap', 'riigi_teataja_gap']);
    assert.match(await fs.readFile(path.join(dir, 'rls', 'law-validity-2026-09-27.md'), 'utf8'), /riigi_teataja_gap.*2026-10-31/);
    // 520 results over two pages in a new order on every request: the pages are fetched again until all are found.
    const large = await cli(['check', '--manifest', await manifest('large.json', [act('200', '66', 'Sotsiaaltoetuste kord', '2020-01-01', null, 'Suur vald')]),
      '--out', path.join(dir, 'large'), '--today', '2026-09-27'], env);
    assert.equal(large.code, 0, large.stdout + large.stderr);
    const failing = await cli(['check', '--manifest', await manifest('fail.json', [act('999', '88', 'Katkine seadus', '2020-01-01', null),
      act('300', '77', 'Kinnisvara toetuste kord', '2020-01-01', null, 'Kinni vald'), act('105', '55', 'Muutumatu seadus', '2020-01-01', null),
      act('460', '96', 'Kadunud kord', '2020-01-01', null, 'Väike vald'), act('105', '57', 'Puuduv otsing', '2020-01-01', null),
      act('105', '58', 'Vigane vastus', '2020-01-01', null)]), '--out', path.join(dir, 'fail'), '--today', '2026-09-27'], env);
    assert.equal(failing.code, 20);
    const failed = JSON.parse(await fs.readFile(path.join(dir, 'fail', 'law-validity-2026-09-27.json'), 'utf8'));
    assert.deepEqual(failed.groups.map(g => g.status), ['fetch_failed', 'fetch_failed', 'unchanged', 'fetch_failed', 'fetch_failed', 'fetch_failed']);
    assert.deepEqual(failed.groups[0].errors.map(e => e.error), ['http_503']);
    // Results that never add up are a failure, not an unchanged source.
    assert(failed.groups[1].errors.some(e => e.error === 'incomplete_results'), JSON.stringify(failed.groups[1].errors));
    // A 404 for a version Riigi Teataja lists, or for a search, and a search answer without a total are failures (Codex #218).
    assert.deepEqual(failed.groups.slice(3).map(g => g.errors.map(e => e.error)), [['not_found'], ['not_found'], ['invalid_response']]);
    assert.equal(failed.groups[3].errors[0].url, '/et/akt/461.xml');
  } finally { server.close(); await fs.rm(dir, { recursive: true, force: true }); }
});

// ADR-124: what the manifest alone shows about the coming weeks. Today is 10.10.2026; 90 days reach 08.01.2027.
const indexed = (id, group, from, to, extra = {}) => ({ document_id: `d${id}`, globaal_id: id, group, title: `Seadus ${group}`, issuer: 'Riigikogu', regions: [],
  index_from: from, index_to: to, ...extra });
const council = { title: 'Abi andmise kord', issuer: 'Suure Vallavolikogu', regions: ['suur_vald'] };
const INDEXED = [indexed('1', 'open', '2020-01-01', null), indexed('2', 'ends', '2026-06-12', '2026-10-31'),
  // The next version is indexed and starts the day after: nothing ends.
  indexed('3', 'continues', '2026-10-01', '2026-12-31'), indexed('4', 'continues', '2027-01-01', null),
  // One uncovered day between two indexed versions.
  indexed('5', 'gap', '2026-08-01', '2026-10-30'), indexed('6', 'gap', '2026-11-01', null),
  // The same uncovered day, and what resumes stops inside the horizon too.
  indexed('21', 'twice', '2026-08-01', '2026-10-30'), indexed('22', 'twice', '2026-11-01', '2026-12-31'),
  // Two versions that follow each other, then nothing for two months.
  indexed('7', 'chain', '2026-01-01', '2026-10-31'), indexed('8', 'chain', '2026-11-01', '2026-11-30'), indexed('9', 'chain', '2027-02-01', null),
  // A stale end date beside a shorter version: the later end is the last day.
  indexed('10', 'stale', '2026-04-10', '2026-12-31'), indexed('11', 'stale', '2026-08-01', '2026-10-30'),
  // The horizon's last day covered, and one day short of it.
  indexed('12', 'edge', '2026-01-01', '2027-01-08'), indexed('13', 'short', '2026-01-01', '2027-01-07'),
  // Not in force today: ended yesterday, or still to start.
  indexed('14', 'past', '2020-01-01', '2026-10-09'), indexed('15', 'future', '2027-01-01', null),
  // An act without a group is its own; today is its last day.
  indexed('16', null, '2026-01-01', '2026-10-10', { title: 'Üksik akt' }),
  // A municipal procedure that ends, the same council's new act from the next day, another council's, and an act of
  // the same municipality's government.
  indexed('17', 'kord', '2025-09-07', '2026-12-31', council), indexed('18', 'uus', '2027-01-01', null, council),
  indexed('19', 'naaber', '2027-01-01', null, { ...council, issuer: 'Väikese Vallavolikogu', regions: ['vaike_vald'] }),
  indexed('20', 'maarad', '2026-01-01', '2026-12-31', { ...council, title: 'Toetuste määrad 2026. aastal', issuer: 'Suure Vallavalitsus' })];

test('acts ending: the groups in force today that have no indexed version on some day of the horizon, national first', () => {
  const ending = actsEnding(INDEXED, '2026-10-10', 90);
  assert.deepEqual(ending.map(act => [act.group, act.last_day, act.days_left, act.resumes_on, act.gap_days, act.ends_again_on]), [['act:16', '2026-10-10', 0, null, null, null],
    ['gap', '2026-10-30', 20, '2026-11-01', 1, null], ['twice', '2026-10-30', 20, '2026-11-01', 1, '2026-12-31'], ['ends', '2026-10-31', 21, null, null, null],
    ['chain', '2026-11-30', 51, '2027-02-01', 62, null], ['stale', '2026-12-31', 82, null, null, null], ['short', '2027-01-07', 89, null, null, null],
    ['kord', '2026-12-31', 82, null, null, null], ['maarad', '2026-12-31', 82, null, null, null]]);
  assert.deepEqual(ending[3], { group: 'ends', globaal_id: '2', title: 'Seadus ends', issuer: 'Riigikogu', regions: [], last_day: '2026-10-31', days_left: 21,
    resumes_on: null, gap_days: null, ends_again_on: null, candidates: [] });
  // A council's new group from the next day is named beside its ended one, which stays listed. Another issuer's is not,
  // and a national act gets none: the parliament's law that starts on 01.01.2027 ("future") says nothing about "stale".
  assert.deepEqual(ending.filter(act => act.candidates.length).map(act => [act.group, act.regions, act.candidates]),
    [['kord', ['suur_vald'], [{ group: 'uus', title: 'Abi andmise kord', same_title: true }]]]);
  const groups = (today, days) => actsEnding(INDEXED, today, days).map(act => act.group);
  // The horizon's last day counts: a group is listed from the horizon that first reaches a day without it.
  assert.deepEqual([groups('2026-10-10', 0), groups('2026-10-10', 20), groups('2026-10-10', 21)], [[], ['act:16'], ['act:16', 'gap', 'twice']]);
  // On its uncovered day a group is not in force and not listed (the check reports that as a corpus gap); from the
  // day its open version starts nothing ends.
  assert.deepEqual([groups('2026-10-31', 90).includes('gap'), groups('2026-11-01', 90).includes('gap')], [false, false]);
  assert.deepEqual([groupsInForce(INDEXED, '2026-10-10'), groupsInForce(INDEXED, '2027-01-01')], [{ national: 10, municipal: 2 }, { national: 6, municipal: 2 }]);
});

// The mode reads one file. The preloaded module ends the child on any connection or request (exit 97).
const NO_NETWORK = `data:text/javascript;base64,${Buffer.from(`import net from 'node:net';
const stop = () => { process.stderr.write('network_attempt'); process.exit(97); };
net.Socket.prototype.connect = stop; globalThis.fetch = stop;`).toString('base64')}`;

test('the ending mode prints the acts by last day from the manifest alone and exits 10 when any ends (ADR-124)', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-law-ending-'));
  const manifest = async (name, acts) => { const file = path.join(dir, name); await fs.writeFile(file, JSON.stringify({ store_generation: 'g', generated_at: '2026-10-09T15:00:00.000Z', acts })); return file; };
  const ending = (...args) => cli(['ending', ...args], {}, ['--import', NO_NETWORK]);
  try {
    const file = await manifest('manifest.json', INDEXED), out = path.join(dir, 'reports', 'ending.json');
    const run = await ending('--manifest', file, '--today', '2026-10-10', '--out', out);
    assert.equal(run.code, 10, run.stderr);
    const lines = run.stdout.trim().split('\n'), day = (last_day, national, municipal = 0) => ({ last_day, national, municipal });
    assert.deepEqual(lines.slice(0, -1).map(line => line.replace(/ {2,}/g, ' | ')), ['last day | left | scope | act',
      '2026-10-10 | 0 | national | Üksik akt (Riigikogu, group act:16)',
      '2026-10-30 | 20 | national | Seadus gap (Riigikogu, group gap) [resumes 2026-11-01 after 1 uncovered day]',
      '2026-10-30 | 20 | national | Seadus twice (Riigikogu, group twice) [resumes 2026-11-01 after 1 uncovered day, ends again 2026-12-31]',
      '2026-10-31 | 21 | national | Seadus ends (Riigikogu, group ends)',
      '2026-11-30 | 51 | national | Seadus chain (Riigikogu, group chain) [resumes 2027-02-01 after 62 uncovered days]',
      '2026-12-31 | 82 | national | Seadus stale (Riigikogu, group stale)',
      '2027-01-07 | 89 | national | Seadus short (Riigikogu, group short)',
      '2026-12-31 | 82 | suur_vald | Abi andmise kord (Suure Vallavolikogu, group kord) [candidate: group uus, same title]',
      '2026-12-31 | 82 | suur_vald | Toetuste määrad 2026. aastal (Suure Vallavalitsus, group maarad)']);
    // 90 days by default.
    const summary = { today: '2026-10-10', horizon: '2027-01-08', in_force: { national: 10, municipal: 2 }, ending: { national: 7, municipal: 2 }, resume_after_gap: 3,
      by_last_day: [day('2026-10-10', 1), day('2026-10-30', 2), day('2026-10-31', 1), day('2026-11-30', 1), day('2026-12-31', 1, 2), day('2027-01-07', 1)] };
    assert.deepEqual(JSON.parse(lines.at(-1)), { ...summary, exit: 10 });
    assert.deepEqual(JSON.parse(await fs.readFile(out, 'utf8')), { schema_version: 'rag-v2/law-acts-ending-1', ...summary, horizon_days: 90,
      manifest: { store_generation: 'g', generated_at: '2026-10-09T15:00:00.000Z' }, acts: actsEnding(INDEXED, '2026-10-10', 90) });
    const none = await ending('--manifest', await manifest('open.json', INDEXED.slice(0, 1)), '--today', '2026-10-10', '--horizon-days', '400');
    assert.deepEqual([none.code, JSON.parse(none.stdout)], [0, { today: '2026-10-10', horizon: '2027-11-14', in_force: { national: 1, municipal: 0 },
      ending: { national: 0, municipal: 0 }, resume_after_gap: 0, by_last_day: [], exit: 0 }]);
    for (const args of [['--today', '2026-10-10'], ['--manifest', file, '--today', '10.10.2026'], ['--manifest', file, '--horizon-days', 'kolm kuud']]) {
      const refused = await ending(...args);
      assert.deepEqual([refused.code, JSON.parse(refused.stderr)], [1, { ok: false, code: 'law_validity_usage' }]);
    }
    // The check does make requests, and the preloaded module sees them: its silence above means the mode made none.
    const check = await cli(['check', '--manifest', file, '--out', path.join(dir, 'check'), '--today', '2026-10-10'], {}, ['--import', NO_NETWORK]);
    assert.deepEqual([check.code, check.stderr], [97, 'network_attempt']);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
