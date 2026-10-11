// Organisatsiooni tööosad: vastuvõtt (loend ja avatud pöördumine). Reeglid ja tekstid.
//
// Loend oli tabel ja avatud pöördumine neli kasti üksteise all; nüüd on need
// madalad read ja kaks väikest vaadet. Otsused on puhaste funktsioonidena failis
// components/org/inbox/inboxRules.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { assigneeLabel, hasWork, inboxRow, itemFacts, itemTabs, personName, shownItemStatus, sourceParts, workActions, workerOptions } from '../components/org/inbox/inboxRules.js';
import { stampOf } from '../components/org/orgRules.js';
import { OrganizationInboxStatus, OrganizationWorkAssignmentStatus } from '../lib/org/constants.js';

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
const MEMBERS = [
  { membershipId: 'm1', person: { firstName: 'Mari', lastName: 'Tamm' } },
  { membershipId: 'm2', person: { firstName: 'Jaan', lastName: 'Kask' } },
  { membershipId: 'm3', person: { firstName: null, lastName: null } }
];
const item = (over = {}) => ({ id: 'i1', status: 'RECEIVED', receivedAt: '2026-10-11T07:16:00.000Z', urgencyDeclaredBySender: null, unit: null, assignment: null, ...over });
const context = (over = {}) => ({ writable: true, membership: { id: 'm2' }, ...over });

test('loendi rida: saabumise aeg, üksus, vastutaja ja seis; sisu real ei ole', () => {
  const row = inboxRow(item({ unit: { name: 'Sotsiaalosakond' }, urgencyDeclaredBySender: ' Üürileping lõpeb ' }), { t });
  assert.equal(row.title, stampOf('2026-10-11T07:16:00.000Z'));
  assert.equal(row.sub, 'Sotsiaalosakond · Määramata');
  assert.equal(row.urgency, 'Üürileping lõpeb');
  assert.equal(row.chip, 'Saabunud');
  assert.equal(row.attention, true, 'määramata kirje vajab tähelepanu');
  const assigned = inboxRow(item({ status: 'ASSIGNED', assignment: { firstName: 'Jaan', lastName: 'Kask', status: 'PENDING' } }), { t });
  assert.equal(assigned.sub, 'Jaan Kask, ootab vastust');
  assert.equal(assigned.attention, false);
  /* Nimeta vastutaja saab üldnime, mitte kriipsu ega sisemist ID-d. */
  assert.equal(inboxRow(item({ assignment: { firstName: null, lastName: null, status: 'ACCEPTED' } }), { t }).sub, 'Nimeta töötaja, vastu võetud');
  for (const lang of LANGS) {
    const tr = translator(lang);
    for (const status of Object.values(OrganizationInboxStatus)) {
      for (const work of Object.values(OrganizationWorkAssignmentStatus)) {
        const built = inboxRow(item({ status, assignment: { firstName: 'A', lastName: 'B', status: work } }), { t: tr });
        assert.ok(!/org\.|[A-Z]{3,}_[A-Z]|[A-Z]{6,}/.test(`${built.chip} ${built.sub}`), `${lang}: ${status}/${work} -> ${built.chip} | ${built.sub}`);
      }
    }
  }
});

test('töötajate valikud ja vastutaja nimi: sisemist ID-d ei näidata kunagi', () => {
  assert.deepEqual(workerOptions(MEMBERS, { t }), [
    { value: 'm1', label: 'Mari Tamm' },
    { value: 'm2', label: 'Jaan Kask' },
    { value: 'm3', label: 'Nimeta töötaja' }
  ]);
  assert.deepEqual(workerOptions(MEMBERS, { t, exclude: 'm2' }).map((option) => option.value), ['m1', 'm3']);
  assert.deepEqual(workerOptions(null, { t }), []);
  assert.equal(personName({ firstName: ' Mari ', lastName: '' }), 'Mari');
  assert.equal(assigneeLabel(item(), MEMBERS, { t }), 'Määramata');
  assert.equal(assigneeLabel(item({ assignment: { membershipId: 'm2', status: 'PENDING' } }), MEMBERS, { t }), 'Jaan Kask, ootab vastust');
  /* Kui liikmete loend ei ole inimesele nähtav, jääb vastutaja kohta seis. */
  assert.equal(assigneeLabel(item({ assignment: { membershipId: 'm2', status: 'ACCEPTED' } }), [], { t }), 'Vastu võetud');
});

test('pärast üleandmist ei seisa lehel kõrvuti „vastu võetud” ja „ootab vastust”', () => {
  /* Enne serveri parandust üle antud rida: kirje on ACCEPTED, kuigi uus määramine ootab
     vastust. Uutel ridadel teeb siirde server (tests/org-inbox-handover-status.test.mjs). */
  const handedOver = item({ status: 'ACCEPTED', assignment: { membershipId: 'm2', firstName: 'Jaan', lastName: 'Kask', status: 'PENDING' } });
  assert.equal(shownItemStatus(handedOver), 'ASSIGNED');
  assert.equal(inboxRow(handedOver, { t }).chip, 'Määratud');
  assert.equal(itemFacts(handedOver, MEMBERS, { t }).find((row) => row.key === 'status').value, 'Määratud');
  /* Muud seisud jäävad nii, nagu server ütleb. */
  assert.equal(shownItemStatus(item({ status: 'ACCEPTED', assignment: { membershipId: 'm2', status: 'ACCEPTED' } })), 'ACCEPTED');
  assert.equal(shownItemStatus(item({ status: 'ASSIGNED', assignment: { membershipId: 'm2', status: 'PENDING' } })), 'ASSIGNED');
  assert.equal(shownItemStatus(item({ status: 'CLOSED', assignment: { membershipId: 'm2', status: 'PENDING' } })), 'CLOSED');
  assert.equal(shownItemStatus(null), '');
});

test('avatud pöördumise read ja saatja kinnitatud pakett: tühja osa ega kriipsu ei ole', () => {
  const facts = itemFacts(item({ urgencyDeclaredBySender: 'Kiire' }), MEMBERS, { t });
  assert.deepEqual(facts.map((row) => row.key), ['status', 'assignee', 'received', 'urgency']);
  assert.deepEqual(itemFacts(item(), MEMBERS, { t }).map((row) => row.key), ['status', 'assignee', 'received']);
  const parts = sourceParts({ source: { topic: 'Koduteenus', situation: 'Ema on 84.', userEditedDraft: '', generatedDraft: 'Tere.' } }, { t });
  assert.deepEqual(parts.map((part) => [part.key, part.value]), [['topic', 'Koduteenus'], ['situation', 'Ema on 84.'], ['draft', 'Tere.']]);
  /* Saatja muudetud tekst on koostatud mustandist ees. */
  assert.equal(sourceParts({ source: { situation: 'x', userEditedDraft: 'Minu tekst', generatedDraft: 'Mustand' } }, { t }).find((part) => part.key === 'draft').value, 'Minu tekst');
  assert.deepEqual(sourceParts({ source: { situation: 'x' } }, { t }).map((part) => part.key), ['situation']);
  assert.deepEqual(sourceParts({}, { t }), []);
});

test('töö tegevused: kes mida teha saab', () => {
  /* Määraja ja vastutajata kirje: määramine ja sulgemine. */
  assert.deepEqual(workActions(item(), { context: context({ membership: { id: 'm1' } }), canAssign: true }), { assign: true, respond: false, handOver: false, close: true });
  /* Määratud töötaja, kes ei ole määraja: vastamine ja üleandmine, sulgemist ei ole. */
  const pending = item({ assignment: { id: 'a1', membershipId: 'm2', status: 'PENDING' } });
  assert.deepEqual(workActions(pending, { context: context(), canAssign: false }), { assign: false, respond: true, handOver: true, close: false });
  /* Juht ei saa töötaja eest vastutust võtta. */
  assert.equal(workActions(pending, { context: context({ membership: { id: 'm1' } }), canAssign: true }).respond, false);
  /* Vastu võetud töö: vastamist enam ei ole, üle anda saab. */
  const accepted = item({ assignment: { id: 'a1', membershipId: 'm2', status: 'ACCEPTED' } });
  assert.deepEqual(workActions(accepted, { context: context(), canAssign: false }), { assign: false, respond: false, handOver: true, close: false });
  /* Kõrvaline liige: mitte midagi. */
  const outsider = workActions(pending, { context: context({ membership: { id: 'm9' } }), canAssign: false });
  assert.equal(hasWork(outsider), false);
  assert.deepEqual(itemTabs(outsider), ['package']);
  assert.deepEqual(itemTabs(workActions(item(), { context: context(), canAssign: true })), ['package', 'work']);
  /* Tagasi võetud pöördumine ja kirjutuskaitstud organisatsioon: tööd teha ei saa. */
  assert.equal(hasWork(workActions(item({ sourceWithheldReason: 'RECALLED' }), { context: context(), canAssign: true })), false);
  assert.equal(hasWork(workActions(pending, { context: context({ writable: false }), canAssign: true })), false);
});

test('tekstid on kolmes keeles olemas ja uutes sõnades ei ole mõttekriipsu ega sirgeid jutumärke', () => {
  const old = ['heading', 'privacyNotice', 'status', 'receivedAt', 'assignee', 'unassigned', 'open', 'empty', 'sourcePackage', 'topic', 'situation', 'draft', 'urgency', 'assign', 'accept', 'reject', 'handOver', 'close',
    'backToList', 'openedNotice', 'recalledNotice'];
  const fresh = ['unnamed_worker', 'tabs.label', 'tabs.package', 'tabs.work', 'assign_question', 'handover_question', 'pick_first', 'no_workers', 'response_lead', 'reject_confirm', 'reject_note', 'close_confirm', 'close_note'];
  for (const lang of LANGS) {
    for (const key of [...old, ...fresh]) assert.equal(typeof at(catalog(lang), `org.inbox.${key}`), 'string', `${lang}: org.inbox.${key}`);
  }
  for (const key of fresh) assert.ok(!/[—–]| - |"/.test(at(catalog('et'), `org.inbox.${key}`)), key);
  const count = (path) => (read(path).match(/(?<![A-Za-z0-9_.])call\(/g) || []).length;
  assert.equal(count('../components/org/OrgInboxClient.jsx'), 1);
  assert.equal(count('../components/org/OrgInboxItemClient.jsx'), 5);
  /* Töö vastu võtnud töötaja avab vestlusruumi: nupp on vaates ja päring lehel. */
  for (const lang of LANGS) {
    assert.equal(typeof at(catalog(lang), 'org.inbox.openRoom'), 'string', lang);
    assert.equal(typeof at(catalog(lang), 'pre_inquiries.errors.room_failed'), 'string', lang);
  }
  assert.ok(read('../components/org/inbox/InboxViews.jsx').includes('t("org.inbox.openRoom")'));
  const page = read('../components/org/OrgInboxItemClient.jsx');
  assert.ok(page.includes('/room`, {') && page.includes('item.room?.canOpen'), 'vestlusruumi avamine on lehel alles');
});
