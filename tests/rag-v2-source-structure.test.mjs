import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { hash, configuration, validateBundle } from '../lib/rag-v2/contracts.js';
import { structure } from '../lib/rag-v2/parser.js';
import { loadSnapshot } from '../lib/rag-v2/search/snapshot.js';
import { modelProjection, modelSourceMetadata, resolveModelReference } from '../lib/rag-v2/search/model-context.js';
import { KNOWLEDGE_SCHEMA } from '../lib/rag-v2/knowledge.js';
import { knowledgePreparationPlan, knowledgePreparationDraft } from '../lib/rag-v2/knowledge-preparation.js';
import { adaptMetadata } from '../lib/rag-v2/metadata-adapter.js';
import { metadataValue } from '../lib/rag-v2/metadata-values.js';
import { filtersMatch } from '../lib/rag-v2/search/ranking.js';
import { directoryScope, retrievalDirectory } from '../lib/rag-v2/search/discovery.js';
import { embeddingConfig, indexUnit } from '../lib/rag-v2/search/embedding.js';
import { sourceEntry } from '../lib/rag-v2/search/retrieval.js';
import { registeredSource } from '../lib/rag-v2/registered-source.js';
import { textRanges, unitForSpan, chunkSourceLocations } from '../lib/rag-v2/source-locations.js';
import { verifiedBundle } from '../lib/rag-v2/search/snapshot.js';
import { runtimeAdapters } from '../lib/rag-v2/pilot/retrieval.js';
import { evidenceHtml } from '../lib/rag-v2/search/export.js';
import { PilotService } from '../lib/rag-v2/pilot/service.js';
import { pilotChatResult } from '../lib/chat/m4PilotClientContract.js';
import { referenceSpans, splitReferenceLists } from '../lib/rag-v2/chunking.js';

let root, networkCalls = 0;
const savedFetch = globalThis.fetch, savedConnect = net.Socket.prototype.connect;
const rights = { access: 'local_private', usage: 'development_only' }, tenant = 'source-structure-test';
const profile = { id: 'generic-fixtures', version: '1', months: [], categoryLabels: [] };
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-source-structure-'));
  globalThis.fetch = net.Socket.prototype.connect = () => { networkCalls++; throw Error('unexpected_network'); };
});
after(async () => {
  globalThis.fetch = savedFetch; net.Socket.prototype.connect = savedConnect;
  const target = path.resolve(root);
  assert(target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('rag-v2-source-structure-'));
  await fs.rm(target, { recursive: true, force: true });
  assert.equal(networkCalls, 0);
});
async function source(name, format, bytes, extra = {}) {
  const dir = path.join(root, name); await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `source.${format}`), bytes);
  const metadata = { document_id: name, title: `Fixture ${name}`, source_type: 'fixture', language: 'en', source_path: `source.${format}`, source_format: format, ...extra };
  return { tenant, inputRoot: dir, metadata, storeRoot: path.join(dir, 'store'), rights, profile };
}
function exactLocations(bundle) {
  for (const span of bundle.spans) assert.equal(unitForSpan(bundle, span).raw_text.slice(span.start, span.end), span.source_text);
  for (const chunk of bundle.chunks) {
    assert(chunk.source_text.length <= bundle.version.processing_config.chunkMaxChars);
    assert(chunk.source_locations.length);
  }
}

test('two PDF columns are read down each column, below a spanning heading', () => {
  const items = [{ text: 'Spanning heading', x: 50, y: 760, width: 500, height: 22, item_index: 0 }];
  for (let i = 0; i < 6; i++) {
    items.push({ text: `Left paragraph line ${i}`, x: 50, y: 700 - i * 16, width: 200, height: 12, item_index: i * 2 + 1 });
    items.push({ text: `Right paragraph line ${i}`, x: 330, y: 700 - i * 16, width: 200, height: 12, item_index: i * 2 + 2 });
  }
  const result = structure({ pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800], items }] },
    { tenant_id: tenant, document_version_id: 'version-test' }, configuration());
  assert.equal(result.pages[0].columns, 2);
  const text = result.pages[0].raw_text;
  assert(text.indexOf('Left paragraph line 5') < text.indexOf('Right paragraph line 0'));
  assert(text.startsWith('Spanning heading\n'));
});

test('a narrow PDF gutter and rotated margin preserve column order and indented paragraphs', async () => {
  const items = [{ text: 'Vertical archive stamp', x: 17, y: 165, width: 476, height: 20, rotation: 90, item_index: 0 }];
  for (let i = 0; i < 8; i++) {
    items.push({ text: `Left line ${i}`, x: 42, y: 230 - i * 13, width: 177, height: 11, item_index: i * 2 + 1 });
    items.push({ text: `Right line ${i}`, x: 234, y: 230 - i * 13, width: 177, height: 11, item_index: i * 2 + 2 });
  }
  const scope = { tenant_id: tenant, document_version_id: 'narrow-columns' };
  const result = structure({ pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 468, 680], items }] }, scope, configuration());
  assert.equal(result.pages[0].columns, 2);
  assert(result.pages[0].raw_text.indexOf('Left line 7') < result.pages[0].raw_text.indexOf('Right line 0'));
  assert(!result.spans.some(span => span.source_text.includes('archive stamp')));
  assert(result.removed.some(span => span.source_text === 'Vertical archive stamp'));

  const lines = ['First short paragraph line one', 'First short paragraph line two',
    'Second indented paragraph is a longer line one.', 'Second paragraph continues on the next line.'];
  const parsed = { pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800], items: lines.map((text, i) =>
    ({ text, x: i === 2 ? 52 : 40, y: 700 - i * 13, height: 11, width: 400, item_index: i })) }] };
  const { bundle } = await ingest({ ...await source('indented-pdf', 'pdf', '%PDF-1.4 indented'), config: { chunkMaxChars: 120 } }, { parsePdf: async () => parsed });
  assert.deepEqual(bundle.chunks.map(chunk => chunk.source_text), [lines.slice(0, 2).join('\n'), lines.slice(2).join('\n')]);
});

test('page numbers, issue labels and running heads at the page edge are removed; margin body text stays', () => {
  const items = [
    { text: '16 SOTSIAALTÖÖ KORRALDUS', x: 50, y: 770, width: 200, height: 9, item_index: 0 },
    { text: 'Body line near the top edge stays', x: 50, y: 740, width: 400, height: 11, item_index: 1 },
  ];
  for (let i = 0; i < 6; i++) items.push({ text: `Body paragraph line ${i}`, x: 50, y: 600 - i * 14, width: 400, height: 11, item_index: 2 + i });
  items.push({ text: 'Body line near the bottom edge stays', x: 50, y: 60, width: 400, height: 11, item_index: 8 });
  items.push({ text: 'S O T S I A A L T Ö Ö', x: 50, y: 30, width: 150, height: 8, item_index: 9 });
  items.push({ text: '1 / 2 0 1 7', x: 400, y: 30, width: 60, height: 8, item_index: 10 });
  const result = structure({ pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800], items }] },
    { tenant_id: tenant, document_version_id: 'page-marks' }, configuration());
  assert.deepEqual(result.removed.map(span => [span.source_text, span.reason]).sort(),
    [['16 SOTSIAALTÖÖ KORRALDUS', 'page_mark'], ['S O T S I A A L T Ö Ö 1 / 2 0 1 7', 'page_mark']]);
  assert(result.spans.some(span => span.source_text === 'Body line near the top edge stays'));
  assert(result.spans.some(span => span.source_text === 'Body line near the bottom edge stays'));
});

test('retrieval text rejoins hyphenated lines and column breaks; reference lists stay source text only', async () => {
  const line = (text, y, extra = {}) => ({ text, x: 50, y, width: 400, height: 11, font_name: 'F1', ...extra });
  const items = [
    line('Sotsiaalhoolekande uuendused', 760, { height: 20, font_name: 'F2' }),
    line('Uus sotsiaal-', 700), line('hoolekande seadus kehtib sotsiaal-', 686), line('ja tervishoiutöötajatele ning COVID-', 672),
    line('19 ajal loodud korrad jäid kehtima. Järg-', 658), line('mine lõik algab siin.', 644),
    line('Kasutatud kirjandusest ja intervjuudest selgus, et plaan aitab.', 630),
    line('Viidatud allikad', 600, { height: 9 }), line('Tamm, M. (2020). Sotsiaaltöö alused. Tallinn.', 586, { height: 9 }),
    line('Kask, K. (2019). Hoolekanne. https://example.org', 574, { height: 9 }),
  ].map((item, item_index) => ({ ...item, item_index }));
  const parsed = { info: {}, pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800], items }] };
  const { bundle } = await ingest(await source('dehyphenation', 'pdf', '%PDF-1.4 dehyphenation'), { parsePdf: async () => parsed });
  const text = bundle.chunks.map(chunk => chunk.retrieval_text).join('\n');
  assert.match(text, /Uus sotsiaalhoolekande seadus kehtib sotsiaal- ja tervishoiutöötajatele ning COVID-19 ajal/u);
  assert.match(text, /Järgmine lõik algab siin\./u);
  assert.match(text, /Kasutatud kirjandusest ja intervjuudest selgus/u);
  assert(!text.includes('Tamm, M.') && !text.includes('Kask, K.'));
  assert(bundle.spans.some(span => span.source_text.startsWith('Tamm, M.')));
  assert(bundle.report.warnings.some(warning => warning.code === 'reference_list_not_chunked'));
  exactLocations(bundle);
});

test('reduplicated compounds keep their hyphen; only a standalone first-page date line can conflict with the year', async () => {
  const months = ['jaanuar', 'veebruar', 'märts', 'aprill', 'mai', 'juuni', 'juuli', 'august', 'september', 'oktoober', 'november', 'detsember'];
  const page = lines => ({ info: {}, pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800],
    items: lines.map((text, i) => ({ text, x: 50, y: 700 - i * 14, width: 400, height: 11, item_index: i })) }] });
  const run = async (name, lines) => (await ingest({ ...await source(name, 'pdf', `%PDF-1.4 ${name}`, { year: 2025 }), profile: { ...profile, months } },
    { parsePdf: async () => page(lines) })).bundle;
  const reduplicated = await run('reduplicated', ['Olukord paranes järk-', 'järgult ja aeglaselt.']);
  assert.match(reduplicated.chunks[0].retrieval_text, /järk-järgult/u);
  const footnote = await run('footnote-date', ['Artikli algus on siin.', '3 Registri andmed 1. jaanuar 2009 ja hiljem.']);
  assert(!footnote.report.warnings.some(warning => warning.code === 'publication_year_conflict'));
  const dated = await run('dated-report', ['Tallinn, 16. jaanuar 2023', 'Aruande sisu algab siin.']);
  assert(dated.report.warnings.some(warning => warning.code === 'publication_year_conflict'));
  const labelled = await run('labelled-date', ['Uurimus/analüüs 06. juuni 2025', 'Artikli sisu algab siin.']);
  assert.equal(labelled.document.fields.publication_date.candidates[0].value, '2025-06-06');
  // A year the metadata file confirmed after review keeps the first-page date as a candidate only.
  const confirmation = { field: 'year', value: 2025, confirmed_by: 'synthetic-owner', confirmed_at: '2026-09-25', basis: 'Issue year of the journal' };
  const confirmed = (await ingest({ ...await source('dated-confirmed', 'pdf', '%PDF-1.4 dated-confirmed',
    { year: 2025, metadata_variants: [{ metadata: { year: 2023 } }], metadata_confirmations: [confirmation] }), profile: { ...profile, months } },
  { parsePdf: async () => page(['Tallinn, 16. jaanuar 2023', 'Aruande sisu algab siin.']) })).bundle;
  assert(!confirmed.report.warnings.some(warning => warning.code.endsWith('_conflict')));
  assert.equal(confirmed.document.fields.publication_year.review_state, 'confirmed');
  assert.equal(confirmed.document.fields.publication_date.candidates[0].value, '2023-01-16');
});

test('only a whole reference-list heading over bibliographic entries leaves retrieval', async () => {
  const html = '<html><body><article><h1>Kasutatud allikad toetuse määramisel</h1><p>Teenuse saamiseks tuleb esitada avaldus kohalikule omavalitsusele.</p>'
    + '<h2>Allikad</h2><p>Abi saab ka sotsiaaltöötajalt.</p>'
    + '<h2>Kirjandus:</h2><p>Tamm, M. (2020). Sotsiaaltöö alused.</p><p>Kask, K. (2019). Hoolekanne.</p></article></body></html>';
  const { bundle } = await ingest(await source('html-references', 'html', html));
  const text = bundle.chunks.map(chunk => chunk.retrieval_text).join('\n');
  assert.match(text, /Teenuse saamiseks tuleb esitada avaldus/u);
  assert.match(text, /Abi saab ka sotsiaaltöötajalt/u);
  assert(!text.includes('Tamm, M.'));
  exactLocations(bundle);
});

test('long sections split into even chunks at sentence ends', async () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ text: i % 2 ? `Lause ${i} lõpeb siin punktiga.` : `Lause ${i} algab pikalt ja jätkub`,
    x: 50, y: 700 - i * 14, width: 400, height: 11, item_index: i }));
  const parsed = { info: {}, pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800], items }] };
  const { bundle } = await ingest({ ...await source('sentence-cuts', 'pdf', '%PDF-1.4 sentences'), config: { chunkMaxChars: 200 } }, { parsePdf: async () => parsed });
  assert(bundle.chunks.length >= 2);
  assert(bundle.chunks.slice(0, -1).every(chunk => chunk.source_text.endsWith('punktiga.')));
  const sizes = bundle.chunks.map(chunk => chunk.source_text.length);
  assert(Math.min(...sizes) >= Math.max(...sizes) * 0.5, `uneven chunks ${sizes}`);
  exactLocations(bundle);
});

test('body-size subheadings, repeated pull quotes, ordinal dates and touching items', () => {
  const quote = 'Kogukond ja inimesed, kellega luua tähenduslikud suhted, tagavad sotsiaalse tervise.';
  const body = (text, y, extra = {}) => ({ text, x: 50, y, width: 400, height: 11, font_name: 'F1', ...extra });
  const items = [
    body('1. jaanuarist 2016 hakkas kehtima uus seadus ja', 700), body('selle rakendamine algas kohe.', 686),
    body('Kasulikud teabepäevad', 650, { font_name: 'F2' }),
    body('Teabepäevadel räägiti sellest, et', 636), body(quote.slice(0, 45), 622), body(quote.slice(45), 608),
    body(quote.slice(0, 40), 570, { font_name: 'F3', x: 90, width: 300 }), body(quote.slice(40), 556, { font_name: 'F3', x: 90, width: 300 }),
    body('Päeva lõpus räägiti ka muust ja kõik said sõna', 520), { text: '.', x: 450, y: 520, width: 3, height: 11, font_name: 'F1' },
    body('Seadus (SHS)', 506, { width: 60 }), { text: '1', x: 110.5, y: 510, width: 3, height: 6, font_name: 'F1' },
    body('on uus.', 506, { x: 116, width: 40 }),
  ].map((item, item_index) => ({ ...item, item_index }));
  const result = structure({ pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800], items }] },
    { tenant_id: tenant, document_version_id: 'subheadings' }, configuration());
  assert(result.sections.some(section => section.title === 'Kasulikud teabepäevad'));
  assert.equal(result.removed.filter(span => span.reason === 'repeated_pull_quote').length, 2);
  assert(!result.blocks.some(block => block.kind === 'list_item'));
  assert(result.spans.some(span => span.source_text === 'Päeva lõpus räägiti ka muust ja kõik said sõna.'));
  assert(result.spans.some(span => span.source_text === 'Seadus (SHS) 1 on uus.'));
});

test('single-font (OCR) text finds subheadings by geometry, with lower-case continuation lines', () => {
  const line = (text, y) => ({ text, x: 50, y, width: text.length * 4.4, height: 9, font_name: 'F1' });
  const paragraph = (start, words, last) => Array.from({ length: 6 }, (_, i) =>
    line(i === 5 ? last : `${words} kujuneb igapäevaselt ${i + 1}. korda nii`, start - i * 13));
  const items = [
    ...paragraph(760, 'Sotsiaaltöö praktika', 'selle nimel, et muuta elu paremaks.'),
    line('Väärtuste, ootuste ja', 669), line('normide mitmesuunaline', 656), line('mõju praktikas', 639),
    ...paragraph(626, 'Kuigi määratlus', 'et praktika jääb siiski kõigile.'),
    line('Kodutus Eestis:', 535), line('teooria ja praktika', 522),
    ...paragraph(509, 'Kodutu määratlus', 'seda näitab ka praktika sageli.'),
    line('tal teenust kasutada.', 431),
    ...paragraph(418, 'Järgmine lõik algab', 'ja lõpeb siin kenasti.'),
  ].map((item, item_index) => ({ ...item, item_index }));
  const result = structure({ pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800], items }] },
    { tenant_id: tenant, document_version_id: 'ocr-subheadings' }, configuration());
  const titles = result.sections.map(section => section.title).filter(Boolean);
  assert(titles.includes('Väärtuste, ootuste ja normide mitmesuunaline mõju praktikas'), titles.join(' | '));
  assert(titles.includes('Kodutus Eestis: teooria ja praktika'), titles.join(' | '));
  assert(!titles.some(title => /tal teenust|Järgmine/u.test(title)), titles.join(' | '));
});

test('list items, captions, contents lines, entries and running-on body lines are not headings; real ones stay', () => {
  const line = (text, y, font = 'F1', height = 11) => ({ text, x: 50, y, width: 400, height, font_name: font });
  const paragraph = (y, n = 4) => Array.from({ length: n }, (_, i) => line(`Sisulõigu rida ${i + 1} kirjeldab teenuse korraldust üsna pikalt edasi.`, y - i * 13));
  const items = [
    ...paragraph(780), line('950 • Täiendavate sotsiaaltöö valdkonna', 720, 'F2'), ...paragraph(700),
    line('Joonis 3. Teenuste rahulolu hinnangud', 630, 'F2'), ...paragraph(610),
    line('Kasutatud kirjandus.................. 12', 540, 'F2'), ...paragraph(520),
    line('Trost, J. (1999). Family as a set of dyads', 450, 'F2'), ...paragraph(430),
    line('Eesti Vabariigi põhiseadus toob välja, et kõik on seaduse ees võrdsed. Isikute õigusi ja vabadusi tohib', 360, 'F2'),
    line('piirata ainult seaduses sätestatud juhtudel ja korras, mis on põhiseadusega kooskõlas', 347), ...paragraph(334),
    line('MÄRKSÕNAD', 270, 'F2'), line('töötus, tööotsing, tööturuaktiivsus, majanduslik toimetulek ja teised', 257), ...paragraph(244),
    line('H indamisteema 6 . Vähenenud töövõimega inimese', 180, 'F3', 18), line('teenuste ja toetuste pakett', 162, 'F3', 18), ...paragraph(140),
    line('SUBJEKTIIVNE HEAOLU LASTE HINNANGUL', 66, 'F4', 16), ...paragraph(48),
  ].map((item, item_index) => ({ ...item, item_index }));
  const result = structure({ pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 820], items }] },
    { tenant_id: tenant, document_version_id: 'heading-rules' }, configuration());
  const titles = result.sections.map(section => section.title).filter(Boolean);
  for (const falseTitle of ['950 • Täiendavate', 'Joonis 3.', 'Kasutatud kirjandus', 'Trost, J.', 'Eesti Vabariigi põhiseadus']) {
    assert(!titles.some(title => title.startsWith(falseTitle)), `${falseTitle} | ${titles.join(' | ')}`);
  }
  for (const genuine of ['MÄRKSÕNAD', 'H indamisteema 6 . Vähenenud töövõimega inimese teenuste ja toetuste pakett', 'SUBJEKTIIVNE HEAOLU LASTE HINNANGUL']) {
    assert(titles.includes(genuine), `${genuine} | ${titles.join(' | ')}`);
  }
});

test('a reference list ends at the next article\'s display title; a running head inside the list does not end it', async () => {
  const line = (text, y, font = 'F1', height = 11) => ({ text, x: 50, y, width: 400, height, font_name: font });
  const entries = (y, texts) => texts.map((text, i) => line(text, y - i * 13));
  const intro = ['Lapse õigused on inimõigused ja neid ei saa tema heaolust lahutada. Artikkel käsitleb', 'seda, kuidas lapsed hindavad oma teadlikkust lapse õigustest ning konventsioonist',
    'rahvusvahelise laste heaolu uuringu teise laine andmetel (2018) ning võrdleb neid', '1997. aastal tehtud uuringu andmetega, mis võimaldab võrrelda eri aegu omavahel.'];
  const pages = [[line('Eelmine artikkel lõpeb siin pika lausega, mis kirjeldab tulemusi ja järeldusi.', 780), line('Teine rida lõpetab eelmise artikli sisu korralikult.', 767),
    line('Kirjandus', 730, 'F2'),
    ...entries(700, ['Alderson, P. (2008). Young children’s rights. London: Jessica Kingsley.', 'Ben-Arieh, A. (2017). Children’s well-being. Child Indicators Research, 10(1), 1–8.',
      'Casas, F. (2011). Subjective social indicators. Child Indicators Research, 4(4), 555–575.']),
    line('SUBJEKTIIVNE HEAOLU JA ÕIGUSED LASTE HINNANGUL', 600, 'F3', 16), line('Kadri Soo, Dagmar Kutsar', 580, 'F4'), line('Tartu Ülikool', 567, 'F4'),
    ...entries(540, intro)],
  [line('Sissejuhatus lõpeb ja algab uus osa, mille järel tuleb viiteloend teisest artiklist.', 780), line('Viidatud allikad', 740, 'F2'),
    ...entries(710, ['Kutsar, D. (2019). Children’s rights. Social Indicators Research, 6(2), 11–20.', 'Soo, K. (2016). Laste heaolu. Tallinn: Statistikaamet.']),
    line('HAIGLATELE JA HOOLDEKODUDELE 51', 670, 'F3', 16),
    ...entries(650, ['Trost, J. (1999). Family as a set of dyads. Marriage & Family Review, 14(1), 1–20.', 'Tamm, M. (2003). Lastekaitse. Tartu: Tartu Ülikooli Kirjastus.',
      'Veerman, J. (2010). Kids first. Journal of Youth, 5(3), 44–51.'])]];
  const parsed = { pages: pages.map((items, index) => ({ pdf_page: index + 1, parser_page_index: index, view: [0, 0, 600, 820],
    items: items.map((item, item_index) => ({ ...item, item_index })) })) };
  const { bundle } = await ingest(await source('reference-extent', 'pdf', '%PDF-1.4 reference-extent'), { parsePdf: async () => parsed });
  const text = bundle.chunks.map(chunk => chunk.retrieval_text).join('\n');
  assert.match(text, /Lapse õigused on inimõigused/u);
  assert.match(text, /võimaldab võrrelda eri aegu/u);
  for (const entry of ['Alderson, P.', 'Casas, F.', 'Kutsar, D.', 'Trost, J.', 'Veerman, J.']) assert(!text.includes(entry), entry);
  // The next article is its own section: its title heads the text and no chunk carries the list's name.
  const article = bundle.chunks.filter(chunk => chunk.retrieval_text.includes('Lapse õigused on inimõigused'));
  assert(article.length && article.every(chunk => chunk.section_path.at(-1) === 'SUBJEKTIIVNE HEAOLU JA ÕIGUSED LASTE HINNANGUL'), article.map(c => c.section_path.join(' > ')).join(' | '));
  assert(bundle.chunks.every(chunk => !/^(?:Kirjandus|Viidatud allikad)$/u.test(chunk.section_path.at(-1))));
  // The warning counts the lines actually left out and names the section the text continues in.
  const warning = bundle.report.warnings.find(item => item.code === 'reference_list_not_chunked');
  const references = new Set(bundle.sections.filter(section => /^(?:Kirjandus|Viidatud allikad)$/u.test(section.title)).map(section => section.id));
  const chunked = new Set(bundle.chunks.flatMap(chunk => chunk.span_ids));
  const leftOut = bundle.spans.filter(span => references.has(span.parent_section_id));
  assert(leftOut.every(span => !chunked.has(span.id)));
  assert(warning.detail.startsWith(`${leftOut.length} reference list lines`), warning.detail);
  assert.deepEqual(warning.continued_section_ids, bundle.sections.filter(section => section.title === 'SUBJEKTIIVNE HEAOLU JA ÕIGUSED LASTE HINNANGUL').map(section => section.id));
});

test('text after a reference list starts at a chapter title in its own font; without a title it drops the list\'s name', async () => {
  const line = (text, y, font = 'F1', height = 11) => ({ text, x: 50, y, width: 400, height, font_name: font });
  const body = (y, n, words) => Array.from({ length: n }, (_, i) => line(`${words} rida ${i + 1} jätkab peatüki sisu ja kirjeldab ravi korraldust edasi`, y - i * 13));
  const entries = ['1. Tamm M. Long COVID. Lancet. 2021;21(3):313-314. doi: 10.1016/S1473', '2. Kask K. Recovery. BMJ. 2020;5(2):11-20. https://example.org/a',
    '3. Mets P. Rehabilitation. JAMA. 2019;7(1):1-9. https://example.org/b'];
  const parsed = { info: {}, pages: [
    { pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 820], items: [line('4.8. Nahanähud pika covidi korral', 760, 'F2'), ...body(740, 6, 'Esimene'),
      line('Viited', 640, 'F2'), ...entries.map((text, i) => line(text, 620 - i * 13))] },
    // As in the guideline, the authors' line is not followed by body-font text, so it is no subheading.
    // A reference-like line later in the chapter ("juhend nr 5") does not carry the list into it.
    { pdf_page: 2, parser_page_index: 1, view: [0, 0, 600, 820], items: [line('4.9. Tromboos pika covidi korral', 760, 'F2'), line('Alice Lill, Piret Rospu', 740, 'F3'),
      line('COVID-19 on trombogeenne haigus ja selle ravi nõuab pikemat tähelepanu.', 720, 'F4'), ...body(707, 8, 'Tromboosi'),
      line('Ravi korraldatakse juhend nr 5 alusel ja see kehtib kõigile.', 590), ...body(577, 6, 'Järelravi')] },
  ].map(page => ({ ...page, items: page.items.map((item, item_index) => ({ ...item, item_index })) })) };
  const { bundle } = await ingest(await source('reference-chapter', 'pdf', '%PDF-1.4 reference-chapter'), { parsePdf: async () => parsed });
  const chapter = bundle.chunks.filter(chunk => chunk.retrieval_text.includes('Tromboosi rida'));
  assert(chapter.length && chapter.every(chunk => chunk.section_path.at(-1) === '4.9. Tromboos pika covidi korral'), chapter.map(c => c.section_path.join(' > ')).join(' | '));
  assert(chapter[0].retrieval_text.includes('Alice Lill, Piret Rospu'));
  assert(!bundle.chunks.some(chunk => chunk.retrieval_text.includes('Lancet')));
  assert(bundle.chunks.filter(chunk => chunk.retrieval_text.includes('Järelravi rida')).every(chunk => chunk.section_path.at(-1) === '4.9. Tromboos pika covidi korral'));
  // A numbered list ("[1] …, vol. 3, …") counts as bibliography too.
  const numbered = { info: {}, pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 820], items: [line('Uuringu tulemused', 780, 'F2'), ...body(760, 6, 'Tulemuste'),
    line('Kasutatud kirjandus', 670, 'F2'), line('[1] A. Tamm, “Laste vaimne tervis,” Eesti Arst, vol. 3, pp. 1–9, 2020.', 650),
    line('[2] K. Kask and M. Mets, “Noorte heaolu,” Sotsiaaltöö, vol. 7, pp. 10–19, 2019.', 637), line('[3] P. Saar et al., “Ärevus koolis,” Pediaatria, vol. 2, pp. 5–8, 2021.', 624)]
    .map((item, item_index) => ({ ...item, item_index })) }] };
  const { bundle: ieee } = await ingest(await source('reference-numbered', 'pdf', '%PDF-1.4 reference-numbered'), { parsePdf: async () => numbered });
  assert(ieee.chunks.some(chunk => chunk.retrieval_text.includes('Tulemuste rida')));
  assert(!ieee.chunks.some(chunk => chunk.retrieval_text.includes('Laste vaimne tervis')));
  // HTML: the text after the list keeps the article's path without the list's name.
  const html = '<html><body><article><h1>Hoolekanne</h1><p>Teenuse sisu kirjeldus on siin.</p><h2>Kasutatud kirjandus</h2>'
    + '<p>Tamm, M. (2020). Sotsiaaltöö alused. Tallinn.</p><p>Kask, K. (2019). Hoolekanne. https://example.org</p>'
    + '<p>Artikli autor töötab sotsiaaltöötajana.</p><p>Toimetus tänab kõiki kaasautoreid nõu eest.</p><p>Artikkel ilmus esmakordselt ajakirjas ja seda on täiendatud 2024. aastal.</p></article></body></html>';
  const { bundle: page } = await ingest(await source('html-reference-tail', 'html', html));
  const tail = page.chunks.filter(chunk => chunk.retrieval_text.includes('Artikli autor töötab'));
  assert(tail.length && tail.every(chunk => chunk.section_path.at(-1) === 'Hoolekanne'), tail.map(c => c.section_path.join(' > ')).join(' | '));
  assert(!page.chunks.some(chunk => chunk.retrieval_text.includes('Tamm, M.')));
  exactLocations(page);
});

test('a running head just below the margin zone is not a heading; a title repeated at another height stays', () => {
  const line = (text, y, font = 'F1', height = 12, x = 64) => ({ text, x, y, width: 420, height, font_name: font });
  const paragraph = y => Array.from({ length: 12 }, (_, i) => line(`Hindamise tulemusi tõlgendatakse koos kliendiga ja lõik ${i + 1} jätkub siin`, y - i * 15));
  const pages = [];
  for (let n = 0; n < 5; n++) {
    const items = [line('Hindamisvahendi käsiraamat', 750, 'F3', 15.96, n % 2 ? 306 : 68), ...paragraph(690)];
    if (n === 2) items.push(line('Hindamisvahendi käsiraamat', 480, 'F3', 15.96), ...paragraph(460).slice(0, 8));
    pages.push({ pdf_page: n + 1, parser_page_index: n, view: [0, 0, 595, 842], items: items.map((item, item_index) => ({ ...item, item_index })) });
  }
  pages.push({ pdf_page: 6, parser_page_index: 5, view: [0, 0, 595, 842], items: [{ ...line('Hindamisvahendi käsiraamat', 750, 'F3', 15.96), item_index: 0 }] });
  const result = structure({ pages }, { tenant_id: tenant, document_version_id: 'running-head' }, configuration());
  const heads = result.removed.filter(span => span.reason === 'repeated_running_head');
  assert.equal(heads.length, 5, heads.map(span => span.pdf_page).join(','));
  // The same words lower on a page are a real heading; a page whose only line it is keeps it.
  assert(result.sections.some(section => section.title === 'Hindamisvahendi käsiraamat' && result.spans.find(span => span.id === section.span_ids[0]).pdf_page === 3));
  assert(result.spans.some(span => span.pdf_page === 6));
});

test('a single-font subheading below a wide gap stays a heading when it is just over the usual short length', () => {
  // As in a journal page: a two-line subheading of 22 and 27 characters where a typical line has 47.
  const line = (text, y) => ({ text, x: 56, y, width: text.length * 4.2, height: 8.5, font_name: 'F1' });
  const paragraph = (y, n, words) => Array.from({ length: n }, (_, i) => line(`${words} rida ${i + 1} kirjeldab algatust pikemalt edasi.`.slice(0, 47), y - i * 13));
  const items = [...paragraph(760, 8, 'Hobuteraapia'), line('keskkonnasäästlikku eluviisi tutvustamiseks.', 656),
    line('Tugev side kogukonnaga', 628), line('toetab eluga hakkamasaamist', 615), ...paragraph(601, 8, 'Rootsis algatus')].map((item, item_index) => ({ ...item, item_index }));
  const result = structure({ pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 468, 800], items }] }, { tenant_id: tenant, document_version_id: 'gap-heading' }, configuration());
  assert(result.sections.some(section => section.title === 'Tugev side kogukonnaga toetab eluga hakkamasaamist'), result.sections.map(s => s.title).join(' | '));
});

test('an entry whose continuation lines carry no year or link does not end the list before the next entries', async () => {
  const line = (text, y, font = 'F1') => ({ text, x: 50, y, width: 400, height: 9, font_name: font });
  const lines = [line('Viidatud allikad', 780, 'F2'), line('Medar, M., Saia, K. (2017). The effect of participating in', 760),
    line('Estonian labour market programmes on the employment and wellbeing of long', 748),
    line('term unemployed persons with reduced work ability in the context of social', 736),
    line('welfare reform and the support services of local governments across Estonia', 724),
    line('Mulgan, G. (2006). The Process of Social Innovation. Innovations, 1(2), 145–162.', 712),
    line('Oertzen, A. (2018). Co-creating services. Journal of Service Management, 29(4), 641–679.', 700),
    line('Tulva, T. (2015). Kogukonnapõhine toetus. https://example.org/tulva.pdf', 688),
    line('Vargo, S. L., Lusch, R. F. (2004). Evolving to a New Dominant Logic. Journal of Marketing, 68(1), 1–17.', 676),
    ...Array.from({ length: 12 }, (_, i) => line(`Nõustamisüksuse kasti rida ${i + 1} kirjeldab omavalitsustele pakutavat tuge ja kontakte.`, 640 - i * 12))];
  const parsed = { info: {}, pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 820], items: lines.map((item, item_index) => ({ ...item, item_index })) }] };
  const { bundle } = await ingest(await source('reference-continuation', 'pdf', '%PDF-1.4 reference-continuation'), { parsePdf: async () => parsed });
  const text = bundle.chunks.map(chunk => chunk.retrieval_text).join('\n');
  for (const entry of ['Estonian labour market', 'Mulgan', 'Oertzen', 'Vargo']) assert(!text.includes(entry), entry);
  assert.match(text, /Nõustamisüksuse kasti rida 12/u);
});

test('numbered entries without a year or link, dated newspaper articles, entries with access lines and Vancouver entries stay in the list; a closing note ending with its link stays text', async () => {
  const line = (text, y, font = 'F1') => ({ text, x: 50, y, width: 400, height: 9, font_name: font });
  // Numbered entries: web pages, then four without a year or link (twelve lines in a row that
  // look like no reference), then "Surname, I." entries with a year and pages.
  const numbered = [...Array.from({ length: 8 }, (_, i) => `${110 + i}. Terviseinfo leht ${i + 1}. https://www.terviseamet.ee/et/leht-${i + 1}`),
    ...[118, 119, 120, 121].flatMap(n => [`${n}. Ackley BJ, Ladwig GB, Makic MBF. Nursing Diagnosis Handbook: An`,
      'Evidence-based Guide to Planning Care. Eleventh edition. St. Louis', 'Elsevier Mosby; hooldusplaanide peatükk']),
    ...[122, 123].flatMap(n => [`${n}. Butcher, H. K., Bulechek, G. M., Dochterman, J. M., Wager, C. M.`,
      '(2018: 187) Nursing Interventions Classification (NIC) 7th Edition. USA', 'Elsevier, Mosby.']),
    '124. Koduse ravi juhend täiskasvanule. https://www.perearstiselts.ee/patsient/koduse-ravi'];
  const dated = ['Fond 2100.1.5123. Kirsipuu, Ella. (matrikli nr.2812). l. 44.', 'EPAM. K0042146. T. Lõbu. Lastekaitse Eestis 1919– 1940. TPÜ. Diplomitöö.',
    'Tallinna Linnaarhiiv', 'TLA.52.2.773. Kirsipuu (Kirschbaum) Ella (Elfriede) 1920–1944. l.12.', 'Eesti Kirjandusmuuseum. Eesti kultuurilooline arhiiv',
    'Tartu teated. 7.11.1936.', 'Kaitstagu last ja ema. 4.11.1937.', 'Sotsiaalministeerium ühtlustab tööd sotsiaalsel alal. 22.12.1937.',
    'Eestlanna Rahvasteliidu ajutiseks kaastööliseks. 16.08.1938.', 'Eestlanna reis Kanadasse. 22.10.1938.',
    'Kõned sotsiaalküsimustest naisorganisatsioonidele. 24.10.1938.', 'Naiste töö Rahwasteliidu juures. 25.10.1938.', 'raamatud ja artiklid',
    'Haavik, Õ. (koost.). (1994). Tallinna Pedagoogikakool aastail 1937–1993. Tallinn.', 'Kiitam, A. (1998). Südame ja mõistusega. Tallinn.',
    'Leppik, E. (1997). Kes minevikku ei mäleta, elab tulevikuta! Sotsiaaltöö, 5, 14–15.'];
  // Entries with an access line of their own, three without one in a row.
  const access = ['Sotsiaalministeerium (2024). Vanemahüvitise arutelu Riigikogus.', 'Kättesaadav: https://www.sm.ee/uudised/vanemahuvitis',
    'Soolise võrdõiguslikkuse ja võrdse kohtlemise volinik. Arvamused.', 'Kättesaadav: www.volinik.ee',
    'Soolise võrdõiguslikkuse ja võrdse kohtlemise volinik. Huvikaitse nõukogu Soolise võrdõiguslikkuse seadus.',
    'Soolise võrdõiguslikkuse seadus, Riigi Teataja', 'Soolise võrdõiguslikkuse ja võrdse kohtlemise volinik. Mitmekesised Eesti ülikoolid.',
    'Kättesaadav: https://www.volinik.ee/mitmekesised-eesti-ulikoolid.html', 'Soolise võrdõiguslikkuse ja võrdse kohtlemise voliniku aastaaruanne 2023.',
    'Kättesaadav: www.volinik.ee', 'Vaenukõne karistusõiguslik regulatsioon Eestis. Justiitsministeerium.', 'Kättesaadav: vaenukone_regulatsioon_eestis.pdf'];
  // Vancouver style: no year in parentheses and few links.
  const vancouver = ['1. OECD. Making Decentralisation Work A HANDBOOK FOR POLICY-MAKERS. 2019.',
    '2. Ivanyna M, Shah A. How Close is Your Government to its People? Worldwide Indicators on',
    'Localization and Decentralization [Internet]. The World Bank; 2012 [cited 2020 Nov 13]. 41 p.',
    '3. Debela KW. Local governance in Switzerland: Adequate municipal autonomy cum intergovernmental',
    'cooperation? Meissner R, editor. null. 2020 Jan 1;6(1):1763889.',
    '4. Olowu D. Local institutional and political structures and processes: recent experience in Africa.',
    'Public Administration and Development. 2003 Feb 1;23(1):41–52.', '5. Kattai K, Lääne S, Noorkõiv R. PEAMISED VÄLJAKUTSED JA POLIITIKASOOVITUSED',
    'KOHALIKU OMAVALITSUSE JA REGIONAALTASANDI ARENGUS. Tallinna Ülikool; 2019.', '6. Riigi Teataja. Sotsiaalhoolekande seadus. 2020.',
    '7. Habicht T, Reinap M. Estonia: Health system review. Health Syst Transit. 2018 Mar;20(1):1–189.'];
  for (const [name, entries] of [['unmarked-numbered', numbered], ['newspaper-dated', dated], ['access-lines', access], ['vancouver', vancouver]]) {
    const items = [line('Artikli tekst lõpeb siin korraliku lausega, mis kirjeldab teemat.', 780), line('Kasutatud allikad', 750, 'F2'),
      ...entries.map((text, i) => line(text, 730 - i * 13))].map((item, item_index) => ({ ...item, item_index }));
    const parsed = { info: {}, pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 820], items }] };
    const { bundle } = await ingest(await source(`reference-${name}`, 'pdf', `%PDF-1.4 reference-${name}`), { parsePdf: async () => parsed });
    const text = bundle.chunks.map(chunk => chunk.retrieval_text).join('\n');
    assert.match(text, /korraliku lausega/u);
    for (const left of ['Ackley', 'Butcher', 'Mosby', 'Tartu teated', 'Naiste töö', 'Leppik', 'Huvikaitse', 'Mitmekesised', 'Vaenukõne', 'Ivanyna', 'Olowu', 'Habicht']) assert(!text.includes(left), `${name}: ${left}\n${text}`);
  }
  // A closing thank-you whose sentence ends with a web address stays text; the journal line before it is the last entry's.
  const items = [line('Artikli tekst lõpeb siin korraliku lausega, mis kirjeldab teemat.', 780), line('Viidatud allikad', 750, 'F2'),
    line('Toros, K., DiNitto, D., Tiko, A. (2018). Family engagement in the child welfare system: A scoping', 730),
    line('review. Children and Youth Services Review, 88, 598–607.', 717), line('Yip, K. S. (2003). A strengths perspective in working with an adolescent.', 704),
    line('Social Work Journal, 31, 189–203.', 691), line('Konverents toimus tänu Balti-Ameerika Vabaduse Fondi (BAFF) rahastusele.', 678),
    line('Rohkem infot BAFF-i stipendiumite ja lektorite toetuste kohta leiate kodulehelt', 665), line('www.balticamericanfreedomfoundation.org.', 652)]
    .map((item, item_index) => ({ ...item, item_index }));
  const { bundle } = await ingest(await source('reference-closing-link', 'pdf', '%PDF-1.4 reference-closing-link'),
    { parsePdf: async () => ({ info: {}, pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 820], items }] }) });
  const text = bundle.chunks.map(chunk => chunk.retrieval_text).join('\n');
  for (const kept of ['Konverents toimus tänu', 'leiate kodulehelt www.balticamericanfreedomfoundation.org']) assert(text.includes(kept), `${kept}\n${text}`);
  for (const left of ['Toros', 'Yip', 'Social Work Journal']) assert(!text.includes(left), `${left}\n${text}`);
  // The address can also close a line of the sentence ("Ühingu kodulehel www.lepitus.ee.").
  const mediation = [line('Artikli tekst lõpeb siin korraliku lausega, mis kirjeldab teemat.', 780), line('Viidatud allikad', 750, 'F2'),
    line('Kelly, J. B. (2004). Family Mediation Research: Is There Empirical Support for the Field?', 730),
    line('Conflict Resolution Quarterly, 22(1–2), 3–36. http://www.mediate.com/articles/kelly.pdf (25.04.2017).', 717),
    line('Perelepitusest saate rohkem lugeda ja kutseliste lepitajate kontaktid leiate Eesti Perelepitajate', 704),
    line('Ühingu kodulehel www.lepitus.ee.', 691)].map((item, item_index) => ({ ...item, item_index }));
  const { bundle: mediated } = await ingest(await source('reference-closing-link-in-line', 'pdf', '%PDF-1.4 reference-closing-link-in-line'),
    { parsePdf: async () => ({ info: {}, pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 820], items: mediation }] }) });
  const mediatedText = mediated.chunks.map(chunk => chunk.retrieval_text).join('\n');
  assert(mediatedText.includes('kontaktid leiate Eesti Perelepitajate Ühingu kodulehel www.lepitus.ee'), mediatedText);
  assert(!mediatedText.includes('Kelly, J. B.'), mediatedText);
});

test('explanatory footnotes printed between entries stay in retrieval; a cited source in a footnote does not', async () => {
  const line = (text, y, font = 'F1') => ({ text, x: 50, y, width: 400, height: 9, font_name: font });
  const page = (items, n) => ({ pdf_page: n, parser_page_index: n - 1, view: [0, 0, 600, 820], items: items.map((item, item_index) => ({ ...item, item_index })) });
  const parsed = { info: {}, pages: [
    page([line('Artikli tekst lõpeb siin korraliku lausega, mis kirjeldab teemat.', 780), line('Viidatud allikad', 750, 'F2'),
      line('Frechette, S., Romano, E. (2017). How do parents label their physical disciplinary practices?', 730),
      line('Child Abuse & Neglect, 71(1), 92–103.', 717),
      line('1 AS Turu-uuringud (2018). Vanglate sisekliima uuring. Justiitsministeerium.', 704),
      line('2 „It’s the economy, stupid” on fraas, mille tõi käibesse B. Clintoni 1992. a valimiskampaania juht', 691),
      line('Carville. Sõna „majandus” asendatakse tihti mingi teise, konteksti sobiva sõnaga; nt kliima-aktivistid,', 678),
      line('kasutavad väljendit „It’s the planet, stupid!”', 665),
      line('3 Uuringute andmetel on stressi ja depressiooni all kannatavatel emadel suurem risk kasutada kehalist', 652),
      line('karistust – autor.', 639), line('4 Loe õiguskantsleri 25.04.2023 vastust Eesti puuetega inimeste koja pöördumisele veebilehel', 626),
      line('www.oiguskantsler.ee rubriigist „seisukohad“.', 613)], 1),
    page([line('Gershoff, E. T. (2002). Corporal punishment by parents and associated child behaviors.', 780),
      line('Psychological Bulletin, 128(4), 539–579.', 767), line('Kask, K. (2019). Kehaline karistamine Eestis. Tallinn.', 754),
      // A number that goes on a wrapped entry is no footnote ("COVID-" / "19 Cardiovascular …").
      line('Lala, A. et al. (2021). Prevalence and Impact of Myocardial Injury (from the Yale COVID-', 741),
      line('19 Cardiovascular Registry). Am J Cardiol. 2021 May 1;146:99-106.', 728),
      line('Tamberg, M. (2003) Eesti lastekaitse arengujooni 1919–1940 Teoses: Väljataga, S (toim) Eesti Lastekaitse Liit', 715),
      line('15 Ajalugu ja tänane päev Tallinn: Lastekaitse Liit, 5–59', 702),
      line('Targad vanemad, toredad lapsed, tugevam ühiskond. Laste ja perede arengukava 2012–2020 (2011)', 689),
      line('Tallinn: Sotsiaalministeerium www sm ee/sites/default/files/arengukava pdf (25 11 2016)', 676)], 2)] };
  const { bundle } = await ingest(await source('footnotes-between-entries', 'pdf', '%PDF-1.4 footnotes-between-entries'), { parsePdf: async () => parsed });
  const text = bundle.chunks.map(chunk => chunk.retrieval_text).join('\n');
  for (const kept of ['on fraas, mille tõi käibesse', 'It’s the planet, stupid', 'suurem risk kasutada kehalist karistust – autor', 'veebilehel www.oiguskantsler.ee rubriigist']) assert(text.includes(kept), `${kept}\n${text}`);
  for (const left of ['Frechette', 'AS Turu-uuringud', 'Gershoff', 'Kask, K.', 'Cardiovascular Registry', 'Ajalugu ja tänane päev', 'Targad vanemad']) assert(!text.includes(left), `${left}\n${text}`);
});

test('lists with few years or links qualify: acts and court decisions, numbered lists, a single entry at the end, dotless web addresses', async () => {
  const line = (text, y, font = 'F1') => ({ text, x: 50, y, width: 400, height: 9, font_name: font });
  const lists = {
    // Acts and court decisions: most lines look like entries, none has a year in parentheses.
    acts: ['Avaliku teabe seadus. RT I 2000, 92, 597.', 'Haldusmenetluse seadus. RT I 2001, 58, 354.', 'Põhiseadus. RT 1992, 26, 349.',
      'Riigi Teataja seadus. RT I, 10.11.2018, 11.', 'Riigikohtu põhiseaduslikkuse järelevalve kolleegiumi 17.02.2003 otsus nr 3-4-1-1-03.',
      'Riigikohtu halduskolleegiumi 04.04.2003 määrus nr 3-3-1-32-03.'],
    // Numbered from 1, with a lost "ti" ligature that is no "tel" and entries numbered without a space.
    numbered: ['1. Tuleohutuse seadus.', '2. Ehitisele ja selle osale esitatavad tuleohutusnõuded. Vabariigi Valitsuse määrus', 'nr 315.',
      '3. Nõuded tulekustu\uFFFDtele ja voolikusüsteemidele. Siseministri määrus nr 39.', '4. Health Technical Memorandum 05-02 Guidance in support of functional provisions',
      'premises. art 5.77, 5.78 and 6.83. TSO.', '5. Technische Richtlinien Vorbeugenden Brandschutz Krankenanstalten, Pflege- und',
      'Altenheime-Bauliche Maßnahmen. Österreichischer Bundesfeuerwehrverband.', '6. Zusammenwirken von Wasserlöschanlagen und Rauch- und Wärmeabzugsanlagen. VdS',
      '2815:2001-03 (01). http://www.vds-industrial.de/fileadmin/vds_2815_web.pdf', '7.Jose., R., P., Board and Care Facilities, Fire Protection handbook 20th ed, volume II, 2008.',
      '8.Leonid Pahhutši. Etapilise evakuatsiooni lahendus tervishoiu- ja hoolekandeasutustes.'],
    single: ['Pihl, K., Krusell, S. (2021). Tulevikuvaade tööjõu- ja oskuste vajadusele: sotsiaaltöö. Uuringu lühiaruanne.'],
    // A journal issue whose web addresses and access dates lost their dots.
    dotless: ['Göttig, T., Uusen-Nacke, T. (2017) Lapsega suhtlust korraldav kohtulahend ja selle täitmine, võrdlev analüüs',
      'www just ee/sites/www just ee/files/suhtlusoiguse_uuring27112017 pdf (26 08 2019)', 'Kaukvere, T. (2017) Tüli lapse pärast tekitas hiigelvõla Postimees 01 03 2017',
      'https://leht postimees ee/4029599/tuli-lapse-parast-tekitas-hiigelvola (26 08 2019)', 'Perekonnaseaduse, tsiviilkohtumenetluse seadustiku ja täitemenetluse seadustiku muutmise seadus',
      'eelnõu väljatöötamise kavatsus. 15 04 2019', 'www just ee/sites/www just ee/files/vtk_suhtlusoigus_15 04 19_1 pdf (19 08 2019)',
      'Õiguskantsleri märgukiri täitemenetluse seadustiku kooskõlla viimiseks põhiseadusega, 27 03 2019',
      'www oiguskantsler ee/sites/default/files/field_document2/margukiri pdf (26 08 2019)',
      'Sotsiaalkindlustusamet ( s.a ) Ettekirjutuse näidisvorm www sotsiaalkindlustusamet ee/sites/default/files/',
      'content-editors/Lastekaitse/ettekirjutuse_vorm docx (26 08 2019)'],
  };
  const left = { acts: ['Haldusmenetluse seadus', 'halduskolleegiumi'], numbered: ['Tuleohutuse seadus', 'Health Technical', 'Zusammenwirken', 'Leonid Pahhutši'],
    single: ['Tulevikuvaade'], dotless: ['Göttig', 'Kaukvere', 'Õiguskantsleri märgukiri', 'Ettekirjutuse näidisvorm'] };
  for (const [name, entries] of Object.entries(lists)) {
    const items = [line('Artikli tekst lõpeb siin korraliku lausega, mis kirjeldab teemat.', 780), line('Viidatud allikad', 750, 'F2'),
      ...entries.map((text, i) => line(text, 730 - i * 13))].map((item, item_index) => ({ ...item, item_index }));
    const { bundle } = await ingest(await source(`few-marks-${name}`, 'pdf', `%PDF-1.4 few-marks-${name}`),
      { parsePdf: async () => ({ info: {}, pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 820], items }] }) });
    const text = bundle.chunks.map(chunk => chunk.retrieval_text).join('\n');
    assert.match(text, /korraliku lausega/u);
    for (const entry of left[name]) assert(!text.includes(entry), `${name}: ${entry}\n${text}`);
  }
});

test('a box or comment after a list stays in retrieval even with web addresses or its own sources; explanatory web footnotes are no bibliography', async () => {
  const line = (text, y, font = 'F1') => ({ text, x: 50, y, width: 400, height: 9, font_name: font });
  const entries = ['Hodgins, M. (2008). Taking a health promotion approach to the problem of bullying.', 'Olweus, D. (1993). Bullying at school. Oxford: Blackwell.',
    'KiVa International (i.a). Is KiVa effective? www.kivaprogram.net/is-kiva-effective. (13.11.2019).'];
  // An information box of organisations, each ending with its web address.
  const box = ['Liikumisega „Kiusamisvaba haridustee eest”', 'liitunud organisatsioonid', '◆ Tartu Ülikooli eetikakeskus tegeleb eetika ja väärtuste teemaga nii teadus- ja õppetöö raames',
    'kui ka ühiskonnas laiemalt, nt pakkudes väärtuskasvatuse alast teadmist ja toetust õpetajatele', 'ning lasteaia- ja koolijuhtidele. www.eetika.ee',
    '◆ MTÜ Vaikuseminutid programmiga liitunud õpetajad teevad lastega lühikesi tähelepanu harjutusi.', 'Harjutustel on tugev mõju sotsiaalsete oskuste arengule. www.vaikuseminutid.ee'];
  // A comment of eight lines that closes with its own two sources.
  const comment = Array.from({ length: 8 }, (_, i) => `KOMMENTAAR rida ${i + 1}: vanglate sisekliima paraneb, kui kuulamine ja dialoog on igapäevased.`)
    .concat(['Shaw, S. (2010). When SORI is not the hardest word. https://insidetime.org', 'Walker, P. (1999). Saying sorry, acting sorry. Melbourne.']);
  const page = (items, n) => ({ pdf_page: n, parser_page_index: n - 1, view: [0, 0, 600, 820], items });
  const parsed = { info: {}, pages: [
    page([line('Artikli tekst lõpeb siin korraliku lausega, mis kirjeldab kiusamise ennetamist.', 780), line('Viidatud allikad', 750, 'F2'),
      ...entries.map((text, i) => line(text, 730 - i * 13)), ...box.map((text, i) => line(text, 680 - i * 13))], 1),
    page([line('Viidatud allikad', 700, 'F2'), ...entries.map((text, i) => line(text, 680 - i * 13)), ...comment.map((text, i) => line(text, 630 - i * 13))], 2),
    page([line('Viidatud allikad', 650, 'F2'), line('[1] (#_ftnref1) Tartu ülikoolis 2024. aastal kaitstud bakalaureusetöö', 630),
      line('„Lühiajalises majutuses elanud Ukraina sõjapõgenikele pakutud teenus“.', 617), line('[2] (#_ftnref2) Sellist teenust osutati aastatel 2022 ja 2023. Ajapikku', 604),
      line('vajadus teenuse järele vähenes, sest elanikud asusid elama iseseisvalt.', 591)], 3),
  ].map(p => ({ ...p, items: p.items.map((item, item_index) => ({ ...item, item_index })) })) };
  const { bundle } = await ingest(await source('reference-then-content', 'pdf', '%PDF-1.4 reference-then-content'), { parsePdf: async () => parsed });
  const text = bundle.chunks.map(chunk => chunk.retrieval_text).join('\n');
  for (const kept of ['liitunud organisatsioonid', 'Tartu Ülikooli eetikakeskus', 'www.vaikuseminutid.ee', 'KOMMENTAAR rida 1', 'KOMMENTAAR rida 8',
    'Sellist teenust osutati aastatel 2022 ja 2023. Ajapikku vajadus teenuse järele vähenes']) assert(text.includes(kept), `${kept}
${text}`);
  for (const left of ['Hodgins, M.', 'Olweus, D.', 'KiVa International']) assert(!text.includes(left), left);
  // A printed footnote and a closing note after the last entry are text; a publisher line is not.
  const notes = { info: {}, pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 820], items: [line('Artikli tekst kirjeldab hoolduskoormust pikemalt ja põhjalikult.', 700),
    line('Viidatud allikad', 670, 'F2'), line('Tamm, M. (2020). Hoolduskoormus Eestis. Tallinn: Sotsiaalministeerium.', 655),
    line('Kask, K. (2019). Social care in practice.', 642), line('Oxford University Press.', 629),
    line('7 Võimalikke tulevikustrateegiaid on kirjeldatud nt Arenguseire Keskuse raportis', 616),
    line('Juhendmaterjal on leitav kahes versioonis terviseinfo kodulehel ja trükisena.', 603)].map((item, item_index) => ({ ...item, item_index })) }] };
  const { bundle: noted } = await ingest(await source('reference-notes', 'pdf', '%PDF-1.4 reference-notes'), { parsePdf: async () => notes });
  const notedText = noted.chunks.map(chunk => chunk.retrieval_text).join('\n');
  for (const kept of ['Võimalikke tulevikustrateegiaid', 'Juhendmaterjal on leitav kahes versioonis']) assert(notedText.includes(kept), `${kept}\n${notedText}`);
  for (const left of ['Tamm, M.', 'Kask, K.', 'Oxford University Press']) assert(!notedText.includes(left), left);
  // A contact block after the last entry, with its title, stays in retrieval.
  const contacts = { info: {}, pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 820], items: [line('Artikli tekst kirjeldab inimkaubanduse ohvrite abistamist.', 700),
    line('Viidatud allikad', 670, 'F2'), line('Luht, K. jt (2019). Inimkaubanduse ohvri tuvastamise juhend. Tallinn: Sotsiaalministeerium.', 655),
    line('Justiitsministeerium (2019). Inimkaubandus. www.kriminaalpoliitika.ee/inimkaubandus.pdf (04.11.2019).', 642),
    line('Olulised kontaktid ja veebilehed', 629), line('Politsei 112', 616), line('SKA ohvriabi kriisiabitelefon 116006 (24/7)', 603),
    line('SKA ohvriabi veebileht www.palunabi.ee', 590)].map((item, item_index) => ({ ...item, item_index })) }] };
  const { bundle: contacted } = await ingest(await source('reference-contacts', 'pdf', '%PDF-1.4 reference-contacts'), { parsePdf: async () => contacts });
  const contactText = contacted.chunks.map(chunk => chunk.retrieval_text).join('\n');
  for (const kept of ['Olulised kontaktid ja veebilehed', 'Politsei 112', '116006 (24/7)', 'www.palunabi.ee']) assert(contactText.includes(kept), `${kept}\n${contactText}`);
  for (const left of ['Luht, K.', 'Justiitsministeerium (2019)']) assert(!contactText.includes(left), left);
});

test('a single-entry list stays out of retrieval after the text behind it is split off (HTML path)', async () => {
  const html = '<html><body><article><h1>Hoolekanne</h1><p>Teenuse sisu kirjeldus on siin.</p><h2>Kasutatud kirjandus</h2>'
    + '<p>Tamm, M. (2020). Sotsiaaltöö alused. Tallinn.</p><p>Artikli autor töötab sotsiaaltöötajana ja juhendab praktikante mitmes omavalitsuses.</p>'
    + '<p>Toimetus tänab kõiki kaasautoreid nõu ja abi eest artikli valmimisel.</p><p>Artikkel ilmus esmakordselt ajakirjas ja seda on täiendatud 2024. aastal.</p></article></body></html>';
  const { bundle } = await ingest(await source('html-single-reference', 'html', html));
  const text = bundle.chunks.map(chunk => chunk.retrieval_text).join('\n');
  assert(!text.includes('Tamm, M.'), text);
  assert.match(text, /Toimetus tänab kõiki kaasautoreid/u);
  assert(bundle.report.warnings.some(warning => warning.code === 'reference_list_not_chunked'));
});

test('a reference-list name in a table of contents is no heading; the same name over entries is', () => {
  const line = (text, x, y) => ({ text, x, y, width: text.length * 5, height: 10, font_name: 'F1' });
  // Long enough for its page numbers to form a column of their own, read after the entries.
  const toc = [['2.1. Pereõe töö sisu ja korraldus', '12'], ['2.2. Pere hindamine ja kaasamine', '14'], ['2.3. Nõustamine ja juhendamine', '17'],
    ['2.4. Kodukülastused ja nende ettevalmistus', '19'], ['2.5. Vaktsineerimine ja ennetus', '22'], ['2.7.4. Kukkumiste risk', '33'],
    ['LISA 2. Olulised nõuandetelefonid', '44'], ['Kasutatud kirjandus', '45']];
  const items = [...toc.flatMap(([entry, page], i) => [line(entry, 42, 700 - i * 15), line(page, 347, 700 - i * 15)]),
    line('Pereõde on õde, kes osutab pädevuse piires üldarstiabi koos perearstiga ning nõustab peresid.', 42, 550),
    line('Viidatud allikad', 42, 510), line('Tamm, M. (2020). Sotsiaaltöö alused. Tallinn: Kirjastus.', 42, 495),
    line('Kask, K. (2019). Hoolekanne. https://example.org', 42, 480)].map((item, item_index) => ({ ...item, item_index }));
  const result = structure({ pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 468, 800], items }] }, { tenant_id: tenant, document_version_id: 'toc-reference' }, configuration());
  const titles = result.sections.map(section => section.title);
  assert(!titles.includes('Kasutatud kirjandus'), titles.join(' | '));
  assert(titles.includes('Viidatud allikad'), titles.join(' | '));
});

test('prose read between a list heading and its first entry goes back to the section it continues', () => {
  // Reading order of a page whose list heading sits at the foot of the first column: first column,
  // heading, second column, then the list across the page.
  const texts = [['Mis aitaks?', 'A', 'heading'], ['Kogumishäire vajab sekkumist ja lähedaste tuge.', 'A'], ['Viidatud allikad', 'L', 'heading'],
    ['Tõsise kogumishäire tagajärgede hulka kuuluvad tervise- ja', 'L'], ['ohutusprobleemid, näiteks tuleoht ja oht murda luid, mis', 'L'],
    ['nõuavad sotsiaaltöötajalt kiiret ja kaalutud tegutsemist.', 'L'], ['Psühhiaatrilise abi seadus. RT I, 24.03.2021, 6.', 'L'],
    ['RHK 10 (1992). Ptk 5. Psüühika- ja käitumishäired.', 'L'], ['Tamm, M. (2020). Kogumine ja hoolekanne. https://example.org', 'L']];
  const spans = texts.map(([text, section], i) => ({ id: `s${i}`, source_text: text, retrieval_text: text, parent_section_id: section, block_id: `b${i}`, height: 11, pdf_page: 1 }));
  const blocks = texts.map(([, , kind], i) => ({ id: `b${i}`, kind: kind || 'paragraph', span_ids: [`s${i}`] }));
  const sections = [{ id: 'root', title: null, parent_id: null, span_ids: [] }, { id: 'A', title: 'Mis aitaks?', parent_id: 'root', span_ids: ['s0'] },
    { id: 'L', title: 'Viidatud allikad', parent_id: 'root', span_ids: ['s2'] }];
  const splits = splitReferenceLists({ sections, spans, blocks });
  assert.deepEqual(splits, [{ list_section_id: 'L', titled: false, lead_section_id: 'A' }]);
  assert.deepEqual(spans.filter(span => span.parent_section_id === 'A').map(span => span.id), ['s0', 's1', 's3', 's4', 's5']);
  assert.deepEqual([...referenceSpans({ sections, spans, blocks })], ['s2', 's6', 's7', 's8']);
});

test('a box of side-by-side columns in single-column text reads cell by cell; a table of entries reads row by row', () => {
  const items = [];
  const add = (text, x, y, width, font = 'F1') => items.push({ text, x, y, width, height: 9, font_name: font, item_index: items.length });
  const prose = (y, n) => { for (let i = 0; i < n; i++) add(`Artikli lõik ${i + 1} kirjeldab koosloomet ja teenuste arendamist omavalitsustes pikemalt.`, 42, y - i * 11, 380); };
  prose(640, 12);
  // Centred cells of wrapped text, as in an information box.
  const box = [['Nõustame omavalitsusi', 'sotsiaalkaitse tegevuste ja', 'abimeetmete planeerimisel.'],
    ['Nõustame omavalitsusi', 'sotsiaalteenuste korraldamise', 'küsimustes ja juhistes.'], ['Nõustame ka', 'teenuseosutajaid keeruliste', 'juhtumite lahendamisel.']];
  box.forEach((column, c) => column.forEach((text, r) => add(text, 60 + c * 120 + (100 - text.length * 3.6) / 2, 490 - r * 11, text.length * 3.6)));
  prose(440, 12);
  const table = [['Koduteenus', 'tasuline', '50 eurot'], ['Tugiisik', 'tasuta', '0 eurot'], ['Transport', 'osaline', '15 eurot']];
  table.forEach((row, r) => row.forEach((text, c) => add(text, 60 + c * 120, 290 - r * 11, text.length * 4)));
  prose(240, 12);
  const result = structure({ pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 468, 680], items }] },
    { tenant_id: tenant, document_version_id: 'text-box' }, configuration());
  const text = result.pages[0].raw_text.replace(/\n/gu, ' ');
  assert(text.includes('Nõustame omavalitsusi sotsiaalkaitse tegevuste ja abimeetmete planeerimisel.'), text);
  assert(!text.includes('Nõustame omavalitsusi Nõustame omavalitsusi'), text);
  assert(text.includes('Koduteenus tasuline 50 eurot Tugiisik tasuta 0 eurot'), text);
  assert.equal(result.pages[0].columns, 1);
  // A chart's year labels over justified text set word by word (the coordinates of Sotsiaaltrendid 6,
  // p. 85): a few word gaps line up with the label gaps, but they are no wider than the other word
  // gaps of their lines, so the lines are no box and the sentence reads in order.
  const words = [];
  const place = (text, x, right, y, height = 9) => words.push({ text, x, y, width: right - x, height, font_name: 'F1', item_index: words.length });
  for (let i = 0; i < 10; i++) place(`Graafiku kohal olev lõik ${i + 1} kirjeldab töötuse muutusi aastatel 2000–2012 pikemalt.`, 48.2, 450.6, 640 - i * 11);
  for (let k = 0; k <= 12; k++) place(String(k).padStart(2, '0'), 65.6 + k * 17.25, 73.2 + k * 17.25, 496, 7);
  [[48.2, 61.2, 'Kui'], [66.7, 108.7, 'lühiajaliste'], [114.2, 141.6, 'töötute'], [147.1, 166.1, 'seas'], [171.6, 188.1, 'võib'], [193.6, 230.7, 'mõnikord'],
    [236.1, 250.1, 'olla'], [255.7, 274.2, 'naisi'], [279.7, 316.2, 'meestest'], [321.6, 354.2, 'rohkem,'], [359.6, 372.6, 'siis'], [378.1, 420.7, 'pikaajaline'],
    [426.2, 450.6, 'töötus']].forEach(([x, right, text]) => place(text, x, right, 464.1));
  [[48.2, 85.7, 'ähvardab'], [91.9, 114.4, 'enam'], [120.6, 142.5, 'mehi.'], [148.7, 173.7, 'Alates'], [179.9, 233.9, '2000. aastast'], [240.1, 250.0, 'on'],
    [256.2, 300.7, 'pikaajaliste'], [306.8, 334.4, 'töötute'], [340.5, 359.5, 'seas'], [365.7, 387.7, 'olnud'], [393.9, 413.3, 'mehi'], [419.5, 450.5, 'naistest']]
    .forEach(([x, right, text]) => place(text, x, right, 453.1));
  for (let i = 0; i < 10; i++) place(`Järgmine lõik ${i + 1} jätkab pikaajalise töötuse kirjeldust vanuserühmade kaupa edasi.`, 48.2, 450.6, 440 - i * 11);
  const justified = structure({ pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 468, 680], items: words }] },
    { tenant_id: tenant, document_version_id: 'justified' }, configuration());
  assert.equal(justified.pages[0].text_boxes, 0);
  // A bulleted list is no box: the bullets stay with their items.
  const listItems = [];
  for (let i = 0; i < 10; i++) listItems.push({ text: `Uuringu lõik ${i + 1} kirjeldab tööandjate hoiakuid ja kogemusi pikemalt.`, x: 42, y: 700 - i * 11, width: 380, height: 9, font_name: 'F1' });
  ['vähenenud töövõimega inimesi palkavate asutuste osakaal', 'kogemused vähenenud töövõimega töötajatega ning nende töötamise ja',
    'tasustamise erisused võrreldes ülejäänud personaliga', 'valmidus vähenenud töövõimega inimesi tööle võtta ning takistused']
    .forEach((text, i) => { if (i !== 2) listItems.push({ text: '•', x: 60, y: 560 - i * 11, width: 4, height: 9, font_name: 'F1' });
      listItems.push({ text, x: 78, y: 560 - i * 11, width: text.length * 4.3, height: 9, font_name: 'F1' }); });
  const bulleted = structure({ pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 468, 800], items: listItems.map((item, item_index) => ({ ...item, item_index })) }] },
    { tenant_id: tenant, document_version_id: 'bullets' }, configuration());
  assert.equal(bulleted.pages[0].text_boxes, 0);
  assert(bulleted.pages[0].raw_text.includes('• vähenenud töövõimega inimesi palkavate asutuste osakaal\n• kogemused'), bulleted.pages[0].raw_text.slice(-400));
  assert(justified.pages[0].raw_text.includes('Kui lühiajaliste töötute seas võib mõnikord olla naisi meestest rohkem, siis pikaajaline töötus\nähvardab enam mehi.'),
    justified.pages[0].raw_text.slice(0, 900));
  assert(result.warnings.some(warning => warning.code === 'pdf_text_box_read_by_cell'));
});

test('a reference heading below both columns heads only the full-width list, not the right column', async () => {
  const items = [];
  const add = (text, x, y, width, height = 11) => items.push({ text, x, y, width, height, item_index: items.length });
  for (let i = 0; i < 8; i++) {
    add(`Vasak veerg rida ${i} jätkub.`, 43, 600 - i * 13, 180);
    add(`Parem veerg rida ${i} on sisu.`, 234, 600 - i * 13, 180);
  }
  add('Viidatud allikad', 43, 480, 80, 10);
  add('Tamm, M. (2020). Sotsiaaltöö alused. Tallinn: Kirjastus, lk 1–20.', 43, 463, 380, 9);
  add('Kask, K. (2019). Hoolekanne ja teenused. https://example.org/raamat', 43, 452, 380, 9);
  const parsed = { info: {}, pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 468, 680], items }] };
  const { bundle } = await ingest(await source('reference-below-columns', 'pdf', '%PDF-1.4 reference columns'), { parsePdf: async () => parsed });
  const text = bundle.chunks.map(chunk => chunk.retrieval_text).join('\n');
  assert.match(text, /Parem veerg rida 7 on sisu\./u);
  assert(!text.includes('Tamm, M.'));
  exactLocations(bundle);
});

test('a table with a narrow row-label column reads row by row; equal text columns still read down', () => {
  const items = [];
  const cell = (text, x, y, width) => items.push({ text, x, y, width, height: 9, item_index: items.length });
  const rows = [['Eesmärk', 'Ennetada kriise', 'Toetada taastumist'], ['Kasu', 'Parem kontroll', 'Kiirem abi'],
    ['Vorm', 'Paberil plaan', 'Taskukaart'], ['Kes nõustab', 'Spetsialist', 'Sama spetsialist']];
  rows.forEach(([label, first, second], r) => {
    const top = 700 - r * 50;
    cell(label, 40, top, 45);
    for (let line = 0; line < 3; line++) {
      cell(`${first} ${line}`, 100, top - line * 10, 150);
      cell(`${second} ${line}`, 270, top - line * 10, 150);
    }
  });
  const result = structure({ pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800], items }] },
    { tenant_id: tenant, document_version_id: 'table' }, configuration());
  const text = result.pages[0].raw_text;
  assert(text.indexOf('Eesmärk') < text.indexOf('Ennetada kriise 2'));
  assert(text.indexOf('Ennetada kriise 2') < text.indexOf('Toetada taastumist 0'));
  assert(text.indexOf('Toetada taastumist 2') < text.indexOf('Kasu'));
  assert(text.indexOf('Kasu') < text.indexOf('Parem kontroll 0'));
});

test('a photo page with only a running head is reported, while a page without text still fails', () => {
  const body = Array.from({ length: 6 }, (_, i) => ({ text: `Body paragraph line ${i}`, x: 50, y: 600 - i * 14, width: 400, height: 11, item_index: 1 + i }));
  const page = (number, items) => ({ pdf_page: number, parser_page_index: number - 1, view: [0, 0, 600, 800], items });
  const scope = { tenant_id: tenant, document_version_id: 'photo-page' };
  const result = structure({ pages: [page(1, [{ text: '13 AJAKIRJA JUUBEL', x: 50, y: 770, width: 150, height: 9, item_index: 0 }, ...body]),
    page(2, [{ text: '14 AJAKIRJA JUUBEL', x: 50, y: 770, width: 150, height: 9, item_index: 0 }])] }, scope, configuration());
  assert(result.warnings.some(warning => warning.code === 'pdf_pages_without_body_text' && warning.detail.includes('Pages 2 ')));
  const cover = structure({ pages: [page(1, body), page(2, body), page(3, [])] }, scope, configuration());
  assert(cover.warnings.some(warning => warning.code === 'pdf_pages_without_text_layer' && warning.detail.startsWith('Pages 3 ')));
  assert.throws(() => structure({ pages: [1, 2, 3, 4, 5].map(n => page(n, n === 3 ? [] : body)) }, scope, configuration()), /partial_text_needs_review/);
});

test('a fitting paragraph is not split to fill the previous chunk; a long Unicode span stays bounded and lossless', async () => {
  const options = await source('paragraphs', 'pdf', '%PDF-1.4 fixture');
  const a = 'First paragraph is complete. '.repeat(3).trim(), b = 'Second paragraph is complete. '.repeat(3).trim();
  const parsed = { info: {}, pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800], items: [
    { text: a, x: 40, y: 700, height: 12, width: 450, item_index: 0 },
    { text: b, x: 40, y: 650, height: 12, width: 450, item_index: 1 },
  ] }] };
  const { bundle } = await ingest({ ...options, config: { chunkMaxChars: 100 } }, { parsePdf: async () => parsed });
  assert.deepEqual(bundle.chunks.map(chunk => chunk.source_text), [a, b]); exactLocations(bundle);
  const text = 'A sentence ends. Another sentence with 🧭 and õäöü. '.repeat(30);
  const ranges = textRanges(text, 100);
  assert.equal(ranges.map(range => text.slice(range.start, range.end)).join(''), text);
  assert(ranges.every(range => range.end - range.start <= 100 && text.slice(range.start, range.end).isWellFormed()));
});

test('source ranges never bridge omitted non-whitespace text', () => {
  const unit = { id: 'unit', raw_text: 'first\nOMITTED\nsecond', locator: { kind: 'pdf', pdf_page: 1 } };
  const spans = [{ id: 'a', source_unit_index: 0, start: 0, end: 5 }, { id: 'b', source_unit_index: 0, start: 14, end: 20 }];
  const locations = chunkSourceLocations({ source_units: [unit], spans }, { span_ids: ['a', 'b'] });
  assert.deepEqual(locations.map(({ start, end }) => ({ start, end })), [{ start: 0, end: 5 }, { start: 14, end: 20 }]);
});

test('HTML article, table cells, immutable asset and exact generic citations survive without fake PDF pages', async () => {
  const html = '<html><body><nav>Navigation excluded</nav><article><h1>Planting guide</h1><p>A complete source paragraph.</p><script>fetch("https://example.invalid")</script><table><tr><th>Crop</th><th>Month</th></tr><tr><td>Peas</td><td>May</td></tr></table></article><footer>Footer excluded</footer></body></html>';
  const options = await source('html', 'html', html);
  const result = await ingest(options), b = result.bundle;
  assert.equal(await fs.readFile(path.join(result.output, 'original.html'), 'utf8'), html);
  assert.deepEqual(b.pages, []); assert.equal(b.version.pdf_hash, null);
  assert(b.chunks.every(chunk => chunk.pdf_pages.length === 0));
  assert(!b.chunks.some(chunk => /Navigation|Footer|fetch/u.test(chunk.source_text)));
  assert(b.source_units.some(unit => /Peas\s+May/u.test(unit.raw_text))); exactLocations(b);
  assert.equal((await ingest(options)).reused, true);
  const snapshot = await loadSnapshot(options.storeRoot, tenant, [b.document.id]); assert.equal(snapshot.bundles.length, 1);
  const chunk = b.chunks.find(chunk => chunk.source_text.includes('complete source'));
  const entry = { evidence_id: 'evidence-fixture', document_id: b.document.id, document_version_id: b.version.id, unit_id: 'unit-fixture',
    chunk_id: chunk.id, span_ids: chunk.span_ids, source_locations: chunk.source_locations, pdf_pages: [], source_text: chunk.source_text,
    bibliography: { title: b.document.fields.title.value }, limitations: [] };
  const packet = { tenant, query_id: 'query-fixture', generation_id: 'generation-fixture', evidence: [entry] };
  const projection = modelProjection(packet.evidence, packet); packet.reference_map = projection.references;
  const expected = projection.references.S1;
  const context = { tenant, subject: 'operator', usage: 'development_only' }, policy = { allowed: async () => ({ documents: [b.document.id] }) };
  await resolveModelReference({ packet, reference: 'S1', queryId: packet.query_id, context, policy, sourceResolver: async () => expected });
  await assert.rejects(resolveModelReference({ packet, reference: 'S1', queryId: packet.query_id, context, policy,
    sourceResolver: async () => ({ ...expected, source_locations: [] }) }), { code: 'canonical_reference_mismatch' });
});

const xml = '<oigusakt xmlns="fixture"><metaandmed><valjaandja>Fixture issuer</valjaandja><globaalID>fixture-123</globaalID><kehtivus><kehtivuseAlgus>2025-01-01</kehtivuseAlgus><kehtivuseLopp>2026-12-31</kehtivuseLopp></kehtivus></metaandmed><aktinimi><nimi><pealkiri>Fictional garden rules</pealkiri></nimi></aktinimi><sisu><paragrahv id="p1"><kuvatavNr>1</kuvatavNr><pealkiri>Scope</pealkiri><loige><tavatekst>This fictional rule applies to the sample garden.</tavatekst></loige></paragrahv><paragrahv id="p2"><kuvatavNr>2</kuvatavNr><pealkiri>Exception</pealkiri><loige><tavatekst>This fictional exception applies only to the sample greenhouse.</tavatekst></loige></paragrahv></sisu></oigusakt>';
test('title and authors match the text by letters only; an XML act\'s own title is not compared', async () => {
  const lines = ['LAPSE ÕIGUS KASVADA PE-', 'RES', 'Mari Maasikas ja Jaan Tamm', 'Artikkel kirjeldab, kuidas laps saab kasvada peres ja mida see nõuab.'];
  const parsed = { pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800],
    items: lines.map((text, i) => ({ text, x: 50, y: 700 - i * 14, width: 400, height: 11, item_index: i })) }] };
  const { bundle } = await ingest(await source('letters-title', 'pdf', '%PDF-1.4 letters',
    { title: 'Lapse õigus: kasvada peres', authors: ['Mari Maasikas', 'Jaan Tamm'] }), { parsePdf: async () => parsed });
  assert.equal(bundle.document.fields.title.review_state, 'text_match');
  assert.equal(bundle.document.fields.authors.review_state, 'text_match');
  assert(!bundle.report.warnings.some(warning => /_not_matched_in_pdf$/u.test(warning.code)));
  const other = await ingest(await source('letters-title-other', 'pdf', '%PDF-1.4 other', { title: 'Hoopis teine pealkiri' }), { parsePdf: async () => parsed });
  assert(other.bundle.report.warnings.some(warning => warning.code === 'title_not_matched_in_pdf'));
  const act = await ingest(await source('xml-own-title', 'xml', xml));
  assert.equal(act.bundle.document.fields.title.value, 'Fictional garden rules');
  assert(!act.bundle.report.warnings.some(warning => warning.code === 'title_not_matched_in_pdf'));
});

test('XML preserves legal units and distinct validity metadata; external entities and malformed XML fail', async () => {
  const options = await source('xml', 'xml', xml, { year: 2024, valid_from: '2024-01-01' });
  const { bundle: b } = await ingest(options);
  assert.equal(b.document.fields.title.value, 'Fictional garden rules');
  assert.equal(b.document.fields.publication_year.value, 2024);
  assert.equal(b.document.fields.valid_from.value, '2025-01-01');
  assert(b.document.fields.valid_from.provenance[0].path.endsWith('/kehtivuseAlgus[1]'));
  assert.equal(b.chunks.length, 2); assert(b.chunks.every(chunk => new Set(chunk.source_locations.map(location => location.element_id)).size === 1));
  assert(b.chunks.every(chunk => chunk.previous_id === null && chunk.next_id === null)); exactLocations(b);
  await assert.rejects(ingest(await source('xml-entity', 'xml', '<!DOCTYPE x [<!ENTITY x SYSTEM "file:///private">]>'+xml)), { code: 'xml_external_entities_forbidden' });
  await assert.rejects(ingest(await source('xml-broken', 'xml', xml.replace('</paragrahv>', '</wrong>'))), { code: 'invalid_xml_structure' });
});

test('JSON selectors retain exact field locations, allow disjoint records and reject overlapping asset identities', async () => {
  const content = { items: [{ id: 'first', title: 'First service', summary: 'Only the first service is described here.', amount: { value: 12, period: 'month' } },
    { id: 'second', title: 'Second service', summary: 'Only the second service is described here.' }] };
  const options = await source('json', 'json', JSON.stringify(content), { source_selector: { json_pointer: '/items/0' } });
  const { bundle: b } = await ingest(options);
  assert(b.source_units.every(unit => unit.locator.path.startsWith('/items/0/')));
  assert(!b.chunks.some(chunk => chunk.source_text.includes('second service'))); exactLocations(b);
  await ingest({ ...options, metadata: { ...options.metadata, document_id: 'second', source_selector: { json_pointer: '/items/1' } } });
  await assert.rejects(ingest({ ...options, metadata: { ...options.metadata, document_id: 'duplicate' } }), { code: 'duplicate_asset_identity_conflict' });
});

test('knowledge preparation and imported knowledge bind HTML quotes to source units', async () => {
  const quote = 'The source describes a fictional condition.';
  const options = await source('html-knowledge', 'html', `<article><p>${quote}</p></article>`);
  const { bundle: b } = await ingest(options);
  const config = { enabled: true, model: 'gpt-6-luna', accountProject: 'proj_fixture', reasoning: 'medium', timeoutMs: 10000,
    maxOutputTokens: 1000, maxDocumentInputTokens: 40000, maxInputTokens: 40000, maxApiAttempts: 1, maxSpendUsd: '1', prices: { input: 125, output: 500 } };
  const plan = knowledgePreparationPlan(b, config);
  assert.equal(plan.body.model, 'gpt-6-luna'); assert.deepEqual(plan.body.reasoning, { effort: 'medium' });
  assert.equal(plan.body.store, false); assert.equal(plan.body.text.format.strict, true);
  assert.equal(BigInt(plan.manifest.reserved_nano_usd), BigInt(plan.manifest.input_tokens_reserved) * 125n + 500000n);
  assert.equal(plan.sources[0].source_unit_index, 0); assert.equal(plan.sources[0].pdf_page, undefined);
  const draft = knowledgePreparationDraft({ cards: [{ key: 'condition', kind: 'condition', statement: quote, scope: 'Fixture', subject: null, predicate: null, object: null,
    anchors: [{ source_id: plan.sources[0].source_id, quote }] }], dependencies: [], unresolved: [] }, plan, b);
  const result = await ingest({ ...options, metadata: { ...options.metadata, knowledge: draft.knowledge } });
  assert.equal(result.bundle.knowledge_cards[0].anchors[0].source_unit_index, 0);
  const wrong = { schema_version: KNOWLEDGE_SCHEMA, cards: [{ key: 'bad', kind: 'assertion', statement: quote, scope: 'Fixture', anchors: [{ source_unit_index: 1, quote }] }], dependencies: [] };
  await assert.rejects(ingest({ ...options, metadata: { ...options.metadata, knowledge: wrong } }), { code: 'knowledge_anchor_page_missing' });
});

test('metadata variants remain visible and registry input derives XML identity from the actual XML', async () => {
  const input = { source_path: 'guide.pdf', source_format: 'pdf', metadata_variants: [{ metadata: { docId: 'guide', title: 'Guide', authors: ['Local author'], year: 2025, source_type: 'guide', language: 'en' } }],
    server_metadata: [{ metadata: { title: 'Guide', authors: ['Different author'], year: 2025 } }] };
  const adapted = adaptMetadata(input, 'guide.json'); assert.equal(adapted.document_id, 'guide');
  assert(adapted.metadata_adaptation.conflicts.some(conflict => conflict.field === 'authors'));
  assert.deepEqual(adapted.metadata_variants, input.metadata_variants);
  const options = await source('registered-xml', 'xml', xml);
  const metadata = await registeredSource(options.inputRoot, { role: 'source', path: 'source.xml', sha256: hash(xml) });
  assert.equal(metadata.document_id, 'riigiteataja:fixture-123');
  await assert.rejects(registeredSource(options.inputRoot, { role: 'review_source', path: 'source.xml', sha256: hash(xml) }), { code: 'registry_entry_requires_reconciliation' });
});

test('a confirmed top-level metadata value is selected with its alternatives superseded; registry metadata bytes are verified', async () => {
  const input = { docId: 'guide', title: 'Guide', source_type: 'guide', language: 'et', source_path: 'guide.pdf', source_format: 'pdf',
    publication_date: '2023-05-10', authority: 'Fictional Agency', metadata_variants: [{ metadata: { publication_date: '2025-01-01', publisher: 'FA' } }],
    metadata_confirmations: [{ field: 'publication_date', value: '2023-05-10', confirmed_by: 'synthetic-owner', confirmed_at: '2026-09-25', basis: 'Date printed on the cover' }] };
  const adapted = adaptMetadata(input, 'guide.json');
  assert.equal(adapted.publication_date, '2023-05-10');
  assert.deepEqual(adapted.metadata_adaptation.conflicts.map(conflict => conflict.field), ['authority']);
  assert.deepEqual(adapted.metadata_adaptation.confirmed.map(item => [item.field, item.superseded.map(candidate => candidate.value)]), [['publication_date', ['2025-01-01']]]);
  for (const change of [{ value: '2025-01-01' }, { field: 'publisher' }, { field: 'valid_to', value: '2030-01-01' }, { basis: ' ' }, { confirmed_at: 'yesterday' }]) {
    assert.throws(() => adaptMetadata({ ...input, metadata_confirmations: [{ ...input.metadata_confirmations[0], ...change }] }, 'guide.json'), /metadata_confirmation/);
  }
  assert.throws(() => adaptMetadata({ ...input, metadata_confirmations: [input.metadata_confirmations[0], input.metadata_confirmations[0]] }, 'guide.json'), /invalid_metadata_confirmation/);
  const dir = path.join(root, 'confirmed'); await fs.mkdir(dir, { recursive: true });
  const pdf = '%PDF-1.4 confirmed', metadataText = JSON.stringify(input), entry = { role: 'source', path: 'guide.pdf', sha256: hash(pdf), metadata_path: 'guide.json' };
  await fs.writeFile(path.join(dir, 'guide.pdf'), pdf); await fs.writeFile(path.join(dir, 'guide.json'), metadataText);
  await fs.writeFile(path.join(dir, 'REGISTER.json'), JSON.stringify({ entries: [entry, { role: 'metadata', path: 'guide.json', sha256: hash(metadataText) }] }));
  const metadata = await registeredSource(dir, entry);
  const parsed = { pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800], items: [{ text: 'Guide', x: 50, y: 700, width: 100, height: 20, item_index: 0 },
    { text: 'Body text of the fictional guide for the confirmation test.', x: 50, y: 660, width: 300, height: 11, item_index: 1 }] }] };
  const { bundle } = await ingest({ tenant, inputRoot: dir, metadata, storeRoot: path.join(dir, 'store'), rights, profile }, { parsePdf: async () => parsed });
  assert.equal(bundle.document.fields.publication_date.review_state, 'confirmed');
  assert.equal(bundle.document.fields.publication_date.provenance.at(-1).basis, 'Date printed on the cover');
  assert(!bundle.report.warnings.some(warning => warning.code === 'metadata_candidate_conflict' && warning.detail === 'publication_date'));
  await fs.writeFile(path.join(dir, 'guide.json'), JSON.stringify({ ...input, title: 'Changed' }));
  await assert.rejects(registeredSource(dir, entry), { code: 'registry_metadata_hash_mismatch' });
});

test('a confirmed absence empties a field and keeps every candidate as superseded', async () => {
  const absence = { field: 'publication_date', absent: true, confirmed_by: 'synthetic-owner', confirmed_at: '2026-09-25', basis: 'Title page gives only the year 2020' };
  const input = { docId: 'dated', title: 'Dated guide', source_type: 'guide', language: 'et', source_path: 'dated.pdf', source_format: 'pdf', year: 2020,
    metadata_variants: [{ metadata: { publication_date: '2024-03-03', year: 2020 } }], metadata_confirmations: [absence] };
  const adapted = adaptMetadata(input, 'dated.json');
  assert.equal(adapted.publication_date, undefined);
  assert.deepEqual(adapted.metadata_adaptation.conflicts, []);
  assert.deepEqual(adapted.metadata_adaptation.confirmed.map(item => [item.field, item.absent, item.superseded.map(c => c.value)]), [['publication_date', true, ['2024-03-03']]]);
  for (const change of [{ value: '2020-01-01' }, { field: 'title' }, { absent: false }]) {
    assert.throws(() => adaptMetadata({ ...input, metadata_confirmations: [{ ...absence, ...change }] }, 'dated.json'), /invalid_metadata_confirmation/);
  }
  const parsed = { pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800], items: [{ text: 'Dated guide', x: 50, y: 700, width: 100, height: 20, item_index: 0 },
    { text: 'Body text of the dated guide for the absence test.', x: 50, y: 660, width: 300, height: 11, item_index: 1 }] }] };
  const { source_path: _path, source_format: _format, ...fields } = input;
  const { bundle } = await ingest(await source('confirmed-absence', 'pdf', '%PDF-1.4 absence', fields), { parsePdf: async () => parsed });
  const field = bundle.document.fields.publication_date;
  assert.equal(field.value, null); assert.equal(field.review_state, 'confirmed'); assert.equal(field.provenance.at(-1).reason, 'confirmed_absent');
});

test('a legal act takes its jurisdiction from the verified register, else from an unambiguous issuer; a changed register is re-read', async () => {
  const dir = path.join(root, 'jurisdiction'); await fs.mkdir(path.join(dir, 'register'), { recursive: true });
  const act = (issuer, id) => xml.replace('Fixture issuer', issuer).replace('fixture-123', id);
  const acts = { 'listed.xml': act('Fixture issuer', 'act-1'), 'raasiku.xml': act('Raasiku Vallavolikogu', 'act-2'),
    'tallinn.xml': act('Tallinna Linnavalitsus', 'act-3'), 'government.xml': act('Vabariigi Valitsus', 'act-4'),
    'minister.xml': act('Sotsiaalkaitseminister', 'act-5'), 'unlisted.xml': act('Tundmatu Vallavolikogu', 'act-6'), 'later.xml': act('Fixture issuer', 'act-7') };
  for (const [name, text] of Object.entries(acts)) await fs.writeFile(path.join(dir, name), text);
  const writeRegister = async entries => {
    const register = JSON.stringify({ entries }); await fs.writeFile(path.join(dir, 'register', 'kov.json'), register);
    await fs.writeFile(path.join(dir, 'REGISTER.json'), JSON.stringify({ entries: [{ role: 'source_register', path: 'register/kov.json', sha256: hash(register) }] }));
  };
  await writeRegister([{ sha256: hash(acts['listed.xml']), municipality_id: 'harku_vald', municipality_name: 'Harku vald' },
    { sha256: 'e'.repeat(64), municipality_id: 'raasiku_vald', municipality_name: 'Raasiku vald' },
    { sha256: 'f'.repeat(64), municipality_id: 'tallinn', municipality_name: 'Tallinn' }]);
  const read = async name => { const m = await registeredSource(dir, { role: 'source', path: name, sha256: hash(acts[name]) });
    return [m.jurisdiction_level, m.municipality_id, m.jurisdiction_basis]; };
  assert.deepEqual(await read('listed.xml'), ['municipal', 'harku_vald', 'source_register_hash']);
  assert.deepEqual(await read('raasiku.xml'), ['municipal', 'raasiku_vald', 'issuer_name']);
  assert.deepEqual(await read('tallinn.xml'), ['municipal', 'tallinn', 'issuer_name']);
  assert.deepEqual(await read('government.xml'), ['national', undefined, 'issuer_name']);
  assert.deepEqual(await read('minister.xml'), ['national', undefined, 'issuer_name']);
  assert.deepEqual(await read('unlisted.xml'), ['municipal', undefined, 'issuer_name']);
  assert.deepEqual(await read('later.xml'), [undefined, undefined, undefined]);
  await writeRegister([{ sha256: hash(acts['later.xml']), municipality_id: 'harku_vald', municipality_name: 'Harku vald' }]);
  assert.deepEqual(await read('later.xml'), ['municipal', 'harku_vald', 'source_register_hash']);
  assert.deepEqual(await read('listed.xml'), [undefined, undefined, undefined]);
});

test('percent-encoded and written URLs compare equal; an invalid escape keeps its written form', () => {
  const written = metadataValue('source_url', 'https://example.test/õigus');
  assert.equal(metadataValue('source_url', 'https://example.test/%C3%B5igus'), written);
  assert.equal(metadataValue('source_url', 'https://example.test/o%CC%83igus'), written);
  assert.equal(metadataValue('source_url', 'https://example.test/%E0%A4%A'), 'https://example.test/%E0%A4%A');
  // A space or plus in a file name is the same character written or escaped; the host has no case.
  assert.equal(metadataValue('source_url', 'https://Example.TEST/files/SAK UA+bleed3mm.pdf'), metadataValue('source_url', 'https://example.test/files/SAK%20UA%2Bbleed3mm.pdf'));
  assert.equal(metadataValue('source_url', 'https://example.test/?q=%C3%B5igus'), metadataValue('source_url', 'https://example.test/?q=õigus'));
  // Escaped separators are not the separators themselves.
  for (const [a, b] of [['https://example.test/a%2Fb', 'https://example.test/a/b'], ['https://example.test/?q=a%26b', 'https://example.test/?q=a&b'],
    ['https://example.test/?q=a%2Bb', 'https://example.test/?q=a+b'], ['https://example.test/a#x%3Dy', 'https://example.test/a#x=y']]) {
    assert.notEqual(metadataValue('source_url', a), metadataValue('source_url', b), `${a} ~ ${b}`);
    const adapted = adaptMetadata({ document_id: 'u', title: 'U', source_type: 'guide', language: 'et', source_path: 'u.pdf', source_url: a,
      metadata_variants: [{ metadata: { source_url: b } }] }, 'u.json');
    assert.deepEqual(adapted.metadata_adaptation.conflicts.map(conflict => conflict.field), ['source_url']);
  }
});

test('a legal act in force with no end date matches a validity date; unknown validity does not', () => {
  const fields = (from, to, openEnd) => ({ document: { fields: { publication_date: { value: null }, valid_from: { value: from },
    valid_to: { value: to, ...openEnd ? { open_end: true } : {} } } } });
  assert.equal(filtersMatch(fields('2025-01-01', null, true), { valid_at: '2026-09-25' }), true);
  assert.equal(filtersMatch(fields('2025-01-01', null, true), { valid_at: '2024-12-31' }), false);
  assert.equal(filtersMatch(fields('2025-01-01', null, false), { valid_at: '2026-09-25' }), false);
  assert.equal(filtersMatch(fields('2025-01-01', '2025-12-31', false), { valid_at: '2026-09-25' }), false);
  assert.equal(filtersMatch(fields('2025-01-01', '2027-01-01', false), { valid_at: '2026-09-25' }), true);
});

test('XML declarations and calendar-date zones preserve legal text and original date provenance', async () => {
  const document = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml.replace('2025-01-01</', '2025-01-01+02:00</')
    .replace('>1</kuvatavNr>', '><![CDATA[§ 1. ]]></kuvatavNr>');
  const { bundle } = await ingest(await source('xml-declaration', 'xml', document));
  assert.equal(bundle.document.fields.valid_from.value, '2025-01-01');
  assert.equal(bundle.document.fields.valid_from.provenance[0].raw, '2025-01-01+02:00');
  assert(bundle.source_units.some(unit => unit.raw_text.includes('§ 1.')));
});

test('municipality names title unnamed packages but do not conflict with service/contact titles', () => {
  for (const title of ['Koduteenus', 'Sotsiaaltöötaja']) {
    const metadata = adaptMetadata({ title, municipality_name: 'Näidisvald', municipality_id: 'example_vald' });
    assert.equal(metadata.title, title); assert.deepEqual(metadata.metadata_adaptation.conflicts, []);
    assert.equal(metadata.metadata_adaptation.origins.title, '/title');
  }
  const packageMetadata = adaptMetadata({ municipality: { name: 'Näidisvald' }, items: [] }, 'package.json');
  assert.equal(packageMetadata.title, 'Näidisvald'); assert.equal(packageMetadata.metadata_adaptation.origins.title, '/municipality/name');
  const named = adaptMetadata({ title: 'Näidisvalla üldkontakt', name: 'Näidisvallavalitsus', municipality_name: 'Näidisvald' });
  assert.deepEqual(named.metadata_adaptation.conflicts, []); assert.equal(named.name, 'Näidisvallavalitsus');
  const conflict = adaptMetadata({ title: 'Koduteenus', metadata_variants: [{ metadata: { title: 'Teine teenus' } }], municipality_name: 'Näidisvald' });
  assert.deepEqual(conflict.metadata_adaptation.conflicts.map(c => c.field), ['title']);
});

test('calendar-date comparison removes only lexical zones and retains genuine date conflicts', async () => {
  for (const raw of ['2025-01-01', '2025-01-01Z', '2025-01-01+02:00', '2025-01-01-14:00']) {
    assert.equal(metadataValue('valid_from', raw), '2025-01-01');
    assert.equal(metadataValue('source_checked_at', raw), raw);
  }
  for (const invalid of ['2025-02-30Z', '2025-01-01+20:00', '2025-01-01T00:00:00Z']) assert.equal(metadataValue('valid_from', invalid), invalid);
  const equivalent = adaptMetadata({ valid_from: '2025-01-01+02:00', effective_start: '2025-01-01' });
  assert.equal(equivalent.valid_from, '2025-01-01+02:00'); assert.deepEqual(equivalent.metadata_adaptation.conflicts, []);
  const differing = adaptMetadata({ valid_from: '2025-01-01+02:00', effective_start: '2025-01-02' });
  assert(differing.metadata_adaptation.conflicts.some(c => c.field === 'valid_from'));
  const document = xml.replace('2025-01-01</', '2025-01-01+02:00</');
  const options = await source('xml-equal-date', 'xml', document, { title: 'Fictional garden rules', valid_from: '2025-01-01+02:00' });
  const { bundle } = await ingest(options);
  assert(!bundle.report.warnings.some(w => w.code === 'source_metadata_conflict' && w.detail === 'valid_from'));
  assert.equal(bundle.document.fields.valid_from.value, '2025-01-01');
  assert.equal(bundle.document.fields.valid_from.candidates[0].value, '2025-01-01+02:00');
  const changed = await ingest({ ...options, metadata: { ...options.metadata, valid_from: '2025-01-02' } });
  assert(changed.bundle.report.warnings.some(w => w.code === 'source_metadata_conflict' && w.detail === 'valid_from'));
});

test('canonical municipality IDs reach directory filters and model metadata without guessing from names', async () => {
  const options = await source('municipality-scope', 'html', '<article><h1>Koduteenus</h1><p>Abi igapäevatoimingutega.</p></article>',
    { title: 'Koduteenus', municipality_id: 'example_vald', municipality_name: 'Näidisvald' });
  const { bundle } = await ingest(options);
  assert.deepEqual(bundle.document.fields.regions.value, ['example_vald']);
  assert.equal(filtersMatch(bundle, { region: 'example_vald' }), true);
  assert.equal(filtersMatch(bundle, { region: 'other_vald' }), false);
  assert.equal(filtersMatch(bundle, { valid_at: '2026-09-23' }), false, 'Unknown validity must not become current merely because municipality is known');
  const directory = retrievalDirectory(bundle, embeddingConfig());
  assert.equal(directoryScope([directory], { filters: { region: 'example_vald' }, includeDocumentLabels: false }).documentIds.length, 1);
  assert.equal(directoryScope([directory], { filters: { region: 'other_vald' } }).documentIds.length, 0);
  const metadata = modelSourceMetadata(bundle);
  assert.equal(metadata.municipality_name.value, 'Näidisvald'); assert.equal(metadata.municipality_id.value, 'example_vald');
  assert(metadata.regions.provenance.some(p => p.path === '/municipality_id'));
  const unknown = await ingest({ ...options, metadata: { ...options.metadata, municipality_id: undefined } });
  assert.equal(filtersMatch(unknown.bundle, { region: 'example_vald' }), false);
});

test('registered municipal records retain audience lists, collection dates and canonical URLs with provenance', async () => {
  const item = { id: 'garden-service', document_id: 'garden-service', title: 'Garden service', language: 'en', source_type: 'municipal_service',
    summary: 'A fictional municipal service.', audience: ['CLIENT', 'SOCIAL_WORKER'], url_canonical: 'https://example.test/service',
    checked_at: '2026-04-12', retrieved_at: '2026-04-11', valid_from: null, valid_to: null };
  const bytes = JSON.stringify({ items: [item] });
  const options = await source('registered-municipal', 'json', bytes);
  const metadata = await registeredSource(options.inputRoot, { role: 'source', path: 'source.json', sha256: hash(bytes) }, { itemId: item.id });
  const { bundle } = await ingest({ ...options, metadata });
  assert.deepEqual(bundle.document.fields.audience.value, ['CLIENT', 'SOCIAL_WORKER']);
  assert.deepEqual(bundle.document.fields.source_urls.value, ['https://example.test/service']);
  assert.equal(bundle.document.fields.source_urls.provenance[0].path, '/imported_metadata/url_canonical');
  assert.equal(bundle.document.fields.source_checked_at.value, '2026-04-12');
  assert.equal(bundle.document.fields.retrieved_at.value, '2026-04-11');
  assert.equal(bundle.document.fields.valid_from.value, null);
});

test('complete source metadata still adapts published dates and URLs without dropping original keys', async () => {
  const options = await source('published-html', 'html', '<article><p>A dated source.</p></article>',
    { published: '2024-09-25', url: 'https://example.test/article', publisher: 'Example Publisher' });
  const { bundle } = await ingest(options);
  assert.equal(bundle.document.fields.publication_date.value, '2024-09-25');
  assert.equal(bundle.document.fields.publication_date.provenance[0].path, '/published');
  assert.equal(bundle.document.fields.authority.value, 'Example Publisher');
  assert.equal(bundle.document.legacy_metadata.published, '2024-09-25');
  assert.deepEqual(bundle.document.legacy_metadata, options.metadata);
});

test('evidence bibliography carries journal year, issue and pages without inventing a publication date', async () => {
  const options = await source('journal-bibliography', 'html', '<article><p>A journal source paragraph.</p></article>',
    { journalTitle: 'Fixture Journal', issueLabel: '1/2016', pageRange: '3-6', year: 2016 });
  const { bundle } = await ingest(options);
  const chunk = bundle.chunks.find(item => item.source_text.includes('journal source'));
  const entry = sourceEntry(indexUnit(chunk, bundle, embeddingConfig()), bundle, 'ranked_seed', null);
  assert.equal(entry.bibliography.publication_date, null);
  assert.deepEqual({ ...entry.bibliography, title: undefined, authors: undefined, publication_date: undefined },
    { title: undefined, authors: undefined, publication_date: undefined, publication_year: 2016, journal_title: 'Fixture Journal', issue_label: '1/2016', page_range: '3-6' });
  const projection = modelProjection([entry], { tenant, query_id: 'query-fixture', generation_id: 'generation-fixture' });
  assert.equal(projection.context.sources.D1.issue_label, '1/2016');
  const plain = await ingest(await source('plain-bibliography', 'html', '<article><p>A plain source paragraph.</p></article>'));
  const plainChunk = plain.bundle.chunks.find(item => item.source_text.includes('plain source'));
  const plainEntry = sourceEntry(indexUnit(plainChunk, plain.bundle, embeddingConfig()), plain.bundle, 'ranked_seed', null);
  assert.deepEqual(Object.keys(plainEntry.bibliography).sort(), ['authors', 'publication_date', 'title']);
});

test('metadata provenance resolves in the immutable metadata asset, including absent optional fields', async () => {
  const options = await source('metadata-provenance', 'html', '<article><p>A source with sparse metadata.</p></article>');
  const { bundle } = await ingest(options);
  for (const field of [...Object.values(bundle.document.fields), ...Object.values(bundle.document.search_aids)]) {
    for (const provenance of field.provenance.filter(item => item.kind === 'metadata')) {
      let value = options.metadata;
      for (const key of provenance.path.slice(1).split('/')) {
        const decoded = key.replaceAll('~1', '/').replaceAll('~0', '~');
        assert(value && Object.hasOwn(value, decoded), `Missing metadata origin: ${provenance.path}`);
        value = value[decoded];
      }
    }
  }
});

test('invalid generic span indexes cannot fall back to PDF pages and forged cross-record neighbors are rejected', async () => {
  const parsed = { pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800], items: [
    { text: 'A canonical paragraph.', x: 40, y: 700, height: 12, width: 350, item_index: 0 } ] }] };
  const { bundle } = await ingest(await source('span-index', 'pdf', '%PDF-1.4 index'), { parsePdf: async () => parsed });
  const broken = structuredClone(bundle); broken.spans[0].source_unit_index = 99;
  assert.equal(unitForSpan(broken, broken.spans[0]), undefined);
  assert.throws(() => validateBundle(broken), /invalid_source_(unit_reference|span)/u);
  const decimal = structuredClone(bundle); decimal.spans[0].start = 0.1;
  assert.throws(() => validateBundle(decimal), /invalid_source_span/u);
  const { bundle: legal } = await ingest(await source('legal-neighbors', 'xml', xml));
  legal.chunks[0].next_id = legal.chunks[1].id;
  assert.throws(() => verifiedBundle(legal, tenant), /source_neighbor_mismatch/u);
});

test('the pilot transport and HTML export preserve generic references and reject changed locators', async () => {
  const { bundle, output } = await ingest(await source('pilot-html', 'html', '<article><p>An exact source quotation for the pilot.</p></article>'));
  const config = { mode: 'test', tenant, testBundlePath: path.join(output, 'bundle.json'), configHash: 'fixture',
    documents: { [bundle.document.id]: bundle.version.id } };
  const adapters = runtimeAdapters(async () => config, 'operator');
  const packet = await adapters.search(config, { hash: 'fixture' });
  assert.deepEqual(packet.reference_map.S1.source_locations, bundle.chunks[0].source_locations);
  await adapters.canonical(config, packet, 'S1');
  const row = { id: 'generic-restore', state: 'completed', configHash: config.configHash, expiresAt: null,
    payload: { packet, question: 'A source question', query: { language: 'en', tokens: 4 }, events: [],
      answer: { kind: 'partial', blocks: [{ text: 'The source has a statement.', refs: ['S1'], factual: true }], limitations: [], clarification: null } } };
  const service = new PilotService({ readConfig: async () => config, adapters, store: { mutate: async (_config, _row, fn) => fn() } });
  const restored = await service.restore(row);
  assert.deepEqual(restored.sources[0].source_locations, bundle.chunks[0].source_locations);
  assert.deepEqual(pilotChatResult(restored, 'conversation').sources[0].source_locations, bundle.chunks[0].source_locations);
  const report = evidenceHtml({ ...packet, warnings: [] });
  assert(report.includes('/article[1]/p[1]')); assert(!report.includes('PDF lk'));
  const forged = structuredClone(packet);
  forged.reference_map.S1.source_locations[0].path = '/article[1]/p[999]';
  await assert.rejects(adapters.canonical(config, forged, 'S1'), /canonical_reference_mismatch/u);
});

test('JSON record titles remain citable while technical package fields are excluded from evidence', async () => {
  const content = { organization_id: 'garden', slug: 'internal-slug', name: 'Garden centre', metadata_schema_version: 'v2.5',
    summary: 'Fictional garden services.', services: [{ id: 's1', title: 'Seedling service', summary: 'We supply seedlings.', resource_type: 'service', relatedContacts: ['contact-internal'] },
      { id: 's2', title: 'Tool service', summary: 'We lend garden tools.' }] };
  const { bundle } = await ingest(await source('json-content', 'json', JSON.stringify(content)));
  assert(bundle.source_units.some(unit => unit.locator.path === '/services/0/title' && unit.raw_text === 'Seedling service'));
  const text = bundle.chunks.map(chunk => chunk.source_text).join('\n');
  assert(!/internal-slug|v2\.5|contact-internal/u.test(text));
  for (const chunk of bundle.chunks) for (const next of [chunk.next_id, chunk.previous_id].filter(Boolean)) {
    assert.equal(bundle.chunks.find(candidate => candidate.id === next).record_key, chunk.record_key);
  }
});

test('a contact binding identity keeps its own section, apart from the contact text', async () => {
  const item = { id: 'contact-1', itemType: 'contact', municipality_id: 'garden_vald', name: 'Fictional Contact', role: 'Fictional social worker',
    phone: '+372 5555 0000', language: 'en', source_type: 'municipal_contact', registry_binding: { service_id: 'fictional-service-7', verified: true } };
  const bytes = JSON.stringify({ items: [item] });
  const options = await source('contact-binding', 'json', bytes);
  const metadata = await registeredSource(options.inputRoot, { role: 'source', path: 'source.json', sha256: hash(bytes) }, { itemId: item.id });
  const { bundle } = await ingest({ ...options, metadata });
  const binding = bundle.chunks.filter(chunk => chunk.source_text.includes('fictional-service-7'));
  assert.equal(binding.length, 1);
  assert(!binding[0].source_text.includes('+372 5555 0000'));
  assert(bundle.chunks.some(chunk => chunk.source_text.includes('+372 5555 0000') && !chunk.source_text.includes('fictional-service-7')));
});

test('nested HTML lists retain parent text and omit hidden inline content', async () => {
  const options = await source('nested-html', 'html', '<article><ul><li>Parent <strong>condition</strong><ul><li>Child detail</li></ul></li></ul><p>Visible<span hidden>Hidden</span></p></article>');
  const { bundle } = await ingest(options);
  const text = bundle.chunks.map(chunk => chunk.source_text).join('\n');
  assert.match(text, /Parent\s+condition\s+Child detail/u);
  assert(!text.includes('Hidden'));
});

test('legacy PDF bundles without generic source units remain readable', async () => {
  const options = await source('legacy', 'pdf', '%PDF-1.4 legacy fixture');
  const parsed = { info: {}, pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800], items: [
    { text: 'A retained historical PDF source.', x: 40, y: 700, height: 12, width: 350, item_index: 0 } ] }] };
  const { bundle } = await ingest(options, { parsePdf: async () => parsed });
  const legacy = structuredClone(bundle); legacy.schema_version = 'rag-v2/1'; delete legacy.source_units;
  delete legacy.version.source_format; delete legacy.version.source_hash;
  for (const chunk of legacy.chunks) delete chunk.source_locations;
  assert.equal(validateBundle(legacy), legacy);
});
