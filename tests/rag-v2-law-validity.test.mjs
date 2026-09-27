import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { analyseGroup, coverage, exitCode, groupStatus } from '../lib/rag-v2/law-validity.js';

// ADR-038: the legal texts of the active corpus against Riigi Teataja.
const window = { from: '2026-09-27', to: '2027-10-31' };
const v = (id, from, to = null) => ({ id, from, to });
const RLS = [v('109042026003', '2026-04-10', '2026-06-11'), v('103062026020', '2026-06-12', '2026-07-18'), v('111072026165', '2026-07-19', '2026-07-31'),
  v('111072026166', '2026-08-01', '2026-10-30'), v('111072026167', '2026-11-01', '2026-12-31'), v('111072026168', '2027-01-01', '2027-06-30'), v('111072026169', '2027-07-01')];

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
const cli = (args, env) => new Promise(resolve => {
  const child = spawn(process.execPath, ['scripts/rag-v2-law-validity.mjs', ...args], { env: { ...process.env, ...env } });
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
