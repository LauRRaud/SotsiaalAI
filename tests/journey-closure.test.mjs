// TEEKOND K1-f — paus ja lõpetamine: reeglid ilma andmebaasita.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  JOURNEY_CLOSURE_KINDS,
  JOURNEY_CLOSURE_LIMITS,
  JOURNEY_CLOSURE_OUTCOMES,
  JourneyClosureKind,
  normalizeClosureInput,
  summarizeClosures
} from '../lib/journey/closureRules.js';

const today = '2026-10-09';
const refused = (input, message) =>
  assert.throws(
    () => normalizeClosureInput(input, { today }),
    (error) => error.status === 400 && error.message === message,
    JSON.stringify(input)
  );

test('paus ja lõpetamine: liik on kohustuslik, paus kannab plaani ja lõpetamine inimese enda tulemust', () => {
  /* Liik: paus või lõpetamine, muud ei ole. */
  for (const bad of [undefined, null, '', 'ARCHIVED', 'paus', 1, ['PAUSED']]) refused({ kind: bad }, 'journeys.errors.closure_kind_required');
  refused(null, 'journeys.errors.closure_kind_required');

  /* PAUS: märkus ja jätkamise päev on valikulised; tulemust ja hinnangut pausil ei ole, isegi kui need saadeti. */
  assert.deepEqual(normalizeClosureInput({ kind: 'paused' }, { today }), { kind: 'PAUSED', outcome: null, note: null, resumeOn: null, level: null });
  assert.deepEqual(
    normalizeClosureInput({ kind: 'PAUSED', note: '  Ootan  arsti aega. ', resumeOn: '2026-11-01', outcome: 'RESOLVED', level: 5 }, { today }),
    { kind: 'PAUSED', outcome: null, note: 'Ootan arsti aega.', resumeOn: '2026-11-01', level: null }
  );
  /* Jätkamise päev on plaan: täna sobib, eile mitte; olematu kuupäev on viga. */
  assert.equal(normalizeClosureInput({ kind: 'PAUSED', resumeOn: today }, { today }).resumeOn, today);
  refused({ kind: 'PAUSED', resumeOn: '2026-10-08' }, 'journeys.errors.closure_resume_in_past');
  for (const bad of ['2026-02-30', '01.11.2026', 'homme', 20261101]) refused({ kind: 'PAUSED', resumeOn: bad }, 'journeys.errors.step_date_invalid');

  /* LÕPETAMINE: inimene ütleb ise, kuidas see lõppes; jätkamise päeva lõpetamisel ei ole. */
  for (const bad of [undefined, '', 'DONE', 'resolved!', 3]) refused({ kind: 'FINISHED', outcome: bad }, 'journeys.errors.closure_outcome_required');
  for (const outcome of JOURNEY_CLOSURE_OUTCOMES) {
    assert.deepEqual(
      normalizeClosureInput({ kind: 'FINISHED', outcome: outcome.toLowerCase(), resumeOn: '2026-11-01' }, { today }),
      { kind: 'FINISHED', outcome, note: null, resumeOn: null, level: null }
    );
  }
  /* Lõpphinnang on valikuline (tühi tähendab „ei soovi vastata"), aga antud aste peab olema päris aste. */
  for (const empty of [undefined, null, '']) assert.equal(normalizeClosureInput({ kind: 'FINISHED', outcome: 'RESOLVED', level: empty }, { today }).level, null);
  assert.equal(normalizeClosureInput({ kind: 'FINISHED', outcome: 'HELP_CONTINUES', level: '4', note: 'Koduteenus käib.' }, { today }).level, 4);
  for (const bad of [0, 6, 2.5, 'hästi']) refused({ kind: 'FINISHED', outcome: 'RESOLVED', level: bad }, 'journeys.errors.assessment_level_required');
  /* „Ei lahenenud" on sama lubatud vastus kui „lahenes", ja püsiv abi on omaette tulemus. */
  assert.ok(JOURNEY_CLOSURE_OUTCOMES.includes('UNRESOLVED') && JOURNEY_CLOSURE_OUTCOMES.includes('HELP_CONTINUES'));

  /* Märkuse piir täpsel piiril. */
  const limit = JOURNEY_CLOSURE_LIMITS.note;
  assert.equal(normalizeClosureInput({ kind: 'PAUSED', note: 'x'.repeat(limit) }, { today }).note.length, limit);
  assert.throws(
    () => normalizeClosureInput({ kind: 'PAUSED', note: 'x'.repeat(limit + 1) }, { today }),
    (error) => error.status === 400 && error.field === 'note' && error.limit === limit
  );
});

test('paus ja lõpetamine: praegune rida on ainult kõrvale pandud Teekonnal, ülejäänu on ajalugu', () => {
  const rows = [
    { id: 'c1', kind: 'PAUSED', outcome: null, note: 'Esimene paus.', resumeOn: '2026-09-10', closedAt: '2026-09-01T08:00:00Z', reopenedAt: '2026-09-12T08:00:00Z' },
    { id: 'c3', kind: 'PAUSED', outcome: null, note: null, resumeOn: '2026-10-09', closedAt: '2026-10-05T08:00:00Z', reopenedAt: null },
    { id: 'c2', kind: 'FINISHED', outcome: 'UNRESOLVED', note: null, resumeOn: null, closedAt: '2026-09-20T08:00:00Z', reopenedAt: '2026-10-01T08:00:00Z' }
  ];

  /* Tühi pilt. */
  assert.deepEqual(summarizeClosures([], { archived: true, today }), { current: null, history: [] });
  assert.deepEqual(summarizeClosures(null), { current: null, history: [] });

  /* Kõrvale pandud Teekond: lahtine rida on praegune, varasemad on ajalugu, viimane ees. */
  const paused = summarizeClosures(rows, { archived: true, today });
  assert.equal(paused.current.id, 'c3');
  assert.deepEqual(paused.history.map((row) => row.id), ['c2', 'c1']);
  /* Päev, mil inimene plaanis jätkata, on käes täpselt sel päeval, mitte päev varem. */
  assert.equal(paused.current.resumeDue, true);
  assert.equal(summarizeClosures(rows, { archived: true, today: '2026-10-08' }).current.resumeDue, false);
  /* Uuesti avatud pausi päev ei ole enam „käes"; lõpetamisel jätkamise päeva ei ole. */
  assert.deepEqual(paused.history.map((row) => row.resumeDue), [false, false]);
  assert.equal(paused.history[0].outcome, 'UNRESOLVED');

  /* Avatud Teekonnal praegust rida ei ole, ka siis, kui mõni rida on (veel) lõpuajata. */
  const open = summarizeClosures(rows, { archived: false, today });
  assert.equal(open.current, null);
  assert.equal(open.history.length, 3);

  /* Lihtsalt arhiveeritud Teekond (vana nupp, lahtist rida ei ole): praegust rida ei ole. */
  const plain = summarizeClosures(rows.filter((row) => row.reopenedAt), { archived: true, today });
  assert.equal(plain.current, null);
  assert.equal(plain.history.length, 2);
});

test('paus ja lõpetamine: iga liik, tulemus ja viga on kolmes keeles sõnadega', () => {
  assert.deepEqual([...JOURNEY_CLOSURE_KINDS].sort(), [JourneyClosureKind.FINISHED, JourneyClosureKind.PAUSED]);
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    for (const kind of JOURNEY_CLOSURE_KINDS) assert.ok(messages.journey.closure.status[kind], `${locale} ${kind}`);
    for (const outcome of JOURNEY_CLOSURE_OUTCOMES) assert.ok(messages.journey.closure.outcomes[outcome], `${locale} ${outcome}`);
    assert.equal(Object.keys(messages.journey.closure.outcomes).length, JOURNEY_CLOSURE_OUTCOMES.length, locale);
    for (const key of ['closure_kind_required', 'closure_outcome_required', 'closure_resume_in_past', 'closure_limit_reached']) {
      assert.ok(messages.journeys.errors[key], `${locale} ${key}`);
    }
  }
});
