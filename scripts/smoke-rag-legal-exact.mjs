#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { summarizeRagTraceSourceQuality } from "../lib/rag/sourceQualityMetrics.js";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_RAG_SERVICE_URL = "http://127.0.0.1:8000";
const PARAGRAPH_SIGN = "\u00A7";
const LEGAL_SOURCE_TYPE_PATTERN = /^(national_law|law|kov_regulation|regulation|riigiteataja_regulation)$/;

export function usage() {
  return [
    "Usage:",
    "  npm run rag:smoke:legal-exact -- --all",
    "  npm run rag:smoke:legal-exact -- --rag-service",
    "  npm run rag:smoke:legal-exact -- --chat",
    "",
    "Environment:",
    "  SOTSIAALAI_SMOKE_BASE_URL=https://sotsiaal.ai",
    "  SOTSIAALAI_SMOKE_COOKIE=\"...\"",
    "  SOTSIAALAI_SMOKE_BEARER=\"...\"",
    "  RAG_SERVICE_URL=http://127.0.0.1:8000",
    "  RAG_SERVICE_API_KEY=\"...\"",
    "",
    "Checks legal exact behavior end-to-end across RAG-service search, chat trace, selection, displayed sources, and synthetic metrics."
  ].join("\n");
}

export function parseArgs(argv = []) {
  const args = {
    baseUrl: process.env.SOTSIAALAI_SMOKE_BASE_URL || process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
    cookie: process.env.SOTSIAALAI_SMOKE_COOKIE || process.env.SMOKE_COOKIE || "",
    bearer: process.env.SOTSIAALAI_SMOKE_BEARER || process.env.SMOKE_BEARER || "",
    role: process.env.SOTSIAALAI_SMOKE_ROLE || "SOCIAL_WORKER",
    ragServiceUrl: process.env.RAG_SERVICE_URL || process.env.RAG_INTERNAL_HOST || process.env.RAG_API_BASE || DEFAULT_RAG_SERVICE_URL,
    ragServiceApiKey: process.env.RAG_SERVICE_API_KEY || process.env.RAG_API_KEY || "",
    runChat: false,
    runRagService: false,
    runAll: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--base-url") args.baseUrl = argv[++index] || args.baseUrl;
    else if (arg === "--cookie") args.cookie = argv[++index] || "";
    else if (arg === "--bearer") args.bearer = argv[++index] || "";
    else if (arg === "--role") args.role = argv[++index] || args.role;
    else if (arg === "--rag-service-url") args.ragServiceUrl = argv[++index] || args.ragServiceUrl;
    else if (arg === "--rag-service-key") args.ragServiceApiKey = argv[++index] || args.ragServiceApiKey;
    else if (arg === "--chat") args.runChat = true;
    else if (arg === "--rag-service") args.runRagService = true;
    else if (arg === "--all") args.runAll = true;
    else throw new Error(`Unknown option: ${arg}`);
  }

  if (args.runAll || (!args.runChat && !args.runRagService)) {
    args.runAll = true;
    args.runChat = true;
    args.runRagService = true;
  }

  return args;
}

function endpoint(baseUrl = "", path = "") {
  return `${String(baseUrl || "").replace(/\/+$/u, "")}${path}`;
}

function normalizeUrl(value = "", fallback = DEFAULT_RAG_SERVICE_URL) {
  const trimmed = String(value || "").trim().replace(/\/+$/u, "");
  if (!trimmed) return fallback;
  if (/^https?:\/\//iu.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

function authHeaders(args, json = false) {
  const out = {};
  if (json) out["Content-Type"] = "application/json";
  if (args.cookie) out.Cookie = args.cookie;
  if (args.bearer) out.Authorization = `Bearer ${args.bearer}`;
  return out;
}

function ragHeaders(args) {
  return {
    "Content-Type": "application/json",
    ...(args.ragServiceApiKey ? { "X-API-Key": args.ragServiceApiKey } : {})
  };
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJsonResponse(res, label) {
  const raw = await res.text();
  assertCondition(res.ok, `${label}: HTTP ${res.status} ${raw.slice(0, 300)}`);
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`${label}: expected JSON response`);
  }
}

async function postJson(baseUrl, path, body, headers, label) {
  const res = await fetch(endpoint(baseUrl, path), {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  return readJsonResponse(res, label);
}

function legalLookupPlan(trace = {}) {
  const queryPlan = trace?.query_plan && typeof trace.query_plan === "object" ? trace.query_plan : {};
  return (
    queryPlan.legalLookupPlan ||
    queryPlan.legal_lookup_plan ||
    queryPlan.legal_lookup ||
    trace?.legalLookupPlan ||
    trace?.legal_lookup_plan ||
    trace?.legal_lookup ||
    null
  );
}

function paragraphRefsFromPlan(plan = null) {
  const refs = plan?.paragraphRefs || plan?.paragraph_refs || [];
  return Array.isArray(refs) ? refs.map(value => String(value || "").trim()).filter(Boolean) : [];
}

function sourceParagraphNumber(source = {}) {
  return String(
    source?.paragraphNumber ||
    source?.paragraph_number ||
    source?.metadata?.paragraph_number ||
    source?.metadata?.paragraphNumber ||
    ""
  ).trim();
}

function sourceType(source = {}) {
  return String(source?.sourceType || source?.source_type || source?.metadata?.source_type || "").trim();
}

function sourceTitle(source = {}) {
  return String(source?.title || source?.metadata?.title || "").trim();
}

function selectedContextDetails(trace = {}) {
  if (Array.isArray(trace?.selected_context_details)) return trace.selected_context_details;
  if (Array.isArray(trace?.selectedContextDetails)) return trace.selectedContextDetails;
  return [];
}

function displayedSources(payload = {}) {
  if (Array.isArray(payload.displayed_sources)) return payload.displayed_sources;
  if (Array.isArray(payload.displayedSources)) return payload.displayedSources;
  return [];
}

function responseText(payload = {}) {
  return String(payload?.reply || payload?.message || payload?.text || "").trim();
}

function summarizeSources(list = []) {
  return list.map((source) => ({
    title: sourceTitle(source),
    paragraph_number: sourceParagraphNumber(source) || null,
    source_type: sourceType(source) || null
  }));
}

function uniqueParagraphNumbers(list = []) {
  return [...new Set(
    (Array.isArray(list) ? list : [])
      .map((source) => sourceParagraphNumber(source))
      .filter(Boolean)
  )];
}

function buildChatDebugSnapshot(payload = {}) {
  const trace = payload?.rag_trace && typeof payload.rag_trace === "object" ? payload.rag_trace : null;
  const queryPlan = trace?.query_plan && typeof trace.query_plan === "object" ? trace.query_plan : null;
  const plan = legalLookupPlan(trace || {});
  return {
    rag_trace_present: !!trace,
    query_plan_present: !!queryPlan,
    query_plan_keys: queryPlan ? Object.keys(queryPlan).sort() : [],
    legalLookupPlan_present: !!(queryPlan?.legalLookupPlan),
    legal_lookup_plan_present: !!(queryPlan?.legal_lookup_plan),
    legal_lookup_present: !!(queryPlan?.legal_lookup),
    legal_lookup_snapshot: plan
      ? {
          enabled: plan.enabled === true,
          mode: plan.mode || null,
          actTitle: plan.actTitle || null,
          paragraphRefs: Array.isArray(plan.paragraphRefs) ? plan.paragraphRefs : [],
          sourceTypes: Array.isArray(plan.sourceTypes) ? plan.sourceTypes : [],
          collectionId: plan.collectionId || null,
          requireCurrent: plan.requireCurrent === true
        }
      : null,
    selection_strategy: queryPlan?.selection_strategy || null,
    selected_context_paragraph_numbers: uniqueParagraphNumbers(selectedContextDetails(trace || {})),
    displayed_source_paragraph_numbers: uniqueParagraphNumbers(displayedSources(payload))
  };
}

function withChatDebug(error, payload) {
  const message = error?.message || String(error);
  return new Error(`${message}; debug=${JSON.stringify(buildChatDebugSnapshot(payload))}`);
}

function assertSearchResults(label, results, expectedParagraph) {
  assertCondition(Array.isArray(results), `${label}: results must be an array`);
  assertCondition(results.length > 0, `${label}: results must not be empty`);
  for (const result of results) {
    const paragraphNumber = sourceParagraphNumber(result);
    const type = sourceType(result);
    assertCondition(paragraphNumber === expectedParagraph, `${label}: expected paragraph ${expectedParagraph}, got ${paragraphNumber || "(missing)"}`);
    assertCondition(type === "national_law", `${label}: expected national_law, got ${type || "(missing)"}`);
    assertCondition(type !== "journal_article", `${label}: journal_article must not appear`);
  }
}

async function runRagServiceSmoke(args) {
  const baseUrl = normalizeUrl(args.ragServiceUrl);
  const cases = [
    {
      id: "rag_service_shs_132",
      body: {
        query: `Sotsiaalhoolekande seadus ${PARAGRAPH_SIGN} 132 toimetulekutoetuse taotlemine`,
        top_k: 20,
        where: {
          source_type: "national_law",
          collection_id: "national_regulations",
          paragraph_number: "132"
        }
      },
      expectedParagraph: "132"
    },
    {
      id: "rag_service_shs_140",
      body: {
        query: `Sotsiaalhoolekande seadus ${PARAGRAPH_SIGN} 140`,
        top_k: 20,
        where: {
          source_type: "national_law",
          collection_id: "national_regulations",
          paragraph_number: "140"
        }
      },
      expectedParagraph: "140"
    }
  ];

  const results = [];
  for (const item of cases) {
    const payload = await postJson(baseUrl, "/search", item.body, ragHeaders(args), item.id);
    const rows = Array.isArray(payload.results) ? payload.results : [];
    assertSearchResults(item.id, rows, item.expectedParagraph);
    results.push({
      id: item.id,
      ok: true,
      top: summarizeSources(rows.slice(0, 5))
    });
  }
  return results;
}

async function postChat(args, message, history = []) {
  return postJson(args.baseUrl, "/api/chat", {
    message,
    history,
    role: args.role,
    persist: false,
    uiLocale: "et",
    chatMode: "rag",
    forceSources: true
  }, authHeaders(args, true), `chat:${message}`);
}

function assertLegalDisplayedParagraphs(label, sources, allowedParagraphs) {
  for (const source of sources) {
    const type = sourceType(source);
    if (!LEGAL_SOURCE_TYPE_PATTERN.test(type)) continue;
    const paragraphNumber = sourceParagraphNumber(source);
    assertCondition(allowedParagraphs.includes(paragraphNumber), `${label}: displayed legal paragraph ${paragraphNumber || "(missing)"} is not allowed`);
  }
}

function assertLegalSelectedParagraphs(label, details, allowedParagraphs) {
  for (const detail of details) {
    const type = sourceType(detail);
    if (!LEGAL_SOURCE_TYPE_PATTERN.test(type)) continue;
    const paragraphNumber = sourceParagraphNumber(detail);
    assertCondition(allowedParagraphs.includes(paragraphNumber), `${label}: selected legal paragraph ${paragraphNumber || "(missing)"} is not allowed`);
  }
}

function summarizeChatCase(id, payload) {
  const trace = payload?.rag_trace || {};
  return {
    id,
    selection_strategy: trace?.query_plan?.selection_strategy || null,
    displayed_sources: summarizeSources(displayedSources(payload)),
    selected_context_details: summarizeSources(selectedContextDetails(trace)),
    displayed_source_ids: Array.isArray(trace?.displayed_source_ids) ? trace.displayed_source_ids : [],
    selected_context_source_ids: Array.isArray(trace?.selected_context_source_ids) ? trace.selected_context_source_ids : [],
    insufficient_precise_legal_source_support: !!(
      payload?.rag_trace?.insufficientPreciseLegalSourceSupport ||
      payload?.rag_trace?.insufficient_precise_legal_source_support ||
      payload?.insufficientPreciseLegalSourceSupport ||
      payload?.insufficient_precise_legal_source_support ||
      payload?.meta?.insufficientPreciseLegalSourceSupport
    )
  };
}

async function runChatSmoke(args) {
  if (!args.cookie && !args.bearer) {
    return {
      skipped: true,
      reason: "missing_auth"
    };
  }

  const shs140 = await postChat(args, `SHS ${PARAGRAPH_SIGN} 140?`);
  try {
    const shs140Trace = shs140?.rag_trace || {};
    const shs140Plan = legalLookupPlan(shs140Trace);
    const shs140ParagraphRefs = paragraphRefsFromPlan(shs140Plan);
    assertCondition(shs140Plan?.enabled === true, "chat_shs_140: legalLookupPlan.enabled must be true");
    assertCondition(shs140Plan?.mode === "explicit_paragraph", "chat_shs_140: legalLookupPlan.mode must be explicit_paragraph");
    assertCondition(shs140ParagraphRefs.includes("140"), "chat_shs_140: paragraphRefs must contain 140");
    assertCondition(
      ["legal_exact", "legal_exact_paragraph"].includes(String(shs140Trace?.query_plan?.selection_strategy || "")),
      "chat_shs_140: selection_strategy must be legal_exact"
    );
    assertLegalSelectedParagraphs("chat_shs_140", selectedContextDetails(shs140Trace), ["140"]);
    assertCondition(displayedSources(shs140).length > 0, "chat_shs_140: displayed_sources must not be empty");
    assertLegalDisplayedParagraphs("chat_shs_140", displayedSources(shs140), ["140"]);
    assertCondition(
      displayedSources(shs140).every((source) => !/Paragrahvi 140 rakendamine/i.test(sourceTitle(source))),
      `chat_shs_140: displayed sources must not contain ${PARAGRAPH_SIGN}160`
    );
  } catch (error) {
    throw withChatDebug(error, shs140);
  }

  const firstTurn = await postChat(args, "Millised SHS paragrahvid reguleerivad toimetulekutoetust?");
  const secondTurn = await postChat(args, `SHS ${PARAGRAPH_SIGN} 140?`, [
    { role: "user", text: "Millised SHS paragrahvid reguleerivad toimetulekutoetust?" },
    { role: "assistant", text: responseText(firstTurn), displayed_sources: displayedSources(firstTurn) }
  ]);
  try {
    const secondTrace = secondTurn?.rag_trace || {};
    const secondPlan = legalLookupPlan(secondTrace);
    const secondParagraphRefs = paragraphRefsFromPlan(secondPlan);
    assertCondition(secondPlan?.mode === "explicit_paragraph", "chat_history_override: mode must be explicit_paragraph");
    assertCondition(secondParagraphRefs.length === 1 && secondParagraphRefs[0] === "140", "chat_history_override: paragraphRefs must be [140]");
    assertLegalSelectedParagraphs("chat_history_override", selectedContextDetails(secondTrace), ["140"]);
    assertLegalDisplayedParagraphs("chat_history_override", displayedSources(secondTurn), ["140"]);
  } catch (error) {
    throw withChatDebug(error, secondTurn);
  }

  const shs132 = await postChat(args, `SHS ${PARAGRAPH_SIGN} 132 toimetulekutoetuse taotlemine?`);
  try {
    const shs132Trace = shs132?.rag_trace || {};
    const shs132Plan = legalLookupPlan(shs132Trace);
    const shs132ParagraphRefs = paragraphRefsFromPlan(shs132Plan);
    assertCondition(shs132ParagraphRefs.includes("132"), "chat_shs_132: paragraphRefs must contain 132");
    assertCondition(
      ["legal_exact", "legal_exact_paragraph"].includes(String(shs132Trace?.query_plan?.selection_strategy || "")),
      "chat_shs_132: selection_strategy must be legal_exact"
    );
    assertLegalSelectedParagraphs("chat_shs_132", selectedContextDetails(shs132Trace), ["132"]);
    assertCondition(displayedSources(shs132).length > 0, "chat_shs_132: displayed_sources must not be empty");
    assertLegalDisplayedParagraphs("chat_shs_132", displayedSources(shs132), ["132"]);
    assertCondition(
      displayedSources(shs132).every((source) => sourceType(source) !== "journal_article"),
      "chat_shs_132: journal_article must not be displayed as current legal source"
    );
  } catch (error) {
    throw withChatDebug(error, shs132);
  }

  const shs999 = await postChat(args, `SHS ${PARAGRAPH_SIGN} 999?`);
  try {
    const shs999Trace = shs999?.rag_trace || {};
    const shs999Selected = selectedContextDetails(shs999Trace).filter((detail) => LEGAL_SOURCE_TYPE_PATTERN.test(sourceType(detail)));
    const shs999Displayed = displayedSources(shs999).filter((source) => LEGAL_SOURCE_TYPE_PATTERN.test(sourceType(source)));
    assertCondition(shs999Selected.length === 0, "chat_shs_999: selected legal sources must be empty");
    assertCondition(shs999Displayed.length === 0, "chat_shs_999: displayed legal sources must be empty");
    assertCondition(
      !!(
        shs999?.rag_trace?.insufficientPreciseLegalSourceSupport ||
        shs999?.rag_trace?.insufficient_precise_legal_source_support ||
        shs999?.insufficientPreciseLegalSourceSupport ||
        shs999?.insufficient_precise_legal_source_support ||
        shs999?.meta?.insufficientPreciseLegalSourceSupport
      ),
      "chat_shs_999: insufficient_precise_legal_source_support must be true"
    );
    assertCondition(
      responseText(shs999).length === 0 ||
      !/\u00A7\s*(140|160|132|131|133|134|135)\b/.test(responseText(shs999)),
      "chat_shs_999: response must not substitute a different paragraph"
    );
  } catch (error) {
    throw withChatDebug(error, shs999);
  }

  return {
    skipped: false,
    cases: [
      summarizeChatCase("chat_shs_140", shs140),
      summarizeChatCase("chat_history_override_second_turn", secondTurn),
      summarizeChatCase("chat_shs_132", shs132),
      summarizeChatCase("chat_shs_999", shs999)
    ]
  };
}

function runSyntheticMetricsRegression() {
  const result = summarizeRagTraceSourceQuality([
    {
      data: {
        query_plan: {
          legalLookupPlan: {
            enabled: true,
            mode: "explicit_paragraph",
            paragraphRefs: ["140"]
          }
        },
        selected_context_details: [
          {
            source_id: "rt-160",
            source_type: "national_law",
            paragraph_number: "160",
            source_status: "active"
          }
        ],
        attribution_decisions: [
          {
            source_id: "rt-160",
            decision: "display",
            source_type: "national_law",
            paragraph_number: "160",
            source_status: "active"
          }
        ]
      }
    }
  ]);

  assertCondition(result.summary.legal_selected_paragraph_precision < 1, "metrics_fixture: legal_selected_paragraph_precision must be < 1");
  assertCondition(result.summary.legal_displayed_paragraph_precision < 1, "metrics_fixture: legal_displayed_paragraph_precision must be < 1");
  assertCondition(result.summary.legal_wrong_paragraph_count > 0, "metrics_fixture: legal_wrong_paragraph_count must be > 0");
  assertCondition(
    result.issues.some((item) => item.type === "legal_selected_wrong_paragraph" || item.type === "legal_displayed_wrong_paragraph"),
    "metrics_fixture: expected legal wrong paragraph issue"
  );

  return {
    ok: true,
    legal_selected_paragraph_precision: result.summary.legal_selected_paragraph_precision,
    legal_displayed_paragraph_precision: result.summary.legal_displayed_paragraph_precision,
    legal_wrong_paragraph_count: result.summary.legal_wrong_paragraph_count
  };
}

export async function runLegalExactSmokeSuite(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : rawArgs;
  const output = {
    ok: true,
    environment: {
      baseUrl: args.baseUrl,
      ragServiceUrl: normalizeUrl(args.ragServiceUrl)
    },
    checks: {},
    results: {}
  };

  if (args.runRagService) {
    output.checks.ragService = true;
    output.results.ragService = await runRagServiceSmoke(args);
  }

  if (args.runChat) {
    output.checks.chat = true;
    output.results.chat = await runChatSmoke(args);
  }

  output.checks.syntheticMetrics = true;
  output.results.syntheticMetrics = runSyntheticMetricsRegression();

  return output;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const output = await runLegalExactSmokeSuite(args);
  console.log(JSON.stringify(output, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      error: error?.message || String(error)
    }, null, 2));
    process.exitCode = 1;
  });
}
