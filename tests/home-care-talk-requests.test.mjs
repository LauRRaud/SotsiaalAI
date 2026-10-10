import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CARE_FEEDBACK_INCIDENT_TYPES, CARE_INCIDENT_TYPES, CARE_TALK_INCIDENT_TYPES } from '../lib/homeCare/constants.js';
import { HOME_CARE_EXPORT_KEYS, HOME_CARE_EXPORT_VERSION } from '../lib/homeCare/exportFormat.js';
import { serializeTalk, talkRefusal } from '../lib/homeCare/talkRequests.js';

const incident = (overrides = {}) => ({ kind: 'INCIDENT', incidentType: 'AGGRESSION', retractedAt: null, authorMembershipId: 'm1', companionMembershipId: null, ...overrides });

test('soovin sellest rääkida: kes ja mille juures saab küsida', () => {
  assert.equal(talkRefusal(incident(), 'm1'), null);
  /* Kaasas käinud paariline oli samas olukorras. */
  assert.equal(talkRefusal(incident({ companionMembershipId: 'm2' }), 'm2'), null);
  assert.equal(talkRefusal(incident(), 'm2'), 'home_care.errors.talk_not_author');
  assert.equal(talkRefusal(incident(), null), 'home_care.errors.talk_not_author');
  assert.equal(talkRefusal(incident({ kind: 'NOTE', incidentType: null }), 'm1'), 'home_care.errors.talk_not_incident');
  assert.equal(talkRefusal(incident({ retractedAt: new Date() }), 'm1'), 'home_care.errors.talk_not_incident');
  assert.equal(talkRefusal(null, 'm1'), 'home_care.errors.talk_not_incident');
  /* Tagasiside liigid ei ole rasked juhtumid; iga raske liik on päris erijuhtumi liik. */
  for (const type of CARE_FEEDBACK_INCIDENT_TYPES) assert.equal(talkRefusal(incident({ incidentType: type }), 'm1'), 'home_care.errors.talk_not_incident', type);
  for (const type of CARE_TALK_INCIDENT_TYPES) {
    assert.ok(CARE_INCIDENT_TYPES.includes(type), type);
    assert.equal(talkRefusal(incident({ incidentType: type }), 'm1'), null, type);
  }
});

test('soovin sellest rääkida: esitaja nime näeb ainult teine inimene', () => {
  const row = { id: 't1', membershipId: 'm1', requesterName: 'Anu Kask', createdAt: new Date('2026-10-09T08:00:00Z'), handledAt: null, handledByName: null };
  assert.deepEqual(serializeTalk(row, 'm1'), { id: 't1', state: 'OPEN', mine: true, requesterName: null, requestedAt: '2026-10-09T08:00:00.000Z', handledAt: null, handledByName: null });
  assert.deepEqual([serializeTalk(row, 'm9').mine, serializeTalk(row, 'm9').requesterName], [false, 'Anu Kask']);
  const done = serializeTalk({ ...row, handledAt: new Date('2026-10-09T10:00:00Z'), handledByName: 'Lea Juht' }, 'm1');
  assert.deepEqual([done.state, done.handledAt, done.handledByName], ['HANDLED', '2026-10-09T10:00:00.000Z', 'Lea Juht']);
});

test('soovin sellest rääkida: väljavõtte kogu ja tekstid kolmes keeles', () => {
  assert.ok(HOME_CARE_EXPORT_VERSION >= 32);
  assert.ok(HOME_CARE_EXPORT_KEYS.includes('talkRequests'));
  for (const locale of ['et', 'en', 'ru']) {
    const catalogue = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    for (const key of ['ask', 'ask_hint', 'covision_link', 'sent_line', 'withdraw', 'wants_line', 'handled', 'handled_line', 'list_title', 'list_hint', 'list_line']) {
      assert.ok(catalogue.home_care.talk[key], `${locale} ${key}`);
    }
    for (const key of ['talk_not_incident', 'talk_not_author', 'talk_not_found', 'talk_handled', 'talk_withdrawn']) assert.ok(catalogue.home_care.errors[key], `${locale} ${key}`);
    assert.ok(catalogue.notifications.events.home_care_talk_requested, locale);
    /* Teavituse tekst ei nimeta töötajat ega klienti. */
    assert.equal(/\{/.test(catalogue.notifications.events.home_care_talk_requested), false, locale);
  }
});
