// Dokumentide leht: vaadete tekstid on kataloogis, read ja reeglid teevad, mida lubavad,
// ja leht hoiab seda, mida silm kergesti ei märka.
//
// Leht oli üks pikk veerg vanal ühisel kihil (`documents-*` üldreeglid); nüüd on see vaadetena
// sammulaval (components/documents/workspace/DocumentsViews.jsx). Read ja otsused on failis
// documentRows.js ilma JSX-ita, et neid saaks siin päriselt välja kutsuda.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ENTRY_CARDS, TYPE_FILTERS, UPLOAD_ACCEPT, VIEW_TEXT_KEYS,
  documentRow, entryCards, filterItems, filterOptions, itemActions, itemFacts, itemSheet, removalState, uploadProblem, viewKeysFor,
} from '../components/documents/workspace/documentRows.js';
import { MAX_DOCUMENT_SIZE_BYTES, TEMPLATE_FOR_VALUES } from '../lib/documents/constants.js';
import { unfinishedRagRemoval } from '../lib/documents/ragRemovalState.js';
import { buildWorkspaceItems, WORKSPACE_TYPES } from '../lib/documents/workspace.js';
import { RAG_AVAILABLE } from '../lib/rag/retired.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const LANGS = ['et', 'en', 'ru'];
const PAGE = '../components/documents/DocumentsPage.jsx';
const VIEWS = '../components/documents/workspace/DocumentsViews.jsx';
const ROWS = '../components/documents/workspace/documentRows.js';

/* Sama reegel mis lehe `t`-l: puuduv võti annab varuteksti või võtme enda. Nii
   paistab testis välja iga koht, kus ekraanile jõuaks võti või toores väärtus. */
function translator(lang) {
  const messages = catalog(lang);
  return (key, arg2, arg3) => {
    const vars = arg2 && typeof arg2 === 'object' ? arg2 : arg3 && typeof arg3 === 'object' ? arg3 : null;
    const fallback = typeof arg2 === 'string' ? arg2 : typeof arg3 === 'string' ? arg3 : '';
    const value = at(messages, key);
    const text = typeof value === 'string' ? value : fallback || key;
    return vars ? text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match)) : text;
  };
}

const looksRaw = (text) => /^[a-z_0-9]+(\.[a-z_0-9]+)+$/.test(text) || /^[A-Z][A-Z_]{2,}$/.test(text) || /^[a-z]+_[a-z_]+$/.test(text);

const SAMPLE = buildWorkspaceItems({
  documents: [
    { id: 'd1', title: 'Leping', originalName: 'leping.pdf', size: 2048, kind: 'MATERIAL', agentAllowed: false, updatedAt: '2026-10-09T09:00:00Z' },
    { id: 'd2', title: '', originalName: 'mall.docx', size: 900, kind: 'TEMPLATE', agentAllowed: true, updatedAt: '2026-10-08T09:00:00Z' },
    { id: 'd3', title: 'Kinnituse kirje', originalName: 'kinnitus.pdf', size: 10, kind: 'OTHER', readOnly: true, updatedAt: '2026-10-07T09:00:00Z' },
    { id: 'd4', title: 'Kõne', originalName: 'kone.txt', size: 10, kind: 'AUDIO_TRANSCRIPT', agentAllowed: true, metadata: { ragRemoval: { status: 'failed' } }, updatedAt: '2026-10-06T09:00:00Z' },
    { id: 'd5', title: 'Aruanne 09', originalName: 'aruanne.pdf', size: 10, kind: 'SERVICE_LOG_REPORT', metadata: { retentionEndsAt: '2033-10-01T00:00:00Z' }, updatedAt: '2026-10-05T09:00:00Z' },
    { id: 'd6', title: 'Ootel', originalName: 'ootel.txt', size: 10, kind: 'MATERIAL', metadata: { ragRemoval: { status: 'pending' } }, updatedAt: '2026-10-04T09:00:00Z' },
  ],
  artifacts: [
    { id: 'a1', title: 'Kiri', status: 'DRAFT', updatedAt: '2026-10-03T09:00:00Z' },
    { id: 'a2', title: 'Kokkuvõte', status: 'FINAL', downloadUrls: { docx: '/api/documents/artifacts/a2/download?format=docx', pdf: '/api/documents/artifacts/a2/download?format=pdf' }, updatedAt: '2026-10-02T09:00:00Z' },
  ],
  analyses: [{ id: 'n1', title: 'Otsuse selgitus', updatedAt: '2026-10-01T09:00:00Z' }],
  research: [
    { id: 'r1', query: 'Hooldajatoetus', status: 'running', convId: 'c 1', updatedAt: '2026-09-30T09:00:00Z' },
    { id: 'r2', query: 'Erihoolekanne', status: 'done', updatedAt: '2026-09-29T09:00:00Z' },
    { id: 'r3', query: 'Tundmatu seis', status: 'SOMETHING_NEW', updatedAt: '2026-09-28T09:00:00Z' },
  ],
});
const byId = (id) => SAMPLE.find((item) => item.id === id);

test('vaadete ja ridade tekstivõtmed on kataloogis kolmes keeles', () => {
  const keys = new Set();
  for (const source of [PAGE, VIEWS, ROWS]) {
    /* Iga sõnega kirjutatud võti: nii `t("…")` kutsed kui ka võtmed, mida hoitakse tabelis
       (kustutamise sõnad, kaartide ja filtrite sildid). Mallisõnega kokku pandud vaadete nimed
       kontrollib järgmine test. */
    for (const match of read(source).matchAll(/"((?:documents|auth|common|buttons|chat)\.[a-zA-Z0-9_.]+)"/g)) keys.add(match[1]);
  }
  assert.ok(keys.size > 60, `võtmeid leiti ${keys.size}`);
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual([...keys].filter((key) => typeof at(messages, key) !== 'string'), [], lang);
  }
});

test('igal vaatel on nimi ja lühinimi kiirmenüü jaoks; lava sõnad kannavad oma kohatäitjaid', () => {
  /* Iga osa, mida leht lavale annab, on nimega vaadete hulgas. */
  for (const keys of [viewKeysFor(), viewKeysFor({ opened: true }), viewKeysFor({ client: true, opened: true })]) {
    for (const key of keys) assert.ok(VIEW_TEXT_KEYS.includes(key), `vaatel ${key} on tekstid`);
  }
  for (const lang of LANGS) {
    const views = catalog(lang).documents.views;
    for (const key of VIEW_TEXT_KEYS) {
      assert.ok(views[key]?.title && views[key]?.short, `${lang}: ${key}`);
      assert.ok(views[key].short.length <= 18, `${lang}: ${key} lühinimi mahub kiirmenüüsse`);
    }
    assert.ok(views.all && views.back_to_list && views.confirm_delete && views.confirm_stop, lang);
    for (const mark of ['{current}', '{total}', '{label}']) assert.ok(views.position.includes(mark), `${lang}: ${mark}`);
    assert.ok(views.list.count.includes('{count}'), `${lang}: loendi arv`);
  }
});

test('lehe osad: spetsialistil tegevused, lisamine, loend ja raamistik; pöördujal ainult lähtefailid', () => {
  assert.deepEqual(viewKeysFor(), ['entry', 'add', 'list', 'framework']);
  assert.deepEqual(viewKeysFor({ opened: true }), ['entry', 'add', 'list', 'item', 'framework']);
  assert.deepEqual(viewKeysFor({ client: true }), ['list']);
  assert.deepEqual(viewKeysFor({ client: true, opened: true }), ['list', 'item']);
});

test('sisenemise kaardid: neli tegevust viivad teisele lehele, kaks selle lehe osasse', () => {
  const t = translator('et');
  const cards = entryCards({ t, locale: 'et', researchEnabled: true });
  assert.deepEqual(cards.map((card) => card.key), ['analyze', 'compose', 'transcribe', 'research', 'add', 'list']);
  assert.deepEqual(cards.map((card) => card.href), ['/vestlus', '/dokreziim', '/dokreziim?path=audio', '/vestlus', null, null]);
  assert.deepEqual(cards.map((card) => card.view), [null, null, null, null, 'add', 'list']);
  for (const card of cards) assert.ok(card.title && card.description && !looksRaw(card.title) && !looksRaw(card.description), card.key);
  /* Kui süvauuringut ei saa käivitada, ütleb kaart seda selgituse asemel. */
  const off = entryCards({ t, locale: 'et', researchEnabled: false }).find((card) => card.key === 'research');
  assert.equal(off.description, catalog('et').documents.workspace.research_disabled);
  assert.equal(ENTRY_CARDS.filter((card) => card.offKey).length, 1);
  /* Faili lisamise kaart ei luba enam helifaili, mida vorm vastu ei võta. */
  for (const lang of LANGS) assert.ok(!/heli|audio|аудио/i.test(catalog(lang).documents.views.entry.add_file_desc), lang);
});

test('tüübifilter: iga loendi tüüp kuulub täpselt ühte rühma ja tundmatu filter näitab kõike', () => {
  const grouped = TYPE_FILTERS.flatMap((filter) => filter.types || []);
  assert.deepEqual([...grouped].sort(), [...WORKSPACE_TYPES].sort());
  assert.equal(filterItems(SAMPLE, 'ALL').length, SAMPLE.length);
  assert.deepEqual(filterItems(SAMPLE, 'FILES').map((item) => item.id).sort(), ['d1', 'd2', 'd3', 'd4', 'd6']);
  assert.deepEqual(filterItems(SAMPLE, 'ARTIFACTS').map((item) => item.id).sort(), ['a1', 'a2']);
  assert.deepEqual(filterItems(SAMPLE, 'SERVICE_LOG').map((item) => item.id), ['d5']);
  assert.equal(filterItems(SAMPLE, 'NO_SUCH_FILTER').length, SAMPLE.length);
  assert.deepEqual(filterItems(null, 'ALL'), []);
  for (const lang of LANGS) {
    const options = filterOptions(translator(lang));
    assert.equal(options.length, 6);
    for (const option of options) assert.ok(option.label && !looksRaw(option.label), `${lang}: ${option.value}`);
  }
});

test('ükski rida ega fakt ei kuva võtit ega toorest väärtust üheski keeles', () => {
  for (const lang of LANGS) {
    const t = translator(lang);
    for (const item of SAMPLE) {
      const sheet = itemSheet(item, { t, locale: lang });
      /* Pealkiri ja faili nimi on inimese enda sõnad; kõik muu tuleb kataloogist. */
      const texts = [sheet.type, sheet.note, ...sheet.chips.map((chip) => chip.text), ...sheet.facts.flatMap((fact) => [fact.label, fact.value])];
      for (const text of texts.filter(Boolean)) assert.ok(!looksRaw(text), `${lang} ${item.key}: „${text}”`);
      assert.ok(sheet.title && sheet.type && sheet.date, `${lang} ${item.key}: pealkiri, tüüp ja aeg`);
      assert.equal(sheet.facts.length, 5, `${lang} ${item.key}: viis fakti`);
    }
  }
});

test('rea märgid: tüüp alati, seis ainult siis, kui see ütleb midagi juurde', () => {
  const t = translator('et');
  const chips = (id) => documentRow(byId(id), { t, locale: 'et' }).chips.map((chip) => `${chip.key}:${chip.tone}`);
  assert.deepEqual(chips('d1'), []);
  assert.deepEqual(chips('d2'), ['shared:ok']);
  assert.deepEqual(chips('d3'), ['system:quiet']);
  /* Pooleli eemaldamine on tähtsam kui see, et fail on töörežiimi lubatud. Kuni vana otsing
     on suletud, eemaldamine ei loe (sealt ei saa midagi eemaldada): rida näitab luba ennast. */
  assert.deepEqual(chips('d4'), RAG_AVAILABLE ? ['removal:risk'] : ['shared:ok']);
  assert.deepEqual(chips('d6'), RAG_AVAILABLE ? ['removal:wait'] : []);
  assert.deepEqual(chips('a1'), []);
  assert.deepEqual(chips('r1'), ['status:wait']);
  assert.deepEqual(chips('r2'), ['status:ok']);
  /* Tundmatu uuringu olek ei kuva toorest väärtust: see loetakse ootel olevaks. */
  assert.deepEqual(chips('r3'), ['status:wait']);
  assert.equal(documentRow(byId('r3'), { t, locale: 'et' }).chips[0].text, catalog('et').documents.workspace.research_status.queued);
  assert.equal(documentRow(byId('a1'), { t, locale: 'et' }).tone, 'wait');
  assert.equal(documentRow(byId('a2'), { t, locale: 'et' }).tone, 'ok');
  /* Pealkirjata fail saab sõnad, mitte tühja rea. */
  assert.equal(documentRow({ key: 'x', type: 'analysis', title: '' }, { t, locale: 'et' }).title, catalog('et').documents.workspace.untitled);
  /* Mõlemad harud: töötava indeksiga loeb lõpetamata eemaldamine nagu enne, suletud indeksiga
     ei loe. Vaikimisi otsustab seda `lib/rag/retired.js`. */
  assert.equal(removalState(byId('d4'), { ragAvailable: true }), 'failed');
  assert.equal(removalState(byId('d6'), { ragAvailable: true }), 'pending');
  assert.equal(removalState(byId('d4'), { ragAvailable: false }), '');
  assert.equal(removalState(byId('d6'), { ragAvailable: false }), '');
  assert.equal(removalState(byId('d4')), RAG_AVAILABLE ? 'failed' : '');
  assert.equal(removalState(byId('d1'), { ragAvailable: true }), '');
  assert.equal(removalState({ raw: { metadata: { ragRemoval: { status: 'done' } } } }, { ragAvailable: true }), '');
});

test('pöörduja lähtefailide rida on lihtne: märke ega päritolu fakte ei ole', () => {
  const t = translator('et');
  const row = documentRow(byId('d2'), { t, locale: 'et', plain: true });
  assert.equal(row.type, '');
  assert.deepEqual(row.chips, []);
  const sheet = itemSheet(byId('d1'), { t, locale: 'et', plain: true });
  assert.deepEqual(sheet.facts, []);
  assert.equal(sheet.file, 'leping.pdf · 2 KB');
});

test('avatud dokumendi tegevused järgivad liiki ja seisu', () => {
  const can = (id, options = {}) => itemActions(byId(id), { locale: 'et', ...options });

  /* Tavaline fail: alla laadida, ümber nimetada, lubada töörežiimi, kustutada. */
  assert.equal(can('d1').download, '/api/documents/d1/download');
  assert.equal(can('d1').rename, true);
  assert.deepEqual(can('d1').share, { checked: false, removal: '' });
  assert.equal(can('d1').remove, 'document');
  /* „Koosta sellest” ainult töörežiimi lubatud failist. */
  assert.equal(can('d1').compose, null);
  assert.equal(can('d2').compose, '/dokreziim?documents=d2');
  /* Pooleli eemaldamise ajal luba ei muudeta: vaade saab seisu kaasa. Suletud otsingu ajal
     seisu ei ole ja luba saab muuta mõlemat pidi. */
  assert.deepEqual(can('d4').share, { checked: true, removal: RAG_AVAILABLE ? 'failed' : '' });

  /* Süsteemi loodud kirje: ainult allalaadimine. */
  assert.deepEqual(
    { ...can('d3'), download: null },
    { download: null, compose: null, rename: false, share: null, open: null, docx: null, pdf: null, copy: false, chat: null, stop: false, text: false, remove: null },
  );
  assert.equal(can('d3').download, '/api/documents/d3/download');

  /* Teenuspäeviku aruanne: saab alla laadida, muuta ega kustutada ei saa. */
  assert.equal(can('d5').download, '/api/documents/d5/download');
  assert.equal(can('d5').rename, false);
  assert.equal(can('d5').share, null);
  assert.equal(can('d5').remove, null);

  /* Analüüs: tekst avaneb koos dokumendiga. */
  assert.equal(can('n1').text, true);
  assert.equal(can('n1').remove, 'analysis');
  assert.equal(can('n1').download, null);

  /* Mustand ja kinnitatud tulemus. */
  assert.equal(can('a1').open, '/documents/artifacts/a1');
  assert.equal(can('a1').docx, null);
  assert.equal(can('a1').copy, true);
  assert.equal(can('a1').remove, 'artifact');
  assert.ok(can('a2').docx.endsWith('format=docx') && can('a2').pdf.endsWith('format=pdf'));

  /* Töös olevat uuringut peatatakse, lõppenut kustutatakse; mitte mõlemat korraga. */
  assert.equal(can('r1').stop, true);
  assert.equal(can('r1').remove, null);
  assert.equal(can('r1').chat, '/vestlus?conv=c%201');
  assert.equal(can('r2').stop, false);
  assert.equal(can('r2').remove, 'research');
  assert.equal(can('r2').chat, null);

  /* Pöörduja: oma lähtefaili saab alla laadida ja kustutada, muud mitte. */
  const client = can('d2', { client: true });
  assert.equal(client.download, '/api/documents/d2/download');
  assert.equal(client.remove, 'document');
  assert.equal(client.rename, false);
  assert.equal(client.share, null);
  assert.equal(client.compose, null);

  /* Tundmatu tüüp ei saa ühtegi tegevust. */
  assert.equal(Object.values(itemActions({ id: 'x', type: 'something_new' }, { locale: 'et' })).some(Boolean), false);
  assert.equal(itemFacts(byId('d5'), translator('et')).find((fact) => fact.key === 'retention').value, 'kuni 2033-10-01');
});

test('faili valik: lubatud tüübid on serveri omad ja liiga suur fail ei lähe teele', () => {
  assert.equal(UPLOAD_ACCEPT, '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain');
  assert.equal(uploadProblem(null), '');
  assert.equal(uploadProblem({ size: MAX_DOCUMENT_SIZE_BYTES }), '');
  assert.equal(uploadProblem({ size: MAX_DOCUMENT_SIZE_BYTES + 1 }), 'documents.errors.file_too_large');
});

// --- Brauseris kinnitatud vead (10.10) --------------------------------------------------

// Liigi „Mall” korral oli vaade paneelist kõrgem (brauseris 535 px 522 px paneelis).
test('faili lisamine mahub paneeli ka malli puhul: otstarbe küsimus on lahtrite kõrval ja read hoiavad oma veerge', () => {
  /* KITSAS TÖÖLAUA PANEEL (34 kuni 40 rem). Otstarbe rida on kolmes veerus kaks rida (enne
     kahes veerus kolm) ja liik üks rida (enne kaks). Lahter on seal 2,75 rem ja ridade vahe
     0,4 rem: vaade on 2 × (2,75 + 0,4) rem ehk umbes 100 px madalam. */
  assert.equal(Math.ceil(TEMPLATE_FOR_VALUES.length / 3), 2);
  assert.equal(Math.ceil(TEMPLATE_FOR_VALUES.length / 2), 3);
  /* Sildid on lühikesed sõnad: kolm kõrvuti mahuvad (pikim alla 25 märgi igas keeles). */
  for (const lang of LANGS) {
    const messages = catalog(lang).documents;
    for (const value of TEMPLATE_FOR_VALUES) assert.ok(messages.template_for[value.toLowerCase()].length <= 24, `${lang}: ${value}`);
    for (const kind of ['template', 'material', 'other']) assert.ok(messages.kinds[kind].length <= 10, `${lang}: ${kind}`);
  }
});

// Üleslaadimine võtab malliks vastu PDF-, DOCX- ja TXT-faili, aga kinnitatud faili kuju annab
// ainult Wordi mall. Jalarida ütleb seda ja ütleb, kust kohatäitjad teada saab.
test('malli lisamisel ütleb jalarida, mis on tõsi: kuju annab ainult Wordi mall', () => {
  /* Lause on vaate jalareal nupu kõrval (seal ei tee see vaadet kõrgemaks) ja ainult malli puhul. */
  for (const lang of LANGS) {
    const help = catalog(lang).documents.form.template_help;
    assert.ok(/DOCX/.test(help) && help.split(/[.!?](?:\s|$)/).filter(Boolean).length === 2, `${lang}: kaks lauset, Wordi mall nimetatud`);
    /* Teine lause viitab koostamisruumi malli vaatele, kus kohatäitjad on kirjas. */
    assert.ok(help.includes(catalog(lang).documents.drafting.views.template.short), lang);
    assert.ok(catalog(lang).documents.drafting.template.lead.includes('{placeholders}'), `${lang}: malli vaade loetleb kohatäitjad`);
  }
  /* Olemasolevaid üleslaadimisi ei piirata: server võtab malliks endiselt kõik kolm tüüpi. */
  assert.equal(UPLOAD_ACCEPT.split(',').filter((part) => part.startsWith('.')).join(','), '.pdf,.docx,.txt');
});

// Luba „Luba töörežiimis” jäi pärast äravõtmist lukku, sest vana otsingukoopia eemaldamine
// ei saa suletud otsingust õnnestuda. Kaart ja fakt lubasid ka otsingut, mida enam ei ole.
test('suletud otsingu ajal: luba ei lähe lukku ja tekstid ei luba otsingut', () => {
  for (const status of ['pending', 'failed']) {
    assert.equal(unfinishedRagRemoval({ status }, { ragAvailable: true }), status);
    assert.equal(unfinishedRagRemoval({ status }, { ragAvailable: false }), '');
  }
  for (const other of [{ status: 'done' }, { status: 'SOMETHING' }, {}, null, undefined]) assert.equal(unfinishedRagRemoval(other, { ragAvailable: true }), '');

  /* Kaart ütleb, mida luba praegu annab; otsingust ei räägi kumbki leht. */
  for (const lang of LANGS) assert.ok(!/otsing|search|поиск/i.test(catalog(lang).documents.views.item.share_desc), lang);

  /* Fakt „Otsing”: lubatud fail ei lähe praegu ühtegi otsingusse. */
  const allowed = byId('d2');
  const fact = (item) => itemFacts(item, translator('et')).find((entry) => entry.key === 'rag').value;
  const words = catalog('et').documents.provenance.rag;
  assert.equal(allowed.provenance.rag, RAG_AVAILABLE ? 'in_search_when_shared' : 'not_in_search');
  assert.equal(fact(allowed), RAG_AVAILABLE ? words.in_search_when_shared : words.not_in_search);
  assert.equal(fact(byId('d4')), RAG_AVAILABLE ? words.removal_failed : words.not_in_search);
  assert.equal(fact(byId('d1')), words.not_in_search);
});

// Kinnitatud tekstist ei tehta PDF-i, kui selles on märke, mida PDF-i kirjatüüp ei kanna;
// loend pakkus linki ikka ja see vastas veaga.
test('loendi avatud tekst: PDF-i linki ei pakuta, kui PDF-i ei tehtud', async () => {
  const { pdfWasRendered } = await import('../components/documents/workspace/documentRows.js');
  assert.equal(pdfWasRendered({ provenance: { rendered: { docx: true, pdf: false } } }), false);
  assert.equal(pdfWasRendered({ provenance: { rendered: { docx: true, pdf: true } } }), true);
  assert.equal(pdfWasRendered({ provenance: {} }), true, 'vanem kirje ilma märketa');
  assert.equal(pdfWasRendered(null), true);
  const final = (rendered) => itemActions({ id: 'a1', type: 'final', raw: { downloadUrls: { docx: '/d', pdf: '/p' }, provenance: { rendered } } }, { locale: 'et' });
  assert.equal(final({ docx: true, pdf: false }).pdf, null);
  assert.equal(final({ docx: true, pdf: true }).pdf, '/p');
  assert.equal(final({ docx: true, pdf: false }).docx, '/d');
});
