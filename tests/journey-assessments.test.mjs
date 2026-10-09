// TEEKOND K1-d — inimese enda hinnang muutusele: reeglid ilma andmebaasita.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  JOURNEY_ASSESSMENT_LEVELS,
  JOURNEY_ASSESSMENT_LIMITS,
  assessmentChange,
  normalizeAssessmentInput,
  summarizeAssessments
} from '../lib/journey/assessmentRules.js';

test('enda hinnang: aste on kohustuslik, muutus arvutatakse algseisust, numbrit inimesele ei näidata', () => {
  /* Sisend: aste 1–5 (ka tekstina vormist), märkus valikuline ja korrastatud. */
  assert.deepEqual(normalizeAssessmentInput({ level: 3 }), { level: 3, note: null });
  assert.deepEqual(normalizeAssessmentInput({ level: '4', note: '  Saan nüüd  ise poes käia. ' }), { level: 4, note: 'Saan nüüd ise poes käia.' });
  for (const bad of [undefined, null, '', ' ', 0, 6, 2.5, 'kolm', true, [3]]) {
    assert.throws(
      () => normalizeAssessmentInput({ level: bad }),
      (error) => error.status === 400 && error.message === 'journeys.errors.assessment_level_required',
      String(bad)
    );
  }
  const limit = JOURNEY_ASSESSMENT_LIMITS.note;
  assert.equal(normalizeAssessmentInput({ level: 1, note: 'x'.repeat(limit) }).note.length, limit);
  assert.throws(
    () => normalizeAssessmentInput({ level: 1, note: 'x'.repeat(limit + 1) }),
    (error) => error.status === 400 && error.field === 'note' && error.limit === limit
  );

  /* Muutus: kõrgem aste on parem, madalam raskem; ilma võrdluseta on see algseis. */
  assert.equal(assessmentChange(3, null), 'BASELINE');
  assert.equal(assessmentChange(4, 2), 'BETTER');
  assert.equal(assessmentChange(2, 2), 'SAME');
  assert.equal(assessmentChange(1, 2), 'HARDER');

  /* Tühi ja ühe märkega pilt: algseis on, muutust veel ei ole. */
  assert.deepEqual(summarizeAssessments([]), { baseline: null, latest: null, change: null, items: [] });
  const one = summarizeAssessments([{ id: 'a', level: 2, createdAt: '2026-10-01T08:00:00Z' }]);
  assert.deepEqual([one.baseline.id, one.latest, one.change, one.items[0].change], ['a', null, null, 'BASELINE']);

  /* Mitu märget suvalises järjekorras: algseis on kõige varasem, viimane kõige hilisem,
     iga märke muutus on võrreldes ALGSEISUGA ja loend on uuemast vanemani. */
  const many = summarizeAssessments([
    { id: 'c', level: 4, createdAt: '2026-10-20T08:00:00Z' },
    { id: 'a', level: 2, createdAt: '2026-10-01T08:00:00Z' },
    { id: 'b', level: 1, createdAt: '2026-10-10T08:00:00Z' },
    { id: 'd', level: 2, createdAt: '2026-10-25T08:00:00Z' }
  ]);
  assert.deepEqual(many.items.map((row) => [row.id, row.change]), [['d', 'SAME'], ['c', 'BETTER'], ['b', 'HARDER'], ['a', 'BASELINE']]);
  assert.deepEqual([many.baseline.id, many.latest.id, many.change], ['a', 'd', 'SAME']);
  assert.deepEqual(summarizeAssessments(null).items, []);

  /* Igal astmel ja igal muutusel on sõnad kolmes keeles; astme silt ei ole number. */
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    for (const level of JOURNEY_ASSESSMENT_LEVELS) {
      const label = messages.journey.assessment.levels[String(level)];
      assert.ok(typeof label === 'string' && label.trim() && !/\d/.test(label), `${locale} ${level}`);
    }
    for (const change of ['BASELINE', 'BETTER', 'SAME', 'HARDER']) assert.ok(messages.journey.assessment.change[change], `${locale} ${change}`);
    for (const key of ['assessment_level_required', 'assessment_not_found', 'assessment_limit_reached']) {
      assert.ok(messages.journeys.errors[key], `${locale} ${key}`);
    }
  }
});
