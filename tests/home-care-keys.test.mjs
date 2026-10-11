// KODUTEENUS K4-b — võtmeraamat: andmebaasi piirid, võtme märge käigu juures ja tekstid.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CARE_KEY_OUTCOMES, HOME_CARE_LIMITS } from '../lib/homeCare/constants.js';
import { keyNoteFor } from '../lib/homeCare/keys.js';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sql = source('../prisma/migrations/20261011010000_home_care_keys/migration.sql');

test('võtmeraamat: andmebaasi CHECK-id ja koodi sõnastik on samad; ripatsi number on kehtivate võtmete seas kordumatu', () => {
  const listed = [.../"outcome" IN \(([^)]*)\)/.exec(sql)[1].matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]);
  assert.deepEqual(listed, [...CARE_KEY_OUTCOMES]);
  assert.match(sql, new RegExp(`char_length\\(btrim\\("tag"\\)\\) BETWEEN 1 AND ${HOME_CARE_LIMITS.KEY_TAG_MAX}`));
  assert.match(sql, new RegExp(`char_length\\(btrim\\("label"\\)\\) BETWEEN 1 AND ${HOME_CARE_LIMITS.KEY_LABEL_MAX}`));
  assert.match(sql, /CREATE UNIQUE INDEX "CareKey_tag_key" ON "CareKey"\("organizationId", lower\("tag"\)\) WHERE "closedAt" IS NULL;/);
  assert.match(sql, /"closedAt" IS NULL AND "outcome" IS NULL/);
  assert.match(sql, /^SET lock_timeout = '5s';\r?\nSET statement_timeout = '30s';/m);
  /* Võtme real ei ole kliendi nime ega aadressi: seos kliendiga on ainult kliendi ID kaudu. */
  const table = /CREATE TABLE "CareKey" \(([\s\S]*?)\r?\n\);/.exec(sql)[1];
  assert.doesNotMatch(table, /"(address|clientName|displayName)"/);
});

test('teenus ei kustuta võtit ega üleandmise jälge', () => {
  const service = source('../lib/homeCare/keys.js');
  assert.doesNotMatch(service, /careKey\.(delete|deleteMany)\(|careKeyHandover\.(delete|deleteMany|update|updateMany)\(/);
});

test('võtme märge käigu juures: kas tegijal on võti; kui ei, siis kelle käes võtmed on', () => {
  const holders = new Map([
    ['linda', { holders: new Set(['anu']), names: ['Anu Hooldaja'], office: true }],
    ['peeter', { holders: new Set(), names: [], office: true }]
  ]);
  assert.deepEqual(keyNoteFor(holders, 'linda', 'anu'), { held: true, holders: [], office: false });
  assert.deepEqual(keyNoteFor(holders, 'linda', 'bert'), { held: false, holders: ['Anu Hooldaja'], office: true });
  /* Tegijata (või puuduva tegijaga) käigul on kirjas, kus võtmed on. */
  assert.deepEqual(keyNoteFor(holders, 'linda', null), { held: false, holders: ['Anu Hooldaja'], office: true });
  assert.deepEqual(keyNoteFor(holders, 'peeter', 'anu'), { held: false, holders: [], office: true });
  /* Kliendil, kelle võtmeid asutuse käes ei ole, märget ei ole. */
  assert.equal(keyNoteFor(holders, 'mari', 'anu'), null);
});

test('võtmeraamatu tekstid on kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const hc = JSON.parse(source(`../messages/${locale}.json`)).home_care;
    assert.match(hc.keys.name, /\{tag\}/, locale);
    assert.match(hc.keys.name_with_label, /\{tag\}[\s\S]*\{label\}/, locale);
    assert.match(hc.keys.held_by, /\{name\}/, locale);
    assert.match(hc.keys.elsewhere, /\{where\}/, locale);
    assert.match(hc.keys.truncated, /\{count\}/, locale);
    for (const key of [
      'title', 'link', 'none', 'held_by_me', 'in_office', 'office_option', 'add', 'tag_label', 'tag_hint', 'label_label', 'holder_label', 'save', 'cancel',
      'hand_over', 'to_label', 'hand_over_save', 'returned', 'lost', 'mine_title', 'return_badge', 'holder_inactive', 'register_title', 'register_intro',
      'unreturned_title', 'unreturned_empty', 'register_empty'
    ]) {
      assert.ok(hc.keys[key], `${locale} ${key}`);
    }
    assert.match(hc.errors.key_too_many, /\{limit\}/, locale);
    for (const key of ['key_tag_required', 'key_tag_taken', 'key_holder_invalid', 'key_same_holder', 'key_not_found', 'key_closed', 'key_changed', 'key_outcome_invalid']) {
      assert.ok(hc.errors[key], `${locale} ${key}`);
    }
  }
});
