import test from 'node:test';
import assert from 'node:assert/strict';
import { morphologyText, morphologyFields, MORPHOLOGY_LEXICAL } from '../lib/rag-v2/search/morphology.js';
import { searchConfig, verifySearchConfig } from '../lib/rag-v2/search/indexing.js';
import { retrievalProfile, assertProfileGeneration } from '../lib/rag-v2/search/profiles.js';

const overlap = (a, b) => morphologyText(a).split(' ').some(term => morphologyText(b).split(' ').includes(term));
test('generic local stems connect Estonian cases and English/Russian inflections without source-specific dictionaries', () => {
  for (const [a, b] of [['raamat', 'raamatutest'], ['toetus', 'toetust'], ['koduteenus', 'koduteenust'], ['laste', 'lastele'],
    ['services', 'service'], ['working', 'worked'], ['работа', 'работы']]) assert(overlap(a, b), `${a} / ${b}`);
  assert(!overlap('koduteenust', 'astronoomia'));
  assert.equal(morphologyText('TÖÖTAN'), morphologyText('to\u0308o\u0308tan'));
  assert.equal(morphologyText('raamat raamat'), morphologyText('raamat'));
  assert.equal(morphologyText('123 45'), '');
});

test('derived search aids preserve original text and keep legacy index contracts separate', () => {
  const unit = Object.freeze({ title: 'Koduteenus', body: 'Küsi koduteenust. Tööd ei ole.', search_aids: '' });
  const fields = morphologyFields(unit);
  assert(fields.title.includes('sbet')); assert.equal(unit.body, 'Küsi koduteenust. Tööd ei ole.');
  const old = searchConfig(), next = searchConfig(undefined, MORPHOLOGY_LEXICAL);
  assert.notEqual(old.id, next.id); verifySearchConfig(old); verifySearchConfig(next);
  const profile = retrievalProfile('hybrid-multilingual-dependencies-v1');
  assertProfileGeneration(profile, { config: next });
  assert.throws(() => assertProfileGeneration(profile, { config: old }), { code: 'profile_generation_mismatch' });
  assert.throws(() => searchConfig(undefined, 'unknown'), { code: 'unknown_lexical_config' });
});

test('stems are not semantic equivalence, translations or complete lemmatization', () => {
  assert(!overlap('lapsed', 'lastele'), 'This known limitation must stay visible; multilingual semantic retrieval remains necessary');
  assert(!overlap('benefit', 'toetus'), 'Translation is the multilingual embedding channel responsibility');
});
