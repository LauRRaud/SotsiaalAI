#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { evaluateGoldenCase, summarizeResults } from "../run-golden-eval.mjs";

const EXPECTED = Object.freeze({
  model: "gpt-5.4-mini",
  reasoning_effort: "low",
  verbosity: "medium",
  max_output_tokens: 1100,
  prompt_token_audit: "0",
  retrieval_timeout_ms: 12000
});

const PRICE_SNAPSHOT_USD_PER_MILLION = Object.freeze({
  input: 0.75,
  cached_input: 0.075,
  output: 4.5,
  source: "docs/sotsiaalai-rag-projekt.md"
});

const TECHNICAL_RETRY_STATUSES = new Set([
  "technical_failure",
  "retrieval_failure",
  "stream_failure"
]);

function parseArgs(argv = []) {
  const args = {
    mode: "dry-run",
    baseUrl: process.env.SOTSIAALAI_SMOKE_BASE_URL || "https://sotsiaal.ai",
    evalPath: "eval/golden-rag-v1.json",
    rubricPath: "docs/internal/golden-37-mini-evaluation-form.md",
    runnerPath: "scripts/run-golden-eval.mjs",
    outputDir: "docs/internal/golden-37-mini-baseline",
    prismaClientPath: process.env.GOLDEN_PRISMA_CLIENT_PATH || "generated/prisma/client.ts",
    delayMs: 2000,
    caseIds: []
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--mode") args.mode = argv[++index] || args.mode;
    else if (arg === "--base-url") args.baseUrl = argv[++index] || args.baseUrl;
    else if (arg === "--eval-file") args.evalPath = argv[++index] || args.evalPath;
    else if (arg === "--rubric-file") args.rubricPath = argv[++index] || args.rubricPath;
    else if (arg === "--runner-file") args.runnerPath = argv[++index] || args.runnerPath;
    else if (arg === "--output-dir") args.outputDir = argv[++index] || args.outputDir;
    else if (arg === "--prisma-client") args.prismaClientPath = argv[++index] || args.prismaClientPath;
    else if (arg === "--delay-ms") args.delayMs = Number(argv[++index]);
    else if (arg === "--case") args.caseIds.push(argv[++index] || "");
    else throw new Error(`UNKNOWN_OPTION:${arg}`);
  }
  if (!["dry-run", "preflight", "smoke", "full", "reconcile-smoke"].includes(args.mode)) {
    throw new Error("INVALID_MODE");
  }
  if (!Number.isFinite(args.delayMs) || args.delayMs < 1000 || args.delayMs > 5000) {
    throw new Error("INVALID_DELAY_MS");
  }
  return args;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function fileHash(filePath) {
  return sha256(await readFile(filePath));
}

function cookieHeader(raw) {
  const value = String(raw || "").trim();
  if (!value) throw new Error("SESSION_COOKIE_MISSING");
  return value.includes("=") ? value : `__Secure-next-auth.session-token=${value}`;
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nullableString(value, limit = 200) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, limit) : null;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function runId() {
  return `G${randomBytes(8).toString("hex")}`;
}

function normalizeText(value) {
  return String(value || "")
    .toLocaleLowerCase("et")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function uniqueSourceCount(sources = []) {
  const keys = new Set();
  for (const source of sources) {
    const key = source?.id || source?.source_id || source?.url || source?.url_canonical
      || `${source?.title || source?.name || ""}|${source?.pageRange || source?.page_range || ""}`;
    if (String(key || "").trim()) keys.add(String(key));
  }
  return keys.size;
}

function controlledSources(sources = []) {
  return sources.map(source => ({
    title: nullableString(source?.title || source?.name, 500),
    url: nullableString(source?.url || source?.url_canonical || source?.urlCanonical, 1000),
    page_range: nullableString(source?.pageRange || source?.page_range, 100)
  }));
}

function estimateCost(usage) {
  const input = finite(usage?.input_tokens);
  const cached = finite(usage?.cached_tokens);
  const output = finite(usage?.output_tokens);
  if (input === null || output === null) return null;
  const safeCached = cached === null ? 0 : Math.min(input, Math.max(0, cached));
  const uncached = Math.max(0, input - safeCached);
  return Number((
    uncached * PRICE_SNAPSHOT_USD_PER_MILLION.input / 1_000_000
    + safeCached * PRICE_SNAPSHOT_USD_PER_MILLION.cached_input / 1_000_000
    + output * PRICE_SNAPSHOT_USD_PER_MILLION.output / 1_000_000
  ).toFixed(8));
}

function expectedConfiguration() {
  return {
    model: process.env.OPENAI_MODEL || "",
    reasoning_effort: process.env.OPENAI_REASONING_EFFORT || "low",
    verbosity: process.env.OPENAI_TEXT_VERBOSITY || "medium",
    max_output_tokens: finite(process.env.OPENAI_MAX_OUTPUT_TOKENS_WORKER),
    prompt_token_audit: process.env.CHAT_PROMPT_TOKEN_AUDIT || "0",
    retrieval_timeout_ms: 12000
  };
}

function assertProductionConfiguration() {
  const actual = expectedConfiguration();
  for (const [key, expected] of Object.entries(EXPECTED)) {
    if (actual[key] !== expected) {
      throw new Error(`CONFIG_MISMATCH:${key}`);
    }
  }
  return actual;
}

async function createPrisma(clientPath) {
  const clientModule = await import(pathToFileURL(path.resolve(clientPath)).href);
  const adapterModule = await import("@prisma/adapter-pg");
  return new clientModule.PrismaClient({
    adapter: new adapterModule.PrismaPg({ connectionString: process.env.DATABASE_URL })
  });
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(180_000)
  });
  const raw = await response.text();
  let body = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {}
  return { response, raw, body };
}

async function validateSession(baseUrl, cookie) {
  const { response, body } = await requestJson(`${baseUrl.replace(/\/+$/u, "")}/api/auth/session`, {
    headers: { Cookie: cookie }
  });
  const email = String(body?.user?.email || "").toLowerCase();
  const result = {
    http_status: response.status,
    user_present: Boolean(body?.user),
    synthetic_domain: email.endsWith("@sotsiaalai.test"),
    role: nullableString(body?.user?.role, 50),
    subscription_active: body?.subActive === true,
    real_person_data_present: null
  };
  if (
    response.status !== 200
    || !result.user_present
    || !result.synthetic_domain
    || result.role !== "SOCIAL_WORKER"
    || !result.subscription_active
  ) throw new Error("SYNTHETIC_SESSION_INVALID");
  return { result, userId: String(body.user.id || "") };
}

async function validateSyntheticIdentity(db, userId) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      role: true,
      profile: { select: { firstName: true, lastName: true, phone: true } }
    }
  });
  const syntheticDomain = String(user?.email || "").toLowerCase().endsWith("@sotsiaalai.test");
  const syntheticLabel = /(?:test|b0|idle|golden|synt)/iu;
  const names = [user?.profile?.firstName, user?.profile?.lastName]
    .map(value => String(value || "").trim())
    .filter(Boolean);
  const phonePresent = Boolean(String(user?.profile?.phone || "").trim());
  const realPersonDataPresent = phonePresent || names.some(value => !syntheticLabel.test(value));
  if (!user || !syntheticDomain || user.role !== "SOCIAL_WORKER" || realPersonDataPresent) {
    throw new Error([
      "SYNTHETIC_IDENTITY_PRIVACY_GATE_FAILED",
      `user=${Boolean(user)}`,
      `domain=${syntheticDomain}`,
      `role=${user?.role === "SOCIAL_WORKER"}`,
      `profile=${Boolean(user?.profile)}`,
      `names_synthetic=${names.every(value => syntheticLabel.test(value))}`,
      `phone=${phonePresent}`
    ].join(":"));
  }
  return {
    synthetic_domain: true,
    role: user.role,
    profile_present: Boolean(user.profile),
    profile_fields_synthetic_or_blank: true,
    real_person_data_present: false
  };
}

async function readEvents(db, userId, startedAt, completedAt) {
  await delay(700);
  return db.chatLog.findMany({
    where: {
      userId,
      event: {
        in: ["openai_usage", "rag_search", "rag_trace", "chat_no_external_sources", "crisis_detected"]
      },
      createdAt: {
        gte: new Date(startedAt - 1000),
        lte: new Date(completedAt + 10_000)
      }
    },
    orderBy: { createdAt: "asc" },
    select: { event: true, createdAt: true, data: true }
  });
}

function parseJournalLine(line) {
  const marker = "rag.search.stage ";
  const index = line.indexOf(marker);
  if (index < 0) return null;
  try {
    return JSON.parse(line.slice(index + marker.length).trim());
  } catch {
    return null;
  }
}

function journalSummary(timing, startedAt, completedAt) {
  const requestId = nullableString(timing?.request_id);
  const observabilityStage = nullableString(timing?.observabilityStage || timing?.observability_stage);
  if (!requestId) {
    return { journal_stage_count: 0, journal_duplicate_count: 0, timings_match_journal: null };
  }
  let requestRows = [];
  try {
    const output = execFileSync("journalctl", [
      "-u", "sotsiaalai-rag.service",
      "--since", new Date(startedAt - 1000).toISOString(),
      "--until", new Date(completedAt + 10_000).toISOString(),
      "--no-pager", "-o", "cat"
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 8 * 1024 * 1024 });
    requestRows = output.split(/\r?\n/u).map(parseJournalLine)
      .filter(row => row?.request_id === requestId);
  } catch {
    return { journal_stage_count: null, journal_duplicate_count: null, timings_match_journal: null };
  }
  const byStage = new Map();
  const rows = requestRows.filter(row => row?.upstream_stage === observabilityStage);
  for (const row of rows) {
    const stage = String(row.stage || "");
    if (!byStage.has(stage)) byStage.set(stage, []);
    byStage.get(stage).push(row);
  }
  const duplicates = [...byStage.values()].reduce((sum, list) => sum + Math.max(0, list.length - 1), 0);
  const stages = ["embedding", "retrieval", "search_total"];
  const serviceValues = [
    finite(timing?.embedding_duration_ms),
    finite(timing?.retriever_duration_ms),
    finite(timing?.retrieval_total_ms)
  ];
  const journalValues = stages.map(stage => finite(byStage.get(stage)?.[0]?.duration_ms));
  const upstream = new Set(rows.map(row => row?.upstream_stage).filter(Boolean));
  const componentsMatch = rows.length === 3 && duplicates === 0 && byStage.size === 3
    && stages.every(stage => byStage.has(stage))
    && upstream.size === 1 && upstream.has(observabilityStage)
    && serviceValues.slice(0, 2).every((value, index) => value !== null && journalValues[index] !== null
      && Math.abs(value - journalValues[index]) <= 2);
  const match = componentsMatch
    && serviceValues[2] !== null && journalValues[2] !== null
    && Math.abs(serviceValues[2] - journalValues[2]) <= 2;
  return {
    journal_embedding_ms: journalValues[0],
    journal_retrieval_ms: journalValues[1],
    journal_total_ms: journalValues[2],
    journal_total_delta_ms: serviceValues[2] !== null && journalValues[2] !== null
      ? journalValues[2] - serviceValues[2]
      : null,
    journal_stage_count: rows.length,
    journal_duplicate_count: duplicates,
    component_timings_match_journal: componentsMatch,
    timings_match_journal: match
  };
}

async function reconcileSmokeArtifact(args) {
  const artifactPath = path.join(args.outputDir, "smoke-technical-runs.json");
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  for (const run of artifact.runs || []) {
    const startedAt = Date.parse(run.started_at);
    const completedAt = Date.parse(run.completed_at);
    run.retrieval_timings = (run.retrieval_timings || []).map(timing => ({
      ...timing,
      ...journalSummary(timing, startedAt, completedAt)
    }));
  }
  artifact.reconciled_at = new Date().toISOString();
  artifact.reconciliation = "request_id_plus_upstream_stage";
  await writeFile(artifactPath, JSON.stringify(artifact, null, 2) + "\n", "utf8");
  return artifact;
}

function retrievalSummary(events, startedAt, completedAt) {
  const ragEvents = events.filter(event => event.event === "rag_search");
  const timings = ragEvents.flatMap(event => Array.isArray(event.data?.retrievalTimings)
    ? event.data.retrievalTimings
    : []);
  return timings.map((timing, index) => ({
    rag_call_index: index,
    request_id: nullableString(timing?.request_id),
    observability_stage: nullableString(timing?.observabilityStage),
    time_since_previous_rag_request_ms: finite(timing?.time_since_previous_rag_request_ms),
    embedding_duration_ms: finite(timing?.embedding_duration_ms),
    retriever_duration_ms: finite(timing?.retriever_duration_ms),
    retrieval_total_ms: finite(timing?.retrieval_total_ms),
    retrieval_timeout_ms: finite(timing?.retrieval_timeout_ms),
    aborted_stage: nullableString(timing?.aborted_stage),
    http_status: finite(timing?.http_status),
    outcome: nullableString(timing?.outcome),
    ...journalSummary(timing, startedAt, completedAt)
  }));
}

function classify({ httpStatus, body, usage, retrievalTimings, parseError }) {
  if (parseError) return { status: "technical_failure", technical_error_category: "invalid_json" };
  if (httpStatus !== 200) {
    const marker = normalizeText(`${body?.code || ""} ${body?.error || ""}`);
    if (marker.includes("retriev") || marker.includes("rag")) {
      return { status: "retrieval_failure", technical_error_category: "http_retrieval_failure" };
    }
    return { status: "technical_failure", technical_error_category: `http_${httpStatus}` };
  }
  if (retrievalTimings.some(timing => timing.outcome && timing.outcome !== "ok")) {
    return { status: "retrieval_failure", technical_error_category: "retrieval_timing_failure" };
  }
  if (!usage) return { status: "technical_failure", technical_error_category: "missing_openai_usage" };
  if (usage.response_present === false) {
    return { status: "technical_failure", technical_error_category: "response_present_false" };
  }
  if (usage.status === "incomplete") return { status: "incomplete", technical_error_category: null };
  if (usage.status !== "completed") {
    return { status: "technical_failure", technical_error_category: "provider_status_unknown" };
  }
  return { status: "completed", technical_error_category: null };
}

async function runOne({ args, testCase, runType, questionSetHash, cookie, db, userId }) {
  const id = runId();
  const startedAt = Date.now();
  let httpStatus = null;
  let body = null;
  let raw = "";
  let fetchError = null;
  try {
    const response = await requestJson(`${args.baseUrl.replace(/\/+$/u, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
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
    httpStatus = response.response.status;
    body = response.body;
    raw = response.raw;
  } catch (error) {
    fetchError = String(error?.name || error?.message || "fetch_error").slice(0, 100);
  }
  const completedAt = Date.now();
  const events = await readEvents(db, userId, startedAt, completedAt);
  const usageEvent = events.filter(event => event.event === "openai_usage").at(-1) || null;
  const usage = usageEvent?.data || null;
  const timings = retrievalSummary(events, startedAt, completedAt);
  const displayedSources = Array.isArray(body?.displayed_sources)
    ? body.displayed_sources
    : Array.isArray(body?.sources) ? body.sources : [];
  const sources = Array.isArray(body?.sources) ? body.sources : [];
  const parsed = body && typeof body === "object";
  const classification = fetchError
    ? { status: "technical_failure", technical_error_category: fetchError }
    : classify({ httpStatus, body, usage, retrievalTimings: timings, parseError: httpStatus === 200 && !parsed });
  const automatic = parsed && httpStatus === 200
    ? evaluateGoldenCase(testCase, body)
    : { id: testCase.id, family: testCase.family, ok: false, checks: [] };
  const ragEvent = events.find(event => event.event === "rag_search") || null;
  const noExternalSources = events.some(event => event.event === "chat_no_external_sources");
  const technical = {
    run_id: id,
    question_id: testCase.id,
    question_set_hash: questionSetHash,
    run_type: runType,
    conversation_mode: (testCase.history || []).length ? "fixed_multiturn_history" : "new_independent_conversation",
    role: testCase.role || "SOCIAL_WORKER",
    model: EXPECTED.model,
    reasoning_effort: EXPECTED.reasoning_effort,
    verbosity: EXPECTED.verbosity,
    max_output_tokens: EXPECTED.max_output_tokens,
    started_at: new Date(startedAt).toISOString(),
    completed_at: new Date(completedAt).toISOString(),
    latency_ms: completedAt - startedAt,
    status: classification.status,
    provider_status: nullableString(usage?.status),
    incomplete_reason: nullableString(usage?.incomplete_reason),
    response_present: usage?.response_present === true ? true : usage?.response_present === false ? false : null,
    input_tokens: finite(usage?.input_tokens),
    cached_tokens: finite(usage?.cached_tokens),
    output_tokens: finite(usage?.output_tokens),
    reasoning_tokens: finite(usage?.reasoning_tokens),
    non_reasoning_output_tokens:
      finite(usage?.output_tokens) !== null && finite(usage?.reasoning_tokens) !== null
        ? finite(usage.output_tokens) - finite(usage.reasoning_tokens)
        : null,
    total_tokens: finite(usage?.total_tokens),
    output_cap_reached: typeof usage?.output_cap_reached === "boolean" ? usage.output_cap_reached : null,
    estimated_request_cost_usd: estimateCost(usage),
    rag_needed: Boolean(ragEvent) && !noExternalSources,
    rag_attempted: timings.length > 0,
    rag_failed: timings.some(timing => timing.outcome && timing.outcome !== "ok"),
    source_count: sources.length,
    displayed_source_count: displayedSources.length,
    displayed_unique_source_count: uniqueSourceCount(displayedSources),
    stream_done_received: null,
    technical_error_category: classification.technical_error_category,
    automatic_golden_pass: automatic.ok,
    automatic_checks: automatic.checks,
    retrieval_timings: timings
  };
  const blind = {
    run_id: id,
    question_id: testCase.id,
    response_text: typeof body?.reply === "string" ? body.reply : "",
    displayed_sources: controlledSources(displayedSources)
  };
  const key = {
    run_id: id,
    question_id: testCase.id,
    model: EXPECTED.model,
    reasoning_effort: EXPECTED.reasoning_effort,
    verbosity: EXPECTED.verbosity,
    max_output_tokens: EXPECTED.max_output_tokens,
    run_type: runType
  };
  if (raw.includes("__Secure-next-auth.session-token") || JSON.stringify({ technical, blind, key }).includes("@sotsiaalai.test")) {
    throw new Error("PRIVACY_GATE_FAILED");
  }
  return { technical, blind, key, automatic };
}

function ragConnection() {
  const apiKey = process.env.RAG_SERVICE_API_KEY || process.env.RAG_API_KEY || "";
  if (!apiKey) throw new Error("RAG_API_KEY_MISSING");
  const rawBase = process.env.RAG_INTERNAL_HOST || process.env.RAG_API_BASE || "http://127.0.0.1:8000";
  const base = /^https?:\/\//u.test(rawBase) ? rawBase : `http://${rawBase}`;
  return { apiKey, base: base.replace(/\/+$/u, "") };
}

async function fetchDocumentTitles() {
  const { apiKey, base } = ragConnection();
  const documents = [];
  for (let offset = 0; ; offset += 100) {
    const response = await fetch(`${base}/documents?limit=100&offset=${offset}`, {
      headers: { "X-API-Key": apiKey },
      signal: AbortSignal.timeout(30_000)
    });
    if (!response.ok) throw new Error(`DOCUMENT_INVENTORY_HTTP_${response.status}`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error("DOCUMENT_INVENTORY_INVALID");
    documents.push(...page);
    if (page.length < 100) break;
  }
  return documents.map(doc => String(doc.title || doc.fileName || "")).filter(Boolean);
}

async function verifyExplicitAnchor(anchor, normalizedTitles) {
  const paragraph = String(anchor || "").match(/§\s*(\d+)/u)?.[1] || null;
  if (!paragraph) {
    return {
      anchor,
      method: "document_title_contains",
      matching_corpus_item_count: normalizedTitles.filter(title => title.includes(normalizeText(anchor))).length
    };
  }
  const { apiKey, base } = ragConnection();
  const response = await fetch(`${base}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({
      query: `Sotsiaalhoolekande seadus § ${paragraph}`,
      top_k: 20,
      retrievers: ["dense", "title_match", "exact_phrase", "bm25"],
      where: {
        source_type: "national_law",
        collection_id: "national_regulations",
        paragraph_number: paragraph
      }
    }),
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`LEGAL_ANCHOR_SEARCH_HTTP_${response.status}`);
  const body = await response.json();
  const results = Array.isArray(body?.results) ? body.results : [];
  const matching = results.filter(result => String(
    result?.paragraph_number || result?.metadata?.paragraph_number || ""
  ) === paragraph);
  return {
    anchor,
    method: "exact_legal_paragraph_search",
    matching_corpus_item_count: matching.length
  };
}

function explicitAnchors(testCase) {
  const value = testCase.expect?.displayed_must_include;
  return Array.isArray(value) ? value : value ? [value] : [];
}

async function preflight(args, evalSet, hashes, sessionResult) {
  const titles = await fetchDocumentTitles();
  const normalizedTitles = titles.map(normalizeText);
  const cases = [];
  for (const testCase of evalSet.cases) {
    const anchors = explicitAnchors(testCase);
    const anchorMatches = [];
    for (const anchor of anchors) {
      anchorMatches.push(await verifyExplicitAnchor(anchor, normalizedTitles));
    }
    const intentionallyNoCorpus = testCase.id === "edge_no_corpus_answer_v2";
    cases.push({
      question_id: testCase.id,
      role: testCase.role || "SOCIAL_WORKER",
      history_turns: Array.isArray(testCase.history) ? testCase.history.length : 0,
      explicit_anchor_check: anchors.length ? anchorMatches : null,
      missing_explicit_anchor: anchorMatches.some(match => match.matching_corpus_item_count === 0),
      corpus_expectation: intentionallyNoCorpus ? "intentional_no_corpus_answer" : "corpus_anchored"
    });
  }
  const output = {
    schema: "golden-37-mini-preflight-v1",
    generated_at: new Date().toISOString(),
    question_set: {
      path: args.evalPath,
      sha256: hashes.question_set,
      case_count: evalSet.cases.length,
      ids: evalSet.cases.map(testCase => testCase.id),
      fixed_multiturn_cases: cases.filter(item => item.history_turns > 0).map(item => item.question_id)
    },
    rubric: { path: args.rubricPath, sha256: hashes.rubric },
    runner: { path: args.runnerPath, sha256: hashes.runner },
    production_configuration: expectedConfiguration(),
    synthetic_session: sessionResult,
    corpus_inventory: {
      document_count: titles.length,
      cases,
      missing_explicit_anchor_case_ids: cases.filter(item => item.missing_explicit_anchor).map(item => item.question_id),
      intentional_no_corpus_case_ids: cases.filter(item => item.corpus_expectation === "intentional_no_corpus_answer").map(item => item.question_id)
    }
  };
  await mkdir(args.outputDir, { recursive: true });
  await writeFile(path.join(args.outputDir, "preflight.json"), JSON.stringify(output, null, 2) + "\n", "utf8");
  if (output.corpus_inventory.missing_explicit_anchor_case_ids.length) {
    throw new Error("CORPUS_EXPLICIT_ANCHOR_MISSING");
  }
  return output;
}

async function writeRunArtifacts(args, mode, questionSetHash, records) {
  await mkdir(args.outputDir, { recursive: true });
  const technical = {
    schema: "golden-37-mini-technical-runs-v1",
    mode,
    generated_at: new Date().toISOString(),
    question_set_hash: questionSetHash,
    pricing_snapshot_usd_per_million_tokens: PRICE_SNAPSHOT_USD_PER_MILLION,
    runs: records.map(record => record.technical)
  };
  const blind = {
    schema: "golden-37-blind-evaluation-packet-v1",
    generated_at: new Date().toISOString(),
    evaluator_instructions: "Hinda kaasasoleva fikseeritud vormi järgi. Mudelit ja seadistust selles failis ei avaldata.",
    responses: records.map(record => record.blind)
  };
  const key = {
    schema: "golden-37-blind-key-v1",
    generated_at: new Date().toISOString(),
    entries: records.map(record => record.key)
  };
  const automaticResults = records.map(record => record.automatic);
  const automatic = {
    schema: "golden-37-automatic-results-v1",
    generated_at: new Date().toISOString(),
    summary: summarizeResults(automaticResults),
    results: automaticResults
  };
  await Promise.all([
    writeFile(path.join(args.outputDir, `${mode}-technical-runs.json`), JSON.stringify(technical, null, 2) + "\n", "utf8"),
    writeFile(path.join(args.outputDir, `${mode}-blind-packet.json`), JSON.stringify(blind, null, 2) + "\n", "utf8"),
    writeFile(path.join(args.outputDir, `${mode}-blind-key.json`), JSON.stringify(key, null, 2) + "\n", "utf8"),
    writeFile(path.join(args.outputDir, `${mode}-automatic-results.json`), JSON.stringify(automatic, null, 2) + "\n", "utf8")
  ]);
  return { technical, automatic };
}

async function runSelected(args, evalSet, questionSetHash, cookie, db, userId) {
  let cases = evalSet.cases;
  if (args.mode === "smoke") {
    const ids = args.caseIds.length ? args.caseIds : ["legal_shs_17", "ajakiri_overview_lastekaitse"];
    cases = cases.filter(testCase => ids.includes(testCase.id));
    cases.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  } else if (args.caseIds.length) {
    cases = cases.filter(testCase => args.caseIds.includes(testCase.id));
  }
  if (!cases.length) throw new Error("NO_MATCHING_CASES");
  const records = [];
  for (const testCase of cases) {
    process.stderr.write(`[mini-baseline] ${testCase.id} original ...\n`);
    const original = await runOne({
      args, testCase, runType: "original", questionSetHash, cookie, db, userId
    });
    records.push(original);
    process.stderr.write(`[mini-baseline] ${testCase.id} -> ${original.technical.status}\n`);
    if (TECHNICAL_RETRY_STATUSES.has(original.technical.status)) {
      await delay(args.delayMs);
      process.stderr.write(`[mini-baseline] ${testCase.id} technical_retry ...\n`);
      const retry = await runOne({
        args, testCase, runType: "technical_retry", questionSetHash, cookie, db, userId
      });
      records.push(retry);
      process.stderr.write(`[mini-baseline] ${testCase.id} retry -> ${retry.technical.status}\n`);
    }
    await writeRunArtifacts(args, args.mode, questionSetHash, records);
    if (testCase !== cases.at(-1)) await delay(args.delayMs);
  }
  return writeRunArtifacts(args, args.mode, questionSetHash, records);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [evalRaw, questionSetHash, rubricHash, runnerHash] = await Promise.all([
    readFile(args.evalPath, "utf8"),
    fileHash(args.evalPath),
    fileHash(args.rubricPath),
    fileHash(args.runnerPath)
  ]);
  const evalSet = JSON.parse(evalRaw);
  if (!Array.isArray(evalSet.cases) || evalSet.cases.length !== 37) throw new Error("QUESTION_SET_NOT_GOLDEN_37");
  if (new Set(evalSet.cases.map(testCase => testCase.id)).size !== 37) throw new Error("QUESTION_IDS_NOT_UNIQUE");
  if (args.mode === "dry-run") {
    console.log(JSON.stringify({
      event: "golden_37_mini_dry_run",
      question_count: evalSet.cases.length,
      question_set_sha256: questionSetHash,
      rubric_sha256: rubricHash,
      runner_sha256: runnerHash,
      smoke_case_ids: ["legal_shs_17", "ajakiri_overview_lastekaitse"],
      runtime_calls: false
    }));
    return;
  }
  if (args.mode === "reconcile-smoke") {
    const artifact = await reconcileSmokeArtifact(args);
    console.log(JSON.stringify({
      event: "golden_37_mini_smoke_reconciled",
      run_count: artifact.runs?.length || 0,
      mismatches: (artifact.runs || []).flatMap(run => run.retrieval_timings || [])
        .filter(timing => timing.timings_match_journal !== true).length,
      runtime_calls: false
    }));
    return;
  }
  const configuration = assertProductionConfiguration();
  const cookie = cookieHeader(process.env.SOTSIAALAI_SMOKE_COOKIE);
  const db = await createPrisma(args.prismaClientPath);
  try {
    const session = await validateSession(args.baseUrl, cookie);
    const identity = await validateSyntheticIdentity(db, session.userId);
    const hashes = { question_set: questionSetHash, rubric: rubricHash, runner: runnerHash };
    const preflightOutput = await preflight(args, evalSet, hashes, { ...session.result, ...identity });
    if (args.mode === "preflight") {
      console.log(JSON.stringify({
        event: "golden_37_mini_preflight",
        question_count: evalSet.cases.length,
        question_set_sha256: questionSetHash,
        missing_explicit_anchor_case_ids: preflightOutput.corpus_inventory.missing_explicit_anchor_case_ids,
        intentional_no_corpus_case_ids: preflightOutput.corpus_inventory.intentional_no_corpus_case_ids,
        session_ok: true,
        configuration
      }));
      return;
    }
    const output = await runSelected(args, evalSet, questionSetHash, cookie, db, session.userId);
    console.log(JSON.stringify({
      event: `golden_37_mini_${args.mode}`,
      run_count: output.technical.runs.length,
      statuses: Object.fromEntries([...new Set(output.technical.runs.map(run => run.status))]
        .map(status => [status, output.technical.runs.filter(run => run.status === status).length])),
      automatic_summary: output.automatic.summary,
      session_ok: true,
      configuration
    }));
  } finally {
    await db.$disconnect().catch(() => {});
  }
}

main().catch(error => {
  console.error(JSON.stringify({
    event: "golden_37_mini_failed",
    error_code: String(error?.message || error).slice(0, 200)
  }));
  process.exitCode = 1;
});
