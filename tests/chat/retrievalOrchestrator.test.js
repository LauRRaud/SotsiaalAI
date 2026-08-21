import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  buildRagSearchQuery,
  buildSourceLookupSearchQuery,
  buildSourceAnchoredRagQueries,
  buildThematicSynthesisQueryParts,
  detectSourceAvailabilityRequest,
  dedupeRagMatches,
  extractRecentAssistantSourceAnchors,
  extractRecentAssistantSourceFocus,
  hasRecentAssistantSources,
  inferRetrieversUsed,
  isBroadMultiSourceRagQuestion,
  isSpecificDocumentFactRagQuestion,
  isThematicSynthesisRagQuestion,
  searchRagQueries,
  shouldUseAnswerHistory
} from "../../lib/chat/retrievalOrchestrator.js";

test("single named document fact questions are not widened into corpus synthesis", () => {
  const questions = [
    "Mida soovitas 2025. aasta dementsuse ennetamise artikkel nädalase liikumise ja ööune kohta ning mitu korda suurem on dementsuse risk kuulmislangusega inimesel?",
    "Millised ohumärgid on selles juhendis kirjas?",
    "Mitu inimest osales 2024. aasta uuringus?"
  ];

  for (const question of questions) {
    assert.equal(isSpecificDocumentFactRagQuestion(question), true, question);
    assert.equal(isThematicSynthesisRagQuestion(question), false, question);
    assert.equal(isBroadMultiSourceRagQuestion(question), false, question);
  }
});

test("plural and explicit cross-source requests still use synthesis", () => {
  const questions = [
    "Milliseid probleeme käsitlevad artiklid sotsiaaltöös?",
    "Võrdle eri uuringute järeldusi hoolduskoormuse kohta.",
    "Anna ülevaade ajakirjas käsitletud vaimse tervise teemadest."
  ];

  for (const question of questions) {
    assert.equal(isSpecificDocumentFactRagQuestion(question), false, question);
    assert.equal(isBroadMultiSourceRagQuestion(question), true, question);
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const plannerFixturePath = path.resolve(__dirname, "../fixtures/query-planner-v2-cases.json");

function readPlannerCases() {
  return JSON.parse(readFileSync(plannerFixturePath, "utf8"));
}

function assertQueryKind(query, kind, id) {
  if (!kind) return;
  if (kind === "filtered") {
    assert.equal(typeof query, "object", `${id}: expected filtered query object`);
    assert.equal(query && !Array.isArray(query), true, `${id}: expected filtered query object`);
    assert.equal(typeof query.query, "string", `${id}: expected filtered query text`);
    assert.equal(typeof query.filters, "object", `${id}: expected filtered query filters`);
    return;
  }
  if (kind === "unfiltered") {
    assert.equal(typeof query, "string", `${id}: expected unfiltered query string`);
    return;
  }
  assert.fail(`${id}: unknown query kind ${kind}`);
}

function queryText(query) {
  return typeof query === "string" ? query : String(query?.query || "");
}

test("dedupeRagMatches annotates dense retriever metadata by default", () => {
  const deduped = dedupeRagMatches([
    {
      id: "chunk-1",
      title: "Koduteenus",
      text: "Koduteenuse kirjeldus"
    }
  ]);

  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].retriever, "dense");
  assert.equal(deduped[0].retrieval_channel, "dense");
  assert.deepEqual(deduped[0].retrieval_channels, ["dense"]);
  assert.deepEqual(inferRetrieversUsed(deduped), ["dense"]);
});

test("dedupeRagMatches merges retriever channels for duplicate chunks", () => {
  const deduped = dedupeRagMatches([
    {
      id: "chunk-1",
      retrieval_channel: "dense",
      text: "Koduteenuse kirjeldus"
    },
    {
      id: "chunk-1",
      retrieval_channel: "title_match",
      text: "Koduteenuse kirjeldus"
    }
  ]);

  assert.equal(deduped.length, 1);
  assert.deepEqual(deduped[0].retrieval_channels, ["dense", "title_match"]);
  assert.deepEqual(inferRetrieversUsed(deduped), ["dense", "title_match"]);
});

test("searchRagQueries sends hybrid retriever request and preserves returned channels", async () => {
  const previousFetch = global.fetch;
  const calls = [];
  global.fetch = async (_url, options = {}) => {
    const body = JSON.parse(String(options.body || "{}"));
    calls.push(body);
    return {
      ok: true,
      async text() {
        return JSON.stringify({
          retrievers_used: ["dense", "title_match", "bm25"],
          search_strategy: "hybrid",
          merge_strategy: {
            strategy: "weighted_hybrid_rrf",
            rrf_k: 60,
            requested_retrievers: ["dense", "title_match", "exact_phrase", "bm25"]
          },
          channel_stats: {
            result_count: 1,
            channel_counts: {
              dense: 1,
              title_match: 1,
              bm25: 1
            },
            top_channels: ["dense", "title_match", "bm25"],
            dense_only_count: 0,
            lexical_only_count: 0,
            dense_and_lexical_count: 1,
            bm25: {
              result_count: 1,
              only_count: 0,
              average_score: 2.4,
              top_score: 2.4,
              average_coverage: 0.75
            }
          },
          results: [
            {
              id: "chunk-title",
              title: "Tartu linn koduteenus",
              text: "Koduteenuse taotlemine Tartus.",
              retrieval_channels: ["dense", "title_match", "bm25"],
              hybrid_score: 0.82,
              bm25_score: 2.4,
              bm25_coverage: 0.75,
              bm25_matches: 3,
              bm25_query_tokens: 4,
              rrf_score: 0.04,
              retrieval_scores: {
                hybrid_score: 0.82,
                rrf_score: 0.04,
                dense_rank: 1,
                lexical_rank: 1
              }
            }
          ]
        });
      }
    };
  };

  try {
    const results = await searchRagQueries({
      queries: "Tartu linn koduteenus",
      topK: 5
    });

    assert.deepEqual(calls[0].retrievers, ["dense", "title_match", "exact_phrase", "bm25"]);
    assert.deepEqual(results[0].retrieval_channels, ["dense", "title_match", "bm25"]);
    assert.equal(results[0].hybrid_score, 0.82);
    assert.equal(results[0].rrf_score, 0.04);
    assert.equal(results[0].search_strategy, "hybrid");
    assert.equal(results[0].retrieval_merge_strategy.strategy, "weighted_hybrid_rrf");
    assert.equal(results[0].retrieval_channel_stats.channel_counts.title_match, 1);
    assert.equal(results[0].retrieval_channel_stats.bm25.average_coverage, 0.75);
    assert.equal(results[0].bm25_score, 2.4);
    assert.equal(results[0].bm25_coverage, 0.75);
    assert.equal(results[0].retrieval_scores.dense_rank, 1);
    assert.deepEqual(inferRetrieversUsed(results), ["dense", "title_match", "bm25"]);
  } finally {
    global.fetch = previousFetch;
  }
});

test("searchRagQueries does not copy response-level retrievers onto a dense-only result", async () => {
  const previousFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    async text() {
      return JSON.stringify({
        retrievers_used: ["dense", "title_match", "bm25"],
        results: [
          {
            id: "dense-only-chunk",
            text: "Semantiline tabamus ilma leksikaalse katteta.",
            retrieval_channels: ["dense"]
          }
        ]
      });
    }
  });

  try {
    const results = await searchRagQueries({
      queries: "erihooldekodude elanike kaardistus",
      topK: 5
    });

    assert.deepEqual(results[0].retrieval_channels, ["dense"]);
    assert.deepEqual(results[0].retrievalChannels, ["dense"]);
    assert.equal(results[0].retriever, "dense");
  } finally {
    global.fetch = previousFetch;
  }
});

test("searchRagQueries can request dense-only retrieval for an exhaustive filtered list", async () => {
  const previousFetch = global.fetch;
  let requestBody = null;
  global.fetch = async (_url, options = {}) => {
    requestBody = JSON.parse(String(options.body || "{}"));
    return {
      ok: true,
      async text() {
        return JSON.stringify({ retrievers_used: ["dense"], results: [] });
      }
    };
  };

  try {
    await searchRagQueries({
      queries: [{
        query: "Harku valla sotsiaalteenused",
        filters: {
          municipality_id: "harku_vald",
          collection_id: "kov_services",
          item_type: "service"
        }
      }],
      retrievers: ["dense"],
      topK: 40
    });

    assert.deepEqual(requestBody?.retrievers, ["dense"]);
    assert.equal(requestBody?.top_k, 40);
  } finally {
    global.fetch = previousFetch;
  }
});

test("searchRagQueries forwards a bounded same-article evidence depth", async () => {
  const previousFetch = global.fetch;
  let requestBody = null;
  global.fetch = async (_url, options = {}) => {
    requestBody = JSON.parse(String(options.body || "{}"));
    return {
      ok: true,
      async text() {
        return JSON.stringify({ results: [] });
      }
    };
  };

  try {
    await searchRagQueries({
      queries: ["Kui palju omavalitsusi ja mitu koolitust?"],
      topK: 12,
      journalChunksPerDocument: 8
    });

    assert.equal(requestBody?.journal_chunks_per_document, 8);
  } finally {
    global.fetch = previousFetch;
  }
});

test("searchRagQueries throws on rag-service retrieval 503 instead of returning no evidence", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 503,
    text: async () => JSON.stringify({ detail: { code: "RAG_RETRIEVAL_UNAVAILABLE", request_id: "req-failed" } })
  });
  try {
    await assert.rejects(
      searchRagQueries({ queries: ["failure"], timeoutMs: 1000 }),
      (error) => error?.code === "RAG_RETRIEVAL_UNAVAILABLE" && error?.status === 503
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("buildRagSearchQuery anchors short follow-ups to recent assistant sources", () => {
  const history = [
    {
      role: "assistant",
      text: "Laur Raudsoo on kirjutanud artikli „Tehisintellekt sotsiaaltöös: praktika, kaalutlused ja väärtuspõhised piirid“.",
      sources: [
        {
          source_id: "sotsiaaltoo-ai-2025",
          title: "Tehisintellekt sotsiaaltöös: praktika, kaalutlused ja väärtuspõhised piirid",
          authors: ["Laur Raudsoo"],
          journalTitle: "Sotsiaaltöö",
          year: 2025,
          source_type: "journal_article"
        }
      ]
    },
    {
      role: "user",
      text: "Kas seal Eestit ka mainitakse?"
    }
  ];

  const query = buildRagSearchQuery("Soome", history);

  assert.match(query, /Soome/);
  assert.match(query, /Tehisintellekt sotsiaaltöös/);
  assert.match(query, /Laur Raudsoo/);
  assert.equal(hasRecentAssistantSources(history), true);
  assert.deepEqual(extractRecentAssistantSourceAnchors(history, 1), [
    "Tehisintellekt sotsiaaltöös: praktika, kaalutlused ja väärtuspõhised piirid Laur Raudsoo Sotsiaaltöö 2025"
  ]);
});

test("buildRagSearchQuery adds a generic keyword-focused query for factual background questions", () => {
  const query = buildRagSearchQuery("kas eestis kasutatakse tehisintellekti, nt töötukassas?", []);

  assert.match(query, /töötukassas/i);
  assert.match(query, /tehisintellekti töötukassas/i);
  assert.doesNotMatch(query, /OTT/i);
});

test("buildRagSearchQuery does not pollute a short independent topic with older user turns", () => {
  const history = [
    { role: "user", text: "Harku valla sotsiaaltöötajad?" },
    { role: "assistant", text: "Harku valla kontaktide vastus." },
    { role: "user", text: "Palun loetle kõik Harku valla sotsiaalteenused." },
    { role: "assistant", text: "Harku valla teenuste vastus." },
    { role: "user", text: "loetle kõik toetused" },
    { role: "assistant", text: "Harku valla toetuste vastus." }
  ];

  const personQuery = buildRagSearchQuery("kes on Laur Raudsoo", history);
  const topicQuery = buildRagSearchQuery("tehisintellekt sotsiaalvaldkonnas? töötukassas?", history);

  assert.match(personQuery, /Laur Raudsoo/);
  assert.doesNotMatch(personQuery, /Harku/i);
  assert.doesNotMatch(personQuery, /toetused/i);
  assert.match(topicQuery, /tehisintellekt/i);
  assert.match(topicQuery, /töötukassas/i);
  assert.doesNotMatch(topicQuery, /Harku/i);
  assert.doesNotMatch(topicQuery, /toetused/i);
});

test("answer history is limited to turns that explicitly depend on the conversation", () => {
  assert.equal(shouldUseAnswerHistory("Tehisintellekt sotsiaaltöös?"), false);
  assert.equal(shouldUseAnswerHistory("Kes on Laur Raudsoo?"), false);
  assert.equal(
    shouldUseAnswerHistory(
      "Kuidas kasutab Eesti Töötukassa OTT-süsteem tehisintellekti ning milliseid piiranguid kasutajad esile tõid?"
    ),
    false
  );
  assert.equal(shouldUseAnswerHistory("Aga milliseid piiranguid kasutajad nimetasid?"), true);
  assert.equal(shouldUseAnswerHistory("Mida sellest järeldada?"), true);
  assert.equal(shouldUseAnswerHistory("Miks?"), true);
  assert.equal(shouldUseAnswerHistory("Soome"), true);
});

test("buildRagSearchQuery does not add a separate exact-anchor query for named example lists", () => {
  const query = buildRagSearchQuery("Vaimse tervise vestlusrobotid, nagu Woebot, Wysa, Vivibot ja XiaoE?", []);
  const normalizedLines = query
    .split(/\n+/)
    .map(line => line.trim().toLowerCase())
    .filter(Boolean);

  assert.match(query, /Woebot/i);
  assert.equal(normalizedLines.includes("woebot wysa vivibot xiaoe"), false);
});

test("buildRagSearchQuery expands open thematic synthesis questions with issue and evidence angles", () => {
  const message = "mis on need probleemsed kohad, millest on lastekaitses räägitud?";
  const query = buildRagSearchQuery(message, []);
  const thematicParts = buildThematicSynthesisQueryParts(message);

  assert.equal(isThematicSynthesisRagQuestion(message), true);
  assert.equal(isBroadMultiSourceRagQuestion(message), true);
  assert.match(query, /lastekaitses/i);
  assert.match(query, /lastekaitse probleemid kitsaskohad/i);
  assert.match(query, /uuring juhend statistika ajakiri praktika kogemus/i);
  assert.match(query, /töökorraldus töökoormus ajapuudus dokumenteerimine andmesüsteem/i);
  assert.equal(thematicParts.length >= 4, true);
});

test("buildRagSearchQuery treats short child protection concern questions as thematic synthesis", () => {
  const message = "mis on murekohad lastekaitses?";
  const query = buildRagSearchQuery(message, []);
  const thematicParts = buildThematicSynthesisQueryParts(message);

  assert.equal(isThematicSynthesisRagQuestion(message), true);
  assert.equal(isBroadMultiSourceRagQuestion(message), true);
  assert.match(query, /lastekaitses/i);
  assert.match(query, /lastekaitse probleemid kitsaskohad/i);
  assert.match(query, /lastekaitsetootajad probleemid kitsaskohad dokumenteerimine ajapuudus/i);
  assert.equal(thematicParts.length >= 5, true);
});

test("buildRagSearchQuery treats generic discussed-topic questions as thematic synthesis", () => {
  const message = "millest räägitakse järelevalve ja dokumenteerimise puhul?";
  const query = buildRagSearchQuery(message, []);
  const thematicParts = buildThematicSynthesisQueryParts(message);

  assert.equal(isThematicSynthesisRagQuestion(message), true);
  assert.equal(isBroadMultiSourceRagQuestion(message), true);
  assert.match(query, /järelevalve/i);
  assert.match(query, /dokumenteerimise/i);
  assert.equal(thematicParts.length >= 4, true);
  assert.equal(thematicParts.some(part => /uuring juhend statistika ajakiri praktika kogemus/i.test(part)), true);
});

test("buildSourceAnchoredRagQueries adds focused source filters before fallback query", () => {
  const history = [
    {
      role: "assistant",
      text: "Artikli vastus.",
      sources: [
        {
          source_id: "sotsiaaltoo-ai-2025",
          doc_id: "article-doc-2025",
          title: "Tehisintellekt sotsiaaltöös: praktika, kaalutlused ja väärtuspõhised piirid",
          authors: ["Laur Raudsoo"],
          journalTitle: "Sotsiaaltöö",
          year: 2025
        }
      ]
    }
  ];

  const focus = extractRecentAssistantSourceFocus(history, 1);
  const queries = buildSourceAnchoredRagQueries("Eesti", history, buildRagSearchQuery("Eesti", history));

  assert.deepEqual(focus, [
    {
      anchor: "Tehisintellekt sotsiaaltöös: praktika, kaalutlused ja väärtuspõhised piirid Laur Raudsoo Sotsiaaltöö 2025",
      filters: {
        doc_id: "article-doc-2025"
      }
    }
  ]);
  assert.equal(queries.length, 2);
  assert.deepEqual(queries[0].filters, { doc_id: "article-doc-2025" });
  assert.match(queries[0].query, /Eesti/);
  assert.match(queries[0].query, /Tehisintellekt sotsiaaltöös/);
  assert.equal(typeof queries[1], "string");
});

test("buildSourceAnchoredRagQueries keeps broad synthesis queries unfiltered first", () => {
  const history = [
    {
      role: "assistant",
      text: "Artikli vastus.",
      sources: [
        {
          source_id: "sotsiaaltoo-ai-2025",
          doc_id: "article-doc-2025",
          title: "Tehisintellekt sotsiaaltöös: praktika, kaalutlused ja väärtuspõhised piirid",
          authors: ["Laur Raudsoo"],
          journalTitle: "Sotsiaaltöö",
          year: 2025
        }
      ]
    }
  ];

  const message = "võrdle seda teiste Sotsiaaltöö artiklitega tehisintellekti teemal";
  const queries = buildSourceAnchoredRagQueries(message, history, buildRagSearchQuery(message, history));

  assert.equal(isBroadMultiSourceRagQuestion(message), true);
  assert.equal(typeof queries[0], "string");
  assert.match(queries[0], /võrdle seda teiste/);
  assert.match(queries[0], /Tehisintellekt sotsiaaltöös/);
  const focused = queries.find(query => query?.filters?.doc_id === "article-doc-2025");
  assert.deepEqual(focused?.filters, { doc_id: "article-doc-2025" });
});

test("buildSourceAnchoredRagQueries sends one diversified query for thematic synthesis", () => {
  const message = "mis on need probleemsed kohad, millest on lastekaitses räägitud?";
  const queries = buildSourceAnchoredRagQueries(message, [], buildRagSearchQuery(message, []));

  assert.equal(queries.length, 1);
  assert.equal(queries.every(query => typeof query === "string"), true);
  assert.match(queries[0], /probleemsed kohad/i);
});

test("numeric mitu question is not mistaken for multi-source synthesis", () => {
  assert.equal(
    isBroadMultiSourceRagQuestion(
      "Mitu omavalitsust oli STARis menetlusi algatanud ning mitu koolitust korraldati?"
    ),
    false
  );
  assert.equal(
    isBroadMultiSourceRagQuestion(
      "Võrdle mitme artikli käsitlusi ja anna ülevaade peamistest erinevustest"
    ),
    true
  );
});

test("detectSourceAvailabilityRequest treats inflected legal provision lists as source lookup", () => {
  assert.equal(
    detectSourceAvailabilityRequest([], "Millised Sotsiaalhoolekande seaduse paragrahvid reguleerivad toimetulekutoetust?"),
    true
  );
});

test("buildSourceLookupSearchQuery keeps SHS legal lookups free of hardcoded section anchors", () => {
  const query = buildSourceLookupSearchQuery(
    "Millised Sotsiaalhoolekande seaduse paragrahvid reguleerivad toimetulekutoetust?",
    []
  );

  assert.match(query, /Sotsiaalhoolekande seadus/);
  assert.match(query, /toimetulekutoetust/);
  assert.doesNotMatch(query, /131 132 133 134 135/);
  assert.doesNotMatch(query, /Ā§ 135/);
  return;
  assert.match(query, /§ 131 Toimetulekutoetus/);
  assert.match(query, /§ 132 Toimetulekutoetuse taotlemine/);
  assert.match(query, /§ 133 Toimetulekutoetuse arvestamise alused/);
  assert.match(query, /§ 134 Toimetulekutoetuse määramine ja maksmine/);
  assert.match(query, /§ 135 Riigieelarvest makstav täiendav sotsiaaltoetus/);
  assert.doesNotMatch(query, /§ 176/);
});

test("searchRagQueries merges per-query source filters with base filters", async () => {
  const previousFetch = global.fetch;
  const calls = [];
  global.fetch = async (_url, options = {}) => {
    const body = JSON.parse(String(options.body || "{}"));
    calls.push(body);
    return {
      ok: true,
      async text() {
        return JSON.stringify({
          retrievers_used: ["dense"],
          results: []
        });
      }
    };
  };

  try {
    await searchRagQueries({
      queries: [
        {
          query: "Eesti\nTehisintellekt sotsiaaltöös",
          filters: {
            doc_id: "article-doc-2025"
          }
        },
        "Eesti\nTehisintellekt sotsiaaltöös"
      ],
      filters: {
        audience: { $in: ["CLIENT", "BOTH"] }
      },
      topK: 8
    });

    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].where, {
      audience: { $in: ["CLIENT", "BOTH"] },
      doc_id: "article-doc-2025"
    });
    assert.deepEqual(calls[1].where, {
      audience: { $in: ["CLIENT", "BOTH"] }
    });
  } finally {
    global.fetch = previousFetch;
  }
});

test("searchRagQueries keeps independent multi-query retrieval concurrent", async () => {
  const previousFetch = global.fetch;
  let active = 0;
  let maxActive = 0;
  const completed = [];
  const requestedDepths = [];
  global.fetch = async (_url, options = {}) => {
    const body = JSON.parse(String(options.body || "{}"));
    requestedDepths.push([body.query, body.top_k]);
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 15));
    completed.push(body.query);
    active -= 1;
    return {
      ok: true,
      async text() {
        return JSON.stringify({
          retrievers_used: ["dense"],
          results: [{ id: `result-${body.query}`, text: body.query }]
        });
      }
    };
  };

  try {
    const results = await searchRagQueries({
      queries: ["esimene", "teine", "kolmas"],
      topK: 9
    });

    assert.equal(maxActive, 3);
    assert.deepEqual(completed.sort(), ["esimene", "kolmas", "teine"]);
    assert.deepEqual(results.map(item => item.id), ["result-esimene", "result-teine", "result-kolmas"]);
    assert.deepEqual(requestedDepths, [
      ["esimene", 9],
      ["teine", 5],
      ["kolmas", 5]
    ]);
  } finally {
    global.fetch = previousFetch;
  }
});

test("supplemental query cannot overwrite or outscore the primary query on an incomparable scale", async () => {
  const previousFetch = global.fetch;
  global.fetch = async (_url, options = {}) => {
    const body = JSON.parse(String(options.body || "{}"));
    const primary = body.query === "tervikküsimus";
    return {
      ok: true,
      async text() {
        return JSON.stringify({
          retrievers_used: ["dense", "bm25"],
          results: primary
            ? [{ id: "shared", text: "põhitulemus", hybrid_score: 0.42, hybrid_rank: 4 }]
            : [
                { id: "shared", text: "põhitulemus", hybrid_score: 0.95, hybrid_rank: 1 },
                { id: "supplement", text: "lisatulemus", hybrid_score: 0.9, hybrid_rank: 1 }
              ]
        });
      }
    };
  };

  try {
    const results = await searchRagQueries({
      queries: ["tervikküsimus", "kitsas osapäring"],
      topK: 8
    });

    assert.equal(results[0].id, "shared");
    assert.equal(results[0].hybrid_score, 0.42);
    assert.equal(results[0].hybrid_rank, 4);
    assert.equal(results[1].id, "supplement");
    assert.ok(results[1].hybrid_score < 0.42);
    assert.equal(results[1].multi_query_supplemental, true);
  } finally {
    global.fetch = previousFetch;
  }
});

test("null hybrid scores fall back to distance when capping supplemental results", async () => {
  const seenQueries = [];
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    seenQueries.push(body.query);
    const result = body.query === "primary"
      ? { id: "primary", hybrid_score: null, distance: 0.2 }
      : { id: "supplemental", hybrid_score: null, distance: 0.05 };
    return {
      ok: true,
      text: async () => JSON.stringify({ results: [result] })
    };
  };

  const results = await searchRagQueries({
    queries: ["primary", "supplemental"],
    topK: 1,
    fetchImpl,
    timeoutMs: 1000
  });

  assert.deepEqual(seenQueries, ["primary", "supplemental"]);
  const supplemental = results.find(item => item.id === "supplemental");
  assert.ok(supplemental);
  assert.ok(supplemental.distance > 0.2);
  assert.equal(supplemental.hybrid_score, null);
});

test("searchRagQueries keeps fulfilled multi-query results when another query aborts", async () => {
  const previousFetch = global.fetch;
  const calls = [];
  global.fetch = async (_url, options = {}) => {
    const body = JSON.parse(String(options.body || "{}"));
    calls.push(body);
    if (String(body.query || "").includes("abort")) {
      throw new Error("This operation was aborted");
    }
    return {
      ok: true,
      async text() {
        return JSON.stringify({
          retrievers_used: ["dense"],
          results: [
            {
              id: "child-protection-article",
              title: "Hea töö ei sünni Excelis",
              text: "Lastekaitsetöötajad kirjeldavad dokumenteerimise ja ajapuuduse murekohti."
            }
          ]
        });
      }
    };
  };

  try {
    const results = await searchRagQueries({
      queries: [
        "lastekaitse murekohad dokumenteerimine",
        "abort lastekaitse"
      ],
      topK: 8
    });

    assert.equal(calls.length, 2);
    assert.deepEqual(results.map(item => item.id), ["child-protection-article"]);
  } finally {
    global.fetch = previousFetch;
  }
});

test("source anchored retrieval queries follow planner eval fixture contracts", () => {
  const cases = readPlannerCases().filter(item => item.expected?.first_query_kind);
  assert.equal(cases.length >= 6, true);

  for (const item of cases) {
    const baseQuery = buildRagSearchQuery(item.message, item.history || []);
    const queries = buildSourceAnchoredRagQueries(item.message, item.history || [], baseQuery);

    assert.equal(queries.length >= 1, true, item.id);
    assertQueryKind(queries[0], item.expected.first_query_kind, item.id);

    if (item.expected.first_query_filters) {
      assert.deepEqual(queries[0]?.filters, item.expected.first_query_filters, item.id);
    }
    if (item.expected.second_query_filters) {
      assert.deepEqual(queries[1]?.filters, item.expected.second_query_filters, item.id);
    }
    for (const needle of item.expected.first_query_contains || []) {
      assert.match(queryText(queries[0]), new RegExp(needle, "i"), `${item.id}: first query should contain ${needle}`);
    }
  }
});
