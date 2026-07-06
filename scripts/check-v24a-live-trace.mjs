import { pathToFileURL } from "node:url";

function parsePositiveInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export const DEFAULT_MAX_AGE_MINUTES = parsePositiveInteger(process.env.V24A_TRACE_MAX_AGE_MINUTES, 720);

export const CASES = [
  {
    id: "overview_lastekaitse",
    userIncludes: "Mis on murekohad lastekaitses?",
    expectedMode: "overview_synthesis",
    evidencePackage: true,
    expectedTemporalMetadata: true
  },
  {
    id: "comparison_koduteenus_tugiisik",
    userIncludes: "Mis vahe on koduteenusel ja tugiisikuteenusel?",
    expectedMode: "comparison",
    evidencePackage: true,
    displayedParagraphsOnly: ["17", "23"]
  },
  {
    id: "legal_exact_shs_42",
    userIncludes: "Mis ütleb SHS § 42?",
    expectedMode: "explicit_paragraph",
    evidencePackage: false
  },
  {
    id: "kov_kuusalu_koduteenus",
    userIncludes: "Millised on Kuusalu valla koduteenuse tingimused?",
    expectedMode: "municipality_service_benefit_list",
    evidencePackage: false,
    packageAware: true
  }
];

const MOJIBAKE_REPLACEMENTS = [
  [/Ć¼/g, "ü"],
  [/Ćµ/g, "õ"],
  [/Ć¤/g, "ä"],
  [/Ć¶/g, "ö"],
  [/Ā§/g, "§"],
  [/ā§/g, "§"]
];

export function normalize(value = "") {
  let text = String(value || "");
  for (const [pattern, replacement] of MOJIBAKE_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function paragraphNumber(source = {}) {
  return String(
    source.paragraph_number ||
    source.paragraphNumber ||
    source.metadata?.paragraph_number ||
    source.metadata?.paragraphNumber ||
    ""
  ).trim();
}

function modeOf(trace = {}) {
  return String(trace?.query_plan?.mode || trace?.query_plan?.question_planner?.mode || "").trim();
}

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageMinutes(createdAt, now = new Date()) {
  const date = toDate(createdAt);
  if (!date) return null;
  return Math.max(0, Math.round((now.getTime() - date.getTime()) / 60000));
}

function sourceYearsFromEvidencePackage(pkg = {}) {
  const years = [];
  const addYear = (value) => {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2100) years.push(parsed);
  };
  for (const source of Array.isArray(pkg.selected_sources) ? pkg.selected_sources : []) {
    addYear(source?.source_year);
  }
  for (const doc of Array.isArray(pkg.selected_documents) ? pkg.selected_documents : []) {
    addYear(doc?.source_year);
  }
  for (const year of Array.isArray(pkg.temporal_coverage?.years) ? pkg.temporal_coverage.years : []) {
    addYear(year);
  }
  return Array.from(new Set(years)).sort((a, b) => a - b);
}

function summarizeTemporalCoverage(pkg = {}) {
  const years = sourceYearsFromEvidencePackage(pkg);
  const temporal = pkg.temporal_coverage && typeof pkg.temporal_coverage === "object"
    ? pkg.temporal_coverage
    : null;
  return {
    source_years: years,
    source_year_count: years.length,
    temporal_coverage_present: !!temporal,
    temporal_year_range: temporal?.year_range || null,
    temporal_has_multi_year_range: temporal?.has_multi_year_range === true,
    trace_summary_year_range: pkg.trace_summary?.year_range || null,
    trace_summary_distinct_year_count: Number.isFinite(Number(pkg.trace_summary?.distinct_year_count))
      ? Number(pkg.trace_summary.distinct_year_count)
      : null
  };
}

export function summarizePair(userMessage, assistantMessage, { now = new Date() } = {}) {
  const metadata = assistantMessage?.metadata && typeof assistantMessage.metadata === "object"
    ? assistantMessage.metadata
    : {};
  const trace = metadata.rag_trace || {};
  const displayedSources = Array.isArray(metadata.displayed_sources) ? metadata.displayed_sources : [];
  const evidencePackage = trace.evidence_package || null;
  return {
    userMessageId: userMessage?.id,
    assistantMessageId: assistantMessage?.id,
    conversationId: assistantMessage?.conversationId,
    createdAt: assistantMessage?.createdAt,
    ageMinutes: ageMinutes(assistantMessage?.createdAt, now),
    userPreview: String(userMessage?.content || "").slice(0, 180),
    mode: modeOf(trace),
    selection_strategy: trace?.query_plan?.selection_strategy || null,
    evidence_package_present: !!evidencePackage,
    evidence_package_mode: evidencePackage?.mode || null,
    evidence_package_temporal: evidencePackage ? summarizeTemporalCoverage(evidencePackage) : null,
    package_aware_answering_used: trace.package_aware_answering_used === true,
    displayed_source_ids: trace.displayed_source_ids || [],
    displayed_paragraph_numbers: displayedSources.map(paragraphNumber).filter(Boolean),
    displayed_titles: displayedSources.map(source => source.title || source.label || source.source_id || source.id).filter(Boolean)
  };
}

export function evaluateCase(testCase, pair, options = {}) {
  const now = options.now || new Date();
  const maxAgeMinutes = Number.isFinite(Number(options.maxAgeMinutes))
    ? Number(options.maxAgeMinutes)
    : DEFAULT_MAX_AGE_MINUTES;
  if (!pair) {
    return {
      id: testCase.id,
      ok: false,
      errors: ["matching_recent_conversation_pair_not_found"]
    };
  }
  const summary = summarizePair(pair.user, pair.assistant, { now });
  const errors = [];
  if (maxAgeMinutes > 0 && Number.isFinite(Number(summary.ageMinutes)) && summary.ageMinutes > maxAgeMinutes) {
    errors.push(`trace_too_old_${summary.ageMinutes}m_max_${maxAgeMinutes}m`);
  }
  if (testCase.expectedMode && summary.mode !== testCase.expectedMode) {
    errors.push(`mode_expected_${testCase.expectedMode}_got_${summary.mode || "missing"}`);
  }
  if (typeof testCase.evidencePackage === "boolean" && summary.evidence_package_present !== testCase.evidencePackage) {
    errors.push(`evidence_package_expected_${testCase.evidencePackage}_got_${summary.evidence_package_present}`);
  }
  if (typeof testCase.packageAware === "boolean" && summary.package_aware_answering_used !== testCase.packageAware) {
    errors.push(`package_aware_expected_${testCase.packageAware}_got_${summary.package_aware_answering_used}`);
  }
  if (testCase.expectedTemporalMetadata && summary.evidence_package_present) {
    const temporal = summary.evidence_package_temporal || {};
    if (!temporal.source_year_count) {
      errors.push("temporal_source_years_missing");
    }
    if (temporal.source_year_count >= 2 && !temporal.temporal_coverage_present) {
      errors.push("temporal_coverage_missing_for_multi_year_evidence");
    }
    if (temporal.source_year_count >= 2 && temporal.temporal_has_multi_year_range !== true) {
      errors.push("temporal_multi_year_flag_missing");
    }
  }
  if (Array.isArray(testCase.displayedParagraphsOnly)) {
    const actual = [...new Set(summary.displayed_paragraph_numbers)].sort();
    const expected = [...testCase.displayedParagraphsOnly].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      errors.push(`displayed_paragraphs_expected_${expected.join("_")}_got_${actual.join("_") || "none"}`);
    }
  }
  return {
    id: testCase.id,
    ok: errors.length === 0,
    errors,
    summary
  };
}

export function parseOptions(argv = process.argv.slice(2)) {
  const take = Number(argv.find(arg => arg.startsWith("--take="))?.split("=")[1] || 500);
  const sinceMinutesArg = argv.find(arg => arg.startsWith("--since-minutes="))?.split("=")[1];
  const maxAgeArg = argv.find(arg => arg.startsWith("--max-age-minutes="))?.split("=")[1];
  const allowStale = argv.includes("--allow-stale");
  const conversationId = argv.find(arg => arg.startsWith("--conversation-id="))?.split("=")[1]?.trim() || null;
  const caseIds = argv
    .filter(arg => arg.startsWith("--case=") || arg.startsWith("--cases="))
    .flatMap(arg => String(arg.split("=")[1] || "").split(","))
    .map(value => value.trim())
    .filter(Boolean);
  const maxAgeMinutes = allowStale
    ? 0
    : Number(maxAgeArg ?? sinceMinutesArg ?? DEFAULT_MAX_AGE_MINUTES);
  return {
    take: Number.isFinite(take) && take > 0 ? Math.floor(take) : 500,
    maxAgeMinutes: allowStale ? 0 : parsePositiveInteger(maxAgeMinutes, DEFAULT_MAX_AGE_MINUTES),
    conversationId,
    caseIds
  };
}

export function selectCases(cases = CASES, caseIds = []) {
  if (!Array.isArray(caseIds) || caseIds.length === 0) {
    return { selectedCases: cases, unknownCaseIds: [] };
  }
  const requested = new Set(caseIds);
  const selectedCases = cases.filter(testCase => requested.has(testCase.id));
  const known = new Set(selectedCases.map(testCase => testCase.id));
  const unknownCaseIds = [...requested].filter(id => !known.has(id));
  return { selectedCases, unknownCaseIds };
}

export function buildPairs(messages = []) {
  const chronological = [...messages].sort((a, b) => {
    const left = toDate(a?.createdAt)?.getTime() ?? 0;
    const right = toDate(b?.createdAt)?.getTime() ?? 0;
    return left - right;
  });
  const previousUserByConversation = new Map();
  const pairs = [];

  for (const message of chronological) {
    if (message.role === "USER") {
      previousUserByConversation.set(message.conversationId, message);
      continue;
    }
    if (message.role === "ASSISTANT") {
      const user = previousUserByConversation.get(message.conversationId);
      if (user) pairs.push({ user, assistant: message });
    }
  }
  return pairs;
}

export function evaluateCasesFromMessages(messages = [], cases = CASES, options = {}) {
  const pairs = buildPairs(messages);
  return cases.map(testCase => {
    const needle = normalize(testCase.userIncludes);
    const pair = [...pairs].reverse().find(item => normalize(item.user.content).includes(needle));
    return evaluateCase(testCase, pair, options);
  });
}

export async function main(argv = process.argv.slice(2)) {
  const { default: prisma } = await import("../lib/prisma.js");
  const options = parseOptions(argv);
  const { selectedCases, unknownCaseIds } = selectCases(CASES, options.caseIds);
  if (unknownCaseIds.length > 0) {
    console.error(JSON.stringify({
      ok: false,
      error: "unknown_case_ids",
      unknown_case_ids: unknownCaseIds,
      valid_case_ids: CASES.map(testCase => testCase.id)
    }, null, 2));
    process.exitCode = 1;
    return;
  }
  const messages = await prisma.conversationMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: options.take,
    where: options.conversationId ? { conversationId: options.conversationId } : undefined,
    select: {
      id: true,
      conversationId: true,
      role: true,
      content: true,
      metadata: true,
      createdAt: true
    }
  });

  const results = evaluateCasesFromMessages(messages, selectedCases, options);
  const ok = results.every(result => result.ok);
  console.log(JSON.stringify({
    ok,
    checked_recent_messages: messages.length,
    max_age_minutes: options.maxAgeMinutes || null,
    conversation_id: options.conversationId || null,
    checked_case_ids: selectedCases.map(testCase => testCase.id),
    results
  }, null, 2));

  await prisma.$disconnect();
  if (!ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async error => {
    try {
      const { default: prisma } = await import("../lib/prisma.js");
      await prisma.$disconnect().catch(() => {});
    } catch {}
    console.error(JSON.stringify({
      ok: false,
      error: error?.message || String(error)
    }, null, 2));
    process.exitCode = 1;
  });
}
