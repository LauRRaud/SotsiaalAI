// Teekonna avaleht: lehe reeglid ja vaadete tekstid.
//
// Leht oli üks pikk veerg vanal ühisel kihil; nüüd on see loend ja viis väikest
// alustamise vaadet (components/journey/dashboard). Lehe otsused on puhaste
// funktsioonidena failis journeyBoard.js ja neid kontrollitakse siin käitumise
// järgi: mis rida on kus rühmas, millal ülevaade uuesti koostatakse, mis jääb
// uuesti koostamisel alles ja mida pooleli töö taastamine tagasi toob.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  DEFAULT_LIFE_DOMAINS,
  EMPTY_DRAFT,
  QUICK_HELP,
  START_STEPS,
  boardGroups,
  boardMore,
  boardShown,
  counterNear,
  createdJourneyPath,
  dayOf,
  draftNoticed,
  draftStale,
  draftWish,
  journeyRow,
  journeyStateKey,
  mergeBuiltDraft,
  plainDayLabel,
  pressTooSoon,
  restoreStart,
  roleWorkspace,
  saveProblem,
  startDirty,
  startStepStates,
  startStorageRow,
  startUrlStep,
  withWish
} from '../components/journey/dashboard/journeyBoard.js';
import { JOURNEY_CLOSURE_KINDS } from '../lib/journey/closureRules.js';
import { JOURNEY_STATUSES } from '../lib/journey/constants.js';
import { panelHasRoomDock, dockLabelRoutes } from '../lib/roomDock.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const LANGS = ['et', 'en', 'ru'];
/* Tõlkija nagu lehel: puuduva võtme korral tagastab võtme enda. */
const translator = (lang) => {
  const messages = catalog(lang);
  return (key, vars) => {
    const value = at(messages, key);
    if (typeof value !== 'string') return key;
    return vars ? value.replace(/\{(\w+)\}/g, (_match, name) => String(vars[name] ?? '')) : value;
  };
};
const t = translator('et');

const journey = (over = {}) => ({ id: 'j1', status: 'ACTIVE', title: 'Ema vajab abi', summary: 'Ema kukkus ja ei saa üksi poes käia.', updatedAt: '2026-10-10T09:30:00.000Z', closure: null, ...over });

test('loend: käimasolevad ja kõrvale pandud on eri rühmades, serveri järjekord jääb', () => {
  const groups = boardGroups([
    journey({ id: 'a' }),
    journey({ id: 'b', status: 'ARCHIVED' }),
    journey({ id: 'c', status: 'DRAFT' }),
    journey({ id: 'd', status: 'ARCHIVED', closure: { kind: 'PAUSED' } }),
    { status: 'ACTIVE' },
    null
  ]);
  assert.deepEqual(groups.active.map((row) => row.id), ['a', 'c']);
  assert.deepEqual(groups.earlier.map((row) => row.id), ['b', 'd']);
  assert.deepEqual(boardGroups(undefined), { active: [], earlier: [] });
});

test('loend: valik on olemas ainult kahe rühma korral ja tühja rühma ei näidata', () => {
  const both = boardGroups([journey({ id: 'a' }), journey({ id: 'b', status: 'ARCHIVED' })]);
  assert.deepEqual(boardShown(both), { shown: 'active', choice: true, empty: false });
  assert.deepEqual(boardShown(both, 'earlier'), { shown: 'earlier', choice: true, empty: false });
  /* Viimane käimasolev arhiveeriti: ette tulevad varasemad, mitte tühi loend. */
  const onlyEarlier = boardGroups([journey({ id: 'b', status: 'ARCHIVED' })]);
  assert.deepEqual(boardShown(onlyEarlier, 'active'), { shown: 'earlier', choice: false, empty: false });
  /* Varasemaid ei ole: inimese vana valik ei jäta ette tühja rühma. */
  const onlyActive = boardGroups([journey({ id: 'a' })]);
  assert.deepEqual(boardShown(onlyActive, 'earlier'), { shown: 'active', choice: false, empty: false });
  assert.deepEqual(boardShown(boardGroups([])), { shown: 'active', choice: false, empty: true });
});

test('seisu märk: käimasoleval ei ole, kõrvale pandul on paus, lõpetamine või arhiiv', () => {
  assert.equal(journeyStateKey(journey()), '');
  assert.equal(journeyStateKey(journey({ status: 'DRAFT' })), 'journey.status.DRAFT');
  assert.equal(journeyStateKey(journey({ status: 'ARCHIVED' })), 'journey.status.ARCHIVED');
  assert.equal(journeyStateKey(journey({ status: 'ARCHIVED', closure: { kind: 'PAUSED' } })), 'journey.closure.status.PAUSED');
  assert.equal(journeyStateKey(journey({ status: 'ARCHIVED', closure: { kind: 'FINISHED' } })), 'journey.closure.status.FINISHED');
  /* Tundmatu liik ei anna toorest võtit: jääb arhiveeritud. */
  assert.equal(journeyStateKey(journey({ status: 'ARCHIVED', closure: { kind: 'OTHER' } })), 'journey.status.ARCHIVED');
});

test('igal seisul ja sulgemise liigil, mille märk võib ekraanile jõuda, on sõna kolmes keeles', () => {
  for (const lang of LANGS) {
    const messages = catalog(lang);
    for (const status of JOURNEY_STATUSES) {
      for (const kind of [null, ...JOURNEY_CLOSURE_KINDS]) {
        const key = journeyStateKey({ status, closure: kind ? { kind } : null });
        if (key) assert.equal(typeof at(messages, key), 'string', `${lang}: ${key}`);
      }
    }
  }
});

test('rida: pealkiri, üks rida selle all, märk, päev ja arhiveerimise võimalus', () => {
  const row = journeyRow(journey(), { t });
  assert.equal(row.title, 'Ema vajab abi');
  assert.equal(row.sub, 'Ema kukkus ja ei saa üksi poes käia.');
  assert.equal(row.chip, '');
  assert.equal(row.canArchive, true);
  assert.equal(row.day, dayOf('2026-10-10T09:30:00.000Z'));
  assert.match(row.day, /^\d{2}\.\d{2}\.2026$/);

  /* Reavahetused kirjelduses ei tee reast mitut rida. */
  assert.equal(journeyRow(journey({ summary: 'Esimene lõik.\n\nTeine   lõik.' }), { t }).sub, 'Esimene lõik. Teine lõik.');

  /* Pealkirjata loodud Teekonna pealkiri on kirjelduse algus: sama teksti kaks korda ei näidata. */
  const untitled = journeyRow(journey({ title: 'Vanaema ei saa enam ise ahju kütta', summary: 'Vanaema ei saa enam ise ahju kütta ja talv tuleb.' }), { t });
  assert.equal(untitled.sub, '');

  /* Pealkiri puudub: rida kannab lehe nime, mitte tühja lahtrit. */
  assert.equal(journeyRow(journey({ title: '  ' }), { t }).title, 'Teekond');

  const paused = journeyRow(journey({ status: 'ARCHIVED', closure: { kind: 'PAUSED', resumeOn: '2026-10-31', resumeDue: false } }), { t });
  assert.equal(paused.chip, 'pausil');
  assert.equal(paused.sub, 'Plaanisid jätkata 31.10.2026.');
  assert.equal(paused.attention, false);
  assert.equal(paused.canArchive, false);

  const due = journeyRow(journey({ status: 'ARCHIVED', closure: { kind: 'PAUSED', resumeOn: '2026-10-01', resumeDue: true } }), { t });
  assert.equal(due.sub, 'Plaanisid jätkata 01.10.2026. See päev on käes.');
  assert.equal(due.attention, true);

  /* Lõpetatud Teekonna real jääb alles kirjeldus, päeva lauset ei ole. */
  const finished = journeyRow(journey({ status: 'ARCHIVED', closure: { kind: 'FINISHED', resumeOn: null } }), { t });
  assert.equal(finished.chip, 'lõpetatud');
  assert.equal(finished.sub, 'Ema kukkus ja ei saa üksi poes käia.');

  /* Vigane aeg ei anna sõna „Invalid Date". */
  assert.equal(journeyRow(journey({ updatedAt: 'pole kuupäev' }), { t }).day, '');
  assert.equal(plainDayLabel('2026-02-30x'), '');
});

test('järgmine lehekülg: pakutakse ainult siis, kui server ütleb, et Teekondi on veel', () => {
  assert.equal(boardMore({ totalCount: 3, hasMore: false, nextCursor: null }, 3), null);
  assert.equal(boardMore({ totalCount: 30, hasMore: true, nextCursor: null }, 25), null);
  assert.deepEqual(boardMore({ totalCount: 30, hasMore: true, nextCursor: 'abc' }, 25), { cursor: 'abc', loaded: 25, total: 30 });
  /* Arv ei ole kunagi väiksem kui juba nähtav hulk. */
  assert.equal(boardMore({ totalCount: 0, hasMore: true, nextCursor: 'abc' }, 25).total, 25);
});

test('teine vajutus: topeltklõps ei loe, hilisem vajutus loeb', () => {
  assert.equal(pressTooSoon(0, 1000), false);
  assert.equal(pressTooSoon(1000, 1200), true);
  assert.equal(pressTooSoon(1000, 1400), false);
});

test('ülevaade koostatakse uuesti ainult siis, kui seda ei ole või kirjeldus on muutunud', () => {
  const built = { ...EMPTY_DRAFT, title: 'kodune abivajadus', summary: 'Hooldan ema.' };
  assert.equal(draftStale({ situation: 'Hooldan ema.', draft: EMPTY_DRAFT, builtFor: '' }), true);
  assert.equal(draftStale({ situation: 'Hooldan ema.', draft: built, builtFor: 'Hooldan ema.' }), false);
  assert.equal(draftStale({ situation: 'Hooldan ema ja isa.', draft: built, builtFor: 'Hooldan ema.' }), true);
  /* Lõputühik on muutus: server korrastab teksti ise, leht ei arva ette. */
  assert.equal(draftStale({ situation: 'Hooldan ema. ', draft: built, builtFor: 'Hooldan ema.' }), true);
});

test('uus ülevaade ei võta ära seda, mida inimene ise kirjutas', () => {
  const previous = withWish({ ...EMPTY_DRAFT, title: 'Minu pealkiri', summary: 'Vana kirjeldus.', domains: ['vana teema'] }, 'Tahan, et ema saaks kodus elada.');
  const built = { title: 'kodune abivajadus', summary: 'Uus kirjeldus.', domains: ['kodune abivajadus'], context: { lifeDomains: ['elukeskkond'] } };

  const kept = mergeBuiltDraft({ previous, built, clientActionId: 'id-2', titleEdited: true });
  assert.equal(kept.title, 'Minu pealkiri');
  assert.equal(kept.summary, 'Uus kirjeldus.');
  assert.deepEqual(kept.domains, ['kodune abivajadus']);
  assert.equal(draftWish(kept), 'Tahan, et ema saaks kodus elada.');
  assert.deepEqual(kept.context.lifeDomains, ['elukeskkond']);
  assert.equal(kept.clientActionId, 'id-2');

  /* Pealkirja inimene ei muutnud: see tuleb uuest ülevaatest. */
  assert.equal(mergeBuiltDraft({ previous, built, clientActionId: 'id-3' }).title, 'kodune abivajadus');
  /* Tühjaks kustutatud pealkiri ei jää tühjaks: serveri pakutu tuleb tagasi. */
  assert.equal(mergeBuiltDraft({ previous: { ...previous, title: ' ' }, built, clientActionId: 'id-4', titleEdited: true }).title, 'kodune abivajadus');
  /* Soovita mustand ei saa tühja soovi võtit. */
  assert.equal(Object.hasOwn(mergeBuiltDraft({ previous: EMPTY_DRAFT, built, clientActionId: 'id-5' }).context, 'personWish'), false);
});

test('soov: tühi soov võtab võtme välja, muu kontekst jääb', () => {
  const draft = { ...EMPTY_DRAFT, context: { lifeDomains: ['hõivatus'] } };
  const withText = withWish(draft, 'Soovin tööd.');
  assert.equal(draftWish(withText), 'Soovin tööd.');
  assert.deepEqual(withText.context.lifeDomains, ['hõivatus']);
  const cleared = withWish(withText, '');
  assert.equal(Object.hasOwn(cleared.context, 'personWish'), false);
  assert.deepEqual(cleared.context.lifeDomains, ['hõivatus']);
  /* Algne mustand ei muutu. */
  assert.equal(draftWish(draft), '');
});

test('sammude seis: kirjeldus, ülevaade ja soov näitavad, mis on tehtud', () => {
  assert.deepEqual(startStepStates({ situation: '', draft: EMPTY_DRAFT, builtFor: '' }), { describe: 'empty', overview: 'empty', ahead: 'empty', wish: 'empty', save: 'empty' });
  const built = { ...EMPTY_DRAFT, title: 'kodune abivajadus', summary: 'Hooldan ema.' };
  assert.deepEqual(startStepStates({ situation: 'Hooldan ema.', draft: built, builtFor: 'Hooldan ema.' }), { describe: 'done', overview: 'done', ahead: 'done', wish: 'empty', save: 'empty' });
  /* Pealkiri kustutati: ülevaade on pooleli. */
  assert.equal(startStepStates({ situation: 'Hooldan ema.', draft: { ...built, title: '' }, builtFor: 'Hooldan ema.' }).overview, 'partial');
  /* Kirjeldus muutus: ülevaate vaated ei ole enam valmis. */
  assert.equal(startStepStates({ situation: 'Hooldan isa.', draft: built, builtFor: 'Hooldan ema.' }).ahead, 'empty');
  assert.equal(startStepStates({ situation: 'x', draft: withWish(built, 'Soov'), builtFor: 'x' }).wish, 'done');
  /* Sammude loend ja seisude võtmed käivad kokku. */
  assert.deepEqual(Object.keys(startStepStates({ situation: '', draft: EMPTY_DRAFT, builtFor: '' })).sort(), [...START_STEPS].sort());
});

test('salvestamata töö: kirjeldus, soov või koostatud ülevaade hoiavad lahkumise kinni', () => {
  assert.equal(startDirty({ situation: '   ', draft: EMPTY_DRAFT }), false);
  assert.equal(startDirty({ situation: 'Hooldan ema.', draft: EMPTY_DRAFT }), true);
  assert.equal(startDirty({ situation: '', draft: withWish(EMPTY_DRAFT, 'Soov') }), true);
  assert.equal(startDirty({ situation: '', draft: { ...EMPTY_DRAFT, summary: 'Hooldan ema.' } }), true);
});

test('aadressi märge: esimene samm on kirjeldamine, kõik järgmised ülevaade', () => {
  assert.equal(startUrlStep('describe'), 'kirjelda');
  for (const key of START_STEPS.filter((step) => step !== 'describe')) assert.equal(startUrlStep(key), 'ulevaade');
});

test('taastamine: ilma aadressi märketa tuleb tagasi ainult tekst, märkega ka koht', () => {
  const built = { ...EMPTY_DRAFT, title: 'kodune abivajadus', summary: 'Hooldan ema.' };
  const row = startStorageRow({ stepKey: 'wish', situation: 'Hooldan ema.', draft: built, builtFor: 'Hooldan ema.' });
  assert.equal(row.mode, 'review');
  assert.equal(startStorageRow({ stepKey: 'describe', situation: 'x', draft: EMPTY_DRAFT, builtFor: '' }).mode, 'start');

  const quiet = restoreStart(row, '');
  assert.equal(quiet.mode, 'list');
  assert.equal(quiet.situation, 'Hooldan ema.');
  assert.equal(quiet.restored, false);

  const back = restoreStart(row, 'ulevaade');
  assert.deepEqual([back.mode, back.stepKey, back.restored, back.builtFor], ['start', 'wish', true, 'Hooldan ema.']);
  assert.equal(draftStale(back), false);

  /* Kirjeldamise märge viib alati esimesse vaatesse. */
  assert.equal(restoreStart(row, 'kirjelda').stepKey, 'describe');
  /* Ülevaate märge ilma ülevaateta: esimene vaade, mitte tühi ülevaade. */
  assert.equal(restoreStart({ mode: 'start', situation: 'Hooldan ema.' }, 'ulevaade').stepKey, 'describe');
  /* Kirjeldus on pärast koostamist muutunud: tagasi kirjelduse juurde. */
  assert.equal(restoreStart({ ...row, situation: 'Hooldan isa.' }, 'ulevaade').stepKey, 'describe');
  /* Tundmatu samm real: ülevaade. */
  assert.equal(restoreStart({ ...row, step: 'olematu' }, 'ulevaade').stepKey, 'overview');

  /* Rida puudub või on katki: tühi algus, leht ei kuku. */
  for (const broken of [null, undefined, 'tekst', 7, [], { draft: 'tekst' }, { draft: [] }]) {
    const empty = restoreStart(broken, 'kirjelda');
    assert.deepEqual([empty.situation, empty.draft, empty.mode, empty.stepKey, empty.restored], ['', null, 'start', 'describe', false]);
  }
});

test('taastamine: vana lehe rida (ilma sammuta) toob tagasi värskeima teksti', () => {
  /* Vanal lehel oli ülevaates kokkuvõte omaette muudetav väli. */
  const edited = { ...EMPTY_DRAFT, title: 'kodune abivajadus', summary: 'Hooldan ema ja ta vajab abi pesemisel.' };
  const review = restoreStart({ mode: 'review', situation: 'Hooldan ema.', draft: edited }, 'ulevaade');
  assert.equal(review.situation, 'Hooldan ema ja ta vajab abi pesemisel.');
  assert.equal(draftStale(review), false);
  assert.equal(review.stepKey, 'overview');
  /* Kirjeldamise režiimis salvestatud real on värskem kirjeldus: ülevaade koostatakse uuesti. */
  const start = restoreStart({ mode: 'start', situation: 'Hooldan ema ja isa.', draft: edited }, 'kirjelda');
  assert.equal(start.situation, 'Hooldan ema ja isa.');
  assert.equal(draftStale(start), true);
});

test('ülevaate sisu: teemad, eluvaldkonnad, tähelepanekud ja sammud sõnadena', () => {
  const noticed = draftNoticed({
    domains: ['kodune abivajadus', '', '  hoolduskoormus '],
    riskSignals: ['Kirjelduses võib olla teenuse katkemise risk.'],
    missingInfo: ['Millises omavalitsuses abi vajatakse?'],
    suggestedActions: [{ type: 'REVIEW', title: 'Täpsusta kokkuvõte' }, 'Ava teenusekaart', { type: 'X' }],
    context: { lifeDomains: ['elukeskkond'] }
  });
  assert.deepEqual(noticed.domains, ['kodune abivajadus', 'hoolduskoormus']);
  assert.deepEqual(noticed.lifeDomains, ['elukeskkond']);
  assert.deepEqual(noticed.actions, ['Täpsusta kokkuvõte', 'Ava teenusekaart']);
  assert.equal(noticed.risks.length, 1);
  assert.equal(noticed.missing.length, 1);
  /* Server eluvaldkondi ei andnud: neli esimest, nagu vanal lehel. */
  assert.deepEqual(draftNoticed(EMPTY_DRAFT).lifeDomains, DEFAULT_LIFE_DOMAINS.slice(0, 4));
  assert.deepEqual(draftNoticed(null).domains, []);
});

test('salvestamine: ilma ülevaate või pealkirjata ütleb leht, mis puudu on ja kus', () => {
  assert.deepEqual(saveProblem(EMPTY_DRAFT), { key: 'journey.start.need_situation', step: 'describe' });
  assert.deepEqual(saveProblem({ ...EMPTY_DRAFT, summary: 'Hooldan ema.', title: '  ' }), { key: 'journey.start.need_title', step: 'overview' });
  assert.equal(saveProblem({ ...EMPTY_DRAFT, summary: 'Hooldan ema.', title: 'Ema' }), null);
  for (const step of [saveProblem(EMPTY_DRAFT).step, 'overview']) assert.ok(START_STEPS.includes(step));
});

test('pärast loomist avaneb Teekond, soovi korral valitud osa juures', () => {
  assert.equal(createdJourneyPath('jrn_1'), '/teekond/jrn_1');
  assert.equal(createdJourneyPath('jrn_1', 'PRE_INQUIRY'), '/teekond/jrn_1?alusta=PRE_INQUIRY');
  assert.equal(createdJourneyPath('a/b', 'SERVICE_MAP'), '/teekond/a%2Fb?alusta=SERVICE_MAP');
});

test('loendur ilmub alles siis, kui väli hakkab täis saama', () => {
  assert.equal(counterNear('a'.repeat(100), 1000), null);
  assert.deepEqual(counterNear('a'.repeat(800), 1000), { current: 800, limit: 1000 });
  assert.equal(counterNear(undefined, 1000), null);
});

test('kiire abi: igal numbril on nimi ja number kolmes keeles', () => {
  assert.deepEqual(QUICK_HELP.map((item) => item.tel), ['112', '116111', '116006']);
  for (const lang of LANGS) {
    const messages = catalog(lang);
    for (const item of QUICK_HELP) {
      assert.equal(typeof at(messages, `journey.quick_help.names.${item.key}`), 'string', `${lang}: ${item.key}`);
      /* Nähtav number ja helistatav number on sama number. */
      assert.equal(at(messages, `journey.quick_help.${item.key}`).replace(/\s/g, ''), item.tel, `${lang}: ${item.key}`);
    }
  }
});

test('teine roll: kolm teed, igaühel pealkiri ja selgitus kolmes keeles', () => {
  for (const role of ['SOCIAL_WORKER', 'SERVICE_PROVIDER', 'ADMIN', '']) {
    const sheet = roleWorkspace(role);
    assert.equal(sheet.actions.length, 3, role);
    assert.equal(new Set(sheet.actions.map((action) => action.href)).size, 3, `${role}: sama lehte ei pakuta kaks korda`);
    for (const lang of LANGS) {
      const messages = catalog(lang);
      for (const key of [sheet.title, ...sheet.lead, ...sheet.actions.flatMap((action) => [action.title, action.description])]) {
        assert.equal(typeof at(messages, key), 'string', `${lang}: ${key}`);
      }
    }
  }
  assert.ok(roleWorkspace('SERVICE_PROVIDER').actions.some((action) => action.href === '/teenuseprofiil'));
  assert.ok(roleWorkspace('SOCIAL_WORKER').actions.some((action) => action.href === '/documents'));
});

test('vaadete tekstivõtmed on kataloogis kolmes keeles ja sammudel on nimi kiirmenüü jaoks', () => {
  const keys = new Set();
  for (const source of ['../components/journey/dashboard/DashboardViews.jsx', '../components/journey/dashboard/journeyBoard.js', '../components/journey/JourneyDashboard.jsx']) {
    for (const match of read(source).matchAll(/\bt\(\s*"((?:journey|chat)\.[A-Za-z_.0-9]+)"/g)) keys.add(match[1]);
  }
  assert.ok(keys.size > 40, `võtmeid leiti ${keys.size}`);
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual([...keys].filter((key) => typeof at(messages, key) !== 'string'), [], lang);
    for (const step of START_STEPS) {
      const names = at(messages, `journey.start.steps.${step}`);
      assert.ok(names?.title && names?.short, `${lang}: ${step}`);
      assert.ok(names.short.length <= 18, `${lang}: ${step} lühinimi mahub kiirmenüüsse`);
    }
  }
});

test('eestikeelsetes uutes tekstides ei ole mõttekriipsu ega sirgeid jutumärke', () => {
  const et = catalog('et').journey;
  const walk = (node, path, out) => {
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'string') out.push([`${path}.${key}`, value]);
      else if (value && typeof value === 'object') walk(value, `${path}.${key}`, out);
    }
    return out;
  };
  for (const [key, value] of [...walk(et.board, 'journey.board', []), ...walk(et.start, 'journey.start', []), ...walk(et.quick_help.names, 'journey.quick_help.names', [])]) {
    assert.ok(!/[—–"]/.test(value), `${key}: ${value}`);
  }
});

/* Omanik 10.10: lehel ei tohi olla sulgemise nuppu ja infot nurgas, need on all
   kiirmenüüs. Teekonna lehed kannavad seega dokki ja dokk leiab neile nime. */
test('Teekonna lehed kannavad dokki ja saavad dokis kaardi „Teekond" nime', () => {
  for (const route of ['/teekond', '/teekond/jrn_1']) assert.equal(panelHasRoomDock(route), true, route);
  /* Päris vestlus hoiab alumist serva composeri jaoks; töölaua sisuleht mitte. */
  assert.equal(panelHasRoomDock('/vestlus'), false);
  assert.equal(panelHasRoomDock('/vestlus', { workspace: 'journey' }), true);
  const aliases = { '/teekond': '/vestlus?workspace=journey' };
  assert.ok(dockLabelRoutes('/teekond', '', aliases).includes('/vestlus?workspace=journey'));
  assert.ok(dockLabelRoutes('/teekond/jrn_1', '', aliases).includes('/vestlus?workspace=journey'), 'avatud Teekond kannab sama nime');
});
