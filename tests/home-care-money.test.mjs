// KODUTEENUS K4-c — kliendi sularaha arvestus: summa lugemine, jääk, andmebaasi piirid ja tekstid.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CARE_MONEY_KINDS, HOME_CARE_LIMITS } from '../lib/homeCare/constants.js';
import { balanceOf, parseEuroCents } from '../lib/homeCare/money.js';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sql = source('../prisma/migrations/20261011030000_home_care_money/migration.sql');

test('summa eurodes loetakse sentideks ilma ujukomata; koma ja punkt on mõlemad lubatud', () => {
  assert.deepEqual(['12', '12,5', '12.50', '0,01', '0.1', ' 7,65 ', '1 000', '10000', 19.99].map(parseEuroCents), [1200, 1250, 1250, 1, 10, 765, 100000, 1000000, 1999]);
  /* 0,1 + 0,2 ei tohi anda 30,000000000000004 senti: iga summa loetakse tekstist. */
  assert.equal(parseEuroCents('0,1') + parseEuroCents('0,2'), 30);
  for (const bad of ['', '0', '0,00', '-5', '12,345', '12,', ',5', 'kümme', '1e3', '10000,01', '1234567', null, undefined, {}, []]) {
    assert.throws(() => parseEuroCents(bad), (error) => error.status === 400 && error.messageKey === 'home_care.errors.money_amount_invalid', String(bad));
  }
});

test('jääk: saadud miinus kulutatud ja tagastatud', () => {
  const rows = [
    { kind: 'RECEIVED', amountCents: 2000 },
    { kind: 'SPENT', amountCents: 1235 },
    { kind: 'RETURNED', amountCents: 765 }
  ];
  assert.equal(balanceOf(rows), 0);
  assert.equal(balanceOf(rows.slice(0, 2)), 765);
  assert.equal(balanceOf([]), 0);
});

test('kliendi raha: andmebaasi CHECK-id ja koodi sõnastik on samad; rida ei kustutata', () => {
  const listed = [.../"kind" IN \(([^)]*)\)/.exec(sql)[1].matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]);
  assert.deepEqual(listed, [...CARE_MONEY_KINDS]);
  assert.match(sql, new RegExp(`"amountCents" BETWEEN 1 AND ${HOME_CARE_LIMITS.MONEY_AMOUNT_MAX_CENTS}`));
  assert.match(sql, new RegExp(`char_length\\(btrim\\("note"\\)\\) BETWEEN 1 AND ${HOME_CARE_LIMITS.MONEY_NOTE_MAX}`));
  assert.match(sql, /"amountCents" INTEGER NOT NULL/);
  assert.match(sql, /^SET lock_timeout = '5s';\r?\nSET statement_timeout = '30s';/m);
  /* Kaardi ega konto andmeid tabelis ei ole. */
  const table = /CREATE TABLE "CareMoneyEntry" \(([\s\S]*?)\r?\n\);/.exec(sql)[1];
  assert.doesNotMatch(table, /"(card|iban|account|pin)[A-Za-z]*"/i);
  const service = source('../lib/homeCare/money.js');
  assert.doesNotMatch(service, /careMoneyEntry\.(delete|deleteMany)\(/);
});

test('kliendi raha tekstid on kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const hc = JSON.parse(source(`../messages/${locale}.json`)).home_care;
    for (const kind of CARE_MONEY_KINDS) assert.ok(hc.money.kinds[kind], `${locale} ${kind}`);
    assert.match(hc.money.balance, /\{amount\}/, locale);
    assert.match(hc.money.holder_line, /\{name\}[\s\S]*\{amount\}[\s\S]*\{date\}/, locale);
    assert.match(hc.money.open_line, /\{name\}[\s\S]*\{amount\}[\s\S]*\{date\}/, locale);
    for (const key of ['title', 'intro', 'balance_none', 'kind_label', 'amount_label', 'note_label', 'note_hint', 'add', 'save', 'cancel', 'retract', 'holders_title', 'mine_title']) {
      assert.ok(hc.money[key], `${locale} ${key}`);
    }
    assert.ok(hc.deadlines.money_open_title && hc.deadlines.money_open_empty, locale);
    assert.match(hc.errors.money_exceeds_balance, /\{held\}/, locale);
    for (const key of ['money_kind_required', 'money_amount_invalid', 'money_note_required', 'money_day_invalid', 'money_holder_required', 'money_not_found', 'money_retracted', 'money_retract_negative']) {
      assert.ok(hc.errors[key], `${locale} ${key}`);
    }
  }
});
