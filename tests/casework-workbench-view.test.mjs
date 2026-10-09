// Juhtumitöö laud: kuvaotsused, read ja tekstid.
//
// Pinna kommentaarid viitasid testidele, mida projektis ei olnud
// (`workbenchUi.test.js`, `workbenchView.test.js`): sektsioonide järjekord oli
// kahes kohas ilma kontrollita. See fail on see kontroll.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { workbenchRows, WORKSPACE_ROUTES } from '../components/casework/workbenchRows.js';
import { resolveSection, sectionSummary, WORKBENCH_SECTION_ORDER } from '../components/casework/workbenchView.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const t = (key, fallback) => (fallback === undefined ? key : `[${key}]`);
const context = { t, locale: 'et' };

test('sektsioonide järjekord pinnal on sama mis koondlugejas', () => {
  /* Teenuskihti ei impordita (ta toob Prisma kliendi): loeme loendi failist. */
  const source = read('../lib/casework/workbench.js');
  const block = source.slice(source.indexOf('WORKBENCH_SECTIONS'));
  const list = block.slice(block.indexOf('['), block.indexOf(']') + 1);
  const server = [...list.matchAll(/"([A-Za-z]+)"/g)].map((match) => match[1]);
  assert.ok(server.length >= 8, `koondlugeja loendist leiti ${server.length} sektsiooni`);
  assert.deepEqual([...WORKBENCH_SECTION_ORDER], server);
});

test('olek otsustab, mitte ridade arv', () => {
  assert.deepEqual(resolveSection({ state: 'OK', items: [1] }), { showItems: true, noticeKey: null, items: [1] });
  assert.equal(resolveSection({ state: 'EMPTY', items: [] }).noticeKey, 'casework.workbench.state_empty');
  /* Keelatud või aegunud sektsioon ei näita ridu ka siis, kui server need kaasa pani. */
  assert.equal(resolveSection({ state: 'FORBIDDEN', items: [1] }).showItems, false);
  assert.equal(resolveSection({ state: 'TIMEOUT', items: [1] }).showItems, false);
  /* Tundmatu olek ja „OK ilma ridadeta" on viga, mitte tühjus. */
  assert.equal(resolveSection({ state: 'NEW_STATE', items: [] }).noticeKey, 'casework.workbench.state_invalid');
  assert.equal(resolveSection({ state: 'OK', items: [] }).noticeKey, 'casework.workbench.state_invalid');
});

test('ülevaate plaat näitab esimest rida või tühjuse põhjust, mitte ridade arvu', () => {
  assert.equal(sectionSummary({ rows: [], noticeText: 'Siin ei ole praegu midagi.' }), 'Siin ei ole praegu midagi.');
  assert.equal(sectionSummary({ rows: [{ title: 'Juhtum A' }], moreText: 'ja teised' }), 'Juhtum A');
  const many = sectionSummary({ rows: [{ title: 'Juhtum A' }, { title: 'B' }, { title: 'C' }], moreText: 'ja teised' });
  assert.equal(many, 'Juhtum A ja teised');
  assert.ok(!/\d/.test(many), 'plaadil ei ole loendurit');
});

test('iga sektsiooni read kannavad pealkirja ja teed; tundmatu tööruumi rida jääb teeta', () => {
  const samples = {
    receivedPreInquiries: [{ ref: { id: 'p1', kind: 'pre_inquiry' }, title: 'workspace.kind.pre_inquiry', nextAction: { labelKey: 'x.y' } }],
    practiceReflection: [{ ref: { id: 'r1', kind: 'practice_reflection' }, title: 'Tekst' }],
    todaysContacts: [{ caseId: 'c 1', label: { text: 'Juhtum A' }, nextContactAt: '2026-10-09T09:00:00Z' }],
    upcomingContacts: [{ caseId: 'c2', label: { text: 'Juhtum B' } }],
    activePreparations: [{ prepId: 'm1', caseId: 'c1', label: { text: 'Juhtum A' }, openMissingInfoCount: 2 }],
    openMissingInfo: [{ itemId: 'i1', caseId: 'c1', text: 'Puudub nõusolek', provenance: 'KLIENDI_OELDUD' }],
    networkPreparation: [{ shareId: 's1', status: 'DRAFT' }],
    covisionPreparation: [{ seedId: 't1', title: '', status: 'DRAFT' }],
    draftsAwaitingTransfer: [{ draftId: 'd1', caseId: 'c1', draftType: 'CASE_BRIEF', transferState: 'READY' }],
    transferHistory: [{ eventId: 'e1', caseId: 'c1', kind: 'COPIED', draftType: 'CASE_BRIEF' }]
  };
  assert.deepEqual(Object.keys(samples).sort(), [...WORKBENCH_SECTION_ORDER].sort());
  for (const key of WORKBENCH_SECTION_ORDER) {
    const rows = workbenchRows(key, samples[key], context);
    assert.equal(rows.length, 1, key);
    assert.ok(rows[0].id && rows[0].title, `${key}: id ja pealkiri`);
    assert.ok(rows[0].href, `${key}: tee edasi`);
  }
  assert.equal(workbenchRows('todaysContacts', samples.todaysContacts, context)[0].href, '/juhtumid?juhtum=c%201');
  assert.equal(workbenchRows('receivedPreInquiries', samples.receivedPreInquiries, context)[0].href, WORKSPACE_ROUTES.pre_inquiry);
  assert.match(workbenchRows('activePreparations', samples.activePreparations, context)[0].badge, /missing_count/);
  const unknown = workbenchRows('receivedPreInquiries', [{ ref: { id: 'x', kind: 'something_new' }, title: 'Uus liik' }], context);
  assert.equal(unknown[0].href, null);
  assert.deepEqual(workbenchRows('noSuchSection', [{}], context), []);
  assert.deepEqual(workbenchRows('todaysContacts', null, context), []);
});

test('igal sektsioonil on nimi ja lühinimi kolmes keeles; laua sõnad kannavad oma kohatäitjaid', () => {
  for (const lang of ['et', 'en', 'ru']) {
    const texts = JSON.parse(read(`../messages/${lang}.json`)).casework.workbench;
    for (const key of WORKBENCH_SECTION_ORDER) {
      assert.equal(typeof texts[`section_${key}`], 'string', `${lang}: section_${key}`);
      const short = texts[`short_${key}`];
      assert.equal(typeof short, 'string', `${lang}: short_${key}`);
      assert.ok(short.length <= 18, `${lang}: short_${key} mahub kiirmenüüsse`);
    }
    assert.ok(texts.all_sections && texts.more_rows, lang);
    for (const mark of ['{current}', '{total}', '{label}']) assert.ok(texts.section_position.includes(mark), `${lang}: ${mark}`);
  }
});

test('laud on lugeja: pinnal ei ole kirjutavat päringut ega sektsiooni ridade loendurit', () => {
  const shell = read('../components/casework/CaseWorkbenchShell.jsx');
  assert.ok(!/method:\s*["'](POST|PUT|PATCH|DELETE)/.test(shell), 'ühtegi kirjutavat päringut');
  assert.ok(!shell.includes('rows.length}') && !shell.includes('items.length}'), 'ridade arvu ei kuvata');
  assert.ok(shell.includes('startWide'), 'leht avaneb kogu laua vaates');
  /* Osad ei ole sammud: numbreid ega vajutuse taha peidetud rida kiirmenüüs ei ole. */
  assert.ok(shell.split(/\r?\n/).some((line) => line.trim() === 'parts'), 'laud annab lavale `parts`');
  const rail = read('../components/stage/StepRail.jsx');
  const partsBranch = rail.slice(rail.indexOf('const rail = parts ? ('), rail.indexOf(') : ('));
  assert.ok(partsBranch.includes('onOverview') && !partsBranch.includes('styles.digit'), 'osade kiirmenüüs on „kogu laud” ja numbreid ei ole');
});
