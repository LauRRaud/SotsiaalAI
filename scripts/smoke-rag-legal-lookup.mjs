#!/usr/bin/env node

import { buildSourceLookupSearchQuery } from "../lib/chat/retrievalOrchestrator.js";
import { buildSourceLookupRagQueries } from "../lib/chat/queryPlanner.js";

const RAW_RAG_HOST = String(process.env.RAG_INTERNAL_HOST || process.env.RAG_API_BASE || "127.0.0.1:8000").trim();
const RAG_KEY = String(process.env.RAG_SERVICE_API_KEY || "").trim();

const shsToimetulekutoetusSectionsQuestion =
  "Millised Sotsiaalhoolekande seaduse paragrahvid reguleerivad toimetulekutoetust?";

const CASES = [
  {
    id: "shs_toimetulekutoetus_sections",
    query: shsToimetulekutoetusSectionsQuestion,
    queries: buildSourceLookupRagQueries(
      buildSourceLookupSearchQuery(shsToimetulekutoetusSectionsQuestion, []),
      {
        sourceLookupTargetsNationalLaw: true,
        sourceLookupParagraphRefs: []
      }
    ),
    required: ["131", "132", "133", "134", "135"],
    forbiddenPrimary: ["2", "156"],
    requiredWindow: 32
  },
  {
    id: "shs_131_exact",
    query: "Sotsiaalhoolekande seadus § 131 toimetulekutoetus",
    required: ["131"],
    forbiddenPrimary: ["2", "156"],
    requiredWindow: 8
  },
  {
    id: "shs_132_exact",
    query: "SHS § 132 toimetulekutoetuse taotlemine",
    required: ["132"],
    forbiddenPrimary: ["2", "156"],
    requiredWindow: 8
  }
];

function normalizeBaseFromHost(host) {
  const trimmed = String(host || "").trim().replace(/\/+$/u, "");
  if (!trimmed) return "http://127.0.0.1:8000";
  if (/^https?:\/\//iu.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

function paragraphNumber(result = {}) {
  return String(result?.paragraph_number || result?.metadata?.paragraph_number || "").trim();
}

function title(result = {}) {
  return String(result?.title || result?.metadata?.title || "").trim();
}

function resultKey(result = {}) {
  return String(
    result.id ||
    result.chunk_id ||
    result.chunkId ||
    result.metadata?.chunk_id ||
    result.metadata?.canonical_chunk_id ||
    result.title ||
    result.metadata?.title ||
    ""
  ).trim();
}

async function search(queryOrQueries) {
  if (!RAG_KEY) throw new Error("RAG_SERVICE_API_KEY is required");
  const queries = (Array.isArray(queryOrQueries) ? queryOrQueries : [queryOrQueries])
    .map((entry) => String(typeof entry === "string" ? entry : entry?.query || "").trim())
    .filter(Boolean);
  const mergedResults = [];
  const seen = new Set();

  for (const query of queries) {
    const res = await fetch(`${normalizeBaseFromHost(RAW_RAG_HOST)}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": RAG_KEY
      },
      body: JSON.stringify({
        query,
        top_k: 24,
        retrievers: ["dense", "title_match", "exact_phrase", "bm25"],
        where: {
          jurisdiction_level: "NATIONAL"
        }
      })
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`RAG search failed (${res.status}): ${raw.slice(0, 500)}`);
    const data = raw ? JSON.parse(raw) : {};
    for (const result of Array.isArray(data.results) ? data.results : []) {
      const key = resultKey(result);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      mergedResults.push(result);
    }
  }

  return {
    results: mergedResults
  };
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  for (const item of CASES) {
    const data = await search(item.queries || item.query);
    const results = Array.isArray(data.results) ? data.results : [];
    const top = results.slice(0, 8);
    const requiredWindow = results.slice(0, item.requiredWindow || 8);
    const topParagraphs = top.map(paragraphNumber).filter(Boolean);
    const requiredWindowParagraphs = requiredWindow.map(paragraphNumber).filter(Boolean);
    const topTitles = top.map(title).filter(Boolean);
    const requiredSet = new Set(requiredWindowParagraphs);

    for (const required of item.required) {
      assertCondition(
        requiredSet.has(required),
        `${item.id}: expected § ${required} in top ${item.requiredWindow || 8}, got ${requiredWindowParagraphs.join(", ") || "(none)"}`
      );
    }

    const primary = topParagraphs[0] || "";
    assertCondition(
      !item.forbiddenPrimary.includes(primary),
      `${item.id}: forbidden primary § ${primary}; titles=${topTitles.slice(0, 3).join(" | ")}`
    );

    console.log(`[legal-smoke] ${item.id}: OK top=${topParagraphs.slice(0, 8).join(", ")}`);
  }
}

main().catch(error => {
  console.error(`[legal-smoke] ${error?.message || error}`);
  process.exit(1);
});
