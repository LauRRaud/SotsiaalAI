import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CARE_CRISIS_DEPENDENCIES, CARE_CRISIS_LEVELS } from '../lib/homeCare/constants.js';
import { crisisFigures, normalizeCrisisInput, weeklyMinutesByClient } from '../lib/homeCare/crisis.js';
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

test('kriisiarvud: rühmad, sõltuvused, kriitiliste käikude aeg ja väikseim koosseis', () => {
  const items = [
    { crisis: { level: 'DAILY', dependencies: ['ELECTRICITY', 'HEATING'] } },
    { crisis: { level: 'DAILY', dependencies: ['HEATING', 'TUNDMATU'] } },
    { crisis: { level: 'SELF', dependencies: [] } },
    { crisis: null }
  ];
  const slots = [
    { clientId: 'a', plannedMinutes: 60, priority: 'A' },
    { clientId: 'a', plannedMinutes: 60, priority: 'A' },
    { clientId: 'b', plannedMinutes: 45, priority: 'B' },
    { clientId: 'c', plannedMinutes: 2300, priority: 'A' }
  ];
  const figures = crisisFigures(items, slots);
  assert.deepEqual([figures.clients, figures.unset, figures.byLevel], [4, 1, { DAILY: 2, WEEKLY: 0, SELF: 1 }]);
  assert.deepEqual([figures.dependencies.ELECTRICITY, figures.dependencies.HEATING, figures.dependencies.WATER], [1, 2, 0]);
  /* 2420 minutit on üle ühe täistööaja nädala (2400): vaja on kahte töötajat. */
  assert.deepEqual([figures.criticalClients, figures.criticalWeeklyMinutes, figures.minStaff], [2, 2420, 2]);
  assert.deepEqual([crisisFigures([], []).minStaff, crisisFigures([], [{ clientId: 'a', plannedMinutes: 2400, priority: 'A' }]).minStaff], [0, 1]);
});

test('kriisiarvud: tabelifaili lõpus on arvud sildiga', () => {
  const translate = (key) => key.replace('home_care.crisis.', '');
  const sheet = composeCrisisSheet(translate, {
    groups: [],
    unset: [],
    figures: {
      clients: 3,
      byLevel: { DAILY: 1, WEEKLY: 1, SELF: 0 },
      unset: 1,
      dependencies: { ELECTRICITY: 1, HEATING: 0 },
      criticalClients: 2,
      criticalWeeklyMinutes: 510,
      minStaff: 1,
      workers: 2,
      vehicles: { ownDrivers: 1, orgPlates: 2 }
    }
  });
  const lines = sheet.replace('﻿', '').split('\r\n');
  for (const line of ['figures.title', 'figures.clients_label;3', 'levels.DAILY;1', 'levels.SELF;0', 'sheet.unset;1', 'figures.depends_label: dependencies.ELECTRICITY;1', 'figures.critical_clients_label;2', 'figures.critical_hours_label;8,5', 'figures.min_staff_label;1', 'figures.workers_label;2', 'figures.own_drivers_label;1', 'figures.org_plates_label;2']) {
    assert.ok(lines.includes(line), line);
  }
  /* Nullise sõltuvuse rida ei ole; üksuse hooldusjuhi failis ei ole töötajaid ega sõidukeid. */
  assert.equal(sheet.includes('dependencies.HEATING'), false);
  const scoped = composeCrisisSheet(translate, { groups: [], unset: [], figures: { clients: 1, byLevel: {}, unset: 0, dependencies: {}, criticalClients: 0, criticalWeeklyMinutes: 0, minStaff: 0, workers: null, vehicles: null } });
  assert.equal(scoped.includes('workers_label') || scoped.includes('own_drivers_label'), false);
  /* Ilma arvudeta nimekiri (vanem vastus) annab faili nagu enne. */
  assert.equal(composeCrisisSheet(translate, { groups: [], unset: [] }).includes('figures.title'), false);
});
