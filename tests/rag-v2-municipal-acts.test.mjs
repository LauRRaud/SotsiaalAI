import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { classifyMunicipalAct, rateSubject, selectMunicipalActs } from '../lib/rag-v2/municipal-acts.js';

// ADR-058: titles as Riigi Teataja lists them (30.09.2026).
const TITLES = [
  ['Sotsiaaltoetuste määrad', 'rates'],
  ['Hooldajatoetuse määra kehtestamine 2026. aastal', 'rates'],
  ['Sotsiaaltoetuste suuruste määramine', 'rates'],
  ['Sotsiaaltoetuste määramise ja maksmise kord', 'benefits_procedure'],
  ['Koduse lapse toetuse määramise ja maksmise kord', 'benefits_procedure'],
  ['Puudega inimesele eluruumi kohandamiseks toetuse määramise kord', 'benefits_procedure'],
  ['Eluruumide alaliste kulude piirmäärade kehtestamine toimetulekutoetuse määramiseks', 'housing_costs'],
  ['Eluasemekulude piirmäärad toimetulekutoetuse määramisel', 'housing_costs'],
  ['Üldhooldusteenust vahetult osutavate töötajate kulude tasumise piirmäära kehtestamine', 'care_home_costs'],
  ['Väljaspool kodu osutatava ööpäevaringse üldhooldusteenuse hoolduskulude tasumise piirmäära kehtestamine', 'care_home_costs'],
  ['Sotsiaalteenuste maksumuse piirmäärade kinnitamine', 'service_prices'],
  ['Sotsiaaltransporditeenuse hinna kehtestamine', 'service_prices'],
  ['Hoolduse seadmise, hooldaja määramise ja hooldajatoetuse maksmise kord', 'carer'],
  ['Koduteenuse osutamise tingimused ja kord', 'service_procedure'],
  ['Asendus- ja järelhooldusteenuse osutamise tingimused ja kord', 'service_procedure'],
  ['Sotsiaalhoolekandelise abi andmise kord', 'welfare_procedure'],
  // Not social welfare acts: trees ("puude"), buildings, sport, water, a specialist's housing, an office's staffing.
  ['Puude raieloa andmise kord', null],
  ['Korterelamute hoovide korrastamiseks toetuse andmise kord', null],
  ['Treeneri tööjõukulu toetuse maksmise kord', null],
  ['Kihnu valla veevärgi ja kanalisatsiooni teenuse hind', null],
  ['Räpina valla spetsialisti eluaseme toetuse määramise kord', null],
  ['Sotsiaalhoolekandelise abi andmise otsuse tegijate määramine', null],
  ['Tori valla 2017. aasta eelarve', null],
  // Codex R2 (30.09.2026): a word of another field only at a word's start, so a place name or "paid from the budget" stays.
  ['Rae valla eelarvest isiku toimetuleku kindlustamiseks toetuste maksmise piirmäärad 2026. aastal', 'rates'],
  ['Sotsiaalhoolekandelise abi andmise kord Mustvee vallas', 'welfare_procedure'],
  ['Mustvee valla eelarvest makstavate sotsiaaltoetuste määrade kehtestamine', 'rates'],
  ['Kiili valla omandis olevate sotsiaalkorterite üürile andmise ja kasutamise kord', 'service_procedure'],
  ['Toimetulekule suunatud sotsiaalõppe teenuse osutamise kord', 'service_procedure'],
  ['Tori valla eelarvestrateegia aastateks 2020-2023', null],
  ['Tori valla 2024. aasta 1. lisaeelarve', null],
  ['Haapsalu linna sotsiaalvaldkonna töötajate ja vabatahtlike tunnustamise kord', null],
  ['Kanepi valla erateedel tasuta talvise teehoolduse tegemise kord', null],
  ['Eralasteaia ja eralapsehoiu teenuse toetamise kord', null],
];

test('a municipal act is classified by its title; acts of other fields are not social welfare acts', () => {
  for (const [title, category] of TITLES) assert.equal(classifyMunicipalAct(title), category, title);
});

test('the selection keeps the acts in force and the next versions, and drops what Riigi Teataja marks or a newer one replaces', () => {
  const act = (id, title, from, to = null, extra = {}) => ({ m: 'a_vald', id, title, from, to, tekst: 'terviktekst', kk: false, mj: false, ...extra });
  const listing = [
    act('1', 'Sotsiaaltoetuste määrad', '2024-01-01'),
    act('2', 'Sotsiaaltoetuste määrade kehtestamine', '2026-03-01'),
    act('3', 'Sotsiaaltoetuste määrad', '2027-01-01'),
    act('4', 'Sotsiaaltoetuste määramise ja maksmise kord', '2020-01-01', null, { kk: true }),
    act('5', 'Koduteenuse osutamise kord', '2026-08-01', null, { mj: true }),
    act('6', 'Päevahoiuteenuse osutamise kord', '2025-01-01', null, { tekst: 'algtekst' }),
    act('7', 'Tugiisikuteenuse osutamise kord', '2020-01-01', '2026-09-29'),
    act('8', 'Hooldajatoetuse määra kehtestamine 2019. aastal', '2019-01-01'),
    act('9', 'Koduteenuse osutamise tingimused ja kord', '2022-02-26', '2026-10-01'),
    act('10', 'Koduteenuse osutamise tingimused ja kord', '2026-10-02'),
    act('11', 'Isikliku abistaja teenuse osutamise kord', '2021-01-01'),
    act('12', 'Sotsiaaltoetuste määrad', '2028-06-01'),
    { ...act('13', 'Sotsiaaltoetuste määrad', '2025-01-01'), m: 'b_vald' },
  ];
  const { keep, dropped } = selectMunicipalActs(listing, { today: '2026-09-30', horizon: '2027-12-31' });
  // One rates act in force per municipality (the newest), its next version, every version of a titled procedure.
  assert.deepEqual(keep.map(a => a.id).sort(), ['10', '11', '13', '2', '3', '9']);
  // A repeal record (4), a text that never entered into force (5), an original text (6), an ended act (7) and one past
  // the horizon (12) are not listed at all; an older rates act and one with a past year in its title are dropped.
  assert.deepEqual(dropped.map(a => [a.id, a.reason]).sort(), [['1', 'replaced_by_newer'], ['8', 'past_year_in_title']]);
});

test('rates are one act per benefit: the rate of a named benefit does not replace the general rates beside it', () => {
  assert.deepEqual(['Hooldajatoetuse määra kehtestamine 2026. aastal', 'Lapsehoiutoetuse suuruse kinnitamine 2026. aastaks',
    'Kadrina valla eelarvest maksmisele kuuluva lapse sünnitoetuse ja matusetoetuse määrade kinnitamine', 'Sotsiaaltoetuste määrad'].map(rateSubject),
  ['hooldaja', 'lapsehoiu', 'sünni+matuse', 'general']);
  const act = (id, title, from) => ({ m: 'rae_vald', id, title, from, to: null, tekst: 'terviktekst', kk: false, mj: false });
  const { keep, dropped } = selectMunicipalActs([
    act('430012026034', 'Rae valla eelarvest isiku toimetuleku kindlustamiseks toetuste maksmise piirmäärad 2026. aastal', '2026-02-02'),
    act('412092026007', 'Hooldajatoetuse määra kehtestamine 2026. aastal', '2026-09-15'),
    act('400000000001', 'Hooldajatoetuse määra kehtestamine', '2025-01-01'),
  ], { today: '2026-09-30', horizon: '2027-12-31' });
  assert.deepEqual(keep.map(a => a.id).sort(), ['412092026007', '430012026034']);
  assert.deepEqual(dropped.map(a => [a.id, a.reason]), [['400000000001', 'replaced_by_newer']]);
});

const cli = (args, env) => new Promise(resolve => {
  const child = spawn(process.execPath, ['scripts/rag-v2-municipal-acts.mjs', ...args], { env: { ...process.env, ...env } });
  let stdout = '', stderr = '';
  child.stdout.on('data', d => { stdout += d; }); child.stderr.on('data', d => { stderr += d; });
  child.on('close', code => resolve({ code, stdout, stderr }));
});

test('the scan downloads the new acts, and leaves out a repeal record and an act whose group the index has', async () => {
  // A committed act with text and a committed repeal record (Muhu, "Kehtetu"), each given the group the case needs.
  const text = await fs.readFile('Andmebaasi/oigusaktid/426022026044.xml', 'utf8'), stub = await fs.readFile('Andmebaasi/oigusaktid/425032026041.xml', 'utf8');
  const withGroup = (xml, group) => xml.replace(/<terviktekstiGrupiID>[^<]*<\/terviktekstiGrupiID>/u, `<terviktekstiGrupiID>${group}</terviktekstiGrupiID>`);
  const xml = { 101: withGroup(text, 'G101'), 102: withGroup(text, 'G-INDEXED'), 104: withGroup(stub, 'G104'), 105: withGroup(text, 'G105') };
  const listed = (id, pealkiri) => ({ globaalID: id, pealkiri, kehtivus: { algus: '2026-01-01', lopp: null }, tekst: 'terviktekst', kehtivKehtetus: false, mitteJoustunud: false });
  const lists = {
    'Väike Vallavolikogu': [listed(101, 'Sotsiaaltoetuste määrad'), listed(102, 'Koduteenuse osutamise kord'),
      listed(103, 'Sotsiaalhoolekandelise abi andmise kord'), listed(104, 'Tugiisikuteenuse osutamise kord'), listed(106, 'Puude raieloa andmise kord'),
      { ...listed(107, 'Sotsiaaltoetuste määrade kehtestamine'), kehtivus: { algus: '2024-01-01', lopp: null } }],
    'Väike Vallavalitsus': [listed(105, 'Eluasemekulude piirmäärad toimetulekutoetuse määramisel')],
  };
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://x');
    if (url.pathname === '/api/oigusakt_otsing/1/otsi') {
      const acts = lists[url.searchParams.get('valjaandja')] || [];
      response.writeHead(200, { 'content-type': 'application/json' });
      return response.end(JSON.stringify({ metaandmed: { kokku: acts.length }, aktid: acts }));
    }
    const id = url.pathname.match(/^\/et\/akt\/(\d+)\.xml$/u)?.[1];
    if (id && xml[id]) { response.writeHead(200, { 'content-type': 'application/xml' }); return response.end(xml[id]); }
    response.writeHead(404); response.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-municipal-acts-'));
  try {
    const manifest = path.join(dir, 'manifest.json');
    await fs.writeFile(manifest, JSON.stringify({ acts: [{ globaal_id: '103', group: 'G-INDEXED', issuer: 'Väike Vallavolikogu', regions: ['vaike_vald'],
      title: 'Sotsiaalhoolekandelise abi andmise kord', index_from: '2020-01-01', index_to: null },
      { globaal_id: '107', document_id: 'document_107', group: 'G107', issuer: 'Väike Vallavolikogu', regions: ['vaike_vald'],
        title: 'Sotsiaaltoetuste määrade kehtestamine', index_from: '2024-01-01', index_to: null }] }));
    const run = await cli(['scan', '--manifest', manifest, '--out', path.join(dir, 'out'), '--download', path.join(dir, 'xml'), '--today', '2026-09-30'],
      { RAG_V2_RT_BASE: `http://127.0.0.1:${server.address().port}`, RAG_V2_RT_PAUSE_MS: '0' });
    assert.equal(run.code, 10, run.stdout + run.stderr);
    assert.deepEqual(JSON.parse(run.stdout), { today: '2026-09-30', municipalities: 1, selected: 5, new: 4, downloaded: 2, superseded: 1, errors: 0, exit: 10 });
    const report = JSON.parse(await fs.readFile(path.join(dir, 'out', 'municipal-acts-2026-09-30.json'), 'utf8'));
    assert.deepEqual(report.acts.map(a => [a.id, a.category, a.status]).sort(),
      [['101', 'rates', 'downloaded'], ['102', 'service_procedure', 'group_indexed'], ['104', 'service_procedure', 'no_text'], ['105', 'housing_costs', 'downloaded']]);
    assert.deepEqual((await fs.readdir(path.join(dir, 'xml'))).sort(), ['101.xml', '105.xml']);
    // The indexed older rates act the newer one replaces is named for removal from the index policy.
    assert.deepEqual(report.superseded, [{ m: 'vaike_vald', id: '107', document_id: 'document_107', category: 'rates',
      title: 'Sotsiaaltoetuste määrade kehtestamine', reason: 'replaced_by_newer', replaced_by: '101' }]);
    assert.match(await fs.readFile(path.join(dir, 'out', 'municipal-acts-2026-09-30.md'), 'utf8'), /vaike_vald 101 rates 2026-01-01\.\. downloaded/u);
  } finally { server.close(); await fs.rm(dir, { recursive: true, force: true }); }
});
