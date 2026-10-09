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
const STYLES = '../components/documents/detail/detail.module.css';
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
  for (const page of [ARTIFACT_PAGE, DOCUMENT_PAGE]) {
    const source = read(page);
    assert.ok(source.includes('`documents.detail.views.${key}.title`') && source.includes('`documents.detail.views.${key}.short`'), `${page} võtab vaate nime kataloogist`);
    assert.ok(source.includes('t("documents.views.all")') && source.includes('t("documents.views.position", { current, total, label })'), `${page}: lava sõnad on dokumentide lehe omad`);
  }
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
  /* Server pakub PDF-i linki alati; kinnitamise kirje ütleb, et PDF-i ei ole (tekstis on
     märke, mida PDF ei toeta). Link viiks veateateni, seepärast seda ei näidata. */
  const noPdf = { ...FINAL, provenance: { rendered: { docx: { sha256: 'x', size: 10 }, pdf: null } } };
  assert.deepEqual(artifactDownloads(noPdf), { docx: FINAL.downloadUrls.docx, pdf: null, pdfMissing: true });
  assert.equal(artifactSheet(noPdf, { t: translator('et'), locale: 'et' }).note, catalog('et').api.exports.pdf_content_not_supported);
  /* Vana kinnitatud tekst ilma kirjeta: mõlemad lingid jäävad, nagu server need andis. */
  assert.deepEqual(artifactDownloads({ ...FINAL, provenance: null }), { docx: FINAL.downloadUrls.docx, pdf: FINAL.downloadUrls.pdf, pdfMissing: false });
  /* Leht kasutab sama reeglit nii nuppude kui ka kinnitamise teate jaoks. */
  const page = read(ARTIFACT_PAGE);
  assert.ok(page.includes('if (downloads.docx) actions.push(') && page.includes('if (downloads.pdf) actions.push('), 'nupud tulevad reeglist');
  assert.ok(page.includes('artifactDownloads(payload.artifact).pdfMissing ? "documents.detail.approve.done_no_pdf" : "documents.feedback.approved"'), 'teade ei luba PDF-i, mida ei ole');
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
  /* Dokumentide leht loeb seda süvalinki ja koostamisruum neid kahte päringu välja. */
  assert.ok(read('../components/documents/DocumentsPage.jsx').includes('window.location.hash === "#artifacts" || params.has("artifacts")'));
  const drafting = read('../app/dokreziim/page.js');
  assert.ok(drafting.includes('params?.documents') && drafting.includes('params?.artifact'));
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
  const views = read(VIEWS);
  assert.ok(views.includes('rooms.options.length <= VISIBLE_ROOM_CHOICES'), 'pikem loend on rippvalik, lühem on kohe näha');
});

test('jagamise tulemus: õnnestunud jagamine võib kanda hoiatust, et kinnitust ei saanud küsida', () => {
  assert.deepEqual(shareOutcome({ ok: true, summaryShare: { recorded: true, approvalRequested: false, approvalFailed: false } }), { approvalRequested: false, approvalWarn: false });
  assert.deepEqual(shareOutcome({ summaryShare: { approvalRequested: true, approvalFailed: false } }, { asked: true }), { approvalRequested: true, approvalWarn: false });
  assert.deepEqual(shareOutcome({ summaryShare: { approvalRequested: false, approvalFailed: true } }, { asked: true }), { approvalRequested: false, approvalWarn: true });
  /* Jagaja palus kinnitust, aga ringi ei avatud ja server viga ei märkinud: jagaja peab seda teadma. */
  assert.deepEqual(shareOutcome({ summaryShare: { approvalRequested: false, approvalFailed: false } }, { asked: true }), { approvalRequested: false, approvalWarn: true });
  assert.deepEqual(shareOutcome({}), { approvalRequested: false, approvalWarn: false });
  /* Hoiatus jõuab lehele ja jääb lava kohale: komponent annab selle edasi, leht näitab. */
  const share = read(SHARE);
  assert.ok(share.includes('onShared?.({ room: selected.label, ...shareOutcome(data, { asked: requestApproval }) })'), 'komponent annab tulemuse lehele');
  const page = read(ARTIFACT_PAGE);
  assert.ok(page.includes('({ room, approvalRequested, approvalWarn })') && page.includes('"documents.meeting_summary_share.approval_failed"'), 'leht loeb hoiatuse märki');
  assert.ok(page.includes('<StayNotice t={t} notice={stay} onClose={() => setStay(null)} />'), 'teade on lava kohal');
  assert.ok(page.indexOf('<StayNotice') < page.indexOf('<StepFlight'), 'teade seisab lavast eespool');
});

test('serveri veateade: võti tõlgitakse, sõnata võti ega brauseri veatekst ekraanile ei jõua', () => {
  const t = translator('et');
  const fallback = 'Varutekst.';
  /* Ruumide marsruut saadab võtme ka väljal `message`. */
  assert.equal(serverMessage({ messageKey: 'api.rooms.summary_too_long', message: 'api.rooms.summary_too_long' }, t, fallback), catalog('et').api.rooms.summary_too_long);
  assert.equal(serverMessage({ message: 'api.rooms.archived_readonly' }, t, fallback), catalog('et').api.rooms.archived_readonly);
  /* Võti, millel kataloogis sõna ei ole, annab lehe enda lause. */
  assert.equal(serverMessage({ messageKey: 'api.rooms.summary_not_confirmed', message: 'api.rooms.summary_not_confirmed' }, t, fallback), fallback);
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
  /* Ükski leht ei näita püütud vea enda teksti: see käib alati läbi `failureText`. */
  for (const source of [ARTIFACT_PAGE, DOCUMENT_PAGE, SHARE]) {
    const text = read(source);
    assert.ok(!/[eE]rror\??\.message/.test(text), `${source}: vea toorest teksti ei kuvata`);
    assert.ok(text.includes('failureText(') && text.includes('new RequestFailure(serverMessage('), source);
  }
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

  const hooks = read(HOOKS);
  assert.ok(hooks.includes('pressOutcome({ armed, armedAt: armedAt.current, now: Date.now() })'), 'konks kasutab testitud reeglit');
  assert.ok(hooks.includes('if (outcome === "wait") return undefined'), 'liiga kiire teine vajutus ei tee midagi');
  assert.ok(hooks.includes('event.target.closest("button, a[href]")) event.preventDefault()'), 'klahvikordus ei jõua nupuni');
  for (const page of [ARTIFACT_PAGE, DOCUMENT_PAGE]) assert.ok(read(page).includes('onKeyDownCapture={blockHeldPress}'), `${page}: tõke on lehe juurel`);
});

test('kustutamine, kinnitamine ja jagamine küsivad teist vajutust; brauseri kinnitusakent ei ole', () => {
  for (const source of SOURCES) assert.ok(!read(source).includes('window.confirm') && !/[^.\w]confirm\(/.test(read(source)), `${source}: brauseri kinnitusakent ei kasutata`);

  const artifactPage = read(ARTIFACT_PAGE);
  assert.ok(artifactPage.includes('confirm.action("delete", {') && artifactPage.includes('confirm.action("approve", {'), 'kustutamine ja kinnitamine käivad läbi kahe vajutuse');
  assert.equal(artifactPage.split('method: "DELETE"').length - 1, 1);
  assert.equal(artifactPage.match(/(?<![.\w])deleteArtifact\(/g).length, 2, 'deleteArtifact: kirjeldus ja üks kutse');
  assert.equal(artifactPage.match(/(?<![.\w])approveArtifact\(/g).length, 2, 'approveArtifact: kirjeldus ja üks kutse');
  assert.ok(artifactPage.includes('run: () => void deleteArtifact()') && artifactPage.includes('run: () => void approveArtifact()'));

  const documentPage = read(DOCUMENT_PAGE);
  assert.ok(documentPage.includes('confirm.action("remove", {'), 'faili kustutamine käib läbi kahe vajutuse');
  assert.equal(documentPage.split('method: "DELETE"').length - 1, 1);
  assert.equal(documentPage.match(/(?<![.\w])removeDocument\(/g).length, 2, 'removeDocument: kirjeldus ja üks kutse');

  const share = read(SHARE);
  assert.ok(share.includes('confirm.action("share", {') && share.includes('run: () => void shareToRoom()'), 'jagamine käib läbi kahe vajutuse');
  assert.equal(share.match(/(?<![.\w])shareToRoom\(/g).length, 1, 'shareToRoom kutsutakse ainult teise vajutuse pealt');
  /* Valiku muutus võtab teise vajutuse ootelt maha: selgitus nimetas eelmist ruumi. */
  assert.ok(share.includes('confirm.disarm();') && share.includes('onChange: change(setSelectedRoomId)') && share.includes('onChange: change(setRequestApproval)'));
  /* Ruumi ei valita kellegi eest ette. */
  assert.ok(share.includes('setSelectedRoomId("");') && share.includes('if (busyRef.current || !selected) return;'));

  /* Päringu ajaks nuppe ega välju välja ei lülitata (fookus kaoks); topeltvajutuse peab kinni lukk. */
  assert.ok(artifactPage.includes('if (busyRef.current) return undefined') && documentPage.includes('if (busyRef.current) return undefined;'));
  const views = read(VIEWS);
  const editor = views.slice(views.indexOf('export function EditView'), views.indexOf('export function ApproveView'));
  assert.ok(!editor.includes('disabled'), 'mustandi välju ja nuppe ei lülitata päringu ajaks välja');
  /* Teise vajutuse nupp ja selle selgitus on samal real, nagu dokumentide lehel. */
  const row = views.slice(views.indexOf('function ConfirmRow'), views.indexOf('export function ReadView'));
  assert.ok(row.includes('className={shared.confirm}') && row.includes('onClick={action.onClick}') && row.includes('{action.note}'));
});

test('mustand: salvestamine ja kinnitamine saadavad sama teksti; mis vahepeal juurde kirjutati, jääb alles', () => {
  const page = read(ARTIFACT_PAGE);
  assert.ok(page.includes('body: JSON.stringify({ ...sent, expectedUpdatedAt: artifact.updatedAt })'), 'salvestus kannab versiooni');
  assert.ok(page.includes('body: JSON.stringify({ title, content, expectedUpdatedAt: artifact.updatedAt })'), 'kinnitus võtab kaasa väljade sisu ja versiooni');
  assert.ok(page.includes('setTitle((current) => (current === sent.title ? next.title || "" : current))'));
  assert.ok(page.includes('setContent((current) => (current === sent.content ? next.content || "" : current))'));
  /* Kinnitamise ja allikate vaade ning andmete leht saavad teada, et tekst on salvestamata. */
  assert.ok(page.includes('unsaved={dirty}') && page.split('unsaved={dirty}').length - 1 === 2, 'kinnitamine ja allikad');
  assert.ok(page.includes('sheet={dirty ? { ...sheet, note: t("documents.detail.unsaved_leave") } : sheet}'), 'andmete leht');
  assert.ok(page.includes('footFor("text", { unsaved: dirty })'), 'teksti vaate jalus');
  /* Lehe enda teed mustandi juurest mujale (tagasi, koostamisruum) küsivad salvestamata tekstiga teist vajutust. */
  assert.ok(page.includes('const leaving = (key, label, go) =>') && page.includes('confirm.action(`leave:${key}`, {'), 'lahkumine käib läbi kahe vajutuse');
  for (const use of ['leaving("text", back.label, goList)', 'leaving("sheet", back.label, goList)', 'leaving("drafting", t("documents.detail.open_drafting"),']) assert.ok(page.includes(use), use);
  assert.equal(page.match(/pushWithTransition\(router, draftingHref\(/g).length, 1, 'koostamisruumi viib ainult kaitstud tegevus');
  assert.ok(page.includes('window.addEventListener("beforeunload", warn)'), 'brauser küsib enne salvestamata tekstiga lahkumist');
  /* Mustandil kopeeritakse see, mis väljal näha on. */
  assert.ok(page.includes('String((draft ? content : artifact?.content) || "")'));
  /* Keele vahetus ei laadi teksti uuesti (see kirjutaks väljad üle). */
  assert.ok(page.includes('}, [applyArtifact, artifactId])'), 'laadimine ei sõltu tõlkijast');

  assert.equal(draftDirty(DRAFT, { title: DRAFT.title, content: DRAFT.content }), false);
  assert.equal(draftDirty(DRAFT, { title: DRAFT.title, content: `${DRAFT.content} ` }), true);
  assert.equal(draftDirty(DRAFT, { title: 'Teine', content: DRAFT.content }), true);
  assert.equal(draftDirty({ title: null, content: null }, { title: '', content: '' }), false);
});

test('lehed hoiavad alles kõik päringud ja teed', () => {
  const artifactPage = read(ARTIFACT_PAGE);
  for (const piece of [
    'fetch(`/api/documents/artifacts/${encodeURIComponent(artifactId)}`, { cache: "no-store" })',
    'method: "PATCH"',
    'fetch(`/api/documents/artifacts/${encodeURIComponent(artifactId)}/approve`, {',
    'fetch(`/api/documents/artifacts/${encodeURIComponent(artifactId)}`, { method: "DELETE" })',
    'navigator.clipboard.writeText(',
    'ArtifactDetailPage({ artifactId })',
    'usePanelInfoSlot({ infoId: "documents", title: t("documents.artifact_detail_title") })',
    '<MeetingSummaryRoomShare artifactId={artifactId}',
  ]) assert.ok(artifactPage.includes(piece), piece);

  const documentPage = read(DOCUMENT_PAGE);
  for (const piece of [
    'fetch(`/api/documents/${encodeURIComponent(documentId)}`, {',
    'cache: "no-store"',
    'DocumentDetailPage({ documentId })',
    'usePanelInfoSlot({ infoId: "documents", title: t("documents.detail_title") })',
    'itemActions(item, { locale, client: isClientRole })',
    'expectedUpdatedAt: record.updatedAt',
    'if (response.status === 409 && payload?.document?.id) setRecord(payload.document);',
  ]) assert.ok(documentPage.includes(piece), piece);

  const share = read(SHARE);
  for (const piece of [
    'fetch("/api/rooms", { cache: "no-store" })',
    'fetch(`/api/rooms/${encodeURIComponent(selected.value)}/messages`, {',
    'summaryArtifactId: artifactId',
    'privacyDecision: { action: "send_original" }',
    'requestSummaryApproval: requestApproval',
  ]) assert.ok(share.includes(piece), piece);

  /* Marsruudid annavad lehele sama omaduse nagu enne ja lingid nende lehtede juurde on alles. */
  assert.ok(read('../app/documents/[id]/page.js').includes('<DocumentDetailPage documentId={resolvedParams?.id} />'));
  assert.ok(read('../app/documents/artifacts/[id]/page.js').includes('<ArtifactDetailPage artifactId={resolvedParams?.id} />'));
  assert.ok(read('../lib/search/personalSearch.js').includes('href: `/documents/${encodeURIComponent(row.id)}`'), 'isiklik otsing viib faili lehele');
  assert.ok(read('../components/documents/workspace/documentRows.js').includes('open: localizePath(`/documents/artifacts/${id}`, locale)'), 'loend viib koostatud teksti lehele');
});

test('vahelehe nimi tuleb kataloogist; marsruudi mustrit ega kõvakodeeritud eestikeelset nime ei ole', () => {
  for (const [path, key] of [['../app/documents/[id]/page.js', 'detail_title'], ['../app/documents/artifacts/[id]/page.js', 'artifact_detail_title']]) {
    const source = read(path);
    assert.ok(source.includes(`messages?.documents?.${key}`), `${path}: nimi kataloogist`);
    assert.ok(source.includes('pathname: "/documents"') && !source.includes('[id]",'), `${path}: aadress on dokumentide lehe oma`);
    assert.ok(!source.includes('Agendi tulemus') && !source.includes('documents?.meta'), `${path}: varuteksti ega olematut rühma ei ole`);
    for (const lang of LANGS) assert.equal(typeof catalog(lang).documents[key], 'string', `${lang}: ${key}`);
  }
});

test('lehed on dokumentide lehe klotsidega sammulaval ja ei kasuta enam vana ühist kihti', () => {
  const artifactPage = read(ARTIFACT_PAGE);
  const documentPage = read(DOCUMENT_PAGE);
  const views = read(VIEWS);
  for (const page of [artifactPage, documentPage]) {
    assert.ok(page.split(/\r?\n/).some((line) => line.trim() === 'parts'), 'leht annab lavale `parts`');
    assert.ok(!page.includes('startWide'), 'leht avaneb sisul, mitte kõigi osade vaates');
    assert.ok(page.includes('headerClassName="sr-only"'), 'lehe nimi on kiirmenüüs, pealkiri ekraanilugejale');
    assert.ok(page.includes('import { ItemView } from "./workspace/DocumentsViews"'), 'andmete vaade on dokumentide lehe avatud dokument');
    assert.ok(page.includes('className={styles.page} data-dock-scroll-behavior="recede"'), 'lehe kuju on dokumentide lehe oma');
  }
  /* Koostatud teksti leht avaneb tekstil; faili leht ilma tekstita on üks vaade ilma lavata. */
  assert.equal(artifactPartKeys({ draft: true })[0], 'text');
  assert.equal(artifactPartKeys()[0], 'text');
  assert.ok(documentPage.includes('if (partKeys.length === 1) return <div className={styles.flat}>{renderSheet()}</div>;'));
  /* Pärast kinnitamist avaneb lava osal, kus on allalaadimine. */
  assert.ok(artifactPage.includes('landRef.current = "sheet"') && artifactPage.includes('initialIndex={Math.max(0, landIndex)}'));
  /* Peamine nupp joonistab oma helgi eraldi pinnale: vaade annab talle teada, kas ta on ees. */
  assert.ok(artifactPage.includes('const glow = flight?.isActive !== false') && artifactPage.split('glow={glow}').length - 1 === 3, 'tekst, kinnitamine ja jagamine');

  for (const source of SOURCES.map(read)) {
    assert.ok(!source.includes('role="status"'), 'teated ei kasuta status-rolli (ühine kiht joonistab selle kastina)');
    assert.ok(!source.includes('feature-page') && !source.includes('feature-notice') && !source.includes('ui/Panel"'), 'vana pinda ega pesastatud paneele ei ole');
    assert.ok(!/artifact-detail|document-detail/.test(source), 'vanu klasse ei ole');
    assert.ok(!source.includes('DocumentsDropdown') && !source.includes('ui/Checkbox"'), 'valikud on lahtrid ja märkekaart');
  }
  /* Vaate nime ei korrata nähtava esimese reana: tekstiväli ja ruumi valik kannavad silti ainult ekraanilugejale. */
  assert.ok(views.includes('<label className="sr-only" htmlFor={areaId}>'), 'teksti välja silt');
  assert.ok(views.includes('<ChoiceRow label={roomLabel} labelHidden'), 'ruumi valiku silt');
  for (const name of ['text', 'approve', 'share', 'sources']) {
    assert.ok(!new RegExp(`question=\\{t\\("documents\\.detail\\.views\\.${name}\\.title"\\)\\}`).test(views), `${name}: vaate nimi ei ole paneelil nähtav küsimus`);
  }
  /* Pikk tekst kerib kogu paneeli: väli kasvab sisu kõrguseks ega keri ise. */
  assert.ok(views.includes('useGrowingField(areaId, content)') && views.includes('area.style.height = `${area.scrollHeight + area.offsetHeight - area.clientHeight}px`'));
  const css = read(STYLES);
  assert.match(css, /\.area\s*\{[^}]*overflow:\s*hidden[^}]*resize:\s*none/);
  assert.ok(artifactPage.includes('free: key === "text" || key === "sources"') && documentPage.includes('free: key === "text"'));

  /* Vanad üldreeglid on eemaldatud koos lehtedega, mis neid kasutasid. */
  const featureCss = read('../app/styles/feature-pages.css');
  assert.ok(!/artifact-detail|document-detail|feature-page--artifact|feature-notice/.test(featureCss));
  /* Kujundus on mooduli klassidega: paljaste siltide peale reegleid ei kirjutata. */
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of rules.matchAll(/(^|\})\s*([^{}@]+)\{/g)) {
    for (const selector of match[2].split(',')) {
      assert.ok(!/(^|[\s>+~])(p|h[1-6]|ul|li|dl|dt|dd|section|div|span|label|input|textarea|button|form|a)(?![\w-])/.test(selector.trim().replace(/:global\([^)]*\)/g, '')), `paljas silt valijas: ${selector.trim()}`);
    }
  }
});

test('iga klass, mida vaated ja lehed kasutavad, on kujundusfailis olemas; laenatud tükid on eksporditud', () => {
  const classes = (path) => new Set([...read(path).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => match[1]));
  const own = classes(STYLES);
  const shared = classes('../components/documents/workspace/documents.module.css');
  /* Vaadetes on `styles` detaililehe oma fail ja `shared` dokumentide lehe fail; lehed kasutavad ainult dokumentide lehe faili. */
  const used = (path) => [...read(path).matchAll(/\b(shared|styles)\.([a-zA-Z]\w*)/g)].map((match) => [match[1], match[2]]);
  const viewUses = used(VIEWS);
  assert.ok(viewUses.length > 30, `vaadetes leiti ${viewUses.length} klassi kasutust`);
  for (const [space, name] of viewUses) assert.ok((space === 'shared' ? shared : own).has(name), `${space}.${name}`);
  for (const page of [ARTIFACT_PAGE, DOCUMENT_PAGE]) {
    assert.ok(read(page).includes('import styles from "./workspace/documents.module.css"'), page);
    for (const [, name] of used(page)) assert.ok(shared.has(name), `${page}: ${name}`);
  }
  /* Mooduli fail ei laena teisest failist `composes`-iga: laenatud klass pannakse märgistuses kõrvale. */
  assert.ok(!read(STYLES).replace(/\/\*[\s\S]*?\*\//g, '').includes('composes'));
  const documentsViews = read('../components/documents/workspace/DocumentsViews.jsx');
  for (const name of ['Chip', 'ActionButtons', 'ItemView']) assert.ok(documentsViews.includes(`export function ${name}(`), `${name} on eksporditud`);
  assert.ok(read(VIEWS).includes('import { ActionButtons, Chip } from "../workspace/DocumentsViews";'));
});
