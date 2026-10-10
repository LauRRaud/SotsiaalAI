import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CARE_NOTICE_ANSWERS, CARE_NOTICE_CHANNELS, CARE_NOTICE_REASONS } from '../lib/homeCare/constants.js';
import { figureLines, trimLeadingEmptyMonths } from '../lib/homeCare/clientFigures.js';
import { composeNoticeText, noticeState, normalizeNotice, normalizeNoticeAnswer } from '../lib/homeCare/decisionNotices.js';

const TODAY = '2026-10-09';
const ID = (n) => `cmv0000000000000000000a${n}`;
const fails = (fn, key) => assert.throws(fn, (error) => error?.messageKey === key, key);

test('teade otsustajale: sisendi reeglid', () => {
  const base = { reason: 'need_grown', text: '  Ei  jaksa enam ise pliidi juurde.  ', channel: 'email' };
  assert.deepEqual(normalizeNotice(base, TODAY), {
    reason: 'NEED_GROWN',
    text: 'Ei jaksa enam ise pliidi juurde.',
    recipient: null,
    channel: 'EMAIL',
    sentOn: TODAY,
    entryIds: [],
    withFigures: false
  });
  const full = normalizeNotice({ ...base, recipient: ' Mari Maasikas, linnavalitsus ', sentOn: '2026-10-07', entryIds: [ID(1), ID(2), ID(1)] }, TODAY);
  assert.deepEqual([full.recipient, full.sentOn, full.entryIds], ['Mari Maasikas, linnavalitsus', '2026-10-07', [ID(1), ID(2)]]);
  fails(() => normalizeNotice({ ...base, reason: 'MUU' }, TODAY), 'home_care.errors.notice_reason_required');
  fails(() => normalizeNotice({ ...base, text: '   ' }, TODAY), 'home_care.errors.notice_text_required');
  fails(() => normalizeNotice({ ...base, channel: '' }, TODAY), 'home_care.errors.notice_channel_required');
  fails(() => normalizeNotice({ ...base, sentOn: '2026-10-10' }, TODAY), 'home_care.errors.notice_day_future');
  fails(() => normalizeNotice({ ...base, entryIds: 'x' }, TODAY), 'home_care.errors.notice_entries_invalid');
  fails(() => normalizeNotice({ ...base, entryIds: ['../x'] }, TODAY), 'home_care.errors.notice_entries_invalid');
  fails(() => normalizeNotice({ ...base, entryIds: [1, 2, 3, 4, 5, 6].map(ID) }, TODAY), 'home_care.errors.notice_entries_too_many');
  assert.equal(normalizeNotice({ ...base, entryIds: [1, 2, 3, 4, 5].map(ID) }, TODAY).entryIds.length, 5);
});

test('teade otsustajale: vastuse reeglid', () => {
  const frame = { today: TODAY, sentOn: '2026-10-01' };
  assert.deepEqual(normalizeNoticeAnswer({ answer: 'reassess', reassessBy: '2026-11-01' }, frame), {
    answer: 'REASSESS',
    answeredOn: TODAY,
    reassessBy: '2026-11-01',
    answerNote: null
  });
  /* Uue hindamise päev on ainult vastusel „hindab uuesti"; mujal seda ei hoita. */
  assert.deepEqual(normalizeNoticeAnswer({ answer: 'VOLUME_STAYS', answeredOn: '2026-10-05', reassessBy: '2026-11-01', answerNote: ' Maht on piisav ' }, frame), {
    answer: 'VOLUME_STAYS',
    answeredOn: '2026-10-05',
    reassessBy: null,
    answerNote: 'Maht on piisav'
  });
  assert.equal(normalizeNoticeAnswer({ answer: 'OTHER_SERVICE' }, frame).answerNote, null);
  fails(() => normalizeNoticeAnswer({}, frame), 'home_care.errors.notice_answer_required');
  fails(() => normalizeNoticeAnswer({ answer: 'REASSESS' }, frame), 'home_care.errors.notice_reassess_day_required');
  fails(() => normalizeNoticeAnswer({ answer: 'REASSESS', reassessBy: '2026-09-30' }, frame), 'home_care.errors.notice_reassess_day_required');
  fails(() => normalizeNoticeAnswer({ answer: 'VOLUME_STAYS' }, frame), 'home_care.errors.notice_answer_note_required');
  fails(() => normalizeNoticeAnswer({ answer: 'OTHER' }, frame), 'home_care.errors.notice_answer_note_required');
  fails(() => normalizeNoticeAnswer({ answer: 'OTHER_SERVICE', answeredOn: '2026-09-30' }, frame), 'home_care.errors.notice_answer_day');
  fails(() => normalizeNoticeAnswer({ answer: 'OTHER_SERVICE', answeredOn: '2026-10-10' }, frame), 'home_care.errors.notice_answer_day');
});

test('teade otsustajale: seis', () => {
  assert.deepEqual(noticeState({ sentOn: '2026-10-01', answer: null, withdrawnAt: null }, TODAY), { state: 'WAITING', waitingDays: 8, reassessOverdue: false });
  assert.deepEqual(noticeState({ sentOn: TODAY, answer: null, withdrawnAt: null }, TODAY), { state: 'WAITING', waitingDays: 0, reassessOverdue: false });
  assert.deepEqual(noticeState({ sentOn: '2026-10-01', answer: null, withdrawnAt: new Date() }, TODAY), { state: 'WITHDRAWN', waitingDays: null, reassessOverdue: false });
  /* Lubatud päev ise ei ole veel möödas; järgmine päev on. */
  assert.equal(noticeState({ sentOn: '2026-09-01', answer: 'REASSESS', reassessBy: TODAY }, TODAY).reassessOverdue, false);
  assert.deepEqual(noticeState({ sentOn: '2026-09-01', answer: 'REASSESS', reassessBy: '2026-10-08' }, TODAY), { state: 'ANSWERED', waitingDays: null, reassessOverdue: true });
  assert.equal(noticeState({ sentOn: '2026-09-01', answer: 'VOLUME_STAYS', reassessBy: null }, TODAY).reassessOverdue, false);
});

test('teade otsustajale: tekst on kopeeritav ja kannab ainult seda, mis sisse anti', () => {
  const notice = { reason: 'NEED_GROWN', text: 'Ei jaksa enam ise pliidi juurde. Kaks korda on toit söömata jäänud.', recipient: 'Mari Maasikas, linnavalitsus', sentOn: '2026-10-09' };
  const text = composeNoticeText('et', {
    organizationName: 'Hoolekanne A',
    clientName: 'Linda Tamm',
    authorName: 'Juta Juht',
    notice,
    decision: { documentNumber: '1-2/34', issuerName: 'Haapsalu Linnavalitsus', volumeMinutes: 390, volumePeriod: 'WEEK' },
    entries: [
      { day: '2026-10-05', authorName: 'Anu Hooldaja', text: 'Toit  oli\nsöömata.' },
      { day: '2026-10-08', authorName: '', text: 'x'.repeat(700) }
    ]
  });
  const lines = text.split('\n');
  assert.deepEqual(lines.slice(0, 6), [
    'Teade koduteenuse osutajalt: Hoolekanne A',
    'Kuupäev: 09.10.2026',
    'Kellele: Mari Maasikas, linnavalitsus',
    'Klient: Linda Tamm',
    'Kehtiv otsus: nr 1-2/34, Haapsalu Linnavalitsus, maht 6,5 tundi nädalas',
    'Põhjus: abivajadus on kasvanud'
  ]);
  assert.deepEqual(lines.slice(6, 10), ['', notice.text, '', 'Päeviku kirjed:']);
  assert.equal(lines[10], '- 05.10.2026, Anu Hooldaja: Toit oli söömata.');
  /* Pikk kirje lõigatakse; autorita kirjel nime ei ole. */
  assert.ok(lines[11].startsWith('- 08.10.2026: xxx'));
  assert.equal(lines[11].length, '- 08.10.2026: '.length + 600);
  assert.ok(lines[11].endsWith('…'));
  assert.deepEqual(lines.slice(12), ['', 'Teate koostas: Juta Juht', 'See on teenuseosutaja tähelepanek otsustajale. Ametlik menetlus toimub STAR-is.']);

  /* Ilma adressaadi, otsuse ja kirjeteta: neid ridu ei ole; kuumaht on teise sõnastusega. */
  const bare = composeNoticeText('et', { organizationName: 'Hoolekanne A', clientName: 'Linda Tamm', authorName: 'Juta Juht', notice: { ...notice, recipient: null } });
  assert.equal(bare.includes('Kellele'), false);
  assert.equal(bare.includes('Kehtiv otsus'), false);
  assert.equal(bare.includes('Päeviku kirjed'), false);
  const month = composeNoticeText('et', { organizationName: 'A', clientName: 'B', authorName: 'C', notice, decision: { documentNumber: null, issuerName: null, volumeMinutes: 600, volumePeriod: 'MONTH' } });
  assert.ok(month.includes('Kehtiv otsus: maht 10 tundi kuus'));
  /* Otsus ilma numbri, väljaandja ja mahuta rida ei tee. */
  assert.equal(composeNoticeText('et', { organizationName: 'A', clientName: 'B', authorName: 'C', notice, decision: { documentNumber: null, issuerName: null, volumeMinutes: null, volumePeriod: null } }).includes('Kehtiv otsus'), false);
});

test('teate tekstid on kolmes keeles', () => {
  const et = JSON.parse(readFileSync(new URL('../messages/et.json', import.meta.url), 'utf8')).home_care;
  for (const locale of ['et', 'en', 'ru']) {
    const catalogue = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    for (const key of Object.keys(et.notice)) assert.ok(catalogue.notice[key], `${locale} ${key}`);
    for (const key of Object.keys(et.notice.doc)) assert.ok(catalogue.notice.doc[key], `${locale} doc.${key}`);
    for (const value of CARE_NOTICE_REASONS) assert.ok(catalogue.notice.reasons[value], `${locale} ${value}`);
    for (const value of CARE_NOTICE_CHANNELS) assert.ok(catalogue.notice.channels[value], `${locale} ${value}`);
    for (const value of CARE_NOTICE_ANSWERS) assert.ok(catalogue.notice.answers[value], `${locale} ${value}`);
    for (const key of ['notices_waiting_title', 'notices_waiting_empty', 'notices_waiting_line', 'reassess_overdue_title', 'reassess_overdue_empty', 'reassess_overdue_line']) {
      assert.ok(catalogue.deadlines[key], `${locale} ${key}`);
    }
    for (const key of Object.keys(et.errors).filter((name) => name.startsWith('notice_'))) assert.ok(catalogue.errors[key], `${locale} ${key}`);
  }
});

test('teate arvud: read kuude kaupa, tühjad kuud algusest välja, erijuhtumid liigi kaupa', () => {
  const month = (name, values = {}) => ({ month: name, untilDay: `${name}-30`, partial: false, visits: 0, minutes: 0, expectedMinutes: null, missed: 0, cancelled: 0, awayDays: 0, ...values });
  /* Algusest jäävad välja kuud, mille kohta ei ole midagi kirjas; vahepealne tühi kuu jääb. */
  assert.deepEqual(trimLeadingEmptyMonths([month('2026-07'), month('2026-08', { visits: 2 }), month('2026-09'), month('2026-10', { partial: true })]).map((row) => row.month), ['2026-08', '2026-09', '2026-10']);
  assert.deepEqual(trimLeadingEmptyMonths([month('2026-07'), month('2026-08')]), []);
  assert.equal(trimLeadingEmptyMonths([month('2026-07', { expectedMinutes: 0 })]).length, 1);

  const figures = {
    months: [
      month('2026-08', { visits: 8, minutes: 360, expectedMinutes: 480, missed: 1, cancelled: 2, awayDays: 3 }),
      month('2026-09', { visits: 9, minutes: 495 }),
      month('2026-10', { untilDay: '2026-10-09', partial: true, visits: 2, minutes: 90, expectedMinutes: 139 })
    ],
    incidents: { total: 3, byType: { FALL: 2, DOOR_NOT_OPENED: 1 } },
    signals: 4,
    continuity: { workers: 2, visits: 6 }
  };
  assert.deepEqual(figureLines('et', figures), [
    'Arvud kuude kaupa:',
    '- 08.2026: käike 8, osutatud 6 t, otsustatud 8 t, ära jäänud käike 1, ette ära jäetud käike 2, ajutiselt ära päevi 3',
    '- 09.2026: käike 9, osutatud 8,3 t, otsustatud mahtu ei olnud',
    '- 10.2026 (kuni 09.10.2026): käike 2, osutatud 1,5 t, otsustatud 2,3 t',
    'Erijuhtumeid samal ajal: 3 (Uks ei avanenud 1, Kukkumine või maast leidmine 2).',
    'Hooldajate märkamisi, et midagi on tavalisest teisiti: 4.',
    'Viimase nelja nädala käigud (6) tegi eri töötajaid: 2.'
  ]);
  assert.deepEqual(figureLines('et', { months: [], incidents: { total: 0, byType: {} }, signals: 0, continuity: null }), [
    'Arvud kuude kaupa:',
    'Viimastel kuudel ei ole käike ega otsustatud mahtu kirjas.',
    'Erijuhtumeid samal ajal ei olnud.'
  ]);
  /* Teate tekstis on arvud lausete ja kirjete vahel; ilma arvudeta seda plokki ei ole. */
  const notice = { reason: 'REVIEW', text: 'Ülevaade enne ülevaatust.', recipient: null, sentOn: '2026-10-09' };
  const lines = composeNoticeText('et', { organizationName: 'A', clientName: 'B', authorName: 'C', notice, figures, entries: [{ day: '2026-10-05', authorName: 'Anu', text: 'Kirje' }] }).split('\n');
  assert.deepEqual(lines.slice(3, 8), ['Põhjus: otsustaja küsis ülevaadet', '', 'Ülevaade enne ülevaatust.', '', 'Arvud kuude kaupa:']);
  assert.equal(lines.indexOf('Päeviku kirjed:') > lines.indexOf('Arvud kuude kaupa:'), true);
  assert.equal(composeNoticeText('et', { organizationName: 'A', clientName: 'B', authorName: 'C', notice }).includes('Arvud kuude kaupa'), false);
  assert.equal(normalizeNotice({ reason: 'REVIEW', text: 'x', channel: 'STAR', withFigures: true }, TODAY).withFigures, true);
  assert.equal(normalizeNotice({ reason: 'REVIEW', text: 'x', channel: 'STAR', withFigures: 'jah' }, TODAY).withFigures, false);
});
