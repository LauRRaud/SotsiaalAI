// Eelpöördumine: KOV kontakt, kelle konto võtab pöördumisi platvormis vastu.
//
// Leht pakkus sellisele kontaktile ainult e-kirja, sest teenusekaardi vastus kanalit ei kanna;
// server salvestas rea aga platvormisisesena ja inimene ei saanud pöördumist ei platvormis saata
// ega e-kirja saadetuks märkida. Omaniku otsus 11.10.2026: leht pakub platvormis saatmist.
// Server annab selliste kontaktide tunnused (`listPreInquiryPlatformContactIds`), leht märgib
// need (`markPlatformContacts`); siin on mõlema käitumine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { listPreInquiryPlatformContactIds } from '../lib/preInquiries.js';
import { markPlatformContacts, recipientChannelKey, recipientChannels } from '../components/workspace/preInquiry/senderModel.js';

/* Väike andmebaasi asendaja: peab meeles, mida küsiti, ja vastab ridadega, mis kontakti
   põhitingimustele vastavad (avaldatud, KOV kontakti liik, aadress olemas). Värskuse tingimus
   (kontaktikontroll) on päringu `AND` osas: seda hindab päris andmebaas, siin vaadatakse, et
   see on päringus olemas. */
function fakeDb({ entries = [], users = [] } = {}) {
  const calls = { entryWhere: null, userWhere: null };
  return {
    calls,
    dataAuditLog: { findFirst: async () => null },
    serviceMapEntry: {
      findMany: async ({ where, select }) => {
        calls.entryWhere = where;
        assert.deepEqual(Object.keys(select).sort(), ['email', 'id'], 'vastusesse loetakse ainult tunnus ja aadress');
        return entries
          .filter((entry) => entry.status === where.status && where.type.in.includes(entry.type) && entry.email !== null && entry.email !== undefined)
          .map((entry) => ({ id: entry.id, email: entry.email }));
      }
    },
    user: {
      findMany: async ({ where }) => {
        calls.userWhere = where;
        return users
          .filter((user) => where.email.in.includes(user.email) && user.acceptsPreInquiries === where.acceptsPreInquiries)
          .map((user) => ({ email: user.email, acceptsPreInquiries: user.acceptsPreInquiries }));
      }
    }
  };
}

const entry = (id, over = {}) => ({ id, type: 'KOV_SOCIAL_CONTACT', status: 'PUBLISHED', email: `${id}@vald.example`, ...over });

test('platvormis kättesaadav on kontakt, kelle aadressiga konto võtab pöördumisi vastu', async () => {
  const db = fakeDb({
    entries: [
      entry('accepts'),
      entry('declines'),
      entry('no-account'),
      entry('general', { type: 'KOV_GENERAL_CONTACT' }),
      entry('no-email', { email: null }),
      entry('draft', { status: 'DRAFT' }),
      /* Teenuseosutaja kanal on teenuse küljes: tema kirjet see loend ei puuduta. */
      entry('provider', { type: 'SERVICE_PROVIDER' }),
      /* Aadress peab olema täpselt sama (sama reegel mis salvestamisel). */
      entry('case', { email: 'Case@vald.example' })
    ],
    users: [
      { email: 'accepts@vald.example', acceptsPreInquiries: true },
      { email: 'declines@vald.example', acceptsPreInquiries: false },
      { email: 'general@vald.example', acceptsPreInquiries: true },
      { email: 'draft@vald.example', acceptsPreInquiries: true },
      { email: 'provider@vald.example', acceptsPreInquiries: true },
      { email: 'case@vald.example', acceptsPreInquiries: true }
    ]
  });
  assert.deepEqual(await listPreInquiryPlatformContactIds({ db }), ['accepts', 'general']);
  /* Päring küsib ainult avaldatud KOV kontakte, millel on aadress ja mis on kontaktikontrolli läbinud. */
  assert.equal(db.calls.entryWhere.status, 'PUBLISHED');
  assert.deepEqual([...db.calls.entryWhere.type.in].sort(), ['KOV_GENERAL_CONTACT', 'KOV_SOCIAL_CONTACT']);
  assert.deepEqual(db.calls.entryWhere.email, { not: null });
  assert.equal(Array.isArray(db.calls.entryWhere.AND) && db.calls.entryWhere.AND.length, 1, 'värskuse tingimus on päringus');
  assert.ok(Array.isArray(db.calls.entryWhere.AND[0].OR), 'värskuse tingimus on sama kujuga mis teenusekaardil');
  assert.equal(db.calls.userWhere.acceptsPreInquiries, true);
});

test('ühtegi kontakti või ühtegi lubavat kontot: tühi loend ja kontosid ei küsita asjata', async () => {
  const none = fakeDb();
  assert.deepEqual(await listPreInquiryPlatformContactIds({ db: none }), []);
  assert.equal(none.calls.userWhere, null);
  const noAccounts = fakeDb({ entries: [entry('a'), entry('b')] });
  assert.deepEqual(await listPreInquiryPlatformContactIds({ db: noAccounts }), []);
  /* Kaks kontakti sama aadressiga: mõlemad on kättesaadavad, aadressi küsitakse üks kord. */
  const shared = fakeDb({
    entries: [entry('a', { email: 'sots@vald.example' }), entry('b', { email: 'sots@vald.example' })],
    users: [{ email: 'sots@vald.example', acceptsPreInquiries: true }]
  });
  assert.deepEqual(await listPreInquiryPlatformContactIds({ db: shared }), ['a', 'b']);
  assert.deepEqual(shared.calls.userWhere.email.in, ['sots@vald.example']);
});

test('leht märgib kättesaadavad kontaktid ja pakub neile platvormi ning e-kirja', () => {
  const kov = { id: 'kov-1', type: 'KOV_SOCIAL_CONTACT', title: 'Sotsiaalosakond', email: 'sots@vald.example' };
  const other = { id: 'kov-2', type: 'KOV_SOCIAL_CONTACT', title: 'Lastekaitse', email: 'laps@vald.example' };
  const desk = { id: 'organization-inbox:org-1', type: 'ORGANIZATION_INBOX', deliveryChannel: 'INTERNAL' };
  const provider = { id: 'entry-1::loc-1', type: 'SERVICE_PROVIDER', serviceActions: [] };
  const entries = [kov, other, desk, provider];
  const marked = markPlatformContacts(entries, ['kov-1', 'entry-1::loc-1', 'unknown', '', null]);
  assert.equal(recipientChannelKey(recipientChannels(marked[0])), 'both');
  /* Märkimata kontakt läheb e-kirjaga nagu enne. */
  assert.equal(marked[1], other);
  assert.equal(recipientChannelKey(recipientChannels(marked[1])), 'email');
  /* Vastuvõtulaud on juba platvormisisene; teenuseosutaja kanal on teenuse küljes ja kirjet ei märgita. */
  assert.equal(marked[2], desk);
  assert.equal(marked[3], provider);
  /* Algne loend ja kirje ei muutu. */
  assert.equal(kov.deliveryChannel, undefined);
  /* Serveri loendita (päring ei õnnestunud) jääb kõik nii, nagu oli. */
  assert.equal(markPlatformContacts(entries, undefined), entries);
  assert.equal(markPlatformContacts(entries, []), entries);
  assert.deepEqual(markPlatformContacts(null, ['kov-1']), []);
});
