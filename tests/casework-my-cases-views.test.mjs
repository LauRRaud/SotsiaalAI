// „Minu juhtumid": loendi ja juhtumi detaili vaated, nende tekstid ja lubadused.
//
// Leht oli üks veerg vanal `cw-*` kihil; nüüd on loendileht kaks vaadet ja
// juhtumi detail kaksteist osa sammulaval (components/casework/cases/). Test
// hoiab seda, mida silm kergesti ei märka: puuduv tõlkevõti, nimeta osa, toores
// enum ekraanil, ühe vajutusega pöördumatu tegu, kaks lahku läinud loendit.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CASE_FILTER_LABEL_KEYS,
  CASE_LIST_VIEWS,
  CASE_PART_ORDER,
  CASE_STATE_FILTERS,
  MISSING_STATUSES,
  caseFilterOptions,
  caseListQuery,
  caseListRows,
  casePartKeys,
  caseParts,
  itemRows,
  missingRows,
  missingStatusOptions,
  retentionTone,
  retentionView
} from '../components/casework/caseViews.js';
import { missingInfoStatusKey, retentionLabelKey, targetTypeKey } from '../components/casework/caseWorkClient.js';
import { PROVENANCES, provenanceLabelKey } from '../lib/workspaces/provenance.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const LANGS = ['et', 'en', 'ru'];

/* Sama käitumine mis lehe `t`-l: puuduv võti annab võtme enda tagasi. Nii näeb
   test täpselt seda, mida näeks inimene. */
const et = catalog('et');
const t = (key) => {
  const value = at(et, key);
  return typeof value === 'string' ? value : key;
};
const context = { t, locale: 'et' };

const PAGE_SOURCES = [
  '../components/casework/CaseWorkShell.jsx',
  '../components/casework/CaseWorkDetail.jsx',
  '../components/casework/cases/CaseListViews.jsx',
  '../components/casework/cases/CaseDetailViews.jsx',
  '../components/casework/caseViews.js',
  '../components/casework/caseWorkClient.js'
];
const RAW_ENUMS = /\b(ACTIVE|READ_ONLY|ARCHIVED|OPEN|RESOLVED|NOT_APPLICABLE|USER_DOCUMENT|AGENT_ARTIFACT|FIELD_VISIT|MUSTAND|VAJAB_KONTROLLI|COPIED_FOR_STAR2)\b/;

/* Teenuskihti ei impordita (ta toob Prisma kliendi): loeme sõnastiku failist. */
function serverKeys(path, name) {
  const source = read(path);
  const start = source.indexOf(`${name} = Object.freeze({`);
  assert.ok(start >= 0, `${name} on failis ${path}`);
  const block = source.slice(start, source.indexOf('})', start));
  return [...block.matchAll(/^\s*(?:\[[A-Z_.]+\.)?([A-Z_0-9]+)\]?:/gm)].map((match) => match[1]);
}

test('vaadete tekstivõtmed on kataloogis kolmes keeles', () => {
  const keys = new Set();
  for (const source of PAGE_SOURCES) {
    /* Kõik täielikud võtmed, ka tingimuslause sees (`t(viga || "casework.…")`).
       Mallisõnega kokku pandud võtmed kontrollivad järgmised testid. */
    for (const match of read(source).matchAll(/"(casework\.[A-Za-z0-9_.]*[A-Za-z0-9])"/g)) keys.add(match[1]);
  }
  assert.ok(keys.size > 70, `võtmeid leiti ${keys.size}`);
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual([...keys].filter((key) => typeof at(messages, key) !== 'string'), [], lang);
  }
});

test('igal vaatel ja juhtumi osal on nimi ja lühinimi kiirmenüü jaoks', () => {
  assert.deepEqual([...CASE_LIST_VIEWS], ['list', 'create']);
  for (const lang of LANGS) {
    const page = catalog(lang).casework.page;
    for (const key of CASE_LIST_VIEWS) {
      assert.ok(page.views[key]?.title && page.views[key]?.short, `${lang}: vaade ${key}`);
      assert.ok(page.views[key].short.length <= 18, `${lang}: vaate ${key} lühinimi mahub kiirmenüüsse`);
    }
    for (const key of CASE_PART_ORDER) {
      assert.ok(page.parts[key]?.title && page.parts[key]?.short, `${lang}: osa ${key}`);
      assert.ok(page.parts[key].short.length <= 18, `${lang}: osa ${key} lühinimi mahub kiirmenüüsse`);
    }
    assert.ok(page.all_parts && page.more_rows, lang);
    for (const mark of ['{current}', '{total}', '{label}']) assert.ok(page.part_position.includes(mark), `${lang}: ${mark}`);
    for (const [key, mark] of [
      ['row_next_contact', '{time}'],
      ['retention_countdown', '{date}'],
      ['retention_countdown', '{days}']
    ]) {
      assert.ok(page[key].includes(mark), `${lang}: ${key} kannab ${mark}`);
    }
    assert.ok(page.parts.basics.summary_contact.includes('{time}'), lang);
    assert.ok(page.parts.items.summary_count.includes('{count}') && page.parts.items.linked_on.includes('{date}'), lang);
    assert.ok(page.parts.missing.summary_open.includes('{count}'), lang);
  }
});

test('seisu, liigi ja päritolu sõnad, mida leht kokku paneb, on olemas; tundmatu väärtus ei ole „aktiivne”', () => {
  const keys = [
    ...Object.values(CASE_FILTER_LABEL_KEYS),
    ...['ACTIVE', 'READ_ONLY', 'ARCHIVED', 'UUS_SEIS'].map(retentionLabelKey),
    ...[...MISSING_STATUSES, 'UUS_SEIS'].map(missingInfoStatusKey),
    ...['USER_DOCUMENT', 'AGENT_ARTIFACT', 'FIELD_VISIT', 'UUS_LIIK'].map(targetTypeKey),
    ...PROVENANCES.map(provenanceLabelKey),
    'casework.errors.provenance_unknown'
  ];
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual(keys.filter((key) => typeof at(messages, key) !== 'string'), [], lang);
  }
  assert.deepEqual(Object.keys(CASE_FILTER_LABEL_KEYS), [...CASE_STATE_FILTERS]);
  /* Varem langes iga tundmatu väärtus esimese sildi peale („Aktiivne”, „Lahtine”, „Dokument”). */
  assert.equal(retentionLabelKey('UUS_SEIS'), 'casework.page.retention_unknown');
  assert.equal(retentionLabelKey(undefined), 'casework.page.retention_unknown');
  assert.equal(missingInfoStatusKey('UUS_SEIS'), 'casework.page.status_unknown');
  assert.equal(targetTypeKey('UUS_LIIK'), 'casework.page.target_unknown');
  assert.equal(retentionLabelKey('ACTIVE'), 'casework.page.retention_active');
  assert.equal(missingInfoStatusKey('OPEN'), 'casework.page.status_open');
  assert.equal(targetTypeKey('USER_DOCUMENT'), 'casework.page.target_user_document');
});

test('filtri ja punkti seisude loendid on samad mis teenuskihis', () => {
  assert.deepEqual(CASE_STATE_FILTERS.slice(1), serverKeys('../lib/casework/caseWorkAssist.js', 'RETENTION_STATE'));
  assert.deepEqual([...MISSING_STATUSES], serverKeys('../lib/casework/caseWorkMissingInfo.js', 'MISSING_INFO_STATUS'));
});

test('loendi päring: filter läheb serverisse, „kõik” ja tundmatu väärtus ei lähe', () => {
  assert.equal(caseListQuery({ limit: 25 }), 'limit=25');
  assert.equal(caseListQuery({ limit: 25, filter: 'ALL' }), 'limit=25');
  assert.equal(caseListQuery({ limit: 25, filter: 'READ_ONLY' }), 'limit=25&retentionState=READ_ONLY');
  assert.equal(caseListQuery({ limit: 25, filter: 'MIDAGI_MUUD' }), 'limit=25');
  assert.equal(caseListQuery({ limit: 25, filter: 'ACTIVE', cursor: 'a b' }), 'limit=25&retentionState=ACTIVE&cursor=a+b');
  const options = caseFilterOptions(t);
  assert.deepEqual(options.map((option) => option.value), [...CASE_STATE_FILTERS]);
  assert.equal(options[0].label, 'Kõik');
  assert.ok(options.every((option) => option.label && !RAW_ENUMS.test(option.label)));
});

test('loendi rida kannab nime, seisu sõnana ja aktiivse juhtumi järgmist kontakti', () => {
  const rows = caseListRows(
    [
      { id: 'c1', label: { text: 'M.K.' }, retentionState: 'ACTIVE', nextContactAt: '2026-10-12T09:00:00Z' },
      { id: 'c2', label: { labelKey: 'casework.label.erased_client' }, retentionState: 'READ_ONLY', nextContactAt: '2026-10-12T09:00:00Z' },
      { id: 'c3', label: null, retentionState: 'ARCHIVED' },
      { id: 'c4', label: { text: 'Uus seis' }, retentionState: 'PURGED' },
      { label: { text: 'ilma tunnuseta' } },
      null
    ],
    context
  );
  assert.deepEqual(rows.map((row) => row.id), ['c1', 'c2', 'c3', 'c4']);
  assert.deepEqual(rows.map((row) => row.title), ['M.K.', 'Kustutatud kliendiviide', 'Nimetu juhtum', 'Uus seis']);
  assert.deepEqual(rows.map((row) => row.state), ['Aktiivne', 'Kirjutuskaitstud', 'Arhiveeritud', 'Tundmatu seis']);
  assert.deepEqual(rows.map((row) => row.tone), ['ok', 'wait', 'quiet', 'quiet']);
  assert.match(rows[0].meta, /^Kontakt \d/);
  /* Kirjutuskaitstud juhtumil ei ole „järgmist kontakti”: tema töö on lõppenud. */
  assert.equal(rows[1].meta, '');
  for (const row of rows) assert.ok(!RAW_ENUMS.test(`${row.state} ${row.meta}`) && !row.state.includes('casework.'), row.id);
  assert.deepEqual(caseListRows(null, context), []);
  assert.equal(retentionTone('MIDAGI'), 'quiet');
});

test('juhtumi osad: töö ees, elutsükkel taga; töömaterjali osa ainult aktiivsel juhtumil', () => {
  const active = casePartKeys({ isActive: true });
  assert.deepEqual(active, [...CASE_PART_ORDER]);
  assert.deepEqual(casePartKeys({ isActive: false }), CASE_PART_ORDER.filter((key) => key !== 'material'));
  /* Tootereeglid: ettevalmistus pärast puuduvat infot, märge pärast
     ettevalmistust, STAR2 järjekord pärast märget, kliendiviide viimasena. */
  const index = (key) => active.indexOf(key);
  assert.ok(index('missing') < index('prep') && index('prep') < index('notes') && index('notes') < index('drafts'));
  assert.ok(index('drafts') < index('transfer') && index('retention') < index('material'));
  /* Heli seisab märkme kõrval: salvestatakse kohtumisel, enne kui midagi registrisse kantakse. */
  assert.equal(index('audio'), index('notes') + 1);
  assert.equal(active.at(-1), 'client');
});

test('osa plaat ütleb osa seisu sõnadega ega väida tühjust enne, kui loend on kohal', () => {
  const record = {
    retentionState: 'ACTIVE',
    nextContactAt: '2026-10-12T09:00:00Z',
    externalSystem: 'STAR2',
    externalReference: 'A-17'
  };
  const loading = caseParts({ record, counts: { items: 3, openMissingInfo: 2 }, lists: { prep: null, notes: null, drafts: null, transfer: null }, ...context });
  const byKey = Object.fromEntries(loading.map((part) => [part.key, part]));
  assert.deepEqual(loading.map((part) => part.key), [...CASE_PART_ORDER]);
  for (const part of loading) {
    assert.ok(part.label && part.short && !part.label.includes('casework.'), part.key);
    assert.ok(['done', 'empty'].includes(part.state), part.key);
  }
  assert.match(byKey.basics.summary, /^Järgmine kontakt \d/);
  assert.equal(byKey.star.summary, 'STAR2 · A-17');
  assert.equal(byKey.items.summary, 'Seoseid: 3');
  assert.equal(byKey.missing.summary, 'Lahtisi punkte: 2');
  assert.equal(byKey.missing.state, 'done');
  assert.equal(byKey.retention.summary, 'Aktiivne');
  for (const key of ['prep', 'notes', 'drafts', 'transfer']) {
    assert.equal(byKey[key].summary, undefined, `${key}: laadimata loend ei ole „tühi”`);
    assert.equal(byKey[key].free, true, key);
  }
  /* Kohtumise heli on oma osa: plaat ütleb, mis seal on, ja salvestuse ajal, et salvestus käib. */
  assert.deepEqual([byKey.audio.summary, byKey.audio.state, byKey.audio.free], ['Näost näkku kohtumise salvestamine', 'empty', true]);
  const recording = caseParts({ record, recording: true, ...context }).find((part) => part.key === 'audio');
  assert.deepEqual([recording.summary, recording.state], ['Salvestus käib', 'done']);
  for (const key of ['basics', 'star', 'retention', 'material', 'client']) assert.equal(byKey[key].free, false, key);

  const loaded = caseParts({
    record: { retentionState: 'READ_ONLY', clientErasedAt: '2026-10-01T00:00:00Z' },
    counts: { items: 0, openMissingInfo: 0 },
    lists: {
      prep: [{ id: 'p1', meetingAt: null }],
      notes: [],
      drafts: [
        { id: 'd1', draftType: 'TEGEVUS', transferState: 'MUSTAND' },
        { id: 'd2', draftType: 'TEGEVUS', transferState: 'MUSTAND' }
      ],
      transfer: [{ id: 'e1', kind: 'UUS_LIIK', draftType: 'TEGEVUS', createdAt: '2026-10-09T10:00:00Z' }]
    },
    ...context
  });
  const done = Object.fromEntries(loaded.map((part) => [part.key, part]));
  assert.ok(!('material' in done), 'kirjutuskaitstud juhtumil töömaterjali osa ei ole');
  /* Kirjutuskaitstud juhtumi plaat ei räägi järgmisest kontaktist: sinna ei saa enam midagi määrata. */
  assert.equal(done.basics.summary, undefined);
  assert.equal(done.star.summary, 'Viidet ei ole');
  assert.equal(done.items.summary, 'Seoseid ei ole.');
  assert.equal(done.missing.summary, 'Lahtisi punkte ei ole');
  assert.equal(done.prep.summary, 'Aeg kokku leppimata');
  assert.equal(done.prep.state, 'done');
  assert.equal(done.notes.summary, 'Märkmeid ei ole.');
  assert.equal(done.notes.state, 'empty');
  assert.equal(done.drafts.summary, 'Tegevus · Mustand ja teised');
  assert.equal(done.retention.summary, 'Kirjutuskaitstud');
  assert.equal(done.retention.state, 'done');
  assert.equal(done.client.summary, 'Kliendiviide on kustutatud.');
  /* Tundmatu liigi võtit ega enum'i nime plaadile ei lasta: jääb ainult aeg. */
  assert.ok(done.transfer.summary && !done.transfer.summary.includes('casework.') && !done.transfer.summary.includes('UUS_LIIK'));
  for (const part of loaded) assert.ok(!RAW_ENUMS.test(part.summary || ''), `${part.key}: ${part.summary}`);
});

test('seoste ja punktide read kannavad sõnu, mitte enum’i väärtusi', () => {
  const links = itemRows(
    [
      { id: 'i1', targetType: 'FIELD_VISIT', targetId: 'visit-1', createdAt: '2026-10-09T10:00:00Z' },
      { id: 'i2', targetType: 'UUS_LIIK', targetId: 'x' },
      { targetType: 'USER_DOCUMENT' }
    ],
    context
  );
  assert.deepEqual(links.map((row) => [row.id, row.type, row.ref]), [
    ['i1', 'Välitöökäik', 'visit-1'],
    ['i2', 'Tundmatu liik', 'x']
  ]);
  assert.match(links[0].meta, /^Seotud .*2026/);
  assert.equal(links[1].meta, '');

  const points = missingRows(
    [
      { id: 'm1', text: '<b>Puudub nõusolek</b>', status: 'OPEN', provenance: 'KLIENDI_OELDUD' },
      { id: 'm2', text: 'Vana', status: 'NOT_APPLICABLE', provenance: 'MIDAGI' },
      { id: 'm3', text: 'Uus', status: 'UUS_SEIS', provenance: 'DOKUMENDIST' }
    ],
    context
  );
  assert.deepEqual(points.map((row) => [row.status, row.statusText, row.tone]), [
    ['OPEN', 'Lahtine', 'wait'],
    ['NOT_APPLICABLE', 'Ei ole asjakohane', 'quiet'],
    [null, 'Tundmatu seis', 'quiet']
  ]);
  /* Tekst on tekst: märgistus jääb märkideks, keegi seda ei tõlgenda ega lühenda. */
  assert.equal(points[0].text, '<b>Puudub nõusolek</b>');
  assert.equal(points[0].provenance, 'Kliendi öeldu');
  assert.equal(points[1].provenance, 'Tundmatu info päritolu.');
  assert.deepEqual(missingStatusOptions(t), [
    { value: 'OPEN', label: 'Lahtine' },
    { value: 'RESOLVED', label: 'Lahendatud' },
    { value: 'NOT_APPLICABLE', label: 'Ei ole asjakohane' }
  ]);
});

test('elutsükkel on ühesuunaline; kell öeldakse välja enne arhiveerimist ja loendus on arhiveeritud juhtumil', () => {
  const active = retentionView({ record: { retentionState: 'ACTIVE' }, ...context });
  assert.deepEqual([active.next, active.warnClock, active.countdown, active.stateText], ['READ_ONLY', false, '', 'Aktiivne']);
  /* L23: kirjutuskaitse siire kella ei käivita ega kanna kella hoiatust. */
  const readOnly = retentionView({ record: { retentionState: 'READ_ONLY' }, retentionClock: { deletionAt: '2027-10-09T00:00:00Z', daysLeft: 365 }, ...context });
  assert.deepEqual([readOnly.next, readOnly.warnClock, readOnly.countdown], ['ARCHIVED', true, '']);
  const archived = retentionView({ record: { retentionState: 'ARCHIVED' }, retentionClock: { deletionAt: '2027-10-09T00:00:00Z', daysLeft: 12 }, ...context });
  assert.equal(archived.next, null);
  assert.equal(archived.warnClock, false);
  assert.match(archived.countdown, /2027/);
  /* Lause kehtib iga arvu kohta (ka „1”): päevade arv seisab omaette, mitte sõna „päeva” ees. */
  assert.match(archived.countdown, /Päevi on jäänud: 12\./);
  assert.match(retentionView({ record: { retentionState: 'ARCHIVED' }, retentionClock: { deletionAt: '2027-10-09T00:00:00Z', daysLeft: 1 }, ...context }).countdown, /Päevi on jäänud: 1\./);
  assert.ok(!archived.countdown.includes('{'));
  /* Arhiveeritud juhtum ilma kellata ei näita väljamõeldud kuupäeva; tundmatust seisust edasi ei saa. */
  assert.equal(retentionView({ record: { retentionState: 'ARCHIVED' }, retentionClock: null, ...context }).countdown, '');
  const unknown = retentionView({ record: { retentionState: 'PURGED' }, ...context });
  assert.deepEqual([unknown.next, unknown.stateText], [null, 'Tundmatu seis']);
});
