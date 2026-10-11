// Kinnitatud teksti failid (Word ja PDF): sildid ja teksti liigi nimi on kinnitaja lehe
// keeles ja tulevad kataloogist; PDF-i pakutakse ainult siis, kui see on olemas.
//
// Vead, mis kinnitati brauseris 10.10: Wordi fail kandis ingliskeelseid silte ja sisemist
// liigi koodi („Type: MEETING SUMMARY”, „Content”, „Sources”), PDF-is oli „Tüüp: Meeting
// Summary”, kohatäitja {{ARTIFACT_TYPE}} andis „LETTER DRAFT” ja PDF-i linki pakuti ka siis,
// kui PDF-i ei tehtud.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createChatDocxBuffer, isPdfTextSupported } from '../lib/chat/exportDocument.js';
import { artifactHasPdf, templateShapesFile } from '../lib/documents/artifactFiles.js';
import { AGENT_ARTIFACT_TYPE_VALUES, DOCX_MIME_TYPE } from '../lib/documents/constants.js';
import { createArtifactDocxBuffer, createSimpleDocxBuffer, readBoundedDocxZipEntries } from '../lib/documents/docxExport.js';
import { EXPORT_DEFAULT_LOCALE, artifactExportLabels, artifactTypeName, exportLabelTexts } from '../lib/documents/exportLabels.js';
import { artifactPdfLabels, canCreateArtifactPdf, createArtifactPdfBuffer } from '../lib/documents/pdfExport.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const LANGS = ['et', 'en', 'ru'];
const LABEL_KEYS = { type: 'type', approved: 'approved', content: 'content', sources: 'sources', noSources: 'no_sources', emptyContent: 'empty_content', untitledSource: 'untitled_source' };

/* Wordi faili nähtav tekst lõikude kaupa. */
function docxLines(buffer) {
  const xml = readBoundedDocxZipEntries(buffer).find((entry) => entry.name === 'word/document.xml').data.toString('utf8');
  return [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((match) => match[1]);
}
function docxDescription(buffer) {
  const xml = readBoundedDocxZipEntries(buffer).find((entry) => entry.name === 'docProps/core.xml').data.toString('utf8');
  return xml.match(/<dc:description>([^<]*)<\/dc:description>/)[1];
}

const SUMMARY = { id: 'a1', type: 'MEETING_SUMMARY', title: 'Kohtumine 9. oktoobril', content: 'Esimene lõik.\n\nTeine lõik.', approvedAt: new Date('2026-10-10T09:00:00Z') };
const looksCode = (text) => /^[A-Z][A-Z_ ]{3,}$/.test(text) || /^[a-z]+(_[a-z]+)+$/.test(text) || /^[a-z_]+(\.[a-z_]+)+$/.test(text);

test('sildid tulevad kataloogist kolmes keeles ja liigi nimi on sõna, mitte kood', () => {
  for (const lang of LANGS) {
    const labels = artifactExportLabels(lang);
    const words = catalog(lang).documents;
    assert.equal(labels.locale, lang);
    for (const [name, key] of Object.entries(LABEL_KEYS)) {
      assert.equal(labels[name], words.export[key], `${lang}: ${name}`);
      assert.ok(labels[name] && !looksCode(labels[name]), `${lang}: ${name} → „${labels[name]}”`);
    }
    for (const type of AGENT_ARTIFACT_TYPE_VALUES) {
      assert.equal(labels.typeName(type), words.artifact_types[type.toLowerCase()], `${lang}: ${type}`);
      assert.ok(!looksCode(labels.typeName(type)), `${lang}: ${type} → „${labels.typeName(type)}”`);
    }
    /* Tundmatu liik saab sõna „Muu”, mitte oma koodi. */
    for (const unknown of ['SOMETHING_NEW', '', null, undefined]) assert.equal(artifactTypeName(unknown, lang), words.artifact_types.other, `${lang}: ${unknown}`);
    assert.equal(artifactTypeName(' letter_draft ', lang), words.artifact_types.letter_draft);
    assert.equal(exportLabelTexts(labels, 'LETTER_DRAFT').length, Object.keys(LABEL_KEYS).length + 1);
  }
  /* Eesti ja vene sildid ei ole ingliskeelsete koopiad. */
  for (const key of Object.values(LABEL_KEYS).filter((name) => name !== 'untitled_source')) {
    assert.notEqual(catalog('et').documents.export[key], catalog('en').documents.export[key], `et: ${key}`);
    assert.notEqual(catalog('ru').documents.export[key], catalog('en').documents.export[key], `ru: ${key}`);
  }
  assert.ok(/[а-яё]/i.test(Object.values(catalog('ru').documents.export).join(' ')), 'vene sildid on kirillitsas');
  /* Keel, mida ei tunta või ei antud, annab sama vaikimisi keele mis serveri veateadetel. */
  assert.equal(EXPORT_DEFAULT_LOCALE, 'en');
  assert.equal(artifactExportLabels().locale, 'en');
  assert.equal(artifactExportLabels('fi').locale, 'en');
  assert.equal(artifactExportLabels('et-EE').locale, 'et');
});

test('Wordi fail kannab kinnitaja keele silte ja liigi nime sõnadega', () => {
  for (const lang of LANGS) {
    const words = catalog(lang).documents;
    const lines = docxLines(createArtifactDocxBuffer({ artifact: SUMMARY, sources: [], labels: artifactExportLabels(lang) }));
    assert.deepEqual(lines, [
      SUMMARY.title,
      `${words.export.type}: ${words.artifact_types.meeting_summary}`,
      `${words.export.approved}: 2026-10-10`,
      words.export.content,
      'Esimene lõik.',
      'Teine lõik.',
      words.export.sources,
      words.export.no_sources,
    ], lang);
    assert.ok(!lines.some((line) => /MEETING|SUMMARY/.test(line)), `${lang}: sisemist koodi ei ole`);
  }
  const et = docxLines(createArtifactDocxBuffer({ artifact: SUMMARY, sources: [], labels: artifactExportLabels('et') })).join('\n');
  for (const english of ['Type:', 'Approved:', 'Content', 'Sources', 'No source documents linked.']) assert.ok(!et.includes(english), `eestikeelses failis ei ole „${english}”`);

  /* Allikad: pealkiri ja faili nimi; pealkirjata ja nimeta allikas saab sõna, mitte „undefined”. */
  const sources = [{ title: 'Märkmed', originalName: 'markmed.txt' }, { title: '', originalName: 'otsus.pdf' }, { title: '', originalName: '' }];
  const withSources = docxLines(createArtifactDocxBuffer({ artifact: SUMMARY, sources, labels: artifactExportLabels('et') }));
  assert.deepEqual(withSources.slice(-4), ['Allikad', '- Märkmed (markmed.txt)', '- otsus.pdf (otsus.pdf)', '- Dokument']);

  /* Pealkirjata tekst kannab oma liigi nime ja faili omadustes ei ole ingliskeelset rida. */
  const untitled = createArtifactDocxBuffer({ artifact: { ...SUMMARY, title: '   ' }, sources: [], labels: artifactExportLabels('ru') });
  assert.equal(docxLines(untitled)[0], catalog('ru').documents.artifact_types.meeting_summary);
  assert.equal(docxDescription(untitled), `${catalog('ru').documents.export.approved}: 2026-10-10`);
});

test('Wordi malli kohatäitja {{ARTIFACT_TYPE}} saab liigi nime sõnadega', () => {
  const template = createSimpleDocxBuffer({
    title: 'Mall',
    blocks: [
      { kind: 'title', text: '{{TITLE}}' },
      { kind: 'paragraph', text: 'Päis · {{ARTIFACT_TYPE}} · {{APPROVED_AT}}' },
      { kind: 'paragraph', text: '{{CONTENT_BLOCK}}' },
      { kind: 'paragraph', text: '{{SOURCES_BLOCK}}' },
    ],
  });
  const letter = { ...SUMMARY, type: 'LETTER_DRAFT', title: 'Kiri vallale' };
  for (const lang of LANGS) {
    const words = catalog(lang).documents;
    const lines = docxLines(createArtifactDocxBuffer({ artifact: letter, sources: [], templateBuffer: template, labels: artifactExportLabels(lang) }));
    assert.deepEqual(lines, ['Kiri vallale', `Päis · ${words.artifact_types.letter_draft} · 2026-10-10`, 'Esimene lõik.', 'Teine lõik.', words.export.sources, words.export.no_sources], lang);
    assert.ok(!lines.join(' ').includes('LETTER'), `${lang}: sisemist koodi ei ole`);
  }
});

test('kuju annab ainult Wordi mall; PDF- ja TXT-malli kinnitamine ei loe', (t) => {
  /* Loetamatu malli korral kirjutab faili tegija serveri logisse: testi väljundisse seda ei lasta. */
  const logged = t.mock.method(console, 'error', () => {});
  assert.equal(templateShapesFile({ mime: DOCX_MIME_TYPE }), true);
  assert.equal(templateShapesFile({ mime: `${DOCX_MIME_TYPE}; charset=binary` }), true);
  for (const template of [{ mime: 'text/plain' }, { mime: 'application/pdf' }, { mime: '' }, {}, null]) assert.equal(templateShapesFile(template), false, JSON.stringify(template));
  const finalization = read('../lib/documents/artifactFinalization.js');
  assert.ok(finalization.includes('artifact.template?.storagePath && templateShapesFile(artifact.template)'), 'malli loetakse ainult siis, kui see on Wordi fail');
  assert.ok(/template: \{\s*select: \{[^}]*\bmime: true,/s.test(finalization), 'kinnitamine laadib malli tüübi');
  /* Kui mall siiski ei ole loetav Wordi fail, tehakse tavaline fail, mitte ei katkestata. */
  const fallback = docxLines(createArtifactDocxBuffer({ artifact: SUMMARY, sources: [], templateBuffer: Buffer.from('lihtsalt tekst'), labels: artifactExportLabels('et') }));
  assert.equal(fallback[1], 'Tüüp: Kohtumise kokkuvõte');
  assert.equal(logged.mock.callCount(), 1, 'loetamatu mall jätab serveri logisse jälje');
});

test('PDF kannab kinnitaja keele silte, kui PDF neid joonistada suudab', () => {
  /* Eesti ja inglise sildid ning iga liigi nimi on PDF-i kirjatüübis olemas. */
  for (const lang of ['et', 'en']) {
    for (const type of AGENT_ARTIFACT_TYPE_VALUES) {
      const labels = artifactPdfLabels(lang, type);
      assert.equal(labels.locale, lang, `${lang}: ${type}`);
      assert.ok(isPdfTextSupported(exportLabelTexts(labels, type).join('\n')), `${lang}: ${type}`);
    }
  }
  /* Vene silte PDF joonistada ei saa (kirillitsa vajab kirjatüübi faili): PDF kannab
     eestikeelseid silte, nagu enne, et ladina tähtedega tekstist PDF ikka tehtaks. */
  assert.equal(artifactPdfLabels('ru', 'MEETING_SUMMARY').locale, 'et');
  assert.equal(artifactPdfLabels(undefined, 'MEETING_SUMMARY').locale, 'en');

  for (const lang of LANGS) {
    const labels = artifactPdfLabels(lang, SUMMARY.type);
    assert.equal(canCreateArtifactPdf({ artifact: SUMMARY, sources: [], labels }), true, lang);
    /* PDF-i tekst on failis lugemiskujul: iga rida omaette sulgudes. */
    const pdf = createArtifactPdfBuffer({ artifact: SUMMARY, sources: [], labels }).toString('latin1');
    const words = catalog(labels.locale).documents;
    assert.ok(pdf.startsWith('%PDF-'), lang);
    for (const line of [
      `(${words.export.type}: ${words.artifact_types.meeting_summary})`,
      `(${words.export.approved}: 2026-10-10)`,
      `(${words.export.content}:)`,
      `(${words.export.sources}:)`,
      `(- ${words.export.no_sources})`,
    ]) assert.ok(pdf.includes(line), `${lang}: ${line}`);
    assert.ok(!/Meeting Summary|MEETING_SUMMARY|Allikdokumendid/.test(pdf), `${lang}: koodist tehtud liigi nime ega vana silti ei ole`);
  }
  /* Teksti, milles on märke, mida PDF ei toeta, PDF-i ei tehta (siltide keelest sõltumata). */
  for (const lang of LANGS) {
    assert.equal(canCreateArtifactPdf({ artifact: { ...SUMMARY, content: 'Привет' }, sources: [], labels: artifactPdfLabels(lang, SUMMARY.type) }), false, lang);
    assert.equal(canCreateArtifactPdf({ artifact: SUMMARY, sources: [{ title: 'Заметки', originalName: 'z.txt' }], labels: artifactPdfLabels(lang, SUMMARY.type) }), false, lang);
  }
  /* PDF-i lähtetekstis ei ole enam sisse kirjutatud silte ega koodist tehtud liigi nime. */
  const source = read('../lib/documents/pdfExport.js');
  for (const old of ['"Allikdokumendid:', 'Tüüp: ${', 'Kinnitatud: ${', '"Sisu:"', '"(empty)"', 'formatArtifactType']) assert.ok(!source.includes(old), old);
  const docx = read('../lib/documents/docxExport.js');
  for (const old of ['"Sources"', '"Content"', '`Type: ${', '`Approved: ${', '"No source documents linked."', 'replace(/_/g, " ")']) assert.ok(!docx.includes(old), old);
});

test('kinnitamine teeb failid kinnitaja lehe keeles ja jätab keele kirja', () => {
  const finalization = read('../lib/documents/artifactFinalization.js');
  assert.ok(finalization.includes('const labels = artifactExportLabels(locale)') && finalization.includes('const pdfLabels = artifactPdfLabels(locale, artifact.type)'));
  assert.ok(finalization.includes('createArtifactDocxBuffer({ artifact, sources, templateBuffer, labels })'));
  assert.ok(finalization.includes('canCreateArtifactPdf({ artifact, sources, labels: pdfLabels })') && finalization.includes('createArtifactPdfBuffer({ artifact, sources, labels: pdfLabels })'));
  assert.ok(finalization.includes('manifest: buildManifest(artifact, sources, rendered, labels.locale),'), 'kinnitamise kirje ütleb, mis keeles sildid on');
  /* Marsruut annab edasi lehe keele (päis `x-ui-locale`, vt lib/documents/server.js). */
  const route = read('../app/api/documents/artifacts/[id]/approve/route.js');
  assert.ok(route.includes('const locale = localeFromRequest(request)') && /content: nextContent,\s*(?:\/\*[^*]*\*\/\s*)?locale,/.test(route));
});

test('vestluse vastuse Wordi fail jääb nii, nagu see oli', () => {
  const lines = docxLines(createChatDocxBuffer('Vastuse tekst.', 'Sotsiaal.pro summary'));
  assert.deepEqual(lines, ['Sotsiaal.pro summary', 'Type: CHAT EXPORT', 'Content', 'Vastuse tekst.', 'Sources', 'No source documents linked.']);
});

test('PDF-i link on ainult siis, kui PDF tehti', () => {
  /* Loend laadib kinnitamise failide kirjest ainult PDF-i suuruse. */
  assert.equal(artifactHasPdf({ finalSnapshot: { pdfSize: 812 } }), true);
  assert.equal(artifactHasPdf({ finalSnapshot: { pdfSize: 0 } }), false);
  assert.equal(artifactHasPdf({ finalSnapshot: { pdfSize: null } }), false);
  /* Teksti enda marsruudid laadivad terve kirje. */
  assert.equal(artifactHasPdf({ finalSnapshot: { pdfSize: 0, pdfSha256: null, manifest: { rendered: { docx: { size: 9 }, pdf: null } } } }), false);
  assert.equal(artifactHasPdf({ finalSnapshot: { pdfSha256: 'abc', manifest: { rendered: { pdf: { size: 812 } } } } }), true);
  assert.equal(artifactHasPdf({ finalSnapshot: { manifest: { rendered: { pdf: { size: 812 } } } } }), true);
  /* Kirjet ei ole või seda ei laaditud: linki ei pakuta failile, mille olemasolu ei ole teada. */
  for (const artifact of [{ finalSnapshot: null }, {}, null, undefined, { finalSnapshot: 'x' }]) assert.equal(artifactHasPdf(artifact), false);

  const artifacts = read('../lib/documents/artifacts.js');
  assert.ok(artifacts.includes('...(artifactHasPdf(artifact)'), 'serveri linkide loend kasutab reeglit');
  assert.ok(artifacts.includes('ARTIFACT_DOWNLOAD_FORMATS.filter((format) => downloads.some((entry) => entry.format === format))'), 'vormingute loend ei luba PDF-i, mida ei ole');
  /* Iga koht, mis teksti vastuseks seab, laadib kirje (terve või ainult PDF-i suuruse): muidu
     kaoks PDF-i link ka tekstidelt, millel PDF on. */
  for (const path of ['../app/api/documents/artifacts/route.js', '../app/api/documents/[id]/summary/route.js', '../lib/documents/persistDraft.js']) {
    assert.ok(read(path).includes('finalSnapshot: { select: { pdfSize: true } },'), path);
  }
  for (const path of ['../app/api/documents/artifacts/[id]/route.js', '../lib/documents/artifactMutation.js', '../lib/documents/artifactFinalization.js']) {
    assert.ok(/finalSnapshot: true,?\n/.test(read(path)), path);
  }
  /* Kinnitamise vastuse lingid tulevad samast kohast, mitte ei ole marsruudis eraldi kirjas. */
  const approve = read('../app/api/documents/artifacts/[id]/approve/route.js');
  assert.ok(approve.includes('downloadUrls: serialized.downloadUrls,') && !approve.includes('buildArtifactDownloadUrl'));
  /* Allalaadimine vastab PDF-i puudumisel endiselt selge veaga. */
  assert.ok(read('../lib/documents/artifactFinalization.js').includes('if (!bytes) throw createArtifactError("api.exports.pdf_content_not_supported", 409)'));
});
