// KODUTEENUS kiht 3, K3-e — hooldaja teade „Mul on takistus": sõnastik, andmebaasi piirid, teate liik ja tekstid.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CARE_OBSTACLE_KINDS } from '../lib/homeCare/constants.js';
import { NOTIFICATION_EVENT_TYPES, serializeNotificationEvent } from '../lib/notifications.js';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sql = source('../prisma/migrations/20261010190000_home_care_obstacles/migration.sql');
const list = (text) => [...text.matchAll(/'([A-Z_0-9]+)'/g)].map((match) => match[1]);

test('takistuse teade: andmebaasi CHECK ja koodi sõnastik on samad; vaba teksti välja ei ole', () => {
  assert.deepEqual(list(/"CareObstacle_kind_check"\s+CHECK \("kind" IN \(([^)]*)\)\)/.exec(sql)[1]), [...CARE_OBSTACLE_KINDS]);
  assert.deepEqual([...CARE_OBSTACLE_KINDS], ['LATE_30', 'LATE_60', 'CAR_BROKEN', 'ROAD_BLOCKED', 'CANNOT_WORK']);
  const table = /CREATE TABLE "CareObstacle" \(([\s\S]*?)\n\);/.exec(sql)[1];
  assert.doesNotMatch(table, /"(reason|note|text|diagnosis)"/);
  /* Üks lahtine teade töötaja ja päeva kohta; teade ei ole korraga tagasi võetud ja vaadatud. */
  assert.match(sql, /CREATE UNIQUE INDEX "CareObstacle_open_key" ON "CareObstacle"\("membershipId", "day"\)\s+WHERE "withdrawnAt" IS NULL AND "handledAt" IS NULL;/);
  assert.match(sql, /"CareObstacle_state_check" CHECK \("withdrawnAt" IS NULL OR "handledAt" IS NULL\)/);
  assert.match(sql, /^SET lock_timeout = '5s';\r?\nSET statement_timeout = '30s';/m);
});

test('takistuse teavitus kannab ainult rea ID-d ja viib suunajalehele', () => {
  assert.equal(NOTIFICATION_EVENT_TYPES.HOME_CARE_OBSTACLE_REPORTED, 'HOME_CARE_OBSTACLE_REPORTED');
  const shown = serializeNotificationEvent({
    id: 'evt1',
    type: 'HOME_CARE_OBSTACLE_REPORTED',
    sourceType: 'CARE_OBSTACLE',
    sourceId: 'obstacle123',
    targetKind: 'CARE_OBSTACLE',
    targetId: 'obstacle123',
    createdAt: new Date('2026-10-09T08:00:00Z')
  });
  assert.equal(shown.href, '/org/koduteenus/takistus/obstacle123');
  assert.equal(shown.labelKey, 'notifications.events.home_care_obstacle_reported');
  /* Suunajaleht laseb läbi ainult hooldusjuhi ja viib teate päeva plaani. */
  const page = source('../app/org/koduteenus/takistus/[obstacleId]/page.jsx');
  assert.match(page, /if \(!coordinatorScope\(context\)\) notFound\(\);/);
  assert.match(page, /koduteenus\/paev\?paev=\$\{encodeURIComponent\(obstacle\.day\)\}/);
});

test('teade ise käike ei muuda: teenus ei kirjuta käigumustrisse ega päeva eranditesse', () => {
  const service = source('../lib/homeCare/obstacles.js');
  assert.doesNotMatch(service, /careVisitSlot|careVisitChange/);
  /* Puudumine tekib ainult hooldusjuhi käsul ja ainult teate „ei saa täna töötada" juurest. */
  assert.match(service, /if \(markAbsent && row\.kind !== CareObstacleKind\.CANNOT_WORK\) throw badRequest/);
});

test('takistuse tekstid on kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(source(`../messages/${locale}.json`));
    const hc = messages.home_care;
    assert.ok(messages.notifications.events.home_care_obstacle_reported, locale);
    for (const value of CARE_OBSTACLE_KINDS) {
      assert.ok(hc.obstacle.kinds[value], `${locale} ${value}`);
      assert.ok(hc.obstacle.kinds_about[value], `${locale} ${value}`);
    }
    assert.match(hc.obstacle.sent, /\{time\}[\s\S]*\{kind\}/, locale);
    assert.match(hc.day.obstacle_line, /\{name\}[\s\S]*\{kind\}[\s\S]*\{time\}/, locale);
    assert.match(hc.day.obstacle_seen, /\{line\}/, locale);
    for (const key of ['button', 'choose_title', 'hint', 'send', 'cancel', 'sent_hint', 'handled_hint', 'withdraw', 'change', 'again']) {
      assert.ok(hc.obstacle[key], `${locale} ${key}`);
    }
    for (const key of ['obstacles_title', 'obstacles_hint', 'obstacle_none', 'obstacle_handle', 'obstacle_absent', 'obstacle_handled_saved', 'obstacle_absent_saved']) {
      assert.ok(hc.day[key], `${locale} ${key}`);
    }
    for (const key of [
      'obstacle_kind_required',
      'obstacle_not_worker',
      'obstacle_not_found',
      'obstacle_handled',
      'obstacle_withdrawn',
      'obstacle_absence_invalid',
      'obstacle_busy'
    ]) {
      assert.ok(hc.errors[key], `${locale} ${key}`);
    }
  }
});
