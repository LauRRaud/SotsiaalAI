// Organisatsiooni auditi osa (`/org/<id>/audit`): sündmuse rida on lause, mitte sisemine nimi.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { actionKey, auditRow } from '../components/org/audit/auditRules.js';
import { stampOf } from '../components/org/orgRules.js';
import { ORG_AUDIT_ACTIONS } from '../lib/org/audit.js';

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

test('toimingu rida on lause ja aeg; toorest nime ei näidata ühegi toimingu korral', () => {
  const row = auditRow({ id: 'e1', action: 'org.member_suspended', resourceType: 'ORGANIZATION_MEMBERSHIP', createdAt: '2026-10-11T07:32:00.000Z' }, { t });
  assert.deepEqual(row, { id: 'e1', title: 'Liikmesus peatati', time: stampOf('2026-10-11T07:32:00.000Z'), createdAt: '2026-10-11T07:32:00.000Z' });
  /* Iga serveri toiming annab kolmes keeles loetava lause (täpse või üldnime). Uus
     toiming, millel lauset veel ei ole, ei tohi seda testi murda ega lehele toorena jõuda. */
  for (const lang of LANGS) {
    const tr = translator(lang);
    for (const action of ORG_AUDIT_ACTIONS) {
      const title = auditRow({ id: 'e', action, createdAt: '2026-10-11T07:32:00.000Z' }, { t: tr }).title;
      assert.ok(title && !/org\.|_/.test(title), `${lang}: ${action} -> ${title}`);
    }
  }
  /* Koduteenuse toiming ilma oma lauseta saab koduteenuse üldnime, muu tundmatu toiming üldnime. */
  assert.equal(auditRow({ id: 'e2', action: 'org.home_care_tuleviku_toiming', createdAt: null }, { t }).title, 'Koduteenuse toiming');
  assert.equal(auditRow({ id: 'e3', action: 'org.tuleviku_toiming', createdAt: null }, { t }).title, 'Muu haldustoiming');
  assert.equal(auditRow({ id: 'e4', action: 'midagi/veidrat', createdAt: 'vigane' }, { t }).title, 'Muu haldustoiming');
  assert.deepEqual([auditRow({ id: 'e5', action: 'org.unit_created', createdAt: 'vigane' }, { t }).time, auditRow({ id: 'e5', action: 'org.unit_created', createdAt: 'vigane' }, { t }).createdAt], ['', '']);
  assert.equal(actionKey('org.unit_created'), 'org.audit.actions.unit_created');
  assert.equal(actionKey('org.Unit Created'), '');
});

test('iga kataloogi lause kuulub päris toimingule ja on kolmes keeles', () => {
  const names = new Set(ORG_AUDIT_ACTIONS.map((action) => action.replace(/^org\./, '')));
  for (const lang of LANGS) {
    const labels = catalog(lang).org.audit.actions;
    assert.deepEqual(Object.keys(labels).sort(), Object.keys(catalog('et').org.audit.actions).sort(), lang);
    for (const name of Object.keys(labels)) assert.ok(names.has(name), `${lang}: lause toimingule, mida ei ole: ${name}`);
    for (const key of ['heading', 'intro', 'empty', 'loadMore', 'loadFailed', 'other', 'home_care', 'shown']) assert.equal(typeof at(catalog(lang), `org.audit.${key}`), 'string', `${lang}: ${key}`);
  }
  for (const value of Object.values(catalog('et').org.audit.actions)) assert.ok(!/[—–]| - |"/.test(value), value);
  assert.equal(t('org.audit.shown', { shown: 21, total: 140 }), 'Näha 21 sündmust 140-st.');
  /* Päring on sama mis vanal lehel: üks `fetch`. */
  assert.equal((read('../components/org/OrgAuditClient.jsx').match(/fetch\(/g) || []).length, 1);
});
