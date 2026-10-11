// Koostamisruum „Koosta dokument”: vaadete tekstid on kataloogis, reeglid teevad, mida lubavad,
// ja leht hoiab seda, mida silm kergesti ei märka.
//
// Ruum oli üks 2600-realine komponent vanal ühisel kihil; nüüd on see vaadetena sammulaval
// (components/agent/drafting). Reeglid on failis draftingModel.js ilma JSX-ita, et neid saaks siin
// päriselt välja kutsuda. Tasuliste päringute kuju (aadress, keha, kavatsuse võti) kontrollitakse
// lähteteksti järgi: neid ei tohtinud ümbertegemine muuta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  AUDIENCE_OPTIONS, AUDIO_SOURCE_LIST_LIMIT, AUDIO_VIEWS, AUDIO_WAYS, CLIENT_AGENT_TASK_OPTIONS, CLIENT_MAX_DOCUMENTS, COMPOSE_VIEWS_CLIENT, COMPOSE_VIEWS_WORKER,
  COMPOSE_PAUSED, CONFIRM_KINDS, FREE_VIEWS, LANGUAGE_OPTIONS, LENGTH_OPTIONS, PRESS_GAP_MS, PRIVACY_ACTIONS, PRIVACY_CHOICE_KEYS, PRIVACY_WORKFLOW, RECENT_RESULTS_LIMIT, TEMPLATE_NOTE_KEYS, TONE_OPTIONS, VERSION_KINDS, VIEW_TEXT_KEYS,
  activeViewFor, audioFileProblem, audioSourceRows, clientStatusLabel, clientTaskArtifactType, composeBlocker, confirmPress, confirmTexts, errorWayFor, formatDuration, hasUnsavedText,
  instructionLimit, isComposableType, isTemplateCompatible, isVersionActive, outputTypeOptions, pressAllowed, privacyChoiceKey, privacyChoices, privacyTextKeys, recentResultRows, recordingPurposeLabel, refineBlocker,
  resultSheet, resultStateOf, serverMessage, snippet, sourceRows, statusLabel, summaryBlocker, templateChoiceUnsaved, templateNoteKind, templateOptions, templatePlaceholderList, templateStatus,
  textAtRisk, transcribeBlocker, transcriptEdited, typeLabel, versionRestoredKey, versionRows, viewKeysFor, viewStates,
} from '../components/agent/drafting/draftingModel.js';
import { clientTaskInstruction } from '../lib/documents/agentTasks.js';
import { AGENT_ARTIFACT_STATUS_VALUES, AGENT_ARTIFACT_TYPE_VALUES, DOCUMENT_KIND_VALUES, DOCX_MIME_TYPE, DOCX_TEMPLATE_PLACEHOLDERS, TEMPLATE_FOR_VALUES } from '../lib/documents/constants.js';

/* Reavahetused ühtlustatakse: Windowsi tööpuus on failid CRLF-iga, mujal LF-iga. */
const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const LANGS = ['et', 'en', 'ru'];
const PAGE = '../components/agent/AgentModePage.jsx';
const MODEL = '../components/agent/drafting/draftingModel.js';
const AUDIO_HOOK = '../components/agent/drafting/useAudioPath.js';
const FILES_HOOK = '../components/agent/drafting/useSourceFiles.js';
const GUARDS_HOOK = '../components/agent/drafting/usePressGuards.js';
const AUDIO_PATH = '../components/agent/drafting/AudioPath.jsx';
const BITS = '../components/agent/drafting/DraftingBits.jsx';
const VIEWS = ['../components/agent/drafting/ComposeViews.jsx', '../components/agent/drafting/ResultViews.jsx', '../components/agent/drafting/AudioViews.jsx', BITS];
const STYLES = '../components/agent/drafting/drafting.module.css';
const SOURCES = [PAGE, MODEL, AUDIO_HOOK, FILES_HOOK, GUARDS_HOOK, AUDIO_PATH, ...VIEWS];
const count = (text, part) => text.split(part).length - 1;

/* Sama reegel mis lehe `t`-l: puuduv võti annab varuteksti või võtme enda. Nii paistab testis
   välja iga koht, kus ekraanile jõuaks võti või toores väärtus. */
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

test('vaadete ja reeglite tekstivõtmed on kataloogis kolmes keeles', () => {
  const keys = new Set();
  for (const source of SOURCES) {
    /* Iga sõnega kirjutatud võti: nii `t("…")` kutsed kui ka võtmed, mida hoitakse tabelis
       (valikute sildid, teise vajutuse sõnad). Mallisõnega kokku pandud võtmed kontrollivad
       järgmised testid. */
    for (const match of read(source).matchAll(/"((?:documents|common|chat|privacy_guard|calls)\.[a-zA-Z0-9_.]+)"/g)) keys.add(match[1]);
  }
  assert.ok(keys.size > 200, `võtmeid leiti ${keys.size}`);
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual([...keys].filter((key) => typeof at(messages, key) !== 'string'), [], lang);
  }
});

test('igal vaatel on nimi ja lühinimi kiirmenüü jaoks', () => {
  const page = read(PAGE);
  assert.ok(page.includes('`documents.drafting.views.${key}.title`') && page.includes('`documents.drafting.views.${key}.short`'), 'leht võtab vaate nime kataloogist');
  /* Iga vaade, mille leht lavale annab, on nimega vaadete hulgas. */
  for (const client of [false, true]) {
    for (const level of ['compose', 'audio']) {
      for (const resultState of ['none', 'loading', 'failed', 'draft', 'final']) {
        for (const key of viewKeysFor({ client, level, resultState })) assert.ok(VIEW_TEXT_KEYS.includes(key), `vaatel ${key} on tekstid`);
      }
    }
  }
  for (const lang of LANGS) {
    const views = catalog(lang).documents.drafting.views;
    assert.deepEqual(Object.keys(views).sort(), [...VIEW_TEXT_KEYS].sort(), `${lang}: kataloogis on täpselt lehe vaated`);
    for (const key of VIEW_TEXT_KEYS) {
      assert.ok(views[key]?.title && views[key]?.short, `${lang}: ${key}`);
      assert.ok(views[key].short.length <= 18, `${lang}: ${key} lühinimi mahub kiirmenüüsse`);
    }
  }
  for (const key of FREE_VIEWS) assert.ok(VIEW_TEXT_KEYS.includes(key), `pikk vaade ${key} on olemas`);
});

test('millised vaated on ees: roll, jada ja tulemuse seis', () => {
  const worker = (resultState, level = 'compose') => viewKeysFor({ resultState, level });
  const client = (resultState, level = 'compose') => viewKeysFor({ client: true, resultState, level });

  assert.deepEqual(worker('none'), ['sources', 'type', 'template', 'style', 'instruction']);
  assert.deepEqual(worker('none'), [...COMPOSE_VIEWS_WORKER]);
  /* Tulemust avatakse või avamine ei õnnestunud: ees on ainult tekstivaade, mis seda ütleb. */
  assert.deepEqual(worker('loading').slice(5), ['text']);
  assert.deepEqual(worker('failed').slice(5), ['text']);
  /* Muudetav mustand: tekst, täiendamine, versioonid, kinnitamine. */
  assert.deepEqual(worker('draft').slice(5), ['text', 'refine', 'versions', 'approve']);
  /* Kinnitatud teksti ei täiendata ega taastata: jäävad lugemine ja allalaadimine. */
  assert.deepEqual(worker('final').slice(5), ['text', 'approve']);

  /* Pöörduja lühem tee: ülesanne, failid, juhis; versioone ei ole; lõpus tema tulemused. */
  assert.deepEqual(client('none'), ['task', 'files', 'instruction', 'results']);
  assert.deepEqual(client('none').slice(0, 3), [...COMPOSE_VIEWS_CLIENT]);
  assert.deepEqual(client('draft'), ['task', 'files', 'instruction', 'text', 'refine', 'finish', 'results']);
  assert.deepEqual(client('final'), ['task', 'files', 'instruction', 'text', 'finish', 'results']);

  /* Heli rada on ainult spetsialistil ja selle vaated ei sõltu millestki: lava ei ehitata
     salvestamise ajal ümber. */
  for (const resultState of ['none', 'loading', 'failed', 'draft', 'final']) assert.deepEqual(worker(resultState, 'audio'), [...AUDIO_VIEWS]);
  assert.deepEqual(AUDIO_VIEWS, ['audio', 'transcribe', 'review', 'summary']);
  assert.deepEqual(client('none', 'audio'), client('none'));

  assert.equal(resultStateOf(), 'none');
  assert.equal(resultStateOf({ loading: true, result: { status: 'DRAFT' } }), 'loading');
  assert.equal(resultStateOf({ error: 'x' }), 'failed');
  assert.equal(resultStateOf({ result: { status: 'DRAFT' } }), 'draft');
  assert.equal(resultStateOf({ result: { status: 'FINAL' } }), 'final');
});

test('kui soovitud vaadet enam ei ole, on ees mõistlik naaber', () => {
  const none = viewKeysFor();
  const final = viewKeysFor({ resultState: 'final' });
  assert.equal(activeViewFor('', none), 'sources');
  assert.equal(activeViewFor('style', none), 'style');
  /* Tulemus eemaldati: tulemuse vaatest minnakse juhise juurde. */
  assert.equal(activeViewFor('text', none), 'instruction');
  assert.equal(activeViewFor('versions', none), 'instruction');
  /* Mustand kinnitati: täiendamise vaade kadus, ees on tekst. */
  assert.equal(activeViewFor('refine', final), 'text');
  assert.equal(activeViewFor('approve', final), 'approve');
  /* Heli rajal ei ole tulemuse vaateid. */
  assert.equal(activeViewFor('text', [...AUDIO_VIEWS]), 'audio');
  assert.equal(activeViewFor('sources', viewKeysFor({ client: true })), 'task');
});

test('võtmed, mis pannakse kokku väärtusest, on iga võimaliku väärtuse jaoks kolmes keeles olemas', () => {
  /* Kõnesalvestise eesmärgid tulevad andmebaasi skeemist: uus väärtus seal peab tooma sõna siia. */
  const schema = read('../prisma/schema.prisma');
  const purposes = schema.slice(schema.indexOf('enum CallRecordingPurpose {')).split('}')[0].split('\n').slice(1).map((line) => line.trim()).filter(Boolean);
  assert.ok(purposes.length >= 7 && purposes.includes('OTHER'), `eesmärke leiti ${purposes.length}`);
  for (const lang of LANGS) {
    const t = translator(lang);
    const messages = catalog(lang);
    for (const type of AGENT_ARTIFACT_TYPE_VALUES) assert.equal(typeof at(messages, `documents.artifact_types.${type.toLowerCase()}`), 'string', `${lang}: tüüp ${type}`);
    for (const status of AGENT_ARTIFACT_STATUS_VALUES) assert.equal(typeof at(messages, `documents.status.${status.toLowerCase()}`), 'string', `${lang}: olek ${status}`);
    for (const value of TEMPLATE_FOR_VALUES) assert.equal(typeof at(messages, `documents.template_for.${value.toLowerCase()}`), 'string', `${lang}: malli otstarve ${value}`);
    for (const purpose of purposes) {
      const label = recordingPurposeLabel({ purpose }, t);
      assert.ok(label && !looksRaw(label), `${lang}: eesmärk ${purpose} → „${label}”`);
      assert.equal(label, at(messages, `calls.recording_purpose_${purpose.toLowerCase()}`), `${lang}: eesmärgil ${purpose} on oma sõna`);
    }
    for (const kind of DOCUMENT_KIND_VALUES) {
      const [row] = sourceRows([{ id: 'x', title: 'Fail', kind }], { t, locale: lang });
      for (const chip of row.chips) assert.ok(chip && !looksRaw(chip), `${lang}: liik ${kind} → „${chip}”`);
    }
    for (const [kind, key] of Object.entries(VERSION_KINDS)) assert.equal(typeof at(messages, key), 'string', `${lang}: versiooni liik ${kind}`);
    for (const list of [AUDIENCE_OPTIONS, TONE_OPTIONS, LANGUAGE_OPTIONS, LENGTH_OPTIONS, AUDIO_WAYS, CLIENT_AGENT_TASK_OPTIONS]) {
      for (const option of list) assert.equal(typeof at(messages, option.labelKey), 'string', `${lang}: valik ${option.value}`);
    }
    for (const key of Object.values(PRIVACY_CHOICE_KEYS)) assert.equal(typeof at(messages, key), 'string', `${lang}: ${key}`);
    /* Tasulise töö käivitav valik kannab töö nime, mitte vestluse sõna „saada". */
    for (const action of PRIVACY_ACTIONS) {
      for (const choice of ['retry', 'edit', 'redacted', 'original']) assert.equal(typeof at(messages, privacyChoiceKey(action, choice)), 'string', `${lang}: ${action} ${choice}`);
      for (const unavailable of [false, true]) {
        const words = privacyTextKeys(action, unavailable);
        assert.equal(typeof at(messages, words.title), 'string', `${lang}: ${words.title}`);
        assert.equal(typeof at(messages, words.text), 'string', `${lang}: ${words.text}`);
      }
      assert.notEqual(at(messages, privacyChoiceKey(action, 'redacted')), at(messages, PRIVACY_CHOICE_KEYS.redacted), `${lang}: ${action} ei kasuta vestluse sõna`);
    }
    assert.equal(typeof at(messages, 'documents.drafting.privacy.not_started'), 'string');
    for (const [kind, texts] of Object.entries(CONFIRM_KINDS)) {
      assert.equal(typeof at(messages, texts.note), 'string', `${lang}: teise vajutuse selgitus ${kind}`);
      if (texts.label) assert.equal(typeof at(messages, texts.label), 'string', `${lang}: teise vajutuse nupp ${kind}`);
    }
    /* Arvuga laused kannavad oma kohatäitjat. */
    const drafting = messages.documents.drafting;
    for (const text of [drafting.files.lead, drafting.files.lead_form, drafting.files.limit, drafting.versions.lead, drafting.results.lead, drafting.audio.existing_help, drafting.sources.missing]) {
      assert.ok(text.includes('{count}'), `${lang}: „${text}”`);
    }
  }
});

test('eesti tekstides ei ole mõttekriipse ega sirgeid jutumärke', () => {
  const walk = (node, path = 'documents.drafting') => Object.entries(node).flatMap(([key, value]) => (typeof value === 'string' ? [[`${path}.${key}`, value]] : walk(value, `${path}.${key}`)));
  for (const [key, text] of walk(catalog('et').documents.drafting)) {
    assert.ok(!/[—–]/.test(text), `${key}: mõttekriips`);
    assert.ok(!/["“]/.test(text), `${key}: jutumärgid on „ ”`);
  }
});

test('väljundi tüübid ja mallid: kokkuvõtte tüüp sünnib ainult heli rajal', () => {
  const t = translator('et');
  const options = outputTypeOptions(t);
  assert.equal(options.length, AGENT_ARTIFACT_TYPE_VALUES.length - 1);
  assert.ok(!options.some((option) => option.value === 'TRANSCRIPT_SUMMARY'));
  for (const option of options) assert.ok(option.label && !looksRaw(option.label), option.value);
  assert.equal(isComposableType('REPORT_DRAFT'), true);
  assert.equal(isComposableType('TRANSCRIPT_SUMMARY'), false);
  assert.equal(isComposableType('MIDAGI_UUT'), false);
  /* Tundmatu tüüp ja olek saavad sõna, mitte koodi. */
  assert.equal(typeLabel('MIDAGI_UUT', t), catalog('et').documents.artifact_types.other);
  assert.equal(statusLabel('DRAFT', t), catalog('et').documents.status.draft);
  assert.equal(statusLabel('MIDAGI', t), catalog('et').documents.status.final);
  assert.equal(clientStatusLabel('FINAL', t), catalog('et').documents.drafting.results.status_final);
  assert.equal(clientStatusLabel('MIDAGI', t), catalog('et').documents.drafting.results.status_draft);

  assert.equal(isTemplateCompatible({ templateFor: 'REPORT_DRAFT' }, 'REPORT_DRAFT'), true);
  assert.equal(isTemplateCompatible({ templateFor: 'REPORT_DRAFT' }, 'LETTER_DRAFT'), false);
  assert.equal(isTemplateCompatible({ templateFor: 'OTHER' }, 'LETTER_DRAFT'), true);
  assert.equal(isTemplateCompatible({}, 'LETTER_DRAFT'), true);
  const templates = templateOptions([{ id: 't1', title: 'Aruande mall', templateFor: 'REPORT_DRAFT' }, { id: 't2', title: '', originalName: 'mall.docx', templateFor: 'MIDAGI_UUT' }], t);
  assert.deepEqual(templates.map((option) => option.value), ['', 't1', 't2']);
  assert.equal(templates[0].label, catalog('et').documents.drafting.template.none);
  assert.equal(templates[1].label, 'Aruande mall · Aruanne');
  /* Tundmatu otstarve jääb ära, mitte ei kuva võtit. */
  assert.equal(templates[2].label, 'mall.docx');
});

test('pöörduja ülesanded: väljundi tüüp serverile ja juhise piir koos ülesande kirjeldusega', () => {
  assert.equal(CLIENT_MAX_DOCUMENTS, 2);
  assert.deepEqual(CLIENT_AGENT_TASK_OPTIONS.map((option) => [option.value, option.artifactType]), [['LETTER_REQUEST', 'LETTER_DRAFT'], ['LETTER_REPLY', 'LETTER_DRAFT'], ['FILL_FORM', 'OTHER']]);
  assert.equal(clientTaskArtifactType('FILL_FORM'), 'OTHER');
  assert.equal(clientTaskArtifactType('MIDAGI'), 'LETTER_DRAFT');
  /* Server lubab 4000 märki; pöörduja juhise ette lisatakse ülesande kirjeldus ja kaks reavahetust. */
  assert.equal(instructionLimit(), 4000);
  for (const option of CLIENT_AGENT_TASK_OPTIONS) {
    const limit = instructionLimit({ client: true, task: option.value });
    assert.equal(`${clientTaskInstruction(option.value)}\n\n${'x'.repeat(limit)}`.length, 4000, option.value);
  }
});

test('mis takistab koostamist ja täiendamist', () => {
  const ready = { documentCount: 1, type: 'REPORT_DRAFT', instruction: 'Koosta aruanne' };
  assert.equal(composeBlocker(ready), '');
  assert.equal(composeBlocker({ ...ready, busy: true }), 'busy');
  assert.equal(composeBlocker({ ...ready, documentCount: 0 }), 'documents');
  assert.equal(composeBlocker({ ...ready, instruction: '   ' }), 'instruction');
  assert.equal(composeBlocker({ ...ready, instruction: 'x'.repeat(11), limit: 10 }), 'too_long');
  /* Heli raja kokkuvõtte tüübiga uut teksti siit ei koostata: enne tuleb valida väljund. */
  assert.equal(composeBlocker({ ...ready, type: 'TRANSCRIPT_SUMMARY' }), 'type');
  /* Pöörduja tüüp tuleb ülesandest, mitte väljundi valikust. */
  assert.equal(composeBlocker({ ...ready, client: true, type: 'TRANSCRIPT_SUMMARY' }), '');

  const draft = { resultState: 'draft', documentCount: 1, content: 'Tekst', instruction: 'Lühemaks' };
  assert.equal(refineBlocker(draft), '');
  assert.equal(refineBlocker({ ...draft, busy: true }), 'busy');
  assert.equal(refineBlocker({ ...draft, resultState: 'final' }), 'no_draft');
  assert.equal(refineBlocker({ ...draft, documentCount: 0 }), 'documents');
  assert.equal(refineBlocker({ ...draft, content: '  ' }), 'empty_text');
  assert.equal(refineBlocker({ ...draft, instruction: '' }), 'instruction');
  assert.equal(refineBlocker({ ...draft, instruction: 'x'.repeat(4001) }), 'too_long');
});

test('heli rada: transkripti ei koostata teist korda ja kokkuvõte tehakse ainult tervest tekstist', () => {
  assert.equal(transcribeBlocker({ sourceId: 's1' }), '');
  assert.equal(transcribeBlocker({}), 'source');
  assert.equal(transcribeBlocker({ sourceId: 's1', hasTranscript: true }), 'exists');
  assert.equal(transcribeBlocker({ sourceId: 's1', busy: true }), 'busy');

  assert.equal(summaryBlocker({ transcriptId: 't1', loaded: true, draft: 'Tere' }), '');
  /* Loendi rida kannab ainult teksti algust: avamata transkriptist kokkuvõtet ei tehta. */
  assert.equal(summaryBlocker({ transcriptId: 't1', loaded: false, draft: 'Tere' }), 'transcript');
  assert.equal(summaryBlocker({ loaded: true, draft: 'Tere' }), 'transcript');
  assert.equal(summaryBlocker({ transcriptId: 't1', loaded: true, draft: '  ' }), 'empty_text');
  assert.equal(summaryBlocker({ transcriptId: 't1', loaded: true, draft: 'Tere', busy: true }), 'busy');

  assert.equal(transcriptEdited({ id: 't1', content: 'Tere' }, 'Tere'), false);
  assert.equal(transcriptEdited({ id: 't1', content: 'Tere' }, 'Tere!'), true);
  assert.equal(transcriptEdited({ id: 't1', content: 'Tere' }, '   '), false);
  assert.equal(transcriptEdited(null, 'Tere'), false);

  assert.equal(audioFileProblem({ type: 'audio/mpeg' }), '');
  assert.equal(audioFileProblem({ type: 'video/mp4' }), '');
  assert.equal(audioFileProblem({ type: 'application/pdf' }), 'documents.errors.audio_mime_not_allowed');
  assert.equal(audioFileProblem(null), 'documents.errors.audio_mime_not_allowed');
  /* Loendi piir on sama, mis marsruudis: vaade ütleb selle arvu välja. */
  assert.ok(read('../app/api/documents/audio-sources/route.js').includes(`take: ${AUDIO_SOURCE_LIST_LIMIT}`));
  assert.ok(read(PAGE).includes(`/api/documents/artifacts?limit=${RECENT_RESULTS_LIMIT}`));
});

test('salvestamata tekst: mis loetakse muudetuks ja mis läheks taastamisel päriselt kaotsi', () => {
  const result = { id: 'a1', title: 'Aruanne', content: 'Tekst' };
  assert.equal(hasUnsavedText(null, 'x', 'y'), false);
  assert.equal(hasUnsavedText(result, 'Aruanne ', 'Tekst'), false);
  assert.equal(hasUnsavedText(result, 'Aruanne', 'Tekst!'), true);
  assert.equal(hasUnsavedText(result, 'Uus pealkiri', 'Tekst'), true);

  const versions = [{ id: 'v1', title: 'Aruanne', content: 'Tekst' }, { id: 'v2', title: 'Aruanne', content: 'Täiendatud' }];
  assert.equal(isVersionActive(versions[1], 'Aruanne', 'Täiendatud'), true);
  assert.equal(isVersionActive(versions[1], 'Aruanne', 'Tekst'), false);
  /* Salvestatud tekst ei ole ohus; versioonide vahel liikumine ka mitte. */
  assert.equal(textAtRisk({ result, title: 'Aruanne', content: 'Tekst', versions }), false);
  assert.equal(textAtRisk({ result, title: 'Aruanne', content: 'Täiendatud', versions }), false);
  /* Käsitsi kirjutatud tekst, mida ei ole üheski versioonis, läheks kaotsi. */
  assert.equal(textAtRisk({ result, title: 'Aruanne', content: 'Minu tekst', versions }), true);
  assert.equal(textAtRisk({ result, title: 'Aruanne', content: 'Minu tekst', versions: [] }), true);
});

test('teine vajutus: topeltklõps ei läbi mõlemat astet ja tasuline töö ei käivitu kaks korda', () => {
  assert.equal(confirmPress({ armedKey: '', key: 'clear', now: 1000 }), 'arm');
  /* Teise tegevuse küsimus ei kinnita seda tegevust. */
  assert.equal(confirmPress({ armedKey: 'delete', armedAt: 0, key: 'clear', now: 5000 }), 'arm');
  assert.equal(confirmPress({ armedKey: 'clear', armedAt: 1000, key: 'clear', now: 1000 + PRESS_GAP_MS - 1 }), 'wait');
  assert.equal(confirmPress({ armedKey: 'clear', armedAt: 1000, key: 'clear', now: 1000 + PRESS_GAP_MS }), 'run');
  assert.equal(confirmPress({ armedKey: '', key: '', now: 1 }), 'arm');

  assert.equal(pressAllowed(0, 1000), true);
  assert.equal(pressAllowed(1000, 1000 + PRESS_GAP_MS - 1), false);
  assert.equal(pressAllowed(1000, 1000 + PRESS_GAP_MS), true);

  assert.deepEqual(confirmTexts(''), null);
  assert.deepEqual(confirmTexts('midagi'), null);
  assert.equal(confirmTexts('version:v2').kind, 'version');
  assert.equal(confirmTexts('leave:/documents').labelKey, 'documents.drafting.confirm.leave');
  /* Esc ja salvestamise ajal lahkumine ei ole nupud: neil on ainult selgitus. */
  assert.equal(confirmTexts('esc').labelKey, '');
  assert.equal(confirmTexts('way:upload_file').labelKey, '');

  /* Leht küsib teist vajutust kõige eest, mis viiks teksti kaasa või on pöördumatu. */
  const page = read(PAGE);
  for (const call of [
    'guarded("compose", hasTextEdits && !options.confirmed',
    'guarded("clear", hasTextEdits, handleClearWorkspaceResult)',
    'guarded(`version:${row.key}`, versionTextAtRisk',
    'guarded("saved", versionTextAtRisk, handleRestoreSavedVersion)',
    'guarded(`open:${row.key}`, hasTextEdits',
    'guarded("delete", true',
    'guarded(key, true, () => void handleApprove())',
    'guarded(`leave:${href}`, unsavedAnywhere',
    'guarded(key, recorderBusy()',
  ]) assert.ok(page.includes(call), call);
  const audioPath = read(AUDIO_PATH);
  for (const call of ['guarded("summary", unsavedText', 'guarded(`audio:${row.key}`, audio.canSaveAudioTranscript', 'guarded("upload", audio.canSaveAudioTranscript', 'guarded(`way:${nextValue}`, way === "record_now" && recorderBusy()']) {
    assert.ok(audioPath.includes(call), call);
  }
  /* Iga võti, millega leht teist vajutust küsib, on sõnadega tabelis. */
  for (const source of [page, audioPath]) {
    for (const match of source.matchAll(/guarded\((?:"|`)([a-z]+)/g)) assert.ok(CONFIRM_KINDS[match[1]], `teise vajutuse liik ${match[1]}`);
  }
  for (const kind of ['approve', 'finish', 'exit', 'esc']) assert.ok(CONFIRM_KINDS[kind], kind);
  /* Akna sulgemisel küsib brauser; Esc küsib teist vajutust; klahvikordus ei vajuta nuppe. */
  assert.ok(page.includes('addEventListener("beforeunload"') && page.includes('pressConfirm("esc")'));
  assert.ok(page.includes('event.repeat && (event.key === "Enter" || event.key === " ")'));
});

// --- Brauseris kinnitatud vead (10.10) --------------------------------------------------

/* Lehe funktsiooni keha lähtetekstist: nimest kuni funktsiooni lõpuni (sama taandega sulg). */
function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start > 0, `funktsioon ${name} on lehel`);
  return source.slice(start, source.indexOf('\n  }\n', start));
}

// Malli valik elas ainult lehe olekus: seda ei loetud salvestamata muudatuseks, ükski vaade
// ei öelnud, millega see salvestub, ja versiooni taastamine vahetas valiku vaikselt ära.
test('mall: valik on salvestamata muudatus ja teksti taastamine seda ei puuduta', () => {
  const draft = { id: 'a1', status: 'DRAFT', templateId: 't1' };
  assert.equal(templateChoiceUnsaved({ result: draft, selectedTemplateId: 't1' }), false);
  assert.equal(templateChoiceUnsaved({ result: draft, selectedTemplateId: 't2' }), true);
  /* „Ilma mallita” mustandil, millel on mall, on samuti muudatus; ja vastupidi. */
  assert.equal(templateChoiceUnsaved({ result: draft, selectedTemplateId: '' }), true);
  assert.equal(templateChoiceUnsaved({ result: { ...draft, templateId: null }, selectedTemplateId: '' }), false);
  assert.equal(templateChoiceUnsaved({ result: { ...draft, templateId: null }, selectedTemplateId: 't2' }), true);
  /* Kinnitatud teksti malli ei saa muuta: seal kehtib valik järgmise koostamise kohta. */
  assert.equal(templateChoiceUnsaved({ result: { ...draft, status: 'FINAL' }, selectedTemplateId: 't2' }), false);
  assert.equal(templateChoiceUnsaved({ result: null, selectedTemplateId: 't2' }), false);
  /* Pöördujal malle ei ole. */
  assert.equal(templateChoiceUnsaved({ result: draft, selectedTemplateId: '', client: true }), false);

  /* Malli vaate jalarida ütleb, kuidas valik avatud tekstini jõuab. */
  assert.equal(templateNoteKind({ resultState: 'draft', unsaved: true }), 'unsaved');
  assert.equal(templateNoteKind({ resultState: 'draft', unsaved: false }), 'with_draft');
  assert.equal(templateNoteKind({ resultState: 'final', unsaved: false }), 'next_only');
  for (const resultState of ['none', 'loading', 'failed']) assert.equal(templateNoteKind({ resultState }), '');
  assert.equal(templateNoteKind({ resultState: 'draft', unsaved: true, client: true }), '');
  for (const lang of LANGS) {
    const messages = catalog(lang);
    for (const key of Object.values(TEMPLATE_NOTE_KEYS)) assert.equal(typeof at(messages, key), 'string', `${lang}: ${key}`);
    /* Mustandi laused nimetavad nuppu ja vaadet, kus valik salvestub. */
    for (const kind of ['unsaved', 'with_draft']) {
      const text = at(messages, TEMPLATE_NOTE_KEYS[kind]);
      assert.ok(text.includes(messages.documents.actions.save_draft) && text.includes(messages.documents.drafting.views.text.short), `${lang}: ${kind}`);
    }
    assert.ok(messages.documents.drafting.text.unsaved_template.includes(messages.documents.actions.save_draft), lang);
  }

  const page = read(PAGE);
  /* Salvestamata on nii tekst kui ka malli valik: lahkumine, akna sulgemine ja Esc küsivad üle. */
  assert.ok(page.includes('const templateUnsaved = templateChoiceUnsaved({ result: workspaceResult, selectedTemplateId, client: isClientRole })'));
  assert.ok(page.includes('const hasDraftEdits = hasTextEdits || templateUnsaved'));
  assert.ok(page.includes('const unsavedAnywhere = hasDraftEdits || audio.canSaveAudioTranscript'));
  assert.ok(page.includes('unsaved: hasDraftEdits,'), 'sammu seis näitab salvestamata muudatust');
  assert.ok(page.includes('? t("documents.drafting.text.unsaved_template")'), 'teksti vaade ütleb, et malli valik on salvestamata');
  assert.ok(page.includes('noteKind ? t(TEMPLATE_NOTE_KEYS[noteKind]) : ""') && page.includes('noteKind === "unsaved" ? { label: viewShort("text"), onClick: () => openView("text") } : null'), 'malli vaate jalarida ja tee teksti vaatesse');
  /* Salvestus saadab valitud malli endiselt kaasa (päring on sama mis enne). */
  assert.ok(page.includes('templateId: selectedTemplateId || null,'));

  /* Taastamine puudutab ainult teksti: malli valik ja väljundi tüüp jäävad paika. */
  for (const name of ['handleRestoreWorkspaceVersion', 'handleRestoreSavedVersion']) {
    const body = functionBody(page, name);
    assert.ok(body.includes('setResultTitle(') && body.includes('setResultContent('), `${name} taastab teksti`);
    assert.ok(!body.includes('setSelectedTemplateId(') && !body.includes('setOutputType('), `${name} ei muuda malli ega väljundi tüüpi`);
  }
});

// Mustand, mille mallilt oli luba vahepeal ära võetud, ei salvestunud ega kinnitunud ruumis
// ja veateade ei öelnud, mida teha.
test('mall: lubamata malliga mustand salvestub ja keeldumine viib malli vaatesse', async () => {
  const { draftTemplateChange, templateShapesFile } = await import('../lib/documents/artifactFiles.js');
  /* Olemasoleva malli hoidmine ei ole uus valik: seda ei kontrollita uuesti. */
  assert.deepEqual(draftTemplateChange('t1', 't1'), { kind: 'keep', templateId: 't1' });
  assert.deepEqual(draftTemplateChange('t1', ' t1 '), { kind: 'keep', templateId: 't1' });
  /* Päring, mis malli ei nimeta (teksti detailileht), hoiab selle samuti. */
  assert.deepEqual(draftTemplateChange('t1', undefined), { kind: 'keep', templateId: 't1' });
  assert.deepEqual(draftTemplateChange(null, undefined), { kind: 'keep', templateId: null });
  /* Tühi väärtus võtab malli ära; teine mall on valik, mida kontrollitakse. */
  assert.deepEqual(draftTemplateChange('t1', null), { kind: 'clear', templateId: null });
  assert.deepEqual(draftTemplateChange('t1', ''), { kind: 'clear', templateId: null });
  assert.deepEqual(draftTemplateChange('t1', 't2'), { kind: 'choose', templateId: 't2' });
  assert.deepEqual(draftTemplateChange(null, 't2'), { kind: 'choose', templateId: 't2' });
  const route = read('../app/api/documents/artifacts/[id]/route.js');
  assert.ok(route.includes('const templateChange = draftTemplateChange(artifact.templateId, body?.templateId)'));
  const check = route.slice(route.indexOf('if (templateChange.kind === "choose") {'), route.indexOf('const role = effectiveRoleFromSession(auth.session)'));
  assert.ok(check.includes('ownerId: auth.userId,') && check.includes('if (!template.agentAllowed) {'), 'uut malli kontrollitakse nagu enne');

  /* Valitud malli seis mallide loendi järgi. */
  const templates = [
    { id: 't1', agentAllowed: true, mime: DOCX_MIME_TYPE },
    { id: 't2', agentAllowed: false, mime: DOCX_MIME_TYPE },
    { id: 't3', agentAllowed: true, mime: 'text/plain' },
  ];
  assert.deepEqual(templateStatus({ templates, selectedTemplateId: 't1' }), { blocked: false, shapesFile: true });
  assert.deepEqual(templateStatus({ templates, selectedTemplateId: 't2' }), { blocked: true, shapesFile: true });
  assert.deepEqual(templateStatus({ templates, selectedTemplateId: 't3' }), { blocked: false, shapesFile: false });
  /* Malli, mida loendis ei ole, ei nimetata lubamatuks: seda ei saa teada. */
  assert.deepEqual(templateStatus({ templates, selectedTemplateId: 'tx' }), { blocked: false, shapesFile: null });
  assert.deepEqual(templateStatus({ templates, selectedTemplateId: '' }), { blocked: false, shapesFile: null });
  assert.equal(templateShapesFile({ mime: DOCX_MIME_TYPE }), true);
  for (const mime of ['application/pdf', 'text/plain', '', undefined]) assert.equal(templateShapesFile({ mime }), false, String(mime));

  /* Serveri keeldumine valitud malli pärast: lause ütleb, mida teha, ja jalareal on tee malli vaatesse. */
  assert.equal(errorWayFor('documents.artifacts.errors.template_not_allowed'), 'template');
  assert.equal(errorWayFor('documents.artifacts.errors.template_not_found'), 'template');
  assert.equal(errorWayFor('documents.artifacts.errors.version_conflict'), '');
  assert.equal(errorWayFor(undefined), '');
  for (const lang of LANGS) {
    const messages = catalog(lang).documents;
    for (const key of ['template_not_allowed', 'template_not_found']) {
      const text = messages.artifacts.errors[key];
      assert.ok(text.includes(messages.drafting.views.template.short) && text.includes(messages.drafting.template.none), `${lang}: ${key} ütleb, mida teha`);
    }
    assert.ok(messages.drafting.template.blocked.includes(messages.drafting.template.none), `${lang}: lubamata malli lause ütleb, mida teha`);
    assert.ok(/DOCX/.test(messages.drafting.template.not_word), lang);
  }
  const page = read(PAGE);
  assert.ok(page.includes('failure.way = errorWayFor(resultPayload?.messageKey)') && page.split('setErrorWay(String(error?.way || ""))').length - 1 === 2, 'salvestamine ja kinnitamine');
  assert.ok(page.includes('const way = active && errorWay && errorWay !== key ? { label: viewShort(errorWay), onClick: () => openView(errorWay) } : null'));
  assert.ok(page.includes('if (errorWay) setErrorWay("")'), 'tee kustub koos veaga');
  assert.ok(page.includes('chosen.blocked && resultState === "draft" ? t("documents.drafting.template.blocked") : ""'));
  assert.ok(page.includes('chosen.shapesFile === false ? t("documents.drafting.template.not_word") : ""'));
});

// Malli vaade ütles, et mall annab tekstile ülesehituse. Kuni koostamine on peatatud, on
// malli ainus mõju kinnitatud Wordi faili kuju, ja ainult Wordi mallil.
test('mall: vaade ütleb, mis on tõsi, ja loetleb kohatäitjad, mida kinnitamine asendab', () => {
  const list = templatePlaceholderList();
  assert.equal(DOCX_TEMPLATE_PLACEHOLDERS.length, 5);
  for (const name of DOCX_TEMPLATE_PLACEHOLDERS) assert.ok(list.includes(`{{${name}}}`), name);
  /* Sama loend, mida Wordi faili tegija asendab: iga nime jaoks on asendus olemas. */
  const exporter = read('../lib/documents/docxExport.js');
  assert.ok(exporter.includes('for (const name of DOCX_TEMPLATE_PLACEHOLDERS) {'));
  for (const name of DOCX_TEMPLATE_PLACEHOLDERS) assert.ok(exporter.includes(`\\{\\{${name}\\}\\}`), `${name} asendatakse`);
  assert.ok(read(PAGE).includes('lead={t("documents.drafting.template.lead", { placeholders: templatePlaceholderList() })}'));
  for (const lang of LANGS) {
    const t = translator(lang);
    const lead = t('documents.drafting.template.lead', { placeholders: list });
    assert.ok(lead.includes('{{TITLE}}') && lead.includes('{{ARTIFACT_TYPE}}') && !lead.includes('{placeholders}'), lang);
    assert.ok(/DOCX/.test(lead), `${lang}: lause nimetab Wordi faili`);
  }
  assert.ok(!/ülesehitus/i.test(catalog('et').documents.drafting.template.lead), 'vana lubadus on läinud');
});

// Ruum pakkus PDF-i linki ja lubas PDF-i iga kinnitatud teksti juures, ka siis, kui PDF-i ei
// tehtud (tekstis on märke, mida PDF ei toeta): link vastas veaga.
test('kinnitatud tekst: PDF-i pakutakse ainult siis, kui see on olemas', () => {
  const page = read(PAGE);
  assert.ok(page.includes('import { artifactDownloads } from "@/components/documents/detail/detailModel"'), 'sama reegel mis teksti detaililehel');
  assert.ok(page.includes('const files = artifactDownloads(workspaceResult)') && page.includes('downloads={downloadLinks(files)}'), 'kinnitamise vaate lingid tulevad reeglist');
  assert.ok(!page.includes('downloadLinks(workspaceResult?.downloadUrls)') && !page.includes('payload?.downloadUrls ||'), 'serveri linke ei võeta enam otse');
  /* Teade ja jalarida ütlevad, kui valmis on ainult Wordi fail (samad laused mis detaililehel). */
  assert.ok(/: files\.pdfMissing\s+\? "documents\.detail\.approve\.done_no_pdf"\s+: "documents\.feedback\.approved"/.test(page));
  assert.ok(/final\s+\? files\.pdfMissing\s+\? t\("api\.exports\.pdf_content_not_supported"\)/.test(page));
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.equal(typeof messages.documents.detail.approve.done_no_pdf, 'string', lang);
    assert.equal(typeof messages.api.exports.pdf_content_not_supported, 'string', lang);
  }
  /* Kinnitamise juhis ei luba PDF-i enne, kui see on tehtud. */
  assert.ok(!/DOCX- ja PDF-failina/.test(catalog('et').documents.drafting.approve.lead));
});

// Versioonide lause lubas kuni kaheksat versiooni ka siis, kui uusi ei saa tekkida, ja
// taastamise teade soovitas salvestada, kui taastatud tekst oli sama mis salvestatud.
test('versioonid: lause ei luba rohkem, kui on, ja taastamise teade ei soovita asjatut salvestamist', () => {
  const saved = { id: 'a1', title: 'Aruanne', content: 'Tekst' };
  assert.equal(versionRestoredKey(saved, { title: 'Aruanne', content: 'Tekst' }), 'documents.drafting.feedback.version_restored_same');
  assert.equal(versionRestoredKey(saved, { title: 'Aruanne ', content: 'Tekst' }), 'documents.drafting.feedback.version_restored_same');
  assert.equal(versionRestoredKey(saved, { title: 'Aruanne', content: 'Täiendatud' }), 'documents.drafting.feedback.version_restored');
  /* Tekst, mida ei ole veel salvestatud, tuleb salvestada. */
  assert.equal(versionRestoredKey({ title: 'Aruanne', content: 'Tekst' }, { title: 'Aruanne', content: 'Tekst' }), 'documents.drafting.feedback.version_restored');
  assert.equal(versionRestoredKey(null, { title: 'x', content: 'y' }), 'documents.drafting.feedback.version_restored');
  const page = read(PAGE);
  assert.ok(page.includes('setRunFeedback({ message: t(versionRestoredKey(workspaceResult, version)) })'));
  assert.ok(page.includes('lead={t(COMPOSE_PAUSED ? "documents.drafting.versions.lead_paused" : "documents.drafting.versions.lead", { count: WORKSPACE_VERSION_LIMIT })}'));
  /* Uus versioon tekib ainult koostamisel, täiendamisel ja heli raja kokkuvõttest: kuni
     koostamine on peatatud, ei saa neid olla üle ühe. */
  assert.equal(count(page, 'appendWorkspaceVersion({'), 2, 'appendWorkspaceVersion: kirjeldus ja üks kutse');
  assert.ok(functionBody(page, 'handleRefine').includes('appendWorkspaceVersion({'), 'lisaja on täiendamine');
  for (const lang of LANGS) {
    const versions = catalog(lang).documents.drafting.versions;
    assert.ok(!versions.lead_paused.includes('{count}'), `${lang}: peatatud ajal arvu ei lubata`);
    assert.equal(typeof catalog(lang).documents.drafting.feedback.version_restored_same, 'string', lang);
  }
});

// Serveri veateade tuli brauseri keeles ja võrgutõrke korral oli ekraanil brauseri enda
// ingliskeelne tekst („Failed to fetch”).
test('iga päring kannab lehe keelt ja brauseri veatekst ei jõua ekraanile', () => {
  for (const path of [PAGE, AUDIO_HOOK, FILES_HOOK]) {
    const source = read(path);
    const requests = source.split('fetch(').slice(1);
    assert.ok(requests.length >= 3, `${path}: päringuid ${requests.length}`);
    for (const request of requests) {
      const head = request.slice(0, 420);
      assert.ok(/headers: localeHeaders\(locale\)|"x-ui-locale": locale|headers: requestHeaders/.test(head), `${path}: ${request.slice(0, 60)}`);
    }
    assert.ok(!/[eE]rror\??\.message/.test(source), `${path}: vea toorest teksti ei kuvata`);
    assert.ok(!/payload\?\.message \|\|/i.test(source), `${path}: serveri sõnum käib läbi serverMessage`);
    assert.ok(!/throw new Error\((?:serverMessage|payload|t\()/.test(source), `${path}: ekraanile mõeldud viga on RequestFailure`);
    assert.ok(source.includes('failureText(error, t('), path);
  }
  assert.ok(read(PAGE).includes('const requestHeaders = {\n      "Content-Type": "application/json",\n      "x-ui-locale": locale\n    }'));
});

test('serveri veateade: võti ei jõua ekraanile', () => {
  for (const lang of LANGS) {
    const t = translator(lang);
    const retired = catalog(lang).api.rag.retired;
    /* Peatatud koostamise marsruut saadab `message` väljal võtme enda. */
    assert.equal(serverMessage({ message: 'api.rag.retired', messageKey: 'api.rag.retired' }, t, 'documents.errors.create_artifact_failed'), retired, lang);
    assert.equal(serverMessage({ message: 'api.rag.retired' }, t, 'documents.errors.create_artifact_failed'), retired, lang);
    /* Tõlgitud lause läheb läbi muutmata. */
    assert.equal(serverMessage({ message: 'Juhis on liiga pikk.', messageKey: 'documents.artifacts.errors.instruction_too_long' }, t, 'x'), 'Juhis on liiga pikk.');
    /* Tundmatu võti või tühi vastus annab lehe enda sõnad. */
    const fallback = catalog(lang).documents.errors.create_artifact_failed;
    assert.equal(serverMessage({ message: 'midagi.tundmatut', messageKey: 'midagi.tundmatut' }, t, 'documents.errors.create_artifact_failed'), fallback, lang);
    assert.equal(serverMessage({}, t, 'documents.errors.create_artifact_failed'), fallback, lang);
    assert.equal(serverMessage(null, t, 'documents.errors.create_artifact_failed'), fallback, lang);
  }
});

test('isikuandmete kontroll käib enne koostamist ja täiendamist sama töövoo nimega', () => {
  assert.equal(PRIVACY_WORKFLOW, 'document_generation');
  /* Sama nimi, mille vestluse sisestusriba dokumendirežiimis saatis. */
  assert.ok(read('../components/alalehed/chat/ChatComposer.jsx').includes('if (activeModeKey === "document") return "document_generation";'));
  assert.deepEqual(privacyChoices(null), []);
  assert.deepEqual(privacyChoices({ unavailable: true, redactedText: 'x', allowOriginal: true }), ['retry', 'edit']);
  assert.deepEqual(privacyChoices({ redactedText: 'x', allowOriginal: true }), ['edit', 'redacted', 'original']);
  assert.deepEqual(privacyChoices({ redactedText: 'x', allowOriginal: false }), ['edit', 'redacted']);
  assert.deepEqual(privacyChoices({ redactedText: '', allowOriginal: false }), ['edit']);

  const page = read(PAGE);
  assert.ok(page.includes('requestPrivacyCheck({ text, workflow: PRIVACY_WORKFLOW })'));
  assert.ok(page.includes('await checkPrivacy("compose", text)') && page.includes('await checkPrivacy("refine", text)'));
  /* Kontroll on tasulise töö värava sees ja enne päringut. */
  assert.ok(page.indexOf('await checkPrivacy("compose", text)') < page.indexOf('const nextDraft = await runGeneration({'));
  assert.ok(page.indexOf('await checkPrivacy("refine", text)') < page.indexOf('const nextDraft = await handleRefine(nextText'));
  assert.ok(page.includes('privacyDecision: { action: "use_redacted" }') && page.includes('privacyDecision: { action: "send_original" }'));
});

test('tasulised päringud on samad mis enne ja käivituvad ainult oma nupust', () => {
  const page = read(PAGE);
  const audioHook = read(AUDIO_HOOK);
  const audioPath = read(AUDIO_PATH);

  /* Koostamine: aadress, meetod, keha väljad ja kavatsuse võti. */
  assert.equal(count(page, 'fetch("/api/documents/artifacts/generate"'), 1);
  for (const part of [
    'documentIds: sourceDocuments.map((document) => document.id),',
    'templateId: isClientRole ? undefined : templateIdToUse || undefined,',
    'instruction: nextInstruction,',
    '? `${clientTaskInstruction(clientTask)}\\n\\n${effectiveInstruction}`',
    'buildIntentSignature(generationPayload)',
    'idempotencyKey: generateIntentRef.current.key',
    'generateIntentRef.current = null',
  ]) assert.ok(page.includes(part), part);

  /* Täiendamine. */
  assert.equal(count(page, 'fetch("/api/documents/artifacts/refine"'), 1);
  for (const part of [
    'artifactId: workspaceResult.id || undefined,',
    'expectedUpdatedAt: workspaceResult.updatedAt,',
    'currentContent: resultContent,',
    'refinementInstruction: effectiveRefinement,',
    'buildIntentSignature(refinePayload)',
    'idempotencyKey: refineIntentRef.current.key',
  ]) assert.ok(page.includes(part), part);

  /* Transkript ja kokkuvõte (heli raja konksus). */
  assert.equal(count(audioHook, '/transcribe`, {'), 1);
  assert.ok(audioHook.includes('body: JSON.stringify({ language, idempotencyKey: selectedAudioSource.id })'));
  assert.equal(count(audioHook, '/summary`, {'), 1);
  for (const part of [
    'const transcript = await saveAudioTranscriptIfNeeded()',
    'content: transcriptDocument.content',
    'buildIntentSignature({ ...summaryPayload, transcriptId: transcript.id })',
    'idempotencyKey: summaryIntentRef.current.key',
  ]) assert.ok(audioHook.includes(part), part);
  /* Salvestamata parandused salvestatakse enne kokkuvõtte päringut. */
  assert.ok(audioHook.indexOf('const transcript = await saveAudioTranscriptIfNeeded()') < audioHook.indexOf('/summary`, {'));

  /* Kutsujaid on täpselt üks kummagi kohta ja see on tasulise töö värava sees. */
  assert.equal(count(page, 'runGeneration('), 2, 'koostamise päringut kutsub ainult „Koosta tekst”');
  assert.equal(count(page, 'handleRefine('), 2, 'täiendamise päringut kutsub ainult „Täienda teksti”');
  assert.equal(count(page, 'runPaid('), 2, 'lehel on kaks tasulist tööd: koostamine ja täiendamine');
  assert.equal(count(audioPath, 'runPaid('), 2, 'heli rajal on kaks tasulist tööd: transkript ja kokkuvõte');
  assert.equal(count(audioPath, 'audio.handleTranscribeAudio()'), 1);
  assert.equal(count(audioPath, 'audio.handleCreateAudioSummary()'), 1);
  assert.ok(audioPath.includes('runPaid(() => audio.handleTranscribeAudio())'));
  assert.ok(/runPaid\(async \(\) => \{\s*const ready = await audio\.handleCreateAudioSummary\(\)/.test(audioPath));

  /* Ükski mõjur (kerimine, sammu vahetus, laadimine) ei käivita tasulist tööd. */
  for (const source of [page, audioHook, audioPath]) {
    for (const effect of source.split(/useEffect\(/).slice(1)) {
      const body = effect.slice(0, effect.indexOf('\n  }, ['));
      for (const paid of ['runGeneration', 'handleRefine', 'pressCompose', 'pressRefine', 'handleTranscribeAudio', 'handleCreateAudioSummary', 'runPaid']) {
        assert.ok(!body.includes(paid), `mõjur ei kutsu ${paid}`);
      }
    }
  }
  assert.ok(!page.includes('flight.next') && !audioPath.includes('flight.next'), 'vaade ei liigu ise edasi');

  /* Värav: korraga üks ja mitte topeltklõpsust. */
  const guards = read(GUARDS_HOOK);
  assert.ok(guards.includes('if (paidBusyRef.current || !pressAllowed(paidPressAt.current, now)) return undefined'));
  /* Vaated ei tee ühtegi päringut. */
  for (const view of VIEWS) assert.ok(!read(view).includes('fetch('), `${view} ainult joonistab`);
  /* Tasulise töö nupud on nimega nupud, mis ei reageeri klahvikordusele. */
  const bits = read(BITS);
  assert.ok(bits.includes('export function PaidButton') && bits.includes('onKeyDown={noKeyRepeat}'));
  assert.equal(count(read('../components/agent/drafting/AudioViews.jsx'), '<PaidButton'), 2);
  assert.equal(count(bits, '<PaidButton'), 1, 'juhise vaate kuju kannab koostamise ja täiendamise nuppu');
});

test('salvesti jääb puutumata: nõusolek enne mikrofoni ja samad omadused', () => {
  const recorder = read('../components/documents/SessionRecorder.jsx');
  assert.ok(recorder.includes('if (!consent) {') && recorder.includes('setErrorKey("documents.recorder.consent_first")'));
  assert.ok(recorder.indexOf('if (!consent) {') < recorder.indexOf('navigator.mediaDevices.getUserMedia({ audio: true })'));
  assert.ok(recorder.includes('formData.append("consent", "1")') && recorder.includes('data-recorder-phase={phase}'));
  assert.ok(recorder.includes('classNames = {}'), 'kujundus tuleb lehelt klassidena');
  /* Leht annab salvestile ainult klassid, nupu ja osa salvestamise teate; lahkumine küsib üle. */
  const audioPath = read(AUDIO_PATH);
  assert.ok(audioPath.includes('classNames={RECORDER_CLASSES}') && audioPath.includes('onPartSaved={audio.handleRecordedPart}'));
  assert.ok(read(PAGE).includes('querySelector("[data-recorder-phase]")'));
  /* Uus osa ei võta pooleli transkripti eest ära. */
  const hook = read(AUDIO_HOOK);
  assert.ok(hook.includes('if (canSaveAudioTranscript || transcribingAudio || savingAudioTranscript || summarizingAudio) {'));
});

test('read: lähtefailid, helifailid, versioonid ja tulemused ei kuva võtit ega toorest väärtust', () => {
  for (const lang of LANGS) {
    const t = translator(lang);
    const files = sourceRows([
      { id: 'd 1', title: 'Märkmed', originalName: 'markmed.pdf', kind: 'MATERIAL', size: 2048, updatedAt: '2026-10-09T09:00:00Z' },
      { id: 'd2', title: '', originalName: '', kind: 'OTHER', templateFor: 'OTHER', size: 10 },
      { id: 'd3', title: 'Mall', kind: 'TEMPLATE', templateFor: 'MIDAGI_UUT' },
    ], { t, locale: lang });
    assert.equal(files[0].download, '/api/documents/d%201/download');
    assert.ok(files[0].meta.startsWith('markmed.pdf · 2 KB'));
    assert.equal(files[1].title, catalog(lang).documents.workspace.untitled);
    /* Liik ja malli otstarve võivad kanda sama sõna: seda ei näidata kaks korda. */
    assert.equal(files[1].chips.length, 1);
    assert.equal(files[2].chips.length, 1, 'tundmatu otstarve jääb ära');

    const audio = audioSourceRows([
      { id: 's1', title: 'Kõne', kind: 'CALL_AUDIO_RECORDING', createdAt: '2026-10-01T09:00:00Z', callRecording: { durationSeconds: 725, purpose: 'CASE_SUMMARY', callStartedAt: '2026-10-01T08:45:00Z' } },
      { id: 's2', title: 'Kohtumine', kind: 'UPLOADED_AUDIO_SOURCE', recording: { part: 1 }, transcript: { id: 'tr' } },
      { id: 's3', title: '', originalName: 'heli.mp3', kind: 'UPLOADED_AUDIO_SOURCE', callRecording: { purpose: 'MIDAGI_UUT' } },
      { id: 's4', title: 'Oma sõnadega', kind: 'CALL_AUDIO_RECORDING', callRecording: { purpose: 'OTHER', purposeText: 'Pereringi kokkulepped' } },
    ], { selectedId: 's2', t, locale: lang });
    const drafting = catalog(lang).documents.drafting;
    assert.deepEqual(audio.map((row) => row.origin), [drafting.audio.origin_call, drafting.audio.origin_recorded, drafting.audio.origin_upload, drafting.audio.origin_call]);
    assert.deepEqual(audio.map((row) => row.selected), [false, true, false, false]);
    assert.deepEqual(audio.map((row) => row.hasTranscript), [false, true, false, false]);
    assert.ok(audio[0].meta.includes('12:05') && audio[0].meta.includes(catalog(lang).calls.recording_purpose_case_summary));
    assert.ok(audio[2].meta.includes(catalog(lang).calls.recording_purpose_other), 'tundmatu eesmärk saab üldise sõna');
    assert.ok(audio[3].meta.includes('Pereringi kokkulepped'), 'inimese enda sõnastus läheb ette');
    assert.equal(audio[2].title, 'heli.mp3');
    for (const row of audio) assert.ok(!/[A-Z]{3,}_[A-Z]+|recording_purpose|725s/.test(row.meta), `${lang}: „${row.meta}”`);

    const versions = versionRows([
      { id: 'v1', kind: 'generated', title: 'Aruanne', content: 'A', type: 'REPORT_DRAFT', createdAt: '2026-10-09T08:00:00Z' },
      { id: 'v2', kind: 'refined', title: '', content: 'B', type: 'MIDAGI_UUT', createdAt: '2026-10-09T08:10:00Z' },
      { id: 'v3', kind: 'tundmatu', title: 'Aruanne', content: 'C', type: 'REPORT_DRAFT', createdAt: '2026-10-09T08:20:00Z' },
    ], { title: 'Aruanne', content: 'A', t, locale: lang });
    /* Uusim ees; toimetis olev on märgitud; tundmatu liik jääb ära. */
    assert.deepEqual(versions.map((row) => row.key), ['v3', 'v2', 'v1']);
    assert.deepEqual(versions.map((row) => row.current), [false, false, true]);
    assert.deepEqual(versions.map((row) => row.kind), ['', drafting.versions.kinds.refined, drafting.versions.kinds.generated]);
    assert.equal(versions[1].title, catalog(lang).documents.artifact_types.other);

    const recent = recentResultRows([
      { id: 'a1', title: 'Kiri', status: 'DRAFT', updatedAt: '2026-10-09T08:30:00Z' },
      { id: 'a2', title: '', snippet: 'Lugupeetud', status: 'FINAL', createdAt: '2026-10-08T08:30:00Z' },
      { id: 'a3', title: '', status: 'MIDAGI' },
    ], { currentId: 'a1', t, locale: lang });
    assert.deepEqual(recent.map((row) => row.title), ['Kiri', 'Lugupeetud', catalog(lang).documents.workspace.untitled]);
    assert.deepEqual(recent.map((row) => row.status), [drafting.results.status_draft, drafting.results.status_final, drafting.results.status_draft]);
    assert.deepEqual(recent.map((row) => row.tone), ['wait', 'ok', 'wait']);
    assert.deepEqual(recent.map((row) => row.current), [true, false, false]);
    assert.ok(recent[0].date && recent[1].date);

    const draft = { id: 'a1', type: 'REPORT_DRAFT', status: 'DRAFT', createdAt: '2026-10-09T08:00:00Z', updatedAt: '2026-10-09T08:30:00Z', approvedAt: '2026-10-09T09:00:00Z', sources: [{ id: 'd 1', title: '' }, { title: 'ilma id-ta' }] };
    const worker = resultSheet(draft, { t, locale: lang });
    assert.deepEqual(worker.chips.map((chip) => chip.key), ['type', 'status']);
    assert.deepEqual(worker.facts.map((fact) => fact.key), ['created', 'updated', 'approved']);
    assert.deepEqual(worker.sources, [{ key: 'd 1', title: catalog(lang).documents.workspace.untitled, href: '/api/documents/d%201/download' }]);
    /* Pöörduja näeb olekut oma sõnadega; kinnitamise aega talle ei näidata. */
    const client = resultSheet({ ...draft, status: 'FINAL' }, { client: true, t, locale: lang });
    assert.deepEqual(client.chips.map((chip) => [chip.key, chip.text, chip.tone]), [['status', drafting.results.status_final, 'ok']]);
    assert.deepEqual(client.facts.map((fact) => fact.key), ['created', 'updated']);
    assert.deepEqual(resultSheet(null, { t, locale: lang }), { chips: [], facts: [], sources: [] });
    for (const text of [...worker.chips.map((chip) => chip.text), ...worker.facts.map((fact) => fact.label)]) assert.ok(text && !looksRaw(text), `${lang}: „${text}”`);
  }
});

test('kestus ja teksti algus', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(65), '1:05');
  assert.equal(formatDuration(725), '12:05');
  assert.equal(formatDuration(4000), '1:06:40');
  assert.equal(formatDuration('x'), '0:00');
  assert.equal(snippet('  Esimene\n rida  '), 'Esimene rida');
  assert.equal(snippet('x'.repeat(200), 20).length, 20);
  assert.equal(recordingPurposeLabel(null, translator('et')), '');
});

test('sammude seisud: tehtud samm on heledam', () => {
  const empty = viewStates();
  assert.equal(empty.sources, 'empty');
  assert.equal(empty.type, 'done');
  assert.equal(empty.style, 'done');
  assert.equal(empty.template, 'empty');
  assert.equal(empty.instruction, 'empty');
  assert.equal(empty.audio, 'empty');
  assert.equal(viewStates({ documentCount: 2, missingCount: 1 }).sources, 'partial');
  assert.equal(viewStates({ documentCount: 2 }).files, 'done');
  assert.equal(viewStates({ instruction: 'x' }).instruction, 'partial');
  const draft = viewStates({ resultState: 'draft', unsaved: true, refineText: 'x', versionCount: 2 });
  assert.deepEqual([draft.instruction, draft.text, draft.refine, draft.versions, draft.approve], ['done', 'partial', 'partial', 'done', 'empty']);
  const final = viewStates({ resultState: 'final' });
  assert.deepEqual([final.text, final.approve, final.finish], ['done', 'done', 'done']);
  const audio = viewStates({ audioChosen: true, hasTranscript: true, transcriptUnsaved: true, summaryReady: true });
  assert.deepEqual([audio.audio, audio.transcribe, audio.review, audio.summary], ['done', 'done', 'partial', 'done']);
  /* Igal vaatel on seis. */
  for (const key of VIEW_TEXT_KEYS) assert.ok(['empty', 'partial', 'done'].includes(empty[key]), key);
});

test('leht kannab ridade märgid vaateni ja vaated loevad neid', () => {
  /* Märk, mis mudelis pandi, peab jõudma vaateni: leht laotab rea (`...row`) ja lisab tegevuse. */
  const page = read(PAGE);
  const audioPath = read(AUDIO_PATH);
  assert.ok(/versionRows\(workspaceVersions[^)]*\)\.map\(\(row\) => \(\{\s*\.\.\.row,/.test(page));
  assert.ok(/recentResultRows\(recentArtifacts[^)]*\)\.map\(\(row\) => \(\{\s*\.\.\.row,/.test(page));
  assert.ok(page.includes('rows.map((row) => ({ ...row, onRemove:'));
  assert.ok(/rows: rows\.map\(\(row\) => \(\{\s*\.\.\.row,/.test(audioPath));
  const compose = read('../components/agent/drafting/ComposeViews.jsx');
  for (const field of ['row.title', 'row.chips', 'row.meta', 'row.download', 'row.onRemove']) assert.ok(compose.includes(field), field);
  const result = read('../components/agent/drafting/ResultViews.jsx');
  for (const field of ['row.title', 'row.kind', 'row.current', 'row.meta', 'row.onRestore', 'row.restoreLabel', 'row.status', 'row.tone', 'row.date', 'row.onOpen', 'row.openLabel']) assert.ok(result.includes(field), field);
  for (const field of ['sheet.chips', 'sheet.facts', 'sheet.sources', 'chip.tone', 'fact.label', 'source.href']) assert.ok(result.includes(field), field);
  const audio = read('../components/agent/drafting/AudioViews.jsx');
  for (const field of ['row.title', 'row.origin', 'row.meta', 'row.hasTranscript', 'row.selected', 'row.onChoose', 'row.chooseLabel']) assert.ok(audio.includes(field), field);
});

test('leht ei ole enam vanal ühisel kihil ja kujundus on lehe oma failis', () => {
  const page = read(PAGE);
  const code = [page, read(AUDIO_PATH), ...VIEWS.map(read)].join('\n');
  assert.ok(!page.includes('feature-page') && !page.includes('agent-mode'), 'vana kihi klasse ei ole');
  assert.ok(!page.includes('ChatComposer') && !page.includes('ConversationView') && !page.includes('OptionCard') && !page.includes('DocumentsDropdown'));
  assert.ok(!read('../app/styles/feature-pages.css').includes('agent-mode'), 'vana kihi reeglid on eemaldatud');
  /* Teated ei kasuta status-rolli (paneeli üldkiht joonistab selle oma värviga). */
  assert.ok(!code.includes('role="status"'));
  assert.ok(page.includes('headerClassName="sr-only"'), 'lehe nimi on kiirmenüüs, pealkiri ekraanilugejale');
  /* Põhinupu läige on ainult ees oleval vaatel. */
  assert.ok(page.includes('const glow = flight?.isActive !== false'));
  /* Töölaua sees ei korrata lehe nime paneelil ega vahetata aadressi. */
  const panel = read('../components/chat/WorkspacePanel.jsx');
  const dock = panel.slice(panel.indexOf('const EMBEDDED_TITLE_IN_DOCK'), panel.indexOf(']);', panel.indexOf('const EMBEDDED_TITLE_IN_DOCK')));
  assert.ok(dock.includes('"document_drafting"'));
  assert.ok(page.includes('if (embedded) return\n    router.replace(buildWorkspaceHref('));
  assert.equal(count(page, 'router.replace('), 1, 'aadressi muudab ainult syncWorkspaceUrl');

  const css = read(STYLES);
  assert.ok(!css.includes('!important'), 'lehe kujundus ei sunni värve');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css), 'värvid tulevad platvormi muutujatest');
  /* Reeglid on klasside peal, mitte paljaste siltide peal. */
  for (const line of css.split('\n')) {
    if (/^[^\s@/*}][^{]*\{\s*$/.test(line)) assert.ok(/^\s*\./.test(line), `valija „${line.trim()}” algab klassiga`);
  }
  /* Iga klass, mida vaated kasutavad, on kujundusfailis olemas. */
  const used = new Set([...code.matchAll(/styles\.([a-zA-Z0-9]+)/g)].map((match) => match[1]));
  assert.ok(used.size > 30, `klasse leiti ${used.size}`);
  for (const name of used) assert.ok(new RegExp(`\\.${name}\\b`).test(css), `klass ${name}`);
});

test('kui server koostamist ei tee, on see takistus esimene ja lehel on selle kohta lause', async () => {
  const { RAG_AVAILABLE } = await import('../lib/rag/retired.js');
  assert.equal(COMPOSE_PAUSED, !RAG_AVAILABLE, 'leht loeb sama lippu mis server');
  assert.equal(composeBlocker({ documentCount: 1, type: 'REPORT_DRAFT', instruction: 'tee', paused: true }), 'paused');
  assert.equal(composeBlocker({ documentCount: 0, paused: true, busy: true }), 'paused', 'peatamine on esimene põhjus');
  assert.equal(refineBlocker({ resultState: 'draft', documentCount: 1, content: 'x', instruction: 'tee', paused: true }), 'paused');
  assert.equal(composeBlocker({ documentCount: 1, type: 'REPORT_DRAFT', instruction: 'tee' }), '', 'ilma peatamiseta takistust ei ole');
  /* Serveri pool: mõlemad funktsioonid keelduvad, kuni lipp on maas. */
  const generation = fs.readFileSync(new URL('../lib/documents/generation.js', import.meta.url), 'utf8');
  if (!RAG_AVAILABLE) assert.ok(/export async function generateArtifactDraftContent\(\) \{\s+throw createRagRetiredError\(\);/.test(generation));
  for (const lang of ['et', 'en', 'ru']) {
    const messages = JSON.parse(fs.readFileSync(new URL(`../messages/${lang}.json`, import.meta.url), 'utf8'));
    assert.equal(typeof messages.documents.drafting.paused, 'string', lang);
  }
  const page = fs.readFileSync(new URL('../components/agent/AgentModePage.jsx', import.meta.url), 'utf8');
  assert.equal(page.split('paused: COMPOSE_PAUSED').length - 1, 4, 'kõik neli takistuse arvutust teavad peatamisest');
});
