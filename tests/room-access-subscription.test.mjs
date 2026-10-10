// KÕVA REEGEL (SotsiaalAI.md): oma andmetele ligipääs ei aegu tellimusega.
// Ruumi sisu näitamise volitus on liikmesus; tellimus on ainult kirjutamise ja uue alustamise värav.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ROOM_READ, ROOM_WIND_DOWN, ROOM_WRITE, resolveRoomAccess } from '../lib/rooms/accessGuard.js';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function makeDb({ room = {}, member = { userId: 'liige', roomId: 'r1', role: 'MEMBER', billingSource: 'SELF' }, subscription = null } = {}) {
  return {
    room: { findUnique: async () => ({ id: 'r1', archivedAt: null, ownerId: 'omanik', originType: 'MANUAL_INVITE', originId: null, helpMatch: null, ...room }) },
    roomMember: { findFirst: async () => member },
    subscription: { findFirst: async () => subscription }
  };
}
const access = (db, intent, extra = {}) => resolveRoomAccess({ userId: 'liige', userRole: 'CLIENT', roomId: 'r1', intent, db, ...extra });

test('tellimuseta liige loeb ruumi ja lõpetab avatu, aga ei kirjuta', async () => {
  const lapsed = makeDb();
  for (const intent of [ROOM_READ, ROOM_WIND_DOWN]) {
    const result = await access(lapsed, intent);
    assert.deepEqual([result.ok, result.subscriptionInactive, result.readOnly, result.billingSource], [true, true, false, 'SELF'], intent);
  }
  assert.deepEqual(await access(lapsed, ROOM_WRITE), { ok: false, status: 402, message: 'api.common.subscription_required', requireSubscription: true });
  /* Vaikimisi kavatsus on kirjutamine: marsruut, mis lepingut ei nimeta, on tellimuseta kinni. */
  assert.equal((await resolveRoomAccess({ userId: 'liige', userRole: 'CLIENT', roomId: 'r1', db: lapsed })).status, 402);
});

test('tellimusega liikmel ei muutu midagi; abisoovi ruum ja admin on tellimuseta lahti', async () => {
  const paying = makeDb({ subscription: { id: 's1' } });
  for (const intent of [ROOM_READ, ROOM_WIND_DOWN, ROOM_WRITE]) {
    const result = await access(paying, intent);
    assert.deepEqual([result.ok, result.subscriptionInactive, result.billingSource], [true, false, 'SELF'], intent);
  }
  const helpRoom = makeDb({ room: { helpMatch: { id: 'h1' } } });
  assert.deepEqual([(await access(helpRoom, ROOM_WRITE)).ok, (await access(helpRoom, ROOM_WRITE)).subscriptionInactive], [true, false]);
  assert.equal((await access(makeDb(), ROOM_WRITE, { userRole: 'ADMIN' })).ok, true);
});

test('liikmesus on endiselt eeltingimus ja arhiveeritud ruum ei küsi tellimust', async () => {
  /* Võõras ei saa tellimuseta ega tellimusega midagi, ka lugeda mitte. */
  assert.deepEqual(await access(makeDb({ member: null }), ROOM_READ), { ok: false, status: 403, message: 'api.rooms.access_denied' });
  assert.deepEqual(await access(makeDb({ member: null, subscription: { id: 's1' } }), ROOM_READ), { ok: false, status: 403, message: 'api.rooms.access_denied' });
  /* Arhiveeritud ruumis ei aita tellimus: vastus on 409, mitte „vormista tellimus". */
  const archived = makeDb({ room: { archivedAt: new Date('2026-10-01T08:00:00Z') } });
  assert.deepEqual(await access(archived, ROOM_WRITE), { ok: false, status: 409, message: 'api.rooms.archived_readonly' });
  const read = await access(archived, ROOM_READ);
  assert.deepEqual([read.ok, read.readOnly, read.subscriptionInactive], [true, true, true]);
});

test('võrgustikujagamise ruumi piirid kehtivad enne tellimuse küsimust', async () => {
  const shareRoom = (share) => ({
    ...makeDb({ room: { originType: 'NETWORK_SHARE', originId: 'ns1' } }),
    networkShare: { findFirst: async () => share }
  });
  /* Tagasi võetud jagamine: liikmesus üksi ei ole volitus, ka lugemiseks mitte. */
  assert.deepEqual(
    await access(shareRoom({ id: 'ns1', recipientUserId: 'liige', status: 'RECALLED', participationEndsOn: new Date('2027-01-01T00:00:00Z'), roomId: 'r1' }), ROOM_READ),
    { ok: false, status: 403, message: 'api.rooms.access_denied' }
  );
  assert.deepEqual(await access(shareRoom(null), ROOM_READ), { ok: false, status: 403, message: 'api.rooms.access_denied' });
});

test('ruumide loend näitab tellimuseta liikme ruume lugemiseks ja leht ütleb põhjuse', () => {
  const route = source('../app/api/rooms/route.js');
  /* Loend ei filtreeri enam tellimuse järgi, vaid märgib rea. */
  assert.equal(/\.filter\(m => \{[\s\S]{0,200}hasRoomBillingAccess/.test(route), false);
  assert.match(route, /subscriptionReadOnly: !hasRoomBillingAccess\(\{/);
  assert.match(route, /canInvite: isOwner && !isArchived && !m\.subscriptionReadOnly,\n\s+canTransfer: isOwner && !isArchived && !m\.subscriptionReadOnly,\n\s+canLeave: !isOwner && !isArchived,/);
  const page = source('../components/rooms/RoomsPage.jsx');
  assert.match(page, /effectiveRooms\.some\(\(room\) => room\.subscriptionReadOnly\) \? \(\n\s+<p role="status">\n\s+\{t\("rooms\.subscription_readonly"\)\}/);
  /* Ujuvat riba siin ei kasutata: kitsas paneelis jääks see pealkirja peale. */
  assert.equal(page.includes('SubscriptionReadOnlyBanner'), false);
  /* Kirjutamise keeldumine annab põhjuse, mitte vaikse tagasilükkamise. */
  const stream = source('../components/chat/hooks/useChatStream.js');
  assert.match(stream, /if \(res\.status === 402\) \{\n\s+cfg\.setErrorBanner\?\.\(tr\("chat\.error\.subscription_required_profile"\)\);\n\s+return false;\n\s+\}/);
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(source(`../messages/${locale}.json`));
    assert.ok(messages.chat.error.subscription_required_profile.length > 10, locale);
    assert.ok(messages.rooms.subscription_readonly.length > 20, locale);
    assert.ok(messages.subscriptionGate.readonly_cta.length > 3, locale);
    assert.equal(/[\u2014\u2013]/.test(messages.rooms.subscription_readonly), false, locale);
  }
});
