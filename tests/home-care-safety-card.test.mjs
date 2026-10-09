import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CARE_SAFETY_TOPICS } from '../lib/homeCare/constants.js';
import { normalizeSafetyCard, safetyReviewState } from '../lib/homeCare/safetyCard.js';

const refused = (fn, key) => assert.throws(fn, (error) => error.status === 400 && error.messageKey === key, key);

test('ohutuskaardi sisend: vastus jah või ei, märkus ainult vastusega, tühi vastus võtab teema maha', () => {
  assert.deepEqual(normalizeSafetyCard({ items: { ANIMALS: { answer: 'YES', note: '  Koer on  õues lahti ' }, SMOKING: { answer: 'NO' }, FIRE: { answer: '' } } }), {
    ANIMALS: { answer: 'YES', note: 'Koer on õues lahti' },
    SMOKING: { answer: 'NO', note: null },
    FIRE: { answer: null, note: null }
  });
  assert.deepEqual(normalizeSafetyCard({}), {});
  refused(() => normalizeSafetyCard({ items: { MUU: { answer: 'YES' } } }), 'home_care.errors.safety_topic_invalid');
  refused(() => normalizeSafetyCard({ items: { ANIMALS: { answer: 'VIST' } } }), 'home_care.errors.safety_answer_invalid');
  /* Märkus ilma vastuseta ei kao vaikselt: see on viga. */
  refused(() => normalizeSafetyCard({ items: { ANIMALS: { note: 'koer' } } }), 'home_care.errors.safety_answer_required');
  refused(() => normalizeSafetyCard({ items: { ANIMALS: { answer: 'YES', note: 'x'.repeat(201) } } }), 'home_care.errors.text_too_long');
});

test('kaart vaadatakse üle, kui vanim vastus on üle aasta vana', () => {
  assert.deepEqual(safetyReviewState(null, '2026-10-09'), { days: null, due: false });
  assert.deepEqual(safetyReviewState('2025-10-09', '2026-10-09'), { days: 365, due: false });
  assert.deepEqual(safetyReviewState('2025-10-08', '2026-10-09'), { days: 366, due: true });
});

test('kümme teemat on kolmes keeles küsimuse ja lühinimena; migratsiooni loend klapib koodiga', () => {
  assert.equal(CARE_SAFETY_TOPICS.length, 10);
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    for (const topic of CARE_SAFETY_TOPICS) {
      assert.ok(messages.home_care.safety.questions[topic], `${locale} küsimus ${topic}`);
      assert.ok(messages.home_care.safety.topics[topic], `${locale} nimi ${topic}`);
    }
  }
  const sql = readFileSync(new URL('../prisma/migrations/20261011210000_home_care_safety_card/migration.sql', import.meta.url), 'utf8');
  for (const topic of CARE_SAFETY_TOPICS) assert.ok(sql.includes(`'${topic}'`), topic);
  assert.match(sql, /^SET lock_timeout = '5s';\r?\nSET statement_timeout = '30s';/m);
});
