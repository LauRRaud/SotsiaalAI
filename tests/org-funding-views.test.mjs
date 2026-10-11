// Organisatsiooni rahastuse osa (`/org/<id>/arveldus`): lehe reeglid ja tekstid.
//
// Leht oli tabel ja kaks vormi üksteise all; nüüd on see kaks loendit, üks avatud
// plaan, kaks väikest vormi ja ühe korra näidatav link. Otsused on puhaste
// funktsioonidena failis components/org/funding/fundingRules.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  EMPTY_PLAN,
  FUNDING_TABS,
  assignableMembers,
  emailLooksRight,
  moneyText,
  planActions,
  planFacts,
  planProblemKey,
  planRow,
  seatLimitOf,
  seatPersonName,
  seatReferencePrice,
  seatRoleOptions,
  seatedPeople,
  shownFundingTab,
  sponsorshipLink,
  sponsorshipReferencePrice,
  sponsorshipRow
} from '../components/org/funding/fundingRules.js';
import { ORGANIZATION_SEAT_ROLES, OrganizationClientSponsorshipStatus } from '../lib/org/constants.js';

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
const plan = (over = {}) => ({
  id: 'p1',
  seatRole: 'SOCIAL_WORKER',
  seatLimit: 3,
  usedSeats: 1,
  freeSeats: 2,
  unitPriceCents: 1499,
  priceReason: null,
  source: 'MANUAL_CONTRACT',
  status: 'ACTIVE',
  assignments: [{ id: 'a1', membershipId: 'm1', person: { firstName: 'Mari', lastName: 'Tamm', email: 'mari@naide.test' } }],
  ...over
});
const MEMBERS = [
  { membershipId: 'm1', seatRole: 'SOCIAL_WORKER', status: 'ACTIVE', person: { firstName: 'Mari', lastName: 'Tamm' } },
  { membershipId: 'm2', seatRole: 'SOCIAL_WORKER', status: 'ACTIVE', person: { firstName: 'Jaan', lastName: 'Kask' } },
  { membershipId: 'm3', seatRole: 'SERVICE_PROVIDER', status: 'ACTIVE', person: { firstName: 'Liis', lastName: 'Saar' } },
  { membershipId: 'm4', seatRole: 'SOCIAL_WORKER', status: 'SUSPENDED', person: { firstName: 'Peeter', lastName: 'Ilves' } }
];

test('summa: puuduv hind ei ole null eurot', () => {
  assert.match(moneyText(1499, 'et'), /^14,99\s€$/);
  assert.match(moneyText(0, 'et'), /^0,00\s€$/);
  assert.equal(moneyText(null, 'et'), '');
  assert.equal(moneyText(undefined, 'et'), '');
  assert.equal(moneyText('palju', 'et'), '');
  assert.equal(moneyText(-1, 'et'), '');
  assert.ok(seatReferencePrice('SOCIAL_WORKER', 'et'));
  assert.ok(sponsorshipReferencePrice('et'));
  assert.equal(seatReferencePrice('TUNDMATU', 'et'), '');
});

test('kohaplaani rida ja read: seis on näha ainult siis, kui plaan ei ole aktiivne', () => {
  const row = planRow(plan(), { t, locale: 'et' });
  assert.equal(row.title, 'Spetsialisti koht');
  assert.match(row.sub, /^hõivatud 1 \/ 3 · vabu 2 · 14,99\s€$/);
  assert.equal(row.chip, '');
  assert.equal(planRow(plan({ status: 'ENDED' }), { t, locale: 'et' }).chip, 'Lõppenud');
  const facts = planFacts(plan({ priceReason: ' Piloot ' }), { t, locale: 'et' });
  assert.deepEqual(facts.map((fact) => fact.key), ['seats', 'price', 'reason', 'source']);
  assert.equal(facts[0].value, 'hõivatud 1 / 3, vabu 2');
  assert.equal(facts.find((fact) => fact.key === 'source').value, 'Käsitsi sõlmitud leping');
  assert.ok(planFacts(plan({ status: 'ENDED' }), { t, locale: 'et' }).some((fact) => fact.key === 'status' && fact.value === 'Lõppenud'));
  for (const lang of LANGS) {
    const tr = translator(lang);
    for (const source of ['PILOT', 'MANUAL_CONTRACT', 'INVOICE', 'FUTURE_CHECKOUT']) {
      for (const status of ['DRAFT', 'ACTIVE', 'ENDED']) {
        for (const fact of planFacts(plan({ source, status }), { t: tr, locale: lang })) assert.ok(!/org\.|[A-Z]{3,}_[A-Z]/.test(`${fact.label} ${fact.value}`), `${lang}: ${source}/${status}`);
      }
    }
  }
});

test('kellel on koht ja kellele saab koha anda', () => {
  assert.deepEqual(seatedPeople(plan(), { t }), [{ id: 'a1', label: 'Mari Tamm' }]);
  assert.equal(seatPersonName({ email: 'ainult@naide.test' }, { t }), 'ainult@naide.test');
  assert.equal(seatPersonName({}, { t }), 'Nimeta töötaja', 'sisemist ID-d nime asemel ei näidata');
  /* Sama rolliga aktiivne liige, kellel kohta ei ole ÜHESKI plaanis. */
  const other = plan({ id: 'p2', assignments: [{ id: 'a2', membershipId: 'm2', person: {} }] });
  assert.deepEqual(assignableMembers(plan(), [plan()], MEMBERS, { t }), [{ value: 'm2', label: 'Jaan Kask' }]);
  assert.deepEqual(assignableMembers(plan(), [plan(), other], MEMBERS, { t }), []);
  assert.deepEqual(assignableMembers(plan({ seatRole: 'SERVICE_PROVIDER', assignments: [] }), [], MEMBERS, { t }), [{ value: 'm3', label: 'Liis Saar' }]);
});

test('mis plaaniga teha saab', () => {
  assert.deepEqual(planActions(plan(), { writable: true }), { assign: true, release: true, end: true });
  assert.equal(planActions(plan({ freeSeats: 0 }), { writable: true }).assign, false, 'täis plaanile kohta juurde ei anta');
  assert.deepEqual(planActions(plan({ status: 'ENDED' }), { writable: true }), { assign: false, release: true, end: false });
  assert.deepEqual(planActions(plan(), { writable: false }), { assign: false, release: false, end: false });
});

test('uue plaani vorm: kohtade arv peab olema täisarv', () => {
  assert.deepEqual({ ...EMPTY_PLAN }, { seatRole: 'SOCIAL_WORKER', seatLimit: '1' });
  assert.equal(seatLimitOf({ seatLimit: '3' }), 3);
  assert.equal(seatLimitOf({ seatLimit: 0 }), 0);
  for (const bad of ['', ' ', '1,5', '-2', 'kolm', '1e3']) assert.equal(seatLimitOf({ seatLimit: bad }), null, bad);
  assert.equal(planProblemKey({ seatLimit: '' }), 'org.funding.need_limit');
  assert.equal(planProblemKey({ seatLimit: '5' }), '');
  assert.deepEqual(seatRoleOptions(t).map((option) => option.value), [...ORGANIZATION_SEAT_ROLES]);
});

test('tasutud ligipääsu rida, link ja vaated', () => {
  const row = sponsorshipRow({ id: 's1', email: ' pooduja@naide.test ', unitPriceCents: 799, status: 'PENDING' }, { t, locale: 'et' });
  assert.equal(row.title, 'pooduja@naide.test');
  assert.match(row.sub, /^7,99\s€$/);
  assert.deepEqual([row.chip, row.canRevoke], ['', true]);
  for (const lang of LANGS) {
    const tr = translator(lang);
    for (const status of Object.values(OrganizationClientSponsorshipStatus)) {
      const built = sponsorshipRow({ id: 's', email: 'a@b.ee', unitPriceCents: 799, status }, { t: tr, locale: lang });
      if (status === 'PENDING') continue;
      assert.ok(built.chip && !/org\.|[A-Z]{4,}/.test(built.chip), `${lang}: ${status} -> ${built.chip}`);
      assert.equal(built.canRevoke, false);
    }
  }
  assert.equal(sponsorshipRow({ id: 's', email: 'a@b.ee', status: 'PENDING' }, { t, locale: 'et', writable: false }).canRevoke, false);
  assert.equal(sponsorshipLink('https://sotsiaal.pro', 'abc+/='), 'https://sotsiaal.pro/org/toetus?token=abc%2B%2F%3D');
  assert.equal(emailLooksRight('a@b.ee'), true);
  assert.equal(emailLooksRight('a@b'), false);
  assert.deepEqual([...FUNDING_TABS], ['plans', 'sponsorships']);
  assert.equal(shownFundingTab('sponsorships'), 'sponsorships');
  assert.equal(shownFundingTab('muu'), 'plans');
});

test('tekstid on kolmes keeles olemas ja päringuid on sama palju kui vanal lehel', () => {
  const old = ['heading', 'privacyNotice', 'plans', 'seatLimit', 'free', 'price', 'source', 'status', 'priceReason', 'addPlan', 'endPlan', 'assign', 'empty', 'sponsorships', 'sponsorshipIntro', 'sponsorEmail',
    'revokeSponsorship', 'noSponsorships', 'linkHeading', 'linkHint'];
  const fresh = ['tabs.label', 'tabs.plans', 'tabs.sponsorships', 'used_of', 'free_count', 'seated', 'nobody_seated', 'release_confirm', 'release_note', 'end_confirm', 'end_note', 'assign_question', 'pick_first',
    'nobody_to_seat', 'role_question', 'limit_question', 'need_limit', 'reference_note', 'adding', 'offer', 'offer_lead', 'make_offer', 'offering', 'need_email', 'link_made', 'revoke_note'];
  for (const lang of LANGS) {
    for (const key of [...old, ...fresh]) assert.equal(typeof at(catalog(lang), `org.funding.${key}`), 'string', `${lang}: org.funding.${key}`);
  }
  for (const key of fresh) assert.ok(!/[—–]| - |"/.test(at(catalog('et'), `org.funding.${key}`)), key);
  assert.equal((read('../components/org/OrgFundingClient.jsx').match(/(?<![A-Za-z0-9_.])call\(/g) || []).length, 9);
});
