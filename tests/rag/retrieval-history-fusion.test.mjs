import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRagSearchQuery, buildSourceAnchoredRagQueries, searchRagQueries }
  from "../../lib/chat/retrievalOrchestrator.js";

const history = [{ role: "assistant", content: "Varasema uuringu vastus.", displayedSources: [
  { document_id: "previous-report", title: "Varasem uuring", year: 2026 },
  { document_id: "previous-article", title: "Teine varasem artikkel", year: 2025 }
] }];

test("independent broad questions do not inherit a previous source in either query builder", () => {
  for (const query of [
    "Mida kirjutab ajakiri Sotsiaaltöö integreeritud teenustest?",
    "Võrdle sotsiaalteenuste korraldust eri uuringutes.",
    "Mida mainitakse ajakirjas integreeritud teenustest?",
    "Võrdle eri laste mainitud probleeme."
  ]) {
    assert.equal(buildRagSearchQuery(query, history), buildRagSearchQuery(query, []), query);
    assert.deepEqual(buildSourceAnchoredRagQueries(query, history), buildSourceAnchoredRagQueries(query, []), query);
  }
});

test("explicit plural comparisons stay inside the complete previous source set", () => {
  for (const query of ["Võrdle nende artiklite järeldusi.", "Millised on nende artiklite pealkirjad?", "Too nende allikate erinevused välja."]) {
    const queries = buildSourceAnchoredRagQueries(query, history);
    assert.equal(queries.length, 1, query);
    assert.deepEqual(queries[0].filters, { document_id: { $in: ["previous-report", "previous-article"] } }, query);
    assert.match(queries[0].query, /Varasem uuring/);
    assert.match(queries[0].query, /Teine varasem artikkel/);
  }
});

test("explicit singular comparisons stay inside the latest source", () => {
  for (const query of ["Mida samas artiklis soovitatakse?", "Võrdle sama artikli soovitusi."]) {
    const queries = buildSourceAnchoredRagQueries(query, history);
    assert.equal(queries.length, 1, query);
    assert.deepEqual(queries[0].filters, { document_id: "previous-report" }, query);
  }
});

const primary = [
  { id: "a", text: "First body", hybrid_score: 0.4808, distance: 0.51, metadata: { doc_id: "a-doc" } },
  { id: "b", text: "Second body", hybrid_score: 0.4013, distance: 0.58, metadata: { doc_id: "b-doc" } }
];
const supplemental = [
  { id: "b", text: "Second body", hybrid_score: 0.45, metadata: { doc_id: "b-doc" } },
  { id: "c", text: "Third body", hybrid_score: 0.3, metadata: { doc_id: "c-doc" } }
];

function fakeFetch(responses) {
  return async (_url, options) => {
    const { query } = JSON.parse(options.body);
    const results = responses[query];
    if (results instanceof Error) throw results;
    assert.ok(Array.isArray(results), `Unexpected query: ${query}`);
    return new Response(JSON.stringify({
      results, retrievers_used: ["dense"], merge_strategy: "native",
      channel_stats: { dense: { count: results.length } }
    }), { status: 200 });
  };
}

function search(queries, responses, onTiming) {
  return searchRagQueries({ queries, fetchImpl: fakeFetch(responses), profileConsentDb: null, onTiming });
}

test("one contributing result retains native scores, metadata and each query's timing", async () => {
  const single = await search(["primary"], { primary });
  for (const [queries, responses] of [
    [["primary", "empty"], { primary, empty: [] }],
    [["empty", "primary"], { primary, empty: [] }],
    [["primary", "failed"], { primary, failed: new Error("supplement_error") }],
    [["failed", "primary"], { primary, failed: new Error("primary_error") }]
  ]) {
    const timings = [];
    const result = await search(queries, responses, item => timings.push(item));
    assert.deepEqual(result, single);
    assert.equal(timings.length, 2);
    assert.deepEqual(timings.map(item => item.observabilityStage).sort(), ["rag_search_q1", "rag_search_q2"]);
    assert.equal(timings.filter(item => item.outcome === "error").length, queries.includes("failed") ? 1 : 0);
  }
});

test("two real contributing results still use reciprocal rank fusion", async () => {
  const results = await search(["primary", "supplemental"], { primary, supplemental });
  assert.equal(results[0].id, "b");
  assert.equal(results[0].multi_query_hit_count, 2);
  assert.equal(results[0].multi_query_fusion_strategy, "anchored_rrf_v1");
});

test("empty results do not hide retrieval errors", async () => {
  assert.deepEqual(await search(["empty", "other"], { empty: [], other: [] }), []);
  await assert.rejects(() => search(["empty", "failed"], { empty: [], failed: new Error("retrieval_failed") }), /retrieval_failed/);
});
