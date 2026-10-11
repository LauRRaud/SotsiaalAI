// Organisatsiooni toe osa (`/org/<id>/tugi`): lehe reeglid ja tekstid.
//
// Leht oli neli kasti üksteise all; nüüd on see loend (saadud või saadetud), üks
// avatud saadud avaldus ja saatmine kolme väikese vaatena. Otsused on puhaste
// funktsioonidena failis components/org/support/supportRules.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { dayOf } from '../components/org/orgRules.js';
import {
  EMPTY_SHARE,
  LIST_TABS,
  SEND_STEPS,
  contactTypeKey,
  personLabel,
  receivedDetail,
  receivedRow,
  recipientOptions,
  sendStepStates,
  sendSummary,
  sentRow,
  shareDirty,
  shareProblem,
  shownList
} from '../components/org/support/supportRules.js';
import { SUPPORT_CONTACT_TYPES } from '../lib/org/support.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const LANGS = ['et', 'en', 'ru'];
const translator = (lang) => {
  const messages = catalog(lang);
  return (key, vars) => {
    const value = at(messages, key);
    if (typeof value !== 'string') return key;
    return vars ? value.replace(/\{(\w+)\}/g, (_match, name) => String(vars[name] ?? '')) : value;
  };
};
const t = translator('et');

const RECIPIENTS = [
  { membershipId: 'm1', firstName: 'Mari', lastName: 'Tamm', contactType: 'DIRECT_MANAGER' },
  { membershipId: 'm1', firstName: 'Mari', lastName: 'Tamm', contactType: 'SAFETY_CONTACT' },
  { membershipId: 'm4', firstName: null, lastName: null, jobTitle: 'Personalijuht', contactType: 'ALTERNATE_SUPPORT' },
  { membershipId: 'm5', firstName: null, lastName: null, jobTitle: null, email: 'tugi@naide.test', contactType: 'ALTERNATE_SUPPORT' }
];

test('saaja silt ei ole kunagi kriips ja sama inimene on valikus üks kord', () => {
  assert.equal(personLabel({ firstName: 'Mari', lastName: 'Tamm' }, { t }), 'Mari Tamm');
  assert.equal(personLabel({ jobTitle: 'Personalijuht' }, { t }), 'Personalijuht');
  assert.equal(personLabel({ email: 'tugi@naide.test' }, { t }), 'tugi@naide.test');
  assert.equal(personLabel({}, { t }), 'Nimeta inimene');
  const options = recipientOptions(RECIPIENTS, { t });
  assert.deepEqual(options, [
    { value: 'm1', label: 'Mari Tamm · Otsene juht, Turvakontakt' },
    { value: 'm4', label: 'Personalijuht · Alternatiivne tugikontakt' },
    { value: 'm5', label: 'tugi@naide.test · Alternatiivne tugikontakt' }
  ]);
  assert.equal(new Set(options.map((option) => option.value)).size, options.length);
  for (const lang of LANGS) {
    for (const type of SUPPORT_CONTACT_TYPES) assert.equal(typeof at(catalog(lang), contactTypeKey(type)), 'string', `${lang}: ${type}`);
  }
  assert.deepEqual(recipientOptions(null, { t }), []);
});

test('saatmine: mis on puudu ja kuhu parandama viiakse; kinnitus on eraldi tegu', () => {
  assert.deepEqual([...SEND_STEPS], ['who', 'what', 'confirm']);
  assert.equal(EMPTY_SHARE.confirmed, false, 'kinnitus ei ole vaikimisi eeldus');
  assert.equal(shareDirty(EMPTY_SHARE), false);
  assert.equal(shareDirty({ ...EMPTY_SHARE, confirmed: true }), true);
  assert.equal(shareDirty({ ...EMPTY_SHARE, needs: 'x' }), true);
  assert.deepEqual(shareProblem(EMPTY_SHARE), { key: 'org.support.need_recipient', step: 'who' });
  assert.deepEqual(shareProblem({ ...EMPTY_SHARE, recipientMembershipId: 'm1' }), { key: 'org.support.need_summary', step: 'what' });
  assert.deepEqual(shareProblem({ ...EMPTY_SHARE, recipientMembershipId: 'm1', summary: 'Koormus' }), { key: 'org.support.need_confirm', step: 'confirm' });
  assert.equal(shareProblem({ recipientMembershipId: 'm1', summary: 'Koormus', needs: '', confirmed: true }), null);
  assert.deepEqual(sendStepStates(EMPTY_SHARE), { who: 'empty', what: 'empty', confirm: 'empty' });
  assert.deepEqual(sendStepStates({ recipientMembershipId: 'm1', summary: '', needs: 'x', confirmed: true }), { who: 'done', what: 'partial', confirm: 'done' });
  const rows = sendSummary({ recipientMembershipId: 'm1', summary: ' Koormus ', needs: 'Üks vaba päev\n  Kovisioon \n' }, RECIPIENTS, { t });
  assert.deepEqual(rows.map((row) => [row.key, row.value]), [
    ['to', 'Mari Tamm · Otsene juht, Turvakontakt'],
    ['summary', 'Koormus'],
    ['needs', 'Üks vaba päev; Kovisioon']
  ]);
  const problems = [shareProblem(EMPTY_SHARE), shareProblem({ ...EMPTY_SHARE, recipientMembershipId: 'm1' }), shareProblem({ ...EMPTY_SHARE, recipientMembershipId: 'm1', summary: 'x' })];
  for (const problem of problems) {
    assert.ok(SEND_STEPS.includes(problem.step));
    for (const lang of LANGS) {
      assert.equal(typeof at(catalog(lang), problem.key), 'string', `${lang}: ${problem.key}`);
      if (problem.step !== 'confirm') assert.equal(typeof at(catalog(lang), `org.support.to_${problem.step}`), 'string', `${lang}: to_${problem.step}`);
    }
  }
});

test('saadud ja saadetud avaldused: avamine on eraldi samm ja tagasi saab võtta ainult enne avamist', () => {
  const share = { id: 's1', status: 'SENT', sentAt: '2026-10-11T07:00:00.000Z', sender: { firstName: 'Jaan', lastName: 'Kask' }, snapshot: null };
  const row = receivedRow(share, { t });
  assert.deepEqual([row.title, row.sub, row.chip, row.attention], ['Jaan Kask', dayOf('2026-10-11T07:00:00.000Z'), 'Saadetud', true]);
  const closed = receivedDetail(share, { t });
  assert.deepEqual([closed.opened, closed.canOpen, closed.canClose, closed.summary], [false, true, true, '']);
  const opened = receivedDetail({ ...share, status: 'OPENED', snapshot: { summary: ' Koormus ', supportRequested: 'Vaba päev', needs: ['Kovisioon', ' '], periodLabel: 'Oktoober' } }, { t });
  assert.deepEqual([opened.opened, opened.canOpen, opened.canClose], [true, false, true]);
  assert.deepEqual([opened.summary, opened.requested, opened.needs], ['Koormus', 'Vaba päev', ['Kovisioon']]);
  assert.ok(opened.facts.some((fact) => fact.key === 'period' && fact.value === 'Oktoober'));
  assert.equal(receivedDetail({ ...share, status: 'CLOSED' }, { t }).canClose, false);
  assert.equal(receivedDetail(share, { t, writable: false }).canClose, false);
  assert.equal(receivedDetail({ ...share, sender: {} }, { t }).from, 'Nimeta inimene');

  const sent = { id: 's2', status: 'SENT', sentAt: '2026-10-11T07:00:00.000Z', openedAt: null, recipient: { firstName: 'Mari', lastName: 'Tamm' } };
  assert.deepEqual([sentRow(sent, { t }).title, sentRow(sent, { t }).chip, sentRow(sent, { t }).canRecall], ['Mari Tamm', 'Saadetud', true]);
  assert.equal(sentRow({ ...sent, openedAt: '2026-10-11T08:00:00.000Z' }, { t }).canRecall, false);
  assert.equal(sentRow({ ...sent, status: 'OPENED' }, { t }).canRecall, false);
  assert.equal(sentRow(sent, { t, writable: false }).canRecall, false);
  assert.deepEqual([...LIST_TABS], ['received', 'sent']);
  assert.equal(shownList('sent'), 'sent');
  assert.equal(shownList('midagi muud'), 'received');
  for (const lang of LANGS) {
    for (const status of ['SENT', 'OPENED', 'RECALLED', 'CORRECTED', 'CLOSED']) assert.equal(typeof at(catalog(lang), `org.supportShareStatus.${status}`), 'string', `${lang}: ${status}`);
  }
});

test('tekstid on kolmes keeles olemas ja päringuid on sama palju kui vanal lehel', () => {
  const old = ['heading', 'privacyNotice', 'directManager', 'alternate', 'safety', 'noRecipients', 'received', 'noReceived', 'sent', 'noSent', 'summary', 'needs', 'send', 'recall', 'close', 'status', 'sentAt',
    'sentTo', 'recallHint'];
  const fresh = ['unnamed', 'tabs.label', 'tabs.received', 'tabs.sent', 'period', 'from', 'open_share', 'open_note', 'no_summary', 'close_confirm', 'close_note', 'recall_confirm', 'recall_note', 'steps_label',
    'who_question', 'who_note', 'needs_hint', 'need_recipient', 'need_summary', 'need_confirm', 'to_who', 'to_what', 'confirm_title', 'confirm_terms', 'sending', 'decline_note',
    ...SEND_STEPS.flatMap((step) => [`steps.${step}.title`, `steps.${step}.short`])];
  for (const lang of LANGS) {
    for (const key of [...old, ...fresh]) assert.equal(typeof at(catalog(lang), `org.support.${key}`), 'string', `${lang}: org.support.${key}`);
  }
  for (const key of fresh) assert.ok(!/[—–]| - |"/.test(at(catalog('et'), `org.support.${key}`)), key);
});
