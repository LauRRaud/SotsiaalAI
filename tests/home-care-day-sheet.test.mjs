import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { sheetsOfPlan } from '../lib/homeCare/daySheet.js';
import { renderDaySheetHtml } from '../lib/homeCare/daySheetDocument.js';

const visit = (name, startMinute, state = 'PLANNED', extra = {}) => ({ startMinute, plannedMinutes: 30, state, client: { id: `c-${name}`, displayName: name, address: null }, ...extra });

test('päevaleht: lehed töötaja kaupa, ära jäetud käigud välja, tegijata käigud lõpus', () => {
  const plan = {
    workers: [
      { membershipId: 'm2', name: 'Bert Hooldaja', visits: [visit('Peeter', 600), visit('Linda', 540), visit('Aino', 660, 'CANCELLED')] },
      { membershipId: 'm1', name: 'Anu Hooldaja', visits: [visit('Enn', 480, 'DONE')] },
      { membershipId: 'm3', name: 'Cia Asendaja', visits: [visit('Jaan', 480, 'CANCELLED')] }
    ],
    /* Lahtise takistuse teatega töötaja käigud on plaanis teate juures; lehel tema nime all. */
    obstacles: [{ membershipId: 'm1', name: 'Anu Hooldaja', visits: [visit('Mari', 420, 'MISSING')] }],
    unassigned: [visit('Tiit', 700)],
    uncovered: [visit('Leida', 500), visit('Olev', 800, 'CANCELLED')]
  };
  const all = sheetsOfPlan(plan);
  assert.deepEqual(all.map((sheet) => [sheet.workerName, sheet.visits.map((item) => item.client.displayName)]), [
    ['Anu Hooldaja', ['Mari', 'Enn']],
    ['Bert Hooldaja', ['Linda', 'Peeter']],
    [null, ['Leida', 'Tiit']]
  ]);
  /* Ühe töötaja leht: ainult tema käigud, tegijata käike juures ei ole. */
  assert.deepEqual(sheetsOfPlan(plan, { membershipId: 'm2' }).map((sheet) => sheet.visits.length), [2]);
  /* Töötaja, kelle kõik käigud on ära jäetud, ja tundmatu töötaja: lehte ei ole. */
  assert.deepEqual(sheetsOfPlan(plan, { membershipId: 'm3' }), []);
  assert.deepEqual(sheetsOfPlan(plan, { membershipId: 'mx' }), []);
  assert.deepEqual(sheetsOfPlan({ workers: [], unassigned: [], uncovered: [] }), []);
});

test('päevaleht: dokument kannab käigu ridu, on skriptideta ja paneb iga töötaja omaette lehele', () => {
  const html = renderDaySheetHtml({
    organizationName: 'Hoolekanne <A>',
    day: '2026-10-09',
    weekday: 5,
    locale: 'et',
    sheets: [
      {
        workerName: 'Anu Hooldaja',
        visits: [
          {
            startMinute: 540,
            plannedMinutes: 45,
            clientName: 'Linda <Tamm>',
            address: 'Kase 3-12, Haapsalu',
            phone: '+372 5555 1234',
            priority: 'A',
            note: 'Helista enne',
            key: { held: false, holders: ['Bert Hooldaja'], office: true },
            cardLines: [{ kind: 'ACCESS', text: 'Uksekood 12#34' }, { kind: 'RISK', text: 'Koer on õues lahti' }],
            activities: ['Hommikused ravimid', 'Pesemine'],
            medication: true
          }
        ]
      },
      { workerName: null, visits: [{ startMinute: 600, plannedMinutes: 30, clientName: 'Peeter Põhi', key: { held: true }, cardLines: [], activities: [] }] }
    ]
  });
  assert.ok(html.startsWith('<!doctype html>'));
  assert.equal(/<script/i.test(html), false);
  assert.ok(html.includes('Content-Security-Policy'));
  /* Pealkirjas ei ole nimesid; sisu on põgendatud. */
  assert.ok(html.includes('<title>Koduteenuse päevaleht</title>'));
  assert.ok(html.includes('Linda &lt;Tamm&gt;'));
  assert.ok(html.includes('Hoolekanne &lt;A&gt;'));
  assert.equal(html.includes('<Tamm>'), false);
  assert.equal((html.match(/<section class="sheet">/g) || []).length, 2);
  for (const text of [
    '<h1>Anu Hooldaja</h1>',
    'Reede 09.10.2026',
    'käike 1',
    '9.00–9.45',
    'tähtsus A',
    'Kase 3-12, Haapsalu',
    '+372 5555 1234',
    'Võti: Bert Hooldaja käes, kontoris.',
    'Helista enne',
    'Kavas on ravimitoiming: märgi, mida tegid.',
    'Ligipääs:</span> Uksekood 12#34',
    'Oht:</span> Koer on õues lahti',
    '<span class="box"></span>Hommikused ravimid',
    'Jõudsin kell',
    '<h1>Tegijata käigud</h1>',
    'Võti on sinu käes.',
    'Leht kannab isikuandmeid.'
  ]) {
    assert.ok(html.includes(text), text);
  }
  /* Teisel käigul ei ole telefoni, märkust, kaardi ridu ega kava: neid pealkirju seal ei korrata. */
  const second = html.slice(html.indexOf('<h1>Tegijata käigud</h1>'));
  for (const text of ['Telefon:', 'Märkus:', 'Enne kui lähed:', 'Kavas:', 'ravimitoiming']) assert.equal(second.includes(text), false, text);
});

test('päevalehe tekstid on kolmes keeles', () => {
  const et = JSON.parse(readFileSync(new URL('../messages/et.json', import.meta.url), 'utf8')).home_care;
  for (const locale of ['et', 'en', 'ru']) {
    const catalogue = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    for (const key of Object.keys(et.day_sheet)) assert.ok(catalogue.day_sheet[key], `${locale} ${key}`);
    for (const key of Object.keys(et.day_sheet.doc)) assert.ok(catalogue.day_sheet.doc[key], `${locale} doc.${key}`);
    for (const key of ['day_sheet_empty', 'day_sheet_worker']) assert.ok(catalogue.errors[key], `${locale} ${key}`);
  }
});
