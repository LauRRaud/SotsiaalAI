// KODUTEENUS K4-e — varud kliendi kodus: sõnastikud, andmebaasi piirid, nimekirja järjekord ja tekstid.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CARE_SUPPLY_KINDS, CARE_SUPPLY_STATES, HOME_CARE_LIMITS } from '../lib/homeCare/constants.js';
import { sortOpenSupplies } from '../lib/homeCare/supplies.js';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sql = source('../prisma/migrations/20261011050000_home_care_supplies/migration.sql');
const list = (text) => [...text.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]);

test('varud: andmebaasi CHECK-id ja koodi sõnastikud on samad; ravimivaru ei ole', () => {
  assert.deepEqual(list(/"CareClientSupply_kind_check" CHECK \("kind" IN \(([^)]*)\)\)/.exec(sql)[1]), [...CARE_SUPPLY_KINDS]);
  assert.deepEqual([...CARE_SUPPLY_KINDS], ['FIREWOOD', 'WATER', 'FOOD', 'HYGIENE']);
  assert.equal(CARE_SUPPLY_KINDS.includes('MEDICINE'), false);
  assert.deepEqual(list(/"CareSupplyCheck_state_check" CHECK \("state" IN \(([^)]*)\)\)/.exec(sql)[1]), [...CARE_SUPPLY_STATES]);
  assert.deepEqual([...CARE_SUPPLY_STATES], ['ENOUGH', 'LOW', 'OUT']);
  /* Märkimata varul ei ole seisu ega aega; märgitud varul on mõlemad. */
  assert.match(sql, /"state" IS NULL AND "checkedAt" IS NULL/);
  assert.match(sql, /"state" IS NOT NULL AND "state" IN \('ENOUGH', 'LOW', 'OUT'\) AND "checkedAt" IS NOT NULL/);
  assert.match(sql, /CREATE UNIQUE INDEX "CareClientSupply_active_key" ON "CareClientSupply"\("clientId", "kind"\) WHERE "endedAt" IS NULL;/);
  assert.match(sql, new RegExp(`char_length\\(btrim\\("responsible"\\)\\) BETWEEN 1 AND ${HOME_CARE_LIMITS.SUPPLY_RESPONSIBLE_MAX}`));
  assert.match(sql, /^SET lock_timeout = '5s';\r?\nSET statement_timeout = '30s';/m);
});

test('teenus ei kustuta varu rida ega märkimise jälge', () => {
  const service = source('../lib/homeCare/supplies.js');
  assert.doesNotMatch(service, /careClientSupply\.(delete|deleteMany)\(|careSupplyCheck\.(delete|deleteMany|update|updateMany)\(/);
});

test('lõppevate varude järjekord: otsas enne, siis varem märgitud enne', () => {
  const item = (name, state, checkedAt) => ({ client: { displayName: name }, state, checkedAt });
  const sorted = sortOpenSupplies([
    item('Linda', 'LOW', '2026-10-09T08:10:00.000Z'),
    item('Peeter', 'LOW', '2026-10-09T08:05:00.000Z'),
    item('Mari', 'OUT', '2026-10-09T09:00:00.000Z'),
    item('Aino', 'OUT', '2026-10-09T09:00:00.000Z')
  ]);
  assert.deepEqual(sorted.map((row) => [row.client.displayName, row.state]), [['Aino', 'OUT'], ['Mari', 'OUT'], ['Peeter', 'LOW'], ['Linda', 'LOW']]);
});

test('varude tekstid on kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const hc = JSON.parse(source(`../messages/${locale}.json`)).home_care;
    for (const kind of CARE_SUPPLY_KINDS) assert.ok(hc.supplies.kinds[kind], `${locale} ${kind}`);
    for (const state of CARE_SUPPLY_STATES) assert.ok(hc.supplies.states[state], `${locale} ${state}`);
    assert.match(hc.supplies.state_label, /\{kind\}/, locale);
    assert.match(hc.supplies.checked, /\{name\}[\s\S]*\{when\}/, locale);
    assert.match(hc.supplies.responsible, /\{name\}/, locale);
    assert.match(hc.supplies.open_line, /\{kind\}[\s\S]*\{state\}[\s\S]*\{name\}[\s\S]*\{when\}/, locale);
    for (const key of ['title', 'none', 'unchecked', 'note_button', 'note_label', 'note_save', 'track', 'kind_label', 'responsible_label', 'responsible_hint', 'save', 'cancel', 'untrack']) {
      assert.ok(hc.supplies[key], `${locale} ${key}`);
    }
    assert.ok(hc.deadlines.supplies_open_title && hc.deadlines.supplies_open_empty, locale);
    for (const key of ['supply_kind_required', 'supply_responsible_required', 'supply_already_tracked', 'supply_not_found', 'supply_ended', 'supply_state_required']) {
      assert.ok(hc.errors[key], `${locale} ${key}`);
    }
  }
});
