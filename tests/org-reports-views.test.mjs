// Organisatsiooni aruannete osa (`/org/<id>/aruanded`): lehe reeglid ja tekstid.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { stampOf } from '../components/org/orgRules.js';
import { downloadName, monthLabel, previewState, reportFacts, reportOpened, reportRow } from '../components/org/reports/reportRules.js';

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
const row = (over = {}) => ({ id: 'r1', month: '2026-09', senderName: 'Jaan Kask', kovName: 'Põltsamaa vald', entryCount: 24, status: 'SENT', sentAt: '2026-10-01T08:00:00.000Z', openedAt: null, fileName: 'teenuspaevik-2026-09.csv', note: null, ...over });

test('kuu on inimese keeles, mitte numbritena', () => {
  assert.equal(monthLabel('2026-09', 'et'), 'september 2026');
  assert.match(monthLabel('2026-09', 'en'), /September 2026/);
  assert.equal(monthLabel('2026-13', 'et'), '2026-13', 'vigane kuu jääb selliseks, nagu see on');
  assert.equal(monthLabel('III kvartal', 'et'), 'III kvartal');
  assert.equal(monthLabel(null, 'et'), '');
});

test('loendi rida: avamata aruanne on esile tõstetud, avatud aruandel on avamise aeg', () => {
  const unopened = reportRow(row(), { t, locale: 'et' });
  assert.equal(unopened.title, 'september 2026');
  assert.equal(unopened.sub, 'saatja Jaan Kask · Põltsamaa vald · 24 kirjet');
  assert.deepEqual([unopened.chip, unopened.time, unopened.attention], ['avamata', '', true]);
  const opened = reportRow(row({ status: 'OPENED', openedAt: '2026-10-02T09:30:00.000Z' }), { t, locale: 'et' });
  assert.deepEqual([opened.chip, opened.time, opened.attention], ['', stampOf('2026-10-02T09:30:00.000Z'), false]);
  /* Kirjete arv 0 on arv, puuduv arv jääb välja. */
  assert.ok(reportRow(row({ entryCount: 0 }), { t, locale: 'et' }).sub.endsWith('0 kirjet'));
  assert.equal(reportRow(row({ entryCount: null, kovName: null }), { t, locale: 'et' }).sub, 'saatja Jaan Kask');
  assert.equal(reportOpened(row()), false);
});

test('avatud aruande read ja faili nimi', () => {
  const facts = reportFacts(row({ status: 'OPENED', openedAt: '2026-10-02T09:30:00.000Z' }), { t });
  assert.deepEqual(facts.map((fact) => fact.key), ['sender', 'kov', 'sent', 'entries', 'opened']);
  assert.equal(facts.at(-1).value, stampOf('2026-10-02T09:30:00.000Z'));
  const closed = reportFacts(row(), { t });
  assert.deepEqual([closed.at(-1).value, closed.at(-1).quiet], ['avamata', true]);
  assert.equal(downloadName(row(), 'csv'), 'teenuspaevik-2026-09.csv');
  assert.equal(downloadName(row(), 'pdf'), 'teenuspaevik-2026-09.pdf');
  assert.equal(downloadName(row({ fileName: '' }), 'pdf'), 'report.pdf');
});

test('eelvaate seis: ei ole küsitud, read on käes või vormingut ei saa näidata', () => {
  assert.equal(previewState(null, 'r1'), 'none');
  assert.equal(previewState({ shareId: 'r2', previewable: true, rows: [] }, 'r1'), 'none', 'teise aruande eelvaadet ei näidata');
  assert.equal(previewState({ shareId: 'r1', previewable: true, rows: [['a']] }, 'r1'), 'table');
  assert.equal(previewState({ shareId: 'r1', previewable: false }, 'r1'), 'unavailable');
  assert.equal(previewState({ shareId: 'r1', previewable: true, rows: null }, 'r1'), 'unavailable');
});

test('tekstid on kolmes keeles olemas ja päringuid on sama palju kui vanal lehel', () => {
  const keys = ['title', 'intro', 'empty', 'from', 'opened_at', 'unopened', 'entries', 'audit_note', 'view', 'no_preview', 'download', 'format_csv', 'format_pdf', 'no_pdf', 'sender', 'kov', 'sent', 'entries_label', 'opened',
    'opened_yes', 'note_label', 'format_question', 'preview_label', 'viewing', 'view_failed', 'download_failed'];
  for (const lang of LANGS) {
    for (const key of keys) assert.equal(typeof at(catalog(lang), `org.reports.${key}`), 'string', `${lang}: org.reports.${key}`);
    assert.equal(typeof at(catalog(lang), 'org.pagination.loadFailed'), 'string');
  }
  for (const key of ['intro', 'no_preview', 'format_csv', 'format_pdf', 'sender', 'kov', 'sent', 'entries_label', 'opened', 'note_label', 'format_question', 'preview_label', 'viewing', 'view_failed', 'download_failed']) {
    assert.ok(!/[—–]| - |"/.test(at(catalog('et'), `org.reports.${key}`)), key);
  }
  assert.equal((read('../components/org/OrgServiceReportsClient.jsx').match(/fetch\(/g) || []).length, 4);
  /* Leht saab kesta jaoks organisatsiooni konteksti. */
  assert.ok(read('../app/org/[orgId]/aruanded/page.jsx').includes('context={auth.context}'));
});
