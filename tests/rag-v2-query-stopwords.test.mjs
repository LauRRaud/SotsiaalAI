import test from 'node:test';
import assert from 'node:assert/strict';
import { withoutStopwords, QUERY_STOPWORDS_VERSION } from '../lib/rag-v2/search/query-stopwords.js';
import { validateQuery } from '../lib/rag-v2/search/ranking.js';

test('ADR-024: query stopwords drop function words and keep content words, numbers and hyphenated names', () => {
  assert.equal(withoutStopwords('Kellega vallas rääkida, kui vajan sotsiaalabi?'), 'vallas rääkida sotsiaalabi');
  assert.equal(withoutStopwords('Olen üksi kodus, raske on toimetulek, tööd ei ole.'), 'üksi kodus raske toimetulek tööd');
  assert.equal(withoutStopwords('Kas Lääne-Harju vallas on 116 123?'), 'Lääne-Harju vallas 116 123');
  assert.equal(withoutStopwords('I need help at home for my elderly mother.'), 'home elderly mother');
  assert.equal(withoutStopwords('Мне нужна помощь дома для пожилой мамы.'), 'дома пожилой мамы');
  assert.equal(withoutStopwords('Kas mul on?'), '');
});

test('ADR-024: the option is versioned and opt-in', () => {
  assert.equal(validateQuery({ text: 'abi', language: 'et' }).lexicalStopwords, undefined);
  assert.equal(validateQuery({ text: 'abi', language: 'et', lexicalStopwords: QUERY_STOPWORDS_VERSION }).lexicalStopwords, QUERY_STOPWORDS_VERSION);
  assert.throws(() => validateQuery({ text: 'abi', language: 'et', lexicalStopwords: 'other' }), { code: 'unsupported_query_stopwords' });
});

test('fast lexical profiles add the stopwords and the plain rank; existing profiles keep the cover-density rank', async () => {
  const { retrievalProfile, queryForProfile } = await import('../lib/rag-v2/search/profiles.js');
  const { LEXICAL_RANK_PLAIN } = await import('../lib/rag-v2/search/ranking.js');
  assert.equal(validateQuery({ text: 'abi', language: 'et' }).lexicalRank, undefined);
  assert.equal(validateQuery({ text: 'abi', language: 'et', lexicalRank: 'ts-rank-v1' }).lexicalRank, 'ts-rank-v1');
  assert.throws(() => validateQuery({ text: 'abi', language: 'et', lexicalRank: 'bm25' }), { code: 'unsupported_lexical_rank' });
  for (const id of ['hybrid-estnltk-dependencies-v1', 'hybrid-estnltk-vector2-dependencies-v1']) {
    const query = queryForProfile(retrievalProfile(id), { text: 'Kes saab hooldajatoetust?', language: 'et' });
    assert.equal(query.lexicalRank, undefined); assert.equal(query.lexicalStopwords, undefined);
  }
  for (const [id, weights] of [['hybrid-estnltk-fast-lexical-dependencies-v1', undefined], ['hybrid-estnltk-vector2-fast-lexical-dependencies-v1', { lexical: 1, vector: 2 }]]) {
    const profile = retrievalProfile(id), query = queryForProfile(profile, { text: 'Kes saab hooldajatoetust?', language: 'et' });
    assert.equal(query.lexicalRank, LEXICAL_RANK_PLAIN); assert.equal(query.lexicalStopwords, QUERY_STOPWORDS_VERSION);
    assert.deepEqual(query.channelWeights, weights); assert.equal(query.semanticGraph, true);
    assert.equal(profile.generation_requirements.lexical, retrievalProfile('hybrid-estnltk-dependencies-v1').generation_requirements.lexical);
  }
});
