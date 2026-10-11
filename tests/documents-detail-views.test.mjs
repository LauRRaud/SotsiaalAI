// Dokumendi ja koostatud teksti detaililehed: vaadete tekstid on kataloogis, reeglid teevad,
// mida lubavad, ja lehed hoiavad seda, mida silm kergesti ei märka.
//
// Kaks lehte (/documents/<id> ja /documents/artifacts/<id>) olid vanal ühisel kihil ühe pika
// veeruna; nüüd on need vaadetena sammulaval (components/documents/detail) samade klotsidega
// mis dokumentide leht. Reeglid on failis detailModel.js ilma JSX-ita, et neid saaks siin
// päriselt välja kutsuda: millised osad lehel on, mida saab alla laadida, kuhu saab jagada
// ja mida teine vajutus teeb.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DETAIL_VIEW_KEYS, RequestFailure, TWO_PRESS_MIN_GAP_MS, VISIBLE_ROOM_CHOICES,
  artifactDownloads, artifactItem, artifactPartKeys, artifactSheet, artifactTitle, artifactTypeText,
  canShareMeetingSummary, documentHref, documentItem, documentPartKeys, documentSheet, documentText,
  documentsHref, draftDirty, draftingHref, failureText, isDraft, isHeldActivation, isShareableSummary,
  pressOutcome, serverMessage, shareOutcome, shareRoomOptions, sourceRows, wordCount,
} from '../components/documents/detail/detailModel.js';
import { AGENT_ARTIFACT_TYPE_VALUES, DOCUMENT_KIND_VALUES } from '../lib/documents/constants.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const LANGS = ['et', 'en', 'ru'];

const ARTIFACT_PAGE = '../components/documents/ArtifactDetailPage.jsx';
const DOCUMENT_PAGE = '../components/documents/DocumentDetailPage.jsx';
const SHARE = '../components/documents/MeetingSummaryRoomShare.jsx';
const VIEWS = '../components/documents/detail/DetailViews.jsx';
const MODEL = '../components/documents/detail/detailModel.js';
const HOOKS = '../components/documents/detail/detailHooks.js';
const SOURCES = [ARTIFACT_PAGE, DOCUMENT_PAGE, SHARE, VIEWS, MODEL, HOOKS];

/* Sama reegel mis lehe `t`-l: puuduv võti annab varuteksti või võtme enda. Nii paistab
   testis välja iga koht, kus ekraanile jõuaks võti või toores väärtus. */
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

const DRAFT = {
  id: 'a1', type: 'LETTER_DRAFT', title: 'Kiri vallale', status: 'DRAFT', content: 'Tere.\n\nPalun vastust.',
  createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-03T09:00:00Z', approvedAt: null,
  template: { id: 't1', title: '', originalName: 'kirjamall.docx' },
  sources: [
    { id: 's1', title: 'Otsus', originalName: 'otsus.pdf', kind: 'MATERIAL' },
    { id: 's2', title: 'kone.txt', originalName: 'kone.txt', kind: 'AUDIO_TRANSCRIPT' },
    { id: 's3', title: '', originalName: '', kind: 'SOMETHING_NEW' },
  ],
  downloadUrls: {},
};
const FINAL = {
  id: 'a 2', type: 'MEETING_SUMMARY', title: '', status: 'FINAL', content: 'Kohtumise kokkuvõte.',
  createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-04T09:00:00Z', approvedAt: '2026-10-04T09:00:00Z',
  template: null, sources: [],
  downloadUrls: { docx: '/api/documents/artifacts/a%202/download?format=docx', pdf: '/api/documents/artifacts/a%202/download?format=pdf' },
  provenance: { rendered: { docx: { sha256: 'x', size: 10 }, pdf: { sha256: 'y', size: 12 } } },
};

test('lehtede, vaadete ja reeglite tekstivõtmed on kataloogis kolmes keeles', () => {
  const keys = new Set();
  for (const source of SOURCES) {
    /* Iga sõnega kirjutatud võti. Mallisõnega kokku pandud vaadete ja teksti liikide nimed
       kontrollivad järgmised testid. */
    for (const match of read(source).matchAll(/"((?:documents|common|errors|rooms|api)\.[a-zA-Z0-9_.]+)"/g)) keys.add(match[1]);
  }
  assert.ok(keys.size > 55, `võtmeid leiti ${keys.size}`);
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual([...keys].filter((key) => typeof at(messages, key) !== 'string'), [], lang);
  }
});

test('igal vaatel on nimi ja lühinimi kiirmenüü jaoks ning tekstid kannavad oma kohatäitjaid', () => {
  /* Iga osa, mida leht lavale annab, on nimega vaadete hulgas. */
  const lists = [
    artifactPartKeys({ draft: true }), artifactPartKeys({ draft: true, shareable: true }), artifactPartKeys(),
    artifactPartKeys({ shareable: true }), documentPartKeys(), documentPartKeys({ hasText: true }),
  ];
  for (const keys of lists) for (const key of keys) assert.ok(DETAIL_VIEW_KEYS.includes(key), `vaatel ${key} on tekstid`);
  for (const lang of LANGS) {
    const detail = catalog(lang).documents.detail;
    for (const key of DETAIL_VIEW_KEYS) {
      assert.ok(detail.views[key]?.title && detail.views[key]?.short, `${lang}: ${key}`);
      assert.ok(detail.views[key].short.length <= 18, `${lang}: ${key} lühinimi mahub kiirmenüüsse`);
    }
    assert.ok(detail.summary.words.includes('{count}') && detail.summary.shared.includes('{room}'), `${lang}: plaatide kokkuvõtted`);
    assert.ok(detail.approve.question.includes('{title}'), `${lang}: kinnitamise küsimus nimetab teksti`);
    const share = catalog(lang).documents.meeting_summary_share;
    assert.ok(share.lead.includes('{title}'), `${lang}: jagamise juhis nimetab kokkuvõtte`);
    for (const key of ['confirm_note', 'success', 'approval_failed']) assert.ok(share[key].includes('{room}'), `${lang}: ${key} nimetab ruumi`);
  }
});

test('eestikeelsetes tekstides ei ole mõttekriipse ja jutumärgid on „ ”', () => {
  const messages = catalog('et');
  const texts = [];
  const walk = (node) => Object.values(node).forEach((value) => (typeof value === 'string' ? texts.push(value) : walk(value)));
  walk(messages.documents.detail);
  for (const key of ['question', 'lead', 'request_approval_desc', 'confirm', 'confirm_note', 'rooms_failed', 'approval_requested', 'approval_failed', 'success', 'no_rooms']) {
    texts.push(messages.documents.meeting_summary_share[key]);
  }
  assert.ok(texts.length > 30);
  for (const text of texts) {
    assert.ok(!/[–—]/.test(text), `mõttekriips: ${text}`);
    assert.ok(!/["“]/.test(text), `vale jutumärk: ${text}`);
  }
});

test('koostatud teksti osad: leht avaneb tekstil, mustandil on kinnitamine, jagamine ainult neile, kes tohivad', () => {
  assert.deepEqual(artifactPartKeys({ draft: true }), ['text', 'approve', 'sheet', 'sources']);
  /* Mustandit ei jagata: ruumi läheb ainult kinnitatud kokkuvõte. */
  assert.deepEqual(artifactPartKeys({ draft: true, shareable: true }), ['text', 'approve', 'sheet', 'sources']);
  assert.deepEqual(artifactPartKeys(), ['text', 'sheet', 'sources']);
  assert.deepEqual(artifactPartKeys({ shareable: true }), ['text', 'sheet', 'share', 'sources']);
  assert.equal(isDraft(DRAFT), true);
  assert.equal(isDraft(FINAL), false);
  assert.equal(isDraft(null), false);

  assert.equal(isShareableSummary(FINAL), true);
  assert.equal(isShareableSummary({ ...FINAL, status: 'DRAFT' }), false);
  assert.equal(isShareableSummary({ ...FINAL, type: 'LETTER_DRAFT' }), false);
  assert.equal(isShareableSummary(null), false);
  for (const role of ['SOCIAL_WORKER', 'SERVICE_PROVIDER', 'ADMIN', ' social_worker ']) assert.equal(canShareMeetingSummary({ role }), true, role);
  assert.equal(canShareMeetingSummary({ role: 'CLIENT', isAdmin: true }), true);
  for (const user of [{ role: 'CLIENT' }, { role: '' }, {}, null]) assert.equal(canShareMeetingSummary(user), false);
});

test('faili lehe osad: tekst on osa ainult siis, kui server selle andis', () => {
  assert.deepEqual(documentPartKeys(), ['sheet']);
  assert.deepEqual(documentPartKeys({ hasText: true }), ['sheet', 'text']);
  assert.equal(documentText({ content: 'Tere' }), 'Tere');
  assert.equal(documentText({ content: '  \n ' }), '');
  assert.equal(documentText({}), '');
  assert.equal(documentText(null), '');
});

test('teksti liik ja pealkiri: iga liik saab sõna kolmes keeles, tundmatu liik ei kuva koodi', () => {
  for (const lang of LANGS) {
    const t = translator(lang);
    for (const type of AGENT_ARTIFACT_TYPE_VALUES) {
      const text = artifactTypeText(type, t);
      assert.ok(text && !looksRaw(text), `${lang} ${type}: „${text}”`);
    }
    assert.equal(artifactTypeText('SOMETHING_NEW', t), catalog(lang).documents.artifact_types.other);
    assert.equal(artifactTypeText(undefined, t), catalog(lang).documents.artifact_types.other);
  }
  const t = translator('et');
  assert.equal(artifactTitle(DRAFT, t), 'Kiri vallale');
  /* Pealkirjata tekst kannab oma liigi nime, mitte tühja rida. */
  assert.equal(artifactTitle(FINAL, t), catalog('et').documents.artifact_types.meeting_summary);
  assert.equal(artifactTitle({ title: '   ', type: 'X' }, t), catalog('et').documents.artifact_types.other);
});

test('koostatud teksti andmete leht: faktid, liik ja ajad on sõnadega, märkus ütleb, mida alla laadida saab', () => {
  for (const lang of LANGS) {
    const t = translator(lang);
    for (const artifact of [DRAFT, FINAL]) {
      const sheet = artifactSheet(artifact, { t, locale: lang });
      const texts = [sheet.type, sheet.note, ...sheet.chips.map((chip) => chip.text), ...sheet.facts.flatMap((fact) => [fact.label, fact.value])];
      for (const text of texts.filter(Boolean)) assert.ok(!looksRaw(text), `${lang} ${artifact.id}: „${text}”`);
      assert.ok(sheet.title && sheet.type && sheet.date, `${lang} ${artifact.id}: pealkiri, tüüp ja aeg`);
    }
    /* Liik on märgina näha; pealkirjata tekst kannab liigi nime pealkirjas ja märki ei korrata. */
    assert.deepEqual(artifactSheet(DRAFT, { t, locale: lang }).chips.map((chip) => chip.text), [catalog(lang).documents.artifact_types.letter_draft]);
    assert.deepEqual(artifactSheet(FINAL, { t, locale: lang }).chips, []);
    assert.equal(artifactSheet(FINAL, { t, locale: lang }).title, catalog(lang).documents.artifact_types.meeting_summary);
  }
  const t = translator('et');
  const draft = artifactSheet(DRAFT, { t, locale: 'et' });
  assert.equal(draft.tone, 'wait');
  assert.equal(draft.note, catalog('et').documents.draft_notice);
  /* Viis päritolu fakti ja loomise aeg; kinnitamise aeg ainult kinnitatud tekstil. */
  assert.deepEqual(draft.facts.map((fact) => fact.key), ['audience', 'origin', 'state', 'retention', 'rag', 'created']);
  const final = artifactSheet(FINAL, { t, locale: 'et' });
  assert.equal(final.tone, 'ok');
  assert.equal(final.note, '');
  assert.deepEqual(final.facts.map((fact) => fact.key), ['audience', 'origin', 'state', 'retention', 'rag', 'created', 'approved']);
  assert.equal(artifactSheet(null, { t, locale: 'et' }), null);
  assert.equal(artifactItem({ id: 'x', status: 'FINAL' }).type, 'final');
  assert.equal(artifactItem({ id: 'x', status: 'DRAFT' }).type, 'draft');
});

test('allalaadimine: mustandil ei ole faile; PDF-i linki ei näidata, kui PDF-i ei tehtud', () => {
  assert.deepEqual(artifactDownloads(DRAFT), { docx: null, pdf: null, pdfMissing: false });
  assert.deepEqual(artifactDownloads(null), { docx: null, pdf: null, pdfMissing: false });
  assert.deepEqual(artifactDownloads(FINAL), { docx: FINAL.downloadUrls.docx, pdf: FINAL.downloadUrls.pdf, pdfMissing: false });
  /* Kinnitamise kirje ütleb, et PDF-i ei ole (tekstis on märke, mida PDF ei toeta). Link
     viiks veateateni, seepärast seda ei näidata, ka siis, kui see vastuses oleks. */
  const noPdf = { ...FINAL, provenance: { rendered: { docx: { sha256: 'x', size: 10 }, pdf: null } } };
  assert.deepEqual(artifactDownloads(noPdf), { docx: FINAL.downloadUrls.docx, pdf: null, pdfMissing: true });
  /* Server annab PDF-i lingi ainult olemasolevale failile: Wordi link ilma PDF-i lingita
     tähendab sama, ka siis, kui kinnitamise kirje reaga kaasa ei tulnud (loend). */
  const docxOnly = { ...FINAL, provenance: null, downloadUrls: { docx: FINAL.downloadUrls.docx } };
  assert.deepEqual(artifactDownloads(docxOnly), { docx: FINAL.downloadUrls.docx, pdf: null, pdfMissing: true });
  assert.equal(artifactSheet(noPdf, { t: translator('et'), locale: 'et' }).note, catalog('et').api.exports.pdf_content_not_supported);
  /* Vana kinnitatud tekst ilma kirjeta: mõlemad lingid jäävad, nagu server need andis. */
  assert.deepEqual(artifactDownloads({ ...FINAL, provenance: null }), { docx: FINAL.downloadUrls.docx, pdf: FINAL.downloadUrls.pdf, pdfMissing: false });
});

test('allikad: mall ja failid on read, mis viivad faili oma lehele; toorest koodi ega tühja rida ei ole', () => {
  const t = translator('et');
  const { template, sources } = sourceRows(DRAFT, { t, locale: 'et' });
  assert.deepEqual(template, { key: 'template:t1', title: 'kirjamall.docx', sub: '', chip: catalog('et').documents.template_label, href: '/documents/t1' });
  assert.deepEqual(sources.map((row) => row.key), ['source:s1', 'source:s2', 'source:s3']);
  assert.deepEqual(sources.map((row) => row.href), ['/documents/s1', '/documents/s2', '/documents/s3']);
  /* Faili nimi on teine rida ainult siis, kui see ütleb pealkirjast midagi muud. */
  assert.deepEqual(sources.map((row) => row.sub), ['otsus.pdf', '', '']);
  assert.equal(sources[2].title, catalog('et').documents.workspace.untitled);
  for (const lang of LANGS) {
    for (const row of sourceRows(DRAFT, { t: translator(lang), locale: lang }).sources) assert.ok(row.chip && !looksRaw(row.chip), `${lang}: ${row.key} „${row.chip}”`);
  }
  assert.deepEqual(sourceRows(FINAL, { t, locale: 'et' }), { template: null, sources: [] });
  assert.deepEqual(sourceRows(null, { t, locale: 'et' }), { template: null, sources: [] });
  assert.equal(documentHref('a b', 'et'), '/documents/a%20b');
});

test('teed: tagasi dokumentidesse ja mustand koostamisruumis samal kujul, mille koostamisruum ise kirjutab', () => {
  assert.equal(documentsHref('et'), '/documents');
  assert.equal(documentsHref('et', { artifacts: true }), '/documents?artifacts=all#artifacts');
  assert.equal(draftingHref(DRAFT, 'et'), '/dokreziim?documents=s1%2Cs2%2Cs3&artifact=a1');
  assert.equal(draftingHref({ id: 'a9', sources: [] }, 'et'), '/dokreziim?artifact=a9');
  assert.equal(wordCount('  üks  kaks\nkolm '), 3);
  assert.equal(wordCount(''), 0);
  assert.equal(wordCount(null), 0);
});

test('faili andmete leht: spetsialistil päritolu faktid, pöördujal faili nimi ja liik', () => {
  const samples = DOCUMENT_KIND_VALUES.map((kind, index) => ({
    id: `d${index}`, title: `Fail ${index}`, originalName: `fail${index}.pdf`, size: 2048, kind, agentAllowed: index % 2 === 0, updatedAt: '2026-10-09T09:00:00Z',
  }));
  samples.push({ id: 'dx', title: '', originalName: 'aruanne.pdf', size: 10, kind: 'SERVICE_LOG_REPORT', updatedAt: '2026-10-09T09:00:00Z' });
  for (const lang of LANGS) {
    const t = translator(lang);
    for (const document of samples) {
      const item = documentItem(document);
      for (const plain of [false, true]) {
        const sheet = documentSheet(item, { t, locale: lang, plain });
        const texts = [sheet.type, sheet.note, ...sheet.chips.map((chip) => chip.text), ...sheet.facts.flatMap((fact) => [fact.label, fact.value])];
        for (const text of texts.filter(Boolean)) assert.ok(!looksRaw(text), `${lang} ${document.kind}: „${text}”`);
        assert.ok(sheet.title && sheet.date && sheet.file, `${lang} ${document.kind}: pealkiri, aeg ja fail`);
      }
    }
  }
  const t = translator('et');
  const item = documentItem(samples[1]);
  assert.equal(documentSheet(item, { t, locale: 'et' }).facts.length, 5);
  /* Pöörduja lihtne kuju: märke ega päritolu fakte ei ole, faili liik on alles (nagu vanal lehel). */
  const plain = documentSheet(item, { t, locale: 'et', plain: true });
  assert.deepEqual(plain.facts, [{ key: 'kind', label: catalog('et').documents.form.kind_label, value: catalog('et').documents.kinds.material }]);
  assert.equal(plain.type, '');
  assert.equal(plain.file, 'fail1.pdf · 2 KB');
  assert.equal(documentItem(null), null);
  assert.equal(documentItem({ title: 'tunnuseta' }), null);
});

test('jagamise ruumid: ainult ruumid, kus on veel keegi ja mis ei ole arhiveeritud; tunnust ei kuvata', () => {
  const t = translator('et');
  const rooms = [
    { id: 'r1', title: 'Mari tugiring', memberCount: 3, archivedAt: null },
    { id: 'r2', title: 'Ainult mina', memberCount: 1 },
    { id: 'r3', title: 'Lõpetatud', memberCount: 4, archivedAt: '2026-09-01T00:00:00Z' },
    { id: 'ckz9x0001', title: null, memberCount: 2 },
    { id: 'r5', title: '   ', memberCount: '2' },
    { title: 'tunnuseta', memberCount: 5 },
  ];
  const options = shareRoomOptions(rooms, t);
  assert.deepEqual(options.map((option) => option.value), ['r1', 'ckz9x0001', 'r5']);
  /* Pealkirjata ruum saab sõna, mitte oma sisemist tunnust. */
  assert.deepEqual(options.map((option) => option.label), ['Mari tugiring', catalog('et').rooms.fallback_title, catalog('et').rooms.fallback_title]);
  assert.deepEqual(shareRoomOptions(null, t), []);
  assert.deepEqual(shareRoomOptions({ rooms: [] }, t), []);
  assert.ok(VISIBLE_ROOM_CHOICES >= 4 && VISIBLE_ROOM_CHOICES <= 8, 'lahtritena on korraga näha mõistlik hulk ruume');
});

test('jagamise tulemus: õnnestunud jagamine võib kanda hoiatust, et kinnitust ei saanud küsida', () => {
  assert.deepEqual(shareOutcome({ ok: true, summaryShare: { recorded: true, approvalRequested: false, approvalFailed: false } }), { approvalRequested: false, approvalWarn: false });
  assert.deepEqual(shareOutcome({ summaryShare: { approvalRequested: true, approvalFailed: false } }, { asked: true }), { approvalRequested: true, approvalWarn: false });
  assert.deepEqual(shareOutcome({ summaryShare: { approvalRequested: false, approvalFailed: true } }, { asked: true }), { approvalRequested: false, approvalWarn: true });
  /* Jagaja palus kinnitust, aga ringi ei avatud ja server viga ei märkinud: jagaja peab seda teadma. */
  assert.deepEqual(shareOutcome({ summaryShare: { approvalRequested: false, approvalFailed: false } }, { asked: true }), { approvalRequested: false, approvalWarn: true });
  assert.deepEqual(shareOutcome({}), { approvalRequested: false, approvalWarn: false });
});

test('serveri veateade: võti tõlgitakse, sõnata võti ega brauseri veatekst ekraanile ei jõua', () => {
  const t = translator('et');
  const fallback = 'Varutekst.';
  /* Ruumide marsruut saadab võtme ka väljal `message`. */
  assert.equal(serverMessage({ messageKey: 'api.rooms.summary_too_long', message: 'api.rooms.summary_too_long' }, t, fallback), catalog('et').api.rooms.summary_too_long);
  assert.equal(serverMessage({ message: 'api.rooms.archived_readonly' }, t, fallback), catalog('et').api.rooms.archived_readonly);
  /* Võti, millel kataloogis sõna ei ole, annab lehe enda lause. (Näide on väljamõeldud võti:
     `api.rooms.summary_not_confirmed` sai 10.10 kataloogi päris lause.) */
  assert.equal(serverMessage({ messageKey: 'api.rooms.sellist_votit_ei_ole', message: 'api.rooms.sellist_votit_ei_ole' }, t, fallback), fallback);
  assert.equal(serverMessage({ messageKey: 'api.rooms.summary_not_confirmed', message: 'api.rooms.summary_not_confirmed' }, t, fallback), catalog('et').api.rooms.summary_not_confirmed);
  /* Dokumentide marsruudid saadavad tõlgitud lause. */
  assert.equal(serverMessage({ messageKey: 'documents.artifacts.errors.version_conflict', message: 'Tõlgitud lause.' }, t, fallback), catalog('et').documents.artifacts.errors.version_conflict);
  assert.equal(serverMessage({ messageKey: 'tundmatu.voti', message: 'Serveri lause.' }, t, fallback), 'Serveri lause.');
  assert.equal(serverMessage({ message: { id: 'm1' } }, t, fallback), fallback);
  assert.equal(serverMessage({}, t, fallback), fallback);
  assert.equal(serverMessage(null, t, fallback), fallback);

  assert.equal(failureText(new RequestFailure('Serveri lause.'), fallback), 'Serveri lause.');
  assert.equal(failureText(new TypeError('Failed to fetch'), fallback), fallback);
  assert.equal(failureText(new RequestFailure(''), fallback), fallback);
  assert.equal(failureText(undefined, fallback), fallback);
});

test('teine vajutus: esimene relvastab, topeltklõps jääb vahele, all hoitud klahv ei kinnita', () => {
  assert.equal(pressOutcome({ armed: false, armedAt: 0, now: 1000 }), 'arm');
  assert.equal(pressOutcome({ armed: true, armedAt: 1000, now: 1000 + TWO_PRESS_MIN_GAP_MS - 1 }), 'wait');
  assert.equal(pressOutcome({ armed: true, armedAt: 1000, now: 1000 + TWO_PRESS_MIN_GAP_MS }), 'run');
  assert.ok(TWO_PRESS_MIN_GAP_MS >= 300, 'topeltklõps on lühem kui lubatud vahe');
  assert.equal(isHeldActivation({ repeat: true, key: 'Enter' }), true);
  assert.equal(isHeldActivation({ repeat: true, key: ' ' }), true);
  assert.equal(isHeldActivation({ repeat: false, key: 'Enter' }), false);
  assert.equal(isHeldActivation({ repeat: true, key: 'a' }), false);
  assert.equal(isHeldActivation(null), false);
});

test('mustand: salvestamine ja kinnitamine saadavad sama teksti; mis vahepeal juurde kirjutati, jääb alles', () => {
  assert.equal(draftDirty(DRAFT, { title: DRAFT.title, content: DRAFT.content }), false);
  assert.equal(draftDirty(DRAFT, { title: DRAFT.title, content: `${DRAFT.content} ` }), true);
  assert.equal(draftDirty(DRAFT, { title: 'Teine', content: DRAFT.content }), true);
  assert.equal(draftDirty({ title: null, content: null }, { title: '', content: '' }), false);
});

test('isiklik otsing viib faili lehele', () => {
  assert.ok(read('../lib/search/personalSearch.js').includes('href: `/documents/${encodeURIComponent(row.id)}`'), 'isiklik otsing viib faili lehele');
});

// --- Brauseris kinnitatud vead (10.10) --------------------------------------------------

// Serveri veateade tuli brauseri keeles, mitte lehe keeles: lehed ei saatnud oma keelt kaasa.
// Kinnitamisel otsustab sama päis ka kinnitatud failide siltide keele.
test('iga päring kannab lehe keelt', async () => {
  const { localeHeaders } = await import('../lib/documents/clientRequest.js');
  assert.deepEqual(localeHeaders('ru'), { 'x-ui-locale': 'ru' });
  assert.deepEqual(localeHeaders('en', { 'Content-Type': 'application/json' }), { 'Content-Type': 'application/json', 'x-ui-locale': 'en' });
  assert.deepEqual(localeHeaders(undefined), { 'x-ui-locale': 'et' });
  /* Server loeb sama päist (ja alles selle puudumisel brauseri keelt). */
  const server = read('../lib/documents/server.js');
  assert.ok(server.indexOf('request?.headers?.get("x-ui-locale")') < server.indexOf('request?.headers?.get("accept-language")'));
  /* Kinnitamine annab keele failide tegijale edasi. */
  const approve = read('../app/api/documents/artifacts/[id]/approve/route.js');
  assert.ok(approve.includes('const locale = localeFromRequest(request)') && /finalizeArtifact\(\s*\{[^}]*\blocale,/s.test(approve));
});

// Ekraanil olid sisemised sõnad („agendi tulemus”, „artefakt”), kuigi lehed räägivad muidu
// tekstist ja mustandist.
test('dokumentide tekstides ei ole sisemisi sõnu üheski keeles', () => {
  const inner = { et: /agendi|artefakt/i, en: /\bagent\b|artifact|artefact/i, ru: /агент|артефакт/i };
  const walk = (node, path) => Object.entries(node).flatMap(([key, value]) => (typeof value === 'string' ? [[`${path}.${key}`, value]] : walk(value, `${path}.${key}`)));
  for (const lang of LANGS) {
    const texts = walk(catalog(lang).documents, 'documents');
    assert.ok(texts.length > 400, `${lang}: tekste ${texts.length}`);
    assert.deepEqual(texts.filter(([, text]) => inner[lang].test(text)).map(([key]) => key), [], lang);
  }
  /* Lehe ja kiirmenüü nimi ning kustutamise küsimus räägivad tekstist. */
  assert.equal(catalog('et').documents.artifact_detail_title, 'Koostatud tekst');
  assert.ok(catalog('et').documents.confirm.delete_artifact.startsWith('Kas kustutada see tekst jäädavalt?'));
});

// Kohe pärast kinnitamist näitas allikate rida faili liigi asemel sõna „Muu”: kinnitamise
// vastus laadis allikfailid ilma liigita.
test('kinnitamise vastus kannab allikfaili liiki', () => {
  const finalization = read('../lib/documents/artifactFinalization.js');
  const include = finalization.slice(finalization.indexOf('const finalizationInclude = {'), finalization.indexOf('function sourceManifest('));
  const sources = include.slice(include.indexOf('sourceDocuments: {'), include.indexOf('finalSnapshot: true'));
  assert.ok(/\bkind: true,/.test(sources) && /\btemplateFor: true,/.test(sources), 'liik ja malli otstarve on valikus');
  assert.ok(read('../lib/documents/artifacts.js').includes('kind: document.kind,'), 'vastus annab liigi edasi');
  /* Rida kannab liigi sõna, kui liik on kaasas, ja ilma selleta üldist sõna. */
  const t = translator('et');
  const row = (kind) => sourceRows({ sources: [{ id: 's1', title: 'Märkmed', kind }] }, { t, locale: 'et' }).sources[0].chip;
  assert.equal(row('MATERIAL'), catalog('et').documents.kinds.material);
  assert.equal(row(undefined), catalog('et').documents.kinds.other);
});

test('vahelehe nimed on kataloogis kolmes keeles', () => {
  for (const key of ['detail_title', 'artifact_detail_title']) {
    for (const lang of LANGS) assert.equal(typeof catalog(lang).documents[key], 'string', `${lang}: ${key}`);
  }
});

test('koostatud teksti leht avaneb tekstil', () => {
  /* Mustand ja kinnitatud tekst avanevad mõlemad tekstil. */
  assert.equal(artifactPartKeys({ draft: true })[0], 'text');
  assert.equal(artifactPartKeys()[0], 'text');
});

test('lause allika avanemise kohta uues vahelehes on kataloogis kolmes keeles', () => {
  for (const lang of LANGS) assert.ok(at(catalog(lang), 'documents.detail.sources.opens_new_tab'), lang);
});

test('tagasi dokumentidesse: loendist tulnu läheb tavalisele lehele, mis märgi ära kasutab', async () => {
  const { isFreshListReturn } = await import('../components/documents/workspace/listReturn.js');
  const now = 1_000_000_000;
  assert.equal(isFreshListReturn(now - 60_000, now), true);
  assert.equal(isFreshListReturn(now - 31 * 60_000, now), false, 'pool tundi vana märk ei kehti');
  assert.equal(isFreshListReturn(0, now), false);
  assert.equal(isFreshListReturn(Number.NaN, now), false);
});
