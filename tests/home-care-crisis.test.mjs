import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CARE_CRISIS_DEPENDENCIES, CARE_CRISIS_LEVELS } from '../lib/homeCare/constants.js';
import { normalizeCrisisInput, weeklyMinutesByClient } from '../lib/homeCare/crisis.js';
import { composeCrisisSheet, csvCell, hoursCell } from '../lib/homeCare/crisisSheet.js';

const refused = (fn, key) => assert.throws(fn, (error) => error.status === 400 && error.messageKey === key, key);
const et = JSON.parse(readFileSync(new URL('../messages/et.json', import.meta.url), 'utf8'));
const translate = (key, values = {}) => {
  const text = key.split('.').reduce((node, part) => (node ? node[part] : undefined), et);
  assert.equal(typeof text, 'string', key);
  return text.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
};

test('kriisivalmiduse sisend: aste kohustuslik, sõltuvused loendist ja kindlas järjekorras', () => {
  assert.deepEqual(normalizeCrisisInput({ level: 'DAILY', dependencies: ['WATER', 'ELECTRICITY', 'WATER'], helper: '  Poeg   Mart ', note: '' }), {
    level: 'DAILY',
    dependencies: ['ELECTRICITY', 'WATER'],
    helper: 'Poeg Mart',
    note: null
  });
  assert.deepEqual(normalizeCrisisInput({ level: 'SELF' }), { level: 'SELF', dependencies: [], helper: null, note: null });
  refused(() => normalizeCrisisInput({ dependencies: ['WATER'] }), 'home_care.errors.crisis_level_required');
  refused(() => normalizeCrisisInput({ level: 'MUU' }), 'home_care.errors.crisis_level_required');
  refused(() => normalizeCrisisInput({ level: 'DAILY', dependencies: ['GAAS'] }), 'home_care.errors.crisis_dependency_invalid');
  refused(() => normalizeCrisisInput({ level: 'DAILY', helper: 'x'.repeat(201) }), 'home_care.errors.text_too_long');
});

test('nädala käiguaeg kliendi kaupa ja tabeli lahtrid', () => {
  const totals = weeklyMinutesByClient([
    { clientId: 'a', plannedMinutes: 30 },
    { clientId: 'a', plannedMinutes: 45 },
    { clientId: 'b', plannedMinutes: 60 }
  ]);
  assert.deepEqual([...totals], [['a', 75], ['b', 60]]);
  assert.equal(hoursCell(75), '1,3');
  assert.equal(hoursCell(0), '0');
  /* Valemina käivituda võiv lahter saab ette ülakoma; semikoolon ja jutumärk pannakse jutumärkidesse; reavahetus kaob. */
  assert.equal(csvCell('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(csvCell('+372 5555'), "'+372 5555");
  assert.equal(csvCell('-koer õues'), "'-koer õues");
  assert.equal(csvCell('Pikk 1; korter 2'), '"Pikk 1; korter 2"');
  assert.equal(csvCell('ütles "ei"'), '"ütles ""ei"""');
  assert.equal(csvCell('kaks\nrida'), 'kaks rida');
  assert.equal(csvCell(null), '');
});

test('kriisinimekiri tabelina: päis, rühmad järjekorras, hindamata lõpus', () => {
  const item = (name, extra = {}) => ({ client: { id: name, displayName: name }, address: null, phone: null, weeklyMinutes: 0, crisis: null, ...extra });
  const sheet = composeCrisisSheet(translate, {
    groups: [
      { level: 'DAILY', clients: [item('Linda Tamm', { address: 'Pikk 1; Haapsalu', phone: '+372 5555', weeklyMinutes: 150, crisis: { dependencies: ['ELECTRICITY', 'HEATING'], helper: 'Poeg Mart', note: null } })] },
      { level: 'WEEKLY', clients: [] },
      { level: 'SELF', clients: [item('Peeter Põhi', { crisis: { dependencies: [], helper: null, note: 'Varud keldris' } })] }
    ],
    unset: [item('Uus Klient')]
  });
  assert.ok(sheet.startsWith('\uFEFF'));
  const lines = sheet.slice(1).trimEnd().split('\r\n');
  assert.equal(lines[0], 'Rühm;Nimi;Aadress;Telefon;Sõltub;Kes saab aidata;Märkus;Käike nädalas (tundi)');
  assert.equal(lines[1], `Vajab hooldaja tuge iga päev;Linda Tamm;"Pikk 1; Haapsalu";'+372 5555;elekter (seade või häirenupp), küte;Poeg Mart;;2,5`);
  assert.equal(lines[2], 'Saab varudega seitse päeva ise hakkama;Peeter Põhi;;;;;Varud keldris;0');
  assert.equal(lines[3], 'Hindamata;Uus Klient;;;;;;0');
  assert.equal(lines.length, 4);
});

test('astmed ja sõltuvused on kolmes keeles; migratsiooni loendid klapivad koodiga', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    for (const level of CARE_CRISIS_LEVELS) assert.ok(messages.home_care.crisis.levels[level], `${locale} ${level}`);
    for (const code of CARE_CRISIS_DEPENDENCIES) assert.ok(messages.home_care.crisis.dependencies[code], `${locale} ${code}`);
  }
  const sql = readFileSync(new URL('../prisma/migrations/20261011110000_home_care_crisis_profile/migration.sql', import.meta.url), 'utf8');
  for (const value of [...CARE_CRISIS_LEVELS, ...CARE_CRISIS_DEPENDENCIES]) assert.ok(sql.includes(`'${value}'`), value);
  assert.match(sql, /^SET lock_timeout = '5s';\r?\nSET statement_timeout = '30s';/m);
});
