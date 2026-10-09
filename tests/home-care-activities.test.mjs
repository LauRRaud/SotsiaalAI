// KODUTEENUS kiht 2, K2-a — toimingute kataloogi sõnastik: määruse nr 40 § 2 kuusteist rühma.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CARE_ACTIVITY_DOMAINS,
  CARE_ACTIVITY_GROUPS,
  CARE_ACTIVITY_GROUP_DOMAIN,
  CARE_ACTIVITY_GROUP_NAMES_ET,
  HOME_CARE_LIMITS
} from '../lib/homeCare/constants.js';

test('toimingurühmad: kuus koduabi ja kümme isikuabi määruse järjekorras', () => {
  assert.equal(CARE_ACTIVITY_GROUPS.length, 16);
  assert.equal(new Set(CARE_ACTIVITY_GROUPS).size, 16);
  assert.deepEqual(CARE_ACTIVITY_DOMAINS, ['HOME_HELP', 'PERSONAL_HELP']);
  const byDomain = (domain) => CARE_ACTIVITY_GROUPS.filter((group) => CARE_ACTIVITY_GROUP_DOMAIN[group] === domain);
  /* Määruse § 2 lg 2 p 1–6 ja lg 3 p 1–10. */
  assert.deepEqual(byDomain('HOME_HELP'), ['SHOPPING', 'SERVICES_AND_ERRANDS', 'HEATING', 'HOME_SAFETY', 'HOUSEKEEPING', 'OTHER_HOME_HELP']);
  assert.deepEqual(byDomain('PERSONAL_HELP'), [
    'HYGIENE',
    'NUTRITION',
    'DRESSING',
    'LAUNDRY',
    'MEDICATION',
    'ABILITY_MONITORING',
    'NETWORK',
    'MENTAL_SUPPORT',
    'ASSISTIVE_TECH',
    'OTHER_PERSONAL_HELP'
  ]);
  /* Koduabi rühmad on loendis enne isikuabi rühmi, nagu määruses. */
  assert.deepEqual(CARE_ACTIVITY_GROUPS, [...byDomain('HOME_HELP'), ...byDomain('PERSONAL_HELP')]);

  /* Igal rühmal on määruse sõnastuses nimi, mis mahub toimingu nime piiri ja on kordumatu
     (algne loend kirjutab need nimed kataloogi, kus nimi peab olema kordumatu). */
  assert.deepEqual(Object.keys(CARE_ACTIVITY_GROUP_NAMES_ET), [...CARE_ACTIVITY_GROUPS]);
  const names = Object.values(CARE_ACTIVITY_GROUP_NAMES_ET);
  assert.equal(new Set(names.map((name) => name.toLowerCase())).size, 16);
  for (const name of names) assert.ok(name.length > 3 && name.length <= HOME_CARE_LIMITS.ACTIVITY_NAME_MAX, name);
});

test('toimingurühmad: koodi sõnastik ja andmebaasi CHECK on täpselt samad', () => {
  const sql = readFileSync(new URL('../prisma/migrations/20261010030000_home_care_activity_catalogue/migration.sql', import.meta.url), 'utf8');
  const body = /"CareActivity_group_check" CHECK \("group" IN \(([\s\S]*?)\)\);/.exec(sql)[1];
  assert.deepEqual([...body.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]), [...CARE_ACTIVITY_GROUPS]);
  /* Üks kehtiv toiming ühe nimega asutuse kohta, suur- ja väiketähte eristamata; arhiveeritud nimi on vaba. */
  assert.match(sql, /CREATE UNIQUE INDEX "CareActivity_organizationId_name_active_key"\s+ON "CareActivity"\("organizationId", lower\("name"\)\)\s+WHERE "archivedAt" IS NULL;/);
});

test('toimingurühmad, pooled ja vead on kolmes keeles; eesti pealkirjad on määruse sõnastus', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const hc = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    assert.deepEqual(Object.keys(hc.activities.groups).sort(), [...CARE_ACTIVITY_GROUPS].sort(), locale);
    assert.deepEqual(Object.keys(hc.activities.domains).sort(), [...CARE_ACTIVITY_DOMAINS].sort(), locale);
    for (const group of CARE_ACTIVITY_GROUPS) assert.ok(hc.activities.groups[group].length > 3, `${locale} ${group}`);
    for (const key of ['activity_group_required', 'activity_name_required', 'activity_name_taken', 'activity_not_found', 'activity_limit_reached', 'activity_catalogue_not_empty', 'activity_position_invalid']) {
      assert.ok(hc.errors[key], `${locale} ${key}`);
    }
    if (locale === 'et') assert.deepEqual(hc.activities.groups, { ...CARE_ACTIVITY_GROUP_NAMES_ET });
  }
});
