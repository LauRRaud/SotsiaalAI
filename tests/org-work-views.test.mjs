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

/* Kirje igas seisus, nagu server selle lehele annab: vastutajata seisudel elavat määramist ei
   ole, „määratud” kirjel ootab määramine vastust, „vastu võetud” kirjel on see vastu võetud.
   Vastutaja on alati m2. */
const LIVE_ASSIGNMENT = { ASSIGNED: 'PENDING', ACCEPTED: 'ACCEPTED' };
const staged = (status, over = {}) =>
  item({ status, assignment: LIVE_ASSIGNMENT[status] ? { id: 'a1', membershipId: 'm2', status: LIVE_ASSIGNMENT[status] } : null, ...over });
/* Kes kirjet vaatab. Server näitab kirjet ainult koordinaatorile ja elava töö vastutajale
   (`getInboxItem`), seega muid vaatajaid lehel ei ole; `isCoordinator` tuleb kirje küljes
   serverist, `canAssign` arvutab leht töö määramise õigusest. */
const VIEWERS = [
  { name: 'koordinaator ja määraja', isCoordinator: true, canAssign: true, me: 'm1' },
  { name: 'ainult koordinaator', isCoordinator: true, canAssign: false, me: 'm1' },
  { name: 'koordinaator ja määraja, ise vastutaja', isCoordinator: true, canAssign: true, me: 'm2' },
  { name: 'määraja, ise vastutaja', isCoordinator: false, canAssign: true, me: 'm2' },
  { name: 'vastutaja', isCoordinator: false, canAssign: false, me: 'm2' }
];
const offered = (status, viewer, over = {}) => {
  const actions = workActions(staged(status, { isCoordinator: viewer.isCoordinator, ...over }), { context: context({ membership: { id: viewer.me } }), canAssign: viewer.canAssign });
  return Object.keys(actions).filter((key) => actions[key]).join(' ');
};
/* Veerud on `VIEWERS` järjekorras; `null` = see inimene seda kirjet ei näe (ta ei ole
   koordinaator ja elavat tööd tal ei ole). Sama tabeli serveri pool, kus iga pakutud tegevus
   ka päriselt tehakse: tests/org-inbox-manual-status.test.mjs. */
const EXPECTED_ACTIONS = {
  RECEIVED: ['assign rejectItem', 'rejectItem', 'assign rejectItem', null, null],
  REVIEWING: ['assign rejectItem', 'rejectItem', 'assign rejectItem', null, null],
  ASSIGNMENT_PENDING: ['assign rejectItem', 'rejectItem', 'assign rejectItem', null, null],
  ASSIGNED: ['handOver takeBack close', 'takeBack close', 'respond handOver takeBack close', 'respond handOver', 'respond handOver'],
  ACCEPTED: ['handOver takeBack close', 'takeBack close', 'handOver takeBack close', 'handOver', 'handOver'],
  CLOSED: ['', '', '', null, null],
  REJECTED: ['', '', '', null, null],
  RECALLED: ['', '', '', null, null]
};

test('töö tegevused iga seisu ja rolli kohta: leht pakub ainult seda, mida server selles seisus lubab', () => {
  assert.deepEqual(Object.keys(EXPECTED_ACTIONS), Object.values(OrganizationInboxStatus), 'tabelis on iga seis');
  for (const status of Object.values(OrganizationInboxStatus)) {
    VIEWERS.forEach((viewer, index) => {
      const expected = EXPECTED_ACTIONS[status][index];
      if (expected === null) return;
      assert.equal(offered(status, viewer), expected, `${status}, ${viewer.name}`);
    });
  }
});

test('töö tegevused: kolm juhtu, kus leht pakkus tegevust, millest server keeldus', () => {
  const [both, coordinatorOnly, , assignerAssignee] = VIEWERS;
  /* 1. Vastutajata kirjel sulgemist ei ole: server lubab „suletud” ainult kirjel, millel on
        vastutaja. Nii on see ka pärast seda, kui töötaja töö tagasi lükkas. Selle asemel on
        pöördumise tagasilükkamine, mida server sealt lubab. */
  for (const status of ['RECEIVED', 'REVIEWING', 'ASSIGNMENT_PENDING']) {
    for (const viewer of [both, coordinatorOnly]) {
      assert.ok(!offered(status, viewer).includes('close'), `${status}, ${viewer.name}`);
      assert.ok(offered(status, viewer).includes('rejectItem'), `${status}, ${viewer.name}`);
    }
  }
  /* 2. Lõpetatud kirjel ei ole ühtegi tegevust ja töö vaadet ei ole. */
  for (const status of ['CLOSED', 'REJECTED', 'RECALLED']) {
    const actions = workActions(staged(status, { isCoordinator: true }), { context: context({ membership: { id: 'm1' } }), canAssign: true });
    assert.equal(hasWork(actions), false, status);
    assert.deepEqual(itemTabs(actions), ['package'], status);
  }
  /* 3. Sulgemine käib koordinaatori, mitte töö määraja õigusega. */
  for (const status of ['ASSIGNED', 'ACCEPTED']) {
    assert.ok(!offered(status, assignerAssignee).includes('close'), `${status}: määraja, kes ei ole koordinaator`);
    assert.ok(offered(status, coordinatorOnly).includes('close'), `${status}: koordinaator, kes ei ole määraja`);
  }
});

test('töö tegevused: kes mida teha saab', () => {
  /* Koordinaator, kes on ka määraja, ja vastutajata kirje: määramine ja pöördumise tagasilükkamine. */
  assert.deepEqual(workActions(staged('RECEIVED', { isCoordinator: true }), { context: context({ membership: { id: 'm1' } }), canAssign: true }), { assign: true, respond: false, handOver: false, takeBack: false, close: false, rejectItem: true });
  /* Määratud töötaja, kes ei ole määraja: vastamine ja üleandmine, sulgemist ei ole. */
  const pending = staged('ASSIGNED');
  assert.deepEqual(workActions(pending, { context: context(), canAssign: false }), { assign: false, respond: true, handOver: true, takeBack: false, close: false, rejectItem: false });
  /* Juht ei saa töötaja eest vastutust võtta. */
  assert.equal(workActions({ ...pending, isCoordinator: true }, { context: context({ membership: { id: 'm1' } }), canAssign: true }).respond, false);
  /* Vastu võetud töö: vastamist enam ei ole, üle anda saab. */
  assert.deepEqual(workActions(staged('ACCEPTED'), { context: context(), canAssign: false }), { assign: false, respond: false, handOver: true, takeBack: false, close: false, rejectItem: false });
  /* Kõrvaline liige: mitte midagi. */
  const outsider = workActions(pending, { context: context({ membership: { id: 'm9' } }), canAssign: false });
  assert.equal(hasWork(outsider), false);
  assert.deepEqual(itemTabs(outsider), ['package']);
  assert.deepEqual(itemTabs(workActions(staged('RECEIVED', { isCoordinator: true }), { context: context(), canAssign: true })), ['package', 'work']);
  /* Tagasi võetud pöördumine ja kirjutuskaitstud organisatsioon: tööd teha ei saa. */
  assert.equal(hasWork(workActions(staged('RECEIVED', { isCoordinator: true, sourceWithheldReason: 'RECALLED' }), { context: context(), canAssign: true })), false);
  assert.equal(hasWork(workActions({ ...pending, isCoordinator: true }, { context: context({ writable: false }), canAssign: true })), false);
  /* Seisuta kirje (leht ei saanud serverilt seisu): tegevusi ei pakuta. */
  assert.equal(hasWork(workActions({ id: 'i1', isCoordinator: true, assignment: null }, { context: context(), canAssign: true })), false);
  /* Enne üleandmise parandust üle antud rida („vastu võetud” kirje, vastust ootav määramine):
     uus vastutaja saab vastata ja koordinaator töö tagasi võtta või sulgeda, nagu server lubab. */
  const handedOver = staged('ACCEPTED', { isCoordinator: true, assignment: { id: 'a2', membershipId: 'm2', status: 'PENDING' } });
  assert.deepEqual(workActions(handedOver, { context: context(), canAssign: true }), { assign: false, respond: true, handOver: true, takeBack: true, close: true, rejectItem: false });
});

test('töö tagasivõtmine: koordinaator ja ainult kirjel, millel on vastutaja', () => {
  const [both, coordinatorOnly, selfAssigned, assignerAssignee, assignee] = VIEWERS;
  /* Vastust ootav ja vastu võetud töö: iga koordinaator, ka see, kes ei ole töö määraja ja
     see, kelle enda käes töö on. */
  for (const status of ['ASSIGNED', 'ACCEPTED']) {
    for (const viewer of [both, coordinatorOnly, selfAssigned]) assert.ok(offered(status, viewer).includes('takeBack'), `${status}, ${viewer.name}`);
    /* Töö määramise õigus üksi ei anna tagasivõtmist; vastutaja annab töö ära üleandmisega. */
    for (const viewer of [assignerAssignee, assignee]) assert.ok(!offered(status, viewer).includes('takeBack'), `${status}, ${viewer.name}`);
  }
  /* Vastutajata kirjel ei ole midagi tagasi võtta: sama päring muudaks seal ainult seisu sõna. */
  for (const status of ['RECEIVED', 'REVIEWING', 'ASSIGNMENT_PENDING']) assert.ok(!offered(status, both).includes('takeBack'), status);
  /* Koordinaatoril, kes ei ole määraja, on vastutajaga kirjel töö vaade olemas. */
  assert.deepEqual(itemTabs(workActions(staged('ACCEPTED', { isCoordinator: true }), { context: context({ membership: { id: 'm1' } }), canAssign: false })), ['package', 'work']);
  /* Kirjutuskaitstud organisatsioonis ja tagasi võetud pöördumisel tagasivõtmist ei ole. */
  assert.equal(workActions(staged('ACCEPTED', { isCoordinator: true }), { context: context({ writable: false }), canAssign: true }).takeBack, false);
  assert.equal(workActions(staged('ACCEPTED', { isCoordinator: true, sourceWithheldReason: 'RECALLED' }), { context: context(), canAssign: true }).takeBack, false);
  /* Varem lahku läinud read: valesti „saabunud” real võtab tagasivõtmine töö tagasi ja teeb
     rea korda; „ootab määramist” real, millel on elav määramine, server sama seisu uuesti ei
     luba, seega leht seda ei paku. */
  const live = { id: 'a1', membershipId: 'm2', status: 'ACCEPTED' };
  assert.equal(workActions(staged('RECEIVED', { isCoordinator: true, assignment: live }), { context: context({ membership: { id: 'm1' } }), canAssign: true }).takeBack, true);
  assert.equal(workActions(staged('ASSIGNMENT_PENDING', { isCoordinator: true, assignment: live }), { context: context({ membership: { id: 'm1' } }), canAssign: true }).takeBack, false);
});

test('pöördumise tagasilükkamine: koordinaator ja ainult kirjel, kust server seda lubab', () => {
  const [both, coordinatorOnly, selfAssigned, assignerAssignee, assignee] = VIEWERS;
  /* Vastutajata pöördumise lõpetab koordinaator tagasilükkamisega (omaniku otsus 11.10.2026),
     ka see koordinaator, kes ei ole töö määraja: tal on siis töö vaade olemas. */
  for (const status of ['RECEIVED', 'REVIEWING', 'ASSIGNMENT_PENDING']) {
    for (const viewer of [both, coordinatorOnly, selfAssigned]) assert.ok(offered(status, viewer).includes('rejectItem'), `${status}, ${viewer.name}`);
    assert.deepEqual(itemTabs(workActions(staged(status, { isCoordinator: true }), { context: context({ membership: { id: 'm1' } }), canAssign: false })), ['package', 'work'], status);
  }
  /* Vastutajaga töö lõpetab „sulge”; tagasilükkamist seal ei ole kellelgi. */
  for (const status of ['ASSIGNED', 'ACCEPTED']) {
    for (const viewer of VIEWERS) assert.ok(!offered(status, viewer).includes('rejectItem'), `${status}, ${viewer.name}`);
  }
  /* Lõpetatud kirjel, kirjutuskaitstud organisatsioonis ja tagasi võetud pöördumisel seda ei ole. */
  for (const status of ['CLOSED', 'REJECTED', 'RECALLED']) assert.equal(offered(status, both), '', status);
  assert.equal(workActions(staged('RECEIVED', { isCoordinator: true }), { context: context({ writable: false }), canAssign: true }).rejectItem, false);
  assert.equal(workActions(staged('RECEIVED', { isCoordinator: true, sourceWithheldReason: 'RECALLED' }), { context: context(), canAssign: true }).rejectItem, false);
  /* Kes ei ole koordinaator, sellele seda ei pakuta (vastutajata kirjet ta ka ei näe). */
  for (const viewer of [assignerAssignee, assignee]) assert.ok(!offered('RECEIVED', viewer).includes('rejectItem'), viewer.name);
  /* Varem lahku läinud rida („ootab määramist” kirje, millel on elav määramine): server lubab
     tagasilükkamise ja lõpetab ka määramise, seega leht pakub seda. */
  const stale = staged('ASSIGNMENT_PENDING', { isCoordinator: true, assignment: { id: 'a1', membershipId: 'm2', status: 'PENDING' } });
  assert.equal(workActions(stale, { context: context({ membership: { id: 'm1' } }), canAssign: true }).rejectItem, true);
});

test('tekstid on kolmes keeles olemas ja uutes sõnades ei ole mõttekriipsu ega sirgeid jutumärke', () => {
  const old = ['heading', 'privacyNotice', 'status', 'receivedAt', 'assignee', 'unassigned', 'open', 'empty', 'sourcePackage', 'topic', 'situation', 'draft', 'urgency', 'assign', 'accept', 'reject', 'handOver', 'close',
    'backToList', 'openedNotice', 'recalledNotice'];
  const fresh = ['unnamed_worker', 'tabs.label', 'tabs.package', 'tabs.work', 'assign_question', 'handover_question', 'pick_first', 'no_workers', 'response_lead', 'reject_confirm', 'reject_note', 'close_confirm', 'close_note', 'take_back', 'take_back_confirm', 'take_back_note', 'reject_item', 'reject_item_confirm', 'reject_item_note'];
  for (const lang of LANGS) {
    for (const key of [...old, ...fresh]) assert.equal(typeof at(catalog(lang), `org.inbox.${key}`), 'string', `${lang}: org.inbox.${key}`);
  }
  for (const key of fresh) assert.ok(!/[—–]| - |"/.test(at(catalog('et'), `org.inbox.${key}`)), key);
  const count = (path) => (read(path).match(/(?<![A-Za-z0-9_.])call\(/g) || []).length;
  assert.equal(count('../components/org/OrgInboxClient.jsx'), 1);
  assert.equal(count('../components/org/OrgInboxItemClient.jsx'), 7);
  /* Töö vastu võtnud töötaja avab vestlusruumi: nupp on vaates ja päring lehel. */
  for (const lang of LANGS) {
    assert.equal(typeof at(catalog(lang), 'org.inbox.openRoom'), 'string', lang);
    assert.equal(typeof at(catalog(lang), 'pre_inquiries.errors.room_failed'), 'string', lang);
  }
  assert.ok(read('../components/org/inbox/InboxViews.jsx').includes('t("org.inbox.openRoom")'));
  const page = read('../components/org/OrgInboxItemClient.jsx');
  assert.ok(page.includes('/room`, {') && page.includes('item.room?.canOpen'), 'vestlusruumi avamine on lehel alles');
});
