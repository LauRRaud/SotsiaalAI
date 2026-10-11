// Juhtumi sektsioonid (kohtumise ettevalmistus, märge, heli, STAR2 järjekord,
// ülekandeajalugu): vaadete tekstid, read, reeglid ja lubadused.
//
// Sektsioonid olid vanal `cw-*` kihil, igaüks üks pikk veerg; nüüd on need
// väikesed vaated juhtumi laval (components/casework/sections/). Pinna
// kommentaarid viitasid testidele, mida projektis ei olnud (`meetingNoteUi.test.js`,
// `draftUi.test.js`, kopeerimisjärjekorra test): loendid, mis peavad serveriga
// kokku minema, olid kahes kohas ilma kontrollita. See fail on see kontroll, ja
// hoiab lisaks seda, mida silm kergesti ei märka: puuduv tõlkevõti, liiga pikk
// saki nimi, toores enum ekraanil, ühe vajutusega pöördumatu tegu, salvestamise
// ajaks keelatud väli.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ALLOWED_TRANSITIONS,
  CONFIRM_TARGETS,
  DRAFT_TABS,
  DRAFT_TYPE_ORDER,
  NOTE_LAYER_ORDER,
  NOTE_TABS,
  PREP_FIELD_KEYS,
  PREP_TABS,
  PRIVATE_LAYER,
  QUESTION_KINDS,
  REVIEW_KINDS,
  asksReviewKind,
  canAddDraftField,
  canAddRow,
  canSavePrepField,
  confirmTargetOptions,
  draftFieldRows,
  draftHead,
  draftRows,
  draftStateModel,
  draftTabs,
  draftTypeOptions,
  entryRows,
  isAiDraft,
  isTerminalState,
  noteRows,
  noteTabs,
  prepFieldModel,
  prepFieldText,
  prepOverview,
  prepRows,
  prepTabs,
  provenanceOptions,
  provenanceText,
  questionKindOptions,
  questionRows,
  reviewKindOptions,
  revisionRows,
  transferRows,
  transitionNeedsConfirm
} from '../components/casework/sections/sectionRows.js';
import { COPY_PHASE, flushPendingAudits, queuePendingAudit, runCopyForStar2 } from '../components/casework/transferFlow.js';
import {
  PROVENANCES,
  STAR2_REVIEW_KINDS,
  STAR2_TRANSFER_STATES,
  STAR2_TRANSFER_TRANSITIONS
} from '../lib/workspaces/provenance.js';

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
/* Kellaaeg lühikujul: päev, kuu, kahekohaline aasta ja kell. Testi kuupäevad on
   kõik 2026. aasta oktoobris; tund sõltub masina ajavööndist. */
const SHORT_TIME = /^\d{2}\.10\.26, \d{2}:\d{2}$/;

/* Sektsioonid (andmed ja päringud), nende vaated ja reeglid. */
const SECTIONS = [
  '../components/casework/MeetingPrepSection.jsx',
  '../components/casework/MeetingNoteSection.jsx',
  '../components/casework/MeetingAudioSection.jsx',
  '../components/casework/DraftSection.jsx',
  '../components/casework/TransferPanel.jsx'
];
const VIEWS = [
  '../components/casework/sections/SectionBits.jsx',
  '../components/casework/sections/PrepViews.jsx',
  '../components/casework/sections/NoteViews.jsx',
  '../components/casework/sections/DraftViews.jsx'
];
const SOURCES = [
  ...SECTIONS,
  ...VIEWS,
  '../components/casework/sections/sectionRows.js',
  '../components/casework/sections/useSectionData.js',
  '../components/casework/transferFlow.js'
];
const RAW_ENUMS = new RegExp(
  `\\b(${[...PROVENANCES, ...STAR2_TRANSFER_STATES, ...STAR2_REVIEW_KINDS, ...NOTE_LAYER_ORDER, ...DRAFT_TYPE_ORDER, ...QUESTION_KINDS, 'COPIED_FOR_STAR2', 'MARKED_AS_TRANSFERRED', 'CORRECTION', 'RETRACTION'].join('|')})\\b`
);

/* Teenuskihti ei impordita (ta toob Prisma kliendi): loeme sõnastiku failist. */
function serverKeys(path, name) {
  const source = read(path);
  const start = source.indexOf(`${name} = Object.freeze({`);
  assert.ok(start >= 0, `${name} on failis ${path}`);
  const block = source.slice(start, source.indexOf('})', start));
  return [...block.matchAll(/^\s*([A-Z_0-9]+):/gm)].map((match) => match[1]);
}
function serverNumber(path, name) {
  const match = read(path).match(new RegExp(`const ${name} = (\\d+);`));
  assert.ok(match, `${name} on failis ${path}`);
  return Number(match[1]);
}

/* JSX-i avav silt koos atribuutidega (ka mitmel real). */
const openingTags = (source, name) => [...source.matchAll(new RegExp(`<${name}\\b[^>]*?(?:=>[^>]*?)*>`, 'gs'))].map((match) => match[0]);

test('vaadete tekstivõtmed on kataloogis kolmes keeles', () => {
  const keys = new Set();
  for (const source of SOURCES) {
    /* Kõik täielikud võtmed, ka tingimuslause sees. Mallisõnega kokku pandud
       võtmed kontrollib järgmine test. */
    for (const match of read(source).matchAll(/"(casework\.[A-Za-z0-9_.]*[A-Za-z0-9])"/g)) keys.add(match[1]);
  }
  assert.ok(keys.size > 100, `võtmeid leiti ${keys.size}`);
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual([...keys].filter((key) => typeof at(messages, key) !== 'string'), [], lang);
  }
});

test('võtmed, mida leht loendist kokku paneb, on kõik olemas', () => {
  const keys = [
    ...PREP_TABS.map((key) => `casework.prep.tabs.${key}`),
    ...PREP_FIELD_KEYS.map((key) => `casework.prep.field_${key}`),
    ...QUESTION_KINDS.flatMap((key) => [`casework.prep.kind_${key}`, `casework.prep.add_kind_${key}`]),
    ...NOTE_TABS.map((key) => `casework.note.tabs.${key}`),
    ...NOTE_LAYER_ORDER.map((key) => `casework.note.layer_${key}`),
    ...serverKeys('../lib/casework/caseWorkMeetingNote.js', 'NOTE_REVISION_KIND').map((key) => `casework.note.revision_kind_${key}`),
    ...DRAFT_TABS.map((key) => `casework.draft.tabs.${key}`),
    ...DRAFT_TYPE_ORDER.map((key) => `casework.draft.type_${key}`),
    ...[...STAR2_TRANSFER_STATES, ...STAR2_REVIEW_KINDS].map((key) => `casework.star2.${key}`),
    ...serverKeys('../lib/casework/caseWorkTransfer.js', 'TRANSFER_EVENT_KIND').map((key) => `casework.transfer.kind_${key}`),
    ...PROVENANCES.map((key) => `casework.provenance.${key}`),
    ...['title', 'short', 'summary', 'summary_recording'].map((key) => `casework.page.parts.audio.${key}`)
  ];
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual(keys.filter((key) => typeof at(messages, key) !== 'string'), [], lang);
  }
});

test('igal sakil on nimi, mis mahub lahtrisse, ja täisnimi ekraanilugejale', () => {
  const prep = { fields: [], questions: [] };
  for (const lang of LANGS) {
    const messages = catalog(lang);
    const tr = (key) => (typeof at(messages, key) === 'string' ? at(messages, key) : key);
    const tabs = [
      ...prepTabs(prep, { t: tr }),
      ...noteTabs({ entries: [] }, [], { t: tr }),
      ...draftTabs({ fields: [] }, { t: tr })
    ];
    assert.equal(tabs.length, PREP_TABS.length + NOTE_TABS.length + DRAFT_TABS.length);
    for (const tab of tabs) {
      assert.ok(tab.label && !tab.label.includes('casework.'), `${lang}: saki ${tab.key} nimi`);
      assert.ok(tab.label.length <= 18, `${lang}: saki ${tab.key} nimi „${tab.label}” on kuni 18 märki`);
      assert.ok(tab.title && !tab.title.includes('casework.'), `${lang}: saki ${tab.key} täisnimi`);
    }
    /* Uus juhtumi osa (kohtumise heli): nimi ja lühinimi kiirmenüü jaoks. */
    const audio = messages.casework.page.parts.audio;
    assert.ok(audio.title && audio.short && audio.short.length <= 18, `${lang}: osa audio`);
    for (const [key, marks] of [
      ['casework.prep.overview_fields', ['{filled}', '{total}']],
      ['casework.prep.overview_questions', ['{count}']],
      ['casework.prep.overview_ai_pending', ['{count}']],
      ['casework.prep.content_purged', ['{date}']],
      ['casework.note.revision_count', ['{count}']],
      ['casework.draft.purge_due_at', ['{date}']]
    ]) {
      for (const mark of marks) assert.ok(at(messages, key).includes(mark), `${lang}: ${key} kannab ${mark}`);
    }
  }
});

test('loendid, mis peavad serveriga kokku minema, lähevad kokku', () => {
  assert.deepEqual([...PREP_FIELD_KEYS], serverKeys('../lib/casework/caseWorkMeetingPrep.js', 'PREP_FIELD_KEY'));
  assert.deepEqual([...QUESTION_KINDS], serverKeys('../lib/casework/caseWorkMeetingPrep.js', 'QUESTION_KIND'));
  /* Kihtide JÄRJEKORD on tähendusega: kliendi sõnad ees, privaatne refleksioon lõpus. */
  assert.deepEqual([...NOTE_LAYER_ORDER], serverKeys('../lib/casework/caseWorkMeetingNote.js', 'NOTE_LAYER'));
  assert.equal(NOTE_LAYER_ORDER.at(-1), PRIVATE_LAYER);
  assert.deepEqual([...DRAFT_TYPE_ORDER], serverKeys('../lib/casework/caseWorkDraft.js', 'DRAFT_TYPE'));
  assert.deepEqual([...REVIEW_KINDS], [...STAR2_REVIEW_KINDS]);

  /* Lubatud siirded: sama kaart mis olekumasinal, MIINUS `ULE_KANTUD` (L19):
     sinna viib ainult „Märgi üle kantuks". */
  assert.deepEqual(Object.keys(ALLOWED_TRANSITIONS), Object.keys(STAR2_TRANSFER_TRANSITIONS));
  for (const [state, targets] of Object.entries(STAR2_TRANSFER_TRANSITIONS)) {
    assert.deepEqual([...ALLOWED_TRANSITIONS[state]], targets.filter((value) => value !== 'ULE_KANTUD'), state);
  }
  assert.ok(Object.values(ALLOWED_TRANSITIONS).every((targets) => !targets.includes('ULE_KANTUD')));

  /* AI mustandi kinnitamise sihid: kõik peale masina märgise enda. */
  assert.deepEqual([...CONFIRM_TARGETS], PROVENANCES.filter((value) => value !== 'AI_MUSTAND'));
  assert.ok(!confirmTargetOptions(t).some((option) => option.value === 'AI_MUSTAND'));
  assert.deepEqual(provenanceOptions(t).map((option) => option.value), [...PROVENANCES]);
});

test('väljade pikkused ja võtme vihje lubavad ainult seda, mida server vastu võtab', () => {
  const views = VIEWS.map(read).join('\n');
  const limits = [...views.matchAll(/maxLength=\{(\d+)\}/g)].map((match) => Number(match[1]));
  const allowed = new Set([
    serverNumber('../lib/casework/caseWorkMeetingPrep.js', 'TEXT_MAX'),
    serverNumber('../lib/casework/caseWorkMeetingNote.js', 'TEXT_MAX'),
    serverNumber('../lib/casework/caseWorkDraft.js', 'TEXT_MAX'),
    serverNumber('../lib/casework/caseWorkMeetingNote.js', 'REASON_MAX'),
    serverNumber('../lib/casework/caseWorkDraft.js', 'FIELD_KEY_MAX')
  ]);
  assert.ok(limits.length >= 6, `pikkuse piire leiti ${limits.length}`);
  assert.deepEqual(limits.filter((limit) => !allowed.has(limit)), []);
  /* Tagasivõtmise põhjus ja välja võti kannavad oma, lühemat piiri. */
  const notes = read('../components/casework/sections/NoteViews.jsx');
  assert.ok(notes.includes(`maxLength={${serverNumber('../lib/casework/caseWorkMeetingNote.js', 'REASON_MAX')}}`));
  const drafts = read('../components/casework/sections/DraftViews.jsx');
  assert.ok(drafts.includes(`maxLength={${serverNumber('../lib/casework/caseWorkDraft.js', 'FIELD_KEY_MAX')}}`));

  /* Vihje näidisvõti peab ise läbima serveri kuju kontrolli (varem oli kohatäiteks
     koodi kirjutatud eestikeelne sõna ja täpitähega võti lükati tagasi ilma selgituseta). */
  const shape = read('../lib/casework/caseWorkDraft.js').match(/const FIELD_KEY_SHAPE = \/(.+)\/;/);
  assert.ok(shape, 'välja võtme kuju on teenuskihis');
  for (const lang of LANGS) {
    const hint = catalog(lang).casework.draft.field_key_hint;
    const example = hint.match(/([A-Z][A-Z0-9_]+)\.$/);
    assert.ok(example, `${lang}: vihje lõpeb näidisvõtmega`);
    assert.ok(new RegExp(shape[1]).test(example[1]), `${lang}: näidisvõti ${example[1]} sobib serverile`);
  }
  assert.ok(!/placeholder="[A-ZÄÖÜÕ]/.test(drafts), 'koodi kirjutatud näidisvõtit ei ole');
});

test('uue rea saab saata alles siis, kui tekst on kirjutatud ja päritolu valitud', () => {
  assert.equal(canAddRow({ text: 'Tekst', provenance: 'KLIENDI_OELDUD' }), true);
  assert.equal(canAddRow({ text: '   ', provenance: 'KLIENDI_OELDUD' }), false);
  /* Päritolul ei ole vaikeväärtust (L4): tühi ja tundmatu väärtus ei lähe läbi. */
  assert.equal(canAddRow({ text: 'Tekst', provenance: '' }), false);
  assert.equal(canAddRow({ text: 'Tekst', provenance: 'MIDAGI' }), false);
  assert.equal(canAddDraftField({ fieldKey: 'EESMARK', text: 'Tekst', provenance: 'DOKUMENDIST' }), true);
  assert.equal(canAddDraftField({ fieldKey: ' ', text: 'Tekst', provenance: 'DOKUMENDIST' }), false);
  /* Olemasoleva välja päritolu ei küsita: seda teksti salvestamine ei muuda. */
  assert.equal(canSavePrepField({ text: 'Uus tekst', saved: true, provenance: '' }), true);
  assert.equal(canSavePrepField({ text: 'Uus tekst', saved: false, provenance: '' }), false);
  assert.equal(canSavePrepField({ text: 'Uus tekst', saved: false, provenance: 'TOOTAJA_TAHELEPANEK' }), true);
  assert.equal(canSavePrepField({ text: '', saved: true, provenance: 'TOOTAJA_TAHELEPANEK' }), false);
  assert.equal(isAiDraft('AI_MUSTAND'), true);
  assert.equal(isAiDraft('KLIENDI_OELDUD'), false);
  assert.equal(provenanceText('MIDAGI', t), 'Tundmatu info päritolu.');
});

test('ettevalmistus: read, sakid, ülevaade ja väli ütlevad seisu sõnadega', () => {
  const rows = prepRows(
    [
      { id: 'p1', meetingAt: '2026-10-12T09:00:00Z' },
      { id: 'p2', meetingAt: null, contentPurgedAt: '2026-10-01T00:00:00Z' },
      { meetingAt: '2026-10-12T09:00:00Z' },
      null
    ],
    context
  );
  assert.deepEqual(rows.map((row) => [row.id, row.purged]), [['p1', false], ['p2', true]]);
  /* Kellaaeg on lühikujul (päev, kuu, aasta kahe numbriga, kell). */
  assert.match(rows[0].title, SHORT_TIME);
  assert.equal(rows[1].title, 'Aeg kokku leppimata');
  assert.deepEqual(prepRows(undefined, context), []);

  const prep = {
    id: 'p1',
    meetingAt: null,
    fields: [
      { fieldKey: 'GOAL', text: 'Selgitada toetuse tingimusi', provenance: 'TOOTAJA_TAHELEPANEK' },
      { fieldKey: 'AGENDA', text: 'Masina pakutud päevakord', provenance: 'AI_MUSTAND' }
    ],
    questions: [
      { id: 'q1', kind: 'CLARIFYING_QUESTION', text: '<i>Kas elab üksi?</i>', provenance: 'AI_MUSTAND' },
      { id: 'q2', kind: 'UUS_LIIK', text: 'Väide', provenance: 'KLIENDI_OELDUD' },
      { kind: 'CLAIM_TO_VERIFY', text: 'ilma tunnuseta' }
    ]
  };
  const tabs = Object.fromEntries(prepTabs(prep, context).map((tab) => [tab.key, tab]));
  assert.deepEqual(Object.keys(tabs), [...PREP_TABS]);
  assert.deepEqual([tabs.GOAL.state, tabs.GOAL.pending], ['done', false]);
  assert.deepEqual([tabs.AGENDA.state, tabs.AGENDA.pending], ['done', true]);
  assert.deepEqual([tabs.LIFE_DOMAINS.state, tabs.LIFE_DOMAINS.pending], ['empty', false]);
  assert.deepEqual([tabs.questions.count, tabs.questions.pending], [3, true]);
  assert.equal(tabs.GOAL.title, 'Kohtumise eesmärk');

  const overview = prepOverview(prep, context);
  assert.equal(overview.fields, 'Täidetud välju: 2/5');
  assert.equal(overview.questions, 'Küsimusi ja väiteid: 3');
  assert.equal(overview.pending, 'Kinnitamata AI mustandeid: 2');
  assert.equal(overview.purged, '');
  assert.equal(overview.time, 'Aeg kokku leppimata');
  const purged = prepOverview({ contentPurgedAt: '2026-10-01T00:00:00Z', fields: [], questions: [] }, context);
  assert.match(purged.purged, /2026/);
  assert.ok(!purged.purged.includes('{') && purged.pending === '');

  const saved = prepFieldModel(prep, 'AGENDA', context);
  assert.deepEqual([saved.saved, saved.ai, saved.provenance, saved.provenanceText], [true, true, 'AI_MUSTAND', 'AI mustand']);
  assert.equal(saved.savedText, 'Masina pakutud päevakord');
  const empty = prepFieldModel(prep, 'LIFE_DOMAINS', context);
  assert.deepEqual([empty.saved, empty.ai, empty.provenance, empty.savedText], [false, false, '', '']);
  assert.equal(prepFieldText(prep, 'GOAL'), 'Selgitada toetuse tingimusi');
  assert.equal(prepFieldText(null, 'GOAL'), '');

  const questions = questionRows(prep, context);
  assert.deepEqual(questions.map((row) => [row.id, row.kindText, row.provenanceText, row.ai]), [
    ['q1', 'Täpsustav küsimus', 'AI mustand', true],
    ['q2', 'Tundmatu küsimuse liik.', 'Kliendi öeldu', false]
  ]);
  /* Tekst on tekst: märgistus jääb märkideks, keegi seda ei tõlgenda ega lühenda. */
  assert.equal(questions[0].text, '<i>Kas elab üksi?</i>');
  assert.deepEqual(questionKindOptions(t).map((option) => option.value), [...QUESTION_KINDS]);
  for (const row of questions) assert.ok(!RAW_ENUMS.test(`${row.kindText} ${row.provenanceText}`), row.id);
});

test('märge: kihid on sakkidena, tagasi võetud rida jääb loendisse ilma tekstita', () => {
  const rows = noteRows([{ id: 'n1', meetingAt: null, meetingPrepId: 'p1' }, { id: 'n2', meetingAt: '2026-10-12T09:00:00Z' }, {}], context);
  assert.deepEqual(rows.map((row) => [row.id, row.linkedPrep]), [['n1', true], ['n2', false]]);
  assert.equal(rows[0].title, 'Aeg märkimata');

  const note = {
    entries: [
      { id: 'e1', layer: 'FAKTID', text: 'Elab üksi', provenance: 'KLIENDI_OELDUD', revision: 1, retractedAt: null },
      { id: 'e2', layer: 'FAKTID', text: null, provenance: 'DOKUMENDIST', revision: 3, retractedAt: '2026-10-09T10:00:00Z' },
      { id: 'e3', layer: 'PRIVAATNE_REFLEKSIOON', text: 'Minu mõte', provenance: 'MIDAGI', revision: 2, retractedAt: null },
      { layer: 'FAKTID', text: 'ilma tunnuseta' }
    ]
  };
  const tabs = Object.fromEntries(noteTabs(note, [{ id: 'r1' }], context).map((tab) => [tab.key, tab]));
  assert.deepEqual(Object.keys(tabs), [...NOTE_TABS]);
  assert.equal(Object.keys(tabs).at(-1), 'history');
  assert.equal(tabs.FAKTID.state, 'done');
  assert.equal(tabs.KOKKULEPPED.state, 'empty');
  assert.equal(tabs.history.state, 'done');
  assert.equal(noteTabs(note, [], context).at(-1).state, 'empty');
  /* Kiht, mille ainus rida on tagasi võetud, ei ole „täidetud”. */
  assert.equal(noteTabs({ entries: [note.entries[1]] }, [], context).find((tab) => tab.key === 'FAKTID').state, 'empty');

  const facts = entryRows(note, 'FAKTID', context);
  assert.deepEqual(facts.map((row) => [row.id, row.retracted, row.text, row.provenanceText, row.revised]), [
    ['e1', false, 'Elab üksi', 'Kliendi öeldu', ''],
    ['e2', true, '', 'Dokumendist', 'parandatud 2 korda']
  ]);
  const reflection = entryRows(note, 'PRIVAATNE_REFLEKSIOON', context);
  assert.deepEqual([reflection[0].provenanceText, reflection[0].revised], ['Tundmatu info päritolu.', 'parandatud 1 korda']);
  assert.deepEqual(entryRows(note, 'KOKKULEPPED', context), []);

  const history = revisionRows(
    [
      { id: 'r1', kind: 'RETRACTION', layer: 'FAKTID', text: 'Vana tekst', reason: 'Vale klient', createdAt: '2026-10-09T10:00:00Z' },
      { id: 'r2', kind: 'UUS_LIIK', layer: 'UUS_KIHT', text: 'Tekst', reason: 'Põhjus', createdAt: 'vigane' },
      { kind: 'CORRECTION' }
    ],
    context
  );
  assert.deepEqual(history.map((row) => [row.id, row.kindText, row.layerText, row.text, row.reason]), [
    ['r1', 'Tagasivõtmine', 'Faktilised asjaolud', 'Vana tekst', 'Vale klient'],
    ['r2', 'Tundmatu liik', 'Tundmatu märkme kiht.', 'Tekst', 'Põhjus']
  ]);
  assert.match(history[0].time, SHORT_TIME);
  /* Vigane aeg ei jõua ekraanile („Invalid Date”). */
  assert.equal(history[1].time, '');
  for (const row of history) assert.ok(!RAW_ENUMS.test(`${row.kindText} ${row.layerText}`), row.id);
});

test('STAR2 järjekord: read ja päis kannavad sõnu; salvestamata jälg on real näha', () => {
  const drafts = [
    { id: 'd1', draftType: 'TEGEVUS', transferState: 'VAJAB_KONTROLLI', reviewKind: 'KLIENDIGA' },
    { id: 'd2', draftType: 'UUS_TYYP', transferState: 'UUS_SEIS', reviewKind: 'UUS_VIIS' },
    { draftType: 'TEGEVUS' }
  ];
  const rows = draftRows(drafts, { t, pendingAudits: { d2: [{ clientActionId: 'k1' }], d1: [] } });
  assert.deepEqual(rows.map((row) => [row.id, row.title, row.state, row.tone, row.review, row.pending]), [
    ['d1', 'Tegevus', 'Vajab kontrollimist', 'wait', 'Kliendiga', false],
    ['d2', 'Tundmatu mustandi tüüp.', 'Tundmatu ülekande seis.', 'quiet', 'Tundmatu kontrollimise viis.', true]
  ]);
  assert.equal(draftRows(drafts, { t })[0].pending, false);
  for (const row of rows) assert.ok(!RAW_ENUMS.test(`${row.title} ${row.state} ${row.review}`), row.id);

  assert.deepEqual(draftHead({ draftType: 'KOHTUMISE_MARGE', transferState: 'VALMIS_ULEKANDEKS' }, context), {
    title: 'Kohtumise märge',
    state: 'Valmis kandmiseks',
    tone: 'ok',
    review: ''
  });
  assert.deepEqual(draftTypeOptions(t).map((option) => option.value), [...DRAFT_TYPE_ORDER]);
  assert.deepEqual(draftTabs({ fields: [{ fieldKey: 'A' }, { fieldKey: 'B' }] }, context).map((tab) => [tab.key, tab.count]), [
    ['fields', 2],
    ['state', undefined],
    ['transfer', undefined]
  ]);
  /* Salvestamata jälg paneb märgi STAR2-sse viimise sakile: hoiatus ei jää teise saki taha. */
  assert.equal(draftTabs({ fields: [] }, context).at(-1).pending, false);
  assert.equal(draftTabs({ fields: [] }, { t, pendingAudits: 2 }).at(-1).pending, true);

  /* Välja võti on töötaja enda antud nimi: see jääb reale samal kujul, mis läheb STAR2 plokki. */
  const fields = draftFieldRows({ fields: [{ fieldKey: 'EESMARK', text: '<b>Tekst</b>', provenance: 'DOKUMENDIST' }, { text: 'võtmeta' }] }, context);
  assert.deepEqual(fields, [{ key: 'EESMARK', text: '<b>Tekst</b>', provenance: 'DOKUMENDIST', provenanceText: 'Dokumendist' }]);
});

test('seisu vaade pakub ainult lubatud siirdeid; „Ei kanta” küsib teist vajutust', () => {
  const draft = draftStateModel({ transferState: 'MUSTAND' }, context);
  assert.deepEqual(draft.targets, [
    { value: 'VAJAB_KONTROLLI', label: 'Vajab kontrollimist' },
    { value: 'EI_KANTA', label: 'Ei kanta' }
  ]);
  assert.deepEqual([draft.terminal, draft.awaitingMark, draft.transferredAt, draft.purgeDue], [false, false, '', '']);

  /* `ULE_KANTUD` ei ole valik ka siis, kui element on kandmiseks valmis (L19). */
  const ready = draftStateModel({ transferState: 'VALMIS_ULEKANDEKS' }, context);
  assert.deepEqual(ready.targets.map((option) => option.value), ['EI_KANTA']);
  assert.equal(ready.awaitingMark, true);

  const transferred = draftStateModel(
    { transferState: 'ULE_KANTUD', transferredAt: '2026-10-09T10:00:00Z', purgeDueAt: '2027-10-09T00:00:00Z', contentPurgedAt: null },
    context
  );
  assert.deepEqual([transferred.terminal, transferred.targets.length, transferred.stateText], [true, 0, 'STAR2-sse kantud']);
  assert.match(transferred.transferredAt, SHORT_TIME);
  assert.match(transferred.purgeDue, /2027/);
  assert.ok(!transferred.purgeDue.includes('{'));
  /* Kui sisu on juba kustunud, kustumise kuupäeva enam ei lubata. */
  assert.equal(draftStateModel({ transferState: 'ULE_KANTUD', purgeDueAt: '2027-10-09T00:00:00Z', contentPurgedAt: '2027-10-10T00:00:00Z' }, context).purgeDue, '');
  /* Tundmatu seis on kinni: vorm, mis ei tea, kuhu minna, ei paku midagi. */
  const unknown = draftStateModel({ transferState: 'UUS_SEIS' }, context);
  assert.deepEqual([unknown.terminal, unknown.targets.length, unknown.stateText], [true, 0, 'Tundmatu ülekande seis.']);

  for (const state of STAR2_TRANSFER_STATES) {
    assert.equal(isTerminalState(state), STAR2_TRANSFER_TRANSITIONS[state].length === 0, state);
  }
  assert.equal(asksReviewKind('VAJAB_KONTROLLI'), true);
  assert.equal(asksReviewKind('KONTROLLITUD'), false);
  /* Kontrollimise viis on vabatahtlik: esimene valik jätab selle määramata. */
  assert.deepEqual(reviewKindOptions(t).map((option) => option.value), ['', ...REVIEW_KINDS]);
  assert.ok(reviewKindOptions(t).every((option) => option.label && !option.label.includes('casework.')));
  assert.equal(transitionNeedsConfirm('EI_KANTA'), true);
  assert.equal(transitionNeedsConfirm('VAJAB_KONTROLLI'), false);
  assert.equal(transitionNeedsConfirm('VALMIS_ULEKANDEKS'), false);
  assert.equal(transitionNeedsConfirm(''), false);
});

test('ülekandeajalugu: tegu ja tüüp sõnadena, väljade võtmed eraldi loendina', () => {
  const rows = transferRows(
    [
      { id: 'e1', kind: 'COPIED_FOR_STAR2', draftType: 'TEGEVUS', createdAt: '2026-10-09T10:00:00Z', fieldKeys: ['EESMARK', 'TAHTAEG'] },
      { id: 'e2', kind: 'UUS_TEGU', draftType: 'UUS_TYYP', createdAt: null, fieldKeys: null },
      { kind: 'MARKED_AS_TRANSFERRED' }
    ],
    context
  );
  assert.deepEqual(rows.map((row) => [row.id, row.title, row.keys]), [
    ['e1', 'Kopeeritud STAR2 jaoks · Tegevus', ['EESMARK', 'TAHTAEG']],
    ['e2', 'Tundmatu liik', []]
  ]);
  assert.match(rows[0].time, SHORT_TIME);
  assert.equal(rows[1].time, '');
  for (const row of rows) assert.ok(!RAW_ENUMS.test(row.title) && !row.title.includes('casework.'), row.id);
});

test('kopeerimise järjekord: plokk, lõikelaud ja ALLES SIIS jälg (L16)', async () => {
  const calls = [];
  const block = { text: 'HOIATUS\n\nEESMARK: tekst', fieldKeys: ['EESMARK'], contentHash: 'h1' };
  const steps = (overrides = {}) => ({
    createActionKey: () => {
      calls.push('key');
      return 'k1';
    },
    loadBlock: async () => {
      calls.push('block');
      return block;
    },
    writeClipboard: async (text) => {
      calls.push(`clipboard:${text.length}`);
      return true;
    },
    recordCopy: async (input) => {
      calls.push(`audit:${input.clientActionId}:${input.contentHash}:${input.fieldKeys.join('+')}`);
    },
    ...overrides
  });

  const copied = await runCopyForStar2(steps());
  /* Võti sünnib enne kõike muud (L22) ja audit alles pärast lõikelauda. */
  assert.deepEqual(calls, ['key', 'block', `clipboard:${block.text.length}`, 'audit:k1:h1:EESMARK']);
  assert.deepEqual([copied.phase, copied.errorKey, copied.pendingAudit], [COPY_PHASE.COPIED, null, null]);

  /* Lõikelaud keeldus: auditit EI kirjutata, plokk jääb käsitsi kopeerimiseks. */
  calls.length = 0;
  const refused = await runCopyForStar2(steps({ writeClipboard: async () => false }));
  assert.deepEqual(calls, ['key', 'block']);
  assert.deepEqual([refused.phase, refused.block, refused.pendingAudit], [COPY_PHASE.CLIPBOARD_FAILED, block, null]);

  /* Lõikelaud võttis, audit ei: jälg jääb ootele SAMA võtme ja sama sõrmejäljega. */
  const failed = await runCopyForStar2(steps({ recordCopy: async () => Promise.reject({ messageKey: 'casework.errors.conflict' }) }));
  assert.equal(failed.phase, COPY_PHASE.AUDIT_FAILED);
  assert.equal(failed.errorKey, 'casework.errors.conflict');
  assert.deepEqual(failed.pendingAudit, { fieldKeys: ['EESMARK'], clientActionId: 'k1', contentHash: 'h1' });

  /* Tühi element: lõikelauale ei kirjutata midagi ja teade on pinna oma sõnadega. */
  calls.length = 0;
  const empty = await runCopyForStar2(steps({ loadBlock: async () => ({ text: 'HOIATUS', fieldKeys: [], contentHash: 'h0' }) }));
  assert.deepEqual(calls, ['key']);
  assert.deepEqual([empty.phase, empty.errorKey, empty.pendingAudit], [COPY_PHASE.EMPTY, 'casework.transfer.copy_empty', null]);
  for (const lang of LANGS) assert.equal(typeof at(catalog(lang), empty.errorKey), 'string', lang);

  const broken = await runCopyForStar2(steps({ loadBlock: async () => Promise.reject(new Error('võrk')) }));
  assert.deepEqual([broken.phase, broken.errorKey, broken.block], [COPY_PHASE.LOAD_FAILED, 'casework.errors.unexpected', null]);
});

test('ootel jäljed on järjekord: sama võti ei korda, korduskatse käib lõpuni (SOL-CW-05)', async () => {
  const first = { fieldKeys: ['A'], clientActionId: 'k1', contentHash: 'h1' };
  const second = { fieldKeys: ['B'], clientActionId: 'k2', contentHash: 'h2' };
  let queue = queuePendingAudit([], first);
  queue = queuePendingAudit(queue, second);
  assert.deepEqual(queue, [first, second]);
  /* Sama võti ei satu kaks korda järjekorda; tühi kirje ei muuda midagi. */
  assert.equal(queuePendingAudit(queue, { ...first }), queue);
  assert.equal(queuePendingAudit(queue, null), queue);
  assert.deepEqual(queuePendingAudit(null, first), [first]);

  /* Esimese vea peale ei peatuta: iga kirje kannab oma võtit. */
  const sent = [];
  const result = await flushPendingAudits(queue, async (entry) => {
    sent.push(entry.clientActionId);
    if (entry.clientActionId === 'k1') throw { messageKey: 'casework.errors.transfer_block_stale' };
  });
  assert.deepEqual(sent, ['k1', 'k2']);
  assert.deepEqual(result, { remaining: [first], flushed: 1, errorKey: 'casework.errors.transfer_block_stale' });
  assert.deepEqual(await flushPendingAudits([], async () => {}), { remaining: [], flushed: 0, errorKey: null });
});

test('pöördumatu tegu küsib teist vajutust ega käivitu otse nupust', () => {
  const bits = read('../components/casework/sections/SectionBits.jsx');
  /* Teine vajutus tuleb ühisest nupust (ConfirmButton: klahvikordus ja topeltklõps ei läbi mõlemat astet). */
  assert.ok(bits.includes('<ConfirmButton') && bits.includes('as={Button}'));
  const views = VIEWS.map(read).join('\n');
  for (const call of [
    'onConfirm={remove.onConfirm}',
    'onConfirm={retract.onConfirm}',
    'onConfirm={model.onMark}',
    'onConfirm={onTransition}'
  ]) {
    assert.ok(views.includes(call), `kahe vajutusega: ${call}`);
  }
  assert.ok(!/onClick=\{[^}]*\b(remove|retract)\.onConfirm\b/.test(views), 'eemaldamine ja tagasivõtmine ei käivitu otse vajutusest');
  assert.ok(!/onClick=\{[^}]*\bmodel\.onMark\b/.test(views), 'ülekantuks märkimine ei käivitu otse vajutusest');
  /* Iga kaheastmeline nupp on seotud oma sihiga: poolik kinnitus ei kandu teise rea nupule. */
  assert.equal((views.match(/<TwoStep\b/g) || []).length, (views.match(/<TwoStep\s+key=/g) || []).length);

  /* Sektsioonid annavad teod vaadetele ainult `onConfirm` kaudu. */
  const prep = read('../components/casework/MeetingPrepSection.jsx');
  assert.ok(prep.includes('onConfirm: onDelete') && prep.includes('actions.removeQuestion(openQuestion.id)'));
  /* Arhiveeritud sisuga ettevalmistust ei kustutata (O-JTA-6) ja sinna ei lisata. */
  assert.ok(prep.includes('remove: purged ? null') && /add: purged\s*\?\s*null/.test(prep));
  const note = read('../components/casework/MeetingNoteSection.jsx');
  assert.ok(note.includes('actions.retractEntry(openEntry.id, reason.trim())'));
  /* Tagasivõtmine vajab põhjust ENNE kinnitust: nupp on kinni, kuni see on kirjutatud. */
  assert.ok(note.includes('disabled: locked || busy || !reason.trim()'));
  const draft = read('../components/casework/DraftSection.jsx');
  assert.ok(draft.includes('needsConfirm: transitionNeedsConfirm(chosen)'));
  /* Märkmel ja mustandil kustutamist ei ole: märge on kohtumise jälg, mustand ahela lüli. */
  for (const source of [note, draft]) assert.ok(!/method: "DELETE", locale \}\)/.test(source.replace(/\/fields\?[^\n]*\n?/g, '')));
});

test('vaated hoiavad oma lubadusi: sakirida jääb paigale, väli ei lähe salvestamise ajaks kinni', () => {
  const sections = SECTIONS.map(read);
  const views = VIEWS.map(read);
  const all = [...sections, ...views].join('\n');

  /* Teated ilma status-rollita (ühine kiht joonistab selle kastina), vana kihti ega rippvalikuid ei ole. */
  assert.ok(!all.includes('role="status"'));
  assert.ok(!/["'`\s]cw-[a-z]/.test(all), 'vana cw-* kihti ei ole');
  assert.ok(!/<select|<option|<h2\b|<h3\b|dangerouslySetInnerHTML/.test(all));

  /* Avatud kirje vaated on kirjeldused, mille joonistab üks ja sama komponent:
     saki vahetus ei võta sakirida maha ja fookus jääb vajutatud sakile. */
  for (const path of ['MeetingPrepSection', 'MeetingNoteSection', 'DraftSection']) {
    const source = read(`../components/casework/${path}.jsx`);
    assert.equal((source.match(/<OpenView\b/g) || []).length, 1, `${path}: üks OpenView`);
    assert.ok(source.includes('return <OpenView {...screen()} />;'), path);
    /* Avatud kirje on võtmega komponent: kirjes A pooleli tekst ei lähe kirje B alla. */
    assert.ok(/<(Prep|Note|Draft)Editor\s+key=\{open(Prep|Note|Draft)\.id\}/.test(source), `${path}: avatud kirje on võtmega`);
    /* Aegunud vastus ei kirjuta värskemat üle ja suletud kirjet ei avata uuesti. */
    assert.ok(/if \(requested(Prep|Note|Draft)Id\.current !== (prep|note|draft)Id\) return;/.test(source), path);
    assert.ok(/requested(Prep|Note|Draft)Id\.current === open(Prep|Note|Draft)Id/.test(source), path);
  }

  /* Fookust ei viida kunagi nupule: all hoitud Enter vajutaks seda kohe. */
  const bits = views[0];
  const focus = bits.slice(bits.indexOf('export function useSwapFocus'), bits.indexOf('export function blockRepeatEnter'));
  assert.ok(focus.includes('[data-autofocus] textarea') && focus.includes('[data-step-heading]') && !focus.includes('button'));

  /* Väljad jäävad päringu ajaks lahti (keelamine viskaks fookuse minema): välja
     keelab ainult lukk, topeltvajutuse eest kaitseb `run()`. */
  for (const source of views) {
    for (const name of ['Input', 'TextAreaField', 'ChoiceRow', 'ProvenanceChoice', 'Textarea']) {
      for (const tag of openingTags(source, name)) {
        const disabled = tag.match(/disabled=\{([^}]*)\}/);
        if (disabled) assert.ok(!/busy|working/.test(disabled[1]), `${name}: ${disabled[0]}`);
      }
    }
  }
  const data = read('../components/casework/sections/useSectionData.js');
  assert.ok(data.includes('if (busyRef.current) return null;'), 'teine vajutus samal ajal ei tee teist päringut');

  /* Põhinupu helk on oma joonistuspind ja lava hoiab kõik osad alles: iga
     põhinupp saab teada, kas tema osa on ees. */
  for (const source of [...sections, ...views]) {
    for (const tag of openingTags(source, 'Button')) {
      if (tag.includes('variant="primary"') || tag.includes('? "primary"')) assert.ok(/\bglow=\{/.test(tag), tag.replace(/\s+/g, ' '));
    }
  }
  assert.ok(views[2].includes('buttonProps={{ size: "sm", variant: "primary", glow }}'), 'salvesti nupp saab sama märgi');

  /* Märk, mille mudel paneb, jõuab ka vaatesse. */
  assert.ok(sections[0].includes('row.purged ?') && sections[1].includes('row.linkedPrep ?') && sections[3].includes('row.pending ?'));
  assert.ok(bits.includes('data-state={tab.state}') && bits.includes('tab.pending ?') && bits.includes('tab.count ?'));
  assert.ok(views[1].includes('row.ai ?') && views[2].includes('row.retracted ?') && views[2].includes('row.revised ?'));

  /* Kinnitamise siht ei ole ette valitud ja kinnitada ei saa enne valikut (L4). */
  assert.ok(sections[0].includes('const [confirmTo, setConfirmTo] = useState("");'));
  assert.ok(bits.includes('disabled={locked || busy || !value}'));
  /* Kirjutuskaitstud juhtumis on ülekantuks märkimine väljas. Kopeerida saab (server lubab seda
     teadlikult: seda teeb töötaja enne arhiveerimist); arhiveeritud juhtumis on ka kopeerimine väljas. */
  assert.ok(sections[3].includes('disabled: locked || busy,'));
  assert.ok(sections[3].includes('copyDisabled: archived || busy,'));
  /* Kopeerimise ootel jäljed elavad sektsioonis, mitte avatud elemendi juures. */
  assert.ok(sections[3].includes('const [pendingAudits, setPendingAudits] = useState({});'));
  assert.ok(sections[3].includes('transfer.pendingCount ? <Chip tone="wait">'), 'salvestamata jälg on näha elemendi päises');
  assert.ok(!/useState\([^)]*\)[^\n]*pendingAudits/.test(sections[4]), 'ülekandeteod ei hoia järjekorda ise');
});

test('juhtumi lava annab sektsioonidele juhtumi seisu ja kohtumise heli on oma osa', () => {
  const detail = read('../components/casework/CaseWorkDetail.jsx');
  for (const name of ['MeetingPrepSection', 'MeetingNoteSection', 'MeetingAudioSection', 'DraftSection']) {
    const tag = openingTags(detail, name)[0] || '';
    assert.ok(tag.includes('locked={!isActive}') && tag.includes('caseBusy={busy}') && tag.includes('active={active}'), name);
  }
  /* Sektsioon joonistab oma vaated ise: raam ei mähi neid enam ühte paneeli. */
  assert.ok(!detail.includes('StepPanel'));
  assert.ok(detail.includes('const active = flight?.isActive !== false;'));
  assert.ok(detail.includes('onLinked={refreshLinkedItems}') && detail.includes('onRecording={setRecording}'));
  /* Salvestit ennast ei muudeta: vaade annab talle nupu ja klassid ning loeb seisu juurelemendilt. */
  const noteViews = read('../components/casework/sections/NoteViews.jsx');
  assert.ok(noteViews.includes('ButtonComponent={Button}') && noteViews.includes('classNames={RECORDER_CLASSES}'));
  assert.ok(noteViews.includes('[data-recorder-phase]') && read('../components/documents/SessionRecorder.jsx').includes('data-recorder-phase={phase}'));
  /* Sidumise tõrge ja seoste loendi värskendamise tõrge on eri asjad. */
  const audio = read('../components/casework/MeetingAudioSection.jsx');
  assert.ok(audio.indexOf('setNoticeKey("casework.note.audio_linked")') < audio.indexOf('await onLinked?.()'));
});
