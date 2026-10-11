// Organisatsioonide avaleht (`/org`): lehe reeglid ja vaadete tekstid.
//
// Leht oli üks pikk veerg vanal ühisel kihil; nüüd on see loend, kutsed ja kolm
// väikest loomise vaadet (components/org/home). Lehe otsused on puhaste
// funktsioonidena failis orgBoard.js ja neid kontrollitakse siin käitumise
// järgi: mis seisab real, mis loend on ees, mis loomiseks puudu on ja millal
// liigi valik vaate ise edasi viib.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  CREATE_STEPS,
  EMPTY_FORM,
  NAME_LIMIT,
  REGISTRY_CODE_LIMIT,
  boardShown,
  createDirty,
  createFingerprint,
  createProblem,
  createStepStates,
  createSummary,
  dayOf,
  inviteRow,
  kindAdvances,
  legalKindOptions,
  orgRow,
  pressTooSoon
} from '../components/org/home/orgBoard.js';
import {
  CAPABILITY_TEMPLATES,
  ORGANIZATION_LEGAL_KINDS,
  ORGANIZATION_SEAT_ROLES,
  ORGANIZATION_STATUSES
} from '../lib/org/constants.js';
import { panelHasRoomDock } from '../lib/roomDock.js';

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

const org = (over = {}) => ({ id: 'o1', displayName: 'Põltsamaa Vallavalitsus', legalKind: 'MUNICIPALITY', status: 'ACTIVE', seatRole: 'SOCIAL_WORKER', jobTitle: null, ...over });
const invite = (over = {}) => ({ id: 'i1', organizationName: 'Viljandi Linnavalitsus', seatRole: 'SOCIAL_WORKER', capabilityTemplate: 'UNIT_LEAD', unitName: 'Lastekaitse osakond', expiresAt: '2026-10-25T09:00:00.000Z', ...over });

test('organisatsiooni rida: nimi, liik ja koht; seis on märgina ainult siis, kui see ei ole aktiivne', () => {
  const active = orgRow(org(), { t });
  assert.equal(active.title, 'Põltsamaa Vallavalitsus');
  assert.equal(active.sub, 'Kohalik omavalitsus · Spetsialisti koht');
  assert.equal(active.chip, '', 'aktiivsel real märki ei ole: sõna, mis seisab igal real, ei ütle midagi');
  assert.equal(active.attention, false);

  assert.equal(orgRow(org({ jobTitle: ' Juhtumikorraldaja ' }), { t }).sub, 'Kohalik omavalitsus · Spetsialisti koht · Juhtumikorraldaja');
  assert.equal(orgRow(org({ status: 'DRAFT' }), { t }).chip, 'Mustand');
  assert.equal(orgRow(org({ status: 'PENDING_VERIFICATION' }), { t }).chip, 'Kontrollis');
  const suspended = orgRow(org({ status: 'SUSPENDED' }), { t });
  assert.equal(suspended.chip, 'Peatatud');
  assert.equal(suspended.attention, true, 'peatatud organisatsioon on tähelepanu vajav seis');
  /* Puuduv väli ei jäta reale tühja kohta ega võtit. */
  assert.equal(orgRow({ id: 'o2', displayName: 'Nimeta', status: 'ACTIVE' }, { t }).sub, '');
});

test('ükski seisu, koha ega liigi väärtus ei jõua lehele toore nimena (kolmes keeles)', () => {
  for (const lang of LANGS) {
    const tr = translator(lang);
    for (const status of ORGANIZATION_STATUSES.filter((value) => value !== 'ACTIVE')) {
      const row = orgRow(org({ status }), { t: tr });
      assert.ok(row.chip && !row.chip.includes('org.status.'), `${lang}: seis ${status}`);
    }
    for (const seatRole of ORGANIZATION_SEAT_ROLES) {
      for (const legalKind of ORGANIZATION_LEGAL_KINDS) {
        const row = orgRow(org({ seatRole, legalKind }), { t: tr });
        assert.ok(!/org\.|[A-Z]{3,}_[A-Z]/.test(row.sub), `${lang}: ${seatRole}/${legalKind} -> ${row.sub}`);
      }
    }
    for (const key of Object.keys(CAPABILITY_TEMPLATES)) {
      const row = inviteRow(invite({ capabilityTemplate: key }), { t: tr });
      assert.ok(!/org\.|[A-Z]{3,}_[A-Z]/.test(row.sub), `${lang}: mall ${key} -> ${row.sub}`);
    }
    const options = legalKindOptions(tr);
    assert.deepEqual(options.map((option) => option.value), [...ORGANIZATION_LEGAL_KINDS]);
    assert.ok(options.every((option) => option.label && !option.label.startsWith('org.')), `${lang}: liikide sildid`);
  }
});

test('kutse rida: kes kutsub, mis koht ja roll, mis päevani kehtib', () => {
  const row = inviteRow(invite(), { t });
  assert.equal(row.title, 'Viljandi Linnavalitsus');
  assert.equal(row.sub, 'Spetsialisti koht · Lastekaitse osakond · Osakonnajuht');
  assert.equal(row.until, `Kehtib kuni ${dayOf('2026-10-25T09:00:00.000Z')}`);
  assert.equal(row.expiresAt, '2026-10-25T09:00:00.000Z');

  const bare = inviteRow(invite({ organizationName: null, unitName: null, capabilityTemplate: 'TUNDMATU', expiresAt: 'vigane' }), { t });
  assert.equal(bare.title, 'Organisatsioon', 'nimeta kutse saab üldnime, mitte tühja rea');
  assert.equal(bare.sub, 'Spetsialisti koht');
  assert.equal(bare.until, '');
  /* Server annab serverikomponendile kuupäeva objektina. */
  assert.equal(inviteRow(invite({ expiresAt: new Date('2026-10-25T09:00:00.000Z') }), { t }).expiresAt, '2026-10-25T09:00:00.000Z');
});

test('mis loend on ees: valik kehtib, kuni seal midagi on; tühja loendit ei näidata', () => {
  assert.deepEqual(boardShown({ organizations: 3, invites: 0 }), { shown: 'orgs', choice: false, empty: false });
  assert.deepEqual(boardShown({ organizations: 3, invites: 2 }), { shown: 'orgs', choice: true, empty: false });
  assert.deepEqual(boardShown({ organizations: 3, invites: 2 }, 'invites'), { shown: 'invites', choice: true, empty: false });
  /* Kes ei kuulu kuhugi, aga on kutsutud, näeb kohe kutseid. */
  assert.deepEqual(boardShown({ organizations: 0, invites: 2 }), { shown: 'invites', choice: false, empty: false });
  /* Valitud „kutsed", aga kutseid ei ole: ees on organisatsioonid. */
  assert.deepEqual(boardShown({ organizations: 3, invites: 0 }, 'invites'), { shown: 'orgs', choice: false, empty: false });
  assert.deepEqual(boardShown({ organizations: 0, invites: 0 }), { shown: 'orgs', choice: false, empty: true });
  assert.deepEqual(boardShown(), { shown: 'orgs', choice: false, empty: true });
});

test('loomise vorm algab tühjalt ja liik on valimata', () => {
  assert.deepEqual({ ...EMPTY_FORM }, { displayName: '', legalKind: '', legalName: '', registryCode: '' });
  assert.equal(createDirty(EMPTY_FORM), false);
  assert.equal(createDirty({ ...EMPTY_FORM, displayName: '   ' }), false, 'ainult tühikud ei ole kirjutatu');
  for (const key of Object.keys(EMPTY_FORM)) {
    assert.equal(createDirty({ ...EMPTY_FORM, [key]: key === 'legalKind' ? 'NGO' : 'x' }), true, key);
  }
  assert.deepEqual([...CREATE_STEPS], ['name', 'kind', 'confirm']);
  assert.equal(NAME_LIMIT, 200);
  assert.equal(REGISTRY_CODE_LIMIT, 40);
});

test('mis loomiseks puudu on: nimi ja liik on kohustuslikud, registriandmed mitte', () => {
  assert.deepEqual(createProblem(EMPTY_FORM), { key: 'org.home.create.need_name', step: 'name' });
  assert.deepEqual(createProblem({ ...EMPTY_FORM, displayName: '  ' }), { key: 'org.home.create.need_name', step: 'name' });
  assert.deepEqual(createProblem({ ...EMPTY_FORM, displayName: 'Koduabi OÜ' }), { key: 'org.home.create.need_kind', step: 'kind' });
  assert.deepEqual(createProblem({ ...EMPTY_FORM, displayName: 'Koduabi OÜ', legalKind: 'TUNDMATU' }), { key: 'org.home.create.need_kind', step: 'kind' });
  assert.equal(createProblem({ ...EMPTY_FORM, displayName: 'Koduabi OÜ', legalKind: 'COMPANY' }), null);
  /* Iga puuduse juures on vaade, kuhu nupp viib, ja selle nupu sõnad. */
  for (const form of [EMPTY_FORM, { ...EMPTY_FORM, displayName: 'x' }]) {
    const problem = createProblem(form);
    assert.ok(CREATE_STEPS.includes(problem.step));
    for (const lang of LANGS) {
      assert.equal(typeof at(catalog(lang), problem.key), 'string', `${lang}: ${problem.key}`);
      assert.equal(typeof at(catalog(lang), `org.home.create.to_${problem.step}`), 'string', `${lang}: to_${problem.step}`);
    }
  }
});

test('sammu seis kiirmenüüs', () => {
  assert.deepEqual(createStepStates(EMPTY_FORM), { name: 'empty', kind: 'empty', confirm: 'empty' });
  assert.equal(createStepStates({ ...EMPTY_FORM, registryCode: '80012345' }).name, 'partial', 'ainult registrikood jätab nime vaate pooleli');
  assert.equal(createStepStates({ ...EMPTY_FORM, displayName: 'Koduabi OÜ' }).name, 'done');
  assert.equal(createStepStates({ ...EMPTY_FORM, legalKind: 'COMPANY' }).kind, 'done');
  assert.equal(createStepStates({ ...EMPTY_FORM, legalKind: 'MIDAGI' }).kind, 'empty');
});

test('liigi valik viib vaate edasi ainult esimesel vajutusel, mitte nooleklahviga', () => {
  assert.equal(kindAdvances('', 'NGO'), true);
  assert.equal(kindAdvances('NGO', 'COMPANY'), false, 'juba valitud liigi muutmine jätab vaate ette');
  assert.equal(kindAdvances('', 'NGO', { byArrow: true }), false, 'nooleklahv ei tohi vaadet ära viia');
  assert.equal(kindAdvances('', 'TUNDMATU'), false);
});

test('kokkuvõte ütleb tühjaks jäetud vabatahtliku välja kohta sõna, mitte tühja rida', () => {
  const rows = createSummary({ displayName: ' Koduabi OÜ ', legalKind: 'COMPANY', legalName: '', registryCode: ' 12345678 ' }, { t });
  assert.deepEqual(rows.map((row) => row.key), ['displayName', 'legalKind', 'legalName', 'registryCode']);
  assert.deepEqual(rows.map((row) => row.value), ['Koduabi OÜ', 'Äriühing', 'lisamata', '12345678']);
  assert.equal(rows[2].quiet, true);
  assert.equal(rows[3].quiet, false);
  assert.ok(rows.every((row) => row.label && !row.label.startsWith('org.')));
});

test('sama sisuga uus katse annab sama sõrmejälje, muudetud sisu teise', () => {
  const form = { displayName: 'Koduabi OÜ', legalKind: 'COMPANY', legalName: '', registryCode: '' };
  assert.equal(createFingerprint(form), createFingerprint({ ...form }));
  assert.equal(createFingerprint(form), JSON.stringify(form), 'sõrmejälg on sama, mida vana leht arvutas');
  for (const key of Object.keys(form)) {
    assert.notEqual(createFingerprint(form), createFingerprint({ ...form, [key]: 'NGO' }), key);
  }
});

test('teine vajutus samal nupul ei tule topeltklõpsust', () => {
  assert.equal(pressTooSoon(1000, 1200), true);
  assert.equal(pressTooSoon(1000, 1500), false);
  assert.equal(pressTooSoon(0, 100), false);
});

test('tekstid on kolmes keeles olemas ja lehe sõnades ei ole mõttekriipsu ega sirgeid jutumärke', () => {
  const keys = [
    'org.home.heading',
    'org.home.empty',
    'org.home.openWorkspace',
    'org.home.pendingInvites',
    'org.home.board.join_note',
    'org.home.board.privacy_note',
    'org.home.board.filter.label',
    'org.home.board.filter.invites',
    'org.home.invites.lead',
    'org.home.invites.until',
    'org.home.invites.unnamed',
    'org.home.create.label',
    'org.home.create.name_hint',
    'org.home.create.legal_note',
    'org.home.create.kind_question',
    'org.home.create.missing',
    'org.home.create.founder_note',
    'org.home.create.creating',
    'org.home.create.decline.label',
    'org.home.create.decline.confirm',
    'org.home.create.decline.note',
    'org.create.displayName',
    'org.create.legalName',
    'org.create.registryCode',
    'org.create.legalKindLabel',
    'org.create.submit',
    'org.create.hint',
    'org.switcher.organizations',
    'org.errors.create_failed',
    ...CREATE_STEPS.flatMap((step) => [`org.home.create.steps.${step}.title`, `org.home.create.steps.${step}.short`])
  ];
  for (const lang of LANGS) {
    for (const key of keys) assert.equal(typeof at(catalog(lang), key), 'string', `${lang}: ${key}`);
  }
  const flat = (node, prefix, out = []) => {
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'string') out.push([`${prefix}.${key}`, value]);
      else flat(value, `${prefix}.${key}`, out);
    }
    return out;
  };
  const home = catalog('et').org.home;
  for (const [key, value] of [...flat(home.board, 'org.home.board'), ...flat(home.invites, 'org.home.invites'), ...flat(home.create, 'org.home.create')]) {
    assert.ok(!/[—–]| - |"/.test(value), `${key}: ${value}`);
  }
  assert.equal(translator('et')('org.home.board.filter.invites', { count: 2 }), 'Kutsed (2)');
});

test('leht kannab kiirmenüüd', () => {
  assert.equal(panelHasRoomDock('/org'), true);
});
