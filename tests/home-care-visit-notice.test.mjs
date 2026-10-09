// KODUTEENUS kiht 3, K3-d — teade töötajale käikude muutumisest: teate liik, link ja tekstid.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOME_CARE_LIMITS } from '../lib/homeCare/constants.js';
import { NOTIFICATION_EVENT_TYPES, serializeNotificationEvent } from '../lib/notifications.js';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('käikude muutumise teade viitab töötaja liikmesusele ja viib suunajalehele', () => {
  assert.equal(NOTIFICATION_EVENT_TYPES.HOME_CARE_VISITS_CHANGED, 'HOME_CARE_VISITS_CHANGED');
  const shown = serializeNotificationEvent({
    id: 'evt1',
    type: 'HOME_CARE_VISITS_CHANGED',
    sourceType: 'ORGANIZATION_MEMBERSHIP',
    sourceId: 'member123',
    targetKind: 'CARE_WORKER_DAYS',
    targetId: 'member123',
    createdAt: new Date('2026-10-09T08:00:00Z')
  });
  assert.equal(shown.href, '/org/koduteenus/paevad/member123');
  assert.equal(shown.labelKey, 'notifications.events.home_care_visits_changed');
  /* Suunajaleht võtab asutuse vaataja ENDA liikmesuselt ja saadab koduteenuse avalehele. */
  const page = source('../app/org/koduteenus/paevad/[membershipId]/page.jsx');
  assert.match(page, /where: \{ id: String\(membershipId\), userId: auth\.userId \}/);
  assert.match(page, /redirect\(`\/org\/\$\{membership\.organizationId\}\/koduteenus`\)/);
});

test('teate saatja: ainult liikmesuse ID, üks lugemata teade korraga, muutja ise välja jäetud', () => {
  const notify = source('../lib/homeCare/notify.js');
  const body = notify.slice(notify.indexOf('export async function notifyWorkersOfVisitChange'));
  assert.match(body, /id !== actorMembershipId/);
  assert.match(body, /sourceId: member\.id,\s+targetId: member\.id/);
  assert.match(body, /readAt: null,\s+dismissedAt: null/);
  assert.match(body, /if \(unread\) continue;/);
  /* Saatja ei saa kliendi, käigu ega päeva kohta midagi kätte. */
  assert.doesNotMatch(body, /clientId|slotId|\bday\b/);
});

test('hooldaja järgmised päevad: nädal ette ja tekstid kolmes keeles', () => {
  assert.equal(HOME_CARE_LIMITS.MY_DAYS_AHEAD, 7);
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(source(`../messages/${locale}.json`));
    assert.ok(messages.notifications.events.home_care_visits_changed, locale);
    assert.ok(messages.home_care.slots.next_title, locale);
    assert.ok(messages.home_care.slots.next_absent, locale);
  }
});
