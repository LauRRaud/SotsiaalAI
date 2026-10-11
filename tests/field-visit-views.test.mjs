// Välitöö külastuse vaade: jaotus vaadeteks ja väikesed reeglid.
//
// Leht oli üks pikk veerg; nüüd on igas faasis kaks kuni kolm vaadet ja korraga
// on ees üks. Siin on kontrollitud see, mida silm ei näe: millal vaade on
// avatav, mis tegevused seadme üksusel on, et tekstid on kolmes keeles ja et
// kustutamine, sulgemine ja ärajätmine küsivad teist vajutust.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  VISIT_PHASES,
  VISIT_VIEWS,
  availableViews,
  closeAllowed,
  deviceItemActions,
  deviceItemTypeKey,
  itemStateTone,
  mainViewOf,
  nextConfirm,
  phaseForStatus,
  photoAllowed,
  placeAfterLoad,
  recordingClock,
  safetyArmed,
  safetyWarnings
} from '../components/field/visit/visitViews.js';
import { FIELD_ITEM_STATE, FIELD_PROVENANCES, FIELD_VISIT_STATUSES } from '../lib/field/constants.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const LANGS = ['et', 'en', 'ru'];

test('faas järgib külastuse olekut ja igal faasil on põhivaade', () => {
  assert.equal(phaseForStatus('DRAFT'), 'prep');
  assert.equal(phaseForStatus('PLANNED'), 'prep');
  assert.equal(phaseForStatus('IN_PROGRESS'), 'on_site');
  assert.equal(phaseForStatus('WRAP_UP'), 'follow_up');
  assert.equal(phaseForStatus('CLOSED'), 'follow_up');
  assert.equal(phaseForStatus('CANCELLED'), 'prep');
  assert.deepEqual([...VISIT_PHASES], Object.keys(VISIT_VIEWS));
  /* Kohapeal tehakse kõige rohkem märkmeid: see on faasi esimene vaade. */
  assert.equal(mainViewOf('prep'), 'pack');
  assert.equal(mainViewOf('on_site'), 'note');
  assert.equal(mainViewOf('follow_up'), 'review');
  assert.equal(mainViewOf('tundmatu'), 'pack');
});

test('suletud külastusel ei ole turvasignaali ega üleandmist; üleandmine vajab serveri külastust', () => {
  assert.deepEqual(availableViews('prep'), ['pack', 'safety']);
  assert.deepEqual(availableViews('prep', { readOnly: true }), ['pack']);
  assert.deepEqual(availableViews('on_site', { readOnly: true }), ['note', 'capture', 'consent']);
  assert.deepEqual(availableViews('follow_up'), ['review', 'handover', 'finish']);
  assert.deepEqual(availableViews('follow_up', { readOnly: true }), ['review', 'finish']);
  assert.deepEqual(availableViews('follow_up', { hasVisit: false }), ['review', 'finish']);
  /* Pildilt loetud või transkribeeritud tekst on omaette vaade kontrolli kõrval;
     teised järeltöö vaated jäävad avatavaks. Teistes faasides seda ei ole. */
  assert.deepEqual(availableViews('follow_up', { hasDraft: true }), ['review', 'aiDraft', 'handover', 'finish']);
  assert.deepEqual(availableViews('follow_up', { hasDraft: true, readOnly: true }), ['review', 'aiDraft', 'finish']);
  assert.deepEqual(availableViews('on_site', { hasDraft: true }), ['note', 'capture', 'consent']);
  /* Igas seisus jääb vähemalt põhivaade: leht ei jää tühjaks. */
  for (const phase of VISIT_PHASES) {
    assert.equal(availableViews(phase, { readOnly: true, hasVisit: false })[0], mainViewOf(phase));
  }
});

test('faas järgib olekut ainult seni, kuni inimene ei ole ise valinud', () => {
  const start = { phase: 'prep', view: 'pack', picked: false };
  assert.equal(placeAfterLoad(start, 'DRAFT'), start, 'sama faas: koht ei muutu');
  assert.equal(placeAfterLoad(start, 'PLANNED'), start);
  assert.deepEqual(placeAfterLoad(start, 'IN_PROGRESS'), { phase: 'on_site', view: 'note', picked: false });
  assert.deepEqual(placeAfterLoad(start, 'WRAP_UP'), { phase: 'follow_up', view: 'review', picked: false });
  assert.deepEqual(placeAfterLoad(start, 'CLOSED'), { phase: 'follow_up', view: 'review', picked: false });
  /* Inimene valis ise (näiteks turvasignaali vaate): värske olek teda ära ei vii. */
  const picked = { phase: 'prep', view: 'safety', picked: true };
  for (const status of ['DRAFT', 'IN_PROGRESS', 'WRAP_UP', 'CLOSED']) assert.equal(placeAfterLoad(picked, status), picked, status);
  /* Kes on juba teises faasis, jääb sinna. */
  const onSite = { phase: 'on_site', view: 'capture', picked: false };
  assert.equal(placeAfterLoad(onSite, 'WRAP_UP'), onSite);
});

test('teine vajutus käivitab ainult sama tegevuse', () => {
  assert.deepEqual(nextConfirm('', 'purge'), { fire: false, confirming: 'purge' });
  assert.deepEqual(nextConfirm('purge', 'purge'), { fire: true, confirming: '' });
  /* Vajutus teisel tegevusel paneb ootele selle teise; esimene ei käivitu. */
  assert.deepEqual(nextConfirm('purge', 'close-visit'), { fire: false, confirming: 'close-visit' });
  assert.deepEqual(nextConfirm('item:a', 'item:b'), { fire: false, confirming: 'item:b' });
});

test('turvasignaal: sees ainult siis, kui on sisse lülitatud ja mitte välja; hoiatused kindlas järjekorras', () => {
  assert.equal(safetyArmed(null), false);
  assert.equal(safetyArmed({ armedAt: '2026-10-09T10:00:00Z' }), true);
  assert.equal(safetyArmed({ armedAt: '2026-10-09T10:00:00Z', cancelledAt: '2026-10-09T11:00:00Z' }), false);
  assert.deepEqual(safetyWarnings({}), []);
  assert.deepEqual(
    safetyWarnings({ escalatedAt: 'x', escalationStatus: 'FAILED', resolvedNoticeStatus: 'FAILED' }),
    ['field.safety.escalated', 'field.safety.escalationFailed', 'field.safety.resolvedFailed']
  );
  assert.deepEqual(safetyWarnings({ escalationStatus: 'UNKNOWN' }), ['field.safety.deliveryUnknown']);
});

test('foto vajab alust ja sulgemine oma tingimusi', () => {
  assert.equal(photoAllowed({}), false);
  assert.equal(photoAllowed({ hasConsent: true }), true);
  assert.equal(photoAllowed({ hasConsent: true, readOnly: true }), false);
  assert.equal(photoAllowed({ documentRequested: true, reason: '   ' }), false);
  assert.equal(photoAllowed({ documentRequested: true, reason: 'palus pildistada otsust' }), true);
  assert.equal(photoAllowed({ documentRequested: false, reason: 'põhjus ilma kinnituseta' }), false);

  assert.equal(closeAllowed({ status: 'WRAP_UP' }), true);
  assert.equal(closeAllowed({ status: 'IN_PROGRESS' }), false);
  assert.equal(closeAllowed({ status: 'WRAP_UP', offline: true }), false);
  assert.equal(closeAllowed({ status: 'WRAP_UP', blocked: true }), false);

  assert.equal(recordingClock(0), '0:00');
  assert.equal(recordingClock(65), '1:05');
  assert.equal(recordingClock(-3), '0:00');
  assert.equal(recordingClock('x'), '0:00');
});

test('seadme üksuse tegevused seisu järgi; eemaldamine on alati viimane', () => {
  const actions = (state, extra = {}) => deviceItemActions({ state, ...extra });
  assert.deepEqual(actions(FIELD_ITEM_STATE.DEVICE_ONLY), ['approve', 'remove']);
  assert.deepEqual(actions(FIELD_ITEM_STATE.QUEUED), ['cancel', 'remove']);
  assert.deepEqual(actions(FIELD_ITEM_STATE.FAILED), ['retry', 'remove']);
  /* Suletud külastusse saab ebaõnnestunud kirje taastada ainult selle veaga. */
  assert.deepEqual(actions(FIELD_ITEM_STATE.FAILED, { lastError: 'field.errors.visit_read_only' }), ['retry', 'recovery', 'remove']);
  assert.deepEqual(actions(FIELD_ITEM_STATE.CONFLICT), ['keepDevice', 'keepServer', 'remove']);
  assert.deepEqual(actions(FIELD_ITEM_STATE.SYNCED), ['remove']);
  assert.deepEqual(actions(FIELD_ITEM_STATE.UPLOADING), ['remove']);

  assert.equal(deviceItemTypeKey({ itemType: 'attachment', payload: { role: 'audio' } }), 'field.item.audio');
  assert.equal(deviceItemTypeKey({ itemType: 'attachment', payload: {} }), 'field.item.photo');
  assert.equal(deviceItemTypeKey({ itemType: 'note', payload: { kind: 'consent' } }), 'field.item.consent');
  assert.equal(deviceItemTypeKey({ itemType: 'note' }), 'field.item.note');

  assert.equal(itemStateTone(FIELD_ITEM_STATE.FAILED), 'alert');
  assert.equal(itemStateTone(FIELD_ITEM_STATE.CONFLICT), 'alert');
  assert.equal(itemStateTone(FIELD_ITEM_STATE.DEVICE_ONLY), 'wait');
  assert.equal(itemStateTone(FIELD_ITEM_STATE.SYNCED), 'ok');
  assert.equal(itemStateTone('TUNDMATU'), '');
});

test('külastuse vaate tekstid on kataloogis kolmes keeles', () => {
  const keys = new Set();
  for (const source of ['../components/field/visit/VisitViews.jsx', '../components/field/FieldVisitRoom.jsx', '../components/field/visit/visitViews.js']) {
    for (const match of read(source).matchAll(/["'`](field\.[A-Za-z_]+(?:\.[A-Za-z_0-9]+)+)["'`]/g)) {
      if (!match[1].startsWith('field.errors.')) keys.add(match[1]);
    }
  }
  assert.ok(keys.size > 60, `võtmeid leiti ${keys.size}`);
  const views = [...Object.values(VISIT_VIEWS).flat(), 'aiDraft'];
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual([...keys].filter((key) => typeof at(messages, key) !== 'string'), [], lang);
    /* Võtmed, mis pannakse kokku koodis: vaated, faasid, olekud, päritolu, seisud, põhjused. */
    for (const view of views) assert.equal(typeof messages.field.view[view], 'string', `${lang}: vaade ${view}`);
    for (const phase of VISIT_PHASES) assert.equal(typeof messages.field.phase[phase], 'string', `${lang}: faas ${phase}`);
    for (const status of FIELD_VISIT_STATUSES) assert.equal(typeof messages.field.status[status], 'string', `${lang}: olek ${status}`);
    for (const value of FIELD_PROVENANCES) assert.equal(typeof messages.field.provenance[value], 'string', `${lang}: päritolu ${value}`);
    for (const state of Object.values(FIELD_ITEM_STATE)) assert.equal(typeof messages.field.itemState[state], 'string', `${lang}: seis ${state}`);
    for (const reason of ['auth', 'conflict', 'rate_limit', 'server', 'network']) {
      assert.equal(typeof messages.field.markers.reason[reason], 'string', `${lang}: põhjus ${reason}`);
    }
    for (const kind of ['note', 'checklist', 'consent', 'photo', 'audio']) assert.equal(typeof messages.field.item[kind], 'string', `${lang}: liik ${kind}`);
    assert.ok(messages.field.safety.armedUntil.includes('{time}'), `${lang}: tähtaja koht`);
    assert.ok(messages.field.review.revision.includes('{revision}'), `${lang}: versiooni koht`);
  }
  /* Vaate nimi on lühike igas keeles: kolm lahtrit peavad telefonis ühele reale mahtuma. */
  for (const lang of LANGS) {
    for (const view of views) assert.ok(catalog(lang).field.view[view].length <= 14, `${lang}: ${view}`);
  }
});
