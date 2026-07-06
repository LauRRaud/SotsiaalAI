#!/usr/bin/env node

import { runLegalExactSmokeSuite } from "./smoke-rag-legal-exact.mjs";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";

const DEFAULT_CHAT_CASE = {
  id: "v2_quality_chat",
  message: "Kas Laur Raudsoo on kirjutanud tehisintellektist sotsiaaltoos?"
};

function usage() {
  return [
    "Usage:",
    "  npm run rag:smoke:v2",
    "  npm run rag:smoke:v2 -- --chat",
    "  npm run rag:smoke:v2 -- --legal-exact",
    "  npm run rag:smoke:v2 -- --chat --legal-exact",
    "  npm run rag:smoke:v2 -- --max-reason unknown_source_type=0 --max-reason missing_last_checked=0",
    "  npm run rag:smoke:v2 -- --min-collection-completeness ajakiri_sotsiaaltoo=0.95",
    "",
    "Environment:",
    "  SOTSIAALAI_SMOKE_BASE_URL=https://sotsiaal.ai",
    "  SOTSIAALAI_SMOKE_COOKIE=\"next-auth.session-token=...\"",
    "  SOTSIAALAI_SMOKE_BEARER=\"...\"",
    "",
    "Checks V2 RAG quality surfaces from /api/admin/analytics/summary.",
    "With --chat, also checks that /api/chat returns V2 trace signals.",
    "With --legal-exact, also runs legal-exact smoke for direct RAG-service filters, chat legal lookup traces and synthetic wrong-paragraph metrics.",
    "Use --max-reason reason=count to fail when a freshness issue reason exceeds a threshold.",
    "Use --min-collection-completeness collection=rate to fail when one corpus family is below a metadata completeness target."
  ].join("\n");
}

function parseArgs(argv = []) {
  const args = {
    baseUrl: process.env.SOTSIAALAI_SMOKE_BASE_URL || process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
    cookie: process.env.SOTSIAALAI_SMOKE_COOKIE || process.env.SMOKE_COOKIE || "",
    bearer: process.env.SOTSIAALAI_SMOKE_BEARER || process.env.SMOKE_BEARER || "",
    role: process.env.SOTSIAALAI_SMOKE_ROLE || "SOCIAL_WORKER",
    chat: process.env.SOTSIAALAI_SMOKE_CHAT === "1" || process.env.SMOKE_CHAT === "1",
    legalExact: process.env.SOTSIAALAI_SMOKE_LEGAL_EXACT === "1" || process.env.SMOKE_LEGAL_EXACT === "1",
    maxReasons: {},
    minCollectionCompleteness: {},
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--base-url") args.baseUrl = argv[++index] || args.baseUrl;
    else if (arg === "--cookie") args.cookie = argv[++index] || "";
    else if (arg === "--bearer") args.bearer = argv[++index] || "";
    else if (arg === "--role") args.role = argv[++index] || args.role;
    else if (arg === "--chat") args.chat = true;
    else if (arg === "--legal-exact") args.legalExact = true;
    else if (arg === "--max-reason") {
      const value = argv[++index] || "";
      const [reason, rawLimit] = value.split("=");
      const limit = Number(rawLimit);
      if (!reason || !Number.isFinite(limit) || limit < 0) {
        throw new Error("--max-reason expects reason=nonnegative_number");
      }
      args.maxReasons[reason] = Math.floor(limit);
    }
    else if (arg === "--min-collection-completeness") {
      const value = argv[++index] || "";
      const [collection, rawRate] = value.split("=");
      const rate = Number(rawRate);
      if (!collection || !Number.isFinite(rate) || rate < 0 || rate > 1) {
        throw new Error("--min-collection-completeness expects collection=rate_between_0_and_1");
      }
      args.minCollectionCompleteness[collection] = rate;
    }
    else throw new Error(`Unknown option: ${arg}`);
  }

  return args;
}

function endpoint(baseUrl = "", path = "") {
  return `${String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/u, "")}${path}`;
}

function headers(args, json = false) {
  const out = {};
  if (json) out["Content-Type"] = "application/json";
  if (args.cookie) out.Cookie = args.cookie;
  if (args.bearer) out.Authorization = `Bearer ${args.bearer}`;
  return out;
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJsonResponse(res, label) {
  const raw = await res.text();
  assertCondition(res.ok, `${label}: HTTP ${res.status} ${raw.slice(0, 300)}`);
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${label}: expected JSON response`);
  }
}

async function getJson(args, path, label) {
  const res = await fetch(endpoint(args.baseUrl, path), {
    method: "GET",
    headers: headers(args)
  });
  return readJsonResponse(res, label);
}

async function postJson(args, path, body, label) {
  const res = await fetch(endpoint(args.baseUrl, path), {
    method: "POST",
    headers: headers(args, true),
    body: JSON.stringify(body)
  });
  return readJsonResponse(res, label);
}

function assertObject(value, message) {
  assertCondition(value && typeof value === "object" && !Array.isArray(value), message);
}

function assertNumber(value, message) {
  assertCondition(typeof value === "number" && Number.isFinite(value), message);
}

function assertMetadataQualityBucket(bucket, label) {
  assertObject(bucket, `${label}: metadata quality bucket missing`);
  for (const field of [
    "total",
    "complete",
    "incomplete",
    "required_missing",
    "recommended_missing",
    "completeness_rate",
    "average_score"
  ]) {
    assertNumber(bucket[field], `${label}: metadata_quality.${field} must be a number`);
  }
  assertObject(bucket.missing_fields, `${label}: metadata_quality.missing_fields missing`);
  assertObject(bucket.missing_required_fields, `${label}: metadata_quality.missing_required_fields missing`);
  assertObject(bucket.missing_recommended_fields, `${label}: metadata_quality.missing_recommended_fields missing`);
}

function assertMetadataQuality(summary) {
  assertObject(summary, "freshness.summary missing");
  assertMetadataQualityBucket(summary.metadata_quality, "freshness.summary");
  assertObject(summary.metadata_quality.by_collection, "freshness.summary.metadata_quality.by_collection missing");
  assertObject(summary.metadata_quality.by_file_type, "freshness.summary.metadata_quality.by_file_type missing");

  for (const [key, bucket] of Object.entries(summary.metadata_quality.by_collection)) {
    assertMetadataQualityBucket(bucket, `metadata_quality.by_collection.${key}`);
  }
  for (const [key, bucket] of Object.entries(summary.metadata_quality.by_file_type)) {
    assertMetadataQualityBucket(bucket, `metadata_quality.by_file_type.${key}`);
  }
}

function assertIssueShape(issue, label) {
  assertObject(issue, `${label}: issue missing`);
  assertCondition("collection_family" in issue, `${label}: collection_family missing`);
  assertCondition("source_file_type" in issue, `${label}: source_file_type missing`);
  assertCondition("freshness_status" in issue, `${label}: freshness_status missing`);
  assertObject(issue.metadata_quality, `${label}: metadata_quality missing`);
  assertObject(issue.remediation, `${label}: remediation missing`);
  assertCondition(typeof issue.remediation.action === "string", `${label}: remediation.action missing`);
  assertCondition(Array.isArray(issue.remediation.fields), `${label}: remediation.fields must be an array`);
  assertObject(issue.remediation.target, `${label}: remediation.target missing`);
  assertCondition(typeof issue.remediation.target.admin_href === "string", `${label}: remediation.target.admin_href missing`);
  assertCondition(typeof issue.remediation.target.action === "string", `${label}: remediation.target.action missing`);
  assertCondition(Array.isArray(issue.remediation.target.fields), `${label}: remediation.target.fields must be an array`);
  assertCondition(typeof issue.remediation.target.focus === "string", `${label}: remediation.target.focus missing`);
  assertCondition(
    issue.remediation.target.file_key === null || typeof issue.remediation.target.file_key === "string",
    `${label}: remediation.target.file_key must be null or string`
  );

  const href = new URL(issue.remediation.target.admin_href, "https://smoke.local");
  assertCondition(href.searchParams.get("focus") === issue.remediation.target.focus, `${label}: admin_href focus mismatch`);
  if (issue.remediation.target.file_key) {
    assertCondition(href.searchParams.get("file_key") === issue.remediation.target.file_key, `${label}: admin_href file_key mismatch`);
  }
}

function assertHighRiskIssueShape(issue, label) {
  assertObject(issue, `${label}: high-risk issue missing`);
  assertCondition("layer" in issue, `${label}: layer missing`);
  assertCondition("source_id" in issue, `${label}: source_id missing`);
  assertCondition("severity" in issue, `${label}: severity missing`);
  if (issue.remediation) {
    assertCondition(typeof issue.remediation.action === "string", `${label}: remediation.action missing`);
    assertObject(issue.remediation.target, `${label}: remediation.target missing`);
    assertCondition(typeof issue.remediation.target.admin_href === "string", `${label}: remediation.target.admin_href missing`);
    assertCondition(typeof issue.remediation.target.action === "string", `${label}: remediation.target.action missing`);
    assertCondition(Array.isArray(issue.remediation.target.fields), `${label}: remediation.target.fields must be an array`);
    assertCondition(typeof issue.remediation.target.focus === "string", `${label}: remediation.target.focus missing`);
    assertCondition(
      issue.remediation.target.file_key === null || typeof issue.remediation.target.file_key === "string",
      `${label}: remediation.target.file_key must be null or string`
    );
  }
}

function assertSourceQualityPayload(sourceQuality) {
  assertObject(sourceQuality, "ragDocs.sourceQuality missing");
  assertObject(sourceQuality.summary, "ragDocs.sourceQuality.summary missing");
  assertCondition(Array.isArray(sourceQuality.issues), "ragDocs.sourceQuality.issues must be an array");

  for (const field of [
    "traces",
    "retrieved_source_count",
    "selected_context_source_count",
    "answer_source_count",
    "displayed_source_count",
    "displayed_source_valid_count",
    "displayed_source_violation_count",
    "displayed_source_precision",
    "displayed_source_precision_basis",
    "display_contract_violation_rate",
    "retrieved_filter_rate",
    "selected_filter_rate",
    "municipality_scope_expected_traces",
    "municipality_source_count",
    "wrong_municipality_source_count",
    "traces_with_wrong_municipality",
    "wrong_municipality_rate"
  ]) {
    assertNumber(sourceQuality.summary[field], `ragDocs.sourceQuality.summary.${field} must be a number`);
  }

  assertObject(
    sourceQuality.summary.source_display_mode_distribution,
    "ragDocs.sourceQuality.summary.source_display_mode_distribution missing"
  );
  assertObject(
    sourceQuality.summary.attribution_decision_distribution,
    "ragDocs.sourceQuality.summary.attribution_decision_distribution missing"
  );
  assertObject(
    sourceQuality.summary.attribution_decision_reason_distribution,
    "ragDocs.sourceQuality.summary.attribution_decision_reason_distribution missing"
  );

  if (sourceQuality.issues.length > 0) {
    const issue = sourceQuality.issues[0];
    assertObject(issue, "ragDocs.sourceQuality.issues[0] missing");
    assertCondition(typeof issue.type === "string", "ragDocs.sourceQuality.issues[0].type missing");
    if (issue.type === "displayed_source_not_in_answer_sources") {
      assertCondition(Array.isArray(issue.offending_source_ids), "ragDocs.sourceQuality.issues[0].offending_source_ids must be an array");
    }
    if (issue.type === "selected_context_wrong_municipality") {
      assertCondition(typeof issue.source_id === "string" || issue.source_id === null, "ragDocs.sourceQuality.issues[0].source_id missing");
      assertCondition(Array.isArray(issue.expected_municipality_ids), "ragDocs.sourceQuality.issues[0].expected_municipality_ids must be an array");
      assertCondition(Array.isArray(issue.expected_municipality_names), "ragDocs.sourceQuality.issues[0].expected_municipality_names must be an array");
    }
  }
}

function assertAdminQualityPayload(payload) {
  assertObject(payload, "admin analytics response missing");
  assertCondition(payload.ok === true, "admin analytics response ok must be true");
  assertObject(payload.ragDocs, "ragDocs missing");
  assertObject(payload.ragDocs.freshness, "ragDocs.freshness missing");
  assertSourceQualityPayload(payload.ragDocs.sourceQuality);

  const freshness = payload.ragDocs.freshness;
  assertCondition(typeof freshness.auditSource === "string", "ragDocs.freshness.auditSource must be a string");
  assertNumber(freshness.audited, "ragDocs.freshness.audited must be a number");
  assertNumber(freshness.ragServiceFallbackCount, "ragDocs.freshness.ragServiceFallbackCount must be a number");
  assertCondition(
    freshness.ragServiceFallbackError === null || typeof freshness.ragServiceFallbackError === "string",
    "ragDocs.freshness.ragServiceFallbackError must be null or string"
  );
  assertObject(freshness.summary, "ragDocs.freshness.summary missing");
  assertCondition(Array.isArray(freshness.issues), "ragDocs.freshness.issues must be an array");
  assertObject(freshness.highRisk, "ragDocs.freshness.highRisk missing");
  assertCondition(Array.isArray(freshness.highRiskIssues), "ragDocs.freshness.highRiskIssues must be an array");
  assertNumber(freshness.highRisk.high_risk_with_claim_sources, "ragDocs.freshness.highRisk.high_risk_with_claim_sources must be a number");
  assertNumber(freshness.highRisk.stale_claim_source_responses, "ragDocs.freshness.highRisk.stale_claim_source_responses must be a number");
  assertNumber(freshness.highRisk.claim_source_risk_readiness_rate, "ragDocs.freshness.highRisk.claim_source_risk_readiness_rate must be a number");

  assertMetadataQuality(freshness.summary);

  if (freshness.issues.length > 0) {
    assertIssueShape(freshness.issues[0], "ragDocs.freshness.issues[0]");
  }
  if (freshness.highRiskIssues.length > 0) {
    assertHighRiskIssueShape(freshness.highRiskIssues[0], "ragDocs.freshness.highRiskIssues[0]");
  }

  return freshness;
}

function firstValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    return value;
  }
  return null;
}

function assertChatV2Payload(payload) {
  assertObject(payload, "chat response missing");
  assertCondition(payload.ok !== false, "chat response ok=false");
  assertObject(payload.rag_trace, "chat rag_trace missing");

  const trace = payload.rag_trace;
  assertCondition(Array.isArray(trace.retrievers_used), "rag_trace.retrievers_used must be an array");
  assertObject(trace.query_plan, "rag_trace.query_plan missing");
  assertObject(trace.hybrid_retrieval, "rag_trace.hybrid_retrieval missing");
  assertObject(trace.hybrid_retrieval.channel_counts, "rag_trace.hybrid_retrieval.channel_counts missing");
  if (trace.retrievers_used.includes("bm25")) {
    assertObject(trace.hybrid_retrieval.bm25, "rag_trace.hybrid_retrieval.bm25 missing while bm25 retriever was used");
  }

  const riskLevel = firstValue(trace.rag_risk_level, trace.risk_level, trace.riskLevel);
  const requiredEvidence = firstValue(trace.rag_required_evidence, trace.required_evidence, trace.requiredEvidence);
  assertCondition(typeof riskLevel === "string" || typeof requiredEvidence === "string", "rag_trace risk policy fields missing");

  return {
    queryPlanMode: trace.query_plan?.mode || null,
    retrieversUsed: trace.retrievers_used,
    hybridMergeStrategy: trace.hybrid_retrieval?.merge_strategy?.strategy || null,
    hybridChannelCounts: trace.hybrid_retrieval?.channel_counts || {},
    hybridBm25: trace.hybrid_retrieval?.bm25 || null,
    riskLevel,
    requiredEvidence
  };
}

async function checkChatV2(args) {
  const payload = await postJson(args, "/api/chat", {
    message: DEFAULT_CHAT_CASE.message,
    history: [],
    role: args.role,
    persist: false,
    uiLocale: "et",
    chatMode: "rag",
    forceSources: true
  }, DEFAULT_CHAT_CASE.id);
  return assertChatV2Payload(payload);
}

function metadataKeys(value) {
  return Object.keys(value || {}).sort();
}

function topEntries(value, limit = 10) {
  return Object.fromEntries(
    Object.entries(value || {})
      .sort((left, right) => Number(right[1] || 0) - Number(left[1] || 0) || left[0].localeCompare(right[0]))
      .slice(0, limit)
  );
}

function compactMetadataBuckets(buckets = {}) {
  return Object.fromEntries(
    Object.entries(buckets || {})
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([name, bucket]) => [
        name,
        {
          total: bucket.total,
          complete: bucket.complete,
          incomplete: bucket.incomplete,
          completenessRate: bucket.completeness_rate,
          averageScore: bucket.average_score,
          missingRequiredFields: topEntries(bucket.missing_required_fields, 5),
          missingRecommendedFields: topEntries(bucket.missing_recommended_fields, 5)
        }
      ])
  );
}

function assertReasonThresholds(reasons = {}, maxReasons = {}) {
  for (const [reason, maxAllowed] of Object.entries(maxReasons || {})) {
    const count = Number(reasons?.[reason] || 0);
    assertCondition(
      count <= maxAllowed,
      `freshness reason "${reason}" count ${count} exceeds max ${maxAllowed}`
    );
  }
}

function assertCollectionCompletenessThresholds(buckets = {}, thresholds = {}) {
  for (const [collection, minRate] of Object.entries(thresholds || {})) {
    const bucket = buckets?.[collection];
    assertObject(bucket, `metadata collection "${collection}" missing`);
    const rate = Number(bucket.completeness_rate || 0);
    assertCondition(
      rate >= minRate,
      `metadata collection "${collection}" completeness ${rate} is below min ${minRate}`
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const adminPayload = await getJson(args, "/api/admin/analytics/summary?locale=et", "admin analytics");
  const freshness = assertAdminQualityPayload(adminPayload);
  assertReasonThresholds(freshness.summary.reasons, args.maxReasons);
  assertCollectionCompletenessThresholds(
    freshness.summary.metadata_quality.by_collection,
    args.minCollectionCompleteness
  );
  const chatSummary = args.chat ? await checkChatV2(args) : null;
  const legalExactSummary = args.legalExact
    ? await runLegalExactSmokeSuite({
      baseUrl: args.baseUrl,
      cookie: args.cookie,
      bearer: args.bearer,
      role: args.role,
      ragServiceUrl: process.env.RAG_SERVICE_URL || process.env.RAG_INTERNAL_HOST || process.env.RAG_API_BASE || "http://127.0.0.1:8000",
      ragServiceApiKey: process.env.RAG_SERVICE_API_KEY || process.env.RAG_API_KEY || "",
      runChat: args.chat,
      runRagService: true,
      runAll: false,
      help: false
    })
    : null;

  console.log(JSON.stringify({
    ok: true,
    baseUrl: args.baseUrl,
    checks: {
      adminAnalytics: true,
      metadataQuality: true,
      qualityQueueShape: true,
      sourceQuality: true,
      highRiskFreshness: true,
      chatV2: Boolean(args.chat),
      legalExact: Boolean(args.legalExact)
    },
    summary: {
      audited: freshness.audited,
      freshnessAuditSource: freshness.auditSource,
      ragServiceFallbackCount: freshness.ragServiceFallbackCount,
      metadataCompletenessRate: freshness.summary.metadata_quality.completeness_rate,
      metadataAverageScore: freshness.summary.metadata_quality.average_score,
      metadataCollections: metadataKeys(freshness.summary.metadata_quality.by_collection),
      metadataFileTypes: metadataKeys(freshness.summary.metadata_quality.by_file_type),
      freshnessReasons: topEntries(freshness.summary.reasons),
      missingRequiredFields: topEntries(freshness.summary.metadata_quality.missing_required_fields),
      missingRecommendedFields: topEntries(freshness.summary.metadata_quality.missing_recommended_fields),
      metadataByCollection: compactMetadataBuckets(freshness.summary.metadata_quality.by_collection),
      metadataByFileType: compactMetadataBuckets(freshness.summary.metadata_quality.by_file_type),
      displayedSourcePrecision: adminPayload.ragDocs.sourceQuality.summary.displayed_source_precision,
      retrievedFilterRate: adminPayload.ragDocs.sourceQuality.summary.retrieved_filter_rate,
      wrongMunicipalityRate: adminPayload.ragDocs.sourceQuality.summary.wrong_municipality_rate,
      sourceQualityIssues: adminPayload.ragDocs.sourceQuality.issues.length,
      qualityIssues: freshness.issues.length,
      highRiskIssues: freshness.highRiskIssues.length,
      highRiskClaimSources: freshness.highRisk.high_risk_claim_source_count,
      highRiskClaimReadinessRate: freshness.highRisk.claim_source_risk_readiness_rate,
      highRiskStaleClaimResponses: freshness.highRisk.stale_claim_source_responses,
      chat: chatSummary,
      legalExact: legalExactSummary
    }
  }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({
    ok: false,
    error: error?.message || String(error)
  }, null, 2));
  process.exitCode = 1;
});
