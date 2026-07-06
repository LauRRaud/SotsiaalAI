#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const DEFAULT_QUERIES = [
  "Võimaluste kohvik",
  "Kanep - mis on mis?",
  "Sotsiaalhoolekande seadus koduteenus",
  "hooldajatoetuse taotlusvorm",
  "toimetulekutoetus tähtaeg"
];

function usage() {
  console.log(`
Usage:
  node scripts/test-rag-hybrid-search.mjs [--query <text>] [--top-k <n>] [--base-url <url>] [--env <file>]

Examples:
  npm run rag:hybrid:test
  node scripts/test-rag-hybrid-search.mjs --query "Võimaluste kohvik" --top-k 8
  node scripts/test-rag-hybrid-search.mjs --env rag-service/rag.env
`.trim());
}

function parseEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  const out = {};
  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line || line.startsWith("#")) continue;
    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eq = normalized.indexOf("=");
    if (eq <= 0) continue;
    const key = normalized.slice(0, eq).trim();
    let value = normalized.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

function loadEnv(explicitEnvFile = "") {
  const candidates = [
    explicitEnvFile,
    ".env.production",
    ".env.local",
    ".env",
    "rag.env",
    "rag-service/rag.env",
    "/etc/sotsiaalai/rag.env"
  ].filter(Boolean);

  const merged = {};
  const used = [];
  for (const candidate of candidates) {
    const fullPath = path.isAbsolute(candidate) ? candidate : path.resolve(rootDir, candidate);
    if (!fs.existsSync(fullPath)) continue;
    Object.assign(merged, parseEnvFile(fullPath));
    used.push(fullPath);
  }
  return {
    env: {
      ...merged,
      ...process.env
    },
    used
  };
}

function normalizeBaseUrl(value = "") {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "http://127.0.0.1:8000";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

function parseArgs(argv) {
  const queries = [];
  let topK = 8;
  let baseUrl = "";
  let envFile = "";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || "");
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--query" || arg === "-q") {
      const parts = [];
      let nextIndex = index + 1;
      while (nextIndex < argv.length && !String(argv[nextIndex] || "").startsWith("-")) {
        parts.push(String(argv[nextIndex] || ""));
        nextIndex += 1;
      }
      const value = parts.join(" ").trim();
      if (value) queries.push(value);
      index = nextIndex - 1;
      continue;
    }
    if (arg.startsWith("--query=")) {
      const value = arg.slice("--query=".length).trim();
      if (value) queries.push(value);
      continue;
    }
    if (arg === "--top-k") {
      const value = Number(argv[index + 1]);
      if (Number.isFinite(value) && value > 0) topK = Math.min(50, Math.floor(value));
      index += 1;
      continue;
    }
    if (arg.startsWith("--top-k=")) {
      const value = Number(arg.slice("--top-k=".length));
      if (Number.isFinite(value) && value > 0) topK = Math.min(50, Math.floor(value));
      continue;
    }
    if (arg === "--base-url") {
      baseUrl = String(argv[index + 1] || "").trim();
      index += 1;
      continue;
    }
    if (arg === "--env") {
      envFile = String(argv[index + 1] || "").trim();
      index += 1;
      continue;
    }
    if (arg.trim()) queries.push(arg.trim());
  }

  return {
    queries: queries.length ? queries : DEFAULT_QUERIES,
    topK,
    baseUrl,
    envFile
  };
}

function compactResult(result) {
  return {
    title: result?.title || null,
    retrieval_channels: Array.isArray(result?.retrieval_channels)
      ? result.retrieval_channels
      : Array.isArray(result?.retrievalChannels)
        ? result.retrievalChannels
        : [],
    lexical_score: result?.lexical_score ?? null,
    lexical_score_normalized: result?.lexical_score_normalized ?? null,
    bm25_score: result?.bm25_score ?? null,
    bm25_coverage: result?.bm25_coverage ?? null,
    bm25_matches: result?.bm25_matches ?? null,
    bm25_query_tokens: result?.bm25_query_tokens ?? null,
    rrf_score: result?.rrf_score ?? null,
    hybrid_score: result?.hybrid_score ?? result?.hybridScore ?? null,
    channel_boost: result?.channel_boost ?? null,
    hybrid_rank: result?.hybrid_rank ?? result?.hybridRank ?? null,
    dense_rank: result?.dense_rank ?? null,
    lexical_rank: result?.lexical_rank ?? null,
    retrieval_scores: result?.retrieval_scores || null,
    distance: result?.distance ?? null,
    source_type: result?.source_type || null,
    source_id: result?.source_id || result?.sourceId || null,
    municipality: result?.municipality_name || result?.municipality || null
  };
}

async function searchOne({ baseUrl, apiKey, query, topK }) {
  const response = await fetch(`${baseUrl}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-API-Key": apiKey } : {})
    },
    body: JSON.stringify({
      query,
      top_k: topK,
      retrievers: ["dense", "title_match", "exact_phrase", "bm25"]
    })
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.detail || data?.message || `HTTP ${response.status}`);
  }
  return data || {};
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { env, used } = loadEnv(args.envFile);
  const baseUrl = normalizeBaseUrl(args.baseUrl || env.RAG_API_BASE || env.RAG_INTERNAL_HOST);
  const apiKey = String(env.RAG_SERVICE_API_KEY || "").trim();

  console.log(`[rag:hybrid:test] base=${baseUrl}`);
  if (used.length) {
    console.log(`[rag:hybrid:test] env=${used.map((item) => path.relative(rootDir, item) || item).join(", ")}`);
  }
  if (!apiKey) {
    console.log("[rag:hybrid:test] warning: no RAG API key found; request will be unauthenticated");
  }

  let failures = 0;
  for (const query of args.queries) {
    try {
      const data = await searchOne({
        baseUrl,
        apiKey,
        query,
        topK: args.topK
      });
      const top = Array.isArray(data.results) ? data.results.slice(0, 5).map(compactResult) : [];
      const summary = {
        query,
        retrievers_used: data.retrievers_used || [],
        search_strategy: data.search_strategy || null,
        merge_strategy: data.merge_strategy || null,
        channel_stats: data.channel_stats || null,
        result_count: Array.isArray(data.results) ? data.results.length : 0,
        top
      };
      console.log(JSON.stringify(summary, null, 2));
    } catch (error) {
      failures += 1;
      console.error(JSON.stringify({
        query,
        ok: false,
        error: error?.message || String(error)
      }, null, 2));
    }
  }

  if (failures) {
    console.error(`[rag:hybrid:test] FAILED queries=${failures}`);
    process.exit(1);
  }
  console.log("[rag:hybrid:test] OK");
}

main().catch((error) => {
  console.error("[rag:hybrid:test] Failed:", error?.message || String(error));
  process.exit(1);
});
