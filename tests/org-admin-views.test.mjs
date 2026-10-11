// Organisatsiooni halduse osad: struktuur, seaded ja andmete väljavõte. Reeglid ja tekstid.
//
// Lehed olid kastid üksteise all vanal ühisel kihil. Nüüd on igal asjal oma
// väike vaade; otsused on puhaste funktsioonidena failides
// components/org/structure/structureRules.js ja components/org/settings/settingsRules.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { SETTINGS_TABS, exportFileName, lifecycleActions, moduleRows, stampOf } from '../components/org/settings/settingsRules.js';
import {
  EMPTY_UNIT,
  canEditStructure,
  parentOptions,
  unitDirty,
  unitProblemKey,
  unitRow,
  unitTree,
  unitTypeOptions
} from '../components/org/structure/structureRules.js';
import {
  MAX_UNIT_DEPTH,
  ORGANIZATION_MODULE_KEYS,
  ORGANIZATION_STATUSES,
  ORGANIZATION_UNIT_TYPES,
  canTransitionOrganizationStatus
} from '../lib/org/constants.js';

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

/* Server annab üksused tasandite kaupa: kõik esimese tasandi omad, siis teise. */
const UNITS = [
  { id: 'a', name: 'Lastekaitse', type: 'DEPARTMENT', parentUnitId: null, depth: 1 },
  { id: 'b', name: 'Sotsiaalosakond', type: 'DEPARTMENT', parentUnitId: null, depth: 1 },
  { id: 'c', name: 'Koduteenuse tiim', type: 'TEAM', parentUnitId: 'b', depth: 2 },
  { id: 'd', name: 'Noorte tiim', type: 'TEAM', parentUnitId: 'a', depth: 2 },
  { id: 'e', name: 'Õhtune vahetus', type: 'OTHER', parentUnitId: 'c', depth: 3 }
];

test('üksused on puu järjekorras: alamüksus seisab oma vanema all', () => {
  assert.deepEqual(unitTree(UNITS).map((unit) => unit.name), ['Lastekaitse', 'Noorte tiim', 'Sotsiaalosakond', 'Koduteenuse tiim', 'Õhtune vahetus']);
  /* Üksus, mille vanemat loendis ei ole (arhiveeritud vanem), jääb juurele: midagi ei kao. */
  const orphan = [...UNITS, { id: 'f', name: 'Orb', type: 'TEAM', parentUnitId: 'puudub', depth: 2 }];
  assert.equal(unitTree(orphan).length, orphan.length);
  assert.ok(unitTree(orphan).some((unit) => unit.name === 'Orb'));
  /* Ringviide ei jäta üksust välja ega jää lõputult käima. */
  const loop = [{ id: 'x', name: 'X', parentUnitId: 'y', depth: 2 }, { id: 'y', name: 'Y', parentUnitId: 'x', depth: 2 }];
  assert.deepEqual(unitTree(loop).map((unit) => unit.id).sort(), ['x', 'y']);
  assert.deepEqual(unitTree(null), []);
});

test('üksuse rida, liigid ja kuhu uus üksus võib kuuluda', () => {
  assert.deepEqual(unitRow(UNITS[2], { t }), { id: 'c', title: 'Koduteenuse tiim', kind: 'Tiim', depth: 2 });
  assert.equal(unitRow({ id: 'z', name: 'Z', depth: 9 }, { t }).depth, MAX_UNIT_DEPTH);
  assert.equal(unitRow({ id: 'z', name: 'Z' }, { t }).depth, 1);
  assert.deepEqual(unitTypeOptions(t).map((option) => option.value), [...ORGANIZATION_UNIT_TYPES]);
  const parents = parentOptions(UNITS, t);
  assert.deepEqual(parents[0], { value: '', label: 'Iseseisev üksus' });
  /* Kolmanda tasandi üksuse alla uut ei saa: struktuur toetab kolme tasandit. */
  assert.ok(!parents.some((option) => option.value === 'e'));
  assert.deepEqual(parents.slice(1).map((option) => option.label), ['Lastekaitse', 'Noorte tiim', 'Sotsiaalosakond', 'Koduteenuse tiim']);
  for (const lang of LANGS) {
    for (const type of ORGANIZATION_UNIT_TYPES) assert.equal(typeof at(catalog(lang), `org.unitType.${type}`), 'string', `${lang}: ${type}`);
  }
});

test('uue üksuse vorm: nimi on kohustuslik, muutmata vormist loobumine ei küsi midagi', () => {
  assert.deepEqual({ ...EMPTY_UNIT }, { name: '', type: 'TEAM', parentUnitId: '' });
  assert.equal(unitDirty(EMPTY_UNIT), false);
  assert.equal(unitDirty({ ...EMPTY_UNIT, name: 'Päevakeskus' }), true);
  assert.equal(unitDirty({ ...EMPTY_UNIT, type: 'DEPARTMENT' }), true);
  assert.equal(unitProblemKey(EMPTY_UNIT), 'org.errors.unit_name_required');
  assert.equal(unitProblemKey({ ...EMPTY_UNIT, name: '   ' }), 'org.errors.unit_name_required');
  assert.equal(unitProblemKey({ ...EMPTY_UNIT, name: 'Päevakeskus' }), '');
  const admin = { writable: true, capabilities: [{ capability: 'MEMBER_ADMIN' }] };
  assert.equal(canEditStructure(admin), true);
  assert.equal(canEditStructure({ ...admin, writable: false }), false, 'kirjutuskaitstud organisatsioonis struktuuri ei muudeta');
  assert.equal(canEditStructure({ writable: true, capabilities: [] }), false);
});

test('moodulite read: koduteenus ilmub alles avatud lipuga või kui see on juba sees', () => {
  const rows = moduleRows(['KOV_INTAKE'], { t, homeCareUi: false, writable: true });
  assert.deepEqual(rows.map((row) => row.key), ORGANIZATION_MODULE_KEYS.filter((key) => key !== 'HOME_CARE'));
  assert.deepEqual([rows[0].name, rows[0].active, rows[0].chip], ['Vastuvõtt', true, 'Sees']);
  assert.deepEqual([rows[1].active, rows[1].chip], [false, 'Väljas']);
  assert.ok(moduleRows([], { t, homeCareUi: true }).some((row) => row.key === 'HOME_CARE'));
  assert.ok(moduleRows(['HOME_CARE'], { t, homeCareUi: false }).some((row) => row.key === 'HOME_CARE'));
  assert.ok(moduleRows([], { t, writable: false }).every((row) => row.canToggle === false));
  for (const lang of LANGS) {
    for (const key of ORGANIZATION_MODULE_KEYS) assert.equal(typeof at(catalog(lang), `org.module.${key}`), 'string', `${lang}: ${key}`);
  }
});

test('seisu muutused: iga pakutud siire on serveris lubatud ja pöördumatu küsib teist vajutust', () => {
  for (const status of ORGANIZATION_STATUSES) {
    for (const isPlatformAdmin of [false, true]) {
      const actions = lifecycleActions(status, { isPlatformAdmin });
      for (const action of actions) {
        assert.ok(canTransitionOrganizationStatus(status, action.toStatus), `${status} -> ${action.toStatus}`);
        /* Aktiveerimine ja peatamine on ainult platvormi admini käes. */
        if (action.toStatus === 'ACTIVE' || action.toStatus === 'SUSPENDED') assert.equal(isPlatformAdmin, true, `${status} -> ${action.toStatus}`);
        /* Peatamine ja LÕPLIK arhiveerimine küsivad teist vajutust ja ütlevad, mis juhtub. */
        if (action.toStatus === 'SUSPENDED' || action.toStatus === 'ARCHIVED') assert.ok(action.confirm && action.note, `${status} -> ${action.toStatus}`);
        for (const lang of LANGS) {
          for (const key of [action.label, action.confirm, action.note].filter(Boolean)) assert.equal(typeof at(catalog(lang), key), 'string', `${lang}: ${key}`);
        }
      }
      assert.equal(new Set(actions.map((action) => action.toStatus)).size, actions.length, 'ühte siiret ei pakuta kaks korda');
    }
    for (const lang of LANGS) assert.equal(typeof at(catalog(lang), `org.settings.status_lines.${status}`), 'string', `${lang}: ${status}`);
  }
  assert.deepEqual(lifecycleActions('DRAFT').map((action) => action.toStatus), ['PENDING_VERIFICATION', 'ARCHIVED']);
  assert.deepEqual(lifecycleActions('ACTIVE').map((action) => action.toStatus), ['ARCHIVED']);
  assert.deepEqual(lifecycleActions('ACTIVE', { isPlatformAdmin: true }).map((action) => action.toStatus), ['SUSPENDED', 'ARCHIVED']);
  /* Peatatud organisatsiooni saab platvormi admin tagasi tööle panna (vanal lehel nuppu ei olnud). */
  assert.deepEqual(lifecycleActions('SUSPENDED', { isPlatformAdmin: true }).map((action) => action.toStatus), ['ACTIVE', 'ARCHIVED']);
  assert.deepEqual(lifecycleActions('ARCHIVED', { isPlatformAdmin: true }), []);
  /* Nupul seisab tegevus, mitte seisu nimi (vanal lehel oli aktiveerimise nupul „Aktiivne"). */
  assert.notEqual(t('org.settings.activate_org'), t('org.status.ACTIVE'));
  assert.notEqual(t('org.settings.suspend_org'), t('org.status.SUSPENDED'));
});

test('väljavõtte faili nimi ja koostamise aeg', () => {
  assert.equal(exportFileName('o1', '2026-10-11T07:09:00.000Z'), 'organisatsioon-o1-2026-10-11.json');
  assert.equal(stampOf('2026-10-11T07:09:00.000Z'), '11.10.2026 07.09');
  assert.equal(stampOf('vigane'), '');
  assert.equal(stampOf(''), '');
  assert.deepEqual([...SETTINGS_TABS], ['modules', 'status', 'export']);
});

test('tekstid on kolmes keeles olemas ja uutes sõnades ei ole mõttekriipsu ega sirgeid jutumärke', () => {
  const structure = ['heading', 'intro', 'name', 'type', 'parent', 'noParent', 'add', 'archive', 'empty', 'maxDepthHint', 'archive_named', 'archive_confirm', 'archive_note', 'decline_note', 'adding', 'added'];
  const settings = ['modules', 'modulesIntro', 'activate', 'suspend', 'lifecycle', 'submitForVerification', 'archive', 'archiveHint', 'module_on', 'module_off', 'suspend_confirm', 'suspend_note',
    'tabs.label', 'activate_org', 'restore_org', 'suspend_org', 'suspend_org_confirm', 'suspend_org_note', 'archive_confirm', 'open_export', 'back_to_settings', 'export_generated', 'export_making',
    ...SETTINGS_TABS.map((tab) => `tabs.${tab}`)];
  for (const lang of LANGS) {
    for (const key of structure) assert.equal(typeof at(catalog(lang), `org.structure.${key}`), 'string', `${lang}: org.structure.${key}`);
    for (const key of settings) assert.equal(typeof at(catalog(lang), `org.settings.${key}`), 'string', `${lang}: org.settings.${key}`);
    for (const key of ['heading', 'intro', 'excludes', 'download']) assert.equal(typeof at(catalog(lang), `org.exportView.${key}`), 'string', `${lang}: ${key}`);
  }
  const fresh = [
    ...['archive_named', 'archive_confirm', 'archive_note', 'decline_note', 'adding', 'added'].map((key) => `org.structure.${key}`),
    ...['module_on', 'module_off', 'suspend_confirm', 'suspend_note', 'activate_org', 'restore_org', 'suspend_org', 'suspend_org_confirm', 'suspend_org_note', 'archive_confirm', 'open_export',
      'back_to_settings', 'export_generated', 'export_making', 'status_lines.DRAFT', 'status_lines.PENDING_VERIFICATION', 'status_lines.ACTIVE', 'status_lines.SUSPENDED', 'status_lines.ARCHIVED'].map((key) => `org.settings.${key}`)
  ];
  for (const key of fresh) assert.ok(!/[—–]| - |"/.test(at(catalog('et'), key)), `${key}: ${at(catalog('et'), key)}`);
  /* Päringuid on sama palju kui vanal lehel. */
  const count = (path) => (read(path).match(/(?<![A-Za-z0-9_.])call\(/g) || []).length;
  assert.equal(count('../components/org/OrgStructureClient.jsx'), 3);
  assert.equal(count('../components/org/OrgSettingsClient.jsx'), 2);
  assert.equal(count('../components/org/OrgExportClient.jsx'), 1);
});
