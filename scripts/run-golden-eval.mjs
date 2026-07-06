#!/usr/bin/env node

import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

const DEFAULT_EVAL_PATH = "eval/golden-rag-v1.json";
const DEFAULT_BASE_URL = "http://127.0.0.1:3000";

function usage() {
  return [
    "Usage:",
    "  npm run rag:eval:golden -- --json reports/golden-eval-result.json",
    "  npm run rag:eval:golden -- --case kov_kuusalu_koduteenus",
    "  npm run rag:eval:golden -- --family ajakiri",
    "",
    "Environment:",
    "  SOTSIAALAI_SMOKE_BASE_URL=https://sotsiaal.ai",
    "  SOTSIAALAI_SMOKE_COOKIE=\"__Secure-next-auth.session-token=...\" (or bare token)",
    "",
    "Runs the golden eval question set against /api/chat (persist:false) and",
    "scores each case against its expectations. Substring checks are",
    "case- and diacritic-insensitive."
  ].join("\n");
}

function parseArgs(argv = []) {
  const args = {
    baseUrl: process.env.SOTSIAALAI_SMOKE_BASE_URL || process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
    cookie: process.env.SOTSIAALAI_SMOKE_COOKIE || process.env.SMOKE_COOKIE || "",
    evalPath: DEFAULT_EVAL_PATH,
    jsonPath: null,
    caseIds: [],
    families: [],
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--base-url") args.baseUrl = argv[++index] || args.baseUrl;
    else if (arg === "--cookie") args.cookie = argv[++index] || "";
    else if (arg === "--eval-file") args.evalPath = argv[++index] || args.evalPath;
    else if (arg === "--json") args.jsonPath = argv[++index] || null;
    else if (arg === "--case") args.caseIds.push(argv[++index] || "");
    else if (arg === "--family") args.families.push(argv[++index] || "");
    else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export function extractResponseFacts(body = {}) {
  const trace = body.rag_trace || {};
  const sources = Array.isArray(body.sources)
    ? body.sources
    : Array.isArray(body.displayed_sources)
      ? body.displayed_sources
      : [];
  return {
    mode: trace.query_plan?.mode || null,
    evidence_package: Boolean(trace.evidence_package),
    package_aware: Boolean(
      trace.source_packages?.package_aware_answering_used || trace.package_aware_answering_used
    ),
    crisis: Boolean(body.isCrisis ?? body.is_crisis),
    reply: String(body.reply || ""),
    displayed: sources.map(source => ({
      title: source.title || source.name || source.id || "",
      url: source.url || source.url_canonical || source.urlCanonical || null
    }))
  };
}

export function evaluateGoldenCase(testCase = {}, body = {}) {
  const expect = testCase.expect || {};
  const facts = extractResponseFacts(body);
  const checks = [];
  const displayedTitles = facts.displayed.map(source => normalizeText(source.title));
  const reply = normalizeText(facts.reply);

  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  if (expect.mode !== undefined) {
    const accepted = asArray(expect.mode);
    add("mode", accepted.includes(facts.mode), `expected ${accepted.join("|")}, got ${facts.mode}`);
  }
  if (expect.evidence_package !== undefined) {
    add("evidence_package", facts.evidence_package === expect.evidence_package,
      `expected ${expect.evidence_package}, got ${facts.evidence_package}`);
  }
  if (expect.package_aware !== undefined) {
    add("package_aware", facts.package_aware === expect.package_aware,
      `expected ${expect.package_aware}, got ${facts.package_aware}`);
  }
  if (expect.crisis !== undefined) {
    add("crisis", facts.crisis === expect.crisis, `expected ${expect.crisis}, got ${facts.crisis}`);
  }
  if (expect.displayed_min !== undefined) {
    add("displayed_min", facts.displayed.length >= expect.displayed_min,
      `expected >= ${expect.displayed_min}, got ${facts.displayed.length}`);
  }
  for (const needle of asArray(expect.displayed_must_include)) {
    const normalized = normalizeText(needle);
    add(`displayed_includes:${needle}`,
      displayedTitles.some(title => title.includes(normalized)),
      `titles: ${displayedTitles.join(" | ") || "(none)"}`);
  }
  for (const needle of asArray(expect.displayed_must_not_include)) {
    const normalized = normalizeText(needle);
    add(`displayed_excludes:${needle}`,
      !displayedTitles.some(title => title.includes(normalized)),
      `titles: ${displayedTitles.join(" | ") || "(none)"}`);
  }
  if (expect.displayed_url_required) {
    add("displayed_url_required", facts.displayed.some(source => Boolean(source.url)),
      `urls: ${facts.displayed.map(source => source.url || "-").join(" | ") || "(none)"}`);
  }
  for (const needle of asArray(expect.answer_must_include)) {
    add(`answer_includes:${needle}`, reply.includes(normalizeText(needle)), "reply checked");
  }
  if (asArray(expect.answer_must_include_any).length > 0) {
    const alternatives = asArray(expect.answer_must_include_any);
    add(`answer_includes_any:${alternatives.join("|")}`,
      alternatives.some(needle => reply.includes(normalizeText(needle))), "reply checked");
  }
  for (const needle of asArray(expect.answer_must_not_include)) {
    add(`answer_excludes:${needle}`, !reply.includes(normalizeText(needle)), "reply checked");
  }

  return {
    id: testCase.id,
    family: testCase.family || "unknown",
    ok: checks.every(check => check.ok),
    mode: facts.mode,
    displayed_count: facts.displayed.length,
    displayed_titles: facts.displayed.map(source => source.title),
    checks
  };
}

export function summarizeResults(results = []) {
  const byFamily = {};
  for (const result of results) {
    const family = result.family || "unknown";
    byFamily[family] = byFamily[family] || { pass: 0, fail: 0 };
    byFamily[family][result.ok ? "pass" : "fail"] += 1;
  }
  return {
    total: results.length,
    pass: results.filter(result => result.ok).length,
    fail: results.filter(result => !result.ok).length,
    by_family: byFamily,
    failed_case_ids: results.filter(result => !result.ok).map(result => result.id)
  };
}

function cookieHeader(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  return value.includes("=") ? value : `__Secure-next-auth.session-token=${value}`;
}

async function runCase(args, testCase) {
  const response = await fetch(`${args.baseUrl.replace(/\/+$/u, "")}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader(args.cookie)
    },
    body: JSON.stringify({
      message: testCase.question,
      history: testCase.history || [],
      role: testCase.role || "SOCIAL_WORKER",
      stream: false,
      persist: false,
      uiLocale: "et",
      chatMode: "rag",
      forceSources: testCase.forceSources ?? true,
      graphChannelTest: process.env.RAG_EVAL_GRAPH_TEST === "1"
    })
  });
  const raw = await response.text();
  if (!response.ok) {
    return { id: testCase.id, family: testCase.family, ok: false, http: response.status, error: raw.slice(0, 300), checks: [] };
  }
  return evaluateGoldenCase(testCase, JSON.parse(raw));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.cookie) throw new Error("SOTSIAALAI_SMOKE_COOKIE is required for /api/chat auth");

  const evalSet = JSON.parse(await fs.readFile(args.evalPath, "utf8"));
  let cases = evalSet.cases || [];
  if (args.caseIds.length > 0) cases = cases.filter(testCase => args.caseIds.includes(testCase.id));
  if (args.families.length > 0) cases = cases.filter(testCase => args.families.includes(testCase.family));
  if (cases.length === 0) throw new Error("No matching eval cases.");

  const results = [];
  for (const testCase of cases) {
    process.stderr.write(`[eval] ${testCase.id} ...\n`);
    try {
      const result = await runCase(args, testCase);
      results.push(result);
      process.stderr.write(`[eval] ${testCase.id} -> ${result.ok ? "PASS" : "FAIL"}\n`);
    } catch (error) {
      results.push({ id: testCase.id, family: testCase.family, ok: false, error: String(error?.message || error), checks: [] });
      process.stderr.write(`[eval] ${testCase.id} -> ERROR ${error?.message || error}\n`);
    }
  }

  const output = {
    ok: results.every(result => result.ok),
    eval_file: args.evalPath,
    base_url: args.baseUrl,
    generated_at: new Date().toISOString(),
    summary: summarizeResults(results),
    results
  };
  const serialized = JSON.stringify(output, null, 2);
  if (args.jsonPath) await fs.writeFile(args.jsonPath, serialized, "utf8");
  console.log(JSON.stringify({ ok: output.ok, summary: output.summary }, null, 2));
  if (!output.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(JSON.stringify({ ok: false, error: error?.message || String(error) }));
    process.exitCode = 1;
  });
}
