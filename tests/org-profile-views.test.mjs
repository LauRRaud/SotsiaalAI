// Organisatsiooni teenuseprofiili osa (`/org/<id>/teenusprofiil`): lehe reeglid ja tekstid.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { PROFILE_FIELDS, PROFILE_TABS, convertSubject, editorName, editorNames, formFromProfile, profileDirty, shownProfileTab } from '../components/org/profile/profileRules.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const LANGS = ['et', 'en', 'ru'];
const t = (key) => {
  const value = at(catalog('et'), key);
  return typeof value === 'string' ? value : key;
};
const PROFILE = { id: 'p1', updatedAt: '2026-10-11T07:00:00.000Z', organizationName: 'Päikesekiir', shortDescription: 'Koduteenus.', phone: '5550 1234', email: null, website: undefined, slug: 'paikesekiir' };

test('vormi algseis ja muutmise tuvastamine: salvestatakse ainult viis välja', () => {
  const form = formFromProfile(PROFILE);
  assert.deepEqual(form, { organizationName: 'Päikesekiir', shortDescription: 'Koduteenus.', phone: '5550 1234', email: '', website: '' });
  assert.deepEqual(Object.keys(form), [...PROFILE_FIELDS], 'vorm ei kanna profiili teisi välju serverisse');
  assert.equal(profileDirty(form, PROFILE), false);
  assert.equal(profileDirty({ ...form, website: 'https://naide.test' }, PROFILE), true);
  assert.equal(profileDirty({ ...form, email: '' }, PROFILE), false, 'puuduv väli ja tühi tekst on sama');
  assert.deepEqual(formFromProfile(null), { organizationName: '', shortDescription: '', phone: '', email: '', website: '' });
});

test('toimetajad on nimedega ja üle antav profiil on nimetatud; sisemist ID-d ei näidata', () => {
  assert.equal(editorName({ firstName: 'Liis', lastName: 'Saar', email: 'liis@naide.test' }, { t }), 'Liis Saar');
  assert.equal(editorName({ email: 'liis@naide.test' }, { t }), 'liis@naide.test');
  assert.equal(editorName({ membershipId: 'cmv123' }, { t }), 'Nimeta inimene');
  assert.deepEqual(editorNames([{ membershipId: 'm1', firstName: 'Liis', lastName: 'Saar' }], { t }), [{ id: 'm1', name: 'Liis Saar' }]);
  assert.deepEqual(editorNames(null, { t }), []);
  assert.equal(convertSubject({ id: 'cmv999', organizationName: ' Minu profiil ' }, { t }), 'Minu profiil');
  assert.equal(convertSubject({ id: 'cmv999', organizationName: '' }, { t }), 'Nimeta profiil');
  assert.deepEqual([...PROFILE_TABS], ['data', 'text', 'editors']);
  assert.equal(shownProfileTab('text'), 'text');
  assert.equal(shownProfileTab('muu'), 'data');
});

test('tekstid on kolmes keeles olemas ja päringuid on sama palju kui vanal lehel', () => {
  const old = ['heading', 'intro', 'editors', 'noEditors', 'convert', 'convertHint', 'convertConfirm', 'noProfile', 'phone', 'email', 'website', 'convertSubject', 'shortDescription', 'save'];
  const fresh = ['tabs.label', 'tabs.data', 'tabs.text', 'tabs.editors', 'unnamed_profile', 'saving', 'unsaved', 'read_only', 'convert_note', 'converting', 'need_confirm'];
  for (const lang of LANGS) {
    for (const key of [...old, ...fresh]) assert.equal(typeof at(catalog(lang), `org.profile.${key}`), 'string', `${lang}: org.profile.${key}`);
  }
  for (const key of fresh) assert.ok(!/[—–]| - |"/.test(at(catalog('et'), `org.profile.${key}`)), key);
});
