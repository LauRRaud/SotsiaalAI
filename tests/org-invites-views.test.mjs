// Kutsete osa (`/org/<id>/kutsed`): lehe reeglid ja tekstid.
//
// Leht oli vorm, lingi kast ja tabel üksteise all; nüüd on see loend, kutse
// loomine nelja väikese vaatena ja ühe korra näidatav link. Otsused on puhaste
// funktsioonidena failis components/org/invites/inviteRules.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  EMPTY_INVITE,
  INVITE_STEPS,
  emailLooksRight,
  inviteDirty,
  inviteLink,
  inviteListRow,
  inviteProblem,
  inviteStepStates,
  inviteSummary,
  nameHalf,
  offeredTemplates,
  seatOptions,
  templateNeedsUnit,
  templateOptions,
  unitOptions
} from '../components/org/invites/inviteRules.js';
import { dayOf } from '../components/org/orgRules.js';
import { CAPABILITY_TEMPLATES, CAPABILITY_TEMPLATE_KEYS, ORGANIZATION_SEAT_ROLES, OrganizationInviteStatus } from '../lib/org/constants.js';

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
const UNITS = [{ id: 'u1', name: 'Sotsiaalosakond' }, { id: 'u2', name: 'Lastekaitse' }];
const invite = (over = {}) => ({
  id: 'i1',
  email: 'tiina@naide.test',
  status: 'PENDING',
  seatRole: 'SOCIAL_WORKER',
  capabilityTemplate: 'UNIT_LEAD',
  jobTitle: null,
  firstName: 'Tiina',
  lastName: 'Kivi',
  expiresAt: '2026-10-25T09:00:00.000Z',
  primaryUnit: { id: 'u2', name: 'Lastekaitse' },
  ...over
});
const form = (over = {}) => ({ ...EMPTY_INVITE, ...over });

test('loendi rida: kellele, mis koht, roll ja üksus; seis ei ole kunagi toore nimena', () => {
  const row = inviteListRow(invite(), { t });
  assert.equal(row.title, 'Tiina Kivi');
  assert.equal(row.sub, 'tiina@naide.test · Spetsialisti koht · Osakonnajuht · Lastekaitse');
  assert.equal(row.until, `Kehtib kuni ${dayOf('2026-10-25T09:00:00.000Z')}`);
  assert.equal(row.chip, '', 'ootel kutsel märki ei ole');
  assert.equal(row.canRevoke, true);

  const nameless = inviteListRow(invite({ firstName: null, lastName: null, jobTitle: 'Hooldaja', primaryUnit: null }), { t });
  assert.equal(nameless.title, 'tiina@naide.test');
  assert.equal(nameless.sub, 'Hooldaja · Osakonnajuht', 'e-posti ei korrata ja ametinimetus on koha asemel');

  for (const lang of LANGS) {
    const tr = translator(lang);
    for (const status of Object.values(OrganizationInviteStatus)) {
      const closed = inviteListRow(invite({ status }), { t: tr });
      if (status === 'PENDING') continue;
      assert.ok(closed.chip && !/org\.|[A-Z]{4,}/.test(closed.chip), `${lang}: ${status} -> ${closed.chip}`);
      assert.equal(closed.canRevoke, false);
      assert.equal(closed.until, '');
    }
    for (const key of CAPABILITY_TEMPLATE_KEYS) {
      assert.ok(!/org\.|[A-Z]{3,}_[A-Z]/.test(inviteListRow(invite({ capabilityTemplate: key }), { t: tr }).sub), `${lang}: ${key}`);
    }
  }
  assert.ok(!/TULEVIKU/.test(inviteListRow(invite({ capabilityTemplate: 'TULEVIKU_MALL' }), { t }).sub));
});

test('mis rolle see kutsuja tohib pakkuda', () => {
  const owner = { capabilities: [{ capability: 'ORG_OWNER' }], activeModules: ['HOME_CARE'] };
  assert.deepEqual(offeredTemplates(owner), [...CAPABILITY_TEMPLATE_KEYS]);
  /* Liikmete haldaja, kes ei ole omanik: omaniku ja hooldusjuhi rolli ei paku. */
  const admin = offeredTemplates({ capabilities: [{ capability: 'MEMBER_ADMIN' }], activeModules: ['HOME_CARE'] });
  assert.ok(!admin.includes('ORG_OWNER') && !admin.includes('HOME_CARE_COORDINATOR'));
  assert.ok(admin.includes('MEMBER') && admin.includes('UNIT_LEAD'));
  /* Mooduliga seotud roll ilma moodulita puudub ka omanikul. */
  assert.ok(!offeredTemplates({ capabilities: [{ capability: 'ORG_OWNER' }], activeModules: [] }).includes('HOME_CARE_COORDINATOR'));
  assert.deepEqual(templateOptions(owner, t).map((option) => option.value), [...CAPABILITY_TEMPLATE_KEYS]);
  assert.ok(templateOptions(owner, t).every((option) => option.label && !option.label.startsWith('org.')));
  assert.deepEqual(seatOptions(t).map((option) => option.value), [...ORGANIZATION_SEAT_ROLES]);
  assert.deepEqual(unitOptions(UNITS, t).map((option) => option.value), ['', 'u1', 'u2']);
  assert.equal(unitOptions(UNITS, t)[0].label, 'Üksuseta');
  assert.equal(unitOptions(null, t).length, 1);
});

test('vorm algab vaikevalikutega ja loobumine küsib teist vajutust ainult muudetud vormil', () => {
  assert.deepEqual([...INVITE_STEPS], ['who', 'role', 'unit', 'send']);
  assert.equal(EMPTY_INVITE.seatRole, 'SOCIAL_WORKER');
  assert.equal(EMPTY_INVITE.templateKey, 'MEMBER');
  assert.ok(CAPABILITY_TEMPLATES[EMPTY_INVITE.templateKey]);
  assert.equal(inviteDirty(EMPTY_INVITE), false);
  assert.equal(inviteDirty(form({ email: '  ' })), false);
  assert.equal(inviteDirty(form({ email: 'a@b.ee' })), true);
  assert.equal(inviteDirty(form({ templateKey: 'UNIT_LEAD' })), true, 'muudetud vaikevalik on ka muudatus');
});

test('mis kutse loomiseks puudu on ja kuhu parandama viiakse', () => {
  assert.deepEqual(inviteProblem(form()), { key: 'org.invites.need_email', step: 'who' });
  assert.deepEqual(inviteProblem(form({ email: 'mitte aadress' })), { key: 'org.invites.need_email', step: 'who' });
  assert.deepEqual(inviteProblem(form({ email: 'a@b.ee', firstName: 'Tiina' })), { key: 'org.errors.invite_name_incomplete', step: 'who' });
  assert.equal(inviteProblem(form({ email: 'a@b.ee', firstName: 'Tiina', lastName: 'Kivi' })), null);
  /* Üksusega piiratud roll ilma üksuseta: vana vorm hoidis nuppu hallina, põhjust ütlemata. */
  for (const key of CAPABILITY_TEMPLATE_KEYS) {
    const problem = inviteProblem(form({ email: 'a@b.ee', templateKey: key }));
    assert.deepEqual(problem, templateNeedsUnit(key) ? { key: 'org.invites.need_unit', step: 'unit' } : null, key);
    assert.equal(inviteProblem(form({ email: 'a@b.ee', templateKey: key, primaryUnitId: 'u1' })), null, key);
  }
  assert.equal(templateNeedsUnit('UNIT_LEAD'), true);
  assert.equal(templateNeedsUnit('MEMBER'), false);
  assert.equal(nameHalf(form({ lastName: 'Kivi' })), true);
  assert.equal(nameHalf(form({ firstName: ' ', lastName: ' ' })), false);
  assert.equal(emailLooksRight(' a@b.ee '), true);
  assert.equal(emailLooksRight('a@b'), false);
  /* Iga puuduse lause ja parandamise nupu sõnad on kolmes keeles. */
  for (const problem of [inviteProblem(form()), inviteProblem(form({ email: 'a@b.ee', firstName: 'T' })), inviteProblem(form({ email: 'a@b.ee', templateKey: 'UNIT_LEAD' }))]) {
    assert.ok(INVITE_STEPS.includes(problem.step));
    for (const lang of LANGS) {
      assert.equal(typeof at(catalog(lang), problem.key), 'string', `${lang}: ${problem.key}`);
      assert.equal(typeof at(catalog(lang), `org.invites.to_${problem.step}`), 'string', `${lang}: to_${problem.step}`);
    }
  }
});

test('sammude seis, kokkuvõte ja link', () => {
  assert.deepEqual(inviteStepStates(form()), { who: 'empty', role: 'done', unit: 'done', send: 'empty' });
  assert.equal(inviteStepStates(form({ firstName: 'Tiina' })).who, 'partial');
  assert.equal(inviteStepStates(form({ email: 'a@b.ee' })).who, 'done');
  assert.equal(inviteStepStates(form({ templateKey: 'UNIT_LEAD' })).unit, 'empty');
  assert.equal(inviteStepStates(form({ templateKey: 'UNIT_LEAD', primaryUnitId: 'u1' })).unit, 'done');

  const rows = inviteSummary(form({ email: ' a@b.ee ', firstName: 'Tiina', lastName: 'Kivi', templateKey: 'UNIT_LEAD', primaryUnitId: 'u2' }), UNITS, { t });
  assert.deepEqual(rows.map((row) => [row.key, row.value]), [
    ['email', 'a@b.ee'],
    ['name', 'Tiina Kivi'],
    ['seat', 'Spetsialisti koht'],
    ['role', 'Osakonnajuht'],
    ['unit', 'Lastekaitse']
  ]);
  const plain = inviteSummary(form({ email: 'a@b.ee' }), UNITS, { t });
  assert.deepEqual(plain.map((row) => row.key), ['email', 'seat', 'role', 'unit']);
  assert.deepEqual([plain.at(-1).value, plain.at(-1).quiet], ['Üksuseta', true]);

  assert.equal(inviteLink('https://sotsiaal.pro', 'abc+/='), 'https://sotsiaal.pro/org/liitu?token=abc%2B%2F%3D');
});

test('tekstid on kolmes keeles olemas ja uutes sõnades ei ole mõttekriipsu ega sirgeid jutumärke', () => {
  const own = ['invite_person', 'revoke_named', 'revoke_confirm', 'keep', 'revoke_note', 'decline_note', 'name', 'seat_question', 'role_question', 'role_note',
    'unit_question', 'no_unit', 'unit_needed', 'unit_optional', 'units_none', 'need_email', 'need_unit', 'to_who', 'to_unit', 'send_lead', 'make', 'making', 'link_made', 'link_copy',
    'link_copied', 'steps_label'];
  const old = ['heading', 'intro', 'email', 'unit', 'revoke', 'empty', 'linkHeading', 'linkHint', 'nameHint'];
  for (const lang of LANGS) {
    for (const key of [...own, ...old]) assert.equal(typeof at(catalog(lang), `org.invites.${key}`), 'string', `${lang}: org.invites.${key}`);
    for (const step of INVITE_STEPS) {
      assert.equal(typeof at(catalog(lang), `org.invites.steps.${step}.title`), 'string', `${lang}: ${step}`);
      assert.equal(typeof at(catalog(lang), `org.invites.steps.${step}.short`), 'string', `${lang}: ${step}`);
    }
    assert.equal(typeof at(catalog(lang), 'org.pagination.loadMore'), 'string');
  }
  for (const key of own) assert.ok(!/[—–]| - |"/.test(at(catalog('et'), `org.invites.${key}`)), key);
  /* Platvorm kutsutule kirja ei saada: nupp ei tohi öelda „saada". */
  assert.ok(!/saada/i.test(at(catalog('et'), 'org.invites.make')));
});
