// KODUTEENUS K1-j — peatamise ja lõpetamise alus (SKA koduteenuse juhend 18.06.2024, ptk 5)
// ning kaks erijuhtumi liiki (tagasiside; pakuti kingitust või raha).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CARE_AWAY_REASONS,
  CARE_CLIENT_STATUSES,
  CARE_END_REASONS,
  CARE_INCIDENT_TYPES,
  CARE_STATUS_REASONS,
  COORDINATOR_ONLY_INCIDENT_TYPES,
  CareClientStatus,
  CareIncidentType
} from '../lib/homeCare/constants.js';
import { normalizeStatusInput } from '../lib/homeCare/validation.js';

const refused = (input) =>
  assert.throws(
    () => normalizeStatusInput(input),
    (error) => error.status === 400 && error.messageKey === 'home_care.errors.status_reason_required',
    JSON.stringify(input)
  );

test('seisu alus: ära oleval ja lõppenud kliendil kohustuslik, aktiivsel ei ole', () => {
  /* Aktiivsel alust ei ole; saadetud väärtust ei arvestata (uuesti teenusele tulek ei kanna vana alust kaasa). */
  assert.deepEqual(normalizeStatusInput({ status: 'ACTIVE' }), { status: 'ACTIVE', statusReason: null, statusNote: null });
  assert.equal(normalizeStatusInput({ status: 'ACTIVE', statusReason: 'DIED' }).statusReason, null);

  for (const reason of CARE_AWAY_REASONS) assert.equal(normalizeStatusInput({ status: 'AWAY', statusReason: reason }).statusReason, reason);
  for (const reason of CARE_END_REASONS) assert.equal(normalizeStatusInput({ status: 'ENDED', statusReason: reason }).statusReason, reason);
  assert.deepEqual(normalizeStatusInput({ status: 'AWAY', statusReason: 'HOSPITAL', statusNote: '  alates 9.10 ' }), {
    status: 'AWAY',
    statusReason: 'HOSPITAL',
    statusNote: 'alates 9.10'
  });

  /* Puuduv, tundmatu ja teise seisu alus on viga. */
  for (const status of ['AWAY', 'ENDED']) {
    for (const bad of [undefined, null, '', 'TEADMATA', 5]) refused({ status, statusReason: bad });
  }
  refused({ status: 'AWAY', statusReason: 'DIED' });
  refused({ status: 'ENDED', statusReason: 'HOSPITAL' });

  /* Juhendi neli alust on olemas: abivajadus muutus, surm, elukoha muutus, koostöö või ohutus. */
  for (const ground of ['NO_LONGER_NEEDED', 'DIED', 'MOVED', 'COOPERATION']) assert.ok(CARE_END_REASONS.includes(ground), ground);
  /* Ja see, mida teenus peab edasi lükkama, on eraldi loetav. */
  assert.ok(CARE_END_REASONS.includes('MORE_CARE'));
  assert.deepEqual(Object.keys(CARE_STATUS_REASONS).sort(), [...CARE_CLIENT_STATUSES].sort());
  assert.deepEqual(CARE_STATUS_REASONS[CareClientStatus.ACTIVE], []);
});

test('seisu alus: koodi sõnastik ja andmebaasi CHECK on täpselt samad', () => {
  /* Need alused on andmebaasis CHECK-iga kinni: uus alus vajab migratsiooni, mitte ainult sõnastikku. */
  const sql = readFileSync(new URL('../prisma/migrations/20261010010000_home_care_status_reason/migration.sql', import.meta.url), 'utf8');
  const list = (text) => [...text.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]);
  const away = list(/"toStatus" = 'AWAY'[\s\S]*?IN \(([^)]*)\)/.exec(sql)[1]);
  const ended = list(/"toStatus" = 'ENDED'[\s\S]*?IN \(([^)]*)\)/.exec(sql)[1]);
  assert.deepEqual(away, [...CARE_AWAY_REASONS]);
  assert.deepEqual(ended, [...CARE_END_REASONS]);
  const column = list(/"CareClient_statusReason_check" CHECK \(([\s\S]*?)\n  \);/.exec(sql)[1]);
  assert.deepEqual([...new Set(column)].sort(), [...new Set([...CARE_AWAY_REASONS, ...CARE_END_REASONS])].sort());
  /* Puuduv alus ei pääse läbi: `IS NOT NULL` on mõlemas harus eraldi kirjas. */
  assert.equal((sql.match(/"reason" IS NOT NULL/g) || []).length, 2);
});

test('seisu alused ja uued erijuhtumi liigid on kolmes keeles sõnadega', () => {
  assert.ok(CARE_INCIDENT_TYPES.includes(CareIncidentType.FEEDBACK));
  assert.ok(CARE_INCIDENT_TYPES.includes(CareIncidentType.GIFT_OFFERED));
  /* Kumbki ei ole piiratud nähtavusega: meeskond peab teadma, et kingitust pakuti. */
  assert.equal(COORDINATOR_ONLY_INCIDENT_TYPES.includes(CareIncidentType.GIFT_OFFERED), false);
  assert.equal(COORDINATOR_ONLY_INCIDENT_TYPES.includes(CareIncidentType.FEEDBACK), false);

  for (const locale of ['et', 'en', 'ru']) {
    const hc = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    for (const reason of CARE_AWAY_REASONS) assert.ok(hc.status_reason.AWAY[reason], `${locale} AWAY ${reason}`);
    for (const reason of CARE_END_REASONS) assert.ok(hc.status_reason.ENDED[reason], `${locale} ENDED ${reason}`);
    assert.equal(Object.keys(hc.status_reason.AWAY).length, CARE_AWAY_REASONS.length, locale);
    assert.equal(Object.keys(hc.status_reason.ENDED).length, CARE_END_REASONS.length, locale);
    for (const type of CARE_INCIDENT_TYPES) assert.ok(hc.incident.types[type], `${locale} ${type}`);
    for (const key of ['status_reason', 'status_ended_hint', 'status_history']) assert.ok(hc.client[key], `${locale} ${key}`);
    assert.ok(hc.errors.status_reason_required, locale);
  }
});
