// Mentorlussuhte leht ja mentorluse haldus: read, otsused ja tekstid.
//
// Mõlemad lehed olid pikad veerud tumeda kaardi sees. Suhe on nüüd osadena sammulaval
// (components/mentoring/relation), haldus loend ja avatud kirje (components/mentoring/admin).
// Test hoiab seda, mida silm kergesti ei märka: puuduv tõlkevõti, nimeta vaade, toores
// serveri kood ekraanil, ühe vajutusega lõplik tegevus, nupp, mida server selles seisus ei
// luba, ja märk, mis mudelist vaateni ei jõua.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CANDIDATE_PREVIEW_LENGTH,
  CLOSE_REASON_CHOICES,
  CLOSE_REASON_WORDS,
  EMPTY_MEETING,
  LIST_CAPS,
  MEETING_MODES,
  RELATION_PART_KEYS,
  RELATION_WORDS,
  TEXT_LIMIT,
  TIMER_CLOSE_REASONS,
  agreementModel,
  candidateRows,
  closeLists,
  closeReasonText,
  closedLine,
  excerpt,
  goalDirty,
  meetingBody,
  meetingRows,
  meetingsEmptyText,
  noteRows,
  preparationRows,
  progressLine,
  relationHead,
  relationPartKeys,
  relationParts,
  relationWord,
  summaryRows
} from '../components/mentoring/relation/relationRows.js';
import {
  ADMIN_GROUPS,
  CONSENT_CHOICES,
  CONSENT_WORDS,
  EVIDENCE_REF_LIMIT,
  EVIDENCE_TYPES,
  EVIDENCE_WORDS,
  EXTERNAL_CAP,
  QUEUE_CAP,
  REVIEW_REASON_KEYS,
  capNote,
  consentBody,
  consentFilterOptions,
  consentForm,
  consentOptions,
  consentWord,
  counterCells,
  evidenceOptions,
  externalRecordModel,
  externalRows,
  filterExternal,
  groupOptions,
  importSummary,
  queueChip,
  queueProfileModel,
  queueRows,
  reasonOptions,
  rejectReason
} from '../components/mentoring/admin/adminRows.js';
import {
  MENTOR_CONSENT_STATUS,
  MENTORING_CLOSE_REASONS,
  MENTORING_LIMITS,
  MENTORING_MEETING_MODE,
  MENTORING_MEETING_STATUS,
  MENTORING_SUMMARY_STATUS
} from '../lib/mentoring/constants.js';
import { MENTOR_CONSENT_EVIDENCE_TYPES } from '../lib/mentoring/profilePolicy.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const LANGS = ['et', 'en', 'ru'];
const RELATION_PAGE = '../components/mentoring/MentoringRelationPage.jsx';
const ADMIN_PAGE = '../components/mentoring/AdminMentoringPage.jsx';
const RELATION_VIEWS = '../components/mentoring/relation/RelationViews.jsx';
const ADMIN_VIEWS = '../components/mentoring/admin/AdminViews.jsx';
const DESK_PARTS = '../components/mentoring/desk/DeskParts.jsx';
const PAGES = [RELATION_PAGE, ADMIN_PAGE];
const VIEWS = [RELATION_VIEWS, ADMIN_VIEWS, DESK_PARTS];
const SOURCES = [...PAGES, ...VIEWS, '../components/mentoring/relation/relationRows.js', '../components/mentoring/admin/adminRows.js'];
const STYLES = [
  '../components/mentoring/relation/relation.module.css',
  '../components/mentoring/admin/admin.module.css',
  '../components/mentoring/desk/desk.module.css'
];

/* Tõlkija, mis näitab, mis võtmega ja mis muutujatega teksti küsiti. */
const t = (key, vars) => (vars ? `[${key} ${Object.entries(vars).map(([name, value]) => `${name}=${value}`).join(' ')}]` : `[${key}]`);
const formatDate = (value) => (value ? `aeg:${String(value).slice(0, 16)}` : '');
const formatDay = (value) => (value ? `kp:${String(value).slice(0, 10)}` : '');
const context = { t, formatDate, formatDay };

function literalKeys() {
  const keys = new Set();
  for (const source of SOURCES) {
    /* Ainult täielikud võtmed: mallisõnega kokku pandud võtmed kontrollivad järgmised testid. */
    for (const match of read(source).matchAll(/\bt\(\s*"(mentoring\.[a-z_.0-9]+)"/g)) keys.add(match[1]);
  }
  return keys;
}

/* Võtmed, mille leht paneb kokku loendist (osa nimi, seisu sõna, põhjus, tõendi liik). */
function builtKeys() {
  const keys = [];
  for (const part of RELATION_PART_KEYS) keys.push(`mentoring.relation.views.${part}.title`, `mentoring.relation.views.${part}.short`);
  for (const [kind, codes] of Object.entries(RELATION_WORDS)) for (const entry of Object.values(codes)) keys.push(`mentoring.${kind}.${entry.key}`);
  for (const reason of CLOSE_REASON_WORDS) keys.push(`mentoring.close_reason.${reason}`);
  for (const entry of Object.values(CONSENT_WORDS)) keys.push(`mentoring.consent_status.${entry.key}`);
  for (const word of Object.values(EVIDENCE_WORDS)) keys.push(`mentoring.admin.consent_evidence.${word}`);
  for (const reason of REVIEW_REASON_KEYS) keys.push(`mentoring.review_reason.${reason}`);
  for (const group of ADMIN_GROUPS) keys.push(`mentoring.admin.views.${group}.title`);
  return keys;
}

const openRelation = (extra = {}) => ({
  id: 'r1',
  position: 'mentee',
  status: 'ACTIVE',
  goalSummary: 'Õppida keerulisi vestlusi juhtima',
  agreementText: 'Kohtume kord kuus.',
  agreementVersion: 2,
  myAgreementAccepted: true,
  otherAgreementAccepted: true,
  mentor: { name: 'Mari Mentor', deleted: false },
  mentee: { name: 'Mina Ise', deleted: false },
  lastActivityAt: '2026-10-01T10:00:00Z',
  version: 7,
  meetings: [],
  summaries: [],
  notes: [],
  preparations: [],
  commonRooms: [],
  can: { editShared: true, proposeAgreement: true, acceptAgreement: false, pause: true, resume: false, close: true, createMeeting: true, createSummary: true, addNote: true, handoffPreparation: true },
  ...extra
});

test('vaadete tekstivõtmed on kataloogis kolmes keeles ja kannavad samu kohatäitjaid', () => {
  const keys = [...literalKeys(), ...builtKeys()];
  assert.ok(literalKeys().size > 200, `võtmeid leiti ${literalKeys().size}`);
  const marks = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(',');
  const source = catalog('et');
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual(keys.filter((key) => typeof at(messages, key) !== 'string'), [], lang);
    assert.deepEqual(keys.filter((key) => marks(at(messages, key)) !== marks(at(source, key))), [], `${lang}: kohatäitjad`);
  }
});

test('eestikeelsetes tekstides ei ole mõttekriipsu, sirgeid jutumärke ega serveri koode', () => {
  const messages = catalog('et');
  const keys = [...literalKeys(), ...builtKeys()];
  assert.deepEqual(keys.filter((key) => /[—–"]/.test(at(messages, key))), []);
  /* Suurtähtedega sõna tekstis on kas nimi (ESTA) või ekraanile jõudnud kood (PENDING_CONSENT). */
  assert.deepEqual(keys.filter((key) => /[A-ZÕÄÖÜ]{4,}/.test(String(at(messages, key)).replace(/\bESTA\b/g, ''))), []);
});

test('suhte igal osal on nimi ja lühinimi kiirmenüü jaoks; halduse vaadetel on pealkiri', () => {
  for (const lang of LANGS) {
    const mentoring = catalog(lang).mentoring;
    for (const key of RELATION_PART_KEYS) {
      const view = mentoring.relation.views[key];
      assert.ok(view?.title && view?.short, `${lang}: ${key}`);
      assert.ok(view.short.length <= 18, `${lang}: ${key} lühinimi mahub kiirmenüüsse`);
    }
    /* Laia vaate nimi seisab samuti kiirmenüüs. */
    assert.ok(mentoring.relation.all_parts && mentoring.relation.all_parts.length <= 18, `${lang}: laia vaate nimi`);
    for (const key of ['queue', 'external', 'profile', 'record']) assert.ok(mentoring.admin.views[key]?.title, `${lang}: halduse vaade ${key}`);
  }
});

test('sõnaloendid katavad kõik koodid, mida server võib saata', () => {
  assert.deepEqual(Object.keys(RELATION_WORDS.meeting_status).sort(), Object.values(MENTORING_MEETING_STATUS).sort());
  assert.deepEqual(Object.keys(RELATION_WORDS.meeting_mode).sort(), Object.values(MENTORING_MEETING_MODE).sort());
  assert.deepEqual(Object.keys(RELATION_WORDS.summary_status).sort(), Object.values(MENTORING_SUMMARY_STATUS).sort());
  assert.deepEqual([...CLOSE_REASON_WORDS].sort(), [...MENTORING_CLOSE_REASONS].sort());
  assert.deepEqual([...MEETING_MODES].sort(), Object.values(MENTORING_MEETING_MODE).sort());
  assert.deepEqual(Object.keys(CONSENT_WORDS).sort(), Object.values(MENTOR_CONSENT_STATUS).sort());
  assert.deepEqual([...EVIDENCE_TYPES].sort(), [...MENTOR_CONSENT_EVIDENCE_TYPES].sort());
  /* Valikud, mida inimene saab teha, on serveri lubatud väärtuste hulgas. */
  for (const reason of [...CLOSE_REASON_CHOICES, ...TIMER_CLOSE_REASONS]) assert.ok(MENTORING_CLOSE_REASONS.includes(reason), reason);
  assert.ok(!CLOSE_REASON_CHOICES.some((reason) => TIMER_CLOSE_REASONS.includes(reason)), 'platvormi põhjust inimene valida ei saa');
  for (const status of CONSENT_CHOICES) assert.ok(Object.values(MENTOR_CONSENT_STATUS).includes(status), status);
});

test('tundmatu kood ei jõua ekraanile ei sõna ega toore koodina', () => {
  assert.deepEqual(relationWord('meeting_status', 'held', t), { text: '[mentoring.meeting_status.held]', tone: 'ok' });
  assert.deepEqual(relationWord('summary_status', 'SOMETHING_NEW', t), { text: '', tone: 'quiet' });
  assert.deepEqual(relationWord('meeting_mode', undefined, t), { text: '', tone: 'quiet' });
  assert.equal(closeReasonText('completed', t), '[mentoring.close_reason.completed]');
  assert.equal(closeReasonText('made_up', t), '');
  assert.deepEqual(consentWord('consented', t), { text: '[mentoring.consent_status.consented]', tone: 'ok' });
  assert.deepEqual(consentWord('NEW_STATE', t), { text: '', tone: 'quiet' });
  const [meeting] = meetingRows([{ id: 'm1', occurredAt: '2026-10-09T09:00:00Z', status: 'SOMETHING_NEW', mode: 'TELEPATHY' }], context);
  assert.deepEqual([meeting.chip, meeting.time, meeting.canAct], ['', '', false]);
  const [record] = externalRows([{ id: 'x1', displayName: 'A', consentStatus: 'NEW_STATE' }], context);
  assert.equal(record.chip, '');
  assert.equal(relationHead(openRelation({ status: 'NEW_STATE' }), t).chip.text, '');
});

test('suhte osad: lõppenud suhtel ei ole eesmärke ega tühja kokkulepet; ettevalmistus on siis, kui seal on midagi', () => {
  assert.deepEqual(relationPartKeys(openRelation()), [...RELATION_PART_KEYS]);
  /* Mentor näeb ettevalmistuse osa alles siis, kui mentee on midagi jaganud. */
  const mentor = openRelation({ position: 'mentor', can: { ...openRelation().can, handoffPreparation: false } });
  assert.ok(!relationPartKeys(mentor).includes('preparation'));
  assert.ok(relationPartKeys({ ...mentor, preparations: [{ id: 'p1', own: false, sharedAt: '2026-10-01T00:00:00Z' }] }).includes('preparation'));
  const closedCan = { editShared: false, proposeAgreement: false, acceptAgreement: false, pause: false, resume: false, close: false, createMeeting: false, createSummary: false, addNote: true, handoffPreparation: false };
  assert.deepEqual(relationPartKeys(openRelation({ status: 'CLOSED', goalSummary: null, can: closedCan })), ['agreement', 'meetings', 'summaries', 'notes', 'state']);
  assert.deepEqual(relationPartKeys(openRelation({ status: 'CLOSED', goalSummary: null, agreementText: null, can: closedCan })), ['meetings', 'summaries', 'notes', 'state']);
  /* Kokkuleppe ootel suhtes on kokkuleppe osa olemas ka ilma tekstita: seal esitatakse esimene versioon. */
  assert.ok(relationPartKeys(openRelation({ status: 'DRAFT', agreementText: null })).includes('agreement'));
});

test('ülevaate plaadil on esimene rida või tühjuse põhjus, mitte ridade arv', () => {
  const full = relationParts({
    relation: openRelation({
      meetings: [
        { id: 'm2', occurredAt: '2026-11-20T09:00:00Z', status: 'PLANNED', mode: 'EXTERNAL' },
        { id: 'm1', occurredAt: '2026-11-05T09:00:00Z', status: 'PLANNED', mode: 'EXTERNAL' },
        { id: 'm0', occurredAt: '2026-09-05T09:00:00Z', status: 'HELD', mode: 'EXTERNAL' }
      ],
      summaries: [{ id: 's1', content: 'Rääkisime piiridest', status: 'PENDING_CONFIRM', myConfirmation: false, createdByMe: false }],
      notes: [{ id: 'n1', content: 'Küsi järgmine kord supervisiooni kohta', updatedAt: '2026-10-02T00:00:00Z' }],
      preparations: [{ id: 'p1', own: true, content: 'Minu ettevalmistus', canShare: true }]
    }),
    candidates: [],
    ...context
  });
  assert.deepEqual(full.map((part) => part.key), [...RELATION_PART_KEYS]);
  for (const part of full) assert.ok(part.label && part.short && part.summary, part.key);
  const byKey = Object.fromEntries(full.map((part) => [part.key, part]));
  assert.equal(byKey.goal.summary, 'Õppida keerulisi vestlusi juhtima');
  assert.equal(byKey.agreement.summary, '[mentoring.relation.views.agreement.summary_both]');
  /* Plaanitud kohtumistest näidatakse varaseimat, mitte loendi esimest. */
  assert.equal(byKey.meetings.summary, '[mentoring.relation.views.meetings.summary_planned date=aeg:2026-11-05T09:00]');
  assert.equal(byKey.summaries.summary, '[mentoring.relation.views.summaries.chip_confirm]');
  /* Privaatse teksti algust ülevaate plaadil ei ole: seal on ainult seis ja päev. */
  assert.equal(byKey.preparation.summary, '[mentoring.relation.views.preparation.chip_private]');
  assert.equal(byKey.notes.summary, '[mentoring.relation.views.notes.summary_last date=kp:2026-10-02]');
  const overview = JSON.stringify(full);
  assert.ok(!overview.includes('Minu ettevalmistus') && !overview.includes('supervisiooni kohta'));
  assert.equal(byKey.state.summary, '[mentoring.relation_status.active]');
  assert.ok(!/\d/.test(full.map((part) => part.summary.replace(/\[[^\]]*\]/g, '')).join('')), 'plaatidel ei ole loendureid');
  /* Tekst ja loendid võivad olla pikad: nende järgi lava ühist kõrgust ei võeta. */
  assert.deepEqual(full.filter((part) => !part.free).map((part) => part.key), ['goal', 'state']);

  const empty = relationParts({ relation: openRelation({ goalSummary: null, agreementText: null }), candidates: [], ...context });
  assert.deepEqual(empty.map((part) => part.state), ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'partial']);
  assert.deepEqual(empty.slice(0, 6).map((part) => part.summary), [
    '[mentoring.relation.views.goal.summary_empty]',
    '[mentoring.relation.views.agreement.summary_none]',
    '[mentoring.relation.views.meetings.summary_empty]',
    '[mentoring.relation.summaries_empty]',
    '[mentoring.relation.views.preparation.summary_empty]',
    '[mentoring.relation.views.notes.summary_empty]'
  ]);
  const withCandidate = relationParts({ relation: openRelation(), candidates: [{ id: 'd1', preview: 'x' }], ...context });
  assert.equal(withCandidate.find((part) => part.key === 'preparation').summary, '[mentoring.relation.views.preparation.summary_candidates]');
  const sealed = relationParts({
    relation: openRelation({ position: 'mentor', preparations: [{ id: 'p1', own: false, sharedAt: '2026-10-01T00:00:00Z', sharedContent: null }] }),
    ...context
  });
  assert.equal(sealed.find((part) => part.key === 'preparation').summary, '[mentoring.relation.preparation_new_from_mentee]');
});

test('päis ja lõpetaja: automaatselt lõppenud suhte kohta ei öelda, et selle lõpetas teine pool', () => {
  assert.deepEqual(relationHead(openRelation(), t), {
    who: '[mentoring.home.relation_as_mentee name=Mari Mentor]',
    chip: { text: '[mentoring.relation_status.active]', tone: 'ok' },
    reason: ''
  });
  const asMentor = relationHead(openRelation({ position: 'mentor', mentee: { name: null, deleted: true } }), t);
  assert.equal(asMentor.who, '[mentoring.home.relation_as_mentor name=[mentoring.labels.deleted_user]]');
  const closed = openRelation({ status: 'CLOSED', closedAt: '2026-10-05T12:00:00Z', closeReasonKey: 'completed' });
  assert.equal(relationHead(closed, t).reason, '[mentoring.close_reason.completed]');
  assert.equal(closedLine({ ...closed, closedByMe: true }, context), '[mentoring.relation.views.state.ended_by_me date=aeg:2026-10-05T12:00]');
  assert.equal(closedLine({ ...closed, closedByMe: false }, context), '[mentoring.relation.views.state.ended_by_other name=Mari Mentor date=aeg:2026-10-05T12:00]');
  for (const reason of TIMER_CLOSE_REASONS) {
    assert.equal(closedLine({ ...closed, closedByMe: false, closeReasonKey: reason }, context), '[mentoring.relation.views.state.ended_by_timer date=aeg:2026-10-05T12:00]', reason);
  }
  assert.equal(closedLine({ ...closed, closedAt: null, closedByMe: true }, context), '[mentoring.relation.views.state.ended_by_me date=[mentoring.labels.unknown_time]]');
  const progress = progressLine(openRelation({ meetings: [{ status: 'HELD' }, { status: 'PLANNED' }], summaries: [{ status: 'CONFIRMED' }, { status: 'DRAFT' }] }), context);
  assert.equal(progress, '[mentoring.relation.progress_line meetings=1 summaries=1 date=aeg:2026-10-01T10:00]');
});

test('eesmärgid ja kokkulepe: muudatus, kinnitused ja see, mida selles seisus teha saab', () => {
  assert.equal(goalDirty('  tekst ', 'tekst'), false);
  assert.equal(goalDirty('', null), false);
  assert.equal(goalDirty('uus', 'vana'), true);
  const both = agreementModel(openRelation(), t);
  assert.deepEqual([both.hasText, both.version, both.mine.tone, both.other.tone, both.canAccept, both.canPropose], [true, '[mentoring.relation.agreement_version version=2]', 'ok', 'ok', false, true]);
  const waitingMe = agreementModel(openRelation({ myAgreementAccepted: false, can: { ...openRelation().can, acceptAgreement: true } }), t);
  assert.deepEqual([waitingMe.mine.text, waitingMe.canAccept, waitingMe.summary], ['[mentoring.relation.views.agreement.mine_no]', true, '[mentoring.relation.views.agreement.summary_mine]']);
  assert.equal(agreementModel(openRelation({ otherAgreementAccepted: false }), t).summary, '[mentoring.relation.views.agreement.summary_other]');
  const none = agreementModel(openRelation({ agreementText: null, can: { ...openRelation().can, acceptAgreement: true } }), t);
  /* Ilma tekstita ei ole midagi kinnitada, ka siis, kui serveri lipp ütleks teisiti. */
  assert.deepEqual([none.hasText, none.version, none.canAccept, none.summary], [false, '', false, '[mentoring.relation.views.agreement.summary_none]']);
});

test('kohtumised: plaanitud kohtumist saab muuta ainult lõpetamata suhtes; vorm annab sama sisu mis enne', () => {
  const meetings = [
    { id: 'm 1', occurredAt: '2026-11-05T09:00:00Z', status: 'PLANNED', mode: 'PLATFORM_ROOM', roomId: 'room 1', topicSummary: 'Esimene\nkohtumine', version: 3 },
    { id: 'm2', occurredAt: null, status: 'HELD', mode: 'EXTERNAL', topicSummary: null, version: 1 },
    { status: 'PLANNED' }
  ];
  const rows = meetingRows(meetings, context);
  assert.equal(rows.length, 2, 'tunnuseta kirjet ei näidata');
  assert.deepEqual(
    [rows[0].title, rows[0].text, rows[0].topic, rows[0].chip, rows[0].tone, rows[0].time, rows[0].roomId, rows[0].version, rows[0].canAct],
    ['aeg:2026-11-05T09:00', 'Esimene kohtumine', 'Esimene\nkohtumine', '[mentoring.meeting_status.planned]', 'wait', '[mentoring.meeting_mode.platform_room]', 'room 1', 3, true]
  );
  assert.deepEqual([rows[1].title, rows[1].text, rows[1].canAct, rows[1].roomId], ['[mentoring.labels.unknown_time]', '', false, '']);
  assert.equal(meetingRows(meetings, { ...context, closed: true })[0].canAct, false);

  assert.equal(meetingBody(EMPTY_MEETING), null);
  assert.deepEqual(meetingBody({ occurredAt: '2026-11-05T09:00', mode: 'EXTERNAL', roomId: 'jäi eelmisest valikust', topicSummary: 'Teema' }), {
    occurredAt: new Date('2026-11-05T09:00').toISOString(),
    mode: 'EXTERNAL',
    roomId: null,
    topicSummary: 'Teema'
  });
  assert.equal(meetingBody({ occurredAt: '2026-11-05T09:00', mode: 'PLATFORM_ROOM', roomId: '' }), null, 'platvormi ruumi kohtumine vajab ruumi');
  assert.equal(meetingBody({ occurredAt: '2026-11-05T09:00', mode: 'PLATFORM_ROOM', roomId: 'r1', topicSummary: '' }).roomId, 'r1');
  assert.equal(meetingBody({ occurredAt: 'pole kuupäev', mode: 'EXTERNAL' }), null);

  /* Tühja loendi lause ei kutsu lisama seal, kus lisada ei saa. */
  assert.equal(meetingsEmptyText(openRelation(), t), '[mentoring.relation.views.meetings.empty_can_add]');
  const noAdd = { ...openRelation().can, createMeeting: false };
  assert.equal(meetingsEmptyText(openRelation({ status: 'DRAFT', can: noAdd }), t), '[mentoring.relation.views.meetings.empty_draft]');
  assert.equal(meetingsEmptyText(openRelation({ status: 'PAUSED', can: noAdd }), t), '[mentoring.relation.views.meetings.empty_paused]');
  assert.equal(meetingsEmptyText(openRelation({ status: 'CLOSED', can: noAdd }), t), '[mentoring.relation.views.meetings.empty_closed]');
});

test('kokkuvõtted: pooleli ees, kinnitatud taga; tegevus ilmub ainult seal, kus server seda lubab', () => {
  const summaries = [
    { id: 'c1', content: 'Kinnitatud', status: 'CONFIRMED', confirmedAt: '2026-09-01T00:00:00Z', version: 4 },
    { id: 'd1', content: 'Minu mustand', status: 'DRAFT', createdByMe: true, version: 1 },
    { id: 'x1', content: 'Kõrvale jäetud', status: 'DISCARDED' },
    { id: 'p1', content: 'Ootab mind', status: 'PENDING_CONFIRM', myConfirmation: false, version: 2 },
    { id: 'p2', content: 'Ootab teist', status: 'PENDING_CONFIRM', myConfirmation: true, version: 2 },
    { id: 'd2', content: 'Teise mustand', status: 'DRAFT', createdByMe: false, version: 1 },
    { id: 'c0', content: 'Vana', status: 'CONFIRMED', supersededById: 'c1', confirmedAt: '2026-08-01T00:00:00Z' }
  ];
  const rows = summaryRows(summaries, context);
  assert.deepEqual(rows.map((row) => row.id), ['d1', 'p1', 'p2', 'd2', 'c1', 'c0']);
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
  assert.deepEqual([byId.d1.canSubmit, byId.d1.canDiscard, byId.d1.canConfirm, byId.d1.canCorrect, byId.d1.othersDraft], [true, true, false, false, false]);
  assert.deepEqual([byId.d2.canSubmit, byId.d2.canDiscard, byId.d2.othersDraft], [false, true, true]);
  assert.deepEqual([byId.p1.chip, byId.p1.tone, byId.p1.canConfirm, byId.p1.needsMe], ['[mentoring.relation.views.summaries.chip_confirm]', 'wait', true, true]);
  assert.deepEqual([byId.p2.chip, byId.p2.tone, byId.p2.canConfirm, byId.p2.canDiscard], ['[mentoring.relation.summary_waiting_other]', 'quiet', false, true]);
  assert.deepEqual([byId.c1.chip, byId.c1.time, byId.c1.canCorrect, byId.c1.canDiscard, byId.c1.extra], ['[mentoring.summary_status.confirmed]', 'kp:2026-09-01', true, false, '']);
  /* Asendatud kokkuvõtet ei saa enam parandada. */
  assert.deepEqual([byId.c0.canCorrect, byId.c0.extra], [false, '[mentoring.relation.summary_superseded]']);
  assert.equal(byId.d1.text, 'Minu mustand');
  /* Lõppenud suhtes saab kokkuvõtteid ainult lugeda. */
  for (const row of summaryRows(summaries, { ...context, closed: true })) {
    assert.deepEqual([row.canSubmit, row.canConfirm, row.canDiscard, row.canCorrect, row.othersDraft, row.needsMe], [false, false, false, false, false, false], row.id);
  }
});

test('ettevalmistus: mentee jagab ise ja ainult käimas suhtes; mentor näeb teksti alles pärast avamist', () => {
  const own = [
    { id: 'a', own: true, content: 'Privaatne tekst', canShare: true, canRecall: false },
    { id: 'b', own: true, content: 'Jagatud', sharedAt: '2026-10-01T08:00:00Z', canShare: false, canRecall: true },
    { id: 'c', own: true, content: 'Avatud', sharedAt: '2026-10-01T08:00:00Z', openedAt: '2026-10-02T08:00:00Z', canShare: false, canRecall: false },
    { id: 'd', own: true, content: 'Tagasi võetud', sharedAt: '2026-10-01T08:00:00Z', recalledAt: '2026-10-01T09:00:00Z', canShare: true, canRecall: false },
    null
  ];
  const rows = preparationRows(own, { ...context, position: 'mentee', running: true });
  assert.deepEqual(rows.map((row) => [row.id, row.chip, row.tone]), [
    ['a', '[mentoring.relation.views.preparation.chip_private]', 'quiet'],
    ['b', '[mentoring.relation.views.preparation.chip_shared]', 'wait'],
    ['c', '[mentoring.relation.views.preparation.chip_opened]', 'ok'],
    ['d', '[mentoring.relation.views.preparation.chip_private]', 'quiet']
  ]);
  assert.deepEqual(rows.map((row) => [row.canShare, row.canRecall, row.canOpen, row.sealed]), [
    [true, false, false, false],
    [false, true, false, false],
    [false, false, false, false],
    [true, false, false, false]
  ]);
  assert.equal(rows[1].statusLine, '[mentoring.relation.preparation_shared date=aeg:2026-10-01T08:00]');
  assert.equal(rows[2].statusLine, '[mentoring.relation.preparation_opened date=aeg:2026-10-02T08:00]');
  assert.equal(rows[3].statusLine, '[mentoring.relation.preparation_private]');
  /* Serveri lipp `canShare` ei vaata suhte seisu, jagamine aga vaatab: lõppenud suhtes nuppu ei ole. */
  assert.ok(preparationRows(own, { ...context, position: 'mentee', running: false }).every((row) => !row.canShare));

  const shared = [
    { id: 'n', own: false, sharedAt: '2026-10-03T08:00:00Z', sharedContent: null, openedAt: null },
    { id: 'o', own: false, sharedAt: '2026-10-01T08:00:00Z', sharedContent: 'Mentee tekst', openedAt: '2026-10-02T08:00:00Z' }
  ];
  const mentorRows = preparationRows(shared, { ...context, position: 'mentor', running: true });
  assert.deepEqual([mentorRows[0].sealed, mentorRows[0].canOpen, mentorRows[0].text, mentorRows[0].tone], [true, true, '[mentoring.relation.preparation_new_from_mentee]', 'wait']);
  assert.equal(mentorRows[0].statusLine, '[mentoring.relation.views.preparation.shared_to_you date=aeg:2026-10-03T08:00]');
  assert.deepEqual([mentorRows[1].sealed, mentorRows[1].canOpen, mentorRows[1].text], [false, false, 'Mentee tekst']);
  assert.equal(mentorRows[1].statusLine, '[mentoring.relation.views.preparation.opened_by_you date=aeg:2026-10-02T08:00]');
  assert.ok(mentorRows.every((row) => !row.canShare && !row.canRecall));
});

test('Tööheaolu tekstid, märkmed ja rea algus', () => {
  const candidates = candidateRows([{ id: 'd1', preview: 'a'.repeat(CANDIDATE_PREVIEW_LENGTH), updatedAt: '2026-10-01T00:00:00.000Z' }, { id: 'd2', preview: 'lühike' }, { preview: 'tunnuseta' }]);
  assert.deepEqual(candidates.map((row) => [row.id, row.cut]), [['d1', true], ['d2', false]]);
  assert.equal(candidates[0].updatedAt, '2026-10-01T00:00:00.000Z', 'versioonikontrolli aeg läheb toomisega kaasa');
  assert.deepEqual(noteRows([{ id: 'n1', content: 'Märge', updatedAt: '2026-10-02T10:00:00Z' }, null], context), [{ id: 'n1', text: 'Märge', time: 'kp:2026-10-02' }]);
  assert.equal(excerpt('  mitu\n\nrida   teksti '), 'mitu rida teksti');
  assert.equal(excerpt('x'.repeat(200)).length, 90);
  assert.equal(excerpt(null), '');
});

test('lõpetamise ülevaade: arvud tulevad serverist ja eesmärkide rida on ainult siis, kui eesmärgid on kirjas', () => {
  const lists = closeLists({ keeps: { confirmedSummaries: 2, meetingFacts: 5, myPrivateNotes: 1 }, purges: { unconfirmedSummaries: 3, goalSummary: true } }, t);
  assert.deepEqual(lists.keeps, [
    '[mentoring.relation.close_keep_summaries count=2]',
    '[mentoring.relation.close_keep_meetings count=5]',
    '[mentoring.relation.close_keep_agreements]',
    '[mentoring.relation.close_keep_notes count=1]'
  ]);
  assert.deepEqual(lists.purges, ['[mentoring.relation.close_purge_drafts count=3]', '[mentoring.relation.close_purge_goal]', '[mentoring.relation.close_purge_topics]']);
  assert.equal(closeLists({ purges: { goalSummary: false } }, t).purges.length, 2);
  assert.equal(closeLists(null, t).keeps[0], '[mentoring.relation.close_keep_summaries count=0]');
});

test('lehe piirid on samad mis serveris', () => {
  const service = read('../lib/mentoring/relationService.js');
  const loader = service.slice(service.indexOf('export async function getMentoringRelation'), service.indexOf('export async function updateMentoringGoal'));
  const takeAfter = (marker, from = 0) => {
    const start = loader.indexOf(marker, from);
    assert.ok(start >= 0, marker);
    return Number(loader.slice(start).match(/take: (\d+)/)[1]);
  };
  const notesAt = loader.indexOf('db.mentoringPrivateNote.findMany');
  assert.deepEqual(LIST_CAPS, {
    meetings: takeAfter('db.mentoringMeeting.findMany'),
    summaries: takeAfter('db.mentoringSummary.findMany'),
    notes: takeAfter('db.mentoringPrivateNote.findMany'),
    preparations: takeAfter('db.mentoringPrivateNote.findMany', notesAt + 1)
  });
  assert.equal(TEXT_LIMIT, MENTORING_LIMITS.MAX_TEXT);
  assert.match(read('../lib/mentoring/preparationService.js'), new RegExp(`\\.slice\\(0, ${CANDIDATE_PREVIEW_LENGTH}\\)`));

  const admin = read('../lib/mentoring/adminService.js');
  const queue = admin.slice(admin.indexOf('export async function listMentorModerationQueue'), admin.indexOf('export async function listExternalMentorRecords'));
  const external = admin.slice(admin.indexOf('export async function listExternalMentorRecords'), admin.indexOf('async function loadProfile'));
  assert.equal(QUEUE_CAP, Number(queue.match(/take: (\d+)/)[1]));
  assert.equal(EXTERNAL_CAP, Number(external.match(/take: (\d+)/)[1]));
  assert.equal(EVIDENCE_REF_LIMIT, MENTORING_LIMITS.MAX_SHORT_TEXT);
  const reasons = admin.slice(admin.indexOf('const REVIEW_REASONS'), admin.indexOf(']);', admin.indexOf('const REVIEW_REASONS')));
  assert.deepEqual([...reasons.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]), [...REVIEW_REASON_KEYS]);
  /* Tekst lubab ainult seda, mida server teeb: kataloogis näha oleva kirje kontroll ei tohi olla vanem. */
  for (const lang of LANGS) assert.ok(catalog(lang).mentoring.admin.external_help.includes(String(MENTORING_LIMITS.STALE_EXTERNAL_MONTHS)), lang);
  /* Pausil suhtesse kohtumisi lisada ei saa (`createMeeting` on ainult aktiivsel suhtel): tekst ütleb sama. */
  assert.match(read('../lib/mentoring/serializers.js'), /createMeeting: relation\.status === "ACTIVE"/);
});

test('halduse arvud, read ja loendi lagi', () => {
  assert.deepEqual(counterCells(null, t), []);
  const counters = { activeProfiles: 3, pendingReview: 1, externalRecords: 17, consentedExternal: 2, openRelations: 4 };
  assert.deepEqual(counterCells(counters, t).map((cell) => [cell.key, cell.value]), [['active', '3'], ['pending', '1'], ['external', '2/17'], ['relations', '4']]);
  for (const cell of counterCells(counters, t)) assert.ok(cell.label.startsWith('[mentoring.admin.counter_'), cell.key);

  const queue = queueRows([{ id: 'q 1', displayName: 'Mari', title: 'Spetsialist', organization: 'Tartu LV', updatedAt: '2026-10-01T00:00:00Z' }, { id: 'q2', displayName: 'Jaan' }, {}], context);
  assert.deepEqual(queue, [
    { id: 'q 1', title: 'Mari', text: 'Spetsialist · Tartu LV', chip: '', tone: 'quiet', time: '[mentoring.admin.row_updated date=aeg:2026-10-01T00:00]' },
    { id: 'q2', title: 'Jaan', text: '', chip: '', tone: 'quiet', time: '' }
  ]);

  const records = [
    { id: 'x1', displayName: 'Anu', consentStatus: 'PENDING_CONSENT' },
    { id: 'x2', displayName: 'Bert', consentStatus: 'CONSENTED', checkedAt: '2026-09-01T00:00:00Z' },
    { id: 'x3', displayName: 'Cia', consentStatus: 'PENDING_CONSENT' }
  ];
  const rows = externalRows(records, context);
  assert.deepEqual(rows.map((row) => [row.id, row.chip, row.tone, row.time]), [
    ['x1', '[mentoring.consent_status.pending_consent]', 'wait', ''],
    ['x2', '[mentoring.consent_status.consented]', 'ok', '[mentoring.admin.views.record.checked date=aeg:2026-09-01T00:00]'],
    ['x3', '[mentoring.consent_status.pending_consent]', 'wait', '']
  ]);
  /* Filtris on „kõik” ja ainult need seisud, mis loendis päriselt on. */
  assert.deepEqual(consentFilterOptions(records, t).map((option) => option.value), ['all', 'PENDING_CONSENT', 'CONSENTED']);
  assert.deepEqual(consentFilterOptions(records.slice(0, 1), t).map((option) => option.value), ['all', 'PENDING_CONSENT']);
  assert.deepEqual(filterExternal(rows, 'CONSENTED').map((row) => row.id), ['x2']);
  assert.equal(filterExternal(rows, 'all').length, 3);
  assert.equal(filterExternal(rows, 'made_up').length, 3);

  assert.equal(capNote('queue', 5, counters, t), '');
  assert.equal(capNote('queue', QUEUE_CAP, { pendingReview: 130 }, t), `[mentoring.admin.queue_capped count=${QUEUE_CAP} total=130]`);
  assert.equal(capNote('queue', QUEUE_CAP, { pendingReview: QUEUE_CAP }, t), '', 'täpselt lae suurune loend on tervik');
  assert.equal(capNote('external', EXTERNAL_CAP, { externalRecords: 420 }, t), `[mentoring.admin.external_capped count=${EXTERNAL_CAP} total=420]`);
  assert.equal(capNote('external', 17, counters, t), '');
});

test('halduse avatud kirje: terve profiil, tagasilükkamise põhjus ja nõusoleku vorm', () => {
  const model = queueProfileModel({
    id: 'q1',
    displayName: 'Mari',
    title: 'Spetsialist',
    organization: null,
    fields: ['Lastekaitse', ' '],
    topics: [],
    languages: ['eesti'],
    formats: null,
    bioShort: ' Lühike ',
    bioFull: 'Pikk tutvustus',
    experienceSummary: 'Kogemus'
  });
  assert.deepEqual([model.heading, model.sub, model.intro, model.story, model.experience], ['Mari', 'Spetsialist', 'Lühike', 'Pikk tutvustus', 'Kogemus']);
  assert.deepEqual(model.groups, [{ key: 'fields', items: ['Lastekaitse'] }, { key: 'languages', items: ['eesti'] }]);
  assert.deepEqual(queueChip({ status: 'PENDING_REVIEW' }, t), { text: '[mentoring.profile_status.pending_review]', tone: 'wait' });
  assert.equal(rejectReason(undefined), REVIEW_REASON_KEYS[0]);
  assert.equal(rejectReason('abuse'), 'abuse');
  assert.equal(rejectReason('made_up'), REVIEW_REASON_KEYS[0]);

  const record = { id: 'x1', consentStatus: 'PENDING_CONSENT', consentEvidenceType: null, consentEvidenceRef: null };
  assert.deepEqual(consentForm(record), { status: 'PENDING_CONSENT', evidenceType: 'WRITTEN', evidenceRef: '', needsEvidence: false, canSave: true });
  /* Nõusolekut ei saa märkida ilma tõendi viiteta: server keeldub sellest. */
  assert.deepEqual(consentForm(record, { status: 'CONSENTED' }), { status: 'CONSENTED', evidenceType: 'WRITTEN', evidenceRef: '', needsEvidence: true, canSave: false });
  const filled = consentForm(record, { status: 'CONSENTED', type: 'EMAIL', reference: 'Kiri 3.10' });
  assert.deepEqual([filled.evidenceType, filled.evidenceRef, filled.canSave], ['EMAIL', 'Kiri 3.10', true]);
  assert.deepEqual(consentBody(filled), { action: 'consent', consentStatus: 'CONSENTED', consentEvidenceType: 'EMAIL', consentEvidenceRef: 'Kiri 3.10', refreshCheckedAt: true });
  /* Tühjaks kustutatud viide jääb tühjaks: selle asemel ei saadeta varem salvestatud viidet. */
  const saved = { id: 'x2', consentStatus: 'CONSENTED', consentEvidenceType: 'IN_PERSON', consentEvidenceRef: 'Kohtumine 1.09' };
  assert.deepEqual([consentForm(saved).evidenceType, consentForm(saved).evidenceRef, consentForm(saved).canSave], ['IN_PERSON', 'Kohtumine 1.09', true]);
  assert.deepEqual([consentForm(saved, { reference: '' }).evidenceRef, consentForm(saved, { reference: '' }).canSave], ['', false]);
  assert.equal(consentForm(saved, { type: 'made_up' }).evidenceType, 'IN_PERSON');
  assert.equal(consentForm({}).status, 'PENDING_CONSENT');

  const opened = externalRecordModel({ id: 'x2', displayName: 'Bert', title: 'Juht', organization: 'MTÜ', consentStatus: 'STALE', checkedAt: '2025-01-01T00:00:00Z', externalProfileUrl: 'https://eswa.ee/bert' }, context);
  assert.deepEqual([opened.heading, opened.sub, opened.chip.tone, opened.checked, opened.url], ['Bert', 'Juht · MTÜ', 'wait', '[mentoring.admin.views.record.checked date=aeg:2025-01-01T00:00]', 'https://eswa.ee/bert']);
  /* Aadress, mis ei ole veebiaadress, lingiks ei lähe; kontrollimata kirje ütleb seda. */
  const bare = externalRecordModel({ id: 'x3', externalProfileUrl: 'javascript:alert(1)' }, context);
  assert.deepEqual([bare.url, bare.checked], ['', '[mentoring.admin.views.record.not_checked]']);

  assert.equal(importSummary({ created: 17, existing: 0, skipped: 1 }, t), '[mentoring.admin.import_result created=17 existing=0 skipped=1]');
  assert.equal(importSummary({}, t), '[mentoring.admin.import_result created=0 existing=0 skipped=0]');
  assert.deepEqual(groupOptions(t).map((option) => option.value), [...ADMIN_GROUPS]);
  assert.deepEqual(reasonOptions(t).map((option) => option.value), [...REVIEW_REASON_KEYS]);
  assert.deepEqual(consentOptions(t).map((option) => option.value), [...CONSENT_CHOICES]);
  assert.deepEqual(evidenceOptions(t).map((option) => option.label), EVIDENCE_TYPES.map((type) => `[mentoring.admin.consent_evidence.${EVIDENCE_WORDS[type]}]`));
});

test('lõplik tegevus küsib teist vajutust ja käivitub ainult kinnitatud vajutusest', () => {
  const relationViews = read(RELATION_VIEWS);
  for (const call of ['onConfirm={() => onCancelMeeting(opened)}', 'onConfirm={() => onDiscard(opened)}', 'onConfirm={onClose}']) {
    assert.ok(relationViews.includes(call), call);
  }
  /* Vaates ei ole teist teed sama teoni: iga lõplik tegu on seotud ainult `TwoStep`-i külge. */
  assert.equal(relationViews.match(/onCancelMeeting\(/g).length, 1);
  assert.equal(relationViews.match(/onDiscard\(/g).length, 1);
  assert.equal(relationViews.match(/\{onClose\}/g).length, 1);
  const adminViews = read(ADMIN_VIEWS);
  assert.ok(adminViews.includes('onConfirm={onReject}') && adminViews.includes('onConfirm={onDelete}'));
  assert.equal(adminViews.match(/\{onReject\}/g).length, 1);
  assert.equal(adminViews.match(/\{onDelete\}/g).length, 1);

  /* Lehel saadab iga lõpliku teo päringu täpselt üks koht. */
  const relationPage = read(RELATION_PAGE);
  for (const body of ['action: "cancel"', 'action: "discard"', 'action: "close", reasonKey: closeReason, confirmed: true']) {
    assert.equal(relationPage.split(body).length - 1, 1, body);
  }
  const adminPage = read(ADMIN_PAGE);
  for (const body of ['decision: "REJECT"', 'action: "delete_external"']) assert.equal(adminPage.split(body).length - 1, 1, body);

  /* Topeltklõpsu ja all hoitud klahvi vastu kaitseb ühine nupp. */
  const desk = read(DESK_PARTS);
  assert.ok(desk.includes('import ConfirmButton from "@/components/casework/ConfirmButton"') && desk.includes('<ConfirmButton'));
  const confirm = read('../components/casework/ConfirmButton.jsx');
  assert.ok(confirm.includes('MIN_GAP_MS') && confirm.includes('event.repeat'));
  /* Pärast lõplikku tegu ei lähe fookus teisele lõpliku teo nupule. */
  assert.ok(desk.includes('"data-danger": "true"') && desk.includes(':not([data-danger])'));
});

test('suhe on osadena sammulaval, haldus ilma lavata; kumbki ei kasuta vana kaarti ega status-rolli', () => {
  for (const source of [...PAGES, ...VIEWS]) {
    const code = read(source);
    assert.ok(!code.includes('role="status"'), `${source}: teated ei kasuta status-rolli (ühine kiht joonistab selle omal moel)`);
    assert.ok(!code.includes('MentoringPage.module.css'), `${source}: vana tume kaart on läinud`);
    assert.ok(!code.includes('SubpageHeader'), `${source}: paneelis ei ole lehe pealkirja`);
    assert.ok(!code.includes('as="a"'), `${source}: lingid on next/link, mitte terve lehe uuesti laadiv ankur`);
    /* Seisu sõna ei panda kokku serveri koodist: see käib läbi sõnaloendi. */
    assert.ok(!/toLowerCase\(\)\}`\)/.test(code), `${source}: võtit ei ehitata toorest koodist`);
  }
  assert.ok(!fs.existsSync(new URL('../components/mentoring/MentoringPage.module.css', import.meta.url)), 'vana kujundusfail on kustutatud');
  for (const view of [RELATION_VIEWS, ADMIN_VIEWS]) {
    const code = read(view);
    assert.ok(code.includes('<StepPanel'), `${view} joonistab vaated StepPanel-iga`);
    assert.ok(!code.includes('fetch('), `${view}: vaade ainult joonistab, päringud on lehel`);
  }
  const relationPage = read(RELATION_PAGE);
  const lines = relationPage.split(/\r?\n/).map((line) => line.trim());
  /* Suhte osad ei ole sammud ja suhe avaneb kõigi osade ülevaates. */
  assert.ok(relationPage.includes('<StepFlight') && lines.includes('parts') && lines.includes('startWide={landIndex < 0}'));
  assert.ok(relationPage.includes('all: t("mentoring.relation.all_parts")'));
  /* Halduse raam on terve ekraani laiune aken: seal vahetuvad loend ja avatud kirje kohapeal. */
  const adminPage = read(ADMIN_PAGE);
  assert.ok(!/import StepFlight|<StepFlight/.test(adminPage));
  assert.ok(adminPage.includes('<AdminListView') && adminPage.includes('<QueueItemView') && adminPage.includes('<ExternalItemView'));
  /* Leht jääb halduse raami sisse: sama tee halduse loendis ja sama lehefail. */
  assert.ok(read('../lib/admin/surfaces.js').includes('href: "/admin/mentorlus"'));
  assert.ok(read('../app/admin/mentorlus/page.jsx').includes('return <AdminMentoringPage />;'));
  /* Rida, kust kirje avati, jäetakse meelde avamisel: otsuse või kustutamise järel on loend ees
     enne, kui tegu lõpuni jõuab, ja fookus peab siis minema loendi pealkirjale, mitte kaduma. */
  assert.ok(adminPage.includes('setReturnRow(id);') && adminPage.includes('focusRow={returnRow}'));
  assert.ok(read(ADMIN_VIEWS).includes('node.querySelector("[data-step-heading]")'));
  /* Tee teistele lehtedele jääb alles; teine suhe samal aadressimustril saab oma oleku. */
  assert.ok(relationPage.includes('localizePath("/mentorlus")') && relationPage.includes('/vestlus?roomId='));
  assert.match(read('../app/mentorlus/suhe/[relationId]/page.jsx'), /<MentoringRelationPage key=\{id\} relationId=\{id\} \/>/);
});

test('ülevaatuse õppetunnid: helk ainult eesoleval osal, väli ei lukustu päringu ajaks, pooleli tekst ei kao', () => {
  const views = read(RELATION_VIEWS);
  /* Peamise nupu helk on oma joonistuspind ja lava hoiab kõik osad monteerituna. */
  const primary = views.match(/variant="primary"/g).length;
  assert.ok(primary >= 12, `peamisi nuppe leiti ${primary}`);
  assert.equal(views.match(/variant="primary" glow=\{glow\}/g).length, primary);
  const relationPage = read(RELATION_PAGE);
  assert.ok(relationPage.includes('const glow = flight?.isActive !== false;'));
  assert.equal(relationPage.match(/glow=\{glow\}/g).length, RELATION_PART_KEYS.length - 1, 'iga osa peale seisu saab helgi lipu');

  /* Lukus väli kaotaks fookuse: topeltsaatmist hoiab ära kontroll, mitte välja lukustamine. */
  for (const source of [RELATION_VIEWS, ADMIN_VIEWS]) {
    for (const [field] of read(source).matchAll(/<(?:TextAreaField|Input)\b[\s\S]*?\/>/g)) assert.ok(!field.includes('busy'), `${source}: ${field.slice(0, 60)}`);
  }
  for (const page of PAGES) assert.ok(read(page).includes('if (busyRef.current) return null;'), page);

  /* Vaate ainsa välja silt ei korda vaate nime. */
  for (const [field] of views.matchAll(/<TextAreaField\b[\s\S]*?\/>/g)) assert.ok(field.includes('labelHidden'), field.slice(0, 80));

  /* Eesmärkide väli saab serveri teksti ainult siis, kui seal ei ole pooleli muudatust. */
  assert.ok(relationPage.includes('resetGoal || !goalDirty(goalDraftRef.current, goalSavedRef.current)'));
  assert.ok(relationPage.includes('resetGoal: part === "goal"'));
  /* Tööheaolust toodud tekst kaob valikust ainult siis, kui toomine õnnestus. */
  assert.match(relationPage, /if \(done\) \{\s*\/\*[\s\S]*?\*\/\s*setCandidates\(/);
  /* Seis muutus mujal: leht loeb värske seisu ise. */
  for (const page of PAGES) assert.ok(read(page).includes('error?.status === 409 || error?.status === 404'), page);
});

test('iga märk, mida vaade avatud kirjelt loeb, on mudelis olemas', () => {
  const views = read(RELATION_VIEWS);
  const readFields = new Set([...views.matchAll(/\bopened\.(\w+)/g)].map((match) => match[1]));
  assert.ok(readFields.size >= 15, `välju leiti ${readFields.size}`);
  const samples = [
    ...meetingRows([{ id: 'm1', occurredAt: '2026-10-09T09:00:00Z', status: 'PLANNED', mode: 'EXTERNAL' }], context),
    ...summaryRows([{ id: 's1', content: 'x', status: 'DRAFT', createdByMe: true }], context),
    ...preparationRows([{ id: 'p1', own: true, content: 'x', canShare: true }, { id: 'p2', own: false, sharedAt: '2026-10-01T00:00:00Z' }], { ...context, position: 'mentor', running: true }),
    ...noteRows([{ id: 'n1', content: 'x', updatedAt: '2026-10-01T00:00:00Z' }], context)
  ];
  const produced = new Set(samples.flatMap((row) => Object.keys(row)));
  assert.deepEqual([...readFields].filter((field) => !produced.has(field)), []);
  const candidateFields = [...views.matchAll(/\bopenedCandidate\.(\w+)/g)].map((match) => match[1]);
  const [candidate] = candidateRows([{ id: 'd1', preview: 'x' }]);
  assert.deepEqual(candidateFields.filter((field) => !(field in candidate)), []);
  /* Leht annab vaatele mudeli read muutmata kujul: vahepeal neid käsitsi ümber ei kirjutata. */
  const page = read(RELATION_PAGE);
  for (const builder of ['meetingRows(relation.meetings', 'summaryRows(relation.summaries', 'preparationRows(relation.preparations', 'noteRows(relation.notes', 'candidateRows(shownCandidates)']) {
    assert.ok(page.includes(builder), builder);
  }
  assert.equal(page.match(/rows=\{rows\}/g).length, 4);
});

test('lehtede kujundus on oma moodulites ja klassinimedega, ilma paljaste siltide valijateta', () => {
  let total = 0;
  for (const file of STYLES) {
    const css = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = [...css.matchAll(/(^|[{}])\s*([^{}@]+)\{/g)].flatMap((match) => match[2].split(',')).map((selector) => selector.trim()).filter(Boolean);
    total += selectors.length;
    const bare = selectors.filter((selector) => !/^(\.|:global\()/.test(selector) || /[\s>+~](?![.:])[a-z]/.test(selector.replace(/:global\([^)]*\)\s*/, '')));
    assert.deepEqual(bare, [], file);
  }
  assert.ok(total > 25, `valijaid leiti ${total}`);
});
