// Kutse (`/org/liitu`) ja tasutud ligipääsu pakkumise (`/org/toetus`) lehed: reeglid ja tekstid.
//
// Mõlemad lehed olid vanal ühisel kihil; nüüd on igal seisul oma väike vaade
// (components/org/join). Otsused on puhaste funktsioonidena failides
// joinRules.js ja ../orgRules.js ning neid kontrollitakse siin käitumise järgi:
// mis seisus leht on, mis read eelvaates seisavad ja millal teist vajutust küsiv
// tegevus päriselt tehakse.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { inviteFacts, joinState, offerFacts, offeredName, organizationName, priceText } from '../components/org/join/joinRules.js';
import { CONFIRM_MS, PRESS_GAP_MS, dayOf, pressTooSoon, secondPress } from '../components/org/orgRules.js';
import { CAPABILITY_TEMPLATES, ORGANIZATION_CAPABILITIES, ORGANIZATION_LEGAL_KINDS, ORGANIZATION_SEAT_ROLES } from '../lib/org/constants.js';
import { toInvitePreview } from '../lib/org/invites.js';
import { dockLabelRoutes, panelHasRoomDock } from '../lib/roomDock.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const LANGS = ['et', 'en', 'ru'];
/* Tõlkija nagu lehel: puuduva võtme korral tagastab võtme enda. */
const translator = (lang) => {
  const messages = catalog(lang);
  return (key, vars) => {
    const value = at(messages, key);
    if (typeof value !== 'string') return key;
    return vars ? value.replace(/\{(\w+)\}/g, (_match, name) => String(vars[name] ?? '')) : value;
  };
};
const t = translator('et');

/* Eelvaade sellisena, nagu server selle annab (lib/org/invites.js). */
const preview = (over = {}) =>
  toInvitePreview({
    organization: { displayName: 'Põltsamaa Vallavalitsus', legalKind: 'MUNICIPALITY' },
    primaryUnit: { id: 'u1', name: 'Sotsiaalosakond' },
    seatRole: 'SOCIAL_WORKER',
    jobTitle: 'Sotsiaaltööspetsialist',
    firstName: 'Kadri',
    lastName: 'Mets',
    capabilityTemplate: 'UNIT_LEAD',
    expiresAt: '2026-10-25T09:00:00.000Z',
    ...over
  });

test('lehe seis: poolik link, ootamine, eelvaade, tõrge, otsus ja lahkumine', () => {
  assert.equal(joinState({ token: '' }), 'no_token');
  assert.equal(joinState({ token: '   ' }), 'no_token', 'tühikutest võti on poolik link');
  assert.equal(joinState({ token: 'abc' }), 'waiting');
  assert.equal(joinState({ token: 'abc', preview: {} }), 'preview');
  assert.equal(joinState({ token: 'abc', error: 'Kutse ei kehti.' }), 'failed');
  /* Vastuse tõrge jätab eelvaate ette: inimene näeb, millele ta vastas, ja saab uuesti proovida. */
  assert.equal(joinState({ token: 'abc', preview: {}, error: 'Kutse ei kehti.' }), 'preview');
  assert.equal(joinState({ token: 'abc', done: 'Kutse on tagasi lükatud.' }), 'done');
  assert.equal(joinState({ token: 'abc', preview: {}, leaving: true }), 'leaving', 'pärast nõustumist on nupud lukus');
  assert.equal(joinState(), 'no_token');
});

test('kutse eelvaate read: mis koht, roll ja õigused pakutakse; tühja rida ega toorest nime ei ole', () => {
  const rows = inviteFacts(preview(), { t });
  assert.deepEqual(rows.map((row) => row.key), ['kind', 'seat', 'jobTitle', 'unit', 'role', 'capabilities', 'expires']);
  assert.deepEqual(rows.map((row) => row.value), [
    'Kohalik omavalitsus',
    'Spetsialisti koht',
    'Sotsiaaltööspetsialist',
    'Sotsiaalosakond',
    'Osakonnajuht',
    'Üksuse juht, Töö määraja',
    dayOf('2026-10-25T09:00:00.000Z')
  ]);

  /* Üksuseta, ametinimetuseta ja õigusteta kutse: read jäävad välja, õiguste rida ütleb seda sõnadega. */
  const plain = inviteFacts(preview({ primaryUnit: null, jobTitle: null, capabilityTemplate: 'MEMBER' }), { t });
  assert.deepEqual(plain.map((row) => row.key), ['kind', 'seat', 'role', 'capabilities', 'expires']);
  const rights = plain.find((row) => row.key === 'capabilities');
  assert.equal(rights.value, 'Haldusõigusi ei anta. Sinust saab liige.');
  assert.equal(rights.quiet, true);
  assert.ok(plain.every((row) => row.value && row.value !== '—'));

  /* Tundmatu mall kliendi poolel: rida jääb välja, toorest väärtust ei näidata. */
  const odd = inviteFacts({ ...preview(), capabilityTemplate: 'TULEVIKU_MALL', capabilities: [] }, { t });
  assert.ok(!odd.some((row) => row.key === 'role'));
  assert.ok(!odd.some((row) => /TULEVIKU/.test(row.value)));
  assert.deepEqual(inviteFacts(null, { t }).map((row) => row.key), ['capabilities']);
});

test('iga mall, õigus, koht ja liik on kolmes keeles loetav sõna', () => {
  for (const lang of LANGS) {
    const tr = translator(lang);
    for (const key of Object.keys(CAPABILITY_TEMPLATES)) {
      for (const seatRole of ORGANIZATION_SEAT_ROLES) {
        for (const row of inviteFacts(preview({ capabilityTemplate: key, seatRole }), { t: tr })) {
          assert.ok(!/org\.|[A-Z]{3,}_[A-Z]/.test(`${row.label} ${row.value}`), `${lang}: ${key}/${seatRole} -> ${row.label}: ${row.value}`);
        }
      }
    }
    for (const capability of ORGANIZATION_CAPABILITIES) {
      assert.equal(typeof at(catalog(lang), `org.capability.${capability}`), 'string', `${lang}: ${capability}`);
    }
    for (const kind of ORGANIZATION_LEGAL_KINDS) {
      const row = inviteFacts(preview({ organization: { displayName: 'X', legalKind: kind } }), { t: tr })[0];
      assert.ok(row.value && !row.value.startsWith('org.'), `${lang}: ${kind}`);
    }
  }
});

test('kes kutsub ja mis nimi pakutakse', () => {
  assert.equal(organizationName(preview(), { t }), 'Põltsamaa Vallavalitsus');
  assert.equal(organizationName(preview({ organization: { displayName: '  ' } }), { t }), 'Organisatsioon');
  assert.equal(offeredName(preview()), 'Kadri Mets');
  assert.equal(offeredName(preview({ lastName: '' })), '', 'pool nime ei ole nimi');
  assert.equal(offeredName(null), '');
  assert.equal(t('org.join.invite_question', { name: organizationName(preview(), { t }) }), 'Põltsamaa Vallavalitsus kutsub sind liituma.');
  assert.equal(t('org.invites.previewName', { name: offeredName(preview()) }).includes('„Kadri Mets”'), true);
});

test('tasutud ligipääsu pakkumine: kes maksab ja kui palju kuus', () => {
  const offer = { organization: { displayName: 'Hoolekandekeskus Päikesekiir MTÜ' }, unitPriceCents: 799, currency: 'EUR' };
  const rows = offerFacts(offer, { t, locale: 'et' });
  assert.deepEqual(rows.map((row) => row.key), ['payer', 'price']);
  assert.equal(rows[0].value, 'Hoolekandekeskus Päikesekiir MTÜ');
  assert.match(rows[1].value, /^7,99\s€$/);
  assert.match(priceText({ unitPriceCents: 500 }, 'et'), /^5,00\s€$/);
  assert.match(priceText({ unitPriceCents: 0 }, 'et'), /^0,00\s€$/, 'tasuta pakkumine ütleb nulli, mitte tühja rida');
  assert.equal(priceText({ unitPriceCents: 'palju' }, 'et'), '');
  assert.equal(priceText({ unitPriceCents: -5 }, 'et'), '');
  assert.equal(priceText({ unitPriceCents: 799, currency: 'VIGANE VALUUTA' }, 'et'), '', 'vigane valuuta ei viska lehte katki');
  assert.deepEqual(offerFacts({ organization: {}, unitPriceCents: null }, { t, locale: 'et' }).map((row) => row.key), ['payer'], 'summata pakkumine ei näita hinda');
});

test('teist vajutust küsiv tegevus: esimene vajutus küsib, topeltklõps ei loe, teine teeb', () => {
  assert.equal(secondPress('', 'decline', 0, 1000), 'arm');
  assert.equal(secondPress('decline', 'decline', 1000, 1000 + PRESS_GAP_MS - 1), 'wait');
  assert.equal(secondPress('decline', 'decline', 1000, 1000 + PRESS_GAP_MS), 'go');
  /* Vajutus teisele tegevusele viib küsimuse sinna üle, mitte ei tee esimest. */
  assert.equal(secondPress('end:m1', 'end:m2', 1000, 5000), 'arm');
  assert.equal(secondPress('decline', '', 1000, 5000), 'arm');
  assert.equal(pressTooSoon(0, 100), false);
  assert.ok(CONFIRM_MS > PRESS_GAP_MS);
});

test('lehed kannavad kiirmenüüd oma nimega ja teevad samad päringud', () => {
  for (const path of ['/org/liitu', '/org/toetus']) {
    assert.equal(panelHasRoomDock(path), true, path);
    /* Täpne tee on nimeallikate järjekorras enne kaarti „Organisatsioonid". */
    const routes = dockLabelRoutes(path, 'token=abc', {});
    assert.ok(routes.indexOf(path) < routes.indexOf('/org'), path);
  }
  const stage = read('../components/room/RoomStage.jsx');
  assert.ok(stage.includes('"/org/liitu": "org.join.dock_invite"'));
  assert.ok(stage.includes('"/org/toetus": "org.join.dock_offer"'));

  const join = read('../components/org/OrgJoinClient.jsx');
  assert.ok(join.includes('call(`/api/org/join?token=${encodeURIComponent(token)}`, {'));
  assert.ok(join.includes('call("/api/org/join", {'));
  const offer = read('../components/org/OrgSponsorshipClient.jsx');
  assert.ok(offer.includes('call(`/api/org/sponsorlus?token=${encodeURIComponent(token)}`, {'));
  assert.ok(offer.includes('call("/api/org/sponsorlus", {'));
  /* Tasutud ligipääsu leht on pöörduja oma: organisatsiooni tööruumi osi seal ei ole. */
  assert.ok(!/OrgHeader|OrgNav/.test(offer));
});

test('tekstid on kolmes keeles olemas ja uutes sõnades ei ole mõttekriipsu ega sirgeid jutumärke', () => {
  const keys = [
    'org.invites.previewHeading',
    'org.invites.previewIntro',
    'org.invites.previewName',
    'org.invites.accept',
    'org.invites.decline',
    'org.invites.declined',
    'org.invites.unit',
    'org.invites.expiresAt',
    'org.members.capabilities',
    'org.overview.legalKind',
    'org.sponsorship.previewHeading',
    'org.sponsorship.previewIntro',
    'org.sponsorship.payer',
    'org.sponsorship.price',
    'org.sponsorship.accept',
    'org.sponsorship.decline',
    'org.sponsorship.accepted',
    'org.sponsorship.declined',
    'org.sponsorship.notice',
    'org.home.heading',
    'org.home.board.privacy_note',
    'org.home.invites.unnamed',
    'org.errors.invite_invalid'
  ];
  for (const lang of LANGS) {
    for (const key of keys) assert.equal(typeof at(catalog(lang), key), 'string', `${lang}: ${key}`);
    const own = catalog(lang).org.join;
    assert.deepEqual(Object.keys(own).sort(), Object.keys(catalog('et').org.join).sort(), `${lang}: org.join`);
  }
  for (const [key, value] of Object.entries(catalog('et').org.join)) {
    assert.ok(!/[—–]| - |"/.test(value), `org.join.${key}: ${value}`);
  }
  /* Iga lehel loetud `org.join.*` võti on kataloogis olemas. */
  const sources = ['../components/org/OrgJoinClient.jsx', '../components/org/OrgSponsorshipClient.jsx', '../components/org/join/JoinViews.jsx', '../components/org/join/joinRules.js'].map(read).join('\n');
  const used = [...sources.matchAll(/"(org\.join\.[a-z_]+)"/g)].map((match) => match[1]);
  assert.ok(used.length >= 12);
  for (const key of used) assert.equal(typeof at(catalog('et'), key), 'string', key);
});
