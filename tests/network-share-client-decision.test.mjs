// Audit T02 — kliendi kinnitus käib selle teksti kohta, mida ta luges.
//
// Viga: kui kinnitusega ei tulnud kaasa nähtud teksti räsi, kinnitas server selle
// teksti, mis real parajasti oli. Töötaja muutis teksti ja esitas selle uuesti
// ajal, mil kliendi leht oli veel lahti; klient vajutas „Kinnitan" vana teksti
// all ja tema nõusolek jäi uue teksti külge. Leht räsi ei saatnudki.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientRespondToShare, NetworkShareError } from '../lib/network/share.js';
import { statusForShareError } from '../lib/network/shareRoutes.js';

function fakeDb(row) {
  const writes = [];
  return {
    writes,
    row,
    networkShare: {
      findFirst: async () => (row ? { ...row } : null),
      updateMany: async ({ where, data }) => {
        const matches = Object.entries(where).every(([key, value]) => row[key] === value);
        if (!matches) return { count: 0 };
        writes.push({ where, data });
        Object.assign(row, data);
        return { count: 1 };
      }
    }
  };
}

const awaiting = (extra = {}) => ({
  id: 'share-1',
  clientUserId: 'client-1',
  workerId: 'worker-1',
  status: 'AWAITING_CLIENT',
  contentHash: 'hash-B',
  confirmedContentHash: null,
  ...extra
});
const decide = (db, input) => clientRespondToShare({ prisma: db, shareId: 'share-1', clientUserId: 'client-1', ...input });
const refused = (promise, code) => assert.rejects(promise, (error) => error instanceof NetworkShareError && error.code === code, code);

test('T02: kinnitus ilma nähtud teksti räsita ei kinnita midagi', async () => {
  const db = fakeDb(awaiting());
  for (const missing of [undefined, null, '', '   ']) {
    await refused(decide(db, { decision: 'CONFIRMED', expectedContentHash: missing }), 'network_share.content_hash_required');
  }
  assert.equal(db.writes.length, 0);
  assert.equal(db.row.status, 'AWAITING_CLIENT');
  /* Vastus on 428 (eeltingimus puudu), mitte 400: leht laadib teksti uuesti. */
  assert.equal(statusForShareError(new NetworkShareError('network_share.content_hash_required')).status, 428);
});

test('T02: vana teksti räsiga kinnitus lükatakse tagasi ja nõusolek ei jää uue teksti külge', async () => {
  /* Klient luges versiooni A; real on vahepeal versioon B. */
  const db = fakeDb(awaiting());
  await refused(decide(db, { decision: 'CONFIRMED', expectedContentHash: 'hash-A' }), 'network_share.content_changed');
  assert.equal(db.writes.length, 0);
  assert.equal(db.row.confirmedContentHash, null);
  assert.equal(statusForShareError(new NetworkShareError('network_share.content_changed')).status, 409);
});

test('T02: sama teksti räsiga kinnitus kirjutab tõendi selle teksti kohta', async () => {
  const db = fakeDb(awaiting());
  const share = await decide(db, { decision: 'confirmed', expectedContentHash: ' hash-B ' });
  assert.equal(share.status, 'CONFIRMED');
  assert.equal(db.writes.length, 1);
  /* Kirjutus on tingimuslik: ainult sellele reale, mis on endiselt otsuse ootel ja kannab sama teksti. */
  assert.deepEqual(db.writes[0].where, { id: 'share-1', status: 'AWAITING_CLIENT', contentHash: 'hash-B' });
  assert.equal(db.writes[0].data.confirmedContentHash, 'hash-B');
  assert.equal(db.writes[0].data.clientConfirmationMethod, 'IN_APP');
});

test('T02: tekst muutub lugemise ja kirjutamise vahel: kinnitus ei lähe läbi', async () => {
  const db = fakeDb(awaiting());
  const read = db.networkShare.findFirst;
  db.networkShare.findFirst = async (args) => {
    const seen = await read(args);
    /* Töötaja jõuab vahele pärast seda, kui server rea luges. */
    db.row.contentHash = 'hash-C';
    return seen;
  };
  await refused(decide(db, { decision: 'CONFIRMED', expectedContentHash: 'hash-B' }), 'network_share.content_changed');
  assert.equal(db.writes.length, 0);
});

test('T02: keelduda saab ka aegunud lehelt, aga teadaolevalt muutunud teksti puhul näeb inimene enne uut teksti', async () => {
  /* Keeldumine ei saada kellelegi midagi: räsi ei ole kohustuslik ja tõendit ei teki. */
  const db = fakeDb(awaiting());
  const share = await decide(db, { decision: 'DECLINED' });
  assert.equal(share.status, 'DECLINED');
  assert.equal(db.writes[0].data.confirmedContentHash, null);
  /* Kui leht räsi saatis ja tekst on muutunud, saab inimene nimelise vea. */
  const changed = fakeDb(awaiting());
  await refused(decide(changed, { decision: 'DECLINED', expectedContentHash: 'hash-A' }), 'network_share.content_changed');
  assert.equal(changed.writes.length, 0);
});

test('T02: piirid jäävad samaks: võõras, väline klient ja otsust mitte ootav rida', async () => {
  await refused(clientRespondToShare({ prisma: fakeDb(awaiting()), shareId: 'share-1', clientUserId: 'someone-else', decision: 'CONFIRMED', expectedContentHash: 'hash-B' }), 'network_share.forbidden');
  await refused(decide(fakeDb(awaiting({ clientUserId: null })), { decision: 'CONFIRMED', expectedContentHash: 'hash-B' }), 'network_share.client_is_external');
  await refused(decide(fakeDb(awaiting({ status: 'DRAFT' })), { decision: 'CONFIRMED', expectedContentHash: 'hash-B' }), 'network_share.not_awaiting_client');
  await refused(decide(fakeDb(null), { decision: 'CONFIRMED', expectedContentHash: 'hash-B' }), 'network_share.not_found');
  await refused(decide(fakeDb(awaiting()), { decision: 'MAYBE', expectedContentHash: 'hash-B' }), 'network_share.invalid_decision');
});

test('T02: leht saadab kuvatud teksti räsi ja räsi jõuab ainult otsust ootava kliendini', () => {
  const page = readFileSync(new URL('../components/sharings/MySharingsPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /JSON\.stringify\(\{ decision, expectedContentHash: share\.contentHash \|\| null \}\)/);
  const loader = readFileSync(new URL('../lib/mySharings.js', import.meta.url), 'utf8');
  assert.match(loader, /awaitingDecision && direction === "INCOMING_REQUEST" \? \{ contentHash: share\.contentHash \|\| null \} : \{\}/);
  /* Vead, mida inimene sellel lehel võib näha, on kolmes keeles sõnadega. */
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    for (const key of ['content_changed', 'content_hash_required', 'not_awaiting_client', 'concurrent_change', 'forbidden', 'not_found']) {
      assert.ok(messages.my_sharings.share_errors[key], `${locale} ${key}`);
    }
  }
});
