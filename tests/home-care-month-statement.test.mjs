import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildStatements, resolveStatementMonth } from '../lib/homeCare/monthStatement.js';
import { durationText, monthLabel, renderMonthStatementsHtml, shortDay, statementTotals, weekdayOf } from '../lib/homeCare/monthStatementDocument.js';

const doc = (locale) => JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care.statement.doc;
const say = (locale) => (key, values = {}) => doc(locale)[key].replace(/\{(\w+)\}/g, (_, name) => String(values[name]));

test('kuuleht: nädalapäev, lühike päev, kuu nimi ja kestus inimesele', () => {
  assert.deepEqual(['2026-09-01', '2026-09-02', '2026-09-27', '2026-09-28', '2024-02-29'].map(weekdayOf), [2, 3, 7, 1, 4]);
  assert.equal(shortDay('2026-09-02'), '02.09');
  assert.equal(monthLabel('2026-09', 'et'), 'september 2026');
  assert.equal(monthLabel('2026-10', 'en'), 'October 2026');
  const t = say('et');
  assert.deepEqual([45, 60, 75, 0, 690].map((minutes) => durationText(t, minutes)), ['45 min', '1 t', '1 t 15 min', '0 min', '11 t 30 min']);
});

test('kuuleht: kuu valik sõnaga ja kujul AAAA-KK', () => {
  const now = new Date('2026-10-09T08:00:00Z');
  assert.deepEqual(resolveStatementMonth('previous', now, 'Europe/Tallinn'), { year: 2026, month: 9 });
  assert.deepEqual(resolveStatementMonth('current', now, 'Europe/Tallinn'), { year: 2026, month: 10 });
  assert.deepEqual(resolveStatementMonth('2026-03', now, 'Europe/Tallinn'), { year: 2026, month: 3 });
  /* Aastavahetus: jaanuari „eelmine kuu" on eelmise aasta detsember. */
  assert.deepEqual(resolveStatementMonth('previous', new Date('2027-01-05T08:00:00Z'), 'Europe/Tallinn'), { year: 2026, month: 12 });
  assert.throws(() => resolveStatementMonth('september', now, 'Europe/Tallinn'), /invalid_month/);
});

test('kuuleht: read klientide kaupa, päeva järgi, klientide järjekord jääb', () => {
  const clients = [{ id: 'a', displayName: 'Aino Saar' }, { id: 'b', displayName: 'Enn Lepp' }];
  const sheets = buildStatements(clients, {
    visits: [
      { clientId: 'b', day: '2026-09-10', minutes: 30, workerName: 'Anu Kask' },
      { clientId: 'a', day: '2026-09-16', minutes: null, workerName: 'Bert Mets' },
      { clientId: 'a', day: '2026-09-02', minutes: 45, workerName: 'Anu Kask' },
      { clientId: 'x', day: '2026-09-03', minutes: 10, workerName: 'Võõras' }
    ],
    missed: [{ clientId: 'a', day: '2026-09-23', type: 'DOOR_NOT_OPENED' }],
    cancelled: [{ clientId: 'a', day: '2026-09-07', reason: 'CLIENT_AWAY' }, { clientId: 'b', day: '2026-09-08', reason: null }]
  });
  assert.deepEqual(sheets.map((sheet) => sheet.clientName), ['Aino Saar', 'Enn Lepp']);
  assert.deepEqual(sheets[0].visits.map((row) => [row.day, row.minutes]), [['2026-09-02', 45], ['2026-09-16', null]]);
  assert.deepEqual(sheets[0].notHappened, [{ day: '2026-09-07', reason: 'CLIENT_AWAY' }, { day: '2026-09-23', reason: 'DOOR_NOT_OPENED' }]);
  assert.deepEqual(sheets[1].notHappened, [{ day: '2026-09-08', reason: 'OTHER' }]);
  assert.deepEqual(statementTotals(sheets[0].visits), { count: 2, minutes: 45, withoutLength: 1 });
  assert.deepEqual(buildStatements(clients)[0], { clientId: 'a', clientName: 'Aino Saar', visits: [], notHappened: [] });
});

test('kuuleht: dokument on iseseisev, kliendi keeles ja ilma perekonnanimeta', () => {
  const visits = Array.from({ length: 14 }, (_, index) => ({ day: `2026-09-${String(index + 1).padStart(2, '0')}`, minutes: 30, workerName: 'Anu Kask' }));
  const html = renderMonthStatementsHtml({
    organizationName: 'Hoolekandekeskus <Test>',
    month: '2026-09',
    phone: null,
    composedOn: '09.10.2026',
    locale: 'et',
    statements: [
      { clientName: 'Aino <b>Saar</b>', visits, notHappened: [] },
      { clientName: 'Enn Lepp', visits: [{ day: '2026-09-02', minutes: null, workerName: null }], notHappened: [{ day: '2026-09-07', reason: 'WORKER_ABSENT' }] }
    ]
  });
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('Content-Security-Policy'));
  assert.equal(html.includes('<script'), false);
  /* Kliendi nimi ei ole akna pealkirjas; märgid on varjestatud. */
  assert.ok(html.includes('<title>Koduteenus: september 2026</title>'));
  assert.ok(html.includes('Aino &lt;b&gt;Saar&lt;/b&gt;'));
  assert.ok(html.includes('Hoolekandekeskus &lt;Test&gt;'));
  /* Hooldaja eesnimi, mitte perekonnanimi; pikk loend kahes veerus. */
  assert.ok(html.includes('· 30 min · Anu</li>'));
  assert.equal(html.includes('Kask'), false);
  assert.ok(html.includes('<ul class="many">'));
  assert.ok(html.includes('Käisime teie juures 14 korral, kokku 7 t.'));
  /* Kestuseta käik ja töötaja puudumine; telefoni asemel joon käsitsi kirjutamiseks. */
  assert.ok(html.includes('Käisime teie juures 1 korral.</p>'));
  assert.ok(html.includes('Käike, mille kestus on kirja panemata: 1.'));
  assert.ok(html.includes('Kolmapäev, 02.09</span> · kestus kirja panemata</li>'));
  assert.ok(html.includes('Esmaspäev, 07.09</span> · töötaja puudus ja asendajat ei leitud'));
  assert.ok(html.includes('<span class="blank">'));
  assert.ok(html.includes('Koostatud 09.10.2026.'));
  assert.equal(html.split('<section class="sheet">').length - 1, 2);
});

test('kuuleht: tekstid kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const texts = doc(locale);
    for (const key of ['title', 'print_hint', 'summary', 'summary_count', 'summary_none', 'without_length', 'visits_title', 'not_happened_title', 'duration_hm', 'duration_h', 'duration_m', 'no_length', 'call_title', 'foot']) {
      assert.ok(texts[key], `${locale} ${key}`);
    }
    for (const reason of ['CLIENT_AWAY', 'CLIENT_CANCELLED', 'WORKER_ABSENT', 'OTHER', 'DOOR_NOT_OPENED', 'REFUSED_HELP']) assert.ok(texts.reasons[reason], `${locale} ${reason}`);
    const html = renderMonthStatementsHtml({ organizationName: 'X', month: '2026-09', phone: '473 0000', composedOn: '09.10.2026', locale, statements: [{ clientName: 'A', visits: [], notHappened: [] }] });
    assert.ok(html.includes(texts.summary_none), locale);
    assert.ok(html.includes('473 0000'), locale);
  }
});
