// Organisatsiooni graafiku osa (`/org/<id>/graafik`): lehe reeglid ja tekstid.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  EMPTY_ASSIGN,
  assignPayload,
  assignProblemKey,
  dayLine,
  reassignProblemKey,
  timeOf,
  totalsLine,
  visitRows,
  visitStatusLabel,
  workerOptions,
  workerRow,
  workerWarnings
} from '../components/org/dispatch/dispatchRules.js';

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
const worker = (over = {}) => ({
  membershipId: 'm1',
  name: 'Jaan Kask',
  jobTitle: 'Sotsiaaltööspetsialist',
  routeStatus: null,
  startedAt: null,
  endedAt: null,
  onBreak: false,
  summary: { visits: 0, travelMinutes: 0 },
  late: [],
  needsCheck: [],
  visits: [],
  ...over
});

test('töötaja päev on üks lause: alustamata, käimas või lõppenud; paus ja külastused', () => {
  assert.equal(dayLine(worker(), { t, locale: 'et' }), 'päeva ei ole alustatud · külastusi 0 · sõit 0 min');
  const open = dayLine(worker({ routeStatus: 'OPEN', startedAt: '2026-10-11T06:00:00.000Z', onBreak: true, summary: { visits: 3, travelMinutes: 25 } }), { t, locale: 'et' });
  assert.match(open, /^päev algas \d{2}[.:]\d{2} · paus · külastusi 3 · sõit 25 min$/);
  assert.match(dayLine(worker({ routeStatus: 'CLOSED', endedAt: '2026-10-11T14:00:00.000Z' }), { t, locale: 'et' }), /^päev lõppes \d{2}[.:]\d{2} · /);
  assert.equal(timeOf('vigane', 'et'), '', 'vigane aeg ei anna kellaaega');
  assert.equal(timeOf(null, 'et'), '');
});

test('töötaja rida kannab märke ainult siis, kui on hilinemisi või kontrolli vajavaid', () => {
  const calm = workerRow(worker(), { t, locale: 'et' });
  assert.deepEqual([calm.id, calm.title, calm.chips], ['m1', 'Jaan Kask · Sotsiaaltööspetsialist', []]);
  const busy = workerRow(worker({ late: [{ id: 'v1' }], needsCheck: [{ id: 'v2' }, { id: 'v3' }] }), { t, locale: 'et' });
  assert.deepEqual(busy.chips, ['hilinemisi 1', 'kontrolli vajab 2']);
  assert.equal(workerRow(worker({ name: '', jobTitle: null }), { t, locale: 'et' }).title, t('org.inbox.unnamed_worker'), 'nimeta töötaja ei ole tühi rida');
});

test('kokkuvõte jätab nullid välja', () => {
  assert.equal(totalsLine({ totals: { workers: 2, open: 1, late: 0, needsCheck: 0 } }, { t }), 'Töötajaid 2 · tööpäev käimas 1');
  assert.equal(totalsLine({ totals: { workers: 2, open: 1, late: 3, needsCheck: 1 } }, { t }), 'Töötajaid 2 · tööpäev käimas 1 · hilinemisi 3 · kontrolli vajab 1');
  assert.equal(totalsLine({}, { t }), 'Töötajaid 0 · tööpäev käimas 0');
});

test('hoiatused on laused, nimeta klient ei ole kriips', () => {
  const lines = workerWarnings(worker({ late: [{ id: 'v1', client: 'Aino Kuusk', minutesLate: 41 }], needsCheck: [{ id: 'v2', client: null }] }), { t });
  assert.deepEqual(lines, [
    { id: 'late:v1', text: 'Aino Kuusk: plaanitud algusest on möödas 41 min' },
    { id: 'check:v2', text: 'Nimeta klient: külastus on kaua lahti, kontrolli' }
  ]);
  assert.deepEqual(workerWarnings(worker(), { t }), []);
});

test('külastuse rida: seis sõnana, plaanitud või kohalejõudmise aeg, põhjus; teisele saab anda ainult plaanis tööd', () => {
  const rows = visitRows(
    worker({
      visits: [
        { id: 'v1', status: 'PLANNED', client: 'Aino Kuusk', plannedStartAt: '2026-10-11T07:30:00.000Z', arrivedAt: null, outcomeReason: null },
        { id: 'v2', status: 'ARRIVED', client: 'Elmar Saar', plannedStartAt: '2026-10-11T08:00:00.000Z', arrivedAt: '2026-10-11T08:05:00.000Z', outcomeReason: null },
        { id: 'v3', status: 'NOT_DONE', client: null, plannedStartAt: null, arrivedAt: null, outcomeReason: 'klient oli haiglas' }
      ]
    }),
    { t, locale: 'et', workerCount: 1 }
  );
  assert.match(rows[0].sub, /^plaanis · plaanitud algus \d{2}[.:]\d{2}$/);
  assert.match(rows[1].sub, /^kohal · kohal \d{2}[.:]\d{2}$/);
  assert.deepEqual([rows[2].title, rows[2].sub], ['Nimeta klient', 'tegemata · klient oli haiglas']);
  assert.deepEqual(rows.map((row) => row.canReassign), [true, false, false], 'alustatud tööd teisele anda ei saa');
  /* Kui ei ole, kellele anda, nuppu ei ole. */
  assert.equal(visitRows(worker({ visits: [{ id: 'v1', status: 'PLANNED', client: 'A' }] }), { t, locale: 'et', workerCount: 0 })[0].canReassign, false);
});

test('seisu sõna tuleb kataloogist; tundmatu seis ei jõua toore nimena ekraanile', () => {
  for (const status of ['PLANNED', 'EN_ROUTE', 'ARRIVED', 'COMPLETED', 'CANCELLED', 'NOT_DONE', 'NEEDS_CORRECTION']) {
    for (const lang of LANGS) {
      const label = visitStatusLabel(status, { t: translator(lang) });
      assert.ok(label && !/service_log|[A-Z]{3}/.test(label), `${lang}: ${status} → ${label}`);
    }
  }
  assert.equal(visitStatusLabel('UUS_SEIS', { t }), 'muu seis');
  assert.equal(visitStatusLabel(null, { t }), 'muu seis');
});

test('töötajate valik: nimi ja amet; teisele andes jääb praegune töötaja välja', () => {
  const workers = [
    { userId: 'u1', membershipId: 'm1', name: 'Jaan Kask', jobTitle: 'Sotsiaaltööspetsialist' },
    { userId: 'u2', membershipId: 'm2', name: 'Mari Tamm', jobTitle: null },
    { userId: '', membershipId: 'm3', name: 'Kontota' }
  ];
  assert.deepEqual(workerOptions(workers, { t }), [
    { value: 'u1', label: 'Jaan Kask · Sotsiaaltööspetsialist' },
    { value: 'u2', label: 'Mari Tamm' }
  ]);
  assert.deepEqual(workerOptions(workers, { t, exceptMembershipId: 'm1' }).map((option) => option.value), ['u2']);
  assert.deepEqual(workerOptions(null, { t }), []);
});

test('määramine: töötaja ja klient on kohustuslikud, päringu keha on sama mis vanal lehel', () => {
  assert.equal(assignProblemKey(EMPTY_ASSIGN), 'org.board.need_worker');
  assert.equal(assignProblemKey({ ...EMPTY_ASSIGN, assignTo: 'u1', client: '   ' }), 'org.board.need_client');
  assert.equal(assignProblemKey({ ...EMPTY_ASSIGN, assignTo: 'u1', client: 'Aino Kuusk' }), '');
  const payload = assignPayload({ assignTo: 'u1', client: 'Aino Kuusk', address: 'Lossi 1', startAt: '2026-10-11T09:30' });
  assert.deepEqual(Object.keys(payload), ['action', 'workerUserId', 'clientDisplayName', 'address', 'plannedStartAt']);
  assert.deepEqual([payload.action, payload.workerUserId, payload.clientDisplayName, payload.address], ['assign', 'u1', 'Aino Kuusk', 'Lossi 1']);
  assert.equal(payload.plannedStartAt, new Date('2026-10-11T09:30').toISOString());
  assert.equal(assignPayload({ ...EMPTY_ASSIGN, assignTo: 'u1', client: 'A' }).plannedStartAt, null, 'ilma ajata on algus puudu, mitte vigane');
  assert.equal(assignPayload({ assignTo: 'u1', client: 'A', address: '', startAt: 'vigane' }).plannedStartAt, null);
});

test('teisele andmine: kellele ja miks on mõlemad kohustuslikud', () => {
  assert.equal(reassignProblemKey({ workerUserId: '', reason: 'haige' }), 'org.board.need_worker');
  assert.equal(reassignProblemKey({ workerUserId: 'u2', reason: '  ' }), 'org.board.need_reason');
  assert.equal(reassignProblemKey({ workerUserId: 'u2', reason: 'haige' }), '');
  assert.equal(reassignProblemKey(), 'org.board.need_worker');
});

test('tekstid on kolmes keeles olemas, leht ei küsi hüpikaknaga ja päringuid on sama palju kui vanal lehel', () => {
  const keys = ['title', 'no_access', 'date', 'empty', 'totals', 'late_count', 'check_count', 'not_started', 'day_open', 'day_closed', 'on_break', 'day_summary', 'privacy_note', 'assign', 'assign_worker', 'assign_client',
    'assign_address', 'assign_time', 'assign_send', 'assign_note', 'assigning', 'reassign', 'reassigning', 'reassign_subject', 'reassign_question', 'reassign_reason', 'reassign_note', 'assigned', 'assign_failed', 'late_line',
    'check_line', 'client_unnamed', 'status_other', 'need_worker', 'need_client', 'need_reason', 'visits', 'no_visits', 'planned_at', 'arrived_at'];
  for (const lang of LANGS) {
    for (const key of keys) assert.equal(typeof at(catalog(lang), `org.board.${key}`), 'string', `${lang}: org.board.${key}`);
    assert.equal(typeof at(catalog(lang), 'org.nav.dispatch'), 'string');
    /* Serveri veavõtmed, mida määramine ja teisele andmine võivad tagasi saata. */
    for (const key of ['worker_has_no_profile', 'visit_started', 'assign_not_allowed', 'organization_not_writable', 'invalid_input']) {
      assert.equal(typeof at(catalog(lang), `service_log.errors.${key}`), 'string', `${lang}: service_log.errors.${key}`);
    }
  }
  for (const key of keys) assert.ok(!/[—–]| - |"/.test(at(catalog('et'), `org.board.${key}`)), key);
  const page = read('../components/org/OrgDispatchBoard.jsx');
  assert.equal((page.match(/fetch\(/g) || []).length, 2);
  assert.ok(!/window\.prompt|window\.confirm|alert\(/.test(page), 'küsimus on vaade, mitte brauseri hüpikaken');
  /* Serveri sõnum on võti: leht tõlgib selle lauseks. */
  assert.ok(page.includes('resolveApiMessage({ payload: body, t, fallbackKey: "org.board.assign_failed" })'));
  /* Leht saab kesta jaoks organisatsiooni konteksti. */
  assert.ok(read('../app/org/[orgId]/graafik/page.jsx').includes('context={auth.context}'));
});
