// Teenuseprofiili leht: lahkumise kaitse salvestamata muudatustele.
//
// Lehel ei olnud kaitset: tagasi-noole, paneeli sulgemise või Esc-iga lahkus inimene vaikselt ja
// muudatused kadusid. Kaitse ise on ühine (lib/panelLeaveGuard.js); siin on lehe otsused: millal
// kaitse peal on ja millal Esc kuulub lehe enda avatud osale
// (components/workspace/serviceProfile/profileModel.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServiceProfileForm, escapeBelongsToWidget, leaveGuardOn, serviceProfileDirty } from '../components/workspace/serviceProfile/profileModel.js';
import { twoPressLeaveGuard } from '../lib/panelLeaveGuard.js';

const LANGS = ['et', 'en', 'ru'];
const catalog = (lang) => JSON.parse(fs.readFileSync(new URL(`../messages/${lang}.json`, import.meta.url), 'utf8')).workspace_feature_pages.service_profile;

const profile = {
  id: 'p1',
  organizationName: 'Hooldusabi MTÜ',
  registryCode: '12345678',
  email: 'info@hooldus.example',
  status: 'DRAFT',
  serviceItems: [{ id: 's1', name: 'Koduteenus', status: 'PUBLISHED', mapVisible: true }],
  serviceLocations: []
};

test('kaitse on peal ainult siis, kui vormil on muudatusi, mida profiilis ei ole', () => {
  const loaded = createServiceProfileForm(profile);
  const guard = (form, loading = false) => leaveGuardOn({ loading, dirty: serviceProfileDirty(form, profile) });
  /* Äsja laaditud vorm: lahkuda võib kohe. */
  assert.equal(guard(loaded), false);
  /* Muudetud väli: lahkumine peetakse kinni. */
  const changed = { ...loaded, organizationName: `${loaded.organizationName} x` };
  assert.equal(guard(changed), true);
  /* Tagasi muudetud väli: võrdlus käib profiili endaga, kaitse läheb maha. */
  assert.equal(guard({ ...changed, organizationName: loaded.organizationName }), false);
  /* Muudatus teenuse sees loeb samuti. */
  const service = { ...loaded, serviceItems: loaded.serviceItems.map((item) => ({ ...item, name: 'Koduabi' })) };
  assert.equal(guard(service), true);
  /* Laadimise ajal on vorm tühi ja profiil tulemata: see ei ole inimese muudatus. */
  assert.equal(guard(changed, true), false);
  assert.equal(leaveGuardOn(), false);
  /* Pärast salvestamist on profiil see, mis vormil: kaitse on maas. */
  const saved = { ...profile, organizationName: changed.organizationName };
  assert.equal(leaveGuardOn({ dirty: serviceProfileDirty(createServiceProfileForm(saved), saved) }), false);
});

test('esimene lahkumine peetakse kinni, teine lahkub; küsimus aegub', () => {
  let clock = 1000;
  const events = [];
  const leave = twoPressLeaveGuard({ onAsk: () => events.push('ask'), onClear: () => events.push('clear'), now: () => clock, holdMs: 8000, gapMs: 400 });
  assert.equal(leave('escape'), false);
  assert.deepEqual(events, ['ask']);
  /* Topeltvajutus (sama liigutus) ei loe teiseks vajutuseks. */
  clock += 100;
  assert.equal(leave('escape'), false);
  clock += 900;
  assert.equal(leave('close'), true);
  assert.deepEqual(events, ['ask', 'clear']);
  /* Uus küsimus; pärast aegumist algab kõik otsast. */
  assert.equal(leave('back'), false);
  clock += 9000;
  assert.equal(leave('back'), false);
  leave.clear();
});

test('Esc, mis kuulub lehe enda avatud osale, ei ole lahkumine', () => {
  const inside = (selectorHit) => ({ closest: (selector) => (selectorHit(selector) ? {} : null) });
  /* Kiirmenüü avatud sammude loend ja avatud rippvalik sulguvad Esc-iga ise. */
  assert.equal(escapeBelongsToWidget(inside((selector) => selector.includes('[data-esc-scope]'))), true);
  assert.equal(escapeBelongsToWidget(inside((selector) => selector.includes('[role="listbox"]'))), true);
  /* Tavaline väli või lehe keha: Esc on lahkumise katse. */
  assert.equal(escapeBelongsToWidget(inside(() => false)), false);
  assert.equal(escapeBelongsToWidget(null), false);
  assert.equal(escapeBelongsToWidget({}), false);
});

test('lahkumise küsimuse tekst on kataloogis kolmes keeles', () => {
  for (const lang of LANGS) {
    const text = catalog(lang).views.unsaved_leave;
    assert.equal(typeof text, 'string', lang);
    assert.ok(text.trim().length > 20, lang);
  }
});
