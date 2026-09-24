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
