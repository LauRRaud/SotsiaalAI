import test from 'node:test';
import assert from 'node:assert/strict';
import { queryPlanRequest, rerankRequest, validateQueryPlan, validateRerank, searchAssistEnabled, SEARCH_ASSIST_VERSION, SEARCH_ASSIST_LIMITS } from '../lib/rag-v2/pilot/search-assist.js';
import { validateQuery, validateChannelWeights, rrf } from '../lib/rag-v2/search/ranking.js';
import { chunkExcerpt } from '../lib/rag-v2/search/excerpt.js';
import { retrievalProfile, CHAT_PROFILE } from '../lib/rag-v2/search/profiles.js';

const config = { model: 'gpt-6-luna' };

test('search assist: both model calls are strict, low-effort, unstored JSON requests; the selection can only name offered passages', () => {
  const plan = queryPlanRequest(config, ['Elan Tallinnas ja üürivõlg kasvab.'], 'et');
  assert.equal(plan.store, false); assert.equal(plan.reasoning.effort, 'low'); assert.equal(plan.text.format.strict, true);
  assert.equal(plan.text.format.schema.properties.queries.maxItems, SEARCH_ASSIST_LIMITS.queries);
  assert.deepEqual(JSON.parse(plan.input[0].content), { language: 'et', messages: ['Elan Tallinnas ja üürivõlg kasvab.'] });
  const passages = [{ id: 'P1', title: 'A', text: 'x' }, { id: 'P2', title: 'B', text: 'y' }];
  const rerank = rerankRequest(config, ['küsimus'], passages);
  assert.deepEqual(rerank.text.format.schema.properties.useful.items.enum, ['P1', 'P2']);
  assert.equal(rerank.text.format.schema.properties.useful.maxItems, SEARCH_ASSIST_LIMITS.selected);
  // Instructions never carry the user's text; the request data is a separate, untrusted JSON input.
  assert(!plan.instructions.includes('üürivõlg') && /untrusted data/.test(plan.instructions) && /untrusted data/.test(rerank.instructions));
});

test('search assist: planned queries are trimmed, distinct and differ from the search text; malformed plans and selections are refused', () => {
  assert.deepEqual(validateQueryPlan({ queries: ['  võlanõustamine  Tallinn ', 'Võlanõustamine Tallinn', ''] }, 'küsimus'), ['võlanõustamine Tallinn']);
  assert.deepEqual(validateQueryPlan({ queries: ['Küsimus', 'teine päring'] }, 'küsimus'), ['teine päring']);
  assert.deepEqual(validateQueryPlan({ queries: [] }, 'x'), []);
  for (const value of [null, {}, { queries: 'x' }, { queries: ['a', 'b', 'c', 'd'] }, { queries: [1] }]) {
    assert.throws(() => validateQueryPlan(value, 'x'), { code: 'invalid_query_plan' });
  }
  const passages = [{ id: 'P1' }, { id: 'P2' }];
  assert.deepEqual(validateRerank({ useful: ['P2', 'P1'] }, passages), ['P2', 'P1']);
  assert.deepEqual(validateRerank({ useful: [] }, passages), []);
  for (const value of [null, { useful: ['P3'] }, { useful: ['P1', 'P1'] }, { useful: 'P1' }]) {
    assert.throws(() => validateRerank(value, passages), { code: 'invalid_rerank_selection' });
  }
  assert.equal(searchAssistEnabled({}), false);
  assert.equal(searchAssistEnabled({ searchAssist: SEARCH_ASSIST_VERSION }), true);
  assert.throws(() => searchAssistEnabled({ searchAssist: 'rag-v2/search-assist-0' }), { code: 'unsupported_search_assist' });
});

test('query variants are bounded and trimmed; each variant has its own channels, weighted by channel kind', () => {
  const base = { text: 'küsimus', language: 'et' };
  assert.deepEqual(validateQuery({ ...base, variants: [' a ', 'b'] }).variants, ['a', 'b']);
  for (const variants of [[], 'a', ['a', 'b', 'c', 'd'], [''], ['x'.repeat(1001)]]) {
    if (Array.isArray(variants) && !variants.length) { assert.deepEqual(validateQuery({ ...base, variants }).variants, []); continue; }
    assert.throws(() => validateQuery({ ...base, variants }), { code: 'invalid_query_variants' });
  }
  validateChannelWeights({ lexical: 1, vector: 2, lexical_1: 1, vector_3: 2 });
  for (const weights of [{ lexical_4: 1 }, { vector_0: 1 }, { other: 1 }]) assert.throws(() => validateChannelWeights(weights), { code: 'invalid_channel_weights' });
  // A passage found by the question and by a variant sums both contributions.
  const ranked = rrf({ vector: [{ id: 'a' }, { id: 'b' }], vector_1: [{ id: 'b' }] }, 60, { vector: 2, vector_1: 2 });
  assert.equal(ranked[0].id, 'b');
});

test('a chunk excerpt is an ordered subset of the chunk and rebuilds the same text and locations', () => {
  const units = [0, 1, 2].map(index => ({ id: `u${index}`, index, raw_text: ['Pealkiri', 'Kokkuvõte', '["a_b"]'][index],
    locator: { kind: 'json', path: `/items/0/${['title', 'summary', 'contactRefs'][index]}` }, offset_basis: 'source_unit_text_utf16' }));
  const spans = units.map(unit => ({ id: `s${unit.index}`, source_unit_index: unit.index, start: 0, end: unit.raw_text.length, source_text: unit.raw_text }));
  const bundle = { source_units: units, spans }, chunk = { span_ids: ['s0', 's1', 's2'] };
  const excerpt = chunkExcerpt(bundle, chunk, ['s0', 's1']);
  assert.equal(excerpt.source_text, 'Pealkiri\nKokkuvõte');
  assert.deepEqual(excerpt.source_locations.map(location => location.path), ['/items/0/title', '/items/0/summary']);
  for (const ids of [['s1', 's0'], ['s0', 's0'], [], ['s9'], 's0']) assert.throws(() => chunkExcerpt(bundle, chunk, ids), { code: 'invalid_chunk_excerpt' });
});

test('the chat profile keeps the vector2 fast-lexical choices with nine seeds in a 10000-token budget', () => {
  const profile = retrievalProfile(CHAT_PROFILE);
  assert.deepEqual(profile.query.channelWeights, { lexical: 1, vector: 2 });
  assert.equal(profile.query.limits.topK, 9); assert.equal(profile.query.finalLimit, 9); assert.equal(profile.query.limits.contextTokens, 10000);
  assert.equal(profile.query.lexicalRank, 'ts-rank-v1'); assert.equal(profile.query.semanticGraph, true);
  // Earlier profiles keep their exact budgets.
  assert.equal(retrievalProfile('hybrid-estnltk-vector2-fast-lexical-dependencies-v1').query.limits.topK, 5);
});
