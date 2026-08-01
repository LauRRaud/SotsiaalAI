#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SERVICE_NAMES = Object.freeze({
  frontend: "sotsiaalai-frontend.service",
  rag: "sotsiaalai-rag.service"
});

const CSV_HEADERS = Object.freeze([
  "timestamp_eest",
  "measurement_group",
  "target_idle_bucket",
  "accepted_for_target_bucket",
  "request_order",
  "query_variant",
  "rag_call_index",
  "request_id",
  "observability_stage",
  "frontend_pid",
  "frontend_uptime_ms",
  "time_since_previous_rag_request_ms",
  "embedding_duration_ms",
  "retriever_duration_ms",
  "retrieval_total_ms",
  "retrieval_timeout_ms",
  "aborted_stage",
  "http_status",
  "outcome",
  "source_count",
  "journal_embedding_ms",
  "journal_retrieval_ms",
  "journal_total_ms",
  "journal_stage_count",
  "journal_duplicate_count",
  "journal_upstream_stage",
  "timings_match_journal",
  "notes"
]);

const NOTE_TAGS = new Set([
  "ok",
  "setup_smoke",
  "frontend_restarted",
  "rag_restarted",
  "intervening_rag_traffic",
  "missing_audit_event",
  "journal_mismatch",
  "journal_unavailable",
  "timeout",
  "http_error"
]);

const args = new Set(process.argv.slice(2));
const isDryRun = args.has("--dry-run") || args.has("--mock");
const isSetupSmoke = args.has("--setup-smoke");

const config = {
  chatBaseUrl: process.env.B0_CHAT_BASE_URL || "https://sotsiaal.ai",
  csvPath: process.env.B0_MEASUREMENT_CSV
    || path.join(process.cwd(), "docs/internal/b0-idle-rag-measurements.csv"),
  statePath: process.env.B0_MEASUREMENT_STATE
    || path.join(process.cwd(), "docs/internal/.b0-idle-rag-state.json"),
  queryA: process.env.B0_QUERY_A || "",
  queryB: process.env.B0_QUERY_B || "",
  sessionCookie: process.env.TEST_SESSION_COOKIE || "",
  prismaClientPath: process.env.B0_PRISMA_CLIENT_PATH
    || path.join(process.cwd(), "generated/prisma/client.ts"),
  requestTimeoutMs: Math.max(30_000, Number(process.env.B0_HTTP_TIMEOUT_MS) || 60_000),
  pairDelayMs: Math.min(60_000, Math.max(10_000, Number(process.env.B0_PAIR_DELAY_MS) || 10_000))
};

function fail(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringValue(value, maxLength = 200) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function hashShort(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex").slice(0, 12);
}

function timestampEest(value = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Tallinn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "longOffset"
    }).formatToParts(value).map(part => [part.type, part.value])
  );
  const offset = String(parts.timeZoneName || "GMT").replace(/^GMT$/, "+00:00").replace(/^GMT/, "");
  return parts.year + "-" + parts.month + "-" + parts.day + "T"
    + parts.hour + ":" + parts.minute + ":" + parts.second + offset;
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? "\"" + text.replaceAll("\"", "\"\"") + "\"" : text;
}

function csvLine(row) {
  return CSV_HEADERS.map(header => csvEscape(row[header])).join(",");
}

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted && char === "\"" && line[index + 1] === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function parseCsv(text) {
  const lines = String(text || "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const fields = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, fields[index] ?? ""]));
  });
}

async function ensureCsv() {
  await mkdir(path.dirname(config.csvPath), { recursive: true });
  let existing = "";
  try {
    existing = await readFile(config.csvPath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const firstLine = existing.split(/\r?\n/)[0] || "";
  const expected = CSV_HEADERS.join(",");
  if (firstLine && firstLine !== expected) throw fail("CSV_SCHEMA_MISMATCH");
  if (!firstLine) await writeFile(config.csvPath, expected + "\n", { mode: 0o600 });
  return parseCsv(existing || expected + "\n");
}

async function readState() {
  try {
    const raw = await readFile(config.statePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw fail("STATE_READ_FAILED");
  }
}

async function writeState(state) {
  await mkdir(path.dirname(config.statePath), { recursive: true });
  await writeFile(config.statePath, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
}

function command(commandName, commandArgs) {
  try {
    return execFileSync(commandName, commandArgs, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    throw fail("COMMAND_FAILED_" + commandName);
  }
}

function serviceSnapshot() {
  const read = (service, property) => command("systemctl", ["show", "-p" + property, "--value", service]);
  return {
    frontend: {
      active: command("systemctl", ["is-active", SERVICE_NAMES.frontend]) === "active",
      pid: finiteNumber(read(SERVICE_NAMES.frontend, "MainPID")),
      activeEnter: read(SERVICE_NAMES.frontend, "ActiveEnterTimestamp")
    },
    rag: {
      active: command("systemctl", ["is-active", SERVICE_NAMES.rag]) === "active",
      pid: finiteNumber(read(SERVICE_NAMES.rag, "MainPID")),
      activeEnter: read(SERVICE_NAMES.rag, "ActiveEnterTimestamp")
    }
  };
}

function frontendUptimeMs(snapshot, now = Date.now()) {
  const activeAt = Date.parse(snapshot?.frontend?.activeEnter || "");
  if (!Number.isFinite(activeAt)) return null;
  return Math.max(0, now - activeAt);
}

function compareBaseline(snapshot, baseline) {
  if (!baseline?.frontend || !baseline?.rag) return "baseline_missing";
  if (
    snapshot.frontend.pid !== baseline.frontend.pid
    || snapshot.frontend.activeEnter !== baseline.frontend.activeEnter
  ) return "frontend_restarted";
  if (
    snapshot.rag.pid !== baseline.rag.pid
    || snapshot.rag.activeEnter !== baseline.rag.activeEnter
  ) return "rag_restarted";
  return null;
}

function bucketForIdle(value) {
  const idle = finiteNumber(value);
  if (idle === null) return "unknown";
  if (idle >= 900_000 && idle <= 1_800_000) return "15-30m";
  if (idle >= 3_600_000 && idle <= 7_200_000) return "60-120m";
  if (idle >= 21_600_000) return ">=6h";
  return "other";
}

function collectQueryVariants(existingRows) {
  const groups = new Set(
    existingRows
      .map(row => row.measurement_group)
      .filter(value => value && value.startsWith("idle-"))
  );
  const sequence = groups.size + 1;
  const first = sequence % 2 === 1 ? "A" : "B";
  return first === "A"
    ? [["A", config.queryA], ["B", config.queryB]]
    : [["B", config.queryB], ["A", config.queryA]];
}

function acceptedDistributionComplete(existingRows) {
  const acceptedGroups = new Map();
  for (const row of existingRows) {
    if (
      !row.measurement_group?.startsWith("idle-")
      || row.accepted_for_target_bucket !== "true"
    ) continue;
    if (!acceptedGroups.has(row.measurement_group)) {
      acceptedGroups.set(row.measurement_group, row.target_idle_bucket);
    }
  }
  const buckets = { "15-30m": 0, "60-120m": 0, ">=6h": 0 };
  for (const bucket of acceptedGroups.values()) {
    if (Object.prototype.hasOwnProperty.call(buckets, bucket)) buckets[bucket] += 1;
  }
  return acceptedGroups.size >= 8
    && acceptedGroups.size <= 12
    && buckets["15-30m"] >= 2
    && buckets["60-120m"] >= 3
    && buckets[">=6h"] >= 2;
}

function extractCookieHeader() {
  if (!config.sessionCookie) throw fail("SESSION_COOKIE_MISSING");
  const value = String(config.sessionCookie).trim();
  return value.startsWith("__Secure-next-auth.session-token=")
    ? value
    : "__Secure-next-auth.session-token=" + value;
}

async function requestJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(config.requestTimeoutMs)
    });
  } catch {
    throw fail("HTTP_REQUEST_FAILED");
  }
  const raw = await response.text();
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }
  return { status: response.status, ok: response.ok, json };
}

async function readSyntheticSession() {
  const response = await requestJson(config.chatBaseUrl + "/api/auth/session", {
    headers: { Cookie: extractCookieHeader() }
  });
  if (response.status !== 200 || !response.json?.user) throw fail("SESSION_INVALID");
  const email = String(response.json.user.email || "").toLowerCase();
  if (!email.endsWith("@sotsiaalai.test")) throw fail("SESSION_NOT_SYNTHETIC");
  return {
    email,
    id: stringValue(response.json.user.id, 200)
  };
}

async function createPrisma() {
  const clientModule = await import(pathToFileURL(config.prismaClientPath).href);
  const adapterModule = await import("@prisma/adapter-pg");
  const PrismaClient = clientModule.PrismaClient;
  const PrismaPg = adapterModule.PrismaPg;
  if (typeof PrismaClient !== "function" || typeof PrismaPg !== "function") {
    throw fail("PRISMA_RUNTIME_INVALID");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
  });
}

async function resolveSyntheticUserId(db, session) {
  if (session.id) {
    const found = await db.user.findUnique({
      where: { id: session.id },
      select: { id: true, email: true }
    });
    if (found?.id && String(found.email || "").toLowerCase().endsWith("@sotsiaalai.test")) {
      return found.id;
    }
  }
  const found = await db.user.findUnique({
    where: { email: session.email },
    select: { id: true, email: true }
  });
  if (!found?.id || !String(found.email || "").toLowerCase().endsWith("@sotsiaalai.test")) {
    throw fail("SYNTHETIC_USER_NOT_FOUND");
  }
  return found.id;
}

async function readRagEvents(db, userId, startedAt, endedAt) {
  return db.chatLog.findMany({
    where: {
      event: "rag_search",
      userId,
      createdAt: {
        gte: new Date(Math.max(0, startedAt - 1_500)),
        lte: new Date(endedAt + 10_000)
      }
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, data: true }
  });
}

async function countInterveningRagEvents(db, previousEnd, currentStart) {
  if (!previousEnd || currentStart <= previousEnd) return 0;
  return db.chatLog.count({
    where: {
      event: "rag_search",
      createdAt: {
        gt: new Date(previousEnd),
        lt: new Date(currentStart)
      }
    }
  });
}

function sourceCountFromResponse(json) {
  const candidates = [json, json?.data, json?.response];
  for (const candidate of candidates) {
    if (Array.isArray(candidate?.sources)) return candidate.sources.length;
    if (Array.isArray(candidate?.displayed_sources)) return candidate.displayed_sources.length;
  }
  return null;
}

async function runChatRequest({ query, queryVariant, requestOrder, db, userId }) {
  const startedAt = Date.now();
  let response = null;
  let errorCode = null;
  try {
    response = await requestJson(config.chatBaseUrl + "/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: extractCookieHeader()
      },
      body: JSON.stringify({
        message: query,
        persist: false,
        role: "SOCIAL_WORKER",
        uiLocale: "et",
        chatMode: "rag",
        forceSources: true,
        stream: false
      })
    });
  } catch (error) {
    errorCode = error?.code || "HTTP_REQUEST_FAILED";
  }
  const endedAt = Date.now();
  await new Promise(resolve => setTimeout(resolve, 400));
  let auditEvents = [];
  if (db && userId) {
    try {
      auditEvents = await readRagEvents(db, userId, startedAt, endedAt);
    } catch {
      errorCode = errorCode || "AUDIT_QUERY_FAILED";
    }
  }
  return {
    queryVariant,
    requestOrder,
    startedAt,
    endedAt,
    response,
    errorCode,
    auditEvents,
    sourceCount: sourceCountFromResponse(response?.json)
  };
}

function parseJournalLine(line) {
  const marker = "rag.search.stage ";
  const markerIndex = line.indexOf(marker);
  if (markerIndex < 0) return null;
  try {
    const parsed = JSON.parse(line.slice(markerIndex + marker.length).trim());
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function journalForRequest(requestId, startedAt, endedAt) {
  if (!requestId) return { rows: [], unavailable: false };
  try {
    const output = execFileSync("journalctl", [
      "-u", SERVICE_NAMES.rag,
      "--since", new Date(Math.max(0, startedAt - 1_000)).toISOString(),
      "--until", new Date(endedAt + 10_000).toISOString(),
      "--no-pager",
      "-o", "cat"
    ], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 8 * 1024 * 1024
    });
    const rows = output.split(/\r?\n/)
      .map(parseJournalLine)
      .filter(row => row && row.request_id === requestId);
    return { rows, unavailable: false };
  } catch {
    return { rows: [], unavailable: true };
  }
}

function journalSummary(journal, timing) {
  const byStage = new Map();
  for (const row of journal.rows) {
    const stage = stringValue(row.stage, 100);
    if (!byStage.has(stage)) byStage.set(stage, []);
    byStage.get(stage).push(row);
  }
  const embedding = byStage.get("embedding")?.[0] || null;
  const retrieval = byStage.get("retrieval")?.[0] || null;
  const total = byStage.get("search_total")?.[0] || null;
  const stageCount = journal.rows.length;
  const duplicateCount = [...byStage.values()].reduce(
    (sum, rows) => sum + Math.max(0, rows.length - 1),
    0
  );
  const upstreamStages = new Set(journal.rows.map(row => stringValue(row.upstream_stage, 100)).filter(Boolean));
  const embeddingTiming = finiteNumber(timing?.embedding_duration_ms);
  const retrievalTiming = finiteNumber(timing?.retriever_duration_ms);
  const totalTiming = finiteNumber(timing?.retrieval_total_ms);
  const embeddingDuration = finiteNumber(embedding?.duration_ms);
  const retrievalDuration = finiteNumber(retrieval?.duration_ms);
  const totalDuration = finiteNumber(total?.duration_ms);
  const elapsedValues = journal.rows.map(row => finiteNumber(row.elapsed_ms));
  const durationsValid = [embeddingDuration, retrievalDuration, totalDuration]
    .every(value => value !== null && value >= 0);
  const elapsedValid = elapsedValues.length === 3
    && elapsedValues.every(value => value !== null && value >= 0);
  const stagesExact = byStage.size === 3
    && ["embedding", "retrieval", "search_total"].every(stage => byStage.has(stage));
  const outcomesValid = timing?.outcome !== "ok"
    || journal.rows.every(row => row.outcome === "ok");
  const matches = timing && stageCount === 3 && duplicateCount === 0
    && stagesExact
    && upstreamStages.size === 1
    && upstreamStages.has(stringValue(timing.observabilityStage, 100))
    && embeddingTiming !== null
    && retrievalTiming !== null
    && totalTiming !== null
    && durationsValid
    && elapsedValid
    && outcomesValid
    && Math.abs(embeddingTiming - embeddingDuration) <= 2
    && Math.abs(retrievalTiming - retrievalDuration) <= 2
    && Math.abs(totalTiming - totalDuration) <= 2;
  return {
    embeddingMs: finiteNumber(embedding?.duration_ms),
    retrievalMs: finiteNumber(retrieval?.duration_ms),
    totalMs: finiteNumber(total?.duration_ms),
    stageCount,
    duplicateCount,
    upstreamStage: [...upstreamStages][0] || "",
    timingsMatch: journal.unavailable ? null : matches,
    unavailable: journal.unavailable
  };
}

function timingRowsFromCall(call, snapshot, measurementGroup, targetBucket, accepted, groupNotes) {
  const eventTimings = call.auditEvents.flatMap(event => {
    const data = event.data && typeof event.data === "object" ? event.data : {};
    return Array.isArray(data.retrievalTimings)
      ? data.retrievalTimings.map(timing => ({ timing, event }))
      : [];
  });
  const rows = eventTimings.length ? eventTimings : [{ timing: null, event: null }];
  return rows.map((entry, index) => {
    const timing = entry.timing;
    const requestId = stringValue(timing?.request_id, 200);
    const journal = journalSummary(
      journalForRequest(requestId, call.startedAt, call.endedAt),
      timing
    );
    const notes = [...groupNotes];
    if (!timing) {
      notes.push(call.auditEvents.length ? "missing_audit_event" : "http_error");
    } else if (timing.aborted_stage) {
      notes.push("timeout");
    } else if (journal.unavailable) {
      notes.push("journal_unavailable");
    } else if (journal.timingsMatch !== true) {
      notes.push("journal_mismatch");
    } else if (timing.outcome === "ok" && finiteNumber(call.response?.status) === 200) {
      notes.push("ok");
    } else {
      notes.push("http_error");
    }
    const uniqueNotes = [...new Set(notes.filter(note => NOTE_TAGS.has(note)))];
    return {
      timestamp_eest: timestampEest(new Date(call.startedAt)),
      measurement_group: measurementGroup,
      target_idle_bucket: targetBucket,
      accepted_for_target_bucket: accepted,
      request_order: call.requestOrder,
      query_variant: call.queryVariant,
      rag_call_index: index,
      request_id: requestId,
      observability_stage: stringValue(timing?.observabilityStage, 100),
      frontend_pid: snapshot.frontend.pid,
      frontend_uptime_ms: frontendUptimeMs(snapshot, call.startedAt),
      time_since_previous_rag_request_ms: finiteNumber(timing?.time_since_previous_rag_request_ms),
      embedding_duration_ms: finiteNumber(timing?.embedding_duration_ms),
      retriever_duration_ms: finiteNumber(timing?.retriever_duration_ms),
      retrieval_total_ms: finiteNumber(timing?.retrieval_total_ms),
      retrieval_timeout_ms: finiteNumber(timing?.retrieval_timeout_ms),
      aborted_stage: stringValue(timing?.aborted_stage, 100),
      http_status: timing && Object.prototype.hasOwnProperty.call(timing, "http_status")
        ? finiteNumber(timing.http_status)
        : finiteNumber(call.response?.status),
      outcome: stringValue(timing?.outcome, 40) || (call.response?.ok ? "ok" : "error"),
      source_count: finiteNumber(call.sourceCount),
      journal_embedding_ms: journal.embeddingMs,
      journal_retrieval_ms: journal.retrievalMs,
      journal_total_ms: journal.totalMs,
      journal_stage_count: journal.stageCount,
      journal_duplicate_count: journal.duplicateCount,
      journal_upstream_stage: journal.upstreamStage,
      timings_match_journal: journal.timingsMatch,
      notes: uniqueNotes.join("|")
    };
  });
}

function firstNativeRow(rows, requestOrder) {
  return rows.find(row =>
    Number(row.request_order) === requestOrder
    && row.observability_stage === "rag_search"
  ) || null;
}

function validateConfiguration() {
  if (isDryRun) return;
  if (!config.queryA || !config.queryB || config.queryA === config.queryB) {
    throw fail("QUERY_VARIANTS_MISSING_OR_EQUAL");
  }
  if (!config.sessionCookie) throw fail("SESSION_COOKIE_MISSING");
}

async function dryRun() {
  const mockResponse = {
    status: 200,
    ok: true,
    json: { rag_contract_version: "v1", sources: [{}] }
  };
  if (mockResponse.status !== 200 || sourceCountFromResponse(mockResponse.json) !== 1) {
    throw fail("MOCK_FETCH_FAILED");
  }
  if (CSV_HEADERS.length !== 28 || !CSV_HEADERS.includes("request_id")) {
    throw fail("CSV_SCHEMA_INVALID");
  }
  const mockTiming = {
    request_id: "mock-request",
    observabilityStage: "rag_search",
    embedding_duration_ms: 125,
    retriever_duration_ms: 25,
    retrieval_total_ms: 150,
    outcome: "ok"
  };
  const mockJournal = {
    unavailable: false,
    rows: [
      { request_id: "mock-request", upstream_stage: "rag_search", stage: "embedding", duration_ms: 125, elapsed_ms: 125, outcome: "ok" },
      { request_id: "mock-request", upstream_stage: "rag_search", stage: "retrieval", duration_ms: 25, elapsed_ms: 150, outcome: "ok" },
      { request_id: "mock-request", upstream_stage: "rag_search", stage: "search_total", duration_ms: 150, elapsed_ms: 150, outcome: "ok" }
    ]
  };
  if (journalSummary(mockJournal, mockTiming).timingsMatch !== true) {
    throw fail("MOCK_JOURNAL_MATCH_FAILED");
  }
  if (journalSummary({ ...mockJournal, rows: [...mockJournal.rows, mockJournal.rows[0]] }, mockTiming).timingsMatch !== false) {
    throw fail("MOCK_JOURNAL_DUPLICATE_GATE_FAILED");
  }
  const completeRows = [
    ...Array.from({ length: 2 }, (_, index) => ({ measurement_group: `idle-a-${index}`, accepted_for_target_bucket: "true", target_idle_bucket: "15-30m" })),
    ...Array.from({ length: 3 }, (_, index) => ({ measurement_group: `idle-b-${index}`, accepted_for_target_bucket: "true", target_idle_bucket: "60-120m" })),
    ...Array.from({ length: 3 }, (_, index) => ({ measurement_group: `idle-c-${index}`, accepted_for_target_bucket: "true", target_idle_bucket: ">=6h" }))
  ];
  if (!acceptedDistributionComplete(completeRows)) {
    throw fail("MOCK_DISTRIBUTION_GATE_FAILED");
  }
  console.log(JSON.stringify({
    event: "b0_idle_measurement_dry_run",
    mock_fetch_status: mockResponse.status,
    csv_columns: CSV_HEADERS.length,
    query_variants: "A/B",
    pair_delay_ms: config.pairDelayMs,
    journal_gate: true,
    distribution_gate: true,
    runtime_calls: false
  }));
}

async function runMeasurement() {
  validateConfiguration();
  const existingRows = await ensureCsv();
  if (!isSetupSmoke && acceptedDistributionComplete(existingRows)) {
    console.log(JSON.stringify({
      event: "b0_idle_measurement_window_complete",
      runtime_calls: false
    }));
    return;
  }
  const state = await readState();
  const snapshotBefore = serviceSnapshot();
  if (!snapshotBefore.frontend.active || !snapshotBefore.rag.active) {
    throw fail("SERVICE_INACTIVE");
  }
  if (!isSetupSmoke) {
    const baselineIssue = compareBaseline(snapshotBefore, state.baseline);
    if (baselineIssue) throw fail(baselineIssue.toUpperCase());
  }
  const session = await readSyntheticSession();
  const db = await createPrisma();
  let rows = [];
  try {
    const userId = await resolveSyntheticUserId(db, session);
    const groupStartedAt = Date.now();
    const groupId = (isSetupSmoke ? "setup-smoke-" : "idle-") + groupStartedAt;
    const previousEnd = finiteNumber(state.last_request_end_ms);
    const interveningCount = await countInterveningRagEvents(db, previousEnd, groupStartedAt);
    const variants = collectQueryVariants(existingRows);
    const firstCall = await runChatRequest({
      query: variants[0][1],
      queryVariant: variants[0][0],
      requestOrder: 1,
      db,
      userId
    });
    await new Promise(resolve => setTimeout(resolve, config.pairDelayMs));
    const secondCall = await runChatRequest({
      query: variants[1][1],
      queryVariant: variants[1][0],
      requestOrder: 2,
      db,
      userId
    });
    const snapshotAfter = serviceSnapshot();
    const restartIssue = isSetupSmoke ? null : compareBaseline(snapshotAfter, state.baseline);
    const firstRowsPreview = timingRowsFromCall(firstCall, snapshotBefore, groupId, "", false, []);
    const secondRowsPreview = timingRowsFromCall(secondCall, snapshotBefore, groupId, "", false, []);
    const firstNative = firstNativeRow(firstRowsPreview, 1);
    const secondNative = firstNativeRow(secondRowsPreview, 2);
    const targetBucket = bucketForIdle(firstNative?.time_since_previous_rag_request_ms);
    const accepted = !isSetupSmoke
      && Boolean(firstNative && secondNative)
      && ["15-30m", "60-120m", ">=6h"].includes(targetBucket)
      && interveningCount === 0
      && !restartIssue
      && snapshotAfter.frontend.active
      && snapshotAfter.rag.active;
    const allPreviewRows = [...firstRowsPreview, ...secondRowsPreview];
    const journalGate = allPreviewRows.every(row =>
      row?.outcome !== "ok" || row.timings_match_journal === true
    );
    const acceptedForJournal = accepted && journalGate;
    const groupNotes = [];
    if (isSetupSmoke) groupNotes.push("setup_smoke");
    if (interveningCount > 0) groupNotes.push("intervening_rag_traffic");
    if (restartIssue === "frontend_restarted") groupNotes.push("frontend_restarted");
    if (restartIssue === "rag_restarted") groupNotes.push("rag_restarted");
    rows = [
      ...timingRowsFromCall(firstCall, snapshotBefore, groupId, targetBucket, acceptedForJournal, groupNotes),
      ...timingRowsFromCall(secondCall, snapshotBefore, groupId, targetBucket, acceptedForJournal, groupNotes)
    ];
    if (!rows.length) throw fail("NO_MEASUREMENT_ROWS");
    await appendFile(config.csvPath, rows.map(csvLine).join("\n") + "\n", { mode: 0o600 });
    await writeState({
      ...state,
      baseline: isSetupSmoke ? snapshotAfter : state.baseline,
      baseline_created_at_eest: isSetupSmoke ? timestampEest() : state.baseline_created_at_eest,
      last_request_end_ms: secondCall.endedAt,
      query_hash_a: hashShort(config.queryA),
      query_hash_b: hashShort(config.queryB),
      last_group: groupId
    });
    console.log(JSON.stringify({
      event: "b0_idle_measurement",
      measurement_group: groupId,
      setup_smoke: isSetupSmoke,
      rows: rows.length,
      accepted_for_target_bucket: acceptedForJournal,
      target_idle_bucket: targetBucket,
      intervening_rag_events: interveningCount,
      frontend_pid: snapshotAfter.frontend.pid,
      rag_pid: snapshotAfter.rag.pid,
      frontend_active: snapshotAfter.frontend.active,
      rag_active: snapshotAfter.rag.active,
      session_ok: true
    }));
    if (!firstNative || !secondNative) throw fail("MISSING_AUDIT_EVENT");
    if (!journalGate) throw fail("JOURNAL_MISMATCH");
    if (restartIssue) throw fail(restartIssue.toUpperCase());
    if (!snapshotAfter.frontend.active || !snapshotAfter.rag.active) throw fail("SERVICE_INACTIVE");
  } finally {
    await db.$disconnect().catch(() => {});
  }
}

async function main() {
  if (isDryRun) {
    await dryRun();
    return;
  }
  await runMeasurement();
}

main().catch(error => {
  console.error(JSON.stringify({
    event: "b0_idle_measurement_failed",
    error_code: error?.code || "MEASUREMENT_FAILED"
  }));
  process.exitCode = 1;
});
