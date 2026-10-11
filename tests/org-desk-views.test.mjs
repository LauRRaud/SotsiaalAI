// Avatud organisatsioon: laud ja liikmete osa. Lehe reeglid ja tekstid.
//
// Igal alalehel seisid paneeli ülaservas nimi ja kuni 13 lingiga rida. Nüüd on
// organisatsioon laud (plaadid kõigi osadega, mida inimene näeb) ja osa avaneb
// plaadilt; kes mis osa näeb, on ühes puhtas failis (components/org/orgParts.js).
// Reegleid kontrollitakse siin käitumise järgi.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { DESK_ORDER, capabilityLabel, deskChip, deskNoticeKey, deskTiles, placeFacts, primaryUnitName, seatLine } from '../components/org/desk/orgDesk.js';
import {
  grantNeedsConfirm,
  grantableFor,
  heldRights,
  memberActions,
  memberFacts,
  memberName,
  memberRow,
  memberTabs,
  primaryUnitId,
  shownTab
} from '../components/org/members/memberRules.js';
import { ORG_PARTS, visibleOrgParts } from '../components/org/orgParts.js';
import { ORGANIZATION_CAPABILITIES, ORGANIZATION_MODULE_KEYS, requiredModulesForCapability } from '../lib/org/constants.js';
import { panelHasRoomDock } from '../lib/roomDock.js';

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
const grants = (...names) => names.map((capability) => ({ capability, scopeType: 'ORGANIZATION', scopeUnitId: null }));

const context = (over = {}) => ({
  writable: true,
  payerSource: 'ORGANIZATION',
  organization: { id: 'o1', displayName: 'Põltsamaa Vallavalitsus', status: 'ACTIVE', legalKind: 'MUNICIPALITY' },
  membership: { id: 'm1', seatRole: 'SOCIAL_WORKER', jobTitle: null },
  units: [
    { id: 'u2', name: 'Koduteenuse tiim', isPrimary: false },
    { id: 'u1', name: 'Sotsiaalosakond', isPrimary: true }
  ],
  capabilities: [],
  activeModules: [],
  ...over
});

test('kes mis osa näeb: õigus ja moodul otsustavad, järjekord on vana lingirea oma', () => {
  const plain = visibleOrgParts('o1', {}).map((part) => part.key);
  assert.deepEqual(plain, ['overview', 'structure', 'support', 'service_reports', 'dispatch']);
  assert.deepEqual(visibleOrgParts('o1', {})[0], { key: 'overview', href: '/org/o1' });
  assert.equal(visibleOrgParts('o1', {}).find((part) => part.key === 'support').href, '/org/o1/tugi');

  const admin = visibleOrgParts('o1', { capabilities: grants('MEMBER_ADMIN') }).map((part) => part.key);
  assert.ok(admin.includes('members') && admin.includes('invites'));
  assert.ok(!admin.includes('settings') && !admin.includes('audit') && !admin.includes('funding'));

  /* Vastuvõtt ja koduteenus sõltuvad MOODULIST, mitte õigusest. */
  assert.ok(visibleOrgParts('o1', { activeModules: ['KOV_INTAKE'] }).some((part) => part.key === 'inbox'));
  assert.ok(visibleOrgParts('o1', { activeModules: ['HOME_CARE'] }).some((part) => part.key === 'home_care'));
  /* Teenuseprofiil nõuab mõlemat: õigust JA moodulit. */
  assert.ok(!visibleOrgParts('o1', { capabilities: grants('SERVICE_PROFILE_EDITOR') }).some((part) => part.key === 'profile'));
  assert.ok(!visibleOrgParts('o1', { activeModules: ['SERVICE_DELIVERY'] }).some((part) => part.key === 'profile'));
  assert.ok(visibleOrgParts('o1', { capabilities: grants('SERVICE_PROFILE_EDITOR'), activeModules: ['SERVICE_DELIVERY'] }).some((part) => part.key === 'profile'));

  const all = visibleOrgParts('o1', { capabilities: grants(...ORGANIZATION_CAPABILITIES), activeModules: [...ORGANIZATION_MODULE_KEYS] });
  assert.deepEqual(all.map((part) => part.key), ORG_PARTS.map((part) => part.key));
  /* Iga osa nõutud õigus ja moodul on päris väärtused. */
  for (const part of ORG_PARTS) {
    if (part.requires) assert.ok(ORGANIZATION_CAPABILITIES.includes(part.requires), part.key);
    if (part.requiresModule) assert.ok(ORGANIZATION_MODULE_KEYS.includes(part.requiresModule), part.key);
  }
});

test('iga osa marsruut on olemas ja selle nimi ning laua rida on kolmes keeles', () => {
  for (const part of ORG_PARTS) {
    const file = new URL(`../app/org/[orgId]${part.path}/page.jsx`, import.meta.url);
    assert.ok(fs.existsSync(file), `marsruut ${part.path || '/'}`);
    for (const lang of LANGS) {
      assert.equal(typeof at(catalog(lang), `org.nav.${part.key}`), 'string', `${lang}: org.nav.${part.key}`);
      if (part.key !== 'overview') assert.equal(typeof at(catalog(lang), `org.desk.lines.${part.key}`), 'string', `${lang}: org.desk.lines.${part.key}`);
    }
  }
  /* Laua järjekord nimetab ainult päris osi ja kõiki peale ülevaate. */
  assert.deepEqual([...DESK_ORDER].sort(), ORG_PARTS.map((part) => part.key).filter((key) => key !== 'overview').sort());
  /* Vana lingirida loeb sama loendit. */
  assert.ok(read('../components/org/OrgNav.jsx').includes('visibleOrgParts(organizationId, { capabilities, activeModules })'));
});

test('laua plaadid: igapäevane töö ees, haldus lõpus, viimane on „Minu koht”', () => {
  const tiles = deskTiles(context({ capabilities: grants(...ORGANIZATION_CAPABILITIES), activeModules: [...ORGANIZATION_MODULE_KEYS] }), { t });
  assert.deepEqual(tiles.map((tile) => tile.key), [...DESK_ORDER, 'place']);
  assert.equal(tiles.at(-1).href, '', '„Minu koht” on laua enda vaade, mitte marsruut');
  assert.ok(tiles.slice(0, -1).every((tile) => tile.href.startsWith('/org/o1/')));
  assert.ok(tiles.every((tile) => tile.name && tile.line && !tile.name.startsWith('org.') && !tile.line.startsWith('org.')));
  assert.equal(tiles[0].name, 'Vastuvõtt');

  /* Õigusteta liige näeb ainult seda, mis on iga liikme oma. */
  assert.deepEqual(deskTiles(context(), { t }).map((tile) => tile.key), ['dispatch', 'service_reports', 'support', 'structure', 'place']);
  for (const lang of LANGS) {
    const tr = translator(lang);
    for (const tile of deskTiles(context({ capabilities: grants(...ORGANIZATION_CAPABILITIES), activeModules: [...ORGANIZATION_MODULE_KEYS] }), { t: tr })) {
      assert.ok(!/org\./.test(`${tile.name} ${tile.line}`), `${lang}: ${tile.key}`);
    }
  }
});

test('laua ülaserv: inimese koht, seisu märk ja põhjus, miks muuta ei saa', () => {
  assert.equal(primaryUnitName(context()), 'Sotsiaalosakond');
  assert.equal(primaryUnitName(context({ units: [{ id: 'u9', name: 'Ainus', isPrimary: false }] })), 'Ainus');
  assert.equal(seatLine(context(), { t }), 'Spetsialisti koht · Sotsiaalosakond');
  assert.equal(seatLine(context({ membership: { seatRole: 'SOCIAL_WORKER', jobTitle: ' Juhtumikorraldaja ' }, units: [] }), { t }), 'Juhtumikorraldaja');

  assert.equal(deskChip(context(), { t }), null, 'aktiivsel organisatsioonil märki ei ole');
  assert.deepEqual(deskChip(context({ organization: { status: 'SUSPENDED' } }), { t }), { text: 'Peatatud', attention: true });
  assert.deepEqual(deskChip(context({ organization: { status: 'DRAFT' } }), { t }), { text: 'Mustand', attention: false });

  assert.equal(deskNoticeKey(context()), '');
  assert.equal(deskNoticeKey(context({ writable: false, organization: { status: 'SUSPENDED' } })), 'org.overview.readOnlyNotice');
  assert.equal(deskNoticeKey(context({ writable: false, organization: { status: 'PENDING_VERIFICATION' } })), 'org.overview.pendingNotice');
  /* Mustandi omanikule öeldakse, kus mustand kontrolli saata; liikmele mitte. */
  assert.equal(deskNoticeKey(context({ writable: false, organization: { status: 'DRAFT' }, capabilities: grants('ORG_OWNER') })), 'org.desk.draft_notice');
  assert.equal(deskNoticeKey(context({ writable: false, organization: { status: 'DRAFT' } })), 'org.overview.pendingNotice');
  for (const lang of LANGS) {
    for (const key of ['org.overview.readOnlyNotice', 'org.overview.pendingNotice', 'org.desk.draft_notice', 'org.overview.privacyNotice', 'org.desk.rail_label', 'org.desk.part_title', 'org.desk.place.name']) {
      assert.equal(typeof at(catalog(lang), key), 'string', `${lang}: ${key}`);
    }
  }
});

test('„Minu koht”: põhiüksus on öeldud sõnaga, üksusega piiratud õigus nimetab üksuse', () => {
  const rows = placeFacts(context({ capabilities: [...grants('MEMBER_ADMIN'), { capability: 'UNIT_LEAD', scopeType: 'UNIT', scopeUnitId: 'u1' }], activeModules: ['KOV_INTAKE'] }), { t });
  const value = (key) => rows.find((row) => row.key === key)?.value;
  assert.equal(value('status'), 'Aktiivne');
  assert.equal(value('seat'), 'Spetsialisti koht');
  assert.equal(value('payer'), 'Organisatsioon');
  assert.equal(value('units'), 'Koduteenuse tiim, Sotsiaalosakond (põhiüksus)');
  assert.equal(value('capabilities'), 'Liikmete haldus, Üksuse juht (Sotsiaalosakond)');
  assert.equal(value('modules'), 'Vastuvõtt');
  assert.ok(!rows.some((row) => row.key === 'jobTitle'), 'tühi rida jääb välja');
  assert.ok(!rows.some((row) => /★/.test(row.value)));

  const bare = placeFacts(context({ units: [], capabilities: [], activeModules: [] }), { t });
  assert.equal(bare.find((row) => row.key === 'units').quiet, true);
  assert.equal(bare.find((row) => row.key === 'capabilities').value, t('org.overview.noCapabilities'));
  assert.equal(capabilityLabel({ capability: 'UNIT_LEAD', scopeType: 'UNIT', scopeUnitId: 'võõras' }, [], { t }), 'Üksuse juht (Üksus)');
});

const member = (over = {}) => ({
  membershipId: 'm2',
  status: 'ACTIVE',
  seatRole: 'SOCIAL_WORKER',
  jobTitle: 'Sotsiaaltööspetsialist',
  person: { firstName: 'Jaan', lastName: 'Kask', email: 'jaan@naide.test' },
  units: [
    { id: 'u2', name: 'Koduteenuse tiim', isPrimary: false },
    { id: 'u1', name: 'Sotsiaalosakond', isPrimary: true }
  ],
  capabilities: [{ id: 'g1', capability: 'UNIT_LEAD', scopeType: 'UNIT', scopeUnitId: 'u1' }],
  ...over
});
const UNITS = [{ id: 'u1', name: 'Sotsiaalosakond' }, { id: 'u2', name: 'Koduteenuse tiim' }];

test('liikme rida ja read: nimeta liikme nimi on e-post ja seda ei korrata', () => {
  const row = memberRow(member(), { t });
  assert.equal(row.title, 'Jaan Kask');
  assert.equal(row.sub, 'Sotsiaaltööspetsialist · Sotsiaalosakond, Koduteenuse tiim · Üksuse juht');
  assert.equal(row.chip, '');
  assert.deepEqual([memberRow(member({ status: 'SUSPENDED' }), { t }).chip, memberRow(member({ status: 'SUSPENDED' }), { t }).attention], ['Peatatud', true]);
  const many = member({ capabilities: [{ id: 'a', capability: 'ORG_OWNER' }, { id: 'b', capability: 'MEMBER_ADMIN' }, { id: 'c', capability: 'AUDIT_VIEWER' }] });
  assert.ok(memberRow(many, { t }).sub.endsWith('Organisatsiooni omanik ja veel 2'));

  const nameless = member({ person: { firstName: null, lastName: null, email: 'ainult@naide.test' }, jobTitle: null, units: [], capabilities: [] });
  assert.equal(memberName(nameless), 'ainult@naide.test');
  assert.equal(memberRow(nameless, { t }).sub, 'Spetsialisti koht');
  assert.ok(!memberFacts(nameless, { t }).some((fact) => fact.key === 'email'), 'e-post on juba nimi');
  assert.equal(memberFacts(nameless, { t }).find((fact) => fact.key === 'units').value, 'Üksusesse määramata');
  const facts = memberFacts(member(), { t });
  assert.equal(facts.find((fact) => fact.key === 'email').value, 'jaan@naide.test');
  assert.equal(facts.find((fact) => fact.key === 'units').value, 'Sotsiaalosakond (põhiüksus), Koduteenuse tiim');
  assert.equal(primaryUnitId(member()), 'u1');
  assert.equal(primaryUnitId(member({ units: [] })), '');
});

test('õigused: mis tal on, mida saab anda ja mis küsib teist vajutust', () => {
  assert.deepEqual(heldRights(member(), UNITS, { t }), [{ id: 'g1', capability: 'UNIT_LEAD', label: 'Üksuse juht (Sotsiaalosakond)' }]);
  /* Üksusega piiratud õigus ei võta ära võimalust anda sama õigust kogu organisatsioonis. */
  assert.ok(grantableFor(member(), []).includes('UNIT_LEAD'));
  const held = member({ capabilities: [{ id: 'g2', capability: 'MEMBER_ADMIN', scopeType: 'ORGANIZATION' }] });
  assert.ok(!grantableFor(held, []).includes('MEMBER_ADMIN'));
  /* Moodulita õigus ei ole loendis. */
  for (const capability of ORGANIZATION_CAPABILITIES) {
    const needs = requiredModulesForCapability(capability);
    assert.equal(grantableFor(member({ capabilities: [] }), []).includes(capability), needs.length === 0, capability);
    assert.equal(grantableFor(member({ capabilities: [] }), [...ORGANIZATION_MODULE_KEYS]).includes(capability), true, capability);
  }
  assert.equal(grantNeedsConfirm('ORG_OWNER'), true);
  assert.equal(grantNeedsConfirm('MEMBER_ADMIN'), false);
});

test('mis tegevused on liikmega lubatud ja mis vaated tal on', () => {
  const open = memberActions(member(), { writable: true, canGrant: true, units: UNITS, activeModules: [] });
  assert.deepEqual([open.suspend, open.reactivate, open.end, open.setUnit, open.revoke], [true, false, true, true, true]);
  assert.ok(open.grant.length > 0);
  assert.deepEqual(memberTabs(open), ['member', 'unit', 'rights']);

  const suspended = memberActions(member({ status: 'SUSPENDED' }), { writable: true, canGrant: true, units: UNITS });
  assert.deepEqual([suspended.suspend, suspended.reactivate, suspended.end], [false, true, true]);
  assert.deepEqual(suspended.grant, [], 'peatatud liikmele õigust ei anta');

  /* Liikmete haldaja, kes ei ole omanik: õigusi ei anna ega võta. */
  const admin = memberActions(member(), { writable: true, canGrant: false, units: UNITS });
  assert.deepEqual([admin.revoke, admin.grant], [false, []]);

  /* Kirjutuskaitstud organisatsioon (mustand, peatatud): ühtegi tegevust ei ole. */
  const locked = memberActions(member(), { writable: false, canGrant: true, units: UNITS, activeModules: [...ORGANIZATION_MODULE_KEYS] });
  assert.deepEqual(locked, { suspend: false, reactivate: false, end: false, setUnit: false, revoke: false, grant: [] });
  assert.deepEqual(memberTabs(locked), ['member', 'rights']);
  assert.deepEqual(memberTabs(memberActions(member(), { writable: true, units: [] })), ['member', 'rights'], 'üksusteta organisatsioonis põhiüksuse vaadet ei ole');
  assert.equal(shownTab(['member', 'rights'], 'unit'), 'member');
  assert.equal(shownTab(['member', 'unit', 'rights'], 'rights'), 'rights');
});

test('lauad kannavad kiirmenüüd ja liikmete lehe tekstid on kolmes keeles', () => {
  assert.equal(panelHasRoomDock('/org/abc'), true);
  assert.equal(panelHasRoomDock('/org/abc/liikmed'), true);
  const keys = [
    'heading', 'empty', 'privacyNotice', 'email', 'units', 'status', 'suspend', 'reactivate', 'end', 'rights_more', 'units_none', 'back',
    'end_confirm', 'end_note', 'ended', 'unit_question', 'rights_held', 'rights_none', 'rights_grant', 'revoke_confirm', 'revoke_note',
    'rights_owner_only', 'grant_confirm', 'grant_owner_note', 'tabs.label', 'tabs.member', 'tabs.unit', 'tabs.rights'
  ];
  for (const lang of LANGS) {
    for (const key of keys) assert.equal(typeof at(catalog(lang), `org.members.${key}`), 'string', `${lang}: org.members.${key}`);
    for (const status of ['ACTIVE', 'SUSPENDED', 'ENDED']) assert.equal(typeof at(catalog(lang), `org.membershipStatus.${status}`), 'string');
  }
  for (const key of ['rights_more', 'units_none', 'back', 'end_confirm', 'end_note', 'ended', 'unit_question', 'rights_held', 'rights_none', 'rights_grant', 'revoke_confirm', 'revoke_note', 'rights_owner_only', 'grant_confirm', 'grant_owner_note']) {
    assert.ok(!/[—–]| - |"/.test(at(catalog('et'), `org.members.${key}`)), key);
  }
  for (const value of Object.values(catalog('et').org.desk.lines)) assert.ok(!/[—–]| - |"/.test(value), value);
});
