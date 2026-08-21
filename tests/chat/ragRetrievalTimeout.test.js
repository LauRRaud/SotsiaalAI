import assert from "node:assert/strict";
import test from "node:test";

import {
  __resetRagRequestClockForTests,
  searchRagQueries
} from "@/lib/chat/retrievalOrchestrator";

// B0b: retrieval'i etapi deterministlik juhtimine — aeglane, abortitud ja
// enne timeout'i lõppev. Testid annavad oma lühema väärtuse `timeoutMs` kaudu.

function okResponse(results = []) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ results, retrievers_used: ["dense"] })
  };
}

/** Vastab alles `delayMs` pärast; austab abort-signaali nagu päris fetch. */
function slowFetch(delayMs, results = []) {
  return (_url, options = {}) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(okResponse(results)), delayMs);
      const signal = options.signal;
      if (signal) {
        if (signal.aborted) {
          clearTimeout(timer);
          reject(Object.assign(new Error("This operation was aborted"), { name: "AbortError" }));
          return;
        }
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(Object.assign(new Error("This operation was aborted"), { name: "AbortError" }));
          },
          { once: true }
        );
      }
    });
}

test("aeglane retrieval abortitakse timeout'il ja viskab AbortError", async () => {
  __resetRagRequestClockForTests();
  const timings = [];
  await assert.rejects(
    () =>
      searchRagQueries({
        queries: ["koduteenus"],
        fetchImpl: slowFetch(5000),
        timeoutMs: 1000,
        onTiming: t => timings.push(t)
      }),
    err => err?.name === "AbortError" || /aborted/i.test(String(err?.message))
  );
  assert.equal(timings.length, 1);
  assert.equal(timings[0].aborted_stage, "rag_search_fetch");
  assert.equal(timings[0].retrieval_timeout_ms, 1000);
  assert.ok(timings[0].retrieval_total_ms >= 900, `total_ms=${timings[0].retrieval_total_ms}`);
  assert.equal(timings[0].outcome, "error");
});

test("enne timeout'i lõppev retrieval õnnestub ja ei ole abortitud", async () => {
  __resetRagRequestClockForTests();
  const timings = [];
  const matches = await searchRagQueries({
    queries: ["koduteenus"],
    fetchImpl: slowFetch(50, [{ id: "a", doc_id: "doc-a", title: "Koduteenus" }]),
    timeoutMs: 3000,
    onTiming: t => timings.push(t)
  });
  assert.equal(matches.length, 1);
  assert.equal(timings[0].aborted_stage, null);
  assert.equal(timings[0].outcome, "ok");
  assert.equal(timings[0].http_status, 200);
  assert.ok(timings[0].retrieval_total_ms < 3000);
});

test("edukas nulltulemusega otsing ei ole viga", async () => {
  __resetRagRequestClockForTests();
  const timings = [];
  const matches = await searchRagQueries({
    queries: ["täiesti tundmatu teema"],
    fetchImpl: slowFetch(10, []),
    timeoutMs: 3000,
    onTiming: t => timings.push(t)
  });
  assert.deepEqual(matches, []);
  assert.equal(timings[0].outcome, "ok");
  assert.equal(timings[0].aborted_stage, null);
});

test("time_since_previous_rag_request_ms on esimesel päringul null ja seejärel arv", async () => {
  __resetRagRequestClockForTests();
  const timings = [];
  const opts = { fetchImpl: slowFetch(10), timeoutMs: 3000, onTiming: t => timings.push(t) };
  await searchRagQueries({ queries: ["esimene"], ...opts });
  await new Promise(r => setTimeout(r, 25));
  await searchRagQueries({ queries: ["teine"], ...opts });
  assert.equal(timings[0].time_since_previous_rag_request_ms, null);
  assert.ok(timings[1].time_since_previous_rag_request_ms >= 20, `saadi ${timings[1].time_since_previous_rag_request_ms}`);
});

test("ajamõõdikud ei sisalda päringu, embeddingu ega allikate sisu", async () => {
  __resetRagRequestClockForTests();
  const timings = [];
  await searchRagQueries({
    queries: ["Jõhvi valla isikliku abistaja teenus"],
    fetchImpl: slowFetch(10, [{ id: "x", doc_id: "kov-rt-johvi-vald", title: "Salajane pealkiri" }]),
    timeoutMs: 3000,
    onTiming: t => timings.push(t)
  });
  const serialized = JSON.stringify(timings[0]);
  for (const secret of ["Jõhvi", "isikliku abistaja", "Salajane", "kov-rt-johvi"]) {
    assert.ok(!serialized.includes(secret), `lekkis: ${secret}`);
  }
});

test("embeddingu ja retrieverite kestus on eraldi väljad, väärtusega null", async () => {
  __resetRagRequestClockForTests();
  const timings = [];
  await searchRagQueries({
    queries: ["koduteenus"],
    fetchImpl: slowFetch(10),
    timeoutMs: 3000,
    onTiming: t => timings.push(t)
  });
  // Need toimuvad rag-service'i sees; kliendipoolelt neid eristada ei saa.
  assert.ok("embedding_duration_ms" in timings[0]);
  assert.ok("retriever_duration_ms" in timings[0]);
  assert.equal(timings[0].embedding_duration_ms, null);
  assert.equal(timings[0].retriever_duration_ms, null);
});

test("ajamõõdikute sündmus mahub redactObject 30-võtme piirangu alla", async () => {
  __resetRagRequestClockForTests();
  const timings = [];
  await searchRagQueries({
    queries: ["koduteenus"],
    fetchImpl: slowFetch(10),
    timeoutMs: 3000,
    onTiming: t => timings.push(t)
  });
  // rag_error / rag_search sündmus kannab need väljad koos oma olemasoleva
  // koormaga; ajamõõdikud ise peavad jääma väikeseks.
  assert.ok(Object.keys(timings[0]).length <= 10, `ajamõõdikute võtmeid: ${Object.keys(timings[0]).length}`);
});

test("tootmise vaikeväärtus kasutab 30 s RAG-ajapiiri, kui timeoutMs ei ole antud", async () => {
  __resetRagRequestClockForTests();
  const timings = [];
  await searchRagQueries({
    queries: ["koduteenus"],
    fetchImpl: slowFetch(10),
    onTiming: t => timings.push(t)
  });
  assert.equal(timings[0].retrieval_timeout_ms, 30000);
});

test("mitme alamotsingu rada kasutab sama seadistatud 30 s ajapiiri", async () => {
  __resetRagRequestClockForTests();
  const timings = [];
  await searchRagQueries({
    queries: ["koduteenus", "isiklik abistaja"],
    fetchImpl: slowFetch(10),
    onTiming: t => timings.push(t)
  });
  assert.equal(timings.length, 2);
  assert.deepEqual(timings.map(timing => timing.retrieval_timeout_ms), [30000, 30000]);
});

test("rag-service timings teisenduvad frontend-lepingusse ja stage jääb eristatavaks", async () => {
  __resetRagRequestClockForTests();
  const timings = [];
  let requestBody = null;
  let requestHeaders = null;
  const matches = await searchRagQueries({
    queries: ["graph query"],
    observabilityStage: "rag_search_graph_channel",
    fetchImpl: async (_url, options = {}) => {
      requestBody = JSON.parse(String(options.body || "{}"));
      requestHeaders = options.headers;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          request_id: requestBody.request_id,
          timings: {
            embedding_ms: 7,
            retrieval_ms: 11,
            total_ms: 21,
            outcome: "ok"
          },
          retrievers_used: ["dense"],
          results: [{ id: "graph-1", title: "Graph result" }]
        })
      };
    },
    timeoutMs: 3000,
    onTiming: value => timings.push(value)
  });

  assert.equal(matches[0].id, "graph-1");
  assert.match(requestBody.request_id, /^rag-/);
  assert.equal(requestHeaders["X-Request-Id"], requestBody.request_id);
  assert.equal(requestHeaders["X-Observability-Stage"], "rag_search_graph_channel");
  assert.equal(timings[0].request_id, requestBody.request_id);
  assert.equal(timings[0].observabilityStage, "rag_search_graph_channel");
  assert.equal(timings[0].embedding_duration_ms, 7);
  assert.equal(timings[0].retriever_duration_ms, 11);
  assert.equal(timings[0].retrieval_total_ms, 21);
  assert.equal(timings[0].outcome, "ok");
});
