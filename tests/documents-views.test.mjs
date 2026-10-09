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
import { MAX_DOCUMENT_SIZE_BYTES } from '../lib/documents/constants.js';
import { buildWorkspaceItems, WORKSPACE_TYPES } from '../lib/documents/workspace.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const LANGS = ['et', 'en', 'ru'];
const PAGE = '../components/documents/DocumentsPage.jsx';
const VIEWS = '../components/documents/workspace/DocumentsViews.jsx';
const ROWS = '../components/documents/workspace/documentRows.js';
const STYLES = '../components/documents/workspace/documents.module.css';

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
  const page = read(PAGE);
  assert.ok(page.includes('`documents.views.${key}.title`') && page.includes('`documents.views.${key}.short`'), 'leht võtab vaate nime kataloogist');
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
  assert.deepEqual(cards.map((card) => card.href), ['/vestlus', '/dokreziim', '/dokreziim', '/vestlus', null, null]);
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
  /* Pooleli eemaldamine on tähtsam kui see, et fail on töörežiimi lubatud. */
  assert.deepEqual(chips('d4'), ['removal:risk']);
  assert.deepEqual(chips('d6'), ['removal:wait']);
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
  assert.equal(removalState(byId('d4')), 'failed');
  assert.equal(removalState(byId('d1')), '');
  assert.equal(removalState({ raw: { metadata: { ragRemoval: { status: 'done' } } } }), '');
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
  /* Pooleli eemaldamise ajal luba ei muudeta: vaade saab seisu kaasa. */
  assert.deepEqual(can('d4').share, { checked: true, removal: 'failed' });

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

test('kustutamine ja peatamine küsivad teist vajutust; brauseri kinnitusakent ei ole', () => {
  const page = read(PAGE);
  assert.ok(!page.includes('window.confirm') && !read(VIEWS).includes('confirm('), 'brauseri kinnitusakent ei kasutata');
  assert.ok(page.includes('confirmAction(removeKey,') && page.includes('confirmAction(stopKey,'), 'kustutamine ja peatamine käivad läbi kahe vajutuse');
  assert.ok(page.includes('const armed = confirming === key') && page.includes('if (!armed) return armConfirm(key)'), 'esimene vajutus ainult relvastab');
  /* Teise vajutuse nupp seisab teistest tegevustest eraldi ja selgitus tuleb selle kõrvale:
     tegevusrea nupud ei tohi teise vajutuse ajaks selle kohale nihkuda. */
  const views = read(VIEWS);
  const confirmRow = views.slice(views.indexOf('className={styles.confirm}'), views.indexOf('</StepPanel>', views.indexOf('className={styles.confirm}')));
  assert.ok(confirmRow.includes('onClick={danger.onClick}') && confirmRow.includes('{danger.note}'), 'nupp ja selgitus on samal real');
  assert.ok(!page.includes('actions.push(confirmAction('), 'kahe vajutusega tegevus ei ole tegevusreas');
  /* Päringu ajaks nuppe välja ei lülitata (fookus kaoks); topeltvajutuse peab kinni lukk. */
  assert.ok(page.includes('if (busyRef.current) return undefined'), 'üks muutev päring korraga');
  for (const name of ['patchDocument', 'removeItem', 'copyArtifact', 'stopResearch']) {
    const start = page.indexOf(`async function ${name}(`);
    assert.ok(start > 0 && page.slice(start, start + 220).includes('return exclusive(async () => {'), `${name} käib läbi luku`);
  }
  /* Kustutav päring on lehel ühes kohas ja sinna viib ainult kahe vajutusega tegevus. */
  assert.equal(page.split('method: "DELETE"').length - 1, 1);
  assert.equal(page.match(/(?<![.\w])removeItem\(/g).length, 2, 'removeItem: kirjeldus ja üks kutse');
  assert.equal(page.match(/(?<![.\w])stopResearch\(/g).length, 2, 'stopResearch: kirjeldus ja üks kutse');
});

test('leht hoiab alles kõik päringud, pöörduja piirangu ja töölaua sees töötamise', () => {
  const page = read(PAGE);
  for (const url of [
    '`/api/documents?${params.toString()}`',
    '`/api/documents/artifacts?${params.toString()}`',
    '`/api/documents/analyses?${params.toString()}`',
    '`/api/research/jobs?${params.toString()}`',
    '"/api/framework-acceptances/worker"',
    'fetch("/api/documents", { method: "POST", body: formData })',
    '`/api/documents/${encodeURIComponent(id)}`',
    '`/api/documents/artifacts/${encodeURIComponent(id)}`',
    '`/api/documents/artifacts/${encodeURIComponent(artifactId)}`',
    '`/api/documents/analyses/${encodeURIComponent(id)}`',
    '`/api/research/jobs/${encodeURIComponent(id)}`',
    '`/api/research/jobs/${encodeURIComponent(id)}/stop`',
  ]) assert.ok(page.includes(url), url);
  assert.ok(page.includes('method: "PATCH"') && page.includes('expectedUpdatedAt: currentDocument.updatedAt'), 'muudatus kannab kaasa versiooni');
  assert.ok(page.includes('if (isClientRole) params.set("kind", "MATERIAL")'), 'pöörduja näeb ainult materjale');
  assert.ok(page.includes('DocumentsPage({ embedded = false, onBack = null, hideHeader = false })'), 'töölaua sees töötamise omadused');
  assert.ok(page.includes('if (isClientRole && embedded) return <div />'), 'pöörduja töölaua sees: tühi');
  assert.ok(page.includes('markChatWorkspaceRestore()') && page.includes('if (embedded) return content'), 'tagasitee ja töölaua kuju');
  assert.ok(page.includes('window.location.hash === "#artifacts" || params.has("artifacts")'), 'vana süvalink avab loendi');
  assert.ok(page.includes('loadMoreWorkspace') && read(VIEWS).includes('documents.workspace.load_more'), 'vanemate laadimine on alles');
});

test('leht on sammulaval osadena ja ei kasuta enam vana ühist kihti', () => {
  const page = read(PAGE);
  const views = read(VIEWS);
  assert.ok(page.split(/\r?\n/).some((line) => line.trim() === 'parts'), 'leht annab lavale `parts`');
  assert.ok(!page.includes('startWide'), 'leht avaneb sisenemise vaates, mitte kõigi osade vaates');
  for (const source of [page, views]) {
    assert.ok(!source.includes('role="status"'), 'teated ei kasuta status-rolli (ühine kiht joonistab selle kastina)');
    assert.ok(!/documents-[a-z]/.test(source.replace(/documents-add-help/g, '')), 'vanu `documents-*` klasse ei ole');
    assert.ok(!source.includes('feature-page') && !source.includes('ui/Panel"'), 'vana pinda ega pesastatud paneele ei ole');
    assert.ok(!source.includes('DocumentsDropdown') && !source.includes('OptionCard'), 'valikud on ühelaiused lahtrid, mitte rippvalik ega pillid');
  }
  /* Vanad üldreeglid on eemaldatud; teiste lehtede reegel samas plokis jäi alles. */
  const featureCss = read('../app/styles/feature-pages.css');
  assert.ok(!/\.documents-(entry|upload|list|item|provenance|notice|error|page)/.test(featureCss) && !featureCss.includes('feature-page--documents'));
  /* Koostamisruum on nüüd oma moodulis (components/agent/drafting): ka selle üldreeglid on läinud. */
  assert.ok(!featureCss.includes('.feature-page--agent') && !featureCss.includes('.agent-mode'), 'koostamise lehe üldreeglid on eemaldatud');
  assert.ok(!read('../app/styles/workspace.css').includes('.documents-dropzone'));
  /* Kujundus on mooduli klassidega: paljaste siltide peale reegleid ei kirjutata. */
  const css = read(STYLES).replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of css.matchAll(/(^|\})\s*([^{}@]+)\{/g)) {
    for (const selector of match[2].split(',')) {
      assert.ok(!/(^|[\s>+~])(p|h[1-6]|ul|li|dl|dt|dd|section|div|span|label|input|button|form|a)(?![\w-])/.test(selector.trim().replace(/:global\([^)]*\)/g, '')), `paljas silt valijas: ${selector.trim()}`);
    }
  }
});

test('ülevaatuse parandused: raamistiku vaade ei korda oma nime, otsing ei vaju kokku, topeltklõps ei kustuta', () => {
  const views = read('../components/documents/workspace/DocumentsViews.jsx');
  const framework = views.slice(views.indexOf('export function FrameworkView'));
  assert.ok(!/question=\{t\("documents\.views\.framework\.title"\)\}/.test(framework), 'vaate nimi ei ole paneelil nähtav küsimus');
  const css = read('../components/documents/workspace/documents.module.css');
  assert.match(css, /\.search\s*\{[^}]*flex:\s*1 1 16rem/);
  assert.ok(!/\.tools\s*\{[^}]*grid-template-columns/.test(css), 'otsing ja filter ei ole võrgus, kus filter võtab kogu rea');
  const page = read('../components/documents/DocumentsPage.jsx');
  assert.ok(page.includes('Date.now() - armedAt.current < CONFIRM_MIN_GAP_MS'));
  assert.ok(views.includes('event.target.value = "";'), 'failiväli tühjendatakse pärast lugemist');
});

test('töölaua sees avatud lehel ei korrata paneelil lehe pealkirja', () => {
  const panel = read('../components/chat/WorkspacePanel.jsx');
  assert.match(panel, /const EMBEDDED_TITLE_IN_DOCK = new Set\(\[[^\]]*"documents"[^\]]*"pre_inquiries"[^\]]*\]\);/);
  assert.ok(panel.includes('headerClassName={EMBEDDED_TITLE_IN_DOCK.has(activeEmbeddedFeature) ? "sr-only" : undefined}'));
});

test('faili lisamise vaade: kukutusala kannab ainult juhist, abitekst ja valitud fail on omal kohal (K07)', () => {
  const views = read(VIEWS);
  const start = views.indexOf('className={styles.dropzone}');
  const dropzone = views.slice(start, views.indexOf('</button>', start));
  assert.ok(start > 0 && dropzone.includes('documents.form.dropzone_idle') && dropzone.includes('documents.form.dropzone_active'));
  assert.ok(!dropzone.includes('file_help') && !dropzone.includes('form.file'), 'kukutusalas ei ole abiteksti ega faili nime');
  assert.ok(views.includes('className={styles.help}') && views.includes('className={styles.fileRow}'), 'abirida ja valitud faili rida on eraldi');
  /* Liik ja malli otstarve on ühelaiused lahtrid; malli otstarve ainult malli puhul. */
  assert.ok(views.includes('{form.templateFor ? (') && /templateFor:\s+uploadKind === "TEMPLATE"/.test(read(PAGE)));
  assert.equal(views.split('<ChoiceRow').length - 1, 3, 'liik, malli otstarve ja loendi filter');
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
