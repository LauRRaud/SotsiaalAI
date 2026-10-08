import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { termMatcher, normalise, documentKind, compileGrid, passageMarks, documentTally, addPassage, isAbout, countsForCell, tallyGrid, cellState, cellText, publishedBy, markdownTable,
  NOT_COUNTED } from '../scripts/lib/rag-v2-coverage-map.mjs';

const grid = JSON.parse(fs.readFileSync(new URL('../scripts/lib/rag-v2-coverage-grid.json', import.meta.url), 'utf8'));
const has = (terms, text) => termMatcher(terms).test(normalise(text));

test('a term starts a word, may end it, may sit inside one, and may ask for several parts', () => {
  assert.equal(has(['dements'], 'Dementsusega inimese hooldamine'), true);
  assert.equal(has(['töötu$'], 'Ta on töötu.'), true);
  assert.equal(has(['töötu$'], 'Töötuba toimub reedel'), false);
  assert.equal(has(['vägival'], 'lähisuhtevägivald'), false);
  assert.equal(has(['*vägival'], 'lähisuhtevägivald'), true);
  assert.equal(has(['abivajav laps'], 'teade abivajavast\nlapsest'), false);
  assert.equal(has(['abivajava laps'], 'abivajava   lapse heaolu'), true);
  assert.equal(has(['väärkohtlemi+eaka'], 'eaka inimese väärkohtlemine'), true);
  assert.equal(has(['väärkohtlemi+eaka'], 'lapse väärkohtlemine'), false);
  assert.equal(has(['star$', 'star-'], 'Kanne tehakse STAR-is.'), true);
  assert.equal(has(['star$'], 'start'), false);
  assert.deepEqual(termMatcher(['dements', 'väärkohtlemi+eaka']).places('eaka väärkohtlemine ja dementsus; dementsus'), [23, 34, 5]);
  assert.throws(() => termMatcher(['']));
  assert.throws(() => termMatcher([]));
});

test('the money column reads a sum in euros', () => {
  const money = grid.columns.find(column => column.id === 'money').terms;
  assert.equal(has(money, 'Toetuse suurus on 200 eurot kuus.'), true);
  assert.equal(has(money, 'Kohatasu on 1 350,50 €.'), true);
  assert.equal(has(money, 'Euroopa Liidu liikmesriigid'), false);
  assert.equal(has(money, 'Teenus on tasuta.'), true);
});

test('every row and column of the grid compiles, has an id of its own, an opening sentence, laws and publishers', () => {
  const compiled = compileGrid(grid);
  assert.equal(compiled.rows.filter(row => row.group === 'A').length, 34);
  assert.equal(compiled.rows.filter(row => row.group === 'B').length, 15);
  assert.deepEqual(compiled.columns.map(column => column.id), ['explain', 'path', 'money', 'local', 'waiting', 'rights']);
  for (const row of compiled.rows) {
    assert.ok(row.opening?.length > 20, row.id); assert.ok(row.terms.length >= 5, row.id);
    assert.ok(Array.isArray(row.acts) && Array.isArray(row.owners) && row.owners.length, row.id);
  }
  assert.throws(() => compileGrid({ ...grid, rows: [...grid.rows, grid.rows[0]] }));
  assert.throws(() => compileGrid({ ...grid, rules: { ...grid.rules, near: 0 } }));
  // An opening sentence is a person's own words, not the field's terms: "Mees lööb mind" names no row by its terms.
  assert.deepEqual(passageMarks(compiled, compiled.rows.find(row => row.id === 'A9').opening).rows, []);
  assert.deepEqual(passageMarks(compiled, 'Dementsusega ema hooldekodu koht').rows.map(index => compiled.rows[index].id), ['A21', 'A23']);
});

test('what a document is: contacts and forms are not counted, an information material is', () => {
  assert.equal(documentKind({ type: 'legal_act', level: 'national' }), 'law');
  assert.equal(documentKind({ type: 'legal_act', level: 'municipal' }), 'municipal_act');
  assert.equal(documentKind({ type: 'web_page' }), 'official_page');
  assert.equal(documentKind({ type: 'information_material' }), 'guide');
  assert.equal(documentKind({ type: 'organization_page' }), 'organisation');
  assert.equal(documentKind({ type: 'research_report' }), 'study');
  assert.equal(documentKind({ type: 'file' }), 'journal');
  assert.equal(documentKind({ type: 'kov_service_info' }), 'municipal_record');
  assert.equal(documentKind({ type: 'municipal_contact' }), null);
  assert.ok(NOT_COUNTED.includes('application_form') && NOT_COUNTED.includes('official_contact') && !NOT_COUNTED.includes('information_material'));
  assert.equal(publishedBy(['töötukassa'], 'Töötukassa / SKA / Sotsiaalministeerium'), true);
  assert.equal(publishedBy(['notarite koda'], 'Sotsiaalkindlustusamet'), false);
  assert.equal(publishedBy(['aki'], ''), false);
});

const small = compileGrid({ rules: { about_share: 0.34, about_passages: 3, about_body_share: 0.5, about_body_passages: 3, enough_documents: 3, enough_municipalities: 2, near: 40 },
  columns: [{ id: 'explain', name: 'Selgitus', plain: { A: ['official_page', 'guide', 'organisation'], B: ['official_page', 'guide'] }, act_passages: 2 },
    { id: 'money', name: 'Raha', plain: { A: ['official_page', 'guide', 'organisation'], B: ['official_page', 'guide'] }, local: true, terms: ['eurot'] },
    { id: 'local', name: 'Kohalik', plain: [], local: true }, { id: 'rights', name: 'Õigused', plain: { A: ['official_page', 'guide', 'organisation'], B: ['official_page', 'guide'] }, terms: ['vaie$', 'vaide'] }],
  rows: [{ id: 'A1', group: 'A', name: 'Dementsus', terms: ['dements'] }, { id: 'A2', group: 'A', name: 'Võlad', terms: ['võlanõusta'] }, { id: 'B1', group: 'B', name: 'Eestkoste', terms: ['eestkost'] }] });
function document(kind, texts, municipality = '') {
  const tally = documentTally(small);
  for (const text of texts) addPassage(small, tally, passageMarks(small, text));
  return { kind, municipality, tally };
}

test('a column counts only near the row\'s term', () => {
  assert.deepEqual(passageMarks(small, 'Dementsusega inimese hooldus maksab 300 eurot.').cells, [[0, 0], [0, 1], [0, 2]]);
  const far = `Dementsus on ajuhaigus. ${'Muu jutt läheb siin edasi. '.repeat(4)}Bussipilet maksab 2 eurot.`;
  assert.deepEqual(passageMarks(small, far).cells, [[0, 0], [0, 2]], 'a sum far from the term is about something else');
});

test('a document is about a row by its own headings; a mention in the text of a handbook or a short page is not enough', () => {
  const BLANK = String.fromCharCode(10, 10);
  const handbook = document('guide', [`Käsiraamat > Sissejuhatus${BLANK}Dementsust mainitakse siin.`, `Käsiraamat > Meetod${BLANK}Muu tekst.`, `Käsiraamat > Lisa${BLANK}Muu.`, `Käsiraamat > Lõpp${BLANK}Muu.`]);
  const chapter = document('guide', [`Käsiraamat > Dementsus${BLANK}Mis see on.`, `Käsiraamat > Dementsus > Abi${BLANK}Kuhu pöörduda.`, `Käsiraamat > Muu${BLANK}Tekst.`]);
  const shortPage = document('organisation', [`Ühing: Partnerid${BLANK}Teeme koostööd dementsuse keskusega.`]);
  const focused = document('study', [`Uuring${BLANK}Dementsus Eestis.`, `Uuring${BLANK}Dementsusega inimeste arv.`, `Uuring${BLANK}Meetod.`]);
  assert.deepEqual(passageMarks(small, `Juhend > Dementsus${BLANK}Tekst.`).headed, [0]);
  assert.deepEqual(passageMarks(small, `Juhend > Sissejuhatus${BLANK}Dementsus.`).headed, []);
  assert.equal(isAbout(small.rules, handbook.tally, 0), false);
  assert.equal(isAbout(small.rules, chapter.tally, 0), true);
  assert.equal(isAbout(small.rules, shortPage.tally, 0), false);
  assert.equal(isAbout(small.rules, focused.tally, 0), true, 'half of the passages of a longer document');
});

test('an act counts for a cell by one passage; anything else only when it is about the row', () => {
  const guide = document('guide', ['Dementsus on ajuhaigus.', 'Dementsusega inimese hooldus maksab 300 eurot.', 'Muu.']);
  const passing = document('study', ['Uuring.', 'Meetod.', 'Valim.', 'Dementsust mainiti korra, 5 eurot.']);
  const law = document('law', ['§ 1.', '§ 2.', '§ 3.', '§ 4.', '§ 5.', '§ 6. Eestkostja võib esitada vaide.']);
  assert.equal(isAbout(small.rules, guide.tally, 0), true);
  assert.equal(isAbout(small.rules, passing.tally, 0), false);
  assert.equal(countsForCell(small, guide, 0, 1), true);
  assert.equal(countsForCell(small, guide, 0, 3), false);
  assert.equal(countsForCell(small, passing, 0, 1), false);
  assert.equal(countsForCell(small, law, 2, 3), true);
  assert.equal(countsForCell(small, law, 2, 0), false, 'one passage of an act is not an explanation');
});

test('the states of a cell: enough, thin, only an act, only research, nothing; an organisation page is no guidance for a specialist', () => {
  const rows = tallyGrid(small, [
    document('official_page', ['Dementsus: mis see on.']), document('organisation', ['Dementsus ja lähedased.']), document('guide', ['Dementsusega inimese õigused: vaie.']),
    document('journal', ['Võlanõustamine Eestis: artikkel.']), document('municipal_record', ['Võlanõustamisteenus, 10 eurot.'], 'Rae vald'), document('municipal_act', ['Võlanõustamise kord.'], 'Saue vald'),
    document('law', ['Eestkoste seadmine.', 'Eestkostja ülesanded; vaie.']), document('organisation', ['Eestkoste: nõuanded lähedasele.']),
  ]);
  const state = (row, column) => rows[row].cells[column].state;
  assert.equal(state(0, 0), 'enough'); assert.equal(cellText(rows[0].cells[0]), '● 3');
  assert.equal(state(0, 3), 'thin'); assert.equal(cellText(rows[0].cells[3]), '◐ 1');
  assert.equal(state(0, 2), 'none'); assert.equal(cellText(rows[0].cells[2]), '–');
  assert.equal(state(1, 0), 'research_only', 'an article is not practical guidance, and one passage of an act explains nothing'); assert.equal(state(1, 3), 'none');
  assert.equal(state(1, 2), 'enough'); assert.equal(cellText(rows[1].cells[2]), '● KOV 2');
  assert.equal(state(1, 1), 'thin'); assert.equal(cellText(rows[1].cells[1]), '◐ KOV 1');
  assert.equal(state(2, 0), 'act_only', 'group B does not count the organisation page'); assert.equal(cellText(rows[2].cells[3]), '§ 1');
  assert.equal(rows[2].about.organisation, 1); assert.equal(rows[1].about.journal, 1); assert.equal(rows[0].passages.guide, 1);
  assert.deepEqual(cellState(small.rules, small.columns[0], { kinds: { guide: 0, organisation: 4, law: 0, municipal_act: 0, study: 2, journal: 3 }, municipalities: 0 }, 'B'),
    { state: 'research_only', basis: null, plain: 0, research: 5, acts: 0 });
  const table = markdownTable(small, rows, 'A', [{ name: 'Lisa', text: row => row.id }]);
  assert.equal(table.split('\n').length, 4);
  assert.ok(table.includes('| A2 Võlad | ○ 1 | ◐ KOV 1 | ● KOV 2 | – | A2 |'), table);
});
